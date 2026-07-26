import { useState } from "react";
import api, { messageFrom } from "../api/client";
import "./Login.css";

export default function Login({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const submit = async (event) => { event.preventDefault(); setSaving(true); setError(""); try { const { data } = await api.post(`/auth/${mode === "login" ? "login" : "register"}`, form); sessionStorage.setItem("casemate_token", data.token); onAuthenticated(data.user); } catch (err) { setError(messageFrom(err)); } finally { setSaving(false); } };
  return <main className="login-page"><form className="login-card" onSubmit={submit}><h1>CaseMate</h1><p>{mode === "login" ? "Sign in to your legal workspace." : "Create your secure workspace."}</p>{mode === "register" && <input required placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}<input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /><input required minLength="8" type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />{error && <p className="form-error">{error}</p>}<button disabled={saving}>{saving ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}</button><button type="button" className="secondary-btn" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>{mode === "login" ? "Create an account" : "I already have an account"}</button></form></main>;
}
