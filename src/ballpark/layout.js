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
export const FIELD_BEARING = 10.19; // MLB's venue record says 9.0; the streets run at ~9.4

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
// Outfield: [ angle, distance, height, 'mark' ] from the foul pole in left to the one in right. Angle in
// degrees from the center field line (negative = left field), distance from the back tip of home plate
// in feet, wall height in feet; 'mark' where the distance is painted on the wall (then optionally how
// far along the wall to move the number, metres, negative = back toward the previous point). Two rows at
// the same point make a step in the wall's height.
//
// Sources: the Phillies' "Facts, Figures and Fun Features" and MLB's 2024 ground rules. The left field
// wall is straight and square to the foul line 333 ft out (329 at the pole, 334 painted beside it, 374,
// 387; 10'6" high since the 2006 move). Monty's Angle: a jog in to 381, then a taller wall (12'8" rising
// to 19') parallel to the left field wall out to the 409 corner. The center field fence is 6 ft, from 409
// past 401 to the 398 corner, with the bullpens behind it. The right field wall is square to its foul
// line 330 ft out (369 in the alley), 13'3" high, the out-of-town scoreboard built into it.
export const OUTFIELD = [
	[ - 45, 329, 10.5 ], // left field foul pole
	[ - 42, 333.5, 10.5, 'mark', 1.9 ], // 334 (painted just along the straight wall from this corner)
	[ - 17.92, 374, 10.5, 'mark' ], // left field power alley
	[ - 14.37, 387, 10.5, 'mark', - 1.8 ], // end of the left field wall
	[ - 14.37, 387, 12.67 ], // Monty's Angle
	[ - 10.27, 381, 12.67 ],
	[ - 4.96, 409, 19, 'mark', - 1.8 ], // the deepest point
	[ - 4.96, 409, 6 ], // center field fence
	[ 0, 401, 6, 'mark' ],
	[ 11, 398, 6, 'mark', - 1.8 ], // the right-center corner
	[ 11, 398, 13.25 ], // right field wall
	[ 18.42, 369, 13.25, 'mark' ], // right field power alley
	[ 45, 330, 13.25, 'mark', - 2.2 ], // right field foul pole
];

// Foul territory: the front of the stands from beyond the right field foul pole round behind home plate
// to beyond the left field one, [ x, z ] in metres in the field frame. From the Phillies' figures: the
// backstop is flat, 49'5" behind home plate; the stands are 51 ft from first and third base and stay
// about that far off the lines to 150 ft out, angle in to ~28 ft off at 215 ft, and run ~10 ft off the
// lines out to the poles.
export const FOUL_WALL_HEIGHT = 4.5;
export const BACKSTOP = 49.4 * FT;
export const FOUL_TERRITORY = [
	[ 73.06, - 69.18 ], // beside the right field foul pole
	[ 52.8, - 48.49 ], // 235 ft out, 10 ft off the line
	[ 52.37, - 40.3 ], // 215 ft out, 28 ft off
	[ 43.54, - 21.12 ], // 150 ft out, 52 ft off
	[ 32.54, - 10.56 ], // first base dugout, far end (100 ft out, 51 ft off)
	[ 14.22, 7.76 ], // first base dugout, home plate end
	[ 6.93, 15.06 ], // the backstop
	[ - 6.93, 15.06 ],
	[ - 14.22, 7.76 ], // third base dugout, home plate end
	[ - 32.54, - 10.56 ], // third base dugout, far end
	[ - 43.54, - 21.12 ],
	[ - 52.37, - 40.3 ],
	[ - 52.8, - 48.49 ],
	[ - 73.06, - 69.18 ], // beside the left field foul pole
];

// The dugouts: the stretch of the foul territory wall each takes up ([ x, z ] of its two ends; both are
// FOUL_TERRITORY points). The Phillies use the first base dugout, the visitors the third base one.
export const DUGOUTS = {
	third: [ [ - 14.22, 7.76 ], [ - 32.54, - 10.56 ] ],
	first: [ [ 14.22, 7.76 ], [ 32.54, - 10.56 ] ],
};

// The bullpens: behind the center field fence between 401 and the 398 corner, on two levels (the
// Phillies' at field level, the visitors' above and behind it, against Ashburn Alley).
export const BULLPENS = { depth: 9, upperRise: 2.6 };

// Levels above the field (the Phillies' figures): the field is 23 ft below the street.
export const LEVELS = {
	mainConcourse: 23 * FT, // street level
	suites: 36 * FT,
	clubConcourse: 61 * FT,
	terraceConcourse: 81 * FT,
	roof: 134 * FT,
	lightTowers: 165 * FT,
};

// fence points in the field frame, metres
export function fencePoint( angleDeg, distFt ) {

	const a = angleDeg * Math.PI / 180, d = distFt * FT;
	return [ Math.sin( a ) * d, - Math.cos( a ) * d ];

}

// the whole boundary of the playing field: the outfield fence from the left field pole to the right
// field pole, then the foul territory back round behind home plate to the left field pole
export function fieldBoundary() {

	const pts = OUTFIELD.map( ( [ a, d ] ) => fencePoint( a, d ) ).concat( FOUL_TERRITORY );
	// the steps in the fence's height repeat a point: drop the repeats
	return pts.filter( ( p, i ) => i === 0 || Math.hypot( p[ 0 ] - pts[ i - 1 ][ 0 ], p[ 1 ] - pts[ i - 1 ][ 1 ] ) > 0.01 );

}
