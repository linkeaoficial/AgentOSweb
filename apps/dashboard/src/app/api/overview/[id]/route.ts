import { forwardToWorker } from "@/lib/workerProxy";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return forwardToWorker(`/overview/${id}`);
}