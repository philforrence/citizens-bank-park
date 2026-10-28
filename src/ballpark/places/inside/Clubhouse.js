import { Group, Mesh, Vector3, Sphere, BufferGeometry, Float32BufferAttribute } from '../../../engine/index.js';
import { commonModule } from '../../../engine/render/wgsl/common.js';
import { standard } from '../../../materials/Materials.js';
import { Quads } from '../../Stands.js';
import { LEVELS } from '../../layout.js';
import { STORE } from '../gate3b/Store.js';
import { LIFT } from '../gate3b/Street.js';
import { Cast, PROP, TOP, COLOR, HAT, CHEST, GEAR } from '../Cast.js';
import { GESTURE, dress, sizeOf, armIK } from '../Concourse3BKit.js';
import { nightState } from '../Concourse3BPeople.js';
import { Tempo } from '../Tempo.js';
import { Inside, insideMaterial, frame, cellUV, rnd, yawOf, PRINT } from './Kit.js';

// FI3 (gauntlet C2I-3): the Majestic Clubhouse Store as it was on the World Series nights, the first lit
// room you see on the walk in from the Third Base Gate's plaza: the ground floor of the glass corner
// pavilion (gate3b/Store.js has its canopy, banners, band and bed), built to look into. Getty, 27 Oct 2008
// ("fans stand outside the team store prior to Game Five": two storeys of glass, lit inside, merchandise
// to the ceiling) and 25 Oct ("fans buy merchandise", WS Game 3: dense racks of red jackets, a yellow-framed
// World Series sign, shoppers packed in); 20 Oct (jerseys with the Series patch on chrome racks). Inside:
// a maple floor under a white ceiling of cans; the window platforms with dress forms in this year's
// jerseys; the jersey wall down the brick side in slatwall, two rows of jerseys face out, caps above them,
// the NATIONAL LEAGUE CHAMPIONS header; two round racks of red jackets and home whites and greys,
// tables of folded World Series tees; the cash wrap across the back under the cap wall
// and the World Series board; two hanging boards over the floor. Staff in navy polos; shoppers at the racks,
// in the line, carrying the red bags out: packed before the first pitch and in the rain delay, fewer while
// the game's on.
//
// The facade (Exterior.js) painted this glass and a room behind it (Frontages.js fzStore, still the upper
// storey's): at build time the ground storey's glass is cut out of the facade's mesh, both faces, and the
// granite round it put back in the facade's own material and uv, so the room here is really behind real
// glass. Exterior.js untouched.
//
// And the store's other door, on the concourse behind 134 beside the Home Stand (FI1's CI-23): the racks
// and a World Series board in its doorway, a greeter, shoppers; the Home Stand staffed, with shoppers at
// its racks and its table.
//
// Field frame; the plaza is LEVELS.mainConcourse + LIFT.

const Y0 = LEVELS.mainConcourse; // the facade's foot
const YF = Y0 + LIFT; // the store's floor (the plaza's)
const YC = Y0 + 4.9; // its ceiling (the glass's head)
const T = 0.8; // the facade's thickness
const FACADE = 6.5; // the facade's ground storey (Exterior.js)
const GLASS_IN = 0.1; // the glass, in from the facade's face
// the back wall, in from the block's open side (D-A): the Third Base Gate's stair tower (Exterior._stairTower, 10 x 7 m)
// stands across that line, 2 m into the block, its first landing and flight at 3.5 m over the floor
const BACK_IN = 2.35;

const sub = ( a, b ) => [ a[ 0 ] - b[ 0 ], a[ 1 ] - b[ 1 ] ];
const add = ( a, b ) => [ a[ 0 ] + b[ 0 ], a[ 1 ] + b[ 1 ] ];
const mul = ( a, k ) => [ a[ 0 ] * k, a[ 1 ] * k ];
const dot = ( a, b ) => a[ 0 ] * b[ 0 ] + a[ 1 ] * b[ 1 ];
const unit = ( a ) => mul( a, 1 / ( Math.hypot( a[ 0 ], a[ 1 ] ) || 1 ) );
// where two lines (a point and a direction each) cross
const cross2 = ( p, d, q, e ) => {

	const den = d[ 0 ] * e[ 1 ] - d[ 1 ] * e[ 0 ];
	const t = ( ( q[ 0 ] - p[ 0 ] ) * e[ 1 ] - ( q[ 1 ] - p[ 1 ] ) * e[ 0 ] ) / den;
	return add( p, mul( d, t ) );

};
// a frame whose +x is the right hand of someone facing it (facing - fwd): what's printed on its + z
// face reads left to right
const faceFrame = ( o, fwd ) => frame( o, [ fwd[ 1 ], - fwd[ 0 ] ], fwd );
// an atlas print centred at c (field [ x, y, z ]), w by h, facing n ([ x, z ]), reading left to right
const printAt = ( b, c, w, h, n, rect, pal = 'print' ) => {

	const rt = [ n[ 1 ], - n[ 0 ] ];
	const P = ( sx, sy ) => [ c[ 0 ] + rt[ 0 ] * sx * w / 2, c[ 1 ] + sy * h / 2, c[ 2 ] + rt[ 1 ] * sx * w / 2 ];
	b.use( pal ).print( P( - 1, - 1 ), P( 1, - 1 ), P( 1, 1 ), P( - 1, 1 ), [ n[ 0 ], 0, n[ 1 ] ], rect );

};

export default class Clubhouse {

	constructor( { app, field, colliders } ) {

		this.app = app;
		this.field = field;
		this.colliders = colliders;
		this.group = new Group();
		this.group.name = 'clubhouse';
		this._plan();
		// one of the plaza's tree spots (Exterior's grates, grown by the gate3b place, built after this) stood
		// inside the block, unseen while the block was shut: not now
		const spots = this.app?.exterior?.treeSpots;
		if ( spots ) for ( let i = spots.length - 1; i >= 0; i -- ) {

			const l = this.toF( spots[ i ] );
			if ( l[ 1 ] > - 0.5 && l[ 1 ] < 9 && l[ 0 ] > - 1 && l[ 0 ] < 7 ) spots.splice( i, 1 );

		}

		this.material = insideMaterial( 'clubhouse-inside', { local: false, direct: 0.3 } );
		this.spots = [];
		const ok = this._cutFacade();
		if ( ok ) {

			const b = new Inside();
			this._room( b );
			this._fixtures( b );
			this.room = b.mesh( this.material, 'clubhouse-room' );
			this.room.castShadow = false;
			this.group.add( this.room );
			this._glass();

		}

		this._concourse();
		this._people();

	}

