import { forwardToWorker } from "@/lib/workerProxy";

export async function GET(req: Request) {
  const qs = new URL(req.url).searchParams.toString();
  return forwardToWorker(`/admin/support${qs ? `?${qs}` : ""}`);
}

export async function PATCH(req: Request) {
  return forwardToWorker("/admin/support", { method: "PATCH", body: await req.text() });
}