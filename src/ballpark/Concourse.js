import { Group, Mesh, Vector3, Color } from '../engine/index.js';
import { commonModule } from '../engine/render/wgsl/common.js';
import { standard } from '../materials/Materials.js';
import { Quads, tierSections } from './Stands.js';
import { canvasTexture, box, beam } from './geo.js';
import { offsetPolyline } from './Bowl.js';
import { LEVELS, fencePoint } from './layout.js';
import { GATES } from './Exterior.js';

// The main concourse round the infield, as the Phillies' guides had it in 2008 (the concessions guide as
// archived on 6 October 2008, the 2007 Convenience Guide): along its outer side, just inside the columns
// under the decks, a row of built-in units, each where the guide put it by section number. The stands:
// Cobblestone Grill (behind 108 and 125), Hatfield Grill (120, 135), South Philadelphia Market, Neighborhood
// Pizza, Old City Creamery, Brewerytown, The Schmitter (139); between them the restrooms, the family
// restrooms, First Aid (105), Guest Services (122) and the ticket windows, the home stands of team
// merchandise, the newsstand. Each stand an open service window over a stainless counter under a lit menu
// board with its name over it, the kitchen behind it lit warm. The rail at the back of the seats, the
// section numbers over the aisles, TVs under the suite level. Field frame, in the Field's group.

const STREET = LEVELS.mainConcourse;
const DEPTH = 4.5, H = 4.2, UNIT = 7.5, GAP = 1.2;

const DRINKS = [ 'COCA-COLA', [ [ 'SOFT DRINK', '3.75' ], [ 'SOUVENIR CUP', '5.75' ], [ 'BOTTLED WATER', '3.75' ], [ 'HOT CHOCOLATE', '3.00' ] ] ];

// The stands: name, a line under it, its colours (sign, letters, accent), serif or not, the kitchen's kind
// (0 grill, 1 market, 2 pizza ovens, 3 soft serve, 4 taps), the menu board's three panels (2008 prices)
const FOOD = {
	cobblestone: { name: 'COBBLESTONE GRILL', tag: 'CHEESESTEAKS  ·  FRIES  ·  CHICKEN TENDERS', bg: '#1f3d2a', fg: '#efe2bf', accent: '#c9a45a', serif: true, kitchen: 0,
		menu: [ [ 'STEAKS', [ [ 'CHEESESTEAK', '8.75' ], [ 'CHICKEN STEAK', '8.75' ], [ 'PIZZA STEAK', '9.00' ], [ 'WIT OR WITOUT', '' ] ] ],
			[ 'SIDES', [ [ 'FRENCH FRIES', '4.25' ], [ 'CHEESE FRIES', '5.25' ], [ 'CHICKEN TENDERS', '8.25' ], [ 'WITH FRIES', '+1.50' ] ] ], DRINKS ] },
	hatfield: { name: 'HATFIELD GRILL', tag: 'SAUSAGE  ·  HOT DOGS  ·  BURGERS  ·  BRATS', bg: '#ad1119', fg: '#ffffff', accent: '#0b2a5b', serif: true, italic: true, kitchen: 0,
		menu: [ [ 'FROM THE GRILL', [ [ 'HOT DOG', '3.75' ], [ 'FOOT LONG', '5.50' ], [ 'ITALIAN SAUSAGE', '6.00' ], [ 'BRATWURST', '6.00' ] ] ],
			[ 'SANDWICHES', [ [ 'CHEESEBURGER', '6.75' ], [ 'CHICKEN SANDWICH', '7.50' ], [ 'FRENCH FRIES', '4.25' ], [ 'PEPPERS & ONIONS', '.50' ] ] ], DRINKS ] },
	market: { name: 'SOUTH PHILADELPHIA MARKET', tag: 'HOT DOGS  ·  POPCORN  ·  PEANUTS  ·  CRACKER JACK', bg: '#13294f', fg: '#f1e6c8', accent: '#c8102e', kitchen: 1,
		menu: [ [ 'HOT DOGS', [ [ 'HOT DOG', '3.75' ], [ 'JUMBO DOG', '5.00' ], [ 'SOFT PRETZEL', '3.75' ], [ 'NACHOS', '4.75' ] ] ],
			[ 'SNACKS', [ [ 'POPCORN', '4.50' ], [ 'PEANUTS', '4.50' ], [ 'CRACKER JACK', '3.50' ], [ 'CANDY', '3.25' ] ] ], DRINKS ] },
	pizza: { name: 'NEIGHBORHOOD PIZZA', tag: 'SEASONS PIZZA  ·  CLASSIC CAESAR', bg: '#7b2016', fg: '#fff4dc', accent: '#f0b429', serif: true, kitchen: 2,
		menu: [ [ 'SEASONS PIZZA', [ [ 'CHEESE SLICE', '5.25' ], [ 'PEPPERONI SLICE', '5.75' ], [ 'WHITE PIZZA', '5.75' ], [ 'WHOLE PIE', '24.00' ] ] ],
			[ 'SALADS', [ [ 'CAESAR SALAD', '6.50' ], [ 'CHICKEN CAESAR', '8.00' ], [ 'GARLIC KNOTS', '3.50' ], [ 'SOFT PRETZEL', '3.75' ] ] ], DRINKS ] },
	creamery: { name: 'OLD CITY CREAMERY', tag: 'TURKEY HILL SOFT SERVE', bg: '#eee0c0', fg: '#5a3218', accent: '#2b5ea8', serif: true, kitchen: 3,
		menu: [ [ 'SOFT SERVE', [ [ 'CONE', '3.75' ], [ 'WAFFLE CONE', '4.75' ], [ 'HELMET SUNDAE', '5.50' ], [ 'TWIST', '3.75' ] ] ],
			[ 'TOPPINGS', [ [ 'HOT FUDGE', '.75' ], [ 'CARAMEL', '.75' ], [ 'SPRINKLES', '.50' ], [ 'WHIPPED CREAM', '.50' ] ] ],
			[ 'HOT DRINKS', [ [ 'COFFEE', '2.75' ], [ 'HOT CHOCOLATE', '3.00' ], [ 'TEA', '2.50' ], [ 'BOTTLED WATER', '3.75' ] ] ] ] },
	brewerytown: { name: 'BREWERYTOWN', tag: 'LOCAL  ·  DOMESTIC  ·  IMPORT', bg: '#3b2314', fg: '#f2c14e', accent: '#9b6a2f', serif: true, kitchen: 4,
		menu: [ [ 'ON DRAFT', [ [ 'YUENGLING LAGER', '6.75' ], [ 'BUD LIGHT', '6.75' ], [ 'MILLER LITE', '6.75' ], [ 'COORS LIGHT', '6.75' ] ] ],
			[ 'CRAFT & IMPORT', [ [ 'YARDS PHILLY PALE', '7.75' ], [ 'VICTORY HOPDEVIL', '7.75' ], [ 'BLUE MOON', '7.75' ], [ 'HEINEKEN', '7.75' ] ] ],
			[ 'MUST BE 21', [ [ 'BREWERYTOWN SANDWICH', '8.50' ], [ 'SOFT PRETZEL', '3.75' ], [ 'PEANUTS', '4.50' ], [ 'ID REQUIRED', '' ] ] ] ] },
	schmitter: { name: 'THE SCHMITTER', tag: 'FROM McNALLY\'S TAVERN  ·  CHESTNUT HILL', bg: '#151414', fg: '#dc2a30', accent: '#efe4cc', serif: true, kitchen: 0,
		menu: [ [ 'THE SCHMITTER', [ [ 'THE SCHMITTER', '8.50' ], [ 'BEEF · SALAMI · CHEESE', '' ], [ 'FRIED ONIONS · TOMATO', '' ], [ 'SPECIAL SAUCE · KAISER', '' ] ] ],
			[ 'ALSO', [ [ 'CHEESESTEAK', '8.75' ], [ 'FRENCH FRIES', '4.25' ], [ 'CHEESE FRIES', '5.25' ], [ 'HOT DOG', '3.75' ] ] ], DRINKS ] },
};
const BRANDS = Object.keys( FOOD );

// The half units, two to a unit: a door (a restroom), a window (a service counter) or a shop front; its
// sign (words, colours); the room behind (5 restroom, 6 office, 7 team store, 8 first aid, 9 newsstand)
const HALF = {
	men: { type: 'door', room: 5, sign: [ 'MEN', '#14305c', '#ffffff' ] },
	women: { type: 'door', room: 5, sign: [ 'WOMEN', '#14305c', '#ffffff' ] },
	family: { type: 'door', room: 5, sign: [ 'FAMILY RESTROOM', '#14305c', '#ffffff' ] },
	firstaid: { type: 'window', room: 8, sign: [ 'FIRST AID', '#f4f2ec', '#c8102e' ] },
	guest: { type: 'window', room: 6, sign: [ 'GUEST SERVICES', '#b3121b', '#ffffff' ] },
	tickets: { type: 'window', room: 6, sign: [ 'TICKETS', '#13294f', '#ffffff' ] },
	merch: { type: 'shop', room: 7, sign: [ 'PHILLIES', '#b3121b', '#ffffff' ] },
	news: { type: 'shop', room: 9, sign: [ 'NEWSSTAND', '#0b2a5b', '#ffffff' ] },
	phanatic: { type: 'shop', room: 7, sign: [ 'MAKE YOUR OWN PHANATIC', '#1c8a3c', '#ffffff' ] },
};
const HALVES = Object.keys( HALF );

// what the guides put behind which section, in the order they claim the nearest free unit (a pair: two
// halves); the units left over get restrooms and markets
const PLAN = [
	[ 'cobblestone', 108 ], [ 'cobblestone', 125 ], [ 'hatfield', 120 ], [ 'hatfield', 135 ], [ 'schmitter', 139 ],
	[ [ 'guest', 'tickets' ], 122 ], [ [ 'firstaid', 'family' ], 105 ], [ 'brewerytown', 113 ], [ 'brewerytown', 139 ],
	[ [ 'women', 'men' ], 117 ], [ [ 'men', 'women' ], 128 ], [ 'pizza', 109 ], [ 'pizza', 136 ], [ 'creamery', 110 ], [ 'creamery', 126 ],
	[ [ 'merch', 'news' ], 121 ], [ [ 'merch', 'phanatic' ], 134 ], [ 'market', 116 ], [ 'market', 130 ], [ 'market', 127 ], [ 'market', 106 ],
	[ [ 'women', 'family' ], 137 ], [ [ 'family', 'men' ], 112 ], [ 'creamery', 136 ], [ 'market', 138 ],
	// right field, behind 101-104 under the Pavilion
	[ 'hatfield', 101 ], [ [ 'men', 'women' ], 102 ], [ 'market', 103 ], [ [ 'women', 'men' ], 104 ],
];
const FILL = [ [ 'women', 'men' ], 'market', [ 'men', 'women' ], 'brewerytown' ];

