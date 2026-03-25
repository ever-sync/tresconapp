import { NextRequest } from "next/server";
import { getClientRefreshToken, setClientCookies } from "@/lib/auth-cookies";
import { rotateAuthSession } from "@/lib/auth-sessions";
import { success, error, handleError, getClientIp, getUserAgent } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  try {
    let refreshToken = await getClientRefreshToken();

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

    await setClientCookies(tokens.accessToken, tokens.refreshToken);

    return success({
      accessToken: tokens.accessToken,
    });
  } catch (err) {
    return handleError(err);
  }
}
