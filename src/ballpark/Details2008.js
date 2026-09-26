import { Group, Mesh, CylinderGeometry, BoxGeometry, Color } from '../engine/index.js';
import { commonModule } from '../engine/render/wgsl/common.js';
import { standard } from '../materials/Materials.js';
import { Quads } from './Stands.js';
import { canvasTexture } from './geo.js';
import { generateMipmaps } from '../engine/gpu/Mipmaps.js';
import { FT, OUTFIELD, FOUL_TERRITORY, DUGOUTS, LEVELS, BULLPENS, fencePoint } from './layout.js';
import { ON_DECK } from './game/Plays.js';

// How the ballpark looked for the 2008 World Series (from photos of Games 3-5): the World Series logos
// painted on the grass by the dugouts and the "Phillies" script behind home plate, the on-deck circles,
// the dugouts' white roofs, the tarp rolled along the wall, the ads on the left field wall, State Farm
// on Monty's Angle, the out-of-town scoreboard in the right field wall, the open rail on the center field
// fence and the flower boxes on the left field wall. Field frame, in the Field's group.

export class Details2008 {

	constructor( { field } ) {

		this.field = field;
		this.group = new Group();
		this.group.name = 'details-2008';
		field.group.add( this.group );
		this._paintings();
		this._dugoutRoofs();
		this._tarp();
		this._wallAds();
		this._outOfTownBoard();
		this._cfRail();
		this._planters();
		this._wallOfFame();

	}

	// ---------------------------------------------------------------- paint on the grass

	_paintings() {

		const ws = canvasTexture( 1024, 512, drawWorldSeriesLogo, 'wsLogo' );
		const script = canvasTexture( 1024, 320, ( ctx, w, h ) => {

			ctx.clearRect( 0, 0, w, h );
			ctx.font = 'italic 700 230px Georgia, "Times New Roman", serif';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.lineWidth = 20;
			ctx.strokeStyle = '#f2f0ea';
			ctx.strokeText( 'Phillies', w / 2, h / 2 + 10 );
			ctx.fillStyle = '#c8102e';
			ctx.fillText( 'Phillies', w / 2, h / 2 + 10 );
			for ( const sx of [ 0.47, 0.64 ] ) star( ctx, w * sx, h * 0.14, 26, '#1d3f8f' );

		}, 'grassScript' );
		const onDeck = canvasTexture( 256, 256, ( ctx, w ) => {

			ctx.clearRect( 0, 0, w, w );
			ctx.fillStyle = '#f2f0ea';
			ctx.beginPath();
			ctx.arc( w / 2, w / 2, w / 2 - 2, 0, Math.PI * 2 );
			ctx.fill();
			ctx.save();
			ctx.translate( w / 2, w / 2 );
			ctx.scale( 0.2, 0.2 );
			ctx.translate( - 512, - 256 );
			drawWorldSeriesLogo( ctx, 1024, 512 );
			ctx.restore();

		}, 'onDeck' );
		const paint = ( tex, name ) => {

			const m = standard( { name, roughness: 0.85, alphaTest: 0.4, textures: { bpPaint: tex }, surface: 'let t = textureSample( bpPaint, smpAnisoClamp, in.uv ); s.alpha = t.a; s.albedo = t.rgb * 0.8;' } );
			m.underwaterLighting = 'none';
			return m;

		};

		// flat decals on the field: centre, size, which way their top faces (radians from -z, toward +x)
		const decal = ( mat, [ cx, cz ], w, h, turn ) => {

			const q = new Quads();
			const ux = Math.cos( turn ), uz = Math.sin( turn ); // reading direction
			const vx = Math.sin( turn ), vz = - Math.cos( turn ); // up
			const P = ( a, b ) => [ cx + ux * a + vx * b, 0.006, cz + uz * a + vz * b ];
			q.add( P( - w / 2, - h / 2 ), P( w / 2, - h / 2 ), P( w / 2, h / 2 ), P( - w / 2, h / 2 ), [ 0, 1, 0 ] );
			const g = q.geometry();
			const uv = g.getAttribute( 'uv' ).array, pos = g.getAttribute( 'position' ).array;
			for ( let i = 0; i < uv.length / 2; i ++ ) {

				const dx = pos[ i * 3 ] - cx, dz = pos[ i * 3 + 2 ] - cz;
				uv[ i * 2 ] = ( dx * ux + dz * uz ) / w + 0.5;
				uv[ i * 2 + 1 ] = 0.5 - ( dx * vx + dz * vz ) / h;

			}

			const m = new Mesh( g, mat );
			m.receiveShadow = true;
			this.group.add( m );

		};

		const wsMat = paint( ws, 'ws-logo' );
		decal( wsMat, [ - 16.5, - 2.5 ], 11, 5.5, 0.38 );
		decal( wsMat, [ 16.5, - 2.5 ], 11, 5.5, - 0.38 );
		decal( paint( script, 'grass-script' ), [ 0, 9.0 ], 11.5, 3.6, 0 );
		const od = paint( onDeck, 'on-deck' );
		for ( const side of [ 'home', 'away' ] ) decal( od, ON_DECK[ side ], 1.55, 1.55, 0 );

	}

