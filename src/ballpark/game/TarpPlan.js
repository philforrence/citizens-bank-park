import { FOUL_TERRITORY, MOUND_CENTER, MOUND_RADIUS, MOUND_HEIGHT } from '../layout.js';

// The infield tarp through the suspension, as a pure function of the time into it (so scrubbing, any
// camera and any frame order agree). The crew (Suspension.js, on the players' rig), the roll's mesh
// (places/rituals/Roll.js) and the sheet (Details2008.setTarp) all read this one plan.
//
// ---- FR2 (gauntlet r3): how it went on the 27th, as photographed in order. The tarp is folded in three
// along its length and wound on a black corrugated tube about 15 m long, stowed under its canvas cover on
// the track along the third base side's wall toward the left field pole (W4's tube; heston 2987303394).
//   1. The crew run out along the track, pull the cover off and push the roll off the wall, across the
//      foul ground and onto the grass by the left field line (the world feed's 2:52:30 sheet, frames 6-8;
//      Getty 88457361), its axis square to the line all the way (it only ever rolls).
//   2. Bent over it shoulder to shoulder, twenty of them push it on, square to the line, along the outfield
//      edge of the infield's clay behind third, short and second, the folded strip laying out behind it
//      (2:52:30 frame 9; 2:54:00 frames 1-3; Getty 83458679 and 83477151: the roll behind second, the
//      grey strip between it and the clay and running back toward third). The roll thins to the bare core,
//      which lies on the grass behind second where it ran out (83458149, 83458151).
//   3. They spread out along the strip's infield edge (puffygreenjacket 2983592600: eight of them along
//      it, the black underside showing where they hold it up), take it by its strap handles and pull it
//      in toward home and first, walking with the handles behind them: the folds open from the top and
//      the sheet slides in over the infield after them, billowing, the edge running straight from by the
//      third base line to behind the first-second clay (83458151, 83458149, 83458153, 2:54:00 frames 5-6);
//      the last of it drags the whole sheet in square. The core stays where it lay.
// On the 29th the same backwards in the empty afternoon: the edge walked back and folded, the roll wound
// back over the strip to the third base line and swung back to the wall.
//
// The sheet (Details2008): a 44 m square turned with the diamond round (0, -26): corners behind home
// plate (0, 5.1), past third (-31.1, -26), past second (0, -57.1) and past first (31.1, -26). Its u runs
// from the left field edge (u = 0: past second to past third) to the first base edge (u = 1: behind home to
// past first); v from past second (v = 0) to behind home / past third (v = 1). The folded strip lies just
// outside the left field edge, u from -1/3 to 0 (on the grass beyond the clay, where the photos have it).

export const SHEET = { c: [ 0, - 26 ], S: 44 };
const r2 = Math.SQRT1_2;
// the roll's radius: the whole tarp on it, and the bare core (83458149: about knee high)
export const R_FULL = 0.55, R_CORE = 0.3;
// folded in three: the strip (and the roll) a third of the sheet wide; where the strip lies (in u)
export const FOLDS = 3, STRIP = SHEET.S / FOLDS, U0 = - 1 / FOLDS;
// the stowed tube's length (W4's, places/rail/Tarp.js); the roll is its infield end
const TUBE = 40;

// a point on the sheet
export function sheetPoint( u, v ) {

	const S = SHEET.S, lx = ( u - 0.5 ) * S, lz = ( v - 0.5 ) * S;
	return [ SHEET.c[ 0 ] + ( lx - lz ) * r2, SHEET.c[ 1 ] + ( lx + lz ) * r2 ];

}

// the direction the edge is pulled (increasing u): toward home and first
export const PULL_DIR = [ r2, r2 ];
// the way the roll goes laying the strip (decreasing v): from past third toward past second
export const LAY_DIR = [ r2, - r2 ];
// the roll's axis (its v) as it lays the strip: from just short of the v = 1 edge to just past v = 0
const V_START = 1 + ( R_FULL + 0.1 ) / SHEET.S, V_END = - ( R_CORE + 0.15 ) / SHEET.S;

