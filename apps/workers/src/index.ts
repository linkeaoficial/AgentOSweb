export interface Env {
  DB: D1Database;
  AGENT_CACHE: KVNamespace;
  AI: Ai;
  GROQ_MANAGED_KEY?: string;
  OPENAI_MANAGED_KEY?: string;
  API_KEY?: string;
  ENVIRONMENT?: string;
  DEFAULT_MODEL?: string;
  OWNER_TOKEN?: string;     // Secreto del dueño: el dashboard lo envía para escribir/leer config
  ENCRYPTION_KEY?: string;  // Clave AES-GCM (texto) para cifrar chat_api_key en reposo
    OWNER_USER_ID?: string;   // Dueño multi-agente; si falta, se deduce del primer agente existente
    // Numero de WhatsApp de soporte con prefijo de pais y sin signos, tal como lo
    // acepta el enlace wa.me (ej. "5491122334455"). Lo usa el boton de renovar del
    // modal de vencimiento. Vacio = el modal avisa pero no ofrece WhatsApp.
    SUPPORT_WHATSAPP?: string;
  AUTH_SECRET?: string;     // Mejor Auth: firma de sesiones/tokens. REQUERIDO en producción.
  AUTH_BASE_URL?: string;   // Base URL pública del panel (para redirecciones OAuth). Default: el worker.
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  APPLE_CLIENT_ID?: string;
  APPLE_CLIENT_SECRET?: string;
}

interface AgentRow {
  id: string;
  user_id: string;
  name: string;
  avatar_url: string | null;
  bubble_logo_url: string | null;
  header_title: string;
  header_subtitle: string;
  welcome_message: string;
  system_prompt: string;
  knowledge_base: string | null;
  primary_color: string;
  position: string;
  default_theme: string;
  mode: string;
  chat_provider: string;
  chat_model: string;
  chat_api_key: string | null;
  chat_base_url: string | null;
  byok_provider: string | null;
  byok_model: string | null;
  max_tokens: number;
  allowed_domains: string;
  rate_limit_per_minute: number;
  is_active: number;
  faqs: string | null;
  lead_capture: number;
  lead_fields: string;
}

const DEFAULT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const DEFAULT_MODEL_FAST = "@cf/meta/llama-3.1-8b-instruct-fast";
const DEFAULT_LEAD_FIELDS = "name,email,phone";

// Proveedores BYOK compatibles con Chat Completions de OpenAI.
// Gemini se sirve vía su endpoint OpenAI-compatible oficial.
const PROVIDER_BASE_URLS: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  groq: "https://api.groq.com/openai/v1",
  cerebras: "https://api.cerebras.ai/v1",
  deepseek: "https://api.deepseek.com",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
  mistral: "https://api.mistral.ai/v1",
  qwen: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
  nvidia: "https://integrate.api.nvidia.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  onnirouter: "https://omnirouter.li/v1",
  unorouter: "https://api.unorouter.com/v1",
};

function isWorkersAI(agent: AgentRow) {
  return agent.mode === "managed" || agent.chat_provider === "workers-ai" || !agent.chat_api_key;
}

// El Free no habilita BYOK (gate al guardar en handleAgentUpdate + planes
// vencidos): en el chat, un agente BYOK con plan Free se atiende con IA
// administrada para que aplique el cupo de prueba. ponytail: 1 lectura D1 por
// mensaje BYOK, aceptable al volumen actual.
async function isFreePlan(env: Env, userId: string) {
  const u = await env.DB.prepare("SELECT plan FROM users WHERE id = ?").bind(userId).first<{ plan: string | null }>();
  return !u?.plan || u.plan === "free";
}

// Cupo agotado, según plan: el Free no se salta el cupo con BYOK, su salida es Starter.
function cupoReply(plan: string | null): string {
  if (!plan || plan === "free") {
    return "Tu plan de prueba alcanzó el límite mensual de mensajes de IA administrada. Pasate al plan Starter ($19 con tu API key o $39 con IA administrada) para seguir sin límite. ¿Te ayudamos a activarlo?";
  }
  return "Tu plan alcanzó el límite mensual de mensajes de IA administrada. Contáctanos para subir tu plan o cambia a BYOK (tu API Key) y continúa sin límite.";
}

// 🔐 Cifrado simétrico (AES-256-GCM) para claves de API en reposo.
// Formato almacenado: "e1:<iv_b64>.<cipher_b64>". Claves viejas sin el prefijo
// se devuelven tal cual, así nunca se rompe lo ya guardado.
const SECRET_PREFIX = "e1:";

function bytesToB64(u: Uint8Array): string {
  let bin = "";
  for (const b of u) bin += String.fromCharCode(b);
  return btoa(bin);
}

function b64ToBytes(s: string): Uint8Array {
  const bin = atob(s);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

async function getEncryptionKey(env: Env): Promise<CryptoKey | null> {
  if (!env.ENCRYPTION_KEY) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(env.ENCRYPTION_KEY));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptSecret(plain: string, env: Env): Promise<string> {
  const key = await getEncryptionKey(env);
  if (!key) return plain; // sin ENCRYPTION_KEY (dev): se guarda tal cual
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain));
  return `${SECRET_PREFIX}${bytesToB64(iv)}.${bytesToB64(new Uint8Array(ct))}`;
}

async function decryptSecret(stored: string | null, env: Env): Promise<string | null> {
  if (!stored) return null;
  if (!stored.startsWith(SECRET_PREFIX)) return stored;
  const key = await getEncryptionKey(env);
  if (!key) return null;
  const [ivB64, ctB64] = stored.slice(SECRET_PREFIX.length).split(".");
  try {
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64ToBytes(ivB64) }, key, b64ToBytes(ctB64));
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
}

function isOwnerAuthorized(request: Request, env: Env): boolean {
  if (!env.OWNER_TOKEN) return true; // token no configurado (dev): sin restricción
  const provided = request.headers.get("X-Owner-Token");
  if (!provided) return false;
  // Comparación en tiempo constante (misma longitud + XOR); Workers no expone timingSafeEqual.
  if (provided.length !== env.OWNER_TOKEN.length) return false;
  const a = new TextEncoder().encode(provided);
  const b = new TextEncoder().encode(env.OWNER_TOKEN);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// ── Fase 2C: identidad multi-tenant ────────────────────────────────────────────
// Cada request autenticado resuelve a un `{ userId, role, superadmin }`.
// - SUPERADMIN (transición): `X-Owner-Token` válido → actúa como el dueño actual.
// - Sesión Better Auth: la cookie `aow_auth.session_token` (reenviada por el proxy
//   del dashboard) → `user.id`. Rol: `admin`/`cliente` desde la columna `role`.
// La primera sesión de un email que existía en la tabla legacy `users` (dueño viejo)
// reclama su data: mueve sus agentes al id de Better Auth y lo promueve a admin.
interface ResolvedUser {
  id: string;
  role: "admin" | "cliente";
  superadmin: boolean;
}

async function claimLegacyOwner(env: Env, su: { id: string; email: string; name?: string | null }): Promise<void> {
  const legacy = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(su.email).first<{ id: string }>();
  if (legacy && legacy.id !== su.id) {
    // ¿Ya está reclamado? Si el id ya tiene agentes propios, no repetir el reclamo.
    const already = await env.DB.prepare("SELECT id FROM agents WHERE user_id = ? LIMIT 1").bind(su.id).first();
    if (!already) {
      // La FK agents.user_id -> users(id) es ON DELETE CASCADE y no ON UPDATE
      // CASCADE, así que cambiar el id del padre está prohibido en cualquier
      // orden. defer_foreign_keys postpone la verificación hasta el COMMIT.
      await env.DB.batch([
        env.DB.prepare("PRAGMA defer_foreign_keys = ON"),
        env.DB.prepare("UPDATE users SET id = ?, name = COALESCE(NULLIF(?, ''), name) WHERE id = ?").bind(su.id, su.name ?? "", legacy.id),
        env.DB.prepare("UPDATE agents SET user_id = ? WHERE user_id = ?").bind(su.id, legacy.id),
      ]);
      // El dueño legacy pasa a ser admin: puede editar planes (Fase 2D).
      await env.DB.prepare('UPDATE "user" SET role = \'admin\' WHERE id = ?').bind(su.id).run();
    }
    return;
  }
  // La cuenta nueva entra en free con un mes de período ya corriendo: desde el
  // alta se sabe que vence, sin depender de que alguien abra el panel.
  await env.DB.prepare(
    "INSERT OR IGNORE INTO users (id, email, name, plan, plan_expires_at) VALUES (?, ?, ?, 'free', ?)"
  ).bind(su.id, su.email, su.name ?? null, periodEnd()).run();
  await ensureDefaultAgent(env, su.id, su.name);
}

// Toda cuenta nueva arranca con un agente propio: el panel (agentes, script de
// instalación, overview y prospectos) siempre trabaja sobre un agent_id real.
async function ensureDefaultAgent(env: Env, userId: string, name?: string | null) {
  const existing = await env.DB.prepare("SELECT id FROM agents WHERE user_id = ? LIMIT 1").bind(userId).first();
  if (existing) return;
  await env.DB.prepare(
    "INSERT INTO agents (id, user_id, name, header_title, system_prompt, welcome_message, mode, chat_provider, chat_model, lead_fields) VALUES (?, ?, ?, ?, ?, ?, 'managed', 'workers-ai', ?, ?)"
  )
    .bind(crypto.randomUUID(), userId, "Mi Agente", "AgentOSweb", "", `Soy el asistente virtual de ${name || "tu negocio"}. ¿En qué te puedo colaborar hoy?`, DEFAULT_MODEL_FAST, DEFAULT_LEAD_FIELDS)
    .run()
    .catch(() => {}); // nunca romper el listado por el agente por defecto
}

async function resolveUser(request: Request, env: Env): Promise<ResolvedUser | null> {
  if (isOwnerAuthorized(request, env)) {
    const ownerId = await resolveOwnerId(env);
    if (ownerId) return { id: ownerId, role: "admin", superadmin: true };
    return null;
  }
  const { getSessionUser } = await import("./auth");
  const su = await getSessionUser(env, request);
  if (!su) return null;
  await claimLegacyOwner(env, su);
  return { id: su.id, role: su.role === "admin" ? "admin" : "cliente", superadmin: false };
}

async function infer(agent: AgentRow, payload: { role: string; content: string }[], env: Env): Promise<string> {
  if (isWorkersAI(agent)) {
    const model = agent.chat_model.startsWith("@cf/") ? agent.chat_model : DEFAULT_MODEL;
    const resp = await env.AI.run(model, {
      messages: payload.map((m) => ({ role: m.role as "user" | "assistant" | "system", content: m.content })),
      max_tokens: agent.max_tokens || 500,
    });
    const text = (resp as { response?: string }).response || "";
    if (!text) throw new Error("Workers AI vacío");
    return text;
  }

  const apiKey = agent.chat_api_key ? await decryptSecret(agent.chat_api_key, env) : null;
  if (!apiKey) throw new Error("Falta API key");

  // Base URL: prioridad a chat_base_url (proveedor "custom"), luego catálogo conocido.
  const base =
    (agent.chat_base_url && agent.chat_base_url.trim()) ||
    PROVIDER_BASE_URLS[agent.chat_provider] ||
    "https://api.openai.com/v1";
  const model = agent.chat_model || env.DEFAULT_MODEL || DEFAULT_MODEL;

  const res = await fetch(`${base.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: payload, max_tokens: agent.max_tokens || 500, temperature: 0.6 }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[ia] ${agent.chat_provider} ${model} -> ${res.status}: ${errText.slice(0, 500)}`);
    throw new Error(`IA ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content || "";
}

function corsHeaders(origin: string) {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, GET, PUT, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Owner-Token",
  };
}

function json(data: unknown, status = 200, origin = "*") {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders(origin) });
}

// ponytail: rate limit en memoria (por instancia). WebSocket/colo-uniforme se requiere un Durable Object; agregar solo si hay abuso real.
const rateBuckets = new Map<string, { count: number; windowStart: number }>();
const RATE_WINDOW_MS = 60_000;

// 🎯 Captura automática de prospectos: extrae nombre/email/teléfono del mensaje y lo guarda en `leads`.
// El dueño controla qué capturar por agente (`lead_capture` = on/off, `lead_fields` = 'name,email,phone').
// ponytail: regex heurística (falsos positivos con cadenas numéricas tipo fechas); migrar a
// extracción con IA dentro del LLM si el ruido molesta.
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_RE = /(?:\+?\d[\s().-]?){6,}\d/;
const NAME_RE = /(?:me llamo|mi nombre es|nombre es|soy)\s+([A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]+(?:\s+[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]+){0,2})/i;

async function captureLead(agent: AgentRow, sessionId: string, message: string, env: Env) {
  if (agent.lead_capture === 0) return; // solo responde: la captura está apagada para este agente
  const fields = (agent.lead_fields || DEFAULT_LEAD_FIELDS).split(",").map((f) => f.trim());

  const email = fields.includes("email") ? message.match(EMAIL_RE)?.[0]?.toLowerCase() || null : null;
  const phone = fields.includes("phone") ? message.match(PHONE_RE)?.[0]?.trim() || null : null;
  const name = fields.includes("name") ? message.match(NAME_RE)?.[1]?.trim() || null : null;
  if (!email && !phone && !name) return;
  // Dedupe por email (o teléfono si no hay email) para el mismo agente
  const dupKey = email ?? phone;
  if (dupKey) {
    const dup = await env.DB.prepare(
      email
        ? "SELECT id FROM leads WHERE agent_id = ? AND email = ?"
        : "SELECT id FROM leads WHERE agent_id = ? AND phone = ?"
    )
      .bind(agent.id, dupKey)
      .first<{ id: string }>();
    if (dup) return;
  }
  try {
    await env.DB.prepare(
      `INSERT INTO leads (id, agent_id, name, email, phone, notes, interest, session_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    )
      .bind(crypto.randomUUID(), agent.id, name, email, phone, null, message.slice(0, 300), sessionId)
      .run();
  } catch {
    // Captura best-effort: si falla, el chat sigue normal
  }
}

function isRateLimited(key: string, limit: number): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.windowStart >= RATE_WINDOW_MS) {
    rateBuckets.set(key, { count: 1, windowStart: now });
    return false;
  }
  bucket.count++;
  return bucket.count > limit;
}

async function getAgent(agentId: string, env: Env): Promise<AgentRow | null> {
  const cached = await env.AGENT_CACHE.get<AgentRow>(`agent:${agentId}`, "json");
  if (cached) return cached;

  const agent = await env.DB.prepare("SELECT * FROM agents WHERE id = ?").bind(agentId).first<AgentRow>();
  if (!agent) return null;
  if (agent.is_active !== 1) return null;

  await env.AGENT_CACHE.put(`agent:${agentId}`, JSON.stringify(agent), { expirationTtl: 3600 });
  return agent;
}

export interface Faq {
  label: string;
  msg: string;
  answer: string;
}

function getFaqs(agent: AgentRow): Faq[] {
  if (!agent.faqs) return [];
  try {
    const parsed = JSON.parse(agent.faqs);
    return Array.isArray(parsed) ? parsed.filter((f) => f?.msg && f?.answer) : [];
  } catch {
    return [];
  }
}