	// ---------------------------------------------------------------- dugouts

	// white roofs lettered PHILADELPHIA PHILLIES, a navy band along the front
	_dugoutRoofs() {

		const tex = canvasTexture( 2048, 160, ( ctx, w, h ) => {

			ctx.fillStyle = '#eeece6';
			ctx.fillRect( 0, 0, w, h );
			ctx.font = '800 118px "Helvetica Neue", Arial, sans-serif';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.lineWidth = 10;
			ctx.strokeStyle = '#1d3f8f';
			ctx.strokeText( 'PHILADELPHIA PHILLIES', w / 2, h / 2 + 6, w - 120 );
			ctx.fillStyle = '#c8102e';
			ctx.fillText( 'PHILADELPHIA PHILLIES', w / 2, h / 2 + 6, w - 120 );

		}, 'dugoutRoof' );
		const band = canvasTexture( 2048, 96, ( ctx, w, h ) => {

			ctx.fillStyle = '#0c1b44';
			ctx.fillRect( 0, 0, w, h );
			ctx.font = '700 60px "Helvetica Neue", Arial, sans-serif';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillStyle = '#e9edf4';
			ctx.fillText( 'CITIZENS BANK PARK', w * 0.28, h / 2 + 3 );
			ctx.fillText( 'neweracap.com', w * 0.72, h / 2 + 3 );

		}, 'dugoutBand' );
		const top = standard( { name: 'dugout-roof-2008', roughness: 0.6, textures: { bpRoof: tex }, surface: 's.albedo = textureSample( bpRoof, smpAnisoClamp, in.uv ).rgb * 0.85;' } );
		const front = standard( { name: 'dugout-band', roughness: 0.6, textures: { bpBand: band }, surface: 's.albedo = textureSample( bpBand, smpAnisoClamp, in.uv ).rgb * 0.85;' } );
		for ( const m of [ top, front ] ) m.underwaterLighting = 'none';
		for ( const [ a, b ] of Object.values( DUGOUTS ) ) {

			const len = Math.hypot( b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ] );
			const ux = ( b[ 0 ] - a[ 0 ] ) / len, uz = ( b[ 1 ] - a[ 1 ] ) / len;
			let nx = - uz, nz = ux;
			if ( nx * - ( a[ 0 ] + b[ 0 ] ) / 2 + nz * ( - 40 - ( a[ 1 ] + b[ 1 ] ) / 2 ) > 0 ) {

				nx = - nx; nz = - nz;

			}

			// over the dugout roof (Field.js: roof top at 1.0 m, from 0.45 m in front to 0.25 m behind)
			const s0 = 4 * 0.35, s1 = len - 4 * 0.35;
			const at = ( s, t, y ) => [ a[ 0 ] + ux * s + nx * t, y, a[ 1 ] + uz * s + nz * t ];
			// read from the field: the reading direction along the dugout as seen from home plate
			const flip = ( a[ 0 ] + b[ 0 ] ) < 0;
			const [ L, R ] = flip ? [ s1, s0 ] : [ s0, s1 ];
			const q = new Quads();
			q.add( at( L, - 0.45, 1.005 ), at( R, - 0.45, 1.005 ), at( R, 2.85, 1.005 ), at( L, 2.85, 1.005 ), [ 0, 1, 0 ] );
			const g = q.geometry();
			setUV( g, ( p ) => [ ( ( p[ 0 ] - a[ 0 ] ) * ux + ( p[ 2 ] - a[ 1 ] ) * uz - L ) / ( R - L ), ( ( p[ 0 ] - a[ 0 ] ) * nx + ( p[ 2 ] - a[ 1 ] ) * nz + 0.45 ) / 3.3 ] );
			this.group.add( new Mesh( g, top ) );
			const f = new Quads();
			f.add( at( L, - 0.46, 0.75 ), at( R, - 0.46, 0.75 ), at( R, - 0.46, 1.0 ), at( L, - 0.46, 1.0 ), [ - nx, 0, - nz ] );
			const fg = f.geometry();
			setUV( fg, ( p ) => [ ( ( p[ 0 ] - a[ 0 ] ) * ux + ( p[ 2 ] - a[ 1 ] ) * uz - L ) / ( R - L ), 1 - ( p[ 1 ] - 0.75 ) / 0.25 ] );
			this.group.add( new Mesh( fg, front ) );

		}

	}

	// the infield tarp, rolled along the wall down the first base line, wrapped for the Series
	_tarp() {

		const tex = canvasTexture( 1024, 128, ( ctx, w, h ) => {

			ctx.fillStyle = '#0a1f52';
			ctx.fillRect( 0, 0, w, h );
			ctx.font = '800 64px "Helvetica Neue", Arial, sans-serif';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillStyle = '#f2f0ea';
			ctx.fillText( "WORLD SERIES '08 on FOX", w / 2, h / 2 + 3 );

		}, 'tarp' );
		const mat = standard( { name: 'tarp', roughness: 0.55, textures: { bpTarp: tex }, surface: 's.albedo = textureSample( bpTarp, smpAnisoRepeat, vec2f( in.uv.y * 5.0, in.uv.x ) ).rgb * 0.8;' } );
		mat.underwaterLighting = 'none';
		const [ a, b ] = [ FOUL_TERRITORY[ 4 ], FOUL_TERRITORY[ 3 ] ];
		const len = Math.hypot( b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ] );
		const roll = new Mesh( new CylinderGeometry( 0.55, 0.55, len - 1, 20 ), mat );
		const mx = ( a[ 0 ] + b[ 0 ] ) / 2, mz = ( a[ 1 ] + b[ 1 ] ) / 2;
		const nx = - ( b[ 1 ] - a[ 1 ] ) / len, nz = ( b[ 0 ] - a[ 0 ] ) / len;
		const sgn = nx * - mx + nz * ( - 40 - mz ) > 0 ? 1 : - 1;
		roll.position.set( mx + nx * sgn * 0.9, 0.55, mz + nz * sgn * 0.9 );
		roll.rotation.set( 0, - Math.atan2( b[ 1 ] - a[ 1 ], b[ 0 ] - a[ 0 ] ), Math.PI / 2 );
		roll.castShadow = true;
		roll.receiveShadow = true;
		this.group.add( roll );

	}

	// ---------------------------------------------------------------- the outfield wall

	// A panel on the fence's face between two points of a straight stretch (field-frame [ x, z ]),
	// from y0 to y1 above the field; the texture reads left to right as seen from the field.
	_fencePanel( A, B, y0, y1, mat ) {

		const len = Math.hypot( B[ 0 ] - A[ 0 ], B[ 1 ] - A[ 1 ] );
		const ux = ( B[ 0 ] - A[ 0 ] ) / len, uz = ( B[ 1 ] - A[ 1 ] ) / len;
		let nx = - uz, nz = ux;
		if ( nx * - A[ 0 ] + nz * - A[ 1 ] < 0 ) {

			nx = - nx; nz = - nz;

		}

		const o = 0.035;
		const P = ( p, y ) => [ p[ 0 ] + nx * o, y, p[ 1 ] + nz * o ];
		// seen from the field (facing -n), left is +u when u x n points down... pick by the cross product
		const leftFirst = ( ux * nz - uz * nx ) > 0;
		const [ L, R ] = leftFirst ? [ A, B ] : [ B, A ];
		const q = new Quads();
		q.add( P( L, y0 ), P( R, y0 ), P( R, y1 ), P( L, y1 ), [ nx, 0, nz ] );
		const g = q.geometry();
		setUV( g, ( p ) => [ ( ( p[ 0 ] - L[ 0 ] ) * ( R[ 0 ] - L[ 0 ] ) + ( p[ 2 ] - L[ 1 ] ) * ( R[ 1 ] - L[ 1 ] ) ) / ( len * len ), 1 - ( p[ 1 ] - y0 ) / ( y1 - y0 ) ] );
		const m = new Mesh( g, mat );
		m.receiveShadow = true;
		this.group.add( m );
		return m;

	}

	_wallAds() {

		// along the straight left field wall: from just past 334 to 387, the panels in October 2008
		const at = ( i ) => fencePoint( OUTFIELD[ i ][ 0 ], OUTFIELD[ i ][ 1 ] );
		const P334 = at( 1 ), P387 = at( 3 );
		const along = ( t ) => [ P334[ 0 ] + ( P387[ 0 ] - P334[ 0 ] ) * t, P334[ 1 ] + ( P387[ 1 ] - P334[ 1 ] ) * t ];
		const ads = [
			[ 0.09, 0.21, 'W.B. MASON', 'Who but W.B. Mason', '#f5c400', '#12203f' ],
			[ 0.23, 0.35, 'WORLD SERIES', 'on FOX', '#0b3a8e', '#ffffff' ],
			[ 0.37, 0.51, 'Bud Light', 'The Difference is Drinkability', '#0a4aa8', '#ffffff' ],
			[ 0.53, 0.67, 'MLB NETWORK', 'January 1, 2009', '#1b1f5c', '#e6e8f0' ],
			[ 0.79, 0.95, 'SOUTHWEST', 'AIRLINES', '#243a8c', '#f2c230' ],
		];
		const H = 10.5 * FT - 0.3;
		for ( const [ t0, t1, big, small, bg, fg ] of ads ) {

			this._fencePanel( along( t0 ), along( t1 ), 0.35, H, adMaterial( big, small, bg, fg ) );

		}

		// State Farm on Monty's Angle
		const A381 = at( 5 ), A409 = at( 6 );
		const lerp = ( a, b, t ) => [ a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * t, a[ 1 ] + ( b[ 1 ] - a[ 1 ] ) * t ];
		this._fencePanel( lerp( A381, A409, 0.12 ), lerp( A381, A409, 0.72 ), 1.0, 3.2, adMaterial( 'State Farm', 'Like a good neighbor', '#d62311', '#ffffff' ) );

	}

	// The out-of-town scoreboard built into the right field wall, 208 ft long from the 398 corner toward
	// the pole: game cells (dark during the Series), the count panel for this game's pitcher, and ads.
	_outOfTownBoard() {

		const at = ( i ) => fencePoint( OUTFIELD[ i ][ 0 ], OUTFIELD[ i ][ 1 ] );
		const A = at( 10 ), B = at( 12 );
		const len = Math.hypot( B[ 0 ] - A[ 0 ], B[ 1 ] - A[ 1 ] );
		const t1 = Math.min( 0.96, 208 * FT / len );
		const lerp = ( t ) => [ A[ 0 ] + ( B[ 0 ] - A[ 0 ] ) * t, A[ 1 ] + ( B[ 1 ] - A[ 1 ] ) * t ];
		this.ootCanvas = new OffscreenCanvas( 2400, 200 );
		this.ootTexture = canvasTexture( 2400, 200, ( ctx, w, h ) => drawOutOfTown( ctx, w, h, null ), 'outOfTown' );
		const mat = standard( { name: 'out-of-town', roughness: 0.5, textures: { bpOot: this.ootTexture },
			surface: 'let t = textureSample( bpOot, smpAnisoClamp, in.uv ).rgb; s.albedo = t * 0.5; s.emissive = t * step( 0.55, max( t.r, max( t.g, t.b ) ) ) * mix( 0.6, 0.9, frame.night );' } );
		mat.underwaterLighting = 'none';
		this._fencePanel( lerp( 0.02 ), lerp( t1 ), 0.5, 13.25 * FT - 0.35, mat );

	}

	// this game's pitcher and his count on the out-of-town board's matrix
	updateOutOfTown( st ) {

		if ( ! this.ootCanvas ) return;
		const ctx = this.ootCanvas.getContext( '2d' );
		drawOutOfTown( ctx, this.ootCanvas.width, this.ootCanvas.height, st );
		const img = ctx.getImageData( 0, 0, this.ootCanvas.width, this.ootCanvas.height );
		this.ootTexture.upload( new Uint8Array( img.data.buffer ) );
		generateMipmaps( this.ootTexture );

	}

	// the center field fence (409 to 398) carries an open padded rail above it
	_cfRail() {

		const rail = standard( { name: 'cf-rail', color: new Color( 0.02, 0.13, 0.08 ), roughness: 0.6, metalness: 0.3 } );
		rail.underwaterLighting = 'none';
		const at = ( i ) => fencePoint( OUTFIELD[ i ][ 0 ], OUTFIELD[ i ][ 1 ] );
		const pts = [ at( 7 ), at( 8 ), at( 9 ) ];
		const top = 6 * FT + 0.95;
		for ( let i = 0; i < pts.length - 1; i ++ ) {

			const [ a, b ] = [ pts[ i ], pts[ i + 1 ] ];
			const len = Math.hypot( b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ] );
			const bar = new Mesh( new BoxGeometry( len, 0.12, 0.12 ), rail );
			bar.position.set( ( a[ 0 ] + b[ 0 ] ) / 2, top, ( a[ 1 ] + b[ 1 ] ) / 2 );
			bar.rotation.y = - Math.atan2( b[ 1 ] - a[ 1 ], b[ 0 ] - a[ 0 ] );
			this.group.add( bar );
			const n = Math.round( len / 2.4 );
			for ( let k = 0; k <= n; k ++ ) {

				const t = k / n;
				const post = new Mesh( new BoxGeometry( 0.08, 0.95, 0.08 ), rail );
				post.position.set( a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * t, top - 0.47, a[ 1 ] + ( b[ 1 ] - a[ 1 ] ) * t );
				this.group.add( post );

			}

		}

	}

	// flower boxes along the top of the left field wall (gold mums in October)
	_planters() {

		const mat = standard( { name: 'mums', color: new Color( 0.6, 0.38, 0.02 ), roughness: 0.9, modules: [ commonModule ],
			surface: /* wgsl */`
	let n = mx_noise_float3( in.P * 9.0 );
	let leaf = smoothstep( 0.1, 0.4, mx_noise_float3( in.P * 3.0 + 7.0 ) );
	s.albedo = mix( vec3f( 0.03, 0.08, 0.02 ), mat.color * ( 0.8 + 0.4 * n ), 0.35 + 0.5 * leaf );
` } );
		mat.underwaterLighting = 'none';
		const at = ( i ) => fencePoint( OUTFIELD[ i ][ 0 ], OUTFIELD[ i ][ 1 ] );
		const pts = [ at( 0 ), at( 1 ), at( 3 ) ];
		for ( let i = 0; i < pts.length - 1; i ++ ) {

			const [ a, b ] = [ pts[ i ], pts[ i + 1 ] ];
			const len = Math.hypot( b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ] );
			let nx = - ( b[ 1 ] - a[ 1 ] ) / len, nz = ( b[ 0 ] - a[ 0 ] ) / len;
			if ( nx * - a[ 0 ] + nz * - a[ 1 ] > 0 ) {

				nx = - nx; nz = - nz;

			}

			const box = new Mesh( new BoxGeometry( len, 0.55, 1.0 ), mat );
			box.position.set( ( a[ 0 ] + b[ 0 ] ) / 2 + nx * 0.95, 10.5 * FT + 0.15, ( a[ 1 ] + b[ 1 ] ) / 2 + nz * 0.95 );
			box.rotation.y = - Math.atan2( b[ 1 ] - a[ 1 ], b[ 0 ] - a[ 0 ] );
			box.receiveShadow = true;
			this.group.add( box );

		}

		void LEVELS;

	}

}

