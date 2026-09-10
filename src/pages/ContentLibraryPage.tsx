import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { StatusMessage } from "../components/StatusMessage";
import {
  BUILT_IN_CONTENT,
  CONTENT_CATEGORY_LABELS,
  CONTENT_LIBRARY_CATEGORIES,
  contentLibraryTags,
  listUserSnippets,
  searchContentLibrary,
  deleteUserSnippet,
  saveUserSnippet,
  type ContentLibraryCategory,
  type ContentLibraryItem,
  type UserSnippetDraft,
} from "../lib/content-library";

const emptyDraft: UserSnippetDraft = {
  category: "resume_bullet",
  title: "",
  templateText: "",
  tags: [],
  intendedUse: "",
};

export function ContentLibraryPage() {
  const [userSnippets, setUserSnippets] = useState<ContentLibraryItem[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ContentLibraryCategory | "all">("all");
  const [tag, setTag] = useState("all");
  const [draft, setDraft] = useState<UserSnippetDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [pendingDelete, setPendingDelete] = useState<ContentLibraryItem | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      setUserSnippets(await listUserSnippets());
    } catch {
      setError("Saved snippets could not be loaded.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const allItems = useMemo(() => [...BUILT_IN_CONTENT, ...userSnippets], [userSnippets]);
  const tags = useMemo(() => contentLibraryTags(allItems), [allItems]);
  const shownItems = useMemo(
    () => searchContentLibrary(allItems, query, category, tag),
    [allItems, category, query, tag],
  );

  function editSnippet(item: ContentLibraryItem) {
    setEditingId(item.source === "user" ? item.id : undefined);
    setDraft({
      id: item.source === "user" ? item.id : undefined,
      category: item.category,
      title: item.title,
      templateText: item.templateText,
      tags: item.tags,
      intendedUse: item.intendedUse,
    });
    setStatus("Template copied into the snippet editor. Save it explicitly to create a user snippet.");
    setError("");
    document.getElementById("snippet-title")?.focus();
  }

  async function copyItem(item: ContentLibraryItem) {
    try {
      await navigator.clipboard.writeText(item.templateText);
      setStatus(`${item.title} copied. Replace every placeholder with verified facts before use.`);
      setError("");
    } catch {
      setError("This browser could not copy the pattern. Select the text manually instead.");
      setStatus("");
    }
  }

  async function saveSnippet(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const saved = await saveUserSnippet(draft);
      setUserSnippets((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setDraft(emptyDraft);
      setEditingId(undefined);
      setStatus("User snippet saved locally.");
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message === "CONTENT_LIBRARY_REQUIRED"
          ? "Add a title and pattern."
          : "The snippet could not be saved.",
      );
      setStatus("");
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteUserSnippet(pendingDelete.id);
      setUserSnippets((current) => current.filter((item) => item.id !== pendingDelete.id));
      if (editingId === pendingDelete.id) {
        setEditingId(undefined);
        setDraft(emptyDraft);
      }
      setStatus("User snippet deleted locally.");
      setError("");
    } catch {
      setError("The snippet could not be deleted.");
      setStatus("");
    } finally {
      setPendingDelete(null);
    }
  }

  return (
    <section className="workspace-page content-library-page">
      <header className="page-heading">
        <p className="eyebrow">Private writing guidance</p>
        <h1>Content library</h1>
        <p>Keep reusable structures close at hand without turning a template into a claim about your experience.</p>
      </header>
      <StatusMessage message={error} error />
      <StatusMessage message={status} />
      <aside className="content-library-safety" aria-label="Content library safety note">
        <strong>Guidance, not evidence</strong>
        <p>
          Built-in patterns and user snippets are never verified candidate facts. Placeholders stay visible, and Draft,
          Tailor, Cover Letter, and Interview validators remain authoritative.
        </p>
      </aside>

      <section className="content-library-toolbar" aria-labelledby="library-filter-title">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Find a pattern</p>
            <h2 id="library-filter-title">Search the library</h2>
          </div>
          <span className="availability-label">{shownItems.length} shown</span>
        </div>
        <div className="field-grid content-library-filters">
          <label>
            Search
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search patterns or tags"
            />
          </label>
          <label>
            Category
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as ContentLibraryCategory | "all")}
            >
              <option value="all">All categories</option>
              {CONTENT_LIBRARY_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {CONTENT_CATEGORY_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tag
            <select value={tag} onChange={(event) => setTag(event.target.value)}>
              <option value="all">All tags</option>
              {tags.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="content-library-results" aria-labelledby="library-results-title">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Built-in + local</p>
            <h2 id="library-results-title">Reusable patterns</h2>
          </div>
        </div>
        {shownItems.length ? (
          <div className="content-library-grid">
            {shownItems.map((item) => (
              <article className="content-library-item" key={`${item.source}:${item.id}`}>
                <div className="content-library-item-heading">
                  <div>
                    <p className="eyebrow">{item.source === "builtin" ? "Built-in template" : "User snippet"}</p>
                    <h3>{item.title}</h3>
                  </div>
                  <span className="availability-label">{CONTENT_CATEGORY_LABELS[item.category]}</span>
                </div>
                <pre className="content-library-text">{item.templateText}</pre>
                <p className="content-library-use">{item.intendedUse}</p>
                {item.placeholders.length ? (
                  <p className="content-library-placeholders">
                    Placeholders: {item.placeholders.map((placeholder) => `[${placeholder}]`).join(", ")}
                  </p>
                ) : null}
                <div className="content-library-tags" aria-label="Tags">
                  {item.tags.map((value) => (
                    <span key={value}>{value}</span>
                  ))}
                </div>
                <div className="button-row">
                  <button type="button" onClick={() => void copyItem(item)}>
                    Copy pattern
                  </button>
                  <button type="button" onClick={() => editSnippet(item)}>
                    Insert into snippet editor
                  </button>
                  {item.source === "user" && (
                    <button type="button" className="danger" onClick={() => setPendingDelete(item)}>
                      Delete snippet
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-state">No patterns match those filters.</p>
        )}
      </section>

      <section className="content-library-editor" aria-labelledby="snippet-editor-title">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Explicit local save</p>
            <h2 id="snippet-editor-title">{editingId ? "Edit user snippet" : "Create user snippet"}</h2>
          </div>
          {editingId ? <span className="availability-label">Editing local content</span> : null}
        </div>
        <form className="content-library-form" onSubmit={(event) => void saveSnippet(event)}>
          <label>
            Title
            <input
              id="snippet-title"
              value={draft.title}
              maxLength={160}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              required
            />
          </label>
          <label>
            Category
            <select
              value={draft.category}
              onChange={(event) => setDraft({ ...draft, category: event.target.value as ContentLibraryCategory })}
            >
              {CONTENT_LIBRARY_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {CONTENT_CATEGORY_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="wide-field">
            Pattern text
            <textarea
              value={draft.templateText}
              maxLength={4000}
              rows={6}
              onChange={(event) => setDraft({ ...draft, templateText: event.target.value })}
              placeholder="Use [placeholders] for facts you will verify yourself."
              required
            />
          </label>
          <label>
            Tags
            <input
              value={draft.tags.join(", ")}
              onChange={(event) => setDraft({ ...draft, tags: event.target.value.split(",") })}
              placeholder="impact, communication"
            />
          </label>
          <label>
            Intended use
            <input
              value={draft.intendedUse}
              maxLength={300}
              onChange={(event) => setDraft({ ...draft, intendedUse: event.target.value })}
              placeholder="How should this guidance help?"
            />
          </label>
          <div className="button-row">
            <button className="primary" type="submit">
              Save user snippet
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(emptyDraft);
                setEditingId(undefined);
              }}
            >
              Clear editor
            </button>
          </div>
        </form>
      </section>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete user snippet?"
        confirmLabel="Delete snippet"
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      >
        <p>This removes only the selected browser-local snippet. Built-in guidance remains available.</p>
      </ConfirmDialog>
    </section>
  );
}
