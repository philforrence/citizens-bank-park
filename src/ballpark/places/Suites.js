import { Group, Mesh, Vector3, Sphere, BufferGeometry, Float32BufferAttribute } from '../../engine/index.js';
import { commonModule } from '../../engine/render/wgsl/common.js';
import { standard } from '../../materials/Materials.js';
import { offsetPolyline } from '../Bowl.js';
import { LEVELS } from '../layout.js';
import { Cast, PROP, seat } from './Cast.js';
import { Walkway, GESTURE, dress, sizeOf } from './Concourse3BKit.js';
import { nightState } from './Concourse3BPeople.js';
import { Tempo } from './Tempo.js';
import { Inside, insideMaterial, frame, Reach, cellUV, rnd, glassSplit, clearGlass, clearGlassMesh, interiorsModule, GLASS_UNIFORMS, backFrom } from './inside/Kit.js';

// FI2 (gauntlet CI-5): the suites, the row of private boxes behind the glass round the infield at the
// suite level, as they were in 2008, built to be walked into. Each is a room two panes wide behind the
// glass (6-7.5 m), 4.4 m deep, its walls in striped wallpaper over a honey-wood wainscot, dark patterned
// carpet, a white ceiling with cans; along the back the cherry cabinets to the ceiling with the old tube TV
// in its niche, the granite counter and the lit glass behind it, the drinks fridge under it; a granite
// buffet down one side with the chafing dishes, a flat TV on the other wall with the game on it; a
// high-top and its honey-wood barstools with red seats; the wood door to the corridor (Ernst & Young's
// suite, April 2009, unchanged since 2004). Behind them the corridor: the red-and-charcoal block carpet,
// the acoustic grid ceiling and its cans, grey-green walls with the photo murals, each suite's door and its
// home-plate number plaque (harpo42, 2010; greenheaps, Aug 2008), and the elevators (the bowl's car stood
// in a suite: it's in the corridor now). The corridor's outer wall is FI1's brick (the walkway along it,
// ConcourseSteel._mezzanine).
//
// On a World Series night a party in most of them, a few dark and empty; seen from the field and the
// seats the glass shows them traced (interior mapping: the rooms, their lamps, the people as planes), and
// within ~25 m of the camera it's clear glass with the rooms and their people really there.
//
// What it does to the bowl, at build time (Bowl.js untouched): hides `suite-glass` and `suite-frame` (the
// glass, mullions, band and slabs are built here) and the suite level's elevator slab, and moves the
// walker's suite stop into the corridor.
//
// Field frame. y up from the field; the suite level's floor is LEVELS.suites.

const DROOM = 4.4; // the glass to the suite's back wall
const WALL = 0.14; // the back wall's thickness
const RH = 2.7; // a suite's ceiling over its floor (the glass's top)
const CH = 2.6; // the corridor's
const NEAR = 24, BAND = 6; // the glass is clear within NEAR m of the camera (a dithered band beyond), traced past it
const R_HALF = 0.06; // half a partition

// a few 2D helpers ([ x, z ] in the field frame)
const sub = ( a, b ) => [ a[ 0 ] - b[ 0 ], a[ 1 ] - b[ 1 ] ];
const dot = ( a, b ) => a[ 0 ] * b[ 0 ] + a[ 1 ] * b[ 1 ];
const lerp = ( a, b, t ) => [ a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * t, a[ 1 ] + ( b[ 1 ] - a[ 1 ] ) * t ];
const along = ( a, v, s ) => [ a[ 0 ] + v[ 0 ] * s, a[ 1 ] + v[ 1 ] * s ];
const unit = ( v ) => {

	const l = Math.hypot( v[ 0 ], v[ 1 ] ) || 1;
	return [ v[ 0 ] / l, v[ 1 ] / l ];

};

export default class Suites {

	constructor( { app, field, bowl, colliders } ) {

		this.app = app;
		this.field = field;
		this.bowl = bowl;
		this.colliders = colliders;
		this.group = new Group();
		this.group.name = 'suites';
		if ( ! bowl?.D || ! bowl.path ) return;
		const D = bowl.D, infield = bowl.path.slice( 2, 10 );
		const y = this.y = LEVELS.suites;
		const clubY = LEVELS.clubConcourse - 7 * 0.46 - 0.2;
		this.yTop = clubY - 1.2; // the slab over the suites (the club's seats stand on it)
		const d0 = D.suites + 2 * 0.95, dIn = d0 + 7;
		const line = ( d ) => offsetPolyline( infield, d, [ 0, - 40 ] );
		this.A = line( d0 ); this.W = line( d0 + DROOM ); this.W2 = line( d0 + DROOM + WALL ); this.BC = line( dIn - 0.03 ); this.B = line( dIn );
		this.CM = line( d0 + DROOM + WALL + ( 7 - DROOM - WALL - 0.03 ) / 2 ); // the corridor's middle

		this.material = insideMaterial( 'suites-inside' );
		this._layout();
		this._liftSpots();
		this._findTV();
		// one mesh of rooms (and their stretch of corridor) per side of the polyline, each drawn only while
		// the camera's within reach of its glass
		this.reach = new Reach( NEAR + BAND + 2 );
		this.tvQuads = { pos: [], nrm: [], uv: [] };
		for ( let i = 0; i < this.A.length - 1; i ++ ) {

			const b = new Inside();
			for ( const R of this.rooms.filter( ( q ) => q.i === i ) ) this._room( b, R );
			this._corridor( b, i );
			const m = b.mesh( this.material, `suites-${ i }` );
			this.group.add( m );
			const c = lerp( lerp( this.A[ i ], this.A[ i + 1 ], 0.5 ), lerp( this.B[ i ], this.B[ i + 1 ], 0.5 ), 0.5 );
			const r = Math.hypot( this.B[ i + 1 ][ 0 ] - this.B[ i ][ 0 ], this.B[ i + 1 ][ 1 ] - this.B[ i ][ 1 ] ) / 2 + 4;
			this.reach.add( m, [ c[ 0 ], y + 1.4, c[ 1 ] ], r );
			for ( const R of this.rooms.filter( ( q ) => q.i === i ) ) R.chunk = this.reach.items[ this.reach.items.length - 1 ];

		}

		this._tvMesh();
		this._shell();
		this._glass();
		this._colliders();
		// the bowl's own glass, frame and slabs (what's built here takes their place)
		bowl.group.traverse( ( o ) => {

			if ( o.isMesh && ( o.name === 'suite-glass' || o.name === 'suite-frame' ) ) o.visible = false;

		} );
		this._people();

	}

	// ---------------------------------------------------------------- the plan

