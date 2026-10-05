"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useToast } from "./notifications";
import { Dropdown } from "./AgentsView";
import { pageNumbers } from "./LeadsView";
import ConfirmModal from "./ConfirmModal";
import PlanHistoryModal from "./PlanHistoryModal";
import type { PlanDefault } from "./BillingView";
import { IconMessage } from "./icons";

interface SupportTicket {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_name: string | null;
  user_plan: string | null;
  category: string;
  subject: string;
  message: string;
  status: string;
  page: string | null;
  created_at: string;
}

// Espejo de SUPPORT_CATEGORIES / SUPPORT_STATUSES del worker (0013).
const CATEGORY_LABELS: Record<string, string> = {
  bug: "Algo no funciona",
  pregunta: "Pregunta",
  facturacion: "Planes y facturación",
  widget: "Widget en la web",
  mejora: "Sugerencia",
};
const STATUS_LABELS: Record<string, string> = {
  abierto: "Abierto",
  en_curso: "En curso",
  resuelto: "Resuelto",
};

interface AdminUser {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  plan: string | null;
  agent_limit: number | null;
  messages_limit: number | null;
  messages_used: number;
  agents: number;
  created?: string | number | null;
  plan_expires_at?: string | null;
  has_telegram?: boolean;
  has_webhook?: boolean;
  agent_names?: string | null;
  // Plan del que cayo la cuenta por vencimiento automatico.
  downgraded_from?: string | null;
  // El worker ya resuelve si el cliente todavia no vio el aviso de renovacion.
  show_expiry_notice?: boolean;
}

interface AdminViewProps {
  planDefaults: Record<string, PlanDefault>;
}

const PAGE_SIZE = 10;
const PLAN_IDS = ["free", "starter", "pro", "agency"] as const;
const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  agency: "Agency",
};

// Barra de cuota con semáforo: verde <=70%, ámbar <90%, rojo >=90%.
// El color va inline (y no en clases por porcentaje) porque hay 101 valores
// posibles y una regla CSS por cada uno sería ruido.
function Meter({ label, used, limit }: { label: string; used: number; limit: number | null | undefined }) {
  const p = limit && limit > 0 ? Math.max(0, Math.min(100, Math.round((used / limit) * 100))) : 0;
  const color = p >= 90 ? "#dc2626" : p >= 70 ? "#d97706" : "#16a34a";
  return (
    <div className="acct-meter">
      <div className="acct-meter-head">
        <span>{label}</span>
        <strong>
          {used} / {limit ?? "—"}
        </strong>
      </div>
      <div className="acct-meter-track">
        <div className="acct-meter-fill" style={{ width: `${p}%`, background: color }} />
      </div>
    </div>
  );
}

// Días que faltan para el vencimiento. Negativo = ya venció. El date-only
// "YYYY-MM-DD" se ancla a medianoche UTC para no correrse un día por zona.
function daysLeft(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = new Date(`${iso}T00:00:00Z`).getTime();
  if (isNaN(ms)) return null;
  return Math.ceil((ms - Date.now()) / 86_400_000);
}

// El vencimiento tiene que leerse de un vistazo: cuántos días quedan es la
// información que el dueño busca, no la fecha pelada.
function ExpiryStatus({ iso }: { iso: string | null | undefined }) {
  const d = daysLeft(iso);
  if (d === null) return <span style={{ color: "var(--text-muted)" }}>Sin vencimiento</span>;
  if (d < 0) return <span className="acct-pill" data-level="bad">Vencido hace {-d} días</span>;
  if (d === 0) return <span className="acct-pill" data-level="bad">Vence hoy</span>;
  return (
    <span className="acct-pill" data-level={d <= 7 ? "warn" : "ok"}>
      Vence en {d} {d === 1 ? "día" : "días"}
    </span>
  );
}

// Vencida pero el cron todavía no la bajó: la fila sigue diciendo "Pro" mientras
// el worker ya la trata como Free. `free`/`starter` son perpetuos, así que solo
// tiene sentido para un plan de pago. `downgraded_from` ya cargado = el cron
// corrió, así que no entra en este caso.
function expiredButNotDowngraded(u: AdminUser): boolean {
  const p = u.plan ?? "free";
  if (p === "free" || p === "starter") return false;
  if (u.downgraded_from) return false;
  const d = daysLeft(u.plan_expires_at);
  return d !== null && d < 0;
}

