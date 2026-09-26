import { Group, Mesh, BoxGeometry, BufferGeometry, Float32BufferAttribute, Vector2, Vector3, Color } from '../engine/index.js';
import { triangulateShape } from '../engine/math/ShapeUtils.js';
import { commonModule } from '../engine/render/wgsl/common.js';
import { standard } from '../materials/Materials.js';
import { buildTier, tierTop, standsMaterials, Quads } from './Stands.js';
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
const ROW = 0.84; // row depth (33 in)

export class Bowl {

	constructor( { field, colliders } ) {

		this.field = field;
		this.colliders = colliders;
		this.group = new Group();
		this.group.name = 'bowl';
		field.group.add( this.group );
		this.materials = standsMaterials();
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
			y0: 1.2,
			rows: 20,
			depth: ROW,
			rise: 0.3,
			section: 16,
			aisle: 1.2,
			skipRows: ( k ) => dugoutSegs.includes( k ) ? 4 : 0,
		};

		// behind the left field wall: a flower bed, then the 140s up to the concourse
		const lf = this._fenceLine( 0, 3 );
		const leftField = {
			name: 'left-field-seats',
			front: lf,
			outward: [ 0, 0 ],
			start: 1.5,
			frontY: 0,
			y0: 10.5 * FT + 0.4,
			rows: 11,
			depth: ROW,
			rise: 0.31,
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
			rows: 9,
			depth: ROW,
			rise: 0.33,
			section: 14,
			aisle: 1.2,
		};

		return [ infield, leftField, rightField ];

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

