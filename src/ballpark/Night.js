import { Vector2, Vector3, Vector4 } from '../engine/index.js';
import { ShaderModule, UniformBlock } from '../engine/gpu/Shader.js';
import { commonModule } from '../engine/render/wgsl/common.js';
import { SceneLighting, surfaceModule } from '../engine/render/wgsl/lighting.js';
import { G } from '../engine/render/Frame.js';

// L (wave 3): light and night. The park after dark on the two nights of Game 5: the air round the light
// banks, the rain lit in their beams, the wet, and the look of the broadcast.
//
// The night air: every light bank lights the rain and mist in front of it. Its single scattering is added
// in the haze composite (AirHaze's hazeApply, HZ_NIGHT), exact along each pixel's own ray up to the
// depth there, so a bank's glow sits on the bank, the steel in front of it cuts it, and the beams hang
// over the field. For each bank the in-scatter along the ray is integrated in the angle it subtends
// (the inverse square law integrates exactly that way: dt / r^2 = dphi / h, h the ray's nearest
// distance to the lamp), sampling the spot's cone and the drops' forward lobe at a few angles: the
// air in front of a bank you look into blazes, the beam's edge shows, and seen from behind (the plaza)
// the banks throw only their spill. On the 27th the drops in that lit air show as streaks.
//
// It replaces SkyGlow's halos (camera-facing sprites, which sat 10 m and more above the banks).

export const BANKS = 8;
// each bank's beam (degrees off its aim at the field's centre): the whole field is within ~20 deg of every
// bank's aim, so it takes the full light; the stands under and behind a bank get its edge and spill
export const BEAM = { inner: 26, outer: 52 };

const params = new UniformBlock( 'NightAir', {
	// the banks: world position, luminous intensity (scene units, as LocalLights); the axis of the beam,
	// the cosine of its outer edge
	pos: [ `vec4f[${ BANKS }]`, Array.from( { length: BANKS }, () => new Vector4() ) ],
	dir: [ `vec4f[${ BANKS }]`, Array.from( { length: BANKS }, () => new Vector4( 0, - 1, 0, 0.2 ) ) ],
	color: [ 'vec3f', new Vector3( 1.0, 0.97, 0.9 ) ],
	// scattering coefficients of the air (1/m): sigma the broad part (mist, the fine droplets: it lights
	// the beams seen from the side), sigmaN the drops' narrow forward lobe (the glare round a bank you
	// look into). Rain and mist on the 27th, a clear cold night on the 29th
	sigma: [ 'f32', 0 ],
	// the lobes (Henyey-Greenstein g): the broad one, the narrow one
	g: [ 'f32', 0.35 ],
	streaks: [ 'f32', 0 ],
	on: [ 'f32', 0 ],
	count: [ 'f32', 0 ],
	// the wind the rain leans in (world m/s, x z), and its cosine of the cone's inner edge
	wind: [ 'vec2f', new Vector2( 1.2, 0.8 ) ],
	cosInner: [ 'f32', 0.83 ],
	sigmaN: [ 'f32', 0 ],
	gN: [ 'f32', 0.9 ],
}, { label: 'nightAir' } );

