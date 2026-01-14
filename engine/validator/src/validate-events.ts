import { readFile } from "node:fs/promises";
import { runDoctrineChecks } from "./doctrine-checks";

const getArgValue = (flag: string): string | undefined => {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
};

const loadSchema = async (schemaPath: string) => {
  const raw = await readFile(schemaPath, "utf-8");
  return JSON.parse(raw) as unknown;
};

const reportViolations = (violations: ReturnType<typeof runDoctrineChecks>) => {
  if (violations.length === 0) {
    console.log("Canon doctrine checks passed.");
    return;
  }

  console.error("Canon doctrine violations detected:");
  for (const violation of violations) {
    console.error(`- [${violation.code}] ${violation.message}`);
  }
  process.exitCode = 1;
};

const run = async () => {
  const schemaPath = getArgValue("--schema");
  if (!schemaPath) {
    console.error("Usage: node dist/validate-events.js --schema <path>");
    process.exitCode = 1;
    return;
  }

  try {
    const schema = await loadSchema(schemaPath);
    const violations = runDoctrineChecks(schema);
    reportViolations(violations);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to validate schema: ${message}`);
    process.exitCode = 1;
  }
};

void run();
