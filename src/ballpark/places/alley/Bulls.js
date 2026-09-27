import { Mesh, InstancedMesh, PlaneGeometry, InstancedBufferAttribute, Color, Vector3, Vector4 } from '../../../engine/index.js';
import { standard } from '../../../materials/Materials.js';
import { Quads } from '../../Stands.js';
import { canvasTexture, beam } from '../../geo.js';
import { LEVELS } from '../../layout.js';
import { TOP, HAT, PANTS } from './Folk.js';

// Bull's BBQ, at the left field end of the Alley (commons 2008-03-29 and wallyg 2005 photos): a dark
// green tent - a tall square pyramid over the counter with the Bull's BBQ logo on its gable, a lower hip
// roofed wing either side, a scalloped valance, strip lights under the eaves - over teal counters with
// the logo on them, the menu boards in the eaves, the smokers behind puffing hickory smoke that the wind
// takes; a plaza of red brick with round red mesh tables under red and white Phillies umbrellas, a grey
// disc lamp, a red Phillies trash can, belt stanchions and a PLEASE ENTER HERE sign. Greg Luzinski at a
// table out front signing, the line for him; the pit crew at the smokers; a sandwich going over the
// counter.

const STREET = LEVELS.mainConcourse;

// the logo: "Bull's" in a flaming script over big block BBQ, a bat through it
function drawLogo( ctx, w, h ) {

	ctx.clearRect( 0, 0, w, h );
	const g = ctx.createLinearGradient( 0, h * 0.25, 0, h * 0.95 );
	g.addColorStop( 0, '#ffe066' ); g.addColorStop( 0.5, '#f5a623' ); g.addColorStop( 1, '#d8401a' );
	// the flames behind
	ctx.fillStyle = '#b8261a';
	for ( let i = 0; i < 9; i ++ ) {

		const x = w * ( 0.2 + i * 0.075 );
		ctx.beginPath(); ctx.moveTo( x - 22, h * 0.95 ); ctx.quadraticCurveTo( x - 30, h * 0.55, x + ( i % 2 ? 8 : - 6 ), h * ( 0.3 + 0.05 * ( i % 3 ) ) ); ctx.quadraticCurveTo( x + 4, h * 0.6, x + 22, h * 0.95 ); ctx.fill();

	}

	// the bat, across
	ctx.save();
	ctx.translate( w * 0.18, h * 0.3 ); ctx.rotate( 0.35 );
	ctx.fillStyle = '#c8955a'; ctx.beginPath(); ctx.moveTo( 0, - 7 ); ctx.lineTo( 150, - 16 ); ctx.quadraticCurveTo( 170, 0, 150, 16 ); ctx.lineTo( 0, 7 ); ctx.closePath(); ctx.fill();
	ctx.restore();
	// a little bull in a Phillies cap on the bat's knob
	ctx.fillStyle = '#6b3a1f'; ctx.beginPath(); ctx.ellipse( w * 0.14, h * 0.33, 34, 30, 0, 0, Math.PI * 2 ); ctx.fill();
	ctx.fillStyle = '#f1e6d0'; ctx.beginPath(); ctx.moveTo( w * 0.1, h * 0.26 ); ctx.lineTo( w * 0.06, h * 0.16 ); ctx.lineTo( w * 0.12, h * 0.24 ); ctx.fill();
	ctx.beginPath(); ctx.moveTo( w * 0.18, h * 0.26 ); ctx.lineTo( w * 0.22, h * 0.16 ); ctx.lineTo( w * 0.16, h * 0.24 ); ctx.fill();
	ctx.fillStyle = '#c8102e'; ctx.beginPath(); ctx.ellipse( w * 0.14, h * 0.25, 26, 12, 0, Math.PI, 0 ); ctx.fill();
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.lineJoin = 'round';
	ctx.font = `italic 900 ${ h * 0.26 }px Georgia, "Times New Roman", serif`;
	ctx.lineWidth = 10; ctx.strokeStyle = '#6a0f0f'; ctx.strokeText( "Bull's", w * 0.56, h * 0.3 );
	ctx.fillStyle = '#c8102e'; ctx.fillText( "Bull's", w * 0.56, h * 0.3 );
	ctx.font = `900 ${ h * 0.42 }px Impact, "Arial Black", sans-serif`;
	ctx.lineWidth = 12; ctx.strokeStyle = '#5a0c0c'; ctx.strokeText( 'BBQ', w * 0.58, h * 0.7 );
	ctx.fillStyle = g; ctx.fillText( 'BBQ', w * 0.58, h * 0.7 );

}

