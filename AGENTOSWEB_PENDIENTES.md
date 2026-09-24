# 🤖 AgentOSweb — Planificador de Pendientes (Backlog)

> Documento vivo. Todo lo que falta por hacer, mejorar o revisar queda anotado aquí para no olvidarlo.
> Marcá con `[x]` lo que ya esté hecho. Agregá nuevas ideas al final, en la zona que corresponda.

---

## 🔒 Pendientes de Seguridad (prioridad máxima)

- [x] **API Keys cifradas en la base — HECHO Y DESPLEGADO (22-sep-2026)**: AES-256-GCM (`crypto.subtle`) con prefijo `e1:`. Claves viejas sin prefijo se conservan (retrocompatible). Se descifran solo al inferir. `ENCRYPTION_KEY` seteadas vía `wrangler secret bulk` en el worker. *Archivo:* `apps/workers/src/index.ts`
- [x] **Doble puerta del dashboard — HECHO Y DESPLEGADO (22-sep-2026)**:
  1. Worker valida header `X-Owner-Token` (secreto `OWNER_TOKEN`) en `PUT/GET config`, `/api/agents`, `PUT /api/user`, `/overview` y `DELETE`.
  2. El dashboard tiene login del dueño (cookie firma HMAC) y las llamadas de escritura pasan por un proxy Next.js que inyecta el token desde el servidor (el navegador nunca ve el token).
  - **Estado en producción:** `OWNER_TOKEN` activo en el worker. **El panel ya no está expuesto:** `/config` sin token → `403`, con token → `200`; `POST /api/agents` sin token → `403` (verificado en vivo 22-sep-2026). El widget público (`GET /api/agent/:id`, `/api/chat`) sigue abierto a propósito.
  - *Dashboard local:* el token vive en `apps/dashboard/.env.local` (gitignored); si corrés el panel en otra máquina o deploy, replicá la misma `OWNER_TOKEN`.
  - *Archivos:* `apps/workers/src/index.ts`, `apps/dashboard/src/lib/workerProxy.ts`, `apps/dashboard/src/lib/session.ts`
- [x] Revisar que la API Key nunca se devuelva al frontend — **HECHO**: `/config` y `/agent` devuelven solo `has_chat_api_key` (booleano), nunca la clave.
- [ ] (Post-lanzamiento) Login multi-cliente real (registro, planes, autenticación por usuario). Hoy la puerta es de un solo dueño.
- [ ] Rediseñar la pantalla de login del panel (+ activarla en producción): branding con logo, degradados, animación y modo oscuro. Hoy el login existe pero está desactivado hasta configurar `DASHBOARD_PASSWORD`.
- [ ] **Bloquear el cambio de plan para el cliente final (hoy es admin interno).** Mientras haya un solo dueño y el login esté apagado, el menú "Planes & Facturación" permite cambiar el plan sin pagar ni aprobar nada — está bien para pruebas internas, pero **no** debe quedar así de cara a clientes. Cuando exista login multi-cliente + pago: el cliente solo **solicita** el cambio (o paga) y el sistema/vos lo aplica; el endpoint `PUT /api/user` debe quedar restringido al rol admin. *Archivos:* `apps/workers/src/index.ts` (`handleUserUpdate`), `apps/dashboard/src/app/api/user/route.ts`, `BillingView.tsx`.
- [x] **`/api/overview/:id` protegido — HECHO Y DESPLEGADO (22-sep-2026)**: endpoint de métricas/cuota con gate `isOwnerAuthorized` en el worker (`handleOverview`) + proxy `/api/overview/[id]` en el panel que inyecta el token. Mismo gate que `/config` (verificado: 403 sin token desde el despliegue actual).
- [x] **Límite de dominios por substring — HECHO**: `domainAllowed` ya compara host exacto (`d === host || host.endsWith("."+d)`) en `apps/workers/src/index.ts:270-279`. Corregido en código (los pendientes de seguridad marcaron la versión vieja con `includes`). Quedó cubierto por el despliegue del 22-sep-2026.
- [x] **(Auditoría `security-audit`) Endurecimientos menores — HECHO (24-sep-2026):**
  - **`X-Owner-Token` con comparación en tiempo constante** (`timingSafeEqual` estilo XOR, misma longitud): el worker desplegado (`e86b1767`) ya no usa `===`. Verificado en prod: sin token → 403, token falso → 403, token real → 200.
  - **Cupo de mensajes atómico**: el `+1` del consumo ahora es `UPDATE users SET messages_used = messages_used + 1 WHERE id = ? AND messages_used < ?` (ya no puede pasarse del límite en ráfaga, aunque varios mensajes crucen el pre-check simultáneo). El pre-check + bloqueo KV 5 min se mantiene como atajo temprano.
  - **Rate limit en memoria por instancia** ya existía (`isRateLimited`, línea 480, con nota `ponytail:`).
  - **CORS de rutas del dueño:** se pospone deliberadamente a multi-tenant — hoy el panel llama al worker server-side vía proxy (inyecta token), CORS no expone nada sin token.