	// the rooms: each side of the polyline cut into suites about two panes (6.4 m) wide; the partitions
	// between them square to the glass, the ones at the corners on the mitre
	_layout() {

		const A = this.A, W = this.W, W2 = this.W2;
		const r = rnd( 20081029 );
		this.rooms = [];
		this.segs = [];
		let num = 0;
		for ( let i = 0; i < A.length - 1; i ++ ) {

			const len = Math.hypot( A[ i + 1 ][ 0 ] - A[ i ][ 0 ], A[ i + 1 ][ 1 ] - A[ i ][ 1 ] );
			const u = unit( sub( A[ i + 1 ], A[ i ] ) );
			let nIn = [ - u[ 1 ], u[ 0 ] ];
			const mid = lerp( A[ i ], A[ i + 1 ], 0.5 );
			if ( dot( nIn, sub( mid, [ 0, - 40 ] ) ) < 0 ) nIn = [ - nIn[ 0 ], - nIn[ 1 ] ];
			const n = Math.max( 2, Math.round( len / 6.4 ) );
			this.segs.push( { u, nIn, len, n } );
			for ( let k = 0; k < n; k ++ ) {

				const G0 = lerp( A[ i ], A[ i + 1 ], k / n ), G1 = lerp( A[ i ], A[ i + 1 ], ( k + 1 ) / n );
				const K0 = k === 0 ? W[ i ] : along( G0, nIn, DROOM ), K1 = k === n - 1 ? W[ i + 1 ] : along( G1, nIn, DROOM );
				const C0 = k === 0 ? W2[ i ] : along( G0, nIn, DROOM + WALL ), C1 = k === n - 1 ? W2[ i + 1 ] : along( G1, nIn, DROOM + WALL );
				const O = lerp( G0, G1, 0.5 );
				const hw = len / n / 2;
				// a few dark and empty; the rest lit, most with a party in them
				const lit = r() > 0.17;
				const party = lit ? ( r() < 0.12 ? 0 : 0.35 + 0.65 * r() ) : 0;
				const R = {
					i, k, n, G0, G1, K0, K1, C0, C1, O, u, nIn, hw, lit, party, num: num ++, seed: r(),
					P: frame( [ O[ 0 ], this.y, O[ 1 ] ], u, nIn ),
					loc: ( p ) => [ dot( sub( p, O ), u ), dot( sub( p, O ), nIn ) ],
					open: r() < 0.55, // its door into the corridor open
				};
				R.xl0 = - hw; R.xr0 = hw;
				R.xl1 = R.loc( K0 )[ 0 ]; R.xr1 = R.loc( K1 )[ 0 ];
				R.xl = ( z ) => R.xl0 + ( R.xl1 - R.xl0 ) * z / DROOM + R_HALF;
				R.xr = ( z ) => R.xr0 + ( R.xr1 - R.xr0 ) * z / DROOM - R_HALF;
				// the buffet down a partition between suites (square), the TV on the other wall
				R.buffetLeft = k > 0 && ( k === n - 1 || r() < 0.5 );
				// the door at the other end of the back wall from the buffet's
				R.door = R.buffetLeft ? [ R.xr1 - 1.35, R.xr1 - 0.4 ] : [ R.xl1 + 0.4, R.xl1 + 1.35 ];
				this.rooms.push( R );

			}

		}

	}

	// the broadcast for the TVs (W2's LiveTV, if the concourse is built)
	_findTV() {

		this.tvMat = null;
		for ( const p of this.app?.places || [] ) {

			if ( this.tvMat ) break;
			if ( p.tvMat ) this.tvMat = p.tvMat;
			p.group?.traverse( ( o ) => {

				if ( ! this.tvMat && o.isMesh && o.material?.name === 'concourse3b-tv' ) this.tvMat = o.material;

			} );

		}

	}

	// a TV's picture: a quad on a face (corners a, b, c, d: bottom left, bottom right, top right, top left)
	_screen( b, a, bb, c, d, n, lit ) {

		if ( this.tvMat && lit ) {

			const T = this.tvQuads;
			const tri = ( p, q, s, uvs ) => {

				T.pos.push( ...p, ...q, ...s );
				for ( let k = 0; k < 3; k ++ ) T.nrm.push( ...n );
				T.uv.push( ...uvs );

			};
			// (lifted off the face a little: no fighting with what it's on)
			const lift = ( p ) => [ p[ 0 ] + n[ 0 ] * 0.004, p[ 1 ] + n[ 1 ] * 0.004, p[ 2 ] + n[ 2 ] * 0.004 ];
			tri( lift( a ), lift( bb ), lift( c ), [ 0, 1, 1, 1, 1, 0 ] );
			tri( lift( a ), lift( c ), lift( d ), [ 0, 1, 1, 0, 0, 0 ] );

		} else b.use( lit ? 'screen' : 'plastic' ).quad( a, bb, c, d, n, [ [ 0, 0 ], [ 1, 0 ], [ 1, 1 ], [ 0, 1 ] ] );

	}

	_tvMesh() {

		if ( ! this.tvMat || ! this.tvQuads.pos.length ) return;
		const g = new BufferGeometry();
		g.setAttribute( 'position', new Float32BufferAttribute( this.tvQuads.pos, 3 ) );
		g.setAttribute( 'normal', new Float32BufferAttribute( this.tvQuads.nrm, 3 ) );
		g.setAttribute( 'uv', new Float32BufferAttribute( this.tvQuads.uv, 2 ) );
		g.computeBoundingBox();
		g.computeBoundingSphere();
		const m = this.tvs = new Mesh( g, this.tvMat );
		m.name = 'suites-tvs';
		m.userData.dynamic = true;
		m.visible = false;
		this.group.add( m );

	}

	// ---------------------------------------------------------------- a suite

	_room( b, R ) {

		const y = this.y, P = R.P;
		const F = ( x, h, z ) => P( x, h, z );
		const dirF = ( x, z ) => {

			const d = P.dir( x, 0, z ), l = Math.hypot( d[ 0 ], d[ 2 ] ) || 1;
			return [ d[ 0 ] / l, 0, d[ 2 ] / l ];

		};
		// its lamps: two rows of cans across
		const lamps = [];
		for ( const z of [ 1.15, 3.1 ] ) for ( const t of [ - 0.55, 0, 0.55 ] ) {

			const x = ( R.xl( z ) + R.xr( z ) ) / 2 + t * ( R.xr( z ) - R.xl( z ) ) / 2;
			lamps.push( [ ...F( x, RH - 0.03, z ), 1.25 ] );

		}

		b.room( { lamps, amb: 0.1, on: R.lit ? 1 : 0.04 } );
		const uvLocal = ( p ) => {

			const l = R.loc( [ p[ 0 ], p[ 2 ] ] );
			return [ l[ 0 ], l[ 1 ] ];

		};
		// the carpet and the ceiling
		const g0 = F( R.xl( 0 ), 0.004, 0.02 ), g1 = F( R.xr( 0 ), 0.004, 0.02 ), k1 = F( R.xr( DROOM ), 0.004, DROOM ), k0 = F( R.xl( DROOM ), 0.004, DROOM );
		b.use( 'carpet' ).panel4( g0, g1, k1, k0, [ 0, 1, 0 ], 0.7, uvLocal );
		const up = ( p, h ) => [ p[ 0 ], y + h, p[ 2 ] ];
		b.use( 'drywall' ).panel4( up( g0, RH ), up( g1, RH ), up( k1, RH ), up( k0, RH ), [ 0, - 1, 0 ], 0.8, uvLocal );
		for ( const l of lamps ) {

			const L = frame( [ l[ 0 ], l[ 1 ], l[ 2 ] ], R.u, R.nIn );
			b.use( R.lit ? 'can' : 'white' ).box( L, 0, 0.012, 0, 0.17, 0.01, 0.17, [ 'top' ] );
			b.use( 'white' ).box( L, 0, 0.018, 0, 0.22, 0.008, 0.22, [ 'top' ] );

		}

		// the side walls: wallpaper over a honey wainscot, the chair rail
		for ( const side of [ - 1, 1 ] ) {

			const xs = side < 0 ? R.xl : R.xr;
			const a0 = F( xs( 0 ), 0, 0 ), a1 = F( xs( DROOM ), 0, DROOM );
			const wd = [ a1[ 0 ] - a0[ 0 ], 0, a1[ 2 ] - a0[ 2 ] ];
			const wl = Math.hypot( wd[ 0 ], wd[ 2 ] );
			const n = side < 0 ? [ wd[ 2 ] / wl, 0, - wd[ 0 ] / wl ] : [ - wd[ 2 ] / wl, 0, wd[ 0 ] / wl ];
			// (into the room: the side toward the room's middle)
			const toMid = [ R.O[ 0 ] - a0[ 0 ], R.O[ 1 ] - a0[ 2 ] ];
			if ( n[ 0 ] * toMid[ 0 ] + n[ 2 ] * toMid[ 1 ] < 0 ) n.forEach( ( v, j ) => ( n[ j ] = - v ) );
			const at = ( p, h, o = 0 ) => [ p[ 0 ] + n[ 0 ] * o, y + h, p[ 2 ] + n[ 2 ] * o ];
			const uvw = ( p ) => [ Math.hypot( p[ 0 ] - a0[ 0 ], p[ 2 ] - a0[ 2 ] ), p[ 1 ] - y ];
			b.use( 'wallpaper' ).panel4( at( a0, 0.92 ), at( a1, 0.92 ), at( a1, RH ), at( a0, RH ), n, 0.7, uvw );
			b.use( 'honey' ).panel4( at( a0, 0, 0.015 ), at( a1, 0, 0.015 ), at( a1, 0.88, 0.015 ), at( a0, 0.88, 0.015 ), n, 0.9, uvw );
			const W = frame( [ ( a0[ 0 ] + a1[ 0 ] ) / 2, y, ( a0[ 2 ] + a1[ 2 ] ) / 2 ], [ wd[ 0 ] / wl, wd[ 2 ] / wl ], [ n[ 0 ], n[ 2 ] ] );
			b.use( 'cherry' ).box( W, 0, 0.9, 0.03, wl, 0.05, 0.04, [ 'back', 'bottom' ] );
			b.use( 'cherry' ).box( W, 0, 0.05, 0.02, wl, 0.1, 0.02, [ 'back', 'bottom' ] );
			// the buffet down this wall, or the flat TV and a framed picture
			if ( ( side < 0 ) === R.buffetLeft ) this._buffet( b, W, wl, R );
			else {

				const z0 = 2.25 - wl / 2;
				b.use( 'black' ).box( W, z0, 1.76, 0.04, 1.18, 0.7, 0.06, [ 'back' ] );
				const S = ( x, h ) => W( z0 + x, h, 0.072 );
				this._screen( b, S( - 0.55, 1.45 ), S( 0.55, 1.45 ), S( 0.55, 2.07 ), S( - 0.55, 2.07 ), n, R.lit );
				// a framed photo nearer the glass
				const z1 = 0.75 - wl / 2;
				b.use( 'gilt' ).box( W, z1, 1.65, 0.015, 0.62, 0.5, 0.03, [ 'back' ] );
				b.use( 'print' ).print( W( z1 - 0.27, 1.44, 0.032 ), W( z1 + 0.27, 1.44, 0.032 ), W( z1 + 0.27, 1.86, 0.032 ), W( z1 - 0.27, 1.86, 0.032 ), n, cellUV( 'paintings', ( R.num * 3 ) % 8, 8, 1 ) );

			}

		}

		// the back wall, its door, the cabinets along it
		this._backWall( b, R );
		this._cabinets( b, R );
		// a high-top in the middle and its stools
		this._highTop( b, R, dirF );

	}

