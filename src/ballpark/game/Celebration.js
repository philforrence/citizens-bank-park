import { Quaternion, Euler } from '../../engine/index.js';
import * as M from './Motions.js';
import * as R from './RitualMoves.js';
import { ROLE } from './Players.js';
import { POSITIONS, BASES, MOUND, DUGOUT, BULLPEN, boxFor, polar, dist, lerp2, yawTo } from './Plays.js';
import { moundY } from './TarpPlan.js';

// The last out and the celebration, on the players' rig: the Director's celebrate segment (9:58 pm on
// October 29 onward) as a script per man, a pure function of the time since the strikeout.
//
// The pile, built up properly (Getty 83486412, 83486112; the Commons "Players rushing field"):
//   - Lidge drops to his knees in front of the rubber, arms up, the glove gone;
//   - Ruiz, first there from behind the plate in his gear, throws his arms round him;
//   - Howard from first dives onto the two of them and over they go, Lidge underneath;
//   - Feliz, Utley and Rollins on top, then the outfielders in from the grass;
//   - the dugout over the rail and across the grass, the coaches behind them, Manuel walking;
//   - the pen out of its gate in center and the length of the outfield;
//   - the ones who can't get on it reach in or jump round it, arms up.
// Then it comes apart from the top, Lidge last, into hugs, and the men go to the stands.
//
// Each man's night here is a list of steps (hold, go, dive into the pile, lie in it, get up, hug, wave),
// laid out once from the distances and evaluated at the time: so scrubbing agrees.

export const CEL = {
	pileHold: 30, upStep: 0.75, freeFrom: 44,
	// the stage goes up (its pieces set down in turn), the MVP's car driven in, the trophy out on its
	// pedestal, the party up the stairs; the presentation; the lap with the flag; Harry Kalas sings
	stageBuild: [ 60, 100 ], carIn: [ 96, 112 ], trophyOut: 112, party: 114, gather: 120,
	present: [ 126, 198 ], hand: 140, manuel: [ 152, 166 ], mvp: [ 166, 182 ], up: 184, lap: [ 200, 292 ], kalas: [ 206, 246 ], moyer: [ 128, 150 ],
};
// The stage (anthonydefrancesco 2986359720: on the first base side of second, on the clay), facing the
// plate and the first base stands (Getty 83570999: the right field wall behind it), the car beside it
const STAGE_YAW = - 0.5;
export const STAGE = {
	at: [ 17, - 31 ], yaw: STAGE_YAW,
	car: [ 17 + 8.2 * Math.cos( STAGE_YAW ) + 2.6 * Math.sin( STAGE_YAW ), - 31 - 8.2 * Math.sin( STAGE_YAW ) + 2.6 * Math.cos( STAGE_YAW ) ], carYaw: - 2.87,
	// a point in the stage's own frame (x along its front, z out of its front) in the field frame
	point: ( lx, lz ) => [ 17 + lx * Math.cos( STAGE_YAW ) + lz * Math.sin( STAGE_YAW ), - 31 - lx * Math.sin( STAGE_YAW ) + lz * Math.cos( STAGE_YAW ) ],
	W: 6.4, D: 3.2, H: 0.95,
};
// the lap (ronniebruce 2987488477, 2988346732: the players in their grey tees behind the big red flag, a
// motor officer out front, round the warning track from the right field corner toward left)
export const LAP = [ [ 30, - 26 ], [ 50, - 46 ], [ 64, - 64 ], [ 58, - 84 ], [ 44, - 104 ], [ 24, - 116 ], [ 0, - 120 ], [ - 24, - 115 ], [ - 44, - 102 ] ];
// who: Brett Myers with the flag (Getty 83570906), Howard with the trophy (Getty 83485971), and friends
const LAP_MEN = [ 408206, 429667, 425664, 276519, 150029, 434563, 430935, 150268, 400120, 425785, 122644 ];
const hash = ( n ) => {

	const s = Math.sin( n * 12.9898 ) * 43758.5453;
	return s - Math.floor( s );

};
const ease = R.ease;
// where the pile is: on the mound, just in front of the rubber toward the plate
export const PILE = [ MOUND[ 0 ], MOUND[ 1 ] + 0.6 ];
const UMP_DOOR = [ - 8.6, 13.4 ];
const r2 = Math.SQRT1_2;
const UMP_AT = [
	[ - 1, [ 0.35, 2.05 ] ], [ - 2, [ 19.4 + 2.2 * r2 + 1.2 * r2, - 19.4 - 2.2 * r2 + 1.2 * r2 ] ], [ - 3, [ - 3.5, - 32.5 ] ],
	[ - 4, [ - 19.4 - 2.2 * r2 - 1.2 * r2, - 19.4 - 2.2 * r2 + 1.2 * r2 ] ], [ - 5, [ - 70 * r2 - 1.2, - 70 * r2 + 1.2 ] ], [ - 6, [ 70 * r2 + 1.2, - 70 * r2 + 1.2 ] ],
];

