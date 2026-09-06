// ─────────────────────────────────────────────────────────────────────────────
// Blender — headless 3D authoring, rendering and asset export.
// Drives a local Blender install through `blender --background --python`, so
// the agent can build scenes, model procedurally, render stills/animations and
// export game-ready assets (glTF/FBX/OBJ/USD) without a GUI.
// No new dependencies: everything goes through the Blender binary's own Python.
// ─────────────────────────────────────────────────────────────────────────────

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync, spawn } from 'child_process';
import type { ToolDefinition } from '../providers/types.js';
import { resolveInRoot, PathJailError } from '../safety/path-jail.js';

export interface BlenderInput {
  action?: 'check' | 'exec' | 'script' | 'render' | 'export' | 'scene';
  code?: string;
  script?: string;
  blend?: string;
  output?: string;
  format?: string;
  engine?: string;
  frame?: number;
  frame_end?: number;
  resolution?: string;
  samples?: number;
  args?: string[];
  timeout?: number;
}

export const BLENDER_DEFINITION: ToolDefinition = {
  name: 'blender',
  description:
    'Headless Blender for 3D work. Actions: check (find binary + version), exec (run inline bpy Python), ' +
    'script (run a .py file), render (still or animation from a .blend), export (convert a .blend to ' +
    'glb/gltf/fbx/obj/usd for a game engine), scene (list objects/materials/cameras in a .blend). ' +
    'Model, rig, light, texture and bake entirely from Python — there is no GUI. ' +
    'Use it to produce game assets, then load them with the game engine scaffolded by game_scaffold.',
  parameters: {
    type: 'object',
    properties: {
      action:     { type: 'string', description: 'check | exec | script | render | export | scene (default: check)' },
      code:       { type: 'string', description: 'Inline Python (bpy is pre-imported) for action=exec' },
      script:     { type: 'string', description: 'Path to a .py file for action=script' },
      blend:      { type: 'string', description: 'Path to a .blend file to open first (optional for exec/script)' },
      output:     { type: 'string', description: 'Output file path for render/export' },
      format:     { type: 'string', description: 'export: glb|gltf|fbx|obj|usd|stl — render: PNG|JPEG|OPEN_EXR (default glb / PNG)' },
      engine:     { type: 'string', description: 'render engine: BLENDER_EEVEE_NEXT | CYCLES | BLENDER_WORKBENCH' },
      frame:      { type: 'number', description: 'render: frame to render (default: scene current frame)' },
      frame_end:  { type: 'number', description: 'render: last frame — set it to render an animation range' },
      resolution: { type: 'string', description: 'render: WIDTHxHEIGHT, e.g. 1920x1080' },
      samples:    { type: 'number', description: 'render: sample count (lower = faster preview)' },
      args:       { type: 'array', items: { type: 'string' }, description: 'Extra argv passed to the script after --' },
      timeout:    { type: 'number', description: 'Timeout in seconds (default 300)' },
    },
    required: [],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Binary detection
// ─────────────────────────────────────────────────────────────────────────────

const BLENDER_CANDIDATES = [
  '/usr/bin/blender',
  '/usr/local/bin/blender',
  '/snap/bin/blender',
  '/var/lib/flatpak/exports/bin/org.blender.Blender',
  '/Applications/Blender.app/Contents/MacOS/Blender',
  'C:\\Program Files\\Blender Foundation\\Blender\\blender.exe',
];

/** Locate the Blender binary: AURA_BLENDER env → PATH → well-known install paths. */
export function findBlender(): string | null {
  const fromEnv = process.env.AURA_BLENDER;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  try {
    const which = process.platform === 'win32' ? 'where' : 'which';
    const found = execFileSync(which, ['blender'], { stdio: 'pipe', encoding: 'utf8' })
      .split('\n')[0].trim();
    if (found) return found;
  } catch { /* not on PATH */ }

  for (const c of BLENDER_CANDIDATES) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

const NOT_FOUND = [
  'Error: Blender not found.',
  'Install it, then re-run:',
  '  Linux:  sudo apt install blender     (or: sudo snap install blender --classic)',
  '  macOS:  brew install --cask blender',
  'Already installed somewhere unusual? Point Aura at it: export AURA_BLENDER=/path/to/blender',
].join('\n');

// ─────────────────────────────────────────────────────────────────────────────
// Process runner
// ─────────────────────────────────────────────────────────────────────────────

const MAX_OUTPUT = 12_000;

interface RunResult { code: number; stdout: string; stderr: string; timedOut: boolean }

function runBlender(bin: string, argv: string[], timeoutMs: number): Promise<RunResult> {
  return new Promise(resolve => {
    const child = spawn(bin, argv, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMs);

    child.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    child.on('error', e => {
      clearTimeout(timer);
      resolve({ code: -1, stdout, stderr: stderr + String(e), timedOut });
    });
    child.on('close', (code: number | null) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, stdout, stderr, timedOut });
    });
  });
}

