# Citizens Bank Park

A walkable Citizens Bank Park in the browser: start at the third base gate and head on in. An unofficial
fan project, not affiliated with the Philadelphia Phillies, Major League Baseball or Citizens Bank.

Built on [Tidewater](https://github.com/dgreenheck/tidewater) by Dan Greenheck: its WebGPU / WGSL
engine, physically based sky and clouds, sun shadows, haze and post-processing. The ocean, island and
fishing game are not used; the original README is in [docs/TIDEWATER-README.md](docs/TIDEWATER-README.md).

## Status

1. **Empty world** (done): Tidewater's sky and lighting over flat ground, first-person walking with
   stairs, a free camera. A small test block (stairs, platform, pillars) stands in for the stadium.
2. The field: grass, dirt, bases, mound, foul lines, warning track, outfield walls at the real distances.
3. The seating bowl: three decks, concourses, stairs and ramps.
4. Outside: the facade, the plaza and the third base gate; the scoreboard, the Liberty Bell, Ashburn Alley.
5. Hosting on GitHub Pages.

## Requirements

A browser with WebGPU (a recent Chrome or Edge; Safari 26+). The first load compiles the shaders;
later visits are much faster.

## Controls

| Key | Action |
|---|---|
| W A S D | Walk |
| Mouse | Look (click to capture the mouse, Esc to release) |
| Shift | Hurry |
| Space | Jump |
| F | Free camera (F again drops you down to walk from there) |
| T | Let the day run / pause it |
| L | Flashlight |
| H | Settings panel |
| P | Photo mode |
| F1 or ? | All controls |

URL options: `?fly` starts in the free camera, `?noClouds`, `?noHaze`, `?scale=0.75` (internal resolution).

## Running locally

```sh
npm install
npm run dev      # http://127.0.0.1:5189
npm run build    # static build in dist/
```

## Layout

The ballpark code is in `src/ballpark/`: `BallparkApp.js` builds and runs the systems, `Ground.js` is the
world, `Walker.js` the first-person controller, `BallparkUI.js` the settings panel, `DryWater.js` tells
the post chain there is no sea. Everything else in `src/` is Tidewater's engine and systems.

## License

MIT, like Tidewater (see [LICENSE](LICENSE)); third-party assets are listed in [CREDITS.md](CREDITS.md).
