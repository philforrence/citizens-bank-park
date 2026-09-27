import { Mesh, BufferGeometry, Float32BufferAttribute, Color } from '../../../engine/index.js';
import { standard } from '../../../materials/Materials.js';
import { commonModule } from '../../../engine/render/wgsl/common.js';
import { LEVELS } from '../../layout.js';
import { buildDrips } from '../gate3b/Drips.js';
import { plantBeds } from '../gate3b/Planting.js';

// The First Base Gate's plaza, from the 2008 photos (Flickr rdowens, 23 Jul 2008: the gate and the Roberts
// statue; puckfiend 2005: the whole front; bikesontransit Jan 2007: the paving and the furniture):
//
//   red-brown brick paving along the front of the gate, a darker brick border, and a curving band of the
//     same brick out across the big light-grey concrete slabs (the park's sidewalks)
//   grey concrete bollards with a dark band, in a row off the gate's front
//   the lamp posts with their flat disc heads
//   between the gate and the Roberts statue a tall brick pier, its limestone cap stepped, a maroon steel X
//     over it carrying the loudspeakers; the planting bed along the fence behind the statue; a black
//     slatted bin and a black bench beside him; the wave of a galvanized bike rack by the east tower
//   the pay phones outside the gate (the 2008 guide: "outside the First and Third Base Gates"), Verizon
//     silver on a post
//   the rain curtaining off the canopy's front edge on the 27th (W1's drips)
//
// And inside, in the court between the gate and the stands east of it, the Phanatic Phun Zone (Flickr
// krachel, June 2008; the 2008 guide: "inside First Base Gate plaza", kids eight and under): a red
// tube-and-netting play frame with red pyramid-roofed towers, crawl tubes with blue-ringed bubble windows,
// a blue tube bridge, white domed spheres, a giant hot dog and the Phanatic on his red ATV on top; the
// Inquirer's black board and the white arch, PHANATIC (his medallion) PHUN ZONE in red outlined in blue.
//
// Built with the prints' kit (Prints.js); the gate's frame is G.P( s, o, y ): s along the gate line, o out.
const STREET = LEVELS.mainConcourse;

// a horizontal (or any) tube from A to B ([ x, y, z ] field points), radius r, n sides
export function tube( Pr, A, B, r, n = 10, caps = true ) {

	const d = [ B[ 0 ] - A[ 0 ], B[ 1 ] - A[ 1 ], B[ 2 ] - A[ 2 ] ], L = Math.hypot( ...d ) || 1;
	const ax = d.map( ( v ) => v / L );
	let u = Math.abs( ax[ 1 ] ) < 0.9 ? [ ax[ 2 ], 0, - ax[ 0 ] ] : [ 1, 0, 0 ];
	const ul = Math.hypot( ...u );
	u = u.map( ( v ) => v / ul );
	const w = [ ax[ 1 ] * u[ 2 ] - ax[ 2 ] * u[ 1 ], ax[ 2 ] * u[ 0 ] - ax[ 0 ] * u[ 2 ], ax[ 0 ] * u[ 1 ] - ax[ 1 ] * u[ 0 ] ];
	const ring = ( C, k ) => {

		const t = k / n * Math.PI * 2, c = Math.cos( t ), s = Math.sin( t );
		const nn = [ u[ 0 ] * c + w[ 0 ] * s, u[ 1 ] * c + w[ 1 ] * s, u[ 2 ] * c + w[ 2 ] * s ];
		return [ [ C[ 0 ] + nn[ 0 ] * r, C[ 1 ] + nn[ 1 ] * r, C[ 2 ] + nn[ 2 ] * r ], nn ];

	};

	for ( let k = 0; k < n; k ++ ) {

		const [ a, na ] = ring( A, k ), [ b, nb ] = ring( A, k + 1 ), [ c, nc ] = ring( B, k + 1 ), [ e, ne ] = ring( B, k );
		Pr.tri( a, b, c, na, nb, nc );
		Pr.tri( a, c, e, na, nc, ne );
		if ( caps ) {

			Pr.tri( A, b, a, ax.map( ( v ) => - v ), ax.map( ( v ) => - v ), ax.map( ( v ) => - v ) );
			Pr.tri( B, e, c, ax, ax, ax );

		}

	}

}

