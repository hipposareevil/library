import api from "./client";
import type { User, SystemStatus } from "../types/user";

export async function fetchSystemStatus(): Promise<SystemStatus> {
  const { data } = await api.get("/admin/status");
  return data;
}

export async function fetchUsers(): Promise<User[]> {
  const { data } = await api.get("/admin/users");
  return data;
}

export async function createUser(
  username: string,
  password: string
): Promise<User> {
  const { data } = await api.post("/admin/users", { username, password });
  return data;
}

export async function changePassword(
  userId: number,
  password: string
): Promise<void> {
  await api.put(`/admin/users/${userId}/password`, { password });
}

export async function deleteUser(userId: number): Promise<void> {
  await api.delete(`/admin/users/${userId}`);
}
