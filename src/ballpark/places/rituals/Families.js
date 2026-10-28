import { Cast, TOP, COLOR, HAT, restPose } from '../Cast.js';
import { armIK } from '../Concourse3BKit.js';
import { moundY } from '../../game/TarpPlan.js';

// ---- FR1: the families on the field (wave 3's R.md, the celebration's small true things). Once the
// presentation was over the players' wives and kids came down out of the Phillies' dugout onto the grass
// (johnpaulendicott 3001393534, ~10:52 pm: a player in the grey tee with two small children; Getty
// 83486425: a player and his little boy tossing a ball; 83571213: Moyer kneeling with the rubber, his wife
// and several of the kids in World Series and champions gear round him; 83486297: a wife in a knitted
// scarf). Cast figures out of the dugout to their man, wherever he is on the field, and round him. Private
// people: nobody's named, and the looks are plain ones (CAST.md).

const DUGOUT_STEP = [ 21.6, - 4.2 ];
// [ look, scale, whose (the rig's id), where by him ( to his right, in front of him ), out at (s after the
// last out) ]
const KID = { age: 2, female: false, hair: 1, hairStyle: 0, facial: 0, glasses: false, build: 0, pants: 1, shoes: 0, gloves: false };
const FAMILIES = [
	// Moyer's, round him at the rubber
	[ { skin: 0, hair: 2, hairStyle: 1, facial: 0, glasses: false, female: true, age: 0, build: 0, top: TOP.puffer, color: COLOR.black, sleeves: COLOR.black, pants: 1, shoes: 1, hat: HAT.capWS, scarf: 2, gloves: true, seed: 401 }, 1, 'r:moyer', [ - 0.85, 0.45 ], 222 ],
	[ { ...KID, skin: 0, hair: 2, top: TOP.champsTee, color: COLOR.grey, sleeves: COLOR.red, hat: HAT.capBlack, seed: 402 }, 0.8, 'r:moyer', [ 0.8, 0.55 ], 222.6 ],
	[ { ...KID, skin: 0, hair: 1, top: TOP.hoodie, color: COLOR.red, sleeves: COLOR.red, hat: HAT.capWS, seed: 403 }, 0.66, 'r:moyer', [ 0.35, 1.05 ], 223.2 ],
	[ { ...KID, skin: 0, hair: 2, top: TOP.homeJersey, color: COLOR.white, sleeves: COLOR.red, hat: HAT.capRed, seed: 404 }, 0.74, 'r:moyer', [ - 0.4, 1.15 ], 223.8 ],
	// a wife in a knitted scarf and their little boy, by Bruntlett in the crowd before the stage
	[ { skin: 0, hair: 3, hairStyle: 1, facial: 0, glasses: false, female: true, age: 0, build: 0, top: TOP.coat, color: COLOR.cream, sleeves: COLOR.cream, pants: 1, shoes: 1, hat: HAT.none, scarf: 2, gloves: true, seed: 405 }, 0.97, 429731, [ 0.7, 0.4 ], 214 ],
	[ { ...KID, skin: 0, hair: 0, top: TOP.hoodie, color: COLOR.red, sleeves: COLOR.red, hat: HAT.capRed, seed: 406 }, 0.58, 429731, [ - 0.55, 0.6 ], 214.5 ],
	// another young family, with Eyre
	[ { skin: 1, hair: 0, hairStyle: 2, facial: 0, glasses: false, female: true, age: 0, build: 1, top: TOP.puffer, color: COLOR.red, sleeves: COLOR.red, pants: 3, shoes: 1, hat: HAT.knitRed, scarf: 0, gloves: true, seed: 407 }, 1, 113961, [ 0.75, 0.3 ], 230 ],
	[ { ...KID, skin: 1, hair: 0, top: TOP.nameTee, color: COLOR.red, sleeves: COLOR.grey, hat: HAT.capWS, seed: 408 }, 0.68, 113961, [ - 0.6, 0.65 ], 230.5 ],
];
const ARMS = {
	rest: [ [ 0.05, 0.06, 0, 0.12 ], [ 0.05, 0.06, 0, 0.12 ] ],
	clap: [ armIK( - 1, [ - 0.02, 1.3, - 0.3 ] ), armIK( 1, [ 0.02, 1.3, - 0.3 ] ) ],
	up: [ armIK( - 1, [ - 0.25, 1.95, - 0.12 ] ), armIK( 1, [ 0.25, 1.95, - 0.12 ] ) ],
};
const dist = ( a, b ) => Math.hypot( b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ] );
const yawTo = ( a, b ) => Math.atan2( - ( b[ 0 ] - a[ 0 ] ), - ( b[ 1 ] - a[ 1 ] ) );

export class Families {

	constructor( { group } ) {

		this.cast = new Cast( { parent: group, max: FAMILIES.length + 1 } );
		this.people = FAMILIES.map( ( [ look, scale, whose, off, t0 ], i ) => {

			const p = this.cast.add( look );
			if ( p ) { p.visible = false; p.pose = restPose(); p.scale = scale; }
			return { p, whose, off, t0, i, kid: look.age === 2 };

		} );
		this._was = false;

	}

	// cel: seconds since the last out (null otherwise); actors: the Director's (where their men are)
	update( cel, actors ) {

		const on = cel != null && cel > 210;
		if ( ! on && ! this._was ) return;
		this._was = on;
		for ( const q of this.people ) {

			const p = q.p;
			if ( ! p ) continue;
			const a = on && cel > q.t0 ? actors?.get( q.whose ) : null;
			if ( ! a ) {

				p.visible = false;
				continue;

			}

			// by him: to his right and in front, turned to him
			const c = Math.cos( a.yaw ), s = Math.sin( a.yaw );
			const spot = [ a.x + q.off[ 0 ] * c - q.off[ 1 ] * s, a.z - q.off[ 0 ] * s - q.off[ 1 ] * c ];
			const L = dist( DUGOUT_STEP, spot ), k = Math.min( 1, ( cel - q.t0 ) * ( q.kid ? 1.5 : 1.3 ) / L );
			const x = DUGOUT_STEP[ 0 ] + ( spot[ 0 ] - DUGOUT_STEP[ 0 ] ) * k, z = DUGOUT_STEP[ 1 ] + ( spot[ 1 ] - DUGOUT_STEP[ 1 ] ) * k;
			const P = p.pose;
			Object.assign( P, restPose() );
			P.walk = k < 1 ? 0.8 : 0;
			P.phase = k * L * ( q.kid ? 6.5 : 4.5 );
			// there: now and then clapping him, the kids' arms up
			const beat = Math.floor( ( cel + q.i * 1.7 ) / 5 ) % 4;
			const arms = k < 1 ? ARMS.rest : q.kid && beat === 1 ? ARMS.up : beat === 2 ? ARMS.clap : ARMS.rest;
			P.armL = arms[ 0 ];
			P.armR = arms[ 1 ];
			P.headPitch = q.kid && k >= 1 ? - 0.3 : 0;
			P.breath = ( cel * 0.3 + q.i * 0.23 ) % 1;
			p.x = x; p.z = z; p.y = moundY( x, z );
			p.yaw = k < 1 ? yawTo( DUGOUT_STEP, spot ) : yawTo( spot, [ a.x, a.z ] );
			if ( ! p.visible ) p.fresh = true;
			p.visible = true;

		}

		this.cast.update();

	}

}
