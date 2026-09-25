declare const __CSS__: string;
import { DEFAULT_CONFIG, localReply, type AgentConfig } from "./fallback";

const DEFAULT_API = "https://agentosweb.com/api";
const THEME_KEY = "agentosweb-theme";
const BRAND_KEY = "agentosweb-brand";
const PAUSED_REPLY = "⏸️ Este asistente está en pausa. Vuelve a intentar más tarde.";

const ICON_HOME = `<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>`;
const ICON_CHAT = `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>`;
const ICON_MOON = `<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>`;
const ICON_SUN = `<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>`;
const ICON_CLOSE_X = `<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>`;
const ICON_CHEVRON = `<polyline points="9 18 15 12 9 6"/>`;

const svg = (inner: string, attrs = "") =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${attrs}>${inner}</svg>`;

// Derivar el extremo del gradiente (más claro) a partir del color primario del agente
function shadeColor(hex: string, percent: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (shift: number) => {
    const v = (n >> shift) & 255;
    const t = percent < 0 ? 0 : 255;
    const p = Math.abs(percent) / 100;
    return Math.round((t - v) * p + v);
  };
  return "#" + ((1 << 24) | (mix(16) << 16) | (mix(8) << 8) | mix(0)).toString(16).slice(1);
}

function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

const SVG_SEND = `<svg viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6-6-6z"></path></svg>`;

const SVG_MIC = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>`;

const SVG_CLOSE = `<svg class="close-icon" id="close-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="Cerrar chat"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

const CHAT_PHRASES = [
  "Escribe tu mensaje...",
  "Haz una pregunta...",
  "¿Tienes alguna duda?",
  "¿En qué podemos ayudarte?",
];

function markup(logoUrl: string, iconoChatUrl: string): string {
  return `
    <div class="floating-action-button floating" id="toggle-button" role="button" aria-expanded="false" aria-controls="chatbot-window">
      <img class="chat-icon" id="chat-icon" type="image/png" src="${iconoChatUrl}" alt="Abrir Chat" style="display: block;">
      ${SVG_CLOSE}
    </div>
    <div class="chatbot-container hidden" id="chatbot-window">
      <div class="chatbot-header">
        <div class="theme-switcher" id="theme-switcher" aria-label="Cambiar tema">
          ${svg(ICON_MOON, 'id="theme-moon"')}
          ${svg(ICON_SUN, 'id="theme-sun" style="display:none"')}
        </div>
        <button class="mobile-close-btn" id="mobile-close-btn" aria-label="Cerrar chat">${svg(ICON_CLOSE_X)}</button>
        <div class="header-tabs" role="tablist">
          <div class="header-tab active" id="home-tab" role="tab" aria-selected="true" tabindex="0">${svg(ICON_HOME)} <span>Inicio</span></div>
          <div class="header-tab" id="chat-tab" role="tab" aria-selected="false" tabindex="-1">${svg(ICON_CHAT)} <span>Chat</span></div>
        </div>
        <div class="header-content">
          <div class="avatar"><img class="logo-icon-img" id="avatar" alt="Logo"></div>
          <div class="info">
            <h3 id="header-title"></h3>
            <p id="header-subtitle" class="help-subtitle"></p>
          </div>
        </div>
      </div>
      <div class="content-area">
        <div class="home-body" id="home-body" role="tabpanel">
          <div class="welcome-card">
            <h4>¡Hola! 👋 Bienvenido</h4>
            <p id="welcome-text">Soy el asistente inteligente de <strong>AgentOSweb</strong>. Puedo responder tus dudas sobre precios, instalación y funcionamiento 24/7.</p>
          </div>
          <button class="start-chat-btn" id="start-chat-btn">${svg(ICON_CHAT)} <span>Iniciar conversación</span></button>
          <div class="quick-prompts-title" id="quick-prompts-title">Preguntas Frecuentes</div>
          <div class="quick-prompts-list" id="prompt-list"></div>
          <div class="widget-brand">Powered by <span>AgentOSweb</span></div>
        </div>
        <div class="chat-body hidden-view" id="chat-body" role="tabpanel"></div>
      </div>
      <div class="chat-footer" id="chat-footer" style="display:none">
        <div class="input-bar">
          <button class="mic-button" id="mic-button" aria-label="Hablar por micrófono">${SVG_MIC}</button>
          <input type="text" id="message-input" placeholder="Escribe tu mensaje..." autocomplete="off">
          <button class="send-button" id="send-button" aria-label="Enviar mensaje">${SVG_SEND}</button>
        </div>
      </div>
    </div>`;
}

