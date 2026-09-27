import { Group, Mesh, SphereGeometry, Matrix4, Vector3, Color } from '../../engine/index.js';
import { standard } from '../../materials/Materials.js';
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
import { buildStreet, LIFT, pattisonZ, eleventhX } from './gate3b/Street.js';
import { buildVendors } from './gate3b/Vendors.js';
import { Horses, manure } from './gate3b/Horses.js';
import { buildTV } from './gate3b/TV.js';
import { Cars } from './gate3b/Cars.js';
import { buildTailgates } from './gate3b/Tailgate.js';
import { buildFurniture } from './gate3b/Furniture.js';
import { buildDrips } from './gate3b/Drips.js';

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
		// the plaza and the sidewalks a curb above the street (gate3b/Street.js)
		this._lift( app );
		this.street = buildStreet( this.group, colliders, field );
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
		this._statueCrowd();
		// the street's economy: peanut carts, the shirt man, the scalpers, the poncho man (gate3b/Vendors.js)
		this.vendors = buildVendors( { group: this.group, cast: this.cast, colliders, field } );
		for ( const [ x, z ] of this.vendors.carts ) this.obstacles.push( [ x, z, 1.4 ] );
		this._police();
		this._ticketless();
		// FOX 29 live from the plaza (gate3b/TV.js)
		this.tv = buildTV( { group: this.group, colliders, field, cast: this.cast } );
		this.obstacles.push( ...this.tv.obstacles );
		// the lots filled, the streets running, the tailgaters (gate3b/Cars.js, Tailgate.js)
		const tail = buildTailgates( { group: this.group, cast: this.cast } );
		this.cars = new Cars( { group: this.group, field, clear: tail.spots } );
		// the banners, the marquee, the balloons, the bins, the store's board (gate3b/Furniture.js)
		this.furniture = buildFurniture( { group: this.group, exterior: app.exterior, colliders, field } );
		this.obstacles.push( ...this.furniture.obstacles );
		// the rain off the gate canopy's front edge and the store's (gate3b/Drips.js)
		const E = this.gate.edge, base = LEVELS.mainConcourse + LIFT;
		const gp = ( sAlong, o ) => [ E.a[ 0 ] + E.ux * ( E.t + sAlong ) + E.nx * o, E.a[ 1 ] + E.uz * ( E.t + sAlong ) + E.nz * o ];
		buildDrips( this.group, [
			[ gp( - 25, 5.02 ), gp( 25, 5.02 ), base + 5.55, base + 0.02 ],
			...this.store.edges.map( ( [ A, B, yy ] ) => [ A, B, yy, base + 0.02 ] ),
		] );
		this.clock = 0;

	}

	// ---------------------------------------------------------------- the ones without tickets

	// Not everyone was going in. McFadden's, the saloon on the plaza with its own door, was packed with the
	// ones who couldn't get a seat and wanted the next best thing: a line down the wall in the rain, the
	// bouncer at the door with his flashlight on the IDs, a few out under the balloons with a cigarette,
	// a knot at the windows watching the TVs over the bar. Out of the rain under the store's canopy, a group
	// round a transistor radio with Harry Kalas on it. At the ticket windows on Pattison, the Will Call
	// line before the game. They follow the game: a Phillies run and they're up with their arms in the air.
	_ticketless() {

		const C = this.cast, x0 = - 71.75;
		const always = ( w ) => ! w.celebrate;
		// the bouncer at the door, the line down the wall to the north
		C.add( { at: [ x0 - 0.8, 76.3 ], face: [ x0 - 4, 76 ], act: 'stand', who: 'bouncer', props: [ 'flash' ], when: always, extra: { custom: ( c, dt, w, p ) => {

			// an ID in the light, a look at the face, the nod
			const k = Math.max( 0, Math.sin( c.t * 0.6 ) );
			p.flexL = 0.5 + 0.3 * k; p.elbowL = 1.1; p.flexR = 0.55 * k; p.elbowR = 0.9; p.pitch = - 0.3 * k + 0.1 * ( 1 - k ); p.yaw = - 0.4 * k;

		} } } );
		for ( let k = 0; k < 11; k ++ ) {

			const z = 74.2 - k * 0.78 + ( ( k * 37 ) % 7 ) * 0.02, x = x0 - 1.35 - ( ( k * 13 ) % 5 ) * 0.06;
			C.add( { at: [ x, z ], face: [ x, z + 3 ], act: k % 4 === 1 ? 'talk' : k % 4 === 3 ? 'phone' : 'listen', reacts: true, when: always } );

		}

		// out under the balloons with a cigarette
		for ( const [ z, act ] of [ [ 78.6, 'smoke' ], [ 79.4, 'smoke' ], [ 80.1, 'talk' ] ] ) C.add( { at: [ x0 - 1.4, z ], face: [ x0 - 1.4 + ( z > 79 ? - 0.5 : 0.6 ), z + ( z > 79 ? - 0.6 : 0.8 ) ], act, reacts: true, when: always } );
		// at the windows, watching the TVs over the bar
		for ( const [ z, woman ] of [ [ 82.2, false ], [ 82.9, true ], [ 83.7, false ], [ 85.0, false ] ] ) C.add( { at: [ x0 - 0.75, z ], face: [ x0 + 2, z ], act: 'window', who: { woman }, noRainGear: false, reacts: true, when: always } );
		// under the store's canopy, out of the rain, round the radio
		const S = this.store, n = S.nFront, d = S.along, dr = S.doors;
		const at = ( a, o ) => [ dr[ 0 ] + d[ 0 ] * a + n[ 0 ] * o, dr[ 1 ] + d[ 1 ] * a + n[ 1 ] * o ];
		const ring = at( - 1.8, 2.2 );
		C.group( ring, 5, 0.75, { acts: [ 'phone', 'listen', 'listen', 'drink', 'listen' ], noRainGear: true, reacts: true, when: always } );
		// the Will Call line at the ticket windows on Pattison (windows 1-3), before the game
		for ( let k = 0; k < 9; k ++ ) {

			const x = - 41.2 + ( k % 3 ) * 1.6, z = 92.6 + Math.floor( k / 3 ) * 0.8;
			C.add( { at: [ x, z ], face: [ x, z - 3 ], act: k % 3 === 0 ? 'wait' : 'listen', when: ( w ) => w.rate > 0.25 + k * 0.05 } );

		}

	}

	// ---------------------------------------------------------------- the police

	// The Pennsylvania State Police's mounted patrol (the Inquirer, 30 Oct 2008; Philadelphia's own
	// mounted unit was disbanded 2004-2011): two horses standing their ground on the sidewalk at the edge
	// of Pattison, a trooper up on each in his grey and his campaign hat, a kid reaching up to pat the
	// black one's nose, his father behind him; what they've left on the pavement. Philadelphia police at
	// the mid-block crossing: black leather jackets and peaked caps (Getty, Oct 2008), on the 27th a
	// yellow raincoat; one waving the crowd over, one watching
	_police() {

		const y = LEVELS.mainConcourse + LIFT;
		this.horses = new Horses( { group: this.group, y, spots: [ { at: [ - 88.2, 102.6 ], yaw: Math.PI / 2 + 0.08, coat: 0 }, { at: [ - 86.6, 104.9 ], yaw: Math.PI / 2 - 0.1, coat: 2 } ] } );
		this.riders = this.horses.list.map( ( h ) => {

			const c = this.cast.add( { at: [ h.x, h.z ], act: 'ride', who: 'trooper', noRainGear: true } );
			c.horse = h;
			return c;

		} );
		for ( const h of this.horses.list ) this.obstacles.push( [ h.x, h.z, 1.6 ], [ h.x - Math.sin( h.yaw ) * 1.4, h.z - Math.cos( h.yaw ) * 1.4, 1.0 ] );
		// the black horse's nose, the kid and his father
		const hb = this.horses.list[ 1 ], fx = - Math.sin( hb.yaw ), fz = - Math.cos( hb.yaw );
		const nose = [ hb.x + fx * 2.35, hb.z + fz * 2.35 ];
		this.cast.add( { at: nose, face: [ hb.x, hb.z ], act: 'pet', who: { kid: true }, noRainGear: true, when: ( w ) => w.rate > 0.04 } );
		this.cast.add( { at: [ nose[ 0 ] + fx * 0.9 + fz * 0.4, nose[ 1 ] + fz * 0.9 - fx * 0.4 ], face: [ hb.x, hb.z ], act: 'listen', when: ( w ) => w.rate > 0.04 } );
		// behind them, on the pavement
		manure( this.group, y, this.horses.list.map( ( h ) => [ h.x + Math.sin( h.yaw ) * 1.9 + 0.3, h.z + Math.cos( h.yaw ) * 1.9 ] ) );
		// Philadelphia police at the mid-block crossing
		const xm = - 104, zn = pattisonZ( xm ) - 9;
		this.cast.add( { at: [ xm + 2.6, zn - 0.9 ], face: [ xm, zn + 6 ], act: 'direct', who: 'policeRain', when: ( w ) => w.first } );
		this.cast.add( { at: [ xm + 2.6, zn - 0.9 ], face: [ xm, zn + 6 ], act: 'direct', who: 'police', when: ( w ) => ! w.first } );
		this.cast.add( { at: [ xm + 4.2, zn - 1.8 ], face: [ xm - 6, zn - 8 ], act: 'listen', who: 'policeRain', when: ( w ) => w.first } );
		this.cast.add( { at: [ xm + 4.2, zn - 1.8 ], face: [ xm - 6, zn - 8 ], act: 'listen', who: 'police', when: ( w ) => ! w.first } );

	}

	_updatePolice( dt ) {

		if ( ! this.horses ) return;
		this.horses.update( dt );
		for ( const c of this.riders ) {

			// up in the saddle: the pelvis in the seat, facing the way the horse does
			const s = this.horses.seat( c.horse ), f = c.f;
			f.x = s[ 0 ]; f.z = s[ 2 ]; f.y = s[ 1 ] - 0.9;
			f.yaw = c.horse.yaw;

		}

	}

	// ---------------------------------------------------------------- at the statue

	// The Schmidt statue, the place everyone says to meet ("I'm at the statue"): a family's picture in
	// front of it, the kid with his glove, the flash going off; a man with two tickets waiting on the phone
	// for his brother-in-law; on the dry 29th two guys sitting on the plinth's edge (as people did: Flickr
	// pingnews 2007, beauwhite 2007)
	_statueCrowd() {

		const S = STATUES[ 'Mike Schmidt' ]?.[ 0 ];
		if ( ! S ) return;
		const yaw = 2.75, f = [ - Math.sin( yaw ), - Math.cos( yaw ) ], u = [ - f[ 1 ], f[ 0 ] ];
		const at = ( a, o ) => [ S[ 0 ] + f[ 0 ] * a + u[ 0 ] * o, S[ 1 ] + f[ 1 ] * a + u[ 1 ] * o ];
		const C = this.cast, busy = ( w ) => w.rate > 0.06;
		// the picture: the kid (the glove on), his father's hand on his shoulder, his mother with the camera
		const kid = C.add( { at: at( 2.55, 0.35 ), face: at( 8, 0.2 ), act: 'pose', who: { kid: true }, props: [ 'glove' ], noRainGear: true, when: busy } );
		C.add( { at: at( 2.45, - 0.3 ), face: at( 8, 0 ), act: 'pose', who: { woman: false }, noRainGear: true, when: busy } );
		const cam = C.add( { at: at( 6.4, 0.1 ), face: at( 2.5, 0.1 ), act: 'photo', who: { woman: true }, noRainGear: true, when: busy } );
		if ( kid ) kid.f.pose.flexL = 0.9;
		// the flash, now and then (a white pop at the camera)
		this.flash = { c: cam, t: 3, on: 0 };
		const fm = standard( { name: 'w1-camera-flash', color: new Color( 1, 1, 1 ), lit: false,
			surface: 's.albedo = vec3f( 0.0 ); s.emissive = vec3f( 60.0, 58.0, 55.0 );' } );
		const fl = new Mesh( new SphereGeometry( 0.04, 8, 6 ), fm );
		fl.name = 'w1-flash';
		fl.userData.dynamic = true;
		fl.visible = false;
		this.group.add( fl );
		this.flash.mesh = fl;
		// waiting for someone, on the phone
		C.add( { at: at( 1.2, 3.1 ), face: at( 1.2, 8 ), act: 'wait', when: busy } );
		C.add( { at: at( - 0.6, - 3.2 ), face: at( - 0.6, - 9 ), act: 'phone', who: { woman: true }, when: ( w ) => w.rate > 0.3 } );
		// on the plinth's edge (the 29th, dry)
		for ( const o of [ - 1.1, 0.9 ] ) {

			const p = at( 2.0, o );
			C.add( { at: p, face: at( 6, o ), act: 'sit', y: 0.08, noRainGear: true, dry: true, when: ( w ) => ! w.first && ! w.celebrate } );

		}

	}

	// the TV light as a real light on the reporter (the app's local lights are made after the places)
	_lights() {

		if ( this._lit || ! this.app.localLights || ! this.tv ) return;
		this._lit = true;
		const F = this.field;
		for ( const L of this.tv.lights.slice( 0, 1 ) ) {

			const w = F.toWorld( L.at[ 0 ], L.at[ 2 ] ), w2 = F.toWorld( L.at[ 0 ] + L.dir[ 0 ], L.at[ 2 ] + L.dir[ 2 ] );
			const dir = new Vector3( w2.x - w.x, L.dir[ 1 ], w2.z - w.z ).normalize();
			this.app.localLights.add( { position: new Vector3( w.x, F.y0 + L.at[ 1 ], w.z ), dir, color: new Color( 1.0, 0.96, 0.9 ), intensity: 90, range: 14,
				cosInner: Math.cos( 0.45 ), cosOuter: Math.cos( 0.95 ), kind: 'lamp' } );

		}

	}

	_updateFlash( dt ) {

		const F = this.flash;
		if ( ! F?.c || ! F.c.f.visible ) {

			if ( F?.mesh ) F.mesh.visible = false;
			return;

		}

		F.t -= dt;
		if ( F.t <= 0 ) {

			F.on = 0.09;
			F.t = 6 + Math.random() * 7;

		}

		F.on = Math.max( 0, F.on - dt );
		const f = F.c.f, s = f.scale;
		F.mesh.visible = F.on > 0;
		F.mesh.position.set( f.x - Math.sin( f.yaw ) * 0.3 * s, f.y + 1.6 * s, f.z - Math.cos( f.yaw ) * 0.3 * s );

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

	// ---------------------------------------------------------------- the plaza's height

	// The plaza stood a curb above the street, level with the sidewalks: its paving and what stands on
	// it (Exterior's planters, benches, bollards, lamps, the statue) come up LIFT; the lamps' lights too
	_lift( app ) {

		const ex = app.exterior;
		if ( ! ex ) return;
		const skip = /^(facade|sidewalks|stair|channel|blade|suite|mcfaddens)/;
		ex.group.updateMatrixWorld( true );
		const box = { min: new Vector3(), max: new Vector3() };
		for ( const o of ex.group.children ) {

			if ( skip.test( o.name || '' ) ) continue;
			// where it is: a mesh's box, a group's position
			let x, z;
			if ( o.isMesh ) {

				o.geometry.computeBoundingBox?.();
				const b = o.geometry.boundingBox;
				if ( ! b ) continue;
				x = ( b.min.x + b.max.x ) / 2 + o.position.x; z = ( b.min.z + b.max.z ) / 2 + o.position.z;
				if ( b.max.x - b.min.x > 90 || b.max.z - b.min.z > 110 ) continue;

			} else {

				x = o.position.x; z = o.position.z;

			}

			if ( x > - 134 && x < - 60 && z > 10 && z < 99 ) o.position.y += LIFT;

		}

		for ( const l of ex.lamps || [] ) if ( l[ 0 ] > - 134 && l[ 0 ] < - 60 && l[ 2 ] > 10 && l[ 2 ] < 99 ) l[ 1 ] += LIFT;
		// the sports complex's street lamps that OpenStreetMap put on the plaza are its own pole lights
		// (Exterior's): no sodium cobra heads there
		const zero = new Matrix4().makeScale( 0, 0, 0 ), m = new Matrix4(), p = new Vector3();
		for ( const mesh of app.complex?.group.children.filter( ( c ) => c.name === 'poles' || c.name === 'pole-heads' ) || [] ) {

			for ( let i = 0; i < mesh.count; i ++ ) {

				mesh.getMatrixAt( i, m );
				p.setFromMatrixPosition( m );
				if ( p.x > - 134 && p.x < - 60 && p.z > 10 && p.z < 99 ) mesh.setMatrixAt( i, zero );

			}

			mesh.instanceMatrix.needsUpdate = true;

		}

	}

	// the ground under a person: the road, the raised plaza and sidewalks, the ramp down inside the gate
	groundAt( x, z ) {

		if ( Math.abs( z - pattisonZ( x ) ) < 9 && x > - 175 ) return 0.012;
		if ( Math.abs( x - eleventhX( z ) ) < 5 && z > - 40 ) return 0.012;
		const E = this.gate.edge;
		if ( E ) {

			const dx = x - E.a[ 0 ], dz = z - E.a[ 1 ];
			const s = dx * E.ux + dz * E.uz - E.t, o = dx * E.nx + dz * E.nz;
			if ( o < 0 && Math.abs( s ) < 16 ) return o > - 9.5 ? LIFT : Math.max( 0, LIFT * ( 1 - ( - 9.5 - o ) / 3 ) );

		}

		return LIFT;

	}

	// ---------------------------------------------------------------- the street trees

	// The plaza's trees (their spots from Exterior) and the sports complex's round the plaza on Pattison
	// and 11th (hidden there, their spots taken), all grown as real trees
	_trees( app ) {

		const spots = [];
		const near = ( x, z, d ) => spots.some( ( [ a, b ] ) => Math.hypot( a - x, b - z ) < d );
		// (not the one Exterior put against McFadden's front, in its door's way)
		for ( const [ x, z ] of app.exterior?.treeSpots || [] ) if ( ! ( x > - 73 && z > 60 && z < 90 ) ) spots.push( [ x, z ] );
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
		this.arrivals = new Arrivals( { folk: this.folk, gate: this.openGate, obstacles: this.obstacles, seed: 27, ground: ( x, z ) => this.groundAt( x, z ) } );

	}

	update( dt, director ) {

		const w = night( director );
		// the score: a run for the Phillies sets off a cheer, one for the Rays a groan (the ones following
		// the game outside react: Cast's reacts)
		const sc = w.seg?.snap?.score;
		this.cheer = Math.max( 0, ( this.cheer || 0 ) - dt );
		this.groan = Math.max( 0, ( this.groan || 0 ) - dt );
		if ( sc && this._score && Math.abs( w.t - ( this._scoreT ?? w.t ) ) < 3 ) {

			if ( sc.home > this._score.home ) this.cheer = 7;
			if ( sc.away > this._score.away ) this.groan = 4;

		}

		if ( sc ) this._score = { ...sc };
		this._scoreT = w.t;
		w.cheer = w.celebrate ? 0 : this.cheer;
		w.groan = this.groan;
		const A = this.arrivals;
		if ( A ) {

			// a jump in the replay (a seek, a skip) or the other night: everyone where they'd be now
			const speed = director?.speed ?? 1;
			const jumped = this._lastT === undefined || Math.abs( w.t - this._lastT ) > 3 + dt * speed * 2 || w.first !== this._lastFirst;
			if ( jumped ) {

				A.reset( w );
				this.cars?.reset( w.celebrate ? 0.9 : Math.min( 0.9, 0.3 + w.rate * 0.4 ) );

			}
			A.update( Math.min( dt, 0.1 ), w );
			this._lastT = w.t;
			this._lastFirst = w.first;

		}

		this.cast?.update( Math.min( dt, 0.1 ), w );
		this._updatePolice( Math.min( dt, 0.1 ) );
		this.tv?.update( Math.min( dt, 0.1 ) );
		this.cars?.update( Math.min( dt, 0.1 ), w );
		this.clock += dt;
		this.furniture?.update( w, this.clock );
		this._lights();
		this._updateFlash( Math.min( dt, 0.1 ) );
		this.openGate?.poseTripods();
		this.folk?.update();

	}

}
