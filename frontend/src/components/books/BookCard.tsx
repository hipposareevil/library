import { useNavigate } from "react-router-dom";
import type { BookListItem } from "../../types/book";
import BookCover from "./BookCover";
import Stars from "./Stars";

interface BookCardProps {
  book: BookListItem;
}

export default function BookCard({ book }: BookCardProps) {
  const navigate = useNavigate();
  const year = book.publish_date ? new Date(book.publish_date).getFullYear() : null;

  return (
    <div className="book-card" onClick={() => navigate(`/book/${book.id}`)}>
      <BookCover bookId={book.id} title={book.title} className="book-card-cover" />
      <div className="book-card-info">
        <div className="book-card-title">{book.title}</div>
        <div className="book-card-author">{book.author}</div>
        <div className="book-card-meta">
          {year && <span>{year}</span>}
          {book.rating > 0 && <Stars rating={book.rating} />}
          {book.has_epub && <span title="EPUB available">&#128214;</span>}
        </div>
      </div>
    </div>
  );
}
