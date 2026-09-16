"use client";

import { useEffect, useState, type ReactNode } from "react";
import LoginView from "./LoginView";

export default function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"loading" | "ok" | "no">("loading");

  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then((d: { ok?: boolean }) => setState(d.ok ? "ok" : "no"))
      .catch(() => setState("no"));
  }, []);

  if (state === "loading") return null;
  if (state === "no") return <LoginView />;
  return <>{children}</>;
}