import { getClientRefreshToken, clearClientCookies } from "@/lib/auth-cookies";
import { revokeSession } from "@/lib/auth-sessions";
import { success, handleError } from "@/lib/api-response";

export async function POST() {
  try {
    const refreshToken = await getClientRefreshToken();

    if (refreshToken) {
      await revokeSession(refreshToken);
    }

    await clearClientCookies();

    return success({ message: "Logout realizado" });
  } catch (err) {
    return handleError(err);
  }
}
