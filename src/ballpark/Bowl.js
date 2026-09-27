import { Group, Mesh, InstancedMesh, BoxGeometry, BufferGeometry, Float32BufferAttribute, Vector2, Vector3, Matrix4, Quaternion, Euler, Color } from '../engine/index.js';
import { triangulateShape } from '../engine/math/ShapeUtils.js';
import { commonModule } from '../engine/render/wgsl/common.js';
import { ShaderModule } from '../engine/gpu/Shader.js';
import { standard } from '../materials/Materials.js';
import { beam, box, alongPolyline, nearestAlong } from './geo.js';
import { GATES } from './Exterior.js';
import { buildTier, tierTop, standsMaterials, Quads, SOFFIT_WGSL } from './Stands.js';
import { Crowd } from './Crowd.js';
import { FT, FOOTPRINT, OUTFIELD, FOUL_TERRITORY, DUGOUTS, BULLPENS, LEVELS, fencePoint } from './layout.js';

// The seating bowl round the field and the street-level concourse round the bowl.
//
// The field sits in a pit 23 ft below the street. The pit is everything below street level: the field,
// the field level seats (100s) climbing from the foul territory wall up to the main concourse, the
// seats behind the left and right field walls, the batter's eye and the bullpens in center. Round the
// pit, out to the stadium's footprint, the ground is at street level: the main concourse (and, in
// center field, Ashburn Alley). Upper decks stand on it.
//
// Everything is built in the field frame (layout.js) inside the Field's group, so heights here are
// above the field: street level is LEVELS.mainConcourse.

const STREET = LEVELS.mainConcourse;

// Rooms behind glass (the suites, the press box's booths): the view ray traced into a box behind the
// window, and people in it drawn square-on in planes a set depth in (interior mapping: parallax without
// geometry). figure(): a person, `p` in metres across the plane and up from the floor, the top of the
// head at h; returns the colour and whether the ray hit them.
const interiorModule = new ShaderModule( {
	name: 'interiors',
	deps: [ commonModule ],
	code: /* wgsl */`
fn ihash( x: f32 ) -> f32 { return fract( sin( x * 12.9898 + 4.1 ) * 43758.5453 ); }

fn figure( p: vec2f, h: f32, coat: vec3f, hair: vec3f, skin: vec3f, headset: f32 ) -> vec4f {
	// the head: hair over the crown, the face below it (lit by the room and the monitors)
	let hd = ( p - vec2f( 0.0, h - 0.115 ) ) / vec2f( 0.085, 0.118 );
	if ( dot( hd, hd ) < 1.0 ) {
		var c = skin;
		if ( ( p.y > h - 0.075 ) || ( abs( p.x ) > 0.07 && p.y > h - 0.14 ) ) { c = hair; }
		if ( headset > 0.5 && p.y > h - 0.03 ) { c = vec3f( 0.015 ); }
		return vec4f( c, 1.0 );
	}
	// a headset's ear cups and the microphone's boom
	if ( headset > 0.5 ) {
		if ( length( vec2f( abs( p.x ) - 0.088, p.y - ( h - 0.125 ) ) ) < 0.036 ) { return vec4f( vec3f( 0.015 ), 1.0 ); }
		if ( p.x > 0.0 && p.x < 0.1 && abs( p.y - ( h - 0.2 - p.x * 0.4 ) ) < 0.009 ) { return vec4f( vec3f( 0.02 ), 1.0 ); }
	}
	// the neck, the shoulders (rounded) and the body
	if ( abs( p.x ) < 0.05 && p.y > h - 0.29 && p.y <= h - 0.2 ) { return vec4f( skin * 0.75, 1.0 ); }
	let sy = h - 0.28;
	let w = 0.21 - 0.12 * smoothstep( sy - 0.03, sy + 0.06, p.y );
	if ( abs( p.x ) < w && p.y < sy + 0.06 && p.y > 0.0 ) {
		// a collar and a zip / buttons down the front
		var c = coat;
		if ( abs( p.x ) < 0.012 && p.y < sy ) { c = coat * 0.6; }
		// standing: dark trousers below the coat, a gap between the legs
		if ( p.y < h * 0.45 && abs( p.x ) < 0.025 ) { return vec4f( 0.0 ); }
		if ( p.y < h * 0.52 ) { c = vec3f( 0.04, 0.04, 0.05 ); }
		return vec4f( c, 1.0 );
	}
	return vec4f( 0.0 );
}
`,
} );
const ROW = 0.84; // row depth in the upper decks (33 in)
const FROW = 0.8; // and at field level (31.5 in)
// rows by level, from the seating chart (2008): field level 37 in the infield, 16 in right, 21 in left;
// the Hall of Fame Club 8, the Terrace 300s 8 and 400s 16, the Pavilion 12 and the Pavilion Deck 21
const ROWS = { field: 37, right: 16, left: 21, club: 8, t300: 8, t400: 16, pavilion: 12, pavilionDeck: 21 };

export class Bowl {

	// crowd: false leaves the seats empty of fans (?only= without 'crowd'; the seats still fold down
	// where they'd sit)
	constructor( { field, colliders, crowd = true } ) {

		this.field = field;
		this.colliders = colliders;
		this.group = new Group();
		this.group.name = 'bowl';
		field.group.add( this.group );
		this.materials = standsMaterials();
		this.crowd = this.materials.crowd = new Crowd();
		this.crowd.off = ! crowd;
		this.crowd.toWorld = ( x, z ) => field.toWorld( x, z );
		const worldYaw = field.group.rotation.y;
		this.ctx = {
			toWorld: ( x, z ) => field.toWorld( x, z ),
			worldYaw,
			colliders: { addBox: ( c, h, yaw, o ) => colliders.addBox( c.clone().setY( c.y + field.y0 ), h, yaw, o ) },
			materials: this.materials,
		};

		this.tiers = this._lowerTiers();
		for ( const t of this.tiers ) this.group.add( buildTier( t, this.ctx ) );
		this.pit = this._pitOutline();
		this._buildStreetLevel();
		this._buildPitWalls();
		this._buildUpperDecks();
		this._buildNetting();

	}

	// ground height in the field frame: street level outside the pit, the field inside it
	heightAt( x, z ) {

		return pointInPolygon( x, z, this.pit ) ? this.field.fieldHeightAt( x, z ) : STREET;

	}

	// ---------------------------------------------------------------- field level (100s)

	_lowerTiers() {

		// foul territory: from beyond the right field pole round behind home plate to beyond the left
		// field one, climbing from the top of the foul territory wall to the main concourse. The dugouts
		// take the first four rows in front of them.
		const dugoutSegs = [];
		for ( const d of Object.values( DUGOUTS ) ) {

			const i = FOUL_TERRITORY.findIndex( ( p ) => Math.hypot( p[ 0 ] - d[ 0 ][ 0 ], p[ 1 ] - d[ 0 ][ 1 ] ) < 0.05 );
			const j = FOUL_TERRITORY.findIndex( ( p ) => Math.hypot( p[ 0 ] - d[ 1 ][ 0 ], p[ 1 ] - d[ 1 ][ 1 ] ) < 0.05 );
			dugoutSegs.push( Math.min( i, j ) );

		}

		const infield = {
			name: 'field-level',
			front: FOUL_TERRITORY,
			outward: [ 0, - 40 ],
			// the first row just behind the wall round foul territory (not in its face)
			start: 0.4,
			y0: 1.2,
			rows: ROWS.field,
			depth: FROW,
			// the risers grow toward the back (the sightline curve): 1.2 m at the front row, the street at the top
			rise: ( r ) => 0.1 + 0.12 * r / ( ROWS.field - 1 ),
			section: 16,
			aisle: 1.2,
			skipRows: ( k ) => dugoutSegs.includes( k ) ? 4 : 0,
			portals: { every: 3, row: 16, rows: 5, width: 3 },
		};

		// behind the left field wall: a flower bed, then the 140s up to the concourse
		const lf = this._fenceLine( 0, 3 );
		const leftField = {
			name: 'left-field-seats',
			front: lf,
			outward: [ 0, 0 ],
			start: 2.0,
			frontY: 0,
			y0: 10.5 * FT + 0.4,
			rows: ROWS.left,
			depth: FROW,
			rise: ( STREET - 0.05 - ( 10.5 * FT + 0.4 ) ) / ( ROWS.left - 1 ),
			section: 14,
			aisle: 1.2,
		};

		// behind the right field wall (the out-of-town scoreboard is built into it): the 100s in right
		const rf = this._fenceLine( 9, OUTFIELD.length - 1 );
		const rightField = {
			name: 'right-field-seats',
			front: rf,
			outward: [ 0, 0 ],
			start: 0.6,
			frontY: 0,
			y0: 13.25 * FT + 0.35,
			rows: ROWS.right,
			depth: FROW,
			rise: ( STREET - 0.05 - ( 13.25 * FT + 0.35 ) ) / ( ROWS.right - 1 ),
			section: 14,
			aisle: 1.2,
		};

		// the corners round the foul poles: a fan of rows around each pole from the end of the foul-line
		// seats to the start of the outfield seats (the rows face the pole)
		const corner = ( name, P, nA, nB ) => {

			let a0 = Math.atan2( nA[ 1 ], nA[ 0 ] ), a1 = Math.atan2( nB[ 1 ], nB[ 0 ] );
			// the short way round
			while ( a1 - a0 > Math.PI ) a1 -= 2 * Math.PI;
			while ( a0 - a1 > Math.PI ) a1 += 2 * Math.PI;
			const N = 6, r0 = 1.2, front = [];
			for ( let i = 0; i <= N; i ++ ) {

				const a = a0 + ( a1 - a0 ) * i / N;
				front.push( [ P[ 0 ] + Math.cos( a ) * r0, P[ 1 ] + Math.sin( a ) * r0 ] );

			}

			const rows = 29, y0 = 1.4;
			return { name, front, outward: P, start: 0, y0, rows, depth: FROW, rise: ( STREET - 0.05 - y0 ) / ( rows - 1 ), section: 9, aisle: 1.1 };

		};

		// the normal of a front polyline's end segment, pointing away from `away`
		const endNormal = ( A, B, away ) => {

			const l = Math.hypot( B[ 0 ] - A[ 0 ], B[ 1 ] - A[ 1 ] );
			let nx = - ( B[ 1 ] - A[ 1 ] ) / l, nz = ( B[ 0 ] - A[ 0 ] ) / l;
			if ( nx * ( A[ 0 ] - away[ 0 ] ) + nz * ( A[ 1 ] - away[ 1 ] ) < 0 ) {

				nx = - nx; nz = - nz;

			}

			return [ nx, nz ];

		};

		const F = FOUL_TERRITORY;
		const L = F.length - 1;
		const cornerLF = corner( 'corner-lf', F[ L ], endNormal( F[ L - 1 ], F[ L ], [ 0, - 40 ] ), endNormal( lf[ 0 ], lf[ 1 ], [ 0, 0 ] ) );
		const cornerRF = corner( 'corner-rf', F[ 0 ], endNormal( rf[ rf.length - 2 ], rf[ rf.length - 1 ], [ 0, 0 ] ), endNormal( F[ 0 ], F[ 1 ], [ 0, - 40 ] ) );

		return [ infield, leftField, rightField, cornerLF, cornerRF ];

	}

	// OUTFIELD rows i0..i1 as a polyline (steps in height dropped)
	_fenceLine( i0, i1 ) {

		const pts = [];
		for ( let i = i0; i <= i1; i ++ ) {

			const p = fencePoint( OUTFIELD[ i ][ 0 ], OUTFIELD[ i ][ 1 ] );
			if ( ! pts.length || Math.hypot( p[ 0 ] - pts[ pts.length - 1 ][ 0 ], p[ 1 ] - pts[ pts.length - 1 ][ 1 ] ) > 0.01 ) pts.push( p );

		}

		return pts;

	}

	// The protective netting behind home plate: a fine green mesh.
	_buildNetting() {

		const F = FOUL_TERRITORY;
		// in 2008 only the backstop: between the home plate ends of the dugouts (it reached the dugouts' far
		// ends only in 2017)
		const run = F.slice( 5, 9 );
		const H = 30 * FT;
		const q = new Quads();
		let u = 0;
		for ( let i = 0; i < run.length - 1; i ++ ) {

			const [ ax, az ] = run[ i ], [ bx, bz ] = run[ i + 1 ];
			const len = Math.hypot( bx - ax, bz - az );
			// ---- W4 (rail): the net rises from the top of the backstop's cushions, just in from their
			// back edge (from the ground it lay on the brick's face, drawn over the wall)
			let ox = - ( bz - az ) / len, oz = ( bx - ax ) / len;
			if ( ox * ( 0 - ( ax + bx ) / 2 ) + oz * ( - 40 - ( az + bz ) / 2 ) > 0 ) {

				ox = - ox; oz = - oz;

			}

			const y0 = 4.5 * FT + 0.02, back = 0.3; // the wall is 4.5 ft (layout.js FOUL_WALL_HEIGHT)
			const A = [ ax + ox * back, az + oz * back ], B = [ bx + ox * back, bz + oz * back ];
			q.add( [ A[ 0 ], y0, A[ 1 ] ], [ B[ 0 ], y0, B[ 1 ] ], [ B[ 0 ], H, B[ 1 ] ], [ A[ 0 ], H, A[ 1 ] ], [ - ( bz - az ) / len, 0, ( bx - ax ) / len ], u, u + len );
			// ---- end W4
			u += len;

		}

		const mat = standard( {
			name: 'netting', color: new Color( 0.03, 0.09, 0.05 ), roughness: 0.8, transparent: true, depthWrite: false, side: 'double',
			surface: /* wgsl */`
	// 1.75 in mesh: from a distance a faint veil, up close a grid
	// distance to the nearest strand, in cells (strands on the cell edges)
	let m = abs( fract( vec2f( in.uv.x, in.uv.y ) / 0.045 ) - 0.5 );
	let fw = max( fwidth( in.uv.x ), fwidth( in.uv.y ) ) / 0.045;
	let strand = smoothstep( 0.5 - 0.06 - fw, 0.5 - 0.06 + fw, max( m.x, m.y ) );
	// far away the strands blur into a faint veil (their share of the cell)
	// (only resolve the strands when a cell spans a dozen pixels: coarser, they beat against the pixel
	// grid into big blotches, worst through the zoomed TV cameras)
	let coverage = mix( 0.12, strand, clamp( 1.5 - fw * 6.0, 0.0, 1.0 ) );
	s.alpha = coverage * 0.8;
`,
		} );
		mat.underwaterLighting = 'none';
		const mesh = new Mesh( q.geometry(), mat );
		mesh.name = 'netting';
		mesh.layers.set( 2 ); // the late (transparent) pass
		this.group.add( mesh );

	}

	// ---------------------------------------------------------------- upper levels

