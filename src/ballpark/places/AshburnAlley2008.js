import { Group, Mesh, Color, Vector3, Sphere, Matrix4, Quaternion } from '../../engine/index.js';
import { standard } from '../../materials/Materials.js';
import { Quads } from '../Stands.js';
import { beam } from '../geo.js';
import { LEVELS } from '../layout.js';
import { BLEACHERS } from '../Landmarks.js';
import { when } from './alley/Night.js';
import { promenade, pitEdgeZ } from './alley/Promenade.js';
import { flowerBoxes } from './alley/Flowers.js';
import { Pens } from './alley/Pens.js';
import { Folk } from './alley/Folk.js';
import { Cast } from './alley/Cast.js';
import { SIGNS } from './alley/Signs.js';

// Ashburn Alley and the bullpens on the World Series nights, October 27 and 29, 2008: the park's living
// room. The promenade behind center field (its bricks and the All-Star Walk in them, the Wall of Fame,
// the rail over the pens and the fans on it), the street fair along it (Bull's BBQ and its smoke, Greg
// Luzinski signing, the stands and their lines, the giant pinball machine, the ATM, the carts), the
// rooftop bleachers, and down in the pens the relievers getting loose, both nights, in step with the
// replay. The buildings, the clock and the flags are Landmarks.js's; the pens' structure is Field.js's.
// Field frame (x, z metres from the back of home plate, -z toward center field, y up from the field;
// the Alley is at street level, LEVELS.mainConcourse).

const STREET = LEVELS.mainConcourse;
// the promenade's ends, along the Alley (the storefronts run from -62 to 60)
const X0 = - 66, X1 = 64;

export default class AshburnAlley2008 {

	constructor( { app, field, bowl, people, colliders, scope } ) {

		this.app = app;
		this.field = field;
		this.bowl = bowl;
		this.people = people;
		this.colliders = colliders;
		this.scope = scope;
		this.group = new Group();
		this.group.name = 'ashburn-alley-2008';
		const L = app.landmarks;
		this.zFront = L?.alleyFront ?? - 143;
		this.pens = field.penFrame;
		this.galv = standard( { name: 'alley-rail-galv', color: new Color( 0.5, 0.51, 0.52 ), roughness: 0.42, metalness: 0.55 } );
		this.galv.underwaterLighting = 'none';

		this._promenade( L );
		this._railOverPens();
		// the pens' gear and people (the warm-ups in step with the replay's pitching changes)
		if ( this.pens ) this.penLife = new Pens( { parent: this.group, frame: this.pens } );
		// the people: one figure system for all of them (built once they're all added)
		this.folk = new Folk( this.group, { signs: SIGNS } );
		this.folk.frameYaw = field.group.rotation.y;
		this.folk.bounds = new Sphere( new Vector3( 0, STREET, - 136 ), 80 );
		this._cast( L );
		this._bleacherFans();
		this.folk.build();

	}

	// ---------------------------------------------------------------- the promenade

	_promenade( L ) {

		const counters = ( L?.alleyStands || [] ).map( ( s ) => [ s.mid[ 0 ], s.mid[ 1 ] + 1.6 ] );
		this.floor = promenade( this.group, { pit: this.bowl.pit, x0: X0, x1: X1, zBack: this.zFront, lamps: L?.alleyLamps || [], counters } );

	}

	// ---------------------------------------------------------------- the rooftop bleachers' fans

	// The rooftop bleachers over the Alley in right-center were sold like every other seat: a fan on each
	// backless bench seat, seated by the park's crowd (Crowd.js dresses them, moves them with the game
	// and swaps their detail with distance). Their seats follow Landmarks' benches: 7 rows, 0.85 m deep,
	// 0.4 m risers, three spans between two aisles, 0.5 m a seat.
	_bleacherFans() {

		const crowd = this.bowl.crowd;
		if ( ! crowd || crowd.off ) return;
		const RD = 0.85, RR = 0.4, rows = 7, y0 = STREET + 4.5, zf = this.zFront - 0.2;
		const mats = [], m = new Matrix4(), q = new Quaternion().setFromAxisAngle( new Vector3( 0, 1, 0 ), Math.PI ), p = new Vector3(), one = new Vector3( 1, 1, 1 );
		for ( const [ x0, x1 ] of BLEACHERS ) {

			const a0 = x0 + ( x1 - x0 ) / 3, a1 = x0 + 2 * ( x1 - x0 ) / 3;
			for ( let r = 0; r < rows; r ++ ) {

				const yT = y0 + RR * ( r + 1 ), za = zf - r * RD;
				for ( const [ a, b ] of [ [ x0 + 0.4, a0 - 0.6 ], [ a0 + 0.6, a1 - 0.6 ], [ a1 + 0.6, x1 - 0.4 ] ] ) {

					const n = Math.floor( ( b - a ) / 0.5 );
					for ( let i = 0; i < n; i ++ ) {

						m.compose( p.set( a + ( b - a - n * 0.5 ) / 2 + 0.25 + i * 0.5, yT, za - 0.28 ), q, one );
						if ( crowd.occupied( m ) ) mats.push( m.clone() );

					}

				}

			}

		}

		crowd.addChunk( this.group, mats, 'rooftop-bleachers' );
		this.bleacherFans = mats.length;

	}

