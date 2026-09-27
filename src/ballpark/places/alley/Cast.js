import { Mesh, SphereGeometry, Color, Vector3 } from '../../../engine/index.js';
import { standard } from '../../../materials/Materials.js';
import { LEVELS } from '../../layout.js';
import { TOP, HAT, PANTS } from './Folk.js';
import { SIGN } from './Signs.js';
import { lookAt } from '../Cast.js';

// The Alley's people on the two nights, and what they do as the replay goes. Invented, all of them, in
// the spirit of the photographs: the rail over the visitors' pen packed three deep on the 29th, thinned
// by the rain on the 27th; the hecklers; a family on their first World Series; a man who's been going
// since the Vet opened; a couple under one umbrella; the odd brave Rays fan; people reading Memory Lane,
// a photo at the Ashburn statue, the walk up and down between the stands.
//
//   const cast = new Cast( { folk, rail, zFront, ... } );  cast.update( dt, director, w, pens )

const STREET = LEVELS.mainConcourse;

// a seeded random
function rng( seed ) {

	let s = seed >>> 0;
	return () => {

		s = ( s * 1664525 + 1013904223 ) >>> 0;
		return s / 4294967296;

	};

}

// a random fan's clothes: mostly Phillies red, jerseys with their men's numbers, the cold-weather gear;
// `wet`: out in the rain (the 27th)
function fan( r, { poncho = false, open = false } = {} ) {

	const u = r();
	let top, jersey;
	if ( u < 0.24 ) top = TOP.redHoodie;
	else if ( u < 0.36 ) top = TOP.redJacket;
	else if ( u < 0.5 ) {

		top = TOP.homeJersey;
		jersey = [ 'UTLEY', 'HOWARD', 'ROLLINS', 'HAMELS', 'VICTORINO', 'LIDGE', 'WERTH', 'BURRELL', 'MYERS', 'RUIZ', 'ASHBURN' ][ Math.floor( r() * 11 ) ];

	} else if ( u < 0.57 ) {

		top = TOP.roadJersey;
		jersey = [ 'UTLEY-R', 'HOWARD-R', 'ROLLINS-R', 'HAMELS-R' ][ Math.floor( r() * 4 ) ];

	} else if ( u < 0.64 ) top = TOP.greyHoodie;
	else if ( u < 0.7 ) top = TOP.wsShirt;
	else if ( u < 0.76 ) top = TOP.leather;
	else if ( u < 0.82 ) top = TOP.parka;
	else if ( u < 0.86 ) {

		top = TOP.eagles;
		if ( r() < 0.4 ) jersey = r() < 0.5 ? 'DAWKINS' : 'MCNABB';

	} else if ( u < 0.9 ) top = TOP.carhartt;
	else if ( u < 0.93 ) {

		top = TOP.powderBlue;
		jersey = r() < 0.6 ? 'SCHMIDT' : 'CARLTON';

	} else if ( u < 0.96 ) top = TOP.flyers;
	else top = TOP.camo;
	const hats = [ HAT.cap, HAT.cap, HAT.cap, HAT.beanie, HAT.beanie, HAT.wsCap, HAT.none, HAT.none, HAT.greyBeanie, HAT.backwards, HAT.hood ];
	const hat = hats[ Math.floor( r() * hats.length ) ];
	const woman = r() < 0.34;
	return {
		top, jersey, hat: woman && hat === HAT.backwards ? HAT.cap : hat, pants: r() < 0.72 ? PANTS.jeans : [ PANTS.khaki, PANTS.black, PANTS.sweats, PANTS.dark ][ Math.floor( r() * 4 ) ],
		woman, glasses: r() < 0.14, beard: ! woman && r() < 0.18, mustache: ! woman && r() < 0.08, poncho, open,
	};

}

export class Cast {

