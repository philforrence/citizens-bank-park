import { neutralPose, DIM } from './Rig.js';
import { MOCAP } from './data/mocap.js';

// Poses and motions for the ballplayers (Rig.js pose objects, in the player's frame: y up, facing -z,
// +x his right). Written for right-handers; mirror() makes the left-handed version. Motions are
// functions of time (seconds) returning a pose; keyframed ones interpolate with an ease.

const clamp = ( x, a, b ) => Math.min( b, Math.max( a, x ) );
const ease = ( t ) => t * t * ( 3 - 2 * t );
const lerp = ( a, b, t ) => a + ( b - a ) * t;
const lerpA = ( a, b, t ) => a.map( ( v, i ) => lerp( v, b[ i ], t ) );

// blend two poses (t: 0 -> a, 1 -> b)
export function blend( a, b, t ) {

	const o = neutralPose();
	o.pelvisY = lerp( a.pelvisY, b.pelvisY, t );
	o.pelvisX = lerp( a.pelvisX || 0, b.pelvisX || 0, t );
	o.pelvisZ = lerp( a.pelvisZ || 0, b.pelvisZ || 0, t );
	for ( const k of [ 'pelvis', 'torso', 'head', 'footL', 'footR', 'handL', 'handR' ] ) o[ k ] = lerpA( a[ k ], b[ k ], t );
	o.footYawL = lerp( a.footYawL || 0, b.footYawL || 0, t );
	o.footYawR = lerp( a.footYawR || 0, b.footYawR || 0, t );
	const ba = a.bat, bb = b.bat;
	o.bat = ba || bb ? { dir: lerpA( ( ba || bb ).dir, ( bb || ba ).dir, t ) } : null;
	o.glove = t < 0.5 ? a.glove : b.glove;
	// the knee and elbow poles, where either pose has them
	for ( const k of [ 'kneeL', 'kneeR', 'elbowL', 'elbowR' ] ) if ( a[ k ] || b[ k ] ) o[ k ] = lerpA( a[ k ] || [ 0, 0, 0 ], b[ k ] || [ 0, 0, 0 ], t );
	return o;

}

// keyframes: [ [ time, pose ], ... ] -> the pose at t
export function keyframes( keys, t ) {

	if ( t <= keys[ 0 ][ 0 ] ) return keys[ 0 ][ 1 ];
	for ( let i = 0; i < keys.length - 1; i ++ ) {

		const [ t0, p0 ] = keys[ i ], [ t1, p1 ] = keys[ i + 1 ];
		if ( t <= t1 ) return blend( p0, p1, ease( ( t - t0 ) / ( t1 - t0 ) ) );

	}

	return keys[ keys.length - 1 ][ 1 ];

}

// the left-handed version of a pose
export function mirror( p ) {

	const o = { ...p };
	const mx = ( a ) => [ - a[ 0 ], a[ 1 ], a[ 2 ] ];
	o.pelvisX = - ( p.pelvisX || 0 );
	o.pelvis = [ p.pelvis[ 0 ], - p.pelvis[ 1 ], - p.pelvis[ 2 ] ];
	o.torso = [ p.torso[ 0 ], - p.torso[ 1 ], - p.torso[ 2 ] ];
	o.head = [ p.head[ 0 ], - p.head[ 1 ] ];
	o.footL = mx( p.footR ); o.footR = mx( p.footL );
	o.footYawL = - ( p.footYawR || 0 ); o.footYawR = - ( p.footYawL || 0 );
	o.handL = mx( p.handR ); o.handR = mx( p.handL );
	if ( p.bat ) o.bat = { dir: mx( p.bat.dir ) };
	o.kneeL = p.kneeR && mx( p.kneeR ); o.kneeR = p.kneeL && mx( p.kneeL );
	o.elbowL = p.elbowR && mx( p.elbowR ); o.elbowR = p.elbowL && mx( p.elbowL );
	return o;

}

const P = ( o ) => Object.assign( neutralPose(), o );

