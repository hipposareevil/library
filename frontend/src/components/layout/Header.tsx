import { Link, useNavigate } from "react-router-dom";
import { useTheme, type Theme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";

const THEMES: { value: Theme; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "nord", label: "Nord" },
  { value: "space", label: "Space" },
  { value: "forest", label: "Forest" },
];

export default function Header() {
  const { theme, setTheme } = useTheme();
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="hero">
      <div className="container hero-inner">
        <Link to="/" style={{ textDecoration: "none", color: "inherit" }} className="hero-brand">
          <img
            src="/android-chrome-192x192.png"
            alt="Library"
            className="hero-logo"
          />
          <h1 className="hero-title">Library</h1>
        </Link>
        <div className="hero-controls">
          <select
            className="select"
            value={theme}
            onChange={(e) => setTheme(e.target.value as Theme)}
          >
            {THEMES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          {isAuthenticated ? (
            <>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => navigate("/admin")}
              >
                Books
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => navigate("/manage")}
              >
                System
              </button>
              <button className="btn btn-secondary btn-sm" onClick={logout}>
                Logout
              </button>
            </>
          ) : (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => navigate("/login")}
            >
              Login
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
