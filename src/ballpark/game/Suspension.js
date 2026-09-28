import * as M from './Motions.js';
import * as R from './RitualMoves.js';
import { ROLE } from './Players.js';
import { POSITIONS, MOUND, DUGOUT, ON_DECK, polar, dist, lerp2, yawTo } from './Plays.js';
import { tarpState, rollAxis, sheetPoint, tubeAt, PULL_DIR, R_CORE, SHEET, T29, moundY } from './TarpPlan.js';

// The suspension, on the players' rig: the break after the top of the 6th, the 27th's part and then the
// 29th's (Director.night(): the split at 0.55). A pure function of the time into the break, like the rest
// of the replay. The Director calls showSuspension() for that segment in place of the usual half-inning
// change (which sent the Rays out to their positions in the rain delay and had players jogging on the
// tarp: H14).
//
// The 27th, 10:40 pm, the top of the 6th just over, tied 2-2, the rain coming down harder:
//   - the Phillies' fielders come in; the Rays stay in their dugout; nobody goes out;
//   - the plate umpire waves the grounds crew on, and the umpires walk off to their room;
//   - twenty of the crew, in their red hooded rain jackets and khakis (Getty 83458220, 83458149), run
//     out along the tube on the third base side, swing the roll out from the wall onto the left side of
//     the infield and push it across, bent over it shoulder to shoulder, the sheet paying out behind;
//   - they take the edges and walk it square, and three of them roll the bare black core on off the
//     sheet onto the grass (83458149);
//   - both bullpens walk in across the outfield in their jackets (83458226: the Phillies' relievers
//     crossing right field during the pull), round the tarp to their dugouts;
//   - the crew stand round the edges, hoods up; most go in, six stay out with it.
// The 29th, before 8:37 pm, cold and dry:
//   - the crew are out along the first base side; the core rolled back, the sheet wound back onto it
//     from the first base side, the roll swung back to the wall;
//   - then the work: rakes round the bags, the hose on the clay (Getty 83824985), the chalk liner down
//     the third base line, two of them dragging the mats round the arc, one tamping the mound;
//   - the Rays run out for the bottom of the 6th; Grant Balfour jogs in from the pen (W3 has him warming
//     there) for his warm-up tosses to Navarro; the umpires walk out; Geoff Jenkins, pinch-hitting for
//     Hamels, to the on-deck circle.

const N_CREW = 20;
// when the suspension is announced (s into the break): the park's cue to go home (Seats, the PA, the
// board). S's PA says "suspended" 55% of the way through the 27th's part (0.55 x 0.55 x 160 s)
export const ANNOUNCE = 48.4;
// The 29th's part (s from its start, 72 s): the tarp off in the empty afternoon park (TarpPlan's T29),
// the crew's work as the gates open and it fills, God Bless America at 8:26 pm (MLB.com, Oct 29: Petty
// Officer First Class Dorcus Whigham sang it before the first pitch in place of the anthem; "many in the
// crowd sang along"): everyone on the field still, caps off, facing the flag; then Balfour and Hickey
// out of the pen (8:30), the Rays out, the umpires, Jenkins on deck
export const G29 = { gba: [ 26, 36 ], balfour: 36, rays: 45, umps: 57, jenkins: 63 };
const FLAG_AT = [ 0, - 132 ];
// the roll's radius wound back up (for where the workers leave it)
const R_FULL_29 = 0.55;
const hash = ( n ) => {

	const s = Math.sin( n * 12.9898 ) * 43758.5453;
	return s - Math.floor( s );

};
const ease = R.ease;
// where the crew go in and out: gates in the foul walls at the 150 ft points, where the tube starts
// (invented: the record doesn't show their door)
export const GATE_3B = [ - 42.2, - 20.4 ], GATE_1B = [ 42.2, - 20.4 ];
// where the umpires go off: the gap by the backstop's third base end
const UMP_DOOR = [ - 8.6, 13.4 ];
// the crew's looks: the rig's KIND.crew (red jackets, khakis, the red P cap) with their own faces (three
// named in CAST.md, their faces in Looks.js: crew 1 is Frank Tomaselli, 57, at the far end of the roll
// and one of the six who stay out with it; crew 5 Ricky DeSantis, the intern, on a hose on the 29th; the
// liner, his own man, Lucho Figueroa)
const CREW = Array.from( { length: N_CREW }, ( _, i ) => ( { id: 'r:crew' + i, who: { side: 'crew', num: '', last: '' }, seed: hash( i * 3.1 + 0.7 ), v: 0.03 + 0.94 * i / ( N_CREW - 1 ) } ) );
// most with the hood up on the 27th (the head groundskeeper's way: the cap)
for ( const c of CREW ) c.hood = c.seed < 0.68;
// the relievers who walk in from the pens: the Phillies' (the lower pen) to the first base side, the
// Rays' (the upper one) to the third base side
const PEN_HOME = [ 400058, 425492, 240694, 239795, 113961, 424925, 457918 ];
const PEN_AWAY = [ 434442, 235095, 456034, 136268 ];
const BALFOUR = 346797;
// he sets off from the pen this far into the 29th's part (W3's Pens.js keeps him loose until then)
export const BALFOUR_OUT = 36;
// Jim Hickey, the Rays' pitching coach (real; a look from the rig's seeds)
const HICKEY = { id: 'r:hickey', who: { side: 'away', num: '', last: 'HICKEY' } };
const r2 = Math.SQRT1_2;
// the umpires' spots (as Director._umpires)
const UMP_AT = [
	[ - 1, [ 0.35, 2.05 ] ], [ - 2, [ 19.4 + 2.2 * r2 + 1.2 * r2, - 19.4 - 2.2 * r2 + 1.2 * r2 ] ], [ - 3, [ - 3.5, - 32.5 ] ],
	[ - 4, [ - 19.4 - 2.2 * r2 - 1.2 * r2, - 19.4 - 2.2 * r2 + 1.2 * r2 ] ], [ - 5, [ - 70 * r2 - 1.2, - 70 * r2 + 1.2 ] ], [ - 6, [ 70 * r2 + 1.2, - 70 * r2 + 1.2 ] ],
];

