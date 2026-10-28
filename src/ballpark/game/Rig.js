import { BufferGeometry, Float32BufferAttribute, BoxGeometry, CylinderGeometry, SphereGeometry, LatheGeometry, TorusGeometry, Matrix3, Matrix4, Vector2, Vector3, Quaternion, Euler } from '../../engine/index.js';
import { BODY } from './data/body.js';
import { BODY_LOD, BODY_MID } from './data/bodyLod.js'; // ---- SP2

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
	flapL: 16, flapR: 17, ccap: 18, maskPad: 19, mittC: 20, mitt1B: 21, bag: 22, rake: 23, hood: 24, phHead: 25, snout: 26, phEye: 27, glasses: 28,
	// the rest of the Phanatic's costume: the fur body under the jersey, the neck, the lids, the hair, his
	// cap on backwards, the shag round his mouth and the mouth itself
	phBody: 29, phNeck: 30, phLid: 31, phHair: 32, phCap: 33, phRing: 34, phMouth: 35 };
// the optional pieces (left out of statues)
export const OPTIONAL = [ 10, 11, 12, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35 ];
// the Phanatic's own pieces (only he wears them)
export const PHANATIC_PARTS = [ 25, 26, 27, 29, 30, 31, 32, 33, 34, 35 ];

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
// ---- SP2 (speed): `lod`: the far players' figure (Players.js, under 128 px tall): the body simplified to
// a sixth (data/bodyLod.js, tools/build-body-lod.mjs: its vertices are the body's own, so the uniform,
// the skinning and the shader's shaping are unchanged), the rigid pieces with half their segments, and
// no Phanatic (his costume has its own draw). `lod: 'mid'` (up to ~480 px): the body to two fifths
// (BODY_MID), the pieces whole, no Phanatic
export function buildPlayerGeometry( { lod = false } = {} ) {

	const mid = lod === 'mid'; // ---- SP2

	const pos = [], nrm = [], bones = [], weights = [], part = [], field = [], index = [];
	const Q = BODY.scale;

	// the body
	{

		const P = decode( BODY.position, Int16Array ), N = decode( BODY.normal, Int8Array ), I = decode( BODY.bones, Uint8Array ), W = decode( BODY.weights, Uint8Array );
		const F = decode( BODY.field, Int16Array ), G = decode( BODY.flag, Uint8Array ), X0 = decode( BODY.index, Uint16Array );
		// ---- SP2: the far body keeps only the vertices its triangles use (renumbered in order)
		const XL = lod ? decode( ( mid ? BODY_MID : BODY_LOD ).index, Uint16Array ) : null;
		const keep = lod ? new Int32Array( BODY.count ).fill( - 1 ) : null;
		if ( lod ) {

			for ( const i of XL ) keep[ i ] = 0;
			let k = 0;
			for ( let i = 0; i < BODY.count; i ++ ) if ( keep[ i ] === 0 ) keep[ i ] = k ++;

		}

		const X = lod ? XL.map( ( i ) => keep[ i ] ) : X0;
		// ---- end SP2
		for ( let i = 0; i < BODY.count; i ++ ) {

			if ( lod && keep[ i ] < 0 ) continue; // ---- SP2

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
	// a piece modelled in the bind pose's own frame and skinned to several bones by where each vertex is:
	// `wf( x, y, z )` gives [ [ bone, weight ], ... ] (up to four; normalised here)
	const addSkinned = ( geo, p, wf ) => {

		const P = geo.getAttribute( 'position' ), N = geo.getAttribute( 'normal' );
		const base = pos.length / 3;
		for ( let i = 0; i < P.count; i ++ ) {

			const x = P.getX( i ), y = P.getY( i ), z = P.getZ( i );
			pos.push( x, y, z );
			nrm.push( N.getX( i ), N.getY( i ), N.getZ( i ) );
			const w = wf( x, y, z ).filter( ( [ , k ] ) => k > 1e-3 ).sort( ( a, b ) => b[ 1 ] - a[ 1 ] ).slice( 0, 4 );
			const sum = w.reduce( ( a, [ , k ] ) => a + k, 0 ) || 1;
			for ( let c = 0; c < 4; c ++ ) {

				bones.push( w[ c ] ? w[ c ][ 0 ] : 0 );
				weights.push( w[ c ] ? w[ c ][ 1 ] / sum : 0 );

			}

			part.push( p );
			field.push( mark, - 1 );

		}

		const I = geo.index;
		if ( I ) for ( let i = 0; i < I.count; i ++ ) index.push( base + I.array[ i ] );
		else for ( let i = 0; i < P.count; i ++ ) index.push( base + i );

	};

	const B = BONES, P = PART, D = DIM, F = FACE;
	const S = ( k, min = 4 ) => lod && ! mid ? Math.max( min, Math.round( k / 2 ) ) : k; // ---- SP2: the far figure's segments
	const cyl = ( r0, r1, h, seg = 12 ) => new CylinderGeometry( r0, r1, h, S( seg ), 1, false );
	const sph = ( r, w = 12, h = 8 ) => new SphereGeometry( r, S( w ), S( h, 3 ) );
	const dome = ( r, w, h, thetaLen ) => new SphereGeometry( r, S( w ), S( h, 3 ), 0, Math.PI * 2, 0, thetaLen );
	// a lathed shape: profile [ [ radius, y ], ... ] bottom to top, closed at both ends
	const lathe = ( prof, seg = 16 ) => new LatheGeometry( [ new Vector2( 0, prof[ 0 ][ 1 ] ), ...prof.map( ( [ r, y ] ) => new Vector2( r, y ) ), new Vector2( 0, prof[ prof.length - 1 ][ 1 ] ) ], S( seg ) );
	// a cap's bill: a thin disc of radius r (the back half inside the crown), its sides curved down by
	// `bend` (y -= bend x^2)
	const bill = ( r, bend, t = 0.003 ) => {

		const g = lathe( [ [ 0.0, - t ], [ r * 0.5, - t ], [ r * 0.8, - t ], [ r, - t * 0.6 ], [ r, t * 0.6 ], [ r * 0.8, t ], [ r * 0.5, t ], [ 0.0, t ] ], 24 );
		const pa = g.getAttribute( 'position' );
		for ( let i = 0; i < pa.count; i ++ ) pa.setY( i, pa.getY( i ) - bend * pa.getX( i ) ** 2 );
		g.computeVertexNormals();
		return g;

	};

	// ---- the head's pieces, placed on the skull (the head bone's frame is the bind pose's axes, from its pivot)
	const hb = new Vector3().fromArray( bind, B.head * 16 + 12 );
	const skullZ = ( F.skull.z0 + F.skull.z1 ) / 2 - hb.z, skullY = F.top[ 1 ] - 0.1 - hb.y;
	const rx = F.skull.x + 0.013, rz = ( F.skull.z1 - F.skull.z0 ) / 2 + 0.011;
	// the cap: a crown over the skull down to the brow in front and the hairline behind (the dome tipped
	// back), the button, the bill
	// (FY2, CY-18: the bill curved down at its sides as a worn bill is, marked -3 so its underside takes the
	// undervisor's dark grey-green)
	// ---- FY3 (CY-18): a 2008 New Era, not a dome. The six panels rise nearly upright from the band to a
	// flatter top, the two in front taller (their buckram), about 11 cm at the front (Getty 83483794,
	// Feliz; 83485159, Balfour); the bill longer, curved down more at its sides and level or a little down
	// in the head's frame (it was tipped up 13 degrees, so from in front it read as a black band, its
	// underside). The dome's profile squared (the horizontal radius r^0.72), its front raised
	const crown = ( geo ) => {

		const pa = geo.getAttribute( 'position' );
		for ( let i = 0; i < pa.count; i ++ ) {

			const x = pa.getX( i ), y = pa.getY( i ), z = pa.getZ( i ), r = Math.hypot( x, z );
			const k = r > 1e-6 ? Math.pow( Math.min( 1, r ), 0.72 ) / r : 1;
			pa.setXYZ( i, x * k, y * ( 1 + 0.16 * Math.max( 0, - z ) * Math.max( 0, y ) ), z * k );

		}

		geo.computeVertexNormals();
		// (the sphere's seam has its vertices twice: their normals averaged, so the seam doesn't show)
		const na = geo.getAttribute( 'normal' ), seen = new Map();
		for ( let i = 0; i < pa.count; i ++ ) {

			const key = `${ pa.getX( i ).toFixed( 4 ) },${ pa.getY( i ).toFixed( 4 ) },${ pa.getZ( i ).toFixed( 4 ) }`;
			( seen.get( key ) || seen.set( key, [] ).get( key ) ).push( i );

		}

		for ( const list of seen.values() ) if ( list.length > 1 ) {

			let x = 0, y = 0, z = 0;
			for ( const i of list ) { x += na.getX( i ); y += na.getY( i ); z += na.getZ( i ); }
			const l = Math.hypot( x, y, z ) || 1;
			for ( const i of list ) na.setXYZ( i, x / l, y / l, z / l );

		}

		return geo;

	};
	// (worn up off the brows: the band a finger above them in front, so the brows and the eyes show under
	// the bill's shadow, as Feliz's do; it sat on the lids)
	add( crown( dome( 1, 24, 12, Math.PI * 0.56 ) ), B.head, P.cap, 0, skullY - 0.001, skullZ, 0.3, 0, 0, rx, 0.104, rz );
	add( cyl( 0.009, 0.009, 0.01, 8 ), B.head, P.cap, 0, skullY + 0.1, skullZ - 0.016 );
	mark = - 3;
	add( bill( 0.09, 3.3 ), B.head, P.cap, 0, skullY + 0.0145, skullZ - rz + 0.012, - 0.05, 0, 0, 0.95, 1, 0.9 );
	mark = - 1;
	// ---- end FY3
	// the batting helmet: a shell down over the ears, a short bill; the ear flaps (the one toward the
	// pitcher: a right-handed hitter's on his left ear, a lefty's on his right, switch hitters both)
	// ---- FY3: the shell a little lower (it stood like a bowl); the ear flaps the shell itself carried on
	// down over the ear, flush with it, their lower edge rounded, the ear's hole shaded in Players.js (they
	// were two balls hanging off the head: FOX's walk-ups, Rollins's double flap); the bill longer and level
	const shell = [ 0, skullY - 0.004, skullZ + 0.004, 0.12, 0, 0, rx + 0.017, 0.12, rz + 0.016 ];
	// a patch of the shell's ellipsoid: phi from p0 over pl round the side, theta from the shell's rim down
	// to its bottom edge, rounded at the front and back
	const flap = ( p0, pl ) => {

		// (down to the ear's lobe, not the jaw, and flaring off the cheek toward the bottom as a flap does:
		// carried on round the ellipsoid it came in to the jaw in two points)
		const NU = S( 10 ), NV = S( 5, 3 ), t0 = Math.PI * 0.6, tl = Math.PI * 0.135;
		const P = [], N = [], I = [];
		for ( let iv = 0; iv <= NV; iv ++ ) for ( let iu = 0; iu <= NU; iu ++ ) {

			const u = iu / NU, phi = p0 + u * pl, v = iv / NV;
			const th = t0 + v * tl * Math.sqrt( Math.max( 0.3, 1 - 0.6 * ( 2 * u - 1 ) ** 2 ) );
			const flare = 1 + 0.1 * v * v;
			const x = - Math.cos( phi ) * Math.sin( th ) * flare, y = Math.cos( th ), z = Math.sin( phi ) * Math.sin( th );
			P.push( x, y, z );
			N.push( x, y, z );

		}

		for ( let iv = 0; iv < NV; iv ++ ) for ( let iu = 0; iu < NU; iu ++ ) {

			const a = iv * ( NU + 1 ) + iu + 1, b = iv * ( NU + 1 ) + iu, c = ( iv + 1 ) * ( NU + 1 ) + iu, d = ( iv + 1 ) * ( NU + 1 ) + iu + 1;
			I.push( a, b, d, b, c, d );

		}

		const g = new BufferGeometry();
		g.setAttribute( 'position', new Float32BufferAttribute( P, 3 ) );
		g.setAttribute( 'normal', new Float32BufferAttribute( N, 3 ) );
		g.setIndex( I );
		return g;

	};
	add( dome( 1, 24, 14, Math.PI * 0.62 ), B.head, P.helmet, ...shell );
	add( flap( - 0.62, 1.42 ), B.head, P.flapL, ...shell );
	add( flap( Math.PI - 0.8, 1.42 ), B.head, P.flapR, ...shell );
	mark = - 3;
	add( bill( 0.07, 1.6, 0.004 ), B.head, P.helmet, 0, skullY - 0.012, skullZ - rz - 0.004, 0.02, 0, 0, 1.15, 1, 0.78 );
	mark = - 1;
	// ---- end FY3
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

	// the Phillie Phanatic's costume (Players.js, KIND.phanatic): see phanatic() below
	if ( ! lod ) phanatic( addSkinned, lathe ); // ---- SP2: (the costume's draw is never far)

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
	for ( const ft of [ B.footL, B.footR ] ) add( cleat( ankleY, lod && ! mid ? 8 : 16 ), ft, P.shoes ); // ---- SP2: lod

	// the glove: the pocket and heel, four finger stalls side by side (closed, as a broken-in glove is
	// carried), the thumb, the laced web between the thumb and the first finger; about a hand and a third
	// (FY2, CY-21: it was a cartoon mitt with its fingers spread, as big as the forearm)
	const gk = 0.86;
	const capsule = ( r, b, x0, y0, x1, y1, z = - 0.02 ) => {

		[ r, x0, y0, x1, y1, z ] = [ r, x0, y0, x1, y1, z ].map( ( v ) => v * gk );
		const dx = x1 - x0, dy = y1 - y0, L = Math.hypot( dx, dy ), a = Math.atan2( dx, - dy );
		add( cyl( r, r * 0.92, L, 10 ), b, P.glove, ( x0 + x1 ) / 2, ( y0 + y1 ) / 2, z, 0, 0, a, 1, 1, 0.8 );
		add( sph( r * 0.92, 10, 6 ), b, P.glove, x1, y1, z, 0, 0, 0, 1, 1, 0.8 );

	};

	add( sph( 0.1 * gk, 16, 12 ), B.glove, P.glove, 0, - 0.075 * gk, - 0.02 * gk, 0, 0, 0, 0.92, 1.12, 0.36 );
	for ( const [ x, x1 ] of [ [ - 0.05, - 0.056 ], [ - 0.017, - 0.019 ], [ 0.016, 0.018 ], [ 0.048, 0.054 ] ] ) capsule( 0.021, B.glove, x, - 0.13, x1, - 0.262 + Math.abs( x ) * 0.45 );
	capsule( 0.023, B.glove, 0.07, - 0.04, 0.105, - 0.19, - 0.03 );
	mark = - 2;
	add( new BoxGeometry( 0.045 * gk, 0.1 * gk, 0.012 ), B.glove, P.glove, 0.08 * gk, - 0.2 * gk, - 0.03 * gk, 0, 0, - 0.2 );
	// the catcher's mitt: a round, thick pillow with a laced rim and a stubby thumb; the first baseman's:
	// a long scoop with a laced web
	// (FB2, C2B-19: 88% of the size it was and deeper in the pocket: it read as a flat disc bigger than the
	// catcher's head)
	const mk = 0.88;
	add( new TorusGeometry( 0.112 * mk, 0.016, 5, 20 ), B.glove, P.mittC, 0, - 0.105 * mk, - 0.024, 0, 0, 0, 1.08, 1.04, 1 );
	mark = - 1;
	add( sph( 0.1 * mk, 16, 12 ), B.glove, P.mittC, 0, - 0.105 * mk, - 0.02, 0, 0, 0, 1.2, 1.16, 0.66 );
	add( sph( 0.1 * mk, 10, 6 ), B.glove, P.mittC, 0.105 * mk, - 0.05 * mk, - 0.035, 0, 0, - 0.5, 0.32, 0.55, 0.4 );
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
function cleat( ankleY, R = 16 ) {

	const y0 = - ankleY; // the ground
	// [ z, half width, top ]
	const S = [
		[ 0.078, 0.02, y0 + 0.05 ], [ 0.07, 0.036, y0 + 0.085 ], [ 0.045, 0.044, 0.028 ], [ 0.0, 0.047, 0.03 ], [ - 0.04, 0.05, 0.011 ],
		// (FY3: the instep higher and the toe rounder, a cleat's, not a slipper's pointed toe)
		[ - 0.09, 0.051, y0 + 0.065 ], [ - 0.14, 0.049, y0 + 0.053 ], [ - 0.18, 0.045, y0 + 0.045 ], [ - 0.204, 0.037, y0 + 0.039 ], [ - 0.219, 0.022, y0 + 0.032 ], [ - 0.226, 0.007, y0 + 0.024 ],
	];
	const pos = [], index = [];
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

// ---------------------------------------------------------------- the Phanatic

// The Phillie Phanatic as the costume was in October 2008 (Getty 577355744, June 22, front; 83434999,
// 83891040, 83570904, 84082561 from the Series; pompomflipflop's profile at the NLCS, 2930759768; pelfas'
// close-up of October 25, 2976309077). Not a man in a green suit but a pear: green shag from the collar
// to a ragged skirt hanging just past the knees, widest at the hips (about 0.85 m across), the belly
// carried out in front; the pinstriped jersey over its top half like a tent, its hem riding on the belly.
// Out of the collar rises the long "gawking neck" (the performer, Tom Burgoyne, has his own head inside
// it and looks out through a mesh: Main Line Today, July 2008), and on top of it the much smaller head:
// the lime velour horn of a snout reaching straight out, its open end ringed in dark shag, two big white
// eyes under heavy hot pink lids, a shock of blue (and pink) hair, and the red cap on backwards.
//
// Everything here is in the bind pose's frame (the rig's 6'2" athlete, before Looks.js scales him to the
// performer's height). The body is skinned to the torso above the waist, the pelvis through the belly,
// and partly to the thighs at the hem, so the skirt swings with his stride; the neck to the torso at the
// collar and the head above (his head is in it: where he looks, it goes); the head's pieces to the head.
export const PHAN = {
	head: [ 0, 1.945, - 0.05 ], headR: [ 0.174, 0.158, 0.17 ],
	// the snout: from its root inside the head, along `dir`, `len` to the mouth
	snout: { base: [ 0, 1.915, - 0.12 ], tilt: 0.07, len: 0.285 },
	// the eyes' centres (x either side), their radii
	eye: [ 0.056, 2.005, - 0.208 ], eyeR: [ 0.056, 0.061, 0.05 ],
	// the jersey's hem and the shag's (y)
	hem: 0.965, skirt: 0.535,
};

function phanatic( addSkinned, lathe ) {

	const B = BONES, P = PART;
	const sm = ( a, b, x ) => {

		const t = Math.min( 1, Math.max( 0, ( x - a ) / ( b - a ) ) );
		return t * t * ( 3 - 2 * t );

	};
	const hash = ( k ) => {

		const s = Math.sin( k * 127.1 + 311.7 ) * 43758.5453;
		return s - Math.floor( s );

	};
	const onHead = () => [ [ B.head, 1 ] ];

	// ---- the body: rings [ y, half-width, front, back ] from the collar to the hem, then in under the skirt
	{

		const R = [
			[ 1.6, 0.13, 0.115, 0.1 ], [ 1.565, 0.18, 0.14, 0.125 ], [ 1.52, 0.228, 0.165, 0.142 ], [ 1.46, 0.256, 0.19, 0.157 ],
			[ 1.38, 0.272, 0.218, 0.168 ], [ 1.26, 0.294, 0.255, 0.188 ], [ 1.14, 0.326, 0.293, 0.212 ], [ 1.03, 0.362, 0.33, 0.24 ],
			[ PHAN.hem, 0.382, 0.35, 0.258 ], [ PHAN.hem - 0.012, 0.366, 0.334, 0.25 ], [ 0.91, 0.405, 0.385, 0.295 ], [ 0.83, 0.438, 0.418, 0.335 ],
			[ 0.735, 0.452, 0.428, 0.355 ], [ 0.65, 0.43, 0.395, 0.34 ], [ 0.585, 0.385, 0.345, 0.305 ], [ PHAN.skirt, 0.325, 0.29, 0.26 ],
			[ 0.56, 0.24, 0.21, 0.19 ], [ 0.6, 0.12, 0.11, 0.1 ],
		];
		const S = 48, hemRing = 15;
		const p = [];
		R.forEach( ( [ y, hw, fr, bk ], j ) => {

			for ( let k = 0; k < S; k ++ ) {

				const a = k / S * Math.PI * 2, c = Math.cos( a ), s = Math.sin( a );
				// the shag's hem hangs in clumps of different lengths
				const rag = j === hemRing ? hash( k ) : j === hemRing - 1 ? 0.3 * hash( k ) : 0;
				const g = 1 + 0.04 * rag;
				p.push( hw * s * g, y - 0.075 * rag, - c * ( c > 0 ? fr : bk ) * g );

			}

		} );

		const idx = [];
		for ( let j = 0; j < R.length - 1; j ++ ) for ( let k = 0; k < S; k ++ ) {

			const a = j * S + k, b = j * S + ( k + 1 ) % S, c = a + S, d = b + S;
			idx.push( a, b, c, b, d, c );

		}

		const geo = new BufferGeometry();
		geo.setAttribute( 'position', new Float32BufferAttribute( p, 3 ) );
		geo.setIndex( idx );
		geo.computeVertexNormals();
		addSkinned( geo, P.phBody, ( x, y ) => {

			const up = sm( 0.98, 1.24, y ); // the torso's share above the waist
			const k = 0.5 * sm( 0.8, 0.5, y ); // the thighs' share at the skirt
			const l = Math.min( 1, Math.max( 0, 0.5 - x / 0.3 ) );
			return [ [ B.torso, up ], [ B.pelvis, 1 - up - k ], [ B.thighL, k * l ], [ B.thighR, k * ( 1 - l ) ] ];

		} );

	}

	// ---- the neck: a thick fur column out of the jersey's collar, up into the head
	{

		const geo = new CylinderGeometry( 0.126, 0.144, 0.42, 24, 6, true );
		geo.translate( 0, 1.53 + 0.21, - 0.035 );
		addSkinned( geo, P.phNeck, ( x, y ) => {

			const h = sm( 1.6, 1.77, y );
			return [ [ B.head, h ], [ B.torso, 1 - h ] ];

		} );

	}

	// ---- the head
	const [ hx, hy, hz ] = PHAN.head, [ rx, ry, rz ] = PHAN.headR;
	{

		const geo = new SphereGeometry( 1, 26, 18 );
		geo.scale( rx, ry, rz );
		geo.translate( hx, hy, hz );
		addSkinned( geo, P.phHead, onHead );

	}

	// the eyes, side by side over the snout's root, bulging out of the fur; the lids over their tops,
	// half shut
	for ( const sx of [ - 1, 1 ] ) {

		const [ ex, ey, ez ] = [ sx * PHAN.eye[ 0 ], PHAN.eye[ 1 ], PHAN.eye[ 2 ] ], [ erx, ery, erz ] = PHAN.eyeR;
		const eye = new SphereGeometry( 1, 18, 14 );
		eye.scale( erx, ery, erz );
		eye.translate( ex, ey, ez );
		addSkinned( eye, P.phEye, onHead );
		const lid = new SphereGeometry( 1, 18, 7, 0, Math.PI * 2, 0, Math.PI * 0.32 );
		lid.scale( erx * 1.1, ery * 1.08, erz * 1.12 );
		lid.rotateX( - 0.25 );
		lid.rotateZ( - sx * 0.1 );
		lid.translate( ex, ey + 0.002, ez + 0.001 );
		addSkinned( lid, P.phLid, onHead );

	}

	// the snout: a horn of lime velour straight out of the face (a touch down from level in the bind pose:
	// he carries his head tipped back behind the belly), flaring to the open mouth, the dark shag ring
	// round it, the mouth's dark inside and the curl of his tongue in it
	{

		const { base, tilt, len } = PHAN.snout;
		const q = new Quaternion().setFromEuler( new Euler( - Math.PI / 2 - tilt, 0, 0 ) );
		const at = ( d ) => new Vector3( 0, 1, 0 ).applyQuaternion( q ).multiplyScalar( d ).add( new Vector3( ...base ) );
		const horn = lathe( [ [ 0.056, 0.0 ], [ 0.058, 0.1 ], [ 0.062, len - 0.1 ], [ 0.07, len - 0.05 ], [ 0.08, len - 0.016 ], [ 0.085, len ], [ 0.062, len - 0.004 ], [ 0.035, len - 0.022 ] ], 22 );
		horn.applyQuaternion( q );
		horn.translate( ...base );
		addSkinned( horn, P.snout, onHead );
		const ring = new TorusGeometry( 0.077, 0.032, 8, 24 );
		const end = at( len - 0.006 );
		ring.rotateX( - tilt );
		ring.translate( end.x, end.y, end.z );
		addSkinned( ring, P.phRing, onHead );
		const tongue = new SphereGeometry( 1, 10, 6 );
		tongue.scale( 0.036, 0.016, 0.05 );
		const tp = at( len - 0.03 );
		tongue.translate( tp.x, tp.y - 0.03, tp.z );
		addSkinned( tongue, P.phMouth, onHead );

	}

	// the shock of hair: a mop of shaggy locks out of the top of the head in front of the cap, flopping
	// every way, blue with a few pink (Players.js picks which)
	{

		const up = new Vector3( 0, 1, 0 ), n = new Vector3(), q = new Quaternion();
		for ( let i = 0; i < 30; i ++ ) {

			const phi = 0.05 + 0.8 * hash( i + 1.3 ), psi = ( hash( i + 7.7 ) - 0.5 ) * 2.0;
			n.set( Math.sin( phi ) * Math.sin( psi ), Math.cos( phi ), - Math.sin( phi ) * Math.cos( psi ) );
			const root = new Vector3( hx + n.x * rx * 0.92, hy + n.y * ry * 0.92, hz + n.z * rz * 0.92 );
			const dir = n.clone().add( new Vector3( ( hash( i + 2.2 ) - 0.5 ) * 1.4, 0.3, ( hash( i + 4.4 ) - 0.5 ) * 1.0 ) ).normalize();
			const L = 0.05 + 0.05 * hash( i + 3.1 ), r = 0.012 + 0.01 * hash( i + 5.9 );
			const geo = new SphereGeometry( 1, 6, 4 );
			geo.scale( r, L, r * 0.8 );
			geo.translate( 0, L * 0.7, 0 );
			geo.applyQuaternion( q.setFromUnitVectors( up, dir ) );
			geo.translate( root.x, root.y, root.z );
			addSkinned( geo, P.phHair, onHead );

		}

	}

	// the red cap on backwards: its crown over the top and back of the head (riding on the fur), the bill
	// out over his nape
	{

		const k = 1.13;
		const crown = new SphereGeometry( 1, 22, 8, 0, Math.PI * 2, 0, Math.PI * 0.3 );
		crown.scale( rx * k, ry * k, rz * k );
		crown.rotateX( 0.66 );
		crown.translate( hx, hy, hz );
		addSkinned( crown, P.phCap, onHead );
		const bill = lathe( [ [ 0.0, - 0.004 ], [ 0.075, - 0.004 ], [ 0.075, 0.004 ], [ 0.0, 0.004 ] ], 20 );
		bill.scale( 0.95, 1, 0.9 );
		bill.rotateX( 0.3 );
		bill.translate( hx, hy - 0.01, hz + rz * k + 0.03 );
		addSkinned( bill, P.phCap, onHead );

	}

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
// (FB2, C2B-2: a big man is big through the chest and shoulders first; his hips and thighs take a little
// over half of it, or every heavy man is a pear. The shoulder joints go out with the trunk they're in.)
const _g = new Matrix4(), _gp = new Matrix4(), _hs = new Matrix4(), _pm = new Matrix4();
// (---- FY4: `head`, the head's own size, about 1: Looks.js' `head`)
export function solvePose( root, pose, out, offset, gloveHand = 'L', girth = 1, headSize = 1 ) {

	const D = DIM, B = BONES;
	const s = Math.cbrt( Math.abs( root.determinant() ) ) || 1;
	const g = girth;
	const put = ( b, m ) => m.toArray( out, offset + b * 16 );
	_g.makeScale( g, 1, g );
	const gp = 1 + ( g - 1 ) * 0.55;
	_gp.makeScale( gp, 1, g );
	// pelvis
	const pelvis = new Matrix4().copy( root ).multiply( _m.compose( _t.set( pose.pelvisX || 0, pose.pelvisY, pose.pelvisZ || 0 ), _q.setFromEuler( _e.set( pose.pelvis[ 0 ], pose.pelvis[ 1 ], pose.pelvis[ 2 ] ) ), _v.set( 1, 1, 1 ) ) );
	put( B.pelvis, _pm.copy( pelvis ).multiply( _gp ) );
	// torso and head
	const torso = new Matrix4().copy( pelvis ).multiply( _m.compose( _t.set( 0, D.waist, 0 ), _q.setFromEuler( _e.set( pose.torso[ 0 ], pose.torso[ 1 ], pose.torso[ 2 ] ) ), _v.set( 1, 1, 1 ) ) );
	put( B.torso, _pm.copy( torso ).multiply( _g ) );
	const head = new Matrix4().copy( torso ).multiply( _m.compose( _t.set( 0, D.torso - 0.005, 0 ), _q.setFromEuler( _e.set( pose.head[ 0 ], pose.head[ 1 ], 0 ) ), _v.set( 1, 1, 1 ) ) );
	const hk = ( 1 + ( s - 1 ) * 0.35 ) / s * headSize; // (---- FY4: his own head's size)
	put( B.head, head.multiply( _hs.makeScale( hk, hk, hk ) ) );

	// limb targets are in the player's frame: into the field frame through `root`
	const tgt = ( a, v ) => v.set( a[ 0 ], a[ 1 ], a[ 2 ] ).applyMatrix4( root );
	// the player's forward (-z) and right (+x) in the field frame, for the poles
	const fwd = _p.set( 0, 0, - 1 ).transformDirection( root ).clone(), right = new Vector3( 1, 0, 0 ).transformDirection( root );
	const gs = g * s, gl = ( 1 + ( g - 1 ) * 0.65 ) * s;

	// legs: hips from the pelvis, knees bend forward
	for ( const [ side, th, sh, ft, foot, yaw ] of [ [ - 1, B.thighL, B.shinL, B.footL, pose.footL, pose.footYawL ], [ 1, B.thighR, B.shinR, B.footR, pose.footR, pose.footYawR ] ] ) {

		const hip = new Vector3( side * D.hipWidth * gp, - 0.04, 0 ).applyMatrix4( pelvis );
		const target = tgt( foot, new Vector3() );
		const [ knee, end ] = twoBone( hip, target, D.thigh * s, D.shin * s, poleOf( side < 0 ? pose.kneeL : pose.kneeR, fwd.clone().addScaledVector( right, side * 0.15 ), root ) );
		put( th, boneMatrix( hip, knee, fwd, gl, s ) );
		put( sh, boneMatrix( knee, end, fwd, gl, s ) );
		// the foot: flat on its yaw, at the ankle
		const fy = new Vector3( 0, 1, 0 );
		const ff = fwd.clone().applyAxisAngle( fy, yaw || 0 );
		put( ft, basisAt( end, ff.clone().cross( fy ).normalize().multiplyScalar( s ), fy.clone().multiplyScalar( s ), ff.clone().negate().multiplyScalar( s ) ) );

	}

	// arms: shoulders from the torso, elbows bend down and back
	const handPos = {};
	const gw = g;
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
