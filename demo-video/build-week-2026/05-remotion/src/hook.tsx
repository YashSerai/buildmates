import React from 'react';
import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import './hook.css';

export type HookVariant = 1 | 2 | 3;

export type BuildmatesHookProps = {
  variant: HookVariant;
};

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const phase = (frame: number, start: number, end: number) => clamp((frame - start) / (end - start));
const ease = (value: number) => Easing.inOut(Easing.cubic)(clamp(value));

const Segment: React.FC<{
  children: React.ReactNode;
  className: string;
  style?: React.CSSProperties;
}> = ({children, className, style}) => <span className={className} style={style}>{children}</span>;

const DepthExtraction: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const focus = ease(phase(frame, 38, 86));
  const release = ease(phase(frame, 90, 154));
  const settle = spring({frame: Math.max(0, frame - 112), fps, config: {damping: 18, stiffness: 95, mass: 0.8}});

  return (
    <AbsoluteFill className="hook hook-paper hook-depth">
      <div className="hook-rule hook-rule-top" />
      <div className="hook-kicker" style={{transform: `translateY(${interpolate(focus, [0, 1], [0, -16])}px)`}}>At the center of</div>
      <div className="network-word depth-word">
        <Segment className="outer outer-left" style={{
          transform: `translate3d(${interpolate(release, [0, 1], [0, -520])}px, ${interpolate(release, [0, 1], [0, 190])}px, 0) rotate(${interpolate(release, [0, 1], [0, -13])}deg) scale(${interpolate(release, [0, 1], [1, 0.72])})`,
          opacity: 1 - release,
          filter: `blur(${interpolate(release, [0, 1], [0, 9])}px)`,
        }}>NET</Segment>
        <Segment className="work work-depth" style={{
          transform: `scale(${interpolate(focus, [0, 1], [1, 1.03]) + settle * 0.27})`,
          color: focus > 0.45 ? '#f6f1e8' : '#15261a',
        }}>WORK</Segment>
        <Segment className="outer outer-right" style={{
          transform: `translate3d(${interpolate(release, [0, 1], [0, 540])}px, ${interpolate(release, [0, 1], [0, 190])}px, 0) rotate(${interpolate(release, [0, 1], [0, 13])}deg) scale(${interpolate(release, [0, 1], [1, 0.72])})`,
          opacity: 1 - release,
          filter: `blur(${interpolate(release, [0, 1], [0, 9])}px)`,
        }}>ING</Segment>
        <div className="work-field" style={{transform: `scaleX(${interpolate(focus, [0, 1], [0.08, 1])})`, opacity: focus}} />
      </div>
      <div className="hook-rule hook-rule-bottom" />
    </AbsoluteFill>
  );
};

const GravityCut: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const mark = ease(phase(frame, 30, 78));
  const drop = ease(phase(frame, 86, 150));
  const lock = spring({frame: Math.max(0, frame - 108), fps, config: {damping: 13, stiffness: 110, mass: 0.65}});

  return (
    <AbsoluteFill className="hook hook-forest hook-gravity">
      <div className="gravity-index">01 / CENTER</div>
      <div className="gravity-copy">At the center of networking is</div>
      <div className="network-word gravity-word">
        <Segment className="outer gravity-outer" style={{transform: `translateY(${interpolate(drop, [0, 1], [0, 610])}px) rotate(${interpolate(drop, [0, 1], [0, -21])}deg)`, opacity: 1 - drop}}>NET</Segment>
        <Segment className="work gravity-work" style={{transform: `translateY(${interpolate(lock, [0, 1], [0, -34])}px) scale(${interpolate(lock, [0, 1], [1, 1.24])})`}}>WORK</Segment>
        <Segment className="outer gravity-outer" style={{transform: `translateY(${interpolate(drop, [0, 1], [0, 610])}px) rotate(${interpolate(drop, [0, 1], [0, 21])}deg)`, opacity: 1 - drop}}>ING</Segment>
      </div>
      <div className="gravity-bracket" style={{transform: `scaleX(${mark})`}}>
        <span />
        <span />
      </div>
      <div className="gravity-floor" />
    </AbsoluteFill>
  );
};

const nodePositions = [
  [-640, -250], [-520, 270], [-735, 120],
  [650, -260], [540, 275], [735, 105],
] as const;

const NodeDissolve: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const focus = ease(phase(frame, 30, 82));
  const scatter = ease(phase(frame, 82, 148));
  const lock = spring({frame: Math.max(0, frame - 108), fps, config: {damping: 16, stiffness: 92}});

  return (
    <AbsoluteFill className="hook hook-sage hook-nodes">
      <div className="node-kicker">At the center of</div>
      <div className="network-word node-word">
        <Segment className="outer node-outer" style={{opacity: 1 - scatter, transform: `translateX(${interpolate(scatter, [0, 1], [0, -220])}px)`}}>NET</Segment>
        <Segment className="work node-work" style={{transform: `scale(${interpolate(lock, [0, 1], [1, 1.28])})`}}>WORK</Segment>
        <Segment className="outer node-outer" style={{opacity: 1 - scatter, transform: `translateX(${interpolate(scatter, [0, 1], [0, 220])}px)`}}>ING</Segment>
      </div>
      <div className="node-aperture" style={{transform: `translate(-50%, -50%) scale(${interpolate(focus, [0, 1], [1.48, 0.64]) + lock * 0.05})`}} />
      {nodePositions.map(([x, y], index) => (
        <span
          className={`dissolve-node dissolve-node-${index}`}
          key={`${x}-${y}`}
          style={{
            opacity: scatter,
            transform: `translate(${interpolate(scatter, [0, 1], [index < 3 ? -170 : 170, x])}px, ${interpolate(scatter, [0, 1], [0, y])}px) scale(${interpolate(scatter, [0, 1], [0.35, 1])})`,
          }}
        />
      ))}
      <div className="node-caption" style={{opacity: scatter}}>Work is what connects the network.</div>
    </AbsoluteFill>
  );
};

export const BuildmatesHook: React.FC<BuildmatesHookProps> = ({variant}) => {
  if (variant === 2) return <GravityCut />;
  if (variant === 3) return <NodeDissolve />;
  return <DepthExtraction />;
};