// a walk along a path of points at a speed from t0: where he is, which way, how far along (null before)
function along( pts, t0, speed, t ) {

	if ( t < t0 ) return null;
	let d = ( t - t0 ) * speed;
	for ( let i = 0; i < pts.length - 1; i ++ ) {

		const a = pts[ i ], b = pts[ i + 1 ], l = dist( a, b );
		if ( d <= l ) return { p: lerp2( a, b, d / Math.max( 1e-6, l ) ), yaw: yawTo( a, b ), moving: true, dist: ( t - t0 ) * speed };
		d -= l;

	}

	const a = pts[ pts.length - 2 ], b = pts[ pts.length - 1 ];
	return { p: b, yaw: yawTo( a, b ), moving: false, done: true, dist: ( t - t0 ) * speed };

}

// the same, but standing at the start until t0
const alongOr = ( pts, t0, speed, t ) => along( pts, t0, speed, t ) || { p: pts[ 0 ], yaw: yawTo( pts[ 0 ], pts[ 1 ] ), moving: false, done: false, dist: 0 };

const norm = ( a ) => {

	const l = Math.hypot( a[ 0 ], a[ 1 ] ) || 1;
	return [ a[ 0 ] / l, a[ 1 ] / l ];

};

// a point on the tube's field side, s metres along it from its infield end, t metres off its axis (where
// W4's crew stand waiting, places/rail/Crew.js)
function tubeSide( s, t ) {

	const f = s / 40, a = tubeAt( Math.max( 0, f - 0.01 ) ), b = tubeAt( Math.min( 1, f + 0.01 ) ), p = tubeAt( f );
	let n = norm( [ - ( b[ 1 ] - a[ 1 ] ), b[ 0 ] - a[ 0 ] ] );
	if ( n[ 0 ] * ( 0 - p[ 0 ] ) + n[ 1 ] * ( - 38.9 - p[ 1 ] ) < 0 ) n = [ - n[ 0 ], - n[ 1 ] ];
	return [ p[ 0 ] + n[ 0 ] * t, p[ 1 ] + n[ 1 ] * t ];

}
// W4's eight waiting along the tube (their s and how far off it), taken over by crew 19 .. 12
const WAIT = [ 1.5, 2.6, 4.4, 6.0, 7.7, 9.5, 11.2, 13.3 ].map( ( s, k ) => tubeSide( s, 1.45 + hash( k * 3 ) * 0.4 ) );

// The roll's frame at v: its axis point, radius, and the way it's going (unit, field frame)
function rollAt( st, axis, v ) {

	const n = axis.length - 1, x = v * n, i = Math.min( n - 1, Math.floor( x ) ), k = x - i;
	const a = axis[ i ], b = axis[ i + 1 ];
	const p = [ a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * k, a[ 2 ] + ( b[ 2 ] - a[ 2 ] ) * k ];
	let dir;
	if ( st.phase === 'lift' || st.phase === 'stowed' ) {

		const w = tubeAt( 1 - v ), e = sheetPoint( 0, v );
		dir = norm( [ e[ 0 ] - w[ 0 ], e[ 1 ] - w[ 1 ] ] );
		if ( st.dir < 0 ) dir = [ - dir[ 0 ], - dir[ 1 ] ];

	} else dir = [ PULL_DIR[ 0 ] * st.dir, PULL_DIR[ 1 ] * st.dir ];
	// how far the roll has come at this v (for the pushers' stride)
	const w = tubeAt( 1 - v ), e = sheetPoint( 0, v ), swing = dist( w, e );
	const travelled = st.phase === 'lift' || st.phase === 'stowed' ? swing * st.lift : swing + st.u * SHEET.S;
	return { p, dir, r: st.r, travelled };

}

