import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  role: "admin" | "manager" | "employee";
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function getResolvedRole(email: string | undefined, metadataRole: string | undefined): "admin" | "manager" | "employee" {
  const normalizedEmail = email?.toLowerCase().trim();
  if (normalizedEmail === "ojedaangely@gmail.com") return "admin";
  
  if (typeof window !== "undefined") {
    const overrides = localStorage.getItem("borrego_role_overrides");
    if (overrides) {
      try {
        const parsed = JSON.parse(overrides);
        if (parsed[normalizedEmail || ""]) {
          const over = parsed[normalizedEmail || ""];
          if (over === "admin" || over === "manager" || over === "employee") {
            return over;
          }
        }
      } catch (e) {}
    }
  }
  
  const role = metadataRole || (normalizedEmail?.includes("admin") ? "admin" : normalizedEmail?.includes("manager") ? "manager" : "employee");
  return (role === "admin" || role === "manager" || role === "employee" ? role : "employee") as "admin" | "manager" | "employee";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const email = session?.user?.email;
  const metadataRole = session?.user?.user_metadata?.role;
  const resolvedRole = getResolvedRole(email, metadataRole);

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    loading,
    role: resolvedRole,
    signOut: async () => { await supabase.auth.signOut(); },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}