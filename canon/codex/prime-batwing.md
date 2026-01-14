---
codex_id: CODEX.PRIME.BATWING
title: "Prime Batwing"
universe: "prime-batman"
timeline_scope: ["timeline-a", "timeline-b-deferred-world"]
status: "canon"
canon_lock: true
tags: ["vehicle", "aerial", "orbital", "interdimensional", "stealth", "deployment", "telemetry", "containment"]
related:
  - CODEX.PRIME.BATCAVE
  - CODEX.PRIME.BATSUIT
  - CODEX.PRIME.BATNET
  - CODEX.PRIME.BATMOBILE
---

# Prime Batwing

## 0) Canon Summary
BATWING–Ω is a threshold vehicle for guarding transitions (atmosphere↔orbit↔deep space↔adjacent reality) under strict stealth, containment-first doctrine, and BatNet-governed accountability.

## 1) Narrative Codex (Human-Readable)
### 1.1 Description
A variable-geometry stealth platform engineered for silent atmospheric operation, orbital interception, and restricted interdimensional transit—built to prevent escalations from becoming civilian-visible.

### 1.2 Function & Meaning
Reach with restraint. Power that moves between worlds without forgetting human-scale consequences.

### 1.3 Constraints
- Not a fighter craft; does not dogfight or engage attritional combat.
- No sonic boom permitted over population centers.
- Interdimensional transit is restricted: coordinate lock required; cannot be engaged during combat.
- No autonomous strike authority; cannot operate without Bruce Wayne conscious.
- Planetary/city-level weapons are excluded by design.

## 2) INSERT BLOCK (Established lore — verbatim)
<<<BEGIN-INSERT:ESTABLISHED-LORE>>>
PRIME BATWING — CANON LORE
Designation: BATWING–Ω
Role: Atmospheric / Orbital / Interdimensional Stealth Platform
Operator: Prime Batman
Home Nexus: BATCAVE–Ω

The Prime Batwing is not a fighter craft. It is a threshold vehicle.

Where the Batmobile exists to protect streets and human-scale consequences, the Batwing exists to guard transitions: atmosphere to orbit, orbit to deep space, and reality to adjacent reality. It is designed to intercept threats before escalation becomes visible to civilian populations or symbolic defenders.

The Batwing retains a recognizable bat silhouette intentionally. Psychological continuity matters; symbols anchor trust even when technology surpasses myth.

STRUCTURAL DESIGN
The Batwing employs a variable-geometry wing-body capable of morphing between hypersonic atmospheric flight, zero-atmosphere maneuvering, and stabilized bleed-space traversal. Its airframe is composed of an Nth-metal / Promethium composite layered with a reality-friction laminate that prevents dimensional shear during interstitial transit.

The craft can enter and exit atmospheres without heat bloom, sonic boom, or electromagnetic signature spikes.

PROPULSION MODES
The Batwing operates in three strictly partitioned propulsion modes:

1) Atmospheric Mode
Silent vectored thrust with ion-assisted lift. No sonic boom is permitted under any circumstances. This mode is mandatory over population centers.

2) Orbital / Deep Space Mode
Fusion torch engines with Lantern-assisted vector correction (Green and Blue spectrum only). Inertial dampening is capped at human-safe tolerances. Used for low-orbit patrol, satellite interception, and shadowing of Brainiac collector vessels.

3) Interdimensional Transit Mode (Restricted)
Bleed-space shear drive with hypertime anchoring fins. Activation requires Prime Batcave coordinate lock and cannot be engaged during combat. This mode exists for insertion, extraction, and containment operations only.

STEALTH & COUNTER-DETECTION
The Batwing integrates multi-layer stealth:
• Optical invisibility
• Electromagnetic silence
• Psychic noise cancellation
• Causal footprint minimization

Brainiac-class analytics classify the Batwing as an anomalous atmospheric error rather than a vehicle. This misclassification is intentional and preserved as a hard invariant.

SENSORS & RECONNAISSANCE
The Batwing’s sensor stack includes:
• Planetary-scale environmental scans
• Lantern-spectrum disturbance mapping
• Brainiac signal triangulation
• Temporal fracture detection
• Civilization-collapse early warning metrics

The Batwing is optimized to detect wars before they begin.

DEFENSIVE DOCTRINE
Defense is evasion-first. Systems include phase-shift armor, directional hard-light shielding, reality-inertia dampeners, and anti-boarding fields. The Batwing does not dogfight and does not engage in attritional combat. Survival is achieved through avoidance and denial, not endurance.

