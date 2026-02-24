import type { BookListItem } from "../../types/book";
import BookListItemComponent from "./BookListItem";

interface BookListProps {
  books: BookListItem[];
}

export default function BookList({ books }: BookListProps) {
  return (
    <div className="book-list">
      {books.map((book) => (
        <BookListItemComponent key={book.id} book={book} />
      ))}
    </div>
  );
}
