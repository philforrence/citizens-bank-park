import { Group, Mesh, Vector3, Color } from '../engine/index.js';
import { commonModule } from '../engine/render/wgsl/common.js';
import { standard } from '../materials/Materials.js';
import { Quads, tierSections } from './Stands.js';
import { canvasTexture, box, beam } from './geo.js';
import { offsetPolyline } from './Bowl.js';
import { LEVELS, fencePoint } from './layout.js';
import { GATES } from './Exterior.js';
import { ConcourseSteel } from './ConcourseSteel.js'; // ---- FI1

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

// ---- FI1 (CI-21): 2008 prices (Team Marketing Report's Fan Cost Index, April 2008, the Phillies: a 21 oz
// draft $5.00, a soft drink $3.25, a hot dog $3.50; the rest scaled to them). They were 2010s prices
const DRINKS = [ 'COCA-COLA', [ [ 'SOFT DRINK', '3.25' ], [ 'SOUVENIR CUP', '5.00' ], [ 'BOTTLED WATER', '3.25' ], [ 'HOT CHOCOLATE', '3.00' ] ] ];

// The stands: name, a line under it, its colours (sign, letters, accent), serif or not, the kitchen's kind
// (0 grill, 1 market, 2 pizza ovens, 3 soft serve, 4 taps), the menu board's three panels (2008 prices)
const FOOD = {
	cobblestone: { name: 'COBBLESTONE GRILL', tag: 'CHEESESTEAKS  ·  FRIES  ·  CHICKEN TENDERS', bg: '#1f3d2a', fg: '#efe2bf', accent: '#c9a45a', serif: true, kitchen: 0,
		menu: [ [ 'STEAKS', [ [ 'CHEESESTEAK', '8.00' ], [ 'CHICKEN STEAK', '7.75' ], [ 'PIZZA STEAK', '8.00' ], [ 'WIT OR WITOUT', '' ] ] ],
			[ 'SIDES', [ [ 'FRENCH FRIES', '3.75' ], [ 'CHEESE FRIES', '4.50' ], [ 'CHICKEN TENDERS', '7.25' ], [ 'WITH FRIES', '+1.50' ] ] ], DRINKS ] },
	hatfield: { name: 'HATFIELD GRILL', tag: 'SAUSAGE  ·  HOT DOGS  ·  BURGERS  ·  BRATS', bg: '#ad1119', fg: '#ffffff', accent: '#0b2a5b', serif: true, italic: true, kitchen: 0,
		menu: [ [ 'FROM THE GRILL', [ [ 'HOT DOG', '3.50' ], [ 'FOOT LONG', '4.75' ], [ 'ITALIAN SAUSAGE', '5.25' ], [ 'BRATWURST', '5.25' ] ] ],
			[ 'SANDWICHES', [ [ 'CHEESEBURGER', '6.00' ], [ 'CHICKEN SANDWICH', '6.50' ], [ 'FRENCH FRIES', '3.75' ], [ 'PEPPERS & ONIONS', '.50' ] ] ], DRINKS ] },
	market: { name: 'SOUTH PHILADELPHIA MARKET', tag: 'HOT DOGS  ·  POPCORN  ·  PEANUTS  ·  CRACKER JACK', bg: '#13294f', fg: '#f1e6c8', accent: '#c8102e', kitchen: 1,
		menu: [ [ 'HOT DOGS', [ [ 'HOT DOG', '3.50' ], [ 'JUMBO DOG', '4.50' ], [ 'SOFT PRETZEL', '3.25' ], [ 'NACHOS', '4.25' ] ] ],
			[ 'SNACKS', [ [ 'POPCORN', '4.00' ], [ 'PEANUTS', '4.00' ], [ 'CRACKER JACK', '3.00' ], [ 'CANDY', '2.75' ] ] ], DRINKS ] },
	pizza: { name: 'NEIGHBORHOOD PIZZA', tag: 'SEASONS PIZZA  ·  CLASSIC CAESAR', bg: '#7b2016', fg: '#fff4dc', accent: '#f0b429', serif: true, kitchen: 2,
		menu: [ [ 'SEASONS PIZZA', [ [ 'CHEESE SLICE', '4.50' ], [ 'PEPPERONI SLICE', '5.00' ], [ 'WHITE PIZZA', '5.00' ], [ 'WHOLE PIE', '21.00' ] ] ],
			[ 'SALADS', [ [ 'CAESAR SALAD', '5.75' ], [ 'CHICKEN CAESAR', '7.00' ], [ 'GARLIC KNOTS', '3.00' ], [ 'SOFT PRETZEL', '3.25' ] ] ], DRINKS ] },
	creamery: { name: 'OLD CITY CREAMERY', tag: 'TURKEY HILL SOFT SERVE', bg: '#eee0c0', fg: '#5a3218', accent: '#2b5ea8', serif: true, kitchen: 3,
		menu: [ [ 'SOFT SERVE', [ [ 'CONE', '3.25' ], [ 'WAFFLE CONE', '4.25' ], [ 'HELMET SUNDAE', '4.75' ], [ 'TWIST', '3.25' ] ] ],
			[ 'TOPPINGS', [ [ 'HOT FUDGE', '.75' ], [ 'CARAMEL', '.75' ], [ 'SPRINKLES', '.50' ], [ 'WHIPPED CREAM', '.50' ] ] ],
			[ 'HOT DRINKS', [ [ 'COFFEE', '2.50' ], [ 'HOT CHOCOLATE', '3.00' ], [ 'TEA', '2.25' ], [ 'BOTTLED WATER', '3.25' ] ] ] ] },
	brewerytown: { name: 'BREWERYTOWN', tag: 'LOCAL  ·  DOMESTIC  ·  IMPORT', bg: '#3b2314', fg: '#f2c14e', accent: '#9b6a2f', serif: true, kitchen: 4,
		menu: [ [ 'ON DRAFT', [ [ 'YUENGLING LAGER', '5.00' ], [ 'BUD LIGHT', '5.00' ], [ 'MILLER LITE', '5.00' ], [ 'COORS LIGHT', '5.00' ] ] ],
			[ 'CRAFT & IMPORT', [ [ 'YARDS PHILLY PALE', '6.00' ], [ 'VICTORY HOPDEVIL', '6.00' ], [ 'BLUE MOON', '6.00' ], [ 'HEINEKEN', '6.00' ] ] ],
			[ 'MUST BE 21', [ [ 'BREWERYTOWN SANDWICH', '7.50' ], [ 'SOFT PRETZEL', '3.25' ], [ 'PEANUTS', '4.00' ], [ 'ID REQUIRED', '' ] ] ] ] },
	// (---- FW3 (CI-12): the dark green awning's colours and its line, 'PHILADELPHIA'S BIG LEAGUE SANDWICH'
	// (a fan's photo behind 139, Aug 27 2008); it was black and red)
	schmitter: { name: 'THE SCHMITTER', tag: 'PHILADELPHIA\'S BIG LEAGUE SANDWICH', bg: '#173d2b', fg: '#f3ecd8', accent: '#f3ecd8', serif: true, kitchen: 0,
		menu: [ [ 'THE SCHMITTER', [ [ 'THE SCHMITTER', '8.00' ], [ 'BEEF · SALAMI · CHEESE', '' ], [ 'FRIED ONIONS · TOMATO', '' ], [ 'SPECIAL SAUCE · KAISER', '' ] ] ],
			[ 'ALSO', [ [ 'CHEESESTEAK', '8.00' ], [ 'FRENCH FRIES', '3.75' ], [ 'CHEESE FRIES', '4.50' ], [ 'HOT DOG', '3.50' ] ] ], DRINKS ] },
	// ---- FW3 (C2W-7): the Terrace Level's own (the October 2008 guide): Fairmount Fries (behind 208 and 319:
	// "Boardwalk Fries"), the High & Inside Pub behind home plate ("a full service bar and Bull's BBQ"), the
	// Phanatic Kid's Corner (318: "portions just the right size")
	fries: { name: 'FAIRMOUNT FRIES', tag: 'BOARDWALK FRIES  ·  CHEESE FRIES', bg: '#f2c14e', fg: '#7b1d12', accent: '#7b1d12', serif: true, kitchen: 0,
		menu: [ [ 'BOARDWALK FRIES', [ [ 'REGULAR', '3.75' ], [ 'BUCKET', '6.50' ], [ 'CHEESE FRIES', '4.50' ], [ 'MALT VINEGAR', '' ] ] ],
			[ 'ALSO', [ [ 'CHICKEN TENDERS', '7.25' ], [ 'SOFT PRETZEL', '3.25' ], [ 'NACHOS', '4.25' ], [ 'HOT DOG', '3.50' ] ] ], DRINKS ] },
	pub: { name: 'HIGH & INSIDE PUB', tag: 'FULL SERVICE BAR  ·  BULL\'S BBQ', bg: '#14271c', fg: '#e9dcb5', accent: '#b3121b', serif: true, kitchen: 4,
		menu: [ [ 'ON DRAFT', [ [ 'YUENGLING LAGER', '5.00' ], [ 'YARDS PHILLY PALE', '6.00' ], [ 'BUD LIGHT', '5.00' ], [ 'GUINNESS', '6.50' ] ] ],
			[ 'BULL\'S BBQ', [ [ 'PULLED PORK', '8.50' ], [ 'BEEF BRISKET', '9.00' ], [ 'TURKEY LEG', '8.50' ], [ 'BAKED BEANS', '3.00' ] ] ],
			[ 'BAR', [ [ 'MIXED DRINK', '7.50' ], [ 'WINE', '7.00' ], [ 'HOT TODDY', '7.50' ], [ 'IRISH COFFEE', '7.50' ] ] ] ] },
	kids: { name: 'PHANATIC KID\'S CORNER', tag: 'KIDS\' MEALS  ·  JUST THE RIGHT SIZE', bg: '#1c8a3c', fg: '#ffffff', accent: '#c8102e', kitchen: 1,
		menu: [ [ 'KIDS\' MEALS', [ [ 'HOT DOG & JUICE', '4.50' ], [ 'PB&J & JUICE', '4.00' ], [ 'CHICKEN FINGERS', '5.00' ], [ 'WITH A PRIZE', '' ] ] ],
			[ 'SNACKS', [ [ 'COTTON CANDY', '3.50' ], [ 'POPCORN', '4.00' ], [ 'APPLE SLICES', '2.50' ], [ 'CRACKER JACK', '3.00' ] ] ], DRINKS ] },
	// ---- end FW3
};
const BRANDS = Object.keys( FOOD );
// ---- FI1 (CI-7): the stands hung out over the walkway on arms (docindigo76, NLCS 2009: Hatfield's oval and
// Brewerytown's arch, read from along the concourse)
FOOD.hatfield.blade = true;
FOOD.brewerytown.blade = true;
// the die-cut signs over the menu boards: their atlas band (px) and their height (m), 7.4 mm a pixel
const NAME_PX = 184, SIGN_H = NAME_PX * 7.62 / 1024;
// the restroom plaques' cells, after the blades'
const PLAQUES = [ 'men', 'women', 'family' ];
// the stands' walls: red ground-face block (0.4 x 0.2 m, its aggregate showing) over a dark base course,
// bonded along whichever wall it is (world position: y is the height above the concourse); the roofs a
// dark membrane, what faces down painted. (---- FW3: lift, the height of the floor they stand on over the
// main concourse's, world y: the Terrace's stands and the upper concourses' have their own materials)
// ---- FX3 (AD1-5): a stand's back is flagged by its uv.x (over BACK_UV: uv.x - BACK_UV the metres along it
// from its wall pack, uv.y the height), and the wall pack lights it
const BACK_UV = 1000;
// ---- end FX3
const blockWGSL = ( lift = 0 ) => /* wgsl */`
	if ( in.N.y > 0.5 ) {
		s.albedo = vec3f( 0.06, 0.06, 0.065 );
		s.roughness = 0.85;
	} else if ( in.N.y < - 0.5 ) {
		s.albedo = vec3f( 0.3, 0.29, 0.27 );
		s.roughness = 0.8;
	} else {
		let nh = normalize( in.N.xz + vec2f( 1e-4, 0.0 ) );
		let u = in.P.x * ( - nh.y ) + in.P.z * nh.x;
		let v = in.P.y - ${ lift.toFixed( 3 ) };
		let row = floor( v / 0.2 );
		let bu = u / 0.4 + 0.5 * ( row % 2.0 );
		let fr = clamp( fwidth( v ) / 0.2 * 1.5 - 0.25, 0.0, 1.0 );
		let fb = clamp( fwidth( bu ) * 1.5 - 0.25, 0.0, 1.0 );
		let mortar = clamp( mix( step( 0.94, fract( v / 0.2 ) ), 0.06, fr ) + mix( step( 0.97, fract( bu ) ), 0.03, max( fb, fr ) ), 0.0, 1.0 );
		let id = fract( sin( dot( vec2f( floor( bu ), row ), vec2f( 12.9898, 78.233 ) ) ) * 43758.5453 );
		// the ground face: speckled with aggregate
		let grit = mx_noise_float2( vec2f( u, v ) * 60.0 );
		var c = select( vec3f( 0.25, 0.075, 0.05 ), vec3f( 0.07, 0.065, 0.065 ), v < 0.6 );
		c = c * ( 0.86 + 0.22 * id ) * ( 0.85 + 0.3 * smoothstep( 0.2, 0.8, grit ) * ( 1.0 - max( fr, fb ) ) );
		s.albedo = mix( c, vec3f( 0.38, 0.36, 0.33 ), mortar * 0.7 );
		s.roughness = 0.75;
		// ---- FX3 (AD1-5): a stand's back: its wall pack's pool on the block (it throws down and out, a
		// little up), and the faint bounce off the floor everywhere on it
		if ( in.uv.x > ${ ( BACK_UV / 2 ).toFixed( 1 ) } ) {
			let du = in.uv.x - ${ BACK_UV.toFixed( 1 ) };
			let dv = in.uv.y - 2.86;
			let r2 = du * du + dv * dv * select( 1.0, 4.0, dv > 0.0 );
			let pool = 1.4 / ( 1.0 + r2 / 0.9 ) * ( 1.0 - smoothstep( 0.1, 0.5, dv ) * 0.85 );
			let nl = smoothstep( 0.1, 0.7, frame.night );
			s.emissive = s.albedo * vec3f( 1.0, 0.88, 0.7 ) * ( pool * mix( 0.35, 1.0, nl ) + 0.1 );
		}
		// ---- end FX3
	}
`;
// ---- FW3: the stands' block and bays for a floor `lift` m over the main concourse's (world y)
const _standMats = new Map();
function standMaterials( lift ) {

	const key = lift.toFixed( 2 );
	if ( ! _standMats.has( key ) ) {

		const tag = lift ? '-' + key : '';
		const precast = standard( { name: 'concession-body' + tag, color: new Color( 0.25, 0.07, 0.045 ), roughness: 0.8, side: 'double', modules: [ commonModule ], surface: blockWGSL( lift ) } );
		const bayMat = standard( { name: 'concession-bays' + tag, color: new Color( 0.7, 0.69, 0.66 ), roughness: 0.4, side: 'double', surface: tileWGSL( lift ) } );
		for ( const m of [ precast, bayMat ] ) m.underwaterLighting = 'none';
		_standMats.set( key, { precast, bayMat } );

	}

	return _standMats.get( key );

}
// ---- end FW3
// the stands' bays behind the counters: white glazed tile, 15 cm, stainless below the counter
const tileWGSL = ( lift = 0 ) => /* wgsl */`
	let tg = abs( fract( vec2f( in.P.x + in.P.z, in.P.y ) / 0.15 ) - 0.5 );
	let fw = fwidth( in.P.y ) / 0.15;
	let grout = step( 0.45, max( tg.x, tg.y ) ) * ( 1.0 - clamp( fw * 3.0, 0.0, 1.0 ) );
	s.albedo = vec3f( 0.72, 0.71, 0.68 ) * ( 1.0 - 0.25 * grout );
	s.roughness = 0.25;
	if ( in.P.y - ${ lift.toFixed( 3 ) } < 1.0 ) { s.albedo = vec3f( 0.5, 0.51, 0.52 ); s.metalness = 0.8; s.roughness = 0.35; }
	s.emissive = s.albedo * 0.12 * smoothstep( 0.1, 0.7, frame.night );
`;
// ---- end FI1