// the Wall of Fame (2008): two rows of bronze plaques on the brick wall over the bullpens, facing the field
Details2008.prototype._wallOfFame = function () {

	const bronze = standard( { name: 'plaques', color: new Color( 0.2, 0.11, 0.04 ), roughness: 0.4, metalness: 0.85 } );
	bronze.underwaterLighting = 'none';
	const [ ax, az ] = fencePoint( 0, 401 ), [ bx, bz ] = fencePoint( 11, 398 );
	const L = Math.hypot( bx - ax, bz - az ), ux = ( bx - ax ) / L, uz = ( bz - az ) / L;
	let nx = - uz, nz = ux;
	if ( nx * ax + nz * az < 0 ) {

		nx = - nx; nz = - nz;

	}

	const t = 0.5 + 2 * BULLPENS.depth - 0.05; // the upper pen's back wall, its face toward the field
	const geo = new BoxGeometry( 0.62, 0.8, 0.06 );
	for ( let row = 0; row < 2; row ++ ) for ( let k = 0; k < 20; k ++ ) {

		const s = - 2 + k * 1.3;
		const m = new Mesh( geo, bronze );
		m.position.set( ax + ux * s + nx * t, BULLPENS.upperRise + 1.2 + row * 0.95, az + uz * s + nz * t );
		m.rotation.y = - Math.atan2( uz, ux );
		this.group.add( m );

	}

};

