import { Group, Vector3, Sphere } from '../../engine/index.js';
import { commonModule } from '../../engine/render/wgsl/common.js';
import { standard } from '../../materials/Materials.js';
import { offsetPolyline } from '../Bowl.js';
import { LEVELS } from '../layout.js';
import { Cast, PROP, TOP, COLOR, HAT, seat } from './Cast.js';
import { GESTURE, dress, sizeOf } from './Concourse3BKit.js';
import { nightState } from './Concourse3BPeople.js';
import { Tempo } from './Tempo.js';
import { Inside, insideMaterial, insideAtlas, frame, Reach, cellUV, rnd, glassSplit, clearGlass, clearGlassMesh, interiorsModule, Screens, wallCollider, yawOf, GLASS_UNIFORMS, backFrom, PAINTINGS, paintingUV } from './inside/Kit.js';

// FI2 (gauntlet CI-6): the Hall of Fame Club, the 200 level's enclosed concourse behind the club seats
// round the infield (sections 212-232), as it was in 2008. Behind the glass a long carpeted room under a
// low ceiling of acoustic tiles and light panels: the red-and-charcoal block carpet; a drink rail down
// the glass with its stools, high-tops in the middle, TVs hung from the ceiling with the game on; along
// the back wall the club's four bars where the 2008 guide puts them (Shibe Park Eatery behind 212, Baker
// Bowl Bistro behind 214, Recreation Park, the martini bar, behind 218, Connie Mack's behind 229), the
// Cooperstown Gallery between them (Dick Perez's oils of the Phillies', the Athletics' and Philadelphia's
// Hall of Famers in gilt frames under picture lights: invented canvases here, see Kit.js), the Wall of
// Balls behind home plate with its brass rail (becca_elizabeth, Apr 2008; greenheaps, Aug 2008), the
// architect's model of the ballpark in its glass case (bradley-fry, 2006), the elevators. A World Series
// crowd in it: at the bars, at the rail, standing about in twos and threes.
//
// Seen from the club seats and across the park the glass shows it traced (its own interior mapping, the
// bowl's figure() for the people); near the camera the glass is clear and the room is there. What it does
// to the bowl, at build time: hides `club-glass` (the bowl's traced room; its mullions stay) and the club
// level's elevator slab, moves the walker's club stop to the elevators on the back wall, and lays a floor
// you can walk on out to the back wall.
//
// Field frame; the club's floor is LEVELS.clubConcourse.

const DEPC = 9.5; // the glass to the back wall
const CEIL = 3.9; // the ceiling over the floor
const NEAR = 26, BAND = 6;
// the bars: [ section, atlas sign, length ]
const BARS = [ [ 212, 'shibe', 6.5 ], [ 214, 'bakerBowl', 7.5 ], [ 218, 'recPark', 7 ], [ 229, 'connieMack', 8 ] ];

const sub = ( a, b ) => [ a[ 0 ] - b[ 0 ], a[ 1 ] - b[ 1 ] ];
const dot = ( a, b ) => a[ 0 ] * b[ 0 ] + a[ 1 ] * b[ 1 ];
const lerp = ( a, b, t ) => [ a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * t, a[ 1 ] + ( b[ 1 ] - a[ 1 ] ) * t ];
const unit = ( v ) => {

	const l = Math.hypot( v[ 0 ], v[ 1 ] ) || 1;
	return [ v[ 0 ] / l, v[ 1 ] / l ];

};

export default class Club {

	constructor( { app, field, bowl, colliders } ) {

		this.app = app;
		this.field = field;
		this.bowl = bowl;
		this.colliders = colliders;
		this.group = new Group();
		this.group.name = 'club';
		if ( ! bowl?.D || ! bowl.path ) return;
		const D = bowl.D, infield = bowl.path.slice( 2, 10 );
		const y = this.y = LEVELS.clubConcourse;
		const t300Y = LEVELS.terraceConcourse - 7 * 0.52 - 0.3;
		const dG = this.dG = D.clubBack + 0.4;
		// the glass's top (Bowl._buildUpperDecks: it meets the 300s' underside)
		this.yGlass = t300Y + ( ( dG - D.t300 ) / 0.84 ) * 0.52 - 1.3;
		const line = ( d ) => offsetPolyline( infield, d, [ 0, - 40 ] );
		this.G = line( dG + 0.05 ); this.BK = line( dG + DEPC ); this.dStrip = D.clubBack + 8;
		this.segs = [];
		let s0 = 0;
		for ( let i = 0; i < this.G.length - 1; i ++ ) {

			const a = this.G[ i ], c = this.G[ i + 1 ];
			const len = Math.hypot( c[ 0 ] - a[ 0 ], c[ 1 ] - a[ 1 ] ), u = unit( sub( c, a ) );
			let nIn = [ - u[ 1 ], u[ 0 ] ];
			if ( dot( nIn, sub( lerp( a, c, 0.5 ), [ 0, - 40 ] ) ) < 0 ) nIn = [ - nIn[ 0 ], - nIn[ 1 ] ];
			this.segs.push( { i, a, c, len, u, nIn, s0 } );
			s0 += len;

		}

		this.Lg = s0;
		this.material = insideMaterial( 'club-inside' );
		this.screens = new Screens( app );
		this.r = rnd( 2008 );
		this._plan();
		this.reach = new Reach( NEAR + BAND + 2 );
		this.spots = [];
		for ( const sg of this.segs ) {

			const b = new Inside();
			this._room( b, sg );
			const m = b.mesh( this.material, `club-${ sg.i }` );
			this.group.add( m );
			const c = lerp( lerp( sg.a, sg.c, 0.5 ), lerp( this.BK[ sg.i ], this.BK[ sg.i + 1 ], 0.5 ), 0.5 );
			this.reach.add( m, [ c[ 0 ], y + 2, c[ 1 ] ], sg.len / 2 + 6 );
			sg.chunk = this.reach.items[ this.reach.items.length - 1 ];

		}

		this.tvs = this.screens.mesh( 'club-tvs' );
		if ( this.tvs ) this.group.add( this.tvs );
		this._shell();
		this._glass();
		this._case();
		this._floorAndWalls();
		bowl.group.traverse( ( o ) => {

			if ( o.isMesh && o.name === 'club-glass' && this.farGlass ) o.visible = false;
			if ( o.isMesh && o.material?.name === 'elevator-door' && o.parent && Math.abs( o.parent.position.y - y ) < 0.05 ) o.visible = false;

		} );
		this._people();

	}

	// where along the glass (s, metres from the first base end) and how far in (z): the segment, a frame
	at( s ) {

		const sg = this.segs.find( ( q ) => s <= q.s0 + q.len ) || this.segs[ this.segs.length - 1 ];
		const p = [ sg.a[ 0 ] + sg.u[ 0 ] * ( s - sg.s0 ), sg.a[ 1 ] + sg.u[ 1 ] * ( s - sg.s0 ) ];
		return { sg, p, P: frame( [ p[ 0 ], this.y, p[ 1 ] ], sg.u, sg.nIn ) };

	}

	// ---------------------------------------------------------------- the plan along the back wall

