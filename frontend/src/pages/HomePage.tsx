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
  // Both q and author live in the URL so they survive back-navigation
  const qParam = searchParams.get("q") || undefined;
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

  const { data, isLoading, isFetching } = useBooks({
    ...params,
    q: qParam,
    tags: selectedTags.length > 0 ? selectedTags.join(",") : undefined,
    author: authorParam,
  });
  const { data: tags } = useTags();

  // Reset to page 1 when URL filters change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setParams((prev) => ({ ...prev, page: 1 }));
    setAllBooks([]);
  }, [qParam, authorParam]);

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
          !isFetching &&
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
  }, [isFetching, data, params.page]);

  const handleViewChange = useCallback((v: ViewMode) => {
    setView(v);
    localStorage.setItem("viewMode", v);
  }, []);

  const handleSearch = useCallback((q: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (q) {
        next.set("q", q);
      } else {
        next.delete("q");
      }
      return next;
    }, { replace: true }); // replace so typing doesn't flood browser history
  }, [setSearchParams]);

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

  const clearSearch = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("q");
      return next;
    });
  }, [setSearchParams]);

  const total = data?.total ?? 0;
  const hasMore = (params.page ?? 1) < (data?.pages ?? 1);
  // isFetching is true while a new query is in-flight (even with placeholderData)
  const isWorking = isLoading || (isFetching && allBooks.length === 0);

  return (
    <>
      <Header />
      <main className="container">
        <div className="toolbar">
          <div className="toolbar-left">
            <SearchBar value={qParam ?? ""} onChange={handleSearch} />
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

        {(authorParam || qParam || selectedTags.length > 0) && (
          <div className="filter-bar">
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Filtering:</span>
            {qParam && (
              <span className="filter-tag" onClick={clearSearch}>
                Search: {qParam} <span className="remove">&times;</span>
              </span>
            )}
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
            {[qParam, authorParam, ...selectedTags].filter(Boolean).length > 1 ? (
              <span
                className="filter-tag"
                onClick={() => {
                  clearSearch();
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

        {tags && tags.length > 0 && !selectedTags.length && !authorParam && !qParam && (
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

        {allBooks.length === 0 && !isWorking && (
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

        {isWorking && (
          <div className="loading" style={{ padding: "1rem 0" }}>
            {allBooks.length === 0 ? "Loading books…" : "Loading more…"}
          </div>
        )}

        {!isFetching && !hasMore && allBooks.length > 0 && (
          <div style={{ textAlign: "center", padding: "1rem 0", fontSize: "0.85rem", color: "var(--text-muted)" }}>
            {total} books total
          </div>
        )}
      </main>
    </>
  );
}
