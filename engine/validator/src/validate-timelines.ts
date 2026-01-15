import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectJsonFiles, readJsonFile } from "./lib/files.js";
import { loadSchema, validateAgainstSchema } from "./lib/schema.js";

type Args = Record<string, string | boolean>;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      continue;
    }
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const schemaFromArg = typeof args.schema === "string" ? args.schema : undefined;
  const schemaEnv = process.env.CANON_TIMELINE_SCHEMA;
  const schemaPath = path.resolve(
    REPO_ROOT,
    schemaFromArg || schemaEnv || path.join("schemas", "canon.timeline.schema.json")
  );

  const timelinesDir = path.resolve(
    REPO_ROOT,
    (typeof args.dir === "string" ? args.dir : undefined) || process.env.TIMELINES_DIR || "timelines"
  );

  const timelineFiles = await collectJsonFiles(timelinesDir);
  if (timelineFiles.length === 0) {
    console.log("No timelines found; skipping validation.");
    process.exit(0);
  }

  const schema = await loadSchema(schemaPath);

  let hasErrors = false;

  for (const filePath of timelineFiles) {
    const data = await readJsonFile<unknown>(filePath);
    const validationErrors = validateAgainstSchema(schema, data);
    if (validationErrors.length > 0) {
      hasErrors = true;
      console.error(`Schema validation failed for ${filePath}`);
      console.error(validationErrors);
    }
  }

  if (hasErrors) {
    process.exit(1);
  }

  console.log(`Validated ${timelineFiles.length} timelines successfully.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
