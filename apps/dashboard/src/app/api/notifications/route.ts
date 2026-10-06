import { forwardToWorker } from "@/lib/workerProxy";

// Campanita del panel. El worker resuelve el dueño desde la sesión de la cookie
// y solo devuelve lo que esa cuenta todavía no leyó: acá no hay nada que
// validar ni ids que aceptar del navegador.
export async function GET() {
  return forwardToWorker("/notifications");
}

// Abrir la campanita. La escritura es siempre sobre `user_id` de la sesión.
export async function POST() {
  return forwardToWorker("/notifications/read", { method: "POST" });
}