	// Above the main concourse, from the Phillies' level heights: suites (36 ft) behind two rows of
	// suite seats; the Hall of Fame Club (212-232) up to the club concourse (61 ft) round the infield; the
	// Terrace deck pole to pole, 300s up to the terrace walkway (81 ft) and 400s above it under the roof
	// (134 ft); the Pavilion (200s) above the right field seats. Offsets are measured back from the top of
	// the field level seats.
	_buildUpperDecks() {

		const inf = this.tiers[ 0 ];
		const top = inf.rows * inf.depth; // the field level seats' depth
		// the front line of foul territory, smoothed for the big offsets (the little turns out at the
		// corners would fold over at 30 m)
		const F = FOUL_TERRITORY;
		const path = [ F[ 0 ], F[ 2 ], F[ 3 ], F[ 4 ], F[ 5 ], F[ 6 ], F[ 7 ], F[ 8 ], F[ 9 ], F[ 10 ], F[ 11 ], F[ 13 ] ];
		const infieldPath = path.slice( 2, 10 ); // round the infield: first base dugout's far end to third's
		// the infield's decks (the Terrace 300s and 400s under the big roof) run from The Break, 150 ft down
		// the first base line, round to the left field pole; past The Break the upper deck in right is its
		// own deck, 20 ft lower (there's no club level under it)
		const main = path.slice( 2 );
		const line = ( P, d ) => offsetPolyline( P, d, [ 0, - 40 ] );
		// path points i0..i1 moved back d, mitred like the whole line's, with a short lead past each end
		// that meets a neighbour, so the rows of neighbouring tiers end on the same bisector
		const span = ( i0, i1, d ) => {

			const O = line( path, d ), out = O.slice( i0, i1 + 1 );
			const lead = ( p, q ) => [ p[ 0 ] + ( q[ 0 ] - p[ 0 ] ) * 0.3 / Math.hypot( q[ 0 ] - p[ 0 ], q[ 1 ] - p[ 1 ] ), p[ 1 ] + ( q[ 1 ] - p[ 1 ] ) * 0.3 / Math.hypot( q[ 0 ] - p[ 0 ], q[ 1 ] - p[ 1 ] ) ];
			if ( i0 > 0 ) out.unshift( lead( O[ i0 ], O[ i0 - 1 ] ) );
			if ( i1 < O.length - 1 ) out.push( lead( O[ i1 ], O[ i1 + 1 ] ) );
			return out;

		};
		const L = LEVELS;

		// front edges back from the top of the field level seats (negative: overhanging them)
		const D = {
			suites: top - 4.5, club: top - 3.0, t300: top - 2.0,
		};
		D.clubBack = D.club + ROWS.club * ROW;
		D.t300Back = D.t300 + ROWS.t300 * ROW;
		D.t400 = D.t300Back + 2.4;
		D.t400Back = D.t400 + ROWS.t400 * ROW;
		this.D = D;
		this.path = path;
		this.top = top;
		const clubY = L.clubConcourse - ( ROWS.club - 1 ) * 0.46 - 0.2;
		const t300Y = L.terraceConcourse - ( ROWS.t300 - 1 ) * 0.52 - 0.3;
		const tiers = [
			// suite level: two rows in front of the suites
			{ name: 'suite-seats', front: span( 2, 9, D.suites ), outward: [ 0, - 40 ], y0: L.suites - 0.6, rows: 2, depth: 0.95, rise: 0.35, section: 12, aisle: 1.4, soffit: 0.9, frontWall: { top: L.suites + 0.2 }, base: L.suites - 1.5 },
			// Hall of Fame Club (212-232): 8 rows up to the club concourse
			{ name: 'club-level', front: span( 2, 9, D.club ), outward: [ 0, - 40 ], y0: clubY, rows: ROWS.club, depth: ROW, rise: 0.46, section: 14, aisle: 1.2, soffit: 1.0, frontWall: { top: clubY + 1.0 }, base: clubY - 1.2 },
			// Terrace: the 300s over the club seats, up to the terrace walkway
			// (behind home plate the press box takes its place: no seats there)
			{ name: 'terrace-300', front: line( main, D.t300 ), outward: [ 0, - 40 ], y0: t300Y, rows: ROWS.t300, depth: ROW, rise: 0.52, section: 14, aisle: 1.2, soffit: 1.1, frontWall: { top: t300Y + 1.0 }, base: t300Y - 1.1, skip: [ [ 2, 4 ] ] },
			// ... and the 400s behind the walkway
			{ name: 'terrace-400', front: line( main, D.t400 ), outward: [ 0, - 40 ], y0: L.terraceConcourse + 0.5, rows: ROWS.t400, depth: ROW, rise: 0.62, section: 14, aisle: 1.2, soffit: 1.2, portals: { every: 2, row: 5, rows: 4, width: 3 }, back: { height: 1.1 }, base: L.terraceConcourse - 0.7 },
			// the Arcade (233-237): down the left field line from the end of the club, ten rows on the suite
			// level's fascia (the ribbon board runs on along it) right under the 300s
			{ name: 'arcade', front: span( 9, 11, D.suites ), outward: [ 0, - 40 ], y0: L.suites + 0.4, rows: 10, depth: ROW, rise: 0.5, section: 14, aisle: 1.2, soffit: 1.0, frontWall: { top: L.suites + 1.4 }, back: { height: 1.1 }, base: L.suites - 1.5 },
		];

		// the left field upper deck (the 200s in left), over the back rows of the left field seats and the
		// covered concourse behind them, up to Harry the K's under the scoreboard
		const lfT = this.tiers[ 1 ];
		const lfTop = lfT.start + lfT.rows * lfT.depth;
		const lfY = STREET + 4.6;
		tiers.push( { name: 'lf-deck', front: offsetPolyline( lfT.front, lfTop - 2.0, [ 0, 0 ] ), outward: [ 0, 0 ], y0: lfY, rows: 8, depth: ROW, rise: 0.48, section: 13, aisle: 1.2, soffit: 1.0, frontWall: { top: lfY + 1.0 }, back: { height: 1.2 }, base: lfY - 1.3 } );

		// The Pavilion (201-211) over the right field seats from the 369 mark, and on round the foul pole and
		// down the first base line to The Break at the same height (the ribbon board runs along its front
		// there); above it the upper deck in right (301-310), one deck of 21 rows from The Break round the
		// pole to the 369 mark under its own roof, 20 ft lower than the infield's. Right-center is Ashburn
		// Alley's (the rooftop seats and the Liberty Bell).
		const rf = this.tiers[ 2 ];
		const rfTop = rf.start + rf.rows * rf.depth;
		const [ , c369, pole ] = rf.front;
		// the right field stretch, from the 369 mark toward the pole, and the first base line's, from the
		// pole to The Break, joined by a curve round the pole (the Pavilion's rows open out over the corner
		// seats there, as they fan round it at field level)
		const rfLine = offsetPolyline( [ c369, [ c369[ 0 ] + ( pole[ 0 ] - c369[ 0 ] ) * 0.97, c369[ 1 ] + ( pole[ 1 ] - c369[ 1 ] ) * 0.97 ] ], rfTop + 1.0, [ 0, 0 ] );
		const fbLine = span( 0, 2, D.suites );
		const corner = roundCorner( rfLine[ 0 ], rfLine[ 1 ], fbLine[ 0 ], fbLine[ 1 ], 20, 5 );
		const pavFront = [ rfLine[ 0 ], ...corner, ...fbLine.slice( 1 ) ];
		const pavPart = { rf: [ rfLine[ 0 ], corner[ 0 ] ], line: [ ...corner, ...fbLine.slice( 1 ) ] };
		tiers.push( { name: 'pavilion', front: pavFront, parts: pavPart, outward: [ 0, - 40 ], y0: L.suites + 0.4, rows: ROWS.pavilion, depth: ROW, rise: 0.5, section: 14, aisle: 1.2, soffit: 1.0, frontWall: { top: L.suites + 1.4 }, back: { height: 1.1 }, base: L.suites - 1.5 } );
		// the deck 3 m further back, ending short of The Break (the gap between it and the 312/412 decks
		// where the sky shows through)
		const pdY = L.suites + 0.4 + ( ROWS.pavilion - 1 ) * 0.5 + 4.2;
		const dkAll = offsetPolyline( pavFront, 3.0, [ 0, - 40 ] ), iF2 = pavFront.length - 3;
		const dk = dkAll.slice( 0, iF2 + 1 );
		dk.push( [ dkAll[ iF2 ][ 0 ] + ( dkAll[ iF2 + 1 ][ 0 ] - dkAll[ iF2 ][ 0 ] ) * 0.55, dkAll[ iF2 ][ 1 ] + ( dkAll[ iF2 + 1 ][ 1 ] - dkAll[ iF2 ][ 1 ] ) * 0.55 ] );
		tiers.push( { name: 'pavilion-deck', front: dk, parts: { rf: dk.slice( 0, 2 ), line: dk.slice( 1 ) }, outward: [ 0, - 40 ], y0: pdY, rows: ROWS.pavilionDeck, depth: ROW, rise: 0.55, section: 14, aisle: 1.2, soffit: 1.2, frontWall: { top: pdY + 1.0 }, base: pdY - 1.1 } );

		this.upper = tiers;
		for ( const t of tiers ) this.group.add( buildTier( t, this.ctx ) );
		// the Hall of Fame Club's glass wall right behind its top row, the club lit inside
		this._clubGlass( line( infieldPath, D.clubBack + 0.4 ), L.clubConcourse, t300Y + ( ( D.clubBack + 0.4 - D.t300 ) / ROW ) * 0.52 - 1.3 );
		// the left field deck on columns from the concourse
		const lfd = tiers.find( ( t ) => t.name === 'lf-deck' );
		this._columns( offsetPolyline( lfd.front, 2.5, [ 0, 0 ] ), STREET, lfd.base, 9 );
		this._columns( offsetPolyline( lfd.front, lfd.rows * lfd.depth - 0.6, [ 0, 0 ] ), STREET, lfd.y0 + ( lfd.rows - 1 ) * lfd.rise - 1.0, 9 );
		// the Pavilion and the Arcade stand on columns from the concourse behind the field level seats; the
		// concourse behind their top rows (under the deck above) lit
		const pav = tiers.find( ( t ) => t.name === 'pavilion' ), deck = tiers.find( ( t ) => t.name === 'pavilion-deck' ), arc = tiers.find( ( t ) => t.name === 'arcade' );
		const t400 = tiers[ 3 ];
		// the underside of an upper tier `d` back from its front
		const under = ( t, d ) => t.y0 - t.soffit + Math.max( 0, d ) * ( ( t.rows - 1 ) * t.rise ) / ( t.rows * t.depth );
		for ( const [ t, over, dOver ] of [ [ pav, deck, 3.0 ], [ arc, t400, D.t400 - D.suites ] ] ) {

			this._columns( offsetPolyline( t.front, 5.0, [ 0, - 40 ] ), STREET, t.base, 9 );
			// behind the top row a concourse 4 m deep, its back wall glazed at the bottom (the stands and the
			// people inside lit), precast above it up to the deck overhead
			const yTop = t.y0 + ( t.rows - 1 ) * t.rise, dBack = t.rows * t.depth + 4;
			this._strip( offsetPolyline( t.front, t.rows * t.depth, [ 0, - 40 ] ), 4, yTop + 0.25, t.name + '-concourse', false );
			const G = offsetPolyline( t.front, dBack, [ 0, - 40 ] ), yG = yTop + 4.6;
			this._clubGlass( G, yTop + 0.25, yG, { open: true } );
			const wq = new Quads(), yU = under( over, dBack - dOver ) + 0.3;
			for ( let i = 0; i < G.length - 1; i ++ ) {

				const [ ax, az ] = G[ i ], [ bx, bz ] = G[ i + 1 ];
				let nx = - ( bz - az ), nz = bx - ax;
				if ( nx * ( ax + bx ) / 2 + nz * ( ( az + bz ) / 2 + 40 ) > 0 ) {

					nx = - nx; nz = - nz;

				}

				wq.add( [ ax, yG, az ], [ bx, yG, bz ], [ bx, yU, bz ], [ ax, yU, az ], [ nx, 0, nz ] );

			}
			const wm = new Mesh( wq.geometry(), this.materials.concrete );
			wm.name = t.name + '-back-wall';
			wm.castShadow = true;
			wm.receiveShadow = true;
			this.group.add( wm );

		}

		// the upper deck in right: a walkway behind its top row, columns under its back, its own roof on
		// trusses (its light tower stands behind it in right: Landmarks), open steel behind
		const deckBack = deck.rows * deck.depth, deckTop = deck.y0 + ( deck.rows - 1 ) * deck.rise;
		const pavRoofY = deckTop + 4.2;
		const dkRear = offsetPolyline( deck.front, deckBack + 3.6, [ 0, - 40 ] );
		this._strip( offsetPolyline( deck.front, deckBack, [ 0, - 40 ] ), 4, deckTop, 'pavilion-deck-walkway' );
		this._columns( dkRear, STREET, deckTop - 0.6, 9.5 );
		this._roof( offsetPolyline( deck.front, deckBack * 0.3, [ 0, - 40 ] ), deckBack * 0.7 + 3.6, pavRoofY, { towers: false } );
		this._rearWall( dkRear, deckTop, pavRoofY - 1.0 );

		this._pressBox( line( path, D.t300 ).slice( 4, 8 ), t300Y - 1.1, L.terraceConcourse - 0.15, ROWS.t300 * ROW );

		// the walkway between the 300s and 400s, and the club concourse behind the club seats
		const t300 = tiers[ 2 ], club = tiers[ 1 ];
		this._strip( line( main, D.t300Back ), 2.4, L.terraceConcourse, 'terrace-walkway', false ); // the 400s start behind it
		this._strip( line( infieldPath, D.clubBack ), 8, L.clubConcourse, 'club-concourse' );
		// suites: a glass front and a roof slab over them, behind the suite seats
		this._suites( line( infieldPath, D.suites + 2 * 0.95 ), 7, L.suites, clubY - 1.2 );
		// the roof over the 400s, and the light towers standing on it
		const back400 = t400.rows * ROW;
		this._roof( line( main, D.t400 + back400 * 0.35 ), back400 * 0.75, L.roof );
		// behind the top row: a parapet up to the roof; under it all, the columns carrying the decks over
		// the open main concourse
		const t400Top = t400.y0 + ( t400.rows - 1 ) * t400.rise;
		this._columns( line( main, D.t400Back - 0.4 ), STREET, t400Top - 1.2, 9.5 );
		this._rearWall( line( main, D.t400Back - 0.4 ), t400Top - 1.2, L.roof - 1.0 );
		this._frame( line( main, D.t400Back - 0.4 ), [ L.suites, L.clubConcourse, L.terraceConcourse, t400Top - 1.4 ], 9.5 );
		this._outerRing( line( main, D.t400Back - 0.4 ), [ L.clubConcourse, L.terraceConcourse ] );
		this._columns( line( infieldPath, D.clubBack + 8 - 0.4 ), STREET, L.clubConcourse - 0.6, 9.5 );

		// elevators: behind home plate and toward first and third, stopping at each level
		this._elevators( path, top );
		this._tvCameras( path, clubY, L.terraceConcourse - 0.15 );
		void club; void t300;

	}

