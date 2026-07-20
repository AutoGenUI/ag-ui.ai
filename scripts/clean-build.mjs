import { rm } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const outputDirectory = path.resolve(projectRoot, "dist");

if (path.dirname(outputDirectory) !== projectRoot || path.basename(outputDirectory) !== "dist") {
  throw new Error(`Refusing to clean unexpected build directory: ${outputDirectory}`);
}

await rm(outputDirectory, { recursive: true, force: true });
