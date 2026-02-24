import api from "./client";
import type { TagWithCount } from "../types/book";

export async function fetchTags(): Promise<TagWithCount[]> {
  const { data } = await api.get("/tags");
  return data;
}