	// The press box and broadcast booths behind home plate, in place of the 300s there: a maroon
	// spandrel, a band of big glass windows tilted out at the top, white trim, a roof the terrace walkway
	// runs over; lit inside after dark. P: its front line (field frame), y0..y1, depth back to the walkway.
	_pressBox( P, y0, y1, depth ) {

		const maroon = standard( { name: 'press-maroon', color: new Color( 0.15, 0.03, 0.03 ), roughness: 0.6 } );
		const trim = standard( { name: 'press-trim', color: new Color( 0.75, 0.74, 0.7 ), roughness: 0.5 } );
		const yS = y0 + 1.4, yG = yS + 2.7, tilt = 0.45, yF = yS - 0.9;
		let total = 0;
		for ( let i = 0; i < P.length - 1; i ++ ) total += Math.hypot( P[ i + 1 ][ 0 ] - P[ i ][ 0 ], P[ i + 1 ][ 1 ] - P[ i ][ 1 ] );
		const nB = Math.round( total / 4.5 ), bw = total / nB, mid = Math.floor( nB / 2 );
		// The booths, 4.5 m each, traced in behind the glass (interior mapped): a desk along the window
		// with monitors and papers, partitions, racks and the station's banner on the back wall, strip
		// lights; and the people in them, from first base's side to third's (booth 0 is behind the plate):
		//   -2 ESPN Radio: Jon Miller and Joe Morgan
		//   -1 the Phillies on WPHT 1210: Larry Andersen, Harry Kalas (white hair, his camel jacket; he calls
		//      the middle innings, and he's there for the last out on the 29th) and Scott Franzke
		//    0 FOX: Joe Buck and Tim McCarver, the booth lit for the camera
		//    1 the Rays on WHNZ: Andy Freed and Dave Wills
		//    2 Spanish radio, two men in headsets
		//   the rest: the writers' rows, heads over laptops, a few standing at the back
		const glass = standard( { name: 'press-glass', color: new Color( 0.03, 0.045, 0.055 ), roughness: 0.06, metalness: 0.6, modules: [ interiorModule ],
			surface: /* wgsl */`
	let bw = ${ bw.toFixed( 4 ) };
	let RH = 2.7;
	let Nh = normalize( vec3f( in.N.x, 0.0, in.N.z ) );
	let T = normalize( cross( vec3f( 0.0, 1.0, 0.0 ), Nh ) );
	let Vd = normalize( in.P - frame.cameraPos );
	let rd = vec3f( dot( Vd, T ), Vd.y, max( dot( Vd, - Nh ), 0.05 ) );
	let id = floor( in.uv.x / bw ) - ${ mid }.0;
	let lean = clamp( ( in.uv.y - ${ yS.toFixed( 3 ) } ) / ${ ( yG - yS ).toFixed( 3 ) }, 0.0, 1.0 ) * ${ tilt };
	let ro = vec3f( fract( in.uv.x / bw ) * bw - bw * 0.5, in.uv.y - ${ yF.toFixed( 3 ) }, - lean );
	let tx = ( select( - bw * 0.5, bw * 0.5, rd.x > 0.0 ) - ro.x ) / rd.x;
	let ty = ( select( 0.0, RH, rd.y > 0.0 ) - ro.y ) / rd.y;
	let tz = ( 3.6 - ro.z ) / rd.z;
	var t = min( tx, min( ty, tz ) );
	var hit = ro + rd * t;
	let media = abs( id ) < 2.5;
	var room = vec3f( 0.45, 0.43, 0.4 );
	if ( t == ty && rd.y > 0.0 ) {
		let g = abs( fract( hit.xz / vec2f( 1.2, 1.5 ) ) - 0.5 );
		room = mix( vec3f( 0.5, 0.5, 0.48 ), vec3f( 0.95, 0.97, 1.0 ) * 2.5, step( g.x, 0.25 ) * step( g.y, 0.1 ) );
	} else if ( t == ty ) {
		room = vec3f( 0.1, 0.1, 0.11 );
	} else if ( t == tx ) {
		room = vec3f( 0.36, 0.34, 0.31 );
	} else {
		// the back wall: equipment racks in the media booths (dark, pin lights), the station's banner
		room = vec3f( 0.4, 0.38, 0.35 );
		if ( media && abs( hit.x ) > 1.2 && hit.y < 2.0 ) {
			room = vec3f( 0.03 );
			if ( fract( hit.y * 6.0 ) < 0.08 && fract( hit.x * 9.0 ) < 0.2 ) { room = vec3f( 2.0, 0.4, 0.2 ) * step( 0.5, ihash( floor( hit.y * 6.0 ) + floor( hit.x * 9.0 ) * 7.0 ) ); }
		}
		if ( abs( hit.x ) < 1.1 && abs( hit.y - 1.9 ) < 0.32 ) {
			if ( id == - 1.0 ) { room = vec3f( 0.7, 0.03, 0.04 ); }
			if ( id == 0.0 ) { room = vec3f( 0.03, 0.08, 0.3 ); }
			if ( id == 1.0 ) { room = vec3f( 0.03, 0.1, 0.35 ); }
			if ( id == - 2.0 ) { room = vec3f( 0.6, 0.05, 0.05 ); }
		}
	}
	// the desk along the window, 0.9 m up and 0.8 m deep: papers, the scorebook, monitors' backs, the
	// writers' laptops lit
	let td = ( 0.9 - ro.y ) / rd.y;
	if ( rd.y < 0.0 && td > 0.0 && td < t ) {
		let dp = ro + rd * td;
		if ( dp.z < 0.8 ) {
			t = td;
			room = vec3f( 0.22, 0.2, 0.18 );
			if ( fract( dp.x * 1.3 + 0.2 ) < 0.28 && dp.z > 0.25 && dp.z < 0.55 ) { room = vec3f( 0.75, 0.74, 0.7 ); }
		}
	}
	// monitors on the desk, their backs to the glass, and the writers' laptop lids
	let tm = ( 0.55 - ro.z ) / rd.z;
	if ( tm < t && tm > 0.0 ) {
		let mp = ro + rd * tm;
		let mx = fract( mp.x / 1.5 + 0.5 ) * 1.5 - 0.75;
		let tall = select( 0.22, 0.4, media );
		if ( abs( mx ) < select( 0.16, 0.25, media ) && mp.y > 0.9 && mp.y < 0.9 + tall ) { room = vec3f( 0.025 ); t = tm; }
	}
	// the people, seated at the desk 1.05 m in, and one or two standing at the back
	var px = array<f32, 3>( - 1.4, 0.0, 1.4 );
	var coat = array<vec3f, 3>( vec3f( 0.08, 0.08, 0.09 ), vec3f( 0.25, 0.23, 0.2 ), vec3f( 0.03, 0.04, 0.08 ) );
	var hair = array<vec3f, 3>( vec3f( 0.06, 0.04, 0.03 ), vec3f( 0.45, 0.45, 0.43 ), vec3f( 0.2, 0.12, 0.06 ) );
	var skin = array<vec3f, 3>( vec3f( 0.55, 0.38, 0.3 ), vec3f( 0.55, 0.38, 0.3 ), vec3f( 0.5, 0.35, 0.27 ) );
	var hs = 0.0;
	if ( id == 0.0 ) {
		px = array<f32, 3>( - 0.6, 0.6, 99.0 );
		coat = array<vec3f, 3>( vec3f( 0.025, 0.025, 0.035 ), vec3f( 0.1, 0.1, 0.11 ), vec3f( 0.0 ) );
		hair = array<vec3f, 3>( vec3f( 0.17, 0.1, 0.05 ), vec3f( 0.62, 0.62, 0.6 ), vec3f( 0.0 ) );
		hs = 1.0;
	} else if ( id == - 1.0 ) {
		px = array<f32, 3>( - 0.95, 0.0, 0.95 );
		coat = array<vec3f, 3>( vec3f( 0.4, 0.03, 0.04 ), vec3f( 0.42, 0.31, 0.18 ), vec3f( 0.03, 0.04, 0.1 ) );
		hair = array<vec3f, 3>( vec3f( 0.14, 0.11, 0.09 ), vec3f( 0.86, 0.86, 0.83 ), vec3f( 0.12, 0.07, 0.04 ) );
		hs = 1.0;
	} else if ( id == 1.0 ) {
		px = array<f32, 3>( - 0.6, 0.6, 99.0 );
		coat = array<vec3f, 3>( vec3f( 0.03, 0.06, 0.16 ), vec3f( 0.03, 0.06, 0.16 ), vec3f( 0.0 ) );
		hair = array<vec3f, 3>( vec3f( 0.05, 0.035, 0.03 ), vec3f( 0.3, 0.2, 0.1 ), vec3f( 0.0 ) );
		hs = 1.0;
	} else if ( id == - 2.0 ) {
		px = array<f32, 3>( - 0.6, 0.6, 99.0 );
		coat = array<vec3f, 3>( vec3f( 0.05, 0.05, 0.06 ), vec3f( 0.2, 0.17, 0.14 ), vec3f( 0.0 ) );
		hair = array<vec3f, 3>( vec3f( 0.55, 0.55, 0.53 ), vec3f( 0.02 ), vec3f( 0.0 ) );
		skin = array<vec3f, 3>( vec3f( 0.55, 0.38, 0.3 ), vec3f( 0.22, 0.13, 0.09 ), vec3f( 0.0 ) );
		hs = 1.0;
	} else if ( id == 2.0 ) {
		px = array<f32, 3>( - 0.6, 0.6, 99.0 );
		skin = array<vec3f, 3>( vec3f( 0.45, 0.3, 0.2 ), vec3f( 0.48, 0.32, 0.22 ), vec3f( 0.0 ) );
		hs = 1.0;
	} else {
		// writers: their own coats, some seats empty (downstairs for quotes)
		for ( var k = 0; k < 3; k ++ ) {
			let r = ihash( id * 5.0 + f32( k ) );
			coat[ k ] = mix( vec3f( 0.04 ), vec3f( 0.3, 0.26, 0.2 ), r );
			if ( r > 0.8 ) { px[ k ] = 99.0; }
		}
	}
	let tS = ( 2.7 - ro.z ) / rd.z;
	if ( tS < t && tS > 0.0 && ihash( id + 9.0 ) > 0.4 ) {
		let sp = ro + rd * tS;
		let f = figure( vec2f( sp.x - 1.2 + 2.0 * ihash( id + 3.0 ), sp.y ), 1.78, vec3f( 0.05, 0.05, 0.06 ), vec3f( 0.1, 0.07, 0.05 ), vec3f( 0.5, 0.35, 0.27 ), 0.0 );
		if ( f.w > 0.5 ) { room = f.xyz * 0.6; }
	}
	let tP = ( 1.05 - ro.z ) / rd.z;
	if ( tP < t && tP > 0.0 ) {
		let pp = ro + rd * tP;
		for ( var k = 0; k < 3; k ++ ) {
			let f = figure( vec2f( pp.x - px[ k ], pp.y ), 1.33 + 0.05 * ihash( id + f32( k ) ), coat[ k ], hair[ k ], skin[ k ], hs );
			if ( f.w > 0.5 ) { room = f.xyz * 0.8; }
		}
		// the writers' screens light their faces from below
		if ( ! media && fract( pp.x / 1.4 + 0.5 ) < 0.12 && pp.y > 0.9 && pp.y < 1.1 ) { room = vec3f( 0.6, 0.75, 1.0 ) * 1.5; }
	}
	let fox = select( 1.0, 1.7, id == 0.0 );
	let fres = pow( 1.0 - max( dot( - Vd, Nh ), 0.0 ), 3.0 );
	s.emissive = room * fox * mix( 0.14, 0.4, smoothstep( 0.1, 0.7, frame.night ) ) * ( 1.0 - fres * 0.8 );
` } );
		for ( const m of [ maroon, trim, glass ] ) m.underwaterLighting = 'none';
		glass.setDefine( 'DRY', 1 );
		const qm = new Quads(), qt = new Quads(), qg = new Quads();
		const back = offsetPolyline( P, depth, [ 0, - 40 ] );
		let u = 0;
		for ( let i = 0; i < P.length - 1; i ++ ) {

			const [ ax, az ] = P[ i ], [ bx, bz ] = P[ i + 1 ];
			const len = Math.hypot( bx - ax, bz - az );
			let nx = - ( bz - az ) / len, nz = ( bx - ax ) / len;
			if ( nx * ( 0 - ( ax + bx ) / 2 ) + nz * ( - 40 - ( az + bz ) / 2 ) < 0 ) {

				nx = - nx; nz = - nz;

			}

			// n points to the field; the facade leans out toward it at the top
			const at = ( p, o, y ) => [ p[ 0 ] + nx * o, y, p[ 1 ] + nz * o ];
			const A = [ ax, az ], B = [ bx, bz ];
			qm.add( at( A, 0, y0 ), at( B, 0, y0 ), at( B, 0, yS ), at( A, 0, yS ), [ nx, 0, nz ], u, u + len );
			qg.add( at( A, 0, yS ), at( B, 0, yS ), at( B, tilt, yG ), at( A, tilt, yG ), [ nx, 0.16, nz ], u, u + len );
			qt.add( at( A, tilt, yG ), at( B, tilt, yG ), at( B, tilt, y1 ), at( A, tilt, y1 ), [ nx, 0, nz ], u, u + len );
			qt.add( at( A, tilt, yS - 0.12 ), at( B, tilt, yS - 0.12 ), at( B, 0, yS + 0.05 ), at( A, 0, yS + 0.05 ), [ nx, 1, nz ], u, u + len );
			// the roof it carries (the walkway's approach), from the front back to the walkway
			qm.add( at( A, tilt, y1 ), at( B, tilt, y1 ), [ back[ i + 1 ][ 0 ], y1, back[ i + 1 ][ 1 ] ], [ back[ i ][ 0 ], y1, back[ i ][ 1 ] ], [ 0, 1, 0 ] );
			u += len;

		}

		// the ends closed
		for ( const [ p, b ] of [ [ P[ 0 ], back[ 0 ] ], [ P[ P.length - 1 ], back[ back.length - 1 ] ] ] ) {

			const ex = b[ 0 ] - p[ 0 ], ez = b[ 1 ] - p[ 1 ], el = Math.hypot( ex, ez );
			qm.add( [ p[ 0 ], y0, p[ 1 ] ], [ b[ 0 ], y0, b[ 1 ] ], [ b[ 0 ], y1, b[ 1 ] ], [ p[ 0 ], y1, p[ 1 ] ], [ - ez / el, 0, ex / el ] );

		}

		for ( const [ q, m, name ] of [ [ qm, maroon, 'press-box' ], [ qt, trim, 'press-trim' ], [ qg, glass, 'press-glass' ] ] ) {

			const mesh = new Mesh( q.geometry(), m );
			mesh.name = name;
			mesh.castShadow = m !== glass;
			mesh.receiveShadow = true;
			this.group.add( mesh );

		}

		for ( let i = 0; i < P.length - 1; i ++ ) this._walkable( P[ i ], P[ i + 1 ], back[ i + 1 ], back[ i ], y1, 'press-roof' );

	}

	// a flat walkable strip `width` deep behind a line, at height y (a concourse or walkway)
	_strip( P, width, y, name, rail = true ) {

		const q = new Quads();
		const B = offsetPolyline( P, width, [ 0, - 40 ] );
		for ( let i = 0; i < P.length - 1; i ++ ) {

			q.add( [ P[ i ][ 0 ], y, P[ i ][ 1 ] ], [ P[ i + 1 ][ 0 ], y, P[ i + 1 ][ 1 ] ], [ B[ i + 1 ][ 0 ], y, B[ i + 1 ][ 1 ] ], [ B[ i ][ 0 ], y, B[ i ][ 1 ] ], [ 0, 1, 0 ] );
			q.add( [ P[ i ][ 0 ], y - 0.6, P[ i ][ 1 ] ], [ P[ i + 1 ][ 0 ], y - 0.6, P[ i + 1 ][ 1 ] ], [ B[ i + 1 ][ 0 ], y - 0.6, B[ i + 1 ][ 1 ] ], [ B[ i ][ 0 ], y - 0.6, B[ i ][ 1 ] ], [ 0, - 1, 0 ] );
			this._walkable( P[ i ], P[ i + 1 ], B[ i + 1 ], B[ i ], y, name );

		}

		const m = new Mesh( q.geometry(), this.materials.concrete );
		m.name = name;
		m.receiveShadow = true;
		m.castShadow = true;
		this.group.add( m );
		if ( rail ) this._railing( B, y, name + '-rail' );

	}

	// a solid rail (collider only) along P at height y: stops you walking off an edge
	_railing( P, y, tag ) {

		for ( let i = 0; i < P.length - 1; i ++ ) {

			const [ ax, az ] = P[ i ], [ bx, bz ] = P[ i + 1 ];
			const len = Math.hypot( bx - ax, bz - az );
			if ( len < 0.1 ) continue;
			const w = this.field.toWorld( ( ax + bx ) / 2, ( az + bz ) / 2 );
			this.colliders.addBox( new Vector3( w.x, this.field.y0 + y + 0.55, w.z ), new Vector3( len / 2, 0.55, 0.12 ), this.ctx.worldYaw - Math.atan2( bz - az, bx - ax ), { tag } );

		}

	}

	// a walkable box over the quad a-b-c-d (a-b along the front, d-c behind it)
	_walkable( a, b, c, d, y, tag ) {

		const cx = ( a[ 0 ] + b[ 0 ] + c[ 0 ] + d[ 0 ] ) / 4, cz = ( a[ 1 ] + b[ 1 ] + c[ 1 ] + d[ 1 ] ) / 4;
		const ux = b[ 0 ] - a[ 0 ], uz = b[ 1 ] - a[ 1 ];
		const len = Math.hypot( ux, uz );
		if ( len < 0.1 ) return;
		const depth = Math.hypot( ( d[ 0 ] + c[ 0 ] - a[ 0 ] - b[ 0 ] ) / 2, ( d[ 1 ] + c[ 1 ] - a[ 1 ] - b[ 1 ] ) / 2 );
		const w = this.field.toWorld( cx, cz );
		this.colliders.addBox( new Vector3( w.x, this.field.y0 + y - 0.3, w.z ), new Vector3( len / 2, 0.3, depth / 2 ), this.ctx.worldYaw - Math.atan2( uz, ux ), { walkable: true, tag } );

	}