	// the block's walls, its inner corners, the glass's extents (no materials: Node can run it)
	_plan() {

		const { A, B, C, D } = STORE;
		const centre = mul( add( add( A, B ), add( C, D ) ), 0.25 );
		// the block's three walls: the side toward the gate (A to B), the front (B to C), the far side (C to
		// D), each with its outward normal; D to A is open to the building behind
		const edge = ( p, q ) => {

			const u = unit( sub( q, p ) ), len = Math.hypot( q[ 0 ] - p[ 0 ], q[ 1 ] - p[ 1 ] );
			let n = [ u[ 1 ], - u[ 0 ] ];
			if ( dot( n, sub( mul( add( p, q ), 0.5 ), centre ) ) < 0 ) n = mul( n, - 1 );
			return { p, q, u, n, nIn: mul( n, - 1 ), len, inP: add( p, mul( n, - T ) ) };

		};

		this.side = edge( A, B );
		this.front = edge( B, C );
		this.far = edge( C, D );
		// the inner corners (the walls' inner faces met)
		this.Bi = cross2( this.side.inP, this.side.u, this.front.inP, this.front.u );
		this.Ci = cross2( this.front.inP, this.front.u, this.far.inP, this.far.u );
		this.Di = cross2( this.far.inP, this.far.u, D, unit( sub( A, D ) ) );
		this.Ai = cross2( this.side.inP, this.side.u, D, unit( sub( A, D ) ) );
		// the corner post at B (where each wall's inner face meets the other's outer face), and where the far
		// wall's inner face meets the front's glass
		this.X1 = cross2( this.front.inP, this.front.u, this.side.p, this.side.u );
		this.X2 = cross2( this.side.inP, this.side.u, this.front.p, this.front.u );
		this.X3 = cross2( this.far.inP, this.far.u, this.front.p, this.front.u );
		// the glass on each: the front from the post to the far wall's inner face; the side from the post to the
		// back wall (the facade's frontage ran on 0.77 m short of A, into the stair tower behind it)
		const tOn = ( e, P ) => dot( sub( P, e.p ), e.u );
		this.front.glass = [ tOn( this.front, this.X2 ), tOn( this.front, this.X3 ) - 0.004 ];
		this.side.glass = [ BACK_IN + 0.12, tOn( this.side, this.X1 ) ];
		// a pair of doors in the front's middle (the gate3b place's people come and go there)
		const dm = ( this.front.glass[ 0 ] + this.front.glass[ 1 ] ) / 2;
		this.doorT = [ dm - 0.9, dm + 0.9 ];
		// the store's frame: x along the front from B toward C, z in from the front's face
		this.F = frame( [ B[ 0 ], YF, B[ 1 ] ], this.front.u, this.front.nIn );
		this.toF = ( p ) => [ dot( sub( p, B ), this.front.u ), dot( sub( p, B ), this.front.nIn ) ];

	}

	// ---------------------------------------------------------------- the facade's glass cut out

	// The facade's ground storey is one quad per footprint edge, both faces (Exterior._buildFacade, uv: x the
	// metres along the wall, y the height). The store's two edges: their outer faces lose the glass's
	// rectangle (the granite round it is put back, same uv), their inner faces go (the room's walls are
	// here). Returns whether it found them.
	_cutFacade() {

		let mesh = null;
		this.app?.exterior?.group?.traverse( ( o ) => {

			if ( ! mesh && o.isMesh && o.name === 'facade' ) mesh = o;

		} );
		if ( ! mesh ) return false;
		const g = mesh.geometry, P = g.getAttribute( 'position' ), N = g.getAttribute( 'normal' ), U = g.getAttribute( 'uv' );
		if ( ! P || ! N || ! U || g.index ) return false;
		const edges = [ this.side, this.front ];
		// which face of edge e a vertex is on: 0 outer, 1 inner, - 1 neither (a corner's on two edges' faces)
		const on = ( e, x, y, z ) => {

			if ( y < Y0 - 0.02 || y > Y0 + FACADE + 0.02 ) return - 1;
			const d = dot( sub( [ x, z ], e.p ), e.n ), t = dot( sub( [ x, z ], e.p ), e.u );
			if ( t < - 0.02 || t > e.len + 0.02 ) return - 1;
			return Math.abs( d ) < 0.02 ? 0 : Math.abs( d + T ) < 0.02 ? 1 : - 1;

		};

		const keep = [], uA = [ null, null ];
		const n = P.count / 3;
		for ( let i = 0; i < n; i ++ ) {

			let cut = false;
			for ( let k = 0; k < edges.length && ! cut; k ++ ) {

				const w = [ 0, 1, 2 ].map( ( j ) => on( edges[ k ], P.getX( i * 3 + j ), P.getY( i * 3 + j ), P.getZ( i * 3 + j ) ) );
				if ( w[ 0 ] < 0 || w[ 1 ] !== w[ 0 ] || w[ 2 ] !== w[ 0 ] ) continue;
				cut = true;
				// (the outer face's uv.x at the edge's start: u = uA + t)
				if ( w[ 0 ] === 0 ) uA[ k ] = U.getX( i * 3 ) - dot( sub( [ P.getX( i * 3 ), P.getZ( i * 3 ) ], edges[ k ].p ), edges[ k ].u );

			}

			if ( ! cut ) keep.push( i );

		}

		if ( uA[ 0 ] === null || uA[ 1 ] === null ) return false;
		// the granite and brick round the glass, put back: the piers either side, the sill, the band over it
		const q = new Quads();
		edges.forEach( ( e, k ) => {

			const [ ta, tb ] = e.glass;
			const at = ( t, y ) => [ e.p[ 0 ] + e.u[ 0 ] * t, y, e.p[ 1 ] + e.u[ 1 ] * t ];
			const n3 = [ e.n[ 0 ], 0, e.n[ 1 ] ];
			const piece = ( t0, t1, y0, y1 ) => {

				if ( t1 - t0 > 0.005 && y1 - y0 > 0.005 ) q.add( at( t0, y0 ), at( t1, y0 ), at( t1, y1 ), at( t0, y1 ), n3, uA[ k ] + t0, uA[ k ] + t1 );

			};
			piece( 0, ta, Y0, Y0 + FACADE );
			piece( tb, e.len, Y0, Y0 + FACADE );
			piece( ta, tb, YC, Y0 + FACADE );
			if ( e === this.front ) {

				// (the doors' threshold is the plaza's)
				const [ d0, d1 ] = this.doorT;
				piece( ta, d0, Y0, Y0 + 0.3 );
				piece( d0, d1, Y0, YF );
				piece( d1, tb, Y0, Y0 + 0.3 );

			} else piece( ta, tb, Y0, Y0 + 0.3 );

		} );
		const nv = keep.length * 3 + q.pos.length / 3;
		const pos = new Float32Array( nv * 3 ), nrm = new Float32Array( nv * 3 ), uv = new Float32Array( nv * 2 );
		let o = 0;
		for ( const i of keep ) for ( let j = 0; j < 3; j ++ ) {

			const s = i * 3 + j;
			pos.set( [ P.getX( s ), P.getY( s ), P.getZ( s ) ], o * 3 );
			nrm.set( [ N.getX( s ), N.getY( s ), N.getZ( s ) ], o * 3 );
			uv.set( [ U.getX( s ), U.getY( s ) ], o * 2 );
			o ++;

		}

		pos.set( q.pos, o * 3 ); nrm.set( q.nrm, o * 3 ); uv.set( q.uv, o * 2 );
		const ng = new BufferGeometry();
		ng.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
		ng.setAttribute( 'normal', new Float32BufferAttribute( nrm, 3 ) );
		ng.setAttribute( 'uv', new Float32BufferAttribute( uv, 2 ) );
		ng.computeBoundingBox();
		ng.computeBoundingSphere();
		mesh.geometry = ng;
		this.cut = { removed: n - keep.length, added: q.count };
		return true;

	}

	// ---------------------------------------------------------------- the room

