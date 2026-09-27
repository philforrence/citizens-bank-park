import { InstancedMesh, BufferGeometry, Float32BufferAttribute, InstancedBufferAttribute, Matrix4, Quaternion, Vector3 } from '../engine/index.js';
import { standard } from '../materials/Materials.js';

// The people at field level who aren't in the game: the benches in both dugouts (players in their team
// jackets or in uniform, the coaches, the bat boys), the relievers in the bullpens, the TV camera
// operators and the photographers in their wells, the ball kids on their stools down the lines and the
// grounds crew. Low-poly figures in the style of People.js (tubes between joints, an ellipsoid head, a
// cap's brim), but posed: standing, leaning on the rail, sitting on the bench (upright, forward with the
// elbows on the knees, arms folded), at a TV camera, behind a long lens, pushing the tarp.
//
// One InstancedMesh per pose; who a figure is (the outfit) comes from a per-instance attribute the shader
// reads. Figures can be shown, hidden (the Phillies' bench empties onto the field at the last out) and
// moved (the crew with the tarp).
//
//   const figs = new FieldFigures( parent );
//   const f = figs.add( 'sit', { x, y, z, yaw, outfit: OUTFIT.phiJacket, group: 'phiBench' } );
//   figs.build();  figs.setGroup( 'phiBench', false );  figs.move( f, x, y, z, yaw );  figs.commit();

export const OUTFIT = {
	phiJacket: 0, // Phillies red pullover jacket (the script on the chest), white pinstripe pants, red cap
	phiUniform: 1, // Phillies home whites, red undershirt sleeves, red cap
	rayJacket: 2, // Rays navy jacket, road grey pants, navy cap
	rayUniform: 3, // Rays road greys, navy undershirt, navy cap
	crew: 4, // grounds crew: navy rain suit, hood up, dark trousers
	camera: 5, // a TV cameraman: black rain shell, a headset, a black cap
	photog: 6, // a photographer: dark parka, khakis, credential on a lanyard
	ballKid: 7, // ball kids: Phillies red windbreaker, white pants, red cap, a glove
	batBoy: 8, // bat boy: Phillies uniform, red batting helmet
	coachPhi: 9, // Phillies coach: red satin jacket, white pants, red cap (Charlie Manuel's big frame via scale)
	coachRay: 10, // Rays coach / Maddon: navy jacket, grey pants, navy cap, glasses
	sound: 11, // the parabolic microphone's sound man: grey hooded rain jacket, big headphones
};

// joints for the right side (+x); the left mirrors x unless the pose gives it its own ( 'L:' prefix)
const BASE = {
	hip: [ 0.1, 0.9, 0.0 ], knee: [ 0.11, 0.5, - 0.02 ], ankle: [ 0.12, 0.08, 0.0 ], toe: [ 0.13, 0.04, - 0.15 ],
	pelvis: [ 0, 0.88, 0.02 ], chest: [ 0, 1.38, 0.03 ], neck: [ 0, 1.45, 0.03 ], head: [ 0, 1.58, 0.02 ],
	shoulder: [ 0.2, 1.37, 0.03 ], elbow: [ 0.23, 1.1, 0.06 ], wrist: [ 0.22, 0.86, 0.02 ], hand: [ 0.21, 0.77, 0.01 ],
};

const sitPose = ( H, upper ) => ( {
	pelvis: [ 0, H + 0.12, 0.06 ], hip: [ 0.1, H + 0.1, 0.03 ], knee: [ 0.13, H + 0.08, - 0.4 ], ankle: [ 0.14, 0.08, - 0.44 ], toe: [ 0.15, 0.04, - 0.58 ],
	'L:knee': [ - 0.12, H + 0.07, - 0.41 ], 'L:ankle': [ - 0.13, 0.08, - 0.4 ], 'L:toe': [ - 0.14, 0.04, - 0.54 ],
	...upper( H ),
} );

