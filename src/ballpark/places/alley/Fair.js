import { Mesh, Color } from '../../../engine/index.js';
import { standard } from '../../../materials/Materials.js';
import { Quads } from '../../Stands.js';
import { canvasTexture, beam } from '../../geo.js';
import { LEVELS } from '../../layout.js';
import { TOP, HAT, PANTS } from './Folk.js';

// The Alley's street fair, besides the stands: the Citizens Bank Games of Baseball by the right field end
// (Phillies.com, October 2008: "Run the Bases, play Ballpark Pinball and try Pitch 'Em & Tip 'Em ... near
// the Right Field Gate"; the 2008 photo: a giant tilted diamond board on a maroon steel frame against the
// brick, RUN the BASES in big letters and the green Citizens Bank sign over it, the kids' lanes below), the
// green Citizens Bank ATM, the portable carts (Philadelphia water ice; cotton candy, lemonade, popcorn;
// bottled beer), a World Series program and towel stand, red Phillies trash cans and blue recycling bins.
// The people at them: the cart men, a family at the Run the Bases, a Citizens "ballpark banker".

const STREET = LEVELS.mainConcourse;

const PAL = [ 'red', 'white', 'blue', 'green', 'maroon', 'yellow', 'steel', 'black', 'glass', 'orange', 'screen', 'turf', 'cream' ];
const P = Object.fromEntries( PAL.map( ( k, i ) => [ k, i ] ) );

