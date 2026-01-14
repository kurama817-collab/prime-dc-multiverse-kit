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

  const files = argv.filter(a => !a.startsWith("--") && a !== schemaFromArg);
  return { strictHash, schemaFromArg, files };
}

function loadSchema(schemaPath: string): AnyEvent {
  return JSON.parse(fs.readFileSync(schemaPath, "utf-8"));
}

function formatAjvErrors(errors: Ajv.ErrorObject[] | null | undefined): string {
  if (!errors || errors.length === 0) return "";
  return errors
    .map(e => {
      const where = e.instancePath || "(root)";
      return `- ${where}: ${e.message ?? "invalid"}`;
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

  let prevHash: string | null = null;
  let lineNo = 0;

  for await (const raw of rl) {
    lineNo++;
    const line = raw.trim();
    if (!line || line.startsWith("//")) continue;

    let evt: AnyEvent;
    try {
      evt = JSON.parse(line);
    } catch (e) {
      errors.push(`[${filePath}:${lineNo}] JSON parse error: ${(e as Error).message}`);
      continue;
    }

    if (!validate(evt)) {
      errors.push(`[${filePath}:${lineNo}] Schema validation failed:\n${formatAjvErrors(validate.errors)}`);
      continue;
    }

    const ledger = evt.batnet?.ledger;
    if (!ledger || typeof ledger.prev_hash !== "string" || typeof ledger.hash !== "string") {
      errors.push(`[${filePath}:${lineNo}] Missing batnet.ledger.prev_hash/hash`);
      continue;
    }

    if (prevHash !== null && ledger.prev_hash !== prevHash) {
      errors.push(
        `[${filePath}:${lineNo}] Hash chain broken: prev_hash="${ledger.prev_hash}" != prior hash="${prevHash}".`
      );
      continue;
    }

    if (strictHash) {
      const copy = structuredClone(evt);
      copy.batnet.ledger.hash = "0";
      const computed = sha256(stableStringify(copy));
      if (ledger.hash !== computed) {
        errors.push(`[${filePath}:${lineNo}] Strict hash mismatch: hash="${ledger.hash}" expected="${computed}".`);
        continue;
      }
    }

    const doctrineIssues: DoctrineIssue[] = runDoctrineChecks(evt);
    if (doctrineIssues.length) {
      for (const di of doctrineIssues) {
        errors.push(
          `[${filePath}:${lineNo}] Doctrine violation [${di.code}]: ${di.message}${di.pointer ? ` (${di.pointer})` : ""}`
        );
      }
      continue;
    }

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
    console.error(`Provide via --schema <path> or CANON_EVENT_SCHEMA env var, or commit schemas/canon.event.schema.json.`);
    process.exit(2);
  }

  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);

  const schema = loadSchema(schemaPath);
  const validate = ajv.compile(schema);

  const defaultGlob = path.resolve(process.cwd(), "examples", "eventstreams", "**", "*.ndjson").replaceAll("\\", "/");
  const patterns = files.length ? files : [defaultGlob];

  const matched = await fg(patterns, { onlyFiles: true, unique: true });

  if (!matched.length) {
    console.error(`No NDJSON files matched: ${patterns.join(", ")}`);
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

  process.exit(anyFailed ? 1 : 0);
}

main().catch(err => {
  console.error(err);
  process.exit(2);
});
