import { Group, Mesh, BoxGeometry, CylinderGeometry, ConeGeometry, SphereGeometry, TubeGeometry, CatmullRomCurve3, Vector3, Color } from '../engine/index.js';
import { commonModule } from '../engine/render/wgsl/common.js';
import { standard } from '../materials/Materials.js';
import { Quads } from './Stands.js';
import { canvasTexture } from './geo.js';
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
		// light towers in the outfield: beside the scoreboard in left, over the Pavilion in right
		for ( const [ a, d ] of [ [ - 49, 470 ], [ 36, 440 ] ] ) {

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

	_scoreboard() {

		const W = 152 * FT, H = 86 * FT, TOP = 143.25 * FT;
		const [ x, z ] = fencePoint( - 34.5, 452 );
		const g = this._facingHome( x, z );
		const y0 = TOP - H - 2.2;
		this.scoreboardTexture = canvasTexture( 2048, 1160, drawScoreboard, 'scoreboard' );
		const screen = standard( {
			name: 'scoreboard', roughness: 0.4, textures: { bpBoard: this.scoreboardTexture },
			surface: /* wgsl */`
	let t = textureSample( bpBoard, smpAnisoClamp, in.uv ).rgb;
	// an LED board: its own light, a little brighter after dark
	s.albedo = t * 0.05;
	s.emissive = t * mix( 2.2, 1.2, frame.night );
`,
		} );
		screen.underwaterLighting = 'none';
		// the board's face (uv 0..1 across it), toward home plate (local -z... the group faces home)
		const q = new Quads();
		q.add( [ - W / 2, y0, - 0.68 ], [ W / 2, y0, - 0.68 ], [ W / 2, y0 + H, - 0.68 ], [ - W / 2, y0 + H, - 0.68 ], [ 0, 0, - 1 ] );
		const geo = q.geometry();
		const uv = geo.getAttribute( 'uv' ).array, pos = geo.getAttribute( 'position' ).array;
		for ( let i = 0; i < uv.length / 2; i ++ ) {

			// seen from home plate (looking along +z in the group), +x is on the left
			uv[ i * 2 ] = 1 - ( pos[ i * 3 ] + W / 2 ) / W;
			uv[ i * 2 + 1 ] = 1 - ( pos[ i * 3 + 1 ] - y0 ) / H;

		}

		const face = new Mesh( geo, screen );
		face.name = 'scoreboard-face';
		g.add( face );
		// the cabinet round it and the steel it stands on
		const box = new Mesh( new BoxGeometry( W + 1.6, H + 1.6, 1.2 ), this.steel );
		box.position.set( 0, y0 + H / 2, 0 );
		box.castShadow = true;
		g.add( box );
		for ( const lx of [ - W / 3, 0, W / 3 ] ) {

			const leg = new Mesh( new BoxGeometry( 1.2, y0 - STREET + 0.5, 1.2 ), this.steel );
			leg.position.set( lx, STREET + ( y0 - STREET ) / 2, 2 );
			leg.castShadow = true;
			g.add( leg );

		}

		// the team script on top: a lit sign
		const sign = canvasTexture( 1024, 256, ( ctx, w, h ) => {

			ctx.clearRect( 0, 0, w, h );
			ctx.fillStyle = '#ffffff';
			ctx.font = 'italic 700 190px Georgia, "Times New Roman", serif';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.lineWidth = 16;
			ctx.strokeStyle = '#0a2a6b';
			ctx.strokeText( 'Phillies', w / 2, h / 2 + 10 );
			ctx.fillStyle = '#e81828';
			ctx.fillText( 'Phillies', w / 2, h / 2 + 10 );

		}, 'scriptSign' );
		const signMat = standard( {
			name: 'script-sign', roughness: 0.5, alphaTest: 0.5, side: 'double', textures: { bpScript: sign },
			surface: 'let t = textureSample( bpScript, smpAnisoClamp, in.uv ); s.alpha = t.a; s.albedo = t.rgb * 0.5; s.emissive = t.rgb * mix( 0.4, 1.6, frame.night );',
		} );
		signMat.underwaterLighting = 'none';
		const sq = new Quads();
		const SW = W * 0.62, SH = SW / 4, sy = y0 + H + 0.8;
		sq.add( [ - SW / 2, sy, - 0.4 ], [ SW / 2, sy, - 0.4 ], [ SW / 2, sy + SH, - 0.4 ], [ - SW / 2, sy + SH, - 0.4 ], [ 0, 0, - 1 ] );
		const sgeo = sq.geometry();
		const suv = sgeo.getAttribute( 'uv' ).array, spos = sgeo.getAttribute( 'position' ).array;
		for ( let i = 0; i < suv.length / 2; i ++ ) {

			suv[ i * 2 ] = 1 - ( spos[ i * 3 ] + SW / 2 ) / SW;
			suv[ i * 2 + 1 ] = 1 - ( spos[ i * 3 + 1 ] - sy ) / SH;

		}

		g.add( new Mesh( sgeo, signMat ) );
		this.scoreboard = g;

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

// The scoreboard's picture: a line score, the count, and the welcome.
function drawScoreboard( ctx, w, h ) {

	ctx.fillStyle = '#05070c';
	ctx.fillRect( 0, 0, w, h );
	// top: a banner
	const g = ctx.createLinearGradient( 0, 0, w, 0 );
	g.addColorStop( 0, '#7a0a14' );
	g.addColorStop( 0.5, '#c8102e' );
	g.addColorStop( 1, '#7a0a14' );
	ctx.fillStyle = g;
	ctx.fillRect( 0, 0, w, 150 );
	ctx.fillStyle = '#ffffff';
	ctx.font = '700 104px "Helvetica Neue", Helvetica, Arial, sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText( 'WELCOME TO CITIZENS BANK PARK', w / 2, 80 );
	// the big middle panel
	const mid = ctx.createLinearGradient( 0, 170, 0, 760 );
	mid.addColorStop( 0, '#0b2a6f' );
	mid.addColorStop( 1, '#061532' );
	ctx.fillStyle = mid;
	ctx.fillRect( 40, 170, w - 80, 590 );
	ctx.fillStyle = '#ffffff';
	ctx.font = '700 150px "Helvetica Neue", Helvetica, Arial, sans-serif';
	ctx.fillText( 'SOUTH PHILADELPHIA', w / 2, 370 );
	ctx.font = '500 84px "Helvetica Neue", Helvetica, Arial, sans-serif';
	ctx.fillStyle = '#c9d6ff';
	ctx.fillText( 'GATES ARE OPEN', w / 2, 540 );
	ctx.fillText( 'ENJOY THE GAME', w / 2, 650 );
	// the line score
	const top = 800, rowH = 110;
	ctx.font = '700 80px "Helvetica Neue", Helvetica, Arial, sans-serif';
	const cols = [ '', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'R', 'H', 'E' ];
	const x0 = 60, cw = ( w - 120 ) / ( cols.length + 2 );
	cols.forEach( ( c, i ) => {

		ctx.fillStyle = i >= 10 ? '#ffd24a' : '#9fb3e6';
		ctx.fillText( c, x0 + ( i + 2.5 ) * cw, top + rowH / 2 );

	} );
	for ( const [ r, name ] of [ [ 1, 'VISITORS' ], [ 2, 'PHILLIES' ] ] ) {

		const y = top + r * rowH + rowH / 2;
		ctx.fillStyle = r === 2 ? '#c8102e' : '#1d3a8a';
		ctx.fillRect( x0, top + r * rowH + 8, cw * 2.2, rowH - 16 );
		ctx.fillStyle = '#ffffff';
		ctx.textAlign = 'center';
		ctx.fillText( name, x0 + cw * 1.1, y, cw * 2 );
		for ( let i = 1; i < cols.length; i ++ ) {

			ctx.fillStyle = i >= 10 ? '#ffd24a' : '#ffffff';
			ctx.fillText( i >= 10 ? '0' : '', x0 + ( i + 2.5 ) * cw, y );

		}

	}

}