export const nightAirModule = new ShaderModule( {
	name: 'nightAir',
	deps: [ commonModule ],
	uniforms: params,
	uniformName: 'nightAir',
	code: /* wgsl */`
const NA_SAMPLES: i32 = 4;

fn naPhase( cosT: f32, g: f32 ) -> f32 {
	let g2 = g * g;
	return ( 1.0 - g2 ) / ( 4.0 * PI * pow( max( 1.0 + g2 - 2.0 * g * cosT, 1e-4 ), 1.5 ) );
}

// the spot's profile (LocalLights: hot centre, soft edge, a faint spill all round)
fn naSpot( cd: f32, cosOuter: f32 ) -> f32 {
	let m = smoothstep( cosOuter, nightAir.cosInner, cd );
	return max( m * m, 0.05 );
}

// the drops falling through a sheet of air dist metres out: streaks on a cylinder round the camera (metres
// across and up it), each a shutter's length of a drop's fall, never thinner than a pixel (their light
// spread over it)
fn naStreaks( dir: vec3f, dist: f32, px: f32, seed: f32 ) -> f32 {
	let flatLen = max( length( dir.xz ), 0.25 );
	let az = atan2( dir.x, dir.z );
	let t = frame.time;
	let fall = 8.8 + seed * 1.5;
	// the wind carries them sideways across the view
	let side = dot( nightAir.wind, vec2f( cos( az ), - sin( az ) ) );
	var p = vec2f( az * dist, dir.y / flatLen * dist );
	p = p + vec2f( - side * t, fall * t );
	p.x += p.y * side / fall;
	let cell = vec2f( 0.32, 2.2 );
	let c = floor( p / cell );
	let f = p / cell - c;
	let h = hash21( c + vec2f( seed * 97.0, seed * 31.0 ) );
	if ( h > 0.55 ) { return 0.0; }
	let x0 = 0.1 + 0.8 * fract( h * 17.13 );
	let len = mix( 0.1, 0.25, fract( h * 5.7 ) );
	let y0 = fract( h * 29.3 ) * ( 1.0 - len );
	let w = max( px, 0.003 );
	let across = sat( 1.0 - abs( f.x - x0 ) * cell.x / w );
	let along = smoothstep( y0, y0 + 0.02, f.y ) * ( 1.0 - smoothstep( y0 + len - 0.02, y0 + len, f.y ) );
	return across * along * ( 0.003 / w );
}

// the narrow lobe integrated over the scattering angle from theta to beyond it (small angle form: the
// lobe is only a few degrees wide)
fn naNarrow( theta: f32, g: f32 ) -> f32 {
	let b = ( 1.0 - g ) * ( 1.0 - g );
	return ( 1.0 - g * g ) / ( 4.0 * PI * b ) * ( inverseSqrt( g ) - theta * inverseSqrt( b + g * theta * theta ) );
}

// the light the air along the ray (origin o, unit direction d, to distance tMax) scatters toward the eye
fn nightAirInScatter( o: vec3f, d: vec3f, tMax: f32 ) -> vec3f {
	if ( nightAir.on < 0.001 || nightAir.sigma <= 0.0 ) { return vec3f( 0.0 ); }
	var acc = 0.0;
	let n = i32( nightAir.count );
	for ( var i = 0; i < ${ BANKS }; i++ ) {
		if ( i >= n ) { break; }
		let L = nightAir.pos[ i ];
		let S = nightAir.dir[ i ];
		let v = L.xyz - o;
		let t0 = dot( v, d );
		let h = sqrt( max( dot( v, v ) - t0 * t0, 0.25 ) );
		let pa = atan( - t0 / h );
		let pb = atan( ( tMax - t0 ) / h );
		let dp = ( pb - pa ) / f32( NA_SAMPLES );
		if ( dp <= 0.0 ) { continue; }
		// the broad part: the beam's cone and the lobe sampled at a few angles along the ray
		var sum = 0.0;
		for ( var k = 0; k < NA_SAMPLES; k++ ) {
			let ph = pa + ( f32( k ) + 0.5 ) * dp;
			let q = o + d * ( t0 + h * tan( ph ) );
			let w = normalize( q - L.xyz );
			sum += naSpot( dot( w, S.xyz ), S.w ) * naPhase( dot( w, - d ), nightAir.g );
		}
		// the narrow lobe: the scattering angle runs from the light's angle off the ray at the eye
		// (pa + 90 deg) to where the ray ends (pb + 90 deg); lit as the bank shines toward the eye
		let glare = ( naNarrow( pa + 1.5707963, nightAir.gN ) - naNarrow( pb + 1.5707963, nightAir.gN ) ) * naSpot( dot( normalize( - v ), S.xyz ), S.w );
		acc += L.w * ( sum * dp * nightAir.sigma + glare * nightAir.sigmaN ) / h;
	}
	return nightAir.color * acc * nightAir.on;
}

// the composite's night term: the lit air, and on the 27th the rain showing in it
fn nightAirApply( o: vec3f, d: vec3f, dist: f32 ) -> vec3f {
	let air = nightAirInScatter( o, d, dist );
	if ( nightAir.streaks <= 0.0 || nightAir.on < 0.001 ) { return air; }
	// three sheets of drops beyond the camera's own rain (Rain.js, within ~40 m), where they're in
	// front of what's there
	let px = 2.0 / ( frame.proj[ 1 ][ 1 ] * frame.resolution.y );
	var drops = 0.0;
	for ( var k = 0; k < 3; k++ ) {
		let D = 42.0 * pow( 1.55, f32( k ) );
		if ( D < dist ) { drops += naStreaks( d, D, px * D, f32( k ) * 0.37 + 0.11 ); }
	}
	return air * ( 1.0 + drops * nightAir.streaks );
}
`,
} );

