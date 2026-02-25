import { useState, useEffect, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import Header from "../components/layout/Header";
import { useAuth } from "../context/AuthContext";
import { useBooks } from "../hooks/useBooks";
import {
  createBook,
  updateBook,
  deleteBook,
  uploadEpub,
  uploadCoverFile,
  uploadCoverUrl,
  extractEpubMetadata,
  getCoverUrl,
} from "../api/books";
import type { BookListItem, BookDetail } from "../types/book";

interface BookFormData {
  title: string;
  author: string;
  publisher: string;
  publish_date: string;
  isbn: string;
  language: string;
  description: string;
  notes: string;
  rating: number;
  series_name: string;
  series_index: string;
  tags: string;
}

const emptyForm: BookFormData = {
  title: "",
  author: "",
  publisher: "",
  publish_date: "",
  isbn: "",
  language: "eng",
  description: "",
  notes: "",
  rating: 0,
  series_name: "",
  series_index: "",
  tags: "",
};

// ── Star Rating ──────────────────────────────────────────────────────────────
function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  const stars = value / 2; // 0-10 → 0-5
  const display = hover || stars;
  return (
    <div className="star-rating" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={`star-btn${display >= star ? " star-active" : ""}`}
          onMouseEnter={() => setHover(star)}
          onClick={() => onChange(stars === star ? 0 : star * 2)}
          aria-label={`${star} star${star !== 1 ? "s" : ""}`}
        >
          ★
        </button>
      ))}
      {value > 0 && <span className="star-label">{(value / 2).toFixed(1)}</span>}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const location = useLocation();
  const [page, setPage] = useState(1);
  const { data } = useBooks({ page, per_page: 20, sort: "created_at", order: "desc" });

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<BookFormData>(emptyForm);
  const [epubFile, setEpubFile] = useState<File | null>(null);
  const [coverB64, setCoverB64] = useState<string | null>(null);
  const [coverUrlInput, setCoverUrlInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);

  // Open edit form when navigated from BookDetailPage with state
  useEffect(() => {
    const editBook = (location.state as { editBook?: BookDetail })?.editBook;
    if (editBook && isAuthenticated) {
      setEditingId(editBook.id);
      setForm({
        title: editBook.title,
        author: editBook.author || "",
        publisher: editBook.publisher || "",
        publish_date: editBook.publish_date || "",
        isbn: editBook.isbn || "",
        language: editBook.language || "eng",
        description: editBook.description || "",
        notes: editBook.notes || "",
        rating: editBook.rating,
        series_name: editBook.series_name || "",
        series_index: editBook.series_index?.toString() || "",
        tags: editBook.tags.map((t) => t.name).join(", "),
      });
      setCoverB64(null);
      setCoverUrlInput("");
      setEpubFile(null);
      setShowForm(true);
      window.history.replaceState({}, "", "/admin");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isAuthenticated) return <Navigate to="/login" />;

  // Derived cover preview
  const coverPreview = coverUrlInput
    ? coverUrlInput
    : coverB64
    ? `data:image/jpeg;base64,${coverB64}`
    : editingId
    ? getCoverUrl(editingId)
    : null;

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setEpubFile(null);
    setCoverB64(null);
    setCoverUrlInput("");
  };

  const handleEpubChange = async (file: File | null) => {
    setEpubFile(file);
    if (!file) return;
    setExtracting(true);
    try {
      const meta = await extractEpubMetadata(file);
      setForm((prev) => ({
        ...prev,
        title: (meta.title as string) || prev.title,
        author: (meta.author as string) || prev.author,
        publisher: (meta.publisher as string) || prev.publisher,
        isbn: (meta.isbn as string) || prev.isbn,
        description: (meta.description as string) || prev.description,
        publish_date: (meta.publish_date as string) || prev.publish_date,
        language: (meta.language as string) || prev.language,
      }));
      if (meta.cover_b64) setCoverB64(meta.cover_b64 as string);
    } catch {
      // ignore parse failures
    } finally {
      setExtracting(false);
    }
  };

  const handleEdit = (book: BookListItem & { description?: string | null; notes?: string | null }) => {
    setEditingId(book.id);
    setForm({
      title: book.title,
      author: book.author || "",
      publisher: book.publisher || "",
      publish_date: book.publish_date || "",
      isbn: book.isbn || "",
      language: book.language || "eng",
      description: book.description || "",
      notes: book.notes || "",
      rating: book.rating,
      series_name: book.series_name || "",
      series_index: book.series_index?.toString() || "",
      tags: book.tags.map((t) => t.name).join(", "),
    });
    setCoverB64(null);
    setCoverUrlInput("");
    setEpubFile(null);
    setShowForm(true);
  };

  const handleDelete = async (bookId: number) => {
    if (!confirm("Delete this book?")) return;
    await deleteBook(bookId);
    queryClient.invalidateQueries({ queryKey: ["books"] });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        author: form.author || null,
        publisher: form.publisher || null,
        publish_date: form.publish_date || null,
        isbn: form.isbn || null,
        language: form.language || "eng",
        description: form.description || null,
        notes: form.notes || null,
        rating: form.rating,
        series_name: form.series_name || null,
        series_index: form.series_index ? parseFloat(form.series_index) : null,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      };

      let bookId: number;
      if (editingId) {
        const updated = await updateBook(editingId, payload);
        bookId = updated.id;
      } else {
        const created = await createBook(payload);
        bookId = created.id;
      }

      // Upload EPUB (auto-extracts metadata + cover on backend)
      if (epubFile) await uploadEpub(bookId, epubFile);

      // Cover URL wins; otherwise always upload extracted b64 cover if available
      if (coverUrlInput) {
        await uploadCoverUrl(bookId, coverUrlInput);
      } else if (coverB64) {
        const bytes = atob(coverB64);
        const arr = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
        await uploadCoverFile(bookId, new Blob([arr], { type: "image/jpeg" }));
      }

      queryClient.invalidateQueries({ queryKey: ["books"] });
      resetForm();
    } catch {
      alert("Failed to save book");
    } finally {
      setSaving(false);
    }
  };

  const books = data?.items ?? [];
  const pages = data?.pages ?? 0;

  // ── Full-page form ──────────────────────────────────────────────────────────
  if (showForm) {
    return (
      <>
        <Header />
        <main className="container book-form-page">
          <div className="book-form-header">
            <button type="button" className="btn btn-secondary btn-sm" onClick={resetForm}>
              ← Back
            </button>
            <h1>{editingId ? "Edit Book" : "Add Book"}</h1>
          </div>

          <form onSubmit={handleSubmit} className="book-form-layout">
            {/* ── Left: cover ── */}
            <div className="book-form-cover-col">
              <div className="cover-preview-box">
                {coverPreview ? (
                  <img src={coverPreview} alt="Cover" onError={() => setCoverUrlInput("")} />
                ) : (
                  <div className="cover-placeholder">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: "0.5rem", opacity: 0.4 }}>
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <div>No cover</div>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>EPUB File{extracting && <span style={{ color: "var(--accent)", marginLeft: "0.4rem" }}>extracting…</span>}</label>
                <input
                  type="file"
                  accept=".epub"
                  className="input"
                  onChange={(e) => handleEpubChange(e.target.files?.[0] || null)}
                />
              </div>

              <div className="form-group">
                <label>Cover Image URL</label>
                <input
                  className="input"
                  placeholder="https://..."
                  value={coverUrlInput}
                  onChange={(e) => setCoverUrlInput(e.target.value)}
                />
              </div>
            </div>

            {/* ── Right: fields ── */}
            <div className="book-form-fields-col">
              <div className="form-group">
                <label>Title *</label>
                <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </div>

              <div className="form-group">
                <label>Author</label>
                <input className="input" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
                <div className="form-group">
                  <label>Publisher</label>
                  <input className="input" value={form.publisher} onChange={(e) => setForm({ ...form, publisher: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Publish Date</label>
                  <input type="date" className="input" value={form.publish_date} onChange={(e) => setForm({ ...form, publish_date: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Language</label>
                  <input className="input" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div className="form-group">
                  <label>Series</label>
                  <input className="input" value={form.series_name} onChange={(e) => setForm({ ...form, series_name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Series #</label>
                  <input className="input" value={form.series_index} onChange={(e) => setForm({ ...form, series_index: e.target.value })} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div className="form-group">
                  <label>ISBN</label>
                  <input className="input" value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Rating</label>
                  <StarRating value={form.rating} onChange={(v) => setForm({ ...form, rating: v })} />
                </div>
              </div>

              <div className="form-group">
                <label>Tags (comma-separated)</label>
                <input className="input" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="Fiction, Science Fiction, Space" />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  className="input"
                  rows={6}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  style={{ width: "100%", resize: "vertical" }}
                />
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea
                  className="input"
                  rows={4}
                  placeholder="Personal notes, reading status, thoughts…"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  style={{ width: "100%", resize: "vertical" }}
                />
              </div>

              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "0.5rem" }}>
                <button type="button" className="btn btn-secondary" onClick={resetForm}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : editingId ? "Update" : "Create"}
                </button>
              </div>
            </div>
          </form>
        </main>
      </>
    );
  }

  // ── Book list ───────────────────────────────────────────────────────────────
  return (
    <>
      <Header />
      <main className="container" style={{ padding: "2rem 1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h1>Manage Books</h1>
          <button className="btn btn-primary" onClick={() => { setForm(emptyForm); setCoverB64(null); setCoverUrlInput(""); setEpubFile(null); setEditingId(null); setShowForm(true); }}>
            + Add Book
          </button>
        </div>

        <div className="book-list">
          {books.map((book) => (
            <div key={book.id} className="book-list-item" style={{ cursor: "default" }}>
              <div className="book-list-info">
                <div className="book-list-title">{book.title}</div>
                <div className="book-list-author">{book.author}</div>
              </div>
              <div className="admin-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(book)}>Edit</button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(book.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>

        {pages > 1 && (
          <div className="pagination">
            <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
            <span className="pagination-info">Page {page} of {pages}</span>
            <button className="btn btn-secondary btn-sm" disabled={page === pages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        )}
      </main>
    </>
  );
}
