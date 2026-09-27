import { neutralPose, DIM } from '../../game/Rig.js';
import * as M from '../../game/Motions.js';

// The Phillie Phanatic's motions, in the players' rig (Rig.js pose objects in his own frame: y up, facing
// -z, +x his right; the root scales him up to his 6'6"). He moves like the costume makes him: a big
// round belly carried out in front and the head riding on it, so everything's a little leaned back and
// wide; feet splayed in the huge sneakers; arms held out from the fur; and he never does anything small.
//
// All of them are functions of time (seconds, or a phase in cycles for the gaits), so a moment of the
// replay always shows the same thing. Where he looks, points or throws is given in his own frame.

const clamp = ( x, a, b ) => Math.min( b, Math.max( a, x ) );
const ease = ( t ) => t * t * ( 3 - 2 * t );
const lerp = ( a, b, t ) => a + ( b - a ) * t;
const TAU = Math.PI * 2;
const P = ( o ) => Object.assign( neutralPose(), o );
const add = ( a, b ) => [ a[ 0 ] + b[ 0 ], a[ 1 ] + b[ 1 ], a[ 2 ] + b[ 2 ] ];

// a window: 0 before a, up over `r` seconds to 1, down again by b
const win = ( t, a, b, r = 0.25 ) => clamp( Math.min( ( t - a ) / r, ( b - t ) / r ), 0, 1 );

// ---------------------------------------------------------------- getting about

// The waddle: the walk cycle (motion capture) made his: the stance wide, the toes turned out, the body
// rocking side to side over each foot, leaned back behind the belly, the arms held out and swinging
// wide, the head bobbing. phase: cycles (a stride on each foot per cycle).
export function waddle( phase, t = 0 ) {

	const p = M.walk( phase );
	const s = Math.sin( phase * TAU ), c = Math.cos( phase * TAU );
	p.pelvisY -= 0.03;
	p.footL = [ p.footL[ 0 ] - 0.1, p.footL[ 1 ], p.footL[ 2 ] ];
	p.footR = [ p.footR[ 0 ] + 0.1, p.footR[ 1 ], p.footR[ 2 ] ];
	p.footYawL = 0.5; p.footYawR = - 0.5;
	p.pelvisX = ( p.pelvisX || 0 ) + 0.06 * s;
	p.pelvis = [ p.pelvis[ 0 ] + 0.05, p.pelvis[ 1 ], p.pelvis[ 2 ] + 0.13 * s ];
	p.torso = [ p.torso[ 0 ] + 0.12, p.torso[ 1 ] - 0.12 * c, p.torso[ 2 ] - 0.1 * s ];
	p.head = [ p.head[ 0 ] + 0.04 * Math.sin( phase * TAU * 2 ) - 0.05, p.head[ 1 ] + 0.15 * Math.sin( t * 0.7 ) ];
	p.handL = [ p.handL[ 0 ] - 0.2, p.handL[ 1 ] + 0.12, p.handL[ 2 ] * 1.4 ];
	p.handR = [ p.handR[ 0 ] + 0.2, p.handR[ 1 ] + 0.12, p.handR[ 2 ] * 1.4 ];
	p.elbowL = p.elbowR = undefined;
	p.glove = false;
	return p;

}

// running flat out (the pile at the end, late for the dugout roof): the mocap run with the arms flung up
// and flapping
export function scamper( phase, t = 0 ) {

	const p = M.run( phase, 0.8 );
	const s = Math.sin( phase * TAU );
	p.footYawL = 0.35; p.footYawR = - 0.35;
	p.torso = [ p.torso[ 0 ] + 0.1, p.torso[ 1 ], p.torso[ 2 ] ];
	p.handL = [ - 0.55, 1.55 + 0.25 * s, - 0.1 ];
	p.handR = [ 0.55, 1.55 - 0.25 * s, - 0.1 ];
	p.head = [ p.head[ 0 ] + 0.1, 0.1 * Math.sin( t * 3 ) ];
	p.elbowL = p.elbowR = undefined;
	p.glove = false;
	return p;

}

