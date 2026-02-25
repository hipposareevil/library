import api from "./client";
import type { BookDetail, BookSearchParams, PaginatedBooks } from "../types/book";

export async function fetchBooks(params: BookSearchParams): Promise<PaginatedBooks> {
  const { data } = await api.get("/books", { params });
  return data;
}

export async function fetchBook(id: number): Promise<BookDetail> {
  const { data } = await api.get(`/books/${id}`);
  return data;
}

export async function fetchBookOverview(id: number): Promise<Record<string, unknown>> {
  const { data } = await api.get(`/books/${id}/overview`);
  return data;
}

export function getCoverUrl(bookId: number): string {
  return `/api/covers/${bookId}`;
}

export function getDownloadUrl(bookId: number): string {
  return `/api/admin/books/${bookId}/download`;
}

export async function createBook(bookData: Record<string, unknown>): Promise<BookDetail> {
  const { data } = await api.post("/admin/books", bookData);
  return data;
}

export async function updateBook(
  id: number,
  bookData: Record<string, unknown>
): Promise<BookDetail> {
  const { data } = await api.put(`/admin/books/${id}`, bookData);
  return data;
}

export async function deleteBook(id: number): Promise<void> {
  await api.delete(`/admin/books/${id}`);
}

export async function uploadEpub(bookId: number, file: File): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);
  await api.post(`/admin/books/${bookId}/upload-epub`, formData);
}

export async function extractEpubMetadata(
  file: File
): Promise<Record<string, unknown>> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post("/admin/books/extract-epub", formData);
  return data;
}

export async function uploadCoverFile(bookId: number, blob: Blob): Promise<void> {
  const formData = new FormData();
  formData.append("file", blob, "cover.jpg");
  await api.post(`/admin/books/${bookId}/cover`, formData);
}

export async function uploadCoverUrl(bookId: number, url: string): Promise<void> {
  const formData = new FormData();
  formData.append("cover_url", url);
  await api.post(`/admin/books/${bookId}/cover`, formData);
}
