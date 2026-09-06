---
description: Fixed team of named specialists, each owning a disjoint slice of the work.
argument-hint: "<role1, role2, ...> -- <goal>"
---

# Technitai — a team of specialists (τεχνῖται, "craftsmen")

Roles are **fixed by the user** and outputs are **disjoint**: every agent owns
its own files and no two agents write the same file. No negotiation, no lead
reviewing — the roles already say who does what.

## Input

Expected form: `<role list> -- <goal>`. What you were given:

> $ARGUMENTS

Split on the first ` -- `. Left of it is a comma-separated role list, right of it
is the goal. If there is no ` -- `, do not guess where the roles end: state the
expected form and stop.

## Run it

1. **Assign.** For each role, write a one-line brief and an explicit file scope
   (paths or globs it may write). Scopes must not overlap. If two roles need the
   same file, that is a design smell — either merge the roles or give one of them
   ownership and the other a read-only dependency.
2. **Announce** the roster before spawning: role → brief → file scope. This is the
   user's chance to stop you.
3. **Spawn** one `spawn_task` per role, at most **5 concurrent**. More roles than
   that: run them in waves, dependencies first.
4. **Do not let sub-agents spawn swarms.** One level of delegation only.
5. **Collect.** Report per role: what it produced, what it verified, what it
   skipped. Do not merge the summaries into a single blur — the point of fixed
   roles is that you can see which one failed.

## Done

Every role has delivered inside its scope, the project still builds and its tests
still pass, and you have stated which of those you actually ran versus assumed.