export const POSES = {
	stand: {},
	// hands in the jacket's pockets, weight on one leg
	pockets: {
		elbow: [ 0.25, 1.1, 0.02 ], wrist: [ 0.17, 0.95, - 0.1 ], hand: [ 0.14, 0.92, - 0.13 ],
		'L:knee': [ - 0.1, 0.5, - 0.06 ], 'L:ankle': [ - 0.15, 0.08, - 0.05 ], 'L:toe': [ - 0.2, 0.04, - 0.18 ],
	},
	// forearms folded on a rail at chest height (1.3 m above his feet, just in front of him)
	lean: {
		pelvis: [ 0, 0.88, 0.06 ], hip: [ 0.1, 0.9, 0.06 ], chest: [ 0, 1.34, - 0.08 ], neck: [ 0, 1.41, - 0.11 ], head: [ 0, 1.53, - 0.16 ],
		shoulder: [ 0.2, 1.33, - 0.08 ], elbow: [ 0.25, 1.3, - 0.3 ], wrist: [ - 0.02, 1.33, - 0.36 ], hand: [ - 0.1, 1.33, - 0.35 ],
		'L:elbow': [ - 0.25, 1.32, - 0.29 ], 'L:wrist': [ 0.03, 1.35, - 0.33 ], 'L:hand': [ 0.11, 1.35, - 0.32 ],
	},
	// both hands on the rail, arms straight, looking out
	rail: {
		chest: [ 0, 1.37, - 0.04 ], neck: [ 0, 1.44, - 0.06 ], head: [ 0, 1.56, - 0.09 ],
		shoulder: [ 0.2, 1.36, - 0.04 ], elbow: [ 0.25, 1.18, - 0.2 ], wrist: [ 0.26, 1.02, - 0.34 ], hand: [ 0.26, 0.98, - 0.4 ],
	},
	// on the bench, upright, hands on his thighs (the seat 0.46 m up)
	sit: sitPose( 0.46, ( H ) => ( {
		chest: [ 0, H + 0.6, 0.1 ], neck: [ 0, H + 0.67, 0.1 ], head: [ 0, H + 0.79, 0.08 ],
		shoulder: [ 0.2, H + 0.58, 0.1 ], elbow: [ 0.24, H + 0.34, 0.02 ], wrist: [ 0.19, H + 0.18, - 0.2 ], hand: [ 0.17, H + 0.15, - 0.28 ],
	} ) ),
	// on the bench leaning forward, elbows on his knees
	sitFwd: sitPose( 0.46, ( H ) => ( {
		chest: [ 0, H + 0.52, - 0.1 ], neck: [ 0, H + 0.59, - 0.15 ], head: [ 0, H + 0.69, - 0.22 ],
		shoulder: [ 0.2, H + 0.5, - 0.1 ], elbow: [ 0.16, H + 0.14, - 0.36 ], wrist: [ 0.07, H + 0.24, - 0.5 ], hand: [ 0.03, H + 0.28, - 0.55 ],
	} ) ),
	// on the bench, sitting back, arms folded
	sitFold: sitPose( 0.46, ( H ) => ( {
		chest: [ 0, H + 0.6, 0.13 ], neck: [ 0, H + 0.67, 0.14 ], head: [ 0, H + 0.79, 0.13 ],
		shoulder: [ 0.2, H + 0.58, 0.13 ], elbow: [ 0.23, H + 0.36, 0.0 ], wrist: [ - 0.06, H + 0.42, - 0.1 ], hand: [ - 0.14, H + 0.43, - 0.08 ],
		'L:elbow': [ - 0.23, H + 0.37, 0.0 ], 'L:wrist': [ 0.06, H + 0.44, - 0.1 ], 'L:hand': [ 0.14, H + 0.45, - 0.08 ],
	} ) ),
	// on a stool (0.62 m), hands on the knees: a ball kid
	stool: sitPose( 0.62, ( H ) => ( {
		chest: [ 0, H + 0.56, 0.02 ], neck: [ 0, H + 0.63, 0.0 ], head: [ 0, H + 0.75, - 0.03 ],
		shoulder: [ 0.2, H + 0.54, 0.02 ], elbow: [ 0.24, H + 0.3, - 0.12 ], wrist: [ 0.18, H + 0.14, - 0.33 ], hand: [ 0.16, H + 0.1, - 0.39 ],
	} ) ),
	// on a low stool with a long lens up to his eye, elbows in
	photo: sitPose( 0.5, ( H ) => ( {
		chest: [ 0, H + 0.55, - 0.04 ], neck: [ 0, H + 0.62, - 0.07 ], head: [ 0, H + 0.73, - 0.1 ],
		shoulder: [ 0.2, H + 0.53, - 0.04 ], elbow: [ 0.18, H + 0.36, - 0.26 ], wrist: [ 0.08, H + 0.6, - 0.34 ], hand: [ 0.06, H + 0.64, - 0.32 ],
		'L:elbow': [ - 0.2, H + 0.34, - 0.3 ], 'L:wrist': [ - 0.07, H + 0.52, - 0.5 ], 'L:hand': [ - 0.03, H + 0.55, - 0.56 ],
	} ) ),
	// at a TV camera on a pedestal in front of him: his eye to the viewfinder, the left hand on the lens'
	// zoom, the right on the pan bar
	camera: {
		chest: [ 0, 1.36, - 0.03 ], neck: [ 0, 1.43, - 0.06 ], head: [ 0, 1.54, - 0.1 ],
		shoulder: [ 0.2, 1.35, - 0.03 ], elbow: [ 0.32, 1.1, - 0.08 ], wrist: [ 0.38, 1.05, - 0.28 ], hand: [ 0.38, 1.05, - 0.36 ],
		'L:elbow': [ - 0.27, 1.14, - 0.22 ], 'L:wrist': [ - 0.18, 1.24, - 0.45 ], 'L:hand': [ - 0.15, 1.26, - 0.53 ],
	},
	// pushing the rolled tarp across the infield: leaning into it, one foot back
	push: {
		pelvis: [ 0, 0.84, 0.14 ], hip: [ 0.1, 0.84, 0.14 ], knee: [ 0.11, 0.5, - 0.12 ], ankle: [ 0.12, 0.08, - 0.2 ], toe: [ 0.13, 0.04, - 0.35 ],
		'L:knee': [ - 0.11, 0.47, 0.34 ], 'L:ankle': [ - 0.12, 0.12, 0.6 ], 'L:toe': [ - 0.13, 0.03, 0.5 ],
		chest: [ 0, 1.24, - 0.24 ], neck: [ 0, 1.3, - 0.31 ], head: [ 0, 1.4, - 0.4 ],
		shoulder: [ 0.2, 1.24, - 0.24 ], elbow: [ 0.22, 1.05, - 0.5 ], wrist: [ 0.2, 0.95, - 0.7 ], hand: [ 0.19, 0.93, - 0.78 ],
	},
	// the relievers' catcher in the pen, down in his crouch
	crouch: {
		pelvis: [ 0, 0.5, 0.12 ], hip: [ 0.12, 0.5, 0.1 ], knee: [ 0.24, 0.52, - 0.3 ], ankle: [ 0.2, 0.08, 0.02 ], toe: [ 0.22, 0.04, - 0.12 ],
		chest: [ 0, 0.95, 0.0 ], neck: [ 0, 1.02, - 0.03 ], head: [ 0, 1.13, - 0.07 ],
		shoulder: [ 0.2, 0.94, 0.0 ], elbow: [ 0.28, 0.72, - 0.22 ], wrist: [ 0.2, 0.7, - 0.42 ], hand: [ 0.17, 0.7, - 0.48 ],
	},
};