	// The protective netting, 25 ft high in front of the seats from the far end of the first base dugout
	// round behind home plate to the far end of the third base dugout: a fine green mesh.
	_buildNetting() {

		const F = FOUL_TERRITORY;
		const run = F.slice( 3, 11 ); // 150 ft out on the first base side .. 150 ft out on third
		const H = 25 * FT;
		const q = new Quads();
		let u = 0;
		for ( let i = 0; i < run.length - 1; i ++ ) {

			const [ ax, az ] = run[ i ], [ bx, bz ] = run[ i + 1 ];
			const len = Math.hypot( bx - ax, bz - az );
			q.add( [ ax, 0, az ], [ bx, 0, bz ], [ bx, H, bz ], [ ax, H, az ], [ - ( bz - az ) / len, 0, ( bx - ax ) / len ], u, u + len );
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
	let coverage = mix( 0.12, strand, clamp( 1.0 - fw * 2.0, 0.0, 1.0 ) );
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
		const line = ( P, d ) => offsetPolyline( P, d, [ 0, - 40 ] );
		const L = LEVELS;

		const tiers = [
			// suite level: two rows in front of the suites
			{ name: 'suite-seats', front: line( infieldPath, top - 1.0 ), outward: [ 0, - 40 ], y0: L.suites - 0.6, rows: 2, depth: 0.95, rise: 0.35, section: 12, aisle: 1.4, soffit: 0.9, frontWall: { top: L.suites + 0.2 }, base: L.suites - 1.5 },
			// Hall of Fame Club: 13 rows up to the club concourse
			{ name: 'club-level', front: line( infieldPath, top + 4.5 ), outward: [ 0, - 40 ], y0: L.clubConcourse - 12 * 0.46 - 0.2, rows: 13, depth: ROW, rise: 0.46, section: 14, aisle: 1.2, soffit: 1.0, frontWall: { top: L.clubConcourse - 12 * 0.46 + 0.8 }, base: L.clubConcourse - 12 * 0.46 - 1.2 },
			// Terrace: 300s up to the walkway
			{ name: 'terrace-300', front: line( path, top + 10 ), outward: [ 0, - 40 ], y0: L.terraceConcourse - 8 * 0.52, rows: 9, depth: ROW, rise: 0.52, section: 14, aisle: 1.2, soffit: 1.1, frontWall: { top: L.terraceConcourse - 8 * 0.52 + 1.0 }, base: L.terraceConcourse - 8 * 0.52 - 1.1 },
			// ... and the 400s above it, behind the walkway
			{ name: 'terrace-400', front: line( path, top + 10 + 9 * ROW + 2.4 ), outward: [ 0, - 40 ], y0: L.terraceConcourse + 0.5, rows: 18, depth: ROW, rise: 0.6, section: 14, aisle: 1.2, soffit: 1.2, back: { height: 2.5 }, base: L.terraceConcourse - 0.7 },
		];

		// the Pavilion: over the right field seats, from the 398 corner to short of the pole (the Terrace
		// deck comes round to the pole)
		const rf = this.tiers[ 2 ];
		const rfTop = rf.start + rf.rows * rf.depth;
		const [ c398, c369, pole ] = rf.front;
		const pavFront = [ c398, c369, [ c369[ 0 ] + ( pole[ 0 ] - c369[ 0 ] ) * 0.62, c369[ 1 ] + ( pole[ 1 ] - c369[ 1 ] ) * 0.62 ] ];
		tiers.push( { name: 'pavilion', front: offsetPolyline( pavFront, rfTop + 1.0, [ 0, 0 ] ), outward: [ 0, 0 ], y0: L.suites + 0.4, rows: 12, depth: ROW, rise: 0.5, section: 14, aisle: 1.2, soffit: 1.0, frontWall: { top: L.suites + 1.4 }, back: { height: 2.5 }, base: L.suites - 0.7 } );

		this.upper = tiers;
		for ( const t of tiers ) this.group.add( buildTier( t, this.ctx ) );

		// the walkway between the 300s and 400s, and the club concourse behind the club seats
		const t300 = tiers[ 2 ], t400 = tiers[ 3 ], club = tiers[ 1 ];
		this._strip( line( path, top + 10 + 9 * ROW ), 2.4, L.terraceConcourse, 'terrace-walkway', false ); // the 400s start behind it
		this._strip( line( infieldPath, top + 4.5 + 13 * ROW ), 9, L.clubConcourse, 'club-concourse' );
		// suites: a glass front and a roof slab over them, behind the suite seats
		this._suites( line( infieldPath, top - 1.0 + 2 * 0.95 ), 7, L.suites, L.clubConcourse - 12 * 0.46 - 1.2 );
		// the roof over the 400s, and the light towers standing on it
		const back400 = t400.rows * ROW;
		this._roof( line( path, top + 10 + 9 * ROW + 2.4 + back400 * 0.35 ), back400 * 0.75, L.roof );
		// behind the top row: a parapet up to the roof; under it all, the columns carrying the decks over
		// the open main concourse
		const t400Top = t400.y0 + ( t400.rows - 1 ) * t400.rise;
		this._rearWall( line( path, top + 10 + 9 * ROW + 2.4 + back400 ), t400Top - 1.2, L.roof - 1.0 );
		this._columns( line( path, top + 10 + 9 * ROW + 2.4 + back400 - 0.4 ), STREET, t400Top - 1.2, 9.5 );
		this._columns( line( infieldPath, top + 4.5 + 13 * ROW + 9 - 0.4 ), STREET, L.clubConcourse - 0.6, 9.5 );

		// elevators: behind home plate and toward first and third, stopping at each level
		this._elevators( path, top );
		void club; void t300;

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
	_suites( P, depth, y, ceiling ) {

		const glass = standard( { name: 'suite-glass', color: new Color( 0.02, 0.03, 0.035 ), roughness: 0.08, metalness: 0.6 } );
		const frame = standard( { name: 'suite-frame', color: new Color( 0.35, 0.34, 0.32 ), roughness: 0.7 } );
		for ( const m of [ glass, frame ] ) m.underwaterLighting = 'none';
		const g = new Quads(), f = new Quads();
		const B = offsetPolyline( P, depth, [ 0, - 40 ] );
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
				g.add( [ p0[ 0 ], y + 0.1, p0[ 1 ] ], [ p1[ 0 ], y + 0.1, p1[ 1 ] ], [ p1[ 0 ], ceiling - 0.3, p1[ 1 ] ], [ p0[ 0 ], ceiling - 0.3, p0[ 1 ] ], [ nx, 0, nz ] );
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
	_roof( P, depth, y ) {

		const steel = standard( { name: 'roof-steel', color: new Color( 0.12, 0.13, 0.14 ), roughness: 0.6, metalness: 0.5 } );
		const deck = standard( { name: 'roof-deck', color: new Color( 0.42, 0.42, 0.4 ), roughness: 0.7, metalness: 0.2, side: 'double' } );
		for ( const m of [ steel, deck ] ) m.underwaterLighting = 'none';
		const r = new Quads(), t = new Quads();
		const B = offsetPolyline( P, depth, [ 0, - 40 ] );
		for ( let i = 0; i < P.length - 1; i ++ ) {

			// the deck slopes up a little toward the field
			r.add( [ P[ i ][ 0 ], y + 0.8, P[ i ][ 1 ] ], [ P[ i + 1 ][ 0 ], y + 0.8, P[ i + 1 ][ 1 ] ], [ B[ i + 1 ][ 0 ], y, B[ i + 1 ][ 1 ] ], [ B[ i ][ 0 ], y, B[ i ][ 1 ] ], [ 0, 1, 0 ] );
			// the fascia along its front edge
			const [ ax, az ] = P[ i ], [ bx, bz ] = P[ i + 1 ];
			const len = Math.hypot( bx - ax, bz - az );
			let nx = - ( bz - az ) / len, nz = ( bx - ax ) / len;
			if ( nx * ( ( ax + bx ) / 2 ) + nz * ( ( az + bz ) / 2 + 40 ) > 0 ) {

				nx = - nx; nz = - nz;

			}

			t.add( [ ax, y - 0.6, az ], [ bx, y - 0.6, bz ], [ bx, y + 1.4, bz ], [ ax, y + 1.4, az ], [ nx, 0, nz ] );
			// trusses under the deck, one per ~9 m, from the back up to the front edge
			const n = Math.max( 1, Math.round( len / 9 ) );
			for ( let k = 0; k <= n; k ++ ) {

				if ( i > 0 && k === 0 ) continue;
				const tt = k / n;
				const fx = ax + ( bx - ax ) * tt, fz = az + ( bz - az ) * tt;
				const bx2 = B[ i ][ 0 ] + ( B[ i + 1 ][ 0 ] - B[ i ][ 0 ] ) * tt, bz2 = B[ i ][ 1 ] + ( B[ i + 1 ][ 1 ] - B[ i ][ 1 ] ) * tt;
				const w = 0.25, px = - ( bz2 - fz ), pz = bx2 - fx, pl = Math.hypot( px, pz );
				const ox = px / pl * w, oz = pz / pl * w;
				// a deep beam: top chord under the deck, bottom chord rising from the back
				t.add( [ fx + ox, y - 0.6, fz + oz ], [ bx2 + ox, y - 3.5, bz2 + oz ], [ bx2 + ox, y, bz2 + oz ], [ fx + ox, y + 0.8, fz + oz ], [ ox, 0, oz ] );
				t.add( [ fx - ox, y - 0.6, fz - oz ], [ bx2 - ox, y - 3.5, bz2 - oz ], [ bx2 - ox, y, bz2 - oz ], [ fx - ox, y + 0.8, fz - oz ], [ - ox, 0, - oz ] );
				t.add( [ fx - ox, y - 0.6, fz - oz ], [ fx + ox, y - 0.6, fz + oz ], [ bx2 + ox, y - 3.5, bz2 + oz ], [ bx2 - ox, y - 3.5, bz2 - oz ], [ 0, - 1, 0 ] );

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

		// light towers: at both ends of the roof and over first and third
		const towers = [ B[ 0 ], B[ B.length - 1 ], B[ 3 ], B[ B.length - 4 ] ];
		for ( const [ x, z ] of towers ) this._lightTower( x, z, y, LEVELS.lightTowers );

	}

	// a steel lattice mast from the roof (y0) up to y1 with a bank of lights facing the field
	_lightTower( x, z, y0, y1 ) {

		const steel = this._towerSteel || ( this._towerSteel = standard( { name: 'tower-steel', color: new Color( 0.1, 0.1, 0.11 ), roughness: 0.6, metalness: 0.6 } ) );
		const lamp = this._lamp || ( this._lamp = standard( { name: 'tower-lamps', color: new Color( 0.8, 0.8, 0.75 ), roughness: 0.3, emissive: new Color( 0, 0, 0 ) } ) );
		steel.underwaterLighting = 'none';
		lamp.underwaterLighting = 'none';
		const g = new Group();
		g.position.set( x, y0, z );
		// face the field: toward second base
		g.rotation.y = Math.atan2( - ( 0 - x ), - ( - 38 - z ) );
		const h = y1 - y0;
		const leg = new BoxGeometry( 0.35, h, 0.35 );
		for ( const [ lx, lz ] of [ [ - 1.2, - 1.2 ], [ 1.2, - 1.2 ], [ - 1.2, 1.2 ], [ 1.2, 1.2 ] ] ) {

			const m = new Mesh( leg, steel );
			m.position.set( lx, h / 2, lz );
			m.castShadow = true;
			g.add( m );

		}

		// cross bracing every 3 m
		for ( let yy = 2; yy < h - 4; yy += 3 ) {

			for ( const [ w, d, px, pz ] of [ [ 2.6, 0.15, 0, - 1.2 ], [ 2.6, 0.15, 0, 1.2 ], [ 0.15, 2.6, - 1.2, 0 ], [ 0.15, 2.6, 1.2, 0 ] ] ) {

				const m = new Mesh( new BoxGeometry( w, 0.15, d ), steel );
				m.position.set( px, yy, pz );
				g.add( m );

			}

		}

		// the light bank: a frame of lamps tilted down toward the field
		const bank = new Group();
		bank.position.set( 0, h + 2.5, - 0.8 );
		bank.rotation.x = 0.35;
		const frameM = new Mesh( new BoxGeometry( 9, 6, 0.4 ), steel );
		frameM.castShadow = true;
		bank.add( frameM );
		const lampGeo = new BoxGeometry( 0.9, 0.9, 0.25 );
		for ( let i = 0; i < 8; i ++ ) for ( let j = 0; j < 5; j ++ ) {

			const m = new Mesh( lampGeo, lamp );
			m.position.set( - 3.9 + i * 1.11, - 2.2 + j * 1.1, - 0.3 );
			bank.add( m );

		}

		g.add( bank );
		this.group.add( g );
		( this.towers || ( this.towers = [] ) ).push( g );

	}

	// square steel columns every ~spacing m along P, from y0 to y1
	_columns( P, y0, y1, spacing ) {

		const steel = this._colSteel || ( this._colSteel = standard( { name: 'columns', color: new Color( 0.1, 0.22, 0.16 ), roughness: 0.6, metalness: 0.4 } ) );
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

	// Elevator banks at three places round the infield. Each stops on the main concourse, the suite
	// level, the club concourse and the terrace walkway; `this.elevators` lists the stops (field frame)
	// for the walker's E prompt.
	_elevators( path, top ) {

		const L = LEVELS;
		const levels = [
			{ name: 'Main concourse', d: top + 14, y: STREET },
			{ name: 'Suite level', d: top + 3.0, y: L.suites },
			{ name: 'Club level', d: top + 4.5 + 13 * ROW + 4.5, y: L.clubConcourse },
			{ name: 'Terrace', d: top + 10 + 9 * ROW + 1.2, y: L.terraceConcourse },
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

	// the back of the upper deck, from above its top row up to the roof
	_rearWall( P, y0, y1 ) {

		const q = new Quads();
		for ( let i = 0; i < P.length - 1; i ++ ) {

			const [ ax, az ] = P[ i ], [ bx, bz ] = P[ i + 1 ];
			const len = Math.hypot( bx - ax, bz - az );
			let nx = - ( bz - az ) / len, nz = ( bx - ax ) / len;
			if ( nx * ( ( ax + bx ) / 2 ) + nz * ( ( az + bz ) / 2 + 40 ) > 0 ) {

				nx = - nx; nz = - nz;

			}

			q.add( [ ax, y0, az ], [ bx, y0, bz ], [ bx, y1, bz ], [ ax, y1, az ], [ nx, 0, nz ] );
			q.add( [ bx, y0, bz ], [ ax, y0, az ], [ ax, y1, az ], [ bx, y1, bz ], [ - nx, 0, - nz ] );

		}

		const m = new Mesh( q.geometry(), this.materials.concrete );
		m.name = 'upper-rear-wall';
		m.castShadow = true;
		m.receiveShadow = true;
		this.group.add( m );

	}

	// ---------------------------------------------------------------- the pit and the street level

	// The outline of everything below street level, going round: the back of the left field seats, behind
	// Monty's Angle and the batter's eye, behind the bullpens, the back of the right field seats, then
	// the top of the field level seats from right field round behind home plate to left field.
	_pitOutline() {

		const [ inf, lf, rf ] = this.tiers;
		const back = ( t ) => offsetPolyline( t.front, ( t.start || 0 ) + t.rows * t.depth, t.outward );
		const cf = offsetPolyline( this._fenceLine( 3, 8 ), 7, [ 0, 0 ] ); // 387 .. 401: the batter's eye
		const pens = offsetPolyline( this._fenceLine( 8, 9 ), 0.5 + 2 * BULLPENS.depth + 0.4, [ 0, 0 ] );
		const pts = [ ...back( lf ), ...cf, ...pens, ...back( rf ), ...back( inf ) ];
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
			name: 'concourse', color: new Color( 0.42, 0.4, 0.37 ), roughness: 0.8, modules: [ commonModule ],
			surface: /* wgsl */`
	let p = in.P.xz;
	let g = abs( fract( p / 3.0 ) - 0.5 );
	let joint = 1.0 - smoothstep( 0.47, 0.49, max( g.x, g.y ) ) * 0.35;
	s.albedo = mat.color * joint * ( 0.9 + 0.1 * mx_noise_float2( p * 0.7 ) ) * ( 0.95 + 0.06 * mx_noise_float2( p * 9.0 ) );
`,
		} );
		mat.underwaterLighting = 'none';
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
	let mortar = step( 0.9, fract( v / 0.075 ) ) + step( 0.94, fract( bu ) );
	let tone = 0.85 + 0.3 * fract( sin( dot( vec2f( floor( bu ), row ), vec2f( 12.9898, 78.233 ) ) ) * 43758.5453 );
	s.albedo = mix( mat.color * tone, vec3f( 0.35, 0.33, 0.3 ), clamp( mortar, 0.0, 1.0 ) );
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

export function pointInPolygon( x, z, P ) {

	let inside = false;
	for ( let i = 0, j = P.length - 1; i < P.length; j = i ++ ) {

		const [ ax, az ] = P[ i ], [ bx, bz ] = P[ j ];
		if ( ( az > z ) !== ( bz > z ) && x < ( bx - ax ) * ( z - az ) / ( bz - az ) + ax ) inside = ! inside;

	}

	return inside;

}

void tierTop;
