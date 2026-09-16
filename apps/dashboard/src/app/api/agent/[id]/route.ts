import { forwardToWorker } from "@/lib/workerProxy";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return forwardToWorker(`/agent/${id}/config`);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return forwardToWorker(`/agent/${id}`, { method: "PUT", body: await req.text() });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return forwardToWorker(`/agent/${id}`, { method: "DELETE" });
}