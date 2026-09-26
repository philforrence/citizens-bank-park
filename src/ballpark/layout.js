// Where everything is. Two frames:
//
//   world  (as Tidewater's sky): +x east, +y up, -z north. Metres. Home plate at the origin.
//   field  the ballpark's own frame: origin at the back tip of home plate, -z toward center field
//          (through second base), +x toward the first base side. The whole ballpark is built in this
//          frame and turned into the world by FIELD_BEARING.
//
// Sources: home plate, the bases and the bearing measured on aerial imagery (the bases land within
// 2 % of 90 ft apart); the stadium footprint and the rough field outline from OpenStreetMap
// (© OpenStreetMap contributors, ODbL: ways 255489463 and 92483441); fence distances and heights from
// the Phillies / MLB (see FENCE below).

export const FT = 0.3048;

// home plate (the back tip), WGS84
export const HOME_LATLON = [ 39.9055925, - 75.1666197 ];

// compass bearing from home plate to center field, degrees east of north. South Philadelphia's
// street grid is turned the same way, so the stadium is square to the streets.
export const FIELD_BEARING = 10.19;

export const BASE = 90 * FT; // between the bases
export const MOUND_CENTER = 59 * FT; // from the back tip of home plate
export const RUBBER_FRONT = 60.5 * FT;
export const MOUND_RADIUS = 9 * FT;
export const MOUND_HEIGHT = 10 / 12 * FT;

// The stadium's outer footprint in the field frame [ x, z ] (OpenStreetMap way 255489463)
export const FOOTPRINT = [
	[ - 125.82, 7.98 ], [ - 126.34, - 36.71 ], [ - 128.37, - 36.35 ], [ - 129.25, - 100.38 ], [ - 126.59, - 100.43 ],
	[ - 117.81, - 100.58 ], [ - 114.93, - 100.62 ], [ - 115.08, - 110.89 ], [ - 112.65, - 113.49 ], [ - 117.81, - 118.81 ],
	[ - 119.25, - 120.3 ], [ - 88.47, - 150.29 ], [ - 85.33, - 146.68 ], [ - 73.73, - 146.6 ], [ - 70.17, - 147.82 ],
	[ - 70.27, - 150.54 ], [ - 13.62, - 151.32 ], [ - 2.39, - 151.47 ], [ 32.45, - 151.95 ], [ 63.2, - 152.37 ],
	[ 63.25, - 151.25 ], [ 63.38, - 147.52 ], [ 70.08, - 147.77 ], [ 70.15, - 143.13 ], [ 67.8, - 143.05 ],
	[ 67.7, - 138.23 ], [ 67.54, - 114.96 ], [ 77.28, - 106.41 ], [ 86.08, - 115.18 ], [ 93.1, - 115.0 ],
	[ 93.52, - 152.78 ], [ 131.14, - 153.3 ], [ 131.33, - 94.32 ], [ 135.85, - 94.66 ], [ 137.48, - 22.57 ],
	[ 137.64, - 15.19 ], [ 137.69, - 13.27 ], [ 126.45, - 12.69 ], [ 127.3, 47.08 ], [ 113.42, 47.65 ],
	[ 113.4, 39.51 ], [ 84.69, 14.0 ], [ 62.31, 36.96 ], [ 51.29, 48.28 ], [ 59.73, 56.34 ],
	[ 59.78, 57.46 ], [ 60.01, 61.74 ], [ 61.09, 82.69 ], [ 51.64, 82.48 ], [ 51.94, 89.09 ],
	[ 52.06, 91.51 ], [ - 49.5, 91.55 ], [ - 50.02, 87.33 ], [ - 51.73, 87.37 ], [ - 71.64, 87.87 ],
	[ - 71.86, 62.51 ], [ - 61.04, 62.24 ], [ - 66.02, 57.38 ], [ - 59.89, 51.24 ], [ - 64.03, 46.95 ],
	[ - 70.79, 53.68 ], [ - 72.07, 52.43 ], [ - 75.17, 49.44 ], [ - 69.22, 43.57 ], [ - 92.68, 20.48 ],
	[ - 98.62, 26.33 ], [ - 103.51, 21.94 ], [ - 97.57, 16.08 ], [ - 102.9, 10.56 ], [ - 108.46, 15.88 ],
	[ - 113.12, 11.45 ], [ - 125.78, 11.78 ],
];

// ---------------------------------------------------------------- the fence around the playing field
//
// Outfield: [ angle, distance, height ] from the foul pole in left to the one in right. Angle in degrees
// from the center field line (negative = left field), distance from the back tip of home plate in feet,
// wall height in feet; 'mark' where the distance is painted on the fence.
export const OUTFIELD = [
	[ - 45, 329, 11, 'mark' ], // left field foul pole
	[ - 36, 334, 11 ],
	[ - 26, 348, 11 ],
	[ - 17, 364, 11 ],
	[ - 12, 374, 11, 'mark' ], // left-center
	[ - 8, 381, 11 ],
	[ - 5, 395, 11 ], // the notch
	[ - 1, 401, 6, 'mark' ], // center field
	[ 4, 398, 6 ],
	[ 10, 386, 6 ],
	[ 14, 374, 6 ],
	[ 19, 369, 6, 'mark' ], // right-center
	[ 26, 350, 13 ],
	[ 35, 336, 13 ],
	[ 45, 330, 13, 'mark' ], // right field foul pole
];

// Foul territory: the front of the stands from the right field foul pole round behind home plate to the
// left field foul pole, [ x, z ] in metres in the field frame, and the height of its wall in feet.
export const FOUL_WALL_HEIGHT = 4.5;
export const FOUL_TERRITORY = [
	[ 74.2, - 66.5 ], // behind the right field foul pole
	[ 55.1, - 46.9 ],
	[ 54.9, - 38.8 ],
	[ 46.6, - 17.9 ],
	[ 34.7, - 7.6 ], // first base dugout, far end
	[ 16.4, 11.6 ], // first base dugout, home plate end
	[ 12.0, 15.0 ],
	[ 7.5, 17.4 ], // the backstop, 57 ft behind home plate
	[ - 7.5, 17.4 ],
	[ - 12.0, 15.0 ],
	[ - 14.2, 11.7 ], // third base dugout, home plate end
	[ - 34.7, - 7.5 ], // third base dugout, far end
	[ - 42.3, - 17.0 ],
	[ - 50.6, - 37.4 ],
	[ - 50.4, - 44.6 ],
	[ - 68.5, - 62.6 ], // behind the left field foul pole
];

// the dugouts: the stretch of the foul territory wall each takes up ([ x, z ] of its two ends, metres;
// both are FOUL_TERRITORY points). Measured on the aerial imagery: about 92 ft long, 63 ft off the lines.
export const DUGOUTS = {
	third: [ [ - 14.2, 11.7 ], [ - 34.7, - 7.5 ] ],
	first: [ [ 16.4, 11.6 ], [ 34.7, - 7.6 ] ],
};

// fence points in the field frame, metres
export function fencePoint( angleDeg, distFt ) {

	const a = angleDeg * Math.PI / 180, d = distFt * FT;
	return [ Math.sin( a ) * d, - Math.cos( a ) * d ];

}

// the whole boundary of the playing field: the outfield fence from the left field pole to the right
// field pole, then the foul territory back round behind home plate to the left field pole
export function fieldBoundary() {

	const pts = OUTFIELD.map( ( [ a, d ] ) => fencePoint( a, d ) );
	return pts.concat( FOUL_TERRITORY );

}