const PART = { top: 0, pants: 1, skin: 2, head: 3, brim: 4, shoe: 5 };

function jointsOf( pose ) {

	const P = POSES[ pose ];
	return ( name, s ) => {

		const own = s < 0 ? P[ 'L:' + name ] : null;
		if ( own ) return own;
		const j = P[ name ] || BASE[ name ];
		return [ j[ 0 ] * ( j[ 0 ] ? s : 1 ), j[ 1 ], j[ 2 ] ];

	};

}

function figureGeometry( pose ) {

	const J = jointsOf( pose );
	const pos = [], nrm = [], part = [], index = [];
	const sub = ( a, b ) => [ a[ 0 ] - b[ 0 ], a[ 1 ] - b[ 1 ], a[ 2 ] - b[ 2 ] ];
	const add = ( a, b ) => [ a[ 0 ] + b[ 0 ], a[ 1 ] + b[ 1 ], a[ 2 ] + b[ 2 ] ];
	const mul = ( a, k ) => [ a[ 0 ] * k, a[ 1 ] * k, a[ 2 ] * k ];
	const cross = ( a, b ) => [ a[ 1 ] * b[ 2 ] - a[ 2 ] * b[ 1 ], a[ 2 ] * b[ 0 ] - a[ 0 ] * b[ 2 ], a[ 0 ] * b[ 1 ] - a[ 1 ] * b[ 0 ] ];
	const norm = ( a ) => mul( a, 1 / ( Math.hypot( ...a ) || 1 ) );
	const vert = ( p, n, pt ) => {

		pos.push( ...p ); nrm.push( ...n ); part.push( pt );
		return pos.length / 3 - 1;

	};

	// a tapered tube from joint a to joint b: rings of n, radii [ across, depth ] at each end
	const tube = ( a, b, rA, rB, pt, n = 6, capA = false, capB = false ) => {

		const ax = norm( sub( b, a ) );
		let across = cross( ax, [ 0, 0, 1 ] );
		if ( Math.hypot( ...across ) < 0.3 ) across = cross( ax, [ 0, 1, 0 ] );
		across = norm( across );
		const depth = norm( cross( across, ax ) );
		const base = pos.length / 3;
		for ( const [ c, r ] of [ [ a, rA ], [ b, rB ] ] ) for ( let k = 0; k < n; k ++ ) {

			const ang = ( k / n ) * Math.PI * 2 + Math.PI / n;
			const d = add( mul( across, Math.cos( ang ) ), mul( depth, Math.sin( ang ) ) );
			vert( add( c, add( mul( across, Math.cos( ang ) * r[ 0 ] ), mul( depth, Math.sin( ang ) * r[ 1 ] ) ) ), d, pt );

		}

		for ( let k = 0; k < n; k ++ ) {

			const i0 = base + k, i1 = base + ( k + 1 ) % n, j0 = base + n + k, j1 = base + n + ( k + 1 ) % n;
			index.push( i0, i1, j0, i1, j1, j0 );

		}

		if ( capA ) {

			const c = vert( a, mul( ax, - 1 ), pt );
			for ( let k = 0; k < n; k ++ ) index.push( c, base + ( k + 1 ) % n, base + k );

		}

		if ( capB ) {

			const c = vert( b, ax, pt );
			for ( let k = 0; k < n; k ++ ) index.push( c, base + n + k, base + n + ( k + 1 ) % n );

		}

	};

	// the trunk: hips to chest, chest to the neck; the shoulders' yoke across
	const pelvis = J( 'pelvis', 1 ), chest = J( 'chest', 1 ), neck = J( 'neck', 1 );
	tube( add( pelvis, [ 0, - 0.06, 0 ] ), chest, [ 0.17, 0.12 ], [ 0.2, 0.12 ], PART.top, 8, true );
	tube( chest, neck, [ 0.2, 0.12 ], [ 0.06, 0.055 ], PART.top, 8 );
	tube( J( 'shoulder', - 1 ), J( 'shoulder', 1 ), [ 0.07, 0.07 ], [ 0.07, 0.07 ], PART.top, 6, true, true );
	tube( neck, add( neck, [ 0, 0.07, 0 ] ), [ 0.055, 0.05 ], [ 0.05, 0.048 ], PART.skin, 6 );
	for ( const s of [ - 1, 1 ] ) {

		tube( J( 'shoulder', s ), J( 'elbow', s ), [ 0.062, 0.062 ], [ 0.052, 0.052 ], PART.top );
		tube( J( 'elbow', s ), J( 'wrist', s ), [ 0.052, 0.052 ], [ 0.043, 0.043 ], PART.top );
		tube( J( 'wrist', s ), J( 'hand', s ), [ 0.036, 0.022 ], [ 0.032, 0.02 ], PART.skin, 5, false, true );
		tube( J( 'hip', s ), J( 'knee', s ), [ 0.088, 0.088 ], [ 0.062, 0.062 ], PART.pants, 6, true );
		tube( J( 'knee', s ), J( 'ankle', s ), [ 0.06, 0.06 ], [ 0.048, 0.048 ], PART.pants );
		// the shoe: ankle to toe
		tube( add( J( 'ankle', s ), [ 0, - 0.03, 0.04 ] ), J( 'toe', s ), [ 0.05, 0.045 ], [ 0.042, 0.03 ], PART.shoe, 5, true, true );

	}

	// the head, and a cap's brim over the face (the shader leaves the brim off the helmeted and hooded)
	const hc = J( 'head', 1 );
	const fwd = norm( [ 0, 0, - 1 ] );
	{

		const W = 9, H = 6, r = [ 0.083, 0.105, 0.1 ];
		const first = pos.length / 3;
		for ( let j = 0; j <= H; j ++ ) for ( let i = 0; i < W; i ++ ) {

			const th = j / H * Math.PI, ph = i / W * Math.PI * 2;
			const d = [ Math.sin( th ) * Math.cos( ph ), Math.cos( th ), Math.sin( th ) * Math.sin( ph ) ];
			vert( add( hc, [ d[ 0 ] * r[ 0 ], d[ 1 ] * r[ 1 ], d[ 2 ] * r[ 2 ] ] ), d, PART.head );

		}

		for ( let j = 0; j < H; j ++ ) for ( let i = 0; i < W; i ++ ) {

			const a = first + j * W + i, b = first + j * W + ( i + 1 ) % W, c = a + W, d = b + W;
			if ( j > 0 ) index.push( a, b, c );
			if ( j < H - 1 ) index.push( b, d, c );

		}

		const f = fwd;
		const brim = [ [ - 0.078, 0.055, - 0.05 ], [ 0.078, 0.055, - 0.05 ], [ 0.07, 0.04, - 0.165 ], [ - 0.07, 0.04, - 0.165 ] ].map( ( o ) => vert( add( hc, o ), [ 0, 1, 0 ], PART.brim ) );
		index.push( brim[ 0 ], brim[ 2 ], brim[ 1 ], brim[ 0 ], brim[ 3 ], brim[ 2 ] );
		void f;

	}

	const g = new BufferGeometry();
	g.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
	g.setAttribute( 'normal', new Float32BufferAttribute( nrm, 3 ) );
	g.setAttribute( 'aPart', new Float32BufferAttribute( part, 1 ) );
	g.setIndex( index );
	g.computeBoundingSphere();
	g.userData.head = hc;
	return g;

}

