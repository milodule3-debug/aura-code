# swarms

Six multi-agent topologies as Aura commands. Each names a coordination shape and
gives the agent an explicit protocol for it — sizing, guardrails, and a done
condition — instead of "spawn some agents and hope".

## Install

```bash
cp -r plugins/swarms ~/.aura/plugins/     # or symlink it
aura '/technitai coder, tester -- build a landing page'
```

Override the plugin directory with `AURA_PLUGIN_DIR` (used by the tests).

## The six

| Command | Shape | Reach for it when |
|---|---|---|
| `/technitai <roles> -- <goal>` | Fixed specialists, disjoint outputs | You already know the roles and their file scopes don't overlap |
| `/epitropi <task>` | Coordinator appoints and reviews | You want one lead deciding the split and vetting the results |
| `/synergasia <goal>` | Many agents, **one** artifact | The output is a single document/file that must read as one voice |
| `/koinon <guild> <goal>` | Persistent guild + shared memory | Work recurs over days and context should accumulate |
| `/strategos <objective>` | General → officers → units, phased | Later work depends on what earlier work discovers |
| `/stratos <op> -- <items>` | Homogeneous worker pool | One identical operation across many items |

## Why they differ (the axes)

- **Coordination**: peer (`synergasia`) · dispatched (`epitropi`, `technitai`) ·
  shared-context (`koinon`) · layered (`strategos`)
- **Role stability**: fixed (`technitai`, `stratos`) · formed per task (the rest)
- **Capability**: homogeneous (`stratos`) · specialized (all others)
- **Depth**: 1 for everything except `strategos`, which allows 2

## Shared guardrails

Every command carries these, because auto-sizing without them burns quota:

- **≤ 5 concurrent sub-agents.** `stratos` scales the *batch*, never the pool.
- **Depth 1** — sub-agents don't spawn swarms. `strategos` is the sole exception
  (general → officer → unit), and units spawn nothing.
- **Announce before spawning** — roster, plan, or item count, so the user can stop it.
- **Report failures individually.** No aggregate that hides a failed assignment.

## Status

The command bodies are prompts, and they load, resolve and expand correctly
(`tests/swarm-commands.test.ts`). Their *behaviour* under a live model is
unproven — nothing here has been run end to end against a real swarm yet.
