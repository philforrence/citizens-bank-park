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
	P_BALLS = 9, P_CMU = 10, P_TURF = 11, P_NET = 12, P_SCREEN = 13, P_RIBS = 14,
	P_PLANKS = 15, P_SLAT = 16, P_PIN = 17, P_STEEL = 18, P_ICE = 19, P_GRIDCEIL = 20; // ---- FI3
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
	openGrid: [ [ 0.19, 0.15, 0.11 ], 0.6, 0.3, 0, P_GRIDCEIL ], // ---- FI3 (C2I-15): the suite corridor's dark bronze open-cell ceiling
	cmu: [ [ 0.5, 0.49, 0.46 ], 0.75, 0, 0, P_CMU ], // painted block
	cmuRed: [ [ 0.3, 0.02, 0.025 ], 0.6, 0, 0, P_CMU ],
	concrete: [ [ 0.3, 0.29, 0.27 ], 0.85, 0, 0, P_SPECKLE ],
	deck: [ [ 0.2, 0.2, 0.2 ], 0.6, 0.3, 0, P_RIBS ],
	// wood, stone, metal
	honey: [ [ 0.42, 0.2, 0.07 ], 0.45, 0, 0, P_GRAIN ], // the stools' and the wainscot's
	cherry: [ [ 0.2, 0.075, 0.03 ], 0.4, 0, 0, P_GRAIN ], // the cabinets, the doors
	oak: [ [ 0.45, 0.3, 0.14 ], 0.45, 0, 0, P_GRAIN ], // the Diamond Club's blond oak
	granite: [ [ 0.05, 0.045, 0.04 ], 0.2, 0, 0, P_SPECKLE ],
	// (---- FI3 (C2I-8): stainless and chrome mirror the room, faked (P_STEEL): the ceiling and its cans over
	// them, the dark floor under; they were metals mirroring the sky probe, so matte white indoors)
	stainless: [ [ 0.55, 0.56, 0.57 ], 0.3, 0, 0, P_STEEL ],
	chrome: [ [ 0.7, 0.7, 0.72 ], 0.15, 0, 0, P_STEEL ],
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
	frost: [ [ 0.3, 0.4, 0.56 ], 0.3, 0, 0.7, P_PLAIN ], // frosted glass lit from behind, blue-white
	// ---- FI3 (C2I-3): the Clubhouse Store's: its maple floor, the slatwall, what's on the racks (the
	// home whites' red pinstripes, the 2008 cream alternates, the road greys, the red jackets, the black
	// World Series tees, hoodies, the caps), the chrome, the lit signs' boxes
	maple: [ [ 0.42, 0.27, 0.13 ], 0.35, 0, 0, P_PLANKS ],
	slatwall: [ [ 0.36, 0.35, 0.33 ], 0.6, 0, 0, P_SLAT ],
	pinstripe: [ [ 0.74, 0.73, 0.69 ], 0.85, 0, 0, P_PIN ],
	creamCloth: [ [ 0.68, 0.6, 0.45 ], 0.85, 0, 0, P_PLAIN ],
	roadGrey: [ [ 0.36, 0.36, 0.37 ], 0.85, 0, 0, P_PLAIN ],
	redCloth: [ [ 0.36, 0.02, 0.028 ], 0.75, 0, 0, P_PLAIN ],
	darkRed: [ [ 0.16, 0.012, 0.018 ], 0.8, 0, 0, P_PLAIN ],
	blackCloth: [ [ 0.022, 0.022, 0.025 ], 0.9, 0, 0, P_PLAIN ],
	navyCloth: [ [ 0.014, 0.022, 0.065 ], 0.9, 0, 0, P_PLAIN ],
	greyCloth: [ [ 0.22, 0.22, 0.22 ], 0.95, 0, 0, P_PLAIN ],
	whiteCloth: [ [ 0.72, 0.72, 0.7 ], 0.9, 0, 0, P_PLAIN ],
	powderCloth: [ [ 0.3, 0.46, 0.66 ], 0.85, 0, 0, P_PLAIN ],
	mannequin: [ [ 0.62, 0.61, 0.58 ], 0.35, 0, 0, P_PLAIN ], // a dress form's white shell
	bag: [ [ 0.5, 0.03, 0.04 ], 0.5, 0, 0, P_PLAIN ], // the store's red plastic bags
	signYellow: [ [ 0.78, 0.55, 0.02 ], 0.4, 0, 0.5, P_PLAIN ], // the World Series signs' frames
	paper: [ [ 0.8, 0.79, 0.74 ], 0.8, 0, 0, P_PLAIN ],
	navyFrame: [ [ 0.016, 0.024, 0.062 ], 0.4, 0.35, 0, P_PLAIN ], // (C2I-9) the suites' mullions
	// (C2I-8) the suite's buffet: chicken fingers, meatballs in their sauce, hot dogs and their rolls; the
	// galvanized bucket's ice, brown and green bottles, the cans; the sterno's flame
	golden: [ [ 0.55, 0.33, 0.1 ], 0.6, 0, 0, P_SPECKLE ],
	meat: [ [ 0.16, 0.05, 0.025 ], 0.45, 0, 0, P_SPECKLE ],
	sauce: [ [ 0.3, 0.04, 0.02 ], 0.3, 0, 0, P_PLAIN ],
	bun: [ [ 0.62, 0.42, 0.2 ], 0.8, 0, 0, P_PLAIN ],
	galvanized: [ [ 0.38, 0.39, 0.4 ], 0.5, 0, 0, P_STEEL ],
	ice: [ [ 0.7, 0.74, 0.76 ], 0.15, 0, 0, P_ICE ],
	glassBrown: [ [ 0.12, 0.05, 0.012 ], 0.1, 0, 0, P_STEEL ],
	glassGreen: [ [ 0.02, 0.12, 0.04 ], 0.1, 0, 0, P_STEEL ],
	canSilver: [ [ 0.6, 0.62, 0.65 ], 0.25, 0, 0, P_STEEL ],
	canRed: [ [ 0.5, 0.02, 0.03 ], 0.3, 0, 0, P_STEEL ],
	canBlue: [ [ 0.04, 0.1, 0.45 ], 0.3, 0, 0, P_STEEL ],
	flame: [ [ 0.3, 0.4, 0.9 ], 0.5, 0, 2.5, P_PLAIN ],
	fridgeBack: [ [ 0.7, 0.74, 0.78 ], 0.4, 0, 0.9, P_PLAIN ],
	helmetRed: [ [ 0.34, 0.015, 0.025 ], 0.12, 0, 0, P_STEEL ], // (C2I-11) a batting helmet's gloss
	helmetNavy: [ [ 0.02, 0.03, 0.11 ], 0.12, 0, 0, P_STEEL ],
	// ---- end FI3
};
export const PAL_KEYS = Object.keys( PAL );
const IDX = Object.fromEntries( PAL_KEYS.map( ( k, i ) => [ k, i ] ) );
const f3 = ( v ) => `vec3f( ${ v.map( ( x ) => x.toFixed( 4 ) ).join( ', ' ) } )`;

// ---------------------------------------------------------------- the atlas: what's printed

