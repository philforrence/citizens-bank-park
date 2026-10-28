import { Group, Vector3, Sphere } from '../../engine/index.js';
import { offsetPolyline } from '../Bowl.js';
import { FOUL_TERRITORY, DUGOUTS } from '../layout.js';
import { DUGOUT_DEPTH, DUGOUT_WIDTH } from '../Field.js';
import { Cast, PROP, TOP, COLOR, HAT, seat } from './Cast.js';
import { GESTURE, dress, sizeOf } from './Concourse3BKit.js';
import { Tempo } from './Tempo.js';
import { Inside, insideMaterial, frame, Reach, cellUV, rnd, clearGlass, clearGlassMesh, Screens, yawOf } from './inside/Kit.js';

// FI2 (gauntlet CI-14): what's under the field level's seats round home plate, where there was a hollow
// with the risers' undersides for a ceiling. Behind home, under sections 119-128, the Diamond Club's
// lounge as it was in 2008 (harpo42, 27 Aug 2008; pompomflipflop, Mar 2008; the 2008 guide's "Diamond
// Clubhouse Lounge ... a full-service bar and views of the indoor batting cages", "original artwork by
// Dane Tilghman"): cream terrazzo with the red stitches of a baseball's seams inlaid, a black ceiling,
// a red-lacquered soffit over the long bar whose front glows red, the back bar's frosted panels lit
// blue-white, TVs over it, high-tops with black woven chairs, red leather banquettes, murals, DIAMOND
// CLUB over the bar; a glass wall at its first base end onto the indoor batting cages (puckfiend, 2005:
// two netted tunnels on green turf, the ball carts, an L-screen, the machine). Down the third base line a
// service corridor (block walls with the red stripe, sealed concrete, pipes and strip lights overhead)
// to the visitors' clubhouse; from each dugout the tunnel back under the seats (its bat rack, its helmets).
// The rooms are closed boxes (from the hollow you see plain walls), and drawn only with the camera under
// the stands near them.
//
// Field frame. The field is y 0; the dugouts' floors DUGOUT_DEPTH below it.

const D1 = 16.8; // the rooms' front, back from the foul territory wall (the seats are ~4 m up there)
const D2 = 28.6; // their back (the seats' top is at the main concourse, ~30 m back)
const CL = 3.4; // the lounge's and the cages' ceiling
const CC = 2.9; // the corridor's

const sub = ( a, b ) => [ a[ 0 ] - b[ 0 ], a[ 1 ] - b[ 1 ] ];
const dot = ( a, b ) => a[ 0 ] * b[ 0 ] + a[ 1 ] * b[ 1 ];
const lerp = ( a, b, t ) => [ a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * t, a[ 1 ] + ( b[ 1 ] - a[ 1 ] ) * t ];
const unit = ( v ) => {

	const l = Math.hypot( v[ 0 ], v[ 1 ] ) || 1;
	return [ v[ 0 ] / l, v[ 1 ] / l ];

};

export default class Under {

	constructor( { app, field, colliders } ) {

		this.app = app;
		this.field = field;
		this.colliders = colliders;
		this.group = new Group();
		this.group.name = 'under';
		const F = FOUL_TERRITORY;
		// from the first base dugout's far end round behind home to the third base dugout's far end
		const K = [ F[ 4 ], F[ 5 ], F[ 6 ], F[ 7 ], F[ 8 ], F[ 9 ] ];
		this.L1 = offsetPolyline( K, D1, [ 0, - 40 ] );
		this.L2 = offsetPolyline( K, D2, [ 0, - 40 ] );
		this.segs = [];
		for ( let i = 0; i < K.length - 1; i ++ ) {

			const a = this.L1[ i ], c = this.L1[ i + 1 ];
			const u = unit( sub( c, a ) );
			let nIn = [ - u[ 1 ], u[ 0 ] ];
			if ( dot( nIn, sub( lerp( a, c, 0.5 ), [ 0, - 40 ] ) ) < 0 ) nIn = [ - nIn[ 0 ], - nIn[ 1 ] ];
			this.segs.push( { i, a, c, b0: this.L2[ i ], b1: this.L2[ i + 1 ], u, nIn, len: Math.hypot( c[ 0 ] - a[ 0 ], c[ 1 ] - a[ 1 ] ) } );

		}

		this.material = insideMaterial( 'under-inside' );
		// where the dugouts' tunnels come in: a doorway in the room's front wall ([ segment, s along it ])
		this.doors = [];
		for ( const [ side, si ] of [ [ 'first', 0 ], [ 'third', 4 ] ] ) {

			const [ a, c ] = DUGOUTS[ side ];
			const p = lerp( a, c, 0.55 ), sg = this.segs[ si ];
			const end = [ p[ 0 ] + sg.nIn[ 0 ] * D1, p[ 1 ] + sg.nIn[ 1 ] * D1 ];
			this.doors.push( { si, s: dot( sub( end, sg.a ), sg.u ) } );

		}

		this.screens = new Screens( app );
		this.reach = new Reach( 14 );
		this.spots = [];
		const add = ( b, name, centre, r ) => {

			const m = b.mesh( this.material, name );
			this.group.add( m );
			this.reach.add( m, centre, r );
			return m;

		};
		const mid = ( sg, z = ( D2 - D1 ) / 2 ) => {

			const p = lerp( sg.a, sg.c, 0.5 );
			return [ p[ 0 ] + sg.nIn[ 0 ] * z, 1.5, p[ 1 ] + sg.nIn[ 1 ] * z ];

		};

		{

			const b = new Inside();
			for ( const sg of this.segs.slice( 1, 4 ) ) this._lounge( b, sg );
			this.lounge = add( b, 'under-lounge', mid( this.segs[ 2 ] ), 26 );

		}

		{

			const b = new Inside();
			this._cages( b, this.segs[ 0 ] );
			add( b, 'under-cages', mid( this.segs[ 0 ] ), 16 );

		}

		{

			const b = new Inside();
			this._corridor( b, this.segs[ 4 ] );
			add( b, 'under-corridor', mid( this.segs[ 4 ] ), 16 );

		}

		for ( const side of [ 'first', 'third' ] ) {

			const b = new Inside();
			const c = this._tunnel( b, side );
			add( b, `under-tunnel-${ side }`, c, 9 );

		}

		this.tvs = this.screens.mesh( 'under-tvs' );
		if ( this.tvs ) this.group.add( this.tvs );
		// the glass onto the cages
		this.cageGlass = clearGlassMesh( this.glassQuads, clearGlass( 'under-cage-glass', 40, 1 ), 'under-cage-glass' );
		this.group.add( this.cageGlass );
		this._outside();
		this._people();

	}

