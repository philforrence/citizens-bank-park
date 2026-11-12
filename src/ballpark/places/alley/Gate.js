import { Mesh, Color, Vector3, Vector4 } from '../../../engine/index.js';
import { standard } from '../../../materials/Materials.js';
import { commonModule } from '../../../engine/render/wgsl/common.js';
import { Quads } from '../../Stands.js';
import { canvasTexture, beam, flatPolygon } from '../../geo.js';
import { LEVELS } from '../../layout.js';
import { TOP, HAT, PANTS } from './Folk.js';

// FK3 (step 12, SC1-8): the court inside the Right Field Gate, the Alley's east end. It was a bare 37 x 57 m
// slab between two walls, unlit but for the gate's canopy. Dressed as the Alley is (its 2008 photos:
// commons 2008-03-29, newballpark.org 2008-06-20 at night): red clay pavers in panels framed by bands of
// light concrete, the bands at the lamp posts every 12 m; the Alley's lamp posts (a grey pole, a frosted
// lantern under a flat grey disc, a PA horn), lit after dark and lighting the court for real; benches
// along the walls, round concrete planters, red cans and blue recycling bins (Fair's, from
// AshburnAlley2008), a World Series program and towel cart by the gate (Fair's). On the gate's inside the
// "Welcome to World Series Game 5" placards zip-tied to the white grid (gf, Oct 27 2008, the park
// preparing: the same placards as the Third Base Gate's), MLB's 2008 World Series banners on the walls,
// the park's green wayfinding sign toward the Alley. The ushers and a guard inside the turnstiles, a
// family's photo under the canopy, two friends waiting for a third. The rain puddles the pavers on the
// 27th.
//
//   const g = new RightFieldGate( { parent, folk, field, colliders } )   (before folk.build())
//   g.set( { rain, litter } ); g.lamps (field [ x, y, z ]: AshburnAlley2008 lights them)

const STREET = LEVELS.mainConcourse;
// the court (field frame): between the walls at x 93.5 and 131.2, from the gate's line (z -153) north
const X0 = 93.75, X1 = 130.95, Z0 = - 152.85, Z1 = - 96.0;
// the lamp posts on the bands' crossings (and the floor's pools of light under them)
const LAMPS = [ [ 99, - 144 ], [ 123, - 144 ], [ 99, - 132 ], [ 123, - 132 ], [ 99, - 120 ], [ 123, - 120 ], [ 99, - 108 ], [ 123, - 108 ] ];

const PAL = [ 'pole', 'disc', 'lantern', 'wood', 'black', 'concrete', 'soil', 'leaf', 'green', 'white' ];
const K = Object.fromEntries( PAL.map( ( k, i ) => [ k, i ] ) );