// The staff who came out: Charlie Manuel, the coaches (Davey Lopes, Steve Smith, the bench, pitching
// and hitting coaches in the dugout; the bullpen coach and catcher from the pen), all in the red dugout
// jacket over the uniform on the cold night. Real men; their looks from Looks.js where it has them.
const STAFF = [
	{ id: 'r:manuel', who: { side: 'home', num: '', last: 'MANUEL', look: 'manuel' }, from: 'dugout', coach: true, slow: true },
	{ id: 'r:lopes', who: { side: 'home', num: '', last: 'LOPES', look: 'lopes' }, from: 'dugout', coach: true },
	{ id: 'r:smith', who: { side: 'home', num: '', last: 'SMITH', look: 'smith' }, from: 'dugout', coach: true },
	{ id: 'r:mackanin', who: { side: 'home', num: '', last: 'MACKANIN' }, from: 'dugout', coach: true },
	{ id: 'r:dubee', who: { side: 'home', num: '', last: 'DUBEE' }, from: 'dugout', coach: true },
	{ id: 'r:thompson', who: { side: 'home', num: '', last: 'THOMPSON' }, from: 'dugout', coach: true },
	{ id: 'r:henderson', who: { side: 'home', num: '', last: 'HENDERSON' }, from: 'pen', coach: true },
	{ id: 'r:billmeyer', who: { side: 'home', num: '', last: 'BILLMEYER' }, from: 'pen', coach: true },
];
const MOYER = { id: 'r:moyer', who: { side: 'home', num: '50', last: '' } };
// where the rubber is (Field.js: 24 x 6 in, its front edge 60 ft 6 in from the plate)
export const RUBBER = [ 0, 0.255, - 18.44 - 0.076 ];
// the relievers still in the pen at the end (Durbin and Romero had pitched and were in the dugout)
const PEN = new Set( [ 425492, 113961, 424925, 457918 ] );

// the pile's shape: slot k after the first three. Lying ones radiate from the middle, heads in, each
// higher than the last; then men leaning in, then a ring round it jumping
function slot( k ) {

	const a = k * 2.39996 + 0.7;
	const dir = [ Math.cos( a ), Math.sin( a ) ];
	if ( k < 9 ) {

		const layer = Math.floor( k / 3 );
		const r = 1.35 + 0.25 * ( k % 3 ) / 2 + 0.1 * layer;
		return { kind: 'lie', dir, r, y: 0.45 + 0.3 * layer + 0.08 * ( k % 3 ), pitch: - ( 1.05 + 0.25 * hash( k + 3 ) ), roll: ( hash( k + 7 ) - 0.5 ) * 0.6 };

	}

	if ( k < 17 ) return { kind: 'lean', dir, r: 1.95 + 0.25 * hash( k ) };
	return { kind: 'ring', dir, r: 2.7 + 0.8 * hash( k * 1.7 ) };

}

const at = ( dir, r ) => [ PILE[ 0 ] + dir[ 0 ] * r, PILE[ 1 ] + dir[ 1 ] * r ];
const _q = new Quaternion(), _e = new Euler( 0, 0, 0, 'YXZ' );
const tiltOf = ( pitch, roll ) => new Quaternion().setFromEuler( _e.set( pitch, 0, roll, 'YXZ' ) );

// ---------------------------------------------------------------- the plan