// the signs: one atlas, rows of 256 px: the carts' boards, the ATM, the programs, RUN the BASES, the diamond
function drawFair( ctx, w, h ) {

	const row = ( i, draw ) => {

		ctx.save();
		ctx.translate( 0, i * 256 );
		ctx.beginPath(); ctx.rect( 0, 0, w, 256 ); ctx.clip();
		draw( w, 256 );
		ctx.restore();

	};

	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	// 0: water ice
	row( 0, ( W, H ) => {

		ctx.fillStyle = '#f4f1ea'; ctx.fillRect( 0, 0, W, H );
		ctx.fillStyle = '#c8102e'; ctx.font = '900 82px "Helvetica Neue", Arial, sans-serif'; ctx.fillText( 'WATER ICE', W / 2, H * 0.36 );
		ctx.fillStyle = '#1c3f94'; ctx.font = '700 44px "Helvetica Neue", Arial, sans-serif'; ctx.fillText( 'CHERRY  •  LEMON  •  MANGO', W / 2, H * 0.72 );

	} );
	// 1: cotton candy, lemonade, popcorn
	row( 1, ( W, H ) => {

		ctx.fillStyle = '#f7d117'; ctx.fillRect( 0, 0, W, H );
		ctx.fillStyle = '#c8102e'; ctx.font = '900 64px "Helvetica Neue", Arial, sans-serif'; ctx.fillText( 'COTTON CANDY', W / 2, H * 0.3 );
		ctx.fillText( 'LEMONADE • POPCORN', W / 2, H * 0.7, W - 40 );

	} );
	// 2: bottled beer
	row( 2, ( W, H ) => {

		ctx.fillStyle = '#1a1a1a'; ctx.fillRect( 0, 0, W, H );
		ctx.fillStyle = '#f2c230'; ctx.font = '900 80px "Helvetica Neue", Arial, sans-serif'; ctx.fillText( 'ICE COLD BEER', W / 2, H * 0.4 );
		ctx.fillStyle = '#ffffff'; ctx.font = '700 40px "Helvetica Neue", Arial, sans-serif'; ctx.fillText( 'MUST BE 21  •  ID REQUIRED', W / 2, H * 0.76 );

	} );
	// 3: the ATM's face: Citizens Bank's green, the white logo
	row( 3, ( W, H ) => {

		ctx.fillStyle = '#00843d'; ctx.fillRect( 0, 0, W, H );
		ctx.save(); ctx.translate( W * 0.2, H / 2 );
		ctx.fillStyle = '#ffffff';
		for ( let k = 0; k < 8; k ++ ) {

			ctx.rotate( Math.PI / 4 );
			ctx.beginPath(); ctx.moveTo( 16, - 9 ); ctx.lineTo( 52, 0 ); ctx.lineTo( 16, 9 ); ctx.fill();

		}

		ctx.restore();
		ctx.fillStyle = '#ffffff'; ctx.font = '600 70px "Frutiger", "Myriad Pro", "Segoe UI", sans-serif'; ctx.fillText( 'Citizens Bank', W * 0.62, H * 0.42 );
		ctx.font = '700 44px "Helvetica Neue", Arial, sans-serif'; ctx.fillText( 'ATM', W * 0.62, H * 0.78 );

	} );
	// 4: the programs and towels stand
	row( 4, ( W, H ) => {

		ctx.fillStyle = '#1c3f94'; ctx.fillRect( 0, 0, W, H );
		ctx.fillStyle = '#ffffff'; ctx.font = '900 62px "Helvetica Neue", Arial, sans-serif'; ctx.fillText( 'WORLD SERIES PROGRAMS', W / 2, H * 0.36, W - 30 );
		ctx.fillStyle = '#f2c230'; ctx.font = '800 50px "Helvetica Neue", Arial, sans-serif'; ctx.fillText( '$15  •  RALLY TOWELS', W / 2, H * 0.74 );

	} );
	// 5: AROUND the BASES (red, blue, and white baseball letters; the 2004 photo) on the green Citizens Bank band
	row( 5, ( W, H ) => {

		ctx.fillStyle = '#0b6b3a'; ctx.fillRect( 0, 0, W, H * 0.34 );
		ctx.fillStyle = '#ffffff'; ctx.font = '600 58px "Frutiger", "Myriad Pro", sans-serif'; ctx.fillText( 'Citizens Bank', W / 2, H * 0.18 );
		ctx.fillStyle = '#c8102e'; ctx.font = '900 96px Impact, "Arial Black", sans-serif'; ctx.fillText( 'AROUND', W * 0.2, H * 0.68 );
		ctx.fillStyle = '#1c3f94'; ctx.font = 'italic 800 70px Georgia, serif'; ctx.fillText( 'the', W * 0.42, H * 0.7 );
		for ( const [ i, ch ] of [ ...'BASES' ].entries() ) {

			const x = W * ( 0.56 + i * 0.09 );
			ctx.fillStyle = '#f7f5ee'; ctx.beginPath(); ctx.arc( x, H * 0.68, 44, 0, Math.PI * 2 ); ctx.fill();
			ctx.strokeStyle = '#c8102e'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc( x - 30, H * 0.68, 30, - 0.9, 0.9 ); ctx.stroke();
			ctx.fillStyle = '#1c3f94'; ctx.font = '900 56px "Arial Black", sans-serif'; ctx.fillText( ch, x, H * 0.7 );

		}

	} );
	// 9: the medallions, four across
	for ( let i = 0; i < 4; i ++ ) {

		ctx.save();
		ctx.translate( i * 256 + 128, 9 * 256 + 128 );
		ctx.fillStyle = [ '#c8102e', '#1c3f94', '#f4f1ea', '#00843d' ][ i ]; ctx.beginPath(); ctx.arc( 0, 0, 118, 0, Math.PI * 2 ); ctx.fill();
		ctx.strokeStyle = '#f2c230'; ctx.lineWidth = 10; ctx.stroke();
		ctx.fillStyle = i === 2 ? '#1c3f94' : '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
		ctx.font = [ 'italic 900 150px Georgia, serif', '900 60px "Helvetica Neue", Arial, sans-serif', '800 40px Georgia, serif', '600 38px "Frutiger", "Myriad Pro", sans-serif' ][ i ];
		ctx.fillText( [ 'P', '1980', 'LIBERTY', 'Citizens' ][ i ], 0, i === 0 ? 8 : 0 );
		if ( i === 1 ) { ctx.font = '700 22px "Helvetica Neue", Arial, sans-serif'; ctx.fillText( 'WORLD CHAMPIONS', 0, 50 ); }
		if ( i === 2 ) { ctx.font = '700 30px Georgia, serif'; ctx.fillText( 'BELL', 0, 44 ); }
		ctx.restore();

	}

	// 8: funnel cake
	row( 8, ( W, H ) => {

		ctx.fillStyle = '#f3e3c3'; ctx.fillRect( 0, 0, W, H );
		ctx.fillStyle = '#8a3b12'; ctx.font = 'italic 800 96px Georgia, serif'; ctx.fillText( 'Funnel Cakes', W / 2, H * 0.4 );
		ctx.fillStyle = '#c8102e'; ctx.font = '700 40px "Helvetica Neue", Arial, sans-serif'; ctx.fillText( 'POWDERED SUGAR  \u2022  HOT & FRESH', W / 2, H * 0.78 );

	} );
	// 6-7: the board's face: a green field, the diamond, lights round the bases (two rows tall)
	ctx.save();
	ctx.translate( 0, 6 * 256 );
	ctx.fillStyle = '#1e7a3a'; ctx.fillRect( 0, 0, w, 512 );
	ctx.strokeStyle = '#f4f1ea'; ctx.lineWidth = 14; ctx.strokeRect( 10, 10, w - 20, 492 );
	ctx.save(); ctx.translate( w / 2, 270 ); ctx.rotate( Math.PI / 4 );
	ctx.fillStyle = '#b8743a'; ctx.fillRect( - 150, - 150, 300, 300 );
	ctx.fillStyle = '#2a8a44'; ctx.fillRect( - 120, - 120, 240, 240 );
	ctx.fillStyle = '#ffffff';
	for ( const [ x, y ] of [ [ - 150, - 150 ], [ 150, - 150 ], [ 150, 150 ], [ - 150, 150 ] ] ) ctx.fillRect( x - 18, y - 18, 36, 36 );
	ctx.restore();
	ctx.fillStyle = '#b8743a'; ctx.beginPath(); ctx.arc( w / 2, 270, 34, 0, Math.PI * 2 ); ctx.fill();
	ctx.fillStyle = '#ffffff'; ctx.fillRect( w / 2 - 10, 266, 20, 6 );
	for ( let k = 0; k < 28; k ++ ) {

		const a = k / 28 * Math.PI * 2;
		ctx.fillStyle = k % 2 ? '#ffe680' : '#ffffff';
		ctx.beginPath(); ctx.arc( w / 2 + Math.cos( a ) * 225, 270 + Math.sin( a ) * 225, 8, 0, Math.PI * 2 ); ctx.fill();

	}

	ctx.restore();

}

