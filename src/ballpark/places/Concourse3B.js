import { Group, Mesh, BufferGeometry, Float32BufferAttribute, Matrix4, Vector3, Sphere } from '../../engine/index.js';
import { standard } from '../../materials/Materials.js';
import { LiveTV } from './Concourse3BTV.js';
import { floorSkin } from './Concourse3BFloor.js';
import { LEVELS } from '../layout.js';
import { Cast } from './Cast.js';
import { Walkway } from './Concourse3BKit.js';
import { ConcoursePeople, nightState, RAIL_D, FRONT_D } from './Concourse3BPeople.js';
import { Stories } from './Concourse3BStories.js';
import { Steam } from './Concourse3BSteam.js';
import { G } from '../../core/Globals.js';
import { Kit, trashCan, recycleBin, condiments, cart, programTable, pendant } from './Concourse3BProps.js';
import { rng } from './Concourse3BKit.js';

// The main concourse from behind home plate round to the third base side (sections 123 to 135): the
// walk in from the Third Base Gate to your seat, at street level, under the suite level and open to the
// field. Concourse.js built its bones (the stands and their kitchens, the drink rail, the section
// plates); this is the place itself on the night: the people, what stands about on the floor, what's on
// the TVs, the weather tracked in on everything.
//
// Field frame (in the Field's group): x, z metres from the back tip of home plate, -z toward center
// field, y up from the field; the concourse floor is at LEVELS.mainConcourse. Along the concourse the
// place works in its own ( s, d ) (Concourse3BKit.Walkway): s along it from behind home plate (s = 0 at
// x = 0) toward third, d out from the field level's front line.
const STREET = LEVELS.mainConcourse;
// the stretch: from behind home plate to the Hatfield Grill behind 135
export const S_END = 118;

export default class Concourse3B {

	constructor( { app, field, bowl, people } ) {

		this.app = app;
		this.field = field;
		this.bowl = bowl;
		this.group = new Group();
		this.group.name = 'concourse3b';
		const concourse = this.concourse = app?.concourse;
		this.W = new Walkway( bowl.path );
		// what's in the way on the floor: the club level's columns down the middle of the walkway (and the
		// Arcade's at the rail past 134), [ s, d, radius ]
		this.obstacles = [];
		this._columns();
		// the things on the floor (one draw), before the people (the lines bend round them)
		this.kit = new Kit();
		this._bins();
		this._carts();
		this._tvs();
		this._hung();
		this.group.add( this.kit.mesh() );
		// the floor on the night: the wet, the prints, the spills, the litter
		const doors = ( concourse?.doors || [] ).map( ( D ) => this.W.toSD( D.x, D.z ) ).filter( ( [ s ] ) => s > - 2 && s < S_END + 2 );
		this.floor = floorSkin( this.W, { sEnd: S_END, gate: [ 73.2, 60 ], doors, lamps: this.lamps,
			spills: [ [ 65, 43.4, 1.3 ], [ 63.4, 42.3, 0.6 ], [ 67.2, 41.8, 0.45 ], [ 17.4, 43.6, 0.5 ], [ 56.3, 43.2, 0.45 ], [ 47, 30.7, 0.5 ], [ 22, 30.6, 0.4 ], [ 88, 30.8, 0.4 ] ] } );
		this.group.add( this.floor );
		// the people: the cast (drawn here), and People.js's own figures handed over to it in this stretch
		this.cast = new Cast( { parent: this.group, max: 360 } );
		// where the cast is (for ?focus=, which drops what's wholly outside its circle)
		const mid = this.W.at( S_END / 2, 40 );
		for ( const m of [ this.cast.mesh, this.cast.meshFar, this.cast.blobs ] ) m.boundingSphere = new Sphere( new Vector3( mid.x, STREET + 1, mid.z ), S_END * 0.6 + 20 );
		this.people = new ConcoursePeople( { cast: this.cast, walkway: this.W, concourse, bowl, sEnd: S_END, obstacles: this.obstacles, carts: this.carts, seed: 1027 } );
		this.stories = new Stories( this.people );
		// steam off the grills and the urns and the cups, and people's breath
		this.steam = new Steam( { parent: this.group, bounds: this.cast.mesh.boundingSphere } );
		this._steamers();
		people?.hiders?.push( ( x, z ) => this.covers( x, z ) );
		// the rain's cover: built now, before the static batching takes the bowl's meshes apart
		const t0 = performance.now();
		this._cover = this._rainCover();
		this.coverMs = Math.round( performance.now() - t0 );

	}

