import { Group, Mesh, BoxGeometry, CylinderGeometry, ConeGeometry, SphereGeometry, TubeGeometry, CatmullRomCurve3, Vector3, Color } from '../engine/index.js';
import { commonModule } from '../engine/render/wgsl/common.js';
import { standard } from '../materials/Materials.js';
import { Quads } from './Stands.js';
import { canvasTexture } from './geo.js';
import { generateMipmaps } from '../engine/gpu/Mipmaps.js';
import { FT, LEVELS, fencePoint } from './layout.js';
import { offsetPolyline } from './Bowl.js';

// The ballpark's landmarks round the outfield: the main scoreboard in left field (152 x 86 ft since 2023,
// its steel topping out 143 ft above the field), the Liberty Bell sign in right-center (35 x 50 ft, 100 ft
// above the street), Ashburn Alley's brick buildings behind center field with the retired numbers, and
// the ivy-covered batter's eye. Field frame, in the Field's group.

const STREET = LEVELS.mainConcourse;

export class Landmarks {

	constructor( { field, bowl, colliders } ) {

		this.field = field;
		this.bowl = bowl;
		this.colliders = colliders;
		this.group = new Group();
		this.group.name = 'landmarks';
		field.group.add( this.group );
		this.steel = standard( { name: 'landmark-steel', color: new Color( 0.05, 0.06, 0.065 ), roughness: 0.6, metalness: 0.5 } );
		this.steel.underwaterLighting = 'none';
		this._scoreboard();
		// the light tower over the Pavilion in right (the one in left stands beside the scoreboard)
		for ( const [ a, d ] of [ [ 36, 440 ] ] ) {

			const [ x, z ] = fencePoint( a, d );
			bowl._lightTower( x, z, STREET, LEVELS.lightTowers );

		}

		this._libertyBell();
		this._ashburnAlley();
		this._battersEye();

	}

	// a group at a field-frame point, turned to face home plate
	_facingHome( x, z, y = 0 ) {

		const g = new Group();
		g.position.set( x, y, z );
		g.rotation.y = Math.atan2( - x, - z ) + Math.PI; // local -z toward home
		this.group.add( g );
		return g;

	}

	// ---------------------------------------------------------------- the scoreboard

