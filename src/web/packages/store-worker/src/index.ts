import type { Env } from "./env";
import { handlePublic } from "./routes/public";

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/api/health") {
      return Response.json({ ok: true });
    }
    const publicResponse = await handlePublic(request, env, url);
    if (publicResponse !== undefined) return publicResponse;
    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
