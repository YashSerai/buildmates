import React from 'react';
import {
  AbsoluteFill,
  Img,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import {FPS, SCENES, type SceneId, type SceneSpec, selectedVariants} from './timing';
import './styles.css';

type Variant = 1 | 2 | 3;

export type BuildmatesFilmProps = {
  variantMap: Record<SceneId, Variant>;
};

export type SceneLabProps = {
  sceneId: SceneId;
  variant: Variant;
};

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const smooth = (value: number) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};
const mix = (from: number, to: number, progress: number) => from + (to - from) * progress;

const paletteByScene: Record<SceneId, 'paper' | 'moss' | 'sage' | 'orange'> = {
  work: 'moss',
  reason: 'paper',
  stale: 'paper',
  codex: 'sage',
  profile: 'paper',
  'profile-ui': 'moss',
  matching: 'paper',
  autopilot: 'orange',
  room: 'moss',
  circles: 'paper',
  pulse: 'sage',
  network: 'moss',
  payoff: 'paper',
  'built-with': 'paper',
  'rough-edges': 'moss',
  qa: 'sage',
  final: 'moss',
};

const Capture: React.FC<{
  src: string;
  className?: string;
  position?: string;
  contain?: boolean;
  root?: 'captures' | 'assets';
}> = ({src, className = '', position = 'top left', contain = false, root = 'captures'}) => (
  <div className={`capture ${className}`}>
    <Img
      src={staticFile(`${root}/${src}`)}
      style={{width: '100%', height: '100%', objectFit: contain ? 'contain' : 'cover', objectPosition: position}}
    />
  </div>
);

const BrandMark: React.FC<{size?: number; inverse?: boolean}> = ({size = 140, inverse = false}) => (
  <svg width={size} height={size * 0.72} viewBox="0 0 180 130" aria-label="Buildmates mark">
    <path d="M28 103V82L88 21l58 59v23" fill="none" stroke={inverse ? '#f5f0e7' : '#142619'} strokeWidth="17" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M58 102V87l31-30 31 30v15" fill="none" stroke="#e96414" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="28" cy="103" r="14" fill="#9eaa82" />
    <circle cx="88" cy="21" r="15" fill={inverse ? '#f5f0e7' : '#142619'} />
    <circle cx="146" cy="103" r="14" fill="#e96414" />
  </svg>
);

const SharedTrace: React.FC<{sceneIndex: number; progress: number}> = ({sceneIndex, progress}) => {
  const y = 820 - (sceneIndex % 4) * 32;
  const endpoint = mix(150, 920, smooth(progress));
  return (
    <svg className="shared-trace" viewBox="0 0 1080 1080" preserveAspectRatio="none">
      <path d={`M100 ${y} C320 ${y - 150}, 650 ${y + 100}, ${endpoint} ${y - 20}`} fill="none" stroke="rgba(233,100,20,.42)" strokeWidth="4" strokeLinecap="round" />
      <circle cx={endpoint} cy={y - 20} r="9" fill="#e96414" />
    </svg>
  );
};

const TransitionCurtain: React.FC<{sceneIndex: number; localFrame: number; duration: number}> = ({
  sceneIndex,
  localFrame,
  duration,
}) => {
  const frames = 12;
  const intro = sceneIndex === 0 ? 0 : smooth((frames - localFrame) / frames);
  const outro = sceneIndex === SCENES.length - 1 ? 0 : smooth((localFrame - (duration - frames)) / frames);
  const progress = Math.max(intro, outro);
  const centers = [
    [930, 830], [160, 790], [880, 220], [190, 200],
  ];
  const [cx, cy] = centers[sceneIndex % centers.length];
  return (
    <div
      className="transition-curtain"
      style={{
        left: cx,
        top: cy,
        width: 96,
        height: 96,
        transform: `translate(-50%, -50%) scale(${mix(0, 24, progress)})`,
        opacity: progress > 0 ? 1 : 0,
      }}
    />
  );
};

const SceneTitle: React.FC<{title: string; label?: string; compact?: boolean}> = ({title, label, compact}) => (
  <div className={`scene-copy ${compact ? 'compact' : ''}`}>
    <h1>{title}</h1>
    {label ? <p>{label}</p> : null}
  </div>
);