export const NIGHT_AIR = params.fields;

// The key light after dark is the stadium's (BallparkApp.updateSun: high over the roof behind home, so
// the players' shadows fall toward center field). It stood for the banks everywhere: the stands as bright
// as the field and the plaza and the lots lit like the infield. The banks light the field; the stands
// get less (the near ones only spill), and outside the park the key fades out to the street lamps and the
// lot poles (their own lights). A radial footprint round the field's centre (world x z; the radii where
// the stands start and where the park ends).
const keyParams = new UniformBlock( 'NightKey', {
	centre: [ 'vec4f', new Vector4( 0, 0, 80, 140 ) ],
	on: [ 'f32', 0 ],
	stands: [ 'f32', 0.45 ],
	outside: [ 'f32', 0.1 ],
	pad: [ 'f32', 0 ],
}, { label: 'nightKey' } );

export const nightKeyModule = new ShaderModule( {
	name: 'nightKey',
	deps: [ commonModule ],
	uniforms: keyParams,
	uniformName: 'nightKey',
	code: /* wgsl */`
fn nightKeyFootprint( P: vec3f ) -> f32 {
	if ( nightKey.on < 0.001 ) { return 1.0; }
	let r = length( P.xz - nightKey.centre.xy );
	let bowl = mix( 1.0, nightKey.stands, smoothstep( nightKey.centre.z, nightKey.centre.w, r ) );
	let k = mix( bowl, nightKey.outside, smoothstep( nightKey.centre.w, nightKey.centre.w + 45.0, r ) );
	return mix( 1.0, k, nightKey.on );
}
`,
} );
const NIGHT_KEY = keyParams.fields;

// the materials that are cloth and people, not hard ground (lighting.js shadeSurface: WET_FABRIC). The
// crowd's are Crowd.js's; the rest are named here so the rain treats them as what they are.
const FABRIC = [ 'people', 'bunting', 'flag-cloth', 'crowd-near', 'crowd-mid', 'crowd-far', 'tv-cameras' ];

export class Night {

	constructor( app ) {

		this.app = app;
		// the banks, for the air
		const banks = app.bowl.lightSources().slice( 0, BANKS );
		banks.forEach( ( { position, dir }, i ) => {

			NIGHT_AIR.pos.value[ i ].set( position.x, position.y, position.z, 2200 );
			NIGHT_AIR.dir.value[ i ].set( dir.x, dir.y, dir.z, Math.cos( BEAM.outer * Math.PI / 180 ) );

		} );
		NIGHT_AIR.count.value = banks.length;
		NIGHT_AIR.cosInner.value = Math.cos( BEAM.inner * Math.PI / 180 );
		this._fabric();
		// the stadium key's footprint, with the clouds' shadow the hook had
		const c = app.field.toWorld( 0, - 50 );
		NIGHT_KEY.centre.value.set( c.x, c.z, 80, 140 );
		const clouds = app.clouds;
		SceneLighting.set( 'directModulation', new ShaderModule( {
			name: 'hook-directModulation-night',
			deps: [ surfaceModule, clouds?.shadowModule, nightKeyModule ].filter( Boolean ),
			code: `fn hookDirectModulation( P: vec3f, N: vec3f ) -> vec3f { return vec3f( ${ clouds ? 'cloudsShadow( P.xz )' : '1.0' } * nightKeyFootprint( P ) ); }`,
		} ) );

	}

