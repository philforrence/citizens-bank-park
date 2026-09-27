import { BufferGeometry, Float32BufferAttribute, BoxGeometry, CylinderGeometry, SphereGeometry, LatheGeometry, TorusGeometry, Matrix3, Matrix4, Vector2, Vector3, Quaternion, Euler } from '../../engine/index.js';
import { BODY } from './data/body.js';

// A ballplayer's body: 17 bones and one continuous skinned mesh (data/body.js: the MakeHuman base mesh
// shaped into a 6'2" athlete, the fingers closed in a grip, every vertex weighted to up to four of our
// bones; tools/build-body.mjs), plus rigid pieces on single bones (the cap or the batting helmet, the
// catcher's gear, the cleats, the glove, the bat). Every vertex carries a "part" (which piece it is:
// the body's own uniform regions are worked out in the shader from how far along the arm or leg it is)
// and its bones and weights, in the bind pose. The pose: the trunk by forward kinematics, arms and legs
// by two-bone IK toward hand and foot targets (knees and elbows bend toward pole directions), a bat held
// by the right hand.
//
// Units: metres. The player's own frame: y up, facing -z (so +x is his right). Bone matrices come out in
// the frame the player stands in (the field frame); skinMatrices() turns them into the matrices that take
// the bind pose there, ready for the GPU.

export const BONES = {
	pelvis: 0, torso: 1, head: 2,
	upperArmL: 3, forearmL: 4, handL: 5,
	upperArmR: 6, forearmR: 7, handR: 8,
	thighL: 9, shinL: 10, footL: 11,
	thighR: 12, shinR: 13, footR: 14,
	bat: 15, glove: 16,
};
export const NB = 17;

export const PART = { skin: 0, jersey: 1, pants: 2, socks: 3, shoes: 4, cap: 5, glove: 6, bat: 7, belt: 8, sleeve: 9, helmet: 10, gear: 11, mask: 12, hair: 13, body: 14, eye: 15,
	// the pieces only some wear (Players.js shows them by the slot's role and kind): the batting helmet's
	// ear flaps, the catcher's skull cap and the mask's pads, the catcher's and first baseman's mitts, the
	// plate umpire's ball bag, the grounds crew's rake and rain hood, the Phanatic's head, snout and eyes,
	// glasses
	flapL: 16, flapR: 17, ccap: 18, maskPad: 19, mittC: 20, mitt1B: 21, bag: 22, rake: 23, hood: 24, phHead: 25, snout: 26, phEye: 27, glasses: 28 };
// the optional pieces (left out of statues)
export const OPTIONAL = [ 10, 11, 12, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28 ];

// body dimensions (a 6'2" player), measured off the mesh's skeleton
export const DIM = { ...BODY.dim };
// where the uniform's pieces end (Players.js): along the arm from the shoulder joint, along the leg
// from the hip joint, the belt's band, the collar
export const UNIFORM = BODY.uniform;
export const FACE = BODY.face;
export const JOINTS = BODY.joints;

// ---------------------------------------------------------------- the bind pose

// the pose the mesh was modelled in: MakeHuman's A pose, hands and feet where its joints are
export function bindPose() {

	const J = BODY.joints;
	return {
		pelvisX: 0, pelvisY: DIM.hip, pelvisZ: 0, pelvis: [ 0, 0, 0 ], torso: [ 0, 0, 0 ], head: [ 0, 0 ],
		footL: J.ankleL.slice(), footR: J.ankleR.slice(), footYawL: 0, footYawR: 0,
		handL: J.wristL.slice(), handR: J.wristR.slice(),
		bat: null, twoHands: false, glove: true,
	};

}

let _bind = null, _inv = null;
// the bones' matrices in the bind pose, and their inverses (NB * 16 floats each)
export function bindMatrices() {

	if ( ! _bind ) {

		_bind = new Float32Array( NB * 16 );
		solvePose( new Matrix4(), bindPose(), _bind, 0, 'L' );
		// the bat has no place in the bind pose: its pieces are modelled in its own frame
		new Matrix4().toArray( _bind, BONES.bat * 16 );
		_inv = new Float32Array( NB * 16 );
		const m = new Matrix4();
		for ( let b = 0; b < NB; b ++ ) m.fromArray( _bind, b * 16 ).invert().toArray( _inv, b * 16 );

	}

	return { bind: _bind, inverse: _inv };

}

