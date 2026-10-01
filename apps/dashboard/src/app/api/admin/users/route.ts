import { forwardToWorker } from "@/lib/workerProxy";

// La query string se reenvía entera: sin esto el worker recibe el pedido SIN
// page/page_size/plan/expiring/counts, así que paginaba y filtraba en el
// navegador, las píldoras de plan salían en 0 y el filtro de plan no hacía nada.
// Es el mismo patrón que /api/leads/[id].
export async function GET(req: Request) {
  const qs = new URL(req.url).searchParams.toString();
  return forwardToWorker(`/admin/users${qs ? `?${qs}` : ""}`);
}
