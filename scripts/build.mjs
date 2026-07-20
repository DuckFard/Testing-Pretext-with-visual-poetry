import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";

const outputDirectory = new URL("../dist/", import.meta.url);
const assetsDirectory = new URL("./assets/", outputDirectory);

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(assetsDirectory, { recursive: true });

const bundle = await rolldown({ input: fileURLToPath(new URL("../src/main.js", import.meta.url)) });
await bundle.write({
  dir: fileURLToPath(assetsDirectory),
  entryFileNames: "main.js",
  format: "es",
  minify: true,
  sourcemap: true,
});
await bundle.close();

const sourceHtml = await readFile(new URL("../index.html", import.meta.url), "utf8");
const builtHtml = sourceHtml
  .replace('href="./src/styles.css"', 'href="./assets/styles.css"')
  .replace('src="./src/main.js"', 'src="./assets/main.js"');

await writeFile(new URL("./index.html", outputDirectory), builtHtml, "utf8");
await cp(new URL("../src/styles.css", import.meta.url), new URL("./styles.css", assetsDirectory));
await cp(new URL("../public/.nojekyll", import.meta.url), new URL("./.nojekyll", outputDirectory));

const socialImage = new URL("../public/og.png", import.meta.url);
if (existsSync(socialImage)) {
  await cp(socialImage, new URL("./og.png", outputDirectory));
}

console.log("Built static GitHub Pages artifact in dist/");