function figureMaterial() {

	const m = standard( {
		name: 'field-figures', roughness: 0.75, side: 'double',
		attributes: { aPart: 'f32', aWho: 'vec4f' },
		varyings: { vPart: 'f32', vWho: 'vec4f', vLocal: 'vec3f' },
		vertex: /* wgsl */`
	// who: x the outfit, y a seed, z wet (the rain on him, 0..1), w unused
	let who = v.aWho;
	var p = v.position;
	let seed = who.y;
	// a padded jacket or a rain suit stands a little off the body
	let oi = i32( who.x + 0.5 );
	let puffy = oi != 1 && oi != 3 && oi != 8;
	if ( puffy && v.aPart < 0.5 ) { p += v.normal * 0.018; }
	// a small idle sway: breathing, shifting his weight
	let sway = sin( frame.time * ( 0.5 + 0.3 * seed ) + seed * 40.0 );
	p.x += sway * 0.012 * max( p.y - 0.5, 0.0 );
	p.y += sin( frame.time * 1.7 + seed * 17.0 ) * 0.004 * step( 0.9, p.y );
	o.vPart = v.aPart;
	o.vWho = who;
	o.vLocal = p;
	v.position = p;
`,
		surface: /* wgsl */`
	let part = i32( in.vs.vPart + 0.01 );
	let who = in.vs.vWho;
	let o = i32( who.x + 0.5 );
	let seed = who.y;
	let wet = who.z;
	let L = in.vs.vLocal;
	let h = fract( sin( vec4f( seed * 12.9898, seed * 78.233, seed * 39.346, seed * 11.135 ) ) * 43758.5453 );
	let red = vec3f( 0.42, 0.018, 0.028 );
	let navy = vec3f( 0.012, 0.02, 0.06 );
	let white = vec3f( 0.72, 0.71, 0.68 );
	let grey = vec3f( 0.28, 0.28, 0.29 );
	var top = red;
	var pants = white;
	var capC = red;
	var shoe = vec3f( 0.02 );
	var rough = 0.8;
	var capped = true;
	var hood = false;
	var helmet = false;
	// the pinstripes on the Phillies' whites, the script across a jacket's chest
	var pin = false;
	if ( o == 0 ) { top = red; pants = white; pin = true; }
	if ( o == 1 ) { top = white; pants = white; pin = true; }
	if ( o == 2 ) { top = navy; pants = grey; capC = navy; }
	if ( o == 3 ) { top = grey; pants = grey; capC = navy; }
	if ( o == 4 ) { top = vec3f( 0.02, 0.03, 0.07 ); pants = vec3f( 0.03, 0.03, 0.035 ); capC = top; hood = h.x > 0.3; rough = 0.45; shoe = vec3f( 0.05, 0.04, 0.03 ); }
	if ( o == 5 ) { top = vec3f( 0.012 ); pants = vec3f( 0.02, 0.022, 0.03 ); capC = vec3f( 0.01 ); rough = 0.5; capped = h.y > 0.3; }
	if ( o == 6 ) { top = select( vec3f( 0.03, 0.035, 0.03 ), vec3f( 0.06, 0.07, 0.1 ), h.x > 0.5 ); pants = vec3f( 0.3, 0.25, 0.17 ); capC = vec3f( 0.02, 0.03, 0.06 ); capped = h.y > 0.4; rough = 0.6; }
	if ( o == 7 ) { top = red; pants = white; capC = red; }
	if ( o == 8 ) { top = white; pants = white; pin = true; helmet = true; }
	if ( o == 9 ) { top = vec3f( 0.36, 0.015, 0.025 ); pants = white; pin = true; rough = 0.4; }
	if ( o == 10 ) { top = navy; pants = grey; capC = navy; }
	if ( o == 11 ) { top = vec3f( 0.16, 0.16, 0.17 ); pants = vec3f( 0.02, 0.025, 0.05 ); hood = true; rough = 0.5; }
	// skin and hair
	let si = h.w;
	var skin = vec3f( 0.55, 0.34, 0.23 );
	if ( si > 0.5 ) { skin = vec3f( 0.44, 0.26, 0.16 ); }
	if ( si > 0.72 ) { skin = vec3f( 0.25, 0.13, 0.07 ); }
	if ( si > 0.86 ) { skin = vec3f( 0.12, 0.065, 0.04 ); }
	let hair = select( select( vec3f( 0.02, 0.015, 0.01 ), vec3f( 0.1, 0.06, 0.03 ), h.z > 0.6 ), vec3f( 0.3, 0.28, 0.26 ), h.z > 0.9 );
	var c = top;
	var e = vec3f( 0.0 );
	if ( part == 0 ) {
		// the Phillies jackets: a white script band across the chest; a player's jersey: the red
		// undershirt's sleeves and the button placket
		if ( ( o == 0 || o == 9 || o == 7 ) && L.y > 1.18 && L.y < 1.3 && L.z < -0.02 && abs( L.x ) < 0.12 ) { c = mix( c, white, 0.75 ); }
		if ( ( o == 1 || o == 8 ) && abs( L.x ) > 0.2 ) { c = red; }
		if ( o == 3 && abs( L.x ) > 0.2 ) { c = navy; }
		if ( ( o == 1 || o == 3 || o == 8 ) && L.z < -0.05 && abs( L.x ) < 0.012 ) { c = c * 0.7; }
		// the photographers' credentials on a lanyard
		if ( o == 6 && L.z < -0.05 && abs( L.x - 0.02 ) < 0.04 && L.y > 1.02 && L.y < 1.12 ) { c = vec3f( 0.8 ); }
	}
	if ( part == 1 ) {
		c = pants;
		rough = 0.85;
		if ( pin ) { c = c * ( 1.0 - 0.45 * step( 0.82, fract( ( L.x + L.z ) * 55.0 ) ) ); }
		// the Phillies' red socks, the Rays' navy, pulled up high
		if ( ( o == 0 || o == 1 || o == 8 || o == 9 ) && L.y < 0.36 ) { c = red; }
		if ( ( o == 2 || o == 3 || o == 10 ) && L.y < 0.36 ) { c = navy; }
		// the crew's knees muddy
		if ( o == 4 && L.y < 0.55 ) { c = mix( c, vec3f( 0.18, 0.08, 0.04 ), 0.5 ); }
	}
	if ( part == 2 ) { c = skin; rough = 0.6; }
	if ( part == 3 ) {
		let hd = L - vec3f( ${ BASE.head.join( ', ' ) } );
		c = skin; rough = 0.6;
		// hair on the back and top, then the cap, the helmet or the hood over it
		if ( hd.y > 0.02 ) { c = hair; rough = 0.7; }
		if ( capped && hd.y > 0.03 ) { c = capC; }
		if ( helmet && hd.y > -0.02 ) { c = red; rough = 0.2; }
		if ( hood ) { c = top; rough = 0.5; }
		// his face where the hood leaves it open
		if ( hood && dot( normalize( hd ), vec3f( 0.0, 0.1, -1.0 ) ) > 0.55 ) { c = skin; rough = 0.6; }
		// a cameraman's headset, Maddon's glasses
		if ( ( o == 5 || o == 11 ) && abs( hd.y - 0.03 ) < 0.02 && abs( hd.x ) > 0.07 ) { c = vec3f( 0.01 ); }
		if ( o == 10 && abs( hd.y - 0.0 ) < 0.012 && hd.z < -0.06 ) { c = vec3f( 0.02 ); rough = 0.2; }
	}
	if ( part == 4 ) {
		c = capC;
		// no brim on a helmet (it has its own) or a hood; tuck it away in the cap's colour
		if ( hood || ! capped ) { c = select( hair, top, hood ); }
	}
	if ( part == 5 ) { c = shoe; rough = 0.4; }
	// soaked: darker and glossy (the crew and the cameramen out in it, the ball kids on the lines)
	c = c * ( 1.0 - 0.35 * wet * select( 0.0, 1.0, part <= 1 ) );
	rough = mix( rough, 0.25, wet );
	s.albedo = c;
	s.roughness = rough;
	s.emissive = c * smoothstep( 0.15, 0.7, frame.night ) * 0.12 + e;
`,
	} );
	m.underwaterLighting = 'none';
	return m;

}

