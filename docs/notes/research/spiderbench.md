# spiderbench: what we can learn from it (2026-09-27)

The owner asked whether xikhar's Spider-Man clone ("blender and image gen", https://x.com/xikhar/status/2104001664793600012, https://github.com/xikhar/spiderbench) has a stack or flow we can use. A research agent went through the repo, the shipped assets and the video frames; nothing was run on the GPU. **For review with the owner.**

## What it is

- **Code:** three.js r186 on WebGL2, about 50k lines written by Claude (Opus 5.5) agents in 10 critic-driven rounds, with deterministic shots matched to reference images. That's close to how we work.
- **World:** a procedural Manhattan-like island, 6.8 × 1.45 km, with far shores out to 150 km.
- **Rendering:**
  - 5 shadow cascades reaching 3 km, N8AO, SSR and screen-space GI (both half resolution), sun shafts;
  - TAA, depth of field, motion blur, bloom, auto exposure;
  - interior-mapped windows;
  - no lightmaps.
- **Blender 5.2, scripted:**
  - the hero (53k triangles, 58 bones, 79 clips);
  - 13 vehicles in 3 levels of detail, with ambient occlusion baked in Cycles into vertex colour;
  - props;
  - 24 pedestrian outfits in 3 levels of detail (about 5.3k / 1.15k / 215 triangles), with animations baked into a texture;
  - everything exported as glTF with WebP textures.
- **Image generation** (Codex's `$imagegen`, i.e. gpt-image-2):
  - 128 invented ads;
  - 32 photoreal faces for the pedestrians;
  - grime and leak decals, and material sheets (asphalt repair, stucco, roofing, stone);
  - interior-room atlases.
- **Size:** 139 MB of assets. Ours is about 15 MB, nearly all audio.
- **Licence: view-only.** We can take ideas, not code or assets.

The "expansive, realistic" look comes from the scale, the haze, and above all the photographic surface textures with weathering on everything. Up close the props are boxy and the signs simple.

## Recommendation

**Adopt now**
1. **Photographic material textures in his recipe, sourced CC0 first** (Poly Haven, ambientCG scans).
   - The recipe: a texture array of colour, normal/roughness and height/AO/weathering; parallax up close; a per-section tint; large-scale weathering; a grime decal sheet.
   - It's the biggest gap between his look and ours: our brick, concrete and steel are shader patterns.
   - The engine already has texture arrays and image decoding; the ballpark needs a small `imageTexture()` helper (about 2–3 hours).
   - It belongs to round 2's photoreal-surfaces world.
2. **Shots matched to reference photos, with critic rounds:** a desk shot from the same camera as each 2008 reference photo in `.claude/ref/`, judged side by side.

**Try as experiments**
3. **AI image generation, only where no CC0 or real source fits:**
   - grime and rain-stain decals;
   - the kitchens and suites behind glass;
   - food and program artwork;
   - a face atlas for invented fans.

   Never for real 2008 signage, logos or players: it invents details, and trademark and likeness rules apply. It needs an OpenAI or Google API key (the owner's decision) and costs about $5–20 per 100 images.
4. **Blender, headless and scripted, under the GPU lock** (baking with Cycles on the CPU):
   - Best fit: fan bodies with real clothing (coats, ponchos, hoodies), in 3 levels of detail with baked normal and AO. That fixes "seated fans look boxy" and "beards read as a dark mask".
   - Needs Blender installed (the owner's decision), a static-glTF adapter (0.5–1 day) and WebP support in `GLTF.js` (trivial).
   - It wouldn't start until the crowd's shaders are settled.
5. **Baked AO for the static bowl and concourse:** better done in our own pipeline than through Blender, since our geometry is built at runtime.

**Skip**
- image-to-3D (the licences, a large CUDA GPU, and generic results);
- lightmaps (our light changes through the night and the rain);
- KTX2, Draco and meshopt, until textures pass ~50–100 MB;
- anything from his repo.

## First experiment: "one wall, three ways"

- **The surface:** the Third Base Gate plaza's brick, where you start.
- **Three variants:**
  - A: today's procedural brick;
  - B: a CC0 scan in his recipe;
  - C: a gpt-image-2 sheet matched to a 2008 photo. C needs an API key, or about 6 images made by hand in ChatGPT.
- **The shots:** at 2 m, 10 m and 40 m, each on a dry day and a rainy night, from one desk job on the full park.
- **Success criteria:**
  - B or C beats A against the 2008 photos at 2 m and 10 m, with no visible tiling at 40 m;
  - at most +0.3 ms of GPU, +0.2 s of load, +2 MB of download and +24 MB of VRAM;
  - wet and night behaviour intact.

The agent's clone, texture previews and video frames are in the session scratchpad (not kept).
