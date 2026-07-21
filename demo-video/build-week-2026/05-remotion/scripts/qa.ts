import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {SCENES, TOTAL_FRAMES, TOTAL_SECONDS, selectedVariants} from '../src/timing';

const root = path.resolve(import.meta.dirname, '..');
const required = SCENES.flatMap((scene) => scene.screenshot ? [path.join(root, 'public', 'captures', scene.screenshot)] : []);
required.push(path.join(root, 'public', 'assets', 'reliability-runs-concept.png'));

const main = async () => {
  const failures: string[] = [];
  if (TOTAL_SECONDS > 180) failures.push(`Duration ${TOTAL_SECONDS}s exceeds 180s.`);
  if (TOTAL_FRAMES !== TOTAL_SECONDS * 30) failures.push('Frame count does not match the 30 fps timing map.');
  if (new Set(SCENES.map((scene) => scene.id)).size !== SCENES.length) failures.push('Scene ids are not unique.');

  for (const scene of SCENES) {
    const variant = selectedVariants[scene.id];
    if (![1, 2, 3].includes(variant)) failures.push(`${scene.id} has no valid selected variant.`);
  }

  for (const file of required) {
    if (!fs.existsSync(file)) {
      failures.push(`Missing capture: ${path.relative(root, file)}`);
      continue;
    }
    const meta = await sharp(file).metadata();
    if (!meta.width || !meta.height || meta.width < 300 || meta.height < 300) {
      failures.push(`Capture is too small or unreadable: ${path.relative(root, file)}`);
    }
  }

  if (failures.length) {
    console.error(failures.map((failure) => `FAIL: ${failure}`).join('\n'));
    process.exit(1);
  }

  console.log(`PASS: ${SCENES.length} scenes, ${TOTAL_SECONDS}s, ${required.length} real capture assets, three selectable variants per scene.`);
};

void main();