function initials(v: string): string {
  const s = v.trim();
  const parts = s.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

// Acepta los dos formatos: Better Auth entrega createdAt en ms (numero) y las
// cuentas legacy guardan created_at como texto ISO.
function formatDate(iso: string | number | null | undefined): string {
  if (iso === null || iso === undefined || iso === "") return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

function AdminSkeleton() {
  return (
    <div className="panel-card" aria-busy="true" aria-label="Cargando cuentas">
      <div className="faq-skeleton-row" style={{ width: "100%", height: 32, marginBottom: 18 }} />
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="faq-skeleton-row" style={{ height: 44, marginBottom: 10 }} />
      ))}
    </div>
  );
}

export default function AdminView({ planDefaults }: AdminViewProps) {
  const toast = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<AdminUser | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expiryDraft, setExpiryDraft] = useState("");
  const [savingExpiry, setSavingExpiry] = useState(false);
  // Filtros de la tabla. Van al servidor: antes se filtraban aca, lo que obligaba
  // a traer TODOS los clientes (con dos subqueries de agentes cada uno) para
  // descartar los que no tocaban el filtro. D1 factura filas leidas, asi que a
  // 10.000 clientes eso eran ~30.000 filas por visita para pintar 10.
  const [expiryFilter, setExpiryFilter] = useState(false);
  const [planFilter, setPlanFilter] = useState("");
  // `total` y `expiryCount` los devuelve el worker ya filtrados, asi que el
  // paginador y el badge cuentan lo mismo que se ve, sin recalcular en cliente.
  const [total, setTotal] = useState(0);
  const [expiryCount, setExpiryCount] = useState(0);
  // Cuantas cuentas hay de cada plan, para los numeros de las pilloras. Los cuenta
  // el worker sobre la tabla entera, no la pagina: en cliente solo se ve una decena.
  const [planCounts, setPlanCounts] = useState<Record<string, number>>({});
  // Total de cuentas sin importar el plan: es el número de la píldora "Todos".
  const planAll = Object.values(planCounts).reduce((a, b) => a + (Number(b) || 0), 0);
  // Historial: vive en su propio modal (PlanHistoryModal), no en el drawer.
  const [historyFor, setHistoryFor] = useState<AdminUser | null>(null);
  // Renovar cambia el contrato de una cuenta (sumar meses), así que pide
  // confirmación antes: un clic distraído no debería poder hacerlo.
  const [renew, setRenew] = useState<{ u: AdminUser; months: 1 | 3 } | null>(null);
  // Ayuda y Soporte. `openCounts` es lo unico que se carga al entrar (un conteo
  // por cliente, cacheado 30 s); los mensajes de cada uno se piden recien cuando
  // se abre su drawer. `ticketsError` = el worker todavia no tiene el servicio
  // desplegado: los badges quedan en cero y el drawer lo avisa, sin romper la
  // tabla de clientes.
  const [openCounts, setOpenCounts] = useState<Record<string, number>>({});
  const [ticketsError, setTicketsError] = useState(false);
  const [ticketsFor, setTicketsFor] = useState<AdminUser | null>(null);
  const [drawer, setDrawer] = useState<{ id: string; loading: boolean; rows: SupportTicket[] }>({
    id: "",
    loading: false,
    rows: [],
  });

  const loadOpenCounts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/support", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as { open?: { user_id: string; open: number }[] };
      if (!res.ok) throw new Error();
      const counts: Record<string, number> = {};
      for (const row of data.open ?? []) counts[row.user_id] = row.open;
      setOpenCounts(counts);
      setTicketsError(false);
    } catch {
      setTicketsError(true);
    }
  }, []);

  useEffect(() => {
    void loadOpenCounts();
  }, [loadOpenCounts]);

  // Abre el drawer del cliente y pide SOLO sus mensajes.
  const openTickets = useCallback(async (u: AdminUser) => {
    setTicketsFor(u);
    setDrawer({ id: u.id, loading: true, rows: [] });
    try {
      const res = await fetch(`/api/admin/support?user_id=${encodeURIComponent(u.id)}`, { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as { tickets?: SupportTicket[] };
      if (!res.ok) throw new Error();
      setDrawer({ id: u.id, loading: false, rows: data.tickets ?? [] });
    } catch {
      setDrawer({ id: u.id, loading: false, rows: [] });
    }
  }, []);
  // Ayuda y Soporte.
// `openCounts` es lo unico que se carga al entrar: un conteo por cliente, una
// fila por cliente con tickets abiertos. Los mensajes de cada uno se piden recien
// cuando se abre su drawer, con tope, asi que la tabla de Clientes no arrastra
// el historico entero de los clientes (eran hasta 200 filas con el cuerpo de
// 4.000 caracteres en cada visita: lo que mas factura en D1).
// Sin cache a proposito: lo que queda por visita es un conteo indexado por
// cliente, y cachearlo solo agrega una ventana de badge viejo.

  const setTicketStatus = useCallback(
    async (id: string, status: string) => {
      try {
        const res = await fetch("/api/admin/support", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, status }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(data.error || "No se pudo cambiar el estado");
        // El contador se ajusta en local en vez de volver a pedirlo: el PATCH ya
        // nos dijo el estado nuevo y ya sabemos de quien es el ticket. Asi el
        // cambio de estado no cuesta ninguna lectura extra, y tampoco puede
        // devolver un conteo viejo (una lectura apenas despues de escribir puede
        // pegarle a una replica atrasada y dejar todos los badges en cero).
        const prev = drawer.rows.find((t) => t.id === id);
        const uid = prev?.user_id;
        if (uid && prev.status !== status) {
          const wasOpen = prev.status !== "resuelto";
          const isOpen = status !== "resuelto";
          setOpenCounts((cur) => {
            const n = cur[uid] ?? 0;
            if (wasOpen === isOpen) return cur;
            return { ...cur, [uid]: Math.max(0, n + (isOpen ? 1 : -1)) };
          });
        }
        setDrawer((d) => ({ ...d, rows: d.rows.map((t) => (t.id === id ? { ...t, status } : t)) }));
        toast.success(status === "resuelto" ? "Mensaje marcado como resuelto" : "Estado actualizado");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error de red");
      }
    },
    [toast, drawer.rows]
  );

  const openDetail = useCallback((u: AdminUser) => {
    setDetail(u);
    setExpiryDraft(u.plan_expires_at ?? "");
  }, []);

  // Cierra con Escape: el overlay y la X ya cubren click afuera.
  useEffect(() => {
    if (!detail) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDetail(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detail]);

  useEffect(() => {
    if (!ticketsFor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTicketsFor(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ticketsFor]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
      if (planFilter) params.set("plan", planFilter);
      if (expiryFilter) params.set("expiring", "1");
      // Los conteos por plan van SIEMPRE sin el filtro de plan: si no, al elegir
      // "Free" las otras pilloras caeran a cero y el filtro parecera roto.
      params.set("counts", "1");
      const res = await fetch(`/api/admin/users?${params}`, { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as {
        users?: AdminUser[];
        total?: number;
        expiryCount?: number;
        planCounts?: Record<string, number>;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "No se pudo cargar la lista de clientes");
      const list = data.users ?? [];
      const serverTotal = data.total ?? list.length;
      setUsers(list);
      setTotal(serverTotal);
      // Si la página actual se quedó sin resultados (borraron cuentas desde otra
      // sesión, sin cambiar filtros), el servidor devuelve vacío y la tabla se
      // queda en blanco aunque el paginador marque "página 3". Se vuelve a la 1.
      const lastPage = Math.max(1, Math.ceil(serverTotal / PAGE_SIZE));
      if (serverTotal > 0 && page > lastPage) {
        setPage(lastPage);
        return;
      }
      if (serverTotal === 0) setPage(1);
      setExpiryCount(data.expiryCount ?? 0);
      setPlanCounts(data.planCounts ?? {});
      // Solo la pagina visible necesita borrador: si `drafts` guardara todos los
      // clientes habria que traerlos todos para poder editar cualquiera.
      setDrafts((prev) => {
        const next = { ...prev };
        for (const u of list) next[u.id] = u.plan ?? "free";
        return next;
      });
      setLoadError(null);
    } catch (e) {
      // Sin esto, una consulta fallida deja users=[] y la vista muestra
      // "Todavía no hay cuentas registradas", que es una mentira: el error
      // real (columna faltante, sesión vencida, worker caído) se perdía en un
      // toast que desaparece a los 3 segundos.
      setLoadError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setLoading(false);
    }
  }, [page, planFilter, expiryFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (u: AdminUser) => {
      const plan = drafts[u.id];
      if (!plan || plan === (u.plan ?? "free")) return;
      setSaving(u.id);
      try {
        const res = await fetch("/api/user", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: u.id, plan }),
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo guardar el plan");
        toast.success(`Plan de ${u.email ?? u.name} actualizado a ${PLAN_LABELS[plan] ?? plan}`);
        void load();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error de red al guardar");
      } finally {
        setSaving(null);
      }
    },
    [drafts, load, toast]
  );

  // Un solo camino de guardado para las dos formas de tocar la fecha. El
  // worker devuelve la vigencia resultante (la renovación la calcula él), así
  // que acá no se repite la aritmética de meses ni se adivina el resultado.
  const putExpiry = useCallback(
    async (body: Record<string, unknown>) => {
      if (!detail) return;
      setSavingExpiry(true);
      try {
        const res = await fetch("/api/user", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: detail.id, ...body }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          plan_expires_at?: string | null;
        };
        if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo guardar");
        const next = data.plan_expires_at ?? null;
        setDetail((d) => (d ? { ...d, plan_expires_at: next } : d));
        setExpiryDraft(next ?? "");
        toast.success(next ? `Vence el ${formatDate(next)}` : "Vencimiento quitado");
        void load();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error de red al guardar");
      } finally {
        setSavingExpiry(false);
      }
    },
    [detail, load, toast]
  );

  // Los dos filtros se combinan (AND), no se pisan: "Pro" + "vence esta semana"
  // es una pregunta real ("¿qué clientes pro se me vencen esta semana?"), y por
  // eso se mandan juntos al worker en vez de ser un switch.
  //
  // Lo que se pinta ES la pagina que pidio el servidor: `users` ya viene
  // filtrada y paginada, asi que no hay ni `filter` ni `slice` aca. Antes habia
  // un O(n) en cliente por cada render y, sobre todo, habia que traer todas las
  // cuentas para poder hacerlos.
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageNumber = Math.min(page, totalPages);
  const rows = users;
  const projected =
    totalPages > 5
      ? [1, ...(pageNumber > 3 ? [0] : []), ...pageNumbers(pageNumber, totalPages), ...(pageNumber < totalPages - 2 ? [0] : []), totalPages]
      : Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <section className="view-section active" id="view-admin">
      <div className="agents-header">
        <div className="agents-heading">
          <h2>Clientes</h2>
          <p className="subtitle" style={{ marginBottom: 0 }}>
            Cambiá el plan de cualquier cuenta. Los cupos de agentes y mensajes se ajustan
            automáticamente al plan nuevo.
          </p>
        </div>
        <div className="admin-toolbar">
          <button
            className="btn-ghost"
            type="button"
            onClick={() => {
              setExpiryFilter((f) => !f);
              setPage(1);
            }}
            aria-pressed={expiryFilter}
          >
            {expiryFilter ? "Ver todas" : "Vence esta semana"}
            {expiryCount > 0 ? <span className="admin-filter-count">{expiryCount}</span> : null}
          </button>
          <button className="btn-ghost" type="button" onClick={() => void load()} disabled={loading}>
            {loading ? "Cargando…" : "Actualizar"}
          </button>
        </div>
      </div>

      {/* Mismas clases que la fila de estados de Prospectos (.leads-status-filter
          + .lead-filter-pill): reusadas tal cual en vez de inventar un segundo
          juego de píldoros con otro color y otro radio. */}
      <div className="leads-status-filter" role="tablist" aria-label="Filtrar por plan">
        {["", ...PLAN_IDS].map((p) => {
          // Contar por plan va sobre `users` y no sobre `byPlan`: si no, al
          // elegir "Free" los otros contadores caerían a cero y el filtro
          // parecería roto en vez de mostrar el cruce.
          //
          // Con la lista pagada, `users` es solo la pagina actual, asi que contar
          // aca daría "3" en vez de "2400" y el filtro prometeria una cuenta que
          // no aparece. El total real de cada plan lo cuenta el worker.
          // La píldora "Todos" no tiene plan, así que su número no está en
          // `planCounts`: es la suma de todos los planes (cuentas sin fila en
          // `users` ya entran como "free"). Buscar `planCounts[""]` devolvía
          // undefined y pintaba 0 siempre. `total` es el fallback mientras
          // llegan los conteos, para no mostrar 0 en la primera carga.
          const n = p ? planCounts[p] ?? 0 : planAll || total;
          return (
            <button
              key={p || "all"}
              type="button"
              role="tab"
              aria-selected={planFilter === p}
              className={`lead-filter-pill${planFilter === p ? " is-active" : ""}`}
              onClick={() => {
                setPlanFilter(p);
                setPage(1);
              }}
            >
              {p ? PLAN_LABELS[p] : "Todos"}
              <span className="lead-filter-pill-n">{n}</span>
            </button>
          );
        })}
      </div>

      {loading && users.length === 0 ? (
        <AdminSkeleton />
      ) : loadError ? (
        <div className="panel-card">
          <p className="acct-hint" style={{ marginTop: 0 }}>
            No se pudo cargar la lista de clientes.
          </p>
          <p className="acct-error-detail">{loadError}</p>
          <button className="btn-primary" type="button" onClick={() => void load()}>
            Reintentar
          </button>
        </div>
      ) : total === 0 ? (
        <div className="panel-card">
          {/* El mensaje cambia según POR QUÉ no hay filas: con un filtro activo
              decir "todavía no hay cuentas registradas" es mentira (hay, pero
              escondidas detrás del filtro) y deja al dueño pensando que se
              perdió la base. */}
          <p className="subtitle">
            {planFilter || expiryFilter
              ? "Ninguna cuenta coincide con el filtro."
              : "Todavía no hay cuentas registradas."}
          </p>
          {planFilter || expiryFilter ? (
            <button
              className="btn-ghost"
              type="button"
              onClick={() => {
                setPlanFilter("");
                setExpiryFilter(false);
                setPage(1);
              }}
            >
              Quitar filtros
            </button>
          ) : null}
        </div>
      ) : (
        <div className={`panel-card${loading && users.length > 0 ? " is-refreshing" : ""}`}>
          {/* Igual que Prospectos: con filas visibles, recargar una página o
              cambiar un filtro atenúa la tabla en vez de vaciarla. Antes solo se
              veía el esqueleto en la primera carga, así que al cambiar de página
              las filas cambiaban de golpe sin señal de que venían del servidor. */}
          {/* Sin .leads-table-wrap: trae overflow:auto (que recortaría el desplegable
              del plan) y border-radius (que el header cuadrado del spoilearía).
              El marco lo pone el .panel-card de arriba. */}
          <div>
            <table className="leads-table admin-table">
              <thead>
                <tr>
                  <th>Cuenta</th>
                  <th>Rol</th>
                  <th>Agentes</th>
                  <th>Mensajes</th>
                  <th>Plan</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => {
                  const dirty = drafts[u.id] !== (u.plan ?? "free");
                  const plan = drafts[u.id] ?? "free";
                  const pending = openCounts[u.id] ?? 0;
                  return (
                    <tr
                      key={u.id}
                      style={{ cursor: "pointer" }}
                      onClick={(e) => {
                        const t = e.target as HTMLElement;
                        if (t.closest("button, a, input, select")) return;
                        openDetail(u);
                      }}
                    >
                      <td>
                        <strong>{u.email || u.name || "—"}</strong>
                        {u.name && u.name !== u.email ? (
                          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{u.name}</div>
                        ) : null}
                      </td>
                      <td data-label="Rol">
                        {u.role === "admin" ? (
                          "Administrador"
                        ) : u.role === "sin login" ? (
                          <span className="leads-pager-ellipsis" style={{ color: "var(--text-muted)" }}>
                            sin login
                          </span>
                        ) : (
                          "Cliente"
                        )}
                      </td>
                      <td data-label="Agentes">
                        {u.agents} / {u.agent_limit ?? planDefaults[u.plan ?? "free"]?.agents ?? "—"}
                      </td>
                      <td data-label="Mensajes">
                        {u.messages_used} / {u.messages_limit ?? planDefaults[u.plan ?? "free"]?.messages ?? "—"}
                      </td>
                      <td data-label="Plan">
                        <Dropdown
                          value={plan}
                          options={PLAN_IDS.map((p) => ({ id: p, name: PLAN_LABELS[p] }))}
                          onChange={(v) => setDrafts((d) => ({ ...d, [u.id]: v }))}
                        />
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button
                          className="sup-icon-btn"
                          type="button"
                          title="Mensajes de soporte"
                          aria-label={
                            pending > 0
                              ? `Mensajes de soporte de ${u.email ?? u.name ?? u.id}: ${pending} sin resolver`
                              : `Mensajes de soporte de ${u.email ?? u.name ?? u.id}`
                          }
                          onClick={() => void openTickets(u)}
                          style={{ marginRight: 8 }}
                        >
                          <IconMessage />
                          {pending > 0 && <span className="sup-badge">{pending}</span>}
                        </button>
                        <button
                          className="btn-ghost"
                          type="button"
                          title="Ver detalle de la cuenta"
                          aria-label={`Ver detalle de ${u.email ?? u.name ?? u.id}`}
                          onClick={() => openDetail(u)}
                          style={{ marginRight: 8 }}
                        >
                          Detalle
                        </button>
                        <button
                          className="btn-primary"
                          type="button"
                          disabled={!dirty || saving === u.id}
                          onClick={() => void save(u)}
                        >
                          {saving === u.id ? "Guardando…" : "Guardar"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {total > PAGE_SIZE && (
            <div className="leads-footer">
              <span className="leads-pager-info">
                Mostrando <strong>{(pageNumber - 1) * PAGE_SIZE + 1}</strong>–
                <strong>{Math.min(pageNumber * PAGE_SIZE, total)}</strong> de <strong>{total}</strong> cuenta
                {total === 1 ? "" : "s"}
              </span>
              <div className="leads-pager">
                <button
                  type="button"
                  className="leads-pager-btn"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={pageNumber <= 1}
                >
                  Anterior
                </button>
                {projected.map((p, i) =>
                  p === 0 ? (
                    <span key={`e${i}`} className="leads-pager-ellipsis">
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      className={`leads-pager-num${p === pageNumber ? " is-active" : ""}`}
                      onClick={() => setPage(p)}
                      aria-label={`Ir a página ${p}`}
                    >
                      {p}
                    </button>
                  )
                )}
                <button
                  type="button"
                  className="leads-pager-btn"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={pageNumber >= totalPages}
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Portal a document.body: el .panel-card se anima con transform
          (aow-fade-up, fill-mode both), y eso lo vuelve containing block de
          position:fixed — sin portal el drawer scrollea con la tabla. Mismo
          motivo por el que la barra de lote de Prospectos va portalizada. */}
      {detail &&
        createPortal(
          <div className="lead-drawer-overlay" onClick={() => setDetail(null)}>
            <aside
              className="lead-drawer"
              role="dialog"
              aria-modal="true"
              aria-label={`Detalle de ${detail.email ?? detail.name ?? detail.id}`}
              onClick={(e) => e.stopPropagation()}
            >
              <header className="lead-drawer-header">
                <div className="lead-drawer-avatar">{initials(detail.name || detail.email || "?")}</div>
                <div className="lead-drawer-title">
                  <h2>{detail.name || detail.email || "Cuenta"}</h2>
                  <span title={detail.email ?? undefined}>{detail.email || "sin email de login"}</span>
                </div>
                <button className="lead-drawer-close" type="button" onClick={() => setDetail(null)} aria-label="Cerrar">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </header>

              <div className="lead-drawer-body">
                <section className="lead-drawer-sec">
                  <h3>Cuenta</h3>
                  <div className="lead-drawer-row">
                    <span>Rol</span>
                    <strong>
                      {detail.role === "admin" ? "Administrador" : detail.role === "sin login" ? "Nunca inició sesión" : "Cliente"}
                    </strong>
                  </div>
                  <div className="lead-drawer-row">
                    <span>Alta</span>
                    <strong>{formatDate(detail.created)}</strong>
                  </div>
                  <div className="lead-drawer-row">
                    <span>ID</span>
                    <strong className="acct-mono" title={detail.id}>
                      {detail.id.slice(0, 18)}…
                    </strong>
                  </div>
                  <div className="lead-drawer-row">
                    <span>Alertas</span>
                    <strong>
                      {/* undefined = el worker todavía no manda este dato (no
                          desplegado): se muestra "—" en vez de mentir con un
                          "ninguna configurada" que no sabemos. */}
                      {detail.has_telegram === undefined && detail.has_webhook === undefined ? (
                        <span style={{ color: "var(--text-muted)" }}>—</span>
                      ) : detail.has_telegram || detail.has_webhook ? (
                        [detail.has_telegram ? "Telegram" : null, detail.has_webhook ? "Webhook" : null]
                          .filter(Boolean)
                          .join(" + ")
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>ninguna configurada</span>
                      )}
                    </strong>
                  </div>
                </section>

                <section className="lead-drawer-sec">
                  <h3>Plan y cuotas</h3>
                  <div className="lead-drawer-row">
                    <span>Plan</span>
                    <strong>{PLAN_LABELS[detail.plan ?? "free"] ?? detail.plan}</strong>
                  </div>

                  {/* El worker corta al instante cuando la fecha ya pasó, pero la
                      fila del plan todavía dice "Pro" hasta que pasa el cron (hasta
                      24h). Mostrar 25000 mensajes ahí haría que el dueño le prometa
                      al cliente algo que el sistema ya no le da. */}
                  {expiredButNotDowngraded(detail) ? (
                    <p className="acct-downgrade-note">
                      <strong>Ya venció</strong>, pero el plan todavía figura como{" "}
                      {PLAN_LABELS[detail.plan ?? "free"] ?? detail.plan} hasta que corra el proceso
                      diario. <strong>Desde ya está limitado como el plan gratuito</strong> y el
                      cliente ya está viendo el aviso de renovación.
                    </p>
                  ) : null}

                  <Meter
                    label="Agentes"
                    used={detail.agents}
                    limit={detail.agent_limit ?? planDefaults[detail.plan ?? "free"]?.agents}
                  />
                  <Meter
                    label="Mensajes del mes"
                    used={detail.messages_used}
                    limit={detail.messages_limit ?? planDefaults[detail.plan ?? "free"]?.messages}
                  />
                </section>

                <section className="lead-drawer-sec">
                  <h3>Vencimiento del plan</h3>
                  <div className="acct-expiry-status">
                    <ExpiryStatus iso={detail.plan_expires_at} />
                  </div>
                  <div className="acct-renew">
                    <button
                      className="btn-primary"
                      type="button"
                      disabled={savingExpiry}
                      onClick={() => setRenew({ u: detail, months: 1 })}
                    >
                      Renovar +1 mes
                    </button>
                    <button
                      className="btn-ghost"
                      type="button"
                      disabled={savingExpiry}
                      onClick={() => setRenew({ u: detail, months: 3 })}
                    >
                      +3 meses
                    </button>
                  </div>
                  <div className="acct-expiry">
                    <input
                      type="date"
                      className="form-input"
                      value={expiryDraft}
                      onChange={(e) => setExpiryDraft(e.target.value)}
                      aria-label="Fecha de vencimiento exacta"
                    />
                    <button
                      className="btn-ghost"
                      type="button"
                      disabled={savingExpiry || (detail.plan_expires_at ?? "") === expiryDraft}
                      onClick={() => void putExpiry({ plan_expires_at: expiryDraft || null })}
                    >
                      Fijar fecha
                    </button>
                  </div>
                  <p className="acct-hint">
                    El vencimiento corre solo: se puso un mes al crear la cuenta y cada vez que cambia el
                    plan. Cuando el cliente paga, tocá <strong>Renovar</strong> y listo — la fecha la
                    calcula el sistema, no hace falta que la cuentes. Solo usá la fecha exacta para un
                    caso raro (una promoción que termina el 15, por ejemplo).
                  </p>
                  {detail.downgraded_from ? (
                    <p className="acct-downgrade-note">
                      Esta cuenta cayó sola a <strong>Free</strong>: su plan{" "}
                      <strong>{PLAN_LABELS[detail.downgraded_from] ?? detail.downgraded_from}</strong> venció y no se renovó.
                      Sus agentes siguen funcionando con los límites del plan gratuito. Cuando vuelva a
                      pagar, <strong>Renovar</strong> le devuelve el plan que tenía.
                    </p>
                  ) : null}
                </section>

                <section className="lead-drawer-sec">
                  <div className="lead-drawer-row">
                    <span>Historial</span>
                    <button
                      className="btn-ghost"
                      type="button"
                      onClick={() => {
                        // Un modal por vez: el drawer se cierra y recién ahi abre
                        // el historial, para no apilar dos overlays de fondo
                        // oscuro (que ademas se escalan en opacidad).
                        setHistoryFor(detail);
                        setDetail(null);
                      }}
                    >
                      Ver historial
                    </button>
                  </div>
                </section>

                <section className="lead-drawer-sec">
                  <h3>Agentes ({detail.agents})</h3>
                  {detail.agent_names ? (
                    <ul className="acct-list">
                      {detail.agent_names.split("|").map((n) => (
                        <li key={n}>{n.trim()}</li>
                      ))}
                    </ul>
                  ) : detail.agents > 0 ? (
                    /* El conteo y el listado vienen del mismo paquete del worker,
                       pero nunca se afirma "no tiene agentes" si el conteo dice
                       que hay: si faltan los nombres, se dice lo que sí sabemos. */
                    <p className="acct-hint">
                      {detail.agents} {detail.agents === 1 ? "agente" : "agentes"} (sin nombres disponibles)
                    </p>
                  ) : (
                    <p className="acct-hint">Esta cuenta todavía no tiene agentes.</p>
                  )}
                </section>
              </div>
            </aside>
          </div>,
          document.body
        )}

      {ticketsFor &&
        createPortal(
          <div className="lead-drawer-overlay" onClick={() => setTicketsFor(null)}>
            <aside
              className="lead-drawer"
              role="dialog"
              aria-modal="true"
              aria-label={`Mensajes de soporte de ${ticketsFor.email ?? ticketsFor.name ?? ticketsFor.id}`}
              onClick={(e) => e.stopPropagation()}
            >
              <header className="lead-drawer-header">
                <div className="lead-drawer-avatar">
                  <IconMessage />
                </div>
                <div className="lead-drawer-title">
                  <h2>Soporte</h2>
                  <span title={ticketsFor.email ?? undefined}>
                    {ticketsFor.email || ticketsFor.name || "sin email de login"}
                  </span>
                </div>
                <button
                  className="lead-drawer-close"
                  type="button"
                  onClick={() => setTicketsFor(null)}
                  aria-label="Cerrar"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </header>

              <div className="lead-drawer-body">
                {ticketsError ? (
                  <p className="acct-hint">
                    El servicio de soporte todavía no está desplegado en el servidor.
                  </p>
                ) : drawer.loading ? (
                  <div className="faq-skeleton" aria-busy="true" aria-label="Cargando mensajes">
                    <div className="faq-skeleton-row" style={{ height: 64 }} />
                    <div className="faq-skeleton-row" style={{ height: 64 }} />
                  </div>
                ) : drawer.rows.length === 0 ? (
                  <p className="acct-hint">Esta cuenta no escribió por soporte.</p>
                ) : (
                  drawer.rows.map((t) => (
                    <section className="sup-ticket" key={t.id}>
                      <div className="sup-ticket-head">
                        <span className="sup-cat-chip">{CATEGORY_LABELS[t.category] ?? t.category}</span>
                        <span className={`sup-status is-${t.status}`}>{STATUS_LABELS[t.status] ?? t.status}</span>
                      </div>
                      <h3>{t.subject}</h3>
                      <p className="sup-ticket-meta">
                        {formatDate(t.created_at)}
                        {t.user_plan ? ` · Plan ${PLAN_LABELS[t.user_plan] ?? t.user_plan}` : ""}
                        {t.page ? ` · ${t.page}` : ""}
                      </p>
                      <p className="sup-ticket-text">{t.message}</p>
                      <div className="sup-ticket-actions">
                        {/* El mismo dropdown del selector de Plan de la tabla de
                            clientes: `select` nativo se ve como un select
                            nativo, y este control ya existe. */}
                        <div className="sup-status-select">
                          <Dropdown
                            value={t.status}
                            options={Object.entries(STATUS_LABELS).map(([v, l]) => ({ id: v, name: l }))}
                            onChange={(v) => void setTicketStatus(t.id, v)}
                          />
                        </div>
                        {t.user_email ? (
                          // Responder es manual: el panel solo abre el correo del
                          // cliente con el asunto y su mensaje ya escritos, para
                          // no tener que copy/pegar nada.
                          <a
                            className="sup-reply"
                            href={`mailto:${t.user_email}?subject=${encodeURIComponent(
                              `Re: ${t.subject}`
                            )}&body=${encodeURIComponent(
                              `${t.message}\n\n—\nEscrito desde el panel el ${formatDate(t.created_at)}`
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            title={`Responder a ${t.user_email}`}
                            aria-label={`Responder a ${t.user_email}`}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="2" y="4" width="20" height="16" rx="2" />
                              <path d="m22 7-10 6L2 7" />
                            </svg>
                            Responder
                          </a>
                        ) : null}
                      </div>
                    </section>
                  ))
                )}
              </div>
            </aside>
          </div>,
          document.body
        )}

      <PlanHistoryModal
        open={Boolean(historyFor)}
        account={historyFor}
        onClose={() => setHistoryFor(null)}
      />

      {renew ? (
        <ConfirmModal
          open
          title={`Renovar ${renew.months === 1 ? "1 mes" : "3 meses"}`}
          description={
            <>
              Se {renew.months === 1 ? "suma 1 mes" : "suman 3 meses"} al vencimiento actual
              {renew.u.plan_expires_at ? (
                <>
                  {" "}
                  (<strong>{formatDate(renew.u.plan_expires_at)}</strong>)
                </>
              ) : null}
              . La fecha nueva la calcula el sistema.
              {renew.u.downgraded_from ? (
                <>
                  {" "}
                  Esta cuenta había caído a Free, así que además se le devuelve su plan{" "}
                  <strong>{PLAN_LABELS[renew.u.downgraded_from] ?? renew.u.downgraded_from}</strong>.
                </>
              ) : null}
            </>
          }
          confirmLabel={savingExpiry ? "Renovando…" : "Renovar"}
          loadingText="Renovando…"
          tone="neutral"
          icon={
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="17" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
              <path d="M12 14v4M10 16h4" />
            </svg>
          }
          onClose={() => setRenew(null)}
          onConfirm={async () => {
            await putExpiry({ renew_months: renew.months });
            setRenew(null);
          }}
        />
      ) : null}
    </section>
  );
}