// the signs' atlas (1024 x 1024): the welcome placard (0,0 256x384), the wayfinding sign (256,0 768x256),
// the World Series banner (0,384 256x640)
function drawSigns( ctx ) {

	ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
	// the placard, as the Third Base Gate's (gate3b/Gate.js)
	ctx.fillStyle = '#f4f2ec'; ctx.fillRect( 0, 0, 256, 384 );
	ctx.fillStyle = '#1b2a57'; ctx.fillRect( 0, 0, 256, 70 );
	ctx.fillStyle = '#f4f2ec'; ctx.font = '800 30px Helvetica, Arial, sans-serif';
	ctx.fillText( 'WORLD SERIES', 128, 26 ); ctx.font = '800 28px Helvetica, Arial, sans-serif'; ctx.fillText( '2008', 128, 54 );
	ctx.fillStyle = '#b3151f'; ctx.font = 'italic 700 46px Georgia, serif';
	ctx.fillText( 'Welcome', 128, 130 );
	ctx.fillStyle = '#1b2a57'; ctx.font = '700 30px Helvetica, Arial, sans-serif';
	ctx.fillText( 'to World Series', 128, 190 );
	ctx.font = '800 58px Helvetica, Arial, sans-serif'; ctx.fillText( 'GAME 5', 128, 262 );
	ctx.fillStyle = '#b3151f'; ctx.fillRect( 20, 318, 216, 6 );
	ctx.fillStyle = '#1b2a57'; ctx.font = '600 20px Helvetica, Arial, sans-serif';
	ctx.fillText( 'Tampa Bay at Philadelphia', 128, 350 );
	// the wayfinding sign: the park's green, white letters and arrows
	ctx.fillStyle = '#0f6b3a'; ctx.fillRect( 256, 0, 768, 256 );
	ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6; ctx.strokeRect( 266, 10, 748, 236 );
	ctx.fillStyle = '#ffffff';
	const arrow = ( x, y ) => {

		ctx.save(); ctx.translate( x, y ); ctx.rotate( - Math.PI * 0.75 );
		ctx.beginPath(); ctx.moveTo( 0, - 26 ); ctx.lineTo( 22, 4 ); ctx.lineTo( 8, 4 ); ctx.lineTo( 8, 26 ); ctx.lineTo( - 8, 26 ); ctx.lineTo( - 8, 4 ); ctx.lineTo( - 22, 4 ); ctx.closePath(); ctx.fill();
		ctx.restore();

	};
	ctx.textAlign = 'left';
	ctx.font = '800 54px "Helvetica Neue", Arial, sans-serif'; ctx.fillText( 'ASHBURN ALLEY', 360, 62 );
	ctx.font = '700 34px "Helvetica Neue", Arial, sans-serif'; ctx.fillText( 'SECTIONS 101 - 112  •  140 - 148', 360, 128 );
	ctx.fillText( 'PAVILION 201 - 211  •  ELEVATOR', 360, 184 );
	arrow( 312, 62 ); arrow( 312, 156 );
	ctx.textAlign = 'center';
	// the banner: MLB's World Series navy, the trophy's flags in gold, the year and the teams
	ctx.fillStyle = '#14234b'; ctx.fillRect( 0, 384, 256, 640 );
	ctx.fillStyle = '#c9a646'; ctx.fillRect( 14, 398, 228, 6 ); ctx.fillRect( 14, 1004, 228, 6 );
	ctx.fillStyle = '#ffffff'; ctx.font = '800 64px Helvetica, Arial, sans-serif'; ctx.fillText( '2008', 128, 470 );
	ctx.font = '800 40px Helvetica, Arial, sans-serif'; ctx.fillText( 'WORLD', 128, 540 ); ctx.fillText( 'SERIES', 128, 586 );
	// the trophy: a ring of pennants on a base
	ctx.fillStyle = '#c9a646';
	for ( let i = 0; i < 9; i ++ ) {

		const x = 128 + ( i - 4 ) * 16;
		ctx.beginPath(); ctx.moveTo( x - 5, 760 ); ctx.lineTo( x - 5, 680 - Math.abs( i - 4 ) * 6 ); ctx.lineTo( x + 7, 690 - Math.abs( i - 4 ) * 6 ); ctx.lineTo( x + 5, 760 ); ctx.closePath(); ctx.fill();

	}
	ctx.fillRect( 88, 760, 80, 14 ); ctx.fillRect( 100, 774, 56, 34 ); ctx.fillRect( 84, 808, 88, 14 );
	ctx.fillStyle = '#ffffff'; ctx.font = '700 26px Helvetica, Arial, sans-serif';
	ctx.fillText( 'RAYS', 128, 880 ); ctx.font = '600 20px Helvetica, Arial, sans-serif'; ctx.fillText( 'vs', 128, 912 );
	ctx.fillStyle = '#e81828'; ctx.font = 'italic 800 40px Georgia, serif'; ctx.fillText( 'Phillies', 128, 952 );

}

export class RightFieldGate {

