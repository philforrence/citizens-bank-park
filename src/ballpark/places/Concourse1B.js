import { Group, Mesh, BufferGeometry, Float32BufferAttribute, Vector3, Sphere } from '../../engine/index.js';
import { standard } from '../../materials/Materials.js';
import { LEVELS } from '../layout.js';
import { G } from '../../core/Globals.js';
import { Cast } from './Cast.js';
import { rng } from './Concourse3BKit.js';
import { nightState, RAIL_D, FRONT_D } from './Concourse3BPeople.js';
import { LiveTV } from './Concourse3BTV.js';
import { floorSkin } from './Concourse3BFloor.js';
import { Steam } from './Concourse3BSteam.js';
import { Kit, trashCan, recycleBin, condiments, cart, pendant } from './Concourse3BProps.js';
import { Walk1B } from './concourse1b/Walk.js';
import { People1B, GATE_S, S_END } from './concourse1b/People.js';
import { buildGate1B } from './concourse1b/Gate.js';
import { Arrivals1B } from './concourse1b/Arrivals.js';
import { Prints } from './concourse1b/Prints.js';
import { Stories1B } from './concourse1b/Stories.js';
import { Sounds1B } from './concourse1b/Sounds.js';
import { programKiosk, caricatureCorner, cartSigns, cartTop } from './concourse1b/Things.js';

// The main concourse on the first base side, behind home plate round to the right field corner (sections
// 122 to 108), and the First Base Gate: the other half of the walkable ring, and the other way in. It was
// People.js's generic walkers and one stand front repeated; on the night it's this:
//
//   the concourse's people (W2's concourse crowd on this side, concourse1b/People.js): up from the seats,
//     along to a stand, the line, the counter, the food handed over, back to the seats; the drink rail,
//     the restroom lines, the crowd standing behind home plate
//   the carts and kiosks where the Phillies' October 2008 concessions guide put this side's portables:
//     nachos behind 122 and 111, draft beer behind 119 and 110, bottled beer 109, water ice 116 (on a
//     47-degree night it sells hot chocolate), the Hatfield cart 114, the Phanatic Phood cart by the kids'
//     zone 112-113, cotton candy 107
//   the bins, the condiment stations, the pendants, the TVs over the stands (the broadcast W2 draws)
//   the floor: the rain walked in from the First Base Gate, the litter piling up
//   steam off the grills and the cups, people's breath
//
// Field frame (in the Field's group); the concourse floor is at LEVELS.mainConcourse. Along the concourse
// the place works in ( s, d ) (concourse1b/Walk.js): s from behind home plate toward first, d out from the
// field level's front line.
const STREET = LEVELS.mainConcourse;

export default class Concourse1B {

