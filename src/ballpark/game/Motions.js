import { neutralPose, DIM } from './Rig.js';

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
	for ( const k of [ 'pelvis', 'torso', 'head', 'footL', 'footR', 'handL', 'handR' ] ) o[ k ] = lerpA( a[ k ], b[ k ], t );
	o.footYawL = lerp( a.footYawL || 0, b.footYawL || 0, t );
	o.footYawR = lerp( a.footYawR || 0, b.footYawR || 0, t );
	const ba = a.bat, bb = b.bat;
	o.bat = ba || bb ? { dir: lerpA( ( ba || bb ).dir, ( bb || ba ).dir, t ) } : null;
	o.glove = t < 0.5 ? a.glove : b.glove;
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
	o.pelvis = [ p.pelvis[ 0 ], - p.pelvis[ 1 ], - p.pelvis[ 2 ] ];
	o.torso = [ p.torso[ 0 ], - p.torso[ 1 ], - p.torso[ 2 ] ];
	o.head = [ p.head[ 0 ], - p.head[ 1 ] ];
	o.footL = mx( p.footR ); o.footR = mx( p.footL );
	o.footYawL = - ( p.footYawR || 0 ); o.footYawR = - ( p.footYawL || 0 );
	o.handL = mx( p.handR ); o.handR = mx( p.handL );
	if ( p.bat ) o.bat = { dir: mx( p.bat.dir ) };
	return o;

}

const P = ( o ) => Object.assign( neutralPose(), o );

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

	const a = phase * Math.PI * 2;
	const k = 0.55 + 0.45 * speed;
	const leg = ( off ) => {

		const s = Math.sin( a + off ), c = Math.cos( a + off );
		// forward/back along z, lifted during the swing (when the foot moves forward)
		return [ 0, 0.08 + Math.max( 0, - c ) * 0.38 * k, - s * 0.5 * k ];

	};

	const fl = leg( 0 ), fr = leg( Math.PI );
	fl[ 0 ] = - 0.12; fr[ 0 ] = 0.12;
	const sw = Math.sin( a );
	return P( {
		pelvisY: 0.9 - 0.04 * k + 0.035 * Math.abs( Math.cos( a ) ), pelvis: [ - 0.1 * k, 0.12 * sw, 0 ],
		torso: [ - 0.14 * k, - 0.18 * sw, 0 ], head: [ 0.2 * k, 0.1 * sw ],
		footL: fl, footR: fr,
		handL: [ - 0.24, 1.05 + 0.12 * sw * k, 0.28 * sw * k - 0.05 ], handR: [ 0.24, 1.05 - 0.12 * sw * k, - 0.28 * sw * k - 0.05 ],
	} );

}

// ---------------------------------------------------------------- pitching (a right-hander, standing on
// the rubber, root facing home plate)

export function pitcherSet() {

	return P( {
		pelvisY: 0.94, pelvis: [ 0, - Math.PI / 2 + 0.15, 0 ], torso: [ 0.02, 0.05, 0 ], head: [ 0, Math.PI / 2 - 0.2 ],
		footR: [ 0.03, 0.08, 0.12 ], footL: [ - 0.02, 0.08, - 0.42 ], footYawR: - Math.PI / 2, footYawL: - Math.PI / 2 + 0.3,
		handL: [ 0.2, 1.22, - 0.1 ], handR: [ 0.22, 1.2, - 0.06 ],
	} );

}

