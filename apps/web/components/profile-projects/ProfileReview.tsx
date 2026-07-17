"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CANONICAL_CITIES } from "@buildmates/domain";
import { userFacingError } from "../../src/client/user-facing-error";
import styles from "./ProductForms.module.css";
const audiences = [
  "public",
  "signed_in",
  "suggested_connections",
  "mutual_connections",
  "private",
];
const audienceLabels: Readonly<Record<string, string>> = {
  public: "Anyone with the link",
  signed_in: "Signed-in builders",
  suggested_connections: "Builders suggested to you",
  mutual_connections: "Your connections",
  private: "Only you",
  manual: "Ask me before each introduction",
  full_autopilot: "Let Codex accept strong matches for me",
};
function defaultFieldAudience(key: string) {
  return key === "current_work" || key === "networking_intent"
    ? "suggested_connections"
    : "public";
}

export function ProfileReview({
  defaultHandle = "",
  initial,
}: {
  defaultHandle?: string;
  initial?: {
    displayName: string;
    summary: string;
    audience: string;
    acceptanceMode: string;
    coarseLocation: string;
    allowMatching: boolean;
    indexable: boolean;
    locationMapOptIn: boolean;
    fields: Array<{ key: string; value: unknown; audience: string }>;
    statistics: Array<{ label: string; value: string }>;
  };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const initialFields = new Map(
    initial?.fields.map((field) => [field.key, field]),
  );
  async function submit(formData: FormData) {
    setBusy(true);
    setError("");
    const handle = String(formData.get("handle"));
    const fieldNames = [
      "current_work",
      "interests",
      "ambitions",
      "exploring",
      "networking_intent",
    ] as const;
    const fields = fieldNames
      .map((key) => ({
        key,
        value: String(formData.get(key) ?? "").trim(),
        audience: String(
          formData.get(`${key}_audience`) ?? defaultFieldAudience(key),
        ),
      }))
      .filter((field) => field.value);
    const body = {
      handle,
      displayName: String(formData.get("displayName")),
      summary: String(formData.get("summary")),
      audience: String(formData.get("audience")),
      indexable: Boolean(formData.get("indexable")),
      allowMatching: Boolean(formData.get("allowMatching")),
      acceptanceMode: String(formData.get("acceptanceMode")),
      coarseLocation: String(formData.get("coarseLocation") ?? ""),
      locationMapOptIn: Boolean(formData.get("locationMapOptIn")),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      fields,
      statistics: String(formData.get("statistics") ?? "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 12)
        .map((line, index) => {
          const [label, ...value] = line.split("|");
          return {
            key: `custom_${index + 1}`,
            label: label.trim(),
            value: value.join("|").trim(),
            provenance: "self_reported",
            audience: "public",
          };
        })
        .filter((statistic) => statistic.label && statistic.value),
    };
    const response = await fetch(
      `/api/profiles/${encodeURIComponent(handle)}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const data = (await response.json()) as { error?: string; handle: string };
    if (!response.ok) {
      setError(userFacingError(data.error, "Profile could not be saved."));
      setBusy(false);
      return;
    }
    router.push(`/@${data.handle}`);
    router.refresh();
  }
  return (
    <form action={submit} className={styles.form}>
      <header>
        <p className={styles.eyebrow}>Profile review</p>
        <h1>Choose what other builders can know.</h1>
        <p>
          Your profile starts structured so privacy, matching, and generated
          designs stay reliable. You can revise it with Codex later.
        </p>
      </header>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <div className={styles.grid}>
        <Field
          name="displayName"
          label="Display name"
          defaultValue={initial?.displayName}
          required
          maxLength={80}
        />
        <Field
          name="handle"
          label="Profile address"
          defaultValue={defaultHandle}
          required
          pattern="[a-zA-Z0-9_]{3,32}"
        />
        <label className={styles.wide}>
          Short introduction
          <textarea
            name="summary"
            defaultValue={initial?.summary}
            required
            maxLength={600}
            rows={4}
          />
        </label>
        <label>
          City (optional)
          <select
            name="coarseLocation"
            defaultValue={initial?.coarseLocation ?? ""}
          >
            <option value="">Not shared</option>
            {CANONICAL_CITIES.map((city) => (
              <option key={city.id} value={city.label}>
                {city.label}, {city.country}
              </option>
            ))}
          </select>
        </label>
        <Select
          name="audience"
          label="Profile visibility"
          values={audiences}
          defaultValue={initial?.audience}
        />
        <Select
          name="acceptanceMode"
          label="Introduction approval"
          values={["manual", "full_autopilot"]}
          defaultValue={initial?.acceptanceMode}
        />
      </div>
      <h2>About you</h2>
      {[
        ["current_work", "What are you building now?"],
        ["interests", "Interests"],
        ["ambitions", "Ambitions"],
        ["exploring", "What are you exploring?"],
        ["networking_intent", "Who would be interesting to meet?"],
      ].map(([name, label]) => (
        <div className={styles.fieldRow} key={name}>
          <label>
            {label}
            <textarea
              name={name}
              rows={2}
              maxLength={1000}
              defaultValue={String(initialFields.get(name)?.value ?? "")}
            />
          </label>
          <Select
            name={`${name}_audience`}
            label="Who can see this?"
            values={audiences}
            defaultValue={
              initialFields.get(name)?.audience ?? defaultFieldAudience(name)
            }
          />
        </div>
      ))}
      <label className={styles.check}>
        <input
          type="checkbox"
          name="allowMatching"
          defaultChecked={initial?.allowMatching}
        />
        Use approved fields for matching
      </label>
      <label className={styles.wide}>
        Numbers to share
        <span>Add one per line, such as Daily active users | 1,200.</span>
        <textarea
          name="statistics"
          rows={3}
          placeholder={"Daily active users | 1,200\nProjects shipped | 4"}
          defaultValue={initial?.statistics
            .map((item) => `${item.label} | ${item.value}`)
            .join("\n")}
        />
      </label>
      <label className={styles.check}>
        <input
          type="checkbox"
          name="indexable"
          defaultChecked={initial?.indexable}
        />
        Let Google and other search engines show my public profile
      </label>
      <label className={styles.check}>
        <input
          type="checkbox"
          name="locationMapOptIn"
          defaultChecked={initial?.locationMapOptIn}
        />
        Include my city in the community map
      </label>
      <p className={styles.hint}>Uses only the city you add to your profile - never your precise or live location - and appears only in aggregate.</p>
      <button disabled={busy}>
        {busy ? "Saving..." : "Save and view profile"}
      </button>
    </form>
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
            {audienceLabels[value] ?? value.replaceAll("_", " ")}
          </option>
        ))}
      </select>
    </label>
  );
}