	constructor( { app, field, bowl, people, colliders } ) {

		this.app = app;
		this.field = field;
		this.bowl = bowl;
		this.group = new Group();
		this.group.name = 'concourse1b';
		const concourse = this.concourse = app?.concourse;
		this.W = new Walk1B( bowl.path );
		// the third base side's place, if it's built: its props' material and its broadcast are shared
		this.w2 = app?.places?.find( ( p ) => p.name === 'concourse3b' ) || null;
		this.obstacles = [];
		this._columns();
		// the First Base Gate open for the game
		this.gate = buildGate1B( { group: this.group, exterior: app?.exterior, colliders, field } );
		this.kit = this._kit();
		this.prints = new Prints();
		this._bins();
		this._carts();
		this._tvs();
		this._lights();
		this._hung();
		this._fronts();
		this.group.add( this.kit.mesh( 'concourse1b-props' ) );
		this.group.add( this.prints.mesh() );
		// the floor on the night
		const doors = ( concourse?.doors || [] ).map( ( D ) => this.W.toSD( D.x, D.z ) ).filter( ( [ s ] ) => s > - 2 && s < S_END + 2 );
		this.floor = floorSkin( this.W, { sEnd: S_END, gate: [ GATE_S + 3, 54 ], doors, lamps: this.lamps,
			spills: [ [ 89.5, 43.4, 1.2 ], [ 88.2, 42.2, 0.5 ], [ 26, 41.2, 0.6 ], [ 109, 41.6, 0.7 ], [ 125, 41.5, 0.5 ], [ 17.4, 43.6, 0.45 ], [ 40, 30.7, 0.45 ], [ 70, 30.8, 0.4 ] ] } );
		this.floor.name = 'concourse1b-floor';
		this.group.add( this.floor );
		// the people
		this.cast = new Cast( { parent: this.group, max: 560 } );
		const mid = this.W.at( S_END / 2, 40 );
		for ( const m of [ this.cast.mesh, this.cast.meshFar, this.cast.meshTiny, this.cast.blobs ] ) m.boundingSphere = new Sphere( new Vector3( mid.x, STREET + 1, mid.z ), S_END * 0.55 + 60 );
		this.people = new People1B( { cast: this.cast, walkway: this.W, concourse, bowl, obstacles: this.obstacles, carts: this.carts, seed: 1029 } );
		this.stories = new Stories1B( this.people, { caricature: this.caricature } );
		// the fans coming in through the gate
		if ( this.gate ) {

			this._takeOverGate( people );
			const plaza = [ [ 75, 69.8, 2.2 ], ...( this.gate.bins || [] ).map( ( b ) => [ b[ 0 ], b[ 2 ], 0.45 ] ) ];
			this.arrivals = new Arrivals1B( { cast: this.cast, gate: this.gate, people: this.people, obstacles: plaza, seed: 1101 } );

		}

		// steam off the grills and the cups, and the breath
		this.steam = new Steam( { parent: this.group, bounds: this.cast.mesh.boundingSphere } );
		this.steam.mesh.name = 'concourse1b-steam';
		this._steamers();
		people?.hiders?.push( ( x, z ) => this.covers( x, z ) );
		// what it sounds like (set up once the park's sound exists)
		this.sounds = new Sounds1B( this );

	}

	// People.js put a ticket taker at each of the gate's lanes and a guard either side: here they're the
	// gate's own (Arrivals1B), so they go
	_takeOverGate( people ) {

		if ( ! people?.list ) return;
		const g = this.gate.gate.at;
		people.list = people.list.filter( ( p ) => ! ( Math.hypot( p.x - g[ 0 ], p.z - g[ 1 ] ) < 20 && Math.abs( p.y - STREET ) < 0.6 && ( p.reachAt != null || p.role === 2 ) ) );

	}

	// the props kit: the third base side's (one material, so the batching merges the two sides' props into
	// one draw), or a kit of its own when that side isn't built
	_kit() {

		const K2 = this.w2?.kit;
		if ( ! K2?.material ) return new Kit();
		return Object.assign( Object.create( Kit.prototype ), { pos: [], nrm: [], uv: [], k: 0, atlas: K2.atlas, atlas2: K2.atlas2, material: K2.material } );

	}

	// a frame on the floor at a walkway point ( W.at ): x to the right looking at the field (toward home
	// plate), z toward the field; the same handedness as the props' own (this side's s runs the other way)
	_frame( w ) {

		return Kit.frame( [ w.x, w.z ], [ - w.ux, - w.uz ], [ w.nx, w.nz ] );

	}

	// is ( x, z ) in this stretch of the concourse (from the top of the seats out to the stands' backs, and
	// the gate's mouth)?
	covers( x, z ) {

		const G = this._coverGrid || ( this._coverGrid = this._makeCoverGrid() );
		const i = Math.floor( ( x - G.x0 ) / 0.5 ), j = Math.floor( ( z - G.z0 ) / 0.5 );
		if ( i < 0 || j < 0 || i >= G.nx || j >= G.nz ) return false;
		return G.cells[ i + j * G.nx ] === 1;

	}

	_makeCoverGrid() {

		const x0 = - 2, x1 = 125, z0 = - 60, z1 = 72, nx = Math.ceil( ( x1 - x0 ) / 0.5 ), nz = Math.ceil( ( z1 - z0 ) / 0.5 );
		const cells = new Uint8Array( nx * nz );
		for ( let j = 0; j < nz; j ++ ) for ( let i = 0; i < nx; i ++ ) {

			const [ s, d ] = this.W.toSD( x0 + ( i + 0.5 ) * 0.5, z0 + ( j + 0.5 ) * 0.5 );
			cells[ i + j * nx ] = s > 0 && s < S_END + 2 && d > RAIL_D - 0.6 && d < 62 ? 1 : 0;

		}

		return { x0, z0, nx, nz, cells };

	}

