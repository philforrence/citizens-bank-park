import * as M from './Motions.js';
import * as R from './RitualMoves.js';
import { ROLE } from './Players.js';
import { POSITIONS, MOUND, DUGOUT, ON_DECK, polar, dist, lerp2, yawTo } from './Plays.js';
import { tarpState, rollAxis, rollFrame, sheetPoint, tubeAt, PULL_DIR, LAY_DIR, R_CORE, SHEET, T27, T29, TARP_ON_29, moundY } from './TarpPlan.js';

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
//     out along the tube on the third base side, push the roll off the wall onto the grass by the left
//     field line and on, bent over it shoulder to shoulder, along the outfield edge of the clay behind
//     short and second, the folded strip laying out behind it (---- FR2: TarpPlan's route, as photographed);
//   - they string out along the strip's infield edge, pull it in toward home by the handles and walk the
//     edges square; three stand by the bare black core where it lies behind second (83458149, 83458151);
//   - both bullpens walk in across the outfield in their jackets (83458226: the Phillies' relievers
//     crossing right field during the pull), round the tarp to their dugouts;
//   - the crew stand round the edges, hoods up; most go in, six stay out with it.
// The 29th, before 8:37 pm, cold and dry:
//   - the crew are out along the first base side; the edge walked back and folded, the roll wound back
//     over the strip to the third base line and swung back to the wall (---- FR2);
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
// (---- FB4, C4B-4: not evenly spaced along the roll, each his own distance back from it and his own way
// of pushing: 60% bent over it with both hands, a quarter upright with a hand on it, the rest down with a
// shoulder to it (Getty 88457361, 83458220: different heights and leans, gaps between them). They were
// twenty men 0.74 m apart, one bend, a drill line)
const CREW = Array.from( { length: N_CREW }, ( _, i ) => ( { id: 'r:crew' + i, who: { side: 'crew', num: '', last: '' }, seed: hash( i * 3.1 + 0.7 ),
	v: 0.03 + 0.94 * i / ( N_CREW - 1 ) + ( i > 0 && i < N_CREW - 1 ? ( hash( i * 7.9 + 0.2 ) - 0.5 ) * 0.034 : 0 ),
	back: 0.45 + 0.24 * hash( i * 5.3 + 0.9 ), style: hash( i * 2.7 + 0.4 ) < 0.6 ? 0 : hash( i * 2.7 + 0.4 ) < 0.85 ? 1 : 2 } ) );
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

// ---- FR2: the roll's frame at s along it (TarpPlan.rollFrame: its axis point, radius, the way it's
// pushed, how far it's come); each man's place on it is his c.v
const rollAt = ( st, axis, s ) => rollFrame( st, axis, s );

// someone pushing the roll at v, behind it
function pusher( d, c, st, axis, role, t ) {

	const f = rollAt( st, axis, c.v );
	const back = f.r + ( c.back ?? 0.52 ); // (---- FB4: his own distance back)
	const x = f.p[ 0 ] - f.dir[ 0 ] * back, z = f.p[ 1 ] - f.dir[ 1 ] * back;
	const moving = st.speed > 0;
	const pose = pushStyle( R.pushRoll( moving ? f.travelled / 2.3 + c.seed : 0, f.r * 2, c.seed ), c, f.r * 2, t );
	if ( ! moving ) pose.pelvisY += 0.02 * Math.sin( t * 1.3 + c.seed * 9 );
	// (on the 27th they walk on the sheet laid behind the roll)
	const onSheet = st.dir > 0 && st.phase !== 'lift' ? 0.045 : 0;
	d.act( c.id, x, z, yawTo( [ x, z ], [ x + f.dir[ 0 ], z + f.dir[ 1 ] ] ), pose, { who: c.who, role, y: moundY( x, z ) + onSheet } );
	return [ x, z ];

}

