import { useEffect, useRef } from "react";
import "./Drawer.css";

const NAV = [
  { id: "dashboard", label: "Dashboard" },
  { id: "today", label: "Today" },
  { id: "clients", label: "Clients" },
];

export default function Drawer({ isOpen, activeView, onNavigate, onClose }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const t = window.setTimeout(() => {
      panelRef.current?.querySelector("button")?.focus();
    }, 50);
    return () => window.clearTimeout(t);
  }, [isOpen]);

  return (
    <div
      id="app-drawer"
      className={`drawer-root${isOpen ? " drawer-root--open" : ""}`}
      aria-hidden={!isOpen}
    >
      <button
        type="button"
        className="drawer-backdrop"
        aria-label="Close menu"
        tabIndex={isOpen ? 0 : -1}
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        className="drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
      >
        <div className="drawer-head">
          <span className="drawer-brand">CaseMate</span>
          <button
            type="button"
            className="drawer-close"
            onClick={onClose}
            aria-label="Close menu"
          >
            x
          </button>
        </div>
        <nav className="drawer-nav" aria-label="Primary">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`drawer-link${
                activeView === item.id ? " drawer-link--active" : ""
              }`}
              onClick={() => {
                onNavigate(item.id);
                onClose();
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
    </div>
  );
}
