/**
 * Every icon a PWA needs, from one source image.
 *
 *   node scripts/build-icons.mjs assets/logo-source.png
 *
 * The source lives in assets/ rather than client/public/ because public/ is
 * served: a half-megabyte original nobody needs would be downloadable, and it
 * is only here so the icons can be rebuilt.
 *
 * There is no image library installed and there does not need to be: Chromium
 * is already here for the screenshot checks, and a browser is a very good
 * rasteriser. The source is drawn into a square canvas at each size and
 * photographed.
 *
 * Two decisions are baked in on purpose.
 *
 * The background is white, never transparent. This logo is black line art;
 * on a dark Android launcher a transparent icon would be black lines on a
 * black ground, which is an invisible icon.
 *
 * Maskable icons get a wide margin. Android crops them to whatever shape the
 * launcher likes — circle, squircle, teardrop — and only the middle 80% is
 * guaranteed to survive. A hat drawn to the edges would come back with its
 * brim cut off.
 */

import { readFileSync, writeFileSync, mkdirSync, globSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

// Playwright arrives as a transitive dependency, so pnpm never links it at the
// top level and a plain import fails. Looking it up where pnpm actually put it
// keeps this script working without adding a dependency whose only job is to
// resize nine images.
const require = createRequire(import.meta.url);

function loadChromium() {
  try {
    return require("playwright").chromium;
  } catch {
    const [dir] = globSync("node_modules/.pnpm/playwright@*/node_modules/playwright");
    if (!dir) {
      console.error("Playwright is not installed. Run: pnpm add -D playwright");
      process.exit(1);
    }
    return require(path.resolve(dir)).chromium;
  }
}

const OUT_DIR = path.resolve("client/public/icons");

/** `contain` fraction: how much of the square the artwork is allowed to fill. */
const PLAIN_FILL = 0.86;
const MASKABLE_FILL = 0.62;

const TARGETS = [
  { file: "favicon-16.png", size: 16, fill: PLAIN_FILL },
  { file: "favicon-32.png", size: 32, fill: PLAIN_FILL },
  { file: "favicon-48.png", size: 48, fill: PLAIN_FILL },
  { file: "apple-touch-icon.png", size: 180, fill: 0.78 },
  { file: "icon-192.png", size: 192, fill: PLAIN_FILL },
  { file: "icon-512.png", size: 512, fill: PLAIN_FILL },
  { file: "icon-maskable-192.png", size: 192, fill: MASKABLE_FILL },
  { file: "icon-maskable-512.png", size: 512, fill: MASKABLE_FILL },
  { file: "icon-1024.png", size: 1024, fill: PLAIN_FILL },
];

/** What goes inside favicon.ico, smallest first as the format expects. */
const ICO_ENTRIES = [
  { size: 16, file: "favicon-16.png" },
  { size: 32, file: "favicon-32.png" },
  { size: 48, file: "favicon-48.png" },
];

/**
 * Draws one icon and hands back a PNG data URL.
 *
 * The trim is the part that matters. A logo file is almost never cropped to
 * its artwork — this one is a drawing floating in a wide white field, sitting
 * left of centre. Placed as-is it would become a small hat hiding in a corner
 * at every size. So the ink is measured first and only that box is drawn,
 * centred, at the fill fraction.
 *
 * "Ink" is anything meaningfully darker than the paper. The threshold is
 * deliberately not "not pure white": scans and exports carry faint smudges,
 * and one stray pixel at 250 grey would stretch the box across the page.
 */
function render(dataUri, size, fill) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error("could not decode the source image"));
    img.onload = () => {
      const source = document.createElement("canvas");
      source.width = img.naturalWidth;
      source.height = img.naturalHeight;
      const sctx = source.getContext("2d", { willReadFrequently: true });
      sctx.drawImage(img, 0, 0);

      const { data } = sctx.getImageData(0, 0, source.width, source.height);
      let minX = source.width, minY = source.height, maxX = -1, maxY = -1;
      for (let y = 0; y < source.height; y++) {
        for (let x = 0; x < source.width; x++) {
          const i = (y * source.width + x) * 4;
          const alpha = data[i + 3];
          if (alpha < 16) continue;
          const luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          if (luminance > 200) continue;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
      // A blank source: draw it whole rather than dividing by zero.
      if (maxX < 0) { minX = 0; minY = 0; maxX = source.width - 1; maxY = source.height - 1; }

      const boxW = maxX - minX + 1;
      const boxH = maxY - minY + 1;
      const scale = (size * fill) / Math.max(boxW, boxH);
      const drawW = boxW * scale;
      const drawH = boxH * scale;

      const out = document.createElement("canvas");
      out.width = size;
      out.height = size;
      const octx = out.getContext("2d");
      octx.fillStyle = "#ffffff";
      octx.fillRect(0, 0, size, size);
      octx.imageSmoothingEnabled = true;
      octx.imageSmoothingQuality = "high";
      octx.drawImage(source, minX, minY, boxW, boxH, (size - drawW) / 2, (size - drawH) / 2, drawW, drawH);

      // Flatten to grey and snap the extremes.
      //
      // The source is black line art, but every "white" pixel in it is a
      // slightly different white and every black a slightly different black —
      // scanner noise, or an export that went through a lossy step. PNG
      // compresses runs of identical pixels, so that invisible noise was
      // costing more than the drawing: a 1024 icon came out at 651 kB. Pinning
      // the paper to pure white and the ink to pure black, while leaving the
      // midtones alone so the edges stay smooth, changes nothing anyone can
      // see and shrinks the file by an order of magnitude.
      const out2 = octx.getImageData(0, 0, size, size);
      const px = out2.data;
      for (let i = 0; i < px.length; i += 4) {
        let grey = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        if (grey >= 236) grey = 255;
        else if (grey <= 40) grey = 0;
        else grey = Math.round(grey);
        px[i] = px[i + 1] = px[i + 2] = grey;
        px[i + 3] = 255;
      }
      octx.putImageData(out2, 0, 0);

      resolve({ dataUrl: out.toDataURL("image/png"), box: [boxW, boxH] });
    };
    img.src = dataUri;
  });
}

