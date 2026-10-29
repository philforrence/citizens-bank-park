import { StorageBuffer } from '../engine/gpu/Texture.js';
import { ShaderModule } from '../engine/gpu/Shader.js';
import { FAN_HEAD } from './game/data/fanHead.js';

// ---- FF1 (step 10): the fans' head, the players' MakeHuman head (tools/build-fanhead.mjs), for the seated
// crowd's close and near levels (Crowd.js) and the Cast's near and middle figures (places/Cast.js).
//
//   fanHeadLevel( name )        'near' (1,200 triangles), 'mid' (400), 'far' (90): positions (m, about the
//                               egg's centre, facing -z, +x his right), normals, the index, and each vertex's
//                               record in the shared buffer (rec: its first record's number)
//   fanHeadBuffer()             the records of every level (the paint's frame, the ears' fold, the blend
//                               shapes and their normals; FF2: the expressions), a storage buffer of
//                               vec4u, 9 a vertex
//   fanHeadModule               WGSL: fhBlend( record, cA, cB, ex, rest ) (the vertex moved by his weights;
//                               FF2: and by his expression's, ex: the mouth open, the smile, the lids shut;
//                               FF3: rest, the lids' own rest when ex is all zero, from the first record),
//                               fhUnpack( w ) (the crowd's packed weights), fhCoefs( ... ) (the Cast's, from
//                               who he is and his seed); the material binds the buffer as fhRec
//   faceWeights( who, seed )    a fan's K weights (the crowd works them out once, on the CPU), and
//   packFace( c )               packed into a u32 (4 bits each) for the crowd's ids
//
// A face is the crowd's mean face moved along K blend shapes, each one standard deviation of the 2008
// crowd's faces as MakeHuman makes them (gender, age and ethnicity by its macro targets, ~60 of its face
// modifiers). His weights: what who he is says (female, a kid, his age, his skin's likely ethnicity, his
// build) by the fit A, and his own share of the rest by L from his seed. The paint keeps to the vertices:
// each carries where it lies in the egg's unit frame the face paint was drawn for (the eyes at 0.1, the
// brows 0.3, the mouth -0.45), warped there from MakeHuman's own landmarks, and it moves with them.

export const FH = FAN_HEAD;
export const FH_K = FAN_HEAD.K;
const REC = FAN_HEAD.REC || 7; // (FF2: 9, the expressions' two)

const dec = ( s, T ) => {

	const b = typeof Buffer !== 'undefined' ? Buffer.from( s, 'base64' ) : Uint8Array.from( atob( s ), ( c ) => c.charCodeAt( 0 ) );
	const copy = new Uint8Array( b.byteLength );
	copy.set( b );
	return new T( copy.buffer );

};

let _levels = null;
function levels() {

	if ( _levels ) return _levels;
	_levels = {};
	let rec = 0;
	for ( const name of [ 'near', 'mid', 'far' ] ) {

		const L = FAN_HEAD.levels[ name ];
		const p = dec( L.position, Int16Array ), n = dec( L.normal, Int8Array );
		const position = new Float32Array( p.length ), normal = new Float32Array( n.length );
		for ( let i = 0; i < p.length; i ++ ) position[ i ] = p[ i ] / FAN_HEAD.scale;
		for ( let i = 0; i < n.length; i += 3 ) {

			const l = Math.hypot( n[ i ], n[ i + 1 ], n[ i + 2 ] ) || 1;
			normal[ i ] = n[ i ] / l; normal[ i + 1 ] = n[ i + 1 ] / l; normal[ i + 2 ] = n[ i + 2 ] / l;

		}

		_levels[ name ] = { count: L.count, triangles: L.triangles, position, normal, index: dec( L.index, Uint16Array ), recs: dec( L.rec, Uint32Array ), rec };
		rec += L.count;

	}

	return _levels;

}

export function fanHeadLevel( name ) {

	return levels()[ name ];

}

let _buf = null;
export function fanHeadBuffer() {

	if ( _buf ) return _buf;
	const L = levels();
	const n = Object.values( L ).reduce( ( a, l ) => a + l.count, 0 );
	const data = new Uint32Array( n * REC * 4 );
	for ( const l of Object.values( L ) ) data.set( l.recs, l.rec * REC * 4 );
	_buf = new StorageBuffer( { label: 'fan heads', count: n * REC, type: 'vec4u', data } );
	return _buf;

}

