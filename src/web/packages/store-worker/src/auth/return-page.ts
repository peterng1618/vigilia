const LOOPBACK_ORIGIN = /^http:\/\/(?:127\.0\.0\.1|localhost):(\d{1,5})$/;

/** The host may only return to a loopback origin on a numeric port. */
export function isLoopbackOrigin(value: string): boolean {
  const port = LOOPBACK_ORIGIN.exec(value)?.[1];
  if (port === undefined) return false;
  const number = Number(port);
  return number > 0 && number <= 65_535;
}

// The token is exchanged here, in the page, because it must never be written
// into the HTML the provider redirects to.
const RETURN_HTML = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>Yunari sign-in</title>
<p>Finishing sign-in…</p>
<script>
(async () => {
  const params = new URLSearchParams(location.search);
  const answer = await fetch("/api/auth/one-time-token/generate", {
    credentials: "include",
  });
  if (!answer.ok) {
    document.body.textContent = "Sign-in failed.";
    return;
  }
  const { token } = await answer.json();
  const target = new URL(params.get("host") ?? "");
  target.searchParams.set("token", token);
  target.searchParams.set("state", params.get("state") ?? "");
  location.replace(target.toString());
})();
</script>
</html>`;

export function returnPage(): Response {
  return new Response(RETURN_HTML, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
