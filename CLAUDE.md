# Aura Code — App Description

Context/instructions for this codebase: what Aura Code is, how it's structured, how it runs.

---

## What this app is

**Aura Code** = model-agnostic, autonomous coding agent CLI. Natural-language task → read codebase → plan → execute (edit files, run commands) → verify → report.

- **Package:** `aura-code` (v0.9.0), CLI binary `aura`
- **Language:** TypeScript (strict), CommonJS, Node ≥ 18
- **Framework name:** *Praktess* ("she who acts and executes")
- **License:** MIT
- **Entry point:** `dist/cli/index.js` (from `src/cli/index.ts`)

Run:

```bash
npm install -g aura-code
aura 'your task here'
```

Need at least one provider API key (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `XIAOMI_API_KEY`, `ZHIPU_API_KEY`) or local Ollama model.

---

## Core loop

1. **Read** — inspects files, structure, dependencies (perception layer).
2. **Plan** — decides what to change, how.
3. **Execute** — writes code, runs shell commands, edits via tools.
4. **Verify** — runs tests, checks file integrity, confirms changes.
5. **Report** — summarizes what was done, what passed.

Single-agent loop: `src/agent/loop.ts`. System prompt: `src/agent/system-prompt.ts`.

---

## Modes (CLI flags)

| Mode | Flag | What it does |
|------|------|--------------|
| normal | *(default)* | Single-agent: read → plan → execute → verify |
| orchestrate | `--orchestrate` | Multi-agent: Researcher → Coder → Reviewer |
| architect | `--architect` | Design/planning before implementation |
| verify | `--verify` | Post-task checks, auto-retry on failure |
| analyze | `--analyze` | Scans session history for failure patterns |

Notable flags: `--auto` (autonomous), `--readonly`, `--model/-m`, `--fallback`, `--resume`, `--plan`, `--workflow`, `--blueprint`, `--models`.

---

## Providers (model-agnostic)

Resolved through `src/providers/`: resilient factory, fallback chain, circuit breaker, rate limiting.

| Provider | Models |
|----------|--------|
| Claude (Anthropic) | Opus, Sonnet, Haiku |
| GPT (OpenAI) | gpt-4o, gpt-4o-mini |
| Gemini (Google) | gemini-2.5-pro, gemini-2.5-flash |
| MiMo (Xiaomi) | mimo-v2.5-pro, mimo-v2.5 |
| GLM (Zhipu / Z.ai) | glm-5.2, glm-5.1, glm-5 — general endpoint default, `zhipu-coding/<model>` for Coding Plan |
| Ollama (local) | any local model, no API key |
| Any OpenAI-compatible endpoint | via `openrouter/<model>` or custom `.aura.json` providers |

Custom providers: register in `.aura.json` (e.g. DeepSeek configured here).

---

## Source layout (`src/`)

- `agent/` — core loop, context building, system prompt, session store, sub-agent spawner
- `orchestration/` — multi-agent router, orchestrator, specialists, plan store
- `architect/` — blueprint engine, types for high-level design
- `perception/` — codebase extraction, graph store, queries ("read" layer)
- `providers/` — LLM provider adapters + resilient factory, fallback, types
- `tools/` — agent tool implementations (see below)
- `verify/` — verification checks, retry logic
- `safety/` — permission system, confirmation prompts
- `harness/` — weakness mining, self-improvement proposals
- `workflows/` — multi-step workflow engine
- `archimedes/` — episode capture, competence, fine-tuning / local model support
- `server/` — Express + WS server, session handling
- `viz/` — dashboard generation
- `setup/` — first-run wizard, global config
- `cli/` — argument parsing, terminal display, entry point
- `config/` — defaults, fallback chain, project config resolution
- `util/` — circuit breaker, rate limiter, retry, env, errors

---

## Tools available to the agent

Defined in `src/tools/`, registered in `src/tools/index.ts`:
`read_file`, `list_dir`, `edit_file`, `write_file`, `search_code`, `run_shell`,
`run_tests`, `git` (status/diff), `spawn_task` (sub-agents), `web_fetch`,
`web_search`, `browser`, `http_request`, `memory`, `clipboard`, `notify`,
`image_read`, `email`, `calendar`, `telegram`, `whatsapp`, `cron`, `mcp`
(MCP client — connect/disconnect/list_tools/call_tool/list_servers; `connect`
permission-gated like `run_shell`).