const WorkScene: React.FC<{progress: number; variant: Variant}> = ({progress, variant}) => {
  const shed = smooth((progress - 0.36) / 0.42);
  return (
    <div className={`work-word variant-layout-${variant}`}>
      <span className="net" style={{transform: `translate(${mix(0, -180, shed)}px, ${mix(0, 210, shed)}px) rotate(${mix(0, -18, shed)}deg)`, opacity: 1 - shed}}>NET</span>
      <span className="work-core" style={{transform: `scale(${mix(1, 1.18, shed)})`}}>WORK</span>
      <span className="ing" style={{transform: `translate(${mix(0, 190, shed)}px, ${mix(0, 210, shed)}px) rotate(${mix(0, 18, shed)}deg)`, opacity: 1 - shed}}>ING</span>
      <div className="work-caption">At the center of networking is</div>
    </div>
  );
};

const ReasonScene: React.FC<{progress: number; variant: Variant}> = ({progress, variant}) => {
  const connect = smooth((progress - 0.16) / 0.55);
  return (
    <>
      <SceneTitle title="A real reason to talk." label="Two builders. One stubborn problem." />
      <div className={`reason-board variant-layout-${variant}`}>
        <div className="builder-node left"><b>VOICE AGENT</b><span>natural turn-taking</span></div>
        <div className="builder-node right"><b>VOICE AGENT</b><span>less robotic speech</span></div>
        <div className="reason-line" style={{transform: `scaleX(${connect})`}}><span>shared work</span></div>
      </div>
    </>
  );
};

const StaleScene: React.FC<{progress: number; variant: Variant}> = ({progress, variant}) => {
  const drift = smooth(progress);
  const cards = ['launch shipped', 'new benchmark', 'architecture changed', 'profile still says: exploring'];
  return (
    <>
      <SceneTitle title="The work moves. The profile does not." label="Posting every small thing is another job." />
      <div className={`stale-stack variant-layout-${variant}`}>
        {cards.map((text, index) => (
          <div className={`stale-sheet sheet-${index}`} key={text} style={{transform: `translate(${index * 26}px, ${index * 74 - drift * index * 8}px) rotate(${index % 2 ? 1.3 : -0.8}deg)`}}>
            <span>{String(index + 1).padStart(2, '0')}</span><b>{text}</b>
          </div>
        ))}
      </div>
    </>
  );
};

const CodexScene: React.FC<{progress: number; variant: Variant}> = ({progress, variant}) => {
  const steps = ['Buildmates', 'Soulspace', 'After You', 'Safari Gigs'];
  return (
    <>
      <SceneTitle title="Let Codex connect the pieces." label="The context already exists where you build." />
      <div className={`context-orbit variant-layout-${variant}`}>
        {steps.map((step, index) => {
          const angle = (Math.PI * 2 * index) / steps.length + progress * 0.45;
          return <div key={step} className="context-chip" style={{left: 430 + Math.cos(angle) * 270, top: 400 + Math.sin(angle) * 180}}>{step}</div>;
        })}
        <div className="codex-core">&gt;_</div>
      </div>
    </>
  );
};

const ProfileScene: React.FC<{progress: number; variant: Variant; generative?: boolean}> = ({progress, variant, generative}) => {
  const settle = spring({frame: progress * 120, fps: FPS, config: {damping: 18, stiffness: 80}});
  return (
    <>
      <SceneTitle title={generative ? 'One person. A page written around them.' : 'A living profile, built from real work.'} label={generative ? 'Generative UI' : 'Codex builds the first draft'} compact />
      <div className={`profile-showcase variant-layout-${variant}`} style={{transform: `translateY(${mix(28, 0, settle)}px)`}}>
        <Capture src="profile/yashns-desktop-hero.png" className="profile-desktop" position="top left" />
        {generative ? <Capture src="profile/yashns-mobile-hero.png" className="profile-phone" position="top left" /> : null}
      </div>
    </>
  );
};

const MatchingScene: React.FC<{progress: number; variant: Variant}> = ({progress, variant}) => {
  const lock = smooth((progress - 0.2) / 0.55);
  return (
    <>
      <SceneTitle title="The algorithm narrows. Both Codexes decide." label="Mutual relevance, not popularity." compact />
      <div className={`match-evidence variant-layout-${variant}`}>
        <Capture src="introductions/introductions-desktop-viewport.png" className="introductions-capture" position="top left" />
        <div className="match-node yours">Your Codex<strong>{lock > 0.7 ? 'relevant' : 'reviewing'}</strong></div>
        <div className="match-node theirs">Their Codex<strong>{lock > 0.7 ? 'relevant' : 'reviewing'}</strong></div>
        <div className="match-link" style={{transform: `scaleX(${lock})`}} />
      </div>
    </>
  );
};

