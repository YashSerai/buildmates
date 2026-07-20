"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ProjectTaxonomyChoices } from "../../src/profile-projects/service";
import { userFacingError } from "../../src/client/user-facing-error";
import styles from "./ProductForms.module.css";

type TaxonomyItem = { kind: "topic" | "tool" | "domain"; id: string };
type InitialProject = {
  title: string;
  summary: string;
  stage: string;
  status: string;
  audience: string;
  allowMatching: boolean;
  links: { label: string; url: string }[];
  taxonomy: TaxonomyItem[];
};
const visibilityLabels: Readonly<Record<string, string>> = {
  public: "Anyone with the link",
  signed_in: "Signed-in builders",
  suggested_connections: "Builders suggested to you",
  mutual_connections: "Your connections",
  private: "Only you",
};

export function ProjectEditor({
  existingSlug,
  initial,
  taxonomyChoices,
  cancelHref,
}: {
  existingSlug?: string;
  initial?: InitialProject;
  taxonomyChoices: ProjectTaxonomyChoices;
  cancelHref: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(formData: FormData) {
    setBusy(true);
    setError("");
    const taxonomy = (["topic", "tool", "domain"] as const).flatMap((kind) =>
      formData
        .getAll(`taxonomy_${kind}`)
        .map((id) => ({ kind, id: String(id) })),
    );
    const body = {
      slug: String(formData.get("slug")),
      title: String(formData.get("title")),
      summary: String(formData.get("summary")),
      stage: String(formData.get("stage")),
      status: String(formData.get("status")),
      audience: String(formData.get("audience")),
      allowMatching: Boolean(formData.get("allowMatching")),
      links: String(formData.get("links") ?? "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [label, ...url] = line.split("|");
          return { label: label.trim(), url: url.join("|").trim() };
        }),
      taxonomy,
    };
    const response = await fetch(
      existingSlug ? `/api/projects/${existingSlug}` : "/api/projects",
      {
        method: existingSlug ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const data = (await response.json()) as { error?: string; slug: string };
    if (!response.ok) {
      setError(userFacingError(data.error, "Project could not be saved."));
      setBusy(false);
      return;
    }
    router.push(`/projects/${data.slug}`);
    router.refresh();
  }
  return (
    <form action={submit} className={styles.form}>
      <header>
        <p className={styles.eyebrow}>
          {existingSlug ? "Edit project" : "New project"}
        </p>
        <h1>Show what you are building.</h1>
        <p>
          Choose who can see this project and whether it helps with
          recommendations. Drafts stay private.
        </p>
      </header>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <div className={styles.grid}>
        <Field
          name="title"
          label="Project name"
          defaultValue={initial?.title}
          required
          maxLength={120}
        />
        <Field
          name="slug"
          label="Public address"
          defaultValue={existingSlug}
          required
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
        />
        <label className={styles.wide}>
          What is it?
          <textarea
            name="summary"
            defaultValue={initial?.summary}
            required
            maxLength={1200}
            rows={6}
          />
        </label>
        <Field
          name="stage"
          label="Current stage"
          defaultValue={initial?.stage ?? "exploring"}
          maxLength={60}
          placeholder="Exploring, prototyping, launched..."
          required
        />
        <Select
          name="status"
          label="Status"
          values={["draft", "active", "archived"]}
          defaultValue={initial?.status}
        />
        <Select
          name="audience"
          label="Visibility"
          values={[
            "public",
            "signed_in",
            "suggested_connections",
            "mutual_connections",
            "private",
          ]}
          defaultValue={initial?.audience}
        />
        <label className={styles.wide}>
          Links <span>one per line: Label | https://example.com</span>
          <textarea
            name="links"
            defaultValue={initial?.links
              .map((link) => `${link.label} | ${link.url}`)
              .join("\n")}
            rows={3}
          />
        </label>
      </div>
      <TaxonomyPicker
        choices={taxonomyChoices}
        selected={initial?.taxonomy ?? []}
      />
      <label className={styles.check}>
        <input
          type="checkbox"
          name="allowMatching"
          defaultChecked={initial?.allowMatching}
        />
        Use this project for matching
      </label>
      <div className={styles.formActions}>
        <button disabled={busy}>{busy ? "Saving..." : "Save project"}</button>
        <Link href={cancelHref}>
          {existingSlug ? "Back to project" : "Back to profile"}
        </Link>
      </div>
    </form>
  );
}
function TaxonomyPicker({
  choices,
  selected,
}: {
  choices: ProjectTaxonomyChoices;
  selected: TaxonomyItem[];
}) {
  const selectedKeys = new Set(
    selected.map((item) => `${item.kind}:${item.id}`),
  );
  return (
    <fieldset>
      <legend>What is this project about?</legend>
      <p>
        Choose the topics and tools that fit. They help with recommendations and
        the Build graph.
      </p>
      {(["topics", "tools", "domains"] as const).map((group) => (
        <div key={group}>
          <strong>{group[0].toUpperCase() + group.slice(1)}</strong>
          {choices[group].length ? (
            choices[group].map((choice) => (
              <label className={styles.check} key={choice.id}>
                <input
                  type="checkbox"
                  name={`taxonomy_${group.slice(0, -1)}`}
                  value={choice.id}
                  defaultChecked={selectedKeys.has(
                    `${group.slice(0, -1)}:${choice.id}`,
                  )}
                />
                {choice.label}
              </label>
            ))
          ) : (
            <p>No {group} are available yet.</p>
          )}
        </div>
      ))}
    </fieldset>
  );
}
function Field(
  props: React.InputHTMLAttributes<HTMLInputElement> & { label: string },
) {
  const { label, ...input } = props;
  return (
    <label>
      {label}
      <input {...input} />
    </label>
  );
}
function Select({
  name,
  label,
  values,
  defaultValue,
}: {
  name: string;
  label: string;
  values: string[];
  defaultValue?: string;
}) {
  return (
    <label>
      {label}
      <select name={name} defaultValue={defaultValue}>
        {values.map((value) => (
          <option key={value} value={value}>
            {selectLabel(value)}
          </option>
        ))}
      </select>
    </label>
  );
}

function selectLabel(value: string) {
  const label = visibilityLabels[value] ?? value.replaceAll("_", " ");
  return label[0]?.toUpperCase() + label.slice(1);
}
