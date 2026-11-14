"use client";

import { createContext, useContext, useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { usePathname } from "next/navigation";
import { ApiError } from "@/lib/api";
import { accountRequest, type User } from "@/lib/accounts";

interface Session {
  user: User | null;
  loading: boolean;
  error: string;
  setUser: Dispatch<SetStateAction<User | null>>;
  reload: () => void;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    accountRequest<User>("auth/me")
      .then((current) => { if (active) setUser(current); })
      .catch((cause) => {
        if (!active) return;
        if (cause instanceof ApiError && cause.status === 401) setUser(null);
        else setError(cause instanceof Error ? cause.message : "Gagal memuat akun. Coba lagi.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [pathname, attempt]);

  return <SessionContext.Provider value={{ user, loading, error, setUser, reload: () => setAttempt((n) => n + 1) }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession requires SessionProvider");
  return session;
}