## ⚡ Mejoras de producto / UX

- [ ] **Botón "Probar modelo" en la configuración (Modo clave propia).**
  - Enviar un mensaje de prueba al worker con el proveedor/modelo elegido y devolver el error real de la API (para detectar claves inválidas o modelos caídos sin esperar al widget).
  - *Archivo:* `apps/dashboard/src/components/dashboard/AgentsView.tsx`
  - *Estado:* parado / en evaluación — hoy la prueba real se hace en la **Vista previa en vivo** del panel (usa la clave y modelo guardados). Un botón aparte solo agregaría valor para validar la clave sin guardar todavía.
  - [x] **UX pulido del panel (multi-agente) — HECHO.**
    - Nav label dinámico: **"Mi Agente"** cuando hay uno, **"Mis Agentes"** con varios (Sidebar, Topbar y UserMenu).
    - Toast profesional al cambiar de agente: *"Agente activo: {nombre}"*.
    - Empty state de "Preguntas Frecuentes" en el Overview: icono centrado con texto (antes texto aplastado a la izquierda).
    - Script de instalación: ahora **multi-línea** en el panel (cada atributo en su propia línea, con color VS Code) para que no estire el contenedor. Copia un one-liner para pegar.
    - URL de `widget.js` auto: en `localhost` usa `localhost:3000/widget.js` para pruebas; al desplegar en `agentosweb.com` se adapta automáticamente.
    - Chips de compatibilidad + copy aclarando que el script es universal (mismo `<script>` puro sin dependencias, funciona en HTML, WordPress, Shopify, React… con hint por plataforma).
    - *Archivos:* `Views.tsx`, `Dashboard.tsx`, `Sidebar.tsx`, `Topbar.tsx`, `UserMenu.tsx`, `globals.css`.
  - [x] **Multi-agente (base) — HECHO**: el panel lista, crea y cambia entre agentes con un selector en la barra superior.
  - Worker: `GET/POST /api/agents` con la misma doble puerta (`X-Owner-Token` + sesión del panel), dueño resuelto con `OWNER_USER_ID` (o el primer agente existente), límite por plan y `name` editable. **Desplegado.**
  - Dashboard: proxy `/api/agents`, selector con estado activo/pausado, creación con nombre, script de instalación por agente, overview por agente y renombrado en línea.
  - *Borrado:* `DELETE /api/agent/:id` — HECHO (worker + proxy `app/api/agent/[id]/route.ts` + botón "Eliminar" con `ConfirmModal` y confirmación escribiendo el nombre exacto del agente, patrón GitHub/Vercel). Bloquea borrar el último agente; elimina en cascada mensajes/conversaciones/leads/faq_hits. Verificado en vivo (crear → borrar → `{ok:true}`).
  - *Agente nuevo:* nace como **gestionado** (`mode='managed'`, `chat_provider='workers-ai'`, modelo `@cf/meta/llama-3.1-8b-instruct-fast`), activo y con prompt genérico; se auto-selecciona en el panel. (Antes heredaba el default del schema `byok/groq` sin key → el panel lo mostraba mal aunque el worker lo trataba como gestionado.)
  - *Al crear:* el panel salta automáticamente a "Mis Agentes" para editarlo, y no se permiten **nombres duplicados** (validación en el switcher + guard en el worker, case-insensitive → 409). Verificado en vivo.
  - *Agente nuevo:* hereda prompt genérico + bienvenida personalizada `"Soy el asistente virtual de {nombre}. ¿En qué te puedo colaborar hoy?"` (sin el "¡Hola! 👋"). El renombrado en la cabecera es el **nombre interno** (etiqueta del panel); la marca que ve el visitante es el Título del widget en "Identidad y Apariencia" (texto de ayuda actualizado).
  - *Widget offline* (`apps/widget/src/fallback.ts`): el mensaje por defecto y la respuesta sin conexión ya no llevan "¡Hola! 👋"; el fallback de bienvenida usa el nombre del agente (`header_title`). Rebuild `widget.js` hecho.
  - *Archivos:* `apps/workers/src/index.ts`, `apps/dashboard/src/{components/dashboard/*,app/api/agents,lib/workerProxy.ts}`
  - *Cupos por plan (worker `PLAN_DEFAULTS`):* free 1 ag/20 msgs · starter 1/1.500 · pro 3/6.000 · agency 10/25.000. `users.agent_limit` (NULL = sigue el plan) permite override por usuario; `messages_limit` ya es editable por usuario. Verificado en vivo (crear sobre el límite → 402).
  - El nombre/plan del dueño se leen de la DB (`users`) y se muestran en el sidebar y menú de usuario (ej. "Demo" / "Pro"); el contador de agentes vive en el badge del menú "Mis Agentes".
