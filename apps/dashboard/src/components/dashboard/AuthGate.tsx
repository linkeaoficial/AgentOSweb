"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

type State = "loading" | "ok" | "no";

export default function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>("loading");
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await fetch("/api/auth/get-session", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { session?: { id: string } } | null) => d?.session?.id)
        .catch(() => null);
      if (cancelled) return;
      setState(session ? "ok" : "no");
    })();
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