	// a wall face from p0 to p1 (field [ x, z ]) between heights h0 and h1, its normal n (field 3D), with a
	// hole for a door [ s0, s1 ] metres along it (up to dh)
	_wallWithDoor( b, p0, p1, h0, h1, n, door, dh, pal, uvOff = 0 ) {

		const y = this.y, l = Math.hypot( p1[ 0 ] - p0[ 0 ], p1[ 1 ] - p0[ 1 ] ), u = [ ( p1[ 0 ] - p0[ 0 ] ) / l, ( p1[ 1 ] - p0[ 1 ] ) / l ];
		const at = ( s, h ) => [ p0[ 0 ] + u[ 0 ] * s, y + h, p0[ 1 ] + u[ 1 ] * s ];
		const uvf = ( p ) => [ uvOff + ( p[ 0 ] - p0[ 0 ] ) * u[ 0 ] + ( p[ 2 ] - p0[ 1 ] ) * u[ 1 ], p[ 1 ] - y ];
		const face = ( s0, s1, ha, hb ) => {

			if ( s1 - s0 > 0.01 && hb - ha > 0.01 ) b.use( pal ).panel4( at( s0, ha ), at( s1, ha ), at( s1, hb ), at( s0, hb ), n, 0.8, uvf );

		};
		if ( ! door ) return face( 0, l, h0, h1 );
		face( 0, door[ 0 ], h0, h1 );
		face( door[ 1 ], l, h0, h1 );
		face( door[ 0 ], door[ 1 ], dh, h1 );

	}

	_backWall( b, R ) {

		const y = this.y, P = R.P;
		const nBack = [ - R.nIn[ 0 ], 0, - R.nIn[ 1 ] ]; // the back wall's face, toward the glass
		const xl = R.xl( DROOM ), xr = R.xr( DROOM );
		const p0 = [ P( xl, 0, DROOM )[ 0 ], P( xl, 0, DROOM )[ 2 ] ], p1 = [ P( xr, 0, DROOM )[ 0 ], P( xr, 0, DROOM )[ 2 ] ];
		const ds = [ R.door[ 0 ] - xl, R.door[ 1 ] - xl ];
		this._wallWithDoor( b, p0, p1, 0, RH, nBack, ds, 2.13, 'wallpaper' );
		// the jambs through the wall, the head, the frame's casing on both faces
		const J = frame( [ P( 0, 0, DROOM + WALL / 2 )[ 0 ], y, P( 0, 0, DROOM + WALL / 2 )[ 2 ] ], R.u, R.nIn );
		const dc = ( R.door[ 0 ] + R.door[ 1 ] ) / 2, dw = R.door[ 1 ] - R.door[ 0 ];
		b.use( 'cherry' ).box( J, R.door[ 0 ] - 0.04, 1.08, 0, 0.08, 2.16, WALL + 0.04, [ 'bottom' ] );
		b.use( 'cherry' ).box( J, R.door[ 1 ] + 0.04, 1.08, 0, 0.08, 2.16, WALL + 0.04, [ 'bottom' ] );
		b.use( 'cherry' ).box( J, dc, 2.17, 0, dw + 0.16, 0.08, WALL + 0.04 );
		// the door: shut in its frame, or swung open into the room
		if ( R.open ) {

			const hx = R.door[ 0 ] + ( R.buffetLeft ? 0.02 : dw - 0.02 );
			const H = frame( [ P( hx, 0, DROOM - 0.03 )[ 0 ], y, P( hx, 0, DROOM - 0.03 )[ 2 ] ], R.nIn.map( ( v ) => - v ), R.u );
			b.use( 'cherry' ).box( H, dw / 2 * 0.97, 1.05, 0, dw * 0.97, 2.09, 0.045 );
			b.use( 'brass' ).box( H, dw * 0.85, 1.0, 0.05, 0.12, 0.03, 0.04 );

		} else {

			b.use( 'cherry' ).box( J, dc, 1.05, 0, dw, 2.1, 0.045 );
			b.use( 'brass' ).box( J, R.buffetLeft ? R.door[ 0 ] + 0.12 : R.door[ 1 ] - 0.12, 1.0, - 0.05, 0.12, 0.03, 0.06 );

		}

	}