	// The 2004-2011 scoreboard, as it was for the 2008 World Series: a blue cabinet (about 97 x 79 ft) with
	// the Coca-Cola and Motrin panels down its left, the amber matrix (the at-bat, due up, the lineup, the
	// line score and the count) over the 69'7" x 39'5" video board, the "Phillies" script with its two
	// stars on the steel above, green neon "Citizens Bank Park" and Harry the K's beneath, and the light
	// tower beside it with its sponsors' panels.
	_scoreboard() {

		const W = 97 * FT, H = 79 * FT;
		const [ x, z ] = fencePoint( - 36, 452 );
		const g = this._facingHome( x, z );
		const y0 = STREET + 10.5;
		this.board = { W, H, y0 };
		this.boardCanvas = new OffscreenCanvas( 1600, 1304 );
		this.scoreboardTexture = canvasTexture( 1600, 1304, ( ctx, w, h ) => drawBoard2008( ctx, w, h, null ), 'scoreboard' );
		const screen = standard( {
			name: 'scoreboard', roughness: 0.4, textures: { bpBoard: this.scoreboardTexture },
			surface: /* wgsl */`
	let t = textureSample( bpBoard, smpAnisoClamp, in.uv ).rgb;
	// LEDs and lit panels: their own light, a little brighter after dark
	s.albedo = t * 0.06;
	s.emissive = t * mix( 1.6, 0.55, frame.night );
`,
		} );
		screen.underwaterLighting = 'none';
		const face = new Mesh( quadUV( W, H, y0, - 0.72 ), screen );
		face.name = 'scoreboard-face';
		g.add( face );
		const cabinet = standard( { name: 'scoreboard-cabinet', color: new Color( 0.03, 0.06, 0.16 ), roughness: 0.6, metalness: 0.3 } );
		cabinet.underwaterLighting = 'none';
		const box = new Mesh( new BoxGeometry( W + 1.2, H + 1.2, 1.2 ), cabinet );
		box.position.set( 0, y0 + H / 2, 0 );
		box.castShadow = true;
		g.add( box );
		// the steel it stands on and the frame the script sits on
		for ( const lx of [ - W * 0.38, - W * 0.1, W * 0.18, W * 0.42 ] ) {

			const leg = new Mesh( new BoxGeometry( 0.9, y0 - STREET + 0.5, 0.9 ), this.steel );
			leg.position.set( lx, STREET + ( y0 - STREET ) / 2, 1.2 );
			leg.castShadow = true;
			g.add( leg );

		}

		for ( const lx of [ - W * 0.32, 0, W * 0.3 ] ) {

			const post = new Mesh( new BoxGeometry( 0.5, 7.5, 0.5 ), this.steel );
			post.position.set( lx, y0 + H + 3.4, 0.4 );
			g.add( post );

		}

		const beam = new Mesh( new BoxGeometry( W * 0.75, 0.5, 0.5 ), this.steel );
		beam.position.set( 0, y0 + H + 1.1, 0.4 );
		g.add( beam );

		// the script and its two stars
		const sign = canvasTexture( 1024, 320, ( ctx, w, h ) => {

			ctx.clearRect( 0, 0, w, h );
			ctx.font = 'italic 700 220px Georgia, "Times New Roman", serif';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.lineWidth = 14;
			ctx.strokeStyle = '#c9a44a';
			ctx.strokeText( 'Phillies', w / 2, h / 2 + 18 );
			ctx.fillStyle = '#c8102e';
			ctx.fillText( 'Phillies', w / 2, h / 2 + 18 );
			// the underline swash
			ctx.fillRect( w * 0.14, h * 0.86, w * 0.72, h * 0.05 );
			for ( const sx of [ 0.46, 0.63 ] ) star( ctx, w * sx, h * 0.2, 26, '#1d3f8f' );

		}, 'scriptSign' );
		const signMat = standard( {
			name: 'script-sign', roughness: 0.5, alphaTest: 0.5, side: 'double', textures: { bpScript: sign },
			surface: 'let t = textureSample( bpScript, smpAnisoClamp, in.uv ); s.alpha = t.a; s.albedo = t.rgb * 0.6; s.emissive = t.rgb * mix( 0.2, 0.6, frame.night );',
		} );
		signMat.underwaterLighting = 'none';
		const SW = W * 0.78, SH = SW * 320 / 1024;
		g.add( new Mesh( quadUV( SW, SH, y0 + H + 0.9, - 0.2 ), signMat ) );

		// beneath: green neon "Citizens Bank Park", and the awnings of Harry the K's
		const neon = canvasTexture( 1024, 128, ( ctx, w, h ) => {

			ctx.clearRect( 0, 0, w, h );
			ctx.font = '600 92px "Helvetica Neue", Helvetica, Arial, sans-serif';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.shadowColor = '#3cff7a';
			ctx.shadowBlur = 14;
			ctx.fillStyle = '#39d86b';
			ctx.fillText( '✳ Citizens Bank Park', w / 2, h / 2 + 4 );

		}, 'neonName' );
		const neonMat = standard( {
			name: 'neon', roughness: 0.4, alphaTest: 0.3, side: 'double', textures: { bpNeon: neon },
			surface: 'let t = textureSample( bpNeon, smpAnisoClamp, in.uv ); s.alpha = t.a; s.albedo = t.rgb * 0.2; s.emissive = t.rgb * mix( 1.2, 3.0, frame.night );',
		} );
		neonMat.underwaterLighting = 'none';
		g.add( new Mesh( quadUV( W * 0.62, W * 0.62 / 8, y0 - 3.6, - 1.4 ), neonMat ) );
		const awning = standard( { name: 'awning', color: new Color( 0.02, 0.03, 0.09 ), roughness: 0.8 } );
		awning.underwaterLighting = 'none';
		const aw = new Mesh( new BoxGeometry( W * 0.9, 1.1, 1.8 ), awning );
		aw.position.set( 0, STREET + 3.4, - 2.2 );
		aw.rotation.x = 0.35;
		g.add( aw );

		// the light tower beside it (center field side), with its four panels
		const [ tx, tz ] = fencePoint( - 24.5, 455 );
		this.bowl._lightTower( tx, tz, STREET, LEVELS.lightTowers );
		const tg = this._facingHome( tx, tz );
		const ads = [ [ 'TOYOTA', '#e00d1d', '#ffffff' ], [ 'Choose Blue.', '#1b5eb8', '#eef3fb' ], [ 'W.B. MASON', '#d71920', '#16181d' ], [ 'Budweiser', '#d4202f', '#101114' ] ];
		ads.forEach( ( [ text, fg, bg ], i ) => {

			const tex = canvasTexture( 512, 192, ( ctx, w, h ) => {

				ctx.fillStyle = bg;
				ctx.fillRect( 0, 0, w, h );
				ctx.font = ( i === 3 ? 'italic 700 110px Georgia, serif' : '800 104px "Helvetica Neue", Helvetica, Arial, sans-serif' );
				ctx.fillStyle = fg;
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.fillText( text, w / 2, h / 2 + 6, w - 30 );

			}, 'towerAd' );
			const m = standard( { name: 'tower-ad', roughness: 0.5, textures: { bpAd: tex }, surface: 'let t = textureSample( bpAd, smpAnisoClamp, in.uv ).rgb; s.albedo = t * 0.7; s.emissive = t * mix( 0.2, 0.9, frame.night );' } );
			m.underwaterLighting = 'none';
			tg.add( new Mesh( quadUV( 8.5, 3.2, STREET + 30 - i * 4.4, - 2.4 ), m ) );

		} );

		this.scoreboard = g;

	}