	// the suites: a glass wall behind the suite seats, their floor and a ceiling slab (the club deck above
	// sits on it)
	// Behind the glass each suite is a room two panes wide (interior mapped): the walls in its own colours,
	// can lights, carpet, framed photographs, the buffet counter along the back with the game on a TV over
	// it, a pennant in some; a World Series crowd in every one, watching at the glass and at the counter.
	_suites( P, depth, y, ceiling ) {

		const glass = standard( { name: 'suite-glass', color: new Color( 0.02, 0.03, 0.035 ), roughness: 0.08, metalness: 0.6, modules: [ interiorModule ],
			surface: /* wgsl */`
	let RH = ${ ( ceiling - y ).toFixed( 3 ) };
	let N = normalize( vec3f( in.N.x, 0.0, in.N.z ) );
	let T = normalize( cross( vec3f( 0.0, 1.0, 0.0 ), N ) );
	let Vd = normalize( in.P - frame.cameraPos );
	let rd = vec3f( dot( Vd, T ), Vd.y, max( dot( Vd, - N ), 0.05 ) );
	let id = floor( in.uv.x / 6.4 );
	let ro = vec3f( fract( in.uv.x / 6.4 ) * 6.4 - 3.2, in.uv.y - ${ y.toFixed( 3 ) }, 0.0 );
	let tx = ( select( - 3.2, 3.2, rd.x > 0.0 ) - ro.x ) / rd.x;
	let ty = ( select( 0.0, RH, rd.y > 0.0 ) - ro.y ) / rd.y;
	let tz = 6.5 / rd.z;
	let t = min( tx, min( ty, tz ) );
	let hit = ro + rd * t;
	let h1 = ihash( id ); let h2 = ihash( id + 17.0 ); let h3 = ihash( id + 31.0 );
	// the suite's own walls (cream, taupe, a wood panel) and lamps (warmer or cooler)
	let wall = mix( vec3f( 0.62, 0.55, 0.45 ), vec3f( 0.4, 0.3, 0.22 ), h1 );
	let lampC = mix( vec3f( 1.0, 0.8, 0.58 ), vec3f( 1.0, 0.92, 0.8 ), h2 );
	var room = wall;
	if ( t == ty && rd.y > 0.0 ) {
		let g = fract( hit.xz / 1.6 ) - 0.5;
		room = mix( vec3f( 0.7, 0.68, 0.64 ), lampC * 5.0, step( length( g ), 0.11 ) );
	} else if ( t == ty ) {
		room = mix( vec3f( 0.12, 0.07, 0.06 ), vec3f( 0.07, 0.08, 0.12 ), h3 );
	} else if ( t == tx ) {
		room = wall * 0.8;
		let f = abs( fract( hit.z / 2.0 ) - 0.5 );
		if ( f < 0.25 && hit.y > 1.3 && hit.y < 1.95 ) {
			room = vec3f( 0.05, 0.04, 0.04 );
			if ( f < 0.21 && hit.y > 1.36 && hit.y < 1.89 ) { room = mix( vec3f( 0.5, 0.46, 0.4 ), vec3f( 0.55, 0.12, 0.1 ), ihash( floor( hit.z / 2.0 ) + id * 3.0 ) ); }
		}
	} else {
		// the buffet counter, and the TV over it showing FOX's picture of the field
		if ( hit.y < 0.95 ) { room = vec3f( 0.14, 0.09, 0.06 ); }
		else if ( hit.y < 1.0 ) { room = vec3f( 0.4, 0.38, 0.35 ); }
		let tvx = hit.x - ( h2 - 0.5 ) * 2.4;
		if ( abs( tvx ) < 0.62 && hit.y > 1.45 && hit.y < 2.17 ) {
			room = vec3f( 0.02 );
			if ( abs( tvx ) < 0.58 && hit.y > 1.49 && hit.y < 2.13 ) { room = mix( vec3f( 0.12, 0.45, 0.14 ), vec3f( 0.12, 0.22, 0.5 ), step( 1.86, hit.y ) ) * 3.5; }
		}
		let pn = hit.x + 2.0 - h1;
		if ( h3 > 0.55 && pn > 0.0 && pn < 1.0 && abs( hit.y - 1.95 ) < 0.2 * ( 1.0 - pn ) ) { room = vec3f( 0.6, 0.03, 0.04 ); }
	}
	room = room * mix( 0.14, 0.42, smoothstep( 0.1, 0.7, frame.night ) ) * ( 0.75 + 0.5 * h2 );
	// the people: at the counter (4.4 m in), then along the glass (1.1 m in), nearer drawn over further
	for ( var k = 0; k < 2; k ++ ) {
		let zP = select( 1.1, 4.4, k == 0 );
		let tP = zP / rd.z;
		if ( tP < t && tP > 0.0 ) {
			let pp = ro + rd * tP;
			let cell = floor( pp.x / 0.75 ) + id * 16.0 + f32( k ) * 7.0;
			let a = ihash( cell ); let b = ihash( cell + 3.3 ); let c = ihash( cell + 5.7 );
			let cx = ( floor( pp.x / 0.75 ) + 0.3 + 0.4 * b ) * 0.75;
			if ( a < select( 0.55, 0.4, k == 0 ) && abs( cx ) < 2.9 ) {
				var coat = vec3f( 0.36, 0.025, 0.03 );
				if ( c > 0.45 ) { coat = vec3f( 0.03, 0.035, 0.08 ); }
				if ( c > 0.65 ) { coat = vec3f( 0.03 ); }
				if ( c > 0.8 ) { coat = vec3f( 0.22, 0.2, 0.18 ); }
				if ( c > 0.92 ) { coat = vec3f( 0.6, 0.58, 0.55 ); }
				let hair = mix( vec3f( 0.05, 0.035, 0.02 ), vec3f( 0.35, 0.25, 0.12 ), step( 0.7, b ) ) + vec3f( 0.3 ) * step( 0.9, a * 1.8 );
				let skin = mix( vec3f( 0.55, 0.38, 0.3 ), vec3f( 0.3, 0.19, 0.13 ), step( 0.85, c ) );
				let f = figure( vec2f( pp.x - cx, pp.y ), 1.62 + 0.24 * b, coat, hair, skin, 0.0 );
				if ( f.w > 0.5 ) { room = f.xyz * mix( 0.1, 0.3, smoothstep( 0.1, 0.7, frame.night ) ) * ( 0.8 + 0.4 * h2 ) * select( 1.0, 0.7, k == 0 ); }
			}
		}
	}
	let fres = pow( 1.0 - max( dot( - Vd, N ), 0.0 ), 3.0 );
	s.emissive = room * ( 1.0 - fres );
` } );
		const frame = standard( { name: 'suite-frame', color: new Color( 0.35, 0.34, 0.32 ), roughness: 0.7 } );
		for ( const m of [ glass, frame ] ) m.underwaterLighting = 'none';
		glass.setDefine( 'DRY', 1 );
		const g = new Quads(), f = new Quads();
		const B = offsetPolyline( P, depth, [ 0, - 40 ] );
		let u = 0;
		for ( let i = 0; i < P.length - 1; i ++ ) {

			const [ ax, az ] = P[ i ], [ bx, bz ] = P[ i + 1 ];
			const len = Math.hypot( bx - ax, bz - az );
			let nx = - ( bz - az ) / len, nz = ( bx - ax ) / len;
			if ( nx * ( ( ax + bx ) / 2 ) + nz * ( ( az + bz ) / 2 + 40 ) > 0 ) {

				nx = - nx; nz = - nz;

			}

			// glass panels between mullions every 3.2 m
			const n = Math.max( 1, Math.round( len / 3.2 ) );
			for ( let k = 0; k < n; k ++ ) {

				const t0 = k / n, t1 = ( k + 1 ) / n;
				const p0 = [ ax + ( bx - ax ) * t0, az + ( bz - az ) * t0 ], p1 = [ ax + ( bx - ax ) * t1, az + ( bz - az ) * t1 ];
				g.add( [ p0[ 0 ], y + 0.1, p0[ 1 ] ], [ p1[ 0 ], y + 0.1, p1[ 1 ] ], [ p1[ 0 ], ceiling - 0.3, p1[ 1 ] ], [ p0[ 0 ], ceiling - 0.3, p0[ 1 ] ], [ nx, 0, nz ], u, u + len / n );
				u += len / n;
				const mx = p1[ 0 ] - ( bx - ax ) / len * 0.06, mz = p1[ 1 ] - ( bz - az ) / len * 0.06;
				f.add( [ mx, y, mz ], [ p1[ 0 ] + ( bx - ax ) / len * 0.06, y, p1[ 1 ] + ( bz - az ) / len * 0.06 ], [ p1[ 0 ] + ( bx - ax ) / len * 0.06, ceiling, p1[ 1 ] + ( bz - az ) / len * 0.06 ], [ mx, ceiling, mz ], [ nx, 0, nz ] );

			}

			// the band over the glass, the floor slab's edge, and the floor
			f.add( [ ax, ceiling - 0.3, az ], [ bx, ceiling - 0.3, bz ], [ bx, ceiling + 0.2, bz ], [ ax, ceiling + 0.2, az ], [ nx, 0, nz ] );
			f.add( [ P[ i ][ 0 ], y, P[ i ][ 1 ] ], [ P[ i + 1 ][ 0 ], y, P[ i + 1 ][ 1 ] ], [ B[ i + 1 ][ 0 ], y, B[ i + 1 ][ 1 ] ], [ B[ i ][ 0 ], y, B[ i ][ 1 ] ], [ 0, 1, 0 ] );
			f.add( [ P[ i ][ 0 ], ceiling, P[ i ][ 1 ] ], [ P[ i + 1 ][ 0 ], ceiling, P[ i + 1 ][ 1 ] ], [ B[ i + 1 ][ 0 ], ceiling, B[ i + 1 ][ 1 ] ], [ B[ i ][ 0 ], ceiling, B[ i ][ 1 ] ], [ 0, - 1, 0 ] );
			this._walkable( P[ i ], P[ i + 1 ], B[ i + 1 ], B[ i ], y, 'suites' );

		}

		this._railing( B, y, 'suites-back' );

		for ( const [ q, m, name ] of [ [ g, glass, 'suite-glass' ], [ f, frame, 'suite-frame' ] ] ) {

			const mesh = new Mesh( q.geometry(), m );
			mesh.name = name;
			mesh.castShadow = true;
			mesh.receiveShadow = true;
			this.group.add( mesh );

		}

	}

	// The roof over the upper deck: a canopy `depth` deep behind the line P at height y, on steel trusses,
	// with light towers on it.
	_roof( P, depth, y, { towers = true } = {} ) {

		const steel = standard( { name: 'roof-steel', color: new Color( 0.155, 0.024, 0.018 ), roughness: 0.55, metalness: 0.3 } );
		// the roof: a thin flat canopy, weathered standing-seam metal on top (seams front to back every
		// 0.5 m), galvanised ribbed deck underneath on open maroon trusses; a slim maroon edge channel with a
		// galvanised cap along its front
		const deck = this._roofDeck || ( this._roofDeck = standard( { name: 'roof-deck', color: new Color( 0.28, 0.33, 0.3 ), roughness: 0.45, metalness: 0.5, side: 'double', modules: [ commonModule ],
			surface: /* wgsl */`
	let top = in.N.y > 0.0;
	let fw = fwidth( in.uv.x ) / 0.5;
	let rib = smoothstep( 0.86, 0.95, abs( fract( in.uv.x / 0.5 ) - 0.5 ) * 2.0 ) * ( 1.0 - clamp( fw * 1.5, 0.0, 1.0 ) );
	let weather = 0.88 + 0.16 * mx_noise_float2( in.P.xz * 0.05 ) + 0.05 * mx_noise_float2( in.P.xz * 0.8 );
	// underneath: ribbed metal deck, 0.3 m ribs
	let under = 0.85 + 0.15 * step( 0.5, fract( in.uv.x / 0.3 ) ) * ( 1.0 - clamp( fw * 2.0, 0.0, 1.0 ) );
	s.albedo = select( vec3f( 0.27, 0.275, 0.27 ) * under, mat.color * weather * ( 1.0 + 0.18 * rib ), top );
	s.metalness = select( 0.2, 0.5, top );
	// underneath, lit by the bounce off the bowl and its own fixtures after dark
	if ( ! top ) { s.emissive = s.albedo * ( 0.08 + frame.night * 0.18 ); }
` } ) );
		const edge = this._roofEdge || ( this._roofEdge = standard( { name: 'roof-edge', color: new Color( 0.155, 0.024, 0.018 ), roughness: 0.55, metalness: 0.3 } ) );
		const capMat = this._roofCap || ( this._roofCap = standard( { name: 'roof-cap', color: new Color( 0.48, 0.49, 0.46 ), roughness: 0.4, metalness: 0.7 } ) );
		for ( const m of [ steel, deck, edge, capMat ] ) m.underwaterLighting = 'none';
		const r = new Quads(), t = new Quads(), e = new Quads(), cq = new Quads();
		const B = offsetPolyline( P, depth, [ 0, - 40 ] );
		let ru = 0;
		for ( let i = 0; i < P.length - 1; i ++ ) {

			// the deck slopes up a little toward the field
			const [ ax, az ] = P[ i ], [ bx, bz ] = P[ i + 1 ];
			const len = Math.hypot( bx - ax, bz - az );
			r.add( [ P[ i ][ 0 ], y + 0.8, P[ i ][ 1 ] ], [ P[ i + 1 ][ 0 ], y + 0.8, P[ i + 1 ][ 1 ] ], [ B[ i + 1 ][ 0 ], y + 0.65, B[ i + 1 ][ 1 ] ], [ B[ i ][ 0 ], y + 0.65, B[ i ][ 1 ] ], [ 0, 1, 0 ], ru, ru + len );
			ru += len;
			// the fascia along its front edge
			let nx = - ( bz - az ) / len, nz = ( bx - ax ) / len;
			if ( nx * ( ( ax + bx ) / 2 ) + nz * ( ( az + bz ) / 2 + 40 ) > 0 ) {

				nx = - nx; nz = - nz;

			}

			// the edge: a 0.45 m channel with a galvanised cap
			e.add( [ ax, y + 0.35, az ], [ bx, y + 0.35, bz ], [ bx, y + 0.8, bz ], [ ax, y + 0.8, az ], [ nx, 0, nz ] );
			cq.add( [ ax + nx * 0.02, y + 0.8, az + nz * 0.02 ], [ bx + nx * 0.02, y + 0.8, bz + nz * 0.02 ], [ bx + nx * 0.02, y + 0.88, bz + nz * 0.02 ], [ ax + nx * 0.02, y + 0.88, az + nz * 0.02 ], [ nx, 0, nz ] );
			cq.add( [ ax + nx * 0.02, y + 0.88, az + nz * 0.02 ], [ bx + nx * 0.02, y + 0.88, bz + nz * 0.02 ], [ bx - nx * 0.25, y + 0.88, bz - nz * 0.25 ], [ ax - nx * 0.25, y + 0.88, az - nz * 0.25 ], [ 0, 1, 0 ] );
			// open-web maroon trusses under the deck, one per ~9 m: a top chord under the deck, a bottom
			// chord rising from the front edge to the back, verticals and alternating diagonals between
			const n = Math.max( 1, Math.round( len / 9 ) );
			for ( let k = 0; k <= n; k ++ ) {

				if ( i > 0 && k === 0 ) continue;
				const tt = k / n;
				const fx = ax + ( bx - ax ) * tt, fz = az + ( bz - az ) * tt;
				const bx2 = B[ i ][ 0 ] + ( B[ i + 1 ][ 0 ] - B[ i ][ 0 ] ) * tt, bz2 = B[ i ][ 1 ] + ( B[ i + 1 ][ 1 ] - B[ i ][ 1 ] ) * tt;
				const L = Math.hypot( bx2 - fx, bz2 - fz );
				const at = ( f, yy ) => [ fx + ( bx2 - fx ) * f, yy, fz + ( bz2 - fz ) * f ];
				const topY = ( f ) => y + 0.5 - 0.15 * f, botY = ( f ) => y - 0.6 - 2.9 * f;
				beam( t, at( 0, topY( 0 ) ), at( 1, topY( 1 ) ), 0.22 );
				beam( t, at( 0, botY( 0 ) ), at( 1, botY( 1 ) ), 0.22 );
				const m = Math.max( 2, Math.round( L / 1.5 ) );
				for ( let j = 0; j <= m; j ++ ) {

					const f0 = j / m, f1 = ( j + 1 ) / m;
					beam( t, at( f0, botY( f0 ) ), at( f0, topY( f0 ) ), 0.14 );
					if ( j < m ) beam( t, j % 2 ? at( f0, botY( f0 ) ) : at( f0, topY( f0 ) ), j % 2 ? at( f1, topY( f1 ) ) : at( f1, botY( f1 ) ), 0.12 );

				}

			}

			// purlins along the roof every 1.8 m back from the edge
			const depthHere = Math.hypot( B[ i ][ 0 ] - ax, B[ i ][ 1 ] - az );
			for ( let d = 1.8; d < depthHere - 0.5; d += 1.8 ) {

				const f = d / depthHere;
				const pa = [ ax + ( B[ i ][ 0 ] - ax ) * f, y + 0.5 - 0.15 * f + 0.05, az + ( B[ i ][ 1 ] - az ) * f ];
				const pb = [ bx + ( B[ i + 1 ][ 0 ] - bx ) * f, y + 0.5 - 0.15 * f + 0.05, bz + ( B[ i + 1 ][ 1 ] - bz ) * f ];
				beam( t, pa, pb, 0.13 );

			}

		}

		const deckMesh = new Mesh( r.geometry(), deck );
		deckMesh.name = 'roof';
		deckMesh.castShadow = true;
		deckMesh.receiveShadow = true;
		this.group.add( deckMesh );
		const trussMesh = new Mesh( t.geometry(), steel );
		trussMesh.name = 'roof-trusses';
		trussMesh.castShadow = true;
		trussMesh.receiveShadow = true;
		this.group.add( trussMesh );
		const edgeMesh = new Mesh( e.geometry(), edge );
		edgeMesh.name = 'roof-edge';
		edgeMesh.castShadow = true;
		this.group.add( edgeMesh );
		const capMesh = new Mesh( cq.geometry(), capMat );
		capMesh.name = 'roof-cap';
		this.group.add( capMesh );

		// under the front edge: a continuous steel truss (a lower chord 2 m down, posts every 6 m, a
		// zig-zag of diagonals), with sports lights and speaker cabinets hung from it
		const tq = new Quads(), lq = new Quads(), sq = new Quads();
		for ( let i = 0; i < P.length - 1; i ++ ) {

			const [ ax, az ] = P[ i ], [ bx, bz ] = P[ i + 1 ];
			const len = Math.hypot( bx - ax, bz - az );
			let nx = - ( bz - az ) / len, nz = ( bx - ax ) / len;
			if ( nx * ( ( ax + bx ) / 2 ) + nz * ( ( az + bz ) / 2 + 40 ) > 0 ) {

				nx = - nx; nz = - nz;

			}

			const o = - 0.6; // a little back from the fascia
			const at = ( t, yy ) => [ ax + ( bx - ax ) * t - nx * o, yy, az + ( bz - az ) * t - nz * o ];
			const yt = y - 0.6, yb = y - 2.6;
			beam( tq, at( 0, yb ), at( 1, yb ), 0.28 );
			const n = Math.max( 1, Math.round( len / 6 ) );
			for ( let k = 0; k <= n; k ++ ) {

				const t0 = k / n;
				beam( tq, at( t0, yb ), at( t0, yt ), 0.2 );
				if ( k < n ) {

					const tm = ( k + 0.5 ) / n, t1 = ( k + 1 ) / n;
					beam( tq, at( t0, yb ), at( tm, yt ), 0.13 );
					beam( tq, at( tm, yt ), at( t1, yb ), 0.13 );
					// a light and, every other bay, a speaker cabinet under the chord
					const L = at( tm, yb - 0.35 );
					box( lq, L, [ 0.7, 0.5, 0.7 ] );
					if ( k % 2 === 0 ) {

						const S = at( t0 + 0.12 / n * 3, yb - 0.7 );
						box( sq, S, [ 0.6, 1.0, 0.6 ] );

					}

				}

			}

		}

		const tm = new Mesh( tq.geometry(), steel );
		tm.name = 'roof-front-truss';
		tm.castShadow = true;
		this.group.add( tm );
		const lampMat = this._edgeLamp || ( this._edgeLamp = standard( { name: 'roof-edge-lights', color: new Color( 0.2, 0.2, 0.2 ), roughness: 0.4,
			surface: 'if ( in.N.y < - 0.5 ) { s.emissive = vec3f( 1.0, 0.95, 0.85 ) * mix( 0.2, 6.0, smoothstep( 0.15, 0.75, frame.night ) ); }' } ) );
		lampMat.underwaterLighting = 'none';
		this.group.add( new Mesh( lq.geometry(), lampMat ) );
		const spk = this._speakerMat || ( this._speakerMat = standard( { name: 'pa-speakers', color: new Color( 0.03, 0.03, 0.035 ), roughness: 0.6 } ) );
		spk.underwaterLighting = 'none';
		this.group.add( new Mesh( sq.geometry(), spk ) );
		// the deck's underside ribbed: see the roof-deck material (in.N.y < 0)
		if ( towers ) this.roofBack = { line: B, y };

		if ( ! towers ) return;
		// light towers: masts at both ends of the roof, and a pair of broad frames rising from the street
		// either side of the Third Base Gate and the First Base Gate, standing in the gate's stair towers at
		// the facade, 40 m apart (Exterior: the frame gates)
		for ( const [ x, z ] of [ B[ 0 ], B[ B.length - 1 ] ] ) this._lightTower( x, z, y, LEVELS.lightTowers, [ 9.5, 1.4 ] );
		this.gateTowers = [];
		for ( const gate of GATES.slice( 0, 2 ) ) {

			// the facade edge the gate is on
			let best = null;
			for ( let i = 0; i < FOOTPRINT.length; i ++ ) {

				const a = FOOTPRINT[ i ], b = FOOTPRINT[ ( i + 1 ) % FOOTPRINT.length ];
				const ex = b[ 0 ] - a[ 0 ], ez = b[ 1 ] - a[ 1 ], l2 = ex * ex + ez * ez;
				const t = Math.max( 0, Math.min( 1, ( ( gate.at[ 0 ] - a[ 0 ] ) * ex + ( gate.at[ 1 ] - a[ 1 ] ) * ez ) / l2 ) );
				const d = Math.hypot( a[ 0 ] + ex * t - gate.at[ 0 ], a[ 1 ] + ez * t - gate.at[ 1 ] );
				if ( ! best || d < best.d ) best = { d, u: [ ex / Math.sqrt( l2 ), ez / Math.sqrt( l2 ) ] };

			}

			const [ ux, uz ] = best.u;
			let nx = - uz, nz = ux;
			if ( nx * gate.at[ 0 ] + nz * ( gate.at[ 1 ] + 40 ) < 0 ) {

				nx = - nx; nz = - nz;

			}

			const pair = [ - 1, 1 ].map( ( side ) => [ gate.at[ 0 ] + ux * side * 20 - nx * 3.5, gate.at[ 1 ] + uz * side * 20 - nz * 3.5 ] );
			for ( const [ x, z ] of pair ) this._lightTower( x, z, STREET, LEVELS.lightTowers, [ 11, 3.2 ] );
			this.gateTowers.push( { gate: gate.name, pair, y: y } );

		}

	}

