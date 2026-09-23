import crypto from "crypto";
import bcrypt from "bcryptjs";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import { isUniqueConstraintError } from "./prisma-errors";

export class DuplicatePendingRequestError extends Error {
  constructor(deviceId: string) {
    super(`A pending registration request already exists for sensor "${deviceId}".`);
    this.name = "DuplicatePendingRequestError";
  }
}

export class DuplicateRegistrationError extends Error {
  constructor(deviceId: string) {
    super(`Sensor "${deviceId}" is already registered.`);
    this.name = "DuplicateRegistrationError";
  }
}

export class RegistrationRequestNotFoundError extends Error {
  constructor(id: string) {
    super(`Registration request "${id}" was not found.`);
    this.name = "RegistrationRequestNotFoundError";
  }
}

export class InvalidRequestStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidRequestStateError";
  }
}

export interface SubmitRegistrationRequestInput {
  deviceId: string;
  requesterMetadata?: Prisma.InputJsonValue;
}

/**
 * Creates a new PENDING registration request for a device ID.
 * Relies on the `pendingDeviceKey` unique DB constraint (see schema.prisma)
 * to atomically reject a second pending request for the same device, even
 * under concurrent submissions — this is not just an app-level check.
 */
export async function submitRegistrationRequest(input: SubmitRegistrationRequestInput) {
  try {
    return await prisma.deviceRegistrationRequest.create({
      data: {
        deviceId: input.deviceId,
        pendingDeviceKey: input.deviceId,
        requesterMetadata: input.requesterMetadata,
      },
    });
  } catch (err) {
    if (isUniqueConstraintError(err, "pendingDeviceKey")) {
      throw new DuplicatePendingRequestError(input.deviceId);
    }
    throw err;
  }
}

/**
 * Approves a pending registration request: marks it APPROVED, creates (or
 * re-enables) the matching RegisteredDevice as ACTIVE, and logs both a
 * DeviceStatusEvent and an AdminAuditEvent — all in one transaction so a
 * request can never end up "approved" without a corresponding active
 * device, or vice versa.
 */
export async function approveRegistrationRequest(
  requestId: string,
  adminId: string,
  reviewReason?: string
) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.deviceRegistrationRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new RegistrationRequestNotFoundError(requestId);
    if (request.status !== "PENDING") {
      throw new InvalidRequestStateError(
        `Request "${requestId}" is ${request.status}, not PENDING.`
      );
    }

    const updatedRequest = await tx.deviceRegistrationRequest.update({
      where: { id: requestId },
      data: {
        status: "APPROVED",
        reviewedAt: new Date(),
        reviewedByAdminId: adminId,
        reviewReason: reviewReason ?? null,
        pendingDeviceKey: null,
      },
    });

    const existingDevice = await tx.registeredDevice.findUnique({
      where: { deviceId: request.deviceId },
    });
    const previousStatus = existingDevice?.status ?? null;

    // Newly approved devices are active by default; re-approving a
    // previously deactivated device also reactivates it.
    const device = await tx.registeredDevice.upsert({
      where: { deviceId: request.deviceId },
      create: { deviceId: request.deviceId, status: "ACTIVE" },
      update: { status: "ACTIVE" },
    });

    await tx.deviceStatusEvent.create({
      data: {
        registeredDeviceId: device.id,
        previousStatus,
        newStatus: "ACTIVE",
        changedByAdminId: adminId,
        reason: "Registration request approved",
      },
    });

    await recordAuditEvent(
      {
        adminId,
        action: "REGISTRATION_REQUEST_APPROVED",
        entityType: "DeviceRegistrationRequest",
        entityId: request.id,
        metadata: { deviceId: request.deviceId },
      },
      tx
    );

    return { request: updatedRequest, device };
  });
}

/** Rejects a pending registration request. Does not touch RegisteredDevice. */
export async function rejectRegistrationRequest(
  requestId: string,
  adminId: string,
  reviewReason: string
) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.deviceRegistrationRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new RegistrationRequestNotFoundError(requestId);
    if (request.status !== "PENDING") {
      throw new InvalidRequestStateError(
        `Request "${requestId}" is ${request.status}, not PENDING.`
      );
    }

    const updatedRequest = await tx.deviceRegistrationRequest.update({
      where: { id: requestId },
      data: {
        status: "REJECTED",
        reviewedAt: new Date(),
        reviewedByAdminId: adminId,
        reviewReason,
        pendingDeviceKey: null,
      },
    });

    await recordAuditEvent(
      {
        adminId,
        action: "REGISTRATION_REQUEST_REJECTED",
        entityType: "DeviceRegistrationRequest",
        entityId: request.id,
        metadata: { deviceId: request.deviceId, reason: reviewReason },
      },
      tx
    );

    return updatedRequest;
  });
}

