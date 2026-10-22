import type { Env } from "./env";

export default {
  async fetch(request: Request, _env: Env, _ctx: ExecutionContext) {
    const { pathname } = new URL(request.url);
    if (request.method === "GET" && pathname === "/api/health") {
      return Response.json({ ok: true });
    }
    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
