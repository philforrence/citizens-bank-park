import { Group, Vector3, Sphere } from '../../engine/index.js';
import { offsetPolyline } from '../Bowl.js';
import { FOUL_TERRITORY, DUGOUTS } from '../layout.js';
import { DUGOUT_DEPTH, DUGOUT_WIDTH } from '../Field.js';
import { Cast, PROP, TOP, COLOR, HAT, seat } from './Cast.js';
import { GESTURE, dress, sizeOf } from './Concourse3BKit.js';
import { Tempo } from './Tempo.js';
import { Inside, insideMaterial, frame, Reach, cellUV, rnd, clearGlass, clearGlassMesh, Screens, yawOf, netMaterial } from './inside/Kit.js';

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

		this.material = insideMaterial( 'under-inside', { local: false } ); // ---- FI3: closed rooms: no local light reaches them
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
		const add = ( b, name, centre, r, material = this.material ) => {

			const m = b.mesh( material, name );
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
			// ---- FI3 (C2I-14): the netting in a mesh of its own on the late (transparent) pass, a veil: its
			// twine drawn where it's wider than a pixel, its coverage (an eighth) as a dark grey tint where it
			// isn't (puckfiend 2005: everything in the cages seen through it). It was cut out of the cages'
			// opaque material, a pixel-wide black lattice that crawled with moiré, and its discard turned off
			// the hidden-surface removal for the whole room (SP1); the room's material has none now
			this.nets = new Inside();
			this._cages( b, this.segs[ 0 ] );
			add( b, 'under-cages', mid( this.segs[ 0 ] ), 16 );
			const nm = clearGlassMesh( this.nets, netMaterial(), 'under-nets' );
			this.group.add( nm );
			this.reach.add( nm, mid( this.segs[ 0 ] ), 16 );
			// ---- end FI3

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
		this.cageGlass = clearGlassMesh( this.glassQuads, clearGlass( 'under-cage-glass', 40, 1, { tint: false } ), 'under-cage-glass' );
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
		// ---- FI3 (C2I-10): what hangs in the black: a duct along the room with its grilles, two tracks of spot
		// heads (pompomflipflop: track spots in the black ceiling); the ceiling was a flat black void
		b.use( 'steel' ).box( P, sg.len / 2, CL - 0.22, 3.9, sg.len - 0.4, 0.38, 0.55, [ 'top' ] );
		for ( let s = 2; s < sg.len - 1; s += 4 ) b.use( 'pipeWhite' ).box( P, s, CL - 0.415, 3.9, 0.45, 0.01, 0.35, [ 'top' ] );
		for ( const z of [ 2.2, 5.6 ] ) {

			b.use( 'black' ).box( P, sg.len / 2, CL - 0.03, z + 0.5, sg.len - 0.6, 0.04, 0.04 );
			for ( let s = 1.0; s < sg.len - 0.6; s += 1.6 ) {

				b.use( 'black' ).box( P, s, CL - 0.08, z + 0.5, 0.02, 0.08, 0.02 );
				b.use( 'black' ).cyl( P, s, z + 0.5, CL - 0.24, CL - 0.1, 0.05, 0.045, 8, true );
				b.use( 'lamp' ).cyl( P, s, z + 0.5, CL - 0.245, CL - 0.24, 0.0, 0.045, 8, false );

			}

		}
		// ---- end FI3
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
			// ---- FI3 (C2I-10): a tall back channel-tufted in horizontal rolls of glossy red leather, two seat
			// cushions (pompomflipflop, Mar 2008); they were plain red boxes
			b.use( 'leather' ).box( P, s, 0.2, 0.65, 2.2, 0.4, 0.6 );
			for ( const sx of [ - 0.545, 0.545 ] ) b.use( 'leather' ).box( P, s + sx, 0.45, 0.66, 1.07, 0.1, 0.56 );
			for ( let k = 0; k < 6; k ++ ) {

				b.use( 'leather' ).box( P, s, 0.5 + k * 0.135 + 0.06, 0.2 - k * 0.012, 2.2, 0.115, 0.24 );
				b.use( 'black' ).box( P, s, 0.5 + k * 0.135 + 0.125, 0.19 - k * 0.012, 2.18, 0.02, 0.22 );

			}
			// ---- end FI3
			b.use( 'black' ).cyl( P, s, 1.45, 0.0, 0.52, 0.05, 0.05, 6, false );
			b.use( 'granite' ).cyl( P, s, 1.45, 0.52, 0.56, 0.38, 0.38, 12, true );
			this.spots.push( { p: P( s - 0.5, 0, 0.75 ), face: sg.nIn, sit: 0.46, room: 'lounge' } );
			this.spots.push( { p: P( s + 0.5, 0, 0.75 ), face: sg.nIn, sit: 0.46, room: 'lounge' } );

		}

		// the back wall: black, the frosted panels along it
		this._face( b, [ sg.b1[ 0 ], sg.b1[ 1 ] ], [ sg.b0[ 0 ], sg.b0[ 1 ] ], 0, CL, nOut, 'blackPaint', 1.0 );
		// the high-tops with their black woven chairs
		for ( let s = 2.2; s < sg.len - 1.5; s += 3.6 ) {

			const z = home ? 6.5 : 5.4; // (---- FI3 (C2I-10): behind home, close to the bar, as in harpo42's photo: it was 4.4)
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
		// ---- FI3 (C2I-10): the back panels (harpo42, Aug 2008): dark, columns of names in white and a great
		// figure glowing in each (they were blank blue-white rectangles); in front of them the bar's working
		// kit: two frozen-drink machines churning, rows of bottles, the registers, a cooler's lit doors
		let pk = 0;
		for ( let x = sc - L / 2; x < sc + L / 2; x += 1.6 ) {

			const r = cellUV( 'loungePanel', pk ++ % 2, 2, 1 );
			b.use( 'printLit' ).quad( P( x + 0.05, 1.05, depth - 0.02 ), P( x + 1.55, 1.05, depth - 0.02 ), P( x + 1.55, 2.55, depth - 0.02 ), P( x + 0.05, 2.55, depth - 0.02 ), nOut, [ [ r[ 0 ], r[ 3 ] ], [ r[ 2 ], r[ 3 ] ], [ r[ 2 ], r[ 1 ] ], [ r[ 0 ], r[ 1 ] ] ] );
			b.use( 'black' ).box( P, x, 1.8, depth - 0.04, 0.06, 1.6, 0.04 );

		}

		b.use( 'fridge' ).box( P, sc + L / 2 - 0.5, 1.6, depth - 0.15, 0.8, 1.2, 0.02 );
		for ( const x of [ sc - L / 2 + 0.6, sc - L / 2 + 1.2 ] ) {

			b.use( 'stainless' ).box( P, x, 1.25, zb - 0.1, 0.5, 0.6, 0.4 );
			b.use( x < sc - L / 2 + 1 ? 'barGlow' : 'frost' ).box( P, x, 1.35, zb - 0.305, 0.36, 0.3, 0.01 );

		}

		const br = rnd( 2008 );
		for ( let x = sc - L / 2 + 1.8; x < sc + L / 2 - 1.2; x += 0.1 + br() * 0.05 ) {

			if ( Math.abs( x - sc ) < 0.6 ) continue;
			const k = br(), ht = 0.22 + br() * 0.1;
			b.use( k < 0.35 ? 'bottleGreen' : k < 0.7 ? 'bottleAmber' : 'bottleClear' ).cyl( P, x, zb - 0.05, 0.96, 0.96 + ht * 0.7, 0.035, 0.035, 6, false );
			b.cyl( P, x, zb - 0.05, 0.96 + ht * 0.7, 0.96 + ht, 0.035, 0.012, 6, true );

		}

		for ( const x of [ sc - 3, sc + 2.5 ] ) {

			b.use( 'plastic' ).box( P, x, 1.02, zb - 0.15, 0.4, 0.12, 0.3 );
			b.use( 'screen' ).quad( P( x + 0.15, 1.1, zb - 0.32 ), P( x - 0.15, 1.1, zb - 0.32 ), P( x - 0.15, 1.3, zb - 0.28 ), P( x + 0.15, 1.3, zb - 0.28 ), nOut );

		}
		// ---- end FI3
		// the sign, the TVs, the soffit
		// (read from the room: its left is the - u side)
		b.use( 'printLit' ).print( P( sc - 1.3, 2.4, depth - 0.03 ), P( sc + 1.3, 2.4, depth - 0.03 ), P( sc + 1.3, 3.05, depth - 0.03 ), P( sc - 1.3, 3.05, depth - 0.03 ), nOut, cellUV( 'diamondSign' ) );
		for ( const x of [ - 4.5, - 1.8, 1.8, 4.5 ].map( ( v ) => sc + v ) ) {

			if ( Math.abs( x - sc ) < 2 ) continue;
			b.use( 'black' ).box( P, x, 2.62, depth - 0.12, 1.0, 0.6, 0.08 );
			this.screens.add( b, P( x - 0.47, 2.34, depth - 0.161 ), P( x + 0.47, 2.34, depth - 0.161 ), P( x + 0.47, 2.9, depth - 0.161 ), P( x - 0.47, 2.9, depth - 0.161 ), nOut );

		}

		b.use( 'redPaint' ).box( P, sc, CL - 0.22, zc + 0.3, L + 2, 0.44, 2.4, [ 'top' ] );
		// ---- FI3 (C2I-10): the soffit's curved ends; over the bar's front a line of pale elliptical discs,
		// each with its downlights (harpo42: the room's ceiling is black, but full of things the light catches)
		for ( const sx of [ - 1, 1 ] ) b.use( 'redPaint' ).cyl( P, sc + sx * ( L / 2 + 1 ), zc + 0.3, CL - 0.44, CL, 1.2, 1.2, 16, false );
		for ( const sx of [ - 1, 1 ] ) b.use( 'redPaint' ).cyl( P, sc + sx * ( L / 2 + 1 ), zc + 0.3, CL - 0.441, CL - 0.44, 0.0, 1.2, 16, false );
		for ( let k = 0; k < 7; k ++ ) {

			const x = sc - 4.5 + k * 1.5;
			b.use( 'cream' ).cyl( P, x, zc - 1.3, CL - 0.32, CL - 0.3, 0.62, 0.62, 14, false );
			b.use( 'cream' ).cyl( P, x, zc - 1.3, CL - 0.321, CL - 0.32, 0.0, 0.62, 14, false );
			b.use( 'black' ).box( P, x, CL - 0.15, zc - 1.3, 0.02, 0.3, 0.02 );
			for ( const dx of [ - 0.25, 0.25 ] ) b.use( 'can' ).box( P, x + dx, CL - 0.325, zc - 1.3, 0.1, 0.008, 0.1, [ 'top' ] );

		}
		// ---- end FI3
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

				this.nets.quad( a, bb, c, d, n ); // ---- FI3 (C2I-14): into the netting's own see-through mesh

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
			this.nets.quad( P( xm + 1.6, 0, zc - 0.6 ), P( xm + 1.6, 0, zc + 0.6 ), P( xm + 1.6, 2.0, zc + 0.6 ), P( xm + 1.6, 2.0, zc - 0.6 ), [ sg.u[ 0 ], 0, sg.u[ 1 ] ] );
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
		// ---- FI3 (C2I-11): the bat rack: a dark frame on the wall, its rails and slots, the bats standing in it
		// knob up, their barrels down in the tray (ash, maple, black); the batting helmets on the shelf over it,
		// glossy domes with one ear flap and a short bill to the front, as they're left, a few turned bill-in.
		// (The rack was a row of honey slabs, a wooden comb; the helmets bowler hats: a brim all round.)
		const r = rnd( side === 'first' ? 11 : 13 );
		const sd = side === 'first' ? 1 : - 1, xw = sd * ( w / 2 - 0.2 );
		const rk0 = t0 + 0.75, rk1 = t0 + 0.75 + 14 * 0.12, fr = floor( ( rk0 + rk1 ) / 2 );
		for ( const [ y, h ] of [ [ 0.06, 0.12 ], [ 0.62, 0.05 ], [ 0.95, 0.04 ] ] ) b.use( 'black' ).box( P, xw, fr + y, ( rk0 + rk1 ) / 2, 0.34, h, rk1 - rk0 );
		for ( let k = 0; k <= 14; k ++ ) b.use( 'black' ).box( P, xw, fr + 0.5, rk0 + k * 0.12, 0.3, 1.0, 0.012 );
		for ( let k = 0; k < 14; k ++ ) {

			if ( r() < 0.12 ) continue; // (a bat out: in the dugout)
			const t = rk0 + 0.06 + k * 0.12, c = r();
			const pal = c < 0.5 ? 'honey' : c < 0.78 ? 'black' : 'oak';
			b.use( pal ).cyl( P, xw + sd * 0.02, t, fr + 0.12, fr + 0.62, 0.033, 0.03, 7, false );
			b.cyl( P, xw + sd * 0.02, t, fr + 0.62, fr + 0.95, 0.03, 0.013, 7, false );
			b.cyl( P, xw + sd * 0.02, t, fr + 0.95, fr + 0.97, 0.022, 0.022, 7, true );
			b.use( 'black' ).box( P, xw + sd * 0.02, fr + 0.88, t, 0.03, 0.05, 0.03 ); // (the grip's tape)

		}

		const shelf = floor( t0 + 1.6 ) + 1.3;
		b.use( 'black' ).box( P, xw, shelf, t0 + 1.62, 0.36, 0.03, 1.7 );
		for ( let k = 0; k < 6; k ++ ) {

			const t = t0 + 0.95 + k * 0.27, fwd = P.dir( - sd, 0, 0 ), bk = r() < 0.25;
			// (the helmet's own frame: its bill to + z, out into the tunnel or back to the wall)
			const f2 = bk ? [ - fwd[ 0 ], - fwd[ 2 ] ] : [ fwd[ 0 ], fwd[ 2 ] ];
			const H = frame( P( xw, shelf + 0.015, t ), [ f2[ 1 ], - f2[ 0 ] ], f2 );
			this._helmet( b, H, side === 'first' ? 'helmetRed' : 'helmetNavy', r() < 0.5 );

		}
		// ---- end FI3
		// where it meets the room behind: a doorway in the room's front wall
		this[ side + 'Tunnel' ] = { P, t1, w };
		return [ ...P( 0, 0, ( t0 + t1 ) / 2 ) ].map( ( v, i ) => i === 1 ? 0.5 : v );

	}

	// ---- FI3 (C2I-11): a batting helmet sitting on its rim (H: its frame, the bill to + z): the dome in
	// bands, rounder than a head and dropping lower at the back, the ear flap on one side (left or right
	// handed), the short bill, the vent holes on the crown
	_helmet( b, H, pal, left ) {

		const bands = [ [ 0, 0.035, 0.122, 0.124 ], [ 0.035, 0.075, 0.124, 0.115 ], [ 0.075, 0.105, 0.115, 0.093 ], [ 0.105, 0.125, 0.093, 0.062 ], [ 0.125, 0.137, 0.062, 0.02 ] ];
		b.use( pal );
		for ( const [ y0, y1, r0, r1 ] of bands ) b.cyl( H, 0, - 0.01, y0, y1, r0, r1, 12, y1 > 0.13 );
		// the back, down over the neck; the ear flap; the bill
		b.box( H, 0, - 0.012, - 0.095, 0.16, 0.05, 0.05, [ 'top' ] );
		b.box( H, left ? - 0.11 : 0.11, - 0.035, 0.02, 0.03, 0.08, 0.12 );
		b.box( H, 0, 0.012, 0.135, 0.17, 0.012, 0.07 );
		b.use( 'black' ).box( H, 0, 0.02, 0.115, 0.17, 0.02, 0.012 );
		for ( const x of [ - 0.035, 0.035 ] ) b.use( 'black' ).box( H, x, 0.133, 0.0, 0.012, 0.01, 0.035 );

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
		this._hollow(); // ---- FI3 (C2I-19)

	}

	// ---- FI3 (C2I-19): the hollow round the rooms is storage, as the space under the seats is: behind the
	// third base corridor and beyond the cages, under a couple of caged work lights, the stadium's things
	// (common sense: no photo): cages of folding chairs, a golf cart on charge, pallets of cups and napkins
	// shrink-wrapped, kegs, a stack of crowd barriers; it was a vast empty dark hall
	_hollow() {

		const b = new Inside(), r = rnd( 2004 );
		const spots = [];
		const sgC = this.corridorSeg, sgK = this.cageSeg;
		if ( sgC ) for ( const s of [ 4, 11, 18 ] ) if ( s < sgC.len - 2 ) spots.push( [ sgC, s, 5.0 ] );
		if ( sgK ) for ( const s of [ 3, 9 ] ) if ( s < sgK.len - 2 ) spots.push( [ sgK, s, D2 - D1 + 0.8 ] );
		const lamps = spots.map( ( [ sg, s, z ] ) => [ ...this.P( sg, s )( 0, 2.6, z ), 1.4, 'omni', 2.5 ] );
		b.room( { lamps, amb: 0.05, bounce: 0.05 } );
		spots.forEach( ( [ sg, s, z ], k ) => {

			const P = this.P( sg, s ), kind = k % 5;
			// the work light in its cage on a conduit drop
			b.use( 'steel' ).box( P, 0, 2.85, z, 0.02, 0.5, 0.02 );
			b.use( 'lamp' ).cyl( P, 0, z, 2.5, 2.6, 0.07, 0.07, 8, true );
			if ( kind === 0 ) {

				// a cage of folding chairs on its dolly
				b.use( 'steel' ).box( P, 0, 0.05, z, 1.2, 0.1, 0.9 );
				for ( let i = 0; i < 18; i ++ ) b.use( i % 3 ? 'cmu' : 'steel' ).box( P, - 0.5 + i * 0.058, 0.62, z, 0.035, 0.95, 0.78 );
				for ( const [ dx, dz ] of [ [ - 0.6, - 0.45 ], [ 0.6, - 0.45 ], [ - 0.6, 0.45 ], [ 0.6, 0.45 ] ] ) b.use( 'steel' ).box( P, dx, 0.7, z + dz, 0.03, 1.3, 0.03 );

			} else if ( kind === 1 ) {

				// a golf cart, plugged in
				b.use( 'white' ).box( P, 0, 0.55, z, 1.2, 0.5, 2.3 );
				b.use( 'black' ).box( P, 0, 0.85, z + 0.2, 1.1, 0.12, 0.6 );
				b.use( 'black' ).box( P, 0, 1.1, z + 0.45, 1.1, 0.5, 0.1 );
				b.use( 'white' ).box( P, 0, 1.95, z, 1.25, 0.06, 1.6 );
				for ( const [ dx, dz ] of [ [ - 0.55, - 0.7 ], [ 0.55, - 0.7 ], [ - 0.55, 0.7 ], [ 0.55, 0.7 ] ] ) {

					b.use( 'steel' ).box( P, dx, 1.35, z + dz, 0.04, 1.2, 0.04 );
					b.use( 'black' ).box( P, dx * 1.05, 0.22, z + dz * 1.2, 0.18, 0.44, 0.44 );

				}

				b.use( 'black' ).box( P, 0.62, 0.9, z - 1.0, 0.02, 1.8, 0.02 );

			} else if ( kind === 2 ) {

				// pallets of cups and napkins, shrink-wrapped
				for ( const dx of [ - 0.6, 0.6 ] ) {

					b.use( 'oak' ).box( P, dx, 0.07, z, 1.1, 0.14, 1.1 );
					const n = 3 + Math.floor( r() * 3 );
					for ( let j = 0; j < n; j ++ ) for ( const [ ex, ez ] of [ [ - 0.27, - 0.27 ], [ 0.27, - 0.27 ], [ - 0.27, 0.27 ], [ 0.27, 0.27 ] ] ) b.use( 'paper' ).box( P, dx + ex, 0.3 + j * 0.34, z + ez, 0.52, 0.32, 0.52 );
					b.use( 'glass' ).box( P, dx, 0.14 + n * 0.17, z, 1.12, n * 0.34 + 0.02, 1.12, [ 'bottom' ] );

				}

			} else if ( kind === 3 ) {

				// kegs, two high
				for ( let i = 0; i < 6; i ++ ) b.use( 'canSilver' ).cyl( P, - 0.8 + ( i % 3 ) * 0.45, z + ( i < 3 ? - 0.25 : 0.25 ), 0, 0.6, 0.2, 0.2, 10, true );
				for ( let i = 0; i < 3; i ++ ) b.use( 'canSilver' ).cyl( P, - 0.8 + i * 0.45, z - 0.25, 0.6, 1.2, 0.2, 0.2, 10, true );

			} else {

				// the crowd barriers, stacked on their sides
				for ( let i = 0; i < 8; i ++ ) {

					const h = 0.1 + i * 0.12;
					b.use( 'steel' ).box( P, 0, h, z, 2.4, 0.03, 0.03 );
					b.use( 'steel' ).box( P, 0, h, z + 1.1, 2.4, 0.03, 0.03 );
					for ( let j = 0; j < 9; j ++ ) b.use( 'steel' ).box( P, - 1.1 + j * 0.275, h, z + 0.55, 0.02, 0.02, 1.1 );

				}

			}

		} );
		if ( ! b.count ) return;
		const m = b.mesh( this.material, 'under-hollow' );
		this.group.add( m );
		this.reach.add( m, [ 0, 1.5, 30 ], 40 );

	}
	// ---- end FI3

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
