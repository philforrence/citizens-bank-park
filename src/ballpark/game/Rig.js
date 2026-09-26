import { BufferGeometry, Float32BufferAttribute, BoxGeometry, CylinderGeometry, SphereGeometry, LatheGeometry, Matrix3, Matrix4, Vector2, Vector3, Quaternion, Euler } from '../../engine/index.js';

// A ballplayer's body: 17 bones, a low-poly mesh built bone by bone (every vertex carries its bone and
// a "part" that says which piece of the uniform it is), and the pose: the trunk by forward kinematics,
// arms and legs by two-bone IK toward hand and foot targets (knees and elbows bend toward pole
// directions), a bat held by the right hand.
//
// Units: metres. The player's own frame: y up, facing -z (so +x is his right). Bone matrices come out in
// the frame the player stands in (the field frame), ready for the GPU.

export const BONES = {
	pelvis: 0, torso: 1, head: 2,
	upperArmL: 3, forearmL: 4, handL: 5,
	upperArmR: 6, forearmR: 7, handR: 8,
	thighL: 9, shinL: 10, footL: 11,
	thighR: 12, shinR: 13, footR: 14,
	bat: 15, glove: 16,
};
export const NB = 17;

export const PART = { skin: 0, jersey: 1, pants: 2, socks: 3, shoes: 4, cap: 5, glove: 6, bat: 7, belt: 8, sleeve: 9, helmet: 10, gear: 11, mask: 12, hair: 13 };

// body dimensions (a 6'2" player)
export const DIM = {
	hip: 0.96, // hip joint height standing
	hipWidth: 0.095, // hip joints either side of the centre
	waist: 0.08, // torso bone above the hips
	torso: 0.5,
	shoulder: 0.2, // shoulder joints either side, near the top of the torso
	shoulderY: 0.46,
	upperArm: 0.3, forearm: 0.27, hand: 0.08,
	thigh: 0.45, shin: 0.44, footLen: 0.26,
	bat: 0.86,
};

// ---------------------------------------------------------------- the mesh

