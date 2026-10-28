import { Mesh, BufferGeometry, Float32BufferAttribute, Vector3 } from '../../../engine/index.js';
import { commonModule } from '../../../engine/render/wgsl/common.js';
import { standard } from '../../../materials/Materials.js';
import { canvasTexture } from '../../geo.js';
import { Builder } from '../home/Build.js';

// FI2 (gauntlet CI-5, CI-6, CI-14): the kit for the park's insides, the rooms nobody had built (the suites,
// the Hall of Fame Club, the Diamond Club and what's under the stands). A room is lit by its own lamps,
// and there's no light to spare for it (the local lights are the concourse's domes), so each vertex
// carries the light that falls on it, worked out once when it's built: a can's pool on the carpet, the
// scallop up a wall, the dark under a counter, a room with its lights off. One material for everything in
// a room (one draw a room-set): the palette entry and its pattern (carpet, wallpaper, wood, the ceiling's
// tiles, granite, terrazzo, block, turf, the Wall of Balls, the atlas's pictures) picked per vertex.
//
//   const b = new Inside()
//   b.room( { lamps: [ [ x, y, z, I ], ... ], amb, on } )   what lights what's built next (field frame)
//   b.use( 'wallpaper' ).box( P, x, y, z, sx, sy, sz )        P: Builder.frame( o, a, n ) (home/Build.js)
//   b.use( 'carpet' ).panel( a, b, d, n, du, dv )             a flat face from a (along a->b, up a->d),
//                                                             cut into cells so the light varies across it
//   b.use( 'print' ).print( a, b, c, d, n, cell )             an atlas picture (ATLAS below)
//   const mesh = b.mesh( insideMaterial( name ) )
//
// The vertex: position, normal, uv (the pattern's coordinates, metres; the atlas's on a print), color
// (rgb: the light, a: the palette entry).

// [ linear albedo, roughness, metalness, glow (a lamp: lit by itself), pattern ]
const P_PLAIN = 0, P_CARPET = 1, P_BLOCKS = 2, P_STRIPES = 3, P_GRAIN = 4, P_TILE = 5, P_SPECKLE = 6, P_TERRAZZO = 7, P_ATLAS = 8,
	P_BALLS = 9, P_CMU = 10, P_TURF = 11, P_NET = 12, P_SCREEN = 13, P_RIBS = 14;
export const PAL = {
	// floors
	carpet: [ [ 0.03, 0.035, 0.055 ], 0.95, 0, 0, P_CARPET ], // a suite's: dark blue-grey, a small figure in it (Ernst & Young's suite, 2009)
	blocks: [ [ 0.075, 0.066, 0.054 ], 0.95, 0, 0, P_BLOCKS ], // the corridors' and the club's: red blocks on taupe (greenheaps, harpo42)
	terrazzo: [ [ 0.4, 0.37, 0.31 ], 0.14, 0, 0, P_TERRAZZO ], // the Diamond Club's, its red stitches
	concreteFloor: [ [ 0.26, 0.255, 0.24 ], 0.7, 0, 0, P_SPECKLE ],
	turf: [ [ 0.05, 0.17, 0.05 ], 0.95, 0, 0, P_TURF ],
	turfMat: [ [ 0.05, 0.2, 0.05 ], 0.9, 0, 0, P_TURF ],
	// walls and ceilings
	wallpaper: [ [ 0.52, 0.42, 0.27 ], 0.8, 0, 0, P_STRIPES ],
	paint: [ [ 0.3, 0.32, 0.27 ], 0.8, 0, 0, P_PLAIN ], // the corridor's grey-green (harpo42, 2010)
	cream: [ [ 0.6, 0.55, 0.44 ], 0.8, 0, 0, P_PLAIN ],
	drywall: [ [ 0.62, 0.6, 0.56 ], 0.85, 0, 0, P_PLAIN ],
	navyWall: [ [ 0.015, 0.02, 0.05 ], 0.7, 0, 0, P_PLAIN ],
	blackPaint: [ [ 0.018, 0.018, 0.02 ], 0.8, 0, 0, P_PLAIN ],
	redPaint: [ [ 0.3, 0.02, 0.025 ], 0.45, 0, 0, P_PLAIN ],
	tile: [ [ 0.58, 0.57, 0.54 ], 0.9, 0, 0, P_TILE ], // 2 ft acoustic tiles in their grid
	cmu: [ [ 0.5, 0.49, 0.46 ], 0.75, 0, 0, P_CMU ], // painted block
	cmuRed: [ [ 0.3, 0.02, 0.025 ], 0.6, 0, 0, P_CMU ],
	concrete: [ [ 0.3, 0.29, 0.27 ], 0.85, 0, 0, P_SPECKLE ],
	deck: [ [ 0.2, 0.2, 0.2 ], 0.6, 0.3, 0, P_RIBS ],
	// wood, stone, metal
	honey: [ [ 0.42, 0.2, 0.07 ], 0.45, 0, 0, P_GRAIN ], // the stools' and the wainscot's
	cherry: [ [ 0.2, 0.075, 0.03 ], 0.4, 0, 0, P_GRAIN ], // the cabinets, the doors
	oak: [ [ 0.45, 0.3, 0.14 ], 0.45, 0, 0, P_GRAIN ], // the Diamond Club's blond oak
	granite: [ [ 0.05, 0.045, 0.04 ], 0.2, 0, 0, P_SPECKLE ],
	stainless: [ [ 0.55, 0.56, 0.57 ], 0.3, 0.9, 0, P_PLAIN ],
	chrome: [ [ 0.7, 0.7, 0.72 ], 0.15, 1, 0, P_PLAIN ],
	brass: [ [ 0.55, 0.38, 0.12 ], 0.3, 0.9, 0, P_PLAIN ],
	gilt: [ [ 0.5, 0.36, 0.1 ], 0.35, 0.8, 0, P_PLAIN ],
	bronze: [ [ 0.03, 0.025, 0.02 ], 0.45, 0.5, 0, P_PLAIN ], // the window frames
	black: [ [ 0.015, 0.015, 0.017 ], 0.5, 0, 0, P_PLAIN ],
	plastic: [ [ 0.03, 0.03, 0.032 ], 0.35, 0, 0, P_PLAIN ],
	redVinyl: [ [ 0.3, 0.02, 0.025 ], 0.4, 0, 0, P_PLAIN ],
	navyVinyl: [ [ 0.02, 0.03, 0.1 ], 0.4, 0, 0, P_PLAIN ],
	leather: [ [ 0.16, 0.02, 0.02 ], 0.35, 0, 0, P_PLAIN ],
	weave: [ [ 0.04, 0.035, 0.03 ], 0.8, 0, 0, P_CARPET ], // the woven chairs
	white: [ [ 0.7, 0.69, 0.66 ], 0.6, 0, 0, P_PLAIN ],
	linen: [ [ 0.68, 0.66, 0.6 ], 0.9, 0, 0, P_PLAIN ],
	glass: [ [ 0.04, 0.05, 0.05 ], 0.05, 0.4, 0, P_PLAIN ],
	steel: [ [ 0.32, 0.33, 0.34 ], 0.45, 0.7, 0, P_PLAIN ],
	maroon: [ [ 0.2, 0.028, 0.032 ], 0.42, 0, 0, P_PLAIN ],
	pipeWhite: [ [ 0.62, 0.62, 0.6 ], 0.45, 0, 0, P_PLAIN ],
	balls: [ [ 0.7, 0.66, 0.58 ], 0.6, 0, 0, P_BALLS ],
	net: [ [ 0.02, 0.025, 0.02 ], 0.8, 0, 0, P_NET ],
	ball: [ [ 0.75, 0.72, 0.65 ], 0.6, 0, 0, P_PLAIN ],
	food: [ [ 0.5, 0.3, 0.12 ], 0.7, 0, 0, P_PLAIN ],
	bottleGreen: [ [ 0.02, 0.12, 0.04 ], 0.1, 0, 0.35, P_PLAIN ], // the back bar's bottles, lit from under the shelves
	bottleAmber: [ [ 0.3, 0.12, 0.02 ], 0.1, 0, 0.45, P_PLAIN ],
	bottleClear: [ [ 0.45, 0.47, 0.45 ], 0.1, 0, 0.3, P_PLAIN ],
	green: [ [ 0.04, 0.12, 0.05 ], 0.6, 0, 0, P_PLAIN ],
	// what lights itself
	print: [ [ 1, 1, 1 ], 0.6, 0, 0, P_ATLAS ],
	printLit: [ [ 1, 1, 1 ], 0.5, 0, 1.6, P_ATLAS ], // a lit sign
	can: [ [ 0.9, 0.86, 0.78 ], 0.3, 0, 6.0, P_PLAIN ], // a recessed can's lens
	lamp: [ [ 1.0, 0.85, 0.6 ], 0.4, 0, 3.0, P_PLAIN ], // a pendant's shade, a picture light
	cove: [ [ 1.0, 0.86, 0.66 ], 0.5, 0, 1.6, P_PLAIN ], // the light along a cove
	backsplash: [ [ 0.5, 0.56, 0.46 ], 0.3, 0, 0.32, P_PLAIN ], // the lit glass behind a suite's counter
	barGlow: [ [ 0.9, 0.04, 0.04 ], 0.5, 0, 2.6, P_PLAIN ], // the Diamond Club's bar front, lit red from inside
	exitSign: [ [ 0.9, 0.06, 0.04 ], 0.5, 0, 2.0, P_PLAIN ],
	screen: [ [ 0.06, 0.07, 0.07 ], 0.15, 0, 1.0, P_SCREEN ], // a TV (an old tube's picture: the game, green)
	fridge: [ [ 0.8, 0.85, 0.9 ], 0.4, 0, 1.2, P_PLAIN ], // a glass-front fridge's light
	frost: [ [ 0.42, 0.52, 0.68 ], 0.3, 0, 1.3, P_PLAIN ], // frosted glass lit from behind, blue-white
};
export const PAL_KEYS = Object.keys( PAL );
const IDX = Object.fromEntries( PAL_KEYS.map( ( k, i ) => [ k, i ] ) );
const f3 = ( v ) => `vec3f( ${ v.map( ( x ) => x.toFixed( 4 ) ).join( ', ' ) } )`;