	_plan() {

		const w = this.Lg / 21; // a section's share of the glass (212 .. 232)
		const secAt = ( sec ) => ( sec - 211.5 ) * w;
		this.taken = []; // [ s0, s1 ] along the back wall
		const clamp = ( s, half ) => {

			// kept inside its segment (a bar doesn't turn a corner)
			const sg = this.at( s ).sg;
			return Math.max( sg.s0 + half + 0.6, Math.min( sg.s0 + sg.len - half - 0.6, s ) );

		};

		this.bars = BARS.map( ( [ sec, sign, len ] ) => {

			const s = clamp( secAt( sec ), len / 2 );
			this.taken.push( [ s - len / 2 - 0.8, s + len / 2 + 0.8 ] );
			return { s, sign, len, sec };

		} );
		this.balls = { s: clamp( this.Lg / 2, 6.5 ), len: 13 };
		this.taken.push( [ this.balls.s - 7, this.balls.s + 7 ] );
		this.model = { s: clamp( this.Lg / 2 + 10.5, 1.5 ) };
		// the elevators: the bowl's banks, their club stop moved to the back wall
		this.lifts = [];
		for ( const bank of this.bowl.elevators || [] ) {

			const stop = bank.stops.find( ( q ) => q.name === 'Club level' );
			if ( ! stop ) continue;
			let best = null, bd = Infinity;
			for ( const sg of this.segs ) {

				const t = Math.max( 2, Math.min( sg.len - 2, dot( sub( [ stop.x, stop.z ], sg.a ), sg.u ) ) );
				const p = [ sg.a[ 0 ] + sg.u[ 0 ] * t, sg.a[ 1 ] + sg.u[ 1 ] * t ];
				const d = Math.hypot( p[ 0 ] - stop.x, p[ 1 ] - stop.z );
				if ( d < bd ) {

					bd = d; best = sg.s0 + t;

				}

			}

			let s = best;
			// not in front of a bar or the Wall of Balls
			for ( const [ a, b ] of this.taken ) if ( s > a - 1.8 && s < b + 1.8 ) s = s - a < b - s ? a - 1.9 : b + 1.9;
			const { sg, P } = this.at( s );
			const q = P( 0, 0, DEPC - 1.5 );
			stop.x = q[ 0 ]; stop.z = q[ 2 ];
			stop.face = [ - sg.nIn[ 0 ], - sg.nIn[ 1 ] ];
			this.lifts.push( { s } );
			this.taken.push( [ s - 1.9, s + 1.9 ] );

		}

		// the paintings in what's left of the back wall, every 2.8 m (---- FI3 (C2I-12): 24 canvases dealt
		// along it so no two neighbours or near neighbours match (it was eight in strict order); every sixth
		// place a lit wood-and-glass case instead (pompomflipflop 2009: bats, balls, a jersey)
		this.paintings = [];
		this.cases = [];
		let k = 0;
		const deal = rnd( 1950 ), recent = [];
		for ( let s = 2.5; s < this.Lg - 2.5; s += 2.8 ) {

			if ( this.taken.some( ( [ a, b ] ) => s > a - 0.7 && s < b + 0.7 ) ) continue;
			const sg = this.at( s ).sg;
			if ( s - sg.s0 < 1.2 || sg.s0 + sg.len - s < 1.2 ) continue;
			if ( k ++ % 6 === 3 ) {

				this.cases.push( { s } );
				continue;

			}

			let cell = Math.floor( deal() * PAINTINGS );
			while ( recent.includes( cell ) ) cell = ( cell + 7 ) % PAINTINGS;
			recent.push( cell );
			if ( recent.length > 6 ) recent.shift();
			this.paintings.push( { s, cell } );

		}
		// ---- end FI3

	}

	// ---------------------------------------------------------------- one side's room

	_room( b, sg ) {

		const y = this.y, BK = this.BK, i = sg.i;
		const nIn3 = [ sg.nIn[ 0 ], 0, sg.nIn[ 1 ] ], nOut3 = [ - sg.nIn[ 0 ], 0, - sg.nIn[ 1 ] ];
		// the light panels in the ceiling: three rows, every 3 m
		const lamps = [], panels = [];
		const m = Math.max( 1, Math.round( sg.len / 3 ) );
		for ( let k = 0; k < m; k ++ ) for ( const z of [ 2.2, 4.9, 7.6 ] ) {

			const s = sg.s0 + ( k + 0.5 ) * sg.len / m;
			const q = this.at( s ).P( 0, CEIL - 0.03, z );
			lamps.push( [ ...q, 0.9, undefined, 2.2 ] );
			panels.push( { s, z } );

		}

		// the picture lights and the bars' pendants light the back wall
		for ( const p of this.paintings.filter( ( q ) => this.at( q.s ).sg === sg ) ) lamps.push( [ ...this.at( p.s ).P( 0, 2.85, DEPC - 0.35 ), 0.5, 'omni', 0.5 ] );
		for ( const br of this.bars.filter( ( q ) => this.at( q.s ).sg === sg ) ) for ( let t = - br.len / 2 + 0.8; t < br.len / 2; t += 1.6 ) lamps.push( [ ...this.at( br.s + t ).P( 0, 2.4, DEPC - 1.6 ), 0.7, 'omni', 0.8 ] );
		b.room( { lamps, amb: 0.16 } );
		const at = ( p, h ) => [ p[ 0 ], y + h, p[ 1 ] ];
		const uvS = ( p ) => [ sg.s0 + dot( sub( [ p[ 0 ], p[ 2 ] ], sg.a ), sg.u ), dot( sub( [ p[ 0 ], p[ 2 ] ], sg.a ), sg.nIn ) ];
		b.use( 'blocks' ).panel4( at( sg.a, 0.004 ), at( sg.c, 0.004 ), at( BK[ i + 1 ], 0.004 ), at( BK[ i ], 0.004 ), [ 0, 1, 0 ], 0.8, uvS );
		b.use( 'tile' ).panel4( at( sg.a, CEIL ), at( sg.c, CEIL ), at( BK[ i + 1 ], CEIL ), at( BK[ i ], CEIL ), [ 0, - 1, 0 ], 0.9, uvS );
		for ( const p of panels ) b.use( 'cove' ).box( this.at( p.s ).P, 0, CEIL - 0.012, p.z, 1.2, 0.01, 0.6, [ 'top' ] );
		// the back wall: cream over a cherry wainscot, its chair rail
		const bl = Math.hypot( BK[ i + 1 ][ 0 ] - BK[ i ][ 0 ], BK[ i + 1 ][ 1 ] - BK[ i ][ 1 ] );
		const uvW = ( p ) => [ dot( sub( [ p[ 0 ], p[ 2 ] ], BK[ i ] ), sg.u ), p[ 1 ] - y ];
		b.use( 'cream' ).panel4( at( BK[ i ], 1.0 ), at( BK[ i + 1 ], 1.0 ), at( BK[ i + 1 ], CEIL ), at( BK[ i ], CEIL ), nOut3, 0.9, uvW );
		b.use( 'cherry' ).panel4( at( BK[ i ], 0 ), at( BK[ i + 1 ], 0 ), at( BK[ i + 1 ], 1.0 ), at( BK[ i ], 1.0 ), nOut3, 0.9, uvW );
		const Wb = frame( at( lerp( BK[ i ], BK[ i + 1 ], 0.5 ), 0 ), sg.u, sg.nIn.map( ( v ) => - v ) );
		b.use( 'cherry' ).box( Wb, 0, 1.0, 0.025, bl, 0.06, 0.05, [ 'back' ] );
		// the ends of the run: a wall across
		for ( const [ end, p, q ] of [ [ i === 0, sg.a, BK[ 0 ] ], [ i === this.segs.length - 1, sg.c, BK[ BK.length - 1 ] ] ] ) {

			if ( ! end ) continue;
			const d = unit( sub( q, p ) );
			let n = [ - d[ 1 ], 0, d[ 0 ] ];
			if ( dot( [ n[ 0 ], n[ 2 ] ], sub( lerp( sg.a, sg.c, 0.5 ), p ) ) < 0 ) n = n.map( ( v ) => - v );
			b.use( 'cream' ).panel4( at( p, 0 ), at( q, 0 ), at( q, CEIL ), at( p, CEIL ), n, 0.9 );

		}

		// what's along the back wall here
		for ( const p of this.paintings ) if ( this.at( p.s ).sg === sg ) this._painting( b, p );
		for ( const c of this.cases ) if ( this.at( c.s ).sg === sg ) this._displayCase( b, c ); // ---- FI3 (C2I-12)
		for ( const br of this.bars ) if ( this.at( br.s ).sg === sg ) this._bar( b, br );
		for ( const l of this.lifts ) if ( this.at( l.s ).sg === sg ) this._lift( b, l );
		if ( this.at( this.balls.s ).sg === sg ) this._wallOfBalls( b );
		if ( this.at( this.model.s ).sg === sg ) this._modelBase( b );
		// the drink rail down the glass, stools at it; high-tops in the middle; TVs from the ceiling
		const R = this.at( sg.s0 + sg.len / 2 ).P;
		b.use( 'cherry' ).box( R, 0, 0.52, 0.42, sg.len - 1.2, 1.0, 0.06 );
		b.use( 'granite' ).box( R, 0, 1.05, 0.42, sg.len - 1.0, 0.04, 0.34 );
		for ( let s = sg.s0 + 1.2; s < sg.s0 + sg.len - 1.0; s += 1.15 ) {

			if ( this.r() < 0.25 ) continue;
			this._stool( b, frame( this.at( s ).P( 0, 0, 1.0 ), sg.u, sg.nIn.map( ( v ) => - v ) ) );
			this.spots.push( { sg, s, z: 1.0, face: sg.nIn.map( ( v ) => - v ), sit: 0.79, kind: 'rail' } );

		}

		for ( let s = sg.s0 + 4; s < sg.s0 + sg.len - 3; s += 8 ) {

			const z = 4.1 + ( Math.round( s ) % 2 ) * 1.1;
			if ( Math.abs( s - this.model.s ) < 3 ) continue;
			const T = this.at( s ).P;
			( this.tables ||= [] ).push( [ T( 0, 0, z )[ 0 ], T( 0, 0, z )[ 2 ] ] );
			b.use( 'granite' ).cyl( T, 0, z, 1.02, 1.06, 0.45, 0.45, 14, true );
			b.use( 'black' ).cyl( T, 0, z, 0.05, 1.02, 0.045, 0.045, 8, false );
			b.use( 'black' ).cyl( T, 0, z, 0.0, 0.05, 0.28, 0.26, 12, true );
			for ( let j = 0; j < 3; j ++ ) {

				const a = j * Math.PI * 2 / 3 + s;
				const sx = Math.cos( a ) * 0.75, sz = z + Math.sin( a ) * 0.75;
				const f = unit( [ - Math.cos( a ), - Math.sin( a ) ] );
				const fw = [ sg.u[ 0 ] * f[ 0 ] + sg.nIn[ 0 ] * f[ 1 ], sg.u[ 1 ] * f[ 0 ] + sg.nIn[ 1 ] * f[ 1 ] ];
				const o = T( sx, 0, sz );
				this._stool( b, frame( o, [ fw[ 1 ], - fw[ 0 ] ], fw ) );
				this.spots.push( { sg, p: [ o[ 0 ], o[ 2 ] ], face: fw, sit: 0.79, kind: 'table' } );

			}

		}

		for ( let s = sg.s0 + 6; s < sg.s0 + sg.len - 4; s += 13 ) {

			const T = this.at( s ).P, z = 3.0;
			b.use( 'black' ).box( T, 0, CEIL - 0.4, z, 0.05, 0.8, 0.05 );
			b.use( 'black' ).box( T, 0, 2.75, z, 1.22, 0.72, 0.09 );
			for ( const sd of [ - 1, 1 ] ) {

				const n = sd > 0 ? nIn3 : nOut3, zz = z + sd * 0.047;
				const L = ( x, h ) => T( x * - sd, h, zz );
				this.screens.add( b, L( - 0.57, 2.43 ), L( 0.57, 2.43 ), L( 0.57, 3.07 ), L( - 0.57, 3.07 ), n );

			}

		}

	}