- [x] **Módulo "Planes & Facturación" — HECHO**: vista real (ya no placeholder) con las 4 tarjetas de plan (Free/Starter/Pro/Agency, precio managed y BYOK, cupos y features), indicador de "Plan actual" y editor de cupos de la cuenta (dropdown de plan + agentes + mensajes con override, barras de uso de mensajes y agentes).
  - Al elegir un plan se rellenan solos sus cupos; se pueden editar a mano antes de guardar. Endpoint `PUT /api/user` (doble puerta) con validación; si un cupo coincide con el default del plan se guarda como "sigue el plan".
  - *Archivos:* `apps/dashboard/src/components/dashboard/BillingView.tsx`, `apps/dashboard/src/app/api/user/route.ts`, `apps/workers/src/index.ts` (`PLAN_DEFAULTS`, `handleUserUpdate`), `database/agent_limit_column_update.sql`.
- [x] ~~Vista "Base de Conocimiento" global en el menú~~ — **DESCARTADA (24-sep-2026)**: la KB ya vive por agente dentro de Mis Agentes (`AgentsView.tsx`); una vista global duplicaba sin aportar. Se quitó el ítem del sidebar (`Sidebar.tsx` NAV_ITEMS) y su placeholder (`Dashboard.tsx` PLACEHOLDER_VIEWS). Si algún día hay una KB compartida entre agentes, se crea con esa intención.

## ✅ Pulido reciente (ronda sep-2026) — HECHO

- [x] **FAQ auto-respuesta tolerante a lenguaje natural — HECHO y DESPLEGADO (22-sep-2026)**: antes `matchFaq` exigía TODAS las keywords de la FAQ → "Hola, quisiera saber si funciona el efecto cristal en safari" se iba a la IA aunque el cliente preguntaba exactamente el chip 1. Fix: FAQs de **1-3 keywords siguen exactas** (evita falsos positivos cruzados tipo "¿cambiar el tamaño de los iconos?" → FAQ de familia de iconos), FAQs de **4+ keywords toleran fallar UNA** (los clientes no repiten la frase del chip). Gana la de más aciertos. Verificado con test local (12 casos) y en vivo: "funciona el efecto cristal en safari" → responde FAQ fija al instante. *Archivo:* `apps/workers/src/index.ts` (`matchFaq`).
- [x] **FAQ matching semántico (sinónimos/paráfrasis) — HECHO y DESPLEGADO (22-sep-2026)**: el matcher léxico no cubre sinónimos ni paráfrasis ("¿me pueden cobrar si lo uso en mis ventas?" no tocaba keywords de "proyectos comerciales"). Fix: fallback con embeddings Workers AI (`@cf/baai/bge-m3`, multilingüe, batching 16) — `matchFaq` primero (gratis, instantáneo) y si devuelve null, `matchFaqSemantic` computa coseno de la pregunta contra `label` y `msg` de cada FAQ; responde la FAQ si `>= 0.72` **y** le gana a la segunda por margen `>= 0.06` (si dos FAQs quedan casi empatadas, cae a la IA — nunca responde la equivocada); calibrado en vivo: paráfrasis comercial 0.74 (margen 0.29), safari con sinónimos 0.86 (margen 0.10), pregunta de precios 0.44 → cae a IA, sin falsos positivos. Vectores cacheados en KV `faqvec:{agentId}` (TTL 1h), invalidados en `handleAgentUpdate` cuando cambian las FAQs. Normalización del formato de embeds (pueden venir como array de vectores o plano según deploy). Verificado E2E 6/6. *Archivo:* `apps/workers/src/index.ts` (deploy final `e5ff7bf1`).
- [x] **Agente de prueba LuminaIcons creado en producción — HECHO y VERIFICADO (22-sep-2026)**: insertado directo en D1 (id `7f1f92bb-f8b9-4d5c-b87d-fe83c6649db5`, owner `user-demo`, plan agency, managed `@cf/meta/llama-3.1-8b-instruct-fast`). Widget embebido en la página `Lumina_Glassmorphic_Icons.html` vía `<script src="http://localhost:3000/w/{id}/widget.js" data-api-url="https://...workers.dev/api">` (rewrite `/w/:id/widget.js` → `/widget.js` en `next.config.ts`). Verificado el flujo completo de creación de agente (ver sección de abajo).
- [x] **Revisión del flujo de creación de agente (business) — HECHO y ENVIVO (22-sep-2026)**: auditoría del producto con el agente Lumina real. Todo lo configurable se sirve al widget correctamente (ver checklist en PLANIFICACION §0). Se corrigió el matcheo de FAQ (punto anterior).