export class Fair {

	constructor( { parent, folk, zFront, gamesAt, carts, cans, atm } ) {

		const q = new Quads();
		const u = ( pal ) => [ ( pal + 0.5 ) / PAL.length, 0.5 ];
		const Y = STREET;
		// an axis-aligned box, one palette colour
		const kbox = ( x0, x1, y0, y1, z0, z1, pal ) => {

			const U = u( pal );
			const Pp = ( i, j, k ) => [ i ? x1 : x0, Y + ( j ? y1 : y0 ), k ? z1 : z0 ];
			const f = ( a, b, c, d, n ) => {

				q.tri( a, b, c, n, U, U, U );
				q.tri( a, c, d, n, U, U, U );

			};

			f( Pp( 0, 0, 1 ), Pp( 1, 0, 1 ), Pp( 1, 1, 1 ), Pp( 0, 1, 1 ), [ 0, 0, 1 ] );
			f( Pp( 1, 0, 0 ), Pp( 0, 0, 0 ), Pp( 0, 1, 0 ), Pp( 1, 1, 0 ), [ 0, 0, - 1 ] );
			f( Pp( 1, 0, 1 ), Pp( 1, 0, 0 ), Pp( 1, 1, 0 ), Pp( 1, 1, 1 ), [ 1, 0, 0 ] );
			f( Pp( 0, 0, 0 ), Pp( 0, 0, 1 ), Pp( 0, 1, 1 ), Pp( 0, 1, 0 ), [ - 1, 0, 0 ] );
			f( Pp( 0, 1, 1 ), Pp( 1, 1, 1 ), Pp( 1, 1, 0 ), Pp( 0, 1, 0 ), [ 0, 1, 0 ] );

		};

		// a sign from the atlas: row r (of 8), a quad facing +z (or +x) from ( x, y ) w x h
		const sq = new Quads();
		const sign = ( r, x0, x1, y0, y1, z, rows = 1, faceX = false ) => {

			const v0 = r / 10, v1 = ( r + rows ) / 10;
			const A = faceX ? [ z, Y + y0, x0 ] : [ x0, Y + y0, z ], B = faceX ? [ z, Y + y0, x1 ] : [ x1, Y + y0, z ], C = faceX ? [ z, Y + y1, x1 ] : [ x1, Y + y1, z ], D = faceX ? [ z, Y + y1, x0 ] : [ x0, Y + y1, z ];
			const n = faceX ? [ 1, 0, 0 ] : [ 0, 0, 1 ];
			sq.tri( A, B, C, n, [ 0, v1 ], [ 1, v1 ], [ 1, v0 ] );
			sq.tri( A, C, D, n, [ 0, v1 ], [ 1, v0 ], [ 0, v0 ] );

		};

		this.people = [];
		const F = folk;
		// ---- the carts: a steel box on wheels, the board across its front, a striped umbrella or awning
		for ( const [ i, [ x, z, kind ] ] of carts.entries() ) {

			const pal = [ P.white, P.yellow, P.black, P.blue, P.cream ][ kind ];
			kbox( x - 1.0, x + 1.0, 0.2, 1.0, z - 0.45, z + 0.45, pal );
			kbox( x - 1.02, x + 1.02, 1.0, 1.04, z - 0.47, z + 0.47, P.steel );
			for ( const wx of [ x - 0.75, x + 0.75 ] ) kbox( wx - 0.05, wx + 0.05, 0, 0.3, z - 0.5, z + 0.5, P.black );
			sign( [ 0, 1, 2, 4, 8 ][ kind ], x - 0.95, x + 0.95, 0.35, 0.95, z + 0.46 );
			// the awning over it on four poles
			for ( const [ ax, az ] of [ [ - 0.95, - 0.4 ], [ 0.95, - 0.4 ], [ - 0.95, 0.4 ], [ 0.95, 0.4 ] ] ) kbox( x + ax - 0.02, x + ax + 0.02, 1.04, 2.2, z + az - 0.02, z + az + 0.02, P.steel );
			for ( let s = 0; s < 6; s ++ ) kbox( x - 1.15 + s * 0.383, x - 1.15 + ( s + 1 ) * 0.383, 2.2, 2.26, z - 0.65, z + 0.65, s % 2 ? P.white : [ P.red, P.red, P.blue, P.red, P.orange ][ kind ] );
			// the cart man behind it, a customer or two in front
			const man = F.add( 'serve', { x, y: Y, z: z - 0.85, yaw: Math.PI, look: { top: TOP.staff, hat: HAT.staffCap, pants: PANTS.black, open: true }, nights: 3 } );
			this.people.push( { p: man, role: 'vendor', phase: i * 1.7 } );
			const cust = F.add( 'serve', { x: x + 0.3, y: Y, z: z + 0.95, yaw: 0, look: { top: [ TOP.redHoodie, TOP.wsShirt, TOP.parka ][ i % 3 ], hat: HAT.cap, woman: i % 2 === 1, open: true }, nights: i % 2 ? 2 : 3 } );
			this.people.push( { p: cust, role: 'customer', phase: i * 1.7 } );
			if ( kind === 0 ) F.hold( cust, 'cup', { hand: 'right', variant: 1 } );

		}

		// ---- the trash cans: red with the Phillies' white P, a blue recycling bin beside some
		for ( const [ i, [ x, z ] ] of cans.entries() ) {

			kbox( x - 0.28, x + 0.28, 0, 0.95, z - 0.28, z + 0.28, P.red );
			kbox( x - 0.3, x + 0.3, 0.95, 1.0, z - 0.3, z + 0.3, P.black );
			if ( i % 2 === 0 ) {

				kbox( x + 0.4, x + 0.92, 0, 0.9, z - 0.26, z + 0.26, P.blue );
				kbox( x + 0.38, x + 0.94, 0.9, 0.95, z - 0.28, z + 0.28, P.blue );

			}

		}

		// ---- the ATM: a green kiosk, the screen and the keypad lit
		if ( atm ) {

			const [ x, z ] = atm;
			kbox( x - 0.6, x + 0.6, 0, 2.2, z - 0.4, z + 0.4, P.green );
			kbox( x - 0.35, x + 0.35, 1.2, 1.55, z + 0.4, z + 0.42, P.screen );
			kbox( x - 0.3, x + 0.3, 0.95, 1.1, z + 0.4, z + 0.5, P.steel );
			sign( 3, x - 0.6, x + 0.6, 1.7, 2.15, z + 0.41 );
			// a man at it, back to us, getting cash for the seventh-inning beer
			const p = F.add( 'serve', { x, y: Y, z: z + 0.95, yaw: 0, look: { top: TOP.leather, hat: HAT.cap }, nights: 2, k: 0.4 } );
			this.people.push( { p, role: 'atm', phase: 0 } );

		}

		// ---- the Games of Baseball: the board on its steel frame against the building's end, the kids' lanes
		if ( gamesAt ) {

			const [ gx, gz ] = gamesAt; // the board's foot, facing +z
			// the maroon steel frame: two legs, braces
			for ( const lx of [ gx - 2.2, gx + 2.2 ] ) {

				kbox( lx - 0.15, lx + 0.15, 0, 4.2, gz - 1.2, gz - 0.9, P.maroon );
				kbox( lx - 0.1, lx + 0.1, 0, 3.4, gz - 0.2, gz + 0.0, P.maroon );

			}

			// the board: a slab tilted toward the Alley, its face drawn
			const tiltTop = gz - 0.9, tiltBot = gz + 0.2, y0 = 2.0, y1 = 5.6;
			const A = [ gx - 2.6, Y + y0, tiltBot ], B = [ gx + 2.6, Y + y0, tiltBot ], C = [ gx + 2.6, Y + y1, tiltTop ], D = [ gx - 2.6, Y + y1, tiltTop ];
			const n = [ 0, ( tiltBot - tiltTop ) / 3.77, ( y1 - y0 ) / 3.77 ];
			sq.tri( A, B, C, n, [ 0, 0.8 ], [ 1, 0.8 ], [ 1, 0.6 ] );
			sq.tri( A, C, D, n, [ 0, 0.8 ], [ 1, 0.6 ], [ 0, 0.6 ] );
			kbox( gx - 2.7, gx + 2.7, y0 - 0.15, y0, tiltBot - 0.2, tiltBot + 0.1, P.white );
			// AROUND the BASES and the green band over it
			sign( 5, gx - 3.2, gx + 3.2, 5.7, 7.1, tiltTop - 0.1 );
			// the round medallions round the board (the 2004 photo): the Phillies, 1980, the Bell, the bank
			for ( const [ i, mx, my ] of [ [ 0, gx - 3.3, 4.9 ], [ 1, gx + 3.3, 4.9 ], [ 2, gx - 3.5, 3.0 ], [ 3, gx + 3.5, 3.0 ] ] ) {

				const A = [ mx - 0.55, Y + my - 0.55, tiltTop + 0.35 ], B = [ mx + 0.55, Y + my - 0.55, tiltTop + 0.35 ], C = [ mx + 0.55, Y + my + 0.55, tiltTop + 0.35 ], D = [ mx - 0.55, Y + my + 0.55, tiltTop + 0.35 ];
				sq.tri( A, B, C, [ 0, 0, 1 ], [ i / 4, 1 ], [ ( i + 1 ) / 4, 1 ], [ ( i + 1 ) / 4, 0.9 ] );
				sq.tri( A, C, D, [ 0, 0, 1 ], [ i / 4, 1 ], [ ( i + 1 ) / 4, 0.9 ], [ i / 4, 0.9 ] );

			}
			// the kids' track: four lanes, low rails, a pad at each end
			for ( let l = 0; l <= 4; l ++ ) {

				// a padded top rail on posts between the lanes
				const lz = gz + 1.2 + l * 0.9;
				kbox( gx - 3.4, gx + 3.4, 0.62, 0.7, lz - 0.04, lz + 0.04, P.blue );
				for ( let px = gx - 3.4; px <= gx + 3.41; px += 1.7 ) kbox( px - 0.03, px + 0.03, 0, 0.62, lz - 0.03, lz + 0.03, P.steel );

			}
			kbox( gx - 3.4, gx + 3.4, 0, 0.02, gz + 1.2, gz + 4.8, P.turf );
			for ( let l = 0; l < 4; l ++ ) for ( const bx of [ gx - 3.2, gx + 3.0 ] ) kbox( bx, bx + 0.25, 0.02, 0.06, gz + 1.5 + l * 0.9, gz + 1.75 + l * 0.9, P.white );
			// a family on it: the kids racing, dad watching with the camera, mom with the bag
			this.kids = [];
			for ( let l = 0; l < 3; l ++ ) {

				const k = F.add( 'walk', { x: gx - 3.0, y: Y, z: gz + 1.65 + l * 0.9, yaw: - Math.PI / 2, look: { top: [ TOP.kidRed, TOP.homeJersey, TOP.redHoodie ][ l ], jersey: l === 1 ? 'HOWARD' : undefined, hat: l === 2 ? HAT.none : HAT.cap, kid: true }, nights: 2 } );
				this.kids.push( { p: k, lane: l, x0: gx - 3.0, x1: gx + 3.0 } );

			}

			const dad = F.add( 'photo', { x: gx + 4.2, y: Y, z: gz + 3.0, yaw: Math.PI / 2 + 0.3, look: { top: TOP.carhartt, hat: HAT.cap, beard: true }, nights: 2 } );
			F.hold( dad, 'camera', { hand: 'both', variant: 0 } );
			const mom = F.add( 'idle', { x: gx + 3.9, y: Y, z: gz + 4.2, yaw: Math.PI / 2, look: { top: TOP.redJacket, woman: true, hat: HAT.none }, nights: 2 } );
			F.hold( mom, 'bag', { hand: 'left' } );
			// the Citizens "ballpark banker" in green, cheering them on
			const banker = F.add( 'cheer', { x: gx - 4.2, y: Y, z: gz + 3.0, yaw: - Math.PI / 2 - 0.3, look: { top: TOP.eagles, hat: HAT.cap, woman: true }, nights: 3 } );
			this.people.push( { p: banker, role: 'banker', phase: 0.5 } );

		}

		const tex = canvasTexture( 1024, 2560, drawFair, 'alleyFair' );
		const mat = standard( { name: 'alley-fair', roughness: 0.5,
			surface: /* wgsl */`
	let k = i32( in.uv.x * ${ PAL.length }.0 );
	var c = vec3f( 0.5 ); var r = 0.5; var mt = 0.0; var e = vec3f( 0.0 );
	let night = smoothstep( 0.2, 0.8, frame.night );
	switch k {
		case 0: { c = vec3f( 0.42, 0.02, 0.03 ); r = 0.4; }
		case 1: { c = vec3f( 0.78, 0.77, 0.74 ); r = 0.5; }
		case 2: { c = vec3f( 0.02, 0.07, 0.3 ); r = 0.45; }
		case 3: { c = vec3f( 0.0, 0.22, 0.06 ); r = 0.35; }
		case 4: { c = vec3f( 0.12, 0.03, 0.03 ); r = 0.55; mt = 0.4; }
		case 5: { c = vec3f( 0.8, 0.6, 0.02 ); r = 0.45; }
		case 6: { c = vec3f( 0.5, 0.51, 0.52 ); r = 0.3; mt = 0.8; }
		case 7: { c = vec3f( 0.02 ); r = 0.5; }
		case 9: { c = vec3f( 0.8, 0.3, 0.02 ); }
		case 10: { c = vec3f( 0.02, 0.05, 0.08 ); r = 0.1; e = vec3f( 0.2, 0.5, 0.8 ) * 0.8; }
		case 11: { c = vec3f( 0.05, 0.16, 0.04 ); r = 0.9; }
		default: { c = vec3f( 0.6, 0.55, 0.45 ); }
	}
	s.albedo = c; s.roughness = r; s.metalness = mt; s.emissive = e + c * night * 0.15;
` } );
		const signMat = standard( { name: 'alley-fair-signs', roughness: 0.4, alphaTest: 0.5, textures: { bpFair: tex }, side: 'double',
			surface: 'let ta = textureSample( bpFair, smpAnisoClamp, in.uv ); let t = ta.rgb; s.alpha = ta.a; s.albedo = t * 0.7; s.emissive = t * mix( 0.12, 0.7, smoothstep( 0.2, 0.8, frame.night ) );' } );
		for ( const m of [ mat, signMat ] ) m.underwaterLighting = 'none';
		const km = new Mesh( q.geometry(), mat );
		km.name = 'alley-fair';
		km.castShadow = true;
		km.receiveShadow = true;
		parent.add( km );
		const sm = new Mesh( sq.geometry(), signMat );
		sm.name = 'alley-fair-signs';
		sm.receiveShadow = true;
		parent.add( sm );
		void zFront;
		void beam;

	}

	update( dt, w, now ) {

		for ( const { p, role, phase } of this.people ) {

			if ( role === 'vendor' ) p.k = Math.max( 0, Math.sin( now * 0.8 + phase ) );
			else if ( role === 'customer' ) p.k = Math.max( 0, Math.sin( now * 0.8 + phase - 0.6 ) );
			else if ( role === 'banker' ) p.k = 0.4 + 0.4 * Math.sin( now * 3 );
			else if ( role === 'atm' ) p.k = 0.5 + 0.2 * Math.sin( now * 2 );

		}

		// the kids race the length of the track and back, the littlest one behind
		for ( const K of this.kids || [] ) {

			const speed = 2.6 - K.lane * 0.35, span = K.x1 - K.x0;
			const d = ( now * speed + K.lane * 1.3 ) % ( 2 * span );
			const fwd = d < span;
			K.p.x = K.x0 + ( fwd ? d : 2 * span - d );
			K.p.yaw = fwd ? - Math.PI / 2 : Math.PI / 2;
			K.p.k = 0.5 + 0.5 * Math.sin( now * speed * 5 );

		}

	}

}