	_cabinets( b, R ) {

		const P = R.P, z = DROOM;
		// from the far wall to the door
		const x0 = R.buffetLeft ? Math.max( R.xl( z ), R.xl( z - 0.6 ) ) + 0.05 : R.door[ 1 ] + 0.25;
		const x1 = R.buffetLeft ? R.door[ 0 ] - 0.25 : Math.min( R.xr( z ), R.xr( z - 0.6 ) ) - 0.05;
		if ( x1 - x0 < 1.6 ) return;
		const w = x1 - x0, xc = ( x0 + x1 ) / 2;
		const nF = [ - R.nIn[ 0 ], 0, - R.nIn[ 1 ] ];
		// the base: cherry, doors on it, the granite top
		b.use( 'cherry' ).box( P, xc, 0.46, z - 0.3, w, 0.8, 0.6, [ 'front', 'back' ] );
		b.use( 'cherry' ).box( P, xc, 0.05, z - 0.27, w, 0.1, 0.54, [ 'back' ] );
		b.use( 'cherry' ).panel4( P( x0, 0.1, z - 0.6 ), P( x1, 0.1, z - 0.6 ), P( x1, 0.86, z - 0.6 ), P( x0, 0.86, z - 0.6 ), nF, 0.5, ( p ) => [ p[ 0 ] * 0.7 + p[ 2 ] * 0.7, p[ 1 ] ] );
		for ( let s = x0 + 0.5; s < x1 - 0.1; s += 0.5 ) b.use( 'black' ).box( P, s, 0.48, z - 0.602, 0.012, 0.7, 0.004 );
		for ( let s = x0 + 0.25; s < x1; s += 0.5 ) b.use( 'chrome' ).box( P, s + 0.15, 0.74, z - 0.615, 0.02, 0.1, 0.025 );
		// the drinks fridge at one end: its glass door lit
		const fx = R.buffetLeft ? x0 + 0.33 : x1 - 0.33;
		b.use( 'stainless' ).box( P, fx, 0.43, z - 0.605, 0.6, 0.78, 0.02 );
		b.use( R.lit ? 'fridge' : 'glass' ).box( P, fx, 0.45, z - 0.617, 0.48, 0.6, 0.005 );
		b.use( 'granite' ).box( P, xc, 0.88, z - 0.31, w + 0.04, 0.04, 0.64 );
		// the lit glass behind the counter, under the uppers
		b.use( R.lit ? 'backsplash' : 'cream' ).quad( P( x0, 0.9, z - 0.004 ), P( x1, 0.9, z - 0.004 ), P( x1, 1.42, z - 0.004 ), P( x0, 1.42, z - 0.004 ), nF );
		// the uppers to the ceiling, the niche for the old tube TV in the middle
		const tv = xc + ( R.buffetLeft ? - 0.2 : 0.2 );
		for ( const [ a, c ] of [ [ x0, tv - 0.45 ], [ tv + 0.45, x1 ] ] ) {

			if ( c - a < 0.2 ) continue;
			b.use( 'cherry' ).box( P, ( a + c ) / 2, ( 1.42 + RH ) / 2, z - 0.18, c - a, RH - 1.42, 0.36, [ 'front' ] );
			for ( let s = a + 0.45; s < c - 0.1; s += 0.45 ) b.use( 'black' ).box( P, s, ( 1.42 + RH ) / 2, z - 0.362, 0.01, RH - 1.5, 0.004 );

		}

		b.use( 'cherry' ).box( P, tv, ( 2.0 + RH ) / 2, z - 0.18, 0.9, RH - 2.0, 0.36, [ 'front' ] );
		b.use( 'cherry' ).box( P, tv, 1.44, z - 0.18, 0.9, 0.04, 0.36 );
		// the TV: a tube in a dark grey case, the game on it
		b.use( 'plastic' ).box( P, tv, 1.7, z - 0.25, 0.64, 0.48, 0.46 );
		this._screen( b, P( tv - 0.25, 1.52, z - 0.481 ), P( tv + 0.25, 1.52, z - 0.481 ), P( tv + 0.25, 1.88, z - 0.481 ), P( tv - 0.25, 1.88, z - 0.481 ), nF, R.lit );
		// on the counter: the ice bucket and its beers, the cans, the paper plates
		const ib = R.buffetLeft ? x1 - 0.5 : x0 + 0.5;
		b.use( 'stainless' ).cyl( P, ib, z - 0.32, 0.9, 1.12, 0.14, 0.17, 10, false );
		b.use( 'white' ).cyl( P, ib, z - 0.32, 1.06, 1.1, 0.15, 0.16, 10, true );
		for ( let j = 0; j < 4; j ++ ) b.use( 'food' ).cyl( P, ib + Math.cos( j * 1.6 ) * 0.07, z - 0.32 + Math.sin( j * 1.6 ) * 0.07, 1.08, 1.2, 0.025, 0.02, 6, true );
		for ( let j = 0; j < 3; j ++ ) b.use( j === 1 ? 'white' : 'redVinyl' ).cyl( P, xc + 0.6 + j * 0.09, z - 0.4, 0.9, 1.02, 0.033, 0.033, 8, true );
		b.use( 'white' ).cyl( P, xc - 0.7, z - 0.35, 0.9, 0.95, 0.12, 0.12, 12, true );

	}

	// the buffet down a side wall (W: the wall's frame, x along it from its middle, z into the room)
	_buffet( b, W, wl, R ) {

		const z0 = - wl / 2 + 0.85, z1 = wl / 2 - 0.95;
		const L = z1 - z0, c = ( z0 + z1 ) / 2;
		b.use( 'cherry' ).box( W, c, 0.44, 0.31, L, 0.8, 0.6, [ 'back' ] );
		b.use( 'cherry' ).box( W, c, 0.05, 0.3, L - 0.04, 0.1, 0.55, [ 'back' ] );
		b.use( 'granite' ).box( W, c, 0.86, 0.32, L + 0.04, 0.04, 0.66 );
		for ( let s = z0 + 0.55; s < z1; s += 0.55 ) b.use( 'black' ).box( W, s, 0.44, 0.612, 0.012, 0.7, 0.004 );
		// the chafing dishes, their domed lids; the plates, the napkins
		const n = Math.max( 2, Math.floor( L / 0.7 ) );
		for ( let j = 0; j < n; j ++ ) {

			const s = z0 + ( j + 0.5 ) * L / n;
			// the stand, the pan (its lid on, or off and the food showing), the burner's glow under it
			b.use( 'black' ).box( W, s, 0.93, 0.32, 0.46, 0.08, 0.28 );
			b.use( 'stainless' ).box( W, s, 0.99, 0.32, 0.52, 0.05, 0.34 );
			if ( R.lit && j % 2 === 0 ) {

				b.use( 'stainless' ).cyl( W, s, 0.32, 1.015, 1.06, 0.17, 0.12, 12, false );
				b.use( 'stainless' ).cyl( W, s, 0.32, 1.06, 1.09, 0.12, 0.03, 12, true );

			} else b.use( 'food' ).box( W, s, 1.017, 0.32, 0.46, 0.01, 0.28 );

		}

		b.use( 'white' ).cyl( W, z1 + 0.25, 0.3, 0.88, 0.99, 0.13, 0.13, 12, true );
		b.use( 'redVinyl' ).box( W, z1 + 0.25, 0.9, 0.52, 0.18, 0.03, 0.14 );

	}

	// the high-top and four stools round it
	_highTop( b, R, dirF ) {

		const P = R.P, z = 2.0;
		const x = ( R.xl( z ) + R.xr( z ) ) / 2 + ( R.buffetLeft ? 0.35 : - 0.35 );
		b.use( 'granite' ).cyl( P, x, z, 1.02, 1.06, 0.48, 0.48, 16, true );
		b.use( 'black' ).cyl( P, x, z, 0.06, 1.02, 0.05, 0.05, 8, false );
		b.use( 'black' ).cyl( P, x, z, 0.0, 0.05, 0.3, 0.28, 12, true );
		R.stools = [];
		for ( let j = 0; j < 4; j ++ ) {

			const a = j * Math.PI / 2 + Math.PI / 4 + ( R.seed - 0.5 ) * 0.4;
			const sx = x + Math.cos( a ) * 0.78, sz = z + Math.sin( a ) * 0.78;
			// the stool's frame: facing the table (its forward toward the middle)
			const f = dirF( x - sx, z - sz ), rgt = [ f[ 2 ], - f[ 0 ] ];
			const o = P( sx, 0, sz );
			const S = frame( o, rgt, [ f[ 0 ], f[ 2 ] ] );
			this._stool( b, S );
			R.stools.push( { x: o[ 0 ], z: o[ 2 ], face: [ f[ 0 ], f[ 2 ] ] } );

		}

		R.table = P( x, 0, z );

	}

	// a honey-wood barstool with arms and a red seat (S: its frame, forward toward what it faces)
	_stool( b, S ) {

		b.use( 'honey' );
		for ( const [ lx, lz ] of [ [ - 0.19, - 0.19 ], [ 0.19, - 0.19 ], [ - 0.19, 0.19 ], [ 0.19, 0.19 ] ] ) b.box( S, lx, 0.36, lz, 0.04, 0.72, 0.04, [ 'top', 'bottom' ] );
		b.box( S, 0, 0.74, 0, 0.46, 0.05, 0.46 );
		b.box( S, 0, 0.28, 0.19, 0.36, 0.03, 0.03 );
		b.box( S, - 0.19, 0.28, 0, 0.03, 0.03, 0.36 );
		b.box( S, 0.19, 0.28, 0, 0.03, 0.03, 0.36 );
		// the back and the arms
		for ( const lx of [ - 0.2, 0.2 ] ) {

			b.box( S, lx, 0.99, - 0.21, 0.035, 0.46, 0.035 );
			b.box( S, lx, 0.98, 0.0, 0.04, 0.03, 0.44 );
			b.box( S, lx, 0.87, 0.19, 0.03, 0.22, 0.03 );

		}

		b.box( S, 0, 1.17, - 0.21, 0.4, 0.09, 0.025 );
		b.box( S, 0, 0.98, - 0.21, 0.08, 0.32, 0.02 );
		b.use( 'redVinyl' ).box( S, 0, 0.79, 0.01, 0.4, 0.05, 0.4, [ 'bottom' ] );

	}