export function moundY( x, z ) {

	const r = Math.hypot( x, z + MOUND_CENTER ) / MOUND_RADIUS;
	if ( r >= 1 ) return 0;
	const t = Math.min( 1, Math.max( 0, ( r - 0.3 ) / 0.7 ) );
	return MOUND_HEIGHT * ( 1 - t * t * ( 3 - 2 * t ) );

}

const ease = ( x ) => {

	const t = Math.min( 1, Math.max( 0, x ) );
	return t * t * ( 3 - 2 * t );

};
// eased in and out, but mostly steady (the crew's pace)
const steady = ( x ) => {

	const t = Math.min( 1, Math.max( 0, x ) ), a = 0.12;
	if ( t < a ) return t * t / ( 2 * a * ( 1 - a ) );
	if ( t > 1 - a ) return 1 - ( 1 - t ) * ( 1 - t ) / ( 2 * a * ( 1 - a ) );
	return ( t - a / 2 ) / ( 1 - a );

};

// The stowed tube's axis, as W4 laid it (places/rail/Tarp.js tubePath: along the wall from past the
// third base side's 150 ft point round the corners toward the pole, 0.72 m off it, 40 m), sampled.
let _tube = null;
export function tubeAxis() {

	if ( _tube ) return _tube;
	const F = FOUL_TERRITORY, GAP = 0.72, LENGTH = TUBE;
	const pts = [ F[ 10 ], F[ 11 ], F[ 12 ], F[ 13 ] ];
	const nrm = ( a, b ) => {

		const l = Math.hypot( b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ] );
		let n = [ - ( b[ 1 ] - a[ 1 ] ) / l, ( b[ 0 ] - a[ 0 ] ) / l ];
		const mx = ( a[ 0 ] + b[ 0 ] ) / 2, mz = ( a[ 1 ] + b[ 1 ] ) / 2;
		if ( n[ 0 ] * ( 0 - mx ) + n[ 1 ] * ( - 38.9 - mz ) < 0 ) n = [ - n[ 0 ], - n[ 1 ] ];
		return n;

	};
	const off = pts.map( ( p, i ) => {

		const n0 = i > 0 ? nrm( pts[ i - 1 ], p ) : null, n1 = i < pts.length - 1 ? nrm( p, pts[ i + 1 ] ) : null;
		let n = n0 && n1 ? [ n0[ 0 ] + n1[ 0 ], n0[ 1 ] + n1[ 1 ] ] : ( n0 || n1 );
		const l = Math.hypot( ...n );
		n = [ n[ 0 ] / l, n[ 1 ] / l ];
		const k = n0 && n1 ? GAP / Math.max( 0.5, n[ 0 ] * n1[ 0 ] + n[ 1 ] * n1[ 1 ] ) : GAP;
		return [ p[ 0 ] + n[ 0 ] * k, p[ 1 ] + n[ 1 ] * k ];

	} );
	const dense = [];
	for ( let i = 0; i < off.length - 1; i ++ ) {

		const a = off[ i ], b = off[ i + 1 ], l = Math.hypot( b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ] );
		for ( let s = 0; s < l; s += 0.2 ) dense.push( [ a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * s / l, a[ 1 ] + ( b[ 1 ] - a[ 1 ] ) * s / l ] );

	}

	let P = dense;
	for ( let it = 0; it < 6; it ++ ) P = P.map( ( p, i ) => i === 0 || i === P.length - 1 ? p : [ ( P[ i - 1 ][ 0 ] + 2 * p[ 0 ] + P[ i + 1 ][ 0 ] ) / 4, ( P[ i - 1 ][ 1 ] + 2 * p[ 1 ] + P[ i + 1 ][ 1 ] ) / 4 ] );
	// from 0.8 m past the first point, LENGTH metres of it, with the arc length
	const out = [];
	let acc = 0;
	for ( let i = 0; i < P.length; i ++ ) {

		if ( i ) acc += Math.hypot( P[ i ][ 0 ] - P[ i - 1 ][ 0 ], P[ i ][ 1 ] - P[ i - 1 ][ 1 ] );
		if ( acc < 0.8 ) continue;
		if ( acc > 0.8 + LENGTH ) break;
		out.push( { p: P[ i ], s: acc - 0.8 } );

	}

	return _tube = out;

}

