import { getStaffRefreshToken, clearStaffCookies } from "@/lib/auth-cookies";
import { revokeSession } from "@/lib/auth-sessions";
import { success, handleError } from "@/lib/api-response";

export async function POST() {
  try {
    const refreshToken = await getStaffRefreshToken();

    if (refreshToken) {
      await revokeSession(refreshToken);
    }

    await clearStaffCookies();

    return success({ message: "Logout realizado" });
  } catch (err) {
    return handleError(err);
  }
}