function normalizeText(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[?¡!¿.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const FAQ_STOPWORDS = new Set([
  "como", "para", "puedo", "puedes", "cual", "cuales", "donde", "cuando", "cuales",
  "de", "del", "la", "el", "los", "las", "un", "una", "unos", "unas", "que", "es",
  "son", "en", "y", "o", "a", "mi", "tu", "su", "mis", "tus", "sus", "al", "con",
  "por", "esta", "este", "esto", "estas", "estos", "me", "te", "se", "lo", "hi",
]);

function lightStem(w: string): string {
  for (const suf of ["ando", "iendo", "acion", "aciones", "ados", "adas", "ado", "ida", "idas", "ar", "er", "ir", "es", "os", "as", "s", "o", "a"]) {
    if (w.length - suf.length >= 4 && w.endsWith(suf)) return w.slice(0, w.length - suf.length);
  }
  return w;
}

function faqKeywords(s: string): string[] {
  // Quita paréntesis (ej. "(Bring Your Own Key)") y tokens de interrupción
  return normalizeText(s)
    .replace(/\([^)]*\)/g, " ")
    .split(" ")
    .filter((w) => w.length >= 4 && !FAQ_STOPWORDS.has(w))
    .map(lightStem);
}

function matchFaq(agent: AgentRow, message: string): string | null {
  const needleStem = faqKeywords(message);
  // Se evalúa el msg del chip y su label (el cliente suele teclear el texto visible,
  // que puede no coincidir con el prompt interno). Gana la FAQ con más aciertos;
  // con empate manda la primera en orden.
  const bestPerFaq = new Map<string, number>();
  for (const f of getFaqs(agent)) {
    for (const phrase of new Set([f.msg, f.label || f.msg])) {
      const kws = faqKeywords(phrase);
      // FAQ sin keywords útiles (p. ej. una emoji): solo matchea si coincide tal cual
      if (kws.length === 0) {
        if (normalizeText(message) === normalizeText(phrase)) {
          bestPerFaq.set(f.answer, Math.max(bestPerFaq.get(f.answer) ?? 0, 1));
        }
        continue;
      }
      const hits = kws.filter((kw) => needleStem.includes(kw)).length;
      // ponytail: chip de 1 sola keyword ("hola") solo responde cuando el mensaje ES esa
      // palabra; si no, un saludo largo responde la FAQ genérica y queda chimbo.
      if (kws.length === 1) {
        if (needleStem.length === 1 && needleStem[0] === kws[0]) {
          bestPerFaq.set(f.answer, Math.max(bestPerFaq.get(f.answer) ?? 0, hits));
        }
        continue;
      }
      // Multi-keyword: exige todas en FAQs cortas (2-3 keywords) para no cruzar temas;
      // en FAQs largas (4+) tolera fallar UNA (los clientes no repiten la frase del chip).
      const minHits = kws.length <= 3 ? kws.length : kws.length - 1;
      if (hits >= minHits) {
        bestPerFaq.set(f.answer, Math.max(bestPerFaq.get(f.answer) ?? 0, hits));
      }
    }
  }
  let best: string | null = null;
  let bestHits = 0;
  for (const [answer, hits] of bestPerFaq) {
    if (hits > bestHits) {
      best = answer;
      bestHits = hits;
    }
  }
  return best;
}

// ── Matching semántico de FAQs (fallback) ──────────────────────────────────────
// El matcher por keywords no cubre sinónimos/paráfrasis; este comparo por
// significado usando embeddings de Workers AI (multilingüe). Solo se usa cuando
// el matcher léxico no encuentra nada: no reemplaza, complementa.
const EMBEDDING_MODEL = "@cf/baai/bge-m3";
const FAQ_SEM_THRESHOLD = 0.72; // coseno: arriba => responde esa FAQ
const FAQ_EMBED_BATCH = 16;

interface FaqVec {
  answer: string;
  label: string;
  vLabel: number[];
  vMsg: number[];
}

// Los embeddings de Workers AI pueden venir como `data: [vec, vec, ...]` o como
// `data: Float32Array` plano con `shape: [rows, dim]`; se normaliza a number[][].
function normalizeEmbeddings(res: { shape?: number[]; data: number[] }): number[][] {
  const raw = res.data;
  if (Array.isArray(raw) && raw.length > 0 && Array.isArray(raw[0])) return raw as unknown as number[][];
  const dim = res.shape?.[1] ?? 0;
  if (!dim || raw.length < dim) return [];
  const out: number[][] = [];
  for (let j = 0; j < raw.length; j += dim) out.push(raw.slice(j, j + dim));
  return out;
}

async function embedOne(text: string, env: Env): Promise<number[]> {
  const res = (await env.AI.run(EMBEDDING_MODEL, { text: [text] })) as { shape?: number[]; data: number[] };
  return normalizeEmbeddings(res)[0] ?? [];
}

async function getFaqVectors(agent: AgentRow, env: Env): Promise<FaqVec[] | null> {
  const faqs = getFaqs(agent);
  if (faqs.length === 0) return null;
  const key = `faqvec:${agent.id}`;
  const cached = await env.AGENT_CACHE.get(key).catch(() => null);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {}
  }
  try {
    const texts = faqs.flatMap((f) => [f.label, f.msg]);
    const all: number[][] = [];
    for (let i = 0; i < texts.length; i += FAQ_EMBED_BATCH) {
      const res = (await env.AI.run(EMBEDDING_MODEL, { text: texts.slice(i, i + FAQ_EMBED_BATCH) })) as {
        shape?: number[];
        data: number[];
      };
      const vectors = normalizeEmbeddings(res);
      if (vectors.length === 0) throw new Error("Embeddings vacíos");
      all.push(...vectors);
    }
    if (all.length < faqs.length * 2) throw new Error("Embeddings incompletos");
    const rows: FaqVec[] = faqs.map((f, i) => ({ answer: f.answer, label: f.label, vLabel: all[i * 2], vMsg: all[i * 2 + 1] }));
    await env.AGENT_CACHE.put(key, JSON.stringify(rows), { expirationTtl: 3600 }).catch(() => {});
    return rows;
  } catch {
    return null; // embedding no disponible: el matcher léxico sigue siendo el que manda
  }
}

function cosineSim(a: number[], b: number[]): number {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

// Solo se invoca cuando matchFaq devolvió null. Devuelve el answer si hay una FAQ
// suficientemente similar (label o msg), comparando lo más parecido. Además de
// superar el umbral absoluto, la mejor debe ganarle por un margen a la segunda:
// si dos FAQs quedan casi empatadas, mejor cae a la IA que responder la equivocada.
const FAQ_SEM_MARGIN = 0.06;
async function matchFaqSemantic(agent: AgentRow, message: string, env: Env): Promise<string | null> {
  try {
    const rows = await getFaqVectors(agent, env);
    if (!rows || rows.length === 0) return null;
    const msgVec = await embedOne(message, env);
    if (msgVec.length === 0) return null;
    let best: FaqVec | null = null;
    let bestSim = 0;
    let secondSim = 0;
    for (const row of rows) {
      const sim = Math.max(cosineSim(msgVec, row.vLabel), cosineSim(msgVec, row.vMsg));
      if (sim > bestSim) {
        secondSim = bestSim;
        bestSim = sim;
        best = row;
      } else if (sim > secondSim) {
        secondSim = sim;
      }
    }
    return best && bestSim >= FAQ_SEM_THRESHOLD && bestSim - secondSim >= FAQ_SEM_MARGIN ? best.answer : null;
  } catch {
    return null;
  }
}

function recordFaqHit(agent: AgentRow, faqReply: string, env: Env, ctx: ExecutionContext) {
  const matched = getFaqs(agent).find((f) => f.answer === faqReply);
  const label = matched?.label ?? (faqReply.length > 60 ? faqReply.slice(0, 60) : faqReply);
  ctx.waitUntil(
    env.DB.prepare(
      "INSERT INTO faq_hits (agent_id, faq_label, hits) VALUES (?, ?, 1) ON CONFLICT(agent_id, faq_label) DO UPDATE SET hits = hits + 1"
    )
      .bind(agent.id, label)
      .run()
      .catch(() => {})
  );
}

function domainAllowed(agent: AgentRow, origin: string): boolean {
  if (agent.allowed_domains === "*") return true;
  const allowed = agent.allowed_domains
    .split(",")
    .map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, ""));
  const hostname = origin.toLowerCase().replace(/^https?:\/\//, "").split("/")[0];
  return allowed.some(
    (domain) => hostname === domain || hostname.endsWith("." + domain),
  );
}

const EMERGENCY_REPLY =
  "Disculpa, actualmente experimento alta demanda. Por favor, reformula tu consulta o contacta a soporte.";

// Interés de compra/contacto: palabras que disparan el webhook y el formulario embebido.
function hasInterest(text: string): boolean {
  const lower = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return (
    lower.includes("@") ||
    lower.includes("precio") ||
    lower.includes("precios") ||
    lower.includes("comprar") ||
    lower.includes("comprando") ||
    lower.includes("contratar") ||
    lower.includes("presupuesto") ||
    lower.includes("cotiza") ||
    lower.includes("cotizacion") ||
    lower.includes("vender") ||
    lower.includes("adquirir") ||
    lower.includes("cuanto cuesta") ||
    lower.includes("cuanto vale") ||
    lower.includes("costo") ||
    lower.includes("pago") ||
    lower.includes("planes")
  );
}

async function sendWebhook(env: Env, userId: string, text: string) {
  try {
    const user = await env.DB.prepare("SELECT telegram_chat_id, webhook_url FROM users WHERE id = ?")
      .bind(userId)
      .first<{ telegram_chat_id: string | null; webhook_url: string | null }>();
    if (!user) return;

    if (user.telegram_chat_id && env.API_KEY) {
      const tgRes = await fetch(
        `https://api.telegram.org/bot${env.API_KEY}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: user.telegram_chat_id, text }),
        }
      );
      await tgRes.text();
    }
    if (user.webhook_url) {
      await fetch(user.webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      }).catch(() => {});
    }
  } catch {
    // Webhooks best-effort: nunca rompen la respuesta al usuario
  }
}

async function handleChat(request: Request, env: Env, ctx: ExecutionContext) {
  const origin = request.headers.get("Origin") || "*";
  const body = (await request.json().catch(() => null)) as {
    agent_id?: string;
    message?: string;
    session_id?: string;
  } | null;

  if (!body?.agent_id || typeof body.message !== "string") {
    return json({ error: "agent_id y message son obligatorios" }, 400, origin);
  }
  if (body.message.trim().length === 0 || body.message.length > 1500) {
    return json({ error: "Mensaje inválido" }, 400, origin);
  }

  const agent = await getAgent(body.agent_id, env);
  if (!agent) return json({ error: "Agente no existe o está inactivo" }, 404, origin);

  if (env.ENVIRONMENT !== "development" && !domainAllowed(agent, origin)) {
    return json({ error: "Dominio no autorizado" }, 403, origin);
  }

  const clientKey = `${body.agent_id}:${request.headers.get("CF-Connecting-IP") || "unknown"}`;
  if (isRateLimited(clientKey, agent.rate_limit_per_minute || 20)) {
    return json({ error: "Demasiadas solicitudes. Intenta en un minuto." }, 429, origin);
  }

  // Form embebido: se ofrece una vez por sesión cuando hay interés y captura activa.
  const wantsForm =
    agent.lead_capture === 1 &&
    hasInterest(body.message) &&
    (await (async () => {
      const id = await env.DB
        .prepare("SELECT id FROM leads WHERE agent_id = ? AND session_id = ?")
        .bind(agent.id, body.session_id || "anon")
        .first<{ id: string }>()
        .catch(() => null);
      return !id;
    })());
  const formPayload = wantsForm
    ? { form: { fields: (agent.lead_fields || DEFAULT_LEAD_FIELDS).split(",").map((f) => f.trim()).filter(Boolean) } }
    : {};

  const safeHistory: { role: string; content: string }[] = [];

  // 📜 Contexto conversacional: últimos 6 mensajes de la sesión
  try {
    const convo = await env.DB.prepare(
      "SELECT id FROM conversations WHERE agent_id = ? AND session_id = ?"
    )
      .bind(body.agent_id, body.session_id || "anon")
      .first<{ id: string }>();
    if (convo) {
      const rows = await env.DB.prepare(
        "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 6"
      )
        .bind(convo.id)
        .all<{ role: "user" | "assistant"; content: string }>();
      for (const r of rows.results.reverse()) {
        if (r.role === "user" || r.role === "assistant") {
          safeHistory.push({ role: r.role, content: r.content.slice(0, 1500) });
        }
      }
    }
  } catch {
    // Sin historial no es fatal
  }

  const systemPrompt =
    agent.system_prompt?.trim() ||
    `Eres el asistente virtual de ${agent.header_title}. Responde con amabilidad, claridad, brevedad y en el idioma del cliente.`;

  const messagesPayload: { role: string; content: string }[] = [
    {
      role: "system",
      content: `${systemPrompt}\n\nBASE DE CONOCIMIENTO DEL NEGOCIO:\n${agent.knowledge_base || "Sin datos adicionales."}`,
    },
    ...safeHistory,
    { role: "user", content: String(body.message).slice(0, 1500) },
  ];

  const faqReply = matchFaq(agent, String(body.message)) || (await matchFaqSemantic(agent, String(body.message), env));
  if (faqReply) {
    recordFaqHit(agent, faqReply, env, ctx);
    return json({ reply: faqReply, ...formPayload }, 200, origin);
  }

  // 🎯 Control de cupo: solo la IA administrada consume cupo; BYOK paga su propia IA (ilimitado).
  // Free no usa BYOK: si el agente quedó en BYOK con plan Free (vencimiento o
  // config previa al gate), se atiende con IA administrada y aplica el cupo.
  const byokBlocked = !isWorkersAI(agent) && (await isFreePlan(env, agent.user_id));
  const useManaged = isWorkersAI(agent) || byokBlocked;
  let managedLimit: number | null = null; // cupo efectivo del usuario si IA administrada
  if (useManaged) {
    // KV evita releer D1 en cada intento: 5 min una vez agotado (valor = plan,
    // para responder según el plan; "1" son entradas viejas = plan desconocido)
    const blocked = await env.AGENT_CACHE.get(`quota:${agent.user_id}`);
    if (blocked) return json({ reply: cupoReply(blocked === "1" ? null : blocked) }, 200, origin);
    const userInfo = await env.DB.prepare("SELECT messages_used, messages_limit, plan, plan_expires_at FROM users WHERE id = ?")
      .bind(agent.user_id)
      .first<{ messages_used: number; messages_limit: number | null; plan: string | null; plan_expires_at: string | null }>();
    if (userInfo) {
      const limit = effectiveMessagesLimit(userInfo);
      managedLimit = limit;
      if (userInfo.messages_used >= limit) {
        await env.AGENT_CACHE.put(`quota:${agent.user_id}`, userInfo.plan ?? "free", { expirationTtl: 300 });
        return json({ reply: cupoReply(userInfo.plan) }, 200, origin);
      }
    }
  }

  // Pacing orgánico: mínimo 1.000 ms de espera perceptible
  const minDelay = new Promise((r) => setTimeout(r, 1000));

  let botReply = "";
  try {
    // byokBlocked: Free con BYOK configurado se atiende como IA administrada.
    botReply = await infer(
      byokBlocked ? { ...agent, mode: "managed", chat_provider: "workers-ai", chat_api_key: null } : agent,
      messagesPayload,
      env
    );
  } catch (err) {
    await env.AGENT_CACHE.put("last_groq_error", String(err), { expirationTtl: 600 });
    botReply = EMERGENCY_REPLY;
  }
  if (!botReply) botReply = EMERGENCY_REPLY;

  await minDelay;

  const message = body.message;
  const sessionId = body.session_id || "anon";
  ctx.waitUntil(
    (async () => {
      try {
        const convoId = crypto.randomUUID();
        await env.DB.prepare(
          `INSERT OR IGNORE INTO conversations (id, agent_id, session_id, updated_at)
           VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
        )
          .bind(convoId, agent.id, sessionId)
          .run();

        const row = await env.DB.prepare(
          "SELECT id FROM conversations WHERE agent_id = ? AND session_id = ?"
        )
          .bind(agent.id, sessionId)
          .first<{ id: string }>();

        await env.DB.batch([
          env.DB.prepare("INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, 'user', ?)")
            .bind(crypto.randomUUID(), row?.id || convoId, message),
          env.DB.prepare("INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, 'assistant', ?)")
            .bind(crypto.randomUUID(), row?.id || convoId, botReply),
          env.DB.prepare("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(
            row?.id || convoId
          ),
        ]);
// 🎯 Solo la IA administrada consume cupo; BYOK paga su propia IA (ilimitado)
        if (useManaged && managedLimit != null) {
          // Incremento atómico: no suma si ya se alcanzó el límite (evita pasarse en ráfagas).
          await env.DB.prepare(
            `UPDATE users SET messages_used = messages_used + 1
             WHERE id = ? AND messages_used < ?`
          )
            .bind(agent.user_id, managedLimit)
            .run();
        }

        if (hasInterest(message)) {
          await sendWebhook(env, agent.user_id, `🚨 Nuevo interés en tu web:\n"${message}"`);
        }

        // 🎯 Captura de prospectos: email/teléfono detectados se registran en la bandeja
        await captureLead(agent, sessionId, message, env);
      } catch {
        // Persistencia best-effort
      }
    })()
  );

  return json({ reply: botReply, ...formPayload }, 200, origin);
}

