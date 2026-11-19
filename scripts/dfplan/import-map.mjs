import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../../", import.meta.url);
const index = new URL("dfplan/index.html", root);
const read = async (name) => (await readFile(new URL(name, root), "utf8")).replaceAll("\r\n", "\n");
const { files } = JSON.parse(await read("scripts/pages/public-files.json"));
const assets = files.filter((name) => /^dfplan\/.*\.(?:m?js|css)$/.test(name)).sort();
const modules = new Set(assets.filter((name) => /\.m?js$/.test(name)));
const hash = createHash("sha256");

for (const name of assets) {
  const source = await read(name);
  hash.update(JSON.stringify([name, source]));
  if (!modules.has(name)) continue;

  const runtimeSource = source.replace(/\/\*\*[\s\S]*?\*\//g, "");
  const references = runtimeSource.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)["'](\.{1,2}\/[^"']+)["']/g);
  for (const [, specifier] of references) {
    if (specifier.includes("?") || specifier.includes("#"))
      throw new Error(name + " contains a versioned or fragmented import: " + specifier);
    const target = new URL(specifier, "https://example.invalid/" + name).pathname.slice(1);
    if (!modules.has(target)) throw new Error(name + " imports a file outside the Pages allowlist: " + target);
  }
}

const version = hash.digest("hex").slice(0, 16);
const imports = Object.fromEntries([...modules].map((name) => {
  const specifier = "./" + name.slice("dfplan/".length);
  return [specifier, specifier + "?v=" + version];
}));
const registry = [
  '<script type="importmap">',
  ...JSON.stringify({ imports }, null, 2).split("\n"),
  "</script>",
].join("\n");

const original = await read("dfplan/index.html");
if (!original.includes('<script type="importmap">') || !original.includes('import "./src/app.mjs";'))
  throw new Error("DFplan requires an import map with a mapped module entry point");
const next = original
  .replace(/<script type="importmap">[\s\S]*?<\/script>/, () => registry)
  .replace(/(href="\.\/[^"]+\.css)(?:\?v=[^"]+)?/g, "$1?v=" + version);

if (process.argv.includes("--write")) {
  await writeFile(index, next, "utf8");
} else if (original !== next) {
  throw new Error("DFplan asset fingerprint is stale. Run node scripts/dfplan/import-map.mjs --write");
}