	// a painting in its gilt frame, the brass plate under it, the picture light over it
	_painting( b, p ) {

		const { P, sg } = this.at( p.s ), z = DEPC - 0.02, n = [ - sg.nIn[ 0 ], 0, - sg.nIn[ 1 ] ];
		b.use( 'gilt' ).box( P, 0, 2.0, z - 0.03, 1.18, 1.18, 0.06, [ 'front' ] );
		b.use( 'black' ).box( P, 0, 2.0, z - 0.061, 1.0, 1.0, 0.004 );
		// (read from the room: its left is the - u side)
		b.use( 'print' ).print( P( - 0.48, 1.52, z - 0.066 ), P( 0.48, 1.52, z - 0.066 ), P( 0.48, 2.48, z - 0.066 ), P( - 0.48, 2.48, z - 0.066 ), n, paintingUV( p.cell ) ); // ---- FI3
		b.use( 'brass' ).box( P, 0, 1.25, z - 0.01, 0.3, 0.08, 0.02 );
		b.use( 'brass' ).box( P, 0, 2.72, z - 0.12, 0.5, 0.04, 0.06 );
		b.use( 'lamp' ).box( P, 0, 2.695, z - 0.12, 0.44, 0.01, 0.04, [ 'top' ] );
		b.use( 'brass' ).box( P, 0, 2.66, z - 0.05, 0.02, 0.12, 0.1 );

	}

	// ---- FI3 (C2I-12): a display case against the back wall (pompomflipflop, Aug 2009: the club's lit
	// wood-and-glass cases): a cherry cabinet, its lit glass box over it (the glass in _case), and in it a
	// jersey on the back panel, two bats standing, balls on stands, a cap, a brass plate
	_displayCase( b, c ) {

		const { P, sg } = this.at( c.s ), z = DEPC - 0.35, n = [ - sg.nIn[ 0 ], 0, - sg.nIn[ 1 ] ];
		const r = rnd( Math.round( c.s * 10 ) );
		b.use( 'cherry' ).box( P, 0, 0.45, z, 1.3, 0.9, 0.6 );
		b.use( 'cherry' ).box( P, 0, 2.27, z, 1.34, 0.12, 0.64 );
		b.use( 'navyWall' ).quad( P( - 0.62, 0.9, z + 0.28 ), P( 0.62, 0.9, z + 0.28 ), P( 0.62, 2.21, z + 0.28 ), P( - 0.62, 2.21, z + 0.28 ), n );
		b.use( 'lamp' ).box( P, 0, 2.2, z, 1.2, 0.01, 0.04, [ 'top' ] );
		// the jersey on the back panel: a flannel body and sleeves, its script, the number
		const pal = r() < 0.5 ? 'pinstripe' : 'creamCloth';
		b.use( pal ).quad( P( - 0.22, 1.25, z + 0.26 ), P( 0.22, 1.25, z + 0.26 ), P( 0.22, 1.95, z + 0.26 ), P( - 0.22, 1.95, z + 0.26 ), n );
		b.use( pal ).quad( P( - 0.36, 1.6, z + 0.255 ), P( 0.36, 1.6, z + 0.255 ), P( 0.3, 1.95, z + 0.255 ), P( - 0.3, 1.95, z + 0.255 ), n );
		b.use( 'print' ).print( P( - 0.15, 1.62, z + 0.25 ), P( 0.15, 1.62, z + 0.25 ), P( 0.15, 1.77, z + 0.25 ), P( - 0.15, 1.77, z + 0.25 ), n, cellUV( 'prints', pal === 'pinstripe' ? 0 : 1, 8, 2 ) );
		// two bats standing at the sides, balls on little stands, a cap
		for ( const sx of [ - 0.5, 0.5 ] ) {

			b.use( 'honey' ).cyl( P, sx, z + 0.15, 0.9, 1.5, 0.032, 0.03, 7, false );
			b.cyl( P, sx, z + 0.15, 1.5, 1.95, 0.03, 0.012, 7, false );
			b.cyl( P, sx, z + 0.15, 1.95, 1.97, 0.02, 0.02, 7, true );

		}

		for ( const sx of [ - 0.28, 0, 0.28 ] ) {

			b.use( 'brass' ).cyl( P, sx, z - 0.12, 0.9, 0.97, 0.025, 0.02, 6, true );
			b.use( 'ball' ).cyl( P, sx, z - 0.12, 0.97, 1.04, 0.032, 0.032, 8, true );

		}

		b.use( 'navyCloth' ).cyl( P, 0.0, z + 0.05, 0.9, 0.96, 0.09, 0.07, 8, true );
		b.use( 'brass' ).box( P, 0, 0.62, z - 0.302, 0.3, 0.07, 0.01 );

	}

