import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  submitRegistrationRequest,
  approveRegistrationRequest,
  rejectRegistrationRequest,
} from "../src/lib/services/registration-requests";
import { updateDeviceStatus } from "../src/lib/services/devices";
import { recordUpload } from "../src/lib/services/uploads";

const prisma = new PrismaClient();

// Fixed, recognizable device IDs so this script is safe to re-run: it
// cleans up exactly these rows (children first, to satisfy foreign keys)
// before recreating them, and never touches any other data.
const SEED_DEVICE_IDS = [
  "DEV-ENABLED-001",
  "DEV-DISABLED-001",
  "DEV-PENDING-001",
  "DEV-REJECTED-001",
] as const;

async function seedAdmin() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    throw new Error(
      "ADMIN_USERNAME and ADMIN_PASSWORD must be set (see .env.example) before seeding."
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.adminAccount.upsert({
    where: { username },
    update: { passwordHash, isActive: true },
    create: { username, passwordHash, role: "SUPER_ADMIN" },
  });

  console.log(`Seeded admin account "${admin.username}" (id: ${admin.id})`);
  return admin;
}

async function cleanPreviousSeedData() {
  const devices = await prisma.registeredDevice.findMany({
    where: { deviceId: { in: [...SEED_DEVICE_IDS] } },
    select: { id: true },
  });
  const deviceRowIds = devices.map((d) => d.id);

  const fileRecords = await prisma.uploadedFileRecord.findMany({
    where: { registeredDeviceId: { in: deviceRowIds } },
    select: { id: true },
  });
  const fileRecordIds = fileRecords.map((f) => f.id);

  await prisma.uploadStorageObject.deleteMany({
    where: { uploadedFileRecordId: { in: fileRecordIds } },
  });
  await prisma.uploadedFileRecord.deleteMany({
    where: { id: { in: fileRecordIds } },
  });
  await prisma.deviceStatusEvent.deleteMany({
    where: { registeredDeviceId: { in: deviceRowIds } },
  });
  await prisma.deviceRegistrationRequest.deleteMany({
    where: { deviceId: { in: [...SEED_DEVICE_IDS] } },
  });
  await prisma.registeredDevice.deleteMany({
    where: { deviceId: { in: [...SEED_DEVICE_IDS] } },
  });

  console.log("Cleared previous seed data for", SEED_DEVICE_IDS.join(", "));
}

async function seedDevicesAndRequests(adminId: string) {
  // --- One enabled device, reached via submit -> approve, exactly like a
  //     real admin approving a device through the dashboard would. ---
  const enabledRequest = await submitRegistrationRequest({
    deviceId: "DEV-ENABLED-001",
    requesterMetadata: { label: "Warehouse sensor #1", submittedFrom: "seed-script" },
  });
  const { device: enabledDevice } = await approveRegistrationRequest(
    enabledRequest.id,
    adminId,
    "Verified during initial rollout"
  );
  console.log(`Enabled device: ${enabledDevice.deviceId} (status: ${enabledDevice.status})`);

  // --- One disabled device: approved, then later disabled, producing a
  //     real DeviceStatusEvent transition (ENABLED -> DISABLED). ---
  const disabledRequest = await submitRegistrationRequest({
    deviceId: "DEV-DISABLED-001",
    requesterMetadata: { label: "Retired handheld scanner", submittedFrom: "seed-script" },
  });
  const { device: approvedThenDisabled } = await approveRegistrationRequest(
    disabledRequest.id,
    adminId,
    "Approved for pilot program"
  );
  const disabledDevice = await updateDeviceStatus(
    approvedThenDisabled.id,
    "DEACTIVE",
    adminId,
    "Decommissioned after pilot program ended"
  );
  console.log(`Disabled device: ${disabledDevice.deviceId} (status: ${disabledDevice.status})`);

  // --- One pending registration request (not yet reviewed). ---
  const pendingRequest = await submitRegistrationRequest({
    deviceId: "DEV-PENDING-001",
    requesterMetadata: { label: "New loading-dock scanner", submittedFrom: "seed-script" },
  });
  console.log(`Pending request: ${pendingRequest.deviceId} (status: ${pendingRequest.status})`);

  // --- One rejected registration request. ---
  const rejectedSubmission = await submitRegistrationRequest({
    deviceId: "DEV-REJECTED-001",
  });
  const rejectedRequest = await rejectRegistrationRequest(
    rejectedSubmission.id,
    adminId,
    "Device ID could not be verified against procurement records"
  );
  console.log(`Rejected request: ${rejectedRequest.deviceId} (status: ${rejectedRequest.status})`);

  return { enabledDevice };
}

async function seedUploads(registeredDeviceId: string, deviceId: string) {
  const sampleUploads = [
    {
      originalFileName: "shift-report-2026-09-14.csv",
      storageKey: "seed/shift-report-2026-09-14.csv",
      mimeType: "text/csv",
      fileExtension: ".csv",
      fileSizeBytes: 18_432,
      checksum: "3b1c1f7f0f7c9c9f2a2f9b1f2b9b3c9d4a3e2f1a0c9b8d7e6f5a4b3c2d1e0f9a",
    },
    {
      originalFileName: "sensor-readings-2026-09-15.json",
      storageKey: "seed/sensor-readings-2026-09-15.json",
      mimeType: "application/json",
      fileExtension: ".json",
      fileSizeBytes: 4_096,
      checksum: "9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b",
    },
  ];

  for (const upload of sampleUploads) {
    const { fileRecord } = await recordUpload({
      registeredDeviceId,
      deviceId,
      ...upload,
    });
    console.log(
      `Seeded upload record: ${fileRecord.originalFileName} (${fileRecord.fileSizeBytes} bytes)`
    );
  }
}

async function main() {
  const admin = await seedAdmin();
  await cleanPreviousSeedData();
  const { enabledDevice } = await seedDevicesAndRequests(admin.id);
  await seedUploads(enabledDevice.id, enabledDevice.deviceId);

  console.log("\nSeed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
