import { Mesh, BufferGeometry, Float32BufferAttribute } from '../../engine/index.js';
import { standard } from '../../materials/Materials.js';
import { commonModule } from '../../engine/render/wgsl/common.js';
import { canvasTexture } from '../geo.js';
import { LEVELS } from '../layout.js';
import { drawAtlas2, CELLS2, ATLAS2 } from './Concourse3BSigns.js';

// The third base concourse's things on the floor (Concourse3B.js), all in one draw: the trash cans and
// the recycling bins, the condiment stations, the carts, the signs. A vertex's uv carries either a
// palette entry (uv.x < 100: its colour, gloss and glow) or a place in the atlas of printed things (uv
// offset by 100: the cans' wraps, the carts' signs), so plain and printed share one material.
const STREET = LEVELS.mainConcourse;

// [ name, linear albedo, roughness, metalness, glow ]
export const PALETTE = [
	[ 'canRed', [ 0.33, 0.018, 0.024 ], 0.42, 0 ], [ 'canBlue', [ 0.02, 0.07, 0.28 ], 0.42, 0 ], [ 'lid', [ 0.02, 0.02, 0.022 ], 0.5, 0 ],
	[ 'steel', [ 0.55, 0.56, 0.57 ], 0.28, 0.9 ], [ 'ketchup', [ 0.45, 0.02, 0.012 ], 0.3, 0 ], [ 'mustard', [ 0.72, 0.5, 0.02 ], 0.3, 0 ],
	[ 'relish', [ 0.07, 0.3, 0.04 ], 0.3, 0 ], [ 'onion', [ 0.7, 0.68, 0.6 ], 0.8, 0 ], [ 'napkin', [ 0.8, 0.79, 0.76 ], 0.9, 0 ],
	[ 'bag', [ 0.01, 0.01, 0.012 ], 0.25, 0 ], [ 'liner', [ 0.45, 0.45, 0.47 ], 0.2, 0 ], [ 'cup', [ 0.8, 0.78, 0.74 ], 0.4, 0 ],
	[ 'cardboard', [ 0.42, 0.29, 0.16 ], 0.85, 0 ], [ 'cartRed', [ 0.38, 0.02, 0.03 ], 0.32, 0.1 ], [ 'chrome', [ 0.8, 0.8, 0.82 ], 0.15, 1 ],
	[ 'grey', [ 0.2, 0.2, 0.21 ], 0.6, 0 ], [ 'rubber', [ 0.015, 0.015, 0.016 ], 0.8, 0 ], [ 'yellow', [ 0.78, 0.56, 0.02 ], 0.4, 0 ],
	[ 'lamp', [ 0.8, 0.78, 0.72 ], 0.5, 0, [ 1.0, 0.86, 0.66 ] ], [ 'redLamp', [ 0.4, 0.05, 0.02 ], 0.4, 0, [ 1.0, 0.25, 0.08 ] ], [ 'green', [ 0.05, 0.3, 0.08 ], 0.5, 0 ],
	[ 'floss', [ 0.8, 0.35, 0.5 ], 1.0, 0, [ 0.1, 0.03, 0.05 ] ], [ 'cherry', [ 0.6, 0.03, 0.05 ], 0.3, 0 ], [ 'lemon', [ 0.75, 0.62, 0.08 ], 0.3, 0 ],
	[ 'blueIce', [ 0.1, 0.3, 0.7 ], 0.3, 0 ], [ 'cocoa', [ 0.12, 0.06, 0.03 ], 0.3, 0 ], [ 'glass', [ 0.04, 0.05, 0.06 ], 0.05, 0.3 ],
	[ 'wood', [ 0.3, 0.18, 0.09 ], 0.7, 0 ], [ 'enamel', [ 0.72, 0.71, 0.68 ], 0.4, 0 ], [ 'navy', [ 0.012, 0.02, 0.06 ], 0.5, 0 ],
	[ 'foil', [ 0.7, 0.7, 0.72 ], 0.25, 1 ], [ 'popcorn', [ 0.85, 0.7, 0.35 ], 0.8, 0, [ 0.3, 0.22, 0.08 ] ], [ 'screen', [ 0.02, 0.03, 0.03 ], 0.2, 0, [ 0.12, 0.5, 0.3 ] ],
	[ 'beer', [ 0.55, 0.33, 0.04 ], 0.1, 0 ], [ 'foam', [ 0.75, 0.72, 0.62 ], 0.9, 0 ], [ 'white', [ 0.72, 0.71, 0.68 ], 0.7, 0 ],
	[ 'redPlastic', [ 0.4, 0.02, 0.03 ], 0.45, 0 ], [ 'paper', [ 0.66, 0.64, 0.58 ], 0.95, 0 ], [ 'darkWet', [ 0.05, 0.05, 0.05 ], 0.15, 0 ],
	[ 'sage', [ 0.2, 0.28, 0.17 ], 0.75, 0 ], [ 'postYellow', [ 0.7, 0.52, 0.04 ], 0.45, 0.2 ],
];
export const PAL = Object.fromEntries( PALETTE.map( ( p, i ) => [ p[ 0 ], i ] ) );
const f3 = ( c ) => `vec3f( ${ c.map( ( v ) => v.toFixed( 3 ) ).join( ', ' ) } )`;

