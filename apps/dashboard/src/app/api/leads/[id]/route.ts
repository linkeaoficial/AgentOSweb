import { forwardToWorker } from "@/lib/workerProxy";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const qs = new URL(req.url).searchParams.toString();
  return forwardToWorker(`/leads/${id}${qs ? `?${qs}` : ""}`);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return forwardToWorker(`/leads/${id}`, { method: "PATCH", body: await req.text() });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return forwardToWorker(`/leads/${id}`, { method: "DELETE" });
}