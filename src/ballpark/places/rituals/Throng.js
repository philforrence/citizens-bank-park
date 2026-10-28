import { Cast, TOP, COLOR, HAT, GEAR, PROP, CHEST, restPose } from '../Cast.js';
import { armIK, rng, pick } from '../Concourse3BKit.js';
import { STAGE, CEL } from '../../game/Celebration.js';
import { moundY } from '../../game/TarpPlan.js';

// ---- FB3 (C3B-9): the field filling up after the pile. Within a minute or two of the last out the infield
// was crowded: club staff and MLB's event crew with their credentials, the security in yellow along the
// lines, the grounds crew, more photographers and camera crews, the players' families coming down; by
// the presentation a hundred and fifty or more on the infield (flickr ronniebruce 2988348456, 10:26 pm,
// the overview; anthonydefrancesco 2986359720: knots of people round the stage being set and the car).
// Ours had the forty-odd players and the press, the grass between them bare in every wide shot. These
// come out of the field gates and the dugouts' ends from 50 s on and stand in knots: round the stage's
// ends and behind it once it's up, on the grass toward the Phillies' dugout, by the plate, behind short;
// talking, a phone or a camera up, clapping the big moments. Unnamed, plain looks (CAST.md). Cast figures
// in P0's pool, posed once a frame only while the celebration's on.

// the ways out onto the field: the gaps by the camera wells behind the plate, the dugouts' near steps
const GATES = [ [ 15, 7 ], [ - 15, 7 ], [ 21.6, - 4.2 ], [ - 21.6, - 4.2 ] ];
// the knots: where (field x, z), how wide, from when (s after the last out), how many
const KNOTS = [
	{ c: [ 27, - 15 ], r: 2.2, t: 48, n: 6 }, // in front of the Phillies' dugout
	{ c: [ 7.5, - 9.5 ], r: 2.0, t: 54, n: 5 }, // on the grass toward it
	{ c: [ - 6.5, - 4.5 ], r: 1.7, t: 58, n: 4 }, // by the plate's dirt, the third base side
	{ c: STAGE.point( - 7.4, 3.4 ), r: 2.3, t: 66, n: 6 }, // the stage's left end, by the stairs
	{ c: STAGE.point( 0.4, - 4.6 ), r: 2.8, t: 80, n: 6 }, // behind it: MLB's crew, the club's people
	{ c: STAGE.point( 11, - 2.5 ), r: 1.8, t: 104, n: 4 }, // past the car once it's parked
	{ c: [ - 11, - 25 ], r: 2.0, t: 90, n: 4 }, // behind short
	{ c: [ 3.5, - 2.2 ], r: 1.4, t: 72, n: 3 }, // by the plate
	{ c: [ - 25, - 14 ], r: 1.8, t: 62, n: 3 }, // in front of the Rays' empty dugout: the security
];
const ARMS = {
	rest: [ [ 0.05, 0.06, 0, 0.12 ], [ 0.05, 0.06, 0, 0.12 ] ],
	clap: [ armIK( - 1, [ - 0.02, 1.3, - 0.3 ] ), armIK( 1, [ 0.02, 1.3, - 0.3 ] ) ],
	phone: [ [ 0.05, 0.06, 0, 0.12 ], armIK( 1, [ 0.12, 1.62, - 0.12 ] ) ],
	shoot: [ armIK( - 1, [ - 0.05, 1.47, - 0.4 ] ), armIK( 1, [ 0.07, 1.53, - 0.2 ] ) ],
	folded: [ armIK( - 1, [ 0.06, 1.18, - 0.2 ] ), armIK( 1, [ - 0.06, 1.2, - 0.2 ] ) ],
	up: [ armIK( - 1, [ - 0.25, 1.95, - 0.12 ] ), armIK( 1, [ 0.25, 1.95, - 0.12 ] ) ],
};
const dist = ( a, b ) => Math.hypot( b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ] );
const yawTo = ( a, b ) => Math.atan2( - ( b[ 0 ] - a[ 0 ] ), - ( b[ 1 ] - a[ 1 ] ) );
// the moments everyone on the field claps (the trophy handed over, the MVP, the players up)
const CLAP = [ [ CEL.hand, CEL.hand + 6 ], [ CEL.mvp[ 0 ] + 5, CEL.mvp[ 0 ] + 10 ], [ CEL.up + 4, CEL.up + 12 ] ];

