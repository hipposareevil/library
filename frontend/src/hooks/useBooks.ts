import { useQuery } from "@tanstack/react-query";
import { fetchBooks, fetchBook, fetchBookOverview } from "../api/books";
import type { BookSearchParams } from "../types/book";

export function useBooks(params: BookSearchParams) {
  return useQuery({
    queryKey: ["books", params],
    queryFn: () => fetchBooks(params),
    placeholderData: (prev) => prev,
  });
}

export function useBook(id: number) {
  return useQuery({
    queryKey: ["book", id],
    queryFn: () => fetchBook(id),
    enabled: id > 0,
  });
}

export function useBookOverview(id: number, isbn: string | null) {
  return useQuery({
    queryKey: ["book-overview", id],
    queryFn: () => fetchBookOverview(id),
    enabled: id > 0 && !!isbn,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
  });
}
