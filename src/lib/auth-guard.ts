import { headers } from "next/headers";
import { getStaffAccessToken, getClientAccessToken } from "./auth-cookies";
import { verifyAccessToken, type JwtPayload } from "./auth-tokens";

/**
 * Authenticate a staff request.
 * Checks httpOnly cookie first, then Authorization header (for mobile).
 * Returns the JWT payload or null if not authenticated.
 */
export async function authenticateStaff(): Promise<JwtPayload | null> {
  // 1. Try cookie (web + desktop)
  let token = await getStaffAccessToken();

  // 2. Fallback to Authorization header (mobile)
  if (!token) {
    const headersList = await headers();
    const authHeader = headersList.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    }
  }

  if (!token) return null;

  const payload = verifyAccessToken(token);
  if (!payload) return null;
  if (payload.subjectType !== "staff") return null;

  return payload;
}

/**
 * Authenticate a client request.
 * Checks httpOnly cookie first, then Authorization header (for mobile).
 */
export async function authenticateClient(): Promise<JwtPayload | null> {
  // 1. Try cookie (web + desktop)
  let token = await getClientAccessToken();

  // 2. Fallback to Authorization header (mobile)
  if (!token) {
    const headersList = await headers();
    const authHeader = headersList.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    }
  }

  if (!token) return null;

  const payload = verifyAccessToken(token);
  if (!payload) return null;
  if (payload.subjectType !== "client") return null;

  return payload;
}

/**
 * Require staff authentication. Throws if not authenticated.
 */
export async function requireStaff(): Promise<JwtPayload> {
  const payload = await authenticateStaff();
  if (!payload) {
    throw new AuthError("Não autenticado", 401);
  }
  return payload;
}

/**
 * Require staff with specific role.
 */
export async function requireRole(...roles: string[]): Promise<JwtPayload> {
  const payload = await requireStaff();
  if (!roles.includes(payload.role)) {
    throw new AuthError("Permissão insuficiente", 403);
  }
  return payload;
}

/**
 * Require client authentication. Throws if not authenticated.
 */
export async function requireClient(): Promise<JwtPayload> {
  const payload = await authenticateClient();
  if (!payload) {
    throw new AuthError("Não autenticado", 401);
  }
  return payload;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "AuthError";
  }
}