	// a bar: the back bar along the wall (its cabinets, the mirror, the lit shelves of bottles, the name
	// over it), the counter in front with its brass foot rail and the taps, stools at it, pendants over it
	_bar( b, br ) {

		const { P, sg } = this.at( br.s ), z = DEPC, L = br.len, n = [ - sg.nIn[ 0 ], 0, - sg.nIn[ 1 ] ];
		const r = rnd( br.sec );
		b.use( 'cherry' ).box( P, 0, 0.45, z - 0.3, L, 0.9, 0.6, [ 'front' ] );
		b.use( 'granite' ).box( P, 0, 0.92, z - 0.3, L + 0.04, 0.04, 0.62 );
		b.use( 'glass' ).quad( P( - L / 2, 1.0, z - 0.01 ), P( L / 2, 1.0, z - 0.01 ), P( L / 2, 2.45, z - 0.01 ), P( - L / 2, 2.45, z - 0.01 ), n );
		for ( const h of [ 1.3, 1.75, 2.2 ] ) {

			b.use( 'glass' ).box( P, 0, h, z - 0.13, L - 0.3, 0.02, 0.24 );
			b.use( 'lamp' ).box( P, 0, h - 0.012, z - 0.04, L - 0.4, 0.008, 0.02, [ 'top' ] );
			for ( let x = - L / 2 + 0.3; x < L / 2 - 0.25; x += 0.11 + r() * 0.05 ) {

				const kind = r();
				const ht = 0.22 + r() * 0.12;
				b.use( kind < 0.35 ? 'bottleGreen' : kind < 0.7 ? 'bottleAmber' : 'bottleClear' ).cyl( P, x, z - 0.12, h + 0.01, h + 0.01 + ht * 0.7, 0.035, 0.035, 6, false );
				b.cyl( P, x, z - 0.12, h + 0.01 + ht * 0.7, h + 0.01 + ht, 0.035, 0.012, 6, true );

			}

		}

		b.use( 'cherry' ).box( P, - L / 2 - 0.1, 1.7, z - 0.15, 0.2, 1.6, 0.3 );
		b.use( 'cherry' ).box( P, L / 2 + 0.1, 1.7, z - 0.15, 0.2, 1.6, 0.3 );
		b.use( 'cherry' ).box( P, 0, 2.55, z - 0.2, L + 0.4, 0.2, 0.4 );
		// the name, lit, over it all
		const sw = Math.min( L - 0.6, 3.6 ), sh = sw / 2;
		b.use( 'black' ).box( P, 0, 2.66 + sh / 2 + 0.05, z - 0.04, sw + 0.12, sh + 0.12, 0.06 );
		b.use( 'printLit' ).print( P( - sw / 2, 2.71, z - 0.072 ), P( sw / 2, 2.71, z - 0.072 ), P( sw / 2, 2.71 + sh, z - 0.072 ), P( - sw / 2, 2.71 + sh, z - 0.072 ), n, cellUV( br.sign ) );
		// the counter, 1.6 m out: its front panelled, the top, the foot rail, the taps
		const zc = z - 1.6;
		b.use( 'cherry' ).box( P, 0, 0.55, zc, L, 1.1, 0.5, [ 'back' ] );
		for ( let x = - L / 2 + 0.6; x < L / 2 - 0.3; x += 0.6 ) b.use( 'honey' ).box( P, x, 0.55, zc - 0.252, 0.5, 0.8, 0.01 );
		b.use( 'granite' ).box( P, 0, 1.12, zc + 0.02, L + 0.1, 0.05, 0.7 );
		b.use( 'brass' ).box( P, 0, 0.2, zc - 0.42, L, 0.05, 0.05 );
		for ( let x = - L / 2 + 0.4; x < L / 2; x += 1.2 ) b.use( 'brass' ).box( P, x, 0.12, zc - 0.33, 0.04, 0.16, 0.18 );
		for ( let x = - 0.9; x <= 0.9; x += 0.6 ) {

			b.use( 'chrome' ).box( P, x, 1.32, zc + 0.15, 0.08, 0.36, 0.08 );
			b.use( 'black' ).box( P, x, 1.58, zc + 0.12, 0.035, 0.16, 0.035 );

		}

		// the stools along the counter, and who'll stand and sit there
		for ( let x = - L / 2 + 0.6; x < L / 2 - 0.4; x += 0.85 ) {

			const o = P( x, 0, zc - 0.85 );
			this._stool( b, frame( o, sg.u.map( ( v ) => - v ), sg.nIn ) );
			this.spots.push( { sg, p: [ o[ 0 ], o[ 2 ] ], face: sg.nIn, sit: 0.79, kind: 'bar', s: br.s } );

		}

		// the bartenders' places
		br.staff = [ - L / 4, L / 4 ].map( ( x ) => {

			const o = P( x, 0, z - 0.95 );
			return { p: [ o[ 0 ], o[ 2 ] ], face: [ - sg.nIn[ 0 ], - sg.nIn[ 1 ] ] };

		} );
		// the pendants over the counter
		for ( let x = - L / 2 + 0.8; x < L / 2; x += 1.6 ) {

			b.use( 'black' ).box( P, x, ( 2.5 + CEIL ) / 2, zc, 0.01, CEIL - 2.5, 0.01 );
			b.use( 'redPaint' ).cyl( P, x, zc, 2.36, 2.52, 0.16, 0.05, 10, true );
			b.use( 'lamp' ).cyl( P, x, zc, 2.355, 2.365, 0.15, 0.15, 10, true );

		}

	}

	// the Wall of Balls: rows of baseballs behind glass in a long cherry frame, the brass rail before it
	_wallOfBalls( b ) {

		const { P } = this.at( this.balls.s ), z = DEPC, L = this.balls.len;
		const n = this.at( this.balls.s ).sg.nIn.map( ( v ) => - v );
		b.use( 'cherry' ).box( P, 0, 1.75, z - 0.08, L + 0.3, 2.9, 0.16, [ 'front' ] );
		b.use( 'balls' ).quad( P( L / 2, 0.45, z - 0.165 ), P( - L / 2, 0.45, z - 0.165 ), P( - L / 2, 3.05, z - 0.165 ), P( L / 2, 3.05, z - 0.165 ), [ n[ 0 ], 0, n[ 1 ] ], [ [ 0, 0 ], [ L, 0 ], [ L, 2.6 ], [ 0, 2.6 ] ] );
		b.use( 'brass' ).box( P, 0, 0.92, z - 0.42, L, 0.05, 0.06 );
		for ( let x = - L / 2 + 0.2; x < L / 2; x += 1.6 ) b.use( 'brass' ).box( P, x, 0.6, z - 0.3, 0.04, 0.04, 0.24 );
		b.use( 'printLit' ).print( P( - 1.4, 3.15, z - 0.17 ), P( 1.4, 3.15, z - 0.17 ), P( 1.4, 3.85, z - 0.17 ), P( - 1.4, 3.85, z - 0.17 ), [ n[ 0 ], 0, n[ 1 ] ], cellUV( 'hofSign' ) );

	}

	// the elevators on the back wall: two cars, flush stainless doors in their frames
	_lift( b, l ) {

		const { P } = this.at( l.s ), z = DEPC;
		for ( const sx of [ - 0.8, 0.8 ] ) {

			b.use( 'stainless' ).box( P, sx, 1.1, z - 0.03, 1.24, 2.2, 0.06, [ 'front' ] );
			b.use( 'stainless' ).box( P, sx, 1.06, z - 0.065, 1.04, 2.1, 0.012, [ 'front' ] );
			b.use( 'black' ).box( P, sx, 1.06, z - 0.072, 0.008, 2.1, 0.004 );
			b.use( 'exitSign' ).box( P, sx, 2.32, z - 0.035, 0.3, 0.07, 0.01 );

		}

		b.use( 'stainless' ).box( P, 0, 1.15, z - 0.012, 0.12, 0.22, 0.02 );
		b.use( 'lamp' ).box( P, 0, 1.2, z - 0.025, 0.03, 0.03, 0.01 );

	}

