import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const assetsDirectory = path.resolve(import.meta.dirname, "../dist/client/assets");
const entries = await readdir(assetsDirectory, { withFileTypes: true });
const files = entries.filter((entry) => entry.isFile() && /\.(js|css)$/.test(entry.name));
const sizes = await Promise.all(files.map(async (entry) => ({ name: entry.name, bytes: (await stat(path.join(assetsDirectory, entry.name))).size })));
const javascriptBytes = sizes.filter((entry) => entry.name.endsWith(".js")).reduce((sum, entry) => sum + entry.bytes, 0);
const cssBytes = sizes.filter((entry) => entry.name.endsWith(".css")).reduce((sum, entry) => sum + entry.bytes, 0);
const budgets = { javascriptBytes: 350_000, cssBytes: 40_000 };

console.log(`Client JavaScript: ${javascriptBytes} bytes / ${budgets.javascriptBytes} byte budget`);
console.log(`Client CSS: ${cssBytes} bytes / ${budgets.cssBytes} byte budget`);

if (javascriptBytes > budgets.javascriptBytes || cssBytes > budgets.cssBytes) {
  process.exitCode = 1;
}