async function handleAgent(request: Request, agentId: string, env: Env) {
  const origin = request.headers.get("Origin") || "*";
  const agent = await getAgent(agentId, env);
  if (!agent) return json({ error: "Agente no existe" }, 404, origin);

  const res = json(
    {
      header_title: agent.header_title,
      header_subtitle: agent.header_subtitle,
      welcome_message: agent.welcome_message,
      avatar_url: agent.avatar_url,
      bubble_logo_url: agent.bubble_logo_url,
      primary_color: agent.primary_color,
      position: agent.position,
      default_theme: agent.default_theme,
      prompts: getFaqs(agent).map((f) => ({ label: f.label, msg: f.msg })),
    },
    200,
    origin
  );
  // Config pública del widget, inmutable hasta que el dueño la edita: se sirve desde
  // el edge de Cloudflare (1 min + stale-while-revalidate) para no golpear D1 en cada
  // carga de página de cada visitante. El dashboard usa /config (sin cache).
  res.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=3600");
  return res;
}

// Config completa y editable SOLO para el dashboard. Lee D1 directo (sin cache)
// para que el editor siempre muestre estado fresco y funcione con agentes pausados
// (getAgent devuelve null si is_active !== 1). NUNCA expone chat_api_key.
async function handleAgentConfig(request: Request, agentId: string, env: Env) {
  const origin = request.headers.get("Origin") || "*";
  const user = await resolveUser(request, env);
  if (!user) return json({ error: "No autorizado" }, 403, origin);
  const agent = await env.DB.prepare("SELECT * FROM agents WHERE id = ? AND user_id = ?")
    .bind(agentId, user.id)
    .first<AgentRow>();
  if (!agent) return json({ error: "Agente no existe" }, 404, origin);

  return json(
    {
      id: agent.id,
      name: agent.name,
      header_title: agent.header_title,
      header_subtitle: agent.header_subtitle,
      welcome_message: agent.welcome_message,
      avatar_url: agent.avatar_url,
      bubble_logo_url: agent.bubble_logo_url,
      primary_color: agent.primary_color,
      position: agent.position,
      default_theme: agent.default_theme,
      system_prompt: agent.system_prompt,
      knowledge_base: agent.knowledge_base,
      max_tokens: agent.max_tokens,
      allowed_domains: agent.allowed_domains,
      rate_limit_per_minute: agent.rate_limit_per_minute,
      is_active: agent.is_active,
      mode: agent.mode,
      chat_provider: agent.chat_provider,
      chat_model: agent.chat_model,
      has_chat_api_key: agent.chat_api_key ? true : false,
      chat_base_url: agent.chat_base_url,
      byok_provider: agent.byok_provider,
      byok_model: agent.byok_model,
      lead_capture: agent.lead_capture === 0 ? false : true,
      lead_fields: agent.lead_fields || DEFAULT_LEAD_FIELDS,
      faqs: getFaqs(agent),
    },
    200,
    origin
  );
}

const EDITABLE_FIELDS: Record<string, { column: string; allowNull?: boolean; validate: (v: unknown) => unknown | null }> = {
  name: { column: "name", validate: (v) => (typeof v === "string" && v.trim().length > 0 && v.trim().length <= 60 ? v.trim() : null) },
  header_title: { column: "header_title", validate: (v) => (typeof v === "string" && v.length <= 120 ? v.trim() : null) },
  header_subtitle: { column: "header_subtitle", validate: (v) => (typeof v === "string" && v.length <= 200 ? v.trim() : null) },
  welcome_message: { column: "welcome_message", validate: (v) => (typeof v === "string" && v.length <= 1000 ? v.trim() : null) },
  system_prompt: { column: "system_prompt", validate: (v) => (typeof v === "string" && v.length <= 10000 ? v : null) },
  knowledge_base: { column: "knowledge_base", allowNull: true, validate: (v) => (typeof v === "string" && v.length <= 20000 ? v : null) },
  primary_color: {
    column: "primary_color",
    validate: (v) => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : null),
  },
  position: { column: "position", validate: (v) => (v === "right" || v === "left" ? v : null) },
  default_theme: { column: "default_theme", validate: (v) => (v === "light" || v === "dark" || v === "auto" ? v : null) },
  avatar_url: { column: "avatar_url", allowNull: true, validate: (v) => (typeof v === "string" && v.length <= 500 ? v : null) },
  bubble_logo_url: { column: "bubble_logo_url", allowNull: true, validate: (v) => (typeof v === "string" && v.length <= 500 ? v.trim() || null : null) },
  chat_model: { column: "chat_model", validate: (v) => (typeof v === "string" && v.length <= 200 ? v : null) },
  mode: {
    column: "mode",
    validate: (v) => (v === "byok" || v === "managed" ? v : null),
  },
  chat_provider: {
    column: "chat_provider",
    validate: (v) =>
      typeof v === "string" &&
      ["workers-ai", "cerebras", "openai", "groq", "deepseek", "gemini", "mistral", "qwen", "nvidia", "openrouter", "onnirouter", "unorouter", "custom"].includes(v)
        ? v
        : null,
  },
  chat_api_key: {
    column: "chat_api_key",
    allowNull: true,
    validate: (v) => (typeof v === "string" && v.length <= 500 ? v.trim() || null : null),
  },
  byok_provider: {
    column: "byok_provider",
    allowNull: true,
    validate: (v) => (v === null || (typeof v === "string" && v.length <= 60) ? (typeof v === "string" && v.trim() ? v.trim() : null) : null),
  },
  byok_model: {
    column: "byok_model",
    allowNull: true,
    validate: (v) => (v === null || (typeof v === "string" && v.length <= 200) ? (typeof v === "string" && v.trim() ? v.trim() : null) : null),
  },
  chat_base_url: {
    column: "chat_base_url",
    allowNull: true,
    validate: (v) => (typeof v === "string" && v.length <= 500 ? v.trim() || null : null),
  },
  max_tokens: {
    column: "max_tokens",
    validate: (v) => (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5000 ? v : null),
  },
  allowed_domains: { column: "allowed_domains", validate: (v) => (typeof v === "string" && v.length <= 500 ? v : null) },
  rate_limit_per_minute: {
    column: "rate_limit_per_minute",
    validate: (v) => (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 120 ? v : null),
  },
  is_active: {
    column: "is_active",
    validate: (v) => (typeof v === "boolean" ? (v ? 1 : 0) : v === 0 || v === 1 ? v : null),
  },
  lead_capture: {
    column: "lead_capture",
    validate: (v) => (typeof v === "boolean" ? (v ? 1 : 0) : v === 0 || v === 1 ? v : null),
  },
  lead_fields: {
    column: "lead_fields",
    validate: (v) =>
      Array.isArray(v) &&
      v.length > 0 &&
      v.every((f) => f === "name" || f === "email" || f === "phone")
        ? [...new Set(v as string[])].join(",")
        : null,
  },
};

const FAQ_MAX_LABEL = 120;
const FAQ_MAX_ANSWER = 5000;
const FAQ_MAX_COUNT = 50;

function validateFaqs(v: unknown): string | null {
  if (!Array.isArray(v)) return null;
  if (v.length > FAQ_MAX_COUNT) return null;
  for (const f of v) {
    if (
      !f ||
      typeof f !== "object" ||
      typeof f.label !== "string" ||
      typeof f.msg !== "string" ||
      typeof f.answer !== "string" ||
      f.label.length === 0 ||
      f.label.length > FAQ_MAX_LABEL ||
      (f.msg.length === 0 && f.answer.length === 0) ||
      f.answer.length > FAQ_MAX_ANSWER
    ) {
      return null;
    }
  }
  return JSON.stringify(v);
}

async function handleAgentUpdate(request: Request, agentId: string, env: Env) {
  const origin = request.headers.get("Origin") || "*";
  const user = await resolveUser(request, env);
  if (!user) return json({ error: "No autorizado" }, 403, origin);

  // Puede dejarse vacío el body para invalidar SOLO la cache (`PUT` con {}).
  // Cuando hay campo `faqs`: valida estructura + re-cachea con los datos nuevos.
  const existing = await env.DB.prepare("SELECT id FROM agents WHERE id = ? AND user_id = ?")
    .bind(agentId, user.id)
    .first<{ id: string }>();
  if (!existing) return json({ error: "Agente no existe" }, 404, origin);

  const body: unknown = await request.json().catch(() => ({}));
  let updates: [string, unknown][] = [];
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    // Marca blanca (logo de burbuja) y BYOK: gates por plan, mismo patrón.
    const setsBubble = "bubble_logo_url" in b && b.bubble_logo_url != null;
    const setsByok = ("mode" in b && b.mode === "byok") || ("byok_provider" in b && b.byok_provider != null);
    if (setsBubble || setsByok) {
      const owner = await env.DB.prepare(
        "SELECT u.plan FROM users u JOIN agents a ON a.user_id = u.id WHERE a.id = ?"
      )
        .bind(agentId)
        .first<{ plan: string | null }>();
      const plan = owner?.plan ?? "free";
      if (setsBubble && plan !== "agency") {
        return json({ error: "El logo de burbuja (marca blanca) es exclusivo del plan Agency" }, 403, origin);
      }
      if (setsByok && plan === "free") {
        return json({ error: "BYOK (tu propia API key) está disponible desde el plan Starter" }, 403, origin);
      }
    }
    for (const key of Object.keys(EDITABLE_FIELDS)) {
      if (!(key in b)) continue;
      const def = EDITABLE_FIELDS[key];
      const value = def.validate(b[key]);
      if (def.allowNull && b[key] === null) {
        updates.push([def.column, null]);
        continue;
      }
      if (value === null) {
        return json({ error: `Campo inválido: ${key}` }, 400, origin);
      }
      if (def.column === "chat_api_key" && typeof value === "string" && value) {
        updates.push([def.column, await encryptSecret(value, env)]);
        continue;
      }
      updates.push([def.column, value]);
    }
    if ("faqs" in b) {
      const faqsJson = validateFaqs(b.faqs);
      if (faqsJson === null) return json({ error: "Campo inválido: faqs" }, 400, origin);
      updates.push(["faqs", faqsJson]);
    }
  }

  if (updates.length > 0) {
    const setClause = updates.map(([col]) => `${col} = ?`).join(", ");
    await env.DB.prepare(`UPDATE agents SET ${setClause} WHERE id = ?`)
      .bind(...updates.map(([, v]) => v), agentId)
      .run();
  }

  // Las FAQs cambiaron: los embeddings cacheados quedan obsoletos, se reconstruyen
  // con el siguiente intento de matching semántico.
  if (updates.some(([col]) => col === "faqs")) {
    await env.AGENT_CACHE.delete(`faqvec:${agentId}`);
  }

  // 🔑 Invalidar la cache KV (TTL 1h) — el próximo chat lee la config nueva de D1
  await env.AGENT_CACHE.delete(`agent:${agentId}`);
  // Recachear al instante la config validada para no dejar la llave fría
  await getAgent(agentId, env);

  return json({ ok: true, updated: updates.map(([col]) => col) }, 200, origin);
}

async function handleOverview(request: Request, agentId: string, env: Env) {
  const origin = request.headers.get("Origin") || "*";
  const user = await resolveUser(request, env);
  if (!user) return json({ error: "No autorizado" }, 403, origin);
  // Solo el dueño de cada agente lee sus métricas; el resto de la API es público a propósito.
  const agent = await env.DB.prepare("SELECT * FROM agents WHERE id = ? AND user_id = ?")
    .bind(agentId, user.id)
    .first<AgentRow>();
  if (!agent) return json({ error: "Agente no existe" }, 404, origin);

  // Contadores O(1): una lectura de PK en `agent_stats` en vez de dos COUNT(*).
  // Medido antes: 39 filas para contar conversaciones y 424 para contar mensajes,
  // porque el JOIN obligaba a recorrer `messages` buscando su conversacion una
  // por una. Los triggers de 0007 mantienen los dos valores exactos.
  const [stats, recentRes, faqHitsRes] = await env.DB.batch([
    env.DB.prepare("SELECT conversations, messages FROM agent_stats WHERE agent_id = ?").bind(agentId),
    // `idx_conversations_recent` evita que esto lea y ordene todas las
    // conversaciones del agente para quedarse con 5.
    env.DB.prepare(
      "SELECT session_id, updated_at FROM conversations WHERE agent_id = ? ORDER BY updated_at DESC LIMIT 5"
    ).bind(agentId),
    env.DB.prepare("SELECT faq_label, hits FROM faq_hits WHERE agent_id = ? ORDER BY hits DESC").bind(agentId),
  ]);

  const agentStats = stats.results?.[0] as { conversations?: number; messages?: number } | undefined;
  const convosTotal = agentStats?.conversations ?? 0;
  const msgsTotal = agentStats?.messages ?? 0;
  const recent =
    (recentRes.results as { session_id: string; updated_at: string }[] | undefined)?.map((r) => ({
      session_id: r.session_id,
      updated_at: r.updated_at,
    })) || [];
  const hitsByLabel = new Map(
    (faqHitsRes.results as { faq_label: string; hits: number }[] | undefined)?.map((h) => [h.faq_label, h.hits])
  );

  const quota = await env.DB.prepare("SELECT messages_limit, messages_used, plan, plan_expires_at FROM users WHERE id = ?")
    .bind(agent.user_id)
    .first<{ messages_limit: number | null; messages_used: number; plan: string | null; plan_expires_at: string | null }>();

  return json(
    {
      id: agent.id,
      conversations_total: Number(convosTotal),
      messages_total: Number(msgsTotal),
      messages_used: Number(quota?.messages_used) || 0,
      messages_limit: effectiveMessagesLimit(quota),
      recent,
      faqs: getFaqs(agent).map((f) => ({ label: f.label, hits: hitsByLabel.get(f.label) || 0 })),
    },
    200,
    origin
  );
}