// standing about, belly out, the weight shifting, the arms loose and a little out from the fur
export function idle( t = 0 ) {

	const s = Math.sin( t * 1.1 ), b = Math.sin( t * 2.3 );
	return P( {
		pelvisX: 0.03 * s, pelvisY: DIM.hip - 0.04, pelvis: [ 0.04, 0.05 * s, 0.03 * s ], torso: [ 0.1, - 0.05 * s, 0 ], head: [ - 0.05 + 0.04 * b, 0.25 * Math.sin( t * 0.45 ) ],
		footL: [ - 0.24, 0.08, 0.02 ], footR: [ 0.24, 0.08, 0.0 ], footYawL: 0.45, footYawR: - 0.45,
		handL: [ - 0.42, 0.98, - 0.04 ], handR: [ 0.42, 0.98 + 0.02 * b, - 0.04 ], glove: false,
	} );

}

// ---------------------------------------------------------------- showing off

// The belly shake: feet planted wide, knees bent, the hips thrown side to side fast so the belly swings
// (the shoulders held still against it), the arms out like wings. `jiggle` for the look's belly (Players
// packs it per frame): the fur bouncing with it.
export function bellyShake( t ) {

	const f = 4.6, a = Math.sin( t * TAU * f ), h = Math.sin( t * TAU * f * 2 );
	const p = P( {
		pelvisX: 0.05 * a, pelvisY: DIM.hip - 0.12 + 0.015 * h, pelvis: [ - 0.05, 0.3 * a, 0.12 * a ], torso: [ 0.22, - 0.32 * a, - 0.1 * a ], head: [ 0.05, 0.1 * a ],
		footL: [ - 0.36, 0.08, 0.0 ], footR: [ 0.36, 0.08, 0.0 ], footYawL: 0.55, footYawR: - 0.55,
		handL: [ - 0.66, 1.3 + 0.06 * h, - 0.05 ], handR: [ 0.66, 1.3 - 0.06 * h, - 0.05 ], glove: false,
	} );
	p.jiggle = 0.35 * a;
	return p;

}

// The belly bump: rocked back, arms spread, then the belly thrust forward into whoever's in front
// (a ball girl, a Ray, a fan at the rail), and a bounce off it. One bump takes 1.6 s.
export function bellyBump( t ) {

	const k = t % 1.6;
	const back = P( {
		pelvisY: DIM.hip - 0.08, pelvis: [ 0.15, 0, 0 ], torso: [ 0.35, 0, 0 ], head: [ - 0.25, 0 ],
		footL: [ - 0.26, 0.08, 0.06 ], footR: [ 0.26, 0.08, - 0.02 ], footYawL: 0.45, footYawR: - 0.45,
		handL: [ - 0.72, 1.35, 0.1 ], handR: [ 0.72, 1.35, 0.1 ], glove: false,
	} );
	const bump = P( {
		pelvisZ: - 0.18, pelvisY: DIM.hip - 0.02, pelvis: [ 0.3, 0, 0 ], torso: [ 0.25, 0, 0 ], head: [ 0.1, 0 ],
		footL: [ - 0.26, 0.08, - 0.25 ], footR: [ 0.26, 0.08, 0.1 ], footYawL: 0.45, footYawR: - 0.45,
		handL: [ - 0.6, 1.0, 0.3 ], handR: [ 0.6, 1.0, 0.3 ], glove: false,
	} );
	const off = P( { ...back, pelvisZ: 0.1, torso: [ 0.3, 0, 0 ], handL: [ - 0.6, 1.6, 0 ], handR: [ 0.6, 1.6, 0 ] } );
	const p = M.keyframes( [ [ 0, idle( t ) ], [ 0.45, back ], [ 0.62, bump ], [ 0.8, bump ], [ 1.05, off ], [ 1.6, idle( t ) ] ], k );
	p.jiggle = k > 0.6 && k < 1.2 ? 0.4 * Math.sin( ( k - 0.6 ) * 30 ) * ( 1.2 - k ) / 0.6 : 0;
	return p;

}