	_room( b ) {

		const F = this.F, { A, B, C, D } = STORE;
		// the cans: a grid over the floor, a row along each wall to wash it
		const lamps = [];
		for ( let x = 0.9; x < 5.6; x += 1.15 ) for ( let z = 1.0; z < 8.0; z += 1.3 ) lamps.push( [ ...F( x, YC - YF - 0.02, z ), 1.35 ] );
		for ( let z = 1.2; z < 7.8; z += 1.6 ) lamps.push( [ ...F( 4.6, YC - YF - 0.5, z ), 0.9, 'omni', 1.2 ] );
		for ( let x = 0.8; x < 5.2; x += 1.5 ) lamps.push( [ ...F( x, YC - YF - 0.5, 7.4 ), 0.8, 'omni', 1.2 ] );
		b.room( { lamps, amb: 0.2, bounce: 0.3, color: [ 1.0, 0.93, 0.82 ] } );
		this.lamps = lamps;
		const fl = ( p, h ) => [ p[ 0 ], h, p[ 1 ] ];
		const uvF = ( p ) => {

			const l = this.toF( [ p[ 0 ], p[ 2 ] ] );
			return [ l[ 0 ], l[ 1 ] ];

		};
		// the maple floor and the ceiling, over the whole block (the window bays too)
		b.use( 'maple' ).panel4( fl( B, YF + 0.003 ), fl( C, YF + 0.003 ), fl( D, YF + 0.003 ), fl( A, YF + 0.003 ), [ 0, 1, 0 ], 0.6, uvF );
		b.use( 'drywall' ).panel4( fl( B, YC ), fl( C, YC ), fl( D, YC ), fl( A, YC ), [ 0, - 1, 0 ], 0.8, uvF );
		for ( const l of lamps ) if ( l[ 4 ] !== 'omni' ) {

			const L = frame( [ l[ 0 ], l[ 1 ], l[ 2 ] ], this.front.u, this.front.nIn );
			b.use( 'can' ).box( L, 0, 0.012, 0, 0.16, 0.01, 0.16, [ 'top' ] );
			b.use( 'white' ).box( L, 0, 0.016, 0, 0.21, 0.006, 0.21, [ 'top' ] );

		}

		// the window bays: the corner post's two faces, the side's end jamb and its pier, the platforms
		const wall = ( p0, p1, n, pal, h0 = YF, h1 = YC, cell = 0.8 ) => b.use( pal ).panel4( fl( p0, h0 ), fl( p1, h0 ), fl( p1, h1 ), fl( p0, h1 ), [ n[ 0 ], 0, n[ 1 ] ], cell, ( p ) => [ Math.hypot( p[ 0 ] - p0[ 0 ], p[ 2 ] - p0[ 1 ] ), p[ 1 ] - YF ] );
		const fr = this.front, sd = this.side, fa = this.far;
		const onE = ( e, t, d ) => add( add( e.p, mul( e.u, t ) ), mul( e.n, d ) );
		// the post at B: its face toward the side's glass (the front wall's inner face there) and toward the front's
		wall( this.X1, this.Bi, fr.nIn, 'drywall' );
		wall( this.X2, this.Bi, sd.nIn, 'drywall' );
		// the side's glass ends short of A: a jamb, the pier's inner face to the open back
		wall( onE( sd, sd.glass[ 0 ], - GLASS_IN ), onE( sd, sd.glass[ 0 ], - T ), sd.u, 'drywall' );
		wall( onE( sd, sd.glass[ 0 ], - T ), this.Ai, sd.nIn, 'drywall' );
		// the far wall (the brick's inner face): slatwall, the jersey wall (_fixtures); its stretch in the front's
		// bay, plain
		wall( add( this.X3, mul( fa.nIn, 0.012 ) ), add( this.Ci, mul( fa.nIn, 0.012 ) ), fa.nIn, 'drywall' );
		wall( this.Ci, this.Di, fa.nIn, 'slatwall', YF, YC, 0.9 );
		// the back (D to A: the building behind): the cap wall's slatwall over a navy base
		// (---- 0.6 m in from the line D-A: the Third Base Gate's frame runs on along that line past A, its beam
		// through the block a black band across the back wall's top)
		const bp = ( p ) => add( p, mul( fr.n, BACK_IN ) );
		wall( bp( this.Di ), bp( this.Ai ), fr.n, 'slatwall', YF + 0.9, YC, 0.9 );
		wall( bp( this.Di ), bp( this.Ai ), fr.n, 'navyWall', YF, YF + 0.9 );
		// the platforms in the window bays: 15 cm, carpeted dark, black fronts; none across the doors
		const dm = ( this.doorT[ 0 ] + this.doorT[ 1 ] ) / 2;
		for ( const [ e, ta, tb ] of [ [ fr, fr.glass[ 0 ], dm - 0.95 ], [ fr, dm + 0.95, fr.glass[ 1 ] ], [ sd, sd.glass[ 0 ], sd.glass[ 1 ] ] ] ) {

			const a0 = onE( e, ta, - GLASS_IN ), a1 = onE( e, tb, - GLASS_IN ), b0 = onE( e, ta, - T ), b1 = onE( e, tb, - T );
			b.use( 'carpet' ).quad( fl( a0, Y0 + 0.3 ), fl( a1, Y0 + 0.3 ), fl( b1, Y0 + 0.3 ), fl( b0, Y0 + 0.3 ), [ 0, 1, 0 ] );
			b.use( 'black' ).quad( fl( b0, YF ), fl( b1, YF ), fl( b1, Y0 + 0.3 ), fl( b0, Y0 + 0.3 ), [ e.nIn[ 0 ], 0, e.nIn[ 1 ] ] );
			// (the platforms' ends at the doors)
			if ( e === fr ) for ( const [ t, s ] of [ [ ta, 1 ], [ tb, - 1 ] ] ) if ( Math.abs( t - dm ) < 1 ) b.use( 'black' ).quad( fl( onE( e, t, - GLASS_IN ), YF ), fl( onE( e, t, - T ), YF ), fl( onE( e, t, - T ), Y0 + 0.3 ), fl( onE( e, t, - GLASS_IN ), Y0 + 0.3 ), [ - e.u[ 0 ] * s, 0, - e.u[ 1 ] * s ] );

		}

		for ( const e of [ fr, sd ] ) {

			const [ ta, tb ] = e.glass;
			const a0 = onE( e, ta, - GLASS_IN ), a1 = onE( e, tb, - GLASS_IN ), b0 = onE( e, ta, - T ), b1 = onE( e, tb, - T );
			// a bulkhead over the bay, its edge lit (a strip of light washing the glass's head); its face behind
			// the glass's head dark
			b.use( 'black' ).quad( fl( onE( e, ta, - GLASS_IN - 0.015 ), YC - 0.35 ), fl( onE( e, tb, - GLASS_IN - 0.015 ), YC - 0.35 ), fl( onE( e, tb, - GLASS_IN - 0.015 ), YC ), fl( onE( e, ta, - GLASS_IN - 0.015 ), YC ), [ e.n[ 0 ], 0, e.n[ 1 ] ] );
			b.use( 'drywall' ).quad( fl( b0, YC - 0.35 ), fl( b1, YC - 0.35 ), fl( b1, YC ), fl( b0, YC ), [ e.nIn[ 0 ], 0, e.nIn[ 1 ] ] );
			b.use( 'drywall' ).quad( fl( a0, YC - 0.35 ), fl( a1, YC - 0.35 ), fl( b1, YC - 0.35 ), fl( b0, YC - 0.35 ), [ 0, - 1, 0 ] );
			b.use( 'cove' ).quad( fl( onE( e, ta, - T + 0.12 ), YC - 0.352 ), fl( onE( e, tb, - T + 0.12 ), YC - 0.352 ), fl( onE( e, tb, - T + 0.05 ), YC - 0.352 ), fl( onE( e, ta, - T + 0.05 ), YC - 0.352 ), [ 0, - 1, 0 ] );

		}

	}