// ---------------------------------------------------------------- the atlas: what's printed

// 2048 x 1024, cells of 256: [ col, row, cols, rows ]
export const ATLAS = {
	muralCrowd: [ 0, 0, 4, 1 ], muralVet: [ 4, 0, 4, 1 ],
	paintings: [ 0, 1, 8, 1 ], // eight canvases, a cell each
	bakerBowl: [ 0, 2, 2, 1 ], connieMack: [ 2, 2, 2, 1 ], recPark: [ 4, 2, 2, 1 ], shibe: [ 6, 2, 2, 1 ],
	plaques: [ 0, 3, 2, 1 ], // 32 home-plate plaques with the suites' numbers (8 x 4)
	hofSign: [ 2, 3, 2, 1 ], diamondSign: [ 4, 3, 2, 1 ], muralClub: [ 6, 3, 2, 1 ],
};
const AW = 2048, AH = 1024, CELL = 256;
// the uv rectangle [ u0, v0, u1, v1 ] of an atlas entry, or of its i-th of n x m sub-cells
export function cellUV( key, i = 0, n = 1, m = 1 ) {

	const [ c, r, cw, rh ] = ATLAS[ key ];
	const w = cw / n, h = rh / m, x = c + ( i % n ) * w, y = r + Math.floor( i / n ) * h;
	const px = 1.5 / AW;
	return [ x * CELL / AW + px, y * CELL / AH + px, ( x + w ) * CELL / AW - px, ( y + h ) * CELL / AH - px ];

}

let _atlas = null;
export function insideAtlas() {

	return _atlas ||= canvasTexture( AW, AH, drawAtlas, 'insideAtlas' );

}

// a little seeded random (mulberry32)
export function rnd( seed ) {

	let a = seed >>> 0;
	return () => {

		a = ( a + 0x6D2B79F5 ) >>> 0;
		let t = a;
		t = Math.imul( t ^ ( t >>> 15 ), t | 1 );
		t ^= t + Math.imul( t ^ ( t >>> 7 ), t | 61 );
		return ( ( t ^ ( t >>> 14 ) ) >>> 0 ) / 4294967296;

	};

}