// ---------------------------------------------------------------- motion capture (data/mocap.js)

// a mocap frame (flat numbers) as a pose
function framePose( f ) {

	const bat = f[ 25 ] || f[ 26 ] || f[ 27 ] ? { dir: [ f[ 25 ], f[ 26 ], f[ 27 ] ] } : null;
	const p = P( {
		pelvisX: f[ 0 ], pelvisY: f[ 1 ], pelvisZ: f[ 2 ], pelvis: [ f[ 3 ], f[ 4 ], f[ 5 ] ], torso: [ f[ 6 ], f[ 7 ], f[ 8 ] ], head: [ f[ 9 ], f[ 10 ] ],
		footL: [ f[ 11 ], f[ 12 ], f[ 13 ] ], footR: [ f[ 14 ], f[ 15 ], f[ 16 ] ], footYawL: f[ 17 ], footYawR: f[ 18 ],
		handL: [ f[ 19 ], f[ 20 ], f[ 21 ] ], handR: [ f[ 22 ], f[ 23 ], f[ 24 ] ], bat, twoHands: !! bat, glove: ! bat,
	} );
	// where the knees and elbows pointed (Rig.solvePose's poles)
	if ( f.length >= 40 ) {

		p.kneeL = [ f[ 28 ], f[ 29 ], f[ 30 ] ]; p.kneeR = [ f[ 31 ], f[ 32 ], f[ 33 ] ];
		p.elbowL = [ f[ 34 ], f[ 35 ], f[ 36 ] ]; p.elbowR = [ f[ 37 ], f[ 38 ], f[ 39 ] ];

	}

	return p;

}

// the clip's frame at time t (s), interpolated; `loop` wraps round, else it holds the ends
function sampleFrames( frames, fps, t, loop = false ) {

	const n = frames.length;
	let x = t * fps;
	if ( loop ) x = ( ( x % n ) + n ) % n;
	else x = clamp( x, 0, n - 1 );
	const i = Math.floor( x ), j = loop ? ( i + 1 ) % n : Math.min( n - 1, i + 1 ), u = x - i;
	const a = frames[ i ], b = frames[ j ];
	// angles and positions both lerp (neighbouring frames are close)
	return a.map( ( v, k ) => v + ( b[ k ] - v ) * u );

}

// ---------------------------------------------------------------- standing, ready, running

export function stand( t = 0 ) {

	const s = Math.sin( t * 1.3 ) * 0.01;
	return P( {
		pelvisY: DIM.hip - 0.02 + s, torso: [ 0.02, 0, 0 ],
		footL: [ - 0.14, 0.08, 0.02 ], footR: [ 0.14, 0.08, - 0.02 ], footYawL: 0.15, footYawR: - 0.15,
		handL: [ - 0.27, 0.92, 0.0 ], handR: [ 0.27, 0.92, 0.02 ],
	} );

}

// a fielder's ready position: weight forward, glove out
export function ready( t = 0 ) {

	const b = Math.sin( t * 2.1 ) * 0.012;
	return P( {
		pelvisY: 0.8 + b, pelvis: [ - 0.25, 0, 0 ], torso: [ - 0.3, 0, 0 ], head: [ 0.45, 0 ],
		footL: [ - 0.34, 0.08, - 0.05 ], footR: [ 0.34, 0.08, 0.02 ], footYawL: 0.35, footYawR: - 0.35,
		handL: [ - 0.18, 0.62, - 0.5 ], handR: [ 0.2, 0.64, - 0.46 ],
	} );

}

// running: phase in cycles (one stride per foot per cycle), speed 0 (jog) .. 1 (sprint)
export function run( phase, speed = 1 ) {

	// motion capture: a jog and a run (one stride cycle each, looping), mixed by speed
	const k = clamp( speed, 0, 1 );
	const jog = framePose( sampleFrames( MOCAP.jog.frames, MOCAP.jog.frames.length, phase, true ) );
	const sprint = framePose( sampleFrames( MOCAP.run.frames, MOCAP.run.frames.length, phase, true ) );
	const p = blend( jog, sprint, k );
	p.bat = null; p.twoHands = false; p.glove = true;
	return p;

}

