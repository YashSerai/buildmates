export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1080;

export type SceneId =
  | 'work'
  | 'reason'
  | 'stale'
  | 'codex'
  | 'profile'
  | 'profile-ui'
  | 'matching'
  | 'autopilot'
  | 'room'
  | 'circles'
  | 'pulse'
  | 'network'
  | 'payoff'
  | 'built-with'
  | 'rough-edges'
  | 'qa'
  | 'final';

export type SceneSpec = {
  id: SceneId;
  title: string;
  seconds: number;
  label?: string;
  screenshot?: string;
  transitionObject: string;
};

export const SCENES: SceneSpec[] = [
  {id: 'work', title: 'At the center of networking is work.', seconds: 7, transitionObject: 'word'},
  {id: 'reason', title: 'Work gives builders a reason to talk.', seconds: 9, transitionObject: 'thread'},
  {id: 'stale', title: 'Profiles cannot keep up with the work.', seconds: 9, transitionObject: 'stack'},
  {id: 'codex', title: 'Let the platform you build with remember.', seconds: 10, transitionObject: 'cursor'},
  {id: 'profile', title: 'Codex connects the pieces.', seconds: 12, label: 'Living profile', screenshot: 'profile/yashns-desktop-hero.png', transitionObject: 'page'},
  {id: 'profile-ui', title: 'The profile is generative UI.', seconds: 10, label: 'Responsive. Personal. Different.', screenshot: 'profile/yashns-desktop-hero.png', transitionObject: 'page'},
  {id: 'matching', title: 'Two independent reviews. One relevant introduction.', seconds: 12, label: 'Your Codex + their Codex', screenshot: 'introductions/introductions-desktop-viewport.png', transitionObject: 'nodes'},
  {id: 'autopilot', title: 'Review it yourself or let Codex take the wheel.', seconds: 7, label: 'Full Autopilot', transitionObject: 'wheel'},
  {id: 'room', title: 'A chat that can become a tool.', seconds: 13, label: 'Generative one-to-one room', screenshot: 'room/agent-reliability-lab-desktop.png', transitionObject: 'room'},
  {id: 'circles', title: 'The same generative UI, expanded to a group.', seconds: 10, label: 'Circles', screenshot: 'circle/reliable-agents-lab-published-desktop.png', transitionObject: 'circle'},
  {id: 'pulse', title: 'Work Pulse keeps the network current.', seconds: 12, label: 'A Codex automation', screenshot: 'activity/activity-desktop-viewport.png', transitionObject: 'pulse'},
  {id: 'network', title: 'See where builders are, and where ideas overlap.', seconds: 11, label: 'City Map + Build Graph', screenshot: 'map/map-desktop-viewport.png', transitionObject: 'bubble'},
  {id: 'payoff', title: 'Your work can find someone worth talking to.', seconds: 7, transitionObject: 'mark'},
  {id: 'built-with', title: 'Built with Codex, for people building with Codex.', seconds: 12, label: 'OpenAI Build Week', screenshot: 'home/home-desktop-viewport.png', transitionObject: 'mark'},
  {id: 'rough-edges', title: 'Capable does not mean finished.', seconds: 10, label: 'Four resets later', transitionObject: 'fault'},
  {id: 'qa', title: 'Design skills and screenshot QA made the difference.', seconds: 8, label: 'Inspect. Fix. Repeat.', transitionObject: 'frame'},
  {id: 'final', title: 'Buildmates', seconds: 9, label: 'Meet through the work.', transitionObject: 'mark'},
];

export const sceneStartFrames = SCENES.reduce<Record<SceneId, number>>((acc, scene, index) => {
  const prior = SCENES.slice(0, index).reduce((sum, item) => sum + item.seconds * FPS, 0);
  acc[scene.id] = prior;
  return acc;
}, {} as Record<SceneId, number>);

export const TOTAL_SECONDS = SCENES.reduce((sum, scene) => sum + scene.seconds, 0);
export const TOTAL_FRAMES = TOTAL_SECONDS * FPS;

export const selectedVariants: Record<SceneId, 1 | 2 | 3> = {
  work: 3,
  reason: 2,
  stale: 1,
  codex: 3,
  profile: 2,
  'profile-ui': 3,
  matching: 3,
  autopilot: 2,
  room: 3,
  circles: 2,
  pulse: 3,
  network: 3,
  payoff: 1,
  'built-with': 2,
  'rough-edges': 3,
  qa: 2,
  final: 3,
};
