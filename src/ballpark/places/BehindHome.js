import { Group, Vector3, Sphere } from '../../engine/index.js';
import { Cast, PROP } from './Cast.js';
import { rng } from './Concourse3BKit.js';
import { SeatMap } from './home/Seats.js';
import { Fans, hash } from './home/Fans.js';
import { dressBoth } from './home/Dress.js';
import { paletteMaterial } from './home/Build.js';
import { buildClub } from './home/Club.js';

// Behind home plate: the TV's backdrop. The center field camera looks straight at it on every pitch
// (press C), so this is the most-watched patch of the park: the Diamond Club's front rows and the field
// level's sections behind the plate (the backstop's section and the two angled ones either side), their
// aisles and stairs, the suites above, the press box and its broadcast booths.
//
// Built in the field frame (field.group), after the rest of the park; update() ties it to the replay.
//   home/Seats.js    the seats (as the stands put them), the aisles, and the ones the place takes
//   home/Poses.js    sitting, getting up, the seated gestures
//   home/Fans.js     the people in the seats
//   home/Dress.js    what they wear on the 27th and the 29th
//
// Field frame: x, z metres from the back tip of home plate, -z toward center field, +x toward first; the
// backstop's section runs x -6.9 .. 6.9 at z 15.1, its rows climbing back to the main concourse at z ~45.

// the Diamond Club's front rows: in the backstop's section all of them, in the angled ones either side
// the seats nearest the backstop's aisles
export const CLUB_ROWS = 5;

export default class BehindHome {

	constructor( { app, field, bowl, people } ) {

		this.app = app;
		this.field = field;
		this.bowl = bowl;
		this.group = new Group();
		this.group.name = 'home';
		const seats = this.seats = new SeatMap( bowl );
		this.cast = new Cast( { parent: this.group, max: 340 } );
		// where the cast is (for ?focus=: an instanced mesh's own bounds sit at home plate)
		for ( const m of [ this.cast.mesh, this.cast.meshFar, this.cast.meshTiny, this.cast.blobs ] ) m.boundingSphere = new Sphere( new Vector3( 0, 4, 30 ), 34 );
		this.fans = new Fans( this.cast );
		this.fans.rows = ( sec, row ) => seats.bySec[ sec ]?.[ row ] || [];
		this._seatPeople();
		// the crowd's fans leave the seats the place has taken
		bowl.crowd?.vacate?.( seats.vacateTest( field ) );
		// People.js's walkers on these aisles and its guard at the foot of the backstop's aisle are the
		// place's own now (they'd walk the old steps: the club's front rows sit lower)
		this._quiet( people );
		// the things: the club's ledge and what's on it (one draw; each night's things fold away on the other)
		this.material = paletteMaterial( 'home-things' );
		this.things = buildClub( seats ).mesh( this.material, 'home-things' );
		this.group.add( this.things );
		this.state = {};
		this._mood = { stand: 0.03, cheer: 0, clap: 0.05, jump: 0, towel: 0.03 };

	}

	// who sits where
	_seatPeople() {

		const S = this.seats, r = rng( 20081027 );
		const sit = ( seat, o = {} ) => {

			if ( ! seat || seat.taken || ! seat.occupied ) return null;
			const looks = o.looks || dressBoth( r, { club: o.club, age: o.age, female: o.female } );
			const f = this.fans.add( seat, { looks, scale: o.scale ?? sizeFor( looks.base, r ), kit: o.kit || kitFor( looks.base, r, o ), traits: o.traits, name: o.name } );
			if ( f ) S.take( seat, f );
			return f;

		};

		this.sit = sit;
		// the Diamond Club's front rows
		for ( let row = 0; row < CLUB_ROWS; row ++ ) {

			for ( const seat of S.bySec[ 9 ][ row ] || [] ) sit( seat, { club: true } );
			const R8 = S.bySec[ 8 ][ row ] || [], R10 = S.bySec[ 10 ][ row ] || [];
			if ( row < 3 ) {

				for ( const seat of R8.slice( - 6 ) ) sit( seat, { club: true } );
				for ( const seat of R10.slice( 0, 6 ) ) sit( seat, { club: true } );

			}

		}

		// along the aisles behind the club, where the vendors hand things along the rows
		for ( const row of [ 7, 10, 13, 16, 19, 22, 25, 28 ] ) {

			const R = S.bySec[ 9 ][ row ] || [];
			for ( const seat of [ ...R.slice( 0, 4 ), ...R.slice( - 4 ) ] ) sit( seat );

		}

	}

	_quiet( people ) {

		if ( ! people?.list ) return;
		const feet = [ 'A', 'B' ].map( ( k ) => this.seats.aisle( k, 0.3 ) );
		for ( const p of people.list ) {

			const onAisle = p.aisle && p.aisle.S.k >= 5 && p.aisle.S.k <= 7;
			const atFoot = p.y < 3 && feet.some( ( f ) => Math.hypot( p.x - f[ 0 ], p.z - f[ 2 ] ) < 1.5 );
			if ( onAisle || atFoot ) {

				p.visible = false;
				p.aisle = null;

			}

		}

	}

