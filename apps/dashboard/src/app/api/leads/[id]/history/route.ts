import { forwardToWorker } from "@/lib/workerProxy";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = new URL(req.url).searchParams.get("session_id") || "";
  return forwardToWorker(`/leads/${id}/history?session_id=${encodeURIComponent(sessionId)}`);
}