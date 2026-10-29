import { InstancedMesh, BufferGeometry, InterleavedBuffer, InterleavedBufferAttribute, Vector3, Vector4, Sphere, Box3, Matrix4, Mesh, Float32BufferAttribute, Color } from '../engine/index.js';
import { ShaderModule } from '../engine/gpu/Shader.js';
import { ComputeKernel } from '../engine/gpu/Compute.js';
import { UniformBlock } from '../engine/gpu/Uniforms.js';
import { StorageBuffer } from '../engine/gpu/Texture.js';
import { standard } from '../materials/Materials.js';
import { SEAT_BACK } from './Stands.js';
// ---- FW1 (CP-12): the backs' names and numbers come from the Cast's atlas (a blank one without it)
import { castPool, filmModule } from './places/Cast.js';
import { signAtlas, SIGN, SIGN_GRID } from './places/home/Signs.js';
import { canvasTexture } from './geo.js';
import { G29 } from './game/Suspension.js'; // ---- FS1 (C4S-5): the song's place in the 29th's return
import { fanHeadLevel, fanHeadBuffer, fanHeadModule, faceFeatures, faceWeights, packFace } from './FanHead.js'; // ---- FF1
let _blank = null;
const BLANK = () => _blank ||= canvasTexture( 8, 8, ( ctx ) => { ctx.fillStyle = '#000'; ctx.fillRect( 0, 0, 8, 8 ); }, 'crowdBlank' );
// ---- end FW1

// The crowd: Game 5 was a sellout (45,940 on October 27, the same again for the resumption on the 29th),
// so a fan in nearly every seat. One low-poly seated figure, instanced on the seats' own matrices (the
// stands add a crowd chunk beside each chunk of seats). Who sits in each seat is decided here, on the
// CPU, when the chunk is added: age, build, skin and hair, the jacket or jersey (and whose number), the
// hat, glasses, a beard, a scarf, gloves, a blanket, what's in his hand, whether he has a sign or a
// towel, whether he's a Rays fan, how he behaves. It's packed into three integers per fan (the instance
// colour attribute) and the shaders dress and move him. Six poses are morphed per vertex: sitting and
// standing, each with the arms at rest, raised, or a hand brought to the face (a drink, a phone, the
// camera, praying hands), per arm; what everyone is doing follows the game (mood(), set every frame from
// the replay: two strikes, two outs, a Phillies rally, the last out), rippling out from the play.
//
//   const crowd = new Crowd();
//   crowd.addChunk( group, seatMatrices, tierName, seatInfo )   (Stands.js)
//   crowd.update( director, dt, rain ), crowd.lod( camera )     (every frame)

// the figure's joints: sitting (feet on the tread, origin under the seat's middle, facing -z), standing,
// and each arm raised or brought to the face (the right side; the left mirrors it). Sized from a
// seated adult (the shoulders ~0.58 m above the seat, the top of the head ~0.9 m: the seat is at ~0.43
// here) and a standing one of 1.75 m; the chest joint is the top of the shoulders, throat and nape the
// neck's ends (inside the collar and inside the head)
const SIT = {
	hip: [ 0.1, 0.5, 0.06 ], knee: [ 0.12, 0.52, - 0.36 ], ankle: [ 0.12, 0.07, - 0.42 ],
	pelvis: [ 0, 0.47, 0.1 ], chest: [ 0, 1.06, 0.15 ], neck: [ 0, 1.13, 0.135 ], head: [ 0, 1.245, 0.115 ],
	throat: [ 0, 1.075, 0.14 ], nape: [ 0, 1.2, 0.12 ],
	shoulder: [ 0.192, 0.975, 0.14 ], elbow: [ 0.228, 0.7, 0.07 ], wrist: [ 0.15, 0.6, - 0.15 ], hand: [ 0.12, 0.59, - 0.24 ],
};
// an arm up: the shoulder lifts and comes in, the elbow a little bent and out (inside the seat's width,
// clear of the head and the neighbour's arm)
const SIT_UP = { shoulder: [ 0.17, 1.04, 0.14 ], elbow: [ 0.26, 1.32, 0.09 ], wrist: [ 0.22, 1.58, 0.04 ], hand: [ 0.2, 1.68, 0.02 ] };
const SIT_FACE = { elbow: [ 0.22, 0.74, - 0.02 ], wrist: [ 0.11, 0.98, - 0.08 ], hand: [ 0.07, 1.06, - 0.07 ] };
const STAND = {
	hip: [ 0.1, 0.9, 0.0 ], knee: [ 0.11, 0.5, - 0.04 ], ankle: [ 0.12, 0.07, - 0.06 ],
	pelvis: [ 0, 0.9, 0.02 ], chest: [ 0, 1.45, 0.03 ], neck: [ 0, 1.52, 0.03 ], head: [ 0, 1.64, 0.02 ],
	throat: [ 0, 1.465, 0.03 ], nape: [ 0, 1.595, 0.025 ],
	shoulder: [ 0.192, 1.365, 0.03 ], elbow: [ 0.232, 1.1, 0.06 ], wrist: [ 0.23, 0.86, 0.0 ], hand: [ 0.22, 0.77, - 0.01 ],
};
const STAND_UP = { shoulder: [ 0.17, 1.43, 0.03 ], elbow: [ 0.26, 1.71, 0.0 ], wrist: [ 0.22, 1.97, - 0.04 ], hand: [ 0.2, 2.07, - 0.05 ] };
const STAND_FACE = { elbow: [ 0.23, 1.17, - 0.1 ], wrist: [ 0.1, 1.42, - 0.15 ], hand: [ 0.06, 1.5, - 0.12 ] };
// the six morph targets: [ base, arm ]
const POSES = [ [ SIT, null ], [ STAND, null ], [ SIT, SIT_UP ], [ STAND, STAND_UP ], [ SIT, SIT_FACE ], [ STAND, STAND_FACE ] ];

// parts (the shaders dress and move by them). Some parts carry a marker in t (aInfo.y) for a piece the
// shaders treat on its own: the shoes (pants, t 3), the cap's crown (brim, t 2), a knit hat's pom-pom
// (head, t 2), the collar's rings (shirt, t > 1)
const P = { shirt: 0, pants: 1, hand: 2, head: 3, brim: 4, towel: 5, sleeve: 6, neck: 7, prop: 8, sign: 9, hair: 10, blanket: 11 };
const HEAD_R = [ 0.082, 0.105, 0.098 ];

// The trunk: a jacket lofted through rings [ t, half width, half depth, z offset, squareness ]: t 0..1
// from the pelvis to the top of the shoulders, 1..2 on up to the neck joint (the collar). Hips, waist,
// chest, the armpits, the shoulders sloping in to a collar round the neck (a seated 47 degree crowd
// zipped to the chin), not a drum (CP-2: Getty 83893023, the 27th)
const TRUNK = {
	// (FW6, C4W-1: close up the shoulders round in plan and falling to the collar from over the arms'
	// rounds, not squared to a shelf: the top of the trunk was a flat ellipse 0.28 m across, level with the
	// tops of the arms)
	close: [ [ - 0.08, 0.17, 0.122, 0, 2.2 ], [ 0.1, 0.166, 0.118, 0, 2.2 ], [ 0.36, 0.156, 0.11, - 0.004, 2.2 ], [ 0.64, 0.168, 0.118, - 0.01, 2.25 ],
		[ 0.84, 0.166, 0.113, - 0.004, 2.1 ], [ 0.95, 0.15, 0.104, 0.002, 2.0 ], [ 1.0, 0.124, 0.094, 0.004, 2.0 ], [ 1.35, 0.088, 0.078, 0, 2 ], [ 1.9, 0.072, 0.066, 0, 2 ] ],
	near: [ [ - 0.08, 0.17, 0.122, 0, 2.2 ], [ 0.4, 0.158, 0.11, - 0.004, 2.2 ], [ 0.8, 0.17, 0.116, - 0.008, 2.4 ],
		[ 1.0, 0.142, 0.094, 0.004, 2.2 ], [ 1.4, 0.088, 0.077, 0, 2 ], [ 1.9, 0.072, 0.066, 0, 2 ] ],
	mid: [ [ - 0.05, 0.172, 0.12, 0, 2 ], [ 0.85, 0.18, 0.112, - 0.004, 2 ], [ 1.4, 0.1, 0.08, 0, 2 ] ],
	far: [ [ 0, 0.172, 0.12, 0, 2 ], [ 0.9, 0.185, 0.11, 0, 2 ], [ 1.3, 0.11, 0.085, 0, 2 ] ],
};

// Levels of detail, chosen per chunk by how big its fans are on screen (lod()): close up the whole
// figure (the lofted trunk on 10 sides, 6-sided limbs with round shoulders, shoes, a 12 x 8 head with a
// nose and a jaw, the cap's own crown and its curved bill, a pom-pom); near (the TV's long lens on the
// backdrop) the same shapes on fewer sides, the cap shaped from the head; then a middle one and a far
// one for fans a few pixels tall
const LODS = [
	{ name: 'close', mh: 'mid', trunk: 10, rings: TRUNK.close, limb: 8, head: [ 16, 11 ], neck: true, hands: 8, joints: true, extras: true, hair: true, crown: [ 10, 4 ], bill: 6, shoes: true, nose: true, pom: [ 12, 7 ], sign: true },
	{ name: 'near', mh: 'far', trunk: 6, rings: TRUNK.near, limb: 4, head: [ 8, 5 ], neck: false, hands: 4, joints: true, extras: false, hair: true, crown: null, bill: 4, shoes: false, nose: false, pom: null, sign: true },
	{ name: 'mid', trunk: 6, rings: TRUNK.mid, limb: 3, head: [ 6, 4 ], neck: false, hands: 0, joints: true, extras: false, hair: true, crown: null, bill: 0, shoes: false, nose: false, pom: null },
	{ name: 'far', trunk: 4, rings: TRUNK.far, limb: 3, head: [ 5, 3 ], neck: false, hands: 0, joints: false, extras: false, hair: false, crown: null, bill: 0, shoes: false, nose: false, pom: null },
	// ---- SP2 (speed): the distant one, for fans under ~8 px tall (the bowl from the 400s, the outfield's
	// stands from home): the far one's shapes on three sides and a smaller head grid. At that size a side
	// is a fraction of a pixel; what shows is the colours and the arms, which it keeps. Its triangles are
	// most of the time spent on the whole bowl in view, and each one shades whole 2 x 2 pixel quads
	{ name: 'distant', trunk: 3, rings: TRUNK.far, limb: 3, head: [ 4, 2 ], neck: false, hands: 0, joints: false, extras: false, hair: false, crown: null, bill: 0, shoes: false, nose: false, pom: null },
	// ---- end SP2
];
// where a cap's crown comes down to on the head (d.y, the head's unit sphere), by how far round to the
// front: just above the brows in front (they're at 0.3), over the ears at the sides, low behind
const capRim = ( front ) => 0.18 + 0.225 * front;

// stride of the interleaved vertex: position, normal, aStand, aStandN, aSitUp, aStandUp, aSitFace,
// aStandFace (3 each), aInfo (4: the part and side, then t, a, b: where on the part)
const STRIDE = 28;

