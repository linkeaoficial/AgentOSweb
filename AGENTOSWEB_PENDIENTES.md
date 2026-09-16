# 🤖 AgentOSweb — Planificador de Pendientes (Backlog)

> Documento vivo. Todo lo que falta por hacer, mejorar o revisar queda anotado aquí para no olvidarlo.
> Marcá con `[x]` lo que ya esté hecho. Agregá nuevas ideas al final, en la zona que corresponda.

---

## 🔒 Pendientes de Seguridad (prioridad máxima)

- [x] **API Keys cifradas en la base — HECHO**: AES-256-GCM (`crypto.subtle`) con prefijo `e1:`. Claves viejas sin prefijo se conservan (retrocompatible). Se descifran solo al inferir. *Requisito:* variable `ENCRYPTION_KEY` en el worker. *Archivo:* `apps/workers/src/index.ts`
- [x] **El endpoint `PUT /api/agent/:id` exige autenticación — HECHO** (doble puerta):
  1. Worker valida header `X-Owner-Token` (secreto `OWNER_TOKEN`) en `PUT` y en `/config`.
  2. El dashboard tiene login del dueño (cookie firma HMAC) y las llamadas de escritura pasan por un proxy Next.js que inyecta el token desde el servidor (el navegador nunca ve el token).
  - *Requisitos:* en el worker `OWNER_TOKEN`; en el dashboard `DASHBOARD_PASSWORD`, `SESSION_SECRET` y `OWNER_TOKEN` (mismo valor).
  - *Archivos:* `apps/workers/src/index.ts`, `apps/dashboard/src/app/api/{login,logout,session,agent/[id]}`, `apps/dashboard/src/lib/session.ts`
- [x] Revisar que la API Key nunca se devuelva al frontend — **HECHO**: `/config` y `/agent` devuelven solo `has_chat_api_key` (booleano), nunca la clave.
- [ ] (Post-lanzamiento) Login multi-cliente real (registro, planes, autenticación por usuario). Hoy la puerta es de un solo dueño.
- [ ] Rediseñar la pantalla de login del panel (+ activarla en producción): branding con logo, degradados, animación y modo oscuro. Hoy el login existe pero está desactivado hasta configurar `DASHBOARD_PASSWORD`.
- [ ] **Bloquear el cambio de plan para el cliente final (hoy es admin interno).** Mientras haya un solo dueño y el login esté apagado, el menú "Planes & Facturación" permite cambiar el plan sin pagar ni aprobar nada — está bien para pruebas internas, pero **no** debe quedar así de cara a clientes. Cuando exista login multi-cliente + pago: el cliente solo **solicita** el cambio (o paga) y el sistema/vos lo aplica; el endpoint `PUT /api/user` debe quedar restringido al rol admin. *Archivos:* `apps/workers/src/index.ts` (`handleUserUpdate`), `apps/dashboard/src/app/api/user/route.ts`, `BillingView.tsx`.

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
- [ ] Vista "Base de Conocimiento" global en el menú (hoy es un placeholder; la KB vive dentro de Mis Agentes).

## ✅ Pulido reciente (ronda sep-2026) — HECHO

