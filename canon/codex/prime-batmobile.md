---
codex_id: CODEX.PRIME.BATMOBILE
title: "Prime Batmobile"
universe: "prime-batman"
timeline_scope: ["timeline-a"]
status: "canon"
canon_lock: true
tags: ["vehicle", "artifact", "mobility", "combat", "stealth"]
related:
  - CODEX.PRIME.BATCAVE
  - CODEX.PRIME.BATSUIT
---

# Prime Batmobile

## 2) INSERT BLOCK
<<<BEGIN-INSERT:ESTABLISHED-LORE>>>
PASTE YOUR PRIME BATMOBILE SCHEMATIC HERE
<<<END-INSERT:ESTABLISHED-LORE>>>

## 3) Engine Hooks (minimum required)
- object_id: OBJ.PRIME.BATMOBILE
  object_type: vehicle
  invariants:
    - Has non-lethal priority modes.
    - Preserves forensic trace capture when applicable.

## 4) Events (minimum)
- emits:
  - EVENT.VEHICLE_DEPLOYED
  - EVENT.NONLETHAL_MODE_ENABLED