// someone pushing the roll at v, behind it
function pusher( d, c, st, axis, role, t ) {

	const f = rollAt( st, axis, c.v );
	const back = f.r + 0.52;
	const x = f.p[ 0 ] - f.dir[ 0 ] * back, z = f.p[ 1 ] - f.dir[ 1 ] * back;
	const moving = st.speed > 0;
	const pose = R.pushRoll( moving ? f.travelled / 2.3 + c.seed : 0, f.r * 2, c.seed );
	if ( ! moving ) pose.pelvisY += 0.02 * Math.sin( t * 1.3 + c.seed * 9 );
	// (on the 27th they walk on the sheet laid behind the roll)
	const onSheet = st.dir > 0 && st.phase !== 'lift' ? 0.045 : 0;
	d.act( c.id, x, z, yawTo( [ x, z ], [ x + f.dir[ 0 ], z + f.dir[ 1 ] ] ), pose, { who: c.who, role, y: moundY( x, z ) + onSheet } );
	return [ x, z ];

}

// someone pulling the sheet's free edge across by its handle (Getty 83458149: walking with the strap
// behind him, leaning into it), just ahead of the edge; on the 29th walking it back to the roll, the
// folded edge carried in front of him. From his place behind the roll at the pull's start he steps
// round it to the edge in the first moments.
function puller( d, c, st, axis, role, t, t0 ) {

	const e = sheetPoint( st.u, c.v ), fwd = st.dir > 0;
	const off = fwd ? 0.9 : 0.6;
	let p = [ e[ 0 ] + PULL_DIR[ 0 ] * off, e[ 1 ] + PULL_DIR[ 1 ] * off ];
	const k = fwd ? ease( ( t - t0 ) / 1.6 ) : 1;
	if ( k < 1 ) {

		// from behind the roll (where the swing left him) round to the front
		const f = rollAt( { ...st, phase: 'lift', lift: 1, dir: 1 }, axis, c.v ), back = f.r + 0.52;
		const from = [ f.p[ 0 ] - f.dir[ 0 ] * back, f.p[ 1 ] - f.dir[ 1 ] * back ];
		p = [ from[ 0 ] + ( p[ 0 ] - from[ 0 ] ) * k, from[ 1 ] + ( p[ 1 ] - from[ 1 ] ) * k ];

	}

	const walked = st.pull * SHEET.S;
	const pose = st.speed > 0 ? ( fwd ? M.pullBehind( walked / 1.3 + c.seed ) : R.pushLiner( ( 1 - st.pull ) * SHEET.S / 2.1 + c.seed ) ) : R.tugEdge( t, c.seed );
	const face = fwd ? PULL_DIR : [ - PULL_DIR[ 0 ], - PULL_DIR[ 1 ] ];
	d.act( c.id, p[ 0 ], p[ 1 ], yawTo( p, [ p[ 0 ] + face[ 0 ], p[ 1 ] + face[ 1 ] ] ), pose, { who: c.who, role, y: moundY( p[ 0 ], p[ 1 ] ) } );

}

// the edge of the sheet each man takes after the pull: [ u, v, outward ] (the sheet's corners: u = 0 the
// left field edge, u = 1 the first base line's; v = 0 the edge past second and first, v = 1 behind home
// and past third)
const OUT_E2 = norm( [ 1, - 1 ] ), OUT_E4 = norm( [ - 1, 1 ] );
const EDGES = CREW.map( ( c, i ) => {

	if ( i <= 3 ) return { u: 0.18 + 0.24 * i, v: 0, out: OUT_E2 };
	if ( i <= 8 ) return { u: 1, v: c.v, out: PULL_DIR };
	if ( i <= 12 ) return { u: 0, v: 0.15 + 0.22 * ( i - 9 ), out: [ - PULL_DIR[ 0 ], - PULL_DIR[ 1 ] ] };
	return { u: 0.1 + 0.8 * ( i - 13 ) / 6, v: 1, out: OUT_E4 };

} );
// the three who roll the core off, and the six who stay out with the tarp on the 27th
const CORE_CREW = [ 4, 9, 14 ], CORE_V = [ 0.25, 0.5, 0.75 ];
const KEEP = new Set( [ 1, 6, 8, 11, 15, 18 ] );

function edgeSpot( i, off = 0.75 ) {

	const e = EDGES[ i ], p = sheetPoint( e.u, e.v );
	return [ p[ 0 ] + e.out[ 0 ] * off, p[ 1 ] + e.out[ 1 ] * off ];

}

// ---------------------------------------------------------------- the break

export function showSuspension( d, seg, lt ) {

	const N = d.night( seg.t0 + lt );
	const st = tarpState( N );
	const axis = rollAxis( st, 40, d._rAxis ||= [] );
	const s27 = N.split - N.t0;
	if ( lt < s27 ) night27( d, seg, lt, st, axis );
	else night29( d, seg, lt - s27, st, axis, N.dur - s27 );

}