	// the club level's columns: down the middle of the walkway as far as 112, then on the rail's line
	_columns() {

		const W = this.W, seen = [];
		this.bowl.group.traverse( ( o ) => {

			if ( ! o.isMesh || o.material?.name !== 'columns' ) return;
			const [ s, d ] = W.toSD( o.position.x, o.position.z );
			if ( s > 2 && s < S_END + 10 && d > RAIL_D - 1 && d < FRONT_D - 1 ) seen.push( [ s, d, 0.5 ] );

		} );
		seen.sort( ( a, b ) => a[ 0 ] - b[ 0 ] );
		this.obstacles.push( ...seen );
		this.columns = seen;

	}

	// this stretch's built-in units (Concourse.js's), with their ( s, d )
	_units() {

		return ( this.concourse?.units || [] ).map( ( U ) => ( { U, s: this.W.toSD( U.mid[ 0 ], U.mid[ 1 ] )[ 0 ] } ) ).filter( ( { s } ) => s > 2 && s < S_END + 4 );

	}

	// The red cans with a blue recycling bin beside each, in the gaps between the stands and against every
	// other column; a condiment station beside each grill's and market's line
	_bins() {

		const K = this.kit, W = this.W, r = rng( 177 );
		const units = this._units();
		const place = ( x, z, rad ) => this.obstacles.push( [ ...W.toSD( x, z ), rad ] );
		for ( const { U } of units ) {

			if ( ! U.gap || U.last ) continue;
			const o = [ U.gap[ 0 ] + U.n[ 0 ] * 0.45, U.gap[ 1 ] + U.n[ 1 ] * 0.45 ];
			const P = Kit.frame( o, U.a, U.n );
			trashCan( K, P, - 0.32, 0, r );
			recycleBin( K, P, 0.32, 0 );
			place( o[ 0 ], o[ 1 ], 0.7 );

		}

		this.columns.forEach( ( [ s, d ], i ) => {

			if ( i % 2 ) return;
			// on the walkway's side of the column: the stands' side where the columns run down the middle,
			// the concourse's side where they stand on the rail
			const dd = d > 38 ? d - 0.72 : d + 0.72;
			const w = W.at( s, dd );
			trashCan( K, this._frame( w ), 0, 0, r );
			this.obstacles.push( [ s, dd, 0.35 ] );

		} );
		for ( const { U } of units ) {

			if ( ! [ 'cobblestone', 'hatfield', 'market', 'schmitter' ].includes( U.what ) ) continue;
			const side = ( U.sec % 2 ) ? 1 : - 1;
			const o = [ U.mid[ 0 ] + U.a[ 0 ] * side * 3.15 + U.n[ 0 ] * 1.5, U.mid[ 1 ] + U.a[ 1 ] * side * 3.15 + U.n[ 1 ] * 1.5 ];
			condiments( K, Kit.frame( o, U.a, U.n ), 0, 0, r );
			place( o[ 0 ], o[ 1 ], 0.75 );

		}

	}