function plan( d, seg ) {

	const P = d.game.players, s = seg.snap, def = s.defense;
	const L = new Map();
	const add = ( id, info ) => {

		const e = { id, steps: [], ...info };
		L.set( id, e );
		return e;

	};
	// who's where at the last out
	const people = [];
	for ( const pos of [ '1B', '3B', '2B', 'SS', 'LF', 'CF', 'RF' ] ) if ( def[ pos ] ) people.push( { id: def[ pos ], from: POSITIONS[ pos ], react: 0.55 + hash( def[ pos ] ) * 0.4, speed: 7.6 } );
	for ( const id of seg.plan.bench ) {

		if ( PEN.has( id ) ) people.push( { id, from: polar( 6 + ( hash( id ) - 0.5 ) * 4, 398 ), react: 2.2 + hash( id ) * 1.5, speed: 7.2 } );
		else people.push( { id, from: [ DUGOUT.home[ 0 ] + ( hash( id ) - 0.5 ) * 12, DUGOUT.home[ 1 ] - ( hash( id ) - 0.5 ) * 12 ], react: 1.2 + hash( id * 3 ) * 2.5, speed: 6.8 } );

	}

	// Jamie Moyer (not in the box score's roster here: the Game 3 starter, 45, from Souderton, who'd
	// skipped school for the 1980 parade)
	people.push( { id: MOYER.id, who: MOYER.who, from: [ DUGOUT.home[ 0 ] - 3, DUGOUT.home[ 1 ] + 2 ], react: 2.4, speed: 6.2 } );
	for ( const c of STAFF ) {

		const f = c.from === 'pen' ? polar( 6 + ( hash( c.id.length ) - 0.5 ) * 3, 398 ) : [ DUGOUT.home[ 0 ] + ( hash( c.id.length * 7 ) - 0.5 ) * 8, DUGOUT.home[ 1 ] - ( hash( c.id.length * 5 ) - 0.5 ) * 8 ];
		people.push( { id: c.id, who: c.who, from: f, react: c.slow ? 6 : 3 + hash( c.id.length * 9 ) * 3, speed: c.slow ? 2.4 : 4.6, coach: true } );

	}

	// the order they get there (the first three are Lidge, Ruiz and Howard)
	for ( const q of people ) q.arrive = q.react + Math.max( 0, dist( q.from, PILE ) - 2.2 ) / q.speed;
	people.sort( ( a, b ) => a.arrive - b.arrive );
	// Howard's there first of them (and dives); the rest take the slots in order
	const hi = people.findIndex( ( q ) => q.id === def[ '1B' ] );
	const howard = hi >= 0 ? people.splice( hi, 1 )[ 0 ] : null;

	// ---- Lidge
	const C = PILE, cy = moundY( C[ 0 ], C[ 1 ] );
	const lidge = def.P, ruiz = def.C;
	const tHit = 3.3;
	add( lidge, {} ).steps.push(
		{ t0: 0, t1: 0.4, kind: 'hold', p: C, yaw: Math.PI, y: cy, pose: ( tau ) => M.jump( tau ) },
		{ t0: 0.4, t1: tHit, kind: 'hold', p: C, yaw: Math.PI, y: cy, pose: ( tau ) => M.kneel( tau ) },
		// over backward under Ruiz and Howard
		{ t0: tHit, t1: tHit + 0.5, kind: 'fall', p: C, yaw: Math.PI, y0: cy, y1: cy + 0.1, pitch: 1.15, roll: 0.1, pose0: () => M.kneel( 3 ), pose: () => R.inPile( 2 ) },
		{ t0: tHit + 0.5, t1: CEL.pileHold + 13, kind: 'lie', p: C, yaw: Math.PI, y: cy + 0.1, pitch: 1.15, roll: 0.1, pose: ( tau ) => R.inPile( 2, tau ) },
	);
	// ---- Ruiz: from behind the plate in his gear, the mask off, the arms round him; down on top of him
	const rTo = [ C[ 0 ], C[ 1 ] + 0.55 ];
	add( ruiz, { role: ROLE.gear | ROLE.ccap } ).steps.push(
		{ t0: 0, t1: 2.4, kind: 'go', a: POSITIONS.C, b: rTo, gait: 'run' },
		{ t0: 2.4, t1: tHit, kind: 'hold', p: rTo, yaw: Math.PI, y: cy, pose: ( tau ) => M.embrace( tau, 0.35 ) },
		{ t0: tHit, t1: tHit + 0.5, kind: 'fall', p: rTo, yaw: 0, y0: cy, y1: cy + 0.42, pitch: - 1.05, roll: - 0.15, pose0: () => M.embrace( 1, 0.35 ), pose: () => R.inPile( 5 ) },
		{ t0: tHit + 0.5, t1: CEL.pileHold + 12, kind: 'lie', p: rTo, yaw: 0, y: cy + 0.42, pitch: - 1.05, roll: - 0.15, pose: ( tau ) => R.inPile( 5, tau ) },
	);
	// ---- Howard: the dive from the first base side
	if ( howard ) {

		const dir = [ r2, r2 ];
		const root = at( [ dir[ 0 ] * 0.2 + 0.98 * r2, dir[ 1 ] ], 1.25 );
		const approach = at( dir, 3.2 );
		add( howard.id, {} ).steps.push(
			{ t0: 0, t1: howard.react, kind: 'hold', p: howard.from, yaw: yawTo( howard.from, C ), y: 0, pose: ( tau ) => M.jump( tau ) },
			{ t0: howard.react, t1: tHit - 0.35, kind: 'go', a: howard.from, b: approach, gait: 'run' },
			{ t0: tHit - 0.35, t1: tHit + 0.2, kind: 'dive', a: approach, p: root, yaw: yawTo( root, C ), y: cy + 0.8, pitch: - 1.25, roll: 0.2, pose: () => R.inPile( 9 ) },
			{ t0: tHit + 0.2, t1: CEL.pileHold + 11, kind: 'lie', p: root, yaw: yawTo( root, C ), y: cy + 0.8, pitch: - 1.25, roll: 0.2, pose: ( tau ) => R.inPile( 9, tau ) },
		);

	}

	// ---- everyone else, in the order they get there
	people.forEach( ( q, k ) => {

		const S = slot( k );
		const root = at( S.dir, S.r ), approach = at( S.dir, S.r + ( S.kind === 'lie' ? 1.9 : 1.0 ) );
		const yawIn = yawTo( root, C );
		const tA = Math.max( q.arrive, tHit + 0.3 + k * 0.25 );
		const info = add( q.id, { who: q.who, role: q.coach ? ROLE.jacket : PEN.has( q.id ) ? ROLE.jacket : 0 } );
		const st = info.steps;
		// the first beat where they are: fielders jump and throw their arms up, the rest are coming
		if ( q.react > 0.1 ) st.push( { t0: 0, t1: q.react, kind: q.coach || ! POSITIONS_OF( def, q.id ) ? 'none' : 'hold', p: q.from, yaw: yawTo( q.from, C ), y: 0, pose: ( tau ) => M.jump( tau + k ) } );
		const tGo = q.react, tAt = Math.max( tGo + 0.2, tA - ( S.kind === 'lie' ? 0.5 : 0 ) );
		st.push( { t0: tGo, t1: tAt, kind: 'go', a: q.from, b: approach, gait: q.coach && q.speed < 3 ? 'walk' : 'run' } );
		// up in it until it comes apart from the top: the later on, the sooner off
		const tUp = CEL.pileHold + Math.max( 0, 9 - k ) * CEL.upStep * 0.6 + hash( k * 5 ) * 0.8;
		if ( S.kind === 'lie' ) {

			st.push(
				{ t0: tAt, t1: tAt + 0.5, kind: 'dive', a: approach, p: root, yaw: yawIn, y: cy + S.y, pitch: S.pitch, roll: S.roll, pose: () => R.inPile( k + 11 ) },
				{ t0: tAt + 0.5, t1: tUp, kind: 'lie', p: root, yaw: yawIn, y: cy + S.y, pitch: S.pitch, roll: S.roll, pose: ( tau ) => R.inPile( k + 11, tau ) },
			);
			info.freeAt = tUp;
			info.freeP = approach;

		} else if ( S.kind === 'lean' ) {

			st.push( { t0: tAt, t1: tUp - 3, kind: 'hold', p: root, yaw: yawIn, y: 0, pose: ( tau ) => ( Math.floor( tau / 4 + k ) % 2 ? R.kneelIn( tau, hash( k ) ) : M.embrace( tau, 0.1 ) ) } );
			info.freeAt = tUp - 3;
			info.freeP = root;

		} else {

			st.push( { t0: tAt, t1: tUp - 6, kind: 'hold', p: root, yaw: yawIn, y: 0, pose: ( tau ) => ( hash( k * 3 ) < 0.6 ? M.jump( tau + hash( k ) * 3 ) : R.fist( tau, hash( k ) ) ) } );
			info.freeAt = tUp - 6;
			info.freeP = root;

		}

	} );
	// the first three get up last, Lidge at the very last
	L.get( lidge ).freeAt = CEL.pileHold + 13;
	L.get( lidge ).freeP = [ C[ 0 ], C[ 1 ] - 0.3 ];
	L.get( ruiz ).freeAt = CEL.pileHold + 12;
	L.get( ruiz ).freeP = [ C[ 0 ] + 0.6, C[ 1 ] + 0.9 ];
	if ( howard ) {

		L.get( howard.id ).freeAt = CEL.pileHold + 11;
		L.get( howard.id ).freeP = at( [ r2, r2 ], 2.4 );

	}

	// ---- after the pile: the hugs, and off to the stands (then the rest of the night: afterPile)
	afterPile( d, seg, L, def );
	// the clubhouse men come out with the gear, and within a few minutes they're all in the grey champions
	// tee and the black cap (Getty 83571364: being handed round in the scrum; the coaches keep their jackets)
	let n = 0;
	for ( const info of L.values() ) info.tChamps = 50 + hash( n ++ * 7.7 + 3 ) * 60;
	presentation( L, def );
	return L;

}

