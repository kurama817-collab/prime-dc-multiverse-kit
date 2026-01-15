import fs from "node:fs";
import path from "node:path";
import fg from "fast-glob";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import yaml from "js-yaml";
import matter from "gray-matter";

type AnyObj = Record<string, any>;

function parseArgs(argv: string[]) {
  const schemaArgIndex = argv.findIndex(a => a === "--schema");
  const schemaFromArg = schemaArgIndex >= 0 ? argv[schemaArgIndex + 1] : undefined;

  const universesDirIndex = argv.findIndex(a => a === "--universes-dir");
  const universesDirFromArg = universesDirIndex >= 0 ? argv[universesDirIndex + 1] : undefined;

  const codexDirIndex = argv.findIndex(a => a === "--codex-dir");
  const codexDirFromArg = codexDirIndex >= 0 ? argv[codexDirIndex + 1] : undefined;

  const eventsDirIndex = argv.findIndex(a => a === "--events-dir");
  const eventsDirFromArg = eventsDirIndex >= 0 ? argv[eventsDirIndex + 1] : undefined;

  const requireEventstreams = argv.includes("--require-eventstreams") || process.env.REQUIRE_EVENTSTREAMS === "true";

  return { schemaFromArg, universesDirFromArg, codexDirFromArg, eventsDirFromArg, requireEventstreams };
}