// The concourse's small things in one draw: boxes and beams whose colour, gloss and glow come from a
// palette entry carried in uv.x (the registers, the stanchions and their belts, the cans, the condiment
// pumps, the carts...). [ name, linear albedo, roughness, metalness, glow (emissive, lit at night more) ]
const PALETTE = [
	[ 'steel', [ 0.55, 0.56, 0.57 ], 0.3, 0.9 ], [ 'black', [ 0.018, 0.018, 0.02 ], 0.4, 0 ], [ 'screen', [ 0.02, 0.04, 0.03 ], 0.2, 0, [ 0.12, 0.6, 0.3 ] ],
	[ 'belt', [ 0.02, 0.025, 0.05 ], 0.35, 0 ], [ 'redcan', [ 0.36, 0.02, 0.025 ], 0.45, 0 ], [ 'bluecan', [ 0.02, 0.06, 0.26 ], 0.45, 0 ],
	[ 'lid', [ 0.03, 0.03, 0.032 ], 0.5, 0 ], [ 'ketchup', [ 0.45, 0.02, 0.012 ], 0.3, 0 ], [ 'mustard', [ 0.72, 0.5, 0.02 ], 0.3, 0 ],
	[ 'relish', [ 0.07, 0.3, 0.04 ], 0.3, 0 ], [ 'white', [ 0.75, 0.74, 0.7 ], 0.6, 0 ], [ 'cardboard', [ 0.42, 0.29, 0.16 ], 0.85, 0 ],
	[ 'lamp', [ 0.8, 0.78, 0.72 ], 0.5, 0, [ 1.0, 0.86, 0.66 ] ], [ 'cartred', [ 0.42, 0.02, 0.03 ], 0.35, 0.1 ], [ 'wood', [ 0.3, 0.18, 0.09 ], 0.7, 0 ],
	[ 'chrome', [ 0.8, 0.8, 0.82 ], 0.15, 1 ], [ 'cup', [ 0.82, 0.8, 0.76 ], 0.35, 0 ], [ 'beer', [ 0.6, 0.38, 0.05 ], 0.15, 0 ],
	[ 'green', [ 0.05, 0.33, 0.08 ], 0.5, 0 ], [ 'navy', [ 0.012, 0.02, 0.06 ], 0.5, 0 ], [ 'yellow', [ 0.78, 0.56, 0.02 ], 0.4, 0 ],
	[ 'grey', [ 0.2, 0.2, 0.21 ], 0.6, 0.2 ], [ 'glass', [ 0.04, 0.05, 0.06 ], 0.05, 0.3 ], [ 'redlamp', [ 0.4, 0.05, 0.02 ], 0.4, 0, [ 1.0, 0.25, 0.08 ] ],
	[ 'foil', [ 0.7, 0.7, 0.72 ], 0.25, 1 ], [ 'brown', [ 0.16, 0.08, 0.03 ], 0.6, 0 ], [ 'pink', [ 0.8, 0.35, 0.5 ], 0.6, 0 ],
	[ 'orange', [ 0.8, 0.25, 0.02 ], 0.5, 0 ], [ 'cream', [ 0.7, 0.62, 0.45 ], 0.6, 0 ], [ 'powder', [ 0.3, 0.45, 0.68 ], 0.6, 0 ],
];
const PAL = Object.fromEntries( PALETTE.map( ( p, i ) => [ p[ 0 ], i ] ) );
const f3 = ( c ) => `vec3f( ${ c.map( ( v ) => v.toFixed( 3 ) ).join( ', ' ) } )`;
const PROPS_WGSL = /* wgsl */`
	var alb = array<vec3f, ${ PALETTE.length }>( ${ PALETTE.map( ( p ) => f3( p[ 1 ] ) ).join( ', ' ) } );
	var rm = array<vec2f, ${ PALETTE.length }>( ${ PALETTE.map( ( p ) => `vec2f( ${ p[ 2 ].toFixed( 2 ) }, ${ p[ 3 ].toFixed( 2 ) } )` ).join( ', ' ) } );
	var glo = array<vec3f, ${ PALETTE.length }>( ${ PALETTE.map( ( p ) => f3( p[ 4 ] || [ 0, 0, 0 ] ) ).join( ', ' ) } );
	let k = min( u32( max( in.uv.x, 0.0 ) ), ${ PALETTE.length - 1 }u );
	s.albedo = alb[ k ];
	s.roughness = rm[ k ].x;
	s.metalness = rm[ k ].y;
	s.emissive = glo[ k ] * mix( 0.6, 1.6, smoothstep( 0.1, 0.7, frame.night ) );
`;

class Props extends Quads {

	constructor() {

		super();
		this.k = 0;

	}

	// the palette entry for what's added next
	use( name ) {

		this.k = PAL[ name ];
		return this;

	}

	add( a, b, c, d, n ) {

		super.add( a, b, c, d, n, this.k + 0.5, this.k + 0.5 );

	}

}

// A frame on the ground plane of the field frame: origin o ([ x, z ]), a the right, n the forward (both unit
// [ x, z ]); P( x, y, z ) is right x, up y (above the concourse), forward z
function frame( o, a, n ) {

	return ( x, y, z ) => [ o[ 0 ] + a[ 0 ] * x + n[ 0 ] * z, STREET + y, o[ 1 ] + a[ 1 ] * x + n[ 1 ] * z ];

}

// a box in such a frame: centre ( x, y, z ), sizes ( sx, sy, sz ) along a, up, n
function lbox( q, P, a, n, x, y, z, sx, sy, sz ) {

	const X = [ a[ 0 ], 0, a[ 1 ] ], Z = [ n[ 0 ], 0, n[ 1 ] ];
	const c = ( i, j, k ) => P( x + i * sx / 2, y + j * sy / 2, z + k * sz / 2 );
	q.add( c( - 1, - 1, 1 ), c( 1, - 1, 1 ), c( 1, 1, 1 ), c( - 1, 1, 1 ), Z );
	q.add( c( 1, - 1, - 1 ), c( - 1, - 1, - 1 ), c( - 1, 1, - 1 ), c( 1, 1, - 1 ), Z.map( ( v ) => - v ) );
	q.add( c( 1, - 1, 1 ), c( 1, - 1, - 1 ), c( 1, 1, - 1 ), c( 1, 1, 1 ), X );
	q.add( c( - 1, - 1, - 1 ), c( - 1, - 1, 1 ), c( - 1, 1, 1 ), c( - 1, 1, - 1 ), X.map( ( v ) => - v ) );
	q.add( c( - 1, 1, 1 ), c( 1, 1, 1 ), c( 1, 1, - 1 ), c( - 1, 1, - 1 ), [ 0, 1, 0 ] );
	q.add( c( - 1, - 1, - 1 ), c( 1, - 1, - 1 ), c( 1, - 1, 1 ), c( - 1, - 1, 1 ), [ 0, - 1, 0 ] );

}

// a quad facing forward (+n) in a frame at depth z, x0..x1 by y0..y1, with its texture rectangle
// [ u left, v top, u right, v bottom ] (default: metres, u = x, v = y)
function fwd( q, P, n, x0, x1, y0, y1, z, uv = [ x0, y1, x1, y0 ] ) {

	const [ uL, vT, uR, vB ] = uv, N = [ n[ 0 ], 0, n[ 1 ] ];
	q.tri( P( x0, y0, z ), P( x1, y0, z ), P( x1, y1, z ), N, [ uL, vB ], [ uR, vB ], [ uR, vT ] );
	q.tri( P( x0, y0, z ), P( x1, y1, z ), P( x0, y1, z ), N, [ uL, vB ], [ uR, vT ], [ uL, vT ] );

}

// The field level's section numbers, as the Phillies number them: 101-104 in the right field seats, then
// from 105 at the right field pole round behind home plate (the low 120s: Guest Services behind 122, the
// ticket windows behind 124, McFadden's behind 127) to 139 at the left field pole, and the 140s in left.
// From the angle round home plate (field frame).
export function sectionAt( x, z ) {

	const a = Math.atan2( x, z ) * 180 / Math.PI; // 0 behind home plate, + toward first
	if ( Math.abs( a ) <= 134 ) return Math.round( 122.5 - a / 134 * 17.5 );
	if ( a > 0 ) return Math.max( 101, Math.round( 104 - ( a - 134 ) / 30 * 3 ) );
	return Math.min( 148, Math.round( 140 + ( - a - 134 ) / 30 * 8 ) );

}

// a colour a little darker (k < 1) or lighter
function shade( hex, k ) {

	const v = parseInt( hex.slice( 1 ), 16 );
	const c = [ v >> 16, ( v >> 8 ) & 255, v & 255 ].map( ( x ) => Math.max( 0, Math.min( 255, Math.round( x * k ) ) ) );
	return `rgb( ${ c.join( ', ' ) } )`;

}

// the little figures on the signs: the man, the woman, the family, the cross, the i, the ticket
function pictogram( ctx, k, x, y, fg, bg ) {

	ctx.save();
	ctx.fillStyle = fg;
	ctx.strokeStyle = fg;
	const person = ( px, s, dress ) => {

		ctx.beginPath(); ctx.arc( px, y - 26 * s, 9 * s, 0, Math.PI * 2 ); ctx.fill();
		ctx.beginPath();
		if ( dress ) {

			ctx.moveTo( px - 6 * s, y - 14 * s ); ctx.lineTo( px + 6 * s, y - 14 * s ); ctx.lineTo( px + 17 * s, y + 14 * s ); ctx.lineTo( px - 17 * s, y + 14 * s );

		} else ctx.rect( px - 11 * s, y - 14 * s, 22 * s, 28 * s );
		ctx.fill();
		ctx.fillRect( px - 8 * s, y + 12 * s, 6 * s, 22 * s );
		ctx.fillRect( px + 2 * s, y + 12 * s, 6 * s, 22 * s );

	};

	let drawn = true;
	if ( k === 'men' ) person( x, 1.2, false );
	else if ( k === 'women' ) person( x, 1.2, true );
	else if ( k === 'family' ) {

		person( x - 22, 0.95, false ); person( x + 22, 0.95, true ); person( x, 0.6, false );

	} else if ( k === 'firstaid' ) {

		ctx.fillRect( x - 11, y - 34, 22, 68 ); ctx.fillRect( x - 34, y - 11, 68, 22 );

	} else if ( k === 'guest' ) {

		ctx.beginPath(); ctx.arc( x, y, 34, 0, Math.PI * 2 ); ctx.fill();
		ctx.fillStyle = bg;
		ctx.font = 'italic 700 50px Georgia, serif';
		ctx.textAlign = 'center';
		ctx.fillText( 'i', x, y + 3 );

	} else if ( k === 'tickets' ) {

		ctx.lineWidth = 4;
		ctx.strokeRect( x - 34, y - 20, 68, 40 );
		ctx.setLineDash( [ 5, 5 ] ); ctx.beginPath(); ctx.moveTo( x + 14, y - 20 ); ctx.lineTo( x + 14, y + 20 ); ctx.stroke();

	} else drawn = false;
	ctx.restore();
	return drawn;

}

