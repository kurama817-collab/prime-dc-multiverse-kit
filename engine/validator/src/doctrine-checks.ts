// BatNet + Prime Batman doctrine checks beyond JSON Schema.
// These are "canon governance" rules.

export type DoctrineIssue = {
  code: string;
  message: string;
  pointer?: string;
};

type CanonEvent = {
  event_id: string;
  event_type: string;
  universe: string;
  timeline_id: string;
  actor: { actor_id: string; role: string; auth_context?: string };
  objects: Array<{ object_id: string; object_type: string }>;
  payload: Record<string, unknown>;
  batnet: {
    ledger: { prev_hash: string; hash: string; integrity: boolean };
    policy: { nonlethal_priority: boolean; audit_required: boolean; override_authorized?: boolean };
  };
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function containsBannedLethalKey(obj: unknown, path: string[] = []): DoctrineIssue[] {
  const issues: DoctrineIssue[] = [];
  if (!isRecord(obj)) return issues;

  for (const [k, v] of Object.entries(obj)) {
    const key = k.toLowerCase();
    // Allow "nonlethal"/"non-lethal" references but forbid anything else containing "lethal".
    const hasLethal = key.includes("lethal");
    const isNonLethal = key.includes("nonlethal") || key.includes("non-lethal") || key.includes("non_lethal");
    if (hasLethal && !isNonLethal) {
      issues.push({
        code: "BATNET.NO_LETHAL_PATHWAY",
        message: `Payload contains forbidden lethal-related key "${k}". BatNet has no lethal recommendation pathway.`,
        pointer: `payload.${[...path, k].join(".")}`
      });
    }
    issues.push(...containsBannedLethalKey(v, [...path, k]));
  }
  return issues;
}

function containsPredictionKeys(obj: unknown, path: string[] = []): DoctrineIssue[] {
  const issues: DoctrineIssue[] = [];
  if (!isRecord(obj)) return issues;

  for (const [k, v] of Object.entries(obj)) {
    const key = k.toLowerCase();
    const banned =
      key.includes("predict") ||
      key.includes("prediction") ||
      key.includes("behavior") ||
      key.includes("behaviour") ||
      key.includes("profile") ||
      key.includes("model_actor");

    if (banned) {
      issues.push({
        code: "BATNET.JOKER_NONMODELABLE",
        message: `Joker-class events are non-modelable; found prediction/behavior key "${k}".`,
        pointer: `payload.${[...path, k].join(".")}`
      });
    }
    issues.push(...containsPredictionKeys(v, [...path, k]));
  }
  return issues;
}

function hasObject(event: CanonEvent, objectIdPrefix: string): boolean {
  return event.objects.some(o => o.object_id.startsWith(objectIdPrefix));
}

export function runDoctrineChecks(event: CanonEvent): DoctrineIssue[] {
  const issues: DoctrineIssue[] = [];

  // 1) Global: BatNet has no lethal recommendation pathway.
  issues.push(...containsBannedLethalKey(event.payload));

  // 2) BatNet advisories must be explicit non-orders.
  if (event.event_type === "EVENT.BATNET_ADVISORY_ISSUED") {
    const explicit = (event.payload as any)?.explicit_non_orders;
    if (explicit !== true) {
      issues.push({
        code: "BATNET.ADVISORY_NOT_ORDER",
        message: "BatNet advisories must include payload.explicit_non_orders: true (advisory ≠ order).",
        pointer: "payload.explicit_non_orders"
      });
    }
  }

  // 3) Interdimensional transit restriction (Batwing Ω).
  // If Batwing is involved and payload indicates interdimensional mode, enforce coordinate lock + not in combat.
  const batwingOmega = hasObject(event, "OBJ.PRIME.BATWING_OMEGA");
  if (batwingOmega) {
    const pm = (event.payload as any)?.propulsion_mode;
    const mode = (event.payload as any)?.mode;
    const indicatesInterdimensional =
      (typeof pm === "string" && pm.toLowerCase().includes("interdimensional")) ||
      (typeof mode === "string" && mode.toLowerCase().includes("interdimensional"));

    if (indicatesInterdimensional) {
      const lock = (event.payload as any)?.batcave_coordinate_lock;
      const inCombat = (event.payload as any)?.in_combat;

      if (lock !== true) {
        issues.push({
          code: "BATWING.TRANSIT_REQUIRES_COORDLOCK",
          message: "Interdimensional Transit Mode requires Prime Batcave coordinate lock (payload.batcave_coordinate_lock must be true).",
          pointer: "payload.batcave_coordinate_lock"
        });
      }
      if (inCombat === true) {
        issues.push({
          code: "BATWING.NO_TRANSIT_DURING_COMBAT",
          message: "Interdimensional Transit Mode cannot be engaged during combat (payload.in_combat must not be true).",
          pointer: "payload.in_combat"
        });
      }
    }
  }

  // 4) Joker-class chaos events are non-modelable: no prediction/behavior fields.
  const jokerFlag =
    event.event_type === "EVENT.JOKER_CLASS_FLAGGED" ||
    (event.payload as any)?.joker_class === true ||
    (event.payload as any)?.non_modelable === true;

  if (jokerFlag) {
    issues.push(...containsPredictionKeys(event.payload));
  }

  // 5) Policy sanity: if nonlethal_priority is false, that violates Prime doctrine.
  if (event.batnet?.policy?.nonlethal_priority !== true) {
    issues.push({
      code: "BATNET.NONLETHAL_PRIORITY_REQUIRED",
      message: "Prime canon requires batnet.policy.nonlethal_priority to be true.",
      pointer: "batnet.policy.nonlethal_priority"
    });
  }

  return issues;
}
