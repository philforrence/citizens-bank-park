import { Cast, TOP, COLOR, HAT, GEAR, PROP, restPose } from '../Cast.js';
import { armIK } from '../Concourse3BKit.js';
import { STAGE, CEL, MVP } from '../../game/Celebration.js';

// The presentation's party on the stage (Getty 83570999, 83486314, 83486316, 83486403; puffygreenjacket
// 2993614807; ronniebruce 2988347232): Commissioner Bud Selig, the Phillies' president David Montgomery,
// chairman Bill Giles and general manager Pat Gillick (the club's men in the black champions cap), FOX's
// Jeanne Zelasko with the microphone, FOX's Chris Myers for the MVP, two of MLB's men in dark overcoats
// with credentials. They walk out from the first base side, up the stairs, and stand along the stage's
// front; Selig speaks (the crowd booed him, as Philadelphia does), hands the trophy to Montgomery, who
// holds it up; Gillick has it at his chest for the pictures; Zelasko interviews Manuel, Myers the MVP.
// And Harry Kalas (Getty none; johnpaulendicott 3001397124, 4255825686): in his houndstooth sport coat and
// the champions cap, on the grass in front of the first base stands, singing "High Hopes" into a
// microphone with the cameras round him. All real public figures, as they were; Cast figures.

// [ key, look, stage spot (x along its front, z from its middle toward its front), holds a mic ]
// (FR1: as you face the stage, left to right: Giles, Montgomery by the trophy's pedestal, Selig, Zelasko
// and Gillick (in his tan coat) behind her, then Manuel when he's up, Myers at the right-hand end: Getty
// 83570999, 83571356, ronniebruce 2988347232; the two of MLB's men at the back rail)
const PARTY = [
	[ 'selig', { skin: 0, hair: 7, hairStyle: 3, facial: 0, glasses: true, female: false, age: 1, build: 3, top: TOP.coat, color: COLOR.charcoal, sleeves: COLOR.charcoal, pants: 3, shoes: 1, hat: HAT.none, gloves: false, seed: 11 }, [ - 1.1, 0.5 ], true ],
	[ 'montgomery', { skin: 0, hair: 6, hairStyle: 0, facial: 0, glasses: false, female: false, age: 1, build: 1, top: TOP.coat, color: COLOR.camel, sleeves: COLOR.camel, pants: 2, shoes: 3, hat: HAT.capBlack, gloves: false, seed: 23 }, [ - 2.0, 0.6 ], false ],
	[ 'giles', { skin: 2, hair: 7, hairStyle: 3, facial: 0, glasses: false, female: false, age: 1, build: 2, top: TOP.coat, color: COLOR.brown, sleeves: COLOR.brown, pants: 2, shoes: 3, hat: HAT.capBlack, gloves: false, seed: 31 }, [ - 2.8, 0.05 ], false ],
	[ 'gillick', { skin: 0, hair: 6, hairStyle: 3, facial: 0, glasses: true, female: false, age: 1, build: 1, top: TOP.coat, color: COLOR.tan, sleeves: COLOR.tan, pants: 3, shoes: 1, hat: HAT.capBlack, gloves: false, seed: 43 }, [ 0.4, 0.15 ], false ],
	// (---- FR2: her coat a mid-grey wool, as Getty 84082539 and 83570999 have it: the light grey read as a white
	// box under the lights in FOX's mid-shots; its belt and patent trim are Cast's to model)
	[ 'zelasko', { skin: 0, hair: 4, hairStyle: 1, facial: 0, glasses: false, female: true, age: 0, build: 0, top: TOP.coat, color: COLOR.grey, sleeves: COLOR.grey, pants: 1, shoes: 1, hat: HAT.none, gloves: true, seed: 57 }, [ - 0.1, 1.0 ], true ],
	[ 'cmyers', { skin: 0, hair: 1, hairStyle: 0, facial: 0, glasses: false, female: false, age: 0, build: 1, top: TOP.coat, color: COLOR.navy, sleeves: COLOR.navy, pants: 3, shoes: 1, hat: HAT.none, gloves: false, seed: 61 }, [ 2.4, 0.9 ], true ],
	[ 'mlb1', { skin: 1, hair: 1, hairStyle: 0, facial: 0, glasses: false, female: false, age: 0, build: 2, top: TOP.coat, color: COLOR.black, sleeves: COLOR.black, pants: 3, shoes: 1, hat: HAT.none, gloves: false, gear: GEAR.credential, seed: 71 }, [ - 3.0, - 0.9 ], false ],
	[ 'mlb2', { skin: 3, hair: 0, hairStyle: 0, facial: 4, glasses: true, female: false, age: 0, build: 1, top: TOP.coat, color: COLOR.black, sleeves: COLOR.black, pants: 3, shoes: 1, hat: HAT.none, gloves: false, gear: GEAR.credential, seed: 83 }, [ 2.9, - 0.9 ], false ],
	// ---- FR1: Chevrolet's man at the MVP's car (Getty 83486314: lean, short hair, a black jacket); unnamed
	[ 'chevy', { skin: 0, hair: 1, hairStyle: 0, facial: 0, glasses: false, female: false, age: 0, build: 0, top: TOP.jacket, color: COLOR.black, sleeves: COLOR.black, pants: 3, shoes: 1, hat: HAT.none, gloves: false, seed: 89 }, null, false ],
];
const KALAS = { skin: 0, hair: 7, hairStyle: 0, facial: 0, glasses: false, female: false, age: 1, build: 1, top: TOP.jacket, color: COLOR.lightGrey, sleeves: COLOR.lightGrey, pants: 3, shoes: 1, hat: HAT.capBlack, gloves: false, seed: 97 };
// where Harry sang: on the grass in front of the Phillies' dugout's stands
export const KALAS_AT = [ 37, - 19 ];

