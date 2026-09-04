#!/usr/bin/env node
/*
 * build-greece-art.js — paints the site's watercolour artwork as standalone SVG.
 *
 * Two canvases are emitted:
 *   greece-hero.svg   the hero: a Doric temple on a headland, Athos behind it
 *   athos-cliff.svg   the wide band: monasteries clinging to the Athos cliffs
 *
 * They are standalone files loaded through <img>, NOT inlined. That is
 * deliberate: index.html cannot carry CSS filters or blended full-page layers
 * (Chrome's rasterizer corrupts the page below ~2600px — see the note in the
 * stylesheet), and an <img> puts every filter and multiply blend inside its own
 * document where it is safe.
 *
 * Watercolour is faked with three tricks, layered:
 *   1. feTurbulence -> feDisplacementMap  ragged, bleeding pigment edges
 *   2. the same path stroked over its own fill   the dark rim wet paint leaves
 *   3. a fractal-noise multiply over everything  cold-press paper grain
 *
 *   node site/build-greece-art.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

/* ── seeded rng so a rebuild repaints the identical picture ─────────────── */
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const n2 = (x) => Math.round(x * 100) / 100;

/* ── palette ────────────────────────────────────────────────────────────── */
const C = {
  paper:      '#fdfaf2',
  skyHigh:    '#2f9fd4',
  skyMid:     '#9ad9ef',
  skyLow:     '#ffdcab',
  cloud:      '#ffffff',
  cloudRose:  '#f4b9a6',
  peakFar:    '#8ba4c8',
  peakLit:    '#fbf8f0',
  peakShade:  '#546f9c',
  seaDeep:    '#0b5c7e',
  seaMid:     '#1f9ab6',
  seaLight:   '#6ccdd8',
  foam:       '#ffffff',
  cliff:      '#e2b978',
  cliffShade: '#8f6a38',
  cliffLit:   '#f9e3ad',
  marble:     '#fdf8ec',
  marbleShade:'#c9b795',
  marbleDeep: '#8a7550',
  tile:       '#c0472c',
  tileShade:  '#7d2c18',
  cypress:    '#27452f',
  olive:      '#5f7a3f',
  scrub:      '#9aa855',
  ink:        '#2b3b46',
};

/* ── reusable defs: displacement filters at three coarsenesses ──────────── */
function defs(seed) {
  const wc = (id, freq, oct, scale, s) =>
    `<filter id="${id}" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">` +
    `<feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${oct}" seed="${s}" result="n"/>` +
    `<feDisplacementMap in="SourceGraphic" in2="n" scale="${scale}" xChannelSelector="R" yChannelSelector="G"/>` +
    `</filter>`;
  return [
    '<defs>',
    wc('wcBig',  '0.008 0.011', 4, 34, seed + 1),   // sky, sea — broad soft bleed
    wc('wcMid',  '0.017 0.021', 4, 18, seed + 2),   // hills, cliffs
    wc('wcFine', '0.038 0.044', 3, 7,  seed + 3),   // buildings, trees
    wc('wcHair', '0.070 0.080', 2, 2.5, seed + 4),  // linework
    `<filter id="grain" x="0" y="0" width="100%" height="100%">`,
    `<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" seed="${seed + 9}"/>`,
    `<feColorMatrix type="saturate" values="0"/>`,
    `</filter>`,
    `<filter id="soft" x="-30%" y="-30%" width="160%" height="160%">`,
    `<feGaussianBlur stdDeviation="14"/></filter>`,
    /* Broad fields are painted as gradients, not stacked translucent rects:
       stacked rects leave hard horizontal seams where each wash ends. */
    `<linearGradient id="gSky" x1="0" y1="0" x2="0" y2="1">`,
    `<stop offset="0" stop-color="${C.skyHigh}"/>`,
    `<stop offset=".38" stop-color="${C.skyMid}"/>`,
    `<stop offset=".72" stop-color="#e4f2f2"/>`,
    `<stop offset="1" stop-color="${C.skyLow}"/></linearGradient>`,
    `<linearGradient id="gSea" x1="0" y1="0" x2="0" y2="1">`,
    `<stop offset="0" stop-color="${C.seaLight}"/>`,
    `<stop offset=".26" stop-color="${C.seaMid}"/>`,
    `<stop offset="1" stop-color="${C.seaDeep}"/></linearGradient>`,
    `<linearGradient id="gLand" x1="0" y1="0" x2="0" y2="1">`,
    `<stop offset="0" stop-color="${C.cliffLit}"/>`,
    `<stop offset=".45" stop-color="${C.cliff}"/>`,
    `<stop offset="1" stop-color="${C.cliffShade}"/></linearGradient>`,
    `<linearGradient id="gMarble" x1="0" y1="0" x2="1" y2="1">`,
    `<stop offset="0" stop-color="${C.marbleShade}"/>`,
    `<stop offset=".45" stop-color="${C.marble}"/>`,
    `<stop offset="1" stop-color="#fffdf7"/></linearGradient>`,
    /* Inside the colonnade you are looking at sun-warmed stone in shadow,
       not at glass — so the cella is a warm brown, never a neutral grey. */
    `<linearGradient id="gCella" x1="0" y1="0" x2="0" y2="1">`,
    `<stop offset="0" stop-color="#5d4a35"/>`,
    `<stop offset=".55" stop-color="#876f50"/>`,
    `<stop offset="1" stop-color="#b59672"/></linearGradient>`,
    `<radialGradient id="gSun">`,
    `<stop offset="0" stop-color="#ffffff" stop-opacity=".95"/>`,
    `<stop offset=".35" stop-color="#fff2c8" stop-opacity=".7"/>`,
    `<stop offset="1" stop-color="#ffdca0" stop-opacity="0"/></radialGradient>`,
    '</defs>',
  ].join('');
}

