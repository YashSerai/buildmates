import React from 'react';
import {Composition} from 'remotion';
import {BuildmatesFilm, SceneLab, type BuildmatesFilmProps, type SceneLabProps} from './film';
import {FPS, HEIGHT, TOTAL_FRAMES, WIDTH, selectedVariants} from './timing';

const allVariants = (variant: 1 | 2 | 3): BuildmatesFilmProps['variantMap'] =>
  Object.fromEntries(Object.keys(selectedVariants).map((key) => [key, variant])) as BuildmatesFilmProps['variantMap'];

export const Root: React.FC = () => (
  <>
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
