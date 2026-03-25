import prisma from "./prisma";
import {
  signAccessToken,
  generateRefreshToken,
  hashToken,
  durationToMs,
  type JwtPayload,
} from "./auth-tokens";
import { securityConfig } from "@/config/security";

interface CreateSessionInput {
  subjectType: "staff" | "client";
  role: string;
  userId?: string;
  clientId?: string;
  accountingId: string;
  ipAddress?: string;
  userAgent?: string;
}

interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Create a new auth session in the database and return JWT + refresh token.
 */
export async function createAuthSession(input: CreateSessionInput): Promise<SessionTokens> {
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + durationToMs(securityConfig.refreshTtl));

  const session = await prisma.authSession.create({
    data: {
      subject_type: input.subjectType,
      role: input.role,
      user_id: input.userId,
      client_id: input.clientId,
      accounting_id: input.accountingId,
      refresh_token_hash: refreshTokenHash,
      expires_at: expiresAt,
      ip_address: input.ipAddress,
      user_agent: input.userAgent,
    },
  });

  const payload: JwtPayload = {
    sessionId: session.id,
    subjectType: input.subjectType,
    role: input.role,
    userId: input.userId,
    clientId: input.clientId,
    accountingId: input.accountingId,
  };

  const accessToken = signAccessToken(payload);
  return { accessToken, refreshToken };
}

/**
 * Rotate a refresh token: revoke the old session, create a new one.
 * Implements refresh token rotation for security.
 */
export async function rotateAuthSession(
  oldRefreshToken: string,
  ipAddress?: string,
  userAgent?: string
): Promise<SessionTokens | null> {
  const oldHash = hashToken(oldRefreshToken);

  const oldSession = await prisma.authSession.findUnique({
    where: { refresh_token_hash: oldHash },
  });

  if (!oldSession) return null;
  if (oldSession.revoked_at) return null;
  if (oldSession.expires_at < new Date()) return null;

  // Create new session
  const tokens = await createAuthSession({
    subjectType: oldSession.subject_type as "staff" | "client",
    role: oldSession.role,
    userId: oldSession.user_id ?? undefined,
    clientId: oldSession.client_id ?? undefined,
    accountingId: oldSession.accounting_id,
    ipAddress,
    userAgent,
  });

  // Revoke old session
  await prisma.authSession.update({
    where: { id: oldSession.id },
    data: {
      revoked_at: new Date(),
      replaced_by_session_id: oldSession.id,
    },
  });

  return tokens;
}

/**
 * Revoke a session by its refresh token.
 */
export async function revokeSession(refreshToken: string): Promise<void> {
  const hash = hashToken(refreshToken);
  await prisma.authSession.updateMany({
    where: { refresh_token_hash: hash, revoked_at: null },
    data: { revoked_at: new Date() },
  });
}

/**
 * Revoke all sessions for a user or client.
 */
export async function revokeAllSessions(
  subjectType: "staff" | "client",
  subjectId: string
): Promise<void> {
  const where =
    subjectType === "staff"
      ? { user_id: subjectId, revoked_at: null }
      : { client_id: subjectId, revoked_at: null };

  await prisma.authSession.updateMany({
    where,
    data: { revoked_at: new Date() },
  });
}
