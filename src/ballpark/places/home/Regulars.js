import { TOP, COLOR, HAT, BACK, CHEST, PROP } from '../Cast.js';
import { SEATED, handsOf } from './Poses.js';
import { SIGN } from './Signs.js';
import { hash, fract } from './Fans.js';

// The people behind home plate with names (the one register: .claude/wave2/CAST.md). Invented, every
// one, and all Phillies fans; their stories show in what they wear, hold and do, and in how they take
// the night. Each is seated by row (0 = the front) and by where along it (x, metres from behind the
// plate: + toward first); the TV sees the front rows either side of the umpire.
//
// Enza Palumbo, 68, Packer Park: in the front row just to the first base side of the plate, in her late
//   husband Carmine's 1980 maroon cap, keeping score in pencil the way he did. At the last out she
//   stands with her hands at her mouth, then looks up.
// Harold Wexler, 74, Elkins Park, a retired dentist: the same club seats since the park opened, thirty
//   years at the Vet before that; his satin jacket from 1980. His son Mark, 45, flew in from Denver.
//   Harold explains the Series to him inning by inning; at the last out Mark holds him.
// Maureen Kelly, 47, Roxborough: on her flip phone to her mother in Boca Raton, waving at the center
//   field camera ("Ma, behind the umpire, the red coat").
// Dom Russo, 36, Bridesburg, a union carpenter: a new hand-lettered sign for the camera every few
//   innings, held up between pitches when the Phillies are in the field.
// Andre and Simone Baptiste, West Oak Lane: married September 20th, the honeymoon put off; on the 29th
//   one blanket for the two of them; Simone texting her sister.
// Bobby Cusack, 45, Oxford Circle: rides the plate umpire on the called strikes.
// The Costellos from Glenside, their first Series: Paul, Theresa, Matty (10, his glove, HOWARD 6) and
//   Gianna (7). The Villanova four behind them: Sean Gallagher, Pete Kostic, Mo Rahman, Rick Albrecht.

// a look: the defaults, then what's given
const look = ( o ) => ( {
	skin: 1, hair: 1, hairStyle: 0, facial: 0, glasses: false, female: false, age: 0, build: 1,
	top: TOP.jacket, color: COLOR.red, sleeves: COLOR.red, back: 0, chest: 0,
	pants: 0, shoes: 0, hat: HAT.none, poncho: 0, scarf: 0, gloves: false, lanyard: false, seed: 0, ...o,
} );
const both = ( base, wet = {}, dry = {} ) => ( { 27: look( { ...base, ...wet } ), 29: look( { ...base, ...dry } ), base: look( base ) } );

// the seat in `row` nearest x (whichever of the club's sections)
function seatAt( seats, row, x ) {

	return seats.nearest( row, x );

}