function night27( d, seg, lt, st, axis ) {

	const s = seg.snap;
	// the Phillies' fielders come in off the field
	if ( s.oldDefense ) d._runIn( s.oldDefense, s.batting, lt );
	umpiresOff( d, lt );
	pensIn( d, lt );
	const T = { out: 1.5, lift: 7, pull: 20, pullEnd: 44, leave: 60 };
	for ( const [ i, c ] of CREW.entries() ) {

		const role = c.hood ? ROLE.hood : 0;
		const who = { who: c.who, role };
		// before the call: W4's eight wait by the tube (the rest are inside)
		if ( lt < T.lift ) {

			const f = rollAt( st, axis, c.v );
			const back = f.r + 0.45;
			const station = [ f.p[ 0 ] - f.dir[ 0 ] * back, f.p[ 1 ] - f.dir[ 1 ] * back ];
			const from = i >= 12 ? WAIT[ 19 - i ] : GATE_3B;
			const t0 = i >= 12 ? T.out + ( 19 - i ) * 0.1 : T.out + i * 0.22;
			if ( i < 12 && lt < t0 ) continue;
			if ( lt < t0 ) {

				d.act( c.id, from[ 0 ], from[ 1 ], yawTo( from, [ 0, - 30 ] ), R.waitAbout( lt, c.seed ), who );
				continue;

			}

			const w = along( [ from, station ], t0, 5.2, lt );
			if ( w.done ) {

				// there: hands on it, waiting for the word
				d.act( c.id, station[ 0 ], station[ 1 ], yawTo( station, [ station[ 0 ] + f.dir[ 0 ], station[ 1 ] + f.dir[ 1 ] ] ), R.pushRoll( 0, f.r * 2, c.seed ), who );

			} else d.act( c.id, w.p[ 0 ], w.p[ 1 ], w.yaw, M.run( w.dist / 3.2, 0.3 ), who );
			continue;

		}

		// swinging it out off the wall onto the grass
		if ( lt < T.pull ) {

			pusher( d, c, st, axis, role, lt );
			continue;

		}

		// three stay at the roll, turning it as the sheet feeds off (and stand by the core after); the
		// rest take the free edge by its handles and pull it across, walking with them behind their backs
		const ci = CORE_CREW.indexOf( i );
		if ( ci >= 0 ) {

			const f = rollAt( st, axis, CORE_V[ ci ] ), back = f.r + 0.5;
			const at = [ f.p[ 0 ] - PULL_DIR[ 0 ] * back, f.p[ 1 ] - PULL_DIR[ 1 ] * back ];
			if ( lt < T.pullEnd ) d.act( c.id, at[ 0 ], at[ 1 ], yawTo( at, [ at[ 0 ] + PULL_DIR[ 0 ], at[ 1 ] + PULL_DIR[ 1 ] ] ), R.pushRoll( st.speed > 0 ? f.travelled / 6 + c.seed : 0, f.r * 2, c.seed ), who );
			else if ( lt < T.leave + i * 0.4 ) d.act( c.id, at[ 0 ], at[ 1 ], yawTo( at, [ 0, - 20 ] ), R.waitAbout( lt, c.seed ), who );
			else leave( d, c, at, T.leave + i * 0.4, lt, who );
			continue;

		}

		if ( lt < T.pullEnd + 0.5 ) {

			puller( d, c, st, axis, role, lt, T.pull );
			continue;

		}

		// the others take the edges from where they finished (the first base line's edge)
		const e1 = sheetPoint( 1, c.v );
		const end = [ e1[ 0 ] + PULL_DIR[ 0 ] * 0.9, e1[ 1 ] + PULL_DIR[ 1 ] * 0.9 ];

		// the others take the edges: a hustle across to their spot, a few steps back tugging it square,
		// then stand by
		const spot = edgeSpot( i ), e = EDGES[ i ];
		const w = along( [ end, spot ], T.pullEnd + 0.5 + c.seed * 0.8, 3.4, lt );
		if ( ! w ) {

			// straightening up from the roll
			d.act( c.id, end[ 0 ], end[ 1 ], yawTo( end, [ end[ 0 ] + PULL_DIR[ 0 ], end[ 1 ] + PULL_DIR[ 1 ] ] ), R.waitAbout( lt, c.seed ), { ...who, y: moundY( end[ 0 ], end[ 1 ] ) + 0.04 } );
			continue;

		}

		if ( ! w.done ) {

			d.act( c.id, w.p[ 0 ], w.p[ 1 ], w.yaw, M.run( w.dist / 3.2, 0.15 ), { ...who, y: moundY( w.p[ 0 ], w.p[ 1 ] ) + 0.04 } );
			continue;

		}

		const tArr = T.pullEnd + 0.5 + c.seed * 0.8 + dist( end, spot ) / 3.4;
		const tt = lt - tArr;
		const faceOut = yawTo( spot, [ spot[ 0 ] + e.out[ 0 ], spot[ 1 ] + e.out[ 1 ] ] );
		const faceIn = yawTo( spot, [ spot[ 0 ] - e.out[ 0 ], spot[ 1 ] - e.out[ 1 ] ] );
		if ( tt < 4 ) {

			// pulling it out by the strap behind him, a step at a time
			const k = ease( tt / 4 ) * 0.8;
			const p = [ spot[ 0 ] + e.out[ 0 ] * k, spot[ 1 ] + e.out[ 1 ] * k ];
			d.act( c.id, p[ 0 ], p[ 1 ], faceOut, M.pullBehind( tt * 0.45 ), who );
			continue;

		}

		const at = [ spot[ 0 ] + e.out[ 0 ] * 0.8, spot[ 1 ] + e.out[ 1 ] * 0.8 ];
		const tLeave = T.leave + hash( i * 7.7 ) * 6;
		if ( KEEP.has( i ) || lt < tLeave ) d.act( c.id, at[ 0 ], at[ 1 ], faceIn + ( c.seed - 0.5 ) * 0.8, R.waitAbout( lt, c.seed ), who );
		else leave( d, c, at, tLeave, lt, who );

	}

}

