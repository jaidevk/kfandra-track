import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

/**
 * Route protection. Unauthenticated requests to app routes are redirected to
 * /login (carrying ?next=). Authenticated requests to /login are bounced home.
 * Session verification uses jose, which runs in the edge runtime.
 *
 * /mockups/* stays public so design references remain viewable during V1.
 */

const PUBLIC_PREFIXES = ["/login", "/mockups"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);

  if (isPublic(pathname)) {
    // Already signed in? Skip the login screen.
    if (pathname === "/login" && session) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals, static files, and the PWA assets.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.json|sw.js|workbox-|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)",
  ],
};
