"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface UserSession {
  email: string;
  name: string;
  tier: "FREE" | "PRO" | "TEAM" | "ENTERPRISE";
  isSubscribed: boolean;
  trialDaysLeft?: number;
}

interface AuthContextType {
  user: UserSession | null;
  login: (email: string, tier?: "FREE" | "PRO" | "TEAM") => void;
  logout: () => void;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("buildworth_user_session");
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch {
        // ignore
      }
    }
  }, []);

  const login = (email: string, tier: "FREE" | "PRO" | "TEAM" = "PRO") => {
    const session: UserSession = {
      email,
      name: email.split("@")[0] || "Founder",
      tier,
      isSubscribed: tier !== "FREE",
      trialDaysLeft: 14,
    };
    setUser(session);
    localStorage.setItem("buildworth_user_session", JSON.stringify(session));
    setIsAuthModalOpen(false);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("buildworth_user_session");
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