// off to the nearer gate, and gone
function leave( d, c, from, t0, t, extra, speed = 1.9 ) {

	const gate = from[ 0 ] < 0 ? GATE_3B : GATE_1B;
	const w = alongOr( [ from, gate ], t0, speed, t );
	if ( w && ! w.done ) d.act( c.id, w.p[ 0 ], w.p[ 1 ], w.yaw, speed > 2.5 ? M.run( w.dist / 3.2, 0.1 ) : R.walk( w.dist / 2.3 ), { ...extra, y: moundY( w.p[ 0 ], w.p[ 1 ] ) + 0.04 } );

}

// the umpires: the plate umpire waves for the tarp, then they walk off together to their room
function umpiresOff( d, lt ) {

	for ( const [ id, at ] of UMP_AT ) {

		const t0 = 5 + ( id === - 1 ? 0 : 1.5 );
		if ( lt < t0 ) {

			const pose = id === - 1 && lt > 0.8 ? R.waveOn( lt ) : M.stand( lt + id );
			pose.glove = false;
			d.act( id, at[ 0 ], at[ 1 ], id === - 1 ? yawTo( at, [ - 30, - 30 ] ) : yawTo( at, [ 0, 0 ] ), pose, { role: id === - 1 ? ROLE.bag : 0 } );
			continue;

		}

		const w = along( [ at, UMP_DOOR ], t0, 1.8, lt );
		if ( w.done ) continue;
		const pose = R.walk( w.dist / 2.3 );
		d.act( id, w.p[ 0 ], w.p[ 1 ], w.yaw, pose, { role: id === - 1 ? ROLE.bag : 0 } );

	}

}

// both bullpens walk in across the outfield in their jackets, round the tarp, to their dugouts
function pensIn( d, lt ) {

	const P = d.game.players;
	const go = ( ids, gateDeg, via, to, t0 ) => ids.forEach( ( id, k ) => {

		if ( ! P[ id ] ) return;
		const start = polar( gateDeg + ( k % 3 ) * 1.2, 398 - Math.floor( k / 3 ) * 2 );
		const pts = [ start, ...via.map( ( q ) => [ q[ 0 ] + ( k % 3 ) * 0.9, q[ 1 ] + Math.floor( k / 3 ) * 1.4 ] ), to ];
		const w = along( pts, t0 + k * 0.7 + hash( id ) * 1.5, 2.7, lt );
		if ( ! w || w.done ) return;
		d.act( id, w.p[ 0 ], w.p[ 1 ], w.yaw, R.walk( w.dist / 2.4 ), { role: ROLE.jacket } );

	} );
	go( PEN_HOME, 8, [ [ 30, - 62 ], [ 39, - 16 ] ], DUGOUT.home, 3 );
	go( PEN_AWAY, 3, [ [ - 30, - 62 ], [ - 39, - 16 ] ], DUGOUT.away, 14 );

}

// ---------------------------------------------------------------- the 29th