	// the model's case's wood base (its glass and the model: _case)
	_modelBase( b ) {

		const { P } = this.at( this.model.s ), z = DEPC - 3.2;
		b.use( 'cherry' ).box( P, 0, 0.42, z, 2.7, 0.84, 1.9 );
		b.use( 'brass' ).box( P, 0, 0.6, z - 0.952, 0.4, 0.1, 0.01 );
		// the model on its board: the ballpark in miniature (1:200): the field, the infield's dirt, the
		// bowl's three decks round it in grey and red, the roofs, the light towers, the trees outside
		const M = frame( P( 0, 0.86, z ), [ this.at( this.model.s ).sg.u[ 0 ], this.at( this.model.s ).sg.u[ 1 ] ], this.at( this.model.s ).sg.nIn.map( ( v ) => - v ) );
		b.use( 'green' ).box( M, 0, 0.01, 0, 2.5, 0.02, 1.7 );
		b.use( 'turf' ).cyl( M, 0, 0.35, 0.02, 0.03, 0.62, 0.62, 18, true );
		b.use( 'food' ).cyl( M, 0, - 0.05, 0.02, 0.032, 0.2, 0.2, 10, true );
		for ( let k = 0; k < 14; k ++ ) {

			const a = Math.PI * ( 0.15 + 0.7 * k / 13 ), R = 0.8;
			const x = Math.cos( a ) * R, zz = 0.35 - Math.sin( a ) * R * 0.9;
			const ang = [ Math.sin( a ), Math.cos( a ) ];
			const S = frame( M( x, 0, zz ), [ ang[ 1 ], ang[ 0 ] ].map( ( v, j ) => j ? - v : v ), ang );
			b.use( 'redPaint' ).box( S, 0, 0.05, 0, 0.2, 0.06, 0.16 );
			b.use( 'concrete' ).box( S, 0, 0.11, 0.08, 0.2, 0.06, 0.12 );
			b.use( 'concrete' ).box( S, 0, 0.16, 0.16, 0.2, 0.05, 0.08 );

		}

		for ( const [ x, zz ] of [ [ - 0.95, - 0.2 ], [ 0.95, - 0.2 ], [ - 0.75, 0.75 ], [ 0.75, 0.75 ] ] ) {

			b.use( 'steel' ).cyl( M, x, zz, 0.02, 0.32, 0.008, 0.008, 4, false );
			b.use( 'white' ).box( M, x, 0.33, zz, 0.08, 0.04, 0.02 );

		}

		for ( let k = 0; k < 16; k ++ ) b.use( 'green' ).cyl( M, - 1.15 + ( k % 8 ) * 0.33, k < 8 ? - 0.78 : 0.8, 0.02, 0.07, 0.04, 0.0, 6, false );

	}

	// the glass case over the model (clear glass, near the camera only), its chrome edges
	_case() {

		const { P } = this.at( this.model.s ), z = DEPC - 3.2, y0 = 0.86, y1 = 1.5, w = 1.32, d = 0.92;
		const g = new Inside();
		const C = ( x, h, zz ) => P( x, h, z + zz );
		g.quad( C( - w, y0, - d ), C( w, y0, - d ), C( w, y1, - d ), C( - w, y1, - d ), [ 0, 0, 1 ] );
		g.quad( C( w, y0, d ), C( - w, y0, d ), C( - w, y1, d ), C( w, y1, d ), [ 0, 0, 1 ] );
		g.quad( C( - w, y0, d ), C( - w, y0, - d ), C( - w, y1, - d ), C( - w, y1, d ), [ 1, 0, 0 ] );
		g.quad( C( w, y0, - d ), C( w, y0, d ), C( w, y1, d ), C( w, y1, - d ), [ 1, 0, 0 ] );
		g.quad( C( - w, y1, - d ), C( w, y1, - d ), C( w, y1, d ), C( - w, y1, d ), [ 0, 1, 0 ] );
		// ---- FI3 (C2I-12): the display cases' glass fronts and ends
		for ( const c of this.cases || [] ) {

			const { P: Q, sg } = this.at( c.s ), zc = DEPC - 0.35, n = [ - sg.nIn[ 0 ], 0, - sg.nIn[ 1 ] ], side = [ sg.u[ 0 ], 0, sg.u[ 1 ] ];
			g.quad( Q( - 0.65, 0.9, zc - 0.3 ), Q( 0.65, 0.9, zc - 0.3 ), Q( 0.65, 2.21, zc - 0.3 ), Q( - 0.65, 2.21, zc - 0.3 ), n );
			for ( const sx of [ - 0.65, 0.65 ] ) g.quad( Q( sx, 0.9, zc - 0.3 ), Q( sx, 0.9, zc + 0.3 ), Q( sx, 2.21, zc + 0.3 ), Q( sx, 2.21, zc - 0.3 ), side );

		}
		// ---- end FI3
		const m = clearGlassMesh( g, clearGlass( 'club-case-glass', NEAR, BAND, { tint: false } ), 'club-case-glass' );
		this.group.add( m );
		this.caseGlass = m;

	}

	// a honey-wood barstool (S: its frame, forward toward what it faces)
	_stool( b, S ) {

		b.use( 'honey' );
		for ( const [ lx, lz ] of [ [ - 0.18, - 0.18 ], [ 0.18, - 0.18 ], [ - 0.18, 0.18 ], [ 0.18, 0.18 ] ] ) b.box( S, lx, 0.36, lz, 0.04, 0.72, 0.04, [ 'top', 'bottom' ] );
		b.box( S, 0, 0.74, 0, 0.44, 0.05, 0.44 );
		b.box( S, 0, 0.28, 0.18, 0.34, 0.03, 0.03 );
		for ( const lx of [ - 0.19, 0.19 ] ) b.box( S, lx, 0.99, - 0.2, 0.035, 0.46, 0.035 );
		b.box( S, 0, 1.17, - 0.2, 0.4, 0.09, 0.025 );
		b.use( 'leather' ).box( S, 0, 0.79, 0.01, 0.4, 0.05, 0.4, [ 'bottom' ] );

	}

	// ---------------------------------------------------------------- always drawn

	// the bulkhead behind the glass's top, the room's ends from outside
	_shell() {

		const b = new Inside(), y = this.y;
		b.room( null );
		for ( const sg of this.segs ) {

			const P = this.at( sg.s0 + sg.len / 2 ).P, n = [ - sg.nIn[ 0 ], 0, - sg.nIn[ 1 ] ];
			b.use( 'blackPaint' ).quad( P( - sg.len / 2, CEIL, 0.3 ), P( sg.len / 2, CEIL, 0.3 ), P( sg.len / 2, this.yGlass - y + 0.1, 0.3 ), P( - sg.len / 2, this.yGlass - y + 0.1, 0.3 ), n );

		}

		const G = this.G, BK = this.BK;
		for ( const [ p, q ] of [ [ G[ 0 ], BK[ 0 ] ], [ G[ G.length - 1 ], BK[ BK.length - 1 ] ] ] ) {

			const d = unit( sub( q, p ) ), n = [ - d[ 1 ], 0, d[ 0 ] ];
			for ( const sd of [ 1, - 1 ] ) {

				const o = [ n[ 0 ] * sd * 0.08, n[ 2 ] * sd * 0.08 ];
				b.use( 'concrete' ).quad( [ p[ 0 ] + o[ 0 ], y - 0.3, p[ 1 ] + o[ 1 ] ], [ q[ 0 ] + o[ 0 ], y - 0.3, q[ 1 ] + o[ 1 ] ], [ q[ 0 ] + o[ 0 ], this.yGlass, q[ 1 ] + o[ 1 ] ], [ p[ 0 ] + o[ 0 ], this.yGlass, p[ 1 ] + o[ 1 ] ], n.map( ( v ) => v * sd ) );

			}

		}

		// the back wall from behind (the outer ring's floors look at it): plain
		for ( let i = 0; i < BK.length - 1; i ++ ) {

			const sg = this.segs[ i ], n = [ sg.nIn[ 0 ], 0, sg.nIn[ 1 ] ];
			b.use( 'concrete' ).quad( [ BK[ i ][ 0 ] + n[ 0 ] * 0.15, y - 0.3, BK[ i ][ 1 ] + n[ 2 ] * 0.15 ], [ BK[ i + 1 ][ 0 ] + n[ 0 ] * 0.15, y - 0.3, BK[ i + 1 ][ 1 ] + n[ 2 ] * 0.15 ], [ BK[ i + 1 ][ 0 ] + n[ 0 ] * 0.15, y + CEIL + 0.3, BK[ i + 1 ][ 1 ] + n[ 2 ] * 0.15 ], [ BK[ i ][ 0 ] + n[ 0 ] * 0.15, y + CEIL + 0.3, BK[ i ][ 1 ] + n[ 2 ] * 0.15 ], n );

		}

		this.group.add( b.mesh( insideMaterial( 'club-shell' ), 'club-shell' ) );

	}

