import { Vector2, Vector3, Vector4, Color } from '../engine/index.js';
import { LEVELS } from './layout.js';
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
	// the rain's extinction beyond the park (1/m) and the colour it fades to
	veil: [ 'vec3f', new Vector3( 0.004, 0.0032, 0.0026 ) ],
	rainExt: [ 'f32', 0 ],
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
	let x = max( 1.0 + g2 - 2.0 * g * cosT, 1e-4 );
	return ( 1.0 - g2 ) / ( 4.0 * PI * x * sqrt( x ) );
}

// the spot's profile (LocalLights: hot centre, soft edge, a faint spill all round)
fn naSpot( cd: f32, cosOuter: f32 ) -> f32 {
	let m = smoothstep( cosOuter, nightAir.cosInner, cd );
	return max( m * m, 0.05 );
}

// the drops falling through a sheet of air dist metres out: streaks on a cylinder round the camera (metres
// across and up it: the view's azimuth az, its slope up the cylinder, the wind across it), each a
// shutter's length of a drop's fall, never thinner than a pixel (their light spread over it)
fn naStreaks( az: f32, slope: f32, side: f32, dist: f32, px: f32, seed: f32 ) -> f32 {
	let t = frame.time;
	let fall = 8.8 + seed * 1.5;
	// the wind carries them sideways across the view
	var p = vec2f( az * dist, slope * dist );
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

// the light the air along the ray (origin o, unit direction d, to distance tMax) scatters toward the eye,
// less its colour (nightAir.color). Evaluated in the haze march, at half resolution
fn nightAirLum( o: vec3f, d: vec3f, tMax: f32 ) -> f32 {
	if ( nightAir.on < 0.001 || nightAir.sigma <= 0.0 ) { return 0.0; }
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
	return acc * nightAir.on;
}

// the composite's night term on the colour c (d: the view direction, dist: to what's there, air: the
// march's nightAirLum upsampled): past the park the rain's own veil (heavy rain sees a kilometre or
// two: by the 5th inning Center City is a glow through it) in the colour of the low cloud lit by the
// city; the lit air; and on the 27th the rain showing in it
fn nightAirApply( c: vec3f, d: vec3f, dist: f32, sky: bool, air: f32 ) -> vec3f {
	var base = c;
	if ( ! sky && nightAir.rainExt > 0.0 ) {
		let T = exp( - nightAir.rainExt * max( dist - 180.0, 0.0 ) );
		base = mix( nightAir.veil, c, T );
	}
	if ( air <= 0.0 ) { return base; }
	var drops = 0.0;
	if ( nightAir.streaks > 0.0 && air > 1e-4 ) {
		// two sheets of drops beyond the camera's own rain (Rain.js, within ~40 m), where they're in
		// front of what's there
		let px = 2.0 / ( frame.proj[ 1 ][ 1 ] * frame.resolution.y );
		let az = atan2( d.x, d.z );
		let slope = d.y / max( length( d.xz ), 0.25 );
		let side = dot( nightAir.wind, vec2f( cos( az ), - sin( az ) ) );
		if ( 45.0 < dist ) { drops += naStreaks( az, slope, side, 45.0, px * 45.0, 0.11 ); }
		if ( 80.0 < dist ) { drops += naStreaks( az, slope, side, 80.0, px * 80.0, 0.48 ); }
	}
	return base + nightAir.color * air * ( 1.0 + drops * nightAir.streaks );
}
`,
} );

export const NIGHT_AIR = params.fields;

// The key light after dark is the stadium's (BallparkApp.updateSun: high over the roof behind home, so
// the players' shadows fall toward center field). It stood for the banks everywhere: the stands as bright
// as the field and the plaza and the lots lit like the infield. The banks light the field; the stands
// get less (the near ones only spill), and outside the park the key fades out to the street lamps and the
// lot poles (their own lights). The footprint is an ellipse on the field (world: its centre, the field
// frame's x axis; radii 75 m across, 70 m from home to the fence): full inside it, the stands' share
// from its wall out, the outside's past the facade.
const keyParams = new UniformBlock( 'NightKey', {
	centre: [ 'vec4f', new Vector4( 0, 0, 1, 0 ) ], // x z, then the field's +x in the world (x z)
	on: [ 'f32', 0 ],
	stands: [ 'f32', 0.4 ],
	outside: [ 'f32', 0.3 ],
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
	let d = P.xz - nightKey.centre.xy;
	let ax = nightKey.centre.zw;
	let q = vec2f( dot( d, ax ), dot( d, vec2f( - ax.y, ax.x ) ) ) / vec2f( 75.0, 70.0 );
	let e = length( q );
	let bowl = mix( 1.0, nightKey.stands, smoothstep( 1.0, 1.4, e ) );
	let k = mix( bowl, nightKey.outside, smoothstep( 1.8, 2.25, e ) );
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
		this.air = NIGHT_AIR;
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
		const c = app.field.toWorld( 0, - 55 ), c1 = app.field.toWorld( 1, - 55 );
		NIGHT_KEY.centre.value.set( c.x, c.z, c1.x - c.x, c1.z - c.z );
		const clouds = app.clouds;
		SceneLighting.set( 'directModulation', new ShaderModule( {
			name: 'hook-directModulation-night',
			deps: [ surfaceModule, clouds?.shadowModule, nightKeyModule ].filter( Boolean ),
			code: `fn hookDirectModulation( P: vec3f, N: vec3f ) -> vec3f { return vec3f( ${ clouds ? 'cloudsShadow( P.xz )' : '1.0' } * nightKeyFootprint( P ) ); }`,
		} ) );
		this._boardLight();

	}

	// Phanavision's light on the fans in front of it: the porch, the left field seats, the warning track
	// below (Getty 83486198: the 29th's last pitch, the Rays' logo lighting the rows under it). A wide spot
	// just off the board's face, coloured and dimmed as the board's picture changes (sampled when it's
	// redrawn, at most every 1.5 s, from a 12 x 10 copy)
	_boardLight() {

		const a = this.app, lm = a.landmarks, F = a.field;
		if ( ! lm?.boardCanvas || ! a.localLights ) return;
		// the board faces home from fencePoint( -36, 452 ft ), its face from 15.7 m over the street
		const at = [ - 81.0 + 0.588 * 3, - 111.5 + 0.809 * 3 ], y = LEVELS.mainConcourse + 15.7 + 12;
		const w = F.toWorld( at[ 0 ], at[ 1 ] ), aim = F.toWorld( - 52, - 78 );
		const position = new Vector3( w.x, F.y0 + y, w.z );
		const dir = new Vector3( aim.x, F.y0 + 9, aim.z ).sub( position ).normalize();
		this.board = a.localLights.add( {
			position, dir, color: new Color( 0.6, 0.65, 0.7 ), intensity: 110, range: 80,
			cosInner: Math.cos( 45 * Math.PI / 180 ), cosOuter: Math.cos( 82 * Math.PI / 180 ), kind: 'board', priority: 0,
		} );
		this._small = new OffscreenCanvas( 12, 10 );
		this._smallCtx = this._small.getContext( '2d', { willReadFrequently: true } );
		const redraw = lm.updateScoreboard.bind( lm );
		lm.updateScoreboard = ( ...args ) => {

			redraw( ...args );
			this._boardDirty = true;

		};
		this._boardDirty = true;
		this._boardT = 0;

	}

	_sampleBoard( dt ) {

		this._boardT += dt;
		if ( ! this.board || ! this._boardDirty || this._boardT < 1.5 ) return;
		this._boardDirty = false;
		this._boardT = 0;
		const c = this._smallCtx;
		c.drawImage( this.app.landmarks.boardCanvas, 0, 0, 12, 10 );
		const px = c.getImageData( 0, 0, 12, 10 ).data;
		let r = 0, g = 0, b = 0;
		for ( let i = 0; i < px.length; i += 4 ) {

			// linear light
			r += ( px[ i ] / 255 ) ** 2.2;
			g += ( px[ i + 1 ] / 255 ) ** 2.2;
			b += ( px[ i + 2 ] / 255 ) ** 2.2;

		}

		const n = px.length / 4;
		this.board.color.setRGB( r / n, g / n, b / n );
		// the board's own brightness carries in the colour: a mid picture ~0.2 linear
		this.board.scale = 4.0;

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
		// ( app.night.off: the night air off, for measuring what it costs )
		NIGHT_AIR.on.value = this.off ? 0 : lights;
		// the key is the stadium's once the sun is down (the same switch as updateSun)
		NIGHT_KEY.on.value = a.atmosphere && a.atmosphere.sunDir.value.y <= - 0.07 ? 1 : 0;
		// and then the haze's sun shafts (marched through the shadow maps along the key light) would be
		// shafts of a sun that isn't there: they're off after dark, and the march carries the banks' light
		// instead (it costs the same half-resolution pass). The panel's value comes back with the sun
		const hz = a.haze;
		if ( hz ) {

			if ( this._shafts === undefined || hz.shafts.value !== 0 ) this._shafts = hz.shafts.value;
			hz.shafts.value = NIGHT_KEY.on.value > 0.5 ? 0 : this._shafts;

		}
		// the 27th: rain and mist, the drops' strong forward lobe; the 29th (and a dry night): a little
		// haze in cold clear air
		// (the downpour of the 5th and 6th greys the whole bowl on FOX's high-home shot, t2h03m20s)
		NIGHT_AIR.sigma.value = 0.00015 + 0.0005 * rain + 0.0012 * rain * rain * rain;
		NIGHT_AIR.sigmaN.value = 0.0004 + 0.0022 * rain;
		NIGHT_AIR.g.value = 0.3 + 0.15 * rain;
		NIGHT_AIR.gN.value = 0.9;
		NIGHT_AIR.rainExt.value = 0.00045 * rain * rain;
		// the veil takes the colour of the low cloud near the horizon (SkyGlow's dome and the sky's glow)
		const glow = ( a.skyGlow || 0.006 ) * G.night.value * 3.2;
		NIGHT_AIR.veil.value.set( glow, glow * 0.8, glow * 0.63 );
		NIGHT_AIR.streaks.value = rain > 0.01 ? 25 * rain : 0;
		const w = a.rain?.material.uniforms.wind.value;
		if ( w ) NIGHT_AIR.wind.value.set( w.x, w.y );
		this._broadcast();
		this._sampleBoard( dt || 0 );

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
