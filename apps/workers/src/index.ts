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
}

const DEFAULT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const DEFAULT_MODEL_FAST = "@cf/meta/llama-3.1-8b-instruct-fast";

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
    "Access-Control-Allow-Methods": "POST, GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Owner-Token",
  };
}

function json(data: unknown, status = 200, origin = "*") {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders(origin) });
}

// ponytail: rate limit en memoria (por instancia). WebSocket/colo-uniforme se requiere un Durable Object; agregar solo si hay abuso real.
const rateBuckets = new Map<string, { count: number; windowStart: number }>();
const RATE_WINDOW_MS = 60_000;

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
    return json({ reply: faqReply }, 200, origin);
  }

  // 🎯 Control de cupo: solo la IA administrada consume cupo; BYOK paga su propia IA (ilimitado)
  const CUPO_REPLY =
    "Tu plan alcanzó el límite mensual de mensajes de IA administrada. Contáctanos para subir tu plan o cambia a BYOK (tu API Key) y continúa sin límite.";
  let managedLimit: number | null = null; // cupo efectivo del usuario si IA administrada
  if (isWorkersAI(agent)) {
    // KV evita releer D1 en cada intento: 5 min una vez agotado
    const blocked = await env.AGENT_CACHE.get(`quota:${agent.user_id}`);
    if (blocked) return json({ reply: CUPO_REPLY }, 200, origin);
    const userInfo = await env.DB.prepare("SELECT messages_used, messages_limit, plan FROM users WHERE id = ?")
      .bind(agent.user_id)
      .first<{ messages_used: number; messages_limit: number | null; plan: string | null }>();
    if (userInfo) {
      const limit = effectiveMessagesLimit(userInfo);
      managedLimit = limit;
      if (userInfo.messages_used >= limit) {
        await env.AGENT_CACHE.put(`quota:${agent.user_id}`, "1", { expirationTtl: 300 });
        return json({ reply: CUPO_REPLY }, 200, origin);
      }
    }
  }

  // Pacing orgánico: mínimo 1.000 ms de espera perceptible
  const minDelay = new Promise((r) => setTimeout(r, 1000));

  let botReply = "";
  try {
    botReply = await infer(agent, messagesPayload, env);
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
        if (isWorkersAI(agent) && managedLimit != null) {
          // Incremento atómico: no suma si ya se alcanzó el límite (evita pasarse en ráfagas).
          await env.DB.prepare(
            `UPDATE users SET messages_used = messages_used + 1
             WHERE id = ? AND messages_used < ?`
          )
            .bind(agent.user_id, managedLimit)
            .run();
        }

        const lower = message.toLowerCase();
        if (lower.includes("@") || lower.includes("precio") || lower.includes("comprar")) {
          await sendWebhook(env, agent.user_id, `🚨 Nuevo interés en tu web:\n"${message}"`);
        }
      } catch {
        // Persistencia best-effort
      }
    })()
  );

  return json({ reply: botReply }, 200, origin);
}