	// a frame on segment sg at s along its front line (from its start), z back from it
	P( sg, s = 0 ) {

		return frame( [ sg.a[ 0 ] + sg.u[ 0 ] * s, 0, sg.a[ 1 ] + sg.u[ 1 ] * s ], sg.u, sg.nIn );

	}

	// a vertical face between [ x, z ] points at heights h0..h1, its normal (field 3D); uv in metres
	_face( b, p0, p1, h0, h1, n, pal, cell = 0.8 ) {

		b.use( pal ).panel4( [ p0[ 0 ], h0, p0[ 1 ] ], [ p1[ 0 ], h0, p1[ 1 ] ], [ p1[ 0 ], h1, p1[ 1 ] ], [ p0[ 0 ], h1, p0[ 1 ] ], n, cell, ( p ) => [ Math.hypot( p[ 0 ] - p0[ 0 ], p[ 2 ] - p0[ 1 ] ), p[ 1 ] ] );

	}

	// a room's front wall along segment sg, in block, with the tunnel's doorway where it comes in
	_front( b, sg, h, n ) {

		const d = this.doors.find( ( q ) => q.si === sg.i );
		const at = ( s ) => [ sg.a[ 0 ] + sg.u[ 0 ] * s, sg.a[ 1 ] + sg.u[ 1 ] * s ];
		if ( ! d ) return this._face( b, sg.a, sg.c, 0, h, n, 'cmu' );
		const s0 = d.s - 1.1, s1 = d.s + 1.1;
		this._face( b, sg.a, at( s0 ), 0, h, n, 'cmu' );
		this._face( b, at( s1 ), sg.c, 0, h, n, 'cmu' );
		this._face( b, at( s0 ), at( s1 ), 2.4, h, n, 'cmu' );
		// the doorway's steel frame
		const P = this.P( sg, d.s );
		b.use( 'maroon' ).box( P, - 1.12, 1.2, 0.04, 0.08, 2.4, 0.1 );
		b.use( 'maroon' ).box( P, 1.12, 1.2, 0.04, 0.08, 2.4, 0.1 );
		b.use( 'maroon' ).box( P, 0, 2.43, 0.04, 2.32, 0.08, 0.1 );

	}

	// ---------------------------------------------------------------- the Diamond Club's lounge