// The printed things: named rectangles in the atlas (pixels), drawn once
const ATLAS = 1024;
const CELLS = {
	canRed: [ 0, 0, 512, 128 ], canBlue: [ 0, 128, 512, 128 ], condiments: [ 512, 0, 512, 64 ], canLid: [ 512, 64, 128, 128 ],
	waterIce: [ 0, 256, 512, 128 ], cottonCandy: [ 512, 256, 512, 128 ], cocoaCart: [ 0, 384, 512, 128 ], nachos: [ 512, 384, 512, 128 ],
	programs: [ 0, 512, 512, 128 ], program: [ 640, 64, 128, 170 ], beerCart: [ 512, 512, 512, 128 ],
};

function drawAtlas() {

	return canvasTexture( ATLAS, ATLAS, ( ctx ) => {

		const sans = '"Helvetica Neue", Helvetica, Arial, sans-serif', serif = 'Georgia, "Times New Roman", serif';
		const script = 'italic 700 {s}px "Brush Script MT", "Snell Roundhand", Georgia, serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		const rect = ( k ) => CELLS[ k ];
		// the red can's wrap: Phillies red, the script in white twice round, a pinstripe band top and bottom
		{

			const [ x, y, w, h ] = rect( 'canRed' );
			ctx.fillStyle = '#b3121b';
			ctx.fillRect( x, y, w, h );
			ctx.fillStyle = '#ffffff';
			ctx.fillRect( x, y + 8, w, 5 ); ctx.fillRect( x, y + h - 13, w, 5 );
			ctx.fillStyle = '#0b2a5b';
			ctx.fillRect( x, y + 14, w, 2 ); ctx.fillRect( x, y + h - 16, w, 2 );
			ctx.font = script.replace( '{s}', 54 );
			for ( const cx of [ x + w * 0.25, x + w * 0.75 ] ) {

				ctx.save();
				ctx.translate( cx, y + h / 2 + 2 );
				ctx.rotate( - 0.1 );
				ctx.fillStyle = '#0b2a5b';
				ctx.fillText( 'Phillies', 2, 2, w / 2 - 30 );
				ctx.fillStyle = '#ffffff';
				ctx.fillText( 'Phillies', 0, 0, w / 2 - 30 );
				ctx.restore();

			}

			// scuffs and a drip down from the rim
			ctx.fillStyle = 'rgba( 0, 0, 0, 0.12 )';
			for ( let i = 0; i < 40; i ++ ) ctx.fillRect( x + Math.random() * w, y + h * 0.55 + Math.random() * h * 0.4, 2 + Math.random() * 10, 1 );

		}

		// the blue bin: RECYCLE, the arrows, BOTTLES & CANS
		{

			const [ x, y, w, h ] = rect( 'canBlue' );
			ctx.fillStyle = '#0d3b8c';
			ctx.fillRect( x, y, w, h );
			for ( const cx of [ x + w * 0.25, x + w * 0.75 ] ) {

				// the chasing arrows
				ctx.strokeStyle = '#ffffff';
				ctx.lineWidth = 6;
				for ( let k = 0; k < 3; k ++ ) {

					const a0 = k * 2.094 + 0.3, a1 = a0 + 1.5;
					ctx.beginPath();
					ctx.arc( cx - 70, y + h / 2, 22, a0, a1 );
					ctx.stroke();
					const ex = cx - 70 + Math.cos( a1 ) * 22, ey = y + h / 2 + Math.sin( a1 ) * 22;
					ctx.fillStyle = '#ffffff';
					ctx.beginPath(); ctx.moveTo( ex + Math.cos( a1 + 1.57 ) * 8, ey + Math.sin( a1 + 1.57 ) * 8 ); ctx.lineTo( ex + Math.cos( a1 ) * 9, ey + Math.sin( a1 ) * 9 ); ctx.lineTo( ex - Math.cos( a1 ) * 9, ey - Math.sin( a1 ) * 9 ); ctx.fill();

				}

				ctx.fillStyle = '#ffffff';
				ctx.font = `900 30px ${ sans }`;
				ctx.fillText( 'RECYCLE', cx + 30, y + h / 2 - 16, 150 );
				ctx.font = `700 16px ${ sans }`;
				ctx.fillText( 'BOTTLES & CANS', cx + 30, y + h / 2 + 16, 150 );

			}

		}

		// the condiment station's header
		{

			const [ x, y, w, h ] = rect( 'condiments' );
			ctx.fillStyle = '#1b1b1d';
			ctx.fillRect( x, y, w, h );
			ctx.fillStyle = '#c8102e';
			ctx.fillRect( x, y, w, 6 );
			ctx.fillStyle = '#f2efe6';
			ctx.font = `800 30px ${ sans }`;
			ctx.fillText( 'CONDIMENTS', x + w / 2, y + h / 2 + 3, w - 40 );

		}

		// a can's lid from above: the swing flap
		{

			const [ x, y, w, h ] = rect( 'canLid' );
			ctx.fillStyle = '#0c0c0e';
			ctx.fillRect( x, y, w, h );
			ctx.fillStyle = '#1e1e21';
			ctx.beginPath(); ctx.arc( x + w / 2, y + h / 2, w * 0.46, 0, Math.PI * 2 ); ctx.fill();
			ctx.fillStyle = '#050505';
			ctx.fillRect( x + w * 0.22, y + h * 0.3, w * 0.56, h * 0.3 );

		}

		// the carts' signs: water ice, cotton candy, hot chocolate and coffee, nachos, programs, beer
		const cartSign = ( k, bg, fg, title, line, font = sans, italic = false ) => {

			const [ x, y, w, h ] = rect( k );
			const g = ctx.createLinearGradient( 0, y, 0, y + h );
			g.addColorStop( 0, bg[ 0 ] ); g.addColorStop( 1, bg[ 1 ] );
			ctx.fillStyle = g;
			ctx.fillRect( x, y, w, h );
			ctx.fillStyle = fg[ 1 ];
			ctx.fillRect( x, y + 6, w, 3 ); ctx.fillRect( x, y + h - 9, w, 3 );
			ctx.fillStyle = fg[ 0 ];
			ctx.font = `${ italic ? 'italic ' : '' }800 48px ${ font }`;
			ctx.fillText( title, x + w / 2, y + h * 0.42, w - 40 );
			ctx.font = `700 19px ${ sans }`;
			ctx.fillStyle = fg[ 1 ];
			ctx.fillText( line, x + w / 2, y + h * 0.78, w - 40 );

		};

		cartSign( 'waterIce', [ '#c8102e', '#8e0b1f' ], [ '#ffffff', '#ffd23f' ], 'WATER ICE', 'CHERRY  ·  LEMON  ·  BLUE RASPBERRY   $4.00', serif, true );
		cartSign( 'cottonCandy', [ '#c8102e', '#8e0b1f' ], [ '#ffffff', '#ffd6e8' ], 'COTTON CANDY', 'LEMONADE  ·  POPCORN   $4.50', serif, true );
		cartSign( 'cocoaCart', [ '#3b2314', '#24150b' ], [ '#f2d7a0', '#e8b04a' ], 'HOT CHOCOLATE', 'COFFEE  ·  TEA  ·  HOT CHOCOLATE   $3.00', serif );
		cartSign( 'nachos', [ '#c8102e', '#8e0b1f' ], [ '#ffffff', '#ffd23f' ], 'NACHOS', 'NACHOS $4.75  ·  WITH JALAPEÑOS  ·  BOTTLED WATER', sans );
		cartSign( 'programs', [ '#0b2a5b', '#071a3a' ], [ '#ffffff', '#e8b04a' ], 'PROGRAMS', 'OFFICIAL 2008 WORLD SERIES PROGRAM   $15', sans );
		cartSign( 'beerCart', [ '#1f3d2a', '#122518' ], [ '#efe2bf', '#c9a45a' ], 'COLD BEER', 'YUENGLING  ·  BUD LIGHT  ·  MILLER LITE   $7.00', serif );
		// the 2008 World Series program's cover (the photos from Game 4 and Game 5): black, Utley (26) on the
		// left and Longoria on the right, the Fall Classic logo, PHILADELPHIA PHILLIES VS. TAMPA BAY
		// RAYS, $15 printed on it
		{

			const [ x, y, w, h ] = rect( 'program' );
			ctx.fillStyle = '#0b0b0c';
			ctx.fillRect( x, y, w, h );
			ctx.fillStyle = '#c9a45a';
			ctx.fillRect( x + 6, y + 6, w - 12, 3 );
			ctx.font = `800 17px ${ sans }`;
			ctx.fillText( '2008', x + w / 2, y + 26 );
			ctx.font = `800 21px ${ serif }`;
			ctx.fillText( 'WORLD', x + w / 2, y + 52 );
			ctx.fillText( 'SERIES', x + w / 2, y + 74 );
			// the two players, in their clubs' whites and navy, the numbers
			ctx.fillStyle = '#ecebe7';
			ctx.fillRect( x + w * 0.12, y + 96, w * 0.32, 44 );
			ctx.fillStyle = '#c8102e'; ctx.font = `800 16px ${ serif }`;
			ctx.fillText( '26', x + w * 0.28, y + 120 );
			ctx.fillStyle = '#e7e8ea';
			ctx.fillRect( x + w * 0.56, y + 96, w * 0.32, 44 );
			ctx.fillStyle = '#0b2a5b';
			ctx.fillText( '3', x + w * 0.72, y + 120 );
			ctx.fillStyle = '#ffffff';
			ctx.font = `700 7px ${ sans }`;
			ctx.fillText( 'PHILLIES VS. RAYS', x + w / 2, y + 148, w - 12 );
			ctx.font = `800 10px ${ sans }`;
			ctx.fillText( '$15', x + w - 16, y + 160 );

		}

	}, 'concourse3bAtlas' );

}

