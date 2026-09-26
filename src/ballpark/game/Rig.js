import { BufferGeometry, Float32BufferAttribute, BoxGeometry, CylinderGeometry, SphereGeometry, Matrix4, Vector3, Quaternion, Euler } from '../../engine/index.js';

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

export const PART = { skin: 0, jersey: 1, pants: 2, socks: 3, shoes: 4, cap: 5, glove: 6, bat: 7, belt: 8, sleeve: 9 };

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
		const nm = new Matrix4().copy( m ).invert().transpose();
		for ( let i = 0; i < P.count; i ++ ) {

			v.fromBufferAttribute( P, i ).applyMatrix4( m );
			n.fromBufferAttribute( N, i ).applyMatrix4( nm ).normalize();
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
	const cyl = ( r0, r1, h, seg = 10 ) => new CylinderGeometry( r0, r1, h, seg, 1, false );
	const sph = ( r, w = 12, h = 8 ) => new SphereGeometry( r, w, h );
	// pelvis: the seat of the pants and the belt
	add( sph( 0.17, 14, 10 ), B.pelvis, P.pants, 0, - 0.02, 0.01, 0, 0, 0, 1.05, 0.72, 0.78 );
	add( cyl( 0.17, 0.17, 0.05, 14 ), B.pelvis, P.belt, 0, 0.1, 0, 0, 0, 0, 1, 1, 0.75 );
	// torso: waist to chest, a tapered, flattened cylinder; the shoulders
	add( cyl( 0.2, 0.165, D.torso * 0.72, 14 ), B.torso, P.jersey, 0, D.torso * 0.38, 0, 0, 0, 0, 1, 1, 0.62 );
	add( sph( 0.2, 14, 10 ), B.torso, P.jersey, 0, D.torso * 0.78, 0, 0, 0, 0, 1.12, 0.55, 0.64 );
	// head: neck, head, cap and brim (the brim over the face, -z)
	add( cyl( 0.055, 0.06, 0.12 ), B.head, P.skin, 0, 0.05, 0 );
	add( sph( 0.108, 14, 10 ), B.head, P.skin, 0, 0.2, 0, 0, 0, 0, 0.92, 1.05, 1 );
	add( sph( 0.116, 14, 8 ), B.head, P.cap, 0, 0.235, 0.005, 0, 0, 0, 0.95, 0.72, 1.02 );
	add( cyl( 0.09, 0.09, 0.012, 14 ), B.head, P.cap, 0, 0.22, - 0.095, 0.12, 0, 0, 1, 1, 0.75 );
	// arms: sleeves on the upper arm, skin below
	for ( const [ ua, fa, hd ] of [ [ B.upperArmL, B.forearmL, B.handL ], [ B.upperArmR, B.forearmR, B.handR ] ] ) {

		add( sph( 0.062 ), ua, P.jersey, 0, - 0.02, 0 );
		add( cyl( 0.062, 0.05, D.upperArm * 0.55 ), ua, P.jersey, 0, - D.upperArm * 0.28, 0 );
		add( cyl( 0.05, 0.044, D.upperArm * 0.5 ), ua, P.sleeve, 0, - D.upperArm * 0.75, 0 );
		add( cyl( 0.044, 0.035, D.forearm ), fa, P.sleeve, 0, - D.forearm / 2, 0 );
		add( sph( 0.042 ), hd, P.skin, 0, - 0.04, 0, 0, 0, 0, 0.8, 1.2, 0.6 );

	}

	// the glove, on its own bone (it follows the glove hand)
	add( sph( 0.1, 12, 8 ), B.glove, P.glove, 0, - 0.07, - 0.02, 0, 0, 0, 0.95, 1.25, 0.45 );
	// legs: pants to below the knee, then the socks, then the shoes
	for ( const [ th, sh, ft ] of [ [ B.thighL, B.shinL, B.footL ], [ B.thighR, B.shinR, B.footR ] ] ) {

		add( cyl( 0.092, 0.07, D.thigh, 12 ), th, P.pants, 0, - D.thigh / 2, 0 );
		add( sph( 0.072 ), sh, P.pants, 0, 0, 0 );
		add( cyl( 0.07, 0.058, D.shin * 0.35, 12 ), sh, P.pants, 0, - D.shin * 0.17, 0 );
		add( cyl( 0.058, 0.043, D.shin * 0.65, 12 ), sh, P.socks, 0, - D.shin * 0.67, 0 );
		add( new BoxGeometry( 0.1, 0.075, D.footLen ), ft, P.shoes, 0, - 0.035, - 0.07 );

	}

	// the bat, along the bat bone from the knob (at the hands) to the barrel
	add( cyl( 0.017, 0.022, 0.1, 8 ), B.bat, P.bat, 0, 0.0, 0 );
	add( cyl( 0.014, 0.017, 0.35, 8 ), B.bat, P.bat, 0, 0.22, 0 );
	add( cyl( 0.017, 0.034, 0.18, 8 ), B.bat, P.bat, 0, 0.48, 0 );
	add( cyl( 0.034, 0.034, 0.3, 8 ), B.bat, P.bat, 0, 0.72, 0 );

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
//   pelvisY: hip height; pelvis: [ pitch, yaw, roll ]; torso: [ pitch, yaw, roll ] relative to the pelvis;
//   head: [ pitch, yaw ] relative to the torso;
//   footL / footR: [ x, y, z ] ankle targets, footYawL / footYawR;
//   handL / handR: [ x, y, z ] wrist targets; elbow poles default out and back;
//   bat: null or { dir: [ x, y, z ] } held in the right hand (the left hand joins it when `twoHands`);
//   glove: true to show the glove on the glove hand (gloveHand 'L' or 'R').
export function neutralPose() {

	return {
		pelvisY: DIM.hip, pelvis: [ 0, 0, 0 ], torso: [ 0, 0, 0 ], head: [ 0, 0 ],
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
	const pelvis = new Matrix4().copy( root ).multiply( _m.compose( _t.set( 0, pose.pelvisY, 0 ), _q.setFromEuler( _e.set( pose.pelvis[ 0 ], pose.pelvis[ 1 ], pose.pelvis[ 2 ] ) ), _v.set( 1, 1, 1 ) ) );
	put( B.pelvis, pelvis );
	// torso and head
	const torso = new Matrix4().copy( pelvis ).multiply( _m.compose( _t.set( 0, D.waist, 0 ), _q.setFromEuler( _e.set( pose.torso[ 0 ], pose.torso[ 1 ], pose.torso[ 2 ] ) ), _v.set( 1, 1, 1 ) ) );
	put( B.torso, torso );
	const head = new Matrix4().copy( torso ).multiply( _m.compose( _t.set( 0, D.torso + 0.02, 0 ), _q.setFromEuler( _e.set( pose.head[ 0 ], pose.head[ 1 ], 0 ) ), _v.set( 1, 1, 1 ) ) );
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
