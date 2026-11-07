import { llmsText } from "@/lib/llms";

// Instructions for the Claude app: paste this address into a chat and Claude
// helps fill a housing form the way the website does. Also served at /llm.txt.
export async function GET(request: Request) {
  return new Response(llmsText(new URL(request.url).origin), {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
