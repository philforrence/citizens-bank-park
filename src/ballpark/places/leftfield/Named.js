import { PROP, TOP, COLOR, HAT, CHEST, BACK } from '../Cast.js';
import { GESTURE, armIK } from '../Concourse3BKit.js';

// Harry the K's people with names (CAST.md, wave 3, H): given their places among the rest (People.js),
// their looks, and a turn of their own over what everyone round them does (m.after, run after the rest of
// their pose each time they move). Invented, all of them; the stories grounded in the nights.
const fract = ( x ) => x - Math.floor( x );
// the radio held to the left ear; the hands cupped to the mouth, yelling; a hug for the one beside
const RADIO = [ armIK( - 1, [ - 0.1, 1.57, - 0.02 ] ), null ];
const YELL = [ armIK( - 1, [ - 0.05, 1.52, - 0.2 ] ), armIK( 1, [ 0.05, 1.52, - 0.2 ] ) ];
const HUG = [ armIK( - 1, [ - 0.2, 1.42, - 0.25 ] ), armIK( 1, [ 0.42, 1.44, - 0.1 ] ) ];
const CRAWFORD = '408307', LONGORIA = '446334';

export function named( P ) {

	const L = P.list, S = P.H.spots;
	const restyle = ( m, o ) => {

		if ( ! m ) return null;
		for ( const n of [ 27, 29 ] ) Object.assign( m.looks[ n ], o );
		P.cast.setLook( m.p, m.looks[ m.night ] );
		return m;

	};

	// ---- the bartenders. Vinnie DiNardo, 54, Girard Estates: the lower level's head bartender since the park
	// opened in 2004, eighteen years before that behind a Two Street club's bar; a Yuengling poured before
	// you've asked. Kitty Moran, 44, Mayfair, upstairs: knows the regulars by name and by drink
	const bt = L.filter( ( m ) => m.role === 'bartender' );
	const vinnie = restyle( bt.find( ( m ) => m.spot.y < 10 ), { build: 3, hair: 6, facial: 1, glasses: false, female: false, age: 0 } );
	if ( vinnie ) vinnie.name = 'Vinnie DiNardo';
	const kitty = restyle( bt.find( ( m ) => m.spot.y > 10 ), { female: true, hair: 3, hairStyle: 2, facial: 0, build: 1 } );
	if ( kitty ) kitty.name = 'Kitty Moran';

	// ---- Lou Sabatini, 71, Wissinoming, retired from the Frankford Arsenal: the end stool upstairs, under
	// the Kalas plaque, in his KALAS tee and his tweed cap, the transistor radio at his ear all night (the TVs
	// have FOX; he wants Harry on 1210), a fist for a Phillies run
	const barUp = L.filter( ( m ) => m.role === 'sit' && m.spot.y > 10 && m.sit > 0.6 && Math.abs( m.spot.z - S.barUp[ 0 ].z ) < 0.1 ).sort( ( a, b ) => b.spot.x - a.spot.x );
	const lou = restyle( barUp[ 0 ], { age: 1, hair: 7, hairStyle: 3, facial: 0, glasses: true, build: 1, top: TOP.nameTee, color: COLOR.red, back: BACK.KALAS, sleeves: COLOR.grey, hat: HAT.cabbie, chest: CHEST.none } );
	if ( lou ) {

		lou.name = 'Lou Sabatini';
		lou.tv = null;
		lou.after = ( m, N ) => {

			const a = m.p.pose;
			a.armL = RADIO[ 0 ];
			a.propL = PROP.radio;
			const R0 = N.result;
			if ( ( R0 && R0.home > 0 && R0.t < 6 ) || N.celebrate ) {

				a.armR = GESTURE.fist[ 1 ];
				a.propR = 0;
				a.mouth = 0.6;
				return;

			}

			a.headYaw = 0.25;
			a.headPitch = 0.2;

		};

	}

	// ---- the Delco boys at the patio's rail straight over left field: Brendan Quinn, 27, Havertown (UTLEY),
	// Matt 'Tank' Tancredi, 28, Drexel Hill (WERTH), Shane McGrath, 26, Upper Darby (his Flyers jacket): on
	// Carl Crawford all night in the bottom halves (he's right below them in left), and 'EVA! EVA!' at
	// Longoria (the Inquirer's blog had the park calling him that)
	const rail = L.filter( ( m ) => m.rail && m.spot.y > 10 && Math.abs( m.spot.z - S.patioRail[ 0 ].z ) < 0.5 ).sort( ( a, b ) => a.spot.x - b.spot.x );
	const mid = Math.floor( rail.length * 0.55 );
	const looks = [
		{ top: TOP.homeJersey, color: COLOR.white, back: BACK.UTLEY, chest: CHEST.script, hat: HAT.capRed, age: 0, female: false, facial: 4, build: 2 },
		{ top: TOP.nameTee, color: COLOR.red, back: BACK.WERTH, chest: CHEST.none, hat: HAT.capBack, age: 0, female: false, facial: 3, build: 3 },
		{ top: TOP.flyers, color: COLOR.orange, back: 0, chest: CHEST.flyers, hat: HAT.knitBlack, age: 0, female: false, facial: 0, build: 1 },
	];
	[ 'Brendan Quinn', 'Matt Tancredi', 'Shane McGrath' ].forEach( ( name, i ) => {

		const m = restyle( rail[ mid + i ], looks[ i ] );
		if ( ! m ) return;
		m.name = name;
		m.drink = PROP.beer;
		m.after = ( mm, N ) => {

			const snap = N.snap || {}, t = P.time + i * 1.3;
			const a = mm.p.pose;
			const crawford = snap.half === 'bottom' && ! N.celebrate && ! N.between;
			const eva = snap.half === 'top' && String( snap.batter ) === LONGORIA && ! N.celebrate;
			if ( ! crawford && ! eva ) return;
			// in turns: the hands cupped, a point down at him, the beer raised; at Longoria all three together
			const w = fract( t / ( eva ? 2.2 : 9 ) + i * 0.33 );
			if ( w < ( eva ? 0.7 : 0.3 ) ) {

				a.armL = YELL[ 0 ]; a.armR = YELL[ 1 ];
				a.propL = 0; a.propR = 0;
				a.mouth = 0.7 + 0.3 * Math.sin( t * 9 );
				a.headPitch = 0.25;
				a.lean = 0.3;

			} else if ( w < 0.45 && ! eva ) {

				a.armR = GESTURE.point[ 1 ];
				a.propR = 0;
				a.mouth = 0.5;

			}

		};

	} );

	// ---- Nina Castellano, 29, Northern Liberties, and Derek Hsu, 30, a resident at Penn: a first date that
	// he got Series tickets for, at a high-top by the upstairs windows; she's in his fleece by the 29th, they
	// look at each other more than at the game, and at the last out they kiss
	const win = L.filter( ( m ) => m.role === 'sit' && m.spot.y > 10 && Math.abs( m.spot.z - S.tablesUp[ 0 ].z ) < 0.2 ).sort( ( a, b ) => a.spot.x - b.spot.x );
	for ( let k = 0; k + 1 < win.length; k ++ ) {

		if ( Math.abs( win[ k ].spot.x - win[ k + 1 ].spot.x ) > 1.2 ) continue;
		const [ a, b ] = [ win[ k ], win[ k + 1 ] ];
		restyle( a, { female: true, age: 0, hair: 0, hairStyle: 1, facial: 0, top: TOP.jacket, color: COLOR.red, hat: HAT.none, glasses: false, build: 0 } );
		a.looks[ 29 ].top = TOP.fleece;
		a.looks[ 29 ].color = COLOR.navy;
		restyle( b, { female: false, age: 0, skin: 4, hair: 0, hairStyle: 0, facial: 0, top: TOP.homeJersey, color: COLOR.white, back: BACK.HAMELS, chest: CHEST.script, hat: HAT.capRed, glasses: true, build: 0 } );
		a.name = 'Nina Castellano';
		b.name = 'Derek Hsu';
		for ( const [ m, side ] of [ [ a, 1 ], [ b, - 1 ] ] ) {

			m.tv = null;
			m.after = ( mm, N ) => {

				const p = mm.p.pose, t = P.time;
				if ( ! N.celebrate && ! ( ( N.mood?.cheer || 0 ) > 0.4 ) ) {

					p.headYaw = side * ( fract( t / 11 ) < 0.7 ? - 1.0 : - 0.2 );
					p.twist = - side * 0.25;
					p.mouth = fract( t / 3.1 + ( side > 0 ? 0 : 0.5 ) ) < 0.5 ? Math.max( 0, 0.4 * Math.sin( t * 7 ) ) : 0;

				}

				if ( N.celebrate && N.celebrateT > 2 && N.celebrateT < 9 ) {

					p.armL = HUG[ 0 ]; p.armR = HUG[ 1 ];
					p.propL = p.propR = 0;
					p.headYaw = side * - 1.1;
					p.lean = 0.2;

				}

			};

		}

		break;

	}

	// ---- Vince Pagliaro, 45, Folcroft, a Local 98 electrician; Carla, 43; Anthony, 12, his glove on all night;
	// Lucia, 8: a four-top downstairs, their first World Series
	const at = ( t ) => L.filter( ( m ) => m.role === 'sit' && m.spot.y < 10 && Math.hypot( m.spot.x - t.x, m.spot.z - t.z ) < 0.8 );
	const fam = S.tablesDn.find( ( t ) => at( t ).length >= 4 );
	if ( fam ) {

		const F = [
			[ 'Vince Pagliaro', { age: 0, female: false, build: 3, facial: 2, top: TOP.work, color: COLOR.tan, hat: HAT.capRed } ],
			[ 'Carla Pagliaro', { age: 0, female: true, hairStyle: 1, facial: 0, top: TOP.puffer, color: COLOR.black, hat: HAT.knitRed } ],
			[ 'Anthony Pagliaro', { age: 2, female: false, facial: 0, top: TOP.nameTee, color: COLOR.red, back: BACK.HOWARD, hat: HAT.capRed, build: 0 } ],
			[ 'Lucia Pagliaro', { age: 2, female: true, hairStyle: 2, facial: 0, top: TOP.hoodie, color: COLOR.pink, hat: HAT.earmuffs, build: 0 } ],
		];
		at( fam ).slice( 0, 4 ).forEach( ( m, i ) => {

			restyle( m, F[ i ][ 1 ] );
			m.name = F[ i ][ 0 ];
			if ( F[ i ][ 1 ].age === 2 ) {

				m.p.scale = i === 2 ? 0.8 : 0.66;
				m.drink = PROP.soda;
				m.food = PROP.hotdog;

			}

			if ( i === 2 ) m.after = ( mm ) => {

				if ( ! mm.p.pose.propL ) mm.p.pose.propL = PROP.glove;

			};

		} );

	}

	// ---- Marcy Delgado, 34, from Brandon, Florida, in Carl Crawford's road grey, and Jake Moretti, 35,
	// Collingswood, in a Howard shirt: at the counter over the 140s, where she can watch Crawford play left;
	// her arms up for a Rays run, alone in a sea of red, folded for the Phillies'
	const cnt = L.filter( ( m ) => m.role === 'sit' && m.spot.y < 10 && m.sit > 0.6 ).sort( ( a, b ) => a.spot.x - b.spot.x );
	for ( let k = 0; k + 1 < cnt.length; k ++ ) {

		if ( Math.abs( cnt[ k ].spot.x - cnt[ k + 1 ].spot.x ) > 0.9 || cnt[ k ].spot.x > - 4 ) continue;
		const [ a, b ] = [ cnt[ k ], cnt[ k + 1 ] ];
		restyle( a, { female: true, age: 0, skin: 3, hair: 0, hairStyle: 2, facial: 0, top: TOP.rays, color: COLOR.lightGrey, back: BACK.CRAWFORD, chest: CHEST.rays, hat: HAT.capRays, build: 1 } );
		restyle( b, { female: false, age: 0, facial: 4, top: TOP.nameTee, color: COLOR.red, back: BACK.HOWARD, hat: HAT.capRed, build: 2 } );
		a.name = 'Marcy Delgado';
		b.name = 'Jake Moretti';
		a.tr = { stand: 2, cheer: 2, clap: 2, towel: 2 };
		a.towel = false;
		a.after = ( mm, N ) => {

			const R0 = N.result, p = mm.p.pose;
			if ( R0 && R0.away > 0 && R0.t < 6 ) {

				p.armL = GESTURE.cheer[ 0 ]; p.armR = GESTURE.cheer[ 1 ];
				p.propL = p.propR = 0; p.mouth = 0.8;

			} else if ( ( R0 && R0.home > 0 && R0.t < 8 ) || N.celebrate ) {

				p.armL = GESTURE.fold[ 0 ]; p.armR = GESTURE.fold[ 1 ];
				p.propL = p.propR = 0; p.mouth = 0;

			}

			// up to see a ball hit to left when Crawford's out there
			const snap = N.snap || {};
			if ( snap.half === 'bottom' && N.ball && N.ball[ 0 ] < - 30 && N.ball[ 2 ] < - 60 ) p.headPitch = - 0.1;

		};
		break;

	}

	// ---- the staff by name: Gloria Santangelo, 63, Prospect Park, the host ('right this way, hon'); the
	// servers Angela Ricci, 31, South Philly (downstairs), and Marcus Bell, 23, a Temple junior (upstairs)
	if ( P.host ) P.host.name = 'Gloria Santangelo';
	if ( P.servers?.[ 0 ] ) P.servers[ 0 ].name = 'Angela Ricci';
	if ( P.servers?.[ 2 ] ) {

		P.servers[ 2 ].name = 'Marcus Bell';
		restyle( P.servers[ 2 ], { female: false, hairStyle: 0, skin: 5, hair: 0, facial: 2 } );

	}

	void CRAWFORD;

}
