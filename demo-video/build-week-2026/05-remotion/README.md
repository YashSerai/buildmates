# Buildmates Build Week film

An editable 1080×1080, 30 fps Remotion production for the OpenAI Build Week demo. The selected master is 168 seconds, leaving twelve seconds under the three-minute limit.

## Preview and render

```powershell
npm install
npm run preview
npm run typecheck
npm run qa
npm run still
npm run render:fast
npm run render
```

The selected master is `BuildmatesBuildWeek`. Three full-film alternates expose the scene iterations:

- `BuildmatesIterationA`: story-first, restrained compositions.
- `BuildmatesIterationB`: editorial, evidence-forward compositions.
- `BuildmatesIterationC`: kinetic, signature-shape compositions.
- `BuildmatesSceneLab`: inspect one scene and select variant 1, 2, or 3 through input props.

Each scene has its own selected variant in `src/timing.ts`. This keeps iteration local: changing one scene never forces a full-film redesign.

## Transition grammar

The Soulspace benchmark used a visible object to carry the cut. Buildmates keeps that grammar but uses an original orange network endpoint. At every scene boundary the endpoint expands into a full-frame circular wipe, changes the underlying product state, then resolves back into the next network object. The orange trace remains present across the film so a scene never feels like a disconnected slide.

## Capture policy

Everything under `public/captures` is copied from `03-captures/raw` or the generated-surface QA evidence. The composition never invents product controls. Replace a capture in place to update the edit without touching scene code.

## Final assembly

The editable visual master has no finished narration. Record the approved script against the supplied cue sheet before the Devpost upload. Primary content stays inside a 54 px square safe frame. For a later vertical crop, keep the selected profile, room, Circle, map, and graph evidence centered before export.