- [x] **Modo oscuro persistente al recargar — HECHO**: causa raíz = el efecto de escritura de `Dashboard.tsx` corría en el mismo commit que el de lectura con el estado inicial `false` → sobrescribía el localStorage a "light" y pintaba claro el primer frame. Fix: `useState` con inicializador lazy leyendo el localStorage + script inline pre-paint en `apps/dashboard/src/app/layout.tsx` que aplica `body.dark-mode` antes de pintar (eliminado el efecto de lectura, quitado el clobber). Verificado: script presente en el HTML servido, `tsc`=0, HTTP 200.
- [x] **Prompt vacío = tono neutro automático — HECHO**: el worker usa un fallback `"Eres el asistente virtual de {header_title}..."` cuando `system_prompt` viene vacío (`apps/workers/src/index.ts`, despliegue `0c05c51d`); el panel muestra un hint bajo el textarea cuando está vacío. Verificado en vivo con `/api/chat` y `agent-demo` (sin personalidad).
- [x] **Modelos gratis marcados "(gratis)" — HECHO** (catálogo `BYOK_PROVIDERS` en `AgentsView.tsx`, nada borrado): Groq (6 gratis, + Llama 4 Scout), NVIDIA NIM (11 gratis, + Step 3.7 Flash/Kimi K3/MiniMax M3/Gemma 4), Mistral (4, tier Experiment con tu key), OpenRouter (+10 con sufijo `:free`, incluido el router "OpenRouter Gratis"). **OmniRouter no tiene tier gratis** (agregador de pago por token, muy barato) → se dejó igual; los `:free` de búsquedas pertenecen a **Unorouter** (servicio distinto, base URL `api.unorouter.com`).
- [x] **Widget usa `header_title`, no el nombre** — HECHO (comportamiento esperado): verificado en vivo con sonda (PUT `header_title` → cambia el config que lee el widget; `name` queda interno y no cambia).
- [x] **Texto de instalación recortado — HECHO**: la nota de compatibilidad pasa de 2 renglones largos a uno corto ("Un solo fragmento sin dependencias. En WordPress se pega en el tema; en apps, en el HTML raíz.") — los chips de tecnología ya lo decían.
- [x] **Cupo de mensajes consistente con el plan — HECHO**: la cuenta Demo tenía `messages_limit=1500` guardado en Pro (override viejo y olvidado) → mostraba 1.500 en vez de 6.000. Fix en dos partes: (1) dato corregido a NULL ("sigue el plan") y (2) lógica alineada con `agent_limit`: ahora `messages_limit` escribe NULL cuando el valor coincide con el default del plan, y el worker calcula el cupo efectivo (`NULL → default del plan`) en el límite de chat, en `/overview`, en `/api/agents` y `/api/user`. Verificado con PUT (2500 → override; 6000 → vuelve a "sigue el plan"). No hay otra inconsistencia (agentes: null → 3, coincide con los 3 reales).
- [x] **Menú de perfil (avatar) recortado — HECHO**: el dropdown del avatar ahora es solo de cuenta: cabecera (nombre+plan), Planes & Facturación, Configuración, tema y Cerrar Sesión. Se eliminaron los duplicados de navegación que repetían el sidebar (Dashboard, Mi/Mis Agentes, Analíticas) y la prop `agentsCount` muerta. `onNavigate` se conserva solo para los dos items de cuenta.

## 🧹 Auditorías periódicas del catálogo de modelos

- [ ] **Verificar cada 1-2 meses que los modelos del catálogo BYOK sigan activos** (los proveedores retiran y renombran modelos).
  - Proveedores que revisar: OpenRouter, OmniRouter, NVIDIA (dependen de catálogos externos).
  - *Archivo:* `apps/dashboard/src/components/dashboard/AgentsView.tsx` (`BYOK_PROVIDERS`)
- [x] Confirmar fecha de retiro de `gemini-2.5-flash` / `gemini-2.5-flash-lite` (oct 2026) y retirarlos del catálogo. **HECHO: retirados del catálogo** (panel).

## 🎨 Rediseño del módulo "Planes & Facturación" (moderno, pero con NUESTRO branding)

> **Estado:** pendiente / solo visual. La **funcionalidad actual se mantiene** tal cual (es admin interno para pruebas: cambia plan y cupos de la cuenta). Esta tarea es **únicamente la capa visual**.
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

| Variable | Dónde | Para qué |
| --- | --- | --- |
| `DASHBOARD_PASSWORD` | Dashboard | Contraseña del login del dueño |
| `SESSION_SECRET` | Dashboard | Firman la cookie de sesión (HMAC) |
| `OWNER_TOKEN` | Dashboard **y** Worker (mismo valor) | Token que el dashboard inyecta y el worker valida en `PUT`/`config` |
| `ENCRYPTION_KEY` | Worker | Cifra las API Keys en reposo (AES-256-GCM) |
| `WORKER_API_BASE` | Dashboard *(opcional)* | URL base del worker; si falta, usa la actual por defecto |

> ⚠️ **PASO OBLIGATORIO en producción:** setear `OWNER_TOKEN` en el worker y en el dashboard, `ENCRYPTION_KEY` en el worker, y `DASHBOARD_PASSWORD` + `SESSION_SECRET` en el dashboard. Sin `OWNER_TOKEN`, el worker sigue abierto (modo dev). En el worker se configuran con `wrangler secret put`.
>
> ℹ️ **El login del panel es OPCIONAL:** si `DASHBOARD_PASSWORD` no está configurada, el panel entra directo (sin pedir contraseña). La puerta se activa sola el día que quieras protegerlo (basta configurar la variable).

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