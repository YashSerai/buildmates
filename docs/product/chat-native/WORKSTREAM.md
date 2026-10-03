# Chat-native product contract

The user installs Buildmates in a supported host, requests signup, authenticates, reviews a private profile, chooses matching preferences, and returns to the same saved account later. No page publication or background schedule is necessary for signup.

Core operations must be available as authenticated conversational tools: profiles, projects, introduction review and response, connections, room and Circle messages, Circle governance, source permissions, matching pause/resume, activity, privacy export/deletion, and safety. Reuse the existing authoritative services and preserve independent actor evaluation and consent.

Matching permission and public page publication are separate choices. A builder may approve their name and summary for introductions while keeping their generated page unpublished. Unreviewed drafts are ineligible. Private fields and Work Signals retain their own audience and matching permissions; neither consent nor publication changes those permissions implicitly.

Embedded ChatGPT views are a presentation of the same tools and saved server state. They must work without making a second data store or using arbitrary generated scripts. Non-rendering hosts receive usable text and structured results.

Generated profiles and shared spaces retain governed preview, explicit publication approval, version checks, history, and rollback. Host automation is capability-dependent and requires explicit user authorization. A foreground tool call alone does not establish unattended-action capability.

Production gates include complete local tests, adversarial multi-actor checks, desktop/phone interaction, conversational acceptance, real install/authentication where available, honest network data, operating recovery, and a reviewable plugin release package. Actual host and production boundaries must be named in evidence.
