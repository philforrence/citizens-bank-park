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

const PAL = [ 'pole', 'disc', 'lantern', 'wood', 'black', 'concrete', 'soil', 'leaf', 'green', 'white', 'mum' ];
const K = Object.fromEntries( PAL.map( ( k, i ) => [ k, i ] ) );

// the signs' atlas (1024 x 1024): the welcome placard (0,0 256x384), the wayfinding sign (256,0 768x256),
// the World Series banner (0,384 256x640), (FK3 repair) three concourse posters (256 + 256 i, 256,
// 256x372) for the Pavilion walkway's plain bays (alley/Pavilion.js)
const ATLAS = 1024;
const cell = ( x, y, w, h ) => [ x / ATLAS, y / ATLAS, ( x + w ) / ATLAS, ( y + h ) / ATLAS ];
export const SIGN_CELLS = {
	placard: cell( 0, 0, 256, 384 ), way: cell( 256, 0, 768, 256 ), banner: cell( 0, 384, 256, 640 ),
	posters: [ 0, 1, 2 ].map( ( i ) => cell( 256 + 256 * i + 4, 260, 248, 364 ) ),
};
function drawSigns( ctx ) {

	ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
	// the placard, as the Third Base Gate's (gate3b/Gate.js); (FK3 repair) every line held inside its
	// 256 px (the last, "Tampa Bay at Philadelphia", ran 20 px past it and was cut to "Philadelph")
	const fit = ( t, x, y ) => ctx.fillText( t, x, y, 228 );
	ctx.fillStyle = '#f4f2ec'; ctx.fillRect( 0, 0, 256, 384 );
	ctx.fillStyle = '#1b2a57'; ctx.fillRect( 0, 0, 256, 70 );
	ctx.fillStyle = '#f4f2ec'; ctx.font = '800 30px Helvetica, Arial, sans-serif';
	fit( 'WORLD SERIES', 128, 26 ); ctx.font = '800 28px Helvetica, Arial, sans-serif'; fit( '2008', 128, 54 );
	ctx.fillStyle = '#b3151f'; ctx.font = 'italic 700 46px Georgia, serif';
	fit( 'Welcome', 128, 130 );
	ctx.fillStyle = '#1b2a57'; ctx.font = '700 30px Helvetica, Arial, sans-serif';
	fit( 'to World Series', 128, 190 );
	ctx.font = '800 58px Helvetica, Arial, sans-serif'; fit( 'GAME 5', 128, 262 );
	ctx.fillStyle = '#b3151f'; ctx.fillRect( 20, 318, 216, 6 );
	ctx.fillStyle = '#1b2a57'; ctx.font = '600 19px Helvetica, Arial, sans-serif';
	fit( 'Tampa Bay at Philadelphia', 128, 350 );
	// the wayfinding sign: the park's green, white letters and arrows. (FK3 repair) The arrows point the
	// reader's right: read from the court (facing the passage, its face to the gate) the Alley, the
	// Pavilion's elevator and the sections are all west, through the passage beside it, and west is on the
	// right. They pointed down-left, east, into the court's far wall. A right arrow at the right, as
	// the park's signs set them
	ctx.fillStyle = '#0f6b3a'; ctx.fillRect( 256, 0, 768, 256 );
	ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6; ctx.strokeRect( 266, 10, 748, 236 );
	ctx.fillStyle = '#ffffff';
	const arrow = ( x, y ) => {

		ctx.save(); ctx.translate( x, y ); ctx.rotate( Math.PI * 0.5 );
		ctx.beginPath(); ctx.moveTo( 0, - 26 ); ctx.lineTo( 22, 4 ); ctx.lineTo( 8, 4 ); ctx.lineTo( 8, 26 ); ctx.lineTo( - 8, 26 ); ctx.lineTo( - 8, 4 ); ctx.lineTo( - 22, 4 ); ctx.closePath(); ctx.fill();
		ctx.restore();

	};
	ctx.textAlign = 'left';
	ctx.font = '800 54px "Helvetica Neue", Arial, sans-serif'; ctx.fillText( 'ASHBURN ALLEY', 292, 62, 630 );
	ctx.font = '700 34px "Helvetica Neue", Arial, sans-serif'; ctx.fillText( 'SECTIONS 101 - 112  •  140 - 148', 292, 128, 630 );
	ctx.fillText( 'PAVILION 201 - 211  •  ELEVATOR', 292, 184, 630 );
	arrow( 966, 62 ); arrow( 966, 156 );
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
	// ---- FK3 repair: the posters in the Pavilion walkway's frames (their plain bays' frames were empty, black
	// voids). What a concourse frame held that October: the club's own (the pennant won on Oct 15, the
	// World Series games here, next season's plans), printed on gloss stock
	const poster = ( i, draw ) => {

		const [ x0 ] = [ 256 + 256 * i + 4 ];
		ctx.save(); ctx.translate( x0, 260 );
		ctx.beginPath(); ctx.rect( 0, 0, 248, 364 ); ctx.clip();
		draw( 248, 364 );
		ctx.restore();

	};
	poster( 0, ( w, h ) => {

		// the National League champions: red, pinstripes, the script, the pennant
		ctx.fillStyle = '#b3121b'; ctx.fillRect( 0, 0, w, h );
		ctx.fillStyle = 'rgba( 255, 255, 255, 0.12 )';
		for ( let x = 10; x < w; x += 16 ) ctx.fillRect( x, 0, 2, h );
		ctx.fillStyle = '#ffffff'; ctx.font = 'italic 800 54px Georgia, serif'; ctx.fillText( 'Phillies', w / 2, 62, w - 20 );
		ctx.fillStyle = '#f4f2ec';
		ctx.beginPath(); ctx.moveTo( 24, 110 ); ctx.lineTo( w - 18, 150 ); ctx.lineTo( 24, 190 ); ctx.closePath(); ctx.fill();
		ctx.fillStyle = '#b3121b'; ctx.font = '800 30px Helvetica, Arial, sans-serif'; ctx.fillText( '2008', 96, 151 );
		ctx.fillStyle = '#ffffff'; ctx.font = '800 25px Helvetica, Arial, sans-serif';
		ctx.fillText( 'NATIONAL LEAGUE', w / 2, 236, w - 24 ); ctx.font = '800 38px Helvetica, Arial, sans-serif'; ctx.fillText( 'CHAMPIONS', w / 2, 274, w - 24 );
		ctx.fillStyle = '#1b2a57'; ctx.fillRect( 0, h - 46, w, 46 );
		ctx.fillStyle = '#ffffff'; ctx.font = '700 17px Helvetica, Arial, sans-serif'; ctx.fillText( 'phillies.com', w / 2, h - 22 );

	} );
	poster( 1, ( w, h ) => {

		// the World Series at Citizens Bank Park: Games 3, 4 and 5, October 25-27
		ctx.fillStyle = '#14234b'; ctx.fillRect( 0, 0, w, h );
		ctx.fillStyle = '#c9a646'; ctx.fillRect( 12, 12, w - 24, 4 ); ctx.fillRect( 12, h - 16, w - 24, 4 );
		ctx.fillStyle = '#ffffff'; ctx.font = '800 26px Helvetica, Arial, sans-serif'; ctx.fillText( 'THE 2008', w / 2, 52, w - 24 );
		ctx.font = '800 46px Helvetica, Arial, sans-serif'; ctx.fillText( 'WORLD', w / 2, 100, w - 24 ); ctx.fillText( 'SERIES', w / 2, 146, w - 24 );
		ctx.fillStyle = '#c9a646';
		for ( let k = 0; k < 7; k ++ ) {

			const x = w / 2 + ( k - 3 ) * 13;
			ctx.beginPath(); ctx.moveTo( x - 4, 236 ); ctx.lineTo( x - 4, 184 - Math.abs( k - 3 ) * 5 ); ctx.lineTo( x + 6, 192 - Math.abs( k - 3 ) * 5 ); ctx.lineTo( x + 4, 236 ); ctx.closePath(); ctx.fill();

		}
		ctx.fillRect( w / 2 - 34, 236, 68, 10 ); ctx.fillRect( w / 2 - 24, 246, 48, 18 );
		ctx.fillStyle = '#ffffff'; ctx.font = '700 19px Helvetica, Arial, sans-serif';
		ctx.fillText( 'GAMES 3 · 4 · 5', w / 2, 290, w - 24 ); ctx.font = '600 15px Helvetica, Arial, sans-serif'; ctx.fillText( 'CITIZENS BANK PARK  ·  OCT. 25 - 27', w / 2, 316, w - 20 );
		ctx.fillStyle = '#e81828'; ctx.font = 'italic 800 24px Georgia, serif'; ctx.fillText( 'Phillies', w / 2 - 44, 342 );
		ctx.fillStyle = '#9fc3e8'; ctx.font = '800 20px Helvetica, Arial, sans-serif'; ctx.fillText( 'RAYS', w / 2 + 48, 342 );
		ctx.fillStyle = '#ffffff'; ctx.font = '600 14px Helvetica, Arial, sans-serif'; ctx.fillText( 'vs', w / 2 + 6, 342 );

	} );
	poster( 2, ( w, h ) => {

		// next season's plans: cream, the red and the navy
		ctx.fillStyle = '#efe7d4'; ctx.fillRect( 0, 0, w, h );
		ctx.fillStyle = '#b3121b'; ctx.fillRect( 0, 0, w, 96 );
		ctx.fillStyle = '#ffffff'; ctx.font = '800 30px Helvetica, Arial, sans-serif'; ctx.fillText( 'BE THERE', w / 2, 40, w - 24 ); ctx.font = '800 34px Helvetica, Arial, sans-serif'; ctx.fillText( 'IN 2009', w / 2, 76, w - 24 );
		ctx.fillStyle = '#1b2a57'; ctx.font = '700 24px Helvetica, Arial, sans-serif'; ctx.fillText( 'SEASON TICKET', w / 2, 142, w - 24 ); ctx.fillText( 'PLANS', w / 2, 172, w - 24 );
		ctx.font = '500 16px Helvetica, Arial, sans-serif';
		[ 'Full season  ·  half season', 'Sunday plans  ·  17-game plans', 'Your seats for every game', 'of the 2009 season' ].forEach( ( t, k ) => ctx.fillText( t, w / 2, 214 + k * 24, w - 24 ) );
		ctx.fillStyle = '#b3121b'; ctx.fillRect( 24, 312, w - 48, 3 );
		ctx.fillStyle = '#1b2a57'; ctx.font = '800 20px Helvetica, Arial, sans-serif'; ctx.fillText( 'phillies.com', w / 2, 338, w - 24 );

	} );
	// ---- end FK3 repair

}

