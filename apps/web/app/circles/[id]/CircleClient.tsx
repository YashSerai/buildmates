"use client";

import { FormEvent, useState } from "react";
import { ModuleWorkspace } from "@/components/modules/ModuleWorkspace";
import { useConfirmDialog } from "@/components/discovery/ConfirmDialog";
import { SafetyReportDialog } from "@/components/safety/SafetyReportDialog";
import { SurfaceRenderer } from "@/components/surfaces/SurfaceRenderer";
import type {
  CircleDetail,
  CircleMessage,
  CircleModuleEntry,
} from "@/src/circles/service";
import { userFacingError } from "@/src/client/user-facing-error";
import styles from "./circle.module.css";

export function CircleClient({
  initialCircle,
  initialMessages,
  initialEntries,
}: {
  initialCircle: CircleDetail;
  initialMessages: CircleMessage[];
  initialEntries: CircleModuleEntry[];
}) {
  const [circle, setCircle] = useState(initialCircle);
  const [messages, setMessages] = useState(initialMessages);
  const [entries, setEntries] = useState(initialEntries);
  const [message, setMessage] = useState("");
  const [chatBody, setChatBody] = useState("");
  const [proposalKind, setProposalKind] = useState("module");
  const [busy, setBusy] = useState(false);
  const { confirm, confirmationDialog } = useConfirmDialog();

  async function command(body: Record<string, unknown>, success?: string) {
    setMessage("");
    setBusy(true);
    try {
      const response = await fetch(
        `/api/circles/${encodeURIComponent(circle.id)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setMessage(
          userFacingError(data.error, "That change could not be saved."),
        );
        return false;
      }
      const refresh = await fetch(
        `/api/circles/${encodeURIComponent(circle.id)}`,
        { cache: "no-store" },
      );
      if (refresh.ok) {
        const data = (await refresh.json()) as {
          circle: CircleDetail;
          messages: CircleMessage[];
          entries: CircleModuleEntry[];
        };
        setCircle(data.circle);
        setMessages(data.messages);
        setEntries(data.entries);
      }
      if (success) setMessage(success);
      return true;
    } catch {
      setMessage(
        "Buildmates could not reach the server. Check your connection and try again.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (
      await command(
        { action: "invite", handle: data.get("handle") },
        "Circle invitation sent.",
      )
    )
      form.reset();
  }

  async function propose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const kind = String(data.get("kind"));
    let payload: Record<string, unknown>;
    if (kind === "module")
      payload = {
        kind: data.get("moduleKind"),
        config: { title: data.get("title") },
      };
    else if (kind === "rules")
      payload = {
        moduleId: data.get("moduleId"),
        rules: {
          title: data.get("title"),
          description: data.get("description"),
        },
      };
    else return;
    if (
      await command(
        { action: "propose", kind, payload },
        "Proposal submitted for member review.",
      )
    )
      form.reset();
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    const body = chatBody.trim();
    if (
      body &&
      (await command({
        action: "send_message",
        clientMessageId: crypto.randomUUID(),
        body,
      }))
    )
      setChatBody("");
  }

  const activeMemberCount = circle.members.filter(
    (member) => member.status === "active",
  ).length;
  const invitedMemberCount = circle.members.filter(
    (member) => member.status === "invited",
  ).length;

  if (circle.membershipStatus === "invited")
    return (
      <section className={styles.invitation}>
        <p className={styles.invitationContext}>Invitation to {circle.name}</p>
        <h2>Join this Circle?</h2>
        <p className={styles.invitationPurpose}>
          <strong>Purpose:</strong> {circle.purpose}
        </p>
        <p>
          You can review its purpose before deciding. Joining shares only your
          membership and what you choose to post here. Your private Work Signals
          remain private.
        </p>
        <div>
          <button
            disabled={busy}
            onClick={() =>
              void command(
                { action: "respond_invite", accept: true },
                "You joined the Circle.",
              )
            }
          >
            Join Circle
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void command(
                { action: "respond_invite", accept: false },
                "Invitation declined.",
              )
            }
          >
            Decline
          </button>
          <SafetyReportDialog
            targetKind="circle"
            targetId={circle.id}
            targetLabel={circle.name}
            triggerLabel="Report Circle"
            onSubmitted={() =>
              setMessage(
                "Private report submitted. Review its status in Settings > Safety.",
              )
            }
          />
        </div>
        <p role="status">{message}</p>
      </section>
    );
  if (circle.status !== "active")
    return (
      <section className={styles.invitation}>
        <h2>
          {circle.status === "proposed"
            ? "Waiting for everyone to opt in"
            : "This Circle did not open"}
        </h2>
        <p>
          {circle.status === "proposed"
            ? "The member list, chat, and shared tools stay closed until every invited builder accepts."
            : "An invited builder declined, or the Circle was closed. Your one-to-one Connections are unchanged."}
        </p>
        <a href="/circles">Return to Circles</a>
      </section>
    );

  const admin = circle.role === "owner" || circle.role === "admin";
  const ruleModules = circle.modules.filter(
    (module) =>
      module.active &&
      ["experiment_tracker", "milestone_tracker", "scoreboard"].includes(
        module.kind,
      ),
  );
  const circleDesignPrompt = `Redesign my Buildmates Circle ${circle.id}. Keep the design grounded in the Circle's purpose. Create a private preview under its existing approval rules, but do not publish it.`;
  const surfaceBindings = {
    "circle.name": circle.name,
    "circle.purpose": circle.purpose,
    "circle.members": circle.members.map((member) => ({
      label: member.displayName,
      value: roleLabel(member.role),
    })),
    "circle.modules": circle.modules
      .filter((module) => module.active)
      .map((module) => ({
        label: String(module.config.title ?? sharedToolLabel(module.kind)),
        value: sharedToolLabel(module.kind),
      })),
    "circle.metrics": [],
  };
  return (
    <div className={styles.layout} aria-busy={busy}>
      {confirmationDialog}
      <section className={styles.chatPanel}>
        <div className={styles.heading}>
          <h2>Circle chat</h2>
          <span>Visible only to active members</span>
        </div>
        <div className={styles.chatLog} aria-live="polite">
          {messages.length ? (
            messages.map((item) => (
              <article
                key={item.id}
                className={item.mine ? styles.mine : undefined}
              >
                <strong>{item.mine ? "You" : item.senderName}</strong>
                <p>{item.body}</p>
                <time
                  suppressHydrationWarning
                  dateTime={new Date(item.createdAt).toISOString()}
                >
                  {new Date(item.createdAt).toLocaleString("en-US")}
                </time>
              </article>
            ))
          ) : (
            <p className={styles.empty}>
              Start with the thread that brought this Circle together.
            </p>
          )}
        </div>
        <form className={styles.chatComposer} onSubmit={send}>
          <label>
            Message the Circle
            <textarea
              value={chatBody}
              onChange={(event) => setChatBody(event.target.value)}
              rows={3}
              maxLength={4000}
            />
          </label>
          <button disabled={busy || !chatBody.trim()}>
            {busy ? "Sending..." : "Send"}
          </button>
        </form>
      </section>
      <details className={styles.disclosure}>
        <summary>
          <span>Members and administration</span>
          <small>
            {activeMemberCount} joined
            {invitedMemberCount ? ` / ${invitedMemberCount} invited` : ""}
          </small>
        </summary>
        <section className={styles.disclosureBody}>
          <div className={styles.heading}>
            <h2>Members</h2>
            <span>
              {activeMemberCount} joined
              {invitedMemberCount ? ` / ${invitedMemberCount} invited` : ""}
            </span>
          </div>
          <div className={styles.members}>
            {circle.members.map((member) => (
              <article key={member.userId}>
                <span aria-hidden="true">
                  {member.displayName.slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <h3>{member.displayName}</h3>
                  <p>
                    {roleLabel(member.role)} /{" "}
                    {memberStatusLabel(member.status)}
                  </p>
                  {member.userId !== circle.viewerUserId &&
                  admin &&
                  member.status === "active" &&
                  member.role !== "owner" ? (
                    <div className={styles.memberActions}>
                      {circle.role === "owner" &&
                        (member.role === "member" ? (
                          <button
                            disabled={busy}
                            onClick={() =>
                              void command({
                                action: "manage_member",
                                targetUserId: member.userId,
                                memberAction: "promote",
                              })
                            }
                          >
                            Make admin
                          </button>
                        ) : (
                          <button
                            disabled={busy}
                            onClick={() =>
                              void command({
                                action: "manage_member",
                                targetUserId: member.userId,
                                memberAction: "demote",
                              })
                            }
                          >
                            Remove admin
                          </button>
                        ))}
                      {circle.role === "owner" && (
                        <button
                          disabled={busy}
                          onClick={async () => {
                            if (!(await confirm({
                              title: `Make ${member.displayName} the Circle owner?`,
                              description: "They will control membership, roles, and shared Circle settings. You will remain a member.",
                              confirmLabel: "Transfer ownership",
                              tone: "danger",
                            }))) return;
                            void command({
                              action: "manage_member",
                              targetUserId: member.userId,
                              memberAction: "transfer",
                            });
                          }}
                        >
                          Transfer ownership
                        </button>
                      )}
                      <button
                        disabled={busy}
                        onClick={async () => {
                          if (!(await confirm({
                            title: `Remove ${member.displayName}?`,
                            description: "They will lose access to this Circle and its shared conversations and tools.",
                            confirmLabel: "Remove member",
                            tone: "danger",
                          }))) return;
                          void command({
                            action: "manage_member",
                            targetUserId: member.userId,
                            memberAction: "remove",
                          });
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
          {admin && (
            <form className={styles.inlineForm} onSubmit={invite}>
              <label>
                Invite by Buildmates handle
                <input name="handle" placeholder="builder-handle" required />
              </label>
              <button disabled={busy}>Send invitation</button>
            </form>
          )}
          {circle.role !== "owner" && (
            <button
              disabled={busy}
              className={styles.leaveButton}
              onClick={async () => {
                if (!(await confirm({
                  title: "Leave this Circle?",
                  description: "You will lose access to its conversations and shared tools. An admin can invite you again later.",
                  confirmLabel: "Leave Circle",
                  tone: "danger",
                }))) return;
                void command({ action: "leave" });
              }}
            >
              Leave Circle
            </button>
          )}
        </section>
      </details>
      <details className={styles.disclosure}>
        <summary>
          <span>Design and shared-tool proposals</span>
          <small>{openProposalCount(circle.proposals)} awaiting a decision</small>
        </summary>
        <section className={styles.disclosureBody}>
          <div className={styles.heading}>
            <h2>Proposed changes</h2>
            <span>
              {circle.governanceMode === "vote"
                ? "Members decide by majority vote"
                : "Admins publish approved changes"}
            </span>
          </div>
          <div className={styles.designLead}>
            <div>
              <a
                href={`codex://open?prompt=${encodeURIComponent(circleDesignPrompt)}`}
              >
                Design this Circle with Codex
              </a>
              <button
                type="button"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(circleDesignPrompt)
                    .then(() => setMessage("Codex design prompt copied."))
                    .catch(() =>
                      setMessage(
                        "Copy was blocked. Select the prompt and copy it manually.",
                      ),
                    )
                }
              >
                Copy Codex prompt
              </button>
            </div>
            <p>
              Codex creates a private preview. The Circle&apos;s existing
              approval rules still decide whether it is published.
            </p>
          </div>
          <form className={styles.proposalForm} onSubmit={propose}>
            <label>
              Change type
              <select
                name="kind"
                value={proposalKind}
                onChange={(event) => setProposalKind(event.target.value)}
              >
                <option value="module">Add a shared tool</option>
                {ruleModules.length ? (
                  <option value="rules">
                    Change tracker or scoreboard rules
                  </option>
                ) : null}
              </select>
            </label>
            {proposalKind === "module" && (
              <label>
                Shared tool
                <select name="moduleKind">
                  <option value="resource_shelf">Resource shelf</option>
                  <option value="experiment_tracker">Experiment tracker</option>
                  <option value="decision_log">Decision log</option>
                  <option value="feedback_queue">Feedback queue</option>
                  <option value="milestone_tracker">Milestone tracker</option>
                  <option value="scoreboard">Scoreboard</option>
                </select>
              </label>
            )}
            {proposalKind === "rules" && (
              <>
                <label>
                  Tracker or scoreboard
                  <select name="moduleId" required>
                    {ruleModules.map((module) => (
                      <option value={module.id} key={module.id}>
                        {String(
                          module.config.title ?? sharedToolLabel(module.kind),
                        )}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Describe the new rules
                  <textarea name="description" maxLength={1000} required />
                </label>
              </>
            )}
            <label>
              Proposal title
              <input name="title" maxLength={120} required />
            </label>
            <button disabled={busy}>
              {busy ? "Submitting..." : "Submit proposal"}
            </button>
          </form>
          {!ruleModules.length ? (
            <p>Add a tracker or scoreboard before changing its rules.</p>
          ) : null}
          {circle.proposals.length ? (
            <div className={styles.proposals}>
              {circle.proposals.map((proposal) => (
                <article key={proposal.id}>
                  <div>
                    <p>{proposalKindLabel(proposal.kind)}</p>
                    <h3>{proposalTitle(proposal.payload)}</h3>
                    <span>{proposalStatusLabel(proposal.status)}</span>
                    {proposal.previewSpec && (
                      <SurfaceRenderer
                        spec={proposal.previewSpec}
                        bindings={surfaceBindings}
                      />
                    )}
                  </div>
                  <div>
                    {circle.governanceMode === "vote" &&
                      proposal.status === "voting" && (
                        <>
                          <button
                            disabled={busy}
                            onClick={() =>
                              void command(
                                {
                                  action: "vote",
                                  proposalId: proposal.id,
                                  vote: "approve",
                                },
                                "Approval recorded.",
                              )
                            }
                          >
                            Approve
                          </button>
                          <button
                            disabled={busy}
                            onClick={() =>
                              void command(
                                {
                                  action: "vote",
                                  proposalId: proposal.id,
                                  vote: "reject",
                                },
                                "Rejection recorded.",
                              )
                            }
                          >
                            Reject
                          </button>
                        </>
                      )}
                    {proposal.canPublish ? (
                      <button
                        disabled={busy}
                        onClick={() =>
                          void command(
                            { action: "publish", proposalId: proposal.id },
                            "Approved change published to the Circle.",
                          )
                        }
                      >
                        Publish approved change
                      </button>
                    ) : proposal.status === "approved" ? (
                      <p className={styles.notice}>
                        Approved, waiting for an admin.
                      </p>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className={styles.empty}>
              No changes proposed. Keep the Circle simple until members need
              another tool or rule.
            </p>
          )}
        </section>
      </details>
      <details className={styles.disclosure}>
        <summary>
          <span>Active shared tools</span>
          <small>
            {circle.modules.filter((module) => module.active).length} active
          </small>
        </summary>
        <section className={styles.disclosureBody}>
          <div className={styles.heading}>
            <h2>Active shared tools</h2>
            <span>Available to active members</span>
          </div>
          {circle.modules.some((module) => module.active) ? (
            <ModuleWorkspace
              modules={circle.modules.filter((module) => module.active)}
              entries={entries}
              viewerUserId={circle.viewerUserId}
              canModerate={admin}
              onCreate={(moduleId, payload) =>
                command(
                  { action: "add_entry", moduleId, payload },
                  "Entry added.",
                )
              }
              onUpdate={(moduleId, entryId, payload) =>
                command(
                  { action: "update_entry", moduleId, entryId, payload },
                  "Entry updated.",
                )
              }
              onDelete={(moduleId, entryId) =>
                command(
                  { action: "delete_entry", moduleId, entryId },
                  "Entry deleted.",
                )
              }
            />
          ) : (
            <p className={styles.empty}>
              No shared tools are active. Members can propose one when the
              conversation needs more structure.
            </p>
          )}
        </section>
      </details>
      <footer className={styles.safety}>
        <SafetyReportDialog
          targetKind="circle"
          targetId={circle.id}
          targetLabel={circle.name}
          triggerLabel="Report Circle"
          onSubmitted={() =>
            setMessage(
              "Private report submitted. Review its status in Settings > Safety.",
            )
          }
        />
      </footer>
      <p className={styles.notice} role="status">
        {message}
      </p>
    </div>
  );
}

function roleLabel(value: string) {
  return (
    (
      { owner: "Owner", admin: "Admin", member: "Member" } as Record<
        string,
        string
      >
    )[value] ?? "Member"
  );
}
function memberStatusLabel(value: string) {
  return (
    (
      {
        active: "Joined",
        invited: "Invited",
        left: "Left",
        declined: "Declined",
        removed: "Removed",
      } as Record<string, string>
    )[value] ?? "Unavailable"
  );
}
function proposalKindLabel(value: string) {
  return (
    (
      {
        module: "Shared tool",
        design: "Circle design",
        rules: "Tool rules",
      } as Record<string, string>
    )[value] ?? "Member proposal"
  );
}
function proposalTitle(payload: Record<string, unknown>) {
  const config = payload.config && typeof payload.config === "object"
    ? payload.config as Record<string, unknown>
    : null;
  return String(payload.title ?? config?.title ?? payload.summary ?? "Member proposal");
}
function proposalStatusLabel(value: string) {
  return (
    (
      {
        proposed: "Awaiting review",
        voting: "Voting open",
        approved: "Approved",
        rejected: "Not approved",
        published: "Published",
      } as Record<string, string>
    )[value] ?? "Under review"
  );
}
function openProposalCount(proposals: CircleDetail["proposals"]) {
  return proposals.filter((proposal) =>
    ["proposed", "voting", "approved"].includes(proposal.status),
  ).length;
}
function sharedToolLabel(value: string) {
  return (
    (
      {
        resource_shelf: "Resource shelf",
        experiment_tracker: "Experiment tracker",
        decision_log: "Decision log",
        feedback_queue: "Feedback queue",
        milestone_tracker: "Milestone tracker",
        scoreboard: "Scoreboard",
      } as Record<string, string>
    )[value] ?? "Shared tool"
  );
}
