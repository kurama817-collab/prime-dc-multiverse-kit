---
codex_id: CODEX.PRIME.BATNET
title: "BatNet"
universe: "prime-batman"
timeline_scope: ["timeline-a", "timeline-b-deferred-world"]
status: "canon"
canon_lock: true
tags: ["system", "network", "governance", "telemetry", "evidence", "deterministic-replay"]
related:
  - CODEX.PRIME.BATCAVE
  - CODEX.PRIME.BATSUIT
  - CODEX.PRIME.BATMOBILE
  - CODEX.PRIME.BATWING
---

# BatNet

## 0) Canon Summary
BatNet is the encrypted, append-only governance and evidence network that binds Prime artifacts and decisions into a single auditable truth—enabling deterministic replay, ethical review, and canon-safe branching.

## 1) Narrative Codex (Human-Readable)
### 1.1 Description
BatNet is a moral infrastructure: every significant action is logged, contextualized, and preserved for review. It converts “vigilantism” into accountable guardianship.

### 1.2 Function & Meaning
Power that remembers what it did, why it did it, and who authorized it.

### 1.3 Constraints
- Append-only: records are never deleted or edited.
- Tiered access with revocation + incident escalation.
- Bypass attempts trigger a Canon Incident and immediate audit.

## 2) INSERT BLOCK (Paste the established lore here)
<<<BEGIN-INSERT:ESTABLISHED-LORE>>>
PASTE YOUR EXISTING BATNET PHILOSOPHY + SYSTEM TEXT HERE (verbatim)
<<<END-INSERT:ESTABLISHED-LORE>>>

## 3) Engine Hooks (How NESE reads this)
### 3.1 Canonical Object(s)
- object_id: OBJ.PRIME.BATNET
  object_type: system
  invariants:
    - Ledger is append-only and time-ordered.
    - Each event references the previous event hash (hash-chain).
    - Prime artifacts must report mission telemetry when deployed.
    - Non-lethal priority doctrine is enforceable as policy gates.
    - Canon disputes resolve via audit + authorized arbitration protocol.

### 3.2 Narrative Capabilities
- capability: CAP.PRIME.CANON_AUDIT
  description: Deterministic replay, evidence reconstruction, and ethical review.
  constraints:
    - Requires audit context and authorization role.
- capability: CAP.PRIME.BRANCHING_GOVERNANCE
  description: Allows timeline forks without retcons; forks become new timelines with preserved invariants.
  constraints:
    - A fork must log invariants preserved and modified.

## 4) State & Event Mapping (Deterministic replay)
### 4.1 State Keys
- state_key: state.prime.batnet.integrity
  type: boolean
  description: "True if BatNet is operating and trusted"
- state_key: state.prime.batnet.last_event_hash
  type: string
  description: "Hash pointer to latest canonical event"
- state_key: state.prime.batnet.alert_level
  type: string
  description: "normal | elevated | critical | breach"
- state_key: state.prime.batnet.audit_open
  type: boolean
  description: "True if an audit is ongoing"

### 4.2 Events Emitted / Consumed
- emits:
  - EVENT.EVIDENCE_LOGGED
  - EVENT.CANON_INCIDENT_FLAGGED
  - EVENT.AUDIT_INITIATED
  - EVENT.AUDIT_CLOSED
  - EVENT.POLICY_GATE_EVALUATED
- consumes:
  - EVENT.ARTIFACT_EQUIPPED
  - EVENT.VEHICLE_DEPLOYED
  - EVENT.USE_OF_FORCE_LOGGED
  - EVENT.INCIDENT_REPORTED
  - EVENT.TIMELINE_FORKED

## 5) Cross-Universe Compatibility
- allowed_crossovers:
  - universe: enlightened-dcu
    allowed: true
    notes: BatNet may interoperate with Enlightened oversight under shared transparency rules.

## 6) References
- Related codex:
  - CODEX.PRIME.BATCAVE
  - CODEX.PRIME.BATWING
  - CODEX.PRIME.BATMOBILE
  - CODEX.PRIME.BATSUIT