/**
 * Blender prints a wall of startup/driver noise around the script's own output.
 * Keep the tail (where tracebacks and our own prints land) and drop the lines
 * that never carry information the agent can act on.
 */
function summarize(r: RunResult): string {
  const noise = /^(Blender \d|Read blend|Fra:|Saved:|Time:|found bundled python|Warning: Falling back|AL lib|libpng|Color management)/;
  const keep = (r.stdout + (r.stderr ? '\n' + r.stderr : ''))
    .split('\n')
    .filter(l => l.trim() && !noise.test(l.trim()))
    .join('\n');
  const body = keep.length > MAX_OUTPUT
    ? keep.slice(0, 2_000) + `\n... (${keep.length - MAX_OUTPUT} chars omitted) ...\n` + keep.slice(-(MAX_OUTPUT - 2_000))
    : keep;

  if (r.timedOut) return `Error: Blender timed out.\n${body}`;
  if (r.code !== 0) return `Error: Blender exited ${r.code}.\n${body}`;
  return body || 'Blender finished (no output).';
}

// ─────────────────────────────────────────────────────────────────────────────
// Python payloads
// ─────────────────────────────────────────────────────────────────────────────

/** Wrap user code so bpy is ready and a traceback exits non-zero instead of "success". */
function wrapUserCode(code: string): string {
  return [
    'import bpy, sys, traceback, math, mathutils  # noqa: F401',
    'try:',
    ...code.split('\n').map(l => '    ' + l),
    'except Exception:',
    '    traceback.print_exc()',
    '    sys.exit(1)',
  ].join('\n');
}

const EXPORTERS: Record<string, (out: string) => string> = {
  glb:  o => `bpy.ops.export_scene.gltf(filepath=${o}, export_format='GLB')`,
  gltf: o => `bpy.ops.export_scene.gltf(filepath=${o}, export_format='GLTF_SEPARATE')`,
  fbx:  o => `bpy.ops.export_scene.fbx(filepath=${o})`,
  obj:  o => `bpy.ops.wm.obj_export(filepath=${o})`,
  usd:  o => `bpy.ops.wm.usd_export(filepath=${o})`,
  stl:  o => `bpy.ops.wm.stl_export(filepath=${o})`,
};

const SCENE_REPORT = `
scene = bpy.context.scene
print("Scene:", scene.name, "| frames", scene.frame_start, "-", scene.frame_end, "| engine", scene.render.engine)
print("Objects (%d):" % len(bpy.data.objects))
for ob in bpy.data.objects:
    extra = ""
    if ob.type == 'MESH':
        extra = " verts=%d polys=%d" % (len(ob.data.vertices), len(ob.data.polygons))
    mats = [m.name for m in ob.material_slots.keys()] if ob.material_slots else []
    print("  %-24s %-10s loc=(%.2f, %.2f, %.2f)%s%s" % (
        ob.name, ob.type, ob.location.x, ob.location.y, ob.location.z, extra,
        (" mats=" + ",".join(mats)) if mats else ""))
print("Materials (%d): %s" % (len(bpy.data.materials), ", ".join(m.name for m in bpy.data.materials)))
print("Cameras (%d): %s" % (len(bpy.data.cameras), ", ".join(c.name for c in bpy.data.cameras)))
print("Collections (%d): %s" % (len(bpy.data.collections), ", ".join(c.name for c in bpy.data.collections)))
`.trim();

