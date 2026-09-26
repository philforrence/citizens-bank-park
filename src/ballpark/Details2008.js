import { Group, Mesh, CylinderGeometry, BoxGeometry, Color } from '../engine/index.js';
import { commonModule } from '../engine/render/wgsl/common.js';
import { standard } from '../materials/Materials.js';
import { Quads } from './Stands.js';
import { canvasTexture, beam } from './geo.js';
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
		decal( wsMat, [ - 16.3, - 2.8 ], 9.6, 4.8, 0.38 );
		decal( wsMat, [ 16.3, - 2.8 ], 9.6, 4.8, - 0.38 );
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
			// the front band faces the field: read left to right from there (the viewer's right is ( -nz, nx ))
			const rightIsU = ( ux * - nz + uz * nx ) > 0;
			const [ FL, FR ] = rightIsU ? [ s0, s1 ] : [ s1, s0 ];
			const f = new Quads();
			f.add( at( FL, - 0.46, 0.75 ), at( FR, - 0.46, 0.75 ), at( FR, - 0.46, 1.0 ), at( FL, - 0.46, 1.0 ), [ - nx, 0, - nz ] );
			const fg = f.geometry();
			setUV( fg, ( p ) => [ ( ( p[ 0 ] - a[ 0 ] ) * ux + ( p[ 2 ] - a[ 1 ] ) * uz - FL ) / ( FR - FL ), 1 - ( p[ 1 ] - 0.75 ) / 0.25 ] );
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
		// in order from the pole (hesb/2986448333.jpg): the World Series on FOX, Bud Light, the Winter
		// Classic's JANUARY 1 2009 shield, the 374 marker, Southwest, then 387
		const panel = ( draw, label ) => {

			const tex = canvasTexture( 1024, 384, draw, label );
			const m = standard( { name: 'wall-ad', roughness: 0.7, textures: { bpAd: tex }, surface: 's.albedo = textureSample( bpAd, smpAnisoClamp, in.uv ).rgb * 0.8;' } );
			m.underwaterLighting = 'none';
			return m;

		};

		const ads = [
			[ 0.05, 0.27, panel( ( ctx, w, h ) => {

				ctx.fillStyle = '#1b2a5c'; ctx.fillRect( 0, 0, w, h );
				ctx.save(); ctx.translate( w * 0.06, h * 0.08 ); drawWorldSeriesLogo( ctx, w * 0.55, h * 0.84 ); ctx.restore();
				ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
				ctx.font = 'italic 600 54px "Helvetica Neue", Arial, sans-serif'; ctx.fillText( 'on', w * 0.72, h * 0.5 );
				ctx.font = 'italic 900 150px "Helvetica Neue", Arial, sans-serif'; ctx.fillText( 'FOX', w * 0.86, h * 0.52 );

			}, 'adWS' ) ],
			[ 0.31, 0.53, panel( ( ctx, w, h ) => {

				const g = ctx.createLinearGradient( 0, 0, w, 0 );
				g.addColorStop( 0, '#1f5faf' ); g.addColorStop( 1, '#0b3a80' );
				ctx.fillStyle = g; ctx.fillRect( 0, 0, w, h );
				// the photo inset: a cold can on ice
				ctx.fillStyle = '#9fc4e8'; ctx.fillRect( w * 0.72, h * 0.08, w * 0.24, h * 0.84 );
				ctx.fillStyle = '#e8eef5'; ctx.fillRect( w * 0.79, h * 0.2, w * 0.1, h * 0.62 );
				ctx.fillStyle = '#1f5faf'; ctx.fillRect( w * 0.79, h * 0.42, w * 0.1, h * 0.12 );
				ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
				ctx.font = 'italic 800 130px Georgia, serif'; ctx.fillText( 'Bud Light', w * 0.36, h * 0.4, w * 0.62 );
				ctx.font = '800 44px "Helvetica Neue", Arial, sans-serif'; ctx.fillText( 'DRINKABILITY', w * 0.36, h * 0.78 );

			}, 'adBud' ) ],
			[ 0.57, 0.79, panel( ( ctx, w, h ) => {

				const g = ctx.createLinearGradient( 0, 0, 0, h );
				g.addColorStop( 0, '#3a2e6e' ); g.addColorStop( 1, '#1b1846' );
				ctx.fillStyle = g; ctx.fillRect( 0, 0, w, h );
				// the Winter Classic shield
				const cx = w * 0.2, cy = h * 0.5;
				ctx.fillStyle = '#e8e6f0';
				ctx.beginPath(); ctx.moveTo( cx - 90, cy - 120 ); ctx.lineTo( cx + 90, cy - 120 ); ctx.lineTo( cx + 90, cy + 20 ); ctx.quadraticCurveTo( cx + 80, cy + 100, cx, cy + 140 ); ctx.quadraticCurveTo( cx - 80, cy + 100, cx - 90, cy + 20 ); ctx.closePath(); ctx.fill();
				ctx.fillStyle = '#1b1846'; ctx.font = '900 40px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
				ctx.fillText( 'WINTER', cx, cy - 50 ); ctx.fillText( 'CLASSIC', cx, cy + 5 );
				ctx.fillStyle = '#ffffff'; ctx.font = '900 96px "Helvetica Neue", Arial, sans-serif';
				ctx.fillText( 'JANUARY 1', w * 0.64, h * 0.4 );
				ctx.fillText( '2009', w * 0.64, h * 0.72 );

			}, 'adWinter' ) ],
			[ 0.885, 0.985, panel( ( ctx, w, h ) => {

				ctx.fillStyle = '#ffffff'; ctx.fillRect( 0, 0, w, h );
				ctx.fillStyle = '#304cb2'; ctx.fillRect( 0, h * 0.84, w, h * 0.16 );
				ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
				ctx.fillStyle = '#c8102e'; ctx.font = 'italic 900 150px "Helvetica Neue", Arial, sans-serif'; ctx.fillText( 'SOUTHWEST', w / 2, h * 0.36, w - 40 );
				ctx.fillStyle = '#304cb2'; ctx.font = '800 90px "Helvetica Neue", Arial, sans-serif'; ctx.fillText( 'AIRLINES', w / 2, h * 0.66 );

			}, 'adSouthwest' ) ],
		];
		const H = 10.5 * FT - 0.3;
		for ( const [ t0, t1, mat ] of ads ) this._fencePanel( along( t0 ), along( t1 ), 0.35, H, mat );

		// Toyota down both lines on the padded wall in foul territory, beyond the dugouts
		const toyota = adMaterial( 'TOYOTA', 'Moving Forward', '#d4141f', '#ffffff' );
		for ( const [ A, B ] of [ [ [ 52.37, - 40.3 ], [ 52.8, - 48.49 ] ], [ [ - 52.37, - 40.3 ], [ - 52.8, - 48.49 ] ] ] ) {

			const lerp = ( t ) => [ A[ 0 ] + ( B[ 0 ] - A[ 0 ] ) * t, A[ 1 ] + ( B[ 1 ] - A[ 1 ] ) * t ];
			this._fencePanel( lerp( 0.1 ), lerp( 0.9 ), 0.2, 1.15, toyota );

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
	// Over the left field wall, in front of the first row of seats: a galvanized guard rail, square
	// posts every 2 m, a top pipe and a mid rail, chain-link in the panels (2008; no flower boxes here)
	_planters() {

		const steel = standard( { name: 'lf-guard-rail', color: new Color( 0.52, 0.54, 0.55 ), roughness: 0.45, metalness: 0.8 } );
		const mesh = standard( { name: 'lf-chain-link', color: new Color( 0.5, 0.52, 0.53 ), roughness: 0.5, metalness: 0.7, side: 'double', alphaTest: 0.5,
			surface: /* wgsl */`
	// 5 cm diamonds, fading to a faint veil when finer than a pixel
	let p = vec2f( in.uv.x + in.uv.y, in.uv.x - in.uv.y ) / 0.05;
	let g = abs( fract( p ) - 0.5 );
	let fw = fwidth( p.x );
	let wire = step( 0.42 - fw, max( g.x, g.y ) );
	s.alpha = max( wire * step( fw, 0.9 ), clamp( fw * 0.35, 0.0, 0.3 ) );
` } );
		for ( const m of [ steel, mesh ] ) m.underwaterLighting = 'none';
		const at = ( i ) => fencePoint( OUTFIELD[ i ][ 0 ], OUTFIELD[ i ][ 1 ] );
		const pts = [ at( 0 ), at( 1 ), at( 3 ) ];
		const q = new Quads(), c = new Quads();
		const y0 = 10.5 * FT, H = 1.05;
		let u = 0;
		for ( let i = 0; i < pts.length - 1; i ++ ) {

			const [ a, b ] = [ pts[ i ], pts[ i + 1 ] ];
			const len = Math.hypot( b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ] );
			const ux = ( b[ 0 ] - a[ 0 ] ) / len, uz = ( b[ 1 ] - a[ 1 ] ) / len;
			let nx = - uz, nz = ux;
			if ( nx * - a[ 0 ] + nz * - a[ 1 ] > 0 ) {

				nx = - nx; nz = - nz;

			}

			// just behind the wall's cap
			const o = 0.55;
			const P = ( t, y ) => [ a[ 0 ] + ux * t + nx * o, y, a[ 1 ] + uz * t + nz * o ];
			beam( q, P( 0, y0 + H ), P( len, y0 + H ), 0.05 );
			beam( q, P( 0, y0 + H * 0.5 ), P( len, y0 + H * 0.5 ), 0.035 );
			const n = Math.max( 1, Math.round( len / 2 ) );
			for ( let k = 0; k <= n; k ++ ) beam( q, P( len * k / n, y0 ), P( len * k / n, y0 + H ), 0.06 );
			c.tri( P( 0, y0 ), P( len, y0 ), P( len, y0 + H ), [ - nx, 0, - nz ], [ u, 0 ], [ u + len, 0 ], [ u + len, H ] );
			c.tri( P( 0, y0 ), P( len, y0 + H ), P( 0, y0 + H ), [ - nx, 0, - nz ], [ u, 0 ], [ u + len, H ], [ u, H ] );
			u += len;

		}

		for ( const [ g, m, name ] of [ [ q, steel, 'lf-guard-rail' ], [ c, mesh, 'lf-chain-link' ] ] ) {

			const mm = new Mesh( g.geometry(), m );
			mm.name = name;
			mm.castShadow = true;
			this.group.add( mm );

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

// The 2008 World Series logo as it was painted on the grass (hesb/2986447135.jpg): WORLD SERIES in cream
// serif letters, each on a navy field that follows the letters, a white outline round the whole shape,
// the MLB batter logo in a white frame on top and 2008 in gold on a navy pill below. Grass all round.
function drawWorldSeriesLogo( ctx, w, h ) {

	ctx.save();
	ctx.clearRect( 0, 0, w, h );
	ctx.textAlign = 'center';
	ctx.textBaseline = 'alphabetic';
	ctx.lineJoin = 'round';
	const lines = [
		[ 'WORLD', `700 ${ Math.round( h * 0.27 ) }px Georgia, "Times New Roman", serif`, h * 0.47, 0.72 ],
		[ 'SERIES', `700 ${ Math.round( h * 0.33 ) }px Georgia, "Times New Roman", serif`, h * 0.76, 0.94 ],
	];
	const pill = [ w * 0.34, h * 0.8, w * 0.32, h * 0.17 ];
	const logo = [ w * 0.4, h * 0.02, w * 0.2, h * 0.17 ];
	const shapes = ( stroke, fill, lw ) => {

		ctx.strokeStyle = stroke;
		ctx.fillStyle = fill;
		ctx.lineWidth = lw;
		for ( const [ t, font, y, sx ] of lines ) {

			ctx.font = font;
			ctx.save();
			ctx.translate( w / 2, y );
			ctx.scale( sx * w / ctx.measureText( t ).width, 1 );
			ctx.lineWidth = lw / ( sx * w / ctx.measureText( t ).width );
			ctx.strokeText( t, 0, 0 );
			ctx.fillText( t, 0, 0 );
			ctx.restore();

		}

		ctx.beginPath(); ctx.roundRect( pill[ 0 ] - lw / 2, pill[ 1 ] - lw / 2, pill[ 2 ] + lw, pill[ 3 ] + lw, pill[ 3 ] / 2 ); ctx.fill();
		ctx.fillRect( logo[ 0 ] - lw / 2, logo[ 1 ] - lw / 2, logo[ 2 ] + lw, logo[ 3 ] + lw );

	};

	// the white outline, the navy field, then the letters
	shapes( '#f4f2ec', '#f4f2ec', h * 0.16 );
	shapes( '#10275f', '#10275f', h * 0.1 );
	ctx.lineWidth = 3;
	for ( const [ t, font, y, sx ] of lines ) {

		ctx.font = font;
		ctx.save();
		ctx.translate( w / 2, y );
		ctx.scale( sx * w / ctx.measureText( t ).width, 1 );
		ctx.fillStyle = '#f1ead2';
		ctx.fillText( t, 0, 0 );
		ctx.strokeStyle = '#c9a44a';
		ctx.lineWidth = 3;
		ctx.strokeText( t, 0, 0 );
		ctx.restore();

	}

	// 2008 in gold on the pill
	ctx.font = `800 ${ Math.round( h * 0.15 ) }px Georgia, serif`;
	ctx.textBaseline = 'middle';
	ctx.fillStyle = '#e3b23c';
	ctx.fillText( '2008', w / 2, pill[ 1 ] + pill[ 3 ] / 2 + 2 );
	// the MLB logo: the batter in white on red and blue
	const [ lx, ly, lw, lh ] = logo;
	ctx.fillStyle = '#f4f2ec';
	ctx.fillRect( lx, ly, lw, lh );
	ctx.fillStyle = '#1d3f8f';
	ctx.fillRect( lx + 6, ly + 6, lw * 0.45, lh - 12 );
	ctx.fillStyle = '#c8102e';
	ctx.fillRect( lx + lw * 0.45 + 6, ly + 6, lw * 0.55 - 12, lh - 12 );
	ctx.fillStyle = '#f4f2ec';
	ctx.beginPath(); ctx.ellipse( lx + lw * 0.6, ly + lh * 0.32, lw * 0.07, lh * 0.13, 0, 0, Math.PI * 2 ); ctx.fill();
	ctx.beginPath();
	ctx.moveTo( lx + lw * 0.3, ly + lh - 6 ); ctx.quadraticCurveTo( lx + lw * 0.45, ly + lh * 0.42, lx + lw * 0.66, ly + lh * 0.46 ); ctx.lineTo( lx + lw * 0.78, ly + lh - 6 );
	ctx.fill();
	ctx.fillStyle = '#f4f2ec';
	ctx.beginPath(); ctx.arc( lx + lw * 0.2, ly + lh * 0.7, lh * 0.06, 0, Math.PI * 2 ); ctx.fill();
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
