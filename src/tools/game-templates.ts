// ─────────────────────────────────────────────────────────────────────────────
// Game templates — complete, immediately playable starter projects.
// Each template is a path → contents map written verbatim by game_scaffold.
// Rules for anything added here:
//   • it must RUN with no build step and no package install;
//   • it must be a real game (input, physics, objective, win/lose), not a demo;
//   • 3D templates must load assets/*.glb when present, so a Blender-authored
//     asset drops straight in without touching the code.
// Generated sources deliberately avoid JS template literals — these files are
// themselves TS template literals, and nesting them is an escaping minefield.
// ─────────────────────────────────────────────────────────────────────────────

export type Engine = 'three' | 'godot' | 'phaser';

export interface EngineInfo {
  engine: Engine;
  title: string;
  kind: string;
  run: string;
  summary: string;
}

export const ENGINES: EngineInfo[] = [
  {
    engine: 'three',
    title: 'Three.js',
    kind: '3D, browser, zero-install',
    run: 'python3 -m http.server 8000  →  http://localhost:8000',
    summary: 'Third-person 3D platformer: character controller, gravity + AABB collision, ' +
             'coin objective, HUD, orbit-follow camera, glTF asset loading, and a Blender ' +
             'script that generates and exports the game art.',
  },
  {
    engine: 'godot',
    title: 'Godot 4',
    kind: '3D, native editor + export',
    run: 'godot --path . (or open project.godot in the Godot 4 editor)',
    summary: 'Godot 4 first/third-person 3D project: CharacterBody3D player with jump and ' +
             'mouse look, collectible pickups, score UI, and a res://assets glTF drop-in folder.',
  },
  {
    engine: 'phaser',
    title: 'Phaser 3',
    kind: '2D, browser, zero-install',
    run: 'python3 -m http.server 8000  →  http://localhost:8000',
    summary: '2D platformer: arcade physics, moving platforms, enemies, coins, lives, ' +
             'restart-on-death, and procedurally generated textures (no binary assets).',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Three.js — 3D platformer
// ─────────────────────────────────────────────────────────────────────────────

function threeFiles(name: string): Record<string, string> {
  return {
    'index.html': `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name}</title>
<style>
  :root { color-scheme: dark; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0b0d14; overflow: hidden; font: 14px/1.4 system-ui, sans-serif; color: #e8ecf5; }
  canvas { display: block; }
  #hud { position: fixed; inset: 16px 16px auto 16px; display: flex; justify-content: space-between;
         pointer-events: none; text-shadow: 0 1px 3px rgba(0,0,0,.8); font-weight: 600; letter-spacing: .02em; }
  #banner { position: fixed; inset: 0; display: none; place-items: center; text-align: center;
            background: rgba(8,10,18,.78); backdrop-filter: blur(3px); }
  #banner.show { display: grid; }
  #banner h1 { font-size: 40px; margin-bottom: 8px; }
  #banner p { opacity: .75; }
  #help { position: fixed; left: 16px; bottom: 16px; opacity: .5; }
</style>
</head>
<body>
  <div id="hud"><span id="score">Coins 0 / 0</span><span id="time">0.0s</span></div>
  <div id="help">WASD / arrows move &nbsp;·&nbsp; Space jump &nbsp;·&nbsp; drag to orbit &nbsp;·&nbsp; R restart</div>
  <div id="banner"><div><h1 id="banner-title"></h1><p id="banner-text"></p></div></div>

  <script type="importmap">
  {
    "imports": {
      "three": "https://unpkg.com/three@0.169.0/build/three.module.js",
      "three/addons/": "https://unpkg.com/three@0.169.0/examples/jsm/"
    }
  }
  </script>
  <script type="module" src="./src/main.js"></script>
</body>
</html>
`,

    'src/config.js': `// Tunables. Every number the game feels like lives here.
export const CONFIG = {
  gravity: -26,
  moveSpeed: 7,
  airControl: 0.45,
  jumpSpeed: 9.5,
  playerSize: { x: 0.6, y: 1.6, z: 0.6 },
  spawn: { x: 0, y: 2, z: 0 },
  killPlaneY: -12,
  cameraDistance: 9,
  cameraHeight: 4,
  coinSpinSpeed: 2.2,
};
`,

    'src/level.js': `import * as THREE from 'three';
import { loadModel } from './assets.js';

// A platform is [x, y, z, width, height, depth]. Colliders are derived from
// the same list, so geometry and physics can never drift apart.
const PLATFORMS = [
  [0, -0.5, 0, 24, 1, 24],
  [10, 1.5, -6, 6, 1, 6],
  [16, 3.5, -12, 5, 1, 5],
  [8, 5.5, -18, 5, 1, 5],
  [-2, 4.0, -16, 6, 1, 6],
  [-12, 6.0, -10, 6, 1, 6],
  [-16, 8.0, 0, 6, 1, 6],
  [-8, 9.5, 8, 6, 1, 6],
  [2, 11.0, 12, 8, 1, 8],
];

const COINS = [
  [10, 3.0, -6], [16, 5.0, -12], [8, 7.0, -18], [-2, 5.5, -16],
  [-12, 7.5, -10], [-16, 9.5, 0], [-8, 11.0, 8], [2, 12.5, 12], [0, 1.5, 6],
];

export async function buildLevel(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const colliders = [];
  const mat = new THREE.MeshStandardMaterial({ color: 0x4b5a7a, roughness: 0.85, metalness: 0.05 });
  const accent = new THREE.MeshStandardMaterial({ color: 0x7c5cff, roughness: 0.6, metalness: 0.2 });

  PLATFORMS.forEach(function (p, i) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(p[3], p[4], p[5]), i === 0 ? mat : accent);
    box.position.set(p[0], p[1], p[2]);
    box.castShadow = true;
    box.receiveShadow = true;
    group.add(box);
    colliders.push(new THREE.Box3().setFromObject(box));
  });

  // Drop-in art: anything exported to assets/level.glb replaces the grey boxes
  // visually while the boxes above keep serving as collision.
  const art = await loadModel('./assets/level.glb');
  if (art) {
    group.children.forEach(function (m) { m.visible = false; });
    art.traverse(function (o) { o.castShadow = true; o.receiveShadow = true; });
    group.add(art);
  }

  const coins = [];
  const coinGeo = new THREE.TorusGeometry(0.35, 0.12, 10, 20);
  const coinMat = new THREE.MeshStandardMaterial({ color: 0xffc94d, emissive: 0x6b4400, roughness: 0.3, metalness: 0.7 });
  COINS.forEach(function (c) {
    const coin = new THREE.Mesh(coinGeo, coinMat);
    coin.position.set(c[0], c[1], c[2]);
    coin.castShadow = true;
    group.add(coin);
    coins.push(coin);
  });

  return { group: group, colliders: colliders, coins: coins };
}
`,

    'src/assets.js': `import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

/**
 * Load a glTF/glb and return its scene, or null when the file is absent.
 * Missing art is not an error — the game ships with primitive stand-ins and
 * upgrades itself the moment a Blender export lands in assets/.
 */
export function loadModel(url) {
  return new Promise(function (resolve) {
    loader.load(
      url,
      function (gltf) { resolve(gltf.scene); },
      undefined,
      function () { resolve(null); },
    );
  });
}
`,

    'src/player.js': `import * as THREE from 'three';
import { CONFIG } from './config.js';
import { loadModel } from './assets.js';

// Overlap test with a tolerance. THREE.Box3.intersectsBox counts *touching*
// faces as an intersection, so a player standing exactly on a platform reads
// as inside it and the horizontal pass ejects them out the side of the floor.
// Requiring EPS of real penetration is what keeps standing still standing.
const EPS = 0.001;

function overlaps(a, b) {
  return a.min.x < b.max.x - EPS && a.max.x > b.min.x + EPS
      && a.min.y < b.max.y - EPS && a.max.y > b.min.y + EPS
      && a.min.z < b.max.z - EPS && a.max.z > b.min.z + EPS;
}

/**
 * Axis-aligned box character controller. Each axis is integrated and resolved
 * separately (X, then Z, then Y) — the cheap, predictable way to get platformer
 * collision that never lets the player tunnel through a ledge.
 */
export class Player {
  constructor(scene) {
    this.velocity = new THREE.Vector3();
    this.onGround = false;
    this.size = new THREE.Vector3(CONFIG.playerSize.x, CONFIG.playerSize.y, CONFIG.playerSize.z);

    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(this.size.x / 2, this.size.y - this.size.x, 6, 12),
      new THREE.MeshStandardMaterial({ color: 0x6ee7ff, roughness: 0.4, metalness: 0.1 }),
    );
    body.castShadow = true;

    this.object = new THREE.Group();
    this.object.add(body);
    this.placeholder = body;
    scene.add(this.object);

    this.respawn();

    loadModel('./assets/player.glb').then((model) => {
      if (!model) return;
      model.traverse(function (o) { o.castShadow = true; });
      this.placeholder.visible = false;
      this.object.add(model);
    });
  }

  respawn() {
    this.object.position.set(CONFIG.spawn.x, CONFIG.spawn.y, CONFIG.spawn.z);
    this.velocity.set(0, 0, 0);
  }

  box(at) {
    const p = at || this.object.position;
    return new THREE.Box3(
      new THREE.Vector3(p.x - this.size.x / 2, p.y, p.z - this.size.z / 2),
      new THREE.Vector3(p.x + this.size.x / 2, p.y + this.size.y, p.z + this.size.z / 2),
    );
  }

  update(dt, input, cameraYaw, colliders) {
    // Movement is camera-relative: forward is wherever the camera looks.
    const forward = new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
    const right = new THREE.Vector3(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));
    const wish = new THREE.Vector3()
      .addScaledVector(forward, input.forward)
      .addScaledVector(right, input.right);
    if (wish.lengthSq() > 0) wish.normalize();

    const control = this.onGround ? 1 : CONFIG.airControl;
    const target = wish.multiplyScalar(CONFIG.moveSpeed);
    this.velocity.x += (target.x - this.velocity.x) * Math.min(1, control * 14 * dt);
    this.velocity.z += (target.z - this.velocity.z) * Math.min(1, control * 14 * dt);

    if (input.jump && this.onGround) {
      this.velocity.y = CONFIG.jumpSpeed;
      this.onGround = false;
    }
    this.velocity.y += CONFIG.gravity * dt;

    this.moveAxis('x', this.velocity.x * dt, colliders);
    this.moveAxis('z', this.velocity.z * dt, colliders);
    this.onGround = false;
    this.moveAxis('y', this.velocity.y * dt, colliders);

    if (wish.lengthSq() > 0.0001) {
      this.object.rotation.y = Math.atan2(this.velocity.x, this.velocity.z);
    }
  }

  moveAxis(axis, delta, colliders) {
    if (delta === 0) return;
    this.object.position[axis] += delta;
    const self = this.box();

    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      if (!overlaps(self, c)) continue;

      if (axis === 'y') {
        if (delta < 0) { this.object.position.y = c.max.y; this.onGround = true; }
        else { this.object.position.y = c.min.y - this.size.y; }
        this.velocity.y = 0;
      } else {
        const half = axis === 'x' ? this.size.x / 2 : this.size.z / 2;
        this.object.position[axis] = delta > 0 ? c.min[axis] - half : c.max[axis] + half;
        this.velocity[axis] = 0;
      }
      self.copy(this.box());
    }
  }
}
`,

    'src/input.js': `// Keyboard + pointer-drag input. One object, polled by the game loop.
export class Input {
  constructor(domElement) {
    this.keys = new Set();
    this.yaw = 0;
    this.pitch = 0.35;
    this.onRestart = null;

    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyR' && this.onRestart) this.onRestart();
      if (e.code === 'Space') e.preventDefault();
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); });
    window.addEventListener('blur', () => { this.keys.clear(); });

    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    domElement.addEventListener('pointerdown', (e) => {
      dragging = true; lastX = e.clientX; lastY = e.clientY;
      domElement.setPointerCapture(e.pointerId);
    });
    domElement.addEventListener('pointerup', (e) => {
      dragging = false;
      domElement.releasePointerCapture(e.pointerId);
    });
    domElement.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      this.yaw -= (e.clientX - lastX) * 0.005;
      this.pitch = Math.max(-0.2, Math.min(1.2, this.pitch + (e.clientY - lastY) * 0.004));
      lastX = e.clientX; lastY = e.clientY;
    });
  }

  get forward() {
    return (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0)
         - (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);
  }

  get right() {
    return (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0)
         - (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);
  }

  get jump() { return this.keys.has('Space'); }
}
`,

    'src/hud.js': `export class HUD {
  constructor() {
    this.scoreEl = document.getElementById('score');
    this.timeEl = document.getElementById('time');
    this.banner = document.getElementById('banner');
    this.bannerTitle = document.getElementById('banner-title');
    this.bannerText = document.getElementById('banner-text');
  }

  update(collected, total, seconds) {
    this.scoreEl.textContent = 'Coins ' + collected + ' / ' + total;
    this.timeEl.textContent = seconds.toFixed(1) + 's';
  }

  show(title, text) {
    this.bannerTitle.textContent = title;
    this.bannerText.textContent = text;
    this.banner.classList.add('show');
  }

  hide() { this.banner.classList.remove('show'); }
}
`,

    'src/main.js': `import * as THREE from 'three';
import { CONFIG } from './config.js';
import { buildLevel } from './level.js';
import { Player } from './player.js';
import { Input } from './input.js';
import { HUD } from './hud.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0d14);
scene.fog = new THREE.Fog(0x0b0d14, 40, 90);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 400);

const hemi = new THREE.HemisphereLight(0x9fc4ff, 0x20242e, 0.8);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe8c4, 2.1);
sun.position.set(14, 26, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -40;
sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40;
sun.shadow.camera.bottom = -40;
scene.add(sun);

const hud = new HUD();
const input = new Input(renderer.domElement);
const level = await buildLevel(scene);
const player = new Player(scene);

let collected = 0;
let elapsed = 0;
let finished = false;

function restart() {
  level.coins.forEach(function (c) { c.visible = true; });
  collected = 0;
  elapsed = 0;
  finished = false;
  player.respawn();
  hud.hide();
}
input.onRestart = restart;

addEventListener('resize', function () {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock();

function frame() {
  // Clamp dt: a backgrounded tab returns a huge delta that teleports the
  // player through the floor on the first frame back.
  const dt = Math.min(clock.getDelta(), 0.05);

  if (!finished) {
    elapsed += dt;
    player.update(dt, input, input.yaw, level.colliders);

    if (player.object.position.y < CONFIG.killPlaneY) player.respawn();

    const playerBox = player.box();
    level.coins.forEach(function (coin) {
      coin.rotation.y += CONFIG.coinSpinSpeed * dt;
      coin.position.y += Math.sin(elapsed * 2 + coin.position.x) * dt * 0.25;
      if (!coin.visible) return;
      if (playerBox.distanceToPoint(coin.position) < 0.7) {
        coin.visible = false;
        collected++;
        if (collected === level.coins.length) {
          finished = true;
          hud.show('Level complete', 'All ' + collected + ' coins in ' + elapsed.toFixed(1) + 's — press R to run it again');
        }
      }
    });

    hud.update(collected, level.coins.length, elapsed);
  }

  // Orbit-follow camera.
  const target = player.object.position.clone().add(new THREE.Vector3(0, 1.2, 0));
  const dist = CONFIG.cameraDistance;
  const offset = new THREE.Vector3(
    Math.sin(input.yaw) * Math.cos(input.pitch) * dist,
    Math.sin(input.pitch) * dist + CONFIG.cameraHeight * 0.2,
    Math.cos(input.yaw) * Math.cos(input.pitch) * dist,
  );
  camera.position.lerp(target.clone().add(offset), Math.min(1, dt * 10));
  camera.lookAt(target);

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

frame();
`,

    'blender/make_assets.py': `"""Generate this game's 3D art in Blender and export it to assets/.

Run headless:
    blender --background --python blender/make_assets.py
Or through Aura:
    blender action=script script=blender/make_assets.py

Everything here is procedural, so the art is reproducible and diffable: edit
the numbers, re-run, and the game picks up the new .glb on reload.
"""
import bpy
import math
import os

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets")


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def material(name, rgba, roughness=0.5, metallic=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return mat


def add(obj, mat):
    obj.data.materials.append(mat)
    return obj


def build_player():
    clear_scene()
    skin = material("Skin", (0.42, 0.90, 1.0, 1.0), roughness=0.35)
    dark = material("Dark", (0.10, 0.12, 0.20, 1.0), roughness=0.6)

    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.32, location=(0, 0, 1.25))
    head = add(bpy.context.object, skin)
    head.name = "Head"

    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.72))
    torso = bpy.context.object
    torso.scale = (0.30, 0.20, 0.38)
    add(torso, skin).name = "Torso"

    for side in (-1, 1):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(side * 0.40, 0, 0.75))
        arm = bpy.context.object
        arm.scale = (0.09, 0.09, 0.30)
        add(arm, dark).name = "Arm.%d" % (side + 1)

        bpy.ops.mesh.primitive_cube_add(size=1, location=(side * 0.15, 0, 0.20))
        leg = bpy.context.object
        leg.scale = (0.11, 0.11, 0.22)
        add(leg, dark).name = "Leg.%d" % (side + 1)

    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.shade_smooth()
    export("player.glb")


def build_props():
    clear_scene()
    stone = material("Stone", (0.29, 0.35, 0.48, 1.0), roughness=0.9)
    glow = material("Glow", (0.49, 0.36, 1.0, 1.0), roughness=0.3, metallic=0.4)

    for i in range(6):
        angle = i * math.tau / 6
        bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.6, depth=1.6,
                                            location=(math.cos(angle) * 3, math.sin(angle) * 3, 0.8))
        add(bpy.context.object, stone).name = "Pillar.%d" % i

    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.7, location=(0, 0, 1.4))
    add(bpy.context.object, glow).name = "Shrine"
    export("props.glb")


def export(filename):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, filename)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True)
    print("Exported", path)


build_player()
build_props()
print("Assets written to", OUT)
`,

    'assets/README.md': `# assets

Drop glTF/GLB files here — the game loads them automatically when present:

| File | Used by | Fallback when missing |
|------|---------|-----------------------|
| \`player.glb\` | \`src/player.js\` | capsule primitive |
| \`level.glb\` | \`src/level.js\` | grey/violet box platforms (still the collision source) |

Generate the starter set with Blender:

\`\`\`bash
blender --background --python blender/make_assets.py
\`\`\`

Collision always comes from the \`PLATFORMS\` list in \`src/level.js\`, never from
the imported mesh — keep the two in sync when you reshape the level.
`,

    'README.md': `# ${name}

3D browser platformer built on Three.js. No build step, no npm install.

## Run

\`\`\`bash
python3 -m http.server 8000
# open http://localhost:8000
\`\`\`

Any static server works; ES modules need HTTP, so opening \`index.html\` from
the filesystem will not work.

## Controls

| Input | Action |
|-------|--------|
| WASD / arrows | Move (camera-relative) |
| Space | Jump |
| Drag | Orbit camera |
| R | Restart |

## Layout

\`\`\`
index.html          importmap + HUD markup
src/main.js         bootstrap, game loop, win condition
src/config.js       all gameplay tunables
src/player.js       AABB character controller
src/level.js        platform + coin layout (geometry AND collision)
src/input.js        keyboard + pointer-drag
src/hud.js          score / timer / banner
src/assets.js       glTF loader that tolerates missing files
blender/make_assets.py  procedural art, exports to assets/*.glb
\`\`\`

## Art pipeline

\`\`\`bash
blender --background --python blender/make_assets.py   # writes assets/player.glb, assets/props.glb
\`\`\`

Models are optional: the game runs on primitives and upgrades itself when a
\`.glb\` appears. See \`assets/README.md\`.

## Extending

- New platform or coin → add a row to \`PLATFORMS\` / \`COINS\` in \`src/level.js\`.
- Feel (gravity, jump height, speed) → \`src/config.js\`.
- New mechanic → new module in \`src/\`, called from the loop in \`main.js\`.
`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Godot 4 — 3D collectathon
// ─────────────────────────────────────────────────────────────────────────────

function godotFiles(name: string): Record<string, string> {
  return {
    'project.godot': `; Godot 4 project file.
config_version=5

[application]

config/name="${name}"
run/main_scene="res://scenes/main.tscn"
config/features=PackedStringArray("4.2", "Forward Plus")

[display]

window/size/viewport_width=1280
window/size/viewport_height=720

[input]

move_forward={
"deadzone": 0.5,
"events": [Object(InputEventKey,"physical_keycode":87,"pressed":false,"script":null), Object(InputEventKey,"physical_keycode":4194320,"pressed":false,"script":null)]
}
move_back={
"deadzone": 0.5,
"events": [Object(InputEventKey,"physical_keycode":83,"pressed":false,"script":null), Object(InputEventKey,"physical_keycode":4194322,"pressed":false,"script":null)]
}
move_left={
"deadzone": 0.5,
"events": [Object(InputEventKey,"physical_keycode":65,"pressed":false,"script":null), Object(InputEventKey,"physical_keycode":4194319,"pressed":false,"script":null)]
}
move_right={
"deadzone": 0.5,
"events": [Object(InputEventKey,"physical_keycode":68,"pressed":false,"script":null), Object(InputEventKey,"physical_keycode":4194321,"pressed":false,"script":null)]
}
jump={
"deadzone": 0.5,
"events": [Object(InputEventKey,"physical_keycode":32,"pressed":false,"script":null)]
}
restart={
"deadzone": 0.5,
"events": [Object(InputEventKey,"physical_keycode":82,"pressed":false,"script":null)]
}
`,

    'scripts/player.gd': `extends CharacterBody3D
## Third-person character controller: camera-relative movement, jump,
## mouse look on a SpringArm, and respawn when falling off the level.

@export var speed := 7.0
@export var jump_velocity := 9.0
@export var mouse_sensitivity := 0.0025
@export var kill_plane := -20.0

var _spawn: Vector3
var _gravity: float = ProjectSettings.get_setting("physics/3d/default_gravity")

@onready var pivot: Node3D = $CameraPivot


func _ready() -> void:
	_spawn = global_position
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		pivot.rotate_y(-event.relative.x * mouse_sensitivity)
		pivot.rotation.x = clampf(
			pivot.rotation.x - event.relative.y * mouse_sensitivity, -1.2, 0.6
		)
	elif event.is_action_pressed("ui_cancel"):
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE


func _physics_process(delta: float) -> void:
	if not is_on_floor():
		velocity.y -= _gravity * delta
	elif Input.is_action_just_pressed("jump"):
		velocity.y = jump_velocity

	var input_dir := Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	var basis := pivot.global_transform.basis
	var direction := (basis.x * input_dir.x + basis.z * input_dir.y)
	direction.y = 0.0
	direction = direction.normalized()

	if direction:
		velocity.x = direction.x * speed
		velocity.z = direction.z * speed
		look_at(global_position + direction, Vector3.UP)
	else:
		velocity.x = move_toward(velocity.x, 0.0, speed * 4.0 * delta)
		velocity.z = move_toward(velocity.z, 0.0, speed * 4.0 * delta)

	move_and_slide()

	if global_position.y < kill_plane:
		respawn()


func respawn() -> void:
	global_position = _spawn
	velocity = Vector3.ZERO
`,

    'scripts/coin.gd': `extends Area3D
## Spinning pickup. Reports to the game controller and removes itself.

signal collected

@export var spin_speed := 2.5

var _t := 0.0
var _base_y := 0.0


func _ready() -> void:
	_base_y = position.y
	body_entered.connect(_on_body_entered)


func _process(delta: float) -> void:
	_t += delta
	rotate_y(spin_speed * delta)
	position.y = _base_y + sin(_t * 2.0) * 0.15


func _on_body_entered(body: Node3D) -> void:
	if body is CharacterBody3D:
		collected.emit()
		queue_free()
`,

    'scripts/game.gd': `extends Node3D
## Game controller: counts pickups, drives the HUD, handles win + restart.

@onready var label: Label = $UI/Status

var _total := 0
var _collected := 0
var _elapsed := 0.0
var _won := false


func _ready() -> void:
	var coins := get_tree().get_nodes_in_group("coins")
	_total = coins.size()
	for coin in coins:
		coin.collected.connect(_on_coin_collected)
	_update_label()


func _process(delta: float) -> void:
	if Input.is_action_just_pressed("restart"):
		get_tree().reload_current_scene()
		return
	if _won:
		return
	_elapsed += delta
	_update_label()


func _on_coin_collected() -> void:
	_collected += 1
	if _collected >= _total:
		_won = true
	_update_label()


func _update_label() -> void:
	if _won:
		label.text = "Complete — %d coins in %.1fs\\nPress R to restart" % [_total, _elapsed]
	else:
		label.text = "Coins %d / %d    %.1fs" % [_collected, _total, _elapsed]
`,

    'scenes/player.tscn': `[gd_scene load_steps=5 format=3]

[ext_resource type="Script" path="res://scripts/player.gd" id="1"]

[sub_resource type="CapsuleShape3D" id="Shape"]
radius = 0.4
height = 1.8

[sub_resource type="CapsuleMesh" id="Mesh"]
radius = 0.4
height = 1.8

[sub_resource type="StandardMaterial3D" id="Mat"]
albedo_color = Color(0.43, 0.9, 1, 1)

[node name="Player" type="CharacterBody3D"]
script = ExtResource("1")

[node name="Collision" type="CollisionShape3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0.9, 0)
shape = SubResource("Shape")

[node name="Mesh" type="MeshInstance3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0.9, 0)
mesh = SubResource("Mesh")
surface_material_override/0 = SubResource("Mat")

[node name="CameraPivot" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1.5, 0)

[node name="SpringArm3D" type="SpringArm3D" parent="CameraPivot"]
spring_length = 6.0

[node name="Camera3D" type="Camera3D" parent="CameraPivot/SpringArm3D"]
`,

    'scenes/coin.tscn': `[gd_scene load_steps=5 format=3]

[ext_resource type="Script" path="res://scripts/coin.gd" id="1"]

[sub_resource type="SphereShape3D" id="Shape"]
radius = 0.6

[sub_resource type="TorusMesh" id="Mesh"]
inner_radius = 0.22
outer_radius = 0.42

[sub_resource type="StandardMaterial3D" id="Mat"]
albedo_color = Color(1, 0.79, 0.3, 1)
metallic = 0.7
roughness = 0.25

[node name="Coin" type="Area3D" groups=["coins"]]
script = ExtResource("1")
monitoring = true

[node name="Collision" type="CollisionShape3D" parent="."]
shape = SubResource("Shape")

[node name="Mesh" type="MeshInstance3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 0, -1, 0, 1, 0, 0, 0, 0)
mesh = SubResource("Mesh")
surface_material_override/0 = SubResource("Mat")
`,

    'scenes/main.tscn': `[gd_scene load_steps=8 format=3]

[ext_resource type="Script" path="res://scripts/game.gd" id="1"]
[ext_resource type="PackedScene" path="res://scenes/player.tscn" id="2"]
[ext_resource type="PackedScene" path="res://scenes/coin.tscn" id="3"]

[sub_resource type="BoxShape3D" id="GroundShape"]
size = Vector3(40, 1, 40)

[sub_resource type="BoxMesh" id="GroundMesh"]
size = Vector3(40, 1, 40)

[sub_resource type="BoxShape3D" id="PlatformShape"]
size = Vector3(6, 1, 6)

[sub_resource type="BoxMesh" id="PlatformMesh"]
size = Vector3(6, 1, 6)

[node name="Main" type="Node3D"]
script = ExtResource("1")

[node name="Sun" type="DirectionalLight3D" parent="."]
transform = Transform3D(0.87, -0.29, 0.4, 0, 0.81, 0.58, -0.49, -0.51, 0.71, 0, 12, 0)
shadow_enabled = true

[node name="Ground" type="StaticBody3D" parent="."]

[node name="Collision" type="CollisionShape3D" parent="Ground"]
shape = SubResource("GroundShape")

[node name="Mesh" type="MeshInstance3D" parent="Ground"]
mesh = SubResource("GroundMesh")

[node name="Platform1" type="StaticBody3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 6, 1.5, -6)

[node name="Collision" type="CollisionShape3D" parent="Platform1"]
shape = SubResource("PlatformShape")

[node name="Mesh" type="MeshInstance3D" parent="Platform1"]
mesh = SubResource("PlatformMesh")

[node name="Platform2" type="StaticBody3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 3, -12)

[node name="Collision" type="CollisionShape3D" parent="Platform2"]
shape = SubResource("PlatformShape")

[node name="Mesh" type="MeshInstance3D" parent="Platform2"]
mesh = SubResource("PlatformMesh")

[node name="Platform3" type="StaticBody3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, -6, 4.5, -8)

[node name="Collision" type="CollisionShape3D" parent="Platform3"]
shape = SubResource("PlatformShape")

[node name="Mesh" type="MeshInstance3D" parent="Platform3"]
mesh = SubResource("PlatformMesh")

[node name="Player" parent="." instance=ExtResource("2")]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 6)

[node name="Coin1" parent="." instance=ExtResource("3")]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 6, 3.2, -6)

[node name="Coin2" parent="." instance=ExtResource("3")]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 4.7, -12)

[node name="Coin3" parent="." instance=ExtResource("3")]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, -6, 6.2, -8)

[node name="Coin4" parent="." instance=ExtResource("3")]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1.5, 3)

[node name="UI" type="CanvasLayer" parent="."]

[node name="Status" type="Label" parent="UI"]
offset_left = 16.0
offset_top = 12.0
offset_right = 500.0
offset_bottom = 80.0
text = "Coins 0 / 0"
`,

    'assets/README.md': `# assets

Godot imports anything you drop here. For Blender-authored art:

\`\`\`bash
blender --background yourfile.blend --python-expr "import bpy; bpy.ops.export_scene.gltf(filepath='assets/level.glb', export_format='GLB')"
\`\`\`

Or through Aura: \`blender action=export blend=art/level.blend output=assets/level.glb\`.

Then instance \`assets/level.glb\` in \`scenes/main.tscn\` and add a
\`StaticBody3D\` + \`CollisionShape3D\` (or use *Mesh → Create Trimesh Collision
Sibling* in the editor) so it is solid.
`,

    'README.md': `# ${name}

Godot 4 third-person 3D collectathon.

## Run

\`\`\`bash
godot --path .            # headless-friendly CLI launch
\`\`\`

or open \`project.godot\` in the Godot 4 editor and press F5.

## Controls

| Input | Action |
|-------|--------|
| WASD / arrows | Move |
| Mouse | Look |
| Space | Jump |
| R | Restart |
| Esc | Release mouse |

## Layout

\`\`\`
project.godot        input map, window, main scene
scenes/main.tscn     level geometry, lights, player + coins, HUD
scenes/player.tscn   CharacterBody3D + SpringArm camera
scenes/coin.tscn     Area3D pickup
scripts/player.gd    movement, jump, mouse look, respawn
scripts/coin.gd      spin, bob, collect signal
scripts/game.gd      score, timer, win state, restart
\`\`\`

Coins are found by group, not by path — duplicate \`coin.tscn\` anywhere in the
scene and the counter picks it up automatically.
`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Phaser 3 — 2D platformer
// ─────────────────────────────────────────────────────────────────────────────

function phaserFiles(name: string): Record<string, string> {
  return {
    'index.html': `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name}</title>
<style>
  :root { color-scheme: dark; }
  * { margin: 0; padding: 0; }
  body { background: #10131c; display: grid; place-items: center; min-height: 100vh;
         font: 14px system-ui, sans-serif; color: #e8ecf5; }
  canvas { border-radius: 8px; box-shadow: 0 20px 60px rgba(0,0,0,.5); }
  p { margin-top: 12px; opacity: .55; }
</style>
</head>
<body>
  <div>
    <div id="game"></div>
    <p>← → move &nbsp;·&nbsp; ↑ / Space jump &nbsp;·&nbsp; collect every coin, dodge the drones</p>
  </div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/phaser/3.80.1/phaser.min.js"></script>
  <script src="./src/textures.js"></script>
  <script src="./src/game.js"></script>
</body>
</html>
`,

    'src/textures.js': `// Procedural textures — the game ships with no binary art, so every sprite is
// drawn once into a canvas at boot. Swap any of these for scene.load.image()
// calls when real art arrives.
window.makeTextures = function (scene) {
  function rect(key, w, h, fill, stroke) {
    const g = scene.make.graphics({ add: false });
    g.fillStyle(fill, 1);
    g.fillRoundedRect(0, 0, w, h, Math.min(6, h / 3));
    if (stroke !== undefined) {
      g.lineStyle(2, stroke, 1);
      g.strokeRoundedRect(1, 1, w - 2, h - 2, Math.min(6, h / 3));
    }
    g.generateTexture(key, w, h);
    g.destroy();
  }

  function circle(key, r, fill, stroke) {
    const g = scene.make.graphics({ add: false });
    g.fillStyle(fill, 1);
    g.fillCircle(r, r, r);
    if (stroke !== undefined) {
      g.lineStyle(2, stroke, 1);
      g.strokeCircle(r, r, r - 1);
    }
    g.generateTexture(key, r * 2, r * 2);
    g.destroy();
  }

  rect('player', 28, 40, 0x6ee7ff, 0x1b3a49);
  rect('ground', 400, 32, 0x2c3550, 0x46527a);
  rect('platform', 160, 24, 0x3b4a75, 0x6274b4);
  circle('coin', 10, 0xffc94d, 0x8a5f00);
  circle('drone', 14, 0xff6b81, 0x6d1622);
};
`,

    'src/game.js': `// ─────────────────────────────────────────────────────────────────────────────
// 2D platformer. Arcade physics, three lives, coin objective, patrolling
// drones, restart on death.
// ─────────────────────────────────────────────────────────────────────────────

const WIDTH = 960;
const HEIGHT = 540;
const SPAWN = { x: 80, y: 380 };

const PLATFORMS = [
  { x: 260, y: 420, scale: 1.0 },
  { x: 520, y: 340, scale: 0.8 },
  { x: 760, y: 250, scale: 0.9 },
  { x: 420, y: 180, scale: 0.7 },
  { x: 140, y: 250, scale: 0.7 },
];

const COINS = [
  { x: 260, y: 380 }, { x: 520, y: 300 }, { x: 760, y: 210 },
  { x: 420, y: 140 }, { x: 140, y: 210 }, { x: 880, y: 440 }, { x: 640, y: 440 },
];

const DRONES = [
  { x: 520, y: 300, range: 90 },
  { x: 760, y: 210, range: 70 },
];

class PlayScene extends Phaser.Scene {
  constructor() { super('play'); }

  create() {
    window.makeTextures(this);

    this.score = 0;
    this.lives = 3;
    this.won = false;

    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x151a29);

    this.solids = this.physics.add.staticGroup();
    const ground = this.solids.create(WIDTH / 2, HEIGHT - 16, 'ground');
    ground.setScale(WIDTH / 400, 1).refreshBody();
    PLATFORMS.forEach((p) => {
      this.solids.create(p.x, p.y, 'platform').setScale(p.scale, 1).refreshBody();
    });

    this.player = this.physics.add.sprite(SPAWN.x, SPAWN.y, 'player');
    this.player.setBounce(0.05).setCollideWorldBounds(true);
    this.physics.add.collider(this.player, this.solids);

    this.coins = this.physics.add.group();
    COINS.forEach((c) => {
      const coin = this.coins.create(c.x, c.y, 'coin');
      coin.setBounceY(0.3);
      coin.body.setAllowGravity(false);
      this.tweens.add({ targets: coin, y: c.y - 8, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    });
    this.physics.add.overlap(this.player, this.coins, this.collect, null, this);

    this.drones = this.physics.add.group();
    DRONES.forEach((d) => {
      const drone = this.drones.create(d.x, d.y - 40, 'drone');
      drone.body.setAllowGravity(false);
      drone.setImmovable(true);
      this.tweens.add({
        targets: drone, x: d.x + d.range, duration: 1600,
        yoyo: true, repeat: -1, ease: 'Sine.inOut',
      });
    });
    this.physics.add.overlap(this.player, this.drones, this.hit, null, this);

    this.hud = this.add.text(16, 14, '', { fontFamily: 'system-ui', fontSize: '18px', color: '#e8ecf5' });
    this.banner = this.add.text(WIDTH / 2, HEIGHT / 2, '', {
      fontFamily: 'system-ui', fontSize: '30px', color: '#ffffff', align: 'center',
    }).setOrigin(0.5).setVisible(false);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.jumpKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.input.keyboard.on('keydown-R', () => { this.scene.restart(); });

    this.updateHud();
  }

  update() {
    if (this.won || this.lives <= 0) return;

    const speed = 260;
    if (this.cursors.left.isDown) {
      this.player.setVelocityX(-speed);
      this.player.setFlipX(true);
    } else if (this.cursors.right.isDown) {
      this.player.setVelocityX(speed);
      this.player.setFlipX(false);
    } else {
      this.player.setVelocityX(0);
    }

    const wantsJump = this.cursors.up.isDown || this.jumpKey.isDown;
    if (wantsJump && this.player.body.touching.down) this.player.setVelocityY(-520);

    // Fell off the world.
    if (this.player.y > HEIGHT + 60) this.hit();
  }

  collect(player, coin) {
    coin.disableBody(true, true);
    this.score++;
    if (this.score === COINS.length) {
      this.won = true;
      this.player.setVelocity(0, 0);
      this.finish('You win\\nPress R to play again');
    }
    this.updateHud();
  }

  hit() {
    if (this.won) return;
    this.lives--;
    this.updateHud();
    if (this.lives <= 0) {
      this.player.setTint(0xff6b81);
      this.player.setVelocity(0, 0);
      this.finish('Game over\\nPress R to try again');
      return;
    }
    this.player.setPosition(SPAWN.x, SPAWN.y);
    this.player.setVelocity(0, 0);
  }

  finish(text) {
    this.physics.pause();
    this.banner.setText(text).setVisible(true);
  }

  updateHud() {
    this.hud.setText('Coins ' + this.score + ' / ' + COINS.length + '     Lives ' + Math.max(0, this.lives));
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: '#10131c',
  physics: { default: 'arcade', arcade: { gravity: { y: 1100 }, debug: false } },
  scene: [PlayScene],
});
`,

    'README.md': `# ${name}

2D platformer on Phaser 3. No build step, no npm install, no binary assets —
every sprite is generated at boot in \`src/textures.js\`.

## Run

\`\`\`bash
python3 -m http.server 8000
# open http://localhost:8000
\`\`\`

## Controls

| Input | Action |
|-------|--------|
| ← → | Move |
| ↑ / Space | Jump |
| R | Restart |

## Layout

\`\`\`
index.html        Phaser CDN + mount point
src/textures.js   procedural sprite generation
src/game.js       scene, physics, coins, drones, lives, win/lose
\`\`\`

Level design lives in the \`PLATFORMS\`, \`COINS\` and \`DRONES\` arrays at the top
of \`src/game.js\` — add a row and it appears in the game.
`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export function templateFor(engine: Engine, name: string): Record<string, string> {
  switch (engine) {
    case 'three':  return threeFiles(name);
    case 'godot':  return godotFiles(name);
    case 'phaser': return phaserFiles(name);
  }
}