// The rooms behind the openings, traced from the view ray (a box behind the opening's quad: its back
// wall, floor, ceiling and sides) so they have depth without geometry. uv.x = code * 20 + metres from the
// opening's left edge (code = room * 4 + width class: 1.6, 2.2, 3.0 or 6.8 m), uv.y = height above the
// concourse. Rooms: 0 a grill (the flat-top's glowing edge, fryers, foil-wrapped sandwiches under red
// heat lamps, the hood and its lights, order slips), 1 the market (the popcorn machine lit yellow, the
// hot dog roller, the Coke fountain, shelves of Cracker Jack and peanuts), 2 pizza ovens and a lit warmer
// of pies, 3 soft serve machines and stacks of the little helmet sundaes, 4 the taps and the lit beer
// coolers, 5 a restroom's tiled privacy wall, 6 an office (monitors, a notice board, a Phillies poster),
// 7 the team store (jerseys up the wall, caps on pegs), 8 First Aid, 9 the newsstand's racks.
const ROOMS_WGSL = /* wgsl */`
	let code = floor( in.uv.x / 20.0 );
	let xl = in.uv.x - code * 20.0;
	let room = i32( floor( code / 4.0 ) + 0.01 );
	let wc = i32( code + 0.01 ) - room * 4;
	let w = select( select( select( 6.8, 3.0, wc == 2 ), 2.2, wc == 1 ), 1.6, wc == 0 );
	var deep = 1.7;
	if ( room == 4 ) { deep = 1.9; }
	if ( room == 5 ) { deep = 1.1; }
	if ( room == 6 || room == 8 ) { deep = 2.4; }
	if ( room == 7 ) { deep = 3.0; }
	if ( room == 9 ) { deep = 2.2; }
	let ceilY = select( 2.35, 2.7, room >= 5 );
	let y = in.uv.y;
	let Nw = normalize( in.N );
	let T = normalize( cross( vec3f( 0.0, 1.0, 0.0 ), Nw ) );
	let Vd = normalize( in.P - frame.cameraPos );
	let rd = vec3f( dot( Vd, T ), Vd.y, max( dot( Vd, - Nw ), 0.02 ) );
	var t = deep / rd.z;
	var hitK = 0;
	if ( rd.y < 0.0 ) { let tf = - y / rd.y; if ( tf < t ) { t = tf; hitK = 1; } }
	if ( rd.y > 0.0 ) { let tc = ( ceilY - y ) / rd.y; if ( tc < t ) { t = tc; hitK = 2; } }
	if ( rd.x < 0.0 ) { let tl = - xl / rd.x; if ( tl < t ) { t = tl; hitK = 3; } }
	if ( rd.x > 0.0 ) { let tr = ( w - xl ) / rd.x; if ( tr < t ) { t = tr; hitK = 4; } }
	let h = vec3f( xl, y, 0.0 ) + rd * t;
	let hx = h.x;
	let hy = h.y;
	let hz = h.z;
	let tileG = abs( fract( vec2f( hx, hy ) / 0.15 ) - 0.5 );
	let grout = step( 0.44, max( tileG.x, tileG.y ) );
	let hsh = fract( sin( vec2f( floor( hx / 0.25 ), floor( hy / 0.3 ) ) * vec2f( 12.9898, 78.233 ) ) * 43758.5453 );
	let rnd = fract( hsh.x + hsh.y * 7.13 );
	var col = vec3f( 0.6, 0.58, 0.54 ) * ( 1.0 - 0.18 * grout );
	var e = vec3f( 0.0 );
	var light = 0.5;
	if ( hitK == 1 ) {
		// the floor: red quarry tile in the kitchens, grey tile in the rooms, worn and greasy
		let fg = abs( fract( vec2f( hx, hz ) / 0.2 ) - 0.5 );
		col = select( vec3f( 0.3, 0.29, 0.28 ), vec3f( 0.28, 0.1, 0.07 ), room < 5 ) * ( 1.0 - 0.3 * step( 0.45, max( fg.x, fg.y ) ) );
		if ( room == 7 || room == 6 ) { col = vec3f( 0.12, 0.12, 0.14 ); }
	} else if ( hitK == 2 ) {
		// the ceiling: fluorescent troffers
		let cg = abs( fract( vec2f( hx / 1.2, hz / 0.6 ) ) - 0.5 );
		col = vec3f( 0.7 );
		e = vec3f( 1.0, 0.95, 0.85 ) * step( max( cg.x * 1.4, cg.y ), 0.3 ) * 2.5;
	} else if ( hitK >= 3 ) {
		// the sides: tile, or painted in the rooms
		col = select( vec3f( 0.6, 0.58, 0.54 ) * ( 1.0 - 0.18 * step( 0.44, max( abs( fract( hz / 0.15 ) - 0.5 ), tileG.y ) ) ), vec3f( 0.55, 0.53, 0.5 ), room >= 6 );
		if ( hy < 0.9 && room < 5 ) { col = vec3f( 0.33, 0.34, 0.35 ); }
	} else {
		if ( room == 0 ) {
			if ( hy < 0.9 ) { col = vec3f( 0.33, 0.34, 0.35 ) * ( 0.85 + 0.15 * step( 0.5, fract( hx * 1.4 ) ) ); }
			// the flat-top and its hot front edge
			if ( hx > 0.25 && hx < 2.8 && hy > 0.9 && hy < 1.02 ) { col = vec3f( 0.04 ); if ( hy < 0.935 ) { e += vec3f( 1.0, 0.35, 0.08 ) * 0.9; } }
			// the meat and onions on it, chopped and steaming, seen over its edge
			if ( hx > 0.4 && hx < 2.6 && hy > 1.02 && hy < 1.06 ) { col = mix( vec3f( 0.25, 0.12, 0.05 ), vec3f( 0.55, 0.42, 0.2 ), rnd ); }
			// the fryers with their baskets
			if ( hx > 3.0 && hx < 4.0 && hy > 0.9 && hy < 1.4 ) { col = vec3f( 0.3, 0.31, 0.32 ); if ( hy > 1.18 && fract( ( hx - 3.0 ) * 2.0 ) > 0.15 ) { col = vec3f( 0.08, 0.075, 0.07 ); } }
			// sandwiches in foil on a shelf under the red heat lamps
			if ( hx > 4.3 && hx < 6.6 ) {
				if ( hy > 1.28 && hy < 1.32 ) { col = vec3f( 0.45 ); }
				if ( hy > 1.32 && hy < 1.43 && fract( hx / 0.26 ) > 0.12 ) { col = vec3f( 0.75, 0.75, 0.78 ); light = 0.9; }
				if ( hy > 1.62 && hy < 1.7 && fract( hx / 0.55 ) > 0.2 ) { col = vec3f( 0.4, 0.05, 0.02 ); e += vec3f( 1.0, 0.22, 0.05 ) * 2.2; }
				if ( hy > 1.28 && hy < 1.62 ) { e += col * vec3f( 1.0, 0.3, 0.1 ) * 0.5; }
			}
			// order slips on the ticket rail
			if ( hx > 0.4 && hx < 2.6 && hy > 1.72 && hy < 1.86 && fract( hx / 0.19 ) < 0.6 ) { col = vec3f( 0.85, 0.84, 0.78 ); }
			// the hood
			if ( hy > 1.95 ) { col = vec3f( 0.42, 0.43, 0.44 ) * ( 0.9 + 0.1 * step( 0.5, fract( hx * 2.0 ) ) ); if ( hy < 1.99 ) { e += vec3f( 1.0, 0.92, 0.8 ) * 1.2; } }
		} else if ( room == 1 ) {
			col = vec3f( 0.55, 0.5, 0.42 );
			if ( hy < 0.9 ) { col = vec3f( 0.33, 0.34, 0.35 ); }
			// the popcorn machine
			if ( hx > 0.3 && hx < 1.2 && hy > 0.92 && hy < 1.9 ) {
				col = vec3f( 0.42, 0.03, 0.03 );
				if ( hx > 0.37 && hx < 1.13 && hy > 1.0 && hy < 1.75 ) { col = mix( vec3f( 0.95, 0.8, 0.45 ), vec3f( 0.8, 0.6, 0.25 ), rnd ) * select( 0.6, 1.0, hy < 1.4 ); e += col * vec3f( 1.0, 0.8, 0.45 ) * 0.9; }
			}
			// the hot dog roller
			if ( hx > 1.5 && hx < 2.6 && hy > 0.92 && hy < 1.12 ) { col = select( vec3f( 0.45, 0.2, 0.1 ), vec3f( 0.5 ), fract( hy / 0.035 ) > 0.6 ); e += col * 0.3; }
			// the Coke fountain
			if ( hx > 2.9 && hx < 4.1 && hy > 0.92 && hy < 1.78 ) {
				col = vec3f( 0.03 );
				if ( hy > 1.45 ) { col = vec3f( 0.5, 0.02, 0.02 ); e += vec3f( 0.9, 0.05, 0.04 ) * 0.9; if ( abs( hy - 1.6 - 0.05 * sin( hx * 9.0 ) ) < 0.012 ) { col = vec3f( 0.9 ); e += vec3f( 0.9 ); } }
				if ( hy > 1.18 && hy < 1.24 && fract( hx / 0.2 ) < 0.5 ) { col = vec3f( 0.5 ); }
			}
			// shelves of Cracker Jack, peanuts, candy
			if ( hx > 4.4 && hx < 6.6 && hy > 1.05 && hy < 2.15 ) {
				let sh = fract( ( hy - 1.05 ) / 0.37 );
				col = vec3f( 0.3 );
				if ( sh > 0.08 && sh < 0.8 && fract( hx / 0.25 ) > 0.1 ) {
					col = select( select( vec3f( 0.5, 0.35, 0.18 ), vec3f( 0.7, 0.05, 0.05 ), rnd > 0.4 ), vec3f( 0.1, 0.2, 0.55 ), rnd > 0.8 );
					if ( rnd > 0.4 && rnd <= 0.8 && fract( hy / 0.06 ) > 0.5 ) { col = vec3f( 0.85 ); }
				}
			}
		} else if ( room == 2 ) {
			col = vec3f( 0.6, 0.58, 0.54 ) * ( 1.0 - 0.18 * grout );
			if ( hy < 0.9 ) { col = vec3f( 0.33, 0.34, 0.35 ); }
			// two deck ovens, their windows glowing
			if ( hx > 0.3 && hx < 2.9 && hy > 0.92 && hy < 2.0 ) {
				let dk = fract( ( hy - 0.92 ) / 0.54 );
				col = vec3f( 0.4, 0.41, 0.42 );
				if ( hx > 0.7 && hx < 2.5 && dk > 0.3 && dk < 0.6 ) { col = vec3f( 0.08, 0.03, 0.01 ); e += vec3f( 1.0, 0.45, 0.12 ) * ( 0.5 + 0.4 * rnd ); }
				if ( dk > 0.7 && dk < 0.76 ) { col = vec3f( 0.7 ); }
			}
			// the warmer: pies on two shelves under lights
			if ( hx > 3.2 && hx < 5.4 && hy > 0.92 && hy < 1.66 ) {
				col = vec3f( 0.2 );
				let pc = vec2f( fract( ( hx - 3.2 ) / 0.44 ) - 0.5, fract( ( hy - 0.92 ) / 0.37 ) - 0.35 );
				if ( length( pc * vec2f( 1.0, 2.6 ) ) < 0.42 ) { col = vec3f( 0.8, 0.52, 0.18 ); if ( fract( ( hx + hy ) * 11.0 ) < 0.18 ) { col = vec3f( 0.5, 0.05, 0.03 ); } }
				e += col * vec3f( 1.0, 0.75, 0.45 ) * 0.7;
			}
			// pizza boxes
			if ( hx > 5.7 && hx < 6.6 && hy > 0.92 && hy < 1.7 ) { col = select( vec3f( 0.8, 0.78, 0.72 ), vec3f( 0.6, 0.05, 0.04 ), fract( hy / 0.05 ) < 0.2 ); }
		} else if ( room == 3 ) {
			// blue and white tile, the soft serve machines, the helmets
			let ck = step( 0.5, fract( floor( hx / 0.15 ) * 0.5 + floor( hy / 0.15 ) * 0.5 ) );
			col = mix( vec3f( 0.7, 0.7, 0.68 ), vec3f( 0.15, 0.28, 0.55 ), ck ) * ( 1.0 - 0.15 * grout );
			if ( hy < 0.9 ) { col = vec3f( 0.72, 0.72, 0.7 ); }
			for ( var m = 0; m < 2; m++ ) {
				let mx = 0.5 + f32( m ) * 1.5;
				if ( hx > mx && hx < mx + 1.0 && hy > 0.9 && hy < 1.85 ) {
					col = vec3f( 0.5, 0.51, 0.52 );
					if ( hy > 1.3 && hy < 1.45 && fract( ( hx - mx ) * 3.0 ) < 0.25 ) { col = vec3f( 0.05 ); }
					if ( hy > 1.7 ) { e += vec3f( 0.6, 0.8, 1.0 ) * 0.4; }
				}
			}
			if ( hx > 3.4 && hx < 6.4 && hy > 1.85 && hy < 2.05 ) {
				let hc = vec2f( fract( ( hx - 3.4 ) / 0.14 ) - 0.5, ( hy - 1.85 ) / 0.2 );
				if ( length( vec2f( hc.x, hc.y * 0.7 ) ) < 0.45 ) { col = select( vec3f( 0.55, 0.03, 0.04 ), vec3f( 0.04, 0.1, 0.4 ), fract( floor( ( hx - 3.4 ) / 0.14 ) * 0.5 ) > 0.1 ); }
			}
			if ( hx > 3.6 && hx < 5.2 && hy > 1.1 && hy < 1.7 ) { col = select( vec3f( 0.1, 0.4, 0.15 ), vec3f( 0.85 ), abs( hy - 1.4 ) < 0.07 ); e += col * 0.5; }
		} else if ( room == 4 ) {
			// dark wood, the tap tower and its handles, the lit coolers of bottles, a neon sign
			col = vec3f( 0.18, 0.1, 0.05 ) * ( 0.8 + 0.2 * step( 0.1, fract( hx / 0.12 ) ) );
			if ( hy < 0.9 ) { col = select( vec3f( 0.5, 0.51, 0.52 ), vec3f( 0.3 ), fract( hy / 0.3 ) < 0.1 ); }
			if ( hx > 0.4 && hx < 3.4 ) {
				if ( hy > 0.92 && hy < 0.97 ) { col = vec3f( 0.6 ); }
				if ( hy > 1.02 && hy < 1.2 ) { col = vec3f( 0.75, 0.75, 0.78 ); light = 0.8; }
				let ti = floor( ( hx - 0.4 ) / 0.37 );
				if ( hy > 1.2 && hy < 1.5 && abs( fract( ( hx - 0.4 ) / 0.37 ) - 0.5 ) < 0.12 ) {
					var tc = array<vec3f, 8>( vec3f( 0.03 ), vec3f( 0.05, 0.15, 0.55 ), vec3f( 0.8 ), vec3f( 0.6, 0.62, 0.66 ), vec3f( 0.8, 0.35, 0.05 ), vec3f( 0.1, 0.35, 0.12 ), vec3f( 0.55, 0.05, 0.05 ), vec3f( 0.75, 0.6, 0.3 ) );
					col = tc[ u32( ti ) % 8u ];
					if ( hy > 1.44 ) { col = vec3f( 0.7, 0.55, 0.15 ); }
				}
				// the neon over the taps
				if ( abs( length( vec2f( ( hx - 1.9 ) / 0.9, ( hy - 1.9 ) / 0.13 ) ) - 1.0 ) < 0.05 && hy > 1.78 ) { col = vec3f( 1.0, 0.3, 0.1 ); e += vec3f( 1.0, 0.25, 0.08 ) * 3.0; }
			}
			if ( hx > 3.8 && hx < 6.6 && hy > 0.1 && hy < 2.1 ) {
				let fr = fract( ( hx - 3.8 ) / 0.7 );
				col = vec3f( 0.75, 0.8, 0.85 );
				let sh = fract( hy / 0.35 );
				if ( sh > 0.1 && sh < 0.75 && fract( hx / 0.075 ) > 0.35 ) { col = select( select( vec3f( 0.3, 0.15, 0.03 ), vec3f( 0.05, 0.25, 0.08 ), rnd > 0.55 ), vec3f( 0.7, 0.72, 0.75 ), rnd > 0.85 ); }
				e += col * vec3f( 0.8, 0.9, 1.0 ) * 0.9;
				if ( fr < 0.04 || fr > 0.96 ) { col = vec3f( 0.05 ); e = vec3f( 0.0 ); }
			}
		} else if ( room == 5 ) {
			// the privacy wall: cream tile, a band of navy, the bright tubes over it
			col = vec3f( 0.72, 0.68, 0.58 ) * ( 1.0 - 0.2 * grout );
			if ( abs( hy - 1.25 ) < 0.05 ) { col = vec3f( 0.05, 0.08, 0.2 ); }
			if ( hy < 0.12 ) { col = vec3f( 0.2 ); }
			light = 0.75;
		} else if ( room == 6 ) {
			// an office: a notice board, a Phillies poster, two monitors on the counter
			col = vec3f( 0.55, 0.57, 0.58 );
			if ( hy < 1.0 ) { col = vec3f( 0.3, 0.31, 0.33 ); }
			if ( hx > 0.2 && hx < 1.0 && hy > 1.35 && hy < 2.0 ) { col = vec3f( 0.45, 0.3, 0.15 ); if ( rnd > 0.35 ) { col = vec3f( 0.85, 0.84, 0.8 ); } }
			if ( hx > 1.25 && hx < 1.95 && hy > 1.3 && hy < 2.2 ) { col = vec3f( 0.5, 0.03, 0.04 ); if ( length( vec2f( hx - 1.6, hy - 1.8 ) ) < 0.17 ) { col = vec3f( 0.85 ); } }
			for ( var m = 0; m < 2; m++ ) {
				let mx = 0.3 + f32( m ) * 1.0;
				if ( hx > mx && hx < mx + 0.45 && hy > 1.05 && hy < 1.35 ) { col = vec3f( 0.02 ); if ( hx > mx + 0.03 && hx < mx + 0.42 && hy > 1.08 && hy < 1.32 ) { col = vec3f( 0.2, 0.35, 0.6 ); e += vec3f( 0.35, 0.55, 1.0 ) * 0.7; } }
			}
		} else if ( room == 7 ) {
			// the team store: slatwall, jerseys two rows up it, caps on pegs, a banner
			col = vec3f( 0.33, 0.31, 0.28 ) * ( 0.85 + 0.15 * step( 0.15, fract( hy / 0.1 ) ) );
			let jx = fract( hx / 0.55 );
			let row = floor( hy / 0.75 );
			let jy = fract( hy / 0.75 );
			let jid = fract( sin( floor( hx / 0.55 ) * 17.1 + row * 3.7 ) * 4375.5 );
			let tee = ( jx > 0.18 && jx < 0.82 && jy > 0.1 && jy < 0.8 ) || ( jx > 0.06 && jx < 0.94 && jy > 0.62 && jy < 0.8 );
			if ( hy > 0.5 && hy < 2.0 && tee ) {
				col = vec3f( 0.82, 0.8, 0.75 );
				if ( fract( jx * 9.0 ) < 0.12 ) { col = vec3f( 0.5, 0.05, 0.06 ); }
				if ( jid > 0.45 ) { col = vec3f( 0.45, 0.02, 0.03 ); }
				if ( jid > 0.7 ) { col = vec3f( 0.45 ); }
				if ( jid > 0.85 ) { col = vec3f( 0.35, 0.5, 0.72 ); }
				if ( abs( jx - 0.5 ) < 0.1 && abs( jy - 0.45 ) < 0.12 ) { col = select( vec3f( 0.8 ), vec3f( 0.5, 0.03, 0.05 ), jid < 0.45 || jid > 0.7 ); }
			}
			if ( hy > 2.05 && hy < 2.28 ) { let cx2 = fract( hx / 0.26 ) - 0.5; if ( length( vec2f( cx2, ( hy - 2.12 ) / 0.26 ) ) < 0.34 ) { col = select( vec3f( 0.5, 0.02, 0.03 ), vec3f( 0.02, 0.05, 0.2 ), rnd > 0.75 ); if ( length( vec2f( cx2, ( hy - 2.14 ) / 0.26 ) ) < 0.1 ) { col = vec3f( 0.85 ); } } }
			if ( hy > 2.36 && hy < 2.62 ) { col = select( vec3f( 0.02, 0.06, 0.2 ), vec3f( 0.75, 0.6, 0.2 ), abs( hy - 2.49 ) < 0.03 ); }
			light = 0.8;
		} else if ( room == 8 ) {
			col = vec3f( 0.75, 0.75, 0.74 );
			if ( ( abs( hx - w * 0.5 ) < 0.06 && abs( hy - 1.8 ) < 0.2 ) || ( abs( hx - w * 0.5 ) < 0.2 && abs( hy - 1.8 ) < 0.06 ) ) { col = vec3f( 0.6, 0.02, 0.03 ); }
			if ( hy < 0.95 && hx > 0.2 && hx < w - 0.2 ) { col = vec3f( 0.6, 0.62, 0.66 ); if ( abs( fract( hx / 0.5 ) - 0.5 ) < 0.02 ) { col = vec3f( 0.3 ); } }
			light = 0.75;
		} else if ( room == 9 ) {
			// racks of magazines, the World Series programs stacked in front
			col = vec3f( 0.25, 0.2, 0.15 );
			if ( hy > 0.8 && hy < 2.1 && fract( hx / 0.22 ) > 0.08 && fract( ( hy - 0.8 ) / 0.33 ) > 0.1 ) {
				col = mix( vec3f( 0.7, 0.1, 0.1 ), vec3f( 0.1, 0.2, 0.6 ), rnd ) * ( 0.6 + 0.6 * hsh.y );
				if ( fract( ( hy - 0.8 ) / 0.33 ) > 0.8 ) { col = vec3f( 0.85 ); }
			}
		}
	}
	s.albedo = col * 0.25;
	s.roughness = 0.4;
	s.emissive = ( col * vec3f( 1.0, 0.86, 0.68 ) * light + e ) * mix( 0.45, 1.0, smoothstep( 0.1, 0.7, frame.night ) );
`;

