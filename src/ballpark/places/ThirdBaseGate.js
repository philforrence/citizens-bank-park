import { Group, Matrix4, Vector3 } from '../../engine/index.js';
import { LEVELS } from '../layout.js';
import { GATES } from '../Exterior.js';
import { ROLE } from '../People.js';
import { STATUES } from '../data/surroundings.js';
import { plantTrees } from './gate3b/Trees.js';
import { Folk } from './gate3b/Folk.js';
import { Arrivals } from './gate3b/Arrivals.js';
import { buildOpenGate } from './gate3b/Gate.js';
import { night } from './gate3b/Night.js';
import { buildStore } from './gate3b/Store.js';
import { Cast } from './gate3b/Cast.js';

// The Third Base Gate and its plaza (Pattison Avenue and Citizens Bank Way) on a World Series night:
// where every visitor starts, at ( -112, 78 ) facing the gate. W1's little world (places/index.js).
//
// Field frame (layout.js): x and z in metres from the back tip of home plate, -z toward center field;
// the street and the plaza are at LEVELS.mainConcourse (~7 m). Pattison Avenue runs along z ~ 119.5
// (18 m wide), 11th Street (Citizens Bank Way) along x ~ -146 (10 m); their corner is at ( -146, 120 ).

const STREET = LEVELS.mainConcourse;
// the part of the streets round the plaza this place owns (the sports complex's trees in it are grown
// again here)
const AREA = { x0: - 200, x1: - 15, z0: - 20, z1: 185 };
// the plaza's planters (Exterior._plazaFurniture), for the walkers to go round
const PLANTERS = [ [ - 124, 70, 3.2 ], [ - 96, 84, 3.0 ], [ - 124, 50, 2.6 ], [ - 104, 36, 2.8 ], [ - 84, 66, 2.6 ], [ - 116, 22, 2.4 ] ];

export default class ThirdBaseGate {

	constructor( { app, field, bowl, people, colliders, scope } ) {

		this.app = app;
		this.field = field;
		this.colliders = colliders;
		this.group = new Group();
		this.group.name = 'gate3b';
		field.group.add( this.group );
		this.gate = GATES[ 0 ];
		this.obstacles = [];
		this._trees( app );
		// the spot where you start: the crowd goes round you, not through you
		this.obstacles.push( [ - 112, 78, 1.8 ] );
		// the Majestic Clubhouse Store's corner pavilion (gate3b/Store.js): its block, its bed
		this.store = buildStore( this.group, colliders, field );
		this.obstacles.push( [ - 98.1, 21.2, 5.6 ] );
		const bed = this.store.bed;
		for ( let t = - 0.5; t <= 0.5; t += 0.25 ) this.obstacles.push( [ bed.cen[ 0 ] + bed.d[ 0 ] * bed.L * t, bed.cen[ 1 ] + bed.d[ 1 ] * bed.L * t, 1.1 ] );
		this._crowd( app, people );
		this.cast = new Cast( this.folk, 41 );
		this._storeCrowd();

	}

	// ---------------------------------------------------------------- the store's crowd

	// "Fans stand outside the team store prior to Game Five" (Getty, 27 Oct 2008): a knot of friends by
	// the doors, two at the windows picking out a jersey, one coming out with his bag, a wife on the phone
	// to a husband who's parking the car, fans sitting on the bed's wall; fewer as the game goes on
	_storeCrowd() {

		const S = this.store, C = this.cast, n = S.nFront, d = S.along, dr = S.doors;
		const at = ( a, o ) => [ dr[ 0 ] + d[ 0 ] * a + n[ 0 ] * o, dr[ 1 ] + d[ 1 ] * a + n[ 1 ] * o ];
		const till = ( k ) => ( w ) => w.rate > k;
		C.group( at( 1.2, 2.6 ), 3, 0.62, { when: till( 0.15 ) } );
		C.add( { at: at( - 1.6, 0.85 ), face: at( - 1.6, - 1 ), act: 'window', when: till( 0.3 ) } );
		C.add( { at: at( - 2.2, 0.95 ), face: at( - 2.4, - 1 ), act: 'window', who: { woman: true }, when: till( 0.3 ) } );
		C.add( { at: at( 0.3, 1.5 ), face: at( 0.2, 6 ), act: 'bag', props: [ 'shopbag' ], when: till( 0.5 ) } );
		C.add( { at: at( 3.4, 1.2 ), face: at( 5, 4 ), act: 'wait', who: { woman: true }, when: till( 0.08 ) } );
		// sitting on the bed's wall, facing out to the plaza
		const b = S.bed;
		for ( const [ t, act ] of [ [ - 0.3, 'sit' ], [ - 0.18, 'sit' ], [ 0.25, 'sit' ] ] ) {

			const p = [ b.cen[ 0 ] + b.d[ 0 ] * b.L * t + n[ 0 ] * ( b.dep / 2 + 0.05 ), b.cen[ 1 ] + b.d[ 1 ] * b.L * t + n[ 1 ] * ( b.dep / 2 + 0.05 ) ];
			C.add( { at: p, face: [ p[ 0 ] + n[ 0 ] * 5, p[ 1 ] + n[ 1 ] * 5 ], act, noRainGear: true, when: till( 0.05 ) } );

		}

	}

