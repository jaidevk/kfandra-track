import LoginForm from "./login-form";

/**
 * Login / self-register entry point. No approval gate — registering signs you
 * straight in (internal-only club app). The `next` query param (set by the
 * auth middleware) is where we send the player after a successful sign-in.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  // Only honour same-origin relative paths to avoid open-redirects.
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return <LoginForm next={safeNext} />;
}
