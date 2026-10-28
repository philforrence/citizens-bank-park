// The fans' head: the players' MakeHuman head (tools/build-body.mjs; the base mesh, its targets and its
// skeleton, released CC0 by the MakeHuman community in 2020) cut off at the neck, shaped by MakeHuman's own
// targets into a few blend shapes, and brought down to what each level of the people in the stands can
// afford. Written to src/ballpark/game/data/fanHead.js.
//
//   node tools/build-fanhead.mjs
//
// The MakeHuman files are fetched from GitHub into tools/body/.cache the first time (as build-body's).
//
// What's in it:
//  - the head and the neck above the collar, from the base mesh's body (the mouth's inside left out and the
//    lips closed over it, the eyes' openings filled a little behind the lids, for the paint's eyes)
//  - three levels, by quadric-error half-edge collapses (Garland & Heckbert; a vertex merged into a
//    neighbour never moves, so every level is a set of the finest one's vertices and shares its blend
//    shapes), mirrored pairs collapsed together so a face stays symmetric, the face kept finer than the
//    back of the skull (which a cap or the hair covers): 1,200 triangles (the Cast's near figure), 400 (its
//    middle figure, the seats' close level), 90 (the seats' near level, FOX's backdrop)
//  - the faces of real people: 1,500 people drawn the way the 2008 crowd was (men and women, kids, teens,
//    adults and the old, the city's mix of faces, slim to heavy), each made by MakeHuman's own macro
//    targets (gender, age and ethnicity, weight: its corner targets mixed as MakeHuman mixes them) and
//    ~50 of its face modifiers (the nose, the jaw and the chin, the cheeks, the eyes, the brows, the ears,
//    the mouth, the head's shape and the neck), then reduced to their principal components: K blend shapes
//    (positions and normals) that hold most of how those faces differ. A fan's weights are worked out from
//    who he is (female, age, his skin's likely ethnicity, his build) plus his own seeded share of the rest
//    (A, the mean and L, below), so faces vary the way real ones do and not only by stretching
//  - the paint's frame: where each vertex is in the egg's unit space the stands' and the Cast's face paint
//    were drawn for (the eyes at d.y 0.1 and x 0.34, the brows at 0.3, under the nose -0.24, the mouth
//    -0.45, the chin -0.85), warped from MakeHuman's own landmarks, so the painted eyes, brows, lips, beards,
//    caps' bands and hairlines land on the modelled features; it rides with the vertex as the blend shapes
//    move it
//  - the ears' fold: how far each ear vertex moves to lie on the skull, for a hood or a knit hat over them
//
// Frames: MakeHuman faces +z with +x his left; ours faces -z with +x his right (a half turn about y), in
// metres, about the head's centre (the egg's: R, the seated crowd's HEAD_R).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const CACHE = new URL( './body/.cache/', import.meta.url ).pathname;
const OUT = new URL( '../src/ballpark/game/data/fanHead.js', import.meta.url ).pathname;
const SRC = 'https://raw.githubusercontent.com/makehumancommunity/makehuman/master/makehuman/data/';
// the egg the paint was drawn for (Crowd.js HEAD_R; the Cast's is 0.97 of it)
const R = [ 0.082, 0.105, 0.098 ];
const LEVELS = [ [ 'near', 1200 ], [ 'mid', 400 ], [ 'far', 90 ] ];
const K = 8; // blend shapes
const SAMPLES = 1500;