const AutopilotScene: React.FC<{progress: number; variant: Variant}> = ({progress, variant}) => {
  const turn = mix(-22, 18, smooth(progress));
  return (
    <>
      <SceneTitle title="Review it yourself, or let Codex take the wheel." label="Full Autopilot" />
      <div className={`autopilot-wheel variant-layout-${variant}`} style={{transform: `rotate(${turn}deg)`}}>
        <div className="wheel-ring"><div className="wheel-spoke" /><div className="wheel-spoke second" /><div className="wheel-hub">&gt;_</div></div>
      </div>
    </>
  );
};

const RoomScene: React.FC<{progress: number; variant: Variant}> = ({progress, variant}) => (
  <>
    <SceneTitle title="A chat that can become a tool." label="Generative one-to-one room" compact />
    <div className={`room-stage variant-layout-${variant}`}>
      <Capture src="room/room-focus.png" className="room-capture" position="top left" />
      <Capture src="reliability-runs-concept.png" root="assets" className="tool-concept" position="center" contain />
      <div className="tool-list"><b>Latency timer</b><b>Call-test board</b><b>Interruption tracker</b></div>
    </div>
  </>
);

const CircleScene: React.FC<{progress: number; variant: Variant}> = ({progress, variant}) => (
  <>
    <SceneTitle title="The same idea, expanded to a group." label="Circle: Reliable Agents Lab" compact />
    <div className={`circle-stage variant-layout-${variant}`}>
      <Capture src="circle/reliability-tool-desktop-v102-final.png" className="circle-capture" position="top center" />
      <div className="circle-members"><span>Y</span><span>R</span><span>+</span></div>
      <Capture src="circle/reliability-tool-focus.png" className="circle-tool-capture" position="top left" />
      <div className="circle-tool-label">Real shared tool<br /><b>Reliability Runs</b></div>
    </div>
  </>
);

const PulseScene: React.FC<{progress: number; variant: Variant}> = ({progress, variant}) => {
  const beat = 0.55 + Math.sin(progress * Math.PI * 8) * 0.12;
  return (
    <>
      <SceneTitle title="Work Pulse keeps the network current." label="A Codex automation, on your schedule." compact />
      <div className={`pulse-stage variant-layout-${variant}`}>
        <Capture src="activity/activity-desktop-viewport.png" className="activity-capture" position="top left" />
        <svg className="pulse-line" viewBox="0 0 600 120"><path d="M0 72H120L155 72 180 28 214 100 248 58H340L370 58 395 38 425 78 460 58H600" fill="none" stroke="#e96414" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" style={{opacity: beat}} /></svg>
        <div className="pulse-actions"><span>refresh recent work</span><span>review matches</span><span>follow up</span></div>
      </div>
    </>
  );
};

const NetworkScene: React.FC<{progress: number; variant: Variant}> = ({progress, variant}) => {
  const second = smooth((progress - 0.45) / 0.45);
  return (
    <>
      <SceneTitle title="See where builders are, and where ideas overlap." label="City Map + Build Graph" compact />
      <div className={`network-stage variant-layout-${variant}`}>
      <Capture src="map/map-focus.png" className="map-capture" position="top left" />
      <Capture src="graph/graph-focus.png" className="graph-capture" position="top left" />
        <div className="network-divider" style={{left: `${mix(72, 50, second)}%`}} />
      </div>
    </>
  );
};

const PayoffScene: React.FC<{progress: number; variant: Variant}> = ({progress, variant}) => (
  <div className={`payoff variant-layout-${variant}`}>
    <div className="payoff-thread" style={{transform: `scaleX(${smooth(progress)})`}} />
    <h1>Your work can find someone<br />worth talking to.</h1>
    <div className="payoff-people"><span>Y</span><span>R</span></div>
  </div>
);

const BuiltWithScene: React.FC<{progress: number; variant: Variant}> = ({progress, variant}) => (
  <>
    <SceneTitle title="Built with Codex, for people building with Codex." label="OpenAI Build Week" compact />
    <div className={`built-stage variant-layout-${variant}`}>
      <Capture src="home/home-desktop-viewport.png" className="home-capture" position="top left" />
      <div className="task-excerpt">
        <b>Real Codex task</b>
        <p>In Reliable Agents Lab, add a shared experiment tracker called Reliability Runs.</p>
        <span>Completed: tracker published and 3 experiments saved.</span>
      </div>
    </div>
  </>
);