// the uv of a place in the atlas (offset by 100: the shader's sign that it's printed)
function atlasUV( k, u, v ) {

	if ( CELLS2[ k ] ) {

		// the banners' and signs' atlas: offset by 200
		const [ x, y, w, h ] = CELLS2[ k ];
		return [ 200 + ( x + u * w ) / ATLAS2[ 0 ], 200 + ( y + v * h ) / ATLAS2[ 1 ] ];

	}

	const [ x, y, w, h ] = CELLS[ k ];
	return [ 100 + ( x + u * w ) / ATLAS, 100 + ( y + v * h ) / ATLAS ];

}

function propsMaterial( atlas, atlas2 ) {

	const mat = standard( {
		name: 'concourse3b-props', roughness: 0.5, modules: [ commonModule ], textures: { c3bAtlas: atlas, c3bAtlas2: atlas2 },
		surface: /* wgsl */`
	var alb = array<vec3f, ${ PALETTE.length }>( ${ PALETTE.map( ( p ) => f3( p[ 1 ] ) ).join( ', ' ) } );
	var rm = array<vec2f, ${ PALETTE.length }>( ${ PALETTE.map( ( p ) => `vec2f( ${ p[ 2 ].toFixed( 2 ) }, ${ p[ 3 ].toFixed( 2 ) } )` ).join( ', ' ) } );
	var glo = array<vec3f, ${ PALETTE.length }>( ${ PALETTE.map( ( p ) => f3( p[ 4 ] || [ 0, 0, 0 ] ) ).join( ', ' ) } );
	let nk = smoothstep( 0.1, 0.7, frame.night );
	if ( in.uv.x >= 199.0 ) {
		// the banners and the signs, lit by the spots in the trusses after dark
		let t = textureSample( c3bAtlas2, smpAnisoClamp, in.uv - vec2f( 200.0 ) ).rgb;
		s.albedo = t * 0.8;
		s.roughness = 0.6;
		s.emissive = t * mix( 0.05, 0.3, nk );
	} else if ( in.uv.x >= 99.0 ) {
		// printed: the atlas (the carts' signs are lit from behind)
		let t = textureSample( c3bAtlas, smpAnisoClamp, in.uv - vec2f( 100.0 ) ).rgb;
		s.albedo = t * 0.8;
		s.roughness = 0.45;
		s.emissive = t * select( 0.0, mix( 0.25, 0.7, nk ), in.uv.y > 100.25 && in.uv.y < 100.75 );
	} else {
		let k = min( u32( max( in.uv.x, 0.0 ) ), ${ PALETTE.length - 1 }u );
		s.albedo = alb[ k ];
		s.roughness = rm[ k ].x;
		s.metalness = rm[ k ].y;
		s.emissive = glo[ k ] * mix( 0.6, 1.6, nk );
		// scuffed and grimy, where the mops and the shoes get at them
		s.albedo *= 1.0 - 0.1 * mx_noise_float3( in.P * 9.0 ) * 0.5;
	}
`,
	} );
	mat.underwaterLighting = 'none';
	mat.setDefine( 'DRY', 1 );
	return mat;

}

