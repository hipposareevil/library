import { useNavigate } from "react-router-dom";
import type { BookListItem as BookListItemType } from "../../types/book";
import BookCover from "./BookCover";
import Stars from "./Stars";

interface BookListItemProps {
  book: BookListItemType;
}

export default function BookListItemComponent({ book }: BookListItemProps) {
  const navigate = useNavigate();
  const year = book.publish_date ? new Date(book.publish_date).getFullYear() : null;

  return (
    <div className="book-list-item" onClick={() => navigate(`/book/${book.id}`)}>
      <BookCover bookId={book.id} title={book.title} className="book-list-cover" />
      <div className="book-list-info">
        <div className="book-list-title">{book.title}</div>
        <div className="book-list-author">{book.author}</div>
        <div className="book-list-tags">
          {book.tags.slice(0, 3).map((t) => (
            <span key={t.id} className="tag">{t.name}</span>
          ))}
        </div>
      </div>
      <div className="book-list-right">
        {year && <span>{year}</span>}
        {book.rating > 0 && <Stars rating={book.rating} />}
        {book.has_epub && <span title="EPUB available">&#128214;</span>}
      </div>
    </div>
  );
}
