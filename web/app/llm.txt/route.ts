import { llmsText } from "@/lib/llms";

// Same as /llms.txt, for the spelling without the "s".
export async function GET(request: Request) {
  return new Response(llmsText(new URL(request.url).origin), {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
