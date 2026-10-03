"use client";
import { useState, useSyncExternalStore } from "react";
import type { FormEvent } from "react";
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
  full_autopilot: "Allow automatic acceptance when my host supports it",
};
const emptySubscribe = () => () => {};
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
    acceptanceMode: string;
    coarseLocation: string;
    allowMatching: boolean;
    locationMapOptIn: boolean;
    fields: Array<{ key: string; value: unknown; audience: string }>;
    statistics: Array<{ label: string; value: string }>;
  };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const hydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const initialFields = new Map(
    initial?.fields.map((field) => [field.key, field]),
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
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
      const parsed: unknown = await response.json().catch(() => ({}));
      const data =
        parsed && typeof parsed === "object"
          ? (parsed as { error?: unknown; handle?: unknown })
          : {};
      if (!response.ok) {
        setError(userFacingError(data.error, "Profile could not be saved."));
        return;
      }
      if (data.handle !== handle.trim().toLowerCase()) {
        setError("Profile save was not confirmed. Refresh and try again.");
        return;
      }
      router.push("/profile/design");
    } catch {
      setError(
        "Buildmates could not reach the server. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      method="post"
      onSubmit={submit}
      className={styles.form}
      data-hydrated={hydrated}
      aria-busy={!hydrated || busy}
    >
      <header>
        <p className={styles.eyebrow}>Profile details</p>
        <h1>Choose what Buildmates can use in your profile.</h1>
        <p>
          These approved details power matching and your custom profile. If you
          allow matching, Buildmates can share your reviewed display name and
          short introduction with suggested builders while your public page
          stays unpublished. Other fields keep their own audience choices.
          After you save them, ChatGPT or Codex can design a private page
          preview for you to review.
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
        Let Buildmates suggest me using my reviewed name and short introduction
      </label>
      <p className={styles.hint}>
        This setting is separate from publishing a public page. Work Signals
        and other profile fields keep their own audience controls.
      </p>
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
          name="locationMapOptIn"
          defaultChecked={initial?.coarseLocation ? initial.locationMapOptIn : true}
        />
        Include this city in anonymous Map totals
      </label>
      <p className={styles.hint}>On by default when you add a city. Buildmates never uses your precise or live location, and the map never identifies you.</p>
      <button type="submit" disabled={!hydrated || busy}>
        {busy ? "Saving..." : "Save and continue to design"}
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
