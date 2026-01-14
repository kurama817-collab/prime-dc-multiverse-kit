export type CanonEvent = {
  id: string;
  title: string;
  timeline: string;
  timestamp: string;
  summary?: string;
  participants?: string[];
  sources?: string[];
  tags?: string[];
  metadata?: Record<string, unknown>;
};

const TIMELINE_PREFIX: Record<string, string> = {
  prime: "pr",
  enlightened: "en",
  elseworld: "ew"
};

export function runDoctrineChecks(event: CanonEvent): string[] {
  const errors: string[] = [];
  const expectedPrefix = TIMELINE_PREFIX[event.timeline];

  if (expectedPrefix && !event.id.startsWith(expectedPrefix)) {
    errors.push(
      `Event id "${event.id}" should start with "${expectedPrefix}" for timeline "${event.timeline}".`
    );
  }

  if (event.tags && event.tags.includes("non-canon")) {
    errors.push(`Event "${event.id}" is tagged as non-canon.`);
  }

  return errors;
}