	_lounge( b, sg ) {

		const home = sg.i === 2;
		const depth = D2 - D1;
		const P = this.P( sg );
		const s0 = - dot( sub( sg.a, sg.b0 ), sg.u ); // how far the back line's start is along (the mitre)
		// its lamps: cans on a grid, the spots over the bar, the bar's red glow
		const lamps = [];
		for ( let s = 1.6; s < sg.len - 0.8; s += 3.2 ) for ( const z of [ 2.2, 5.6 ] ) lamps.push( [ ...P( s, CL - 0.05, z ), 1.2 ] );
		if ( home ) {

			for ( let s = sg.len / 2 - 6; s <= sg.len / 2 + 6; s += 2 ) lamps.push( [ ...P( s, CL - 0.45, depth - 1.8 ), 1.4 ] );
			for ( let s = sg.len / 2 - 5.5; s <= sg.len / 2 + 5.5; s += 2.75 ) lamps.push( [ ...P( s, 0.5, depth - 2.6 ), 0.7, 'omni', 1.5 ] );

		}

		b.room( { lamps, amb: 0.08, bounce: 0.06 } );
		const nIn = [ sg.nIn[ 0 ], 0, sg.nIn[ 1 ] ], nOut = [ - sg.nIn[ 0 ], 0, - sg.nIn[ 1 ] ];
		// the terrazzo (its seams centred on the room), the black ceiling
		const mid3 = lerp( lerp( this.L1[ 2 ], this.L1[ 3 ], 0.5 ), lerp( this.L2[ 2 ], this.L2[ 3 ], 0.5 ), 0.5 );
		const uvT = ( p ) => [ p[ 0 ] - mid3[ 0 ], p[ 2 ] - mid3[ 1 ] ];
		const fl = ( p, h ) => [ p[ 0 ], h, p[ 1 ] ];
		b.use( 'terrazzo' ).panel4( fl( sg.a, 0.005 ), fl( sg.c, 0.005 ), fl( sg.b1, 0.005 ), fl( sg.b0, 0.005 ), [ 0, 1, 0 ], 0.7, uvT );
		b.use( 'blackPaint' ).panel4( fl( sg.a, CL ), fl( sg.c, CL ), fl( sg.b1, CL ), fl( sg.b0, CL ), [ 0, - 1, 0 ], 1.2 );
		for ( const l of lamps ) if ( l[ 4 ] !== 'omni' && l[ 1 ] > CL - 0.1 ) b.use( 'can' ).box( frame( [ l[ 0 ], l[ 1 ], l[ 2 ] ], sg.u, sg.nIn ), 0, 0.03, 0, 0.16, 0.01, 0.16, [ 'top' ] );
		// the front wall (toward the field): dark wood below, deep red above; the murals; the banquettes
		this._face( b, sg.a, sg.c, 0, 1.0, nIn, 'cherry' );
		this._face( b, sg.a, sg.c, 1.0, CL, nIn, 'redPaint', 1.0 );
		b.use( 'oak' ).box( P, sg.len / 2, 1.0, 0.025, sg.len, 0.06, 0.05 );
		{

			const w = home ? 4.4 : 3.6, h = w / 2, sc = sg.len / 2;
			b.use( 'black' ).box( P, sc, 1.35 + h / 2, 0.03, w + 0.12, h + 0.12, 0.05 );
			// (read from the room: its left is the - u side... the viewer faces - nIn: left is + u)
			b.use( 'print' ).print( P( sc + w / 2, 1.35, 0.058 ), P( sc - w / 2, 1.35, 0.058 ), P( sc - w / 2, 1.35 + h, 0.058 ), P( sc + w / 2, 1.35 + h, 0.058 ), nIn, cellUV( 'muralClub' ) );

		}

		if ( ! home ) for ( let s = 1.4; s < sg.len - 1.4; s += 2.6 ) {

			if ( Math.abs( s - sg.len / 2 ) < 2.3 ) continue;
			b.use( 'leather' ).box( P, s, 0.22, 0.65, 2.2, 0.44, 0.6 );
			b.use( 'leather' ).box( P, s, 0.75, 0.15, 2.2, 0.62, 0.22 );
			b.use( 'black' ).cyl( P, s, 1.45, 0.0, 0.52, 0.05, 0.05, 6, false );
			b.use( 'granite' ).cyl( P, s, 1.45, 0.52, 0.56, 0.38, 0.38, 12, true );
			this.spots.push( { p: P( s - 0.5, 0, 0.75 ), face: sg.nIn, sit: 0.46, room: 'lounge' } );
			this.spots.push( { p: P( s + 0.5, 0, 0.75 ), face: sg.nIn, sit: 0.46, room: 'lounge' } );

		}

		// the back wall: black, the frosted panels along it
		this._face( b, [ sg.b1[ 0 ], sg.b1[ 1 ] ], [ sg.b0[ 0 ], sg.b0[ 1 ] ], 0, CL, nOut, 'blackPaint', 1.0 );
		// the high-tops with their black woven chairs
		for ( let s = 2.2; s < sg.len - 1.5; s += 3.6 ) {

			const z = home ? 4.4 : 5.4;
			if ( home && Math.abs( s - sg.len / 2 ) < 1.2 ) continue;
			b.use( 'black' ).cyl( P, s, z, 1.0, 1.04, 0.42, 0.42, 14, true );
			b.use( 'black' ).cyl( P, s, z, 0.04, 1.0, 0.045, 0.045, 6, false );
			b.use( 'black' ).cyl( P, s, z, 0.0, 0.04, 0.26, 0.24, 10, true );
			for ( let j = 0; j < 3; j ++ ) {

				const a = j * 2.1 + s;
				const f = [ - Math.cos( a ), - Math.sin( a ) ];
				const fw = [ sg.u[ 0 ] * f[ 0 ] + sg.nIn[ 0 ] * f[ 1 ], sg.u[ 1 ] * f[ 0 ] + sg.nIn[ 1 ] * f[ 1 ] ];
				const o = P( s + Math.cos( a ) * 0.72, 0, z + Math.sin( a ) * 0.72 );
				this._chair( b, frame( o, [ fw[ 1 ], - fw[ 0 ] ], fw ) );
				this.spots.push( { p: o, face: fw, sit: 0.76, room: 'lounge' } );

			}

		}

		if ( home ) this._bar( b, sg, P, depth );
		// the end at the third base side: a wall across, double doors into the corridor
		if ( sg.i === 3 ) {

			const p = sg.c, q = sg.b1;
			const d = unit( sub( q, p ) );
			let n = [ - d[ 1 ], 0, d[ 0 ] ];
			if ( dot( [ n[ 0 ], n[ 2 ] ], sg.u ) > 0 ) n = n.map( ( v ) => - v );
			this._face( b, p, q, 0, CL, n, 'redPaint', 1.0 );
			const E = frame( [ p[ 0 ] + d[ 0 ] * 1.6, 0, p[ 1 ] + d[ 1 ] * 1.6 ], d, [ n[ 0 ], n[ 2 ] ] );
			for ( const x of [ - 0.5, 0.5 ] ) {

				b.use( 'oak' ).box( E, x, 1.07, 0.03, 0.96, 2.14, 0.05 );
				b.use( 'brass' ).box( E, x * 0.2, 1.05, 0.07, 0.03, 0.4, 0.03 );

			}

			b.use( 'exitSign' ).box( E, 0, 2.5, 0.05, 0.4, 0.15, 0.05 );

		}

		void s0;

	}