	// redraw the board with the game's state (Director.boardState())
	updateScoreboard( state ) {

		const c = this.boardCanvas, ctx = c.getContext( '2d' );
		drawBoard2008( ctx, c.width, c.height, state );
		const img = ctx.getImageData( 0, 0, c.width, c.height );
		this.scoreboardTexture.upload( new Uint8Array( img.data.buffer ) );
		generateMipmaps( this.scoreboardTexture );

	}

	// ---------------------------------------------------------------- the Liberty Bell

	_libertyBell() {

		const [ x, z ] = fencePoint( 21, 488 );
		const g = this._facingHome( x, z );
		const H = 50 * FT, W = 35 * FT, y0 = STREET + 100 * FT;
		// the mast
		const mast = new Mesh( new CylinderGeometry( 0.6, 0.8, y0 - STREET + 2, 12 ), this.steel );
		mast.position.set( 0, STREET + ( y0 - STREET ) / 2, 1.5 );
		mast.castShadow = true;
		g.add( mast );
		// the bell's outline in lights: half the profile, mirrored, with the yoke, the crack and the clapper
		const half = [ [ 0.0, 1.0 ], [ 0.13, 0.99 ], [ 0.2, 0.95 ], [ 0.22, 0.86 ], [ 0.25, 0.7 ], [ 0.29, 0.52 ], [ 0.35, 0.35 ], [ 0.43, 0.2 ], [ 0.5, 0.1 ], [ 0.5, 0.06 ] ];
		const pts = [];
		for ( const [ u, v ] of half.slice().reverse() ) pts.push( new Vector3( - u * W, y0 + v * H * 0.86, 0 ) );
		for ( const [ u, v ] of half.slice( 1 ) ) pts.push( new Vector3( u * W, y0 + v * H * 0.86, 0 ) );
		pts.push( new Vector3( 0, y0 + 0.06 * H * 0.86, 0 ) );
		const lights = standard( { name: 'bell-lights', color: new Color( 0.9, 0.85, 0.7 ), roughness: 0.4, emissive: new Color( 1.0, 0.82, 0.45 ) } );
		lights.underwaterLighting = 'none';
		const outline = new Mesh( new TubeGeometry( new CatmullRomCurve3( pts, true ), 160, 0.28, 8, true ), lights );
		g.add( outline );
		const crack = new CatmullRomCurve3( [ [ 0.05, 0.08 ], [ 0.02, 0.2 ], [ 0.07, 0.32 ], [ 0.03, 0.45 ], [ 0.06, 0.55 ] ].map( ( [ u, v ] ) => new Vector3( u * W, y0 + v * H * 0.86, 0 ) ) );
		g.add( new Mesh( new TubeGeometry( crack, 40, 0.18, 6, false ), lights ) );
		const yoke = new Mesh( new BoxGeometry( W * 0.5, 1.2, 0.6 ), this.steel );
		yoke.position.set( 0, y0 + H * 0.93, 0 );
		g.add( yoke );
		const clapper = new Mesh( new SphereGeometry( 0.9, 12, 10 ), lights );
		clapper.position.set( 0, y0 - 0.2, 0 );
		g.add( clapper );
		this.bellSign = g;

	}