/** Python string literal — json is a valid subset for the escaping we need. */
function py(value: string): string {
  return JSON.stringify(value);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool entry point
// ─────────────────────────────────────────────────────────────────────────────

export async function blenderTool(input: BlenderInput, cwd: string): Promise<string> {
  const bin = findBlender();
  if (!bin) return NOT_FOUND;

  const action = input.action ?? 'check';

  if (action === 'check') {
    try {
      const version = execFileSync(bin, ['--version'], { stdio: 'pipe', encoding: 'utf8' })
        .split('\n').filter(Boolean).slice(0, 2).join(' | ');
      return `Blender found: ${bin}\n${version.trim()}`;
    } catch (e: any) {
      return `Blender found at ${bin} but --version failed: ${e?.message}`;
    }
  }

  // Every filesystem path the model supplies stays inside the project root.
  let blend: string | undefined;
  let scriptPath: string | undefined;
  let output: string | undefined;
  try {
    if (input.blend)  blend      = resolveInRoot(cwd, input.blend);
    if (input.script) scriptPath = resolveInRoot(cwd, input.script);
    if (input.output) output     = resolveInRoot(cwd, input.output);
  } catch (e) {
    if (e instanceof PathJailError) return `Error: ${e.message}`;
    throw e;
  }

  if (blend && !fs.existsSync(blend)) return `Error: .blend not found: ${input.blend}`;

  let code: string;
  switch (action) {
    case 'exec': {
      if (!input.code) return 'Error: action=exec requires `code`';
      code = wrapUserCode(input.code);
      break;
    }
    case 'script': {
      if (!scriptPath) return 'Error: action=script requires `script`';
      if (!fs.existsSync(scriptPath)) return `Error: script not found: ${input.script}`;
      code = '';
      break;
    }
    case 'scene': {
      if (!blend) return 'Error: action=scene requires `blend`';
      code = wrapUserCode(SCENE_REPORT);
      break;
    }
    case 'export': {
      if (!output) return 'Error: action=export requires `output`';
      const fmt = (input.format ?? path.extname(output).slice(1) ?? 'glb').toLowerCase();
      const exporter = EXPORTERS[fmt];
      if (!exporter) return `Error: unsupported export format '${fmt}'. Supported: ${Object.keys(EXPORTERS).join(', ')}`;
      fs.mkdirSync(path.dirname(output), { recursive: true });
      code = wrapUserCode([
        exporter(py(output)),
        `print("Exported ${fmt.toUpperCase()} ->", ${py(output)})`,
      ].join('\n'));
      break;
    }
    case 'render': {
      if (!output) return 'Error: action=render requires `output`';
      fs.mkdirSync(path.dirname(output), { recursive: true });
      const lines: string[] = ['scene = bpy.context.scene'];
      if (input.engine)     lines.push(`scene.render.engine = ${py(input.engine)}`);
      if (input.format)     lines.push(`scene.render.image_settings.file_format = ${py(input.format.toUpperCase())}`);
      if (input.resolution) {
        const m = /^(\d+)x(\d+)$/i.exec(input.resolution.trim());
        if (!m) return `Error: resolution must be WIDTHxHEIGHT, got '${input.resolution}'`;
        lines.push(`scene.render.resolution_x = ${m[1]}`, `scene.render.resolution_y = ${m[2]}`, 'scene.render.resolution_percentage = 100');
      }
      if (typeof input.samples === 'number') {
        lines.push(
          `if hasattr(scene, "cycles"): scene.cycles.samples = ${input.samples}`,
          `if hasattr(scene, "eevee"): scene.eevee.taa_render_samples = ${input.samples}`,
        );
      }
      if (typeof input.frame_end === 'number') {
        lines.push(
          `scene.frame_start = ${input.frame ?? 1}`,
          `scene.frame_end = ${input.frame_end}`,
          `scene.render.filepath = ${py(output)}`,
          'bpy.ops.render.render(animation=True)',
          `print("Rendered frames %d-%d ->" % (scene.frame_start, scene.frame_end), ${py(output)})`,
        );
      } else {
        if (typeof input.frame === 'number') lines.push(`scene.frame_set(${input.frame})`);
        lines.push(
          `scene.render.filepath = ${py(output)}`,
          'bpy.ops.render.render(write_still=True)',
          `print("Rendered still ->", ${py(output)})`,
        );
      }
      code = wrapUserCode(lines.join('\n'));
      break;
    }
    default:
      return `Error: Unknown blender action '${action}'. Use check, exec, script, render, export or scene.`;
  }

  // Inline code runs from a temp file: --python-expr mangles multi-line
  // payloads across shells, a file does not.
  let tmpDir: string | null = null;
  let runScript = scriptPath!;
  if (action !== 'script') {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-blender-'));
    runScript = path.join(tmpDir, 'aura_task.py');
    fs.writeFileSync(runScript, code);
  }

  const argv: string[] = ['--background'];
  if (blend) argv.push(blend);
  argv.push('--python', runScript, '--python-exit-code', '1');
  if (input.args?.length) argv.push('--', ...input.args.map(String));

  try {
    const result = await runBlender(bin, argv, (input.timeout ?? 300) * 1000);
    const out = summarize(result);
    if (result.code === 0 && output && fs.existsSync(output)) {
      const kb = (fs.statSync(output).size / 1024).toFixed(1);
      return `${out}\nWrote ${path.relative(cwd, output)} (${kb} KB)`;
    }
    return out;
  } finally {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