// ---------------------------------------------------------------- pitching (a right-hander, standing on
// the rubber, root facing home plate)

// The delivery is motion capture (a right-hander's pitch, data/mocap.js): the set, the leg lift, the
// stride, the release at REL, the follow-through; then he comes set to field his position.
const PITCH = MOCAP.pitch;
const pitchEnd = ( PITCH.frames.length - 1 ) / PITCH.fps;
// the capture with two corrections: he stands taller in the set and through the lift (the capture's
// knees were bent like a skier's), and the lead leg folds at the knee as it comes up rather than
// kicking out straight
const pitchAt = ( t ) => {

	const p = framePose( sampleFrames( PITCH.frames, PITCH.fps, t ) );
	p.pelvisY += 0.05 * ( 1 - ease( clamp( ( t - 0.35 ) / 0.4, 0, 1 ) ) );
	const f = p.footL;
	const hip = [ p.pelvisX || 0, p.pelvisY - 0.04, p.pelvisZ || 0 ];
	const up = clamp( ( f[ 1 ] - 0.2 ) / 0.5, 0, 1 );
	if ( up > 0 ) {

		const k = 1 - 0.38 * ease( up );
		p.footL = [ hip[ 0 ] + ( f[ 0 ] - hip[ 0 ] ) * k, hip[ 1 ] + ( f[ 1 ] - hip[ 1 ] ) * k, hip[ 2 ] + ( f[ 2 ] - hip[ 2 ] ) * k ];

	}

	return p;

};

export function pitcherSet() {

	return pitchAt( 0 );

}

export const REL = PITCH.release;
// `release` (optional): the hand's position at release in the pitcher's frame (the pitch's own release
// point): the throwing hand is eased onto it round the release
export function delivery( t, release = null ) {

	let pose = pitchAt( Math.min( t, pitchEnd ) );
	if ( release ) {

		const at = pitchAt( REL ).handR;
		const w = Math.exp( - ( ( ( t - REL ) / 0.14 ) ** 2 ) );
		pose.handR = pose.handR.map( ( v, i ) => v + ( release[ i ] - at[ i ] ) * w );

	}

	if ( t > pitchEnd ) {

		// square up to the plate, glove up
		const last = pitchAt( pitchEnd );
		const field = P( {
			...last, pelvisY: last.pelvisY - 0.12, pelvis: [ - 0.25, 0, 0 ], torso: [ - 0.3, 0, 0 ], head: [ 0.45, 0 ],
			footL: [ last.pelvisX - 0.35, 0.08, last.pelvisZ - 0.1 ], footR: [ last.pelvisX + 0.35, 0.08, last.pelvisZ + 0.05 ], footYawL: 0.3, footYawR: - 0.3,
			handL: [ last.pelvisX - 0.18, 0.7, last.pelvisZ - 0.55 ], handR: [ last.pelvisX + 0.22, 0.72, last.pelvisZ - 0.5 ], bat: null, glove: true,
		} );
		pose = blend( last, field, ease( clamp( ( t - pitchEnd ) / 0.45, 0, 1 ) ) );

	}

	return pose;

}

// ---------------------------------------------------------------- hitting (a right-handed batter; root
// facing the plate, so the pitcher is on his left, -x)

// The swing is motion capture (a right-hander, data/mocap.js): the stance (its waggle looped back and
// forth), the load and stride, contact at CONTACT, the follow-through.
const SWING = MOCAP.swing;

export function batterStance( t = 0 ) {

	const n = SWING.stance.length / SWING.fps;
	let u = ( ( t % ( 2 * n ) ) + 2 * n ) % ( 2 * n );
	if ( u > n ) u = 2 * n - u;
	const p = framePose( sampleFrames( SWING.stance, SWING.fps, u ) );
	p.glove = false;
	return p;

}

