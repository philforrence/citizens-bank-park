import { Cast, TOP, COLOR, HAT, GEAR, PROP, restPose, lookAt } from '../Cast.js';
import { armIK, rng, pick } from '../Concourse3BKit.js';
import { PILE } from '../../game/Celebration.js';

// The press at the last out (Getty 83571364, John Iacono's: the photographers in among the hugs with
// their long zooms, a flash on top; a FOX handheld on the shoulder; the boom mic in its fuzzy
// windscreen over the heads; credentials on lanyards, bags at the hip): out of the camera wells at the
// dugouts' ends a couple of seconds after the strikeout, round the pile in a ring, crouched in front and
// holding their cameras up over the heads behind; then each one after a man (Lidge, Ruiz, Howard,
// Utley, Manuel, Hamels...), a few steps off him, working round him as he goes. Their flashes fire
// all through it (Cast's PROP.slr). All Cast figures in P0's pool.
//
// Invented where the record is silent: who each one follows; the shooters are unnamed (W4's Ed and
// Marisa stay in their wells).

// the wells' mouths (Field.DUGOUT_ZONES: the TV well at each dugout's home end, the photographers' at
// its far end), just out on the field
const EXITS = [ [ 29.7, - 9.1 ], [ - 29.7, - 9.1 ], [ 14.3, 6.3 ], [ - 14.3, 6.3 ] ];
const N_PHOTO = 22, N_TV = 3;

const hash = ( n ) => {

	const s = Math.sin( n * 12.9898 ) * 43758.5453;
	return s - Math.floor( s );

};
const ease = ( x ) => {

	const t = Math.min( 1, Math.max( 0, x ) );
	return t * t * ( 3 - 2 * t );

};

// the arms (worked out once): at the eye, held high over the heads, the TV camera on the shoulder,
// the boom up
const ARMS = {
	shoot: [ armIK( - 1, [ - 0.05, 1.47, - 0.4 ] ), armIK( 1, [ 0.07, 1.53, - 0.2 ] ) ],
	high: [ armIK( - 1, [ - 0.04, 1.9, - 0.42 ] ), armIK( 1, [ 0.08, 1.95, - 0.25 ] ) ],
	crouch: [ armIK( - 1, [ - 0.05, 1.12, - 0.42 ] ), armIK( 1, [ 0.07, 1.18, - 0.22 ] ) ],
	eng: [ armIK( - 1, [ - 0.1, 1.2, - 0.18 ] ), armIK( 1, [ 0.16, 1.5, - 0.28 ] ) ],
	boom: [ armIK( - 1, [ - 0.02, 1.95, - 0.55 ] ), armIK( 1, [ 0.08, 1.75, - 0.2 ] ) ],
	carry: [ [ 0.05, 0.08, 0, 0.3 ], armIK( 1, [ 0.2, 1.1, - 0.12 ] ) ],
};
// whom they follow once the pile comes apart (the Phillies' ids; the staff's rig ids)
const SUBJECTS = [ 400058, 434563, 429667, 400284, 'r:manuel', 430935, 276519, 150029, 425664, 400058, 408206, 150268, 434563, 429731, 'r:manuel', 400058 ];

export class Press {

	constructor( { group } ) {

		this.cast = new Cast( { parent: group, max: N_PHOTO + N_TV + 2 } );
		this.people = [];
		const r = rng( 20081029 );
		const n = N_PHOTO + N_TV + 1;
		for ( let i = 0; i < n; i ++ ) {

			const kind = i < N_PHOTO ? 'photo' : i < N_PHOTO + N_TV ? 'eng' : 'boom';
			const female = r() < 0.18;
			const L = {
				skin: Number( pick( r, { 0: 30, 1: 26, 2: 14, 3: 10, 4: 8, 5: 6, 6: 3, 7: 3 } ) ), hair: Number( pick( r, { 0: 22, 1: 26, 2: 22, 3: 12, 6: 10, 7: 8 } ) ),
				hairStyle: female ? 2 : r() < 0.15 ? 3 : 0, facial: female ? 0 : Number( pick( r, { 0: 50, 1: 10, 3: 18, 4: 22 } ) ), glasses: r() < 0.3, female, age: r() < 0.15 ? 1 : 0,
				build: Number( pick( r, { 0: 20, 1: 45, 2: 15, 3: 20 } ) ),
				// the working press on a cold night: black and navy jackets, a red one, a leather, work coats
				top: TOP[ pick( r, { jacket: 30, puffer: 22, leather: 10, work: 12, fleece: 14, coat: 4 } ) ],
				color: Number( pick( r, { [ COLOR.black ]: 40, [ COLOR.navy ]: 22, [ COLOR.charcoal ]: 14, [ COLOR.red ]: 10, [ COLOR.olive ]: 6, [ COLOR.tan ]: 8 } ) ),
				sleeves: COLOR.black, back: 0, chest: 0, pants: Number( pick( r, { 0: 24, 1: 24, 2: 20, 3: 24, 5: 8 } ) ), shoes: Number( pick( r, { 1: 40, 2: 30, 3: 20, 4: 10 } ) ),
				hat: HAT[ pick( r, { none: 34, capBlack: 16, capNavy: 14, knitBlack: 14, capBack: 10, knitGrey: 6, capRed: 6 } ) ], poncho: 0,
				scarf: r() < 0.12 ? 3 : 0, gloves: r() < 0.3, gear: GEAR.credential | ( r() < 0.5 ? GEAR.messenger : 0 ), seed: Math.floor( r() * 65536 ),
			};
			const p = this.cast.add( L );
			if ( ! p ) break;
			p.visible = false;
			p.pose = restPose();
			const a = hash( i * 2.1 + 0.3 ) * Math.PI * 2;
			this.people.push( {
				p, i, kind, exit: EXITS[ i % EXITS.length ], lens: r() < 0.62 ? 0 : 1,
				ring: { a, r: 3.6 + hash( i * 3.7 ) * 2.2 },
				// the front of the ring crouches, the back holds them up high
				stance: kind !== 'photo' ? kind : hash( i * 5.3 ) < 0.35 ? 'crouch' : hash( i * 5.3 ) < 0.65 ? 'high' : 'shoot',
				subject: SUBJECTS[ i % SUBJECTS.length ], side: ( hash( i * 9.1 ) - 0.5 ) * 2.4, dist: 2.6 + hash( i * 4.4 ) * 2.2,
				last: null,
			} );

		}

	}

