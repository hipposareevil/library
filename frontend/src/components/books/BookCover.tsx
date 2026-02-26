import { useState } from "react";
import { getCoverUrl } from "../../api/books";

interface BookCoverProps {
  bookId: number;
  title: string;
  className?: string;
  thumb?: boolean;
}

export default function BookCover({ bookId, title, className = "", thumb = false }: BookCoverProps) {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className={`cover-placeholder ${className}`}>
        <span>{title.charAt(0).toUpperCase()}</span>
      </div>
    );
  }

  return (
    <img
      src={getCoverUrl(bookId, thumb)}
      alt={title}
      className={className}
      loading="lazy"
      onError={() => setError(true)}
    />
  );
}