	// the long bar on the backstop's side: its front lit red, the black top; the back bar's frosted panels
	// lit blue-white, the coolers, the TVs over it; DIAMOND CLUB; the red soffit over it all
	_bar( b, sg, P, depth ) {

		const L = 12, sc = sg.len / 2, zc = depth - 2.6, nOut = [ - sg.nIn[ 0 ], 0, - sg.nIn[ 1 ] ];
		b.use( 'black' ).box( P, sc, 0.5, zc + 0.15, L, 1.0, 0.4, [ 'back' ] );
		b.use( 'barGlow' ).quad( P( sc - L / 2, 0.08, zc - 0.07 ), P( sc + L / 2, 0.08, zc - 0.07 ), P( sc + L / 2, 0.98, zc - 0.07 ), P( sc - L / 2, 0.98, zc - 0.07 ), nOut );
		for ( let x = sc - L / 2 + 1.5; x < sc + L / 2; x += 1.5 ) b.use( 'black' ).box( P, x, 0.53, zc - 0.075, 0.06, 0.9, 0.01 );
		b.use( 'granite' ).box( P, sc, 1.08, zc + 0.12, L + 0.2, 0.05, 0.7 );
		b.use( 'black' ).box( P, sc, 0.06, zc - 0.15, L, 0.12, 0.25 );
		// the back bar
		const zb = depth - 0.3;
		b.use( 'black' ).box( P, sc, 0.46, zb, L + 1, 0.92, 0.6 );
		b.use( 'granite' ).box( P, sc, 0.94, zb, L + 1.02, 0.04, 0.62 );
		for ( let x = sc - L / 2; x < sc + L / 2; x += 1.6 ) {

			b.use( 'frost' ).quad( P( x + 0.05, 1.05, depth - 0.02 ), P( x + 1.55, 1.05, depth - 0.02 ), P( x + 1.55, 2.25, depth - 0.02 ), P( x + 0.05, 2.25, depth - 0.02 ), nOut );
			b.use( 'black' ).box( P, x, 1.65, depth - 0.04, 0.06, 1.3, 0.04 );

		}

		b.use( 'fridge' ).box( P, sc + L / 2 - 0.5, 1.6, depth - 0.15, 0.8, 1.2, 0.02 );
		b.use( 'stainless' ).box( P, sc - L / 2 + 0.6, 1.25, zb - 0.1, 0.5, 0.6, 0.4 );
		// the sign, the TVs, the soffit
		// (read from the room: its left is the - u side)
		b.use( 'printLit' ).print( P( sc - 1.3, 2.4, depth - 0.03 ), P( sc + 1.3, 2.4, depth - 0.03 ), P( sc + 1.3, 3.05, depth - 0.03 ), P( sc - 1.3, 3.05, depth - 0.03 ), nOut, cellUV( 'diamondSign' ) );
		for ( const x of [ - 4.5, - 1.8, 1.8, 4.5 ].map( ( v ) => sc + v ) ) {

			if ( Math.abs( x - sc ) < 2 ) continue;
			b.use( 'black' ).box( P, x, 2.62, depth - 0.12, 1.0, 0.6, 0.08 );
			this.screens.add( b, P( x - 0.47, 2.34, depth - 0.161 ), P( x + 0.47, 2.34, depth - 0.161 ), P( x + 0.47, 2.9, depth - 0.161 ), P( x - 0.47, 2.9, depth - 0.161 ), nOut );

		}

		b.use( 'redPaint' ).box( P, sc, CL - 0.22, zc + 0.3, L + 2, 0.44, 2.4, [ 'top' ] );
		// the stools at the bar, the bartenders' places
		for ( let x = sc - L / 2 + 0.6; x < sc + L / 2 - 0.4; x += 0.95 ) {

			const o = P( x, 0, zc - 0.75 );
			this._chair( b, frame( o, sg.u.map( ( v ) => - v ), sg.nIn ) );
			this.spots.push( { p: o, face: sg.nIn, sit: 0.76, room: 'lounge', bar: true } );

		}

		this.staff = [ - 3, 2.5 ].map( ( x ) => ( { p: P( sc + x, 0, depth - 1.35 ), face: [ - sg.nIn[ 0 ], - sg.nIn[ 1 ] ] } ) );

	}

	// a black woven high chair (S: its frame, forward toward what it faces)
	_chair( b, S ) {

		b.use( 'black' );
		for ( const [ lx, lz ] of [ [ - 0.19, - 0.19 ], [ 0.19, - 0.19 ], [ - 0.19, 0.19 ], [ 0.19, 0.19 ] ] ) b.box( S, lx, 0.37, lz, 0.035, 0.74, 0.035, [ 'top', 'bottom' ] );
		b.box( S, 0, 0.3, 0.19, 0.36, 0.025, 0.025 );
		b.use( 'weave' ).box( S, 0, 0.75, 0, 0.44, 0.05, 0.44 );
		b.use( 'weave' ).box( S, 0, 1.12, - 0.2, 0.42, 0.62, 0.04 );

	}

	// ---------------------------------------------------------------- the batting cages

