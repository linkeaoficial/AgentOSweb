import { forwardToWorker } from "@/lib/workerProxy";

// El cliente cierra el aviso de renovacion de SU cuenta. El worker usa el
// user_id de la sesion y descarta cualquier id del body, asi que aca no hay
// nada que validar.
export async function POST() {
  return forwardToWorker("/user/notice", { method: "POST" });
}