function loadJson(p: string): AnyObj {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function loadYaml(p: string): AnyObj {
  return (yaml.load(fs.readFileSync(p, "utf-8")) ?? {}) as AnyObj;
}

function formatAjvErrors(errors: Ajv.ErrorObject[] | null | undefined): string {
  if (!errors || errors.length === 0) return "";
  return errors
    .map(e => {
      const where = e.instancePath || "(root)";
      const msg = e.message ?? "invalid";
      return `- ${where}: ${msg}`;
    })
    .join("\n");
}

function parseCodexFrontMatter(filePath: string): AnyObj | null {
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = matter(raw, {
    engines: { yaml: (s: string) => yaml.load(s) as AnyObj },
    language: "yaml"
  });
  if (!parsed.data || Object.keys(parsed.data).length === 0) return null;
  return parsed.data as AnyObj;
}

function buildTimelineGraph(registry: AnyObj) {
  const ids = new Set<string>();
  const parent = new Map<string, string>(); // child -> parent
  const forkEventIds = new Map<string, string[]>(); // child -> fork_event_ids

  for (const t of registry.timelines ?? []) {
    if (typeof t?.timeline_id === "string") ids.add(t.timeline_id);
    if (typeof t?.timeline_id === "string" && typeof t?.fork_of === "string") {
      parent.set(t.timeline_id, t.fork_of);
    }
    if (typeof t?.timeline_id === "string" && Array.isArray(t?.fork_event_ids)) {
      forkEventIds.set(t.timeline_id, t.fork_event_ids.filter((x: any) => typeof x === "string"));
    }
  }

  return { ids, parent, forkEventIds };
}

function detectCycle(ids: Set<string>, parent: Map<string, string>): string[] | null {
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (node: string): string[] | null => {
    if (visited.has(node)) return null;
    if (visiting.has(node)) return [node];
    visiting.add(node);

    const p = parent.get(node);
    if (p) {
      const cycle = visit(p);
      if (cycle) {
        if (!cycle.includes(node)) cycle.push(node);
        if (cycle[0] === node) cycle.push(node);
        return cycle;
      }
    }

    visiting.delete(node);
    visited.add(node);
    return null;
  };

  for (const id of ids) {
    const c = visit(id);
    if (c) return c;
  }
  return null;
}

async function collectEventIdsFromNdjson(eventsGlob: string[]): Promise<Set<string>> {
  const files = await fg(eventsGlob, { onlyFiles: true, unique: true });
  const ids = new Set<string>();

  for (const f of files) {
    const raw = fs.readFileSync(f, "utf-8");
    const lines = raw.split(/\r?\n/);
    for (const lineRaw of lines) {
      const line = lineRaw.trim();
      if (!line || line.startsWith("//")) continue;
      try {
        const obj = JSON.parse(line);
        if (obj && typeof obj.event_id === "string") ids.add(obj.event_id);
      } catch {
        // Ignore parse failures here: event validation is handled elsewhere by validate-events.ts
        // This pass is only for binding fork_event_ids to existence.
      }
    }
  }
  return ids;
}

async function main() {
  const { schemaFromArg, universesDirFromArg, codexDirFromArg, eventsDirFromArg, requireEventstreams } = parseArgs(
    process.argv.slice(2)
  );

  const schemaPath = path.resolve(
    process.cwd(),
    schemaFromArg || process.env.CANON_TIMELINE_SCHEMA || path.join("schemas", "canon.timeline.schema.json")
  );

  if (!fs.existsSync(schemaPath)) {
    console.error(`Timeline schema not found at: ${schemaPath}`);
    console.error(
      `Provide via --schema <path> or CANON_TIMELINE_SCHEMA env var, or commit schemas/canon.timeline.schema.json.`
    );
    process.exit(2);
  }

  const universesDir = path.resolve(process.cwd(), universesDirFromArg || path.join("canon", "universes"));
  const codexDir = path.resolve(process.cwd(), codexDirFromArg || path.join("canon", "codex"));
  const eventsDir = path.resolve(process.cwd(), eventsDirFromArg || path.join("examples", "eventstreams"));

  const universeGlob = path.join(universesDir.replaceAll("\\", "/"), "*.yml");
  const universeGlob2 = path.join(universesDir.replaceAll("\\", "/"), "*.yaml");
  const universeFiles = await fg([universeGlob, universeGlob2], { onlyFiles: true, unique: true });

  if (universeFiles.length === 0) {
    console.log(`ℹ️ No universe registry YAML files found in: ${universesDir}`);
    console.log("ℹ️ Nothing to validate. Add canon/universes/*.yaml to enable timeline governance.");
    process.exit(0);
  }

  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const schema = loadJson(schemaPath);
  const validate = ajv.compile(schema);

  let anyFailed = false;

  const declaredByUniverse = new Map<string, Set<string>>();

  const declaredForkEvents = new Set<string>();
  const forkEventToRegistry: Array<{ registryFile: string; timeline_id: string; event_id: string }> = [];

  for (const f of universeFiles) {
    const reg = loadYaml(f);

    const ok = validate(reg);
    if (!ok) {
      anyFailed = true;
      console.error(`\n❌ Universe registry schema validation failed: ${f}`);
      console.error(formatAjvErrors(validate.errors));
      continue;
    }

    const universe = reg.universe as string;
    const { ids, parent, forkEventIds } = buildTimelineGraph(reg);

    declaredByUniverse.set(universe, ids);

    for (const [child, p] of parent.entries()) {
      if (!ids.has(p)) {
        anyFailed = true;
        console.error(`\n❌ Fork parent missing in ${f}`);
        console.error(`- timeline "${child}" fork_of "${p}" but "${p}" is not declared in this registry.`);
      }
      const fe = forkEventIds.get(child);
      if (!fe || fe.length === 0) {
        anyFailed = true;
        console.error(`\n❌ Fork event ids missing in ${f}`);
        console.error(`- timeline "${child}" is a fork but fork_event_ids is missing/empty.`);
      } else {
        for (const eid of fe) {
          declaredForkEvents.add(eid);
          forkEventToRegistry.push({ registryFile: f, timeline_id: child, event_id: eid });
        }
      }
    }

    const cycle = detectCycle(ids, parent);
    if (cycle) {
      anyFailed = true;
      console.error(`\n❌ Fork graph cycle detected in ${f}`);
      console.error(`- cycle path: ${cycle.reverse().join(" -> ")}`);
    }
  }

  const codexGlob = path.join(codexDir.replaceAll("\\", "/"), "**", "*.md");
  const codexFiles = await fg([codexGlob], { onlyFiles: true, unique: true });

  for (const f of codexFiles) {
    const fm = parseCodexFrontMatter(f);
    if (!fm) continue;

    const universe = fm.universe;
    const scope = fm.timeline_scope;

    if (typeof universe !== "string" || !Array.isArray(scope)) continue;

    const declared = declaredByUniverse.get(universe);
    if (!declared) {
      anyFailed = true;
      console.error(`\n❌ Codex universe not registered: ${f}`);
      console.error(`- universe "${universe}" is not declared in canon/universes/*.yaml`);
      continue;
    }

    for (const t of scope) {
      if (typeof t === "string" && !declared.has(t)) {
        anyFailed = true;
        console.error(`\n❌ Codex timeline_scope not declared: ${f}`);
        console.error(`- timeline_scope includes "${t}" but it is not declared for universe "${universe}".`);
      }
    }
  }

  const eventsGlob = [path.join(eventsDir.replaceAll("\\", "/"), "**", "*.ndjson")];

  const eventstreamFiles = await fg(eventsGlob, { onlyFiles: true, unique: true });

  if (eventstreamFiles.length === 0) {
    if (declaredForkEvents.size > 0 && requireEventstreams) {
      anyFailed = true;
      console.error(`\n❌ Fork-event binding requires eventstreams but none were found in: ${eventsDir}`);
      console.error(`- Add examples/eventstreams/**/*.ndjson or run without --require-eventstreams.`);
    } else {
      console.log(`ℹ️ No NDJSON eventstreams found in: ${eventsDir}`);
      console.log(
        "ℹ️ Skipping fork-event binding (soft mode). Add eventstreams or enable --require-eventstreams to enforce."
      );
    }
  } else {
    const existingEventIds = await collectEventIdsFromNdjson(eventsGlob);

    for (const entry of forkEventToRegistry) {
      if (!existingEventIds.has(entry.event_id)) {
        anyFailed = true;
        console.error(`\n❌ Fork-event id not found in eventstreams`);
        console.error(`- registry: ${entry.registryFile}`);
        console.error(`- timeline: ${entry.timeline_id}`);
        console.error(`- fork_event_id: ${entry.event_id}`);
        console.error(
          `- expected: an NDJSON line with {"event_id":"${entry.event_id}", ...} in ${eventsDir}/**/*.ndjson`
        );
      }
    }
  }

  if (anyFailed) process.exit(1);
  console.log("✅ Timeline governance validated (registries + codex scope + fork-event binding).");
}

main().catch(err => {
  console.error(err);
  process.exit(2);
});