function night29( d, seg, l2real, st, axis, dur ) {

	const s = seg.snap;
	// the crew's clock stands still through the song (they stop where they are, caps off)
	const [ g0, g1 ] = G29.gba;
	const singing = l2real >= g0 && l2real < g1;
	let l2 = l2real < g0 ? l2real : l2real < g1 ? g0 : l2real - ( g1 - g0 );
	const T = { unpull: T29.unpull[ 0 ], stow: T29.stow[ 0 ], stowEnd: T29.stow[ 1 ] };
	for ( const [ i, c ] of CREW.entries() ) {

		const who = { who: c.who, role: 0 };
		const ci = CORE_CREW.indexOf( i );
		// out along the first base side, the tarp still on from Monday night
		if ( l2 < T.unpull ) {

			if ( ci >= 0 ) {

				// at the roll, ready to wind it
				const f = rollAt( st, axis, CORE_V[ ci ] ), back = f.r + 0.5;
				const at = [ f.p[ 0 ] - PULL_DIR[ 0 ] * back, f.p[ 1 ] - PULL_DIR[ 1 ] * back ];
				d.act( c.id, at[ 0 ], at[ 1 ], yawTo( at, [ at[ 0 ] + PULL_DIR[ 0 ], at[ 1 ] + PULL_DIR[ 1 ] ] ), R.waitAbout( l2, c.seed ), who );
				continue;

			}

			// waiting at the first base line's edge, where they'll take it up from
			const e1 = sheetPoint( 1, c.v );
			const at = [ e1[ 0 ] + PULL_DIR[ 0 ] * ( 0.6 + c.seed * 0.6 ), e1[ 1 ] + PULL_DIR[ 1 ] * ( 0.6 + c.seed * 0.6 ) ];
			d.act( c.id, at[ 0 ], at[ 1 ], yawTo( at, [ at[ 0 ] - PULL_DIR[ 0 ], at[ 1 ] - PULL_DIR[ 1 ] ] ), R.waitAbout( l2, c.seed ), who );
			continue;

		}

		// walking the edge back to the roll, the three at the roll winding it
		if ( l2 < T.stow ) {

			if ( ci >= 0 ) {

				const f = rollAt( st, axis, CORE_V[ ci ] ), back = f.r + 0.5;
				const at = [ f.p[ 0 ] - PULL_DIR[ 0 ] * back, f.p[ 1 ] - PULL_DIR[ 1 ] * back ];
				d.act( c.id, at[ 0 ], at[ 1 ], yawTo( at, [ at[ 0 ] + PULL_DIR[ 0 ], at[ 1 ] + PULL_DIR[ 1 ] ] ), R.pushRoll( f.travelled / 6 + c.seed, f.r * 2, c.seed ), who );

			} else puller( d, c, st, axis, 0, l2, 0 );
			continue;

		}

		// then ten of them go to their jobs on the infield (from where they finished, by second base and
		// short), and the other ten, by the third base end, swing the roll back to the wall and go in
		if ( i < 10 ) {

			// (where each finished the unpull: behind the roll at the sheet's left field edge)
			const e = sheetPoint( 0, c.v );
			const from = [ e[ 0 ] + PULL_DIR[ 0 ] * ( R_FULL_29 + 0.52 ), e[ 1 ] + PULL_DIR[ 1 ] * ( R_FULL_29 + 0.52 ) ];
			work( d, c, i, from, l2 - T.stow, who );
			continue;

		}

		// spreading out along it as it goes (ten men for the whole length)
		const vStow = 0.05 + 0.9 * ( i - 10 ) / 9;
		const cs = { ...c, v: c.v + ( vStow - c.v ) * ease( ( l2 - T.stow ) / 2.5 ) };
		if ( l2 < T.stowEnd ) {

			pusher( d, cs, st, axis, 0, l2 );
			continue;

		}

		const f = rollAt( st, axis, cs.v );
		const from = [ f.p[ 0 ] - f.dir[ 0 ] * ( f.r + 0.52 ), f.p[ 1 ] - f.dir[ 1 ] * ( f.r + 0.52 ) ];
		leave( d, c, from, T.stowEnd + hash( i * 2.9 ) * 2.5, l2, who );

	}

	liner( d, l2 );
	// through the song: every one of them still, facing the flag in center, the cap over his heart
	if ( singing ) for ( const id of [ ...CREW.map( ( c ) => c.id ), LINER.id ] ) {

		const a = d.actors.get( id );
		if ( ! a ) continue;
		a.pose = R.capToHeart( l2real );
		a.yaw = yawTo( [ a.x, a.z ], FLAG_AT );
		a.role = ( a.role || 0 ) | ROLE.nocap;

	}

	l2 = l2real;
	resumption( d, seg, s, l2real, dur );

}

// The crew's jobs before the Rays come out (from where each finished at the tube; tt: seconds since)
const JOBS = [
	// the rakes round the bags and the cutouts (ROLE.rake)
	{ job: 'rake', at: [ - 21.5, - 18.5 ] }, { job: 'rake', at: [ - 9.5, - 33 ] }, { job: 'rake', at: [ 6, - 36 ] }, { job: 'rake', at: [ 21.5, - 18.5 ] },
	// the hose on the clay behind the bags (Getty 83824985)
	{ job: 'hose', at: [ - 12, - 30.5 ] }, { job: 'hose', at: [ 11, - 31 ] },
	// the tamper at the plate, where the hitters dug in
	{ job: 'tamp', at: [ - 1.1, - 0.4 ] },
	// the drag mats round the arc, one behind the other
	{ job: 'drag', k: 0 }, { job: 'drag', k: 1 },
	// the tamper on the mound, where the pitchers land
	{ job: 'tamp', at: [ 0.3, - 16.6 ] },
];