// 2048 x 2048, cells of 256: [ col, row, cols, rows ]
export const ATLAS = {
	muralCrowd: [ 0, 0, 4, 1 ], muralVet: [ 4, 0, 4, 1 ],
	paintings: [ 0, 1, 8, 1 ], // eight canvases, a cell each
	bakerBowl: [ 0, 2, 2, 1 ], connieMack: [ 2, 2, 2, 1 ], recPark: [ 4, 2, 2, 1 ], shibe: [ 6, 2, 2, 1 ],
	plaques: [ 0, 3, 2, 1 ], // 32 home-plate plaques with the suites' numbers (8 x 4)
	hofSign: [ 2, 3, 2, 1 ], diamondSign: [ 4, 3, 2, 1 ], muralClub: [ 6, 3, 2, 1 ],
	// ---- FI3: the gallery's other sixteen canvases (C2I-12), the Clubhouse Store's chest prints and cap
	// fronts (16, 8 x 2: cellUV( 'prints', i, 8, 2 )), its signs (C2I-3), the lounge's back-bar panels (C2I-10)
	paintings2: [ 0, 4, 8, 1 ], paintings3: [ 0, 5, 8, 1 ],
	prints: [ 0, 6, 8, 1 ],
	wsSign: [ 0, 7, 2, 1 ], champsSign: [ 2, 7, 2, 1 ], loungePanel: [ 4, 7, 2, 1 ], muralCrowd2: [ 6, 7, 2, 1 ],
	// ---- end FI3
};
const AW = 2048, AH = 2048, CELL = 256; // ---- FI3: two more rows of cells (was 1024 tall)
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
	// crowd on its feet in red, the towels up; and the old Vet at night from the 700 level. ---- FI3
	// (C2I-15): the crowd as a photograph, not polka dots: rows going back and smaller, faces with their
	// eyes and the stadium light on them, caps, towels and arms up, the near ones big and soft; and a third,
	// the 1980 parade down Broad Street (confetti, the crowd lining it, the flatbeds)
	{

		const [ x0, y0, w, h ] = R( 'muralCrowd' ), r = rnd( 7 );
		const g = ctx.createLinearGradient( 0, y0, 0, y0 + h );
		g.addColorStop( 0, '#1a1614' ); g.addColorStop( 1, '#3a1a18' );
		ctx.fillStyle = g;
		ctx.fillRect( x0, y0, w, h );
		const skins = [ '#e0b090', '#d29a78', '#c08060', '#a86a48', '#8a5236', '#6a3c26' ];
		for ( let row = 0; row < 7; row ++ ) {

			const sz = 7 + row * row * 0.75, yy = y0 + 8 + row * ( 6 + row * 3.6 );
			for ( let x = x0 - sz; x < x0 + w + sz; x += sz * ( 1.5 + r() * 0.5 ) ) {

				const cx = x + ( r() - 0.5 ) * sz * 0.4, top = yy + ( r() - 0.5 ) * sz * 0.3;
				// the body: a red jacket mostly, a white jersey, a dark coat
				const jk = r();
				ctx.fillStyle = jk < 0.58 ? `hsl(355, ${ 65 + r() * 20 }%, ${ 30 + r() * 14 }%)` : jk < 0.78 ? '#e2ddd2' : `hsl(220, 20%, ${ 12 + r() * 12 }%)`;
				ctx.beginPath(); ctx.ellipse( cx, top + sz * 1.6, sz * 0.85, sz * 0.9, 0, Math.PI, 0 ); ctx.fill();
				ctx.fillRect( cx - sz * 0.85, top + sz * 1.6, sz * 1.7, sz * 1.4 );
				// an arm up with a white towel, now and then
				if ( r() < 0.3 ) {

					const side = r() < 0.5 ? - 1 : 1;
					ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = sz * 0.35;
					ctx.beginPath(); ctx.moveTo( cx + side * sz * 0.6, top + sz * 1.4 ); ctx.lineTo( cx + side * sz * 0.9, top - sz * 0.4 ); ctx.stroke();
					ctx.fillStyle = '#f2efe8';
					ctx.fillRect( cx + side * sz * 0.9 - sz * 0.4, top - sz * 1.1, sz * 0.8, sz * 0.7 );

				}

				// the head: lit from above, the shadow side, the eyes, a cap on most
				const sk = skins[ Math.floor( r() * skins.length ) ];
				ctx.fillStyle = sk;
				ctx.beginPath(); ctx.ellipse( cx, top + sz * 0.6, sz * 0.48, sz * 0.6, 0, 0, Math.PI * 2 ); ctx.fill();
				ctx.fillStyle = 'rgba(30,10,5,0.35)';
				ctx.beginPath(); ctx.ellipse( cx + sz * 0.18, top + sz * 0.65, sz * 0.28, sz * 0.52, 0, - Math.PI / 2, Math.PI / 2 ); ctx.fill();
				ctx.fillStyle = '#140c08';
				ctx.fillRect( cx - sz * 0.25, top + sz * 0.5, sz * 0.14, sz * 0.08 ); ctx.fillRect( cx + sz * 0.1, top + sz * 0.5, sz * 0.14, sz * 0.08 );
				ctx.fillStyle = 'rgba(90,30,20,0.6)'; ctx.fillRect( cx - sz * 0.15, top + sz * 0.85, sz * 0.3, sz * 0.06 );
				if ( r() < 0.7 ) {

					ctx.fillStyle = r() < 0.75 ? '#a8141e' : r() < 0.5 ? '#1b2a57' : '#e8e4da';
					ctx.beginPath(); ctx.ellipse( cx, top + sz * 0.32, sz * 0.52, sz * 0.36, 0, Math.PI, 0 ); ctx.fill();
					ctx.fillRect( cx - sz * 0.1, top + sz * 0.3, sz * 0.7, sz * 0.1 );

				} else {

					ctx.fillStyle = [ '#1a1410', '#3a2a1a', '#6a4a2a', '#8a7a6a' ][ Math.floor( r() * 4 ) ];
					ctx.beginPath(); ctx.ellipse( cx, top + sz * 0.22, sz * 0.48, sz * 0.25, 0, Math.PI, 0 ); ctx.fill();

				}

			}

		}

		// the photograph's grain and the light falling off at its edges
		for ( let k = 0; k < 2500; k ++ ) {

			ctx.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)';
			ctx.fillRect( x0 + r() * w, y0 + r() * h, 2, 2 );

		}

		const v = ctx.createRadialGradient( x0 + w / 2, y0 + h / 2, h * 0.4, x0 + w / 2, y0 + h / 2, w * 0.6 );
		v.addColorStop( 0, 'rgba(0,0,0,0)' ); v.addColorStop( 1, 'rgba(0,0,0,0.45)' );
		ctx.fillStyle = v; ctx.fillRect( x0, y0, w, h );
		ctx.fillStyle = 'rgba(255,255,255,0.85)';
		ctx.font = `italic bold 30px ${ SERIF }`;
		ctx.fillText( 'The Fans', x0 + 24, y0 + h - 18 );

	}
	{

		const [ x0, y0, w, h ] = R( 'muralCrowd2' ), r = rnd( 1980 );
		// Broad Street, 1 November 1980: the buildings either side going back to the hall's tower, the crowd
		// packed along the curbs, the flatbeds in the middle, the confetti and the paper falling
		const g = ctx.createLinearGradient( 0, y0, 0, y0 + h );
		g.addColorStop( 0, '#9ab0c4' ); g.addColorStop( 0.5, '#c8c4b4' ); g.addColorStop( 1, '#5a5650' );
		ctx.fillStyle = g; ctx.fillRect( x0, y0, w, h );
		const vx = x0 + w / 2, vy = y0 + h * 0.36;
		ctx.fillStyle = '#8a7a6a'; ctx.fillRect( vx - 8, y0 + 20, 16, vy - y0 - 20 ); ctx.fillRect( vx - 4, y0 + 8, 8, 14 );
		for ( const sd of [ - 1, 1 ] ) for ( let k = 0; k < 7; k ++ ) {

			const xa = vx + sd * ( 30 + k * 34 ), ht = 60 + r() * 70;
			ctx.fillStyle = `hsl(${ 20 + r() * 20 }, ${ 10 + r() * 15 }%, ${ 35 + r() * 25 }%)`;
			ctx.beginPath(); ctx.moveTo( xa, vy - ht * ( 0.4 + k * 0.1 ) ); ctx.lineTo( xa + sd * 34, vy - ht * ( 0.5 + k * 0.12 ) ); ctx.lineTo( xa + sd * 34, vy + 40 + k * 6 ); ctx.lineTo( xa, vy + 30 + k * 6 ); ctx.fill();
			ctx.fillStyle = 'rgba(30,30,40,0.5)';
			for ( let j = 0; j < 6; j ++ ) ctx.fillRect( xa + sd * 8, vy - ht * 0.3 + j * 10, sd * 18, 5 );

		}

		ctx.fillStyle = '#4a4844';
		ctx.beginPath(); ctx.moveTo( vx - 14, vy + 8 ); ctx.lineTo( vx + 14, vy + 8 ); ctx.lineTo( x0 + w * 0.8, y0 + h ); ctx.lineTo( x0 + w * 0.2, y0 + h ); ctx.fill();
		for ( let k = 0; k < 1400; k ++ ) {

			const t = r(), sd = r() < 0.5 ? - 1 : 1, yy = vy + 10 + t * ( h * 0.64 - 10 ), half = 14 + t * ( w * 0.3 - 14 );
			const xx = vx + sd * ( half + r() * ( 20 + t * 140 ) ), s = 1 + t * 5;
			ctx.fillStyle = r() < 0.55 ? `hsl(355, 60%, ${ 30 + r() * 20 }%)` : r() < 0.5 ? '#d8d0c0' : '#2a2a3a';
			ctx.fillRect( xx, yy - s, s, s * 1.6 );

		}

		for ( const [ t, c ] of [ [ 0.35, '#e8e4da' ], [ 0.65, '#d8d4c8' ] ] ) {

			const yy = vy + t * h * 0.55, s = 0.5 + t;
			ctx.fillStyle = c; ctx.fillRect( vx - 30 * s, yy, 60 * s, 14 * s );
			ctx.fillStyle = '#7a0a14'; ctx.fillRect( vx - 30 * s, yy + 10 * s, 60 * s, 4 * s );
			for ( let j = - 2; j <= 2; j ++ ) { ctx.fillStyle = j % 2 ? '#e8e4da' : '#6a1020'; ctx.fillRect( vx + j * 10 * s - 2 * s, yy - 12 * s, 4 * s, 12 * s ); }

		}

		for ( let k = 0; k < 900; k ++ ) {

			ctx.fillStyle = [ '#f2efe6', '#e8c040', '#c82030', '#4a7ac8' ][ Math.floor( r() * 4 ) ];
			ctx.fillRect( x0 + r() * w, y0 + r() * h * 0.8, 2, 2 );

		}

		ctx.fillStyle = 'rgba(255,255,255,0.85)';
		ctx.font = `italic bold 26px ${ SERIF }`;
		ctx.fillText( 'Broad Street, 1980', x0 + 20, y0 + h - 14 );

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

	// the Cooperstown Gallery's canvases (---- FI3 (C2I-12): drawPortraits, below)
	drawPortraits( ctx, R );

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
	// this one's invented). ---- FI3 (C2I-10): tall stylized figures in a painter's manner, each his own pose
	// and colour (a batter's swing, a pitcher's kick, a catcher's crouch, a fielder's reach, a runner), long
	// limbs, warm grounds, nobody's face (it was eleven identical cream bars: a barcode); and the back bar's
	// panels: dark, columns of names in white, a great glowing figure in each (harpo42, Aug 2008)
	drawLounge( ctx, R, SANS );

	drawStore( ctx, R, SANS, SERIF ); // ---- FI3

}