// The half units, two to a unit: a door (a restroom), a window (a service counter) or a shop front; its
// sign (words, colours); the room behind (5 restroom, 6 office, 7 team store, 8 first aid, 9 newsstand)
const HALF = {
	men: { type: 'door', room: 5, sign: [ 'MEN', '#14305c', '#ffffff' ] },
	women: { type: 'door', room: 5, sign: [ 'WOMEN', '#14305c', '#ffffff' ] },
	family: { type: 'door', room: 5, sign: [ 'FAMILY RESTROOM', '#14305c', '#ffffff' ] },
	firstaid: { type: 'window', room: 8, sign: [ 'FIRST AID', '#f4f2ec', '#c8102e' ] },
	guest: { type: 'window', room: 6, sign: [ 'GUEST SERVICES', '#b3121b', '#ffffff' ] },
	tickets: { type: 'window', room: 6, sign: [ 'TICKETS · WILL CALL', '#13294f', '#ffffff' ] }, // ---- FW2 (C2W-21): WILL CALL
	merch: { type: 'shop', room: 7, sign: [ 'PHILLIES', '#b3121b', '#ffffff' ] },
	news: { type: 'shop', room: 9, sign: [ 'NEWSSTAND', '#0b2a5b', '#ffffff' ] },
	phanatic: { type: 'shop', room: 7, sign: [ 'MAKE YOUR OWN PHANATIC', '#1c8a3c', '#ffffff' ] },
	// ---- FI1 (CI-23): McFadden's inside door behind 127 (the 2008 guide: 'Guests enter from outside (Third
	// Base Gate) or inside the park (behind Section 127)'), its bar seen through it; the Majestic Clubhouse
	// Store's inside entrance behind 134 beside the Home Stand
	mcfaddens: { type: 'shop', room: 4, sign: [ 'McFADDEN\'S', '#173b26', '#f2c14e' ] },
	clubhouse: { type: 'shop', room: 7, sign: [ 'MAJESTIC CLUBHOUSE STORE', '#0b2a5b', '#ffffff' ] },
	// ---- FI1 (CI-9): the sign over the elevators' doors (no unit of its own): cream, red letters
	elevators: { type: 'sign', sign: [ 'ELEVATORS', '#efe4c4', '#9e1b2a' ] },
};
const HALVES = Object.keys( HALF );