- [x] **Modo oscuro persistente al recargar — HECHO**: causa raíz = el efecto de escritura de `Dashboard.tsx` corría en el mismo commit que el de lectura con el estado inicial `false` → sobrescribía el localStorage a "light" y pintaba claro el primer frame. Fix: `useState` con inicializador lazy leyendo el localStorage + script inline pre-paint en `apps/dashboard/src/app/layout.tsx` que aplica `body.dark-mode` antes de pintar (eliminado el efecto de lectura, quitado el clobber). Verificado: script presente en el HTML servido, `tsc`=0, HTTP 200.
- [x] **Prompt vacío = tono neutro automático — HECHO**: el worker usa un fallback `"Eres el asistente virtual de {header_title}..."` cuando `system_prompt` viene vacío (`apps/workers/src/index.ts`, despliegue `0c05c51d`); el panel muestra un hint bajo el textarea cuando está vacío. Verificado en vivo con `/api/chat` y `agent-demo` (sin personalidad).
- [x] **Modelos gratis marcados "(gratis)" — HECHO** (catálogo `BYOK_PROVIDERS` en `AgentsView.tsx`, nada borrado): Groq (6 gratis, + Llama 4 Scout), NVIDIA NIM (11 gratis, + Step 3.7 Flash/Kimi K3/MiniMax M3/Gemma 4), Mistral (4, tier Experiment con tu key), OpenRouter (+10 con sufijo `:free`, incluido el router "OpenRouter Gratis"). **OmniRouter no tiene tier gratis** (agregador de pago por token, muy barato) → se dejó igual; los `:free` de búsquedas pertenecen a **Unorouter** (servicio distinto, base URL `api.unorouter.com`).
- [x] **Proveedor Cerebras (WSE) agregado al catálogo BYOK — HECHO y DESPLEGADO (23-sep-2026)**: nuevo proveedor de inferencia ultrarrápida — 7 modelos públicos desde el catálogo real: `gpt-oss-120b` (recomendado, ~3000 tok/s), `llama-3.3-70b`, `qwen-3-32b`, `llama3.1-8b`, `gemma-4-31b`, preview `qwen-3-235b-a22b-instruct-2507` y `zai-glm-4.7`. Base URL `https://api.cerebras.ai/v1` añadida a `PROVIDER_BASE_URLS` + validación en el worker. *Archivos:* `AgentsView.tsx` (`BYOK_PROVIDERS`, `DEFAULT_BYOK_MODEL`), `apps/workers/src/index.ts`.
- [x] **⚠️ Cerebras ya NO tiene tier gratis — HECHO (23-sep-2026)**: la cuenta de prueba dio `402 payment_required`: desde ~ago/2026 el tier gratis de Cerebras se discontinuó, solo existe un crédito único de $5 que **exige tarjeta**. Consecuencia: el catálogo del panel quedó con **solo los 2 modelos públicos de pago** verificados contra `api.cerebras.ai/public/v1/models` → `gpt-oss-120b` ("ultrarrápido · pago") y `qwen-3.8-27b` ("rápido y eficiente · pago"); el proveedor probado en vivo dio el error real `IA 402`, el worker cayó a contingencia y el agente se restauró a managed. **Recordar:** Cerebras solo sirve si el cliente trae su key con tarjeta cargada.
- [x] **Memoria BYOK persistente (proveedor/modelo recordados al alternar modos) — HECHO y VERIFICADO EN PRODUCCIÓN (24-sep-2026)**: antes, al publicar Administrada TODO acababa en `workers-ai` y al volver a BYOK el panel caía a deepseek. Fix en dos capas: **(1)** columnas nuevas D1 `agents.byok_provider`/`byok_model` — el dashboard las escribe solo al guardar en modo BYOK y las **omite** en Administrada (así la memoria sobrevive) — worker re-desplegado (`ad76ee5c`) expone las columnas en `/config`; **(2)** `byokMemRef` de sesión en el panel para el caso **sin publicar** (editás BYOK, pasás a Administrada y volvés sin guardar → se recupera igual). Orden de prioridad al volver a BYOK: memoria de sesión > DB > deepseek. Verificado en vivo: PUT BYOK guarda memoria, PUT managed la conserva intacta. *Archivos:* `AgentsView.tsx`, `apps/workers/src/index.ts`.
- [x] **Flujo URL personalizada ("Otro") probado estructuralmente — HECHO (23-sep-2026)**: PUT con `chat_provider="custom"` + `chat_base_url="https://openrouter.ai/api/v1"` + key fake → guarda (200) y el `/api/chat` enruta **contra el proveedor externo** (error guardado: `IA 401: {"error":{"message":"Missing Authentication header"}}` de OpenRouter → confirma que llega al proveedor y solo falla la auth; el worker cae al mensaje de contingencia). Luego el agente se restauró a managed. El flujo custom queda listo para pegar una key real.
- [x] **Widget usa `header_title`, no el nombre** — HECHO (comportamiento esperado): verificado en vivo con sonda (PUT `header_title` → cambia el config que lee el widget; `name` queda interno y no cambia).
- [x] **Texto de instalación recortado — HECHO**: la nota de compatibilidad pasa de 2 renglones largos a uno corto ("Un solo fragmento sin dependencias. En WordPress se pega en el tema; en apps, en el HTML raíz.") — los chips de tecnología ya lo decían.
- [x] **Cupo de mensajes consistente con el plan — HECHO**: la cuenta Demo tenía `messages_limit=1500` guardado en Pro (override viejo y olvidado) → mostraba 1.500 en vez de 6.000. Fix en dos partes: (1) dato corregido a NULL ("sigue el plan") y (2) lógica alineada con `agent_limit`: ahora `messages_limit` escribe NULL cuando el valor coincide con el default del plan, y el worker calcula el cupo efectivo (`NULL → default del plan`) en el límite de chat, en `/overview`, en `/api/agents` y `/api/user`. Verificado con PUT (2500 → override; 6000 → vuelve a "sigue el plan"). No hay otra inconsistencia (agentes: null → 3, coincide con los 3 reales).
- [x] **Menú de perfil (avatar) recortado — HECHO**: el dropdown del avatar ahora es solo de cuenta: cabecera (nombre+plan), Planes & Facturación, Configuración, tema y Cerrar Sesión. Se eliminaron los duplicados de navegación que repetían el sidebar (Dashboard, Mi/Mis Agentes, Analíticas) y la prop `agentsCount` muerta. `onNavigate` se conserva solo para los dos items de cuenta.