	// rail: the rail's path over the pens ([ [ x, z ] ... ], field side toward home); statue [ x, z ];
	// lanes for the walkers; zFront the storefronts' line
	constructor( { parent, folk, rail, zFront, statue, memoryLane, picnic, roof } ) {

		this.folk = folk;
		this.people = [];
		this.walkers = [];
		const F = folk;
		const r = rng( 20081029 );
		// the rail: a point a way along its path, and the way to face (the field)
		// (rail: { pts, drops }: the line and, for each stretch, the way the drop is, the way they face)
		const seg = [];
		let len = 0;
		for ( let i = 0; i < rail.pts.length - 1; i ++ ) {

			const [ ax, az ] = rail.pts[ i ], [ bx, bz ] = rail.pts[ i + 1 ];
			const l = Math.hypot( bx - ax, bz - az );
			seg.push( { a: rail.pts[ i ], b: rail.pts[ i + 1 ], l, s0: len, n: rail.drops[ i ] } );
			len += l;

		}

		this.railLen = len;
		// d: metres along the rail from its batter's-eye end; back: how far behind it (the Alley side)
		const railAt = ( d, back = 0.55 ) => {

			const g = seg.find( ( sg ) => d <= sg.s0 + sg.l ) || seg[ seg.length - 1 ];
			const k = Math.max( 0, Math.min( 1, ( d - g.s0 ) / g.l ) );
			const x = g.a[ 0 ] + ( g.b[ 0 ] - g.a[ 0 ] ) * k - g.n[ 0 ] * back, z = g.a[ 1 ] + ( g.b[ 1 ] - g.a[ 1 ] ) * k - g.n[ 1 ] * back;
			return { x, z, yaw: Math.atan2( - g.n[ 0 ], - g.n[ 1 ] ), n: g.n };

		};

		this.railAt = railAt;
		const add = ( pair, at, look, o = {} ) => {

			const p = F.add( pair, { x: at.x, y: at.y ?? STREET, z: at.z, yaw: ( at.yaw ?? 0 ) + ( o.turn || 0 ), look, k: o.k || 0, scale: o.scale || ( look.woman ? 0.94 : 1 ) * ( 0.96 + 0.08 * r() ), nights: o.nights ?? 3 } );
			p.role = o.role || 'fan';
			p.base = { x: p.x, y: p.y, z: p.z };
			this.people.push( p );
			return p;

		};

		// ---- the named ones

		// Joey Cataldi, 34, a roofer from Fishtown: over the visitors' mound, working on whoever is up in
		// their pen. No poncho on the 27th (soaked, and says it's nothing)
		const dJoey = len - 5.2;
		this.joey = add( 'lean', railAt( dJoey ), { top: TOP.redHoodie, hat: HAT.backwards, beard: true, open: true }, { role: 'heckler' } );
		// Mikey Dougherty, his buddy since St. Laurentius, with the beers, laughing at him
		this.mikey = add( 'lean', railAt( dJoey + 0.7 ), { top: TOP.carhartt, hat: HAT.beanie, open: true }, { role: 'buddy' } );
		F.hold( this.mikey, 'cup', { hand: 'left', variant: 0 } );
		// Tommy Nolan's sign, a different one each night
		this.tommy = [ 1, 2 ].map( ( night ) => add( 'sign', railAt( dJoey - 2.2, 0.75 ), { top: TOP.greyHoodie, hat: HAT.cap, glasses: true, poncho: night === 1, open: true }, { nights: night, role: 'sign' } ) );
		F.hold( this.tommy[ 0 ], 'sign', { hand: 'both', variant: SIGN.notLeaving } );
		F.hold( this.tommy[ 1 ], 'sign', { hand: 'both', variant: SIGN.rainCheck } );
		// the Szymanskis from Mayfair, their first World Series (the 29th: the tickets were his father's):
		// Josh, 9, at the rail with his glove, hoping; Rich crouched beside him pointing out who's who in the
		// pens; Linda with the camera
		const dKid = ( seg[ 3 ] || seg[ seg.length - 1 ] ).s0 + 4.5; // over the visitors' bench, the cave under the Alley's deck
		const kidAt = railAt( dKid, 0.42 );
		this.josh = add( 'rail', kidAt, { top: TOP.kidRed, hat: HAT.cap, kid: true, pants: PANTS.jeans }, { nights: 2, role: 'kid' } );
		F.hold( this.josh, 'glove', { hand: 'left' } );
		this.rich = add( 'crouch', { ...railAt( dKid + 0.55, 0.62 ), yaw: kidAt.yaw - 0.35 }, { top: TOP.carhartt, hat: HAT.cap, beard: true }, { nights: 2, role: 'dad' } );
		this.linda = add( 'photo', { ...railAt( dKid - 1.6, 1.4 ), yaw: kidAt.yaw + 0.8 }, { top: TOP.redJacket, woman: true, hat: HAT.none }, { nights: 2, role: 'mom' } );
		F.hold( this.linda, 'camera', { hand: 'both', variant: 1, offset: [ 0, 0.02, - 0.02 ] } );
		// Walt Brennan, 71, retired from the Budd Company: a season ticket since the Vet opened in 1971;
		// the 1980 satin jacket, the cabbie cap; under his golf umbrella on the 27th
		const waltAt = railAt( 1.2, 0.6 );
		this.walt = [ add( 'umbrella', waltAt, { top: TOP.redJacket, hat: HAT.cabbie, glasses: true, mustache: true, pants: PANTS.khaki }, { nights: 1, role: 'walt', k: 0 } ), add( 'pockets', waltAt, { top: TOP.redJacket, hat: HAT.cabbie, glasses: true, mustache: true, pants: PANTS.khaki }, { nights: 2, role: 'walt' } ) ];
		F.hold( this.walt[ 0 ], 'umbrella', { variant: 2 } );
		// Carlos Reyes, a Rays fan from St. Petersburg, the Rays' own town (his cowbell), with Gina Russo, born in Delco, in her Utley
		// jersey: she's been ribbing him all night
		const cgAt = railAt( 15.5, 1.9 );
		this.carlos = add( 'cheer', { ...cgAt, yaw: cgAt.yaw - 0.6 }, { top: TOP.rays, hat: HAT.raysCap }, { role: 'rays', k: 0 } );
		F.hold( this.carlos, 'cowbell', { hand: 'right', offset: [ 0, - 0.02, 0 ] } );
		this.gina = add( 'idle', { x: cgAt.x + 0.55, z: cgAt.z - 0.25, yaw: cgAt.yaw - 1.9 }, { top: TOP.homeJersey, jersey: 'UTLEY', woman: true, hat: HAT.beanie }, { role: 'gina' } );
		// Steve and Donna, married in '80 the week of the parade, sharing one umbrella on the 27th
		const sdAt = railAt( 4.4, 0.6 );
		this.steve = add( 'umbrella', sdAt, { top: TOP.parka, hat: HAT.hood, poncho: true, open: true }, { nights: 1, role: 'couple' } );
		F.hold( this.steve, 'umbrella', { variant: 1 } );
		this.donna = add( 'rail', railAt( 5.0, 0.55 ), { top: TOP.redHoodie, woman: true, hat: HAT.hood, poncho: true, open: true }, { nights: 1, role: 'couple' } );

		// ---- the rail filled round them
		const taken = [ dJoey, dJoey + 0.7, dJoey - 2.2, dKid, dKid + 0.55, 1.2, 4.4, 5.0 ];
		for ( let d = 0.6; d < len - 0.4; d += 0.66 ) {

			if ( taken.some( ( t ) => Math.abs( t - d ) < 0.5 ) ) continue;
			for ( let row = 0; row < 3; row ++ ) {

				// the 29th: three deep over the pen; the 27th: a few at the rail in ponchos
				const night29 = true;
				if ( row > 0 && r() < ( row === 1 ? 0.25 : 0.6 ) ) continue;
				const at = railAt( d + ( row ? ( r() - 0.5 ) * 0.4 : 0 ), 0.55 + row * 0.62 );
				const pair = row === 0 ? ( r() < 0.55 ? 'rail' : 'lean' ) : ( r() < 0.5 ? 'cheer' : r() < 0.6 ? 'carry' : 'idle' );
				const p = add( pair, { ...at, yaw: at.yaw + ( r() - 0.5 ) * 0.5 }, fan( r ), { nights: night29 ? 2 : 3, k: pair === 'cheer' ? 0.15 : 0 } );
				if ( pair === 'carry' ) F.hold( p, r() < 0.5 ? 'hoagie' : 'cup', { hand: r() < 0.5 ? 'right' : 'both', variant: Math.floor( r() * 2 ) } );
				if ( pair === 'cheer' && r() < 0.35 ) F.hold( p, 'towel', { hand: 'right', open: 1 } );
				if ( row === 0 && r() < 0.12 ) {

					const q = F.hold( p, 'sign', { hand: 'both', variant: [ SIGN.finishIt, SIGN.years, SIGN.lidge, SIGN.cowbells, SIGN.utley, SIGN.leftWork, SIGN.charlie, SIGN.aquarium, SIGN.fightin, SIGN.frozen, SIGN.since1980 ][ Math.floor( r() * 11 ) ] } );
					q.shown = false; // kept down until something happens
					p.signProp = q;

				}

			}

		}

		// the 27th: a thin line at the rail in the rain
		for ( let d = 2; d < len - 1; d += 2.9 + r() * 2 ) {

			if ( taken.some( ( t ) => Math.abs( t - d ) < 0.7 ) ) continue;
			const at = railAt( d, 0.55 );
			const p = add( r() < 0.5 ? 'rail' : 'lean', at, fan( r, { poncho: r() < 0.6, open: true } ), { nights: 1 } );
			if ( r() < 0.3 ) F.hold( p, 'umbrella', { variant: Math.floor( r() * 3 ) } );

		}

		// ---- Memory Lane: people reading the panels, one explaining 1950 to his son
		for ( const [ i, m ] of ( memoryLane || [] ).entries() ) {

			const p = add( i % 3 === 1 ? 'point' : 'pockets', { x: m.x, z: m.z, yaw: m.yaw }, fan( r ), { nights: i % 2 ? 2 : 3 } );
			p.role = 'reader';

		}

		// ---- a photo at the Ashburn statue: Nicole in front of it, Brian backing up with the camera
		if ( statue ) {

			const [ sx, sz ] = statue;
			this.posing = add( 'idle', { x: sx + 0.9, z: sz + 1.3, yaw: 0 }, { top: TOP.homeJersey, jersey: 'VICTORINO', woman: true, hat: HAT.cap }, { nights: 2, role: 'pose' } );
			this.shooter = add( 'photo', { x: sx + 1.6, z: sz + 4.6, yaw: Math.PI }, { top: TOP.leather, hat: HAT.none, beard: true }, { nights: 2, role: 'shoot' } );
			F.hold( this.shooter, 'camera', { hand: 'both', variant: 0 } );
			// she faces the camera
			this.posing.yaw = Math.atan2( - ( this.shooter.x - this.posing.x ), - ( this.shooter.z - this.posing.z ) );

		}

		// ---- the picnic tables by Bull's: eating, two a side
		for ( const [ x, z ] of picnic || [] ) {

			for ( const side of [ - 1, 1 ] ) for ( const dx of [ - 0.5, 0.55 ] ) {

				if ( r() < 0.25 ) continue;
				const p = add( 'sit', { x: x + dx, z: z + side * 0.72, yaw: side > 0 ? 0 : Math.PI }, fan( r, { open: true } ), { nights: r() < 0.5 ? 2 : 3, role: 'eat' } );
				F.hold( p, r() < 0.6 ? 'hoagie' : 'cup', { hand: 'right', variant: 1 } );

			}

		}

		// ---- up on the roof decks, along their rail, where there are no bleachers
		for ( const [ x0, x1 ] of roof?.spans || [] ) {

			for ( let x = x0 + 0.4; x < x1 - 0.3; x += 0.62 + r() * 0.3 ) {

				if ( r() < 0.2 ) continue;
				const p = add( r() < 0.7 ? 'rail' : 'cheer', { x, y: roof.y, z: roof.z - 0.45, yaw: Math.PI }, fan( r, { poncho: false, open: true } ), { nights: r() < 0.3 ? 3 : 2 } );
				p.role = 'roof';

			}

		}

		// ---- up and down the walk: both ways, in lanes clear of the posts, the statue, the tables
		const lanes = [ zFront + 3.4, zFront + 5.4, zFront + 6.9 ];
		// (the 29th's forty, the 27th's fourteen: ponchos and umbrellas, hurrying)
		for ( let i = 0; i < 54; i ++ ) {

			const wet = i >= 40;
			const lane = lanes[ i % lanes.length ] + ( r() - 0.5 ) * 0.8;
			const p = add( 'walk', { x: - 60 + r() * 120, z: lane, yaw: 0 }, fan( r, { poncho: wet && r() < 0.55, open: wet } ), { nights: wet ? 1 : 2 } );
			p.walk = { dir: r() < 0.5 ? - 1 : 1, speed: ( wet ? 1.3 : 1.05 ) + r() * 0.5, lane, phase: r() * 6.28, x0: - 62, x1: 58 };
			if ( r() < 0.35 ) F.hold( p, r() < 0.5 ? 'cup' : r() < 0.5 ? 'hoagie' : 'bag', { hand: r() < 0.5 ? 'right' : 'left', variant: Math.floor( r() * 2 ) } );
			else if ( wet && r() < 0.6 ) F.hold( p, 'umbrella', { variant: Math.floor( r() * 3 ), open: 1 } );
			this.walkers.push( p );

		}

		// the 27th: the rain drives them in under the stands' canopies, two and three together between the
		// counters' lines, on the phone, stamping their feet, waiting it out
		for ( let x = - 58.5; x < 58; x += 5.1 + r() * 3 ) {

			if ( x > - 9 && x < 3 ) continue; // the gap by the statue: no canopy
			for ( let k = 0; k < 2 + Math.floor( r() * 2 ); k ++ ) {

				const p = add( r() < 0.3 ? 'photo' : 'pockets', { x: x + k * 0.55, z: zFront + 0.75 + r() * 0.4, yaw: ( r() - 0.5 ) * 2.4 }, fan( r, { poncho: r() < 0.5 } ), { nights: 1, k: 1 } );
				p.role = 'huddle';

			}

		}

		// the 29th's last out: strangers in the middle of the walk hugging, arms up, jumping (shown then)
		for ( let i = 0; i < 18; i ++ ) {

			const x = - 52 + i * 6.2 + ( r() - 0.5 ) * 2, z = zFront + 4.2 + ( r() - 0.5 ) * 3;
			if ( Math.abs( x + 2 ) < 3 ) continue;
			for ( const k of [ 0, 1 ] ) {

				const p = add( 'cheer', { x: x + k * 0.5, z, yaw: k ? Math.PI / 2 + 0.3 : - Math.PI / 2 - 0.3 }, fan( r ), { nights: 2, k: 1 } );
				p.role = 'party';

			}

		}

		// the ball: a Rays bullpen catcher tosses one up to Josh between halves on the 29th
		this.ball = new Mesh( new SphereGeometry( 0.037, 10, 8 ), standard( { name: 'alley-toss-ball', color: new Color( 0.8, 0.79, 0.75 ), roughness: 0.5 } ) );
		this.ball.userData.dynamic = true;
		this.ball.visible = false;
		this.ball.name = 'alley-toss-ball';
		parent.add( this.ball );
		this._v = new Vector3();

	}

