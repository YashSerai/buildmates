export function setupGuidance(step: string | null) {
  const guidance: Record<string, { goal: string; nextAction: string; fallback?: string }> = {
    identity_link: {
      goal: "Connect this ChatGPT or Codex session to your Buildmates account.",
      nextAction: "Explain the supported sign-in handoff and wait for the user's authorization. Reuse an existing verified account. Never merge by name or email or claim access to Sign in with ChatGPT without confirmed eligibility. Do not launch duplicate authorization attempts.",
      fallback: "If authorization expires, request one new link. Authentication and consent must be completed by the user.",
    },
    storage_explanation: {
      goal: "Review what Buildmates saves.",
      nextAction: "Explain that Buildmates saves the reviewed profile, approved matching summaries, preferences, and shared messages. Private host conversation history and raw connected documents are not uploaded. Ask for acknowledgment before continuing.",
    },
    source_selection: {
      goal: "Choose context for your profile.",
      nextAction: "Offer direct answers, a project description, portfolio links, or sources actually available in this host. In Codex, optionally offer a named project/workspace scope. Explain exactly what will be read and obtain approval before reading it. No connected source or workspace review is required. Use sourceIds [] when no ongoing source is selected.",
      fallback: "Ask what the user is building and whom they want to meet. Do not assume access to other ChatGPT chats, local files, or all installed connectors.",
    },
    context_collection: {
      goal: "Draft a profile from approved context.",
      nextAction: "Use only the approved scope. Summarize current work, interests, and meeting intent. Ask focused questions where facts are missing. Show the draft before saving. Distinguish confirmed facts from uncertain suggestions.",
    },
    signal_privacy_review: {
      goal: "Review matching summaries and source permissions.",
      nextAction: "Show each proposed ongoing Work Signal and its audience. If none are connected, say so and continue with reviewedSignalIds []. Never treat profile approval as permission to read new sources.",
    },
    basic_profile: {
      goal: "Save a reviewed private profile.",
      nextAction: "Present the complete profile and matching permissions. Default to manual acceptance. Explain that publication is optional, published pages are public and indexable, matching fields have their own audience, and a supplied coarse city can contribute to anonymous aggregates unless opted out. Classify approved topics using list_topic_taxonomy. Save only after the user's approval.",
    },
    page_preview: {
      goal: "Choose whether to create a public profile page.",
      nextAction: "Offer to continue privately now or create a generated page. Continuing privately calls complete_setup_step with payload {step: page_preview, choice: later}; no revision is required and nothing is published. If the user chooses a page, use the surface skill, preview it, perform desktop and phone checks, and publish only after explicit approval. Then complete the step with choice publish, approved true, and the published surfaceRevisionId.",
    },
    networking_pulse: {
      goal: "Choose whom you want to meet.",
      nextAction: "Explain the proposed intent, similar/adjacent/balanced work, local/global/balanced geography, weekly introduction cap, quiet hours, serendipity, exclusions, timezone, and expiry. Recommend balanced, global, three introductions per week, and a thirty-day expiry when appropriate. Save the reviewed preferences and the pulse identifier.",
    },
    acceptance_mode: {
      goal: "Choose how introductions are accepted.",
      nextAction: "Recommend Manual: this user's agent reviews a candidate, then the user chooses Interested. Each person's agent evaluates independently and both sides consent. Full Autopilot requires trusted evidence of unattended actions on this host; a successful foreground call alone is insufficient.",
    },
    automation: {
      goal: "Choose whether to use a background Work Pulse.",
      nextAction: "Background tasks are optional. If the user declines or the host has no supported scheduling surface, complete_setup_step with enabled false, cadence manual, and sourceLivenessReviewed true. Otherwise obtain schedule consent and create or update exactly one supported host task before recording its schedule. Recommend Tuesdays and Fridays when suitable. Each run uses approved sources and independent candidate evaluation. After a meaningful two-way conversation, ask how the introduction went; it saves feedback only after the user answers. Any room upgrade requires confirmation and both room members must approve. An unchanged run says nothing changed. Do not record a requested schedule as a running task without evidence.",
      fallback: "Explain how to ask for a refresh in chat. A saved preference is not proof that a host task exists.",
    },
  };
  return step ? guidance[step] ?? { goal: `Complete ${step}.`, nextAction: "Re-read saved signup state and explain the next choice." }
    : { goal: "Signup is complete.", nextAction: "Summarize the private or published profile, introduction preferences, and actual background-task status. Offer to find builders, update a project, or open existing conversations. The account and progress persist across authorized ChatGPT and Codex sessions. Share a public profile URL only if a page is actually published." };
}