// His dances: a few moves he strings together to whatever the organ or the PA is playing, changing
// every two bars (a bar is 2 s at 120 beats a minute), each blended into the next.
//   0 the hips thrown side to side with the arms up and waving (Motions.phanDance)
//   1 the hip swivel: hands behind his head, the hips circling
//   2 raise the roof: the palms pushed up on the beat, a bounce in the knees
//   3 the shuffle: side steps, the arms wiggling out in front
//   4 the belly shake
const DANCES = [
	( t ) => M.phanDance( t ),
	( t ) => {

		const a = t * TAU * 1.0;
		return P( {
			pelvisX: 0.09 * Math.cos( a ), pelvisZ: 0.07 * Math.sin( a ), pelvisY: DIM.hip - 0.09, pelvis: [ 0.12 * Math.sin( a ), 0.2 * Math.cos( a ), 0.15 * Math.cos( a ) ],
			torso: [ 0.12, - 0.2 * Math.cos( a ), - 0.14 * Math.cos( a ) ], head: [ - 0.15, 0.15 * Math.cos( a ) ],
			footL: [ - 0.3, 0.08, 0.0 ], footR: [ 0.3, 0.08, 0.0 ], footYawL: 0.5, footYawR: - 0.5,
			handL: [ - 0.22, 1.86, 0.12 ], handR: [ 0.22, 1.86, 0.12 ], elbowL: [ - 0.9, 0.2, 0.2 ], elbowR: [ 0.9, 0.2, 0.2 ], glove: false,
		} );

	},
	( t ) => {

		const beat = t * 2, k = 1 - Math.abs( ( beat % 1 ) * 2 - 1 ), up = ease( k );
		return P( {
			pelvisY: DIM.hip - 0.14 + 0.08 * up, pelvis: [ - 0.05, 0.15 * Math.sin( t * Math.PI ), 0 ], torso: [ 0.18, 0, 0.08 * Math.sin( t * Math.PI ) ], head: [ - 0.3 + 0.15 * up, 0 ],
			footL: [ - 0.34, 0.08, 0.0 ], footR: [ 0.34, 0.08, 0.0 ], footYawL: 0.5, footYawR: - 0.5,
			handL: [ - 0.38, lerp( 1.55, 1.98, up ), - 0.05 ], handR: [ 0.38, lerp( 1.55, 1.98, up ), - 0.05 ], glove: false,
		} );

	},
	( t ) => {

		const a = t * Math.PI, s = Math.sin( a ), step = Math.abs( Math.cos( a ) );
		return P( {
			pelvisX: 0.22 * s, pelvisY: DIM.hip - 0.08 - 0.04 * step, pelvis: [ 0, 0.2 * s, - 0.1 * s ], torso: [ 0.12, - 0.15 * s, 0.12 * s ], head: [ 0, 0.35 * s ],
			footL: [ - 0.3 + 0.22 * s, 0.08 + 0.12 * Math.max( 0, - Math.cos( a ) ), 0.0 ], footR: [ 0.3 + 0.22 * s, 0.08 + 0.12 * Math.max( 0, Math.cos( a ) ), 0.0 ], footYawL: 0.5, footYawR: - 0.5,
			handL: [ - 0.3 + 0.1 * Math.sin( t * 18 ), 1.3, - 0.45 ], handR: [ 0.3 + 0.1 * Math.sin( t * 18 + 1 ), 1.3, - 0.45 ], glove: false,
		} );

	},
	( t ) => bellyShake( t ),
];

// dance( t, seed ): the sequence (by the seed) through the moves, 4 s each, blended over 0.35 s
export function dance( t, seed = 0 ) {

	const bar = 4, i = Math.floor( t / bar ), u = t - i * bar;
	const pick = ( n ) => Math.floor( Math.abs( Math.sin( ( n + seed * 7.3 ) * 12.9898 ) * 43758.5453 ) % 1 * DANCES.length );
	const a = DANCES[ pick( i ) ]( t );
	if ( u > 0.35 || i === 0 ) return a;
	return M.blend( DANCES[ pick( i - 1 ) ]( t ), a, ease( u / 0.35 ) );

}

// Waving to the crowd: the right arm up and swinging over his head, the left out wide, turning a little
// to take them all in
export function wave( t, both = false ) {

	const p = idle( t );
	const w = Math.sin( t * 7.5 );
	p.handR = [ 0.42 + 0.16 * w, 1.98, - 0.12 ];
	p.handL = both ? [ - 0.42 - 0.16 * w, 1.98, - 0.12 ] : [ - 0.5, 1.15, - 0.1 ];
	p.torso = [ 0.12, 0.12 * Math.sin( t * 0.6 ), - 0.08 ];
	p.head = [ - 0.12, 0.2 * Math.sin( t * 0.6 ) ];
	return p;

}