/* ── wash: a filled shape plus its own darker rim, the way wet paint dries ─ */
function wash(d, fill, op, filter, rim) {
  const f = filter || 'wcMid';
  let out = `<path d="${d}" fill="${fill}" opacity="${op}" filter="url(#${f})"/>`;
  if (rim) {
    out += `<path d="${d}" fill="none" stroke="${fill}" stroke-width="${rim}" ` +
           `opacity="${n2(op * 0.55)}" filter="url(#${f})"/>`;
  }
  return out;
}

/* a loose pigment bloom — the puddle that pools when a brush sits still */
function bloom(cx, cy, rx, ry, fill, op, rot) {
  return `<ellipse cx="${n2(cx)}" cy="${n2(cy)}" rx="${n2(rx)}" ry="${n2(ry)}" fill="${fill}" ` +
         `opacity="${op}" filter="url(#wcBig)"` +
         (rot ? ` transform="rotate(${n2(rot)} ${n2(cx)} ${n2(cy)})"` : '') + `/>`;
}

const rect = (x, y, w, h, fill, op, f) =>
  `<path d="M${n2(x)},${n2(y)} H${n2(x + w)} V${n2(y + h)} H${n2(x)} Z" fill="${fill}" ` +
  `opacity="${op}"${f ? ` filter="url(#${f})"` : ''}/>`;

/* ── a ridgeline: jagged where rock is, smooth where distance softens it ── */
function ridge(x0, y0, pts, x1, y1, baseY) {
  let d = `M${n2(x0)},${n2(baseY)} L${n2(x0)},${n2(y0)}`;
  for (const [x, y] of pts) d += ` L${n2(x)},${n2(y)}`;
  d += ` L${n2(x1)},${n2(y1)} L${n2(x1)},${n2(baseY)} Z`;
  return d;
}

/* ── dry-brush: broken horizontal strokes, how a sea is actually painted ── */
function dryBrush(r, x0, x1, y0, y1, count, color, maxOp) {
  let s = '';
  for (let i = 0; i < count; i++) {
    const y = y0 + (y1 - y0) * (i / count) + r() * 6;
    const w = (x1 - x0) * (0.18 + r() * 0.5);
    const x = x0 + r() * (x1 - x0 - w);
    const t = 1.4 + r() * 4;
    /* Two things matter here. wcHair, not wcMid: a 2px stroke shoved 18px
       around is scattered into nothing. And the mark must SAG — a filter
       region is a percentage of the bounding box, and a perfectly horizontal
       line has a zero-height box, so a level stroke filters away to nothing. */
    const sag = 1.5 + r() * 5;
    s += `<path d="M${n2(x)},${n2(y)} q${n2(w / 2)},${n2(sag)} ${n2(w)},${n2((r() - 0.5) * 4)}" ` +
         `fill="none" stroke="${color}" stroke-width="${n2(t)}" ` +
         `stroke-linecap="round" opacity="${n2(0.05 + r() * maxOp)}" filter="url(#wcHair)"/>`;
  }
  return s;
}

/* ─────────────────────────────────────────────────────────────────────────
   The temple. Hexastyle, Doric — six columns, which is also how many memory
   layers Aura carries. The colonnade on the page is this building.
   ───────────────────────────────────────────────────────────────────────── */
