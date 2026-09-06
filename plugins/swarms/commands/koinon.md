---
description: A named guild with memory that survives the session; recall it later by name.
argument-hint: "<guild-name> <goal>   (or: <guild-name> alone to recall)"
---

# Koinon — a guild with shared memory (κοινόν, "commons")

A self-organizing pool around a **persistent shared context**. The guild
outlives the task and the session — that is the whole point. A guild that dies
with the task is just `synergasia` with extra ceremony.

This is the blackboard pattern: agents coordinate through what they read and
write in a shared store, not through direct dispatch.

## Where the guild lives

`.aura/guilds/<guild-name>.md`, in the project. Structure it as:

```
# Guild: <name>
## Charter        — what this guild is for (write once)
## Knowledge      — durable findings, conventions, decisions
## Open questions — what is still unresolved
## Log            — dated one-line entries per session
```

## Run it

1. **Parse** `$ARGUMENTS`: first token is the guild name, the rest is the goal.
   No goal → this is a **recall**: read the file and summarize where things stand.
2. **Read the guild file first, always.** If it does not exist, create it and
   write the charter from the goal. Never start a guild task without loading its
   accumulated context — inheriting that context is the feature.
3. **Work the goal**, spawning agents only where parallelism helps (at most **5**,
   no sub-swarms). Every agent gets the guild's Knowledge section in its brief.
4. **Write back before you finish.** Append durable findings to Knowledge, update
   Open questions, add one dated Log line. Write back **facts and decisions**, not
   narration — a guild file that accumulates "I looked at the code" is worthless
   by its third session.
5. **Keep it bounded.** If Knowledge exceeds roughly 200 lines, consolidate:
   merge duplicates, drop what has been superseded. State that you did.

## Done

The goal is met **and** the guild file is updated. Finishing the task without
writing back is the one failure mode that makes this topology pointless.