	// what's in it (the store's frame F: x along the front from B, z in; see the header)
	_fixtures( b ) {

		const F = this.F, r = rnd( 1027 );
		const fr = this.front, sd = this.side;
		// the far wall's line in the frame (x at z), the side's (its glass's inner edge)
		const xFar = ( z ) => {

			const a = this.toF( this.Ci ), c = this.toF( this.Di );
			return a[ 0 ] + ( c[ 0 ] - a[ 0 ] ) * ( z - a[ 1 ] ) / ( c[ 1 ] - a[ 1 ] );

		};
		const xSide = ( z ) => {

			const a = this.toF( this.side.p ), c = this.toF( this.side.q );
			return a[ 0 ] + ( c[ 0 ] - a[ 0 ] ) * ( z - a[ 1 ] ) / ( c[ 1 ] - a[ 1 ] );

		};
		const zBack = this.toF( this.Di )[ 1 ] - BACK_IN + 0.06; // (the back wall at zBack - 0.06)
		this.zBack = zBack;
		const people = this.spots;

		// ---- the dress forms in the windows: this year's jerseys and the black World Series tee
		const form = ( P, x, z, h, kind, out ) => {

			b.use( 'black' ).cyl( P, x, z, h, h + 0.02, 0.18, 0.18, 10, true );
			b.use( 'chrome' ).cyl( P, x, z, h + 0.02, h + 0.95, 0.012, 0.012, 6, false );
			const [ pal, print ] = kind;
			// the torso: a tapered shell, the shoulders, the garment's front printed
			b.use( pal ).cyl( P, x, z, h + 0.95, h + 1.45, 0.16, 0.2, 10, false );
			b.use( pal ).cyl( P, x, z, h + 1.45, h + 1.55, 0.2, 0.08, 10, true );
			b.use( pal ).box( P, x, h + 1.4, z, 0.6, 0.12, 0.17 );
			b.use( 'mannequin' ).cyl( P, x, z, h + 1.55, h + 1.66, 0.05, 0.05, 8, true );
			if ( print !== null ) printAt( b, P( x, h + 1.19, z - 0.205 ), 0.27, 0.14, out, cellUV( 'prints', print, 8, 2 ) );

		};
		const hp = Y0 + 0.3 - YF; // the platforms' top over the floor
		const FW = frame( F( 0, 0, 0 ), fr.u, fr.nIn );
		const x0 = this.toF( this.X2 )[ 0 ], dmx = ( x0 + this.toF( this.X3 )[ 0 ] ) / 2;
		form( FW, x0 + 0.5, 0.45, hp, [ 'pinstripe', PRINT.home ], fr.n );
		form( FW, dmx + 1.65, 0.45, hp, [ 'creamCloth', PRINT.alt ], fr.n );
		// (the side's bay: forms looking out at the gate)
		for ( const [ t, kind ] of [ [ 1.8, [ 'blackCloth', PRINT.ws ] ], [ 3.6, [ 'redCloth', PRINT.pJacket ] ], [ 5.3, [ 'roadGrey', PRINT.road ] ] ] ) {

			const p = add( add( sd.q, mul( sd.u, - t ) ), mul( sd.n, - 0.42 ) );
			form( frame( [ p[ 0 ], YF, p[ 1 ] ], sd.u.map( ( v ) => - v ), sd.nIn ), 0, 0, hp, kind, sd.n );

		}

		// a stack of folded tees on a cube in each front window
		for ( const [ x, a, c ] of [ [ x0 + 1.15, 'blackCloth', 'redCloth' ], [ dmx + 1.05, 'redCloth', 'greyCloth' ] ] ) {

			b.use( 'white' ).box( FW, x, hp + 0.25, 0.45, 0.42, 0.5, 0.4 );
			for ( let k = 0; k < 5; k ++ ) b.use( k % 2 ? a : c ).box( FW, x, hp + 0.52 + k * 0.04, 0.45, 0.36, 0.035, 0.28 );

		}

		// ---- the jersey wall: two rows face out on the slatwall, the caps over them, the header
		{

			const z0 = 1.2, z1 = zBack - 0.6;
			// (along the wall: from the front to the back)
			const W = ( z, h, o ) => {

				const x = xFar( z ) - 0.015 - o;
				return F( x, h, z );

			};
			const nW = [ - fr.u[ 0 ], 0, - fr.u[ 1 ] ];
			const kinds = [ [ 'pinstripe', PRINT.home ], [ 'redCloth', PRINT.champs ], [ 'roadGrey', PRINT.road ], [ 'creamCloth', PRINT.alt ], [ 'blackCloth', PRINT.ws ], [ 'navyCloth', PRINT.hoodie ], [ 'redCloth', PRINT.redOct ], [ 'powderCloth', null ] ];
			let j = 0;
			for ( const [ h0, h1 ] of [ [ 0.95, 1.75 ], [ 1.95, 2.75 ] ] ) {

				for ( let z = z0 + 0.35; z < z1 - 0.3; z += 0.62 ) {

					const [ pal, print ] = kinds[ ( j ++ * 5 + ( h0 > 1 ? 3 : 0 ) ) % kinds.length ];
					// the faceout arm, the hanger, the jersey: its body, its sleeves out either side
					b.use( 'chrome' ).box( frame( W( z, h1 + 0.02, 0.15 ), fr.u, fr.nIn ), 0, 0, 0, 0.3, 0.015, 0.015 );
					const jb = 0.12; // (off the wall)
					b.use( pal ).quad( W( z - 0.22, h0, jb ), W( z + 0.22, h0, jb ), W( z + 0.22, h1 - 0.12, jb ), W( z - 0.22, h1 - 0.12, jb ), nW );
					b.use( pal ).quad( W( z - 0.33, h1 - 0.45, jb + 0.005 ), W( z + 0.33, h1 - 0.45, jb + 0.005 ), W( z + 0.27, h1 - 0.04, jb + 0.005 ), W( z - 0.27, h1 - 0.04, jb + 0.005 ), nW );
					b.use( 'black' ).quad( W( z - 0.06, h1 - 0.12, jb + 0.008 ), W( z + 0.06, h1 - 0.12, jb + 0.008 ), W( z + 0.04, h1 - 0.04, jb + 0.008 ), W( z - 0.04, h1 - 0.04, jb + 0.008 ), nW );
					if ( print !== null ) printAt( b, W( z, h1 - 0.335, jb + 0.01 ), 0.34, 0.17, [ nW[ 0 ], nW[ 2 ] ], cellUV( 'prints', print, 8, 2 ) );
					// a few more of the same behind it (the arm holds five)
					b.use( pal ).quad( W( z - 0.22, h0 + 0.02, jb - 0.03 ), W( z + 0.22, h0 + 0.02, jb - 0.03 ), W( z + 0.22, h1 - 0.12, jb - 0.03 ), W( z - 0.22, h1 - 0.12, jb - 0.03 ), nW );

				}

			}

			// the caps on their hooks, three rows over the jerseys
			const caps = [ [ 'redCloth', PRINT.capRed ], [ 'navyCloth', PRINT.capNavy ], [ 'blackCloth', PRINT.capWS ], [ 'pinstripe', PRINT.capWhite ] ];
			for ( let row = 0; row < 3; row ++ ) for ( let z = z0 + 0.2; z < z1 - 0.1; z += 0.34 ) {

				const [ pal, print ] = caps[ ( Math.floor( z / 0.34 ) + row * 2 + ( r() < 0.2 ? 1 : 0 ) ) % caps.length ];
				this._cap( b, faceFrame( W( z, 2.95 + row * 0.3, 0.1 ), [ - fr.u[ 0 ], - fr.u[ 1 ] ] ), pal, print );

			}

			// the header: NATIONAL LEAGUE CHAMPIONS, lit
			const zm = ( z0 + z1 ) / 2, hw = Math.min( 2.4, ( z1 - z0 ) / 2 - 0.2 );
			b.use( 'black' ).quad( W( zm + hw + 0.05, 3.85, 0.04 ), W( zm - hw - 0.05, 3.85, 0.04 ), W( zm - hw - 0.05, 4.65, 0.04 ), W( zm + hw + 0.05, 4.65, 0.04 ), nW );
			printAt( b, W( zm, 3.9 + hw / 2, 0.05 ), hw * 2, hw, [ nW[ 0 ], nW[ 2 ] ], cellUV( 'champsSign' ), 'printLit' );
			// the shoppers' places along it
			for ( let z = z0 + 0.8; z < z1 - 0.4; z += 1.5 ) people.push( { x: xFar( z ) - 0.85, z, face: [ 1, 0 ], kind: 'wall', reach: [ 0.12, 1.4, - 0.5 ] } );

		}

		// ---- the cash wrap across the back: the counter, two registers, the bags; the cap wall behind it,
		// the World Series board over it
		{

			const zc = zBack - 1.0, x0 = 1.1, x1 = 4.5, xc = ( x0 + x1 ) / 2;
			b.use( 'maple' ).box( F, xc, 0.48, zc, x1 - x0, 0.96, 0.62, [ 'bottom' ] );
			b.use( 'navyWall' ).box( F, xc, 0.46, zc - 0.315, x1 - x0 - 0.04, 0.82, 0.01, [ 'back', 'bottom' ] );
			b.use( 'granite' ).box( F, xc, 0.98, zc, x1 - x0 + 0.06, 0.04, 0.68 );
			printAt( b, F( xc, 0.5, zc - 0.322 ), 0.7, 0.35, fr.n, cellUV( 'prints', PRINT.bag, 8, 2 ) );
			for ( const x of [ x0 + 0.7, x1 - 0.7 ] ) {

				b.use( 'plastic' ).box( F, x, 1.06, zc + 0.1, 0.4, 0.12, 0.34 );
				b.use( 'plastic' ).box( F, x, 1.28, zc + 0.12, 0.05, 0.3, 0.05 );
				b.use( 'screen' ).quad( F( x - 0.16, 1.36, zc + 0.08 ), F( x + 0.16, 1.36, zc + 0.08 ), F( x + 0.16, 1.58, zc + 0.12 ), F( x - 0.16, 1.58, zc + 0.12 ), F.dir( 0, 0.2, - 1 ) );
				people.push( { x, z: zc + 0.62, face: [ 0, - 1 ], kind: 'staff' } );

			}

			// a stack of the red bags, folded tees waiting
			b.use( 'bag' ).box( F, xc, 1.06, zc + 0.12, 0.45, 0.12, 0.3 );
			// the line: out from the counter, toward the door
			for ( let k = 0; k < 5; k ++ ) people.push( { x: xc + ( k % 2 ? 0.2 : - 0.15 ) - Math.max( 0, k - 3 ) * 0.5, z: zc - 0.85 - Math.min( k, 3 ) * 0.55, face: [ 0.15 * ( k % 2 ? 1 : - 1 ), 1 ], kind: 'line', k } );
			// the cap wall: six rows on the back's slatwall
			const caps = [ [ 'redCloth', PRINT.capRed ], [ 'redCloth', PRINT.capRed ], [ 'navyCloth', PRINT.capNavy ], [ 'blackCloth', PRINT.capWS ], [ 'pinstripe', PRINT.capWhite ], [ 'darkRed', PRINT.capRed ] ];
			const xa = xSide( zBack ) + T + 0.25, xb = xFar( zBack ) - 0.4;
			for ( let row = 0; row < 5; row ++ ) for ( let x = xa; x < xb; x += 0.3 ) {

				const [ pal, print ] = caps[ ( Math.floor( x / 0.3 ) * 7 + row * 3 + Math.floor( r() * 1.4 ) ) % caps.length ];
				this._cap( b, faceFrame( F( x, 1.25 + row * 0.32, zBack - 0.17 ), fr.n ), pal, print );

			}

			// the board: yellow-framed, lit, on the back wall over the caps
			b.use( 'signYellow' ).box( F, xc, 3.75, zBack - 0.1, 2.5, 1.3, 0.06 );
			printAt( b, F( xc, 3.73, zBack - 0.14 ), 2.4, 1.2, fr.n, cellUV( 'wsSign' ), 'printLit' );

		}

		// ---- the floor: round racks of red jackets and home whites, two tables
		const round = ( x, z, pals ) => {

			b.use( 'chrome' ).cyl( F, x, z, 0.0, 0.03, 0.32, 0.3, 10, true );
			b.use( 'chrome' ).cyl( F, x, z, 0.03, 1.32, 0.022, 0.022, 6, false );
			b.use( 'chrome' ).cyl( F, x, z, 1.3, 1.33, 0.52, 0.52, 16, false );
			// the garments hung round it on their hangers, shoulders out: each a body, its shoulders sloped in, the
			// sleeves' fall either side; each its own length, a few askew
			const n = 24;
			for ( let k = 0; k < n; k ++ ) {

				const a = k / n * Math.PI * 2 + ( r() - 0.5 ) * 0.12, c = Math.cos( a ), s = Math.sin( a );
				const G = frame( F( x + c * 0.58, 0, z + s * 0.58 ), [ - s * fr.u[ 0 ] + c * fr.nIn[ 0 ], - s * fr.u[ 1 ] + c * fr.nIn[ 1 ] ], [ c * fr.u[ 0 ] + s * fr.nIn[ 0 ], c * fr.u[ 1 ] + s * fr.nIn[ 1 ] ] );
				const pal = pals[ Math.floor( r() * pals.length ) ], len = 0.6 + r() * 0.12, th = 0.05 + r() * 0.03;
				b.use( pal ).box( G, 0, 1.24 - len / 2 - 0.05, 0, th, len, 0.46 );
				b.use( pal ).box( G, 0, 1.22, 0, th * 0.9, 0.06, 0.3, [ 'bottom' ] );
				b.use( pal ).box( G, th * 0.6, 1.0, 0, 0.02, 0.4, 0.5, [ 'top', 'bottom' ] );
				b.use( 'chrome' ).box( G, 0, 1.28, - 0.04, 0.01, 0.07, 0.01, [ 'bottom' ] );

			}

			for ( let k = 0; k < 4; k ++ ) {

				const a = k * Math.PI / 2 + 0.6;
				people.push( { x: x + Math.cos( a ) * 1.05, z: z + Math.sin( a ) * 1.05, face: [ - Math.cos( a ), - Math.sin( a ) ], kind: 'rack', reach: [ 0.1, 1.25, - 0.42 ] } );

			}

		};

		round( 1.3, zBack - 2.7, [ 'redCloth', 'redCloth', 'darkRed', 'blackCloth', 'redCloth' ] );
		round( 4.3, zBack - 2.5, [ 'pinstripe', 'roadGrey', 'creamCloth', 'pinstripe', 'navyCloth' ] );
		// two tables: folded tees in stacks, caps in a row
		for ( const [ x, z, w ] of [ [ 1.75, 1.95, 1.2 ], [ 4.3, 1.95, 1.0 ] ] ) {

			b.use( 'maple' ).box( F, x, 0.43, z, w, 0.04, 0.85 );
			b.use( 'maple' ).box( F, x, 0.82, z, w + 0.06, 0.05, 0.9 );
			for ( const sx of [ - 1, 1 ] ) b.use( 'black' ).box( F, x + sx * ( w / 2 - 0.05 ), 0.4, z, 0.05, 0.8, 0.8, [ 'top', 'bottom' ] );
			const tees = [ 'blackCloth', 'redCloth', 'greyCloth', 'whiteCloth', 'navyCloth', 'redCloth' ];
			for ( let i = 0; i < 3; i ++ ) for ( let j = 0; j < 2; j ++ ) {

				const pal = tees[ ( i * 2 + j + Math.floor( x ) ) % tees.length ], hgt = 4 + Math.floor( r() * 5 );
				for ( let k = 0; k < hgt; k ++ ) b.use( pal ).box( F, x - w / 2 + 0.25 + i * ( w - 0.5 ) / 2 + ( r() - 0.5 ) * 0.02, 0.865 + k * 0.032, z - 0.2 + j * 0.4, 0.34, 0.03, 0.26 );
				if ( j === 0 ) {

					// the top tee's print, face up (read from the front of the table)
					const xs = x - w / 2 + 0.25 + i * ( w - 0.5 ) / 2, ys = 0.866 + hgt * 0.032, zs = z - 0.2;
					b.use( 'print' ).print( F( xs + 0.15, ys, zs - 0.07 ), F( xs - 0.15, ys, zs - 0.07 ), F( xs - 0.15, ys, zs + 0.08 ), F( xs + 0.15, ys, zs + 0.08 ), [ 0, 1, 0 ], cellUV( 'prints', pal === 'blackCloth' ? PRINT.ws : pal === 'redCloth' ? PRINT.champs : pal === 'navyCloth' ? PRINT.hoodie : PRINT.kids, 8, 2 ) );

				}

			}

			people.push( { x, z: z - 0.95, face: [ 0, 1 ], kind: 'table', reach: [ 0.1, 0.95, - 0.4 ] } );
			people.push( { x: x + w / 2 + 0.45, z: z + 0.15, face: [ - 1, 0 ], kind: 'table', reach: [ 0.1, 0.95, - 0.4 ] } );

		}

		// ---- the boards hung over the floor (both faces): the World Series board toward the glass, the
		// champions' over the racks
		for ( const [ x, z, key, w ] of [ [ 3.0, 3.35, 'wsSign', 1.8 ], [ 2.0, zBack - 1.85, 'champsSign', 1.6 ] ] ) {

			const h = w / 2, y0 = YC - YF - 0.9 - h;
			b.use( key === 'wsSign' ? 'signYellow' : 'redPaint' ).box( F, x, y0 + h / 2, z, w + 0.1, h + 0.1, 0.05 );
			printAt( b, F( x, y0 + h / 2, z - 0.028 ), w, h, fr.n, cellUV( key ), 'printLit' );
			printAt( b, F( x, y0 + h / 2, z + 0.028 ), w, h, fr.nIn, cellUV( key ), 'printLit' );
			for ( const sx of [ - 1, 1 ] ) b.use( 'chrome' ).box( F, x + sx * w * 0.4, ( y0 + h + YC - YF ) / 2, z, 0.006, YC - YF - y0 - h, 0.006 );

		}

		// a few more places: in the windows looking at the forms, by the side's glass
		people.push( { x: dmx, z: 1.2, face: [ - 0.3, - 1 ], kind: 'look' } );
		people.push( { x: xSide( 4.8 ) + T + 0.3, z: 4.8, face: [ - 1, 0 ], kind: 'look' } );

	}