	// ---------------------------------------------------------------- the people

	_cast( L ) {

		if ( ! this.railPath ) return;
		const pit = this.bowl.pit;
		// Memory Lane's panels are on the tall middle wall behind the batter's eye: readers 1.6 m off it
		const memoryLane = [ - 8.2, - 6.0, - 3.6, - 0.9 ].map( ( x ) => ( { x, z: pitEdgeZ( pit, x ) - 2.1, yaw: Math.PI } ) );
		const zRoofRail = - 143.05, yRoof = STREET + 4.5 + 0.15;
		this.cast = new Cast( {
			parent: this.group, folk: this.folk, rail: this.railPath, zFront: this.zFront,
			statue: [ - 2, this.zFront + 3.5 ], memoryLane,
			picnic: [ [ - 56, this.zFront + 3.2 ], [ - 50, this.zFront + 3.2 ], [ - 44, this.zFront + 3.2 ] ],
			roof: { y: yRoof, z: zRoofRail, spans: [ [ - 61.6, - 40.4 ], [ - 33.6, - 30.6 ], [ - 17.4, - 8.4 ] ] },
		} );
		void L;

	}

	// ---------------------------------------------------------------- over the pens

	// The Alley's edge over the pens: a galvanized picket rail, 42 in, posts every 2.4 m, pickets every
	// 10 cm, a flat cap on top to lean on, and green window boxes of flowers hung on its field side; round
	// the end of the batter's eye too. The upper pen's lip gets its window boxes (for the purple noise
	// planter that was there). Colliders keep walkers on the Alley.
	_railOverPens() {

		const pit = this.bowl.pit;
		// the field's edge from the batter's eye's end (at 401) round the back of the pens
		const P = this.pens;
		if ( ! P ) return;
		const back = P.TB + 0.4;
		const a0 = P.at( P.S0 - 0.4, back ), a1 = P.at( P.S1 + 0.4, back );
		const eyeEnd = [ a0[ 0 ] - 0.6, pitEdgeZ( pit, a0[ 0 ] - 0.6 ) ];
		const path = [ eyeEnd, a0, a1 ];
		const q = new Quads(), caps = new Quads();
		const H = 1.07, y0 = STREET;
		const boxes = [];
		for ( let i = 0; i < path.length - 1; i ++ ) {

			const [ ax, az ] = path[ i ], [ bx, bz ] = path[ i + 1 ];
			const len = Math.hypot( bx - ax, bz - az );
			if ( len < 0.2 ) continue;
			const ux = ( bx - ax ) / len, uz = ( bz - az ) / len;
			// toward the field (the pens): the side facing home plate
			let nx = - uz, nz = ux;
			if ( nx * - ax + nz * - az < 0 ) {

				nx = - nx; nz = - nz;

			}

			// set back a little from the edge
			const o = - 0.12;
			const A = [ ax + nx * o, az + nz * o ], B = [ bx + nx * o, bz + nz * o ];
			const at = ( t ) => [ A[ 0 ] + ( B[ 0 ] - A[ 0 ] ) * t, A[ 1 ] + ( B[ 1 ] - A[ 1 ] ) * t ];
			const posts = Math.max( 1, Math.round( len / 2.4 ) );
			for ( let k = 0; k <= posts; k ++ ) {

				const [ x, z ] = at( k / posts );
				beam( q, [ x, y0, z ], [ x, y0 + H, z ], 0.06 );

			}

			beam( q, [ A[ 0 ], y0 + 0.1, A[ 1 ] ], [ B[ 0 ], y0 + 0.1, B[ 1 ] ], 0.04 );
			beam( q, [ A[ 0 ], y0 + H - 0.08, A[ 1 ] ], [ B[ 0 ], y0 + H - 0.08, B[ 1 ] ], 0.04 );
			for ( let s = 0.1; s < len - 0.05; s += 0.1 ) {

				const [ x, z ] = at( s / len );
				beam( q, [ x, y0 + 0.1, z ], [ x, y0 + H - 0.08, z ], 0.018 );

			}

			// the cap: a flat bar 14 cm wide, worn smooth by forearms
			const c0 = [ A[ 0 ] - nx * 0.05, A[ 1 ] - nz * 0.05 ], c1 = [ B[ 0 ] - nx * 0.05, B[ 1 ] - nz * 0.05 ];
			const d0 = [ A[ 0 ] + nx * 0.09, A[ 1 ] + nz * 0.09 ], d1 = [ B[ 0 ] + nx * 0.09, B[ 1 ] + nz * 0.09 ];
			caps.add( [ c0[ 0 ], y0 + H + 0.02, c0[ 1 ] ], [ c1[ 0 ], y0 + H + 0.02, c1[ 1 ] ], [ d1[ 0 ], y0 + H + 0.02, d1[ 1 ] ], [ d0[ 0 ], y0 + H + 0.02, d0[ 1 ] ], [ 0, 1, 0 ] );
			for ( const [ e0, e1, n ] of [ [ c0, c1, [ - nx, 0, - nz ] ], [ d0, d1, [ nx, 0, nz ] ] ] ) caps.add( [ e0[ 0 ], y0 + H - 0.03, e0[ 1 ] ], [ e1[ 0 ], y0 + H - 0.03, e1[ 1 ] ], [ e1[ 0 ], y0 + H + 0.02, e1[ 1 ] ], [ e0[ 0 ], y0 + H + 0.02, e0[ 1 ] ], n );
			// window boxes on the field side between the posts, hung from the top rail
			for ( let k = 0; k < posts; k ++ ) {

				const [ x0, z0 ] = at( k / posts + 0.06 / len ), [ x1, z1 ] = at( ( k + 1 ) / posts - 0.06 / len );
				boxes.push( { a: [ x0 + nx * 0.3, y0 + H - 0.1, z0 + nz * 0.3 ], b: [ x1 + nx * 0.3, y0 + H - 0.1, z1 + nz * 0.3 ], out: [ nx, nz ] } );

			}

			// can't walk (or fall) through it
			const mid = at( 0.5 ), w = this.field.toWorld( mid[ 0 ], mid[ 1 ] );
			this.colliders.addBox( new Vector3( w.x, this.field.y0 + y0 + H / 2, w.z ), new Vector3( len / 2, H / 2 + 0.3, 0.1 ), this.field.group.rotation.y - Math.atan2( uz, ux ), { tag: 'alley-rail', solid: true } );

		}

		// the pens' side of it: the rail's field face over the drop
		this.railPath = path;
		for ( const [ g, name ] of [ [ q, 'alley-rail' ], [ caps, 'alley-rail-cap' ] ] ) {

			const m = new Mesh( g.geometry(), this.galv );
			m.name = name;
			m.castShadow = true;
			m.receiveShadow = true;
			this.group.add( m );

		}

		// the upper pen's lip: a box between each pair of its rail's posts, on the curb's field face
		const lip = P.TU - 0.08, n = [ - P.nx, - P.nz ];
		const count = Math.round( ( P.S1 - P.S0 ) / 2.4 );
		for ( let k = 0; k < count; k ++ ) {

			const s0 = P.S0 + ( P.S1 - P.S0 ) * k / count + 0.08, s1 = P.S0 + ( P.S1 - P.S0 ) * ( k + 1 ) / count - 0.08;
			const [ x0, z0 ] = P.at( s0, lip - 0.3 ), [ x1, z1 ] = P.at( s1, lip - 0.3 );
			boxes.push( { a: [ x0, P.R + 0.42, z0 ], b: [ x1, P.R + 0.42, z1 ], out: n } );

		}

		flowerBoxes( this.group, boxes );

	}

	update( dt, director ) {

		if ( ! director ) return;
		const w = when( director );
		// the clock over center field keeps the replay's time
		this.app.landmarks?.setClock?.( w.clock );
		// the floor: puddles while it rains, litter building through each night
		const k = w.night === 27 ? Math.min( 1, director.t / 2143 ) : Math.min( 1, 0.35 + ( w.inning - 6 ) / 4 );
		this.floor?.set( { litter: 0.25 + 0.75 * k, rain: w.rain } );
		if ( this.penLife ) {

			this.penLife.setGame( director.game );
			this.penLife.update( dt, director, this.app.players, w );

		}

		if ( this.cast ) {

			this.cast.update( dt, director, w, this.penLife );
			this.folk.update();

		}

	}

}
