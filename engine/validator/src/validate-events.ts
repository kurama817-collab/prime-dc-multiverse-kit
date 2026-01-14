import Ajv from "ajv";
import * as fs from "node:fs/promises";
import path from "node:path";
import { runDoctrineChecks, CanonEvent } from "./doctrine-checks";

const ajv = new Ajv({ allErrors: true });

type SchemaInput = {
  schemaPath: string;
  eventPaths: string[];
};

function parseArgs(args: string[]): SchemaInput {
  const schemaIndex = args.indexOf("--schema");
  if (schemaIndex === -1 || !args[schemaIndex + 1]) {
    throw new Error("Missing --schema <path> argument.");
  }

  const schemaPath = args[schemaIndex + 1];
  const eventPaths = args.filter(
    (arg, index) => index !== schemaIndex && index !== schemaIndex + 1
  );

  return { schemaPath, eventPaths };
}

async function loadSchema(schemaPath: string) {
  const schemaRaw = await fs.readFile(schemaPath, "utf-8");
  return JSON.parse(schemaRaw);
}

async function loadEventFiles(eventPaths: string[]): Promise<CanonEvent[]> {
  const events: CanonEvent[] = [];

  for (const eventPath of eventPaths) {
    const stats = await fs.stat(eventPath);
    if (stats.isDirectory()) {
      const entries = await fs.readdir(eventPath);
      const jsonFiles = entries.filter((entry) => entry.endsWith(".json"));
      for (const file of jsonFiles) {
        const filePath = path.join(eventPath, file);
        const raw = await fs.readFile(filePath, "utf-8");
        events.push(JSON.parse(raw));
      }
      continue;
    }

    const raw = await fs.readFile(eventPath, "utf-8");
    events.push(JSON.parse(raw));
  }

  return events;
}

async function main() {
  const { schemaPath, eventPaths } = parseArgs(process.argv.slice(2));
  const schema = await loadSchema(schemaPath);
  const validate = ajv.compile(schema);

  if (eventPaths.length === 0) {
    console.log("No event files provided. Schema compilation succeeded.");
    return;
  }

  const events = await loadEventFiles(eventPaths);
  let hasErrors = false;

  for (const event of events) {
    const isValid = validate(event);
    if (!isValid) {
      hasErrors = true;
      console.error(`Schema validation failed for ${event.id}:`);
      console.error(validate.errors);
    }

    const doctrineErrors = runDoctrineChecks(event);
    if (doctrineErrors.length > 0) {
      hasErrors = true;
      console.error(`Doctrine checks failed for ${event.id}:`);
      for (const error of doctrineErrors) {
        console.error(`- ${error}`);
      }
    }
  }

  if (hasErrors) {
    process.exit(1);
  }

  console.log("All events validated successfully.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