// ---- FI3 (C2I-3): the Clubhouse Store's printing. The chest prints and cap fronts, 16 cells of 256 x 128
// (cellUV( 'prints', i, 8, 2 )): what the 2008 racks carried (Getty, 20 and 25 Oct 2008: the home whites
// and their script, the World Series tees, NL champions, the red jackets with the P), each print on its
// garment's own colour so it reads as part of the cloth. The signs: a yellow-framed World Series board
// (after the frame in the Getty photo; the mark is invented, not MLB's) and the jersey wall's header.
export const PRINT = { home: 0, alt: 1, road: 2, ws: 3, champs: 4, pJacket: 5, hoodie: 6, redOct: 7, capRed: 8, capNavy: 9, capWS: 10, capWhite: 11, price: 12, tag: 13, bag: 14, kids: 15 };
const SCRIPT = '"Brush Script MT", "Snell Roundhand", "Segoe Script", cursive';
function drawStore( ctx, R, SANS, SERIF ) {

	const [ px0, py0 ] = R( 'prints' );
	const cell = ( i ) => [ px0 + ( i % 8 ) * CELL, py0 + Math.floor( i / 8 ) * 128, CELL, 128 ];
	const fill = ( i, bg ) => {

		const [ x, y, w, h ] = cell( i );
		ctx.fillStyle = bg;
		ctx.fillRect( x, y, w, h );
		return [ x, y, w, h ];

	};
	const centred = ( text, x, y, font, color, maxW ) => {

		ctx.font = font; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
		ctx.fillText( text, x, y, maxW );
		ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

	};
	const script = ( i, bg, fg, edge, pin ) => {

		const [ x, y, w, h ] = fill( i, bg );
		if ( pin ) {

			ctx.fillStyle = pin;
			for ( let k = 4; k < w; k += 9 ) ctx.fillRect( x + k, y, 1.5, h );

		}

		ctx.font = `italic bold 84px ${ SCRIPT }`;
		ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
		ctx.lineJoin = 'round';
		if ( edge ) {

			ctx.strokeStyle = edge; ctx.lineWidth = 7;
			ctx.strokeText( 'Phillies', x + w / 2, y + h * 0.5, w - 20 );

		}

		ctx.fillStyle = fg;
		ctx.fillText( 'Phillies', x + w / 2, y + h * 0.5, w - 20 );
		// the swash under it
		ctx.strokeStyle = fg; ctx.lineWidth = 5;
		ctx.beginPath(); ctx.moveTo( x + 70, y + h * 0.82 ); ctx.quadraticCurveTo( x + w / 2, y + h * 0.74, x + w - 34, y + h * 0.78 ); ctx.stroke();
		ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

	};
	script( PRINT.home, '#bdbbb2', '#b8102a', '#1b2a57', '#c84a52' );
	script( PRINT.alt, '#b1a07a', '#b8102a', '#1b2a57', null );
	script( PRINT.road, '#7c7c80', '#b8102a', '#1b2a57', null );
	{

		// the black World Series tee: the trophy's flags in gold over the words
		const [ x, y, w, h ] = fill( PRINT.ws, '#0e0e10' );
		ctx.fillStyle = '#c9a24a';
		for ( let k = 0; k < 9; k ++ ) {

			const fx = x + w / 2 - 44 + k * 11;
			ctx.fillRect( fx, y + 10, 2, 30 );
			ctx.beginPath(); ctx.moveTo( fx + 2, y + 10 ); ctx.lineTo( fx + 11, y + 15 ); ctx.lineTo( fx + 2, y + 20 ); ctx.fill();

		}

		centred( 'WORLD SERIES', x + w / 2, y + 62, `bold 34px ${ SERIF }`, '#e8e2d0', w - 20 );
		centred( '2008', x + w / 2, y + 100, `bold 36px ${ SANS }`, '#c9a24a', w - 40 );

	}
	{

		const [ x, y, w ] = fill( PRINT.champs, '#7a0a14' );
		centred( 'PHILLIES', x + w / 2, y + 34, `bold 40px ${ SANS }`, '#f2efe6', w - 20 );
		centred( 'NATIONAL LEAGUE', x + w / 2, y + 72, `bold 22px ${ SANS }`, '#f2efe6', w - 30 );
		centred( 'CHAMPIONS  2008', x + w / 2, y + 102, `bold 24px ${ SANS }`, '#e8c25a', w - 30 );

	}
	{

		// the red jacket's chest: the P in its white roundel
		const [ x, y, w, h ] = fill( PRINT.pJacket, '#7a0a14' );
		ctx.fillStyle = '#efece4'; ctx.beginPath(); ctx.arc( x + w / 2, y + h / 2, 48, 0, Math.PI * 2 ); ctx.fill();
		ctx.fillStyle = '#1b2a57'; ctx.beginPath(); ctx.arc( x + w / 2, y + h / 2, 42, 0, Math.PI * 2 ); ctx.fill();
		centred( 'P', x + w / 2 - 2, y + h / 2 + 4, `italic bold 74px ${ SCRIPT }`, '#efece4' );

	}
	{

		const [ x, y, w ] = fill( PRINT.hoodie, '#0c1430' );
		centred( 'PHILLIES', x + w / 2, y + 58, `bold 54px ${ SANS }`, '#b8102a', w - 24 );
		centred( 'PHILADELPHIA', x + w / 2, y + 98, `bold 20px ${ SANS }`, '#e8e4da', w - 60 );

	}
	{

		const [ x, y, w ] = fill( PRINT.redOct, '#7a0a14' );
		centred( 'RED', x + w / 2, y + 40, `bold 44px ${ SANS }`, '#111', w - 20 );
		centred( 'OCTOBER', x + w / 2, y + 86, `bold 44px ${ SANS }`, '#111', w - 20 );

	}
	// the caps' fronts: the P on red, on navy, the World Series cap's gold on black, a white P cap
	const capP = ( i, bg, fg, edge ) => {

		const [ x, y, w, h ] = fill( i, bg );
		ctx.font = `italic bold 104px ${ SCRIPT }`;
		ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
		if ( edge ) {

			ctx.strokeStyle = edge; ctx.lineWidth = 6; ctx.strokeText( 'P', x + w / 2, y + h / 2 + 6 );

		}

		ctx.fillStyle = fg; ctx.fillText( 'P', x + w / 2, y + h / 2 + 6 );
		ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

	};
	capP( PRINT.capRed, '#6a0812', '#f2efe6', null );
	capP( PRINT.capNavy, '#0c1430', '#b8102a', '#f2efe6' );
	{

		const [ x, y, w ] = fill( PRINT.capWS, '#0e0e10' );
		centred( 'WORLD', x + w / 2, y + 40, `bold 34px ${ SERIF }`, '#c9a24a', w - 40 );
		centred( 'SERIES', x + w / 2, y + 74, `bold 34px ${ SERIF }`, '#c9a24a', w - 40 );
		centred( '2008', x + w / 2, y + 106, `bold 22px ${ SANS }`, '#e8e2d0', w - 40 );

	}
	capP( PRINT.capWhite, '#bdbbb2', '#b8102a', '#1b2a57' );
	{

		// a price card, a hang tag, the store's bag, a kids' tee
		const [ x, y, w ] = fill( PRINT.price, '#e9e6dc' );
		ctx.fillStyle = '#b8102a'; ctx.fillRect( x, y, w, 30 );
		centred( 'AUTHENTIC', x + w / 2, y + 16, `bold 20px ${ SANS }`, '#fff', w - 20 );
		centred( '$24.99', x + w / 2, y + 80, `bold 54px ${ SANS }`, '#111', w - 20 );

	}
	{

		const [ x, y, w ] = fill( PRINT.tag, '#e9e6dc' );
		centred( 'OFFICIAL', x + w / 2, y + 40, `bold 26px ${ SANS }`, '#1b2a57', w - 20 );
		centred( 'ON FIELD', x + w / 2, y + 84, `bold 26px ${ SANS }`, '#b8102a', w - 20 );

	}
	{

		const [ x, y, w ] = fill( PRINT.bag, '#6a0812' );
		centred( 'Phillies', x + w / 2, y + 52, `italic bold 64px ${ SCRIPT }`, '#f2efe6', w - 30 );
		centred( 'CLUBHOUSE STORE', x + w / 2, y + 100, `bold 18px ${ SANS }`, '#f2efe6', w - 40 );

	}
	{

		const [ x, y, w ] = fill( PRINT.kids, '#3f6da0' );
		centred( 'PHILLIES', x + w / 2, y + 44, `bold 40px ${ SANS }`, '#f2efe6', w - 30 );
		centred( '2008', x + w / 2, y + 90, `bold 36px ${ SANS }`, '#b8102a', w - 40 );

	}

	// the World Series board: a yellow frame, the board in deep blue, the year big, FALL CLASSIC; an
	// invented mark (a diamond of stars), not the league's
	{

		const [ x, y, w, h ] = R( 'wsSign' );
		ctx.fillStyle = '#e8b600'; ctx.fillRect( x, y, w, h );
		ctx.fillStyle = '#c42030'; ctx.fillRect( x + 10, y + 10, w - 20, h - 20 );
		ctx.fillStyle = '#e8b600'; ctx.fillRect( x + 18, y + 18, w - 36, h - 36 );
		const g = ctx.createLinearGradient( 0, y + 30, 0, y + h - 30 );
		g.addColorStop( 0, '#2a3d8a' ); g.addColorStop( 1, '#14204a' );
		ctx.fillStyle = g; ctx.fillRect( x + 30, y + 30, w - 60, h - 60 );
		ctx.save();
		ctx.translate( x + 110, y + h / 2 ); ctx.rotate( Math.PI / 4 );
		ctx.strokeStyle = '#e8b600'; ctx.lineWidth = 6; ctx.strokeRect( - 46, - 46, 92, 92 );
		ctx.restore();
		for ( let k = 0; k < 5; k ++ ) centred( '★', x + 110 + ( k - 2 ) * 15, y + h / 2 + ( k % 2 ? - 10 : 6 ), `bold 20px ${ SANS }`, '#f2efe6' );
		centred( 'WORLD SERIES', x + 320, y + 92, `bold 50px ${ SERIF }`, '#f2efe6', 300 );
		centred( '2008', x + 320, y + 160, `bold 76px ${ SANS }`, '#e8b600', 280 );
		centred( 'FALL CLASSIC', x + 320, y + 210, `bold 20px ${ SANS }`, '#c9d2ee', 260 );

	}
	// the header over the jersey wall
	{

		const [ x, y, w, h ] = R( 'champsSign' );
		ctx.fillStyle = '#7a0a14'; ctx.fillRect( x, y, w, h );
		ctx.fillStyle = '#efe9da'; ctx.fillRect( x, y + 8, w, 6 ); ctx.fillRect( x, y + h - 14, w, 6 );
		centred( '2008 NATIONAL LEAGUE', x + w / 2, y + 66, `bold 46px ${ SANS }`, '#f2efe6', w - 40 );
		centred( 'CHAMPIONS', x + w / 2, y + 130, `bold 66px ${ SERIF }`, '#e8c25a', w - 60 );
		centred( 'WORLD SERIES COLLECTION  ·  IN STORE NOW', x + w / 2, y + 196, `bold 24px ${ SANS }`, '#f2efe6', w - 40 );

	}

}