// a point at a fraction f (0..1) along the stowed tube
function tubeAt( f ) {

	const T = tubeAxis(), s = f * T[ T.length - 1 ].s;
	let i = T.findIndex( ( q ) => q.s >= s );
	if ( i < 1 ) i = 1;
	const a = T[ i - 1 ], b = T[ i ], k = ( s - a.s ) / Math.max( 1e-6, b.s - a.s );
	return [ a.p[ 0 ] + ( b.p[ 0 ] - a.p[ 0 ] ) * k, a.p[ 1 ] + ( b.p[ 1 ] - a.p[ 1 ] ) * k ];

}

// The roll at s (0 its outfield end, 1 its infield end, 0.5 the middle): where it lies on the wall, and
// where it stands at the strip's start (its axis square to the third base line, just short of the v = 1
// edge). Pushed straight off the wall the one comes to the other: it rolls about 10 m, turning a little.
const stowedAt = ( s ) => tubeAt( ( 1 - s ) * STRIP / TUBE );
const startAt = ( s ) => sheetPoint( U0 * ( 1 - s ), V_START );

// The times (s into the suspension's break; the 29th's from its start, the split)
export const T27 = { out: 1.5, lift: [ 7, 11.5 ], lay: [ 11.5, 26 ], spread: [ 26, 34 ], pull: [ 34, 51 ] };
// (the 29th: it came off in the afternoon, before the gates opened at 5:30: the park still empty; all of
// it before God Bless America, Suspension's G29.gba at 26 s)
export const T29 = { unpull: [ 0.5, 9 ], wind: [ 11.5, 21.5 ], stow: [ 21.5, 25 ] };