export class Concourse {

	constructor( { field, bowl, colliders } ) {

		this.field = field;
		this.colliders = colliders;
		this.group = new Group();
		this.group.name = 'concourse';
		field.group.add( this.group );
		this._aisleHeads( bowl );
		this._rail( bowl );
		this._stands( bowl );
		this._monitors( bowl );
		this._sectionSigns();

	}

	// TV monitors hung from the suite level's underside over the concourse round the infield, every
	// ~18 m, showing the broadcast (both faces)
	_monitors( bowl ) {

		const line = offsetPolyline( bowl.path.slice( 2, 10 ), bowl.top + 2.2, [ 0, - 40 ] );
		const tv = canvasTexture( 256, 144, ( ctx, w, h ) => {

			// the center field camera: the pitcher, the batter, the backstop, a score bug
			const g = ctx.createLinearGradient( 0, 0, 0, h );
			g.addColorStop( 0, '#1d2a44' ); g.addColorStop( 0.45, '#27466b' ); g.addColorStop( 0.46, '#2f6d2a' ); g.addColorStop( 1, '#3f8a31' );
			ctx.fillStyle = g;
			ctx.fillRect( 0, 0, w, h );
			ctx.fillStyle = '#b07a4e';
			ctx.beginPath(); ctx.ellipse( w / 2, h * 0.62, w * 0.3, h * 0.12, 0, 0, Math.PI * 2 ); ctx.fill();
			ctx.fillStyle = '#ffffff';
			ctx.fillRect( w * 0.47, h * 0.35, 8, 26 ); ctx.fillRect( w * 0.55, h * 0.45, 7, 22 );
			ctx.fillStyle = 'rgba( 0, 0, 0, 0.7 )';
			ctx.fillRect( 8, h - 26, 120, 18 );
			ctx.fillStyle = '#ffffff';
			ctx.font = '700 12px "Helvetica Neue", Arial, sans-serif';
			ctx.fillText( 'TB   PHI   FOX', 14, h - 13 );

		}, 'concourseTV' );
		const screen = standard( { name: 'concourse-tv', roughness: 0.2, textures: { bpTV: tv },
			surface: 'let t = textureSample( bpTV, smpAnisoClamp, in.uv ).rgb; s.albedo = t * 0.1; s.emissive = t * 0.9;' } );
		const housing = standard( { name: 'tv-housing', color: new Color( 0.02, 0.02, 0.022 ), roughness: 0.5 } );
		const q = new Quads(), sc = new Quads();
		const y = LEVELS.suites - 1.05, W = 1.15, H = 0.68;
		let acc = 9;
		for ( let i = 0; i < line.length - 1; i ++ ) {

			const [ ax, az ] = line[ i ], [ bx, bz ] = line[ i + 1 ];
			const len = Math.hypot( bx - ax, bz - az );
			const ux = ( bx - ax ) / len, uz = ( bz - az ) / len, nx = - uz, nz = ux;
			for ( ; acc < len; acc += 18 ) {

				const cx = ax + ux * acc, cz = az + uz * acc;
				box( q, [ cx, y, cz ], [ 0.1, 0.1, 0.1 ] );
				// a flat box turned along the concourse, its screens on both broad faces
				const P = ( a, b, yy, o ) => [ cx + ux * a + nx * o, yy, cz + uz * a + nz * o ];
				for ( const side of [ - 1, 1 ] ) {

					const o = side * 0.06;
					const L = side > 0 ? - W / 2 : W / 2, R = - L;
					sc.tri( P( L, 0, y - H / 2, o ), P( R, 0, y - H / 2, o ), P( R, 0, y + H / 2, o ), [ nx * side, 0, nz * side ], [ 0, 1 ], [ 1, 1 ], [ 1, 0 ] );
					sc.tri( P( L, 0, y - H / 2, o ), P( R, 0, y + H / 2, o ), P( L, 0, y + H / 2, o ), [ nx * side, 0, nz * side ], [ 0, 1 ], [ 1, 0 ], [ 0, 0 ] );

				}

				beam( q, P( - W / 2 - 0.04, 0, y - H / 2 - 0.04, - 0.05 ), P( W / 2 + 0.04, 0, y - H / 2 - 0.04, - 0.05 ), 0.1 );
				beam( q, P( - W / 2 - 0.04, 0, y + H / 2 + 0.04, - 0.05 ), P( W / 2 + 0.04, 0, y + H / 2 + 0.04, - 0.05 ), 0.1 );
				beam( q, P( 0, 0, y + H / 2, 0 ), P( 0, 0, LEVELS.suites - 0.3, 0 ), 0.05 );

			}

			acc -= len;

		}

		for ( const [ geo, m, name ] of [ [ q, housing, 'tv-housings' ], [ sc, screen, 'tv-screens' ] ] ) {

			m.underwaterLighting = 'none';
			const mesh = new Mesh( geo.geometry(), m );
			mesh.name = name;
			this.group.add( mesh );

		}

	}