const hash = ( n ) => {

	const s = Math.sin( n * 12.9898 ) * 43758.5453;
	return s - Math.floor( s );

};
const ease = ( x ) => {

	const t = Math.min( 1, Math.max( 0, x ) );
	return t * t * ( 3 - 2 * t );

};
const lerp2 = ( a, b, k ) => [ a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * k, a[ 1 ] + ( b[ 1 ] - a[ 1 ] ) * k ];
const dist = ( a, b ) => Math.hypot( b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ] );
const yawTo = ( a, b ) => Math.atan2( - ( b[ 0 ] - a[ 0 ] ), - ( b[ 1 ] - a[ 1 ] ) );

const ARMS = {
	mic: [ [ 0.05, 0.08, 0, 0.3 ], armIK( 1, [ 0.1, 1.5, - 0.22 ] ) ],
	micUp: [ armIK( - 1, [ - 0.3, 1.95, - 0.2 ] ), armIK( 1, [ 0.1, 1.52, - 0.2 ] ) ],
	high: [ armIK( - 1, [ - 0.12, 2.05, - 0.2 ] ), armIK( 1, [ 0.12, 2.05, - 0.2 ] ) ],
	chest: [ armIK( - 1, [ - 0.1, 1.22, - 0.3 ] ), armIK( 1, [ 0.1, 1.2, - 0.3 ] ) ],
	clap: [ armIK( - 1, [ - 0.02, 1.3, - 0.3 ] ), armIK( 1, [ 0.02, 1.3, - 0.3 ] ) ],
	rest: [ [ 0.05, 0.06, 0, 0.12 ], [ 0.05, 0.06, 0, 0.12 ] ],
};

export class Party {

	constructor( { group } ) {

		this.cast = new Cast( { parent: group, max: PARTY.length + 1 } );
		this.people = PARTY.map( ( [ key, look, spot, mic ], i ) => {

			const p = this.cast.add( look );
			if ( p ) { p.visible = false; p.pose = restPose(); }
			return { key, p, spot, mic, i };

		} );
		const k = this.cast.add( KALAS );
		if ( k ) { k.visible = false; k.pose = restPose(); }
		this.kalas = k;
		this._was = false;

	}