// ---- FI3 (C2I-12): the Cooperstown Gallery's canvases, 24 of them (rows 'paintings', 'paintings2',
// 'paintings3'): Dick Perez's oils were richly coloured portraits, head and shoulders large over a montage
// (a ballpark, a figure in action). Not his paintings, nor anyone's likeness: invented, in an oil
// painter's manner: a head with its planes of light and shadow, eyes, brows, a moustache on some; the
// uniform and cap of an era (the 1915 pennant Phillies' collared flannels, the 1950 Whiz Kids' pinstripes,
// the Athletics' blue, the 1980 maroon, the powder blue road greys); behind them a grandstand's arches, a
// crowd in dabs, a small second figure swinging or pitching. (There were eight cartoons, faceless.)
export const PAINTINGS = 24;
function drawPortraits( ctx, R ) {

	const rows = [ R( 'paintings' ), R( 'paintings2' ), R( 'paintings3' ) ];
	const r = rnd( 1883 );
	// [ jersey, trim/script, cap crown, cap bill, collar ]
	const eras = [
		[ '#e6e0d0', '#1d2b55', '#1d2b55', '#1d2b55', true ], // 1915: flannel, navy, a collar
		[ '#d9d4c6', '#2a3a6a', '#d9d4c6', '#2a3a6a', true ], // a road grey, the striped cap
		[ '#ece8dc', '#b0141e', '#b0141e', '#b0141e', false ], // 1950: pinstripes, the red script
		[ '#ece8dc', '#14285a', '#14285a', '#14285a', false ], // the Athletics' white and blue
		[ '#e9e4d6', '#6a1020', '#6a1020', '#6a1020', false ], // 1980: maroon pinstripes
		[ '#8fa9cc', '#6a1020', '#6a1020', '#6a1020', false ], // the powder blue road
		[ '#c9c4b8', '#3a3a3a', '#202020', '#202020', true ], // an old grey, a dark cap
		[ '#ece8dc', '#0e3b7a', '#ece8dc', '#0e3b7a', false ], // the A's, a white cap
	];
	const skins = [ '#e0b090', '#d29a78', '#c08060', '#a86a48', '#8a5236', '#6a3c26' ];
	const hairs = [ '#2a1a10', '#4a3020', '#6a4a2a', '#1a1410', '#8a7a6a' ];
	for ( let i = 0; i < PAINTINGS; i ++ ) {

		const [ rx, ry ] = rows[ Math.floor( i / 8 ) ], x = rx + ( i % 8 ) * CELL, y = ry, S = CELL;
		const era = eras[ ( i * 5 + Math.floor( i / 8 ) ) % eras.length ];
		ctx.save();
		ctx.beginPath(); ctx.rect( x, y, S, S ); ctx.clip();
		// the ground: a sky going to dusk or a studio brown
		const g = ctx.createLinearGradient( 0, y, 0, y + S );
		const studio = i % 3 === 2;
		const skyA = studio ? `hsl(${ 25 + r() * 20 }, 35%, ${ 28 + r() * 10 }%)` : `hsl(${ 195 + r() * 30 }, ${ 25 + r() * 20 }%, ${ 55 + r() * 15 }%)`;
		const skyB = studio ? `hsl(${ 20 + r() * 15 }, 30%, 14%)` : `hsl(${ 30 + r() * 20 }, ${ 30 + r() * 20 }%, ${ 45 + r() * 15 }%)`;
		g.addColorStop( 0, skyA ); g.addColorStop( 1, skyB );
		ctx.fillStyle = g; ctx.fillRect( x, y, S, S );
		if ( ! studio ) {

			// a grandstand's arches across the middle distance, the crowd in dabs, the field's green below
			const gy = y + S * ( 0.42 + r() * 0.1 );
			ctx.fillStyle = `hsl(${ 20 + r() * 15 }, 25%, ${ 40 + r() * 15 }%)`;
			ctx.fillRect( x, gy, S, S * 0.2 );
			ctx.fillStyle = 'rgba(40,30,25,0.55)';
			for ( let k = 0; k < 9; k ++ ) {

				ctx.beginPath(); ctx.ellipse( x + 14 + k * 30, gy + S * 0.13, 9, 14, 0, Math.PI, 0 ); ctx.fill();
				ctx.fillRect( x + 5 + k * 30, gy + S * 0.13, 18, 14 );

			}

			for ( let k = 0; k < 140; k ++ ) {

				ctx.fillStyle = r() < 0.5 ? 'rgba(120,30,30,0.6)' : r() < 0.5 ? 'rgba(220,210,190,0.55)' : 'rgba(40,40,60,0.5)';
				ctx.fillRect( x + r() * S, gy - 2 + r() * S * 0.08, 3, 3 );

			}

			ctx.fillStyle = `hsl(${ 90 + r() * 30 }, 30%, ${ 30 + r() * 10 }%)`;
			ctx.fillRect( x, gy + S * 0.2, S, S );

		}

		// the small figure in action, off to one side: a batter's swing or a pitcher's stride, in silhouette
		{

			const fx = x + ( r() < 0.5 ? S * 0.17 : S * 0.83 ), fy = y + S * 0.58, sc = 0.7 + r() * 0.3;
			ctx.strokeStyle = 'rgba(245,240,225,0.75)'; ctx.lineWidth = 5 * sc; ctx.lineCap = 'round';
			ctx.beginPath();
			ctx.moveTo( fx, fy - 30 * sc ); ctx.lineTo( fx, fy );
			ctx.moveTo( fx, fy ); ctx.lineTo( fx - 10 * sc, fy + 22 * sc ); ctx.moveTo( fx, fy ); ctx.lineTo( fx + 12 * sc, fy + 20 * sc );
			if ( i % 2 ) {

				ctx.moveTo( fx, fy - 24 * sc ); ctx.lineTo( fx + 18 * sc, fy - 34 * sc ); ctx.moveTo( fx + 14 * sc, fy - 30 * sc ); ctx.lineTo( fx - 16 * sc, fy - 44 * sc );

			} else {

				ctx.moveTo( fx, fy - 24 * sc ); ctx.lineTo( fx - 20 * sc, fy - 14 * sc ); ctx.moveTo( fx, fy - 24 * sc ); ctx.lineTo( fx + 18 * sc, fy - 40 * sc );

			}

			ctx.stroke();
			ctx.fillStyle = 'rgba(245,240,225,0.8)'; ctx.beginPath(); ctx.arc( fx, fy - 36 * sc, 5 * sc, 0, Math.PI * 2 ); ctx.fill();

		}

		// the brushwork over the ground
		for ( let k = 0; k < 220; k ++ ) {

			ctx.fillStyle = `rgba(${ 150 + r() * 100 },${ 120 + r() * 90 },${ 80 + r() * 70 },0.07)`;
			ctx.save(); ctx.translate( x + r() * S, y + r() * S ); ctx.rotate( r() * 3 ); ctx.fillRect( - 8, - 2, 10 + r() * 16, 3 + r() * 3 ); ctx.restore();

		}

		// the man: shoulders filling the bottom, the head large, turned a little
		const cx = x + S * ( 0.46 + r() * 0.08 ), turn = ( r() - 0.5 ) * 0.5;
		const skin = skins[ Math.floor( r() * skins.length ) ], hair = hairs[ Math.floor( r() * hairs.length ) ];
		const [ jersey, trim, crown, bill, collar ] = era;
		// shoulders and chest
		ctx.fillStyle = jersey;
		ctx.beginPath();
		ctx.moveTo( x - 10, y + S ); ctx.lineTo( x - 4, y + S * 0.8 ); ctx.quadraticCurveTo( cx - 70, y + S * 0.66, cx - 22, y + S * 0.64 );
		ctx.lineTo( cx + 22, y + S * 0.64 ); ctx.quadraticCurveTo( cx + 72, y + S * 0.66, x + S + 4, y + S * 0.8 ); ctx.lineTo( x + S + 10, y + S );
		ctx.fill();
		// pinstripes on some eras, the light from the left
		if ( jersey === '#ece8dc' || jersey === '#e9e4d6' ) {

			ctx.strokeStyle = trim + '88'; ctx.lineWidth = 1;
			for ( let k = - 8; k <= 8; k ++ ) { ctx.beginPath(); ctx.moveTo( cx + k * 9, y + S * 0.66 ); ctx.lineTo( cx + k * 11, y + S ); ctx.stroke(); }

		}

		ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect( cx + 10, y + S * 0.64, S, S );
		// the collar, or the placket and the script's first letters
		ctx.fillStyle = trim;
		if ( collar ) {

			ctx.beginPath(); ctx.moveTo( cx - 24, y + S * 0.65 ); ctx.lineTo( cx, y + S * 0.76 ); ctx.lineTo( cx + 24, y + S * 0.65 ); ctx.lineTo( cx + 30, y + S * 0.69 ); ctx.lineTo( cx, y + S * 0.82 ); ctx.lineTo( cx - 30, y + S * 0.69 ); ctx.fill();

		} else {

			ctx.font = `italic bold 30px ${ SCRIPT }`;
			ctx.fillText( i % 4 === 3 ? 'A' : 'Ph', cx + 26, y + S * 0.86 );
			ctx.fillRect( cx - 2, y + S * 0.66, 4, S * 0.4 );

		}

		// the neck, the head with its shadow side, the ears
		ctx.fillStyle = skin;
		ctx.fillRect( cx - 13, y + S * 0.52, 26, S * 0.14 );
		ctx.beginPath(); ctx.ellipse( cx + turn * 12, y + S * 0.4, 30, 40, 0, 0, Math.PI * 2 ); ctx.fill();
		ctx.beginPath(); ctx.ellipse( cx - 30 + turn * 6, y + S * 0.42, 6, 10, 0, 0, Math.PI * 2 ); ctx.fill();
		ctx.beginPath(); ctx.ellipse( cx + 30 + turn * 6, y + S * 0.42, 6, 10, 0, 0, Math.PI * 2 ); ctx.fill();
		ctx.fillStyle = 'rgba(40,15,5,0.32)';
		ctx.beginPath(); ctx.ellipse( cx + 12 + turn * 12, y + S * 0.42, 18, 36, 0, - Math.PI / 2, Math.PI / 2 ); ctx.fill();
		ctx.fillRect( cx - 13, y + S * 0.56, 26, 6 );
		// the brows, the eyes (dark marks under them), the nose's shadow, the mouth; a moustache on some
		const ex = cx + turn * 16, ey = y + S * 0.38;
		ctx.fillStyle = hair;
		ctx.fillRect( ex - 20, ey - 8, 13, 3 ); ctx.fillRect( ex + 6, ey - 8, 13, 3 );
		ctx.fillStyle = '#1a100a';
		ctx.beginPath(); ctx.ellipse( ex - 13, ey, 4, 2.5, 0, 0, Math.PI * 2 ); ctx.fill();
		ctx.beginPath(); ctx.ellipse( ex + 13, ey, 4, 2.5, 0, 0, Math.PI * 2 ); ctx.fill();
		ctx.fillStyle = 'rgba(60,25,10,0.45)';
		ctx.beginPath(); ctx.moveTo( ex + 2, ey + 2 ); ctx.lineTo( ex + 7, ey + 18 ); ctx.lineTo( ex, ey + 20 ); ctx.fill();
		ctx.fillStyle = 'rgba(255,240,220,0.25)'; ctx.fillRect( ex - 3, ey + 2, 3, 16 );
		if ( r() < 0.35 ) { ctx.fillStyle = hair; ctx.fillRect( ex - 11, ey + 23, 22, 5 ); }
		ctx.fillStyle = 'rgba(90,30,20,0.7)'; ctx.fillRect( ex - 8, ey + 30, 16, 3 );
		// the cap, low over the brows, its bill; a stripe on the old ones; the hair at the temples
		ctx.fillStyle = hair; ctx.fillRect( cx - 30 + turn * 10, y + S * 0.3, 8, 18 ); ctx.fillRect( cx + 22 + turn * 10, y + S * 0.3, 8, 18 );
		ctx.fillStyle = crown;
		ctx.beginPath(); ctx.ellipse( cx + turn * 10, y + S * 0.29, 33, 24, 0, Math.PI, 0 ); ctx.fill();
		ctx.fillRect( cx - 33 + turn * 10, y + S * 0.27, 66, 9 );
		if ( crown === eras[ 1 ][ 2 ] ) { ctx.fillStyle = trim; for ( let k = - 2; k <= 2; k ++ ) ctx.fillRect( cx + k * 12 + turn * 10, y + S * 0.2, 3, 18 ); }
		ctx.fillStyle = bill;
		ctx.beginPath(); ctx.ellipse( cx + turn * 22, y + S * 0.315, 36, 7, 0, 0, Math.PI ); ctx.fill();
		ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect( cx - 28 + turn * 14, y + S * 0.325, 56, 5 );
		// the varnish's warmth, the frame's shadow at the canvas's edge
		ctx.fillStyle = 'rgba(120,80,20,0.08)'; ctx.fillRect( x, y, S, S );
		ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 6;
		ctx.strokeRect( x + 3, y + 3, S - 6, S - 6 );
		ctx.restore();

	}

}
// the atlas cell of canvas i (0 .. 23)
export function paintingUV( i ) {

	return cellUV( [ 'paintings', 'paintings2', 'paintings3' ][ Math.floor( i / 8 ) % 3 ], i % 8, 8, 1 );

}
// ---- end FI3