## 🧹 Auditorías periódicas del catálogo de modelos

- [x] **UnoRouter y Cerebras añadidos/reordenados — HECHO y DESPLEGADO (23-sep-2026)**: el selector BYOK pasa a ordenar `… openrouter → onnirouter → unorouter → cerebras → custom`.
  - **UnoRouter** (`https://api.unorouter.com/v1`): gateway OpenAI-compatible, 200+ modelos, tier gratis con sufijo `:free` (DeepSeek V4 Flash/Pro, GPT-5.4/5.5, GLM 5.2/4.5 Flash, Gemma 4 31B) y pago por token sin expiración (DeepSeek V4 Flash $0.06/M · GPT-5.5 $0.19/M · Gemini 3.5 Flash $0.19/M · Kimi K2.6 · MiniMax M2.7 · Claude Haiku/Sonnet 5 · Opus 4.8). 18 modelos listados. IDs verificados en `unorouter.com/en/models` (sin prefijo de proveedor).
  - **Cerebras (WSE)** queda debajo de UnoRouter; se añadió `qwen-3.8-27b` (nuevo, multimodal, pago) verificado en el endpoint público `api.cerebras.ai/public/v1/models`. **Ojo (23-sep-2026): Cerebras no tiene tier gratis** — solo crédito único de $5 con tarjeta; el catálogo quedó reducido a los 2 modelos públicos de pago.
  - Worker: base URL y validación de `unorouter` añadidas (`PROVIDER_BASE_URLS`, `EDITABLE_FIELDS`). **Verificado en producción:** PUT con `chat_provider="unorouter"` → 200; agente demo restaurado a managed. *Archivos:* `AgentsView.tsx`, `apps/workers/src/index.ts` (deploy `087ff60b`).