export function fanGeometry( lod ) {

	const L = LODS[ lod ];
	const verts = [], index = [];
	const sub = ( a, b ) => [ a[ 0 ] - b[ 0 ], a[ 1 ] - b[ 1 ], a[ 2 ] - b[ 2 ] ];
	const add = ( a, b ) => [ a[ 0 ] + b[ 0 ], a[ 1 ] + b[ 1 ], a[ 2 ] + b[ 2 ] ];
	const mul = ( a, k ) => [ a[ 0 ] * k, a[ 1 ] * k, a[ 2 ] * k ];
	const cross = ( a, b ) => [ a[ 1 ] * b[ 2 ] - a[ 2 ] * b[ 1 ], a[ 2 ] * b[ 0 ] - a[ 0 ] * b[ 2 ], a[ 0 ] * b[ 1 ] - a[ 1 ] * b[ 0 ] ];
	const norm = ( a ) => mul( a, 1 / ( Math.hypot( ...a ) || 1 ) );
	// a joint in pose k, on side s (+1 the right, -1 the left)
	const joint = ( k, name, s ) => {

		const [ base, arm ] = POSES[ k ];
		const j = ( arm && arm[ name ] ) || base[ name ];
		return [ j[ 0 ] * s, j[ 1 ], j[ 2 ] ];

	};

	// one vertex: its place in the six poses, its normal sitting and standing, what it belongs to
	const vert = ( p6, n0, n1, part, side, t = 0, a = 0, b = 0 ) => {

		verts.push( { p6, n0, n1, code: part + 16 * ( side + 1 ), t, a, b } );
		return verts.length - 1;

	};

	// a ring of n points round the segment a -> b at its end t (0 or 1), radii rx (across) and rz (depth)
	const ring = ( a, b, t, n, rx, rz ) => {

		const ax = norm( sub( b, a ) );
		let across = norm( cross( ax, [ 0, 0, 1 ] ) );
		if ( Math.hypot( ...cross( ax, [ 0, 0, 1 ] ) ) < 0.2 ) across = norm( cross( ax, [ 0, 1, 0 ] ) );
		const depth = norm( cross( across, ax ) );
		const c = add( a, mul( sub( b, a ), t ) );
		const out = [];
		for ( let k = 0; k < n; k ++ ) {

			const ang = ( k / n ) * Math.PI * 2 + Math.PI / n;
			const d = add( mul( across, Math.cos( ang ) ), mul( depth, Math.sin( ang ) ) );
			out.push( [ add( c, add( mul( across, Math.cos( ang ) * rx ), mul( depth, Math.sin( ang ) * rz ) ) ), norm( d ) ] );

		}

		return out;

	};

	// a tube between two joints in all six poses; rA / rB radii at the ends ( [ across, depth ] ); the
	// fewer the sides, the further out the corners go so the flats keep the silhouette. Each vertex keeps
	// t (along the tube, + t0) and where round it it is (a across, b toward the back, metres). dome: a
	// rounded end over the start (a shoulder's deltoid) or past the end (the fingertips), its height
	// (---- FC4, C4R-3: roundB: the end's dome on a ring half way up it, a knee's or an elbow's round, not
	// a point; the domes keep their tube's side of the joint in t, so the forearm's turn leaves the upper
	// arm's elbow where it is)
	const tube = ( ja, jb, s, rA, rB, part, side, n, cap = false, t0 = 0, domeA = 0, domeB = 0, roundB = false ) => {

		const f = ( 1 + 1 / Math.cos( Math.PI / n ) ) / 2;
		const base = verts.length;
		for ( const t of [ 0, 1 ] ) {

			const r = t ? rB : rA;
			const rings = POSES.map( ( _, k ) => ring( joint( k, ja, s ), joint( k, jb, s ), t, n, r[ 0 ] * f, r[ 1 ] * f ) );
			for ( let k = 0; k < n; k ++ ) {

				const ang = ( k / n ) * Math.PI * 2 + Math.PI / n;
				vert( rings.map( ( rg ) => rg[ k ][ 0 ] ), rings[ 0 ][ k ][ 1 ], rings[ 1 ][ k ][ 1 ], part, side, t + t0, Math.cos( ang ) * r[ 0 ], Math.sin( ang ) * r[ 1 ] );

			}

		}

		for ( let k = 0; k < n; k ++ ) {

			const a = base + k, b = base + ( k + 1 ) % n, c = base + n + k, d = base + n + ( k + 1 ) % n;
			index.push( a, c, b, b, c, d );

		}

		if ( cap ) for ( let k = 1; k < n - 1; k ++ ) index.push( base + n, base + n + k + 1, base + n + k );
		// the domes: a point out along the axis from the ring's centre, in every pose
		const dome = ( t, h, ring0, round = false ) => {

			const end = ( k ) => joint( k, t ? jb : ja, s );
			const out = ( k ) => mul( norm( sub( joint( k, jb, s ), joint( k, ja, s ) ) ), t ? 1 : - 1 );
			// (FC4: the shoulder's before its tube, the forearm's and the shin's at their joint, an end's
			// dome just inside it but the fingertips')
			const tt = t ? t0 + ( part === P.hand ? 1.2 : 0.98 ) : ( t0 || - 0.2 );
			let rim = ring0;
			// ---- FC4 (C4R-3): rounded: a ring of the end's points brought in and out along the axis, the
			// normals between the side's and the axis's (an ellipsoid's), then the point
			if ( round ) {

				const rr = t ? rB : rA, r = ( rr[ 0 ] + rr[ 1 ] ) / 2, mid = verts.length;
				for ( let k = 0; k < n; k ++ ) {

					const e = verts[ ring0 + k ];
					const p6 = POSES.map( ( _, q ) => add( add( end( q ), mul( sub( e.p6[ q ], end( q ) ), 0.72 ) ), mul( out( q ), h * 0.7 ) ) );
					const nn = ( nr, q ) => norm( add( mul( nr, 0.72 / r ), mul( out( q ), 0.7 / h ) ) );
					vert( p6, nn( e.n0, 0 ), nn( e.n1, 1 ), part, side, tt, e.a * 0.72, e.b * 0.72 );

				}

				for ( let k = 0; k < n; k ++ ) index.push( ring0 + k, ring0 + ( k + 1 ) % n, mid + k, ring0 + ( k + 1 ) % n, mid + ( k + 1 ) % n, mid + k );
				rim = mid;

			}
			// ---- end FC4
			const c = vert( POSES.map( ( _, q ) => add( end( q ), mul( out( q ), h ) ) ), out( 0 ), out( 1 ), part, side, tt, 0, 0 );
			for ( let k = 0; k < n; k ++ ) {

				const a = rim + k, b = rim + ( k + 1 ) % n;
				if ( t ) index.push( c, b, a ); else index.push( c, a, b );

			}

		};

		if ( domeA ) dome( 0, domeA, base );
		if ( domeB ) dome( 1, domeB, base + n, roundB );

	};

	// the same point in every pose but the arms' (a head, a brim, hair), sitting at sit, standing at st
	const fixed = ( sit, st ) => [ sit, st, sit, st, sit, st ];

	// The trunk, lofted through TRUNK's rings in each pose (squared off toward a superellipse, as a jacket
	// over a chest is), smooth normals from the surface itself (so the shoulders' slope catches the
	// lights above). The collar's rings (t > 1) carry their t: the shaders turn them into a hood lying
	// on the back, a scarf, a zipped collar
	{

		const n = L.trunk, rings = L.rings;
		const first = verts.length, firstIndex = index.length;
		const centre = ( k, t ) => {

			const [ base ] = POSES[ k ];
			const a = t <= 1 ? base.pelvis : base.chest, b = t <= 1 ? base.chest : base.neck;
			const u = t <= 1 ? t : t - 1;
			return add( a, mul( sub( b, a ), u ) );

		};

		for ( const [ t, rx, rz, dz, sq ] of rings ) {

			for ( let i = 0; i < n; i ++ ) {

				const ang = ( i / n ) * Math.PI * 2 + Math.PI / n;
				const c = Math.cos( ang ), sn = Math.sin( ang );
				// the superellipse: |x / rx|^sq + |z / rz|^sq = 1
				const x = Math.sign( c ) * Math.pow( Math.abs( c ), 2 / sq ) * rx, z = Math.sign( sn ) * Math.pow( Math.abs( sn ), 2 / sq ) * rz;
				const p6 = POSES.map( ( _, k ) => add( centre( k, t ), [ x, 0, z + dz ] ) );
				vert( p6, [ c, 0, sn ], [ c, 0, sn ], P.shirt, 0, t, x, z );

			}

		}

		for ( let r = 0; r < rings.length - 1; r ++ ) for ( let i = 0; i < n; i ++ ) {

			const a = first + r * n + i, b = first + r * n + ( i + 1 ) % n, c = a + n, d = b + n;
			index.push( a, c, b, b, c, d );

		}

		// the top closed (inside the head and the neck)
		const top = first + ( rings.length - 1 ) * n;
		for ( let k = 1; k < n - 1; k ++ ) index.push( top, top + k + 1, top + k );
		// smooth normals, sitting and standing, from the faces round each vertex (the top's cap left out)
		for ( const [ pose, key ] of [ [ 0, 'n0' ], [ 1, 'n1' ] ] ) {

			const acc = new Map();
			for ( let i = firstIndex; i < index.length - ( n - 2 ) * 3; i += 3 ) {

				const [ a, b, c ] = [ index[ i ], index[ i + 1 ], index[ i + 2 ] ];
				const pa = verts[ a ].p6[ pose ], pb = verts[ b ].p6[ pose ], pc = verts[ c ].p6[ pose ];
				const fn = cross( sub( pb, pa ), sub( pc, pa ) );
				for ( const v of [ a, b, c ] ) acc.set( v, add( acc.get( v ) || [ 0, 0, 0 ], fn ) );

			}

			for ( const [ v, s ] of acc ) {

				// facing out (the index winding is the tube's)
				const o = sub( verts[ v ].p6[ pose ], centre( pose, verts[ v ].t ) );
				const nn = norm( s );
				verts[ v ][ key ] = nn[ 0 ] * o[ 0 ] + nn[ 2 ] * o[ 2 ] < 0 ? mul( nn, - 1 ) : nn;

			}

		}

	}

	// the neck: skin above the collar (only the near figures: further off the collar closes it)
	if ( L.neck ) tube( 'throat', 'nape', 1, [ 0.056, 0.052 ], [ 0.05, 0.048 ], P.neck, 0, L.trunk > 8 ? 8 : 6 );
	for ( const s of [ - 1, 1 ] ) {

		// the sleeves (t 0..1 the upper arm, 1..2 the forearm), a round shoulder over the top of the
		// arm (the drum's corners were the arms' open ends), the hands; the legs
		if ( L.joints ) {

			// ---- FC4 (C4R-3): close up the joints closed: the elbow and the knee rounded over the end of the
			// upper arm and the thigh (the forearm's and the shin's tops end inside them), the cuff shut round
			// the wrist (at arm's length the open ends read as logs and pipes: the thighs' flat octagons at the
			// knee, the shins' tops as points, the sleeves hollow)
			const close = L.limb > 6;
			tube( 'shoulder', 'elbow', s, [ 0.06, 0.06 ], [ 0.05, 0.05 ], P.sleeve, s, L.limb, false, 0, L.limb > 3 ? 0.028 : 0, close ? 0.042 : 0, close );
			tube( 'elbow', 'wrist', s, [ 0.05, 0.05 ], [ 0.042, 0.042 ], P.sleeve, s, L.limb, close, 1 );
			tube( 'hip', 'knee', s, [ 0.09, 0.09 ], [ 0.066, 0.066 ], P.pants, 0, L.limb, false, 0, 0, close ? 0.062 : 0, close );
			tube( 'knee', 'ankle', s, [ 0.06, 0.06 ], [ 0.048, 0.048 ], P.pants, 0, L.limb, false, 1 );
			// ---- end FC4

		} else {

			tube( 'shoulder', 'wrist', s, [ 0.06, 0.06 ], [ 0.045, 0.045 ], P.sleeve, s, L.limb );
			tube( 'hip', 'ankle', s, [ 0.08, 0.08 ], [ 0.055, 0.055 ], P.pants, 0, L.limb );

		}

		// the hand: a mitten, flat across the palm, the fingers' end rounded
		// (FW1, C2W-6: blunt, wider across the knuckles than the wrist, the fingers' end a low round, not a
		// pointed dome: from the front the mittens read as claws)
		// (FC4, C4R-3: close up a hand's size, wider than the cuff and the fingers' end a mitten's round, not a
		// tan nub out of the sleeve; near, its end domed too)
		if ( L.hands > 4 ) tube( 'wrist', 'hand', s, [ 0.037, 0.022 ], [ 0.048, 0.022 ], P.hand, s, L.hands, false, 0, 0, 0.045 );
		else if ( L.hands ) tube( 'wrist', 'hand', s, [ 0.031, 0.021 ], [ 0.04, 0.019 ], P.hand, s, L.hands, false, 0, 0, 0.022 );
		// a shoe under each ankle (t 3: the shaders colour it): the toe out in front, the heel behind
		if ( L.shoes ) {

			const q = [];
			for ( const [ x, y, z ] of [ [ - 1, 0, 1 ], [ 1, 0, 1 ], [ 1, 0, - 1 ], [ - 1, 0, - 1 ], [ - 1, 1, 1 ], [ 1, 1, 1 ], [ 1, 1, - 1 ], [ - 1, 1, - 1 ] ] ) {

				const o = [ x * 0.045, - 0.07 + y * 0.085, z < 0 ? - 0.17 : 0.05 ];
				const nn = norm( [ x, y * 2 - 1, z * 0.6 ] );
				q.push( vert( POSES.map( ( _, k ) => add( joint( k, 'ankle', s ), [ o[ 0 ] * ( y ? 0.85 : 1 ), o[ 1 ], o[ 2 ] * ( y && z < 0 ? 0.55 : 1 ) ] ) ), nn, nn, P.pants, 0, 3, x, z ) );

			}

			for ( const [ a, b, c, d ] of [ [ 4, 5, 6, 7 ], [ 0, 1, 5, 4 ], [ 1, 2, 6, 5 ], [ 2, 3, 7, 6 ], [ 3, 0, 4, 7 ] ] ) index.push( q[ a ], q[ c ], q[ b ], q[ a ], q[ d ], q[ c ] );

		}

	}

	// the head: an ellipsoid round its centre in each pose, the jaw narrower and the chin a little forward
	// (the shaders put the hair, a cap, a hood and the face on it); close up a nose
	// ---- FF1 (step 10): close up and near (FOX's backdrop) the players' MakeHuman head instead (FanHead.js:
	// 400 triangles close, 90 near), its blend shapes moved by each fan's weights in the shaders; a the
	// vertex's record in the heads' buffer, plus one (0: the egg's)
	const MH = L.mh ? fanHeadLevel( L.mh ) : null;
	if ( MH ) {

		const first = verts.length;
		for ( let i = 0; i < MH.count; i ++ ) {

			const o = [ MH.position[ i * 3 ], MH.position[ i * 3 + 1 ], MH.position[ i * 3 + 2 ] ];
			const n = [ MH.normal[ i * 3 ], MH.normal[ i * 3 + 1 ], MH.normal[ i * 3 + 2 ] ];
			vert( fixed( add( SIT.head, o ), add( STAND.head, o ) ), n, n, P.head, 0, 0, MH.rec + i + 1, 0 );

		}

		for ( let i = 0; i < MH.index.length; i ++ ) index.push( first + MH.index[ i ] );

	}
	// ---- end FF1
	{

		const [ W, H ] = L.head, r = HEAD_R;
		const first = verts.length;
		const shape = ( d ) => {

			const jaw = Math.max( 0, Math.min( 1, ( - d[ 1 ] - 0.15 ) / 0.7 ) );
			const o = [ d[ 0 ] * r[ 0 ] * ( 1 - 0.16 * jaw ), d[ 1 ] * r[ 1 ], d[ 2 ] * r[ 2 ] ];
			if ( d[ 2 ] < 0 ) o[ 2 ] += 0.007 * jaw * d[ 2 ];
			// ---- FW4 (C3W-4): close up the face modelled a little, as the Cast's near one is: the eyes set
			// back under the brow's ridge, the cheekbones, the chin forward, the back of the head tucked in
			// above the nape (a faceted egg with a square jaw, at arm's length)
			if ( L.name === 'close' ) {

				const ax = Math.abs( d[ 0 ] ), front = Math.max( 0, Math.min( 1, ( 0.15 - d[ 2 ] ) / 0.7 ) );
				const g = ( x, y, sx, sy ) => Math.exp( - ( x * x ) / ( sx * sx ) - ( y * y ) / ( sy * sy ) );
				o[ 2 ] += ( 0.007 * g( ax - 0.33, d[ 1 ] - 0.09, 0.17, 0.12 ) - 0.005 * g( ax - 0.25, d[ 1 ] - 0.29, 0.3, 0.065 )
					- 0.004 * g( ax - 0.5, d[ 1 ] + 0.06, 0.14, 0.11 ) - 0.004 * g( d[ 0 ], d[ 1 ] + 0.43, 0.26, 0.1 ) - 0.009 * g( d[ 0 ], d[ 1 ] + 0.74, 0.3, 0.13 ) ) * front;
				if ( d[ 2 ] > 0 ) o[ 2 ] -= d[ 2 ] * r[ 2 ] * 0.25 * jaw;

			}
			// ---- end FW4
			return o;

		};
		if ( ! MH ) for ( let j = 0; j <= H; j ++ ) for ( let i = 0; i < W; i ++ ) {

			const th = j / H * Math.PI, ph = i / W * Math.PI * 2;
			const d = [ Math.sin( th ) * Math.cos( ph ), Math.cos( th ), Math.sin( th ) * Math.sin( ph ) ];
			const o = shape( d );
			// (FW4: close up the normal from the shape itself, so the brow and the chin take the light)
			let n = d;
			if ( L.name === 'close' && j > 0 && j < H ) {

				const e = 1e-3, dd = ( t, p ) => shape( [ Math.sin( t ) * Math.cos( p ), Math.cos( t ), Math.sin( t ) * Math.sin( p ) ] );
				n = norm( cross( sub( dd( th, ph + e ), dd( th, ph - e ) ), sub( dd( th + e, ph ), dd( th - e, ph ) ) ) );
				if ( n[ 0 ] * d[ 0 ] + n[ 1 ] * d[ 1 ] + n[ 2 ] * d[ 2 ] < 0 ) n = mul( n, - 1 );

			}

			vert( fixed( add( SIT.head, o ), add( STAND.head, o ) ), n, n, P.head, 0 );

		}

		if ( ! MH ) for ( let j = 0; j < H; j ++ ) for ( let i = 0; i < W; i ++ ) {

			const a = first + j * W + i, b = first + j * W + ( i + 1 ) % W, c = a + W, d = b + W;
			if ( j > 0 ) index.push( a, b, c );
			if ( j < H - 1 ) index.push( b, d, c );

		}

		// the nose: a wedge on the face, its normals bent toward the face's so it shades as skin (the
		// Cast's pyramid went dark)
		if ( L.nose && ! MH ) {

			// ---- FW4 (C3W-4): a bridge from between the brows to the tip, the wings either side, the
			// underside back to the lip in shade (it was a wedge: a beak in profile)
			const z0 = - r[ 2 ];
			const pts = [ [ 0, 0.024, z0 + 0.006 ], [ 0, - 0.014, z0 - 0.017 ], [ - 0.014, - 0.03, z0 + 0.004 ], [ 0.014, - 0.03, z0 + 0.004 ], [ 0, - 0.032, z0 - 0.004 ],
				[ - 0.007, 0.004, z0 - 0.004 ], [ 0.007, 0.004, z0 - 0.004 ] ];
			const nrm = [ [ 0, 0.45, - 0.9 ], [ 0, - 0.15, - 1 ], [ - 0.75, - 0.25, - 0.6 ], [ 0.75, - 0.25, - 0.6 ], [ 0, - 0.9, - 0.4 ], [ - 0.6, 0.15, - 0.8 ], [ 0.6, 0.15, - 0.8 ] ];
			const q = pts.map( ( o, i ) => vert( fixed( add( SIT.head, o ), add( STAND.head, o ) ), norm( nrm[ i ] ), norm( nrm[ i ] ), P.head, 0 ) );
			index.push( q[ 0 ], q[ 5 ], q[ 1 ], q[ 0 ], q[ 1 ], q[ 6 ], q[ 5 ], q[ 2 ], q[ 1 ], q[ 6 ], q[ 1 ], q[ 3 ], q[ 1 ], q[ 2 ], q[ 4 ], q[ 1 ], q[ 4 ], q[ 3 ] );
			// ---- end FW4

		}

		// a knit hat's pom-pom (t 2: folded away unless he has one)
		if ( L.pom ) {

			// ---- FX1 (step 11): a ball of yarn tufts sat down into the crown (Getty 83893023's red Phillies
			// knit hat). It was six sides round and three rings high, painted in the hat's stripes and held
			// 1.5 cm over the egg head's crown (FF1's MakeHuman head is 1.4 cm lower again): from the
			// Pavilion Deck the one on the head in the row in front stood out over the infield as a
			// red-and-white striped box two metres high (step 10's stage shots). Close up only (the close
			// level), so the extra sides cost a few hundred fans a hundred vertices each
			const [ pw, phh ] = L.pom, c = [ 0, 0.133, 0.006 ], pr = [ 0.038, 0.034, 0.038 ];
			const f0 = verts.length;
			for ( let j = 0; j <= phh; j ++ ) for ( let i = 0; i < pw; i ++ ) {

				const th = j / phh * Math.PI, ph = i / pw * Math.PI * 2;
				const d = [ Math.sin( th ) * Math.cos( ph ), Math.cos( th ), Math.sin( th ) * Math.sin( ph ) ];
				// (the tufts: lumps a few millimetres proud, flattened a little underneath where it sits)
				const lump = ( 1 + 0.11 * Math.sin( ph * 5 + th * 3.1 ) * Math.sin( th * 4 + ph * 2.3 ) + 0.06 * Math.sin( ph * 9 - th * 7 ) ) * ( d[ 1 ] < - 0.4 ? 0.9 : 1 );
				const o = add( c, [ d[ 0 ] * pr[ 0 ] * lump, d[ 1 ] * pr[ 1 ] * lump, d[ 2 ] * pr[ 2 ] * lump ] );
				// ---- end FX1
				vert( fixed( add( SIT.head, o ), add( STAND.head, o ) ), d, d, P.head, 0, 2 );

			}

			for ( let j = 0; j < phh; j ++ ) for ( let i = 0; i < pw; i ++ ) {

				const a = f0 + j * pw + i, b = f0 + j * pw + ( i + 1 ) % pw, cc = a + pw, d = b + pw;
				if ( j > 0 ) index.push( a, b, cc );
				if ( j < phh - 1 ) index.push( b, d, cc );

			}

		}

		// A cap (CP-1, after the players' in game/Rig.js): the crown its own shell over the skull, a
		// little bigger than the head and taller in front, down to the brow, the tops of the ears and low
		// behind (capRim), the bill coming straight out of its lower edge in front: curved across (its
		// root follows the crown, so its sides drop), pitched a little down, with thickness and an
		// underside. Close up the whole thing; near the bill on the head the shaders shape into a crown;
		// further off a flat bill (two triangles) where it belongs. All folded away for the bareheaded
		const rimAt = ( psi, out = 0.005 ) => {

			// the rim's point at psi round from the front (+ toward his left... the figure's +x)
			const front = Math.cos( psi ), dy = capRim( front ), sxz = Math.sqrt( 1 - dy * dy );
			return [ Math.sin( psi ) * sxz * ( r[ 0 ] + out ), dy * ( r[ 1 ] + out ), - Math.cos( psi ) * sxz * ( r[ 2 ] + out ) ];

		};
		if ( L.crown ) {

			const [ cw, ck ] = L.crown;
			const f0 = verts.length;
			const apex = vert( fixed( add( SIT.head, [ 0, r[ 1 ] + 0.017, - 0.004 ] ), add( STAND.head, [ 0, r[ 1 ] + 0.017, - 0.004 ] ) ), [ 0, 1, 0 ], [ 0, 1, 0 ], P.brim, 0, 2 );
			for ( let k = 1; k <= ck; k ++ ) for ( let i = 0; i < cw; i ++ ) {

				const u = k / ck, psi = ( i / cw ) * Math.PI * 2;
				const front = Math.cos( psi ), th = u * Math.acos( capRim( front ) );
				const d = [ Math.sin( th ) * Math.sin( psi ), Math.cos( th ), - Math.sin( th ) * Math.cos( psi ) ];
				// bigger than the head by a finger at the top, snug at the band; the front panels fuller
				const grow = 0.005 + 0.011 * ( 1 - u * u ), lift = 0.012 * ( 1 - u );
				const o = [ d[ 0 ] * ( r[ 0 ] + grow ), d[ 1 ] * ( r[ 1 ] + grow ) + lift, d[ 2 ] * ( r[ 2 ] + grow + 0.008 * Math.max( 0, front ) * Math.sin( Math.PI * u ) ) ];
				vert( fixed( add( SIT.head, o ), add( STAND.head, o ) ), d, d, P.brim, 0, 2 );

			}

			for ( let i = 0; i < cw; i ++ ) index.push( apex, f0 + 1 + ( i + 1 ) % cw, f0 + 1 + i );
			for ( let k = 1; k < ck; k ++ ) for ( let i = 0; i < cw; i ++ ) {

				const a = f0 + 1 + ( k - 1 ) * cw + i, b = f0 + 1 + ( k - 1 ) * cw + ( i + 1 ) % cw, c = a + cw, d = b + cw;
				index.push( a, b, c, b, d, c );

			}

		}

		if ( L.bill ) {

			// columns across the bill: the ends meet the crown, the middle ones reach out to the bill's edge
			const S = L.bill === 6 ? [ - 1, - 0.62, - 0.22, 0.22, 0.62, 1 ] : [ - 1, - 0.35, 0.35, 1 ];
			const top = [], bot = [], tipT = [], tipB = [];
			for ( const sgn of S ) {

				const psi = sgn * 1.17;
				const root = rimAt( psi, 0.0 );
				const reach = 0.07 * Math.sqrt( Math.max( 0, 1 - sgn * sgn ) );
				const out = norm( [ root[ 0 ] / ( r[ 0 ] * r[ 0 ] ), 0, root[ 2 ] / ( r[ 2 ] * r[ 2 ] ) ] );
				const dir = norm( add( mul( out, 0.45 ), [ 0, 0, - 1 ] ) );
				const tip = add( root, [ dir[ 0 ] * reach, - 0.16 * reach, dir[ 2 ] * reach ] );
				const up = norm( [ out[ 0 ] * 0.35 * Math.abs( sgn ), 1, - 0.12 ] );
				const pt = ( o, dy ) => fixed( add( SIT.head, [ o[ 0 ], o[ 1 ] + dy, o[ 2 ] ] ), add( STAND.head, [ o[ 0 ], o[ 1 ] + dy, o[ 2 ] ] ) );
				top.push( vert( pt( root, 0 ), up, up, P.brim, 0, 1 ) );
				bot.push( vert( pt( root, - 0.006 ), mul( up, - 1 ), mul( up, - 1 ), P.brim, 0, 1 ) );
				if ( reach > 0 ) {

					tipT.push( vert( pt( tip, 0 ), up, up, P.brim, 0, 1 ) );
					tipB.push( vert( pt( tip, - 0.006 ), mul( up, - 1 ), mul( up, - 1 ), P.brim, 0, 1 ) );

				} else {

					tipT.push( top[ top.length - 1 ] );
					tipB.push( bot[ bot.length - 1 ] );

				}

			}

			for ( let i = 0; i < S.length - 1; i ++ ) {

				const quad = ( A, B, flip ) => {

					const [ a, b, c, d ] = [ A[ i ], A[ i + 1 ], B[ i + 1 ], B[ i ] ];
					const tris = [ [ a, b, c ], [ a, c, d ] ].filter( ( [ x, y, z ] ) => x !== y && y !== z && x !== z );
					for ( const [ x, y, z ] of tris ) index.push( ...( flip ? [ x, z, y ] : [ x, y, z ] ) );

				};
				quad( top, tipT, false );
				quad( bot, tipB, true );
				// the front edge: the thickness of the bill
				if ( L.bill === 6 ) quad( tipT, tipB, false );

			}

		} else {

			// further off: a flat bill at the crown's front edge
			const brim = [ [ - 0.075, 0.042, - 0.07 ], [ 0.075, 0.042, - 0.07 ], [ 0.068, 0.033, - 0.168 ], [ - 0.068, 0.033, - 0.168 ] ].map( ( o ) => vert( fixed( add( SIT.head, o ), add( STAND.head, o ) ), [ 0, 1, 0 ], [ 0, 1, 0 ], P.brim, 0, 1 ) );
			index.push( brim[ 0 ], brim[ 2 ], brim[ 1 ], brim[ 0 ], brim[ 3 ], brim[ 2 ] );

		}

		// long hair (or a ponytail) down the back of the head: a card curved round it (close up and near:
		// three columns; a flat one was a board behind the head)
		if ( L.hair && L.extras ) {

			// ---- FP2: close up, a shell round the back and sides of the head from the crown to the
			// shoulders, framing the face in front of the ears (the card read as a panel behind her head from
			// the aisle). Rows [ height, half width, half depth, how far round from the back ]; v down it
			// (---- FC4, C4R-3: falling in toward its ends and onto the back, the ends ragged in locks, a lock
			// longer, the next shorter: it was a drum from the crown to the shoulders, a hay bale)
			const rows = [ [ 0.045, 0.077, 0.094, 2.15 ], [ - 0.025, 0.09, 0.108, 2.05 ], [ - 0.11, 0.088, 0.115, 1.75 ], [ - 0.2, 0.072, 0.112, 1.3 ] ];
			const cols = 7, q = [];
			rows.forEach( ( [ y, rx, rz, span ], j ) => {

				for ( let i = 0; i < cols; i ++ ) {

					const u = i / ( cols - 1 ), ph = ( 1 - 2 * u ) * span, n = [ Math.sin( ph ), 0.15, Math.cos( ph ) ];
					const lock = j === rows.length - 1 ? [ 0, - 0.03, 0.012, - 0.022, 0.006, - 0.034, 0 ][ i ] : j === rows.length - 2 ? 0.004 * ( i % 2 ) : 0;
					const o = [ Math.sin( ph ) * rx * ( 1 + 2.5 * lock ), y + lock, Math.cos( ph ) * rz ];
					q.push( vert( fixed( add( SIT.head, o ), add( STAND.head, o ) ), n, n, P.hair, 0, 0, u, j / ( rows.length - 1 ) ) );

				}

			} );
			for ( let j = 0; j < rows.length - 1; j ++ ) for ( let i = 0; i < cols - 1; i ++ ) {

				const a = j * cols + i;
				index.push( q[ a ], q[ a + cols + 1 ], q[ a + 1 ], q[ a ], q[ a + cols ], q[ a + cols + 1 ] );

			}

		} else if ( L.hair ) {

			const cols = L.trunk >= 6 && L.head[ 0 ] >= 8 ? 3 : 2, q = [];
			for ( const v of [ 0, 1 ] ) for ( let i = 0; i < cols; i ++ ) {

				const u = i / ( cols - 1 ), x = 1 - 2 * u;
				const o = [ ( 0.085 + 0.015 * v ) * x, 0.03 - 0.23 * v, 0.05 + 0.02 * v + 0.035 * ( 1 - x * x ) ];
				q.push( vert( fixed( add( SIT.head, o ), add( STAND.head, o ) ), [ x * 0.6, 0.2, 1 ], [ x * 0.6, 0.2, 1 ], P.hair, 0, 0, u, v ) );

			}

			for ( let i = 0; i < cols - 1; i ++ ) index.push( q[ i ], q[ cols + i + 1 ], q[ i + 1 ], q[ i ], q[ cols + i ], q[ cols + i + 1 ] );

		}

	}

	// the rally towel in the right hand: a cloth of 3 x 3 points (u across, v from the hand to the loose
	// end; t = v), folded on his lap sitting, hanging from his hand standing. It goes up only to be
	// twirled (the shaders spin it, the loose end trailing the turn and fluttering: CP-8, it was a stiff
	// card that a raised arm swept across the faces behind)
	{

		const hand = ( k ) => joint( k, 'hand', 1 );
		const q = [];
		for ( let j = 0; j < 3; j ++ ) for ( let i = 0; i < 3; i ++ ) {

			const u = i / 2, v = j / 2, dx = ( 1 - 2 * u ) * 0.14;
			// (FW1, C2W-6: folded narrower, rucked up, its far end over the knee and down: it lay flat as a card)
			const lap = add( hand( 0 ), [ dx * 0.8 * ( 1 - 0.15 * v ), 0.03 + 0.022 * Math.sin( Math.PI * 2 * u + v * 2.4 ) * ( 0.4 + v ) - 0.11 * Math.max( 0, v - 0.45 ) ** 1.6 * 2.4, - 0.17 * v ] );
			const lapS = add( hand( 1 ), [ dx * 0.5 * ( 1 - 0.3 * v ), - 0.26 * v, 0.02 + 0.02 * Math.sin( Math.PI * u ) ] );
			q.push( vert( [ lap, lapS, lap, lapS, lap, lapS ], [ 0, 1, 0 ], [ 0, 0, - 1 ], P.towel, 1, v, u, v ) );

		}

		for ( let j = 0; j < 2; j ++ ) for ( let i = 0; i < 2; i ++ ) {

			const a = q[ j * 3 + i ], b = q[ j * 3 + i + 1 ], c = q[ j * 3 + i + 3 ], d = q[ j * 3 + i + 4 ];
			index.push( a, b, d, a, d, c );

		}

	}

	// the sign, in both hands: flat on the lap sitting, at the waist standing, over the head held up. u
	// runs from his right (the viewer's left) to his left, v down it (close up and near: FP2, CP-12, the
	// TV's backdrop has them)
	if ( L.extras || L.sign ) {

		const at = ( k, u, v ) => {

			const x = ( k >= 2 && k <= 3 ? 0.36 : 0.3 ) * ( 1 - 2 * u );
			if ( k === 2 ) return [ x, 2.09 - 0.51 * v, - 0.1 + 0.02 * v ];
			if ( k === 3 ) return [ x, 2.47 - 0.51 * v, - 0.14 + 0.02 * v ];
			if ( k % 2 === 0 ) return [ x, 0.62 - 0.02 * v, - 0.46 + 0.4 * v ];
			return [ x, 1.1 - 0.5 * v, - 0.2 ];

		};
		const q = [];
		for ( const [ u, v ] of [ [ 0, 0 ], [ 1, 0 ], [ 1, 1 ], [ 0, 1 ] ] ) q.push( vert( POSES.map( ( _, k ) => at( k, u, v ) ), [ 0, 1, 0 ], [ 0, 0, - 1 ], P.sign, u ? - 1 : 1, 0, u, v ) );
		index.push( q[ 0 ], q[ 2 ], q[ 1 ], q[ 0 ], q[ 3 ], q[ 2 ] );

	}

	// a blanket: over the lap and the knees sitting, round the shoulders standing
	if ( L.extras ) {

		const q = [];
		const sit = [ [ 0.23, 0.56, 0.06 ], [ 0.25, 0.58, - 0.42 ], [ 0.25, 0.22, - 0.47 ] ];
		const st = [ [ 0.22, 1.44, 0.12 ], [ 0.27, 1.04, 0.17 ], [ 0.26, 0.76, 0.16 ] ];
		const nS = [ [ 0, 1, 0 ], [ 0, 0.6, - 0.8 ], [ 0, 0, - 1 ] ];
		for ( let j = 0; j < 3; j ++ ) for ( const u of [ 0, 1 ] ) {

			const k = 1 - 2 * u;
			q.push( vert( fixed( [ sit[ j ][ 0 ] * k, sit[ j ][ 1 ], sit[ j ][ 2 ] ], [ st[ j ][ 0 ] * k, st[ j ][ 1 ], st[ j ][ 2 ] ] ), nS[ j ], [ 0, 0.1, 1 ], P.blanket, 0, 0, u, j / 2 ) );

		}

		for ( const j of [ 0, 2 ] ) index.push( q[ j ], q[ j + 3 ], q[ j + 1 ], q[ j ], q[ j + 2 ], q[ j + 3 ] );

	}

	// what he has in his left hand: a box the shader sizes for a beer, a hot dog, a camera, a glove...
	// (every vertex at the hand, t a b = the corner)
	// ---- FC4 (C4R-3): an eight-sided cup that widens to its rim, its top a disc (the lager's head, the
	// hot chocolate's lid); the shaders square it off for a phone or a camera. It was a box, so every beer
	// at arm's length was a solid amber cube (Getty 83893023: the clear plastic cups of the 27th)
	if ( L.extras ) {

		const hand = POSES.map( ( _, k ) => joint( k, 'hand', - 1 ) );
		const n = 8, ring = ( y, w, up ) => {

			const out = [];
			for ( let i = 0; i < n; i ++ ) {

				const ang = ( i + 0.5 ) / n * Math.PI * 2, c = Math.cos( ang ), sn = Math.sin( ang );
				const nn = up ? [ 0, 1, 0 ] : norm( [ c, 0.12, sn ] );
				out.push( vert( hand, nn, nn, P.prop, - 1, y, 0.5 * w * c, 0.5 * w * sn ) );

			}

			return out;

		};
		const lo = ring( - 0.5, 0.74 ), hi = ring( 0.5, 1 ), top = ring( 0.5, 1, true );
		for ( let i = 0; i < n; i ++ ) {

			const j = ( i + 1 ) % n;
			index.push( lo[ i ], hi[ j ], hi[ i ], lo[ i ], lo[ j ], hi[ j ] );

		}

		for ( let i = 1; i < n - 1; i ++ ) index.push( top[ 0 ], top[ i + 1 ], top[ i ], lo[ 0 ], lo[ i ], lo[ i + 1 ] );

	}
	// ---- end FC4

	// every triangle wound to face the way its vertices' normals do (the engine's front face is
	// counter-clockwise; the material is double sided and turns a back face's normal round, so a tube
	// wound the other way was lit inside out: the trunks and limbs took the light on their far side)
	for ( let i = 0; i < index.length; i += 3 ) {

		const [ a, b, c ] = [ verts[ index[ i ] ], verts[ index[ i + 1 ] ], verts[ index[ i + 2 ] ] ];
		for ( const k of [ 0, 1 ] ) {

			const fn = cross( sub( b.p6[ k ], a.p6[ k ] ), sub( c.p6[ k ], a.p6[ k ] ) );
			if ( Math.hypot( ...fn ) < 1e-9 ) continue;
			const key = k ? 'n1' : 'n0';
			const vn = add( add( a[ key ], b[ key ] ), c[ key ] );
			if ( fn[ 0 ] * vn[ 0 ] + fn[ 1 ] * vn[ 1 ] + fn[ 2 ] * vn[ 2 ] < 0 ) [ index[ i + 1 ], index[ i + 2 ] ] = [ index[ i + 2 ], index[ i + 1 ] ];
			break;

		}

	}

	const data = new Float32Array( verts.length * STRIDE );
	verts.forEach( ( v, i ) => {

		const o = i * STRIDE;
		const [ p0, p1, p2, p3, p4, p5 ] = v.p6;
		data.set( p0, o );
		data.set( v.n0, o + 3 );
		data.set( p1, o + 6 );
		data.set( v.n1, o + 9 );
		data.set( sub( p2, p0 ), o + 12 );
		data.set( sub( p3, p1 ), o + 15 );
		data.set( sub( p4, p0 ), o + 18 );
		data.set( sub( p5, p1 ), o + 21 );
		data.set( [ v.code, v.t, v.a, v.b ], o + 24 );

	} );
	const buf = new InterleavedBuffer( data, STRIDE );
	const g = new BufferGeometry();
	[ [ 'position', 3 ], [ 'normal', 3 ], [ 'aStand', 3 ], [ 'aStandN', 3 ], [ 'aSitUp', 3 ], [ 'aStandUp', 3 ], [ 'aSitFace', 3 ], [ 'aStandFace', 3 ], [ 'aInfo', 4 ] ].reduce( ( o, [ name, k ] ) => {

		g.setAttribute( name, new InterleavedBufferAttribute( buf, k, o ) );
		return o + k;

	}, 0 );
	g.setIndex( index );
	// every pose: standing, arms and signs up, a kid on the shoulders, a step into the aisle
	g.boundingBox = new Box3( new Vector3( - 1.3, - 0.1, - 1.0 ), new Vector3( 1.3, 2.8, 0.7 ) );
	g.boundingSphere = new Sphere( new Vector3( 0, 1.2, - 0.1 ), 1.95 );
	return g;

}

