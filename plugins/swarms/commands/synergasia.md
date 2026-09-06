---
description: Agents converge on ONE shared artifact, with an explicit write lock so they cannot clobber each other.
argument-hint: "<goal>"
---

# Synergasia — joint work on one artifact (συνεργασία, "working together")

Roles are **fluid** and the output is **one artifact**. That single shared
artifact is what separates this from `epitropi`, where agents produce separate
deliverables that a lead staples together.

## The rule that makes this work

**One writer per file at a time.** Two agents editing one file concurrently lose
each other's edits — there is no merge algorithm here, just last-write-wins.
So before spawning anything, choose one:

- **Section ownership** — split the artifact into named, non-overlapping regions
  (headings, functions, CSS blocks). Each agent owns regions, never the whole file.
- **Sequential passes** — agents run one after another over the whole artifact,
  each with a different job (structure → content → polish). Slower, but safe for
  work that genuinely cannot be partitioned.

State which one you picked and why. "Merge in real time" is not a plan.

## Run it

1. **Create the artifact first**, as a skeleton with the section markers in place.
   Agents edit an existing file; they do not each invent their own.
2. **Announce** the split: agent → sections owned, or the pass order.
3. **Spawn** at most **5 concurrent**, and only for section ownership. Sequential
   passes run one at a time by definition. No sub-swarms.
4. **Merge and reconcile.** Read the whole artifact yourself afterwards. Section
   ownership prevents clobbering, not incoherence — voice, naming, and duplicated
   logic across sections are yours to fix.
5. **Verify the artifact as a whole**, not section by section: the page renders,
   the file compiles, the document reads as one voice.

## Done

One artifact exists, it is coherent end to end, and you have named what you
verified about it.