	// a cap on a hook: the crown (a dome), the bill toward + z of S, its front printed
	_cap( b, S, pal, print ) {

		b.use( pal ).cyl( S, 0, 0, 0.0, 0.07, 0.095, 0.075, 8, true );
		b.use( pal ).box( S, 0, 0.005, 0.1, 0.16, 0.012, 0.1 );
		b.use( 'print' ).print( S( - 0.05, 0.022, 0.088 ), S( 0.05, 0.022, 0.088 ), S( 0.04, 0.068, 0.074 ), S( - 0.04, 0.068, 0.074 ), S.dir( 0, 0.3, 1 ), cellUV( 'prints', print, 8, 2 ) );

	}

	// ---------------------------------------------------------------- the glass, its frame

	_glass() {

		const fb = new Inside();
		fb.room( null );
		const gl = new Quads();
		for ( const e of [ this.front, this.side ] ) {

			const [ ta, tb ] = e.glass;
			const at = ( t, y, d = - GLASS_IN ) => [ e.p[ 0 ] + e.u[ 0 ] * t + e.n[ 0 ] * d, y, e.p[ 1 ] + e.u[ 1 ] * t + e.n[ 1 ] * d ];
			const n3 = [ e.n[ 0 ], 0, e.n[ 1 ] ];
			const y0 = Y0 + 0.3;
			const door = e === this.front;
			if ( door ) {

				// (the doors' glass down to the floor)
				const [ d0, d1 ] = this.doorT;
				gl.add( at( ta, y0 ), at( d0, y0 ), at( d0, YC ), at( ta, YC ), n3, 0, 1 );
				gl.add( at( d0, YF ), at( d1, YF ), at( d1, YC ), at( d0, YC ), n3, 0, 1 );
				gl.add( at( d1, y0 ), at( tb, y0 ), at( tb, YC ), at( d1, YC ), n3, 0, 1 );

			} else gl.add( at( ta, y0 ), at( tb, y0 ), at( tb, YC ), at( ta, YC ), n3, 0, 1 );
			// the bronze frame: mullions every 1.4 m or so (the front's round its doors), the transom, the head and sill
			const G = frame( [ ...at( ( ta + tb ) / 2, YF ) ], e.u, e.nIn );
			const L = tb - ta;
			const mull = ( x, w, h0 = y0 ) => fb.use( 'bronze' ).box( G, x, ( h0 + YC ) / 2 - YF, 0, w, YC - h0, 0.14 );
			const nm = Math.max( 2, Math.round( L / 1.4 ) );
			const xs = door ? [ - L / 2, - 1.75, - 0.9, 0.9, 1.75, L / 2 ] : Array.from( { length: nm + 1 }, ( _, k ) => - L / 2 + k * L / nm );
			for ( const x of xs ) mull( x, Math.abs( Math.abs( x ) - L / 2 ) < 0.01 ? 0.1 : 0.07, door && Math.abs( Math.abs( x ) - 0.9 ) < 0.01 ? YF : y0 );
			for ( const [ a, c ] of door ? [ [ - L / 2, - 0.9 ], [ 0.9, L / 2 ] ] : [ [ - L / 2, L / 2 ] ] ) fb.use( 'bronze' ).box( G, ( a + c ) / 2, y0 - YF + 0.03, 0, c - a, 0.06, 0.16 );
			fb.use( 'bronze' ).box( G, 0, YC - YF - 0.03, 0, L, 0.06, 0.16 );
			fb.use( 'bronze' ).box( G, 0, 3.0, 0, L, 0.07, 0.14 );
			if ( door ) {

				// a pair of doors: the meeting stiles, the push bars both sides, the transom over them; the
				// threshold flush with the plaza
				fb.use( 'chrome' ).box( G, 0, 1.15, 0, 0.09, 2.3, 0.08 );
				fb.use( 'bronze' ).box( G, 0, 2.33, 0, 1.8, 0.07, 0.14 );
				for ( const dc of [ - 0.45, 0.45 ] ) {

					fb.use( 'chrome' ).box( G, dc, 1.05, - 0.07, 0.62, 0.035, 0.035 );
					fb.use( 'chrome' ).box( G, dc, 1.05, 0.07, 0.62, 0.035, 0.035 );

				}

				fb.use( 'granite' ).box( G, 0, 0.005, 0, 1.8, 0.01, 0.3 );

			}

		}

		// a roof over the store's ceiling, for the shadows: the block's brick walls stand open-topped 20 m up,
		// and the stadium's lights (and the sun) shone down through the ceiling onto the floor (the room itself
		// casts none: it's drawn only from the plaza)
		{

			const { A, B, C, D } = STORE, up = ( p ) => [ p[ 0 ], YC + 0.03, p[ 1 ] ];
			fb.use( 'blackPaint' ).quad( up( B ), up( C ), up( D ), up( A ), [ 0, 1, 0 ] );

		}

		const frameMesh = fb.mesh( this.material, 'clubhouse-frame' );
		frameMesh.userData.dynamic = false;
		frameMesh.castShadow = true;
		this.group.add( frameMesh );
		// the glass: a faint grey tint; by day the sky in it (the environment's reflection, by the alpha), more
		// at a glance; after dark nearly clear
		const gm = standard( { name: 'clubhouse-glass', roughness: 0.04, metalness: 0.2, transparent: true, depthWrite: false, side: 'double', modules: [ commonModule ],
			surface: /* wgsl */`
	let N = normalize( in.N );
	let V = normalize( frame.cameraPos - in.P );
	let cosv = abs( dot( N, V ) );
	let fres = pow( 1.0 - clamp( cosv, 0.0, 1.0 ), 4.0 );
	let nk = smoothstep( 0.1, 0.7, frame.night );
	s.albedo = vec3f( 0.025, 0.03, 0.032 );
	s.alpha = clamp( mix( 0.24, 0.08, nk ) + 0.55 * fres, 0.0, 0.92 );
	s.roughness = 0.04 + 0.1 * smoothstep( 0.6, 0.9, mx_noise_float2( in.P.xz * 2.5 + in.P.y * 1.7 ) );
` } );
		gm.underwaterLighting = 'none';
		gm.setDefine( 'DRY', 1 );
		const g = new Mesh( gl.geometry(), gm );
		g.name = 'clubhouse-glass';
		g.layers.set( 2 );
		g.userData.dynamic = true;
		this.glassMesh = g;
		this.group.add( g );

	}