	// The heads of the field level's aisles, where they meet the concourse: on each corner's bisector
	// between two sections, with the way along the concourse (u) and out from the field (n). Each gets
	// its section number.
	_aisleHeads( bowl ) {

		const tier = bowl.tiers[ 0 ];
		const secs = tierSections( tier );
		const d = ( tier.start || 0 ) + tier.rows * tier.depth;
		this.backEdge = d;
		this.aisles = [];
		for ( let k = 0; k < secs.length - 1; k ++ ) {

			const S = secs[ k ], T = secs[ k + 1 ];
			const s = S.len - S.m1 * d;
			const x = S.a[ 0 ] + S.ux * s + S.nx * d, z = S.a[ 1 ] + S.uz * s + S.nz * d;
			const ux = ( S.ux + T.ux ) / Math.hypot( S.ux + T.ux, S.uz + T.uz ), uz = ( S.uz + T.uz ) / Math.hypot( S.ux + T.ux, S.uz + T.uz );
			let nx = - uz, nz = ux;
			if ( nx * S.nx + nz * S.nz < 0 ) {

				nx = - nx; nz = - nz;

			}

			this.aisles.push( { x, z, ux, uz, nx, nz, num: sectionAt( x, z ) } );

		}

	}

	// The drink rail along the back of the field level seats: galvanized posts and a mid rail under a flat
	// aluminium shelf at 1.07 m, open at every aisle head (baseballparks.com, 2004: 'metal counters
	// throughout for standing guests to place food/drinks while viewing the field'; the 500-odd standing
	// room tickets of a sellout lean on them). The walker can't step over it: the way down is the aisles.
	// Where people lean: this.railSpots.
	_rail( bowl ) {

		const tier = bowl.tiers[ 0 ];
		const secs = tierSections( tier );
		const d = this.backEdge + 0.1, y0 = STREET;
		const q = new Quads(), shelf = new Quads();
		this.railSpots = [];
		const worldYaw = this.field.group.rotation.y;
		for ( const S of secs ) {

			if ( ! S.seats ) continue;
			const s0 = Math.min( S.len, S.m0 * d ) + 0.7, s1 = S.len - S.m1 * d - 0.7;
			if ( s1 - s0 < 1 ) continue;
			const at = ( s, o = 0 ) => [ S.a[ 0 ] + S.ux * s + S.nx * ( d + o ), S.a[ 1 ] + S.uz * s + S.nz * ( d + o ) ];
			const n = Math.max( 1, Math.round( ( s1 - s0 ) / 1.8 ) );
			for ( let i = 0; i <= n; i ++ ) {

				const [ x, z ] = at( s0 + ( s1 - s0 ) * i / n );
				beam( q, [ x, y0, z ], [ x, y0 + 1.04, z ], i === 0 || i === n ? 0.06 : 0.045 );

			}

			const [ ax, az ] = at( s0 ), [ bx, bz ] = at( s1 );
			beam( q, [ ax, y0 + 0.55, az ], [ bx, y0 + 0.55, bz ], 0.04 );
			beam( q, [ ax, y0 + 0.12, az ], [ bx, y0 + 0.12, bz ], 0.03 );
			// the shelf, over the concourse side of the posts, with a rolled front lip
			const [ a0x, a0z ] = at( s0 - 0.1, - 0.06 ), [ b0x, b0z ] = at( s1 + 0.1, - 0.06 );
			const [ a1x, a1z ] = at( s0 - 0.1, 0.26 ), [ b1x, b1z ] = at( s1 + 0.1, 0.26 );
			const yt = y0 + 1.07;
			shelf.add( [ a0x, yt, a0z ], [ b0x, yt, b0z ], [ b1x, yt, b1z ], [ a1x, yt, a1z ], [ 0, 1, 0 ] );
			shelf.add( [ a0x, yt - 0.03, a0z ], [ a1x, yt - 0.03, a1z ], [ b1x, yt - 0.03, b1z ], [ b0x, yt - 0.03, b0z ], [ 0, - 1, 0 ] );
			shelf.add( [ a1x, yt - 0.05, a1z ], [ b1x, yt - 0.05, b1z ], [ b1x, yt, b1z ], [ a1x, yt, a1z ], [ S.nx, 0, S.nz ] );
			shelf.add( [ b0x, yt - 0.03, b0z ], [ a0x, yt - 0.03, a0z ], [ a0x, yt, a0z ], [ b0x, yt, b0z ], [ - S.nx, 0, - S.nz ] );
			// a place to lean every 0.75 m
			for ( let s = s0 + 0.4; s < s1 - 0.3; s += 0.75 ) {

				const [ x, z ] = at( s, 0.62 );
				this.railSpots.push( { x, z, nx: S.nx, nz: S.nz, num: sectionAt( x, z ) } );

			}

			const [ cx, cz ] = at( ( s0 + s1 ) / 2, 0.08 ), w = this.field.toWorld( cx, cz );
			this.colliders.addBox( new Vector3( w.x, this.field.y0 + y0 + 0.55, w.z ), new Vector3( ( s1 - s0 ) / 2 + 0.05, 0.55, 0.2 ), worldYaw - Math.atan2( S.uz, S.ux ), { tag: 'drink-rail' } );

		}

		const galv = standard( { name: 'drink-rail', color: new Color( 0.42, 0.43, 0.44 ), roughness: 0.45, metalness: 0.7 } );
		const alu = standard( { name: 'drink-shelf', color: new Color( 0.62, 0.63, 0.64 ), roughness: 0.3, metalness: 0.85, modules: [ commonModule ],
			surface: /* wgsl */`
	// brushed along its length, rings where the cups stood, a spilled patch here and there
	if ( in.N.y > 0.5 ) {
		let ring = mx_noise_float2( in.P.xz * 7.0 );
		s.roughness = 0.35 + 0.15 * smoothstep( 0.4, 0.7, ring );
		s.albedo = s.albedo * ( 0.8 + 0.08 * mx_noise_float2( in.P.xz * 1.3 ) );
	}
` } );
		for ( const [ geo, m, name ] of [ [ q, galv, 'drink-rail' ], [ shelf, alu, 'drink-shelf' ] ] ) {

			m.underwaterLighting = 'none';
			const mesh = new Mesh( geo.geometry(), m );
			mesh.name = name;
			mesh.castShadow = true;
			mesh.receiveShadow = true;
			this.group.add( mesh );

		}

	}

