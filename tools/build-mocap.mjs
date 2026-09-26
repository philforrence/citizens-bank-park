// Motion capture for the ballplayers: CMU Graphics Lab Motion Capture Database clips (mocap.cs.cmu.edu,
// free to use; the Motionbuilder-friendly BVH conversion by B. Hahne) retargeted onto the players' rig
// (src/ballpark/game/Rig.js) and written to src/ballpark/game/data/mocap.js.
//
//   node tools/build-mocap.mjs <folder with the .bvh files>
//
// Clips: 124_01 baseball pitch, 124_07 baseball swing, 16_55 run, 16_35 jog, 33_01 throw, 13_39 jump.
//
// Retargeting: every frame's skeleton becomes a Rig pose. The pelvis, torso and head take the mocap
// joints' orientations; the hands and feet become IK targets, placed from our own shoulders and hips by
// the mocap's shoulder -> wrist and hip -> ankle offsets rescaled to our limb lengths (so they stay
// reachable). Everything is expressed in the player's frame (y up, facing -z, +x his right) of the clip:
// facing home for the pitch, facing the plate for the swing, facing the way he runs for the runs.
// Timing: the pitch is warped so the release falls at REL; the swing keeps real time and reports its
// contact; the runs are cut to one stride cycle (left foot strike to left foot strike) and loop.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Matrix4, Vector3, Euler, Quaternion } from '../src/engine/math/index.js';

const DIR = process.argv[ 2 ];
const OUT = new URL( '../src/ballpark/game/data/mocap.js', import.meta.url ).pathname;
const REL = 0.86; // Motions.js: release, s from the start of the delivery
const D = { hipWidth: 0.095, waist: 0.08, shoulder: 0.2, shoulderY: 0.46, upperArm: 0.3, forearm: 0.27, thigh: 0.45, shin: 0.44 };
const FPS = 30;
const BAT_AXIS = ( process.env.BAT || '0,0,1' ).split( ',' ).map( Number );

// ---------------------------------------------------------------- BVH

function parseBVH( text ) {

	const tok = text.split( /\s+/ ).filter( Boolean );
	let i = 0;
	const joints = [], stack = [];
	while ( tok[ i ] !== 'MOTION' ) {

		const t = tok[ i ++ ];
		if ( t === 'ROOT' || t === 'JOINT' ) joints.push( { name: tok[ i ++ ], parent: stack.length ? stack[ stack.length - 1 ] : - 1, offset: [ 0, 0, 0 ], channels: [] } );
		else if ( t === 'End' ) {

			i ++;
			joints.push( { name: joints[ stack[ stack.length - 1 ] ].name + '_End', parent: stack[ stack.length - 1 ], offset: [ 0, 0, 0 ], channels: [] } );

		} else if ( t === '{' ) stack.push( joints.length - 1 );
		else if ( t === '}' ) stack.pop();
		else if ( t === 'OFFSET' ) joints[ joints.length - 1 ].offset = [ + tok[ i ++ ], + tok[ i ++ ], + tok[ i ++ ] ];
		else if ( t === 'CHANNELS' ) {

			const n = + tok[ i ++ ];
			for ( let k = 0; k < n; k ++ ) joints[ joints.length - 1 ].channels.push( tok[ i ++ ] );

		}

	}

	i ++; // MOTION
	const nFrames = + tok[ i + 1 ];
	const dt = + tok[ i + 4 ];
	i += 5;
	const nCh = joints.reduce( ( a, j ) => a + j.channels.length, 0 );
	const frames = [];
	for ( let f = 0; f < nFrames; f ++ ) {

		frames.push( tok.slice( i, i + nCh ).map( Number ) );
		i += nCh;

	}

	return { joints, frames, dt };

}

const DEG = Math.PI / 180;
const axisM = { X: ( a ) => new Matrix4().makeRotationX( a ), Y: ( a ) => new Matrix4().makeRotationY( a ), Z: ( a ) => new Matrix4().makeRotationZ( a ) };

