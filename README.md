# When Toad Called for Rain

An interactive typographic folktale built with [Pretext](https://github.com/chenglou/pretext). Tiny four-stroke rain marks fall behind the prose and bias themselves toward measured word spaces, preserving the text’s composition while keeping the rain alive. Its paper-and-ink field responds to two full-page story movements and is inspired by Seiichi Niikuni’s concrete poem *Rain* (1966).

## Experience

- Read the supplied 1,511-word folktale as two dense animated editorial folios.
- Drag any dark raindrop and watch the surrounding text recompose.
- Tap a raindrop to pause it, or hold/release all motion with the global control.
- Use the arrow keys or movement controls to move through the story.
- Open “Read the whole story” for a calm, linear reading edition.
- `prefers-reduced-motion` automatically holds all autonomous movement.

The source story ends with `children’s rhymes:`. This edition preserves that ending exactly and anchors `雨` at the bottom of the visual composition; it does not invent a missing rhyme.

## Local development

```bash
npm install
npm run dev
```

Build and verify:

```bash
npm test
```

The unit suite enforces at least 80% line, branch, and function coverage for the pure geometry and story modules. The production build is a static `dist/` folder with relative asset paths and `.nojekyll`, ready for GitHub Pages.

## Technical notes

The visual engine is adapted from the interaction model of [The Editorial Engine](https://somnai-dreams.github.io/pretext-demos/the-editorial-engine.html): Pretext prepares and measures the story once, then `layoutNextLine` streams it through responsive columns and around narrow glyph-sized rectangles. The animation loop performs explicit DOM writes only; it never calls `getBoundingClientRect`, `offsetWidth`, or `offsetHeight`.

The animated layer is hidden from assistive technology. The same canonical story data powers a semantic article in the linear reading edition.

## Credits and rights

- Pretext is Copyright © 2026 Pretext contributors and is used under the MIT License. See [`LICENSES/PRETEXT.txt`](LICENSES/PRETEXT.txt).
- Visual inspiration: Seiichi Niikuni, *Rain* (1966). The original raster reference is not redistributed by this repository.
- The folktale text was supplied for this adaptation. It is excluded from the repository’s code license.
- `public/og.png` is an original AI-generated social card created specifically for this site with OpenAI image generation; it is not part of Niikuni’s source artwork.
- Original site code is released under the MIT License in [`LICENSE`](LICENSE).