const _m = new Matrix4(), _q = new Quaternion(), _v = new Vector3(), _s = new Vector3(), _up = new Vector3( 0, 1, 0 );

export class FieldFigures {

	constructor( parent ) {

		this.parent = parent;
		this.list = [];
		this.meshes = new Map();
		this.hidden = new Set();
		this.material = figureMaterial();

	}

	// a figure: pose (a POSES key), where (field frame, y his feet), which way he faces (yaw: 0 faces -z),
	// his outfit (OUTFIT), a group to show / hide by, how tall (scale), how wet
	add( pose, { x, y = 0, z, yaw = 0, outfit = 0, group = '', scale = 1, wet = 0, seed = null } ) {

		const f = { pose, x, y, z, yaw, outfit, group, scale, wet, seed: seed ?? ( ( this.list.length * 0.6180339 + 0.137 ) % 1 ), shown: true };
		this.list.push( f );
		return f;

	}

	build() {

		const byPose = new Map();
		for ( const f of this.list ) {

			if ( ! byPose.has( f.pose ) ) byPose.set( f.pose, [] );
			byPose.get( f.pose ).push( f );

		}

		for ( const [ pose, list ] of byPose ) {

			const g = figureGeometry( pose );
			const who = new Float32Array( list.length * 4 );
			list.forEach( ( f, i ) => {

				who.set( [ f.outfit, f.seed, f.wet, 0 ], i * 4 );
				f.mesh = pose;
				f.index = i;

			} );
			g.setAttribute( 'aWho', new InstancedBufferAttribute( who, 4 ) );
			const mesh = new InstancedMesh( g, this.material, list.length );
			mesh.name = 'field-figures-' + pose;
			mesh.castShadow = true;
			mesh.receiveShadow = true;
			mesh.frustumCulled = false;
			this.parent.add( mesh );
			this.meshes.set( pose, { mesh, list, who } );

		}

		this.commit();

	}