	// The section numbers: over the head of every aisle a small tan plate with maroon numerals, both
	// faces, hung on two rods from the suite level's underside round the infield (the 2008 photos: '131'
	// over the aisle, a loudspeaker beside it), on a post at the rail's end down the lines where no deck
	// is overhead
	_sectionSigns() {

		const atlas = canvasTexture( 1024, 1024, ( ctx ) => {

			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			// ---- W2 (concourse): the signs as the 2008 photos show them (harpo42, May 2008: 129★130; the
			// Game 5 concourse, Oct 27: 131★132, 132★133, 133★134): a cream panel with fine tan pinstripes,
			// the two sections either side of the aisle in heavy navy numerals with a red star between, a
			// dark red band under them with SECTIONS in cream serif caps, in a navy frame; hung across the
			// walkway, read as you walk along the concourse
			for ( let i = 0; i < 32; i ++ ) {

				const x = ( i % 4 ) * 256, y = Math.floor( i / 4 ) * 128;
				ctx.fillStyle = '#232a4d';
				ctx.fillRect( x, y, 256, 128 );
				ctx.fillStyle = '#efe4c4';
				ctx.fillRect( x + 6, y + 6, 244, 82 );
				ctx.fillStyle = 'rgba( 170, 140, 90, 0.35 )';
				for ( let px = x + 12; px < x + 250; px += 7 ) ctx.fillRect( px, y + 6, 1, 82 );
				ctx.fillStyle = '#9e1b2a';
				ctx.fillRect( x + 6, y + 88, 244, 34 );
				ctx.fillStyle = '#efe4c4';
				ctx.font = '600 22px Georgia, "Times New Roman", serif';
				ctx.fillText( 'S E C T I O N S', x + 128, y + 106, 200 );
				const num = this.aisles[ i ]?.num;
				if ( num ) {

					ctx.fillStyle = '#1f1b33';
					ctx.font = '900 62px "Arial Narrow", "Helvetica Neue", Arial, sans-serif';
					ctx.fillText( String( num ), x + 66, y + 50, 100 );
					ctx.fillText( String( num + 1 ), x + 190, y + 50, 100 );
					// the star
					ctx.fillStyle = '#b31b2c';
					ctx.beginPath();
					for ( let k = 0; k < 10; k ++ ) {

						const a = - Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 7 : 16;
						ctx.lineTo( x + 128 + Math.cos( a ) * r, y + 48 + Math.sin( a ) * r );

					}

					ctx.fill();

				}

				// a little grime along the bottom
				ctx.fillStyle = 'rgba( 30, 20, 20, 0.15 )';
				ctx.fillRect( x + 6, y + 116, 244, 6 );

			}
			// ---- end W2

		}, 'sectionSigns' );
		const signMat = standard( { name: 'section-signs', roughness: 0.55, textures: { bpSec: atlas },
			surface: 'let t = textureSample( bpSec, smpAnisoClamp, in.uv ).rgb; s.albedo = t * 0.85; s.emissive = t * smoothstep( 0.1, 0.7, frame.night ) * 0.12;' } );
		const post = new Quads(), face = new Quads();
		// ---- W2 (concourse): the 2008 size (about 1.2 m across), turned to face along the concourse
		const W = 1.15, H = 0.56;
		// ---- end W2
		// under the suites: the infield between the dugouts' far ends
		const underDeck = ( x, z ) => Math.abs( Math.atan2( x, z ) ) < 1.95;
		this.aisles.forEach( ( A0, i ) => {

			if ( i >= 32 ) return;
			// ---- W2 (concourse): the sign's face across the walkway (its plane along n, facing along u)
			const A = { ...A0, ux: A0.nx, uz: A0.nz, nx: A0.ux, nz: A0.uz };
			// ---- end W2
			const hung = underDeck( A.x, A.z );
			// hung over the aisle's middle, or on a post at the rail's end beside it
			const along = hung ? 0 : 1.0;
			const cx = A.x + A.ux * along + A.nx * 0.1, cz = A.z + A.uz * along + A.nz * 0.1;
			const yc = hung ? LEVELS.suites - 0.95 : STREET + 2.35;
			const P = ( a, yy, o ) => [ cx + A.ux * a + A.nx * o, yy, cz + A.uz * a + A.nz * o ];
			const u0 = ( i % 4 ) / 4, v0 = Math.floor( i / 4 ) / 8, du = 1 / 4, dv = 1 / 8;
			// both faces read left to right: seen along -n (from the concourse) the right is ( nz, -nx )
			for ( const side of [ 1, - 1 ] ) {

				const o = side * 0.012;
				const rightIsU = side * ( A.ux * A.nz - A.uz * A.nx ) > 0;
				const [ L, R ] = rightIsU ? [ - W / 2, W / 2 ] : [ W / 2, - W / 2 ];
				const nrm = [ A.nx * side, 0, A.nz * side ];
				face.tri( P( L, yc - H / 2, o ), P( R, yc - H / 2, o ), P( R, yc + H / 2, o ), nrm, [ u0, v0 + dv ], [ u0 + du, v0 + dv ], [ u0 + du, v0 ] );
				face.tri( P( L, yc - H / 2, o ), P( R, yc + H / 2, o ), P( L, yc + H / 2, o ), nrm, [ u0, v0 + dv ], [ u0 + du, v0 ], [ u0, v0 ] );

			}

			// its edge, and what holds it up
			post.add( P( - W / 2, yc + H / 2, - 0.012 ), P( W / 2, yc + H / 2, - 0.012 ), P( W / 2, yc + H / 2, 0.012 ), P( - W / 2, yc + H / 2, 0.012 ), [ 0, 1, 0 ] );
			if ( hung ) for ( const a of [ - W * 0.35, W * 0.35 ] ) beam( post, P( a, yc + H / 2, 0 ), P( a, LEVELS.suites - 0.25, 0 ), 0.018 );
			else beam( post, P( 0, STREET, - 0.04 ), P( 0, yc - H / 2, - 0.04 ), 0.06 );

		} );

		const steel = standard( { name: 'sign-posts', color: new Color( 0.1, 0.1, 0.11 ), roughness: 0.5, metalness: 0.6 } );
		for ( const [ geo, m, name ] of [ [ post, steel, 'section-posts' ], [ face, signMat, 'section-signs' ] ] ) {

			m.underwaterLighting = 'none';
			const mesh = new Mesh( geo.geometry(), m );
			mesh.name = name;
			mesh.castShadow = true;
			this.group.add( mesh );

		}

	}

	_stands( bowl ) {

		const path = bowl.path, d0 = bowl.D.t400Back - 0.9 - DEPTH, d1 = d0 + DEPTH;
		// round the infield just inside the columns; in the outfield behind the left and right field seats
		// (under the Pavilion in right), clear of the scoreboard and the light tower in left
		const lf = bowl.tiers[ 1 ], rf = bowl.tiers[ 2 ];
		const lfTop = ( lf.start || 0 ) + lf.rows * lf.depth, rfTop = ( rf.start || 0 ) + rf.rows * rf.depth;
		const [ sbx, sbz ] = fencePoint( - 36, 452 ), [ ltx, ltz ] = fencePoint( - 24.5, 455 );
		const rows = [
			{ front: offsetPolyline( path, d0, [ 0, - 40 ] ), back: offsetPolyline( path, d1, [ 0, - 40 ] ), toward: [ 0, - 40 ] },
			{ front: offsetPolyline( rf.front, rfTop + 10, [ 0, 0 ] ), back: offsetPolyline( rf.front, rfTop + 10 + DEPTH, [ 0, 0 ] ), toward: [ 0, 0 ] },
			{ front: offsetPolyline( lf.front, lfTop + 9, [ 0, 0 ] ), back: offsetPolyline( lf.front, lfTop + 9 + DEPTH, [ 0, 0 ] ), toward: [ 0, 0 ], skip: ( x, z ) => Math.hypot( x - sbx, z - sbz ) < 26 || Math.hypot( x - ltx, z - ltz ) < 10 },
		];
		// the elevators' doors on the main concourse stay clear
		const clear = ( bowl.elevators || [] ).map( ( b ) => b.stops[ 0 ] );
		const units = [];
		for ( const { front, toward, skip } of rows ) for ( let i = 0; i < front.length - 1; i ++ ) {

			const [ ax, az ] = front[ i ], [ bx, bz ] = front[ i + 1 ];
			const len = Math.hypot( bx - ax, bz - az );
			const n = Math.floor( ( len - GAP ) / ( UNIT + GAP ) );
			if ( n < 1 ) continue;
			const pad = ( len - n * ( UNIT + GAP ) + GAP ) / 2;
			const ux = ( bx - ax ) / len, uz = ( bz - az ) / len;
			// toward the field
			let nx = - uz, nz = ux;
			if ( nx * ( toward[ 0 ] - ax ) + nz * ( toward[ 1 ] - az ) < 0 ) {

				nx = - nx; nz = - nz;

			}

			// the viewer's right, facing the unit from the concourse
			const a = ( ux * nz - uz * nx ) > 0 ? [ ux, uz ] : [ - ux, - uz ];
			for ( let j = 0; j < n; j ++ ) {

				const s = pad + j * ( UNIT + GAP ) + UNIT / 2;
				const mid = [ ax + ux * s, az + uz * s ];
				if ( clear.some( ( c ) => Math.hypot( c.x - mid[ 0 ], c.z - mid[ 1 ] ) < 7 ) ) continue;
				if ( skip && skip( mid[ 0 ], mid[ 1 ] ) ) continue;
				// nor the way in from each gate
				if ( GATES.some( ( g ) => {

					if ( ! g.edge ) return false;
					const dx = mid[ 0 ] - g.at[ 0 ], dz = mid[ 1 ] - g.at[ 1 ];
					const across = Math.abs( dx * g.edge.ux + dz * g.edge.uz ), inward = - ( dx * g.edge.nx + dz * g.edge.nz );
					return inward > - 2 && inward < 40 && across < g.width / 2 + UNIT / 2 + 2;

				} ) ) continue;
				units.push( { mid, n: [ nx, nz ], a, sec: sectionAt( mid[ 0 ], mid[ 1 ] ), last: j === n - 1, gap: [ mid[ 0 ] + ux * ( UNIT + GAP ) / 2, mid[ 1 ] + uz * ( UNIT + GAP ) / 2 ] } );

			}

		}

		// who goes where: each entry of the plan claims the free unit nearest its section (within four)
		for ( const [ what, sec ] of PLAN ) {

			let best = null;
			for ( const U of units ) if ( ! U.what && Math.abs( U.sec - sec ) <= 4 && ( ! best || Math.abs( U.sec - sec ) < Math.abs( best.sec - sec ) ) ) best = U;
			if ( best ) best.what = what;

		}

		let fill = 0;
		for ( const U of units ) if ( ! U.what ) U.what = FILL[ fill ++ % FILL.length ];

		const L = this._signLayout();
		const signs = this._signs( L );
		const body = new Quads(), face = new Quads(), glow = new Quads(), kick = new Quads(), lights = new Quads(), props = new Props();
		this.standSpots = [];
		this.doors = [];
		this.units = units;
		for ( const U of units ) {

			const P = frame( U.mid, U.a, U.n );
			const W = UNIT / 2;
			// the box: sides, back and roof in the concourse's precast
			fwd( body, P, U.n.map( ( v ) => - v ), W, - W, 0, H, - DEPTH );
			for ( const s of [ - 1, 1 ] ) {

				const X = [ U.a[ 0 ] * s, 0, U.a[ 1 ] * s ];
				body.add( P( s * W, 0, 0 ), P( s * W, 0, - DEPTH ), P( s * W, H, - DEPTH ), P( s * W, H, 0 ), X );

			}

			body.add( P( - W, H, 0 ), P( W, H, 0 ), P( W, H, - DEPTH ), P( - W, H, - DEPTH ), [ 0, 1, 0 ] );
			// a dark coping along the top of the front
			lbox( props.use( 'grey' ), P, U.a, U.n, 0, H + 0.04, 0.02, UNIT + 0.1, 0.08, 0.16 );
			if ( typeof U.what === 'string' ) this._foodUnit( U, P, FOOD[ U.what ], L, { body, face, glow, kick, lights, props } );
			else this._pairUnit( U, P, L, { body, face, glow, lights, props } );
			// can't walk through it
			const [ cx, , cz ] = P( 0, 0, - DEPTH / 2 + 0.2 ), w = this.field.toWorld( cx, cz );
			this.colliders.addBox( new Vector3( w.x, this.field.y0 + STREET + H / 2, w.z ), new Vector3( UNIT / 2 + 0.3, H / 2, DEPTH / 2 + 0.3 ), this.field.group.rotation.y - Math.atan2( U.a[ 1 ], U.a[ 0 ] ), { tag: 'concession' } );

		}

		const precast = standard( { name: 'concession-body', color: new Color( 0.5, 0.47, 0.42 ), roughness: 0.75, side: 'double' } );
		const signMat = standard( { name: 'concession-signs', roughness: 0.4, textures: { bpStand: signs },
			surface: 'let t = textureSample( bpStand, smpAnisoClamp, in.uv ).rgb; s.albedo = t * 0.45; s.emissive = t * mix( 0.3, 0.75, smoothstep( 0.1, 0.7, frame.night ) );' } );
		const kickMat = standard( { name: 'concession-kick', roughness: 0.45, metalness: 0.2, textures: { bpStand: signs },
			surface: 'let t = textureSample( bpStand, smpAnisoClamp, in.uv ).rgb; s.albedo = t * 0.8;' } );
		const lightMat = standard( { name: 'concession-lights', color: new Color( 0.9, 0.9, 0.88 ), roughness: 0.5,
			surface: 's.emissive = vec3f( 1.0, 0.93, 0.8 ) * mix( 1.5, 4.0, smoothstep( 0.1, 0.7, frame.night ) );' } );
		const propMat = standard( { name: 'concourse-props', roughness: 0.5, surface: PROPS_WGSL } );
		const kitchen = standard( { name: 'concession-rooms', color: new Color( 0.06, 0.055, 0.05 ), roughness: 0.5, surface: ROOMS_WGSL } );
		for ( const m of [ precast, signMat, kickMat, lightMat, propMat, kitchen ] ) m.underwaterLighting = 'none';
		for ( const [ q, m, name ] of [ [ body, precast, 'concession-stands' ], [ face, signMat, 'concession-signs' ], [ kick, kickMat, 'concession-kicks' ],
			[ lights, lightMat, 'concession-lights' ], [ glow, kitchen, 'concession-rooms' ], [ props, propMat, 'concourse-props' ] ] ) {

			const mesh = new Mesh( q.geometry(), m );
			mesh.name = name;
			mesh.castShadow = m === precast || m === propMat;
			mesh.receiveShadow = true;
			this.group.add( mesh );

		}

		this.props = props;
		this.count = units.length;

	}