// Every piece is a primitive moved into its bone's frame; attributes: aBone, aPart (floats).
export function buildPlayerGeometry() {

	const pos = [], nrm = [], bone = [], part = [], index = [];
	const m = new Matrix4(), q = new Quaternion(), e = new Euler(), s = new Vector3(), t = new Vector3();
	const add = ( geo, b, p, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 ) => {

		m.compose( t.set( x, y, z ), q.setFromEuler( e.set( rx, ry, rz ) ), s.set( sx, sy, sz ) );
		const P = geo.getAttribute( 'position' ), N = geo.getAttribute( 'normal' );
		const base = pos.length / 3;
		const v = new Vector3(), n = new Vector3();
		const nm = new Matrix3().getNormalMatrix( m );
		for ( let i = 0; i < P.count; i ++ ) {

			v.fromBufferAttribute( P, i ).applyMatrix4( m );
			n.fromBufferAttribute( N, i ).applyMatrix3( nm ).normalize();
			pos.push( v.x, v.y, v.z );
			nrm.push( n.x, n.y, n.z );
			bone.push( b );
			part.push( p );

		}

		const I = geo.index;
		if ( I ) for ( let i = 0; i < I.count; i ++ ) index.push( base + I.array[ i ] );
		else for ( let i = 0; i < P.count; i ++ ) index.push( base + i );

	};

	const B = BONES, P = PART, D = DIM;
	const cyl = ( r0, r1, h, seg = 12 ) => new CylinderGeometry( r0, r1, h, seg, 1, false );
	const sph = ( r, w = 12, h = 8 ) => new SphereGeometry( r, w, h );
	// a lathed shape: profile [ [ radius, y ], ... ] bottom to top, closed at both ends
	const lathe = ( prof, seg = 16 ) => new LatheGeometry( [ new Vector2( 0, prof[ 0 ][ 1 ] ), ...prof.map( ( [ r, y ] ) => new Vector2( r, y ) ), new Vector2( 0, prof[ prof.length - 1 ][ 1 ] ) ], seg );
	// a limb segment along -y from its joint: radius profile [ [ r, fraction of the length ], ... ]
	const limb = ( len, prof, seg = 14 ) => lathe( prof.map( ( [ r, f ] ) => [ r, - len * f ] ).reverse(), seg );

	// ---- the pelvis: the seat of the pants (a flattened lathe), the glutes, the belt
	add( lathe( [ [ 0.1, - 0.16 ], [ 0.15, - 0.12 ], [ 0.172, - 0.05 ], [ 0.168, 0.04 ], [ 0.158, 0.11 ] ], 18 ), B.pelvis, P.pants, 0, 0, 0.005, 0, 0, 0, 1, 1, 0.72 );
	for ( const x of [ - 0.075, 0.075 ] ) add( sph( 0.085 ), B.pelvis, P.pants, x, - 0.07, 0.045, 0, 0, 0, 1, 1.05, 0.9 );
	add( cyl( 0.162, 0.162, 0.045, 18 ), B.pelvis, P.belt, 0, 0.11, 0.005, 0, 0, 0, 1, 1, 0.73 );

	// ---- the torso: waist to shoulders, the chest a little forward; the deltoids; the neck
	add( lathe( [ [ 0.152, 0.0 ], [ 0.156, 0.08 ], [ 0.168, 0.18 ], [ 0.19, 0.3 ], [ 0.2, 0.39 ], [ 0.194, 0.45 ], [ 0.165, 0.5 ], [ 0.1, 0.54 ], [ 0.072, 0.555 ] ], 18 ), B.torso, P.jersey, 0, 0, - 0.005, 0, 0, 0, 1, 1, 0.64 );
	for ( const x of [ - 0.182, 0.182 ] ) add( sph( 0.064 ), B.torso, P.jersey, x, D.shoulderY - 0.01, 0, 0, 0, 0, 1.05, 0.95, 1 );
	add( cyl( 0.058, 0.062, 0.08 ), B.head, P.skin, 0, 0.03, 0.008 );
	// the catcher's chest protector over the front
	add( sph( 0.2, 14, 10 ), B.torso, P.gear, 0, 0.27, - 0.075, 0, 0, 0, 0.95, 1.3, 0.45 );

	// ---- the head: skull, jaw and chin, nose, ears; hair under the cap; the cap (crown, button, bill)
	// or the batting helmet (shell, ear flap, short bill), or the catcher's mask
	add( sph( 0.106, 20, 14 ), B.head, P.skin, 0, 0.19, 0.005, 0, 0, 0, 0.88, 1.06, 1 );
	add( sph( 0.076, 14, 10 ), B.head, P.skin, 0, 0.128, - 0.028, 0, 0, 0, 1.0, 0.85, 1.0 );
	add( sph( 0.03, 10, 8 ), B.head, P.skin, 0, 0.115, - 0.075, 0, 0, 0, 1.1, 0.8, 0.75 );
	add( new BoxGeometry( 0.024, 0.04, 0.03 ), B.head, P.skin, 0, 0.178, - 0.1, - 0.25, 0, 0 );
	for ( const x of [ - 0.092, 0.092 ] ) add( sph( 0.026, 10, 8 ), B.head, P.skin, x, 0.18, 0.012, 0, 0, 0, 0.45, 1.0, 0.75 );
	add( sph( 0.104, 18, 10 ), B.head, P.hair, 0, 0.198, 0.014, 0, 0, 0, 0.9, 1.02, 1.0 );
	add( sph( 0.112, 18, 10 ), B.head, P.cap, 0, 0.232, 0.004, 0, 0, 0, 0.95, 0.72, 1.03 );
	add( cyl( 0.01, 0.01, 0.012, 8 ), B.head, P.cap, 0, 0.314, 0.004 );
	add( lathe( [ [ 0.0, - 0.004 ], [ 0.085, - 0.004 ], [ 0.085, 0.004 ], [ 0.0, 0.004 ] ], 20 ), B.head, P.cap, 0, 0.222, - 0.098, 0.18, 0, 0, 1, 1, 0.72 );
	add( sph( 0.125, 18, 12 ), B.head, P.helmet, 0, 0.215, 0.006, 0, 0, 0, 0.98, 0.9, 1.07 );
	add( sph( 0.05, 10, 8 ), B.head, P.helmet, - 0.1, 0.15, 0.0, 0, 0, 0, 0.4, 1.1, 1.0 );
	add( lathe( [ [ 0.0, - 0.004 ], [ 0.07, - 0.004 ], [ 0.07, 0.004 ], [ 0.0, 0.004 ] ], 16 ), B.head, P.helmet, 0, 0.19, - 0.118, 0.1, 0, 0, 1.1, 1, 0.6 );
	add( new BoxGeometry( 0.17, 0.2, 0.05 ), B.head, P.mask, 0, 0.16, - 0.11 );

	// ---- arms: the jersey's short sleeve over the undershirt, the undershirt to the wrist, a fist
	for ( const [ ua, fa, hd ] of [ [ B.upperArmL, B.forearmL, B.handL ], [ B.upperArmR, B.forearmR, B.handR ] ] ) {

		add( limb( D.upperArm * 0.42, [ [ 0.066, 0 ], [ 0.064, 0.5 ], [ 0.06, 1 ] ] ), ua, P.jersey, 0, 0.01, 0 );
		add( limb( D.upperArm, [ [ 0.052, 0.3 ], [ 0.054, 0.55 ], [ 0.046, 0.9 ], [ 0.043, 1 ] ] ), ua, P.sleeve, 0, 0, 0 );
		add( sph( 0.044 ), fa, P.sleeve, 0, 0, 0 );
		add( limb( D.forearm, [ [ 0.044, 0 ], [ 0.046, 0.25 ], [ 0.036, 0.8 ], [ 0.03, 1 ] ] ), fa, P.sleeve, 0, 0, 0 );
		add( sph( 0.044, 12, 10 ), hd, P.skin, 0, - 0.045, - 0.005, 0, 0, 0, 0.72, 1.12, 0.62 );
		add( sph( 0.017, 8, 6 ), hd, P.skin, 0.028, - 0.02, - 0.02, 0, 0, 0, 1, 1.6, 1 );

	}

	// the glove: a leather mitt with its fingers and web
	add( sph( 0.1, 14, 10 ), B.glove, P.glove, 0, - 0.08, - 0.02, 0, 0, 0, 0.95, 1.3, 0.42 );
	for ( const x of [ - 0.05, - 0.017, 0.017, 0.05 ] ) add( sph( 0.024, 8, 6 ), B.glove, P.glove, x, - 0.2, - 0.02, 0, 0, 0, 0.9, 2.0, 0.8 );
	add( sph( 0.03, 8, 6 ), B.glove, P.glove, 0.085, - 0.08, - 0.03, 0, 0, - 0.5, 0.8, 1.8, 0.8 );

	// ---- legs: the pants to below the knee (thigh and knee), the socks round the calf, the cleats; the
	// catcher's shin guards
	for ( const [ th, sh, ft ] of [ [ B.thighL, B.shinL, B.footL ], [ B.thighR, B.shinR, B.footR ] ] ) {

		add( limb( D.thigh, [ [ 0.094, 0 ], [ 0.092, 0.2 ], [ 0.08, 0.6 ], [ 0.066, 0.95 ], [ 0.064, 1 ] ], 16 ), th, P.pants, 0, 0.02, 0 );
		add( sph( 0.066 ), sh, P.pants, 0, 0, 0 );
		add( limb( D.shin * 0.38, [ [ 0.066, 0 ], [ 0.064, 0.7 ], [ 0.06, 1 ] ], 16 ), sh, P.pants, 0, 0, 0 );
		add( limb( D.shin, [ [ 0.058, 0.36 ], [ 0.062, 0.48 ], [ 0.05, 0.75 ], [ 0.04, 0.95 ], [ 0.038, 1 ] ], 14 ), sh, P.socks, 0, 0, 0 );
		add( sph( 0.06, 12, 8 ), sh, P.gear, 0, - D.shin * 0.45, - 0.035, 0, 0, 0, 1.05, 3.4, 0.7 );
		add( sph( 0.06, 12, 8 ), sh, P.gear, 0, - 0.02, - 0.05, 0, 0, 0, 1.1, 1.1, 0.8 );
		// the cleat: a shaped upper, a rounded toe, the sole
		add( new BoxGeometry( 0.092, 0.06, D.footLen * 0.72 ), ft, P.shoes, 0, - 0.03, - 0.03 );
		add( sph( 0.048, 12, 8 ), ft, P.shoes, 0, - 0.04, - 0.14, 0, 0, 0, 0.98, 0.6, 1.3 );
		add( sph( 0.045, 10, 8 ), ft, P.shoes, 0, - 0.03, 0.07, 0, 0, 0, 1.0, 0.8, 0.9 );
		add( new BoxGeometry( 0.098, 0.018, D.footLen + 0.02 ), ft, P.belt, 0, - 0.066, - 0.06 );

	}

	// the bat, along the bat bone from the knob (at the hands) to the barrel
	add( cyl( 0.02, 0.02, 0.012, 12 ), B.bat, P.bat, 0, - 0.006, 0 );
	add( cyl( 0.013, 0.015, 0.36, 12 ), B.bat, P.bat, 0, 0.18, 0 );
	add( cyl( 0.015, 0.033, 0.2, 12 ), B.bat, P.bat, 0, 0.46, 0 );
	add( cyl( 0.033, 0.033, 0.28, 12 ), B.bat, P.bat, 0, 0.7, 0 );
	add( sph( 0.033, 12, 6 ), B.bat, P.bat, 0, 0.84, 0, 0, 0, 0, 1, 0.3, 1 );

	const g = new BufferGeometry();
	g.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
	g.setAttribute( 'normal', new Float32BufferAttribute( nrm, 3 ) );
	g.setAttribute( 'aBone', new Float32BufferAttribute( bone, 1 ) );
	g.setAttribute( 'aPart', new Float32BufferAttribute( part, 1 ) );
	g.setIndex( index );
	g.computeBoundingSphere();
	return g;

}