function drawAtlas( ctx ) {

	const R = ( key ) => {

		const [ c, r, cw, rh ] = ATLAS[ key ];
		return [ c * CELL, r * CELL, cw * CELL, rh * CELL ];

	};
	ctx.fillStyle = '#777';
	ctx.fillRect( 0, 0, AW, AH );
	const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif', SERIF = 'Georgia, "Times New Roman", serif';

	// the suite corridor's murals (harpo42, 2010: photographs blown up wall-size). Invented here: a packed
	// crowd on its feet in red, the towels up; and the old Vet at night from the 700 level
	{

		const [ x0, y0, w, h ] = R( 'muralCrowd' ), r = rnd( 7 );
		const g = ctx.createLinearGradient( 0, y0, 0, y0 + h );
		g.addColorStop( 0, '#2a2622' ); g.addColorStop( 1, '#4a2420' );
		ctx.fillStyle = g;
		ctx.fillRect( x0, y0, w, h );
		for ( let row = 0; row < 15; row ++ ) {

			const yy = y0 + 18 + row * 16, sz = 7 + row * 0.9;
			for ( let x = x0 - 8; x < x0 + w + 8; x += sz * 1.25 + r() * 4 ) {

				ctx.fillStyle = r() < 0.62 ? `hsl(355, ${ 60 + r() * 25 }%, ${ 28 + r() * 18 }%)` : r() < 0.5 ? '#e8e2d6' : `hsl(220, 30%, ${ 12 + r() * 20 }%)`;
				ctx.fillRect( x, yy + sz * 0.6, sz * 1.15, sz * 1.3 );
				ctx.fillStyle = `hsl(25, ${ 30 + r() * 20 }%, ${ 45 + r() * 25 }%)`;
				ctx.beginPath(); ctx.arc( x + sz * 0.58, yy + sz * 0.3, sz * 0.42, 0, Math.PI * 2 ); ctx.fill();
				if ( r() < 0.25 ) {

					ctx.fillStyle = '#f2efe8';
					ctx.fillRect( x + sz * 0.2 + ( r() - 0.5 ) * 8, yy - sz * 0.9, sz * 0.8, sz * 0.7 );

				}

			}

		}

		ctx.fillStyle = 'rgba(255,255,255,0.85)';
		ctx.font = `italic bold 30px ${ SERIF }`;
		ctx.fillText( 'The Fans', x0 + 24, y0 + h - 18 );

	}
	{

		const [ x0, y0, w, h ] = R( 'muralVet' ), r = rnd( 11 );
		const g = ctx.createLinearGradient( 0, y0, 0, y0 + h );
		g.addColorStop( 0, '#070b1a' ); g.addColorStop( 0.5, '#1b2340' ); g.addColorStop( 1, '#0d0d10' );
		ctx.fillStyle = g;
		ctx.fillRect( x0, y0, w, h );
		// the bowl's far side, its decks in tiers, the light towers glowing
		ctx.fillStyle = '#3b2f2f';
		ctx.beginPath(); ctx.ellipse( x0 + w / 2, y0 + h * 0.62, w * 0.47, h * 0.3, 0, Math.PI, 0 ); ctx.fill();
		for ( let k = 0; k < 4; k ++ ) {

			ctx.strokeStyle = [ '#a8a091', '#7a4a6a', '#c7a36a', '#556' ][ k ];
			ctx.lineWidth = 5;
			ctx.beginPath(); ctx.ellipse( x0 + w / 2, y0 + h * 0.62, w * ( 0.45 - k * 0.05 ), h * ( 0.28 - k * 0.04 ), 0, Math.PI, 0 ); ctx.stroke();

		}

		ctx.fillStyle = '#2e6a2e';
		ctx.beginPath(); ctx.ellipse( x0 + w / 2, y0 + h * 0.9, w * 0.3, h * 0.14, 0, 0, Math.PI * 2 ); ctx.fill();
		ctx.fillStyle = '#8a6a44';
		ctx.beginPath(); ctx.moveTo( x0 + w / 2, y0 + h * 0.8 ); ctx.lineTo( x0 + w / 2 + 60, y0 + h * 0.88 ); ctx.lineTo( x0 + w / 2, y0 + h * 0.96 ); ctx.lineTo( x0 + w / 2 - 60, y0 + h * 0.88 ); ctx.fill();
		for ( const fx of [ 0.12, 0.3, 0.7, 0.88 ] ) {

			ctx.fillStyle = '#fff6d8';
			ctx.fillRect( x0 + w * fx - 18, y0 + 20, 36, 14 );
			ctx.fillStyle = 'rgba(255,240,200,0.12)';
			ctx.beginPath(); ctx.arc( x0 + w * fx, y0 + 27, 40, 0, Math.PI * 2 ); ctx.fill();

		}

		for ( let i = 0; i < 400; i ++ ) {

			ctx.fillStyle = r() < 0.5 ? '#a33' : '#ccc';
			ctx.fillRect( x0 + w * 0.05 + r() * w * 0.9, y0 + h * 0.4 + r() * h * 0.2, 2, 2 );

		}

		ctx.fillStyle = 'rgba(255,255,255,0.85)';
		ctx.font = `italic bold 28px ${ SERIF }`;
		ctx.fillText( 'Veterans Stadium, 1971-2003', x0 + 24, y0 + h - 16 );

	}

	// the Cooperstown Gallery: Dick Perez's oils of the Hall of Famers. Not his paintings, nor anyone's
	// likeness: eight invented canvases in an oil painter's manner, a figure in the uniform of his day
	// against a painted ground (a batter, a pitcher, a fielder), under the names on the brass plates
	{

		const [ x0, y0 ] = R( 'paintings' ), r = rnd( 23 );
		const grounds = [ [ '#a08454', '#5a4a30' ], [ '#5c7890', '#2c3c4c' ], [ '#9a5a44', '#4c2a24' ], [ '#7a8a5a', '#3c4a30' ], [ '#a88a6a', '#5c4a3a' ], [ '#6a6a90', '#2a2a3e' ], [ '#a07a3e', '#4e3a1e' ], [ '#70848c', '#38444a' ] ];
		const uni = [ '#e9e4d6', '#d8cfbd', '#c9c4b8', '#8fa7c9', '#e9e4d6', '#b9b2a2', '#e9e4d6', '#d8cfbd' ];
		for ( let i = 0; i < 8; i ++ ) {

			const x = x0 + i * CELL, y = y0;
			const g = ctx.createRadialGradient( x + 128, y + 100, 20, x + 128, y + 128, 180 );
			g.addColorStop( 0, grounds[ i ][ 0 ] ); g.addColorStop( 1, grounds[ i ][ 1 ] );
			ctx.fillStyle = g;
			ctx.fillRect( x, y, CELL, CELL );
			// the brushwork
			for ( let k = 0; k < 260; k ++ ) {

				ctx.fillStyle = `rgba(${ 120 + r() * 100 },${ 90 + r() * 80 },${ 60 + r() * 60 },0.06)`;
				ctx.fillRect( x + r() * CELL, y + r() * CELL, 6 + r() * 18, 2 + r() * 4 );

			}

			// the figure, three-quarter length, the cap's bill, the bat or the glove
			const cx = x + 128 + ( r() - 0.5 ) * 30;
			ctx.fillStyle = uni[ i ];
			ctx.beginPath();
			ctx.moveTo( cx - 46, y + 256 ); ctx.lineTo( cx - 40, y + 130 ); ctx.quadraticCurveTo( cx, y + 105, cx + 40, y + 130 ); ctx.lineTo( cx + 48, y + 256 );
			ctx.fill();
			ctx.fillStyle = 'rgba(0,0,0,0.25)';
			ctx.fillRect( cx + 10, y + 135, 30, 121 );
			ctx.fillStyle = '#b07a58';
			ctx.beginPath(); ctx.ellipse( cx, y + 92, 20, 25, 0, 0, Math.PI * 2 ); ctx.fill();
			ctx.fillStyle = 'rgba(60,30,20,0.35)';
			ctx.beginPath(); ctx.ellipse( cx + 7, y + 96, 11, 19, 0, 0, Math.PI * 2 ); ctx.fill();
			ctx.fillStyle = i % 3 === 1 ? '#1c2a52' : '#7a1820';
			ctx.beginPath(); ctx.ellipse( cx, y + 72, 23, 13, 0, Math.PI, 0 ); ctx.fill();
			ctx.fillRect( cx - 4, y + 70, 30, 6 );
			if ( i % 3 === 0 ) {

				ctx.strokeStyle = '#8a5a2a'; ctx.lineWidth = 7;
				ctx.beginPath(); ctx.moveTo( cx - 34, y + 180 ); ctx.lineTo( cx - 70, y + 40 ); ctx.stroke();

			} else if ( i % 3 === 1 ) {

				ctx.fillStyle = '#5a3a1a';
				ctx.beginPath(); ctx.ellipse( cx + 44, y + 160, 18, 22, 0.3, 0, Math.PI * 2 ); ctx.fill();

			}

			// the frame's shadow in the canvas's edge
			ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 6;
			ctx.strokeRect( x + 3, y + 3, CELL - 6, CELL - 6 );

		}

	}

	// the club's bars: their names lettered over the back bars (the 2008 guide's four; the lettering is
	// invented: no photo of the signs found)
	const barSign = ( key, line1, line2, bg, fg, font ) => {

		const [ x, y, w, h ] = R( key );
		ctx.fillStyle = bg;
		ctx.fillRect( x, y, w, h );
		ctx.strokeStyle = fg; ctx.lineWidth = 6;
		ctx.strokeRect( x + 10, y + 10, w - 20, h - 20 );
		ctx.fillStyle = fg;
		ctx.textAlign = 'center';
		ctx.font = font;
		ctx.fillText( line1, x + w / 2, y + h * 0.52 );
		ctx.font = `bold 30px ${ SANS }`;
		ctx.fillText( line2, x + w / 2, y + h * 0.82 );
		ctx.textAlign = 'left';

	};
	barSign( 'bakerBowl', 'Baker Bowl', 'BISTRO', '#1d2a44', '#e8dcc0', `italic bold 78px ${ SERIF }` );
	barSign( 'connieMack', "Connie Mack's", 'BAR', '#3a1214', '#e9d6a8', `italic bold 70px ${ SERIF }` );
	barSign( 'recPark', 'Recreation Park', 'MARTINI BAR', '#121416', '#d9c690', `bold 56px ${ SERIF }` );
	barSign( 'shibe', 'Shibe Park', 'EATERY', '#24331f', '#efe6cc', `bold 76px ${ SERIF }` );

	// the suites' numbers on the home-plate plaques by their doors (harpo42, 2010: a small brass-edged
	// plate beside each door), 8 x 4
	{

		const [ x0, y0, w, h ] = R( 'plaques' );
		const cw = w / 8, ch = h / 4;
		for ( let i = 0; i < 32; i ++ ) {

			const x = x0 + ( i % 8 ) * cw, y = y0 + Math.floor( i / 8 ) * ch;
			ctx.fillStyle = '#3a3226';
			ctx.fillRect( x, y, cw, ch );
			ctx.fillStyle = '#c9b27a';
			ctx.beginPath();
			ctx.moveTo( x + 6, y + 6 ); ctx.lineTo( x + cw - 6, y + 6 ); ctx.lineTo( x + cw - 6, y + ch * 0.6 ); ctx.lineTo( x + cw / 2, y + ch - 5 ); ctx.lineTo( x + 6, y + ch * 0.6 );
			ctx.fill();
			ctx.fillStyle = '#efe9dc';
			ctx.beginPath();
			ctx.moveTo( x + 10, y + 10 ); ctx.lineTo( x + cw - 10, y + 10 ); ctx.lineTo( x + cw - 10, y + ch * 0.58 ); ctx.lineTo( x + cw / 2, y + ch - 10 ); ctx.lineTo( x + 10, y + ch * 0.58 );
			ctx.fill();
			ctx.fillStyle = '#1c2a52';
			ctx.textAlign = 'center';
			ctx.font = `bold 26px ${ SANS }`;
			ctx.fillText( String( i < 16 ? 201 + i * 2 : 202 + ( i - 16 ) * 2 ), x + cw / 2, y + ch * 0.5 );
			ctx.textAlign = 'left';

		}

	}

	// HALL OF FAME CLUB over its doors, DIAMOND CLUB over the lounge's bar
	{

		const [ x, y, w, h ] = R( 'hofSign' );
		ctx.fillStyle = '#16161a';
		ctx.fillRect( x, y, w, h );
		ctx.fillStyle = '#c8a45a';
		ctx.textAlign = 'center';
		ctx.font = `bold 34px ${ SERIF }`;
		ctx.fillText( 'PHILLIES', x + w / 2, y + 70 );
		ctx.font = `bold 64px ${ SERIF }`;
		ctx.fillText( 'HALL OF FAME', x + w / 2, y + 150 );
		ctx.font = `bold 44px ${ SERIF }`;
		ctx.fillText( '★  CLUB  ★', x + w / 2, y + 215 );
		ctx.textAlign = 'left';

	}
	{

		const [ x, y, w, h ] = R( 'diamondSign' );
		ctx.fillStyle = '#0d0d10';
		ctx.fillRect( x, y, w, h );
		ctx.fillStyle = '#d8202c';
		ctx.save();
		ctx.translate( x + 90, y + 128 ); ctx.rotate( Math.PI / 4 );
		ctx.fillRect( - 50, - 50, 100, 100 );
		ctx.restore();
		ctx.fillStyle = '#fff';
		ctx.font = `bold 60px ${ SANS }`;
		ctx.fillText( 'D', x + 70, y + 150 );
		ctx.fillStyle = '#f2f2f2';
		ctx.font = `bold 62px ${ SANS }`;
		ctx.fillText( 'DIAMOND', x + 175, y + 120 );
		ctx.fillText( 'CLUB', x + 175, y + 190 );

	}

	// a mural of the Phillies in the clubhouse (the Diamond Club's are Dane Tilghman's oils, 2009 photo;
	// this one's invented: a row of players in pinstripes and red caps in a warm room, no one's face)
	{

		const [ x0, y0, w, h ] = R( 'muralClub' ), r = rnd( 31 );
		const g = ctx.createLinearGradient( 0, y0, 0, y0 + h );
		g.addColorStop( 0, '#b8502a' ); g.addColorStop( 0.55, '#d8a060' ); g.addColorStop( 1, '#4a5a78' );
		ctx.fillStyle = g;
		ctx.fillRect( x0, y0, w, h );
		for ( let k = 0; k < 11; k ++ ) {

			const cx = x0 + 30 + k * 45 + ( r() - 0.5 ) * 10, top = y0 + 50 + r() * 20, s = 0.9 + r() * 0.2;
			ctx.fillStyle = '#ece6da';
			ctx.fillRect( cx - 13 * s, top + 26, 26 * s, 120 * s );
			ctx.fillStyle = 'rgba(160,20,30,0.6)';
			for ( let p = - 10; p <= 10; p += 5 ) ctx.fillRect( cx + p * s, top + 26, 1, 120 * s );
			ctx.fillStyle = '#9a6a4a';
			ctx.beginPath(); ctx.ellipse( cx, top + 14, 9 * s, 12 * s, 0, 0, Math.PI * 2 ); ctx.fill();
			ctx.fillStyle = '#a01420';
			ctx.fillRect( cx - 10 * s, top, 20 * s, 7 * s );
			ctx.fillRect( cx - 13 * s, top + 150 * s, 9 * s, 30 * s );
			ctx.fillRect( cx + 4 * s, top + 150 * s, 9 * s, 30 * s );

		}

		ctx.strokeStyle = '#20180c'; ctx.lineWidth = 8;
		ctx.strokeRect( x0 + 4, y0 + 4, w - 8, h - 8 );

	}

}