	// ---------------------------------------------------------------- the corridor

	_corridor( b, i ) {

		const y = this.y, W2 = this.W2, BC = this.BC, seg = this.segs[ i ];
		const { u, nIn } = seg;
		// its cans down the middle every 2.4 m
		const a = lerp( W2[ i ], BC[ i ], 0.5 ), c = lerp( W2[ i + 1 ], BC[ i + 1 ], 0.5 );
		const len = Math.hypot( c[ 0 ] - a[ 0 ], c[ 1 ] - a[ 1 ] );
		const lamps = [];
		const m = Math.max( 1, Math.round( len / 2.4 ) );
		for ( let k = 0; k < m; k ++ ) {

			const p = lerp( a, c, ( k + 0.5 ) / m );
			lamps.push( [ p[ 0 ], y + CH - 0.02, p[ 1 ], 1.6 ] );
			// the cove along the outer wall's top (harpo42: the wall of murals washed from above)
			const q = lerp( lerp( W2[ i ], W2[ i + 1 ], ( k + 0.5 ) / m ), lerp( BC[ i ], BC[ i + 1 ], ( k + 0.5 ) / m ), 0.88 );
			lamps.push( [ q[ 0 ], y + CH - 0.12, q[ 1 ], 0.55, 'omni', 0.6 ] );

		}

		b.room( { lamps, amb: 0.2 } );
		const s0 = this.segs.slice( 0, i ).reduce( ( s, q ) => s + q.len, 0 );
		const uvC = ( p ) => [ s0 + dot( sub( [ p[ 0 ], p[ 2 ] ], W2[ i ] ), u ), dot( sub( [ p[ 0 ], p[ 2 ] ], W2[ i ] ), nIn ) ];
		const at = ( p, h ) => [ p[ 0 ], y + h, p[ 1 ] ];
		b.use( 'blocks' ).panel4( at( W2[ i ], 0.004 ), at( W2[ i + 1 ], 0.004 ), at( BC[ i + 1 ], 0.004 ), at( BC[ i ], 0.004 ), [ 0, 1, 0 ], 0.7, uvC );
		b.use( 'tile' ).panel4( at( W2[ i ], CH ), at( W2[ i + 1 ], CH ), at( BC[ i + 1 ], CH ), at( BC[ i ], CH ), [ 0, - 1, 0 ], 0.8, uvC );
		for ( const l of lamps ) {

			const L = frame( [ l[ 0 ], l[ 1 ], l[ 2 ] ], u, nIn );
			b.use( 'can' ).box( L, 0, 0.01, 0, 0.18, 0.01, 0.18, [ 'top' ] );

		}

		// the suites' side: grey-green, their doors (built with the rooms), the plaques
		for ( const R of this.rooms.filter( ( q ) => q.i === i ) ) {

			const l = Math.hypot( R.C1[ 0 ] - R.C0[ 0 ], R.C1[ 1 ] - R.C0[ 1 ] );
			const offs = dot( sub( R.C0, R.G0 ), u ); // (the mitred end's offset from the glass's)
			const ds = [ R.door[ 0 ] - ( - R.hw + offs ), R.door[ 1 ] - ( - R.hw + offs ) ];
			this._wallWithDoor( b, R.C0, R.C1, 0, CH, [ nIn[ 0 ], 0, nIn[ 1 ] ], ds, 2.13, 'paint', s0 );
			b.use( 'black' ).panel4( at( R.C0, 0 ), at( R.C1, 0 ), at( R.C1, 0.1 ), at( R.C0, 0.1 ), [ nIn[ 0 ], 0, nIn[ 1 ] ] );
			void l;
			// the plaque by the door, on the latch side
			const px = R.buffetLeft ? R.door[ 0 ] - 0.25 : R.door[ 1 ] + 0.25;
			const Q = frame( R.P( px, 0, DROOM + WALL + 0.005 ), R.u, R.nIn );
			// (read from the corridor: its left is the + u side)
			b.use( 'print' ).print( Q( 0.09, 1.42, 0 ), Q( - 0.09, 1.42, 0 ), Q( - 0.09, 1.62, 0 ), Q( 0.09, 1.62, 0 ), [ nIn[ 0 ], 0, nIn[ 1 ] ], cellUV( 'plaques', R.num % 32, 8, 4 ) );

		}

		// the outer wall (the inside of FI1's brick): grey-green, a dark base, the murals between the elevators
		const nOut = [ - nIn[ 0 ], 0, - nIn[ 1 ] ];
		const bl = Math.hypot( BC[ i + 1 ][ 0 ] - BC[ i ][ 0 ], BC[ i + 1 ][ 1 ] - BC[ i ][ 1 ] );
		const lifts = ( this.liftAt || [] ).filter( ( e ) => e.i === i ).map( ( e ) => dot( sub( e.p, BC[ i ] ), u ) );
		const holes = lifts.map( ( s ) => [ s - 1.6, s + 1.6 ] );
		let s = 0;
		const pieces = [];
		for ( const [ h0, h1 ] of holes.sort( ( p, q ) => p[ 0 ] - q[ 0 ] ) ) {

			pieces.push( [ s, h0 ] );
			s = h1;

		}

		pieces.push( [ s, bl ] );
		this._wallWithDoor( b, BC[ i ], BC[ i + 1 ], 0, CH, nOut, null, 0, 'paint', s0 );
		{

			// the cove's lip: a lit slot where the wall meets the ceiling
			const Cv = frame( [ ( BC[ i ][ 0 ] + BC[ i + 1 ][ 0 ] ) / 2, y, ( BC[ i ][ 1 ] + BC[ i + 1 ][ 1 ] ) / 2 ], u, nOut.length ? [ nOut[ 0 ], nOut[ 2 ] ] : nIn );
			b.use( 'cove' ).box( Cv, 0, CH - 0.04, 0.1, bl, 0.02, 0.2, [ 'top', 'back' ] );
			b.use( 'drywall' ).box( Cv, 0, CH - 0.12, 0.2, bl, 0.16, 0.01, [ 'back' ] );

		}
		b.use( 'black' ).panel4( at( BC[ i ], 0 ), at( BC[ i + 1 ], 0 ), at( BC[ i + 1 ], 0.1 ), at( BC[ i ], 0.1 ), nOut );
		for ( const [ p0, p1 ] of pieces ) {

			// a mural in each long enough stretch between the elevators
			const ml = Math.min( 7.2, p1 - p0 - 1.2 );
			if ( ml > 3 ) {

				const mc = ( p0 + p1 ) / 2, key = ( i + Math.round( mc ) ) % 2 ? 'muralCrowd' : 'muralVet';
				const r = cellUV( key ), cut = ( 1 - ml / 7.2 ) / 2;
				const ru = [ r[ 0 ] + ( r[ 2 ] - r[ 0 ] ) * cut, r[ 1 ], r[ 2 ] - ( r[ 2 ] - r[ 0 ] ) * cut, r[ 3 ] ];
				// (read from the corridor: its left is the - u end)
				const m0 = along( BC[ i ], u, mc + ml / 2 ), m1 = along( BC[ i ], u, mc - ml / 2 );
				const lift = ( p, h ) => [ p[ 0 ] + nOut[ 0 ] * 0.01, y + h, p[ 1 ] + nOut[ 2 ] * 0.01 ];
				b.use( 'print' ).print( lift( m1, 0.55 ), lift( m0, 0.55 ), lift( m0, 2.35 ), lift( m1, 2.35 ), nOut, ru );

			}

		}

		// the elevators: a pair of brushed stainless doors in a frame, the call buttons, the floor numbers
		for ( const e of ( this.liftAt || [] ).filter( ( q ) => q.i === i ) ) {

			// (flush on the wall: FI1's brick and its walkway are right behind it)
			const E = frame( [ e.p[ 0 ], y, e.p[ 1 ] ], u, nIn.map( ( v ) => - v ) );
			for ( const sx of [ - 0.8, 0.8 ] ) {

				b.use( 'stainless' ).box( E, sx, 1.1, 0.03, 1.24, 2.2, 0.06, [ 'back' ] );
				b.use( 'stainless' ).box( E, sx, 1.06, 0.065, 1.04, 2.1, 0.012, [ 'back' ] );
				b.use( 'black' ).box( E, sx, 1.06, 0.072, 0.008, 2.1, 0.004 );
				b.use( 'exitSign' ).box( E, sx, 2.32, 0.035, 0.3, 0.07, 0.01 );

			}

			b.use( 'stainless' ).box( E, 0, 1.15, 0.012, 0.12, 0.22, 0.02 );
			b.use( 'lamp' ).box( E, 0, 1.2, 0.025, 0.03, 0.03, 0.01 );
			b.use( 'lamp' ).box( E, 0, 1.1, 0.025, 0.03, 0.03, 0.01 );

		}

		// the corridor's ends: a wall, the lit EXIT over it
		for ( const [ end, p, q ] of [ [ i === 0, W2[ 0 ], BC[ 0 ] ], [ i === this.segs.length - 1, W2[ W2.length - 1 ], BC[ BC.length - 1 ] ] ] ) {

			if ( ! end ) continue;
			const along2 = unit( sub( q, p ) );
			let n = [ - along2[ 1 ], 0, along2[ 0 ] ];
			const mid = lerp( p, q, 0.5 ), inward = sub( lerp( a, c, 0.5 ), mid );
			if ( n[ 0 ] * inward[ 0 ] + n[ 2 ] * inward[ 1 ] < 0 ) n = n.map( ( v ) => - v );
			this._wallWithDoor( b, p, q, 0, CH, n, null, 0, 'paint' );
			const X = frame( [ mid[ 0 ], y, mid[ 1 ] ], along2, [ n[ 0 ], n[ 2 ] ] );
			b.use( 'exitSign' ).box( X, 0, 2.35, 0.06, 0.4, 0.16, 0.06 );

		}

	}

