"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { sileo, type SileoButton } from "sileo";

// Wrapper sobre sileo: la API de useToast() no cambia (los ~55 call sites
// siguen igual) y el render lo hace la librería. Se agrega `warning` y
// `promise`, que antes no existían.

type ToastType = "success" | "error" | "info" | "warning";

interface ToastApi {
  success: (msg: string, description?: string) => void;
  error: (msg: string, description?: string) => void;
  info: (msg: string, description?: string) => void;
  warning: (msg: string, description?: string) => void;
  action: (msg: string, button: SileoButton) => void;
  promise: typeof sileo.promise;
}

const ToastContext = createContext<ToastApi | null>(null);

const DURATIONS: Record<ToastType, number> = { success: 3000, error: 5000, info: 3500, warning: 4500 };

export function ToastProvider({ children }: { children: ReactNode }) {
  const show = useCallback((message: string, type: ToastType, description?: string) => {
    sileo[type]({ title: message, ...(description ? { description } : {}), duration: DURATIONS[type] });
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (m, d) => show(m, "success", d),
      error: (m, d) => show(m, "error", d),
      info: (m, d) => show(m, "info", d),
      warning: (m, d) => show(m, "warning", d),
      action: (m, button) => sileo.action({ title: m, button, duration: 8000 }),
      promise: sileo.promise,
    }),
    [show]
  );

  return <ToastContext.Provider value={api}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return ctx;
}
