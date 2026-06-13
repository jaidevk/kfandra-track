import { NextResponse, type NextRequest } from "next/server";

/**
 * Coarse gate for /admin/*: bounce anyone without a session cookie to login.
 * The fine-grained staff role check happens in src/app/admin/layout.tsx
 * (middleware can't read the DB to resolve a role).
 */
export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has("jacaranda_session");
  if (!hasSession) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*"] };