	// cloth gets wet as cloth (see FABRIC)
	_fabric() {

		const seen = new Set();
		const mark = ( m ) => {

			if ( ! m || seen.has( m ) ) return;
			seen.add( m );
			if ( FABRIC.includes( m.name ) && ! m.defines?.DRY ) m.setDefine( 'WET_FABRIC', 1 );

		};
		this.app.scene.traverse( ( o ) => {

			if ( ! o.material ) return;
			for ( const m of Array.isArray( o.material ) ? o.material : [ o.material ] ) mark( m );

		} );
		for ( const m of this.app.bowl.crowd?.materials || [] ) mark( m );

	}

	// each frame (after the weather): how much the air scatters, how hard it rains
	update( dt ) {

		const a = this.app;
		const rain = a.rain ? a.rain.amount : 0;
		const lights = smooth( G.night.value, 0.15, 0.75 );
		NIGHT_AIR.on.value = lights;
		// the key is the stadium's once the sun is down (the same switch as updateSun)
		NIGHT_KEY.on.value = a.atmosphere && a.atmosphere.sunDir.value.y <= - 0.07 ? 1 : 0;
		// the 27th: rain and mist, the drops' strong forward lobe; the 29th (and a dry night): a little
		// haze in cold clear air
		NIGHT_AIR.sigma.value = 0.00015 + 0.0007 * rain;
		NIGHT_AIR.sigmaN.value = 0.0004 + 0.0022 * rain;
		NIGHT_AIR.g.value = 0.3 + 0.15 * rain;
		NIGHT_AIR.gN.value = 0.9;
		NIGHT_AIR.streaks.value = rain > 0.01 ? 25 * rain : 0;
		const w = a.rain?.material.uniforms.wind.value;
		if ( w ) NIGHT_AIR.wind.value.set( w.x, w.y );
		this._broadcast();

	}

	// FOX's cameras: a broadcast picture, not the eye's. The camera crew expose for the field and
	// white-balance to the lamps, so the Phillies' home whites are white (not the grey-blue they read
	// through the eye's grade), the grass a deep saturated green and the night sky black: the Getty and
	// broadcast frames of both nights (ref/night: getty_83485455, getty_83885893, getty_83486198). The
	// grade the settings panel sets stays the base.
	_broadcast() {

		const a = this.app, post = a.post;
		if ( ! post ) return;
		const P = post.params, AE = post.autoExposure;
		const tv = !! a.camMode && a.camMode !== 'walk';
		// a cut is a cut: the picture changes with the camera
		const k = tv ? 1 : 0;
		const nk = smooth( G.night.value, 0.15, 0.75 );
		// what the panel (or anyone else) set since our last write is the new base
		const base = this._base || ( this._base = {} );
		for ( const [ key, u ] of [ [ 'contrast', P.contrast ], [ 'saturation', P.saturation ], [ 'warmth', P.warmth ], [ 'ref', AE.refLum ] ] ) {

			if ( base[ key ] === undefined || u.value !== this._set?.[ key ] ) base[ key ] = u.value;

		}

		const set = this._set || ( this._set = {} );
		set.contrast = P.contrast.value = base.contrast * ( 1 + k * ( 0.05 + 0.05 * nk ) );
		set.saturation = P.saturation.value = base.saturation * ( 1 + k * ( 0.06 + 0.04 * nk ) );
		// the lamps' white balanced out (the eye's grade is a touch warm)
		set.warmth = P.warmth.value = base.warmth - k * ( 0.02 + 0.02 * nk );
		// exposed for the field, brighter than the eye's adaptation to the whole bowl
		set.ref = AE.refLum.value = base.ref * ( 1 + k * ( 0.12 + 0.3 * nk ) );

	}

}

function smooth( x, a, b ) {

	const t = Math.min( 1, Math.max( 0, ( x - a ) / ( b - a ) ) );
	return t * t * ( 3 - 2 * t );

}
