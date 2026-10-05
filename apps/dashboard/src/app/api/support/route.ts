import { forwardToWorker } from "@/lib/workerProxy";

export async function POST(req: Request) {
  return forwardToWorker("/support", { method: "POST", body: await req.text() });
}