async function handleAgent(request: Request, agentId: string, env: Env) {
  const origin = request.headers.get("Origin") || "*";
  const agent = await getAgent(agentId, env);
  if (!agent) return json({ error: "Agente no existe" }, 404, origin);

  return json(
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
}

// Config completa y editable SOLO para el dashboard. Lee D1 directo (sin cache)
// para que el editor siempre muestre estado fresco y funcione con agentes pausados
// (getAgent devuelve null si is_active !== 1). NUNCA expone chat_api_key.
async function handleAgentConfig(request: Request, agentId: string, env: Env) {
  const origin = request.headers.get("Origin") || "*";
  if (!isOwnerAuthorized(request, env)) {
    return json({ error: "No autorizado" }, 403, origin);
  }
  const agent = await env.DB.prepare("SELECT * FROM agents WHERE id = ?").bind(agentId).first<AgentRow>();
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
  if (!isOwnerAuthorized(request, env)) {
    return json({ error: "No autorizado" }, 403, origin);
  }

  // Puede dejarse vacío el body para invalidar SOLO la cache (`PUT` con {}).
  // Cuando hay campo `faqs`: valida estructura + re-cachea con los datos nuevos.
  const existing = await env.DB.prepare("SELECT id FROM agents WHERE id = ?").bind(agentId).first<{ id: string }>();
  if (!existing) return json({ error: "Agente no existe" }, 404, origin);

  const body: unknown = await request.json().catch(() => ({}));
  let updates: [string, unknown][] = [];
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    // Marca blanca: el logo de burbuja propio es exclusivo del plan Agency.
    if ("bubble_logo_url" in b && b.bubble_logo_url != null) {
      const owner = await env.DB.prepare(
        "SELECT u.plan FROM users u JOIN agents a ON a.user_id = u.id WHERE a.id = ?"
      )
        .bind(agentId)
        .first<{ plan: string | null }>();
      if (owner?.plan !== "agency") {
        return json({ error: "El logo de burbuja (marca blanca) es exclusivo del plan Agency" }, 403, origin);
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
  // Solo el dueño debe leer métricas de uso/cuota; el resto de la API es público a propósito.
  if (!isOwnerAuthorized(request, env)) {
    return json({ error: "No autorizado" }, 403, origin);
  }
  const agent = await getAgent(agentId, env);
  if (!agent) return json({ error: "Agente no existe" }, 404, origin);

  const [convos, msgs, recentRes, faqHitsRes] = await env.DB.batch([
    env.DB.prepare("SELECT COUNT(*) AS total FROM conversations WHERE agent_id = ?").bind(agentId),
    env.DB.prepare(
      "SELECT COUNT(*) AS total FROM messages m JOIN conversations c ON m.conversation_id = c.id WHERE c.agent_id = ?"
    ).bind(agentId),
    env.DB.prepare(
      "SELECT session_id, updated_at FROM conversations WHERE agent_id = ? ORDER BY updated_at DESC LIMIT 5"
    ).bind(agentId),
    env.DB.prepare("SELECT faq_label, hits FROM faq_hits WHERE agent_id = ? ORDER BY hits DESC").bind(agentId),
  ]);

  const convosTotal = (convos.results?.[0] as { total?: number } | undefined)?.total ?? 0;
  const msgsTotal = (msgs.results?.[0] as { total?: number } | undefined)?.total ?? 0;
  const recent =
    (recentRes.results as { session_id: string; updated_at: string }[] | undefined)?.map((r) => ({
      session_id: r.session_id,
      updated_at: r.updated_at,
    })) || [];
  const hitsByLabel = new Map(
    (faqHitsRes.results as { faq_label: string; hits: number }[] | undefined)?.map((h) => [h.faq_label, h.hits])
  );

  const user = await env.DB.prepare("SELECT messages_limit, messages_used, plan FROM users WHERE id = ?")
    .bind(agent.user_id)
    .first<{ messages_limit: number | null; messages_used: number; plan: string | null }>();

  return json(
    {
      id: agent.id,
      conversations_total: Number(convosTotal),
      messages_total: Number(msgsTotal),
      messages_used: Number(user?.messages_used) || 0,
      messages_limit: effectiveMessagesLimit(user),
      recent,
      faqs: getFaqs(agent).map((f) => ({ label: f.label, hits: hitsByLabel.get(f.label) || 0 })),
    },
    200,
    origin
  );
}

// ── Multi-agente: listar y crear ────────────────────────────────────────────────
// Cupos por defecto de cada plan. `agent_limit` en la tabla users puede sobreescribir
// los agentes (NULL = sigue el plan); `messages_limit` ya es por-usuario y editable.
export const PLAN_DEFAULTS: Record<string, { agents: number; messages: number }> = {
  free: { agents: 1, messages: 20 },
  starter: { agents: 1, messages: 1500 },
  pro: { agents: 3, messages: 6000 },
  agency: { agents: 10, messages: 25000 },
};

type OwnerRow = { name: string | null; plan: string | null; agent_limit: number | null; messages_limit: number | null; messages_used: number | null };

function planDefaults(plan: string | null | undefined) {
  return PLAN_DEFAULTS[plan ?? ""] ?? PLAN_DEFAULTS.free;
}

function effectiveAgentLimit(user: { plan: string | null; agent_limit: number | null } | null | undefined) {
  if (user?.agent_limit != null) return user.agent_limit;
  return planDefaults(user?.plan).agents;
}

function effectiveMessagesLimit(user: { plan: string | null; messages_limit: number | null } | null | undefined) {
  if (user?.messages_limit != null) return user.messages_limit;
  return planDefaults(user?.plan).messages;
}

async function resolveOwnerId(env: Env): Promise<string | null> {
  if (env.OWNER_USER_ID) return env.OWNER_USER_ID;
  const row = await env.DB.prepare("SELECT user_id FROM agents LIMIT 1").first<{ user_id: string }>();
  return row?.user_id ?? null;
}

async function handleAgentList(request: Request, env: Env) {
  const origin = request.headers.get("Origin") || "*";
  if (!isOwnerAuthorized(request, env)) return json({ error: "No autorizado" }, 403, origin);

  const ownerId = await resolveOwnerId(env);
  if (!ownerId) return json({ error: "Falta usuario dueño" }, 503, origin);

  const { results } = await env.DB.prepare(
    "SELECT id, name, is_active FROM agents WHERE user_id = ? ORDER BY created_at ASC"
  ).bind(ownerId).all();

  const user = await env.DB.prepare(
    "SELECT name, plan, agent_limit, messages_limit, messages_used FROM users WHERE id = ?"
  ).bind(ownerId).first<OwnerRow>();

  return json(
    {
      owner: {
        name: user?.name ?? null,
        plan: user?.plan ?? null,
agent_limit: effectiveAgentLimit(user),
        messages_limit: effectiveMessagesLimit(user),
        messages_used: Number(user?.messages_used) || 0,
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
  if (!isOwnerAuthorized(request, env)) return json({ error: "No autorizado" }, 403, origin);

  const ownerId = await resolveOwnerId(env);
  if (!ownerId) return json({ error: "Falta usuario dueño" }, 503, origin);

  const body = await request.json().catch(() => ({}));
  const name = typeof (body as Record<string, unknown>)?.name === "string"
    ? ((body as Record<string, unknown>).name as string).trim()
    : "";
  if (!name || name.length > 60) return json({ error: "Campo inválido: name" }, 400, origin);

  const duplicate = await env.DB.prepare("SELECT id FROM agents WHERE user_id = ? AND LOWER(name) = LOWER(?)")
    .bind(ownerId, name)
    .first<{ id: string }>();
  if (duplicate) return json({ error: `Ya tienes un agente llamado "${name}". Elige otro nombre.` }, 409, origin);

  const user = await env.DB.prepare("SELECT plan, agent_limit FROM users WHERE id = ?")
    .bind(ownerId)
    .first<{ plan: string | null; agent_limit: number | null }>();
  const limit = effectiveAgentLimit(user);
  const countRow = await env.DB.prepare("SELECT COUNT(*) AS total FROM agents WHERE user_id = ?").bind(ownerId).first<{ total: number }>();
  if ((Number(countRow?.total) || 0) >= limit) {
    return json({ error: `Alcanzaste el límite de tu plan (${limit} agente${limit === 1 ? "" : "s"}). Sube de plan para crear más.` }, 402, origin);
  }

  const id = crypto.randomUUID();
  const defaultPrompt = "";
  const defaultWelcome = `Soy el asistente virtual de ${name}. ¿En qué te puedo colaborar hoy?`;
  await env.DB.prepare(
    "INSERT INTO agents (id, user_id, name, header_title, system_prompt, welcome_message, mode, chat_provider, chat_model) VALUES (?, ?, ?, ?, ?, ?, 'managed', 'workers-ai', ?)"
  ).bind(id, ownerId, name, name, defaultPrompt, defaultWelcome, DEFAULT_MODEL_FAST).run();

  return json({ ok: true, id }, 200, origin);
}

// Eliminar un agente y sus datos relacionados. No permite quedarse sin agentes.
async function handleAgentDelete(request: Request, agentId: string, env: Env) {
  const origin = request.headers.get("Origin") || "*";
  if (!isOwnerAuthorized(request, env)) return json({ error: "No autorizado" }, 403, origin);

  const ownerId = await resolveOwnerId(env);
  if (!ownerId) return json({ error: "Falta usuario dueño" }, 503, origin);

  const agent = await env.DB.prepare("SELECT id FROM agents WHERE id = ? AND user_id = ?")
    .bind(agentId, ownerId)
    .first<{ id: string }>();
  if (!agent) return json({ error: "Agente no existe" }, 404, origin);

  const countRow = await env.DB.prepare("SELECT COUNT(*) AS total FROM agents WHERE user_id = ?").bind(ownerId).first<{ total: number }>();
  if ((Number(countRow?.total) || 0) <= 1) {
    return json({ error: "No puedes eliminar tu único agente. Crea otro antes de borrar este." }, 400, origin);
  }

  await env.DB.batch([
    env.DB.prepare("DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE agent_id = ?)").bind(agentId),
    env.DB.prepare("DELETE FROM conversations WHERE agent_id = ?").bind(agentId),
    env.DB.prepare("DELETE FROM leads WHERE agent_id = ?").bind(agentId),
    env.DB.prepare("DELETE FROM faq_hits WHERE agent_id = ?").bind(agentId),
    env.DB.prepare("DELETE FROM agents WHERE id = ? AND user_id = ?").bind(agentId, ownerId),
  ]);

  return json({ ok: true }, 200, origin);
}

// Asignar plan y/o editar cupos del dueño. Si cambia el plan, aplica los valores por
// defecto (salvo que el mismo request traiga un override explícito).
async function handleUserUpdate(request: Request, env: Env) {
  const origin = request.headers.get("Origin") || "*";
  if (!isOwnerAuthorized(request, env)) return json({ error: "No autorizado" }, 403, origin);

  const ownerId = await resolveOwnerId(env);
  if (!ownerId) return json({ error: "Falta usuario dueño" }, 503, origin);

  const body = await request.json().catch(() => ({}));
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const updates: [string, unknown][] = [];
  let plan: string | undefined;

  if ("plan" in b) {
    if (typeof b.plan !== "string" || !(b.plan in PLAN_DEFAULTS)) {
      return json({ error: "Campo inválido: plan" }, 400, origin);
    }
    plan = b.plan;
    updates.push(["plan", plan]);
  }

  const current = await env.DB.prepare("SELECT plan, agent_limit FROM users WHERE id = ?")
    .bind(ownerId)
    .first<{ plan: string | null; agent_limit: number | null }>();
  const effectivePlan = plan ?? current?.plan ?? "free";

  if ("messages_limit" in b) {
    const v = b.messages_limit;
    if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 1_000_000) {
      return json({ error: "Campo inválido: messages_limit" }, 400, origin);
    }
    // Si coincide con el default del plan se guarda NULL (= "sigue el plan")
    updates.push(["messages_limit", v === planDefaults(effectivePlan).messages ? null : v]);
  } else if (plan) {
    updates.push(["messages_limit", null]);
  }

  if ("agent_limit" in b) {
    const v = b.agent_limit;
    if (v === null) {
      updates.push(["agent_limit", null]);
    } else if (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 100) {
      // Si coincide con el default del plan se guarda NULL (= "sigue el plan")
      updates.push(["agent_limit", v === planDefaults(effectivePlan).agents ? null : v]);
    } else {
      return json({ error: "Campo inválido: agent_limit" }, 400, origin);
    }
  } else if (plan) {
    updates.push(["agent_limit", null]);
  }

  if (updates.length === 0) return json({ error: "Nada para actualizar" }, 400, origin);

  const setClause = updates.map(([col]) => `${col} = ?`).join(", ");
  await env.DB.prepare(`UPDATE users SET ${setClause} WHERE id = ?`)
    .bind(...updates.map(([, v]) => v), ownerId)
    .run();

  return json({ ok: true, plan: effectivePlan }, 200, origin);
}

async function resetMonthlyQuota(env: Env): Promise<void> {
  await env.DB.prepare("UPDATE users SET messages_used = 0").run();
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext) {
    await resetMonthlyQuota(env);
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

    return json({ error: "Not found" }, 404);
  },
};