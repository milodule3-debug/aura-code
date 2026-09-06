---
description: A worker pool applying ONE identical operation across many items (map-reduce).
argument-hint: "<operation> -- <items, glob, or count>"
---

# Stratos — the army (στρατός)

The only **homogeneous** topology: identical agents, identical brief, applied at
scale. No specialists, no negotiation, no hierarchy. Throughput is the point.

Reach for it when the work is *the same operation over many items*: audit every
route, translate every string file, add a test per module, summarize each of 40
documents.

## Worker count is not item count

This is the mistake to avoid: 200 items does **not** mean 200 agents. Use a
**pool of at most 5 workers**, each processing a batch of items in sequence.
Scale the batch, never the pool.

## Run it

1. **Resolve the item list** from `$ARGUMENTS` (split on ` -- `: operation on the
   left, items/glob on the right). **List the items and count them before
   spawning.** A glob that matches 4,000 files is a stop-and-ask, not a fan-out.
2. **Write one brief** and use it verbatim for every worker — identical
   instructions, identical output shape. Heterogeneous briefs mean you wanted
   `technitai`.
3. **Partition** items into ≤5 batches. Spawn one worker per batch. No sub-swarms.
4. **Require a machine-readable result per item** (one line: item → verdict →
   detail). Unstructured prose from 5 workers cannot be reduced.
5. **Reduce.** Aggregate into one report: totals, the failures in full, and the
   passes as a count. **Never silently drop an item** — if a worker returned
   nothing for an item, that item is "unknown", not "fine".

## Done

Every item has a verdict, the counts add up to the item total, and failures are
listed individually.
