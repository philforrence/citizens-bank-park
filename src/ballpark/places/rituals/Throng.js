import { Cast, TOP, COLOR, HAT, GEAR, PROP, CHEST, restPose } from '../Cast.js';
import { armIK, rng, pick } from '../Concourse3BKit.js';
import { STAGE, CEL } from '../../game/Celebration.js';
import { moundY } from '../../game/TarpPlan.js';
import { Gator } from '../phanatic/Gator.js'; // ---- FR2
import { pieceK } from './Stage.js'; // ---- FR2

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

	constructor( { group, stage = null } ) {

		const N = KNOTS.reduce( ( s, k ) => s + k.n, 0 );
		this.cast = new Cast( { parent: group, max: N + 1 + CREW_N + CLUB.length } ); // ---- FR2: the crew, the clubhouse men
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
		this._crew( group, stage, r ); // ---- FR2

	}

	// cel: seconds since the last out (null otherwise)
	update( cel ) {

		const on = cel != null && cel > 40;
		if ( ! on && ! this._was ) return;
		this._was = on;
		this._crewUpdate( on ? cel : null ); // ---- FR2
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

	// ---- FR2 (C3B-9, C3B-10's leftovers): the grounds crew who carry the stage in, off two of their John
	// Deere Gators parked behind where it goes up (anthonydefrancesco 2986359720: four Gators on the grass
	// behind first, the crew in red round the stage); and the clubhouse men going round the knots of
	// players with the champions tees and caps (Getty 83571364: handed round in the scrum). In the same Cast
	// as the throng (no new draws for them); the Gators one draw each, parked
	_crew( group, stage, r ) {

		this.gators = GATORS.map( () => new Gator( group, { launcher: false, still: true } ) );
		this.parts = stage ? stage.parts.filter( ( p ) => p.carry ) : [];
		this.crew = [];
		for ( let i = 0; i < CREW_N; i ++ ) {

			const L = {
				skin: Number( pick( r, { 0: 55, 1: 15, 2: 10, 3: 12, 4: 8 } ) ), hair: Number( pick( r, { 0: 30, 1: 30, 2: 20, 3: 20 } ) ), hairStyle: 0, facial: Number( pick( r, { 0: 55, 1: 15, 3: 15, 4: 15 } ) ),
				glasses: r() < 0.15, female: false, age: r() < 0.25 ? 1 : 0, build: Number( pick( r, { 0: 25, 1: 45, 2: 10, 3: 20 } ) ), pants: 2, shoes: 1, gloves: true,
				seed: Math.floor( r() * 65536 ), scarf: 0, back: 0, chest: 0, poncho: 0, top: TOP.work, color: COLOR.red, sleeves: COLOR.red, hat: HAT.capRed, gear: 0,
			};
			const p = this.cast.add( L );
			if ( ! p ) continue;
			p.visible = false;
			p.pose = restPose();
			// his jobs: the deck's modules turn about between the two fours, two of the first four take the
			// stairs; where he waits by the Gators
			const jobs = [];
			const team = i < 4 ? 0 : 1;
			this.parts.forEach( ( q, qi ) => {

				if ( q.carry.length === 4 && qi % 2 === team ) jobs.push( { q, slot: q.carry[ i % 4 ] } );
				if ( q.carry.length === 2 && i < 2 ) jobs.push( { q, slot: q.carry[ i ] } );

			} );
			const g = GATORS[ i % 2 ];
			this.crew.push( { p, i, jobs, wait: [ g[ 0 ] + ( i % 4 < 2 ? - 1.3 : 1.3 ), g[ 1 ] + 1.6 + 0.6 * Math.floor( i / 4 ) ], seed: r() } );

		}

		this.club = [];
		for ( const C of CLUB ) {

			const L = {
				skin: C.skin, hair: C.hair, hairStyle: 0, facial: C.facial, glasses: false, female: false, age: C.age, build: 1, pants: 1, shoes: 1, gloves: false,
				seed: C.seed, scarf: 0, back: 0, chest: 0, poncho: 0, top: TOP.jacket, color: COLOR.red, sleeves: COLOR.red, hat: HAT.capBlack, gear: GEAR.credential,
			};
			const p = this.cast.add( L );
			if ( ! p ) continue;
			p.visible = false;
			p.pose = restPose();
			this.club.push( { p, C } );

		}

	}

	_crewUpdate( cel ) {

		const on = cel != null && cel > GATOR_IN;
		for ( const [ k, g ] of this.gators.entries() ) {

			const at = GATORS[ k ];
			g.set( { x: at[ 0 ], z: at[ 1 ], yaw: at[ 2 ], visible: on } );

		}

		for ( const c of this.crew ) {

			const p = c.p;
			if ( on && ! p.visible ) p.fresh = true;
			p.visible = on;
			if ( ! on ) continue;
			const P = p.pose;
			Object.assign( P, restPose() );
			let x, z, yaw, arms = ARMS.rest;
			const job = c.jobs.find( ( j ) => cel >= j.q.t && cel < j.q.t + j.q.dur );
			if ( job ) {

				// carrying it: at his corner of it as it comes in, held at the hip, walking
				const q = job.q, k = pieceK( q, cel );
				const lx = q.c[ 0 ] + q.from[ 0 ] * ( 1 - k ) + job.slot[ 0 ], lz = q.c[ 1 ] + q.from[ 2 ] * ( 1 - k ) + job.slot[ 1 ];
				[ x, z ] = STAGE.point( lx, lz );
				yaw = yawTo( STAGE.point( 0, 0 ), STAGE.point( - q.from[ 0 ], - q.from[ 2 ] ) );
				const moving = k > 0.02 && k < 0.98;
				P.walk = moving ? 0.7 : 0;
				P.phase = k * Math.hypot( q.from[ 0 ], q.from[ 2 ] ) * 4.5 + c.seed * 3;
				// (the ones at the leading end hold it behind them, the trailing ones in front)
				const lead = job.slot[ 1 ] * ( q.from[ 2 ] ? - Math.sign( q.from[ 2 ] ) : 0 ) + job.slot[ 0 ] * ( q.from[ 0 ] ? - Math.sign( q.from[ 0 ] ) : 0 ) > 0;
				const hz = lead ? 0.22 : - 0.3;
				arms = [ armIK( - 1, [ - 0.2, 0.9, hz ] ), armIK( 1, [ 0.2, 0.9, hz ] ) ];

			} else {

				// between: to the next piece's corner by the time it's lifted, else back by the Gators
				const next = c.jobs.find( ( j ) => j.q.t > cel );
				const prev = [ ...c.jobs ].reverse().find( ( j ) => j.q.t + j.q.dur <= cel );
				const from = prev ? STAGE.point( prev.q.c[ 0 ] + prev.slot[ 0 ], prev.q.c[ 1 ] + prev.slot[ 1 ] ) : c.wait;
				const t0 = prev ? prev.q.t + prev.q.dur : GATOR_IN;
				let to = c.wait, t1 = t0 + 0.5 + dist( from, c.wait ) / 1.5;
				if ( next ) {

					to = STAGE.point( next.q.c[ 0 ] + next.q.from[ 0 ] + next.slot[ 0 ], next.q.c[ 1 ] + next.q.from[ 2 ] + next.slot[ 1 ] );
					t1 = next.q.t;

				}

				const L = dist( from, to ), go = Math.max( t0, t1 - L / 1.6 );
				const k = L < 0.05 ? 1 : Math.min( 1, Math.max( 0, ( cel - go ) / Math.max( 0.3, t1 - go ) ) );
				x = from[ 0 ] + ( to[ 0 ] - from[ 0 ] ) * k; z = from[ 1 ] + ( to[ 1 ] - from[ 1 ] ) * k;
				const walking = k > 0 && k < 1;
				P.walk = walking ? 0.75 : 0;
				P.phase = k * L * 4.5;
				yaw = walking ? yawTo( from, to ) : next ? yawTo( to, STAGE.point( next.q.c[ 0 ], next.q.c[ 1 ] ) ) : yawTo( to, STAGE.point( 0, 0 ) ) + ( c.seed - 0.5 ) * 1.2;
				if ( ! walking && ! next ) {

					const beat = Math.floor( ( cel + c.seed * 9 ) / 7 ) % 4;
					arms = beat === 0 ? ARMS.folded : ARMS.rest;
					P.headYaw = 0.4 * Math.sin( cel * 0.25 + c.seed * 6 );

				}

			}

			P.armL = arms[ 0 ];
			P.armR = arms[ 1 ];
			P.breath = ( cel * 0.27 + c.i * 0.23 ) % 1;
			p.x = x; p.z = z; p.y = moundY( x, z );
			p.yaw = yaw;

		}

		// the clubhouse men: out of the dugout with a bag of them, a tee held out, round the knots of players
		// as they come together, then back to the dugout's end
		for ( const { p, C } of this.club ) {

			const live = cel != null && cel > C.out && cel < C.back + 12;
			if ( live && ! p.visible ) p.fresh = true;
			p.visible = live;
			if ( ! live ) continue;
			const P = p.pose;
			Object.assign( P, restPose() );
			// his round: from the dugout to each stop (a few seconds going slowly round the knot), and back
			let t = C.out, x = C.from[ 0 ], z = C.from[ 1 ], yaw = yawTo( C.from, [ 2, - 14 ] ), arms = ARMS.rest, walking = false, done = false;
			const legs = [ ...C.stops.map( ( s ) => s.at ), C.from ];
			let a = C.from;
			for ( let s = 0; s < legs.length && ! done; s ++ ) {

				const b = legs[ s ], L = dist( a, b ), tw = L / 1.5;
				if ( cel < t + tw ) {

					const k = ( cel - t ) / tw;
					x = a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * k; z = a[ 1 ] + ( b[ 1 ] - a[ 1 ] ) * k; yaw = yawTo( a, b ); walking = true;
					P.phase = k * L * 4.5;
					done = true;
					break;

				}

				t += tw;
				a = b;
				const S = C.stops[ s ];
				if ( ! S ) break;
				if ( cel < t + S.stay ) {

					// (round the knot and back to where he stopped, so he sets off from there)
					const u = ( cel - t ) / S.stay, wob = Math.sin( Math.PI * u );
					x = S.at[ 0 ] + Math.cos( S.a0 ) * 0.5 * wob; z = S.at[ 1 ] + Math.sin( S.a0 ) * 0.5 * wob;
					yaw = yawTo( [ x, z ], S.knot ) + 0.4 * Math.sin( cel * 0.9 );
					arms = Math.floor( ( cel - t ) / 2.2 ) % 2 ? ARMS.hand : ARMS.offer;
					P.headYaw = 0.3 * Math.sin( cel * 0.7 );
					done = true;
					break;

				}

				t += S.stay;

			}

			P.walk = walking ? 0.75 : 0;
			P.armL = arms[ 0 ];
			P.armR = arms[ 1 ];
			// the bag of them in his left hand, a tee in his right while he's handing them out
			P.propL = PROP.bag;
			P.propR = arms === ARMS.offer ? PROP.towel : PROP.none;
			P.breath = ( cel * 0.3 ) % 1;
			p.x = x; p.z = z; p.y = moundY( x, z );
			p.yaw = yaw;

		}

	}

}
// ---- end FB3

