import type { BookListItem } from "../../types/book";
import BookCard from "./BookCard";

interface BookGridProps {
  books: BookListItem[];
}

export default function BookGrid({ books }: BookGridProps) {
  return (
    <div className="book-grid">
      {books.map((book) => (
        <BookCard key={book.id} book={book} />
      ))}
    </div>
  );
}
