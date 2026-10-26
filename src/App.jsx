import "./App.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Header from "./components/Header.jsx";
import TodayList from "./components/TodayList.jsx";
import MonthCalendar from "./components/MonthCalendar.jsx";
import Drawer from "./components/Drawer.jsx";
import ClientList from "./components/ClientList.jsx";
import Login from "./components/Login.jsx";
import api, { messageFrom } from "./api/client";

// Token key — using localStorage for session persistence across normal reloads.
// The token is a signed JWT with an 8-hour expiry set by the server.
export const TOKEN_KEY = "casemate_token";

function eventForUi(event) {
  return {
    ...event,
    id: event.id || event._id,
    caseId: event.case?.id || event.case?._id || event.case,
    caseName: event.case?.title || "",
    clientName: event.case?.client?.name || "",
    clientPhone: event.case?.client?.phone || "",
    important: event.kind === "hearing",
  };
}

export default function App({ initialUser = null } = {}) {
  // ── Auth state ────────────────────────────────────────────
  // We initialise user from localStorage token presence so the app can
  // render immediately. A /auth/me verification happens asynchronously.
  const [user, setUser] = useState(initialUser);
  const [authChecked, setAuthChecked] = useState(!!initialUser);

  // ── UI state ─────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeView, setActiveView] = useState("dashboard");

  // ── Data state ───────────────────────────────────────────
  const [clients, setClients] = useState([]);
  const [cases, setCases] = useState([]);
  const [events, setEvents] = useState([]);
  const [dashboard, setDashboard] = useState(null);

  // ── Loading/error ────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(!initialUser);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  // Used to cancel in-flight requests on unmount
  const abortRef = useRef(null);

  // ── Logout helper ────────────────────────────────────────
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setClients([]);
    setCases([]);
    setEvents([]);
    setDashboard(null);
    setError("");
  }, []);

  // ── Auth verification on mount ───────────────────────────
  useEffect(() => {
    if (initialUser) return;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setAuthChecked(true);
      setAuthLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    // Verify token with the backend with timeout
    api.get("/auth/me", { signal: controller.signal })
      .then(({ data }) => {
        setUser(data);
      })
      .catch((err) => {
        // 401 = expired/invalid token — clear it and show login
        if (err.response?.status === 401) {
          localStorage.removeItem(TOKEN_KEY);
        }
      })
      .finally(() => {
        clearTimeout(timer);
        setAuthChecked(true);
        setAuthLoading(false);
      });

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [initialUser]);

  // ── Data loader ──────────────────────────────────────────
  const load = useCallback(async (searchValue = "", isInitial = false) => {
    const controller = new AbortController();
    abortRef.current = controller;
    if (isInitial) setLoading(true);
    setError("");
    try {
      const clientResponse = await api.get("/clients", {
        params: searchValue ? { search: searchValue } : {},
        signal: controller.signal,
      });
      const nextClients = clientResponse.data;
      const caseResponses = await Promise.all(
        nextClients.map((c) =>
          api.get(`/clients/${c.id || c._id}/cases`, { signal: controller.signal })
        )
      );
      const [eventResponse, dashboardResponse] = await Promise.all([
        api.get("/events", { signal: controller.signal }),
        api.get("/dashboard", { signal: controller.signal }),
      ]);
      setClients(nextClients);
      setCases(caseResponses.flatMap((r) => r.data));
      setEvents(eventResponse.data.map(eventForUi));
      setDashboard(dashboardResponse.data);
    } catch (err) {
      if (err.name === "CanceledError" || err.name === "AbortError") return;
      const msg = messageFrom(err);
      setError(msg);
      if (err.response?.status === 401) logout();
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [logout]);

  // Cancel in-flight requests on unmount
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  // ── Initial data load when authenticated ─────────────────
  useEffect(() => {
    if (authChecked && user) {
      load(search, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, user]); // Only re-run when auth status changes

  // ── Debounced search ──────────────────────────────────────
  const searchTimerRef = useRef(null);
  useEffect(() => {
    if (!user) return;
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => { load(search, false); }, 350);
    return () => clearTimeout(searchTimerRef.current);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mutation helper — updates data without page reload ───
  const mutate = useCallback(async (action) => {
    try {
      const result = await action();
      await load(search, false);
      return result;
    } catch (err) {
      const msg = messageFrom(err);
      setError(msg);
      throw err;
    }
  }, [load, search]);

  // ── Client mutations ─────────────────────────────────────
  const onAddClient = useCallback((client) => mutate(() => api.post("/clients", client)), [mutate]);
  const onEditClient = useCallback((id, client) => mutate(() => api.patch(`/clients/${id}`, client)), [mutate]);
  const onDeleteClient = useCallback((id) => mutate(() => api.delete(`/clients/${id}`)), [mutate]);

  // ── Case mutations ───────────────────────────────────────
  const onAddCase = useCallback((clientId, item) => mutate(() => api.post(`/clients/${clientId}/cases`, item)), [mutate]);
  const onEditCase = useCallback((id, item) => mutate(() => api.patch(`/cases/${id}`, item)), [mutate]);

  // ── Document mutations ───────────────────────────────────
  const onUploadDocument = useCallback((caseId, file) => {
    const body = new FormData();
    body.append("file", file);
    return mutate(() => api.post(`/cases/${caseId}/documents`, body));
  }, [mutate]);
  const onDeleteDocument = useCallback((caseId, docId) => {
    return mutate(() => api.delete(`/cases/${caseId}/documents/${docId}`));
  }, [mutate]);

  // ── Task / event mutations ───────────────────────────────
  const onAddTask = useCallback((task) => mutate(() => api.post("/events", { ...task, caseId: task.caseId })), [mutate]);
  const onToggleComplete = useCallback((id, completed) => mutate(() => api.patch(`/events/${id}`, { completed })), [mutate]);
  const onUpdateNote = useCallback((id, note) => mutate(() => api.patch(`/events/${id}/note`, { note })), [mutate]);

  // ── On-authenticated callback from Login ─────────────────
  const handleAuthenticated = useCallback((userData) => {
    setUser(userData);
    setAuthChecked(true);
  }, []);

  // ── Memo ─────────────────────────────────────────────────
  const casesForUi = useMemo(() =>
    cases.map((item) => ({
      ...item,
      id: item.id || item._id,
      clientId: item.client?.id || item.client?._id || item.client,
    })),
    [cases]
  );

  // ── Render: initializing ─────────────────────────────────
  if (!authChecked || authLoading) {
    return (
      <div className="app-init-screen" aria-live="polite" aria-label="Loading CaseMate">
        <div className="app-init-spinner" aria-hidden="true" />
        <p>Loading CaseMate…</p>
        <button
          type="button"
          className="app-init-skip-btn"
          onClick={() => {
            localStorage.removeItem(TOKEN_KEY);
            setAuthChecked(true);
            setAuthLoading(false);
          }}
        >
          Continue to Sign In
        </button>
      </div>
    );
  }

  // ── Render: not authenticated ────────────────────────────
  if (!user) {
    return <Login onAuthenticated={handleAuthenticated} />;
  }

  // ── Render: main app ──────────────────────────────────────
  return (
    <div className="app-shell">
      <Header
        onMenuClick={() => setDrawerOpen(true)}
        drawerOpen={drawerOpen}
        search={search}
        onSearch={setSearch}
        user={user}
        onLogout={logout}
      />
      <main
        className={`app-main${activeView === "dashboard" ? "" : " app-main--focused"}`}
        id="main-content"
      >
        {error && (
          <p className="app-error" role="alert">
            {error}{" "}
            <button
              type="button"
              className="app-error-retry"
              onClick={() => load(search)}
            >
              Try again
            </button>
          </p>
        )}
        {loading ? (
          <p className="app-status" aria-live="polite">Loading your workspace…</p>
        ) : (
          <>
            {activeView === "dashboard" && (
              <div className="app-content-grid">
                <div className="app-primary-stack">
                  {dashboard && (
                    <section className="dashboard-metrics" aria-label="Summary statistics">
                      <span><strong>{dashboard.activeCases}</strong> Active cases</span>
                      <span><strong>{dashboard.todaysHearings}</strong> Today's hearings</span>
                      <span><strong>{dashboard.upcomingMeetings}</strong> Upcoming meetings</span>
                      <span><strong>{dashboard.pendingTasks}</strong> Pending tasks</span>
                    </section>
                  )}
                  <TodayList
                    events={events}
                    cases={casesForUi}
                    onToggleComplete={onToggleComplete}
                    onUpdateNote={onUpdateNote}
                    onAddTask={onAddTask}
                    onGoToClients={() => setActiveView("clients")}
                  />
                  <MonthCalendar items={events} />
                </div>
                <ClientList
                  clients={clients}
                  cases={casesForUi}
                  onAddClient={onAddClient}
                  onEditClient={onEditClient}
                  onDeleteClient={onDeleteClient}
                  onAddCase={onAddCase}
                  onEditCase={onEditCase}
                  onUploadDocument={onUploadDocument}
                  onDeleteDocument={onDeleteDocument}
                />
              </div>
            )}
            {activeView === "today" && (
              <div className="app-focused-card">
                <TodayList
                  events={events}
                  cases={casesForUi}
                  onToggleComplete={onToggleComplete}
                  onUpdateNote={onUpdateNote}
                  onAddTask={onAddTask}
                  onGoToClients={() => setActiveView("clients")}
                  isFocused
                />
              </div>
            )}
            {activeView === "clients" && (
              <div className="app-focused-card">
                <ClientList
                  clients={clients}
                  cases={casesForUi}
                  onAddClient={onAddClient}
                  onEditClient={onEditClient}
                  onDeleteClient={onDeleteClient}
                  onAddCase={onAddCase}
                  onEditCase={onEditCase}
                  onUploadDocument={onUploadDocument}
                  onDeleteDocument={onDeleteDocument}
                  isFocused
                />
              </div>
            )}
          </>
        )}
      </main>
      <Drawer
        isOpen={drawerOpen}
        activeView={activeView}
        onNavigate={setActiveView}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