	// ---------------------------------------------------------------- Ashburn Alley

	// Two-storey brick buildings along the back of center field, their roofs a deck for fans (the rooftop
	// seats), flagpoles, and the retired numbers on the ones either side of center.
	_ashburnAlley() {

		const brick = standard( {
			name: 'alley-brick', color: new Color( 0.24, 0.065, 0.038 ), roughness: 0.85,
			surface: /* wgsl */`
	let N = abs( in.N );
	let u = select( in.P.x, in.P.z, N.x > N.z );
	let row = floor( in.P.y / 0.075 );
	let bu = u / 0.2 + 0.5 * ( row % 2.0 );
	let mortar = clamp( step( 0.88, fract( in.P.y / 0.075 ) ) + step( 0.93, fract( bu ) ), 0.0, 1.0 );
	let tone = 0.82 + 0.3 * fract( sin( dot( vec2f( floor( bu ), row ), vec2f( 12.9898, 78.233 ) ) ) * 43758.5453 );
	s.albedo = mix( mat.color * tone, vec3f( 0.42, 0.4, 0.36 ), mortar * 0.8 );
`,
		} );
		const trim = standard( { name: 'alley-trim', color: new Color( 0.55, 0.5, 0.42 ), roughness: 0.7 } );
		const rail = standard( { name: 'alley-rail', color: new Color( 0.02, 0.1, 0.06 ), roughness: 0.5, metalness: 0.4 } );
		for ( const m of [ brick, trim, rail ] ) m.underwaterLighting = 'none';
		const numbers = canvasTexture( 2048, 256, ( ctx, w, h ) => {

			ctx.fillStyle = '#5b1d12';
			ctx.fillRect( 0, 0, w, h );
			ctx.font = '700 170px "Helvetica Neue", Helvetica, Arial, sans-serif';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			const nums = [ '1', '14', '15', '20', '32', '34', '36', '42' ];
			nums.forEach( ( n, i ) => {

				const cx = ( i + 0.5 ) * w / nums.length;
				ctx.fillStyle = '#f4efe4';
				ctx.beginPath();
				ctx.arc( cx, h / 2, 104, 0, Math.PI * 2 );
				ctx.fill();
				ctx.fillStyle = '#c8102e';
				ctx.fillText( n, cx, h / 2 + 8 );

			} );

		}, 'retiredNumbers' );
		const numMat = standard( { name: 'retired-numbers', roughness: 0.6, textures: { bpNums: numbers }, surface: 's.albedo = textureSample( bpNums, smpAnisoClamp, in.uv ).rgb * 0.75;' } );
		numMat.underwaterLighting = 'none';

		// the buildings sit along the back of the footprint behind center field, facing the field
		const blocks = [ [ - 62, - 40 ], [ - 34, - 8 ], [ 2, 30 ], [ 36, 60 ] ];
		const zBack = - 150.5, D = 7.5, Hb = 8.5;
		for ( const [ x0, x1 ] of blocks ) {

			const w = x1 - x0, cx = ( x0 + x1 ) / 2, cz = zBack + D / 2;
			const b = new Mesh( new BoxGeometry( w, Hb, D ), brick );
			b.position.set( cx, STREET + Hb / 2, cz );
			b.castShadow = true;
			b.receiveShadow = true;
			this.group.add( b );
			const cornice = new Mesh( new BoxGeometry( w + 0.4, 0.5, D + 0.4 ), trim );
			cornice.position.set( cx, STREET + Hb, cz );
			this.group.add( cornice );
			// the rooftop's railing
			const r = new Mesh( new BoxGeometry( w, 0.08, 0.08 ), rail );
			r.position.set( cx, STREET + Hb + 1.1, cz + D / 2 );
			this.group.add( r );
			// storefront band facing the field
			const band = new Mesh( new BoxGeometry( w - 1, 2.6, 0.1 ), rail );
			band.position.set( cx, STREET + 1.9, cz + D / 2 + 0.05 );
			this.group.add( band );
			const wpos = this.field.toWorld( cx, cz );
			this.colliders.addBox( new Vector3( wpos.x, this.field.y0 + STREET + Hb / 2, wpos.z ), new Vector3( w / 2, Hb / 2, D / 2 ), this.field.group.rotation.y, { tag: 'ashburn-alley', walkable: true } );

		}

		// the retired numbers on the center buildings, facing the field
		const nq = new Quads();
		const [ nx0, nx1 ] = [ - 30, 26 ];
		const ny0 = STREET + 4.6, ny1 = ny0 + 3.2, nz = zBack + D + 0.08;
		nq.add( [ nx0, ny0, nz ], [ nx1, ny0, nz ], [ nx1, ny1, nz ], [ nx0, ny1, nz ], [ 0, 0, 1 ] );
		const ngeo = nq.geometry();
		const uv = ngeo.getAttribute( 'uv' ).array, pos = ngeo.getAttribute( 'position' ).array;
		for ( let i = 0; i < uv.length / 2; i ++ ) {

			uv[ i * 2 ] = ( pos[ i * 3 ] - nx0 ) / ( nx1 - nx0 );
			uv[ i * 2 + 1 ] = 1 - ( pos[ i * 3 + 1 ] - ny0 ) / ( ny1 - ny0 );

		}

		const nm = new Mesh( ngeo, numMat );
		nm.name = 'retired-numbers';
		this.group.add( nm );

		// flagpoles behind center field
		const flag = standard( { name: 'flags', color: new Color( 0.5, 0.05, 0.06 ), roughness: 0.8, side: 'double' } );
		flag.underwaterLighting = 'none';
		for ( let i = 0; i < 6; i ++ ) {

			const x = - 20 + i * 8, z = zBack + 1;
			const pole = new Mesh( new CylinderGeometry( 0.08, 0.12, 24, 8 ), trim );
			pole.position.set( x, STREET + Hb + 12, z );
			this.group.add( pole );
			const f = new Mesh( new BoxGeometry( 2.4, 1.5, 0.03 ), flag );
			f.position.set( x + 1.25, STREET + Hb + 22.8, z );
			this.group.add( f );

		}

	}

