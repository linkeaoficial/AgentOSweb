import { forwardToWorker } from "@/lib/workerProxy";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const qs = new URL(req.url).search;
  return forwardToWorker(`/analytics/${encodeURIComponent(id)}${qs}`);
}