// ---------------------------------------------------------------- the pose

// A pose, in the player's own frame (metres; y up, facing -z):
//   pelvisX / pelvisZ: the pelvis off the root (mocap); pelvisY: hip height; pelvis: [ pitch, yaw, roll ]; torso: [ pitch, yaw, roll ] relative to the pelvis;
//   head: [ pitch, yaw ] relative to the torso;
//   footL / footR: [ x, y, z ] ankle targets, footYawL / footYawR;
//   handL / handR: [ x, y, z ] wrist targets; elbow poles default out and back;
//   bat: null or { dir: [ x, y, z ] } held in the right hand (the left hand joins it when `twoHands`);
//   glove: true to show the glove on the glove hand (gloveHand 'L' or 'R').
export function neutralPose() {

	return {
		pelvisX: 0, pelvisY: DIM.hip, pelvisZ: 0, pelvis: [ 0, 0, 0 ], torso: [ 0, 0, 0 ], head: [ 0, 0 ],
		footL: [ - 0.12, 0.08, 0 ], footR: [ 0.12, 0.08, 0 ], footYawL: 0, footYawR: 0,
		handL: [ - 0.24, 0.95, 0.02 ], handR: [ 0.24, 0.95, 0.02 ],
		bat: null, twoHands: false, glove: true,
	};

}

