import { TOP, COLOR, HAT, BACK, CHEST } from '../Cast.js';
import { dress, pick } from '../Concourse3BKit.js';

// How the people behind home plate dress, the same person on both nights: the Phillies' red above all,
// a jacket or a hoodie or the home whites with a name and number; on the 27th, 47 °F in a driving rain,
// a poncho over it (the Getty frames of the 27th behind the plates and dugouts: clear plastic most of all,
// then the yellow ones everywhere, red, white, orange, a trash bag), hoods up; on the 29th, cold and
// windy and dry, the same lucky jersey under more: a knit hat, a scarf, gloves, a puffer.
//
// The Diamond Club's front rows (heston's photos of Games 3 and 4): an older crowd, Phillies jackets and
// grey Phillies hoodies and crewnecks, the home whites, a powder blue jacket or two, a pink cap on a few
// of the women; fewer kids.

// r: a seeded random; o: { club (the Diamond Club), age, female, top, hat, kid }
export function dressBoth( r, o = {} ) {

	const base = dress( r, { age: o.age, female: o.female, top: o.top, hat: o.hat } );
	if ( o.club && base.age === 3 && r() < 0.6 ) base.age = 0;
	if ( o.club && base.age === 0 && r() < 0.18 ) {

		base.age = 1;
		base.hair = Number( pick( r, { 6: 5, 7: 4, 2: 1 } ) );
		base.glasses = r() < 0.5;

	}

	// the Diamond Club's grey Phillies crewnecks and hoodies, and the red jackets
	if ( o.club && ! o.top && r() < 0.25 ) {

		base.top = r() < 0.5 ? TOP.hoodie : TOP.fleece;
		base.color = r() < 0.6 ? COLOR.grey : COLOR.lightGrey;
		base.chest = CHEST.script;

	}

	// the club's ticket on a lanyard round the neck, most of them
	base.lanyard = !! o.club && r() < 0.85;
	// the 27th: a poncho for most in the open rows, the hood up
	const wet = { ...base };
	if ( o.poncho !== 0 && r() < ( o.ponchoOdds ?? 0.58 ) ) {

		wet.poncho = o.poncho || Number( pick( r, { 1: 44, 4: 22, 2: 12, 3: 8, 5: 6, 6: 5 } ) );
		if ( ( wet.hat === HAT.none || wet.hat === HAT.capBack ) && r() < 0.7 ) wet.hat = HAT.hood;

	} else if ( ( base.top === TOP.hoodie || base.top === TOP.puffer || base.top === TOP.fleece ) && r() < 0.6 ) wet.hat = HAT.hood;

	// the 29th: dry and colder, with the wind: knit hats, scarves, gloves, another layer
	const dry = { ...base, poncho: 0 };
	if ( dry.hat !== HAT.cap1980 && dry.hat !== HAT.capRays && r() < 0.45 ) dry.hat = Number( pick( r, { [ HAT.knitRed ]: 6, [ HAT.knitGrey ]: 2, [ HAT.knitBlack ]: 3, [ HAT.knitPlain ]: 2, [ HAT.earmuffs ]: dry.female ? 1 : 0 } ) );
	if ( ! dry.scarf && r() < 0.3 ) dry.scarf = Number( pick( r, { 1: 5, 2: 3, 3: 2 } ) );
	if ( ! dry.gloves && r() < 0.35 ) dry.gloves = true;
	// a jersey or a tee goes over a hoodie (the sleeves), a light jacket becomes a puffer
	if ( ( dry.top === TOP.homeJersey || dry.top === TOP.nameTee ) && r() < 0.5 ) dry.sleeves = r() < 0.5 ? COLOR.grey : COLOR.red;
	if ( dry.top === TOP.satin && r() < 0.3 ) Object.assign( dry, { top: TOP.puffer, color: COLOR.black } );
	return { 27: wet, 29: dry, base };

}

// a Rays fan's family (the visitors' guests): navy and Columbia blue, the Rays' caps
export function dressRays( r, o = {} ) {

	const base = dress( r, { age: o.age, female: o.female, top: 'rays' } );
	base.hat = r() < 0.5 ? HAT.capRays : HAT.none;
	base.back = r() < 0.5 ? BACK.LONGORIA : BACK.CRAWFORD;
	const wet = { ...base, poncho: r() < 0.7 ? 1 : 0 };
	const dry = { ...base, poncho: 0, scarf: r() < 0.3 ? 2 : 0, gloves: r() < 0.4 };
	return { 27: wet, 29: dry, base };

}
