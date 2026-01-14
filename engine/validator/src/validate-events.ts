import fs from "fs";
import path from "path";

const args = process.argv.slice(2);

// Allow overriding schema location for different repo layouts.
// Priority: CLI --schema <path>  >  env CANON_EVENT_SCHEMA  >  default schemas/canon.event.schema.json
const schemaArgIndex = args.findIndex((arg) => arg === "--schema");
const schemaFromArg = schemaArgIndex >= 0 ? args[schemaArgIndex + 1] : undefined;

const schemaPath = path.resolve(
  process.cwd(),
  schemaFromArg || process.env.CANON_EVENT_SCHEMA || path.join("schemas", "canon.event.schema.json")
);

if (!fs.existsSync(schemaPath)) {
  console.error(`Schema not found at: ${schemaPath}`);
  console.error(
    "Provide one via --schema <path> or CANON_EVENT_SCHEMA env var, or commit the default schema to schemas/canon.event.schema.json."
  );
  process.exit(2);
}

const schemaContents = fs.readFileSync(schemaPath, "utf-8");
JSON.parse(schemaContents);

const fileArgs = args.filter((arg, index) => {
  if (arg === "--schema") {
    return false;
  }
  if (schemaArgIndex >= 0 && index === schemaArgIndex + 1) {
    return false;
  }
  return true;
});

if (fileArgs.length === 0) {
  console.log(`Schema loaded from ${schemaPath}. No event files provided for validation.`);
  process.exit(0);
}

const invalidFiles: string[] = [];

for (const filePath of fileArgs) {
  try {
    const absolutePath = path.resolve(process.cwd(), filePath);
    const contents = fs.readFileSync(absolutePath, "utf-8");
    JSON.parse(contents);
    console.log(`Loaded ${absolutePath}.`);
  } catch (error) {
    console.error(`Failed to parse ${filePath}:`, error);
    invalidFiles.push(filePath);
  }
}

if (invalidFiles.length > 0) {
  process.exit(1);
}
