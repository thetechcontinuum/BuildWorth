"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface UserSession {
  id?: string;
  email: string;
  name: string;
  tier: "FREE" | "PRO" | "TEAM" | "ENTERPRISE";
  isSubscribed: boolean;
  trialDaysLeft?: number;
}

interface AuthContextType {
  user: UserSession | null;
  login: (user: UserSession) => void;
  logout: () => Promise<void>;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const refreshSession = async () => {
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data && data.user) {
          setUser({
            id: data.user.id,
            email: data.user.email,
            name: data.user.name || data.user.email.split("@")[0],
            tier: data.user.tier || "FREE",
            isSubscribed: data.user.tier !== "FREE",
            trialDaysLeft: 14,
          });
          return;
        }
      }
      setUser(null);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    refreshSession();
  }, []);

  const login = (userData: UserSession) => {
    setUser(userData);
    setIsAuthModalOpen(false);
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAuthModalOpen,
        openAuthModal: () => setIsAuthModalOpen(true),
        closeAuthModal: () => setIsAuthModalOpen(false),
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