export const CONTACT = SWING.contact; // s from the start of the swing to the ball
export function swing( t ) {

	const p = framePose( sampleFrames( SWING.frames, SWING.fps, t ) );
	p.glove = false;
	return p;

}

// a check swing / take: a little stride and the hands stay back
export function take( t ) {

	// the stride of the swing, but the hands stay back
	const stance = batterStance();
	const legs = swing( CONTACT - 0.12 );
	const stride = { ...stance, pelvisX: legs.pelvisX, pelvisY: legs.pelvisY, pelvisZ: legs.pelvisZ, footL: legs.footL, footR: legs.footR, footYawL: legs.footYawL, footYawR: legs.footYawR };
	return keyframes( [ [ 0, stance ], [ 0.14, stride ], [ 0.7, stance ] ], t );

}

// ---------------------------------------------------------------- catching and fielding

// the catcher's crouch; glove (optional): the glove hand's target in his frame
export function catcherCrouch( t = 0, glove = null ) {

	const b = Math.sin( t * 1.7 ) * 0.01;
	return P( {
		pelvisY: 0.5 + b, pelvis: [ - 0.35, 0, 0 ], torso: [ - 0.1, 0, 0 ], head: [ 0.2, 0 ],
		footL: [ - 0.36, 0.08, 0.1 ], footR: [ 0.36, 0.08, 0.14 ], footYawL: 0.5, footYawR: - 0.5,
		handL: glove || [ - 0.08, 0.72, - 0.48 ], handR: [ 0.28, 0.5, 0.1 ],
	} );

}

// umpires: the plate umpire's set in the slot behind the catcher (crouched, hands on his thighs, head
// over the catcher's shoulder), a base umpire's ready stance (hands on his knees)
export function umpSet( t = 0 ) {

	const b = Math.sin( t * 1.4 ) * 0.008;
	return P( {
		pelvisY: 0.74 + b, pelvis: [ - 0.3, 0, 0 ], torso: [ - 0.25, 0, 0 ], head: [ 0.45, 0 ],
		footL: [ - 0.34, 0.08, 0.05 ], footR: [ 0.3, 0.08, 0.18 ], footYawL: 0.35, footYawR: - 0.35,
		handL: [ - 0.2, 0.62, - 0.22 ], handR: [ 0.22, 0.62, - 0.2 ], glove: false,
	} );

}

export function umpReady( t = 0 ) {

	const b = Math.sin( t * 1.9 ) * 0.01;
	return P( {
		pelvisY: 0.84 + b, pelvis: [ - 0.25, 0, 0 ], torso: [ - 0.35, 0, 0 ], head: [ 0.45, 0 ],
		footL: [ - 0.3, 0.08, - 0.02 ], footR: [ 0.3, 0.08, 0.02 ], footYawL: 0.25, footYawR: - 0.25,
		handL: [ - 0.2, 0.56, - 0.24 ], handR: [ 0.2, 0.56, - 0.24 ], glove: false,
	} );

}

export function fieldGrounder( t = 0 ) {

	return P( {
		pelvisY: 0.62, pelvis: [ - 0.6, 0, 0 ], torso: [ - 0.75, 0, 0 ], head: [ 0.9, 0 ],
		footL: [ - 0.42, 0.08, - 0.15 ], footR: [ 0.42, 0.08, 0.05 ], footYawL: 0.4, footYawR: - 0.4,
		handL: [ - 0.08, 0.12, - 0.6 ], handR: [ 0.12, 0.2, - 0.55 ],
	} );

}

export function catchHigh( t = 0 ) {

	return P( {
		pelvisY: 0.93, torso: [ 0.1, 0, 0 ], head: [ - 0.5, 0 ],
		footL: [ - 0.18, 0.08, - 0.1 ], footR: [ 0.18, 0.08, 0.1 ],
		handL: [ - 0.12, 2.05, - 0.25 ], handR: [ 0.1, 1.95, - 0.22 ],
	} );

}

