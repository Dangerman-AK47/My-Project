import { NextResponse } from "next/server";
import { getAuthorizedAdmin } from "@/lib/auth/guard";
import { listDevices } from "@/lib/services/device-queries";
import type {
  DeviceListQuery,
  DeviceListResponse,
  DeviceSortField,
  DeviceStatusFilter,
  SortDirection,
} from "@/lib/admin/devices-types";

const VALID_SORT_FIELDS: DeviceSortField[] = ["registeredAt", "uploadCount", "lastActivity"];
const VALID_STATUSES: DeviceStatusFilter[] = ["ALL", "ACTIVE", "DEACTIVE"];

export async function GET(request: Request): Promise<NextResponse<DeviceListResponse | { error: string }>> {
  const admin = await getAuthorizedAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const statusParam = params.get("status");
  const sortByParam = params.get("sortBy");
  const sortDirParam = params.get("sortDir");
  const pageParam = Number(params.get("page"));
  const pageSizeParam = Number(params.get("pageSize"));

  const query: DeviceListQuery = {
    query: params.get("q") ?? undefined,
    status: VALID_STATUSES.includes(statusParam as DeviceStatusFilter)
      ? (statusParam as DeviceStatusFilter)
      : "ALL",
    sortBy: VALID_SORT_FIELDS.includes(sortByParam as DeviceSortField)
      ? (sortByParam as DeviceSortField)
      : "registeredAt",
    sortDir: (sortDirParam === "asc" ? "asc" : "desc") as SortDirection,
    page: Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1,
    pageSize: Number.isFinite(pageSizeParam) && pageSizeParam > 0 ? pageSizeParam : 10,
  };

  try {
    const result = await listDevices(query);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Failed to list sensors:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