export class Throng {

	constructor( { group } ) {

		const N = KNOTS.reduce( ( s, k ) => s + k.n, 0 );
		this.cast = new Cast( { parent: group, max: N + 1 } );
		this.people = [];
		const r = rng( 20081029 + 77 );
		let i = 0;
		KNOTS.forEach( ( K, ki ) => {

			for ( let j = 0; j < K.n; j ++, i ++ ) {

				// who: the club's and MLB's people in dark jackets with credentials, security in yellow, the
				// grounds crew, photographers, family (behind the dugout first)
				const kind = ki === 8 ? 'security' : ki === 0 && j < 3 ? 'family' : pick( r, { staff: 40, crew: 12, press: 18, security: 8, family: 12 } );
				const female = r() < ( kind === 'family' ? 0.55 : 0.2 );
				const L = {
					skin: Number( pick( r, { 0: 52, 1: 18, 2: 10, 3: 10, 4: 6, 5: 4 } ) ), hair: Number( pick( r, { 0: 20, 1: 30, 2: 20, 3: 10, 6: 10, 7: 10 } ) ),
					hairStyle: female ? 2 : r() < 0.12 ? 3 : 0, facial: female ? 0 : Number( pick( r, { 0: 55, 1: 10, 3: 15, 4: 20 } ) ), glasses: r() < 0.25, female,
					age: r() < 0.2 ? 1 : 0, build: Number( pick( r, { 0: 22, 1: 44, 2: 14, 3: 20 } ) ), pants: Number( pick( r, { 0: 25, 1: 25, 2: 20, 3: 30 } ) ),
					shoes: Number( pick( r, { 1: 50, 2: 25, 3: 25 } ) ), gloves: r() < 0.3, seed: Math.floor( r() * 65536 ), scarf: r() < 0.15 ? 3 : 0,
					back: 0, chest: 0, poncho: 0,
				};
				if ( kind === 'staff' ) Object.assign( L, { top: TOP[ pick( r, { jacket: 50, coat: 20, fleece: 15, puffer: 15 } ) ], color: Number( pick( r, { [ COLOR.black ]: 45, [ COLOR.navy ]: 25, [ COLOR.charcoal ]: 20, [ COLOR.red ]: 10 } ) ), hat: HAT[ pick( r, { none: 50, capWS: 25, capBlack: 15, knitBlack: 10 } ) ], gear: GEAR.credential } );
				if ( kind === 'crew' ) Object.assign( L, { top: TOP.work, color: COLOR.red, hat: HAT.capRed, gear: 0, gloves: true } );
				if ( kind === 'press' ) Object.assign( L, { top: TOP[ pick( r, { jacket: 35, puffer: 30, leather: 15, fleece: 20 } ) ], color: Number( pick( r, { [ COLOR.black ]: 45, [ COLOR.navy ]: 25, [ COLOR.charcoal ]: 15, [ COLOR.olive ]: 15 } ) ), hat: HAT[ pick( r, { none: 45, capBlack: 30, knitBlack: 25 } ) ], gear: GEAR.credential | ( r() < 0.5 ? GEAR.messenger : 0 ) } );
				if ( kind === 'security' ) Object.assign( L, { top: TOP.security, color: COLOR.policeYellow, chest: CHEST.security, hat: HAT[ pick( r, { none: 40, capBlack: 40, knitBlack: 20 } ) ], gear: GEAR.radio } );
				if ( kind === 'family' ) Object.assign( L, { top: TOP[ pick( r, { puffer: 35, coat: 25, homeJersey: 20, fleece: 20 } ) ], color: Number( pick( r, { [ COLOR.red ]: 50, [ COLOR.black ]: 20, [ COLOR.cream ]: 15, [ COLOR.white ]: 15 } ) ), hat: HAT[ pick( r, { none: 30, capWS: 30, capRed: 25, knitRed: 15 } ) ], gear: 0 } );
				L.sleeves = L.top === TOP.homeJersey ? COLOR.red : L.color;
				const p = this.cast.add( L );
				if ( ! p ) continue;
				p.visible = false;
				p.pose = restPose();
				// a place in the knot, facing into it (or, on the stage's knots, toward the stage)
				const a = ( j + 0.5 ) / K.n * Math.PI * 2 + ( r() - 0.5 ) * 0.6;
				const rr = K.r * ( 0.6 + 0.4 * r() );
				const spot = [ K.c[ 0 ] + Math.cos( a ) * rr, K.c[ 1 ] + Math.sin( a ) * rr ];
				const gate = GATES.reduce( ( b, g ) => dist( g, spot ) < dist( b, spot ) ? g : b );
				this.people.push( {
					p, i, kind, spot, gate, K, ki,
					t0: K.t + j * ( 1.0 + 1.6 * r() ) + r() * 3, speed: 1.25 + 0.3 * r(),
					habit: kind === 'press' ? 'shoot' : kind === 'security' ? 'folded' : r() < 0.3 ? 'phone' : 'rest',
					seed: r(),
				} );

			}

		} );
		this._was = false;

	}

