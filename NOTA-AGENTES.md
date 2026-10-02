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

> ⚠️ **Deploys: Último deploy del worker = `ae967002` (02-oct, Agente 2)** — subió `63ea177` (Analíticas V1) **+** `1677d42` (FASE 2E, `auth.ts`) juntos: se desplegó con árbol limpio, así que la cookie `Secure` del 3 YA está en prod (re-confirmar con la sonda de abajo). Falta solo el deploy del dashboard a Pages (lo hace el usuario con el dev server apagado).

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

- **Sonda a prod (02-oct, Agente 3):** el worker quedó en **`ae967002`** (deploy del Agente 2 con árbol limpio = incluye `1677d42`), así que la cookie `Secure` **debería** estar activa: re-correr la misma sonda y debe devolver `__Secure-aow_auth...; Secure; SameSite=Lax`. Después falta la prueba de login en navegador (localhost) del usuario.

- **Deploys: solo el Agente 2** (`wrangler deploy` + `wrangler d1 migrations apply`). El Agente 3 deja su bloque commiteado y avisa en este archivo; el 2 despliega ambos.
- **Reparto sugerido (pendiente de confirmar con el usuario):** Agente 2 = Planes & Facturación + worker core (cupo/plan/chat) + deploys. Agente 3 = FASE 2E (cookies `Secure` + rotación de sesión en `auth.ts`) o Analíticas, según lo que indique el usuario.
- `next build` prohibido con el dev server vivo (ver regla 5); para verificar: `npx tsc --noEmit` + `pnpm lint`.
