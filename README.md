# Citizens Bank Park

A walkable Citizens Bank Park in the browser: start at the third base gate and head on in. An unofficial
fan project, not affiliated with the Philadelphia Phillies, Major League Baseball or Citizens Bank.

Built on [Tidewater](https://github.com/dgreenheck/tidewater) by Dan Greenheck: its WebGPU / WGSL
engine, physically based sky and clouds, sun shadows, haze and post-processing. The ocean, island and
fishing game are not used; the original README is in [docs/TIDEWATER-README.md](docs/TIDEWATER-README.md).

## Stages

Each finished step is tagged (`step-1`, `step-2`, ...) and playable as it was: `npm run stages` builds them
all with a page listing them (see below).

1. **Empty world**: Tidewater's sky and lighting over flat ground, first-person walking, a free camera.
2. **The field**: the playing field to the official dimensions, measured and oriented from aerial imagery.
3. **The seating bowl**: the field 23 ft below the street, field level seats, the main concourse, suites,
   the Hall of Fame Club, the Terrace deck under its roof, the Pavilion, netting, elevators.
4. **Outside and the landmarks**: the brick facade and the gates, the Third Base Gate plaza (where you
   start) with the Mike Schmidt statue and the Veterans Stadium Liberty Bell, the streets, the Linc and
   the arena, Center City's skyline, the scoreboard, the Liberty Bell sign, Ashburn Alley, the batter's
   eye, and night games under the light towers.
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
| E | Use (the elevators) |
| F | Free camera (F again drops you down to walk from there) |
| T | Let the day run / pause it |
| L | Flashlight |
| H | Settings panel |
| P | Photo mode |
| F1 or ? | All controls |

URL options: `?fly` starts in the free camera, `?noClouds`, `?noHaze`, `?scale=0.75` (internal resolution).

## Stages page

```sh
npm run stages           # build every tagged step into stages/
npm run stages:preview   # http://127.0.0.1:5190
```

## Running locally

```sh
npm install
npm run dev      # http://127.0.0.1:5189
npm run build    # static build in dist/
```

## Layout

The ballpark code is in `src/ballpark/`: `BallparkApp.js` builds and runs the systems; `layout.js` holds
the measurements (with their sources); `Field.js` the playing field, `Stands.js` + `Bowl.js` the seating
bowl, `Exterior.js` the facade, gates and plaza, `Landmarks.js` the scoreboard, Liberty Bell, Ashburn Alley
and batter's eye, `Surroundings.js` the streets, neighbouring venues and skyline (`data/surroundings.js`,
from OpenStreetMap); `Walker.js` the first-person controller, `BallparkUI.js` the settings panel,
`DryWater.js` tells the post chain there is no sea. Everything else in `src/` is Tidewater's engine.

## License

MIT, like Tidewater (see [LICENSE](LICENSE)); third-party assets are listed in [CREDITS.md](CREDITS.md).
