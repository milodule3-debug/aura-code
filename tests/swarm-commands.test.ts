import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { loadPlugin } from '../src/plugins/loader.js';
import { findInvocable, expandCommand } from '../src/plugins/commands.js';
import type { LoadedPlugin } from '../src/plugins/types.js';

const PLUGIN_DIR = path.join(__dirname, '..', 'plugins', 'swarms');
const plugin = loadPlugin(PLUGIN_DIR) as LoadedPlugin;
const plugins = [plugin];

const NAMES = ['epitropi', 'koinon', 'strategos', 'stratos', 'synergasia', 'technitai'];
/**
 * Expand a command and collapse whitespace. The bodies are wrapped prose, so a
 * multi-word phrase can straddle a newline — matching the raw text would fail
 * on line breaks rather than on missing content.
 */
const expand = async (name: string, args: string) => {
  const match = findInvocable(plugins, '/' + name);
  if (!match || match.kind !== 'command') throw new Error(`not a command: ${name}`);
  const out = await expandCommand(match.command, args, { cwd: process.cwd(), mode: 'read-only' });
  return out.replace(/\s+/g, ' ');
};

describe('swarms plugin', () => {
  it('loads with its manifest', () => {
    expect(plugin).not.toBeNull();
    expect(plugin.name).toBe('swarms');
    expect(plugin.manifest.version).toBe('0.1.0');
  });

  it('exposes exactly the six topologies', () => {
    expect(plugin.commands.map(c => c.name).sort()).toEqual(NAMES);
  });

  it('gives every command a description and an argument hint', () => {
    for (const c of plugin.commands) {
      expect(c.description, c.name).toBeTruthy();
      expect(c.argumentHint, c.name).toBeTruthy();
    }
  });

  it('resolves each by slash name, and rejects unknown ones', () => {
    for (const n of NAMES) expect(findInvocable(plugins, '/' + n)?.kind, n).toBe('command');
    expect(findInvocable(plugins, '/phalanx')).toBeNull();
  });
});

describe('swarms plugin — guardrails are stated in every command', () => {
  // These are prompts, so the guardrails only exist if the text says them. A
  // command that loses its concurrency cap fans out unbounded at runtime.
  it('caps concurrency at 5 everywhere', async () => {
    for (const n of NAMES) {
      expect(await expand(n, 'x'), n).toMatch(/\b5\b/);
    }
  });

  it('forbids sub-swarms except for the general', async () => {
    for (const n of NAMES.filter(n => n !== 'strategos')) {
      expect(await expand(n, 'x'), n).toMatch(/sub-?swarms?|spawn swarms|One level of delegation/i);
    }
    // strategos is the documented depth-2 exception: officers spawn units.
    expect(await expand('strategos', 'x')).toMatch(/officer/i);
    expect(await expand('strategos', 'x')).toMatch(/units spawn nothing/i);
  });

  it('requires announcing the plan before spawning', async () => {
    for (const n of NAMES) {
      expect(await expand(n, 'x'), n).toMatch(/announce|before spawning|before you finish/i);
    }
  });
});

describe('swarms plugin — argument handling', () => {
  it('substitutes $ARGUMENTS into technitai', async () => {
    const out = await expand('technitai', 'coder, tester -- build a landing page');
    expect(out).toContain('coder, tester -- build a landing page');
    expect(out).not.toContain('$ARGUMENTS');
  });

  it('tells technitai to stop rather than guess when the -- delimiter is missing', async () => {
    const out = await expand('technitai', 'coder tester build a landing page');
    expect(out).toMatch(/do not guess where the roles end/i);
  });

  it('makes stratos separate worker count from item count', async () => {
    const out = await expand('stratos', 'audit routes -- src/**/*.ts');
    expect(out).toMatch(/Worker count is not item count/i);
    expect(out).toMatch(/pool of at most 5/i);
  });

  it('makes synergasia commit to a write-serialization strategy', async () => {
    const out = await expand('synergasia', 'write the launch post');
    expect(out).toMatch(/One writer per file/i);
    expect(out).toMatch(/Section ownership/i);
    expect(out).toMatch(/Sequential passes/i);
  });

  it('makes koinon persist to a guild file and read it first', async () => {
    const out = await expand('koinon', 'api-research summarise the auth flow');
    expect(out).toContain('.aura/guilds/');
    expect(out).toMatch(/Read the guild file first/i);
    expect(out).toMatch(/Write back before you finish/i);
  });

  it('makes strategos gate phases and halt on failure', async () => {
    const out = await expand('strategos', 'migrate to postgres');
    expect(out).toMatch(/halts the campaign/i);
    expect(out).toMatch(/success condition/i);
  });

  it('makes epitropi review against a criterion stated up front', async () => {
    const out = await expand('epitropi', 'audit this codebase for security');
    expect(out).toMatch(/acceptance criterion/i);
    expect(out).toMatch(/Reject and re-brief \*\*once\*\*/i);
  });
});