// ---------------------------------------------------------------- building them

// A builder with smooth normals: things are placed in a frame on the concourse floor, o the origin
// ([ x, z ], field frame), a the right and n the forward (unit [ x, z ]); P( x, y, z ) is right x, up y
// above the floor, forward z.
export class Kit {

	constructor() {

		this.pos = []; this.nrm = []; this.uv = [];
		this.k = 0;
		this.atlas = drawAtlas();
		this.atlas2 = drawAtlas2();
		this.material = propsMaterial( this.atlas, this.atlas2 );

	}

	use( name ) {

		this.k = PAL[ name ];
		return this;

	}

	static frame( o, a, n ) {

		const P = ( x, y, z ) => [ o[ 0 ] + a[ 0 ] * x + n[ 0 ] * z, STREET + y, o[ 1 ] + a[ 1 ] * x + n[ 1 ] * z ];
		P.dir = ( x, y, z ) => [ a[ 0 ] * x + n[ 0 ] * z, y, a[ 1 ] * x + n[ 1 ] * z ];
		return P;

	}

	tri( a, b, c, na, nb, nc, ua, ub, uc ) {

		// wound to face along the normals
		const e1 = [ b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ], b[ 2 ] - a[ 2 ] ], e2 = [ c[ 0 ] - a[ 0 ], c[ 1 ] - a[ 1 ], c[ 2 ] - a[ 2 ] ];
		const cx = e1[ 1 ] * e2[ 2 ] - e1[ 2 ] * e2[ 1 ], cy = e1[ 2 ] * e2[ 0 ] - e1[ 0 ] * e2[ 2 ], cz = e1[ 0 ] * e2[ 1 ] - e1[ 1 ] * e2[ 0 ];
		const n = [ na[ 0 ] + nb[ 0 ] + nc[ 0 ], na[ 1 ] + nb[ 1 ] + nc[ 1 ], na[ 2 ] + nb[ 2 ] + nc[ 2 ] ];
		if ( cx * n[ 0 ] + cy * n[ 1 ] + cz * n[ 2 ] < 0 ) {

			[ b, c ] = [ c, b ]; [ nb, nc ] = [ nc, nb ]; [ ub, uc ] = [ uc, ub ];

		}

		const pal = [ this.k + 0.5, 0.5 ];
		this.pos.push( ...a, ...b, ...c );
		for ( const nn of [ na, nb, nc ] ) {

			const l = Math.hypot( ...nn ) || 1;
			this.nrm.push( nn[ 0 ] / l, nn[ 1 ] / l, nn[ 2 ] / l );

		}