function work( d, c, i, from, tt, extra ) {

	const J = JOBS[ i ];
	const t0 = hash( i * 5.3 ) * 1.5;
	if ( ! J ) {

		// the rest go in through the gate by the tube
		leave( d, c, from, t0, tt, extra, 3.0 );
		return;

	}

	const done = 12 + hash( i ) * 2.5;
	if ( J.job === 'drag' ) {

		// round the arc of the infield's clay (95 ft from the mound's centre), from the third base side to
		// the first, a mat dragging behind on its rope
		const arc = ( k ) => {

			const a = - 2.35 + 1.55 * k - J.k * 0.12;
			return [ Math.cos( a ) * 26.5, - 18 + Math.sin( a ) * 26.5 ];

		};
		const start = arc( 0 );
		const w = alongOr( [ from, start ], t0, 3.2, tt );
		if ( ! w.done ) return d.act( c.id, w.p[ 0 ], w.p[ 1 ], w.yaw, M.run( w.dist / 3.2, 0.2 ), extra );
		const tA = t0 + dist( from, start ) / 3.2;
		const k = Math.min( 1, ( tt - tA ) / 10 );
		if ( k < 1 ) {

			const p = arc( k ), q = arc( Math.min( 1, k + 0.01 ) );
			d.act( c.id, p[ 0 ], p[ 1 ], yawTo( p, q ), M.pullBehind( ( tt - tA ) * 0.9 ), extra );
			return;

		}

		return leave( d, c, arc( 1 ), tA + 10, tt, extra, 3.0 );

	}

	const w = alongOr( [ from, J.at ], t0, J.job === 'rake' ? 3.6 : 3.0, tt );
	const role = J.job === 'rake' || J.job === 'tamp' ? ROLE.rake : 0;
	if ( ! w.done ) {

		const pose = J.job === 'rake' ? R.carryRake( w.dist / 3.2 ) : M.run( w.dist / 3.2, 0.2 );
		d.act( c.id, w.p[ 0 ], w.p[ 1 ], w.yaw, pose, { ...extra, role } );
		return;

	}

	if ( tt > done ) return leave( d, c, J.at, done, tt, { ...extra, role }, 3.0 );
	const drift = J.job === 'rake' ? Math.sin( tt * 0.35 + i ) * 1.2 : 0;
	const p = [ J.at[ 0 ] + drift * 0.7, J.at[ 1 ] + drift * 0.7 ];
	const face = J.job === 'tamp' ? yawTo( p, [ 0, 0 ] ) : yawTo( p, MOUND ) + Math.sin( tt * 0.2 + i ) * 0.6;
	const pose = J.job === 'rake' ? M.rake( tt + c.seed ) : J.job === 'hose' ? R.hose( tt, c.seed ) : R.tamp( tt );
	d.act( c.id, p[ 0 ], p[ 1 ], face, pose, { ...extra, role, y: moundY( p[ 0 ], p[ 1 ] ) } );

}

// The chalk liner, his own man: out from the gap by the backstop once the tarp's off the plate, the
// batter's boxes and down the third base line past the bag's cutout, and back (FieldRail's chalk is fresh
// for the 29th)
const LINER = { id: 'r:liner', who: { side: 'crew', num: '', last: '' } };
function liner( d, l2 ) {

	const t0 = 25, a = [ - 1.25, - 1.25 ], b = [ - 12.5, - 12.5 ];
	if ( l2 < t0 ) return;
	const w = along( [ UMP_DOOR, [ - 2.6, 1.2 ], a ], t0, 2.4, l2 );
	if ( ! w.done ) return d.act( LINER.id, w.p[ 0 ], w.p[ 1 ], w.yaw, R.walk( w.dist / 2.3 ), { who: LINER.who, role: 0 } );
	const tA = t0 + ( dist( UMP_DOOR, [ - 2.6, 1.2 ] ) + dist( [ - 2.6, 1.2 ], a ) ) / 2.4;
	const l = along( [ a, b ], tA, 1.3, l2 );
	if ( ! l.done ) return d.act( LINER.id, l.p[ 0 ], l.p[ 1 ], l.yaw, R.pushLiner( l.dist / 2.1 ), { who: LINER.who, role: 0 } );
	const tB = tA + dist( a, b ) / 1.3;
	const r = along( [ b, [ - 9, - 2 ], UMP_DOOR ], tB, 2.0, l2 );
	if ( ! r.done ) d.act( LINER.id, r.p[ 0 ], r.p[ 1 ], r.yaw, R.pushLiner( r.dist / 2.1 ), { who: LINER.who, role: 0 } );

}