	// ---------------------------------------------------------------- the door behind 134, the Home Stand

	// The concourse's own merchandise units (Concourse.js standSpots): the Home Stand ('merch') and the
	// store's inside door ('clubhouse') behind 134. In the clubhouse's doorway: two racks and a board; their
	// people go in the list with the rest
	_concourse() {

		this.conc = [];
		const spots = this.app?.concourse?.standSpots || [];
		const hs = spots.find( ( s ) => s.what === 'merch' && s.sec === 134 );
		const ch = spots.find( ( s ) => s.what === 'clubhouse' );
		const y = LEVELS.mainConcourse;
		if ( ! hs && ! ch ) return;
		const b = new Inside();
		const lamps = [];
		for ( const st of [ hs, ch ].filter( Boolean ) ) {

			const P = frame( [ st.mid[ 0 ], y, st.mid[ 1 ] ], st.u, st.n );
			for ( const x of [ - 0.8, 0.8 ] ) lamps.push( [ ...P( x, 2.4, - 1.2 ), 1.2 ] );

		}

		b.room( { lamps, amb: 0.25, bounce: 0.3 } );
		if ( ch ) {

			// (its frame: x along the front, z out toward the concourse; the doorway's 3 m wide, 2.4 deep)
			const P = frame( [ ch.mid[ 0 ], y, ch.mid[ 1 ] ], ch.u, ch.n );
			const r = rnd( 134 );
			for ( const [ x, z, palA, palB ] of [ [ - 0.85, - 1.45, 'redCloth', 'darkRed' ], [ 0.75, - 1.75, 'pinstripe', 'blackCloth' ] ] ) {

				b.use( 'chrome' ).box( P, x, 1.38, z, 1.1, 0.025, 0.025 );
				for ( const sx of [ - 0.55, 0.55 ] ) b.use( 'chrome' ).box( P, x + sx, 0.69, z, 0.025, 1.38, 0.025 );
				b.use( 'chrome' ).box( P, x, 0.02, z, 1.2, 0.03, 0.45 );
				for ( let k = 0; k < 14; k ++ ) b.use( r() < 0.65 ? palA : palB ).box( P, x - 0.48 + k * 0.074, 1.0, z, 0.035, 0.68 + r() * 0.06, 0.5, [ 'bottom' ] );

			}

			b.use( 'signYellow' ).box( P, 0, 2.05, - 2.3, 1.3, 0.68, 0.04 );
			printAt( b, P( 0, 2.05, - 2.27 ), 1.2, 0.6, ch.n, cellUV( 'wsSign' ), 'printLit' );
			this.conc.push( { P, kind: 'greeter', x: 1.25, z: 0.35, face: [ 0, 1 ] } );
			this.conc.push( { P, kind: 'rack', x: - 0.85, z: - 0.75, face: [ 0, - 1 ], reach: [ 0.1, 1.3, - 0.45 ] } );
			this.conc.push( { P, kind: 'rack', x: 0.8, z: - 1.05, face: [ 0.2, - 1 ], reach: [ 0.1, 1.3, - 0.45 ] } );
			this.conc.push( { P, kind: 'out', x: - 0.2, z: 0.6, face: [ 0.3, 1 ] } );

		}

		if ( hs ) {

			// the Home Stand (FI1's racks and counter): a clerk at the register, shoppers at the racks and the table
			const P = frame( [ hs.mid[ 0 ], y, hs.mid[ 1 ] ], hs.u, hs.n );
			this.conc.push( { P, kind: 'clerk', x: 1.1, z: - 1.65, face: [ 0, 1 ] } );
			this.conc.push( { P, kind: 'clerk', x: - 1.0, z: - 2.0, face: [ 0.4, 1 ] } );
			this.conc.push( { P, kind: 'rack', x: - 0.75, z: - 0.62, face: [ 0, - 1 ], reach: [ 0.1, 1.3, - 0.45 ] } );
			this.conc.push( { P, kind: 'pay', x: 1.1, z: 0.05, face: [ 0, - 1 ] } );
			this.conc.push( { P, kind: 'table', x: 0.9, z: 1.55, face: [ 0, - 1 ], reach: [ 0.08, 0.95, - 0.42 ] } );
			this.conc.push( { P, kind: 'table', x: 1.65, z: 1.25, face: [ - 0.8, - 0.6 ], reach: [ 0.08, 0.95, - 0.42 ] } );

		}

		if ( b.count ) {

			const m = b.mesh( this.material, 'clubhouse-concourse' );
			m.userData.dynamic = false;
			this.group.add( m );

		}

	}

