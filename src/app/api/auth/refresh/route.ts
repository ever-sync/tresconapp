import { NextRequest } from "next/server";
import { getStaffRefreshToken, setStaffCookies } from "@/lib/auth-cookies";
import { rotateAuthSession } from "@/lib/auth-sessions";
import { success, error, handleError, getClientIp, getUserAgent } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  try {
    // Try cookie first, then body (for mobile)
    let refreshToken = await getStaffRefreshToken();

    if (!refreshToken) {
      const body = await request.json().catch(() => ({}));
      refreshToken = body.refreshToken;
    }

    if (!refreshToken) {
      return error("Refresh token não encontrado", 401);
    }

    const ip = getClientIp(request);
    const ua = getUserAgent(request);

    const tokens = await rotateAuthSession(refreshToken, ip, ua);
    if (!tokens) {
      return error("Sessão inválida ou expirada", 401);
    }

    await setStaffCookies(tokens.accessToken, tokens.refreshToken);

    return success({
      accessToken: tokens.accessToken,
    });
  } catch (err) {
    return handleError(err);
  }
}