// world matrices of every joint in a frame
function fk( bvh, frame ) {

	const W = [];
	let c = 0;
	for ( const j of bvh.joints ) {

		const local = new Matrix4().makeTranslation( j.offset[ 0 ], j.offset[ 1 ], j.offset[ 2 ] );
		const t = [ 0, 0, 0 ];
		let r = new Matrix4();
		for ( const ch of j.channels ) {

			const v = frame[ c ++ ];
			if ( ch.endsWith( 'position' ) ) t[ 'XYZ'.indexOf( ch[ 0 ] ) ] = v;
			else r = r.multiply( axisM[ ch[ 0 ] ]( v * DEG ) );

		}

		if ( t.some( ( v ) => v ) ) local.setPosition( j.offset[ 0 ] + t[ 0 ], j.offset[ 1 ] + t[ 1 ], j.offset[ 2 ] + t[ 2 ] );
		local.multiply( r );
		W.push( j.parent < 0 ? local : W[ j.parent ].clone().multiply( local ) );

	}

	return W;

}

// ---------------------------------------------------------------- retargeting

function load( name ) {

	const bvh = parseBVH( readFileSync( join( DIR, name + '.bvh' ), 'utf8' ) );
	const idx = Object.fromEntries( bvh.joints.map( ( j, i ) => [ j.name, i ] ) );
	// skip the added T-pose frame
	const worlds = bvh.frames.slice( 1 ).map( ( f ) => fk( bvh, f ) );
	const pos = ( W, n ) => new Vector3().setFromMatrixPosition( W[ idx[ n ] ] );
	const off = ( n ) => new Vector3( ...bvh.joints[ idx[ n ] ].offset ).length();
	const kLeg = ( D.thigh + D.shin ) / ( off( 'LeftLeg' ) + off( 'LeftFoot' ) );
	const kArm = ( D.upperArm + D.forearm ) / ( off( 'LeftForeArm' ) + off( 'LeftHand' ) );
	return { bvh, idx, worlds, pos, kLeg, kArm, dt: bvh.dt };

}

