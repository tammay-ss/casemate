import { useState, useRef, useEffect, useCallback } from "react";
import api from "../api/client";
import "./ClientList.css";

const EMPTY_CLIENT = { name: "", phone: "", email: "", address: "" };
const EMPTY_CASE = { title: "", matter: "", caseNumber: "", status: "active", notes: "" };

// ── Validation helpers ──────────────────────────────────────
export const normalizePhone = (v) => (v || "").replace(/\D/g, "");
export const normalizeEmail = (e) => (e || "").trim().toLowerCase();
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateClient(draft, clients = [], editingId = null) {
  const errors = {};
  const nameTrim = (draft.name || "").trim();
  if (!nameTrim) {
    errors.name = "Client name is required.";
  }

  // Phone validation & uniqueness (required field)
  const rawPhone = (draft.phone || "").trim();
  if (!rawPhone) {
    errors.phone = "Phone number is required.";
  } else if (/[a-zA-Z]/.test(rawPhone)) {
    errors.phone = "Phone number cannot contain letters.";
  } else {
    const digits = normalizePhone(rawPhone);
    if (digits.length !== 10) {
      errors.phone = "Phone number must contain exactly 10 digits.";
    } else {
      const duplicatePhone = clients.find((c) => {
        const cId = c.id || c._id;
        if (editingId && cId === editingId) return false;
        return normalizePhone(c.phone) === digits;
      });
      if (duplicatePhone) {
        errors.phone = "A client with this phone number already exists.";
      }
    }
  }

  // Email validation & uniqueness (optional field)
  const emailTrim = (draft.email || "").trim();
  if (emailTrim) {
    const emailNorm = normalizeEmail(emailTrim);
    if (!EMAIL_RE.test(emailNorm)) {
      errors.email = "Please enter a valid email address (e.g. name@example.com).";
    } else {
      const duplicateEmail = clients.find((c) => {
        const cId = c.id || c._id;
        if (editingId && cId === editingId) return false;
        return normalizeEmail(c.emailNormalized || c.email) === emailNorm;
      });
      if (duplicateEmail) {
        errors.email = "A client with this email address already exists.";
      }
    }
  }

  return errors;
}

function validateCase(draft) {
  const errors = {};
  if (!draft.title.trim()) errors.title = "Case title is required.";
  return errors;
}

