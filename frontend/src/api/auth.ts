import api from "./client";
import type { LoginRequest, TokenResponse } from "../types/auth";

export async function login(credentials: LoginRequest): Promise<TokenResponse> {
  const { data } = await api.post("/auth/login", credentials);
  return data;
}