/**
 * A .ico wrapping PNGs.
 *
 * The format allows a PNG payload per entry rather than a raw bitmap, which is
 * what every browser since IE11 reads, and it means no encoder is needed here:
 * the PNGs are already made, this only writes the directory in front of them.
 */
function buildIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = icon
  header.writeUInt16LE(pngs.length, 4);

  let offset = 6 + pngs.length * 16;
  const entries = [];
  for (const { size, data } of pngs) {
    const entry = Buffer.alloc(16);
    // 256 is written as 0: the field is one byte and 256 does not fit.
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2); // palette colours
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += data.length;
  }

  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

const source = process.argv[2];
if (!source) {
  console.error("usage: node scripts/build-icons.mjs <source image>");
  process.exit(1);
}

const ext = path.extname(source).slice(1).toLowerCase();
const mime = ext === "svg" ? "image/svg+xml" : ext === "jpg" ? "image/jpeg" : `image/${ext}`;
const dataUri = `data:${mime};base64,${readFileSync(source).toString("base64")}`;

mkdirSync(OUT_DIR, { recursive: true });

const chromium = loadChromium();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const context = await browser.newContext({ deviceScaleFactor: 1 });
const made = new Map();

const tab = await context.newPage();
await tab.setContent("<!doctype html><meta charset='utf-8'><title>icons</title>", { waitUntil: "load" });

for (const { file, size, fill } of TARGETS) {
  const { dataUrl, box } = await tab.evaluate(
    ([uri, s, f, fn]) => new Function(`return (${fn})`)()(uri, s, f),
    [dataUri, size, fill, render.toString()]
  );
  const buffer = Buffer.from(dataUrl.split(",")[1], "base64");
  writeFileSync(path.join(OUT_DIR, file), buffer);
  made.set(file, buffer);
  console.log(`${file.padEnd(26)} ${size}×${size}  ${(buffer.length / 1024).toFixed(1)} kB  (ink ${box[0]}×${box[1]})`);
}
await tab.close();

writeFileSync(
  path.join(OUT_DIR, "favicon.ico"),
  buildIco(ICO_ENTRIES.map(({ size, file }) => ({ size, data: made.get(file) })))
);
console.log(`${"favicon.ico".padEnd(26)} ${ICO_ENTRIES.map((e) => e.size).join("/")}`);

await browser.close();
