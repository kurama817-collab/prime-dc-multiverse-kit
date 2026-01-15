/**
 * Canon Export Bundle
 *
 * Produces dist/canon-bundle/ with:
 * - schema/        (JSON Schemas)
 * - registry/      (universes registry JSON)
 * - codex/         (codex index JSON)
 * - events/        (event index JSON)
 * - manifest.json  (bundle metadata)
 *
 * Intended for studio ingestion (games/film/tools).
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import yaml from "js-yaml";
import matter from "gray-matter";
import crypto from "node:crypto";

type AnyObj = Record<string, any>;

function nowIso() {
  return new Date().toISOString();
}

function sha256FileSync(p: string): string {
  const buf = fs.readFileSync(p);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

async function ensureDir(p: string) {
  await fsp.mkdir(p, { recursive: true });
}

async function emptyDir(p: string) {
  await fsp.rm(p, { recursive: true, force: true });
  await ensureDir(p);
}

async function writeJson(p: string, obj: unknown) {
  await ensureDir(path.dirname(p));
  await fsp.writeFile(p, JSON.stringify(obj, null, 2) + "\n", "utf-8");
}

async function copyFile(src: string, dst: string) {
  await ensureDir(path.dirname(dst));
  await fsp.copyFile(src, dst);
}

function parseArgs(argv: string[]) {
  const outIndex = argv.findIndex(a => a === "--out");
  const outDir = outIndex >= 0 ? argv[outIndex + 1] : undefined;

  const rootIndex = argv.findIndex(a => a === "--root");
  const rootDir = rootIndex >= 0 ? argv[rootIndex + 1] : undefined;

  const versionIndex = argv.findIndex(a => a === "--version");
  const bundleVersion = versionIndex >= 0 ? argv[versionIndex + 1] : undefined;

  return { outDir, rootDir, bundleVersion };
}

function parseFrontMatterMd(filePath: string): { frontMatter: AnyObj | null; hasFrontMatter: boolean } {
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = matter(raw, {
    engines: { yaml: (s: string) => yaml.load(s) as AnyObj },
    language: "yaml"
  });
  const data = (parsed.data ?? {}) as AnyObj;
  const has = data && Object.keys(data).length > 0;
  return { frontMatter: has ? data : null, hasFrontMatter: has };
}

function loadYamlFile(filePath: string): AnyObj {
  const raw = fs.readFileSync(filePath, "utf-8");
  return (yaml.load(raw) ?? {}) as AnyObj;
}

async function buildCodexIndex(root: string) {
  const codexDir = path.join(root, "canon", "codex");
  const glob = path.join(codexDir.replaceAll("\\", "/"), "**", "*.md");
  const files = await fg([glob], { onlyFiles: true, unique: true });

  const entries: AnyObj[] = [];
  for (const file of files) {
    const rel = path.relative(root, file).replaceAll("\\", "/");
    const { frontMatter } = parseFrontMatterMd(file);

    if (!frontMatter) continue;

    entries.push({
      codex_id: frontMatter.codex_id ?? null,
      title: frontMatter.title ?? null,
      universe: frontMatter.universe ?? null,
      timeline_scope: frontMatter.timeline_scope ?? null,
      status: frontMatter.status ?? null,
      canon_lock: frontMatter.canon_lock ?? null,
      tags: frontMatter.tags ?? [],
      related: frontMatter.related ?? [],
      source_path: rel,
      source_sha256: sha256FileSync(file)
    });
  }

  // Sort for deterministic outputs
  entries.sort((a, b) => String(a.codex_id ?? "").localeCompare(String(b.codex_id ?? "")));

  return {
    codex_dir: path.relative(root, codexDir).replaceAll("\\", "/"),
    codex_count: entries.length,
    entries
  };
}

async function buildUniverseRegistry(root: string) {
  const uniDir = path.join(root, "canon", "universes");
  const glob1 = path.join(uniDir.replaceAll("\\", "/"), "*.yaml");
  const glob2 = path.join(uniDir.replaceAll("\\", "/"), "*.yml");
  const files = await fg([glob1, glob2], { onlyFiles: true, unique: true });

  const registries: AnyObj[] = [];
  let timelineCount = 0;

  for (const file of files) {
    const reg = loadYamlFile(file);
    const rel = path.relative(root, file).replaceAll("\\", "/");
    const timelines = Array.isArray(reg.timelines) ? reg.timelines : [];
    timelineCount += timelines.length;

    registries.push({
      universe: reg.universe ?? null,
      description: reg.description ?? null,
      canon_lock: reg.canon_lock ?? false,
      timelines,
      source_path: rel,
      source_sha256: sha256FileSync(file)
    });
  }

  registries.sort((a, b) => String(a.universe ?? "").localeCompare(String(b.universe ?? "")));

  return {
    universes_dir: path.relative(root, uniDir).replaceAll("\\", "/"),
    registry_count: registries.length,
    timeline_count: timelineCount,
    registries
  };
}

async function buildEventIndex(root: string) {
  const eventsDir = path.join(root, "examples", "eventstreams");
  const glob = path.join(eventsDir.replaceAll("\\", "/"), "**", "*.ndjson");
  const files = await fg([glob], { onlyFiles: true, unique: true });

  const events: AnyObj[] = [];
  let parseErrors = 0;

  for (const file of files) {
    const rel = path.relative(root, file).replaceAll("\\", "/");
    const raw = fs.readFileSync(file, "utf-8");
    const lines = raw.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const lineNo = i + 1;
      const line = lines[i].trim();
      if (!line || line.startsWith("//")) continue;

      try {
        const obj = JSON.parse(line);
        if (obj && typeof obj.event_id === "string") {
          events.push({
            event_id: obj.event_id,
            event_type: obj.event_type ?? null,
            universe: obj.universe ?? null,
            timeline_id: obj.timeline_id ?? null,
            source_path: rel,
            line: lineNo
          });
        }
      } catch {
        // Validation is handled elsewhere; export just records that it saw a bad line.
        parseErrors++;
      }
    }
  }

  // deterministic ordering: event_id then path then line
  events.sort((a, b) => {
    const id = String(a.event_id).localeCompare(String(b.event_id));
    if (id !== 0) return id;
    const p = String(a.source_path).localeCompare(String(b.source_path));
    if (p !== 0) return p;
    return Number(a.line) - Number(b.line);
  });

  return {
    events_dir: path.relative(root, eventsDir).replaceAll("\\", "/"),
    eventstreams_count: files.length,
    events_count: events.length,
    parse_errors: parseErrors,
    events
  };
}

async function copySchemas(root: string, outSchemaDir: string) {
  const schemaDir = path.join(root, "schemas");
  const glob = path.join(schemaDir.replaceAll("\\", "/"), "*.json");
  const files = await fg([glob], { onlyFiles: true, unique: true });

  for (const file of files) {
    const base = path.basename(file);
    await copyFile(file, path.join(outSchemaDir, base));
  }

  return { schema_count: files.length };
}

async function main() {
  const { outDir, rootDir, bundleVersion } = parseArgs(process.argv.slice(2));
  const root = path.resolve(process.cwd(), rootDir ?? ".");
  const out = path.resolve(process.cwd(), outDir ?? path.join("dist", "canon-bundle"));

  const schemaOut = path.join(out, "schema");
  const registryOut = path.join(out, "registry");
  const codexOut = path.join(out, "codex");
  const eventsOut = path.join(out, "events");

  await emptyDir(out);
  await ensureDir(schemaOut);
  await ensureDir(registryOut);
  await ensureDir(codexOut);
  await ensureDir(eventsOut);

  const schemasMeta = await copySchemas(root, schemaOut);
  const codexIndex = await buildCodexIndex(root);
  const universeRegistry = await buildUniverseRegistry(root);
  const eventIndex = await buildEventIndex(root);

  await writeJson(path.join(codexOut, "index.json"), codexIndex);
  await writeJson(path.join(registryOut, "universes.json"), universeRegistry);
  await writeJson(path.join(eventsOut, "index.json"), eventIndex);

  const manifest = {
    bundle_version: bundleVersion ?? "0.1.0",
    generated_at: nowIso(),
    git_sha: process.env.GITHUB_SHA ?? null,
    root: path.relative(process.cwd(), root).replaceAll("\\", "/"),
    out_dir: path.relative(process.cwd(), out).replaceAll("\\", "/"),
    counts: {
      schema_files: schemasMeta.schema_count,
      codex_entries: codexIndex.codex_count,
      universe_registries: universeRegistry.registry_count,
      timelines: universeRegistry.timeline_count,
      eventstreams: eventIndex.eventstreams_count,
      events_indexed: eventIndex.events_count,
      event_parse_errors: eventIndex.parse_errors
    }
  };

  await writeJson(path.join(out, "manifest.json"), manifest);

  console.log(`✅ Canon bundle exported to: ${manifest.out_dir}`);
  console.log(JSON.stringify(manifest.counts, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(2);
});