- [ ] **Verificar cada 1-2 meses que los modelos del catálogo BYOK sigan activos** (los proveedores retiran y renombran modelos).
  - Proveedores que revisar: OpenRouter, OmniRouter, UnoRouter, NVIDIA (dependen de catálogos externos).
  - *Archivo:* `apps/dashboard/src/components/dashboard/AgentsView.tsx` (`BYOK_PROVIDERS`)
- [x] Confirmar fecha de retiro de `gemini-2.5-flash` / `gemini-2.5-flash-lite` (oct 2026) y retirarlos del catálogo. **HECHO: retirados del catálogo** (panel).

## 🎨 Rediseño del módulo "Planes & Facturación" (moderno, pero con NUESTRO branding)

> **Estado: EN ESPERA (decisión 24-sep-2026).** Este módulo hoy es **admin interno** (cambia plan y cupos de la cuenta, sin pago real). Con el login multi-cliente se reconstruye de cero (lógica de pago real, solicitud vs aplicación, etc.), así que **el rediseño visual grande queda pospuesto hasta esa tarea** — rediseñar la versión admin hoy es trabajo que se descarta.
>
> **Opción rápida si molesta el aspecto (hacer al tocar este pendiente):** "domesticar" el CSS existente en vez de rediseñar — alinear `BillingView.tsx` + CSS `.plan-*` a los tokens del panel: borde `1px var(--border-color)` + `--card-shadow` (sin `translateY` ni anillo azul), pesos `600` en títulos/precios (no 800/900), radios `--radius-brand`, textos con `--text-muted`. Eso unifica el look sin tocar funcionalidad, y se descarta igual al reconstruir con multi-cliente.
>
> **Regla número uno:** seguimos **nuestra marca**. Nada de Bento Grid, Liquid Glass, glassmorphism, neón ni sombras fuertes. El objetivo no es verse "como las grandes", es verse **como el resto de nuestro panel**, solo que bien pulido y moderno dentro de lo que ya somos.

### Problema detectado (por qué "no quedó bien")
La vista actual (`BillingView.tsx` + CSS `.plan-*`) quedó **más pesada** que el resto del dashboard. Inconsistencias concretas:
- **Sombras y elevación:** usé anillo `box-shadow` azul, `transform: translateY` al hover y `border: 1.5px`. El resto del panel es **plano**: borde 1px + `--card-shadow` (muy suave, `0 4px 20px rgba(15,23,42,.04)`).
- **Tipografía:** precios en `font-weight: 800/900`, títulos en mayúsculas con `letter-spacing`, textos muy oscuros. El panel usa **600** en títulos (~15.5px) y `--text-muted` para secundarios.
- **Radios:** usé 12-14px sueltos; el panel usa `--radius-brand: 18px`.
- Resultado: parece de otra app. **Regla de oro:** reutilizar los tokens y el "grosor" visual del panel, no inventar una estética nueva.