	// ---------------------------------------------------------------- the glass and its frame

	// always drawn: the mullions and the sill and head (both sides), the band over the glass, the ends' walls
	_shell() {

		const b = new Inside(), y = this.y, yG = y + RH, yTop = this.yTop;
		b.room( null );
		for ( const R of this.rooms ) {

			const n = [ - R.nIn[ 0 ], 0, - R.nIn[ 1 ] ];
			const G = frame( [ R.O[ 0 ], y, R.O[ 1 ] ], R.u, R.nIn );
			const w = R.hw * 2;
			// the mullions at the partitions and mid-room; the sliding door's stile and its pull
			for ( const x of [ - R.hw, 0, R.hw ] ) b.use( 'bronze' ).box( G, x, RH / 2, 0, x ? 0.16 : 0.09, RH, 0.12 );
			b.use( 'bronze' ).box( G, - R.hw / 2, RH / 2 - 0.05, 0.03, 0.06, RH - 0.1, 0.05 );
			b.use( 'chrome' ).box( G, - R.hw / 2 - 0.08, 1.0, 0.08, 0.025, 0.4, 0.03 );
			b.use( 'bronze' ).box( G, 0, 0.05, 0, w, 0.1, 0.14 );
			b.use( 'bronze' ).box( G, 0, RH - 0.03, 0, w, 0.06, 0.12 );
			// the band over the glass (the slab's edge) up to the club's seats
			b.use( 'concrete' ).quad( G( - R.hw, RH, - 0.06 ), G( R.hw, RH, - 0.06 ), G( R.hw, yTop - y + 0.2, - 0.06 ), G( - R.hw, yTop - y + 0.2, - 0.06 ), n );
			b.use( 'concrete' ).quad( G( - R.hw, RH, - 0.06 ), G( R.hw, RH, - 0.06 ), G( R.hw, RH, 0.2 ), G( - R.hw, RH, 0.2 ), [ 0, - 1, 0 ] );

		}

		// the ends of the run: a wall across, outside and in
		const A = this.A, B = this.B;
		for ( const [ p, q ] of [ [ A[ 0 ], B[ 0 ] ], [ A[ A.length - 1 ], B[ B.length - 1 ] ] ] ) {

			const d = unit( sub( q, p ) );
			const n = [ - d[ 1 ], 0, d[ 0 ] ];
			for ( const s of [ 1, - 1 ] ) {

				const nn = n.map( ( v ) => v * s );
				const o = [ nn[ 0 ] * 0.08, nn[ 2 ] * 0.08 ];
				b.use( 'concrete' ).quad( [ p[ 0 ] + o[ 0 ], y - 0.45, p[ 1 ] + o[ 1 ] ], [ q[ 0 ] + o[ 0 ], y - 0.45, q[ 1 ] + o[ 1 ] ], [ q[ 0 ] + o[ 0 ], yTop + 0.2, q[ 1 ] + o[ 1 ] ], [ p[ 0 ] + o[ 0 ], yTop + 0.2, p[ 1 ] + o[ 1 ] ], nn );

			}

		}

		const m = b.mesh( insideMaterial( 'suites-shell' ), 'suites-shell' );
		m.castShadow = true;
		this.group.add( m );

	}

	// the glass: clear near the camera (the rooms behind it real), traced beyond (the rooms in the shader)
	_glass() {

		const y = this.y, far = new Inside(), near = new Inside();
		for ( const R of this.rooms ) {

			const n = [ - R.nIn[ 0 ], 0, - R.nIn[ 1 ] ];
			const a = [ R.G0[ 0 ], y + 0.1, R.G0[ 1 ] ], bb = [ R.G1[ 0 ], y + 0.1, R.G1[ 1 ] ], c = [ R.G1[ 0 ], y + RH, R.G1[ 1 ] ], d = [ R.G0[ 0 ], y + RH, R.G0[ 1 ] ];
			// the traced room: its walls' x (across, from the middle), a seed, and what's in it (lit, the buffet's
			// side, the party)
			far.with( [ - R.hw, R.hw, R.seed, ( R.lit ? 4 : 0 ) + ( R.buffetLeft ? 2 : 0 ) + Math.min( 0.99, R.party ) ] );
			far.quad( a, bb, c, d, n, [ [ - R.hw, 0.1 ], [ R.hw, 0.1 ], [ R.hw, RH ], [ - R.hw, RH ] ] );
			near.quad( a, bb, c, d, n );

		}

		const interiors = interiorsModule( this.bowl, 'suite-glass' );
		if ( interiors ) {

			const fm = this.farMat = standard( { name: 'suites-glass-far', roughness: 0.08, metalness: 0.6, vertexColors: true, modules: [ commonModule, interiors ], uniforms: GLASS_UNIFORMS(),
				surface: glassSplit( NEAR, BAND ) + farGlassWGSL() } );
			fm.underwaterLighting = 'none';
			fm.setDefine( 'DRY', 1 );
			this.group.add( far.mesh( fm, 'suites-glass-far' ) );

		}

		const m = this.nearGlass = clearGlassMesh( near, clearGlass( 'suites-glass-near', NEAR, BAND ), 'suites-glass-near' );
		this.group.add( m );

	}

	// ---------------------------------------------------------------- the elevators, the walls you can't walk through

