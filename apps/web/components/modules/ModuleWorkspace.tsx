"use client";

import { FormEvent, useState } from "react";
import styles from "./ModuleWorkspace.module.css";

type Module = { id: string; kind: string; config?: Record<string, unknown> };
type Entry = {
  id: string;
  moduleId: string;
  authorUserId: string;
  authorName: string;
  payload: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
};
type Field = {
  key: string;
  label: string;
  type?: "url" | "date" | "select" | "textarea";
  options?: readonly string[];
};

const MODULE_FIELDS: Record<
  string,
  { label: string; primary: string; fields: readonly Field[] }
> = {
  resource_shelf: {
    label: "Resource shelf",
    primary: "title",
    fields: [
      { key: "title", label: "Resource title" },
      { key: "url", label: "Link", type: "url" },
      { key: "note", label: "Why it matters", type: "textarea" },
    ],
  },
  experiment_tracker: {
    label: "Experiment tracker",
    primary: "title",
    fields: [
      { key: "title", label: "Experiment" },
      { key: "hypothesis", label: "Hypothesis", type: "textarea" },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: ["planned", "running", "complete"],
      },
      { key: "outcome", label: "Outcome", type: "textarea" },
    ],
  },
  decision_log: {
    label: "Decision log",
    primary: "decision",
    fields: [
      { key: "decision", label: "Decision" },
      { key: "rationale", label: "Reasoning", type: "textarea" },
    ],
  },
  feedback_queue: {
    label: "Feedback queue",
    primary: "feedback",
    fields: [
      { key: "feedback", label: "Feedback", type: "textarea" },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: ["open", "in review", "resolved"],
      },
    ],
  },
  milestone_tracker: {
    label: "Milestone tracker",
    primary: "milestone",
    fields: [
      { key: "milestone", label: "Milestone" },
      { key: "dueDate", label: "Target date", type: "date" },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: ["planned", "in progress", "done"],
      },
    ],
  },
  scoreboard: {
    label: "Scoreboard",
    primary: "label",
    fields: [
      { key: "label", label: "Measure" },
      { key: "value", label: "Value" },
      { key: "note", label: "Evidence or note", type: "textarea" },
    ],
  },
};

export function ModuleWorkspace({
  modules,
  entries,
  viewerUserId,
  canModerate = false,
  onCreate,
  onUpdate,
  onDelete,
}: {
  modules: Module[];
  entries: Entry[];
  viewerUserId: string;
  canModerate?: boolean;
  onCreate: (
    moduleId: string,
    payload: Record<string, string>,
  ) => Promise<boolean>;
  onUpdate: (
    moduleId: string,
    entryId: string,
    payload: Record<string, string>,
  ) => Promise<boolean>;
  onDelete: (moduleId: string, entryId: string) => Promise<boolean>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className={styles.workspace}>
      {modules.map((module) => {
        const definition = MODULE_FIELDS[module.kind];
        if (!definition) return null;
        const moduleEntries = entries.filter(
          (entry) => entry.moduleId === module.id,
        );
        return (
          <article className={styles.module} key={module.id}>
            <header className={styles.moduleHeader}>
              <h3>{String(module.config?.title ?? definition.label)}</h3>
              <p>{definition.label}</p>
            </header>
            <div className={styles.entries}>
              {moduleEntries.length ? (
                moduleEntries.map((entry) => (
                  <div className={styles.entry} key={entry.id}>
                    {editingId === entry.id ? (
                      <EntryForm
                        definition={definition}
                        initial={entry.payload}
                        submitLabel="Save changes"
                        onSubmit={async (payload) => {
                          const saved = await onUpdate(
                            module.id,
                            entry.id,
                            payload,
                          );
                          if (saved) setEditingId(null);
                          return saved;
                        }}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <>
                        <h4>
                          {String(entry.payload[definition.primary] ?? "Entry")}
                        </h4>
                        <dl>
                          {definition.fields
                            .filter(
                              (field) =>
                                field.key !== definition.primary &&
                                entry.payload[field.key],
                            )
                            .map((field) => (
                              <div key={field.key}>
                                <dt>{field.label}</dt>
                                <dd>
                                  {field.type === "url" ? (
                                    <a
                                      href={String(entry.payload[field.key])}
                                      rel="noreferrer"
                                      target="_blank"
                                    >
                                      {String(entry.payload[field.key])}
                                    </a>
                                  ) : (
                                    String(entry.payload[field.key])
                                  )}
                                </dd>
                              </div>
                            ))}
                        </dl>
                        <div className={styles.entryActions}>
                          <small>
                            {entry.authorUserId === viewerUserId
                              ? "You"
                              : entry.authorName}{" "}
                            /{" "}
                            {new Date(entry.updatedAt).toLocaleDateString(
                              "en-US",
                            )}
                          </small>
                          {entry.authorUserId === viewerUserId && (
                            <button
                              type="button"
                              onClick={() => setEditingId(entry.id)}
                            >
                              Edit
                            </button>
                          )}
                          {(entry.authorUserId === viewerUserId ||
                            canModerate) && (
                            <button
                              type="button"
                              onClick={() => void onDelete(module.id, entry.id)}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))
              ) : (
                <p className={styles.empty}>No entries yet.</p>
              )}
            </div>
            <EntryForm
              definition={definition}
              submitLabel="Add entry"
              onSubmit={(payload) => onCreate(module.id, payload)}
            />
          </article>
        );
      })}
    </div>
  );
}

function EntryForm({
  definition,
  initial = {},
  submitLabel,
  onSubmit,
  onCancel,
}: {
  definition: { primary: string; fields: readonly Field[] };
  initial?: Record<string, unknown>;
  submitLabel: string;
  onSubmit: (payload: Record<string, string>) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      definition.fields.map((field) => {
        const value = initial[field.key];
        return [field.key, typeof value === "string" ? value : ""];
      }),
    ),
  );
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = Object.fromEntries(
      Object.entries(values)
        .filter(([, value]) => value.trim())
        .map(([key, value]) => [key, value.trim()]),
    );
    if (await onSubmit(payload))
      setValues(
        Object.fromEntries(definition.fields.map((field) => [field.key, ""])),
      );
  }
  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {definition.fields.map((field) => (
        <label key={field.key}>
          {field.label}
          {field.type === "textarea" ? (
            <textarea
              value={values[field.key] ?? ""}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  [field.key]: event.target.value,
                }))
              }
            />
          ) : field.type === "select" ? (
            <select
              value={values[field.key] ?? ""}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  [field.key]: event.target.value,
                }))
              }
            >
              <option value="">Choose status</option>
              {field.options?.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={field.type ?? "text"}
              value={values[field.key] ?? ""}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  [field.key]: event.target.value,
                }))
              }
              required={field.key === definition.primary}
            />
          )}
        </label>
      ))}
      <button type="submit" disabled={!values[definition.primary]?.trim()}>
        {submitLabel}
      </button>
      {onCancel && (
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      )}
    </form>
  );
}
