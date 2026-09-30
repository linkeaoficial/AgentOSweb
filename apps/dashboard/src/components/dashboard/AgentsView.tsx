"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconClose } from "./icons";
import { useToast } from "./notifications";
import ConfirmModal from "./ConfirmModal";

interface FaqDraft {
  label: string;
  answer: string;
}

interface AgentConfig {
  id: string;
  name: string;
  header_title: string;
  header_subtitle: string;
  welcome_message: string;
  avatar_url: string | null;
  bubble_logo_url: string | null;
  primary_color: string;
  position: "right" | "left";
  default_theme: "light" | "dark" | "auto";
  system_prompt: string;
  knowledge_base: string | null;
  max_tokens: number;
  allowed_domains: string;
  rate_limit_per_minute: number;
  is_active: number;
  mode: string;
  chat_provider: string;
  chat_model: string;
  chat_base_url: string | null;
  has_chat_api_key: boolean;
  byok_provider: string | null;
  byok_model: string | null;
  faqs: FaqDraft[];
  lead_capture: boolean;
  lead_fields: string[];
}

interface AgentsViewProps {
  apiBase: string;
  agentId: string;
  plan?: string | null;

  onActiveChange?: (active: boolean) => void;
  onChanged?: () => void;
  onDeleted?: (id: string) => void;
}

const LIMITS = {
  header_title: 120,
  header_subtitle: 200,
  welcome_message: 1000,
  system_prompt: 10000,
  knowledge_base: 20000,
  faq_label: 120,
  faq_answer: 5000,
  faq_max: 50,
};