// ---------------------------------------------------------------- the material

export function insideMaterial( name, { glowNight = 1 } = {} ) {

	const cols = PAL_KEYS.map( ( k ) => f3( PAL[ k ][ 0 ] ) ).join( ', ' );
	const prm = PAL_KEYS.map( ( k ) => `vec4f( ${ PAL[ k ][ 1 ].toFixed( 3 ) }, ${ PAL[ k ][ 2 ].toFixed( 3 ) }, ${ PAL[ k ][ 3 ].toFixed( 3 ) }, ${ PAL[ k ][ 4 ].toFixed( 1 ) } )` ).join( ', ' );
	const mat = standard( {
		name, roughness: 0.7, side: 'front', vertexColors: true, modules: [ commonModule ],
		textures: { inAtlas: insideAtlas() },
		surface: /* wgsl */`
	var COLS = array<vec3f, ${ PAL_KEYS.length }>( ${ cols } );
	var PRM = array<vec4f, ${ PAL_KEYS.length }>( ${ prm } );
	let k = u32( clamp( in.color.a + 0.5, 0.0, ${ PAL_KEYS.length - 1 }.0 ) );
	let q = PRM[ k ];
	let pat = u32( q.w + 0.5 );
	let uv = in.uv;
	let fw = max( fwidth( uv.x ), fwidth( uv.y ) );
	// (sampled before any branch: a texture's mip needs uniform control flow)
	let atl = textureSample( inAtlas, smpAnisoClamp, uv ).rgb;
	var c = COLS[ k ];
	var rough = q.x;
	var glow = q.z;
	let h2 = fract( sin( dot( floor( uv * 37.0 ), vec2f( 12.9898, 78.233 ) ) ) * 43758.5453 );
	if ( pat == ${ P_CARPET }u ) {
		// a small figure woven in: diamonds on a lattice, darker and lighter
		let g = abs( fract( uv / 0.12 ) - 0.5 );
		let d = g.x + g.y;
		c *= mix( 1.0, mix( 0.7, 1.35, step( 0.32, d ) ) * ( 0.9 + 0.2 * h2 ), clamp( 1.0 - fw * 8.0, 0.0, 1.0 ) );
	} else if ( pat == ${ P_BLOCKS }u ) {
		// red blocks on taupe in a grid of charcoal bands, small blue and black squares strewn
		let q2 = uv / 0.9;
		let cl = floor( q2 );
		let f = fract( q2 );
		let hc = fract( sin( dot( cl, vec2f( 41.3, 17.1 ) ) ) * 4375.85 );
		var cc = c;
		// (the ground's own banding: lighter and darker stripes through it)
		cc *= 0.85 + 0.3 * step( 0.5, fract( f.x * 3.0 + floor( f.y * 4.0 ) * 0.5 ) ) * step( 0.3, fract( f.y * 4.0 ) );
		if ( abs( f.x - 0.5 ) > 0.43 || abs( f.y - 0.5 ) > 0.43 ) { cc = vec3f( 0.03, 0.028, 0.027 ); }
		if ( max( abs( f.x - 0.55 ) * 1.1, abs( f.y - 0.45 ) * 1.5 ) < 0.27 && hc < 0.7 ) { cc = vec3f( 0.19, 0.02, 0.024 ) * ( 0.9 + 0.2 * hc ); }
		let g6 = fract( uv * 6.0 );
		let h6 = fract( sin( dot( floor( uv * 6.0 ), vec2f( 12.9898, 78.233 ) ) ) * 43758.5453 );
		if ( h6 > 0.9 && max( abs( g6.x - 0.5 ), abs( g6.y - 0.5 ) ) < 0.32 ) { cc = select( vec3f( 0.02, 0.03, 0.1 ), vec3f( 0.012 ), h6 > 0.95 ); }
		c = mix( cc, vec3f( 0.12, 0.05, 0.045 ), clamp( fw * 6.0 - 0.5, 0.0, 1.0 ) );
	} else if ( pat == ${ P_STRIPES }u ) {
		// the wallpaper's stripes: cream and gold, a fine line between
		let s = fract( uv.x / 0.18 );
		let line = 1.0 - smoothstep( 0.0, 0.04, abs( s - 0.5 ) );
		c = mix( c, c * vec3f( 1.12, 1.08, 0.95 ), step( 0.5, s ) ) * mix( 1.0, 0.75, line * clamp( 1.0 - fw * 10.0, 0.0, 1.0 ) );
	} else if ( pat == ${ P_GRAIN }u ) {
		// fine grain running up the board, a little figure in it
		let n = mx_noise_float2( vec2f( uv.x * 6.0, uv.y * 0.6 ) );
		c *= 0.93 + 0.05 * sin( ( uv.x + 0.015 * n ) * 160.0 ) * clamp( 1.0 - fw * 60.0, 0.0, 1.0 ) + 0.06 * n;
	} else if ( pat == ${ P_TILE }u ) {
		let g = abs( fract( uv / 0.61 ) - 0.5 );
		let grid = smoothstep( 0.465, 0.485, max( g.x, g.y ) ) * clamp( 1.0 - fw * 12.0, 0.0, 1.0 );
		c *= ( 1.0 - 0.5 * grid ) * ( 0.94 + 0.06 * h2 );
	} else if ( pat == ${ P_SPECKLE }u ) {
		let hs = fract( sin( dot( floor( in.P.xz * 70.0 + in.P.y * 31.0 ), vec2f( 12.9898, 78.233 ) ) ) * 43758.5453 );
		c *= 0.75 + 0.5 * hs * clamp( 1.0 - fw * 40.0, 0.3, 1.0 );
	} else if ( pat == ${ P_TERRAZZO }u ) {
		// cream terrazzo, the chips; a pair of red seams round the room with their stitches (harpo42, 2008)
		let hs = fract( sin( dot( floor( uv * 60.0 ), vec2f( 12.9898, 78.233 ) ) ) * 43758.5453 );
		c *= 0.88 + 0.24 * hs * clamp( 1.0 - fw * 40.0, 0.2, 1.0 );
		for ( var sd = - 1.0; sd <= 1.0; sd += 2.0 ) {
			let o = vec2f( uv.x, uv.y * sd ) - vec2f( 0.0, - 7.0 );
			let dd = length( o ) - 5.5;
			let th = atan2( o.y, o.x );
			let st = fract( th * 5.5 / 0.7 );
			if ( abs( dd ) < 0.32 && abs( abs( dd ) - 0.06 - abs( st - 0.5 ) * 0.42 ) < 0.03 ) { c = vec3f( 0.42, 0.025, 0.03 ); }
		}
	} else if ( pat == ${ P_ATLAS }u ) {
		c = atl;
	} else if ( pat == ${ P_BALLS }u ) {
		// the Wall of Balls: rows of baseballs, each row offset half a ball; their red stitches
		let q2 = uv / 0.078;
		let row = floor( q2.y );
		let f = fract( vec2f( q2.x + 0.5 * ( row - 2.0 * floor( row * 0.5 ) ), q2.y ) ) - 0.5;
		let rr = length( f );
		var cb = vec3f( 0.04, 0.035, 0.03 );
		if ( rr < 0.46 ) {
			cb = c * ( 1.05 - 0.6 * rr * rr );
			let se = min( abs( length( f - vec2f( 0.55, 0.0 ) ) - 0.4 ), abs( length( f + vec2f( 0.55, 0.0 ) ) - 0.4 ) );
			if ( se < 0.035 ) { cb = vec3f( 0.45, 0.04, 0.03 ); }
		}
		c = mix( cb, c * 0.72, clamp( fw / 0.078 * 1.5 - 0.3, 0.0, 1.0 ) );
	} else if ( pat == ${ P_CMU }u ) {
		let q2 = uv / vec2f( 0.4, 0.2 );
		let row = floor( q2.y );
		let f = fract( vec2f( q2.x + 0.5 * ( row - 2.0 * floor( row * 0.5 ) ), q2.y ) );
		let mort = max( 1.0 - smoothstep( 0.0, 0.03, min( f.x, 1.0 - f.x ) * 2.0 ), 1.0 - smoothstep( 0.0, 0.06, min( f.y, 1.0 - f.y ) * 2.0 ) );
		c *= ( 1.0 - 0.25 * mort * clamp( 1.0 - fw * 15.0, 0.0, 1.0 ) ) * ( 0.94 + 0.06 * h2 );
	} else if ( pat == ${ P_TURF }u ) {
		c *= 0.8 + 0.3 * mx_noise_float2( in.P.xz * 2.0 ) + 0.1 * h2;
	} else if ( pat == ${ P_NET }u ) {
		// the cages' netting: the strands, the rest cut away (sparser with distance, as the eye sees it)
		let g = abs( fract( uv / 0.05 ) - 0.5 );
		let fwn = fw / 0.05;
		let keep = max( g.x, g.y ) > 0.5 - 0.032 - fwn * 0.5;
		let hs = fract( sin( dot( in.pixel, vec2f( 12.9898, 78.233 ) ) ) * 43758.5453 );
		if ( ! keep || ( fwn > 0.4 && hs > 0.35 / fwn ) ) { discard; }
	} else if ( pat == ${ P_SCREEN }u ) {
		// an old tube showing the game: the field's green, the crowd's band, the score bug; it flickers
		let t = frame.time;
		var sc = vec3f( 0.1, 0.32, 0.1 );
		if ( uv.y > 0.62 ) { sc = vec3f( 0.25, 0.08, 0.08 ); }
		if ( uv.y < 0.15 && uv.x < 0.5 ) { sc = vec3f( 0.08, 0.1, 0.25 ); }
		sc *= 0.85 + 0.15 * sin( t * 3.0 + uv.x * 2.0 );
		c = sc;
	} else if ( pat == ${ P_RIBS }u ) {
		c *= 0.8 + 0.2 * step( 0.5, fract( uv.x / 0.3 ) );
	}
	s.albedo = c;
	s.roughness = rough;
	s.metalness = q.y;
	s.alpha = 1.0;
	let nk = smoothstep( 0.1, 0.7, frame.night );
	// the room's own light (in the vertex), and what glows by itself
	s.emissive = c * in.color.rgb * mix( 0.75, 1.0, nk ) + c * glow * mix( 0.5, ${ glowNight.toFixed( 2 ) }, nk );
`,
	} );
	mat.underwaterLighting = 'none';
	mat.setDefine( 'DRY', 1 );
	return mat;

}

