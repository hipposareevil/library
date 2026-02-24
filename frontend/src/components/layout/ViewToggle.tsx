import type { ViewMode } from "../../types/book";

interface ViewToggleProps {
  view: ViewMode;
  onChange: (view: ViewMode) => void;
}

const VIEWS: { mode: ViewMode; icon: string; title: string }[] = [
  { mode: "grid", icon: "\u25A6", title: "Grid" },
  { mode: "list", icon: "\u2630", title: "List" },
  { mode: "masonry", icon: "\u25A7", title: "Masonry" },
  { mode: "table", icon: "\u25A4", title: "Table" },
];

export default function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div className="view-toggle">
      {VIEWS.map((v) => (
        <button
          key={v.mode}
          className={view === v.mode ? "active" : ""}
          onClick={() => onChange(v.mode)}
          title={v.title}
        >
          {v.icon}
        </button>
      ))}
    </div>
  );
}
