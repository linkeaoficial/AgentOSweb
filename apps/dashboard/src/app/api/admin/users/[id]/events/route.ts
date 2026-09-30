import { forwardToWorker } from "@/lib/workerProxy";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // El id viene de la URL del panel (o sea del admin que esta mirando la
  // cuenta) y lo reenviamos como path, no en el body: si alguna vez metiera un
  // "/" podria cambiar el endpoint al que pegamos.
  return forwardToWorker(`/admin/users/${encodeURIComponent(id)}/events`);
}