// who he is -> the features the fit knows: [ female, kid, old, african, asian, weight ]. age: 0 an adult, 1
// old, 2 a kid, 3 a teenager (the crowd's; the Cast has no teenagers); skin: the palette's (0 pale .. 6 dark,
// 7 olive); build: 0 slim, 1, 2 broad, 3 a belly; r: four numbers in [ 0, 1 ) from his seed
export function faceFeatures( female, age, skin, build, r ) {

	const [ af, as ] = FAN_HEAD.ethnic[ skin & 7 ];
	const old = age === 1 ? 0.45 + 0.3 * r[ 0 ] : age === 0 ? 0.45 * r[ 0 ] : 0;
	const kid = age === 2 ? 1 : age === 3 ? 0.6 + 0.2 * r[ 1 ] : 0;
	const wt = age === 2 ? - 0.2 : [ - 0.5, 0, 0.35, 0.75 ][ build & 3 ];
	return [ female ? 1 : 0, kid, old, Math.min( 1, Math.max( 0, af + 0.08 * ( r[ 2 ] * 2 - 1 ) ) ), as, wt ];

}

// a seeded generator for the draws (mulberry32)
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

// his K weights: A times his features less the crowd's means, plus L times his own normal draws
export function faceWeights( f, seed ) {

	const r = rng( seed * 2654435761 + 97 );
	const z = [];
	for ( let k = 0; k < FH_K; k ++ ) z.push( Math.sqrt( - 2 * Math.log( r() + 1e-9 ) ) * Math.cos( 2 * Math.PI * r() ) );
	const c = [];
	for ( let k = 0; k < FH_K; k ++ ) {

		let s = 0;
		for ( let i = 0; i < f.length; i ++ ) s += FAN_HEAD.A[ i ][ k ] * ( f[ i ] - FAN_HEAD.FM[ i ] );
		for ( let j = 0; j <= k; j ++ ) s += FAN_HEAD.L[ k ][ j ] * z[ j ];
		c.push( s );

	}

	return c;

}

// 4 bits each, -2.8 .. 2.8 standard deviations in steps of 0.37 (16 levels; the round-off is a tenth of
// the spread, a face's own)
export function packFace( c ) {

	let w = 0;
	for ( let k = 0; k < 8; k ++ ) {

		const q = Math.max( 0, Math.min( 15, Math.round( ( ( c[ k ] || 0 ) + 2.8 ) / 5.6 * 15 ) ) );
		w |= q << ( k * 4 );

	}

	return w >>> 0;

}

const f4 = ( a ) => `vec4f( ${ a.map( ( x ) => ( + x ).toFixed( 4 ) ).join( ', ' ) } )`;
// the fit as WGSL constants: A's rows (a feature's weights on the 8 shapes) and L's columns, as vec4 pairs
const Arows = FAN_HEAD.A.map( ( r ) => [ f4( r.slice( 0, 4 ) ), f4( r.slice( 4, 8 ) ) ] );
const Lcols = Array.from( { length: FH_K }, ( _, j ) => FAN_HEAD.L.map( ( r ) => r[ j ] ) ).map( ( c ) => [ f4( c.slice( 0, 4 ) ), f4( c.slice( 4, 8 ) ) ] );
const ETH = FAN_HEAD.ethnic;

