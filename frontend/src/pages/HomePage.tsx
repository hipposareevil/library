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
    sort: "publish_date",
    order: "desc",
  });
  const [epubOnly, setEpubOnly] = useState(false);
  // null = all, true = read only, false = unread only
  const [readFilter, setReadFilter] = useState<boolean | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagsExpanded, setTagsExpanded] = useState(true);
  const [allBooks, setAllBooks] = useState<BookListItem[]>([]);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const { data, isLoading, isFetching } = useBooks({
    ...params,
    q: qParam,
    tags: selectedTags.length > 0 ? selectedTags.join(",") : undefined,
    author: authorParam,
    has_epub: epubOnly || undefined,
    read: readFilter ?? undefined,
  });
  const { data: tags } = useTags();

  // Reset to page 1 when URL filters change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setParams((prev) => ({ ...prev, page: 1 }));
    setAllBooks([]);
  }, [qParam, authorParam]);

  // Update page title based on active author filter
  useEffect(() => {
    document.title = authorParam ? authorParam : "Arcanum";
    return () => { document.title = "Arcanum"; };
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
            <div className="sort-selector">
              {([
                { label: "Pub Date",   field: "publish_date"},
                { label: "Date Added", field: "created_at"  },
              ] as { label: string; field: string }[]).map(({ label, field }) => (
                <button
                  key={field}
                  className={`btn btn-sm ${params.sort === field ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => {
                    setParams((prev) => ({
                      ...prev,
                      sort: field,
                      order: prev.sort === field ? (prev.order === "asc" ? "desc" : "asc") : "desc",
                      page: 1,
                    }));
                    setAllBooks([]);
                  }}
                >
                  {label}
                  {params.sort === field && (
                    <span style={{ marginLeft: "0.3em" }}>
                      {params.order === "asc" ? "▲" : "▼"}
                    </span>
                  )}
                </button>
              ))}
              <button
                className={`btn btn-sm ${readFilter !== null ? "btn-primary" : "btn-secondary"}`}
                title="Filter by read status"
                onClick={() => {
                  setReadFilter((prev) => prev === null ? true : prev === true ? false : null);
                  setParams((prev) => ({ ...prev, page: 1 }));
                  setAllBooks([]);
                }}
              >
                {readFilter === null ? "All" : readFilter ? "✓ Read" : "Unread"}
              </button>
            </div>
          </div>
          <div className="toolbar-right">
            <button
              className={`btn btn-sm ${epubOnly ? "btn-primary" : "btn-secondary"}`}
              title="Show only books with EPUB"
              onClick={() => {
                setEpubOnly((prev) => !prev);
                setParams((prev) => ({ ...prev, page: 1 }));
                setAllBooks([]);
              }}
            >
              &#128214; EPUB
            </button>
            <span className="stats-bar">{total} books</span>
            <ViewToggle view={view} onChange={handleViewChange} />
          </div>
        </div>

        {(authorParam || qParam || selectedTags.length > 0 || epubOnly || readFilter !== null) && (
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
            {epubOnly && (
              <span className="filter-tag" onClick={() => { setEpubOnly(false); setAllBooks([]); setParams((p) => ({ ...p, page: 1 })); }}>
                EPUB only <span className="remove">&times;</span>
              </span>
            )}
            {readFilter !== null && (
              <span className="filter-tag" onClick={() => { setReadFilter(null); setAllBooks([]); setParams((p) => ({ ...p, page: 1 })); }}>
                {readFilter ? "Read only" : "Unread only"} <span className="remove">&times;</span>
              </span>
            )}
            {selectedTags.map((t) => (
              <span key={t} className="filter-tag" onClick={() => handleTagClick(t)}>
                {t} <span className="remove">&times;</span>
              </span>
            ))}
            {[qParam, authorParam, epubOnly || null, readFilter !== null ? "read" : null, ...selectedTags].filter(Boolean).length > 1 ? (
              <span
                className="filter-tag"
                onClick={() => {
                  clearSearch();
                  clearAuthor();
                  setSelectedTags([]);
                  setEpubOnly(false);
                  setReadFilter(null);
                  setParams((prev) => ({ ...prev, page: 1 }));
                  setAllBooks([]);
                }}
              >
                Clear all
              </span>
            ) : null}
          </div>
        )}

        {tags && tags.length > 0 && !selectedTags.length && !authorParam && !qParam && readFilter === null && (
          <div className="tag-cloud-section">
            <button
              className="tag-cloud-toggle"
              onClick={() => setTagsExpanded((v) => !v)}
              aria-expanded={tagsExpanded}
            >
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: tagsExpanded ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s" }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
              Tags
            </button>
            {tagsExpanded && (
              <div className="tag-cloud">
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