	// is ( x, z ) in this stretch of the concourse (from the top of the seats out to the stands' backs)?
	covers( x, z ) {

		// a grid of the answer, half a metre a cell, over the box round the stretch (worked out once)
		const G = this._coverGrid || ( this._coverGrid = this._makeCoverGrid() );
		const i = Math.floor( ( x - G.x0 ) / 0.5 ), j = Math.floor( ( z - G.z0 ) / 0.5 );
		if ( i < 0 || j < 0 || i >= G.nx || j >= G.nz ) return false;
		return G.cells[ i + j * G.nx ] === 1;

	}

	_makeCoverGrid() {

		const x0 = - 105, x1 = 2, z0 = - 35, z1 = 72, nx = Math.ceil( ( x1 - x0 ) / 0.5 ), nz = Math.ceil( ( z1 - z0 ) / 0.5 );
		const cells = new Uint8Array( nx * nz );
		for ( let j = 0; j < nz; j ++ ) for ( let i = 0; i < nx; i ++ ) {

			const [ s, d ] = this.W.toSD( x0 + ( i + 0.5 ) * 0.5, z0 + ( j + 0.5 ) * 0.5 );
			cells[ i + j * nx ] = s > - 0.5 && s < S_END + 0.5 && d > RAIL_D - 0.6 && d < 62 ? 1 : 0;

		}

		return { x0, z0, nx, nz, cells };

	}

	_columns() {

		const W = this.W;
		const seen = [];
		this.bowl.group.traverse( ( o ) => {

			if ( ! o.isMesh || o.material?.name !== 'columns' ) return;
			const [ s, d ] = W.toSD( o.position.x, o.position.z );
			if ( s > - 10 && s < S_END + 10 && d > RAIL_D - 1 && d < FRONT_D - 1 ) seen.push( [ s, d, 0.5 ] );

		} );
		this.obstacles.push( ...seen );
		this.columns = seen;

	}

	// The trash cans: red Phillies cans with a blue recycling bin beside each, in the gaps between the
	// stands and against every other column down the middle; a condiment station beside each grill's and
	// market's line, where the hot dogs and the cheesesteaks come out
	_bins() {

		const K = this.kit, W = this.W, r = rng( 77 );
		const units = ( this.concourse?.units || [] ).filter( ( U ) => {

			const [ s ] = W.toSD( U.mid[ 0 ], U.mid[ 1 ] );
			return s > - 4 && s < S_END + 4;

		} );
		const place = ( x, z, rad ) => {

			const [ s, d ] = W.toSD( x, z );
			this.obstacles.push( [ s, d, rad ] );

		};

		for ( const U of units ) {

			if ( ! U.gap || U.last ) continue;
			// in front of the gap to the next stand, facing the walkway
			const n = U.n, a = U.a;
			const o = [ U.gap[ 0 ] + n[ 0 ] * 0.45, U.gap[ 1 ] + n[ 1 ] * 0.45 ];
			const P = Kit.frame( o, a, n );
			trashCan( K, P, - 0.32, 0, r );
			recycleBin( K, P, 0.32, 0 );
			place( o[ 0 ], o[ 1 ], 0.7 );

		}

		this.columns.forEach( ( [ s, d ], i ) => {

			if ( i % 2 || d < 38 ) return;
			// on the rail side of the column
			const w = W.at( s, d - 0.72 );
			const P = Kit.frame( [ w.x, w.z ], [ w.ux, w.uz ], [ w.nx, w.nz ] );
			trashCan( K, P, 0, 0, r );
			this.obstacles.push( [ s, d - 0.72, 0.35 ] );

		} );

		for ( const U of units ) {

			const food = typeof U.what === 'string' && [ 'cobblestone', 'hatfield', 'market', 'schmitter' ].includes( U.what );
			if ( ! food ) continue;
			// beside the line, out at the stand's edge, facing the walkway
			const side = ( U.sec % 2 ) ? 1 : - 1;
			const o = [ U.mid[ 0 ] + U.a[ 0 ] * side * 3.15 + U.n[ 0 ] * 1.5, U.mid[ 1 ] + U.a[ 1 ] * side * 3.15 + U.n[ 1 ] * 1.5 ];
			condiments( K, Kit.frame( o, U.a, U.n ), 0, 0, r );
			place( o[ 0 ], o[ 1 ], 0.75 );

		}

	}