/** Withdraws a still-pending request (e.g. superseded by a newer submission). */
export async function cancelRegistrationRequest(requestId: string) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.deviceRegistrationRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new RegistrationRequestNotFoundError(requestId);
    if (request.status !== "PENDING") {
      throw new InvalidRequestStateError(
        `Request "${requestId}" is ${request.status}, not PENDING.`
      );
    }

    return tx.deviceRegistrationRequest.update({
      where: { id: requestId },
      data: { status: "CANCELLED", reviewedAt: new Date(), pendingDeviceKey: null },
    });
  });
}

/**
 * Registers a sensor and immediately issues a bearer token (shown once).
 * Creates RegisteredDevice with status ACTIVE and an AUTO_APPROVED
 * DeviceRegistrationRequest in a single atomic transaction.
 */
export async function autoRegisterWithToken(deviceId: string) {
  const plainToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = await bcrypt.hash(plainToken, 12);

  const existing = await prisma.registeredDevice.findUnique({
    where: { deviceId },
  });

  if (existing) {
    const updated = await prisma.$transaction(async (tx) => {
      const dev = await tx.registeredDevice.update({
        where: { id: existing.id },
        data: {
          tokenHash,
          status: "ACTIVE",
          lastSeenAt: new Date(),
        },
      });

      await recordAuditEvent(
        {
          adminId: null,
          action: "SENSOR_TOKEN_REFRESHED",
          entityType: "RegisteredDevice",
          entityId: dev.id,
          metadata: { deviceId },
        },
        tx
      );

      return dev;
    });

    return { token: plainToken, device: updated, isExisting: true };
  }

  return prisma.$transaction(async (tx) => {
    const device = await tx.registeredDevice.create({
      data: {
        deviceId,
        status: "ACTIVE",
        tokenHash,
        firstSeenAt: new Date(),
      },
    });

    const request = await tx.deviceRegistrationRequest.create({
      data: {
        deviceId,
        status: "AUTO_APPROVED",
        reviewedAt: new Date(),
        reviewReason: "Auto-registered via sensor registration API",
        pendingDeviceKey: null,
      },
    });

    await tx.deviceStatusEvent.create({
      data: {
        registeredDeviceId: device.id,
        newStatus: "ACTIVE",
        reason: "Auto-registered via API",
      },
    });

    await recordAuditEvent(
      {
        adminId: null,
        action: "SENSOR_REGISTERED",
        entityType: "RegisteredDevice",
        entityId: device.id,
        metadata: { deviceId },
      },
      tx
    );

    return { token: plainToken, device, request };
  });
}

/**
 * Auto-registers a sensor when needed:
 * creates RegisteredDevice with status ACTIVE and an AUTO_APPROVED
 * DeviceRegistrationRequest in a single transaction.
 */
export async function autoRegisterSensor(
  deviceId: string,
  client: PrismaClient | Prisma.TransactionClient = prisma
) {
  const run = async (tx: Prisma.TransactionClient) => {
    const existing = await tx.registeredDevice.findUnique({ where: { deviceId } });
    if (existing) {
      return existing;
    }

    const device = await tx.registeredDevice.create({
      data: {
        deviceId,
        status: "ACTIVE",
      },
    });

    await tx.deviceRegistrationRequest.create({
      data: {
        deviceId,
        status: "AUTO_APPROVED",
        reviewedAt: new Date(),
        reviewReason: "Auto-registered on first data upload",
        pendingDeviceKey: null,
      },
    });

    await tx.deviceStatusEvent.create({
      data: {
        registeredDeviceId: device.id,
        newStatus: "ACTIVE",
        reason: "Auto-registered on upload",
      },
    });

    await recordAuditEvent(
      {
        adminId: null,
        action: "SENSOR_AUTO_REGISTERED",
        entityType: "RegisteredDevice",
        entityId: device.id,
        metadata: { deviceId },
      },
      tx
    );

    return device;
  };

  if ("$transaction" in client) {
    return (client as PrismaClient).$transaction(run);
  }
  return run(client as Prisma.TransactionClient);
}