	// ---------------------------------------------------------------- who's in

	_people() {

		const r = rnd( 2008 );
		this.cast = new Cast( { parent: this.group, max: 60 } );
		this.tempo = new Tempo( [ this.cast ], { every: 5 } );
		this.who = [];
		const staffLook = ( rr ) => {

			const L = dress( rr, { poncho: 0 } );
			Object.assign( L, { top: TOP.polo, color: COLOR.navy, sleeves: COLOR.navy, chest: CHEST.none, back: 0, hat: HAT.none, poncho: 0, scarf: 0, gloves: false, pants: 2 + Math.floor( rr() * 2 ), shoes: 1, gear: GEAR.credential, dry: true } );
			return L;

		};
		const add = ( L, x, z, face, o = {} ) => {

			const p = this.cast.add( L );
			if ( ! p ) return null;
			p.x = x; p.y = o.y ?? YF; p.z = z;
			p.yaw = yawOf( face );
			p.scale = sizeOf( L, r );
			p.visible = false;
			const a = p.pose;
			if ( o.bag ) {

				a.armL = [ 0.05, 0.12, 0, 0.2 ];
				a.propL = PROP.bag;

			}

			const w = { p, o, ph: r() * 10, rank: r(), reach: o.reach ? armIK( 1, o.reach ) : null, base: { armL: a.armL.slice(), armR: a.armR.slice(), propL: a.propL, propR: a.propR } };
			this.who.push( w );
			return w;

		};
		// in the store
		const F = this.F;
		for ( const s of this.spots ) {

			const q = F( s.x, 0, s.z ), fd = F.dir( s.face[ 0 ], 0, s.face[ 1 ] );
			const face = [ fd[ 0 ], fd[ 2 ] ];
			if ( s.kind === 'staff' ) {

				add( staffLook( r ), q[ 0 ], q[ 2 ], face, { store: true, staff: true, always: true } );
				continue;

			}

			const L = dress( r, { poncho: 0 } );
			L.dry = true;
			add( L, q[ 0 ], q[ 2 ], face, { store: true, reach: s.reach, kind: s.kind, k: s.k ?? 0, bag: s.kind === 'line' ? r() < 0.4 : s.kind === 'look' && r() < 0.6 } );

		}

		// a floor man straightening the jersey wall
		{

			const s = this.spots.find( ( q ) => q.kind === 'wall' );
			if ( s ) {

				const q = F( s.x + 0.2, 0, s.z + 0.7 ), fd = F.dir( 1, 0, 0.2 );
				add( staffLook( r ), q[ 0 ], q[ 2 ], [ fd[ 0 ], fd[ 2 ] ], { store: true, staff: true, always: true, reach: [ 0.15, 1.55, - 0.4 ] } );

			}

		}

		// at the door behind 134, and the Home Stand
		for ( const c of this.conc ) {

			const q = c.P( c.x, 0, c.z ), fd = c.P.dir( c.face[ 0 ], 0, c.face[ 1 ] );
			const face = [ fd[ 0 ], fd[ 2 ] ];
			const staff = c.kind === 'greeter' || c.kind === 'clerk';
			let L;
			if ( staff ) L = staffLook( r );
			else {

				L = dress( r, { poncho: 0 } );
				L.dry = true;

			}

			add( L, q[ 0 ], q[ 2 ], face, { conc: true, staff, always: staff, reach: c.reach, kind: c.kind, y: LEVELS.mainConcourse, bag: c.kind === 'out' } );

		}

		this.cast.bounds = new Sphere( new Vector3( - 92, YF + 1, 12 ), 30 );

	}

