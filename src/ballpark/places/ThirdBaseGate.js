import { Group, Matrix4, Vector3 } from '../../engine/index.js';
import { plantTrees } from './gate3b/Trees.js';

// The Third Base Gate and its plaza (Pattison Avenue and Citizens Bank Way) on a World Series night:
// where every visitor starts, at ( -112, 78 ) facing the gate. W1's little world (places/index.js).
//
// Field frame (layout.js): x and z in metres from the back tip of home plate, -z toward center field;
// the street and the plaza are at LEVELS.mainConcourse (~7 m). Pattison Avenue runs along z ~ 119.5
// (18 m wide), 11th Street (Citizens Bank Way) along x ~ -146 (10 m); their corner is at ( -146, 120 ).

// the part of the streets round the plaza this place owns (the sports complex's trees in it are grown
// again here)
const AREA = { x0: - 200, x1: - 15, z0: - 20, z1: 185 };

export default class ThirdBaseGate {

	constructor( { app, field, bowl, people, colliders, scope } ) {

		this.app = app;
		this.field = field;
		this.group = new Group();
		this.group.name = 'gate3b';
		field.group.add( this.group );
		this._trees( app );

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

	}

	update( dt, director, camera ) {
	}

}
