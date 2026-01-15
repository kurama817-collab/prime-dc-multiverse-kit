const BANNED_LETHAL_KEYS = new Set(["lethal", "lethality", "fatal", "fatality"]);
const PREDICTION_KEYS = new Set(["prediction", "predicted", "predict", "forecast", "prophecy"]);

type VisitFn = (key: string, pointer: string) => void;

export function walk(obj: unknown, pathParts: string[], visit: VisitFn): void {
  if (Array.isArray(obj)) {
    obj.forEach((value, index) => walk(value, [...pathParts, String(index)], visit));
    return;
  }

  if (typeof obj !== "object" || obj === null) {
    return;
  }

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const pointer = `payload.${[...pathParts, key].join(".")}`;
    visit(key, pointer);
    walk(value, [...pathParts, key], visit);
  }
}

export function findBannedLethalKeys(payload: unknown): string[] {
  const matches: string[] = [];
  walk(payload, [], (key, pointer) => {
    if (BANNED_LETHAL_KEYS.has(key.toLowerCase())) {
      matches.push(pointer);
    }
  });
  return matches;
}

export function findPredictionKeys(payload: unknown): string[] {
  const matches: string[] = [];
  walk(payload, [], (key, pointer) => {
    if (PREDICTION_KEYS.has(key.toLowerCase())) {
      matches.push(pointer);
    }
  });
  return matches;
}