	// The carts, where the 2008 concessions guide put the portables on this stretch: Nachos behind 122
	// and 134, Philadelphia Water Ice behind 132 (by the Third Base Gate), Cotton Candy / Lemonade /
	// Popcorn behind 128; and on a 47-degree night a hot chocolate and coffee cart behind 130 (that one's
	// a guess). Each stands on the line of the columns, between two of them, facing the rail side where
	// the people walk; a program seller's table just in from the gate, and another behind home plate.
	_carts() {

		const K = this.kit, W = this.W, r = rng( 91 );
		const cols = this.columns.map( ( c ) => c[ 0 ] ).sort( ( a, b ) => a - b );
		// the middle of the gap between the columns nearest s
		const between = ( s ) => {

			for ( let i = 0; i < cols.length - 1; i ++ ) if ( cols[ i ] <= s && s <= cols[ i + 1 ] ) return ( cols[ i ] + cols[ i + 1 ] ) / 2;
			return s;

		};

		this.carts = [];
		const put = ( kind, s0, d = 40.9, table = false ) => {

			const s = table ? s0 : between( s0 );
			const w = W.at( s, d );
			// facing the rail side (toward the field): its front ( +z ) is -d
			const n = [ w.nx, w.nz ], a = [ w.ux, w.uz ];
			const P = Kit.frame( [ w.x, w.z ], a, n );
			// the carts by the gate's atrium under the sage-green barrel canopies of the photos
			if ( table ) programTable( K, P, r ); else cart( K, P, kind, r, s > 70 );
			this.obstacles.push( [ s, d, table ? 0.75 : 1.0 ] );
			this.carts.push( { kind, s, d, x: w.x, z: w.z, n, u: a } );

		};

		put( 'nachos', 9 );
		put( 'cottonCandy', 43 );
		put( 'cocoa', 52 );
		put( 'waterIce', 77 );
		put( 'nachos', 92 );
		put( 'programs', 69.5, 44.0, true );
		put( 'programs', 2.5, 43.2, true );

	}