// ---------------------------------------------------------------- drawing

function setUV( g, f ) {

	const uv = g.getAttribute( 'uv' ).array, pos = g.getAttribute( 'position' ).array;
	for ( let i = 0; i < uv.length / 2; i ++ ) {

		const [ u, v ] = f( [ pos[ i * 3 ], pos[ i * 3 + 1 ], pos[ i * 3 + 2 ] ] );
		uv[ i * 2 ] = u;
		uv[ i * 2 + 1 ] = v;

	}

}

function star( ctx, cx, cy, r, color ) {

	ctx.beginPath();
	for ( let i = 0; i < 10; i ++ ) {

		const a = - Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.42 : r;
		ctx.lineTo( cx + Math.cos( a ) * rr, cy + Math.sin( a ) * rr );

	}

	ctx.closePath();
	ctx.fillStyle = color;
	ctx.fill();

}

// the 2008 World Series logo, drawn in its spirit: the red, white and blue banner, WORLD SERIES and 2008
function drawWorldSeriesLogo( ctx, w, h ) {

	ctx.save();
	// the banner shape
	ctx.fillStyle = '#f2f0ea';
	ctx.beginPath();
	ctx.moveTo( w * 0.08, h * 0.2 ); ctx.lineTo( w * 0.92, h * 0.1 ); ctx.lineTo( w * 0.9, h * 0.82 ); ctx.lineTo( w * 0.1, h * 0.9 ); ctx.closePath();
	ctx.fill();
	ctx.lineWidth = 14;
	ctx.strokeStyle = '#0c2461';
	ctx.stroke();
	// the batter badge
	ctx.fillStyle = '#0c2461';
	ctx.fillRect( w * 0.72, h * 0.14, w * 0.17, h * 0.2 );
	ctx.fillStyle = '#c8102e';
	ctx.fillRect( w * 0.8, h * 0.14, w * 0.09, h * 0.2 );
	ctx.fillStyle = '#f2f0ea';
	ctx.beginPath();
	ctx.arc( w * 0.79, h * 0.2, h * 0.035, 0, Math.PI * 2 );
	ctx.fill();
	ctx.font = '900 150px "Helvetica Neue", Arial, sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillStyle = '#0c2461';
	ctx.fillText( 'WORLD', w * 0.42, h * 0.36 );
	ctx.fillText( 'SERIES', w * 0.5, h * 0.6 );
	ctx.fillStyle = '#c9a44a';
	ctx.font = '900 96px "Helvetica Neue", Arial, sans-serif';
	ctx.fillText( '2008', w * 0.5, h * 0.8 );
	ctx.restore();

}