	_glass() {

		const y = this.y, far = new Inside(), near = new Inside();
		for ( const sg of this.segs ) {

			const n = [ - sg.nIn[ 0 ], 0, - sg.nIn[ 1 ] ];
			const a = [ sg.a[ 0 ] - sg.nIn[ 0 ] * 0.05, y, sg.a[ 1 ] - sg.nIn[ 1 ] * 0.05 ], c = [ sg.c[ 0 ] - sg.nIn[ 0 ] * 0.05, y, sg.c[ 1 ] - sg.nIn[ 1 ] * 0.05 ];
			const top = this.yGlass;
			far.with( [ sg.s0, 0, 0, 0 ] );
			far.quad( a, c, [ c[ 0 ], top, c[ 2 ] ], [ a[ 0 ], top, a[ 2 ] ], n, [ [ sg.s0, 0 ], [ sg.s0 + sg.len, 0 ], [ sg.s0 + sg.len, top - y ], [ sg.s0, top - y ] ] );
			near.quad( a, c, [ c[ 0 ], top, c[ 2 ] ], [ a[ 0 ], top, a[ 2 ] ], n, [ [ sg.s0, 0 ], [ sg.s0 + sg.len, 0 ], [ sg.s0 + sg.len, top - y ], [ sg.s0, top - y ] ] ); // ---- FI3: uv as the far glass's

		}

		const interiors = interiorsModule( this.bowl, 'suite-glass' );
		if ( interiors ) {

			const fm = this.farMat = standard( { name: 'club-glass-far', roughness: 0.06, metalness: 0.5, vertexColors: true, modules: [ commonModule, interiors ], uniforms: GLASS_UNIFORMS(),
				textures: { inAtlas: insideAtlas() }, surface: glassSplit( NEAR, BAND ) + this._farWGSL() } );
			fm.underwaterLighting = 'none';
			fm.setDefine( 'DRY', 1 );
			this.farGlass = far.mesh( fm, 'club-glass-far' );
			this.group.add( this.farGlass );

		}

		// ---- FI3 (C2I-9): the room behind you in the glass after dark: the ceiling's light panels, the back
		// wall in the picture lights, the bars' glow, the dark carpet
		const reflect = /* wgsl */`
		let H = ${ CEIL.toFixed( 2 ) };
		let ty = ( select( 0.0, H, rd.y > 0.0 ) - ro.y ) / rd.y;
		let tz = ${ ( DEPC - 0.1 ).toFixed( 2 ) } / rd.z;
		let t = min( ty, tz );
		let hit = ro + rd * t;
		if ( ro.y > H ) {
			refl = vec3f( 0.0 );
		} else if ( t == ty && rd.y > 0.0 ) {
			let g = vec2f( abs( fract( hit.x / 3.0 ) - 0.5 ) * 3.0, min( min( abs( hit.z - 2.2 ), abs( hit.z - 4.9 ) ), abs( hit.z - 7.6 ) ) );
			refl = vec3f( 0.58, 0.57, 0.54 ) * 0.1 + vec3f( 1.0, 0.86, 0.66 ) * 2.0 * step( g.x, 0.6 ) * step( g.y, 0.3 );
		} else if ( t == ty ) {
			refl = vec3f( 0.05, 0.02, 0.02 );
		} else {
			refl = select( vec3f( 0.12, 0.11, 0.085 ), vec3f( 0.04, 0.016, 0.008 ), hit.y < 1.0 );
			let px = ( fract( ( hit.x - 2.5 ) / 2.8 + 0.5 ) - 0.5 ) * 2.8;
			if ( abs( px ) < 0.55 && abs( hit.y - 2.0 ) < 0.55 ) { refl = vec3f( 0.1, 0.07, 0.03 ); }
		}
`;
		this.nearGlass = clearGlassMesh( near, clearGlass( 'club-glass-near', NEAR, BAND, { reflect } ), 'club-glass-near' );
		this.group.add( this.nearGlass );

	}

