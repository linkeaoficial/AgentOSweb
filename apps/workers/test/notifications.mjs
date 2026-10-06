// Chequeo de la campanita del panel. Corre contra SQLite de verdad, sin framework:
//   node --experimental-sqlite test/notifications.mjs   (o `npm test` en apps/workers)
//
// Qué mira, qué se rompe de verdad: que la migración 0015 aplique sobre el schema
// real y haga su backfill (sin él la campanita se abriría con los 15 leads y los 5
// tickets que ya estaban en la base como si fueran notificaciones nuevas), que el
// SQL de los dos conteos sea EXACTAMENTE el del worker y derive lo esperado, que el
// cursor de lectura corte por fecha y no por hora en el vencimiento del plan, y que
// el proxy del panel apunte a las rutas que el worker realmente monta (si el panel
// pide `/notifications` y el worker monta `/api/notifications/read`, la campanita
// se queda muda y nadie se entera hasta que llegue un cliente).
//
// `--experimental-sqlite` es porque Node 22 todavía marca node:sqlite como
// experimental; en Node 24 el flag sobra (borrarlo, no el archivo).
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKERS = resolve(HERE, "..");
const REPO = resolve(WORKERS, "../..");
const read = (p) => readFileSync(p, "utf8");

const db = new DatabaseSync(":memory:");
db.exec(read(resolve(REPO, "database/schema.sql")));
db.exec(read(resolve(WORKERS, "migrations/0013_support_tickets.sql")));
db.exec(read(resolve(WORKERS, "migrations/0014_support_tickets_open_index.sql")));

