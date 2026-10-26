import { useMemo, useState } from "react";
import { toYmd } from "../schedule.js";
import "./TodayList.css";

const EMPTY_TASK = { title: "", date: toYmd(new Date()), time: "09:00", kind: "task", caseId: "", note: "" };
const kindLabel = (kind) =>
  kind === "hearing" ? "Hearing" : kind === "meeting" ? "Meeting" : "Other";

function validateTask(draft) {
  const errors = {};
  if (!draft.title.trim()) errors.title = "Task title is required.";
  if (!draft.caseId) errors.caseId = "Please select a case for this task.";
  if (!draft.date) errors.date = "Date is required.";
  if (!draft.time) errors.time = "Time is required.";
  return errors;
}

export default function TodayList({
  events, cases, onToggleComplete, onUpdateNote, onAddTask, onGoToClients, isFocused = false,
}) {
  const todayYmd = toYmd(new Date());
  const [taskDraft, setTaskDraft] = useState(EMPTY_TASK);
  const [taskErrors, setTaskErrors] = useState({});
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long",
  });

  const todaysEvents = useMemo(
    () => events.filter((ev) => ev.date === todayYmd).sort((a, b) => a.time.localeCompare(b.time)),
    [events, todayYmd]
  );

  const submitTask = async (e) => {
    e.preventDefault();
    const errors = validateTask(taskDraft);
    setTaskErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      await onAddTask(taskDraft);
      setTaskDraft(EMPTY_TASK);
      setShowTaskForm(false);
      setTaskErrors({});
    } catch (err) {
      const msg = err?.response?.data?.message || "Could not save task. Please try again.";
      setTaskErrors({ _form: msg });
    } finally {
      setSaving(false);
    }
  };

  const saveNote = (id, note) => onUpdateNote(id, note);

  const beginTask = () => {
    if (!cases.length) { onGoToClients?.(); return; }
    setShowTaskForm(true);
  };

  const cancelTask = () => {
    setShowTaskForm(false);
    setTaskDraft(EMPTY_TASK);
    setTaskErrors({});
  };

  return (
    <section
      className={`today-list${isFocused ? " today-list--focused" : ""}`}
      id="today-panel"
      aria-labelledby="today-heading"
    >
      <div className="today-list-head">
        <div>
          <h2 id="today-heading">Today</h2>
          <p className="today-date">{today}</p>
        </div>
        <span className="today-count" aria-live="polite">
          {todaysEvents.length} {todaysEvents.length === 1 ? "item" : "items"}
        </span>
      </div>

      {!showTaskForm ? (
        <>
          <button type="button" className="add-inline-btn" onClick={beginTask}>
            + Add task
          </button>
          {!cases.length && (
            <p className="task-guidance" role="status">
              Add a client and case first to schedule a task.
            </p>
          )}
        </>
      ) : (
        <form className="task-form" onSubmit={submitTask} noValidate>
          <h3 className="form-heading">New task</h3>

          {taskErrors._form && (
            <p className="form-banner-error task-form-error" role="alert">{taskErrors._form}</p>
          )}

          {/* Title — full width */}
          <div className="task-field task-field--full">
            <label htmlFor="tf-title">
              Title <span aria-hidden="true" className="required-star">*</span>
            </label>
            <input
              id="tf-title"
              required
              placeholder="e.g. File motion papers"
              value={taskDraft.title}
              onChange={(e) => setTaskDraft({ ...taskDraft, title: e.target.value })}
              aria-invalid={!!taskErrors.title}
              aria-describedby={taskErrors.title ? "tf-title-err" : undefined}
            />
            {taskErrors.title && <span id="tf-title-err" className="field-error">{taskErrors.title}</span>}
          </div>

          {/* Kind + Case */}
          <div className="task-field">
            <label htmlFor="tf-kind">Type</label>
            <select
              id="tf-kind"
              value={taskDraft.kind}
              onChange={(e) => setTaskDraft({ ...taskDraft, kind: e.target.value })}
            >
              <option value="hearing">Hearing</option>
              <option value="meeting">Meeting</option>
              <option value="task">Other</option>
            </select>
          </div>

          <div className="task-field">
            <label htmlFor="tf-case">
              Case <span aria-hidden="true" className="required-star">*</span>
            </label>
            <select
              id="tf-case"
              required
              value={taskDraft.caseId}
              onChange={(e) => setTaskDraft({ ...taskDraft, caseId: e.target.value })}
              aria-invalid={!!taskErrors.caseId}
              aria-describedby={taskErrors.caseId ? "tf-case-err" : undefined}
            >
              <option value="">Select a case…</option>
              {cases.map((item) => (
                <option key={item.id} value={item.id}>{item.title}</option>
              ))}
            </select>
            {taskErrors.caseId && <span id="tf-case-err" className="field-error">{taskErrors.caseId}</span>}
          </div>

          {/* Date + Time */}
          <div className="task-field">
            <label htmlFor="tf-date">
              Date <span aria-hidden="true" className="required-star">*</span>
            </label>
            <input
              id="tf-date"
              required
              type="date"
              value={taskDraft.date}
              onChange={(e) => setTaskDraft({ ...taskDraft, date: e.target.value })}
              aria-invalid={!!taskErrors.date}
            />
            {taskErrors.date && <span className="field-error">{taskErrors.date}</span>}
          </div>

          <div className="task-field">
            <label htmlFor="tf-time">
              Time <span aria-hidden="true" className="required-star">*</span>
            </label>
            <input
              id="tf-time"
              required
              type="time"
              value={taskDraft.time}
              onChange={(e) => setTaskDraft({ ...taskDraft, time: e.target.value })}
              aria-invalid={!!taskErrors.time}
            />
            {taskErrors.time && <span className="field-error">{taskErrors.time}</span>}
          </div>

          {/* Note — full width */}
          <div className="task-field task-field--full">
            <label htmlFor="tf-note">Note <span className="field-optional">(optional)</span></label>
            <input
              id="tf-note"
              placeholder="e.g. High Court – Room 4"
              value={taskDraft.note}
              onChange={(e) => setTaskDraft({ ...taskDraft, note: e.target.value })}
            />
          </div>

          <div className="task-form-actions task-field--full">
            <button
              type="submit"
              className="btn-primary"
              disabled={saving}
              aria-busy={saving}
            >
              {saving
                ? <><span className="btn-spinner" aria-hidden="true" /> Saving…</>
                : "Save task"}
            </button>
            <button type="button" className="btn-secondary" onClick={cancelTask} disabled={saving}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ── Events list ──────────────────────────────────── */}
      <div className="events">
        {todaysEvents.length === 0 ? (
          <p className="today-empty">Nothing on your list for today.</p>
        ) : (
          todaysEvents.map((event) => (
            <div
              key={event.id}
              className={`event ${event.important ? "important" : ""} ${event.completed ? "completed" : ""}`}
            >
              <input
                type="checkbox"
                checked={event.completed}
                onChange={() => onToggleComplete(event.id, !event.completed)}
                aria-label={`Mark "${event.title}" as ${event.completed ? "incomplete" : "complete"}`}
              />
              <span className="time" aria-label={`Time: ${event.time}`}>{event.time}</span>
              <div className="details">
                <div className="event-title-row">
                  <h4>{event.title}</h4>
                  <span className={`event-kind event-kind--${event.kind}`}>
                    {kindLabel(event.kind)}
                  </span>
                </div>
                <div className="event-client">
                  {event.clientName && <span>{event.clientName}</span>}
                  {event.caseName && <span>{event.caseName}</span>}
                  {event.clientPhone && <span>{event.clientPhone}</span>}
                </div>
                <textarea
                  placeholder="Add notes…"
                  defaultValue={event.note}
                  onBlur={(e) => {
                    if (e.target.value !== event.note) saveNote(event.id, e.target.value);
                  }}
                  aria-label={`Notes for ${event.title}`}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