// a sphere (or a dome: the top half) at C, radius r
export function ball( Pr, C, r, dome = false, n = 10 ) {

	const rows = dome ? 4 : 7;
	for ( let i = 0; i < rows; i ++ ) {

		const a0 = dome ? i / rows * Math.PI / 2 : - Math.PI / 2 + i / rows * Math.PI, a1 = dome ? ( i + 1 ) / rows * Math.PI / 2 : - Math.PI / 2 + ( i + 1 ) / rows * Math.PI;
		for ( let k = 0; k < n; k ++ ) {

			const t0 = k / n * Math.PI * 2, t1 = ( k + 1 ) / n * Math.PI * 2;
			const p = ( a, t ) => [ Math.cos( a ) * Math.cos( t ), Math.sin( a ), Math.cos( a ) * Math.sin( t ) ];
			const v = ( q ) => [ C[ 0 ] + q[ 0 ] * r, C[ 1 ] + q[ 1 ] * r, C[ 2 ] + q[ 2 ] * r ];
			const q00 = p( a0, t0 ), q01 = p( a0, t1 ), q11 = p( a1, t1 ), q10 = p( a1, t0 );
			Pr.tri( v( q00 ), v( q01 ), v( q11 ), q00, q01, q11 );
			Pr.tri( v( q00 ), v( q11 ), v( q10 ), q00, q11, q10 );

		}

	}

}

// the red-brown brick: a running bond of 20 x 10 cm pavers laid across the way, their tones varying, a
// darker border course (uv.y = 1 on it), wet on the 27th
function brickMaterial() {

	const m = standard( { name: 'concourse1b-brick', color: new Color( 0.26, 0.09, 0.055 ), roughness: 0.8, modules: [ commonModule ], depthBias: 4, depthBiasSlopeScale: 1,
		surface: /* wgsl */`
	let p = in.P.xz;
	let row = floor( p.y / 0.1 );
	let bx = p.x / 0.2 + 0.5 * ( row % 2.0 );
	let fw = fwidth( p.x ) + 0.001;
	let jx = min( fract( bx ), 1.0 - fract( bx ) ) * 0.2;
	let jy = min( fract( p.y / 0.1 ), 1.0 - fract( p.y / 0.1 ) ) * 0.1;
	let joint = 1.0 - ( 1.0 - smoothstep( 0.004, 0.004 + fw, min( jx, jy ) ) ) * ( 1.0 - clamp( fw * 30.0, 0.0, 1.0 ) ) * 0.5;
	let h = fract( sin( dot( vec2f( floor( bx ), row ), vec2f( 12.9898, 78.233 ) ) ) * 43758.5453 );
	var c = mat.color * ( 0.8 + 0.35 * h ) * joint;
	// the border course, a darker brick
	c = mix( c, c * vec3f( 0.55, 0.5, 0.52 ), step( 0.5, in.uv.y ) );
	// grime where the feet go, the wet (a darker brick, a sheen, puddles in the low spots)
	c *= 0.9 + 0.1 * mx_noise_float2( p * 0.5 );
	let pud = smoothstep( 0.62, 0.7, mx_noise_float2( p * 0.35 ) * 0.5 + 0.5 ) * frame.wet;
	s.albedo = c * mix( 1.0, 0.62, frame.wet );
	s.roughness = mix( 0.8, 0.28, frame.wet ) * mix( 1.0, 0.1, pud );
	s.albedo = mix( s.albedo, s.albedo * 0.6, pud );
` } );
	m.underwaterLighting = 'none';
	return m;

}