	// A steel lattice tower from y0 up to y1, `size` [ wide, deep ], with a bank of lights facing the field.
	// The roof's masts are slim; the pairs framing the Third and First Base Gates are broad frames from the
	// street, braced on every face, with a cage round the lights on top. One mesh for the steel.
	_lightTower( x, z, y0, y1, size = [ 2.4, 2.4 ] ) {

		const steel = this._towerSteel || ( this._towerSteel = standard( { name: 'tower-steel', color: new Color( 0.12, 0.03, 0.03 ), roughness: 0.6, metalness: 0.4 } ) );
		// the lamps glow after dusk (and light the field: see lightSources())
		const lamp = this._lamp || ( this._lamp = standard( { name: 'tower-lamps', color: new Color( 0.8, 0.8, 0.75 ), roughness: 0.3,
			surface: 's.emissive = vec3f( 1.0, 0.96, 0.88 ) * smoothstep( 0.15, 0.75, frame.night ) * 40.0;' } ) );
		steel.underwaterLighting = 'none';
		lamp.underwaterLighting = 'none';
		const g = new Group();
		g.position.set( x, y0, z );
		// face the field: toward second base
		g.rotation.y = Math.atan2( - ( 0 - x ), - ( - 38 - z ) );
		const h = y1 - y0, [ W, Dp ] = size, hw = W / 2, hd = Dp / 2;
		if ( W > 8 ) return this._portalTower( g, x, z, y0, y1, size, steel, lamp );
		const big = W > 3;
		const q = new Quads();
		for ( const [ lx, lz ] of [ [ - hw, - hd ], [ hw, - hd ], [ - hw, hd ], [ hw, hd ] ] ) beam( q, [ lx, 0, lz ], [ lx, h, lz ], big ? 0.55 : 0.35 );
		// girts round the four faces, diagonals across them
		const step = big ? 4.6 : 3;
		let prev = 0, k = 0;
		for ( let yy = step; yy < h - 1; yy += step, k ++ ) {

			const girt = big ? 0.24 : 0.15;
			beam( q, [ - hw, yy, - hd ], [ hw, yy, - hd ], girt );
			beam( q, [ - hw, yy, hd ], [ hw, yy, hd ], girt );
			beam( q, [ - hw, yy, - hd ], [ - hw, yy, hd ], girt );
			beam( q, [ hw, yy, - hd ], [ hw, yy, hd ], girt );
			const s = k % 2 ? 1 : - 1;
			for ( const zz of [ - hd, hd ] ) {

				beam( q, [ - hw * s, prev, zz ], [ hw * s, yy, zz ], 0.12 );
				if ( big ) beam( q, [ hw * s, prev, zz ], [ - hw * s, yy, zz ], 0.12 );

			}

			for ( const xx of [ - hw, hw ] ) beam( q, [ xx, prev, - hd * s ], [ xx, yy, hd * s ], 0.1 );
			prev = yy;

		}

		// platforms every ~10 m on the big ones, a ladder cage up one corner
		if ( big ) for ( let yy = 10; yy < h - 4; yy += 10 ) {

			box( q, [ 0, yy, 0 ], [ W + 0.8, 0.08, Dp + 0.8 ] );
			beam( q, [ - hw - 0.4, yy + 1.0, - hd - 0.4 ], [ hw + 0.4, yy + 1.0, - hd - 0.4 ], 0.05 );
			beam( q, [ - hw - 0.4, yy + 1.0, hd + 0.4 ], [ hw + 0.4, yy + 1.0, hd + 0.4 ], 0.05 );

		}

		// the cage round the lights on the big ones
		if ( big ) {

			const cw = W / 2 + 1.6, cd = hd + 0.6, c0 = h - 1, c1 = h + 7;
			for ( const [ lx, lz ] of [ [ - cw, - cd ], [ cw, - cd ], [ - cw, cd ], [ cw, cd ] ] ) beam( q, [ lx, c0, lz ], [ lx, c1, lz ], 0.3 );
			for ( const yy of [ c0, ( c0 + c1 ) / 2, c1 ] ) {

				beam( q, [ - cw, yy, - cd ], [ cw, yy, - cd ], 0.22 );
				beam( q, [ - cw, yy, cd ], [ cw, yy, cd ], 0.22 );
				beam( q, [ - cw, yy, - cd ], [ - cw, yy, cd ], 0.22 );
				beam( q, [ cw, yy, - cd ], [ cw, yy, cd ], 0.22 );

			}

		}

		const sm = new Mesh( q.geometry(), steel );
		sm.name = 'light-tower';
		sm.castShadow = true;
		sm.receiveShadow = true;
		g.add( sm );

		// the light bank: an open steel frame of lamps tilted down toward the field (the sky shows through
		// behind the fixtures), catwalks along it; the big frames carry a wider bank
		const bank = new Group();
		bank.position.set( 0, h + 2.5, - 0.8 );
		bank.rotation.x = 0.35;
		const fq = new Quads(), lq = new Quads();
		const BW = big ? Math.max( 13, W + 2 ) : 9, BH = big ? 5.4 : 6, cols = big ? 13 : 8, rowsL = big ? 4 : 5;
		for ( const yy of [ - BH / 2, - BH / 6, BH / 6, BH / 2 ] ) beam( fq, [ - BW / 2, yy, 0.1 ], [ BW / 2, yy, 0.1 ], 0.18 );
		for ( let i = 0; i <= 4; i ++ ) beam( fq, [ - BW / 2 + BW * i / 4, - BH / 2, 0.1 ], [ - BW / 2 + BW * i / 4, BH / 2, 0.1 ], 0.18 );
		// the catwalks: grating and a rail under each row of lamps
		for ( const yy of [ - BH / 2, 0 ] ) {

			box( fq, [ 0, yy - 0.1, 0.55 ], [ BW, 0.06, 0.9 ] );
			beam( fq, [ - BW / 2, yy + 1.0, 1.0 ], [ BW / 2, yy + 1.0, 1.0 ], 0.05 );

		}

		const cw = ( BW - 1 ) / cols, rh = ( BH - 0.6 ) / rowsL;
		for ( let i = 0; i < cols; i ++ ) for ( let j = 0; j < rowsL; j ++ ) box( lq, [ - BW / 2 + 0.5 + cw * ( i + 0.5 ), - BH / 2 + 0.3 + rh * ( j + 0.5 ), - 0.25 ], [ cw * 0.8, rh * 0.8, 0.45 ] );
		const frameM = new Mesh( fq.geometry(), steel );
		frameM.castShadow = true;
		bank.add( frameM );
		bank.add( new Mesh( lq.geometry(), lamp ) );
		g.add( bank );
		this.group.add( g );
		// the legs at the street stop you walking through them
		if ( big ) {

			g.updateMatrix();
			for ( const [ lx, lz ] of [ [ - hw, - hd ], [ hw, - hd ], [ - hw, hd ], [ hw, hd ] ] ) {

				const p = new Vector3( lx, 0, lz ).applyMatrix4( g.matrix );
				const w = this.field.toWorld( p.x, p.z );
				this.colliders.addCylinder( w.x, w.z, 0.4, this.field.y0 + y0, this.field.y0 + y0 + 6 );

			}

		}

		( this.towers || ( this.towers = [] ) ).push( { group: g, bank } );

	}

	// square steel columns every ~spacing m along P, from y0 to y1
	_columns( P, y0, y1, spacing ) {

		const steel = this._colSteel || ( this._colSteel = standard( { name: 'columns', color: new Color( 0.12, 0.03, 0.03 ), roughness: 0.6, metalness: 0.4 } ) );
		steel.underwaterLighting = 'none';
		const geo = new BoxGeometry( 0.7, y1 - y0, 0.7 );
		for ( let i = 0; i < P.length - 1; i ++ ) {

			const [ ax, az ] = P[ i ], [ bx, bz ] = P[ i + 1 ];
			const len = Math.hypot( bx - ax, bz - az );
			const n = Math.max( 1, Math.round( len / spacing ) );
			for ( let k = i === 0 ? 0 : 1; k <= n; k ++ ) {

				const x = ax + ( bx - ax ) * k / n, z = az + ( bz - az ) * k / n;
				const m = new Mesh( geo, steel );
				m.position.set( x, ( y0 + y1 ) / 2, z );
				m.rotation.y = - Math.atan2( bz - az, bx - ax );
				m.castShadow = true;
				m.receiveShadow = true;
				this.group.add( m );
				const w = this.field.toWorld( x, z );
				this.colliders.addCylinder( w.x, w.z, 0.45, this.field.y0 + y0, this.field.y0 + y1 );

			}

		}

	}

	// The steel frame on the outside of the stands, between the columns along P: a beam at each level and
	// X bracing in every third bay between the lowest two, the way the frame shows from the street.
	_frame( P, levels, spacing ) {

		const q = new Quads();
		let bay = 0;
		for ( let i = 0; i < P.length - 1; i ++ ) {

			const [ ax, az ] = P[ i ], [ bx, bz ] = P[ i + 1 ];
			const len = Math.hypot( bx - ax, bz - az );
			const n = Math.max( 1, Math.round( len / spacing ) );
			for ( let k = 0; k < n; k ++, bay ++ ) {

				const x0 = ax + ( bx - ax ) * k / n, z0 = az + ( bz - az ) * k / n;
				const x1 = ax + ( bx - ax ) * ( k + 1 ) / n, z1 = az + ( bz - az ) * ( k + 1 ) / n;
				for ( const y of levels ) beam( q, [ x0, y, z0 ], [ x1, y, z1 ], 0.5 );
				if ( bay % 3 === 1 ) {

					const [ y0, y1 ] = [ levels[ 0 ], levels[ 1 ] ];
					beam( q, [ x0, y0, z0 ], [ x1, y1, z1 ], 0.3 );
					beam( q, [ x1, y0, z1 ], [ x0, y1, z0 ], 0.3 );

				}

			}

		}

		const m = new Mesh( q.geometry(), this._colSteel );
		m.name = 'stands-frame';
		m.castShadow = true;
		m.receiveShadow = true;
		this.group.add( m );

	}

