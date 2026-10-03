import { deflateRawSync } from "node:zlib";
import { mkdir, readFile, readdir, rm, stat, writeFile, copyFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const scriptRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(scriptRoot, "..");
const betaRoot = join(repositoryRoot, "plugins", "buildmates");
const canonicalManifestPath = join(scriptRoot, "plugin.json");
const canonicalMcpPath = join(scriptRoot, "mcp.json");
const canonicalReadmePath = join(scriptRoot, "README.md");
const skillRoot = join(scriptRoot, "skills");

const failure = (message) => {
  throw new Error(`[Buildmates plugin] ${message}`);
};

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    failure(`Could not read JSON at ${path}: ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) failure(message);
}

function assertHttps(value, label) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    failure(`${label} must be an absolute URL`);
  }
  assert(parsed.protocol === "https:", `${label} must use HTTPS`);
}

function openAiInterface(manifest) {
  return manifest?.extensions?.["com.openai"]?.interface ?? {};
}

function legacyMcpConfig(portable) {
  const servers = Object.fromEntries(Object.entries(portable.mcpServers ?? {}).map(([name, value]) => [name, { ...value }]));
  return { mcpServers: servers };
}

function compatibilityManifest(manifest) {
  const extension = manifest.extensions?.["com.openai"] ?? {};
  return {
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    author: manifest.author,
    homepage: manifest.homepage,
    repository: manifest.repository,
    license: manifest.license,
    keywords: manifest.keywords,
    skills: "./skills/",
    mcpServers: "./.mcp.json",
    interface: extension.interface ?? {},
  };
}

async function validateSkills(root) {
  const skillsPath = join(root, "skills");
  const entries = await readdir(skillsPath, { withFileTypes: true }).catch(() => []);
  const skillDirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  assert(skillDirs.length > 0, `${root} must contain at least one skill`);
  for (const skillDir of skillDirs) {
    const path = join(skillsPath, skillDir, "SKILL.md");
    const text = await readFile(path, "utf8").catch(() => null);
    assert(text !== null, `${path} is missing`);
    const name = text.match(/^name:\s*(.+)$/m)?.[1]?.trim();
    const description = text.match(/^description:\s*(.+)$/m)?.[1]?.trim();
    assert(name === skillDir, `${path} must declare name: ${skillDir}`);
    assert(Boolean(description), `${path} must declare a non-empty description`);
  }
  return skillDirs;
}

async function validatePackage(root, { requirePortable = true } = {}) {
  const manifestPath = join(root, "plugin.json");
  const mcpPath = join(root, "mcp.json");
  const manifest = await readJson(manifestPath);
  const portableMcp = await readJson(mcpPath);
  assert(manifest.name === "buildmates", `${manifestPath} must name the buildmates plugin`);
  assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.name), "plugin name must be kebab-case");
  assert(typeof manifest.version === "string" && manifest.version.length > 0, "plugin version is required");
  assert(typeof manifest.description === "string" && manifest.description.length > 0, "plugin description is required");
  assert(manifest["$schema"] === "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json", "portable plugin schema is required");
  assert(!("apps" in manifest), "portable plugin.json must not register an app reference");
  assert(!manifest.extensions?.["com.openai"]?.apps, "OpenAI extension must not register an app reference");
  assertHttps(manifest.homepage, "plugin homepage");
  assertHttps(manifest.repository, "plugin repository");
  assert(manifest.license === "MIT", "plugin license must be MIT");
  assert(portableMcp["$schema"] === "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json", "portable MCP schema is required");
  assert(portableMcp.mcpServers && typeof portableMcp.mcpServers === "object", "mcpServers is required");
  const server = portableMcp.mcpServers.buildmates;
  assert(server?.type === "streamable-http", "Buildmates must use the streamable-http transport");
  assertHttps(server.url, "Buildmates MCP URL");
  assert(server.url.endsWith("/mcp"), "Buildmates MCP URL must target /mcp");

  const presentation = openAiInterface(manifest);
  assert(presentation.displayName === "Buildmates", "displayName must be Buildmates");
  assert(typeof presentation.shortDescription === "string" && presentation.shortDescription.length <= 30, "shortDescription must be 30 characters or fewer");
  assert(typeof presentation.supportURL === "string", "supportURL is required");
  assertHttps(presentation.supportURL, "supportURL");
  assertHttps(presentation.websiteURL, "websiteURL");
  assertHttps(presentation.privacyPolicyURL, "privacyPolicyURL");
  assertHttps(presentation.termsOfServiceURL, "termsOfServiceURL");
  for (const field of ["composerIcon", "logo"]) {
    assert(typeof presentation[field] === "string" && presentation[field].startsWith("./"), `${field} must be a package-relative asset path`);
    const assetPath = resolve(root, presentation[field]);
    assert(assetPath.startsWith(resolve(root) + sep), `${field} escapes the package root`);
    await stat(assetPath).catch(() => failure(`${field} asset does not exist: ${assetPath}`));
  }
  const skills = await validateSkills(root);
  if (requirePortable) {
    const overlay = join(root, ".codex-plugin", "plugin.json");
    const legacyMcp = join(root, ".mcp.json");
    assert(await stat(overlay).then(() => true, () => false), `${overlay} is required for the Codex compatibility overlay`);
    assert(await stat(legacyMcp).then(() => true, () => false), `${legacyMcp} is required for the Codex compatibility MCP mapping`);
    const overlayJson = await readJson(overlay);
    const legacyJson = await readJson(legacyMcp);
    assert(!("apps" in overlayJson), "Codex compatibility manifest must not register an app reference");
    assert(overlayJson.mcpServers === "./.mcp.json", "Codex compatibility manifest must point to the direct MCP mapping");
    assert(JSON.stringify(legacyJson) === JSON.stringify(legacyMcpConfig(portableMcp)), `${legacyMcp} is out of sync with mcp.json`);
  }
  return { manifest, portableMcp, skills };
}

async function copyDirectory(source, target) {
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  const entries = await readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    const from = join(source, entry.name);
    const to = join(target, entry.name);
    if (entry.isDirectory()) await copyDirectory(from, to);
    else await copyFile(from, to);
  }
}

async function syncBeta() {
  const { manifest, portableMcp } = await validatePackage(scriptRoot, { requirePortable: false });
  await mkdir(join(scriptRoot, ".codex-plugin"), { recursive: true });
  await writeFile(join(scriptRoot, ".mcp.json"), `${JSON.stringify(legacyMcpConfig(portableMcp), null, 2)}\n`);
  await writeFile(join(scriptRoot, ".codex-plugin", "plugin.json"), `${JSON.stringify(compatibilityManifest(manifest), null, 2)}\n`);

  await mkdir(betaRoot, { recursive: true });
  await copyFile(canonicalManifestPath, join(betaRoot, "plugin.json"));
  await copyFile(canonicalMcpPath, join(betaRoot, "mcp.json"));
  await copyFile(canonicalReadmePath, join(betaRoot, "README.md"));
  await copyDirectory(skillRoot, join(betaRoot, "skills"));
  await copyDirectory(join(scriptRoot, "assets"), join(betaRoot, "assets"));
  await mkdir(join(betaRoot, ".codex-plugin"), { recursive: true });
  await rm(join(betaRoot, "scripts", "bind-app-registration.mjs"), { force: true });
  await writeFile(join(betaRoot, ".mcp.json"), `${JSON.stringify(legacyMcpConfig(portableMcp), null, 2)}\n`);
  await writeFile(join(betaRoot, ".codex-plugin", "plugin.json"), `${JSON.stringify(compatibilityManifest(manifest), null, 2)}\n`);
}

async function listFiles(root, current = root) {
  const entries = await readdir(current, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(current, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(root, path));
    else files.push(relative(root, path).split(sep).join("/"));
  }
  return files.sort();
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDate() {
  return { time: 0, date: (1980 - 1980) << 9 | 1 << 5 | 1 };
}

async function writeDeterministicZip(root, destination) {
  const files = (await listFiles(root)).filter((file) =>
    file === "plugin.json"
    || file === "mcp.json"
    || file === "README.md"
    || file === ".mcp.json"
    || file === ".codex-plugin/plugin.json"
    || file.startsWith("skills/")
    || file.startsWith("assets/"),
  );
  assert(files.length > 0, "release package has no allowlisted files");
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { time, date } = dosDate();
  for (const name of files) {
    const raw = await readFile(join(root, ...name.split("/")));
    const compressed = deflateRawSync(raw, { level: 9 });
    const method = compressed.length < raw.length ? 8 : 0;
    const payload = method === 8 ? compressed : raw;
    const nameBuffer = Buffer.from(name, "utf8");
    const crc = crc32(raw);
    const local = Buffer.alloc(30 + nameBuffer.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);
    nameBuffer.copy(local, 30);
    localParts.push(local, payload);

    const central = Buffer.alloc(46 + nameBuffer.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    nameBuffer.copy(central, 46);
    centralParts.push(central);
    offset += local.length + payload.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, Buffer.concat([...localParts, centralDirectory, end]));
  return { destination, files: files.length };
}

async function main() {
  const mode = process.argv[2] ?? "--check";
  if (!["--check", "--sync", "--package"].includes(mode)) failure("Use --check, --sync, or --package");
  if (mode === "--sync") {
    await syncBeta();
    await validatePackage(scriptRoot);
    await validatePackage(betaRoot);
    console.log("Buildmates canonical plugin synced to the Codex beta package.");
    return;
  }
  const canonical = await validatePackage(scriptRoot);
  if (mode === "--check") {
    const beta = await validatePackage(betaRoot);
    const canonicalSkills = await Promise.all(canonical.skills.map(async (skill) => [skill, await readFile(join(scriptRoot, "skills", skill, "SKILL.md"), "utf8")]));
    for (const [skill, source] of canonicalSkills) {
      const candidate = await readFile(join(betaRoot, "skills", skill, "SKILL.md"), "utf8");
      assert(candidate === source, `beta skill is out of sync: ${skill}`);
    }
    assert(beta.manifest.version === canonical.manifest.version, "beta manifest version is out of sync");
    console.log(`Buildmates plugin package is valid (${canonical.skills.length} skills; canonical and beta agree).`);
    return;
  }
  const output = join(repositoryRoot, "dist", `buildmates-plugin-${canonical.manifest.version}.zip`);
  const result = await writeDeterministicZip(scriptRoot, output);
  console.log(`Wrote ${result.files} package files to ${result.destination}`);
}

await main();