// ---- FI3 (C2I-10): the Diamond Club's mural and back-bar panels
function drawLounge( ctx, R, SANS ) {

	// a figure in a pose: [ head, neck, hip, knees, feet, elbows, hands ] as offsets, drawn as long tapered
	// strokes (elongated, as a painter of the leagues' old days might)
	const figure = ( cx, by, s, pose, uni, cap, skin, bat ) => {

		const P = ( p ) => [ cx + p[ 0 ] * s, by - p[ 1 ] * s ];
		const limb = ( a, b, w, col ) => {

			ctx.strokeStyle = col; ctx.lineWidth = w * s; ctx.lineCap = 'round';
			ctx.beginPath(); ctx.moveTo( ...P( a ) ); ctx.lineTo( ...P( b ) ); ctx.stroke();

		};
		const { hip, neck, kneeL, kneeR, footL, footR, elbL, elbR, handL, handR } = pose;
		limb( hip, kneeL, 15, uni ); limb( kneeL, footL, 12, uni ); limb( hip, kneeR, 15, uni ); limb( kneeR, footR, 12, uni );
		limb( [ footL[ 0 ] - 4, footL[ 1 ] ], [ footL[ 0 ] + 10, footL[ 1 ] ], 7, '#1a1a1a' ); limb( [ footR[ 0 ] - 4, footR[ 1 ] ], [ footR[ 0 ] + 10, footR[ 1 ] ], 7, '#1a1a1a' );
		limb( hip, neck, 26, uni );
		limb( neck, elbL, 11, uni ); limb( elbL, handL, 9, skin ); limb( neck, elbR, 11, uni ); limb( elbR, handR, 9, skin );
		if ( bat ) limb( handR, [ handR[ 0 ] + bat[ 0 ], handR[ 1 ] + bat[ 1 ] ], 6, '#c8a060' );
		const h = P( [ neck[ 0 ] + 2, neck[ 1 ] + 16 ] );
		ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse( h[ 0 ], h[ 1 ], 8 * s, 11 * s, 0.2, 0, Math.PI * 2 ); ctx.fill();
		ctx.fillStyle = cap; ctx.beginPath(); ctx.ellipse( h[ 0 ], h[ 1 ] - 5 * s, 9 * s, 6 * s, 0, Math.PI, 0 ); ctx.fill();
		ctx.fillRect( h[ 0 ], h[ 1 ] - 6 * s, 12 * s, 3 * s );

	};
	{

		const [ x0, y0, w, h ] = R( 'muralClub' ), r = rnd( 31 );
		const g = ctx.createLinearGradient( 0, y0, 0, y0 + h );
		g.addColorStop( 0, '#3a2a5a' ); g.addColorStop( 0.45, '#c86a3a' ); g.addColorStop( 0.7, '#e0a860' ); g.addColorStop( 1, '#2e5a3a' );
		ctx.fillStyle = g;
		ctx.fillRect( x0, y0, w, h );
		// the painter's ground: broad strokes, a grandstand's suggestion, the lights
		for ( let k = 0; k < 120; k ++ ) {

			ctx.fillStyle = `hsla(${ 10 + r() * 40 }, 60%, ${ 40 + r() * 30 }%, 0.12)`;
			ctx.fillRect( x0 + r() * w, y0 + r() * h * 0.7, 20 + r() * 40, 4 + r() * 6 );

		}

		for ( let k = 0; k < 4; k ++ ) { ctx.fillStyle = 'rgba(255,240,200,0.5)'; ctx.fillRect( x0 + 40 + k * 130, y0 + 18, 26, 8 ); }
		const poses = [
			// a batter at the end of his swing
			{ hip: [ 0, 70 ], neck: [ 6, 128 ], kneeL: [ - 14, 38 ], kneeR: [ 16, 36 ], footL: [ - 22, 0 ], footR: [ 22, 0 ], elbL: [ 24, 116 ], elbR: [ 22, 124 ], handL: [ 34, 132 ], handR: [ 30, 136 ], bat: [ - 46, 22 ] },
			// a pitcher's high kick
			{ hip: [ 0, 72 ], neck: [ - 6, 130 ], kneeL: [ 22, 92 ], kneeR: [ 2, 36 ], footL: [ 34, 74 ], footR: [ 4, 0 ], elbL: [ 22, 118 ], elbR: [ - 26, 140 ], handL: [ 18, 104 ], handR: [ - 38, 158 ] },
			// a catcher in his crouch
			{ hip: [ 0, 44 ], neck: [ 4, 98 ], kneeL: [ - 22, 52 ], kneeR: [ 22, 52 ], footL: [ - 18, 0 ], footR: [ 18, 0 ], elbL: [ - 18, 78 ], elbR: [ 22, 80 ], handL: [ - 6, 74 ], handR: [ 30, 66 ] },
			// a fielder stretching for it
			{ hip: [ 0, 66 ], neck: [ 22, 118 ], kneeL: [ - 20, 34 ], kneeR: [ 24, 40 ], footL: [ - 34, 0 ], footR: [ 30, 4 ], elbL: [ 44, 138 ], elbR: [ - 8, 100 ], handL: [ 62, 152 ], handR: [ - 22, 86 ] },
			// a runner going all out
			{ hip: [ 0, 70 ], neck: [ 16, 124 ], kneeL: [ 22, 52 ], kneeR: [ - 16, 34 ], footL: [ 14, 10 ], footR: [ - 34, 12 ], elbL: [ 30, 102 ], elbR: [ - 4, 110 ], handL: [ 26, 84 ], handR: [ - 16, 128 ] },
			// a batter waiting, the bat on his shoulder
			{ hip: [ 0, 70 ], neck: [ 0, 128 ], kneeL: [ - 10, 36 ], kneeR: [ 12, 36 ], footL: [ - 14, 0 ], footR: [ 16, 0 ], elbL: [ - 14, 104 ], elbR: [ 18, 106 ], handL: [ 4, 116 ], handR: [ 8, 118 ], bat: [ - 20, 40 ] },
		];
		const unis = [ '#efe8d8', '#8fa9cc', '#e8e0d0', '#6a1020', '#efe8d8', '#c9c4b8' ];
		const caps = [ '#b0141e', '#6a1020', '#1d2b55', '#1a1a1a', '#b0141e', '#14285a' ];
		const skins = [ '#c08060', '#8a5236', '#e0b090', '#6a3c26', '#d29a78', '#a86a48' ];
		for ( let k = 0; k < 6; k ++ ) {

			const cx = x0 + 45 + k * 84 + ( r() - 0.5 ) * 14, s = 1.18 + r() * 0.2;
			figure( cx, y0 + h - 22, s, poses[ k ], unis[ k ], caps[ k ], skins[ k ], poses[ k ].bat );

		}

		ctx.strokeStyle = '#20180c'; ctx.lineWidth = 8;
		ctx.strokeRect( x0 + 4, y0 + 4, w - 8, h - 8 );

	}

	// the back bar's panels: two cells, a batter's and a pitcher's, each glowing white in the dark among
	// columns of names (invented: initials and years, as a roll of members)
	{

		const [ x0, y0, w, h ] = R( 'loungePanel' ), r = rnd( 1883 );
		for ( let k = 0; k < 2; k ++ ) {

			const x = x0 + k * 256;
			ctx.fillStyle = '#0c0e14'; ctx.fillRect( x, y0, 256, h );
			ctx.fillStyle = 'rgba(235,240,255,0.75)'; ctx.font = `bold 10px ${ SANS }`;
			for ( let col = 0; col < 3; col ++ ) for ( let row = 0; row < 18; row ++ ) {

				if ( col === 1 && row > 2 && row < 16 ) continue;
				const L = String.fromCharCode( 65 + Math.floor( r() * 26 ) ) + '. ' + [ 'MILLER', 'KANE', 'DAVIS', 'BROWN', 'ROSSI', 'KELLY', 'WALSH', 'GRANT', 'BELL', 'MORAN', 'COLE', 'REED' ][ Math.floor( r() * 12 ) ];
				ctx.fillText( L, x + 10 + col * 84, y0 + 16 + row * 13.5, 74 );

			}

			// the great figure, lit from behind
			ctx.save();
			ctx.shadowColor = 'rgba(200,220,255,0.9)'; ctx.shadowBlur = 18;
			ctx.fillStyle = '#eef3ff'; ctx.strokeStyle = '#eef3ff'; ctx.lineCap = 'round';
			const cx = x + 128, by = y0 + 236;
			const L = ( a, b, wd ) => { ctx.lineWidth = wd; ctx.beginPath(); ctx.moveTo( cx + a[ 0 ], by - a[ 1 ] ); ctx.lineTo( cx + b[ 0 ], by - b[ 1 ] ); ctx.stroke(); };
			if ( k === 0 ) {

				L( [ 0, 100 ], [ - 20, 52 ], 16 ); L( [ - 20, 52 ], [ - 30, 0 ], 13 ); L( [ 0, 100 ], [ 24, 50 ], 16 ); L( [ 24, 50 ], [ 30, 0 ], 13 );
				L( [ 0, 100 ], [ 4, 168 ], 30 ); L( [ 4, 160 ], [ 34, 150 ], 11 ); L( [ 34, 150 ], [ 40, 176 ], 9 ); L( [ 40, 176 ], [ - 30, 214 ], 7 );
				ctx.beginPath(); ctx.arc( cx + 2, by - 186, 15, 0, Math.PI * 2 ); ctx.fill();

			} else {

				L( [ 0, 100 ], [ 30, 128 ], 16 ); L( [ 30, 128 ], [ 44, 100 ], 13 ); L( [ 0, 100 ], [ - 6, 50 ], 16 ); L( [ - 6, 50 ], [ - 4, 0 ], 13 );
				L( [ 0, 100 ], [ - 8, 168 ], 30 ); L( [ - 8, 160 ], [ - 40, 176 ], 11 ); L( [ - 40, 176 ], [ - 56, 206 ], 9 ); L( [ - 8, 160 ], [ 24, 140 ], 11 );
				ctx.beginPath(); ctx.arc( cx - 6, by - 186, 15, 0, Math.PI * 2 ); ctx.fill();

			}

			ctx.restore();

		}

	}

}
// ---- end FI3
// ---------------------------------------------------------------- the material

