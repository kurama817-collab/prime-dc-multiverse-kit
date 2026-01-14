import fs from "node:fs";
import path from "node:path";
import fg from "fast-glob";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import matter from "gray-matter";
import yaml from "js-yaml";

type AnyObj = Record<string, any>;

function parseArgs(argv: string[]) {
  const schemaArgIndex = argv.findIndex(a => a === "--schema");
  const schemaFromArg = schemaArgIndex >= 0 ? argv[schemaArgIndex + 1] : undefined;

  const dirArgIndex = argv.findIndex(a => a === "--dir");
  const dirFromArg = dirArgIndex >= 0 ? argv[dirArgIndex + 1] : undefined;

  const files = argv.filter(a => !a.startsWith("--") && a !== schemaFromArg && a !== dirFromArg);

  return { schemaFromArg, dirFromArg, files };
}

function loadJson(p: string): AnyObj {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
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

function parseFrontMatter(filePath: string): AnyObj | null {
  const raw = fs.readFileSync(filePath, "utf-8");

  // gray-matter supports YAML; we force YAML parsing via js-yaml for consistency.
  const parsed = matter(raw, {
    engines: {
      yaml: (s: string) => yaml.load(s) as AnyObj
    },
    language: "yaml"
  });

  // No front-matter => not a codex file we can validate.
  if (!parsed.data || Object.keys(parsed.data).length === 0) return null;
  return parsed.data as AnyObj;
}

async function main() {
  const { schemaFromArg, dirFromArg, files } = parseArgs(process.argv.slice(2));

  const schemaPath = path.resolve(
    process.cwd(),
    schemaFromArg || process.env.CANON_OBJECT_SCHEMA || path.join("schemas", "canon.object.schema.json")
  );

  if (!fs.existsSync(schemaPath)) {
    console.error(`Canon object schema not found at: ${schemaPath}`);
    console.error(
      "Provide via --schema <path> or CANON_OBJECT_SCHEMA env var, or commit schemas/canon.object.schema.json."
    );
    process.exit(2);
  }

  const codexDir = path.resolve(process.cwd(), dirFromArg || path.join("canon", "codex"));
  const defaultGlob = path.join(codexDir.replaceAll("\\", "/"), "**", "*.md");

  const patterns = files.length > 0 ? files : [defaultGlob];
  const matched = await fg(patterns, { onlyFiles: true, unique: true });

  // No-op success if no codex files exist yet.
  if (matched.length === 0) {
    console.log(`ℹ️ No codex markdown files matched: ${patterns.join(", ")}`);
    console.log("ℹ️ Nothing to validate. Add canon/codex/*.md with YAML front-matter to enable canon object validation.");
    process.exit(0);
  }

  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);

  const schema = loadJson(schemaPath);
  const validate = ajv.compile(schema);

  const allIds = new Set<string>();

  // Pass 1: parse and collect IDs
  const docs: Array<{ file: string; fm: AnyObj }> = [];
  for (const f of matched) {
    const fm = parseFrontMatter(f);
    if (!fm) continue; // skip files without front-matter
    docs.push({ file: f, fm });

    if (typeof fm.codex_id === "string") {
      allIds.add(fm.codex_id);
    }
  }

  let anyFailed = false;

  // Pass 2: validate and cross-reference
  for (const { file, fm } of docs) {
    const ok = validate(fm);
    if (!ok) {
      anyFailed = true;
      console.error(`\n❌ Canon object validation failed: ${file}`);
      console.error(formatAjvErrors(validate.errors));
      continue;
    }

    // Cross-reference check: related codex IDs should exist if present.
    if (Array.isArray(fm.related)) {
      for (const rel of fm.related) {
        if (typeof rel === "string" && !allIds.has(rel)) {
          anyFailed = true;
          console.error(`\n❌ Missing related reference in ${file}`);
          console.error(`- related includes "${rel}" but no file in the scan set defines codex_id "${rel}".`);
        }
      }
    }
  }

  if (anyFailed) process.exit(1);
  console.log(`✅ Canon objects validated (${docs.length} with front-matter).`);
}

main().catch(err => {
  console.error(err);
  process.exit(2);
});