	// The TVs: one over each stand (so the line can follow the game) and over each restroom's doors, a
	// 42-inch flat in a black bezel sitting on the unit's roof, tipped down toward the walkway; all
	// showing the broadcast (Concourse3BTV.js), as do the TVs hung along the concourse (Concourse.js),
	// which this feeds
	_tvs() {

		const K = this.kit, W = this.W;
		this.tv = new LiveTV();
		this.concourse?.group.traverse( ( o ) => {

			if ( o.isMesh && o.material?.name === 'concourse-tv' ) this.tv.feed( o.material.bindings?.bpTV?.texture );

		} );
		const pos = [], nrm = [], uv = [];
		const units = ( this.concourse?.units || [] ).filter( ( U ) => {

			const [ s ] = W.toSD( U.mid[ 0 ], U.mid[ 1 ] );
			return s > - 2 && s < S_END + 2;

		} );
		const w = 0.93, h = 0.53, tilt = 0.2;
		for ( const U of units ) {

			const P = Kit.frame( U.mid, U.a, U.n );
			// a bracket up from the roof, the bezel, the screen tipped down to the walkway
			const y0 = 4.42, z0 = 0.1;
			K.use( 'lid' ).box( P, 0, 4.3, - 0.1, 0.1, 0.2, 0.1 );
			const c = ( x, y ) => P( x, y0 + y * Math.cos( tilt ), z0 + y * Math.sin( tilt ) );
			const back = ( x, y ) => P( x, y0 + y * Math.cos( tilt ) + 0.06 * Math.sin( tilt ), z0 + y * Math.sin( tilt ) - 0.06 * Math.cos( tilt ) );
			K.use( 'lid' );
			const bw = w / 2 + 0.03, bh = h + 0.03;
			K.quad( back( - bw, - 0.03 ), back( bw, - 0.03 ), back( bw, bh ), back( - bw, bh ), P.dir( 0, - Math.sin( tilt ), - Math.cos( tilt ) ) );
			for ( const [ a, b ] of [ [ [ - bw, - 0.03 ], [ bw, - 0.03 ] ], [ [ bw, - 0.03 ], [ bw, bh ] ], [ [ bw, bh ], [ - bw, bh ] ], [ [ - bw, bh ], [ - bw, - 0.03 ] ] ] ) {

				const nx = a[ 1 ] === b[ 1 ] ? 0 : Math.sign( a[ 0 ] ), ny = a[ 0 ] === b[ 0 ] ? 0 : Math.sign( a[ 1 ] - h / 2 );
				K.quad( c( ...a ), c( ...b ), back( ...b ), back( ...a ), P.dir( nx, ny, 0 ) );

			}

			K.quad( c( - bw, - 0.03 ), c( bw, - 0.03 ), c( w / 2, 0 ), c( - w / 2, 0 ), P.dir( 0, Math.sin( tilt ), Math.cos( tilt ) ) );
			K.quad( c( - w / 2, h ), c( w / 2, h ), c( bw, bh ), c( - bw, bh ), P.dir( 0, Math.sin( tilt ), Math.cos( tilt ) ) );
			K.quad( c( - bw, - 0.03 ), c( - w / 2, 0 ), c( - w / 2, h ), c( - bw, bh ), P.dir( 0, Math.sin( tilt ), Math.cos( tilt ) ) );
			K.quad( c( w / 2, 0 ), c( bw, - 0.03 ), c( bw, bh ), c( w / 2, h ), P.dir( 0, Math.sin( tilt ), Math.cos( tilt ) ) );
			// the screen, a hair in front of the bezel's face
			const f = ( x, y ) => P( x, y0 + y * Math.cos( tilt ) - 0.004 * Math.sin( tilt ) * - 1, z0 + y * Math.sin( tilt ) + 0.004 );
			const n = P.dir( 0, Math.sin( tilt ), Math.cos( tilt ) );
			for ( const [ a, b, cc ] of [ [ [ - 1, 0 ], [ 1, 0 ], [ 1, 1 ] ], [ [ - 1, 0 ], [ 1, 1 ], [ - 1, 1 ] ] ] ) {

				// wound to face the walkway (the canvas's x runs to the right facing it: along a)
				for ( const [ x, y ] of [ a, b, cc ] ) {

					pos.push( ...f( x * w / 2, y * h ) );
					nrm.push( ...n );
					uv.push( ( x + 1 ) / 2, 1 - y );

				}

			}

		}

		const g = new BufferGeometry();
		g.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
		g.setAttribute( 'normal', new Float32BufferAttribute( nrm, 3 ) );
		g.setAttribute( 'uv', new Float32BufferAttribute( uv, 2 ) );
		g.computeBoundingBox();
		g.computeBoundingSphere();
		const mat = standard( { name: 'concourse3b-tv', roughness: 0.15, side: 'double', textures: { c3bTV: this.tv.texture },
			surface: 'let t = textureSample( c3bTV, smpAnisoClamp, in.uv ).rgb; s.albedo = t * 0.06; s.emissive = t * 1.1;' } );
		mat.underwaterLighting = 'none';
		mat.setDefine( 'DRY', 1 );
		const mesh = new Mesh( g, mat );
		mesh.name = 'concourse3b-tv';
		this.group.add( mesh );

	}