	_cages( b, sg ) {

		const P = this.P( sg ), depth = D2 - D1, len = sg.len;
		const nIn = [ sg.nIn[ 0 ], 0, sg.nIn[ 1 ] ], nOut = [ - sg.nIn[ 0 ], 0, - sg.nIn[ 1 ] ];
		const zW = 2.6; // the walkway along the front, the cages behind it
		const cages = [ [ zW + 0.35, zW + 4.55 ], [ zW + 4.85, zW + 9.05 ] ];
		const lamps = [];
		for ( let s = 2; s < len - 1; s += 3 ) {

			for ( const [ z0, z1 ] of cages ) lamps.push( [ ...P( s, CL - 0.1, ( z0 + z1 ) / 2 ), 1.3, undefined, 2.5 ] );
			lamps.push( [ ...P( s, CL - 0.6, 1.3 ), 0.8 ] );

		}

		b.room( { lamps, amb: 0.12 } );
		const fl = ( p, h ) => [ p[ 0 ], h, p[ 1 ] ];
		const uvL = ( p ) => [ dot( sub( [ p[ 0 ], p[ 2 ] ], sg.a ), sg.u ), dot( sub( [ p[ 0 ], p[ 2 ] ], sg.a ), sg.nIn ) ];
		// the walkway's concrete, the cages' turf
		const wa = lerp( sg.a, sg.b0, zW / depth ), wc = lerp( sg.c, sg.b1, zW / depth );
		b.use( 'concreteFloor' ).panel4( fl( sg.a, 0.005 ), fl( sg.c, 0.005 ), fl( wc, 0.005 ), fl( wa, 0.005 ), [ 0, 1, 0 ], 0.8, uvL );
		b.use( 'turf' ).panel4( fl( wa, 0.005 ), fl( wc, 0.005 ), fl( sg.b1, 0.005 ), fl( sg.b0, 0.005 ), [ 0, 1, 0 ], 0.8, uvL );
		b.use( 'deck' ).panel4( fl( sg.a, CL ), fl( sg.c, CL ), fl( sg.b1, CL ), fl( sg.b0, CL ), [ 0, - 1, 0 ], 1.2, uvL );
		// the walls: block painted white, the red stripe; the back wall padded navy
		this._front( b, sg, CL, nIn );
		b.use( 'redPaint' ).box( P, len / 2, 1.1, 0.012, len, 0.15, 0.02 );
		this._face( b, sg.b1, sg.b0, 0, CL, nOut, 'cmu' );
		b.use( 'navyVinyl' ).box( P, len / 2, 1.2, depth - 0.06, len - 0.4, 2.0, 0.12 );
		// the far end (away from the lounge): block
		this._face( b, sg.b0, sg.a, 0, CL, [ sg.u[ 0 ], 0, sg.u[ 1 ] ], 'cmu' );
		// the half wall between the walkway and the cages
		b.use( 'cmu' ).box( P, len / 2, 0.5, zW, len - 0.4, 1.0, 0.2 );
		b.use( 'concrete' ).box( P, len / 2, 1.02, zW, len - 0.38, 0.04, 0.24 );
		// each cage: the netting down its sides, along its top and across its ends; the mat, the plate and
		// the box at the lounge end; the machine and its L-screen at the far end; the ball carts
		for ( const [ z0, z1 ] of cages ) {

			const zc = ( z0 + z1 ) / 2, x0 = 1.2, x1 = len - 1.6, top = CL - 0.25;
			const net = ( a, bb, c, d, n ) => {

				b.use( 'net' ).quad( a, bb, c, d, n );
				b.use( 'net' ).quad( a, d, c, bb, n.map( ( v ) => - v ) );

			};
			for ( const z of [ z0, z1 ] ) net( P( x0, 0, z ), P( x1, 0, z ), P( x1, top, z ), P( x0, top, z ), nIn );
			net( P( x0, top, z0 ), P( x1, top, z0 ), P( x1, top, z1 ), P( x0, top, z1 ), [ 0, - 1, 0 ] );
			for ( const x of [ x0, x1 ] ) net( P( x, 0, z0 ), P( x, 0, z1 ), P( x, top, z1 ), P( x, top, z0 ), [ sg.u[ 0 ], 0, sg.u[ 1 ] ] );
			b.use( 'steel' ).box( P, ( x0 + x1 ) / 2, top, z0, x1 - x0, 0.03, 0.03 );
			b.use( 'steel' ).box( P, ( x0 + x1 ) / 2, top, z1, x1 - x0, 0.03, 0.03 );
			// the plate and the batter's box mat by the lounge's glass, the machine at the far end
			const xh = x1 - 2.2;
			b.use( 'turfMat' ).box( P, xh, 0.012, zc, 3.4, 0.012, 3.0 );
			b.use( 'white' ).box( P, xh - 0.15, 0.022, zc, 0.43, 0.01, 0.43 );
			b.use( 'redPaint' ).box( P, xh + 0.9, 0.02, zc - 0.9, 0.6, 0.012, 0.6 );
			const xm = x0 + 3.2;
			b.use( 'black' ).box( P, xm, 0.5, zc, 0.5, 1.0, 0.5 );
			b.use( 'steel' ).cyl( P, xm + 0.3, zc, 0.8, 1.15, 0.2, 0.2, 10, true );
			b.use( 'black' ).box( P, xm + 1.6, 1.0, zc + 0.6, 0.05, 2.0, 0.05 );
			b.use( 'black' ).box( P, xm + 1.6, 1.0, zc - 0.6, 0.05, 2.0, 0.05 );
			b.use( 'black' ).box( P, xm + 1.6, 2.0, zc, 0.05, 0.05, 1.25 );
			b.use( 'black' ).box( P, xm + 1.6, 1.0, zc - 0.15, 0.05, 0.05, 0.9 );
			b.use( 'net' ).quad( P( xm + 1.6, 0, zc - 0.6 ), P( xm + 1.6, 0, zc + 0.6 ), P( xm + 1.6, 2.0, zc + 0.6 ), P( xm + 1.6, 2.0, zc - 0.6 ), [ sg.u[ 0 ], 0, sg.u[ 1 ] ] );
			// a ball cart: a wire basket of balls on legs and wheels
			for ( const [ x, z ] of [ [ xm + 2.4, zc + 1.2 ], [ xh - 1.6, zc - 1.3 ] ] ) {

				for ( const [ dx, dz ] of [ [ - 0.22, - 0.22 ], [ 0.22, - 0.22 ], [ - 0.22, 0.22 ], [ 0.22, 0.22 ] ] ) b.use( 'chrome' ).box( P, x + dx, 0.42, z + dz, 0.02, 0.84, 0.02 );
				b.use( 'chrome' ).box( P, x, 0.55, z, 0.46, 0.02, 0.46 );
				b.use( 'ball' ).box( P, x, 0.68, z, 0.42, 0.24, 0.42 );
				b.use( 'chrome' ).box( P, x, 0.84, z, 0.46, 0.02, 0.46 );

			}

			// stray balls on the turf
			const r = rnd( Math.round( zc * 100 ) );
			for ( let k = 0; k < 9; k ++ ) b.use( 'ball' ).cyl( P, x0 + 1 + r() * ( x1 - x0 - 2 ), zc + ( r() - 0.5 ) * 3.6, 0.0, 0.07, 0.037, 0.037, 6, true );

		}

		for ( const l of lamps ) if ( l[ 1 ] > CL - 0.2 ) b.use( 'cove' ).box( frame( [ l[ 0 ], l[ 1 ], l[ 2 ] ], sg.u, sg.nIn ), 0, 0.03, 0, 1.2, 0.04, 0.16 );
		// the lounge's glass wall onto the cages (the end at the lounge: the mitre to the next side)
		const ga = sg.c, gb = sg.b1;
		const gn = unit( sub( gb, ga ) ), gnn = [ gn[ 1 ], 0, - gn[ 0 ] ];
		const fw = dot( [ gnn[ 0 ], gnn[ 2 ] ], sg.u ) > 0 ? gnn : gnn.map( ( v ) => - v );
		this._face( b, ga, gb, 0, 0.95, fw.map( ( v ) => - v ), 'cmu' );
		this._face( b, gb, ga, 0, 0.95, fw, 'blackPaint' );
		this._face( b, ga, gb, 2.85, CL, fw.map( ( v ) => - v ), 'cmu' );
		this._face( b, gb, ga, 2.85, CL, fw, 'blackPaint' );
		const gl = Math.hypot( gb[ 0 ] - ga[ 0 ], gb[ 1 ] - ga[ 1 ] );
		const G = frame( [ ( ga[ 0 ] + gb[ 0 ] ) / 2, 0, ( ga[ 1 ] + gb[ 1 ] ) / 2 ], gn, [ fw[ 0 ], fw[ 2 ] ] );
		b.use( 'bronze' ).box( G, 0, 0.95, 0, gl, 0.08, 0.2 );
		b.use( 'bronze' ).box( G, 0, 2.85, 0, gl, 0.08, 0.2 );
		for ( let t = - gl / 2; t <= gl / 2 + 0.01; t += gl / 5 ) b.use( 'bronze' ).box( G, t, 1.9, 0, 0.08, 1.9, 0.14 );
		this.glassQuads = new Inside();
		this.glassQuads.quad( [ ga[ 0 ], 0.95, ga[ 1 ] ], [ gb[ 0 ], 0.95, gb[ 1 ] ], [ gb[ 0 ], 2.85, gb[ 1 ] ], [ ga[ 0 ], 2.85, ga[ 1 ] ], fw );
		// the walkway's door from the first base tunnel (_tunnel), a sign over it
		this.cageSeg = sg;

	}