	// ---------------------------------------------------------------- the batter's eye

	// Behind the center field fence from Monty's Angle to 401: ivy over the brick up to Ashburn Alley, and
	// a bed of evergreens at its foot.
	_battersEye() {

		const ivy = standard( {
			name: 'ivy', color: new Color( 0.035, 0.09, 0.03 ), roughness: 0.85, modules: [ commonModule ],
			surface: /* wgsl */`
	let p = in.P;
	let n = mx_noise_float3( p * 2.3 ) * 0.5 + mx_noise_float3( p * 7.1 ) * 0.3 + mx_noise_float3( p * 0.6 ) * 0.4;
	s.albedo = mat.color * ( 0.75 + 0.6 * n );
	s.normal = normalize( in.N + vec3f( mx_noise_float3( p * 9.0 ), mx_noise_float3( p * 9.0 + 3.1 ), mx_noise_float3( p * 9.0 + 7.7 ) ) * 0.35 );
`,
		} );
		const shrub = standard( { name: 'evergreens', color: new Color( 0.02, 0.06, 0.025 ), roughness: 0.9, modules: [ commonModule ],
			surface: 's.albedo = mat.color * ( 0.7 + 0.6 * mx_noise_float3( in.P * 3.0 ) );' } );
		for ( const m of [ ivy, shrub ] ) m.underwaterLighting = 'none';
		// the same line the pit's wall takes there (Bowl: 7 m behind the fence from 387 to 401)
		const line = offsetPolyline( this.bowl._fenceLine( 3, 8 ), 7 - 0.12, [ 0, 0 ] );
		const q = new Quads();
		for ( let i = 0; i < line.length - 1; i ++ ) {

			const [ ax, az ] = line[ i ], [ bx, bz ] = line[ i + 1 ];
			const len = Math.hypot( bx - ax, bz - az );
			if ( len < 0.1 ) continue;
			let nx = - ( bz - az ) / len, nz = ( bx - ax ) / len;
			if ( nx * - ax + nz * - az < 0 ) {

				nx = - nx; nz = - nz;

			}

			q.add( [ ax, 0, az ], [ bx, 0, bz ], [ bx, STREET, bz ], [ ax, STREET, az ], [ nx, 0, nz ] );
			// evergreens along the foot of the wall
			const n = Math.floor( len / 2.2 );
			for ( let k = 0; k < n; k ++ ) {

				const t = ( k + 0.5 ) / n;
				const x = ax + ( bx - ax ) * t + nx * 1.4, z = az + ( bz - az ) * t + nz * 1.4;
				const h = 2.4 + 1.2 * Math.abs( Math.sin( x * 3.7 + z * 1.3 ) );
				const c = new Mesh( new ConeGeometry( 1.0, h, 8 ), shrub );
				c.position.set( x, h / 2, z );
				c.castShadow = true;
				c.receiveShadow = true;
				this.group.add( c );

			}

		}

		const m = new Mesh( q.geometry(), ivy );
		m.name = 'batters-eye-ivy';
		m.receiveShadow = true;
		this.group.add( m );

	}

}

