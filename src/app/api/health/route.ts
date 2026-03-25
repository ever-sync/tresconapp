import { success, error } from "@/lib/api-response";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    return success({ status: "ok", database: "connected" });
  } catch {
    return error("Database unreachable", 503);
  }
}