	// the far glass's room, traced: the ceiling's light panels, the carpet, the drink rail, the back wall's
	// paintings (their colours from the atlas), the bars lit with their names, the Wall of Balls; the
	// people on three planes. uv: ( s along the glass, height )
	_farWGSL() {

		const f = ( v ) => v.toFixed( 3 );
		const bars = this.bars.map( ( br ) => {

			const r = cellUV( br.sign );
			return `vec4f( ${ f( br.s ) }, ${ f( br.len / 2 ) }, ${ f( r[ 0 ] ) }, ${ f( r[ 1 ] ) } )`;

		} ).join( ', ' );
		const pr = cellUV( 'paintings', 0, 8, 1 ), pw = 256 / 2048;
		const pv = [ pr[ 1 ], cellUV( 'paintings2', 0, 8, 1 )[ 1 ], cellUV( 'paintings3', 0, 8, 1 )[ 1 ] ]; // ---- FI3: three rows of canvases
		return /* wgsl */`
	if ( nearK ) { discard; }
	let H = ${ f( CEIL ) };
	let DEP = ${ f( DEPC - 0.1 ) };
	let N = normalize( vec3f( in.N.x, 0.0, in.N.z ) );
	let T = normalize( cross( vec3f( 0.0, 1.0, 0.0 ), N ) );
	let Vd = normalize( in.P - frame.cameraPos );
	let rd = vec3f( dot( Vd, T ), Vd.y, max( dot( Vd, - N ), 0.05 ) );
	let ro = vec3f( in.uv.x, in.uv.y, 0.0 );
	let ty = ( select( 0.0, H, rd.y > 0.0 ) - ro.y ) / rd.y;
	let tz = DEP / rd.z;
	let t = min( ty, tz );
	let hit = ro + rd * t;
	let nk = smoothstep( 0.1, 0.7, frame.night );
	var room = vec3f( 0.6, 0.55, 0.44 );
	var glow = vec3f( 0.0 );
	var BARS = array<vec4f, ${ this.bars.length }>( ${ bars } );
	if ( ro.y > H ) {
		// over the ceiling: the bulkhead
		room = vec3f( 0.02 );
	} else if ( t == ty && rd.y > 0.0 ) {
		room = vec3f( 0.58, 0.57, 0.54 ) * 0.6;
		let g = vec2f( abs( fract( hit.x / ( 3.0 ) ) - 0.5 ) * 3.0, min( min( abs( hit.z - 2.2 ), abs( hit.z - 4.9 ) ), abs( hit.z - 7.6 ) ) );
		if ( g.x < 0.6 && g.y < 0.3 ) { glow = vec3f( 1.0, 0.86, 0.66 ) * 2.2; }
	} else if ( t == ty ) {
		room = mix( vec3f( 0.11, 0.095, 0.075 ), vec3f( 0.26, 0.022, 0.026 ), step( 0.45, fract( hit.x / 0.9 ) ) * step( 0.4, fract( hit.z / 0.9 ) ) );
	} else {
		// the back wall: cream over the cherry wainscot, a painting every 2.8 m under its light
		if ( hit.y < 1.0 ) { room = vec3f( 0.2, 0.075, 0.03 ); }
		let ps = fract( ( hit.x - 2.5 ) / 2.8 + 0.5 ) - 0.5;
		let px = ps * 2.8;
		if ( abs( px ) < 0.59 && abs( hit.y - 2.0 ) < 0.59 ) {
			room = vec3f( 0.5, 0.36, 0.1 );
			if ( abs( px ) < 0.48 && abs( hit.y - 2.0 ) < 0.48 ) {
				// (---- FI3 (C2I-12): the 24 canvases, dealt along the wall)
				let pi = ( u32( floor( ( hit.x - 2.5 ) / 2.8 + 0.5 ) ) * 7u ) % 24u;
				let cell = f32( pi % 8u );
				let rowV = select( select( ${ f( pv[ 0 ] ) }, ${ f( pv[ 1 ] ) }, pi >= 8u ), ${ f( pv[ 2 ] ) }, pi >= 16u );
				let auv = vec2f( ${ f( pr[ 0 ] ) } + ( cell + 0.5 + px / 0.96 ) * ${ f( pw ) }, rowV + ( 0.5 - ( hit.y - 2.0 ) / 0.96 ) * ${ f( pr[ 3 ] - pr[ 1 ] ) } );
				room = textureSampleLevel( inAtlas, smpAnisoClamp, auv, 2.0 ).rgb;
			}
		}
		if ( abs( px ) < 0.25 && abs( hit.y - 2.7 ) < 0.03 ) { glow = vec3f( 1.0, 0.85, 0.6 ) * 2.0; }
		// the Wall of Balls
		if ( abs( hit.x - ${ f( this.balls.s ) } ) < ${ f( this.balls.len / 2 ) } && hit.y > 0.45 && hit.y < 3.05 ) {
			let q = fract( hit.xy / 0.078 ) - 0.5;
			room = mix( vec3f( 0.2, 0.025, 0.032 ), vec3f( 0.7, 0.66, 0.58 ), 0.55 ) /* ---- FI3 (C2I-13): on maroon */ * ( 0.95 + 0.1 * step( length( q ), 0.4 ) );
		}
		// the bars: the counter's front, the lit shelves and their bottles, the name over them
		for ( var k = 0; k < ${ this.bars.length }; k ++ ) {
			let B = BARS[ k ];
			let bx = hit.x - B.x;
			if ( abs( bx ) < B.y ) {
				room = vec3f( 0.2, 0.075, 0.03 );
				if ( hit.y > 0.92 && hit.y < 2.45 ) {
					room = vec3f( 0.04, 0.035, 0.03 );
					let sh = fract( ( hit.y - 1.3 ) / 0.45 );
					glow = mix( vec3f( 0.5, 0.3, 0.12 ), vec3f( 0.25, 0.4, 0.15 ), step( 0.5, fract( hit.x * 7.3 ) ) ) * step( sh, 0.55 ) * 1.4 + vec3f( 1.0, 0.8, 0.5 ) * step( 0.97, sh ) * 2.0;
				}
				let sw = min( B.y * 2.0 - 0.6, 3.6 );
				if ( abs( bx ) < sw * 0.5 && hit.y > 2.71 && hit.y < 2.71 + sw * 0.5 ) {
					let auv = vec2f( B.z + ( 0.5 + bx / sw ) * ${ f( 512 / 2048 ) }, B.w + ( 1.0 - ( hit.y - 2.71 ) / ( sw * 0.5 ) ) * ${ f( 256 / 2048 ) } ); // ---- FI3: the atlas is 2048 tall now
					glow = textureSampleLevel( inAtlas, smpAnisoClamp, auv, 1.0 ).rgb * 1.6;
					room = vec3f( 0.0 );
				}
			}
		}
	}
	// ---- FI3 (C2I-9): by day the room behind the tinted glass is barely there, its panels no beacons; the tint
	room = ( room * mix( 0.08, 0.5, nk ) + glow * mix( 0.12, 1.0, nk ) ) * vec3f( 0.8, 0.92, 0.86 );
	// the drink rail just inside the glass
	let tR = 0.42 / rd.z;
	if ( tR < t && ( ro + rd * tR ).y < 1.07 && ( ro + rd * tR ).y > 0.0 ) { room = vec3f( 0.2, 0.075, 0.03 ) * mix( 0.06, 0.45, nk ); }
	// the people: at the bars, standing about, at the rail (nearer drawn over further)
	for ( var kk = 0; kk < 3; kk ++ ) {
		let zP = select( select( 1.0, 4.6, kk == 1 ), 7.4, kk == 0 );
		let tP = zP / rd.z;
		if ( tP < t && tP > 0.0 ) {
			let pp = ro + rd * tP;
			let cell = floor( pp.x / 0.8 ) + f32( kk ) * 17.0;
			let a = ihash( cell ); let bb = ihash( cell + 3.3 ); let c = ihash( cell + 5.7 );
			let cx = ( floor( pp.x / 0.8 ) + 0.3 + 0.4 * bb ) * 0.8;
			if ( a < select( 0.5, 0.42, kk == 1 ) ) {
				var coat = vec3f( 0.36, 0.025, 0.03 );
				if ( c > 0.45 ) { coat = vec3f( 0.03, 0.035, 0.08 ); }
				if ( c > 0.62 ) { coat = vec3f( 0.03 ); }
				if ( c > 0.78 ) { coat = vec3f( 0.22, 0.2, 0.18 ); }
				if ( c > 0.9 ) { coat = vec3f( 0.6, 0.58, 0.55 ); }
				let hair = mix( vec3f( 0.05, 0.035, 0.02 ), vec3f( 0.35, 0.25, 0.12 ), step( 0.7, bb ) ) + vec3f( 0.3 ) * step( 0.9, a * 1.8 );
				let skin = mix( vec3f( 0.55, 0.38, 0.3 ), vec3f( 0.3, 0.19, 0.13 ), step( 0.85, c ) );
				let fg = figure( vec2f( pp.x - cx, pp.y ), 1.6 + 0.24 * bb, coat, hair, skin, 0.0 );
				if ( fg.w > 0.5 ) { room = fg.xyz * mix( 0.035, 0.32, nk ); }
			}
		}
	}
	let fres = pow( 1.0 - max( dot( - Vd, N ), 0.0 ), 3.0 );
	s.albedo = vec3f( 0.045, 0.06, 0.056 ); // (---- FI3: more of the sky in it)
	s.roughness = 0.06;
	s.metalness = 0.5;
	s.alpha = 1.0;
	s.emissive = room * ( 1.0 - max( fres, 0.12 ) );
`;

	}

	// ---------------------------------------------------------------- the floor out to the back wall, the walls

	_floorAndWalls() {

		const C = this.colliders, F = this.field;
		if ( ! C || ! F ) return;
		const y = this.y;
		// (the bowl's club concourse is 8 m deep: the room is deeper)
		const A = offsetPolyline( this.bowl.path.slice( 2, 10 ), this.dStrip - 0.2, [ 0, - 40 ] );
		for ( let i = 0; i < A.length - 1; i ++ ) {

			const a = A[ i ], c = A[ i + 1 ], d = this.BK[ i ], e = this.BK[ i + 1 ];
			const cx = ( a[ 0 ] + c[ 0 ] + d[ 0 ] + e[ 0 ] ) / 4, cz = ( a[ 1 ] + c[ 1 ] + d[ 1 ] + e[ 1 ] ) / 4;
			const len = Math.hypot( c[ 0 ] - a[ 0 ], c[ 1 ] - a[ 1 ] ), dep = Math.hypot( ( d[ 0 ] + e[ 0 ] - a[ 0 ] - c[ 0 ] ) / 2, ( d[ 1 ] + e[ 1 ] - a[ 1 ] - c[ 1 ] ) / 2 );
			const w = F.toWorld( cx, cz );
			C.addBox( new Vector3( w.x, F.y0 + y - 0.3, w.z ), new Vector3( len / 2, 0.3, dep / 2 + 0.1 ), F.group.rotation.y - Math.atan2( c[ 1 ] - a[ 1 ], c[ 0 ] - a[ 0 ] ), { walkable: true, tag: 'club' } );
			wallCollider( C, F, d, e, y, CEIL, 0.2, 'club-wall' );

		}

		wallCollider( C, F, this.G[ 0 ], this.BK[ 0 ], y, CEIL, 0.2, 'club-wall' );
		wallCollider( C, F, this.G[ this.G.length - 1 ], this.BK[ this.BK.length - 1 ], y, CEIL, 0.2, 'club-wall' );
		// the bars' counters, the model's case
		for ( const br of this.bars ) {

			const { P } = this.at( br.s );
			const p = P( - br.len / 2, 0, DEPC - 1.6 ), q = P( br.len / 2, 0, DEPC - 1.6 );
			wallCollider( C, F, [ p[ 0 ], p[ 2 ] ], [ q[ 0 ], q[ 2 ] ], y, 1.1, 0.5, 'club-bar' );

		}

		const { P } = this.at( this.model.s );
		const p = P( - 1.35, 0, DEPC - 3.2 ), q = P( 1.35, 0, DEPC - 3.2 );
		wallCollider( C, F, [ p[ 0 ], p[ 2 ] ], [ q[ 0 ], q[ 2 ] ], y, 1.5, 1.9, 'club-case' );

	}