// A quad facing -z (home plate, in a _facingHome group) with uvs 0..1 across it as seen from home
function quadUV( W, H, y0, z ) {

	const q = new Quads();
	q.add( [ - W / 2, y0, z ], [ W / 2, y0, z ], [ W / 2, y0 + H, z ], [ - W / 2, y0 + H, z ], [ 0, 0, - 1 ] );
	const geo = q.geometry();
	const uv = geo.getAttribute( 'uv' ).array, pos = geo.getAttribute( 'position' ).array;
	for ( let i = 0; i < uv.length / 2; i ++ ) {

		// seen from home plate (looking along +z in the group), +x is on the left
		uv[ i * 2 ] = 1 - ( pos[ i * 3 ] + W / 2 ) / W;
		uv[ i * 2 + 1 ] = 1 - ( pos[ i * 3 + 1 ] - y0 ) / H;

	}

	return geo;

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

// The 2008 board's face: the ad column on the left; the amber matrix (at-bat, due up, today, the lineup,
// the line score, the count) over the video board.
function drawBoard2008( ctx, w, h, st ) {

	const amber = '#ffab2e';
	ctx.fillStyle = '#05070b';
	ctx.fillRect( 0, 0, w, h );
	// ---- the ad column
	const colW = w * 0.19;
	ctx.fillStyle = '#c8102e';
	ctx.fillRect( 8, 8, colW - 16, h * 0.47 );
	// a bottle, roughly
	ctx.fillStyle = '#f4f1ea';
	const bx = colW / 2, by = h * 0.08;
	ctx.beginPath();
	ctx.moveTo( bx - 14, by ); ctx.lineTo( bx + 14, by ); ctx.lineTo( bx + 16, by + 60 ); ctx.quadraticCurveTo( bx + 50, by + 120, bx + 42, by + 200 );
	ctx.quadraticCurveTo( bx + 34, by + 260, bx + 44, by + 330 ); ctx.lineTo( bx - 44, by + 330 ); ctx.quadraticCurveTo( bx - 34, by + 260, bx - 42, by + 200 );
	ctx.quadraticCurveTo( bx - 50, by + 120, bx - 16, by + 60 ); ctx.closePath(); ctx.fill();
	ctx.fillStyle = '#ffffff';
	ctx.font = 'italic 700 58px Georgia, serif';
	ctx.textAlign = 'center';
	ctx.fillText( 'Coca-Cola', colW / 2, h * 0.44, colW - 30 );
	ctx.fillStyle = '#16120e';
	ctx.fillRect( 8, h * 0.5, colW - 16, h * 0.49 );
	ctx.fillStyle = '#e8781e';
	ctx.font = '800 56px "Helvetica Neue", Arial, sans-serif';
	[ 'MEDICINE', 'WITH', 'MUSCLE' ].forEach( ( t, i ) => ctx.fillText( t, colW / 2, h * 0.58 + i * 66, colW - 30 ) );
	ctx.fillStyle = '#e6c21c';
	ctx.fillRect( colW * 0.18, h * 0.8, colW * 0.64, h * 0.1 );
	ctx.fillStyle = '#1b3f8e';
	ctx.font = 'italic 800 54px "Helvetica Neue", Arial, sans-serif';
	ctx.fillText( 'Motrin', colW / 2, h * 0.87, colW * 0.6 );

	// ---- the amber matrix
	const mx = colW + 10, mw = w - mx - 8, mh = h * 0.47;
	ctx.fillStyle = '#0a0703';
	ctx.fillRect( mx, 8, mw, mh );
	ctx.textAlign = 'left';
	const txt = ( t, x, y, size = 40, color = amber, align = 'left' ) => {

		ctx.fillStyle = color;
		ctx.font = `700 ${ size }px "Courier New", Courier, monospace`;
		ctx.textAlign = align;
		ctx.shadowColor = color;
		ctx.shadowBlur = 6;
		ctx.fillText( t, x, y );
		ctx.shadowBlur = 0;

	};

	const S = st || { teams: { away: { abbr: 'TB', club: 'Rays' }, home: { abbr: 'PHI', club: 'Phillies' } }, line: [], score: { away: 0, home: 0 }, hits: { away: 0, home: 0 }, errors: { away: 0, home: 0 }, count: [ 0, 0 ], outs: 0, lineup: [], dueUp: [], today: [], batter: null, video: { kind: 'title' } };
	// the at-bat
	const c1 = mx + 16;
	txt( 'AT-BAT:', c1, 58, 30 );
	if ( S.batter ) txt( S.batter.last, c1 + 20, 102, 42 );
	txt( 'TODAY', c1, 156, 32 );
	const tdy = S.today.length ? `${ S.today.filter( ( t ) => /SINGLED|DOUBLED|TRIPLED|HOMERED/.test( t ) ).length } FOR ${ S.today.filter( ( t ) => ! /WALKED|HIT BY|SACRIFICED/.test( t ) ).length }` : '0 FOR 0';
	txt( tdy, c1 + 20, 196, 36 );
	txt( `${ ( S.batting === 'home' ? S.teams.away : S.teams.home ).club.toUpperCase() }`, c1, 262, 30 );
	txt( 'DUE UP:', c1, 298, 30 );
	S.dueUp.forEach( ( d, i ) => txt( d, c1 + 12, 336 + i * 36, 30 ) );
	// today's at-bats
	const c2 = mx + mw * 0.3;
	ctx.strokeStyle = amber;
	ctx.lineWidth = 2;
	ctx.strokeRect( c2, 22, mw * 0.36, mh - 150 );
	if ( S.batter ) {

		ctx.fillStyle = '#5a3a08';
		ctx.fillRect( c2 + 4, 26, mw * 0.36 - 8, 52 );
		txt( `${ S.batter.num }  ${ S.batter.last }  ${ S.batter.pos }`, c2 + 16, 66, 36 );

	}

	S.today.slice( - 4 ).forEach( ( t, i ) => txt( t, c2 + 16, 130 + i * 44, 28 ) );
	// the lineup
	const c3 = mx + mw * 0.7;
	txt( ( S.batting === 'home' ? S.teams.home.club : S.teams.away.club ).toUpperCase(), c3 + mw * 0.14, 50, 34, amber, 'center' );
	S.lineup.forEach( ( l, i ) => {

		txt( `${ l.up ? '*' : ' ' }${ String( l.num ).padStart( 2, ' ' ) } ${ l.last }`, c3, 92 + i * 33, 28 );
		txt( l.pos, mx + mw - 14, 92 + i * 33, 28, amber, 'right' );

	} );
	// the line score and the count
	const ly = mh - 110;
	const cols = mw * 0.64 / 13;
	const lx = mx + 16;
	for ( let i = 1; i <= 9; i ++ ) txt( String( i ), lx + ( i + 2.6 ) * cols, ly, 32, amber, 'center' );
	[ 'R', 'H', 'E' ].forEach( ( t, i ) => txt( t, lx + ( 12.2 + i * 0.9 ) * cols, ly, 32, amber, 'center' ) );
	[ [ 'away', 0 ], [ 'home', 1 ] ].forEach( ( [ side, r ] ) => {

		const y = ly + 42 + r * 42;
		txt( S.teams[ side ].club.toUpperCase().slice( 0, 8 ), lx, y, 32 );
		for ( let i = 1; i <= 9; i ++ ) {

			const v = S.line[ i - 1 ]?.[ r ];
			if ( v != null ) txt( String( v ), lx + ( i + 2.6 ) * cols, y, 32, amber, 'center' );

		}

		[ S.score[ side ], S.hits[ side ], S.errors[ side ] ].forEach( ( v, i ) => txt( String( v ), lx + ( 12.2 + i * 0.9 ) * cols, y, 32, amber, 'center' ) );

	} );
	const cx = mx + mw * 0.78;
	[ [ 'BALLS', S.count[ 0 ] ], [ 'STRIKES', S.count[ 1 ] ], [ 'OUTS', S.outs ] ].forEach( ( [ k, v ], i ) => {

		txt( k, cx, ly + i * 40, 30 );
		txt( String( v ), mx + mw - 18, ly + i * 40, 34, amber, 'right' );

	} );

	// ---- the video board
	const vx = mx, vy = mh + 22, vw = mw, vh = h - vy - 44;
	const grad = ctx.createLinearGradient( vx, vy, vx + vw, vy + vh );
	const v = S.video || { kind: 'title' };
	const phi = S.batting === 'home';
	grad.addColorStop( 0, v.kind === 'batter' ? ( phi ? '#8d0b1c' : '#0a2656' ) : '#0b2a6f' );
	grad.addColorStop( 1, v.kind === 'batter' ? ( phi ? '#3a0710' : '#08162f' ) : '#6b0a18' );
	ctx.fillStyle = grad;
	ctx.fillRect( vx, vy, vw, vh );
	ctx.textAlign = 'center';
	ctx.fillStyle = '#ffffff';
	ctx.shadowColor = 'rgba( 0, 0, 0, 0.6 )';
	ctx.shadowBlur = 16;
	if ( v.kind === 'batter' && S.batter ) {

		ctx.font = '900 360px "Helvetica Neue", Arial, sans-serif';
		ctx.globalAlpha = 0.35;
		ctx.fillText( S.batter.num, vx + vw * 0.72, vy + vh * 0.78 );
		ctx.globalAlpha = 1;
		ctx.font = '900 104px "Helvetica Neue", Arial, sans-serif';
		ctx.fillText( S.batter.name, vx + vw * 0.5, vy + vh * 0.56, vw - 80 );
		ctx.font = '700 48px "Helvetica Neue", Arial, sans-serif';
		ctx.fillText( `#${ S.batter.num }  ·  ${ S.batter.pos }`, vx + vw * 0.5, vy + vh * 0.74 );

	} else if ( v.kind === 'final' ) {

		ctx.font = '900 118px "Helvetica Neue", Arial, sans-serif';
		ctx.fillText( 'WORLD', vx + vw / 2, vy + vh * 0.42 );
		ctx.fillText( 'CHAMPIONS!', vx + vw / 2, vy + vh * 0.72, vw - 60 );

	} else if ( v.kind === 'pitcher' ) {

		ctx.font = '700 58px "Helvetica Neue", Arial, sans-serif';
		ctx.fillText( 'NOW PITCHING', vx + vw / 2, vy + vh * 0.4 );
		ctx.font = '900 100px "Helvetica Neue", Arial, sans-serif';
		ctx.fillText( `#${ v.num } ${ ( v.name || '' ).toUpperCase() }`, vx + vw / 2, vy + vh * 0.66, vw - 60 );

	} else {

		ctx.font = '900 92px "Helvetica Neue", Arial, sans-serif';
		ctx.fillText( 'WORLD SERIES 2008', vx + vw / 2, vy + vh * 0.42, vw - 60 );
		ctx.font = '700 64px "Helvetica Neue", Arial, sans-serif';
		ctx.fillText( S.inning ? `${ S.half === 'top' ? 'TOP' : 'BOTTOM' } ${ S.inning }  ·  ${ S.teams.away.abbr } ${ S.score.away }  ${ S.teams.home.abbr } ${ S.score.home }` : 'GAME 5', vx + vw / 2, vy + vh * 0.68, vw - 60 );

	}

	ctx.shadowBlur = 0;
	ctx.fillStyle = '#9aa3ad';
	ctx.font = '600 24px "Helvetica Neue", Arial, sans-serif';
	ctx.fillText( 'PHILIPS', vx + vw / 2, h - 14 );

}