// ── Analíticas (V1): ventanas de 7/30/90 días con delta vs período anterior ──
// Gate: plan Starter+ (mismo criterio que BYOK). Free recibe 403 plan_required
// y el panel pinta el muro de mejora de plan.
async function handleAnalytics(request: Request, agentId: string, env: Env) {
  const origin = request.headers.get("Origin") || "*";
  const user = await resolveUser(request, env);
  if (!user) return json({ error: "No autorizado" }, 403, origin);
  // El panel reconsulta al entrar y al cambiar de rango: 30/min por dueño evita
  // martillar D1 (mismo bucket in-memory que el chat; 429 si se pasa).
  if (isRateLimited(`analytics:${user.id}`, 30)) {
    return json({ error: "Demasiadas consultas de analítica, esperá un minuto" }, 429, origin);
  }
  const agent = await env.DB.prepare("SELECT id FROM agents WHERE id = ? AND user_id = ?")
    .bind(agentId, user.id)
    .first<{ id: string }>();
  if (!agent) return json({ error: "Agente no existe" }, 404, origin);

  const account = await env.DB.prepare("SELECT plan, plan_expires_at FROM users WHERE id = ?")
    .bind(user.id)
    .first<{ plan: string | null; plan_expires_at: string | null }>();
  if (effectivePlan(account) === "free") {
    return json(
      { error: "Analíticas disponible desde el plan Starter", code: "plan_required", plan_required: "starter" },
      403,
      origin
    );
  }

  const url = new URL(request.url);
  const reqDays = Number(url.searchParams.get("days"));
  const days = reqDays === 7 || reqDays === 90 ? reqDays : 30;
  // Offset horario del cliente en minutos (getTimezoneOffset negado; Caracas = -240).
  // Días y horas se agrupan en LOCAL del dueño; las ventanas se recortan con el
  // instante UTC exacto para que los índices de fecha sigan sirviendo (no se
  // envuelve la columna en date()/tz(), que rompe el rango del índice).
  const tzRaw = Number(url.searchParams.get("tz"));
  const tz = Number.isFinite(tzRaw) ? Math.max(-720, Math.min(840, Math.trunc(tzRaw))) : 0;
  const todayLocal = new Date(Date.now() + tz * 60000).toISOString().slice(0, 10);
  // Ventanas exactas de `days` fechas (locales): la actual termina hoy y la
  // anterior son las mismas `days` fechas inmediatamente anteriores.
  const dayBack = (n: number) =>
    new Date(Date.parse(`${todayLocal}T00:00:00Z`) - n * 86400000).toISOString().slice(0, 10);
  const since = dayBack(days - 1);
  const prevSince = dayBack(2 * days - 1);
  const bound = (day: string) =>
    new Date(Date.parse(`${day}T00:00:00Z`) - tz * 60000).toISOString().slice(0, 19).replace("T", " ");
  const sinceB = bound(since);
  const prevB = bound(prevSince);
  // Modificador SQLite: minutos a sumar para leer fecha/hora locales.
  const mod = tz >= 0 ? `+${tz} minutes` : `${tz} minutes`;

  // Caché de 60s por dueño+agente+rango+tz: repetir la misma consulta (recargas,
  // cambiar de pestaña y volver) no toca D1.
  const cacheKey = `analytics:${user.id}:${agentId}:${days}:${tz}`;
  const cached = await env.AGENT_CACHE.get(cacheKey, "json").catch(() => null);
  if (cached) return json(cached, 200, origin);

  // Un escaneo de messages por ventana (rango cubierto por idx_messages_created)
  // alimenta la serie diaria, la hora del día y el heatmap día×hora.
  // ponytail: conversations/leads por día escanean las filas del agente por
  // agent_id (índice de dueño, no de fecha); al volumen actual va bien, si una
  // cuenta se pone grande se agrega (agent_id, created_at).
  const [msgCur, conCur, leadCur, msgPrev, conPrev, leadPrev, statuses, topFaq, faqTotal] = await env.DB.batch([
    env.DB.prepare(
      `SELECT date(m.created_at, ?) AS day, strftime('%H', m.created_at, ?) AS h, COUNT(*) AS n
         FROM messages m JOIN conversations c ON c.id = m.conversation_id
        WHERE c.agent_id = ? AND m.created_at >= ?
        GROUP BY day, h`
    ).bind(mod, mod, agentId, sinceB),
    env.DB.prepare(
      "SELECT date(created_at, ?) AS day, COUNT(*) AS n FROM conversations WHERE agent_id = ? AND created_at >= ? GROUP BY day"
    ).bind(mod, agentId, sinceB),
    env.DB.prepare(
      "SELECT date(created_at, ?) AS day, COUNT(*) AS n FROM leads WHERE agent_id = ? AND created_at >= ? GROUP BY day"
    ).bind(mod, agentId, sinceB),
    env.DB.prepare(
      `SELECT COUNT(*) AS n FROM messages m JOIN conversations c ON c.id = m.conversation_id
        WHERE c.agent_id = ? AND m.created_at >= ? AND m.created_at < ?`
    ).bind(agentId, prevB, sinceB),
    env.DB.prepare(
      "SELECT COUNT(*) AS n FROM conversations WHERE agent_id = ? AND created_at >= ? AND created_at < ?"
    ).bind(agentId, prevB, sinceB),
    env.DB.prepare(
      "SELECT COUNT(*) AS n FROM leads WHERE agent_id = ? AND created_at >= ? AND created_at < ?"
    ).bind(agentId, prevB, sinceB),
    // Estados de los prospectos creados EN la ventana (no el histórico de
    // lead_stats), para que las barras sumen exactamente lo que dice el rótulo.
    env.DB.prepare(
      "SELECT status, COUNT(*) AS n FROM leads WHERE agent_id = ? AND created_at >= ? GROUP BY status"
    ).bind(agentId, sinceB),
    env.DB.prepare("SELECT faq_label AS label, hits FROM faq_hits WHERE agent_id = ? ORDER BY hits DESC LIMIT 7").bind(
      agentId
    ),
    env.DB.prepare("SELECT COALESCE(SUM(hits), 0) AS n FROM faq_hits WHERE agent_id = ?").bind(agentId),
  ]);

  type DayRow = { day: string; n: number };
  const rows = <T>(r: { results?: unknown }): T[] => (r.results as T[] | undefined) ?? [];
  const num = (r: { results?: unknown }): number => Number(rows<{ n: number }>(r)[0]?.n) || 0;

  const msgDay = new Map<string, number>();
  const hourly = new Array<number>(24).fill(0);
  const heat = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  for (const r of rows<{ day: string; h: string; n: number }>(msgCur)) {
    const n = Number(r.n) || 0;
    msgDay.set(r.day, (msgDay.get(r.day) ?? 0) + n);
    const h = Number(r.h);
    if (h >= 0 && h < 24) {
      hourly[h] += n;
      // fecha 'YYYY-MM-DD' leída en UTC → día de la semana estable para todos.
      const wd = new Date(`${r.day}T00:00:00Z`).getUTCDay();
      heat[wd][h] += n;
    }
  }
  const toMap = (rs: DayRow[]) => new Map(rs.map((r) => [r.day, Number(r.n) || 0]));
  const conDay = toMap(rows<DayRow>(conCur));
  const leadDay = toMap(rows<DayRow>(leadCur));

  // Calendario completo de la ventana (sin huecos en la serie), en días locales.
  const dayList: string[] = [];
  let t = Date.parse(`${since}T00:00:00Z`);
  const end = Date.parse(`${todayLocal}T00:00:00Z`);
  while (t <= end && dayList.length < 400) {
    dayList.push(new Date(t).toISOString().slice(0, 10));
    t += 86400000;
  }

  const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);
  const msgTotal = sum(msgDay);
  const conTotal = sum(conDay);
  const leadTotal = sum(leadDay);
  const msgPrevN = num(msgPrev);
  const conPrevN = num(conPrev);
  const leadPrevN = num(leadPrev);
  const delta = (cur: number, prev: number): number | null =>
    prev > 0 ? Math.round(((cur - prev) / prev) * 100) : cur > 0 ? null : 0;
  const conv = (leads: number, sessions: number) => (sessions > 0 ? Math.round((leads / sessions) * 1000) / 10 : 0);
  const avg = (m: number, s: number) => (s > 0 ? Math.round((m / s) * 10) / 10 : 0);

  const body = {
    days: dayList,
    since,
    daily: dayList.map((day) => ({
      day,
      messages: msgDay.get(day) ?? 0,
      conversations: conDay.get(day) ?? 0,
      leads: leadDay.get(day) ?? 0,
    })),
    hourly,
    heat, // [0=domingo .. 6=sábado][hora]
    kpis: {
      sessions: { value: conTotal, delta: delta(conTotal, conPrevN) },
      messages: { value: msgTotal, delta: delta(msgTotal, msgPrevN) },
      per_session: {
        value: avg(msgTotal, conTotal),
        delta: delta(Math.round(avg(msgTotal, conTotal) * 10), Math.round(avg(msgPrevN, conPrevN) * 10)),
      },
      leads: { value: leadTotal, delta: delta(leadTotal, leadPrevN) },
      conversion: {
        value: conv(leadTotal, conTotal),
        // delta en PUNTOS porcentuales, no en % relativo.
        delta: Math.round((conv(leadTotal, conTotal) - conv(leadPrevN, conPrevN)) * 10) / 10,
      },
      // Histórico: faq_hits no guarda fecha, no hay período anterior que comparar.
      faq_auto: { value: num(faqTotal), delta: null },
    },
    lead_statuses: rows<{ status: string; n: number }>(statuses),
    top_faqs: rows<{ label: string; hits: number }>(topFaq),
  };
  await env.AGENT_CACHE.put(cacheKey, JSON.stringify(body), { expirationTtl: 60 }).catch(() => {});
  return json(body, 200, origin);
}

// ── Prospectos (leads): listar y actualizar estado ─────────────────────────────
const LEAD_STATUSES = ["Nuevo", "Contactado", "Calificado", "Convertido", "Archivado"];

// Columnas del prospecto para el listado y el sondeo en vivo. `last_activity` es
// un subquery correlacionado (indice idx_leads_session cubre el agent_id/session_id)
// que corre UNA VEZ POR FILA DEVUELTA, no por fila de la tabla: por eso importa que
// el listado devuelva solo la pagina pedida.
const LEAD_COLUMNS = `l.id, l.name, l.email, l.phone, l.notes, l.interest, l.session_id,
       l.status, l.created_at, l.updated_at,
       (SELECT m.created_at FROM messages m
        JOIN conversations c ON c.id = m.conversation_id
        WHERE c.agent_id = l.agent_id AND c.session_id = l.session_id
        ORDER BY m.created_at DESC LIMIT 1) AS last_activity`;

type LeadRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  interest: string | null;
  session_id: string | null;
  status: string;
  created_at: string;
  updated_at: string | null;
  last_activity: string | null;
};

