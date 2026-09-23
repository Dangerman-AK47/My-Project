import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthorizedAdmin } from "@/lib/auth/guard";

export const runtime = "nodejs";

const RESULT_KEYS = [
  "CURRENT",
  "UPDATE_AVAILABLE",
  "SENSOR_DEACTIVATED",
  "NO_CONFIGURATION_AVAILABLE",
  "INVALID_VERSION",
  "SENSOR_NOT_REGISTERED",
] as const;

export async function GET(request: Request) {
  const admin = await getAuthorizedAdmin();
  if (!admin) {
    return NextResponse.json({ status: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  // Default: last 7 days
  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 6);
  defaultFrom.setUTCHours(0, 0, 0, 0);

  const defaultTo = new Date(now);
  defaultTo.setUTCHours(23, 59, 59, 999);

  let fromDate = defaultFrom;
  let toDate = defaultTo;

  if (fromParam) {
    const parsed = new Date(fromParam);
    if (!isNaN(parsed.getTime())) {
      fromDate = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate(), 0, 0, 0, 0));
    }
  }

  if (toParam) {
    const parsed = new Date(toParam);
    if (!isNaN(parsed.getTime())) {
      toDate = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate(), 23, 59, 59, 999));
    }
  }

  const events = await prisma.sensorVersionCheckEvent.findMany({
    where: {
      createdAt: {
        gte: fromDate,
        lte: toDate,
      },
    },
    include: {
      registeredDevice: {
        select: {
          status: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Group by date (YYYY-MM-DD)
  const dateMap = new Map<
    string,
    {
      activeSensorIds: Set<string>;
      deactiveSensorIds: Set<string>;
      allSensorIds: Set<string>;
      resultBreakdown: Record<string, number>;
    }
  >();

  for (const event of events) {
    const dateStr = event.createdAt.toISOString().slice(0, 10);
    if (!dateMap.has(dateStr)) {
      const initialBreakdown: Record<string, number> = {};
      for (const k of RESULT_KEYS) initialBreakdown[k] = 0;

      dateMap.set(dateStr, {
        activeSensorIds: new Set(),
        deactiveSensorIds: new Set(),
        allSensorIds: new Set(),
        resultBreakdown: initialBreakdown,
      });
    }

    const bucket = dateMap.get(dateStr)!;
    bucket.allSensorIds.add(event.deviceId);

    const status = event.registeredDevice?.status;
    if (status === "ACTIVE") {
      bucket.activeSensorIds.add(event.deviceId);
    } else if (status === "DEACTIVE") {
      bucket.deactiveSensorIds.add(event.deviceId);
    }

    bucket.resultBreakdown[event.result] =
      (bucket.resultBreakdown[event.result] ?? 0) + 1;
  }

  const dailySummary = Array.from(dateMap.entries())
    .map(([date, data]) => ({
      date,
      activeSensors: data.activeSensorIds.size,
      deactiveSensors: data.deactiveSensorIds.size,
      uniqueSensors: data.allSensorIds.size,
      resultBreakdown: data.resultBreakdown,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  return NextResponse.json({
    dateRange: {
      from: fromDate.toISOString().slice(0, 10),
      to: toDate.toISOString().slice(0, 10),
    },
    dailySummary,
  });
}