	// A glass curtain wall along P from the floor y0 up to y1: dark bronze mullions every 1.5 m and a
	// transom, and behind the glass a room 6 m deep (interior mapping: the view ray traced into it), its
	// ceiling panels lit warm, dark carpet, framed pictures on the back wall.
	// { open }: no glass, the opening onto a concourse (its ceiling lights, the stands lit along the back)
	_clubGlass( P, y0, y1, { open = false } = {} ) {

		const q = new Quads(), mq = new Quads();
		let u = 0;
		for ( let i = 0; i < P.length - 1; i ++ ) {

			const [ ax, az ] = P[ i ], [ bx, bz ] = P[ i + 1 ];
			const len = Math.hypot( bx - ax, bz - az );
			if ( len < 0.1 ) continue;
			let nx = - ( bz - az ) / len, nz = ( bx - ax ) / len;
			if ( nx * ( ( ax + bx ) / 2 ) + nz * ( ( az + bz ) / 2 + 40 ) > 0 ) {

				nx = - nx; nz = - nz;

			}

			q.add( [ ax, y0, az ], [ bx, y0, bz ], [ bx, y1, bz ], [ ax, y1, az ], [ nx, 0, nz ], u, u + len );
			u += len;
			if ( open ) continue;
			const n = Math.max( 1, Math.round( len / 1.5 ) );
			for ( let k = 0; k <= n; k ++ ) {

				const x = ax + ( bx - ax ) * k / n, z = az + ( bz - az ) * k / n;
				beam( mq, [ x + nx * 0.04, y0, z + nz * 0.04 ], [ x + nx * 0.04, y1, z + nz * 0.04 ], 0.07 );

			}

			for ( const yy of [ y0 + 0.05, y0 + 2.7, y1 - 0.05 ] ) beam( mq, [ ax + nx * 0.04, yy, az + nz * 0.04 ], [ bx + nx * 0.04, yy, bz + nz * 0.04 ], 0.07 );

		}

		const glass = standard( { name: open ? 'concourse-opening' : 'club-glass', color: new Color( 0.03, 0.035, 0.04 ), roughness: open ? 1 : 0.06, metalness: open ? 0 : 0.5, modules: [ commonModule ],
			surface: /* wgsl */`
	// the room behind: the view ray traced into a box ${ open ? 5 : 6 } m deep, as tall as the opening
	let H = ${ ( y1 - y0 ).toFixed( 3 ) };
	let DEP = ${ open ? '5.0' : '6.0' };
	let N = normalize( in.N );
	let T = normalize( cross( vec3f( 0.0, 1.0, 0.0 ), N ) );
	let Vd = normalize( in.P - frame.cameraPos );
	let rd = vec3f( dot( Vd, T ), Vd.y, max( dot( Vd, - N ), 0.05 ) );
	let ro = vec3f( in.uv.x, in.uv.y - ${ y0.toFixed( 3 ) }, 0.0 );
	let ty = ( select( 0.0, H, rd.y > 0.0 ) - ro.y ) / rd.y;
	let tz = DEP / rd.z;
	let t = min( ty, tz );
	let hit = ro + rd * t;
	let nkI = smoothstep( 0.1, 0.7, frame.night );
	var room = vec3f( 0.3, 0.25, 0.2 );
	if ( t == ty && rd.y > 0.0 ) {
${ open ? `		// the concourse's ceiling: dark steel deck, strip lights every 3 m
		let g = abs( fract( hit.x / 3.0 ) - 0.5 );
		room = mix( vec3f( 0.12, 0.11, 0.1 ), vec3f( 1.0, 0.95, 0.85 ) * 3.0, step( g, 0.04 ) * step( abs( hit.z - DEP * 0.5 ), 1.6 ) );` : `		// the ceiling: 2 m light panels
		let g = abs( fract( hit.xz / 2.0 ) - 0.5 );
		room = mix( vec3f( 0.6, 0.58, 0.54 ), vec3f( 1.0, 0.85, 0.62 ) * 3.0, step( max( g.x, g.y ), 0.3 ) );` }
	}
	if ( t == ty && rd.y <= 0.0 ) { room = ${ open ? 'vec3f( 0.16, 0.155, 0.15 )' : 'vec3f( 0.08, 0.05, 0.05 )' }; }
	if ( t == tz ) {
${ open ? `		// the back: concession stands 7.5 m wide, their counters and menu boards lit, dark gaps between
		let c = fract( hit.x / 8.7 ) * 8.7;
		let id = floor( hit.x / 8.7 );
		let hue = fract( sin( id * 17.13 ) * 4375.5 );
		room = vec3f( 0.12, 0.11, 0.1 );
		if ( c < 7.5 && hit.y > 0.95 && hit.y < 2.6 ) { room = vec3f( 1.0, 0.8, 0.55 ) * 1.2; }
		if ( c < 7.5 && hit.y >= 2.6 && hit.y < 3.3 ) { room = mix( vec3f( 0.8, 0.12, 0.08 ), vec3f( 0.12, 0.3, 0.7 ), step( 0.5, hue ) ) * 1.5; }
		if ( c < 7.5 && hit.y <= 0.95 ) { room = vec3f( 0.25, 0.22, 0.2 ); }` : `		room = vec3f( 0.42, 0.34, 0.26 );
		let f = abs( fract( ( hit.x + 1.5 ) / 3.0 ) - 0.5 ) * 3.0;
		if ( f < 0.55 && hit.y > 1.2 && hit.y < 2.3 ) { room = vec3f( 0.05, 0.04, 0.035 ); }` }
	}
	// people inside, on a plane a couple of metres in: standing, walking, at the bar (silhouettes lit by
	// the room), in their red and their dark coats
	let zP = ${ open ? '2.4' : '2.0' };
	let tP = zP / rd.z;
	if ( tP < t && tP > 0.0 ) {
		let pp = ro + rd * tP;
		let cell = floor( pp.x / 0.95 );
		let h1 = fract( sin( cell * 12.9898 ) * 43758.5453 );
		let h2 = fract( sin( cell * 78.233 ) * 43758.5453 );
		let cx = ( cell + 0.3 + 0.4 * h2 ) * 0.95;
		let px = pp.x - cx;
		let hh = 1.56 + 0.22 * h2;
		let head = length( vec2f( px, pp.y - hh ) ) < 0.115;
		let body = abs( px ) < 0.22 - 0.06 * smoothstep( hh - 0.3, hh - 0.15, pp.y ) && pp.y < hh - 0.13 && pp.y > 0.0;
		if ( h1 < ${ open ? '0.5' : '0.42' } && ( head || body ) ) {
			var coat = vec3f( 0.3, 0.025, 0.03 );
			if ( h2 > 0.55 ) { coat = vec3f( 0.035, 0.035, 0.04 ); }
			if ( h2 > 0.85 ) { coat = vec3f( 0.18, 0.18, 0.2 ); }
			room = select( coat, vec3f( 0.45, 0.3, 0.22 ), head ) * 0.9;
		}
	}
${ open ? `	s.albedo = vec3f( 0.01 );
	s.emissive = room * mix( 0.1, 0.3, nkI );` : `	let fres = pow( 1.0 - max( dot( - Vd, N ), 0.0 ), 3.0 );
	s.albedo = mat.color;
	s.emissive = room * mix( 0.12, 0.35, nkI ) * ( 1.0 - fres );` }
` } );
		const mull = standard( { name: 'club-mullions', color: new Color( 0.025, 0.02, 0.017 ), roughness: 0.5, metalness: 0.5 } );
		for ( const m of [ glass, mull ] ) m.underwaterLighting = 'none';
		glass.setDefine( 'DRY', 1 );
		const gm = new Mesh( q.geometry(), glass );
		gm.name = glass.name;
		this.group.add( gm );
		if ( ! mq.count ) return;
		const mm = new Mesh( mq.geometry(), mull );
		mm.name = 'club-mullions';
		this.group.add( mm );

	}

	// The outer ring behind the grandstand: the club and terrace concourse floors reach out from the back
	// of the upper deck (P, the frame's line) to the facade, so the main concourse is roofed over (its
	// ceiling the floor above: girders, deck, strip lights) and from outside the frame reads as stacked,
	// lit floors with their precast edges and guard rails, not an empty cage.
	_outerRing( P, levels ) {

		const F = FOOTPRINT;
		// the nearest footprint edge along the ray p + t n
		const hit = ( p, n ) => {

			let best = Infinity;
			for ( let i = 0; i < F.length; i ++ ) {

				const a = F[ i ], b = F[ ( i + 1 ) % F.length ];
				const ex = b[ 0 ] - a[ 0 ], ez = b[ 1 ] - a[ 1 ];
				const den = n[ 0 ] * ez - n[ 1 ] * ex;
				if ( Math.abs( den ) < 1e-6 ) continue;
				const dx = a[ 0 ] - p[ 0 ], dz = a[ 1 ] - p[ 1 ];
				const t = ( dx * ez - dz * ex ) / den, u = ( dx * n[ 1 ] - dz * n[ 0 ] ) / den;
				if ( t > 0.5 && u >= 0 && u <= 1 ) best = Math.min( best, t );

			}

			return best;

		};

		// samples along the frame's line with their outward normals and the facade's distance
		const S = [];
		for ( let i = 0; i < P.length - 1; i ++ ) {

			const [ ax, az ] = P[ i ], [ bx, bz ] = P[ i + 1 ];
			const len = Math.hypot( bx - ax, bz - az );
			if ( len < 0.01 ) continue;
			let nx = - ( bz - az ) / len, nz = ( bx - ax ) / len;
			if ( nx * ( ( ax + bx ) / 2 ) + nz * ( ( az + bz ) / 2 + 40 ) < 0 ) {

				nx = - nx; nz = - nz;

			}

			const k = Math.max( 1, Math.round( len / 2.5 ) );
			for ( let j = 0; j <= k; j ++ ) {

				if ( j === 0 && S.length ) continue;
				const p = [ ax + ( bx - ax ) * j / k, az + ( bz - az ) * j / k ];
				const d = hit( p, [ nx, nz ] );
				S.push( { p, n: [ nx, nz ], d: d < 45 ? d - 0.9 : null } );

			}

		}

		const q = new Quads(), rail = new Quads();
		for ( const y of levels ) for ( let i = 0; i < S.length - 1; i ++ ) {

			const A = S[ i ], B = S[ i + 1 ];
			if ( A.d === null || B.d === null || A.d < 1 || B.d < 1 ) continue;
			const ai = A.p, bi = B.p;
			const ao = [ ai[ 0 ] + A.n[ 0 ] * A.d, ai[ 1 ] + A.n[ 1 ] * A.d ], bo = [ bi[ 0 ] + B.n[ 0 ] * B.d, bi[ 1 ] + B.n[ 1 ] * B.d ];
			const t = y, b = y - 0.6;
			q.add( [ ai[ 0 ], t, ai[ 1 ] ], [ bi[ 0 ], t, bi[ 1 ] ], [ bo[ 0 ], t, bo[ 1 ] ], [ ao[ 0 ], t, ao[ 1 ] ], [ 0, 1, 0 ] );
			q.add( [ ai[ 0 ], b, ai[ 1 ] ], [ ao[ 0 ], b, ao[ 1 ] ], [ bo[ 0 ], b, bo[ 1 ] ], [ bi[ 0 ], b, bi[ 1 ] ], [ 0, - 1, 0 ] );
			// the precast edge, a little deeper than the slab, and a pipe guard on it
			const en = [ ( A.n[ 0 ] + B.n[ 0 ] ) / 2, 0, ( A.n[ 1 ] + B.n[ 1 ] ) / 2 ];
			q.add( [ ao[ 0 ], y - 0.95, ao[ 1 ] ], [ bo[ 0 ], y - 0.95, bo[ 1 ] ], [ bo[ 0 ], y + 0.2, bo[ 1 ] ], [ ao[ 0 ], y + 0.2, ao[ 1 ] ], en );
			for ( const h of [ 0.6, 1.1 ] ) beam( rail, [ ao[ 0 ] - A.n[ 0 ] * 0.1, y + h, ao[ 1 ] - A.n[ 1 ] * 0.1 ], [ bo[ 0 ] - B.n[ 0 ] * 0.1, y + h, bo[ 1 ] - B.n[ 1 ] * 0.1 ], 0.05 );
			if ( i % 2 === 0 ) beam( rail, [ ao[ 0 ] - A.n[ 0 ] * 0.1, y + 0.2, ao[ 1 ] - A.n[ 1 ] * 0.1 ], [ ao[ 0 ] - A.n[ 0 ] * 0.1, y + 1.1, ao[ 1 ] - A.n[ 1 ] * 0.1 ], 0.05 );

		}

		const mat = standard( {
			name: 'outer-floors', color: new Color( 0.5, 0.49, 0.46 ), roughness: 0.8, side: 'double', modules: [ commonModule ],
			surface: /* wgsl */`
	if ( in.N.y > 0.6 ) {
		// the concourse floor: sealed concrete
		s.albedo = vec3f( 0.36, 0.35, 0.33 ) * ( 0.9 + 0.1 * mx_noise_float2( in.P.xz * 0.4 ) );
		s.roughness = 0.6;
	} else if ( in.N.y < - 0.6 ) {
${ SOFFIT_WGSL }
	} else {
		// the precast edge: light grey, a reveal along it
		let v = fract( in.P.y );
		s.albedo = vec3f( 0.5, 0.49, 0.46 ) * ( 0.92 + 0.08 * mx_noise_float2( in.P.xz * 2.0 ) ) * mix( 1.0, 0.6, step( 0.47, v ) * step( v, 0.5 ) );
		s.roughness = 0.75;
		s.emissive = s.albedo * smoothstep( 0.15, 0.7, frame.night ) * 0.1;
	}
`,
		} );
		mat.underwaterLighting = 'none';
		mat.setDefine( 'DRY', 1 );
		const m = new Mesh( q.geometry(), mat );
		m.name = 'outer-floors';
		m.castShadow = true;
		m.receiveShadow = true;
		this.group.add( m );
		const r = new Mesh( rail.geometry(), this.materials.rail );
		r.name = 'outer-floor-rails';
		this.group.add( r );

	}

	// Elevator banks at three places round the infield. Each stops on the main concourse, the suite
	// level, the club concourse and the terrace walkway; `this.elevators` lists the stops (field frame)
	// for the walker's E prompt.
	_elevators( path, top ) {

		const L = LEVELS;
		const levels = [
			{ name: 'Main concourse', d: top + 14, y: STREET },
			{ name: 'Suite level', d: this.D.suites + 2 * 0.95 + 3.0, y: L.suites },
			{ name: 'Club level', d: this.D.clubBack + 4.0, y: L.clubConcourse },
			{ name: 'Terrace', d: this.D.t300Back + 1.2, y: L.terraceConcourse },
		];
		const door = standard( { name: 'elevator-door', color: new Color( 0.5, 0.52, 0.55 ), roughness: 0.3, metalness: 0.8 } );
		const sign = standard( { name: 'elevator-sign', color: new Color( 0.02, 0.1, 0.05 ), roughness: 0.5, emissive: new Color( 0.05, 0.6, 0.3 ) } );
		for ( const m of [ door, sign ] ) m.underwaterLighting = 'none';
		this.elevators = [];
		// where along the path: behind home plate (the backstop segment), first base side, third base side
		for ( const [ seg, t ] of [ [ 5, 0.5 ], [ 3, 0.35 ], [ 8, 0.65 ] ] ) {

			const bank = { stops: [] };
			for ( const lv of levels ) {

				const P = offsetPolyline( path, lv.d, [ 0, - 40 ] );
				const [ ax, az ] = P[ seg ], [ bx, bz ] = P[ seg + 1 ];
				const x = ax + ( bx - ax ) * t, z = az + ( bz - az ) * t;
				// the doors face the field side of the path
				const len = Math.hypot( bx - ax, bz - az );
				let nx = - ( bz - az ) / len, nz = ( bx - ax ) / len;
				if ( nx * x + nz * ( z + 40 ) > 0 ) {

					nx = - nx; nz = - nz;

				}

				const g = new Group();
				g.position.set( x - nx * 0.6, lv.y, z - nz * 0.6 );
				g.rotation.y = Math.atan2( - nx, - nz ) + Math.PI;
				const d = new Mesh( new BoxGeometry( 2.2, 2.4, 0.15 ), door );
				d.position.y = 1.2;
				g.add( d );
				const sgn = new Mesh( new BoxGeometry( 1.6, 0.35, 0.1 ), sign );
				sgn.position.set( 0, 2.75, 0.05 );
				g.add( sgn );
				this.group.add( g );
				// you stand in front of the doors, on the field side
				bank.stops.push( { name: lv.name, x: x + nx * 1.2, z: z + nz * 1.2, y: lv.y, face: [ nx, nz ] } );

			}

			this.elevators.push( bank );

		}

	}

