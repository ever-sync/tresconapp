import prisma from "@/lib/prisma";
import { requireStaff } from "@/lib/auth-guard";
import { success, error, handleError } from "@/lib/api-response";

export async function GET() {
  try {
    const payload = await requireStaff();

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { accounting: true },
    });

    if (!user) {
      return error("Usuário não encontrado", 404);
    }

    return success({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        avatar_url: user.avatar_url,
        mfa_enabled: user.mfa_enabled,
        accounting_id: user.accounting_id,
      },
      accounting: {
        id: user.accounting.id,
        name: user.accounting.name,
        cnpj: user.accounting.cnpj,
        plan: user.accounting.plan,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