		this.uv.push( ...( ua || pal ), ...( ub || pal ), ...( uc || pal ) );

	}

	quad( a, b, c, d, n, uv = null ) {

		this.tri( a, b, c, n, n, n, uv?.[ 0 ], uv?.[ 1 ], uv?.[ 2 ] );
		this.tri( a, c, d, n, n, n, uv?.[ 0 ], uv?.[ 2 ], uv?.[ 3 ] );

	}

	// a box in frame P: centre ( x, y, z ), sizes along right, up, forward; `print` puts an atlas cell on
	// its forward face
	box( P, x, y, z, sx, sy, sz, print = null ) {

		const c = ( i, j, k ) => P( x + i * sx / 2, y + j * sy / 2, z + k * sz / 2 );
		const F = P.dir( 0, 0, 1 ), R = P.dir( 1, 0, 0 );
		const face = ( a, b, cc, d, n, uv ) => this.quad( a, b, cc, d, n, uv );
		face( c( - 1, - 1, 1 ), c( 1, - 1, 1 ), c( 1, 1, 1 ), c( - 1, 1, 1 ), F, print ? [ atlasUV( print, 0, 1 ), atlasUV( print, 1, 1 ), atlasUV( print, 1, 0 ), atlasUV( print, 0, 0 ) ] : null );
		face( c( 1, - 1, - 1 ), c( - 1, - 1, - 1 ), c( - 1, 1, - 1 ), c( 1, 1, - 1 ), F.map( ( v ) => - v ) );
		face( c( 1, - 1, 1 ), c( 1, - 1, - 1 ), c( 1, 1, - 1 ), c( 1, 1, 1 ), R );
		face( c( - 1, - 1, - 1 ), c( - 1, - 1, 1 ), c( - 1, 1, 1 ), c( - 1, 1, - 1 ), R.map( ( v ) => - v ) );
		face( c( - 1, 1, 1 ), c( 1, 1, 1 ), c( 1, 1, - 1 ), c( - 1, 1, - 1 ), [ 0, 1, 0 ] );
		face( c( - 1, - 1, - 1 ), c( 1, - 1, - 1 ), c( 1, - 1, 1 ), c( - 1, - 1, 1 ), [ 0, - 1, 0 ] );

	}

	// an upright cylinder (or a cone's frustum) in frame P: its axis at ( x, z ), from y0 to y1, radius r0
	// at the bottom, r1 at the top, n sides; `wrap` an atlas cell round its side; caps
	cyl( P, x, z, y0, y1, r0, r1, n = 14, { wrap = null, top = true, bottom = false, topPrint = null } = {} ) {

		const ring = ( y, r, k ) => {

			const t = k / n * Math.PI * 2;
			return [ P( x + Math.cos( t ) * r, y, z + Math.sin( t ) * r ), P.dir( Math.cos( t ), ( r0 - r1 ) / ( y1 - y0 ), Math.sin( t ) ) ];

		};

		for ( let k = 0; k < n; k ++ ) {

			const [ a, na ] = ring( y0, r0, k ), [ b, nb ] = ring( y0, r0, k + 1 ), [ c, nc ] = ring( y1, r1, k + 1 ), [ d, nd ] = ring( y1, r1, k );
			const uv = wrap ? [ atlasUV( wrap, k / n, 1 ), atlasUV( wrap, ( k + 1 ) / n, 1 ), atlasUV( wrap, ( k + 1 ) / n, 0 ), atlasUV( wrap, k / n, 0 ) ] : null;
			this.tri( a, b, c, na, nb, nc, uv?.[ 0 ], uv?.[ 1 ], uv?.[ 2 ] );
			this.tri( a, c, d, na, nc, nd, uv?.[ 0 ], uv?.[ 2 ], uv?.[ 3 ] );
			if ( top ) {

				const cu = topPrint ? atlasUV( topPrint, 0.5, 0.5 ) : null;
				const tu = ( kk ) => topPrint ? atlasUV( topPrint, 0.5 + Math.cos( kk / n * Math.PI * 2 ) * 0.5, 0.5 + Math.sin( kk / n * Math.PI * 2 ) * 0.5 ) : null;
				this.tri( P( x, y1, z ), d, c, [ 0, 1, 0 ], [ 0, 1, 0 ], [ 0, 1, 0 ], cu, tu( k ), tu( k + 1 ) );

			}

			if ( bottom ) this.tri( P( x, y0, z ), b, a, [ 0, - 1, 0 ], [ 0, - 1, 0 ], [ 0, - 1, 0 ] );

		}

	}

	// a printed sheet, both faces reading right way round: centre ( x, y, z ), w wide, h tall, facing +z
	// (and -z); `sag` droops its middle (a bedsheet on twine)
	sheet( P, x, y, z, w, h, print, sag = 0 ) {

		const n = 6;
		for ( let i = 0; i < n; i ++ ) {

			const u0 = i / n, u1 = ( i + 1 ) / n;
			const x0 = x - w / 2 + w * u0, x1 = x - w / 2 + w * u1;
			const d0 = sag * Math.sin( u0 * Math.PI ), d1 = sag * Math.sin( u1 * Math.PI );
			const F = P.dir( 0, 0, 1 ), B = P.dir( 0, 0, - 1 );
			this.quad( P( x0, y - h / 2 - d0, z ), P( x1, y - h / 2 - d1, z ), P( x1, y + h / 2 - d1, z ), P( x0, y + h / 2 - d0, z ), F,
				[ atlasUV( print, u0, 1 ), atlasUV( print, u1, 1 ), atlasUV( print, u1, 0 ), atlasUV( print, u0, 0 ) ] );
			this.quad( P( x1, y - h / 2 - d1, z - 0.005 ), P( x0, y - h / 2 - d0, z - 0.005 ), P( x0, y + h / 2 - d0, z - 0.005 ), P( x1, y + h / 2 - d1, z - 0.005 ), B,
				[ atlasUV( print, 1 - u1, 1 ), atlasUV( print, 1 - u0, 1 ), atlasUV( print, 1 - u0, 0 ), atlasUV( print, 1 - u1, 0 ) ] );

		}

	}

	mesh( name = 'concourse3b-props' ) {

		const g = new BufferGeometry();
		g.setAttribute( 'position', new Float32BufferAttribute( this.pos, 3 ) );
		g.setAttribute( 'normal', new Float32BufferAttribute( this.nrm, 3 ) );
		g.setAttribute( 'uv', new Float32BufferAttribute( this.uv, 2 ) );
		g.computeBoundingBox();
		g.computeBoundingSphere();
		const m = new Mesh( g, this.material );
		m.name = name;
		m.castShadow = false;
		m.receiveShadow = true;
		return m;

	}

}

// ---------------------------------------------------------------- the things