	move( f, x, y, z, yaw ) {

		f.x = x; f.y = y; f.z = z;
		if ( yaw !== undefined ) f.yaw = yaw;
		this._dirty = true;

	}

	setGroup( group, shown ) {

		let changed = false;
		for ( const f of this.list ) if ( f.group === group && f.shown !== shown ) {

			f.shown = shown;
			changed = true;

		}

		if ( changed ) this._dirty = true;

	}

	setWet( k ) {

		for ( const { mesh, list, who } of this.meshes.values() ) {

			let changed = false;
			list.forEach( ( f, i ) => {

				const w = f.wet * k;
				if ( Math.abs( who[ i * 4 + 2 ] - w ) > 0.02 ) {

					who[ i * 4 + 2 ] = w;
					changed = true;

				}

			} );
			if ( changed ) mesh.geometry.getAttribute( 'aWho' ).needsUpdate = true;

		}

	}

	commit() {

		for ( const { mesh, list } of this.meshes.values() ) {

			list.forEach( ( f, i ) => {

				_q.setFromAxisAngle( _up, f.yaw );
				_m.compose( _v.set( f.x, f.y, f.z ), _q, _s.setScalar( f.shown ? f.scale : 0 ) );
				mesh.setMatrixAt( i, _m );

			} );
			mesh.instanceMatrix.needsUpdate = true;

		}

		this._dirty = false;

	}

	update() {

		if ( this._dirty ) this.commit();

	}

}