async function get( path ) {

	const file = join( CACHE, path.replace( /\//g, '_' ) );
	if ( ! existsSync( file ) ) {

		mkdirSync( CACHE, { recursive: true } );
		const r = await fetch( SRC + path );
		if ( ! r.ok ) throw new Error( `${ path }: ${ r.status }` );
		writeFileSync( file, Buffer.from( await r.arrayBuffer() ) );

	}

	return readFileSync( file, 'utf8' );

}

// ---------------------------------------------------------------- small helpers

const sub = ( a, b ) => [ a[ 0 ] - b[ 0 ], a[ 1 ] - b[ 1 ], a[ 2 ] - b[ 2 ] ];
const add = ( a, b ) => [ a[ 0 ] + b[ 0 ], a[ 1 ] + b[ 1 ], a[ 2 ] + b[ 2 ] ];
const mul = ( a, k ) => [ a[ 0 ] * k, a[ 1 ] * k, a[ 2 ] * k ];
const dot = ( a, b ) => a[ 0 ] * b[ 0 ] + a[ 1 ] * b[ 1 ] + a[ 2 ] * b[ 2 ];
const cross = ( a, b ) => [ a[ 1 ] * b[ 2 ] - a[ 2 ] * b[ 1 ], a[ 2 ] * b[ 0 ] - a[ 0 ] * b[ 2 ], a[ 0 ] * b[ 1 ] - a[ 1 ] * b[ 0 ] ];
const len = ( a ) => Math.hypot( a[ 0 ], a[ 1 ], a[ 2 ] );
const norm = ( a ) => mul( a, 1 / ( len( a ) || 1 ) );
const clamp = ( x, a, b ) => Math.min( b, Math.max( a, x ) );
const smooth = ( a, b, x ) => {

	const t = clamp( ( x - a ) / ( b - a ), 0, 1 );
	return t * t * ( 3 - 2 * t );

};
// a seeded generator (mulberry32) and a normal draw
function rng( seed ) {

	let s = seed >>> 0;
	return () => {

		s = ( s + 0x6D2B79F5 ) >>> 0;
		let t = s;
		t = Math.imul( t ^ ( t >>> 15 ), t | 1 );
		t ^= t + Math.imul( t ^ ( t >>> 7 ), t | 61 );
		return ( ( t ^ ( t >>> 14 ) ) >>> 0 ) / 4294967296;

	};

}
const R0 = rng( 20081029 );
const gauss = ( r = R0 ) => Math.sqrt( - 2 * Math.log( r() + 1e-12 ) ) * Math.cos( 2 * Math.PI * r() );

// ---------------------------------------------------------------- the base mesh's head

const obj = await get( '3dobjs/base.obj' );
const skel = JSON.parse( await get( 'rigs/default.mhskel' ) );
const V = [], groups = {};
let group = null;
for ( const line of obj.split( '\n' ) ) {

	if ( line.startsWith( 'v ' ) ) V.push( line.split( /\s+/ ).slice( 1, 4 ).map( Number ) );
	else if ( line.startsWith( 'g ' ) ) group = line.split( /\s+/ )[ 1 ];
	else if ( line.startsWith( 'f ' ) ) ( groups[ group ] ||= [] ).push( line.trim().split( /\s+/ ).slice( 1 ).map( ( s ) => parseInt( s ) - 1 ) );

}

const joint = ( name ) => {

	const ids = skel.joints[ name ];
	return mul( ids.reduce( ( a, i ) => add( a, V[ i ] ), [ 0, 0, 0 ] ), 1 / ids.length );

};
const boneHead = ( b ) => joint( skel.bones[ b ].head ), boneTail = ( b ) => joint( skel.bones[ b ].tail );

// the cut: a little under the chin in front, across the neck (MakeHuman's units are decimetres)
const CUT = 5.98;
const keep = groups.body.filter( ( f ) => f.every( ( i ) => V[ i ][ 1 ] > CUT ) );
// and the eyeballs' fronts (MakeHuman's eye helpers), in the lids: the painted iris and white on them (the
// lids' opening alone was a hollow, the eyes slits in its shade)
const eyeSet = new Set();
for ( const g of [ 'helper-l-eye', 'helper-r-eye' ] ) {

	const ids = [ ...new Set( groups[ g ].flat() ) ];
	const c = mul( ids.reduce( ( a, i ) => add( a, V[ i ] ), [ 0, 0, 0 ] ), 1 / ids.length );
	for ( const f of groups[ g ] ) if ( f.every( ( i ) => V[ i ][ 2 ] > c[ 2 ] + 0.02 ) ) {

		keep.push( f );
		for ( const i of f ) eyeSet.add( i );

	}

}
// the region's vertices, renumbered
const old2new = new Map(), src = [];
for ( const f of keep ) for ( const i of f ) if ( ! old2new.has( i ) ) {

	old2new.set( i, src.length );
	src.push( i );

}

let tris = [];
for ( const f of keep ) {

	const [ a, b, c, d ] = f.map( ( i ) => old2new.get( i ) );
	tris.push( [ a, b, c ], [ a, c, d ] );

}

// positions in MakeHuman's frame, for now
let P = src.map( ( i ) => V[ i ].slice() );
const N0 = P.length;

function vnormals( p, T ) {

	const N = p.map( () => [ 0, 0, 0 ] );
	for ( const [ a, b, c ] of T ) {

		const fn = cross( sub( p[ b ], p[ a ] ), sub( p[ c ], p[ a ] ) );
		for ( const k of [ a, b, c ] ) N[ k ] = add( N[ k ], fn );

	}

	return N.map( norm );

}

// MakeHuman winds outward in its own frame: check on the forehead
{

	const N = vnormals( P, tris );
	let best = 0;
	for ( let i = 0; i < P.length; i ++ ) if ( Math.abs( P[ i ][ 0 ] ) < 0.05 && P[ i ][ 1 ] > 7.6 && P[ i ][ 1 ] < 7.8 && P[ i ][ 2 ] > P[ best ][ 2 ] ) best = i;
	if ( N[ best ][ 2 ] < 0 ) for ( const t of tris ) t.reverse();

}

// the open edges' loops: the neck (the lowest), the eyes, the mouth's slit; each but the neck filled from
// a point at its middle (the eyes' set back behind the lids, the lips' a millimetre)
function loops( T ) {

	const he = new Map();
	for ( const [ a, b, c ] of T ) for ( const [ x, y ] of [ [ a, b ], [ b, c ], [ c, a ] ] ) he.set( x + ',' + y, [ x, y ] );
	const next = new Map();
	for ( const [ , [ x, y ] ] of he ) if ( ! he.has( y + ',' + x ) ) next.set( x, y );
	const seen = new Set(), out = [];
	for ( const [ s ] of next ) {

		if ( seen.has( s ) ) continue;
		const L = [];
		for ( let x = s; ! seen.has( x ); x = next.get( x ) ) {

			seen.add( x );
			L.push( x );
			if ( ! next.has( x ) ) break;

		}

		out.push( L );

	}

	return out;

}

{

	const L = loops( tris );
	const meanY = ( l ) => l.reduce( ( a, i ) => a + P[ i ][ 1 ], 0 ) / l.length;
	L.sort( ( a, b ) => meanY( a ) - meanY( b ) );
	console.log( 'open loops:', L.map( ( l ) => `${ l.length } at y ${ meanY( l ).toFixed( 2 ) }` ).join( ', ' ) );
	for ( const l of L.slice( 1 ) ) {

		if ( l.length < 3 ) continue;
		const c = mul( l.reduce( ( a, i ) => add( a, P[ i ] ), [ 0, 0, 0 ] ), 1 / l.length );
		const eye = c[ 1 ] > 7.0;
		// the eyes' openings: the middle behind the lids; the lips' slit: shut
		const ci = P.length;
		P.push( add( c, [ 0, 0, eye ? - 0.035 : - 0.01 ] ) );
		for ( let k = 0; k < l.length; k ++ ) tris.push( [ l[ ( k + 1 ) % l.length ], l[ k ], ci ] );

	}

}

// the fill's triangles wound as their neighbours: check them by the normal
{

	const N = vnormals( P, tris );
	for ( const t of tris ) {

		const fn = cross( sub( P[ t[ 1 ] ], P[ t[ 0 ] ] ), sub( P[ t[ 2 ] ], P[ t[ 0 ] ] ) );
		const vn = add( add( N[ t[ 0 ] ], N[ t[ 1 ] ] ), N[ t[ 2 ] ] );
		if ( dot( fn, vn ) < 0 ) [ t[ 1 ], t[ 2 ] ] = [ t[ 2 ], t[ 1 ] ];

	}

}

// drop the vertices no triangle uses
{

	const used = new Int32Array( P.length ).fill( - 1 ), P2 = [], src2 = [];
	for ( const t of tris ) for ( const i of t ) if ( used[ i ] < 0 ) {

		used[ i ] = P2.length;
		P2.push( P[ i ] );
		src2.push( i < N0 ? src[ i ] : - 1 - i );

	}

	tris = tris.map( ( t ) => t.map( ( i ) => used[ i ] ) );
	P = P2;
	src.length = 0;
	src.push( ...src2 );

}

console.log( 'the head:', P.length, 'vertices,', tris.length, 'triangles' );

// ---------------------------------------------------------------- the targets

// a target as a sparse map: base mesh index -> [ dx, dy, dz ]
function parseTarget( text ) {

	const m = new Map();
	for ( const line of text.split( '\n' ) ) {

		if ( ! line || line[ 0 ] === '#' ) continue;
		const p = line.trim().split( /\s+/ );
		if ( p.length < 4 ) continue;
		m.set( + p[ 0 ], [ + p[ 1 ], + p[ 2 ], + p[ 3 ] ] );

	}

	return m;

}

// a target over the head's vertices (the fills' middles follow their loop's mean)
const fillOf = new Map(); // head index of a fill's middle -> its loop's head indices
{

	const nb = P.map( () => new Set() );
	for ( const [ a, b, c ] of tris ) { nb[ a ].add( b ).add( c ); nb[ b ].add( a ).add( c ); nb[ c ].add( a ).add( b ); }
	src.forEach( ( s, i ) => { if ( s < 0 ) fillOf.set( i, [ ...nb[ i ] ] ); } );

}
function onHead( t ) {

	const D = new Float64Array( P.length * 3 );
	src.forEach( ( s, i ) => {

		if ( s < 0 ) return;
		const d = t.get( s );
		if ( d ) D.set( d, i * 3 );

	} );
	for ( const [ i, ring ] of fillOf ) {

		for ( const j of ring ) for ( let k = 0; k < 3; k ++ ) D[ i * 3 + k ] += D[ j * 3 + k ] / ring.length;

	}

	return D;

}

const ETH = [ 'african', 'asian', 'caucasian' ], GEN = [ 'male', 'female' ], AGE = [ 'child', 'young', 'old' ];
const macro = {};
for ( const e of ETH ) for ( const g of GEN ) for ( const a of AGE ) macro[ `${ e }-${ g }-${ a }` ] = onHead( parseTarget( await get( `targets/macrodetails/${ e }-${ g }-${ a }.target` ) ) );
const weightT = {};
for ( const g of GEN ) for ( const w of [ 'minweight', 'averageweight', 'maxweight' ] ) weightT[ `${ g }-${ w }` ] = onHead( parseTarget( await get( `targets/macrodetails/universal-${ g }-young-averagemuscle-${ w }.target` ) ) );

// the face's modifiers: [ name, the target at -1, at +1 ] (an l- / r- pair applied together), or a shape
// that only goes one way
const PAIRS = [
	[ 'head-age', 'head/head-age-decr', 'head/head-age-incr' ], [ 'head-fat', 'head/head-fat-decr', 'head/head-fat-incr' ],
	[ 'head-depth', 'head/head-scale-depth-decr', 'head/head-scale-depth-incr' ], [ 'head-horiz', 'head/head-scale-horiz-decr', 'head/head-scale-horiz-incr' ],
	[ 'head-vert', 'head/head-scale-vert-decr', 'head/head-scale-vert-incr' ], [ 'head-back', 'head/head-back-scale-depth-decr', 'head/head-back-scale-depth-incr' ],
	[ 'forehead-nubian', 'forehead/forehead-nubian-decr', 'forehead/forehead-nubian-incr' ], [ 'forehead-vert', 'forehead/forehead-scale-vert-decr', 'forehead/forehead-scale-vert-incr' ],
	[ 'forehead-temple', 'forehead/forehead-temple-decr', 'forehead/forehead-temple-incr' ], [ 'forehead-slope', 'forehead/forehead-trans-backward', 'forehead/forehead-trans-forward' ],
	[ 'brow-ridge', 'eyebrows/eyebrows-trans-backward', 'eyebrows/eyebrows-trans-forward' ], [ 'brow-angle', 'eyebrows/eyebrows-angle-down', 'eyebrows/eyebrows-angle-up' ],
	[ 'brow-height', 'eyebrows/eyebrows-trans-down', 'eyebrows/eyebrows-trans-up' ],
	[ 'eye-spacing', 'eyes/*-eye-trans-in', 'eyes/*-eye-trans-out' ], [ 'eye-size', 'eyes/*-eye-scale-decr', 'eyes/*-eye-scale-incr' ],
	[ 'eye-height', 'eyes/*-eye-trans-down', 'eyes/*-eye-trans-up' ], [ 'eye-bag', 'eyes/*-eye-bag-decr', 'eyes/*-eye-bag-incr' ],
	[ 'eye-deep', 'eyes/*-eye-push1-out', 'eyes/*-eye-push1-in' ], [ 'eye-fold', 'eyes/*-eye-eyefold-up', 'eyes/*-eye-eyefold-down' ],
	[ 'eye-epicanthus', 'eyes/*-eye-epicanthus-out', 'eyes/*-eye-epicanthus-in' ],
	[ 'nose-width', 'nose/nose-scale-horiz-decr', 'nose/nose-scale-horiz-incr' ], [ 'nose-length', 'nose/nose-scale-vert-decr', 'nose/nose-scale-vert-incr' ],
	[ 'nose-depth', 'nose/nose-scale-depth-decr', 'nose/nose-scale-depth-incr' ], [ 'nose-hump', 'nose/nose-hump-decr', 'nose/nose-hump-incr' ],
	[ 'nose-point', 'nose/nose-point-width-decr', 'nose/nose-point-width-incr' ], [ 'nose-nostrils', 'nose/nose-nostrils-width-decr', 'nose/nose-nostrils-width-incr' ],
	[ 'nose-height', 'nose/nose-trans-down', 'nose/nose-trans-up' ], [ 'nose-out', 'nose/nose-trans-backward', 'nose/nose-trans-forward' ],
	[ 'nose-curve', 'nose/nose-curve-concave', 'nose/nose-curve-convex' ], [ 'nose-volume', 'nose/nose-volume-decr', 'nose/nose-volume-incr' ],
	[ 'nose-flare', 'nose/nose-flaring-decr', 'nose/nose-flaring-incr' ], [ 'nose-tip', 'nose/nose-point-down', 'nose/nose-point-up' ],
	[ 'nose-greek', 'nose/nose-greek-decr', 'nose/nose-greek-incr' ],
	[ 'mouth-width', 'mouth/mouth-scale-horiz-decr', 'mouth/mouth-scale-horiz-incr' ], [ 'mouth-height', 'mouth/mouth-trans-down', 'mouth/mouth-trans-up' ],
	[ 'mouth-out', 'mouth/mouth-trans-backward', 'mouth/mouth-trans-forward' ], [ 'lip-lower', 'mouth/mouth-lowerlip-volume-decr', 'mouth/mouth-lowerlip-volume-incr' ],
	[ 'lip-upper', 'mouth/mouth-upperlip-volume-decr', 'mouth/mouth-upperlip-volume-incr' ], [ 'mouth-angles', 'mouth/mouth-angles-down', 'mouth/mouth-angles-up' ],
	[ 'mouth-philtrum', 'mouth/mouth-philtrum-volume-decr', 'mouth/mouth-philtrum-volume-incr' ],
	[ 'ear-size', 'ears/*-ear-scale-decr', 'ears/*-ear-scale-incr' ], [ 'ear-out', 'ears/*-ear-flap-decr', 'ears/*-ear-flap-incr' ],
	[ 'ear-lobe', 'ears/*-ear-lobe-decr', 'ears/*-ear-lobe-incr' ], [ 'ear-height', 'ears/*-ear-trans-down', 'ears/*-ear-trans-up' ],
	[ 'chin-out', 'chin/chin-prominent-decr', 'chin/chin-prominent-incr' ], [ 'chin-width', 'chin/chin-width-decr', 'chin/chin-width-incr' ],
	[ 'chin-height', 'chin/chin-height-decr', 'chin/chin-height-incr' ], [ 'jaw', 'chin/chin-bones-decr', 'chin/chin-bones-incr' ],
	[ 'jaw-drop', 'chin/chin-jaw-drop-decr', 'chin/chin-jaw-drop-incr' ], [ 'chin-cleft', 'chin/chin-cleft-decr', 'chin/chin-cleft-incr' ],
	[ 'prognathism', 'chin/chin-prognathism-decr', 'chin/chin-prognathism-incr' ],
	[ 'cheekbones', 'cheek/*-cheek-bones-decr', 'cheek/*-cheek-bones-incr' ], [ 'cheeks', 'cheek/*-cheek-volume-decr', 'cheek/*-cheek-volume-incr' ],
	[ 'cheek-inner', 'cheek/*-cheek-inner-decr', 'cheek/*-cheek-inner-incr' ], [ 'cheek-height', 'cheek/*-cheek-trans-down', 'cheek/*-cheek-trans-up' ],
	[ 'neck-width', 'neck/neck-scale-horiz-decr', 'neck/neck-scale-horiz-incr' ], [ 'neck-depth', 'neck/neck-scale-depth-decr', 'neck/neck-scale-depth-incr' ],
	[ 'neck-double', 'neck/neck-double-decr', 'neck/neck-double-incr' ],
];
const SHAPES = [ 'oval', 'round', 'square', 'rectangular', 'triangular', 'invertedtriangular', 'diamond' ];
async function target( path ) {

	if ( ! path.includes( '*' ) ) return onHead( parseTarget( await get( `targets/${ path }.target` ) ) );
	const a = onHead( parseTarget( await get( `targets/${ path.replace( '*', 'l' ) }.target` ) ) );
	const b = onHead( parseTarget( await get( `targets/${ path.replace( '*', 'r' ) }.target` ) ) );
	for ( let i = 0; i < a.length; i ++ ) a[ i ] += b[ i ];
	return a;

}

const mods = [];
for ( const [ name, lo, hi ] of PAIRS ) mods.push( { name, lo: await target( lo ), hi: await target( hi ) } );
const shapes = [];
for ( const s of SHAPES ) shapes.push( await target( `head/head-${ s }` ) );
console.log( 'targets:', Object.keys( macro ).length, 'macro,', mods.length, 'modifier pairs,', shapes.length, 'head shapes' );

// ---------------------------------------------------------------- into our frame, fitted to the egg

// the skull above the brows (not the ears) fitted to the egg R a little inside it (the caps' crowns and
// the knit hats are built on the egg): a scale and a centre found by a search
const eyeL = boneHead( 'eye.L' );
const crania = [];
for ( let i = 0; i < P.length; i ++ ) {

	const p = P[ i ];
	const ear = Math.abs( p[ 0 ] ) > 0.6 && p[ 1 ] < eyeL[ 1 ] + 0.35 && p[ 2 ] < 0.8;
	if ( p[ 1 ] > eyeL[ 1 ] + 0.25 && ! ear && p[ 2 ] < 1.2 ) crania.push( p );

}

// (and the chin no lower than CHIN of the egg's height under its centre: the figures' necks were made
// for the egg, whose chin was 4 cm short of a real one's; a real head's put on them sits that much higher
// on its neck, its skull's crown up into the caps' room over the egg)
const jawTail = boneTail( 'jaw' ), CHIN = - 1.16;
let fit = null;
for ( let s = 0.8; s <= 1.2; s += 0.005 ) for ( let y0 = 7.2; y0 <= 8.0; y0 += 0.01 ) for ( let z0 = 0.2; z0 <= 1.0; z0 += 0.02 ) {

	let e = 0, out = 0;
	for ( const p of crania ) {

		const q = Math.hypot( p[ 0 ] * 0.1 * s / R[ 0 ], ( p[ 1 ] - y0 ) * 0.1 * s / R[ 1 ], ( p[ 2 ] - z0 ) * 0.1 * s / R[ 2 ] );
		// (the band, under the cap's crown, close: the crown's 5 mm over the egg there; higher up there's room)
		const band = p[ 1 ] < y0 + 0.5;
		e += ( q - 0.955 ) ** 2 * ( band ? 1 : 0.3 );
		if ( band && q > 1.0 ) out += ( q - 1.0 ) ** 2 * 60;

	}

	const cy = ( jawTail[ 1 ] - y0 ) * 0.1 * s / R[ 1 ];
	if ( cy < CHIN ) out += ( CHIN - cy ) ** 2 * crania.length * 4;
	if ( ! fit || e + out < fit.e ) fit = { e: e + out, s, y0, z0 };

}

const SC = 0.1 * fit.s;
const ours = ( p ) => [ - p[ 0 ] * SC, ( p[ 1 ] - fit.y0 ) * SC, - ( p[ 2 ] - fit.z0 ) * SC ];
const oursD = ( d ) => [ - d[ 0 ] * SC, d[ 1 ] * SC, - d[ 2 ] * SC ];
console.log( 'fit: scale', fit.s.toFixed( 3 ), 'centre y', fit.y0.toFixed( 2 ), 'z', fit.z0.toFixed( 2 ), 'rms', Math.sqrt( fit.e / crania.length ).toFixed( 3 ) );
const Pm = P; // MakeHuman's frame (the landmarks)
P = Pm.map( ours );
const toOurs = ( D ) => {

	const O = new Float64Array( D.length );
	for ( let i = 0; i < D.length; i += 3 ) O.set( oursD( [ D[ i ], D[ i + 1 ], D[ i + 2 ] ] ), i );
	return O;

};
for ( const k of Object.keys( macro ) ) macro[ k ] = toOurs( macro[ k ] );
for ( const k of Object.keys( weightT ) ) weightT[ k ] = toOurs( weightT[ k ] );
for ( const m of mods ) { m.lo = toOurs( m.lo ); m.hi = toOurs( m.hi ); }
for ( let i = 0; i < shapes.length; i ++ ) shapes[ i ] = toOurs( shapes[ i ] );

// ---------------------------------------------------------------- the paint's frame

// MakeHuman's landmarks, in the egg's unit space (d = p / R)
const dOf = ( p ) => [ p[ 0 ] / R[ 0 ], p[ 1 ] / R[ 1 ], p[ 2 ] / R[ 2 ] ];
const LM = {};
{

	const eye = dOf( ours( eyeL ) );
	LM.eyeY = eye[ 1 ];
	LM.eyeX = Math.abs( eye[ 0 ] );
	LM.mouthY = dOf( ours( mul( add( boneHead( 'oris01' ), boneHead( 'oris05' ) ), 0.5 ) ) )[ 1 ];
	// the profile down the middle of the face: the nose's tip, the root under it, the chin's foot
	const mid = P.map( ( p, i ) => [ p, i ] ).filter( ( [ p ] ) => Math.abs( p[ 0 ] ) < 0.002 && p[ 2 ] < - 0.03 );
	const tip = mid.reduce( ( a, b ) => ( b[ 0 ][ 2 ] < a[ 0 ][ 2 ] ? b : a ) );
	LM.tipY = dOf( tip[ 0 ] )[ 1 ];
	const under = mid.filter( ( [ p ] ) => p[ 1 ] < tip[ 0 ][ 1 ] && dOf( p )[ 1 ] > LM.mouthY + 0.05 );
	const sn = under.reduce( ( a, b ) => ( b[ 0 ][ 2 ] > a[ 0 ][ 2 ] ? b : a ) );
	LM.noseY = dOf( sn[ 0 ] )[ 1 ];
	// the chin's foot: the jaw bone's end (build-body's face.jaw)
	LM.chinY = dOf( ours( boneTail( 'jaw' ) ) )[ 1 ];
	LM.topY = Math.max( ...P.map( ( p ) => dOf( p )[ 1 ] ) );
	// the brows: two and a quarter centimetres over the eyes' middles
	LM.browY = LM.eyeY + 0.0225 / R[ 1 ];
	// the mouth's corners: the lips' slit's ends
	const slit = P.map( ( p ) => dOf( p ) ).filter( ( d ) => Math.abs( d[ 1 ] - LM.mouthY ) < 0.06 && d[ 2 ] < - 0.6 );
	LM.mouthX = 0.023 * fit.s / R[ 0 ]; // (the oris ring's ends at 0.19, the corners a little out from them)
	console.log( 'landmarks (d):', Object.fromEntries( Object.entries( LM ).map( ( [ k, v ] ) => [ k, + v.toFixed( 3 ) ] ) ), slit.length );

}

// the vertices every level keeps (in our frame): found on the mesh from MakeHuman's landmarks
const LOCKS = [], ALWAYS = [];
{

	const near = ( q, test ) => P.reduce( ( b, p ) => ( test( p ) && ( ! b || len( sub( p, q ) ) < len( sub( b, q ) ) ) ? p : b ), null );
	const mid = P.filter( ( p ) => Math.abs( p[ 0 ] ) < 0.002 );
	const tip = mid.reduce( ( a, b ) => ( b[ 2 ] < a[ 2 ] ? b : a ) );
	const at = ( x, yD, test = () => true ) => near( [ x, yD * R[ 1 ], - 0.2 ], ( p ) => Math.abs( p[ 1 ] - yD * R[ 1 ] ) < 0.004 && Math.abs( Math.abs( p[ 0 ] ) - Math.abs( x ) ) < 0.003 && p[ 0 ] * x >= 0 && test( p ) );
	const front = ( p ) => p[ 2 ] < - 0.04;
	const add1 = ( p ) => { if ( p ) LOCKS.push( p ); };
	add1( tip );
	for ( const yD of [ LM.noseY, LM.noseY + 0.12, LM.tipY + 0.25, LM.tipY + 0.55, LM.mouthY + 0.12, LM.mouthY + 0.05, LM.mouthY - 0.07, LM.mouthY - 0.17, LM.chinY + 0.2, LM.chinY + 0.08, LM.browY, LM.browY + 0.25 ] ) {

		const ps = mid.filter( ( p ) => Math.abs( p[ 1 ] / R[ 1 ] - yD ) < 0.04 && front( p ) );
		if ( ps.length ) add1( ps.reduce( ( a, b ) => ( b[ 2 ] < a[ 2 ] ? b : a ) ) );

	}

	for ( const s of [ - 1, 1 ] ) {

		const ex = LM.eyeX * R[ 0 ] * s;
		add1( at( s * 0.0175, LM.noseY + 0.06, front ) ); // the wings
		add1( at( s * 0.0095, LM.noseY + 0.02, front ) ); // the nostrils
		add1( at( s * 0.011, LM.tipY + 0.1, front ) ); // the tip's sides
		add1( at( s * 0.023 * fit.s, LM.mouthY, front ) ); // the corners
		add1( at( s * 0.012, LM.mouthY + 0.06, front ) );
		add1( at( s * 0.012, LM.mouthY - 0.08, front ) );
		add1( at( ex - s * 0.016, LM.eyeY, front ) ); // the eyes' corners
		add1( at( ex + s * 0.017, LM.eyeY, front ) );
		add1( at( ex, LM.eyeY + 0.1, front ) ); // the lids
		add1( at( ex, LM.eyeY - 0.08, front ) );
		add1( at( ex, LM.browY, front ) ); // the brow
		add1( at( ex + s * 0.02, LM.browY - 0.02, front ) );
		add1( at( s * 0.03, LM.chinY + 0.15, front ) ); // the chin's and jaw's corners
		add1( at( s * 0.05, LM.mouthY - 0.1 ) ); // the cheeks
		add1( at( s * 0.055, LM.eyeY - 0.25 ) );

	}

	// and the skull's round (kept at every level, the last too: its top went to a point): the crown, the
	// back, the sides, the forehead, the temples
	const skull = ( d ) => near( [ d[ 0 ] * R[ 0 ], d[ 1 ] * R[ 1 ], d[ 2 ] * R[ 2 ] ], () => true );
	for ( const d of [ [ 0, 1, 0 ], [ 0, 0.75, 0.66 ], [ 0, 0.2, 1 ], [ 0, 0.75, - 0.66 ], [ 0.7, 0.7, 0 ], [ - 0.7, 0.7, 0 ], [ 0.95, 0.25, 0.1 ], [ - 0.95, 0.25, 0.1 ],
		[ 0.5, 0.6, 0.6 ], [ - 0.5, 0.6, 0.6 ], [ 0.5, 0.6, - 0.6 ], [ - 0.5, 0.6, - 0.6 ] ] ) {

		const q = Math.hypot( ...d );
		ALWAYS.push( skull( d.map( ( x ) => x / q ) ) );

	}

	console.log( 'locked landmarks:', LOCKS.length, '+', ALWAYS.length );

}

// the egg's (the paint's) values for the same landmarks
const PY = [ [ LM.chinY, - 0.85 ], [ LM.mouthY, - 0.45 ], [ LM.noseY, - 0.24 ], [ LM.eyeY, 0.1 ], [ LM.browY, 0.3 ], [ LM.topY, 1.0 ] ];
function warpY( y ) {

	if ( y <= PY[ 0 ][ 0 ] ) return PY[ 0 ][ 1 ] + ( y - PY[ 0 ][ 0 ] ) * ( PY[ 1 ][ 1 ] - PY[ 0 ][ 1 ] ) / ( PY[ 1 ][ 0 ] - PY[ 0 ][ 0 ] );
	for ( let k = 1; k < PY.length; k ++ ) if ( y <= PY[ k ][ 0 ] ) {

		const [ a0, b0 ] = PY[ k - 1 ], [ a1, b1 ] = PY[ k ];
		return b0 + ( y - a0 ) * ( b1 - b0 ) / ( a1 - a0 );

	}

	return 1 + ( y - LM.topY );

}

// across: in front, the eyes to 0.34 and the mouth's corners to 0.25; the sides and the back as they are
function warpX( d ) {

	const fe = 0.34 / LM.eyeX, fm = 0.25 / LM.mouthX;
	const f = d[ 1 ] >= LM.eyeY ? fe : d[ 1 ] <= LM.mouthY ? fm : fm + ( fe - fm ) * ( d[ 1 ] - LM.mouthY ) / ( LM.eyeY - LM.mouthY );
	const front = smooth( - 0.35, - 0.8, d[ 2 ] ) * ( 1 - smooth( 0.55, 0.9, Math.abs( d[ 0 ] ) ) );
	return d[ 0 ] * ( 1 + ( f - 1 ) * front );

}

const paintOf = ( p ) => {

	const d = dOf( p );
	return [ warpX( d ), warpY( d[ 1 ] ), d[ 2 ] ];

};

// ---------------------------------------------------------------- how much each vertex matters

// the face is looked at, the back of the skull is under a cap or the hair, the neck's in the collar
const weightOf = ( p ) => {

	const d = dOf( p ), pd = paintOf( p );
	const face = smooth( - 0.2, - 0.7, d[ 2 ] ) * smooth( - 1.0, - 0.75, pd[ 1 ] ) * ( 1 - smooth( 0.45, 0.6, pd[ 1 ] ) );
	const ear = smooth( 0.8, 0.95, Math.abs( d[ 0 ] ) ) * ( 1 - smooth( 0.3, 0.5, Math.abs( pd[ 1 ] ) ) );
	const neck = smooth( - 0.9, - 1.2, pd[ 1 ] ) * ( 1 - face );
	return ( 1 + 5 * face + 1.5 * ear ) * ( 1 - 0.6 * neck ) * ( d[ 2 ] > 0.3 && pd[ 1 ] > 0.2 ? 0.6 : 1 );

};

// ---------------------------------------------------------------- the levels: half-edge collapses

// mirrored partners (MakeHuman's mesh is symmetric)
const mirror = new Int32Array( P.length ).fill( - 1 );
{

	const key = ( p ) => `${ Math.round( p[ 0 ] * 2e4 ) },${ Math.round( p[ 1 ] * 2e4 ) },${ Math.round( p[ 2 ] * 2e4 ) }`;
	const at = new Map();
	P.forEach( ( p, i ) => at.set( key( p ), i ) );
	let found = 0;
	P.forEach( ( p, i ) => {

		const j = at.get( key( [ - p[ 0 ], p[ 1 ], p[ 2 ] ] ) );
		if ( j !== undefined ) { mirror[ i ] = j; found ++; }

	} );
	console.log( 'mirrored pairs:', found, 'of', P.length );

}

function simplify( targets ) {

	const n = P.length;
	const T = tris.map( ( t ) => t.slice() );
	const alive = new Uint8Array( T.length ).fill( 1 );
	const vf = P.map( () => new Set() );
	T.forEach( ( t, f ) => t.forEach( ( i ) => vf[ i ].add( f ) ) );
	const dead = new Uint8Array( n );
	const W = P.map( weightOf );
	// the quadrics (10 numbers each), area-weighted planes
	const Q = P.map( () => new Float64Array( 10 ) );
	const addPlane = ( q, nrm, d, w ) => {

		const [ a, b, c ] = nrm;
		const v = [ a * a, a * b, a * c, a * d, b * b, b * c, b * d, c * c, c * d, d * d ];
		for ( let k = 0; k < 10; k ++ ) q[ k ] += v[ k ] * w;

	};
	for ( const t of T ) {

		const fn = cross( sub( P[ t[ 1 ] ], P[ t[ 0 ] ] ), sub( P[ t[ 2 ] ], P[ t[ 0 ] ] ) );
		const area = len( fn ) / 2;
		if ( area < 1e-14 ) continue;
		const nn = norm( fn );
		// (each face's plane counts the same, not by its area: MakeHuman's mesh is finest where the face has
		// its detail, the nose, the lips and the eyes' lids, which area weights made the cheapest to lose)
		for ( const i of t ) addPlane( Q[ i ], nn, - dot( nn, P[ t[ 0 ] ] ), 1e-4 );

	}

	// open edges (the neck): kept by planes across them, heavily
	const boundary = new Uint8Array( n );
	const edgeCount = new Map();
	const ek = ( a, b ) => a < b ? a * n + b : b * n + a;
	for ( const t of T ) for ( let k = 0; k < 3; k ++ ) { const e = ek( t[ k ], t[ ( k + 1 ) % 3 ] ); edgeCount.set( e, ( edgeCount.get( e ) || 0 ) + 1 ); }
	for ( const t of T ) for ( let k = 0; k < 3; k ++ ) {

		const a = t[ k ], b = t[ ( k + 1 ) % 3 ];
		if ( edgeCount.get( ek( a, b ) ) !== 1 ) continue;
		boundary[ a ] = boundary[ b ] = 1;
		const fn = norm( cross( sub( P[ t[ 1 ] ], P[ t[ 0 ] ] ), sub( P[ t[ 2 ] ], P[ t[ 0 ] ] ) ) );
		const nn = norm( cross( sub( P[ b ], P[ a ] ), fn ) );
		const w = 5e-3;
		addPlane( Q[ a ], nn, - dot( nn, P[ a ] ), w );
		addPlane( Q[ b ], nn, - dot( nn, P[ a ] ), w );

	}

	const locked = new Uint8Array( n );
	for ( const L of [ ...LOCKS, ...ALWAYS ] ) {

		let best = 0;
		P.forEach( ( p, i ) => { if ( len( sub( p, L ) ) < len( sub( P[ best ], L ) ) ) best = i; } );
		locked[ best ] = ALWAYS.includes( L ) ? 2 : 1;

	}

	const qerr = ( q, p ) => {

		const [ x, y, z ] = p;
		return q[ 0 ] * x * x + 2 * q[ 1 ] * x * y + 2 * q[ 2 ] * x * z + 2 * q[ 3 ] * x + q[ 4 ] * y * y + 2 * q[ 5 ] * y * z + 2 * q[ 6 ] * y + q[ 7 ] * z * z + 2 * q[ 8 ] * z + q[ 9 ];

	};
	const nbrs = ( u ) => {

		const s = new Set();
		for ( const f of vf[ u ] ) for ( const i of T[ f ] ) if ( i !== u ) s.add( i );
		return s;

	};
	const isBoundaryEdge = ( a, b ) => {

		let c = 0;
		for ( const f of vf[ a ] ) if ( T[ f ].includes( b ) ) c ++;
		return c === 1;

	};
	// may u go to v? (never a landmark: the nose's tip, its underside and wings, the lips and their corners,
	// the chin, the eyes' corners and the brows' ridge keep their own vertices at every level)
	const valid = ( u, v ) => {

		if ( dead[ u ] || dead[ v ] || u === v || locked[ u ] ) return false;
		let shared = 0;
		for ( const f of vf[ u ] ) if ( T[ f ].includes( v ) ) shared ++;
		if ( ! shared ) return false;
		const bEdge = shared === 1;
		if ( boundary[ u ] && ! bEdge ) return false;
		const nu = nbrs( u ), nv = nbrs( v );
		let common = 0;
		for ( const x of nu ) if ( nv.has( x ) ) common ++;
		if ( common !== ( bEdge ? 1 : 2 ) ) return false;
		// no face turned over or squeezed to a sliver
		for ( const f of vf[ u ] ) {

			const t = T[ f ];
			if ( t.includes( v ) ) continue;
			const q = t.map( ( i ) => ( i === u ? P[ v ] : P[ i ] ) );
			const n0 = cross( sub( P[ t[ 1 ] ], P[ t[ 0 ] ] ), sub( P[ t[ 2 ] ], P[ t[ 0 ] ] ) );
			const n1 = cross( sub( q[ 1 ], q[ 0 ] ), sub( q[ 2 ], q[ 0 ] ) );
			if ( dot( norm( n0 ), norm( n1 ) ) < 0.35 ) return false;
			const a2 = len( n1 ), e = Math.max( len( sub( q[ 1 ], q[ 0 ] ) ), len( sub( q[ 2 ], q[ 1 ] ) ), len( sub( q[ 0 ], q[ 2 ] ) ) );
			if ( a2 < 0.04 * e * e ) return false;

		}

		return true;

	};
	const sym = ( u, v ) => {

		const mu = mirror[ u ], mv = mirror[ v ];
		if ( mu < 0 || mv < 0 ) return null;
		if ( mu === v ) return false; // across the middle
		if ( mu === u && mv !== v ) return false; // the middle stays the middle
		if ( mu === u ) return null; // both on the middle: one collapse
		return [ mu, mv ];

	};
	const costOf = ( u, v ) => {

		const q = new Float64Array( 10 );
		for ( let k = 0; k < 10; k ++ ) q[ k ] = Q[ u ][ k ] + Q[ v ][ k ];
		return Math.max( 0, qerr( q, P[ v ] ) ) * W[ u ];

	};

	// the heap
	const heap = [];
	const push = ( c, u, v ) => {

		heap.push( [ c, u, v, stamp[ u ], stamp[ v ] ] );
		let i = heap.length - 1;
		while ( i > 0 ) {

			const p = ( i - 1 ) >> 1;
			if ( heap[ p ][ 0 ] <= heap[ i ][ 0 ] ) break;
			[ heap[ p ], heap[ i ] ] = [ heap[ i ], heap[ p ] ];
			i = p;

		}

	};
	const pop = () => {

		const top = heap[ 0 ], last = heap.pop();
		if ( heap.length ) {

			heap[ 0 ] = last;
			let i = 0;
			for ( ;; ) {

				const l = 2 * i + 1, r = l + 1;
				let m = i;
				if ( l < heap.length && heap[ l ][ 0 ] < heap[ m ][ 0 ] ) m = l;
				if ( r < heap.length && heap[ r ][ 0 ] < heap[ m ][ 0 ] ) m = r;
				if ( m === i ) break;
				[ heap[ m ], heap[ i ] ] = [ heap[ i ], heap[ m ] ];
				i = m;

			}

		}

		return top;

	};
	const stamp = new Uint32Array( n );
	const pushAround = ( v ) => {

		for ( const w of nbrs( v ) ) {

			push( costOf( v, w ) + ( sym( v, w ) ? costOf( mirror[ v ], mirror[ w ] ) : 0 ), v, w );
			push( costOf( w, v ) + ( sym( w, v ) ? costOf( mirror[ w ], mirror[ v ] ) : 0 ), w, v );

		}

	};
	for ( let u = 0; u < n; u ++ ) for ( const v of nbrs( u ) ) push( costOf( u, v ) + ( sym( u, v ) ? costOf( mirror[ u ], mirror[ v ] ) : 0 ), u, v );

	const collapse = ( u, v ) => {

		for ( const f of [ ...vf[ u ] ] ) {

			const t = T[ f ];
			if ( t.includes( v ) ) {

				alive[ f ] = 0;
				for ( const i of t ) vf[ i ].delete( f );
				live --;

			} else {

				t[ t.indexOf( u ) ] = v;
				vf[ v ].add( f );

			}

		}

		vf[ u ].clear();
		dead[ u ] = 1;
		for ( let k = 0; k < 10; k ++ ) Q[ v ][ k ] += Q[ u ][ k ];
		W[ v ] = Math.max( W[ v ], W[ u ] );
		stamp[ v ] ++;

	};

	let live = T.length;
	const out = [];
	const goals = targets.slice().sort( ( a, b ) => b - a );
	while ( heap.length && goals.length ) {

		const [ , u, v, su, sv ] = pop();
		if ( dead[ u ] || dead[ v ] || su !== stamp[ u ] || sv !== stamp[ v ] ) continue;
		if ( ! valid( u, v ) ) continue;
		const s = sym( u, v );
		if ( s === false ) continue;
		if ( s && ! valid( s[ 0 ], s[ 1 ] ) && live > 300 ) continue;
		collapse( u, v );
		pushAround( v );
		if ( s && valid( s[ 0 ], s[ 1 ] ) ) {

			collapse( s[ 0 ], s[ 1 ] );
			pushAround( s[ 1 ] );

		}

		while ( goals.length && live <= goals[ 0 ] ) {

			out.push( T.filter( ( t, f ) => alive[ f ] ).map( ( t ) => t.slice() ) );
			goals.shift();
			// (the last level, for a head 15-40 px tall, lets the landmarks go: its few triangles go where
			// the error is least)
			if ( goals.length === 1 ) for ( let i = 0; i < n; i ++ ) if ( locked[ i ] === 1 && ! dead[ i ] ) {

				locked[ i ] = 0;
				pushAround( i );

			}

		}

	}

	console.log( 'simplified to', live, 'triangles' );
	return out;

}

const levelTris = simplify( LEVELS.map( ( l ) => l[ 1 ] ) );
levelTris.forEach( ( T, k ) => console.log( `level ${ LEVELS[ k ][ 0 ] }: ${ T.length } triangles, ${ new Set( T.flat() ).size } vertices` ) );

// ---------------------------------------------------------------- the faces of the crowd, and their components

// The union of the levels' vertices (every coarser level's are among the finest one's)
const keepV = [ ...new Set( levelTris[ 0 ].flat() ) ].sort( ( a, b ) => a - b );
const U = keepV.length;
const vix = new Map( keepV.map( ( v, i ) => [ v, i ] ) );
const sel = ( D ) => {

	const o = new Float64Array( U * 3 );
	keepV.forEach( ( v, i ) => { o[ i * 3 ] = D[ v * 3 ]; o[ i * 3 + 1 ] = D[ v * 3 + 1 ]; o[ i * 3 + 2 ] = D[ v * 3 + 2 ]; } );
	return o;

};
for ( const k of Object.keys( macro ) ) macro[ k ] = sel( macro[ k ] );
for ( const k of Object.keys( weightT ) ) weightT[ k ] = sel( weightT[ k ] );
for ( const m of mods ) { m.lo = sel( m.lo ); m.hi = sel( m.hi ); }
for ( let i = 0; i < shapes.length; i ++ ) shapes[ i ] = sel( shapes[ i ] );
const base = new Float64Array( U * 3 );
keepV.forEach( ( v, i ) => base.set( P[ v ], i * 3 ) );
const Wv = keepV.map( ( v ) => weightOf( P[ v ] ) );
// the fit's own points (the skull and the face, not the neck nor the ears) for taking out each face's
// own size and place: the stands' and the Cast's shaders size the heads themselves
const fitW = keepV.map( ( v ) => {

	const pd = paintOf( P[ v ] ), d = dOf( P[ v ] );
	return pd[ 1 ] > - 0.85 && Math.abs( d[ 0 ] ) < 0.8 ? 1 : 0;

} );

// one of the crowd: who (the features the shaders know) and his face's own make-up
//  features: [ female, kid, old, african, asian, weight ]
function person( r ) {

	const u = r();
	const age = u < 0.06 ? 'kid' : u < 0.13 ? 'teen' : u < 0.28 ? 'old' : 'adult';
	const female = r() < ( age === 'kid' ? 0.45 : 0.4 ) ? 1 : 0;
	// the fans' skin (Crowd.js randomFan's mix) and the faces likely under it
	const skin = pickW( r, { 0: 22, 1: 26, 2: 16, 7: 9, 3: 11, 4: 7, 5: 5, 6: 4 } );
	const [ af, as ] = ethnicOf( skin, r );
	const build = age === 'kid' ? 0 : female ? pickW( r, { 0: 35, 1: 55, 2: 10 } ) : pickW( r, { 0: 18, 1: 48, 2: 24, 3: 10 } );
	const wt = clamp( [ - 0.5, 0, 0.35, 0.75 ][ build ] + 0.15 * gauss( r ), - 1, 1 );
	const old = age === 'old' ? 0.45 + 0.3 * r() : age === 'adult' ? 0.45 * r() : 0;
	const kid = age === 'kid' ? 1 : age === 'teen' ? 0.6 + 0.2 * r() : 0;
	return { f: [ female, kid, old, af, as, wt ], gen: female ? 0.85 + 0.15 * r() : 0.15 * r(), kid, old, af, as, wt, r };

}

function pickW( r, w ) {

	const tot = Object.values( w ).reduce( ( a, b ) => a + b, 0 );
	let x = r() * tot;
	for ( const [ k, v ] of Object.entries( w ) ) if ( ( x -= v ) < 0 ) return + k;
	return + Object.keys( w )[ 0 ];

}

// the faces likely under each of the palette's skins (pale to dark, 7 olive), MakeHuman's african and
// asian shares (the rest caucasian), each person a little their own mix
export const ETHNIC = [ [ 0.02, 0.02 ], [ 0.03, 0.03 ], [ 0.08, 0.06 ], [ 0.35, 0.1 ], [ 0.72, 0.04 ], [ 0.85, 0.03 ], [ 0.92, 0.02 ], [ 0.12, 0.55 ] ];
function ethnicOf( skin, r ) {

	const [ a, b ] = ETHNIC[ skin ];
	const af = clamp( a + 0.08 * gauss( r ), 0, 1 ), as = clamp( b + 0.08 * gauss( r ), 0, 1 - af );
	return [ af, as ];

}

// MakeHuman's own mix of its corner targets: gender (0 male .. 1 female), the age (child, young, old) and the
// three ethnic shares, then the weight
function shapeOf( p ) {

	const D = new Float64Array( U * 3 );
	const ages = p.kid > 0 ? { child: p.kid, young: 1 - p.kid } : { young: 1 - p.old, old: p.old };
	const eth = { african: p.af, asian: p.as, caucasian: 1 - p.af - p.as };
	const gen = { male: 1 - p.gen, female: p.gen };
	for ( const e of ETH ) for ( const g of GEN ) for ( const [ a, wa ] of Object.entries( ages ) ) {

		const w = eth[ e ] * gen[ g ] * wa;
		if ( w < 1e-4 ) continue;
		const T = macro[ `${ e }-${ g }-${ a }` ];
		for ( let i = 0; i < D.length; i ++ ) D[ i ] += w * T[ i ];

	}

	for ( const g of GEN ) {

		const wg = gen[ g ];
		const T = p.wt > 0 ? weightT[ `${ g }-maxweight` ] : weightT[ `${ g }-minweight` ];
		const A = weightT[ `${ g }-averageweight` ];
		for ( let i = 0; i < D.length; i ++ ) D[ i ] += wg * ( A[ i ] + Math.abs( p.wt ) * ( T[ i ] - A[ i ] ) );

	}

	// his own face: each modifier a little either way (a few a lot), a head shape for some
	const r = p.r;
	for ( const m of mods ) {

		let v = 0.33 * gauss( r );
		if ( r() < 0.08 ) v *= 2;
		v = clamp( v, - 1, 1 );
		const T = v > 0 ? m.hi : m.lo;
		const a = Math.abs( v );
		for ( let i = 0; i < D.length; i ++ ) D[ i ] += a * T[ i ];

	}

	if ( r() < 0.6 ) {

		const T = shapes[ Math.floor( r() * shapes.length ) ], a = 0.5 * r();
		for ( let i = 0; i < D.length; i ++ ) D[ i ] += a * T[ i ];

	}

	// his own size and place taken out (the fit: the shift and scale that best put him on the base)
	let cx = 0, cy = 0, cz = 0, bx = 0, by = 0, bz = 0, nw = 0;
	for ( let i = 0; i < U; i ++ ) if ( fitW[ i ] ) {

		cx += base[ i * 3 ] + D[ i * 3 ]; cy += base[ i * 3 + 1 ] + D[ i * 3 + 1 ]; cz += base[ i * 3 + 2 ] + D[ i * 3 + 2 ];
		bx += base[ i * 3 ]; by += base[ i * 3 + 1 ]; bz += base[ i * 3 + 2 ];
		nw ++;

	}

	cx /= nw; cy /= nw; cz /= nw; bx /= nw; by /= nw; bz /= nw;
	let sxy = 0, sxx = 0;
	for ( let i = 0; i < U; i ++ ) if ( fitW[ i ] ) {

		const x = [ base[ i * 3 ] + D[ i * 3 ] - cx, base[ i * 3 + 1 ] + D[ i * 3 + 1 ] - cy, base[ i * 3 + 2 ] + D[ i * 3 + 2 ] - cz ];
		const b = [ base[ i * 3 ] - bx, base[ i * 3 + 1 ] - by, base[ i * 3 + 2 ] - bz ];
		sxy += dot( x, b ); sxx += dot( x, x );

	}

	const s = sxy / sxx;
	for ( let i = 0; i < U; i ++ ) {

		D[ i * 3 ] = ( base[ i * 3 ] + D[ i * 3 ] - cx ) * s + bx - base[ i * 3 ];
		D[ i * 3 + 1 ] = ( base[ i * 3 + 1 ] + D[ i * 3 + 1 ] - cy ) * s + by - base[ i * 3 + 1 ];
		D[ i * 3 + 2 ] = ( base[ i * 3 + 2 ] + D[ i * 3 + 2 ] - cz ) * s + bz - base[ i * 3 + 2 ];

	}

	return D;

}

const people = [], X = [];
for ( let s = 0; s < SAMPLES; s ++ ) {

	const p = person( rng( 1000 + s * 7919 ) );
	people.push( p );
	X.push( shapeOf( p ) );

}

// the mean face (the base becomes it) and the components, weighted by how much each vertex matters
const mean = new Float64Array( U * 3 );
for ( const D of X ) for ( let i = 0; i < mean.length; i ++ ) mean[ i ] += D[ i ] / SAMPLES;
const sw = new Float64Array( U * 3 );
for ( let i = 0; i < U; i ++ ) sw[ i * 3 ] = sw[ i * 3 + 1 ] = sw[ i * 3 + 2 ] = Math.sqrt( Wv[ i ] );
const Y = X.map( ( D ) => D.map( ( x, i ) => ( x - mean[ i ] ) * sw[ i ] ) );
// the samples' Gram matrix, and its leading eigenvectors (subspace iteration)
const S = SAMPLES;
const G = new Float64Array( S * S );
for ( let a = 0; a < S; a ++ ) for ( let b = a; b < S; b ++ ) {

	let s = 0;
	const ya = Y[ a ], yb = Y[ b ];
	for ( let i = 0; i < ya.length; i ++ ) s += ya[ i ] * yb[ i ];
	G[ a * S + b ] = G[ b * S + a ] = s;

}

let total = 0;
for ( let a = 0; a < S; a ++ ) total += G[ a * S + a ];
const KK = K + 4;
let Bv = Array.from( { length: KK }, () => Float64Array.from( { length: S }, () => gauss() ) );
for ( let it = 0; it < 60; it ++ ) {

	Bv = Bv.map( ( b ) => {

		const o = new Float64Array( S );
		for ( let a = 0; a < S; a ++ ) {

			let s = 0;
			for ( let c = 0; c < S; c ++ ) s += G[ a * S + c ] * b[ c ];
			o[ a ] = s;

		}

		return o;

	} );
	// Gram-Schmidt
	for ( let k = 0; k < KK; k ++ ) {

		for ( let j = 0; j < k; j ++ ) {

			let d = 0;
			for ( let a = 0; a < S; a ++ ) d += Bv[ k ][ a ] * Bv[ j ][ a ];
			for ( let a = 0; a < S; a ++ ) Bv[ k ][ a ] -= d * Bv[ j ][ a ];

		}

		let l = 0;
		for ( let a = 0; a < S; a ++ ) l += Bv[ k ][ a ] ** 2;
		l = Math.sqrt( l );
		for ( let a = 0; a < S; a ++ ) Bv[ k ][ a ] /= l;

	}

}

// eigenvalues (Rayleigh quotients), sorted
const ev = Bv.map( ( b ) => {

	let s = 0;
	for ( let a = 0; a < S; a ++ ) { let t = 0; for ( let c = 0; c < S; c ++ ) t += G[ a * S + c ] * b[ c ]; s += b[ a ] * t; }
	return s;

} );
const order = ev.map( ( e, k ) => k ).sort( ( a, b ) => ev[ b ] - ev[ a ] ).slice( 0, K );
console.log( 'variance held by', K, 'components:', ( order.reduce( ( a, k ) => a + ev[ k ], 0 ) / total * 100 ).toFixed( 1 ) + '%;', 'each', order.map( ( k ) => ( ev[ k ] / total * 100 ).toFixed( 1 ) ).join( ' ' ) );
// the components in the vertices' space (the weighting taken back out), each scaled to one standard
// deviation of the crowd, so a fan's weights are ~N(0, 1)
const comps = order.map( ( k ) => {

	const c = new Float64Array( U * 3 );
	for ( let a = 0; a < S; a ++ ) {

		const w = Bv[ k ][ a ];
		const y = Y[ a ];
		for ( let i = 0; i < c.length; i ++ ) c[ i ] += w * y[ i ];

	}

	const sd = Math.sqrt( ev[ k ] / S );
	let l = 0;
	for ( let i = 0; i < c.length; i ++ ) l += c[ i ] ** 2;
	l = Math.sqrt( l );
	for ( let i = 0; i < c.length; i ++ ) c[ i ] = c[ i ] / l * sd / sw[ i ];
	return c;

} );
// each sample's weights, in standard deviations: its projection on the unit eigenvector in the weighted
// space, v_k = sum_a B_k[a] Y_a / sqrt( ev_k ), is B_k[s] sqrt( ev_k ), over the deviation sqrt( ev_k / S )
const coef = Y.map( ( y, s ) => order.map( ( k ) => Bv[ k ][ s ] * Math.sqrt( S ) ) );

// who he is -> his weights: a linear fit (A, about the features' means), and what it doesn't explain as a
// spread of its own (L, the Cholesky of the leftovers' covariance), drawn from his seed
const F = 6, FN = [ 'female', 'kid', 'old', 'african', 'asian', 'weight' ];
const fm = new Array( F ).fill( 0 );
for ( const p of people ) p.f.forEach( ( x, i ) => { fm[ i ] += x / S; } );
// normal equations: (Ft F) A' = Ft C
const FtF = Array.from( { length: F }, () => new Array( F ).fill( 0 ) ), FtC = Array.from( { length: F }, () => new Array( K ).fill( 0 ) );
people.forEach( ( p, s ) => {

	const f = p.f.map( ( x, i ) => x - fm[ i ] );
	for ( let i = 0; i < F; i ++ ) {

		for ( let j = 0; j < F; j ++ ) FtF[ i ][ j ] += f[ i ] * f[ j ];
		for ( let k = 0; k < K; k ++ ) FtC[ i ][ k ] += f[ i ] * coef[ s ][ k ];

	}

} );
function solve( Mx, B ) {

	const n = Mx.length, m = B[ 0 ].length;
	const A = Mx.map( ( r, i ) => [ ...r, ...B[ i ] ] );
	for ( let c = 0; c < n; c ++ ) {

		let p = c;
		for ( let r = c + 1; r < n; r ++ ) if ( Math.abs( A[ r ][ c ] ) > Math.abs( A[ p ][ c ] ) ) p = r;
		[ A[ c ], A[ p ] ] = [ A[ p ], A[ c ] ];
		for ( let r = 0; r < n; r ++ ) if ( r !== c ) {

			const k = A[ r ][ c ] / A[ c ][ c ];
			for ( let j = c; j < n + m; j ++ ) A[ r ][ j ] -= k * A[ c ][ j ];

		}

	}

	return A.map( ( r, i ) => r.slice( n ).map( ( x ) => x / r[ i ] ) );

}

for ( let i = 0; i < F; i ++ ) FtF[ i ][ i ] += 1e-6;
const At = solve( FtF, FtC ); // F x K
const cm = new Array( K ).fill( 0 );
for ( const c of coef ) c.forEach( ( x, k ) => { cm[ k ] += x / S; } );
const res = people.map( ( p, s ) => {

	const f = p.f.map( ( x, i ) => x - fm[ i ] );
	return coef[ s ].map( ( c, k ) => c - cm[ k ] - f.reduce( ( a, x, i ) => a + x * At[ i ][ k ], 0 ) );

} );
const Cr = Array.from( { length: K }, ( _, a ) => Array.from( { length: K }, ( __, b ) => res.reduce( ( s, r ) => s + r[ a ] * r[ b ], 0 ) / S ) );
const L = Array.from( { length: K }, () => new Array( K ).fill( 0 ) );
for ( let i = 0; i < K; i ++ ) for ( let j = 0; j <= i; j ++ ) {

	let s = Cr[ i ][ j ];
	for ( let k = 0; k < j; k ++ ) s -= L[ i ][ k ] * L[ j ][ k ];
	L[ i ][ j ] = i === j ? Math.sqrt( Math.max( s, 1e-9 ) ) : s / L[ j ][ j ];

}

console.log( 'the features explain', ( ( 1 - Cr.reduce( ( a, r, i ) => a + r[ i ], 0 ) / K ) * 100 ).toFixed( 0 ) + '% of the weights\' spread; A (features x components):' );
At.forEach( ( r, i ) => console.log( '  ', FN[ i ].padEnd( 8 ), r.map( ( x ) => x.toFixed( 2 ).padStart( 6 ) ).join( '' ) ) );

// ---------------------------------------------------------------- per level: the mesh, its normals and records

// the base is the crowd's mean face
for ( let i = 0; i < U; i ++ ) for ( let k = 0; k < 3; k ++ ) P[ keepV[ i ] ][ k ] += mean[ i * 3 + k ];

// the ears' fold: onto the egg a little inside it (a hood, a knit hat over them)
const earFold = keepV.map( ( v ) => {

	const p = P[ v ], d = dOf( p ), pd = paintOf( p );
	const q = Math.hypot( ...d );
	const zone = smooth( 0.7, 0.85, Math.abs( d[ 0 ] ) ) * ( 1 - smooth( 0.4, 0.6, Math.abs( pd[ 1 ] ) ) ) * ( 1 - smooth( 0.5, 0.75, Math.abs( d[ 2 ] ) ) );
	if ( q <= 0.97 || zone <= 0 ) return [ 0, 0, 0 ];
	return mul( p, ( 0.97 / q - 1 ) * zone );

} );

const f16 = ( x ) => {

	// IEEE half from a number (round to nearest)
	const f = new Float32Array( 1 ), u = new Uint32Array( f.buffer );
	f[ 0 ] = x;
	const b = u[ 0 ], s = ( b >>> 16 ) & 0x8000;
	let e = ( ( b >>> 23 ) & 0xff ) - 127 + 15, m = b & 0x7fffff;
	if ( e <= 0 ) return s;
	if ( e >= 31 ) return s | 0x7c00;
	m += 0x1000;
	if ( m & 0x800000 ) { m = 0; e ++; }
	return s | ( e << 10 ) | ( m >>> 13 );

};
const pack2 = ( a, b ) => ( f16( a ) | ( f16( b ) << 16 ) ) >>> 0;

const out = [];
levelTris.forEach( ( T0, li ) => {

	const vs = [ ...new Set( T0.flat() ) ].sort( ( a, b ) => a - b );
	const loc = new Map( vs.map( ( v, i ) => [ v, i ] ) );
	const T = T0.map( ( t ) => t.map( ( v ) => loc.get( v ) ) );
	const pos = vs.map( ( v ) => P[ v ] );
	const nrm = vnormals( pos, T );
	// the normals' change along each component (central differences, one standard deviation)
	const dn = comps.map( ( c ) => {

		const at = ( k ) => vnormals( vs.map( ( v ) => { const i = vix.get( v ); return add( P[ v ], mul( [ c[ i * 3 ], c[ i * 3 + 1 ], c[ i * 3 + 2 ] ], k ) ); } ), T );
		const a = at( 1 ), b = at( - 1 );
		return a.map( ( n, i ) => mul( sub( n, b[ i ] ), 0.5 ) );

	} );
	// the records: [ paint x y | paint z, the ears' fold | the fold x y | the fold z, 0 ], then the K shapes'
	// x, y, z (8 halves each) and their normals' x, y, z
	const rec = new Uint32Array( vs.length * 28 );
	vs.forEach( ( v, i ) => {

		const j = vix.get( v );
		const pd = paintOf( sub( P[ v ], [ mean[ j * 3 ], mean[ j * 3 + 1 ], mean[ j * 3 + 2 ] ] ) );
		// (an eyeball's: its d.z set far forward, a mark for the paint)
		if ( src[ v ] >= 0 && eyeSet.has( src[ v ] ) ) pd[ 2 ] = - 3;
		const ef = earFold[ j ], ew = len( ef ) > 1e-5 ? 1 : 0;
		const o = i * 28;
		rec[ o ] = pack2( pd[ 0 ], pd[ 1 ] );
		rec[ o + 1 ] = pack2( pd[ 2 ], ew );
		rec[ o + 2 ] = pack2( ef[ 0 ], ef[ 1 ] );
		rec[ o + 3 ] = pack2( ef[ 2 ], 0 );
		for ( let ax = 0; ax < 3; ax ++ ) for ( let k = 0; k < K; k += 2 ) {

			rec[ o + 4 + ax * 4 + k / 2 ] = pack2( comps[ k ][ j * 3 + ax ], comps[ k + 1 ][ j * 3 + ax ] );
			rec[ o + 16 + ax * 4 + k / 2 ] = pack2( dn[ k ][ i ][ ax ], dn[ k + 1 ][ i ][ ax ] );

		}

	} );
	const Q = 10000;
	const bPos = new Int16Array( vs.length * 3 ), bNrm = new Int8Array( vs.length * 3 );
	pos.forEach( ( p, i ) => { for ( let c = 0; c < 3; c ++ ) { bPos[ i * 3 + c ] = Math.round( p[ c ] * Q ); bNrm[ i * 3 + c ] = Math.round( nrm[ i ][ c ] * 127 ); } } );
	out.push( { name: LEVELS[ li ][ 0 ], count: vs.length, triangles: T.length, position: bPos, normal: bNrm, index: new Uint16Array( T.flat() ), rec } );

} );

// a few faces' worth of numbers, for the checks: the components' size at the nose's tip and the chin
{

	const big = comps.map( ( c ) => { let m = 0; for ( let i = 0; i < U; i ++ ) m = Math.max( m, Math.hypot( c[ i * 3 ], c[ i * 3 + 1 ], c[ i * 3 + 2 ] ) ); return ( m * 1000 ).toFixed( 1 ); } );
	console.log( 'each component\'s largest move (mm, one standard deviation):', big.join( ' ' ) );

}

// ---------------------------------------------------------------- write

const b64 = ( a ) => Buffer.from( a.buffer, a.byteOffset, a.byteLength ).toString( 'base64' );
const r4 = ( x ) => Math.round( x * 1e4 ) / 1e4;
const js = `// Generated by tools/build-fanhead.mjs from the MakeHuman base mesh and its targets (CC0,
// makehumancommunity.org). Don't edit: re-run the tool.
//
// The fans' head, in three levels (near: the Cast's near figure; mid: its middle figure and the seats'
// close level; far: the seats' near level). Positions in metres about the egg's centre (R; ×1e4, int16),
// facing -z, +x his right; normals int8; the records, 28 u32 a vertex (see the tool): the paint's frame and
// the ears' fold, then the ${ K } blend shapes (one standard deviation each) and their normals, as halves.
// A fan's weights: A (features × components) times his features less their means (FM), plus L (lower
// triangular) times his own ${ K } normal draws. Features: ${ FN.join( ', ' ) }.
export const FAN_HEAD = {
	K: ${ K },
	R: ${ JSON.stringify( R ) },
	scale: 10000,
	features: ${ JSON.stringify( FN ) },
	FM: ${ JSON.stringify( fm.map( r4 ) ) },
	A: ${ JSON.stringify( At.map( ( r ) => r.map( r4 ) ) ) },
	L: ${ JSON.stringify( L.map( ( r ) => r.map( r4 ) ) ) },
	ethnic: ${ JSON.stringify( ETHNIC ) },
	levels: {
${ out.map( ( l ) => `		${ l.name }: { count: ${ l.count }, triangles: ${ l.triangles },
			position: '${ b64( l.position ) }',
			normal: '${ b64( l.normal ) }',
			index: '${ b64( l.index ) }',
			rec: '${ b64( l.rec ) }' },` ).join( '\n' ) }
	},
};
`;
writeFileSync( OUT, js );
console.log( 'wrote', OUT, ( js.length / 1024 ).toFixed( 0 ), 'KB' );