	// The portables where the October 2008 concessions guide put them on this side. Where the columns run
	// down the middle (to 112) a cart stands between two of them, facing the rail's side where the people
	// walk; past there the walkway's open, and they stand out in it.
	_carts() {

		const K = this.kit, W = this.W, r = rng( 191 );
		const mids = this.columns.filter( ( c ) => c[ 1 ] > 38 ).map( ( c ) => c[ 0 ] );
		const between = ( s ) => {

			for ( let i = 0; i < mids.length - 1; i ++ ) if ( mids[ i ] <= s && s <= mids[ i + 1 ] ) return ( mids[ i ] + mids[ i + 1 ] ) / 2;
			return s;

		};

		this.carts = [];
		const Pr = this.prints;
		const put = ( kind, brand, s0, d = 40.9 ) => {

			const s = s0 < 90 ? between( s0 ) : s0;
			const w = W.at( s, d );
			const n = [ w.nx, w.nz ], a = [ - w.ux, - w.uz ];
			const P = this._frame( w );
			// W2's carts where the kind's theirs; this side's own signs and tops on the others
			const own = [ 'hatfieldCart', 'phood' ].includes( brand ), beer = brand === 'draft' || brand === 'bottles';
			cart( K, P, own ? 'plain' : kind, r, false );
			if ( own ) cartTop( Pr, K, P, brand );
			// (the beer carts keep W2's tub of ice; their signs are this side's)
			if ( own || beer ) cartSigns( Pr, P, brand, beer ? 0.05 : 0.035 );

			if ( brand === 'waterIce' ) {

				// on a 47-degree night: HOT CHOCOLATE $3.00 in marker, taped over the sign, an urn on the lid
				Pr.panel( P, 0.42, 0.95 + 1.35, 0.045, 0.42, 0.31, 'cocoaSign' );
				Pr.panel( P, - 0.3, 0.56, 0.4 + 0.014, 0.36, 0.27, 'cocoaSign' );
				K.use( 'steel' ).cyl( P, - 0.35, - 0.1, 0.95 + 0.22, 0.95 + 0.72, 0.13, 0.13, 12 );
				K.use( 'rubber' ).box( P, - 0.35, 0.95 + 0.34, 0.06, 0.05, 0.06, 0.06 );
				for ( let i = 0; i < 3; i ++ ) K.use( 'cup' ).cyl( P, 0.05 + i * 0.09, 0.2, 0.95 + 0.22, 0.95 + 0.5 - i * 0.04, 0.035, 0.045, 8 );

			}

			this.obstacles.push( [ s, d, 1.0 ] );
			this.carts.push( { kind: brand, s, d, x: w.x, z: w.z, n, u: a } );

		};

		put( 'nachos', 'nachos', 9 );
		put( 'beer', 'draft', 26 );
		put( 'waterIce', 'waterIce', 44 );
		put( 'nachos', 'hatfieldCart', 60 );
		put( 'cottonCandy', 'phood', 84.6 );
		put( 'nachos', 'nachos', 97, 40.6 );
		put( 'beer', 'draft', 108.5, 40.6 );
		put( 'beer', 'bottles', 125, 40.6 );
		put( 'cottonCandy', 'cottonCandy', 146, 40.6 );
		// the World Series program kiosk in the walkway behind 115-116 (Getty 83600062, Game 3), and Gus
		{

			const s = 51.5, d = 37.3, w = W.at( s, d );
			programKiosk( Pr, K, this._frame( w ) );
			this.obstacles.push( [ s, d, 1.25 ] );
			this.carts.push( { kind: 'programs', s, d, x: w.x, z: w.z, n: [ w.nx, w.nz ], u: [ - w.ux, - w.uz ] } );

		}

		// the caricaturist's corner, against the wall between the Creamery and the Market (109-110)
		{

			const s = 119.2, d = 42.9, w = W.at( s, d );
			caricatureCorner( Pr, this._frame( w ) );
			this.caricature = { s, d, x: w.x, z: w.z, n: [ w.nx, w.nz ], u: [ - w.ux, - w.uz ] };
			this.obstacles.push( [ s, d - 0.4, 1.3 ], [ s - 1.2, d + 0.3, 0.6 ] );

		}

	}