function temple(r, cx, baseY, W, colH) {
  const half = W / 2, L = cx - half, R = cx + half;
  let s = '';

  /* crepidoma — three steps, each set back from the one below */
  for (let i = 0; i < 3; i++) {
    const inset = i * 16, y = baseY - i * 15;
    s += rect(L - 32 + inset, y - 15, W + 64 - inset * 2, 17,
              i === 2 ? C.marble : C.marbleShade, 1, 'wcFine');
    s += rect(L - 32 + inset, y - 2, W + 64 - inset * 2, 5, C.marbleDeep, 0.35, 'wcHair');
  }
  const stylo = baseY - 45;
  const N = 6, span = (W - 44) / (N - 1), colW = 32, capY = stylo - colH;

  /* The cella wall, painted first and painted solid. Without it the sea
     shows straight through the colonnade and the building reads as a ghost. */
  s += `<path d="M${n2(L + 6)},${n2(capY - 6)} H${n2(R - 6)} V${n2(stylo)} H${n2(L + 6)} Z" ` +
       `fill="url(#gCella)" filter="url(#wcFine)"/>`;
  /* light bounces off the stylobate back onto the cella wall */
  s += bloom(cx, stylo - 12, W * 0.42, 16, C.cliffLit, 0.34);
  /* the architrave casts a hard line of shade along the top of it */
  s += rect(L + 6, capY - 6, W - 12, 26, '#3f3224', 0.45, 'wcFine');

  /* columns with entasis — they swell at the middle, they always did */
  for (let i = 0; i < N; i++) {
    const x = L + 22 + i * span;
    /* the sun is low and left, so the left face of each drum carries the light */
    const lit = i <= 2 ? 1 : 0.45;
    const d = `M${n2(x - colW / 2)},${n2(stylo)} ` +
              `C${n2(x - colW / 2 - 2.5)},${n2(stylo - colH * 0.45)} ${n2(x - colW / 2 - 1)},${n2(stylo - colH * 0.75)} ${n2(x - colW / 2 + 3)},${n2(capY)} ` +
              `H${n2(x + colW / 2 - 3)} ` +
              `C${n2(x + colW / 2 + 1)},${n2(stylo - colH * 0.75)} ${n2(x + colW / 2 + 2.5)},${n2(stylo - colH * 0.45)} ${n2(x + colW / 2)},${n2(stylo)} Z`;
    s += `<path d="${d}" fill="url(#gMarble)" filter="url(#wcFine)"/>`;
    /* the shaded half of the drum */
    s += `<path d="M${n2(x + colW * 0.1)},${n2(stylo)} H${n2(x + colW / 2)} L${n2(x + colW / 2 - 3)},${n2(capY)} ` +
         `H${n2(x + colW * 0.1)} Z" fill="${C.marbleDeep}" opacity="${n2(0.34 - lit * 0.18)}" filter="url(#wcFine)"/>`;
    /* flutes */
    for (let f = 1; f <= 4; f++) {
      const fx = x - colW / 2 + (colW * f) / 5;
      s += `<path d="M${n2(fx)},${n2(stylo - 4)} L${n2(fx + 1.5)},${n2(capY + 5)}" ` +
           `stroke="${C.marbleDeep}" stroke-width="1.5" opacity="${n2(0.24 + r() * 0.16)}" filter="url(#wcHair)"/>`;
    }
    /* echinus + abacus */
    s += rect(x - colW / 2 - 5, capY - 9, colW + 10, 10, C.marble, 1, 'wcFine');
    s += rect(x - colW / 2 - 8, capY - 17, colW + 16, 9, C.marble, 1, 'wcFine');
    s += rect(x - colW / 2 - 8, capY - 9, colW + 16, 2.5, C.marbleDeep, 0.4, 'wcHair');
    /* each column throws its own shadow onto the wall behind it */
    if (i < N - 1) {
      s += rect(x + colW / 2, capY + 4, 13, colH - 6, '#43341f', 0.28, 'wcFine');
    }
  }

  /* architrave, triglyph frieze, cornice */
  const entY = capY - 17;
  s += rect(L - 16, entY - 23, W + 32, 24, C.marble, 1, 'wcFine');
  s += rect(L - 20, entY - 46, W + 40, 23, C.marble, 1, 'wcFine');
  s += rect(L - 20, entY - 24, W + 40, 3, C.marbleDeep, 0.4, 'wcHair');
  for (let i = 0; i < N * 2 - 1; i++) {                 // triglyphs over columns & voids
    const x = L + 22 + (i * span) / 2 - 5.5;
    s += rect(x, entY - 44, 11, 20, C.marbleDeep, 0.5, 'wcHair');
  }
  s += rect(L - 28, entY - 57, W + 56, 13, C.marble, 1, 'wcFine');

  /* pediment */
  const pedBase = entY - 57, apex = pedBase - W * 0.19;
  const ped = `M${n2(L - 28)},${n2(pedBase)} L${n2(cx)},${n2(apex)} L${n2(R + 28)},${n2(pedBase)} Z`;
  s += `<path d="${ped}" fill="url(#gMarble)" filter="url(#wcFine)"/>`;
  /* tympanum — the relief you can no longer read */
  s += `<path d="M${n2(L - 6)},${n2(pedBase - 9)} L${n2(cx)},${n2(apex + 15)} L${n2(R + 6)},${n2(pedBase - 9)} Z" ` +
       `fill="${C.marbleDeep}" opacity="0.42" filter="url(#wcFine)"/>`;
  /* raking cornice catching the sun */
  s += `<path d="M${n2(L - 32)},${n2(pedBase + 5)} L${n2(cx)},${n2(apex - 6)} L${n2(R + 32)},${n2(pedBase + 5)}" ` +
       `fill="none" stroke="${C.marble}" stroke-width="9" stroke-linejoin="round" filter="url(#wcFine)"/>`;
  s += `<path d="M${n2(L - 32)},${n2(pedBase + 5)} L${n2(cx)},${n2(apex - 6)} L${n2(R + 32)},${n2(pedBase + 5)}" ` +
       `fill="none" stroke="${C.marbleDeep}" stroke-width="1.6" opacity="0.3" stroke-linejoin="round" filter="url(#wcHair)"/>`;
  return s;
}

