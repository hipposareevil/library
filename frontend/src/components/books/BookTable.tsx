import { useNavigate } from "react-router-dom";
import type { BookListItem } from "../../types/book";
import BookCover from "./BookCover";
import Stars from "./Stars";

interface BookTableProps {
  books: BookListItem[];
  sort: string;
  order: "asc" | "desc";
  onSort: (field: string) => void;
}

export default function BookTable({ books, sort, order, onSort }: BookTableProps) {
  const navigate = useNavigate();

  const sortIcon = (field: string) => {
    if (sort !== field) return "";
    return order === "asc" ? " \u25B2" : " \u25BC";
  };

  return (
    <div className="book-table-wrap">
      <table className="book-table">
        <thead>
          <tr>
            <th style={{ width: 50 }}></th>
            <th onClick={() => onSort("title_sort")}>Title{sortIcon("title_sort")}</th>
            <th onClick={() => onSort("author_sort")}>Author{sortIcon("author_sort")}</th>
            <th onClick={() => onSort("publish_date")}>Year{sortIcon("publish_date")}</th>
            <th onClick={() => onSort("rating")}>Rating{sortIcon("rating")}</th>
            <th>Tags</th>
            <th>EPUB</th>
          </tr>
        </thead>
        <tbody>
          {books.map((book) => (
            <tr key={book.id} onClick={() => navigate(`/book/${book.id}`)}>
              <td>
                <BookCover bookId={book.id} title={book.title} className="book-table-cover" thumb />
              </td>
              <td>{book.title}</td>
              <td>
                {book.author ? (
                  <span
                    className="author-link"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/?author=${encodeURIComponent(book.author!)}`);
                    }}
                  >
                    {book.author}
                  </span>
                ) : ""}
              </td>
              <td>
                {book.publish_date
                  ? new Date(book.publish_date).getFullYear()
                  : ""}
              </td>
              <td><Stars rating={book.rating} /></td>
              <td>
                {book.tags.slice(0, 3).map((t) => (
                  <span key={t.id} className="tag" style={{ marginRight: 4 }}>
                    {t.name}
                  </span>
                ))}
              </td>
              <td>{book.has_epub ? "Yes" : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