// ---------------------------------------------------------------- the builder

const LAMP_C = [ 1.0, 0.84, 0.64 ];

export class Inside {

	constructor() {

		this.pos = []; this.nrm = []; this.uv = []; this.col = [];
		this.k = 0;
		this.L = null;
		this.data = null;

	}

	use( name ) {

		const k = IDX[ name ];
		if ( k === undefined ) throw new Error( `Inside: no palette entry ${ name }` );
		this.k = k;
		return this;

	}

	// what lights what's built next: lamps [ x, y, z, intensity ] (field frame; cans aimed down unless
	// `omni`), an ambient share (amb), on (0: the lights off, a room in the dark), a colour
	room( L ) {

		this.L = L ? { amb: 0.12, bounce: 0.22, on: 1, color: LAMP_C, ...L } : null;
		return this;

	}

	// (for a face that isn't a room's: its four numbers given straight, in place of the light and palette entry)
	with( data ) {

		this.data = data;
		return this;

	}

	// the light at p (normal n)
	light( p, n ) {

		const L = this.L;
		if ( ! L ) return [ 0, 0, 0 ];
		// what comes back off the floor and the walls: the ceiling gets most of it
		let s = L.amb * ( 0.7 + 0.3 * n[ 1 ] ) + L.bounce * ( n[ 1 ] < - 0.5 ? 1 : 0.3 );
		for ( const l of L.lamps || [] ) {

			const dx = l[ 0 ] - p[ 0 ], dy = l[ 1 ] - p[ 1 ], dz = l[ 2 ] - p[ 2 ];
			const d2 = dx * dx + dy * dy + dz * dz + 0.04, d = Math.sqrt( d2 );
			const ndl = Math.max( 0, ( n[ 0 ] * dx + n[ 1 ] * dy + n[ 2 ] * dz ) / d );
			// a can: a cone down (the beam), a little spill sideways; an omni lamp all round
			const down = dy / d;
			const cone = l[ 4 ] === 'omni' ? 1 : 0.08 + 0.92 * Math.min( 1, Math.max( 0, ( down - 0.35 ) / 0.45 ) );
			s += l[ 3 ] * ndl * cone / ( 1 + d2 / ( l[ 5 ] || 1.4 ) );

		}

		s *= L.on;
		const c = L.color;
		return [ s * c[ 0 ], s * c[ 1 ], s * c[ 2 ] ];

	}

