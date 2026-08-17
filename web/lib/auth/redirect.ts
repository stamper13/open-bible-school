export function authCallbackUrl(params?: URLSearchParams | Record<string, string | null | undefined>) {
  const origin = typeof window === "undefined"
    ? "http://localhost:3000"
    : window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? `${window.location.protocol}//${window.location.host}`
      : window.location.origin;
  const url = new URL("/auth/callback", origin);

  if (params instanceof URLSearchParams) {
    params.forEach((value, key) => url.searchParams.set(key, value));
  } else if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });
  }

  return url.toString();
}