const MANAGED_MODELS = [
  { id: "@cf/meta/llama-3.1-8b-instruct-fast", name: "Llama 3.1 8B Flash (rápido y económico)" },
  { id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", name: "Llama 3.3 70B FP8 (mayor calidad)" },
];
const MANAGED_DEFAULT = MANAGED_MODELS[0].id;

const BYOK_PROVIDERS: Record<string, { label: string; models: { id: string; name: string }[] }> = {
  openai: {
    label: "OpenAI",
    models: [
      { id: "gpt-5.5", name: "GPT-5.5 (lo más nuevo · máxima capacidad)" },
      { id: "gpt-5.4", name: "GPT-5.4 (nuevo · profesional)" },
      { id: "gpt-5.4-mini", name: "GPT-5.4 Mini (nuevo · ideal para atención al cliente)" },
      { id: "gpt-5.4-nano", name: "GPT-5.4 Nano (nuevo · el más barato)" },
      { id: "gpt-5.1", name: "GPT-5.1 (generación anterior)" },
      { id: "gpt-4o", name: "GPT-4o (legacy)" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini (legacy · rápido)" },
    ],
  },
  groq: {
    label: "Groq",
    models: [
      { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B Versatile (calidad · gratis)" },
      { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant (ultrarrápido · gratis)" },
      { id: "openai/gpt-oss-120b", name: "OpenAI GPT-OSS 120B (razonamiento fuerte · gratis)" },
      { id: "openai/gpt-oss-20b", name: "OpenAI GPT-OSS 20B (rápido · gratis)" },
      { id: "meta-llama/llama-4-scout-17b-16e-instruct", name: "Llama 4 Scout 17B (nuevo · gratis)" },
      { id: "meta-llama/llama-4-maverick-17b-128e-instruct", name: "Llama 4 Maverick (preview)" },
      { id: "qwen/qwen3-32b", name: "Qwen 3 32B (preview · gratis)" },
    ],
  },
  nvidia: {
    label: "NVIDIA (NIM)",
    models: [
      { id: "nvidia/nemotron-3-ultra-550b-a55b", name: "Nemotron 3 Ultra (lo más potente · gratis)" },
      { id: "nvidia/nemotron-3-super-120b-a12b", name: "Nemotron 3 Super 120B (gratis)" },
      { id: "nvidia/llama-3.1-nemotron-ultra-253b-v1", name: "Nemotron Ultra 253B (razonamiento · gratis)" },
      { id: "deepseek-ai/deepseek-v4-flash-0731", name: "DeepSeek V4 Flash (host NVIDIA · gratis)" },
      { id: "deepseek-ai/deepseek-v4-pro-0813", name: "DeepSeek V4 Pro (host NVIDIA · gratis)" },
      { id: "meta/llama-3.3-70b-instruct", name: "Llama 3.3 70B Instruct (gratis)" },
      { id: "openai/gpt-oss-120b", name: "OpenAI GPT-OSS 120B (gratis)" },
      { id: "stepfun/step-3.7-flash", name: "StepFun Step 3.7 Flash (nuevo · gratis)" },
      { id: "moonshotai/kimi-k3", name: "Kimi K3 (nuevo · gratis)" },
      { id: "minimaxai/minimax-m3", name: "MiniMax M3 (nuevo · gratis)" },
      { id: "google/gemma-4-31b-it", name: "Google Gemma 4 31B (gratis)" },
    ],
  },
  cerebras: {
    label: "Cerebras (WSE)",
    models: [
      { id: "gpt-oss-120b", name: "GPT-OSS 120B (ultrarrápido · pago)" },
      { id: "qwen-3.8-27b", name: "Qwen 3.8 27B (rápido y eficiente · pago)" },
    ],
  },
  deepseek: {
    label: "DeepSeek",
    models: [{ id: "deepseek-flash", name: "DeepSeek V4.1 Flash (rápido, barato)" }],
  },
  gemini: {
    label: "Google Gemini",
    models: [
      { id: "gemini-3.8-flash", name: "Gemini 3.8 Flash (lo más nuevo)" },
      { id: "gemini-3.7-flash", name: "Gemini 3.7 Flash" },
      { id: "gemini-3.6-flash", name: "Gemini 3.6 Flash" },
      { id: "gemini-3.5-flash", name: "Gemini 3.5 Flash (estable)" },
      { id: "gemini-3.5-flash-lite", name: "Gemini 3.5 Flash Lite (económico)" },
      { id: "gemini-3.1-flash-lite", name: "Gemini 3.1 Flash Lite (simple y barato)" },
      { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro (máxima capacidad)" },
    ],
  },
  mistral: {
    label: "Mistral AI",
    models: [
      { id: "mistral-small-latest", name: "Mistral Small 4 (rápido · gratis)" },
      { id: "mistral-medium-latest", name: "Mistral Medium 3.5 (equilibrado · gratis)" },
      { id: "mistral-large-latest", name: "Mistral Large 3 (máxima calidad · gratis)" },
      { id: "ministral-8b-latest", name: "Ministral 3 8B (atención al cliente · gratis)" },
      { id: "ministral-3b-latest", name: "Ministral 3 3B (ultrarrápido)" },
    ],
  },
  qwen: {
    label: "Qwen (Alibaba)",
    models: [
      { id: "qwen3.8-max", name: "Qwen3.8 Max (lo más nuevo · máxima capacidad)" },
      { id: "qwen3.7-max", name: "Qwen3.7 Max (flagship)" },
      { id: "qwen3.7-plus", name: "Qwen3.7 Plus (equilibrado)" },
      { id: "qwen3.6-flash", name: "Qwen3.6 Flash (rápido)" },
      { id: "qwen3-coder-plus", name: "Qwen3 Coder Plus (código · 1M contexto)" },
      { id: "qwen3-max", name: "Qwen3 Max" },
      { id: "qwen3-plus", name: "Qwen3 Plus" },
      { id: "qwen-plus", name: "Qwen Plus (long context · atención al cliente)" },
      { id: "qwen-turbo", name: "Qwen Turbo (rápido y barato)" },
    ],
  },
  openrouter: {
    label: "OpenRouter",
    models: [
      { id: "openai/gpt-5.6-luna", name: "OpenAI GPT-5.6 Luna (rápido/barato)" },
      { id: "openai/gpt-chat-latest", name: "OpenAI GPT Chat Latest (siempre el último)" },
      { id: "anthropic/claude-sonnet-5", name: "Anthropic Claude Sonnet 5 (calidad)" },
      { id: "anthropic/claude-opus-4.8", name: "Anthropic Claude Opus 4.8 (máxima)" },
      { id: "google/gemini-3.5-flash", name: "Google Gemini 3.5 Flash" },
      { id: "deepseek/deepseek-v4-flash", name: "DeepSeek V4 Flash" },
      { id: "meta-llama/llama-4-maverick", name: "Meta Llama 4 Maverick" },
      { id: "z-ai/glm-5.2", name: "Z.ai GLM 5.2 (1M de contexto, barato)" },
      { id: "x-ai/grok-4.3", name: "xAI Grok 4.3" },
      { id: "minimax/minimax-m3", name: "MiniMax M3 (mucho contexto)" },
      { id: "openai/gpt-5.6-sol", name: "OpenAI GPT-5.6 Sol (razonamiento fuerte)" },
      { id: "openai/gpt-5.6-terra", name: "OpenAI GPT-5.6 Terra" },
      { id: "anthropic/claude-opus-5", name: "Anthropic Claude Opus 5 (lo más nuevo)" },
      { id: "anthropic/claude-haiku-4.5", name: "Anthropic Claude Haiku 4.5 (rápido y barato)" },
      { id: "google/gemini-3.7-flash", name: "Google Gemini 3.7 Flash" },
      { id: "google/gemini-3.1-flash-lite", name: "Google Gemini 3.1 Flash Lite (económico)" },
      { id: "deepseek/deepseek-v4-pro", name: "DeepSeek V4 Pro" },
      { id: "deepseek/deepseek-v4-flash-0731", name: "DeepSeek V4 Flash 0731 (barato)" },
      { id: "tencent/hy4-preview", name: "Tencent Hy4 (de los más usados)" },
      { id: "z-ai/glm-5.3", name: "Z.ai GLM 5.3 (1M contexto, barato)" },
      { id: "moonshotai/kimi-k3", name: "Moonshot Kimi K3 (razonamiento)" },
      { id: "qwen/qwen3.7-max", name: "Qwen 3.7 Max" },
      { id: "nvidia/nemotron-3-ultra-550b-a55b", name: "NVIDIA Nemotron 3 Ultra (gratis)" },
      { id: "stepfun/step-3.7-flash", name: "StepFun Step 3.7 Flash" },
      { id: "xiaomi/mimo-v2.5", name: "Xiaomi MiMo-V2.5" },
      { id: "meta-llama/llama-4-scout", name: "Meta Llama 4 Scout" },
      { id: "anthropic/claude-sonnet-4.6", name: "Anthropic Claude Sonnet 4.6 (nuevo · calidad)" },
      { id: "anthropic/claude-sonnet-4.5", name: "Anthropic Claude Sonnet 4.5" },
      { id: "anthropic/claude-opus-4.7", name: "Anthropic Claude Opus 4.7" },
      { id: "anthropic/claude-opus-4.6", name: "Anthropic Claude Opus 4.6" },
      { id: "openai/gpt-5.4-mini", name: "OpenAI GPT-5.4 Mini (nuevo · barato)" },
      { id: "z-ai/glm-5.2:free", name: "Z.ai GLM 5.2 (gratis · 200 consultas/día)" },
      { id: "minimax/minimax-m3:free", name: "MiniMax M3 (gratis · 50 consultas/día)" },
      { id: "nvidia/nemotron-3.5-lightning:free", name: "NVIDIA Nemotron 3.5 Lightning (gratis)" },
      { id: "nvidia/nemotron-3-super-120b-a12b:free", name: "NVIDIA Nemotron 3 Super (gratis)" },
      { id: "google/gemma-4-31b-it:free", name: "Google Gemma 4 31B (gratis)" },
      { id: "thinkingmachines/inkling-small:free", name: "Thinking Machines Inkling Small (gratis · veloz)" },
      { id: "liquid/lfm-2.5-2.6b:free", name: "Liquid LFM 2.5 (gratis · pequeño y rápido)" },
      { id: "inclusionai/ling-3.0-flash-fin:free", name: "Inclusion AI Ling 3.0 Flash Fin (gratis · buen español)" },
      { id: "cohere/north-mini-code:free", name: "Cohere North Mini Code (gratis · código)" },
      { id: "openrouter/free", name: "OpenRouter Gratis (gratis · elige el mejor gratis automáticamente)" },
    ],
  },
  onnirouter: {
    label: "OmniRouter",
    models: [
      { id: "claude-sonnet", name: "Claude Sonnet (router inteligente)" },
      { id: "gpt-5-6-luna", name: "GPT-5.6 Luna (equilibrado)" },
      { id: "gpt-5-4-mini", name: "GPT-5.4 Mini (atención al cliente)" },
      { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash" },
      { id: "deepseek-v3-2", name: "DeepSeek V3.2 (el más barato)" },
      { id: "claude-opus-5", name: "Claude Opus 5 (máxima capacidad)" },
      { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
      { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5" },
      { id: "claude-opus-4-7", name: "Claude Opus 4.7" },
      { id: "claude-opus-4-6", name: "Claude Opus 4.6" },
      { id: "claude-sonnet-5", name: "Claude Sonnet 5" },
      { id: "claude-haiku-4-5", name: "Claude Haiku 4.5 (rápido y barato)" },
      { id: "gemini-3-7-flash", name: "Gemini 3.7 Flash" },
      { id: "glm-5-3", name: "Z.ai GLM 5.3 (barato)" },
      { id: "gpt-5-6-sol", name: "GPT-5.6 Sol" },
      { id: "gpt-5-6-terra", name: "GPT-5.6 Terra" },
      { id: "gpt-5-5", name: "GPT-5.5" },
      { id: "gpt-5-4", name: "GPT-5.4" },
      { id: "gpt-5-4-nano", name: "GPT-5.4 Nano (ultrarrápido)" },
      { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro" },
      { id: "deepseek-v4-flash-0731", name: "DeepSeek V4 Flash 0731" },
      { id: "grok-4-3", name: "Grok 4.3" },
    ],
  },
  unorouter: {
    label: "UnoRouter",
    models: [
      { id: "deepseek-v4-flash:free", name: "DeepSeek V4 Flash (gratis · 1M contexto)" },
      { id: "deepseek-v4-pro:free", name: "DeepSeek V4 Pro (gratis · 1M contexto)" },
      { id: "gpt-5.5:free", name: "OpenAI GPT-5.5 (gratis · 1M contexto)" },
      { id: "gpt-5.4:free", name: "OpenAI GPT-5.4 (gratis · 1M contexto)" },
      { id: "glm-5.2:free", name: "Z.ai GLM 5.2 (gratis · 1M contexto)" },
      { id: "glm-4.5-flash:free", name: "Z.ai GLM 4.5 Flash (gratis · rápido)" },
      { id: "gemma-4-31b-it:free", name: "Google Gemma 4 31B (gratis)" },
      { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash (barato · $0.06/M in)" },
      { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro (flagship · $0.90/M in)" },
      { id: "gpt-5.5", name: "OpenAI GPT-5.5 (equilibrado · $0.19/M in)" },
      { id: "gpt-5.4", name: "OpenAI GPT-5.4 (profesional · $1.80/M in)" },
      { id: "gemini-3.5-flash", name: "Google Gemini 3.5 Flash ($0.19/M in)" },
      { id: "glm-5.2", name: "Z.ai GLM 5.2 (1M contexto · $1.60/M in)" },
      { id: "kimi-k2.6", name: "Moonshot Kimi K2.6 (1M contexto · $1.27/M in)" },
      { id: "minimax-m2.7", name: "MiniMax M2.7 (nuevo · $0.82/M in)" },
      { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5 (rápido · $1.20/M in)" },
      { id: "claude-sonnet-5", name: "Claude Sonnet 5 (calidad · $1.44/M in)" },
      { id: "claude-opus-4-8", name: "Claude Opus 4.8 (máxima calidad)" },
    ],
  },
  custom: { label: "Otro (URL personalizada)", models: [] },
};
const BYOK_PROVIDER_IDS = ["deepseek", "openai", "groq", "nvidia", "gemini", "mistral", "qwen", "openrouter", "onnirouter", "unorouter", "cerebras", "custom"];

const DEFAULT_BYOK_MODEL: Record<string, string> = {
  openai: "gpt-5.4-mini",
  groq: "llama-3.3-70b-versatile",
  deepseek: "deepseek-flash",
  nvidia: "nvidia/nemotron-3-ultra-550b-a55b",
  gemini: "gemini-3.8-flash",
  mistral: "mistral-small-latest",
  qwen: "qwen-plus",
  openrouter: "openai/gpt-5.6-luna",
  onnirouter: "gpt-5-4-mini",
  unorouter: "deepseek-v4-flash:free",
  cerebras: "gpt-oss-120b",
  custom: "",
};

export function shadeColor(hex: string, percent: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (shift: number) => {
    const v = (n >> shift) & 255;
    const t = percent < 0 ? 0 : 255;
    const p = Math.abs(percent) / 100;
    return Math.round((t - v) * p + v);
  };
  return "#" + ((1 << 24) | (mix(16) << 16) | (mix(8) << 8) | mix(0)).toString(16).slice(1);
}

export function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

const pe = (d: string) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const renderInline = (md: string) =>
  md.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part));

const EYE_ICON = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EYE_OFF_ICON = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 0 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`segmented-btn ${value === o.value ? "active" : ""}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Dropdown({
  value,
  options,
  onChange,
  placeholder = "Selecciona…",
}: {
  value: string;
  options: { id: string; name: string }[];
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((o) => o.id === value);

  useEffect(() => {
    if (!open) return;
    const root = rootRef.current;
    if (root) {
      const rect = root.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setUp(spaceBelow < 230 && rect.top > spaceBelow);
    }
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="dropdown" ref={rootRef}>
      <button
        type="button"
        className="dropdown-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="dropdown-trigger-label">{selected ? selected.name : value || placeholder}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 10 6"
          className={`dropdown-chevron ${open ? "open" : ""}`}
        >
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className={`dropdown-menu ${up ? "up" : ""}`} role="listbox">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              className={`dropdown-option ${o.id === value ? "active" : ""}`}
              onClick={() => {
                onChange(o.id);
                setOpen(false);
              }}
            >
              <span>{o.name}</span>
              {o.id === value && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type PreviewMessage = { text: string; sender: "bot" | "user"; typing?: boolean };

function formatToday() {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(now.getDate())}/${p(now.getMonth() + 1)}/${now.getFullYear()}`;
}

const ICON_HOME_PATHS = [
  "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8",
  "M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
];
const ICON_SUN_RAYS = [
  "M12 2v2",
  "M12 20v2",
  "m4.93 4.93 1.41 1.41",
  "m17.66 17.66 1.41 1.41",
  "M2 12h2",
  "M20 12h2",
  "m6.34 17.66-1.41 1.41",
  "m19.07 4.93-1.41 1.41",
];
const TYPE_PHRASES = [
  "Escribe tu mensaje...",
  "Haz una pregunta...",
  "¿Tienes alguna duda?",
  "¿En qué podemos ayudarte?",
];

interface RecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((e: { results: Array<Array<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
const ICON_CHAT_D = "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z";
const ICON_MOON_D = "M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z";
const ICON_MIC_D = "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3ZM19 10v2a7 7 0 0 1-14 0v-2M12 19v3";
const ICON_SEND_D = "M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6-6-6z";

function WidgetMock({
  cfg,
  open,
  onToggle,
  apiBase,
  agentId,
}: {
  cfg: AgentConfig;
  open: boolean;
  onToggle: () => void;
  apiBase: string;
  agentId: string;
}) {
  const [tab, setTab] = useState<"home" | "chat">("home");
  const [messages, setMessages] = useState<PreviewMessage[]>([]);
  const [input, setInput] = useState("");
  const [placeholder, setPlaceholder] = useState(TYPE_PHRASES[0]);
  const [sending, setSending] = useState(false);
  const [manualDark, setManualDark] = useState(false);
  const [focused, setFocused] = useState(false);
  const greeted = useRef(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const [recording, setRecording] = useState(false);
  const [micOk, setMicOk] = useState(true);
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const sendRef = useRef<(raw: string) => void>(() => {});
  const inputRef = useRef("");

  const dark = cfg.default_theme === "dark" || manualDark;
  const start = cfg.primary_color;
  const end = cfg.primary_color.toLowerCase() === "#3559ff" ? "#13a0ff" : shadeColor(cfg.primary_color, 28);
  const grad = `linear-gradient(135deg, ${start}, ${end})`;
  const gradVertical = `linear-gradient(to bottom, ${start}, ${end})`;
  const containerBgc = dark ? "#18181b" : "#ffffff";
  const cardBgc = dark ? "rgba(24,24,27,0.85)" : "#ffffff";
  const cardBorder = dark ? "#3f3f46" : "#e2e8f0";
  const textMain = dark ? "#f4f4f5" : "#0f172a";
  const textSub = dark ? "#a1a1aa" : "#64748b";
  const chatText = dark ? "#e4e4e7" : "#333333";
  const borderColor = dark ? "#2e2e33" : "#dddddd";
  const inputBgc = dark ? "#202024" : "#f1f5f9";
  const scene = dark ? "linear-gradient(180deg,#111114,#09090b)" : "linear-gradient(180deg,#eef2f7,#f8fafc)";
  const isChat = tab === "chat";

  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    inputRef.current = input;
    sendRef.current = sendMessage;
  });

  useEffect(() => {
    if (!isChat || recording) return;
    let phraseIndex = 0;
    let charIndex = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      if (focused || input) {
        setPlaceholder(focused ? TYPE_PHRASES[0] : "");
        return;
      }
      const phrase = TYPE_PHRASES[phraseIndex];
      setPlaceholder(phrase.substring(0, charIndex) + "|");
      if (deleting) charIndex--;
      else charIndex++;
      let next = deleting ? 30 : 70;
      if (!deleting && charIndex > phrase.length) {
        deleting = true;
        charIndex = phrase.length;
        next = 1500;
      } else if (deleting && charIndex < 0) {
        deleting = false;
        phraseIndex = (phraseIndex + 1) % TYPE_PHRASES.length;
        charIndex = 0;
        next = 500;
      }
      timer = setTimeout(tick, next);
    };
    timer = setTimeout(tick, 300);
    return () => clearTimeout(timer);
  }, [isChat, focused, input, recording]);

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    const Ctor = (w.SpeechRecognition || w.webkitSpeechRecognition) as (new () => RecognitionLike) | undefined;
    if (!Ctor) {
      setMicOk(false);
      return;
    }
    const rc = new Ctor();
    rc.continuous = false;
    rc.interimResults = false;
    rc.lang = (navigator.language || "es-ES").startsWith("en") ? "en-US" : "es-ES";
    rc.onstart = () => {
      setRecording(true);
      setFocused(false);
      setPlaceholder("Escuchando... 🎙️");
    };
    rc.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript || "";
      if (transcript) {
        inputRef.current = transcript;
        setInput(transcript);
      }
    };
    rc.onerror = () => {
      setRecording(false);
      setPlaceholder(TYPE_PHRASES[0]);
    };
    rc.onend = () => {
      setRecording(false);
      setPlaceholder(TYPE_PHRASES[0]);
      const text = inputRef.current.trim();
      if (text) void sendRef.current(text);
    };
    recognitionRef.current = rc;
    return () => {
      try {
        rc.abort();
      } catch {
        /* noop */
      }
    };
  }, []);

  const toggleMic = () => {
    const rc = recognitionRef.current;
    if (!rc) return;
    if (recording) rc.stop();
    else {
      try {
        rc.start();
      } catch {
        /* ya iniciado */
      }
    }
  };

  const headerTitle = isChat ? "¿Preguntas? ¡Chatea con nosotros!" : cfg.header_title;
  const headerSubtitle = isChat ? (cfg.is_active === 1 ? "Activo hoy " + formatToday() : "En pausa") : cfg.header_subtitle;

  const switchTab = (next: "home" | "chat") => {
    const el = chatScrollRef.current;
    const wasAtBottom = el ? el.scrollTop + el.clientHeight >= el.scrollHeight - 8 : true;
    setTab(next);
    if (next === "chat") {
      if (!greeted.current) {
        greeted.current = true;
        setMessages((m) => [...m, { text: cfg.welcome_message, sender: "bot" }]);
      }
      if (wasAtBottom) {
        const target = chatScrollRef.current;
        if (target) target.scrollTop = target.scrollHeight;
      }
    }
  };

  const sendMessage = async (raw: string) => {
    const text = raw.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");
    setMessages((m) => [...m, { text, sender: "user" }, { text: "", sender: "bot", typing: true }]);
    let reply = "";
    try {
      const res = await fetch(`${apiBase}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: agentId, message: text }),
      });
      const data = (await res.json()) as { reply?: string };
      reply = data.reply || "¡Recibido! ¿En qué más te puedo colaborar?";
    } catch {
      reply = "¡Recibido! ¿En qué más te puedo colaborar?";
    }
    setMessages((m) => [...m.filter((x) => !x.typing), { text: reply, sender: "bot" }]);
    setSending(false);
  };

  return (
    <div className="wv-scene" style={{ background: scene }} aria-label="Vista previa en vivo del widget">
      <div className="wv-mocklines">
        <span style={{ width: "46%" }} />
        <span style={{ width: "70%" }} />
        <span style={{ width: "58%" }} />
        <span style={{ width: "64%" }} />
      </div>

      <button
        className={`wv-launcher ${open ? "hover-disabled" : "floating"}`}
        style={{
          bottom: 25,
          [cfg.position]: 25,
          ...({
            "--wv-g1": start,
            "--wv-g2": end,
            "--wv-dark": end,
            "--wv-shadow": hexToRgba(start, 0.5),
            "--wv-glow": hexToRgba(start, 0.8),
          } as React.CSSProperties),
        }}
        onClick={onToggle}
        aria-label={open ? "Cerrar vista previa" : "Abrir vista previa"}
      >
        {open ? (
          <svg className="wv-launcher-close" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- logo de marca en la vista previa
          <img className="wv-launcher-logo" src={cfg.bubble_logo_url || "/imagen/Icono_Chat.png"} alt="" />
        )}
      </button>

      {open && (
        <div
          className={`wv-window ${dark ? "is-dark" : "is-light"}`}
          style={{
            bottom: 90,
            ...(cfg.position === "right" ? { right: 25 } : { left: 25 }),
            ...({
              "--wv-bg": containerBgc,
              "--wv-bor": borderColor,
              "--wv-txt": chatText,
              "--wv-color": start,
              "--wv-shadow": hexToRgba(start, 0.5),
              "--wv-shadow-soft": hexToRgba(start, 0.2),
              "--wv-tint": hexToRgba(start, 0.08),
              "--wv-glow": hexToRgba(start, 0.8),
            } as React.CSSProperties),
          }}
        >
          <div className="wv-header" style={{ background: gradVertical }}>
            <span className="wv-theme-toggle" onClick={() => setManualDark((d) => !d)} role="button" aria-label="Cambiar tema de la vista previa">
              {dark ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4" />
                  {ICON_SUN_RAYS.map((d) => (
                    <path key={d} d={d} />
                  ))}
                </svg>
              ) : (
                pe(ICON_MOON_D)
              )}
            </span>
            <span className="wv-mobile-close" onClick={onToggle} role="button" aria-label="Cerrar vista previa">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </span>
            <div className="wv-tabs" role="tablist">
              <span className={`wv-tab ${!isChat ? "active" : ""}`} role="tab" onClick={() => switchTab("home")}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  {ICON_HOME_PATHS.map((d) => (
                    <path key={d} d={d} />
                  ))}
                </svg>{" "}
                <span>Inicio</span>
              </span>
              <span className={`wv-tab ${isChat ? "active" : ""}`} role="tab" onClick={() => switchTab("chat")}>
                {pe(ICON_CHAT_D)} <span>Chat</span>
              </span>
            </div>
            <div className="wv-header-content">
              <div className="wv-avatar">
                {/* eslint-disable-next-line @next/next/no-img-element -- logo de marca en la vista previa */}
                <img src={cfg.avatar_url || "/imagen/Logo_AgentOSweb_chat.png"} alt="" />
              </div>
              <span className="wv-title">{headerTitle}</span>
              <span className="wv-subtitle">{headerSubtitle}</span>
            </div>
          </div>

          <div className="wv-content">
            <div className={`wv-home ${isChat ? "hidden-view" : ""}`} style={{ background: containerBgc }}>
              <div className="wv-welcome" style={{ background: cardBgc, borderColor: cardBorder }}>
                <i style={{ background: gradVertical }} />
                <h4 style={{ color: textMain }}>¡Hola! 👋 Bienvenido</h4>
                <p style={{ color: textSub }}>{renderInline(cfg.welcome_message)}</p>
              </div>

              <button className="wv-start" style={{ background: grad, ["--wv-glow" as string]: hexToRgba(start, 0.8), ["--wv-shadow" as string]: hexToRgba(start, 0.5) }} type="button" onClick={() => switchTab("chat")}>
                {pe(ICON_CHAT_D)}
                <span>Iniciar conversación</span>
              </button>

              <div className="wv-prompts-title" style={{ color: textSub }}>
                Preguntas Frecuentes
              </div>
              <div className="wv-prompts">
                {cfg.faqs.map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    className="wv-prompt-item"
                    onClick={() => {
                      switchTab("chat");
                      void sendMessage(c.label);
                    }}
                  >
                    <span>{c.label}</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: start }}>
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                ))}
              </div>
              <div className="wv-brand" style={{ borderColor: borderColor, color: textSub }}>
                Powered by <span style={{ color: start }}>AgentOSweb</span>
              </div>
            </div>

            <div className={`wv-chat ${!isChat ? "hidden-view" : ""}`} ref={chatScrollRef} style={{ background: containerBgc }}>
              {messages.map((m, i) =>
                m.sender === "bot" ? (
                  <div key={i} className="wv-chat-message bot">
                    <span className="wv-message-icon">
                      <span className="wv-avatar-container">
                        <span className="wv-avatar-head" style={{ background: `radial-gradient(circle at 35% 35%, ${start}, ${end})` }} />
                        <span className="wv-eyes">
                          <span className="wv-eye" />
                          <span className="wv-eye" />
                        </span>
                      </span>
                    </span>
                    <span className="wv-message-content">
                      <span className="wv-message-sender" style={{ color: chatText }}>
                        {cfg.header_title}
                      </span>
                      <span className={`wv-message-bubble ${m.typing ? "wv-typing" : ""}`} style={{ background: inputBgc, borderColor, color: textMain }}>
                        {m.typing ? (
                          <>
                            <span />
                            <span />
                            <span />
                          </>
                        ) : (
                          renderInline(m.text)
                        )}
                      </span>
                    </span>
                  </div>
                ) : (
                  <div key={i} className="wv-chat-message user">
                    <span className="wv-message-content">
                      <span className="wv-message-bubble" style={{ background: start, color: "#ffffff" }}>
                        {m.text}
                      </span>
                    </span>
                  </div>
                )
              )}
            </div>
          </div>

          {isChat && (
            <div className="wv-footer" style={{ background: dark ? "#101013" : "#ffffff", borderTopColor: dark ? "#2e2e33" : "#e2e8f0" }}>
              <div className="wv-input" style={{ background: inputBgc, borderColor: focused ? start : borderColor }}>
                {micOk && (
                  <button
                    className={`wv-mic ${recording ? "recording" : ""}`}
                    type="button"
                    onClick={toggleMic}
                    aria-label={recording ? "Detener grabación" : "Hablar por micrófono"}
                  >
                    {pe(ICON_MIC_D)}
                  </button>
                )}
                <input
                  className="wv-input-field"
                  type="text"
                  placeholder={placeholder}
                  value={input}
                  style={{ color: textMain }}
                  onChange={(e) => setInput(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void sendMessage(input);
                  }}
                />
                <button
                  className="wv-send"
                  type="button"
                  style={{ background: grad }}
                  onClick={() => void sendMessage(input)}
                  disabled={sending || !input.trim()}
                  aria-label="Enviar mensaje"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                    <path d={ICON_SEND_D} />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <span
        className="wv-position-note"
        style={{
          color: textSub,
          background: dark ? "rgba(9, 9, 11, 0.6)" : "rgba(255, 255, 255, 0.55)",
          border: dark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(15, 23, 42, 0.06)",
        }}
      >
        Widget {cfg.position === "right" ? "abajo a la derecha" : "abajo a la izquierda"} · tema{" "}
        {dark ? "oscuro" : "claro"}
      </span>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="agents-layout">
      <div className="agents-form">
        {[0, 1, 2].map((i) => (
          <div key={i} className="panel-card">
            <div className="faq-skeleton-row" style={{ width: "38%", height: 14, marginBottom: 16 }} />
            <div className="faq-skeleton-row" style={{ height: 40 }} />
            <div className="faq-skeleton-row" style={{ height: 40 }} />
          </div>
        ))}
      </div>
      <div className="panel-card">
        <div className="faq-skeleton-row" style={{ width: "50%", height: 14, marginBottom: 16 }} />
        <div className="faq-skeleton-row" style={{ height: 300 }} />
      </div>
    </div>
  );
}

export default function AgentsView({ apiBase, agentId, plan, onActiveChange, onChanged, onDeleted }: AgentsViewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [draft, setDraft] = useState<AgentConfig | null>(null);
  const [original, setOriginal] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState<boolean>(() => typeof window !== "undefined" && window.innerWidth > 768);
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [keyRemove, setKeyRemove] = useState(false);
  const byokMemRef = useRef<{ provider: string; model: string } | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [agentDeleteOpen, setAgentDeleteOpen] = useState(false);
  const toast = useToast();

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    setApiKeyInput("");
    setKeyRemove(false);
    setShowApiKey(false);
    fetch(`/api/agent/${agentId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status))))
      .then((d: AgentConfig) => {
        const normalized = {
          ...d,
          lead_capture: d.lead_capture !== false,
          lead_fields: Array.isArray(d.lead_fields)
            ? d.lead_fields
            : String(d.lead_fields ?? "email,phone").split(",").map((f) => f.trim()).filter(Boolean),
        };
        setDraft(normalized);
        setOriginal(JSON.stringify(normalized));
        setLoading(false);
        onActiveChange?.(d.is_active === 1);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [agentId, onActiveChange]);

  useEffect(() => {
    load();
  }, [load]);

  const set = useCallback(<K extends keyof AgentConfig>(key: K, value: AgentConfig[K]) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setFormError(null);
  }, []);

  const setFaq = useCallback((i: number, field: keyof FaqDraft, value: string) => {
    setDraft((d) => {
      if (!d) return d;
      const faqs = d.faqs.map((f, idx) => (idx === i ? { ...f, [field]: value } : f));
      return { ...d, faqs };
    });
    setFormError(null);
  }, []);

  const addFaq = useCallback(() => {
    setDraft((d) => {
      if (!d || d.faqs.length >= LIMITS.faq_max) return d;
      return { ...d, faqs: [...d.faqs, { label: "", answer: "" }] };
    });
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const items = document.querySelectorAll(".faq-editor-item");
        items[items.length - 1]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      })
    );
  }, []);

  const closeDelete = useCallback(() => setPendingDelete(null), []);

  const onModeChange = useCallback((mode: string) => {
    setDraft((d) => {
      if (!d) return d;
      if (mode === "managed") {
        // Guardar la memoria de sesión ANTES de pisar chat_provider: si el usuario
        // editó el proveedor/modelo pero aún no publicó, lo recuperamos al volver.
        if (d.mode === "byok") byokMemRef.current = { provider: d.chat_provider, model: d.chat_model };
        return { ...d, mode: "managed", chat_provider: "workers-ai", chat_model: MANAGED_DEFAULT };
      }
      // Prioridad: memoria de sesión (lo que se editó sin publicar) > memoria persistida en DB.
      const mem = d.mode === "managed" ? byokMemRef.current : null;
      const persisted = d.byok_provider && d.byok_provider !== "workers-ai" ? d.byok_provider : null;
      const memProvider = mem && BYOK_PROVIDERS[mem.provider] ? mem.provider : null;
      const preview = memProvider ?? persisted ?? (d.chat_provider !== "workers-ai" ? d.chat_provider : null);
      const provider = preview && BYOK_PROVIDERS[preview] ? preview : "deepseek";
      const models = BYOK_PROVIDERS[provider]?.models ?? [];
      const memModel = mem && models.some((m) => m.id === mem.model) ? mem.model : null;
      const savedModel = d.byok_model && models.some((m) => m.id === d.byok_model) ? d.byok_model : null;
      const keepModel = memModel ?? savedModel ?? (models.some((m) => m.id === d.chat_model) ? d.chat_model : null);
      return {
        ...d,
        mode: "byok",
        chat_provider: provider,
        chat_model: keepModel ?? DEFAULT_BYOK_MODEL[provider] ?? "",
      };
    });
    setFormError(null);
    setKeyRemove(false);
    setApiKeyInput("");
  }, []);

  const onProviderChange = useCallback((provider: string) => {
    setDraft((d) => {
      if (!d) return d;
      if (provider === "custom") return { ...d, chat_provider: "custom", chat_model: "" };
      const models = BYOK_PROVIDERS[provider]?.models ?? [];
      const keep = models.some((m) => m.id === d.chat_model);
      return {
        ...d,
        chat_provider: provider,
        chat_model: keep ? d.chat_model : DEFAULT_BYOK_MODEL[provider] ?? "",
      };
    });
    setFormError(null);
  }, []);

  const confirmDeleteFaq = useCallback(async (i: number) => {
    await new Promise((r) => setTimeout(r, 600));
    setDraft((d) => (d ? { ...d, faqs: d.faqs.filter((_, idx) => idx !== i) } : d));
    setPendingDelete(null);
    toast.success("Pregunta eliminada");
  }, [toast]);

  const confirmDeleteAgent = useCallback(async () => {
    try {
      const res = await fetch(`/api/agent/${agentId}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo eliminar el agente");
      toast.success("Agente eliminado");
      setAgentDeleteOpen(false);
      onDeleted?.(agentId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error de red al eliminar");
      setAgentDeleteOpen(false);
    }
  }, [agentId, toast, onDeleted]);

  const dirty = useMemo(
    () => (draft ? JSON.stringify(draft) !== original : false) || apiKeyInput.trim() !== "" || keyRemove,
    [draft, original, apiKeyInput, keyRemove]
  );

  const save = useCallback(async () => {
    if (!draft) return;
    const faqs = draft.faqs.filter((f) => f.label.trim() !== "" || f.answer.trim() !== "");
    const invalid = faqs.find((f) => f.label.trim() === "");
    if (invalid) {
      setFormError("Cada pregunta frecuente necesita su texto (el chip del widget).");
      return;
    }

    const customWithKey =
      draft.mode === "byok" &&
      draft.chat_provider === "custom" &&
      (apiKeyInput.trim() !== "" || (draft.has_chat_api_key && !keyRemove));
    if (customWithKey && !(draft.chat_base_url ?? "").trim()) {
      setFormError("El proveedor por URL personalizada necesita su URL base.");
      return;
    }

    const body = {
      name: draft.name,
      header_title: draft.header_title,
      header_subtitle: draft.header_subtitle,
      welcome_message: draft.welcome_message,
      system_prompt: draft.system_prompt,
      knowledge_base: draft.knowledge_base ? draft.knowledge_base : null,
      primary_color: draft.primary_color,
      position: draft.position,
      default_theme: draft.default_theme,
      avatar_url: draft.avatar_url ? draft.avatar_url : null,
      bubble_logo_url: draft.bubble_logo_url ? draft.bubble_logo_url : null,
      max_tokens: draft.max_tokens,
      allowed_domains: draft.allowed_domains,
      rate_limit_per_minute: draft.rate_limit_per_minute,
      is_active: draft.is_active === 1 ? true : false,
      mode: draft.mode,
      chat_provider: draft.chat_provider,
      chat_model: draft.chat_model,
      chat_base_url: draft.chat_base_url ? draft.chat_base_url.trim() : null,
      lead_capture: draft.lead_capture,
      lead_fields: draft.lead_fields,
      faqs: faqs.map((f) => ({ label: f.label.trim(), msg: f.label.trim(), answer: f.answer.trim() })),
    } as Record<string, unknown>;

    const key = apiKeyInput.trim();
    if (key) body.chat_api_key = key;
    else if (keyRemove) body.chat_api_key = null;

    // Memoria BYOK: se actualiza solo al guardar en modo BYOK. En Administrada se
    // omite del body para conservar el proveedor/modelo previo y poder restaurarlo.
    if (draft.mode === "byok") {
      body.byok_provider = draft.chat_provider;
      body.byok_model = draft.chat_model;
    }

    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/agent/${agentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "No se pudo guardar");
      }
      const next = key || keyRemove ? { ...draft, has_chat_api_key: !!key } : draft;
      if (draft.mode === "byok") {
        next.byok_provider = draft.chat_provider;
        next.byok_model = draft.chat_model;
      }
      setDraft(next);
      setOriginal(JSON.stringify(next));
      setApiKeyInput("");
      setKeyRemove(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onActiveChange?.(draft.is_active === 1);
      onChanged?.();
      let prevActive = draft.is_active;
      try {
        prevActive = (JSON.parse(original) as AgentConfig).is_active;
      } catch {
        // Sin snapshot previo: usar el valor actual
      }
      if (prevActive !== draft.is_active) {
        toast.success(draft.is_active === 1 ? "Agente activado · cambios guardados" : "Agente pausado · cambios guardados");
      } else {
        toast.success("Cambios guardados · El widget los muestra en menos de 1 minuto");
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Error de red al guardar";
      setFormError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [draft, original, agentId, toast, onActiveChange, onChanged, apiKeyInput, keyRemove]);

  if (loading) {
    return (
      <section className="view-section active" id="view-agents">
        <Skeleton />
      </section>
    );
  }

  if (error || !draft) {
    return (
      <section className="view-section active" id="view-agents">
        <div className="panel-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h3>No se pudo cargar la configuración</h3>
            <p className="subtitle" style={{ marginBottom: 0 }}>
              Verifica tu conexión o que el agente exista, e inténtalo de nuevo.
            </p>
          </div>
          <button className="btn-ghost" onClick={load}>
            Reintentar
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="view-section active" id="view-agents">
      <div className="agents-header">
        <div className="agents-heading">
          {renaming ? (
            <div className="agents-rename">
              <input
                className="form-input"
                value={draft.name}
                maxLength={60}
                autoFocus
                onChange={(e) => set("name", e.target.value)}
                onBlur={() => setRenaming(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setRenaming(false);
                }}
              />
              <span className="agents-rename-hint">
                Nombre interno del agente (así aparece en el selector del panel). Enter o clic fuera para aplicar,
                luego pulsa Publicar cambios.
              </span>
            </div>
          ) : (
            <h2 className="agents-title">
              {draft.name}
              <button type="button" className="agents-rename-btn" aria-label="Renombrar agente (nombre interno)" title="Renombrar agente (nombre interno)" onClick={() => setRenaming(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                </svg>
              </button>
            </h2>
          )}
          <p className="subtitle" style={{ marginBottom: 0 }}>
            Personaliza identidad, prompt y preguntas frecuentes. Al guardar, tu widget se actualiza al instante.
          </p>
        </div>
        <div className="agents-actions">
          <span className={`status-pill ${draft.is_active === 1 ? "on" : "off"}`}>
            {draft.is_active === 1 ? "Activo" : "Pausado"}
          </span>
          {dirty && (
            <button
              className="btn-ghost"
              onClick={() => {
                setDraft(JSON.parse(original) as AgentConfig);
                setApiKeyInput("");
                setKeyRemove(false);
                setShowApiKey(false);
              }}
            >
              Descartar
            </button>
          )}
          <button className="btn-primary" onClick={save} disabled={saving || !dirty} aria-busy={saving}>
            {saving ? (
              <>
                <span className="btn-spinner" />
                Guardando…
              </>
            ) : saved ? (
              <>
                <span className="btn-check">✓</span>
                Guardado
              </>
            ) : (
              <>Publicar cambios</>
            )}
          </button>
          <button
            className="btn-danger"
            onClick={() => setAgentDeleteOpen(true)}
            title="Eliminar este agente"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
            Eliminar
          </button>
        </div>
      </div>

      {formError && <div className="form-banner-error">{formError}</div>}

      <div className="agents-layout">
        <div className="agents-form">
          <div className="panel-card">
            <h3>Identidad y Apariencia</h3>
            <p className="subtitle">Títulos, mensaje de bienvenida y color que ven tus visitantes.</p>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="cfg-header-title">
                  Título del widget
                </label>
                <input
                  id="cfg-header-title"
                  className="form-input"
                  value={draft.header_title}
                  maxLength={LIMITS.header_title}
                  onChange={(e) => set("header_title", e.target.value)}
                  placeholder="Ej: Agente de Atención"
                />
                <span className="form-hint count">
                  {draft.header_title.length}/{LIMITS.header_title}
                </span>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="cfg-header-subtitle">
                  Subtítulo del widget
                </label>
                <input
                  id="cfg-header-subtitle"
                  className="form-input"
                  value={draft.header_subtitle}
                  maxLength={LIMITS.header_subtitle}
                  onChange={(e) => set("header_subtitle", e.target.value)}
                  placeholder="Ej: Responde en segundos"
                />
                <span className="form-hint count">
                  {draft.header_subtitle.length}/{LIMITS.header_subtitle}
                </span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="cfg-welcome">
                Mensaje de bienvenida
              </label>
              <textarea
                id="cfg-welcome"
                className="form-textarea"
                rows={2}
                value={draft.welcome_message}
                maxLength={LIMITS.welcome_message}
                onChange={(e) => set("welcome_message", e.target.value)}
                placeholder="Ej: ¡Hola! ¿En qué puedo ayudarte hoy?"
              />
              <span className={`form-hint count ${draft.welcome_message.length > 120 ? "warn" : ""}`}>
                {draft.welcome_message.length}/{LIMITS.welcome_message} · recomendado hasta 120 caracteres
              </span>
            </div>

            <div className="form-row" style={{ marginTop: 18 }}>
              <div className="form-group">
                <label className="form-label" htmlFor="cfg-color">
                  Color principal
                </label>
                <div className="color-field">
                  <input
                    id="cfg-color"
                    type="color"
                    className="color-picker"
                    value={draft.primary_color}
                    onChange={(e) => set("primary_color", e.target.value)}
                  />
                  <span className="color-hex">{draft.primary_color}</span>
                </div>
              </div>

              <div className="form-row form-row-mini">
                <div className="form-group">
                  <label className="form-label">Posición</label>
                  <Segmented
                    value={draft.position}
                    options={[
                      { value: "right", label: "Derecha" },
                      { value: "left", label: "Izquierda" },
                    ]}
                    onChange={(v) => set("position", v)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Tema inicial</label>
                  <Segmented
                    value={draft.default_theme}
                    options={[
                      { value: "light", label: "Claro" },
                      { value: "dark", label: "Oscuro" },
                      { value: "auto", label: "Auto" },
                    ]}
                    onChange={(v) => set("default_theme", v)}
                  />
                </div>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 20 }}>
              <label className="form-label" htmlFor="cfg-avatar">
                URL del avatar (opcional)
              </label>
              <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
                <input
                  id="cfg-avatar"
                  className="form-input"
                  type="url"
                  style={{ flex: 1 }}
                  value={draft.avatar_url ?? ""}
                  onChange={(e) => set("avatar_url", e.target.value)}
                  placeholder="https://tusitio.com/avatar.png"
                />
                {(draft.avatar_url ?? "").trim() && (
                  <button
                    type="button"
                    className="form-input-clear"
                    title="Eliminar avatar"
                    aria-label="Eliminar avatar"
                    onClick={() => set("avatar_url", "")}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <line x1="10" y1="11" x2="10" y2="17" />
                      <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                  </button>
                )}
              </div>
              <span className="form-hint">Déjalo vacío para usar el logo de AgentOSweb por defecto.</span>
            </div>

            <div className="form-group" style={{ marginTop: 20 }}>
              {plan === "agency" ? (
                <>
                  <label className="form-label" htmlFor="cfg-bubble-logo">
                    URL del logo de la burbuja (opcional)
                  </label>
                  <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
                    <input
                      id="cfg-bubble-logo"
                      className="form-input"
                      style={{ flex: 1 }}
                      type="url"
                      value={draft.bubble_logo_url ?? ""}
                      onChange={(e) => set("bubble_logo_url", e.target.value)}
                      placeholder="https://tusitio.com/logo-burbuja.png"
                    />
                    {(draft.bubble_logo_url ?? "").trim() && (
                      <button
                        type="button"
                        className="form-input-clear"
                        title="Eliminar logo"
                        aria-label="Eliminar logo"
                        onClick={() => set("bubble_logo_url", "")}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <span className="form-hint">Aparece en la burbuja flotante. Vacío = icono AgentOSweb.</span>
                </>
              ) : (
                <span className="form-hint">
                  El logo propio de la burbuja (marca blanca) es exclusivo del plan Agency.
                </span>
              )}
            </div>
          </div>

          <div className="panel-card">
            <h3>Personalidad del Agente (Prompt)</h3>
            <p className="subtitle">Escribe cómo debe comportarse, el tono y las reglas de tu agente.</p>
            <div className="form-group">
              <textarea
                id="cfg-prompt"
                className="form-textarea form-textarea-lg"
                rows={9}
                value={draft.system_prompt}
                maxLength={LIMITS.system_prompt}
                onChange={(e) => set("system_prompt", e.target.value)}
                placeholder={
                  "Eres el asistente virtual de {tu empresa}. Redacta aquí la personalidad y las reglas de tu agente:\n▸ Cómo saluda, responde y se despide\n▸ Tono (cercano, formal, técnico…)\n▸ Datos que siempre menciona y temas que evita\n▸ Políticas y reglas importantes de tu negocio"
                }
              />
              <span className="form-hint count">
                {draft.system_prompt.length}/{LIMITS.system_prompt}
              </span>
              {draft.system_prompt.trim() === "" && (
                <p className="form-hint" style={{ marginTop: 6 }}>
                  Vacío = usamos un tono neutro y amable automáticamente. Rellénalo para el estilo exacto de tu negocio.
                </p>
              )}
            </div>
          </div>

          <div className="panel-card">
            <h3>Base de Conocimiento (Scratchpad KB)</h3>
            <p className="subtitle">
              Datos de tu negocio, catálogo o políticas. Se inyectan en cada respuesta sin bases vectoriales.
            </p>
            <div className="form-group">
              <textarea
                id="cfg-kb"
                className="form-textarea form-textarea-lg"
                rows={7}
                value={draft.knowledge_base ?? ""}
                maxLength={LIMITS.knowledge_base}
                onChange={(e) => set("knowledge_base", e.target.value)}
                placeholder={
                    "Tu base de conocimiento. Escribe aquí todo lo que el agente debe saber para responder con precisión:\n▸ Precios, planes y métodos de pago\n▸ Horarios y canales de atención\n▸ Políticas (envíos, devoluciones, pagos, garantías)\n▸ Datos de contacto y dirección"
                }
              />
              <span className="form-hint count">
                {(draft.knowledge_base ?? "").length}/{LIMITS.knowledge_base}
              </span>
            </div>
          </div>

          <div className="panel-card">
            <div className="panel-head-row">
              <div>
                <h3>Preguntas Frecuentes</h3>
                <p className="subtitle" style={{ marginBottom: 0 }}>
                  Se responden automáticamente sin gastar IA.
                </p>
              </div>
              <span className="status-pill neutral">
                {draft.faqs.length}/{LIMITS.faq_max}
              </span>
            </div>

            <div className="faq-editor">
              {draft.faqs.map((f, i) => (
                <div key={i} className="faq-editor-item">
                  <div className="faq-editor-head">
                    <span className="faq-editor-index">#{i + 1}</span>
                    <button className="faq-remove-btn" type="button" onClick={() => setPendingDelete(i)} aria-label="Eliminar pregunta">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <path d="M10 11v6M14 11v6" />
                      </svg>
                    </button>
                  </div>
                  <div className="faq-editor-grid">
                    <div className="form-group">
                      <label className="form-label">Pregunta del visitante</label>
                      <input
                        className="form-input"
                        value={f.label}
                        maxLength={LIMITS.faq_label}
                        onChange={(e) => setFaq(i, "label", e.target.value)}
                        placeholder="Ej: ¿Cuánto cuesta el plan Pro?"
                      />
                      <span className="form-hint">Es el texto del chip y lo que compara con el mensaje que escribe el visitante.</span>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Respuesta automática</label>
                      <textarea
                        className="form-textarea"
                        rows={3}
                        value={f.answer}
                        maxLength={LIMITS.faq_answer}
                        onChange={(e) => setFaq(i, "answer", e.target.value)}
                        placeholder="La respuesta que el visitante recibe al instante…"
                      />
                    </div>
                  </div>
                </div>
              ))}

              <button className="faq-add-btn" type="button" onClick={addFaq} disabled={draft.faqs.length >= LIMITS.faq_max}>
                <span style={{ fontSize: 15, lineHeight: 1 }}>＋</span>
                Añadir pregunta frecuente
              </button>
            </div>
          </div>

          <div className="panel-card">
            <div className="panel-head-row">
              <div>
                <h3>Inteligencia del Agente</h3>
                <p className="subtitle" style={{ marginBottom: 0 }}>
                  El motor que responde a tus clientes: administrado por AgentOSweb o tu propia API Key (BYOK).
                </p>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 16 }}>
              <label className="form-label">Modo de motor</label>
              <Segmented
                value={draft.mode}
                options={[
                  { value: "managed", label: "Administrada (sin key)" },
                  { value: "byok", label: "Tu API Key (BYOK)" },
                ]}
                onChange={onModeChange}
              />
              <span className="form-hint">
                {draft.mode === "byok"
                  ? "Pagas la IA directo al proveedor y no consumes el cupo mensual de tu plan."
                  : "Modelos de Cloudflare Workers AI incluidos en tu plan (consumen mensajes del cupo)."}
              </span>
            </div>

            {draft.mode === "byok" ? (
              <>
                {keyRemove && (
                  <div className="form-hint byok-no-key" style={{ marginTop: 14 }}>
                    Sin API Key este agente responderá con Workers AI (modelos incluidos en tu plan). El proveedor y
                    modelo se vuelven a aplicar cuando pegues una clave.
                  </div>
                )}
                <div className={`form-row ${keyRemove ? "byok-dormant" : ""}`} style={{ marginTop: 18 }}>
                  <div className="form-group">
                    <label className="form-label">Proveedor</label>
                    <Dropdown
                      value={draft.chat_provider}
                      options={BYOK_PROVIDER_IDS.map((id) => ({ id, name: BYOK_PROVIDERS[id].label }))}
                      onChange={onProviderChange}
                      placeholder="Selecciona proveedor"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Modelo</label>
                    {draft.chat_provider === "custom" ? (
                      <input
                        className="form-input"
                        value={draft.chat_model}
                        onChange={(e) => set("chat_model", e.target.value)}
                        placeholder="ej: deepseek-flash"
                      />
                    ) : (
                      <Dropdown
                        value={draft.chat_model}
                        options={BYOK_PROVIDERS[draft.chat_provider]?.models ?? []}
                        onChange={(v) => set("chat_model", v)}
                        placeholder="Selecciona modelo"
                      />
                    )}
                  </div>
                </div>

                {draft.chat_provider === "custom" && (
                  <div className="form-group" style={{ marginTop: 18 }}>
                    <label className="form-label" htmlFor="cfg-baseurl">
                      URL base del proveedor
                    </label>
                    <input
                      id="cfg-baseurl"
                      className="form-input"
                      placeholder="https://api.tuproveedor.com/v1"
                      value={draft.chat_base_url ?? ""}
                      onChange={(e) => set("chat_base_url", e.target.value)}
                    />
                    <span className="form-hint">Endpoint compatible con Chat Completions de OpenAI.</span>
                  </div>
                )}

                <div className="form-group" style={{ marginTop: 18 }}>
                  <label className="form-label" htmlFor="cfg-apikey">
                    API Key{" "}
                    {draft.has_chat_api_key && (
                      <span className="status-pill neutral sm" style={{ marginLeft: 6 }}>
                        cargada
                      </span>
                    )}
                  </label>
                  <div className="api-key-field">
                    <input
                      id="cfg-apikey"
                      className="form-input"
                      type={showApiKey ? "text" : "password"}
                      autoComplete="off"
                      value={apiKeyInput}
                      placeholder={
                        draft.has_chat_api_key && !apiKeyInput
                          ? "••••••••••••  ·  vacío = conservar la actual"
                          : `Pega tu API Key de ${BYOK_PROVIDERS[draft.chat_provider]?.label ?? "tu proveedor"}`
                      }
                      onChange={(e) => {
                        setApiKeyInput(e.target.value);
                        if (keyRemove) setKeyRemove(false);
                      }}
                    />
                    <button
                      type="button"
                      className="api-key-btn"
                      onClick={() => setShowApiKey((s) => !s)}
                      aria-label={showApiKey ? "Ocultar API Key" : "Mostrar API Key"}
                    >
                      {showApiKey ? EYE_OFF_ICON : EYE_ICON}
                    </button>
                  </div>
                  {draft.has_chat_api_key && apiKeyInput === "" && !keyRemove && (
                    <button
                      type="button"
                      className="api-key-remove"
                      onClick={() => {
                        setKeyRemove(true);
                        setDraft((d) =>
                          d
                            ? {
                                ...d,
                                has_chat_api_key: false,
                                chat_base_url: d.chat_provider === "custom" ? "" : d.chat_base_url,
                              }
                            : d
                        );
                        toast.info("API Key marcada para eliminar. Publica cambios para aplicarlo.");
                      }}
                    >
                      Quitar API Key
                    </button>
                  )}
                  {keyRemove && (
                    <span className="form-hint" style={{ color: "var(--danger-color, #ef4444)" }}>
                      Esta clave se eliminará al publicar los cambios.
                    </span>
                  )}
                  <span className="form-hint">
                    Se almacena en tu agente y nunca la devolvemos al navegador. Sin key, el agente usa Workers AI
                    como respaldo.
                  </span>
                </div>
              </>
            ) : (
              <div className="form-group" style={{ marginTop: 18 }}>
                <label className="form-label">Modelo administrado (Cloudflare Workers AI)</label>
                <Dropdown
                  value={draft.chat_model}
                  options={MANAGED_MODELS}
                  onChange={(v) => set("chat_model", v)}
                />
                <span className="form-hint">
                  Incluido en tu plan. Llama 8B: rápido y económico · Llama 70B: mayor calidad.
                </span>
                {draft.has_chat_api_key && (
                  <span className="form-hint byok-no-key" style={{ marginTop: 10 }}>
                    Tu API Key BYOK sigue guardada en este agente pero queda inactiva en Administrada. Vuelve a
                    &laquo;Tu API Key (BYOK)&raquo; para usarla. {keyRemove ? "Se eliminará al publicar los cambios." : ""}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="panel-card">
            <h3>Configuración Avanzada</h3>
            <p className="subtitle">
              Límites de respuesta, mensajes por minuto y dominios autorizados para tu sitio.
            </p>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="cfg-tokens">
                  Máximo de tokens por respuesta
                </label>
                <input
                  id="cfg-tokens"
                  className="form-input"
                  type="number"
                  min={1}
                  max={5000}
                  value={draft.max_tokens}
                  onChange={(e) => set("max_tokens", Math.max(1, Number(e.target.value) || 1))}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="cfg-rate">
                  Mensajes por minuto
                </label>
                <input
                  id="cfg-rate"
                  className="form-input"
                  type="number"
                  min={1}
                  max={120}
                  value={draft.rate_limit_per_minute}
                  onChange={(e) => set("rate_limit_per_minute", Math.max(1, Number(e.target.value) || 1))}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 20 }}>
              <label className="form-label" htmlFor="cfg-domains">
                Dominios autorizados
              </label>
              <input
                id="cfg-domains"
                className="form-input"
                value={draft.allowed_domains}
                onChange={(e) => set("allowed_domains", e.target.value)}
                placeholder="mistienda.com, blog.mistienda.com o *"
              />
              <span className="form-hint">Separa con comas. Ejemplo: <code>mistienda.com</code>. Usa <code>*</code> para permitir cualquier sitio.</span>
            </div>

            <div className="switch-row">
              <div>
                <span className="switch-label">Agente activo</span>
                <span className="form-hint">Pausado, el widget deja de responder al instante.</span>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={draft.is_active === 1}
                  onChange={(e) => set("is_active", e.target.checked ? 1 : 0)}
                />
                <span className="slider" />
              </label>
            </div>

            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="switch-row">
                <div>
                  <span className="switch-label">Capturar prospectos</span>
                  <span className="form-hint">
                    Apagado, el agente solo responde y no extrae ningún dato.
                  </span>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={draft.lead_capture}
                    onChange={(e) => set("lead_capture", e.target.checked)}
                  />
                  <span className="slider" />
                </label>
              </div>

              {draft.lead_capture && (
                <div className="lead-fields">
                  {(
                    [
                      { id: "name", label: "Nombre" },
                      { id: "email", label: "Email" },
                      { id: "phone", label: "Teléfono" },
                    ] as const
                  ).map((f) => {
                    const checked = draft.lead_fields.includes(f.id);
                    return (
                      <label key={f.id} className="lead-field-chip">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...draft.lead_fields, f.id]
                              : draft.lead_fields.filter((x) => x !== f.id);
                            set("lead_fields", next);
                          }}
                        />
                        <span>{f.label}</span>
                      </label>
                    );
                  })}
                  </div>
              )}
              {draft.lead_capture && <CapturePromptHint fields={draft.lead_fields} />}
            </div>
          </div>
        </div>

        <aside className="preview-panel">
          <div className="preview-head">
            <h4>Vista previa en vivo</h4>
          </div>
          <WidgetMock cfg={draft} open={previewOpen} onToggle={() => setPreviewOpen((o) => !o)} apiBase={apiBase} agentId={agentId} />
          <p className="form-hint preview-hint">
            Así se ve en tu web. Clic en el botón flotante para abrir/cerrar.
          </p>
        </aside>
      </div>

      <ConfirmModal
        open={pendingDelete !== null}
        title="¿Eliminar pregunta frecuente?"
        description="Se quitará del widget y dejará de responderse automáticamente. Puedes volver a crearla después."
        confirmLabel="Eliminar"
        loadingText="Eliminando pregunta"
        icon={<IconClose />}
        onClose={closeDelete}
        onConfirm={() => (pendingDelete !== null ? confirmDeleteFaq(pendingDelete) : undefined)}
      />

      <ConfirmModal
        open={agentDeleteOpen}
        title="¿Eliminar este agente?"
        description="Se borrará el agente y sus conversaciones, prospectos y preguntas. Esta acción no se puede deshacer. Tu script de instalación dejará de funcionar."
        confirmLabel="Eliminar agente"
        loadingText="Eliminando agente"
        confirmPhrase={draft.name}
        icon={
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        }
        onClose={() => setAgentDeleteOpen(false)}
        onConfirm={confirmDeleteAgent}
      />
    </section>
  );
}

const FIELD_LABELS: Record<string, string> = { name: "nombre", email: "email", phone: "teléfono" };

function CapturePromptHint({ fields }: { fields: string[] }) {
  const labelList = fields.map((f) => FIELD_LABELS[f] ?? f);
  return (
    <div className="capture-hint">
      <span className="capture-hint-head">Cómo funciona la captura de prospectos</span>
      <p className="form-hint" style={{ marginTop: 6, lineHeight: 1.6 }}>
        <strong>No necesitás escribir nada en el prompt</strong> (el que está arriba): es automático.
        Cuando el visitante muestra interés (menciona precio, comprar, cotizar, escribe su correo en el
        chat...), el sistema muestra un <strong>formulario dentro del chat</strong> con los campos que
        elegiste acá ({labelList.join(", ")}).
      </p>
      <p className="form-hint" style={{ margin: "4px 0 0", lineHeight: 1.6 }}>
        <strong>Si no hay interés, el formulario no aparece</strong> y el visitante puede seguir
        chateando normal. Y si igual escribe su {labelList.join(" o ")} por mensaje directo, se guarda
        sin formulario.
      </p>
    </div>
  );
}