	// The TVs over the stands and the restrooms' doors (a 42-inch flat in a black bezel on the unit's roof,
	// tipped down to the walkway), showing the broadcast W2's LiveTV draws; its own if that side isn't built
	_tvs() {

		const K = this.kit;
		this.tv = this.w2?.tv || null;
		if ( ! this.tv ) {

			this.tv = new LiveTV();
			this.ownTV = true;
			this.concourse?.group.traverse( ( o ) => {

				if ( o.isMesh && o.material?.name === 'concourse-tv' ) this.tv.feed( o.material.bindings?.bpTV?.texture );

			} );

		}

		const pos = [], nrm = [], uv = [];
		const w = 0.93, h = 0.53, tilt = 0.2;
		for ( const { U } of this._units() ) {

			const P = Kit.frame( U.mid, U.a, U.n );
			const y0 = 4.42, z0 = 0.1;
			K.use( 'lid' ).box( P, 0, 4.3, - 0.1, 0.1, 0.2, 0.1 );
			const c = ( x, y ) => P( x, y0 + y * Math.cos( tilt ), z0 + y * Math.sin( tilt ) );
			const back = ( x, y ) => P( x, y0 + y * Math.cos( tilt ) + 0.06 * Math.sin( tilt ), z0 + y * Math.sin( tilt ) - 0.06 * Math.cos( tilt ) );
			const bw = w / 2 + 0.03, bh = h + 0.03;
			K.use( 'lid' ).quad( back( - bw, - 0.03 ), back( bw, - 0.03 ), back( bw, bh ), back( - bw, bh ), P.dir( 0, - Math.sin( tilt ), - Math.cos( tilt ) ) );
			for ( const [ a, b ] of [ [ [ - bw, - 0.03 ], [ bw, - 0.03 ] ], [ [ bw, - 0.03 ], [ bw, bh ] ], [ [ bw, bh ], [ - bw, bh ] ], [ [ - bw, bh ], [ - bw, - 0.03 ] ] ] ) {

				const nx = a[ 1 ] === b[ 1 ] ? 0 : Math.sign( a[ 0 ] ), ny = a[ 0 ] === b[ 0 ] ? 0 : Math.sign( a[ 1 ] - h / 2 );
				K.quad( c( ...a ), c( ...b ), back( ...b ), back( ...a ), P.dir( nx, ny, 0 ) );

			}

			const fn = P.dir( 0, Math.sin( tilt ), Math.cos( tilt ) );
			K.quad( c( - bw, - 0.03 ), c( bw, - 0.03 ), c( w / 2, 0 ), c( - w / 2, 0 ), fn );
			K.quad( c( - w / 2, h ), c( w / 2, h ), c( bw, bh ), c( - bw, bh ), fn );
			K.quad( c( - bw, - 0.03 ), c( - w / 2, 0 ), c( - w / 2, h ), c( - bw, bh ), fn );
			K.quad( c( w / 2, 0 ), c( bw, - 0.03 ), c( bw, bh ), c( w / 2, h ), fn );
			const f = ( x, y ) => P( x, y0 + y * Math.cos( tilt ), z0 + y * Math.sin( tilt ) + 0.004 );
			for ( const [ a, b, cc ] of [ [ [ - 1, 0 ], [ 1, 0 ], [ 1, 1 ] ], [ [ - 1, 0 ], [ 1, 1 ], [ - 1, 1 ] ] ] ) for ( const [ x, y ] of [ a, b, cc ] ) {

				pos.push( ...f( x * w / 2, y * h ) );
				nrm.push( ...fn );
				uv.push( ( x + 1 ) / 2, 1 - y );

			}

		}

		const g = new BufferGeometry();
		g.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
		g.setAttribute( 'normal', new Float32BufferAttribute( nrm, 3 ) );
		g.setAttribute( 'uv', new Float32BufferAttribute( uv, 2 ) );
		g.computeBoundingBox();
		g.computeBoundingSphere();
		// the third base side's screens' material if there is one (the batching merges them)
		let mat = null;
		this.w2?.group.traverse( ( o ) => {

			if ( o.isMesh && o.material?.name === 'concourse3b-tv' ) mat = o.material;

		} );
		if ( ! mat ) {

			mat = standard( { name: 'concourse3b-tv', roughness: 0.15, side: 'double', textures: { c3bTV: this.tv.texture },
				surface: 'let t = textureSample( c3bTV, smpAnisoClamp, in.uv ).rgb; s.albedo = t * 0.06; s.emissive = t * 1.1;' } );
			mat.underwaterLighting = 'none';
			mat.setDefine( 'DRY', 1 );

		}

		const mesh = new Mesh( g, mat );
		mesh.name = 'concourse1b-tv';
		this.group.add( mesh );

	}

	// the white dome pendants down the walkway between the columns (and along the stands' side), the pools
	// of light on the floor after dark
	_lights() {

		const K = this.kit, W = this.W, top = 11.5;
		this.lamps = [];
		const cols = this.columns.map( ( c ) => c[ 0 ] );
		for ( let i = 0; i < cols.length - 1; i ++ ) {

			const s = ( cols[ i ] + cols[ i + 1 ] ) / 2;
			if ( s < 1 || s > S_END - 1 || cols[ i + 1 ] - cols[ i ] > 12 ) continue;
			for ( const d of [ 36.4, 43.0 ] ) {

				const w = W.at( s, d );
				pendant( K, this._frame( w ), 0, 0, 7.2, top );
				this.lamps.push( [ s, d ] );

			}

		}

	}

