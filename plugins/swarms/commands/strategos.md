---
description: A phased campaign — general sets strategy, officers own phases, units do the work.
argument-hint: "<campaign objective>"
---

# Strategos — the general (στρατηγός)

The only topology here with **two levels of command** and **sequenced phases**.
Use it when the objective is too large for one dispatch and later work depends
on what earlier work discovers. If the phases are independent, you want
`epitropi`; if there are no phases at all, you want `technitai`.

## Run it

1. **Write the campaign plan** for `$ARGUMENTS` before spawning anything:
   **2–4 phases**, each with an objective, a success condition, and what the next
   phase needs from it. Phases are ordered because of dependency, not tidiness —
   if you cannot say what phase 2 needs from phase 1, they are not phases.
2. **Announce the plan** and hold it. This is a campaign; the user should be able
   to stop it at phase 1.
3. **One officer per phase**, spawned when its phase begins — never all at once.
   An officer may spawn at most **3 units**. That is the depth limit: general →
   officer → unit, and units spawn nothing.
4. **Gate every phase.** Check the success condition before starting the next one.
   A failed phase **halts the campaign** — report what was achieved, what failed,
   and what you would change. Do not push into phase 3 hoping phase 2 sorts itself out.
5. **Re-plan when reality disagrees.** If phase 1 invalidates the plan, say so and
   present a revised plan instead of executing a plan you know is wrong.

## Done

Every phase met its success condition, or the campaign halted at a named phase
with a stated reason. Report per phase — a single summary hides where it broke.
