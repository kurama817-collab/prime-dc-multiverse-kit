const fs = require("fs");
const path = require("path");
const { runDoctrineChecks } = require("./doctrine-checks");

const DEFAULT_EVENTS_DIR = "eventstreams";

function parseArgs() {
  const args = process.argv.slice(2);
  const schemaIndex = args.indexOf("--schema");
  const eventsIndex = args.indexOf("--events-dir");

  if (schemaIndex === -1 || !args[schemaIndex + 1]) {
    throw new Error("Missing required --schema <path> argument.");
  }

  return {
    schemaPath: args[schemaIndex + 1],
    eventsDir:
      eventsIndex !== -1 && args[eventsIndex + 1]
        ? args[eventsIndex + 1]
        : DEFAULT_EVENTS_DIR
  };
}

function loadJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

function listJsonFiles(directory) {
  const results = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      results.push(...listJsonFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      results.push(fullPath);
    }
  }

  return results;
}

function validateWithSchema(eventData, schema) {
  const issues = [];
  const required = Array.isArray(schema.required) ? schema.required : [];
  const properties = schema.properties || {};

  for (const key of required) {
    if (!(key in eventData)) {
      issues.push(`Missing required field: ${key}`);
    }
  }

  for (const [key, definition] of Object.entries(properties)) {
    if (!(key in eventData)) {
      continue;
    }

    const expectedType = definition.type;
    if (!expectedType) {
      continue;
    }

    const actual = eventData[key];
    const actualType = Array.isArray(actual) ? "array" : typeof actual;
    if (actualType !== expectedType) {
      issues.push(`Field ${key} should be ${expectedType} but is ${actualType}`);
    }
  }

  return issues;
}

function main() {
  const { schemaPath, eventsDir } = parseArgs();
  const resolvedSchemaPath = path.resolve(schemaPath);
  const resolvedEventsDir = path.resolve(eventsDir);

  if (!fs.existsSync(resolvedSchemaPath)) {
    throw new Error(`Schema not found at ${resolvedSchemaPath}`);
  }

  if (!fs.existsSync(resolvedEventsDir)) {
    console.warn(`Events directory not found at ${resolvedEventsDir}. Skipping validation.`);
    return;
  }

  const schema = loadJson(resolvedSchemaPath);
  const files = listJsonFiles(resolvedEventsDir);

  if (files.length === 0) {
    console.warn(`No event files found under ${resolvedEventsDir}.`);
    return;
  }

  let hasErrors = false;

  for (const file of files) {
    const eventData = loadJson(file);
    const schemaIssues = validateWithSchema(eventData, schema);

    if (schemaIssues.length > 0) {
      hasErrors = true;
      console.error(`Schema validation failed for ${file}`);
      for (const issue of schemaIssues) {
        console.error(`- ${issue}`);
      }
    }

    const doctrineIssues = runDoctrineChecks(eventData, file);
    for (const issue of doctrineIssues) {
      hasErrors = true;
      console.error(`Doctrine check failed for ${issue.file}: ${issue.message}`);
    }
  }

  if (hasErrors) {
    process.exitCode = 1;
  } else {
    console.log("All events validated successfully.");
  }
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
}
