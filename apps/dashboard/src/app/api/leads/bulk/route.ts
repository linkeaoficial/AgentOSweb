import { forwardToWorker } from "@/lib/workerProxy";

export async function POST(req: Request) {
  return forwardToWorker("/leads/bulk", { method: "POST", body: await req.text() });
}