function createWidget(script: HTMLScriptElement) {
  const agentId = script.dataset.agentId || "";
  const apiBase = script.dataset.apiUrl || DEFAULT_API;
  const position = script.dataset.position === "left" ? "left" : "right";

  const host = document.createElement("agentosweb-widget");
  const shadow = host.attachShadow({ mode: "open" });
  const assetBase =
    script.dataset.assetUrl ||
    (script.src ? script.src.slice(0, script.src.lastIndexOf("/")) : "");
  const logoUrl = `${assetBase}/imagen/Logo_AgentOSweb_chat.png`;
  const iconoChatUrl = `${assetBase}/imagen/Icono_Chat.png`;
  shadow.innerHTML = `<style>${__CSS__}</style>${markup(logoUrl, iconoChatUrl)}`;

  host.style.cssText =
    `position:fixed;bottom:0;${position}:0;z-index:2147483647;width:0;height:0;`;
  host.classList.toggle("left", position === "left");
  document.body.appendChild(host);

  const $ = <T extends Element>(id: string) =>
    shadow.getElementById(id) as unknown as T;

  const toggleBtn = $<HTMLDivElement>("toggle-button");
  const container = $<HTMLDivElement>("chatbot-window");
  const chatIcon = $<SVGSVGElement>("chat-icon");
  const closeIcon = $<SVGSVGElement>("close-icon");
  const themeSwitcher = $<HTMLDivElement>("theme-switcher");
  const themeMoon = $<SVGSVGElement>("theme-moon");
  const themeSun = $<SVGSVGElement>("theme-sun");
  const mobileCloseBtn = $<HTMLButtonElement>("mobile-close-btn");
  const homeTab = $<HTMLDivElement>("home-tab");
  const chatTab = $<HTMLDivElement>("chat-tab");
  const homeBody = $<HTMLDivElement>("home-body");
  const chatBody = $<HTMLDivElement>("chat-body");
  const chatFooter = $<HTMLDivElement>("chat-footer");
  const headerTitle = $<HTMLHeadingElement>("header-title");
  const headerSubtitle = $<HTMLParagraphElement>("header-subtitle");
  const welcomeText = $<HTMLParagraphElement>("welcome-text");
  const avatarImg = $<HTMLImageElement>("avatar");
  const promptList = $<HTMLDivElement>("prompt-list");
  const quickPromptsTitle = $<HTMLDivElement>("quick-prompts-title");
  const startChatBtn = $<HTMLButtonElement>("start-chat-btn");
  const messageInput = $<HTMLInputElement>("message-input");
  const sendButton = $<HTMLButtonElement>("send-button");
  const micButton = $<HTMLButtonElement>("mic-button");

  let cfg: AgentConfig = DEFAULT_CONFIG;
  let hasGreeted = false;
  let isAnimating = false;
  let sessionFormShown = false;

  // El globo no se muestra hasta conocer el color de marca: evita el flash azul
  // por defecto en la primera visita. Se revela con la config en cache (r�pido)
  // o con la que trae el fetch; si ninguno llega a tiempo, sale con fallback.
  function showFab() {
    toggleBtn.classList.add("fab-visible");
  }
  const conversation: { text: string; sender: "bot" | "user" }[] = [];
  const sessionKey = `agentosweb-session-${agentId}`;
  const sessionId =
    (() => {
      const saved = localStorage.getItem(sessionKey);
      if (saved) return saved;
      const fresh = "s" + Date.now().toString(36) + Math.random().toString(36).slice(2);
      localStorage.setItem(sessionKey, fresh);
      return fresh;
    })();

  function applyTheme(isDarkMode: boolean) {
    container.classList.toggle("dark-mode", isDarkMode);
    themeMoon.style.display = isDarkMode ? "none" : "block";
    themeSun.style.display = isDarkMode ? "block" : "none";
    try {
      localStorage.setItem(THEME_KEY, isDarkMode ? "dark" : "light");
    } catch {
      /* sin almacenamiento disponible */
    }
  }

  function applyConfig(overrides: Partial<AgentConfig> | null) {
    if (overrides) cfg = { ...DEFAULT_CONFIG, ...overrides };
    headerTitle.textContent = cfg.header_title;
    headerSubtitle.textContent = cfg.header_subtitle;
    welcomeText.innerHTML = mdToHtml(cfg.welcome_message);
    avatarImg.src = cfg.avatar_url || logoUrl;
    $<HTMLImageElement>("chat-icon").src = cfg.bubble_logo_url || iconoChatUrl;
    const hasPrompts = cfg.prompts.length > 0;
    promptList.innerHTML = cfg.prompts
      .map(
        (p) =>
          `<div class="prompt-item" data-msg="${p.msg.replace(/"/g, "&quot;")}"><span>${p.label}</span>${svg(ICON_CHEVRON)}</div>`
      )
      .join("");
    quickPromptsTitle.style.display = hasPrompts ? "" : "none";
    promptList.style.display = hasPrompts ? "" : "none";
    if (overrides?.position) host.classList.toggle("left", overrides.position === "left");
    if (overrides?.default_theme && !localStorage.getItem(THEME_KEY)) {
      if (overrides.default_theme === "dark") applyTheme(true);
      else if (overrides.default_theme === "light") applyTheme(false);
    }
    if (overrides?.primary_color) {
      const c = overrides.primary_color;
      // Se aplican en el host (padre del shadow DOM) para que TODOS los elementos
      // (burbuja flotante + ventana) hereden el color de marca y sus brillos.
      host.style.setProperty("--primary-color", c);
      const gradientEnd = c.toLowerCase() === "#3559ff" ? "#13a0ff" : shadeColor(c, 28);
      host.style.setProperty("--primary-color-dark", gradientEnd);
      host.style.setProperty("--primary-gradient-start", c);
      host.style.setProperty("--primary-gradient-end", gradientEnd);
      host.style.setProperty("--primary-box-shadow", hexToRgba(c, 0.5));
      host.style.setProperty("--primary-box-shadow-glow", hexToRgba(c, 0.8));
      host.style.setProperty("--primary-box-shadow-soft", hexToRgba(c, 0.2));
      host.style.setProperty("--primary-tint", hexToRgba(c, 0.08));
      host.style.setProperty("--link-text-color", c);
      host.style.setProperty("--chat-bubble-color", c);
    }
    promptList
      .querySelectorAll<HTMLElement>(".prompt-item")
      .forEach((item) =>
        item.addEventListener("click", () => {
          if (!hasGreeted) botGreeting();
          const query = item.dataset.msg || "";
          switchTab("chat");
          messageInput.value = query;
          sendMessage();
        })
      );
  }

  function getFormattedDate() {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${day}/${month}/${now.getFullYear()}`;
  }

  function updateHeader(tab: "home" | "chat") {
    if (tab === "home") {
      headerTitle.textContent = cfg.header_title;
      headerSubtitle.textContent = cfg.header_subtitle;
    } else {
      headerTitle.textContent = "¿Preguntas? ¡Chatea con nosotros!";
      headerSubtitle.textContent = "Activo hoy " + getFormattedDate();
    }
  }

  let chatWasAtBottom = true;
  const wasChatAtBottom = () =>
    chatBody.scrollTop + chatBody.clientHeight >= chatBody.scrollHeight - 8;

  function switchTab(tab: "home" | "chat") {
    if (tab === "home") {
      chatWasAtBottom = wasChatAtBottom();
      homeTab.classList.add("active");
      homeTab.setAttribute("aria-selected", "true");
      chatTab.classList.remove("active");
      chatTab.setAttribute("aria-selected", "false");
      homeBody.classList.remove("hidden-view");
      chatBody.classList.add("hidden-view");
      chatFooter.style.display = "none";
      updateHeader("home");
      clearTimeout(typeTimer);
    } else {
      chatTab.classList.add("active");
      chatTab.setAttribute("aria-selected", "true");
      homeTab.classList.remove("active");
      homeTab.setAttribute("aria-selected", "false");
      chatBody.classList.remove("hidden-view");
      homeBody.classList.add("hidden-view");
      chatFooter.style.display = "flex";
      updateHeader("chat");
      if (chatWasAtBottom) chatBody.scrollTop = chatBody.scrollHeight;
      if (!hasGreeted) botGreeting();
      if (!messageInput.value.trim()) typePlaceholderEffect(100);
    }
  }

  function getAnimatedAvatarHtml() {
    return `<div class="avatar-container"><div class="avatar-head"></div><div class="eyes"><div class="eye"></div><div class="eye"></div></div></div>`;
  }

  function escapeHtml(s: string) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function mdToHtml(text: string) {
    const lines = escapeHtml(text)
      .split("\n")
      .map((line) => {
        const bullet = line.match(/^\s*(?:[-*])\s+(.*)$/) || line.match(/^\s*\d+[.)]\s+(.*)$/);
        const core = bullet ? bullet[1] : line;
        const converted = core
          .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
          .replace(/(^|[^*])\*([^*]+?)\*(?!\*)/g, "$1<em>$2</em>")
          .replace(/`([^`]+)`/g, "<code>$1</code>");
        return bullet ? `<div class="md-bullet">• ${converted}</div>` : converted;
      })
      .join("\n");
    return lines.replace(/\n+/g, "<br>");
  }

  function renderMessage(text: string, sender: "bot" | "user", isTyping = false) {
    const row = document.createElement("div");
    row.classList.add("chat-message", sender);
    if (isTyping) row.classList.add("typing-indicator");
    const content = document.createElement("div");
    content.className = "message-content";
    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    if (isTyping) {
      bubble.innerHTML = "<span></span><span></span><span></span>";
    } else if (sender === "bot") {
      bubble.innerHTML = mdToHtml(text);
    } else {
      bubble.textContent = text;
    }
    if (sender === "user") {
      content.appendChild(bubble);
    } else {
      const icon = document.createElement("div");
      icon.className = "message-icon";
      icon.innerHTML = getAnimatedAvatarHtml();
      row.appendChild(icon);
      const label = document.createElement("span");
      label.className = "message-sender";
      label.textContent = cfg.header_title;
      content.appendChild(label);
      content.appendChild(bubble);
    }
    row.appendChild(content);
    chatBody.appendChild(row);
    chatBody.scrollTop = chatBody.scrollHeight;
    return row;
  }

  const FIELD_SPEC: Record<string, { label: string; placeholder: string; type: string }> = {
    name: { label: "Nombre", placeholder: "Tu nombre", type: "text" },
    email: { label: "Email", placeholder: "tucorreo@ejemplo.com", type: "email" },
    phone: { label: "Teléfono", placeholder: "11 2345 6789", type: "tel" },
  };

  function renderLeadForm(fields: string[]) {
    const row = document.createElement("div");
    row.className = "chat-message bot";
    const content = document.createElement("div");
    content.className = "message-content";
    const icon = document.createElement("div");
    icon.className = "message-icon";
    icon.innerHTML = getAnimatedAvatarHtml();
    row.appendChild(icon);
    const label = document.createElement("span");
    label.className = "message-sender";
    label.textContent = cfg.header_title;
    content.appendChild(label);

    const card = document.createElement("div");
    card.className = "lead-form-card";
    const title = document.createElement("div");
    title.className = "lead-form-title";
    title.textContent = "¿Dejamos tus datos? 💬";
    const sub = document.createElement("div");
    sub.className = "lead-form-sub";
    sub.textContent =
      "Parece que te interesa el servicio. Dejá tu contacto y te respondemos a la brevedad:";
    card.appendChild(title);
    card.appendChild(sub);

    const inputs = new Map<string, HTMLInputElement>();
    const specs = fields.map((f) => FIELD_SPEC[f]).filter(Boolean);
    if (specs.length === 0) return;
    for (const spec of specs) {
      const fieldId = fields.find((f) => FIELD_SPEC[f] === spec)!;
      const el = document.createElement("input");
      el.type = spec.type;
      el.className = "lead-form-field";
      el.placeholder = spec.placeholder;
      el.setAttribute("aria-label", spec.label);
      inputs.set(fieldId, el);
      card.appendChild(el);
    }

    const msg = document.createElement("textarea");
    msg.className = "lead-form-field lead-form-message";
    msg.placeholder = "¿Sobre qué te gustaría hablar? (opcional)";
    msg.setAttribute("aria-label", "Mensaje");
    msg.rows = 2;
    card.appendChild(msg);

    const send = document.createElement("button");
    send.type = "button";
    send.className = "lead-form-send";
    send.textContent = "Enviar mis datos";
    card.appendChild(send);
    const note = document.createElement("div");
    note.className = "lead-form-note";
    note.textContent = "Podés seguir chateando mientras tanto.";
    card.appendChild(note);

    send.addEventListener("click", async () => {
      const payload: Record<string, string> = { agent_id: agentId, session_id: sessionId };
      const typed = msg.value.trim();
      if (typed) {
        payload.interest = typed;
      } else {
        const lastUser = [...conversation].reverse().find((m) => m.sender === "user");
        if (lastUser) payload.interest = lastUser.text;
      }
      for (const [k, el] of inputs) payload[k] = el.value.trim();
      send.disabled = true;
      send.textContent = "Enviando…";
      try {
        const res = await fetch(`${apiBase}/leads`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok && res.status !== 201) {
          const err = (await res.json().catch(() => ({})) as { error?: string }).error;
          throw new Error(err || "No guardamos tus datos. Intentá de nuevo.");
        }
        card.replaceChildren();
        title.textContent = "¡Gracias! ✨";
        sub.textContent = "Ya recibimos tus datos. Te vamos a responder pronto.";
        card.appendChild(title);
        card.appendChild(sub);
        note.textContent = "";
        card.after(note);
      } catch (e) {
        send.disabled = false;
        send.textContent = "Enviar mis datos";
        note.textContent = e instanceof Error ? e.message : "Hubo un error, intentá de nuevo.";
      }
    });

    content.appendChild(card);
    row.appendChild(content);
    chatBody.appendChild(row);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function botGreeting() {
    renderMessage(cfg.welcome_message, "bot");
    hasGreeted = true;
  }

  let typeTimer: ReturnType<typeof setTimeout> | undefined;

  function typePlaceholderEffect(initialDelay = 500) {
    clearTimeout(typeTimer);
    let phraseIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    const type = () => {
      const currentPhrase = CHAT_PHRASES[phraseIndex];
      const active = messageInput.matches(":focus") || messageInput.value.length > 0;
      if (active) {
        messageInput.placeholder = CHAT_PHRASES[0];
        return;
      }
      messageInput.placeholder = currentPhrase.substring(0, charIndex) + "|";
      if (isDeleting) {
        charIndex--;
      } else {
        charIndex++;
      }
      let next = isDeleting ? 30 : 70;
      if (!isDeleting && charIndex > currentPhrase.length) {
        isDeleting = true;
        charIndex = currentPhrase.length;
        next = 1500;
      } else if (isDeleting && charIndex < 0) {
        isDeleting = false;
        phraseIndex = (phraseIndex + 1) % CHAT_PHRASES.length;
        charIndex = 0;
        next = 500;
      }
      typeTimer = setTimeout(type, next);
    };
    typeTimer = setTimeout(type, initialDelay);
  }

  async function sendMessage() {
    const messageText = messageInput.value.trim();
    if (!messageText) return;
    clearTimeout(typeTimer);
    conversation.push({ text: messageText, sender: "user" });
    renderMessage(messageText, "user");
    messageInput.value = "";
    messageInput.placeholder = "Escribe tu mensaje...";
    updateSendIdle();

    const typing = new Promise<HTMLElement>((r) => setTimeout(() => r(renderMessage("", "bot", true)), 400));
    const minDelay = new Promise((r) => setTimeout(r, 1000));
    let botReply = "";
    let form: { fields: string[] } | undefined;

    const callApi = async (): Promise<{ reply: string | null; form?: { fields: string[] } }> => {
      const res = await fetch(`${apiBase}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: agentId,
          message: messageText,
          session_id: sessionId,
        }),
      });
      // 404 = agente pausado o eliminado: cortar sin fallback local
      if (res.status === 404) return { reply: null };
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = (await res.json()) as { reply?: string; form?: { fields: string[] } };
      return {
        reply: data.reply || "¡Recibido! ¿En qué más te puedo colaborar?",
        form: Array.isArray(data.form?.fields) && data.form.fields.length > 0 ? data.form : undefined,
      };
    };

    try {
      try {
        const data = await callApi();
        botReply = data.reply === null ? PAUSED_REPLY : data.reply;
        form = data.form;
      } catch {
        await new Promise((r) => setTimeout(r, 1500));
        const data = await callApi();
        botReply = data.reply === null ? PAUSED_REPLY : data.reply;
        form = data.form;
      }
      await minDelay;
    } catch {
      await minDelay;
      botReply = localReply(messageText, cfg);
    }

    (await typing).remove();
    conversation.push({ text: botReply, sender: "bot" });
    renderMessage(botReply, "bot");
    if (form && !sessionFormShown) {
      sessionFormShown = true;
      renderLeadForm(form.fields);
    }
  }

  function updateSendIdle() {
    sendButton.classList.toggle("idle", !messageInput.value.trim());
  }

  // 🎙️ Voz a texto (Web Speech API) — patrones estándar, sin dependencias
  const SpeechRecognitionCtor =
    (window as unknown as { SpeechRecognition?: new () => void; webkitSpeechRecognition?: new () => void })
      .SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: new () => void }).webkitSpeechRecognition;

  if (SpeechRecognitionCtor && micButton) {
    const recognition = new SpeechRecognitionCtor() as unknown as {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onstart: (() => void) | null;
      onresult: ((e: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
      onerror: ((e: { error: string }) => void) | null;
      onend: (() => void) | null;
      start: () => void;
      stop: () => void;
    };
    let isRecording = false;

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = (navigator.language || "es-ES").startsWith("en") ? "en-US" : "es-ES";

    recognition.onstart = () => {
      isRecording = true;
      micButton.classList.add("recording");
      micButton.setAttribute("aria-label", "Detener grabación");
      messageInput.placeholder = "Escuchando... 🎙️";
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript || "";
      if (transcript) {
        messageInput.value = transcript;
        updateSendIdle();
      }
    };

    recognition.onerror = (event) => {
      isRecording = false;
      micButton.classList.remove("recording");
      micButton.setAttribute("aria-label", "Hablar por micrófono");
      messageInput.placeholder = CHAT_PHRASES[0];
      if (event.error === "not-allowed") {
        messageInput.placeholder = "Micrófono bloqueado 🔇 habilítalo en tu navegador";
        setTimeout(() => (messageInput.placeholder = CHAT_PHRASES[0]), 3000);
      }
    };

    recognition.onend = () => {
      isRecording = false;
      micButton.classList.remove("recording");
      micButton.setAttribute("aria-label", "Hablar por micrófono");
      if (messageInput.placeholder === "Escuchando... 🎙️") messageInput.placeholder = CHAT_PHRASES[0];
      if (messageInput.value.trim()) {
        switchTab("chat");
        sendMessage();
      }
    };

    micButton.addEventListener("click", () => {
      if (isRecording) recognition.stop();
      else {
        try {
          recognition.start();
        } catch {
          // Ya iniciado: ignorar clics dobles
        }
      }
    });
  } else if (micButton) {
    micButton.style.display = "none";
  }

  applyConfig(null);
  updateSendIdle();

  // Pintar el color de marca guardado ANTES de que llegue la config del worker,
  // para evitar el parpadeo azul por defecto. La DB siempre gana después.
  let cachedBrand: Partial<AgentConfig> | null = null;
  try {
    cachedBrand = JSON.parse(localStorage.getItem(BRAND_KEY + "_" + agentId) || "null");
  } catch {
    /* críptico no bloquea */
  }
  if (cachedBrand && typeof cachedBrand === "object" && cachedBrand.primary_color) {
    applyConfig(cachedBrand);
    showFab();
  }

  // Fallback: si el fetch de config tarda (red lenta), mostrar el globo con los
  // colores por defecto antes que nada; as� el widget nunca queda invisible.
  const revealFallback = window.setTimeout(showFab, 2500);

  const savedTheme = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(savedTheme ? savedTheme === "dark" : prefersDark);

  themeSwitcher.addEventListener("click", () => {
    applyTheme(!container.classList.contains("dark-mode"));
  });

  toggleBtn.addEventListener("click", () => {
    if (isAnimating) return;
    isAnimating = true;
    const isOpen = container.classList.contains("open");
    if (!isOpen) {
      container.classList.remove("hidden", "exit-fade");
      setTimeout(() => {
        container.classList.add("open");
        toggleBtn.setAttribute("aria-expanded", "true");
        toggleBtn.classList.add("chat-open-mobile");
        chatIcon.style.display = "none";
        closeIcon.style.display = "block";
        toggleBtn.classList.remove("floating");
        toggleBtn.classList.add("hover-disabled");
        if (!messageInput.value.trim()) typePlaceholderEffect(300);
        isAnimating = false;
      }, 10);
    } else {
      container.classList.add("exit-fade");
      container.classList.remove("open");
      toggleBtn.setAttribute("aria-expanded", "false");
      toggleBtn.classList.remove("chat-open-mobile");
      chatIcon.style.display = "block";
      closeIcon.style.display = "none";
      toggleBtn.classList.add("floating");
      toggleBtn.classList.remove("hover-disabled");
      clearTimeout(typeTimer);
      setTimeout(() => {
        container.classList.add("hidden");
        isAnimating = false;
      }, 200);
    }
  });

  mobileCloseBtn.addEventListener("click", () => toggleBtn.click());
  homeTab.addEventListener("click", () => switchTab("home"));
  chatTab.addEventListener("click", () => switchTab("chat"));
  startChatBtn.addEventListener("click", () => switchTab("chat"));
  sendButton.addEventListener("click", sendMessage);
  messageInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
  });
  messageInput.addEventListener("input", () => {
    clearTimeout(typeTimer);
    messageInput.placeholder = CHAT_PHRASES[0];
    updateSendIdle();
    if (!messageInput.value.trim()) typePlaceholderEffect(200);
  });
  messageInput.addEventListener("blur", () => {
    if (!messageInput.value.trim()) typePlaceholderEffect(200);
  });

  fetch(`${apiBase}/agent/${agentId}`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error("config"))))
    .then((c: Partial<AgentConfig>) => {
      applyConfig(c);
      window.clearTimeout(revealFallback);
      showFab();
      try {
        localStorage.setItem(BRAND_KEY + "_" + agentId, JSON.stringify({ primary_color: c.primary_color }));
      } catch {
        /* sin almacenamiento no bloquea */
      }
    })
    .catch(() => {});

  (window as unknown as { AgentOSweb?: { agentId: string; apiUrl: string } })
    .AgentOSweb = { agentId, apiUrl: apiBase };
}

function bootstrap() {
  const scripts = document.querySelectorAll<HTMLScriptElement>(
    "script[data-agent-id], script[src*=\"widget.js\"]"
  );
  const script =
    Array.from(scripts).find((s) => s.src.includes("widget.js")) || scripts[0];
  if (!script) {
    console.warn("AgentOSweb: falta data-agent-id en el script del widget.");
    return;
  }
  const agentId =
    script.dataset.agentId ||
    (script.src.match(/\/w\/([a-f0-9-]{36})\/widget\.js/) || [])[1] ||
    "";
  if (!agentId) return;
  if (!script.dataset.agentId) script.dataset.agentId = agentId;
  createWidget(script);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}