	// What hangs over the concourse, from the 2008 photos: the players' banners in the trusses (Rollins and
	// Feliz over the Third Base Gate's atrium as on Game 5 night, Kendrick beside them, Dobbs by 129-130,
	// Burrell behind home), a Coca-Cola banner on a column here and there, the atrium's directional sign
	// facing the way in from the gate, ELEVATORS DOWN ONLY by the elevator, the HOME STAND sign over the
	// team store, the bedsheet a fan from Buena Vista hung over Brewerytown for Charlie Manuel; and the
	// white dome pendants down the middle of the walkway
	_hung() {

		const K = this.kit, W = this.W;
		const top = 11.5; // the club level's floor overhead
		const frame = ( s, d, faceAlong = true ) => {

			const w = W.at( s, d );
			// facing along the concourse (read walking along it), or out to the walkway (toward the field)
			return faceAlong ? Kit.frame( [ w.x, w.z ], [ - w.nx, - w.nz ], [ w.ux, w.uz ] ) : Kit.frame( [ w.x, w.z ], [ w.ux, w.uz ], [ w.nx, w.nz ] );

		};

		for ( const [ cell, s, d, y ] of [ [ 'rollins', 70.5, 47.2, 8.4 ], [ 'feliz', 76.5, 51.5, 7.6 ], [ 'kendrick', 81.5, 46.8, 8.6 ], [ 'dobbs', 47.6, 46.4, 8.5 ], [ 'burrell', 13, 46.4, 8.5 ] ] ) {

			const P = frame( s, d );
			K.sheet( P, 0, y, 0, 3.4, 4.25, cell );
			// the hanging bar along its top, the cables up to the deck
			K.use( 'navy' ).box( P, 0, y + 2.17, 0, 3.5, 0.08, 0.06 );
			for ( const x of [ - 1.5, 1.5 ] ) K.use( 'grey' ).box( P, x, ( y + 2.2 + top ) / 2, 0, 0.012, top - y - 2.2, 0.012 );

		}

		// the Coca-Cola banners on the walkway faces of three of the columns
		[ [ 'pole51', 29.74 ], [ 'pole26', 56.41 ], [ 'pole35', 80.89 ] ].forEach( ( [ cell, s ] ) => {

			const col = this.columns.find( ( c ) => Math.abs( c[ 0 ] - s ) < 0.6 );
			if ( ! col ) return;
			const P = frame( col[ 0 ], col[ 1 ] - 0.37, false );
			// facing the rail side (the frame's +z is toward the field)
			K.sheet( P, 0, 4.7, 0, 0.8, 2.1, cell );
			for ( const y of [ 3.62, 5.78 ] ) K.use( 'grey' ).box( P, 0, y, 0.0, 0.84, 0.03, 0.03 );

		} );
		// the directional sign at the atrium's mouth, facing the way in from the gate
		{

			const w = W.at( 71.2, 45.8 );
			const P = Kit.frame( [ w.x, w.z ], [ - w.ux, - w.uz ], [ - w.nx, - w.nz ] );
			K.sheet( P, 0, 4.2, 0, 1.3, 1.95, 'wayfind' );
			for ( const x of [ - 0.5, 0.5 ] ) K.use( 'grey' ).box( P, x, ( 5.2 + top ) / 2, 0, 0.015, top - 5.2, 0.015 );

		}

		// ELEVATORS DOWN ONLY, over the walkway in front of the elevator
		{

			const P = frame( 86.2, 42.0, false );
			K.sheet( P, 0, 3.55, 0, 1.2, 0.52, 'elevators' );
			for ( const x of [ - 0.45, 0.45 ] ) K.use( 'grey' ).box( P, x, ( 3.8 + top ) / 2, 0, 0.012, top - 3.8, 0.012 );

		}

		// HOME STAND over the team store, and the bedsheet over Brewerytown
		for ( const U of this.concourse?.units || [] ) {

			const [ s ] = W.toSD( U.mid[ 0 ], U.mid[ 1 ] );
			if ( s < 0 || s > S_END ) continue;
			const P = Kit.frame( U.mid, U.a, U.n );
			if ( Array.isArray( U.what ) && U.what[ 0 ] === 'merch' ) {

				K.sheet( P, 0, 4.72, 0.05, 2.6, 0.9, 'homeStand' );
				K.use( 'lid' ).box( P, 0, 4.3, 0.0, 0.08, 0.2, 0.08 );

			}

			if ( U.what === 'brewerytown' && ! this._goodLuck ) {

				this._goodLuck = true;
				// a pipe across over the stand, the sheet tied to it with twine, sagging
				K.use( 'grey' ).box( P, 0, 5.75, 0.25, 3.8, 0.05, 0.05 );
				for ( const x of [ - 1.85, 1.85 ] ) K.use( 'grey' ).box( P, x, 4.97, 0.25, 0.05, 1.55, 0.05 );
				K.sheet( P, 0, 5.05, 0.28, 3.1, 1.26, 'goodLuck', 0.08 );

			}

		}

		// the pendants: down the middle of the walkway between the columns, and along the stands' side
		this.lamps = [];
		const cols = this.columns.map( ( c ) => c[ 0 ] ).sort( ( a, b ) => a - b );
		for ( let i = 0; i < cols.length - 1; i ++ ) {

			const s = ( cols[ i ] + cols[ i + 1 ] ) / 2;
			if ( s < 1 || s > S_END - 1 ) continue;
			for ( const d of [ 36.4, 43.0 ] ) {

				const w = W.at( s, d );
				pendant( K, Kit.frame( [ w.x, w.z ], [ w.ux, w.uz ], [ w.nx, w.nz ] ), 0, 0, 7.2, top );
				this.lamps.push( [ s, d ] );

			}

		}

	}

