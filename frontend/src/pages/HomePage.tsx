import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import Header from "../components/layout/Header";
import SearchBar from "../components/layout/SearchBar";
import ViewToggle from "../components/layout/ViewToggle";
import BookGrid from "../components/books/BookGrid";
import BookList from "../components/books/BookList";
import BookMasonry from "../components/books/BookMasonry";
import BookTable from "../components/books/BookTable";
import { useBooks } from "../hooks/useBooks";
import { useTags } from "../hooks/useTags";
import type { BookListItem, BookSearchParams, ViewMode } from "../types/book";

export default function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const authorParam = searchParams.get("author") || undefined;

  const [view, setView] = useState<ViewMode>(() => {
    return (localStorage.getItem("viewMode") as ViewMode) || "grid";
  });
  const [params, setParams] = useState<BookSearchParams>({
    page: 1,
    per_page: 24,
    sort: "title_sort",
    order: "asc",
  });
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [allBooks, setAllBooks] = useState<BookListItem[]>([]);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const { data, isLoading } = useBooks({
    ...params,
    tags: selectedTags.length > 0 ? selectedTags.join(",") : undefined,
    author: authorParam,
  });
  const { data: tags } = useTags();

  // Reset to page 1 when author filter changes from URL
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setParams((prev) => ({ ...prev, page: 1 }));
    setAllBooks([]);
  }, [authorParam]);

  // Accumulate books: replace on page 1, append on subsequent pages
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!data) return;
    if ((params.page ?? 1) === 1) {
      setAllBooks(data.items);
    } else {
      setAllBooks((prev) => [...prev, ...data.items]);
    }
  }, [data]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          !isLoading &&
          data &&
          (params.page ?? 1) < (data.pages ?? 1)
        ) {
          setParams((prev) => ({ ...prev, page: (prev.page ?? 1) + 1 }));
        }
      },
      { rootMargin: "300px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isLoading, data, params.page]);

  const handleViewChange = useCallback((v: ViewMode) => {
    setView(v);
    localStorage.setItem("viewMode", v);
  }, []);

  const handleSearch = useCallback((q: string) => {
    setParams((prev) => ({ ...prev, q: q || undefined, page: 1 }));
    setAllBooks([]);
  }, []);

  const handleSort = useCallback((field: string) => {
    setParams((prev) => ({
      ...prev,
      sort: field,
      order: prev.sort === field && prev.order === "asc" ? "desc" : "asc",
      page: 1,
    }));
    setAllBooks([]);
  }, []);

  const handleTagClick = useCallback((tagName: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagName) ? prev.filter((t) => t !== tagName) : [...prev, tagName]
    );
    setParams((prev) => ({ ...prev, page: 1 }));
    setAllBooks([]);
  }, []);

  const clearAuthor = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("author");
      return next;
    });
  }, [setSearchParams]);

  const total = data?.total ?? 0;
  const hasMore = (params.page ?? 1) < (data?.pages ?? 1);

  return (
    <>
      <Header />
      <main className="container">
        <div className="toolbar">
          <div className="toolbar-left">
            <SearchBar value={params.q ?? ""} onChange={handleSearch} />
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setParams((prev) => ({
                  ...prev,
                  order: prev.order === "asc" ? "desc" : "asc",
                  page: 1,
                }));
                setAllBooks([]);
              }}
            >
              {params.order === "asc" ? "\u25B2 Asc" : "\u25BC Desc"}
            </button>
          </div>
          <div className="toolbar-right">
            <span className="stats-bar">{total} books</span>
            <ViewToggle view={view} onChange={handleViewChange} />
          </div>
        </div>

        {(authorParam || selectedTags.length > 0) && (
          <div className="filter-bar">
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Filtering:</span>
            {authorParam && (
              <span className="filter-tag" onClick={clearAuthor}>
                Author: {authorParam} <span className="remove">&times;</span>
              </span>
            )}
            {selectedTags.map((t) => (
              <span key={t} className="filter-tag" onClick={() => handleTagClick(t)}>
                {t} <span className="remove">&times;</span>
              </span>
            ))}
            {(authorParam && selectedTags.length > 0) || selectedTags.length > 1 ? (
              <span
                className="filter-tag"
                onClick={() => {
                  clearAuthor();
                  setSelectedTags([]);
                  setParams((prev) => ({ ...prev, page: 1 }));
                  setAllBooks([]);
                }}
              >
                Clear all
              </span>
            ) : null}
          </div>
        )}

        {tags && tags.length > 0 && !selectedTags.length && !authorParam && (
          <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", padding: "0.5rem 0" }}>
            {tags
              .filter((t) => t.count > 10)
              .slice(0, 30)
              .map((t) => (
                <span key={t.id} className="tag" onClick={() => handleTagClick(t.name)}>
                  {t.name} ({t.count})
                </span>
              ))}
          </div>
        )}

        {allBooks.length === 0 && !isLoading && (
          <div className="loading">No books found.</div>
        )}

        {allBooks.length > 0 && (
          <>
            {view === "grid" && <BookGrid books={allBooks} />}
            {view === "list" && <BookList books={allBooks} />}
            {view === "masonry" && <BookMasonry books={allBooks} />}
            {view === "table" && (
              <BookTable
                books={allBooks}
                sort={params.sort ?? "title_sort"}
                order={params.order ?? "asc"}
                onSort={handleSort}
              />
            )}
          </>
        )}

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} style={{ height: 1 }} />

        {isLoading && (
          <div className="loading" style={{ padding: "1rem 0" }}>
            {allBooks.length === 0 ? "Loading books…" : "Loading more…"}
          </div>
        )}

        {!isLoading && !hasMore && allBooks.length > 0 && (
          <div style={{ textAlign: "center", padding: "1rem 0", fontSize: "0.85rem", color: "var(--text-muted)" }}>
            {total} books total
          </div>
        )}
      </main>
    </>
  );
}
