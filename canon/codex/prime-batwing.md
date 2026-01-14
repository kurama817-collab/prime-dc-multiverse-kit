---
codex_id: CODEX.PRIME.BATWING
title: "Prime Batwing"
universe: "prime-batman"
timeline_scope: ["timeline-a", "timeline-b-deferred-world"]
status: "canon"
canon_lock: true
tags: ["vehicle", "aerial", "orbital", "stealth", "deployment", "telemetry"]
related:
  - CODEX.PRIME.BATCAVE
  - CODEX.PRIME.BATSUIT
  - CODEX.PRIME.BATNET
---

# Prime Batwing

## 0) Canon Summary
The Prime Batwing is Prime Batman’s stealth-first aerial platform for global response, reconnaissance, extraction, and controlled escalation—always governed by BatNet auditability and non-lethal priority doctrine.

## 1) Narrative Codex (Human-Readable)
### 1.1 Description
A modular stealth aircraft with BatNet-linked sensor fusion, adaptive flight profiles, rapid deployment, and mission-specific payload bays (recon, rescue, deterrence). Functions as a mobile extension of Prime Batcave command.

### 1.2 Function & Meaning
“Reach with restraint.” Power that can arrive anywhere—without becoming a conqueror.

### 1.3 Constraints
- Defaults to stealth + reconnaissance + deterrence.
- Lethal escalation requires recorded override authorization.
- Must produce verifiable mission logs (evidence chain).

## 2) INSERT BLOCK (Paste the established lore here)
<<<BEGIN-INSERT:ESTABLISHED-LORE>>>
PASTE YOUR EXISTING PRIME BATWING LORE HERE (verbatim)
<<<END-INSERT:ESTABLISHED-LORE>>>

## 3) Engine Hooks (How NESE reads this)
### 3.1 Canonical Object(s)
- object_id: OBJ.PRIME.BATWING
  object_type: vehicle
  invariants:
    - BatNet uplink active during any deployed state.
    - Stealth is the default posture unless emergency override is logged.
    - Payload selection must be recorded and reviewable.
    - Evidence capture is on by default (telemetry + mission narrative).
    - Extraction protocols prioritize civilian safety and reversibility.

### 3.2 Narrative Capabilities
- capability: CAP.PRIME.GLOBAL_AERIAL_RESPONSE
  description: Rapid intercontinental deployment, aerial surveillance, and emergency extraction.
  constraints:
    - Requires mission authorization token (Batcave or authenticated operator).
- capability: CAP.PRIME.AERIAL_FORENSICS
  description: Creates an auditable record of observed events with timestamped telemetry signatures.
  constraints:
    - Requires BatNet integrity state true.

## 4) State & Event Mapping (Deterministic replay)
### 4.1 State Keys
- state_key: state.prime.batwing.status
  type: string
  description: "docked | deployed | orbit | emergency | maintenance"
- state_key: state.prime.batwing.stealth_level
  type: number
  description: "0–100"
- state_key: state.prime.batwing.payload_mode
  type: string
  description: "recon | rescue | deterrence | override"
- state_key: state.prime.batwing.last_mission_id
  type: string
  description: "Most recent mission identifier"

### 4.2 Events Emitted / Consumed
- emits:
  - EVENT.MISSION_AUTHORIZED
  - EVENT.VEHICLE_DEPLOYED
  - EVENT.AERIAL_SURVEILLANCE_ACTIVE
  - EVENT.EXTRACTION_COMPLETED
  - EVENT.EVIDENCE_LOGGED
- consumes:
  - EVENT.EMERGENCY_SIGNAL_RECEIVED
  - EVENT.INCIDENT_REPORTED
  - EVENT.AUDIT_INITIATED
  - EVENT.TIMELINE_FORKED

## 5) Cross-Universe Compatibility
- allowed_crossovers:
  - universe: enlightened-dcu
    allowed: true
    notes: Batwing operations must comply with Enlightened restraint + transparency constraints when present.

## 6) References
- Related codex:
  - CODEX.PRIME.BATNET
  - CODEX.PRIME.BATCAVE
