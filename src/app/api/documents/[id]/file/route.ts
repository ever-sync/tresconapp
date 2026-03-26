import { readFile } from "fs/promises";
import { isAbsolute, resolve } from "path";
import { NextRequest } from "next/server";

import prisma from "@/lib/prisma";
import { authenticateClient, authenticateStaff, AuthError } from "@/lib/auth-guard";
import { error, handleError } from "@/lib/api-response";

async function resolveActor() {
  const staff = await authenticateStaff();
  if (staff) {
    return { audience: "staff" as const, auth: staff };
  }

  const client = await authenticateClient();
  if (client) {
    return { audience: "client" as const, auth: client };
  }

  throw new AuthError("Nao autenticado", 401);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await resolveActor();
    const { id } = await params;
    const download = request.nextUrl.searchParams.get("download") === "1";

    const document = await prisma.clientDocument.findFirst({
      where: {
        id,
        accounting_id: actor.auth.accountingId,
        deleted_at: null,
        ...(actor.audience === "client" && actor.auth.clientId
          ? { client_id: actor.auth.clientId }
          : {}),
      },
      select: {
        id: true,
        display_name: true,
        original_name: true,
        mime_type: true,
        size_bytes: true,
        storage_path: true,
        content: true,
      },
    });

    if (!document) {
      return error("Documento nao encontrado", 404);
    }

    let bytes = document.content ? Buffer.from(document.content) : null;

    if (!bytes && document.storage_path) {
      const filePath = isAbsolute(document.storage_path)
        ? document.storage_path
        : resolve(process.cwd(), document.storage_path);

      try {
        bytes = await readFile(filePath);
      } catch {
        return error("Arquivo nao encontrado", 404);
      }
    }

    if (!bytes) {
      return error("Arquivo indisponivel", 404);
    }

    const fileName = document.display_name || document.original_name || "documento";
    return new Response(bytes, {
      headers: {
        "Content-Type": document.mime_type || "application/octet-stream",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${fileName.replace(/"/g, '\\"')}"`,
        "Content-Length": String(bytes.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
