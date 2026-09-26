import { FT, BASE, RUBBER_FRONT, DUGOUTS } from '../layout.js';

// Where things are on the field for the replay, and how the ball moves. Field frame (layout.js):
// home plate at the origin, -z toward center field, +x toward first base. Metres, seconds.

export const G = 9.81;
const r2 = Math.SQRT1_2;
export const BASES = [
	[ 0, 0 ], // home
	[ BASE * r2, - BASE * r2 ], // first
	[ 0, - BASE * Math.SQRT2 ], // second
	[ - BASE * r2, - BASE * r2 ], // third
];
export const MOUND = [ 0, - RUBBER_FRONT - 0.15 ];

// a point at an angle from the center field line (degrees, negative = left field) and a distance (ft)
export const polar = ( deg, ft ) => {

	const a = deg * Math.PI / 180, d = ft * FT;
	return [ Math.sin( a ) * d, - Math.cos( a ) * d ];

};

// fielders' positions with nobody on (angle, feet from home)
export const POSITIONS = {
	P: MOUND,
	C: [ 0, 1.15 ],
	'1B': polar( 39, 112 ),
	'2B': polar( 15, 148 ),
	SS: polar( - 13, 146 ),
	'3B': polar( - 38, 108 ),
	LF: polar( - 27, 285 ),
	CF: polar( 1, 318 ),
	RF: polar( 27, 290 ),
};

// the dugouts' fronts (the home team in the first base dugout) and the bullpens
const mid = ( [ a, b ] ) => [ ( a[ 0 ] + b[ 0 ] ) / 2, ( a[ 1 ] + b[ 1 ] ) / 2 ];
export const DUGOUT = { home: mid( DUGOUTS.first ), away: mid( DUGOUTS.third ) };
export const BULLPEN = { home: polar( 6, 425 ), away: polar( 6, 450 ) };
export const ON_DECK = { home: [ 11, 3.5 ], away: [ - 11, 3.5 ] };

// the batter's box: a right-handed batter stands on the third base side
export const boxFor = ( bats ) => bats === 'L' ? [ 0.95, - 0.2 ] : [ - 0.95, - 0.2 ];

// Spray chart coordinates (MLB Gameday, 250 x 250, home plate at 125.42, 198.27, about 2.5 ft a unit)
// -> field frame metres.
export function sprayToField( cx, cy ) {

	const x = ( cx - 125.42 ) * 2.495 * FT, y = ( 198.27 - cy ) * 2.495 * FT;
	return [ x, - y ];

}

export const dist = ( a, b ) => Math.hypot( b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ] );
export const lerp2 = ( a, b, t ) => [ a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * t, a[ 1 ] + ( b[ 1 ] - a[ 1 ] ) * t ];
export const yawTo = ( from, to ) => Math.atan2( - ( to[ 0 ] - from[ 0 ] ), - ( to[ 1 ] - from[ 1 ] ) );

// ---------------------------------------------------------------- pitches (PITCHf/x)

// The pitch's path: PITCHf/x fits x, y, z (ft, catcher's view: +x to the catcher's right, y from the
// back of home plate toward the pitcher, z up) as quadratics in time from y = 50 ft. We start it back
// at the release (y = 55 ft) and follow it to the catcher.
export function pitchPath( pfx ) {

	const [ x0, y0, z0, vx, vy, vz, ax, ay, az ] = pfx;
	const tAt = ( y ) => {

		// y0 + vy t + ay t^2 / 2 = y (vy < 0: the root that is the pitch's)
		const a = ay / 2, b = vy, c = y0 - y;
		if ( Math.abs( a ) < 1e-6 ) return - c / b;
		const d = Math.sqrt( Math.max( 0, b * b - 4 * a * c ) );
		return ( - b - d ) / ( 2 * a );

	};

	const t0 = tAt( 55 ), tPlate = tAt( 17 / 12 ), tEnd = tAt( - 2.2 );
	const at = ( t, out = [ 0, 0, 0 ] ) => {

		const x = x0 + vx * t + ax * t * t / 2, y = y0 + vy * t + ay * t * t / 2, z = z0 + vz * t + az * t * t / 2;
		out[ 0 ] = x * FT; out[ 1 ] = z * FT; out[ 2 ] = - y * FT;
		return out;

	};

	// times relative to the release
	return { flight: tPlate - t0, toCatcher: tEnd - t0, at: ( t, out ) => at( t + t0, out ) };

}