// ---- SP1 (speed): the palette is a uniform array (it was two arrays of 58 built in every pixel's
// registers and indexed there: ~9 ms with a room filling the screen), and the netting's cut-outs (a
// discard) are compiled only into the material that has netting (`net: true`, Under.js's cages): a
// discard anywhere in a shader stops this GPU (tile-based, hidden surface removal) from skipping the
// hidden pixels of everything drawn with it, so every wall, table and chair behind another was shaded
// ---- FI3: `local: false` for a room the park's local lights mustn't reach (a closed room under the stands,
// a store whose window a plaza lamp shines in at: its own lamps are baked in, and it's cheaper)
export function insideMaterial( name, { glowNight = 1, net = false, local = true } = {} ) {

	const pal = new Float32Array( PAL_KEYS.length * 8 );
	PAL_KEYS.forEach( ( k, i ) => {

		const [ c, rough, metal, glow, pat ] = PAL[ k ];
		pal.set( [ c[ 0 ], c[ 1 ], c[ 2 ], 0 ], i * 4 );
		pal.set( [ rough, metal, glow, pat ], ( PAL_KEYS.length + i ) * 4 );

	} );
	const N = PAL_KEYS.length;
	const mat = standard( {
		name, roughness: 0.7, side: 'front', vertexColors: true, modules: [ commonModule ],
		textures: { inAtlas: insideAtlas() },
		uniforms: { inPal: [ `vec4f[${ N * 2 }]`, pal ] },
		defines: { INSIDE_NET: net ? 1 : 0 },
		surface: /* wgsl */`
	let k = u32( clamp( in.color.a + 0.5, 0.0, ${ N - 1 }.0 ) );
	let q = mat.inPal[ ${ N }u + k ];
	let pat = u32( q.w + 0.5 );
	let uv = in.uv;
	let fw = max( fwidth( uv.x ), fwidth( uv.y ) );
	// (sampled before any branch: a texture's mip needs uniform control flow)
	let atl = textureSample( inAtlas, smpAnisoClamp, uv ).rgb;
	var c = mat.inPal[ k ].rgb;
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
		c = mix( cc, vec3f( 0.075, 0.052, 0.046 ) /* ---- FI3 (C2I-15): its far mix more charcoal and taupe, less red */, clamp( fw * 6.0 - 0.5, 0.0, 1.0 ) );
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
		let hs = fract( sin( dot( floor( uv * 70.0 ) /* ---- FI3 (C2I-19): by the face's own uv: from world xz the walls' grains ran into long diagonal streaks */, vec2f( 12.9898, 78.233 ) ) ) * 43758.5453 );
		c *= 0.75 + 0.5 * hs * clamp( 1.0 - fw * 40.0, 0.3, 1.0 );
	} else if ( pat == ${ P_TERRAZZO }u ) {
		// cream terrazzo, the chips; a pair of red seams round the room with their stitches (harpo42, 2008)
		let hs = fract( sin( dot( floor( uv * 60.0 ), vec2f( 12.9898, 78.233 ) ) ) * 43758.5453 );
		c *= 0.88 + 0.24 * hs * clamp( 1.0 - fw * 40.0, 0.2, 1.0 );
		// ---- FI3 (C2I-10): its chips black and blue (sjc610, May 2008), brass strips fanning out from the
		// middle, and there the Diamond Club's medallion: a steel ring, a red field, the white diamond
		let near = clamp( 1.0 - fw * 30.0, 0.0, 1.0 );
		let hc = fract( sin( dot( floor( uv * 33.0 ), vec2f( 39.3468, 11.135 ) ) ) * 24634.6345 );
		if ( hc > 0.94 ) { c = mix( c, select( vec3f( 0.03, 0.03, 0.035 ), vec3f( 0.05, 0.1, 0.32 ), hc > 0.975 ), near ); }
		let rad = length( uv );
		let ang = atan2( uv.y, uv.x ) / 0.2618;
		if ( rad > 1.9 && abs( fract( ang ) - 0.5 ) * 0.2618 * rad > 0.5 * 0.2618 * rad - 0.008 ) { c = mix( c, vec3f( 0.5, 0.36, 0.12 ), 0.85 * near + 0.1 ); }
		if ( rad < 1.75 ) {
			c = select( vec3f( 0.32, 0.03, 0.035 ), vec3f( 0.5, 0.51, 0.52 ), rad > 1.45 );
			if ( abs( uv.x ) + abs( uv.y ) < 0.95 ) { c = vec3f( 0.75, 0.73, 0.68 ); }
			if ( abs( uv.x ) + abs( uv.y ) < 0.75 ) { c = vec3f( 0.32, 0.03, 0.035 ); }
			if ( abs( rad - 1.2 ) < 0.03 ) { c = vec3f( 0.75, 0.73, 0.68 ); }
		}
		// ---- end FI3
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
		// ---- FI3 (C2I-13): as erglantz (Apr 2008) and greenheaps (Aug 2008) have it: the balls in rows on a
		// deep maroon board, a maroon shelf under every sixth row; each ball a shaded sphere (lit from above,
		// a glint on its shoulder, its stitches curving round it) standing proud, its shadow on the board
		// round it; far off, the mix of maroon and cream (it was a flat dotted wallpaper going cream)
		let q2 = uv / 0.078;
		let row = floor( q2.y );
		let shelfRow = row - 7.0 * floor( row / 7.0 ) > 5.5;
		let f = fract( q2 ) - 0.5;
		let rr = length( f );
		let maroon = vec3f( 0.2, 0.025, 0.032 );
		var cb = maroon * ( 0.45 + 0.55 * smoothstep( 0.42, 0.62, rr ) );
		if ( shelfRow ) {
			cb = maroon * select( 0.75, 1.25, f.y > 0.3 );
		} else if ( rr < 0.44 ) {
			let n = vec3f( f / 0.44, sqrt( max( 0.0, 1.0 - rr * rr / ( 0.44 * 0.44 ) ) ) );
			let lit = 0.42 + 0.58 * max( dot( n, normalize( vec3f( - 0.25, 0.75, 0.6 ) ) ), 0.0 );
			cb = c * lit;
			let se = min( abs( length( f - vec2f( 0.55, 0.0 ) ) - 0.4 ), abs( length( f + vec2f( 0.55, 0.0 ) ) - 0.4 ) );
			if ( se < 0.03 ) { cb = vec3f( 0.45, 0.04, 0.03 ) * lit; }
			glow = glow + 2.0 * ( 1.0 - smoothstep( 0.03, 0.08, length( f - vec2f( - 0.12, 0.17 ) ) ) ) * clamp( 1.0 - fw / 0.078 * 2.0, 0.0, 1.0 );
		}
		c = mix( cb, mix( maroon, c, 0.55 ) * 0.85, clamp( fw / 0.078 * 1.5 - 0.3, 0.0, 1.0 ) );
	} else if ( pat == ${ P_CMU }u ) {
		let q2 = uv / vec2f( 0.4, 0.2 );
		let row = floor( q2.y );
		let f = fract( vec2f( q2.x + 0.5 * ( row - 2.0 * floor( row * 0.5 ) ), q2.y ) );
		let mort = max( 1.0 - smoothstep( 0.0, 0.03, min( f.x, 1.0 - f.x ) * 2.0 ), 1.0 - smoothstep( 0.0, 0.06, min( f.y, 1.0 - f.y ) * 2.0 ) );
		c *= ( 1.0 - 0.25 * mort * clamp( 1.0 - fw * 15.0, 0.0, 1.0 ) ) * ( 0.94 + 0.06 * h2 );
	} else if ( pat == ${ P_TURF }u ) {
		c *= 0.8 + 0.3 * mx_noise_float2( in.P.xz * 2.0 ) + 0.1 * h2;
#if INSIDE_NET
	} else if ( pat == ${ P_NET }u ) {
		// the cages' netting: the strands, the rest cut away (sparser with distance, as the eye sees it)
		let g = abs( fract( uv / 0.05 ) - 0.5 );
		let fwn = fw / 0.05;
		let keep = max( g.x, g.y ) > 0.5 - 0.032 - fwn * 0.5;
		let hs = fract( sin( dot( in.pixel, vec2f( 12.9898, 78.233 ) ) ) * 43758.5453 );
		if ( ! keep || ( fwn > 0.4 && hs > 0.35 / fwn ) ) { discard; }
#endif
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
	// ---- FI3 (C2I-3): the store's maple strip floor (boards 7 cm wide, their ends staggered, each its own
	// shade), the slatwall's grooves every 7.5 cm, the home whites' red pinstripes
	} else if ( pat == ${ P_PLANKS }u ) {
		let bw = uv.x / 0.07;
		let bi = floor( bw );
		let bl = uv.y / 1.1 + fract( sin( bi * 7.31 ) * 437.5 );
		let hb = fract( sin( dot( vec2f( bi, floor( bl ) ), vec2f( 12.9898, 78.233 ) ) ) * 43758.5453 );
		let seam = max( 1.0 - smoothstep( 0.0, 0.06, min( fract( bw ), 1.0 - fract( bw ) ) ), 1.0 - smoothstep( 0.0, 0.01, min( fract( bl ), 1.0 - fract( bl ) ) ) );
		c *= ( 0.82 + 0.3 * hb ) * ( 1.0 - 0.35 * seam * clamp( 1.0 - fw * 25.0, 0.0, 1.0 ) ) * ( 0.95 + 0.08 * mx_noise_float2( vec2f( uv.x * 30.0, uv.y * 2.0 ) ) );
	} else if ( pat == ${ P_SLAT }u ) {
		let g = fract( uv.y / 0.075 );
		c *= 1.0 - 0.6 * ( 1.0 - smoothstep( 0.0, 0.12, g ) ) * clamp( 1.0 - fw * 30.0, 0.0, 1.0 );
	} else if ( pat == ${ P_PIN }u ) {
		let pn = 1.0 - smoothstep( 0.0, 0.08, abs( fract( uv.x / 0.022 ) - 0.5 ) );
		c = mix( c, vec3f( 0.42, 0.04, 0.05 ), pn * 0.8 * clamp( 1.0 - fw * 45.0, 0.0, 1.0 ) + 0.12 * clamp( fw * 45.0, 0.0, 1.0 ) );
	} else if ( pat == ${ P_STEEL }u ) {
		// (C2I-8) polished metal and glass mirroring the room, faked: the view mirrored in the surface, the
		// white ceiling and its row of cans over it, the walls' warm middle, the dark floor under; a glint
		let Vw = normalize( frame.cameraPos - in.P );
		let Rw = reflect( - Vw, normalize( in.N ) );
		let env = mix( mix( vec3f( 0.06, 0.05, 0.045 ), vec3f( 0.45, 0.38, 0.3 ), smoothstep( - 0.35, 0.05, Rw.y ) ), vec3f( 0.9, 0.88, 0.84 ), smoothstep( 0.25, 0.6, Rw.y ) );
		let cg = fract( Rw.xz * 2.2 + 0.5 ) - 0.5;
		let can = ( 1.0 - smoothstep( 0.04, 0.12, length( cg ) ) ) * smoothstep( 0.6, 0.85, Rw.y );
		c = c * mix( env, vec3f( 1.0 ), 0.25 ) * 1.3;
		glow = glow + can * 1.6 * ( 1.0 - rough );
	} else if ( pat == ${ P_GRIDCEIL }u ) {
		// (C2I-15) an open metal grid: 60 cm bays of 15 cm cells, their bronze blades catching the light,
		// the dark plenum above seen between them
		let g1 = abs( fract( uv / 0.6 ) - 0.5 );
		let g2 = abs( fract( uv / 0.15 ) - 0.5 );
		let blade = max( step( 0.47, max( g1.x, g1.y ) ), step( 0.4, max( g2.x, g2.y ) ) * 0.7 );
		c = mix( c * 0.18, c, mix( blade, 0.45, clamp( fw * 12.0, 0.0, 1.0 ) ) );
	} else if ( pat == ${ P_ICE }u ) {
		// cubed ice: lumps catching the light
		let hi = fract( sin( dot( floor( in.P.xz * 28.0 ), vec2f( 12.9898, 78.233 ) ) ) * 43758.5453 );
		c *= 0.7 + 0.5 * hi;
	// ---- end FI3
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
	if ( ! local ) mat.setDefine( 'NO_LOCAL_LIGHTS', 1 ); // ---- FI3
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
// drawn. The two meshes split every pixel between them by the same test (nearK). Both materials carry the
// uniform nearOn: 0 when the place has its rooms off (the camera's where it can't see in), and then the
// glass is traced however near.
export const GLASS_UNIFORMS = () => ( { nearOn: [ 'f32', 1 ] } );
export function glassSplit( near, band ) {

	return /* wgsl */`
	let dith = fract( 52.9829189 * fract( dot( floor( in.pixel ), vec2f( 0.06711056, 0.00583715 ) ) ) );
	let dc = distance( in.P, frame.cameraPos );
	let nearK = dc < ${ near.toFixed( 1 ) } + ${ band.toFixed( 1 ) } * dith && mat.nearOn > 0.5;
`;

}

// the signed distance of ( x, z ) back from a polyline (the field frame; + away from the field)
export function backFrom( P, x, z ) {

	let best = Infinity, sd = 0;
	for ( let i = 0; i < P.length - 1; i ++ ) {

		const [ ax, az ] = P[ i ], [ bx, bz ] = P[ i + 1 ];
		const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
		const t = Math.max( 0, Math.min( 1, ( ( x - ax ) * dx + ( z - az ) * dz ) / l2 ) );
		const px = ax + dx * t, pz = az + dz * t, d = Math.hypot( x - px, z - pz );
		if ( d < best ) {

			best = d;
			let nx = - dz, nz = dx;
			if ( nx * ( ( ax + bx ) / 2 ) + nz * ( ( az + bz ) / 2 + 40 ) < 0 ) {

				nx = - nx; nz = - nz;

			}

			sd = ( x - px ) * nx + ( z - pz ) * nz >= 0 ? d : - d;

		}

	}

	return sd;

}

// the clear glass, near the camera: a faint tint, the reflection at a glancing angle, smudges low down.
// ---- FI3 (C2I-9): tinted, as the suites' and the club's glass is (wallyg 2005, yeago81 2007: from the
// field by day a dark grey-green band, the rooms behind it barely there): by day, seen from outside, a
// dark tint that takes the sky's reflection (the environment's, weighted by the alpha); after dark nearly
// clear. And from inside after dark (`reflect`: WGSL that sets `refl` from ro, rd, the glass's uv and its
// vertex colour, as the far glass traces its room) the lit room mirrored in it, faintly: the cans, the
// walls, against the dark field. Opaque glass isn't drawn here (this is the late pass): no discard but the
// near/far split's.
export function clearGlass( name, near, band, { reflect = null, colors = false, tint = true } = {} ) {

	const day = tint ? 0.86 : 0.1; // (an inside window, a display case: no tint)
	const m = standard( { name, roughness: 0.04, metalness: 0.2, envMapIntensity: tint ? 0.55 : 1, transparent: true, depthWrite: false, side: 'double', modules: [ commonModule ], uniforms: GLASS_UNIFORMS(),
		vertexColors: colors,
		surface: glassSplit( near, band ) + /* wgsl */`
	if ( ! nearK ) { discard; }
	let N = normalize( in.N );
	let V = normalize( frame.cameraPos - in.P );
	let fres = pow( 1.0 - clamp( abs( dot( N, V ) ), 0.0, 1.0 ), 4.0 );
	let nk = smoothstep( 0.1, 0.7, frame.night );
	s.albedo = vec3f( 0.018, 0.03, 0.028 );
	// (which side we see it from, by the quad's own normal (outward, toward the field): in.N is turned to
	// the viewer by front_facing, which can't be trusted to say which side that is here)
	let Nq = select( - N, N, in.front );
	let outside = dot( Nq, V ) > 0.0;
	s.alpha = select( 0.1, mix( ${ day.toFixed( 2 ) }, 0.12, nk ), outside ) + 0.45 * fres;
	s.roughness = 0.04 + 0.08 * smoothstep( 0.6, 0.9, mx_noise_float2( in.P.xz * 3.0 + in.P.y * 2.0 ) ) * step( in.uv.y, 1.4 );
${ reflect ? /* wgsl */`
	if ( ! outside && nk > 0.05 ) {
		// the glass's outward normal (the front face's), the view ray mirrored back into the room
		let No = normalize( vec3f( Nq.x, 0.0, Nq.z ) );
		let Tg = normalize( cross( vec3f( 0.0, 1.0, 0.0 ), No ) );
		let Vd = - V;
		let ro = vec3f( in.uv.x, in.uv.y, 0.0 );
		let rd = vec3f( dot( Vd, Tg ), Vd.y, max( dot( Vd, No ), 0.05 ) );
		var refl = vec3f( 0.0 );
		${ reflect }
		s.alpha = max( s.alpha, 0.16 );
		s.emissive = refl * 0.9 * nk; // (weighed by the alpha: the walls a ghost, the lamps bright)
	}
` : '' }` } );
	m.underwaterLighting = 'none';
	m.setDefine( 'DRY', 1 );
	return m;

}

// ---- FI3 (C2I-14): batting-cage netting on the late pass (clearGlassMesh), uv in metres: a 5 cm mesh of
// 3 mm twine. Each strand drawn with its own coverage of the pixel (filtered), so near it's twine and
// far it fades to its average, an eighth: a soft dark veil, no moiré, nothing cut away
export function netMaterial() {

	const m = standard( { name: 'under-nets', roughness: 0.9, transparent: true, depthWrite: false, side: 'double',
		surface: /* wgsl */`
	let cell = 0.05;
	let g = abs( fract( in.uv / cell ) - 0.5 );
	let fwn = max( max( fwidth( in.uv.x ), fwidth( in.uv.y ) ) / cell, 0.0005 );
	let hw = 0.03;
	// each axis's strand: its share of the pixel, from the distance to it (in cells) and the pixel's size
	let ax = clamp( ( hw - ( 0.5 - g.x ) ) / fwn + 0.5, 0.0, 1.0 ) * min( 1.0, 2.0 * hw / fwn );
	let ay = clamp( ( hw - ( 0.5 - g.y ) ) / fwn + 0.5, 0.0, 1.0 ) * min( 1.0, 2.0 * hw / fwn );
	let line = 1.0 - ( 1.0 - ax ) * ( 1.0 - ay );
	let avg = 1.0 - ( 1.0 - 2.0 * hw ) * ( 1.0 - 2.0 * hw );
	let far = clamp( fwn * 1.5 - 0.3, 0.0, 1.0 );
	s.alpha = mix( line, avg, far ) * 0.9;
	s.albedo = vec3f( 0.03, 0.034, 0.03 );
	s.roughness = 0.9;
` } );
	m.underwaterLighting = 'none';
	m.setDefine( 'DRY', 1 );
	m.setDefine( 'NO_LOCAL_LIGHTS', 1 );
	return m;

}

// the quads as a plain mesh, for the clear glass: on the late (transparent) pass (---- FI3: their vertex
// colours too, when they were given: the reflection's room)
export function clearGlassMesh( b, material, name ) {

	const g = new BufferGeometry();
	g.setAttribute( 'position', new Float32BufferAttribute( b.pos, 3 ) );
	g.setAttribute( 'normal', new Float32BufferAttribute( b.nrm, 3 ) );
	g.setAttribute( 'uv', new Float32BufferAttribute( b.uv, 2 ) );
	if ( b.data && b.col.length === b.pos.length / 3 * 4 ) g.setAttribute( 'color', new Float32BufferAttribute( b.col, 4 ) ); // ---- FI3
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