// ── Document upload & management panel ───────────────────────
function DocumentUpload({ caseId, onUpload, onDelete }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [documents, setDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const inputRef = useRef(null);

  const MAX_MB = 15;
  const ALLOWED_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "image/jpeg",
    "image/png",
  ];
  const ALLOWED_EXTS = [".pdf", ".docx", ".doc", ".jpeg", ".jpg", ".png"];
  const ALLOWED_LABEL = "PDF, DOCX, DOC, JPG, or PNG (up to 15 MB)";

  const fetchDocs = useCallback(async () => {
    if (!caseId) return;
    setLoadingDocs(true);
    try {
      const res = await api.get(`/cases/${caseId}/documents`);
      setDocuments(res.data || []);
    } catch {
      // Ignore background fetch error
    } finally {
      setLoadingDocs(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const handleFile = (e) => {
    const selected = e.target.files?.[0];
    setUploadMsg("");
    setUploadError("");
    if (!selected) { setFile(null); return; }

    const ext = "." + (selected.name.split(".").pop() || "").toLowerCase();
    const isAllowed = ALLOWED_TYPES.includes(selected.type) || ALLOWED_EXTS.includes(ext);

    if (!isAllowed) {
      setUploadError(`Unsupported file type. Please upload: ${ALLOWED_LABEL}`);
      setFile(null);
      e.target.value = "";
      return;
    }
    if (selected.size > MAX_MB * 1024 * 1024) {
      setUploadError(`File is too large (${(selected.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed size is ${MAX_MB} MB.`);
      setFile(null);
      e.target.value = "";
      return;
    }
    setFile(selected);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setUploadMsg("");
    setUploadError("");
    try {
      await onUpload(caseId, file);
      setUploadMsg(`"${file.name}" uploaded successfully.`);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      await fetchDocs();
    } catch (err) {
      setUploadError(
        err?.response?.data?.message ||
        (err?.code === "ECONNABORTED" ? "Upload timed out. Please try again." : "Upload failed. Please try again.")
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDoc = async (docId, docName) => {
    if (!window.confirm(`Delete document "${docName}"?\n\nThis action cannot be undone.`)) return;
    setDeletingId(docId);
    try {
      if (onDelete) await onDelete(caseId, docId);
      else await api.delete(`/cases/${caseId}/documents/${docId}`);
      setDocuments((prev) => prev.filter((d) => (d.id || d._id) !== docId));
      setUploadMsg(`"${docName}" deleted.`);
    } catch {
      setUploadError("Could not delete document. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="doc-upload">
      <p className="doc-upload-label">Case documents & attachments</p>

      {/* Existing documents list */}
      <div className="doc-list-section">
        <h4 className="doc-list-heading">Uploaded documents ({documents.length})</h4>
        {loadingDocs ? (
          <p className="doc-status-text">Loading documents…</p>
        ) : documents.length === 0 ? (
          <p className="doc-empty-text">No documents uploaded for this case yet.</p>
        ) : (
          <ul className="doc-items-list" aria-label="Case documents">
            {documents.map((doc) => {
              const docId = doc.id || doc._id;
              const sizeKb = doc.size ? `${(doc.size / 1024).toFixed(0)} KB` : "";
              const dateStr = doc.createdAt
                ? new Date(doc.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                : "";
              return (
                <li key={docId} className="doc-item">
                  <div className="doc-item-info">
                    <span className="doc-item-name" title={doc.name}>{doc.name}</span>
                    <span className="doc-item-meta">{sizeKb}{sizeKb && dateStr ? " • " : ""}{dateStr}</span>
                  </div>
                  <div className="doc-item-actions">
                    {doc.url && (
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="doc-action-link"
                        title={`View ${doc.name}`}
                      >
                        Open
                      </a>
                    )}
                    <button
                      type="button"
                      className="doc-delete-btn"
                      disabled={deletingId === docId}
                      onClick={() => handleDeleteDoc(docId, doc.name)}
                      aria-label={`Delete ${doc.name}`}
                    >
                      {deletingId === docId ? "…" : "Delete"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Upload new file form */}
      <div className="doc-upload-controls">
        <label className="doc-upload-input-wrap">
          <span className="sr-only">Select a file to upload</span>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,image/png,image/jpeg"
            className="doc-upload-input"
            onChange={handleFile}
            disabled={uploading}
            aria-describedby={uploadError ? "upload-err" : undefined}
          />
        </label>
        <span className="doc-upload-hint">Supported formats: {ALLOWED_LABEL}</span>

        {file && (
          <p className="doc-upload-selected">
            Selected: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(0)} KB)
          </p>
        )}

        {uploadError && (
          <p className="doc-upload-error" id="upload-err" role="alert">{uploadError}</p>
        )}
        {uploadMsg && (
          <p className="doc-upload-success" role="status">{uploadMsg}</p>
        )}

        {file && (
          <button
            type="button"
            className="btn-primary doc-upload-btn"
            onClick={handleUpload}
            disabled={uploading}
            aria-busy={uploading}
          >
            {uploading ? (
              <><span className="btn-spinner" aria-hidden="true" /> Uploading…</>
            ) : "Upload document"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────
export default function ClientList({
  clients, cases, onAddClient, onEditClient, onDeleteClient,
  onAddCase, onEditCase, onUploadDocument, onDeleteDocument, isFocused = false,
}) {
  const [draft, setDraft] = useState(EMPTY_CLIENT);
  const [clientErrors, setClientErrors] = useState({});
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [caseClient, setCaseClient] = useState(null);
  const [caseDraft, setCaseDraft] = useState(EMPTY_CASE);
  const [caseErrors, setCaseErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [clientMsg, setClientMsg] = useState("");

  // ── Client form ────────────────────────────────────────────
  const submitClient = async (e) => {
    e.preventDefault();
    const errors = validateClient(draft, clients, editing);
    setClientErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    setClientMsg("");
    try {
      if (editing) {
        await onEditClient(editing, draft);
        setClientMsg("Client updated successfully.");
      } else {
        await onAddClient(draft);
        setClientMsg("Client added successfully.");
      }
      setDraft(EMPTY_CLIENT);
      setEditing(null);
      setShowForm(false);
      setClientErrors({});
    } catch (err) {
      // Map server field errors back to inline messages
      const serverMsg = err?.response?.data?.message || "";
      const field = err?.response?.data?.field;
      if (field) {
        setClientErrors((prev) => ({ ...prev, [field]: serverMsg }));
      } else {
        setClientErrors({ _form: serverMsg || "Could not save client. Please try again." });
      }
    } finally {
      setSaving(false);
    }
  };

  const cancelClient = () => {
    setDraft(EMPTY_CLIENT);
    setEditing(null);
    setShowForm(false);
    setClientErrors({});
    setClientMsg("");
  };

  // Validate on blur
  const blurClient = (field) => {
    const errors = validateClient(draft, clients, editing);
    setClientErrors((prev) => ({ ...prev, [field]: errors[field] }));
  };

  // ── Case form ──────────────────────────────────────────────
  const submitCase = async (e) => {
    e.preventDefault();
    const errors = validateCase(caseDraft);
    setCaseErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      if (caseDraft.id) await onEditCase(caseDraft.id, caseDraft);
      else await onAddCase(caseClient, caseDraft);
      setCaseClient(null);
      setCaseDraft(EMPTY_CASE);
      setCaseErrors({});
    } catch (err) {
      const serverMsg = err?.response?.data?.message || "Could not save case. Please try again.";
      const field = err?.response?.data?.field;
      if (field) setCaseErrors((prev) => ({ ...prev, [field]: serverMsg }));
      else setCaseErrors({ _form: serverMsg });
    } finally {
      setSaving(false);
    }
  };

  const cancelCase = () => {
    setCaseClient(null);
    setCaseDraft(EMPTY_CASE);
    setCaseErrors({});
  };

  const openEdit = (client) => {
    setDraft({
      name: client.name,
      phone: client.phone,
      email: client.email || "",
      address: client.address || "",
    });
    setEditing(client.id || client._id);
    setClientErrors({});
    setClientMsg("");
    setShowForm(true);
  };

  const confirmDelete = (client) => {
    const clientId = client.id || client._id;
    if (window.confirm(
      `Delete "${client.name}" and all of their cases and documents?\n\nThis action cannot be undone.`
    )) {
      onDeleteClient(clientId).catch(() => {});
    }
  };

  return (
    <aside
      className={`client-panel${isFocused ? " client-panel--focused" : ""}`}
      id="clients-panel"
      aria-labelledby="clients-heading"
    >
      {/* ── Panel header ──────────────────────────────────── */}
      <div className="client-panel-header">
        <h2 id="clients-heading">Clients</h2>
        <span className="client-panel-meta">{clients.length} client{clients.length !== 1 ? "s" : ""}</span>
      </div>
      <p className="client-panel-lede">
        Each client can hold multiple independent legal cases.
      </p>

      {clientMsg && <p className="client-success-msg" role="status">{clientMsg}</p>}

      {/* ── Add / Edit client form ────────────────────────── */}
      {!showForm ? (
        <button
          type="button"
          className="btn-add-inline"
          onClick={() => { setDraft(EMPTY_CLIENT); setEditing(null); setShowForm(true); setClientMsg(""); }}
        >
          + Add client
        </button>
      ) : (
        <form className="client-form" onSubmit={submitClient} noValidate>
          <h3 className="form-heading">{editing ? "Edit client" : "New client"}</h3>

          {clientErrors._form && (
            <p className="form-banner-error" role="alert">{clientErrors._form}</p>
          )}

          <div className="form-field">
            <label htmlFor="cf-name">Full name <span aria-hidden="true" className="required-star">*</span></label>
            <input
              id="cf-name"
              required
              placeholder="e.g. Rajesh Mehta"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              onBlur={() => blurClient("name")}
              aria-invalid={!!clientErrors.name}
              aria-describedby={clientErrors.name ? "cf-name-err" : undefined}
            />
            {clientErrors.name && <span id="cf-name-err" className="field-error">{clientErrors.name}</span>}
          </div>

          <div className="form-field">
            <label htmlFor="cf-phone">Phone number <span aria-hidden="true" className="required-star">*</span></label>
            <input
              id="cf-phone"
              type="tel"
              required
              placeholder="10-digit mobile number"
              value={draft.phone}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              onBlur={() => blurClient("phone")}
              aria-invalid={!!clientErrors.phone}
              aria-describedby={clientErrors.phone ? "cf-phone-err" : undefined}
            />
            {clientErrors.phone && <span id="cf-phone-err" className="field-error">{clientErrors.phone}</span>}
          </div>

          <div className="form-field">
            <label htmlFor="cf-email">Email address</label>
            <input
              id="cf-email"
              type="email"
              placeholder="e.g. name@example.com"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              onBlur={() => blurClient("email")}
              aria-invalid={!!clientErrors.email}
              aria-describedby={clientErrors.email ? "cf-email-err" : undefined}
            />
            {clientErrors.email && <span id="cf-email-err" className="field-error">{clientErrors.email}</span>}
          </div>

          <div className="form-field">
            <label htmlFor="cf-address">Address</label>
            <input
              id="cf-address"
              placeholder="Street, City, State"
              value={draft.address}
              onChange={(e) => setDraft({ ...draft, address: e.target.value })}
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={saving} aria-busy={saving}>
              {saving ? <><span className="btn-spinner" aria-hidden="true" /> Saving…</> : (editing ? "Save changes" : "Save client")}
            </button>
            <button type="button" className="btn-secondary" onClick={cancelClient} disabled={saving}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ── Add / Edit case form ──────────────────────────── */}
      {caseClient && (
        <form className="client-form case-form" onSubmit={submitCase} noValidate>
          <h3 className="form-heading">{caseDraft.id ? "Edit case" : "Add case"}</h3>

          {caseErrors._form && (
            <p className="form-banner-error" role="alert">{caseErrors._form}</p>
          )}

          <div className="form-field">
            <label htmlFor="case-title">Case title <span aria-hidden="true" className="required-star">*</span></label>
            <input
              id="case-title"
              required
              placeholder="e.g. Mehta v. Kapoor"
              value={caseDraft.title}
              onChange={(e) => setCaseDraft({ ...caseDraft, title: e.target.value })}
              aria-invalid={!!caseErrors.title}
              aria-describedby={caseErrors.title ? "case-title-err" : undefined}
            />
            {caseErrors.title && <span id="case-title-err" className="field-error">{caseErrors.title}</span>}
          </div>

          <div className="form-field">
            <label htmlFor="case-matter">Matter / type</label>
            <input
              id="case-matter"
              placeholder="e.g. Civil – property dispute"
              value={caseDraft.matter}
              onChange={(e) => setCaseDraft({ ...caseDraft, matter: e.target.value })}
            />
          </div>

          <div className="form-field">
            <label htmlFor="case-number">Case number</label>
            <input
              id="case-number"
              placeholder="e.g. 2024/HC/1234"
              value={caseDraft.caseNumber}
              onChange={(e) => setCaseDraft({ ...caseDraft, caseNumber: e.target.value })}
            />
          </div>

          <div className="form-field">
            <label htmlFor="case-status">Status</label>
            <select
              id="case-status"
              value={caseDraft.status}
              onChange={(e) => setCaseDraft({ ...caseDraft, status: e.target.value })}
            >
              <option value="active">Active</option>
              <option value="on-hold">On hold</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="case-notes">Notes</label>
            <textarea
              id="case-notes"
              placeholder="Additional notes about this case…"
              value={caseDraft.notes}
              onChange={(e) => setCaseDraft({ ...caseDraft, notes: e.target.value })}
              rows={3}
            />
          </div>

          {/* Document upload — only available when editing an existing case */}
          {caseDraft.id && (
            <DocumentUpload caseId={caseDraft.id} onUpload={onUploadDocument} onDelete={onDeleteDocument} />
          )}

          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={saving} aria-busy={saving}>
              {saving ? <><span className="btn-spinner" aria-hidden="true" /> Saving…</> : "Save case"}
            </button>
            <button type="button" className="btn-secondary" onClick={cancelCase} disabled={saving}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ── Client list ──────────────────────────────────── */}
      <ul className="client-list" aria-label="Client list">
        {clients.length === 0 && (
          <li className="client-list-empty">
            No clients yet. Add your first client above.
          </li>
        )}
        {clients.map((client) => {
          const clientId = client.id || client._id;
          const clientCases = cases.filter((item) => item.clientId === clientId);
          return (
            <li key={clientId} className="client-item">
              <div className="client-row">
                <span className="client-row-main">
                  <span className="client-name">{client.name}</span>
                  <span className="client-detail-line">{client.phone}</span>
                  {client.email && <span className="client-detail-line">{client.email}</span>}
                  {client.address && <span className="client-detail-line">{client.address}</span>}
                </span>
                <div className="client-actions">
                  <button
                    type="button"
                    className="btn-row-action"
                    onClick={() => openEdit(client)}
                    aria-label={`Edit ${client.name}`}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn-row-action btn-row-action--danger"
                    onClick={() => confirmDelete(client)}
                    aria-label={`Delete ${client.name}`}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Cases for this client */}
              <div className="case-list">
                {clientCases.map((item) => (
                  <div key={item.id} className="case-row">
                    <span className="case-row-info">
                      <span className="case-title">{item.title}</span>
                      {(item.matter || item.status) && (
                        <small className="case-meta">{item.matter || item.status}</small>
                      )}
                      <span className={`case-status-badge case-status-badge--${item.status}`}>
                        {item.status}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="btn-row-action"
                      onClick={() => { setCaseClient(clientId); setCaseDraft({ ...item }); }}
                      aria-label={`Edit case: ${item.title}`}
                    >
                      Edit case
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn-add-case"
                  onClick={() => { setCaseClient(clientId); setCaseDraft(EMPTY_CASE); }}
                >
                  + Add case
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