// ---------------------------------------------------------------- the shaders

const f3 = ( a ) => `vec3f( ${ a.map( ( x ) => x.toFixed( 3 ) ).join( ', ' ) } )`;

// the most fans (the seats' chunks come to ~42,000)
const MAX_FANS = 49152;
// ---- FP2: the camera flashes' sprites (_flashBuild)
const FLASHES = 4096;
// ---- FS1 (C4S-8): the share of the open seats' fans with an umbrella in the rain, and how far his right
// hand's brought to his face holding it (the kernel and _umbrellas)
const UMBRELLA_SHARE = 0.014, UMBRELLA_FACE = 0.6;
// the seats in each piece of a chunk (addChunk)
// (---- SP2: 120, not 360: a piece takes its level from its nearest fan, so from a seat in the stands
// a third of the 400s round you went at the near level for its front rows' sake: 1.4M triangles)
const PIECE = 120;

// Everything about a fan that's the same for all his vertices and all his pixels is worked out once a
// frame, for each fan, by a compute pass (Crowd._kernel): how far up he is, each arm raised or at his
// face, the towel's turn, his head turned to talk, the jump and the sway, his build, what he's wearing
// and holding, and the colours of it all. Per fan: 10 vec4s of pose (this frame's, then last frame's for
// the motion vectors) in cwPoseBuf, and 6 of look in cwLookBuf. The vertex shader keeps only what
// differs vertex to vertex (the morph, the towel's spin, the head, the build), the fragment shader only
// what differs pixel to pixel (the face, the hair, the hat): each of his ~200 vertices and every pixel
// of him no longer works the rest out again (it was most of the crowd's cost).

// the hash (the CPU has the same, pcg(), to pick the cast's seeds)
const cwHashModule = new ShaderModule( {
	name: 'crowd-hash',
	code: /* wgsl */`
fn cwHash( n: u32 ) -> u32 {
	var x = n * 747796405u + 2891336453u;
	x = ( ( x >> ( ( x >> 28u ) + 4u ) ) ^ x ) * 277803737u;
	return ( x >> 22u ) ^ x;
}

// four numbers in [ 0, 1 ) from a fan's seed
fn cwRand4( s: u32 ) -> vec4f {
	return vec4f( f32( cwHash( s ) ), f32( cwHash( s + 101u ) ), f32( cwHash( s + 202u ) ), f32( cwHash( s + 303u ) ) ) / 4294967296.0;
}

// 1 inside [ a, b ] of a cycle x in [ 0, 1 ), easing in and out
fn cwWin( x: f32, a: f32, b: f32 ) -> f32 {
	return smoothstep( a, a + 0.02, x ) * ( 1.0 - smoothstep( b - 0.02, b, x ) );
}
`,
} );

// the flags in a fan's pose (r3.w): a bit per part he has on him (parts 0-11), then his hood up, a knit
// hat, a ponytail, a poncho, a pom-pom on the knit hat, a hoodie's hood down on his back, a scarf
const PONCHO_BIT = 15;
// a fan's pose: 5 vec4s this frame, then 5 for last frame's (the motion vectors)
const POSE_N = 5;

// The compute pass: one thread per fan
const kernelCode = /* wgsl */`
struct CwFanPose { r0: vec4f, r1: vec4f, r2: vec4f, r3: vec4f, r4: vec4f };

// his pose at time t (---- FS1: seat.w is which way his seat faces, i his place in the buffers)
fn cwFanPose( ids: vec3u, h: vec4f, seat: vec4f, t: f32, i: u32 ) -> CwFanPose {
	let look = ids.y;
	let act = ids.z;
	let build = ( ids.x >> 22u ) & 3u;
	let outfit = look & 31u;
	let hat = ( look >> 10u ) & 7u;
	let hairStyle = ( look >> 13u ) & 3u;
	let blanket = ( look >> 20u ) & 1u;
	let age = ( look >> 21u ) & 3u;
	let female = ( look >> 23u ) & 1u;
	var prop = act & 15u; // (FS1: a camera brought out at strike three)
	let sg = ( act >> 4u ) & 63u;
	let towel = ( act >> 10u ) & 1u;
	let isRays = ( ( act >> 18u ) & 1u ) == 1u;
	let rain = cw.misc.z;
	// ---- FS1 (C4S-8): at the 27th's wettest (the 5th and 6th) nearly half in ponchos and every hoodie's
	// hood up, over the cap with the bill out (Getty 83458180, 83511062: two in three near the camera in
	// ponchos or hoods); it was a quarter and a third
	let poncho = ( ( act >> 19u ) & 1u ) == 1u || fract( h.z * 9.3 ) < rain * 0.45;
	let capped = hat == 1u || hat == 2u || hat == 5u || hat == 6u;
	let hoodie = outfit == 0u;
	// hoods up in the rain (over a cap too: the bill pokes out of it, Getty 83893023)
	let hood = hat == 4u || poncho || ( hoodie && fract( h.w * 5.3 ) < select( 0.95, 0.8, capped ) * rain );
	// ---- end FS1
	let scarf = ( ( look >> 18u ) & 1u ) == 1u;

	// the reaction reaches each fan in turn, spreading out from where it happened
	let rip = cw.ripple;
	let tau = rip.w - length( seat.xz - rip.xy ) * rip.z - h.y * 0.45;
	var M = mix( cw.moodA, cw.moodB, smoothstep( 0.0, 0.7 + h.z * 0.8, tau ) );
	// a local reaction (Crowd.focus): the fans round something up and cheering, easing off to the edge
	for ( var k = 0u; k < 4u; k ++ ) {
		let f = cw.focus[ k ];
		if ( f.z > 0.0 ) {
			let w = 1.0 - smoothstep( f.z * 0.55, f.z, length( seat.xz - f.xy ) );
			M.x = max( M.x, cw.focusMood[ k ].x * w );
			M.y = max( M.y, cw.focusMood[ k ].y * w );
		}
	}
	let A1 = cw.act1;
	let A3 = cw.act3;
	let calm = ( 1.0 - M.x ) * ( 1.0 - A1.z );

	// up, arms up (the Rays fans have their own moments), clapping, towels, a jump
	// (each by his own threshold, through a narrow window: a mood held half way has a few fans half up,
	// not one in ten crouched through his seat)
	var st = smoothstep( h.x * 0.96, h.x * 0.96 + 0.04, select( M.x, A3.x, isRays ) );
	let upAll = smoothstep( h.y * 0.95, h.y * 0.95 + 0.05, select( M.y, A3.y, isRays ) );
	let clap = select( A1.x * step( h.z, 0.8 ), 0.0, isRays ) * ( 1.0 - upAll );
	let face = clap * ( 0.5 + 0.13 * sin( t * 15.0 + h.w * 40.0 ) );
	// the rally towels twirled over their heads: each at his own pace (1.4 to 2.3 turns a second), the
	// phase rippling across the stands so neighbours are close but never together
	var tw = select( 0.0, smoothstep( fract( h.z * 13.0 ) * 0.95, fract( h.z * 13.0 ) * 0.95 + 0.05, M.z ), towel == 1u && ! isRays );
	let upR = max( upAll, tw );
	// talking to the neighbours now and then
	var yaw = select( - 0.6, 0.6, h.w > 0.5 ) * cwWin( fract( t / ( 28.0 + h.y * 25.0 ) + h.z * 9.0 ), 0.0, 0.16 ) * calm;
	var jump = M.w * st;
	// each arm raised or at the face (left, right), pumping when they're up
	let pump = mix( 1.0, 0.88 + 0.12 * sin( t * 6.0 + h.w * 30.0 ), upAll );
	// ---- FP2 (CP-12): a sign's held up over the head now and then between pitches, whenever they cheer,
	// with the towels when the stands are up (fewer in the rain: they get soaked)
	let signOn = sg != 0u && ! ( rain > 0.35 && fract( h.x * 17.3 ) < 0.6 );
	var sup = select( 0.0, max( cwWin( fract( t / ( 34.0 + h.y * 30.0 ) + h.z * 7.0 ), 0.0, 0.32 ) * ( 1.0 - 0.7 * rain ), smoothstep( 0.3, 0.6, M.z ) ), signOn );
	var aUL = max( upAll, sup ) * pump;
	var aUR = max( upR, sup ) * pump;
	// the towel's turn, and its tip flapping held still
	let th = t * ( 9.0 + 5.5 * fract( h.w * 17.0 ) ) + dot( seat.xz, vec2f( 0.31, 0.23 ) ) + h.x * 1.2;
	// ---- FS1: each arm at the face (left, right), the mouth open, a lean to one side (the vars FS1's acts set)
	var fL = face * ( 1.0 - aUL );
	var fR = face * ( 1.0 - aUR );
	var opn = max( upAll, jump );
	var hugRoll = 0.0;
	let fs = cw.fs1;
	// ---- FS1 (C4S-3): his head turned toward the play (the plate on a pitch, the ball in play, the pile,
	// the flag in the song: Crowd._look), a third of it in his shoulders (cwVertex), up to ~70 degrees
	// from his seat's way; each a little his own way, one in ten hardly looking (the phone, the neighbour).
	// It was only the talk to a neighbour: down the lines the whole row stared across the field
	let cov = seat.w > 4.0; // (FS1: under a deck: _seat() adds 8 to the facing angle)
	let fwd = vec2f( sin( seat.w - select( 0.0, 8.0, cov ) ), cos( seat.w - select( 0.0, 8.0, cov ) ) );
	let rgt = vec2f( - fwd.y, fwd.x );
	let toF = cw.fsLook.xy - seat.xz;
	let attend = cw.fsLook.z * select( 1.0, 0.3, fract( h.x * 23.7 ) < 0.1 ) * select( 1.0, 0.0, ( act >> 31u ) == 1u );
	let want = clamp( atan2( - dot( toF, rgt ), dot( toF, fwd ) ) + ( fract( h.y * 17.3 ) - 0.5 ) * 0.3, - 1.22, 1.22 );
	yaw = clamp( yaw * ( 1.0 - 0.6 * attend ) + want * attend, - 1.35, 1.35 );
	// ---- FS1 (C4S-2): strike three and after, each his own way (Getty 112874141, the strike: a towel in
	// about one hand in four, the rest fists up, both arms up, hands on heads, cameras up, mouths open;
	// ronniebruce 2987487127, the pile: two men hugging in the row in front). A new act every few seconds
	// on his own beat; the mix shifts over the first two minutes from arms up to clapping, pictures and
	// talking, and after a couple of minutes some sit. It was three in four twirling a towel at once for
	// minutes (the stands went white) and everyone else in one pose
	let cel = fs.x;
	if ( cel >= 0.0 && ! isRays ) {
		// (the moment reaching him: the jump comes with the ripple from the plate)
		let g = select( 1.0, smoothstep( 0.15, 0.6, M.w ), cel < 8.0 );
		let late = smoothstep( 20.0, 120.0, cel );
		let per = 2.5 + 4.5 * fract( h.w * 3.31 );
		let cyc = cel / per + fract( h.x * 5.13 );
		let q = f32( cwHash( ( ids.x & 0xffffu ) * 977u + u32( cyc ) ) ) / 4294967296.0;
		let e = fract( cyc );
		let ez = smoothstep( 0.0, 0.07, e ) * smoothstep( 1.0, 0.93, e );
		let wave = 0.82 + 0.18 * sin( t * 6.5 + h.w * 30.0 );
		var aL = 0.0; var aR = 0.0; var cL = 0.0; var cR = 0.0; var twk = 0.0; var jk = 0.4; var turn = 0.0;
		let pUp = mix( 0.36, 0.08, late );
		let pTw = pUp + mix( 0.3, 0.12, late ) * f32( towel );
		let pFist = pTw + mix( 0.14, 0.05, late );
		let pHead = pFist + mix( 0.09, 0.03, late );
		let pCam = pHead + mix( 0.05, 0.16, late );
		let pClap = pCam + mix( 0.06, 0.24, late );
		let pTurn = pClap + mix( 0.06, 0.14, late );
		if ( q < pUp ) { aL = wave; aR = wave; jk = 1.0; }
		else if ( q < pTw ) { aR = 1.0; twk = 1.0; aL = select( 0.0, wave, fract( h.y * 3.7 ) < 0.4 ); jk = 0.8; }
		else if ( q < pFist ) { aR = 0.5 + 0.5 * max( 0.0, sin( t * 7.0 + h.w * 20.0 ) ); cL = 0.3; }
		else if ( q < pHead ) { aL = 0.45; aR = 0.45; cL = 0.55; cR = 0.55; jk = 0.0; }
		else if ( q < pCam ) { aL = 0.35; cL = 0.65; aR = 0.2; cR = 0.5; jk = 0.0; prop = select( 4u, 3u, fract( h.z * 7.9 ) < 0.4 ); }
		else if ( q < pClap ) { let c = 0.5 + 0.13 * sin( t * 15.0 + h.w * 40.0 ); cL = c; cR = c; jk = 0.3; }
		else if ( q < pTurn ) { turn = select( - 0.95, 0.95, fract( h.z * 3.9 + floor( cyc ) * 0.37 ) < 0.5 ); aR = select( 0.0, 0.55, fract( h.x * 9.7 ) < 0.5 ); jk = 0.2; }
		else { cR = select( 0.0, 0.6, fract( h.w * 13.1 ) < 0.3 ); jk = 0.1; }
		// pairs of neighbours (by their places: each seat and the one beside it) hugging, the inner arm up
		// round the other's shoulders, leaning in, turned to each other, the other fist up or down
		let n = u32( cw.misc.w + 0.5 );
		let pj = i ^ 1u;
		var hg = 0.0;
		var side = 0.0;
		if ( pj < n ) {
			let ps = cwSeats[ pj ];
			let off = ps.xz - seat.xz;
			let pid = cwIds[ pj ].z;
			let pc = cel / 6.0 + f32( cwHash( i >> 1u ) ) / 4294967296.0;
			let pq = f32( cwHash( ( i >> 1u ) * 613u + u32( pc ) ) ) / 4294967296.0;
			if ( length( off ) < 0.8 && abs( ps.y - seat.y ) < 0.25 && ( pid >> 31u ) == 0u && ( ( pid >> 18u ) & 1u ) == 0u && pq < mix( 0.18, 0.12, late ) ) {
				hg = smoothstep( 0.0, 0.08, fract( pc ) ) * smoothstep( 1.0, 0.85, fract( pc ) );
				side = select( - 1.0, 1.0, dot( off, rgt ) > 0.0 );
			}
		}
		if ( hg > 0.0 ) {
			let other = select( 0.0, wave, fract( f32( cwHash( ( i >> 1u ) * 31u ) ) / 4294967296.0 ) < 0.6 );
			aL = mix( aL * ez, select( other, 0.62, side < 0.0 ), hg );
			aR = mix( aR * ez, select( other, 0.62, side > 0.0 ), hg );
			cL = cL * ez * ( 1.0 - hg ); cR = cR * ez * ( 1.0 - hg ); twk = twk * ez * ( 1.0 - hg );
			turn = mix( turn, - 0.95 * side, hg );
			hugRoll = - 0.2 * side * hg;
			jk = mix( jk, 0.1, hg );
		} else {
			aL *= ez; aR *= ez; cL *= ez; cR *= ez; twk *= ez;
		}
		// after a couple of minutes some sit back down (the trophy, the laps)
		let sitK = 0.35 * smoothstep( 110.0, 230.0, cel );
		let stK = select( 1.0, 0.0, fract( h.z * 29.3 ) < sitK );
		st = mix( st, stK, g );
		aUL = mix( aUL, aL, g );
		aUR = mix( aUR, aR, g );
		fL = mix( fL, cL * ( 1.0 - aL ), g );
		fR = mix( fR, cR * ( 1.0 - aR ), g );
		tw = mix( tw, twk * f32( towel ), g );
		sup = mix( sup, sup * 0.5, g );
		jump = mix( jump, M.w * stK * jk, g );
		yaw = clamp( yaw + turn * g * ez, - 1.35, 1.35 );
		opn = mix( opn, select( 0.3, 1.0, fract( h.y * 5.9 ) < mix( 0.8, 0.4, late ) ), g );
		if ( prop != ( act & 15u ) && g * ez < 0.3 ) { prop = act & 15u; }
	}
	// ---- FS1 (C4S-5): God Bless America (fs.y, Crowd._song): on their feet facing the flag (fsLook), caps
	// off and the right hand at the chest with the cap in it, most of the knit hats off too (some keep
	// theirs on in the cold), the towels and the signs down, some singing along. It was the park in its
	// caps, signs up, facing straight out
	let sol = fs.y * select( 1.0, 0.0, fract( h.w * 41.3 ) < 0.06 );
	let bare = sol > 0.25 + 0.5 * fract( h.z * 17.9 ) && ( capped || ( ( hat == 3u || hat == 7u ) && fract( h.x * 13.1 ) < 0.65 ) );
	if ( sol > 0.0 ) {
		aUL *= 1.0 - sol;
		aUR *= 1.0 - sol;
		fL *= 1.0 - sol;
		fR = mix( fR, 0.62, sol );
		tw *= 1.0 - sol;
		sup *= 1.0 - sol;
		opn = mix( opn, 0.28 * step( 0.45, fract( h.y * 7.9 ) ) * ( 0.6 + 0.4 * sin( t * 2.6 + h.w * 9.0 ) ), sol );
	}
	// ---- FS1 (C4S-4): the rain delay (fs.z): the ones who stay are up and about, nearly half on their feet
	// stretching their legs or talking, turned to each other, not sat square to an empty field as if a
	// pitch were coming (Getty 83458502: the stayers standing, walking up the aisles)
	if ( fs.z > 0.0 ) {
		st = max( st, select( 0.0, fs.z, fract( h.y * 31.7 ) < 0.45 ) );
		yaw = clamp( yaw + select( - 0.8, 0.8, h.z > 0.5 ) * cwWin( fract( t / ( 14.0 + h.x * 10.0 ) + h.w ), 0.0, 0.45 ) * fs.z, - 1.35, 1.35 );
	}
	// ---- FS1 (C4S-8): an umbrella for about one in seventy out in the open in the rain (Crowd._umbrellas
	// draws them, the same fans): the right hand up in front of the chest on its shaft
	let umb = select( 0.0, smoothstep( 0.3, 0.5, rain ), ! cov && ! isRays && f32( cwHash( i * 7u + 3u ) ) / 4294967296.0 < ${ UMBRELLA_SHARE } );
	fR = mix( fR, ${ UMBRELLA_FACE }, umb );
	aUR *= 1.0 - umb;
	tw *= 1.0 - umb;
	// ---- end FS1

	// his build (broad, a belly), a kid's size
	var WIDE = array<f32, 4>( 0.92, 1.0, 1.12, 1.26 );
	let wide = select( WIDE[ build ], 0.93, female == 1u );
	let sc = select( select( 0.97 + h.y * 0.08, 0.92, age == 3u ), 0.64 + h.z * 0.1, age == 2u );

	// how he sits: a lean of his own (forward on his knees, back in the seat, a little to one side),
	// hunched forward in the rain on the 27th and on a two-strike count; his head down under a hood in
	// the rain, up when they cheer (the photos: nobody sits bolt upright for three hours)
	var lean = ( fract( h.x * 7.13 ) - 0.35 ) * 0.14 + rain * ( 0.06 + 0.22 * fract( h.y * 3.71 ) ) + A1.z * 0.16 * fract( h.w * 5.3 );
	lean *= mix( 1.0, 0.3, st ) * ( 1.0 - 0.7 * upAll );
	let roll = ( fract( h.z * 4.7 ) - 0.5 ) * 0.09 * calm + hugRoll; // (FS1: leaning into a hug)
	let nod = ( fract( h.y * 9.1 ) - 0.4 ) * 0.16 + rain * 0.14 * fract( h.x * 2.9 ) - 0.12 * upAll;

	// what he's wearing and holding (the trunk, legs, hands, head, sleeves and neck always; a cap's bill
	// over the hood too)
	var keep = 207u;
	if ( capped && ! bare ) { keep |= 1u << 4u; } // (FS1, C4S-5: the cap off in the song)
	// (FW1, C2W-6: up when they twirl it; otherwise out on the lap for some, put away for the rest)
	let towelOut = fract( h.y * 7.7 ) < 0.5 - 0.36 * rain && fract( h.z * 5.7 + h.w * 1.3 ) < 0.42 - 0.17 * rain && prop == 0u;
	if ( towel == 1u && ! isRays && ( tw > 0.01 || towelOut ) ) { keep |= 1u << 5u; }
	if ( prop != 0u ) { keep |= 1u << 8u; }
	if ( signOn ) { keep |= 1u << 9u; }
	if ( ( hairStyle == 1u || hairStyle == 3u ) && ! hood && ( ! capped || bare ) ) { keep |= 1u << 10u; }
	if ( blanket == 1u ) { keep |= 1u << 11u; }
	// a seat given to someone else (Crowd.vacate): nobody here
	if ( ( act >> 31u ) == 1u ) { keep = 0u; }
	let pom = ( hat == 3u || ( hat == 7u && fract( h.z * 31.0 ) < 0.4 ) ) && ! bare;
	// (---- FS1, C4S-5: 19, bareheaded now: the shaders paint no cap or knit hat on his head)
	let flags = keep | select( 0u, 1u << 12u, hood ) | select( 0u, 1u << 13u, ( hat == 3u || hat == 7u ) && ! bare ) | select( 0u, 1u << 14u, hairStyle == 3u ) | select( 0u, 1u << ${ PONCHO_BIT }u, poncho )
		| select( 0u, 1u << 16u, pom ) | select( 0u, 1u << 17u, hoodie && ! hood ) | select( 0u, 1u << 18u, scarf && ! poncho ) | select( 0u, 1u << 19u, bare );

	// ---- FF2 (step 10): his face (the close and near levels' MakeHuman head: FanHead.js's expressions). A
	// smile when they cheer, his own size of one, the whole park's from strike three (the Rays' fans none),
	// less in the cold rain, none in the song; a blink every three to six seconds by his own clock. Packed
	// with the mouth's opening in r3.z: the mouth in 6 bits, the smile and the blink in 4 each
	var smile = select( M.y, A3.y, isRays ) * ( 0.45 + 0.55 * fract( h.w * 23.3 ) );
	if ( cel >= 0.0 && ! isRays ) { smile = max( smile, 0.55 + 0.45 * fract( h.z * 19.1 ) ); }
	smile *= ( 1.0 - sol ) * ( 1.0 - 0.6 * rain );
	let bp = 2.8 + 3.2 * fract( h.z * 7.7 );
	let bt = fract( t / bp + h.w * 3.1 ) * bp;
	let blink = smoothstep( 0.0, 0.05, bt ) * ( 1.0 - smoothstep( 0.1, 0.2, bt ) );
	let faceQ = u32( clamp( opn, 0.0, 1.0 ) * 63.0 + 0.5 ) | ( u32( clamp( smile, 0.0, 1.0 ) * 15.0 + 0.5 ) << 6u ) | ( u32( blink * 15.0 + 0.5 ) << 10u );
	// ---- end FF2

	var o: CwFanPose;
	o.r0 = vec4f( st, aUL, aUR, fL ); // (FS1: fL, fR, opn)
	o.r1 = vec4f( fR, tw, th, yaw );
	o.r2 = vec4f( max( 0.0, sin( t * 8.0 + h.w * 30.0 ) ) * 0.14 * jump, sin( t * 0.6 + h.z * 20.0 ) * 0.012, sin( t * 9.0 + h.w * 50.0 ) * 0.16, cos( t * 7.0 + h.z * 20.0 ) * 0.06 );
	o.r3 = vec4f( wide, sc, f32( faceQ ), f32( flags ) ); // (FF2: the mouth, the smile and the blink packed)
	// ---- FW1 (C2W-6): what he does with his hands sitting (on his lap; arms folded; in his pockets; clasped
	// between his knees: more of them in the cold rain; a cup in hand keeps them on the lap), his towel when
	// it's not up (draped over a knee, bunched in his fist, turned his own way), the cut of a woman's hair,
	// the face's own proportions: packed with the prop in r4.w
	let lu = fract( h.z * 5.7 + h.w * 1.3 );
	var lap = select( select( select( 3u, 2u, lu < 0.85 ), 1u, lu < 0.62 ), 0u, lu < 0.42 - 0.17 * rain );
	if ( prop != 0u ) { lap = 0u; }
	let ts = u32( fract( h.x * 9.1 ) * 2.999 );
	let ang = u32( fract( h.w * 11.3 ) * 3.999 );
	let hv = u32( fract( h.y * 13.3 ) * 7.999 );
	let fc = u32( fract( h.x * 17.7 + h.z ) * 7.999 );
	o.r4 = vec4f( lean, roll, nod, f32( prop | ( ts << 4u ) | ( ang << 6u ) | ( lap << 8u ) | ( hv << 10u ) | ( fc << 13u ) ) );
	// ---- end FW1
	return o;
}

struct CwFanLook { c0: vec4f, c1: vec4f, c2: vec4f, c3: vec4f, c4: vec4f, c5: vec4f };

// his colours: skin (and the base roughness), hair (and a number for his stubble), the jacket or
// jersey (and his look's bits), the trousers, the cap, the knit hat
fn cwFanLook( ids: vec3u, h: vec4f, poncho: bool ) -> CwFanLook {
	let look = ids.y;
	let act = ids.z;
	let hat = ( look >> 10u ) & 7u;
	let skinI = ( ids.x >> 16u ) & 7u;
	let hairI = ( ids.x >> 19u ) & 7u;
	let isRays = ( ( act >> 18u ) & 1u ) == 1u;
	let g = fract( h * vec4f( 3.1, 5.7, 7.3, 11.9 ) + h.yzwx );

	// skin: pale to dark; hair: black, browns, blond, red, grey, white
	var SKIN = array<vec3f, 8>( vec3f( 0.62, 0.42, 0.32 ), vec3f( 0.56, 0.36, 0.25 ), vec3f( 0.5, 0.31, 0.2 ), vec3f( 0.42, 0.25, 0.15 ), vec3f( 0.3, 0.17, 0.1 ), vec3f( 0.2, 0.11, 0.06 ), vec3f( 0.12, 0.065, 0.04 ), vec3f( 0.5, 0.34, 0.2 ) );
	var HAIR = array<vec3f, 8>( vec3f( 0.016, 0.012, 0.01 ), vec3f( 0.04, 0.024, 0.014 ), vec3f( 0.1, 0.058, 0.03 ), vec3f( 0.19, 0.12, 0.06 ), vec3f( 0.4, 0.29, 0.14 ), vec3f( 0.28, 0.08, 0.03 ), vec3f( 0.26, 0.25, 0.24 ), vec3f( 0.58, 0.57, 0.55 ) );

	// the jacket or jersey (CP-11; Getty 83893023 on the 27th, 83485455 on the 29th): a sea of red,
	// about 60% (two reds, the odd red jacket with royal-blue shoulders), then the home whites, a quarter
	// in black, navy and charcoal, grey hoodies, a little maroon and brown; the powder-blue throwback a
	// rare sight in 2008, the Rays' blue a handful
	var shirt = mix( vec3f( 0.22, 0.012, 0.016 ), vec3f( 0.36, 0.022, 0.028 ), g.x );
	let u = fract( ( h.x * 0.37 + h.y * 0.63 ) * 13.7 );
	// (the trim: 1 the home whites' pinstripes, 2 royal-blue shoulders)
	var trim = select( 0.0, 2.0, u > 0.58 );
	if ( u > 0.6 ) { shirt = vec3f( 0.62, 0.61, 0.58 ); trim = 1.0; }
	if ( u > 0.66 ) { shirt = vec3f( 0.014, 0.014, 0.016 ); trim = 0.0; }
	if ( u > 0.8 ) { shirt = vec3f( 0.015, 0.022, 0.06 ); }
	if ( u > 0.86 ) { shirt = vec3f( 0.12, 0.12, 0.125 ) * mix( 0.5, 1.5, g.x ); }
	if ( u > 0.94 ) { shirt = vec3f( 0.12, 0.018, 0.025 ); }
	if ( u > 0.975 ) { shirt = mix( vec3f( 0.12, 0.09, 0.05 ), vec3f( 0.05, 0.08, 0.05 ), g.y ); }
	if ( u > 0.995 ) { shirt = vec3f( 0.22, 0.33, 0.48 ); }
	if ( isRays ) { shirt = select( vec3f( 0.015, 0.04, 0.12 ), vec3f( 0.28, 0.45, 0.62 ), g.y > 0.5 ); trim = 0.0; }
	var rough = 0.85;
	// in the rain a good few in ponchos (CP-6; Getty 83457911): most clear plastic (the jacket shows
	// through it: the shaders gloss it over), then yellow, the Phillies' red giveaways, white or a
	// see-through blue, orange
	var pk = 0.0;
	if ( poncho ) {
		let q = fract( h.w * 7.7 + h.x );
		pk = 1.0;
		if ( q > 0.55 ) { shirt = vec3f( 0.62, 0.48, 0.03 ); pk = 2.0; }
		if ( q > 0.7 ) { shirt = vec3f( 0.36, 0.02, 0.03 ); pk = 3.0; }
		if ( q > 0.85 ) { shirt = select( vec3f( 0.58, 0.58, 0.56 ), vec3f( 0.2, 0.32, 0.48 ), g.z > 0.5 ); pk = 4.0; }
		if ( q > 0.95 ) { shirt = vec3f( 0.6, 0.2, 0.02 ); pk = 5.0; }
		trim = select( 0.0, trim, pk < 1.5 );
	}
	let pants = select( select( vec3f( 0.03, 0.045, 0.1 ), vec3f( 0.28, 0.22, 0.15 ), g.y > 0.72 ), vec3f( 0.02 ), g.y > 0.86 );
	var capC = select( select( vec3f( 0.014, 0.02, 0.07 ), vec3f( 0.68 ), g.w > 0.85 ), vec3f( 0.33, 0.014, 0.02 ), g.w < 0.7 );
	if ( hat == 5u ) { capC = vec3f( 0.14, 0.02, 0.03 ); }
	if ( hat == 6u ) { capC = vec3f( 0.012, 0.02, 0.07 ); }
	// knit hats: Phillies red with a white band, or grey, black, cream, navy
	let knit = select( select( select( vec3f( 0.09 ), vec3f( 0.012 ), g.z > 0.5 ), vec3f( 0.5, 0.47, 0.4 ), g.z > 0.8 ), vec3f( 0.36, 0.02, 0.03 ), hat == 3u );

	var o: CwFanLook;
	o.c0 = vec4f( SKIN[ skinI ], rough );
	o.c1 = vec4f( HAIR[ hairI ], g.w );
	o.c2 = vec4f( shirt, f32( look ) );
	o.c3 = vec4f( pants, trim );
	o.c4 = vec4f( capC, pk );
	o.c5 = vec4f( knit, 0.0 );
	return o;
}

@compute @workgroup_size( WG_X, 1, 1 )
fn main( @builtin( global_invocation_id ) gid: vec3u ) {
	let i = gid.x;
	if ( i >= u32( cw.misc.w + 0.5 ) ) { return; }
	let ids = cwIds[ i ].xyz;
	let seat = cwSeats[ i ]; // (FS1: .w which way he faces)
	let h = cwRand4( ids.x & 0xffffu );
	let cur = cwFanPose( ids, h, seat, cw.misc.x, i );
	let prev = cwFanPose( ids, h, seat, cw.misc.x - cw.misc.y, i );
	let b = i * ${ POSE_N * 2 }u;
	cwPoseBuf[ b ] = cur.r0;
	cwPoseBuf[ b + 1u ] = cur.r1;
	cwPoseBuf[ b + 2u ] = cur.r2;
	cwPoseBuf[ b + 3u ] = cur.r3;
	cwPoseBuf[ b + 4u ] = cur.r4;
	cwPoseBuf[ b + 5u ] = prev.r0;
	cwPoseBuf[ b + 6u ] = prev.r1;
	cwPoseBuf[ b + 7u ] = prev.r2;
	cwPoseBuf[ b + 8u ] = prev.r3;
	cwPoseBuf[ b + 9u ] = prev.r4;
	let lk = cwFanLook( ids, h, ( ( u32( cur.r3.w + 0.5 ) >> ${ PONCHO_BIT }u ) & 1u ) == 1u );
	let c = i * 6u;
	cwLookBuf[ c ] = lk.c0;
	cwLookBuf[ c + 1u ] = lk.c1;
	cwLookBuf[ c + 2u ] = lk.c2;
	cwLookBuf[ c + 3u ] = lk.c3;
	cwLookBuf[ c + 4u ] = lk.c4;
	cwLookBuf[ c + 5u ] = lk.c5;
}
`;