	// FOX's cameras for the World Series and the crews on them: two in center field on a black platform
	// hung off the batter's eye (the pitch-by-pitch shot, over the pitcher's shoulder, one for lefties,
	// one for righties), high home on the press box's roof, high first and high third on platforms hung
	// off the Hall of Fame Club's front. Each is a pedestal with a big lens under a black rain cover and
	// an operator behind it in a dark FOX jacket and a watch cap, headset on; they pan with the play
	// (update()). Two instanced meshes: the pedestal and the operator turn, the head also tilts.
	_tvCameras( path, clubY, pressRoof ) {

		const at = ( P, d, x, z ) => {

			// the point on the line d back from the path nearest ( x, z )
			const line = offsetPolyline( P, d, [ 0, - 40 ] );
			let best = null, bd = Infinity;
			for ( let i = 0; i < line.length - 1; i ++ ) {

				const [ ax, az ] = line[ i ], [ bx, bz ] = line[ i + 1 ];
				const dx = bx - ax, dz = bz - az;
				const t = Math.max( 0, Math.min( 1, ( ( x - ax ) * dx + ( z - az ) * dz ) / ( dx * dx + dz * dz || 1 ) ) );
				const px = ax + dx * t, pz = az + dz * t, dd = Math.hypot( px - x, pz - z );
				if ( dd < bd ) {

					bd = dd;
					best = { p: [ px, pz ], u: [ dx, dz ].map( ( v ) => v / Math.hypot( dx, dz ) ) };

				}

			}

			return best;

		};

		// [ x, floor y, z, lens length, aims at the ball ]
		const cams = [];
		for ( const x of [ - 1.8, 1.8 ] ) cams.push( [ x, 7.95, - 128, 1.1, false ] );
		const hh = at( path, this.D.t300 + 0.5, 0, 60 );
		cams.push( [ hh.p[ 0 ], pressRoof, hh.p[ 1 ], 0.8, true ] );
		for ( const sx of [ - 30, 30 ] ) {

			const c = at( path, this.D.club - 1.2, sx, - 2 );
			cams.push( [ c.p[ 0 ], clubY + 0.62, c.p[ 1 ], 0.7, true ] );

		}

		this.cameraSpots = cams.map( ( [ x, y, z ] ) => [ x, y + 1.55, z ] );

		// the platforms: black steel grating, a rail round the open sides, brackets back to the structure
		const pq = new Quads();
		const platform = ( cx, y, cz, w, dpt, ux, uz, back ) => {

			// u along the structure, n out from it toward the field
			const nx = - back[ 0 ], nz = - back[ 1 ];
			const P = ( s, o, yy ) => [ cx + ux * s + nx * o, yy, cz + uz * s + nz * o ];
			const o0 = - dpt / 2, o1 = dpt / 2;
			pq.add( P( - w / 2, o0, y ), P( w / 2, o0, y ), P( w / 2, o1, y ), P( - w / 2, o1, y ), [ 0, 1, 0 ] );
			pq.add( P( - w / 2, o0, y - 0.12 ), P( w / 2, o0, y - 0.12 ), P( w / 2, o1, y - 0.12 ), P( - w / 2, o1, y - 0.12 ), [ 0, - 1, 0 ] );
			pq.add( P( - w / 2, o1, y - 0.12 ), P( w / 2, o1, y - 0.12 ), P( w / 2, o1, y ), P( - w / 2, o1, y ), [ nx, 0, nz ] );
			for ( const yy of [ y + 0.5, y + 1.05 ] ) {

				beam( pq, P( - w / 2, o1, yy ), P( w / 2, o1, yy ), 0.05 );
				beam( pq, P( - w / 2, o0, yy ), P( - w / 2, o1, yy ), 0.05 );
				beam( pq, P( w / 2, o0, yy ), P( w / 2, o1, yy ), 0.05 );

			}

			for ( const s of [ - w / 2, 0, w / 2 ] ) beam( pq, P( s, o1, y ), P( s, o1, y + 1.05 ), 0.05 );
			// knee braces under it, back to the face it hangs from
			for ( const s of [ - w / 2 + 0.2, w / 2 - 0.2 ] ) beam( pq, P( s, o1 - 0.1, y - 0.1 ), P( s, o0, y - 1.3 ), 0.1 );

		};

		// center field: against the batter's eye wall, facing home
		platform( 0, 7.95, - 128.1, 6.0, 2.2, 1, 0, [ 0, - 1 ] );
		for ( const sx of [ - 30, 30 ] ) {

			const c = at( path, this.D.club - 1.2, sx, - 2 );
			platform( c.p[ 0 ], clubY + 0.62, c.p[ 1 ], 2.4, 2.4, c.u[ 0 ], c.u[ 1 ], [ c.u[ 1 ], - c.u[ 0 ] ].map( ( v, i, a ) => ( a[ 0 ] * c.p[ 0 ] + a[ 1 ] * ( c.p[ 1 ] + 40 ) > 0 ? v : - v ) ) );

		}

		const pm = new Mesh( pq.geometry(), this._camSteel || ( this._camSteel = standard( { name: 'camera-platforms', color: new Color( 0.02, 0.02, 0.022 ), roughness: 0.6, metalness: 0.4 } ) ) );
		pm.name = 'camera-platforms';
		pm.castShadow = true;
		this.group.add( pm );

		// the camera and its operator, facing -z; origin on the floor under the pedestal
		const build = ( head, lens ) => {

			const q = new Quads(), col = [];
			const add = ( c, f ) => {

				const n0 = q.count;
				f();
				for ( let i = n0; i < q.count; i ++ ) col.push( ...c, ...c, ...c );

			};

			const BLACK = [ 0.012, 0.012, 0.014 ], GREY = [ 0.12, 0.125, 0.13 ], LENS = [ 0.55, 0.55, 0.53 ], JACKET = [ 0.02, 0.022, 0.03 ], PANTS = [ 0.03, 0.03, 0.035 ], SKIN = [ 0.5, 0.34, 0.26 ], CAP = [ 0.05, 0.05, 0.06 ], LOGO = [ 0.6, 0.6, 0.6 ];
			if ( head ) {

				// the head: body, viewfinder hood, the lens (the long ones pale grey) with its hood, a black
				// rain cover over the body, the tally light
				add( GREY, () => box( q, [ 0, 1.42, 0.05 ], [ 0.3, 0.34, 0.5 ] ) );
				add( BLACK, () => {

					box( q, [ 0, 1.62, 0.0 ], [ 0.36, 0.06, 0.62 ] );
					box( q, [ 0.19, 1.47, 0.28 ], [ 0.14, 0.14, 0.2 ] );
					box( q, [ 0, 1.42, - 0.27 - lens - 0.08 ], [ 0.3, 0.3, 0.16 ] );
					beam( q, [ 0.12, 1.3, 0.3 ], [ 0.34, 1.16, 0.72 ], 0.035 );
					beam( q, [ - 0.12, 1.3, 0.3 ], [ - 0.34, 1.16, 0.72 ], 0.035 );

				} );
				add( lens > 0.9 ? LENS : BLACK, () => box( q, [ 0, 1.42, - 0.27 - lens / 2 ], [ 0.24, 0.26, lens ] ) );
				add( [ 3, 0.1, 0.05 ], () => box( q, [ 0.1, 1.6, - 0.2 ], [ 0.04, 0.03, 0.04 ] ) );

			} else {

				// the pedestal, its column and three feet; the operator behind the camera, hands on the pan
				// bars: legs, jacket (FOX in white on the back), arms, head in a watch cap, headset
				add( BLACK, () => {

					box( q, [ 0, 0.65, 0 ], [ 0.12, 1.3, 0.12 ] );
					for ( let k = 0; k < 3; k ++ ) {

						const a = k * Math.PI * 2 / 3;
						beam( q, [ 0, 0.1, 0 ], [ Math.cos( a ) * 0.5, 0.03, Math.sin( a ) * 0.5 ], 0.06 );

					}

					box( q, [ 0, 1.25, 0 ], [ 0.3, 0.06, 0.3 ] );

				} );
				add( PANTS, () => {

					box( q, [ - 0.11, 0.44, 0.95 ], [ 0.15, 0.88, 0.17 ] );
					box( q, [ 0.11, 0.44, 0.95 ], [ 0.15, 0.88, 0.17 ] );

				} );
				add( JACKET, () => {

					box( q, [ 0, 1.2, 0.95 ], [ 0.46, 0.66, 0.28 ] );
					beam( q, [ - 0.22, 1.45, 0.9 ], [ - 0.34, 1.2, 0.74 ], 0.1 );
					beam( q, [ 0.22, 1.45, 0.9 ], [ 0.34, 1.2, 0.74 ], 0.1 );

				} );
				add( LOGO, () => box( q, [ 0, 1.36, 1.095 ], [ 0.2, 0.07, 0.01 ] ) );
				add( SKIN, () => box( q, [ 0, 1.68, 0.93 ], [ 0.19, 0.23, 0.21 ] ) );
				add( CAP, () => box( q, [ 0, 1.82, 0.94 ], [ 0.21, 0.1, 0.23 ] ) );
				add( BLACK, () => {

					box( q, [ 0, 1.78, 0.93 ], [ 0.23, 0.03, 0.05 ] );
					box( q, [ - 0.11, 1.68, 0.93 ], [ 0.04, 0.09, 0.09 ] );
					box( q, [ 0.11, 1.68, 0.93 ], [ 0.04, 0.09, 0.09 ] );

				} );

			}

			const g = q.geometry();
			g.setAttribute( 'color', new Float32BufferAttribute( col, 3 ) );
			return g;

		};

		const mat = standard( { name: 'tv-cameras', color: new Color( 1, 1, 1 ), roughness: 0.55, vertexColors: true,
			surface: 's.emissive = s.albedo * step( 1.5, s.albedo.r ) * 2.0;' } );
		mat.underwaterLighting = 'none';
		this.tvCams = { list: cams.map( ( [ x, y, z, lens, follow ] ) => ( { x, y, z, lens, follow, yaw: Math.atan2( x - 0, z - 0 ), pitch: 0 } ) ) };
		// one head per lens length (the long ones in center field)
		this.tvCams.base = new InstancedMesh( build( false ), mat, cams.length );
		this.tvCams.heads = [ 1.1, 0.8, 0.7 ].map( ( lens ) => {

			const list = this.tvCams.list.filter( ( c ) => c.lens === lens );
			const m = new InstancedMesh( build( true, lens ), mat, list.length );
			return { m, list };

		} );
		for ( const m of [ this.tvCams.base, ...this.tvCams.heads.map( ( h ) => h.m ) ] ) {

			m.name = 'tv-cameras';
			m.frustumCulled = false;
			m.castShadow = true;
			this.group.add( m );

		}

		this.updateCameras( null, 1 );

	}

	// the cameras follow the play: the ball (field frame [ x, y, z ]) when there is one, else the plate;
	// the one you're looking through (its lens within 1.5 m of `eye`, field frame) isn't drawn
	updateCameras( ball, dt, eye = null ) {

		const T = this.tvCams;
		if ( ! T ) return;
		const zero = new Vector3( 0, 0, 0 );
		const m = this._cm || ( this._cm = new Matrix4() ), q = new Quaternion(), e = new Euler( 0, 0, 0, 'YXZ' ), p = new Vector3(), one = new Vector3( 1, 1, 1 );
		const k = 1 - Math.exp( - dt * 3 );
		T.list.forEach( ( c, i ) => {

			const tx = c.follow && ball ? ball[ 0 ] : 0, ty = c.follow && ball ? ball[ 1 ] : 1, tz = c.follow && ball ? ball[ 2 ] : ( c.follow ? - 20 : 0.2 );
			const dx = tx - c.x, dy = ty - ( c.y + 1.42 ), dz = tz - c.z;
			const yaw = Math.atan2( - dx, - dz ), pitch = Math.atan2( dy, Math.hypot( dx, dz ) );
			let dyaw = yaw - c.yaw;
			while ( dyaw > Math.PI ) dyaw -= 2 * Math.PI;
			while ( dyaw < - Math.PI ) dyaw += 2 * Math.PI;
			c.yaw += dyaw * k;
			c.pitch += ( pitch - c.pitch ) * k;
			const s = eye && Math.hypot( eye[ 0 ] - c.x, eye[ 1 ] - c.y - 1.42, eye[ 2 ] - c.z ) < 1.5 ? zero : one;
			T.base.setMatrixAt( i, m.compose( p.set( c.x, c.y, c.z ), q.setFromEuler( e.set( 0, c.yaw, 0 ) ), s ) );
			// the head tilts about its mount, 1.42 m up
			m.compose( p.set( c.x, c.y + 1.42, c.z ), q.setFromEuler( e.set( c.pitch, c.yaw, 0 ) ), s );
			m.multiply( this._down || ( this._down = new Matrix4().makeTranslation( 0, - 1.42, 0 ) ) );
			c.head = m.clone();

		} );
		T.base.instanceMatrix.needsUpdate = true;
		for ( const h of T.heads ) {

			h.list.forEach( ( c, i ) => h.m.setMatrixAt( i, c.head ) );
			h.m.instanceMatrix.needsUpdate = true;

		}

	}

