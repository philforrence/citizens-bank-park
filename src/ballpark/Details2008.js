import { Group, Mesh, InstancedMesh, CylinderGeometry, BoxGeometry, SphereGeometry, BufferGeometry, Float32BufferAttribute, Color, Matrix4, Quaternion, Vector3 } from '../engine/index.js';
import { moundHeight, DUGOUT_ROOF, DUGOUT_ZONES } from './Field.js';
import { commonModule } from '../engine/render/wgsl/common.js';
import { standard } from '../materials/Materials.js';
import { Quads } from './Stands.js';
import { canvasTexture, beam, refreshCanvasTexture } from './geo.js';
import { generateMipmaps } from '../engine/gpu/Mipmaps.js';
import { FT, OUTFIELD, FOUL_TERRITORY, DUGOUTS, LEVELS, BULLPENS, fencePoint } from './layout.js';
import { ON_DECK } from './game/Plays.js';
import { FieldLevel } from './FieldLevel.js';

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
		// the dugouts' gear and benches, the people at field level (FieldLevel.js)
		this.fieldLevel = new FieldLevel( { field, parent: this.group } );

	}

	update( dt, director ) {

		this.fieldLevel.update( dt, director );

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
			ctx.lineJoin = 'round';
			ctx.strokeStyle = '#f2f0ea';
			ctx.strokeText( 'Phillies', w / 2, h / 2 + 10, w - 30 );
			ctx.fillStyle = '#ba0c2f';
			ctx.fillText( 'Phillies', w / 2, h / 2 + 10, w - 30 );
			// the stars dot the two i's (measured on the word as drawn)
			const full = Math.min( w - 30, ctx.measureText( 'Phillies' ).width ), k = full / ctx.measureText( 'Phillies' ).width, x0 = w / 2 - full / 2;
			for ( const pre of [ 'Ph', 'Phill' ] ) {

				const xi = x0 + ( ctx.measureText( pre ).width + ctx.measureText( 'i' ).width * 0.6 ) * k;
				star( ctx, xi + 6, h * 0.2, 22, '#284898' );

			}

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
			drawWorldSeriesLogo( ctx, 1024, 512, { clear: false } );
			ctx.restore();

		}, 'onDeck' );
		// ---- W4 (rail): paint sprayed into the grass, not a sticker on it: the blades come through it
		// up close and it takes the mowing's light and dark; its stencilled edges a little ragged; and the
		// rain on the 27th washes it out, pale and grey-green by the 29th (the Commons photo of the 29th:
		// the World Series logo by the third base dugout faded). `fade` (0..1) is set by the rail
		// (places/FieldRail.js) from the replay's time
		this.paintMats = [];
		const paint = ( tex, name ) => {

			const m = standard( { name, roughness: 0.85, alphaTest: 0.4, textures: { bpPaint: tex }, modules: [ commonModule ], uniforms: { fade: [ 'f32', 0 ] },
				surface: /* wgsl */`
	let t = textureSample( bpPaint, smpAnisoClamp, in.uv );
	let fw = length( fwidth( in.P.xz ) );
	let near = 1.0 - smoothstep( 0.004, 0.03, fw );
	// the blades: fine streaks, as the field's grass has them
	let bl = mx_noise_float2( in.P.xz * vec2f( 230.0, 25.0 ) ) * 0.5 + 0.5;
	let clump = mx_noise_float2( in.P.xz * 9.0 ) * 0.5 + 0.5;
	let grass = vec3f( 0.13, 0.29, 0.05 ) * ( 0.85 + 0.3 * clump );
	// how much paint there is: less where the blades part (up close), less as the rain washes it
	let cover = clamp( 1.0 - mat.fade * ( 0.55 + 0.35 * clump ) - near * 0.35 * ( 1.0 - bl ), 0.0, 1.0 );
	var c = mix( grass, t.rgb * 0.78 * ( 0.9 + 0.2 * bl ), cover );
	// soaked, it darkens with the grass round it
	c = c * ( 1.0 - 0.2 * frame.wet );
	// the stencil's edge: overspray, ragged with the grass
	s.alpha = t.a * ( 0.8 + 0.4 * mx_noise_float2( in.P.xz * 14.0 ) );
	s.albedo = c;
	s.roughness = 0.85;
	s.emissive = c * smoothstep( 0.2, 0.8, frame.night ) * 0.35;
` } );
			m.underwaterLighting = 'none';
			m.setDefine( 'DRY', 1 ); // it's grass: the field's own wet
			this.paintMats.push( m );
			return m;

		};
		// ---- end W4

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

		// the World Series logos in foul territory, turned to the stands: each one's baseline parallel to
		// its foul line, its top toward fair territory, so it reads upright to the fans behind that dugout
		// and on a steep diagonal from high behind home (Getty 163678267, Game 4; luidude 2981634108, Oct
		// 27); 11 m out along the line and 7.5 m off it
		const wsMat = paint( ws, 'ws-logo' );
		decal( wsMat, [ - 13.2, - 2.6 ], 6.6, 3.3, Math.PI / 4 );
		decal( wsMat, [ 13.2, - 2.6 ], 6.6, 3.3, - Math.PI / 4 );
		decal( paint( script, 'grass-script' ), [ 0, 8.5 ], 7.4, 2.4, 0 );
		const od = paint( onDeck, 'on-deck' );
		for ( const side of [ 'home', 'away' ] ) decal( od, ON_DECK[ side ], 1.55, 1.55, 0 );

	}

	// ---------------------------------------------------------------- dugouts

	// White roofs (the first base one lettered PHILADELPHIA PHILLIES in red edged in blue with a red
	// pinstripe along its field edge and MLB's logo at each end, the visitors' Citizens Bank Park in green)
	// over a navy front: a light strip of little Citizens Bank Park and neweracap.com logos along its top,
	// then the ballpark's name with its emblem and New Era's flag in white (hesb/2987302474.jpg)
	_dugoutRoofs() {

		const tex = canvasTexture( 2048, 200, ( ctx, w, h ) => {

			ctx.fillStyle = '#eeece6';
			ctx.fillRect( 0, 0, w, h );
			// the pinstripe along the field edge (the bottom of the texture is the field side)
			ctx.fillStyle = '#c8102e';
			ctx.fillRect( 0, h - 16, w, 5 );
			ctx.font = '800 118px "Helvetica Neue", Arial, sans-serif';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.lineWidth = 10;
			ctx.strokeStyle = '#1d3f8f';
			ctx.strokeText( 'PHILADELPHIA PHILLIES', w / 2, h / 2 + 4, w - 420 );
			ctx.fillStyle = '#c8102e';
			ctx.fillText( 'PHILADELPHIA PHILLIES', w / 2, h / 2 + 4, w - 420 );
			for ( const x of [ 90, w - 90 ] ) mlbLogo( ctx, x - 62, h / 2 - 34, 124, 64 );

		}, 'dugoutRoof' );
		const band = canvasTexture( 2048, 128, ( ctx, w, h ) => {

			ctx.fillStyle = '#0c1b44';
			ctx.fillRect( 0, 0, w, h );
			// the light strip along the top, repeating the two small logos
			const sh = 20;
			ctx.fillStyle = '#dfe5ee';
			ctx.fillRect( 0, 0, w, sh );
			ctx.fillStyle = '#1d3f8f';
			ctx.fillRect( 0, sh, w, 3 );
			ctx.font = '700 14px "Helvetica Neue", Arial, sans-serif';
			ctx.textBaseline = 'middle';
			ctx.textAlign = 'center';
			// (FB2, C2B-14: spaced so each stands clear of the next, with a dot between: at 118 px the
			// 140 px name ran into the next one, "Citizens Bank Parkneweracap.com" across every close-up)
			for ( let x = 90, k = 0; x < w - 60; x += 180, k ++ ) {

				ctx.fillStyle = '#1d3f8f';
				ctx.fillText( k % 2 ? 'neweracap.com' : '\u2733 Citizens Bank Park', x, sh / 2 + 1, 150 );
				ctx.fillRect( x + 88, sh / 2 - 1, 3, 3 );

			}

			ctx.textAlign = 'left';
			ctx.textBaseline = 'middle';
			for ( const x0 of [ w * 0.06, w * 0.56 ] ) {

				daisy( ctx, x0 + 26, h * 0.6, 22, '#e9edf4' );
				ctx.fillStyle = '#e9edf4';
				ctx.font = '600 58px "Gill Sans", "Trebuchet MS", "Helvetica Neue", Arial, sans-serif';
				ctx.fillText( 'Citizens Bank Park', x0 + 60, h * 0.6 + 2 );
				// New Era's flag: a white box, the name in navy, the little flag in red
				const bx = x0 + 600;
				ctx.fillStyle = '#e9edf4';
				ctx.fillRect( bx, h * 0.33, 150, h * 0.56 );
				ctx.fillStyle = '#0c1b44';
				ctx.font = '800 34px "Helvetica Neue", Arial, sans-serif';
				ctx.fillText( 'NEW', bx + 12, h * 0.5 );
				ctx.fillText( 'ERA', bx + 12, h * 0.76 );
				ctx.fillStyle = '#c8102e';
				ctx.fillRect( bx + 100, h * 0.4, 36, 22 );

			}

		}, 'dugoutBand' );
		const top = standard( { name: 'dugout-roof-2008', roughness: 0.6, textures: { bpRoof: tex }, surface: 's.albedo = textureSample( bpRoof, smpAnisoClamp, in.uv ).rgb * 0.85; s.emissive = s.albedo * smoothstep( 0.2, 0.8, frame.night ) * 0.3;' } );
		const front = standard( { name: 'dugout-band', roughness: 0.6, textures: { bpBand: band }, surface: 's.albedo = textureSample( bpBand, smpAnisoClamp, in.uv ).rgb * 0.85; s.emissive = s.albedo * smoothstep( 0.2, 0.8, frame.night ) * 0.35;' } );
		for ( const m of [ top, front ] ) m.underwaterLighting = 'none';
		const R = DUGOUT_ROOF, BAND = 0.45;
		for ( const [ a, b ] of Object.values( DUGOUTS ) ) {

			const len = Math.hypot( b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ] );
			const ux = ( b[ 0 ] - a[ 0 ] ) / len, uz = ( b[ 1 ] - a[ 1 ] ) / len;
			let nx = - uz, nz = ux;
			if ( nx * - ( a[ 0 ] + b[ 0 ] ) / 2 + nz * ( - 40 - ( a[ 1 ] + b[ 1 ] ) / 2 ) > 0 ) {

				nx = - nx; nz = - nz;

			}

			// over the dugout roof (Field.js: from 0.45 m in front of the wall line to 0.25 m behind the pit)
			const s0 = DUGOUT_ZONES.home - 0.2, s1 = len - DUGOUT_ZONES.far + 0.2;
			const at = ( s, t, y ) => [ a[ 0 ] + ux * s + nx * t, y, a[ 1 ] + uz * s + nz * t ];
			// read from the field: the reading direction along the dugout as seen from home plate
			const flip = ( a[ 0 ] + b[ 0 ] ) < 0;
			const [ L, Rr ] = flip ? [ s1, s0 ] : [ s0, s1 ];
			const q = new Quads();
			q.add( at( L, - 0.45, R + 0.005 ), at( Rr, - 0.45, R + 0.005 ), at( Rr, 2.85, R + 0.005 ), at( L, 2.85, R + 0.005 ), [ 0, 1, 0 ] );
			const g = q.geometry();
			setUV( g, ( p ) => [ ( ( p[ 0 ] - a[ 0 ] ) * ux + ( p[ 2 ] - a[ 1 ] ) * uz - L ) / ( Rr - L ), ( ( p[ 0 ] - a[ 0 ] ) * nx + ( p[ 2 ] - a[ 1 ] ) * nz + 0.45 ) / 3.3 ] );
			// the visitors' (third base) roof read Citizens Bank Park, in the ballpark's green
			this.group.add( new Mesh( g, flip ? this._cbpRoof() : top ) );
			// the front band faces the field: read left to right from there (the viewer's right is ( -nz, nx ))
			const rightIsU = ( ux * - nz + uz * nx ) > 0;
			const [ FL, FR ] = rightIsU ? [ s0, s1 ] : [ s1, s0 ];
			const f = new Quads();
			f.add( at( FL, - 0.46, R - BAND ), at( FR, - 0.46, R - BAND ), at( FR, - 0.46, R ), at( FL, - 0.46, R ), [ - nx, 0, - nz ] );
			const fg = f.geometry();
			setUV( fg, ( p ) => [ ( ( p[ 0 ] - a[ 0 ] ) * ux + ( p[ 2 ] - a[ 1 ] ) * uz - FL ) / ( FR - FL ), 1 - ( p[ 1 ] - ( R - BAND ) ) / BAND ] );
			this.group.add( new Mesh( fg, front ) );

		}

	}

	_cbpRoof() {

		if ( this.cbpRoofMat ) return this.cbpRoofMat;
		const tex = canvasTexture( 2048, 160, ( ctx, w, h ) => {

			ctx.fillStyle = '#eeece6';
			ctx.fillRect( 0, 0, w, h );
			ctx.font = '600 118px "Gill Sans", "Trebuchet MS", "Helvetica Neue", sans-serif';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillStyle = '#1f5a3a';
			ctx.fillText( 'Citizens Bank Park', w / 2, h / 2 + 6, w - 200 );

		}, 'dugoutRoofCBP' );
		this.cbpRoofMat = standard( { name: 'dugout-roof-cbp', roughness: 0.6, textures: { bpRoof: tex }, surface: 's.albedo = textureSample( bpRoof, smpAnisoClamp, in.uv ).rgb * 0.85; s.emissive = s.albedo * smoothstep( 0.2, 0.8, frame.night ) * 0.3;' } );
		this.cbpRoofMat.underwaterLighting = 'none';
		return this.cbpRoofMat;

	}

	// the infield tarp, rolled along the wall down the first base line, wrapped for the Series
	// The infield tarp. Stowed: rolled along the wall past the first base dugout under its dark green
	// cover, strapped every 3 m. At the suspension on October 27 (the rain in the top of the 6th) the crew
	// pulled it over the whole infield: a pale sheet 44 m square on the diamond, sagging and folded,
	// water standing in the folds. setTarp( k ) unrolls it (0 stowed .. 1 covering the infield).
	_tarp() {

		const cover = standard( { name: 'tarp-roll', color: new Color( 0.035, 0.08, 0.05 ), roughness: 0.4, modules: [ commonModule ],
			surface: 's.albedo = mat.color * ( 0.85 + 0.2 * mx_noise_float3( in.P * 1.5 ) ) * ( 1.0 - 0.6 * step( 0.93, fract( dot( in.P.xz, vec2f( 0.7071 ) ) / 3.0 ) ) );' } );
		cover.underwaterLighting = 'none';
		// ---- W4 (rail): the roll lies on the third base side, past the visitors' photographers' well
		// toward the left field pole, under its canvas cover and the WORLD SERIES '08 ON FOX banner
		// (heston 2987303394; the audit's HP08). The rail (places/rail/Tarp.js) builds it into this
		// group; setTarp() still shows and hides it
		const roll = new Group();
		roll.name = 'tarp-roll';
		roll.userData.dynamic = true; // shown and hidden
		this.group.add( roll );
		this.tarpRoll = roll;
		void cover;
		// ---- end W4

		// the sheet: a grid over a 44 m square turned with the diamond, from behind the plate out past
		// second; it drapes the mound, sags between, with folds
		// ---- FR2: finer across (u: the three folds and the edge they lift want the rows)
		const S = 44, N = 64, NU = 96, c = [ 0, - 26 ];
		const r2 = Math.SQRT1_2;
		const pos = [], uv = [], index = [];
		for ( let j = 0; j <= N; j ++ ) for ( let i = 0; i <= NU; i ++ ) {

			const u = i / NU, v = j / N;
			const lx = ( u - 0.5 ) * S, lz = ( v - 0.5 ) * S;
			const x = c[ 0 ] + ( lx - lz ) * r2, z = c[ 1 ] + ( lx + lz ) * r2;
			const fold = 0.06 * Math.sin( lx * 0.9 + Math.sin( lz * 0.4 ) * 2 ) + 0.04 * Math.sin( lz * 1.3 );
			const edge = Math.min( u, 1 - u, v, 1 - v ) * S;
			const y = moundHeight( x, z ) + 0.05 + Math.max( 0, fold ) * Math.min( 1, edge / 2 );
			pos.push( x, y, z );
			uv.push( u, v );

		}

		for ( let j = 0; j < N; j ++ ) for ( let i = 0; i < NU; i ++ ) {

			const k = j * ( NU + 1 ) + i;
			index.push( k, k + NU + 1, k + 1, k + 1, k + NU + 1, k + NU + 2 );

		}

		const g = new BufferGeometry();
		g.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
		g.setAttribute( 'uv', new Float32BufferAttribute( uv, 2 ) );
		g.setIndex( index );
		g.computeVertexNormals();
		const nrm = g.getAttribute( 'normal' );
		if ( nrm.array[ 1 ] < 0 ) for ( let i = 0; i < nrm.array.length; i ++ ) nrm.array[ i ] = - nrm.array[ i ];
		g.computeBoundingSphere();
		// ---- W4 (rail): it comes off the roll on the third base side: u = 0 is the third base edge
		// CB-9 (gauntlet r1): under the lights the sheet was bright white vinyl, the brightest thing on the
		// field, a few long wrinkles and its seams, water only as a sheen in the low folds (Getty 84081873,
		// 83458710; Commons, the delay from the left field upper deck): not mid-grey with dark leopard spots
		// ---- FR2 (gauntlet r3): laid out as the 27th's photos have it (game/TarpPlan.js): folded in three
		// along its length, the roll lays it as a strip on the grass beyond the left field edge, the roll's
		// part still wound on it gathered inside the roll; then the crew pull the free edge (u = 1) in toward
		// home and first: the folds open from the top, the pulled part sliding in flat after them, billowing,
		// the last metres held up at their waists (its black underside showing); then the whole sheet is
		// dragged in square. Each vertex is placed by where its bit of vinyl is in that: x, its distance from
		// the left field edge along the sheet; the strip's three layers stacked a few centimetres apart.
		// The underside and the hem are black, the hem with white tabs (Getty 83458393, 83458149, 83458153)
		const W = S / 3;
		// ---- FB4 (C4B-5): the pulled part's height over the ground d metres behind the free edge (WGSL)
		const tarpProfile = ( d ) => `( Hh * ( 1.0 - smoothstep( 0.0, rise, ${ d } ) ) + amp * ( ( ${ d } / 1.8 ) * exp( 1.0 - ${ d } / 1.8 ) + 0.35 * sin( 3.14159 * clamp( ${ d } / Lb, 0.0, 1.0 ) ) ) + mat.billow * 0.16 * sin( ${ d } * 1.25 - E * 1.6 + flz * 0.09 ) * smoothstep( 1.5, 3.0, ${ d } ) * ( 1.0 - smoothstep( 0.6 * Lb, Lb, ${ d } ) ) )`;
		// ---- end FB4
		this.tarpMat = standard( { name: 'tarp', color: new Color( 0.86, 0.87, 0.85 ), roughness: 0.3, side: 'double', modules: [ commonModule ],
			uniforms: {
				pull: [ 'f32', 1 ], rollY: [ 'f32', 0.55 ], // ---- R: rollY (no longer read: FR2's rollR)
				anchor: [ 'f32', 0 ], lay: [ 'f32', - 1 ], edgeY: [ 'f32', 0.05 ], rollR: [ 'f32', 0.3 ], billow: [ 'f32', 0 ],
			},
			vertex: /* wgsl */`
	let S = ${ S.toFixed( 1 ) }; let W = ${ W.toFixed( 4 ) };
	let x = v.uv.x * S;
	// where the free edge and the left field edge are (m along u from the sheet's left field edge laid square)
	let e = mat.pull * S; let a = mat.anchor * S;
	let E = max( W, e - a );
	// the folds open from the top: the second layer (back the way it came) shortens from the outfield
	// side as the edge goes out, and the rest runs over the stack and out flat to the edge
	let q = clamp( ( E - W ) * 0.5, 0.0, W );
	var P = x; var h = 0.0; var flip = 1.0; var l2 = 0.0;
	if ( x >= W && x < 2.0 * W - q ) { P = 2.0 * W - x; h = 0.035; flip = - 1.0; l2 = 1.0; }
	else if ( x >= W ) { P = x - 2.0 * W + 2.0 * q; h = 0.07 * ( 1.0 - smoothstep( W - 0.4, W + 0.3, P ) ) * ( 1.0 - smoothstep( W * 0.9, W, q ) ); }
	let folded = 1.0 - smoothstep( 0.0, W * 0.5, q );
	// still on the roll: gathered at its axis, inside it
	let onRoll = step( v.uv.y, mat.lay );
	let vv = mix( v.uv.y, mat.lay, onRoll );
	let lx = a + P - 0.5 * S; let lz = ( vv - 0.5 ) * S;
	let px = ${ c[ 0 ].toFixed( 2 ) } + ( lx - lz ) * ${ r2.toFixed( 5 ) };
	let pz = ${ c[ 1 ].toFixed( 2 ) } + ( lx + lz ) * ${ r2.toFixed( 5 ) };
	// the mound under it (Field.js moundHeight)
	let mr = length( vec2f( px, pz + ${ ( 59 * 0.3048 ).toFixed( 4 ) } ) ) / ${ ( 9 * 0.3048 ).toFixed( 4 ) };
	let mt = clamp( ( mr - 0.3 ) / 0.7, 0.0, 1.0 );
	let mound = select( 0.0, ${ ( 10 / 12 * 0.3048 ).toFixed( 4 ) } * ( 1.0 - mt * mt * ( 3.0 - 2.0 * mt ) ), mr < 1.0 );
	// its folds and sags (as the laid geometry has them: where it lies, so the strip's layers keep
	// apart), lumpier folded up
	let flz = ( v.uv.y - 0.5 ) * S;
	let fold = 0.06 * sin( lx * 0.9 + sin( lz * 0.4 ) * 2.0 ) + 0.04 * sin( lz * 1.3 );
	let edge = min( min( v.uv.x, 1.0 - v.uv.x ), min( v.uv.y, 1.0 - v.uv.y ) ) * S;
	var y = mound + 0.05 + max( 0.0, fold ) * mix( min( 1.0, edge / 2.0 ), 0.5, folded ) + h;
	y = y + folded * 0.06 * max( 0.0, mx_noise_float2( vec2f( P * 0.7, flz * 0.35 ) ) );
	// ---- FB4 (C4B-5): the pulled part as Getty 83458151 has it from the first base side: the edge at the
	// crew's hips in their hands, sagging a little between them, and the sheet behind it ballooning on the
	// air under it, a metre up a few metres back, in long waves that run back from the edge as they walk,
	// down to the stack behind; under the lifted edge the black underside shows. (FR2's lift was the last
	// 2.6 m of vinyl sloping up to the edge, so from above it read as a thin black line on the grass with the
	// top of the sheet behind it, and its billow 0.16-0.3 m.) dE: metres behind the free edge
	let dE = max( 0.0, E - P );
	let runL = max( 0.5, E - W );
	let Hh = max( 0.0, mat.edgeY - 0.05 );
	let top = step( W, x ) * ( 1.0 - l2 ) * step( 0.5, 1.0 - onRoll );
	let sag = 0.09 * ( 0.5 - 0.5 * cos( flz * 2.856 ) ) * ( 1.0 - smoothstep( 0.0, 1.6, dE ) );
	let Lb = min( 11.0, runL );
	let wave = 1.0 + 0.3 * sin( dE * 0.85 - E * 1.1 + flz * 0.13 );
	let amp = mat.billow * ( 0.6 + 0.25 * mx_noise_float2( vec2f( flz * 0.13, E * 0.08 ) ) ) * wave;
	let rise = clamp( runL, 2.0, 8.0 );
	// (the hump: up steeply from their hands to its crest 1.8 m back, steeper than the high cameras look
	// down, so its black underside faces them under the edge; then down in a long tail; a longer, lower
	// billow over the whole run, and waves rolling back along it as they walk)
	let prof = ${ tarpProfile( 'dE' ) } - Hh * sag;
	// (its slope back from the edge, for the light: the same a quarter metre further back)
	let profB = ${ tarpProfile( '( dE + 0.25 )' ) };
	y = y + top * prof;
	let held = top * ( 1.0 - smoothstep( 0.0, 2.6, dE ) );
	// ---- end FB4
	y = mix( y, mat.rollR * 0.7, onRoll );
	let p = vec3f( px, y, pz );
	v.useWorld = true;
	v.worldPos = ( v.model * vec4f( p, 1.0 ) ).xyz;
	// (the second layer lies upside down: its normal down, so its underside faces up)
	// (---- FB4: the pulled part's normal from its slope back from the edge, along -u)
	let slope = top * ( profB - prof ) / 0.25;
	let n = normalize( vec3f( v.normal.x, v.normal.y, v.normal.z ) + vec3f( slope * ${ r2.toFixed( 5 ) }, 0.0, slope * ${ r2.toFixed( 5 ) } ) );
	v.worldNormal = normalize( ( v.model * vec4f( n * flip, 0.0 ) ).xyz );
	v.prevWorldPos = v.worldPos;
	// (to the surface: how folded up it is, in the colour's green; ---- FB4: in its blue, the billows'
	// lee sides, falling away behind each crest, a shade darker: white vinyl under six banks reads flat
	// without it)
	v.color = vec4f( 1.0, folded * ( 1.0 - onRoll ), clamp( 1.0 + 0.45 * min( slope, 0.0 ), 0.6, 1.0 ), 1.0 );
`,
			surface: /* wgsl */`
	// white vinyl, seams every 4 m; long wrinkles; water standing in the low folds (the sheet's own folds,
	// as the geometry has them) as a sheen, hardly darker
	let seam = step( 0.97, fract( in.uv.x * 11.0 ) );
	let lx = ( in.uv.x - 0.5 ) * ${ S.toFixed( 1 ) }; let lz = ( in.uv.y - 0.5 ) * ${ S.toFixed( 1 ) };
	let fold = 0.06 * sin( lx * 0.9 + sin( lz * 0.4 ) * 2.0 ) + 0.04 * sin( lz * 1.3 );
	let low = smoothstep( - 0.03, - 0.08, fold );
	let pud = low * smoothstep( 0.58, 0.75, mx_noise_float2( vec2f( lx * 0.6, lz * 0.12 ) ) * 0.5 + 0.5 );
	let wrinkle = mx_noise_float2( vec2f( lx * 0.35, lz * 2.4 ) );
	var alb = mat.color * ( 1.0 - 0.12 * seam ) * ( 1.0 - 0.06 * pud ) * ( 0.95 + 0.05 * wrinkle ) * ( 0.96 + 0.05 * mx_noise_float2( in.P.xz * 2.0 ) );
	// ---- FR2: folded up in its strip it's a wet, crumpled silver-grey (Getty 83477151, 83458679; the
	// world feed's 2:54:00 frames 1-3), the white showing as the folds open and it's pulled out flat
	let fz = in.color.g;
	alb = alb * in.color.b; // ---- FB4 (C4B-5): the billows' lee sides
	let crumple = mx_noise_float2( in.P.xz * vec2f( 1.7, 2.3 ) ) * 0.5 + 0.5;
	alb = alb * mix( 1.0, 0.62 + 0.22 * crumple, fz );
	// ---- FR2: the underside black; the hem black all round, with its white tabs every 2 m (83458393)
	let ed = min( min( in.uv.x, 1.0 - in.uv.x ), min( in.uv.y, 1.0 - in.uv.y ) ) * ${ S.toFixed( 1 ) };
	let along = select( in.uv.x, in.uv.y, min( in.uv.x, 1.0 - in.uv.x ) < min( in.uv.y, 1.0 - in.uv.y ) ) * ${ S.toFixed( 1 ) };
	let hem = 1.0 - smoothstep( 0.1, 0.13, ed );
	let tab = hem * step( fract( along / 2.0 ), 0.05 ) * step( 0.02, ed );
	let under = select( 1.0, 0.0, in.front );
	alb = mix( alb, vec3f( 0.028, 0.03, 0.032 ), max( under, hem ) );
	alb = mix( alb, vec3f( 0.8 ), tab );
	s.albedo = alb;
	s.normal = normalize( s.normal + vec3f( 0.06 * wrinkle + 0.25 * fz * ( crumple - 0.5 ), 0.0, 0.18 * fz * mx_noise_float2( in.P.xz * 3.1 + 7.0 ) ) );
	// (the water glossy enough to catch the banks' glow, not a mirror of the black sky)
	s.roughness = mix( mix( 0.32, 0.12, pud ), 0.4, max( under, hem ) );
	// under the lights the brightest thing on the field: every bank lights it
	s.emissive = s.albedo * smoothstep( 0.2, 0.8, frame.night ) * 0.25 * ( 1.0 - max( under, hem ) );
` } );
		this.tarpMat.underwaterLighting = 'none';
		this.tarpMat.setDefine( 'DRY', 1 );
		const sheet = new Mesh( g, this.tarpMat );
		sheet.name = 'tarp';
		sheet.receiveShadow = true;
		sheet.castShadow = true;
		sheet.visible = false;
		sheet.frustumCulled = false;
		this.group.add( sheet );
		this.tarpSheet = sheet;

	}

	// k: how much of it is on (0 stowed .. 1 covering the infield); st: the rituals' plan's state
	// (game/TarpPlan.js tarpState), which places it fold by fold
	setTarp( k, st = null ) {

		if ( ! this.tarpSheet ) return;
		const U = this.tarpMat.uniforms;
		// ---- FR2: the strip, the pull and the drag from the plan (without one: on, or off)
		if ( st ) {

			U.pull.value = st.pull;
			U.anchor.value = st.anchor;
			U.lay.value = st.phase === 'lift' || st.phase === 'stowed' ? 2 : st.vRoll;
			U.edgeY.value = st.edgeY;
			U.rollR.value = st.r;
			U.billow.value = st.billow || 0;
			this.tarpSheet.visible = ! st.stowed && st.phase !== 'lift';

		} else {

			U.pull.value = 1; U.anchor.value = 0; U.lay.value = - 1; U.edgeY.value = 0.05; U.billow.value = 0;
			this.tarpSheet.visible = k > 0.001;

		}

		// ---- end FR2
		this.tarpRoll.visible = k < 0.98;

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
			const m = standard( { name: 'wall-ad', roughness: 0.7, textures: { bpAd: tex }, surface: 's.albedo = textureSample( bpAd, smpAnisoClamp, in.uv ).rgb * 0.8; s.emissive = s.albedo * smoothstep( 0.2, 0.8, frame.night ) * 0.35;' } );
			m.underwaterLighting = 'none';
			return m;

		};

		// 7.3 m panels printed on the pads with pad showing between them (hesb/2986448333.jpg): W.B. Mason,
		// the World Series on FOX, Bud Light's DRINKABILITY, the Winter Classic, the 374 marker, Southwest
		const ads = [
			[ 0.07, 0.203, panel( ( ctx, w, h ) => {

				ctx.fillStyle = '#f4de3a'; ctx.fillRect( 0, 0, w, h );
				ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
				ctx.fillStyle = '#d8262e'; ctx.font = '800 44px "Helvetica Neue", Arial, sans-serif'; ctx.fillText( 'WHO BUT', w * 0.07, h * 0.2 );
				ctx.textAlign = 'center';
				ctx.lineJoin = 'round'; ctx.lineWidth = 10; ctx.strokeStyle = '#ffffff';
				ctx.font = '900 150px "Arial Black", "Helvetica Neue", Arial, sans-serif';
				ctx.strokeText( 'W.B.MASON', w / 2, h * 0.52, w - 60 );
				ctx.fillStyle = '#d8262e'; ctx.fillText( 'W.B.MASON', w / 2, h * 0.52, w - 60 );
				ctx.fillStyle = '#111111'; ctx.textAlign = 'right'; ctx.font = 'italic 600 52px Georgia, serif'; ctx.fillText( 'Office Products', w * 0.93, h * 0.84 );

			}, 'adMason' ) ],
			[ 0.265, 0.398, panel( ( ctx, w, h ) => {

				ctx.fillStyle = '#1b2a5c'; ctx.fillRect( 0, 0, w, h );
				ctx.save(); ctx.translate( w * 0.06, h * 0.08 ); drawWorldSeriesLogo( ctx, w * 0.55, h * 0.84 ); ctx.restore();
				ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
				ctx.font = 'italic 600 54px "Helvetica Neue", Arial, sans-serif'; ctx.fillText( 'on', w * 0.72, h * 0.5 );
				ctx.font = 'italic 900 150px "Helvetica Neue", Arial, sans-serif'; ctx.fillText( 'FOX', w * 0.86, h * 0.52 );

			}, 'adWS' ) ],
			[ 0.46, 0.593, panel( ( ctx, w, h ) => {

				const g = ctx.createLinearGradient( 0, 0, 0, h );
				g.addColorStop( 0, '#6fa8dc' ); g.addColorStop( 1, '#1f5faf' );
				ctx.fillStyle = g; ctx.fillRect( 0, 0, w, h );
				ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
				ctx.lineJoin = 'round'; ctx.lineWidth = 12; ctx.strokeStyle = '#0b2f6b';
				ctx.font = '900 128px "Arial Black", "Helvetica Neue", Arial, sans-serif';
				ctx.strokeText( 'DRINKAB LITY', w * 0.5, h * 0.48, w - 60 );
				ctx.fillStyle = '#ffffff'; ctx.fillText( 'DRINKAB LITY', w * 0.5, h * 0.48, w - 60 );
				// a Bud Light can stands in for the I
				const cx = w * 0.655, cw = 46;
				ctx.fillStyle = '#e8eef5'; ctx.fillRect( cx - cw / 2, h * 0.24, cw, h * 0.5 );
				ctx.fillStyle = '#1f5faf'; ctx.fillRect( cx - cw / 2, h * 0.42, cw, h * 0.12 );
				ctx.fillStyle = '#ffffff'; ctx.font = 'italic 800 46px Georgia, serif'; ctx.fillText( 'Bud Light', w * 0.5, h * 0.86 );

			}, 'adBud' ) ],
			[ 0.655, 0.788, panel( ( ctx, w, h ) => {

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
			[ 0.866, 0.99, panel( ( ctx, w, h ) => {

				// the white box framed by the livery's stripes: red left and bottom, gold top, blue right
				ctx.fillStyle = '#ffffff'; ctx.fillRect( 0, 0, w, h );
				ctx.fillStyle = '#f9b612'; ctx.fillRect( 0, 0, w, h * 0.09 );
				ctx.fillStyle = '#d5152e'; ctx.fillRect( 0, 0, w * 0.05, h ); ctx.fillRect( 0, h * 0.91, w, h * 0.09 );
				ctx.fillStyle = '#304cb2'; ctx.fillRect( w * 0.95, 0, w * 0.05, h );
				ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#111b4a';
				ctx.font = '900 132px "Arial Narrow", "Helvetica Neue", Arial, sans-serif'; ctx.fillText( 'SOUTHWEST', w / 2, h * 0.38, w - 110 );
				ctx.font = '900 96px "Arial Narrow", "Helvetica Neue", Arial, sans-serif'; ctx.fillText( 'AIRLINES', w / 2, h * 0.7, w - 200 );

			}, 'adSouthwest' ) ],
		];
		for ( const [ t0, t1, mat ] of ads ) this._fencePanel( along( t0 ), along( t1 ), 0.12, 3.0, mat );

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
	// the pole: game cells (dark during the Series), two lit panels (this game's pitcher on one), and ads.
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
		refreshCanvasTexture( this.ootTexture, this.ootCanvas );

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

	// Over the left field wall: a planted trough right behind the cap (October's mums, pansies and a few
	// clumps of ornamental grass), then on the seat side a galvanized guard rail, square posts every 2 m,
	// a top pipe and a mid rail, see-through mesh in the panels
	_planters() {

		const steel = standard( { name: 'lf-guard-rail', color: new Color( 0.52, 0.54, 0.55 ), roughness: 0.45, metalness: 0.8 } );
		const mesh = standard( { name: 'lf-chain-link', color: new Color( 0.5, 0.52, 0.53 ), roughness: 0.5, metalness: 0.7, side: 'double', alphaTest: 0.5,
			surface: /* wgsl */`
	// 5 cm diamonds, fading to a faint veil when finer than a pixel
	let p = vec2f( in.uv.x + in.uv.y, in.uv.x - in.uv.y ) / 0.05;
	let g = abs( fract( p ) - 0.5 );
	let fw = fwidth( p.x );
	let wire = step( 0.42 - fw, max( g.x, g.y ) );
	s.alpha = max( wire * step( fw, 0.9 ), clamp( fw * 0.35, 0.0, 0.15 ) );
` } );
		const soil = standard( { name: 'lf-trough-soil', color: new Color( 0.07, 0.045, 0.03 ), roughness: 0.95 } );
		const curb = standard( { name: 'lf-trough-curb', color: new Color( 0.3, 0.29, 0.27 ), roughness: 0.8 } );
		for ( const m of [ steel, mesh, soil, curb ] ) m.underwaterLighting = 'none';
		const flowers = [];
		const at = ( i ) => fencePoint( OUTFIELD[ i ][ 0 ], OUTFIELD[ i ][ 1 ] );
		const pts = [ at( 0 ), at( 1 ), at( 3 ) ];
		const q = new Quads(), c = new Quads(), tq = new Quads(), cq = new Quads();
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

			// the trough: soil a hand below the cap from 0.3 to 1.6 m back, a curb on its seat side
			const T = ( t, oo, y ) => [ a[ 0 ] + ux * t + nx * oo, y, a[ 1 ] + uz * t + nz * oo ];
			tq.add( T( 0, 0.3, y0 - 0.2 ), T( len, 0.3, y0 - 0.2 ), T( len, 1.6, y0 - 0.2 ), T( 0, 1.6, y0 - 0.2 ), [ 0, 1, 0 ] );
			cq.add( T( 0, 1.6, y0 - 0.6 ), T( len, 1.6, y0 - 0.6 ), T( len, 1.6, y0 ), T( 0, 1.6, y0 ), [ nx, 0, nz ] );
			cq.add( T( 0, 1.6, y0 ), T( len, 1.6, y0 ), T( len, 1.72, y0 ), T( 0, 1.72, y0 ), [ 0, 1, 0 ] );
			for ( let t = 0.15; t < len; t += 0.36 ) for ( let r = 0; r < 3; r ++ ) flowers.push( T( t + ( ( r * 7 + t * 13 ) % 1 ) * 0.2, 0.5 + r * 0.38, y0 - 0.2 ) );
			// the rail on the seat side of it
			const o = 1.75;
			const P = ( t, y ) => [ a[ 0 ] + ux * t + nx * o, y, a[ 1 ] + uz * t + nz * o ];
			beam( q, P( 0, y0 + H ), P( len, y0 + H ), 0.05 );
			beam( q, P( 0, y0 + H * 0.5 ), P( len, y0 + H * 0.5 ), 0.035 );
			const n = Math.max( 1, Math.round( len / 2 ) );
			for ( let k = 0; k <= n; k ++ ) beam( q, P( len * k / n, y0 ), P( len * k / n, y0 + H ), 0.06 );
			c.tri( P( 0, y0 ), P( len, y0 ), P( len, y0 + H ), [ - nx, 0, - nz ], [ u, 0 ], [ u + len, 0 ], [ u + len, H ] );
			c.tri( P( 0, y0 ), P( len, y0 + H ), P( 0, y0 + H ), [ - nx, 0, - nz ], [ u, 0 ], [ u + len, H ], [ u, H ] );
			u += len;

		}

		// the flowers: low mounds in purple, white, burgundy and gold, a few grass clumps taller
		const bloom = standard( { name: 'lf-flowers', roughness: 0.8, modules: [ commonModule ],
			surface: /* wgsl */`
	let h = fract( sin( dot( floor( in.P.xz * 2.7 ), vec2f( 12.9898, 78.233 ) ) ) * 43758.5453 );
	var c = vec3f( 0.1, 0.03, 0.16 );
	if ( h > 0.3 ) { c = vec3f( 0.8, 0.78, 0.82 ); }
	if ( h > 0.5 ) { c = vec3f( 0.28, 0.02, 0.06 ); }
	if ( h > 0.7 ) { c = vec3f( 0.78, 0.5, 0.03 ); }
	if ( h > 0.88 ) { c = vec3f( 0.12, 0.2, 0.06 ); }
	let petal = 0.8 + 0.3 * mx_noise_float3( in.P * 40.0 );
	s.albedo = mix( vec3f( 0.03, 0.08, 0.02 ), c * petal, smoothstep( 0.02, 0.08, in.P.y - ${ ( 10.5 * FT - 0.2 ).toFixed( 3 ) } ) );
` } );
		bloom.underwaterLighting = 'none';
		const fm = new InstancedMesh( new SphereGeometry( 0.2, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2 ), bloom, flowers.length );
		const mtx = new Matrix4();
		flowers.forEach( ( [ x, y, z ], i ) => fm.setMatrixAt( i, mtx.compose( new Vector3( x, y, z ), new Quaternion(), new Vector3( 1, 0.7 + 0.5 * ( ( i * 0.618 ) % 1 ), 1 ) ) ) );
		fm.name = 'lf-flowers';
		fm.receiveShadow = true;
		this.group.add( fm );
		for ( const [ g, m, name ] of [ [ q, steel, 'lf-guard-rail' ], [ c, mesh, 'lf-chain-link' ], [ tq, soil, 'lf-trough' ], [ cq, curb, 'lf-trough-curb' ] ] ) {

			const mm = new Mesh( g.geometry(), m );
			mm.name = name;
			mm.castShadow = true;
			this.group.add( mm );

		}

		void LEVELS;

	}

}

// ---- W3 (Alley): the Wall of Fame is built with the rest of Ashburn Alley now (places/AshburnAlley2008.js:
// its plaques, on the Alley's brick over the pens); nothing here
Details2008.prototype._wallOfFame = function () {};

// ---------------------------------------------------------------- drawing

function setUV( g, f ) {

	const uv = g.getAttribute( 'uv' ).array, pos = g.getAttribute( 'position' ).array;
	for ( let i = 0; i < uv.length / 2; i ++ ) {

		const [ u, v ] = f( [ pos[ i * 3 ], pos[ i * 3 + 1 ], pos[ i * 3 + 2 ] ] );
		uv[ i * 2 ] = u;
		uv[ i * 2 + 1 ] = v;

	}

}

// MLB's batter logo: a white silhouette between a blue and a red field, in a white keyline
// ---- W4 (rail): exported (the rail draws it on its wall panels)
export function mlbLogo( ctx, x, y, w, h ) {

	ctx.save();
	ctx.fillStyle = '#f4f2ec';
	ctx.beginPath(); ctx.roundRect( x, y, w, h, h * 0.12 ); ctx.fill();
	ctx.fillStyle = '#1d3f8f';
	ctx.beginPath(); ctx.roundRect( x + 3, y + 3, w * 0.5 - 3, h - 6, h * 0.1 ); ctx.fill();
	ctx.fillStyle = '#c8102e';
	ctx.beginPath(); ctx.roundRect( x + w * 0.5, y + 3, w * 0.5 - 3, h - 6, h * 0.1 ); ctx.fill();
	ctx.fillStyle = '#f4f2ec';
	ctx.beginPath(); ctx.ellipse( x + w * 0.56, y + h * 0.3, w * 0.07, h * 0.12, 0, 0, Math.PI * 2 ); ctx.fill();
	ctx.beginPath();
	ctx.moveTo( x + w * 0.3, y + h - 3 ); ctx.quadraticCurveTo( x + w * 0.42, y + h * 0.45, x + w * 0.62, y + h * 0.46 ); ctx.lineTo( x + w * 0.74, y + h - 3 );
	ctx.fill();
	ctx.lineWidth = Math.max( 2, h * 0.04 ); ctx.strokeStyle = '#f4f2ec';
	ctx.beginPath(); ctx.moveTo( x + w * 0.62, y + h * 0.46 ); ctx.lineTo( x + w * 0.18, y + h * 0.18 ); ctx.stroke();
	ctx.beginPath(); ctx.arc( x + w * 0.22, y + h * 0.72, h * 0.06, 0, Math.PI * 2 ); ctx.fill();
	ctx.restore();

}

// Citizens Bank's 2006 daisy-wheel emblem: petals round a ring
function daisy( ctx, cx, cy, r, color ) {

	ctx.save();
	ctx.fillStyle = color;
	for ( let i = 0; i < 12; i ++ ) {

		const a = i / 12 * Math.PI * 2;
		ctx.beginPath();
		ctx.ellipse( cx + Math.cos( a ) * r * 0.62, cy + Math.sin( a ) * r * 0.62, r * 0.36, r * 0.13, a, 0, Math.PI * 2 );
		ctx.fill();

	}

	ctx.restore();

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
// ---- W4 (rail): exported (the rail draws it on its on-deck mats and wall panels)
export function drawWorldSeriesLogo( ctx, w, h, { clear = true } = {} ) {

	ctx.save();
	if ( clear ) ctx.clearRect( 0, 0, w, h );
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
	const m = standard( { name: 'wall-ad', roughness: 0.7, textures: { bpAd: tex }, surface: 's.albedo = textureSample( bpAd, smpAnisoClamp, in.uv ).rgb * 0.75; s.emissive = s.albedo * smoothstep( 0.2, 0.8, frame.night ) * 0.35;' } );
	m.underwaterLighting = 'none';
	return m;

}

// The out-of-town board as it stood through the Series (CB-8, gauntlet r1: Flickr 74085116N00 2981641556
// on the 27th, the board legible from the left field upper deck; the 27th at dusk from the Alley; Getty
// 84082684 on the 29th). With no other games its two rows of game cells were dark, each a black panel with
// a thin white diamond outlined on it (painted, not lit); only two panels were lit, with Majestic's logo
// between them: the one in the middle carried this game's pitcher and his count, small, the one by the
// pole stood blank white. Turkey Hill's cream sign at the 398 end, Modell's by the pole.
function drawOutOfTown( ctx, w, h, st ) {

	ctx.fillStyle = '#0a0b0d';
	ctx.fillRect( 0, 0, w, h );
	ctx.fillStyle = '#0f3d2a';
	ctx.fillRect( 0, 0, w, 8 );
	ctx.fillRect( 0, h - 8, w, 8 );
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
	// the dark cells, two rows: black, a grey seam between them, the diamond outline (grey enough that it
	// isn't taken for a lamp: the material lights only what's bright)
	const cells = ( x0, x1, n ) => {

		const cw = ( x1 - x0 ) / n, ch = ( h - 32 ) / 2;
		for ( let i = 0; i < n; i ++ ) for ( let r = 0; r < 2; r ++ ) {

			const x = x0 + i * cw, y = 16 + r * ch;
			ctx.fillStyle = '#2a2c2e';
			ctx.fillRect( x, y, cw, ch );
			ctx.fillStyle = '#060708';
			ctx.fillRect( x + 3, y + 3, cw - 6, ch - 6 );
			const cx = x + cw / 2, cy = y + ch / 2, d = ch * 0.3;
			ctx.strokeStyle = '#7c7c7a';
			ctx.lineWidth = 3;
			ctx.beginPath(); ctx.moveTo( cx, cy - d ); ctx.lineTo( cx + d * 1.15, cy ); ctx.lineTo( cx, cy + d ); ctx.lineTo( cx - d * 1.15, cy ); ctx.closePath(); ctx.stroke();

		}

	};
	cells( 172, 940, 6 );
	cells( 1414, 2050, 5 );
	// the lit panel in the middle: white, this game's pitcher and count small in the corner of it
	ctx.fillStyle = '#f2f3f4';
	ctx.fillRect( 950, 16, 300, h - 32 );
	const pit = st?.pitcher;
	ctx.fillStyle = '#16264f';
	ctx.textAlign = 'center';
	ctx.font = '800 26px "Helvetica Neue", Arial, sans-serif';
	ctx.fillText( pit ? `${ pit.num } ${ pit.last }` : 'WORLD SERIES', 1100, 76, 270 );
	if ( pit ) {

		ctx.font = '700 24px "Helvetica Neue", Arial, sans-serif';
		ctx.fillText( `B ${ pit.balls }   S ${ pit.strikes }   P ${ pit.balls + pit.strikes }`, 1100, 128, 270 );

	}

	// Majestic
	ctx.fillStyle = '#e8e4dc';
	ctx.fillRect( 1262, 16, 140, h - 32 );
	ctx.fillStyle = '#b3121d';
	ctx.font = 'italic 800 34px "Helvetica Neue", Arial, sans-serif';
	ctx.fillText( 'Majestic', 1332, h / 2 + 12, 128 );
	// the blank lit panel by the pole, and Modell's
	ctx.fillStyle = '#eef0f2';
	ctx.fillRect( 2060, 16, 200, h - 32 );
	ctx.fillStyle = '#d8d4ca';
	ctx.fillRect( 2270, 16, 122, h - 32 );
	ctx.fillStyle = '#c4161c';
	ctx.font = '900 26px "Helvetica Neue", Arial, sans-serif';
	ctx.fillText( "MODELL'S", 2331, 92, 114 );
	ctx.font = 'italic 700 16px "Helvetica Neue", Arial, sans-serif';
	ctx.fillStyle = '#1a1a1a';
	ctx.fillText( "Gotta Go To Mo's", 2331, 128, 114 );
	ctx.textAlign = 'left';

}
