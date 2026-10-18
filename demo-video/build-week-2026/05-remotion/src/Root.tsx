import React from 'react';
import {Composition} from 'remotion';
import {BuildmatesFilm, SceneLab, type BuildmatesFilmProps, type SceneLabProps} from './film';
import {BuildmatesHook, type BuildmatesHookProps} from './hook';
import {FPS, HEIGHT, TOTAL_FRAMES, WIDTH, selectedVariants} from './timing';

const allVariants = (variant: 1 | 2 | 3): BuildmatesFilmProps['variantMap'] =>
  Object.fromEntries(Object.keys(selectedVariants).map((key) => [key, variant])) as BuildmatesFilmProps['variantMap'];

export const Root: React.FC = () => (
  <>
    {([1, 2, 3] as const).map((variant) => (
      <Composition
        key={variant}
        id={`BuildmatesHook${variant}`}
        component={BuildmatesHook as React.FC<BuildmatesHookProps>}
        durationInFrames={6 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{variant}}
      />
    ))}
    <Composition
      id="BuildmatesBuildWeek"
      component={BuildmatesFilm}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{variantMap: selectedVariants}}
    />
    <Composition
      id="BuildmatesIterationA"
      component={BuildmatesFilm}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{variantMap: allVariants(1)}}
    />
    <Composition
      id="BuildmatesIterationB"
      component={BuildmatesFilm}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{variantMap: allVariants(2)}}
    />
    <Composition
      id="BuildmatesIterationC"
      component={BuildmatesFilm}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{variantMap: allVariants(3)}}
    />
    <Composition
      id="BuildmatesSceneLab"
      component={SceneLab as React.FC<SceneLabProps>}
      durationInFrames={13 * FPS}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{sceneId: 'profile-ui', variant: 3}}
    />
  </>
);