	tri( a, b, c, na, nb, nc, ua, ub, uc ) {

		const e1 = [ b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ], b[ 2 ] - a[ 2 ] ], e2 = [ c[ 0 ] - a[ 0 ], c[ 1 ] - a[ 1 ], c[ 2 ] - a[ 2 ] ];
		const cx = e1[ 1 ] * e2[ 2 ] - e1[ 2 ] * e2[ 1 ], cy = e1[ 2 ] * e2[ 0 ] - e1[ 0 ] * e2[ 2 ], cz = e1[ 0 ] * e2[ 1 ] - e1[ 1 ] * e2[ 0 ];
		const n = [ na[ 0 ] + nb[ 0 ] + nc[ 0 ], na[ 1 ] + nb[ 1 ] + nc[ 1 ], na[ 2 ] + nb[ 2 ] + nc[ 2 ] ];
		if ( cx * n[ 0 ] + cy * n[ 1 ] + cz * n[ 2 ] < 0 ) {

			[ b, c ] = [ c, b ]; [ nb, nc ] = [ nc, nb ]; [ ub, uc ] = [ uc, ub ];

		}

		for ( const [ p, nn, u ] of [ [ a, na, ua ], [ b, nb, ub ], [ c, nc, uc ] ] ) {

			const l = Math.hypot( nn[ 0 ], nn[ 1 ], nn[ 2 ] ) || 1;
			const N = [ nn[ 0 ] / l, nn[ 1 ] / l, nn[ 2 ] / l ];
			this.pos.push( p[ 0 ], p[ 1 ], p[ 2 ] );
			this.nrm.push( N[ 0 ], N[ 1 ], N[ 2 ] );
			this.uv.push( u ? u[ 0 ] : 0, u ? u[ 1 ] : 0 );
			if ( this.data ) this.col.push( ...this.data );
			else {

				const L = this.light( p, N );
				this.col.push( L[ 0 ], L[ 1 ], L[ 2 ], this.k );

			}

		}

	}

	// a flat face a, b, c, d (a->b along, a->d up), its pattern's uv in metres from a (or given)
	quad( a, b, c, d, n, uv = null ) {

		const U = uv || ( () => {

			const lu = Math.hypot( b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ], b[ 2 ] - a[ 2 ] ), lv = Math.hypot( d[ 0 ] - a[ 0 ], d[ 1 ] - a[ 1 ], d[ 2 ] - a[ 2 ] );
			return [ [ 0, 0 ], [ lu, 0 ], [ lu, lv ], [ 0, lv ] ];

		} )();
		this.tri( a, b, c, n, n, n, U[ 0 ], U[ 1 ], U[ 2 ] );
		this.tri( a, c, d, n, n, n, U[ 0 ], U[ 2 ], U[ 3 ] );

	}

	// a big flat face cut into cells about `cell` metres (the light varies across it); uv from u0
	panel( a, b, d, n, cell = 0.8, u0 = [ 0, 0 ] ) {

		const ab = [ b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ], b[ 2 ] - a[ 2 ] ], ad = [ d[ 0 ] - a[ 0 ], d[ 1 ] - a[ 1 ], d[ 2 ] - a[ 2 ] ];
		const lu = Math.hypot( ...ab ), lv = Math.hypot( ...ad );
		const nu = Math.max( 1, Math.round( lu / cell ) ), nv = Math.max( 1, Math.round( lv / cell ) );
		const P = ( i, j ) => [ a[ 0 ] + ab[ 0 ] * i / nu + ad[ 0 ] * j / nv, a[ 1 ] + ab[ 1 ] * i / nu + ad[ 1 ] * j / nv, a[ 2 ] + ab[ 2 ] * i / nu + ad[ 2 ] * j / nv ];
		const U = ( i, j ) => [ u0[ 0 ] + lu * i / nu, u0[ 1 ] + lv * j / nv ];
		for ( let i = 0; i < nu; i ++ ) for ( let j = 0; j < nv; j ++ ) this.quad( P( i, j ), P( i + 1, j ), P( i + 1, j + 1 ), P( i, j + 1 ), n, [ U( i, j ), U( i + 1, j ), U( i + 1, j + 1 ), U( i, j + 1 ) ] );

	}

	// a four-sided face a, b, c, d (a->b along, d->c the far side; not a parallelogram: a room's floor
	// between a mitred wall and a square one), cut into cells about `cell` metres; uvf( p ) its pattern's uv
	panel4( a, b, c, d, n, cell = 0.8, uvf = null ) {

		const len = ( p, q ) => Math.hypot( q[ 0 ] - p[ 0 ], q[ 1 ] - p[ 1 ], q[ 2 ] - p[ 2 ] );
		const nu = Math.max( 1, Math.round( Math.max( len( a, b ), len( d, c ) ) / cell ) ), nv = Math.max( 1, Math.round( Math.max( len( a, d ), len( b, c ) ) / cell ) );
		const P = ( i, j ) => {

			const s = i / nu, t = j / nv;
			return [ 0, 1, 2 ].map( ( k ) => ( a[ k ] * ( 1 - s ) + b[ k ] * s ) * ( 1 - t ) + ( d[ k ] * ( 1 - s ) + c[ k ] * s ) * t );

		};
		const U = ( i, j ) => uvf ? uvf( P( i, j ) ) : [ i / nu, j / nv ];
		for ( let i = 0; i < nu; i ++ ) for ( let j = 0; j < nv; j ++ ) this.quad( P( i, j ), P( i + 1, j ), P( i + 1, j + 1 ), P( i, j + 1 ), n, [ U( i, j ), U( i + 1, j ), U( i + 1, j + 1 ), U( i, j + 1 ) ] );

	}

	// an atlas picture on a face (a->b along its bottom, d above a): uv rect [ u0, v0, u1, v1 ] (v0 at the top)
	print( a, b, c, d, n, r ) {

		this.quad( a, b, c, d, n, [ [ r[ 0 ], r[ 3 ] ], [ r[ 2 ], r[ 3 ] ], [ r[ 2 ], r[ 1 ] ], [ r[ 0 ], r[ 1 ] ] ] );

	}

	// a box in frame P (home/Build.js's Builder.frame): centre ( x, y, z ), sizes along right, up, forward.
	// skip: faces not wanted ( 'bottom', 'back', ... )
	box( P, x, y, z, sx, sy, sz, skip = null ) {

		const c = ( i, j, k ) => P( x + i * sx / 2, y + j * sy / 2, z + k * sz / 2 );
		const F = P.dir( 0, 0, 1 ), R = P.dir( 1, 0, 0 ), neg = ( v ) => [ - v[ 0 ], - v[ 1 ], - v[ 2 ] ];
		const no = ( f ) => skip && skip.includes( f );
		if ( ! no( 'front' ) ) this.quad( c( - 1, - 1, 1 ), c( 1, - 1, 1 ), c( 1, 1, 1 ), c( - 1, 1, 1 ), F );
		if ( ! no( 'back' ) ) this.quad( c( 1, - 1, - 1 ), c( - 1, - 1, - 1 ), c( - 1, 1, - 1 ), c( 1, 1, - 1 ), neg( F ) );
		if ( ! no( 'right' ) ) this.quad( c( 1, - 1, 1 ), c( 1, - 1, - 1 ), c( 1, 1, - 1 ), c( 1, 1, 1 ), R );
		if ( ! no( 'left' ) ) this.quad( c( - 1, - 1, - 1 ), c( - 1, - 1, 1 ), c( - 1, 1, 1 ), c( - 1, 1, - 1 ), neg( R ) );
		if ( ! no( 'top' ) ) this.quad( c( - 1, 1, 1 ), c( 1, 1, 1 ), c( 1, 1, - 1 ), c( - 1, 1, - 1 ), [ 0, 1, 0 ] );
		if ( ! no( 'bottom' ) ) this.quad( c( - 1, - 1, - 1 ), c( 1, - 1, - 1 ), c( 1, - 1, 1 ), c( - 1, - 1, 1 ), [ 0, - 1, 0 ] );

	}

	// an upright cylinder in frame P: axis at ( x, z ), y0 to y1, radii r0 (bottom) r1 (top)
	cyl( P, x, z, y0, y1, r0, r1, n = 10, top = true ) {

		const ring = ( y, r ) => {

			const out = [];
			for ( let i = 0; i <= n; i ++ ) {

				const a = i / n * Math.PI * 2;
				out.push( { p: P( x + Math.cos( a ) * r, y, z + Math.sin( a ) * r ), nr: P.dir( Math.cos( a ), ( r0 - r1 ) / ( y1 - y0 || 1 ), Math.sin( a ) ), u: [ i / n * Math.PI * 2 * r, y - y0 ] } );

			}

			return out;

		};

		const A = ring( y0, r0 ), B = ring( y1, r1 );
		for ( let i = 0; i < n; i ++ ) {

			this.tri( A[ i ].p, A[ i + 1 ].p, B[ i + 1 ].p, A[ i ].nr, A[ i + 1 ].nr, B[ i + 1 ].nr, A[ i ].u, A[ i + 1 ].u, B[ i + 1 ].u );
			this.tri( A[ i ].p, B[ i + 1 ].p, B[ i ].p, A[ i ].nr, B[ i + 1 ].nr, B[ i ].nr, A[ i ].u, B[ i + 1 ].u, B[ i ].u );

		}

		if ( top ) {

			const c = P( x, y1, z );
			for ( let i = 0; i < n; i ++ ) this.tri( c, B[ i ].p, B[ i + 1 ].p, [ 0, 1, 0 ], [ 0, 1, 0 ], [ 0, 1, 0 ] );

		}

	}

	get count() {

		return this.pos.length / 3;

	}

	geometry() {

		const g = new BufferGeometry();
		g.setAttribute( 'position', new Float32BufferAttribute( this.pos, 3 ) );
		g.setAttribute( 'normal', new Float32BufferAttribute( this.nrm, 3 ) );
		g.setAttribute( 'uv', new Float32BufferAttribute( this.uv, 2 ) );
		g.setAttribute( 'color', new Float32BufferAttribute( this.col, 4 ) );
		g.computeBoundingBox();
		g.computeBoundingSphere();
		return g;

	}

	mesh( material, name ) {

		const m = new Mesh( this.geometry(), material );
		m.name = name;
		m.receiveShadow = true;
		m.userData.dynamic = true; // kept out of the static batching: shown and hidden by distance
		return m;

	}

}

