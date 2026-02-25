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

export async function exportData(
  include_covers = false,
  include_epubs = false
): Promise<void> {
  const params = new URLSearchParams();
  if (include_covers) params.set("include_covers", "true");
  if (include_epubs) params.set("include_epubs", "true");

  const response = await api.get(
    `/admin/export?${params.toString()}`,
    { responseType: "blob" }
  );

  const url = URL.createObjectURL(
    new Blob([response.data], { type: "application/zip" })
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "library-export.zip";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importData(
  file: File
): Promise<{ imported: number; total: number }> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post("/admin/import", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}
