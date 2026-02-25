import { createContext, useContext, useState, type ReactNode } from "react";
import { login as apiLogin } from "../api/auth";
import type { LoginRequest } from "../types/auth";

function parseTokenUsername(token: string | null): string | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.sub || null;
  } catch {
    return null;
  }
}

interface AuthContextType {
  isAuthenticated: boolean;
  username: string | null;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  username: null,
  login: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => !!localStorage.getItem("token")
  );
  const [username, setUsername] = useState<string | null>(
    () => parseTokenUsername(localStorage.getItem("token"))
  );

  const login = async (credentials: LoginRequest) => {
    const response = await apiLogin(credentials);
    localStorage.setItem("token", response.access_token);
    setUsername(parseTokenUsername(response.access_token));
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUsername(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, username, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