// the menu boards: black, the items in white, the prices in yellow (2008-ish)
function drawMenu( ctx, w, h ) {

	ctx.fillStyle = '#121212'; ctx.fillRect( 0, 0, w, h );
	ctx.strokeStyle = '#c8102e'; ctx.lineWidth = 6; ctx.strokeRect( 4, 4, w - 8, h - 8 );
	ctx.fillStyle = '#c8102e'; ctx.fillRect( 4, 4, w - 8, h * 0.2 );
	ctx.fillStyle = '#ffffff'; ctx.font = `900 ${ h * 0.13 }px "Arial Black", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
	ctx.fillText( "BULL'S BBQ", w / 2, h * 0.11 );
	// the 2008 menu (Phillies.com, October 2008: pit beef, ribs, pit turkey, pulled pork, turkey legs, the Bulldog);
	// the prices invented (the page lists none)
	const items = [ [ 'Pit Beef', '8.75' ], [ 'Pulled BBQ Pork', '8.75' ], [ 'Pit Turkey', '8.75' ], [ 'BBQ Ribs', '11.50' ], [ 'BBQ Turkey Leg', '9.50' ], [ 'The Bulldog (kielbasa)', '8.25' ] ];
	ctx.font = `600 ${ h * 0.085 }px "Helvetica Neue", Arial, sans-serif`;
	items.forEach( ( [ n, p ], i ) => {

		const y = h * ( 0.3 + i * 0.115 );
		ctx.textAlign = 'left'; ctx.fillStyle = '#f2f2f2'; ctx.fillText( n, w * 0.06, y );
		ctx.textAlign = 'right'; ctx.fillStyle = '#ffd23f'; ctx.fillText( p, w * 0.94, y );

	} );

}

export class Bulls {

	// at: [ x, z ] the tent's front middle (it faces +z, the field); folk: the Alley's people (added here)
	constructor( { parent, folk, at } ) {

		this.parent = parent;
		const [ cx, cz ] = at;
		this.at = at;
		const Y = STREET;
		// the tent: the middle pyramid 5.2 m square, 6.4 m to its peak, eaves at 3.0; the wings 5 m each
		// side, hip roofs 4.6 m high over eaves at 2.8
		const fabric = standard( { name: 'bulls-tent', color: new Color( 0.02, 0.085, 0.06 ), roughness: 0.8, side: 'double',
			surface: /* wgsl */`
	// under the lights at night the fabric glows a little from inside
	s.emissive = s.albedo * smoothstep( 0.2, 0.8, frame.night ) * select( 0.2, 1.4, in.N.y < 0.0 );
` } );
		const q = new Quads();
		const hip = ( x0, x1, z0, z1, ye, yr, ridge ) => {

			// four sloped faces up to a ridge along x (ridge: half its length; 0 = a pyramid)
			const mx = ( x0 + x1 ) / 2, mz = ( z0 + z1 ) / 2;
			const R0 = [ mx - ridge, Y + yr, mz ], R1 = [ mx + ridge, Y + yr, mz ];
			const A = [ x0, Y + ye, z0 ], B = [ x1, Y + ye, z0 ], C = [ x1, Y + ye, z1 ], D = [ x0, Y + ye, z1 ];
			const nrm = ( a, b, c ) => {

				const u = [ b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ], b[ 2 ] - a[ 2 ] ], v = [ c[ 0 ] - a[ 0 ], c[ 1 ] - a[ 1 ], c[ 2 ] - a[ 2 ] ];
				const n = [ u[ 1 ] * v[ 2 ] - u[ 2 ] * v[ 1 ], u[ 2 ] * v[ 0 ] - u[ 0 ] * v[ 2 ], u[ 0 ] * v[ 1 ] - u[ 1 ] * v[ 0 ] ];
				return n[ 1 ] < 0 ? n.map( ( k ) => - k ) : n;

			};

			q.add( D, C, R1, R0, nrm( D, C, R1 ) ); // front
			q.add( B, A, R0, R1, nrm( B, A, R0 ) ); // back
			q.tri( A, D, R0, nrm( A, D, R0 ) );
			q.tri( C, B, R1, nrm( C, B, R1 ) );
			// the valance: a 0.35 m skirt round the eaves
			for ( const [ a, b ] of [ [ A, B ], [ B, C ], [ C, D ], [ D, A ] ] ) q.add( [ a[ 0 ], a[ 1 ] - 0.35, a[ 2 ] ], [ b[ 0 ], b[ 1 ] - 0.35, b[ 2 ] ], b, a, [ 0, 0, 1 ] );

		};

		const Wm = 5.2, Ww = 5.0, depth = 6.0, z0 = cz - depth, z1 = cz;
		hip( cx - Wm / 2, cx + Wm / 2, z0 - 0.2, z1 + 0.2, 3.0, 6.4, 0 );
		hip( cx - Wm / 2 - Ww, cx - Wm / 2 + 0.3, z0, z1 - 0.2, 2.8, 4.4, Ww / 2 - 2.6 );
		hip( cx + Wm / 2 - 0.3, cx + Wm / 2 + Ww, z0, z1 - 0.2, 2.8, 4.4, Ww / 2 - 2.6 );
		const tent = new Mesh( q.geometry(), fabric );
		tent.name = 'bulls-tent';
		tent.castShadow = true;
		tent.receiveShadow = true;
		parent.add( tent );

		// the poles, the counters, the smokers, the menu boards, the lights
		const steel = standard( { name: 'bulls-poles', color: new Color( 0.2, 0.21, 0.22 ), roughness: 0.5, metalness: 0.6 } );
		const pq = new Quads();
		const x0 = cx - Wm / 2 - Ww, x1 = cx + Wm / 2 + Ww;
		for ( const x of [ x0, cx - Wm / 2, cx + Wm / 2, x1 ] ) for ( const z of [ z0, z1 - 0.2 ] ) beam( pq, [ x, Y, z ], [ x, Y + 2.9, z ], 0.08 );
		// belt stanchions for the line: posts and the belts between
		const line = [];
		for ( let i = 0; i < 6; i ++ ) line.push( [ cx - 1.2 + ( i % 2 ) * 2.4, cz + 0.8 + Math.floor( i / 2 ) * 1.6 ] );
		for ( const [ x, z ] of line ) beam( pq, [ x, Y, z ], [ x, Y + 0.95, z ], 0.05 );

		// the counters: stainless tops over teal fronts with the logo; the smokers behind; menu boards
		const logo = canvasTexture( 1024, 512, drawLogo, 'bullsLogo' );
		const menu = canvasTexture( 512, 384, drawMenu, 'bullsMenu' );
		const signMat = standard( { name: 'bulls-logo', roughness: 0.6, alphaTest: 0.4, side: 'double', textures: { bpBulls: logo },
			surface: 'let t = textureSample( bpBulls, smpAnisoClamp, in.uv ); s.alpha = t.a; s.albedo = t.rgb * 0.8; s.emissive = t.rgb * smoothstep( 0.2, 0.8, frame.night ) * 0.35;' } );
		const menuMat = standard( { name: 'bulls-menu', roughness: 0.3, textures: { bpMenu: menu },
			surface: 'let t = textureSample( bpMenu, smpAnisoClamp, in.uv ).rgb; s.albedo = t * 0.3; s.emissive = t * mix( 0.35, 0.9, smoothstep( 0.2, 0.8, frame.night ) );' } );
		const quad = ( mat, a, b, c, d, n, name ) => {

			const g = new Quads();
			g.tri( a, b, c, n, [ 0, 1 ], [ 1, 1 ], [ 1, 0 ] );
			g.tri( a, c, d, n, [ 0, 1 ], [ 1, 0 ], [ 0, 0 ] );
			const m = new Mesh( g.geometry(), mat );
			m.name = name;
			parent.add( m );
			return m;

		};

		// the logo on the pyramid's front slope
		const lz = z1 + 0.2, ly = Y + 3.2, lw = 2.8, lh = 1.4;
		const slope = ( 6.4 - 3.0 ) / ( depth / 2 + 0.2 );
		// (3 cm off the fabric: where the slope is at the logo's foot, then up it)
		const zb = lz - ( ly - Y - 3.0 ) / slope + 0.03, zt = zb - lh * 0.95 / slope;
		quad( signMat, [ cx - lw / 2, ly, zb ], [ cx + lw / 2, ly, zb ], [ cx + lw / 2, ly + lh * 0.95, zt ], [ cx - lw / 2, ly + lh * 0.95, zt ], [ 0, 1 / Math.hypot( 1, slope ), slope / Math.hypot( 1, slope ) ], 'bulls-logo' );
		// three menu boards in the middle's eave, over the counter
		for ( const dx of [ - 1.6, 0, 1.6 ] ) quad( menuMat, [ cx + dx - 0.7, Y + 2.05, z1 - 0.6 ], [ cx + dx + 0.7, Y + 2.05, z1 - 0.6 ], [ cx + dx + 0.7, Y + 2.6, z1 - 0.6 ], [ cx + dx - 0.7, Y + 2.6, z1 - 0.6 ], [ 0, 0, 1 ], 'bulls-menu' );

		// the kit, one palette material: the counter's stainless and teal, the smokers, the tables
		const PAL = [ 'stainless', 'teal', 'smoker', 'coals', 'red', 'white', 'wood', 'bulb', 'cloth', 'black' ];
		const P = Object.fromEntries( PAL.map( ( k, i ) => [ k, i ] ) );
		const kit = standard( { name: 'bulls-kit', roughness: 0.5,
			surface: /* wgsl */`
	let k = i32( in.uv.x * ${ PAL.length }.0 );
	var c = vec3f( 0.5 ); var r = 0.5; var mt = 0.0; var e = vec3f( 0.0 );
	let night = smoothstep( 0.2, 0.8, frame.night );
	switch k {
		case 0: { c = vec3f( 0.55, 0.56, 0.57 ); r = 0.25; mt = 0.9; }
		case 1: { c = vec3f( 0.02, 0.2, 0.17 ); r = 0.45; }
		case 2: { c = vec3f( 0.025 ); r = 0.6; mt = 0.4; }
		case 3: { c = vec3f( 0.2, 0.03, 0.01 ); e = vec3f( 1.0, 0.3, 0.05 ) * ( 0.8 + 0.4 * sin( frame.time * 3.0 + in.P.x * 7.0 ) ) * mix( 0.8, 1.8, night ); }
		case 4: { c = vec3f( 0.4, 0.02, 0.03 ); r = 0.45; mt = 0.3; }
		case 5: { c = vec3f( 0.75 ); r = 0.5; }
		case 6: { c = vec3f( 0.3, 0.17, 0.08 ); r = 0.7; }
		case 7: { c = vec3f( 0.9, 0.8, 0.6 ); e = vec3f( 1.0, 0.78, 0.45 ) * mix( 0.6, 5.0, night ); }
		case 8: { c = vec3f( 0.38, 0.02, 0.03 ); r = 0.9; }
		default: { c = vec3f( 0.02 ); r = 0.5; }
	}
	s.albedo = c; s.roughness = r; s.metalness = mt; s.emissive = e + c * night * 0.15;
` } );
		kit.setDefine( 'DRY', 1 );
		const kq = new Quads();
		const kbox = ( x0b, x1b, y0, y1, z0b, z1b, pal ) => {

			const u = ( pal + 0.5 ) / PAL.length, U = [ u, 0.5 ];
			const Pp = ( i, j, k ) => [ i ? x1b : x0b, Y + ( j ? y1 : y0 ), k ? z1b : z0b ];
			const f = ( a, b, c, d, n ) => {

				kq.tri( a, b, c, n, U, U, U );
				kq.tri( a, c, d, n, U, U, U );

			};

			f( Pp( 0, 0, 1 ), Pp( 1, 0, 1 ), Pp( 1, 1, 1 ), Pp( 0, 1, 1 ), [ 0, 0, 1 ] );
			f( Pp( 1, 0, 0 ), Pp( 0, 0, 0 ), Pp( 0, 1, 0 ), Pp( 1, 1, 0 ), [ 0, 0, - 1 ] );
			f( Pp( 1, 0, 1 ), Pp( 1, 0, 0 ), Pp( 1, 1, 0 ), Pp( 1, 1, 1 ), [ 1, 0, 0 ] );
			f( Pp( 0, 0, 0 ), Pp( 0, 0, 1 ), Pp( 0, 1, 1 ), Pp( 0, 1, 0 ), [ - 1, 0, 0 ] );
			f( Pp( 0, 1, 1 ), Pp( 1, 1, 1 ), Pp( 1, 1, 0 ), Pp( 0, 1, 0 ), [ 0, 1, 0 ] );

		};

		// the counters across the front of all three (the teal fronts, the stainless tops)
		kbox( x0 + 0.4, x1 - 0.4, 0, 1.0, z1 - 1.3, z1 - 1.0, P.teal );
		kbox( x0 + 0.35, x1 - 0.35, 1.0, 1.05, z1 - 1.4, z1 - 0.85, P.stainless );
		// the logo on the counter's front, middle
		quad( signMat, [ cx - 1.0, Y + 0.25, z1 - 0.99 ], [ cx + 1.0, Y + 0.25, z1 - 0.99 ], [ cx + 1.0, Y + 0.85, z1 - 0.99 ], [ cx - 1.0, Y + 0.85, z1 - 0.99 ], [ 0, 0, 1 ], 'bulls-counter-logo' );
		// the smokers at the back: black barrels on legs, fireboxes glowing, chimneys (the smoke's sources)
		this.chimneys = [];
		for ( const sx of [ cx - 4.8, cx - 1.6, cx + 1.8, cx + 5.2 ] ) {

			kbox( sx - 0.9, sx + 0.9, 0.7, 1.45, z0 + 0.6, z0 + 1.4, P.smoker );
			kbox( sx - 0.9, sx - 0.35, 0.25, 0.7, z0 + 0.65, z0 + 1.35, P.smoker );
			kbox( sx - 0.85, sx - 0.4, 0.3, 0.45, z0 + 1.36, z0 + 1.38, P.coals );
			for ( const lx of [ sx - 0.8, sx + 0.75 ] ) kbox( lx, lx + 0.06, 0, 0.7, z0 + 0.95, z0 + 1.01, P.smoker );
			// (the stacks up through the wing's roof, a cap on each)
			kbox( sx + 0.6, sx + 0.8, 1.45, 5.3, z0 + 0.8, z0 + 1.0, P.smoker );
			kbox( sx + 0.52, sx + 0.88, 5.3, 5.36, z0 + 0.72, z0 + 1.08, P.smoker );
			this.chimneys.push( [ sx + 0.7, Y + 5.4, z0 + 0.9 ] );

		}

		// a warm bulb every metre along the eaves (the 2008 photo's little lights)
		for ( let x = x0 + 0.5; x < x1; x += 1.0 ) kbox( x - 0.05, x + 0.05, 2.28, 2.36, z1 - 0.28, z1 - 0.2, P.bulb );
		// Luzinski's signing table out front, a red cloth over it
		const tx = cx + 3.6, tz = cz + 1.6;
		kbox( tx - 0.75, tx + 0.75, 0.72, 0.76, tz - 0.4, tz + 0.4, P.cloth );
		kbox( tx - 0.76, tx + 0.76, 0.3, 0.72, tz + 0.39, tz + 0.41, P.cloth );
		kbox( tx - 0.3, tx - 0.1, 0.76, 0.8, tz - 0.25, tz + 0.05, P.white );
		this.signing = [ tx, tz - 0.62 ];
		// the plaza: round red mesh tables on pedestals, benches, a red trash can
		this.tables = [];
		for ( const [ ux, uz ] of [ [ - 5.5, 4.5 ], [ - 2.2, 5.3 ], [ 1.4, 5.8 ], [ 4.8, 5.0 ], [ - 6.2, 8.2 ], [ - 2.6, 9.0 ], [ 1.2, 9.4 ], [ 5.0, 8.6 ] ] ) {

			const x = cx + ux, z = cz + uz;
			kbox( x - 0.55, x + 0.55, 0.72, 0.76, z - 0.55, z + 0.55, P.red );
			kbox( x - 0.06, x + 0.06, 0, 0.72, z - 0.06, z + 0.06, P.red );
			for ( const s of [ - 1, 1 ] ) kbox( x - 0.6, x + 0.6, 0.42, 0.46, z + s * 0.78 - 0.15, z + s * 0.78 + 0.15, P.red );
			this.tables.push( [ x, z ] );

		}

		kbox( cx + 7.3, cx + 7.8, 0, 0.9, cz + 2.0, cz + 2.5, P.red );
		const km = new Mesh( kq.geometry(), kit );
		km.name = 'bulls-kit';
		km.castShadow = true;
		km.receiveShadow = true;
		parent.add( km );

		// the umbrellas over the tables: red and white segments, some furled (the wind), and the posts
		const umb = standard( { name: 'bulls-umbrellas', color: new Color( 0.5, 0.03, 0.04 ), roughness: 0.7, side: 'double',
			surface: 's.albedo = select( vec3f( 0.78, 0.77, 0.74 ), vec3f( 0.42, 0.02, 0.03 ), fract( in.uv.x * 0.5 ) < 0.5 );' } );
		const uq = new Quads();
		this.tables.forEach( ( [ x, z ], i ) => {

			beam( pq, [ x, Y + 0.72, z ], [ x, Y + 2.4, z ], 0.035 );
			const open = i % 3 !== 1;
			const R = open ? 1.2 : 0.18, top = Y + 2.5, rim = open ? Y + 2.05 : Y + 1.4;
			for ( let k = 0; k < 8; k ++ ) {

				const a0 = k / 8 * Math.PI * 2, a1 = ( k + 1 ) / 8 * Math.PI * 2, am = ( a0 + a1 ) / 2;
				uq.tri( [ x, top, z ], [ x + Math.cos( a0 ) * R, rim, z + Math.sin( a0 ) * R ], [ x + Math.cos( a1 ) * R, rim, z + Math.sin( a1 ) * R ], [ Math.cos( am ) * 0.4, 0.9, Math.sin( am ) * 0.4 ], [ k + 0.5, 0 ], [ k + 0.5, 0 ], [ k + 0.5, 0 ] );

			}

		} );
		const pm = new Mesh( pq.geometry(), steel );
		pm.name = 'bulls-poles';
		pm.castShadow = true;
		parent.add( pm );
		const um = new Mesh( uq.geometry(), umb );
		um.name = 'bulls-umbrellas';
		um.castShadow = true;
		parent.add( um );
		for ( const m of [ fabric, steel, signMat, menuMat, kit, umb ] ) m.underwaterLighting = 'none';

		this._smoke( parent );
		this._people( folk );

	}

	// hickory smoke off the chimneys: soft billboards rising and spreading downwind, all in the shader
	// (each puff's age from the time and its seed), no CPU per frame
	_smoke( parent ) {

		const N = 26;
		const g = new PlaneGeometry( 1, 1 );
		const count = N * this.chimneys.length;
		const seeds = new Float32Array( count * 4 );
		this.chimneys.forEach( ( c, j ) => {

			for ( let i = 0; i < N; i ++ ) seeds.set( [ c[ 0 ], c[ 1 ], c[ 2 ], ( i + 0.37 * j ) / N ], ( j * N + i ) * 4 );

		} );
		g.setAttribute( 'aPuff', new InstancedBufferAttribute( seeds, 4 ) );
		this.smokeMat = standard( {
			name: 'bulls-smoke', transparent: true, depthWrite: false, side: 'double', roughness: 1,
			uniforms: { drift: [ 'vec4f', new Vector4( 0.3, 0, 0.2, 0 ) ] },
			attributes: { aPuff: 'vec4f' },
			varyings: { vAge: 'f32', vUV: 'vec2f' },
			vertex: /* wgsl */`
	// a puff: where it left the chimney, its phase; its age now (a 9 s rise), where the wind has it
	let pf = v.aPuff;
	let age = fract( frame.time / 9.0 + pf.w );
	let seed = fract( pf.w * 17.3 + pf.x * 0.13 );
	let wind = mat.drift.xyz;
	var c = pf.xyz + vec3f( 0.0, age * ( 3.2 - 1.5 * mat.drift.w ), 0.0 ) + wind * age * age * 6.0;
	c += vec3f( sin( seed * 40.0 + age * 5.0 ), 0.0, cos( seed * 31.0 + age * 4.0 ) ) * age * 0.5;
	let size = 0.35 + age * 2.2;
	// facing the camera
	let world = ( v.model * vec4f( c, 1.0 ) ).xyz;
	let right = vec3f( frame.view[ 0 ][ 0 ], frame.view[ 1 ][ 0 ], frame.view[ 2 ][ 0 ] );
	let up = vec3f( frame.view[ 0 ][ 1 ], frame.view[ 1 ][ 1 ], frame.view[ 2 ][ 1 ] );
	v.useWorld = true;
	v.worldPos = world + ( right * v.position.x + up * v.position.y ) * size;
	v.worldNormal = normalize( frame.cameraPos - world );
	o.vAge = age;
	o.vUV = v.uv;
`,
			surface: /* wgsl */`
	let a = in.vs.vAge;
	let d = length( in.vs.vUV - 0.5 ) * 2.0;
	let wisp = 0.6 + 0.4 * sin( in.vs.vUV.x * 9.0 + a * 12.0 ) * sin( in.vs.vUV.y * 7.0 - a * 9.0 );
	s.alpha = ( 1.0 - smoothstep( 0.2, 1.0, d ) ) * wisp * smoothstep( 0.0, 0.08, a ) * ( 1.0 - a ) * 0.32;
	s.albedo = vec3f( 0.62, 0.6, 0.57 );
	// the tent's lights and the park's catch it after dark
	s.emissive = vec3f( 1.0, 0.8, 0.55 ) * smoothstep( 0.2, 0.8, frame.night ) * 0.08 * ( 1.0 - a );
` } );
		this.smokeMat.underwaterLighting = 'none';
		const mesh = new InstancedMesh( g, this.smokeMat, count );
		mesh.name = 'bulls-smoke';
		mesh.frustumCulled = false;
		mesh.castShadow = false;
		mesh.userData.dynamic = true;
		parent.add( mesh );
		this.smoke = mesh;

	}

	// the wind, field frame [ x, z ], 0..1; the rain (it flattens the smoke)
	setWind( x, z, k, rain = 0 ) {

		const u = this.smokeMat.uniforms.drift.value;
		const l = Math.hypot( x, z ) || 1;
		u.x = x / l * ( 0.2 + 0.8 * k ); u.y = 0; u.z = z / l * ( 0.2 + 0.8 * k ); u.w = rain;

	}

	// ---- the people: Greg Luzinski signing, his line, the pit crew and the counter
	_people( folk ) {

		const [ cx, cz ] = this.at, Y = STREET;
		const F = folk;
		// the Bull: 57, big, the white hair cropped short, a red Phillies polo over a turtleneck
		const [ sx, sz ] = this.signing;
		this.bull = F.add( 'autograph', { x: sx, y: Y, z: sz, yaw: Math.PI, look: { top: TOP.bull, hat: HAT.bald, pants: PANTS.khaki }, scale: 1.1, nights: 3 } );
		this.bull.noBlob = true;
		F.hold( this.bull, 'photo', { hand: 'left', variant: 15 } );
		// his line, out across the plaza: a dad and his boy with a ball, a man with his 1980 program, two
		// buddies in Schmidt and Luzinski throwbacks; on the 27th they wait in ponchos
		this.line = [];
		const looks = [
			{ top: TOP.kidRed, hat: HAT.cap, kid: true },
			{ top: TOP.carhartt, hat: HAT.cap, beard: true },
			{ top: TOP.powderBlue, jersey: 'BULL', hat: HAT.cap },
			{ top: TOP.powderBlue, jersey: 'SCHMIDT', hat: HAT.none, glasses: true },
			{ top: TOP.redJacket, hat: HAT.cabbie, glasses: true, mustache: true },
			{ top: TOP.homeJersey, jersey: 'HOWARD', woman: true, hat: HAT.beanie },
			{ top: TOP.parka, hat: HAT.greyBeanie },
		];
		looks.forEach( ( lk, i ) => {

			const x = sx - 0.2 + ( i === 0 ? 0 : ( i % 2 ) * 0.25 ), z = sz + 0.95 + i * 0.7;
			const p = F.add( i === 0 ? 'serve' : i < 3 ? 'carry' : 'pockets', { x, y: Y, z, yaw: ( i ? 0.15 * ( ( i % 3 ) - 1 ) : 0 ), look: { ...lk, open: true, poncho: false }, nights: 3 } );
			if ( i === 0 ) F.hold( p, 'glove', { hand: 'left' } );
			if ( i === 1 ) F.hold( p, 'photo', { hand: 'both', variant: 15 } );
			if ( i === 2 ) F.hold( p, 'cup', { hand: 'right', variant: 1 } );
			this.line.push( p );

		} );
		// the pit crew at the smokers (their backs to us), and the counter: two serving, one on the register
		this.crew = [];
		for ( const dx of [ - 4.8, 1.8 ] ) {

			const p = F.add( 'grill', { x: cx + dx, y: Y, z: cz - 6.0 + 2.0, yaw: 0, look: { top: TOP.cook, hat: HAT.backwards }, nights: 3 } );
			F.hold( p, 'tongs', { hand: 'right' } );
			this.crew.push( p );

		}

		this.servers = [];
		for ( const dx of [ - 1.6, 0.4, 2.1 ] ) this.servers.push( F.add( 'serve', { x: cx + dx, y: Y, z: cz - 1.75, yaw: Math.PI, look: { top: TOP.cook, hat: HAT.staffCap, woman: dx > 0 && dx < 1 }, nights: 3 } ) );
		// and the customers across the counter, a tray going over to the first
		this.customers = [];
		for ( const dx of [ - 1.6, 0.4, 2.1 ] ) this.customers.push( F.add( 'serve', { x: cx + dx, y: Y, z: cz - 0.55, yaw: 0, look: { top: [ TOP.redHoodie, TOP.eagles, TOP.greyHoodie ][ this.customers.length ], hat: [ HAT.cap, HAT.beanie, HAT.none ][ this.customers.length ], open: true }, nights: 3 } ) );
		this.tray = F.hold( this.servers[ 0 ], 'tray', { hand: 'both' } );

	}

	update( dt, w, now ) {

		// the Bull signs: head down, the pen moving; now and then he looks up with the photo for the fan
		const cycle = ( now % 9 ) / 9;
		this.bull.k = cycle > 0.72 ? Math.min( 1, ( cycle - 0.72 ) * 8 ) : Math.max( 0, 0.15 * Math.sin( now * 7 ) );
		// the line shuffles up one every signing
		const head = this.line[ 0 ];
		head.k = cycle > 0.8 ? 1 : 0.2;
		// at the last out he's up out of his chair (arms up, the whole line with him)
		if ( w.celebrate ) {

			this.bull.k = 1;
			for ( const p of this.line ) p.k = 1;

		}

		// the pit crew turning the meat
		for ( const [ i, p ] of this.crew.entries() ) p.k = 0.5 + 0.5 * Math.sin( now * 1.3 + i * 2 );
		// the counter: a tray handed over (the server reaches, the customer takes it), change made
		const c = ( now % 7 ) / 7;
		this.servers[ 0 ].k = c < 0.5 ? c * 2 : 1 - ( c - 0.5 ) * 2;
		this.customers[ 0 ].k = c > 0.35 && c < 0.75 ? 1 : 0.2;
		this.tray.shown = c < 0.55;
		this.servers[ 1 ].k = 0.3 + 0.3 * Math.sin( now * 1.7 );
		this.servers[ 2 ].k = Math.max( 0, Math.sin( now * 0.9 ) );
		for ( const [ i, p ] of this.customers.entries() ) if ( i ) p.k = 0.2 + 0.2 * Math.sin( now * 0.8 + i );

	}

}
