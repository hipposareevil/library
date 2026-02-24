interface StarsProps {
  rating: number; // 0-10 (Calibre scale)
}

export default function Stars({ rating }: StarsProps) {
  if (rating <= 0) return null;
  const starCount = Math.round(rating / 2);
  const full = "\u2605".repeat(starCount);
  const empty = "\u2606".repeat(5 - starCount);
  return <span className="stars">{full}{empty}</span>;
}