// The tarp's state:
//   phase: 'stowed' | 'lift' (off the wall to the strip's start) | 'lay' (the strip laid out behind it) |
//     'spread' (the strip down, the crew going along it to the edge) | 'pull' (the edge pulled across) | 'on';
//   lift (0..1 from the wall to the strip's start), laid (0..1 of the strip laid), vRoll (the roll's v);
//   pull (0..1: where the sheet's free edge is, in u: 0 the strip's infield edge, 1 the first base line's),
//     u (the same: the crew's line), anchor (where the sheet's left field edge is, in u: U0 in the strip,
//     0 once it's been dragged square);
//   r (the roll's radius), bare (the black core showing), core (it's the empty core);
//   edgeY (how high they hold the edge), billow (the sheet moving: air under it);
//   speed (m/s the men move, for their gait), dir (+1 the 27th, -1 the 29th), stowed (W4's tube is it).
// `N`: director.night( t ) (its lt, dur and split).
export function tarpState( N ) {

	const st = { phase: 'stowed', lift: 0, laid: 0, vRoll: V_START, pull: 0, u: 0, anchor: U0, r: R_FULL, bare: 0, core: false, edgeY: 0.05, billow: 0, speed: 0, dir: 1, stowed: true };
	if ( ! N || ! N.susp ) return st;
	const lt = N.lt, s27 = N.split - N.t0;
	const radius = ( k ) => Math.sqrt( R_CORE * R_CORE + ( 1 - k ) * ( R_FULL * R_FULL - R_CORE * R_CORE ) );
	// the strip laid to k (0..1): the roll's place and size
	const lay = ( k ) => {

		st.vRoll = V_START + ( V_END - V_START ) * k;
		st.laid = Math.min( 1, Math.max( 0, 1 - st.vRoll ) );
		st.r = radius( st.laid );
		st.bare = ease( ( st.laid - 0.93 ) / 0.07 );
		st.core = st.laid >= 1;

	};
	// the edge pulled to k (0..1): the folds open first (the left field edge where the strip lay), then the
	// whole sheet's dragged in square
	const pull = ( k ) => {

		st.pull = st.u = k;
		st.anchor = k < 2 / 3 ? U0 : U0 + ( k - 2 / 3 );

	};
	if ( lt < s27 ) {

		const T = T27;
		if ( lt < T.lift[ 0 ] ) return st;
		st.stowed = false;
		if ( lt < T.lift[ 1 ] ) {

			st.phase = 'lift';
			st.lift = ease( ( lt - T.lift[ 0 ] ) / ( T.lift[ 1 ] - T.lift[ 0 ] ) );
			st.speed = 2.4;
			return st;

		}

		st.lift = 1;
		if ( lt < T.lay[ 1 ] ) {

			st.phase = 'lay';
			lay( steady( ( lt - T.lay[ 0 ] ) / ( T.lay[ 1 ] - T.lay[ 0 ] ) ) );
			st.speed = SHEET.S / ( T.lay[ 1 ] - T.lay[ 0 ] );
			return st;

		}

		lay( 1 );
		if ( lt < T.pull[ 0 ] ) {

			// the edge lifted in their hands as the last of them get there
			st.phase = 'spread';
			st.edgeY = 0.05 + 0.7 * ease( ( lt - T.pull[ 0 ] + 1.4 ) / 1.2 );
			return st;

		}

		const kp = steady( ( lt - T.pull[ 0 ] ) / ( T.pull[ 1 ] - T.pull[ 0 ] ) );
		pull( kp );
		st.phase = kp < 1 ? 'pull' : 'on';
		st.speed = kp > 0 && kp < 1 ? SHEET.S / ( T.pull[ 1 ] - T.pull[ 0 ] ) : 0;
		// the edge held up in their hands while they walk it across, then laid down
		st.edgeY = kp < 1 ? 0.75 : 0.05;
		st.billow = kp < 1 ? Math.min( 1, kp * 8 ) * Math.min( 1, ( 1 - kp ) * 6 ) : 0;
		return st;

	}

	// the 29th
	const T = T29, l2 = lt - s27;
	st.stowed = false;
	st.lift = 1;
	st.dir = - 1;
	if ( l2 < T.unpull[ 0 ] ) {

		lay( 1 );
		pull( 1 );
		st.phase = 'on';
		return st;

	}

	if ( l2 < T.unpull[ 1 ] ) {

		lay( 1 );
		const kp = 1 - steady( ( l2 - T.unpull[ 0 ] ) / ( T.unpull[ 1 ] - T.unpull[ 0 ] ) );
		pull( kp );
		st.phase = 'pull';
		st.edgeY = 0.75;
		st.billow = Math.min( 1, kp * 8 ) * Math.min( 1, ( 1 - kp ) * 6 ) * 0.6;
		st.speed = SHEET.S / ( T.unpull[ 1 ] - T.unpull[ 0 ] );
		return st;

	}

	if ( l2 < T.wind[ 0 ] ) {

		lay( 1 );
		st.phase = 'spread';
		return st;

	}

	if ( l2 < T.wind[ 1 ] ) {

		lay( 1 - steady( ( l2 - T.wind[ 0 ] ) / ( T.wind[ 1 ] - T.wind[ 0 ] ) ) );
		st.phase = 'lay';
		st.speed = SHEET.S / ( T.wind[ 1 ] - T.wind[ 0 ] );
		return st;

	}

	if ( l2 < T.stow[ 1 ] ) {

		lay( 0 );
		st.phase = 'lift';
		st.lift = 1 - ease( ( l2 - T.stow[ 0 ] ) / ( T.stow[ 1 ] - T.stow[ 0 ] ) );
		st.speed = 2.4;
		return st;

	}

	st.stowed = true;
	st.lift = 0;
	st.phase = 'stowed';
	return st;

}