/* ─────────────────────────────────────────────────────────────────────────
   A monastery: stacked blocks and red tiles, hung off a cliff face.
   ───────────────────────────────────────────────────────────────────────── */
function monastery(r, x, y, s) {
  const roof = (bx, by, bw) =>
    `<path d="M${n2(bx - 4)},${n2(by)} L${n2(bx + bw / 2)},${n2(by - bw * 0.34)} L${n2(bx + bw + 4)},${n2(by)} Z" ` +
    `fill="${C.tile}" opacity="0.82" filter="url(#wcFine)"/>` +
    `<path d="M${n2(bx - 4)},${n2(by)} L${n2(bx + bw / 2)},${n2(by - bw * 0.34)}" fill="none" ` +
    `stroke="${C.tileShade}" stroke-width="2" opacity="0.5" filter="url(#wcHair)"/>`;

  let out = '';
  /* the retaining wall the whole thing sits on, straight out of the rock */
  out += `<path d="M${n2(x - 12 * s)},${n2(y)} H${n2(x + 96 * s)} L${n2(x + 84 * s)},${n2(y + 34 * s)} ` +
         `H${n2(x - 2 * s)} Z" fill="${C.marbleShade}" opacity="0.6" filter="url(#wcFine)"/>`;

  const blocks = [
    [0, 0, 40, 34], [38, -6, 30, 40], [66, 4, 26, 30], [14, -30, 22, 30],
  ];
  for (const [dx, dy, w, h] of blocks) {
    const bx = x + dx * s, by = y + dy * s, bw = w * s, bh = h * s;
    out += rect(bx, by - bh, bw, bh, C.marble, 0.88, 'wcFine');
    out += rect(bx, by - bh, bw * 0.34, bh, C.marbleShade, 0.3, 'wcFine');
    out += roof(bx, by - bh, bw);
    /* arched windows, two rows, slightly out of true */
    for (let ry = 0; ry < 2; ry++) {
      for (let cxw = 0; cxw < Math.max(2, Math.round(w / 14)); cxw++) {
        const wx = bx + (bw * (cxw + 0.7)) / Math.max(2, Math.round(w / 14) + 0.4);
        const wy = by - bh + bh * (0.34 + ry * 0.36);
        out += `<path d="M${n2(wx)},${n2(wy + 5 * s)} v${n2(-4 * s)} a${n2(2 * s)},${n2(2 * s)} 0 0 1 ${n2(4 * s)},0 ` +
               `v${n2(4 * s)} Z" fill="${C.ink}" opacity="${n2(0.34 + r() * 0.2)}" filter="url(#wcHair)"/>`;
      }
    }
  }
  /* the tower — every one of them has one */
  const tx = x + 30 * s, th = 74 * s, tw = 17 * s;
  out += rect(tx, y - 6 * s - th, tw, th, C.marble, 0.92, 'wcFine');
  out += rect(tx, y - 6 * s - th, tw * 0.35, th, C.marbleShade, 0.28, 'wcFine');
  out += roof(tx, y - 6 * s - th, tw);
  /* cypress, the punctuation mark of every Athonite courtyard */
  const cy0 = y - 4 * s;
  out += `<path d="M${n2(x + 100 * s)},${n2(cy0)} C${n2(x + 92 * s)},${n2(cy0 - 26 * s)} ` +
         `${n2(x + 96 * s)},${n2(cy0 - 52 * s)} ${n2(x + 101 * s)},${n2(cy0 - 60 * s)} ` +
         `C${n2(x + 106 * s)},${n2(cy0 - 52 * s)} ${n2(x + 110 * s)},${n2(cy0 - 26 * s)} ` +
         `${n2(x + 102 * s)},${n2(cy0)} Z" fill="${C.cypress}" opacity="0.78" filter="url(#wcFine)"/>`;
  return out;
}