function POSITIONS_OF( def, id ) {

	return Object.values( def ).includes( id );

}

// the knots they gather in after (the mound, the grass toward the Phillies' dugout, by the plate, the
// third base side of the mound)
const KNOTS = [ { c: [ 2.5, - 14.5 ], r: 1.7 }, { c: [ 12, - 6.5 ], r: 2.0 }, { c: [ - 1.5, - 5 ], r: 1.6 }, { c: [ - 7, - 15 ], r: 1.5 } ];
// what a man does in a knot: arms round the next man, a jump, pointing up to the stands, clapping,
// a word (turning to the one beside him)
function knotPose( tau, n ) {

	const c = Math.floor( tau / 4.5 + hash( n ) * 4 ) % 6;
	if ( c === 0 || c === 3 ) return R.hug( tau, n % 2 ? 1 : - 1, 0 );
	if ( c === 1 ) return M.jump( tau + hash( n ) * 2 );
	if ( c === 2 ) return R.fist( tau, hash( n ) );
	if ( c === 4 ) return R.applaud( tau, n );
	const p = M.stand( tau + n );
	p.head = [ 0.05, 0.6 * Math.sin( tau * 0.5 + n ) ];
	p.glove = false;
	return p;

}

// The first minutes after: pairs find each other (Lidge and Ruiz again, Manuel and Lidge, Howard and
// Utley, Rollins and Victorino, Werth and Feliz, Hamels and Myers), the rest walk out toward the stands
// behind the dugouts and home, waving their caps and pumping their fists at the crowd, and back.
function afterPile( d, seg, L, def ) {

	const pairs = [ [ def.P, def.C, 0 ], [ 'r:manuel', def.P, 8 ], [ def[ '1B' ], def[ '2B' ], 0 ], [ def.SS, def.CF, 0 ], [ def.RF, def[ '3B' ], 0 ], [ 430935, 408206, 0 ], [ 'r:dubee', 425492, 2 ], [ def.LF, 400120, 3 ] ];
	const paired = new Map();
	for ( const [ a, b, lag ] of pairs ) {

		if ( ! L.has( a ) || ! L.has( b ) ) continue;
		const A = L.get( a ), B = L.get( b );
		const t0 = Math.max( A.freeAt, B.freeAt ) + 1.2 + lag;
		// meet halfway between where each got free
		const m = lerp2( A.freeP, B.freeP, 0.5 );
		const dir = yawTo( A.freeP, B.freeP );
		const pa = [ m[ 0 ] - Math.sin( dir ) * - 0.3, m[ 1 ] - Math.cos( dir ) * - 0.3 ];
		const pb = [ m[ 0 ] + Math.sin( dir ) * - 0.3, m[ 1 ] + Math.cos( dir ) * - 0.3 ];
		paired.set( a, { t0, p: pa, face: pb, other: b, side: 1 } );
		paired.set( b, { t0, p: pb, face: pa, other: a, side: - 1 } );

	}

	// where each goes to wave: the stands behind the Phillies' dugout, behind home, the third base side
	const stands = [ [ 24, 1 ], [ 14, 10 ], [ 0, 11.5 ], [ - 14, 10 ], [ - 24, 1 ], [ 34, - 16 ] ];
	let n = 0;
	for ( const [ id, info ] of L ) {

		const st = info.steps;
		const t0 = info.freeAt ?? CEL.freeFrom;
		const from = info.freeP || PILE;
		// getting up out of it (the lying ones) happens in the step evaluator: the 'lie' step ends at freeAt
		let tt = t0 + 0.9, p = from;
		const pr = paired.get( id );
		if ( pr ) {

			st.push( { t0: tt, t1: Math.max( tt + 0.2, pr.t0 ), kind: 'go', a: p, b: pr.p, gait: 'walk' } );
			tt = Math.max( tt + 0.2, pr.t0 );
			st.push( { t0: tt, t1: tt + 6 + hash( n ) * 3, kind: 'hold', p: pr.p, yaw: yawTo( pr.p, pr.face ), y: 0, pose: ( tau ) => R.hug( tau, pr.side, 0 ) } );
			tt = st[ st.length - 1 ].t1;
			p = pr.p;

		}

		// then: one in five out to the stands to wave to the crowd first; everyone into the knots of them on
		// the infield grass (by the mound, toward the dugout, by the plate), arms round each other, jumping,
		// pointing up at the stands (Getty 83571364, pompomflipflop 2985431999)
		if ( n % 5 === 2 ) {

			const [ sx, sz ] = stands[ n % stands.length ];
			const wave = [ sx + ( hash( n * 3 ) - 0.5 ) * 8, sz - 5 - hash( n * 7 ) * 4 ];
			const walk = tt + 0.5, tw = walk + dist( p, wave ) / 1.7;
			st.push( { t0: walk, t1: tw, kind: 'go', a: p, b: wave, gait: 'walk' } );
			const face = [ wave[ 0 ] * 1.6, wave[ 1 ] + 20 ];
			st.push( { t0: tw, t1: tw + 10 + hash( n * 11 ) * 6, kind: 'hold', p: wave, yaw: yawTo( wave, face ), y: 0, pose: ( tau ) => ( Math.floor( tau / 4 + n ) % 2 ? R.fist( tau, hash( n ) ) : R.waveCrowd( tau, hash( n ) ) ) } );
			tt = st[ st.length - 1 ].t1;
			p = wave;

		}

		const K = KNOTS[ n % KNOTS.length ], m = Math.floor( n / KNOTS.length );
		const a = m * 1.1 + hash( n ) * 0.4, rr = K.r + ( m % 2 ) * 0.7;
		const spot = [ K.c[ 0 ] + Math.cos( a ) * rr, K.c[ 1 ] + Math.sin( a ) * rr ];
		const t1 = tt + 0.5, t2 = t1 + dist( p, spot ) / 1.6;
		st.push( { t0: t1, t1: t2, kind: 'go', a: p, b: spot, gait: 'walk' } );
		const inward = yawTo( spot, K.c ), nn = n;
		st.push( { t0: t2, t1: t2 + 400, kind: 'hold', p: spot, yaw: inward, y: moundY( spot[ 0 ], spot[ 1 ] ), pose: ( tau ) => knotPose( tau, nn ) } );
		p = spot;
		info.afterAt = st[ st.length - 1 ].t0;
		info.afterP = p;
		n ++;

	}

	void d; void seg;

}