export function buildPlaza( { group, G, Pr, K, W } ) {

	const obstacles = [];
	const P = ( s, o, y = 0 ) => G.P( s, o, y );
	const xz = ( s, o ) => {

		const p = P( s, o );
		return [ p[ 0 ], p[ 2 ] ];

	};

	// a frame at the gate's ( s, o ) facing out (+z = the gate's n, x along its -u: to the right looking out)
	const [ nx, nz ] = G.n, [ ux, uz ] = G.u;
	const frameAt = ( s, o, turn = 0 ) => {

		const c = xz( s, o ), cs = Math.cos( turn ), sn = Math.sin( turn );
		const fx = nx * cs + ux * sn, fz = nz * cs + uz * sn;
		const Q = ( x, y, z ) => [ c[ 0 ] + fz * x + fx * z, STREET + y, c[ 1 ] - fx * x + fz * z ];
		Q.dir = ( x, y, z ) => [ fz * x + fx * z, y, - fx * x + fz * z ];
		return Q;

	};

	// ---- the brick: along the gate's front, its border, the band curving out
	const pos = [], nrm = [], uv = [];
	const quad = ( a, b, c, d, border ) => {

		for ( const q of [ a, b, c, a, c, d ] ) {

			pos.push( q[ 0 ], STREET + 0.012, q[ 1 ] );
			nrm.push( 0, 1, 0 );
			uv.push( 0, border ? 1 : 0 );

		}

	};

	const strip = ( s0, s1, o0, o1, border ) => {

		// wound to face up
		const a = xz( s0, o0 ), b = xz( s1, o0 ), c = xz( s1, o1 ), d = xz( s0, o1 );
		const up = ( b[ 0 ] - a[ 0 ] ) * ( d[ 1 ] - a[ 1 ] ) - ( b[ 1 ] - a[ 1 ] ) * ( d[ 0 ] - a[ 0 ] );
		if ( up < 0 ) quad( a, b, c, d, border ); else quad( a, d, c, b, border );

	};

	strip( - 27, 27, 0.05, 8.2, false );
	strip( - 27, 27, 8.2, 8.8, true );
	// the band curving away across the concrete toward Pattison (1.8 m wide, a darker edge each side)
	for ( let i = 0; i < 16; i ++ ) {

		const t0 = i / 16, t1 = ( i + 1 ) / 16;
		const c = ( t ) => [ - 6 + 20 * Math.sin( t * 1.4 ), 8.8 + t * 34 ];
		const [ s0, o0 ] = c( t0 ), [ s1, o1 ] = c( t1 );
		strip( s0 - 0.9, s1 - 0.9, o0, o1, true );
		strip( s0 - 0.6, s1 - 0.6, o0, o1, false );
		strip( s0 + 0.6, s1 + 0.6, o0, o1, true );

	}

	{

		const g = new BufferGeometry();
		g.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
		g.setAttribute( 'normal', new Float32BufferAttribute( nrm, 3 ) );
		g.setAttribute( 'uv', new Float32BufferAttribute( uv, 2 ) );
		g.computeBoundingBox();
		g.computeBoundingSphere();
		const m = new Mesh( g, brickMaterial() );
		m.name = 'concourse1b-brick';
		m.receiveShadow = true;
		group.add( m );

	}

	// ---- the bollards along the front: grey concrete, a dark band near the top
	for ( let s = - 14; s <= 14; s += 4 ) {

		if ( Math.abs( s ) < 1 ) continue;
		const c = frameAt( s, 9.4 );
		Pr.use( 'concrete' ).cyl( c, 0, 0, 0, 0.72, 0.16, 0.16, 10, { top: false } );
		Pr.use( 'charcoal' ).cyl( c, 0, 0, 0.72, 0.8, 0.165, 0.165, 10, { top: false } );
		Pr.use( 'concrete' ).cyl( c, 0, 0, 0.8, 0.92, 0.16, 0.12, 10 );
		obstacles.push( [ ...xz( s, 9.4 ), 0.3 ] );

	}

	// ---- the lamp posts: grey poles, a flat disc head, the lens under it (lit after dark)
	const lamps = [];
	for ( const [ s, o ] of [ [ - 26, 12 ], [ 26, 12 ], [ - 8, 24 ], [ 12, 30 ] ] ) {

		const c = frameAt( s, o );
		Pr.use( 'grey' ).cyl( c, 0, 0, 0, 4.4, 0.08, 0.06, 8, { top: false } );
		Pr.use( 'grey' ).cyl( c, 0, 0, 4.4, 4.55, 0.45, 0.45, 14 );
		Pr.use( 'lamp' ).cyl( c, 0, 0, 4.36, 4.4, 0.36, 0.36, 14, { top: false } );
		obstacles.push( [ ...xz( s, o ), 0.25 ] );
		lamps.push( P( s, o, 4.3 ) );

	}

	// ---- the pier between the gate and the statue: brick, a stepped limestone cap, the X frame and the
	// loudspeakers on it
	{

		const c = frameAt( 14.6, 2.8 );
		Pr.use( 'brick' ).box( c, 0, 2.1, 0, 1.3, 4.2, 1.3 );
		Pr.use( 'limestone' ).box( c, 0, 4.26, 0, 1.45, 0.12, 1.45 );
		Pr.use( 'limestone' ).box( c, 0, 4.42, 0, 1.2, 0.2, 1.2 );
		Pr.use( 'brick' ).box( c, 0, 4.7, 0, 0.9, 0.36, 0.9 );
		Pr.use( 'limestone' ).box( c, 0, 4.92, 0, 1.0, 0.08, 1.0 );
		for ( const [ a, b ] of [ [ [ - 0.45, 5.0 ], [ 0.45, 7.2 ] ], [ [ 0.45, 5.0 ], [ - 0.45, 7.2 ] ] ] ) tube( Pr.use( 'maroon' ), c( a[ 0 ], a[ 1 ], 0 ), c( b[ 0 ], b[ 1 ], 0 ), 0.06, 6 );
		for ( const x of [ - 0.45, 0.45 ] ) tube( Pr.use( 'maroon' ), c( x, 5.0, 0 ), c( x, 7.3, 0 ), 0.07, 6 );
		for ( const [ x, a ] of [ [ - 0.35, - 0.5 ], [ 0.35, 0.5 ] ] ) {

			const q = frameAt( 14.6, 2.8, a );
			Pr.use( 'charcoal' ).box( q, x * 0.3, 6.9, 0.35, 0.5, 0.42, 0.4 );

		}

		obstacles.push( [ ...xz( 14.6, 2.8 ), 1.0 ] );

	}

	// ---- beside the statue: the black slatted bin, the black bench
	{

		const c = frameAt( 22.4, 6.2 );
		for ( let k = 0; k < 12; k ++ ) {

			const a = k / 12 * Math.PI * 2;
			Pr.use( 'black' ).box( c, Math.cos( a ) * 0.27, 0.45, Math.sin( a ) * 0.27, 0.05, 0.8, 0.05 );

		}

		Pr.use( 'black' ).cyl( c, 0, 0, 0.84, 0.95, 0.31, 0.3, 12 );
		Pr.use( 'black' ).cyl( c, 0, 0, 0.95, 1.05, 0.22, 0.2, 12 );
		obstacles.push( [ ...xz( 22.4, 6.2 ), 0.4 ] );
		const b = frameAt( 22.6, 8.4, - 0.3 );
		for ( let k = 0; k < 4; k ++ ) Pr.use( 'black' ).box( b, 0, 0.45, - 0.2 + k * 0.13, 1.8, 0.03, 0.09 );
		for ( let k = 0; k < 3; k ++ ) Pr.use( 'black' ).box( b, 0, 0.62 + k * 0.13, - 0.3, 1.8, 0.09, 0.03 );
		for ( const x of [ - 0.8, 0.8 ] ) Pr.use( 'black' ).box( b, x, 0.35, - 0.05, 0.06, 0.7, 0.55 );
		obstacles.push( [ ...xz( 22.6, 8.4 ), 1.0 ] );

	}

	// ---- the bike rack: a galvanized tube in waves, by the east tower
	{

		const c = frameAt( - 21, 4.5, Math.PI / 2 );
		let prev = null;
		for ( let k = 0; k <= 24; k ++ ) {

			const x = - 1.8 + k * 0.15, y = 0.45 + 0.4 * Math.sin( k / 24 * Math.PI * 5 );
			const q = c( x, Math.max( 0.02, y ), 0 );
			if ( prev ) tube( Pr.use( 'steel' ), prev, q, 0.025, 6, false );
			prev = q;

		}

		obstacles.push( [ ...xz( - 21, 4.5 ), 1.9 ] );

	}

	// ---- the pay phones: two silver phones on a post by the west tower
	{

		const c = frameAt( 17.2, 1.2 );
		Pr.use( 'steel' ).box( c, 0, 1.0, 0, 0.12, 2.0, 0.12 );
		for ( const x of [ - 0.38, 0.38 ] ) {

			Pr.use( 'steel' ).box( c, x, 1.35, 0.12, 0.6, 0.85, 0.35 );
			Pr.use( 'charcoal' ).box( c, x, 1.4, 0.3, 0.2, 0.34, 0.02 );
			Pr.use( 'black' ).box( c, x - 0.2, 1.4, 0.32, 0.07, 0.22, 0.06 );

		}

		Pr.use( 'royal' ).box( c, 0, 1.92, 0.12, 1.4, 0.16, 0.36 );
		obstacles.push( [ ...xz( 17.2, 1.2 ), 0.7 ] );

	}

	// ---- the planting: along the fence behind the statue, and round the pier
	plantBeds( group, [ [ 17.5, 2.2, 1.6 ], [ 20.5, 2.2, 1.6 ], [ 23.5, 2.4, 1.5 ], [ 11.8, 2.0, 1.2 ] ].map( ( [ s, o, r ] ) => [ ...xz( s, o ), r, STREET + 0.02 ] ), 21 );
	for ( const [ s, o, r ] of [ [ 17.5, 2.2, 1.6 ], [ 20.5, 2.2, 1.6 ], [ 23.5, 2.4, 1.5 ] ] ) obstacles.push( [ ...xz( s, o ), r ] );
	// the roberts statue's plinth, for the ones walking past
	obstacles.push( [ ...xz( 18.5, 6.5 ), 2.2 ] );

	// ---- the rain off the canopy's front edge (the 27th)
	buildDrips( group, [ [ xz( - 25, 5.02 ), xz( 25, 5.02 ), STREET + 5.55, STREET + 0.02 ] ] );

	return { obstacles, lamps, statue: { front: xz( 18.5, 10.2 ), at: xz( 18.5, 6.5 ), bench: xz( 22.6, 8.4 ), out: G.n } };

}

