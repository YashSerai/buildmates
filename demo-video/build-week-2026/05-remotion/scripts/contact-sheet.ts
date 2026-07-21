import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {SCENES, sceneStartFrames} from '../src/timing';

const root = path.resolve(import.meta.dirname, '..');
const main = async () => {
  const stillDir = path.join(root, 'out', 'contact-stills');
  const out = path.join(root, 'out', 'contact-sheet.jpg');
  fs.mkdirSync(stillDir, {recursive: true});

  for (const scene of SCENES) {
    const frame = sceneStartFrames[scene.id] + Math.floor(scene.seconds * 30 * 0.55);
    const target = path.join(stillDir, `${scene.id}.png`);
    const cli = path.join(root, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
    execFileSync(process.execPath, [cli, 'still', 'src/index.ts', 'BuildmatesBuildWeek', target, `--frame=${frame}`, '--scale=0.33', '--log=error'], {cwd: root, stdio: 'inherit'});
  }

  const thumbWidth = 356;
  const thumbHeight = 356;
  const columns = 4;
  const rows = Math.ceil(SCENES.length / columns);
  const canvas = sharp({create: {width: thumbWidth * columns, height: thumbHeight * rows, channels: 3, background: '#13251a'}});
  const composites = await Promise.all(SCENES.map(async (scene, index) => ({
    input: await sharp(path.join(stillDir, `${scene.id}.png`)).resize(thumbWidth, thumbHeight, {fit: 'cover'}).jpeg().toBuffer(),
    left: (index % columns) * thumbWidth,
    top: Math.floor(index / columns) * thumbHeight,
  })));
  await canvas.composite(composites).jpeg({quality: 90}).toFile(out);
  console.log(out);
};

void main();
