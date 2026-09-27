import { TOP, HEAD, PANTS, CELL, packLook, propBits } from './Folk.js';

// What a fan wears to Game 5: Phillies red over everything (hoodies, replica jerseys with the name and
// number, a red tee over a grey hoodie), jackets for the cold (black, navy, Carhartt, leather, a few in
// Eagles green), the odd 1980 powder blue, the brave few in Rays blue. On the 27th, in the rain: an
// umbrella, a poncho (clear, MLB red, yellow, a garbage bag), a hood up, a soaked cap. On the 29th, cold
// and windy and dry: beanies, hoods, hands in pockets.

const pick = ( r, table ) => {

	let x = r() * table.reduce( ( s, [ , w ] ) => s + w, 0 );
	for ( const [ v, w ] of table ) if ( ( x -= w ) <= 0 ) return v;
	return table[ table.length - 1 ][ 0 ];

};

const TOPS = [
	[ TOP.hoodieRed, 16 ], [ TOP.jerseyHome, 12 ], [ TOP.teeOverHoodie, 11 ], [ TOP.jerseyRed, 5 ], [ TOP.jacketBlack, 9 ], [ TOP.sweatGrey, 5 ],
	[ TOP.jacketNavy, 4 ], [ TOP.carhartt, 4 ], [ TOP.leather, 3 ], [ TOP.eagles, 3 ], [ TOP.windbreaker, 4 ], [ TOP.parkaRed, 5 ],
	[ TOP.pufferBlack, 5 ], [ TOP.powderBlue, 2 ], [ TOP.jerseyRoad, 1.5 ], [ TOP.fleeceRed, 3 ], [ TOP.hoodieWhite, 2 ], [ TOP.camo, 1 ],
	[ TOP.flyers, 1 ], [ TOP.coatCamel, 2 ], [ TOP.raysJersey, 0.6 ], [ TOP.raysTee, 0.4 ],
];
// the names on the backs, by how many you'd see
const NAMES = [
	[ CELL.UTLEY, 16 ], [ CELL.HOWARD, 12 ], [ CELL.ROLLINS, 11 ], [ CELL.HAMELS, 9 ], [ CELL.BURRELL, 5 ], [ CELL.VICTORINO, 6 ],
	[ CELL.WERTH, 3 ], [ CELL.LIDGE, 4 ], [ CELL.MYERS, 2 ], [ CELL.MOYER, 3 ], [ CELL.RUIZ, 2 ], [ CELL.FELIZ, 1 ], [ CELL.JENKINS, 1 ],
	[ CELL.COSTE, 1.5 ], [ CELL.SCHMIDT, 3 ], [ CELL.CARLTON, 1 ], [ CELL.ROSE, 0.7 ], [ CELL.DYKSTRA, 0.7 ], [ CELL.KRUK, 0.6 ],
	[ CELL.DAULTON, 0.6 ], [ CELL.LUZINSKI, 0.4 ], [ CELL.ASHBURN, 0.5 ],
];
const LEGENDS = [ [ CELL.SCHMIDT, 5 ], [ CELL.CARLTON, 3 ], [ CELL.LUZINSKI, 1 ], [ CELL.ROSE, 1 ] ];
const RAYS = [ [ CELL.LONGORIA, 3 ], [ CELL.UPTON, 2 ] ];

