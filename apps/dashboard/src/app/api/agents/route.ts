import { forwardToWorker } from "@/lib/workerProxy";

export async function GET() {
  return forwardToWorker("/agents");
}

export async function POST(req: Request) {
  return forwardToWorker("/agents", { method: "POST", body: await req.text() });
}