export const frame = Builder.frame;

// A set of meshes shown only while the camera's within reach of them: each [ mesh, centre [ x, y, z ]
// (field frame), radius ]; update() once a frame with the camera in the field frame. (The test is a few
// distances a frame: nothing when there's nothing to show.)
export class Reach {

	constructor( reach ) {

		this.reach = reach;
		this.items = [];
		this.any = false;

	}

	add( obj, centre, radius ) {

		this.items.push( { obj, c: centre, r: radius } );
		obj.visible = false;
		return obj;

	}

	update( cam ) {

		let any = false;
		for ( const it of this.items ) {

			const d = Math.hypot( cam[ 0 ] - it.c[ 0 ], cam[ 1 ] - it.c[ 1 ], cam[ 2 ] - it.c[ 2 ] ) - it.r;
			const on = d < this.reach;
			it.obj.visible = on;
			it.on = on;
			any ||= on;

		}

		this.any = any;
		return any;

	}

}

// ---------------------------------------------------------------- the glass in front of a room

// Within `near` m of the camera (and a dithered band beyond) the glass is clear and the room behind it is
// really there; past that it's traced in the glass's own shader (interior mapping) and the room isn't
// drawn. The two meshes split every pixel between them by the same test (nearK).
export function glassSplit( near, band ) {

	return /* wgsl */`
	let dith = fract( 52.9829189 * fract( dot( floor( in.pixel ), vec2f( 0.06711056, 0.00583715 ) ) ) );
	let dc = distance( in.P, frame.cameraPos );
	let nearK = dc < ${ near.toFixed( 1 ) } + ${ band.toFixed( 1 ) } * dith;
`;

}