	// A portal light tower (the pairs framing the gates): two ladder-truss legs `size[0]` apart, a
	// cross girder every third of the way up, K-braced, and a wide open lamp bank with catwalks on top
	_portalTower( g, x, z, y0, y1, [ W, Dp ], steel, lamp ) {

		const h = y1 - y0, hw = W / 2, hd = Dp / 2, lw = 0.7;
		const q = new Quads();
		for ( const sx of [ - hw, hw ] ) {

			// each leg: four chords in a 1.4 m square, laced
			for ( const [ ox, oz ] of [ [ - lw, - hd ], [ lw, - hd ], [ - lw, hd ], [ lw, hd ] ] ) beam( q, [ sx + ox, 0, oz ], [ sx + ox, h, oz ], 0.3 );
			let k = 0;
			for ( let yy = 2.4; yy < h; yy += 2.4, k ++ ) {

				const s = k % 2 ? 1 : - 1;
				beam( q, [ sx - lw * s, yy - 2.4, - hd ], [ sx + lw * s, yy, - hd ], 0.08 );
				beam( q, [ sx - lw * s, yy - 2.4, hd ], [ sx + lw * s, yy, hd ], 0.08 );
				beam( q, [ sx - lw, yy, - hd * s ], [ sx - lw, yy - 2.4, hd * s ], 0.08 );
				beam( q, [ sx + lw, yy, - hd * s ], [ sx + lw, yy - 2.4, hd * s ], 0.08 );

			}

		}

		// the bank of lamps sits between the legs' tops; cross girders (K braced) below it and one deep
		// girder under it
		const BH = 7.0;
		for ( const yy of [ h * 0.36, h * 0.62, h - BH - 0.2 ].filter( ( v ) => v > 3 ) ) {

			for ( const oz of [ - hd, hd ] ) {

				beam( q, [ - hw + lw, yy, oz ], [ hw - lw, yy, oz ], 0.4 );
				beam( q, [ - hw + lw, yy - 1.6, oz ], [ hw - lw, yy - 1.6, oz ], 0.22 );
				for ( let t = 0; t < 4; t ++ ) {

					const xa = - hw + lw + ( W - 2 * lw ) * t / 4, xb = - hw + lw + ( W - 2 * lw ) * ( t + 1 ) / 4;
					beam( q, [ xa, yy - 1.6, oz ], [ ( xa + xb ) / 2, yy, oz ], 0.12 );
					beam( q, [ ( xa + xb ) / 2, yy, oz ], [ xb, yy - 1.6, oz ], 0.12 );

				}

			}

		}

		const sm = new Mesh( q.geometry(), steel );
		sm.name = 'portal-tower';
		sm.castShadow = true;
		sm.receiveShadow = true;
		g.add( sm );
		// the lamp bank between the legs' tops: a near-square frame of 8 x 7 round fixtures (dark
		// housings, glowing lenses), tipped down toward the field
		const bank = new Group();
		bank.position.set( 0, h - BH / 2 + 0.3, - 0.3 );
		bank.rotation.x = 0.25;
		const fq = new Quads(), lq = new Quads(), hq = new Quads();
		const BW = W - 2 * lw - 0.4, cols = 8, rowsL = 7;
		for ( let j = 0; j <= rowsL; j ++ ) beam( fq, [ - BW / 2, - BH / 2 + BH * j / rowsL, 0.25 ], [ BW / 2, - BH / 2 + BH * j / rowsL, 0.25 ], 0.12 );
		for ( let i = 0; i <= cols; i ++ ) beam( fq, [ - BW / 2 + BW * i / cols, - BH / 2, 0.25 ], [ - BW / 2 + BW * i / cols, BH / 2, 0.25 ], 0.12 );
		const cw = BW / cols, rh = BH / rowsL, R = Math.min( cw, rh ) * 0.36;
		for ( let i = 0; i < cols; i ++ ) for ( let j = 0; j < rowsL; j ++ ) {

			const cx = - BW / 2 + cw * ( i + 0.5 ), cy = - BH / 2 + rh * ( j + 0.5 );
			box( hq, [ cx, cy, 0.0 ], [ R * 2.3, R * 2.3, 0.45 ] );
			for ( let k = 0; k < 12; k ++ ) {

				const a0 = k / 12 * Math.PI * 2, a1 = ( k + 1 ) / 12 * Math.PI * 2;
				lq.tri( [ cx, cy, - 0.24 ], [ cx + Math.cos( a1 ) * R, cy + Math.sin( a1 ) * R, - 0.24 ], [ cx + Math.cos( a0 ) * R, cy + Math.sin( a0 ) * R, - 0.24 ], [ 0, 0, - 1 ] );

			}

		}

		const frameM = new Mesh( fq.geometry(), steel );
		frameM.castShadow = true;
		bank.add( frameM );
		const housing = this._lampHousing || ( this._lampHousing = standard( { name: 'lamp-housings', color: new Color( 0.05, 0.05, 0.055 ), roughness: 0.5, metalness: 0.5 } ) );
		housing.underwaterLighting = 'none';
		bank.add( new Mesh( hq.geometry(), housing ) );
		bank.add( new Mesh( lq.geometry(), lamp ) );
		// the legs run up past it
		for ( const sx of [ - hw, hw ] ) beam( q, [ sx, h, 0 ], [ sx, h + 0.6, 0 ], 0.5 );
		g.add( bank );
		this.group.add( g );
		g.updateMatrix();
		for ( const sx of [ - hw, hw ] ) {

			const p = new Vector3( sx, 0, 0 ).applyMatrix4( g.matrix );
			const w = this.field.toWorld( p.x, p.z );
			this.colliders.addCylinder( w.x, w.z, 1.0, this.field.y0 + y0, this.field.y0 + y0 + 6 );

		}

		( this.towers || ( this.towers = [] ) ).push( { group: g, bank } );

	}

	// Each light tower's bank as a spot light aimed at the field (world frame), for LocalLights.
	lightSources() {

		this.field.group.updateMatrixWorld( true );
		const target = new Vector3( 0, 0, - 45 ).applyMatrix4( this.field.group.matrixWorld );
		return ( this.towers || [] ).map( ( { bank } ) => {

			const position = new Vector3().setFromMatrixPosition( bank.matrixWorld );
			const dir = target.clone().sub( position ).normalize();
			return { position, dir };

		} );

	}

	// the back of the upper deck, from above its top row up to the roof
	// Behind the top row up to the roof: open steel, as it shows from the street. Posts on the column line
	// carry the roof, a beam at the top row and one under the roof, X bracing in every third bay, and a
	// pipe rail along the back of the top row.
	_rearWall( P, y0, y1 ) {

		const q = new Quads(), rail = new Quads();
		let bay = 0;
		for ( let i = 0; i < P.length - 1; i ++ ) {

			const [ ax, az ] = P[ i ], [ bx, bz ] = P[ i + 1 ];
			const len = Math.hypot( bx - ax, bz - az );
			const n = Math.max( 1, Math.round( len / 9.5 ) );
			for ( let k = 0; k < n; k ++, bay ++ ) {

				const x0 = ax + ( bx - ax ) * k / n, z0 = az + ( bz - az ) * k / n;
				const x1 = ax + ( bx - ax ) * ( k + 1 ) / n, z1 = az + ( bz - az ) * ( k + 1 ) / n;
				beam( q, [ x0, y0, z0 ], [ x0, y1 + 0.9, z0 ], 0.55 );
				beam( q, [ x0, y0, z0 ], [ x1, y0, z1 ], 0.5 );
				beam( q, [ x0, y1, z0 ], [ x1, y1, z1 ], 0.45 );
				if ( bay % 3 === 1 ) {

					beam( q, [ x0, y0, z0 ], [ x1, y1, z1 ], 0.26 );
					beam( q, [ x1, y0, z1 ], [ x0, y1, z0 ], 0.26 );

				}

				beam( rail, [ x0, y0 + 2.3, z0 ], [ x1, y0 + 2.3, z1 ], 0.06 );
				beam( rail, [ x0, y0 + 1.75, z0 ], [ x1, y0 + 1.75, z1 ], 0.04 );

			}

			if ( i === P.length - 2 ) beam( q, [ bx, y0, bz ], [ bx, y1 + 0.9, bz ], 0.55 );

		}

		const m = new Mesh( q.geometry(), this._colSteel );
		m.name = 'upper-rear-steel';
		m.castShadow = true;
		m.receiveShadow = true;
		this.group.add( m );
		const r = new Mesh( rail.geometry(), this.materials.rail );
		r.name = 'upper-rear-rail';
		this.group.add( r );

	}

	// ---------------------------------------------------------------- the pit and the street level

	// The outline of everything below street level, going round: the back of the left field seats, behind
	// Monty's Angle and the batter's eye, behind the bullpens, the back of the right field seats, then
	// the top of the field level seats from right field round behind home plate to left field.
	_pitOutline() {

		const [ inf, lf, rf, cLF, cRF ] = this.tiers;
		const back = ( t ) => offsetPolyline( t.front, ( t.start || 0 ) + t.rows * t.depth, t.outward );
		const cf = offsetPolyline( this._fenceLine( 3, 8 ), 7, [ 0, 0 ] ); // 387 .. 401: the batter's eye
		const pens = offsetPolyline( this._fenceLine( 8, 9 ), BULLPENS.back + 0.4, [ 0, 0 ] );
		// round the back of the corner fans too (the right one runs from the outfield seats to the foul line)
		const pts = [ ...back( lf ), ...cf, ...pens, ...back( rf ), ...back( cRF ), ...back( inf ), ...back( cLF ) ];
		// drop near-duplicates
		return pts.filter( ( p, i ) => Math.hypot( p[ 0 ] - pts[ ( i + pts.length - 1 ) % pts.length ][ 0 ], p[ 1 ] - pts[ ( i + pts.length - 1 ) % pts.length ][ 1 ] ) > 0.05 );

	}

	_buildStreetLevel() {

		const contour = FOOTPRINT.map( ( [ x, z ] ) => new Vector2( x, z ) );
		const hole = this.pit.map( ( [ x, z ] ) => new Vector2( x, z ) );
		const tris = triangulateShape( contour, [ hole ] );
		const all = contour.concat( hole );
		const pos = [], nrm = [], uv = [];
		for ( const p of all ) {

			pos.push( p.x, STREET, p.y );
			nrm.push( 0, 1, 0 );
			uv.push( p.x, p.y );

		}

		const index = [];
		for ( const [ a, b, c ] of tris ) index.push( a, c, b );
		const geo = new BufferGeometry();
		geo.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
		geo.setAttribute( 'normal', new Float32BufferAttribute( nrm, 3 ) );
		geo.setAttribute( 'uv', new Float32BufferAttribute( uv, 2 ) );
		geo.setIndex( index );
		geo.computeBoundingBox();
		geo.computeBoundingSphere();
		// concourse paving: large light concrete slabs with dark joints
		const mat = standard( {
			name: 'concourse', color: new Color( 0.36, 0.35, 0.33 ), roughness: 0.6, modules: [ commonModule ],
			surface: /* wgsl */`
	// sealed concrete, saw-cut every 1.8 m, darker where the crowds walk and spill things
	let p = in.P.xz;
	let g = abs( fract( p / 1.8 ) - 0.5 ) * 1.8;
	let fw = fwidth( p.x ) + 0.002;
	let joint = 1.0 - ( 1.0 - smoothstep( 0.012, 0.012 + fw, min( 0.9 - g.x, 0.9 - g.y ) ) ) * ( 1.0 - clamp( fw * 20.0, 0.0, 1.0 ) ) * 0.4;
	let wear = 0.86 + 0.14 * mx_noise_float2( p * 0.25 );
	let stain = 1.0 - 0.18 * smoothstep( 0.55, 0.8, mx_noise_float2( p * 1.3 + vec2f( 7.0 ) ) );
	s.albedo = mat.color * joint * wear * stain * ( 0.95 + 0.06 * mx_noise_float2( p * 9.0 ) );
	s.roughness = mix( 0.45, 0.7, mx_noise_float2( p * 0.5 ) * 0.5 + 0.5 );
	// under the floors above: the sky's light only comes in from the field side
	s.ao = 0.45;
`,
		} );
		mat.underwaterLighting = 'none';
		mat.setDefine( 'DRY', 1 ); // mostly under the decks
		const mesh = new Mesh( geo, mat );
		mesh.name = 'street-level';
		mesh.receiveShadow = true;
		this.group.add( mesh );

	}

	// the pit's edge down to the field: brick where it shows (the batter's eye, behind the bullpens), under
	// the seats elsewhere
	_buildPitWalls() {

		const brick = standard( {
			name: 'pit-brick', color: new Color( 0.3, 0.1, 0.06 ), roughness: 0.85, modules: [ commonModule ],
			surface: /* wgsl */`
	let u = in.uv.x; let v = in.uv.y;
	let row = floor( v / 0.075 );
	let bu = u / 0.2 + 0.5 * ( row % 2.0 );
	// courses fade to their average where they get finer than a pixel (no moire); a broad mottle keeps
	// the far walls from going flat
	let fr = clamp( fwidth( v ) / 0.075 * 1.5 - 0.25, 0.0, 1.0 );
	let fb = clamp( fwidth( bu ) * 1.5 - 0.25, 0.0, 1.0 );
	let mortar = mix( step( 0.9, fract( v / 0.075 ) ), 0.1, fr ) + mix( step( 0.94, fract( bu ) ), 0.06, max( fr, fb ) );
	let tone = mix( 0.85 + 0.3 * fract( sin( dot( vec2f( floor( bu ), row ), vec2f( 12.9898, 78.233 ) ) ) * 43758.5453 ), 1.0, max( fr, fb ) );
	let mottle = 0.92 + 0.12 * mx_noise_float2( vec2f( u, v ) * 0.35 );
	s.albedo = mix( mat.color * tone * mottle, vec3f( 0.35, 0.33, 0.3 ), clamp( mortar, 0.0, 1.0 ) );
`,
		} );
		brick.underwaterLighting = 'none';
		const q = new Quads();
		const P = this.pit;
		let u = 0;
		for ( let i = 0; i < P.length; i ++ ) {

			const [ ax, az ] = P[ i ], [ bx, bz ] = P[ ( i + 1 ) % P.length ];
			const len = Math.hypot( bx - ax, bz - az );
			if ( len < 1e-3 ) continue;
			// facing into the pit: toward second base
			let nx = - ( bz - az ) / len, nz = ( bx - ax ) / len;
			if ( nx * ( 0 - ( ax + bx ) / 2 ) + nz * ( - 60 - ( az + bz ) / 2 ) < 0 ) {

				nx = - nx; nz = - nz;

			}

			q.add( [ ax, 0, az ], [ bx, 0, bz ], [ bx, STREET, bz ], [ ax, STREET, az ], [ nx, 0, nz ], u, u + len );
			u += len;

		}

		const mesh = new Mesh( q.geometry(), brick );
		mesh.name = 'pit-walls';
		mesh.receiveShadow = true;
		mesh.castShadow = true;
		this.group.add( mesh );

	}

}

// ---------------------------------------------------------------- geometry helpers

// A polyline moved d to the side away from `outward`, mitred at the corners (the rows' back edge).
export function offsetPolyline( P, d, outward ) {

	const n = P.length;
	const normals = [];
	for ( let i = 0; i < n - 1; i ++ ) {

		const [ ax, az ] = P[ i ], [ bx, bz ] = P[ i + 1 ];
		const l = Math.hypot( bx - ax, bz - az ) || 1;
		let nx = - ( bz - az ) / l, nz = ( bx - ax ) / l;
		if ( nx * ( ( ax + bx ) / 2 - outward[ 0 ] ) + nz * ( ( az + bz ) / 2 - outward[ 1 ] ) < 0 ) {

			nx = - nx; nz = - nz;

		}

		normals.push( [ nx, nz ] );

	}

	const out = [];
	for ( let i = 0; i < n; i ++ ) {

		const a = normals[ Math.max( 0, i - 1 ) ], b = normals[ Math.min( n - 2, i ) ];
		let mx = a[ 0 ] + b[ 0 ], mz = a[ 1 ] + b[ 1 ];
		const ml = Math.hypot( mx, mz ) || 1;
		mx /= ml; mz /= ml;
		const k = d / Math.max( 0.3, mx * b[ 0 ] + mz * b[ 1 ] );
		out.push( [ P[ i ][ 0 ] + mx * k, P[ i ][ 1 ] + mz * k ] );

	}

	return out;

}

// The corner between a front line arriving along A0 -> A1 and one leaving along B0 -> B1, rounded: the
// arc of radius R tangent to both, as n segments (n + 1 points, from the first line's tangent point to
// the second's).
export function roundCorner( A0, A1, B0, B1, R, n = 4 ) {

	const la = Math.hypot( A1[ 0 ] - A0[ 0 ], A1[ 1 ] - A0[ 1 ] ), lb = Math.hypot( B1[ 0 ] - B0[ 0 ], B1[ 1 ] - B0[ 1 ] );
	const a = [ ( A1[ 0 ] - A0[ 0 ] ) / la, ( A1[ 1 ] - A0[ 1 ] ) / la ], b = [ ( B1[ 0 ] - B0[ 0 ] ) / lb, ( B1[ 1 ] - B0[ 1 ] ) / lb ];
	const cr = a[ 0 ] * b[ 1 ] - a[ 1 ] * b[ 0 ];
	const s = ( ( B0[ 0 ] - A0[ 0 ] ) * b[ 1 ] - ( B0[ 1 ] - A0[ 1 ] ) * b[ 0 ] ) / cr;
	const X = [ A0[ 0 ] + a[ 0 ] * s, A0[ 1 ] + a[ 1 ] * s ];
	const turn = Math.acos( Math.max( - 1, Math.min( 1, a[ 0 ] * b[ 0 ] + a[ 1 ] * b[ 1 ] ) ) ), t = R * Math.tan( turn / 2 );
	const TA = [ X[ 0 ] - a[ 0 ] * t, X[ 1 ] - a[ 1 ] * t ];
	// the arc's centre is inside the turn
	const na = cr > 0 ? [ - a[ 1 ], a[ 0 ] ] : [ a[ 1 ], - a[ 0 ] ];
	const C = [ TA[ 0 ] + na[ 0 ] * R, TA[ 1 ] + na[ 1 ] * R ];
	const a0 = Math.atan2( TA[ 1 ] - C[ 1 ], TA[ 0 ] - C[ 0 ] ), da = ( cr > 0 ? 1 : - 1 ) * turn;
	const out = [];
	for ( let i = 0; i <= n; i ++ ) out.push( [ C[ 0 ] + Math.cos( a0 + da * i / n ) * R, C[ 1 ] + Math.sin( a0 + da * i / n ) * R ] );
	return out;

}

export function pointInPolygon( x, z, P ) {

	let inside = false;
	for ( let i = 0, j = P.length - 1; i < P.length; j = i ++ ) {

		const [ ax, az ] = P[ i ], [ bx, bz ] = P[ j ];
		if ( ( az > z ) !== ( bz > z ) && x < ( bx - ax ) * ( z - az ) / ( bz - az ) + ax ) inside = ! inside;

	}

	return inside;

}

void tierTop;