// The delivery from the stretch: leg lift, stride, arm cocked, release at `REL` s, follow-through,
// fielding position. `release` (optional): the hand's position at release in the pitcher's frame.
export const REL = 0.86;
export function delivery( t, release = null ) {

	const set = pitcherSet();
	const lift = P( {
		pelvisY: 0.97, pelvis: [ 0, - Math.PI / 2 + 0.25, 0 ], torso: [ 0.05, 0.1, 0 ], head: [ 0, Math.PI / 2 - 0.3 ],
		footR: [ 0.03, 0.08, 0.12 ], footL: [ 0.12, 0.62, - 0.05 ], footYawR: - Math.PI / 2, footYawL: - Math.PI / 2,
		handL: [ 0.12, 1.32, - 0.02 ], handR: [ 0.18, 1.3, 0.0 ],
	} );
	const stride = P( {
		pelvisY: 0.78, pelvis: [ - 0.1, - 0.95, 0 ], torso: [ - 0.1, - 0.55, 0.1 ], head: [ 0, 1.2 ],
		footR: [ 0.08, 0.1, 0.2 ], footL: [ - 0.1, 0.08, - 1.45 ], footYawR: - Math.PI / 2, footYawL: - 0.5,
		handL: [ - 0.25, 1.4, - 0.85 ], handR: [ 0.55, 1.62, 0.45 ],
	} );
	const rel = P( {
		pelvisY: 0.74, pelvis: [ - 0.25, 0.05, 0 ], torso: [ - 0.45, 0.35, - 0.1 ], head: [ 0.15, - 0.1 ],
		footR: [ 0.15, 0.2, 0.05 ], footL: [ - 0.12, 0.08, - 1.5 ], footYawR: - 1.2, footYawL: - 0.3,
		handL: [ - 0.3, 1.1, - 0.55 ], handR: release || [ 0.28, 1.8, - 1.15 ],
	} );
	const follow = P( {
		pelvisY: 0.7, pelvis: [ - 0.45, 0.25, 0 ], torso: [ - 0.75, 0.4, 0 ], head: [ 0.55, - 0.2 ],
		footR: [ 0.15, 0.35, - 0.7 ], footL: [ - 0.12, 0.08, - 1.5 ], footYawR: - 0.6, footYawL: - 0.3,
		handL: [ - 0.25, 0.95, 0.05 ], handR: [ - 0.4, 0.65, - 1.05 ],
	} );
	const field = P( {
		pelvisY: 0.8, pelvis: [ - 0.25, 0, 0 ], torso: [ - 0.3, 0, 0 ], head: [ 0.45, 0 ],
		footL: [ - 0.4, 0.08, - 1.35 ], footR: [ 0.35, 0.08, - 1.2 ], footYawL: 0.3, footYawR: - 0.3,
		handL: [ - 0.18, 0.7, - 1.75 ], handR: [ 0.22, 0.72, - 1.7 ],
	} );
	return keyframes( [ [ 0, set ], [ 0.38, lift ], [ 0.72, stride ], [ REL, rel ], [ 1.15, follow ], [ 1.7, field ] ], t );

}

// ---------------------------------------------------------------- hitting (a right-handed batter; root
// facing the plate, so the pitcher is on his left, -x)

export function batterStance( t = 0 ) {

	const w = Math.sin( t * 2.5 ) * 0.03; // the bat waggles
	return P( {
		pelvisY: 0.86, pelvis: [ - 0.12, 0.12, 0 ], torso: [ - 0.18, 0.28, 0 ], head: [ 0.1, - 1.25 ],
		footL: [ - 0.42, 0.08, 0.02 ], footR: [ 0.42, 0.08, 0.06 ], footYawL: - 0.35, footYawR: 0.1,
		handL: [ 0.12, 1.3 + w, 0.02 ], handR: [ 0.16, 1.36 + w, 0.0 ],
		bat: { dir: [ 0.25 + w, 0.85, 0.45 ] }, twoHands: true, glove: false,
	} );

}