// The presentation: they gather in front of the stage (inside the barriers, facing it, applauding);
// Manuel goes up for his interview; after the MVP the players go up and Howard lifts the trophy; then
// the lap behind the flag, and the rest stay about the stage.
function presentation( L, def ) {

	const S = STAGE, front = S.D / 2;
	let n = 0;
	const onStage = [ 429667, 430935, 400058, 276519, 400284, 434563 ];
	for ( const [ id, info ] of L ) {

		const st = info.steps;
		const last = st[ st.length - 1 ];
		const from = last.p || last.b || PILE;
		// a place in the crowd in front of it
		const row = Math.floor( n / 9 ), col = n % 9;
		const spot = S.point( - 3.6 + col * 0.95 + ( row % 2 ) * 0.45 + ( hash( n ) - 0.5 ) * 0.3, front + 1.4 + row * 0.95 + hash( n * 3 ) * 0.3 );
		const face = S.point( ( hash( n * 5 ) - 0.5 ) * 2, 0 );
		const t0 = CEL.gather + hash( n * 1.9 ) * 6, t1 = t0 + dist( from, spot ) / 1.5;
		st.push( { t0, t1, kind: 'go', a: from, b: spot, gait: 'walk' } );
		const nn = n;
		st.push( { t0: t1, t1: t1 + 400, kind: 'hold', p: spot, yaw: yawTo( spot, face ), y: 0, pose: ( tau ) => crowdPose( tau + t1, nn ) } );
		let p = spot;
		// Manuel up for his interview
		if ( id === 'r:manuel' ) {

			const top = S.point( 0.4, front - 0.9 );
			const t = climb( st, p, top, CEL.manuel[ 0 ] - 5, S );
			st.push( { t0: t, t1: CEL.manuel[ 1 ], kind: 'hold', p: top, yaw: S.yaw, y: S.H, pose: ( tau ) => manuelPose( tau ) } );
			st.push( { t0: CEL.manuel[ 1 ], t1: CEL.manuel[ 1 ] + 400, kind: 'hold', p: top, yaw: S.yaw, y: S.H, pose: ( tau ) => R.applaud( tau, 3 ) } );

		}

		// Moyer: out to the mound while the stage is going up, down on his knees digging the rubber out, then
		// up with it in both hands for the cameras (Getty 83571213)
		if ( id === MOYER.id ) {

			const at = [ RUBBER[ 0 ] + 0.2, RUBBER[ 2 ] + 0.75 ];
			const t0m = CEL.moyer[ 0 ], t1m = t0m + dist( p, at ) / 1.5;
			st.push( { t0: t0m, t1: t1m, kind: 'go', a: p, b: at, gait: 'walk' } );
			st.push( { t0: t1m, t1: CEL.moyer[ 1 ], kind: 'hold', p: at, yaw: Math.PI, y: moundY( at[ 0 ], at[ 1 ] ), pose: ( tau ) => R.kneelIn( tau * 1.6, 0.3 ) } );
			st.push( { t0: CEL.moyer[ 1 ], t1: CEL.moyer[ 1 ] + 400, kind: 'hold', p: at, yaw: 0.4, y: moundY( at[ 0 ], at[ 1 ] ), pose: ( tau ) => R.holdChest( tau ) } );
			p = at;

		}

		// the players up after the MVP; Howard with it over his head
		const k = onStage.indexOf( id );
		if ( k >= 0 ) {

			const top = S.point( - 2.2 + k * 0.85, front - 1.1 - ( k % 2 ) * 0.5 );
			const tt = climb( st, p, top, CEL.up + k * 1.2, S );
			const howard = id === 429667;
			st.push( { t0: tt, t1: CEL.lap[ 0 ] - 3, kind: 'hold', p: top, yaw: S.yaw, y: S.H, pose: ( tau ) => ( howard && tau > 2 ? R.holdHigh( tau, 1 ) : R.fist( tau, hash( k ) ) ) } );
			p = top;

		}

		// the lap: behind the flag round the track; the others stay about the stage
		const lk = LAP_MEN.indexOf( id );
		if ( lk >= 0 ) {

			const off = [ ( lk % 3 - 1 ) * 1.3, Math.floor( lk / 3 ) * 1.4 ];
			let t2 = CEL.lap[ 0 ] + lk * 0.3;
			// (down off the stage first)
			if ( k >= 0 ) {

				t2 = Math.max( t2, descend( st, p, CEL.lap[ 0 ] - 3, S ) );
				p = S.point( S.W / 2 + 0.5, S.D / 2 + 0.6 );

			}

			st.push( { t0: t2, kind: 'lap', off, from: p, t1: CEL.lap[ 1 ], flag: id === 408206, trophy: id === 429667, n: lk } );

		}

		n ++;

	}

	void def;

}

