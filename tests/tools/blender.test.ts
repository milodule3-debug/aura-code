import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { blenderTool, findBlender, BLENDER_DEFINITION } from '../../src/tools/blender.js';

// A stand-in for the real binary: prints its argv, then the generated Python,
// so the tests can assert on what Aura actually asks Blender to do.
const FAKE = `#!/bin/sh
if [ "$1" = "--version" ]; then echo "Blender 4.2.0"; echo "build date: today"; exit 0; fi
echo "ARGV: $@"
for a in "$@"; do
  case "$a" in *.py) cat "$a" ;; esac
done
`;

let tmpDir: string;
let originalEnv: string | undefined;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-blender-test-'));
  const fake = path.join(tmpDir, 'fake-blender');
  fs.writeFileSync(fake, FAKE);
  fs.chmodSync(fake, 0o755);
  originalEnv = process.env.AURA_BLENDER;
  process.env.AURA_BLENDER = fake;
});

afterEach(() => {
  if (originalEnv === undefined) delete process.env.AURA_BLENDER;
  else process.env.AURA_BLENDER = originalEnv;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('BLENDER_DEFINITION', () => {
  it('is named blender', () => expect(BLENDER_DEFINITION.name).toBe('blender'));
  it('takes no required parameters', () => expect(BLENDER_DEFINITION.parameters.required).toEqual([]));
});

describe('findBlender', () => {
  it('honours AURA_BLENDER', () => {
    expect(findBlender()).toBe(path.join(tmpDir, 'fake-blender'));
  });

  it('ignores AURA_BLENDER pointing at a missing file', () => {
    process.env.AURA_BLENDER = path.join(tmpDir, 'nope');
    // Falls through to PATH/well-known paths — either a real Blender or null,
    // but never the bogus path.
    expect(findBlender()).not.toBe(path.join(tmpDir, 'nope'));
  });
});

describe('blenderTool — check', () => {
  it('reports the binary and version', async () => {
    const out = await blenderTool({ action: 'check' }, tmpDir);
    expect(out).toContain('Blender found:');
    expect(out).toContain('Blender 4.2.0');
  });

  it('explains how to install when no binary exists', async () => {
    delete process.env.AURA_BLENDER;
    const realPath = process.env.PATH;
    process.env.PATH = path.join(tmpDir, 'empty');
    try {
      const out = await blenderTool({ action: 'check' }, tmpDir);
      // Skip on machines that actually have Blender in a well-known location.
      if (!out.startsWith('Blender found:')) {
        expect(out).toContain('Error: Blender not found');
        expect(out).toContain('AURA_BLENDER');
      }
    } finally {
      process.env.PATH = realPath;
    }
  });
});

describe('blenderTool — validation', () => {
  it('rejects exec without code', async () => {
    expect(await blenderTool({ action: 'exec' }, tmpDir)).toMatch(/requires `code`/);
  });

  it('rejects an unknown action', async () => {
    expect(await blenderTool({ action: 'sculpt' as any }, tmpDir)).toMatch(/Unknown blender action/);
  });

  it('rejects an unsupported export format', async () => {
    const out = await blenderTool({ action: 'export', output: 'out/model.blahs', format: 'blahs' }, tmpDir);
    expect(out).toMatch(/unsupported export format/);
  });

  it('rejects a malformed resolution', async () => {
    const out = await blenderTool({ action: 'render', output: 'out/f.png', resolution: 'huge' }, tmpDir);
    expect(out).toMatch(/resolution must be WIDTHxHEIGHT/);
  });

  it('rejects a missing script', async () => {
    const out = await blenderTool({ action: 'script', script: 'nope.py' }, tmpDir);
    expect(out).toMatch(/script not found/);
  });

  it('rejects a missing .blend', async () => {
    const out = await blenderTool({ action: 'scene', blend: 'nope.blend' }, tmpDir);
    expect(out).toMatch(/\.blend not found/);
  });

  it('keeps paths inside the project root', async () => {
    const out = await blenderTool({ action: 'export', output: '../escape.glb' }, tmpDir);
    expect(out).toMatch(/escapes the project root/);
  });
});

describe('blenderTool — generated Python', () => {
  it('runs inline code headless with a traceback guard', async () => {
    const out = await blenderTool({ action: 'exec', code: 'print("hello from bpy")' }, tmpDir);
    expect(out).toContain('--background');
    expect(out).toContain('--python-exit-code 1');
    expect(out).toContain('print("hello from bpy")');
    expect(out).toContain('traceback.print_exc()');
  });

  it('builds a glb export call for the resolved output path', async () => {
    const out = await blenderTool({ action: 'export', output: 'assets/hero.glb' }, tmpDir);
    expect(out).toContain("export_scene.gltf");
    expect(out).toContain("export_format='GLB'");
    expect(out).toContain(path.join(tmpDir, 'assets/hero.glb'));
  });

  it('infers the export format from the output extension', async () => {
    const out = await blenderTool({ action: 'export', output: 'assets/hero.fbx' }, tmpDir);
    expect(out).toContain('export_scene.fbx');
  });

  it('renders an animation range when frame_end is given', async () => {
    const out = await blenderTool(
      { action: 'render', output: 'out/frame_', frame: 1, frame_end: 24, resolution: '640x360', samples: 16 },
      tmpDir,
    );
    expect(out).toContain('scene.frame_start = 1');
    expect(out).toContain('scene.frame_end = 24');
    expect(out).toContain('render(animation=True)');
    expect(out).toContain('resolution_x = 640');
    expect(out).toContain('taa_render_samples = 16');
  });

  it('renders a still by default', async () => {
    const out = await blenderTool({ action: 'render', output: 'out/shot.png', frame: 7 }, tmpDir);
    expect(out).toContain('frame_set(7)');
    expect(out).toContain('render(write_still=True)');
    expect(out).not.toContain('animation=True');
  });

  it('opens the .blend before running a scene report', async () => {
    const blend = path.join(tmpDir, 'level.blend');
    fs.writeFileSync(blend, 'not really a blend');
    const out = await blenderTool({ action: 'scene', blend: 'level.blend' }, tmpDir);
    expect(out).toContain(blend);
    expect(out).toContain('bpy.data.objects');
  });

  it('forwards extra args after --', async () => {
    const script = path.join(tmpDir, 'gen.py');
    fs.writeFileSync(script, 'print("gen")');
    const out = await blenderTool({ action: 'script', script: 'gen.py', args: ['--seed', '42'] }, tmpDir);
    expect(out).toContain('-- --seed 42');
  });
});