// The vertex: where this vertex of fan `fan` is, from the pose the compute pass worked out for him (prev:
// last frame's, for the motion vectors)
// ---- FC4 (C4R-3): an arm's joint (the right's), as it is in the base pose (sitting or standing: st), or
// morphed (raised: aU, at the face: aF), for the arm's normals (cwVertex)
const armJoint = ( name, morph ) => {

	const d = ( arm, base ) => f3( arm[ name ] ? arm[ name ].map( ( v, i ) => v - base[ name ][ i ] ) : [ 0, 0, 0 ] );
	const sit = f3( SIT[ name ] ), stand = f3( STAND[ name ] );
	return morph ? `mix( ${ sit } + ${ d( SIT_UP, SIT ) } * aU + ${ d( SIT_FACE, SIT ) } * aF, ${ stand } + ${ d( STAND_UP, STAND ) } * aU + ${ d( STAND_FACE, STAND ) } * aF, st )` : `mix( ${ sit }, ${ stand }, st )`;

};
const armSeg = ( a, b, morph ) => `( ${ armJoint( b, morph ) } - ${ armJoint( a, morph ) } ) * mx`;
// ---- end FC4

const crowdModule = new ShaderModule( {
	name: 'crowd',
	code: /* wgsl */`
// ---- FW6 (C4W-2): where a knit hat comes down to on the head (d on its unit sphere): two fingers over the
// brows in front (0.3; the eyes 0.1), the ears' tops at the sides, the nape behind (as the Cast's)
fn cwKnitEdge( d: vec3f ) -> f32 {
	let fr = - d.z / max( length( d.xz ), 0.001 );
	return mix( - 0.15, 0.0, smoothstep( - 1.0, 0.0, fr ) ) + 0.39 * smoothstep( 0.0, 0.95, fr );
}
// ---- end FW6
// ---- FC4 (C4R-3): a tube's ring frame on a segment, as fanGeometry's ring() lays it (across, along,
// toward the back)
fn cwRingFrame( d: vec3f ) -> mat3x3f {
	let ax = normalize( d );
	var c = cross( ax, vec3f( 0.0, 0.0, 1.0 ) );
	if ( length( c ) < 0.2 ) { c = cross( ax, vec3f( 0.0, 1.0, 0.0 ) ); }
	let across = normalize( c );
	return mat3x3f( across, ax, normalize( cross( across, ax ) ) );
}
// ---- end FC4

struct CwPose {
	p: vec3f,
	n: vec3f,
	local: vec3f,
};

// ---- FW1 (C2W-6): v turned by the rotation that takes the unit vector a to b (about their cross)
fn cwTurn( v: vec3f, a: vec3f, b: vec3f ) -> vec3f {
	let c = dot( a, b );
	let k = cross( a, b );
	let s = length( k );
	if ( s < 1e-4 ) { return v; }
	let ax = k / s;
	return v * c + cross( ax, v ) * s + ax * dot( ax, v ) * ( 1.0 - c );
}

fn cwVertex( pos: vec3f, nrm: vec3f, stp: vec3f, stn: vec3f, sitUp: vec3f, standUp: vec3f, sitFace: vec3f, standFace: vec3f, info: vec4f, fan: u32, prev: bool, lod: u32, paint: vec3f, fold: vec3f ) -> CwPose {
	let b = fan * ${ POSE_N * 2 }u + select( 0u, ${ POSE_N }u, prev );
	let r3 = cwPoseBuf[ b + 3u ];
	let flags = u32( r3.w + 0.5 );
	var o: CwPose;
	let code = u32( info.x + 0.5 );
	let part = code & 15u;
	let side = f32( code >> 4u ) - 1.0;
	let hood = ( flags & ( 1u << 12u ) ) != 0u;
	// nothing of what he isn't wearing or holding: folded to a point before any of the work (a cap's
	// crown under a hood, where only the bill pokes out; the pom-pom on the knit hats with one)
	var gone = ( ( flags >> part ) & 1u ) == 0u;
	if ( part == 4u && info.y > 1.5 && hood ) { gone = true; }
	if ( part == 3u && info.y > 1.5 && ( flags & ( 1u << 16u ) ) == 0u ) { gone = true; }
	if ( gone ) {
		o.p = vec3f( 0.0 );
		o.n = nrm;
		o.local = vec3f( 0.0 );
		return o;
	}
	let r0 = cwPoseBuf[ b ];
	let r1 = cwPoseBuf[ b + 1u ];
	let r2 = cwPoseBuf[ b + 2u ];
	let r4 = cwPoseBuf[ b + 4u ];
	let st = r0.x;

	// the morph: each arm raised or at the face, standing or sitting
	let isL = side < - 0.5;
	let isR = side > 0.5;
	let aU = select( select( 0.0, r0.z, isR ), r0.y, isL );
	let aF = select( select( 0.0, r1.x, isR ), r0.w, isL );
	var p = mix( pos + sitUp * aU + sitFace * aF, stp + standUp * aU + standFace * aF, st );
	var n = normalize( mix( nrm, stn, st ) );
	// ---- FC4 (C4R-3): an arm raised or brought to the face takes its normals with it, from the ring's frame
	// on the arm down to its frame on the arm as it is. They stayed the arm's at rest: up, its across runs
	// the other way, so half of each sleeve was lit inside out and the raised arms read as square bars
	if ( ( part == 6u || part == 2u ) && aU + aF > 0.001 && lod <= 1u ) {
		let mx = vec3f( side, 1.0, 1.0 );
		var fa = cwRingFrame( ${ armSeg( 'shoulder', 'elbow', false ) } );
		var fb = cwRingFrame( ${ armSeg( 'shoulder', 'elbow', true ) } );
		if ( part == 2u ) {
			fa = cwRingFrame( ${ armSeg( 'wrist', 'hand', false ) } );
			fb = cwRingFrame( ${ armSeg( 'wrist', 'hand', true ) } );
		} else if ( info.y > 0.99 ) {
			fa = cwRingFrame( ${ armSeg( 'elbow', 'wrist', false ) } );
			fb = cwRingFrame( ${ armSeg( 'elbow', 'wrist', true ) } );
		}
		n = normalize( fb[ 0 ] * dot( n, fa[ 0 ] ) + fb[ 1 ] * dot( n, fa[ 1 ] ) + fb[ 2 ] * dot( n, fa[ 2 ] ) );
	}
	// ---- end FC4

	// ---- FW1 (C2W-6): the hands sitting at rest: the forearm turned about the elbow, to fold the arms (the
	// right under, the left over), into the jacket's pockets (the hand in it), or clasped between the knees
	let vid = u32( r4.w + 0.5 );
	let lapP = ( vid >> 8u ) & 3u;
	let rest = ( 1.0 - st ) * ( 1.0 - aU ) * ( 1.0 - aF );
	if ( lapP != 0u && rest > 0.001 && ( isL || isR ) && ( part == 2u || ( part == 6u && info.y > 0.99 ) ) ) {
		let el = vec3f( ${ SIT.elbow[ 0 ].toFixed( 3 ) } * side, ${ SIT.elbow[ 1 ].toFixed( 3 ) }, ${ SIT.elbow[ 2 ].toFixed( 3 ) } );
		let h0 = vec3f( ${ SIT.hand[ 0 ].toFixed( 3 ) } * side, ${ SIT.hand[ 1 ].toFixed( 3 ) }, ${ SIT.hand[ 2 ].toFixed( 3 ) } );
		var h1 = vec3f( 0.025 * side, 0.56, - 0.25 );
		if ( lapP == 1u ) { h1 = select( vec3f( - 0.15, 0.83, - 0.035 ), vec3f( 0.15, 0.87, - 0.06 ), isL ); }
		if ( lapP == 2u ) { h1 = vec3f( 0.125 * side, 0.67, - 0.05 ); }
		let a = normalize( h0 - el );
		let b = normalize( h1 - el );
		var q = el + cwTurn( p - el, a, b );
		// (the hand in the pocket: in it, the cuff at the pocket; FC4, C4R-3: all of it, not a nub out of the
		// sleeve)
		if ( lapP == 2u && part == 2u ) { let wr = el + cwTurn( vec3f( ${ SIT.wrist[ 0 ].toFixed( 3 ) } * side, ${ SIT.wrist[ 1 ].toFixed( 3 ) }, ${ SIT.wrist[ 2 ].toFixed( 3 ) } ) - el, a, b ); q = wr + ( q - wr ) * select( 0.15, 0.0, lod == 0u ); }
		p = mix( p, q, rest );
		n = normalize( mix( n, cwTurn( n, a, b ), rest ) );
	}
	if ( part == 5u ) {
		// the towel when it's not up: turned its own way about the hand, or bunched up in the fist
		let hand0 = mix( ${ f3( SIT.hand ) }, ${ f3( STAND.hand ) }, st );
		var q = p - hand0;
		if ( ( ( vid >> 4u ) & 3u ) == 1u ) { q = q * vec3f( 0.42, 0.6, 0.38 ) + vec3f( 0.0, 0.025, 0.0 ); }
		let ta = ( f32( ( vid >> 6u ) & 3u ) - 1.5 ) * 0.32;
		q = vec3f( q.x * cos( ta ) + q.z * sin( ta ), q.y, - q.x * sin( ta ) + q.z * cos( ta ) );
		p = hand0 + q;
	}
	// ---- end FW1
	// what's in his left hand, held upright (CP-12): a cup, a phone, a camera (the box's corners in t a b)
	if ( part == 8u ) {
		let id = u32( r4.w + 0.5 ) & 15u;
		var sz = vec3f( 0.08, 0.13, 0.08 );
		if ( id == 3u ) { sz = vec3f( 0.065, 0.12, 0.014 ); }
		if ( id == 4u ) { sz = vec3f( 0.11, 0.07, 0.06 ); }
		// ---- FC4 (C4R-3): close up the cup's eight sides squared off for a phone or a camera (its points
		// to its quarter's corner), and the cups a little over a hand high: a 16 oz clear plastic cup
		// (the module's shared by the levels: the level's its argument)
		var q = info.zw;
		if ( lod == 0u ) {
			if ( id == 3u || id == 4u ) { q = sign( q ) * 0.5; n = normalize( vec3f( q.x, n.y * 2.0, q.y ) ); }
			else { sz = vec3f( 0.088, 0.14, 0.088 ); }
		}
		// ---- end FC4
		p += vec3f( q.x * sz.x, ( info.y + 0.5 ) * sz.y - 0.03, q.y * sz.z );
	}

	// the towel: twirled round over the head, the loose end trailing the turn and fluttering, the cloth
	// sagging between
	if ( part == 5u ) {
		let hand = mix( ${ f3( SIT_UP.hand ) }, ${ f3( STAND_UP.hand ) }, st );
		let u = info.z;
		let v = info.w;
		let th = r1.z - 1.5 * v;
		// ---- FP2 (C2B-16): the turn tipped toward the field (down in front, up behind) and the cloth's
		// width half up and down, as a whirled towel hangs and flaps: flat and level, it was edge-on to
		// the center field camera, a white card's sliver over each head
		let rad = vec3f( cos( th ), 0.4 * sin( th ), sin( th ) );
		let tan = vec3f( - sin( th ), 0.4 * cos( th ), cos( th ) );
		let across = ( 1.0 - 2.0 * u ) * ( 0.055 + 0.055 * v );
		let wv = normalize( tan * 0.8 + vec3f( 0.0, 0.6, 0.0 ) );
		// (crumpled across its width as it flaps: a flat sheet read as paper)
		let crumple = normalize( cross( rad, wv ) ) * 0.04 * v * sin( u * 6.28 + v * 3.0 + r1.z * 1.7 );
		let lift = 0.03 + 0.07 * v + 0.05 * v * sin( r1.z * 2.0 + v * 2.5 + u * 1.5 ) - 0.06 * v * ( 1.0 - v ) - 0.03 * abs( 1.0 - 2.0 * u ) * v;
		let spin = hand + rad * ( 0.28 * v ) + wv * across + crumple + vec3f( r2.z, 0.0, r2.w ) * 0.15 * v + vec3f( 0.0, lift, 0.0 );
		p = mix( p, spin, r1.y );
		n = normalize( mix( n, normalize( vec3f( 0.0, 1.0, 0.0 ) + cross( rad, wv ) * 0.35 ), r1.y ) );
		// ---- end FP2
	}

	// the collar: a hoodie's hood lying down his back (CP-2: no bare yoke), a scarf wound round it
	if ( part == 0u && info.y > 1.2 ) {
		let back = smoothstep( 0.0, 0.06, info.w );
		if ( ( flags & ( 1u << 17u ) ) != 0u ) { let roll = back * smoothstep( 1.2, 1.6, info.y ); p.z += 0.035 * roll; p.y -= 0.012 * roll; p.x *= 1.0 + 0.12 * roll; }
		if ( ( flags & ( 1u << 18u ) ) != 0u ) { p.x *= 1.3; p.z = mix( ${ SIT.neck[ 2 ].toFixed( 3 ) }, ${ STAND.neck[ 2 ].toFixed( 3 ) }, st ) + ( p.z - mix( ${ SIT.neck[ 2 ].toFixed( 3 ) }, ${ STAND.neck[ 2 ].toFixed( 3 ) }, st ) ) * 1.3; }
	}

	// the head: a hood or a poncho's hood round it, a knit hat, a cap's crown (further off, shaped from
	// the head), turned to talk and nodding
	let headC = mix( ${ f3( SIT.head ) }, ${ f3( STAND.head ) }, st );
	var local = info.zyw;
	if ( part == 3u || part == 4u || part == 10u ) {
		local = p - headC;
		// ---- FF1: the MakeHuman head (close and near): its ears folded flat under a hood, a knit hat or long
		// hair; the paint, and what's shaped by it (a hood's opening, a knit's edge, a cap's band), in the
		// paint's own frame (paint: where the vertex lies on the egg the paint was drawn for)
		let mh = part == 3u && any( paint != vec3f( 0.0 ) );
		if ( mh && ( hood || ( flags & ( 1u << 13u ) ) != 0u || ( flags & ( 1u << 10u ) ) != 0u ) ) {
			p += fold;
			local = p - headC;
		}
		let dl = select( local, paint * ${ f3( HEAD_R ) }, mh );
		// ---- end FF1
		if ( part == 3u && info.y < 1.5 ) {
			let d = dl / ${ f3( HEAD_R ) };
			if ( hood ) {
				// loose over the head, its peak out over the brow, falling onto the neck behind (CP-9); the
				// face's opening left where it is, so the hood's rim stands proud of the face
				let face = smoothstep( - 0.55, - 0.85, d.z ) * smoothstep( 0.75, 0.45, length( d.xy - vec2f( 0.0, - 0.05 ) ) );
				var q = local * mix( 1.13, 1.0, face );
				q += vec3f( 0.0, 0.01, - 0.024 ) * smoothstep( - 0.1, - 0.6, d.z ) * smoothstep( 0.35, 0.8, d.y ) * ( 1.0 - face );
				q += vec3f( 0.0, - 0.03, 0.03 ) * smoothstep( 0.1, 0.7, d.z ) * smoothstep( 0.1, - 0.6, d.y );
				p = headC + q;
			} else if ( ( flags & ( 1u << 13u ) ) != 0u ) {
				// a knit hat: a rounded dome over the hair (CP-7: it was a gnome's cone)
				// ---- FW6 (C4W-2): sat on the head from its edge (cwKnitEdge: over the brows in front, the
				// ears' tops at the sides, the nape behind), the cuff a step out and the crown a finger out
				// hugging the skull, a little higher and slouched back (it came down to the eyes: a can)
				let kr = d.y - cwKnitEdge( d );
				let ko = smoothstep( - 0.035, 0.005, kr ) * ( 0.009 + 0.005 * smoothstep( 0.15, 0.12, kr ) );
				p = headC + local + normalize( local ) * ko + vec3f( 0.0, 0.007 * smoothstep( 0.55, 1.0, d.y ), 0.009 * smoothstep( 0.45, 0.95, d.y ) * smoothstep( - 0.5, 0.4, d.z ) );
				// ---- end FW6
			} else if ( ( flags & 16u ) != 0u && lod > 0u ) {
				// a cap, where it hasn't its own crown: the head fuller above the band and taller
				let front = - d.z / max( length( d.xz ), 0.001 );
				let k = smoothstep( 0.06 + 0.225 * front, 0.26 + 0.225 * front, d.y );
				p = headC + local * ( 1.0 + 0.075 * k ) + vec3f( 0.0, 0.014 * smoothstep( 0.55, 1.0, d.y ), 0.0 );
			}
		}
		// a ponytail: the long hair narrowed
		if ( part == 10u && ( flags & ( 1u << 14u ) ) != 0u ) { p.x = headC.x + ( p.x - headC.x ) * 0.32; p.y -= 0.03; p.z = max( p.z, headC.z + 0.03 ); }
		// ---- FW1 (C2W-6): long hair to her own length (the chin to below the shoulders); each face its own
		// width at the jaw and its own length (neighbours had the same face)
		let hv = ( u32( r4.w + 0.5 ) >> 10u ) & 7u;
		let fc = f32( ( u32( r4.w + 0.5 ) >> 13u ) & 7u ) / 7.0;
		if ( part == 10u ) { p.y -= ( f32( hv ) / 7.0 - 0.35 ) * 0.13 * info.w; p.x = headC.x + ( p.x - headC.x ) * ( 0.96 + 0.1 * fract( f32( hv ) * 0.37 ) ); }
		if ( part == 3u && info.y < 1.5 && ! mh ) { // (FF1: the MakeHuman head has its own: the blend shapes)
			let dl = ( p - headC ) / ${ f3( HEAD_R ) };
			let low = smoothstep( 0.1, - 0.6, dl.y );
			p = vec3f( headC.x + ( p.x - headC.x ) * mix( 1.0, 0.92 + 0.12 * fc, low ), headC.y + ( p.y - headC.y ) * ( 0.97 + 0.06 * fract( fc * 3.7 ) ), p.z );
		}
		// ---- end FW1
		let piv = mix( ${ f3( SIT.neck ) }, ${ f3( STAND.neck ) }, st );
		// a kid's head is big for his body (a nine-year-old's is ~90% of a man's: CP-17)
		if ( r3.y < 0.8 ) { p = piv + ( p - piv ) * ( 0.92 / r3.y ); }
		let cp = cos( r4.z );
		let sp = sin( r4.z );
		// (---- FS1, C4S-3: from the middle level in, a third of the turn is the shoulders': below)
		let hy = r1.w * select( 1.0, 0.67, lod <= 2u );
		let cy = cos( hy );
		let sy = sin( hy );
		var q = p - piv;
		q = vec3f( q.x, q.y * cp + q.z * sp, q.z * cp - q.y * sp );
		n = vec3f( n.x, n.y * cp + n.z * sp, n.z * cp - n.y * sp );
		p = piv + vec3f( q.x * cy + q.z * sy, q.y, - q.x * sy + q.z * cy );
		n = vec3f( n.x * cy + n.z * sy, n.y, - n.x * sy + n.z * cy );
		local = dl; // (FF1: the paint's)
	}

	// his build (broad, a belly), a kid's size (still sat on the seat, feet off the tread)
	if ( part != 3u && part != 4u && part != 10u ) {
		p.x *= r3.x;
		if ( part == 0u && info.w < 0.0 ) { p.z += info.w * ( r3.x - 1.0 ) * 1.4 * ( 1.0 - smoothstep( 0.6, 1.0, info.y ) ); }
	}

	// how he sits (CP-10): leaning forward or back and a little to the side, bending at the waist, the
	// hands left on the lap (everything but the legs, more the higher it is)
	if ( part != 1u ) {
		let pv = vec3f( 0.0, mix( 0.47, 0.9, st ), mix( 0.1, 0.02, st ) );
		let w = smoothstep( pv.y + 0.1, pv.y + 0.55, p.y );
		let ca = cos( r4.x * w );
		let sa = sin( r4.x * w );
		let cr = cos( r4.y * w );
		let sr = sin( r4.y * w );
		var q = p - pv;
		q = vec3f( q.x, q.y * ca + q.z * sa, q.z * ca - q.y * sa );
		q = vec3f( q.x * cr - q.y * sr, q.x * sr + q.y * cr, q.z );
		p = pv + q;
		n = vec3f( n.x, n.y * ca + n.z * sa, n.z * ca - n.y * sa );
		n = vec3f( n.x * cr - n.y * sr, n.x * sr + n.y * cr, n.z );
		// ---- FS1 (C4S-3): a third of his head's turn in his shoulders, from the waist up (the middle levels
		// and in: further off it doesn't show)
		if ( lod <= 2u && abs( r1.w ) > 0.01 ) {
			let tw3 = r1.w * 0.33 * w;
			let ct = cos( tw3 );
			let stw = sin( tw3 );
			let qt = p - pv;
			p = pv + vec3f( qt.x * ct + qt.z * stw, qt.y, - qt.x * stw + qt.z * ct );
			n = vec3f( n.x * ct + n.z * stw, n.y, - n.x * stw + n.z * ct );
		}
		// ---- end FS1
	}
	p = p * r3.y;
	p.y += ( 1.0 - r3.y ) * 0.47 * ( 1.0 - st );
	// ---- FW1 (C2W-3): his back against the seat's back, not through it. The lofted trunk is deep and he
	// leans back his own way, so from behind every navy seat back had a patch of his jacket in it; up to
	// the seat back's top his jacket presses flat against its front face (Stands.js SEAT_BACK), above it
	// it's free (the shoulders over the top of the seat, as in the photos)
	{
		let yb = clamp( p.y, ${ ( SEAT_BACK.y0 - 0.06 ).toFixed( 3 ) }, ${ SEAT_BACK.y1.toFixed( 3 ) } );
		let zb = ${ ( SEAT_BACK.z0 - 0.012 ).toFixed( 3 ) } + ( yb - ${ SEAT_BACK.y0.toFixed( 3 ) } ) * ${ Math.tan( SEAT_BACK.lean ).toFixed( 4 ) };
		p.z = mix( min( p.z, zb ), p.z, smoothstep( ${ SEAT_BACK.y1.toFixed( 3 ) }, ${ ( SEAT_BACK.y1 + 0.08 ).toFixed( 3 ) }, p.y ) );
	}
	// ---- end FW1

	// up and down with the jumping, a little sway
	p.y += r2.x;
	p.x += r2.y * ( p.y - 0.45 );

	o.p = p;
	o.n = n;
	o.local = local;
	return o;
}
`,
} );