// the pose of frame f in the clip's player frame ( origin, right R0, forward F0 on the ground )
function poseOf( c, f, origin, R0, F0, groundY, { bat = false } = {} ) {

	const W = c.worlds[ f ];
	const toP = ( v ) => new Vector3( v.dot( R0 ), v.y, - v.dot( F0 ) );
	const P = ( n ) => {

		const p = c.pos( W, n ).sub( origin );
		p.y -= groundY - origin.y;
		return toP( p ).multiplyScalar( c.kLeg );

	};

	const Dir = ( n, local ) => toP( local.clone().transformDirection( W[ c.idx[ n ] ] ) );
	const basis = ( n ) => {

		const x = Dir( n, new Vector3( - 1, 0, 0 ) ), y = Dir( n, new Vector3( 0, 1, 0 ) ), z = Dir( n, new Vector3( 0, 0, 1 ) ).negate();
		return new Matrix4().makeBasis( x, y, z );

	};

	const e = new Euler( 0, 0, 0, 'YXZ' );
	const mP = basis( 'Hips' ), mT = basis( 'Spine1' ), mH = basis( 'Head' );
	e.setFromRotationMatrix( mP );
	const pelvis = [ e.x, e.y, e.z ];
	e.setFromRotationMatrix( mP.clone().invert().multiply( mT ) );
	const torso = [ e.x, e.y, e.z ];
	e.setFromRotationMatrix( mT.clone().invert().multiply( mH ) );
	const head = [ e.x, e.y ];
	// the pelvis: between the mocap hip joints, 4 cm above them (as ours)
	const hipsMid = P( 'LeftUpLeg' ).add( P( 'RightUpLeg' ) ).multiplyScalar( 0.5 );
	const pel = hipsMid.clone().add( new Vector3( 0, 0.04, 0 ).applyMatrix4( new Matrix4().extractRotation( mP ) ) );
	// our own hips and shoulders in this pose
	const q = new Quaternion().setFromEuler( new Euler( pelvis[ 0 ], pelvis[ 1 ], pelvis[ 2 ], 'YXZ' ) );
	const pelvisM = new Matrix4().compose( pel, q, new Vector3( 1, 1, 1 ) );
	const torsoM = pelvisM.clone().multiply( new Matrix4().compose( new Vector3( 0, D.waist, 0 ), new Quaternion().setFromEuler( new Euler( torso[ 0 ], torso[ 1 ], torso[ 2 ], 'YXZ' ) ), new Vector3( 1, 1, 1 ) ) );
	const ours = ( m, v ) => v.applyMatrix4( m );
	const mocapOff = ( a, b, k ) => toP( c.pos( W, b ).sub( c.pos( W, a ) ) ).multiplyScalar( k );
	const foot = ( side, up, ank ) => ours( pelvisM, new Vector3( side * D.hipWidth, - 0.04, 0 ) ).add( mocapOff( up, ank, c.kLeg ) );
	const hand = ( side, sh, wr ) => ours( torsoM, new Vector3( side * D.shoulder, D.shoulderY, 0 ) ).add( mocapOff( sh, wr, c.kArm ) );
	const yawOf = ( ank, toe ) => {

		const d = toP( c.pos( W, toe ).sub( c.pos( W, ank ) ) );
		return Math.atan2( - d.x, - d.z );

	};

	const out = {
		pelvis: [ pel.x, pel.y, pel.z ], rot: pelvis, torso, head,
		footL: foot( - 1, 'LeftUpLeg', 'LeftFoot' ), footR: foot( 1, 'RightUpLeg', 'RightFoot' ),
		footYawL: yawOf( 'LeftFoot', 'LeftToeBase' ), footYawR: yawOf( 'RightFoot', 'RightToeBase' ),
		handL: hand( - 1, 'LeftArm', 'LeftHand' ), handR: hand( 1, 'RightArm', 'RightHand' ),
		bat: null,
	};
	if ( bat ) {

		// the bat runs through the fist, out past the thumb: the top hand's thumb-side axis (T-pose: the
		// right hand points -x, palm down, thumb forward +z), leaning a little toward the fingers
		const hb = BAT_AXIS;
		out.bat = Dir( 'RightHand', new Vector3( hb[ 0 ], hb[ 1 ], hb[ 2 ] ).normalize() ).normalize();

	}

	return out;

}

// flatten a pose to numbers: pelvis xyz, pelvis rot, torso, head(2), footL, footR, yawL, yawR, handL,
// handR, bat
const r3 = ( v ) => Math.round( v * 1000 ) / 1000;
function flat( p ) {

	const v = ( a ) => Array.isArray( a ) ? a : [ a.x, a.y, a.z ];
	return [ ...p.pelvis, ...p.rot, ...p.torso, ...p.head, ...v( p.footL ), ...v( p.footR ), p.footYawL, p.footYawR, ...v( p.handL ), ...v( p.handR ), ...( p.bat ? v( p.bat ) : [ 0, 0, 0 ] ) ].map( r3 );

}

const speed = ( c, n, f ) => c.pos( c.worlds[ Math.min( c.worlds.length - 1, f + 1 ) ], n ).sub( c.pos( c.worlds[ Math.max( 0, f - 1 ) ], n ) ).length() / ( 2 * c.dt );
const horiz = ( v ) => new Vector3( v.x, 0, v.z ).normalize();
const up = new Vector3( 0, 1, 0 );
const rightOf = ( F ) => F.clone().cross( up ).normalize(); // facing F ( -z ), right is F x up
function ground( c, a = 'LeftFoot', b = 'RightFoot' ) {

	const ys = c.worlds.map( ( W ) => Math.min( c.pos( W, a ).y, c.pos( W, b ).y ) ).sort( ( x, y ) => x - y );
	return ys[ Math.floor( ys.length * 0.05 ) ] - 0.08 / c.kLeg;

}