// the court's signs' material (FK3 repair: one for the court and the Pavilion walkway's posters, so the
// posters cost no pipeline of their own), made once. Single-sided: each face is drawn the way it's read
// (the placards were double-sided, read mirrored from the street; their backs are blank stock now)
let _signsMat = null;
export function courtSigns() {

	if ( _signsMat ) return _signsMat;
	const tex = canvasTexture( ATLAS, ATLAS, drawSigns, 'rfGateSigns' );
	_signsMat = standard( { name: 'rf-gate-signs', roughness: 0.6, textures: { bpRfg: tex },
		surface: 'let t = textureSample( bpRfg, smpAnisoClamp, in.uv ).rgb; s.albedo = t * 0.75; s.emissive = t * smoothstep( 0.2, 0.8, frame.night ) * 0.08;' } );
	_signsMat.underwaterLighting = 'none';
	_signsMat.setDefine( 'WET_FABRIC', 1 );
	return _signsMat;

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

		// (FK3 repair) a beam in one palette colour (geo's beam runs its u across each face, which ran the
		// palette across the banners' poles)
		const kbeam = ( a, b, w, k ) => {

			const t = new Quads(), U = u( k );
			beam( t, a, b, w );
			q.pos.push( ...t.pos ); q.nrm.push( ...t.nrm );
			for ( let i = 0; i < t.count * 3; i ++ ) q.uv.push( ...U );
			q.count += t.count;

		};
		// a sign's face: A B C D its corners as read (bottom left, bottom right, top right, top left), r its
		// atlas cell [ u0, v0 (top), u1, v1 ]
		const face = ( A, B, C, D, n, r ) => {

			sq.tri( A, B, C, n, [ r[ 0 ], r[ 3 ] ], [ r[ 2 ], r[ 3 ] ], [ r[ 2 ], r[ 1 ] ] );
			sq.tri( A, C, D, n, [ r[ 0 ], r[ 3 ] ], [ r[ 2 ], r[ 1 ] ], [ r[ 0 ], r[ 1 ] ] );

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
			// ---- FK3 repair: a pair of banners on each post, as the Alley's posts carry theirs (the 2008 photo
			// of the Alley by the center field gate: a banner each side of every post) and the World Series'
			// own on them that week, on two arms each; read from the gate and from the passage
			for ( const side of [ - 1, 1 ] ) {

				const xa = x + side * 0.14, xb = x + side * 0.94, y0 = 3.5, y1 = 5.5;
				for ( const yy of [ y0 - 0.03, y1 + 0.03 ] ) kbeam( [ x + side * 0.1, Y + yy, z ], [ x + side * 0.98, Y + yy, z ], 0.03, K.pole );
				for ( const f of [ 1, - 1 ] ) {

					const zz = z + 0.012 * f, [ L, R ] = ( f > 0 ) === ( xa < xb ) ? [ xa, xb ] : [ xb, xa ];
					face( [ L, Y + y0, zz ], [ R, Y + y0, zz ], [ R, Y + y1, zz ], [ L, Y + y1, zz ], [ 0, 0, f ], SIGN_CELLS.banner );

				}

			}
			// ---- end FK3 repair

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

		// ---- round concrete planters between the posts, low shrubs and a few late mums in them. (FK3 repair:
		// each plant a mound of little leaf and flower cards over a dark core, as the Third Base Gate's beds
		// are built (gate3b/Planting.js); they were faceted cones and read as stone close to)
		let seed = 7;
		const rnd = () => ( seed = ( seed * 16807 ) % 2147483647 ) / 2147483647;
		const mound = ( cx, cz, y0, R, H, n, k, sz ) => {

			cyl( cx, cz, y0 - 0.02, y0 + H * 0.78, R * 0.78, R * 0.3, K.leaf, 7 );
			const U = u( k );
			for ( let i = 0; i < n; i ++ ) {

				const a = rnd() * Math.PI * 2, ph = Math.acos( 1 - rnd() * 1.15 ), s = sz * ( 0.75 + 0.5 * rnd() ), tw = rnd() * Math.PI;
				const sp = Math.sin( ph ), cp = Math.cos( ph );
				const c = [ cx + Math.cos( a ) * sp * R, Y + y0 + Math.max( 0, cp ) * H + Math.min( 0, cp ) * 0.1, cz + Math.sin( a ) * sp * R ];
				const nl = Math.hypot( Math.cos( a ) * sp / R, cp / H, Math.sin( a ) * sp / R );
				const nn = [ Math.cos( a ) * sp / R / nl, cp / H / nl, Math.sin( a ) * sp / R / nl ];
				const e1 = [ - Math.sin( a ), 0, Math.cos( a ) ], e2 = [ - Math.cos( a ) * cp, sp, - Math.sin( a ) * cp ];
				const t1 = [ 0, 1, 2 ].map( ( j ) => ( e1[ j ] * Math.cos( tw ) + e2[ j ] * Math.sin( tw ) ) * s );
				const t2 = [ 0, 1, 2 ].map( ( j ) => ( e2[ j ] * Math.cos( tw ) - e1[ j ] * Math.sin( tw ) ) * s );
				const P = ( i1, i2 ) => [ c[ 0 ] + t1[ 0 ] * i1 + t2[ 0 ] * i2, c[ 1 ] + t1[ 1 ] * i1 + t2[ 1 ] * i2, c[ 2 ] + t1[ 2 ] * i1 + t2[ 2 ] * i2 ];
				q.tri( P( - 1, - 1 ), P( 1, - 1 ), P( 1, 1 ), nn, U, U, U );
				q.tri( P( - 1, - 1 ), P( 1, 1 ), P( - 1, 1 ), nn, U, U, U );

			}

		};
		for ( const [ x, z ] of [ [ 111, - 120 ], [ 111, - 144 ], [ 105, - 108 ], [ 117, - 108 ] ] ) {

			cyl( x, z, 0, 0.62, 0.95, 1.0, K.concrete, 20 );
			cyl( x, z, 0.62, 0.66, 1.04, 1.04, K.concrete, 20 );
			cyl( x, z, 0.5, 0.64, 0.86, 0.86, K.soil, 16 );
			// four low evergreens round a taller one, three clumps of mums between them at the rim
			const a0 = rnd() * Math.PI * 2;
			for ( let i = 0; i < 4; i ++ ) {

				const a = a0 + i / 4 * Math.PI * 2, rr = 0.42 + 0.06 * rnd();
				mound( x + Math.cos( a ) * rr, z + Math.sin( a ) * rr, 0.62, 0.32 + 0.08 * rnd(), 0.34 + 0.12 * rnd(), 26, K.leaf, 0.09 );
				const b = a + Math.PI / 4, rm = 0.6;
				if ( i < 3 ) mound( x + Math.cos( b ) * rm, z + Math.sin( b ) * rm, 0.62, 0.2 + 0.05 * rnd(), 0.2 + 0.06 * rnd(), 18, K.mum, 0.065 );

			}
			mound( x, z, 0.62, 0.4, 0.62, 34, K.leaf, 0.1 );
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
			face( [ sx + half, Y + y0, sz - 0.06 ], [ sx - half, Y + y0, sz - 0.06 ], [ sx - half, Y + y1, sz - 0.06 ], [ sx + half, Y + y1, sz - 0.06 ], [ 0, 0, - 1 ], SIGN_CELLS.way );

		}

		// ---- the welcome placards on the gate's grid, facing in (the gate's white fence at z -153.03)
		for ( const x of [ 101.2, 112, 122.8 ] ) {

			const z = - 152.9, w = 0.8, y0 = 1.05, y1 = 2.25;
			face( [ x - w / 2, Y + y0, z ], [ x + w / 2, Y + y0, z ], [ x + w / 2, Y + y1, z ], [ x - w / 2, Y + y1, z ], [ 0, 0, 1 ], SIGN_CELLS.placard );
			// (FK3 repair) its back, blank white stock, toward the street
			kbox( x - w / 2, x + w / 2, y0, y1, z - 0.012, z - 0.004, K.white );
			// the zip ties at its corners
			for ( const [ cx, cy ] of [ [ x - w / 2 + 0.03, y0 + 0.03 ], [ x + w / 2 - 0.03, y0 + 0.03 ], [ x - w / 2 + 0.03, y1 - 0.03 ], [ x + w / 2 - 0.03, y1 - 0.03 ] ] ) kbox( cx - 0.012, cx + 0.012, cy - 0.03, cy + 0.03, z - 0.02, z + 0.012, K.black );

		}

		// ---- the World Series banners hung on the walls, two on each, facing the court
		for ( const [ x, z, f ] of [ [ 93.62, - 140, 1 ], [ 93.62, - 124, 1 ], [ 131.05, - 140, - 1 ], [ 131.05, - 124, - 1 ] ] ) {

			const w = 1.2, y0 = 2.6, y1 = 5.6;
			face( [ x, Y + y0, z + f * w / 2 ], [ x, Y + y0, z - f * w / 2 ], [ x, Y + y1, z - f * w / 2 ], [ x, Y + y1, z + f * w / 2 ], [ f, 0, 0 ], SIGN_CELLS.banner );
			// its pole along the top, the brackets
			kbeam( [ x + f * 0.06, Y + y1 + 0.04, z - w / 2 - 0.05 ], [ x + f * 0.06, Y + y1 + 0.04, z + w / 2 + 0.05 ], 0.025, K.pole );
			kbeam( [ x + f * 0.06, Y + y0 - 0.04, z - w / 2 ], [ x + f * 0.06, Y + y0 - 0.04, z + w / 2 ], 0.02, K.pole );

		}

		// ---- the floor: the Alley's pavers carried in
		const floor = flatPolygon( [ [ X0, Z0 ], [ X1, Z0 ], [ X1, Z1 ], [ X0, Z1 ] ], [], Y + 0.014 );
		const vec = ( pts ) => pts.map( ( [ x, z ] ) => `vec2f( ${ x.toFixed( 2 ) }, ${ z.toFixed( 2 ) } )` ).join( ', ' );
		const fmat = standard( {
			name: 'rf-gate-court', color: new Color( 0.2, 0.072, 0.048 ), roughness: 0.8, modules: [ commonModule ],
			uniforms: { court: [ 'vec4f', new Vector4( 0, 0, 0, 0 ) ] }, // x litter, y rain
			surface: /* wgsl */`
	// the field frame (uv): bands of concrete on a 12 m grid through the lamp posts and a border along the
	// walls and the gate, a soldier course of red clay round each panel, the panels between in a running
	// bond. (FK3 repair: the 2008 photo of the Alley by the center field gate is mostly warm grey-brown
	// pavers, a red one here and there, the light concrete only in strips; the bands were 3 m, the border
	// 2 m, and they read near-white at night over half the floor: now 1.2 m, a darker, warmer concrete,
	// the pavers in the photo's mix)
	let p = in.uv;
	let fw = fwidth( p.x ) + fwidth( p.y );
	let bx = abs( fract( ( p.x - 99.0 ) / 12.0 + 0.5 ) - 0.5 ) * 12.0;
	let bz = abs( fract( ( p.y + 144.0 ) / 12.0 + 0.5 ) - 0.5 ) * 12.0;
	let border = min( min( p.x - ${ X0.toFixed( 2 ) }, ${ X1.toFixed( 2 ) } - p.x ), min( p.y - ( ${ Z0.toFixed( 2 ) } ), ${ Z1.toFixed( 2 ) } - p.y ) );
	let concrete = bx < 0.6 || bz < 0.6 || border < 1.2;
	let soldier = ! concrete && ( bx < 0.81 || bz < 0.81 || border < 1.41 );
	let bu = p.x / 0.2 + 0.5 * floor( p.y / 0.1 );
	let bv = p.y / 0.1;
	let hb = fract( sin( dot( vec2f( floor( bu ), floor( bv ) ), vec2f( 12.9898, 78.233 ) ) ) * 43758.5453 );
	let fj = clamp( fw * 12.0 - 0.3, 0.0, 1.0 );
	let joint = mix( max( step( 0.92, fract( bu ) ), step( 0.86, fract( bv ) ) ), 0.16, fj );
	// each paver its tone: warm grey-brown, buff, a dark one, now and then the red clay (from far, their mean)
	var tone = vec3f( 0.17, 0.13, 0.1 );
	if ( hb > 0.42 ) { tone = vec3f( 0.21, 0.165, 0.12 ); }
	if ( hb > 0.72 ) { tone = vec3f( 0.125, 0.085, 0.064 ); }
	if ( hb > 0.88 ) { tone = mat.color; }
	tone = mix( tone * ( 0.86 + 0.28 * fract( hb * 7.31 ) ), vec3f( 0.175, 0.13, 0.095 ), fj );
	var brick = select( tone, mat.color * mix( 0.78 + 0.4 * fract( hb * 3.7 ), 0.97, fj ), soldier );
	brick = mix( brick, vec3f( 0.23, 0.21, 0.19 ), joint * 0.85 );
	let cj = abs( fract( p / 1.5 ) - 0.5 ) * 1.5;
	let cut = ( 1.0 - smoothstep( 0.01, 0.01 + fw, min( 0.75 - cj.x, 0.75 - cj.y ) ) ) * ( 1.0 - clamp( fw * 20.0, 0.0, 1.0 ) );
	let conc = vec3f( 0.33, 0.315, 0.29 ) * ( 0.93 + 0.08 * mx_noise_float2( p * 3.0 ) ) * ( 1.0 - 0.35 * cut );
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
	// (FK3 repair) a damp, darker margin round each, no sheen; the water's edge a pixel or two wide. The
	// rims drew as bright contours: half-wet, half-glossy, and their glow boosted more than they darkened
	let lo = 0.45 - 0.35 * rain;
	let lw = max( fwidth( low ), 0.002 );
	let damp = smoothstep( lo - 0.07, lo, low ) * step( 0.01, rain );
	let puddle = smoothstep( lo - lw, lo + lw, low ) * step( 0.01, rain );
	if ( damp > 0.0 ) {
		s.albedo = s.albedo * mix( 1.0, 0.72, damp ) * mix( 1.0, 0.62, puddle );
		s.roughness = mix( s.roughness, 0.03, puddle );
		let rc = floor( p / 0.6 );
		let rh = fract( sin( dot( rc, vec2f( 27.1, 61.7 ) ) ) * 4375.85 );
		let ph = fract( frame.time * 1.3 + rh );
		let rp = fract( p / 0.6 ) - vec2f( 0.5 ) - ( vec2f( fract( rh * 7.1 ), fract( rh * 3.9 ) ) - 0.5 ) * 0.4;
		let ring = 1.0 - smoothstep( 0.0, 0.02, abs( length( rp ) - ph * 0.3 ) );
		s.normal = normalize( in.N + vec3f( rp.x, 0.0, rp.y ) * ring * ( 1.0 - ph ) * puddle * rain * 3.0 );
	}
	// after dark, warm pools under the lamps (FK3 repair: softer, 0.8 at a lamp's foot, was 1.4; three of the
	// eight are real lights at a time and the pools came out white on top of them)
	var lamps = array<vec2f, 8>( ${ vec( LAMPS ) } );
	var pool = 0.0;
	for ( var i = 0; i < 8; i ++ ) {
		let dl = p - lamps[ i ];
		pool += 0.8 * exp( - dot( dl, dl ) / 14.0 );
	}
	s.emissive = s.albedo * vec3f( 1.0, 0.8, 0.55 ) * pool * smoothstep( 0.15, 0.7, frame.night ) * ( 1.0 + 0.6 * puddle );
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
		case 10: {
			// (FK3 repair) a clump of late mums: each clump its colour (rust, gold, plum, white), the heads
			// packed, the dark leaves showing between them
			let h = fract( sin( dot( floor( in.P.xz * 1.6 ), vec2f( 12.9898, 78.233 ) ) ) * 43758.5453 );
			var fl = vec3f( 0.5, 0.17, 0.04 );
			if ( h > 0.3 ) { fl = vec3f( 0.62, 0.43, 0.05 ); }
			if ( h > 0.6 ) { fl = vec3f( 0.3, 0.06, 0.2 ); }
			if ( h > 0.85 ) { fl = vec3f( 0.78, 0.76, 0.7 ); }
			let n = mx_noise_float2( in.P.xz * 31.0 + in.P.y * 23.0 );
			c = mix( fl * ( 0.75 + 0.4 * n ), vec3f( 0.05, 0.1, 0.035 ), step( 0.3, n ) ); r = 0.85;
		}
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
		const sm = new Mesh( sq.geometry(), courtSigns() );
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