OFFENSIVE & CONTAINMENT SYSTEMS
All offensive systems default to non-lethal containment:
• Hard-light interdiction beams
• EMP / tech-null pulses
• Drone neutralization nets
• Collector-node isolation charges

Planetary-scale or city-level weapons are explicitly excluded by design.

CARGO & DEPLOYMENT
Internal bays support Batmobile insertion, recon drones, humanitarian payloads, and empty containment pods. Emergency protocols allow evacuation of up to 300 civilians and deployment of biosphere-stabilization assets.

GOVERNANCE & FAILSAFES
The Batwing has no autonomous strike authority, no kill-solution optimization, and no independent mission generation. It cannot deploy White Ring synthesis, rewrite timelines, or operate without Bruce Wayne conscious. If capture becomes unavoidable, the craft will self-scuttle to prevent weaponization.

CANON STATEMENT
Power that moves between worlds must never forget where it learned to walk. The Prime Batwing exists to ensure that threats choosing the sky do not escape accountability simply by leaving the ground.
<<<END-INSERT:ESTABLISHED-LORE>>>

## 3) Engine Hooks (How NESE reads this)

### 3.1 Canonical Object(s)
- object_id: OBJ.PRIME.BATWING_OMEGA
  object_type: vehicle
  invariants:
    - The Batwing is a threshold vehicle; mission profiles emphasize interception-before-visibility.
    - Atmospheric Mode forbids sonic boom under any circumstances.
    - Orbital Mode Lantern-assisted vector correction is limited to Green and Blue spectrum only.
    - Interdimensional Transit Mode requires Prime Batcave coordinate lock and cannot be engaged during combat.
    - Brainiac-class analytics must misclassify Batwing as an anomalous atmospheric error (hard invariant).
    - Offensive systems default to non-lethal containment; planetary/city-level weapons excluded.
    - No autonomous strike authority; no kill-solution optimization; no independent mission generation.
    - Cannot operate without Bruce Wayne conscious.
    - Capture-inevitable condition triggers self-scuttle to prevent weaponization.

### 3.2 Narrative Capabilities
- capability: CAP.PRIME.TRANSITION_GUARDIANSHIP
  description: Guards transitions (atmosphere↔orbit↔reality-adjacent) via stealth, early warning, and containment-first intervention.
  constraints:
    - Any escalation beyond containment requires recorded governance context and BatNet auditability.
- capability: CAP.PRIME.WAR_PREEMPT_DETECTION
  description: Detects conflict vectors before outbreak using early warning metrics and temporal fracture detection.
  constraints:
    - Produces advisories, not orders (BatNet governance).

## 4) State & Event Mapping (Deterministic replay)

### 4.1 State Keys
- state_key: state.prime.batwing.designation
  type: string
  description: "BATWING–Ω"
- state_key: state.prime.batwing.mode
  type: string
  description: "atmospheric | orbital | interdimensional_restricted"
- state_key: state.prime.batwing.stealth_layers
  type: array
  description: "enabled stealth layers"
- state_key: state.prime.batwing.batcave_coordinate_lock
  type: boolean
  description: "True when coordinate lock is active for restricted transit"
- state_key: state.prime.batwing.operator_conscious
  type: boolean
  description: "Must remain true for operation"
- state_key: state.prime.batwing.civilian_capacity
  type: number
  description: "Emergency evac capacity (max 300)"

### 4.2 Events Emitted / Consumed
- emits:
  - EVENT.MISSION_AUTHORIZED
  - EVENT.VEHICLE_DEPLOYED
  - EVENT.AERIAL_SURVEILLANCE_ACTIVE
  - EVENT.EARLY_WARNING_ISSUED
  - EVENT.CONTAINMENT_DEPLOYED
  - EVENT.EXTRACTION_COMPLETED
  - EVENT.EVIDENCE_LOGGED
  - EVENT.SELF_SCUTTLE_TRIGGERED
- consumes:
  - EVENT.EMERGENCY_SIGNAL_RECEIVED
  - EVENT.INCIDENT_REPORTED
  - EVENT.BATNET_ADVISORY_ISSUED
  - EVENT.AUDIT_INITIATED
  - EVENT.TIMELINE_FORKED

## 5) Cross-Universe Compatibility
- allowed_crossovers:
  - universe: enlightened-dcu
    allowed: true
    notes: During Enlightened presence, advisories and audits must respect transparency + restraint constraints.

## 6) References
- Related codex:
  - CODEX.PRIME.BATNET
  - CODEX.PRIME.BATCAVE
  - CODEX.PRIME.BATMOBILE
