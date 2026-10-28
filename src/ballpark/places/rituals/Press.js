import { Cast, TOP, COLOR, HAT, GEAR, PROP, restPose, lookAt } from '../Cast.js';
import { armIK, rng, pick } from '../Concourse3BKit.js';
import { PILE, STAGE } from '../../game/Celebration.js';

// The press at the last out (Getty 83571364, John Iacono's: the photographers in among the hugs with
// their long zooms, a flash on top; a FOX handheld on the shoulder; the boom mic in its fuzzy
// windscreen over the heads; credentials on lanyards, bags at the hip): out of the camera wells at the
// dugouts' ends from ten seconds after the strikeout on (FR1), round the pile in a ring, crouched in front and
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

// ---- FB4 (C4B-1): the pit in front of the stage. A point in the stage's own frame (x along its front,
// z out of its front: STAGE.point's inverse)
const stageLocal = ( x, z ) => {

	const c = Math.cos( STAGE.yaw ), s = Math.sin( STAGE.yaw ), dx = x - STAGE.at[ 0 ], dz = z - STAGE.at[ 1 ];
	return [ dx * c - dz * s, dx * s + dz * c ];

};
// how far outside the deck's footprint a point is (negative inside)
const offDeck = ( lx, lz ) => Math.max( Math.abs( lx ) - STAGE.W / 2, Math.abs( lz ) - STAGE.D / 2 );
// ---- end FB4
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
				// (---- FR1, C2B-21: no cap worn backwards. Cast's backwards cap drew a metre or two off its
				// wearer's head on the near figure, the "thrown caps hanging in the air for minutes" round the
				// stage and the pile: gauntlet r2 FR1, shots Q1 and Q3. The draw itself is Cast.js's; its share
				// here goes to the black caps)
				hat: HAT[ pick( r, { none: 34, capBlack: 26, capNavy: 14, knitBlack: 14, knitGrey: 6, capRed: 6 } ) ], poncho: 0,
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
	update( cel, actors, dt, kalas = null, cam = null ) {

		const on = cel != null && cel > 2;
		// (nothing to do all night until the last out)
		if ( ! on && ! this._was ) return;
		this._was = on;
		for ( const q of this.people ) {

			const p = q.p;
			if ( ! on ) {

				p.visible = false;
				q.last = null;
				q.pit = q.f = null; // ---- FB4
				continue;

			}

			// ---- FR1 (C2B-21): out of the wells once security lets them, not at the strikeout: the players had
			// the pile to themselves for the first seconds (puffygreenjacket 2993510687, ~20 s on: the first
			// photographers just reaching the grass; FOX's high first frame of the pile, t16330s: four or five
			// round it); FOX's handhelds and the boom first, at 9-13 s, then the photographers in a stream
			// over the next forty seconds, the crush thickening as the pile comes apart
			const t0 = q.kind === 'photo' ? 12 + 38 * Math.pow( hash( q.i * 1.3 ), 1.3 ) : 9 + hash( q.i * 2.7 ) * 4, tt = cel - t0;
			// ---- end FR1
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
				// (a third of them round Harry Kalas while he sings)
				const a = kalas && q.i % 3 === 0 ? kalas : actors?.get( q.subject );
				// (FR1: the late ones shoot what's left of the pile a moment before going after their man)
				const k = ease( ( cel - Math.max( 38 + hash( q.i ) * 8, t0 + run / speed + 2.5 ) ) / 4 );
				if ( a && k > 0 ) {

					const sa = a.yaw + q.side;
					let fx = a.x - Math.sin( sa ) * q.dist, fz = a.z - Math.cos( sa ) * q.dist;
					// ---- FB4 (C4B-1): once his man is up on the stage (Manuel's interview, the players and the
					// trophy), or the place he'd shoot from is on the deck, he works from the pit along its front,
					// pressed against it and shooting up, as the press did (Getty 83570999, puffygreenjacket
					// 2994338984: a row of them along the front, cameras up). He'd followed at y 0 into the deck's
					// footprint, his head through it (C4B's D-cel-192: 11 of them in it at 186 s). The pit's two
					// rows leave the way to the stairs at its left end clear, and the players' crowd behind them
					const [ flx, flz ] = stageLocal( fx, fz );
					const want = Math.max( Math.min( 1, Math.max( 0, ( a.y || 0 ) / 0.5 ) ), Math.min( 1, Math.max( 0, ( 1.2 - offDeck( flx, flz ) ) / 0.6 ) ) );
					q.pit = dt > 0 && q.pit != null ? q.pit + Math.max( - dt / 1.5, Math.min( dt / 1.5, want - q.pit ) ) : want;
					if ( want > 0.5 ) {

						const col = Math.floor( q.i / 2 ) % 13, row = q.i % 2;
						[ fx, fz ] = STAGE.point( - 1.8 + col * 0.4 + row * 0.2 + ( hash( q.i * 7.7 ) - 0.5 ) * 0.12, STAGE.D / 2 + 0.42 + row * 0.55 + hash( q.i * 3.1 ) * 0.1 );

					}

					// he gets there at a hurried walk: when his man turns round, or goes up, the place he'd shoot
					// from swings metres at once (they'd jumped 4-9 m in a frame at the gather, 120-124 s); at once
					// after a seek
					if ( dt > 0 && q.f ) {

						const gx = fx - q.f[ 0 ], gz = fz - q.f[ 1 ], g = Math.hypot( gx, gz ), mv = Math.min( g, 3.2 * dt );
						if ( g > 1e-6 ) { q.f[ 0 ] += gx / g * mv; q.f[ 1 ] += gz / g * mv; }

					} else q.f = [ fx, fz ];
					// (and never on the deck: round it, along its nearest edge)
					const [ lx, lz ] = stageLocal( q.f[ 0 ], q.f[ 1 ] );
					if ( offDeck( lx, lz ) < 0.3 ) {

						const ex = Math.abs( lx ) - STAGE.W / 2, ez = Math.abs( lz ) - STAGE.D / 2;
						q.f = ex > ez ? STAGE.point( Math.sign( lx ) * ( STAGE.W / 2 + 0.3 ), lz ) : STAGE.point( lx, Math.sign( lz ) * ( STAGE.D / 2 + 0.3 ) );

					}

					[ fx, fz ] = q.f;

					// (nobody crouches below the deck's edge: up on their toes, the long lenses held up)
					if ( q.pit > 0.5 && stance === 'crouch' ) stance = 'shoot';
					// ---- end FB4
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
			P.headPitch = stance === 'high' ? - 0.15 : q.pit > 0.5 ? - 0.2 : 0.05; // (---- FB4: up at the deck from the pit)
			P.breath = ( cel * 0.3 + q.i * 0.17 ) % 1;
			p.x = x; p.z = z; p.y = 0; p.yaw = yaw;
			if ( ! p.visible ) p.fresh = true;
			p.visible = true;

		}

		this.cast.update( cam );
		void lookAt;

	}

}
