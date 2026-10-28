import { Vector4 } from '../engine/index.js';
import { ShaderModule, UniformBlock } from '../engine/gpu/Shader.js';
import { Texture } from '../engine/gpu/Texture.js';
import { commonModule } from '../engine/render/wgsl/common.js';
import { nightAirModule } from './Night.js';
import { LEVELS } from './layout.js';

// FC4 (C4R-4, gauntlet r4): the light on the ground outside after dark. The lots, the streets and the
// ground round the complex were black under their lamps: the lots took their pools from a regular grid
// in the shader (not from the poles drawn), and the streets and the ground took none. The poles Complex.js
// puts up (the lots' metal halide pairs, the streets' sodium cobra heads from OpenStreetMap, the
// highways' where they're down on the ground) are baked once into a map of the ground's light over the
// complex (2.5 m texels, 1.28 km square), which the lots, the roads (Surroundings.js) and the ground
// (Ground.js) light themselves by: roadieshow 3024603196 (a lot under a halide pole on Oct 27, the ground
// lit round it), pompomflipflop 2985527047 (Pattison under sodium on the 29th).
//
// And on the 27th the lots were a sheet of water mirroring the towers, the lamps and the board
// (flickr 10048236N08 3973451313, the lot behind the left field board that night). There's no
// reflection pass outside, so the brightest things are put in the water where the mirror would show
// them: the light banks (Night.js's eight) as streaks drawn down toward you, the way light lies in wet
// asphalt, and the lamps' pools shining in it the lower you look across them.
//
//   bakeGroundLight( poles, lotPoles, fieldYaw )      Complex.js, once its poles are up
//   materials: modules [ groundLightModule ];  s.emissive += s.albedo * groundLight( in.P ) * K
//                                                   + groundGlint( in.P )

const RES = 512, SPAN = 1280, CELL = SPAN / RES; // texels, metres, metres a texel
const CENTRE = [ 0, - 40 ]; // the complex's (Complex.js)
const STREET = LEVELS.mainConcourse;
export const SODIUM = [ 1.0, 0.55, 0.2 ];
export const HALIDE = [ 1.0, 0.94, 0.84 ];

const params = new UniformBlock( 'GroundLight', {
	// world to the field frame (cos, sin of the field's turn), the map's corner (field x, z)
	xf: [ 'vec4f', new Vector4( 1, 0, CENTRE[ 0 ] - SPAN / 2, CENTRE[ 1 ] - SPAN / 2 ) ],
	// on (baked), the lamps' and the banks' strength in the water (how wet it is is the frame's: G.wet,
	// soaked on the 27th, drying on the 29th), spare
	k: [ 'vec4f', new Vector4( 0, 1, 1, 0 ) ],
}, { label: 'groundLight' } );
export const GROUND_LIGHT = params.fields;
const map = new Texture( { label: 'groundLight', width: RES, height: RES, format: 'rgba8unorm' } );

const f = ( x ) => x.toFixed( 4 );
const v3 = ( a ) => `vec3f( ${ a.map( f ).join( ', ' ) } )`;

export const groundLightModule = new ShaderModule( {
	name: 'groundLight',
	deps: [ commonModule, nightAirModule ],
	uniforms: params,
	uniformName: 'glU',
	bindings: { groundLightMap: { texture: map } },
	code: /* wgsl */`
// (manual bilinear filtering: no sampler)
fn glTap( i: vec2i ) -> vec4f { return textureLoad( groundLightMap, clamp( i, vec2i( 0 ), vec2i( ${ RES - 1 } ) ), 0 ); }
fn glField( x: f32, z: f32 ) -> vec2f { return vec2f( x * glU.xf.x - z * glU.xf.y, x * glU.xf.y + z * glU.xf.x ); }
fn glAt( q: vec2f ) -> vec4f {
	let st = ( q - glU.xf.zw ) * ${ f( 1 / CELL ) } - 0.5;
	// (nothing past the map's edge: the ground runs on for kilometres)
	if ( any( st < vec2f( - 1.0 ) ) || any( st > vec2f( ${ RES }.0 ) ) ) { return vec4f( 0.0 ); }
	let i0 = vec2i( floor( st ) );
	let fr = fract( st );
	return mix( mix( glTap( i0 ), glTap( i0 + vec2i( 1, 0 ) ), fr.x ), mix( glTap( i0 + vec2i( 0, 1 ) ), glTap( i0 + vec2i( 1, 1 ) ), fr.x ), fr.y );
}

// the lamps' light on the ground at P (world) after dark: irradiance, 1 under a lot's pole
fn groundLight( P: vec3f ) -> vec3f {
	if ( glU.k.x < 0.5 || frame.night < 0.05 ) { return vec3f( 0.0 ); }
	let m = glAt( glField( P.x, P.z ) );
	let e = m.rg * m.rg * 2.0;
	return ( ${ v3( HALIDE ) } * e.x + ${ v3( SODIUM ) } * e.y ) * smoothstep( 0.2, 0.8, frame.night );
}

// the lamps and the banks in the water on the ground at P (world), seen from the eye (radiance)
fn groundGlint( P: vec3f ) -> vec3f {
	let wet = smoothstep( 0.3, 0.75, frame.wet ) * smoothstep( 0.2, 0.8, frame.night );
	if ( glU.k.x < 0.5 || wet < 0.01 ) { return vec3f( 0.0 ); }
	let V = P - frame.cameraPos;
	let h = max( length( V.xz ), 1e-3 );
	// the view's slope down to P is the reflected ray's up from it
	let up = max( - V.y, 0.0 ) / h;
	if ( up < 0.004 ) { return vec3f( 0.0 ); }
	// the lamps' pools shine in the water toward you, more the lower you look across it (the heads' own
	// images in it were tried as spots looked up along the reflected ray: a train of blobs, not a streak)
	let m = glAt( glField( P.x, P.z ) );
	let e = m.rg * m.rg * 2.0;
	let graze = pow( 1.0 - min( up, 1.0 ), 6.0 );
	var c = ( ${ v3( HALIDE ) } * e.x + ${ v3( SODIUM ) } * e.y ) * graze * 0.5 * glU.k.y;
	// the banks: their mirror images under the ground, a streak where the eye's ray meets one (tight
	// across, drawn out up and down by the ripple), their glow in the rain round it
	let vh = V.xz / h;
	let tv = V.y / h;
	var banks = 0.0;
	let n = i32( nightAir.count );
	for ( var i = 0; i < ${ 8 }; i++ ) {
		if ( i >= n ) { break; }
		let B = nightAir.pos[ i ];
		let d = vec3f( B.x, 2.0 * P.y - B.y, B.z ) - frame.cameraPos;
		let dh = max( length( d.xz ), 1e-3 );
		let across = 1.0 - dot( vh, d.xz / dh );
		let along = tv - d.y / dh;
		banks += B.w / ( dh * dh + 400.0 ) * ( exp( - across * 9000.0 - along * along * 120.0 ) * 6.0 + exp( - across * 900.0 - along * along * 25.0 ) * 0.6 );
	}
	c += vec3f( 1.0, 0.97, 0.9 ) * banks * glU.k.z;
	return c * wet;
}
`,
} );