// A Phillies trash can as the 2008 photos show them (ZoeR, April 2008; the 2009 ones beside the red
// stanchions): a red square can about 60 cm across and a metre tall, the script on its faces, under a
// hooded top that's open at the sides for the trash (the liner dark inside); a cup left on top now and
// then
export function trashCan( K, P, x, z, r ) {

	const w = 0.58, h = 0.78;
	// the body, printed on the front and the back, a black kick at the foot
	K.box( P, x, h / 2, z, w, h, w, 'canRed' );
	K.use( 'canRed' ).quad( P( x + w / 2, 0, z - w / 2 ), P( x - w / 2, 0, z - w / 2 ), P( x - w / 2, h, z - w / 2 ), P( x + w / 2, h, z - w / 2 ), P.dir( 0, 0, - 1 ) );
	K.use( 'rubber' ).box( P, x, 0.03, z, w + 0.01, 0.06, w + 0.01 );
	// the hood: four posts at the corners, a domed cap over the openings, the liner showing
	K.use( 'canRed' ).box( P, x, h + 0.01, z, w + 0.02, 0.02, w + 0.02 );
	K.use( 'bag' ).box( P, x, h + 0.1, z, w - 0.08, 0.18, w - 0.08 );
	for ( const [ cx, cz ] of [ [ - 1, - 1 ], [ 1, - 1 ], [ 1, 1 ], [ - 1, 1 ] ] ) K.use( 'canRed' ).box( P, x + cx * ( w / 2 - 0.035 ), h + 0.11, z + cz * ( w / 2 - 0.035 ), 0.07, 0.2, 0.07 );
	K.use( 'canRed' ).box( P, x, h + 0.225, z, w + 0.03, 0.03, w + 0.03 );
	K.use( 'canRed' ).cyl( P, x, z, h + 0.24, h + 0.33, w * 0.62, w * 0.3, 4, { top: true } );
	if ( r() < 0.45 ) {

		// a cup (or two) left on the top
		K.use( 'cup' ).cyl( P, x + 0.06, z - 0.05, h + 0.26, h + 0.4, 0.034, 0.045, 8 );
		if ( r() < 0.4 ) K.use( 'redPlastic' ).cyl( P, x - 0.1, z + 0.05, h + 0.25, h + 0.35, 0.03, 0.04, 8 );

	}

}

// the blue recycling bin beside it: the same drum in blue, a round hole in its lid for the bottles
export function recycleBin( K, P, x, z ) {

	K.use( 'canBlue' ).cyl( P, x, z, 0.0, 0.86, 0.25, 0.28, 16, { wrap: 'canBlue', top: false } );
	K.use( 'rubber' ).cyl( P, x, z, 0.0, 0.05, 0.255, 0.255, 16, { top: false } );
	K.use( 'canBlue' ).cyl( P, x, z, 0.86, 0.93, 0.285, 0.285, 16 );
	K.use( 'bag' ).cyl( P, x, z, 0.93, 0.935, 0.09, 0.09, 12 );

}

// A condiment station, facing the walkway (+z): a stainless cabinet with a trash hole in its top, the
// pumps (ketchup, mustard, relish) with their drip trays, the tub of chopped onions under a hinged lid,
// the napkins; the header behind; drips, and a napkin dropped on the floor in front
export function condiments( K, P, x, z, r ) {

	const W = 1.15, D = 0.58, H = 0.94;
	K.use( 'steel' ).box( P, x, H / 2, z, W, H, D );
	K.use( 'rubber' ).box( P, x, 0.04, z, W + 0.02, 0.08, D + 0.02 );
	// the trash hole and its flap
	K.use( 'bag' ).box( P, x + W * 0.38, H + 0.003, z + 0.06, 0.24, 0.006, 0.2 );
	// the pumps: squat jugs at the back, the pump heads, the nozzles out over the drip trays
	[ 'ketchup', 'mustard', 'relish' ].forEach( ( c, i ) => {

		const px = x - W * 0.38 + i * 0.17;
		K.use( 'steel' ).box( P, px, H + 0.01, z + 0.02, 0.14, 0.02, 0.18 );
		K.use( c ).cyl( P, px, z - 0.1, H, H + 0.24, 0.065, 0.065, 10 );
		K.use( 'steel' ).cyl( P, px, z - 0.1, H + 0.24, H + 0.27, 0.06, 0.04, 10 );
		K.use( 'grey' ).cyl( P, px, z - 0.1, H + 0.27, H + 0.36, 0.012, 0.012, 6 );
		K.use( 'grey' ).box( P, px, H + 0.36, z - 0.04, 0.03, 0.03, 0.13 );
		// what's dripped on the tray under the nozzle
		K.use( c ).box( P, px, H + 0.022, z + 0.02, 0.05, 0.004, 0.05 );

	} );
	// the onions in their tub under the lid (propped open), the napkin dispenser
	K.use( 'steel' ).box( P, x + W * 0.05, H + 0.05, z + 0.05, 0.22, 0.1, 0.24 );
	K.use( 'onion' ).box( P, x + W * 0.05, H + 0.1, z + 0.05, 0.19, 0.006, 0.21 );
	K.use( 'steel' ).quad( P( x + W * 0.05 - 0.11, H + 0.1, z - 0.07 ), P( x + W * 0.05 + 0.11, H + 0.1, z - 0.07 ), P( x + W * 0.05 + 0.11, H + 0.3, z - 0.14 ), P( x + W * 0.05 - 0.11, H + 0.3, z - 0.14 ), P.dir( 0, 0.4, 1 ) );
	K.use( 'steel' ).box( P, x + W * 0.22, H + 0.1, z - 0.12, 0.16, 0.2, 0.14 );
	K.use( 'napkin' ).box( P, x + W * 0.22, H + 0.1, z - 0.05, 0.1, 0.08, 0.005 );
	if ( r() < 0.7 ) K.use( 'napkin' ).quad( P( x - 0.2, 0.003, z + 0.5 ), P( x - 0.05, 0.003, z + 0.45 ), P( x - 0.08, 0.003, z + 0.33 ), P( x - 0.22, 0.003, z + 0.38 ), [ 0, 1, 0 ] );
	// the header on two posts at the back
	K.box( P, x, H + 0.66, z - 0.27, W, 0.24, 0.03, 'condiments' );
	K.use( 'steel' ).box( P, x - W / 2 + 0.03, H + 0.3, z - 0.27, 0.03, 0.6, 0.03 );
	K.use( 'steel' ).box( P, x + W / 2 - 0.03, H + 0.3, z - 0.27, 0.03, 0.6, 0.03 );

}