const _m = new Matrix4(), _m2 = new Matrix4(), _q = new Quaternion(), _e = new Euler( 0, 0, 0, 'YXZ' );
const _v = new Vector3(), _a = new Vector3(), _b = new Vector3(), _c = new Vector3(), _k = new Vector3(), _t = new Vector3();
const _x = new Vector3(), _y = new Vector3(), _z = new Vector3(), _p = new Vector3();

// Writes the NB bone matrices (column-major, 16 floats each) of a player standing at `root` (a matrix:
// position and heading in the field frame) in `pose` into out[ offset .. ].
export function solvePose( root, pose, out, offset, gloveHand = 'L' ) {

	const D = DIM, B = BONES;
	const put = ( b, m ) => m.toArray( out, offset + b * 16 );
	// pelvis
	const pelvis = new Matrix4().copy( root ).multiply( _m.compose( _t.set( pose.pelvisX || 0, pose.pelvisY, pose.pelvisZ || 0 ), _q.setFromEuler( _e.set( pose.pelvis[ 0 ], pose.pelvis[ 1 ], pose.pelvis[ 2 ] ) ), _v.set( 1, 1, 1 ) ) );
	put( B.pelvis, pelvis );
	// torso and head
	const torso = new Matrix4().copy( pelvis ).multiply( _m.compose( _t.set( 0, D.waist, 0 ), _q.setFromEuler( _e.set( pose.torso[ 0 ], pose.torso[ 1 ], pose.torso[ 2 ] ) ), _v.set( 1, 1, 1 ) ) );
	put( B.torso, torso );
	const head = new Matrix4().copy( torso ).multiply( _m.compose( _t.set( 0, D.torso - 0.005, 0 ), _q.setFromEuler( _e.set( pose.head[ 0 ], pose.head[ 1 ], 0 ) ), _v.set( 1, 1, 1 ) ) );
	put( B.head, head );

	// limb targets are in the player's frame: into the field frame through `root`
	const tgt = ( a, v ) => v.set( a[ 0 ], a[ 1 ], a[ 2 ] ).applyMatrix4( root );
	// the player's forward (-z) and right (+x) in the field frame, for the poles
	const fwd = _p.set( 0, 0, - 1 ).transformDirection( root ).clone(), right = new Vector3( 1, 0, 0 ).transformDirection( root );

	// legs: hips from the pelvis, knees bend forward
	for ( const [ side, th, sh, ft, foot, yaw ] of [ [ - 1, B.thighL, B.shinL, B.footL, pose.footL, pose.footYawL ], [ 1, B.thighR, B.shinR, B.footR, pose.footR, pose.footYawR ] ] ) {

		const hip = new Vector3( side * D.hipWidth, - 0.04, 0 ).applyMatrix4( pelvis );
		const target = tgt( foot, new Vector3() );
		const [ knee, end ] = twoBone( hip, target, D.thigh, D.shin, fwd.clone().addScaledVector( right, side * 0.15 ) );
		put( th, boneMatrix( hip, knee, fwd ) );
		put( sh, boneMatrix( knee, end, fwd ) );
		// the foot: flat on its yaw, at the ankle
		const fy = new Vector3( 0, 1, 0 );
		const ff = fwd.clone().applyAxisAngle( fy, yaw || 0 );
		put( ft, basisAt( end, ff.clone().cross( fy ).normalize(), fy, ff.clone().negate() ) );

	}

	// arms: shoulders from the torso, elbows bend down and back
	const handPos = {};
	for ( const [ side, ua, fa, hd, hand ] of [ [ - 1, B.upperArmL, B.forearmL, B.handL, pose.handL ], [ 1, B.upperArmR, B.forearmR, B.handR, pose.handR ] ] ) {

		const sh = new Vector3( side * D.shoulder, D.shoulderY, 0 ).applyMatrix4( torso );
		const target = tgt( hand, new Vector3() );
		const pole = new Vector3( 0, - 1, 0 ).addScaledVector( fwd, - 0.6 ).addScaledVector( right, side * 0.8 );
		const [ elbow, wrist ] = twoBone( sh, target, D.upperArm, D.forearm, pole );
		put( ua, boneMatrix( sh, elbow, fwd ) );
		put( fa, boneMatrix( elbow, wrist, fwd ) );
		const dir = wrist.clone().sub( elbow ).normalize();
		const hm = boneMatrix( wrist, wrist.clone().addScaledVector( dir, D.hand ), fwd );
		put( hd, hm );
		handPos[ side ] = { wrist, hm };

	}

	// the glove on the glove hand, hidden (collapsed) without one
	const gh = gloveHand === 'L' ? handPos[ - 1 ] : handPos[ 1 ];
	put( B.glove, pose.glove ? gh.hm : _m2.makeScale( 0, 0, 0 ) );
	// the bat: from the right hand along its direction
	if ( pose.bat ) {

		const d = _v.set( pose.bat.dir[ 0 ], pose.bat.dir[ 1 ], pose.bat.dir[ 2 ] ).transformDirection( root ).normalize();
		const knob = handPos[ 1 ].wrist.clone().addScaledVector( d, - 0.04 );
		// bat bone: +y along the bat
		const up = d.clone();
		const side = Math.abs( up.y ) > 0.9 ? new Vector3( 1, 0, 0 ) : new Vector3( 0, 1, 0 );
		const x = side.clone().cross( up ).normalize(), z = x.clone().cross( up ).normalize();
		put( B.bat, basisAt( knob, x, up, z ) );

	} else {

		put( B.bat, _m2.makeScale( 0, 0, 0 ) );

	}

	return handPos;

}