// up the stage's stairs from p to the top spot: returns when he's there
function climb( st, p, top, t0, S ) {

	const foot = S.point( S.W / 2 + 0.5, S.D / 2 + 0.6 ), step = S.point( S.W / 2 + 0.5, S.D / 2 - 1.3 );
	const t1 = t0 + dist( p, foot ) / 1.6, t2 = t1 + 1.6, t3 = t2 + dist( step, top ) / 1.4;
	st.push( { t0, t1, kind: 'go', a: p, b: foot, gait: 'walk' } );
	st.push( { t0: t1, t1: t2, kind: 'stairs', a: foot, b: step, y0: 0, y1: S.H } );
	st.push( { t0: t2, t1: t3, kind: 'go', a: step, b: top, gait: 'walk', y: S.H } );
	return t3;

}

// down the stairs from the stage's top spot p to their foot: returns when he's there
function descend( st, p, t0, S ) {

	const foot = S.point( S.W / 2 + 0.5, S.D / 2 + 0.6 ), step = S.point( S.W / 2 + 0.5, S.D / 2 - 1.3 );
	const t1 = t0 + dist( p, step ) / 1.4, t2 = t1 + 1.6;
	st.push( { t0, t1, kind: 'go', a: p, b: step, gait: 'walk', y: S.H } );
	st.push( { t0: t1, t1: t2, kind: 'stairs', a: step, b: foot, y0: S.H, y1: 0 } );
	return t2;

}

// in the crowd in front of the stage: applauding, a word to the next man, now and then a fist up
function crowdPose( t, n ) {

	const c = Math.floor( t / 6 + hash( n ) * 5 ) % 5;
	if ( c === 0 || c === 3 ) return R.applaud( t, n );
	if ( c === 1 ) return R.fist( t, hash( n ) );
	const p = M.stand( t + n );
	p.head = [ 0.0, 0.5 * Math.sin( t * 0.4 + n ) ];
	p.glove = false;
	return p;

}

// Manuel with FOX's microphone (Getty 83570999: talking, then the finger up at the crowd)
function manuelPose( tau ) {

	const p = M.stand( tau );
	p.handR = [ 0.12, 1.55, - 0.2 ];
	p.handL = tau > 7 && tau < 11 ? [ - 0.3, 2.05, - 0.15 ] : [ - 0.22, 0.95, 0.0 ];
	p.head = [ tau > 7 && tau < 11 ? - 0.35 : 0.0, 0.3 * Math.sin( tau * 0.5 ) ];
	p.glove = false;
	return p;

}

// where on the lap's path at a distance d along it (and which way)
export function lapAt( d ) {

	let r = d;
	for ( let i = 0; i < LAP.length - 1; i ++ ) {

		const l = dist( LAP[ i ], LAP[ i + 1 ] );
		if ( r <= l ) return { p: lerp2( LAP[ i ], LAP[ i + 1 ], r / l ), yaw: yawTo( LAP[ i ], LAP[ i + 1 ] ) };
		r -= l;

	}

	return { p: LAP[ LAP.length - 1 ], yaw: yawTo( LAP[ LAP.length - 2 ], LAP[ LAP.length - 1 ] ), end: true };

}
export const LAP_SPEED = 1.35;

