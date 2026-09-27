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
import { Bulls } from './alley/Bulls.js';
import { Fair } from './alley/Fair.js';
import { MemoryLane } from './alley/MemoryLane.js';
import { allStarWalk } from './alley/AllStarWalk.js';

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
const X0 = - 80, X1 = 67.5;

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
		// Bull's BBQ at the left field end, its plaza, the Bull signing
		this.bulls = new Bulls( { parent: this.group, folk: this.folk, at: [ - 71.5, - 140 ] } );
		// Memory Lane's viewing platform over the visitors' pen and the Wall of Fame behind it (closed in the game)
		if ( this.pens ) this.memoryLane = new MemoryLane( { parent: this.group, frame: this.pens, folk: this.folk, colliders: this.colliders, field: this.field } );
		// the street fair: the carts, the cans, the ATM, the Games of Baseball at the right field end
		const zf = this.zFront;
		this.fair = new Fair( {
			parent: this.group, folk: this.folk, zFront: zf,
			// (the funnel cake stand by the clock's pylons and the statue, as the research found it)
			carts: [ [ - 40.5, - 132.5, 0 ], [ - 28.5, - 132.5, 1 ], [ - 16.5, - 132.8, 2 ], [ 42.5, - 132.5, 3 ], [ - 4.5, - 135.4, 4 ] ],
			cans: [ [ - 51, zf + 1.3 ], [ - 37, zf + 1.3 ], [ - 25.3, zf + 1.3 ], [ 11.3, zf + 1.3 ], [ 20.7, zf + 1.3 ], [ 44, zf + 1.3 ], [ 52, zf + 1.3 ], [ - 60, - 133 ], [ 28, - 131.5 ] ],
			atm: [ 32.8, zf + 1.7 ], gamesAt: [ 63.3, zf + 0.9 ],
		} );
		this._bleacherFans();
		this.folk.build();

	}

	// ---------------------------------------------------------------- the promenade

	_promenade( L ) {

		const counters = ( L?.alleyStands || [] ).map( ( s ) => [ s.mid[ 0 ], s.mid[ 1 ] + 1.6 ] );
		this.floor = promenade( this.group, { pit: this.bowl.pit, x0: X0, x1: X1, zBack: this.zFront, lamps: L?.alleyLamps || [], counters, plaza: [ - 62.3, - 146.4 ] } );
		// the All-Star Walk's granite markers down the middle of it (clear of the statue)
		this.allStars = allStarWalk( this.group, { z: this.zFront + 4.6, x0: - 60, x1: 58, avoid: [ [ - 4, 0 ] ] } );

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

	// The Alley's edge over the pens (the 2008 photos): a galvanized pipe rail with mesh infill, 42 in, posts
	// every 2.4 m, a flat cap to lean on, green window boxes of flowers hung on its field side; round the
	// end of the batter's eye, along the edge of the Alley's deck over the visitors' bench, and down the
	// side of Memory Lane's viewing platform (a chain across its stair: closed during the game). West of
	// that the edge is the Wall of Fame's brick parapet (MemoryLane.js). The upper pen's lip gets its window
	// boxes too. Colliders keep walkers on the Alley.
	_railOverPens() {

		const pit = this.bowl.pit;
		const P = this.pens;
		if ( ! P ) return;
		const T = P.TB + 0.4, O = P.TB - P.overhang;
		const a0 = P.at( P.S0 - 0.4, T ), w0 = P.at( P.west, T ), wC = P.at( P.west, P.TB - 1.2 ), w1 = P.at( P.west, O ), e1 = P.at( P.S1 + 0.4, O ), e2 = P.at( P.S1 + 0.4, T );
		const eyeEnd = [ a0[ 0 ] - 0.6, pitEdgeZ( pit, a0[ 0 ] - 0.6 ) ];
		const U = [ P.ux, P.uz ], N = [ - P.nx, - P.nz ], nU = [ - P.ux, - P.uz ];
		// [ from, to, the way the drop is, what's there, window boxes ]
		const segs = [
			[ eyeEnd, a0, U, 'rail', true ],
			[ a0, w0, N, 'parapet', false ],
			[ w0, wC, nU, 'rail', false ],
			[ wC, w1, nU, 'chain', false ],
			[ w1, e1, N, 'rail', true ],
			[ e1, e2, U, 'rail', false ],
		];
		// the fans' line along it (Cast.js), the way each stretch faces
		this.railPath = { pts: [ eyeEnd, a0, w0, w1, e1 ], drops: [ U, N, nU, N ] };
		const q = new Quads(), caps = new Quads(), mesh = new Quads();
		const H = 1.07, y0 = STREET;
		const boxes = [];
		for ( const [ [ ax, az ], [ bx, bz ], [ nx, nz ], kind, hasBoxes ] of segs ) {

			const len = Math.hypot( bx - ax, bz - az );
			if ( len < 0.2 || kind === 'parapet' ) continue;
			const ux = ( bx - ax ) / len, uz = ( bz - az ) / len;
			// set back a little from the edge
			const o = - 0.12;
			const A = [ ax + nx * o, az + nz * o ], B = [ bx + nx * o, bz + nz * o ];
			const at = ( t ) => [ A[ 0 ] + ( B[ 0 ] - A[ 0 ] ) * t, A[ 1 ] + ( B[ 1 ] - A[ 1 ] ) * t ];
			const w = this.field.toWorld( ...at( 0.5 ) );
			this.colliders.addBox( new Vector3( w.x, this.field.y0 + y0 + H / 2, w.z ), new Vector3( len / 2, H / 2 + 0.3, 0.1 ), this.field.group.rotation.y - Math.atan2( uz, ux ), { tag: 'alley-rail', solid: true } );
			if ( kind === 'chain' ) {

				// two stanchions and a sagging chain between: AREA CLOSED
				for ( const t of [ 0, 1 ] ) beam( q, [ at( t )[ 0 ], y0, at( t )[ 1 ] ], [ at( t )[ 0 ], y0 + 0.95, at( t )[ 1 ] ], 0.05 );
				for ( let k = 0; k < 8; k ++ ) {

					const t0 = k / 8, t1 = ( k + 1 ) / 8, sag = ( t ) => 0.9 - 0.18 * Math.sin( Math.PI * t );
					beam( q, [ at( t0 )[ 0 ], y0 + sag( t0 ), at( t0 )[ 1 ] ], [ at( t1 )[ 0 ], y0 + sag( t1 ), at( t1 )[ 1 ] ], 0.02 );

				}

				this.closedChain = { at: at( 0.5 ), n: [ nx, nz ] };
				continue;

			}

			const posts = Math.max( 1, Math.round( len / 2.4 ) );
			for ( let k = 0; k <= posts; k ++ ) {

				const [ x, z ] = at( k / posts );
				beam( q, [ x, y0, z ], [ x, y0 + H, z ], 0.06 );

			}

			beam( q, [ A[ 0 ], y0 + 0.08, A[ 1 ] ], [ B[ 0 ], y0 + 0.08, B[ 1 ] ], 0.035 );
			beam( q, [ A[ 0 ], y0 + H - 0.08, A[ 1 ] ], [ B[ 0 ], y0 + H - 0.08, B[ 1 ] ], 0.035 );
			// the mesh panel between the rails (uv in metres, for the weave)
			const m0 = [ A[ 0 ], y0 + 0.1, A[ 1 ] ], m1 = [ B[ 0 ], y0 + 0.1, B[ 1 ] ], m2 = [ B[ 0 ], y0 + H - 0.1, B[ 1 ] ], m3 = [ A[ 0 ], y0 + H - 0.1, A[ 1 ] ];
			mesh.tri( m0, m1, m2, [ nx, 0, nz ], [ 0, 0.1 ], [ len, 0.1 ], [ len, H - 0.1 ] );
			mesh.tri( m0, m2, m3, [ nx, 0, nz ], [ 0, 0.1 ], [ len, H - 0.1 ], [ 0, H - 0.1 ] );
			// the cap: a flat bar 14 cm wide, worn smooth by forearms
			const c0 = [ A[ 0 ] - nx * 0.05, A[ 1 ] - nz * 0.05 ], c1 = [ B[ 0 ] - nx * 0.05, B[ 1 ] - nz * 0.05 ];
			const d0 = [ A[ 0 ] + nx * 0.09, A[ 1 ] + nz * 0.09 ], d1 = [ B[ 0 ] + nx * 0.09, B[ 1 ] + nz * 0.09 ];
			caps.add( [ c0[ 0 ], y0 + H + 0.02, c0[ 1 ] ], [ c1[ 0 ], y0 + H + 0.02, c1[ 1 ] ], [ d1[ 0 ], y0 + H + 0.02, d1[ 1 ] ], [ d0[ 0 ], y0 + H + 0.02, d0[ 1 ] ], [ 0, 1, 0 ] );
			for ( const [ e0, e1, n ] of [ [ c0, c1, [ - nx, 0, - nz ] ], [ d0, d1, [ nx, 0, nz ] ] ] ) caps.add( [ e0[ 0 ], y0 + H - 0.03, e0[ 1 ] ], [ e1[ 0 ], y0 + H - 0.03, e1[ 1 ] ], [ e1[ 0 ], y0 + H + 0.02, e1[ 1 ] ], [ e0[ 0 ], y0 + H + 0.02, e0[ 1 ] ], n );
			// window boxes on the field side between the posts, hung from the top rail
			if ( hasBoxes ) for ( let k = 0; k < posts; k ++ ) {

				const [ x0, z0 ] = at( k / posts + 0.06 / len ), [ x1, z1 ] = at( ( k + 1 ) / posts - 0.06 / len );
				boxes.push( { a: [ x0 + nx * 0.3, y0 + H - 0.1, z0 + nz * 0.3 ], b: [ x1 + nx * 0.3, y0 + H - 0.1, z1 + nz * 0.3 ], out: [ nx, nz ] } );

			}

		}

		for ( const [ g, name ] of [ [ q, 'alley-rail' ], [ caps, 'alley-rail-cap' ] ] ) {

			const m = new Mesh( g.geometry(), this.galv );
			m.name = name;
			m.castShadow = true;
			m.receiveShadow = true;
			this.group.add( m );

		}

		// the infill: a galvanized welded mesh, 5 cm, seen through (each pixel wire or not by how much wire
		// covers it there, dithered, as the pens' chain-link)
		const infill = standard( { name: 'alley-rail-mesh', color: new Color( 0.5, 0.51, 0.52 ), roughness: 0.4, metalness: 0.6, side: 'double', alphaTest: 0.5,
			surface: /* wgsl */`
	let p = in.uv / 0.05;
	let g = abs( fract( p ) - 0.5 );
	let fw = max( fwidth( p.x ), fwidth( p.y ) );
	let wire = smoothstep( 0.44 - fw, 0.44 + fw, max( g.x, g.y ) );
	let cover = mix( wire, 0.22, clamp( fw * 1.2 - 0.2, 0.0, 1.0 ) );
	let n = fract( sin( dot( floor( in.pixel ), vec2f( 12.9898, 78.233 ) ) + f32( frame.frameIndex % 16u ) * 1.618 ) * 43758.5453 );
	s.alpha = select( 0.0, 1.0, cover > n );
` } );
		infill.underwaterLighting = 'none';
		const im = new Mesh( mesh.geometry(), infill );
		im.name = 'alley-rail-mesh';
		this.group.add( im );

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
			this.bulls?.update( dt, w, this.cast.time );
			this.fair?.update( dt, w, this.cast.time );
			this.memoryLane?.update( dt, w, this.cast.time );
			if ( this.bulls ) {

				// the smoke goes with the flags' wind (BallparkApp._weather: the 27th a rainstorm, the 29th
				// gusting 20-30 mph in from right)
				const a = this.field.toField( 1.2, 0.8 ), o = this.field.toField( 0, 0 );
				this.bulls.setWind( ( a.x ?? a[ 0 ] ) - ( o.x ?? o[ 0 ] ), ( a.z ?? a[ 1 ] ) - ( o.z ?? o[ 1 ] ), w.night === 27 ? 0.6 : 0.95, w.rain );

			}
			this.folk.update();

		}

	}

}
