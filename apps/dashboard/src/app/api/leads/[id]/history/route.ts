import { forwardToWorker } from "@/lib/workerProxy";

const historyUrl = (req: Request, id: string) => {
  const sessionId = new URL(req.url).searchParams.get("session_id") || "";
  return `/leads/${id}/history?session_id=${encodeURIComponent(sessionId)}`;
};

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return forwardToWorker(historyUrl(req, id));
}

// Borra la conversacion y sus mensajes. Es la unica via de borrado: el worker
// valida que quien llama sea el dueno del agente antes de tocar nada.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return forwardToWorker(historyUrl(req, id), { method: "DELETE" });
}