	// Where the night is: which night, the rain, the inning, the moment; the crowd's mood (eased)
	_night( d, dt ) {

		const N = this.state;
		if ( ! this._susp ) {

			this._susp = d.segments.find( ( s ) => s.kind === 'switch' && s.snap.inning === 6 && s.snap.half === 'bottom' );
			this._end = d.segments.find( ( s ) => s.kind === 'celebrate' ) || d.segments[ d.segments.length - 1 ];

		}

		const t = d.t, seg = d.segmentAt( t ), s = seg.snap || {};
		N.t = t;
		N.seg = seg;
		N.kind = seg.kind;
		N.lt = t - seg.t0;
		N.snap = s;
		N.inning = s.inning || 1;
		N.half = s.half || 'top';
		N.suspended = seg === this._susp;
		// the 27th: to the suspension (its rain delay the 27th's last minutes)
		N.first = t < this._susp.t0 + this._susp.dur - 4;
		const k = N.first ? Math.min( 1, ( ( N.inning - 1 ) * 2 + ( N.half === 'top' ? 0 : 1 ) ) / 10 ) : 0;
		N.rain = N.first ? 0.3 + 0.7 * k : 0;
		N.celebrate = seg.kind === 'celebrate';
		N.celT = N.celebrate ? N.lt : 0;
		N.between = seg.kind === 'switch' || seg.kind === 'intro' || seg.kind === 'change';
		N.pitching = seg.kind === 'pitch';
		N.ball = d.ballAt || null;
		// where the heads go: the ball in play, else the plate (the pitch), the field between innings
		N.look = N.ball && ( seg.kind === 'inplay' || seg.kind === 'result' ) ? N.ball : N.between ? [ 0, 1, - 30 ] : [ 0, 1.2, - 8 ];
		// the crowd's mood (Crowd.mood(), a function of the timeline), eased as the crowd eases it
		const target = this.bowl.crowd?.mood ? this.bowl.crowd.mood( d ) : { stand: 0.03, cheer: 0, clap: 0.05, jump: 0, towel: 0.03 };
		const e = 1 - Math.exp( - dt * 2.5 );
		for ( const key in this._mood ) this._mood[ key ] += ( ( target[ key ] ?? 0 ) - this._mood[ key ] ) * e;
		N.mood = this._mood;
		// the tension: two strikes and two outs, the 9th on the 29th
		const late = ! N.first && N.inning >= 9 && N.half === 'top';
		N.tense = N.pitching && N.half === 'top' ? ( ( s.strikes >= 2 ? 0.35 : 0 ) + ( s.outs >= 2 ? 0.25 : 0 ) + ( late ? 0.35 : 0 ) ) : 0;
		// the cameras out: a run for the Phillies, the last out (and the minutes after)
		N.flash = N.celebrate ? Math.min( 1, N.celT / 2 ) : 0;
		if ( seg.kind === 'result' && seg.before && s.score && s.score.home > seg.before.score.home ) N.flash = Math.max( N.flash, 0.5 * Math.max( 0, 1 - N.lt / 6 ) );
		return N;

	}

	update( dt, director, camera ) {

		if ( ! director ) return;
		dt = Math.min( dt, 0.25 );
		const N = this._night( director, dt );
		this.material.uniforms.night.value = N.first ? 27 : 29;
		this.fans.update( dt, N );
		// the cast's detail by how big they are on screen: the distance against the lens (the center
		// field camera's long lens sees the rows behind home plate from 150 m as if from 12)
		const fov = camera?.fov || 60;
		const zoom = Math.tan( fov * Math.PI / 360 ) / Math.tan( 30 * Math.PI / 180 );
		this.cast.near = 9 / zoom;
		this.cast.far = 32 / zoom;
		const cf = camera ? this.field.toField( camera.position.x, camera.position.z ) : null;
		this.cast.update( cf ? [ cf[ 0 ], 0, cf[ 1 ] ] : null );

	}

}

// how tall (the cast is built 1.75 m)
function sizeFor( L, r ) {

	if ( L.age === 2 ) return 0.58 + 0.12 * r();
	if ( L.age === 3 ) return 0.92 + 0.06 * r();
	return ( L.female ? 0.92 : 0.98 ) + 0.07 * r() + ( L.build === 2 ? 0.03 : 0 );

}

// what they have with them and do between pitches
function kitFor( L, r, o ) {

	const kid = L.age === 2;
	const drink = kid ? PROP.soda : Number( pickW( r, { [ PROP.beer ]: 5, [ PROP.soda ]: 2, [ PROP.cocoa ]: 3 } ) );
	const idle = kid
		? { watch: 4, knees: 2, eat: 1, talk: 1, cup: 1 }
		: { watch: 4, knees: 1, fold: 2, talk: 2, cup: 3, text: 0.7, call: 0.2, eat: 0.5, peanuts: 0.5, read: 0.3, pockets: 1, blow: 0.3, score: 0 };
	if ( L.age === 1 ) idle.score = 0.6;
	return { idle, drink, towel: r() < 0.7, camera: r() < ( o.club ? 0.3 : 0.18 ), glove: kid && r() < 0.7 };

}

function pickW( r, table ) {

	let sum = 0;
	for ( const k in table ) sum += table[ k ];
	let x = r() * sum;
	for ( const k in table ) {

		x -= table[ k ];
		if ( x <= 0 ) return k;

	}

	return Object.keys( table )[ 0 ];

}

export { hash };