export const fanHeadModule = new ShaderModule( {
	name: 'fan-head',
	code: /* wgsl */`
struct FhOut { dp: vec3f, dn: vec3f, d: vec3f, fold: vec3f };

// ---- FF2 (step 10): the expressions (MakeHuman's own units: tools/build-fanhead.mjs), by their weights
// ex: the mouth open (a shout, a cheer, a song: the jaw down, the lips parted, the brows up), the smile (the
// mouth's corners up and back, the cheeks up into the lids), the lids shut (a blink, and their own rest).
// Read only when any is on: the face's two records more
fn fhExpr( b: u32, ex: vec3f, o: ptr<function, FhOut> ) {
	if ( all( ex == vec3f( 0.0 ) ) ) { return; }
	let r7 = fhRec[ b + 7u ];
	let r8 = fhRec[ b + 8u ];
	let a = unpack2x16float( r7.x );
	let c = unpack2x16float( r7.y );
	let e = unpack2x16float( r7.z );
	let g = unpack2x16float( r7.w );
	( *o ).dp += vec3f( a.x, a.y, c.x ) * ex.x + vec3f( c.y, e.x, e.y ) * ex.y + vec3f( 0.0, g.x, g.y ) * ex.z;
	let an = unpack2x16float( r8.x );
	let cn = unpack2x16float( r8.y );
	let en = unpack2x16float( r8.z );
	let gn = unpack2x16float( r8.w );
	( *o ).dn += vec3f( an.x, an.y, cn.x ) * ex.x + vec3f( cn.y, en.x, en.y ) * ex.y + vec3f( 0.0, gn.x, gn.y ) * ex.z;
}
// ---- end FF2

// eight halves (one per blend shape) against the weights
fn fh8( u: vec4u, cA: vec4f, cB: vec4f ) -> f32 {
	return dot( vec4f( unpack2x16float( u.x ), unpack2x16float( u.y ) ), cA ) + dot( vec4f( unpack2x16float( u.z ), unpack2x16float( u.w ) ), cB );
}

// a vertex of the head (its record i) moved by a face's weights: the move, the normal's change, where it
// is in the paint's frame, and its ear's fold (zero off the ears). (FF2: ex, the expressions' weights;
// ---- FF3: rest, the lids' own rest, a little down, for a face with no expression on: its move is in the
// first record's spare halves, so most of the crowd most of the time read none of the expressions' two
// records. With an expression on, ex.z carries the lids, rest and all)
fn fhBlend( i: u32, cA: vec4f, cB: vec4f, ex: vec3f, rest: f32 ) -> FhOut {
	let b = i * ${ REC }u;
	let r0 = fhRec[ b ];
	let pz = unpack2x16float( r0.y );
	let fz = unpack2x16float( r0.w );
	var o: FhOut;
	o.d = vec3f( unpack2x16float( r0.x ), pz.x );
	o.fold = vec3f( unpack2x16float( r0.z ), fz.x );
	o.dp = vec3f( fh8( fhRec[ b + 1u ], cA, cB ), fh8( fhRec[ b + 2u ], cA, cB ), fh8( fhRec[ b + 3u ], cA, cB ) );
	o.dn = vec3f( fh8( fhRec[ b + 4u ], cA, cB ), fh8( fhRec[ b + 5u ], cA, cB ), fh8( fhRec[ b + 6u ], cA, cB ) );
	if ( all( ex == vec3f( 0.0 ) ) ) { o.dp += vec3f( 0.0, pz.y, fz.y ) * rest; } // ---- FF3
	fhExpr( b, ex, &o ); // ---- FF2
	return o;
}

// the crowd's weights, packed 4 bits each (FanHead.js packFace)
fn fhUnpack( w: u32 ) -> array<vec4f, 2> {
	let q = vec4u( w, w >> 4u, w >> 8u, w >> 12u ) & vec4u( 15u );
	let r = vec4u( w >> 16u, w >> 20u, w >> 24u, w >> 28u ) & vec4u( 15u );
	return array<vec4f, 2>( vec4f( q ) * ${ ( 5.6 / 15 ).toFixed( 5 ) } - 2.8, vec4f( r ) * ${ ( 5.6 / 15 ).toFixed( 5 ) } - 2.8 );
}

fn fhHash( n: u32 ) -> f32 {
	var x = n * 747796405u + 2891336453u;
	x = ( ( x >> ( ( x >> 28u ) + 4u ) ) ^ x ) * 277803737u;
	return f32( ( x >> 22u ) ^ x ) / 4294967296.0;
}

// the Cast's weights from who he is (FanHead.js faceFeatures: age 0 an adult, 1 old, 2 a kid) and his seed:
// A times the features less their means, plus L times his own draws (each the sum of four uniform
// numbers, near enough a normal one)
fn fhCoefs( seed: u32, female: bool, age: u32, skin: u32, build: u32 ) -> array<vec4f, 2> {
	var ETH = array<vec2f, 8>( ${ ETH.map( ( e ) => `vec2f( ${ e[ 0 ] }, ${ e[ 1 ] } )` ).join( ', ' ) } );
	let r0 = fhHash( seed * 31u + 7u );
	let eth = ETH[ skin & 7u ];
	var WT = array<f32, 4>( -0.5, 0.0, 0.35, 0.75 );
	let f = array<f32, 6>( select( 0.0, 1.0, female ), select( 0.0, 1.0, age == 2u ), select( select( 0.0, 0.45 * r0, age == 0u ), 0.45 + 0.3 * r0, age == 1u ),
		clamp( eth.x + 0.08 * ( fhHash( seed * 31u + 11u ) * 2.0 - 1.0 ), 0.0, 1.0 ), eth.y, select( WT[ build & 3u ], -0.2, age == 2u ) );
	let FM = array<f32, 6>( ${ FAN_HEAD.FM.map( ( x ) => x.toFixed( 4 ) ).join( ', ' ) } );
	var cA = vec4f( 0.0 );
	var cB = vec4f( 0.0 );
${ Arows.map( ( [ a, b ], i ) => `	cA += ${ a } * ( f[ ${ i } ] - FM[ ${ i } ] );\n	cB += ${ b } * ( f[ ${ i } ] - FM[ ${ i } ] );` ).join( '\n' ) }
	var LA = array<vec4f, ${ FH_K }>( ${ Lcols.map( ( c ) => c[ 0 ] ).join( ', ' ) } );
	var LB = array<vec4f, ${ FH_K }>( ${ Lcols.map( ( c ) => c[ 1 ] ).join( ', ' ) } );
	for ( var j = 0u; j < ${ FH_K }u; j ++ ) {
		let s = seed * 131u + j * 17u + 3u;
		let z = ( fhHash( s ) + fhHash( s + 1u ) + fhHash( s + 2u ) + fhHash( s + 3u ) - 2.0 ) * 1.7320508;
		cA += LA[ j ] * z;
		cB += LB[ j ] * z;
	}
	return array<vec4f, 2>( cA, cB );
}
`,
} );
// ---- end FF1
