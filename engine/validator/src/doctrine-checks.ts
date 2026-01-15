export type CanonEvent = {
  eventId: string;
  eventType: string;
  timestamp: string;
  object: Record<string, unknown>;
  [key: string]: unknown;
};

export type DoctrineIssue = {
  code: string;
  message: string;
  eventId?: string;
};

export function runDoctrineChecks(events: CanonEvent[]): DoctrineIssue[] {
  const issues: DoctrineIssue[] = [];
  const seenIds = new Set<string>();

  for (const event of events) {
    if (seenIds.has(event.eventId)) {
      issues.push({
        code: "DUPLICATE_EVENT_ID",
        message: `Duplicate eventId detected: ${event.eventId}`,
        eventId: event.eventId
      });
    }
    seenIds.add(event.eventId);
  }

  return issues;
}