// Pumping the crowd up: both fists pumping over his head, then the arms swept up from the floor ("get
// up!"), a hop on the beat
export function pumpUp( t ) {

	const k = t % 3;
	const beat = Math.abs( Math.sin( t * Math.PI * 2 ) );
	if ( k < 1.8 ) return P( {
		pelvisY: DIM.hip - 0.08 + 0.04 * beat, torso: [ 0.15, 0, 0 ], head: [ - 0.25, 0 ],
		footL: [ - 0.32, 0.08, 0 ], footR: [ 0.32, 0.08, 0 ], footYawL: 0.45, footYawR: - 0.45,
		handL: [ - 0.3, 1.62 + 0.3 * beat, - 0.12 ], handR: [ 0.3, 1.62 + 0.3 * beat, - 0.12 ], glove: false,
	} );
	const u = ( k - 1.8 ) / 1.2;
	const down = P( {
		pelvisY: DIM.hip - 0.28, pelvis: [ - 0.35, 0, 0 ], torso: [ - 0.55, 0, 0 ], head: [ 0.4, 0 ],
		footL: [ - 0.36, 0.08, 0.05 ], footR: [ 0.36, 0.08, 0.05 ], footYawL: 0.5, footYawR: - 0.5,
		handL: [ - 0.35, 0.3, - 0.55 ], handR: [ 0.35, 0.3, - 0.55 ], glove: false,
	} );
	const up = P( {
		pelvisY: DIM.hip, torso: [ 0.3, 0, 0 ], head: [ - 0.4, 0 ],
		footL: [ - 0.3, 0.14, 0 ], footR: [ 0.3, 0.14, 0 ], footYawL: 0.45, footYawR: - 0.45,
		handL: [ - 0.5, 2.05, 0.05 ], handR: [ 0.5, 2.05, 0.05 ], glove: false,
	} );
	return M.keyframes( [ [ 0, down ], [ 0.35, down ], [ 0.7, up ], [ 1, up ] ], u );

}

// ---------------------------------------------------------------- at the other team

// Pointing: the right arm straight out at whoever it is (in his frame), the left hand on his hip, a
// little lean into it
export function point( t, at = [ 0, 1.6, - 1 ] ) {

	const p = idle( t );
	const d = Math.hypot( at[ 0 ], at[ 2 ] ) || 1;
	p.handR = [ 0.2 + 0.52 * at[ 0 ] / d, 1.5 + 0.1 * clamp( at[ 1 ] - 1.5, - 1, 1 ), - 0.1 + 0.55 * at[ 2 ] / d ];
	p.handL = [ - 0.3, 1.02, 0.08 ];
	p.elbowL = [ - 0.9, 0.1, 0.4 ];
	p.torso = [ - 0.05, 0.2 * at[ 0 ] / d, 0 ];
	p.head = [ 0.05, 0.3 * at[ 0 ] / d ];
	return p;

}

// The hex (the "whammy"): his curse on the other team's pitcher, from the Phillies' dugout roof in the
// bottom of the 7th. The 2008 photos (Getty 83477241, October 27): feet wide, knees bent, leaning in,
// both arms thrust straight out at the man at shoulder height, the hands open and the fingers spread and
// shaking. He winds up to it (the hands shaken up by his head), holds it, and stomps to seal it. Facing
// -z (turn the root at the target). One hex is 5 s.
export function hex( t ) {

	const k = clamp( t, 0, 5 );
	const wig = 0.03 * Math.sin( t * 38 ), wig2 = 0.03 * Math.cos( t * 33 );
	const wind = P( {
		pelvisY: DIM.hip - 0.06, torso: [ 0.22, 0, 0 ], head: [ - 0.15, 0 ],
		footL: [ - 0.32, 0.08, 0.05 ], footR: [ 0.32, 0.08, - 0.05 ], footYawL: 0.45, footYawR: - 0.45,
		handL: [ - 0.3 + wig, 1.78 + wig2, 0.0 ], handR: [ 0.3 - wig2, 1.78 + wig, 0.0 ], glove: false,
	} );
	const cast = P( {
		pelvisY: DIM.hip - 0.16, pelvisZ: - 0.08, pelvis: [ - 0.22, 0, 0 ], torso: [ - 0.28, 0, 0 ], head: [ 0.42, 0 ],
		footL: [ - 0.4, 0.08, - 0.18 ], footR: [ 0.4, 0.08, 0.18 ], footYawL: 0.4, footYawR: - 0.5,
		kneeL: [ - 0.3, 0, - 0.9 ], kneeR: [ 0.3, 0, - 0.9 ],
		handL: [ - 0.16 + wig, 1.4 + wig2, - 0.78 ], handR: [ 0.16 - wig2, 1.4 + wig, - 0.78 ], glove: false,
	} );
	const stomp = P( { ...cast, footR: [ 0.4, 0.28, 0.12 ], pelvisY: DIM.hip - 0.1 } );
	const p = M.keyframes( [ [ 0, idle( t ) ], [ 0.35, wind ], [ 1.2, wind ], [ 1.55, cast ], [ 4.0, cast ], [ 4.3, stomp ], [ 4.55, cast ], [ 5.0, idle( t ) ] ], k );
	// the fingers never stop
	if ( k > 0.35 && k < 4.55 ) p.handL = [ p.handL[ 0 ] + wig, p.handL[ 1 ] + wig2, p.handL[ 2 ] ], p.handR = [ p.handR[ 0 ] - wig2, p.handR[ 1 ] + wig, p.handR[ 2 ] ];
	return p;

}