async function handleLeadList(request: Request, agentId: string, env: Env) {
  const origin = request.headers.get("Origin") || "*";
  const user = await resolveUser(request, env);
  if (!user) return json({ error: "No autorizado" }, 403, origin);
  const owned = await env.DB.prepare("SELECT id FROM agents WHERE id = ? AND user_id = ?")
    .bind(agentId, user.id)
    .first<{ id: string }>();
  if (!owned) return json({ error: "Agente no existe" }, 403, origin);
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim().slice(0, 100);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
  // Tope duro de 100 filas por pagina. Antes se aceptaba page_size=100000 para que
  // el panel filtrara en el navegador; D1 factura por filas LEIDAS, asi que esa
  // pagina descargaba la tabla entera del agente en cada refresco y en cada sondeo
  // de 30 s. El filtrado ahora ocurre en SQL (WHERE con indice) y el cliente solo
  // pinta la pagina que pide.
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("page_size") || "10", 10) || 10));
  const statusFilter = (url.searchParams.get("status") || "").trim();
  // whitelist: el orden nunca interpola input del usuario directo
  const SORT_COLS: Record<string, string> = {
    name: "l.name",
    created_at: "l.created_at",
    status: "l.status",
  };
  const sortBy = SORT_COLS[url.searchParams.get("sort_by") || "created_at"] || "l.created_at";
  const sortDir = url.searchParams.get("sort_dir") === "asc" ? "ASC" : "DESC";

  // --- Sondeo en vivo (modo delta) -------------------------------------------------
  // Devuelve SOLO lo creado o modificado despues del cursor. Sin COUNT, sin GROUP BY,
  // sin la pagina de listado: una consulta acotada por idx_leads_agent_updated que
  // devuelve 0 filas si no paso nada. Es lo que se llama cada 30 s, asi que su costo
  // es el unico que importa mantener bajo.
  //
  // `since` se compara como texto porque el formato 'YYYY-MM-DD HH:MM:SS' ordena
  // lexicograficamente igual que cronologicamente. El cursor SIEMPRE lo devuelve el
  // servidor (en modo lista tambien, con strftime para no depender del reloj del
  // navegador). Usar un ISO 8601 del cliente comparandolo contra ese formato daria
  // resultados silenciosamente incorrectos.
  //
  // La comparacion es contra `updated_at` pelado, sin COALESCE ni `OR ... IS NULL`,
  // porque solo asi el indice da un RANGO real: con cualquier otra cosa SQLite cae
  // a `SEARCH ... (agent_id=?)`, que lee todos los leads del agente cada 30 s
  // (verificado con EXPLAIN QUERY PLAN). Eso obliga a que `updated_at` nunca sea
  // NULL, invariante que sostienen la migracion 0004 (backfill), los dos INSERT de
  // leads y los dos UPDATE. Si alguna vez se agrega un INSERT que la olvide, ese
  // prospecto no aparecera en el sondeo en vivo, pero SI en el listado normal y en
  // "Actualizar", que no usan cursor.
  const since = (url.searchParams.get("since") || "").trim().slice(0, 19);
  if (since) {
    const deltaLimit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10) || 50));
    const delta = await env.DB.prepare(
      `SELECT ${LEAD_COLUMNS}
         FROM leads l
        WHERE l.agent_id = ? AND l.updated_at > ?
        ORDER BY l.updated_at ASC
        LIMIT ?`
    )
      .bind(agentId, since, deltaLimit)
      .all<LeadRow>();
    const rows = delta.results ?? [];
    // Cursor siguiente: la marca maxima de lo devuelto. Si una tanda masiva cambia
    // mas filas que deltaLimit, el corte es por tiempo y podrian quedar fuera filas
    // con la MISMA marca que la ultima: el cliente las deduplica por id y el boton
    // "Actualizar" (que no usa cursor) siempre trae el estado exacto.
    const nextCursor = rows.reduce((max, r) => {
      const t = r.updated_at || r.created_at;
      return t > max ? t : max;
    }, since);
    return json({ changed: rows, cursor: nextCursor }, 200, origin);
  }

  // ponytail: los contadores salen de `lead_stats` (migracion 0005), que los
  // triggers de D1 mantienen exacta. Antes cada visita pagaba COUNT(*) + GROUP BY
  // sobre TODOS los leads del agente: ~2N filas leidas. Ahora son ~5 filas por
  // agente, sin importar cuantos leads tenga.
  const where = ["agent_id = ?"];
  const binds: unknown[] = [agentId];
  const statusIsValid = LEAD_STATUSES.includes(statusFilter as (typeof LEAD_STATUSES)[number]);
  // Se declara antes del `if (q)` porque los KPIs se leen en las dos ramas: con
  // busqueda para pintar las pills y el total global, sin busqueda para el total
  // filtrado. Es una lista de {status, c} de ~5 elementos por agente.
  let byStatus: { status: string; c: number }[] = [];
  const countOf = (status: string) => byStatus.find((r) => r.status === status)?.c ?? 0;
  if (statusIsValid) {
    where.push("status = ?");
    binds.push(statusFilter);
  }

  // Busqueda. `LIKE '%texto%'` no puede aprovechar un indice btree porque el
  // comodin inicial mata el prefijo: es un scan de los N leads del agente. FTS5
  // con tokenizer trigram si lo indexa. Se consulta con `all_text LIKE ?` y no
  // con MATCH a proposito: MATCH matchea tokens y devuelve mas filas de las que
  // el usuario estaba viendo con LIKE (medido: 14 resultados donde LIKE daba 1).
  // Los triggers 0005 mantienen el indice sincronizado en cada escritura.
  //
  // ponytail: el tokenizer trigram solo indexa terminos de 3 caracteres o mas,
  // asi que parabusquedas de 1-2 caracteres se cae a LIKE, que para un termino
  // tan corto no tiene el problema de selectividad que obliga a indexar.
  const useFts = q.length >= 3;
  const like = `%${q}%`;
  const searchWhere = (col: string) => (useFts ? `f.all_text LIKE ?` : `${col} LIKE ?`);

  // Con busqueda el total sigue siendo un COUNT: FTS acota los candidatos pero
  // "cuantos coinciden" hay que contarlos. Sin busqueda el total sale de
  // `lead_stats`, o sea cero filas leidas.
  let total: number;
  let listSql: string;
  let listBinds: unknown[];

  if (q) {
    const cols = ["name", "email", "phone", "notes", "interest", "status"];
    const or = cols.map((c) => searchWhere(`l.${c}`)).join(" OR ");
    // El OR tiene tantos `?` como columnas, y eso incluye el caso FTS donde las
    // seis se reducen a la MISMA columna: un solo bind daria "datatype mismatch"
    // y la busqueda devolveria error, no un resultado vacio. Por eso son N binds
    // en ambos casos, y solo cambia a que columna apuntan.
    const searchBinds = cols.map(() => like);
    const from = useFts
      ? `FROM leads l JOIN leads_fts f ON f.lead_id = l.id WHERE l.agent_id = ?`
      : `FROM leads l WHERE l.agent_id = ?`;
    listBinds = [agentId, ...searchBinds, ...binds.slice(1), pageSize, (page - 1) * pageSize];
    listSql = `SELECT ${LEAD_COLUMNS} ${from} AND (${or})${
      statusIsValid ? " AND l.status = ?" : ""
    } ORDER BY ${sortBy} ${sortDir}, l.created_at DESC LIMIT ? OFFSET ?`;
    const totalRow = await env.DB.prepare(
      `SELECT COUNT(*) AS c ${from} AND (${or})${statusIsValid ? " AND l.status = ?" : ""}`
    )
      .bind(agentId, ...searchBinds, ...binds.slice(1))
      .first<{ c: number }>();
    total = Number(totalRow?.c) || 0;
  } else {
    listBinds = [...binds, pageSize, (page - 1) * pageSize];
    listSql = `SELECT ${LEAD_COLUMNS} FROM leads l WHERE ${where.join(
      " AND "
    )} ORDER BY ${sortBy} ${sortDir}, l.created_at DESC LIMIT ? OFFSET ?`;
    // Sin busqueda el total es el contador cacheado: si hay filtro de estado sale
    // de esa fila de `lead_stats`, y si no, de la suma de las ~5 filas del agente.
    const statsRows = await env.DB.prepare("SELECT status, n FROM lead_stats WHERE agent_id = ?")
      .bind(agentId)
      .all<{ status: string; n: number }>();
    byStatus = (statsRows.results ?? []).map((r) => ({ status: r.status, c: Number(r.n) || 0 }));
    total = statusIsValid ? countOf(statusFilter) : byStatus.reduce((s, r) => s + r.c, 0);
  }

  // Los KPIs por estado y el total global salen siempre de `lead_stats`, nunca de
  // un GROUP BY sobre `leads`. Con busqueda activa se lee aqui, una sola vez y
  // compartido por el KPI y por `allTotal`; sin busqueda ya se leyo arriba, y por
  // eso esto va antes del SELECT de la pagina para no encadenar tres esperas.
  if (q) {
    const statsRows = await env.DB.prepare("SELECT status, n FROM lead_stats WHERE agent_id = ?")
      .bind(agentId)
      .all<{ status: string; n: number }>();
    byStatus = (statsRows.results ?? []).map((r) => ({ status: r.status, c: Number(r.n) || 0 }));
  }

  const { results } = await env.DB.prepare(listSql).bind(...listBinds).all<LeadRow>();

  // Cursor inicial del sondeo en vivo, generado por el servidor en el mismo formato
  // que escribe D1. Asi el cliente nunca tiene que convertir una fecha su propia.
  // ponytail: `strftime` no lee filas, asi que va aparte en lugar de pegarse al
  // SELECT de la pagina. Si D1 lo hiciera facturable seria una fila por visita.
  const clock = await env.DB.prepare("SELECT strftime('%Y-%m-%d %H:%M:%S','now') AS now")
    .first<{ now: string }>();

  return json(
    {
      leads: results ?? [],
      total,
      // Suma de `byStatus`, que viene sin filtros: el total real del agente. Se
      // calcula de las rows ya leidas de `lead_stats`, no es un COUNT extra.
      allTotal: byStatus.reduce((sum, r) => sum + r.c, 0),
      cursor: clock?.now ?? "",
      stats: {
        nuevo: countOf("Nuevo"),
        contactado: countOf("Contactado"),
        calificado: countOf("Calificado"),
        convertido: countOf("Convertido"),
        archivado: countOf("Archivado"),
      },
    },
    200,
    origin
  );
}

async function handleLeadStatus(request: Request, leadId: string, env: Env) {
  const origin = request.headers.get("Origin") || "*";
  const user = await resolveUser(request, env);
  if (!user) return json({ error: "No autorizado" }, 403, origin);
  const body = (await request.json().catch(() => ({}))) as { status?: unknown; notes?: unknown };
  const sets: string[] = [];
  const binds: unknown[] = [];
  if (body.status !== undefined) {
    const status = body.status;
    if (typeof status !== "string" || !LEAD_STATUSES.includes(status)) {
      return json({ error: `Estado inválido. Válidos: ${LEAD_STATUSES.join(", ")}` }, 400, origin);
    }
    sets.push("status = ?");
    binds.push(status);
  }
  if (body.notes !== undefined) {
    const notes = body.notes;
    if (notes !== null && typeof notes !== "string") {
      return json({ error: "Nota inválida. Debe ser texto." }, 400, origin);
    }
    sets.push("notes = ?");
    binds.push(notes);
  }
  if (sets.length === 0) return json({ error: "Nada para actualizar." }, 400, origin);
  // Marca de cambio para el sondeo en vivo. Sin esto un prospecto que pasa de
  // "Nuevo" a "Contactado" es invisible para el delta, que solo veria altas.
  // Fragmento literal, no bind: no viene del cliente.
  sets.push("updated_at = CURRENT_TIMESTAMP");
  binds.push(leadId, user.id);
  await env.DB.prepare(
    `UPDATE leads SET ${sets.join(", ")} WHERE id = ?
     AND agent_id IN (SELECT id FROM agents WHERE user_id = ?)`
  ).bind(...binds).run();
  return json({ ok: true }, 200, origin);
}

async function handleLeadDelete(request: Request, leadId: string, env: Env) {
  const origin = request.headers.get("Origin") || "*";
  const user = await resolveUser(request, env);
  if (!user) return json({ error: "No autorizado" }, 403, origin);
  await env.DB.prepare(
    "DELETE FROM leads WHERE id = ? AND agent_id IN (SELECT id FROM agents WHERE user_id = ?)"
  ).bind(leadId, user.id).run();
  return json({ ok: true }, 200, origin);
}

async function handleLeadHistory(request: Request, agentId: string, env: Env) {
  const origin = request.headers.get("Origin") || "*";
  const user = await resolveUser(request, env);
  if (!user) return json({ error: "No autorizado" }, 403, origin);
  const owned = await env.DB.prepare("SELECT id FROM agents WHERE id = ? AND user_id = ?")
    .bind(agentId, user.id)
    .first<{ id: string }>();
  if (!owned) return json({ error: "Agente no existe" }, 403, origin);
  const sessionId = new URL(request.url).searchParams.get("session_id") || "anon";
  const convo = await env.DB.prepare(
    "SELECT id FROM conversations WHERE agent_id = ? AND session_id = ?"
  )
    .bind(agentId, sessionId)
    .first<{ id: string }>();
  if (!convo) return json({ messages: [], last_activity: null }, 200, origin);
  const { results } = await env.DB.prepare(
    "SELECT role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC"
  )
    .bind(convo.id)
    .all<{ role: "user" | "assistant"; content: string; created_at: string }>();
  return json(
    { messages: results ?? [], last_activity: results?.[results.length - 1]?.created_at ?? null },
    200,
    origin
  );
}

async function handleLeadHistoryDelete(request: Request, agentId: string, env: Env) {
  const origin = request.headers.get("Origin") || "*";
  const user = await resolveUser(request, env);
  if (!user) return json({ error: "No autorizado" }, 403, origin);
  // Mismo filtro que la lectura: solo el dueno del agente borra su historial.
  const owned = await env.DB.prepare("SELECT id FROM agents WHERE id = ? AND user_id = ?")
    .bind(agentId, user.id)
    .first<{ id: string }>();
  if (!owned) return json({ error: "Agente no existe" }, 403, origin);
  const sessionId = new URL(request.url).searchParams.get("session_id");
  if (!sessionId) return json({ error: "Falta session_id" }, 400, origin);
  const convo = await env.DB.prepare(
    "SELECT id FROM conversations WHERE agent_id = ? AND session_id = ?"
  )
    .bind(agentId, sessionId)
    .first<{ id: string }>();
  if (!convo) return json({ error: "La conversacion no existe" }, 404, origin);

  // Se cuenta antes porque el CASCADE ocurre en la misma sentencia.
  const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM messages WHERE conversation_id = ?")
    .bind(convo.id)
    .first<{ n: number }>();
  await env.DB.prepare("DELETE FROM conversations WHERE id = ?").bind(convo.id).run();
  // `conversations` es 1 y no `meta.changes`: D1 devuelve 4 en este caso porque
  // ese numero tambien suma las filas que tocaron los triggers y el CASCADE.
  // Aqui el WHERE es una PK que acabamos de comprobar que existe, asi que la
  // conversacion borrada es exactamente una.
  return json({ deleted: { conversations: 1, messages: Number(n?.n) || 0 } }, 200, origin);
}

async function handleLeadBulk(request: Request, env: Env) {
  const origin = request.headers.get("Origin") || "*";
  const user = await resolveUser(request, env);
  if (!user) return json({ error: "No autorizado" }, 403, origin);
  const body = (await request.json().catch(() => ({}))) as { ids?: unknown; action?: unknown; status?: unknown };
  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string") : [];
  if (ids.length === 0 || ids.length > 100) {
    return json({ error: "ids inválidos (máx. 100)" }, 400, origin);
  }
  const placeholders = ids.map(() => "?").join(",");
  if (body.action === "delete") {
    await env.DB.prepare(
      `DELETE FROM leads WHERE id IN (${placeholders})
       AND agent_id IN (SELECT id FROM agents WHERE user_id = ?)`
    ).bind(...ids, user.id).run();
    return json({ ok: true, deleted: ids.length }, 200, origin);
  }
  if (body.action === "status") {
    const status = body.status;
    if (typeof status !== "string" || !LEAD_STATUSES.includes(status)) {
      return json({ error: `Estado inválido. Válidos: ${LEAD_STATUSES.join(", ")}` }, 400, origin);
    }
    await env.DB.prepare(
      `UPDATE leads SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})
       AND agent_id IN (SELECT id FROM agents WHERE user_id = ?)`
    ).bind(status, ...ids, user.id).run();
    return json({ ok: true, status }, 200, origin);
  }
  return json({ error: "Acción inválida. Válidas: delete, status" }, 400, origin);
}