	// A stand: pillars either side of the service window, the menu board over it on a lit lip, the name
	// across the top; the window over a stainless counter on a kick panel in the stand's colours, two
	// registers, napkins and straws at the ends; behind the counter the staff's bay (lit from its ceiling)
	// and the kitchen traced into depth beyond it; queue stanchions with belts out front
	_foodUnit( U, P, F, L, { body, face, glow, kick, lights, props } ) {

		const W = UNIT / 2, n = U.n, a = U.a, b = BRANDS.indexOf( U.what );
		const R = L.food[ b ];
		const OW = W - 0.35, OT = 2.35, BAY = 1.3;
		fwd( body, P, n, - W, - OW, 0, OT, 0 );
		fwd( body, P, n, OW, W, 0, OT, 0 );
		fwd( body, P, n, - W, W, OT, OT + 0.05, 0 );
		// the menu board and the name
		fwd( face, P, n, - W, W, OT + 0.05, 3.3, 0.02, [ 0, R.menu[ 0 ], 1, R.menu[ 1 ] ] );
		fwd( face, P, n, - W - 0.03, W + 0.03, 3.32, H, 0.05, [ 0, R.name[ 0 ], 1, R.name[ 1 ] ] );
		// a lip under the menu board with a light strip under it, lighting the counter
		lbox( props.use( 'black' ), P, a, n, 0, OT + 0.02, 0.2, UNIT - 0.2, 0.06, 0.4 );
		lights.add( P( - OW + 0.2, OT - 0.015, 0.35 ), P( OW - 0.2, OT - 0.015, 0.35 ), P( OW - 0.2, OT - 0.015, 0.3 ), P( - OW + 0.2, OT - 0.015, 0.3 ), [ 0, - 1, 0 ] );
		// the bay: its sides and ceiling, fluorescent tubes across it, the kitchen beyond
		for ( const s of [ - 1, 1 ] ) body.add( P( s * OW, 0, 0 ), P( s * OW, 0, - BAY ), P( s * OW, OT, - BAY ), P( s * OW, OT, 0 ), [ - a[ 0 ] * s, 0, - a[ 1 ] * s ] );
		body.add( P( - OW, OT, 0 ), P( OW, OT, 0 ), P( OW, OT, - BAY ), P( - OW, OT, - BAY ), [ 0, - 1, 0 ] );
		for ( const x of [ - 2.2, 0, 2.2 ] ) lights.add( P( x - 0.6, OT - 0.01, - 0.55 ), P( x + 0.6, OT - 0.01, - 0.55 ), P( x + 0.6, OT - 0.01, - 0.7 ), P( x - 0.6, OT - 0.01, - 0.7 ), [ 0, - 1, 0 ] );
		const code = F.kitchen * 4 + 3;
		fwd( glow, P, n, - OW, OW, 0, OT, - BAY, [ code * 20, OT, code * 20 + 2 * OW, 0 ] );
		// the counter and its kick panel
		lbox( props.use( 'steel' ), P, a, n, 0, 1.045, 0.05, 2 * OW, 0.05, 0.62 );
		fwd( kick, P, n, - OW, OW, 0, 1.02, 0.35, [ 0, R.kick[ 0 ], 1, R.kick[ 1 ] ] );
		for ( const s of [ - 1, 1 ] ) lbox( props.use( 'steel' ), P, a, n, s * ( OW - 0.02 ), 0.51, 0.05, 0.04, 1.02, 0.6 );
		// registers where the staff stand, napkins and straws at the ends
		for ( const x of [ - 1.6, 1.6 ] ) {

			lbox( props.use( 'black' ), P, a, n, x, 1.13, - 0.05, 0.36, 0.12, 0.3 );
			lbox( props.use( 'screen' ), P, a, n, x, 1.25, - 0.1, 0.24, 0.14, 0.03 );
			lbox( props.use( 'black' ), P, a, n, x + 0.3, 1.12, 0.02, 0.14, 0.1, 0.18 );

		}

		for ( const s of [ - 1, 1 ] ) {

			lbox( props.use( 'steel' ), P, a, n, s * ( OW - 0.35 ), 1.16, 0.18, 0.22, 0.2, 0.16 );
			lbox( props.use( 'white' ), P, a, n, s * ( OW - 0.35 ), 1.16, 0.265, 0.16, 0.12, 0.01 );
			lbox( props.use( 'cup' ), P, a, n, s * ( OW - 0.7 ), 1.17, 0.2, 0.08, 0.2, 0.08 );

		}

		// the line: stanchions either side of it, belts between
		const posts = [ 1.2, 2.5, 3.8 ];
		for ( const s of [ - 1, 1 ] ) {

			let prev = null;
			for ( const z of posts ) {

				const x = s * 0.58;
				lbox( props.use( 'black' ), P, a, n, x, 0.48, z, 0.05, 0.96, 0.05 );
				lbox( props.use( 'black' ), P, a, n, x, 0.015, z, 0.32, 0.03, 0.32 );
				if ( prev != null ) props.use( 'belt' ).add( P( x, 0.84, prev ), P( x, 0.84, z ), P( x, 0.9, z ), P( x, 0.9, prev ), [ a[ 0 ], 0, a[ 1 ] ] );
				prev = z;

			}

		}

		this.standSpots.push( { mid: U.mid, n, u: a, inset: 0.6, staff: [ - 1.6, 1.6 ], kind: 'food', brand: U.what, sec: U.sec } );

	}

