# 📋 NOTA-AGENTES — Coordinación entre pestañas

> Archivo de vuelo compartido. Dos agentes trabajan el mismo repo en paralelo.
> **Revisá este archivo antes de tocar cualquier cosa** y actualizalo al arrancar/terminar un bloque.

---

## 📜 Reglas (rápidas)

1. **Antes de editar:** `git status` + este archivo. Lo que esté sucio o listado en "En vuelo" es de la otra pestaña → no tocar.
2. **Al terminar un bloque:** commitear (chico y claro) y sacar la entrada de "En vuelo".
3. **Archivos en disputa:** si necesitás un archivo que está "En vuelo" del otro, esperá o acordalo acá.
4. **`wrangler deploy`:** solo una pestaña a la vez. Anotá acá quién despliega.
5. **Sin `next build` con el dev server vivo** (rompe `.next`). Para verificar: `npx tsc --noEmit`.

---

## 🏷️ Identidad

| Agente | Cómo se marca |
| --- | --- |
| Agente 2 (pestaña con wrangler/deploys) | `2:` |
| Agente 3 | `3:` |

> Etiquetas viejas `A:`/`B:` = mismas pestañas, `B` era el Agente 2.

- `3:` **revisado y operativo (02-oct-2026)** — esta pestaña. Respeta lo que esté "En vuelo".

---

## 🔴 En vuelo (trabajo sin commitear)

> Formato: `- [2/3] `archivo(s)` — qué se está haciendo (fecha)`

- [2] **Auditoría `security-audit` (modo full, perfil `standard`, solo lectura)** — ref `44a3bc6`, árbol limpio al iniciar. Salida en `~/security-audit-skill/AgentOSweb/run-1` (fuera del repo). *No toca código:* si el 3 va a commitear cambios durante la auditoría, avisar acá primero para re-capturar el estado (los hallazgos quedan contra la ref indicada). El 2 despliega solo después de cerrar.
- [3] ~~Barrido mobile~~ ✅ **cerrado 03-oct** — todas las vistas verificadas a 390px sin cortes: Dashboard, Mi Agente (editor completo), Prospectos (10 filas), Planes & Facturación, Analíticas y Configuración. Sin cambios de código. Árbol limpio.

> ✅ **Rediseño de Configuración — TOMADO POR EL AGENTE 3 (03-oct, OK del usuario):** el 2 lo cede. El 3 editará `SettingsView.tsx` + bloque CSS propio en `globals.css`, estilo ChatGPT/Gemini (sub-nav secciones en PC / chips con scroll en móvil), cubriendo toda la config del proyecto: Cuenta, Apariencia (tema sincronizado con topbar), Seguridad (contraseña + sesiones activas), Plan/Facturación (enlaces) y Zona de peligro (eliminar cuenta). **Aviso:** el 3 va a commitear durante tu auditoría (incluye este docs); si necesitas re-capturar estado, avísame acá. *Endpoints nuevos que pida la UI (ej. eliminar cuenta, sesiones activas) = worker = zona del 2, tras la auditoría.*

> ⚠️ **Deploys: Último deploy del worker = `404a3a8f` (02-oct, Agente 2)** — subió `bb2f170` (Analíticas V1.1) con árbol limpio; antes había quedado `ae967002` (Analíticas V1 + FASE 2E). El deploy del dashboard y la landing **quedan para cuando el proyecto esté listo** (ver estado de despliegues abajo).

---

## ✅ Hecho (últimos bloques, referencia rápida)