// A white dome pendant light (the 2008 photos: about 50 cm across, hung from the trusses), its cord up
// to the deck overhead
export function pendant( K, P, x, z, y, top ) {

	K.use( 'grey' ).cyl( P, x, z, y + 0.3, top, 0.008, 0.008, 4, { top: false } );
	K.use( 'enamel' ).cyl( P, x, z, y + 0.12, y + 0.3, 0.26, 0.05, 12 );
	K.use( 'lamp' ).cyl( P, x, z, y + 0.08, y + 0.12, 0.25, 0.25, 12, { top: false, bottom: true } );

}

// A red push cart, the vendor's side at -z, the customers' at +z: a red body on four wheels, a steel
// top, a lit sign on two poles over it, and what it sells on the top: water ice in a freezer chest, the
// cotton candy bags and a popcorn machine, the hot chocolate urns, the nacho cheese pump and the chip
// warmer, cold beer in a tub of ice
export function cart( K, P, kind, r, barrel = false ) {

	const L = 1.7, D = 0.8, H = 0.95;
	K.use( 'cartRed' ).box( P, 0, H / 2 + 0.12, 0, L, H - 0.24, D );
	K.use( 'steel' ).box( P, 0, H + 0.015, 0, L + 0.08, 0.03, D + 0.08 );
	K.use( 'chrome' ).box( P, 0, 0.1, 0, L - 0.1, 0.03, D - 0.1 );
	// the push handle on the vendor's side, the wheels
	K.use( 'chrome' ).box( P, 0, H - 0.05, - D / 2 - 0.12, L * 0.6, 0.03, 0.03 );
	for ( const [ x, z ] of [ [ - 0.7, - 0.3 ], [ 0.7, - 0.3 ], [ - 0.7, 0.3 ], [ 0.7, 0.3 ] ] ) K.use( 'rubber' ).cyl( P, x, z, 0.0, 0.14, 0.07, 0.07, 8 );
	// the sign over it on two poles, facing the customers (and a second face for the other way)
	const sign = { waterIce: 'waterIce', cottonCandy: 'cottonCandy', cocoa: 'cocoaCart', nachos: 'nachos', programs: 'programs', beer: 'beerCart' }[ kind ];
	if ( barrel ) {

		// the carts by the Third Base Gate (the Apr 2008 and Game 5 photos): a sage-green barrel canopy
		// on four yellow posts, the sign hung under its front edge
		for ( const [ x, z ] of [ [ - L / 2, - D / 2 ], [ L / 2, - D / 2 ], [ - L / 2, D / 2 ], [ L / 2, D / 2 ] ] ) K.use( 'postYellow' ).cyl( P, x, z, H, H + 1.3, 0.025, 0.025, 6 );
		const n = 8, R = D / 2 + 0.18, yc = H + 1.3;
		for ( let i = 0; i < n; i ++ ) {

			const a0 = Math.PI * i / n, a1 = Math.PI * ( i + 1 ) / n;
			const p = ( x, a ) => P( x, yc + Math.sin( a ) * R * 0.75, Math.cos( a ) * R );
			K.use( 'sage' ).quad( p( - L / 2 - 0.12, a0 ), p( L / 2 + 0.12, a0 ), p( L / 2 + 0.12, a1 ), p( - L / 2 - 0.12, a1 ), P.dir( 0, Math.sin( ( a0 + a1 ) / 2 ), Math.cos( ( a0 + a1 ) / 2 ) ) );

		}

		K.box( P, 0, H + 1.12, R - 0.02, L, 0.3, 0.03, sign );

	} else {

		for ( const x of [ - L / 2 + 0.06, L / 2 - 0.06 ] ) K.use( 'chrome' ).cyl( P, x, 0, H, H + 1.2, 0.02, 0.02, 6 );
		K.box( P, 0, H + 1.35, 0.01, L + 0.1, 0.34, 0.04, sign );
		// the canopy's red top over the sign
		K.use( 'cartRed' ).box( P, 0, H + 1.54, 0.0, L + 0.2, 0.04, 0.34 );

	}
	// the front: the sign again, low, on the cart's face
	K.box( P, 0, 0.55, D / 2 + 0.005, L * 0.9, 0.28, 0.01, sign );
	if ( kind === 'waterIce' ) {

		// the freezer chest's lids, the tubs of cherry, lemon and blue in the open one, the cups
		K.use( 'enamel' ).box( P, - 0.35, H + 0.12, 0, 0.8, 0.2, 0.6 );
		K.use( 'enamel' ).quad( P( 0.05, H + 0.22, - 0.3 ), P( 0.75, H + 0.22, - 0.3 ), P( 0.75, H + 0.62, - 0.42 ), P( 0.05, H + 0.62, - 0.42 ), P.dir( 0, 0.3, 1 ) );
		[ 'cherry', 'lemon', 'blueIce' ].forEach( ( c, i ) => K.use( c ).cyl( P, 0.18 + i * 0.2, 0.02, H + 0.03, H + 0.2, 0.085, 0.085, 10 ) );
		for ( let i = 0; i < 3; i ++ ) K.use( 'cup' ).cyl( P, - 0.65 + i * 0.09, 0.28, H + 0.22, H + 0.52, 0.035, 0.045, 8 );

	} else if ( kind === 'cottonCandy' ) {

		// the popcorn machine (lit), the rack of cotton candy bags, the lemonade jug
		K.use( 'glass' ).box( P, 0.45, H + 0.3, - 0.05, 0.5, 0.5, 0.45 );
		K.use( 'popcorn' ).box( P, 0.45, H + 0.14, - 0.05, 0.46, 0.18, 0.41 );
		K.use( 'cartRed' ).box( P, 0.45, H + 0.58, - 0.05, 0.54, 0.06, 0.48 );
		K.use( 'chrome' ).cyl( P, - 0.45, - 0.1, H, H + 0.95, 0.015, 0.015, 6 );
		for ( let i = 0; i < 8; i ++ ) {

			const a = i / 8 * Math.PI * 2, y = H + 0.55 + ( i % 2 ) * 0.22;
			K.use( i % 3 ? 'floss' : 'blueIce' ).cyl( P, - 0.45 + Math.cos( a ) * 0.13, - 0.1 + Math.sin( a ) * 0.13, y, y + 0.2, 0.07, 0.06, 8 );

		}

		K.use( 'lemon' ).cyl( P, - 0.05, 0.1, H, H + 0.35, 0.1, 0.1, 10 );

	} else if ( kind === 'cocoa' ) {

		// two tall urns with their taps, the stacks of cups, the lids, a box of sleeves
		for ( const x of [ - 0.45, 0.0 ] ) {

			K.use( 'steel' ).cyl( P, x, - 0.05, H, H + 0.55, 0.14, 0.14, 12 );
			K.use( 'rubber' ).cyl( P, x, - 0.05, H + 0.55, H + 0.6, 0.1, 0.06, 12 );
			K.use( 'rubber' ).box( P, x, H + 0.12, 0.12, 0.05, 0.06, 0.06 );

		}

		for ( let i = 0; i < 3; i ++ ) K.use( 'cup' ).cyl( P, 0.4 + ( i % 2 ) * 0.1, 0.18 - i * 0.12, H, H + 0.4 - i * 0.05, 0.04, 0.05, 8 );
		K.use( 'cardboard' ).box( P, 0.62, H + 0.1, - 0.2, 0.2, 0.2, 0.25 );

	} else if ( kind === 'nachos' ) {

		// the chip warmer (a lit glass box), the cheese dispenser with its red pump, the trays
		K.use( 'glass' ).box( P, - 0.35, H + 0.25, - 0.05, 0.7, 0.5, 0.5 );
		K.use( 'popcorn' ).box( P, - 0.35, H + 0.1, - 0.05, 0.66, 0.16, 0.46 );
		K.use( 'steel' ).box( P, 0.35, H + 0.18, - 0.05, 0.35, 0.36, 0.35 );
		K.use( 'redLamp' ).cyl( P, 0.35, - 0.05, H + 0.36, H + 0.5, 0.03, 0.03, 8 );
		for ( let i = 0; i < 4; i ++ ) K.use( 'white' ).box( P, 0.7, H + 0.02 + i * 0.03, 0.2, 0.22, 0.02, 0.16 );

	} else if ( kind === 'beer' ) {

		// a tub of ice with the bottles and cans in it, the cups stacked
		K.use( 'steel' ).box( P, 0, H + 0.15, 0, 1.2, 0.3, 0.6 );
		K.use( 'enamel' ).box( P, 0, H + 0.29, 0, 1.12, 0.02, 0.52 );
		for ( let i = 0; i < 14; i ++ ) K.use( i % 3 ? 'green' : 'cocoa' ).cyl( P, - 0.5 + ( i % 7 ) * 0.16, - 0.15 + Math.floor( i / 7 ) * 0.25, H + 0.2, H + 0.42, 0.03, 0.02, 6 );
		K.use( 'cup' ).cyl( P, 0.75, 0.1, H, H + 0.55, 0.04, 0.05, 8 );

	}

}

// A program seller's folding table: the World Series programs stood up in a row and stacked, the
// cash apron's money box
export function programTable( K, P, r ) {

	K.use( 'navy' ).box( P, 0, 0.72, 0, 1.2, 0.04, 0.6 );
	for ( const x of [ - 0.55, 0.55 ] ) for ( const z of [ - 0.25, 0.25 ] ) K.use( 'grey' ).box( P, x, 0.36, z, 0.03, 0.72, 0.03 );
	// a skirt round it in Phillies red, the stack, the covers stood up facing the walkway
	K.use( 'canRed' ).box( P, 0, 0.5, 0.3, 1.2, 0.44, 0.01 );
	for ( let i = 0; i < 4; i ++ ) K.box( P, - 0.42 + i * 0.28, 0.9, 0.12, 0.21, 0.29, 0.015, 'program' );
	for ( let i = 0; i < 2; i ++ ) K.use( 'navy' ).box( P, - 0.2 + i * 0.4, 0.74 + 0.1, - 0.1, 0.22, 0.2, 0.29 );
	K.use( 'grey' ).box( P, 0.42, 0.78, - 0.15, 0.2, 0.08, 0.14 );

}