// Two-bone IK: from joint A toward target T with segment lengths l1, l2; the middle joint bends toward
// `pole`. Returns [ middle, end ] (end = T pulled in if out of reach).
export function twoBone( A, T, l1, l2, pole ) {

	const d = _a.copy( T ).sub( A );
	let len = d.length();
	const maxL = l1 + l2 - 1e-3, minL = Math.abs( l1 - l2 ) + 1e-3;
	const u = d.clone().normalize();
	if ( len > maxL ) len = maxL;
	if ( len < minL ) len = minL;
	const end = A.clone().addScaledVector( u, len );
	const a = ( l1 * l1 - l2 * l2 + len * len ) / ( 2 * len );
	const h = Math.sqrt( Math.max( 0, l1 * l1 - a * a ) );
	const p = pole.clone().addScaledVector( u, - pole.dot( u ) );
	if ( p.lengthSq() < 1e-8 ) p.set( 0, 0, - 1 ).addScaledVector( u, - u.z );
	p.normalize();
	const mid = A.clone().addScaledVector( u, a ).addScaledVector( p, h );
	return [ mid, end ];

}

// A bone from joint `a` to joint `b`: its local -y runs along the segment (the meshes hang down their
// bones), local -z toward `front` as near as possible.
function boneMatrix( a, b, front ) {

	_y.copy( a ).sub( b ).normalize(); // +y points back up the segment
	_z.copy( front ).negate().addScaledVector( _y, front.dot( _y ) ).normalize();
	if ( _z.lengthSq() < 1e-6 ) _z.set( 0, 0, 1 );
	_x.copy( _y ).cross( _z ).normalize();
	_z.copy( _x ).cross( _y ).normalize();
	return basisAt( a, _x, _y, _z );

}

