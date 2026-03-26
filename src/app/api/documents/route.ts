import prisma from "@/lib/prisma";
import { requireStaff } from "@/lib/auth-guard";
import { success, handleError } from "@/lib/api-response";

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
}

export async function GET() {
  try {
    const auth = await requireStaff();

    const clients = await prisma.client.findMany({
      where: {
        accounting_id: auth.accountingId,
        deleted_at: null,
      },
      orderBy: { name: "asc" },
      include: {
        documents: {
          where: { deleted_at: null },
          orderBy: { created_at: "desc" },
        },
      },
    });

    return success({
      clients: clients.map((client) => ({
        id: client.id,
        name: client.name,
        cnpj: client.cnpj,
        industry: client.industry ?? "Sem categoria",
        documents: client.documents.map((document) => ({
          id: document.id,
          title: document.display_name,
          category: document.category,
          description:
            document.description ??
            document.original_name ??
            document.display_name,
          sentAt: document.created_at.toISOString(),
          size: formatSize(document.size_bytes),
          mimeType: document.mime_type,
          viewed: Boolean(document.viewed_at),
        })),
      })),
    });
  } catch (err) {
    return handleError(err);
  }
}
