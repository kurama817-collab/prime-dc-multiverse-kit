import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectJsonFiles, readJsonFile } from "./lib/files.js";

type Args = Record<string, string | boolean>;

type CanonBundle = {
  version: string;
  generatedAt: string;
  items: unknown[];
};

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
  const outDir = path.resolve(
    REPO_ROOT,
    (typeof args.out === "string" ? args.out : undefined) || "dist/canon-bundle"
  );
  const version = typeof args.version === "string" ? args.version : "0.1.0";
  const canonDir = path.resolve(
    REPO_ROOT,
    (typeof args.dir === "string" ? args.dir : undefined) || process.env.CANON_DIR || "canon"
  );

  const canonFiles = await collectJsonFiles(canonDir);
  const items = [] as unknown[];
  for (const filePath of canonFiles) {
    items.push(await readJsonFile(filePath));
  }

  const bundle: CanonBundle = {
    version,
    generatedAt: new Date().toISOString(),
    items,
  };

  await fs.mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, "canon.json");
  await fs.writeFile(outFile, `${JSON.stringify(bundle, null, 2)}\n`, "utf-8");

  console.log(`Wrote canon bundle to ${outFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
