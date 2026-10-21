import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError, delJson, getJson, patchJson, postJson } from '../api/client';
import './mission-drafts.css';

/**
 * Mission drafts — CRUD card for the /api/mission-drafts routes in
 * src/server.ts. The server stores title/objective/scope/constraints/
 * urgency/opsecPreference and fills defaults for everything a POST omits;
 * this card edits the two text fields (title + objective) and lets the
 * server default the rest. The list refreshes after every mutation; there
 * is no polling. Rate-limited or failed responses surface as a message and
 * are never retried automatically.
 */

/** MissionDraft from src/server.ts — only the fields the UI reads. */
interface MissionDraft {
  id: string;
  title: string;
  objective: string;
}

/** GET /api/mission-drafts → { drafts: MissionDraft[] } */
interface MissionDraftsResponse {
  drafts: MissionDraft[];
}

/** DELETE /api/mission-drafts/:id → { success: boolean } (always HTTP 200). */
interface MissionDraftDeleteResponse {
  success: boolean;
}

// HTTP status + the server's plain error string; network failures keep the
// fetch-layer message. Error bodies on these routes carry no token content.
function toErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return err.status > 0 ? `HTTP ${err.status}: ${err.message}` : err.message;
  }
  return err instanceof Error ? err.message : 'Request failed';
}

export default function MissionDrafts() {
  const [drafts, setDrafts] = useState<MissionDraft[] | null>(null);
  const [title, setTitle] = useState('');
  const [objective, setObjective] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const titleId = useId();
  const objectiveId = useId();
  const headingId = useId();

  const loadDrafts = async () => {
    try {
      const data = await getJson<MissionDraftsResponse>('/api/mission-drafts');
      setDrafts(data.drafts);
      setError(null);
    } catch (err) {
      setError(toErrorMessage(err));
    }
  };

  useEffect(() => {
    void loadDrafts();
  }, []);

  const startEdit = (draft: MissionDraft) => {
    if (busy) return;
    setEditingId(draft.id);
    setTitle(draft.title);
    setObjective(draft.objective);
    setError(null);
  };

  const cancelEdit = () => {
    if (busy) return;
    setEditingId(null);
    setTitle('');
    setObjective('');
    setError(null);
  };

  // POST for a new draft, PATCH when a row was loaded for editing. The
  // server trims and applies defaults, so no client-side validation here.
  const saveDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setSaving(true);
    setError(null);
    const body = { title: title.trim(), objective: objective.trim() };
    try {
      if (editingId !== null) {
        await patchJson<MissionDraft>(`/api/mission-drafts/${encodeURIComponent(editingId)}`, body);
      } else {
        await postJson<MissionDraft>('/api/mission-drafts', body);
      }
      setTitle('');
      setObjective('');
      setEditingId(null);
      await loadDrafts();
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const removeDraft = async (id: string) => {
    if (deletingId !== null) return;
    setDeletingId(id);
    setError(null);
    try {
      const result = await delJson<MissionDraftDeleteResponse>(
        `/api/mission-drafts/${encodeURIComponent(id)}`,
      );
      if (result.success !== true) {
        setError('Delete failed (HTTP 200: the server reported no deleted draft)');
        return;
      }
      if (editingId === id) {
        setEditingId(null);
        setTitle('');
        setObjective('');
      }
      await loadDrafts();
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  const busy = saving || deletingId !== null;

  return (
    <section className="mission-drafts" aria-labelledby={headingId}>
      <h2 id={headingId} className="md-heading">
        Mission drafts
      </h2>

      {error !== null && (
        <p className="md-alert" role="alert">
          {error}
          {drafts === null && (
            <button type="button" className="md-btn md-btn--sm" onClick={() => void loadDrafts()}>
              Retry
            </button>
          )}
        </p>
      )}

      {drafts === null && error === null && (
        <p className="md-muted" role="status">
          Loading drafts…
        </p>
      )}

      {drafts !== null && drafts.length === 0 && <p className="md-muted">No drafts yet</p>}

      {drafts !== null && drafts.length > 0 && (
        <ul className="md-list">
          {drafts.map((draft) => (
            <li
              key={draft.id}
              className={draft.id === editingId ? 'md-item md-item--editing' : 'md-item'}
            >
              <div className="md-item-main">
                <span className="md-item-title">{draft.title}</span>
                <span className="md-item-objective">{draft.objective}</span>
              </div>
              <div className="md-item-actions">
                <button type="button" className="md-btn" onClick={() => startEdit(draft)} disabled={busy}>
                  Edit
                </button>
                <button
                  type="button"
                  className="md-btn md-btn--danger"
                  onClick={() => void removeDraft(draft.id)}
                  disabled={busy}
                >
                  {deletingId === draft.id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form className="md-form" onSubmit={(event) => void saveDraft(event)}>
        <div className="md-field">
          <label className="md-label" htmlFor={titleId}>
            Title
          </label>
          <input
            id={titleId}
            className="md-input"
            value={title}
            placeholder="Mission title"
            disabled={busy}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <div className="md-field">
          <label className="md-label" htmlFor={objectiveId}>
            Objective
          </label>
          <input
            id={objectiveId}
            className="md-input"
            value={objective}
            placeholder="Mission objective"
            disabled={busy}
            onChange={(event) => setObjective(event.target.value)}
          />
        </div>
        <div className="md-form-actions">
          <button type="submit" className="md-btn md-btn--primary" disabled={busy}>
            {saving ? 'Saving…' : editingId !== null ? 'Save changes' : 'Create draft'}
          </button>
          {editingId !== null && (
            <button type="button" className="md-btn" onClick={cancelEdit} disabled={busy}>
              Cancel edit
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