// ---- FP2 (CP-12): the seated crowd's signs, by night (the boards behind home's, home/Signs.js: twelve
// each; a fan's sign picks one by its number)
const SIGNS29 = ["28 YEARS... WHAT'S ANOTHER DAY?", 'IT ENDS TONIGHT', 'PHABULOUS PHILLIES PHINALE', 'RAYS RAYS GO AWAY', 'PHINALLY', 'WE BELIEVE', 'RED OCTOBER', 'LIGHTS OUT LIDGE', 'HARRY, CALL IT!', 'PHILS IN PHIVE', 'SUSPENDED... NOT DEFEATED', 'FOX 9 MORE OUTS'];
const SIGNS27 = ["RAIN? WE'RE FROM PHILLY", 'PHILS IN PHIVE', 'PHINALLY', 'WE BELIEVE', 'RED OCTOBER', 'HI MOM IN BOCA!', "RAIN? WE'RE FROM PHILLY", 'PHILS IN PHIVE', 'WE BELIEVE', 'RED OCTOBER', 'PHINALLY', 'RAYS RAYS GO AWAY'];
const signCells = ( names ) => names.map( ( n ) => SIGN[ n ] ?? 0 ).join( 'u, ' ) + 'u';

function crowdMaterial( lod, poseBuf, lookBuf, idsBuf ) {

	const call = ( prev ) => `cwVertex( pos0, nrm0, stp0, nrm0s, v.aSitUp, v.aStandUp, v.aSitFace, v.aStandFace, v.aInfo, fan, ${ prev }, ${ lod }u, fhPaint, fhFold )`;
	const mat = standard( {
		// (the near ones are all 'crowd-near' to the rain: Night.js's FABRIC)
		name: 'crowd-' + [ 'near', 'near', 'mid', 'far', 'far' ][ lod ], roughness: 0.8, side: 'double', // (SP2: the distant one is 'far' too)
		modules: [ crowdModule, filmModule, fanHeadModule ],
		defines: { CROWD_LOD: lod },
		storage: { cwPoseBuf: poseBuf, cwLookBuf: lookBuf, cwIds: idsBuf, fhRec: { storage: fanHeadBuffer(), access: 'read' } }, // (FF1: the heads)
		// ---- FW1 (CP-12): the Cast's atlas, for the names and numbers on the backs; (FP2) the signs' boards
		textures: { cwAtlas: () => castPool()?.atlas || BLANK(), cwSigns: () => signAtlas() },
		uniforms: { cwNight: [ 'f32', 29 ], cwHome: [ 'vec4f', new Vector4( 0, 0, 0, 0 ) ] },
		attributes: { aStand: 'vec3f', aStandN: 'vec3f', aSitUp: 'vec3f', aStandUp: 'vec3f', aSitFace: 'vec3f', aStandFace: 'vec3f', aInfo: 'vec4f' },
		varyings: { vFan: 'u32', vLocal: 'vec3f' }, // (---- SP3: the part in vFan's low 5 bits, one varying fewer)
		vertex: /* wgsl */`
	// which fan: the chunk's first (Crowd.addChunk) and his seat in it
	let fan = u32( draw.params.y + 0.5 ) + v.instance;
	// ---- FF1 (step 10): close up and near, the MakeHuman head's vertices moved by his face's weights (his
	// ids' w, from who he is and his seed: Crowd._seat), once for this frame's pose and last frame's
	var pos0 = v.position;
	var stp0 = v.aStand;
	var nrm0 = v.normal;
	var nrm0s = v.aStandN;
	var fhPaint = vec3f( 0.0 );
	var fhFold = vec3f( 0.0 );
#if CROWD_LOD <= 1
	let fhi = u32( v.aInfo.z + 0.5 );
	if ( ( u32( v.aInfo.x + 0.5 ) & 15u ) == 3u && v.aInfo.y < 1.5 && fhi > 0u ) {
		let fc = fhUnpack( cwIds[ fan ].w );
		// ---- FF2: his expression (the compute pass's: the mouth, the smile, the blink); close up his lids'
		// own rest, a little down (more on the old), and the blink (near, at FOX's 30-60 px, the mouth and the
		// smile only: the lids are a pixel)
		let eq = u32( cwPoseBuf[ fan * ${ POSE_N * 2 }u + 3u ].z + 0.5 );
		var ex = vec3f( f32( eq & 63u ) / 63.0, f32( ( eq >> 6u ) & 15u ) / 15.0, 0.0 );
		var rest = 0.0;
#if CROWD_LOD == 0
		let fid = cwIds[ fan ];
		let lidRest = 0.1 + 0.22 * fract( f32( fid.x & 0xffffu ) * 0.618034 ) + select( 0.0, 0.12, ( ( fid.y >> 21u ) & 3u ) == 1u );
		// (---- FF3: a fan with nothing on his face but the lids' rest takes it from the first record, without
		// the expressions' two: FF2 read them for every close fan every frame, the lids' rest keeping ex on)
		let blinkW = f32( ( eq >> 10u ) & 15u ) / 15.0;
		if ( ex.x > 0.0 || ex.y > 0.0 || blinkW > 0.0 ) { ex.z = max( blinkW, lidRest * ( 1.0 - 0.6 * ex.y ) ); }
		else { rest = lidRest; }
#endif
		let fh = fhBlend( fhi - 1u, fc[ 0 ], fc[ 1 ], ex, rest );
		// ---- end FF2
		pos0 += fh.dp;
		stp0 += fh.dp;
		nrm0 = normalize( nrm0 + fh.dn );
		nrm0s = nrm0;
		fhPaint = fh.d;
		fhFold = fh.fold;
	}
#endif
	// ---- end FF1
	let cur = ${ call( 'false' ) };
#if CROWD_LOD <= 1
	let prev = ${ call( 'true' ) };
	v.prevWorldPos = select( ( v.prevModel * vec4f( prev.p, 1.0 ) ).xyz, ( v.prevModel * vec4f( 0.0, 0.0, 0.0, 1.0 ) ).xyz, all( cur.p == vec3f( 0.0 ) ) );
#else
	v.prevWorldPos = ( v.prevModel * vec4f( cur.p, 1.0 ) ).xyz;
#endif
	v.useWorld = true;
	v.worldPos = ( v.model * vec4f( cur.p, 1.0 ) ).xyz;
	v.worldNormal = normalize( ( v.model * vec4f( cur.n, 0.0 ) ).xyz );
	let pt = u32( v.aInfo.x + 0.5 ) & 15u;
	// ---- SP3 (speed): which fan, and the part (and 16: its marked piece) in the low 5 bits: on a tile GPU
	// every varying is written out per vertex and read back, and the fans are millions of vertices
	o.vFan = ( fan << 5u ) | pt | select( 0u, 16u, v.aInfo.y > select( 1.5, 2.5, pt == 1u ) );
	// ---- end SP3
	o.vLocal = cur.local;
`,
		surface: /* wgsl */`
	// the part (and 16: its marked piece, the shoes, the crown, the pom-pom)
	let part = in.vs.vFan & 15u;
	let piece = ( in.vs.vFan & 16u ) != 0u;
	let fan = in.vs.vFan >> 5u; // (SP3: packed)
	let L = in.vs.vLocal;
	// his colours and his pose's flags (the compute pass)
	let k = fan * 6u;
	let c0 = cwLookBuf[ k ];
	let c1 = cwLookBuf[ k + 1u ];
	let c2 = cwLookBuf[ k + 2u ];
	let c3 = cwLookBuf[ k + 3u ];
	let c4 = cwLookBuf[ k + 4u ];
	let r3 = cwPoseBuf[ fan * ${ POSE_N * 2 }u + 3u ];
	let flags = u32( r3.w + 0.5 );
	let poncho = ( flags & ( 1u << ${ PONCHO_BIT }u ) ) != 0u;
	let hood = ( flags & ( 1u << 12u ) ) != 0u;
	let clear = poncho && c4.w < 1.5;
	let trim = u32( c3.w + 0.5 );
	let look = u32( c2.w + 0.5 );
	let outfit = look & 31u;
	// (---- FS1, C4S-5: bareheaded for the song, the pose's flag 19: no cap or knit hat painted on)
	let hat = select( ( look >> 10u ) & 7u, 0u, ( flags & ( 1u << 19u ) ) != 0u );
	let hairStyle = ( look >> 13u ) & 3u;
	let facial = ( look >> 15u ) & 3u;
	let glasses = ( ( look >> 17u ) & 1u ) == 1u;
	let scarf = ( flags & ( 1u << 18u ) ) != 0u;
	let gloves = ( ( look >> 19u ) & 1u ) == 1u;
	let age = ( look >> 21u ) & 3u;
	let female = ( ( look >> 23u ) & 1u ) == 1u;
	let capped = hat == 1u || hat == 2u || hat == 5u || hat == 6u;
	let nk = smoothstep( 0.15, 0.7, frame.night );
	let skin = c0.rgb;
	let hairC = c1.rgb * mix( 1.0, 0.7, frame.wet );
	let shirt = c2.rgb;
	let capC = c4.rgb;
	let seed = fract( c1.w * 7.31 + c0.r * 3.1 );
	// a scarf: Phillies red and white in bars across it, or plain red, or grey
	let scarfEnd = part == 0u && L.y < 1.1;
	let bars = select( fract( atan2( L.x, L.z + 0.001 ) * 1.6 ), fract( L.y * 7.0 ), scarfEnd ) < 0.35;
	let scarfC = select( select( vec3f( 0.32, 0.02, 0.03 ), vec3f( 0.16 ), seed > 0.8 ), select( vec3f( 0.33, 0.02, 0.03 ), vec3f( 0.68, 0.67, 0.64 ), bars ), seed < 0.45 );
	var rough = c0.w;

	var c = shirt;
	var e = vec3f( 0.0 );
	if ( part == 0u ) {
		// the trunk (L: across, t from the hips to the collar, depth toward the back)
		let frontS = L.z < 0.0;
		// a jacket's zip, a jacket's or sweatshirt's collar band a shade darker, the home whites'
		// pinstripes and piping, a red jacket's royal-blue shoulders
		if ( outfit == 1u && frontS && abs( L.x ) < 0.005 && L.y > 0.0 ) { c = mix( c, vec3f( 0.25 ), 0.6 ); rough = 0.4; }
		if ( L.y > 1.3 ) { c *= 0.85; }
		if ( trim == 1u ) {
			let pw = fwidth( L.x ) + fwidth( L.z );
			let pin = smoothstep( 0.06 + pw * 20.0, 0.0, abs( fract( ( L.x + L.z * 0.3 ) / 0.038 ) - 0.5 ) - 0.44 ) * ( 1.0 - smoothstep( 0.003, 0.008, pw ) );
			c = mix( c, vec3f( 0.36, 0.05, 0.06 ), pin * 0.45 );
			if ( frontS && abs( L.x ) < 0.01 && L.y < 1.0 ) { c = vec3f( 0.3, 0.02, 0.03 ); }
			if ( L.y > 1.3 ) { c = vec3f( 0.3, 0.02, 0.03 ); }
		}
		if ( trim == 2u && L.y > 0.82 && L.y < 1.3 ) { c = vec3f( 0.03, 0.07, 0.3 ); }
#if CROWD_LOD <= 1
		// ---- FW1 (CP-12): a name and number on the back (the Cast's atlas): the home whites, and the red
		// name-and-number tees; UTLEY 26 most of all, then HOWARD, ROLLINS, HAMELS (the 2008 photos' backs)
		let tee = outfit == 2u && seed > 0.7 && shirt.r > 0.2 && shirt.g < 0.1;
		if ( ( trim == 1u || tee ) && L.z > 0.05 && L.y > 0.36 && L.y < 0.98 ) {
			let uv = vec2f( 0.5 + L.x / 0.3, ( 0.98 - L.y ) / 0.6 );
			if ( all( uv > vec2f( 0.0 ) ) && all( uv < vec2f( 1.0 ) ) ) {
				let pu = fract( seed * 13.7 + c1.w * 3.1 );
				var cell = 13u;
				if ( pu < 0.9 ) { cell = 7u; }
				if ( pu < 0.84 ) { cell = 8u; }
				if ( pu < 0.78 ) { cell = 6u; }
				if ( pu < 0.71 ) { cell = 5u; }
				if ( pu < 0.63 ) { cell = 4u; }
				if ( pu < 0.5 ) { cell = 3u; }
				if ( pu < 0.34 ) { cell = 2u; }
				if ( pu < 0.2 ) { cell = 1u; }
				let a = textureSample( cwAtlas, smpAnisoClamp, ( vec2f( f32( cell % 8u ), f32( cell / 8u ) ) + uv ) / vec2f( 8.0, 10.0 ) ).r;
				c = mix( c, select( vec3f( 0.72, 0.71, 0.68 ), vec3f( 0.32, 0.018, 0.024 ), trim == 1u ), a );
			}
		}
#endif
#if CROWD_LOD <= 1
		// ---- FP2 (CP-12): a credential on its lanyard for a few (the clubs' and the press's passes, a
		// season ticket holder's: Getty 112873396, 83433888): the strap down from the collar either side to
		// a white card on the chest, its band at the top
		let lny = fract( seed * 23.17 + c1.w * 1.7 ) < 0.045 && age != 2u && ! poncho;
		// (the card at mid-chest, over the arms folded or the hands in the lap)
		if ( lny && frontS && L.y > 0.6 ) {
			let sx = mix( 0.016, 0.07, smoothstep( 0.84, 1.4, L.y ) );
			if ( abs( abs( L.x ) - sx ) < 0.009 && L.y > 0.84 && L.y < 1.5 ) { c = select( vec3f( 0.02 ), vec3f( 0.32, 0.02, 0.03 ), seed > 0.5 ); rough = 0.6; }
			if ( abs( L.x ) < 0.05 && L.y > 0.66 && L.y < 0.85 ) { c = select( vec3f( 0.8, 0.79, 0.76 ), vec3f( 0.04, 0.06, 0.22 ), L.y > 0.8 ); rough = 0.3; }
		}
#endif
		// a hoodie's drawstrings, its hood up
		if ( outfit == 0u && hood && frontS && abs( abs( L.x ) - 0.035 ) < 0.006 && L.y > 0.62 && L.y < 1.2 ) { c = vec3f( 0.6, 0.59, 0.56 ); }
		// a scarf: round the collar, its two ends hanging down the chest
		if ( scarf && ( L.y > 1.15 || ( frontS && abs( L.x - select( 0.045, - 0.045, seed > 0.6 ) ) < 0.03 && L.y > 0.6 ) ) ) { c = scarfC; rough = 0.95; }
	}
	if ( part == 6u && trim == 1u && L.y > 0.45 ) {
		// under the jersey's short sleeves, a hoodie or a thermal
		c = select( select( vec3f( 0.014 ), vec3f( 0.12 ), seed > 0.6 ), vec3f( 0.3, 0.02, 0.03 ), seed < 0.4 );
	}
	if ( poncho && ( part == 0u || part == 6u ) ) {
		// a poncho over it all: clear plastic over the jacket (it shows through, glossy and crumpled, beaded
		// with the rain), or a coloured one's opaque plastic
		let crinkle = sin( dot( L, vec3f( 61.0, 23.0, 47.0 ) ) + 2.0 * sin( dot( L, vec3f( 13.0, 41.0, 29.0 ) ) ) );
		// ---- FW4 (C3W-4): close up the film crumpled (Cast.js filmCrumple: facets and creases, the normal
		// tilted with them) and the clear ones a silvery haze over the jacket, whiter in the creases and seen
		// edge on (Getty 83457911, 83893023). It was a smooth glossy coat straight on the jacket: in the
		// rain at arm's length a red jacket glittering with points, the critic's sequinned plastic
		var cr = vec4f( 0.0 );
#if CROWD_LOD <= 1
		// (the trunk's and the sleeves' L.y runs 0..2 from the hips to the collar: about 0.3 m to its unit)
		let Lm = vec3f( L.x, L.y * 0.3, L.z );
		cr = filmCrumple( Lm, length( fwidth( Lm ) ) );
		s.normal = filmTilt( s.normal, cr.xyz );
#endif
		let edge = pow( 1.0 - abs( dot( normalize( s.normal ), normalize( in.V ) ) ), 2.0 );
		if ( clear ) { c = mix( c * 0.72, vec3f( 0.44, 0.46, 0.5 ), 0.2 + 0.05 * cr.w + 0.3 * edge + 0.05 * crinkle ); rough = 0.2 + 0.06 * crinkle; }
		else { c *= ( 0.92 + 0.08 * crinkle ) * ( 0.96 + 0.06 * cr.w ); rough = 0.26; }
		// ---- end FW4
	}
	if ( part == 1u ) {
		c = c3.rgb; rough = 0.9;
		// the shoes: white sneakers, black, brown boots
		if ( piece ) { c = select( select( vec3f( 0.6, 0.59, 0.56 ), vec3f( 0.016 ), seed > 0.45 ), vec3f( 0.12, 0.06, 0.025 ), seed > 0.8 ); rough = 0.6; }
	}
	// the hands: gloves on a cold night (black, navy, the odd red), or bare and red with the cold
	if ( part == 2u ) { c = select( skin * vec3f( 1.06, 0.92, 0.9 ), select( select( vec3f( 0.014 ), vec3f( 0.012, 0.016, 0.05 ), seed > 0.6 ), vec3f( 0.3, 0.02, 0.03 ), seed > 0.88 ), gloves ); rough = select( 0.6, 0.85, gloves ); }
	// the neck: the collar's band low, then skin (or the scarf)
	if ( part == 7u ) { c = select( select( skin, shirt * 0.85, L.y < 0.38 ), scarfC, scarf && L.y < 0.62 ); rough = select( 0.6, 0.9, L.y < 0.38 || scarf ); }
	if ( part == 3u ) {
		// the head in its own frame, the face toward -z
		let d = L / ${ f3( HEAD_R ) };
		let ax = abs( d.x );
		c = skin;
		rough = 0.55;
#if CROWD_LOD < 3
		// ---- FF1: the MakeHuman head's eyeballs (the paint's d.z marks them), white under the lids
		let eyeball = d.z < - 2.0;
		if ( eyeball ) { c = vec3f( 0.56, 0.54, 0.51 ); rough = 0.12; }
		// ---- end FF1
		// how big a pixel is on the face: the features fade out when they would only flicker
		let fw = fwidth( d.x ) + fwidth( d.y );
		let near = 1.0 - smoothstep( 0.15, 0.4, fw );
		let front = smoothstep( 0.1, - 0.25, d.z );
		// the cold: red cheeks, nose and ears
		c = mix( c, c * vec3f( 1.3, 0.78, 0.76 ), 0.4 * smoothstep( 0.3, 0.05, length( vec2f( ax - 0.46, d.y + 0.16 ) ) ) * front );
		c = mix( c, c * vec3f( 1.3, 0.8, 0.78 ), 0.35 * smoothstep( 0.14, 0.02, length( vec2f( d.x, d.y + 0.12 ) ) ) * front );
		// the eyes: sockets in shadow, the whites and the irises up close; the brows
		let ey = vec2f( ax - 0.34, d.y - 0.1 );
		c *= mix( 1.0, 0.7, smoothstep( 0.2, 0.08, length( ey * vec2f( 1.0, 1.5 ) ) ) * front );
		// ---- FF1: on an eyeball the iris round the pupil (a brown, darker for a dark skin; a hazel or blue for
		// some fair ones, by the seed)
		if ( eyeball ) {
			let irisC = select( vec3f( 0.09, 0.05, 0.025 ), select( vec3f( 0.16, 0.12, 0.05 ), vec3f( 0.12, 0.17, 0.22 ), fract( seed * 53.1 ) < 0.5 ), skin.r > 0.55 && fract( seed * 19.3 ) < 0.45 );
			c = mix( c, irisC, smoothstep( 0.08, 0.065, length( ey ) ) );
		}
		// ---- end FF1
		// (---- FF2: close up the white and the pupil on the eyeball alone: the lids are skin, and they close
		// over it in a blink; painted on the lids too, the eyes stared, and stayed open through a blink)
		var onEye = 1.0;
#if CROWD_LOD == 0
		onEye = select( 0.0, 1.0, eyeball );
		c *= mix( 1.0, 0.8, smoothstep( 0.16, 0.1, length( ey * vec2f( 1.0, 1.6 ) ) ) * ( 1.0 - onEye ) * front );
#endif
		let white = smoothstep( 0.1, 0.075, length( ey * vec2f( 1.0, 1.9 ) ) ) * near * front * onEye;
		c = mix( c, vec3f( 0.55, 0.53, 0.5 ), white );
		c = mix( c, vec3f( 0.02, 0.015, 0.01 ), smoothstep( 0.05, 0.035, length( ey ) ) * near * front * onEye );
		let brow = smoothstep( 0.05, 0.02, abs( d.y - 0.3 + 0.05 * ax ) ) * step( 0.1, ax ) * step( ax, select( 0.56, 0.5, female ) ) * front;
		c = mix( c, hairC, brow * select( 0.85, 0.55, female ) );
		// the nose: its ridge catching the light, the shadow under it
		c *= 1.0 + 0.1 * smoothstep( 0.1, 0.03, ax ) * step( - 0.18, d.y ) * step( d.y, 0.22 ) * front;
		c *= mix( 1.0, 0.72, smoothstep( 0.1, 0.03, length( vec2f( d.x * 0.8, d.y + 0.24 ) ) ) * front );
		// the mouth: lips (redder on the women), open when he shouts
		let open = f32( u32( r3.z + 0.5 ) & 63u ) / 63.0; // (FF2: packed with the smile and the blink)
#if CROWD_LOD <= 1
		// ---- FF2: close up (FF3: and near) the MakeHuman head's mouth opens itself (the expression's jaw): the lips keep
		// their own size and colour, and inside them (the paint's d.z marks the mouth's inside) it's dark, the
		// upper teeth under the upper lip, only as it opens
		let mo = length( vec2f( d.x / 0.25, ( d.y + 0.45 ) / 0.05 ) );
		let lip = c * select( vec3f( 0.85, 0.62, 0.6 ), vec3f( 0.95, 0.5, 0.52 ), female );
		c = mix( c, lip, smoothstep( 1.0, 0.7, mo ) * front );
		let inM = smoothstep( - 1.04, - 1.3, d.z ) * smoothstep( 0.16, 0.11, abs( d.y + 0.45 ) ) * smoothstep( 0.32, 0.26, ax ) * smoothstep( 0.05, 0.35, open );
		var teeth = smoothstep( - 0.435, - 0.425, d.y ) * smoothstep( - 0.39, - 0.4, d.y ) * smoothstep( 0.13, 0.09, ax ) * 0.8;
		// (---- FF3: and on the near level, the 90-triangle head, whose jaw opens too: its inside now keeps a
		// vertex or two, marked; the teeth are under a pixel there)
#if CROWD_LOD == 1
		teeth = 0.0;
#endif
		c = mix( c, mix( vec3f( 0.035, 0.008, 0.008 ), vec3f( 0.36, 0.34, 0.29 ), teeth ), inM );
		if ( inM > 0.5 ) { rough = mix( 0.3, 0.45, teeth ); }
		// ---- end FF2
#else
		let mo = length( vec2f( d.x / 0.25, ( d.y + 0.45 ) / ( 0.05 + 0.13 * open ) ) );
		let lip = c * select( vec3f( 0.85, 0.62, 0.6 ), vec3f( 0.95, 0.5, 0.52 ), female );
		c = mix( c, mix( lip, vec3f( 0.06, 0.02, 0.02 ), smoothstep( 0.3, 0.7, open ) ), smoothstep( 1.0, 0.7, mo ) * front );
#endif
		// a moustache, a goatee, a beard (soft at its edges, broken up, not a mask: CP-13), stubble
		// ---- FW6 (C4W-16): a moustache and a goatee in the hair's own colour, a little darker, their edges
		// soft and broken into stubble, the skin through them (hard black cut-outs with ruler edges)
		let fstub = 0.75 + 0.25 * sin( d.x * 211.0 + sin( d.y * 97.0 ) * 3.0 ) * sin( d.y * 183.0 + d.x * 41.0 );
		let fcol = mix( c, hairC * 0.8, 0.85 );
		// ---- FF1: the MakeHuman head has a neck under its chin (the egg ended there): no beard down it
		var noNeck = 1.0;
#if CROWD_LOD <= 1
		noNeck = smoothstep( - 1.12, - 0.98, d.y );
#endif
		// ---- end FF1
		let moust = smoothstep( 0.06, 0.02, abs( d.y + 0.33 + 0.04 * ax * ax ) ) * smoothstep( 0.33, 0.24, ax );
		let goat = smoothstep( - 0.47, - 0.53, d.y ) * smoothstep( 0.27, 0.19, ax ) * smoothstep( 0.0, - 0.2, d.z ) * noNeck;
		if ( facial == 1u || facial == 3u ) { c = mix( c, fcol, clamp( moust * fstub * 1.15, 0.0, 0.92 ) * front ); }
		if ( facial == 2u ) { c = mix( c, fcol, clamp( max( moust, goat ) * fstub * 1.15, 0.0, 0.92 ) * front ); }
		// ---- end FW6
		if ( facial == 3u ) {
			// ---- FW4 (C3W-4): on the jaw and the cheeks below the cheekbone's line, up to the sideburns in front
			// of the ears, thinning at its edges, the skin through it (it ran round the side of the head to the
			// back from the mouth down: a black bar from ear to ear, at arm's length)
			let grain = 0.85 + 0.15 * sin( d.x * 93.0 ) * sin( d.y * 71.0 + d.z * 37.0 );
			let edgeY = - 0.16 + 0.24 * smoothstep( 0.35, 0.85, ax );
			let cover = smoothstep( edgeY + 0.03, edgeY - 0.1, d.y ) * smoothstep( 0.18, - 0.12, d.z ) * smoothstep( 0.5, 0.7, mo ) * smoothstep( 1.02, 0.86, ax ) * noNeck;
			c = mix( c, mix( hairC, c, 0.22 ) * grain, 0.7 * cover );
			// ---- end FW4
		}
		if ( facial == 0u && ! female && age != 2u && c1.w < 0.35 ) { c *= mix( vec3f( 1.0 ), vec3f( 0.82, 0.84, 0.88 ), step( d.y, - 0.2 ) * step( d.z, 0.3 ) * step( 0.8, mo ) * noNeck ); }
		// glasses: thin dark frames round the eyes and over the nose
		if ( glasses ) {
			let ring = abs( length( ey * vec2f( 1.0, 1.25 ) ) - 0.17 );
			let fr = max( smoothstep( 0.035, 0.015, ring ), smoothstep( 0.03, 0.01, abs( d.y - 0.14 ) ) * step( ax, 0.18 ) );
			c = mix( c, vec3f( 0.015 ), fr * front );
			rough = mix( rough, 0.2, smoothstep( 0.17, 0.12, length( ey * vec2f( 1.0, 1.25 ) ) ) * front );
		}
		// the ears (red with the cold)
		c *= mix( vec3f( 1.0 ), vec3f( 1.1, 0.8, 0.78 ), smoothstep( 0.86, 0.95, ax ) * step( abs( d.y ), 0.25 ) * step( abs( d.z ), 0.35 ) );
#endif
		// the hair: short (a hairline, the back and sides), long down the back, pulled back, or a
		// horseshoe round a bald crown (which shines)
		// (at the sides above the ears and behind them, not over them: under a cap's band it read as a blindfold)
		var hairy = d.y > 0.42 - 0.55 * smoothstep( - 0.35, 0.5, d.z ) || ( ax > 0.8 && d.z > - 0.3 && ( d.y > 0.24 || ( d.z > 0.3 && d.y > - 0.15 ) ) );
		if ( hairStyle == 1u ) {
			// ---- FW1 (C2W-6): her own cut: bangs at their own height, swept to one side, or pulled back off the
			// face behind the ears (it was one black bob on every woman)
			let hv = ( u32( cwPoseBuf[ fan * ${ POSE_N * 2 }u + 4u ].w + 0.5 ) >> 10u ) & 7u;
			var fringe = 0.32 + 0.05 * f32( hv & 3u );
			if ( hv == 2u || hv == 3u ) { fringe = 0.5 + 0.28 * d.x * select( - 1.0, 1.0, hv == 3u ); }
			let back = hv >= 4u && hv < 6u;
			if ( back ) { fringe = 0.58; }
			hairy = d.y > fringe - 1.4 * smoothstep( - 0.55, 0.25, d.z ) || ( ax > 0.72 && d.y > - 0.55 && d.z > select( - 0.45, - 0.15, back ) );
		}
		if ( hairStyle == 3u ) { hairy = d.y > 0.38 - 1.0 * smoothstep( - 0.4, 0.4, d.z ); }
		if ( hairStyle == 2u ) {
			// ---- FS1 (C4S-6): the horseshoe as it grows: from the crown's edge (higher at the back) down to the
			// nape's hairline behind, round above and behind the ears to a sideburn in front of them, its edges
			// broken. It began at the temples by the eyes and stopped above the nape: goggles from the side, a
			// strap round a bald egg from behind
			let gr = 0.035 * sin( d.x * 61.0 ) * sin( d.y * 47.0 + d.z * 29.0 );
			let yTop = mix( 0.24, 0.32, smoothstep( 0.0, 0.8, d.z ) ) + gr;
			let yBot = mix( select( - 0.1, - 0.3, d.z > - 0.05 ), - 0.62, smoothstep( 0.25, 0.85, d.z ) ) + gr;
			let ear = ax > 0.72 && abs( d.y + 0.02 ) < 0.2 && d.z > - 0.1 && d.z < 0.28;
			hairy = d.z > - 0.24 + gr && d.y < yTop && d.y > yBot && ! ear;
			rough = select( rough, 0.3, d.y > yTop );
		}
		if ( hairy ) { c = hairC; rough = 0.7; }
		// a cap (CP-1): down to just above the brows in front, the tops of the ears at the sides and low
		// behind (the crowd's own crown covers it close up), its panels' seams, the white P on the front
		let frontness = - d.z / max( length( d.xz ), 0.001 );
		if ( capped && d.y > 0.18 + 0.225 * frontness ) {
			c = capC; rough = 0.8;
			if ( abs( fract( atan2( d.x, d.z ) * 0.955 ) - 0.5 ) > 0.47 ) { c *= 0.75; }
		}
		// ---- FW6 (C4W-10): the brim's shade on the face down to the nose, the eyes in it (every capped face
		// under the lights was lit evenly from the band to the chin)
		if ( capped && d.y <= 0.18 + 0.225 * frontness ) { c *= 1.0 - 0.38 * smoothstep( - 0.3, 0.4, d.y ) * smoothstep( - 0.1, - 0.5, d.z ); }
		// ---- end FW6
		// a knit hat (a folded cuff, ribs, a pom-pom; the Phillies' red one with its navy cuff and the
		// white P on the front, Getty 83893023)
		// ---- FW6 (C4W-2): from its edge on the forehead (cwKnitEdge), the cuff 0.13 over it; it came down
		// to d.y 0.14, over the brows to the eyes
		let kRel = d.y - cwKnitEdge( d );
		if ( ( hat == 3u || hat == 7u ) && ( kRel > 0.0 || piece ) ) {
			let knit = cwLookBuf[ k + 5u ].rgb;
			c = knit * ( 0.9 + 0.1 * sin( atan2( d.x, d.z ) * 36.0 ) );
			if ( kRel < 0.13 ) { c = select( knit * 0.8, vec3f( 0.012, 0.016, 0.05 ), hat == 3u ); }
			c *= 1.0 - 0.25 * smoothstep( 0.025, 0.0, abs( kRel - 0.13 ) );
			if ( hat == 3u && d.z < - 0.6 ) {
				let lp = vec2f( - d.x / 0.22, ( kRel - 0.3 ) / 0.15 );
				let pP = ( abs( lp.x + 0.25 ) < 0.16 && abs( lp.y ) < 0.75 ) || ( abs( length( ( lp - vec2f( 0.05, 0.3 ) ) * vec2f( 1.0, 1.3 ) ) - 0.32 ) < 0.14 && lp.x > - 0.25 );
				if ( pP ) { c = vec3f( 0.62, 0.6, 0.55 ); }
			}
			// the pom-pom: red and white (the Phillies'), or the hat's own colour
			// ---- FX1 (step 11): yarn, tufts of it every few millimetres, the red and white strands mixed (a
			// pinkish blur a few rows off), the tufts' ends in the light and the hollows between them and its
			// underside, where it sits in the crown, in shade. (It was the hat's stripes run across it, so
			// close up it read as a striped box: step 10's Pavilion Deck)
			if ( piece || d.y > 0.97 ) {
				let yt = sin( d.x * 151.0 + sin( d.y * 117.0 + d.z * 23.0 ) * 2.3 ) * sin( d.z * 139.0 + d.y * 89.0 + sin( d.x * 61.0 ) * 1.7 );
				let yf = 1.0 - smoothstep( 0.04, 0.12, fwidth( d.x ) + fwidth( d.y ) );
				let strand = select( knit * 1.1, select( vec3f( 0.62, 0.6, 0.55 ), vec3f( 0.36, 0.02, 0.03 ), yt > - 0.2 ), hat == 3u );
				let blur = select( knit * 1.1, vec3f( 0.46, 0.25, 0.25 ), hat == 3u );
				c = mix( blur, strand, yf ) * ( 0.82 + 0.18 * yf * ( yt * 0.5 + 0.5 ) );
				if ( piece ) { c *= mix( 0.62, 1.0, smoothstep( 1.02, 1.3, d.y ) ); }
			}
			// ---- end FX1
			rough = 0.95;
		}
		if ( hood ) {
			let oval = length( vec2f( d.x * 1.05, ( d.y + 0.08 ) * 0.92 ) );
			let opening = oval < 0.72 && d.z < - 0.35;
			if ( clear ) {
				// a clear poncho's hood: the hair and the cap under the film
				// ---- FW4 (C3W-4): crumpled, a haze over them (it was the hair lacquered: a black helmet)
				var hc = vec4f( 0.0 );
#if CROWD_LOD <= 1
				if ( ! opening ) {
					hc = filmCrumple( L * 1.2, length( fwidth( L ) ) );
					s.normal = filmTilt( s.normal, hc.xyz );
				}
#endif
				c = mix( c * 0.7, vec3f( 0.44, 0.46, 0.5 ), select( 0.22 + 0.12 * hc.w, 0.0, opening ) );
				rough = 0.22;
				// ---- end FW4
			} else if ( ! opening ) {
				// a hood: cloth (matte, the rain soaks it: WET_FABRIC), darker inside its rim
				c = shirt * select( 1.0, 0.55, oval < 0.85 && d.z < - 0.2 );
				rough = select( 0.85, 0.3, poncho );
#if CROWD_LOD <= 1
				// (FW4: a coloured poncho's hood crumpled as its film is)
				if ( poncho ) { let hk = filmCrumple( L * 1.2, length( fwidth( L ) ) ); s.normal = filmTilt( s.normal, hk.xyz ); }
#endif
			}
		}
	}
	if ( part == 4u ) {
		// a cap's crown and bill: the cloth, the six panels' seams and the button on the crown, the white
		// P on the front panels; the bill's underside in its shade (grey-green under a dark wash), not black
		let d = L / ${ f3( HEAD_R ) };
		c = capC; rough = 0.8;
		if ( piece ) {
			let az = atan2( d.x, - d.z );
			if ( abs( fract( az * 0.955 + 0.5 ) - 0.5 ) < 0.03 ) { c *= 0.7; }
			if ( d.y > 1.1 && length( d.xz ) < 0.12 ) { c *= 0.8; }
			if ( d.z < - 0.55 && hat != 6u ) {
				// the P: its stem on the viewer's left, the bowl on the right (the figure's +x is his right)
				let lp = vec2f( - d.x / 0.26, ( d.y - 0.72 ) / 0.26 );
				let fw = fwidth( lp.x ) + fwidth( lp.y );
				let a = 1.0 - smoothstep( 0.1, 0.3, fw );
				let stem = abs( lp.x + 0.25 ) < 0.12 && abs( lp.y ) < 0.75;
				let bowl = abs( length( ( lp - vec2f( 0.05, 0.3 ) ) * vec2f( 1.0, 1.3 ) ) - 0.32 ) < 0.11 && lp.x > - 0.25;
				if ( stem || bowl ) { c = mix( c, select( vec3f( 0.68, 0.67, 0.64 ), vec3f( 0.32, 0.02, 0.03 ), hat == 2u ), a ); }
			}
		}
		if ( in.N.y < - 0.25 && ! piece ) { c = mix( capC * 0.5, vec3f( 0.06, 0.07, 0.06 ), 0.45 ); e = c * 0.25; }
	}
	if ( part == 8u ) {
		// a clear cup of lager with its head; a white cup of hot chocolate with its black lid; a phone's
		// lit screen; a camera, silver or black; a soda's red and white cup
		let id = u32( cwPoseBuf[ fan * ${ POSE_N * 2 }u + 4u ].w + 0.5 ) & 15u;
		let top = in.N.y > 0.7;
		rough = 0.4;
		if ( id == 1u ) { c = select( vec3f( 0.55, 0.33, 0.04 ), vec3f( 0.75, 0.72, 0.62 ), top ); rough = select( 0.1, 0.9, top ); }
		if ( id == 2u ) { c = select( vec3f( 0.72, 0.7, 0.66 ), vec3f( 0.02 ), top ); }

		if ( id == 3u ) { c = vec3f( 0.03 ); rough = 0.2; if ( in.N.z < - 0.5 || in.N.z > 0.5 ) { e = vec3f( 0.25, 0.4, 0.6 ) * 0.6; } }
		if ( id == 4u ) { c = select( vec3f( 0.5, 0.51, 0.53 ), vec3f( 0.03 ), seed > 0.5 ); rough = 0.3; }
		if ( id == 5u ) { c = select( vec3f( 0.45, 0.03, 0.03 ), vec3f( 0.7, 0.68, 0.64 ), top ); }
#if CROWD_LOD == 0
		// ---- FC4 (C4R-3): close up the lager seen through the clear cup (the amber a shade paler through
		// the plastic and darker toward the bottom), its head, the empty plastic above it to the rolled rim
		// catching the light; the hot chocolate's paper cup with its brown sleeve and black lid; the soda's
		// band (L.y: -0.5 the bottom to 0.5 the rim)
		let h = L.y + 0.5;
		if ( id == 1u && ! top ) {
			let fill = 0.78 + 0.06 * fract( seed * 5.3 );
			c = mix( vec3f( 0.5, 0.3, 0.035 ) * ( 0.75 + 0.35 * h ), vec3f( 0.62, 0.6, 0.56 ), 0.16 );
			if ( h > fill - 0.1 ) { c = vec3f( 0.72, 0.69, 0.6 ); }
			if ( h > fill ) { c = vec3f( 0.3, 0.31, 0.32 ); }
			if ( h > 0.96 ) { c = vec3f( 0.75, 0.75, 0.73 ); }
			rough = 0.12;
		}
		if ( id == 2u && ! top && abs( h - 0.45 ) < 0.18 ) { c = vec3f( 0.3, 0.18, 0.09 ); rough = 0.8; }
		if ( id == 5u && ! top && abs( h - 0.55 ) < 0.12 ) { c = vec3f( 0.7, 0.68, 0.64 ); }
		// ---- end FC4
#endif
	}
	if ( part == 5u ) {
		// the 2008 rally towel: white terry, the red square with the script across it in white
		c = vec3f( 0.78, 0.77, 0.74 ); rough = 0.95;
		if ( abs( L.x - 0.5 ) < 0.3 && abs( L.z - 0.5 ) < 0.26 ) { c = vec3f( 0.36, 0.02, 0.03 ); if ( abs( L.z - 0.5 ) < 0.05 && abs( L.x - 0.5 ) < 0.22 ) { c = vec3f( 0.78, 0.77, 0.74 ); } }
		// ---- FP2 (C2B-16): whirled overhead, the square smears into the white: a pink and white blur, as
		// the photos have them (Getty 84082693), not a red and white card
		let whirl = cwPoseBuf[ fan * ${ POSE_N * 2 }u + 1u ].y;
		c = mix( c, mix( vec3f( 0.76, 0.75, 0.72 ), c, 0.45 ), whirl );
	}
#if CROWD_LOD <= 1
	// ---- FP2 (CP-12): a homemade sign: poster board, its words in marker on the face toward the field
	// (the boards behind home's atlas), the back plain; the night's own words
	if ( part == 9u ) {
		let sg = ( cwIds[ fan ].z >> 4u ) & 63u;
		let si = ( sg + 11u ) % 12u;
		var s29 = array<u32, 12>( ${ signCells( SIGNS29 ) } );
		var s27 = array<u32, 12>( ${ signCells( SIGNS27 ) } );
		let cell = select( s29[ si ], s27[ si ], mat.cwNight < 28.0 );
		c = vec3f( 0.66, 0.65, 0.62 );
		// (its printed face is the one toward the field: seen from the field's side of it)
		if ( dot( in.V.xz, mat.cwHome.xz - in.P.xz ) > 0.0 ) {
			let uv = vec2f( clamp( L.x, 0.0, 1.0 ), clamp( L.z, 0.0, 1.0 ) * ${ SIGN_GRID.aspect.toFixed( 4 ) } );
			c = textureSample( cwSigns, smpAnisoClamp, ( vec2f( f32( cell % ${ SIGN_GRID.x }u ), f32( cell / ${ SIGN_GRID.x }u ) ) + uv ) / vec2f( ${ SIGN_GRID.x }.0, ${ SIGN_GRID.y }.0 ) ).rgb;
		}
		rough = mix( 0.75, 0.35, frame.wet );
	}
#endif
	// (FP2: its strands, darker in among them and toward the ends: one flat colour read as a helmet)
	if ( part == 10u ) {
		c = hairC * ( 0.8 + 0.2 * sin( atan2( L.x, L.z ) * 60.0 + L.y * 25.0 ) ) * mix( 1.0, 0.82, smoothstep( - 0.05, - 0.2, L.y ) ); rough = 0.7;
#if CROWD_LOD == 0
		// ---- FW4 (C3W-12): close up the strands lit as strands (the Cast's: the normal turned across them)
		let sa = atan2( L.x, L.z );
		// (FC4, C4R-3: finer and uneven, wandering down the hair: 23 even folds read as a pleated drum)
		let wv = sa * 41.0 + 2.2 * sin( sa * 7.3 + L.y * 11.0 ) + L.y * 6.0;
		s.normal = normalize( s.normal + ( 0.12 * sin( wv ) + 0.07 * sin( sa * 97.0 - L.y * 17.0 + 1.3 * sin( sa * 13.0 ) ) ) * vec3f( cos( sa ), 0.0, - sin( sa ) ) );
		c *= 0.9 + 0.12 * sin( wv * 1.7 + 0.8 );
		rough = 0.62;
		// ---- end FW4
#endif
	}
	// lit by the stands' fill after dark, as the seats are
	s.albedo = c;
	s.roughness = rough;
	s.emissive = e + c * nk * 0.12;
`,
	} );
	mat.underwaterLighting = 'none';
	// ---- SP3 (speed): from the middle level out his motion vectors are his piece's (the pose is this
	// frame's under last frame's matrix), and the pieces never move: drawn without last frame's position
	// as a varying (engine MeshRenderer: a still object's last position is where it is)
	mat.stillMotion = lod >= 2;
	// and their world position from the pixel's depth (a fan of these levels is a hundred vertices over a
	// few dozen pixels: MeshShader WORLD_FROM_DEPTH)
	mat.worldFromDepth = lod >= 2;
	// ---- end SP3
	return mat;

}

