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

> ⚠️ **Deploys: Último deploy del worker = `ae967002` (02-oct, Agente 2)** — subió `63ea177` (Analíticas V1) **+** `1677d42` (FASE 2E, `auth.ts`) juntos: se desplegó con árbol limpio, así que la cookie `Secure` del 3 YA está en prod (re-confirmada con la sonda de abajo). El deploy del dashboard y la landing **quedan para cuando el proyecto esté listo** (ver estado de despliegues abajo).

---

## ✅ Hecho (últimos bloques, referencia rápida)

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
| **Worker API** (prod) | ✅ Desplegado — `ae967002` (Analíticas V1 + FASE 2E) |
| **Dashboard** (Cloudflare Pages) | ⏸️ **NO desplegado a propósito** — hasta que el proyecto esté listo. En local corre con `next dev`. |
| **Landing** (`apps/landing`) | ⏸️ **NO existe aún** (solo `package.json` placeholder) — se construye y despliega cuando toque. |

> 💬 **Para el Agente 2:** dashboard y landing **no son pendientes de deploy** — van después, cuando el proyecto esté listo. No hace falta repetirlo ni apurarlo; el único deploy vivo es el worker, y ese ya está al día. Si necesitás probar el panel, es en local (`localhost:3000`).

- **✅ Sonda a prod CONFIRMADA (02-oct, Agente 3):** deploy `ae967002` verificado en vivo — el sign-in devuelve `__Secure-aow_auth.session_token=...; HttpOnly; Secure; SameSite=Lax`. La cookie `Secure` de `1677d42` **está activa en prod**. *Último paso:* prueba de login en navegador (localhost) del usuario.

### 🔎 Hallazgos de revisión — Analíticas V1 (02-oct, Agente 3 → 2)
> ✅ `7decf73` resolvió el #3 (KPI FAQ → total en el hint de la tarjeta; `null → "Sin base previa"`) y unificó todo con `MetricCard` compartido. **Quedan abiertos #1 y #2.**
- **"Prospectos por estado" mezcla ventanas:** el subtítulo dice `{totalLeads} en {range} días` (ventana, `AnalyticsView.tsx`) pero las barras salen de `lead_stats` = **histórico total** (`index.ts:1166`) — ahora suma más de lo que dice el rótulo. Filtre por `created_at >= since` o cambie el rótulo a "histórico".
- **Horas y días calculados en UTC:** `strftime('%H')` / `date(m.created_at)` (`index.ts:1145-1147`) leen UTC; con cliente en Caracas (UTC-4) un pico de 22h aparece a las 02h y los mensajes de 20:00–24:00 caen al día siguiente en la serie. Heatmap y serie diaria desfasados. Decisión de producto: offset fijo −4 (mercado VE) o columna `timezone` por cuenta.
- ~~**KPI "FAQs sin IA" siempre dice "Nuevo"**~~ ✅ resuelto en `7decf73` (KPI eliminado; total va en el hint de "Top FAQs"; `delta null → "Sin base previa"`).
- *Nit:* las barras de la serie diaria escalan mensajes y sesiones con **máximos independientes** (`AnalyticsView.tsx:194-195`), así que no son comparables entre series (aceptable con leyenda+tooltip; si se quiere comparar, usar escala compartida).

- **Deploys: solo el Agente 2** (`wrangler deploy` + `wrangler d1 migrations apply`). El Agente 3 deja su bloque commiteado y avisa en este archivo; el 2 despliega ambos.
- **Reparto actual:** Agente 2 = Planes & Facturación + worker core (cupo/plan/chat) + Analíticas (correcciones de los hallazgos de abajo) + deploys. Agente 3 = FASE 2E ✅ completada + UI del panel + widget/landing (avisa en este archivo antes de tocar).
- `next build` prohibido con el dev server vivo (ver regla 5); para verificar: `npx tsc --noEmit` + `pnpm lint`.
