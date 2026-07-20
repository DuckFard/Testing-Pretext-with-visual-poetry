import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import { CHAPTERS } from "../src/story.js";

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

const escapeHtml = (value) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const storyMarkup = CHAPTERS.map(
  (chapter) => `
          <section class="story-section">
            <h3>${escapeHtml(chapter.title.replaceAll("/", ""))}</h3>
            <div class="story-copy">
${chapter.paragraphs.map((paragraph) => `              <p>${escapeHtml(paragraph)}</p>`).join("\n")}
            </div>
          </section>`,
).join("");

const sourceHtml = await readFile(new URL("../index.html", import.meta.url), "utf8");
const builtHtml = sourceHtml
  .replace('href="./src/styles.css"', 'href="./assets/styles.css"')
  .replace('src="./src/main.js"', 'src="./assets/main.js"')
  .replace("<!--STORY_CONTENT-->", storyMarkup);

await writeFile(new URL("./index.html", outputDirectory), builtHtml, "utf8");
await cp(new URL("../src/styles.css", import.meta.url), new URL("./styles.css", assetsDirectory));
await cp(new URL("../public/.nojekyll", import.meta.url), new URL("./.nojekyll", outputDirectory));

const socialImage = new URL("../public/og.png", import.meta.url);
if (existsSync(socialImage)) {
  await cp(socialImage, new URL("./og.png", outputDirectory));
}

console.log("Built static GitHub Pages artifact in dist/");
