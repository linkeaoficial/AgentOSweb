"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export default function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"loading" | "ok" | "no">("loading");
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/get-session", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { session?: { id: string } } | null) => {
        if (cancelled) return;
        setState(d?.session?.id ? "ok" : "no");
      })
      .catch(() => {
        if (!cancelled) setState("no");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "loading") return null;
  if (state === "no") {
    router.replace("/login");
    return null;
  }
  return <>{children}</>;
}