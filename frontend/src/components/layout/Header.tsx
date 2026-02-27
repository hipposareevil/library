import { useState, useRef, useEffect } from "react";
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

function useDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);
  return { open, setOpen, ref };
}

export default function Header() {
  const { theme, setTheme } = useTheme();
  const { isAuthenticated, username, logout } = useAuth();
  const navigate = useNavigate();
  const navMenu = useDropdown();
  const themeMenu = useDropdown();

  return (
    <header className="hero">
      <div className="container hero-inner">

        {/* ── Left: brand ── */}
        <Link to="/" className="hero-brand">
          <img src="/android-chrome-192x192.png" alt="Arcanum" className="hero-logo" />
          <h1 className="hero-title">Arcanum</h1>
        </Link>

        {/* ── Right: palette + nav menus ── */}
        <div className="hero-right">

          {/* Nav / auth dropdown */}
          <div className="dropdown dropdown-right" ref={navMenu.ref}>
            <button
              className="btn btn-secondary btn-sm dropdown-toggle"
              onClick={() => navMenu.setOpen((v) => !v)}
              aria-expanded={navMenu.open}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
              Menu
            </button>
            {navMenu.open && (
              <div className="dropdown-menu">
                {isAuthenticated && (
                  <>
                    <button className="dropdown-item" onClick={() => { navigate("/admin"); navMenu.setOpen(false); }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                      </svg>
                      Books
                    </button>
                    <button className="dropdown-item" onClick={() => { navigate("/manage"); navMenu.setOpen(false); }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <ellipse cx="12" cy="5" rx="9" ry="3" />
                        <path d="M21 5v14c0 1.66-4.03 3-9 3s-9-1.34-9-3V5" />
                        <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
                      </svg>
                      System
                    </button>
                    <button className="dropdown-item" onClick={() => { navigate("/settings"); navMenu.setOpen(false); }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                      </svg>
                      Users
                    </button>
                    <div className="dropdown-divider" />
                    <button className="dropdown-item dropdown-item-danger" onClick={() => { logout(); navMenu.setOpen(false); }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                      Sign Out
                    </button>
                    {username && <div className="dropdown-footer">Signed in as {username}</div>}
                  </>
                )}
                {!isAuthenticated && (
                  <button className="dropdown-item" onClick={() => { navigate("/login"); navMenu.setOpen(false); }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                      <polyline points="10 17 15 12 10 7" />
                      <line x1="15" y1="12" x2="3" y2="12" />
                    </svg>
                    Login
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Theme dropdown */}
          <div className="dropdown dropdown-right" ref={themeMenu.ref}>
            <button
              className="btn btn-secondary btn-sm dropdown-toggle"
              onClick={() => themeMenu.setOpen((v) => !v)}
              aria-expanded={themeMenu.open}
              aria-label="Theme"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="13.5" cy="6.5" r="2.5" />
                <circle cx="19" cy="13" r="2" />
                <circle cx="7.5" cy="7.5" r="2" />
                <circle cx="6" cy="14" r="2.5" />
                <path d="M12 22C6.5 22 2 17.5 2 12S6.5 2 12 2s10 4.5 10 10c0 2-1 3-2.5 3H17a1.5 1.5 0 0 0-1.5 1.5c0 .5.2.9.5 1.2.4.4.5.8.5 1.3 0 1.4-1.1 3-4.5 3z" />
              </svg>
            </button>
            {themeMenu.open && (
              <div className="dropdown-menu">
                <div className="dropdown-section-label">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="13.5" cy="6.5" r="2.5" /><circle cx="19" cy="13" r="2" />
                    <circle cx="7.5" cy="7.5" r="2" /><circle cx="6" cy="14" r="2.5" />
                    <path d="M12 22C6.5 22 2 17.5 2 12S6.5 2 12 2s10 4.5 10 10c0 2-1 3-2.5 3H17a1.5 1.5 0 0 0-1.5 1.5c0 .5.2.9.5 1.2.4.4.5.8.5 1.3 0 1.4-1.1 3-4.5 3z" />
                  </svg>
                  Theme
                </div>
                {THEMES.map((t) => (
                  <button
                    key={t.value}
                    className="dropdown-item dropdown-item-theme"
                    onClick={() => { setTheme(t.value); themeMenu.setOpen(false); }}
                  >
                    <span className={`theme-swatch theme-swatch-${t.value}`} />
                    {t.label}
                    {theme === t.value && (
                      <svg className="dropdown-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
}