const _sm = new Matrix4(), _si = new Matrix4();
// out[ offset .. ] holds the NB bone matrices of a solved pose: turn each into bone * inverse( bind )
export function skinMatrices( out, offset ) {

	const { inverse } = bindMatrices();
	for ( let b = 0; b < NB; b ++ ) {

		_sm.fromArray( out, offset + b * 16 ).multiply( _si.fromArray( inverse, b * 16 ) ).toArray( out, offset + b * 16 );

	}

}

function decode( b64, Type ) {

	const bin = typeof atob === 'function' ? Uint8Array.from( atob( b64 ), ( c ) => c.charCodeAt( 0 ) ) : new Uint8Array( Buffer.from( b64, 'base64' ) );
	return new Type( bin.buffer, bin.byteOffset, bin.byteLength / Type.BYTES_PER_ELEMENT );

}

// ---------------------------------------------------------------- the mesh

// Attributes: position and normal (bind pose), aBones / aWeights (vec4), aPart, aField (the body's
// distance along the arm and along the leg, -1 elsewhere).
export function buildPlayerGeometry() {

	const pos = [], nrm = [], bones = [], weights = [], part = [], field = [], index = [];
	const Q = BODY.scale;

	// the body
	{

		const P = decode( BODY.position, Int16Array ), N = decode( BODY.normal, Int8Array ), I = decode( BODY.bones, Uint8Array ), W = decode( BODY.weights, Uint8Array );
		const F = decode( BODY.field, Int16Array ), G = decode( BODY.flag, Uint8Array ), X = decode( BODY.index, Uint16Array );
		for ( let i = 0; i < BODY.count; i ++ ) {

			pos.push( P[ i * 3 ] / Q, P[ i * 3 + 1 ] / Q, P[ i * 3 + 2 ] / Q );
			const n = new Vector3( N[ i * 3 ], N[ i * 3 + 1 ], N[ i * 3 + 2 ] ).normalize();
			nrm.push( n.x, n.y, n.z );
			for ( let c = 0; c < 4; c ++ ) {

				bones.push( I[ i * 4 + c ] );
				weights.push( W[ i * 4 + c ] / 255 );

			}

			part.push( G[ i ] ? PART.eye : PART.body );
			field.push( F[ i * 2 ] / Q, F[ i * 2 + 1 ] / Q );

		}

		for ( let i = 0; i < X.length; i ++ ) index.push( X[ i ] );

	}

	// the rigid pieces: modelled in their bone's own frame, placed in the bind pose
	const { bind } = bindMatrices();
	const m = new Matrix4(), bm = new Matrix4(), q = new Quaternion(), e = new Euler(), s = new Vector3(), t = new Vector3();
	let mark = - 1; // aField.x of the rigid pieces: -2 marks the glove's laced web
	const add = ( geo, b, p, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 ) => {

		m.compose( t.set( x, y, z ), q.setFromEuler( e.set( rx, ry, rz ) ), s.set( sx, sy, sz ) );
		m.premultiply( bm.fromArray( bind, b * 16 ) );
		const P = geo.getAttribute( 'position' ), N = geo.getAttribute( 'normal' );
		const base = pos.length / 3;
		const v = new Vector3(), n = new Vector3();
		const nm = new Matrix3().getNormalMatrix( m );
		for ( let i = 0; i < P.count; i ++ ) {

			v.fromBufferAttribute( P, i ).applyMatrix4( m );
			n.fromBufferAttribute( N, i ).applyMatrix3( nm ).normalize();
			pos.push( v.x, v.y, v.z );
			nrm.push( n.x, n.y, n.z );
			bones.push( b, 0, 0, 0 );
			weights.push( 1, 0, 0, 0 );
			part.push( p );
			field.push( mark, - 1 );

		}

		const I = geo.index;
		if ( I ) for ( let i = 0; i < I.count; i ++ ) index.push( base + I.array[ i ] );
		else for ( let i = 0; i < P.count; i ++ ) index.push( base + i );

	};

	const B = BONES, P = PART, D = DIM, F = FACE;
	const cyl = ( r0, r1, h, seg = 12 ) => new CylinderGeometry( r0, r1, h, seg, 1, false );
	const sph = ( r, w = 12, h = 8 ) => new SphereGeometry( r, w, h );
	const dome = ( r, w, h, thetaLen ) => new SphereGeometry( r, w, h, 0, Math.PI * 2, 0, thetaLen );
	// a lathed shape: profile [ [ radius, y ], ... ] bottom to top, closed at both ends
	const lathe = ( prof, seg = 16 ) => new LatheGeometry( [ new Vector2( 0, prof[ 0 ][ 1 ] ), ...prof.map( ( [ r, y ] ) => new Vector2( r, y ) ), new Vector2( 0, prof[ prof.length - 1 ][ 1 ] ) ], seg );

	// ---- the head's pieces, placed on the skull (the head bone's frame is the bind pose's axes, from its pivot)
	const hb = new Vector3().fromArray( bind, B.head * 16 + 12 );
	const skullZ = ( F.skull.z0 + F.skull.z1 ) / 2 - hb.z, skullY = F.top[ 1 ] - 0.1 - hb.y;
	const rx = F.skull.x + 0.013, rz = ( F.skull.z1 - F.skull.z0 ) / 2 + 0.011;
	// the cap: a crown over the skull down to the brow in front and the hairline behind (the dome tipped
	// back), the button, the bill
	add( dome( 1, 24, 12, Math.PI * 0.56 ), B.head, P.cap, 0, skullY - 0.004, skullZ, 0.22, 0, 0, rx, 0.1, rz );
	add( cyl( 0.009, 0.009, 0.01, 8 ), B.head, P.cap, 0, skullY + 0.093, skullZ - 0.02 );
	add( lathe( [ [ 0.0, - 0.003 ], [ 0.086, - 0.003 ], [ 0.086, 0.003 ], [ 0.0, 0.003 ] ], 24 ), B.head, P.cap, 0, skullY + 0.004, skullZ - rz + 0.012, 0.22, 0, 0, 0.95, 1, 0.9 );
	// the batting helmet: a shell down over the ears, a short bill; the ear flaps (the one toward the
	// pitcher: a right-handed hitter's on his left ear, a lefty's on his right, switch hitters both)
	add( dome( 1, 24, 14, Math.PI * 0.62 ), B.head, P.helmet, 0, skullY - 0.004, skullZ + 0.004, 0.12, 0, 0, rx + 0.017, 0.128, rz + 0.016 );
	add( sph( 0.05, 12, 8 ), B.head, P.flapL, - rx - 0.004, skullY - 0.075, skullZ + 0.02, 0, 0, 0, 0.36, 1.15, 1.05 );
	add( sph( 0.05, 12, 8 ), B.head, P.flapR, rx + 0.004, skullY - 0.075, skullZ + 0.02, 0, 0, 0, 0.36, 1.15, 1.05 );
	add( lathe( [ [ 0.0, - 0.004 ], [ 0.07, - 0.004 ], [ 0.07, 0.004 ], [ 0.0, 0.004 ] ], 20 ), B.head, P.helmet, 0, skullY - 0.01, skullZ - rz - 0.004, 0.12, 0, 0, 1.15, 1, 0.62 );
	// the catcher's skull cap: the shell without flaps, worn backwards (the short bill over his neck)
	add( dome( 1, 20, 10, Math.PI * 0.55 ), B.head, P.ccap, 0, skullY - 0.004, skullZ + 0.004, - 0.1, 0, 0, rx + 0.014, 0.122, rz + 0.013 );
	add( lathe( [ [ 0.0, - 0.004 ], [ 0.065, - 0.004 ], [ 0.065, 0.004 ], [ 0.0, 0.004 ] ], 16 ), B.head, P.ccap, 0, skullY - 0.004, skullZ + rz + 0.004, - 0.2, 0, 0, 1.1, 1, 0.5 );
	// the mask (the catcher's and the plate umpire's): a steel frame curving back round the face, bars
	// across it below the eyes and two down the middle, a throat guard hanging under the chin, the
	// leather pads behind the frame
	{

		const cy = F.eyeL[ 1 ] - 0.04 - hb.y, cz = F.skull.z0 - 0.028 - hb.z;
		const bend = ( geo, k = 3.2 ) => {

			const pa = geo.getAttribute( 'position' );
			for ( let i = 0; i < pa.count; i ++ ) pa.setZ( i, pa.getZ( i ) + k * pa.getX( i ) ** 2 );
			geo.computeVertexNormals();
			return geo;

		};

		const ring = new TorusGeometry( 1, 0.075, 5, 28 );
		ring.scale( 0.088, 0.118, 0.1 );
		add( bend( ring ), B.head, P.mask, 0, cy, cz );
		for ( const y of [ - 0.03, 0.0, 0.035, 0.068 ] ) {

			const w = Math.sqrt( Math.max( 0, 1 - ( ( y + 0.005 ) / 0.118 ) ** 2 ) ) * 0.088;
			const bar = new CylinderGeometry( 0.0035, 0.0035, 2 * w, 5, 6 );
			bar.rotateZ( Math.PI / 2 );
			add( bend( bar ), B.head, P.mask, 0, cy - y, cz - 0.002 );

		}

		for ( const x of [ - 0.022, 0.022 ] ) {

			const bar = new CylinderGeometry( 0.0035, 0.0035, 0.12, 5, 1 );
			bar.translate( x, 0, 0 );
			add( bend( bar ), B.head, P.mask, 0, cy - 0.055, cz - 0.003 );

		}

		// the throat guard
		add( sph( 0.04, 10, 6 ), B.head, P.mask, 0, cy - 0.14, cz + 0.02, 0.5, 0, 0, 1.05, 0.9, 0.2 );
		// the pads: forehead, chin and cheeks
		const pad = new TorusGeometry( 1, 0.16, 5, 22 );
		pad.scale( 0.074, 0.1, 0.12 );
		add( bend( pad, 3.8 ), B.head, P.maskPad, 0, cy, cz + 0.014 );

	}

	// the hood of a rain jacket, over the cap (the grounds crew in the downpour)
	add( dome( 1, 20, 10, Math.PI * 0.64 ), B.head, P.hood, 0, skullY - 0.02, skullZ + 0.012, 0.3, 0, 0, rx + 0.03, 0.14, rz + 0.03 );
	// glasses: two thin rims, the bridge, the arms back to the ears
	{

		const eyeY = F.eyeL[ 1 ] - hb.y, eyeZ = F.eyeL[ 2 ] - hb.z - 0.019;
		for ( const sx of [ - 1, 1 ] ) {

			const rim = new TorusGeometry( 1, 0.12, 4, 16 );
			rim.scale( 0.024, 0.019, 0.02 );
			add( rim, B.head, P.glasses, sx * 0.032, eyeY, eyeZ );
			add( cyl( 0.0025, 0.0025, 0.1, 4 ), B.head, P.glasses, sx * 0.064, eyeY + 0.004, eyeZ + 0.052, Math.PI / 2, 0, 0 );

		}

		add( cyl( 0.0025, 0.0025, 0.018, 4 ), B.head, P.glasses, 0, eyeY + 0.006, eyeZ, 0, 0, Math.PI / 2 );

	}

	// the Phillie Phanatic's head: a great round shaggy head, the long tube of a snout reaching forward
	// and down, two big eyes under their lids
	{

		const hy = skullY + 0.1, hz = skullZ - 0.01;
		add( sph( 1, 22, 16 ), B.head, P.phHead, 0, hy, hz, 0, 0, 0, 0.25, 0.26, 0.25 );
		const snout = cyl( 0.075, 0.1, 0.34, 16 );
		add( snout, B.head, P.snout, 0, hy - 0.1, hz - 0.33, Math.PI / 2 + 0.35, 0, 0 );
		add( new TorusGeometry( 0.075, 0.022, 6, 16 ), B.head, P.snout, 0, hy - 0.16, hz - 0.49, 0.35, 0, 0 );
		for ( const sx of [ - 1, 1 ] ) add( sph( 0.078, 14, 10 ), B.head, P.phEye, sx * 0.1, hy + 0.08, hz - 0.19, 0, sx * 0.25, 0 );

	}

	// the catcher's chest protector: a padded plate curving round his chest from the collar to the belt,
	// the shoulders capped, a flap over the belly
	{

		const plate = new BoxGeometry( 0.37, 0.46, 0.035, 10, 10, 1 );
		const pa = plate.getAttribute( 'position' );
		for ( let i = 0; i < pa.count; i ++ ) {

			const x = pa.getX( i ), y = pa.getY( i );
			const taper = 1 - 0.18 * Math.max( 0, - y / 0.23 );
			pa.setX( i, x * taper );
			pa.setZ( i, pa.getZ( i ) + 2.4 * ( x * taper ) ** 2 - 0.05 * ( y / 0.23 ) ** 2 );

		}

		plate.computeVertexNormals();
		add( plate, B.torso, P.gear, 0, 0.25, - 0.155 );
		for ( const sx of [ - 1, 1 ] ) add( sph( 0.07, 10, 6 ), B.torso, P.gear, sx * 0.16, 0.44, - 0.04, 0, 0, sx * 0.35, 1.1, 0.35, 1.2 );
		add( new BoxGeometry( 0.2, 0.1, 0.03 ), B.torso, P.gear, 0, - 0.02, - 0.14, - 0.15, 0, 0 );

	}

	// the shin guards: a shell down the front of each shin, the knee cap, the flap over the instep; the
	// knee savers behind the knees
	for ( const [ sh, th ] of [ [ B.shinL, B.thighL ], [ B.shinR, B.thighR ] ] ) {

		add( new CylinderGeometry( 0.066, 0.056, D.shin * 0.78, 12, 1, true, Math.PI / 2 - 0.2, Math.PI + 0.4 ), sh, P.gear, 0, - D.shin * 0.46, 0.0 );
		add( sph( 0.064, 12, 8 ), sh, P.gear, 0, - 0.015, - 0.045, 0, 0, 0, 1.0, 1.15, 0.75 );
		add( new BoxGeometry( 0.085, 0.07, 0.02 ), sh, P.gear, 0, - D.shin + 0.035, - 0.085, 0.6, 0, 0 );
		add( new BoxGeometry( 0.11, 0.1, 0.07 ), th, P.gear, 0, - D.thigh + 0.07, 0.07 );

	}

	// the plate umpire's ball bags, one on each hip
	for ( const sx of [ - 1, 1 ] ) add( new BoxGeometry( 0.1, 0.12, 0.085 ), B.pelvis, P.bag, sx * 0.185, - 0.05, 0.0, 0, sx * 0.3, 0 );

	// the cleats: a lofted shoe on each foot (the ankle is the frame's origin; the sole on the ground)
	const ankleY = BODY.joints.ankleL[ 1 ];
	for ( const ft of [ B.footL, B.footR ] ) add( cleat( ankleY ), ft, P.shoes );

	// the glove: the pocket and heel, four finger stalls fanning out, the thumb, the laced web between
	// the thumb and the first finger
	const capsule = ( r, b, x0, y0, x1, y1, z = - 0.02 ) => {

		const dx = x1 - x0, dy = y1 - y0, L = Math.hypot( dx, dy ), a = Math.atan2( dx, - dy );
		add( cyl( r, r * 0.92, L, 10 ), b, P.glove, ( x0 + x1 ) / 2, ( y0 + y1 ) / 2, z, 0, 0, a, 1, 1, 0.8 );
		add( sph( r * 0.92, 10, 6 ), b, P.glove, x1, y1, z, 0, 0, 0, 1, 1, 0.8 );

	};

	add( sph( 0.1, 16, 12 ), B.glove, P.glove, 0, - 0.075, - 0.02, 0, 0, 0, 0.92, 1.12, 0.36 );
	for ( const [ x, x1 ] of [ [ - 0.052, - 0.07 ], [ - 0.018, - 0.022 ], [ 0.016, 0.024 ], [ 0.048, 0.07 ] ] ) capsule( 0.022, B.glove, x, - 0.13, x1, - 0.265 + Math.abs( x ) * 0.5 );
	capsule( 0.024, B.glove, 0.07, - 0.04, 0.115, - 0.2, - 0.03 );
	mark = - 2;
	add( new BoxGeometry( 0.05, 0.1, 0.012 ), B.glove, P.glove, 0.085, - 0.21, - 0.03, 0, 0, - 0.2 );
	// the catcher's mitt: a round, thick pillow with a laced rim and a stubby thumb; the first baseman's:
	// a long scoop with a laced web
	add( new TorusGeometry( 0.112, 0.014, 5, 20 ), B.glove, P.mittC, 0, - 0.105, - 0.022, 0, 0, 0, 1.08, 1.04, 1 );
	mark = - 1;
	add( sph( 0.1, 16, 12 ), B.glove, P.mittC, 0, - 0.105, - 0.02, 0, 0, 0, 1.2, 1.16, 0.52 );
	add( sph( 0.1, 10, 6 ), B.glove, P.mittC, 0.105, - 0.05, - 0.035, 0, 0, - 0.5, 0.32, 0.55, 0.36 );
	add( sph( 0.1, 16, 12 ), B.glove, P.mitt1B, 0, - 0.125, - 0.02, 0, 0, 0, 0.82, 1.55, 0.42 );
	mark = - 2;
	add( new BoxGeometry( 0.05, 0.11, 0.012 ), B.glove, P.mitt1B, 0.07, - 0.21, - 0.028, 0, 0, - 0.15 );
	mark = - 1;

	// the bat, along the bat bone from the knob (at the hands) to the barrel
	add( cyl( 0.02, 0.02, 0.012, 12 ), B.bat, P.bat, 0, - 0.006, 0 );
	add( cyl( 0.013, 0.015, 0.36, 12 ), B.bat, P.bat, 0, 0.18, 0 );
	add( cyl( 0.015, 0.033, 0.2, 12 ), B.bat, P.bat, 0, 0.46, 0 );
	add( cyl( 0.033, 0.033, 0.28, 12 ), B.bat, P.bat, 0, 0.7, 0 );
	add( sph( 0.033, 12, 6 ), B.bat, P.bat, 0, 0.84, 0, 0, 0, 0, 1, 0.3, 1 );
	// the grounds crew's rake, on the same bone: the handle through the right hand, the head at the end
	add( cyl( 0.013, 0.013, 1.55, 6 ), B.bat, P.rake, 0, 0.55, 0 );
	add( new BoxGeometry( 0.62, 0.05, 0.035 ), B.bat, P.rake, 0, 1.33, 0.0 );
	add( new BoxGeometry( 0.6, 0.05, 0.008 ), B.bat, P.rake, 0, 1.37, 0.03, 0.4, 0, 0 );

	const g = new BufferGeometry();
	g.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
	g.setAttribute( 'normal', new Float32BufferAttribute( nrm, 3 ) );
	g.setAttribute( 'aBones', new Float32BufferAttribute( bones, 4 ) );
	g.setAttribute( 'aWeights', new Float32BufferAttribute( weights, 4 ) );
	g.setAttribute( 'aPart', new Float32BufferAttribute( part, 1 ) );
	g.setAttribute( 'aField', new Float32BufferAttribute( field, 2 ) );
	g.setIndex( index );
	g.computeBoundingSphere();
	return g;

}

