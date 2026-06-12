// app/admin/api/research-smart/route.ts
//
// Streams the Smart Research pipeline to the admin panel as Server-Sent Events
// so the UI shows *real* stage progress (SerpAPI → Perplexity → Gemini) instead
// of timer-faked steps. Events emitted (one JSON object per `data:` line):
//   { type: "progress", step, status, detail? }
//   { type: "result", result, cached, cached_at? }
//   { type: "error", error }
import { getAdminContext } from "@/lib/admin/isAdmin";
import { isGeminiConfigured } from "@/lib/admin/research/gemini-provider";
import { runSmartResearchPipeline } from "@/lib/admin/research/smart-pipeline";
import { getCachedSmartResearch, setCachedSmartResearch } from "@/lib/admin/research/smartResearchCache";

function sseError(message: string, status: number): Response {
  // Plain JSON for setup/auth failures so the client can surface them before the
  // stream begins. The client treats a non-event-stream response as a hard error.
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return sseError("Forbidden", 403);
  }

  const body = (await request.json().catch(() => ({}))) as { query?: unknown; refresh?: unknown; hint_url?: unknown };
  const query = typeof body?.query === "string" ? body.query.trim() : "";
  const refresh = body?.refresh === true;
  const hintUrl = typeof body?.hint_url === "string" ? body.hint_url.trim() : undefined;

  if (!query) return sseError("query is required", 400);
  if (!process.env.SERPAPI_KEY?.trim()) return sseError("SERPAPI_KEY is not configured", 503);
  if (!isGeminiConfigured()) return sseError("GEMINI_API_KEY is not configured", 503);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      try {
        // Serve from cache unless the admin explicitly asked to refresh.
        if (!refresh) {
          const cached = await getCachedSmartResearch(query);
          if (cached) {
            send({ type: "result", result: cached.result, cached: true, cached_at: cached.cachedAt });
            controller.close();
            return;
          }
        }

        const result = await runSmartResearchPipeline(query, (step, status, detail) => {
          send({ type: "progress", step, status, detail });
        }, hintUrl);

        void setCachedSmartResearch(query, result);
        send({ type: "result", result, cached: false });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Smart research failed";
        send({ type: "error", error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disable proxy buffering (nginx/Vercel) so events flush immediately.
      "X-Accel-Buffering": "no",
    },
  });
}