	// ---------------------------------------------------------------- the crowd

	_people() {

		const r = rnd( 2290 ), y = this.y;
		this.cast = new Cast( { parent: this.group, max: 260 } );
		this.tempo = new Tempo( [ this.cast ], { every: 6 } );
		this.who = [];
		const put = ( L, x, z, face, sg, o = {} ) => {

			const p = this.cast.add( L );
			if ( ! p ) return null;
			p.x = x; p.y = y; p.z = z;
			p.yaw = yawOf( face );
			p.scale = sizeOf( L, r );
			p.visible = false;
			const a = p.pose;
			if ( o.sit ) seat( a, o.sit );
			const k = r();
			const g = o.staff ? null : k < 0.6 ? GESTURE.carry : k < 0.75 ? GESTURE.fold : null;
			if ( g?.[ 0 ] ) a.armL = g[ 0 ].slice();
			if ( g?.[ 1 ] ) a.armR = g[ 1 ].slice();
			if ( ! o.staff && k < 0.6 ) a.propR = r() < 0.65 ? PROP.beer : r() < 0.5 ? PROP.soda : PROP.cocoa;
			const w = { p, sg, base: { armL: a.armL.slice(), armR: a.armR.slice(), propR: a.propR }, ph: r() * 10, look: ( r() - 0.5 ) * 0.7, staff: !! o.staff, sit: !! o.sit };
			this.who.push( w );
			return w;

		};

		const fan = () => {

			const L = dress( r, { poncho: 0 } );
			L.dry = true;
			return L;

		};

		// at the bars: the stools mostly taken, the bartenders in black
		for ( const s of this.spots ) {

			const keep = s.kind === 'bar' ? 0.75 : s.kind === 'table' ? 0.55 : 0.5;
			if ( r() > keep ) continue;
			const pos = s.p || ( () => {

				const q = this.at( s.s ).P( 0, 0, s.z );
				return [ q[ 0 ], q[ 2 ] ];

			} )();
			put( fan(), pos[ 0 ], pos[ 1 ], s.face, s.sg, { sit: s.sit } );

		}

		for ( const br of this.bars ) for ( const st of br.staff ) {

			const L = { top: TOP.polo, color: COLOR.black, sleeves: COLOR.black, hat: HAT.none, pants: 3, shoes: 1, skin: Math.floor( r() * 6 ), hair: Math.floor( r() * 4 ), female: r() < 0.5, hairStyle: 2, build: 1, seed: Math.floor( r() * 65536 ), dry: true };
			put( L, st.p[ 0 ], st.p[ 1 ], st.face, this.at( br.s ).sg, { staff: true } );

		}

		// standing about in twos and threes, in the open middle
		for ( const sg of this.segs ) {

			for ( let s = sg.s0 + 2.5; s < sg.s0 + sg.len - 2; s += 3.4 + r() * 2 ) {

				const z = 2.4 + r() * 4.4;
				if ( Math.abs( s - this.model.s ) < 2.5 && z > 4.5 ) continue;
				const P = this.at( s ).P, n = 2 + Math.floor( r() * 2.2 );
				const c0 = P( 0, 0, z );
				if ( ( this.tables || [] ).some( ( q ) => Math.hypot( q[ 0 ] - c0[ 0 ], q[ 1 ] - c0[ 2 ] ) < 1.9 ) ) continue;
				for ( let j = 0; j < n; j ++ ) {

					const a = j / n * Math.PI * 2 + r();
					const q = P( Math.cos( a ) * 0.55, 0, z + Math.sin( a ) * 0.55 );
					const fl = [ - Math.cos( a ), - Math.sin( a ) ];
					const face = [ sg.u[ 0 ] * fl[ 0 ] + sg.nIn[ 0 ] * fl[ 1 ], sg.u[ 1 ] * fl[ 0 ] + sg.nIn[ 1 ] * fl[ 1 ] ];
					put( fan(), q[ 0 ], q[ 2 ], face, sg );

				}

			}

		}

		this.cast.bounds = new Sphere( new Vector3( 0, y + 1.5, 25 ), 80 );

	}

	update( dt, director, camera ) {

		if ( ! this.reach || ! camera ) return;
		const F = this.field;
		const [ cx, cz ] = F.toField( camera.position.x, camera.position.z );
		const cy = camera.position.y - F.y0;
		// only from where you could see in: in it, from its seats and above, or from the field side of the
		// club's front (the field and the lower seats looking up); not from the suites or the concourse
		// under it, nor from behind its back wall
		const d = backFrom( this.G, cx, cz );
		const tv = this.app?.camMode && this.app.camMode !== 'walk';
		const sees = ! tv && d < DEPC + 0.5 && ( cy > this.y - 4 || d < - 9.5 );
		const any = this.reach.update( sees ? [ cx, cy, cz ] : [ 1e4, 0, 0 ] );
		if ( this.farMat ) this.farMat.uniforms.nearOn.value = sees ? 1 : 0;
		if ( this.tvs ) this.tvs.visible = any;
		this.nearGlass.visible = any;
		this.caseGlass.visible = any;
		let changed = false;
		for ( const w of this.who || [] ) {

			const on = !! w.sg.chunk?.on;
			if ( w.p.visible !== on ) {

				w.p.visible = on;
				w.p.fresh = true;
				changed = true;

			}

		}

		if ( ! any && ! changed ) return;
		const sdt = this.tempo.step( dt, camera );
		if ( ! sdt ) return;
		this.time = ( this.time || 0 ) + sdt;
		const ns = nightState( director );
		const t = this.time;
		for ( const w of this.who ) {

			if ( ! w.p.visible ) continue;
			const a = w.p.pose;
			if ( ns.celebrate && ! w.staff ) {

				a.armL = GESTURE.cheer[ 0 ].slice(); a.armR = GESTURE.cheer[ 1 ].slice();
				a.propR = 0;
				a.headPitch = - 0.1;
				a.mouth = 0.8;
				continue;

			}

			a.armL = w.base.armL; a.armR = w.base.armR; a.propR = w.base.propR;
			a.headYaw = w.look + Math.sin( t * 0.23 + w.ph ) * 0.4;
			a.headPitch = w.staff ? 0.25 : 0.0;
			a.mouth = Math.max( 0, Math.sin( t * 5.3 + w.ph * 3 ) ) * ( Math.sin( t * 0.37 + w.ph ) > 0.2 ? 0.5 : 0 );
			a.blink = ( t * 0.29 + w.ph ) % 1 < 0.04 ? 1 : 0;
			a.breath = ( t * 0.25 + w.ph ) % 1;
			if ( w.base.propR && ( t * 0.07 + w.ph ) % 1 < 0.06 ) a.armR = GESTURE.sip[ 1 ];

		}

		this.cast.update();

	}

}
