export type DoctrineViolation = {
  code: string;
  message: string;
};

const REQUIRED_FIELDS = ["id", "title", "summary", "timeline", "status", "sources"] as const;
const REQUIRED_PROPERTIES = ["id", "title", "summary", "timeline", "status", "sources"] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const runDoctrineChecks = (schema: unknown): DoctrineViolation[] => {
  const violations: DoctrineViolation[] = [];

  if (!isRecord(schema)) {
    return [
      {
        code: "schema.invalid",
        message: "Schema payload must be an object."
      }
    ];
  }

  const required = schema.required;
  if (!Array.isArray(required)) {
    violations.push({
      code: "schema.required",
      message: "Schema must declare a required array."
    });
  } else {
    for (const field of REQUIRED_FIELDS) {
      if (!required.includes(field)) {
        violations.push({
          code: "schema.required.missing",
          message: `Schema is missing required field: ${field}.`
        });
      }
    }
  }

  const properties = schema.properties;
  if (!isRecord(properties)) {
    violations.push({
      code: "schema.properties",
      message: "Schema must define a properties object."
    });
  } else {
    for (const field of REQUIRED_PROPERTIES) {
      if (!(field in properties)) {
        violations.push({
          code: "schema.properties.missing",
          message: `Schema properties missing definition for: ${field}.`
        });
      }
    }
  }

  if (schema.additionalProperties !== false) {
    violations.push({
      code: "schema.additionalProperties",
      message: "Schema must disable additionalProperties to enforce canon discipline."
    });
  }

  return violations;
};
