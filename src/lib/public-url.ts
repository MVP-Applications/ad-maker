/**
 * A logo uploaded in development is served by the dev server itself, so its
 * URL is exactly what this function exists to refuse: `localhost` on a
 * non-standard port. The exception is narrow on purpose — only the dev
 * server's own origin, only under `next dev`, and only for the `/uploads/`
 * path that POST /api/logo writes to. In production this is unreachable and
 * the rule below is the whole rule.
 */
function isDevUpload(url: URL): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return (
    (host === "localhost" || host === "127.0.0.1" || host === "::1") &&
    url.pathname.startsWith("/uploads/")
  );
}

/** Parse a syntactically safe public HTTP(S) URL; DNS policy is applied separately. */
export function parsePublicHttpUrl(raw: string | URL): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;

  if (isDevUpload(url)) {
    url.hash = "";
    return url;
  }

  if (url.port && url.port !== (url.protocol === "http:" ? "80" : "443")) return null;

  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (
    !hostname ||
    /^\d+(?:\.\d+){3}$/.test(hostname) ||
    hostname.includes(":") ||
    /^(?:localhost|.*\.(?:localhost|local|internal))$/i.test(hostname)
  ) {
    return null;
  }

  url.hash = "";
  return url;
}