	// cel: seconds since the last out (null otherwise)
	update( cel ) {

		const on = cel != null && cel > 40;
		if ( ! on && ! this._was ) return;
		this._was = on;
		const stage = STAGE.point( 0, 0 );
		const clap = cel != null && CLAP.some( ( [ a, b ] ) => cel > a && cel < b );
		for ( const q of this.people ) {

			const p = q.p;
			const tt = on ? cel - q.t0 : - 1;
			if ( tt < 0 ) {

				p.visible = false;
				continue;

			}

			const L = dist( q.gate, q.spot ), k = Math.min( 1, tt * q.speed / L );
			const x = q.gate[ 0 ] + ( q.spot[ 0 ] - q.gate[ 0 ] ) * k, z = q.gate[ 1 ] + ( q.spot[ 1 ] - q.gate[ 1 ] ) * k;
			const P = p.pose;
			Object.assign( P, restPose() );
			P.walk = k < 1 ? 0.75 : 0;
			P.phase = k * L * 4.5;
			// there: toward the stage once the presentation's on (the knots by it), else into the knot, a
			// word to the next one now and then
			const toStage = q.ki >= 3 && q.ki <= 5 && cel > CEL.present[ 0 ] - 4 && cel < CEL.present[ 1 ];
			const look = toStage ? stage : q.K.c;
			let arms = ARMS.rest;
			if ( k >= 1 ) {

				const beat = Math.floor( ( cel + q.seed * 9 ) / 6 ) % 5;
				arms = clap && q.kind !== 'security' ? ARMS.clap : beat < 2 ? ARMS[ q.habit ] : beat === 3 && q.kind === 'family' ? ARMS.up : ARMS.rest;
				P.headYaw = 0.45 * Math.sin( cel * 0.3 + q.seed * 6 );
				P.mouth = beat === 4 ? 0.25 + 0.25 * Math.sin( cel * 8 + q.i ) : 0;

			}

			P.armL = arms[ 0 ];
			P.armR = arms[ 1 ];
			P.propR = arms === ARMS.shoot ? PROP.slr : arms === ARMS.phone ? PROP.phone : PROP.none;
			P.breath = ( cel * 0.27 + q.i * 0.19 ) % 1;
			p.x = x; p.z = z; p.y = moundY( x, z );
			p.yaw = k < 1 ? yawTo( q.gate, q.spot ) : yawTo( q.spot, look ) + ( q.seed - 0.5 ) * 0.7;
			if ( ! p.visible ) p.fresh = true;
			p.visible = true;

		}

		this.cast.update();

	}

}
// ---- end FB3