	// the moments to react to: when the runs scored (and whose), from the replay's results
	_events( director ) {

		if ( this.events ) return this.events;
		this.events = [];
		for ( const s of director.segments ) {

			if ( s.kind !== 'result' ) continue;
			const c = s.cues?.[ 0 ]?.[ 1 ];
			if ( c && c.scored > 0 ) this.events.push( { t: s.t0, home: c.batting === 'home', hr: /homers/.test( c.result?.desc || '' ) } );

		}

		// the toss: the break before the top of the 7th on the 29th
		const sw = director.segments.find( ( s ) => s.kind === 'switch' && s.snap.inning === 7 && s.snap.half === 'top' );
		this.tossT = sw ? sw.t0 + 7 : - 1;
		return this.events;

	}

	// pens: the Pens (who's warming), its toss hook
	update( dt, director, w, pens ) {

		const t = director.t, now = this.time = ( this.time || 0 ) + dt;
		const ev = this._events( director );
		const night = w.night === 27 ? 1 : 2;
		// the last run scored, and how long ago
		let last = null;
		for ( const e of ev ) if ( e.t <= t ) last = e;
		const since = last ? t - last.t : 1e9;
		const phillies = last?.home && since < 9, rays = last && ! last.home && since < 9;
		const cel = w.celebrate, lt = w.lt;
		const raysUp = pens?.warming?.away, philsUp = pens?.warming?.home, lidgeUp = pens?.warmingId?.home === 400058;
		// the suspension: they drift away from the rail as it's called
		const leaving = w.suspended ? Math.min( 1, lt / 20 ) : 0;
		const pulse = ( rate, seed ) => 0.5 + 0.5 * Math.sin( now * rate + seed * 40 );
		const jump = ( p ) => Math.max( 0, Math.sin( now * 7 + p.seed * 30 ) ) * 0.14;
		for ( const p of this.people ) {

			p.visible = ( p.nights & night ) !== 0 && ! ( leaving > 0 && p.seed < leaving * 0.8 && p.role !== 'walt' && p.role !== 'heckler' ) && ( p.role !== 'party' || cel );
			if ( ! p.visible ) continue;
			p.y = p.base.y;
			const excited = cel ? 1 : phillies ? Math.max( 0, 1 - since / 9 ) : 0;
			switch ( p.pair ) {

				case 'rail':
				case 'cheer':
					p.k = cel ? 0.75 + 0.25 * Math.sin( now * 8 + p.seed * 30 ) : phillies ? Math.min( 1, excited * 1.4 ) : ( p.pair === 'cheer' ? 0.1 + 0.1 * pulse( 0.7, p.seed ) : 0 );
					if ( cel || ( phillies && since < 3 ) ) p.y += jump( p );
					break;
				case 'lean':
					// now and then pointing something out; the hecklers when the Rays have a man up
					p.k = ( p.seed > 0.7 && pulse( 0.4, p.seed ) > 0.85 ) ? 0.8 : 0;
					if ( cel ) p.k = 0.5 + 0.5 * Math.sin( now * 9 + p.seed * 20 );
					break;
				case 'sign':
					p.k = cel || phillies ? pulse( 6, p.seed ) : raysUp ? 0.3 * pulse( 2, p.seed ) : 0;
					break;
				case 'sit':
					// a bite now and then
					p.k = Math.max( 0, Math.sin( now * 0.8 + p.seed * 17 ) ) ** 3;
					break;
				case 'idle':
				case 'pockets':
					p.k = pulse( 0.9, p.seed ) > 0.7 ? 0.6 : 0;
					break;
				case 'point':
					p.k = pulse( 0.3, p.seed ) > 0.5 ? 1 : 0.1;
					break;
				case 'carry':
					p.k = Math.max( 0, Math.sin( now * 0.5 + p.seed * 11 ) ) ** 6;
					break;
				default:
					break;

			}

			// the signs come up when there's something to wave them at
			// (and Lidge's own sign whenever he's up: 48 for 48)
			if ( p.signProp ) p.signProp.shown = cel || phillies || ( raysUp && p.seed > 0.5 ) || ( lidgeUp && p.signProp.variant === SIGN.lidge );
			// when a Phillies reliever gets up the rail turns to watch him and claps him on
			if ( philsUp && ! cel && ! phillies && ( p.pair === 'cheer' || p.pair === 'rail' ) && p.seed > 0.4 ) {

				p.k = p.pair === 'cheer' ? 0.08 * ( 1 + Math.sin( now * 13 + p.seed * 9 ) ) : 0.25 + 0.1 * Math.sin( now * 11 + p.seed * 9 );

			}

		}

		// Joey: at whoever the Rays have up (hands cupped, pointing, a few seconds on, a few off)
		if ( this.joey.visible ) {

			const burst = raysUp ? ( Math.sin( now * 1.1 ) > - 0.2 ? 0.55 + 0.45 * Math.sin( now * 5.3 ) : 0.1 ) : rays ? 0 : 0.05;
			this.joey.k = cel ? 0.5 + 0.5 * Math.sin( now * 9 ) : burst;
			// Mikey doubled over laughing when Joey lands one
			this.mikey.k = raysUp && Math.sin( now * 1.1 - 0.8 ) > 0.6 ? 0.9 : 0.1;

		}

		// Carlos: the cowbell up and ringing when the Rays score; Gina turns to rub it in when the Phillies do
		this.carlos.k = rays ? pulse( 14, 0.2 ) * 0.5 + 0.5 : 0.05;
		this.gina.k = phillies || cel ? 1 : 0.2 * pulse( 0.6, 0.4 );
		if ( cel ) {

			this.carlos.k = 0;
			this.gina.y = this.gina.base.y + jump( this.gina );

		}

		// the Szymanskis: Rich points out the pens (Lidge when he gets up); Linda's camera
		this.rich.k = philsUp ? 1 : 0.4 + 0.4 * Math.sin( now * 0.35 );
		this.josh.k = 0.1;
		// the toss: the catcher comes over under the rail, lobs it up, Josh reaches, has it, holds it up
		this.ball.visible = false;
		if ( this.tossT > 0 && pens ) {

			const T0 = this.tossT, dur = 1.35;
			pens.toss = { t: T0, to: [ this.josh.x, this.josh.z ] };
			const from = pens.tossFrom;
			if ( t > T0 - 0.4 ) this.josh.k = Math.min( 1, ( t - ( T0 - 0.4 ) ) / 0.6 );
			if ( t > T0 + dur ) {

				// he has it: up over his head for a while, then he shows his dad
				this.josh.k = t < T0 + 14 ? 1 : 0.3;
				this.rich.k = t < T0 + 6 ? 1 : this.rich.k;

			}

			if ( from && t >= T0 && t < T0 + dur ) {

				const k = ( t - T0 ) / dur;
				const hand = this.folk.handAt( this.josh, - 1 );
				const to = this._v.set( hand[ 0 ], hand[ 1 ], hand[ 2 ] ).multiplyScalar( this.josh.scale ).applyAxisAngle( new Vector3( 0, 1, 0 ), this.josh.yaw );
				const tx = this.josh.x + to.x, ty = this.josh.y + to.y, tz = this.josh.z + to.z;
				this.ball.position.set( from[ 0 ] + ( tx - from[ 0 ] ) * k, from[ 1 ] + ( ty - from[ 1 ] ) * k + 4 * 1.6 * k * ( 1 - k ), from[ 2 ] + ( tz - from[ 2 ] ) * k );
				this.ball.visible = night === 2;

			}

		}

		// (P0) the rail near him watches the ball go up to Josh
		lookAt( 'alley-toss', this.ball.visible ? { x: this.ball.position.x, y: this.ball.position.y, z: this.ball.position.z, r: 9, k: 0.85 } : null );
		// the walkers
		for ( const p of this.walkers ) {
			// at the last out they stop where they are (the party takes over: this.party)
			if ( cel ) p.visible = false;
			if ( ! p.visible ) continue;
			if ( ! p.visible ) continue;
			const W = p.walk;
			// the suspension: everyone heads for the gates (toward left field)
			if ( w.suspended ) W.dir = - 1;
			p.x += W.dir * W.speed * dt;
			if ( p.x > W.x1 ) {

				W.dir = - 1; p.x = W.x1;

			} else if ( p.x < W.x0 ) {

				W.dir = w.suspended ? - 1 : 1;
				p.x = w.suspended ? W.x1 : W.x0;

			}

			W.phase += dt * W.speed * 5.4;
			p.k = 0.5 + 0.5 * Math.sin( W.phase );
			p.yaw = W.dir > 0 ? - Math.PI / 2 : Math.PI / 2;
			p.z = W.lane + Math.sin( p.x * 0.13 + p.seed * 9 ) * 0.35;

		}

		// umbrellas only open in the rain
		for ( const pr of this.folk.props ) if ( pr.kind === 3 ) pr.open = w.rain > 0.05 ? 1 : 0;

	}

}