	constructor( { parent, folk, field, colliders } ) {

		const Y = STREET, q = new Quads(), sq = new Quads();
		const u = ( k ) => [ ( k + 0.5 ) / PAL.length, 0.5 ];
		const W = ( x, z ) => field.toWorld( x, z );
		const post = ( x, z, r, h ) => {

			const w = W( x, z );
			colliders.addCylinder( w.x, w.z, r, field.y0 + Y, field.y0 + Y + h, { tag: 'rf-gate-court' } );

		};
		// an axis-aligned box (field frame), one palette colour, all six faces
		const kbox = ( x0, x1, y0, y1, z0, z1, k ) => {

			const U = u( k ), P = ( i, j, l ) => [ i ? x1 : x0, Y + ( j ? y1 : y0 ), l ? z1 : z0 ];
			const f = ( a, b, c, d, n ) => {

				q.tri( a, b, c, n, U, U, U ); q.tri( a, c, d, n, U, U, U );

			};
			f( P( 0, 0, 1 ), P( 1, 0, 1 ), P( 1, 1, 1 ), P( 0, 1, 1 ), [ 0, 0, 1 ] );
			f( P( 1, 0, 0 ), P( 0, 0, 0 ), P( 0, 1, 0 ), P( 1, 1, 0 ), [ 0, 0, - 1 ] );
			f( P( 1, 0, 1 ), P( 1, 0, 0 ), P( 1, 1, 0 ), P( 1, 1, 1 ), [ 1, 0, 0 ] );
			f( P( 0, 0, 0 ), P( 0, 0, 1 ), P( 0, 1, 1 ), P( 0, 1, 0 ), [ - 1, 0, 0 ] );
			f( P( 0, 1, 1 ), P( 1, 1, 1 ), P( 1, 1, 0 ), P( 0, 1, 0 ), [ 0, 1, 0 ] );
			f( P( 0, 0, 0 ), P( 1, 0, 0 ), P( 1, 0, 1 ), P( 0, 0, 1 ), [ 0, - 1, 0 ] );

		};
		// an upright cylinder (field frame), its top and bottom closed; r1 the top's radius
		const cyl = ( x, z, y0, y1, r0, r1, k, seg = 16 ) => {

			const U = u( k );
			for ( let i = 0; i < seg; i ++ ) {

				const a0 = i / seg * Math.PI * 2, a1 = ( i + 1 ) / seg * Math.PI * 2, am = ( a0 + a1 ) / 2;
				const A = [ x + Math.cos( a0 ) * r0, Y + y0, z + Math.sin( a0 ) * r0 ], B = [ x + Math.cos( a1 ) * r0, Y + y0, z + Math.sin( a1 ) * r0 ];
				const C = [ x + Math.cos( a1 ) * r1, Y + y1, z + Math.sin( a1 ) * r1 ], D = [ x + Math.cos( a0 ) * r1, Y + y1, z + Math.sin( a0 ) * r1 ];
				const n = [ Math.cos( am ), ( r0 - r1 ) / Math.max( 0.01, y1 - y0 ), Math.sin( am ) ];
				q.tri( A, B, C, n, U, U, U ); q.tri( A, C, D, n, U, U, U );
				q.tri( [ x, Y + y1, z ], D, C, [ 0, 1, 0 ], U, U, U );
				q.tri( [ x, Y + y0, z ], B, A, [ 0, - 1, 0 ], U, U, U );

			}

		};

		// ---- the lamp posts, as the Alley's (Landmarks.js): pole, cross arm, PA horn, lantern, disc
		this.lamps = [];
		for ( const [ x, z ] of LAMPS ) {

			cyl( x, z, 0, 0.35, 0.24, 0.2, K.pole, 12 );
			cyl( x, z, 0.35, 7.5, 0.13, 0.11, K.pole, 10 );
			kbox( x - 0.6, x + 0.6, 7.36, 7.44, z - 0.04, z + 0.04, K.pole );
			kbox( x - 0.2, x + 0.2, 6.68, 7.12, z + 0.12, z + 0.47, K.black );
			cyl( x, z, 7.5, 8.05, 0.17, 0.17, K.lantern, 14 );
			cyl( x, z, 8.05, 8.1, 0.56, 0.52, K.disc, 20 );
			cyl( x, z, 8.1, 8.2, 0.08, 0.04, K.pole, 8 );
			post( x, z, 0.2, 7.5 );
			this.lamps.push( [ x, Y + 7.9, z ] );

		}

		// ---- benches along the walls, facing in: steel ends, wood slats, a back
		for ( const [ x, z, s ] of [ [ 95.0, - 138, 1 ], [ 95.0, - 126, 1 ], [ 95.0, - 114, 1 ], [ 129.7, - 138, - 1 ], [ 129.7, - 126, - 1 ], [ 129.7, - 114, - 1 ] ] ) {

			const xf = x + s * 0.25, xb = x - s * 0.25;
			for ( const dz of [ - 0.85, 0.85 ] ) kbox( Math.min( xf, xb ), Math.max( xf, xb ), 0, 0.45, z + dz - 0.03, z + dz + 0.03, K.black );
			for ( let i = 0; i < 4; i ++ ) {

				const a = xb + s * ( 0.04 + i * 0.12 );
				kbox( Math.min( a, a + s * 0.1 ), Math.max( a, a + s * 0.1 ), 0.42, 0.46, z - 0.95, z + 0.95, K.wood );

			}
			for ( let i = 0; i < 3; i ++ ) kbox( Math.min( xb - s * 0.02, xb - s * 0.06 ), Math.max( xb - s * 0.02, xb - s * 0.06 ), 0.55 + i * 0.13, 0.65 + i * 0.13, z - 0.95, z + 0.95, K.wood );
			kbox( Math.min( xb - s * 0.06, xb - s * 0.1 ), Math.max( xb - s * 0.06, xb - s * 0.1 ), 0, 0.92, z - 0.9, z - 0.84, K.black );
			kbox( Math.min( xb - s * 0.06, xb - s * 0.1 ), Math.max( xb - s * 0.06, xb - s * 0.1 ), 0, 0.92, z + 0.84, z + 0.9, K.black );
			const w = W( x, z );
			colliders.addBox( new Vector3( w.x, field.y0 + Y + 0.45, w.z ), new Vector3( 0.3, 0.45, 0.95 ), field.group.rotation.y, { tag: 'rf-gate-court' } );

		}

		// ---- round concrete planters between the posts, low shrubs and a few late mums in them
		for ( const [ x, z ] of [ [ 111, - 120 ], [ 111, - 144 ], [ 105, - 108 ], [ 117, - 108 ] ] ) {

			cyl( x, z, 0, 0.62, 0.95, 1.0, K.concrete, 20 );
			cyl( x, z, 0.62, 0.66, 1.04, 1.04, K.concrete, 20 );
			cyl( x, z, 0.5, 0.64, 0.86, 0.86, K.soil, 16 );
			for ( let i = 0; i < 6; i ++ ) {

				const a = i / 6 * Math.PI * 2 + x, rr = 0.45 + 0.1 * Math.sin( i * 2.7 + z );
				cyl( x + Math.cos( a ) * rr, z + Math.sin( a ) * rr, 0.6, 1.0 + 0.12 * Math.sin( i * 1.9 + x ), 0.32, 0.12, K.leaf, 7 );

			}
			cyl( x, z, 0.6, 1.25, 0.4, 0.15, K.leaf, 8 );
			post( x, z, 1.0, 0.66 );

		}

		// ---- the green wayfinding sign toward the Alley, on two posts by the passage under the Pavilion
		{

			const sx = 100.5, sz = - 102.5, half = 1.8, y0 = 2.3, y1 = 3.5;
			for ( const dx of [ - half + 0.2, half - 0.2 ] ) {

				cyl( sx + dx, sz, 0, y1 + 0.1, 0.06, 0.06, K.pole, 8 );
				post( sx + dx, sz, 0.08, y1 );

			}
			kbox( sx - half, sx + half, y0 - 0.04, y1 + 0.04, sz - 0.05, sz - 0.01, K.green );
			// its face toward the gate (-z), the atlas's wayfinding panel
			const A = [ sx + half, Y + y0, sz - 0.06 ], B = [ sx - half, Y + y0, sz - 0.06 ], C = [ sx - half, Y + y1, sz - 0.06 ], D = [ sx + half, Y + y1, sz - 0.06 ];
			const u0 = 0.25, u1 = 1, v0 = 0, v1 = 0.25;
			sq.tri( A, B, C, [ 0, 0, - 1 ], [ u0, v1 ], [ u1, v1 ], [ u1, v0 ] );
			sq.tri( A, C, D, [ 0, 0, - 1 ], [ u0, v1 ], [ u1, v0 ], [ u0, v0 ] );

		}

		// ---- the welcome placards on the gate's grid, facing in (the gate's white fence at z -153.03)
		for ( const x of [ 101.2, 112, 122.8 ] ) {

			const z = - 152.9, w = 0.8, y0 = 1.05, y1 = 2.25;
			const A = [ x - w / 2, Y + y0, z ], B = [ x + w / 2, Y + y0, z ], C = [ x + w / 2, Y + y1, z ], D = [ x - w / 2, Y + y1, z ];
			sq.tri( A, B, C, [ 0, 0, 1 ], [ 0, 0.375 ], [ 0.25, 0.375 ], [ 0.25, 0 ] );
			sq.tri( A, C, D, [ 0, 0, 1 ], [ 0, 0.375 ], [ 0.25, 0 ], [ 0, 0 ] );
			// the zip ties at its corners
			for ( const [ cx, cy ] of [ [ x - w / 2 + 0.03, y0 + 0.03 ], [ x + w / 2 - 0.03, y0 + 0.03 ], [ x - w / 2 + 0.03, y1 - 0.03 ], [ x + w / 2 - 0.03, y1 - 0.03 ] ] ) kbox( cx - 0.012, cx + 0.012, cy - 0.03, cy + 0.03, z - 0.02, z + 0.012, K.black );

		}

		// ---- the World Series banners hung on the walls, two on each, facing the court
		for ( const [ x, z, f ] of [ [ 93.62, - 140, 1 ], [ 93.62, - 124, 1 ], [ 131.05, - 140, - 1 ], [ 131.05, - 124, - 1 ] ] ) {

			const w = 1.2, y0 = 2.6, y1 = 5.6;
			const A = [ x, Y + y0, z + f * w / 2 ], B = [ x, Y + y0, z - f * w / 2 ], C = [ x, Y + y1, z - f * w / 2 ], D = [ x, Y + y1, z + f * w / 2 ];
			sq.tri( A, B, C, [ f, 0, 0 ], [ 0, 1 ], [ 0.25, 1 ], [ 0.25, 0.375 ] );
			sq.tri( A, C, D, [ f, 0, 0 ], [ 0, 1 ], [ 0.25, 0.375 ], [ 0, 0.375 ] );
			// its pole along the top, the brackets
			beam( q, [ x + f * 0.06, Y + y1 + 0.04, z - w / 2 - 0.05 ], [ x + f * 0.06, Y + y1 + 0.04, z + w / 2 + 0.05 ], 0.025 );
			beam( q, [ x + f * 0.06, Y + y0 - 0.04, z - w / 2 ], [ x + f * 0.06, Y + y0 - 0.04, z + w / 2 ], 0.02 );

		}

		// ---- the floor: the Alley's pavers carried in
		const floor = flatPolygon( [ [ X0, Z0 ], [ X1, Z0 ], [ X1, Z1 ], [ X0, Z1 ] ], [], Y + 0.014 );
		const vec = ( pts ) => pts.map( ( [ x, z ] ) => `vec2f( ${ x.toFixed( 2 ) }, ${ z.toFixed( 2 ) } )` ).join( ', ' );
		const fmat = standard( {
			name: 'rf-gate-court', color: new Color( 0.2, 0.072, 0.048 ), roughness: 0.8, modules: [ commonModule ],
			uniforms: { court: [ 'vec4f', new Vector4( 0, 0, 0, 0 ) ] }, // x litter, y rain
			surface: /* wgsl */`
	// the field frame (uv): bands of concrete 3 m wide on a 12 m grid through the lamp posts, a 2 m border
	// along the walls and the gate; the brick panels between in a running bond
	let p = in.uv;
	let fw = fwidth( p.x ) + fwidth( p.y );
	let bx = abs( fract( ( p.x - 99.0 ) / 12.0 + 0.5 ) - 0.5 ) * 12.0;
	let bz = abs( fract( ( p.y + 144.0 ) / 12.0 + 0.5 ) - 0.5 ) * 12.0;
	let border = min( min( p.x - ${ X0.toFixed( 2 ) }, ${ X1.toFixed( 2 ) } - p.x ), min( p.y - ( ${ Z0.toFixed( 2 ) } ), ${ Z1.toFixed( 2 ) } - p.y ) );
	let concrete = bx < 1.5 || bz < 1.5 || border < 2.0;
	let bu = p.x / 0.2 + 0.5 * floor( p.y / 0.1 );
	let bv = p.y / 0.1;
	let hb = fract( sin( dot( vec2f( floor( bu ), floor( bv ) ), vec2f( 12.9898, 78.233 ) ) ) * 43758.5453 );
	let fj = clamp( fw * 12.0 - 0.3, 0.0, 1.0 );
	let joint = mix( max( step( 0.92, fract( bu ) ), step( 0.86, fract( bv ) ) ), 0.16, fj );
	var brick = mat.color * mix( 0.72 + 0.5 * hb, 0.97, fj );
	brick = mix( brick, vec3f( 0.23, 0.21, 0.19 ), joint * 0.85 );
	let cj = abs( fract( p / 1.5 ) - 0.5 ) * 1.5;
	let cut = ( 1.0 - smoothstep( 0.01, 0.01 + fw, min( 0.75 - cj.x, 0.75 - cj.y ) ) ) * ( 1.0 - clamp( fw * 20.0, 0.0, 1.0 ) );
	let conc = vec3f( 0.46, 0.44, 0.4 ) * ( 0.93 + 0.08 * mx_noise_float2( p * 3.0 ) ) * ( 1.0 - 0.35 * cut );
	var c = select( brick, conc, concrete );
	// worn down the middle, from the gate toward the Alley; a season's stains; gum
	let traffic = exp( - pow( ( p.x - 111.0 ) / 7.0, 2.0 ) );
	c = c * ( 1.0 - 0.12 * traffic * ( 0.6 + 0.4 * mx_noise_float2( p * 0.7 ) ) ) * ( 0.9 + 0.12 * mx_noise_float2( p * 0.35 ) );
	c = c * ( 1.0 - 0.16 * smoothstep( 0.35, 0.75, mx_noise_float2( p * 0.9 + vec2f( 11.0, 3.0 ) ) ) * ( 0.4 + 0.6 * traffic ) );
	let gcell = floor( p / 0.35 );
	let gh = fract( sin( dot( gcell, vec2f( 41.3, 17.7 ) ) ) * 7543.21 );
	let gp = fract( p / 0.35 ) - vec2f( 0.5 ) - ( vec2f( fract( gh * 13.1 ), fract( gh * 7.7 ) ) - 0.5 ) * 0.6;
	let gum = step( 0.98 - 0.015 * traffic, gh ) * ( 1.0 - smoothstep( 0.035, 0.05, length( gp ) ) ) * ( 1.0 - fj );
	c = mix( c, vec3f( 0.12, 0.12, 0.12 ), gum * 0.8 );
	// the night's litter: a ticket stub, a napkin, a peanut shell, more as the game goes
	let lcell = floor( p / 0.5 );
	let lh = fract( sin( dot( lcell, vec2f( 91.7, 33.1 ) ) ) * 9431.7 );
	let lp = fract( p / 0.5 ) - vec2f( 0.5 ) - ( vec2f( fract( lh * 17.3 ), fract( lh * 5.9 ) ) - 0.5 ) * 0.5;
	let litterK = mat.court.x * ( 0.3 + 0.5 * traffic );
	let shell = step( 1.0 - 0.05 * litterK, lh ) * ( 1.0 - smoothstep( 0.02, 0.03, length( lp * vec2f( 1.0, 1.8 ) ) ) );
	let paper = step( 1.0 - 0.025 * litterK, fract( lh * 3.3 ) ) * ( 1.0 - smoothstep( 0.04, 0.055, max( abs( lp.x ), abs( lp.y * 1.6 ) ) ) );
	c = mix( c, vec3f( 0.45, 0.33, 0.18 ), shell * ( 1.0 - fj ) );
	c = mix( c, vec3f( 0.75, 0.74, 0.7 ), paper * ( 1.0 - fj ) );
	s.albedo = c;
	s.roughness = select( 0.82, 0.9, concrete ) - 0.1 * traffic;
	// the 27th's rain: puddles in the low spots, rings where the drops land
	let rain = mat.court.y;
	let low = mx_noise_float2( p * 0.45 ) * 0.6 + mx_noise_float2( p * 1.7 ) * 0.25 + joint * 0.25 - traffic * 0.1;
	let puddle = smoothstep( 0.45 - 0.35 * rain, 0.5 - 0.35 * rain, low ) * step( 0.01, rain );
	if ( puddle > 0.0 ) {
		s.albedo = s.albedo * mix( 1.0, 0.45, puddle );
		s.roughness = mix( s.roughness, 0.03, puddle );
		let rc = floor( p / 0.6 );
		let rh = fract( sin( dot( rc, vec2f( 27.1, 61.7 ) ) ) * 4375.85 );
		let ph = fract( frame.time * 1.3 + rh );
		let rp = fract( p / 0.6 ) - vec2f( 0.5 ) - ( vec2f( fract( rh * 7.1 ), fract( rh * 3.9 ) ) - 0.5 ) * 0.4;
		let ring = 1.0 - smoothstep( 0.0, 0.02, abs( length( rp ) - ph * 0.3 ) );
		s.normal = normalize( in.N + vec3f( rp.x, 0.0, rp.y ) * ring * ( 1.0 - ph ) * puddle * rain * 3.0 );
	}
	// after dark, warm pools under the lamps
	var lamps = array<vec2f, 8>( ${ vec( LAMPS ) } );
	var pool = 0.0;
	for ( var i = 0; i < 8; i ++ ) {
		let dl = p - lamps[ i ];
		pool += 1.4 * exp( - dot( dl, dl ) / 14.0 );
	}
	s.emissive = s.albedo * vec3f( 1.0, 0.8, 0.55 ) * pool * smoothstep( 0.15, 0.7, frame.night ) * ( 1.0 + 1.5 * puddle );
`,
		} );
		fmat.underwaterLighting = 'none';
		this.floorMat = fmat;
		const fm = new Mesh( floor, fmat );
		fm.name = 'rf-gate-court';
		fm.receiveShadow = true;
		parent.add( fm );

		// the kit's palette
		const kmat = standard( { name: 'rf-gate-kit', roughness: 0.5, modules: [ commonModule ],
			surface: /* wgsl */`
	let k = i32( in.uv.x * ${ PAL.length }.0 );
	var c = vec3f( 0.5 ); var r = 0.5; var mt = 0.0; var e = vec3f( 0.0 );
	let night = smoothstep( 0.1, 0.7, frame.night );
	switch k {
		case 0: { c = vec3f( 0.5, 0.52, 0.54 ); r = 0.4; mt = 0.6; }
		case 1: { c = vec3f( 0.5, 0.52, 0.54 ); r = 0.4; mt = 0.6; if ( in.N.y < - 0.5 ) { e = vec3f( 1.0, 0.85, 0.6 ) * mix( 0.2, 3.0, night ); } }
		case 2: { c = vec3f( 0.75, 0.74, 0.7 ); r = 0.3; e = vec3f( 1.0, 0.88, 0.68 ) * mix( 0.15, 4.0, night ); }
		case 3: { c = vec3f( 0.33, 0.2, 0.11 ) * ( 0.85 + 0.15 * mx_noise_float2( in.P.xz * vec2f( 0.6, 9.0 ) ) ); r = 0.7; }
		case 4: { c = vec3f( 0.03 ); r = 0.5; mt = 0.5; }
		case 5: { c = vec3f( 0.55, 0.53, 0.5 ) * ( 0.9 + 0.1 * mx_noise_float2( in.P.xz * 3.0 + in.P.y * 5.0 ) ); r = 0.85; }
		case 6: { c = vec3f( 0.1, 0.07, 0.05 ); r = 0.95; }
		case 7: {
			let n = mx_noise_float2( in.P.xz * 7.0 + in.P.y * 9.0 );
			c = mix( vec3f( 0.05, 0.13, 0.04 ), vec3f( 0.13, 0.22, 0.06 ), n );
			// a few late mums in the shrubs: rust and gold
			let m = step( 0.72, mx_noise_float2( in.P.xz * 11.0 + vec2f( in.P.y * 13.0, 0.0 ) ) );
			c = mix( c, vec3f( 0.55, 0.22, 0.05 ), m * 0.8 ); r = 0.9;
		}
		case 8: { c = vec3f( 0.0, 0.26, 0.13 ); r = 0.5; }
		default: { c = vec3f( 0.8, 0.79, 0.76 ); }
	}
	s.albedo = c; s.roughness = r; s.metalness = mt; s.emissive = e;
` } );
		kmat.underwaterLighting = 'none';
		const km = new Mesh( q.geometry(), kmat );
		km.name = 'rf-gate-kit';
		km.castShadow = true;
		km.receiveShadow = true;
		parent.add( km );
		const tex = canvasTexture( 1024, 1024, drawSigns, 'rfGateSigns' );
		const smat = standard( { name: 'rf-gate-signs', roughness: 0.6, side: 'double', textures: { bpRfg: tex },
			surface: 'let t = textureSample( bpRfg, smpAnisoClamp, in.uv ).rgb; s.albedo = t * 0.75; s.emissive = t * smoothstep( 0.2, 0.8, frame.night ) * 0.08;' } );
		smat.underwaterLighting = 'none';
		smat.setDefine( 'WET_FABRIC', 1 );
		const sm = new Mesh( sq.geometry(), smat );
		sm.name = 'rf-gate-signs';
		sm.receiveShadow = true;
		parent.add( sm );

		// ---- the people: the ushers and a guard inside the turnstiles, a family's photo, two friends
		this.people = [];
		const F = folk;
		if ( F ) {

			const add = ( pair, o, role, phase = 0 ) => {

				const p = F.add( pair, { y: Y, ...o } );
				this.people.push( { p, role, phase } );
				return p;

			};
			add( 'idle', { x: 104.2, z: - 149.6, yaw: 0, look: { top: TOP.usher, hat: HAT.staffCap, pants: PANTS.black }, nights: 3 }, 'usher', 0 );
			add( 'idle', { x: 119.6, z: - 149.4, yaw: 0.3, look: { top: TOP.usher, hat: HAT.staffCap, pants: PANTS.black, woman: true }, nights: 3 }, 'usher', 1.3 );
			add( 'pockets', { x: 112.3, z: - 148.6, yaw: - 0.2, look: { top: TOP.security, hat: HAT.none, pants: PANTS.dark }, nights: 3 }, 'guard', 0.6 );
			// the family under the canopy: the father with the camera, the mother and the boy posing
			add( 'photo', { x: 108.3, z: - 143.8, yaw: Math.PI, look: { top: TOP.parka, hat: HAT.wsCap }, nights: 2 }, 'photo', 0 );
			add( 'idle', { x: 108.6, z: - 146.9, yaw: 0, look: { top: TOP.redJacket, hat: HAT.none, woman: true }, nights: 2 }, 'pose', 0.4 );
			add( 'idle', { x: 109.1, z: - 147.0, yaw: 0.1, look: { top: TOP.kidRed, hat: HAT.cap, kid: true }, nights: 2 }, 'pose', 0.9 );
			// two friends waiting for a third by the planter
			add( 'pockets', { x: 112.6, z: - 141.9, yaw: - 2.4, look: { top: TOP.redHoodie, hat: HAT.beanie }, nights: 3 }, 'wait', 0.2 );
			add( 'idle', { x: 113.5, z: - 142.6, yaw: 2.2, look: { top: TOP.homeJersey, hat: HAT.cap }, nights: 3 }, 'talk', 1.1 );
			// a man on a bench with his program, out of the rain on the 29th's late innings
			add( 'sit', { x: 129.45, z: - 126.3, yaw: Math.PI / 2, look: { top: TOP.leather, hat: HAT.cap }, nights: 2 }, 'sit', 0.5 );

		}

	}

	set( { litter = 0, rain = 0 } = {} ) {

		this.floorMat.uniforms.court.value.set( litter, rain, 0, 0 );

	}

	update( dt, w, now ) {

		for ( const { p, role, phase } of this.people ) {

			if ( role === 'talk' || role === 'usher' ) p.k = 0.5 + 0.5 * Math.sin( now * 0.9 + phase * 3 );
			else if ( role === 'photo' ) p.k = 0.5 + 0.5 * Math.sin( now * 0.4 );
			else if ( role === 'sit' ) p.k = Math.max( 0, Math.sin( now * 0.3 + phase ) );

		}

	}

}