let fails = 0;
const check = (name, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`);
  if (!cond) fails++;
};

// Fechas relativas al reloj de la máquina: si quedaran fijas a "hoy", una
// corrida justo antes de medianoche haría que "lo leído" y "lo nuevo" se
// crucen y el chequeo falle por reloj, no por el código.
const now = Date.now();
const stamp = (ms) => new Date(now + ms).toISOString().slice(0, 19).replace("T", " ");
const DAY = 86400000;
const OLD = stamp(-10 * DAY);
const FRESH = stamp(-60 * 1000);
const CURSOR = stamp(-5 * DAY);

// --- 0015: columna + backfill -------------------------------------------------
// Se inserta el usuario ANTES de la migración para que el backfill tenga algo
// que rellenar: es la mitad del chequeo.
db.prepare("INSERT INTO users (id, email, plan, plan_expires_at, downgraded_from) VALUES (?, ?, ?, ?, ?)").run(
  "u_admin",
  "admin@test.dev",
  "free",
  stamp(2 * DAY),
  "pro"
);
db.prepare("INSERT INTO users (id, email) VALUES (?, ?)").run("u_other", "otro@test.dev");

db.exec(read(resolve(WORKERS, "migrations/0015_users_notifications_read_at.sql")));

const hasCol = db
  .prepare("SELECT COUNT(*) c FROM pragma_table_info('users') WHERE name = 'notifications_read_at'")
  .get().c;
check("0015 agrega notifications_read_at", hasCol === 1);

const nulls = db.prepare("SELECT COUNT(*) c FROM users WHERE notifications_read_at IS NULL").get().c;
check("0015 rellena las filas existentes (backfill)", nulls === 0, `nulls=${nulls}`);

const backfill = db.prepare("SELECT notifications_read_at AS t FROM users WHERE id = 'u_admin'").get().t;
check("el backfill usa datetime('now') en UTC", /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(backfill), backfill);

// --- datos --------------------------------------------------------------------
db.prepare("INSERT INTO agents (id, user_id, name, system_prompt) VALUES (?, ?, ?, ?)").run("a1", "u_admin", "Agente A", "Eres un asistente");
db.prepare("INSERT INTO agents (id, user_id, name, system_prompt) VALUES (?, ?, ?, ?)").run("a2", "u_other", "Ajeno", "Eres un asistente");

const lead = (id, agent, at) =>
  db
    .prepare("INSERT INTO leads (id, agent_id, name, created_at) VALUES (?, ?, ?, ?)")
    .run(id, agent, id, at);

lead("l_old", "a1", OLD);
lead("l_fresh", "a1", FRESH);
lead("l_ajeno", "a2", FRESH);

// soporte NO lleva created_at a mano: el worker tampoco lo pone, y el DEFAULT de
// 0013 guarda ISO con 'T', 'Z' y milisegundos ('2026-10-06T13:44:01.123Z'), no el
// 'YYYY-MM-DD HH:MM:SS' del cursor. Se corrigen las fechas después del INSERT
// para no depender del reloj de la máquina que corre el test.
const iso = (ms) => new Date(now + ms).toISOString();
const ISO_OLD = iso(-10 * DAY);
const ISO_FRESH = iso(-60 * 1000);
const toSpace = (x) => x.replace("T", " ").slice(0, 19);

const ticket = (id, status) =>
  db
    .prepare(
      "INSERT INTO support_tickets (id, user_id, user_email, category, subject, message, status) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .run(id, "u_admin", "admin@test.dev", "otro", id, "x", status);

ticket("t_old", "abierto");
ticket("t_fresh", "abierto");
ticket("t_resuelto", "resuelto");
db.prepare("UPDATE support_tickets SET created_at = ? WHERE id = ?").run(ISO_OLD, "t_old");
db.prepare("UPDATE support_tickets SET created_at = ? WHERE id = ?").run(ISO_FRESH, "t_fresh");
db.prepare("UPDATE support_tickets SET created_at = ? WHERE id = ?").run(ISO_FRESH, "t_resuelto");

// --- el SQL es el del worker (esto es lo que evita que test y worker diverjan) -
const workerSrc = read(resolve(WORKERS, "src/index.ts"));
const supportSql =
  "SELECT COUNT(*) AS n, MAX(datetime(created_at)) AS at FROM support_tickets WHERE status IN ('abierto', 'en_curso') AND datetime(created_at) > datetime(?)";
const leadsSql =
  "SELECT COUNT(*) AS n, MAX(created_at) AS at FROM leads WHERE created_at > ? AND agent_id IN (SELECT id FROM agents WHERE user_id = ?)";
check("el SQL de soporte es el del worker", workerSrc.includes(supportSql));
check("el SQL de leads es el del worker", workerSrc.includes(leadsSql));

const handle = workerSrc.match(/async function handleNotifications\([\s\S]*?\n\}/)?.[0] ?? "";
check("la campanita existe en el worker", handle.length > 0);
check("el soporte solo sale para admin", handle.includes('user.role === "admin"'));
check("el vencimiento se compara por fecha, no por hora", handle.includes("readDate"));

// --- qué se ve con el cursor en medio ----------------------------------------
db.prepare("UPDATE users SET notifications_read_at = ? WHERE id = ?").run(CURSOR, "u_admin");
const unread = (sql, ...args) => db.prepare(sql).get(...args);

const s = unread(supportSql, CURSOR);
check("soporte: solo los tickets abiertos nuevos (ISO -> espacio)", s.n === 1 && s.at === toSpace(ISO_FRESH), `n=${s.n}`);

const l = unread(leadsSql, CURSOR, "u_admin");
check("prospectos: solo los nuevos del dueño", l.n === 1 && l.at === FRESH, `n=${l.n}`);
check("prospectos: no arrastra leads de otro usuario", l.n !== 2);

const sTodo = unread(supportSql, "1970-01-01 00:00:00");
check("con cursor vacio se ven los abiertos viejos", sTodo.n === 2, `n=${sTodo.n}`);
const lTodo = unread(leadsSql, "1970-01-01 00:00:00", "u_admin");
check("con cursor vacio se ven los leads viejos, jamas los ajenos", lTodo.n === 2, `n=${lTodo.n}`);

// --- vencimiento del plan ------------------------------------------------------
// Misma expresión que corre el worker: fecha contra la FECHA del cursor.
const planVisible = (row, readAt) =>
  !!(row.downgraded_from && row.plan_expires_at && row.plan_expires_at > readAt.slice(0, 10));
const u = db.prepare("SELECT downgraded_from, plan_expires_at FROM users WHERE id = ?").get("u_admin");

check("plan: vence mañana y aun no se leyó -> se ve", planVisible({ ...u, plan_expires_at: stamp(2 * DAY) }, CURSOR));
check(
  "plan: venció antes del backfill -> no se ve",
  !planVisible({ ...u, plan_expires_at: stamp(-2 * DAY) }, stamp(-1 * DAY))
);
check("plan: vence hoy y ya se leyó hoy -> se borra", !planVisible({ ...u, plan_expires_at: stamp(0).slice(0, 10) }, stamp(60000)));
check("plan: sin downgrade no hay item", !planVisible({ downgraded_from: null, plan_expires_at: stamp(DAY) }, CURSOR));

// --- marcar como leído ---------------------------------------------------------
db.prepare("UPDATE users SET notifications_read_at = datetime('now') WHERE id = ?").run("u_admin");
const readAt = db.prepare("SELECT notifications_read_at AS t FROM users WHERE id = ?").get("u_admin").t;
check("leer escribe el mismo formato que created_at", /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(readAt), readAt);
check("leer vacía el soporte", unread(supportSql, readAt).n === 0);
check("leer vacía los prospectos", unread(leadsSql, readAt, "u_admin").n === 0);

// --- el panel apunta a las rutas que el worker monta ---------------------------
const proxySrc = read(resolve(REPO, "apps/dashboard/src/app/api/notifications/route.ts"));
check("el proxy pide /notifications", proxySrc.includes('forwardToWorker("/notifications")'));
check("el proxy pide /notifications/read", proxySrc.includes('forwardToWorker("/notifications/read"'));
check(
  "el worker monta /api/notifications",
  workerSrc.includes('url.pathname === "/api/notifications" && request.method === "GET"')
);
check(
  "el worker monta /api/notifications/read",
  workerSrc.includes('url.pathname === "/api/notifications/read" && request.method === "POST"')
);
check(
  "leer solo usa el user_id de la sesión (nada del body)",
  /UPDATE users SET notifications_read_at = datetime\('now'\) WHERE id = \?/.test(workerSrc) &&
    !/notifications_read_at\s*=\s*\?/.test(workerSrc)
);

// La campanita vive en su propio componente (se monta dos veces: topbar y
// barra lateral), por eso el chequeo de la UI lee NotificationsBell.tsx.
const bellSrc = read(resolve(REPO, "apps/dashboard/src/components/dashboard/NotificationsBell.tsx"));
const sidebarSrc = read(resolve(REPO, "apps/dashboard/src/components/dashboard/Sidebar.tsx"));
check("la campanita sondea cada 60 s y solo con la pestaña visible", bellSrc.includes("POLL_MS = 60000") && bellSrc.includes('document.visibilityState !== "visible"'));
check("abrir la campanita marca como leído", bellSrc.includes('fetch("/api/notifications", { method: "POST" })'));
check("el contador no se pinta en cero", bellSrc.includes("{unread > 0 && <span className=\"notif-badge\">"));
check("la campanita también está en la barra lateral (móvil)", sidebarSrc.includes("<NotificationsBell"));

console.log(fails === 0 ? "\nTODO OK" : `\n${fails} FALLOS`);
process.exit(fails === 0 ? 0 : 1);