	// ---------------------------------------------------------------- each frame

	update( dt, director, camera ) {

		if ( ! camera || ! this.field ) return;
		const F = this.field;
		const [ cx, cz ] = F.toField( camera.position.x, camera.position.z );
		const cy = camera.position.y - F.y0;
		const tv = this.app?.camMode && this.app.camMode !== 'walk';
		// the room: from the plaza and over it (in front of either glass face), within 200 m; never from FOX's cameras
		let sees = false;
		if ( this.room && ! tv ) {

			const B = STORE.B;
			const d = Math.hypot( cx - B[ 0 ], cz - B[ 1 ] );
			const front = dot( sub( [ cx, cz ], this.front.p ), this.front.n ) > 0, side = dot( sub( [ cx, cz ], this.side.p ), this.side.n ) > 0;
			sees = d < 200 && ( front || side || d < 12 ) && cy > Y0 - 3;
			this.room.visible = sees;
			this.near = sees && d < 45;

		}

		// the concourse's door and the Home Stand: within 45 m, on the concourse
		const cc = this.conc[ 0 ]?.P( 0, 0, 0 );
		const concNear = !! cc && ! tv && Math.hypot( cx - cc[ 0 ], cz - cc[ 2 ] ) < 45 && Math.abs( cy - LEVELS.mainConcourse - 1.6 ) < 6;
		// how busy: packed before the first pitch, in the rain delay and after the last out; a third of that
		// while the game's on
		const ns = nightState( director );
		const busy = ns.suspended || ns.celebrate ? 1 : ns.between ? 0.9 : Math.min( 1, ns.busy * 0.55 );
		let changed = false;
		for ( const w of this.who ) {

			const on = ( w.o.store ? this.near : concNear ) && ( w.o.always || w.rank < ( w.o.conc ? Math.max( busy, 0.65 ) : busy ) || ( w.o.kind === 'line' && w.o.k < 2 && busy > 0.3 ) );
			if ( w.p.visible !== on ) {

				w.p.visible = on;
				w.p.fresh = true;
				changed = true;

			}

		}

		if ( ! this.near && ! concNear && ! changed ) return;
		const sdt = this.tempo.step( dt, camera );
		if ( ! sdt ) return;
		this.time = ( this.time || 0 ) + sdt;
		const t = this.time;
		for ( const w of this.who ) {

			if ( ! w.p.visible ) continue;
			const a = w.p.pose, ph = w.ph;
			a.headYaw = Math.sin( t * 0.3 + ph ) * 0.35;
			a.headPitch = w.reach ? 0.25 : 0.05;
			a.blink = ( t * 0.31 + ph ) % 1 < 0.04 ? 1 : 0;
			a.breath = ( t * 0.25 + ph ) % 1;
			a.mouth = w.o.staff || w.o.kind === 'line' ? Math.max( 0, Math.sin( t * 5.3 + ph * 3 ) ) * ( Math.sin( t * 0.5 + ph ) > 0.4 ? 0.5 : 0 ) : 0;
			// browsing: a hand out to the rack (a hanger slid along), back, a look; a shirt held up now and then
			if ( w.reach ) {

				const c = ( t * 0.12 + ph ) % 1;
				a.armR = c < 0.45 ? w.reach : w.base.armR;
				if ( c > 0.62 && c < 0.75 && ! w.o.staff ) {

					a.armL = GESTURE.read[ 0 ]; a.armR = GESTURE.read[ 1 ];

				} else a.armL = w.base.armL;

				a.headPitch = c < 0.45 ? 0.3 : 0.08;

			}

			// paying, the clerk taking it
			if ( w.o.kind === 'pay' || ( w.o.kind === 'line' && w.o.k === 0 ) ) a.armR = ( t * 0.2 + ph ) % 1 < 0.35 ? GESTURE.reach[ 1 ] : w.base.armR;

		}

		this.cast.update();

	}

}
