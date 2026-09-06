/**
 * Domain expertise injection.
 *
 * Cheap keyword classification (same philosophy as loop-profile.ts —
 * no LLM call spent deciding this) that appends a concrete, domain-specific
 * checklist to the system prompt. This is Phase 1 of mixture-of-agents:
 * single-agent, prompt-level expertise. Phase 2 (parallel domain sub-agents
 * via spawn_task, for exploratory-shaped tasks) builds on top of this.
 */

export type Domain =
  | 'frontend'
  | 'backend'
  | 'database'
  | 'security'
  | 'devops'
  | 'testing'
  | 'algorithms'
  | 'gamedev'
  | 'graphics3d';

const DOMAIN_SIGNALS: Record<Domain, string[]> = {
  frontend: [
    'component', 'react', 'vue', 'svelte', 'css', 'ui', 'button', 'style',
    'layout', 'responsive', 'dom', 'render', 'accessibility', 'a11y',
  ],
  backend: [
    'api', 'endpoint', 'route', 'server', 'controller', 'middleware',
    'request', 'response', 'rest', 'graphql', 'webhook',
  ],
  database: [
    'database', 'query', 'migration', 'schema', 'sql', 'index', 'table',
    'orm', 'transaction', 'postgres', 'mysql', 'sqlite', 'nosql',
  ],
  security: [
    'auth', 'security', 'vulnerability', 'sanitize', 'injection', 'xss',
    'csrf', 'password', 'token', 'encrypt', 'permission', 'oauth',
    'credential', 'secret',
  ],
  devops: [
    'deploy', 'ci/cd', 'docker', 'pipeline', 'kubernetes', 'infra',
    'terraform', 'systemd', 'container', 'github actions', 'workflow file',
  ],
  testing: [
    'test', 'spec', 'coverage', 'mock', 'assertion', 'e2e',
    'unit test', 'integration test', 'fixture',
  ],
  algorithms: [
    'algorithm', 'performance', 'optimize', 'complexity', 'big o',
    'sort', 'search', 'cache', 'memoize', 'time limit', 'benchmark',
  ],
  gamedev: [
    'game', 'gameplay', 'player', 'level', 'sprite', 'collision', 'physics',
    'godot', 'phaser', 'unity', 'unreal', 'platformer', 'shooter', 'rpg',
    'game loop', 'frame rate', 'hitbox', 'spawn', 'enemy', 'score',
  ],
  graphics3d: [
    'blender', 'bpy', '3d', 'mesh', 'glb', 'gltf', 'fbx', 'shader', 'render',
    'texture', 'material', 'uv', 'rig', 'skeleton', 'animation', 'camera',
    'lighting', 'three.js', 'threejs', 'webgl', 'low-poly', 'polygon',
  ],
};