### Cómo lo hacen las plataformas grandes (solo para tomar la ESTRUCTURA, no el estilo)
- **Stripe / Vercel / Linear** — página de plan de **3-4 tarjetas** (Hobby/Pro/Enterprise), precio simple, badge **“Popular / Best value”** en la del medio y **“Current plan”** claro en la activa. El CTA cambia de texto según el plan.
- **Meters de consumo (Stripe, Vercel):** muestran `usado / límite` con **color por umbral** (verde ≤70%, ámbar ≤89%, rojo ≥90%). Buen patrón, se puede adoptar tal cual con nuestros colores.
- **Referencias de UX (no de estilo):** `saasui.design` → *“SaaS Usage & Quota Limit UX Patterns”*; `NN/g` (uso de contraste y jerarquía). Se citan por los **patrones de información**, no por el look.
- **Lo que NO traemos de ahí:** bento grids, liquid glass/glassmorphism, gradientes de fondo, `backdrop-blur`, `animate-pulse`, tipografías "extra black". Eso rompe nuestro branding.
- **Accesibilidad (sí aplica siempre):** contraste **≥ 4.5:1** en claro y oscuro, **no** usar emojis como iconos (usar los SVG de `icons.tsx`), respetar `prefers-reduced-motion`, targets táctiles ≥44px y `focus-visible` visible.

### Maqueta de referencia (archivo del usuario) — qué tomar y qué descartar
`C:\Users\User\Downloads\WhaShopping\panel_de_control\views\suscripcion.html` + `suscripcion.js` (Tailwind + Lucide, estilo Bento/Liquid Glass).
- ✅ **Tomar solo la estructura/idea:** cabecera con badge del plan + botón "Mejorar plan"; tarjetas de **límites** (agentes / mensajes / uso) con barra `usado / límite`; **grid de 4 planes** con estado activo; tabla de **historial de facturas**; selección de plan con confirmación.
- ❌ **Descartar el estilo:** es Bento Grid + Liquid Glass con `font-black`, `shadow-lg`, `backdrop-blur`, gradientes neón y `animate-pulse`. **No va con nuestra marca.**
- ❌ **Descartar su lógica de pago por WhatsApp:** es de mostrador, no de SaaS multi-cliente (ver el pendiente de seguridad de arriba).

### Propuesta (todo con nuestro sistema de diseño)
1. **Header** igual al de otras vistas: `<h2>` 17px/600 + `.subtitle` muted. A la derecha, pill discreto **"Plan {nombre} activo"** y botón *Mejorar plan* con el `.btn-primary` existente.
2. **Tarjetas de límites (agentes / mensajes):** mismo tratamiento que las tarjetas del panel (`background: var(--bg-subtle)`, `border: 1px var(--border-color)`, `border-radius: var(--radius-brand)`, icono en caja de 36px). Barra de progreso con color por umbral + texto `usado / límite`. **Plano, sin elevación.**
3. **Grid de 4 planes:** tarjeta = `var(--bg-surface)` + borde 1px + `--card-shadow`; la **activa** se marca con `border-color: var(--primary-color)` + tinte suave `color-mix(... 8%)`, **sin** sombra grande ni `translateY`. Precio en 20-22px/700 (no 900). Jerarquía por tamaño y color, no por peso excesivo.
4. **Editor de cupos:** mantener como panel estándar; inputs `.form-input`/`.form-select`, botón `.btn-primary`. (Ya funciona — solo unificar estilos.)
5. **Historial de facturas (nuevo, opcional):** tabla simple + estado tipo pill. Hoy la facturación es manual, así que puede empezar como **lista vacía con mensaje**.
6. **Micro-interacciones sobrias:** transición 150ms en hover, y `prefers-reduced-motion` las desactiva. Nada de animaciones permanentes.
7. **Tokens a reutilizar (no inventar):** `--primary-color #3559ff`, `--bg-surface`, `--bg-subtle`, `--surface-subtle`, `--border-color #e2e8f0/#232633`, `--text-main`, `--text-muted`, `--radius-brand 18px`, `--card-shadow`. Dark mode ya lo maneja `body.dark-mode`.

### Criterio de aceptación
- [ ] A simple vista **no se distingue** del resto de vistas (mismo borde, misma sombra, mismo peso de letra, mismos radios, mismos colores).
- [ ] Cero Bento / Liquid Glass / glassmorphism / neón / gradientes de fondo.
- [ ] Sin sombras fuertes ni `translateY`; la tarjeta activa se destaca con borde/tinte, no con elevación.
- [ ] Contraste ≥4.5:1 en claro y oscuro; sin emojis como iconos.
- [ ] Funcionalidad intacta: seguir viendo el plan y los cupos, editarlos y guardarlos igual que hoy.
- [ ] Responsive (1 col en móvil, 2 en tablet, 4 en desktop) y hover/entrada suaves + `prefers-reduced-motion`.