	// the press's night: only at the last out. cel: the celebration's time (null outside it); actors: the
	// Director's this frame (where the players are)
	update( cel, actors, dt, cam ) {

		const on = cel != null && cel > 2;
		// (nothing to do all night until the last out)
		if ( ! on && ! this._was ) return;
		this._was = on;
		for ( const q of this.people ) {

			const p = q.p;
			if ( ! on ) {

				p.visible = false;
				q.last = null;
				continue;

			}

			// out of the well, a couple of seconds after it (the TV men first), running for the pile
			const t0 = 2 + ( q.kind === 'photo' ? 0.6 + hash( q.i * 1.3 ) * 3.5 : 0.3 ), tt = cel - t0;
			if ( tt < 0 ) {

				p.visible = false;
				continue;

			}

			const ring = [ PILE[ 0 ] + Math.cos( q.ring.a ) * q.ring.r, PILE[ 1 ] + Math.sin( q.ring.a ) * q.ring.r ];
			const run = Math.hypot( ring[ 0 ] - q.exit[ 0 ], ring[ 1 ] - q.exit[ 1 ] ), speed = 5.2;
			let x, z, yaw, moving = false, stance = q.stance;
			if ( tt < run / speed ) {

				const k = tt * speed / run;
				x = q.exit[ 0 ] + ( ring[ 0 ] - q.exit[ 0 ] ) * k;
				z = q.exit[ 1 ] + ( ring[ 1 ] - q.exit[ 1 ] ) * k;
				yaw = Math.atan2( - ( ring[ 0 ] - q.exit[ 0 ] ), - ( ring[ 1 ] - q.exit[ 1 ] ) );
				moving = true;
				stance = 'carry';

			} else {

				// at the pile; then after their man once it's come apart (a few steps off, on one side)
				[ x, z ] = ring;
				yaw = Math.atan2( - ( PILE[ 0 ] - x ), - ( PILE[ 1 ] - z ) );
				const a = actors?.get( q.subject );
				const k = ease( ( cel - 38 - hash( q.i ) * 8 ) / 4 );
				if ( a && k > 0 ) {

					const sa = a.yaw + q.side, fx = a.x - Math.sin( sa ) * q.dist, fz = a.z - Math.cos( sa ) * q.dist;
					x += ( fx - x ) * k;
					z += ( fz - z ) * k;
					yaw = Math.atan2( - ( a.x - x ), - ( a.z - z ) );

				}

			}

			// the gait from how far they went since the last frame
			let step = 0;
			if ( q.last ) step = Math.hypot( x - q.last[ 0 ], z - q.last[ 1 ] );
			q.last = [ x, z ];
			const sp = dt > 0 ? step / dt : 0;
			if ( sp > 0.6 ) moving = true;
			const P = p.pose;
			P.walk = moving ? Math.min( 1, sp / 1.6 ) : 0;
			P.phase += step * 4.5;
			P.drop = stance === 'crouch' && ! moving ? 0.42 : 0;
			P.hipL = P.hipR = stance === 'crouch' && ! moving ? 1.25 : 0;
			P.kneeL = P.kneeR = stance === 'crouch' && ! moving ? 1.9 : 0;
			P.lean = stance === 'crouch' ? 0.2 : 0.04;
			const arms = ARMS[ moving && stance !== 'eng' && stance !== 'boom' ? 'carry' : stance ];
			P.armL = arms[ 0 ];
			P.armR = arms[ 1 ];
			P.propR = q.kind === 'photo' ? PROP.slr : q.kind === 'eng' ? PROP.eng : PROP.boom;
			P.varR = q.lens;
			P.headPitch = stance === 'high' ? - 0.15 : 0.05;
			P.breath = ( cel * 0.3 + q.i * 0.17 ) % 1;
			p.x = x; p.z = z; p.y = 0; p.yaw = yaw;
			if ( ! p.visible ) p.fresh = true;
			p.visible = true;

		}

		this.cast.update( cam );
		void lookAt;

	}

}
