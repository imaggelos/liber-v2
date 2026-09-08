/*
 * Vendors epub.js, pdf.js, and JSZip (an epub.js dependency) from node_modules
 * into www/lib/, so the app works fully offline with no CDN dependency.
 * Run automatically via `npm run prepare-libs` (also runs before `npx cap sync`
 * in CI — see .github/workflows/android-build.yml).
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const libDir = path.join(root, "www", "lib");

fs.mkdirSync(libDir, { recursive: true });

const copies = [
  {
    from: "node_modules/epubjs/dist/epub.min.js",
    to: "epub.min.js",
  },
  {
    from: "node_modules/jszip/dist/jszip.min.js",
    to: "jszip.min.js",
  },
  {
    from: "node_modules/pdfjs-dist/build/pdf.min.mjs",
    to: "pdf.min.js",
    fallbackFrom: "node_modules/pdfjs-dist/build/pdf.min.js",
  },
  {
    from: "node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
    to: "pdf.worker.min.js",
    fallbackFrom: "node_modules/pdfjs-dist/build/pdf.worker.min.js",
  },
];

let missing = [];

for (const c of copies) {
  const primary = path.join(root, c.from);
  const fallback = c.fallbackFrom ? path.join(root, c.fallbackFrom) : null;
  const src = fs.existsSync(primary) ? primary : fallback && fs.existsSync(fallback) ? fallback : null;

  if (!src) {
    missing.push(c.from);
    continue;
  }
  fs.copyFileSync(src, path.join(libDir, c.to));
  console.log("Vendored " + c.to);
}

if (missing.length) {
  console.error("\nMissing packages — run `npm install` first:\n" + missing.join("\n"));
  process.exit(1);
}

console.log("\nAll libraries vendored into www/lib/. Liber is ready to run offline.");
