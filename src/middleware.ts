import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that require staff authentication
const staffRoutes = ["/dashboard", "/clients"];
// Routes that require client authentication
const clientRoutes = ["/portal"];
// Public-only routes (redirect if already authenticated)
const publicOnlyRoutes = ["/login", "/register"];
const publicClientOnlyRoutes = ["/client-login"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const staffToken = request.cookies.get("tc_staff_at")?.value;
  const clientToken = request.cookies.get("tc_client_at")?.value;

  // Staff-protected routes
  if (staffRoutes.some((route) => pathname.startsWith(route))) {
    if (!staffToken) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // Client-protected routes
  if (clientRoutes.some((route) => pathname.startsWith(route))) {
    if (!clientToken) {
      return NextResponse.redirect(new URL("/client-login", request.url));
    }
  }

  // Redirect authenticated staff away from public pages
  if (publicOnlyRoutes.some((route) => pathname.startsWith(route))) {
    if (staffToken) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  // Redirect authenticated clients away from client public pages
  if (publicClientOnlyRoutes.some((route) => pathname.startsWith(route))) {
    if (clientToken) {
      return NextResponse.redirect(new URL("/portal", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/clients/:path*",
    "/portal/:path*",
    "/login",
    "/register",
    "/client-login",
  ],
};