	// ---------------------------------------------------------------- the corridor down the third base line

	_corridor( b, sg ) {

		const P = this.P( sg ), len = sg.len, w = 3.0;
		const nIn = [ sg.nIn[ 0 ], 0, sg.nIn[ 1 ] ], nOut = [ - sg.nIn[ 0 ], 0, - sg.nIn[ 1 ] ], along = [ sg.u[ 0 ], 0, sg.u[ 1 ] ];
		const lamps = [];
		for ( let s = 1.5; s < len - 0.5; s += 3.2 ) lamps.push( [ ...P( s, CC - 0.25, w / 2 ), 1.2 ] );
		b.room( { lamps, amb: 0.15 } );
		const fl = ( p, h ) => [ p[ 0 ], h, p[ 1 ] ];
		const ba = P( 0, 0, w ), bc = P( len, 0, w );
		const back0 = [ ba[ 0 ], ba[ 2 ] ], back1 = [ bc[ 0 ], bc[ 2 ] ];
		const uvL = ( p ) => [ dot( sub( [ p[ 0 ], p[ 2 ] ], sg.a ), sg.u ), dot( sub( [ p[ 0 ], p[ 2 ] ], sg.a ), sg.nIn ) ];
		b.use( 'concreteFloor' ).panel4( fl( sg.a, 0.005 ), fl( sg.c, 0.005 ), fl( back1, 0.005 ), fl( back0, 0.005 ), [ 0, 1, 0 ], 0.8, uvL );
		b.use( 'deck' ).panel4( fl( sg.a, CC ), fl( sg.c, CC ), fl( back1, CC ), fl( back0, CC ), [ 0, - 1, 0 ], 1.2, uvL );
		this._front( b, sg, CC, nIn );
		this._face( b, back1, back0, 0, CC, nOut, 'cmu' );
		for ( const z of [ 0.012, w - 0.012 ] ) b.use( 'redPaint' ).box( P, len / 2, 1.1, z, len, 0.15, 0.02 );
		// its ends: the lounge's doors at one, the visitors' clubhouse's at the other
		this._face( b, back0, sg.a, 0, CC, along, 'cmu' );
		this._face( b, sg.c, back1, 0, CC, along.map( ( v ) => - v ), 'cmu' );
		const E = frame( P( 0.02, 0, w / 2 ), [ sg.nIn[ 0 ], sg.nIn[ 1 ] ], sg.u );
		for ( const x of [ - 0.48, 0.48 ] ) b.use( 'maroon' ).box( E, x, 1.06, 0.03, 0.92, 2.12, 0.05 );
		b.use( 'steel' ).box( E, 0, 2.2, 0.02, 2.1, 0.08, 0.04 );
		const X = frame( P( len - 0.02, 0, w / 2 ), [ - sg.nIn[ 0 ], - sg.nIn[ 1 ] ], sg.u.map( ( v ) => - v ) );
		for ( const x of [ - 0.48, 0.48 ] ) b.use( 'steel' ).box( X, x, 1.06, 0.03, 0.92, 2.12, 0.05 );
		b.use( 'exitSign' ).box( X, 0, 2.45, 0.05, 0.4, 0.15, 0.05 );
		// overhead: the sprinkler main, conduit, the strip lights
		const pipe = ( z, h, r, pal ) => b.use( pal ).cyl( frame( P( len / 2, 0, z ), sg.nIn.map( ( v ) => - v ), sg.u ), 0, 0, h - r, h + r, r, r, 6, false );
		void pipe;
		for ( const [ z, h, r, pal ] of [ [ 0.5, CC - 0.25, 0.08, 'pipeWhite' ], [ 0.8, CC - 0.15, 0.03, 'steel' ], [ 2.4, CC - 0.2, 0.05, 'maroon' ] ] ) {

			const a = P( 0.1, h, z ), c = P( len - 0.1, h, z );
			const d = [ c[ 0 ] - a[ 0 ], 0, c[ 2 ] - a[ 2 ] ];
			const l = Math.hypot( d[ 0 ], d[ 2 ] );
			const Q = frame( a, [ sg.nIn[ 0 ], sg.nIn[ 1 ] ], [ d[ 0 ] / l, d[ 2 ] / l ] );
			b.use( pal ).box( Q, 0, 0, l / 2, r * 2, r * 2, l );

		}

		for ( const l of lamps ) b.use( 'cove' ).box( frame( [ l[ 0 ], l[ 1 ], l[ 2 ] ], sg.u, sg.nIn ), 0, 0.0, 0, 1.2, 0.06, 0.14 );
		// doors along its back wall: the storerooms, the umpires' room
		for ( let s = 4; s < len - 3; s += 6.5 ) {

			b.use( 'maroon' ).box( P, s, 1.06, w - 0.03, 0.95, 2.12, 0.05 );
			b.use( 'steel' ).box( P, s + 0.35, 1.0, w - 0.07, 0.12, 0.03, 0.04 );
			b.use( 'white' ).box( P, s - 0.75, 1.6, w - 0.02, 0.3, 0.2, 0.01 );

		}

		this.corridorSeg = sg;

	}

	// ---------------------------------------------------------------- the dugouts' tunnels

