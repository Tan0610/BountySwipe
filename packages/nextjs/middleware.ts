import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware placeholder.
 * x402 micropayment gating is disabled for the hackathon demo.
 * To enable, install @x402/next, @x402/core, @x402/evm packages
 * and restore the payment proxy middleware.
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set("x-middleware-path", request.nextUrl.pathname);
  return response;
}

export const config = {
  matcher: "/api/premium/:path*",
};
