import fs from "fs";
import path from "path";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { runDoctrineChecks, type CanonEvent } from "./doctrine-checks";

const SCHEMA_ROOT = path.resolve(__dirname, "..", "..", "..", "schemas");
const EVENT_SCHEMA_PATH = path.join(SCHEMA_ROOT, "canon.event.schema.json");
const OBJECT_SCHEMA_PATH = path.join(SCHEMA_ROOT, "canon.object.schema.json");

type ValidationFailure = {
  file: string;
  line: number;
  errors: string[];
};

function loadSchema(schemaPath: string) {
  const raw = fs.readFileSync(schemaPath, "utf8");
  return JSON.parse(raw);
}

function gatherFiles(inputs: string[]): string[] {
  const files: string[] = [];

  for (const input of inputs) {
    const resolved = path.resolve(process.cwd(), input);
    if (!fs.existsSync(resolved)) {
      console.warn(`[validator] Skipping missing path: ${input}`);
      continue;
    }

    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      const entries = fs.readdirSync(resolved, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) {
          continue;
        }
        if (!entry.name.endsWith(".ndjson") && !entry.name.endsWith(".jsonl")) {
          continue;
        }
        files.push(path.join(resolved, entry.name));
      }
      continue;
    }

    files.push(resolved);
  }

  return files;
}

function validateFile(
  filePath: string,
  validate: Ajv.ValidateFunction
): { events: CanonEvent[]; failures: ValidationFailure[] } {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  const failures: ValidationFailure[] = [];
  const events: CanonEvent[] = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }

    let parsed: CanonEvent;
    try {
      parsed = JSON.parse(trimmed) as CanonEvent;
    } catch (error) {
      failures.push({
        file: filePath,
        line: index + 1,
        errors: [`Invalid JSON: ${(error as Error).message}`]
      });
      return;
    }

    const valid = validate(parsed);
    if (!valid) {
      const errors = (validate.errors ?? []).map(
        (err) => `${err.instancePath || "<root>"} ${err.message ?? "invalid"}`
      );
      failures.push({ file: filePath, line: index + 1, errors });
      return;
    }

    events.push(parsed);
  });

  return { events, failures };
}

function main() {
  const inputs = process.argv.slice(2);
  if (inputs.length === 0) {
    console.log("[validator] No event streams provided. Nothing to validate.");
    process.exit(0);
  }

  const files = gatherFiles(inputs);
  if (files.length === 0) {
    console.log("[validator] No NDJSON event streams found. Nothing to validate.");
    process.exit(0);
  }

  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const objectSchema = loadSchema(OBJECT_SCHEMA_PATH);
  const eventSchema = loadSchema(EVENT_SCHEMA_PATH);
  ajv.addSchema(objectSchema, objectSchema.$id ?? "canon.object.schema.json");
  const validate = ajv.compile(eventSchema);

  const failures: ValidationFailure[] = [];
  const events: CanonEvent[] = [];

  for (const file of files) {
    const result = validateFile(file, validate);
    failures.push(...result.failures);
    events.push(...result.events);
  }

  const doctrineIssues = runDoctrineChecks(events);

  if (failures.length > 0 || doctrineIssues.length > 0) {
    console.error("[validator] Validation failed.");
    for (const failure of failures) {
      console.error(
        `- ${failure.file}:${failure.line} :: ${failure.errors.join("; ")}`
      );
    }
    for (const issue of doctrineIssues) {
      console.error(`- doctrine:${issue.code} :: ${issue.message}`);
    }
    process.exit(1);
  }

  console.log(`[validator] OK: ${events.length} event(s) validated.`);
}

main();