// Público (lo llama el widget): registra el lead del formulario embebido.
async function handleLeadForm(request: Request, env: Env) {
  const origin = request.headers.get("Origin") || "*";
  const body = (await request.json().catch(() => ({}))) as {
    agent_id?: string;
    session_id?: string;
    name?: string;
    email?: string;
    phone?: string;
    interest?: string;
    message?: string;
  };
  if (!body.agent_id || typeof body.session_id !== "string") {
    return json({ error: "agent_id y session_id son obligatorios" }, 400, origin);
  }
  const agent = await getAgent(body.agent_id, env);
  if (!agent) return json({ error: "Agente no existe" }, 404, origin);
  if (agent.lead_capture === 0) return json({ error: "Captura desactivada" }, 409, origin);
  if (env.ENVIRONMENT !== "development" && !domainAllowed(agent, origin)) {
    return json({ error: "Dominio no autorizado" }, 403, origin);
  }
  const clientKey = `${body.agent_id}:form:${request.headers.get("CF-Connecting-IP") || "unknown"}`;
  if (isRateLimited(clientKey, 10)) {
    return json({ error: "Demasiadas solicitudes. Intenta en un minuto." }, 429, origin);
  }

  const fields = (agent.lead_fields || DEFAULT_LEAD_FIELDS).split(",").map((f) => f.trim());
  const clean = (v?: string) => (typeof v === "string" ? v.trim().slice(0, 120) : "");
  const name = fields.includes("name") ? clean(body.name) : "";
  const email = fields.includes("email") ? clean(body.email).toLowerCase() : "";
  const phone = fields.includes("phone") ? clean(body.phone) : "";
  if (!email && !phone) return json({ error: "Email o teléfono son obligatorios" }, 400, origin);
  if (email && !EMAIL_RE.test(email)) return json({ error: "Email inválido" }, 400, origin);
  if (phone && phone.replace(/\D/g, "").length < 6) return json({ error: "Teléfono inválido" }, 400, origin);

  const dupKey = email || phone;
  const dup = await env.DB.prepare(
    email
      ? "SELECT id FROM leads WHERE agent_id = ? AND email = ?"
      : "SELECT id FROM leads WHERE agent_id = ? AND phone = ?"
  )
    .bind(agent.id, dupKey)
    .first<{ id: string }>();
  if (dup) return json({ ok: true, duplicate: true }, 200, origin);

  try {
    await env.DB.prepare(
      `INSERT INTO leads (id, agent_id, name, email, phone, notes, interest, session_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    )
      .bind(
        crypto.randomUUID(),
        agent.id,
        name || null,
        email || null,
        phone || null,
        null, // notes: reservada para la nota interna del dueño
        (body.interest || body.message || "").trim().slice(0, 300) || "📋 Contacto capturado por formulario",
        body.session_id
      )
      .run();
    try {
      await sendWebhook(env, agent.user_id, `📋 Nuevo contacto por formulario:\n${name} ${email} ${phone}`.trim());
    } catch {
      /* best-effort */
    }
  } catch {
    return json({ error: "No se pudo guardar el contacto" }, 500, origin);
  }
  return json({ ok: true }, 201, origin);
}

// ── Multi-agente: listar y crear ────────────────────────────────────────────────
// Cupos por defecto de cada plan. `agent_limit` en la tabla users puede sobreescribir
// los agentes (NULL = sigue el plan); `messages_limit` ya es por-usuario y editable.
export const PLAN_DEFAULTS: Record<string, { agents: number; messages: number }> = {
  free: { agents: 1, messages: 20 },
  starter: { agents: 1, messages: 1500 },
  pro: { agents: 3, messages: 6000 },
  agency: { agents: 8, messages: 25000 },
};

type OwnerRow = { email: string | null; name: string | null; plan: string | null; agent_limit: number | null; messages_limit: number | null; messages_used: number | null; plan_expires_at: string | null };

// Vigencia de un plan: 1 mes. La renovación la hace el dueño a mano cuando
// cobra, así que el sistema solo arranca el reloj, nunca lo extiende solo.
const PLAN_PERIOD_MONTHS = 1;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// Fecha de vencimiento de un período de `months` que arranca en `from`, en UTC
// y como 'YYYY-MM-DD'. Aritmética de calendario, no "+30 días": una cuenta
// creada el 31-ene con un mes de plan vence el 28/29-feb, no el 2-mar (que es
// lo que devuelve un setMonth sin clamp, porque feb no tiene día 31). Todo en
// UTC para que el string no cambie de día según la zona horaria del que lo lee.
function periodEnd(from: Date = new Date(), months: number = PLAN_PERIOD_MONTHS): string {
  const d = new Date(from);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d.toISOString().slice(0, 10);
}

function planDefaults(plan: string | null | undefined) {
  return PLAN_DEFAULTS[plan ?? ""] ?? PLAN_DEFAULTS.free;
}

// Un plan vencido equivale a free, y esto es el UNICO lugar que lo decide.
//
// Se aplica en el momento de calcular los limites, no solo en el cron: si el
// cron se atrasa o no corre, el cliente sigue sin poder pasarse de los cupos de
// free. El cron despues reescribe `plan` en la base para que el panel y el
// historial/account digan la verdad, pero la regla de paso esta aqui.
//
// Los agentes ya creados NO se tocan al vencer (el due�o eligio que siguieran
// respondiendo en la web de sus clientes); lo que se limita son los mensajes y
// la creacion de agentes nuevos.
function effectivePlan(user: { plan: string | null; plan_expires_at: string | null } | null | undefined): string {
  const plan = user?.plan ?? "free";
  if (plan === "free" || plan === "starter") return plan;
  const exp = user?.plan_expires_at;
  if (exp && exp < todayIso()) return "free";
  return plan;
}

function isExpired(user: { plan_expires_at: string | null } | null | undefined): boolean {
  const exp = user?.plan_expires_at;
  return Boolean(exp && exp < todayIso());
}

function effectiveAgentLimit(user: { plan: string | null; agent_limit: number | null; plan_expires_at: string | null } | null | undefined) {
  if (user?.agent_limit != null) return user.agent_limit;
  return planDefaults(effectivePlan(user)).agents;
}

function effectiveMessagesLimit(user: { plan: string | null; messages_limit: number | null; plan_expires_at: string | null } | null | undefined) {
  if (user?.messages_limit != null) return user.messages_limit;
  return planDefaults(effectivePlan(user)).messages;
}

async function resolveOwnerId(env: Env): Promise<string | null> {
  if (env.OWNER_USER_ID) return env.OWNER_USER_ID;
  // Antes era "el primer agente de la tabla": el orden es arbitrario, así que el
  // panel caía en la cuenta de cualquiera. El dueño es el marcado como admin.
  const admin = await env.DB.prepare(
    'SELECT u.id FROM users u JOIN "user" b ON b.id = u.id WHERE b.role = \'admin\' LIMIT 1'
  ).first<{ id: string }>();
  if (admin) return admin.id;
  const row = await env.DB.prepare("SELECT user_id FROM agents LIMIT 1").first<{ user_id: string }>();
  return row?.user_id ?? null;
}

async function handleAgentList(request: Request, env: Env) {
  const origin = request.headers.get("Origin") || "*";
  const user = await resolveUser(request, env);
  if (!user) return json({ error: "No autorizado" }, 403, origin);

  const { results } = await env.DB.prepare(
    "SELECT id, name, is_active FROM agents WHERE user_id = ? ORDER BY created_at ASC"
  ).bind(user.id).all();

  const owner = await env.DB.prepare(
    `SELECT email, name, plan, agent_limit, messages_limit, messages_used, plan_expires_at, downgraded_from, expiry_notice_at,
       (SELECT json_group_array(json_object('month', month, 'messages', messages))
          FROM (SELECT month, messages FROM usage_history WHERE user_id = users.id ORDER BY month DESC LIMIT 6)) AS usage_history
     FROM users WHERE id = ?`
  )
    .bind(user.id)
    .first<
      OwnerRow & { downgraded_from: string | null; expiry_notice_at: string | null; usage_history: string | null }
    >();

  // `expiry_notice` viaja ya resuelto para que el panel no repita la regla de
  // "vencio" ni la comparacion de fechas: el cliente solo muestra u oculta el
  // modal. Requiere las tres cosas para ser justo: que un plan pagado haya
  // vencido, que el cron lo haya bajado, y que el cliente no lo haya cerrado
  // ya (si lo cerro, no vuelve a aparecer hasta el proximo vencimiento).
  const showExpiryNotice =
    Boolean(owner?.downgraded_from) && isExpired(owner) && !owner?.expiry_notice_at;

  return json(
    {
      owner: {
        // El propio id: el panel lo usa para pedir su historial en
        // /api/admin/users/:id/events sin saberlo de antemano.
        id: user.id,
        name: owner?.name ?? null,
        email: owner?.email ?? null,
        plan: owner?.plan ?? null,
        role: user.role,
        agent_limit: effectiveAgentLimit(owner),
        messages_limit: effectiveMessagesLimit(owner),
        messages_used: Number(owner?.messages_used) || 0,
        plan_expires_at: owner?.plan_expires_at ?? null,
        // De que plan se cay�: el modal dice "vencio tu plan Pro", no algo
        // genérico. Va aparte de `plan` porque ese ya quedó en free.
        downgraded_from: owner?.downgraded_from ?? null,
        show_expiry_notice: showExpiryNotice,
        support_whatsapp: env.SUPPORT_WHATSAPP ?? null,
        // Orden del subquery (DESC): el panel lo pinta tal cual.
        usage_history: JSON.parse(owner?.usage_history ?? "[]"),
      },
      plan_defaults: PLAN_DEFAULTS,
      agents: results ?? [],
    },
    200,
    origin
  );
}

async function handleAgentCreate(request: Request, env: Env) {
  const origin = request.headers.get("Origin") || "*";
  const user = await resolveUser(request, env);
  if (!user) return json({ error: "No autorizado" }, 403, origin);

  const body = await request.json().catch(() => ({}));
  const name = typeof (body as Record<string, unknown>)?.name === "string"
    ? ((body as Record<string, unknown>).name as string).trim()
    : "";
  if (!name || name.length > 60) return json({ error: "Campo inválido: name" }, 400, origin);

  const duplicate = await env.DB.prepare("SELECT id FROM agents WHERE user_id = ? AND LOWER(name) = LOWER(?)")
    .bind(user.id, name)
    .first<{ id: string }>();
  if (duplicate) return json({ error: `Ya tienes un agente llamado "${name}". Elige otro nombre.` }, 409, origin);

  const owner = await env.DB.prepare("SELECT plan, agent_limit, plan_expires_at FROM users WHERE id = ?")
    .bind(user.id)
    .first<{ plan: string | null; agent_limit: number | null; plan_expires_at: string | null }>();
  const limit = effectiveAgentLimit(owner);
  const countRow = await env.DB.prepare("SELECT COUNT(*) AS total FROM agents WHERE user_id = ?").bind(user.id).first<{ total: number }>();
  if ((Number(countRow?.total) || 0) >= limit) {
    return json({ error: `Alcanzaste el límite de tu plan (${limit} agente${limit === 1 ? "" : "s"}). Sube de plan para crear más.` }, 402, origin);
  }

  const id = crypto.randomUUID();
  const defaultPrompt = "";
  const defaultWelcome = `Soy el asistente virtual de ${name}. ¿En qué te puedo colaborar hoy?`;
  await env.DB.prepare(
    "INSERT INTO agents (id, user_id, name, header_title, system_prompt, welcome_message, mode, chat_provider, chat_model, lead_fields) VALUES (?, ?, ?, ?, ?, ?, 'managed', 'workers-ai', ?, ?)"
  ).bind(id, user.id, name, name, defaultPrompt, defaultWelcome, DEFAULT_MODEL_FAST, DEFAULT_LEAD_FIELDS).run();

  return json({ ok: true, id }, 200, origin);
}

// Eliminar un agente y sus datos relacionados. No permite quedarse sin agentes.
async function handleAgentDelete(request: Request, agentId: string, env: Env) {
  const origin = request.headers.get("Origin") || "*";
  const user = await resolveUser(request, env);
  if (!user) return json({ error: "No autorizado" }, 403, origin);

  const agent = await env.DB.prepare("SELECT id FROM agents WHERE id = ? AND user_id = ?")
    .bind(agentId, user.id)
    .first<{ id: string }>();
  if (!agent) return json({ error: "Agente no existe" }, 404, origin);

  const countRow = await env.DB.prepare("SELECT COUNT(*) AS total FROM agents WHERE user_id = ?").bind(user.id).first<{ total: number }>();
  if ((Number(countRow?.total) || 0) <= 1) {
    return json({ error: "No puedes eliminar tu único agente. Crea otro antes de borrar este." }, 400, origin);
  }

  await env.DB.batch([
    env.DB.prepare("DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE agent_id = ?)").bind(agentId),
    env.DB.prepare("DELETE FROM conversations WHERE agent_id = ?").bind(agentId),
    env.DB.prepare("DELETE FROM leads WHERE agent_id = ?").bind(agentId),
    env.DB.prepare("DELETE FROM faq_hits WHERE agent_id = ?").bind(agentId),
    env.DB.prepare("DELETE FROM agents WHERE id = ? AND user_id = ?").bind(agentId, user.id),
  ]);

  return json({ ok: true }, 200, origin);
}

// Asignar plan y/o editar cupos del dueño. Si cambia el plan, aplica los valores por
// defecto (salvo que el mismo request traiga un override explícito).
// Panel administrativo: listar todas las cuentas con su plan y consumo.
// Solo admin/superadmin. El `user` de Better Auth manda (es el login); las filas
// de `users` sin login se incluyen al final para que no queden invisibles.
// --- Ayuda y Soporte ------------------------------------------------------
// Categorias y estados son listas cerradas y se validan contra el codigo: el
// formulario manda un string, no una clave foranea. Si manana se agrega una
// categoria hay que tocar aca y en SupportModal.tsx.
const SUPPORT_CATEGORIES = ["bug", "pregunta", "facturacion", "widget", "mejora"] as const;
const SUPPORT_STATUSES = ["abierto", "en_curso", "resuelto"] as const;

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

async function handleSupportCreate(request: Request, env: Env) {
  const origin = request.headers.get("Origin") || "*";
  const user = await resolveUser(request, env);
  if (!user) return json({ error: "No autorizado" }, 401, origin);
  // 5 por hora y por cuenta: frena el "se dio vuelta y lo reenvio" sin frenar a
  // nadie que este escribiendo un problema de verdad.
  if (isRateLimited(`support:${user.id}`, 5)) {
    return json(
      { error: "Ya nos escribiste varias veces. Te respondemos en breve, no hace falta insistir." },
      429,
      origin
    );
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const category = clip(body.category, 20);
  const subject = clip(body.subject, 140);
  const message = clip(body.message, 4000);
  if (!(SUPPORT_CATEGORIES as readonly string[]).includes(category)) {
    return json({ error: "Elegí una categoría" }, 400, origin);
  }
  if (subject.length < 4) return json({ error: "Contá el asunto en pocas palabras" }, 400, origin);
  if (message.length < 10) return json({ error: "Contanos un poco más para poder ayudarte" }, 400, origin);

  // Copia de la cuenta (ver 0013): el admin tiene que poder leer el mensaje
  // aunque el cliente borre su cuenta o cambie de correo.
  const acct = await env.DB.prepare("SELECT email, name, plan FROM users WHERE id = ?")
    .bind(user.id)
    .first<{ email: string | null; name: string | null; plan: string | null }>();

  const id = crypto.randomUUID();
  try {
    await env.DB.prepare(
      `INSERT INTO support_tickets
         (id, user_id, user_email, user_name, user_plan, category, subject, message, status, page, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'abierto', ?, ?)`
    )
      .bind(
        id,
        user.id,
        acct?.email ?? null,
        acct?.name ?? null,
        acct?.plan ?? null,
        category,
        subject,
        message,
        clip(body.page, 200) || null,
        clip(request.headers.get("User-Agent"), 300) || null
      )
      .run();
  } catch {
    return json({ error: "No se pudo guardar el mensaje" }, 500, origin);
  }
  return json({ ok: true, id }, 201, origin);
}

async function handleAdminSupport(request: Request, env: Env) {
  const origin = request.headers.get("Origin") || "*";
  const user = await resolveUser(request, env);
  if (!user || !(user.superadmin || user.role === "admin")) {
    return json({ error: "No autorizado" }, 403, origin);
  }

  if (request.method === "PATCH") {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const id = clip(body.id, 64);
    const status = clip(body.status, 20);
    if (!id || !(SUPPORT_STATUSES as readonly string[]).includes(status)) {
      return json({ error: "Datos inválidos" }, 400, origin);
    }
    await env.DB.prepare(
      "UPDATE support_tickets SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?"
    )
      .bind(status, id)
      .run();
    // Se relee en vez de mirar `changes`: 0 filas podria ser "no existe" o
    // "ya estaba asi", y un ok sobre un id inexistente leeria como mentira.
    const row = await env.DB.prepare("SELECT id FROM support_tickets WHERE id = ?")
      .bind(id)
      .first<{ id: string }>();
    if (!row) return json({ error: "Ese mensaje ya no existe" }, 404, origin);
    return json({ ok: true }, 200, origin);
  }

  const userId = (new URL(request.url).searchParams.get("user_id") || "").trim();
  // Sin paginar y con tope de 200: es una bandeja humana (el admin mira el
  // badge de cada cliente y abre un drawer), no un reporte. Si el volumen lo
  // pide, se pagina como en Clientes.
  // `rowid DESC` de desempate: `strftime` da milisegundos, asi que dos mensajes
  // enviados en el mismo milisegundo quedan con la misma fecha y el orden de la
  // bandeja seria el que devuelva D1.
  const stmt = env.DB.prepare(
    `SELECT id, user_id, user_email, user_name, user_plan, category, subject, message, status, page, user_agent, created_at, updated_at
       FROM support_tickets ${userId ? "WHERE user_id = ?" : ""}
      ORDER BY created_at DESC, rowid DESC LIMIT 200`
  );
  const rows = userId ? await stmt.bind(userId).all() : await stmt.all();
  return json({ tickets: rows.results ?? [] }, 200, origin);
}

async function handleAdminUsers(request: Request, env: Env) {
  const origin = request.headers.get("Origin") || "*";
  const user = await resolveUser(request, env);
  if (!user || !(user.superadmin || user.role === "admin")) {
    return json({ error: "No autorizado" }, 403, origin);
  }

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
  // Tope duro de 100, igual que en prospectos: `page_size` nunca descarga la
  // tabla entera para que el navegador filtre.
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("page_size") || "10", 10) || 10));
  const planFilter = (url.searchParams.get("plan") || "").trim();
  const expiryFilter = url.searchParams.get("expiring") === "1";

  type Row = {
    id: string;
    login_email: string | null;
    role: string | null;
    name: string | null;
    plan: string | null;
    agent_limit: number | null;
    messages_limit: number | null;
    messages_used: number | null;
    plan_expires_at: string | null;
    downgraded_from: string | null;
    expiry_notice_at: string | null;
    has_telegram: number | null;
    has_webhook: number | null;
    agents: number;
    agent_names: string | null;
    // Better Auth guarda createdAt como INTEGER en milisegundos, no como texto.
    created: string | number | null;
  };

  // Antes esto era un solo SELECT con `UNION ALL` y `ORDER BY orphan, created
  // DESC`, que D1 resolvia con TEMP B-TREE: ordenaba en memoria TODOS los
  // clientes en cada visita (51.63 ms con 10.000 usuarios) y los devolvia todos
  // al navegador. El indice de 0006 no lo arregla por si solo, porque el
  // ORDER BY global de un UNION sigue materializando las dos ramas: medido,
  // 51.63 -> 49.80 ms. Lo que lo arregla es dejar de ordenar el conjunto entero
  // y paginar cada rama con su propio indice.
  //
  // Los filtros (plan, "vence esta semana") van en SQL, no en el navegador: si
  // se filtran en el cliente hay que traer a TODOS los clientes para descartar
  // los que no tocan el filtro.
  const where: string[] = [];
  const binds: unknown[] = [];
  if (planFilter) {
    where.push("u.plan = ?");
    binds.push(planFilter);
  }
  if (expiryFilter) {
    // Mismo criterio que `daysLeft(...) <= 7 && >= 0` del panel, translated a SQL:
    // vence dentro de 7 dias, incluidos hoy, y no una fecha ya pasada.
    where.push("u.plan_expires_at IS NOT NULL AND u.plan_expires_at >= date('now') AND u.plan_expires_at <= datetime('now', '+7 days')");
  }
  const filterSql = where.length ? ` AND ${where.join(" AND ")}` : "";

  // Los dos COUNT acotan el paginador. No son gratis: leen TODA la tabla.
  // Medido en local con 10.000 cuentas y los indices de 0006 puestos:
  //   loginTotal   3.27 ms   SCAN l USING COVERING INDEX (10.000 entradas)
  //   orphanTotal  3.01 ms   SCAN u2 + una sonda por fila
  //   la pagina en si 0.023 ms   SCAN l USING INDEX idx_user_created  <- la que si corta
  //   carga completa del panel ~7 ms
  // Crecen con el TOTAL de cuentas, no con los mensajes: es el mismo orden de
  // problema que ya se arreglo en el Overview, pero aqui es un panel de admin
  // (se consulta poco y solo lo ve una persona), no una vista por agente.
  // ponytail: COUNT sobre todas las cuentas. Subir a contadores en una tabla
  //   `user_stats` con triggers (mismo patron que agent_stats y lead_stats) el
  //   dia que pese. La otra via, pasar el paginador a "hay mas" con pageSize+1
  //   y dejar de devolver `total`, NO es gratis: `total` es lo que pinta los
  //   numeros de pagina y el "Mostrando X-Y de Z cuentas" del pie, asi que
  //   quitandolo se pierde UX, no solo coste. Con 3 cuentas hoy ninguna de las
  //   dos merece el riesgo de meter triggers en la tabla `user` de Better Auth.
  const loginTotal = Number(
    (
      await env.DB.prepare(`SELECT COUNT(*) AS c FROM "user" l LEFT JOIN users u ON u.id = l.id WHERE 1=1${filterSql}`)
        .bind(...binds)
        .first<{ c: number }>()
    )?.c
  ) || 0;
  const orphanTotal = Number(
    (
      await env.DB.prepare(
        `SELECT COUNT(*) AS c FROM users u2 WHERE NOT EXISTS (SELECT 1 FROM "user" l2 WHERE l2.id = u2.id)${
          planFilter ? " AND u2.plan = ?" : ""
        }${expiryFilter ? " AND u2.plan_expires_at IS NOT NULL AND u2.plan_expires_at >= date('now') AND u2.plan_expires_at <= datetime('now', '+7 days')" : ""}`
      )
        .bind(...(planFilter ? [planFilter] : []))
        .first<{ c: number }>()
    )?.c
  ) || 0;
  const total = loginTotal + orphanTotal;

  // La pagina se reparte entre las dos ramas: primero los que tienen login (que
  // son los casi todos y los unicos que pueden paginarse por indice), y si la
  // pagina cae en la zona de los huerfanos se leen desde ahi.
  const results: Row[] = [];
  if (loginTotal > 0) {
    const { results: pageRows } = await env.DB.prepare(
      `SELECT l.createdAt AS created, l.id, l.email AS login_email, l.role,
              u.name, u.plan, u.agent_limit, u.messages_limit, u.messages_used,
              u.plan_expires_at, u.downgraded_from, u.expiry_notice_at,
              (CASE WHEN u.telegram_chat_id IS NOT NULL AND u.telegram_chat_id <> '' THEN 1 ELSE 0 END) AS has_telegram,
              (CASE WHEN u.webhook_url IS NOT NULL AND u.webhook_url <> '' THEN 1 ELSE 0 END) AS has_webhook,
              (SELECT COUNT(*) FROM agents a WHERE a.user_id = l.id) AS agents,
              (SELECT GROUP_CONCAT(a.name, ' | ') FROM agents a WHERE a.user_id = l.id) AS agent_names
         FROM "user" l LEFT JOIN users u ON u.id = l.id
        WHERE 1=1${filterSql}
        ORDER BY l.createdAt DESC
        LIMIT ? OFFSET ?`
    )
      .bind(...binds, pageSize, (page - 1) * pageSize)
      .all<Row>();
    results.push(...((pageRows ?? []) as Row[]));
  }
  // Los huerfanos (cuentas legacy que nunca pasaron por Better Auth) van al final,
  // igual que antes, para que no queden invisibles. Son raros, asi que solo se
  // tocan si la pagina llega a su zona.
  const firstOrphanPage = Math.floor(loginTotal / pageSize) + 1;
  if (orphanTotal > 0 && page >= firstOrphanPage) {
    const { results: orphanRows } = await env.DB.prepare(
      `SELECT NULL AS created, u2.id, u2.email AS login_email, NULL AS role,
              u2.name, u2.plan, u2.agent_limit, u2.messages_limit, u2.messages_used,
              u2.plan_expires_at, u2.downgraded_from, u2.expiry_notice_at,
              (CASE WHEN u2.telegram_chat_id IS NOT NULL AND u2.telegram_chat_id <> '' THEN 1 ELSE 0 END) AS has_telegram,
              (CASE WHEN u2.webhook_url IS NOT NULL AND u2.webhook_url <> '' THEN 1 ELSE 0 END) AS has_webhook,
              (SELECT COUNT(*) FROM agents a WHERE a.user_id = u2.id) AS agents,
              (SELECT GROUP_CONCAT(a.name, ' | ') FROM agents a WHERE a.user_id = u2.id) AS agent_names
         FROM users u2
        WHERE NOT EXISTS (SELECT 1 FROM "user" l2 WHERE l2.id = u2.id)${
          planFilter ? " AND u2.plan = ?" : ""
        }${expiryFilter ? " AND u2.plan_expires_at IS NOT NULL AND u2.plan_expires_at >= date('now') AND u2.plan_expires_at <= datetime('now', '+7 days')" : ""}
        ORDER BY u2.created_at DESC
        LIMIT ? OFFSET ?`
    )
      .bind(...(planFilter ? [planFilter] : []), pageSize, (page - firstOrphanPage) * pageSize)
      .all<Row>();
    results.push(...((orphanRows ?? []) as Row[]));
  }

  const users = results.map((r) => ({
    id: r.id,
    email: r.login_email,
    name: r.name,
    role: r.role ?? "sin login",
    plan: r.plan ?? "free",
    agent_limit: r.agent_limit,
    messages_limit: r.messages_limit,
    messages_used: Number(r.messages_used) || 0,
    // La UNION de la segunda rama pone NULL en `created` (cuentas legacy que
    // nunca pasaron por Better Auth): no hay fecha de login que mostrar.
    created: r.created ?? null,
    plan_expires_at: r.plan_expires_at ?? null,
    downgraded_from: r.downgraded_from ?? null,
    // El panel lo usa para poner "vencio su plan Pro" en la fila y para saber si
    // el cliente todavia no vio el aviso de renovacion.
    show_expiry_notice: Boolean(r.downgraded_from) && Boolean(r.plan_expires_at) && String(r.plan_expires_at) < todayIso() && !r.expiry_notice_at,
    has_telegram: !!r.has_telegram,
    has_webhook: !!r.has_webhook,
    agents: r.agents,
    agent_names: r.agent_names ?? null,
  }));

  // El badge del boton "vence esta semana" necesita el numero de los que cumplen
  // ESE filtro (mas el de plan, si hay uno elegido).
  //
  // Se cuenta sobre `users`, sin unirse a `"user"`, por dos razones:
  //  1. Es el mismo dominio que el filtro del listado y que el cron de vencimiento
  //     (L2119, `FROM users` sin join): una cuenta huerfana que vence la semana
  //     que viene la degrada el cron, aparece en el filtro... y el badge no la
  //     contaba, porque partia de `"user"`. Medido: badge 1, filtro 2, cron 2.
  //     Con plan=agency encima el badge decia 0 y existia 1 cuenta.
  //  2. Cada cuenta con vencimiento tiene fila en `users` (ahi vive la fecha), y
  //     un login sin fila en `users` tampoco tiene fecha que contar, asi que la
  //     union de las dos ramas del filtro es exactamente `FROM users`.
  // `idx_users_plan_expires` cubre la ventana de 7 dias.
  const expiryCount = Number(
    (
      await env.DB.prepare(
        `SELECT COUNT(*) AS c FROM users
          WHERE plan_expires_at IS NOT NULL
            AND plan_expires_at >= date('now')
            AND plan_expires_at <= datetime('now', '+7 days')
            ${planFilter ? " AND plan = ?" : ""}`
      )
        .bind(...(planFilter ? [planFilter] : []))
        .first<{ c: number }>()
    )?.c
  ) || 0;

  // Conteos por plan para las pilloras del panel. Se piden SIN el filtro de plan
  // aplicado a propósito: si no, al elegir "Free" las otras pilloras caerían a
  // cero y el filtro parecería roto. Usa idx_users_plan, asi que no es un scan.
  // Solo cuando el cliente los pide: es un dato que el navegador recalcula en
  // cada render de la fila, no algo que el listado necesite.
  let planCounts: Record<string, number> = {};
  if (url.searchParams.get("counts") === "1") {
    const counts = await env.DB.prepare(
      `SELECT plan, COUNT(*) AS c FROM users GROUP BY plan`
    ).all<{ plan: string | null; c: number }>();
    const byPlan = counts.results ?? [];
    planCounts = Object.fromEntries(byPlan.map((r) => [r.plan ?? "free", Number(r.c) || 0]));
    // Sin fila `users` significa plan free, y el panel agrupa ahi los que no
    // tienen ninguno asignado, asi que se cuenta tambien desde "user".
    const orphanLogin = Number(
      (
        await env.DB.prepare(
          `SELECT COUNT(*) AS c FROM "user" l LEFT JOIN users u ON u.id = l.id WHERE u.id IS NULL`
        )
          .first<{ c: number }>()
      )?.c
    ) || 0;
    planCounts.free = (planCounts.free ?? 0) + orphanLogin;
  }

  return json({ users, total, expiryCount, planCounts, page, pageSize }, 200, origin);
}

// El cliente cerro el aviso de renovacion. Solo se marca la SUYA: se usa el
// user_id de la sesion, nunca uno del body, asi que no hay forma de acknowledg-
// -ear el aviso de otro. El cron vuelve a ponerlo en NULL al proximo vencimiento.
async function handleUserNotice(request: Request, env: Env) {
  const origin = request.headers.get("Origin") || "*";
  const user = await resolveUser(request, env);
  if (!user) return json({ error: "No autorizado" }, 403, origin);
  await env.DB.prepare("UPDATE users SET expiry_notice_at = datetime('now') WHERE id = ?")
    .bind(user.id)
    .run();
  return json({ ok: true }, 200, origin);
}

// Historial de plan de una cuenta. Responde "¿que me contrataste y cuando?",
// que antes no se podia contestar con evidencia. Admin mira cualquier cuenta;
// el cliente solo la suya: la facturacion propia es de solo lectura y el
// `userId` lo arma el panel con el `id` que vino en su propio payload de
// /api/agents, asi que cualquier otro id choca con el de la sesion y cae 403.
async function handleUserEvents(request: Request, env: Env, userId: string) {
  const origin = request.headers.get("Origin") || "*";
  const user = await resolveUser(request, env);
  if (!user || !(user.superadmin || user.role === "admin" || userId === user.id)) {
    return json({ error: "No autorizado" }, 403, origin);
  }
  const { results } = await env.DB.prepare(
    "SELECT id, action, field, from_value, to_value, actor, created_at FROM plan_events WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 100"
  )
    .bind(userId)
    .all();
  return json({ events: results ?? [] }, 200, origin);
}

async function handleUserUpdate(request: Request, env: Env) {
  const origin = request.headers.get("Origin") || "*";
  // Solo admin/superadmin (Fase 2D): el cliente no edita su propio plan/cupos.
  const user = await resolveUser(request, env);
  if (!user || !(user.superadmin || user.role === "admin")) {
    return json({ error: "No autorizado" }, 403, origin);
  }
  const body = await request.json().catch(() => ({}));
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  // El admin edita su propio plan por omisión, o el de un cliente con `user_id`.
  // El guard de arriba ya exige admin/superadmin: acá solo se valida el destino.
  const targetId = typeof b.user_id === "string" && b.user_id ? b.user_id : user.id;
  const target = await env.DB.prepare("SELECT id FROM users WHERE id = ?").bind(targetId).first<{ id: string }>();
  if (!target) return json({ error: "Usuario no encontrado" }, 404, origin);

  const updates: [string, unknown][] = [];
  let plan: string | undefined;

  if ("plan" in b) {
    if (typeof b.plan !== "string" || !(b.plan in PLAN_DEFAULTS)) {
      return json({ error: "Campo inválido: plan" }, 400, origin);
    }
    plan = b.plan;
    updates.push(["plan", plan]);
  }

  const current = await env.DB.prepare("SELECT plan, agent_limit, plan_expires_at, downgraded_from FROM users WHERE id = ?")
    .bind(targetId)
    .first<{ plan: string | null; agent_limit: number | null; plan_expires_at: string | null; downgraded_from: string | null }>();
  const targetPlan = plan ?? current?.plan ?? "free";
  const planChanged = plan !== undefined && plan !== (current?.plan ?? "free");

  if ("messages_limit" in b) {
    const v = b.messages_limit;
    // null = "sigue el plan", igual que agent_limit. Sin esto, limpiar un cupo
    // manual desde el panel era imposible: la unica forma de volver al default
    // era cambiar el plan entero.
    if (v === null) {
      updates.push(["messages_limit", null]);
    } else if (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 1_000_000) {
      // Si coincide con el default del plan se guarda NULL (= "sigue el plan")
      updates.push(["messages_limit", v === planDefaults(targetPlan).messages ? null : v]);
    } else {
      return json({ error: "Campo inválido: messages_limit" }, 400, origin);
    }
  } else if (plan) {
    updates.push(["messages_limit", null]);
  }

  if ("agent_limit" in b) {
    const v = b.agent_limit;
    if (v === null) {
      updates.push(["agent_limit", null]);
    } else if (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 100) {
      // Si coincide con el default del plan se guarda NULL (= "sigue el plan")
      updates.push(["agent_limit", v === planDefaults(targetPlan).agents ? null : v]);
    } else {
      return json({ error: "Campo inválido: agent_limit" }, 400, origin);
    }
  } else if (plan) {
    updates.push(["agent_limit", null]);
  }

  if ("plan_expires_at" in b) {
    const v = b.plan_expires_at;
    if (v === null || v === "") {
      updates.push(["plan_expires_at", null]);
    } else if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
      updates.push(["plan_expires_at", v]);
    } else {
      return json({ error: "Campo inválido: plan_expires_at" }, 400, origin);
    }
  }

  // Renovación de un clic: el dueño no calcula fechas, el worker sí. El período
  // se suma al vencimiento si sigue vivo (el cliente pagó otro mes a partir de
  // ahí) o a hoy si ya venció (no se le regalan los meses que no usó).
  //
  // Y si la cuenta ya había caído a free por vencimiento, renovar le DEVUELVE el
  // plan que tenía (queda en `downgraded_from`): renovar es cobrar, no solo mover
  // la fecha. Sin esto, el botón "Renovar +1 mes" sobre un plan Pro vencido le
  // compraba un mes de free y el dueño tenía que acordarse de volver a tocar el
  // plan a mano. Si el dueño mandó `plan` explícito, manda su elección y no se
  // restaura el anterior.
  const isRenew = "renew_months" in b;
  const restorePlan =
    isRenew && plan === undefined && current?.downgraded_from && current.downgraded_from in PLAN_DEFAULTS
      ? current.downgraded_from
      : null;
  if (isRenew || planChanged) {
    // Cualquiera de los dos es "volvió a pagar": se limpia la marca de downgrade
    // para que el panel no diga "viene de Pro" y el aviso pueda reaparecer en el
    // próximo vencimiento.
    updates.push(["downgraded_from", null]);
    updates.push(["expiry_notice_at", null]);
    if (restorePlan) updates.push(["plan", restorePlan]);
  }

  if (isRenew) {
    const n = b.renew_months;
    if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > 24) {
      return json({ error: "Campo inválido: renew_months (entero de 1 a 24)" }, 400, origin);
    }
    const exp = current?.plan_expires_at ?? null;
    const base = exp && exp > todayIso() ? new Date(`${exp}T00:00:00Z`) : new Date();
    updates.push(["plan_expires_at", periodEnd(base, n)]);
  }

  // El período arranca solo al cambiar de plan: hoy + 1 mes. Tres casos, y en
  // este orden importa:
  //  1. Si el admin mandó plan_expires_at o pidió una renovación, manda lo suyo.
  //  2. Si ya hay una fecha futura, NO se toca: un plan ya pagado (ej. 3 meses)
  //     no puede acortarse solo porque el dueño retoque el plan.
  //  3. Sin fecha o ya vencida, se pone un mes nuevo desde hoy.
  if (!("plan_expires_at" in b) && !("renew_months" in b) && planChanged) {
    const exp = current?.plan_expires_at ?? null;
    if (!exp || exp < todayIso()) updates.push(["plan_expires_at", periodEnd()]);
  }

  if (updates.length === 0) return json({ error: "Nada para actualizar" }, 400, origin);

  // Estado previo completo, para poder anotar de->que en el historial. `current`
  // de arriba solo trae lo que se necesita para decidir; el registro necesita
  // tambien el messages_limit de antes.
  const before = await env.DB.prepare(
    "SELECT plan, agent_limit, messages_limit, plan_expires_at FROM users WHERE id = ?"
  )
    .bind(targetId)
    .first<{ plan: string | null; agent_limit: number | null; messages_limit: number | null; plan_expires_at: string | null }>();
  const beforeValues: Record<string, unknown> = { ...(before ?? {}) };

  const setClause = updates.map(([col]) => `${col} = ?`).join(", ");
  await env.DB.prepare(`UPDATE users SET ${setClause} WHERE id = ?`)
    .bind(...updates.map(([, v]) => v), targetId)
    .run();

  // Historial: un renglon por cada columna tocada. `renew_months` se anota como
  // 'renew' (no como una fecha cualquiera) porque es la accion que el dueño
  // ejecuta cuando cobra, y es la que el cliente va a reclamar.
  // Solo se anotan los campos que el dueño edita a mano. `downgraded_from` y
  // `expiry_notice_at` son marcas internas del ciclo de vida, no cambios de
  // contrato: ponerlas acá llenaría el historial de ruido que el dueño lee
  // cuando un cliente reclama.
  const LOGGED_FIELDS = new Set(["plan", "plan_expires_at", "messages_limit", "agent_limit"]);
  for (const [col, v] of updates) {
    if (!LOGGED_FIELDS.has(col)) continue;
    const prev = beforeValues[col] ?? null;
    const next = v ?? null;
    if (String(prev ?? "") === String(next ?? "")) continue;
    const action =
      col === "plan_expires_at" ? (isRenew ? "renew" : "expiry")
      : col === "plan" ? "plan"
      : "quota";
    await logPlanEvent(env, targetId, action, col, prev, next, "admin");
  }

  // Se devuelve la vigencia resultante porque la renovación la calcula el
  // servidor: si no, el panel tendría que repetir la aritmética de meses para
  // pintar el resultado, y se mostraría la fecha vieja hasta el próximo refresco.
  const expUpdate = updates.find(([col]) => col === "plan_expires_at");
  const newExpiry = expUpdate ? (expUpdate[1] as string | null) : (current?.plan_expires_at ?? null);

  return json({ ok: true, plan: restorePlan ?? targetPlan, user_id: targetId, plan_expires_at: newExpiry, downgraded: false }, 200, origin);
}