	// the suite level's stop of each bank: in the corridor now (the bowl's car stood in a suite), its doors
	// in the corridor's outer wall behind you, facing the suites' doors
	_liftSpots() {

		this.liftAt = [];
		const banks = this.bowl.elevators || [];
		const CM = this.CM;
		for ( const bank of banks ) {

			const stop = bank.stops.find( ( s ) => s.name === 'Suite level' );
			if ( ! stop ) continue;
			// the nearest point on the corridor's middle
			let best = null, bd = Infinity;
			for ( let i = 0; i < CM.length - 1; i ++ ) {

				const a = CM[ i ], c = CM[ i + 1 ], ab = sub( c, a ), l2 = dot( ab, ab );
				const t = Math.max( 0.15, Math.min( 0.85, dot( sub( [ stop.x, stop.z ], a ), ab ) / l2 ) );
				const p = lerp( a, c, t ), dd = Math.hypot( p[ 0 ] - stop.x, p[ 1 ] - stop.z );
				if ( dd < bd ) {

					bd = dd; best = { i, p, t };

				}

			}

			if ( ! best ) continue;
			const { u, nIn } = this.segs[ best.i ];
			stop.x = best.p[ 0 ]; stop.z = best.p[ 1 ];
			// (arriving, you look down the corridor, the suites' doors on your left or right)
			const f = [ u[ 0 ] * 0.9 - nIn[ 0 ] * 0.35, u[ 1 ] * 0.9 - nIn[ 1 ] * 0.35 ], fl = Math.hypot( f[ 0 ], f[ 1 ] );
			stop.face = [ f[ 0 ] / fl, f[ 1 ] / fl ];
			// the doors in the outer wall
			const s = dot( sub( best.p, this.BC[ best.i ] ), u );
			this.liftAt.push( { i: best.i, p: along( this.BC[ best.i ], u, s ) } );

		}

		// the bowl's car (a slab) at this level
		this.bowl.group.traverse( ( o ) => {

			if ( o.isMesh && o.material?.name === 'elevator-door' && o.parent && Math.abs( o.parent.position.y - this.y ) < 0.05 ) o.visible = false;

		} );
	}

	_colliders() {

		const C = this.colliders, F = this.field;
		if ( ! C || ! F ) return;
		const yaw = F.group.rotation.y;
		const wall = ( p, q, h = RH, th = 0.15, tag = 'suite-wall' ) => {

			const l = Math.hypot( q[ 0 ] - p[ 0 ], q[ 1 ] - p[ 1 ] );
			if ( l < 0.05 ) return;
			const w = F.toWorld( ( p[ 0 ] + q[ 0 ] ) / 2, ( p[ 1 ] + q[ 1 ] ) / 2 );
			C.addBox( new Vector3( w.x, F.y0 + this.y + h / 2, w.z ), new Vector3( l / 2, h / 2, th / 2 ), yaw - Math.atan2( q[ 1 ] - p[ 1 ], q[ 0 ] - p[ 0 ] ), { tag } );

		};
		for ( const R of this.rooms ) {

			// the partition on its left (the run's first one is the end wall)
			wall( R.G0, R.K0 );
			// the back wall, open where its door's open
			const p = ( x ) => {

				const q = R.P( x, 0, DROOM + WALL / 2 );
				return [ q[ 0 ], q[ 2 ] ];

			};
			const xl = R.xl( DROOM ) - R_HALF, xr = R.xr( DROOM ) + R_HALF;
			if ( R.open ) {

				wall( p( xl ), p( R.door[ 0 ] ) );
				wall( p( R.door[ 1 ] ), p( xr ) );

			} else wall( p( xl ), p( xr ) );

		}

		const last = this.rooms[ this.rooms.length - 1 ];
		wall( last.G1, last.K1 );
		// the corridor's ends
		const n = this.A.length - 1;
		wall( this.W[ 0 ], this.B[ 0 ] );
		wall( this.W[ n ], this.B[ n ] );

	}

	// ---------------------------------------------------------------- the parties

	_people() {

		const r = rnd( 1029 );
		this.cast = new Cast( { parent: this.group, max: 240 } );
		this.tempo = new Tempo( [ this.cast ], { every: 6 } );
		this.who = [];
		const y = this.y;
		for ( const R of this.rooms ) {

			if ( ! R.lit || R.party < 0.05 ) continue;
			const spots = [];
			for ( const s of R.stools || [] ) spots.push( { x: s.x, z: s.z, face: s.face, sit: 0.79 } );
			const P = R.P, out = [ - R.nIn[ 0 ], - R.nIn[ 1 ] ];
			// at the glass, looking out at the field
			for ( const t of [ - 0.6, 0.05, 0.55 ] ) {

				const q = P( t * R.hw, 0, 0.55 + r() * 0.3 );
				spots.push( { x: q[ 0 ], z: q[ 2 ], face: unit( [ out[ 0 ] + ( r() - 0.5 ) * 0.5, out[ 1 ] + ( r() - 0.5 ) * 0.5 ] ), stand: true, glass: true } );

			}

			// at the counter, by the buffet: in twos, talking
			const cx = ( R.xl( 3.3 ) + R.xr( 3.3 ) ) / 2;
			for ( const [ x, z ] of [ [ cx - 0.5, 3.3 ], [ cx + 0.3, 3.0 ], [ R.buffetLeft ? R.xl( 2.4 ) + 0.95 : R.xr( 2.4 ) - 0.95, 2.4 ] ] ) {

				const q = P( x, 0, z );
				const t = R.table ? [ R.table[ 0 ] - q[ 0 ], R.table[ 2 ] - q[ 2 ] ] : out;
				spots.push( { x: q[ 0 ], z: q[ 2 ], face: unit( [ t[ 0 ] + ( r() - 0.5 ), t[ 1 ] + ( r() - 0.5 ) ] ), stand: true } );

			}

			// how many: two to nine
			const n = Math.min( spots.length, Math.round( 2 + R.party * 7 ) );
			for ( let j = spots.length - 1; j > 0; j -- ) {

				const k = Math.floor( r() * ( j + 1 ) );
				[ spots[ j ], spots[ k ] ] = [ spots[ k ], spots[ j ] ];

			}

			for ( const s of spots.slice( 0, n ) ) {

				const L = dress( r, { poncho: 0 } );
				L.dry = true;
				const p = this.cast.add( L );
				if ( ! p ) break;
				p.x = s.x; p.y = y; p.z = s.z;
				p.yaw = Walkway.yaw( s.face[ 0 ], s.face[ 1 ] );
				p.scale = sizeOf( L, r );
				p.visible = false;
				const a = p.pose;
				if ( s.sit ) seat( a, s.sit );
				const drink = r();
				const g = drink < 0.55 ? GESTURE.carry : drink < 0.75 ? GESTURE.fold : null;
				if ( g?.[ 0 ] ) a.armL = g[ 0 ].slice();
				if ( g?.[ 1 ] ) a.armR = g[ 1 ].slice();
				if ( drink < 0.55 ) a.propR = r() < 0.7 ? PROP.beer : PROP.soda;
				this.who.push( { p, R, s, base: { armL: a.armL.slice(), armR: a.armR.slice(), propR: a.propR }, ph: r() * 10, look: ( r() - 0.5 ) * 0.8 } );

			}

		}

		this.cast.bounds = new Sphere( new Vector3( 0, this.y + 1.5, 20 ), 75 );

	}

	update( dt, director, camera ) {

		if ( ! this.reach || ! camera ) return;
		const F = this.field;
		const [ cx, cz ] = F.toField( camera.position.x, camera.position.z );
		const cy = camera.position.y - F.y0;
		// only from where you could see in: not from behind the corridor's wall, nor from under the floor
		// (the main concourse, FI1's walkway: the rooms over them were drawn for nothing)
		const d = backFrom( this.A, cx, cz );
		const sees = d < 7.5 && ! ( cy < this.y - 0.3 && d > - 2.5 );
		const any = this.reach.update( sees ? [ cx, cy, cz ] : [ 1e4, 0, 0 ] );
		if ( this.tvs ) this.tvs.visible = any;
		this.nearGlass.visible = any;
		if ( this.farMat ) this.farMat.uniforms.nearOn.value = sees ? 1 : 0;
		// the parties: only in the rooms drawn
		let changed = false;
		for ( const w of this.who || [] ) {

			const on = !! w.R.chunk?.on;
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
			// the last out: on their feet (the ones on stools too), the arms up
			if ( ns.celebrate ) {

				a.armL = GESTURE.cheer[ 0 ].slice(); a.armR = GESTURE.cheer[ 1 ].slice();
				a.propR = 0;
				a.headPitch = - 0.1;
				continue;

			}

			a.armL = w.base.armL; a.armR = w.base.armR; a.propR = w.base.propR;
			// talking, looking out at the game now and then, a sip
			a.headYaw = w.look + Math.sin( t * 0.27 + w.ph ) * 0.35;
			a.headPitch = w.s.glass ? 0.12 : 0.02;
			a.mouth = Math.max( 0, Math.sin( t * 5.1 + w.ph * 3 ) ) * ( Math.sin( t * 0.4 + w.ph ) > 0.3 ? 0.5 : 0 );
			a.blink = ( t * 0.31 + w.ph ) % 1 < 0.04 ? 1 : 0;
			a.breath = ( t * 0.25 + w.ph ) % 1;
			if ( w.base.propR && ( t * 0.08 + w.ph ) % 1 < 0.06 ) a.armR = GESTURE.sip[ 1 ];

		}

		this.cast.update();

	}

}