// ---------------------------------------------------------------- who sits where

// the same hash as the shader's (cwHash), for choosing the cast's seeds
function pcg( n ) {

	let x = ( Math.imul( n >>> 0, 747796405 ) + 2891336453 ) >>> 0;
	x = Math.imul( ( ( x >>> ( ( x >>> 28 ) + 4 ) ) ^ x ) >>> 0, 277803737 ) >>> 0;
	return ( ( x >>> 22 ) ^ x ) >>> 0;

}

export const rand4 = ( s ) => [ 0, 101, 202, 303 ].map( ( o ) => pcg( s + o ) / 4294967296 );

// a small seeded random number generator (mulberry32)
function rng( seed ) {

	let a = seed >>> 0;
	return () => {

		a = ( a + 0x6D2B79F5 ) >>> 0;
		let t = a;
		t = Math.imul( t ^ ( t >>> 15 ), t | 1 );
		t ^= t + Math.imul( t ^ ( t >>> 7 ), t | 61 );
		return ( ( t ^ ( t >>> 14 ) ) >>> 0 ) / 4294967296;

	};

}

// pick a key of a table of weights
function pick( r, table ) {

	let sum = 0;
	for ( const k in table ) sum += table[ k ];
	let x = r() * sum;
	for ( const k in table ) {

		x -= table[ k ];
		if ( x <= 0 ) return + k;

	}

	return + Object.keys( table )[ 0 ];

}

