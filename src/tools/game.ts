// ─────────────────────────────────────────────────────────────────────────────
// Game scaffold — write a complete, playable game project into the workspace.
// The point is a running game on the first try: every template boots with no
// package install and no build step, so the agent's next move can be to play
// it (or screenshot it with the browser tool) rather than to debug a toolchain.
// ─────────────────────────────────────────────────────────────────────────────

import * as fs from 'fs';
import * as path from 'path';
import type { ToolDefinition } from '../providers/types.js';
import { resolveInRoot, PathJailError } from '../safety/path-jail.js';
import { ENGINES, templateFor, type Engine } from './game-templates.js';

export interface GameScaffoldInput {
  action?: 'list' | 'scaffold';
  engine?: string;
  dir?: string;
  name?: string;
  overwrite?: boolean;
}

export const GAME_SCAFFOLD_DEFINITION: ToolDefinition = {
  name: 'game_scaffold',
  description:
    'Create a complete, playable game project. Actions: list (show engines and what each ships with), ' +
    'scaffold (write the project). Engines: three (3D browser platformer, zero-install, loads Blender glTF ' +
    'and ships a Blender asset script), godot (Godot 4 3D project), phaser (2D browser platformer). ' +
    'Each scaffold is a real game — input, physics, objective, HUD, win/lose — not a demo. ' +
    'Use it as the starting point for "build me a game", then edit the level/config files to shape it.',
  parameters: {
    type: 'object',
    properties: {
      action:    { type: 'string',  description: 'list | scaffold (default: list)' },
      engine:    { type: 'string',  description: 'three | godot | phaser' },
      dir:       { type: 'string',  description: 'Target directory, relative to project root (default: the engine name)' },
      name:      { type: 'string',  description: 'Game title used in the page title and README' },
      overwrite: { type: 'boolean', description: 'Overwrite existing files in the target directory (default: false)' },
    },
    required: [],
  },
};

function listEngines(): string {
  const lines = ['Available game engines:', ''];
  for (const e of ENGINES) {
    lines.push(
      `${e.engine} — ${e.title} (${e.kind})`,
      `  ${e.summary}`,
      `  Run: ${e.run}`,
      '',
    );
  }
  lines.push('Scaffold one: game_scaffold action=scaffold engine=three dir=games/runner name="Sky Runner"');
  return lines.join('\n');
}

/** A title the templates can print, derived from the directory when not given. */
function titleFrom(name: string | undefined, dir: string): string {
  if (name?.trim()) return name.trim();
  const base = path.basename(dir).replace(/[-_]+/g, ' ').trim();
  if (!base || base === '.') return 'Aura Game';
  return base.replace(/\b\w/g, c => c.toUpperCase());
}

export async function gameScaffold(input: GameScaffoldInput, cwd: string): Promise<string> {
  const action = input.action ?? 'list';
  if (action === 'list') return listEngines();
  if (action !== 'scaffold') {
    return `Error: Unknown game_scaffold action '${action}'. Use list or scaffold.`;
  }

  const engine = (input.engine ?? '').toLowerCase() as Engine;
  if (!ENGINES.some(e => e.engine === engine)) {
    return `Error: unknown engine '${input.engine ?? ''}'. Choose one of: ${ENGINES.map(e => e.engine).join(', ')}.\n\n${listEngines()}`;
  }

  const dir = input.dir?.trim() || engine;
  let targetDir: string;
  try { targetDir = resolveInRoot(cwd, dir); }
  catch (e) {
    if (e instanceof PathJailError) return `Error: ${e.message}`;
    throw e;
  }

  const title = titleFrom(input.name, dir);
  const files = templateFor(engine, title);

  // Refuse to clobber by default: scaffolding over a project the user already
  // has work in is unrecoverable from inside the tool.
  const existing = Object.keys(files).filter(rel => fs.existsSync(path.join(targetDir, rel)));
  if (existing.length && !input.overwrite) {
    return [
      `Error: ${existing.length} file(s) already exist in ${dir}:`,
      ...existing.slice(0, 10).map(f => `  ${f}`),
      existing.length > 10 ? `  ... and ${existing.length - 10} more` : '',
      'Pass overwrite=true to replace them, or scaffold into a different dir.',
    ].filter(Boolean).join('\n');
  }

  const written: string[] = [];
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(targetDir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf8');
    written.push(rel);
  }

  const info = ENGINES.find(e => e.engine === engine)!;
  const lines = [
    `Scaffolded ${info.title} game "${title}" in ${dir}/ (${written.length} files):`,
    ...written.map(f => `  ${path.join(dir, f)}`),
    '',
    `Run it:  cd ${dir} && ${info.run}`,
  ];
  if (engine === 'three') {
    lines.push(
      '',
      'Art pipeline: blender action=script script=' + path.join(dir, 'blender/make_assets.py'),
      'writes assets/player.glb + assets/props.glb, which the game picks up on reload.',
    );
  }
  lines.push('', 'The game is playable as written — edit the level/config files to make it yours.');
  return lines.join('\n');
}