// ---------------------------------------------------------------- showing it

// a step at time t -> { x, z, yaw, pose, y, tilt } (or null: not on the field)
function evalSteps( steps, t, info ) {

	let s = null;
	for ( const q of steps ) if ( t >= q.t0 ) s = q; else break;
	if ( ! s ) return null;
	const tau = t - s.t0, k = s.t1 > s.t0 ? Math.min( 1, tau / ( s.t1 - s.t0 ) ) : 1;
	if ( s.kind === 'none' ) return null;
	if ( s.kind === 'hold' ) return { x: s.p[ 0 ], z: s.p[ 1 ], yaw: s.yaw, y: s.y || 0, pose: s.pose( tau ) };
	if ( s.kind === 'stairs' ) {

		const p = lerp2( s.a, s.b, k );
		const pose = R.walk( dist( s.a, s.b ) * k / 1.6 );
		return { x: p[ 0 ], z: p[ 1 ], yaw: yawTo( s.a, s.b ), y: s.y0 + ( s.y1 - s.y0 ) * k, pose };

	}

	if ( s.kind === 'lap' ) {

		// out to the start of the lap, then round behind the flag at a walk, waving to the stands
		const start = LAP[ 0 ];
		const lead = dist( s.from, start );
		const tau2 = tau * LAP_SPEED - lead;
		if ( tau2 < 0 ) {

			const p = lerp2( s.from, start, tau * LAP_SPEED / Math.max( 0.01, lead ) );
			return { x: p[ 0 ], z: p[ 1 ], yaw: yawTo( s.from, start ), y: 0, pose: R.walk( tau * LAP_SPEED / 2.3 ) };

		}

		const w = lapAt( Math.max( 0, tau2 - s.off[ 1 ] ) );
		const side = [ Math.cos( w.yaw ), - Math.sin( w.yaw ) ];
		const x = w.p[ 0 ] + side[ 0 ] * s.off[ 0 ], z = w.p[ 1 ] + side[ 1 ] * s.off[ 0 ];
		const pose = w.end ? M.stand( t ) : R.walk( tau2 / 2.3 );
		// Myers with the flag held up on its pole, Howard with the trophy, the rest now and then waving
		if ( s.flag ) { pose.handR = [ 0.12, 1.75, - 0.2 ]; pose.handL = [ 0.08, 1.2, - 0.22 ]; }
		else if ( s.trophy ) { pose.handL = [ - 0.13, 2.0, - 0.1 ]; pose.handR = [ 0.13, 2.0, - 0.1 ]; }
		else if ( Math.floor( tau / 3 + s.n ) % 3 === 0 ) pose.handR = [ 0.35, 1.95, - 0.1 ];
		pose.glove = false;
		return { x, z, yaw: w.yaw, y: 0, pose };

	}

	if ( s.kind === 'go' ) {

		if ( k >= 1 ) return { x: s.b[ 0 ], z: s.b[ 1 ], yaw: yawTo( s.a, s.b ), y: s.y ?? moundY( s.b[ 0 ], s.b[ 1 ] ), pose: M.stand( t ) };
		const p = lerp2( s.a, s.b, k );
		const L = dist( s.a, s.b ) * k;
		const pose = s.gait === 'walk' ? R.walk( L / 2.3 ) : M.run( L / 3.4, 0.9 );
		pose.glove = false;
		return { x: p[ 0 ], z: p[ 1 ], yaw: yawTo( s.a, s.b ), y: s.y ?? moundY( p[ 0 ], p[ 1 ] ), pose };

	}

	if ( s.kind === 'dive' || s.kind === 'fall' ) {

		const e = ease( k );
		const a = s.a || s.p;
		const p = lerp2( a, s.p, e );
		const y0 = s.y0 ?? moundY( a[ 0 ], a[ 1 ] );
		const y1 = s.y1 ?? s.y;
		const y = y0 + ( y1 - y0 ) * e + ( s.kind === 'dive' ? Math.sin( Math.PI * k ) * 0.5 : 0 );
		const pose = s.pose0 ? M.blend( s.pose0(), s.pose(), e ) : M.blend( M.run( 0.3, 1 ), s.pose(), e );
		pose.glove = false;
		return { x: p[ 0 ], z: p[ 1 ], yaw: s.yaw, y, pose, tilt: tiltOf( s.pitch * e, s.roll * e ) };

	}

	if ( s.kind === 'lie' ) {

		// getting up at the end of it: over the last 0.8 s back onto his feet beside it
		const up = info.freeAt != null && s.t1 === info.freeAt ? 0 : 0;
		void up;
		return { x: s.p[ 0 ], z: s.p[ 1 ], yaw: s.yaw, y: s.y, pose: s.pose( tau ), tilt: tiltOf( s.pitch, s.roll ) };

	}

	return null;

}

// between a lying step's end and the next step: getting up
function gettingUp( steps, t ) {

	for ( let i = 0; i < steps.length - 1; i ++ ) {

		const s = steps[ i ], n = steps[ i + 1 ];
		if ( s.kind !== 'lie' || t < s.t1 || t >= n.t0 ) continue;
		const k = Math.min( 1, ( t - s.t1 ) / 0.9 ), e = ease( k );
		const to = n.a || n.p;
		const p = lerp2( s.p, to, e );
		const pose = M.blend( s.pose( s.t1 - s.t0 ), M.stand( t ), e );
		pose.glove = false;
		return { x: p[ 0 ], z: p[ 1 ], yaw: s.yaw, y: s.y * ( 1 - e ) + moundY( p[ 0 ], p[ 1 ] ) * e, pose, tilt: tiltOf( s.pitch * ( 1 - e ), s.roll * ( 1 - e ) ) };

	}

	return null;

}