// Un registro por cada cambio de plan, renovacion, cupo o vencimiento. Todo pasa
// por aca, asi que el historial no puede quedar desincronizado con la base: es el
// mismo codigo que aplica el cambio el que lo anota.
async function logPlanEvent(
  env: Env,
  userId: string,
  action: "plan" | "renew" | "quota" | "expiry" | "downgrade",
  field: string | null,
  from: unknown,
  to: unknown,
  actor: "admin" | "system" | "user" = "admin"
): Promise<void> {
  const s = (v: unknown) => (v === null || v === undefined ? null : String(v));
  await env.DB.prepare(
    "INSERT INTO plan_events (id, user_id, action, field, from_value, to_value, actor, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))"
  )
    .bind(crypto.randomUUID(), userId, action, field, s(from), s(to), actor)
    .run();
}

// Baja a free las cuentas cuyo plan pagado ya vencio.
//
// Esto NO es lo que corta el acceso: el corte real de cupos ya ocurre en
// effectivePlan(), en cada request, y por eso funciona aunque el cron se atrase.
// Aca solo se reescribe `plan` para que el panel, el historial y el modal del
// cliente digan la verdad en vez de mostrar "Pro" a un plan que ya murio.
//
// Los agentes existentes NO se borran ni se desactivan (decision del dueho: que
// sigan respondiendo en la web de sus clientes); lo que se limita son los
// mensajes y la creacion de agentes nuevos.
async function downgradeExpired(env: Env): Promise<number> {
  const today = todayIso();
  // El WHERE es solo un pre-filtro barato (no lee la tabla entera). Quien decide
  // de verdad es effectivePlan(), el mismo que aplica el corte de cupos: si
  // divergieran, el panel y el cron contarian historias distintas.
  const { results } = await env.DB.prepare(
    "SELECT id, plan, plan_expires_at FROM users WHERE plan_expires_at IS NOT NULL AND plan_expires_at < ?"
  )
    .bind(today)
    .all<{ id: string; plan: string | null; plan_expires_at: string | null }>();

  let n = 0;
  for (const row of results ?? []) {
    if (effectivePlan(row) === (row.plan ?? "free")) continue;
    // Los cupos vuelven a NULL (= "sigue el plan", o sea los de free): un
    // messages_limit de 6000 era del plan pagado: dejarlo intacto anuleria el efecto
    // del vencimiento. Queda anotado en plan_events, asi que no se pierde.
    await env.DB.prepare(
      "UPDATE users SET plan = 'free', downgraded_from = ?, agent_limit = NULL, messages_limit = NULL, expiry_notice_at = NULL WHERE id = ?"
    )
      .bind(row.plan, row.id)
      .run();
    await logPlanEvent(env, row.id, "downgrade", null, row.plan, "free", "system");
    n++;
  }
  return n;
}

