"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type {
  BuildGraphEdge,
  BuildGraphRelationship,
  BuildGraphTopic,
} from "../../src/discovery/service";
import {
  CATEGORY_COLORS,
  createTopicGraphModel,
  strongestNeighbors,
} from "./build-graph-model";
import styles from "./BuildGraph.module.css";

type Position = { x: number; y: number; z: number };
type Hover = { topic: BuildGraphTopic; x: number; y: number } | null;

export function TopicRelationshipWeb({
  topics,
  edges,
  relationships,
  searchTarget,
}: {
  topics: BuildGraphTopic[];
  edges: BuildGraphEdge[];
  relationships: BuildGraphRelationship[];
  searchTarget: string | null;
}) {
  const model = useMemo(
    () => createTopicGraphModel(topics, relationships),
    [topics, relationships],
  );
  const [minUsers, setMinUsers] = useState(() =>
      quantile(
        topics.map((topic) => topic.builderCount),
        0.42,
      ),
    ),
    [minShared, setMinShared] = useState(() =>
      quantile(
        edges.map((edge) => edge.builderCount),
        0.55,
      ),
    ),
    [category, setCategory] = useState("all"),
    [strength, setStrength] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null),
    [hover, setHover] = useState<Hover>(null);
  const mountRef = useRef<HTMLDivElement>(null),
    selectedRef = useRef<string | null>(null),
    focusRef = useRef<(id: string) => void>(() => {});
  selectedRef.current = selectedId;
  const categories = model.roots;
  const filteredTopics = useMemo(
    () =>
      topics.filter(
        (topic) =>
          topic.builderCount >= minUsers &&
          (category === "all" || model.rootFor(topic.id) === category),
      ),
    [topics, minUsers, category, model],
  );
  const topicIds = useMemo(
    () => new Set(filteredTopics.map((topic) => topic.id)),
    [filteredTopics],
  );
  const maxShared = Math.max(1, ...edges.map((edge) => edge.builderCount));
  const filteredEdges = useMemo(
    () =>
      edges.filter(
        (edge) =>
          topicIds.has(edge.sourceId) &&
          topicIds.has(edge.targetId) &&
          edge.builderCount >= minShared &&
          (strength === "all" ||
            (strength === "strong" &&
              edge.builderCount >= Math.max(2, Math.ceil(maxShared * 0.6))) ||
            (strength === "core" && edge.builderCount >= maxShared)),
      ),
    [edges, topicIds, minShared, strength, maxShared],
  );
  const selected = selectedId
    ? (model.topicById.get(selectedId) ?? null)
    : null;
  const related = selected
    ? strongestNeighbors(selected.id, filteredEdges, 6)
        .map((item) => ({ ...item, topic: model.topicById.get(item.id)! }))
        .filter((item) => item.topic)
    : [];

  useEffect(() => {
    if (searchTarget && topicIds.has(searchTarget)) {
      setSelectedId(searchTarget);
      queueMicrotask(() => focusRef.current(searchTarget));
    }
  }, [searchTarget, topicIds]);
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !filteredTopics.length) return;
    const scene = new THREE.Scene();
    const sceneColor = new THREE.Color("#121a14");
    scene.background = sceneColor;
    scene.fog = new THREE.Fog("#121a14", 28, 58);
    const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 100);
    camera.position.set(0, 2, 28);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 11;
    controls.maxDistance = 36;
    controls.enablePan = true;
    scene.add(new THREE.AmbientLight(0xf3f0e7, 1.45));
    const key = new THREE.DirectionalLight(0xe7f1dd, 2.1);
    key.position.set(7, 9, 12);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xc46f45, 1.1);
    rim.position.set(-8, -3, -6);
    scene.add(rim);
    const positions = layoutGraph(filteredTopics, filteredEdges);
    const meshes = new Map<string, THREE.Mesh>();
    const edgeObjects: { edge: BuildGraphEdge; object: THREE.Mesh }[] = [];
    const grid = new THREE.GridHelper(34, 18, 0x3d5543, 0x263529);
    grid.position.y = -8;
    for (const material of Array.isArray(grid.material)
      ? grid.material
      : [grid.material]) {
      material.transparent = true;
      material.opacity = 0.22;
    }
    scene.add(grid);
    for (const edge of filteredEdges) {
      const a = positions.get(edge.sourceId),
        b = positions.get(edge.targetId);
      if (!a || !b) continue;
      const geometry = new THREE.CylinderGeometry(
        0.012 + edge.strength * 0.07,
        0.012 + edge.strength * 0.07,
        distance(a, b),
        7,
      );
      const baseOpacity = 0.08 + edge.strength * 0.38;
      const material = new THREE.MeshStandardMaterial({
        color: 0x8da181,
        transparent: true,
        opacity: baseOpacity,
        roughness: 0.75,
      });
      const line = new THREE.Mesh(geometry, material);
      placeCylinder(line, a, b);
      line.userData = { kind: "edge", edge, baseOpacity };
      scene.add(line);
      edgeObjects.push({ edge, object: line });
    }
    const maxUsers = Math.max(
      1,
      ...filteredTopics.map((topic) => topic.builderCount),
    );
    for (const topic of filteredTopics) {
      const position = positions.get(topic.id)!;
      const radius = 0.42 + Math.sqrt(topic.builderCount / maxUsers) * 0.9;
      const root = model.rootFor(topic.id);
      const color =
        CATEGORY_COLORS[
          Math.max(
            0,
            categories.findIndex((item) => item.id === root),
          ) % CATEGORY_COLORS.length
        ];
      const baseColor = new THREE.Color(color);
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 30, 22),
        new THREE.MeshStandardMaterial({
          color: baseColor,
          roughness: 0.52,
          metalness: 0.04,
          emissive: baseColor.clone().multiplyScalar(0.08),
          transparent: true,
        }),
      );
      mesh.position.set(position.x, position.y, position.z);
      mesh.userData = { kind: "topic", id: topic.id, baseColor };
      scene.add(mesh);
      meshes.set(topic.id, mesh);
      const label = makeLabel(topic.label);
      label.position.set(position.x, position.y + radius + 0.6, position.z);
      label.visible = false;
      scene.add(label);
      mesh.userData.label = label;
    }
    const raycaster = new THREE.Raycaster(),
      pointer = new THREE.Vector2();
    const applySelection = (id: string | null) => {
      for (const [topicId, mesh] of meshes)
        mesh.scale.setScalar(topicId === id ? 1.28 : 1);
    };
    let focusFrame = 0;
    const focus = (id: string) => {
      const mesh = meshes.get(id);
      if (!mesh) return;
      cancelAnimationFrame(focusFrame);
      const endTarget = mesh.position.clone(),
        startTarget = controls.target.clone(),
        startPosition = camera.position.clone(),
        direction = startPosition.clone().sub(endTarget).normalize(),
        endPosition = endTarget.clone().add(direction.multiplyScalar(14));
      applySelection(id);
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        controls.target.copy(endTarget);
        camera.position.copy(endPosition);
        controls.update();
        return;
      }
      const started = performance.now();
      const move = () => {
        const t = Math.min(1, (performance.now() - started) / 420),
          eased = 1 - Math.pow(1 - t, 3);
        controls.target.lerpVectors(startTarget, endTarget, eased);
        camera.position.lerpVectors(startPosition, endPosition, eased);
        controls.update();
        if (t < 1) focusFrame = requestAnimationFrame(move);
      };
      focusFrame = requestAnimationFrame(move);
    };
    focusRef.current = focus;
    const locate = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects([...meshes.values()], false)[0]
        ?.object as THREE.Mesh | undefined;
    };
    const move = (event: PointerEvent) => {
      const hit = locate(event);
      renderer.domElement.style.cursor = hit ? "pointer" : "grab";
      if (hit) {
        const topic = model.topicById.get(hit.userData.id);
        if (topic) setHover({ topic, x: event.clientX, y: event.clientY });
      } else setHover(null);
    };
    const click = (event: PointerEvent) => {
      const hit = locate(event);
      const id = hit?.userData.id ?? null;
      selectedRef.current = id;
      setSelectedId(id);
      applySelection(id);
      if (id) focus(id);
    };
    const holdPage = (event: WheelEvent) => event.preventDefault();
    renderer.domElement.addEventListener("pointermove", move);
    renderer.domElement.addEventListener("click", click);
    renderer.domElement.addEventListener("wheel", holdPage, { passive: false });
    const resize = () => {
      const width = mount.clientWidth,
        height = mount.clientHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();
    const cameraPoint = new THREE.Vector3(),
      projected = new THREE.Vector3();
    const updateDepth = () => {
      const selectedId = selectedRef.current;
      const connected = new Set(
        selectedId
          ? [
              selectedId,
              ...filteredEdges
                .filter(
                  (edge) =>
                    edge.sourceId === selectedId ||
                    edge.targetId === selectedId,
                )
                .flatMap((edge) => [edge.sourceId, edge.targetId]),
            ]
          : [],
      );
      const entries = [...meshes]
        .map(([id, mesh]) => {
          cameraPoint
            .copy(mesh.position)
            .applyMatrix4(camera.matrixWorldInverse);
          return { id, mesh, depth: Math.max(0.1, -cameraPoint.z) };
        })
        .sort((a, b) => a.depth - b.depth);
      const near = entries[0]?.depth ?? 1,
        far = entries.at(-1)?.depth ?? near + 1,
        range = Math.max(1, far - near);
      const occupied: { x: number; y: number; w: number; h: number }[] = [];
      let labelsShown = 0;
      for (const entry of entries) {
        const depthRatio = Math.min(
          1,
          Math.max(0, (entry.depth - near) / range),
        );
        const related = !selectedId || connected.has(entry.id);
        const opacity = selectedId
          ? related
            ? 1
            : 0.055
          : Math.max(0.14, 1 - depthRatio * 0.84);
        const material = entry.mesh.material as THREE.MeshStandardMaterial;
        const baseColor = entry.mesh.userData.baseColor as THREE.Color;
        material.opacity = opacity;
        material.color
          .copy(baseColor)
          .lerp(sceneColor, selectedId && !related ? 0.82 : depthRatio * 0.58);
        material.emissive
          .copy(baseColor)
          .multiplyScalar(0.08 * (1 - depthRatio));
        const label = entry.mesh.userData.label as THREE.Sprite;
        const base = label.userData.baseScale as { x: number; y: number };
        const scale = Math.min(1.55, Math.max(0.9, entry.depth / 24));
        label.scale.set(base.x * scale, base.y * scale, 1);
        projected.copy(label.position).project(camera);
        const w = Math.min(0.42, (base.x / entry.depth) * 0.78),
          h = Math.min(0.18, (base.y / entry.depth) * 1.1);
        const box = { x: projected.x - w / 2, y: projected.y - h / 2, w, h };
        const collides = occupied.some(
          (other) =>
            box.x < other.x + other.w &&
            box.x + box.w > other.x &&
            box.y < other.y + other.h &&
            box.y + box.h > other.y,
        );
        const inFrame =
          Math.abs(projected.x) < 0.96 && Math.abs(projected.y) < 0.94;
        const priority = entry.id === selectedId;
        const eligible =
          inFrame &&
          related &&
          (priority || labelsShown < (selectedId ? 7 : 9)) &&
          !(!priority && collides);
        label.visible = eligible;
        label.material.opacity = opacity;
        if (eligible) {
          occupied.push(box);
          labelsShown++;
        }
      }
      for (const { edge, object } of edgeObjects) {
        const direct = Boolean(
          selectedId &&
          (edge.sourceId === selectedId || edge.targetId === selectedId),
        );
        const related = !selectedId || direct;
        const a = meshes.get(edge.sourceId),
          b = meshes.get(edge.targetId);
        const midpoint =
          a && b
            ? a.position.clone().add(b.position).multiplyScalar(0.5)
            : object.position;
        cameraPoint.copy(midpoint).applyMatrix4(camera.matrixWorldInverse);
        const depthRatio = Math.min(
          1,
          Math.max(0, (-cameraPoint.z - near) / range),
        );
        const base = Number(object.userData.baseOpacity ?? 0.2);
        (object.material as THREE.MeshStandardMaterial).opacity = selectedId
          ? related
            ? Math.min(0.7, base * 1.45)
            : 0.012
          : Math.max(0.025, base * (1 - depthRatio * 0.78));
      }
    };
    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      controls.update();
      updateDepth();
      renderer.render(scene, camera);
    };
    animate();
    applySelection(selectedRef.current);
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(focusFrame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointermove", move);
      renderer.domElement.removeEventListener("click", click);
      renderer.domElement.removeEventListener("wheel", holdPage);
      controls.dispose();
      renderer.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const material = object.material as THREE.Material | THREE.Material[];
          (Array.isArray(material) ? material : [material]).forEach((item) =>
            item.dispose(),
          );
        }
        if (object instanceof THREE.Sprite) {
          object.material.map?.dispose();
          object.material.dispose();
        }
      });
      mount.removeChild(renderer.domElement);
    };
  }, [filteredTopics, filteredEdges, model, categories]);

  return (
    <section
      className={styles.webShell}
      aria-label="Three-dimensional topic relationship web"
    >
      <div className={styles.filters}>
        <label>
          Minimum builders{" "}
          <input
            type="range"
            min="1"
            max={Math.max(2, ...topics.map((t) => t.builderCount))}
            value={minUsers}
            onChange={(event) => setMinUsers(Number(event.target.value))}
          />
          <output>{minUsers}</output>
        </label>
        <label>
          Minimum shared{" "}
          <input
            type="range"
            min="1"
            max={maxShared}
            value={Math.min(minShared, maxShared)}
            onChange={(event) => setMinShared(Number(event.target.value))}
          />
          <output>{Math.min(minShared, maxShared)}</output>
        </label>
        <label>
          Category{" "}
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="all">All categories</option>
            {categories.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Relationship{" "}
          <select
            value={strength}
            onChange={(event) => setStrength(event.target.value)}
          >
            <option value="all">All visible</option>
            <option value="strong">Strong</option>
            <option value="core">Strongest only</option>
          </select>
        </label>
      </div>
      <div className={styles.webLayout}>
        <div className={styles.canvasWrap}>
          {filteredTopics.length ? (
            <div ref={mountRef} className={styles.webCanvas} />
          ) : (
            <div className={styles.emptyLevel}>
              <h3>No topics match these filters.</h3>
              <p>Lower a threshold or return to all categories.</p>
              <button
                type="button"
                onClick={() => {
                  setMinUsers(1);
                  setMinShared(1);
                  setCategory("all");
                  setStrength("all");
                }}
              >
                Reset filters
              </button>
            </div>
          )}
          <div className={styles.canvasHelp}>
            <span>Drag to rotate</span>
            <span>Scroll to zoom</span>
            <span>Right-drag to pan</span>
          </div>
          {hover ? (
            <div
              className={styles.tooltip}
              style={{
                left: Math.min(hover.x + 14, window.innerWidth - 250),
                top: Math.min(hover.y + 14, window.innerHeight - 170),
              }}
            >
              <strong>{hover.topic.label}</strong>
              <p>
                {hover.topic.builderCount}{" "}
                {hover.topic.builderCount === 1 ? "builder" : "builders"}
              </p>
            </div>
          ) : null}
        </div>
        <aside className={styles.inspector} aria-live="polite">
          {selected ? (
            <>
              <p className={styles.kicker}>Focused topic</p>
              <h3>{selected.label}</h3>
              <div className={styles.inspectorStat}>
                <strong>{selected.builderCount}</strong>
                <span>builders</span>
              </div>
              <dl>
                <div>
                  <dt>Category</dt>
                  <dd>
                    {model.topicById.get(model.rootFor(selected.id))?.label ??
                      "Other"}
                  </dd>
                </div>
                <div>
                  <dt>Projects</dt>
                  <dd>{selected.projectCount}</dd>
                </div>
              </dl>
              <h4>Strongest overlaps</h4>
              {related.length ? (
                <ol>
                  {related.map((item) => (
                    <li key={item.id}>
                      <span>{item.topic.label}</span>
                      <strong>{item.shared} shared</strong>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className={styles.muted}>
                  No relationships pass the current filters.
                </p>
              )}
              <p className={styles.privacyCopy}>
                Topic totals are anonymous. Individual builders are never listed
                here.
              </p>
              <button
                className={styles.clearFocus}
                type="button"
                onClick={() => setSelectedId(null)}
              >
                Show complete graph
              </button>
            </>
          ) : (
            <>
              <p className={styles.kicker}>Relationship view</p>
              <h3>Choose a topic.</h3>
              <p className={styles.muted}>
                Its strongest overlaps will appear here. Unrelated topics fade
                so the shape of the connection is easy to read.
              </p>
              <div className={styles.inspectorLegend}>
                <span>
                  <i className={styles.legendNode} />
                  Node size = builders
                </span>
                <span>
                  <i className={styles.legendLine} />
                  Line width = shared builders
                </span>
              </div>
            </>
          )}
        </aside>
      </div>
    </section>
  );
}

function layoutGraph(topics: BuildGraphTopic[], edges: BuildGraphEdge[]) {
  const positions = new Map<string, Position>();
  const sorted = [...topics].sort(
    (a, b) => b.builderCount - a.builderCount || a.id.localeCompare(b.id),
  );
  sorted.forEach((topic, index) => {
    const y = 1 - (index / Math.max(1, sorted.length - 1)) * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const angle = index * Math.PI * (3 - Math.sqrt(5));
    positions.set(topic.id, {
      x: radius * Math.cos(angle) * 8,
      y: y * 7,
      z: radius * Math.sin(angle) * 8,
    });
  });
  for (let iteration = 0; iteration < 90; iteration++) {
    const forces = new Map(
      sorted.map((topic) => [topic.id, { x: 0, y: 0, z: 0 }]),
    );
    for (let i = 0; i < sorted.length; i++)
      for (let j = i + 1; j < sorted.length; j++) {
        const a = positions.get(sorted[i].id)!,
          b = positions.get(sorted[j].id)!;
        let dx = a.x - b.x,
          dy = a.y - b.y,
          dz = a.z - b.z;
        const d2 = Math.max(0.35, dx * dx + dy * dy + dz * dz),
          factor = 0.095 / d2;
        forces.get(sorted[i].id)!.x += dx * factor;
        forces.get(sorted[i].id)!.y += dy * factor;
        forces.get(sorted[i].id)!.z += dz * factor;
        forces.get(sorted[j].id)!.x -= dx * factor;
        forces.get(sorted[j].id)!.y -= dy * factor;
        forces.get(sorted[j].id)!.z -= dz * factor;
      }
    for (const edge of edges) {
      const a = positions.get(edge.sourceId),
        b = positions.get(edge.targetId);
      if (!a || !b) continue;
      const pull = 0.0025 + 0.006 * edge.strength;
      for (const axis of ["x", "y", "z"] as const) {
        const delta = b[axis] - a[axis];
        forces.get(edge.sourceId)![axis] += delta * pull;
        forces.get(edge.targetId)![axis] -= delta * pull;
      }
    }
    for (const topic of sorted) {
      const p = positions.get(topic.id)!,
        f = forces.get(topic.id)!;
      p.x = (p.x + f.x) * 0.997;
      p.y = (p.y + f.y) * 0.997;
      p.z = (p.z + f.z) * 0.997;
    }
  }
  return positions;
}
function distance(a: Position, b: Position) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}
function placeCylinder(mesh: THREE.Mesh, a: Position, b: Position) {
  const start = new THREE.Vector3(a.x, a.y, a.z),
    end = new THREE.Vector3(b.x, b.y, b.z);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    end.clone().sub(start).normalize(),
  );
}
function makeLabel(text: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 160;
  const context = canvas.getContext("2d")!;
  const lines = wrapNodeLabel(text);
  context.fillStyle = "rgba(8,13,9,.88)";
  roundRect(context, 12, 12, 616, 136, 16);
  context.fill();
  context.strokeStyle = "rgba(243,240,231,.32)";
  context.lineWidth = 2;
  context.stroke();
  context.font = "700 34px Segoe UI";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#fffdf7";
  const start = 80 - (lines.length - 1) * 22;
  lines.forEach((line, index) =>
    context.fillText(line, 320, start + index * 44, 570),
  );
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      depthTest: true,
    }),
  );
  const width = Math.max(
    3.1,
    Math.min(5.8, Math.max(...lines.map((line) => line.length)) * 0.19),
  );
  const height = lines.length === 2 ? 1.45 : 1.05;
  sprite.scale.set(width, height, 1);
  sprite.userData.baseScale = { x: width, y: height };
  return sprite;
}
function wrapNodeLabel(text: string) {
  if (text.length <= 18) return [text];
  const words = text.split(/\s+/);
  let first = "",
    second = "";
  for (const word of words) {
    if (!first || `${first} ${word}`.length <= 18)
      first = first ? `${first} ${word}` : word;
    else second = second ? `${second} ${word}` : word;
  }
  return second
    ? [first, second.length > 22 ? `${second.slice(0, 21)}…` : second]
    : [first];
}
function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}
function quantile(values: number[], fraction: number) {
  if (!values.length) return 1;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.max(1, sorted[Math.floor((sorted.length - 1) * fraction)] ?? 1);
}