// The Phanatic Phun Zone, in a frame on the floor: its front (the arch) at +z, 7 m along x, 5 m deep
export function buildPhunZone( Pr, Q ) {

	const red = 'red', blue = 'royal';
	const W = 3.6, D = 2.5, L1 = 1.4, L2 = 2.9;
	// the frame: red posts at the corners and the middles, the decks' rails at two levels
	const posts = [];
	for ( const x of [ - W, - W / 3, W / 3, W ] ) for ( const z of [ - D, D ] ) posts.push( [ x, z ] );
	for ( const [ x, z ] of posts ) tube( Pr.use( red ), Q( x, 0, z ), Q( x, L2 + 0.9, z ), 0.07, 8 );
	for ( const y of [ L1, L2, L2 + 0.9 ] ) {

		for ( const z of [ - D, D ] ) tube( Pr.use( red ), Q( - W, y, z ), Q( W, y, z ), 0.05, 6 );
		for ( const x of [ - W, - W / 3, W / 3, W ] ) tube( Pr.use( red ), Q( x, y, - D ), Q( x, y, D ), 0.05, 6 );

	}

	// the netting: dark panels between the posts at each level's sides (thin horizontal and vertical strands)
	for ( const z of [ - D, D ] ) for ( let x = - W; x < W - 0.01; x += 0.3 ) Pr.use( 'black' ).box( Q, x, L2 / 2 + 0.4, z, 0.012, L2 + 0.8, 0.012 );
	for ( const z of [ - D, D ] ) for ( let y = 0.4; y < L2 + 0.8; y += 0.3 ) Pr.use( 'black' ).box( Q, 0, y, z, 2 * W, 0.012, 0.012 );
	// the decks
	for ( const y of [ L1, L2 ] ) Pr.use( 'foam' ).box( Q, 0, y - 0.04, 0, 2 * W - 0.2, 0.06, 2 * D - 0.2 );
	// the towers' red pyramid roofs
	for ( const x of [ - W + 0.9, W - 0.9 ] ) {

		Pr.use( red ).cyl( Q, x, 0, L2 + 0.9, L2 + 2.1, 1.25, 0.05, 4, { top: false } );

	}

	// the crawl tubes: red along the lower deck's front, blue across the top, blue rings round the windows
	tube( Pr.use( red ), Q( - W + 0.4, L1 + 0.5, D - 0.5 ), Q( W - 0.4, L1 + 0.5, D - 0.5 ), 0.45, 14 );
	for ( const x of [ - 2.2, - 0.6, 1.0, 2.6 ] ) {

		tube( Pr.use( blue ), Q( x - 0.08, L1 + 0.5, D - 0.5 ), Q( x + 0.08, L1 + 0.5, D - 0.5 ), 0.47, 14, false );
		ball( Pr.use( 'glass' ), Q( x, L1 + 0.5, D - 0.02 ), 0.3, false, 8 );

	}

	tube( Pr.use( blue ), Q( - W + 0.6, L2 + 0.55, 0 ), Q( W - 1.4, L2 + 0.55, 0 ), 0.42, 14 );
	// the white domed spheres at the ends, a bubble window each
	ball( Pr.use( 'white' ), Q( - W - 0.1, L1 + 0.6, 0.6 ), 0.75, false, 12 );
	ball( Pr.use( 'white' ), Q( 0.4, L2 + 0.7, 0 ), 0.7, false, 12 );
	ball( Pr.use( 'glass' ), Q( - W - 0.1, L1 + 0.6, 1.2 ), 0.32, false, 8 );
	// a slide down the side
	for ( let k = 0; k < 8; k ++ ) {

		const t0 = k / 8, t1 = ( k + 1 ) / 8, y = ( t ) => L2 * ( 1 - t ), x = ( t ) => W + 0.3 + t * 2.2;
		Pr.use( 'yellow' ).quad( Q( x( t0 ), y( t0 ), - 0.4 ), Q( x( t1 ), y( t1 ), - 0.4 ), Q( x( t1 ), y( t1 ), 0.4 ), Q( x( t0 ), y( t0 ), 0.4 ), Q.dir( 0.8, 1, 0 ) );

	}

	// on top: the giant hot dog, the Phanatic on his red ATV
	tube( Pr.use( 'cream' ), Q( - W + 0.3, L2 + 1.25, - 0.8 ), Q( - W + 2.2, L2 + 1.25, - 0.8 ), 0.28, 10 );
	tube( Pr.use( 'orange' ), Q( - W + 0.1, L2 + 1.45, - 0.8 ), Q( - W + 2.4, L2 + 1.45, - 0.8 ), 0.16, 8 );
	Pr.use( red ).box( Q, W - 1.3, L2 + 1.25, - 0.6, 1.4, 0.45, 0.8 );
	for ( const [ x, z ] of [ [ - 0.55, - 0.45 ], [ 0.55, - 0.45 ], [ - 0.55, 0.45 ], [ 0.55, 0.45 ] ] ) tube( Pr.use( 'black' ), Q( W - 1.3 + x, L2 + 1.05, - 0.6 + z - 0.12 ), Q( W - 1.3 + x, L2 + 1.05, - 0.6 + z + 0.12 ), 0.3, 10 );
	ball( Pr.use( 'phanatic' ), Q( W - 1.3, L2 + 2.0, - 0.6 ), 0.55, false, 10 );
	ball( Pr.use( 'phanatic' ), Q( W - 1.3, L2 + 2.75, - 0.55 ), 0.36, false, 10 );
	tube( Pr.use( 'phanatic' ), Q( W - 1.3, L2 + 2.7, - 0.35 ), Q( W - 1.3, L2 + 2.7, 0.15 ), 0.12, 8 );
	Pr.use( red ).cyl( Q, W - 1.3, - 0.6, L2 + 3.0, L2 + 3.15, 0.3, 0.26, 10 );
	// the Inquirer's board and the arch over the way in
	Pr.use( 'black' ).box( Q, 0, 3.15, D + 0.15, 3.6, 0.55, 0.05, 'inquirer' );
	Pr.use( 'white' ).box( Q, 0, 2.2, D + 0.2, 4.6, 1.0, 0.05, 'phunZone' );
	for ( const x of [ - 2.3, 2.3 ] ) Pr.use( 'black' ).box( Q, x, 1.05, D + 0.2, 0.08, 2.1, 0.08 );
	// the soft floor round it
	Pr.use( 'foam' ).box( Q, 0, 0.02, 0, 2 * W + 3.5, 0.04, 2 * D + 1.6 );

}