## 🚀 Otras mejoras pendientes

- [ ] Landing page pública (`apps/landing`) con plans, features y precios.
- [ ] Bandeja de Leads (captura de prospectos) en el dashboard.
- [ ] Alertas a Telegram/WhatsApp por mensajes con intención de compra o contacto.
- [ ] Exportar conversaciones / métricas a CSV.

## 🔑 Secretos de entorno (cómo queda la seguridad en producción)

| Variable | Dónde | Para qué | Estado |
| --- | --- | --- | --- |
| `OWNER_TOKEN` | Dashboard **y** Worker (mismo valor) | Token que el dashboard inyecta y el worker valida en `PUT`/`config` | ✅ APLICADO (worker + `apps/dashboard/.env.local`) |
| `ENCRYPTION_KEY` | Worker | Cifra las API Keys en reposo (AES-256-GCM) | ✅ APLICADO (worker) |
| `DASHBOARD_PASSWORD` | Dashboard | Contraseña del login del dueño | ⏳ pendiente (login completo, al final) |
| `SESSION_SECRET` | Dashboard | Firman la cookie de sesión (HMAC) | ⏳ pendiente (login completo, al final) |
| `WORKER_API_BASE` | Dashboard *(opcional)* | URL base del worker; si falta, usa la actual por defecto | n/d |

> ✅ **Aplicado el 22-sep-2026:** `OWNER_TOKEN` + `ENCRYPTION_KEY` seteados en el worker con `wrangler secret bulk` y el dashboard local con la misma `OWNER_TOKEN` en `.env.local`. El worker quedó re-desplegado (versión `c6fddefe`). Verificado en vivo: `/config`/`PUT`/`POST /api/agents` sin token → `403`.
>
> ℹ️ **El login del panel es OPCIONAL y se hará AL FINAL (decisión):** si `DASHBOARD_PASSWORD` no está configurada, el panel entra directo (sin pedir contraseña). La puerta se activa sola el día que quieras protegerlo (basta configurar la variable). Si el dashboard se usa desde otra máquina/repo/deploy, copiar el valor de `OWNER_TOKEN` de `apps/dashboard/.env.local`.

---

## 📝 Notas rápidas

- Facturación: **decisión tomada, se mantiene manual** (sin pasarela automática por el momento).
- **Planes & Facturación hoy es admin interno:** mientras el login esté apagado, cualquiera con acceso al panel puede cambiar plan y cupos (sirve para pruebas). Antes de abrirlo a clientes: verificar el pendiente de seguridad "Bloquear el cambio de plan para el cliente final" y el rediseño visual 🎨.
- Streaming: **descartado por el momento** (agrega complejidad al worker sin necesidad; hoy el widget ya muestra indicador de escritura).
- Proveedor DeepSeek: expone solo `deepseek-flash` (DeepSeek-V4.1-Flash), que es el modelo recomendado.
- Elegir proveedor en Modo clave propia: DeepSeek queda primero y por defecto; al elegir "Otro (URL personalizada)" se limpia el modelo y se exige URL base al guardar.
- Probá el modelo real en la **Vista previa en vivo** del panel (chatea con tu clave y modelo guardados).
- Plan **Free = 20 mensajes** administrados (bajado de 50 por decisión de negocio). Los cupos ya se imponen solos desde el plan (`PLAN_DEFAULTS` en el worker) y son editables por usuario desde "Planes & Facturación" (`PUT /api/user`). El cupo de mensajes vive en `users.messages_limit` (pozo por cuenta, compartido entre todos los agentes; BYOK no consume cupo).
- Costos verificados (ago-2026): Worker IA administrada usa por defecto `@cf/meta/llama-3.1-8b-instruct-fast` (~$0.75 por 1.000 mensajes de ~1.5k in/400 out); DeepSeek V4 Flash directo ~$0.59/1.000 (off-peak). Incluso el peor caso (Agency, 25.000 msgs con modelo grande) deja >75% de margen.