// A fan's look and props for the night (w: night() of Night.js). opts.kid, opts.woman force those.
export function dress( r, w, opts = {} ) {

	const kid = opts.kid ?? r() < 0.07;
	const woman = opts.woman ?? ( ! kid && r() < 0.36 );
	let top = opts.top ?? pick( r, TOPS );
	if ( kid && r() < 0.5 ) top = pick( r, [ [ TOP.jerseyHome, 3 ], [ TOP.hoodieRed, 3 ], [ TOP.jerseyRed, 2 ] ] );
	let cell = 0;
	if ( top === TOP.powderBlue ) cell = pick( r, LEGENDS );
	else if ( top === TOP.raysJersey ) cell = pick( r, RAYS );
	else cell = pick( r, NAMES );
	const pants = pick( r, [ [ PANTS.jeans, 10 ], [ PANTS.darkJeans, 6 ], [ PANTS.khaki, 2 ], [ PANTS.black, 2 ], [ PANTS.sweats, 1 ], [ PANTS.camo, 0.3 ] ] );
	const skin = pick( r, [ [ 0, 60 ], [ 1, 18 ], [ 2, 13 ], [ 3, 9 ] ] );
	const hair = woman ? pick( r, [ [ 0, 3 ], [ 1, 4 ], [ 2, 3 ] ] ) : pick( r, [ [ 0, 4 ], [ 1, 4 ], [ 2, 1 ], [ 3, kid ? 0 : 2 ] ] );
	const beard = ! woman && ! kid && r() < 0.28 ? 1 : 0;
	const glasses = r() < 0.18 ? 1 : 0;
	const props = [];
	let head = HEAD.bare;
	const rainy = w.first && w.rain > 0.2;
	if ( rainy ) {

		// the rain: an umbrella for a third of them and more as it gets worse, ponchos, hoods up, caps
		const u = r();
		const pU = 0.3 + 0.15 * w.k, pP = 0.2, pH = 0.18;
		if ( u < pU ) {

			props.push( 'umbrella' );
			head = pick( r, [ [ HEAD.bare, 4 ], [ HEAD.capRed, 4 ], [ HEAD.capNavy, 1 ], [ HEAD.beanieRed, 1 ] ] );

		} else if ( u < pU + pP ) {

			props.push( 'poncho', 'hood' );
			head = HEAD.hood;

		} else if ( u < pU + pP + pH && top !== TOP.jerseyHome && top !== TOP.powderBlue && top !== TOP.jerseyRoad && top !== TOP.raysJersey ) {

			props.push( 'hood' );
			head = HEAD.hood;

		} else head = pick( r, [ [ HEAD.capRed, 6 ], [ HEAD.capNavy, 1 ], [ HEAD.capWhite, 0.5 ], [ HEAD.beanieRed, 1 ], [ HEAD.beanieGrey, 1 ] ] );

	} else {

		// the 29th: cold, the wind off the lots
		const u = r();
		if ( u < 0.32 ) head = pick( r, [ [ HEAD.beanieRed, 3 ], [ HEAD.beanieGrey, 2 ] ] );
		else if ( u < 0.46 && top !== TOP.jerseyHome && top !== TOP.powderBlue && top !== TOP.jerseyRoad ) {

			props.push( 'hood' );
			head = HEAD.hood;

		} else if ( u < 0.86 ) head = pick( r, [ [ HEAD.capRed, 6 ], [ HEAD.capNavy, 1 ], [ HEAD.capWhite, 0.5 ] ] );

	}

	if ( head === HEAD.capRed || head === HEAD.capNavy || head === HEAD.capWhite ) props.push( 'brim' );
	if ( head === HEAD.beanieRed && r() < 0.6 ) props.push( 'pom' );
	if ( woman && head !== HEAD.hood && r() < 0.7 ) props.push( 'hair' );
	if ( ! kid && r() < 0.14 ) props.push( r() < 0.6 ? 'bag' : 'backpack' );
	if ( kid && r() < 0.5 ) props.push( 'glove' );
	const scale = kid ? 0.58 + r() * 0.17 : woman ? 0.9 + r() * 0.07 : 0.96 + r() * 0.1;
	const look = packLook( { top, cell, pants, head, skin, hair, beard, glasses, kid: kid ? 1 : 0, woman: woman ? 1 : 0 } );
	return { look, props: propBits( props ), scale, kid, woman, list: props, top };

}

// staff and uniforms
export function uniform( kind, r, extra = [] ) {

	const skin = pick( r, [ [ 0, 55 ], [ 1, 17 ], [ 2, 16 ], [ 3, 12 ] ] );
	const woman = r() < ( kind === 'police' || kind === 'trooper' ? 0.15 : 0.35 );
	const hair = pick( r, [ [ 0, 4 ], [ 1, 3 ], [ 2, 1 ], [ 3, 2 ] ] );
	const base = { skin, hair, woman: woman ? 1 : 0, glasses: r() < 0.15 ? 1 : 0, beard: ! woman && r() < 0.15 ? 1 : 0 };
	const props = [ ...extra ];
	let look;
	switch ( kind ) {

		case 'usher': look = packLook( { ...base, top: TOP.usher, pants: PANTS.khaki, head: HEAD.capNavy } ); props.push( 'brim', 'badge' ); break;
		case 'security': look = packLook( { ...base, top: TOP.security, pants: PANTS.black, head: r() < 0.5 ? HEAD.bare : HEAD.beanieGrey } ); props.push( 'radio' ); break;
		case 'police': look = packLook( { ...base, top: TOP.police, pants: PANTS.navy, head: HEAD.uniform } ); props.push( 'brim', 'radio' ); break;
		case 'trooper': look = packLook( { ...base, top: TOP.trooper, pants: PANTS.uniformGrey, head: HEAD.uniform } ); props.push( 'brim' ); break;
		case 'vendor': look = packLook( { ...base, top: TOP.vendor, pants: PANTS.jeans, head: r() < 0.5 ? HEAD.capRed : HEAD.beanieGrey } ); break;
		case 'reporter': look = packLook( { ...base, woman: 1, top: TOP.reporter, pants: PANTS.black, head: HEAD.bare, hair: 1 } ); props.push( 'hair' ); break;
		case 'crew': look = packLook( { ...base, top: TOP.crew, pants: PANTS.darkJeans, head: HEAD.capNavy } ); props.push( 'brim' ); break;
		case 'bouncer': look = packLook( { ...base, woman: 0, top: TOP.bouncer, pants: PANTS.black, head: HEAD.bare } ); break;
		case 'store': look = packLook( { ...base, top: TOP.storeStaff, pants: PANTS.khaki, head: HEAD.capRed } ); props.push( 'brim', 'badge' ); break;
		default: look = packLook( base );

	}

	if ( base.woman && ! props.includes( 'brim' ) && kind !== 'reporter' ) props.push( 'hair' );
	return { look, props: propBits( props ), scale: base.woman ? 0.93 : 0.98 + r() * 0.08, list: props };

}
