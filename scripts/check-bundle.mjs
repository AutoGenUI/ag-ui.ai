import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const assetsDirectory = path.resolve(import.meta.dirname, "../dist/client/assets");
const entries = await readdir(assetsDirectory, { withFileTypes: true });
const files = entries.filter((entry) => entry.isFile() && /\.(js|css)$/.test(entry.name));
const sizes = await Promise.all(files.map(async (entry) => ({ name: entry.name, bytes: (await stat(path.join(assetsDirectory, entry.name))).size })));
const javascriptBytes = sizes.filter((entry) => entry.name.endsWith(".js")).reduce((sum, entry) => sum + entry.bytes, 0);
const cssBytes = sizes.filter((entry) => entry.name.endsWith(".css")).reduce((sum, entry) => sum + entry.bytes, 0);
const javascriptGzipBytes = sizes.filter((entry) => entry.name.endsWith(".js")).reduce((sum, entry) => sum + gzipSync(readFileSync(path.join(assetsDirectory, entry.name))).length, 0);
const cssGzipBytes = sizes.filter((entry) => entry.name.endsWith(".css")).reduce((sum, entry) => sum + gzipSync(readFileSync(path.join(assetsDirectory, entry.name))).length, 0);
// Total assets across the retained academy, atlas and new newsroom.
// The newsroom stylesheet adds ~3 KB gzip; keep the JavaScript budget unchanged.
const budgets = { javascriptBytes: 920_000, javascriptGzipBytes: 275_000, cssBytes: 125_000, cssGzipBytes: 24_000 };

console.log(`Client JavaScript: ${javascriptBytes} bytes / ${budgets.javascriptBytes} byte budget`);
console.log(`Client JavaScript gzip: ${javascriptGzipBytes} bytes / ${budgets.javascriptGzipBytes} byte budget`);
console.log(`Client CSS: ${cssBytes} bytes / ${budgets.cssBytes} byte budget`);
console.log(`Client CSS gzip: ${cssGzipBytes} bytes / ${budgets.cssGzipBytes} byte budget`);

if (javascriptBytes > budgets.javascriptBytes || javascriptGzipBytes > budgets.javascriptGzipBytes || cssBytes > budgets.cssBytes || cssGzipBytes > budgets.cssGzipBytes) {
  process.exitCode = 1;
}