// what the guides put behind which section, in the order they claim the nearest free unit (a pair: two
// halves); the units left over get restrooms and markets
const PLAN = [
	[ 'cobblestone', 108 ], [ 'cobblestone', 125 ], [ 'hatfield', 120 ], [ 'hatfield', 135 ], [ 'schmitter', 139 ],
	[ [ 'guest', 'tickets' ], 122 ], [ [ 'firstaid', 'family' ], 105 ], [ 'brewerytown', 113 ], [ 'brewerytown', 139 ],
	[ [ 'women', 'men' ], 117 ], [ [ 'men', 'women' ], 128 ], [ 'pizza', 109 ], [ 'pizza', 136 ], [ 'creamery', 110 ], [ 'creamery', 126 ],
	[ [ 'merch', 'news' ], 121 ], [ [ 'merch', 'clubhouse' ], 134 ], [ 'market', 116 ], [ 'market', 130 ], [ [ 'mcfaddens', 'mcfaddens' ], 127 ], [ 'market', 106 ], // ---- FI1 (CI-23)
	[ [ 'women', 'family' ], 137 ], [ [ 'family', 'men' ], 112 ], [ 'creamery', 136 ], [ 'market', 138 ],
	// right field, behind 101-104 under the Pavilion
	[ 'hatfield', 101 ], [ [ 'men', 'women' ], 102 ], [ 'market', 103 ], [ [ 'women', 'men' ], 104 ],
	// ---- FI1 (CI-23): Make Your Own Phanatic, moved along for the Clubhouse Store's door
	[ [ 'phanatic', 'news' ], 136 ],
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
function frame( o, a, n, y0 = STREET ) {

	return ( x, y, z ) => [ o[ 0 ] + a[ 0 ] * x + n[ 0 ] * z, y0 + y, o[ 1 ] + a[ 1 ] * x + n[ 1 ] * z ];

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

// ---- FW3 (C2W-7): the Terrace's sections: 319-322 behind home plate (the 2009 seating chart), 312 at The
// Break in right, 333 at the left field pole; from the angle round home plate (field frame)
export function terraceSection( x, z ) {

	const a = Math.atan2( x, z ) * 180 / Math.PI;
	return 320.5 - a * 0.112;

}

// what the October 2008 guides put behind which Terrace section, in the order they claim the nearest free
// bay along its back (as PLAN): Brewerytown (323, 329), Fairmount Fries (319), the High & Inside Pub
// (behind home plate), Old City Creamery (322, 330), the Phanatic Kid's Corner (318), the South Philadelphia
// Market (318, 321, 323, 329, 330), Guest Services (318), the NewsStand (323), the family restrooms (319,
// 322, 329); the men's and women's where the guide doesn't say. The bays left over stay open to the back
// rail (the view out: the lots, the Linc and the arenas from first base's side)
const TERRACE_PLAN = [
	[ 'pub', 320.5 ], [ [ 'women', 'family' ], 319 ], [ [ 'family', 'men' ], 322 ], [ [ 'women', 'family' ], 329 ], [ 'brewerytown', 323 ], [ 'brewerytown', 329 ],
	[ 'fries', 319 ], [ 'creamery', 322 ], [ 'creamery', 330 ], [ 'kids', 318 ], [ [ 'guest', 'news' ], 318 ], [ 'market', 321 ], [ 'market', 329 ],
	[ [ 'men', 'women' ], 314 ], [ [ 'women', 'men' ], 332 ],
];
// ---- end FW3

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

// ---- FI1 (CI-7, CI-11, CI-13): the signs as they were, drawn on transparent ground (what's left clear
// isn't drawn: the brick shows round them)
const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif', SERIF = 'Georgia, "Times New Roman", serif', SCRIPT = '"Brush Script MT", "Snell Roundhand", Georgia, serif';

// a region painted rather than lit (its alpha under 1: the signs' shader doesn't light it)
function unlit( ctx, x, y, w, h ) {

	const id = ctx.getImageData( x, y, w, h );
	for ( let i = 3; i < id.data.length; i += 4 ) if ( id.data[ i ] > 128 ) id.data[ i ] = 225;
	ctx.putImageData( id, x, y );

}

// text fitted to a width
function fit( ctx, text, x, y, maxW, font ) {

	ctx.font = font;
	ctx.fillText( text, x, y, maxW );

}

// A stand's die-cut sign fitted in w x h round ( cx, cy ) (a blade: the shape for a square-ish board):
// Hatfield's cream oval with its red script, Brewerytown's arch with the sunburst and the beer, the
// Creamery's cream board and cone, Neighborhood Pizza's red board and slice, the Market's long painted
// header, Cobblestone's arched green board, the Schmitter's black one
function dieCut( ctx, key, cx, cy, w, h, blade = false ) {

	const F = FOOD[ key ];
	ctx.save();
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	// (---- FW3: the Terrace's three, painted boards)
	const sw = blade ? w : { hatfield: 560, brewerytown: 520, creamery: 600, pizza: 640, market: w, cobblestone: 760, schmitter: 640, fries: 700, pub: 780, kids: w }[ key ];
	const sh = blade ? h : { hatfield: h, brewerytown: h, creamery: h * 0.78, pizza: h * 0.76, market: h * 0.62, cobblestone: h * 0.86, schmitter: h * 0.7, fries: h * 0.72, pub: h * 0.8, kids: h * 0.62 }[ key ];
	const x0 = cx - sw / 2, y0 = cy - sh / 2;
	const round = ( x, y, ww, hh, r ) => {

		ctx.beginPath();
		ctx.moveTo( x + r, y ); ctx.arcTo( x + ww, y, x + ww, y + hh, r ); ctx.arcTo( x + ww, y + hh, x, y + hh, r ); ctx.arcTo( x, y + hh, x, y, r ); ctx.arcTo( x, y, x + ww, y, r );
		ctx.closePath();

	};

	const arch = ( x, y, ww, hh ) => {

		ctx.beginPath();
		ctx.moveTo( x, y + hh );
		ctx.lineTo( x, y + hh * 0.45 );
		ctx.ellipse( x + ww / 2, y + hh * 0.45, ww / 2, hh * 0.45, 0, Math.PI, 0 );
		ctx.lineTo( x + ww, y + hh );
		ctx.closePath();

	};

	if ( key === 'hatfield' ) {

		ctx.beginPath(); ctx.ellipse( cx, cy, sw / 2, sh / 2, 0, 0, Math.PI * 2 );
		ctx.fillStyle = '#9e1b22'; ctx.fill();
		ctx.beginPath(); ctx.ellipse( cx, cy, sw / 2 - 7, sh / 2 - 7, 0, 0, Math.PI * 2 );
		ctx.fillStyle = '#f4e8c8'; ctx.fill();
		ctx.lineWidth = 2; ctx.strokeStyle = '#0b2a5b'; ctx.stroke();
		ctx.fillStyle = '#b3121b';
		fit( ctx, 'Hatfield', cx, cy - sh * 0.1, sw * 0.8, `italic 700 ${ Math.round( sh * 0.44 ) }px ${ SCRIPT }` );
		ctx.fillStyle = '#0b2a5b';
		fit( ctx, 'G R I L L', cx, cy + sh * 0.27, sw * 0.4, `800 ${ Math.round( sh * 0.17 ) }px ${ SANS }` );
		ctx.fillRect( cx - sw * 0.33, cy + sh * 0.27, sw * 0.1, 3 ); ctx.fillRect( cx + sw * 0.23, cy + sh * 0.27, sw * 0.1, 3 );

	} else if ( key === 'brewerytown' ) {

		arch( x0, y0, sw, sh );
		ctx.fillStyle = '#3b2314'; ctx.fill();
		ctx.save();
		arch( x0 + 6, y0 + 6, sw - 12, sh - 12 );
		ctx.clip();
		// the sunburst from the foot
		for ( let k = 0; k < 18; k ++ ) {

			const a0 = Math.PI + k * Math.PI / 18, a1 = a0 + Math.PI / 18;
			ctx.beginPath(); ctx.moveTo( cx, y0 + sh ); ctx.arc( cx, y0 + sh, sw, a0, a1 ); ctx.closePath();
			ctx.fillStyle = k % 2 ? '#f2b733' : '#e8892b'; ctx.fill();

		}

		ctx.restore();
		// the banner across it
		ctx.fillStyle = '#9e1b22';
		ctx.fillRect( x0 + 2, cy - sh * 0.16, sw - 4, sh * 0.3 );
		ctx.fillStyle = '#f6e7c1';
		fit( ctx, 'BREWERYTOWN', cx, cy - sh * 0.01, sw * 0.86, `900 ${ Math.round( sh * 0.24 ) }px ${ SERIF }` );
		// the beer: a pint, its head
		ctx.fillStyle = '#c98a1c'; ctx.fillRect( cx - sh * 0.08, y0 + sh * 0.7, sh * 0.16, sh * 0.25 );
		ctx.fillStyle = '#fbf3df'; ctx.fillRect( cx - sh * 0.09, y0 + sh * 0.66, sh * 0.18, sh * 0.06 );

	} else if ( key === 'creamery' ) {

		round( x0, y0, sw, sh, sh * 0.3 );
		ctx.fillStyle = '#5a3218'; ctx.fill();
		round( x0 + 6, y0 + 6, sw - 12, sh - 12, sh * 0.26 );
		ctx.fillStyle = '#efe2c2'; ctx.fill();
		ctx.fillStyle = '#5a3218';
		fit( ctx, 'Old City', cx, cy - sh * 0.17, sw * 0.6, `italic 700 ${ Math.round( sh * 0.36 ) }px ${ SERIF }` );
		fit( ctx, 'C R E A M E R Y', cx, cy + sh * 0.25, sw * 0.6, `800 ${ Math.round( sh * 0.2 ) }px ${ SANS }` );
		// a cone each side
		for ( const s of [ - 1, 1 ] ) {

			const x = cx + s * sw * 0.38;
			ctx.fillStyle = '#c9954f';
			ctx.beginPath(); ctx.moveTo( x - sh * 0.12, cy - sh * 0.02 ); ctx.lineTo( x + sh * 0.12, cy - sh * 0.02 ); ctx.lineTo( x, cy + sh * 0.36 ); ctx.fill();
			ctx.fillStyle = '#f1d9e4'; ctx.beginPath(); ctx.arc( x, cy - sh * 0.1, sh * 0.13, 0, Math.PI * 2 ); ctx.fill();

		}

	} else if ( key === 'pizza' ) {

		round( x0, y0, sw, sh, 10 );
		ctx.fillStyle = '#f0b429'; ctx.fill();
		round( x0 + 5, y0 + 5, sw - 10, sh - 10, 8 );
		ctx.fillStyle = '#7b2016'; ctx.fill();
		// the slice
		const px = x0 + sh * 0.55;
		ctx.fillStyle = '#e9b44c'; ctx.beginPath(); ctx.moveTo( px - sh * 0.3, cy - sh * 0.3 ); ctx.lineTo( px + sh * 0.3, cy - sh * 0.3 ); ctx.lineTo( px, cy + sh * 0.35 ); ctx.fill();
		ctx.fillStyle = '#b5311b';
		for ( const [ dx, dy ] of [ [ - 0.1, - 0.15 ], [ 0.1, - 0.12 ], [ 0, 0.05 ] ] ) {

			ctx.beginPath(); ctx.arc( px + dx * sh, cy + dy * sh, sh * 0.05, 0, Math.PI * 2 ); ctx.fill();

		}

		ctx.fillStyle = '#fff4dc';
		fit( ctx, 'NEIGHBORHOOD', cx + sh * 0.3, cy - sh * 0.2, sw * 0.6, `700 ${ Math.round( sh * 0.2 ) }px ${ SERIF }` );
		ctx.fillStyle = '#f0b429';
		fit( ctx, 'PIZZA', cx + sh * 0.3, cy + sh * 0.17, sw * 0.6, `900 ${ Math.round( sh * 0.4 ) }px ${ SERIF }` );

	} else if ( key === 'cobblestone' ) {

		arch( x0, y0, sw, sh );
		ctx.fillStyle = '#c9a45a'; ctx.fill();
		arch( x0 + 5, y0 + 5, sw - 10, sh - 10 );
		ctx.fillStyle = '#1f3d2a'; ctx.fill();
		ctx.fillStyle = '#efe2bf';
		fit( ctx, 'COBBLESTONE GRILL', cx, cy + sh * 0.08, sw * 0.82, `700 ${ Math.round( sh * 0.3 ) }px ${ SERIF }` );
		ctx.fillStyle = '#c9a45a';
		fit( ctx, 'of Elfreth\'s Alley', cx, cy + sh * 0.34, sw * 0.5, `italic 600 ${ Math.round( sh * 0.15 ) }px ${ SERIF }` );

	} else {

		// a long painted board: the Market, the Schmitter
		round( x0, y0, sw, sh, 6 );
		ctx.fillStyle = F.accent; ctx.fill();
		round( x0 + 5, y0 + 5, sw - 10, sh - 10, 4 );
		ctx.fillStyle = F.bg; ctx.fill();
		ctx.fillStyle = F.fg;
		fit( ctx, F.name, cx, cy - ( key === 'schmitter' ? sh * 0.1 : 0 ), sw - 60, `${ F.italic ? 'italic ' : '' }700 ${ Math.round( sh * 0.5 ) }px ${ SERIF }` );
		if ( key === 'schmitter' ) {

			ctx.fillStyle = F.accent;
			fit( ctx, 'McNALLY\'S TAVERN', cx, cy + sh * 0.3, sw * 0.5, `600 ${ Math.round( sh * 0.15 ) }px ${ SANS }` );

		}

	}

	ctx.restore();

}

// The restroom's plaque: home plate, point down, cream inside a red line and a navy edge, the figures in
// navy with red caps, the word in navy capitals, the braille under it (pompomflipflop, 5 June 2008)
function plaque( ctx, k, cx, cy, w, h ) {

	const plate = ( m ) => {

		const x0 = cx - w / 2 + m, x1 = cx + w / 2 - m, y0 = cy - h / 2 + m, y1 = cy + h / 2 - m * 1.4;
		ctx.beginPath();
		ctx.moveTo( x0, y0 ); ctx.lineTo( x1, y0 ); ctx.lineTo( x1, y0 + ( y1 - y0 ) * 0.52 ); ctx.lineTo( cx, y1 ); ctx.lineTo( x0, y0 + ( y1 - y0 ) * 0.52 );
		ctx.closePath();

	};

	ctx.save();
	plate( 0 ); ctx.fillStyle = '#1d2f82'; ctx.fill();
	plate( 5 ); ctx.fillStyle = '#c8102e'; ctx.fill();
	plate( 8 ); ctx.fillStyle = '#efe6b8'; ctx.fill();
	// the figures, navy, red caps
	const navy = '#22359a', red = '#c8102e';
	const figure = ( x, y, s, dress ) => {

		ctx.fillStyle = navy;
		ctx.beginPath(); ctx.arc( x, y, 7 * s, 0, Math.PI * 2 ); ctx.fill();
		ctx.fillStyle = red; ctx.fillRect( x - 8 * s, y - 8 * s, 16 * s, 4 * s );
		ctx.fillStyle = navy;
		if ( dress ) {

			ctx.beginPath(); ctx.moveTo( x - 6 * s, y + 9 * s ); ctx.lineTo( x + 6 * s, y + 9 * s ); ctx.lineTo( x + 13 * s, y + 32 * s ); ctx.lineTo( x - 13 * s, y + 32 * s ); ctx.fill();

		} else ctx.fillRect( x - 9 * s, y + 9 * s, 18 * s, 23 * s );

		ctx.fillRect( x - 6 * s, y + 31 * s, 5 * s, 17 * s ); ctx.fillRect( x + 1 * s, y + 31 * s, 5 * s, 17 * s );

	};

	const fy = cy - h * 0.3;
	if ( k === 'men' ) figure( cx, fy, 1.1, false );
	else if ( k === 'women' ) figure( cx, fy, 1.1, true );
	else {

		figure( cx - 22, fy, 0.95, false ); figure( cx + 22, fy, 0.95, true ); figure( cx, fy + 12, 0.55, false );

	}

	ctx.fillStyle = navy;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	const words = k === 'family' ? [ 'FAMILY', 'RESTROOM' ] : [ k === 'men' ? 'MEN' : 'WOMEN' ];
	words.forEach( ( t, i ) => fit( ctx, t, cx, cy + h * ( 0.1 + i * 0.12 ) - ( words.length - 1 ) * 4, w * 0.7, `700 ${ words.length > 1 ? 15 : 20 }px ${ SANS }` ) );
	ctx.fillStyle = '#b9b08a';
	for ( let i = 0; i < 9; i ++ ) ctx.fillRect( cx - 20 + i * 5, cy + h * 0.31, 2, 2 );
	ctx.restore();
	unlit( ctx, Math.round( cx - w / 2 ), Math.round( cy - h / 2 ), Math.round( w ), Math.round( h ) );

}

// The Home Stand's plaque: dark bronze, its letters raised in gold, painted on the brick
function bronze( ctx, cx, cy, w, h ) {

	ctx.save();
	const g = ctx.createLinearGradient( 0, cy - h / 2, 0, cy + h / 2 );
	g.addColorStop( 0, '#4a3824' ); g.addColorStop( 1, '#2a1f14' );
	ctx.fillStyle = g;
	ctx.fillRect( cx - w / 2, cy - h / 2, w, h );
	ctx.strokeStyle = '#a8864e'; ctx.lineWidth = 3;
	ctx.strokeRect( cx - w / 2 + 4, cy - h / 2 + 4, w - 8, h - 8 );
	ctx.fillStyle = '#d4b06a';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	fit( ctx, 'HOME STAND', cx, cy - h * 0.14, w * 0.7, `700 ${ Math.round( h * 0.48 ) }px ${ SERIF }` );
	fit( ctx, '★★  OFFICIAL PHILLIES MERCHANDISE  ★★', cx, cy + h * 0.3, w * 0.8, `600 ${ Math.round( h * 0.2 ) }px ${ SANS }` );
	ctx.restore();
	unlit( ctx, Math.round( cx - w / 2 ), Math.round( cy - h / 2 ), Math.round( w ), Math.round( h ) );

}
// ---- end FI1

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
	// ---- FW5 (C3W-11, gauntlet r3): an office (the ticket windows, guest services) runs on past its window
	// either side, as a room behind a hole in its wall does: walking past at 60-70 degrees the ray met the
	// window's own sides at once and the window went blank cream; now it goes in past the counter and the
	// clerks to the office's far side
	let ext = select( 0.0, 2.6, room == 6 );
	if ( rd.x < 0.0 ) { let tl = ( - ext - xl ) / rd.x; if ( tl < t ) { t = tl; hitK = 3; } }
	if ( rd.x > 0.0 ) { let tr = ( w + ext - xl ) / rd.x; if ( tr < t ) { t = tr; hitK = 4; } }
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
	} else if ( hitK >= 3 && room != 7 ) { // ---- FI3 (C2I-3): not a team store's: its sides are jersey walls too (they were white)
		// the sides: tile, or painted in the rooms
		col = select( vec3f( 0.6, 0.58, 0.54 ) * ( 1.0 - 0.18 * step( 0.44, max( abs( fract( hz / 0.15 ) - 0.5 ), tileG.y ) ) ), vec3f( 0.55, 0.53, 0.5 ), room >= 6 );
		if ( hy < 0.9 && room < 5 ) { col = vec3f( 0.33, 0.34, 0.35 ); }
		// (---- FW5: the office's far side: a filing cabinet's grey, a door, a calendar)
		if ( room == 6 ) { col = vec3f( 0.36, 0.37, 0.39 ); if ( hy < 1.3 && fract( hz / 0.9 ) > 0.1 ) { col = vec3f( 0.24, 0.25, 0.27 ) * ( 0.85 + 0.15 * step( 0.5, fract( hy / 0.33 ) ) ); } }
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
					// ---- FI1 (CI-20): what's on them, mixed (peanut bags, Cracker Jack, candy, chips): it was red and
					// white stripes over blue, an American flag from across the concourse
					var pal = array<vec3f, 6>( vec3f( 0.55, 0.38, 0.18 ), vec3f( 0.7, 0.05, 0.05 ), vec3f( 0.1, 0.2, 0.55 ), vec3f( 0.8, 0.62, 0.1 ), vec3f( 0.75, 0.3, 0.05 ), vec3f( 0.82, 0.8, 0.74 ) );
					col = pal[ u32( rnd * 5.99 ) ] * ( 0.75 + 0.25 * hsh.y );
					if ( fract( hy / 0.11 + rnd ) > 0.85 ) { col *= 0.6; }
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
			// an office: a notice board, a Phillies poster, two monitors on the counter (FW2: its wall a shade
			// darker, so the booth reads as a room and not a lit panel)
			col = vec3f( 0.4, 0.42, 0.44 );
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
			let ax = select( hx, hz + 3.1, hitK >= 3 ); // ---- FI3: along the side walls too
			let jx = fract( ax / 0.55 );
			let row = floor( hy / 0.75 );
			let jy = fract( hy / 0.75 );
			let jid = fract( sin( floor( ax / 0.55 ) * 17.1 + row * 3.7 ) * 4375.5 );
			let tee = ( jx > 0.18 && jx < 0.82 && jy > 0.1 && jy < 0.8 ) || ( jx > 0.06 && jx < 0.94 && jy > 0.62 && jy < 0.8 );
			if ( hy > 0.5 && hy < 2.0 && tee ) {
				col = vec3f( 0.82, 0.8, 0.75 );
				if ( fract( jx * 9.0 ) < 0.12 ) { col = vec3f( 0.5, 0.05, 0.06 ); }
				if ( jid > 0.45 ) { col = vec3f( 0.45, 0.02, 0.03 ); }
				if ( jid > 0.7 ) { col = vec3f( 0.45 ); }
				if ( jid > 0.85 ) { col = vec3f( 0.35, 0.5, 0.72 ); }
				if ( abs( jx - 0.5 ) < 0.1 && abs( jy - 0.45 ) < 0.12 ) { col = select( vec3f( 0.8 ), vec3f( 0.5, 0.03, 0.05 ), jid < 0.45 || jid > 0.7 ); }
			}
			if ( hy > 2.05 && hy < 2.28 ) { let cx2 = fract( ax / 0.26 ) - 0.5; if ( length( vec2f( cx2, ( hy - 2.12 ) / 0.26 ) ) < 0.34 ) { col = select( vec3f( 0.5, 0.02, 0.03 ), vec3f( 0.02, 0.05, 0.2 ), rnd > 0.75 ); if ( length( vec2f( cx2, ( hy - 2.14 ) / 0.26 ) ) < 0.1 ) { col = vec3f( 0.85 ); } } }
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
	// ---- FW2 (C2W-21): the ticket and guest-services windows were blank lit panels: a counter just inside
	// the glass, a clerk behind it at most (a red Phillies jacket or a navy blazer), the speaking grille,
	// and the glass's own dimming and sheen over it all
	if ( room == 6 ) {
		let tcl = 0.8 / rd.z;
		if ( tcl < t ) {
			let pc = vec3f( xl, y, 0.0 ) + rd * tcl;
			let cid = floor( pc.x / 1.1 );
			let hh = fract( sin( cid * 12.9898 + code * 3.1 ) * 43758.5453 );
			let cx = pc.x - ( cid + 0.5 ) * 1.1 - ( hh - 0.5 ) * 0.2;
			let ht = 1.66 + 0.14 * hh;
			let head = length( vec2f( cx, pc.y - ht * 0.93 ) * vec2f( 1.0, 0.85 ) ) < 0.11;
			let body = abs( cx ) < 0.23 - 0.06 * smoothstep( ht * 0.78, ht * 0.86, pc.y ) && pc.y < ht * 0.86 && pc.y > 0.5;
			if ( hh > 0.2 && ( head || body ) ) {
				col = select( select( vec3f( 0.42, 0.03, 0.04 ), vec3f( 0.04, 0.06, 0.16 ), hh > 0.6 ), vec3f( 0.55, 0.38, 0.27 ) * ( 0.7 + 0.5 * hh ), head );
				if ( head && pc.y > ht * 0.985 ) { col = vec3f( 0.06, 0.04, 0.03 ); }
				e = vec3f( 0.0 );
				light = 0.5;
			}
		}
		let tct = 0.22 / rd.z;
		if ( tct < t ) {
			let pq = vec3f( xl, y, 0.0 ) + rd * tct;
			if ( pq.y < 1.08 ) { col = select( vec3f( 0.18, 0.18, 0.2 ), vec3f( 0.6, 0.6, 0.62 ), pq.y > 1.03 ); e = vec3f( 0.0 ); }
		}
		if ( length( vec2f( fract( xl / 1.1 ) * 1.1 - 0.55, y - 1.55 ) ) < 0.06 ) { col = vec3f( 0.22 ); e = vec3f( 0.0 ); }
		let fres = pow( 1.0 - max( dot( - Vd, Nw ), 0.0 ), 4.0 );
		// (---- FW5: the glass takes over toward grazing: the concourse's lights and dark in it)
		col = mix( col * 0.8, vec3f( 0.16, 0.17, 0.19 ) * ( 0.7 + 0.6 * step( 0.5, fract( ( in.P.x + in.P.z ) * 0.35 + y * 0.2 ) ) ), fres * 0.7 );
	}
	// ---- end FW2
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
		// ---- FI1 (CI-1, CI-8): the steel overhead, the columns, the domes (ConcourseSteel.js)
		this.steel = new ConcourseSteel( { group: this.group, bowl, field, colliders } );
		this._elevatorCores( bowl );
		// ---- end FI1

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
		const q = new Quads(), shelf = new Quads(), apron = new Quads(); // ---- FI1 (CI-19): the apron
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
			// ---- FI1 (CI-19): under the shelf's edge a red-painted steel apron the length of the rail, both
			// sides (dottcom, NLCS 2008: the strongest line of colour along the concourse's edge)
			const [ c0x, c0z ] = at( s0 - 0.1, 0.25 ), [ c1x, c1z ] = at( s1 + 0.1, 0.25 ), [ e0x, e0z ] = at( s0 - 0.1, - 0.05 ), [ e1x, e1z ] = at( s1 + 0.1, - 0.05 );
			apron.add( [ c0x, yt - 0.3, c0z ], [ c1x, yt - 0.3, c1z ], [ c1x, yt - 0.04, c1z ], [ c0x, yt - 0.04, c0z ], [ S.nx, 0, S.nz ] );
			apron.add( [ e1x, yt - 0.3, e1z ], [ e0x, yt - 0.3, e0z ], [ e0x, yt - 0.04, e0z ], [ e1x, yt - 0.04, e1z ], [ - S.nx, 0, - S.nz ] );
			apron.add( [ c0x, yt - 0.3, c0z ], [ e0x, yt - 0.3, e0z ], [ e1x, yt - 0.3, e1z ], [ c1x, yt - 0.3, c1z ], [ 0, - 1, 0 ] );
			// ---- end FI1
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
		const red = standard( { name: 'drink-apron', color: new Color( 0.42, 0.025, 0.03 ), roughness: 0.4 } ); // ---- FI1
		for ( const [ geo, m, name ] of [ [ q, galv, 'drink-rail' ], [ shelf, alu, 'drink-shelf' ], [ apron, red, 'drink-apron' ] ] ) {

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
				// nor the way in from each gate (---- FI1 (CI-4): the Suite & Club Entrance behind home plate is no
				// way in to the concourse: its lobby is the suites' own, behind the brick. Clearing for it left the
				// concourse behind 120-125 without a stand for 25 m)
				if ( GATES.some( ( g ) => {

					if ( ! g.edge || g.suite ) return false;
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
		this.signTexture = signs; // ---- FW5 (C3W-1): the Terrace's far fronts read their names from it
		const body = new Quads(), face = new Quads(), glow = new Quads(), kick = new Quads(), lights = new Quads(), props = new Props(), bay = new Quads();
		this.standSpots = [];
		this.doors = [];
		this.units = units;
		for ( const U of units ) this._unit( U, frame( U.mid, U.a, U.n ), STREET, L, { body, face, glow, kick, lights, props, bay } ); // ---- FW3: one unit, at a level

		// ---- FI1 (CI-7): the stands are openings in walls of red ground-face block over a dark base course
		// (pompomflipflop, June 2008: the block beside a restroom door; visitphilly, Apr 2008: the 9th St.
		// Market's front), not grey precast boxes; their bays white tile and stainless
		const precast = standMaterials( 0 ).precast, bayMat = standMaterials( 0 ).bayMat; // ---- FW3: by level
		// the signs: a die-cut sign's cut-away (alpha under a half) isn't drawn, and what's painted rather than
		// lit (alpha under 1: the plaques, the bronze) doesn't glow
		const signMat = standard( { name: 'concession-signs', roughness: 0.4, textures: { bpStand: signs },
			surface: 'let ta = textureSample( bpStand, smpAnisoClamp, in.uv ); if ( ta.a < 0.5 ) { discard; } let t = ta.rgb; let lit = select( 0.12, 1.0, ta.a > 0.97 ); s.albedo = t * mix( 0.8, 0.45, lit ); s.emissive = t * lit * mix( 0.3, 0.75, smoothstep( 0.1, 0.7, frame.night ) );' } );
		// ---- end FI1
		const kickMat = standard( { name: 'concession-kick', roughness: 0.45, metalness: 0.2, textures: { bpStand: signs },
			surface: 'let t = textureSample( bpStand, smpAnisoClamp, in.uv ).rgb; s.albedo = t * 0.8;' } );
		const lightMat = standard( { name: 'concession-lights', color: new Color( 0.9, 0.9, 0.88 ), roughness: 0.5,
			surface: 's.emissive = vec3f( 1.0, 0.93, 0.8 ) * mix( 1.5, 4.0, smoothstep( 0.1, 0.7, frame.night ) );' } );
		const propMat = standard( { name: 'concourse-props', roughness: 0.5, surface: PROPS_WGSL } );
		const kitchen = standard( { name: 'concession-rooms', color: new Color( 0.06, 0.055, 0.05 ), roughness: 0.5, surface: ROOMS_WGSL } );
		for ( const m of [ precast, signMat, kickMat, lightMat, propMat, kitchen, bayMat ] ) m.underwaterLighting = 'none';
		for ( const [ q, m, name ] of [ [ body, precast, 'concession-stands' ], [ bay, bayMat, 'concession-bays' ], [ face, signMat, 'concession-signs' ], [ kick, kickMat, 'concession-kicks' ],
			[ lights, lightMat, 'concession-lights' ], [ glow, kitchen, 'concession-rooms' ], [ props, propMat, 'concourse-props' ] ] ) {

			const mesh = new Mesh( q.geometry(), m );
			mesh.name = name;
			mesh.castShadow = m === precast || m === propMat;
			mesh.receiveShadow = true;
			this.group.add( mesh );

		}

		this.standMats = { precast, bayMat, signMat, kickMat, lightMat, propMat, kitchen }; // ---- FW3: the Terrace's stands share them
		this.props = props;
		this.count = units.length;
		this.signLayout = L; // ---- FI1
		this.signMaterial = signMat; // ---- FI1
		this.propMaterial = propMat; // ---- FI1

	}

	// ---- FI1 (CI-9): the elevators on the main concourse as the photos and common sense have them: each bank
	// a brick core rising to the deck, two cars in it behind brushed stainless doors in a stainless frame, the
	// call plate between them lit, the floor shown over each door, ELEVATORS over them in the 2008 colours
	// (ZoeR, Apr 2008: the cream sign with the red band by the Home Stand's brick). They were a grey slab
	// standing loose on the concourse under a mint-green bar that glowed 50 m off (Bowl._elevators: its bars
	// are hidden at every level, its doors on this one; the stops the walker rides from are unchanged)
	_elevatorCores( bowl ) {

		const banks = bowl.elevators || [];
		if ( ! banks.length || ! this.signLayout ) return;
		bowl.group.traverse( ( o ) => {

			if ( ! o.isMesh ) return;
			const name = o.material?.name;
			if ( name === 'elevator-sign' ) o.visible = false;
			if ( name === 'elevator-door' && o.parent && Math.abs( o.parent.position.y - STREET ) < 0.5 ) o.visible = false;

		} );
		const brick = new Quads(), props = new Props(), face = new Quads();
		this._cores( banks.map( ( b ) => b.stops[ 0 ] ), STREET, () => LEVELS.clubConcourse - 0.6 - STREET, { brick, props, face } );
		for ( const [ q, m, name ] of [ [ brick, this.steel.brickMaterial, 'elevator-cores' ], [ props, this.propMaterial, 'elevator-doors' ], [ face, this.signMaterial, 'elevator-signs' ] ] ) {

			const mesh = new Mesh( q.geometry(), m );
			mesh.name = name;
			mesh.receiveShadow = true;
			this.group.add( mesh );

		}

	}

	// ---- FW3: the cores at a level's stops (y0 its floor; yTop( P ) how high the core goes over it)
	_cores( stops, y0, yTop, { brick, props, face } ) {

		const W = 3.2, DEP = 4.2, OH = 2.25;
		for ( const st of stops ) {

			const n = st.face, a = [ n[ 1 ], - n[ 0 ] ]; // the viewer's right, facing the doors
			const P = frame( [ st.x - n[ 0 ] * 1.8, st.z - n[ 1 ] * 1.8 ], a, n, y0 );
			const yT = yTop( P );
			// the brick round the two doors, the core's sides and back
			const piece = ( x0, x1, ya, yb ) => fwd( brick, P, n, x0, x1, ya, yb, 0, [ x0, y0 + yb, x1, y0 + ya ] );
			piece( - W, - 1.98, 0, yT ); piece( - 0.82, 0.82, 0, yT ); piece( 1.98, W, 0, yT );
			piece( - 1.98, - 0.82, OH, yT ); piece( 0.82, 1.98, OH, yT );
			for ( const s of [ - 1, 1 ] ) brick.add( P( s * W, 0, 0 ), P( s * W, 0, - DEP ), P( s * W, yT, - DEP ), P( s * W, yT, 0 ), [ a[ 0 ] * s, 0, a[ 1 ] * s ], 0, DEP );
			fwd( brick, P, n.map( ( v ) => - v ), W, - W, 0, yT, - DEP, [ W, y0 + yT, - W, y0 ] );
			for ( const cx of [ - 1.4, 1.4 ] ) {

				// the frame, the two leaves (a dark line where they meet), the sill
				for ( const s of [ - 1, 1 ] ) lbox( props.use( 'steel' ), P, a, n, cx + s * 0.6, OH / 2, 0, 0.06, OH + 0.06, 0.16 );
				lbox( props.use( 'steel' ), P, a, n, cx, OH + 0.03, 0, 1.26, 0.06, 0.16 );
				for ( const s of [ - 1, 1 ] ) lbox( props.use( 'steel' ), P, a, n, cx + s * 0.2875, OH / 2, - 0.1, 0.565, OH, 0.03 );
				lbox( props.use( 'black' ), P, a, n, cx, OH / 2, - 0.112, 0.012, OH, 0.01 );
				lbox( props.use( 'grey' ), P, a, n, cx, 0.01, 0, 1.16, 0.02, 0.3 );
				// over it the floor it's at, and which way it's going
				lbox( props.use( 'black' ), P, a, n, cx, OH + 0.27, 0.02, 0.5, 0.15, 0.03 );
				lbox( props.use( 'redlamp' ), P, a, n, cx - 0.08, OH + 0.27, 0.04, 0.07, 0.09, 0.01 );
				lbox( props.use( 'lamp' ), P, a, n, cx + 0.1, OH + 0.27, 0.04, 0.05, 0.06, 0.01 );

			}

			// the call plate, up and down lit
			lbox( props.use( 'steel' ), P, a, n, 0, 1.1, 0.02, 0.13, 0.28, 0.02 );
			for ( const y of [ 1.04, 1.16 ] ) lbox( props.use( 'lamp' ), P, a, n, 0, y, 0.035, 0.045, 0.045, 0.01 );
			// the sign
			const S = this.signLayout.half[ HALVES.indexOf( 'elevators' ) ];
			fwd( face, P, n, - 1.7, 1.7, 2.8, 3.5, 0.03, [ S[ 0 ], S[ 1 ], S[ 2 ], S[ 3 ] ] );
			const [ cx, , cz ] = P( 0, 0, - DEP / 2 ), w = this.field.toWorld( cx, cz );
			this.colliders.addBox( new Vector3( w.x, this.field.y0 + y0 + 2, w.z ), new Vector3( W + 0.1, 2, DEP / 2 + 0.1 ), this.field.group.rotation.y - Math.atan2( a[ 1 ], a[ 0 ] ), { tag: 'elevator-core' } );

		}

	}
	// ---- end FI1

	// ---- FW3: one unit at a level: its box (sides, back and roof in the block, a dark coping along the
	// front), the stand or the pair of halves in its front, and a collider round it
	_unit( U, P, y0, L, Q ) {

		const W = UNIT / 2, { body, props } = Q;
		// ---- FX3 (step 11, AD1-5): the back, as a stand's back is: the block, a steel service door near one
		// end under a wall pack, AUTHORIZED PERSONNEL ONLY on the door, and on a food stand its name again,
		// smaller, for whoever comes at it from behind (from the gates' atriums, the outer ring). The wall
		// pack's wash is the block's own shader's (uv.x over BACK_UV flags the face: u the metres from the
		// lamp, v the height), lit whatever the concourse's lights pick; it was a black 8 x 4 m face, lit by
		// nothing, square in the walk-concourse3b view
		const nb = U.n.map( ( v ) => - v ), lx = ( ( U.sec * 7 ) % 2 < 1 ? 1 : - 1 ) * ( W - 1.25 );
		fwd( body, P, nb, W, - W, 0, H, - DEPTH, [ BACK_UV + W - lx, H, BACK_UV - W - lx, 0 ] );
		{

			const z = - DEPTH;
			lbox( props.use( 'steel' ), P, U.a, U.n, lx, 1.1, z - 0.01, 1.1, 2.24, 0.05 );
			lbox( props.use( 'grey' ), P, U.a, U.n, lx, 1.06, z - 0.03, 0.94, 2.12, 0.03 );
			lbox( props.use( 'steel' ), P, U.a, U.n, lx, 0.15, z - 0.047, 0.92, 0.28, 0.006 );
			lbox( props.use( 'steel' ), P, U.a, U.n, lx, 1.0, z - 0.07, 0.75, 0.05, 0.05 );
			lbox( props.use( 'black' ), P, U.a, U.n, lx + ( lx > 0 ? 0.38 : - 0.38 ), 1.0, z - 0.05, 0.05, 0.12, 0.03 );
			// the wall pack over it: its dark housing, the lens under it lit
			lbox( props.use( 'black' ), P, U.a, U.n, lx, 2.98, z - 0.1, 0.34, 0.24, 0.2 );
			lbox( props.use( 'lamp' ), P, U.a, U.n, lx, 2.855, z - 0.12, 0.28, 0.012, 0.14 );
			// the plaque on the door, and the stand's name over the back
			const C = L?.cells?.[ BRANDS.length + PLAQUES.length ];
			if ( C ) fwd( Q.face, P, nb, lx + 0.2, lx - 0.2, 1.42, 1.72, z - 0.05, [ C[ 0 ], C[ 1 ] + ( C[ 3 ] - C[ 1 ] ) * 0.125, C[ 2 ], C[ 3 ] - ( C[ 3 ] - C[ 1 ] ) * 0.125 ] );
			if ( typeof U.what === 'string' && L?.food ) {

				const R = L.food[ BRANDS.indexOf( U.what ) ], sw = W * 0.58, sh = SIGN_H * 0.58, cx = - lx * 0.35;
				fwd( Q.face, P, nb, cx + sw, cx - sw, 3.05, 3.05 + sh, z - 0.03, [ 0, R.name[ 0 ], 1, R.name[ 1 ] ] );

			}

		}
		// ---- end FX3
		for ( const s of [ - 1, 1 ] ) {

			const X = [ U.a[ 0 ] * s, 0, U.a[ 1 ] * s ];
			body.add( P( s * W, 0, 0 ), P( s * W, 0, - DEPTH ), P( s * W, H, - DEPTH ), P( s * W, H, 0 ), X );

		}

		body.add( P( - W, H, 0 ), P( W, H, 0 ), P( W, H, - DEPTH ), P( - W, H, - DEPTH ), [ 0, 1, 0 ] );
		lbox( props.use( 'grey' ), P, U.a, U.n, 0, H + 0.04, 0.02, UNIT + 0.1, 0.08, 0.16 );
		if ( typeof U.what === 'string' ) this._foodUnit( U, P, FOOD[ U.what ], L, Q );
		else this._pairUnit( U, P, L, Q );
		// can't walk through it
		const [ cx, , cz ] = P( 0, 0, - DEPTH / 2 + 0.2 ), w = this.field.toWorld( cx, cz );
		this.colliders.addBox( new Vector3( w.x, this.field.y0 + y0 + H / 2, w.z ), new Vector3( UNIT / 2 + 0.3, H / 2, DEPTH / 2 + 0.3 ), this.field.group.rotation.y - Math.atan2( U.a[ 1 ], U.a[ 0 ] ), { tag: 'concession' } );

	}

	// ---- FW3 (C2W-7): the Terrace concourse's built-in stands, restrooms and services along its back under
	// the 400s, each where the October 2008 guide put it by section (TERRACE_PLAN), the bays between them left
	// open to the rail at the back (the view out over the lots and the city); the elevators' cores at their
	// Terrace stops. Into `group` (places/Terrace.js's: drawn only from up there), kept out of the static
	// batching, in two halves (first base's side, third's) so the half out of view isn't drawn. Returns the
	// units, the open bays, the stands' spots and the restroom doors (field frame, at `y`).
	terrace( bowl, group ) {

		const y = LEVELS.terraceConcourse, D = bowl.D, main = bowl.path.slice( 2 );
		const front = offsetPolyline( main, D.t400Back - 0.4 - 0.3 - DEPTH, [ 0, - 40 ] );
		const stops = ( bowl.elevators || [] ).map( ( b ) => b.stops[ 3 ] ).filter( Boolean );
		const slots = [];
		for ( let i = 0; i < front.length - 1; i ++ ) {

			const [ ax, az ] = front[ i ], [ bx, bz ] = front[ i + 1 ];
			const len = Math.hypot( bx - ax, bz - az );
			const n = Math.floor( ( len - GAP ) / ( UNIT + GAP ) );
			if ( n < 1 ) continue;
			const pad = ( len - n * ( UNIT + GAP ) + GAP ) / 2;
			const ux = ( bx - ax ) / len, uz = ( bz - az ) / len;
			let nx = - uz, nz = ux;
			if ( nx * ( - ax ) + nz * ( - 40 - az ) < 0 ) {

				nx = - nx; nz = - nz;

			}

			const a = ( ux * nz - uz * nx ) > 0 ? [ ux, uz ] : [ - ux, - uz ];
			for ( let j = 0; j < n; j ++ ) {

				const s = pad + j * ( UNIT + GAP ) + UNIT / 2;
				const mid = [ ax + ux * s, az + uz * s ];
				slots.push( { mid, n: [ nx, nz ], a, sec: terraceSection( mid[ 0 ], mid[ 1 ] ), lift: stops.some( ( c ) => Math.hypot( c.x - mid[ 0 ], c.z - mid[ 1 ] ) < 8.5 ) } );

			}

		}

		for ( const [ what, sec ] of TERRACE_PLAN ) {

			let best = null;
			for ( const U of slots ) if ( ! U.what && ! U.lift && Math.abs( U.sec - sec ) <= 2.5 && ( ! best || Math.abs( U.sec - sec ) < Math.abs( best.sec - sec ) ) ) best = U;
			if ( best ) best.what = what;

		}

		const units = slots.filter( ( U ) => U.what );
		const L = this.signLayout, M = this.standMats;
		const keep = [ this.standSpots, this.doors ];
		this.standSpots = [];
		this.doors = [];
		// the halves: by the side of home plate (field x)
		const halves = [ 0, 1 ].map( () => ( { body: new Quads(), face: new Quads(), glow: new Quads(), kick: new Quads(), lights: new Quads(), props: new Props(), bay: new Quads(), brick: new Quads() } ) );
		for ( const U of units ) this._unit( U, frame( U.mid, U.a, U.n, y ), y, L, halves[ U.mid[ 0 ] < 0 ? 1 : 0 ] );
		const spots = this.standSpots, doors = this.doors;
		[ this.standSpots, this.doors ] = keep;
		// the elevators: each stop's core up to the 400s' underside over its front (their doors toward the
		// field, Bowl._elevators); the bowl's bare door slabs there hidden
		const t400 = bowl.upper.find( ( t ) => t.name === 'terrace-400' );
		const rake = ( t400.rows - 1 ) * t400.rise / ( t400.rows * t400.depth );
		bowl.group.traverse( ( o ) => {

			if ( o.isMesh && o.material?.name === 'elevator-door' && o.parent && Math.abs( o.parent.position.y - y ) < 0.5 ) o.visible = false;

		} );
		for ( const st of stops ) {

			// (its face 8.6 m back of the 400s' front: Bowl._elevators' Terrace stop, 8 m back, and its 0.6)
			this._cores( [ st ], y, () => t400.y0 - t400.soffit + 8.6 * rake - y - 0.05, halves[ st.x < 0 ? 1 : 0 ] );

		}

		const far = this._terraceFar( units, stops, y, ( st ) => t400.y0 - t400.soffit + 8.6 * rake - y - 0.05 ); // ---- FW5 (C3W-1)
		const meshes = [], TM = standMaterials( y - STREET );
		halves.forEach( ( Q, h ) => {

			for ( const [ q, m, name ] of [ [ Q.body, TM.precast, 'concession-stands' ], [ Q.bay, TM.bayMat, 'concession-bays' ], [ Q.face, M.signMat, 'concession-signs' ], [ Q.kick, M.kickMat, 'concession-kicks' ],
				[ Q.lights, M.lightMat, 'concession-lights' ], [ Q.glow, M.kitchen, 'concession-rooms' ], [ Q.props, M.propMat, 'concourse-props' ], [ Q.brick, this.steel.brickMaterial, 'elevator-cores' ] ] ) {

				if ( ! q.count ) continue;
				const mesh = new Mesh( q.geometry(), m );
				mesh.name = 'terrace-' + name + ( h ? '-3b' : '-1b' );
				mesh.castShadow = m === TM.precast;
				mesh.receiveShadow = true;
				mesh.userData.dynamic = true;
				group.add( mesh );
				meshes.push( mesh );

			}

		} );
		far.name = 'terrace-stands-far';
		far.userData.dynamic = true;
		group.add( far );
		return { units, open: slots.filter( ( U ) => ! U.what && ! U.lift ), spots, doors, meshes, far: [ far ], y };

	}

	// ---- FW5 (C3W-1, gauntlet r3): the Terrace's stands as they're seen from under it and outside (the field,
	// the seats, the main concourse, Pattison), while the camera's below the club level and the stands proper
	// aren't drawn: their fronts, painted, in one draw. From down there they're a few pixels each: the lit
	// name over the counter and the menu board under it (the stands' own atlas), the lit bay, the block round
	// it; the restrooms' doors and their signs; the elevators' brick and steel doors. Units' sides too, for
	// the angle from down the lines. uv.x < 0 picks a paint (below), else it's the atlas.
	_terraceFar( units, stops, y, coreTop ) {

		const q = new Quads(), L = this.signLayout, W = UNIT / 2;
		// a paint, its v the height (field frame, as Quads.add's: the shader takes the floor off)
		const paint = ( k, y0, y1 ) => [ - k - 0.5, y + y1, - k - 0.5, y + y0 ];
		const BLOCK = 0, BAY = 1, DOOR = 2, BRICK = 3, STEEL = 4, SHOP = 5;
		for ( const U of units ) {

			const P = frame( U.mid, U.a, U.n, y ), n = U.n;
			const nb = U.n.map( ( v ) => - v );
			for ( const s of [ - 1, 1 ] ) q.add( P( s * W, 0, 0 ), P( s * W, 0, - DEPTH ), P( s * W, H, - DEPTH ), P( s * W, H, 0 ), [ U.a[ 0 ] * s, 0, U.a[ 1 ] * s ], - BLOCK - 0.5, - BLOCK - 0.5 );
			fwd( q, P, nb, W, - W, 0, H, - DEPTH, paint( BLOCK, 0, H ) );
			if ( typeof U.what === 'string' ) {

				const R = L.food[ BRANDS.indexOf( U.what ) ], OW = W - 0.35, OT = 2.35;
				fwd( q, P, n, - W, - OW, 0, OT, 0, paint( BLOCK, 0, OT ) );
				fwd( q, P, n, OW, W, 0, OT, 0, paint( BLOCK, 0, OT ) );
				fwd( q, P, n, - OW, OW, 0, OT, 0, paint( BAY, 0, OT ) );
				fwd( q, P, n, - W, W, OT, OT + 0.05, 0, paint( STEEL, OT, OT + 0.05 ) );
				fwd( q, P, n, - W, W, OT + 0.05, 3.3, 0, [ 0, R.menu[ 0 ], 1, R.menu[ 1 ] ] );
				fwd( q, P, n, - W, W, 3.3, H, 0, paint( BLOCK, 3.3, H ) );
				fwd( q, P, n, - W - 0.03, W + 0.03, 3.32, 3.32 + SIGN_H, 0.08, [ 0, R.name[ 0 ], 1, R.name[ 1 ] ] );

			} else {

				// the halves: a restroom's door, a window, a shop front, each with its sign over it
				const top = 2.55;
				fwd( q, P, n, - W, W, top, H, 0, paint( BLOCK, top, H ) );
				let x = - W;
				U.what.forEach( ( k, h ) => {

					const c = ( h - 0.5 ) * W, T = HALF[ k ].type;
					const [ x0, x1, y0, y1, kind ] = T === 'door' ? [ c - 0.8, c + 0.8, 0, 2.3, DOOR ] : T === 'window' ? [ c - 1.1, c + 1.1, 0.95, 2.2, BAY ] : [ c - 1.5, c + 1.5, 0, 2.5, SHOP ];
					fwd( q, P, n, x, x0, 0, top, 0, paint( BLOCK, 0, top ) );
					if ( y0 > 0 ) fwd( q, P, n, x0, x1, 0, y0, 0, paint( BLOCK, 0, y0 ) );
					fwd( q, P, n, x0, x1, y1, top, 0, paint( BLOCK, y1, top ) );
					fwd( q, P, n, x0, x1, y0, y1, 0, paint( kind, y0, y1 ) );
					const S = L.half[ HALVES.indexOf( k ) ];
					if ( T === 'door' ) fwd( q, P, n, c - 1.1, c + 1.1, 2.68, 3.14, 0.03, [ S[ 0 ], S[ 1 ], S[ 2 ], S[ 3 ] ] );
					else fwd( q, P, n, c - 1.7, c + 1.7, 2.62, 3.32, 0.04, [ S[ 0 ], S[ 1 ], S[ 2 ], S[ 3 ] ] );
					x = x1;

				} );
				fwd( q, P, n, x, W, 0, top, 0, paint( BLOCK, 0, top ) );

			}

		}

		// the elevators' cores: brick, two steel doors, ELEVATORS over them
		const S = L.half[ HALVES.indexOf( 'elevators' ) ];
		for ( const st of stops ) {

			const nn = st.face, a = [ nn[ 1 ], - nn[ 0 ] ], CW = 3.2, DEP = 4.2;
			const P = frame( [ st.x - nn[ 0 ] * 1.8, st.z - nn[ 1 ] * 1.8 ], a, nn, y );
			const yT = coreTop( st );
			fwd( q, P, nn, - CW, CW, 2.25, yT, 0, paint( BRICK, 2.25, yT ) );
			fwd( q, P, nn, - CW, - 1.98, 0, 2.25, 0, paint( BRICK, 0, 2.25 ) );
			fwd( q, P, nn, - 0.82, 0.82, 0, 2.25, 0, paint( BRICK, 0, 2.25 ) );
			fwd( q, P, nn, 1.98, CW, 0, 2.25, 0, paint( BRICK, 0, 2.25 ) );
			for ( const cx of [ - 1.4, 1.4 ] ) fwd( q, P, nn, cx - 0.58, cx + 0.58, 0, 2.25, 0, paint( STEEL, 0, 2.25 ) );
			fwd( q, P, nn, - 1.7, 1.7, 2.8, 3.5, 0.03, [ S[ 0 ], S[ 1 ], S[ 2 ], S[ 3 ] ] );
			for ( const s of [ - 1, 1 ] ) q.add( P( s * CW, 0, 0 ), P( s * CW, 0, - DEP ), P( s * CW, yT, - DEP ), P( s * CW, yT, 0 ), [ a[ 0 ] * s, 0, a[ 1 ] * s ], - BRICK - 0.5, - BRICK - 0.5 );

		}

		const m = standard( { name: 'terrace-stands-far', roughness: 0.7, textures: { bpStand: this.signTexture }, modules: [ commonModule ],
			surface: /* wgsl */`
	let night = smoothstep( 0.1, 0.7, frame.night );
	let v = in.uv.y - ${ y.toFixed( 3 ) };
	// the block's colour: red ground face over a dark base course (the stands' own, without its coursing)
	let block = select( vec3f( 0.22, 0.07, 0.048 ), vec3f( 0.07, 0.065, 0.065 ), v < 0.6 ) * ( 0.9 + 0.1 * mx_noise_float2( in.P.xz * 2.0 ) );
	if ( in.uv.x >= 0.0 ) {
		// the atlas: a lit name or a painted plaque; its cut-away is the block behind it
		let ta = textureSample( bpStand, smpAnisoClamp, in.uv );
		let on = step( 0.5, ta.a );
		let lit = select( 0.12, 1.0, ta.a > 0.97 );
		s.albedo = mix( block, ta.rgb * mix( 0.8, 0.45, lit ), on );
		s.emissive = ta.rgb * lit * on * mix( 0.3, 0.75, night );
	} else {
		let k = u32( - in.uv.x );
		s.albedo = block;
		if ( k == 1u || k == 5u ) {
			// a lit bay: white tile under fluorescent tubes, the stainless counter, the stand's people a
			// dark band at head height (a shop: its racks and their colours)
			var c = vec3f( 0.75, 0.73, 0.68 );
			if ( v < 1.05 && k == 1u ) { c = vec3f( 0.32, 0.33, 0.34 ); }
			if ( k == 1u && v > 1.15 && v < 1.75 ) { c = c * ( 0.45 + 0.4 * step( 0.55, fract( ( in.P.x + in.P.z ) * 0.9 ) ) ); }
			if ( k == 5u && v < 1.6 ) { c = mix( vec3f( 0.6, 0.06, 0.07 ), vec3f( 0.78 ), step( 0.5, fract( ( in.P.x + in.P.z ) * 3.0 ) ) ); }
			s.albedo = c * 0.5;
			s.emissive = c * vec3f( 1.0, 0.95, 0.85 ) * mix( 0.35, 0.8, night ) * select( 1.0, 0.6, v < 1.05 && k == 1u );
		} else if ( k == 2u ) {
			// a restroom's door: the vestibule's dark, the tile of its privacy wall lit beyond
			s.albedo = vec3f( 0.04 );
			s.emissive = vec3f( 0.5, 0.5, 0.47 ) * mix( 0.05, 0.15, night ) * step( 0.8, v ) * step( v, 2.1 );
		} else if ( k == 3u ) {
			s.albedo = vec3f( 0.28, 0.1, 0.07 ) * ( 0.88 + 0.12 * mx_noise_float2( in.P.xz * 3.0 + in.P.y ) );
		} else if ( k == 4u ) {
			s.albedo = vec3f( 0.5, 0.5, 0.52 );
			s.metalness = 0.7;
			s.roughness = 0.35;
		}
	}
` } );
		m.underwaterLighting = 'none';
		const mesh = new Mesh( q.geometry(), m );
		mesh.receiveShadow = true;
		return mesh;

	}
	// ---- end FW5

	// ---- FW3 (CI-18): the Pavilion's and the Arcade's walkways behind their top rows. Their back walls were
	// a painted strip of stands for being seen across the field (bands of colour, stick figures), and up close
	// a child's drawing. Now the main concourse's units built into them, stand by stand where the October 2008
	// guide puts them (the Pavilion: Brewerytown 204 and 209, Fairmount Fries 208, Hatfield 209, the Creamery
	// 205, the Market 206, family restrooms 205 and 208; the Arcade: the Market 233, a family restroom 234),
	// the other bays the same block with a service door, all their fronts on the wall's line (the painted
	// strip hidden). Fronts only (a stand's bay and kitchen go in behind the wall): nothing to see from below.
	// Into `group`, batched with the rest (they show from across the field too). Returns the stands' spots.
	galleries( bowl, group ) {

		const plans = {
			pavilion: [ [ 'brewerytown', 204 ], [ 'brewerytown', 209 ], [ 'fries', 208 ], [ 'hatfield', 209 ], [ 'creamery', 205 ], [ 'market', 206 ], [ [ 'family', 'women' ], 205 ], [ [ 'men', 'family' ], 208 ], [ [ 'women', 'men' ], 202 ], [ 'market', 210 ] ],
			arcade: [ [ 'market', 233 ], [ [ 'family', 'men' ], 234 ], [ [ 'women', 'men' ], 236 ], [ 'brewerytown', 235 ] ],
		};
		const first = { pavilion: 201, arcade: 233 }, count = { pavilion: 11, arcade: 5 };
		const L = this.signLayout, keep = [ this.standSpots, this.doors ];
		const spots = [];
		// the painted strips go
		bowl.group.traverse( ( o ) => {

			if ( o.isMesh && o.name === 'concourse-opening' ) o.visible = false;

		} );
		for ( const name of [ 'pavilion', 'arcade' ] ) {

			const t = bowl.upper?.find( ( u ) => u.name === name );
			if ( ! t ) continue;
			const yTop = t.y0 + ( t.rows - 1 ) * t.rise, y = yTop + 0.25, hW = 4.35;
			const G = offsetPolyline( t.front, t.rows * t.depth + 4 - 0.03, [ 0, - 40 ] );
			let total = 0;
			for ( let i = 0; i < G.length - 1; i ++ ) total += Math.hypot( G[ i + 1 ][ 0 ] - G[ i ][ 0 ], G[ i + 1 ][ 1 ] - G[ i ][ 1 ] );
			const slots = [], walls = [];
			let s0 = 0;
			for ( let i = 0; i < G.length - 1; i ++ ) {

				const [ ax, az ] = G[ i ], [ bx, bz ] = G[ i + 1 ];
				const len = Math.hypot( bx - ax, bz - az );
				if ( len < 0.05 ) continue;
				const ux = ( bx - ax ) / len, uz = ( bz - az ) / len;
				let nx = - uz, nz = ux;
				if ( nx * ( - ax ) + nz * ( - 40 - az ) < 0 ) {

					nx = - nx; nz = - nz;

				}

				const a = ( ux * nz - uz * nx ) > 0 ? [ ux, uz ] : [ - ux, - uz ];
				const n = Math.max( 0, Math.floor( ( len - GAP ) / ( UNIT + GAP ) ) );
				const pad = ( len - n * ( UNIT + GAP ) + GAP ) / 2;
				// the wall's pieces between the units (and the whole segment if none fits)
				let w0 = 0;
				for ( let j = 0; j < n; j ++ ) {

					const s = pad + j * ( UNIT + GAP ) + UNIT / 2;
					const mid = [ ax + ux * s, az + uz * s ];
					slots.push( { mid, n: [ nx, nz ], a, sec: Math.min( first[ name ] + count[ name ] - 1, first[ name ] + Math.floor( ( s0 + s ) / total * count[ name ] ) ) } );
					walls.push( { ax, az, ux, uz, nx, nz, t0: w0, t1: s - UNIT / 2 } );
					w0 = s + UNIT / 2;

				}

				walls.push( { ax, az, ux, uz, nx, nz, t0: w0, t1: len } );
				s0 += len;

			}

			for ( const [ what, sec ] of plans[ name ] ) {

				let best = null;
				for ( const U of slots ) if ( ! U.what && ( ! best || Math.abs( U.sec - sec ) < Math.abs( best.sec - sec ) ) ) best = U;
				if ( best ) best.what = what;

			}

			const TM = standMaterials( y - STREET ), M = this.standMats;
			const Q = { body: new Quads(), face: new Quads(), glow: new Quads(), kick: new Quads(), lights: new Quads(), props: new Props(), bay: new Quads() };
			this.standSpots = [];
			this.doors = [];
			for ( const U of slots ) {

				const P = frame( U.mid, U.a, U.n, y );
				if ( U.what ) {

					if ( typeof U.what === 'string' ) this._foodUnit( U, P, FOOD[ U.what ], L, Q );
					else this._pairUnit( U, P, L, Q );

				} else {

					// a plain bay: the block, a steel service door, a poster frame
					fwd( Q.body, P, U.n, - UNIT / 2, - 0.6, 0, H, 0 );
					fwd( Q.body, P, U.n, 0.6, UNIT / 2, 0, H, 0 );
					fwd( Q.body, P, U.n, - 0.6, 0.6, 2.2, H, 0 );
					lbox( Q.props.use( 'grey' ), P, U.a, U.n, 0, 1.1, - 0.02, 1.2, 2.2, 0.04 );
					lbox( Q.props.use( 'steel' ), P, U.a, U.n, 0.42, 1.05, 0.01, 0.12, 0.03, 0.04 );
					lbox( Q.props.use( 'black' ), P, U.a, U.n, - 2.2, 1.7, 0.02, 1.0, 1.4, 0.03 );

				}

				// the wall over it up to the deck's precast, a dark coping
				fwd( Q.body, P, U.n, - UNIT / 2, UNIT / 2, H, hW, 0 );
				lbox( Q.props.use( 'grey' ), P, U.a, U.n, 0, H + 0.04, 0.02, UNIT + 0.1, 0.08, 0.16 );

			}

			// the block between them, floor to the precast
			for ( const w of walls ) {

				if ( w.t1 - w.t0 < 0.02 ) continue;
				const A0 = [ w.ax + w.ux * w.t0, y, w.az + w.uz * w.t0 ], A1 = [ w.ax + w.ux * w.t1, y, w.az + w.uz * w.t1 ];
				Q.body.add( A0, A1, [ A1[ 0 ], y + hW, A1[ 2 ] ], [ A0[ 0 ], y + hW, A0[ 2 ] ], [ w.nx, 0, w.nz ] );

			}

			spots.push( ...this.standSpots.map( ( st ) => ( { ...st, y, tier: name } ) ) );
			for ( const [ q, m, nm ] of [ [ Q.body, TM.precast, 'concession-stands' ], [ Q.bay, TM.bayMat, 'concession-bays' ], [ Q.face, M.signMat, 'concession-signs' ], [ Q.kick, M.kickMat, 'concession-kicks' ],
				[ Q.lights, M.lightMat, 'concession-lights' ], [ Q.glow, M.kitchen, 'concession-rooms' ], [ Q.props, M.propMat, 'concourse-props' ] ] ) {

				if ( ! q.count ) continue;
				const mesh = new Mesh( q.geometry(), m );
				mesh.name = name + '-' + nm;
				mesh.receiveShadow = true;
				group.add( mesh );

			}

		}

		[ this.standSpots, this.doors ] = keep;
		return { spots };

	}
	// ---- end FW3

	// A stand: pillars either side of the service window, the menu board over it on a lit lip, the name
	// across the top; the window over a stainless counter on a kick panel in the stand's colours, two
	// registers, napkins and straws at the ends; behind the counter the staff's bay (lit from its ceiling)
	// and the kitchen traced into depth beyond it; queue stanchions with belts out front
	_foodUnit( U, P, F, L, { body, face, glow, kick, lights, props, bay } ) {

		const W = UNIT / 2, n = U.n, a = U.a, b = BRANDS.indexOf( U.what );
		const R = L.food[ b ];
		const OW = W - 0.35, OT = 2.35, BAY = 1.3;
		fwd( body, P, n, - W, - OW, 0, OT, 0 );
		fwd( body, P, n, OW, W, 0, OT, 0 );
		fwd( body, P, n, - W, W, OT, OT + 0.05, 0 );
		// the menu board and the name
		fwd( face, P, n, - W, W, OT + 0.05, 3.3, 0.02, [ 0, R.menu[ 0 ], 1, R.menu[ 1 ] ] );
		// ---- FI1 (CI-7): the stand's own die-cut sign mounted on the brick over the menu board, standing up
		// past the roofline where it's tall (Hatfield's oval, Brewerytown's arch: docindigo76, NLCS 2009; auds,
		// 27 Oct 2008); it was a lit band in the stand's colour across the top
		fwd( body, P, n, - W, W, 3.3, H, 0 );
		fwd( face, P, n, - W - 0.03, W + 0.03, 3.32, 3.32 + SIGN_H, 0.08, [ 0, R.name[ 0 ], 1, R.name[ 1 ] ] );
		// and out over the walkway on an arm at the stand's end, read from along the concourse
		if ( F.blade ) {

			const B = L.cells[ BRANDS.indexOf( U.what ) ], x = W - 0.15, z0 = 0.35, z1 = 1.75, y0 = 3.05, y1 = 4.1;
			// (C2W-9, FW2: each face's u runs to its own viewer's right, toward the wall seen from the +a side
			// and away from it from the other: both read backwards before)
			face.tri( P( x, y0, z0 ), P( x, y0, z1 ), P( x, y1, z1 ), [ a[ 0 ], 0, a[ 1 ] ], [ B[ 2 ], B[ 3 ] ], [ B[ 0 ], B[ 3 ] ], [ B[ 0 ], B[ 1 ] ] );
			face.tri( P( x, y0, z0 ), P( x, y1, z1 ), P( x, y1, z0 ), [ a[ 0 ], 0, a[ 1 ] ], [ B[ 2 ], B[ 3 ] ], [ B[ 0 ], B[ 1 ] ], [ B[ 2 ], B[ 1 ] ] );
			face.tri( P( x - 0.01, y0, z1 ), P( x - 0.01, y0, z0 ), P( x - 0.01, y1, z0 ), [ - a[ 0 ], 0, - a[ 1 ] ], [ B[ 2 ], B[ 3 ] ], [ B[ 0 ], B[ 3 ] ], [ B[ 0 ], B[ 1 ] ] );
			face.tri( P( x - 0.01, y0, z1 ), P( x - 0.01, y1, z0 ), P( x - 0.01, y1, z1 ), [ - a[ 0 ], 0, - a[ 1 ] ], [ B[ 2 ], B[ 3 ] ], [ B[ 0 ], B[ 1 ] ], [ B[ 2 ], B[ 1 ] ] );
			// the arm over it (no longer a second rod through its face), the sign hung from it on two drops
			lbox( props.use( 'black' ), P, a, n, x, y1 + 0.09, ( z0 + z1 ) / 2 - 0.15, 0.04, 0.04, z1 - z0 + 0.6 );
			for ( const z of [ z0 + 0.15, z1 - 0.15 ] ) lbox( props.use( 'black' ), P, a, n, x, y1 + 0.03, z, 0.015, 0.1, 0.015 );

		}
		// ---- end FI1
		// a lip under the menu board with a light strip under it, lighting the counter
		lbox( props.use( 'black' ), P, a, n, 0, OT + 0.02, 0.2, UNIT - 0.2, 0.06, 0.4 );
		lights.add( P( - OW + 0.2, OT - 0.015, 0.35 ), P( OW - 0.2, OT - 0.015, 0.35 ), P( OW - 0.2, OT - 0.015, 0.3 ), P( - OW + 0.2, OT - 0.015, 0.3 ), [ 0, - 1, 0 ] );
		// the bay: its sides and ceiling, fluorescent tubes across it, the kitchen beyond
		for ( const s of [ - 1, 1 ] ) bay.add( P( s * OW, 0, 0 ), P( s * OW, 0, - BAY ), P( s * OW, OT, - BAY ), P( s * OW, OT, 0 ), [ - a[ 0 ] * s, 0, - a[ 1 ] * s ] );
		bay.add( P( - OW, OT, 0 ), P( OW, OT, 0 ), P( OW, OT, - BAY ), P( - OW, OT, - BAY ), [ 0, - 1, 0 ] );
		for ( const x of [ - 2.2, 0, 2.2 ] ) lights.add( P( x - 0.6, OT - 0.01, - 0.55 ), P( x + 0.6, OT - 0.01, - 0.55 ), P( x + 0.6, OT - 0.01, - 0.7 ), P( x - 0.6, OT - 0.01, - 0.7 ), [ 0, - 1, 0 ] );
		const code = F.kitchen * 4 + 3;
		fwd( glow, P, n, - OW, OW, 0, OT, - BAY, [ code * 20, OT, code * 20 + 2 * OW, 0 ] );
		// the counter and its kick panel
		lbox( props.use( 'steel' ), P, a, n, 0, 1.045, 0.05, 2 * OW, 0.05, 0.62 );
		fwd( kick, P, n, - OW, OW, 0, 1.02, 0.35, [ 0, R.kick[ 0 ], 1, R.kick[ 1 ] ] );
		for ( const s of [ - 1, 1 ] ) lbox( props.use( 'steel' ), P, a, n, s * ( OW - 0.02 ), 0.51, 0.05, 0.04, 1.02, 0.6 );
		// ---- FI1 (CI-20): in the bay, in depth, what the 2008 photo of the 9th St. Market shows (visitphilly,
		// Apr 2008): a stainless back counter, two pendant lamps over the service counter, and for the grills
		// a glass warmer of foil-wrapped sandwiches under its heat lamp, a soft-serve machine at the Creamery
		lbox( props.use( 'steel' ), P, a, n, 0, 0.45, - BAY + 0.32, 2 * OW - 0.1, 0.9, 0.6 );
		for ( const x of [ - OW * 0.5, OW * 0.5 ] ) {

			lbox( props.use( 'black' ), P, a, n, x, OT - 0.25, - 0.45, 0.012, 0.5, 0.012 );
			lbox( props.use( 'lamp' ), P, a, n, x, OT - 0.55, - 0.45, 0.3, 0.1, 0.3 );

		}

		if ( F.kitchen === 0 ) {

			lbox( props.use( 'steel' ), P, a, n, - OW + 0.7, 1.1, - 0.15, 1.0, 0.04, 0.4 );
			lbox( props.use( 'glass' ), P, a, n, - OW + 0.7, 1.3, - 0.15, 0.96, 0.36, 0.36 );
			for ( let i = 0; i < 6; i ++ ) lbox( props.use( 'foil' ), P, a, n, - OW + 0.33 + i * 0.15, 1.17, - 0.15 + ( i % 2 ) * 0.06, 0.12, 0.08, 0.14 );
			lbox( props.use( 'redlamp' ), P, a, n, - OW + 0.7, 1.5, - 0.15, 0.9, 0.04, 0.12 );

		} else if ( F.kitchen === 3 ) {

			lbox( props.use( 'steel' ), P, a, n, - OW + 0.7, 1.55, - 0.7, 0.55, 1.0, 0.55 );
			lbox( props.use( 'black' ), P, a, n, - OW + 0.7, 1.45, - 0.41, 0.3, 0.06, 0.04 );

		}
		// ---- end FI1
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
			return { k, c, x0: c - 1.5, x1: c + 1.5, y0: 0, y1: 2.5, deep: 2.4, wc: 2 }; // ---- FI1 (CI-13): a shop you can see into (was 0.6)

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
			if ( hk.type === 'door' ) {

				// ---- FI1 (CI-11): a restroom's door is marked by the park's home-plate plaque on the block
				// beside it (pompomflipflop, June 2008; mauradotcom, Aug 2004), and a painted sign over it,
				// not a lit navy band
				fwd( face, P, n, o.c - 1.1, o.c + 1.1, 2.68, 3.14, 0.03, [ S[ 0 ], S[ 1 ], S[ 2 ], S[ 3 ] ] );
				const C = L.cells[ PLAQUES.indexOf( o.k ) + BRANDS.length ], px = o.c + ( o.c > 0 ? 1.15 : - 1.15 );
				fwd( face, P, n, px - 0.27, px + 0.27, 1.32, 1.98, 0.02, [ C[ 0 ] + ( C[ 2 ] - C[ 0 ] ) * 0.25, C[ 1 ], C[ 2 ] - ( C[ 2 ] - C[ 0 ] ) * 0.25, C[ 3 ] ] );
				// ---- end FI1

			} else fwd( face, P, n, o.c - 1.7, o.c + 1.7, 2.62, 3.32, 0.04, [ S[ 0 ], S[ 1 ], S[ 2 ], S[ 3 ] ] );
			if ( hk.type === 'window' ) {

				// a ledge, a bell, a light over it
				lbox( props.use( 'steel' ), P, a, n, o.c, o.y0 + 0.05, 0.05, o.x1 - o.x0 + 0.1, 0.04, 0.4 );
				lights.add( P( o.x0 + 0.2, o.y1 - 0.01, - 0.05 ), P( o.x1 - 0.2, o.y1 - 0.01, - 0.05 ), P( o.x1 - 0.2, o.y1 - 0.01, - 0.2 ), P( o.x0 + 0.2, o.y1 - 0.01, - 0.2 ), [ 0, - 1, 0 ] );
				this.standSpots.push( { mid: P( o.c, 0, 0 ).filter( ( v, i ) => i !== 1 ), n, u: a, inset: 0.25, staff: [ 0 ], kind: 'window', what: o.k, sec: U.sec } );

			} else if ( hk.type === 'shop' ) {

				lights.add( P( o.x0 + 0.2, o.y1 - 0.01, - 0.1 ), P( o.x1 - 0.2, o.y1 - 0.01, - 0.1 ), P( o.x1 - 0.2, o.y1 - 0.01, - 0.3 ), P( o.x0 + 0.2, o.y1 - 0.01, - 0.3 ), [ 0, - 1, 0 ] );
				// ---- FI1 (CI-13): inside, two chrome racks of jerseys (home whites and the red alternates, the
				// World Series patch on the sleeve: Getty, 20 Oct 2008) and the counter with its register (Getty,
				// WS Game 3: racks packed, shoppers shoulder to shoulder)
				if ( o.k === 'merch' ) {

					for ( const [ rx, rz ] of [ [ o.c - 0.75, - 1.3 ], [ o.c + 0.55, - 1.75 ] ] ) {

						lbox( props.use( 'chrome' ), P, a, n, rx, 0.7, rz, 0.03, 1.4, 0.03 );
						lbox( props.use( 'chrome' ), P, a, n, rx, 1.38, rz, 1.0, 0.025, 0.025 );
						lbox( props.use( 'chrome' ), P, a, n, rx, 0.02, rz, 0.7, 0.03, 0.5 );
						for ( let j = 0; j < 9; j ++ ) {

							const jx = rx - 0.42 + j * 0.105;
							lbox( props.use( j % 3 === 1 ? 'cartred' : 'white' ), P, a, n, jx, 1.02, rz, 0.025, 0.66, 0.5 );
							lbox( props.use( j % 3 === 1 ? 'cartred' : 'white' ), P, a, n, jx, 1.24, rz, 0.026, 0.16, 0.62 );

						}

					}

					lbox( props.use( 'wood' ), P, a, n, o.c + 1.1, 0.5, - 0.75, 0.6, 1.0, 1.1 );
					lbox( props.use( 'black' ), P, a, n, o.c + 1.1, 1.08, - 0.6, 0.32, 0.14, 0.26 );
					lbox( props.use( 'screen' ), P, a, n, o.c + 1.1, 1.2, - 0.65, 0.24, 0.14, 0.03 );

				}
				// ---- end FI1
				// a rack of T-shirts and a table of caps out front (---- FI1: not at McFadden's door)
				if ( o.k !== 'mcfaddens' ) {

					lbox( props.use( 'black' ), P, a, n, o.c + 0.9, 0.55, 0.9, 0.9, 0.04, 0.5 );
					for ( let i = 0; i < 5; i ++ ) lbox( props.use( i % 2 ? 'cartred' : 'white' ), P, a, n, o.c + 0.6 + i * 0.15, 0.62, 0.9, 0.12, 0.1, 0.22 );
					for ( const s of [ - 1, 1 ] ) lbox( props.use( 'black' ), P, a, n, o.c + 0.9 + s * 0.42, 0.27, 0.9, 0.04, 0.54, 0.04 );

				}
				this.standSpots.push( { mid: P( o.c, 0, 0 ).filter( ( v, i ) => i !== 1 ), n, u: a, inset: 0.3, staff: [ - 0.6 ], kind: 'shop', what: o.k, sec: U.sec } );

			} else {

				this.doors.push( { x: P( o.c, 0, 0.3 )[ 0 ], z: P( o.c, 0, 0.3 )[ 2 ], n, a, kind: o.k, sec: U.sec } );
				// a CAUTION WET FLOOR sign by the door, the floor tracked wet in the rain
				if ( o.k !== 'family' ) {

					const px = o.c + ( o.c > 0 ? 1.15 : - 1.15 );
					// ---- FW5 (C3W-10, gauntlet r3): an A-frame, both its panels' faces (seen from the side it was
					// two bare quads edge on: a mustard slab standing out of the floor), CAUTION in a black band
					// across the top of each outer face, the slipping figure under it, a black hinge
					for ( const [ zb, sg ] of [ [ 0.55, 1 ], [ 0.29, - 1 ] ] ) {

						const Q = ( x, t, off = 0 ) => P( px + x * ( 1 - t * 0.25 ), 0.62 * t, zb + ( 0.42 - zb ) * t + sg * off );
						const N = [ n[ 0 ] * sg, 0.2, n[ 1 ] * sg ], Nb = [ - n[ 0 ] * sg, - 0.2, - n[ 1 ] * sg ];
						props.use( 'yellow' );
						props.add( Q( - 0.16, 0 ), Q( 0.16, 0 ), Q( 0.16, 1 ), Q( - 0.16, 1 ), N );
						props.add( Q( 0.16, 0, - 0.012 ), Q( - 0.16, 0, - 0.012 ), Q( - 0.16, 1, - 0.012 ), Q( 0.16, 1, - 0.012 ), Nb );
						props.use( 'black' );
						props.add( Q( - 0.16, 0.74, 0.003 ), Q( 0.16, 0.74, 0.003 ), Q( 0.16, 0.86, 0.003 ), Q( - 0.16, 0.86, 0.003 ), N );
						props.add( Q( - 0.05, 0.3, 0.003 ), Q( 0.06, 0.3, 0.003 ), Q( 0.04, 0.6, 0.003 ), Q( - 0.03, 0.6, 0.003 ), N );

					}

					lbox( props.use( 'black' ), P, a, n, px, 0.62, 0.42, 0.26, 0.025, 0.03 );
					// ---- end FW5

				}

			}

		}

	}

	// the atlas of the stands' signs: per stand its name band, menu board and kick panel, then the half
	// units' signs two to a row
	_signLayout() {

		const W = 1024, NH = NAME_PX, MH = 224, KH = 48, HH = 112, CW = 256, CH = 192; // ---- FI1: NH, the cells
		const per = NH + MH + KH;
		const nCells = BRANDS.length + PLAQUES.length + 1; // ---- FX3 (AD1-5): and the service doors' plaque
		const total = BRANDS.length * per + Math.ceil( HALVES.length / 2 ) * HH + Math.ceil( nCells / 4 ) * CH;
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
		// ---- FI1: the cells under the half signs, four to a row: the blades by brand, then the plaques
		const yc = y0 + Math.ceil( HALVES.length / 2 ) * HH;
		const cells = Array.from( { length: nCells }, ( _, i ) => {

			const x = ( i % 4 ) * CW, y = yc + Math.floor( i / 4 ) * CH;
			return [ ( x + 2 ) / W, y / total, ( x + CW - 2 ) / W, ( y + CH ) / total, x, y ];

		} );
		return { W, NH, MH, KH, HH, CW, CH, per, total, food, half, y0, cells };

	}

	_signs( L ) {

		const { W, NH, MH, KH, HH, total } = L;
		return canvasTexture( W, total, ( ctx ) => {

			const sans = '"Helvetica Neue", Helvetica, Arial, sans-serif', serif = 'Georgia, "Times New Roman", serif';
			ctx.textBaseline = 'middle';
			BRANDS.forEach( ( key, i ) => {

				const F = FOOD[ key ], y = L.food[ i ].y;
				// ---- FI1 (CI-7): the stand's die-cut sign, the band round it cut away (the brick shows)
				dieCut( ctx, key, W / 2, y + NH / 2, W - 8, NH - 6 );
				// ---- end FI1
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
				// ---- FI1 (CI-13): the Home Stand's dark bronze plaque on the brick (ZoeR, Apr 2008), painted, not lit
				if ( k === 'merch' ) {

					bronze( ctx, x + w / 2, y + HH / 2, w - 30, HH - 34 );
					return;

				}
				// ---- end FI1
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

				// ---- FI1 (CI-11): the restrooms' signs over their doors are painted, not lit
				if ( HALF[ k ].type === 'door' || k === 'elevators' ) unlit( ctx, x, y, w, HH );

			} );
			// ---- FI1: the cells: the stands' blades, the restrooms' home-plate plaques
			BRANDS.forEach( ( key, i ) => {

				if ( ! FOOD[ key ].blade ) return;
				const [ , , , , x, y ] = L.cells[ i ];
				dieCut( ctx, key, x + L.CW / 2, y + L.CH / 2, L.CW - 12, L.CH - 12, true );

			} );
			PLAQUES.forEach( ( k, i ) => {

				const [ , , , , x, y ] = L.cells[ BRANDS.length + i ];
				plaque( ctx, k, x + L.CW / 2, y + L.CH / 2, L.CH * 0.62, L.CH - 8 );

			} );
			// ---- FX3 (step 11, AD1-5): the plaque on the stands' service doors, painted (not lit): white,
			// the park's red letters, a navy rule
			{

				const [ , , , , x, y ] = L.cells[ BRANDS.length + PLAQUES.length ], w = L.CW, h = L.CH, py = y + h * 0.125, ph = h * 0.75;
				ctx.fillStyle = '#f2f0ea'; ctx.fillRect( x, py, w, ph );
				ctx.fillStyle = '#13294f'; ctx.fillRect( x + 8, py + 8, w - 16, 6 ); ctx.fillRect( x + 8, py + ph - 14, w - 16, 6 );
				ctx.fillStyle = '#b3121b'; ctx.textAlign = 'center';
				ctx.font = `800 34px ${ sans }`;
				ctx.fillText( 'AUTHORIZED', x + w / 2, py + ph * 0.36, w - 24 );
				ctx.font = `800 26px ${ sans }`;
				ctx.fillText( 'PERSONNEL ONLY', x + w / 2, py + ph * 0.66, w - 24 );
				unlit( ctx, x, py, w, ph );

			}
			// ---- end FX3
			// ---- end FI1

		}, 'concessions' );

	}

}
