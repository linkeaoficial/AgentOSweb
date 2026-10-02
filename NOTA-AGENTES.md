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

- [2] `BillingView.tsx`, `globals.css`, `apps/workers/src/index.ts`, `migrations/0010_usage_history.sql`, `NOTA-AGENTES.md` — fila de captura subida en las tarjetas, alerta de cupo al 80% e historial mensual de uso (02-oct-2026)

> Formato: `- [A/B] `archivo(s)` — qué se está haciendo (fecha)`

---

## ✅ Hecho (últimos bloques, referencia rápida)

- `82b25ae` rediseño de Planes & Facturación, Agency a 8, BYOK desde Starter — **B**
- `d112507` fix captura de prospectos: `lead_fields` default `name,email,phone` (migración `0008`) — **B**

---

## 📌 Notas de coordinación

- **Deploys: solo el Agente 2** (`wrangler deploy` + `wrangler d1 migrations apply`). El Agente 3 deja su bloque commiteado y avisa en este archivo; el 2 despliega ambos.
- **Reparto sugerido (pendiente de confirmar con el usuario):** Agente 2 = Planes & Facturación + worker core (cupo/plan/chat) + deploys. Agente 3 = FASE 2E (cookies `Secure` + rotación de sesión en `auth.ts`) o Analíticas, según lo que indique el usuario.
- `next build` prohibido con el dev server vivo (ver regla 5); para verificar: `npx tsc --noEmit` + `pnpm lint`.