// Teasing: leaning in with his thumbs at the end of his snout, fingers waggling, the head wagging
export function tease( t ) {

	const w = Math.sin( t * 9 );
	return P( {
		pelvisY: DIM.hip - 0.08, pelvis: [ - 0.15, 0.1 * Math.sin( t * 3 ), 0 ], torso: [ - 0.25, 0, 0.08 * w ], head: [ 0.35, 0.3 * Math.sin( t * 4.5 ) ],
		footL: [ - 0.3, 0.08, - 0.05 ], footR: [ 0.3, 0.08, 0.1 ], footYawL: 0.45, footYawR: - 0.45,
		handL: [ - 0.12 - 0.05 * w, 1.62, - 0.62 ], handR: [ 0.12 + 0.05 * w, 1.62, - 0.62 ], glove: false,
	} );

}

// Mimicking the pitcher: the delivery (motion capture), the big leg kick and all, and a stagger at the
// end (he falls over his own belly)
export function mimicPitch( t ) {

	const p = M.delivery( Math.min( t, 1.6 ) );
	p.glove = false;
	p.bat = null;
	if ( t > 1.6 ) {

		const u = clamp( ( t - 1.6 ) / 0.8, 0, 1 );
		const flop = P( { ...idle( t ), torso: [ 0.4, 0.3, 0.3 ], head: [ - 0.4, 0.3 ], handL: [ - 0.7, 1.4, 0.2 ], handR: [ 0.7, 1.7, 0.2 ] } );
		return M.blend( p, flop, ease( u ) );

	}

	return p;

}

// Mocking the plate umpire: the strike-three punch-out, bigger
export function punchOut( t ) {

	const p = M.umpStrike( t, true );
	p.glove = false;
	p.handR = [ p.handR[ 0 ] * 1.2, p.handR[ 1 ], p.handR[ 2 ] ];
	return p;

}

// ---------------------------------------------------------------- the ATV and the launcher

// Riding the ATV: sat on the seat (its top `seat` m up), the big sneakers on the footrests, the hands on
// the grips, leaning into it; bump: the suspension's bounce (m); lean: into a turn (rad, + to his right);
// waveR: 0..1 the right hand off the bar and waving
export function ride( t, { seat = 0.8, bump = 0, lean = 0, waveR = 0 } = {} ) {

	// (his root is scaled up 2 %: the targets here are in his own units)
	const b = bump, k = 1 / 1.02;
	const p = P( {
		pelvisY: ( seat + 0.1 ) * k + b, pelvisZ: 0.1, pelvis: [ - 0.08, 0, lean * 0.4 ], torso: [ - 0.18, 0, lean * 0.5 ], head: [ 0.18, 0.15 * Math.sin( t * 0.9 ) ],
		footL: [ - 0.3, 0.37 * k + b * 0.5, 0.0 ], footR: [ 0.3, 0.37 * k + b * 0.5, 0.0 ], footYawL: 0.25, footYawR: - 0.25,
		kneeL: [ - 0.4, 0.2, - 0.9 ], kneeR: [ 0.4, 0.2, - 0.9 ],
		handL: [ - 0.35 * k, 1.07 * k + b * 0.8, - 0.45 * k ], handR: [ 0.35 * k, 1.07 * k + b * 0.8, - 0.45 * k ], glove: false,
	} );
	if ( waveR > 0 ) {

		const w = Math.sin( t * 7.5 );
		p.handR = [ lerp( 0.34, 0.45 + 0.15 * w, waveR ), lerp( 1.05, 1.95, waveR ), lerp( - 0.44, - 0.15, waveR ) ];
		p.torso = [ p.torso[ 0 ] + 0.15 * waveR, p.torso[ 1 ] + 0.2 * waveR, p.torso[ 2 ] ];
		p.head = [ p.head[ 0 ], p.head[ 1 ] + 0.4 * waveR ];

	}

	return p;

}

