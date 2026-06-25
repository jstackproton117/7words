import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(here, "..", "public");
mkdirSync(publicDir, { recursive: true });

const BG = "#1c1917"; // stone-900
const FG = "#fafaf9"; // stone-50

// librsvg (sharp's SVG backend) doesn't fully honor dominant-baseline, so we
// position the text baseline explicitly: cap-height of a bold sans is ~0.7em,
// so baseline = 256 (center) + 0.35 * fontSize.

// Tight: 7 fills most of the canvas. Used for regular (square-cropped) icon
// and the apple-touch-icon, which iOS rounds for us.
const tightSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${BG}"/>
  <text x="256" y="375" text-anchor="middle"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
        font-weight="800" font-size="340" fill="${FG}">7</text>
</svg>`;

// Maskable: leaves the inner 60% safe zone for the glyph so Android can crop
// to any platform-defined mask without clipping.
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${BG}"/>
  <text x="256" y="333" text-anchor="middle"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
        font-weight="800" font-size="220" fill="${FG}">7</text>
</svg>`;

writeFileSync(resolve(publicDir, "icon.svg"), tightSvg, "utf8");
writeFileSync(resolve(publicDir, "icon-maskable.svg"), maskableSvg, "utf8");

const tasks = [
  { svg: tightSvg, size: 192, name: "icon-192.png" },
  { svg: tightSvg, size: 512, name: "icon-512.png" },
  { svg: tightSvg, size: 180, name: "apple-touch-icon.png" },
  { svg: maskableSvg, size: 512, name: "icon-maskable-512.png" },
];

for (const t of tasks) {
  const out = resolve(publicDir, t.name);
  await sharp(Buffer.from(t.svg))
    .resize(t.size, t.size)
    .png()
    .toFile(out);
  console.log(`wrote ${t.name}`);
}

console.log("Icons generated.");
