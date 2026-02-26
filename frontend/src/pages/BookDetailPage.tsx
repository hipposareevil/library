import { useParams, Link, useNavigate } from "react-router-dom";
import DOMPurify from "dompurify";
import Header from "../components/layout/Header";
import BookCover from "../components/books/BookCover";
import Stars from "../components/books/Stars";
import { useBook, useBookOverview } from "../hooks/useBooks";
import { useAuth } from "../context/AuthContext";
import { getDownloadUrl } from "../api/books";

export default function BookDetailPage() {
  const { id } = useParams();
  const bookId = Number(id);
  const navigate = useNavigate();
  const { data: book, isLoading } = useBook(bookId);
  const { data: overview } = useBookOverview(bookId, book?.isbn ?? null);
  const { isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <>
        <Header />
        <div className="container loading">Loading book...</div>
      </>
    );
  }

  if (!book) {
    return (
      <>
        <Header />
        <div className="container loading">Book not found.</div>
      </>
    );
  }

  const year = book.publish_date ? new Date(book.publish_date).getFullYear() : null;
  const overviewDesc =
    overview && !("detail" in overview)
      ? String((overview as Record<string, unknown>).work_description ?? "")
      : "";

  return (
    <>
      <Header />
      <main className="container detail-page">
        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem" }}>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)}>&larr; Back</button>
          {isAuthenticated && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => navigate("/admin", { state: { editBook: book } })}
            >
              Edit
            </button>
          )}
        </div>

        <div className="detail-layout">
          <div>
            <BookCover bookId={book.id} title={book.title} className="detail-cover" />
          </div>
          <div>
            <h1 className="detail-title">{book.title}</h1>
            {book.author && (
              <p
                className="detail-author author-link"
                onClick={() => navigate(`/?author=${encodeURIComponent(book.author!)}`)}
              >
                {book.author}
              </p>
            )}

            <div className="detail-meta">
              {year && (
                <span className="detail-meta-item">{year}</span>
              )}
              {book.publisher && (
                <span className="detail-meta-item">{book.publisher}</span>
              )}
              {book.language && (
                <span className="detail-meta-item">{book.language.toUpperCase()}</span>
              )}
              {book.isbn && (
                <span className="detail-meta-item">ISBN: {book.isbn}</span>
              )}
              {book.series_name && (
                <span className="detail-meta-item">
                  {book.series_name}
                  {book.series_index ? ` #${book.series_index}` : ""}
                </span>
              )}
            </div>

            {book.rating > 0 && (
              <div style={{ marginBottom: "1rem" }}>
                <Stars rating={book.rating} />
              </div>
            )}

            {book.tags.length > 0 && (
              <div className="detail-tags">
                {book.tags.map((t) => (
                  <Link key={t.id} to={`/?tags=${encodeURIComponent(t.name)}`}>
                    <span className="tag">{t.name}</span>
                  </Link>
                ))}
              </div>
            )}

            {isAuthenticated && book.has_epub && (
              <a
                href={getDownloadUrl(book.id)}
                className="btn btn-primary download-btn"
              >
                Download EPUB
              </a>
            )}

            {book.description && (
              <div className="detail-section">
                <h2>Description</h2>
                <div
                  className="detail-description"
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(book.description),
                  }}
                />
              </div>
            )}

            {overviewDesc && (
              <div className="detail-section">
                <h2>About This Book (OpenLibrary)</h2>
                <div className="detail-description">
                  <p>{overviewDesc}</p>
                </div>
              </div>
            )}

            {book.notes && (
              <div className="detail-section">
                <h2>Notes</h2>
                <div className="detail-description" style={{ whiteSpace: "pre-wrap" }}>
                  {book.notes}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
