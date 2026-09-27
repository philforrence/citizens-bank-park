import { Group, Mesh, Matrix4, Vector3, Color } from '../../engine/index.js';
import { standard } from '../../materials/Materials.js';
import { LEVELS } from '../layout.js';
import { GATES } from '../Exterior.js';
import { ROLE } from '../People.js';
import { STATUES } from '../data/surroundings.js';
import { plantTrees } from './gate3b/Trees.js';
import { Folk } from './gate3b/Folk.js';
import { Arrivals } from './gate3b/Arrivals.js';
import { night } from './gate3b/Night.js';
import { Mesher } from './gate3b/Mesher.js';

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
		this._bagTables();
		this._crowd( app, people );

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

	// ---------------------------------------------------------------- the bag check

	// Six-foot folding tables under the gate's canopy, between each pair of lanes, in black skirting,
	// where security goes through the bags (made once the lanes are known: _crowd)
	_bagTables() {

		this.tableMat = standard( { name: 'w1-bag-table', color: new Color( 0.015, 0.015, 0.018 ), roughness: 0.85 } );
		this.tableMat.setDefine( 'DRY', 1 );
		this.tableMat.underwaterLighting = 'none';

	}

	_buildTables( tables ) {

		const m = new Mesher();
		for ( const T of tables ) {

			const [ cx, cz ] = T.c, n = T.n, u = T.u;
			// the long side along n (out from the gate), 1.83 x 0.76, 0.74 high, the skirt to the ground
			const P = ( a, b, y ) => [ cx + n[ 0 ] * a + u[ 0 ] * b, y, cz + n[ 1 ] * a + u[ 1 ] * b ];
			const a = 0.915, b = 0.38, y0 = STREET, y1 = STREET + 0.74;
			m.face( P( - a, - b, y1 ), P( a, - b, y1 ), P( a, b, y1 ), P( - a, b, y1 ), [ 0, 1, 0 ] );
			for ( const [ A, B, nn ] of [ [ P( - a, - b, 0 ), P( a, - b, 0 ), [ - u[ 0 ], 0, - u[ 1 ] ] ], [ P( a, b, 0 ), P( - a, b, 0 ), [ u[ 0 ], 0, u[ 1 ] ] ], [ P( a, - b, 0 ), P( a, b, 0 ), [ n[ 0 ], 0, n[ 1 ] ] ], [ P( - a, b, 0 ), P( - a, - b, 0 ), [ - n[ 0 ], 0, - n[ 1 ] ] ] ] ) {

				m.face( [ A[ 0 ], y0 + 0.02, A[ 2 ] ], [ B[ 0 ], y0 + 0.02, B[ 2 ] ], [ B[ 0 ], y1, B[ 2 ] ], [ A[ 0 ], y1, A[ 2 ] ], nn );

			}

			this.obstacles.push( [ cx, cz, 1.0 ] );
			const w = this.field.toWorld( cx, cz );
			this.colliders.addBox( new Vector3( w.x, this.field.y0 + STREET + 0.37, w.z ), new Vector3( a, 0.37, b ), this.field.group.rotation.y - Math.atan2( n[ 1 ], n[ 0 ] ), { tag: 'table' } );

		}

		const mesh = new Mesh( m.geometry(), this.tableMat );
		mesh.name = 'w1-bag-tables';
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		this.group.add( mesh );

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
		this.arrivals = new Arrivals( { folk: this.folk, lanes, obstacles: this.obstacles, seed: 27 } );
		this._buildTables( this.arrivals.tables );
		// the walkers go round the tables too (they were made with the lanes)
		this.arrivals.obstacles = this.obstacles;

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

		this.folk?.update();

	}

}