// A cleat in the foot's frame (origin at the ankle, y up, toe toward -z): a loft of rounded sections
// from the heel to the toe, flat on the sole, the top rising to the collar round the ankle.
function cleat( ankleY ) {

	const y0 = - ankleY; // the ground
	// [ z, half width, top ]
	const S = [
		[ 0.078, 0.02, y0 + 0.05 ], [ 0.07, 0.036, y0 + 0.085 ], [ 0.045, 0.044, 0.028 ], [ 0.0, 0.047, 0.03 ], [ - 0.04, 0.049, 0.004 ],
		[ - 0.09, 0.05, y0 + 0.058 ], [ - 0.14, 0.047, y0 + 0.046 ], [ - 0.18, 0.041, y0 + 0.04 ], [ - 0.205, 0.03, y0 + 0.034 ], [ - 0.218, 0.012, y0 + 0.026 ],
	];
	const R = 16, pos = [], index = [];
	for ( const [ z, w, top ] of S ) {

		const h = ( top - y0 ) * 0.62, yc = top - h;
		for ( let k = 0; k < R; k ++ ) {

			const a = k / R * Math.PI * 2;
			pos.push( w * Math.cos( a ), Math.max( y0, yc + h * Math.sin( a ) ), z );

		}

	}

	for ( let i = 0; i < S.length - 1; i ++ ) for ( let k = 0; k < R; k ++ ) {

		const a = i * R + k, b = i * R + ( k + 1 ) % R, c = a + R, d = b + R;
		index.push( a, c, b, b, c, d );

	}

	// the heel and toe closed with a fan to their centres
	for ( const [ i, flip ] of [ [ 0, false ], [ S.length - 1, true ] ] ) {

		const c = pos.length / 3;
		pos.push( 0, ( S[ i ][ 2 ] + y0 ) / 2, S[ i ][ 0 ] );
		for ( let k = 0; k < R; k ++ ) {

			const a = i * R + k, b = i * R + ( k + 1 ) % R;
			if ( flip ) index.push( a, c, b );
			else index.push( a, b, c );

		}

	}

	const g = new BufferGeometry();
	g.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
	g.setIndex( index );
	g.computeVertexNormals();
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
// position and heading in the field frame, scaled by his height over the mesh's 6'2") in `pose` into
// out[ offset .. ]. `girth` (1 the mesh's athlete) makes the trunk and limbs broader or slighter; the
// head grows only a third as much as the body, a bat is a bat.
const _g = new Matrix4(), _hs = new Matrix4(), _pm = new Matrix4();
export function solvePose( root, pose, out, offset, gloveHand = 'L', girth = 1 ) {

	const D = DIM, B = BONES;
	const s = Math.cbrt( Math.abs( root.determinant() ) ) || 1;
	const g = girth;
	const put = ( b, m ) => m.toArray( out, offset + b * 16 );
	_g.makeScale( g, 1, g );
	// pelvis
	const pelvis = new Matrix4().copy( root ).multiply( _m.compose( _t.set( pose.pelvisX || 0, pose.pelvisY, pose.pelvisZ || 0 ), _q.setFromEuler( _e.set( pose.pelvis[ 0 ], pose.pelvis[ 1 ], pose.pelvis[ 2 ] ) ), _v.set( 1, 1, 1 ) ) );
	put( B.pelvis, _pm.copy( pelvis ).multiply( _g ) );
	// torso and head
	const torso = new Matrix4().copy( pelvis ).multiply( _m.compose( _t.set( 0, D.waist, 0 ), _q.setFromEuler( _e.set( pose.torso[ 0 ], pose.torso[ 1 ], pose.torso[ 2 ] ) ), _v.set( 1, 1, 1 ) ) );
	put( B.torso, _pm.copy( torso ).multiply( _g ) );
	const head = new Matrix4().copy( torso ).multiply( _m.compose( _t.set( 0, D.torso - 0.005, 0 ), _q.setFromEuler( _e.set( pose.head[ 0 ], pose.head[ 1 ], 0 ) ), _v.set( 1, 1, 1 ) ) );
	const hk = ( 1 + ( s - 1 ) * 0.35 ) / s;
	put( B.head, head.multiply( _hs.makeScale( hk, hk, hk ) ) );

	// limb targets are in the player's frame: into the field frame through `root`
	const tgt = ( a, v ) => v.set( a[ 0 ], a[ 1 ], a[ 2 ] ).applyMatrix4( root );
	// the player's forward (-z) and right (+x) in the field frame, for the poles
	const fwd = _p.set( 0, 0, - 1 ).transformDirection( root ).clone(), right = new Vector3( 1, 0, 0 ).transformDirection( root );
	const gs = g * s;

	// legs: hips from the pelvis, knees bend forward
	for ( const [ side, th, sh, ft, foot, yaw ] of [ [ - 1, B.thighL, B.shinL, B.footL, pose.footL, pose.footYawL ], [ 1, B.thighR, B.shinR, B.footR, pose.footR, pose.footYawR ] ] ) {

		const hip = new Vector3( side * D.hipWidth * g, - 0.04, 0 ).applyMatrix4( pelvis );
		const target = tgt( foot, new Vector3() );
		const [ knee, end ] = twoBone( hip, target, D.thigh * s, D.shin * s, poleOf( side < 0 ? pose.kneeL : pose.kneeR, fwd.clone().addScaledVector( right, side * 0.15 ), root ) );
		put( th, boneMatrix( hip, knee, fwd, gs, s ) );
		put( sh, boneMatrix( knee, end, fwd, gs, s ) );
		// the foot: flat on its yaw, at the ankle
		const fy = new Vector3( 0, 1, 0 );
		const ff = fwd.clone().applyAxisAngle( fy, yaw || 0 );
		put( ft, basisAt( end, ff.clone().cross( fy ).normalize().multiplyScalar( s ), fy.clone().multiplyScalar( s ), ff.clone().negate().multiplyScalar( s ) ) );

	}

	// arms: shoulders from the torso, elbows bend down and back
	const handPos = {};
	const gw = 1 + ( g - 1 ) * 0.7;
	for ( const [ side, ua, fa, hd, hand ] of [ [ - 1, B.upperArmL, B.forearmL, B.handL, pose.handL ], [ 1, B.upperArmR, B.forearmR, B.handR, pose.handR ] ] ) {

		const sh = new Vector3( side * D.shoulder * gw, D.shoulderY, 0 ).applyMatrix4( torso );
		const target = tgt( hand, new Vector3() );
		const pole = poleOf( side < 0 ? pose.elbowL : pose.elbowR, new Vector3( 0, - 1, 0 ).addScaledVector( fwd, - 0.6 ).addScaledVector( right, side * 0.8 ), root );
		const [ elbow, wrist ] = twoBone( sh, target, D.upperArm * s, D.forearm * s, pole );
		put( ua, boneMatrix( sh, elbow, fwd, gs, s ) );
		put( fa, boneMatrix( elbow, wrist, fwd, gs, s ) );
		const dir = wrist.clone().sub( elbow ).normalize();
		const hm = boneMatrix( wrist, wrist.clone().addScaledVector( dir, D.hand * s ), fwd, s, s );
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

// A knee's or elbow's pole: the pose's own (from motion capture: in the player's frame, its length the
// sine of the bend) where the limb is bent, the default where it's nearly straight
function poleOf( p, def, root ) {

	if ( ! p ) return def;
	const v = new Vector3( p[ 0 ], p[ 1 ], p[ 2 ] ).transformDirection( root );
	const w = Math.min( 1, Math.hypot( p[ 0 ], p[ 1 ], p[ 2 ] ) * 5 );
	return def.clone().normalize().multiplyScalar( 1 - w ).addScaledVector( v, w );

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
// `across` / `along` scale it (a broader or longer limb than the mesh's).
function boneMatrix( a, b, front, across = 1, along = 1 ) {

	_y.copy( a ).sub( b ).normalize(); // +y points back up the segment
	_z.copy( front ).negate().addScaledVector( _y, front.dot( _y ) ).normalize();
	if ( _z.lengthSq() < 1e-6 ) _z.set( 0, 0, 1 );
	_x.copy( _y ).cross( _z ).normalize();
	_z.copy( _x ).cross( _y ).normalize();
	if ( across !== 1 || along !== 1 ) return basisAt( a, _x.multiplyScalar( across ), _y.multiplyScalar( along ), _z.multiplyScalar( across ) );
	return basisAt( a, _x, _y, _z );

}

function basisAt( o, x, y, z ) {

	return new Matrix4().makeBasis( x, y, z ).setPosition( o );

}

void _b; void _c; void _k;

// A pose baked into a static mesh (statues): the body skinned on the CPU, in the player's own frame
// (feet on y = 0, facing -z). The pieces only some wear (the helmet, the catcher's gear, the mitts, ...)
// are left out, and the parts listed in `drop` (PART codes).
export function bakePose( pose, { gloveHand = 'L', drop = [] } = {} ) {

	const src = buildPlayerGeometry();
	const mats = new Float32Array( NB * 16 );
	solvePose( new Matrix4(), pose, mats, 0, gloveHand );
	skinMatrices( mats, 0 );
	const skip = [ ...OPTIONAL, ...drop ];
	const P = src.getAttribute( 'position' ), N = src.getAttribute( 'normal' ), Bn = src.getAttribute( 'aBones' ), W = src.getAttribute( 'aWeights' ), Pt = src.getAttribute( 'aPart' );
	const index = src.index.array;
	const M = [];
	for ( let b = 0; b < NB; b ++ ) M.push( new Matrix4().fromArray( mats, b * 16 ) );
	const v = new Vector3(), n = new Vector3(), sv = new Vector3(), sn = new Vector3();
	const skinned = ( k ) => {

		sv.set( 0, 0, 0 );
		sn.set( 0, 0, 0 );
		for ( let c = 0; c < 4; c ++ ) {

			const w = W.array[ k * 4 + c ];
			if ( ! w ) continue;
			const m = M[ Math.round( Bn.array[ k * 4 + c ] ) ];
			sv.addScaledVector( v.fromBufferAttribute( P, k ).applyMatrix4( m ), w );
			sn.addScaledVector( n.fromBufferAttribute( N, k ).transformDirection( m ), w );

		}

		return [ sv.x, sv.y, sv.z, ...sn.normalize().toArray() ];

	};

	const cache = new Map();
	const pos = [], nrm = [], part = [];
	for ( let i = 0; i < index.length; i += 3 ) {

		const tri = [ index[ i ], index[ i + 1 ], index[ i + 2 ] ];
		if ( tri.some( ( k ) => skip.includes( Math.round( Pt.array[ k ] ) ) ) ) continue;
		for ( const k of tri ) {

			if ( ! cache.has( k ) ) cache.set( k, skinned( k ) );
			const s = cache.get( k );
			pos.push( s[ 0 ], s[ 1 ], s[ 2 ] );
			nrm.push( s[ 3 ], s[ 4 ], s[ 5 ] );
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