	// what steams: the grills' flat-tops behind the counters (Cobblestone, Hatfield), the steam rolling out
	// under the menu boards; the hot chocolate cart's urns
	_steamers() {

		const W = this.W;
		for ( const U of this.concourse?.units || [] ) {

			const [ s ] = W.toSD( U.mid[ 0 ], U.mid[ 1 ] );
			if ( s < 0 || s > S_END || ! [ 'cobblestone', 'hatfield', 'schmitter' ].includes( U.what ) ) continue;
			for ( const x of [ - 1.8, 0, 1.8 ] ) {

				const p = [ U.mid[ 0 ] + U.a[ 0 ] * x - U.n[ 0 ] * 0.95, STREET + 1.15, U.mid[ 1 ] + U.a[ 1 ] * x - U.n[ 1 ] * 0.95 ];
				this.steam.emit( { x: p[ 0 ], y: p[ 1 ], z: p[ 2 ], rate: 2.2, kind: 0, spread: [ 1.2, 0.4 ], drift: [ U.n[ 0 ] * 0.2, U.n[ 1 ] * 0.2 ], rise: 0.3, life: 3.4 } );

			}

		}

		for ( const c of this.carts || [] ) {

			if ( c.kind !== 'cocoa' ) continue;
			for ( const x of [ - 0.45, 0.0 ] ) {

				const px = c.x + c.u[ 0 ] * x - c.n[ 0 ] * 0.05, pz = c.z + c.u[ 1 ] * x - c.n[ 1 ] * 0.05;
				this.steam.emit( { x: px, y: STREET + 1.6, z: pz, rate: 1.4, kind: 2, spread: [ 0.1, 0.1 ], rise: 0.3, life: 2.2 } );

			}

		}

	}

	// The rain stays out from under the decks: a map of the top of whatever's overhead (the heights of the
	// decks, the stands, the roofs, the outer ring's floors) over the whole park, rasterized once from the
	// bowl's and the facade's meshes (not the thin things: rails, lamps, the light towers, the netting),
	// for the rain's shader (Rain.setCover). The drops under a roof, the concourse's among them, aren't
	// drawn.
	_rainCover() {

		const F = this.field;
		F.group.updateMatrixWorld( true );
		const inv = new Matrix4().copy( F.group.matrixWorld ).invert();
		const m = new Matrix4();
		const cell = 0.75, nx = 400, nz = 400, x0 = - 150, z0 = - 180;
		const H = new Float32Array( nx * nz ).fill( - 1e4 );
		const skip = /^(rails|tower-|lamp-|pa-speakers|club-mullions|camera-|roof-edge-lights|columns|elevator-|netting|drink-rail|sign-posts|section-)/;
		const a = new Vector3(), b = new Vector3(), c = new Vector3();
		const tri = ( ax, ay, az, bx, by, bz, cx, cy, cz ) => {

			const minX = Math.max( 0, Math.floor( ( Math.min( ax, bx, cx ) - x0 ) / cell ) ), maxX = Math.min( nx - 1, Math.floor( ( Math.max( ax, bx, cx ) - x0 ) / cell ) );
			const minZ = Math.max( 0, Math.floor( ( Math.min( az, bz, cz ) - z0 ) / cell ) ), maxZ = Math.min( nz - 1, Math.floor( ( Math.max( az, bz, cz ) - z0 ) / cell ) );
			const den = ( bz - cz ) * ( ax - cx ) + ( cx - bx ) * ( az - cz );
			if ( Math.abs( den ) < 1e-6 ) return;
			for ( let iz = minZ; iz <= maxZ; iz ++ ) for ( let ix = minX; ix <= maxX; ix ++ ) {

				const px = x0 + ( ix + 0.5 ) * cell, pz = z0 + ( iz + 0.5 ) * cell;
				const l1 = ( ( bz - cz ) * ( px - cx ) + ( cx - bx ) * ( pz - cz ) ) / den;
				const l2 = ( ( cz - az ) * ( px - cx ) + ( ax - cx ) * ( pz - cz ) ) / den;
				const l3 = 1 - l1 - l2;
				if ( l1 < - 1e-4 || l2 < - 1e-4 || l3 < - 1e-4 ) continue;
				const y = l1 * ay + l2 * by + l3 * cy, i = ix + iz * nx;
				if ( y > H[ i ] ) H[ i ] = y;

			}

		};

		for ( const root of [ this.bowl.group, this.app?.exterior?.group, this.concourse?.group ] ) root?.traverse( ( o ) => {

			if ( ! o.isMesh || o.isInstancedMesh || o.material?.transparent || skip.test( o.material?.name || '' ) ) return;
			const g = o.geometry, P = g.getAttribute( 'position' );
			if ( ! P ) return;
			m.multiplyMatrices( inv, o.matrixWorld );
			const idx = g.index ? g.index.array : null, n = idx ? idx.length : P.count;
			for ( let k = 0; k < n; k += 3 ) {

				a.fromBufferAttribute( P, idx ? idx[ k ] : k ).applyMatrix4( m );
				b.fromBufferAttribute( P, idx ? idx[ k + 1 ] : k + 1 ).applyMatrix4( m );
				c.fromBufferAttribute( P, idx ? idx[ k + 2 ] : k + 2 ).applyMatrix4( m );
				tri( a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z );

			}

		} );
		return { heights: H, x0, z0, cell, nx, cos: Math.cos( F.group.rotation.y ), sin: Math.sin( F.group.rotation.y ), y0: F.group.position.y };

	}