	// a frame facing fwd ( [ x, z ], unit ), its right-hand side worked out (right x up = fwd)
	_facing( o, fwd ) {

		return Kit.frame( o, [ fwd[ 1 ], - fwd[ 0 ] ], fwd );

	}

	// What hangs over this side: the players' banners in the trusses (a photo in a navy frame, a red
	// nameplate in cream serif caps, as the 2008 photos show them on the other side): Utley over the First
	// Base Gate's way in and Hamels over its turnstiles, as Rollins and Feliz hang over the Third Base
	// Gate's; Howard behind 116-117 (where a 2010 photo has him), Victorino by 120, Werth by 111, Myers by
	// 108-109. The Coca-Cola pole banners on the columns' walkway faces. The directional signs: behind
	// 108-109 (a 2010 photo there: RAMP TO ALL LEVELS, ADVANCE TICKETS, GUEST SERVICES, FIRST BASE GATE),
	// and at the gate's way in, facing the turnstiles.
	_hung() {

		const Pr = this.prints, K = this.kit, W = this.W, top = 11.5;
		const along = ( s, d ) => {

			const w = W.at( s, d );
			return this._facing( [ w.x, w.z ], [ - w.ux, - w.uz ] );

		};

		for ( const [ cell, s, d, y ] of [ [ 'utley', 70.5, 47.4, 8.4 ], [ 'hamels', 80.5, 51.2, 7.7 ], [ 'howard', 46, 46.4, 8.5 ], [ 'victorino', 21, 46.4, 8.5 ], [ 'werth', 99, 46.6, 8.4 ], [ 'myers', 133, 46.6, 8.4 ] ] ) {

			const P = along( s, d );
			Pr.sheet( P, 0, y, 0, 3.4, 4.25, cell );
			K.use( 'navy' ).box( P, 0, y + 2.17, 0, 3.5, 0.08, 0.06 );
			for ( const x of [ - 1.5, 1.5 ] ) K.use( 'grey' ).box( P, x, ( y + 2.2 + top ) / 2, 0, 0.012, top - y - 2.2, 0.012 );

		}

		// the pole banners: on the walkway's side of a column (the field's side where the columns run down
		// the middle; the concourse's where they stand on the rail)
		for ( const [ cell, s0 ] of [ [ 'pole8', 22.3 ], [ 'pole6', 38.8 ], [ 'pole28', 64.9 ], [ 'pole54', 104.6 ], [ 'pole11', 128.1 ] ] ) {

			const col = this.columns.find( ( c ) => Math.abs( c[ 0 ] - s0 ) < 0.8 );
			if ( ! col ) continue;
			const rail = col[ 1 ] < 35, w = W.at( col[ 0 ], col[ 1 ] + ( rail ? 0.37 : - 0.37 ) );
			const P = this._facing( [ w.x, w.z ], rail ? [ - w.nx, - w.nz ] : [ w.nx, w.nz ] );
			Pr.sheet( P, 0, 4.7, 0, 0.8, 2.1, cell );
			for ( const y of [ 3.62, 5.78 ] ) K.use( 'grey' ).box( P, 0, y, 0, 0.84, 0.03, 0.03 );

		}

		// the directional signs, each one-sided (the arrows are for one way of walking)
		{

			const w = W.at( 124, 42.6 );
			const P = this._facing( [ w.x, w.z ], [ w.ux, w.uz ] );
			Pr.use( 'white' ).box( P, 0, 4.3, 0, 1.3, 1.95, 0.04, 'wayRF' );
			for ( const x of [ - 0.5, 0.5 ] ) K.use( 'grey' ).box( P, x, ( 5.3 + top ) / 2, 0, 0.015, top - 5.3, 0.015 );

		}

		if ( this.gate ) {

			const g = this.gate, c = g.P( 0, - 10.5 );
			const P = this._facing( [ c[ 0 ], c[ 2 ] ], g.n );
			Pr.use( 'white' ).box( P, 0, 4.4, 0, 1.3, 1.95, 0.04, 'wayGate' );
			for ( const x of [ - 0.5, 0.5 ] ) K.use( 'grey' ).box( P, x, ( 5.4 + top ) / 2, 0, 0.015, top - 5.4, 0.015 );

		}

	}

