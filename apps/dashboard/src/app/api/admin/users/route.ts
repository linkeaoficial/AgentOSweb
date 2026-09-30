import { forwardToWorker } from "@/lib/workerProxy";

export async function GET() {
  return forwardToWorker("/admin/users");
}
