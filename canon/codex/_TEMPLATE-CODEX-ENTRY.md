---
codex_id: CODEX.PRIME.<REPLACE_ME>
title: "<REPLACE_ME>"
universe: "prime-batman"
timeline_scope: ["timeline-a"]
status: "canon"
canon_lock: true
tags: ["artifact", "location", "system", "vehicle", "protocol"]
related:
  - CODEX.PRIME.<OPTIONAL>
---

# <TITLE>

## 0) Canon Summary (1 paragraph)
<What this is + why it matters + what it enables.>

## 1) Narrative Codex (Human-readable)
### 1.1 Description
<High-level description.>

### 1.2 Function & Meaning
<Thematic purpose + story role.>

### 1.3 Constraints
- <What it cannot do>
- <What it must always preserve>

## 2) INSERT BLOCK (Paste the established lore here)
> **INSERT INSTRUCTIONS**
> - Paste the full established lore exactly as written (no edits) inside this block.
> - If you have multiple versions, label them “Version A / Version B” inside the block.
> - Do not add engine notes inside the block—keep it pure lore.

<<<BEGIN-INSERT:ESTABLISHED-LORE>>>
<Paste the Prime Batcave / Batmobile / Batsuit / etc. text here>
<<<END-INSERT:ESTABLISHED-LORE>>>

## 3) Engine Hooks (How NESE reads this)
### 3.1 Canonical Object(s)
- object_id: OBJ.PRIME.<REPLACE_ME>
  object_type: <artifact|location|system|vehicle|character>
  invariants:
    - <Invariant 1>
    - <Invariant 2>

### 3.2 Narrative Capabilities
- capability: <REPLACE_ME>
  description: <What the engine can do with it>
  constraints:
    - <Constraint 1>

## 4) State & Event Mapping (Deterministic replay)
### 4.1 State Keys
- state_key: state.prime.<name>
  type: <string|number|boolean|object|array>
  description: <what this stores>

### 4.2 Events Emitted / Consumed
- emits:
  - EVENT.<REPLACE_ME>
- consumes:
  - EVENT.<REPLACE_ME>

## 5) Cross-Universe Compatibility (if applicable)
- allowed_crossovers:
  - universe: enlightened-dcu
    allowed: true
    notes: <What rules apply>

## 6) References
- Related codex:
  - CODEX.PRIME.<REPLACE_ME>