function cypress(r, x, y, h, op) {
  const w = h * 0.22;
  return `<path d="M${n2(x - w / 2)},${n2(y)} C${n2(x - w * 0.7)},${n2(y - h * 0.45)} ` +
         `${n2(x - w * 0.4)},${n2(y - h * 0.82)} ${n2(x)},${n2(y - h)} ` +
         `C${n2(x + w * 0.4)},${n2(y - h * 0.82)} ${n2(x + w * 0.7)},${n2(y - h * 0.45)} ` +
         `${n2(x + w / 2)},${n2(y)} Z" fill="${C.cypress}" opacity="${op}" filter="url(#wcFine)"/>`;
}

const grain = (W, H, op) =>
  `<rect width="${W}" height="${H}" filter="url(#grain)" opacity="${op}" style="mix-blend-mode:multiply"/>`;

const open = (W, H, title) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" ` +
  `role="img" aria-label="${title}">`;

/* ═════════════════════════════════════════════════════════════════════════
   HERO — the temple on the headland, Athos standing behind it
   ═════════════════════════════════════════════════════════════════════════ */
function hero() {
  const W = 1600, H = 1100, HZ = 520;
  const r = rng(20260904);
  let s = open(W, H, 'Watercolour: an ancient Greek temple on a headland above the Aegean, Mount Athos behind') + defs(101);

  s += `<rect width="${W}" height="${H}" fill="${C.paper}"/>`;

  /* ── sky ── one gradient, then wet-in-wet blooms dropped into it ── */
  s += `<rect x="-40" y="-40" width="${W + 80}" height="${HZ + 60}" fill="url(#gSky)"/>`;
  s += bloom(1180, 116, 520, 96, C.skyHigh, 0.16, -4);
  s += bloom(420, 330, 480, 120, C.skyLow, 0.4, 3);
  /* the sun, low and left — which is why the temple is lit from that side */
  s += `<circle cx="360" cy="200" r="300" fill="url(#gSun)"/>`;

  /* clouds — lifted out with a clean brush, so they read as bare paper */
  const clouds = [[260, 128, 200, 34, -6], [640, 96, 250, 30, 3], [1210, 158, 280, 38, -4],
                  [930, 232, 210, 24, 2], [1450, 292, 220, 26, 5], [720, 322, 330, 20, -2]];
  for (const [cx, cy, rx, ry, rot] of clouds) {
    s += bloom(cx, cy, rx, ry, C.cloud, 0.82, rot);
    s += bloom(cx - rx * 0.24, cy + ry * 0.9, rx * 0.66, ry * 0.5, C.cloudRose, 0.16, rot);
  }

  /* ── Mount Athos, far off across the gulf ── */
  const athos = ridge(140, HZ - 30, [[300, 372], [430, 268], [548, 128], [604, 176], [730, 306], [880, 404]], 1010, HZ - 22, HZ + 10);
  s += `<path d="${athos}" fill="${C.peakFar}" opacity="0.72" filter="url(#wcMid)"/>`;
  s += `<path d="${athos}" fill="none" stroke="${C.peakShade}" stroke-width="3.5" opacity="0.5" filter="url(#wcMid)"/>`;
  /* the shaded east face, and the marble crown that makes it white from the sea */
  s += `<path d="M${548},${128} L${604},${176} L${730},${306} L${880},${404} L${640},${360} Z" ` +
       `fill="${C.peakShade}" opacity="0.26" filter="url(#wcBig)"/>`;
  s += `<path d="M${496},${196} L${548},${128} L${592},${190} L${544},${172} Z" fill="${C.peakLit}" opacity="0.95" filter="url(#wcFine)"/>`;
  /* a second, nearer headland to give the gulf its depth */
  const ridge2 = ridge(-40, HZ - 8, [[220, 466], [500, 432], [820, 462], [1120, 424], [1400, 458]], W + 40, HZ - 14, HZ + 10);
  s += `<path d="${ridge2}" fill="${C.peakShade}" opacity="0.42" filter="url(#wcMid)"/>`;

  /* ── the Aegean ── */
  s += `<rect x="-40" y="${HZ - 4}" width="${W + 80}" height="340" fill="url(#gSea)"/>`;
  s += dryBrush(r, 0, W, HZ + 14, HZ + 290, 30, C.seaDeep, 0.2);
  s += dryBrush(r, 0, W, HZ + 8, HZ + 250, 16, C.foam, 0.34);
  /* the glare the sun lays on the water: a broken column of light directly
     beneath it, widening as it comes towards you. Never a solid shape. */
  for (let i = 0; i < 42; i++) {
    const t = r();
    const y = HZ + 8 + t * 300;
    const spread = 20 + t * 130;
    const x = 360 + (r() - 0.5) * spread * 2;
    const w = 10 + r() * (18 + t * 70);
    s += `<path d="M${n2(x)},${n2(y)} q${n2(w / 2)},${n2(1 + r() * 3)} ${n2(w)},${n2((r() - 0.5) * 3)}" ` +
         `fill="none" stroke="#ffffff" stroke-width="${n2(1.4 + r() * 4)}" ` +
         `stroke-linecap="round" opacity="${n2((0.95 - t * 0.25) * (0.45 + r() * 0.55))}" filter="url(#wcHair)"/>`;
  }

  /* ── the near headland the temple stands on ── */
  const land = `M-40,${HZ + 210} C220,${HZ + 178} 470,${HZ + 240} 760,${HZ + 206} ` +
               `C1060,${HZ + 170} 1330,${HZ + 232} ${W + 40},${HZ + 198} L${W + 40},${H + 40} L-40,${H + 40} Z`;
  s += `<path d="${land}" fill="url(#gLand)" filter="url(#wcMid)"/>`;
  s += `<path d="${land}" fill="none" stroke="${C.cliffShade}" stroke-width="5" opacity="0.45" filter="url(#wcMid)"/>`;
  /* surf breaking along the foot of the headland */
  s += `<path d="M-40,${HZ + 210} C220,${HZ + 178} 470,${HZ + 240} 760,${HZ + 206} ` +
       `C1060,${HZ + 170} 1330,${HZ + 232} ${W + 40},${HZ + 198}" fill="none" stroke="${C.foam}" ` +
       `stroke-width="9" opacity="0.75" filter="url(#wcFine)"/>`;
  s += bloom(1140, H - 210, 460, 130, C.cliffLit, 0.44);
  s += bloom(760, H - 30, 560, 80, C.cliffShade, 0.3);
  /* dry scrubland: many small overlapping stains, not one green blob */
  for (let i = 0; i < 34; i++) {
    const x = r() * W, y = HZ + 230 + r() * (H - HZ - 250);
    s += bloom(x, y, 40 + r() * 130, 12 + r() * 34,
               r() > 0.55 ? C.olive : C.scrub, 0.12 + r() * 0.22, (r() - 0.5) * 14);
  }

  /* a small monastery on the far cliff, right — the first hint of Athos */
  s += monastery(r, 1400, HZ + 4, 0.44);

  /* ── the temple ── */
  s += temple(r, 1048, HZ + 268, 500, 230);
  /* the shadow it throws inland, and the ground it bites into */
  s += bloom(980, HZ + 292, 330, 26, C.cliffShade, 0.42);

  /* ── foreground: cypresses, olive scrub, dry strokes of grass ── */
  s += cypress(r, 206, H - 50, 330, 0.92);
  s += cypress(r, 266, H - 26, 230, 0.8);
  s += cypress(r, 1512, H - 60, 280, 0.86);
  s += bloom(520, H - 45, 250, 60, C.scrub, 0.5, -3);
  s += bloom(900, H - 20, 320, 50, C.olive, 0.42, 2);
  s += bloom(1320, H - 34, 270, 56, C.scrub, 0.44, -2);
  for (let i = 0; i < 110; i++) {
    const x = r() * W, y = H - 6 - r() * 130, l = 14 + r() * 34;
    s += `<path d="M${n2(x)},${n2(y)} q${n2((r() - 0.5) * 10)},${n2(-l * 0.6)} ${n2((r() - 0.5) * 18)},${n2(-l)}" ` +
         `fill="none" stroke="${r() > 0.45 ? C.olive : C.cypress}" stroke-width="${n2(1 + r() * 1.8)}" ` +
         `opacity="${n2(0.24 + r() * 0.36)}" stroke-linecap="round" filter="url(#wcHair)"/>`;
  }

  s += grain(W, H, 0.1);
  return s + '</svg>';
}