// Standing up on the footrests to shout at the crowd as he rolls (both arms up)
export function rideStand( t, { seat = 0.8 } = {} ) {

	// no hands, standing on the footrests (flickr 2979451717, October 26)
	const w = Math.sin( t * 6 );
	return P( {
		pelvisY: seat + 0.38, pelvisZ: 0.02, pelvis: [ 0.05, 0, 0 ], torso: [ 0.1, 0, 0 ], head: [ - 0.15, 0.3 * Math.sin( t * 1.3 ) ],
		footL: [ - 0.3, 0.36, 0.0 ], footR: [ 0.3, 0.36, 0.0 ], footYawL: 0.25, footYawR: - 0.25,
		handL: [ - 0.5 - 0.15 * w, 1.95, - 0.15 ], handR: [ 0.5 + 0.15 * w, 1.95, - 0.15 ], glove: false,
	} );

}

// Aiming the hot dog launcher (the barrel held at his hip, in both hands, `aim` the barrel's direction
// in his frame, pitched up): braced, the recoil when it fires (fire: seconds since the shot, or < 0)
export function launch( t, { aim = [ 0, 0.8, - 0.6 ], fire = - 1 } = {} ) {

	const r = fire >= 0 && fire < 0.6 ? Math.exp( - fire * 7 ) : 0;
	const d = Math.hypot( ...aim ) || 1, a = [ aim[ 0 ] / d, aim[ 1 ] / d, aim[ 2 ] / d ];
	const grip = [ 0.18 + a[ 0 ] * 0.12, 1.02 + a[ 1 ] * 0.12, - 0.2 + a[ 2 ] * 0.12 ];
	return P( {
		pelvisY: DIM.hip - 0.1 + r * 0.03, pelvisZ: 0.1 * r, pelvis: [ 0.05 + 0.1 * r, 0, 0 ], torso: [ 0.15 + 0.2 * r, 0, 0 ], head: [ - 0.1 - 0.4 * a[ 1 ], 0 ],
		footL: [ - 0.3, 0.08, - 0.25 ], footR: [ 0.3, 0.08, 0.2 ], footYawL: 0.3, footYawR: - 0.55,
		handL: add( grip, [ a[ 0 ] * 0.42 - 0.08, a[ 1 ] * 0.42, a[ 2 ] * 0.42 + 0.1 * r ] ), handR: add( grip, [ 0.04, - 0.05, 0.12 * r ] ), glove: false,
	} );

}

// ---------------------------------------------------------------- in the stands

// Leaning over someone in a seat: bent at the waist, the snout down at them (the kiss on a bald head),
// then up with the arms flung wide to the section; one bit is 3 s
export function smooch( t ) {

	const k = t % 3.2;
	const over = P( {
		pelvisY: DIM.hip - 0.1, pelvis: [ - 0.45, 0, 0 ], torso: [ - 0.55, 0, 0 ], head: [ 0.2, 0 ],
		footL: [ - 0.26, 0.08, 0.1 ], footR: [ 0.26, 0.08, 0.05 ], footYawL: 0.4, footYawR: - 0.4,
		handL: [ - 0.3, 0.95, - 0.5 ], handR: [ 0.25, 1.1, - 0.55 ], glove: false,
	} );
	const peck = P( { ...over, torso: [ - 0.72, 0, 0 ], head: [ 0.05, 0 ] } );
	const up = P( { ...idle( t ), torso: [ 0.3, 0, 0 ], head: [ - 0.35, 0 ], handL: [ - 0.75, 1.55, 0.05 ], handR: [ 0.75, 1.55, 0.05 ] } );
	return M.keyframes( [ [ 0, idle( t ) ], [ 0.5, over ], [ 0.9, peck ], [ 1.2, over ], [ 1.4, peck ], [ 1.7, over ], [ 2.3, up ], [ 3.2, idle( t ) ] ], k );

}

