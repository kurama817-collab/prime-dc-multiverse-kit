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

  return { schemaFromArg, universesDirFromArg, codexDirFromArg };
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
  // Simple cycle detection in a forest of parent pointers.
  // returns a cycle path if found.
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (node: string): string[] | null => {
    if (visited.has(node)) return null;
    if (visiting.has(node)) return [node]; // cycle start
    visiting.add(node);

    const p = parent.get(node);
    if (p) {
      const cycle = visit(p);
      if (cycle) {
        // if cycle already closed, just bubble up
        if (cycle[0] === cycle[cycle.length - 1]) return cycle;
        cycle.push(node);
        // close if we hit start
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

async function main() {
  const { schemaFromArg, universesDirFromArg, codexDirFromArg } = parseArgs(process.argv.slice(2));

  const schemaPath = path.resolve(
    process.cwd(),
    schemaFromArg || process.env.CANON_TIMELINE_SCHEMA || path.join("schemas", "canon.timeline.schema.json")
  );

  if (!fs.existsSync(schemaPath)) {
    console.error(`Timeline schema not found at: ${schemaPath}`);
    console.error(
      "Provide via --schema <path> or CANON_TIMELINE_SCHEMA env var, or commit schemas/canon.timeline.schema.json."
    );
    process.exit(2);
  }

  const universesDir = path.resolve(process.cwd(), universesDirFromArg || path.join("canon", "universes"));
  const codexDir = path.resolve(process.cwd(), codexDirFromArg || path.join("canon", "codex"));

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

  // Collect declared timelines per universe and globally
  const declaredByUniverse = new Map<string, Set<string>>();
  const globalDeclared = new Set<string>();

  // 1) Validate each registry + enforce fork rules
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
    for (const id of ids) globalDeclared.add(id);

    // Fork parent must exist
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
      }
    }

    // No cycles in fork graph
    const cycle = detectCycle(ids, parent);
    if (cycle) {
      anyFailed = true;
      console.error(`\n❌ Fork graph cycle detected in ${f}`);
      console.error(`- cycle path: ${cycle.reverse().join(" -> ")}`);
    }
  }

  // 2) Validate codex timeline_scope references exist in registries
  const codexGlob = path.join(codexDir.replaceAll("\\", "/"), "**", "*.md");
  const codexFiles = await fg([codexGlob], { onlyFiles: true, unique: true });

  // If codex dir is empty, that's ok.
  if (codexFiles.length > 0) {
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
  }

  if (anyFailed) process.exit(1);
  console.log("✅ Timeline governance validated (registries + codex timeline_scope).");
}

main().catch(err => {
  console.error(err);
  process.exit(2);
});