const strHash = ( s ) => [ ...s ].reduce( ( a, ch ) => Math.imul( a ^ ch.charCodeAt( 0 ), 16777619 ) >>> 0, 2166136261 );

// age: 0 adult, 1 old, 2 kid, 3 teen; hat: 0 bare, 1 red cap, 2 navy cap, 3 red knit hat, 4 hood up, 5 the
// 1980 maroon cap, 6 a Rays cap, 7 a knit hat; hair: 0 short, 1 long, 2 bald, 3 ponytail; facial: 0 none,
// 1 moustache, 2 goatee, 3 beard
function randomFan( r ) {

	const f = { seed: Math.floor( r() * 65536 ), outfit: 0, player: 0, hat: 0, hair: 0, facial: 0, glasses: 0, scarf: 0, gloves: 0, blanket: 0, age: 0, female: 0,
		skin: 0, hairColor: 0, build: 1, prop: 0, sign: 0, towel: 0, rider: 0, carrier: 0, away: 0, aisle: 0, rays: 0, poncho: 0, beh: 0 };
	const u = r();
	f.age = u < 0.06 ? 2 : u < 0.13 ? 3 : u < 0.28 ? 1 : 0;
	f.female = r() < ( f.age === 2 ? 0.45 : 0.4 ) ? 1 : 0;
	// South Philadelphia, the suburbs, the city: mostly pale, some olive, brown and dark
	f.skin = pick( r, { 0: 22, 1: 26, 2: 16, 7: 9, 3: 11, 4: 7, 5: 5, 6: 4 } );
	f.hairColor = f.age === 1 ? pick( r, { 6: 45, 7: 30, 1: 15, 2: 10 } )
		// (FW1, C2W-6: the women's more varied: browns, blondes, auburn; they were most of them black)
		: f.female ? pick( r, { 0: f.skin >= 4 ? 60 : 13, 1: 22, 2: 22, 3: 17, 4: 22, 5: 7 } ) : pick( r, { 0: f.skin >= 4 ? 70 : 24, 1: 30, 2: 20, 3: 9, 4: 7, 5: 4 } );
	f.build = f.age === 2 ? 0 : f.female ? pick( r, { 0: 35, 1: 55, 2: 10 } ) : pick( r, { 0: 18, 1: 48, 2: 24, 3: 10 } );
	f.hat = f.age === 1 ? pick( r, { 0: 30, 1: 22, 2: 6, 3: 6, 4: 4, 5: 14, 7: 18 } )
		: f.female ? pick( r, { 0: 36, 1: 22, 2: 3, 3: 15, 4: 12, 7: 12 } )
			: f.age === 2 ? pick( r, { 0: 15, 1: 50, 3: 22, 4: 8, 7: 5 } )
				: pick( r, { 0: 27, 1: 30, 2: 7, 3: 9, 4: 12, 5: 2, 7: 13 } );
	f.hair = f.female ? pick( r, { 0: 10, 1: 58, 3: 32 } ) : f.age === 1 ? pick( r, { 0: 62, 2: 38 } ) : pick( r, { 0: 80, 1: 6, 2: f.age === 0 ? 14 : 0 } );
	if ( ! f.female && ( f.age === 0 || f.age === 1 ) ) f.facial = f.age === 1 ? pick( r, { 0: 55, 1: 25, 2: 8, 3: 12 } ) : pick( r, { 0: 50, 1: 10, 2: 22, 3: 18 } );
	f.glasses = r() < ( f.age === 1 ? 0.55 : f.age === 2 ? 0.08 : 0.2 ) ? 1 : 0;
	// a cold October night's clothes (CP-12), from his seed (not the sequence, so the rest of the crowd
	// stays who it was): a hoodie, a jacket zipped to the chin or a sweatshirt; a scarf (more over a
	// sweatshirt's bare neck); gloves
	const [ a, b, c, d ] = rand4( f.seed * 3 + 40503 );
	f.outfit = a < 0.3 ? 0 : a < 0.75 ? 1 : 2;
	f.scarf = b < ( f.outfit === 2 ? 0.32 : 0.14 ) ? 1 : 0;
	f.gloves = c < 0.3 ? 1 : 0;
	// in his left hand (one in seven): a beer, the cold night's hot chocolate, a phone, a camera, a soda
	if ( f.age !== 2 && d < 0.15 ) f.prop = d < 0.05 ? 1 : d < 0.1 ? 2 : d < 0.12 ? 3 : d < 0.14 ? 4 : 5;
	else if ( f.age === 2 && d < 0.1 ) f.prop = 2;
	// ---- FP2 (CP-12): a homemade sign for one in a hundred (a few hundred round the bowl, as in the
	// 2008 frames: Getty 112873396, FOX's of the 29th), from his seed too; the night picks its words
	const [ e, g ] = rand4( f.seed * 5 + 7919 );
	if ( f.age !== 2 && e < 0.01 ) f.sign = 1 + Math.floor( g * 12 );
	// ---- end FP2
	return f;

}

// ---- FF1 (step 10): a fan's face (the MakeHuman head's blend shapes' weights, packed: FanHead.js) from who
// he is (his ids: female, age, skin, build) and his seed
function faceOf( x, y ) {

	const seed = x & 0xffff, skin = ( x >> 16 ) & 7, build = ( x >> 22 ) & 3, age = ( y >> 21 ) & 3, female = ( y >> 23 ) & 1;
	const r = rand4( seed * 11 + 30011 );
	return packFace( faceWeights( faceFeatures( female, age, skin, build, r ), seed + 65536 * skin ) );

}
// ---- end FF1

// three integers (exact in float32: < 2^24) for the shaders
function pack( f, out, i ) {

	out[ i * 3 ] = ( f.seed & 0xffff ) | ( f.skin << 16 ) | ( f.hairColor << 19 ) | ( f.build << 22 );
	out[ i * 3 + 1 ] = f.outfit | ( f.player << 5 ) | ( f.hat << 10 ) | ( f.hair << 13 ) | ( f.facial << 15 ) | ( f.glasses << 17 ) | ( f.scarf << 18 ) | ( f.gloves << 19 ) | ( f.blanket << 20 ) | ( f.age << 21 ) | ( f.female << 23 );
	out[ i * 3 + 2 ] = f.prop | ( f.sign << 4 ) | ( f.towel << 10 ) | ( f.rider << 11 ) | ( f.carrier << 13 ) | ( f.away << 14 ) | ( f.aisle << 16 ) | ( f.rays << 18 ) | ( f.poncho << 19 ) | ( f.beh << 20 );

}

export class Crowd {

	constructor() {

		this.geometries = LODS.map( ( _, k ) => fanGeometry( k ) );
		// ---- SP2: where the distant level takes over (lod()'s d: half the screen's height in metres at
		// the chunk: 60 is a seated fan ~8 px tall of 800)
		this.distant = 60;
		// who each fan is and where he sits (written once, when the stands are done), and what the compute
		// pass works out for him each frame (see cwHashModule)
		this.idsBuf = new StorageBuffer( { label: 'crowd ids', count: MAX_FANS, type: 'vec4u' } );
		this.seatsBuf = new StorageBuffer( { label: 'crowd seats', count: MAX_FANS, type: 'vec4f' } );
		this.poseBuf = new StorageBuffer( { label: 'crowd pose', count: MAX_FANS * POSE_N * 2, type: 'vec4f' } );
		this.lookBuf = new StorageBuffer( { label: 'crowd look', count: MAX_FANS * 6, type: 'vec4f' } );
		// the reaction: its mood before (A) and after (B) (stand, arms up, towels, jumping), where it started
		// (x, z) and how fast it spreads (1 / speed), and how long ago; clapping, the chant, tension; the
		// Rays fans standing and cheering; time, dt, rain and how many fans
		this.params = new UniformBlock( 'CrowdParams', {
			moodA: [ 'vec4f', new Vector4() ], moodB: [ 'vec4f', new Vector4() ], ripple: [ 'vec4f', new Vector4( 0, 0, 0.02, 99 ) ],
			act1: [ 'vec4f', new Vector4() ], act3: [ 'vec4f', new Vector4() ], misc: [ 'vec4f', new Vector4( 0, 0.016, 0, 0 ) ],
			// the local reactions (focus()): where (world x, z) and how far, and how much (stand, arms up)
			focus: [ 'vec4f[4]', new Float32Array( 16 ) ], focusMood: [ 'vec4f[4]', new Float32Array( 16 ) ],
			// ---- FS1: seconds since strike three (-1 before it), the song (0..1), the delay (0..1); what the
			// fans watch (the world's x, z) and how closely (0..1)
			fs1: [ 'vec4f', new Vector4( - 1, 0, 0, 0 ) ], fsLook: [ 'vec4f', new Vector4( 0, 0, 0, 0 ) ],
		} );
		this.materials = LODS.map( ( _, k ) => crowdMaterial( k, this.poseBuf, this.lookBuf, this.idsBuf ) );
		this.geometry = this.geometries[ 0 ];
		this.material = this.materials[ 0 ];
		this.chunks = [];
		this.meshes = [];
		this.count = 0;
		this.time = 0;
		this._mood = { stand: 0.03, cheer: 0, clap: 0, jump: 0, towel: 0.03, tense: 0 };

	}

	allMaterials() {

		return this.materials;

	}

	// is there someone in this seat (by its matrix)? A few seats are empty
	occupied( m ) {

		const e = m.elements;
		const s = Math.sin( e[ 12 ] * 12.9898 + e[ 14 ] * 78.233 + e[ 13 ] * 3.7 ) * 43758.5453;
		return s - Math.floor( s ) > 0.04;

	}

	// who sits in each seat of a chunk: three integers per fan
	_dress( mats, name, info ) {

		const n = mats.length, out = new Float32Array( n * 3 );
		const r = rng( strHash( name ) + ( this._dressed || 0 ) * 7919 );
		for ( let i = 0; i < n; i ++ ) {

			const f = randomFan( r );
			f.towel = r() < 0.75 ? 1 : 0;
			if ( f.sign ) f.towel = 0; // (FP2: both hands on the sign)
			// the odd brave Rays fan (in Rays blue, most in a Rays cap; he sits out the Phillies' moments)
			if ( r() < 0.004 ) {

				f.rays = 1;
				if ( r() < 0.6 ) f.hat = 6;

			}
			pack( f, out, i );

		}

		return out;

	}

	// a crowd chunk on these seats (their matrices): close, near, middle and far versions, one drawn at a time
	addChunk( group, mats, name, info = [] ) {

		if ( this.off || ! mats.length ) return;
		if ( this.count + mats.length > MAX_FANS ) throw new Error( `Crowd: more than ${ MAX_FANS } fans (raise MAX_FANS)` );
		const ids = this._dress( mats, name, info );
		this._dressed = ( this._dressed || 0 ) + 1;
		// In pieces of a few hundred seats (a dozen rows of a section): each is culled and picks its level of
		// detail on its own, so a view draws the pieces it sees and only those close by in full (whole
		// stands' chunks went in one draw, all of a chunk's 1,500 fans at the level of its nearest)
		// (---- SP1: the pieces even, a chunk of 400 is two of 200, not 360 and 40)
		const n = Math.ceil( mats.length / PIECE );
		for ( let j = 0; j < n; j ++ ) {

			const i0 = Math.round( j * mats.length / n ), i1 = Math.round( ( j + 1 ) * mats.length / n );
			this._piece( group, mats.slice( i0, i1 ), ids.subarray( i0 * 3, i1 * 3 ), name );

		}

	}

	_piece( group, mats, ids, name ) {

		// the piece's first fan in the crowd's buffers (draw.params.y)
		const base = this.count;
		let first = null;
		const make = ( k, suffix ) => {

			const mesh = new InstancedMesh( this.geometries[ k ], this.materials[ k ], mats.length );
			if ( first ) mesh.instanceMatrix = first.instanceMatrix;
			else mats.forEach( ( m, i ) => mesh.setMatrixAt( i, m ) );
			mesh.drawParams = [ base, 0, 0 ];
			mesh.computeBoundingBox();
			mesh.computeBoundingSphere();
			mesh.name = name + suffix;
			mesh.receiveShadow = true;
			mesh.castShadow = false;
			mesh.visible = k === 0;
			group.add( mesh );
			this.meshes.push( mesh );
			first = first || mesh;
			return mesh;

		};

		this.chunks.push( { near: make( 0, '-crowd' ), lods: [ first, make( 1, '-crowd-near' ), make( 2, '-crowd-mid' ), make( 3, '-crowd-far' ), make( 4, '-crowd-distant' ) ], ids, base } ); // ---- SP2: distant
		this.count += mats.length;

	}

	// pick each chunk's version by how big its fans are on screen: the distance to the chunk against the
	// camera's zoom (the center field camera's long lens sees the far stands in full)
	lod( camera ) {

		const k = Math.tan( ( camera.fov || 60 ) * Math.PI / 360 );
		// ---- FP2: the flashes hold a few pixels however long the lens (the angle of a pixel, ~800 tall)
		if ( this._flashMat ) this._flashMat.uniforms.flash.value.z = k / 400;
		// the view's cone (its corners) and its axis: a big chunk beside the camera is only seen where the
		// cone has opened out to it, far off (the center field camera's long lens over the bleachers)
		const kd = k * Math.hypot( 1, camera.aspect || 1.6 );
		const c = this._c || ( this._c = new Vector3() );
		const fwd = ( this._f || ( this._f = new Vector3() ) ).set( 0, 0, - 1 ).transformDirection( camera.matrixWorld );
		for ( const ch of this.chunks ) {

			const bs = ch.near.boundingSphere;
			if ( ! bs ) continue;
			c.copy( bs.center ).applyMatrix4( ch.near.matrixWorld );
			const R = bs.radius * ch.near.matrixWorld.getMaxScaleOnAxis();
			const dist = camera.position.distanceTo( c );
			const depth = c.sub( camera.position ).dot( fwd );
			const lat = Math.sqrt( Math.max( 0, dist * dist - depth * depth ) );
			const d = Math.max( 0, dist - R, ( lat - R ) / kd ) * k;
			// (close up the whole figure, under ~4 m of the screen's half height: a fan over a sixth of it;
			// never through a long lens, whose fans are all far off)
			// ---- SP2: and the distant one beyond DISTANT (fans under ~8 px)
			const level = d < 4 && k > 0.17 ? 0 : d < 11 ? 1 : d < 30 ? 2 : d < this.distant ? 3 : 4;
			for ( let k = 0; k < ch.lods.length; k ++ ) ch.lods[ k ].visible = level === k;

		}

	}

	// how the crowd feels about the game at the replay's time (a function of the timeline, so scrubbing
	// shows the right thing): up on two strikes and two outs when the Phillies pitch, on their feet for a
	// rally, everyone up and jumping at the end
	mood( d ) {

		// ---- FR2: from strike three the stands are the champions' (Director.champsAt: the celebrate
		// segment, its clock from the strike), not 3.6 s later when that segment starts
		const champ = d.champsAt ? d.champsAt( d.t ) : null;
		const seg = champ ? champ.seg : d.segmentAt( d.t );
		const m = { stand: 0.03, cheer: 0, clap: 0.05, jump: 0, towel: 0.03, tense: 0 };
		if ( ! seg ) return m;
		const s = seg.snap || {}, lt = champ ? champ.lt : d.t - seg.t0;
		// ---- end FR2
		const phPitch = s.half === 'top', late = s.inning >= 9;
		const two = ( s.strikes || 0 ) >= 2, outs2 = ( s.outs || 0 ) >= 2;
		if ( seg.kind === 'pitch' || seg.kind === 'walkup' ) {

			if ( phPitch ) {

				// (---- FS1, C4S-2: the towels in about one hand in three at the most, Getty 112874141's strike:
				// 0.95 had three in four twirling, the stands white where the photos are red with white flecks)
				if ( two ) m.stand = 0.12 + ( outs2 ? 0.3 : 0 ) + ( late ? 0.4 : 0 ), m.clap = 0.6, m.towel = 0.2 + ( outs2 ? 0.1 : 0 ) + ( late ? 0.15 : 0 );
				else if ( late ) m.stand = 0.3, m.clap = 0.4, m.towel = 0.3;
				// on the edge of their seats: leaning in on two strikes, two outs, late
				m.tense = ( two ? 0.5 : 0 ) + ( outs2 ? 0.25 : 0 ) + ( late ? 0.25 : 0 );

			} else {

				// the Phillies batting: runners on, clapping
				const on = ( s.bases || [] ).filter( Boolean ).length;
				m.clap = 0.2 + 0.2 * on;
				if ( on >= 2 ) m.stand = 0.15;
				m.tense = 0.15 * on;

			}

		}

		if ( seg.kind === 'inplay' || seg.kind === 'result' ) {

			// the play's own result (segments carry neither ev.result nor snap.result, so every Rays ball in
			// play read as "good" and no Phillies hit did: C4S-1); types matched whole ("grounded_into_double_play"
			// holds "double")
			const r = seg.ev?.result || seg.snap?.result || d.game?.plays?.[ seg.pi ]?.result;
			const type = r?.type || '';
			const hit = /^(single|double|triple|home_run)$/.test( type ), scored = ( r?.rbi || 0 ) > 0 || seg.scored > 0;
			const good = s.half === 'bottom' ? ( hit || scored ) : ! hit;
			if ( good ) {

				const big = scored || /^(home_run|double|triple)$/.test( type ) || ( s.half === 'top' && outs2 );
				const k = Math.min( 1, lt / 1.2 );
				m.stand = Math.max( m.stand, ( big ? 0.85 : 0.35 ) * k );
				m.cheer = ( big ? 0.6 : 0.2 ) * k;
				m.clap = 0.6;
				m.towel = ( big ? 0.5 : 0.3 ) * k; // (FS1, C4S-2: was 0.85 and 0.45)

			}

		}

		if ( seg.kind === 'celebrate' ) {

			m.stand = 1;
			m.cheer = 0.9;
			m.jump = 1;
			m.towel = 1;
			// ---- FP2: the first minute everyone up, jumping, arms up, towels going; then they settle into
			// a crowd again, each his own way (clapping, towels now and then, arms up, hugging, pictures),
			// for the trophy and the laps (the whole stands in one pose, arms up, for minutes on end)
			const k = Math.min( 1, Math.max( 0, lt - 45 ) / 90 );
			m.cheer = 0.9 - 0.6 * k;
			m.jump = 1 - 0.85 * k;
			m.towel = 1 - 0.65 * k;
			m.clap = 0.3 + 0.45 * k;
			// ---- end FP2

		}

		// ---- FP2 (C2B-16): the point-and-shoots' flashes (a share of the flashes' sprites going off at a
		// time): a few all night, more late on the 29th, a burst for the last pitches (FOX's center field
		// frame of the 2-2 to Hinske, Getty 83486198's specks round the bowl), the most at the last out
		m.flash = 0.05;
		if ( ( seg.kind === 'pitch' || seg.kind === 'walkup' ) && phPitch && late ) {

			m.flash =0.2 + ( two ? 0.25 : 0 ) + ( outs2 ? 0.2 : 0 ) + ( two && outs2 && lt > 1.5 ? 0.15 : 0 );

		}

		if ( ( seg.kind === 'inplay' || seg.kind === 'result' ) && m.stand > 0.5 ) m.flash = Math.max( m.flash, 0.3 );
		if ( seg.kind === 'celebrate' ) m.flash = 1 - 0.65 * Math.min( 1, Math.max( 0, lt - 30 ) / 200 );
		// ---- end FP2
		return m;

	}

	update( d, dt, rain = 0 ) {

		this.time += dt;
		const target = d ? this.mood( d ) : this._mood;
		// ---- FW1 (CP-8): a sudden lift (a hit, a strikeout, the last out) goes through the stands as a wave
		// from the play outward (the kernel's ripple, which was set flat): each fan takes it up as it reaches
		// him, a beat late of his own. A jump in the replay starts on the new moment, no wave
		const leap = d && this._lastD !== undefined && Math.abs( d.t - this._lastD - dt ) > 1;
		this._lastD = d ? d.t : undefined;
		// (the mood's target runs ahead of where the crowd is by a good margin: that's a lift)
		const lift = ! this._rip && [ 'stand', 'towel', 'cheer' ].some( ( key ) => ( target[ key ] || 0 ) - ( this._mood[ key ] || 0 ) > 0.25 );
		if ( lift && ! leap && d ) {

			const b = d.ballFocus ?? d.ballAt;
			const o = this.toWorld ? this.toWorld( b ? b[ 0 ] : 0, b ? b[ 2 ] : 0 ) : { x: 0, z: 0 };
			this._rip = { a: { ...this._mood }, t0: this.time, x: o.x, z: o.z };

		}

		if ( leap ) this._rip = null;
		// the crowd takes a moment to rise and to settle
		const k = leap ? 1 : 1 - Math.exp( - dt * 2.5 );
		for ( const key of [ 'stand', 'cheer', 'clap', 'jump', 'towel', 'tense' ] ) this._mood[ key ] += ( ( target[ key ] || 0 ) - this._mood[ key ] ) * k;
		const M = this._mood;
		const U = this.params.fields;
		const R = this._rip && this.time - this._rip.t0 < 8 ? this._rip : null;
		if ( R ) {

			U.moodA.value.set( R.a.stand, R.a.cheer, R.a.towel, R.a.jump );
			U.moodB.value.set( target.stand || 0, target.cheer || 0, target.towel || 0, target.jump || 0 );
			U.ripple.value.set( R.x, R.z, 1 / 45, this.time - R.t0 );

		} else {

			this._rip = null;
			U.moodA.value.set( M.stand, M.cheer, M.towel, M.jump );
			U.moodB.value.set( M.stand, M.cheer, M.towel, M.jump );

		}
		// ---- end FW1
		U.act1.value.set( M.clap, 0, Math.min( 1, M.tense ), 0 );
		U.misc.value.set( this.time, dt, rain, this.count );
		this._fsUpdate( d, dt, leap ); // ---- FS1
		this._focusUpdate( dt );
		if ( ! this.count ) return;
		if ( ! this._kernel ) this._seat();
		// ---- FP2: the flashes' share going off (fewer cameras out in the rain), on the crowd's clock
		if ( this._flashMat ) {

			const f = this._flashMat.uniforms.flash.value;
			f.x += ( ( target.flash || 0 ) * ( 1 - 0.7 * rain ) - f.x ) * ( leap ? 1 : 1 - Math.exp( - dt * 4 ) );
			f.y = this.time;
			this._flashes.visible = f.x > 0.005;

		}

		// ---- FS1 (C4S-8): the umbrellas up in the rain (the kernel brings the hands up with the same weight)
		if ( this._umbMat ) {

			const w = Math.min( 1, Math.max( 0, ( rain - 0.3 ) / 0.2 ) ), u = w * w * ( 3 - 2 * w );
			this._umbMat.uniforms.umb.value.x = u;
			this._umbMesh.visible = u > 0.01;

		}

		// ---- FP2 (CP-12): the night, for the words on the signs
		const nt = d?.night ? d.night( d.t ).night : 29;
		if ( nt !== this._night ) {

			this._night = nt;
			for ( const m of this.materials ) m.uniforms.cwNight.value = nt;

		}
		this._kernel.dispatch( Math.ceil( this.count / 64 ) );

	}

