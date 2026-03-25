import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "./auth-guard";

/**
 * Standard success response.
 */
export function success<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

/**
 * Standard error response.
 */
export function error(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Handle errors from route handlers uniformly.
 */
export function handleError(err: unknown) {
  if (err instanceof AuthError) {
    return error(err.message, err.statusCode);
  }

  if (err instanceof ZodError) {
    const messages = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`);
    return error(messages.join("; "), 400);
  }

  console.error("[api-error]", err);
  return error("Erro interno do servidor", 500);
}

/**
 * Get client IP from request headers.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

/**
 * Get user agent from request headers.
 */
export function getUserAgent(request: Request): string {
  return request.headers.get("user-agent") || "unknown";
}