	// Two halves, each a restroom door (a vestibule to a tiled privacy wall), a service window over a
	// ledge, or an open shop front, with its sign over it; the rest of the front plain wall
	_pairUnit( U, P, L, { body, face, glow, lights, props } ) {

		const W = UNIT / 2, n = U.n, a = U.a;
		const holes = U.what.map( ( k, h ) => {

			const c = ( h - 0.5 ) * W, T = HALF[ k ].type;
			if ( T === 'door' ) return { k, c, x0: c - 0.8, x1: c + 0.8, y0: 0, y1: 2.3, deep: 1.6, wc: 0 };
			if ( T === 'window' ) return { k, c, x0: c - 1.1, x1: c + 1.1, y0: 0.95, y1: 2.2, deep: 0.3, wc: 1 };
			return { k, c, x0: c - 1.5, x1: c + 1.5, y0: 0, y1: 2.5, deep: 0.6, wc: 2 };

		} );
		// the front wall round the openings
		const top = 2.55;
		fwd( body, P, n, - W, W, top, H, 0 );
		let x = - W;
		for ( const o of holes ) {

			fwd( body, P, n, x, o.x0, 0, top, 0 );
			if ( o.y0 > 0 ) fwd( body, P, n, o.x0, o.x1, 0, o.y0, 0 );
			fwd( body, P, n, o.x0, o.x1, o.y1, top, 0 );
			x = o.x1;

		}

		fwd( body, P, n, x, W, 0, top, 0 );
		for ( const o of holes ) {

			const hk = HALF[ o.k ];
			// the reveals, the head
			for ( const s of [ 0, 1 ] ) {

				const xs = s ? o.x1 : o.x0, sg = s ? - 1 : 1;
				body.add( P( xs, o.y0, 0 ), P( xs, o.y0, - o.deep ), P( xs, o.y1, - o.deep ), P( xs, o.y1, 0 ), [ a[ 0 ] * sg, 0, a[ 1 ] * sg ] );

			}

			body.add( P( o.x0, o.y1, 0 ), P( o.x1, o.y1, 0 ), P( o.x1, o.y1, - o.deep ), P( o.x0, o.y1, - o.deep ), [ 0, - 1, 0 ] );
			if ( o.y0 > 0 ) body.add( P( o.x0, o.y0, 0 ), P( o.x1, o.y0, 0 ), P( o.x1, o.y0, - o.deep ), P( o.x0, o.y0, - o.deep ), [ 0, 1, 0 ] );
			const code = hk.room * 4 + o.wc;
			fwd( glow, P, n, o.x0, o.x1, o.y0, o.y1, - o.deep, [ code * 20, o.y1, code * 20 + ( o.x1 - o.x0 ), o.y0 ] );
			// its sign
			const S = L.half[ HALVES.indexOf( o.k ) ];
			fwd( face, P, n, o.c - 1.7, o.c + 1.7, 2.62, 3.32, 0.04, [ S[ 0 ], S[ 1 ], S[ 2 ], S[ 3 ] ] );
			if ( hk.type === 'window' ) {

				// a ledge, a bell, a light over it
				lbox( props.use( 'steel' ), P, a, n, o.c, o.y0 + 0.05, 0.05, o.x1 - o.x0 + 0.1, 0.04, 0.4 );
				lights.add( P( o.x0 + 0.2, o.y1 - 0.01, - 0.05 ), P( o.x1 - 0.2, o.y1 - 0.01, - 0.05 ), P( o.x1 - 0.2, o.y1 - 0.01, - 0.2 ), P( o.x0 + 0.2, o.y1 - 0.01, - 0.2 ), [ 0, - 1, 0 ] );
				this.standSpots.push( { mid: P( o.c, 0, 0 ).filter( ( v, i ) => i !== 1 ), n, u: a, inset: 0.25, staff: [ 0 ], kind: 'window', what: o.k, sec: U.sec } );

			} else if ( hk.type === 'shop' ) {

				lights.add( P( o.x0 + 0.2, o.y1 - 0.01, - 0.1 ), P( o.x1 - 0.2, o.y1 - 0.01, - 0.1 ), P( o.x1 - 0.2, o.y1 - 0.01, - 0.3 ), P( o.x0 + 0.2, o.y1 - 0.01, - 0.3 ), [ 0, - 1, 0 ] );
				// a rack of T-shirts and a table of caps out front
				lbox( props.use( 'black' ), P, a, n, o.c + 0.9, 0.55, 0.9, 0.9, 0.04, 0.5 );
				for ( let i = 0; i < 5; i ++ ) lbox( props.use( i % 2 ? 'cartred' : 'white' ), P, a, n, o.c + 0.6 + i * 0.15, 0.62, 0.9, 0.12, 0.1, 0.22 );
				for ( const s of [ - 1, 1 ] ) lbox( props.use( 'black' ), P, a, n, o.c + 0.9 + s * 0.42, 0.27, 0.9, 0.04, 0.54, 0.04 );
				this.standSpots.push( { mid: P( o.c, 0, 0 ).filter( ( v, i ) => i !== 1 ), n, u: a, inset: 0.3, staff: [ - 0.6 ], kind: 'shop', what: o.k, sec: U.sec } );

			} else {

				this.doors.push( { x: P( o.c, 0, 0.3 )[ 0 ], z: P( o.c, 0, 0.3 )[ 2 ], n, a, kind: o.k, sec: U.sec } );
				// a CAUTION WET FLOOR sign by the door, the floor tracked wet in the rain
				if ( o.k !== 'family' ) {

					const px = o.c + ( o.c > 0 ? 1.15 : - 1.15 );
					props.use( 'yellow' );
					props.add( P( px - 0.16, 0, 0.55 ), P( px + 0.16, 0, 0.55 ), P( px + 0.12, 0.62, 0.42 ), P( px - 0.12, 0.62, 0.42 ), [ n[ 0 ], 0.2, n[ 1 ] ] );
					props.add( P( px + 0.16, 0, 0.29 ), P( px - 0.16, 0, 0.29 ), P( px - 0.12, 0.62, 0.42 ), P( px + 0.12, 0.62, 0.42 ), [ - n[ 0 ], 0.2, - n[ 1 ] ] );

				}

			}

		}

	}

	// the atlas of the stands' signs: per stand its name band, menu board and kick panel, then the half
	// units' signs two to a row
	_signLayout() {

		const W = 1024, NH = 112, MH = 224, KH = 48, HH = 112;
		const per = NH + MH + KH;
		const total = BRANDS.length * per + Math.ceil( HALVES.length / 2 ) * HH;
		const food = BRANDS.map( ( b, i ) => ( {
			y: i * per,
			name: [ ( i * per ) / total, ( i * per + NH ) / total ],
			menu: [ ( i * per + NH ) / total, ( i * per + NH + MH ) / total ],
			kick: [ ( i * per + NH + MH ) / total, ( i * per + per ) / total ],
		} ) );
		const y0 = BRANDS.length * per;
		const half = HALVES.map( ( k, i ) => {

			const x = ( i % 2 ) * 0.5, y = y0 + Math.floor( i / 2 ) * HH;
			return [ x + 0.002, y / total, x + 0.498, ( y + HH ) / total ];

		} );
		return { W, NH, MH, KH, HH, per, total, food, half, y0 };

	}

	_signs( L ) {

		const { W, NH, MH, KH, HH, total } = L;
		return canvasTexture( W, total, ( ctx ) => {

			const sans = '"Helvetica Neue", Helvetica, Arial, sans-serif', serif = 'Georgia, "Times New Roman", serif';
			ctx.textBaseline = 'middle';
			BRANDS.forEach( ( key, i ) => {

				const F = FOOD[ key ], y = L.food[ i ].y;
				// the name band: its colour, fine rules in the accent, the name, the line under it
				const g = ctx.createLinearGradient( 0, y, 0, y + NH );
				g.addColorStop( 0, F.bg ); g.addColorStop( 1, shade( F.bg, 0.8 ) );
				ctx.fillStyle = g;
				ctx.fillRect( 0, y, W, NH );
				ctx.fillStyle = F.accent;
				ctx.fillRect( 0, y + 6, W, 3 ); ctx.fillRect( 0, y + NH - 9, W, 3 );
				ctx.textAlign = 'center';
				ctx.fillStyle = F.fg;
				ctx.font = `${ F.italic ? 'italic ' : '' }${ F.serif ? '700' : '900' } 58px ${ F.serif ? serif : sans }`;
				ctx.fillText( F.name, W / 2, y + 46, W - 70 );
				ctx.font = `600 17px ${ sans }`;
				ctx.fillStyle = F.accent;
				ctx.fillText( F.tag, W / 2, y + 88, W - 200 );
				// the menu board, drawn 1.6x wider than the canvas (the board is 7.5 x 0.9 m): three
				// panels, black, a title in the accent, items in white with prices in yellow
				const my = y + NH;
				ctx.save();
				ctx.translate( 0, my );
				ctx.scale( 1 / 1.6, 1 );
				const VW = W * 1.6;
				ctx.fillStyle = '#0b0b0c';
				ctx.fillRect( 0, 0, VW, MH );
				F.menu.forEach( ( [ title, items ], j ) => {

					const x0 = j * VW / 3 + 18, x1 = ( j + 1 ) * VW / 3 - 18;
					ctx.fillStyle = '#1b1b1e';
					ctx.fillRect( x0 - 6, 8, x1 - x0 + 12, MH - 16 );
					ctx.fillStyle = key === 'creamery' ? '#2b5ea8' : ( F.bg === '#151414' ? '#dc2a30' : F.bg );
					ctx.fillRect( x0 - 6, 8, x1 - x0 + 12, 42 );
					ctx.fillStyle = '#ffffff';
					ctx.textAlign = 'center';
					ctx.font = `800 26px ${ sans }`;
					ctx.fillText( title === 'COCA-COLA' ? 'Coca-Cola' : title, ( x0 + x1 ) / 2, 30, x1 - x0 - 10 );
					items.forEach( ( [ item, price ], r ) => {

						const yy = 74 + r * 40;
						ctx.textAlign = 'left';
						ctx.fillStyle = '#f2efe6';
						ctx.font = `700 24px ${ sans }`;
						ctx.fillText( item, x0 + 6, yy, x1 - x0 - 110 );
						if ( price ) {

							ctx.textAlign = 'right';
							ctx.fillStyle = '#f7c325';
							ctx.fillText( price.startsWith( '+' ) || price.startsWith( '.' ) ? price : '$' + price, x1 - 6, yy );

						}

					} );

				} );
				ctx.restore();
				// the kick panel: the stand's colour in vertical panels over a stainless base
				const ky = y + NH + MH;
				ctx.fillStyle = shade( F.bg, 0.85 );
				ctx.fillRect( 0, ky, W, KH );
				ctx.fillStyle = 'rgba( 0, 0, 0, 0.25 )';
				for ( let x = 0; x < W; x += 64 ) ctx.fillRect( x, ky, 2, KH );
				ctx.fillStyle = F.accent;
				ctx.fillRect( 0, ky, W, 3 );
				ctx.fillStyle = '#9da1a5';
				ctx.fillRect( 0, ky + KH - 7, W, 7 );

			} );
			// the half units' signs
			HALVES.forEach( ( k, i ) => {

				const [ word, bg, fg ] = HALF[ k ].sign;
				const x = ( i % 2 ) * W / 2, y = L.y0 + Math.floor( i / 2 ) * HH, w = W / 2;
				ctx.fillStyle = bg;
				ctx.fillRect( x, y, w, HH );
				ctx.strokeStyle = fg;
				ctx.globalAlpha = 0.5;
				ctx.lineWidth = 2;
				ctx.strokeRect( x + 7, y + 7, w - 14, HH - 14 );
				ctx.globalAlpha = 1;
				ctx.fillStyle = fg;
				ctx.textAlign = 'center';
				const icon = pictogram( ctx, k, x + 62, y + HH / 2, fg, bg );
				const tx = icon ? x + w / 2 + 40 : x + w / 2;
				if ( k === 'merch' ) {

					ctx.font = `italic 700 62px Georgia, serif`;
					ctx.fillText( 'Phillies', tx - 30, y + 48 );
					ctx.font = `700 16px ${ sans }`;
					ctx.fillText( 'OFFICIAL TEAM MERCHANDISE  ·  HOME STAND', tx - 30, y + 90, w - 150 );

				} else {

					ctx.font = `800 ${ word.length > 12 ? 34 : 54 }px ${ sans }`;
					ctx.fillText( word, tx, y + HH / 2 + 2, w - ( icon ? 150 : 40 ) );

				}

			} );

		}, 'concessions' );

	}

}