	// ---- FS1: what the stands watch and do that isn't the mood's (the kernel's fs1 and fsLook):
	// - strike three: seconds since it (Director.champsAt), for each fan's own acts (C4S-2);
	// - God Bless America on the 29th (G29.gba from the split): caps off, facing the flag (C4S-5);
	// - where they look (C4S-3): the plate on a pitch, the ball in play (ballFocus), the pile, the flag in
	//   the song, the infield between times; eased, so heads follow a fly ball a beat behind it.
	_fsUpdate( d, dt, leap ) {

		const U = this.params.fields;
		if ( ! d ) {

			U.fs1.value.set( - 1, 0, 0, 0 );
			U.fsLook.value.z = 0;
			return;

		}

		const champ = d.champsAt ? d.champsAt( d.t ) : null;
		const seg = champ ? champ.seg : d.segmentAt?.( d.t );
		let N = null;
		try { N = d.night ? d.night( d.t ) : null; } catch ( e ) { N = null; }
		const ease = ( a, b, x ) => { const k = Math.min( 1, Math.max( 0, ( x - a ) / ( b - a ) ) ); return k * k * ( 3 - 2 * k ); };
		// the song: up at g0 - 0.5 (Song.js), the caps off a beat later, back on as she finishes
		let sol = 0;
		if ( N && N.back ) {

			const l2 = d.t - N.split, [ g0, g1 ] = G29.gba;
			sol = ease( g0, g0 + 1.5, l2 ) * ( 1 - ease( g1 + 0.3, g1 + 1.8, l2 ) );

		}

		// where they look (the field frame) and how closely
		let lx = 0, lz = - 20, at = 0.45;
		const kind = seg?.kind;
		if ( champ ) { lx = 0; lz = - 18.4; at = 0.8; }
		else if ( sol > 0.01 ) { lx = 0; lz = - 132; at = 1; }
		else if ( N && N.susp ) { lx = 0; lz = - 22; at = 0.35; }
		else if ( kind === 'inplay' || kind === 'result' ) {

			const b = d.ballFocus ?? d.ballAt;
			if ( b ) { lx = b[ 0 ]; lz = b[ 2 ]; }
			else if ( this._lookF ) { lx = this._lookF.x; lz = this._lookF.z; }
			at = 0.95;

		} else if ( kind === 'pitch' || kind === 'walkup' ) { lx = 0; lz = - 7; at = 0.85; }

		const L = this._lookF ||= { x: lx, z: lz, a: at };
		const k = leap ? 1 : 1 - Math.exp( - dt * 3 ), ka = leap ? 1 : 1 - Math.exp( - dt * 1.5 );
		L.x += ( lx - L.x ) * k;
		L.z += ( lz - L.z ) * k;
		L.a += ( at - L.a ) * ka;
		const w = this.toWorld ? this.toWorld( L.x, L.z ) : { x: L.x, z: L.z };
		U.fsLook.value.set( w.x, w.z, L.a, 0 );
		this._sol = ( this._sol || 0 ) + ( sol - ( this._sol || 0 ) ) * ( leap ? 1 : 1 - Math.exp( - dt * 3 ) );
		// the delay: from the tarp going on (a few seconds into the break) to the end of the 27th
		const dl = N && N.delay ? ease( 4, 20, N.lt ) : 0;
		// (C4S-8) the 27th from the 5th on: a few of the open seats already empty, gone under the decks or home
		// (luidude 2981634108, 22:11: empty seats scattered through the lower rows); written only when it
		// changes (Crowd.vacate rewrites every fan's flag)
		const gap = N && N.night === 27 && ! N.susp && ( seg?.snap?.inning || 0 ) >= 5 ? 0.07 : 0;
		if ( ! this._gapTest ) {

			this._gapTest = true;
			this.vacate( ( p ) => {

				if ( ! ( this._gap > 0 ) || ! ( p.cover < 0.5 ) ) return false;
				const s = Math.sin( p.x * 31.7 + p.z * 17.3 + p.y * 5.1 ) * 43758.5453;
				return s - Math.floor( s ) < this._gap;

			} );

		}

		if ( gap !== ( this._gap || 0 ) ) {

			this._gap = gap;
			if ( this._ids ) this._writeIds();

		}

		U.fs1.value.set( champ ? champ.lt : - 1, this._sol, dl, 0 );

	}
	// ---- end FS1

	// A local reaction: the seated fans within r metres of ( x, z ) (the field frame) get up (stand, 0..1)
	// and raise their arms (arms, 0..1), easing off toward the edge; e.g. round the Phanatic dancing on a
	// dugout roof, or where his hot dogs land. By key, up to four at once: call it again to move it, and
	// with null to let them sit back down. The fans rise and settle over a second or so, each by his own
	// threshold (not everyone gets up), and the Rays fans don't.
	focus( key, spec ) {

		const F = this._foci ||= new Map();
		const e = F.get( key );
		if ( spec ) F.set( key, { w: e ? e.w : 0, ...spec, on: true } );
		else if ( e ) e.on = false;

	}

	_focusUpdate( dt ) {

		const F = this._foci;
		if ( ! F || ! F.size && ! this._focusLive ) return;
		const f = new Float32Array( 16 ), m = new Float32Array( 16 ), k = 1 - Math.exp( - dt * 2.5 );
		let i = 0;
		for ( const [ key, e ] of F ) {

			e.w += ( ( e.on ? 1 : 0 ) - e.w ) * k;
			if ( ! e.on && e.w < 0.01 ) {

				F.delete( key );
				continue;

			}

			if ( i >= 4 ) continue;
			const p = this.toWorld ? this.toWorld( e.x, e.z ) : { x: e.x, z: e.z };
			f.set( [ p.x, p.z, e.r || 10, 0 ], i * 4 );
			m.set( [ ( e.stand ?? 0.7 ) * e.w, ( e.arms ?? 0.4 ) * e.w, 0, 0 ], i * 4 );
			i ++;

		}

		this._focusLive = F.size > 0;
		this.params.set( 'focus', f );
		this.params.set( 'focusMood', m );

	}

	// Empty the seats a test picks: test( seat ) with the seat's world position (a Vector3-like {x, y, z})
	// returns true to leave it empty, for a place that puts its own person there (a Cast figure, a
	// featured fan). Any time: applied when the fans are seated, or at once if they are.
	vacate( test ) {

		( this._vacate ||= [] ).push( test );
		if ( this._ids ) this._writeIds();

	}

	_writeIds() {

		const ids = this._ids, seats = this._seats, p = { x: 0, y: 0, z: 0, cover: 0 };
		let n = 0;
		for ( let f = 0; f < this.count; f ++ ) {

			p.x = seats[ f * 4 ];
			p.y = seats[ f * 4 + 1 ];
			p.z = seats[ f * 4 + 2 ];
			p.cover = this._cover ? this._cover[ f ] : 0; // ---- FS1 (C4S-4): under a deck (0..1, _covers())
			const empty = ( this._vacate || [] ).some( ( t ) => t( p ) );
			ids[ f * 4 + 2 ] = empty ? ( ids[ f * 4 + 2 ] | 0x80000000 ) >>> 0 : ids[ f * 4 + 2 ] & 0x7fffffff;
			if ( empty ) n ++;

		}

		this.vacated = n;
		this.idsBuf.write( ids );

	}

	// once the stands are built (the first frame): who each fan is and where he sits, into the buffers
	// the compute pass reads, and the pass itself
	_seat() {

		const ids = new Uint32Array( this.count * 4 ), seats = new Float32Array( this.count * 4 ), fwd = new Float32Array( this.count * 2 );
		const m = new Matrix4(), w = new Matrix4();
		for ( const ch of this.chunks ) {

			const mesh = ch.near, im = mesh.instanceMatrix.array;
			mesh.updateWorldMatrix( true, false );
			for ( let i = 0; i < mesh.count; i ++ ) {

				const f = ch.base + i;
				for ( let k = 0; k < 3; k ++ ) ids[ f * 4 + k ] = ch.ids[ i * 3 + k ];
				ids[ f * 4 + 3 ] = faceOf( ch.ids[ i * 3 ], ch.ids[ i * 3 + 1 ] ); // ---- FF1: his face's weights
				w.multiplyMatrices( mesh.matrixWorld, m.fromArray( im, i * 16 ) );
				// (FP2: which way he faces, for the flashes; FS1: and in the seat's w, as an angle, for his head)
				fwd[ f * 2 ] = - w.elements[ 8 ];
				fwd[ f * 2 + 1 ] = - w.elements[ 10 ];
				seats.set( [ w.elements[ 12 ], w.elements[ 13 ], w.elements[ 14 ], Math.atan2( fwd[ f * 2 ], fwd[ f * 2 + 1 ] ) ], f * 4 );

			}

		}

		this._fwd = fwd;
		this._ids = ids;
		this._seats = seats;
		this._covers(); // ---- FS1 (C4S-4)
		for ( let f = 0; f < this.count; f ++ ) if ( this._cover[ f ] > 0.5 ) seats[ f * 4 + 3 ] += 8; // (FS1: and for the kernel, in the facing angle)
		this.seatsBuf.write( seats );
		this._writeIds();
		// ---- FP2: where home plate is (the world's x, z), for which way the signs face
		const hp = this.toWorld ? this.toWorld( 0, 0 ) : { x: 0, z: 0 };
		for ( const mt of this.materials ) mt.uniforms.cwHome.value.set( hp.x, 0, hp.z, 0 );
		this._flashBuild();
		this._umbrellas(); // ---- FS1 (C4S-8)
		this._kernel = new ComputeKernel( {
			label: 'crowd', modules: [ cwHashModule ], workgroupSize: [ 64, 1, 1 ],
			bindings: {
				cw: { uniform: this.params }, cwIds: { storage: this.idsBuf }, cwSeats: { storage: this.seatsBuf },
				cwPoseBuf: { storage: this.poseBuf, access: 'read_write' }, cwLookBuf: { storage: this.lookBuf, access: 'read_write' },
			},
			code: kernelCode,
		} );

	}

	// ---- FS1 (C4S-4): which seats are under a deck (the overhang of the level above: its seats over his
	// head, 3.5 m or more up, within a couple of metres), 0..1, for who stays in the rain delay (Seats.js:
	// those under cover stay, the open rows empty, low and high; Getty 83458502, the 3B field level nearly
	// empty, the stayers under the overhangs and in the aisles). A grid of the highest seat per 2 m cell
	_covers() {

		const S = this._seats, n = this.count, cell = 2, top = new Map();
		const key = ( ix, iz ) => ix * 65536 + iz;
		for ( let f = 0; f < n; f ++ ) {

			const k = key( Math.floor( S[ f * 4 ] / cell ), Math.floor( S[ f * 4 + 2 ] / cell ) );
			const y = S[ f * 4 + 1 ];
			if ( ! ( top.get( k ) >= y ) ) top.set( k, y );

		}

		const cover = this._cover = new Float32Array( n );
		for ( let f = 0; f < n; f ++ ) {

			const ix = Math.floor( S[ f * 4 ] / cell ), iz = Math.floor( S[ f * 4 + 2 ] / cell ), y = S[ f * 4 + 1 ];
			let hit = 0;
			for ( let a = - 1; a <= 1; a ++ ) for ( let b = - 1; b <= 1; b ++ ) {

				const t = top.get( key( ix + a, iz + b ) );
				if ( t !== undefined && t > y + 3.5 ) hit ++;

			}

			cover[ f ] = Math.min( 1, hit / 3 );

		}

	}
	// ---- end FS1

	// ---- FS1 (C4S-8): umbrellas over the open seats in the 27th's rain (Getty 83458180: a black-and-white
	// one up in the middle of the section behind the 3B dugout; luidude 2981634108: three behind the
	// Phillies' dugout from above). About one fan in seventy out in the open (not under a deck), the same
	// ones the kernel gives the raised right hand: an eight-gore canopy about a metre across on its shaft
	// in that hand, red, black, black and white, golf-striped or navy, tipped a little into the wind toward
	// the field. One draw, placed on the GPU from his pose (sat or stood, his build), folded away when it
	// isn't raining or his seat's empty
	_umbrellas() {

		const n = this.count, S = this._seats, Fw = this._fwd, C = this._cover;
		if ( ! n || this._umbMesh ) return;
		const pos = [], nrm = [], col = [], seat = [], dir = [], index = [];
		const RED = [ 0.36, 0.02, 0.03 ], BLK = [ 0.02, 0.02, 0.022 ], WHT = [ 0.62, 0.62, 0.6 ], NAVY = [ 0.015, 0.02, 0.07 ], YEL = [ 0.6, 0.45, 0.03 ];
		const STYLES = [ [ RED ], [ BLK ], [ BLK, WHT ], [ RED, WHT, NAVY, YEL ], [ NAVY ], [ RED, WHT ] ];
		const R = 0.5, AP = 0.9, RIM = 0.6, G = 8;
		const fans = [];
		let m = 0;
		for ( let f = 0; f < n; f ++ ) {

			if ( C[ f ] > 0.5 || pcg( ( f * 7 + 3 ) >>> 0 ) / 4294967296 >= UMBRELLA_SHARE ) continue;
			if ( ( this._ids[ f * 4 + 2 ] >> 18 ) & 1 ) continue;
			const fl = Math.hypot( Fw[ f * 2 ], Fw[ f * 2 + 1 ] ) || 1;
			const st = STYLES[ pcg( f * 13 + 5 ) % STYLES.length ], tw = ( pcg( f * 17 + 1 ) / 4294967296 ) * Math.PI;
			const add = ( p, nn, c ) => {

				pos.push( ...p );
				nrm.push( ...nn );
				col.push( ...c );
				seat.push( S[ f * 4 ], S[ f * 4 + 1 ], S[ f * 4 + 2 ], f );
				dir.push( Fw[ f * 2 ] / fl, Fw[ f * 2 + 1 ] / fl, 0, 0 );
				return pos.length / 3 - 1;

			};
			// the canopy: each gore from the tip to its two ribs, sagging between them
			for ( let g = 0; g < G; g ++ ) {

				const a0 = tw + g / G * Math.PI * 2, a1 = tw + ( g + 1 ) / G * Math.PI * 2, am = ( a0 + a1 ) / 2;
				const c = st[ g % st.length ];
				const r0 = [ R * Math.cos( a0 ), RIM, R * Math.sin( a0 ) ], r1 = [ R * Math.cos( a1 ), RIM, R * Math.sin( a1 ) ], mid = [ R * 0.9 * Math.cos( am ), RIM + 0.05, R * 0.9 * Math.sin( am ) ];
				const nn = [ Math.cos( am ) * 0.55, 0.83, Math.sin( am ) * 0.55 ];
				const i0 = add( [ 0, AP, 0 ], [ 0, 1, 0 ], c ), i1 = add( r0, nn, c ), i2 = add( mid, nn, c ), i3 = add( r1, nn, c );
				index.push( i0, i1, i2, i0, i2, i3 );

			}

			// the shaft, two crossed strips, the tip through the top
			for ( const [ ux, uz ] of [ [ 0.007, 0 ], [ 0, 0.007 ] ] ) {

				const q = [ add( [ - ux, - 0.06, - uz ], [ uz, 0, ux ], BLK ), add( [ ux, - 0.06, uz ], [ uz, 0, ux ], BLK ), add( [ ux, AP + 0.06, uz ], [ uz, 0, ux ], BLK ), add( [ - ux, AP + 0.06, - uz ], [ uz, 0, ux ], BLK ) ];
				index.push( q[ 0 ], q[ 1 ], q[ 2 ], q[ 0 ], q[ 2 ], q[ 3 ] );

			}

			fans.push( f );
			m ++;

		}

		if ( ! m ) return;
		const g = new BufferGeometry();
		g.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
		g.setAttribute( 'normal', new Float32BufferAttribute( nrm, 3 ) );
		g.setAttribute( 'color', new Float32BufferAttribute( col, 3 ) );
		g.setAttribute( 'aSeat', new Float32BufferAttribute( seat, 4 ) );
		g.setAttribute( 'aDir', new Float32BufferAttribute( dir, 4 ) );
		g.setIndex( index );
		const hand = ( base, face ) => base.hand.map( ( v, k ) => v + ( face.hand[ k ] - v ) * UMBRELLA_FACE );
		const mat = this._umbMat = standard( {
			name: 'crowd-umbrellas', color: new Color( 1, 1, 1 ), roughness: 0.3, side: 'double', vertexColors: true,
			uniforms: { umb: [ 'vec4f', new Vector4( 0, 0, 0, 0 ) ] },
			storage: { cwPoseBuf: this.poseBuf },
			attributes: { aSeat: 'vec4f', aDir: 'vec4f' },
			vertex: /* wgsl */`
	// (the gores' color is the geometry's own, per vertex)
	let fi = u32( v.aSeat.w + 0.5 );
	let b = fi * ${ POSE_N * 2 }u;
	let st = cwPoseBuf[ b ].x;
	let r3 = cwPoseBuf[ b + 3u ];
	let flags = u32( r3.w + 0.5 );
	let on = mat.umb.x * select( 1.0, 0.0, ( flags & 4095u ) == 0u );
	// his right hand (brought up to the chest: the kernel's UMBRELLA_FACE), his build and size
	let hand = mix( ${ f3( hand( SIT, SIT_FACE ) ) }, ${ f3( hand( STAND, STAND_FACE ) ) }, st ) * vec3f( r3.x, 1.0, 1.0 ) * r3.y;
	let fw = vec3f( v.aDir.x, 0.0, v.aDir.y );
	let rt = vec3f( - v.aDir.y, 0.0, v.aDir.x );
	// opened up from the grip, tipped toward the field (into the wind off the outfield)
	let lp = v.position * on;
	let tip = 0.14 * lp.y;
	let wp = v.aSeat.xyz + rt * ( hand.x + lp.x ) + vec3f( 0.0, hand.y + lp.y, 0.0 ) - fw * ( hand.z + lp.z ) + fw * tip;
	v.useWorld = true;
	v.worldPos = select( v.aSeat.xyz, wp, on > 0.01 );
	v.worldNormal = normalize( rt * v.normal.x + vec3f( 0.0, v.normal.y, 0.0 ) - fw * v.normal.z + fw * 0.14 * v.normal.y );
	v.prevWorldPos = v.worldPos;
`,
		} );
		mat.underwaterLighting = 'none';
		const mesh = this._umbMesh = new Mesh( g, mat );
		mesh.name = 'crowd-umbrellas';
		mesh.frustumCulled = false;
		mesh.castShadow = false;
		mesh.receiveShadow = true;
		mesh.userData.dynamic = true;
		mesh.visible = false;
		let root = this.chunks[ 0 ].near;
		while ( root.parent ) root = root.parent;
		root.add( mesh );
		this.umbrellas = { mesh, count: m, fans };

	}
	// ---- end FS1

	// ---- FP2 (C2B-16): the point-and-shoots' flashes. In 2008 every big moment of a night game went off
	// in camera flashes all round the bowl (FOX's center field frame of the last pitch has one behind the
	// plate; Getty 83486198, the 2-2 to Hinske, shows the stands specked white). FLASHES fans (three times
	// as many round the infield as in the outfield, nine times behind the plate, the TV's backdrop) each
	// hold a flash that fires now and then: a sprite at his face, a few pixels across however long the
	// lens, on for ~0.1 s. One draw,
	// all on the GPU from the crowd's clock and a share going off (update()); no CPU per fan. Up close
	// (under 9 m) there are none, the place's own figures and the seated fans' cameras do it; nor on the
	// seats a place has its own people in, under 30 m (no camera in his hands there).
	_flashBuild() {

		const n = this.count, S = this._seats, Fw = this._fwd;
		if ( ! n || this._flashes ) return;
		const h = ( i, k ) => {

			const s = Math.sin( i * 12.9898 + k * 78.233 ) * 43758.5453;
			return s - Math.floor( s );

		};
		// home plate and center field (the world's x, z), for where each seat is round the field
		const o = this.toWorld ? this.toWorld( 0, 0 ) : { x: 0, z: 0 }, c = this.toWorld ? this.toWorld( 0, - 1 ) : { x: 0, z: - 1 };
		const cx = c.x - o.x, cz = c.z - o.z;
		const wt = new Float32Array( n );
		let sum = 0;
		for ( let f = 0; f < n; f ++ ) {

			const dx = S[ f * 4 ] - o.x, dz = S[ f * 4 + 2 ] - o.z, l = Math.hypot( dx, dz ) || 1;
			// (the infield's stands three times the outfield's; behind the plate, the TV's backdrop, nine)
			const along = ( dx * cx + dz * cz ) / l;
			const t = Math.min( 1, Math.max( 0, ( 0.55 - along ) / 0.8 ) ), b = Math.min( 1, Math.max( 0, ( - 0.8 - along ) / 0.12 ) );
			wt[ f ] = 1 + 2 * t * t * ( 3 - 2 * t ) + 10 * b * b * ( 3 - 2 * b );
			sum += wt[ f ];

		}

		const pos = [], seat = [], dir = [], rnd = [], index = [];
		let m = 0;
		for ( let f = 0; f < n && m < FLASHES; f ++ ) {

			if ( h( f, 1 ) >= wt[ f ] / sum * FLASHES ) continue;
			const fl = Math.hypot( Fw[ f * 2 ], Fw[ f * 2 + 1 ] ) || 1;
			// each its own pace (one every 1.7 to 4 s, a share of them fired), its own phase
			const fr = 0.3 + 0.5 * h( f, 2 ), ph = h( f, 3 ), hh = h( f, 4 );
			for ( const [ x, y ] of [ [ - 1, - 1 ], [ 1, - 1 ], [ 1, 1 ], [ - 1, 1 ] ] ) {

				pos.push( S[ f * 4 ], S[ f * 4 + 1 ], S[ f * 4 + 2 ] );
				seat.push( S[ f * 4 ], S[ f * 4 + 1 ], S[ f * 4 + 2 ], f );
				dir.push( Fw[ f * 2 ] / fl, Fw[ f * 2 + 1 ] / fl, x, y );
				rnd.push( fr, ph, hh, 0 );

			}

			index.push( m * 4, m * 4 + 1, m * 4 + 2, m * 4, m * 4 + 2, m * 4 + 3 );
			m ++;

		}

		const g = new BufferGeometry();
		g.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
		g.setAttribute( 'aSeat', new Float32BufferAttribute( seat, 4 ) );
		g.setAttribute( 'aDir', new Float32BufferAttribute( dir, 4 ) );
		g.setAttribute( 'aRnd', new Float32BufferAttribute( rnd, 4 ) );
		g.setIndex( index );
		g.boundingSphere = null;
		const mat = this._flashMat = standard( {
			name: 'crowd-flashes', color: new Color( 1, 1, 1 ), transparent: true, depthWrite: false, side: 'double', lit: false, blending: 'additive',
			uniforms: { flash: [ 'vec4f', new Vector4( 0, 0, 0.0015, 0 ) ] },
			storage: { cwPoseBuf: this.poseBuf },
			attributes: { aSeat: 'vec4f', aDir: 'vec4f', aRnd: 'vec4f' },
			varyings: { vA: 'f32', vUV: 'vec2f' },
			vertex: /* wgsl */`
	let fi = u32( v.aSeat.w + 0.5 );
	let b = fi * ${ POSE_N * 2 }u;
	let st = cwPoseBuf[ b ].x;
	let flags = u32( cwPoseBuf[ b + 3u ].w + 0.5 );
	// this flash's turn: fired or not this time round (a share of them, mat.flash.x), on for ~70 ms
	let cyc = mat.flash.y * v.aRnd.x + v.aRnd.y;
	let fired = fract( sin( ( floor( cyc ) + v.aRnd.z * 131.0 ) * 12.9898 ) * 43758.5453 ) < mat.flash.x;
	let ft = fract( cyc ) / v.aRnd.x;
	var a = select( 0.0, 1.0 - smoothstep( 0.07, 0.12, ft ), fired );
	// (QA: mat.flash.w 1 lights them all)
	if ( mat.flash.w > 0.5 ) { a = 1.0; }
	// at his face, a hand in front of it, sat or stood
	let p = v.aSeat.xyz + vec3f( v.aDir.x, 0.0, v.aDir.y ) * 0.22 + vec3f( 0.0, mix( 1.12, 1.6, st ), 0.0 );
	let toCam = frame.cameraPos - p;
	let d = length( toCam );
	if ( d < 9.0 || ( ( flags & 4095u ) == 0u && d < 30.0 ) ) { a = 0.0; }
	let tc = toCam / max( d, 0.001 );
	let rt = normalize( cross( vec3f( 0.0, 1.0, 0.0 ), tc ) );
	let up = cross( tc, rt );
	let r = max( 0.14, d * mat.flash.z * 6.0 ) * step( 0.001, a );
	let q = p + ( rt * v.aDir.z + up * v.aDir.w ) * r;
	v.useWorld = true;
	v.worldPos = q;
	v.worldNormal = tc;
	v.prevWorldPos = q;
	o.vA = a;
	o.vUV = v.aDir.zw;
`,
			surface: /* wgsl */`
	// a hard white core and a soft glow round it (the bloom does the rest)
	let r2 = dot( in.vs.vUV, in.vs.vUV );
	let k = exp( - r2 * 30.0 ) + exp( - r2 * 7.0 ) * 0.25 + exp( - r2 * 2.0 ) * 0.05;
	s.albedo = vec3f( 0.93, 0.96, 1.0 ) * 40.0 * k * in.vs.vA * mix( 0.35, 1.0, smoothstep( 0.15, 0.7, frame.night ) );
	s.alpha = clamp( in.vs.vA * k * 4.0, 0.0, 1.0 );
`,
		} );
		mat.underwaterLighting = 'none';
		const mesh = this._flashes = new Mesh( g, mat );
		mesh.name = 'crowd-flashes';
		mesh.frustumCulled = false;
		mesh.castShadow = false;
		mesh.layers.set( 2 );
		mesh.userData.dynamic = true;
		mesh.visible = false;
		// (the seats are in the world's frame: the scene's root)
		let root = this.chunks[ 0 ].near;
		while ( root.parent ) root = root.parent;
		root.add( mesh );
		this.flashes = { mesh, count: m, shown: () => ( { sprites: m, rate: + mat.uniforms.flash.value.x.toFixed( 3 ), visible: mesh.visible } ) };

	}

}
