import { forwardToWorker } from "@/lib/workerProxy";

export async function PUT(req: Request) {
  return forwardToWorker("/user", { method: "PUT", body: await req.text() });
}