---

## Configuration

- `.aura.json` — project-level model + custom provider config
- `.env.example` — documents supported env vars / API keys
- Global config via first-run wizard (`src/setup/`)
- `AURA_MODEL`, `AURA_FALLBACK_MODEL`, `AURA_MAX_RETRIES`, `AURA_API_RPM/TPM`
  environment overrides

---

## Build, run, test

```bash
npm run build     # tsc -> dist/
npm run dev       # ts-node src/cli/index.ts
npm start         # node dist/cli/index.js
npm test          # vitest run
```

Tests in `tests/`, run under Vitest (`vitest.config.ts`).

---

## Aura OP One (`src/op-one/`) — the minimal client

A second, separate product living in this tree: **Aura OP One**, the minimal
personal and agentic client. Shell command **`opone`** (binary
`dist/op-one/cli.js`). Full design: `AURA_OP_ONE_ARCHITECTURE.md`.

Canonical loop: *request → retrieve experience → select agent/model → act →
verify → record episode → improve future routing*.

**It is a client, not a second engine.** Execution, tools, providers, the
verification gate, permissions and credentials all stay in aura-code.

### The one rule that matters here

`src/op-one/engine.ts` is the **only** file in `src/op-one/` allowed to import
aura-code internals (`../agent/`, `../verify/`, `../archimedes/`, `../safety/`,
`../providers/`, `../cli/`). Everything else depends on the `Engine` interface.

If you need a new aura-code capability in the client, **add a method to `Engine`
and implement it in `engine.ts`** — do not import across the boundary from
`session.ts`, `memory.ts`, `commands.ts` or anywhere else. That seam is what
keeps the client thin and what makes the planned extraction into a standalone
`aura-op-one` repo mechanical. `tests/op-one/fake-engine.ts` substitutes for it,
so breaking the rule also breaks the tests' ability to run without a provider.

### Invariants — do not weaken these

- `verified` is reachable **only** from `verification_pending`, and only when the
  gate approved. A gate that throws yields `escalated`, never a pass. Never
  display or store `verified` for output the gate did not approve.
- Verified engineering experience outranks unverified conversation by a
  *dominating tier* in `memory.ts`, not a weight. Do not "rebalance" those into
  comparable numbers.
- `knowledgeStore` accepts **verified items only**; it throws otherwise.
- Agent Mesh is off by default in config *and* in code (the default transport is
  never available). Mesh-reported actions are re-checked locally before counting
  as evidence.
- Commits need verification **and** explicit user approval. There is no
  auto-commit path, and `confirm` defaults to refusing.
- Anything bound for a store, a log, or the UI goes through `redactSecrets` /
  `redactValue` first.

### Working on it

```bash
npx vitest run tests/op-one          # the client's own suite
node dist/op-one/cli.js --help       # after npm run build
AURA_OP_ONE_DIR=/tmp/x node dist/op-one/cli.js   # isolate its stores
```

Storage is six **separate** categories under `~/.aura/op-one/` (conversations,
preferences, agents, knowledge, episodes) plus in-memory scratch. Do not merge
them into one store — the separation is what makes memory scoping enforceable.
Override the root with `AURA_OP_ONE_DIR`; always set it in tests.

The default screen shows only conversation, active agent, active model,
verification state, and `:help`. No graphs, dashboards, telemetry, or routing
internals — that surface belongs to aura-pulse.

Deferred on purpose (see §13): autonomous agent generation, dashboards,
background autonomous operation, auto fine-tuning, a vector DB, a second
verification system, a second orchestration engine.

---

## Notes for agents in this repo

- `dist/` compiled from `src/` — edit `src/`.
- Imports use `.js` extensions (ESM-style specifiers compiled for Node).
- Keep model-agnostic abstraction: add providers through `src/providers/`
  and factory, not ad-hoc SDK calls elsewhere.
- Respect permission/safety layer (`src/safety/`) for filesystem/shell ops.