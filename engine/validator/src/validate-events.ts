import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import crypto from "node:crypto";
import fg from "fast-glob";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { runDoctrineChecks, type DoctrineIssue } from "./doctrine-checks.js";

// Usage examples:
//   node dist/validate-events.js
//   node dist/validate-events.js examples/eventstreams/*.ndjson
//   node dist/validate-events.js --strict-hash
//
// Defaults to scanning: ../../examples/eventstreams/**/*.ndjson relative to this file.
type AnyEvent = Record<string, any>;

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function stableStringify(obj: any): string {
  // Minimal stable stringify: sort keys recursively.
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return `[${obj.map(stableStringify).join(",")}]`;
  const keys = Object.keys(obj).sort();
  const entries = keys.map(k => `${JSON.stringify(k)}:${stableStringify(obj[k])}`);
  return `{${entries.join(",")}}`;
}

function parseArgs(argv: string[]) {
  const strictHash = argv.includes("--strict-hash") || process.env.STRICT_HASH === "true";
  const files = argv.filter(a => !a.startsWith("--"));
  return { strictHash, files };
}

function loadSchema(schemaPath: string): AnyEvent {
  const raw = fs.readFileSync(schemaPath, "utf-8");
  return JSON.parse(raw);
}

function formatAjvErrors(errors: Ajv.ErrorObject[] | null | undefined): string {
  if (!errors || errors.length === 0) return "";
  return errors
    .map(e => {
      const where = e.instancePath || "(root)";
      return `- ${where}: ${e.message ?? "invalid"}${e.params ? ` (${JSON.stringify(e.params)})` : ""}`;
    })
    .join("\n");
}

async function validateFile(
  filePath: string,
  validate: Ajv.ValidateFunction,
  strictHash: boolean
): Promise<{ ok: boolean; errors: string[] }> {
  const errors: string[] = [];
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: "utf-8" }),
    crlfDelay: Infinity
  });

  let lineNo = 0;
  let prevHash: string | null = null;

  for await (const lineRaw of rl) {
    lineNo++;
    const line = lineRaw.trim();
    if (!line || line.startsWith("//")) continue;

    let evt: AnyEvent;
    try {
      evt = JSON.parse(line);
    } catch (e) {
      errors.push(`[${filePath}:${lineNo}] JSON parse error: ${(e as Error).message}`);
      continue;
    }

    // Schema validate
    const valid = validate(evt);
    if (!valid) {
      errors.push(`[${filePath}:${lineNo}] Schema validation failed:\n${formatAjvErrors(validate.errors)}`);
      continue;
    }

    // Hash chain continuity (does not compute unless strictHash is enabled)
    const ledger = evt.batnet?.ledger;
    if (!ledger || typeof ledger.prev_hash !== "string" || typeof ledger.hash !== "string") {
      errors.push(`[${filePath}:${lineNo}] Missing batnet.ledger.prev_hash/hash`);
      continue;
    }

    if (lineNo === 1 && ledger.prev_hash !== "GENESIS") {
      // First event in a stream should usually point to GENESIS. If you chain files, allow prevHash.
      // We'll only warn by error if the file is single-stream style; still enforce continuity within file.
      // If you want multi-file chaining, put a comment line with the prior hash and start at line 2.
    }

    if (prevHash !== null) {
      if (ledger.prev_hash !== prevHash) {
        errors.push(
          `[${filePath}:${lineNo}] Hash chain broken: ledger.prev_hash="${ledger.prev_hash}" does not match prior ledger.hash="${prevHash}".`
        );
        continue;
      }
    } else {
      // first canonical line establishes the prevHash expectation for subsequent lines
      // allow GENESIS or any starting hash (for chained files)
    }

    // Optional strict hash check: compute expected hash and require match.
    // This uses stableStringify of the event with ledger.hash zeroed so the hash doesn't include itself.
    if (strictHash) {
      const copy = structuredClone(evt);
      copy.batnet.ledger.hash = "0";
      const computed = sha256(stableStringify(copy));
      if (ledger.hash !== computed) {
        errors.push(
          `[${filePath}:${lineNo}] Strict hash mismatch: ledger.hash="${ledger.hash}" expected="${computed}".`
        );
        continue;
      }
    }

    // Doctrine checks (canon governance)
    const doctrineIssues: DoctrineIssue[] = runDoctrineChecks(evt);
    if (doctrineIssues.length > 0) {
      for (const di of doctrineIssues) {
        const ptr = di.pointer ? ` (${di.pointer})` : "";
        errors.push(`[${filePath}:${lineNo}] Doctrine violation [${di.code}]: ${di.message}${ptr}`);
      }
      continue;
    }

    // advance chain
    prevHash = ledger.hash;
  }

  return { ok: errors.length === 0, errors };
}

async function main() {
  const { strictHash, files } = parseArgs(process.argv.slice(2));

  const schemaPath = path.resolve(process.cwd(), "schemas", "canon.event.schema.json");
  if (!fs.existsSync(schemaPath)) {
    console.error(`Schema not found at: ${schemaPath}`);
    process.exit(2);
  }

  const schema = loadSchema(schemaPath);

  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);

  const validate = ajv.compile(schema);

  const defaultGlob = path
    .resolve(process.cwd(), "examples", "eventstreams", "**", "*.ndjson")
    .replaceAll("\\", "/");
  const inputPatterns = files.length > 0 ? files : [defaultGlob];

  const matched = await fg(inputPatterns, { onlyFiles: true, unique: true });
  if (matched.length === 0) {
    console.error(`No NDJSON files matched: ${inputPatterns.join(", ")}`);
    process.exit(2);
  }

  let anyFailed = false;

  for (const f of matched) {
    const result = await validateFile(f, validate, strictHash);
    if (!result.ok) {
      anyFailed = true;
      console.error(`\n❌ Validation failed: ${f}`);
      for (const err of result.errors) console.error(err);
    } else {
      console.log(`✅ OK: ${f}`);
    }
  }

  if (anyFailed) process.exit(1);
  console.log("\n✅ All eventstreams validated.");
}

main().catch(err => {
  console.error(err);
  process.exit(2);
});