	// where each is (the stage's frame to the field's)
	spotOf( q ) {

		const S = STAGE;
		return S.point( q.spot[ 0 ], q.spot[ 1 ] - 0.1 );

	}

	// ---- FR1: where each stands once the players are up: the suits along the back rail, the two from FOX
	// at the right-hand end
	backOf( q ) {

		const S = STAGE;
		if ( q.key === 'zelasko' ) return S.point( 2.55, 0.55 );
		if ( q.key === 'cmyers' ) return S.point( 2.75, - 0.25 );
		const lx = { selig: - 0.9, montgomery: - 1.7, giles: - 2.4, gillick: - 0.1 }[ q.key ];
		return lx == null ? this.spotOf( q ) : S.point( lx, - 1.1 + ( q.i % 2 ) * 0.12 );

	}
	// ---- end FR1

	// cel: seconds since the last out (null otherwise). Returns where the trophy is if one of them has it
	update( cel ) {

		const on = cel != null && cel > CEL.party - 1;
		if ( ! on && ! this._was ) return null;
		this._was = on;
		let hold = null;
		this.mvpHeld = null;
		const S = STAGE, start = [ 15, 7 ];
		const foot = S.point( ...S.stairs.foot ), step = S.point( ...S.stairs.step );
		for ( const q of this.people ) {

			const p = q.p;
			if ( ! p ) continue;
			if ( ! on ) {

				p.visible = false;
				continue;

			}

			// ---- FR1: Chevrolet's man, out once the car's parked to wait by it, applauding the MVP
			if ( q.key === 'chevy' ) {

				const t0c = CEL.carIn[ 1 ] + 2, w = ( cel - t0c ) * 1.4 / dist( start, MVP.chevy );
				if ( w <= 0 ) {

					p.visible = false;
					continue;

				}

				if ( ! p.visible ) p.fresh = true;
				p.visible = true;
				const P = p.pose;
				Object.assign( P, restPose() );
				[ p.x, p.z ] = lerp2( start, MVP.chevy, Math.min( 1, w ) );
				p.y = 0;
				p.yaw = w < 1 ? yawTo( start, MVP.chevy ) : MVP.yaw;
				P.walk = w < 1 ? 0.8 : 0;
				P.phase = Math.min( 1, w ) * dist( start, MVP.chevy ) * 4.5;
				const arms = cel > MVP.hand && cel < MVP.hand + 4 ? ARMS.clap : ARMS.rest;
				P.armL = arms[ 0 ];
				P.armR = arms[ 1 ];
				P.headYaw = w >= 1 ? - 0.3 : 0;
				P.breath = ( cel * 0.25 + q.i * 0.3 ) % 1;
				continue;

			}
			// ---- end FR1

			// out from the first base side's field gate, to the stairs, up, to his place
			const top = this.spotOf( q );
			const t0 = CEL.party + q.i * 0.8;
			const legs = [ [ start, foot, 1.5, 0, 0 ], [ foot, step, 0.7, 0, S.H ], [ step, top, 1.3, S.H, S.H ] ];
			let tt = cel - t0, x = start[ 0 ], z = start[ 1 ], y = 0, yaw = 0, walking = false, dd = 0;
			for ( const [ a, b, sp, y0, y1 ] of legs ) {

				const T = dist( a, b ) / sp;
				if ( tt <= 0 ) break;
				const k = Math.min( 1, tt / T );
				[ x, z ] = lerp2( a, b, k );
				y = y0 + ( y1 - y0 ) * k;
				yaw = yawTo( a, b );
				dd += dist( a, b ) * k;
				walking = k < 1;
				tt -= T;

			}

			if ( cel < t0 ) {

				p.visible = false;
				continue;

			}

			// ---- FR1: Selig and Myers down the stairs to the car for the MVP (Getty 83486314), Selig by the
			// hood for the MVP trophy on his way
			let atMvp = false;
			const tDown = CEL.mvp[ 0 ] - 12;
			if ( ( q.key === 'selig' || q.key === 'cmyers' ) && cel > tDown ) {

				const mv = MVP[ q.key ];
				const h = MVP.hood, toward = Math.hypot( mv[ 0 ] - h[ 0 ], mv[ 1 ] - h[ 2 ] ) || 1;
				const pick = [ h[ 0 ] + ( mv[ 0 ] - h[ 0 ] ) * 0.75 / toward, h[ 2 ] + ( mv[ 1 ] - h[ 2 ] ) * 0.75 / toward ];
				// (along behind the others to the stairs, not across in front of Manuel)
				const behind = q.key === 'selig' ? [ S.point( - 1.5, - 0.35 ) ] : [ S.point( 2.0, - 0.75 ), S.point( - 3.0, - 0.6 ) ];
				const way = [ top, ...behind, step ];
				const down = way.slice( 1 ).map( ( b, i ) => [ way[ i ], b, 1.3, S.H, S.H ] );
				down.push( [ step, foot, 0.7, S.H, 0 ] );
				const n0 = down.length;
				if ( q.key === 'selig' ) down.push( [ foot, pick, 1.5, 0, 0 ], [ pick, mv, 1.2, 0, 0 ] );
				else down.push( [ foot, mv, 1.5, 0, 0 ] );
				let t2 = cel - tDown, leg = 0;
				[ x, z ] = top;
				y = S.H;
				walking = false;
				for ( const [ a, b, sp, y0, y1 ] of down ) {

					const T = dist( a, b ) / sp;
					if ( t2 <= 0 ) break;
					const k = Math.min( 1, t2 / T );
					[ x, z ] = lerp2( a, b, k );
					y = y0 + ( y1 - y0 ) * k;
					yaw = yawTo( a, b );
					dd += dist( a, b ) * k;
					walking = k < 1;
					t2 -= T;
					leg ++;

				}

				atMvp = true;
				if ( ! walking ) yaw = MVP.yaw;
				// (the MVP trophy: in Selig's hands from the hood until he gives it to Hamels)
				q.carry = q.key === 'selig' && leg > n0 + 1 && cel < MVP.hand;

			}
			// ---- end FR1
			// ---- FR1: facing out of the stage's front, to the plate and the stands (S.yaw had them looking
			// out to right-center, their backs to everyone); and when the players come up, back to the rail
			// out of their way (Zelasko and Myers to the right-hand end)
			if ( ! walking && tt > 0 && ! atMvp ) {

				yaw = S.face;
				const kb = ease( ( cel - ( CEL.up - 3 ) ) / 1.6 );
				if ( kb > 0 ) {

					const b = this.backOf( q );
					walking = kb < 1;
					dd += dist( top, b ) * kb;
					[ x, z ] = lerp2( top, b, kb );
					if ( walking ) yaw = yawTo( top, b );

				}

			}
			// ---- end FR1
			const P = p.pose;
			Object.assign( P, restPose() );
			P.phase = dd * 4.5;
			P.walk = walking ? 0.8 : 0;
			let arms = ARMS.rest;
			if ( q.mic ) { arms = ARMS.mic; P.propR = PROP.mic; }
			// Selig speaks, then gives the trophy to Montgomery; Montgomery holds it up; Gillick has it at
			// his chest for the pictures; Zelasko talks with Manuel, Myers with the MVP
			const talk = ( a, b ) => cel > a && cel < b;
			if ( q.key === 'selig' && talk( CEL.present[ 0 ], CEL.hand ) ) P.mouth = 0.5 + 0.5 * Math.sin( cel * 9 );
			if ( q.key === 'montgomery' && talk( CEL.hand, CEL.manuel[ 0 ] ) ) {

				arms = ARMS.high;
				hold = this.handsAt( p, [ 0, 2.08, - 0.2 ] );

			}

			if ( q.key === 'gillick' && talk( CEL.manuel[ 0 ], CEL.mvp[ 0 ] ) ) {

				arms = ARMS.chest;
				hold = this.handsAt( p, [ 0, 1.1, - 0.32 ] );

			}

			if ( q.key === 'zelasko' && talk( CEL.manuel[ 0 ], CEL.manuel[ 1 ] ) ) { P.mouth = 0.3 + 0.3 * Math.sin( cel * 7 ); P.headYaw = 0.5; }
			// ---- FR1: by the car, Selig with the MVP trophy at his chest, a word, then it's Hamels's; Myers
			// with him after (Hamels on Myers's right as you face them, on his own left: Getty 83486314)
			if ( q.carry ) {

				arms = ARMS.chest;
				P.propR = PROP.none;
				this.mvpHeld = this.handsAt( p, [ 0, 1.16, - 0.3 ] );
				if ( cel > MVP.hand - 3.5 ) P.mouth = 0.4 + 0.4 * Math.sin( cel * 9 );

			}

			if ( q.key === 'cmyers' && atMvp && ! walking && talk( MVP.hand + 1, CEL.mvp[ 1 ] ) ) { P.mouth = 0.3 + 0.3 * Math.sin( cel * 7 ); P.headYaw = - 0.45; }
			// ---- end FR1
			// the others applaud the moments
			if ( ! q.mic && arms === ARMS.rest && ( talk( CEL.hand, CEL.hand + 5 ) || talk( CEL.up, CEL.up + 8 ) ) ) arms = ARMS.clap;
			P.armL = arms[ 0 ];
			P.armR = arms[ 1 ];
			P.breath = ( cel * 0.25 + q.i * 0.3 ) % 1;
			p.x = x; p.z = z; p.y = y; p.yaw = yaw;
			if ( ! p.visible ) p.fresh = true;
			p.visible = true;

		}

		// Harry: out to his spot, then singing it, the free hand up, the cap tipped at the end
		const k = this.kalas;
		if ( k ) {

			const on2 = on && cel > CEL.kalas[ 0 ] - 8 && cel < CEL.kalas[ 1 ] + 20;
			if ( on2 ) {

				const from = [ 18, 6 ], at = KALAS_AT;
				const w = Math.min( 1, Math.max( 0, ( cel - ( CEL.kalas[ 0 ] - 8 ) ) * 1.3 / dist( from, at ) ) );
				const P = k.pose;
				Object.assign( P, restPose() );
				const [ x, z ] = lerp2( from, at, ease( w ) );
				P.walk = w < 1 ? 0.7 : 0;
				P.phase = w * dist( from, at ) * 4.5;
				P.propR = PROP.mic;
				const singing = cel > CEL.kalas[ 0 ] && cel < CEL.kalas[ 1 ];
				const lift = singing && Math.floor( ( cel - CEL.kalas[ 0 ] ) / 6 ) % 2 === 1;
				P.armL = lift ? ARMS.micUp[ 0 ] : ARMS.mic[ 0 ];
				P.armR = ARMS.mic[ 1 ];
				P.mouth = singing ? 0.35 + 0.35 * Math.abs( Math.sin( cel * 5.3 ) ) : 0;
				P.headPitch = singing ? - 0.1 : 0;
				k.x = x; k.z = z; k.y = 0;
				k.yaw = w < 1 ? yawTo( from, at ) : yawTo( at, [ 30, 12 ] );
				if ( ! k.visible ) k.fresh = true;
				k.visible = true;

			} else k.visible = false;

		}

		this.cast.update();
		void hash;
		return hold;

	}

	// a point held in the hands, in the figure's frame (its scale, yaw), in the field frame
	handsAt( p, [ lx, ly, lz ] ) {

		const s = p.scale || 1, c = Math.cos( p.yaw ), sn = Math.sin( p.yaw );
		return { x: p.x + ( lx * c + lz * sn ) * s, y: ( p.y || 0 ) + ly * s - 0.1, z: p.z + ( - lx * sn + lz * c ) * s, yaw: p.yaw };

	}

	// where Harry is (for the cameras round him), or null
	get kalasAt() {

		return this.kalas?.visible ? { x: this.kalas.x, z: this.kalas.z, yaw: this.kalas.yaw } : null;

	}

}