// The Rays out for the bottom of the 6th, Balfour in from the pen, the umpires, Jenkins on deck
function resumption( d, seg, s, l2, dur ) {

	const P = d.game.players;
	const def = s.defense;
	const tOut = G29.rays, from = DUGOUT.away;
	for ( const pos of [ 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF' ] ) {

		const id = def[ pos ];
		if ( ! id ) continue;
		const to = POSITIONS[ pos ];
		const t0 = tOut + hash( id ) * 3;
		const w = along( [ from, to ], t0, 4.6, l2 );
		if ( ! w ) continue;
		let pose, yaw = w.yaw;
		if ( ! w.done ) pose = M.run( w.dist / 3.2, 0.25 );
		else {

			yaw = yawTo( to, pos === 'C' ? MOUND : [ 0, - 5 ] );
			pose = pos === 'C' ? M.catcherCrouch( l2 ) : M.ready( l2 + hash( id ) * 5 );

		}

		d.act( id, w.p[ 0 ], w.p[ 1 ], yaw, P[ id ]?.throws === 'L' && pos !== 'C' ? M.mirror( pose ) : pose, pos === 'C' && w.done ? { roleAdd: ROLE.mask } : {} );

	}

	// Balfour: he and Jim Hickey, the Rays' pitching coach, walked in from the pen to start it (Getty,
	// October 29, as W3 found: W3's pen has him loose there until he sets off); then his warm-up tosses
	// to Navarro
	const pit = def.P || BALFOUR;
	const gate = polar( 5, 398 );
	const tIn = BALFOUR_OUT, WALK_IN = 3.6;
	const path = [ gate, [ MOUND[ 0 ] + 0.6, MOUND[ 1 ] - 3 ], MOUND ];
	const w = along( path, tIn, WALK_IN, l2 );
	// Hickey: beside him in the Rays' navy jacket to the back of the mound, then off to the dugout
	const hk = along( [ [ gate[ 0 ] + 1.1, gate[ 1 ] ], [ MOUND[ 0 ] + 1.9, MOUND[ 1 ] - 9 ], DUGOUT.away ], tIn, WALK_IN, l2 );
	if ( hk && ! hk.done ) d.act( HICKEY.id, hk.p[ 0 ], hk.p[ 1 ], hk.yaw, R.walk( hk.dist / 2.3 ), { who: HICKEY.who, role: ROLE.jacket } );

	if ( w && ! w.done ) d.act( pit, w.p[ 0 ], w.p[ 1 ], w.yaw, R.walk( w.dist / 2.3 ), { role: ROLE.jacket } );
	else if ( w ) {

		const tA = tIn + ( dist( path[ 0 ], path[ 1 ] ) + dist( path[ 1 ], path[ 2 ] ) ) / WALK_IN + 3;
		const u = l2 - tA - 1.5;
		const cyc = 3.2, n = Math.floor( u / cyc ), ph = u - n * cyc;
		const pose = u > 0 && ph < 1.4 ? M.delivery( ph * 0.9 + 0.2 ) : M.stand( l2 );
		d.act( pit, MOUND[ 0 ], MOUND[ 1 ] + 0.03, Math.PI, pose, { y: 0.25 } );
		// the ball: to the catcher's mitt and back
		if ( u > 0 && ph > M.REL / 0.9 - 0.2 ) {

			const rel = [ MOUND[ 0 ] + 0.3, 1.9, MOUND[ 1 ] + 1.2 ], mitt = [ POSITIONS.C[ 0 ], 0.75, POSITIONS.C[ 1 ] - 0.3 ];
			const tb = ph - ( M.REL / 0.9 - 0.2 );
			if ( tb < 0.55 ) {

				const k = tb / 0.55;
				d.ballAt = [ rel[ 0 ] + ( mitt[ 0 ] - rel[ 0 ] ) * k, rel[ 1 ] + ( mitt[ 1 ] - rel[ 1 ] ) * k + Math.sin( Math.PI * k ) * 0.3, rel[ 2 ] + ( mitt[ 2 ] - rel[ 2 ] ) * k ];

			} else if ( tb < 1.1 ) d.ballAt = mitt;
			else if ( tb < 2.3 ) {

				const k = ( tb - 1.1 ) / 1.2;
				d.ballAt = [ mitt[ 0 ] + ( rel[ 0 ] - mitt[ 0 ] ) * k, 1.5 + Math.sin( Math.PI * k ) * 2.5, mitt[ 2 ] + ( rel[ 2 ] - 0.6 - mitt[ 2 ] ) * k ];

			}

		}

	}

	// the umpires walk out from their room
	const tU = G29.umps;
	for ( const [ id, at ] of UMP_AT ) {

		const w = along( [ UMP_DOOR, at ], tU + ( - id ) * 0.4, 2.2, l2 );
		if ( ! w ) continue;
		const pose = w.done ? M.stand( l2 + id ) : R.walk( w.dist / 2.3 );
		pose.glove = false;
		d.act( id, w.p[ 0 ], w.p[ 1 ], w.done ? yawTo( at, id === - 1 ? MOUND : [ 0, - 5 ] ) : w.yaw, pose, { role: id === - 1 ? ROLE.bag : 0 } );

	}

	// Jenkins, pinch-hitting for Hamels, out of the dugout to the on-deck circle
	const tJ = G29.jenkins;
	if ( s.batter ) {

		const w = along( [ DUGOUT.home, ON_DECK.home ], tJ, 1.8, l2 );
		if ( w && ! w.done ) {

			const pose = R.walk( w.dist / 2.3 );
			pose.bat = { dir: [ 0.2, 0.9, 0.3 ] };
			d.act( s.batter, w.p[ 0 ], w.p[ 1 ], w.yaw, pose );

		} else if ( w ) d._onDeck( { ...s, onDeck: s.batter }, l2 );

	}

}

export { CREW };