	// ---------------------------------------------------------------- the street trees

	// The plaza's trees (their spots from Exterior) and the sports complex's round the plaza on Pattison
	// and 11th (hidden there, their spots taken), all grown as real trees
	_trees( app ) {

		const spots = [];
		const near = ( x, z, d ) => spots.some( ( [ a, b ] ) => Math.hypot( a - x, b - z ) < d );
		for ( const [ x, z ] of app.exterior?.treeSpots || [] ) spots.push( [ x, z ] );
		const nPlaza = spots.length;
		const crowns = app.complex?.group.children.find( ( m ) => m.name === 'trees-crowns' );
		const trunks = app.complex?.group.children.find( ( m ) => m.name === 'trees-trunks' );
		if ( crowns && trunks ) {

			const m = new Matrix4(), zero = new Matrix4().makeScale( 0, 0, 0 ), p = new Vector3();
			for ( let i = 0; i < crowns.count; i ++ ) {

				crowns.getMatrixAt( i, m );
				p.setFromMatrixPosition( m );
				if ( p.x < AREA.x0 || p.x > AREA.x1 || p.z < AREA.z0 || p.z > AREA.z1 ) continue;
				crowns.setMatrixAt( i, zero );
				trunks.setMatrixAt( i, zero );
				if ( ! near( p.x, p.z, 4 ) ) spots.push( [ p.x, p.z ] );

			}

			crowns.instanceMatrix.needsUpdate = true;
			trunks.instanceMatrix.needsUpdate = true;

		}

		// the plaza's own are in grates; out on the sidewalks too
		this.treeMeshes = plantTrees( this.group, spots );
		this.treeCount = { plaza: nPlaza, street: spots.length - nPlaza };
		for ( const [ x, z ] of spots ) this.obstacles.push( [ x, z, 0.9 ] );
		for ( const [ x, z, r ] of PLANTERS ) this.obstacles.push( [ x, z, r ] );
		for ( const [ x, , z ] of app.exterior?.lamps || [] ) this.obstacles.push( [ x, z, 0.35 ] );
		const s = STATUES[ 'Mike Schmidt' ]?.[ 0 ];
		if ( s ) this.obstacles.push( [ s[ 0 ], s[ 1 ], 2.4 ] );

	}

	// ---------------------------------------------------------------- the people

	_crowd( app, people ) {

		const lanes = ( app.exterior?.lanes || [] ).filter( ( l ) => /THIRD/.test( l.gate ) );
		// the gate's own people (People.js put a taker at each lane, two guards, a few arrivals): here
		// they're the plaza's, so they go
		if ( people ) {

			const g = this.gate.at;
			const mine = new Set( people.arrivals || [] );
			for ( const p of people.list ) {

				const d = Math.hypot( p.x - g[ 0 ], p.z - g[ 1 ] );
				if ( d < 20 && ( ( p.role === ROLE.usher && p.reachAt != null ) || p.role === ROLE.security ) ) mine.add( p );

			}

			people.list = people.list.filter( ( p ) => ! mine.has( p ) );
			people.arrivals = [];

		}

		this.folk = new Folk( this.group, this.field );
		if ( ! lanes.length ) return;
		// the gate open for the game: fins, bins, bag tables, the turnstiles inside (gate3b/Gate.js)
		this.openGate = buildOpenGate( { group: this.group, exterior: app.exterior, gate: this.gate, colliders: this.colliders, field: this.field } );
		if ( ! this.openGate ) return;
		for ( const [ x, , z ] of this.openGate.bins ) this.obstacles.push( [ x, z, 0.5 ] );
		this.arrivals = new Arrivals( { folk: this.folk, gate: this.openGate, obstacles: this.obstacles, seed: 27 } );

	}

	update( dt, director ) {

		const w = night( director );
		const A = this.arrivals;
		if ( A ) {

			// a jump in the replay (a seek, a skip) or the other night: everyone where they'd be now
			const speed = director?.speed ?? 1;
			const jumped = this._lastT === undefined || Math.abs( w.t - this._lastT ) > 3 + dt * speed * 2 || w.first !== this._lastFirst;
			if ( jumped ) A.reset( w );
			A.update( Math.min( dt, 0.1 ), w );
			this._lastT = w.t;
			this._lastFirst = w.first;

		}

		this.cast?.update( Math.min( dt, 0.1 ), w );
		this.openGate?.poseTripods();
		this.folk?.update();

	}

}