- `0806fb2` **Rediseño de Configuración** (Settings estilo ChatGPT/Gemini) — **3** · 5 secciones con sub-nav lateral (PC) / chips con scroll (móvil): Cuenta (identidad + accesos a Facturación/Agentes), Apariencia (claro/oscuro/**sistema** sincronizado con topbar + anti-FOUC en `layout.tsx`), Seguridad (cambiar contraseña + **sesiones activas** con cierre individual/todas, usa `list-sessions`/`revoke-session`), Plan (pill + vencimiento + barras de mensajes/agentes + CTA billing), Zona de peligro (eliminar cuenta con `confirmPhrase` = email). Tema: `theme` tri-estado en `Dashboard.tsx`. Fixes incluidos: proxy de auth reenvía `User-Agent` (antes las sesiones salían "node") y `list-sessions` se lee como array plano. *E2E local: capturas desktop oscuro/claro + móvil 390px con sesiones reales ("Edge · Windows", "Este dispositivo").* **Para el 2 (worker):** `user.deleteUser.enabled` en `auth.ts` para activar el botón de eliminar cuenta (hoy responde 404 y la UI lo informa); opcional sync `user.name`↔`users.name` para permitir editar nombre (hoy es solo lectura).

- `92cb215` **Auditoría responsive del panel + 2 fixes en Analíticas móvil** — **3** · *Todo el panel revisado (bloque "RESPONSIVE MÓVIL CONSOLIDADO" ya cubre sidebar→hamburguesa, tablas→tarjetas, grids, auth, topbar). Fixes: serie diaria con `overflow-x: auto` (90 días se cortaba en pantallas angostas) y ejes del heatmap con `minmax(0,1fr)` (rótulos "6h/12h/18h" desalineaban las columnas). *Pendiente:* captura de teléfono del usuario para validación visual.*
- `7decf73` Analíticas al estilo del panel: `MetricCard` compartido, `h3` 16/600, skeleton, `es-AR` — **2**
- `63ea177` **Analíticas V1 completa** + muro para Free: selector 7/30/90 días, 6 KPIs con delta vs. período anterior, serie diaria, heatmap día×hora, embudo sesiones→mensajes→prospectos, top FAQs, prospectos por estado; endpoint `GET /api/analytics/:agentId` + proxy; gate **Starter+** (`403 plan_required` en Free); migración `0011` (`idx_messages_created`, local+remoto) — **2** · *E2E local 200/403 con datos sembrados y prod 200 con `agent-demo` (8 sesiones, 74 mensajes, heat 7×24); deploy `ae967002`.*

- `1677d42` **FASE 2E**: cookie `Secure` (`auth.ts`) + vista Configuración con "Cambiar contraseña" y rotación de sesiones (`SettingsView.tsx`) — **3** · *E2E: sesión vieja muere, nueva viva, `INVALID_PASSWORD` mapeado; verificado local con `wrangler dev` (Set-Cookie con `Secure` + `__Secure-`). **Pendiente post-deploy:** login en navegador del usuario para confirmar que Chrome/Firefox aceptan la cookie Secure en localhost.*
- `9b35bda` cintillo de plan sin puntito verde + tarjeta marcada sin ring de sombra — **3**
- `580f0f7` fila de captura arriba en tarjetas, alerta de cupo al 80% e historial mensual de uso (`0010`) — **2**
- `82b25ae` rediseño de Planes & Facturación, Agency a 8, BYOK desde Starter — **2**
- `d112507` fix captura de prospectos: `lead_fields` default `name,email,phone` (migración `0008`) — **2**

---

## 📌 Notas de coordinación

### 📡 Estado de despliegues (02-oct)

| Componente | Estado |
| --- | --- |
| **Worker API** (prod) | ✅ Desplegado — `404a3a8f` (Analíticas V1.1: tz, estados por ventana, rate limit, caché) |
| **Dashboard** (Cloudflare Pages) | ⏸️ **NO desplegado a propósito** — hasta que el proyecto esté listo. En local corre con `next dev`. |
| **Landing** (`apps/landing`) | ⏸️ **NO existe aún** (solo `package.json` placeholder) — se construye y despliega cuando toque. |

> 💬 **Para el Agente 2:** dashboard y landing **no son pendientes de deploy** — van después, cuando el proyecto esté listo. No hace falta repetirlo ni apurarlo; el único deploy vivo es el worker, y ese ya está al día. Si necesitás probar el panel, es en local (`localhost:3000`).

- **✅ Sonda a prod CONFIRMADA (02-oct, Agente 3):** deploy `ae967002` verificado en vivo — el sign-in devuelve `__Secure-aow_auth.session_token=...; HttpOnly; Secure; SameSite=Lax`. La cookie `Secure` de `1677d42` **está activa en prod**. *Último paso:* prueba de login en navegador (localhost) del usuario.

### 🔎 Hallazgos de revisión — Analíticas V1 (02-oct, Agente 3 → 2)
> ✅ `7decf73` resolvió el #3 (KPI FAQ → total en el hint de la tarjeta; `null → "Sin base previa"`) y unificó todo con `MetricCard` compartido.
> ✅ `bb2f170` (deploy `404a3a8f`) resolvió **#1 y #2**:
- ~~**"Prospectos por estado" mezcla ventanas**~~ ✅: ahora `SELECT status, COUNT(*) FROM leads WHERE agent_id=? AND created_at>=?` (ventana local, usa `idx_leads_dashboard`); verificado en prod: statuses suma = `kpis.leads` (14 = 14).
- ~~**Horas y días calculados en UTC**~~ ✅: el panel manda `tz` (offset del navegador, `getTimezoneOffset` negado); el worker agrupa día/hora con `date(created_at, ?)` / `strftime('%H', …, ?)` en local y recorta las ventanas con el instante UTC exacto (los `WHERE` siguen usando índice; offset clamp −720..840 min, default 0). Verificado local y prod (04:30 UTC → 0h con tz −240).
- ~~**KPI "FAQs sin IA" siempre dice "Nuevo"**~~ ✅ resuelto en `7decf73`.
- **V1.1 también** (`bb2f170`): rate limit 30/min por dueño en `GET /api/analytics` (bucket in-memory, `isRateLimited`; probado 30×200 + 5×429) y caché KV `analytics:{user}:{agent}:{days}:{tz}` TTL 60s (2da llamada 156ms vs 1.8s fría).
- *Nit pendiente:* las barras de la serie diaria escalan mensajes y sesiones con **máximos independientes** (`AnalyticsView.tsx`), no comparables entre series (aceptable con leyenda+tooltip).

- **Deploys: solo el Agente 2** (`wrangler deploy` + `wrangler d1 migrations apply`). El Agente 3 deja su bloque commiteado y avisa en este archivo; el 2 despliega ambos.
- **Reparto actual:** Agente 2 = Planes & Facturación + worker core (cupo/plan/chat) + deploys + endpoints que pida la UI de Settings (eliminar cuenta, sesiones). Agente 3 = FASE 2E ✅ + UI del panel + **rediseño Configuración (03-oct)** ✅ + barrido mobile + widget/landing (avisa antes de tocar).
- `next build` prohibido con el dev server vivo (ver regla 5); para verificar: `npx tsc --noEmit` + `pnpm lint`.
