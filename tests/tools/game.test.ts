import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { gameScaffold, GAME_SCAFFOLD_DEFINITION } from '../../src/tools/game.js';
import { ENGINES, templateFor } from '../../src/tools/game-templates.js';

let tmpDir: string;

beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-game-test-')); });
afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

const read = (rel: string) => fs.readFileSync(path.join(tmpDir, rel), 'utf8');

describe('GAME_SCAFFOLD_DEFINITION', () => {
  it('is named game_scaffold', () => expect(GAME_SCAFFOLD_DEFINITION.name).toBe('game_scaffold'));
  it('takes no required parameters', () => expect(GAME_SCAFFOLD_DEFINITION.parameters.required).toEqual([]));
});

describe('gameScaffold — list', () => {
  it('lists every engine with a run command', async () => {
    const out = await gameScaffold({}, tmpDir);
    for (const e of ENGINES) {
      expect(out).toContain(e.engine);
      expect(out).toContain(e.run);
    }
  });

  it('rejects an unknown action', async () => {
    expect(await gameScaffold({ action: 'delete' as any }, tmpDir)).toMatch(/Unknown game_scaffold action/);
  });

  it('rejects an unknown engine and shows the choices', async () => {
    const out = await gameScaffold({ action: 'scaffold', engine: 'cryengine' }, tmpDir);
    expect(out).toMatch(/unknown engine/);
    expect(out).toContain('three');
  });
});

describe('gameScaffold — three', () => {
  it('writes a playable project with the given name', async () => {
    const out = await gameScaffold(
      { action: 'scaffold', engine: 'three', dir: 'games/runner', name: 'Sky Runner' }, tmpDir);

    expect(out).toContain('Scaffolded Three.js game "Sky Runner"');
    for (const f of ['index.html', 'src/main.js', 'src/player.js', 'src/level.js',
                     'src/input.js', 'src/hud.js', 'src/config.js', 'src/assets.js',
                     'blender/make_assets.py', 'README.md']) {
      expect(fs.existsSync(path.join(tmpDir, 'games/runner', f))).toBe(true);
    }
    expect(read('games/runner/index.html')).toContain('<title>Sky Runner</title>');
  });

  it('wires the game loop, physics and win condition', async () => {
    await gameScaffold({ action: 'scaffold', engine: 'three', dir: 'g' }, tmpDir);
    const main = read('g/src/main.js');
    expect(main).toContain('requestAnimationFrame(frame)');
    expect(main).toContain('Math.min(clock.getDelta(), 0.05)');   // dt is clamped
    expect(main).toContain('Level complete');
    expect(read('g/src/player.js')).toContain('moveAxis');
    expect(read('g/src/config.js')).toContain('gravity');
  });

  it('loads Blender assets with a primitive fallback', async () => {
    await gameScaffold({ action: 'scaffold', engine: 'three', dir: 'g' }, tmpDir);
    expect(read('g/src/assets.js')).toContain('GLTFLoader');
    expect(read('g/src/player.js')).toContain('./assets/player.glb');
    expect(read('g/blender/make_assets.py')).toContain('export_scene.gltf');
    expect(read('g/blender/make_assets.py')).toContain('read_factory_settings');
  });

  it('names the game after the directory when no name is given', async () => {
    await gameScaffold({ action: 'scaffold', engine: 'three', dir: 'games/space-hopper' }, tmpDir);
    expect(read('games/space-hopper/index.html')).toContain('<title>Space Hopper</title>');
  });
});

describe('gameScaffold — godot', () => {
  it('writes a runnable Godot 4 project', async () => {
    const out = await gameScaffold({ action: 'scaffold', engine: 'godot', dir: 'godot-game', name: 'Relic Run' }, tmpDir);
    expect(out).toContain('godot --path .');

    const project = read('godot-game/project.godot');
    expect(project).toContain('config/name="Relic Run"');
    expect(project).toContain('run/main_scene="res://scenes/main.tscn"');
    expect(project).toContain('move_forward=');
    expect(project).toContain('jump=');

    expect(read('godot-game/scripts/player.gd')).toContain('extends CharacterBody3D');
    expect(read('godot-game/scripts/player.gd')).toContain('move_and_slide()');
    expect(read('godot-game/scenes/main.tscn')).toContain('[gd_scene');
    expect(read('godot-game/scenes/main.tscn')).toContain('instance=ExtResource("2")');
  });

  it('finds pickups by group so duplicated coins still count', async () => {
    await gameScaffold({ action: 'scaffold', engine: 'godot', dir: 'g' }, tmpDir);
    expect(read('g/scripts/game.gd')).toContain('get_nodes_in_group("coins")');
    expect(read('g/scenes/coin.tscn')).toContain('groups=["coins"]');
  });
});

describe('gameScaffold — phaser', () => {
  it('writes a 2D platformer with no binary assets', async () => {
    await gameScaffold({ action: 'scaffold', engine: 'phaser', dir: '2d', name: 'Coin Dash' }, tmpDir);
    expect(read('2d/index.html')).toContain('phaser.min.js');
    expect(read('2d/src/textures.js')).toContain('generateTexture');
    const game = read('2d/src/game.js');
    expect(game).toContain('arcade');
    expect(game).toContain('Game over');
    expect(game).toContain('You win');
  });
});

describe('gameScaffold — safety', () => {
  it('refuses to clobber existing files by default', async () => {
    await gameScaffold({ action: 'scaffold', engine: 'phaser', dir: 'g' }, tmpDir);
    fs.writeFileSync(path.join(tmpDir, 'g/src/game.js'), '// my work');

    const out = await gameScaffold({ action: 'scaffold', engine: 'phaser', dir: 'g' }, tmpDir);
    expect(out).toMatch(/already exist/);
    expect(read('g/src/game.js')).toBe('// my work');
  });

  it('overwrites when explicitly told to', async () => {
    await gameScaffold({ action: 'scaffold', engine: 'phaser', dir: 'g' }, tmpDir);
    fs.writeFileSync(path.join(tmpDir, 'g/src/game.js'), '// my work');

    const out = await gameScaffold({ action: 'scaffold', engine: 'phaser', dir: 'g', overwrite: true }, tmpDir);
    expect(out).toContain('Scaffolded');
    expect(read('g/src/game.js')).toContain('Phaser.Scene');
  });

  it('keeps the target directory inside the project root', async () => {
    const out = await gameScaffold({ action: 'scaffold', engine: 'three', dir: '../outside' }, tmpDir);
    expect(out).toMatch(/escapes the project root/);
    expect(fs.existsSync(path.join(tmpDir, '..', 'outside'))).toBe(false);
  });
});

describe('templateFor', () => {
  it('produces non-empty files for every advertised engine', () => {
    for (const e of ENGINES) {
      const files = templateFor(e.engine, 'Test Game');
      expect(Object.keys(files).length).toBeGreaterThan(2);
      for (const [name, content] of Object.entries(files)) {
        expect(content.length, name).toBeGreaterThan(0);
      }
      expect(files['README.md']).toContain('Test Game');
    }
  });
});