// ---- FB4 (C4B-4): his way of pushing it (c.style, CREW above): bent over it with both hands, deeper or
// shallower; upright with his right hand on it, the left at his side; or down low with his shoulder to it.
// Now and then a look along the line. h: the roll's top above the ground
function pushStyle( p, c, h, t ) {

	if ( c.style === undefined ) return p;
	const k = c.seed, reach = h * 0.92;
	if ( c.style === 1 ) {

		p.pelvisY += 0.07;
		p.pelvis = [ - 0.12, 0, 0 ];
		p.torso = [ - 0.28 - 0.12 * k, 0.15, 0 ];
		p.head = [ 0.2, p.head[ 1 ] ];
		p.handR = [ 0.18, reach + 0.04, - 0.6 ];
		p.handL = [ - 0.24, 0.86, - 0.04 ];

	} else if ( c.style === 2 ) {

		p.pelvisY -= 0.05;
		p.torso = [ - 0.95, - 0.35, 0.05 ];
		p.head = [ 0.4, - 0.6 ];
		p.handL = [ - 0.12, reach - 0.08, - 0.42 ];
		p.handR = [ 0.3, reach - 0.12, - 0.36 ];

	} else p.torso = [ p.torso[ 0 ] * ( 0.82 + 0.36 * k ), p.torso[ 1 ], p.torso[ 2 ] ];

	const look = Math.max( 0, Math.sin( t * 0.37 + k * 23 ) - 0.75 ) * 4;
	if ( look > 0 ) p.head = [ p.head[ 0 ] - 0.25 * look, p.head[ 1 ] + ( k < 0.5 ? 0.7 : - 0.7 ) * look ];
	return p;

}
// ---- end FB4

// someone pulling the sheet's free edge across by its handle (Getty 83458149: walking with the strap
// behind him, leaning into it), just ahead of the edge; on the 29th walking it back to the strip, the
// folded edge carried in front of him. (---- FR2: they're at the edge already, strung out along the strip
// from where the roll ran out: spread() below)
// ---- FB4 (C4B-5): how far ahead of the edge a man walks: his arms' length back to the hem's handle
// (they were 0.9 m ahead with their hands 0.65 m short of it: C4B's T27-u39-edge)
const PULL_OFF = 0.42;
// ---- end FB4
function puller( d, c, st, axis, role, t ) {

	const e = sheetPoint( st.u, c.v ), fwd = st.dir > 0;
	const off = fwd ? PULL_OFF : 0.6;
	const p = [ e[ 0 ] + PULL_DIR[ 0 ] * off, e[ 1 ] + PULL_DIR[ 1 ] * off ];
	const walked = st.pull * SHEET.S;
	let pose = st.speed > 0 ? ( fwd ? M.pullBehind( walked / 1.3 + c.seed ) : R.pushLiner( ( 1 - st.pull ) * SHEET.S / 2.1 + c.seed ) ) : R.tugEdge( t, c.seed );
	const face = fwd ? PULL_DIR : [ - PULL_DIR[ 0 ], - PULL_DIR[ 1 ] ];
	let yaw = yawTo( p, [ p[ 0 ] + face[ 0 ], p[ 1 ] + face[ 1 ] ] );
	// ---- FB4 (C4B-5): hands back on the hem at its height, the arms straight behind, leaning into it,
	// each man his own lean (Getty 83458151, 83458153); and turned round from facing the edge, where they
	// held it up waiting, to walk it across, over the first 0.7 s (they'd stood with their backs to it)
	if ( fwd && st.speed > 0 ) {

		const hy = st.edgeY + 0.05, lean = 0.12 + 0.2 * c.seed;
		pose.handL = [ - 0.2, hy, PULL_OFF + 0.02 ];
		pose.handR = [ 0.21, hy + 0.03, PULL_OFF ];
		pose.torso = [ pose.torso[ 0 ] - lean, pose.torso[ 1 ], pose.torso[ 2 ] ];
		pose.head = [ ( pose.head?.[ 0 ] ?? 0 ) + 0.25 * lean, pose.head?.[ 1 ] ?? 0 ];

	}

	if ( fwd ) {

		const k = ease( ( t - T27.pull[ 0 ] ) / 0.7 );
		if ( k < 1 ) {

			yaw += Math.PI * ( 1 - k ) * ( c.seed < 0.5 ? 1 : - 1 );
			pose = M.blend( R.tugEdge( t, c.seed ), pose, k );

		}

	}

	// ---- end FB4
	d.act( c.id, p[ 0 ], p[ 1 ], yaw, pose, { who: c.who, role, y: moundY( p[ 0 ], p[ 1 ] ) } );

}

