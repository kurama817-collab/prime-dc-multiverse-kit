import path from "node:path";
import { fileURLToPath } from "node:url";
import { findBannedLethalKeys, findPredictionKeys } from "./lib/doctrine.js";
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
  const schemaEnv = process.env.CANON_OBJECT_SCHEMA;
  const schemaPath = path.resolve(
    REPO_ROOT,
    schemaFromArg || schemaEnv || path.join("schemas", "canon.object.schema.json")
  );

  const canonDir = path.resolve(
    REPO_ROOT,
    (typeof args.dir === "string" ? args.dir : undefined) || process.env.CANON_DIR || "canon"
  );

  const canonFiles = await collectJsonFiles(canonDir);
  if (canonFiles.length === 0) {
    console.log("No canon objects found; skipping validation.");
    process.exit(0);
  }

  const schema = await loadSchema(schemaPath);

  let hasErrors = false;

  for (const filePath of canonFiles) {
    const data = await readJsonFile<unknown>(filePath);
    const validationErrors = validateAgainstSchema(schema, data);
    if (validationErrors.length > 0) {
      hasErrors = true;
      console.error(`Schema validation failed for ${filePath}`);
      console.error(validationErrors);
    }

    const lethalHits = findBannedLethalKeys(data);
    const predictionHits = findPredictionKeys(data);

    if (lethalHits.length > 0) {
      hasErrors = true;
      console.error(`Banned lethal keys found in ${filePath}: ${lethalHits.join(", ")}`);
    }

    if (predictionHits.length > 0) {
      hasErrors = true;
      console.error(`Prediction keys found in ${filePath}: ${predictionHits.join(", ")}`);
    }
  }

  if (hasErrors) {
    process.exit(1);
  }

  console.log(`Validated ${canonFiles.length} canon objects successfully.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