// The roll's axis as n + 1 points (x, y, z: its centre line, y the radius above the ground or the mound)
// from its outfield end (s = 0, at u = -1/3 on the strip) to its infield end (s = 1, u = 0): pushed off the
// wall to the strip's start, then along the strip. out: an array to fill (reused)
export function rollAxis( st, n = 40, out = [] ) {

	for ( let i = 0; i <= n; i ++ ) {

		const s = i / n;
		let x, z;
		if ( st.phase === 'lift' || st.phase === 'stowed' ) {

			const w = stowedAt( s ), e = startAt( s ), k = st.lift;
			x = w[ 0 ] + ( e[ 0 ] - w[ 0 ] ) * k;
			z = w[ 1 ] + ( e[ 1 ] - w[ 1 ] ) * k;

		} else [ x, z ] = sheetPoint( U0 * ( 1 - s ), st.vRoll );

		const q = out[ i ] || ( out[ i ] = [ 0, 0, 0 ] );
		q[ 0 ] = x; q[ 1 ] = moundY( x, z ) + st.r; q[ 2 ] = z;

	}

	out.length = n + 1;
	return out;

}

// how far the roll has rolled (its turning is this over its radius): off the wall, then along the strip
export function rollDistance( st ) {

	const swing = Math.hypot( startAt( 0.5 )[ 0 ] - stowedAt( 0.5 )[ 0 ], startAt( 0.5 )[ 1 ] - stowedAt( 0.5 )[ 1 ] );
	if ( st.phase === 'lift' || st.phase === 'stowed' ) return st.lift * swing;
	return swing + ( V_START - st.vRoll ) * SHEET.S;

}

// The roll's frame at s (0..1 along it): its axis point, radius, the way it's being pushed (unit, field
// frame: off the wall, or along the strip; backwards on the 29th), and how far it's come there (for the
// pushers' stride)
export function rollFrame( st, axis, s ) {

	const n = axis.length - 1, x = s * n, i = Math.min( n - 1, Math.floor( x ) ), k = x - i;
	const a = axis[ i ], b = axis[ i + 1 ];
	const p = [ a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * k, a[ 2 ] + ( b[ 2 ] - a[ 2 ] ) * k ];
	const w = stowedAt( s ), e = startAt( s ), swing = Math.hypot( e[ 0 ] - w[ 0 ], e[ 1 ] - w[ 1 ] ) || 1;
	let dir;
	if ( st.phase === 'lift' || st.phase === 'stowed' ) {

		// (off the wall, turning as it comes round square to the line: the way along the clay by the end)
		const k = ease( st.lift * 1.25 - 0.25 );
		dir = [ ( e[ 0 ] - w[ 0 ] ) / swing * ( 1 - k ) + LAY_DIR[ 0 ] * k, ( e[ 1 ] - w[ 1 ] ) / swing * ( 1 - k ) + LAY_DIR[ 1 ] * k ];
		const l = Math.hypot( dir[ 0 ], dir[ 1 ] ) || 1;
		dir = [ dir[ 0 ] / l, dir[ 1 ] / l ];

	} else dir = [ LAY_DIR[ 0 ], LAY_DIR[ 1 ] ];
	if ( st.dir < 0 ) dir = [ - dir[ 0 ], - dir[ 1 ] ];
	const travelled = st.phase === 'lift' || st.phase === 'stowed' ? swing * st.lift : swing + ( V_START - st.vRoll ) * SHEET.S;
	return { p, dir, r: st.r, travelled };

}

// Where a camera wants to look: the roll while it's moving, the edge's middle while it's pulled
export function tarpFocus( st ) {

	if ( st.stowed ) return null;
	if ( st.phase === 'lift' || st.phase === 'lay' ) {

		const A = rollAxis( st, 2 );
		return [ A[ 1 ][ 0 ], 0.9, A[ 1 ][ 2 ] ];

	}

	const p = sheetPoint( st.u, 0.5 );
	return [ p[ 0 ], 0.8, p[ 1 ] ];

}

// a point on the stowed tube, for the crew waiting by it (f 0..1 from its infield end)
export { tubeAt };
