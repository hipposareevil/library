import type { BookListItem } from "../../types/book";
import BookCard from "./BookCard";

interface BookMasonryProps {
  books: BookListItem[];
}

export default function BookMasonry({ books }: BookMasonryProps) {
  return (
    <div className="masonry-grid">
      {books.map((book) => (
        <div key={book.id} className="masonry-item">
          <BookCard book={book} />
        </div>
      ))}
    </div>
  );
}