	update( dt, director ) {

		// the rain's cover, once the rain exists (it's made after the places)
		const rain = this.app?.rain;
		if ( rain?.setCover && this._cover ) {

			rain.setCover( this._cover.heights, this._cover );
			this._cover = null;

		}

		const ns = nightState( director );
		this.night = ns;
		// on arriving (and after a jump in the replay) the concourse has been going a while: a minute of it
		// run through quickly, so the lines and the walkers are where they'd be
		const t = director ? director.t : 0;
		if ( ! this._warm || Math.abs( t - this._lastT ) > 30 ) {

			this.people.warming = true;
			for ( let i = 0; i < 240; i ++ ) this.people.update( 0.25, ns );
			this.people.warming = false;
			this.steam.warm( G.time.value );
			this._warm = true;
			for ( const p of this.cast.list ) p.fresh = true;

		}

		this._lastT = t;
		const camF = this.app?.camera ? this.field.toField( this.app.camera.position.x, this.app.camera.position.z ) : null;
		this.people.cam = camF;
		this.people.update( dt, ns );
		this.stories.update( dt, ns );
		// the steam and the breath (the cold: 47 and raining on the 27th, 44 and windy on the 29th)
		const cam = this.app?.camera;
		const cf = cam ? [ ...this.field.toField( cam.position.x, cam.position.z ) ] : null;
		this.steam.update( dt, G.time.value, { cast: this.cast, cam: cf ? [ cf[ 0 ], 0, cf[ 1 ] ] : null, cold: ns.first ? 0.6 : 1.0, wind: ns.first ? [ 0.12, - 0.06 ] : [ 0.2, 0.1 ] } );
		this.cast.update( cf ? [ cf[ 0 ], 0, cf[ 1 ] ] : null );
		this.tv.update( dt, director, ns );
		// the floor: wet on the 27th (wetter as it pours), dry prints on the 29th, the litter piling up
		const U = this.floor.material.uniforms;
		const game = ns.inning ? Math.min( 1, ( ( ns.inning - 1 ) * 2 + ( ns.half === 'top' ? 0 : 1 ) ) / 17 ) : 0.3;
		U.rainK.value = ns.first || ns.suspended ? 0.35 + 0.65 * ns.rain : 0.12;
		U.dryK.value = ns.first ? 0 : 1;
		U.litterK.value = 0.25 + 0.6 * game + ( ns.celebrate ? 0.3 : 0 ) + ( ns.suspended ? 0.2 : 0 );

	}

}
