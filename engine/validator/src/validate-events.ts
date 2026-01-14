//
// NDJSON Canon Event validator:
// - AJV schema validation (with ajv-formats enabled so format: "date-time"/"uri" are enforced)
// - BatNet doctrine checks (only run after schema passes)
// - Ledger hash chain continuity + optional strict hash verification
// - Safe behavior when no NDJSON files exist (no-op success)
//
// Usage:
//   node dist/validate-events.js
//   node dist/validate-events.js examples/eventstreams/*.ndjson
//   node dist/validate-events.js --schema schemas/canon.event.schema.json
//   node dist/validate-events.js --strict-hash
//   CANON_EVENT_SCHEMA=./schemas/canon.event.schema.json node dist/validate-events.js

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import crypto from "node:crypto";
import fg from "fast-glob";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { runDoctrineChecks, type DoctrineIssue } from "./doctrine-checks.js";

type AnyEvent = Record<string, any>;

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function stableStringify(obj: any): string {
  // Minimal stable stringify: recursively sorts keys to ensure deterministic hashing.
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return `[${obj.map(stableStringify).join(",")}]`;
  const keys = Object.keys(obj).sort();
  const entries = keys.map(k => `${JSON.stringify(k)}:${stableStringify(obj[k])}`);
  return `{${entries.join(",")}}`;
}

function parseArgs(argv: string[]) {
  const strictHash = argv.includes("--strict-hash") || process.env.STRICT_HASH === "true";

  const schemaArgIndex = argv.findIndex(a => a === "--schema");
  const schemaFromArg = schemaArgIndex >= 0 ? argv[schemaArgIndex + 1] : undefined;

  // Everything that's not a flag or the schema path is treated as a file/glob pattern.
  const files = argv.filter(a => !a.startsWith("--") && a !== schemaFromArg);

  return { strictHash, schemaFromArg, files };
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
      const msg = e.message ?? "invalid";
      return `- ${where}: ${msg}`;
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

    // 1) Schema validation first (doctrine checks should not run for invalid events)
    const okSchema = validate(evt);
    if (!okSchema) {
      errors.push(`[${filePath}:${lineNo}] Schema validation failed:\n${formatAjvErrors(validate.errors)}`);
      continue;
    }

    // 2) Hash chain continuity
    const ledger = evt.batnet?.ledger;
    if (!ledger || typeof ledger.prev_hash !== "string" || typeof ledger.hash !== "string") {
      errors.push(`[${filePath}:${lineNo}] Missing batnet.ledger.prev_hash/hash`);
      continue;
    }

    if (prevHash !== null && ledger.prev_hash !== prevHash) {
      errors.push(
        `[${filePath}:${lineNo}] Hash chain broken: ledger.prev_hash="${ledger.prev_hash}" does not match prior ledger.hash="${prevHash}".`
      );
      continue;
    }

    // 3) Optional strict hash verification
    if (strictHash) {
      const copy = structuredClone(evt);
      // Prevent self-inclusion by zeroing the current hash before hashing.
      copy.batnet.ledger.hash = "0";
      const computed = sha256(stableStringify(copy));
      if (ledger.hash !== computed) {
        errors.push(
          `[${filePath}:${lineNo}] Strict hash mismatch: ledger.hash="${ledger.hash}" expected="${computed}".`
        );
        continue;
      }
    }

    // 4) Doctrine checks (safe now because schema is known-good)
    const doctrineIssues: DoctrineIssue[] = runDoctrineChecks(evt);
    if (doctrineIssues.length > 0) {
      for (const di of doctrineIssues) {
        const ptr = di.pointer ? ` (${di.pointer})` : "";
        errors.push(`[${filePath}:${lineNo}] Doctrine violation [${di.code}]: ${di.message}${ptr}`);
      }
      continue;
    }

    // 5) Advance chain
    prevHash = ledger.hash;
  }

  return { ok: errors.length === 0, errors };
}

async function main() {
  const { strictHash, schemaFromArg, files } = parseArgs(process.argv.slice(2));

  const schemaPath = path.resolve(
    process.cwd(),
    schemaFromArg || process.env.CANON_EVENT_SCHEMA || path.join("schemas", "canon.event.schema.json")
  );

  if (!fs.existsSync(schemaPath)) {
    console.error(`Schema not found at: ${schemaPath}`);
    console.error(
      `Provide one via --schema <path> or CANON_EVENT_SCHEMA env var, or commit schemas/canon.event.schema.json.`
    );
    process.exit(2);
  }

  const schema = loadSchema(schemaPath);

  // AJV + formats so schema "format" constraints are enforced.
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);

  const validate = ajv.compile(schema);

  const defaultGlob = path
    .resolve(process.cwd(), "examples", "eventstreams", "**", "*.ndjson")
    .replaceAll("\\", "/");
  const patterns = files.length > 0 ? files : [defaultGlob];

  const matched = await fg(patterns, { onlyFiles: true, unique: true });

  // Fix #3: no hard-fail when there are no NDJSON files to validate.
  // This allows empty repos (or repos before streams are added) to keep CI green.
  if (matched.length === 0) {
    console.log(`ℹ️ No NDJSON files matched: ${patterns.join(", ")}`);
    console.log("ℹ️ Nothing to validate. Add examples/eventstreams/*.ndjson to enable eventstream validation.");
    process.exit(0);
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
  console.log("\n✅ All matched eventstreams validated.");
}

main().catch(err => {
  console.error(err);
  process.exit(2);
});