function sample( c, t, fn ) {

	// linear resample of per-frame flat poses at time t (s from frame 0)
	const x = t / c.dt, i = Math.max( 0, Math.min( c.worlds.length - 2, Math.floor( x ) ) ), u = Math.min( 1, Math.max( 0, x - i ) );
	const a = fn( i ), b = fn( i + 1 );
	return a.map( ( v, k ) => r3( v + ( b[ k ] - v ) * u ) );

}

// ---------------------------------------------------------------- the clips

const clips = {};

// the pitch: which hand throws, the release (the throwing hand at its fastest), home is where that hand
// was going; the leg lift's start and the release map onto 0.15 s and REL
{

	const c = load( '124_01' );
	let bestR = 0, bestL = 0, fR = 0, fL = 0;
	for ( let f = 1; f < c.worlds.length - 1; f ++ ) {

		const sr = speed( c, 'RightHand', f ), sl = speed( c, 'LeftHand', f );
		if ( sr > bestR ) { bestR = sr; fR = f; }
		if ( sl > bestL ) { bestL = sl; fL = f; }

	}

	const righty = bestR >= bestL, rel = righty ? fR : fL;
	// the lead leg's lift: the stride foot (left for a right-hander) first 6 cm above where it started
	const lead = righty ? 'LeftFoot' : 'RightFoot';
	const y0 = c.pos( c.worlds[ 0 ], lead ).y;
	let lift = 0;
	for ( let f = 0; f < rel; f ++ ) if ( c.pos( c.worlds[ f ], lead ).y > y0 + 0.06 / c.kLeg ) { lift = f; break; }
	// the rubber: the pivot foot at the start; home: the way he strides (pivot foot to where the lead foot lands)
	const pivot = c.pos( c.worlds[ Math.max( 0, lift - 10 ) ], righty ? 'RightFoot' : 'LeftFoot' );
	const F0 = horiz( c.pos( c.worlds[ rel ], lead ).sub( pivot ) ), R0 = rightOf( F0 );
	const origin = new Vector3( pivot.x, 0, pivot.z ).addScaledVector( F0, - 0.2 / c.kLeg );
	const g = ground( c );
	const at = ( f ) => flat( poseOf( c, f, origin, R0, F0, g ) );
	const tLift = lift * c.dt, tRel = rel * c.dt;
	const frames = [];
	for ( let t = 0; t <= REL + 1.1; t += 1 / FPS ) {

		// 0 .. 0.15: the set before the lift; 0.15 .. REL: warped to the lift .. release; then real time
		let src;
		if ( t < 0.15 ) src = Math.max( 0, tLift - 0.15 + t );
		else if ( t < REL ) src = tLift + ( t - 0.15 ) / ( REL - 0.15 ) * ( tRel - tLift );
		else src = tRel + ( t - REL );
		frames.push( sample( c, src, at ) );

	}

	clips.pitch = { fps: FPS, righty, release: REL, frames };
	console.log( 'pitch', { righty, lift: tLift.toFixed( 2 ), rel: tRel.toFixed( 2 ), frames: frames.length } );

}