/* ═════════════════════════════════════════════════════════════════════════
   ATHOS — the wide band: monasteries hung on the cliff, the sea beneath
   ═════════════════════════════════════════════════════════════════════════ */
function athos() {
  const W = 1800, H = 760, HZ = 424;
  const r = rng(776);
  let s = open(W, H, 'Watercolour: a Byzantine monastery on the sheer cliffs of Mount Athos above the Aegean') + defs(303);

  /* One huge rock rather than a row of small ones. A cliff reads as a cliff
     when it is tall, near, and sheer — a wide band of low ochre lumps reads
     as a beach no matter how much shadow you put on it. */
  const rock = 'M980,700 L1004,520 L1028,392 L1062,300 L1104,224 L1168,168 L1246,146 ' +
               'L1320,168 L1402,132 L1490,178 L1592,150 L1700,196 L1840,168 L1840,700 Z';

  s += `<rect width="${W}" height="${H}" fill="${C.paper}"/>`;

  /* ── sky ── */
  s += `<rect x="-40" y="-40" width="${W + 80}" height="${HZ + 60}" fill="url(#gSky)"/>`;
  s += `<circle cx="470" cy="120" r="270" fill="url(#gSun)"/>`;
  for (const [cx, cy, rx, ry, rot] of [[240, 210, 240, 26, -4], [860, 92, 250, 26, 3],
                                       [1300, 62, 230, 22, -3], [700, 268, 280, 20, 2]]) {
    s += bloom(cx, cy, rx, ry, C.cloud, 0.85, rot);
    s += bloom(cx, cy + ry * 1.2, rx * 0.6, ry * 0.5, C.cloudRose, 0.14, rot);
  }

  /* ── the Holy Mountain, seen far off across the water ── */
  const peak = ridge(120, HZ - 20, [[280, 296], [400, 216], [512, 108], [566, 152], [688, 268], [820, 360]], 960, HZ - 14, HZ + 10);
  s += `<path d="${peak}" fill="${C.peakFar}" opacity="0.6" filter="url(#wcMid)"/>`;
  s += `<path d="M${512},${108} L${566},${152} L${688},${268} L${820},${360} L${590},${292} Z" ` +
       `fill="${C.peakShade}" opacity="0.26" filter="url(#wcMid)"/>`;
  s += `<path d="M${462},${172} L${512},${108} L${560},${170} L${512},${150} Z" fill="${C.peakLit}" opacity="0.95" filter="url(#wcFine)"/>`;

  /* ── the Aegean ── */
  s += `<rect x="-40" y="${HZ - 4}" width="${W + 80}" height="${H - HZ + 50}" fill="url(#gSea)"/>`;
  s += dryBrush(r, 0, W, HZ + 12, H - 10, 34, C.seaDeep, 0.24);
  s += dryBrush(r, 0, W, HZ + 8, H - 40, 20, C.foam, 0.42);
  for (let i = 0; i < 34; i++) {                        // the sun's road on the water
    const t = r(), y = HZ + 6 + t * 300, w = 12 + r() * (24 + t * 80);
    const x = 470 + (r() - 0.5) * (30 + t * 260);
    s += `<path d="M${n2(x)},${n2(y)} q${n2(w / 2)},${n2(1 + r() * 3)} ${n2(w)},${n2((r() - 0.5) * 3)}" ` +
         `fill="none" stroke="#ffffff" stroke-width="${n2(1.4 + r() * 3.6)}" stroke-linecap="round" ` +
         `opacity="${n2((0.9 - t * 0.3) * (0.4 + r() * 0.6))}" filter="url(#wcHair)"/>`;
  }

  /* ═══ the cliff ═══ everything below is clipped to its silhouette, so no
     gully or stratum can stray off the rock and float in the sky ═══ */
  s += `<clipPath id="rockClip"><path d="${rock}"/></clipPath>`;
  s += `<path d="${rock}" fill="url(#gLand)" filter="url(#wcMid)"/>`;
  s += `<g clip-path="url(#rockClip)">`;
  /* gullies — narrow, dark, and steeply raked, the way water cuts rock */
  for (let i = 0; i < 22; i++) {
    const x = 980 + r() * 860, yTop = 140 + r() * 220, w = 12 + r() * 44, drift = 30 + r() * 90;
    s += `<path d="M${n2(x)},${n2(yTop)} L${n2(x + w)},${n2(yTop + 18)} ` +
         `L${n2(x + w + drift)},760 L${n2(x + drift)},760 Z" ` +
         `fill="${C.cliffShade}" opacity="${n2(0.14 + r() * 0.24)}" filter="url(#wcMid)"/>`;
  }
  /* the lit ribs between them */
  for (let i = 0; i < 14; i++) {
    const x = 1000 + r() * 800, yTop = 150 + r() * 190, w = 14 + r() * 40, drift = 20 + r() * 80;
    s += `<path d="M${n2(x)},${n2(yTop)} L${n2(x + w)},${n2(yTop + 22)} ` +
         `L${n2(x + w + drift)},700 L${n2(x + drift)},700 Z" ` +
         `fill="${C.cliffLit}" opacity="${n2(0.14 + r() * 0.2)}" filter="url(#wcMid)"/>`;
  }
  /* the seaward face is turned away from the sun and stays cold and blue */
  s += `<path d="M980,700 L1004,520 L1028,392 L1062,300 L1104,224 L1168,168 L1210,240 L1150,420 L1104,700 Z" ` +
       `fill="${C.peakShade}" opacity="0.34" filter="url(#wcMid)"/>`;
  /* bedding planes */
  for (let i = 0; i < 20; i++) {
    const y = 200 + r() * 420, x = 980 + r() * 500, w = 120 + r() * 460;
    s += `<path d="M${n2(x)},${n2(y)} q${n2(w / 2)},${n2(6 + r() * 16)} ${n2(w)},${n2((r() - 0.5) * 14)}" ` +
         `fill="none" stroke="${C.cliffShade}" stroke-width="${n2(1.6 + r() * 4)}" ` +
         `opacity="${n2(0.1 + r() * 0.2)}" stroke-linecap="round" filter="url(#wcHair)"/>`;
  }
  s += bloom(1420, 300, 340, 130, C.cliffLit, 0.34);
  s += rect(960, 600, 900, 110, '#5c4526', 0.4, 'wcMid');   // wet rock at the tideline
  s += `</g>`;

  /* ── the monasteries: one large, built out over the drop, and one small
        higher up. Scale is the argument — they must look tiny on the rock. ── */
  const ledge = (hx, hy, hs) =>
    `<path d="M${n2(hx - 34 * hs)},${n2(hy)} q${n2(88 * hs)},${n2(-12 * hs)} ${n2(176 * hs)},${n2(2 * hs)} ` +
    `l${n2(-30 * hs)},${n2(58 * hs)} q${n2(-58 * hs)},${n2(14 * hs)} ${n2(-116 * hs)},${n2(2 * hs)} Z" ` +
    `fill="${C.cliffShade}" opacity="0.5" filter="url(#wcFine)"/>`;
  s += ledge(1136, 336, 1.06) + monastery(r, 1136, 336, 1.06);
  s += ledge(1520, 232, 0.6) + monastery(r, 1520, 232, 0.6);

  /* scrub in the cracks — the only green a cliff allows */
  for (let i = 0; i < 20; i++) {
    s += bloom(1000 + r() * 800, 220 + r() * 380, 18 + r() * 40, 7 + r() * 13,
               r() > 0.5 ? C.olive : C.scrub, 0.16 + r() * 0.2);
  }
  s += cypress(r, 1290, 430, 74, 0.7);
  s += cypress(r, 1660, 320, 62, 0.6);

  /* surf, worrying at the foot of the rock */
  s += `<path d="M960,${648} q90,${14} 190,${4} q160,${-10} 330,${8} q180,${12} 360,${-4}" ` +
       `fill="none" stroke="${C.foam}" stroke-width="13" opacity="0.85" filter="url(#wcFine)"/>`;
  s += bloom(1120, 656, 150, 22, C.foam, 0.6);

  s += grain(W, H, 0.1);
  return s + '</svg>';
}

/* ── emit ────────────────────────────────────────────────────────────────── */
const out = __dirname;
const files = [['greece-hero.svg', hero()], ['athos-cliff.svg', athos()]];
for (const [name, svg] of files) {
  const p = path.join(out, name);
  fs.writeFileSync(p, svg);
  console.log(`${name.padEnd(20)} ${(Buffer.byteLength(svg) / 1024).toFixed(1)} kB`);
}