// the far glass's room, traced (interior mapping): the walls in wallpaper over the wainscot, the buffet
// down one side and the flat TV on the other, the cherry cabinets along the back with the lit glass and
// the old TV, the door, the ceiling's cans; the people on three planes (at the counter, round the
// high-top, at the glass). in.color: the room's walls' x, a seed, and 4 * lit + 2 * buffet-left + party.
function farGlassWGSL() {

	return /* wgsl */`
	if ( nearK ) { discard; }
	let xl = in.color.r; let xr = in.color.g; let seed = in.color.b;
	let fl = in.color.a;
	let lit = fl >= 3.5;
	let bl = ( fl - select( 0.0, 4.0, lit ) ) >= 1.5;
	let party = fract( fl );
	let RH = ${ RH.toFixed( 2 ) };
	let DEP = ${ DROOM.toFixed( 2 ) };
	let N = normalize( vec3f( in.N.x, 0.0, in.N.z ) );
	let T = normalize( cross( vec3f( 0.0, 1.0, 0.0 ), N ) );
	let Vd = normalize( in.P - frame.cameraPos );
	let rd = vec3f( dot( Vd, T ), Vd.y, max( dot( Vd, - N ), 0.05 ) );
	let ro = vec3f( in.uv.x, in.uv.y, 0.0 );
	let tx = ( select( xl + 0.06, xr - 0.06, rd.x > 0.0 ) - ro.x ) / rd.x;
	let ty = ( select( 0.0, RH, rd.y > 0.0 ) - ro.y ) / rd.y;
	let tz = DEP / rd.z;
	let t = min( tx, min( ty, tz ) );
	let hit = ro + rd * t;
	let h2 = fract( seed * 13.71 );
	let nk = smoothstep( 0.1, 0.7, frame.night );
	var room = vec3f( 0.52, 0.42, 0.27 ) * ( 0.92 + 0.12 * step( 0.5, fract( ( hit.z + hit.x ) / 0.18 ) ) );
	var glow = vec3f( 0.0 );
	if ( t == ty && rd.y > 0.0 ) {
		// the ceiling and its two rows of cans
		room = vec3f( 0.62, 0.6, 0.56 ) * 0.6;
		let w3 = ( xr - xl ) / 3.0;
		let g = vec2f( ( fract( ( hit.x - xl ) / w3 ) - 0.5 ) * w3, min( abs( hit.z - 1.15 ), abs( hit.z - 3.1 ) ) );
		if ( lit && length( g ) < 0.1 ) { glow = vec3f( 5.0, 4.2, 3.2 ); }
	} else if ( t == ty ) {
		room = vec3f( 0.03, 0.035, 0.055 );
	} else if ( t == tx ) {
		let left = rd.x < 0.0;
		if ( hit.y < 0.9 ) { room = vec3f( 0.42, 0.2, 0.07 ); }
		if ( left == bl ) {
			if ( hit.z > 0.85 && hit.z < 3.4 ) {
				if ( hit.y < 0.84 ) { room = vec3f( 0.2, 0.075, 0.03 ); }
				else if ( hit.y < 0.88 ) { room = vec3f( 0.05 ); }
				else if ( hit.y < 1.02 && fract( hit.z / 0.8 ) < 0.7 ) { room = vec3f( 0.55, 0.56, 0.57 ); }
			}
		} else if ( abs( hit.z - 2.25 ) < 0.59 && hit.y > 1.41 && hit.y < 2.11 ) {
			room = vec3f( 0.015 );
			if ( lit && abs( hit.z - 2.25 ) < 0.55 && hit.y > 1.45 && hit.y < 2.07 ) { glow = mix( vec3f( 0.1, 0.4, 0.12 ), vec3f( 0.15, 0.2, 0.45 ), step( 1.88, hit.y ) ) * 2.0; }
		}
	} else {
		// the back: the cherry cabinets to the ceiling, the lit glass under them, the old TV, the door
		room = vec3f( 0.2, 0.075, 0.03 ) * ( 0.8 + 0.2 * step( 0.03, abs( fract( hit.x / 0.5 ) - 0.5 ) ) );
		let xc = ( xl + xr ) * 0.5 + select( 0.2, - 0.2, bl );
		let dx0 = select( xl + 0.4, xr - 1.35, bl );
		if ( hit.y > 0.86 && hit.y < 0.9 ) { room = vec3f( 0.05 ); }
		if ( hit.y >= 0.9 && hit.y < 1.42 ) { room = vec3f( 0.62, 0.72, 0.6 ) * 0.5; if ( lit ) { glow = vec3f( 0.62, 0.72, 0.6 ) * 0.9; } }
		if ( abs( hit.x - xc ) < 0.32 && hit.y > 1.46 && hit.y < 1.94 ) { room = vec3f( 0.03 ); if ( lit && abs( hit.x - xc ) < 0.25 && hit.y > 1.52 && hit.y < 1.88 ) { glow = vec3f( 0.12, 0.38, 0.12 ) * 2.0; } }
		if ( hit.x > dx0 && hit.x < dx0 + 0.95 && hit.y < 2.13 ) { room = vec3f( 0.38, 0.19, 0.07 ); glow = vec3f( 0.0 ); }
	}
	let lk = select( 0.025, mix( 0.3, 0.48, nk ), lit ) * ( 0.85 + 0.3 * h2 );
	room = room * lk + glow * select( 0.0, mix( 0.5, 1.0, nk ), lit );
	// the people: at the counter, round the high-top, at the glass (nearer drawn over further)
	for ( var kk = 0; kk < 3; kk ++ ) {
		let zP = select( select( 0.75, 1.95, kk == 1 ), 3.2, kk == 0 );
		let tP = zP / rd.z;
		if ( lit && tP < t && tP > 0.0 ) {
			let pp = ro + rd * tP;
			let cell = floor( pp.x / 0.7 ) + seed * 977.0 + f32( kk ) * 7.0;
			let a = ihash( cell ); let b = ihash( cell + 3.3 ); let c = ihash( cell + 5.7 );
			let cx = ( floor( pp.x / 0.7 ) + 0.3 + 0.4 * b ) * 0.7;
			if ( a < party * select( 0.55, 0.4, kk == 1 ) && cx > xl + 0.4 && cx < xr - 0.4 ) {
				var coat = vec3f( 0.36, 0.025, 0.03 );
				if ( c > 0.45 ) { coat = vec3f( 0.03, 0.035, 0.08 ); }
				if ( c > 0.62 ) { coat = vec3f( 0.03 ); }
				if ( c > 0.78 ) { coat = vec3f( 0.22, 0.2, 0.18 ); }
				if ( c > 0.9 ) { coat = vec3f( 0.6, 0.58, 0.55 ); }
				let hair = mix( vec3f( 0.05, 0.035, 0.02 ), vec3f( 0.35, 0.25, 0.12 ), step( 0.7, b ) ) + vec3f( 0.3 ) * step( 0.9, a * 1.8 );
				let skin = mix( vec3f( 0.55, 0.38, 0.3 ), vec3f( 0.3, 0.19, 0.13 ), step( 0.85, c ) );
				let f = figure( vec2f( pp.x - cx, pp.y ), select( 1.62 + 0.24 * b, 1.52 + 0.12 * b, kk == 1 ), coat, hair, skin, 0.0 );
				if ( f.w > 0.5 ) { room = f.xyz * mix( 0.12, 0.3, nk ) * ( 0.8 + 0.4 * h2 ); }
			}
		}
	}
	let fres = pow( 1.0 - max( dot( - Vd, N ), 0.0 ), 3.0 );
	s.albedo = vec3f( 0.02, 0.03, 0.035 );
	s.roughness = 0.08;
	s.metalness = 0.6;
	s.alpha = 1.0;
	s.emissive = room * ( 1.0 - fres );
`;

}