	// The stands' fronts as they were: the South Philadelphia Market's illustrated header (the April 2008
	// photo of one: SOUTH PHILADELPHIA over a sunburst, 9TH ST. MARKET on a ribbon, the Italian Market's
	// panel, a vendor in his apron) over the generic name band Concourse.js gives every market
	_fronts() {

		const Pr = this.prints;
		for ( const { U } of this._units() ) {

			if ( U.what !== 'market' ) continue;
			const P = Kit.frame( U.mid, U.a, U.n );
			Pr.panel( P, 0, 3.76, 0.075, 7.56, 0.9, 'market' );
			// its edges: a navy return round the panel's thickness
			Pr.use( 'navy' ).box( P, 0, 3.76, 0.06, 7.6, 0.94, 0.02 );

		}

	}

	// what steams: the grills' flat-tops behind the counters, the steam rolling out under the menu boards
	_steamers() {

		for ( const { U } of this._units() ) {

			if ( ! [ 'cobblestone', 'hatfield', 'schmitter' ].includes( U.what ) ) continue;
			for ( const x of [ - 1.8, 0, 1.8 ] ) {

				const p = [ U.mid[ 0 ] + U.a[ 0 ] * x - U.n[ 0 ] * 0.95, STREET + 1.15, U.mid[ 1 ] + U.a[ 1 ] * x - U.n[ 1 ] * 0.95 ];
				this.steam.emit( { x: p[ 0 ], y: p[ 1 ], z: p[ 2 ], rate: 2.2, kind: 0, spread: [ 1.2, 0.4 ], drift: [ U.n[ 0 ] * 0.2, U.n[ 1 ] * 0.2 ], rise: 0.3, life: 3.4 } );

			}

		}

	}

	// what's going on (for the tests in Node)
	report() {

		const A = this.arrivals?.count();
		return `gate ${ A ? JSON.stringify( A ) : 'none' } cast ${ this.cast.list.filter( ( p ) => p.visible ).length }/${ this.cast.list.length }`;

	}

	update( dt, director ) {

		const ns = nightState( director );
		this.night = ns;
		// on arriving (and after a jump in the replay) the concourse has been going a while
		const t = director ? director.t : 0;
		if ( ! this._warm || Math.abs( t - this._lastT ) > 30 ) {

			this.people.warming = true;
			for ( let i = 0; i < 240; i ++ ) this.people.update( 0.25, ns );
			this.people.warming = false;
			this.arrivals?.reset( ns, t );
			this.steam.warm( G.time.value );
			this._warm = true;
			for ( const p of this.cast.list ) p.fresh = true;

		}

		this._lastT = t;
		const camF = this.app?.camera ? this.field.toField( this.app.camera.position.x, this.app.camera.position.z ) : null;
		const cam = camF ? [ camF[ 0 ], 0, camF[ 1 ] ] : null;
		this.people.cam = camF;
		this.people.update( dt, ns );
		this.stories.update( dt, ns );
		this.arrivals?.update( dt, ns, t );
		this.steam.update( dt, G.time.value, { cast: this.cast, cam, cold: ns.first ? 0.6 : 1.0, wind: ns.first ? [ 0.12, - 0.06 ] : [ 0.2, 0.1 ] } );
		this.cast.update( cam );
		this.sounds.update( dt, ns, camF );
		if ( this.ownTV ) this.tv.update( dt, director, ns );
		// the floor: wet on the 27th (wetter as it pours), dry prints on the 29th, the litter piling up
		const U = this.floor.material.uniforms;
		const game = ns.inning ? Math.min( 1, ( ( ns.inning - 1 ) * 2 + ( ns.half === 'top' ? 0 : 1 ) ) / 17 ) : 0.3;
		U.rainK.value = ns.first || ns.suspended ? 0.35 + 0.65 * ns.rain : 0.12;
		U.dryK.value = ns.first ? 0 : 1;
		U.litterK.value = 0.25 + 0.6 * game + ( ns.celebrate ? 0.3 : 0 ) + ( ns.suspended ? 0.2 : 0 );

	}

}