// a made-up pitch for the few without PITCHf/x: a straight fastball to the middle
export function fallbackPfx( speed = 88, px = 0, pz = 2.5 ) {

	const v = speed * 1.467;
	return [ px * 0.3, 50, 6.0, 0, - v, - 5, 0, 30, - 20 + ( pz - 2.5 ) * 4 ];

}

// ---------------------------------------------------------------- batted balls

// A batted ball from the plate to `to` (field frame) by trajectory type and hardness. Returns
// { time, at( t ) -> [ x, y, z ], ground: bool } where time is when it reaches `to` (caught or fielded
// there; grounders roll along the ground).
export function battedBall( traj, hard, from, to, seed = 0 ) {

	const d = dist( from, to );
	const k = hard === 'hard' ? 1.15 : hard === 'soft' ? 0.8 : 1;
	const catchY = 1.3;
	if ( traj === 'ground_ball' || traj === 'bunt_grounder' ) {

		// a hop off the plate then rolling (slowing) to the fielder
		const v0 = ( traj === 'bunt_grounder' ? 9 : 31 ) * k;
		const decel = traj === 'bunt_grounder' ? 3 : 5;
		const vEnd = Math.max( v0 * 0.35, Math.sqrt( Math.max( 0, v0 * v0 - 2 * decel * d ) ) );
		const time = 2 * d / ( v0 + vEnd );
		return {
			time, ground: true,
			at: ( t ) => {

				const tt = Math.min( t, time );
				const s = Math.min( d, v0 * tt - ( v0 - vEnd ) / time * tt * tt / 2 );
				const [ x, z ] = lerp2( from, to, s / d );
				// a couple of hops: the first high, then smaller
				const hop = Math.abs( Math.sin( Math.min( s / 9, 3 ) * Math.PI ) ) * Math.max( 0, 1.4 - s / 12 ) * ( traj === 'bunt_grounder' ? 0.4 : 1 );
				return [ x, 0.04 + hop, z ];

			},
		};

	}

	// in the air: an apex by type, a parabola (the drag's asymmetry ignored)
	let apex;
	if ( traj === 'popup' ) apex = 28 + 8 * Math.abs( Math.sin( seed ) );
	else if ( traj === 'line_drive' ) apex = 2.5 + d * 0.035;
	else apex = Math.min( 38, 10 + d * 0.2 ) * ( 0.85 + 0.3 * Math.abs( Math.sin( seed * 3.1 ) ) );
	const y0 = 0.9;
	const vy = Math.sqrt( 2 * G * ( apex - y0 ) );
	const tUp = vy / G, tDown = Math.sqrt( 2 * Math.max( 0.1, apex - catchY ) / G );
	const time = tUp + tDown;
	return {
		time, ground: false,
		at: ( t ) => {

			const [ x, z ] = lerp2( from, to, Math.min( t, time ) / time );
			return [ x, Math.max( 0.04, y0 + vy * t - G * t * t / 2 ), z ];

		},
	};

}

// a throw from a to b (field frame [ x, z ]) at ~30 m/s, released 1.8 m up, caught 1.3 m up
export function throwPath( a, b, speed = 30 ) {

	const d = dist( a, b );
	const time = Math.max( 0.25, d / speed );
	const y0 = 1.8, y1 = 1.3;
	// a flat arc: rise so it takes `time`
	const vy = ( y1 - y0 + G * time * time / 2 ) / time;
	return { time, at: ( t ) => {

		const tt = Math.min( t, time );
		const [ x, z ] = lerp2( a, b, tt / time );
		return [ x, y0 + vy * tt - G * tt * tt / 2, z ];

	} };

}

// the base a runner is going to next (1 -> 2 ...), and points along the base paths from base a to b
export function basePath( a, b, t ) {

	// a, b: 0 home .. 4 home again; t 0..1 along the whole run, base to base
	const n = b - a;
	if ( n <= 0 ) return BASES[ a % 4 ].slice();
	const s = t * n;
	const i = Math.min( n - 1, Math.floor( s ) );
	return lerp2( BASES[ ( a + i ) % 4 ], BASES[ ( a + i + 1 ) % 4 ], s - i );

}