// ---- FR2: the crew's Gators, parked behind where the stage goes up (stage frame -> field [ x, z, yaw ]),
// from when they're there; the eight who carry it
const GATOR_IN = CEL.stageBuild[ 0 ] - 9;
const GATORS = [ [ - 2.6, - 17.5 ], [ 2.4, - 18.2 ] ].map( ( [ lx, lz ] ) => [ ...STAGE.point( lx, lz ), STAGE.yaw + 0.15 * Math.sign( lx ) ] );
const CREW_N = 8;
// the clubhouse men: out of the Phillies' dugout at C.out, round the knots of players (Celebration's
// KNOTS) a few seconds at each, back at the dugout's end by C.back
const CLUB = [
	{ out: 47, back: 112, from: [ 22.5, - 3.8 ], skin: 0, hair: 2, facial: 0, age: 1, seed: 4711,
		stops: [ { at: [ 12.2, - 4.2 ], knot: [ 12, - 6.5 ], stay: 13, a0: 0.3 }, { at: [ 4.6, - 13.3 ], knot: [ 2.5, - 14.5 ], stay: 14, a0: 2.1 }, { at: [ 0.6, - 3.5 ], knot: [ - 1.5, - 5 ], stay: 12, a0: 4.0 } ] },
	{ out: 53, back: 122, from: [ 23.5, - 5.0 ], skin: 2, hair: 1, facial: 3, age: 0, seed: 8123,
		stops: [ { at: [ 9.6, - 8.1 ], knot: [ 12, - 6.5 ], stay: 11, a0: 3.4 }, { at: [ - 4.8, - 13.8 ], knot: [ - 7, - 15 ], stay: 14, a0: 1.0 }, { at: [ 0.8, - 16.6 ], knot: [ 2.5, - 14.5 ], stay: 12, a0: 5.1 } ] },
];
// holding a tee out to a man, and reaching into the bag for the next
ARMS.offer = [ ARMS.rest[ 0 ], armIK( 1, [ 0.16, 1.22, - 0.48 ] ) ];
ARMS.hand = [ armIK( - 1, [ - 0.12, 1.0, - 0.22 ] ), armIK( 1, [ 0.05, 1.02, - 0.25 ] ) ];
// ---- end FR2
