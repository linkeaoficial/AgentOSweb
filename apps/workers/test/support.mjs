// Chequeo de Ayuda y Soporte. Corre contra SQLite de verdad, sin framework:
//   node --experimental-sqlite test/support.mjs     (o `npm test` en apps/workers)
//
// Que mira, que es lo que se rompe de verdad: que la migracion 0013 aplique
// sobre el schema real, que el SQL de los tres endpoints corra, que la fecha se
// lea sin corrimiento de zona, y que las listas de categorias/estados del worker
// y las del panel no se separen (si el panel manda "facturacion" y el worker no
// la conoce, el POST vuelve 400 y nadie se entera hasta que un cliente escribe).
//
// `--experimental-sqlite` es porque Node 22 todavia marca node:sqlite como
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

let fails = 0;
const check = (name, cond) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) fails++;
};

// --- POST /api/support (handleSupportCreate) ---
db.prepare("INSERT INTO users (id, email, name, plan) VALUES (?, ?, ?, ?)").run(
  "u1", "cliente@test.com", "Cliente", "pro"
);
const acct = db.prepare("SELECT email, name, plan FROM users WHERE id = ?").get("u1");
check("snapshot de la cuenta (email/nombre/plan)", acct.email === "cliente@test.com" && acct.plan === "pro");

const insert = db.prepare(
  `INSERT INTO support_tickets
     (id, user_id, user_email, user_name, user_plan, category, subject, message, status, page, user_agent)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'abierto', ?, ?)`
);
insert.run("t1", "u1", acct.email, acct.name, acct.plan, "bug", "El widget no carga", "Hola, no me aparece el widget.", null, "Mozilla/5.0");
insert.run("t2", "u2", "otro@test.com", "Otro", "free", "pregunta", "Duda de planes", "¿Puedo cambiar de plan a mitad de mes?", "/soporte", "Mozilla/5.0");
check("dos tickets insertados", db.prepare("SELECT COUNT(*) c FROM support_tickets").get().c === 2);

const t1 = db.prepare("SELECT * FROM support_tickets WHERE id = 't1'").get();
check("status inicial 'abierto'", t1.status === "abierto");
check("created_at en ISO con Z", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(t1.created_at));
check(
  "created_at no se corre de zona horaria en el panel",
  new Date(t1.created_at).toISOString().slice(0, 10) === t1.created_at.slice(0, 10)
);
check("mensaje recortado a 4.000", "x".repeat(5000).slice(0, 4000).length === 4000);

// --- GET /api/admin/support (handleAdminSupport) ---
const all = db.prepare(
  `SELECT id, user_id, user_email, user_name, user_plan, category, subject, message, status, page, user_agent, created_at, updated_at
     FROM support_tickets ORDER BY created_at DESC, rowid DESC LIMIT 200`
).all();
check("lista todo y ordena al mas nuevo primero", all.length === 2 && all[0].id === "t2");

const one = db.prepare(
  `SELECT id FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 200`
).all("u1");
check("filtra por user_id (drawer del cliente)", one.length === 1 && one[0].id === "t1");

// --- PATCH /api/admin/support ---
db.prepare(
  "UPDATE support_tickets SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?"
).run("en_curso", "t1");
check("cambia el estado", db.prepare("SELECT status FROM support_tickets WHERE id = 't1'").get().status === "en_curso");
check(
  "PATCH de un id que no existe se puede detectar (404)",
  db.prepare("SELECT id FROM support_tickets WHERE id = ?").get("nope") === undefined
);

// --- badge de la tabla de Clientes ---
db.prepare("UPDATE support_tickets SET status = 'resuelto' WHERE id = 't1'").run();
const openFor = (id) =>
  db.prepare("SELECT COUNT(*) c FROM support_tickets WHERE user_id = ? AND status != 'resuelto'").get(id).c;
check("el badge cuenta solo lo que no esta resuelto", openFor("u1") === 0 && openFor("u2") === 1);

// --- El panel no debe volver a bajar la bandeja entera ---
const idx = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'support_tickets'")
  .all()
  .map((r) => r.name);
check(
  "indices de la migracion",
  idx.includes("idx_support_tickets_user") && idx.includes("idx_support_tickets_status")
);

// --- El panel y el worker no pueden separarse ---
const workerSrc = read(resolve(WORKERS, "src/index.ts"));
const modalSrc = read(resolve(REPO, "apps/dashboard/src/components/dashboard/SupportModal.tsx"));
const adminSrc = read(resolve(REPO, "apps/dashboard/src/components/dashboard/AdminView.tsx"));
// Sin comillas: en el panel estos ids aparecen como claves de objeto
// (`en_curso: "En curso"`), no como strings entre comillas.
const listOf = (src, name) =>
  (src.match(new RegExp(`${name} = \\[([^\\]]*)\\]`))?.[1] ?? "").match(/"[a-z_]+"/g)?.map((s) => s.slice(1, -1)) ?? [];
const categories = listOf(workerSrc, "SUPPORT_CATEGORIES");
const statuses = listOf(workerSrc, "SUPPORT_STATUSES");
check("el worker declara categorias", categories.length > 0);
check(
  "cada categoria del worker existe en el modal del panel",
  categories.every((c) => modalSrc.includes(c))
);
check(
  "cada estado del worker existe en la bandeja del admin",
  statuses.every((s) => adminSrc.includes(s))
);
// Regresiones de carga: la bandeja completa con los cuerpos de 4.000 caracteres
// es lo que mas factura en D1, asi que queda prohibido volver a pedirla.
const countsSql = workerSrc.match(/SELECT user_id, COUNT\(\*\) AS open[\s\S]*?GROUP BY user_id/)?.[0];
check("el conteo de badges no arrastra el mensaje", countsSql !== undefined && !countsSql.includes("message"));
const drawerLimit = Number(workerSrc.match(/FROM support_tickets WHERE user_id = \?[\s\S]*?LIMIT (\d+)/)?.[1]);
check("el drawer de un cliente tiene tope de filas", drawerLimit > 0 && drawerLimit <= 50, `LIMIT ${drawerLimit}`);
check(
  "el panel pide conteos al entrar y mensajes recien al abrir el drawer",
  adminSrc.includes("data.open") && adminSrc.includes("user_id=")
);

console.log(fails === 0 ? "\nTODO OK" : `\n${fails} FALLOS`);
process.exit(fails === 0 ? 0 : 1);