import {
  $,
  component$,
  useComputed$,
  useSignal,
  useStore,
  useTask$,
} from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";

/**
 * Data model for a Note
 */
type Note = {
  id: number;
  title: string;
  content: string;
  tags?: string[]; // optional tag list
  updated_at?: string;
  created_at?: string;
};

/**
 * PUBLIC_INTERFACE
 * getApiBase
 * Returns the base URL for the backend API. Uses env (import.meta.env.VITE_NOTES_API_URL) if set,
 * otherwise falls back to the current origin with /api prefix (proxy or same host).
 */
export const getApiBase = () => {
  /** This relies on Vite env variable set by orchestrator at build time.
   * If not set, we default to a relative `/api` path which can be proxied to the backend.
   * Do not hardcode backend host here.
   */
  const configured = (import.meta as any).env?.VITE_NOTES_API_URL as
    | string
    | undefined;
  if (configured && configured.trim().length > 0) return configured;
  return "/api";
};

/**
 * Simple REST client for notes_sqlite_db
 */
const api = {
  // PUBLIC_INTERFACE
  listNotes: async (q?: string): Promise<Note[]> => {
    /**
     * List notes with optional search query.
     */
    const url = new URL(`${getApiBase()}/notes`);
    if (q) url.searchParams.set("q", q);
    const res = await fetch(url.toString(), { headers: { "Content-Type": "application/json" } });
    if (!res.ok) throw new Error(`Failed to list notes: ${res.status}`);
    return (await res.json()) as Note[];
  },
  // PUBLIC_INTERFACE
  getNote: async (id: number): Promise<Note> => {
    /**
     * Get a single note by id.
     */
    const res = await fetch(`${getApiBase()}/notes/${id}`, {
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error(`Failed to get note: ${res.status}`);
    return (await res.json()) as Note;
  },
  // PUBLIC_INTERFACE
  createNote: async (data: Partial<Note>): Promise<Note> => {
    /**
     * Create a note. Expects title/content/tags in body.
     */
    const res = await fetch(`${getApiBase()}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to create note: ${res.status}`);
    return (await res.json()) as Note;
  },
  // PUBLIC_INTERFACE
  updateNote: async (id: number, data: Partial<Note>): Promise<Note> => {
    /**
     * Update a note by id.
     */
    const res = await fetch(`${getApiBase()}/notes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to update note: ${res.status}`);
    return (await res.json()) as Note;
  },
  // PUBLIC_INTERFACE
  deleteNote: async (id: number): Promise<void> => {
    /**
     * Delete a note by id.
     */
    const res = await fetch(`${getApiBase()}/notes/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error(`Failed to delete note: ${res.status}`);
  },
};

type UIState = {
  notes: Note[];
  loading: boolean;
  error?: string;
  selectedId?: number;
  // Editor buffer
  editTitle: string;
  editContent: string;
  editTags: string; // comma-separated
  // Filters
  search: string;
  activeTag?: string;
};

const initialState: UIState = {
  notes: [],
  loading: true,
  error: undefined,
  selectedId: undefined,
  editTitle: "",
  editContent: "",
  editTags: "",
  search: "",
  activeTag: undefined,
};

/**
 * PUBLIC_INTERFACE
 * NotesApp
 * Main UI for the notes application. Provides:
 * - Header (brand, search, New)
 * - Sidebar (tags)
 * - List of notes
 * - Detail editor for selected note
 */
export default component$(() => {
  const state = useStore<UIState>({ ...initialState });
  const saving = useSignal(false);
  const deleting = useSignal(false);

  const refresh = $(async () => {
    state.loading = true;
    state.error = undefined;
    try {
      const notes = await api.listNotes(state.search || undefined);
      state.notes = notes.sort((a, b) => {
        const ad = a.updated_at || a.created_at || "";
        const bd = b.updated_at || b.created_at || "";
        return bd.localeCompare(ad);
      });
      // Maintain selection if present
      if (state.selectedId != null) {
        const exists = state.notes.some((n) => n.id === state.selectedId);
        if (!exists && state.notes.length > 0) state.selectedId = state.notes[0].id;
        if (!exists && state.notes.length === 0) state.selectedId = undefined;
      } else if (state.notes.length > 0) {
        state.selectedId = state.notes[0].id;
      }
      // Load editor buffer for selected
      if (state.selectedId != null) {
        const sel = state.notes.find((n) => n.id === state.selectedId);
        if (sel) {
          state.editTitle = sel.title || "";
          state.editContent = sel.content || "";
          state.editTags = (sel.tags || []).join(", ");
        }
      } else {
        state.editTitle = "";
        state.editContent = "";
        state.editTags = "";
      }
    } catch (e: any) {
      state.error = e?.message ?? "Unknown error";
    } finally {
      state.loading = false;
    }
  });

  useTask$(async () => {
    await refresh();
  });

  const tags = useComputed$(() => {
    const all = new Set<string>();
    for (const n of state.notes) {
      (n.tags ?? []).forEach((t) => all.add(t));
    }
    return Array.from(all).sort((a, b) => a.localeCompare(b));
  });

  const filteredNotes = useComputed$(() => {
    let list = state.notes;
    if (state.activeTag) {
      list = list.filter((n) => (n.tags ?? []).includes(state.activeTag!));
    }
    return list;
  });

  const selectNote = $((id: number) => {
    state.selectedId = id;
    const n = state.notes.find((x) => x.id === id);
    if (n) {
      state.editTitle = n.title || "";
      state.editContent = n.content || "";
      state.editTags = (n.tags || []).join(", ");
    }
  });

  const onCreate = $(async () => {
    saving.value = true;
    try {
      const created = await api.createNote({
        title: "Untitled",
        content: "",
        tags: [],
      });
      await refresh();
      state.selectedId = created.id;
      const n = state.notes.find((x) => x.id === created.id);
      if (n) {
        state.editTitle = n.title || "";
        state.editContent = n.content || "";
        state.editTags = (n.tags || []).join(", ");
      }
    } catch (e) {
      state.error = (e as any)?.message ?? "Failed to create note";
    } finally {
      saving.value = false;
    }
  });

  const onSave = $(async () => {
    if (state.selectedId == null) return;
    saving.value = true;
    try {
      const tags = state.editTags
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      await api.updateNote(state.selectedId, {
        title: state.editTitle,
        content: state.editContent,
        tags,
      });
      await refresh();
    } catch (e) {
      state.error = (e as any)?.message ?? "Failed to save note";
    } finally {
      saving.value = false;
    }
  });

  const onDelete = $(async () => {
    if (state.selectedId == null) return;
    if (!confirm("Delete this note?")) return;
    deleting.value = true;
    try {
      await api.deleteNote(state.selectedId);
      // reset buffer
      state.selectedId = undefined;
      state.editTitle = "";
      state.editContent = "";
      state.editTags = "";
      await refresh();
    } catch (e) {
      state.error = (e as any)?.message ?? "Failed to delete note";
    } finally {
      deleting.value = false;
    }
  });

  const onSearch = $(async () => {
    await refresh();
  });

  const onTagClick = $((t?: string) => {
    state.activeTag = t;
  });

  return (
    <div class="app-root">
      <header class="app-header">
        <div class="brand" title="Notes">
          <span class="brand-dot" />
          <span>Notes</span>
        </div>
        <div class="search-container">
          <input
            class="input"
            type="search"
            placeholder="Search notes…"
            value={state.search}
            onInput$={(e) => (state.search = (e.target as HTMLInputElement).value)}
            onKeyDown$={(e) => {
              if ((e as KeyboardEvent).key === "Enter") onSearch();
            }}
            aria-label="Search notes"
          />
          <button class="btn" onClick$={onSearch} aria-label="Run search">
            Search
          </button>
          <button
            class="btn primary"
            onClick$={onCreate}
            disabled={saving.value}
            aria-label="Create new note"
          >
            + New
          </button>
        </div>
      </header>

      <section class="app-content">
        <aside class="sidebar" aria-label="Tags">
          <div class="section-title">Tags</div>
          <div>
            <button
              class={`pill ${!state.activeTag ? "active" : ""}`}
              onClick$={() => onTagClick(undefined)}
            >
              All
            </button>
            {tags.value.length === 0 && (
              <div class="empty-state">No tags yet</div>
            )}
            {tags.value.map((t) => (
              <button
                key={t}
                class={`pill ${state.activeTag === t ? "active" : ""}`}
                onClick$={() => onTagClick(t)}
              >
                <span class="tag">
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background:
                        "linear-gradient(135deg, var(--color-primary), var(--color-accent))",
                      display: "inline-block",
                    }}
                  />
                  {t}
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section class="list-pane">
          <div class="list-header">
            <div style={{ color: "var(--color-text-light)", fontSize: "0.9rem" }}>
              {state.loading ? "Loading…" : `${filteredNotes.value.length} notes`}
            </div>
            {state.error && (
              <div style={{ color: "#ef4444", fontSize: "0.9rem" }}>
                {state.error}
              </div>
            )}
          </div>

          <div class="notes-list" role="list">
            {!state.loading && filteredNotes.value.length === 0 && (
              <div class="empty-state">No notes found</div>
            )}
            {filteredNotes.value.map((n) => (
              <article
                role="listitem"
                key={n.id}
                class={`note-card ${state.selectedId === n.id ? "active" : ""}`}
                onClick$={() => selectNote(n.id)}
              >
                <h3 class="note-title">
                  {n.title && n.title.trim().length > 0 ? n.title : "Untitled"}
                </h3>
                <div class="note-meta">
                  {n.updated_at
                    ? new Date(n.updated_at).toLocaleString()
                    : n.created_at
                    ? new Date(n.created_at).toLocaleString()
                    : ""}
                </div>
                <div style={{ marginTop: "8px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {(n.tags || []).map((t) => (
                    <span key={t} class="tag">
                      {t}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section class="detail-pane" aria-label="Note editor">
          <div class="detail-toolbar">
            <button
              class="btn accent"
              onClick$={onSave}
              disabled={saving.value || state.selectedId == null}
            >
              Save
            </button>
            <button
              class="btn danger"
              onClick$={onDelete}
              disabled={deleting.value || state.selectedId == null}
            >
              Delete
            </button>
          </div>
          <div class="editor">
            {state.selectedId == null ? (
              <div class="empty-state">Select or create a note to begin.</div>
            ) : (
              <>
                <input
                  class="input title"
                  type="text"
                  placeholder="Title"
                  value={state.editTitle}
                  onInput$={(e) =>
                    (state.editTitle = (e.target as HTMLInputElement).value)
                  }
                />
                <textarea
                  class="textarea"
                  placeholder="Write your note..."
                  value={state.editContent}
                  onInput$={(e) =>
                    (state.editContent = (e.target as HTMLTextAreaElement).value)
                  }
                />
                <input
                  class="input"
                  type="text"
                  placeholder="Tags (comma separated)"
                  value={state.editTags}
                  onInput$={(e) =>
                    (state.editTags = (e.target as HTMLInputElement).value)
                  }
                />
              </>
            )}
          </div>
        </section>
      </section>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Notes",
  meta: [
    {
      name: "description",
      content: "Create, read, update, delete notes with a minimal Qwik UI.",
    },
    {
      name: "theme-color",
      content: "#1976d2",
    },
  ],
};