function basisAt( o, x, y, z ) {

	return new Matrix4().makeBasis( x, y, z ).setPosition( o );

}

void _b; void _c; void _k;

// A pose baked into a static mesh (statues): the body posed on the CPU, in the player's own frame (feet
// on y = 0, facing -z). Parts listed in `drop` (PART codes) are left out.
export function bakePose( pose, { gloveHand = 'L', drop = [] } = {} ) {

	const src = buildPlayerGeometry();
	const mats = new Float32Array( NB * 16 );
	solvePose( new Matrix4(), pose, mats, 0, gloveHand );
	const P = src.getAttribute( 'position' ), N = src.getAttribute( 'normal' ), Bn = src.getAttribute( 'aBone' ), Pt = src.getAttribute( 'aPart' );
	const index = src.index.array;
	const m = new Matrix4(), v = new Vector3(), n = new Vector3();
	const pos = [], nrm = [], part = [];
	for ( let i = 0; i < index.length; i += 3 ) {

		const tri = [ index[ i ], index[ i + 1 ], index[ i + 2 ] ];
		if ( tri.some( ( k ) => drop.includes( Math.round( Pt.array[ k ] ) ) ) ) continue;
		for ( const k of tri ) {

			m.fromArray( mats, Math.round( Bn.array[ k ] ) * 16 );
			v.fromBufferAttribute( P, k ).applyMatrix4( m );
			n.fromBufferAttribute( N, k ).transformDirection( m );
			pos.push( v.x, v.y, v.z );
			nrm.push( n.x, n.y, n.z );
			part.push( Pt.array[ k ] );

		}

	}

	const g = new BufferGeometry();
	g.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
	g.setAttribute( 'normal', new Float32BufferAttribute( nrm, 3 ) );
	g.setAttribute( 'aPart', new Float32BufferAttribute( part, 1 ) );
	g.computeBoundingBox();
	g.computeBoundingSphere();
	return g;

}
