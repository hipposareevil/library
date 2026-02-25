import type { BookListItem } from "../../types/book";
import BookCard from "./BookCard";

interface BookMasonryProps {
  books: BookListItem[];
}

// Deterministic size class based on book id — creates natural height variation
const SIZE_CLASSES = ["sm", "md", "md", "md", "lg", "md", "xl"] as const;

function sizeClass(book: BookListItem): string {
  return SIZE_CLASSES[book.id % SIZE_CLASSES.length];
}

export default function BookMasonry({ books }: BookMasonryProps) {
  return (
    <div className="masonry-grid">
      {books.map((book) => (
        <div key={book.id} className={`masonry-item size-${sizeClass(book)}`}>
          <BookCard book={book} />
        </div>
      ))}
    </div>
  );
}