export const CONTACT = 0.16; // s from the start of the swing to the ball
export function swing( t ) {

	const stance = batterStance();
	const load = P( {
		pelvisY: 0.84, pelvis: [ - 0.12, 0.2, 0 ], torso: [ - 0.18, 0.42, 0 ], head: [ 0.1, - 1.3 ],
		footL: [ - 0.62, 0.08, 0.0 ], footR: [ 0.42, 0.08, 0.06 ], footYawL: - 0.4, footYawR: 0.1,
		handL: [ 0.2, 1.38, 0.08 ], handR: [ 0.24, 1.42, 0.06 ],
		bat: { dir: [ 0.45, 0.7, 0.55 ] }, twoHands: true, glove: false,
	} );
	const contact = P( {
		pelvisY: 0.8, pelvis: [ - 0.15, - 0.8, 0 ], torso: [ - 0.22, - 0.55, 0 ], head: [ 0.15, - 0.9 ],
		footL: [ - 0.62, 0.08, 0.0 ], footR: [ 0.4, 0.12, 0.08 ], footYawL: - 0.6, footYawR: - 0.6,
		handL: [ - 0.1, 1.02, - 0.35 ], handR: [ - 0.06, 1.06, - 0.3 ],
		bat: { dir: [ - 0.35, 0.02, - 0.94 ] }, twoHands: true, glove: false,
	} );
	const follow = P( {
		pelvisY: 0.84, pelvis: [ - 0.05, - 1.3, 0 ], torso: [ - 0.05, - 0.9, 0 ], head: [ 0.05, - 0.6 ],
		footL: [ - 0.62, 0.08, 0.0 ], footR: [ 0.3, 0.2, - 0.1 ], footYawL: - 0.8, footYawR: - 1.2,
		handL: [ - 0.4, 1.45, 0.05 ], handR: [ - 0.35, 1.5, 0.02 ],
		bat: { dir: [ 0.2, 0.2, 0.96 ] }, twoHands: true, glove: false,
	} );
	return keyframes( [ [ 0, stance ], [ 0.07, load ], [ CONTACT, contact ], [ 0.42, follow ] ], t );

}

// a check swing / take: a little stride and the hands stay back
export function take( t ) {

	const stance = batterStance();
	const stride = { ...batterStance(), footL: [ - 0.58, 0.08, 0.0 ], pelvisY: 0.84 };
	return keyframes( [ [ 0, stance ], [ 0.12, stride ], [ 0.6, stance ] ], t );

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
export const THROW_REL = 0.32;
export function throwBall( t ) {

	const cock = P( {
		pelvisY: 0.9, pelvis: [ 0, - 1.1, 0 ], torso: [ 0, - 0.3, 0 ], head: [ 0, 1.2 ],
		footL: [ - 0.1, 0.08, - 0.45 ], footR: [ 0.1, 0.08, 0.25 ], footYawL: - 0.9, footYawR: - 1.4,
		handL: [ - 0.3, 1.4, - 0.5 ], handR: [ 0.45, 1.6, 0.5 ],
	} );
	const rel = P( {
		pelvisY: 0.85, pelvis: [ - 0.15, 0.1, 0 ], torso: [ - 0.4, 0.3, 0 ], head: [ 0.2, 0 ],
		footL: [ - 0.1, 0.08, - 0.9 ], footR: [ 0.2, 0.2, 0.1 ], footYawL: - 0.3, footYawR: - 0.9,
		handL: [ - 0.3, 1.0, - 0.3 ], handR: [ 0.25, 1.7, - 0.9 ],
	} );
	const follow = P( {
		pelvisY: 0.82, pelvis: [ - 0.3, 0.2, 0 ], torso: [ - 0.6, 0.35, 0 ], head: [ 0.4, 0 ],
		footL: [ - 0.1, 0.08, - 0.9 ], footR: [ 0.15, 0.3, - 0.5 ], footYawL: - 0.3, footYawR: - 0.5,
		handL: [ - 0.25, 0.95, 0.0 ], handR: [ - 0.35, 0.8, - 0.8 ],
	} );
	return keyframes( [ [ 0, ready() ], [ 0.18, cock ], [ THROW_REL, rel ], [ 0.6, follow ], [ 1.0, stand() ] ], t );

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
export function jump( t ) {

	const h = Math.max( 0, Math.sin( t * 5.5 ) ) * 0.35;
	return P( {
		pelvisY: DIM.hip + h, torso: [ 0.1, 0, 0 ], head: [ - 0.3, 0 ],
		footL: [ - 0.15, 0.08 + h, 0 ], footR: [ 0.15, 0.08 + h, 0 ],
		handL: [ - 0.35, 1.9 + h, - 0.1 ], handR: [ 0.35, 1.9 + h, - 0.1 ],
	} );

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
