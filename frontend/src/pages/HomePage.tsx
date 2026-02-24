import { useState, useCallback } from "react";
import Header from "../components/layout/Header";
import SearchBar from "../components/layout/SearchBar";
import ViewToggle from "../components/layout/ViewToggle";
import BookGrid from "../components/books/BookGrid";
import BookList from "../components/books/BookList";
import BookMasonry from "../components/books/BookMasonry";
import BookTable from "../components/books/BookTable";
import { useBooks } from "../hooks/useBooks";
import { useTags } from "../hooks/useTags";
import type { BookSearchParams, ViewMode } from "../types/book";

export default function HomePage() {
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

  const { data, isLoading } = useBooks({
    ...params,
    tags: selectedTags.length > 0 ? selectedTags.join(",") : undefined,
  });
  const { data: tags } = useTags();

  const handleViewChange = useCallback((v: ViewMode) => {
    setView(v);
    localStorage.setItem("viewMode", v);
  }, []);

  const handleSearch = useCallback((q: string) => {
    setParams((prev) => ({ ...prev, q: q || undefined, page: 1 }));
  }, []);

  const handleSort = useCallback((field: string) => {
    setParams((prev) => ({
      ...prev,
      sort: field,
      order: prev.sort === field && prev.order === "asc" ? "desc" : "asc",
      page: 1,
    }));
  }, []);

  const handleTagClick = useCallback((tagName: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagName) ? prev.filter((t) => t !== tagName) : [...prev, tagName]
    );
    setParams((prev) => ({ ...prev, page: 1 }));
  }, []);

  const books = data?.items ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 0;

  return (
    <>
      <Header />
      <main className="container">
        <div className="toolbar">
          <div className="toolbar-left">
            <SearchBar value={params.q ?? ""} onChange={handleSearch} />
            <select
              className="select"
              value={params.sort}
              onChange={(e) =>
                setParams((prev) => ({ ...prev, sort: e.target.value, page: 1 }))
              }
            >
              <option value="title_sort">Title</option>
              <option value="author_sort">Author</option>
              <option value="publish_date">Date</option>
              <option value="rating">Rating</option>
              <option value="created_at">Recently Added</option>
            </select>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() =>
                setParams((prev) => ({
                  ...prev,
                  order: prev.order === "asc" ? "desc" : "asc",
                }))
              }
            >
              {params.order === "asc" ? "\u25B2 Asc" : "\u25BC Desc"}
            </button>
          </div>
          <div className="toolbar-right">
            <span className="stats-bar">{total} books</span>
            <ViewToggle view={view} onChange={handleViewChange} />
          </div>
        </div>

        {selectedTags.length > 0 && (
          <div className="filter-bar">
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Filtering:
            </span>
            {selectedTags.map((t) => (
              <span key={t} className="filter-tag" onClick={() => handleTagClick(t)}>
                {t} <span className="remove">&times;</span>
              </span>
            ))}
            <span
              className="filter-tag"
              onClick={() => {
                setSelectedTags([]);
                setParams((prev) => ({ ...prev, page: 1 }));
              }}
            >
              Clear all
            </span>
          </div>
        )}

        {tags && tags.length > 0 && !selectedTags.length && (
          <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", padding: "0.5rem 0" }}>
            {tags
              .filter((t) => t.count > 10)
              .slice(0, 30)
              .map((t) => (
                <span
                  key={t.id}
                  className="tag"
                  onClick={() => handleTagClick(t.name)}
                >
                  {t.name} ({t.count})
                </span>
              ))}
          </div>
        )}

        {isLoading && <div className="loading">Loading books...</div>}

        {!isLoading && books.length === 0 && (
          <div className="loading">No books found.</div>
        )}

        {!isLoading && books.length > 0 && (
          <>
            {view === "grid" && <BookGrid books={books} />}
            {view === "list" && <BookList books={books} />}
            {view === "masonry" && <BookMasonry books={books} />}
            {view === "table" && (
              <BookTable
                books={books}
                sort={params.sort ?? "title_sort"}
                order={params.order ?? "asc"}
                onSort={handleSort}
              />
            )}

            {pages > 1 && (
              <div className="pagination">
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={params.page === 1}
                  onClick={() => setParams((prev) => ({ ...prev, page: (prev.page ?? 1) - 1 }))}
                >
                  Previous
                </button>
                <span className="pagination-info">
                  Page {params.page} of {pages}
                </span>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={params.page === pages}
                  onClick={() => setParams((prev) => ({ ...prev, page: (prev.page ?? 1) + 1 }))}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
