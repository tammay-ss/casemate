import "./App.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import Header from "./components/Header.jsx";
import TodayList from "./components/TodayList.jsx";
import MonthCalendar from "./components/MonthCalendar.jsx";
import Drawer from "./components/Drawer.jsx";
import ClientList from "./components/ClientList.jsx";
import Login from "./components/Login.jsx";
import api, { messageFrom } from "./api/client";

function eventForUi(event) {
  return { ...event, id: event.id || event._id, caseId: event.case?.id || event.case?._id || event.case, caseName: event.case?.title || "", clientName: event.case?.client?.name || "", clientPhone: event.case?.client?.phone || "", important: event.kind === "hearing" };
}

export default function App() {
  const [user, setUser] = useState(null); const [drawerOpen, setDrawerOpen] = useState(false); const [activeView, setActiveView] = useState("dashboard");
  const [clients, setClients] = useState([]); const [cases, setCases] = useState([]); const [events, setEvents] = useState([]); const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [search, setSearch] = useState("");
  const authenticated = Boolean(sessionStorage.getItem("casemate_token"));
  const load = useCallback(async (searchValue = search) => {
    if (!authenticated) return; setLoading(true); setError("");
    try { const clientResponse = await api.get("/clients", { params: searchValue ? { search: searchValue } : {} }); const nextClients = clientResponse.data; const caseResponses = await Promise.all(nextClients.map((client) => api.get(`/clients/${client.id || client._id}/cases`))); const [eventResponse, dashboardResponse] = await Promise.all([api.get("/events"), api.get("/dashboard")]); setClients(nextClients); setCases(caseResponses.flatMap((response) => response.data)); setEvents(eventResponse.data.map(eventForUi)); setDashboard(dashboardResponse.data); } catch (err) { setError(messageFrom(err)); if (err.response?.status === 401) { sessionStorage.removeItem("casemate_token"); setUser(null); } } finally { setLoading(false); }
  }, [authenticated, search]);
  useEffect(() => { if (!authenticated) { setLoading(false); return; } api.get("/auth/me").then(({ data }) => setUser(data)).catch(() => sessionStorage.removeItem("casemate_token")); }, [authenticated]);
  useEffect(() => { const timer = setTimeout(() => { if (authenticated) load(search); }, 350); return () => clearTimeout(timer); }, [authenticated, load, search]);
  const mutate = async (action) => { try { await action(); await load(); } catch (err) { setError(messageFrom(err)); throw err; } };
  const onAddClient = (client) => mutate(() => api.post("/clients", client));
  const onEditClient = (id, client) => mutate(() => api.patch(`/clients/${id}`, client));
  const onDeleteClient = (id) => mutate(() => api.delete(`/clients/${id}`));
  const onAddCase = (clientId, item) => mutate(() => api.post(`/clients/${clientId}/cases`, item));
  const onEditCase = (id, item) => mutate(() => api.patch(`/cases/${id}`, item));
  const onUploadDocument = (caseId, file) => { const body = new FormData(); body.append("file", file); return mutate(() => api.post(`/cases/${caseId}/documents`, body)); };
  const onAddTask = (task) => mutate(() => api.post("/events", { ...task, caseId: task.caseId }));
  const onToggleComplete = (id, completed) => mutate(() => api.patch(`/events/${id}`, { completed }));
  const onUpdateNote = (id, note) => mutate(() => api.patch(`/events/${id}/note`, { note }));
  const casesForUi = useMemo(() => cases.map((item) => ({ ...item, id: item.id || item._id, clientId: item.client?.id || item.client?._id || item.client })), [cases]);
  if (!authenticated || !user) return <Login onAuthenticated={setUser} />;
  return <div className="app-shell"><Header onMenuClick={() => setDrawerOpen(true)} drawerOpen={drawerOpen} search={search} onSearch={setSearch} user={user} onLogout={() => { sessionStorage.removeItem("casemate_token"); setUser(null); }} />
    <main className={`app-main${activeView === "dashboard" ? "" : " app-main--focused"}`} id="main-content">
      {error && <p className="app-error" role="alert">{error}</p>}{loading ? <p className="app-status">Loading your workspace…</p> : <>
        {activeView === "dashboard" && <div className="app-content-grid"><div className="app-primary-stack">{dashboard && <section className="dashboard-metrics"><span><strong>{dashboard.activeCases}</strong> Active cases</span><span><strong>{dashboard.todaysHearings}</strong> Today's hearings</span><span><strong>{dashboard.upcomingMeetings}</strong> Upcoming meetings</span><span><strong>{dashboard.pendingTasks}</strong> Pending tasks</span></section>}<TodayList events={events} cases={casesForUi} onToggleComplete={onToggleComplete} onUpdateNote={onUpdateNote} onAddTask={onAddTask} onGoToClients={() => setActiveView("clients")}/><MonthCalendar items={events}/></div><ClientList clients={clients} cases={casesForUi} onAddClient={onAddClient} onEditClient={onEditClient} onDeleteClient={onDeleteClient} onAddCase={onAddCase} onEditCase={onEditCase} onUploadDocument={onUploadDocument}/></div>}
        {activeView === "today" && <div className="app-focused-card"><TodayList events={events} cases={casesForUi} onToggleComplete={onToggleComplete} onUpdateNote={onUpdateNote} onAddTask={onAddTask} onGoToClients={() => setActiveView("clients")} isFocused/></div>}
        {activeView === "clients" && <div className="app-focused-card"><ClientList clients={clients} cases={casesForUi} onAddClient={onAddClient} onEditClient={onEditClient} onDeleteClient={onDeleteClient} onAddCase={onAddCase} onEditCase={onEditCase} onUploadDocument={onUploadDocument} isFocused/></div>}
      </>}</main><Drawer isOpen={drawerOpen} activeView={activeView} onNavigate={setActiveView} onClose={() => setDrawerOpen(false)} /></div>;
}