// Where the trophy is when a player has it (Howard, over his head on the stage and on the lap): from his
// hands (the pose's, in his frame, turned by his yaw and scaled by his height), or null
export function trophyHold( d, lt ) {

	const id = 429667, a = d.actors?.get( id );
	if ( ! a || lt < CEL.up ) return null;
	const pz = a.pose;
	if ( ! pz || pz.handL[ 1 ] < 1.8 || pz.handR[ 1 ] < 1.8 ) return null;
	const h = d._height ? d._height( id ) : 1;
	const lx = ( pz.handL[ 0 ] + pz.handR[ 0 ] ) / 2 * h, ly = ( pz.handL[ 1 ] + pz.handR[ 1 ] ) / 2 * h, lz = ( pz.handL[ 2 ] + pz.handR[ 2 ] ) / 2 * h;
	const c = Math.cos( a.yaw ), sn = Math.sin( a.yaw );
	return { x: a.x + lx * c + lz * sn, y: ( a.y || 0 ) + ly - 0.05, z: a.z - lx * sn + lz * c, yaw: a.yaw };

}

// the rubber: in the ground until Moyer has it out (null), then in his hands ({ x, y, z, yaw })
export function rubberHold( d, lt ) {

	if ( lt < CEL.moyer[ 1 ] ) return null;
	const a = d.actors?.get( MOYER.id );
	if ( ! a ) return 'hole';
	const c = Math.cos( a.yaw ), sn = Math.sin( a.yaw ), lz = - 0.34;
	return { x: a.x + lz * sn, y: ( a.y || 0 ) + 1.14, z: a.z + lz * c, yaw: a.yaw };

}

// the flag on the lap: Myers's hands on its pole ({ x, y, z, yaw }), or null
export function flagHold( d, lt ) {

	if ( lt < CEL.lap[ 0 ] ) return null;
	const a = d.actors?.get( 408206 );
	const pz = a?.pose;
	if ( ! pz || pz.handR[ 1 ] < 1.6 ) return null;
	const h = d._height ? d._height( 408206 ) : 1;
	const c = Math.cos( a.yaw ), sn = Math.sin( a.yaw ), lx = pz.handR[ 0 ] * h, lz = pz.handR[ 2 ] * h;
	return { x: a.x + lx * c + lz * sn, y: ( a.y || 0 ) + pz.handR[ 1 ] * h, z: a.z - lx * sn + lz * c, yaw: a.yaw };

}

export function showCelebration( d, seg, lt ) {

	const s = seg.snap;
	const L = seg._rituals ||= plan( d, seg );
	for ( const [ id, info ] of L ) {

		let a = gettingUp( info.steps, lt ) || evalSteps( info.steps, lt, info );
		if ( ! a ) continue;
		let role = info.role ?? 0;
		if ( lt > info.tChamps ) role = role & ROLE.jacket ? role | ROLE.champCap : ( role & ~ ( ROLE.gear | ROLE.ccap ) ) | ROLE.tee | ROLE.champCap;
		const extra = { y: a.y || 0, tilt: a.tilt || null, role };
		if ( info.who ) extra.who = info.who;
		// the Phillies' mud: their night's dirt as it was
		d.act( id, a.x, a.z, a.yaw, a.pose, extra );

	}

	// the Rays leave the field: Hinske from the box, the runners from the bases, the umpires off
	const out = [ [ s.batter, boxFor( s.bats ) ] ];
	s.bases.forEach( ( id, b ) => id && out.push( [ id, BASES[ b + 1 ] ] ) );
	for ( const [ id, from ] of out ) {

		const to = DUGOUT.away;
		const k = Math.min( 1, lt * 1.6 / dist( from, to ) );
		if ( k >= 1 ) continue;
		const p = lerp2( from, to, k );
		d.act( id, p[ 0 ], p[ 1 ], yawTo( from, to ), R.walk( lt * 0.7 ) );

	}

	for ( const [ id, a ] of UMP_AT ) {

		const t0 = 2 + ( - id ) * 0.3;
		if ( lt < t0 ) {

			const pose = M.stand( lt + id );
			pose.glove = false;
			d.act( id, a[ 0 ], a[ 1 ], yawTo( a, PILE ), pose, { role: id === - 1 ? ROLE.bag : 0 } );
			continue;

		}

		// round the pile, not through it
		const via = a[ 0 ] > 0 ? [ 9, - 6 ] : [ - 9, - 6 ];
		const legs = [ a, via, UMP_DOOR ];
		const L0 = dist( a, via ), L1 = dist( via, UMP_DOOR ), dd = ( lt - t0 ) * 1.8;
		if ( dd >= L0 + L1 ) continue;
		const p = dd < L0 ? lerp2( a, via, dd / L0 ) : lerp2( via, UMP_DOOR, ( dd - L0 ) / L1 );
		const yaw = dd < L0 ? yawTo( a, via ) : yawTo( via, UMP_DOOR );
		void legs;
		d.act( id, p[ 0 ], p[ 1 ], yaw, R.walk( dd / 2.3 ), { role: id === - 1 ? ROLE.bag : 0 } );

	}

}

export { BULLPEN };
