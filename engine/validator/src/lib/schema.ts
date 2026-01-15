import fs from "node:fs/promises";

type JsonSchema = {
  type?: string | string[];
  required?: string[];
  properties?: Record<string, unknown>;
};

type ValidationError = {
  message: string;
};

export async function loadSchema(schemaPath: string): Promise<unknown> {
  const raw = await fs.readFile(schemaPath, "utf-8");
  return JSON.parse(raw) as unknown;
}

function matchesType(value: unknown, type: string): boolean {
  switch (type) {
    case "object":
      return typeof value === "object" && value !== null && !Array.isArray(value);
    case "array":
      return Array.isArray(value);
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
    case "null":
      return value === null;
    default:
      return true;
  }
}

export function validateAgainstSchema(schema: unknown, data: unknown): ValidationError[] {
  if (typeof schema !== "object" || schema === null) {
    return [{ message: "Schema is not an object." }];
  }

  const jsonSchema = schema as JsonSchema;
  const errors: ValidationError[] = [];
  const types = Array.isArray(jsonSchema.type) ? jsonSchema.type : jsonSchema.type ? [jsonSchema.type] : [];

  if (types.length > 0 && !types.some((type) => matchesType(data, type))) {
    errors.push({ message: `Value does not match schema type ${types.join("|")}.` });
  }

  if (jsonSchema.required && typeof data === "object" && data !== null && !Array.isArray(data)) {
    for (const key of jsonSchema.required) {
      if (!(key in (data as Record<string, unknown>))) {
        errors.push({ message: `Missing required property: ${key}` });
      }
    }
  }

  return errors;
}