const DOMAIN_EXPERTISE: Record<Domain, string> = {
  frontend: `**Frontend expertise:**
- Match existing component patterns (class vs functional, prop conventions) before introducing new ones.
- Check for accessibility basics: semantic elements, alt text, keyboard navigation, focus management.
- Verify responsive behavior isn't broken by hardcoded pixel values where the codebase uses relative units elsewhere.
- Don't introduce a new state-management pattern when one already exists in the project.`,

  backend: `**Backend expertise:**
- Validate and sanitize all external input at the boundary — never trust request bodies, query params, or headers.
- Match existing error-response shape and status-code conventions; don't invent a new error format.
- Check for N+1 query patterns when adding data fetching inside a loop.
- Idempotency matters for anything that can be retried (webhooks, payment endpoints, queue consumers).`,

  database: `**Database expertise:**
- Every migration must be reversible — write the down migration, don't skip it.
- Check whether a new query needs an index before it ships, not after a slow-query report.
- Wrap multi-step writes in a transaction; a partial write is a data-integrity bug.
- Never generate a migration that silently drops or truncates a column with existing data without flagging it explicitly.`,

  security: `**Security expertise:**
- Never log secrets, tokens, or passwords, even at debug level.
- Parameterize all queries — string-concatenated SQL is an injection vector regardless of "trusted" input.
- Check auth/permission boundaries on every new endpoint or route, not just the ones the task explicitly mentions.
- Treat any credential found in code, commits, or chat as compromised — flag it once, recommend rotation, don't just fix the immediate leak.`,

  devops: `**DevOps expertise:**
- Pin dependency and base-image versions explicitly; don't introduce floating tags (":latest") into pipeline or container configs.
- Any change to a CI/CD workflow file should be validated against what actually breaks the build, not just syntax-checked.
- Secrets belong in the secrets manager / env injection, never hardcoded into a workflow or Dockerfile.
- Changes to deploy scripts should be idempotent — running twice shouldn't double-apply anything.`,

  testing: `**Testing expertise:**
- A test that can't fail (no real assertion, or asserts on a mock's own return value) is worse than no test.
- Match the existing test framework and assertion style already used in the file/project — don't mix frameworks.
- Cover the actual bug/edge case the task describes, not just the happy path.
- Flaky-looking tests (timing-dependent, order-dependent) should be flagged, not silently retried into passing.`,

  algorithms: `**Algorithms/performance expertise:**
- State the actual time/space complexity of a proposed change if it touches a hot path or large input.
- Don't optimize prematurely — profile or reason about the actual bottleneck before restructuring.
- Watch for accidental O(n²) from nested iteration over the same collection (e.g. .includes() inside a .map()).
- Memoization/caching needs an explicit invalidation story, not just an add.`,

  gamedev: `**Game development expertise:**
- Ship something playable on the first pass: input, a win condition and a lose condition beat a prettier scene with no game in it. Use game_scaffold for the skeleton instead of hand-rolling a loop.
- Make the update loop frame-rate independent — multiply by delta time, and clamp delta (a backgrounded tab returns a huge one that tunnels bodies through the floor).
- Keep tunables (gravity, speed, jump height, spawn rates) in one config module, and keep level layout as data (arrays/scene files), not scattered literals — that is what makes iteration cheap.
- Derive collision from the same data as the visible geometry, so art and physics cannot drift apart.
- Verify by actually running it: serve the project and drive it with the browser tool, or run the engine headless. "It compiles" is not "it plays".`,

  graphics3d: `**3D / Blender expertise:**
- Blender work is headless Python: \`blender action=exec\` / \`action=script\` through the blender tool. Never assume a GUI, and never leave a script that only works when clicked.
- Start any generation script from a known state (\`bpy.ops.wm.read_factory_settings(use_empty=True)\`) — Blender's default cube and leftover datablocks silently pollute exports.
- Prefer procedural, re-runnable scripts over binary .blend edits: they diff, they review, and they regenerate the same asset every time.
- glTF/GLB is the default interchange format for real-time engines; keep transforms applied, scale in metres, and Y-up handled by the exporter rather than by hand.
- Watch poly count and texture size for anything destined for a game — check the result with \`blender action=scene\` instead of trusting the script.
- Verify a render or export by inspecting the produced file (it exists, its size is sane, \`action=scene\` lists the objects you expect), not by the absence of an error.`,
};

/**
 * Score each domain by keyword hits and return the top matches (max 2,
 * to keep the prompt lean). Returns [] when nothing matches — most tasks
 * don't need domain framing beyond the base system prompt.
 */
export function classifyDomains(task: string): Domain[] {
  const lower = task.toLowerCase();
  const scored = (Object.keys(DOMAIN_SIGNALS) as Domain[])
    .map((domain) => ({
      domain,
      score: DOMAIN_SIGNALS[domain].filter((signal) => lower.includes(signal)).length,
    }))
    .filter((d) => d.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 2).map((d) => d.domain);
}

/**
 * Build the domain-expertise prompt block for a task. Empty string if
 * no domain matched — callers should skip the section entirely rather
 * than inject an empty heading.
 */
export function getDomainPromptBlock(task: string): string {
  const domains = classifyDomains(task);
  if (domains.length === 0) return '';

  const blocks = domains.map((d) => DOMAIN_EXPERTISE[d]).join('\n\n');
  return `\n## Domain expertise (applies to this task)\n\n${blocks}\n`;
}
