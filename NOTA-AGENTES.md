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

- [2] `apps/workers/src/index.ts` + `migrations/0011_messages_created_index.sql` + `AnalyticsView.tsx` + `Dashboard.tsx` + `globals.css` + `app/api/analytics/[id]/route.ts` + `database/schema.sql` + docs — **Analíticas V1 completa**: selector 7/30/90 días, 6 KPIs con delta vs. período anterior, serie diaria, heatmap día×hora, embudo, top FAQs, prospectos por estado; **gate Starter+ con muro para Free** (`403 plan_required`) (02-oct-2026)

> Formato: `- [2/3] `archivo(s)` — qué se está haciendo (fecha)`

> ⚠️ **Deploys:** el bloque FASE 2E del 3 YA está commiteado (`1677d42`) — `auth.ts` limpio en git. Cuando el 2 cierre su bloque de Analíticas (commitee), puede desplegar el worker con ambos. Ojo: si despliega con su `index.ts` a medio escribir, sube eso; deploy = working tree.

> ⚠️ **2: la FASE 2E la tomó el Agente 3** (solo toca `auth.ts`). Elegí tu tarea y anotala acá. Recordá: deploys de worker al cerrar bloques los hacés vos (el 3 deja su bloque commiteado y anotado).

---

## ✅ Hecho (últimos bloques, referencia rápida)

- `1677d42` **FASE 2E**: cookie `Secure` (`auth.ts`) + vista Configuración con "Cambiar contraseña" y rotación de sesiones (`SettingsView.tsx`) — **3** · *E2E: sesión vieja muere, nueva viva, `INVALID_PASSWORD` mapeado; verificado local con `wrangler dev` (Set-Cookie con `Secure` + `__Secure-`). **Pendiente post-deploy:** login en navegador del usuario para confirmar que Chrome/Firefox aceptan la cookie Secure en localhost.*
- `9b35bda` cintillo de plan sin puntito verde + tarjeta marcada sin ring de sombra — **3**
- `580f0f7` fila de captura arriba en tarjetas, alerta de cupo al 80% e historial mensual de uso (`0010`) — **2**
- `82b25ae` rediseño de Planes & Facturación, Agency a 8, BYOK desde Starter — **2**
- `d112507` fix captura de prospectos: `lead_fields` default `name,email,phone` (migración `0008`) — **2**

---

## 📌 Notas de coordinación

- **Sonda a prod (02-oct, Agente 3):** sign-in directo al worker devuelve cookie **sin** `Secure` y sin prefijo `__Secure-` → `1677d42` (`auth.ts`) **aún no está desplegado**. Se confirma con la misma sonda cuando el worker responda `__Secure-aow_auth...; Secure; SameSite=Lax`. Después de eso falta la prueba de login en navegador (localhost) del usuario.

- **Deploys: solo el Agente 2** (`wrangler deploy` + `wrangler d1 migrations apply`). El Agente 3 deja su bloque commiteado y avisa en este archivo; el 2 despliega ambos.
- **Reparto sugerido (pendiente de confirmar con el usuario):** Agente 2 = Planes & Facturación + worker core (cupo/plan/chat) + deploys. Agente 3 = FASE 2E (cookies `Secure` + rotación de sesión en `auth.ts`) o Analíticas, según lo que indique el usuario.
- `next build` prohibido con el dev server vivo (ver regla 5); para verificar: `npx tsc --noEmit` + `pnpm lint`.