// Messing up a fan's hair (or rubbing his head for luck): bent over him, the right hand going round and
// round on his head
export function ruffle( t ) {

	const a = t * 11;
	return P( {
		pelvisY: DIM.hip - 0.08, pelvis: [ - 0.3, 0, 0 ], torso: [ - 0.35, 0.1, 0 ], head: [ 0.25, 0.1 ],
		footL: [ - 0.26, 0.08, 0.05 ], footR: [ 0.26, 0.08, 0.05 ], footYawL: 0.4, footYawR: - 0.4,
		handL: [ - 0.45, 1.0, - 0.2 ], handR: [ 0.12 + 0.07 * Math.cos( a ), 1.18 + 0.03 * Math.sin( a * 2 ), - 0.58 + 0.07 * Math.sin( a ) ], glove: false,
	} );

}

// A high five, down low to a kid or up over a rail: the right hand swung in to meet it
export function highFive( t, h = 1.3 ) {

	const k = t % 1.4;
	const p = idle( t );
	const back = [ 0.5, h + 0.2, 0.05 ], hit = [ 0.22, h, - 0.62 ];
	const u = k < 0.5 ? ease( k / 0.5 ) : k < 0.7 ? 1 : 1 - ease( ( k - 0.7 ) / 0.7 );
	p.handR = [ lerp( back[ 0 ], hit[ 0 ], u ), lerp( back[ 1 ], hit[ 1 ], u ), lerp( back[ 2 ], hit[ 2 ], u ) ];
	p.torso = [ - 0.15 * u, 0.2 * u, 0 ];
	return p;

}

// Posing for a picture: an arm round the shoulders of whoever's beside him (on his right), the left
// thumb up, the head tipped
export function photoPose( t ) {

	const p = idle( t );
	p.handR = [ 0.62, 1.52, 0.02 ];
	p.handL = [ - 0.3, 1.45, - 0.35 ];
	p.head = [ - 0.05, 0.25 ];
	p.torso = [ 0.08, 0.15, - 0.1 ];
	return p;

}

// Swaying through the seventh-inning stretch: "Take Me Out to the Ball Game" is a waltz (3/4), the arms
// up and swaying over the crowd with it, the whole body rocking; and a "Let's go, Phillies" clap at the end
export function stretchSway( t, bpm = 132 ) {

	const bar = 3 * 60 / bpm, a = t / bar * Math.PI;
	const s = Math.sin( a );
	return P( {
		pelvisX: 0.1 * s, pelvisY: DIM.hip - 0.06, pelvis: [ 0, 0.1 * s, 0.1 * s ], torso: [ 0.12, 0, - 0.16 * s ], head: [ - 0.2, 0.25 * s ],
		footL: [ - 0.3, 0.08, 0 ], footR: [ 0.3, 0.08, 0 ], footYawL: 0.45, footYawR: - 0.45,
		handL: [ - 0.32 + 0.3 * s, 1.95, - 0.05 ], handR: [ 0.32 + 0.3 * s, 1.95, - 0.05 ], glove: false,
	} );

}

// Waving a rally towel over his head (the towel's corner in the right hand, whipping round)
export function towelTwirl( t ) {

	const a = t * 10;
	const p = idle( t );
	p.handR = [ 0.3 + 0.14 * Math.cos( a ), 2.0 + 0.1 * Math.sin( a ), - 0.1 + 0.14 * Math.sin( a ) ];
	p.handL = [ - 0.45, 1.4, - 0.2 ];
	p.head = [ - 0.25, 0.2 * Math.sin( t * 0.8 ) ];
	return p;

}

// jumping for joy (the last out): the mocap jump, his arms up
export function joy( t ) {

	const p = M.jump( t );
	p.footYawL = 0.4; p.footYawR = - 0.4;
	p.glove = false;
	return p;

}

// climbing over something about waist high (onto a dugout roof from the steps, over the rail): a knee up
// onto it and the hands on the edge, then up; u 0..1
export function clamber( u ) {

	const a = P( {
		pelvisY: DIM.hip - 0.1, pelvis: [ - 0.4, 0, 0 ], torso: [ - 0.5, 0, 0 ], head: [ 0.4, 0 ],
		footL: [ - 0.2, 0.08, 0.1 ], footR: [ 0.2, 0.6, - 0.35 ], footYawL: 0.4, footYawR: - 0.3,
		handL: [ - 0.3, 0.95, - 0.55 ], handR: [ 0.3, 0.95, - 0.55 ], glove: false,
	} );
	return M.blend( a, idle( 0 ), ease( clamp( u, 0, 1 ) ) );

}

export { win, ease, clamp, lerp };