// the swing: contact where the hands are fastest; the batter faces the plate (his hips' facing in the
// stance); the clip runs from the stance through the stride and the swing to the follow-through
{

	const c = load( '124_07' );
	let best = 0, con = 0;
	for ( let f = 1; f < c.worlds.length - 1; f ++ ) {

		const s = speed( c, 'RightHand', f ) + speed( c, 'LeftHand', f );
		if ( s > best ) { best = s; con = f; }

	}

	const W0 = c.worlds[ Math.max( 0, con - Math.round( 1.0 / c.dt ) ) ];
	const F0 = horiz( new Vector3( 0, 0, 1 ).transformDirection( W0[ c.idx.Hips ] ) ), R0 = rightOf( F0 );
	const toP = ( v ) => new Vector3( v.dot( R0 ), v.y, - v.dot( F0 ) );
	// a right-handed batter drives the hands toward his left (-x): the mocap's handedness
	const hv = toP( c.pos( c.worlds[ con + 1 ], 'RightHand' ).sub( c.pos( c.worlds[ con - 1 ], 'RightHand' ) ) );
	const righty = hv.x < 0;
	const hips0 = c.pos( W0, 'Hips' );
	const origin = new Vector3( hips0.x, 0, hips0.z );
	const g = ground( c );
	const at = ( f ) => flat( poseOf( c, f, origin, R0, F0, g, { bat: true } ) );
	const start = Math.max( 0, con - Math.round( 0.55 / c.dt ) ), end = Math.min( c.worlds.length - 1, con + Math.round( 0.7 / c.dt ) );
	const frames = [];
	for ( let t = start * c.dt; t <= end * c.dt; t += 1 / FPS ) frames.push( sample( c, t, at ) );
	// the stance: the frames a second before the swing, for the waggle
	const stance = [];
	for ( let t = 0; t < 1.0; t += 1 / FPS ) stance.push( sample( c, Math.max( 0, start * c.dt - 1.0 + t ), at ) );
	clips.swing = { fps: FPS, righty, contact: r3( ( con - start ) * c.dt ), frames, stance };
	console.log( 'swing', { righty, contact: ( ( con - start ) * c.dt ).toFixed( 2 ), frames: frames.length } );

}

// the runs: one stride cycle, from a left foot strike to the next, the drift of the hips taken out
for ( const [ name, file ] of [ [ 'run', '16_55' ], [ 'jog', '16_35' ] ] ) {

	const c = load( file );
	const n = c.worlds.length;
	const hipsA = c.pos( c.worlds[ 0 ], 'Hips' ), hipsB = c.pos( c.worlds[ n - 1 ], 'Hips' );
	const F0 = horiz( hipsB.clone().sub( hipsA ) ), R0 = rightOf( F0 );
	// left foot strikes: local minima of the left ankle's height (with the foot low)
	const ly = c.worlds.map( ( W ) => c.pos( W, 'LeftFoot' ).y );
	const lo = Math.min( ...ly ), hi = Math.max( ...ly );
	const strikes = [];
	for ( let f = 3; f < n - 3; f ++ ) if ( ly[ f ] <= Math.min( ...ly.slice( f - 3, f + 4 ) ) && ly[ f ] < lo + ( hi - lo ) * 0.25 ) {

		if ( ! strikes.length || f - strikes[ strikes.length - 1 ] > 10 ) strikes.push( f );

	}

	const [ s0, s1 ] = strikes.length > 2 ? [ strikes[ 1 ], strikes[ 2 ] ] : [ strikes[ 0 ], strikes[ 1 ] ];
	const g = ground( c );
	const N = 24;
	const frames = [];
	for ( let k = 0; k < N; k ++ ) {

		const f = s0 + ( s1 - s0 ) * k / N;
		const fi = Math.floor( f );
		// the hips' place on the straight line between the cycle's ends: take that out (the Director moves him)
		const u = ( f - s0 ) / ( s1 - s0 );
		const hp = c.pos( c.worlds[ s0 ], 'Hips' ).lerp( c.pos( c.worlds[ s1 ], 'Hips' ), u );
		const origin = new Vector3( hp.x, 0, hp.z );
		const a = flat( poseOf( c, fi, origin, R0, F0, g ) ), b = flat( poseOf( c, Math.min( n - 1, fi + 1 ), origin, R0, F0, g ) );
		frames.push( a.map( ( v, i ) => r3( v + ( b[ i ] - v ) * ( f - fi ) ) ) );

	}

	const pace = ( ( s1 - s0 ) * c.dt ); // s per cycle
	const dist = c.pos( c.worlds[ s1 ], 'Hips' ).sub( c.pos( c.worlds[ s0 ], 'Hips' ) ).length() * c.kLeg;
	clips[ name ] = { cycle: r3( pace ), stride: r3( dist ), frames };
	console.log( name, { strikes: strikes.slice( 0, 4 ), cycle: pace.toFixed( 2 ), speed: ( dist / pace ).toFixed( 2 ) } );

}