export function seatRegulars( place ) {

	const S = place.seats, sit = place.sit;
	const R = place.regulars = {};
	const seat = ( row, x ) => seatAt( S, row, x );

	// ---- Enza, front row, just first base side of the plate
	R.enza = sit( seat( 0, 2.3 ), {
		name: 'Enza Palumbo', scale: 0.9,
		looks: both( { female: true, age: 1, skin: 0, hair: 7, hairStyle: 2, glasses: true, build: 1, top: TOP.jacket, color: COLOR.red, hat: HAT.cap1980, lanyard: true, pants: 5, shoes: 1, seed: 1101 },
			{ poncho: 1 }, { scarf: 1, gloves: true } ),
		kit: { idle: { score: 8, watch: 2, warm: 1 }, drink: PROP.cocoa, towel: false, camera: false, blanket: 'plaid' },
		traits: { stand: 0.55, cheer: 0.8, clap: 0.2, towel: 1 },
	} );
	if ( R.enza ) R.enza.script = ( f, N ) => {

		// she writes every play down as it ends
		if ( N.kind === 'result' && N.lt < 4 ) f.act( 'score', 0.3, { key: 'write', propL: PROP.scorebook, propR: PROP.pencil, head: [ 0, 0.6 ] } );
		// the last out: hands to her mouth, then her eyes up
		if ( N.celebrate ) {

			if ( N.celT < 6 ) f.act( 'pray', 0.3, { key: 'cel', propL: 0, propR: 0 } );
			else if ( N.celT < 12 ) f.act( 'pray', 0.3, { key: 'cel', propL: 0, propR: 0, head: [ 0, - 0.45 ] } );

		}

	};

	// ---- Harold and Mark, row 2 on the third base side of the plate
	R.harold = sit( seat( 1, - 4.2 ), {
		name: 'Harold Wexler',
		looks: both( { age: 1, skin: 0, hair: 7, hairStyle: 3, glasses: true, build: 3, top: TOP.satin, color: COLOR.red, lanyard: true, pants: 2, shoes: 3, seed: 1102 },
			{ poncho: 1, hat: HAT.capRed }, { hat: HAT.knitGrey, scarf: 2, gloves: true } ),
		kit: { idle: { watch: 4, talk: 5, fold: 2, cup: 1 }, drink: PROP.cocoa, towel: true, camera: false, blanket: 'navy' },
		traits: { stand: 0.5, cheer: 0.7 },
	} );
	R.mark = sit( seat( 1, - 3.7 ), {
		name: 'Mark Wexler',
		looks: both( { age: 0, skin: 0, hair: 2, glasses: false, facial: 4, build: 1, top: TOP.fleece, color: COLOR.navy, chest: CHEST.script, lanyard: true, pants: 1, shoes: 0, seed: 1103 },
			{ poncho: 4, hat: HAT.hood }, { hat: HAT.capRed, gloves: true } ),
		kit: { idle: { watch: 4, talk: 3, cup: 3, text: 1 }, drink: PROP.beer, towel: true, camera: true },
	} );
	if ( R.harold && R.mark ) {

		// Harold talks, turned to his son, a hand going; Mark listens
		R.harold.script = ( f, N ) => {

			if ( N.between ) f.act( 'point', 0.3, { key: 'tell', head: [ 0.7, 0.1 ], mouth: 0.3 + 0.3 * Math.max( 0, Math.sin( N.t * 6 ) ) } );
			if ( N.celebrate && N.celT > 3 ) f.act( 'head', 0.3, { key: 'cel', up: 1, head: [ 0, 0.3 ] } );

		};
		R.mark.script = ( f, N ) => {

			if ( N.between ) f.act( 'lap', 0.3, { key: 'listen', head: [ - 0.7, 0.15 ] } );
			if ( N.celebrate && N.celT > 3 ) f.act( SEATED.hugL, 0.3, { key: 'cel', up: 1, head: [ - 0.8, 0.2 ] } );

		};

	}

	// ---- Maureen, row 3 on the third base side, on the phone to Boca
	R.maureen = sit( seat( 2, - 2.4 ), {
		name: 'Maureen Kelly',
		looks: both( { female: true, age: 0, skin: 0, hair: 5, hairStyle: 1, build: 1, top: TOP.fleece, color: COLOR.red, lanyard: true, pants: 3, shoes: 1, seed: 1104 },
			{ poncho: 2 }, { hat: HAT.knitRed, scarf: 1 } ),
		kit: { idle: { watch: 3, cup: 2, text: 2, talk: 2 }, drink: PROP.soda, towel: true, camera: true },
	} );
	if ( R.maureen ) R.maureen.script = ( f, N ) => {

		// every few minutes a call, and while the camera's on the plate a wave to center field
		const w = fract( N.t / 290 + 0.3 );
		if ( w < 0.14 ) {

			const waving = N.pitching && N.lt < 3;
			f.act( waving ? [ SEATED.wave[ 1 ], SEATED.phone[ 1 ] ] : SEATED.phone, 0.3, { key: 'call', propR: PROP.phone, propL: 0, mouth: 0.25 + 0.2 * Math.sin( N.t * 7 ), head: [ 0, - 0.02 ] } );

		}

	};

	// ---- Dom and his signs, row 6 behind the plate on the third base side
	R.dom = sit( seat( 5, - 3.3 ), {
		name: 'Dom Russo',
		looks: both( { age: 0, skin: 1, hair: 0, facial: 2, build: 3, top: TOP.hoodie, color: COLOR.red, chest: CHEST.block, pants: 0, shoes: 2, seed: 1105 },
			{ poncho: 6, hat: HAT.hood }, { hat: HAT.knitBlack, gloves: true } ),
		kit: { idle: { watch: 4, cup: 3, talk: 1 }, drink: PROP.beer, towel: true, camera: false },
		traits: { stand: 0.25, cheer: 0.3 },
	} );
	if ( R.dom ) {

		signer( R.dom, domSign, place );
		// held up high: now and then somebody behind has had enough
		const sig = R.dom.script;
		R.dom.script = ( f, N, dt ) => {

			const was = f.sign?.up;
			sig( f, N, dt );
			if ( f.sign?.up && ! was && hash( N.t * 0.7 ) < 0.3 ) place.sound?.at( 'down', { x: f.seat.x + f.seat.nx * 1.6, y: f.seat.y + 0.4, z: f.seat.z + f.seat.nz * 1.6 }, { vol: 0.7 } );

		};

	}

	// ---- the Baptistes, row 8 first base side
	R.andre = sit( seat( 7, 4.6 ), {
		name: 'Andre Baptiste',
		looks: both( { age: 0, skin: 5, hair: 0, facial: 4, build: 2, top: TOP.leather, color: COLOR.black, pants: 1, shoes: 1, seed: 1106 },
			{ poncho: 1, hat: HAT.capRed }, { hat: HAT.capRed, scarf: 3, gloves: true } ),
		kit: { idle: { watch: 4, cup: 2, talk: 3 }, drink: PROP.beer, towel: true, camera: false, blanket: 'shared' },
		traits: { stand: 0.35, cheer: 0.4 },
	} );
	R.simone = sit( seat( 7, 4.1 ), {
		name: 'Simone Baptiste',
		looks: both( { female: true, age: 0, skin: 4, hair: 0, hairStyle: 2, build: 0, top: TOP.puffer, color: COLOR.red, pants: 3, shoes: 1, seed: 1107 },
			{ poncho: 1, hat: HAT.hood }, { hat: HAT.knitRed, gloves: true } ),
		kit: { idle: { watch: 3, text: 3, talk: 3, cup: 1 }, drink: PROP.cocoa, towel: true, camera: true },
		traits: { stand: 0.3, cheer: 0.35 },
	} );
	if ( R.simone ) R.simone.script = ( f, N ) => {

		// her sister texts that she's on TV: she waves at center field
		const w = fract( N.t / 410 + 0.61 );
		if ( w < 0.05 ) f.act( 'wave', 0.3, { key: 'tv', propR: 0, head: [ 0, 0 ], mouth: 0.4 } );
		if ( N.celebrate && N.celT > 2 && N.celT < 12 ) f.act( 'hugR', 0.3, { key: 'cel', up: 1, propR: 0, propL: 0, head: [ 0.7, 0.2 ] } );

	};
	if ( R.andre ) R.andre.script = ( f, N ) => {

		if ( N.celebrate && N.celT > 2 && N.celT < 12 ) f.act( SEATED.hugL, 0.3, { key: 'cel', up: 1, propR: 0, propL: 0, head: [ - 0.7, 0.2 ] } );

	};

	// ---- Bobby, row 12 behind the plate: on the umpire
	R.bobby = sit( seat( 11, 1.2 ), {
		name: 'Bobby Cusack',
		looks: both( { age: 0, skin: 0, hair: 1, facial: 1, build: 3, top: TOP.homeJersey, color: COLOR.white, back: BACK.BURRELL, chest: CHEST.script, sleeves: COLOR.grey, pants: 0, shoes: 0, seed: 1108 },
			{ poncho: 1, hat: HAT.capRed }, { hat: HAT.capBack, sleeves: COLOR.red } ),
		kit: { idle: { watch: 3, cup: 4, talk: 2 }, drink: PROP.beer, towel: true, camera: false },
		traits: { stand: 0.2, cheer: 0.25 },
	} );
	if ( R.bobby ) R.bobby.script = ( f, N ) => {

		// a called strike on a Phillie, or ball four not given: up, pointing, yelling
		const e = N.seg?.ev;
		if ( N.pitching && N.half === 'bottom' && e?.call === 'C' && N.lt > 2.6 && N.lt < 6 ) f.act( 'point', 0.3, { key: 'ump', up: 0.8, propR: 0, mouth: 0.9 } );

	};

	// ---- the Costellos, row 23 behind the plate
	const cx = - 0.5;
	R.paul = sit( seat( 22, cx - 0.75 ), {
		name: 'Paul Costello',
		looks: both( { age: 0, skin: 1, hair: 1, glasses: true, build: 1, top: TOP.champsTee, color: COLOR.grey, chest: CHEST.champs, sleeves: COLOR.navy, pants: 2, shoes: 0, seed: 1109 },
			{ poncho: 1, hat: HAT.capRed }, { top: TOP.jacket, color: COLOR.red, chest: 0, hat: HAT.capRed } ),
		kit: { idle: { watch: 4, cup: 2, talk: 2, read: 1 }, drink: PROP.beer, towel: true, camera: true },
	} );
	R.theresa = sit( seat( 22, cx - 0.25 ), {
		name: 'Theresa Costello',
		looks: both( { female: true, age: 0, skin: 0, hair: 3, hairStyle: 1, build: 1, top: TOP.jacket, color: COLOR.red, pants: 0, shoes: 1, seed: 1110 },
			{ poncho: 1, hat: HAT.hood }, { hat: HAT.knitRed, scarf: 2 } ),
		kit: { idle: { watch: 3, text: 1, talk: 3, cup: 1 }, drink: PROP.cocoa, towel: true, camera: true },
	} );
	R.matty = sit( seat( 22, cx + 0.25 ), {
		name: 'Matty Costello', scale: 0.66,
		looks: both( { age: 2, skin: 1, hair: 2, build: 0, top: TOP.nameTee, color: COLOR.red, back: BACK.HOWARD, sleeves: COLOR.grey, pants: 0, shoes: 0, hat: HAT.capRed, seed: 1111 },
			{ poncho: 4 }, { sleeves: COLOR.grey } ),
		kit: { idle: { watch: 5, knees: 2, eat: 1 }, drink: PROP.soda, towel: true, camera: false, glove: true },
		traits: { stand: 0.15, cheer: 0.2 },
	} );
	R.gianna = sit( seat( 22, cx + 0.75 ), {
		name: 'Gianna Costello', scale: 0.58,
		looks: both( { female: true, age: 2, skin: 1, hair: 2, hairStyle: 2, build: 0, top: TOP.puffer, color: COLOR.red, pants: 4, shoes: 0, seed: 1112 },
			{ poncho: 4, hat: HAT.hood }, { hat: HAT.earmuffs } ),
		kit: { idle: { watch: 3, knees: 3, eat: 1 }, drink: PROP.soda, towel: true, camera: false },
		traits: { stand: 0.35, cheer: 0.3 },
	} );
	if ( R.gianna ) R.gianna.script = ( f, N ) => {

		// every few innings she spots herself on the concourse TVs' feed: up on her seat, both hands
		// waving at center field ("Mom! We're on TV!")
		const w = fract( N.t / 530 + 0.42 );
		if ( N.pitching && w < 0.016 ) {

			if ( ! f._tv ) place.sound?.at( 'kidTV', f.p, { h: 1.0, vol: 0.8 } );
			f._tv = true;
			f.act( 'waveBoth', 0.3, { key: 'tv', up: 1, onSeat: true, y: 0.43, mouth: 0.8, head: [ 0, - 0.1 ] } );

		} else f._tv = false;

	};
	if ( R.matty ) R.matty.script = ( f, N ) => {

		// the big moments: up on his seat to see over the grown-ups
		if ( N.mood.stand > 0.6 || N.celebrate ) f.act( undefined, 0.3, { key: 'onSeat', up: 1, y: 0.43 } );

	};

	// ---- the Pisanos, row 13 in D by its first base side aisle, late on the 27th (Aisles: down the
	// aisle in the 2nd)
	const row12 = S.fromAisle( 'ED', 12, 1 );
	R.gary = sit( row12[ 2 ], {
		name: 'Gary Pisano',
		looks: both( { age: 0, skin: 0, hair: 6, facial: 4, build: 3, top: TOP.eagles, color: COLOR.green, chest: CHEST.eagles, pants: 0, shoes: 3, hat: HAT.capRed, seed: 1117 },
			{}, { top: TOP.jacket, color: COLOR.red, chest: 0, hat: HAT.knitRed, gloves: true } ),
		kit: { idle: { watch: 4, cup: 3, talk: 2, fold: 1 }, drink: PROP.beer, towel: true, camera: false },
	} );
	R.lorraine = sit( row12[ 1 ], {
		name: 'Lorraine Pisano',
		looks: both( { female: true, age: 0, skin: 0, hair: 4, hairStyle: 1, build: 1, top: TOP.jacket, color: COLOR.red, pants: 3, shoes: 1, hat: HAT.hood, seed: 1118 },
			{}, { hat: HAT.knitRed, scarf: 1 } ),
		kit: { idle: { watch: 3, cocoa: 0, warm: 3, talk: 2 }, drink: PROP.cocoa, towel: true, camera: true },
	} );
	for ( const f of [ R.gary, R.lorraine ] ) if ( f ) f.script = ( q, N ) => {

		if ( N.first && N.inning < 2 ) q.arrived = false;
		if ( ! N.first || N.inning > 2 || ( N.inning === 2 && N.half === 'bottom' ) ) q.arrived = true;
		q.away = ! q.arrived && ! q.driven;

	};

	// ---- the Villanova four, row 25
	const vx = - 0.2, V = [ [ 'Sean Gallagher', 1113, BACK.HAMELS ], [ 'Pete Kostic', 1114, BACK.UTLEY ], [ 'Mo Rahman', 1115, 0 ], [ 'Rick Albrecht', 1116, BACK.WERTH ] ];
	R.villanova = V.map( ( [ name, seed, back ], k ) => sit( seat( 24, vx + ( k - 1.5 ) * 0.5 ), {
		name,
		looks: both( { age: 3, skin: k === 2 ? 3 : k === 3 ? 0 : 1, hair: k, facial: k === 3 ? 4 : 0, build: k === 1 ? 2 : 0,
			top: back ? TOP.homeJersey : TOP.hoodie, color: back ? COLOR.white : COLOR.navy, back, chest: back ? CHEST.script : CHEST.block, sleeves: k === 1 ? COLOR.black : COLOR.grey,
			pants: k % 2, shoes: 0, hat: k === 0 ? HAT.capBack : HAT.capRed, seed },
		{ poncho: k === 3 ? 6 : 1 }, { hat: k === 0 ? HAT.knitRed : k === 2 ? HAT.knitPlain : HAT.capRed } ),
		kit: { idle: { watch: 3, cup: 4, talk: 3, text: 1 }, drink: PROP.beer, towel: true, camera: k === 1 },
		traits: { stand: 0.05 + 0.08 * k, cheer: 0.1 + 0.05 * k, towel: 0.05 },
	} ) );

	// ---- the others' signs (the documented words where the photos give them)
	const V4 = R.villanova || [];
	const sgn = ( f, pick ) => f && signer( f, pick, place );
	sgn( V4[ 3 ], ( N ) => N.first ? SIGN[ 'PHILS IN PHIVE' ] : N.celebrate ? SIGN[ 'PHINALLY! 1980-2008' ] : N.inning >= 7 ? SIGN[ 'IT ENDS TONIGHT' ] : null );
	sgn( V4[ 2 ], ( N ) => N.celebrate ? SIGN[ 'YO ADRIAN WE DID IT!!' ] : ! N.first && N.inning >= 8 ? SIGN[ 'RAYS RAYS GO AWAY' ] : null );
	sgn( R.bobby, ( N ) => N.first ? null : N.celebrate ? SIGN[ 'WE ARE WORLD CHAMPIONS!' ] : SIGN[ "28 YEARS... WHAT'S ANOTHER DAY?" ] );
	sgn( R.matty, ( N ) => ! N.first && N.inning >= 9 && ! N.celebrate ? SIGN[ 'DUE UP: 1 GAME 5 1/2 2 WORLD CHAMPS! 3 BROAD ST. PARADE' ] : null );
	sgn( R.harold, ( N ) => N.celebrate && N.celT > 8 ? SIGN[ 'PHINALLY! 1980-2008' ] : null );
	sgn( R.maureen, ( N ) => N.first && N.inning >= 3 && N.inning <= 4 ? SIGN[ 'HI MOM IN BOCA!' ] : null );
	// and a few of the club's own: the FOX one for the camera, the Phinale, Red October
	const club = place.fans.list.filter( ( f ) => ! f.name && f.seat.row >= 2 && f.seat.row <= 4 && Math.abs( f.seat.x ) < 4 );
	const pickClub = ( k ) => club[ Math.floor( k * 7.3 ) % Math.max( 1, club.length ) ];
	sgn( pickClub( 1 ), ( N ) => ! N.first && N.inning >= 7 && N.inning <= 9 ? SIGN[ 'FOX 9 MORE OUTS' ] : null );
	sgn( pickClub( 2 ), ( N ) => ! N.first ? SIGN[ 'PHABULOUS PHILLIES PHINALE' ] : null );
	sgn( pickClub( 3 ), ( N ) => N.first && N.inning >= 4 ? SIGN[ 'PHINALLY' ] : ! N.first ? SIGN[ 'RED OCTOBER' ] : null );
	return R;

}