function adMaterial( big, small, bg, fg ) {

	const tex = canvasTexture( 1024, 256, ( ctx, w, h ) => {

		ctx.fillStyle = bg;
		ctx.fillRect( 0, 0, w, h );
		ctx.fillStyle = fg;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.font = /Bud|State/.test( big ) ? 'italic 800 118px Georgia, serif' : '900 110px "Helvetica Neue", Arial, sans-serif';
		ctx.fillText( big, w / 2, h * 0.42, w - 60 );
		ctx.font = '600 40px "Helvetica Neue", Arial, sans-serif';
		ctx.fillText( small, w / 2, h * 0.8, w - 60 );

	}, 'wallAd' );
	const m = standard( { name: 'wall-ad', roughness: 0.7, textures: { bpAd: tex }, surface: 's.albedo = textureSample( bpAd, smpAnisoClamp, in.uv ).rgb * 0.75;' } );
	m.underwaterLighting = 'none';
	return m;

}

// The out-of-town board: Turkey Hill at the left end, game cells (dark: no other games during the
// Series), this game's pitcher with balls / strikes / total, the MLB notes, Majestic, more cells.
function drawOutOfTown( ctx, w, h, st ) {

	ctx.fillStyle = '#0a0b0d';
	ctx.fillRect( 0, 0, w, h );
	ctx.fillStyle = '#0f3d2a';
	ctx.fillRect( 0, 0, w, 8 );
	ctx.fillRect( 0, h - 8, w, 8 );
	const amber = '#ffab2e';
	// Turkey Hill
	ctx.fillStyle = '#e9dcc1';
	ctx.fillRect( 12, 14, 150, h - 28 );
	ctx.fillStyle = '#7a3b12';
	ctx.font = 'italic 700 34px Georgia, serif';
	ctx.textAlign = 'center';
	ctx.fillText( 'Turkey Hill', 87, 70, 140 );
	ctx.font = 'italic 700 38px Georgia, serif';
	ctx.fillText( 'Graham', 87, 118, 140 );
	ctx.fillText( 'Slam', 87, 156, 140 );
	// cells: dark nameplates and unlit digits
	const cell = ( x ) => {

		ctx.fillStyle = '#16181c';
		ctx.fillRect( x, 16, 150, h - 32 );
		ctx.strokeStyle = '#2a2d33';
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.moveTo( x + 40, h / 2 ); ctx.lineTo( x + 60, h / 2 - 22 ); ctx.lineTo( x + 80, h / 2 ); ctx.lineTo( x + 60, h / 2 + 22 ); ctx.closePath();
		ctx.stroke();
		ctx.fillStyle = '#2b2d31';
		ctx.font = '700 30px "Courier New", monospace';
		ctx.fillText( '88', x + 120, 60 );
		ctx.fillText( '88', x + 120, 140 );

	};

	for ( let i = 0; i < 4; i ++ ) cell( 180 + i * 160 );
	// the count panel
	const px = 840, pw = 520;
	ctx.fillStyle = '#120c04';
	ctx.fillRect( px, 16, pw, h - 32 );
	const glow = ( t, x, y, size, align = 'left' ) => {

		ctx.fillStyle = amber;
		ctx.shadowColor = amber;
		ctx.shadowBlur = 6;
		ctx.font = `700 ${ size }px "Courier New", monospace`;
		ctx.textAlign = align;
		ctx.fillText( t, x, y );
		ctx.shadowBlur = 0;

	};

	const pit = st?.pitcher;
	glow( pit ? `${ pit.num } ${ pit.last }` : 'WORLD SERIES', px + 20, 58, 36 );
	glow( 'BALLS', px + 30, 104, 24 );
	glow( 'STRIKES', px + 190, 104, 24 );
	glow( 'TOTAL', px + 380, 104, 24 );
	if ( pit ) {

		glow( String( pit.balls ), px + 70, 162, 52, 'center' );
		glow( String( pit.strikes ), px + 250, 162, 52, 'center' );
		glow( String( pit.balls + pit.strikes ), px + 430, 162, 52, 'center' );

	}

	// MLB notes and Majestic
	ctx.fillStyle = '#b3121d';
	ctx.fillRect( px + pw + 12, 16, 250, h - 32 );
	ctx.fillStyle = '#ffffff';
	ctx.font = '800 30px "Helvetica Neue", Arial, sans-serif';
	ctx.textAlign = 'center';
	ctx.fillText( 'MAJOR LEAGUE', px + pw + 137, 88 );
	ctx.fillText( 'BASEBALL NOTES', px + pw + 137, 128 );
	ctx.fillStyle = '#e8e4dc';
	ctx.fillRect( px + pw + 276, 16, 200, h - 32 );
	ctx.fillStyle = '#b3121d';
	ctx.font = 'italic 800 44px "Helvetica Neue", Arial, sans-serif';
	ctx.fillText( 'Majestic', px + pw + 376, h / 2 + 14 );
	for ( let i = 0; i < 4; i ++ ) cell( 1640 + i * 160 );
	ctx.textAlign = 'left';

}