	// From the dugout's back wall (halfway along it) straight back under the seats to the rooms, up a ramp
	// from the dugout's floor; block walls with the red stripe, the strip lights, the bat rack and the
	// helmets by the dugout end, a steel door in the dugout's wall
	_tunnel( b, side ) {

		const [ a, c ] = DUGOUTS[ side ];
		const len = Math.hypot( c[ 0 ] - a[ 0 ], c[ 1 ] - a[ 1 ] );
		const u = unit( sub( c, a ) );
		let n = [ - u[ 1 ], u[ 0 ] ];
		if ( dot( n, sub( lerp( a, c, 0.5 ), [ 0, - 40 ] ) ) < 0 ) n = [ - n[ 0 ], - n[ 1 ] ];
		const sMid = len * 0.55, t0 = DUGOUT_WIDTH + 0.25, t1 = D1, w = 2.2, Dd = DUGOUT_DEPTH;
		const P = frame( [ a[ 0 ] + u[ 0 ] * sMid, 0, a[ 1 ] + u[ 1 ] * sMid ], u, n );
		const floor = ( t ) => - Dd + Dd * Math.min( 1, Math.max( 0, ( t - t0 ) / ( 14 - t0 ) ) );
		const lamps = [];
		for ( let t = t0 + 1.2; t < t1; t += 2.8 ) lamps.push( [ ...P( 0, floor( t ) + 2.3, t ), 1.0 ] );
		b.room( { lamps, amb: 0.15 } );
		const steps = 12;
		for ( let k = 0; k < steps; k ++ ) {

			const ta = t0 + ( t1 - t0 ) * k / steps, tb = t0 + ( t1 - t0 ) * ( k + 1 ) / steps;
			const fa = floor( ta ), fb = floor( tb );
			b.use( 'concreteFloor' ).quad( P( - w / 2, fa, ta ), P( w / 2, fa, ta ), P( w / 2, fb, tb ), P( - w / 2, fb, tb ), [ 0, 1, 0 ] );
			b.use( 'deck' ).quad( P( - w / 2, fa + 2.4, ta ), P( w / 2, fa + 2.4, ta ), P( w / 2, fb + 2.4, tb ), P( - w / 2, fb + 2.4, tb ), [ 0, - 1, 0 ] );
			for ( const sd of [ - 1, 1 ] ) {

				const nn = P.dir( - sd, 0, 0 );
				b.use( 'cmu' ).quad( P( sd * w / 2, fa, ta ), P( sd * w / 2, fb, tb ), P( sd * w / 2, fb + 2.4, tb ), P( sd * w / 2, fa + 2.4, ta ), nn, [ [ ta, fa ], [ tb, fb ], [ tb, fb + 2.4 ], [ ta, fa + 2.4 ] ] );
				b.use( 'redPaint' ).quad( P( sd * ( w / 2 - 0.01 ), fa + 1.05, ta ), P( sd * ( w / 2 - 0.01 ), fb + 1.05, tb ), P( sd * ( w / 2 - 0.01 ), fb + 1.2, tb ), P( sd * ( w / 2 - 0.01 ), fa + 1.2, ta ), nn );

			}

		}

		for ( const l of lamps ) b.use( 'cove' ).box( frame( [ l[ 0 ], l[ 1 ] + 0.08, l[ 2 ] ], u, n ), 0, 0, 0, 0.16, 0.05, 1.2 );
		// the steel door at the dugout's end of it (on the dugout's back wall), the door at the far end
		b.use( 'maroon' ).box( P, 0, - Dd + 1.05, t0 + 0.03, 1.0, 2.1, 0.05 );
		b.use( 'steel' ).box( P, 0.35, - Dd + 1.0, t0 + 0.07, 0.12, 0.03, 0.04 );
		// the bat rack: cubbies on the wall, a bat in each; the helmets on their shelf
		const r = rnd( side === 'first' ? 11 : 13 );
		const sd = side === 'first' ? 1 : - 1, xw = sd * ( w / 2 - 0.2 );
		for ( let k = 0; k < 14; k ++ ) {

			const t = t0 + 0.8 + k * 0.12, f = floor( t );
			b.use( 'honey' ).box( P, xw, f + 0.6, t, 0.36, 1.2, 0.02 );
			b.use( r() < 0.75 ? 'honey' : 'black' ).cyl( P, xw + sd * 0.02, t + 0.06, f + 0.08, f + 0.92, 0.022, 0.033, 6, true );

		}

		b.use( 'honey' ).box( P, xw, floor( t0 + 1.6 ) + 1.3, t0 + 1.62, 0.36, 0.03, 1.7 );
		// (a helmet: a shell, its brim, the ear flap)
		for ( let k = 0; k < 6; k ++ ) {

			const t = t0 + 0.95 + k * 0.27, f = floor( t0 + 1.6 ) + 1.315;
			b.use( side === 'first' ? 'redPaint' : 'navyVinyl' ).cyl( P, xw, t, f, f + 0.1, 0.11, 0.09, 10, false );
			b.cyl( P, xw, t, f + 0.1, f + 0.15, 0.09, 0.04, 10, true );
			b.box( P, xw - sd * 0.1, f + 0.01, t, 0.08, 0.012, 0.16 );

		}
		// where it meets the room behind: a doorway in the room's front wall
		this[ side + 'Tunnel' ] = { P, t1, w };
		return [ ...P( 0, 0, ( t0 + t1 ) / 2 ) ].map( ( v, i ) => i === 1 ? 0.5 : v );

	}

	// ---------------------------------------------------------------- from the hollow