// a throw toward -z: cock, stride, release at 0.32 s
// the throw is motion capture (data/mocap.js), facing the way the ball goes; the release at THROW_REL
export const THROW_REL = MOCAP.throw.release;
export function throwBall( t ) {

	const p = framePose( sampleFrames( MOCAP.throw.frames, MOCAP.throw.fps, t ) );
	p.bat = null; p.twoHands = false; p.glove = true;
	return p;

}

// ---------------------------------------------------------------- celebrating

// on his knees, arms up (Lidge after the last out)
export function kneel( t = 0 ) {

	const up = Math.min( 1, t / 0.5 );
	return P( {
		pelvisY: 0.52, pelvis: [ 0.05, 0, 0 ], torso: [ 0.1, 0, 0 ], head: [ - 0.4 * up, 0 ],
		footL: [ - 0.14, 0.1, 0.46 ], footR: [ 0.14, 0.1, 0.46 ], footYawL: 0, footYawR: 0,
		handL: [ - 0.35, lerp( 0.9, 1.75, up ), - 0.1 ], handR: [ 0.35, lerp( 0.9, 1.75, up ), - 0.1 ],
		glove: true,
	} );

}

// arms round someone in front of him (lower = hugging someone on his knees)
export function embrace( t = 0, lower = 0.35 ) {

	return P( {
		pelvisY: 0.85 - lower * 0.3, pelvis: [ - 0.3 - lower * 0.3, 0, 0 ], torso: [ - 0.35 - lower * 0.5, 0, 0 ], head: [ 0.3, 0.3 ],
		footL: [ - 0.25, 0.08, 0.2 ], footR: [ 0.25, 0.08, 0.35 ],
		handL: [ 0.12, 1.25 - lower * 0.55, - 0.52 ], handR: [ - 0.12, 1.28 - lower * 0.55, - 0.55 ],
	} );

}

// jumping up and down, arms raised
// jumping for joy: a mocap jump, over and over (with a beat on the ground between)
export function jump( t ) {

	const J = MOCAP.jump, n = J.frames.length / J.fps;
	const period = n + 0.25;
	const u = ( ( t % period ) + period ) % period;
	const p = framePose( sampleFrames( J.frames, J.fps, Math.min( u, n ) ) );
	p.bat = null; p.twoHands = false; p.glove = false;
	// arms up at the top of it
	const k = Math.sin( Math.PI * clamp( u / n, 0, 1 ) );
	p.handL = [ p.handL[ 0 ] - 0.1 * k, p.handL[ 1 ] + 0.5 * k, p.handL[ 2 ] ];
	p.handR = [ p.handR[ 0 ] + 0.1 * k, p.handR[ 1 ] + 0.5 * k, p.handR[ 2 ] ];
	return p;

}

// lying in the pile: arms and legs out (the root is tilted by the caller)
export function sprawl( seed = 0 ) {

	const r = ( k ) => Math.sin( seed * 12.9898 + k * 78.233 ) * 0.5;
	return P( {
		pelvisY: DIM.hip, pelvis: [ r( 1 ) * 0.4, r( 2 ) * 0.4, 0 ], torso: [ - 0.2 + r( 3 ) * 0.4, r( 4 ) * 0.5, 0 ], head: [ r( 5 ), r( 6 ) ],
		footL: [ - 0.3 + r( 7 ) * 0.3, 0.1 + r( 8 ) * 0.3, - 0.2 + r( 9 ) * 0.4 ], footR: [ 0.3 + r( 10 ) * 0.3, 0.1 + r( 11 ) * 0.3, r( 12 ) * 0.4 ],
		handL: [ - 0.5, 1.2 + r( 13 ) * 0.5, - 0.4 + r( 14 ) * 0.4 ], handR: [ 0.5, 1.3 + r( 15 ) * 0.5, - 0.4 + r( 16 ) * 0.4 ],
	} );

}

void clamp;