// the throw: a right-handed overhand throw (33_01, a football passing session: the first hard throw),
// facing the way the ball goes; its release at THROW_REL
{

	const c = load( '33_01' );
	let best = 0, rel = 0;
	for ( let f = 30; f < c.worlds.length - 30; f ++ ) {

		// the release: the hand at its fastest while still above the shoulder, going forward
		const W = c.worlds[ f ];
		if ( c.pos( W, 'RightHand' ).y < c.pos( W, 'RightArm' ).y + 0.02 / c.kArm ) continue;
		const sp = speed( c, 'RightHand', f );
		if ( sp > best ) { best = sp; rel = f; }

	}

	const v = c.pos( c.worlds[ rel + 1 ], 'RightHand' ).sub( c.pos( c.worlds[ rel - 1 ], 'RightHand' ) );
	const F0 = horiz( v ), R0 = rightOf( F0 );
	const h0 = c.pos( c.worlds[ Math.max( 0, rel - Math.round( 0.4 / c.dt ) ) ], 'Hips' );
	const origin = new Vector3( h0.x, 0, h0.z );
	const g = ground( c );
	const at = ( f ) => flat( poseOf( c, f, origin, R0, F0, g ) );
	const THROW_REL = 0.32, frames = [];
	for ( let t = 0; t <= THROW_REL + 0.7; t += 1 / FPS ) frames.push( sample( c, rel * c.dt - THROW_REL + t, at ) );
	clips.throw = { fps: FPS, release: THROW_REL, frames };
	console.log( 'throw', { rel: ( rel * c.dt ).toFixed( 2 ), frames: frames.length } );

}

// the celebration's jump (13_39): one jump, played over and over
{

	const c = load( '13_39' );
	const hy = c.worlds.map( ( W ) => c.pos( W, 'Hips' ).y );
	const top = hy.indexOf( Math.max( ...hy ) );
	// from the crouch before the take-off to the landing after
	let a = top, b = top;
	while ( a > 1 && hy[ a - 1 ] <= hy[ a ] ) a --;
	while ( b < hy.length - 2 && hy[ b + 1 ] <= hy[ b ] ) b ++;
	const h0 = c.pos( c.worlds[ a ], 'Hips' );
	const F0 = horiz( new Vector3( 0, 0, 1 ).transformDirection( c.worlds[ a ][ c.idx.Hips ] ) ), R0 = rightOf( F0 );
	const origin = new Vector3( h0.x, 0, h0.z );
	const g = ground( c );
	const at = ( f ) => flat( poseOf( c, f, origin, R0, F0, g ) );
	const frames = [];
	for ( let t = a * c.dt; t <= b * c.dt; t += 1 / FPS ) frames.push( sample( c, t, at ) );
	clips.jump = { fps: FPS, frames };
	console.log( 'jump', { from: ( a * c.dt ).toFixed( 2 ), to: ( b * c.dt ).toFixed( 2 ), frames: frames.length } );

}

writeFileSync( OUT, `// Generated by tools/build-mocap.mjs from the CMU Graphics Lab Motion Capture Database
// (mocap.cs.cmu.edu; the Motionbuilder-friendly BVH conversion by B. Hahne), retargeted onto Rig.js.
// Each frame: pelvis xyz, pelvis [ pitch yaw roll ], torso [ pitch yaw roll ], head [ pitch yaw ],
// footL xyz, footR xyz, footYawL, footYawR, handL xyz, handR xyz, bat direction xyz.
export const MOCAP = ${ JSON.stringify( clips ) };
` );
console.log( 'wrote', OUT );