	// the rooms are closed boxes: their outsides in plain concrete, so the hollow under the seats reads as
	// walls, not a lit ceiling running off
	_outside() {

		const b = new Inside();
		b.room( null );
		const L1 = this.L1, L2 = this.L2;
		const fl = ( p, h ) => [ p[ 0 ], h, p[ 1 ] ];
		for ( const sg of this.segs ) {

			const h = sg.i === 4 ? CC : CL, nOut = [ - sg.nIn[ 0 ], 0, - sg.nIn[ 1 ] ];
			const o = ( p, k ) => [ p[ 0 ] - sg.nIn[ 0 ] * k, p[ 1 ] - sg.nIn[ 1 ] * k ];
			const at = ( s ) => o( [ sg.a[ 0 ] + sg.u[ 0 ] * s, sg.a[ 1 ] + sg.u[ 1 ] * s ], 0.12 );
			const door = this.doors.find( ( q ) => q.si === sg.i );
			const runs = door ? [ [ 0, door.s - 1.1, 0 ], [ door.s + 1.1, sg.len, 0 ], [ door.s - 1.1, door.s + 1.1, 2.4 ] ] : [ [ 0, sg.len, 0 ] ];
			for ( const [ s0, s1, h0 ] of runs ) b.use( 'concrete' ).panel4( fl( at( s0 ), h0 ), fl( at( s1 ), h0 ), fl( at( s1 ), h + 0.3 ), fl( at( s0 ), h + 0.3 ), nOut, 2.0 );
			// the roof over it, up under the risers
			const back = sg.i === 4 ? [ lerp( sg.a, sg.b0, 3.0 / ( D2 - D1 ) ), lerp( sg.c, sg.b1, 3.0 / ( D2 - D1 ) ) ] : [ sg.b0, sg.b1 ];
			b.use( 'concrete' ).panel4( fl( sg.a, h + 0.3 ), fl( sg.c, h + 0.3 ), fl( back[ 1 ], h + 0.3 ), fl( back[ 0 ], h + 0.3 ), [ 0, 1, 0 ], 2.5 );

		}

		for ( const [ p, q ] of [ [ L1[ 0 ], L2[ 0 ] ], [ L1[ L1.length - 1 ], lerp( L1[ L1.length - 1 ], L2[ L2.length - 1 ], 3.0 / ( D2 - D1 ) ) ] ] ) {

			const d = unit( sub( q, p ) ), n = [ - d[ 1 ], 0, d[ 0 ] ];
			for ( const s of [ 1, - 1 ] ) b.use( 'concrete' ).panel4( fl( p, 0 ), fl( q, 0 ), fl( q, CL + 0.3 ), fl( p, CL + 0.3 ), n.map( ( v ) => v * s ), 2.0 );

		}

		{

			const sg = this.corridorSeg, P = this.P( sg );
			const n = [ sg.nIn[ 0 ], 0, sg.nIn[ 1 ] ];
			b.use( 'concrete' ).panel4( P( 0, 0, 3.12 ), P( sg.len, 0, 3.12 ), P( sg.len, CC + 0.3, 3.12 ), P( 0, CC + 0.3, 3.12 ), n, 2.0 );
			b.use( 'concrete' ).panel4( P( sg.len + 0.12, 0, 0 ), P( sg.len + 0.12, 0, 3.12 ), P( sg.len + 0.12, CC + 0.3, 3.12 ), P( sg.len + 0.12, CC + 0.3, 0 ), [ sg.u[ 0 ], 0, sg.u[ 1 ] ], 2.0 );

		}

		const m = b.mesh( insideMaterial( 'under-outside' ), 'under-outside' );
		this.group.add( m );
		this.reach.add( m, [ 0, 1.5, 30 ], 40 );

	}

	// ---------------------------------------------------------------- who's down there

	_people() {

		const r = rnd( 1027 );
		this.cast = new Cast( { parent: this.group, max: 40 } );
		this.tempo = new Tempo( [ this.cast ], { every: 6 } );
		this.who = [];
		const put = ( L, p, face, o = {} ) => {

			const q = this.cast.add( L );
			if ( ! q ) return;
			q.x = p[ 0 ]; q.y = 0; q.z = p[ 2 ];
			q.yaw = yawOf( face );
			q.scale = sizeOf( L, r );
			q.visible = false;
			if ( o.sit ) seat( q.pose, o.sit );
			if ( o.drink ) {

				q.pose.armR = GESTURE.carry[ 1 ].slice();
				q.pose.propR = PROP.beer;

			}

			this.who.push( { p: q, ph: r() * 10, base: { armR: q.pose.armR.slice() } } );

		};

		// the Diamond Club's: a few in the lounge between innings, at the bar mostly
		for ( const s of this.spots ) {

			if ( r() > ( s.bar ? 0.45 : 0.18 ) ) continue;
			const L = dress( r, { poncho: 0 } );
			L.dry = true;
			put( L, s.p, s.face, { sit: s.sit, drink: r() < 0.6 } );

		}

		for ( const st of this.staff || [] ) put( { top: TOP.polo, color: COLOR.black, sleeves: COLOR.black, hat: HAT.none, pants: 3, shoes: 1, skin: Math.floor( r() * 6 ), hair: 1, female: r() < 0.5, hairStyle: 2, build: 1, seed: Math.floor( r() * 65536 ), dry: true }, st.p, st.face );
		// a security man at the corridor's end
		const sg = this.corridorSeg;
		if ( sg ) {

			const P = this.P( sg );
			put( { top: TOP.security, color: COLOR.black, sleeves: COLOR.black, hat: HAT.none, pants: 3, shoes: 1, skin: 4, hair: 0, build: 2, chest: 6, seed: 77, dry: true }, P( sg.len - 1.6, 0, 1.0 ), sg.u.map( ( v ) => - v ) );

		}

		this.cast.bounds = new Sphere( new Vector3( 0, 1, 25 ), 45 );

	}

	update( dt, director, camera ) {

		if ( ! this.reach || ! camera ) return;
		const F = this.field;
		const [ cx, cz ] = F.toField( camera.position.x, camera.position.z );
		const cy = camera.position.y - F.y0;
		// only from under the seats (or the dugouts): from anywhere higher these are inside closed walls
		const under = cy < 4.2;
		const any = this.reach.update( under ? [ cx, cy, cz ] : [ 1e4, 0, 0 ] );
		if ( this.tvs ) this.tvs.visible = this.lounge.visible;
		this.cageGlass.visible = any;
		for ( const w of this.who ) if ( w.p.visible !== any ) {

			w.p.visible = any;
			w.p.fresh = true;

		}

		if ( ! any ) return;
		const sdt = this.tempo.step( dt, camera );
		if ( ! sdt ) return;
		this.time = ( this.time || 0 ) + sdt;
		const t = this.time;
		for ( const w of this.who ) {

			const a = w.p.pose;
			a.headYaw = Math.sin( t * 0.25 + w.ph ) * 0.4;
			a.blink = ( t * 0.3 + w.ph ) % 1 < 0.04 ? 1 : 0;
			a.armR = a.propR && ( t * 0.08 + w.ph ) % 1 < 0.06 ? GESTURE.sip[ 1 ] : w.base.armR;

		}

		this.cast.update();

	}

}