const RoughEdgesScene: React.FC<{progress: number; variant: Variant}> = ({progress, variant}) => {
  const fixed = progress > 0.6;
  return (
    <>
      <SceneTitle title="Capable does not mean finished." label="RIP my banked resets" compact />
      <div className={`fault-stage variant-layout-${variant} ${fixed ? 'fixed' : ''}`}>
        <div className="fault-copy">moved to the right</div>
        <div className="fault-card one">white on white</div>
        <div className="fault-card two">overlap</div>
        <div className="reset-count">04 <span>resets</span></div>
      </div>
    </>
  );
};

const QaScene: React.FC<{progress: number; variant: Variant}> = ({progress, variant}) => {
  const scan = `${mix(6, 88, smooth(progress))}%`;
  return (
    <>
      <SceneTitle title="Inspect what you built. Then fix it." label="Design skills + screenshot QA" compact />
      <div className={`qa-stage variant-layout-${variant}`}>
        <Capture src="profile/yashns-desktop-hero.png" className="qa-capture" position="top left" />
        <div className="qa-scan" style={{top: scan}} />
        <div className="qa-results"><span>contrast</span><span>overflow</span><span>mobile</span><b>pass</b></div>
      </div>
    </>
  );
};

const FinalScene: React.FC<{progress: number; variant: Variant}> = ({progress, variant}) => (
  <div className={`final-stage variant-layout-${variant}`}>
    <BrandMark size={220} inverse />
    <h1>buildmates</h1>
    <p>Meet through the work.</p>
    <div className="final-url">buildmates.yashns.chatgpt.site</div>
  </div>
);

const renderScene = (scene: SceneSpec, progress: number, variant: Variant) => {
  switch (scene.id) {
    case 'work': return <WorkScene progress={progress} variant={variant} />;
    case 'reason': return <ReasonScene progress={progress} variant={variant} />;
    case 'stale': return <StaleScene progress={progress} variant={variant} />;
    case 'codex': return <CodexScene progress={progress} variant={variant} />;
    case 'profile': return <ProfileScene progress={progress} variant={variant} />;
    case 'profile-ui': return <ProfileScene progress={progress} variant={variant} generative />;
    case 'matching': return <MatchingScene progress={progress} variant={variant} />;
    case 'autopilot': return <AutopilotScene progress={progress} variant={variant} />;
    case 'room': return <RoomScene progress={progress} variant={variant} />;
    case 'circles': return <CircleScene progress={progress} variant={variant} />;
    case 'pulse': return <PulseScene progress={progress} variant={variant} />;
    case 'network': return <NetworkScene progress={progress} variant={variant} />;
    case 'payoff': return <PayoffScene progress={progress} variant={variant} />;
    case 'built-with': return <BuiltWithScene progress={progress} variant={variant} />;
    case 'rough-edges': return <RoughEdgesScene progress={progress} variant={variant} />;
    case 'qa': return <QaScene progress={progress} variant={variant} />;
    case 'final': return <FinalScene progress={progress} variant={variant} />;
  }
};

const Scene: React.FC<{scene: SceneSpec; sceneIndex: number; variant: Variant}> = ({scene, sceneIndex, variant}) => {
  const localFrame = useCurrentFrame();
  const duration = scene.seconds * FPS;
  const progress = clamp(localFrame / Math.max(1, duration - 1));
  return (
    <AbsoluteFill className={`stage palette-${paletteByScene[scene.id]} scene-${scene.id} variant-${variant}`}>
      <div className="paper-grain" />
      <div className="safe-zone" />
      {renderScene(scene, progress, variant)}
      <SharedTrace sceneIndex={sceneIndex} progress={progress} />
      <TransitionCurtain sceneIndex={sceneIndex} localFrame={localFrame} duration={duration} />
    </AbsoluteFill>
  );
};

export const BuildmatesFilm: React.FC<BuildmatesFilmProps> = ({variantMap = selectedVariants}) => {
  let start = 0;
  return (
    <AbsoluteFill className="film-root">
      {SCENES.map((scene, sceneIndex) => {
        const from = start;
        const duration = scene.seconds * FPS;
        start += duration;
        return (
          <Sequence key={scene.id} from={from} durationInFrames={duration} premountFor={FPS}>
            <Scene scene={scene} sceneIndex={sceneIndex} variant={variantMap[scene.id] ?? 1} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

export const SceneLab: React.FC<SceneLabProps> = ({sceneId, variant}) => {
  const scene = SCENES.find((item) => item.id === sceneId) ?? SCENES[0];
  const sceneIndex = SCENES.indexOf(scene);
  return <Scene scene={scene} sceneIndex={sceneIndex} variant={variant} />;
};