// Bake the map from the poles (field frame [ x, y, z, height ], the first lotPoles metal halide, the rest
// sodium), with the field's turn in the world. Each pole's pool: the inverse square law and the cosine at
// the ground, under a full cut-off head that throws its light down (cos^5 in all: a tenth of the light
// half way between the lots' poles, as the photos from the air have them, dark between the pools), gone by
// ~3.5 heights out
export function bakeGroundLight( poles, lotPoles, fieldYaw ) {

	const N = RES * RES, Eh = new Float32Array( N ), Es = new Float32Array( N );
	const x0 = CENTRE[ 0 ] - SPAN / 2, z0 = CENTRE[ 1 ] - SPAN / 2;
	poles.forEach( ( [ x, y, z, h ], i ) => {

		// (a highway's lamps up on its viaduct light the deck, not the ground)
		if ( y > STREET + 1.5 ) return;
		const halide = i < lotPoles;
		// (a street's cobra head throws its light across the road: wider, cos^3, out to 4.5 heights)
		const E0 = halide ? 1 : 0.55, R = ( halide ? 3.5 : 4.5 ) * h, k = halide ? 2.5 : 1.5;
		const pool = halide ? Eh : Es;
		const cx = ( x - x0 ) / CELL - 0.5, cz = ( z - z0 ) / CELL - 0.5, rc = Math.ceil( R / CELL );
		for ( let iz = Math.max( 0, Math.floor( cz ) - rc ); iz <= Math.min( RES - 1, Math.ceil( cz ) + rc ); iz ++ ) for ( let ix = Math.max( 0, Math.floor( cx ) - rc ); ix <= Math.min( RES - 1, Math.ceil( cx ) + rc ); ix ++ ) {

			const dx = ( ix - cx ) * CELL, dz = ( iz - cz ) * CELL, r2 = dx * dx + dz * dz;
			if ( r2 > R * R ) continue;
			const w = 1 - Math.min( 1, Math.max( 0, ( Math.sqrt( r2 ) - ( R - h ) ) / h ) );
			pool[ ix + iz * RES ] += E0 * Math.pow( h * h / ( h * h + r2 ), k ) * w * w * ( 3 - 2 * w );

		}

	} );
	const data = new Uint8Array( N * 4 );
	for ( let i = 0; i < N; i ++ ) {

		data[ i * 4 ] = Math.round( Math.sqrt( Math.min( Eh[ i ], 2 ) / 2 ) * 255 );
		data[ i * 4 + 1 ] = Math.round( Math.sqrt( Math.min( Es[ i ], 2 ) / 2 ) * 255 );

	}

	baked = { Eh, Es, x0, z0 };
	map.upload( data );
	params.fields.xf.value.set( Math.cos( fieldYaw ), Math.sin( fieldYaw ), x0, z0 );
	params.fields.k.value.x = 1;
	return data;

}

// the light on the ground at ( x, z ) (field frame) as the map has it: 1 under a lot's pole (0 unbaked)
let baked = null;
export function groundLightAt( x, z ) {

	if ( ! baked ) return 0;
	const ix = Math.floor( ( x - baked.x0 ) / CELL ), iz = Math.floor( ( z - baked.z0 ) / CELL );
	if ( ix < 0 || iz < 0 || ix >= RES || iz >= RES ) return 0;
	return baked.Eh[ ix + iz * RES ] + baked.Es[ ix + iz * RES ];

}