// which of Dom's signs, now (SIGNS' cells), or none
function domSign( N ) {

	if ( N.celebrate ) return SIGN[ 'WORLD CHAMPS!' ];
	if ( N.first ) {

		if ( N.inning <= 2 ) return SIGN[ "RAIN? WE'RE FROM PHILLY" ];
		if ( N.inning <= 4 ) return SIGN[ 'PHILS IN PHIVE' ];
		return SIGN[ 'WE BELIEVE' ];

	}

	if ( N.inning <= 6 ) return SIGN[ 'SUSPENDED... NOT DEFEATED' ];
	if ( N.inning <= 8 ) return SIGN[ 'LIGHTS OUT LIDGE' ];
	const outs = N.snap?.outs || 0;
	return [ SIGN[ '3 MORE OUTS' ], SIGN[ '2 MORE OUTS' ], SIGN[ '1 MORE OUT!!' ] ][ Math.min( 2, outs ) ];

}

// A sign held by f: pick( N ) -> a cell or null; up for the camera between pitches when the Phillies are
// in the field, for the big moments and the last out, else resting on the knees
export function signer( f, pick, place ) {

	const prev = f.script;
	f.script = ( q, N, dt ) => {

		prev?.( q, N, dt );
		const cell = pick( N );
		const up = cell !== null && ( N.celebrate || N.between || ( N.half === 'top' && N.pitching && N.lt < 2.6 ) || N.mood.stand > 0.5 );
		q.sign = cell === null ? null : { cell, up };
		if ( cell !== null ) q.act( up ? 'sign' : 'signLow', 0.3, { key: 'sign', propL: 0, propR: 0 } );

	};

}

// the signs of everyone holding one this frame, onto the boards (the hands found by the rig's own
// kinematics); the boards face center field
export function holdSigns( place ) {

	let i = 0;
	for ( const f of place.fans.list ) {

		if ( ! f.sign || f.away ) continue;
		const [ hl, hr ] = handsOf( f.p );
		const face = [ - f.seat.nx, - f.seat.nz ];
		place.signs.show( i ++, f.sign.cell, hl, hr, face, f.sign.up ? 0.12 : 0.9 );
		if ( i >= place.signs.max ) break;

	}

	for ( ; i < place.signs.max; i ++ ) place.signs.hide( i );
	place.signs.update();

}

export { hash };