// ---- FR2: from one place to another by a time, running as hard as it takes (a jog at least), then
// standing there holding the edge up, facing in (the spread along the strip, and back to the roll on the
// 29th); null before t0
function runTo( d, c, from, to, t0, t1, t, face, extra, hold ) {

	if ( t < t0 ) return false;
	const L = dist( from, to ), v = Math.max( 2.6, L / Math.max( 0.5, t1 - t0 ) );
	const w = along( [ from, to ], t0, v, t );
	if ( ! w.done ) {

		d.act( c.id, w.p[ 0 ], w.p[ 1 ], w.yaw, M.run( w.dist / 3.2, Math.min( 1, v / 6 ) ), { ...extra, y: moundY( w.p[ 0 ], w.p[ 1 ] ) + 0.04 } );
		return true;

	}

	d.act( c.id, to[ 0 ], to[ 1 ], yawTo( to, [ to[ 0 ] + face[ 0 ], to[ 1 ] + face[ 1 ] ] ), hold, { ...extra, y: moundY( to[ 0 ], to[ 1 ] ) } );
	return true;

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
// the three who stand by the core (---- FR2: beyond it, behind second), and the six who stay out with the
// tarp on the 27th
const CORE_CREW = [ 4, 9, 14 ], CORE_V = [ 0.25, 0.5, 0.75 ];
const coreSpot = ( st, axis, ci ) => {

	const f = rollAt( st, axis, CORE_V[ ci ] ), k = f.r + 0.55;
	return [ f.p[ 0 ] + LAY_DIR[ 0 ] * k, f.p[ 1 ] + LAY_DIR[ 1 ] * k ];

};
// ---- FR2: each man's place at the free edge before the pull (the strip's infield edge, at his v)
const edgeStart = ( c ) => {

	const e = sheetPoint( 0, c.v );
	return [ e[ 0 ] + PULL_DIR[ 0 ] * PULL_OFF, e[ 1 ] + PULL_DIR[ 1 ] * PULL_OFF ]; // (---- FB4: at arm's length)

};
// ... and his place pushing the roll at an end of the strip ('end': behind second, where it runs out;
// 'start': by the third base line), pushing it on (dir 1, the 27th) or back (dir -1, the 29th)
const _endAxis = [];
const pushSpot = ( c, end, dir, back = c.back ?? 0.52 ) => {

	const st = { phase: 'lay', vRoll: end === 'end' ? - ( R_CORE + 0.15 ) / SHEET.S : 1 + 0.65 / SHEET.S, r: end === 'end' ? R_CORE : R_FULL_29, lift: 1, dir };
	const A = rollAxis( st, 20, _endAxis ), f = rollAt( st, A, c.v ), k = f.r + back;
	return [ f.p[ 0 ] - f.dir[ 0 ] * k, f.p[ 1 ] - f.dir[ 1 ] * k ];

};
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
	// ---- FR2: on the plan's times (TarpPlan.T27): off the wall, along the clay's edge laying the strip,
	// strung out along it, the pull; then the edges walked square
	const T = { out: T27.out, lift: T27.lift[ 0 ], spread: T27.spread[ 0 ], pull: T27.pull[ 0 ], pullEnd: T27.pull[ 1 ], leave: 67 };
	for ( const [ i, c ] of CREW.entries() ) {

		const role = c.hood ? ROLE.hood : 0;
		const who = { who: c.who, role };
		// before the call: W4's eight wait by the tube (the rest are inside)
		if ( lt < T.lift ) {

			const f = rollAt( st, axis, c.v );
			const back = f.r + c.back; // (---- FB4)
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
				d.act( c.id, station[ 0 ], station[ 1 ], yawTo( station, [ station[ 0 ] + f.dir[ 0 ], station[ 1 ] + f.dir[ 1 ] ] ), pushStyle( R.pushRoll( 0, f.r * 2, c.seed ), c, f.r * 2, lt ), who );

			} else d.act( c.id, w.p[ 0 ], w.p[ 1 ], w.yaw, M.run( w.dist / 3.2, 0.3 ), who );
			continue;

		}

		// off the wall and along the clay's edge, the strip laying out behind
		if ( lt < T.spread ) {

			pusher( d, c, st, axis, role, lt );
			continue;

		}

		// three stay by the core where it ran out, behind second; the rest string out along the strip's
		// infield edge, each to his place (the far ones running), and take it up by the handles
		const ci = CORE_CREW.indexOf( i );
		if ( ci >= 0 ) {

			// (round the end of it to beyond it, facing the sheet)
			const at = coreSpot( st, axis, ci ), from = pushSpot( c, 'end', 1 );
			const by = [ from[ 0 ] + ( at[ 0 ] - from[ 0 ] ) * 0.5 - LAY_DIR[ 1 ] * 1.2 * ( CORE_V[ ci ] < 0.5 ? 1 : - 1 ), from[ 1 ] + ( at[ 1 ] - from[ 1 ] ) * 0.5 + LAY_DIR[ 0 ] * 1.2 * ( CORE_V[ ci ] < 0.5 ? 1 : - 1 ) ];
			if ( lt < T.leave + i * 0.4 ) {

				const w = alongOr( [ from, by, at ], T.spread + 0.3, 1.6, lt );
				if ( ! w.done ) d.act( c.id, w.p[ 0 ], w.p[ 1 ], w.yaw, R.walk( w.dist / 2.3 ), who );
				else d.act( c.id, at[ 0 ], at[ 1 ], yawTo( at, [ at[ 0 ] - LAY_DIR[ 0 ] * 5 + PULL_DIR[ 0 ] * ( lt > T.pull ? 6 : 0 ), at[ 1 ] - LAY_DIR[ 1 ] * 5 + PULL_DIR[ 1 ] * ( lt > T.pull ? 6 : 0 ) ] ), R.waitAbout( lt, c.seed ), who );

			} else leave( d, c, at, T.leave + i * 0.4, lt, who );
			continue;

		}

		if ( lt < T.pull ) {

			// (---- FB4: facing the edge, holding it up: tugEdge's hands are in front of him)
			// (---- FX2: still at the roll till he sets off: he was gone for the half second in between)
			runTo( d, c, pushSpot( c, 'end', 1 ), edgeStart( c ), T.spread + c.seed * 0.5, T.pull - 0.5, lt, [ - PULL_DIR[ 0 ], - PULL_DIR[ 1 ] ], who, R.tugEdge( lt, c.seed ) ) || pusher( d, c, st, axis, role, lt );
			continue;

		}

		if ( lt < T.pullEnd + 0.5 ) {

			puller( d, c, st, axis, role, lt );
			continue;

		}

		// the others take the edges from where they finished (the first base line's edge)
		const e1 = sheetPoint( 1, c.v );
		const end = [ e1[ 0 ] + PULL_DIR[ 0 ] * PULL_OFF, e1[ 1 ] + PULL_DIR[ 1 ] * PULL_OFF ]; // (---- FB4)

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
		const tLeave = Math.max( T.leave + hash( i * 7.7 ) * 6, tArr + 4.5 ); // ---- FR2: not before he's there
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
	// ---- FR2: on the plan's times (TarpPlan.T29): the edge walked back and folded; the roll wound back
	// over the strip from behind second to the third base line, the men nearest it on it from the start and
	// the rest taking hold as it comes along to where each put the edge down; then swung back to the wall
	const T = { unpull: T29.unpull[ 0 ], gather: T29.unpull[ 1 ], wind: T29.wind[ 0 ], stow: T29.stow[ 0 ], stowEnd: T29.stow[ 1 ] };
	for ( const [ i, c ] of CREW.entries() ) {

		const who = { who: c.who, role: 0 };
		// ---- FB4 (C4B-6): no tarp on the 29th (TarpPlan.TARP_ON_29): ten of them at their jobs on the skin
		// as the 29th's part opens, the hoses on the clay behind the bags, the rakes, the tampers and the
		// drags (Getty 83824977, 83824985: the crew watering the infield with the crowd in), done by 13-17 s
		// and off the field by the song (any still out stand still for it where they are); the rest are in
		if ( ! TARP_ON_29 ) {

			if ( i < 10 ) work( d, c, i, null, l2, who, 13 + hash( i * 3.7 ) * 4 );
			continue;

		}

		// ---- end FB4
		const ci = CORE_CREW.indexOf( i );
		// (his place on the roll winding it: the three at the core and the near ones spread along it, the
		// later ones near its infield end, where they're standing when it reaches them)
		const early = ci >= 0 || c.v < 0.25;
		const cw = { ...c, v: ci >= 0 ? CORE_V[ ci ] : early ? 0.08 + c.v * 3 : 0.55 + 0.4 * c.seed };
		// out along the first base side, the tarp still on from Monday night; three by the core
		if ( l2 < T.gather ) {

			if ( ci >= 0 ) {

				const at = coreSpot( st, axis, ci );
				d.act( c.id, at[ 0 ], at[ 1 ], yawTo( at, [ 0, - 20 ] ), R.waitAbout( l2, c.seed ), who );
				continue;

			}

			if ( l2 >= T.unpull ) {

				puller( d, c, st, axis, 0, l2 );
				continue;

			}

			// waiting at the first base line's edge, where they'll take it up from
			const e1 = sheetPoint( 1, c.v );
			const at = [ e1[ 0 ] + PULL_DIR[ 0 ] * 0.6, e1[ 1 ] + PULL_DIR[ 1 ] * 0.6 ];
			d.act( c.id, at[ 0 ], at[ 1 ], yawTo( at, [ at[ 0 ] - PULL_DIR[ 0 ], at[ 1 ] - PULL_DIR[ 1 ] ] ), R.waitAbout( l2, c.seed ), who );
			continue;

		}

		if ( l2 < T.stow ) {

			const from = ci >= 0 ? coreSpot( st, axis, ci ) : edgeStart( c );
			if ( early ) {

				// to the roll behind second, then on it
				if ( l2 < T.wind ) runTo( d, c, from, pushSpot( cw, 'end', - 1 ), T.gather + c.seed * 0.3, T.wind, l2, [ - LAY_DIR[ 0 ], - LAY_DIR[ 1 ] ], who, R.pushRoll( 0, R_CORE * 2, c.seed ) );
				else pusher( d, cw, st, axis, 0, l2 );
				continue;

			}

			// waiting where he put the edge down until the roll comes by, then on it
			const f = rollAt( st, axis, cw.v ), back = f.r + 0.52;
			const station = [ f.p[ 0 ] - f.dir[ 0 ] * back, f.p[ 1 ] - f.dir[ 1 ] * back ];
			const k = ease( ( st.vRoll - c.v + 0.22 ) * SHEET.S / 9.5 );
			if ( k >= 1 ) {

				pusher( d, cw, st, axis, 0, l2 );
				continue;

			}

			const p = [ from[ 0 ] + ( station[ 0 ] - from[ 0 ] ) * k, from[ 1 ] + ( station[ 1 ] - from[ 1 ] ) * k ];
			const face = k > 0.5 ? f.dir : [ - LAY_DIR[ 0 ], - LAY_DIR[ 1 ] ];
			d.act( c.id, p[ 0 ], p[ 1 ], yawTo( p, [ p[ 0 ] + face[ 0 ], p[ 1 ] + face[ 1 ] ] ), k > 0 ? M.blend( R.walk( k * 3 ), R.pushRoll( 0, f.r * 2, c.seed ), k ) : R.waitAbout( l2, c.seed ), { ...who, y: moundY( p[ 0 ], p[ 1 ] ) } );
			continue;

		}

		// then ten of them go to their jobs on the infield (from where they finished, by second base and
		// short), and the other ten, by the third base end, swing the roll back to the wall and go in
		if ( i < 10 ) {

			// (where each finished winding it: behind the roll at the third base line)
			work( d, c, i, pushSpot( cw, 'start', - 1 ), l2 - T.stow, who );
			continue;

		}

		// spreading out along it as it goes (ten men for the whole length)
		const vStow = 0.05 + 0.9 * ( i - 10 ) / 9;
		const cs = { ...c, v: cw.v + ( vStow - cw.v ) * ease( ( l2 - T.stow ) / 2.5 ) };
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

function work( d, c, i, from, tt, extra, until = 0 ) {

	const J = JOBS[ i ];
	// (---- FB4: from null, already at it as the 29th's part opens (a step from his place), until `until`)
	const there = from == null;
	const t0 = there ? 0 : hash( i * 5.3 ) * 1.5;
	if ( there && J ) from = J.at ? [ J.at[ 0 ] + ( hash( i * 2.2 ) - 0.5 ) * 0.6, J.at[ 1 ] + ( hash( i * 4.1 ) - 0.5 ) * 0.6 ] : [ Math.cos( - 2.35 - J.k * 0.12 ) * 26.5, - 18 + Math.sin( - 2.35 - J.k * 0.12 ) * 26.5 ];
	if ( ! J ) {

		// the rest go in through the gate by the tube
		leave( d, c, from, t0, tt, extra, 3.0 );
		return;

	}

	// (---- FR2: they come from the third base line now, where the roll was wound back: a few seconds at
	// the job whatever the walk)
	const done = Math.max( until, 12 + hash( i ) * 2.5, t0 + ( J.at ? dist( from, J.at ) / ( J.job === 'rake' ? 3.6 : 3.0 ) : 0 ) + 5 );
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

	// (---- FR2: off from where he is, the rake's drift and all; the drift from where he got to)
	const tAt = t0 + dist( from, J.at ) / ( J.job === 'rake' ? 3.6 : 3.0 );
	const drift = J.job === 'rake' ? Math.sin( Math.min( tt, done ) * 0.35 + i ) * 1.2 * Math.min( 1, Math.max( 0, Math.min( tt, done ) - tAt ) / 2 ) : 0;
	if ( tt > done ) return leave( d, c, [ J.at[ 0 ] + drift * 0.7, J.at[ 1 ] + drift * 0.7 ], done, tt, { ...extra, role }, 3.0 );
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

	const t0 = TARP_ON_29 ? 25 : 4, a = [ - 1.25, - 1.25 ], b = [ - 12.5, - 12.5 ]; // (---- FB4: no tarp to wait for)
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
