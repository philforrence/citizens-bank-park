import { Quaternion, Euler } from '../../engine/index.js';
import * as M from './Motions.js';
import * as R from './RitualMoves.js';
import { ROLE } from './Players.js';
import { POSITIONS, BASES, MOUND, DUGOUT, BULLPEN, boxFor, polar, dist, lerp2, yawTo } from './Plays.js';
import { moundY } from './TarpPlan.js';
import { neutralPose, DIM } from './Rig.js';
import { OUTFIELD, FT, DUGOUTS } from '../layout.js';

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
	// (FB3, C3B-3: the party out at 86, not 114: it's a 38 m walk from the first base side's gate, so they
	// were still on the infield when Selig began at 126 and handed over the trophy at 140; now they're up
	// from 120 to 125, all at the microphones when it starts, as FOX US's sheet 131 has them)
	stageBuild: [ 60, 100 ], carIn: [ 96, 112 ], trophyOut: 112, party: 86, gather: 120,
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
	// ---- FR1: the way the men on it face: out of its front, to the plate and the stands (+lz; a man's yaw
	// faces -z turned by it, so the stage's own yaw would have them looking out to right-center with their
	// backs to everyone: Getty 83570999 and 83486403, ronniebruce 2988347232, FOX's interview frames, all
	// faces and the trophy held up to the stands)
	face: STAGE_YAW + Math.PI,
	// the stairs at the stage's left-hand end as you face it, by the trophy's pedestal (ronniebruce
	// 2988347232 from above and Getty 83570999 from in front: the steps and their handrails off the left end,
	// the far end railed and the red Camaro beside it): the foot of them out in front, the top step
	stairs: { foot: [ - 3.7, 2.2 ], step: [ - 3.7, 0.3 ] },
	// ---- end FR1
};
// ---- FR1: the MVP presented on the clay in front of the red Camaro, not on the stage (Getty 83486314:
// Selig with the silver MVP trophy, Hamels, FOX's Chris Myers with the microphone and Chevrolet's man in
// black, the car behind them; FOX US 1yP3u4ik2gs, the Chevy MVP presentation): the four in a row facing
// the plate, left to right as you look at them; and the trophy on the car's hood till Selig takes it up
const _mvpC = STAGE.point( 8.8, 5.3 ), _mvpYaw = yawTo( _mvpC, [ - 2, 4 ] );
const _mvpAt = ( k ) => [ _mvpC[ 0 ] + Math.cos( _mvpYaw ) * k, _mvpC[ 1 ] - Math.sin( _mvpYaw ) * k ];
export const MVP = {
	yaw: _mvpYaw, selig: _mvpAt( 1.0 ), hamels: _mvpAt( 0.25 ), cmyers: _mvpAt( - 0.55 ), chevy: _mvpAt( - 1.4 ),
	// when Selig hands it over (his words first), and where it waits: on the hood, nose out
	hand: CEL.mvp[ 0 ] + 5,
	hood: [ STAGE.car[ 0 ] - Math.sin( STAGE.carYaw ) * 1.55, 0.97, STAGE.car[ 1 ] - Math.cos( STAGE.carYaw ) * 1.55 ],
};
// ---- end FR1
// the lap (ronniebruce 2987488477, 2988346732: the players in their grey tees behind the big red flag, a
// motor officer out front, round the warning track from the right field corner toward left)
// ---- FB3 (C3B-2): on the track, 2.7 m in from the wall at each angle (OUTFIELD's fence, the angle from
// the center field line): the straight legs between hand-placed points cut behind the right-center wall,
// so for the lap's last twenty seconds the men and the flag were out of sight behind it, and every camera
// on them showed the padding (C3B's C-cel-283, B-lap-281.5)
const fenceR = ( th ) => {

	for ( let i = 0; i < OUTFIELD.length - 1; i ++ ) {

		const [ a0, d0 ] = OUTFIELD[ i ], [ a1, d1 ] = OUTFIELD[ i + 1 ];
		if ( a1 !== a0 && th >= a0 && th <= a1 ) return ( d0 + ( d1 - d0 ) * ( th - a0 ) / ( a1 - a0 ) ) * FT;

	}

	return 100;

};
const onTrack = ( th ) => {

	const r = fenceR( th ) - 2.7, a = th * Math.PI / 180;
	return [ r * Math.sin( a ), - r * Math.cos( a ) ];

};
export const LAP = [ [ 30, - 26 ], [ 50, - 46 ], onTrack( 38 ), onTrack( 31 ), onTrack( 24.5 ), onTrack( 18.42 ), onTrack( 14.5 ), onTrack( 11 ), onTrack( 5 ), onTrack( 0 ), onTrack( - 4.96 ), onTrack( - 10.27 ), onTrack( - 14.37 ), onTrack( - 17.92 ), onTrack( - 23 ) ];
// ---- end FB3
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
// (FB2, C2B-5: the second base umpire where the Director has him at the last pitch, Perez on second:
// inside on the shortstop side)
const UMP_AT = [
	[ - 1, [ 0.35, 2.05 ] ], [ - 2, [ 19.4 + 2.2 * r2 + 1.2 * r2, - 19.4 - 2.2 * r2 + 1.2 * r2 ] ], [ - 3, [ - 9, - 30 ] ],
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
// ---- FB4 (C4B-3): the Phillies' dugout (layout's DUGOUTS.first, as Field.js builds it): s along it from
// its home plate end, t back from the field's edge. The rail stands on the upper step 0.55 m back, the
// step 0.4 m down; its covered stretch is 2.2 m from the home end to 6 m from the far one (DUGOUT_ZONES)
const [ DGA, DGB ] = DUGOUTS.first;
const DG_LEN = Math.hypot( DGB[ 0 ] - DGA[ 0 ], DGB[ 1 ] - DGA[ 1 ] );
const DG_U = [ ( DGB[ 0 ] - DGA[ 0 ] ) / DG_LEN, ( DGB[ 1 ] - DGA[ 1 ] ) / DG_LEN ], DG_N = [ - DG_U[ 1 ], DG_U[ 0 ] ];
const dugAt = ( s, t ) => [ DGA[ 0 ] + DG_U[ 0 ] * s + DG_N[ 0 ] * t, DGA[ 1 ] + DG_U[ 1 ] * s + DG_N[ 1 ] * t ];
// ---- end FB4

// the pile's shape: slot k after the first three. (FY2, CY-16: it was a flat starburst of men lying like
// spokes, ringed by men with their arms out. FOX's high first base and center field shots of the 29th
// show a tight, tall scrum: men on top of men, mostly upright or bent over, heaped a metre and a half to
// two high in the middle, the red jackets of the bench and the pen pushing in from outside.) The ones on
// it lean in on the middle at forty to fifty degrees, each layer higher and further out, their heads
// together over Lidge; then men bent over the backs of the ones in front, pressing in; then a ring
// round it jumping and pumping their fists
function slot( k ) {

	const a = k * 2.39996 + 0.7;
	const dir = [ Math.cos( a ), Math.sin( a ) ];
	// ---- FR2: grounded, as Getty 84082573 has it: Lidge and Ruiz down on the grass, the rest leaping in
	// and coming down on their feet, bent right over the backs of the men in the middle, arms round them,
	// pressing in, the first ones furthest over (they were pitched 40-55 degrees about their feet with the
	// feet raised up to 0.9 m: men floating flat in the air over Lidge, legs dangling)
	if ( k < 9 ) {

		const layer = Math.floor( k / 3 );
		const r = 1.05 + 0.08 * ( k % 3 ) + 0.16 * layer;
		return { kind: 'lie', dir, r, y: 0.01, pitch: - ( 0.62 + 0.18 * hash( k + 3 ) ) + 0.1 * layer, roll: ( hash( k + 7 ) - 0.5 ) * 0.3, arc: layer === 0 ? 0.42 : 0.2, press: true };

	}

	if ( k < 19 ) return { kind: 'lean', dir, r: 1.55 + 0.2 * hash( k ) };
	return { kind: 'ring', dir, r: 2.05 + 0.5 * hash( k * 1.7 ) };

}

// pressing in on the pile: bent over the backs of the men in front, the arms round them, bouncing
function pressIn( tau, h ) {

	const b = Math.sin( tau * 6.5 + h * 6 ) * 0.5 + 0.5;
	return Object.assign( neutralPose(), {
		pelvisY: DIM.hip - 0.07 - 0.04 * b, pelvisZ: 0.06, pelvis: [ - 0.3, 0.1 * ( h - 0.5 ), 0 ], torso: [ - 0.4 - 0.12 * b, 0.25 * ( h - 0.5 ), 0.06 * ( h - 0.5 ) ], head: [ 0.3, 0.3 * ( h - 0.5 ) ],
		footL: [ - 0.17, 0.08, 0.16 ], footR: [ 0.17, 0.08, - 0.06 ], footYawL: 0.2, footYawR: - 0.2,
		handL: [ - 0.28, 1.12 + 0.06 * b, - 0.62 ], handR: [ 0.3, 1.18 + 0.06 * b, - 0.64 ], glove: false,
	} );

}

const at = ( dir, r ) => [ PILE[ 0 ] + dir[ 0 ] * r, PILE[ 1 ] + dir[ 1 ] * r ];
const _q = new Quaternion(), _e = new Euler( 0, 0, 0, 'YXZ' );
const tiltOf = ( pitch, roll ) => new Quaternion().setFromEuler( _e.set( pitch, 0, roll, 'YXZ' ) );

// ---------------------------------------------------------------- the plan

function plan( d, seg ) {

	const P = d.game.players, s = seg.snap, def = s.defense;
	const L = new Map();
	const add = ( id, info ) => {

		// (FB3, C3B-14: each man on his own stride: a phase and a stride length of his own, or men who set
		// off together run and walk in step the whole way, like a drill team)
		const n = typeof id === 'number' ? id : String( id ).split( '' ).reduce( ( h, ch ) => ( h * 31 + ch.charCodeAt( 0 ) ) % 100003, 7 );
		const e = { id, steps: [], phase: hash( n * 1.37 + 0.5 ), stride: 0.92 + 0.16 * hash( n * 2.71 + 0.3 ), ...info };
		L.set( id, e );
		return e;

	};
	// who's where at the last out
	const people = [];
	for ( const pos of [ '1B', '3B', '2B', 'SS', 'LF', 'CF', 'RF' ] ) if ( def[ pos ] ) people.push( { id: def[ pos ], from: POSITIONS[ pos ], react: 0.55 + hash( def[ pos ] ) * 0.4, speed: 7.6, field: true } );
	// ---- FB4 (C4B-3): the bench, the pen, Moyer and the coaches on the strike's clock, as the fielders are
	// (`field`): over the dugout's rail within a second or two of strike three and across the grass at a
	// sprint, most of them in the red pullover (Getty 83486175, 3-5 s after the out: Lidge and Ruiz just off
	// the mound, a stream of fifteen in red jackets and pinstripes pouring out over the foul line, arms up).
	// They'd come out on the celebrate segment's clock, 3.6 s late, 5-7 s after the strike, and since the
	// dugout's figures go at the strike (FX1) it emptied into nothing. Now they're the rig's men at the
	// rail from the strike, where FieldLevel's were, jumping, then over it. The pen's out of its gate as its
	// figures go (alley/Night.js: at the strike too)
	const inDugout = [];
	for ( const id of seg.plan.bench ) {

		if ( PEN.has( id ) ) people.push( { id, from: polar( 6 + ( hash( id ) - 0.5 ) * 4, 398 ), react: 0.8 + hash( id ) * 1.6, speed: 7.2, field: true } );
		else inDugout.push( people[ people.push( { id, react: 0.3 + hash( id * 3 ) * 1.3, speed: 6.8, field: true, jacket: hash( id * 5.1 ) < 0.75 } ) - 1 ] );

	}

	// Jamie Moyer (not in the box score's roster here: the Game 3 starter, 45, from Souderton, who'd
	// skipped school for the 1980 parade)
	inDugout.push( people[ people.push( { id: MOYER.id, who: MOYER.who, react: 1.1, speed: 6.2, field: true } ) - 1 ] );
	for ( const c of STAFF ) {

		const f = c.from === 'pen' ? polar( 6 + ( hash( c.id.length ) - 0.5 ) * 3, 398 ) : null;
		const q = { id: c.id, who: c.who, from: f, react: c.slow ? 4.5 : c.from === 'pen' ? 1.5 + hash( c.id.length * 9 ) * 2 : 1.6 + hash( c.id.length * 9 ) * 2.4, speed: c.slow ? 2.4 : 4.6, coach: true, field: true };
		people.push( q );
		if ( ! f ) inDugout.push( q );

	}

	// at the rail along the covered stretch, in no order, a metre apart; out onto the field over it (the
	// coaches slower)
	inDugout.forEach( ( q, j ) => {

		const sAt = 3.0 + ( DG_LEN - 9.6 ) * ( ( ( j * 7 ) % inDugout.length ) + 0.5 + ( hash( j * 3.3 ) - 0.5 ) * 0.4 ) / inDugout.length;
		q.rail = dugAt( sAt, 0.68 );
		q.from = dugAt( sAt + ( hash( j * 1.9 ) - 0.5 ) * 0.6, - 0.45 );
		q.out = q.coach ? 1.0 : 0.55;

	} );
	// ---- end FB4

	// the order they get there (the first three are Lidge, Ruiz and Howard)
	for ( const q of people ) q.arrive = q.react + ( q.out || 0 ) + Math.max( 0, dist( q.from, PILE ) - 2.2 ) / q.speed;
	people.sort( ( a, b ) => a.arrive - b.arrive );
	// Howard's there first of them (and dives); the rest take the slots in order
	const hi = people.findIndex( ( q ) => q.id === def[ '1B' ] );
	const howard = hi >= 0 ? people.splice( hi, 1 )[ 0 ] : null;

	// ---- Lidge
	const C = PILE, cy = moundY( C[ 0 ], C[ 1 ] );
	const lidge = def.P, ruiz = def.C;
	const tHit = 3.3;
	// (FB3, C3B-1: `field`: on the field at the last out, so on the strike's clock: showLastOut)
	add( lidge, { field: true } ).steps.push(
		{ t0: 0, t1: 0.4, kind: 'hold', p: C, yaw: Math.PI, y: cy, pose: ( tau ) => M.jump( tau ) },
		{ t0: 0.4, t1: tHit, kind: 'hold', p: C, yaw: Math.PI, y: cy, pose: ( tau ) => M.kneel( tau ) },
		// over backward under Ruiz and Howard
		{ t0: tHit, t1: tHit + 0.5, kind: 'fall', p: C, yaw: Math.PI, y0: cy, y1: cy + 0.1, pitch: 1.15, roll: 0.1, pose0: () => M.kneel( 3 ), pose: () => R.inPile( 2 ) },
		{ t0: tHit + 0.5, t1: CEL.pileHold + 13, kind: 'lie', p: C, yaw: Math.PI, y: cy + 0.1, pitch: 1.15, roll: 0.1, pose: ( tau ) => R.inPile( 2, tau ) },
	);
	// ---- Ruiz: from behind the plate in his gear, the mask off, the arms round him; down on top of him
	// (FB3, C3B-1: he comes in on Lidge's left, as FOX's center field camera had him at the side of the
	// picture (sheet 125), and holds him facing him: he faced the plate, his back to Lidge)
	const rTo = [ C[ 0 ], C[ 1 ] + 0.55 ], rIn = [ C[ 0 ] - 0.42, C[ 1 ] + 0.5 ];
	add( ruiz, { role: ROLE.gear | ROLE.ccap, field: true } ).steps.push(
		{ t0: 0, t1: 2.4, kind: 'go', a: POSITIONS.C, b: rIn, gait: 'run' },
		{ t0: 2.4, t1: tHit, kind: 'hold', p: rIn, yaw: yawTo( rIn, C ), y: cy, pose: ( tau ) => M.embrace( tau, 0.35 ) },
		// (---- FR2: down on top of him, his knees on the grass: not 0.4 m up)
		{ t0: tHit, t1: tHit + 0.5, kind: 'fall', a: rIn, p: rTo, yaw: yawTo( rIn, C ), y0: cy, y1: cy + 0.14, pitch: - 1.18, roll: - 0.15, pose0: () => M.embrace( 1, 0.35 ), pose: () => R.inPile( 5 ) },
		{ t0: tHit + 0.5, t1: CEL.pileHold + 12, kind: 'lie', p: rTo, yaw: yawTo( rIn, C ), y: cy + 0.14, pitch: - 1.18, roll: - 0.15, pose: ( tau ) => R.inPile( 5, tau ) },
	);
	// ---- Howard: the dive from the first base side
	if ( howard ) {

		const dir = [ r2, r2 ];
		const root = at( [ dir[ 0 ] * 0.2 + 0.98 * r2, dir[ 1 ] ], 1.25 );
		const approach = at( dir, 3.2 );
		add( howard.id, { field: true } ).steps.push(
			{ t0: 0, t1: howard.react, kind: 'hold', p: howard.from, yaw: yawTo( howard.from, C ), y: 0, pose: ( tau ) => M.jump( tau ) },
			{ t0: howard.react, t1: tHit - 0.35, kind: 'go', a: howard.from, b: approach, gait: 'run' },
			// (---- FR2: a leap, coming down on his feet bent right over the two of them, arms round them: not
			// lying 0.8 m up with his legs out behind)
			{ t0: tHit - 0.35, t1: tHit + 0.2, kind: 'dive', a: approach, p: root, yaw: yawTo( root, C ), y: moundY( root[ 0 ], root[ 1 ] ), pitch: - 0.82, roll: 0.15, arc: 0.5, pose: () => pressIn( 0, 0.3 ) },
			{ t0: tHit + 0.2, t1: CEL.pileHold + 11, kind: 'lie', p: root, yaw: yawTo( root, C ), y: moundY( root[ 0 ], root[ 1 ] ), pitch: - 0.82, roll: 0.15, pose: ( tau ) => pressIn( tau, 0.3 ) },
		);

	}

	// ---- everyone else, in the order they get there
	people.forEach( ( q, k ) => {

		const S = slot( k );
		const root = at( S.dir, S.r ), approach = at( S.dir, S.r + ( S.kind === 'lie' ? 1.9 : 1.0 ) );
		const yawIn = yawTo( root, C );
		const tA = Math.max( q.arrive, tHit + 0.3 + k * 0.25 );
		const info = add( q.id, { who: q.who, role: q.coach || q.jacket ? ROLE.jacket : PEN.has( q.id ) ? ROLE.jacket : 0, field: !! q.field, bench: !! q.jacket } );
		const st = info.steps;
		// the first beat where they are: fielders jump and throw their arms up, the rest are coming
		// (---- FB4: the dugout at its rail, the players jumping, the coaches applauding; then over it)
		if ( q.rail ) {

			const yawOut = yawTo( q.rail, q.from );
			st.push( { t0: 0, t1: q.react, kind: 'hold', p: q.rail, yaw: yawOut, y: - 0.4, pose: q.coach ? ( tau ) => R.applaud( tau, hash( k ) ) : ( tau ) => M.jump( tau + hash( k ) * 2 ) } );
			st.push( { t0: q.react, t1: q.react + q.out, kind: 'vault', a: q.rail, b: q.from, y0: - 0.4, y1: 0, arc: 0.85 } );

		} else if ( q.react > 0.1 ) st.push( { t0: 0, t1: q.react, kind: q.coach || ! POSITIONS_OF( def, q.id ) ? 'none' : 'hold', p: q.from, yaw: yawTo( q.from, C ), y: 0, pose: ( tau ) => M.jump( tau + k ) } );
		const tGo = q.react + ( q.out || 0 ), tAt = Math.max( tGo + 0.2, tA - ( S.kind === 'lie' ? 0.5 : 0 ) );
		// (---- FB4: to his place in the ring or bent over the backs, not a metre outside it: they'd stopped
		// at `approach` and stood at their place the next frame, a metre's jump; the divers leap from it)
		st.push( { t0: tGo, t1: tAt, kind: 'go', a: q.from, b: S.kind === 'lie' ? approach : root, gait: q.coach && q.speed < 3 ? 'walk' : 'run' } );
		// up in it until it comes apart from the top: the later on, the sooner off
		const tUp = CEL.pileHold + Math.max( 0, 9 - k ) * CEL.upStep * 0.6 + hash( k * 5 ) * 0.8;
		if ( S.kind === 'lie' ) {

			// (---- FR2: the ones lunging in bent over the backs, pressing; the ones on top sprawled)
			const lie = S.press ? ( tau ) => pressIn( tau, hash( k * 2.3 ) ) : ( tau ) => R.inPile( k + 11, tau );
			const ground = S.press ? moundY( root[ 0 ], root[ 1 ] ) : cy;
			st.push(
				{ t0: tAt, t1: tAt + 0.5, kind: 'dive', a: approach, p: root, yaw: yawIn, y: ground + S.y, pitch: S.pitch, roll: S.roll, arc: S.arc, pose: () => lie( 0 ) },
				{ t0: tAt + 0.5, t1: tUp, kind: 'lie', p: root, yaw: yawIn, y: ground + S.y, pitch: S.pitch, roll: S.roll, pose: lie },
			);
			info.freeAt = tUp;
			info.freeP = approach;

		} else if ( S.kind === 'lean' ) {

			st.push( { t0: tAt, t1: tUp - 3, kind: 'hold', p: root, yaw: yawIn, y: 0, pose: ( tau ) => ( Math.floor( tau / 5 + k ) % 3 === 0 ? R.kneelIn( tau, hash( k ) ) : pressIn( tau, hash( k * 2.3 ) ) ) } );
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
	const ON_STAGE_AT = [ [ 0.3, 0.95 ], [ - 1.0, 0.85 ], [ 1.5, 0.9 ], [ - 0.4, 0.3 ], [ 0.9, 0.3 ], [ - 1.8, 0.25 ] ];
	for ( const [ id, info ] of L ) {

		const st = info.steps;
		const last = st[ st.length - 1 ];
		const from = last.p || last.b || PILE;
		// a place in the crowd in front of it
		const row = Math.floor( n / 9 ), col = n % 9;
		const spot = S.point( - 3.6 + col * 0.95 + ( row % 2 ) * 0.45 + ( hash( n ) - 0.5 ) * 0.3, front + 1.4 + row * 0.95 + hash( n * 3 ) * 0.3 );
		const face = S.point( ( hash( n * 5 ) - 0.5 ) * 2, 0 );
		const t0 = CEL.gather + hash( n * 1.9 ) * 6, t1 = t0 + dist( from, spot ) / 1.5;
		// ---- FX2: Moyer doesn't join the crowd in front of the stage: he goes for the rubber from where he
		// is. (His walk to a place in the crowd ended at 142 s, after his walk to the mound had begun at 128
		// on the plan, and the steps run in order: at 142 he was by the stage and on the rubber the next
		// frame, 19 m)
		const moyer = id === MOYER.id;
		if ( ! moyer ) st.push( { t0, t1, kind: 'go', a: from, b: spot, gait: 'walk' } );
		const nn = n;
		if ( ! moyer ) st.push( { t0: t1, t1: t1 + 400, kind: 'hold', p: spot, yaw: yawTo( spot, face ), y: 0, pose: ( tau ) => crowdPose( tau + t1, nn ) } );
		let p = moyer ? from : spot;
		// ---- end FX2
		// Manuel up for his interview
		if ( id === 'r:manuel' ) {

			// (FR1: right of Zelasko as you face the stage, Montgomery and the trophy on its pedestal to their
			// right: Getty 83570999; back to the rail when the players come up)
			const top = S.point( 0.9, front - 0.85 ), back = S.point( 1.8, - 0.75 );
			const t = climb( st, p, top, CEL.manuel[ 0 ] - 5, S );
			st.push( { t0: t, t1: CEL.manuel[ 1 ], kind: 'hold', p: top, yaw: S.face, y: S.H, pose: ( tau ) => manuelPose( tau ) } );
			st.push( { t0: CEL.manuel[ 1 ], t1: CEL.up - 2, kind: 'hold', p: top, yaw: S.face, y: S.H, pose: ( tau ) => R.applaud( tau, 3 ) } );
			st.push( { t0: CEL.up - 2, t1: CEL.up - 0.5, kind: 'go', a: top, b: back, gait: 'walk', y: S.H } );
			st.push( { t0: CEL.up - 0.5, t1: CEL.up + 400, kind: 'hold', p: back, yaw: S.face, y: S.H, pose: ( tau ) => R.applaud( tau, 3 ) } );

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

		// ---- FR1: Hamels out to the car for the MVP (Getty 83486314), the trophy his from Selig's hands on
		if ( id === 430935 ) {

			const t0h = CEL.mvp[ 0 ] - 7, t1h = t0h + dist( p, MVP.hamels ) / 1.5;
			st.push( { t0: t0h, t1: t1h, kind: 'go', a: p, b: MVP.hamels, gait: 'walk' } );
			st.push( { t0: t1h, t1: CEL.mvp[ 1 ] + 1, kind: 'hold', p: MVP.hamels, yaw: MVP.yaw, y: 0, pose: ( tau ) => mvpPose( tau + t1h ) } );
			p = MVP.hamels;

		}
		// ---- end FR1

		// the players up after the MVP; Howard with it over his head
		const k = onStage.indexOf( id );
		if ( k >= 0 ) {

			// (FR1: Howard in the middle at the front with it, the others round him: ronniebruce 2987489493)
			const top = S.point( ...ON_STAGE_AT[ k ] );
			const tt = climb( st, p, top, CEL.up + k * 1.2, S );
			const howard = id === 429667;
			st.push( { t0: tt, t1: CEL.lap[ 0 ] - 3, kind: 'hold', p: top, yaw: S.face, y: S.H, pose: ( tau ) => ( howard && tau > 2 ? R.holdHigh( tau, 1 ) : R.fist( tau, hash( k ) ) ) } );
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
				p = S.point( ...S.stairs.foot );

			}

			st.push( { t0: t2, kind: 'lap', off, from: p, t1: CEL.lap[ 1 ], flag: id === 408206, trophy: id === 429667, n: lk } );

		}

		n ++;

	}

	void def;

}

// up the stage's stairs from p to the top spot: returns when he's there
function climb( st, p, top, t0, S ) {

	const foot = S.point( ...S.stairs.foot ), step = S.point( ...S.stairs.step );
	const t1 = t0 + dist( p, foot ) / 1.6, t2 = t1 + 1.6, t3 = t2 + dist( step, top ) / 1.4;
	st.push( { t0, t1, kind: 'go', a: p, b: foot, gait: 'walk' } );
	st.push( { t0: t1, t1: t2, kind: 'stairs', a: foot, b: step, y0: 0, y1: S.H } );
	st.push( { t0: t2, t1: t3, kind: 'go', a: step, b: top, gait: 'walk', y: S.H } );
	return t3;

}

// down the stairs from the stage's top spot p to their foot: returns when he's there
function descend( st, p, t0, S ) {

	const foot = S.point( ...S.stairs.foot ), step = S.point( ...S.stairs.step );
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

// ---- FR1: the MVP by the car: listening to Selig, a glance along to him; then the trophy at his chest
// in both hands, and up in his right for the cameras a moment (the FOX frames)
function mvpPose( t ) {

	if ( t < MVP.hand ) {

		const p = M.stand( t );
		p.head = [ 0.05, - 0.5 ];
		p.glove = false;
		return p;

	}

	const u = t - MVP.hand;
	if ( u > 6 && u < 9 ) {

		const p = R.fist( u, 0.3 );
		p.handR = [ 0.2, 1.95, - 0.12 ];
		return p;

	}

	const p = R.holdChest( t );
	p.head = [ 0.0, u > 9 ? - 0.35 : 0.1 ];
	return p;

}
// ---- end FR1

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

// ---- FX2: the side of the lap's line at d, its direction taken across 3 m of it (so it turns smoothly)
function lapSide( d ) {

	const a = lapAt( Math.max( 0, d - 1.5 ) ).p, b = lapAt( d + 1.5 ).p, yaw = yawTo( a, b );
	return [ Math.cos( yaw ), - Math.sin( yaw ) ];

}
// ---- end FX2

// ---------------------------------------------------------------- showing it

// a step at time t -> { x, z, yaw, pose, y, tilt } (or null: not on the field)
function evalSteps( steps, t, info ) {

	let s = null;
	for ( const q of steps ) if ( t >= q.t0 ) s = q; else break;
	if ( ! s ) return null;
	const tau = t - s.t0, k = s.t1 > s.t0 ? Math.min( 1, tau / ( s.t1 - s.t0 ) ) : 1;
	if ( s.kind === 'none' ) return null;
	if ( s.kind === 'hold' ) return { x: s.p[ 0 ], z: s.p[ 1 ], yaw: s.yaw, y: s.y || 0, pose: s.pose( tau ) };
	const ph = info?.phase ?? 0, sl = info?.stride ?? 1;
	// ---- FB4 (C4B-3): over the dugout's rail: up off the step and over it, the knees drawn up and the
	// hands reaching for the grass (FR2's leap), down onto the field. Up first, then out (the rail's only
	// 13 cm in front of him): his feet clear its top as he goes over
	if ( s.kind === 'vault' ) {

		const p = lerp2( s.a, s.b, Math.pow( k, 2.2 ) );
		const pose = M.blend( M.leap( ph * 7 ), M.run( 0.3 + ph, 1 ), ease( ( k - 0.6 ) / 0.4 ) );
		pose.glove = false;
		return { x: p[ 0 ], z: p[ 1 ], yaw: yawTo( s.a, s.b ), y: s.y0 + ( s.y1 - s.y0 ) * k + s.arc * 4 * k * ( 1 - k ), pose };

	}

	// ---- end FB4
	if ( s.kind === 'stairs' ) {

		const p = lerp2( s.a, s.b, k );
		const pose = R.walk( dist( s.a, s.b ) * k / 1.6 + ph );
		return { x: p[ 0 ], z: p[ 1 ], yaw: yawTo( s.a, s.b ), y: s.y0 + ( s.y1 - s.y0 ) * k, pose };

	}

	if ( s.kind === 'lap' ) {

		// out to the start of the lap, then round behind the flag at a walk, waving to the stands
		const side0 = lapSide( 0 ), start = [ LAP[ 0 ][ 0 ] + side0[ 0 ] * s.off[ 0 ], LAP[ 0 ][ 1 ] + side0[ 1 ] * s.off[ 0 ] ]; // (FX2: to his place)
		const lead = dist( s.from, start );
		const tau2 = tau * LAP_SPEED - lead;
		if ( tau2 < 0 ) {

			const p = lerp2( s.from, start, tau * LAP_SPEED / Math.max( 0.01, lead ) );
			return { x: p[ 0 ], z: p[ 1 ], yaw: yawTo( s.from, start ), y: 0, pose: R.walk( tau * LAP_SPEED / ( 2.3 * sl ) + ph ) };

		}

		// ---- FX2: his place beside the flag's line turns with the line over 3 m of the walk, not at the
		// corner (1.3 m sideways in a frame at the lap's turns); and he walked out to it, not to the line
		const dl = Math.max( 0, tau2 - s.off[ 1 ] ), w = lapAt( dl );
		const side = lapSide( dl );
		// ---- end FX2
		const x = w.p[ 0 ] + side[ 0 ] * s.off[ 0 ], z = w.p[ 1 ] + side[ 1 ] * s.off[ 0 ];
		const pose = w.end ? M.stand( t ) : R.walk( tau2 / ( 2.3 * sl ) + ph );
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
		const pose = s.gait === 'walk' ? R.walk( L / ( 2.3 * sl ) + ph ) : M.run( L / ( 3.4 * sl ) + ph, 0.9 );
		pose.glove = false;
		return { x: p[ 0 ], z: p[ 1 ], yaw: yawTo( s.a, s.b ), y: s.y ?? moundY( p[ 0 ], p[ 1 ] ), pose };

	}

	if ( s.kind === 'dive' ) {

		// ---- FR2: a leap onto the pile. Off his last stride, up in an arc (ballistic: s.arc over the line
		// from his feet to where he lands), knees up and arms reaching; he goes over into the pile only as he
		// comes down onto it. (It was pitched over from the take-off on an eased path with a sine hop: men
		// gliding in flat, arms out, for half a second: FB3's A-lastout-s4.2, s6.0)
		const a = s.a || s.p;
		const p = lerp2( a, s.p, k );
		const y0 = moundY( a[ 0 ], a[ 1 ] );
		const y = y0 + ( s.y - y0 ) * k + ( s.arc ?? 0.4 ) * 4 * k * ( 1 - k );
		const over = 0.15 * k + 0.85 * ease( ( k - 0.45 ) / 0.55 );
		const air = M.leap( ph * 7 );
		const pose = k < 0.45 ? M.blend( M.run( 0.3 + ph, 1 ), air, ease( k / 0.3 ) ) : M.blend( air, s.pose(), ease( ( k - 0.45 ) / 0.55 ) );
		pose.glove = false;
		return { x: p[ 0 ], z: p[ 1 ], yaw: s.yaw, y, pose, tilt: tiltOf( s.pitch * over, s.roll * over ) };

	}

	if ( s.kind === 'fall' ) {

		const e = ease( k );
		const a = s.a || s.p;
		const p = lerp2( a, s.p, e );
		const y0 = s.y0 ?? moundY( a[ 0 ], a[ 1 ] );
		const y1 = s.y1 ?? s.y;
		const y = y0 + ( y1 - y0 ) * e;
		const pose = s.pose0 ? M.blend( s.pose0(), s.pose(), e ) : M.blend( M.run( 0.3, 1 ), s.pose(), e );
		pose.glove = false;
		return { x: p[ 0 ], z: p[ 1 ], yaw: s.yaw, y, pose, tilt: tiltOf( s.pitch * e, s.roll * e ) };

	}

	if ( s.kind === 'lie' ) {

		// (---- FR2: a give as he lands on them, taken up again in a third of a second)
		const give = tau < 0.35 ? - 0.06 * Math.sin( Math.PI * tau / 0.35 ) : 0;
		return { x: s.p[ 0 ], z: s.p[ 1 ], yaw: s.yaw, y: s.y + give, pose: s.pose( tau ), tilt: tiltOf( s.pitch, s.roll ) };

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

// ---- FR1: the MVP trophy once Hamels has it (from MVP.hand): in both hands at his chest, else in his
// right hand, wherever he goes (the stage, the lap); null before (Selig has it, or it's on the hood)
export function mvpHold( d, lt ) {

	if ( lt < MVP.hand ) return null;
	const id = 430935, a = d.actors?.get( id ), pz = a?.pose;
	if ( ! pz || ! pz.handR ) return null;
	const h = d._height ? d._height( id ) : 1;
	const both = Math.abs( pz.handL[ 1 ] - pz.handR[ 1 ] ) < 0.12 && Math.hypot( pz.handL[ 0 ] - pz.handR[ 0 ], pz.handL[ 2 ] - pz.handR[ 2 ] ) < 0.32;
	const hx = both ? ( pz.handL[ 0 ] + pz.handR[ 0 ] ) / 2 : pz.handR[ 0 ], hy = both ? ( pz.handL[ 1 ] + pz.handR[ 1 ] ) / 2 : pz.handR[ 1 ], hz = both ? ( pz.handL[ 2 ] + pz.handR[ 2 ] ) / 2 : pz.handR[ 2 ];
	const c = Math.cos( a.yaw ), sn = Math.sin( a.yaw ), lx = hx * h, lz = hz * h;
	return { x: a.x + lx * c + lz * sn, y: ( a.y || 0 ) + hy * h - 0.16, z: a.z - lx * sn + lz * c, yaw: a.yaw };

}
// ---- end FR1

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

// ---- FB3 (C3B-1): the men on the field at the last out run on the strike's clock (lead: the seconds from
// strike three to the celebrate segment's start, 3.6), which comes back to the segment's over the first
// 40 s (9% slow, in the pile, where nobody can tell), so the presentation and everything after are where
// they were. (FB4, C4B-3: the bench, the pen and the coaches too, now that their figures in the dugout
// and the pen go at the strike: `field` on them all.)
export const fieldClock = ( lt, lead ) => lt + lead * Math.max( 0, 1 - lt / 40 );

// Strike three to the celebrate segment's start (the pitch's tail and the result): Lidge, Ruiz and the
// fielders as the celebration has them, s seconds after the strike, eased in from what the pitch had
// them doing over the first 0.6 s (Lidge's follow-through, Ruiz's crouch). Called after the segment's
// own scene, so it overrides those men only; the batter, the runners and the umpires stay its.
export function showLastOut( d, seg, s ) {

	const L = seg._rituals ||= plan( d, seg );
	const k = ease( s / 0.6 );
	for ( const [ id, info ] of L ) {

		if ( ! info.field ) continue;
		const a = gettingUp( info.steps, s ) || evalSteps( info.steps, s, info );
		if ( ! a ) continue;
		const was = d.actors.get( id );
		const extra = { y: a.y || 0, tilt: a.tilt || null };
		if ( id === seg.snap.defense.C ) extra.role = info.role;
		// (---- FB4, C4B-3: the bench, the pen and the staff are on this clock too: their looks and jackets
		// from the first frame, or the rig's slot is made without them)
		if ( info.who ) extra.who = info.who;
		if ( info.role & ROLE.jacket ) extra.role = info.role;
		if ( was && was.pose && k < 1 ) {

			let dy = a.yaw - was.yaw;
			dy -= Math.round( dy / ( 2 * Math.PI ) ) * 2 * Math.PI;
			d.act( id, was.x + ( a.x - was.x ) * k, was.z + ( a.z - was.z ) * k, was.yaw + dy * k, M.blend( was.pose, a.pose, k ), { ...extra, y: ( was.y || 0 ) + ( extra.y - ( was.y || 0 ) ) * k } );

		} else d.act( id, a.x, a.z, a.yaw, a.pose, extra );

	}

}
// ---- end FB3

export function showCelebration( d, seg, lt ) {

	const s = seg.snap;
	const L = seg._rituals ||= plan( d, seg );
	// ---- FB3 (C3B-1): on the field at the strike: the strike's clock
	const lc = fieldClock( lt, d.lastOut?.lead ?? 0 );
	// ---- end FB3
	for ( const [ id, info ] of L ) {

		const tt = info.field ? lc : lt;
		let a = gettingUp( info.steps, tt ) || evalSteps( info.steps, tt, info );
		if ( ! a ) continue;
		let role = info.role ?? 0;
		// (---- FB4: the bench's players out of their pullovers into the tee; the coaches and the pen keep theirs)
		if ( lt > info.tChamps ) role = role & ROLE.jacket && ! info.bench ? role | ROLE.champCap : ( role & ~ ( ROLE.gear | ROLE.ccap | ROLE.jacket ) ) | ROLE.tee | ROLE.champCap;
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
		// (FB3: the batter's been walking off since the result: on from where it left him)
		const lw = lt + ( id === s.batter ? d.lastOut?.result?.dur ?? 0 : 0 );
		const k = Math.min( 1, lw * 1.6 / dist( from, to ) );
		if ( k >= 1 ) continue;
		const p = lerp2( from, to, k );
		d.act( id, p[ 0 ], p[ 1 ], yawTo( from, to ), R.walk( lw * 0.7 ) );

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