// the clear glass, near the camera: a faint tint, the reflection at a glancing angle, smudges low down
export function clearGlass( name, near, band ) {

	const m = standard( { name, roughness: 0.04, metalness: 0.2, transparent: true, depthWrite: false, side: 'double', modules: [ commonModule ],
		surface: glassSplit( near, band ) + /* wgsl */`
	if ( ! nearK ) { discard; }
	let N = normalize( in.N );
	let V = normalize( frame.cameraPos - in.P );
	let fres = pow( 1.0 - clamp( abs( dot( N, V ) ), 0.0, 1.0 ), 4.0 );
	s.albedo = vec3f( 0.02, 0.026, 0.03 );
	s.alpha = 0.09 + 0.5 * fres;
	s.roughness = 0.04 + 0.08 * smoothstep( 0.6, 0.9, mx_noise_float2( in.P.xz * 3.0 + in.P.y * 2.0 ) ) * step( in.uv.y, 1.4 );
` } );
	m.underwaterLighting = 'none';
	m.setDefine( 'DRY', 1 );
	return m;

}

// the quads as a plain mesh (no colour), for the clear glass: on the late (transparent) pass
export function clearGlassMesh( b, material, name ) {

	const g = new BufferGeometry();
	g.setAttribute( 'position', new Float32BufferAttribute( b.pos, 3 ) );
	g.setAttribute( 'normal', new Float32BufferAttribute( b.nrm, 3 ) );
	g.setAttribute( 'uv', new Float32BufferAttribute( b.uv, 2 ) );
	g.computeBoundingBox();
	g.computeBoundingSphere();
	const m = new Mesh( g, material );
	m.name = name;
	m.layers.set( 2 );
	m.userData.dynamic = true;
	return m;

}

// the bowl's interior-mapping module (its figure() draws a person on a plane behind the glass), from a
// mesh of the bowl's that uses it
export function interiorsModule( bowl, meshName = 'suite-glass' ) {

	let mod = null;
	bowl?.group?.traverse( ( o ) => {

		if ( ! mod && o.isMesh && o.name === meshName ) mod = o.material.modules?.find( ( m ) => m.name === 'interiors' ) || null;

	} );
	return mod;

}

// someone in a room: dressed for a cold night indoors, placed and turned (face: [ x, z ] the way they look)
export const yawOf = ( face ) => Math.atan2( - face[ 0 ], - face[ 1 ] );

// The TVs showing the game: W2's broadcast (LiveTV's material, from whichever place has it) on quads of
// their own, one mesh; an old tube's green picture in the palette when there's no broadcast.
export class Screens {

	constructor( app ) {

		this.mat = null;
		for ( const p of app?.places || [] ) {

			if ( this.mat ) break;
			if ( p.tvMat ) this.mat = p.tvMat;
			p.group?.traverse( ( o ) => {

				if ( ! this.mat && o.isMesh && o.material?.name === 'concourse3b-tv' ) this.mat = o.material;

			} );

		}

		this.pos = []; this.nrm = []; this.uv = [];

	}

	// a screen on a face: a, b, c, d its corners (bottom left, bottom right, top right, top left, seen
	// from the front), n its normal; off: a dark screen
	add( b, a, bb, c, d, n, on = true ) {

		if ( this.mat && on ) {

			const lift = ( p ) => [ p[ 0 ] + n[ 0 ] * 0.004, p[ 1 ] + n[ 1 ] * 0.004, p[ 2 ] + n[ 2 ] * 0.004 ];
			const P = [ lift( a ), lift( bb ), lift( c ), lift( a ), lift( c ), lift( d ) ];
			for ( const p of P ) this.pos.push( ...p );
			for ( let k = 0; k < 6; k ++ ) this.nrm.push( ...n );
			this.uv.push( 0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0 );

		} else b.use( on ? 'screen' : 'plastic' ).quad( a, bb, c, d, n, [ [ 0, 0 ], [ 1, 0 ], [ 1, 1 ], [ 0, 1 ] ] );

	}

	mesh( name ) {

		if ( ! this.mat || ! this.pos.length ) return null;
		const g = new BufferGeometry();
		g.setAttribute( 'position', new Float32BufferAttribute( this.pos, 3 ) );
		g.setAttribute( 'normal', new Float32BufferAttribute( this.nrm, 3 ) );
		g.setAttribute( 'uv', new Float32BufferAttribute( this.uv, 2 ) );
		g.computeBoundingBox();
		g.computeBoundingSphere();
		const m = new Mesh( g, this.mat );
		m.name = name;
		m.userData.dynamic = true;
		m.visible = false;
		return m;

	}

}

// a wall the walker can't go through: a box from p to q ([ x, z ] field) on a floor at y, h tall
export function wallCollider( colliders, field, p, q, y, h, th = 0.15, tag = 'inside-wall' ) {

	if ( ! colliders || ! field ) return;
	const l = Math.hypot( q[ 0 ] - p[ 0 ], q[ 1 ] - p[ 1 ] );
	if ( l < 0.05 ) return;
	const w = field.toWorld( ( p[ 0 ] + q[ 0 ] ) / 2, ( p[ 1 ] + q[ 1 ] ) / 2 );
	colliders.addBox( new Vector3( w.x, field.y0 + y + h / 2, w.z ), new Vector3( l / 2, h / 2, th / 2 ), field.group.rotation.y - Math.atan2( q[ 1 ] - p[ 1 ], q[ 0 ] - p[ 0 ] ), { tag } );

}