async function resetMonthlyQuota(env: Env): Promise<void> {
  // Snapshot del mes que termina ANTES de poner el contador a cero (corre solo
  // el día 1 UTC, así que 'now -1 day' es el mes anterior). Es lo que alimenta
  // el historial de uso del panel; los meses en 0 no se guardan (ruido).
  await env.DB.prepare(
    `INSERT INTO usage_history (user_id, month, messages)
     SELECT id, strftime('%Y-%m', 'now', '-1 day'), messages_used FROM users WHERE messages_used > 0
     ON CONFLICT(user_id, month) DO UPDATE SET messages = excluded.messages`
  ).run();
  await env.DB.prepare("UPDATE users SET messages_used = 0").run();
}

// ── Rate limit de /api/auth/*: la IP del visitante, sin confiar en el cliente ──
// El rate limiter de Better Auth (3 intentos / 10 s en sign-in y sign-up) decide
// por IP, y la IP se resuelve de una cabecera. El worker es público: si aceptara
// `x-client-ip` tal cual, cualquiera que pegue directo al worker podría mandar
// una IP distinta en cada POST y evadir el límite por completo (y de paso tapar
// el de los demás). Por eso la cabecera solo cuenta si el proxy del panel la
// firma con OWNER_TOKEN (que el navegador nunca ve). Sin firma válida se borra
// la cabecera y Better Auth cae en su cubo compartido por path: molestia para el
// atacante, nunca un bypass.
//
// Reenviar el request con `new Request(request, { headers })` en vez de armar uno
// nuevo desde cero: preserva el body (un stream) sin necesitar `duplex`, que
// rompería los POST de sign-in/sign-up.
function authRequest(request: Request, env: Env): Request {
  if (!request.headers.has("x-client-ip")) return request;
  const headers = new Headers(request.headers);
  // `isOwnerAuthorized` devuelve true cuando OWNER_TOKEN no está configurado
  // (modo dev), y eso dejaría el bypass abierto. Acá se exige el token posta:
  // sin él, la cabecera no se confía y el limiter queda en modo cubo compartido.
  if (!env.OWNER_TOKEN || !isOwnerAuthorized(request, env)) headers.delete("x-client-ip");
  return new Request(request, { headers });
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext) {
    // Los cupos se cortan solos al vencer el plan (effectivePlan), pero el registro
  // en la base se hace aqui: diario, para que el vencimiento no tarde un mes en
  // verse. El reinicio mensual de mensajes sigue igual, solo el dia 1.
  await downgradeExpired(env);
  if (new Date().getUTCDate() === 1) await resetMonthlyQuota(env);
  },
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "*";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (url.pathname === "/" && request.method === "GET") {
      return json({ ok: true, service: "agentosweb-api" });
    }

    // 🔐 Autenticación (Mejor Auth, Fase 2): rutas /api/auth/* gestionan registro,
    // login, sesión y OAuth. El dashboard proxya estas rutas server-side.
    if (url.pathname.startsWith("/api/auth/")) {
      const { createAuth, ensureAuthMigrations } = await import("./auth");
      await ensureAuthMigrations(env);
      return createAuth(env).handler(authRequest(request, env));
    }

    // Multi-agente: listar y crear (antes del matcher /api/agent/:id)
    if (url.pathname === "/api/agents" && request.method === "GET") {
      return handleAgentList(request, env);
    }
    if (url.pathname === "/api/agents" && request.method === "POST") {
      return handleAgentCreate(request, env);
    }
    if (url.pathname === "/api/user" && request.method === "PUT") {
      return handleUserUpdate(request, env);
    }
  if (url.pathname === "/api/admin/users" && request.method === "GET") {
    return handleAdminUsers(request, env);
  }
  if (url.pathname === "/api/user/notice" && request.method === "POST") {
    return handleUserNotice(request, env);
  }

  const eventsMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)\/events$/);
  if (eventsMatch && request.method === "GET") {
    return handleUserEvents(request, env, eventsMatch[1]);
  }

    if (url.pathname === "/api/chat" && request.method === "POST") {
      return handleChat(request, env, ctx);
    }

    const configMatch = url.pathname.match(/^\/api\/agent\/([^/]+)\/config$/);
    if (configMatch && request.method === "GET") {
      return handleAgentConfig(request, configMatch[1], env);
    }

    const agentMatch = url.pathname.match(/^\/api\/agent\/([^/]+)$/);
    if (agentMatch) {
      if (request.method === "GET") {
        return handleAgent(request, agentMatch[1], env);
      }
      if (request.method === "PUT") {
        return handleAgentUpdate(request, agentMatch[1], env);
      }
      if (request.method === "DELETE") {
        return handleAgentDelete(request, agentMatch[1], env);
      }
    }

    const overviewMatch = url.pathname.match(/^\/api\/overview\/([^/]+)$/);
    if (overviewMatch && request.method === "GET") {
      return handleOverview(request, overviewMatch[1], env);
    }

    const analyticsMatch = url.pathname.match(/^\/api\/analytics\/([^/]+)$/);
    if (analyticsMatch && request.method === "GET") {
      return handleAnalytics(request, analyticsMatch[1], env);
    }

    const leadsMatch = url.pathname.match(/^\/api\/leads\/([^/]+)$/);
    if (url.pathname === "/api/leads" && request.method === "POST") {
      return handleLeadForm(request, env);
    }
    if (url.pathname === "/api/leads/bulk" && request.method === "POST") {
      return handleLeadBulk(request, env);
    }
const historyMatch = url.pathname.match(/^\/api\/leads\/([^/]+)\/history$/);
  if (historyMatch && request.method === "GET") {
    return handleLeadHistory(request, historyMatch[1], env);
  }
  if (historyMatch && request.method === "DELETE") {
    return handleLeadHistoryDelete(request, historyMatch[1], env);
  }
    if (leadsMatch) {
      if (request.method === "GET") {
        return handleLeadList(request, leadsMatch[1], env);
      }
      if (request.method === "PATCH") {
        return handleLeadStatus(request, leadsMatch[1], env);
      }
      if (request.method === "DELETE") {
        return handleLeadDelete(request, leadsMatch[1], env);
      }
    }

    if (url.pathname === "/api/admin/support") {
      return handleAdminSupport(request, env);
    }

    if (url.pathname === "/api/support" && request.method === "POST") {
      return handleSupportCreate(request, env);
    }

    return json({ error: "Not found" }, 404);
  },
};
