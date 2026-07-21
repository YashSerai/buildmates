import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..', 'public', 'captures');

const crops = [
  {
    source: path.join(root, 'map', 'map-desktop-viewport.png'),
    target: path.join(root, 'map', 'map-focus.png'),
    left: 0,
    top: 0,
    width: 724,
    height: 506,
  },
  {
    source: path.join(root, 'graph', 'graph-desktop-viewport.png'),
    target: path.join(root, 'graph', 'graph-focus.png'),
    left: 29,
    top: 44,
    width: 663,
    height: 462,
  },
  {
    source: path.join(root, 'room', 'agent-reliability-lab-desktop.png'),
    target: path.join(root, 'room', 'room-focus.png'),
    left: 85,
    top: 0,
    width: 650,
    height: 641,
  },
  {
    source: path.join(root, 'circle', 'reliability-tool-desktop-v102-final.png'),
    target: path.join(root, 'circle', 'reliability-tool-focus.png'),
    left: 70,
    top: 2200,
    width: 1037,
    height: 1037,
  },
];

const main = async () => {
  for (const crop of crops) {
    await sharp(crop.source)
      .extract({left: crop.left, top: crop.top, width: crop.width, height: crop.height})
      .png({compressionLevel: 9})
      .toFile(crop.target);
    console.log(crop.target);
  }
};

void main();
