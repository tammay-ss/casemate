import "./Header.css";
import { useTheme } from "../ThemeContext";

export default function Header({ onMenuClick, drawerOpen, search, onSearch, user, onLogout }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <header className="header">
      <div className="header-left">
        {/* Hamburger menu */}
        <button
          type="button"
          className="header-menu-btn"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
          aria-expanded={drawerOpen}
          aria-controls="app-drawer"
        >
          <span className="header-menu-icon" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>

        {/* Brand — clicking reloads the page (Section 4 requirement) */}
        <button
          type="button"
          className="header-brand-btn"
          onClick={() => window.location.reload()}
          title="Reload CaseMate"
          aria-label="CaseMate — click to reload"
        >
          CaseMate
        </button>
      </div>

      {/* Search */}
      <label className="header-search-wrap">
        <span className="sr-only">Search clients</span>
        <input
          type="search"
          className="search"
          placeholder="Search clients…"
          autoComplete="off"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </label>

      {/* Account actions */}
      <nav className="header-actions" aria-label="Account">
        {/* Dark / Light mode toggle */}
        <button
          type="button"
          className="header-theme-btn"
          onClick={toggleTheme}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? (
            /* Sun icon */
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            /* Moon icon */
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

        <span className="header-username" title={user.email}>{user.name}</span>

        <button
          type="button"
          className="header-logout-btn"
          onClick={onLogout}
        >
          Log out
        </button>
      </nav>
    </header>
  );
}
