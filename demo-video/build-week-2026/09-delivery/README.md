# Buildmates Build Week delivery

This folder is the morning handoff for the OpenAI Build Week submission.

## Final visual exports

- `../05-remotion/out/buildmates-build-week.mp4`: full-resolution 1080 x 1080 visual master.
- `../05-remotion/out/buildmates-build-week-draft.mp4`: faster 540 x 540 review render.
- `../05-remotion/out/contact-sheet.jpg`: one representative frame from every scene.

The visual master intentionally has no narration baked in. Record the approved script, align it with the cue sheet, then export the upload copy with English audio before submitting to Devpost.

## Script and timing

- `../01-script/locked-script.md`: approved narration and on-screen note.
- `../01-script/voiceover-cue-sheet.md`: 17 timecoded narration sections for the 2:48 edit.
- `../05-remotion/frame-timing-map.md`: exact frames, transitions, and selected variants.

## Editable production

- `../05-remotion`: complete Remotion project.
- `../06-renders/scenes`: seventeen full-resolution, narration-free scene clips.
- `../02-storyboard/production-contract.md`: scene and transition contract.
- `../03-captures/raw`: original product captures organized by feature.
- `../04-assets`: generated visual assets, saved surface bundles, and the real Codex task excerpt.
- `../07-qa`: rendered desktop and phone QA evidence for the generated profile, room, Circle, and shared tracker.

To change one scene without disturbing the complete film, open `BuildmatesSceneLab` in Remotion Studio and select that scene and variant. The master uses the selected variants in `../05-remotion/src/timing.ts`.

## Devpost

- `../08-devpost/submission-draft.md`: humanized submission draft. It is not published.
- `../08-devpost/implementation-difficulties.md`: short implementation-difficulties reference.
- `../08-devpost/rules-checklist.md`: verified submission requirements and remaining human actions.

## Remaining human actions

1. Record the approved narration at the pace in the cue sheet.
2. Mix narration into the full-resolution visual master and confirm the final duration stays below three minutes.
3. Upload the final video publicly to YouTube.
4. Replace the video placeholder in the Devpost draft.
5. Review and publish the Devpost submission.
