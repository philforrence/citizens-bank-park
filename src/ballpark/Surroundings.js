import { Group, Mesh, BoxGeometry, CylinderGeometry, ConeGeometry, SphereGeometry, Float32BufferAttribute, BufferGeometry, Color } from '../engine/index.js';
import { commonModule } from '../engine/render/wgsl/common.js';
import { standard } from '../materials/Materials.js';
import { Quads } from './Stands.js';
import { flatPolygon, canvasTexture } from './geo.js';
import { LEVELS } from './layout.js';
import { TOWERS, NEIGHBOURS, ROADS } from './data/surroundings.js';

// South Philadelphia round the ballpark and Center City on the horizon: the streets (from OpenStreetMap),
// the other venues of the sports complex as plain masses, and Center City's towers on their real
// footprints, 5 km north, with City Hall's tower among them. Field frame, street level = LEVELS.mainConcourse.

const STREET = LEVELS.mainConcourse;

// ---- L (light and night): Center City as it stood and was lit in October 2008.
// The towers finished after the 2008 World Series (their completion years: ref/night/INDEX.md)
const AFTER_2008 = new Set( [ 'Comcast Technology Center', 'FMC Tower', 'W Hotel & Element by Westin Philadelphia', 'The Laurel',
	'Evo Cira Centre South', '1919 Market', 'Riverwalk North Tower', 'Avira', 'Broad + Noble Apartments', 'One Riverside', 'The Crane',
	'NorthXNorthwest', 'The Harper', 'The Alexander', '1213 Walnut', '204 South 12th Street', '2301 JFK Boulevard', 'One Cathedral Square',
	'Jessup House', 'The Girard' ] );
// The crowns lit at night (the lots on Oct 27, 2008, ref/night roadieshow 3024603196: Mellon's pyramid red
// over a white band, One Liberty's gables in red chevrons, Two Liberty's red and white, Comcast Center's
// glass top white; FOX's skyline shot that night: City Hall floodlit, the PSFS sign red; the Cira
// Centre's LED facade red with the Phillies' P, blender13 2985440887, Oct 29; Two Liberty's gables red,
// white and blue on Oct 27, btjones 2996432962; Comcast Center's ring at its very top red for the
// Series, billypenn 2023; One Liberty's red on the 29th). `shape` corrects a tower's top
// for its crown; kinds: 1 gables (nested chevrons), 2 a lit pyramid over a band, 3 a glass lantern,
// 4 a neon sign, 5 a spire, 6 an LED facade, 7 an obstruction light.
const CROWNS = {
	'One Liberty Place': { gables: { w: 12, H: 17, lines: 3, scheme: 0 }, spire: 11, beacon: true },
	'Two Liberty Place': { shape: { h: 232, spire: 258 }, gables: { w: 10, H: 20, lines: 2, scheme: 1 }, spire: 6, beacon: true },
	'BNY Mellon Center': { shape: { h: 222, spire: 241 }, pyramid: { w: 15, H: 19 }, beacon: true },
	'Comcast Center': { lantern: 13, beacon: true },
	'Loews Philadelphia Hotel': { sign: [ 24, 7 ] },
	'Cira Centre': { led: true },
};
// ---- end L

const NEIGHBOUR_HEIGHT = {
	'Lincoln Financial Field': 38,
	'Xfinity Mobile Arena': 32,
	'Philadelphia Live! Casino': 16,
	'NovaCare Complex': 12,
};

export class Surroundings {

	constructor( { field } ) {

		this.field = field;
		this.group = new Group();
		this.group.name = 'surroundings';
		field.group.add( this.group );
		this._buildRoads();
		// the venues next door, the lots, the highways and the city blocks are in Complex.js
		this._buildSkyline();
		this._holidayInn(); // ---- L

	}

	// ---------------------------------------------------------------- streets

	_buildRoads() {

		const mat = standard( {
			name: 'road', color: new Color( 0.075, 0.075, 0.075 ), roughness: 0.9, modules: [ commonModule ],
			surface: /* wgsl */`
	// uv: x along the road (m), y across it (-1 .. 1). A double yellow line down the middle of two-way
	// roads (uv.y carries the sign of the kind), white edge lines
	let across = abs( in.uv.y );
	var c = mat.color * ( 0.8 + 0.3 * mx_noise_float2( in.P.xz * 0.2 ) ) * ( 0.92 + 0.12 * mx_noise_float2( in.P.xz * 5.0 ) );
	let hw = in.vs.vRoad.x;
	let d = across * hw; // metres from the centre line
	if ( in.vs.vRoad.y > 0.5 && abs( d - 0.15 ) < 0.06 ) { c = vec3f( 0.55, 0.4, 0.05 ); }
	if ( abs( d - ( hw - 0.6 ) ) < 0.07 ) { c = vec3f( 0.6 ); }
	s.albedo = c;
`,
			varyings: { vRoad: 'vec2f' },
			attributes: { aRoad: 'vec2f' },
			vertex: 'o.vRoad = v.aRoad;',
		} );
		mat.underwaterLighting = 'none';
		const pos = [], nrm = [], uv = [], road = [];
		const push = ( x, z, u, v, hw, twoWay ) => {

			pos.push( x, STREET + 0.006, z );
			nrm.push( 0, 1, 0 );
			uv.push( u, v );
			road.push( hw, twoWay );

		};

		for ( const r of ROADS ) {

			// the highways are built up on their viaducts in Complex.js
			if ( /^(motorway|trunk)/.test( r.kind ) ) continue;
			const P = r.pts;
			const hw = r.w / 2;
			const twoWay = ! r.oneway && r.w >= 10 ? 1 : 0;
			let u = 0;
			for ( let i = 0; i < P.length - 1; i ++ ) {

				const [ ax, az ] = P[ i ], [ bx, bz ] = P[ i + 1 ];
				const len = Math.hypot( bx - ax, bz - az );
				if ( len < 0.1 ) continue;
				// a quad per segment, a little long so the joins overlap
				const ux = ( bx - ax ) / len, uz = ( bz - az ) / len, nx = - uz * hw, nz = ux * hw;
				const e = Math.min( hw, 3 );
				const A = [ ax - ux * e, az - uz * e ], B = [ bx + ux * e, bz + uz * e ];
				const quad = [ [ A, - 1, u ], [ B, - 1, u + len ], [ B, 1, u + len ], [ A, - 1, u ], [ B, 1, u + len ], [ A, 1, u ] ];
				// wound to face up (the side vector is to the left of the direction of travel)
				for ( const k of [ 0, 2, 1, 3, 5, 4 ] ) {

					const [ p, side, uu ] = quad[ k ];
					push( p[ 0 ] + nx * side, p[ 1 ] + nz * side, uu, side, hw, twoWay );

				}

				u += len;

			}

		}

		const q = new Quads();
		q.pos = pos;
		q.nrm = nrm;
		q.uv = uv;
		const geo = q.geometry();
		geo.setAttribute( 'aRoad', new Float32BufferAttribute( road, 2 ) );
		const mesh = new Mesh( geo, mat );
		mesh.name = 'roads';
		mesh.receiveShadow = true;
		mesh.frustumCulled = false;
		this.group.add( mesh );

	}

	// ---------------------------------------------------------------- the rest of the sports complex

	_buildNeighbours() {

		const wall = standard( { name: 'neighbour-walls', color: new Color( 0.32, 0.33, 0.35 ), roughness: 0.7, modules: [ commonModule ],
			surface: /* wgsl */`
	// bands of glass and panels
	let v = fract( in.P.y / 4.0 );
	s.albedo = mix( mat.color, vec3f( 0.05, 0.07, 0.09 ), step( 0.55, v ) ) * ( 0.9 + 0.1 * mx_noise_float2( in.P.xz * 0.3 ) );
` } );
		const roof = standard( { name: 'neighbour-roofs', color: new Color( 0.5, 0.5, 0.48 ), roughness: 0.8 } );
		for ( const m of [ wall, roof ] ) m.underwaterLighting = 'none';
		for ( const n of NEIGHBOURS ) {

			const h = NEIGHBOUR_HEIGHT[ n.name ] || 15;
			this._prism( n.fp, STREET, STREET + h, wall, roof, n.name );

		}

	}

	// an extruded footprint: walls (uv x along, y up) and a flat roof
	_prism( fp, y0, y1, wallMat, roofMat, name, cast = true ) {

		const q = new Quads();
		const n = fp.length;
		let area = 0;
		for ( let i = 0; i < n; i ++ ) area += fp[ i ][ 0 ] * fp[ ( i + 1 ) % n ][ 1 ] - fp[ ( i + 1 ) % n ][ 0 ] * fp[ i ][ 1 ];
		const sgn = area > 0 ? 1 : - 1;
		let u = 0;
		for ( let i = 0; i < n; i ++ ) {

			const [ ax, az ] = fp[ i ], [ bx, bz ] = fp[ ( i + 1 ) % n ];
			const len = Math.hypot( bx - ax, bz - az );
			if ( len < 0.05 ) continue;
			const nx = sgn * ( bz - az ) / len, nz = - sgn * ( bx - ax ) / len;
			q.add( [ ax, y0, az ], [ bx, y0, bz ], [ bx, y1, bz ], [ ax, y1, az ], [ nx, 0, nz ], u, u + len );
			u += len;

		}

		const w = new Mesh( q.geometry(), wallMat );
		w.name = name;
		w.castShadow = cast;
		w.receiveShadow = true;
		this.group.add( w );
		const r = new Mesh( flatPolygon( fp, [], y1 ), roofMat );
		r.name = name + '-roof';
		r.castShadow = cast;
		this.group.add( r );

	}

	// ---------------------------------------------------------------- Center City

	_buildSkyline() {

		// curtain walls: floors of glass and spandrel, mullions; each tower its own tint (from its
		// footprint's position); at night a scatter of lit windows
		const glass = standard( {
			name: 'towers', color: new Color( 0.14, 0.16, 0.19 ), roughness: 0.25, metalness: 0.5, modules: [ commonModule ],
			surface: /* wgsl */`
	let P = in.P;
	let N = abs( in.N );
	let u = select( P.x, P.z, N.x > N.z );
	let floorI = floor( P.y / 4.0 );
	let fy = fract( P.y / 4.0 );
	let colI = floor( u / 1.6 );
	let fu = fract( u / 1.6 );
	let seed = fract( sin( dot( floor( P.xz / 40.0 ), vec2f( 12.9898, 78.233 ) ) ) * 43758.5453 );
	let tint = mix( vec3f( 0.1, 0.13, 0.17 ), vec3f( 0.3, 0.28, 0.24 ), seed );
	let spandrel = step( 0.72, fy );
	let mullion = step( 0.92, fu );
	var c = mix( tint, tint * 1.8 + vec3f( 0.04 ), spandrel );
	c = mix( c, vec3f( 0.2 ), mullion * 0.6 );
	s.albedo = c;
	s.roughness = mix( 0.15, 0.7, max( spandrel, mullion ) );
	s.metalness = mix( 0.6, 0.1, max( spandrel, mullion ) );
	// ---- L: after dark, a weeknight at nine: most office floors dark, the cleaners' floors lit end to end,
	// a few late offices; the flats and hotels warmer. From the ballpark a window is finer than a pixel,
	// so there the floor's share glows (it used to sparkle, a Christmas display: ref/night lots photo
	// roadieshow 3024603196, jackiesheeran 2962605155)
	let fr = hash21( vec2f( floorI, seed * 131.0 ) );
	let share = select( select( 0.03, 0.16, fr > 0.7 ), 0.8, fr > 0.93 );
	let cellLit = step( 1.0 - share, hash21( vec2f( colI + seed * 57.0, floorI ) ) ) * ( 1.0 - spandrel ) * ( 1.0 - mullion );
	let wpx = max( fwidth( u ) / 1.6, fwidth( P.y ) / 4.0 );
	let lit = mix( cellLit, share * 0.62, smoothstep( 0.3, 1.1, wpx ) );
	let warm = step( 0.5, seed );
	s.emissive = mix( vec3f( 0.8, 0.92, 0.95 ), vec3f( 1.0, 0.74, 0.46 ), warm ) * lit * frame.night * 2.0;
	// ---- end L
`,
		} );
		const roof = standard( { name: 'tower-roofs', color: new Color( 0.2, 0.2, 0.21 ), roughness: 0.7 } );
		for ( const m of [ glass, roof ] ) m.underwaterLighting = 'none';
		for ( const t0 of TOWERS ) {

			// ---- L: the skyline of October 2008 (the towers finished since are left out), and the crowns
			// as they were lit (_nightCrown)
			if ( AFTER_2008.has( t0.name ) ) continue;
			const t = CROWNS[ t0.name ]?.shape ? { ...t0, ...CROWNS[ t0.name ].shape } : t0;
			// ---- end L
			if ( t.cityHall ) {

				this._cityHall( t.at );
				continue;

			}

			this._prism( t.fp, STREET - 2, STREET + t.h, glass, roof, t.name || 'tower', false );
			if ( CROWNS[ t.name ] ) this._nightCrown( t ); // ---- L
			else if ( t.spire ) {

				// the Liberty Places' crowns: a stepped pyramid and a spire
				const cx = t.fp.reduce( ( a, p ) => a + p[ 0 ], 0 ) / t.fp.length, cz = t.fp.reduce( ( a, p ) => a + p[ 1 ], 0 ) / t.fp.length;
				const crown = new Mesh( new ConeGeometry( 14, ( t.spire - t.h ) * 0.7, 4 ), glass );
				crown.position.set( cx, STREET + t.h + ( t.spire - t.h ) * 0.35, cz );
				crown.rotation.y = Math.PI / 4;
				this.group.add( crown );
				const spire = new Mesh( new CylinderGeometry( 0.3, 0.9, ( t.spire - t.h ) * 0.5, 8 ), roof );
				spire.position.set( cx, STREET + t.h + ( t.spire - t.h ) * 0.9, cz );
				this.group.add( spire );

			}

		}

		this._beacons(); // ---- L

	}

	// ---- L: the Holiday Inn Philadelphia Stadium at 10th and Packer, over the fence beyond right-center in
	// 2008 (opened 1974 as the Hilton Inn, a Holiday Inn from 1993, demolished in 2019 for the Live!
	// casino, which Complex.js leaves out): an 11-storey slab of cream precast with bands of room
	// windows, and on its roof the green "Holiday Inn" script facing the ballpark (ref/night: andrewwinn
	// 2605278835 from the Alley, June 2008; bub_56 2994754127 over center field on Oct 29). After dark a
	// dark slab with a scatter of rooms lit, a few in a TV's blue. Its exact footprint isn't known: a 60 x 16 m slab
	_holidayInn() {

		const cx = 70, cz = - 472, W = 60, D = 16, H = 35, y0 = STREET;
		const q = new Quads();
		const x0 = cx - W / 2, x1 = cx + W / 2, z0 = cz - D / 2, z1 = cz + D / 2;
		q.add( [ x0, y0, z1 ], [ x1, y0, z1 ], [ x1, y0 + H, z1 ], [ x0, y0 + H, z1 ], [ 0, 0, 1 ], 0, W );
		q.add( [ x1, y0, z0 ], [ x0, y0, z0 ], [ x0, y0 + H, z0 ], [ x1, y0 + H, z0 ], [ 0, 0, - 1 ], 0, W );
		q.add( [ x1, y0, z1 ], [ x1, y0, z0 ], [ x1, y0 + H, z0 ], [ x1, y0 + H, z1 ], [ 1, 0, 0 ], 0, D );
		q.add( [ x0, y0, z0 ], [ x0, y0, z1 ], [ x0, y0 + H, z1 ], [ x0, y0 + H, z0 ], [ - 1, 0, 0 ], 0, D );
		q.add( [ x0, y0 + H, z1 ], [ x1, y0 + H, z1 ], [ x1, y0 + H, z0 ], [ x0, y0 + H, z0 ], [ 0, 1, 0 ], 0, W );
		const mat = standard( {
			name: 'holiday-inn', color: new Color( 0.6, 0.56, 0.48 ), roughness: 0.8, modules: [ commonModule ],
			surface: /* wgsl */`
	let u = in.uv.x;
	let y = in.uv.y - ${ y0.toFixed( 2 ) };
	if ( in.N.y < 0.5 && y > 5.0 && y < ${ ( H - 1.2 ).toFixed( 1 ) } ) {
		// a floor every 3 m over the lobby; a room's window every 3.8 m
		let fl = floor( ( y - 5.0 ) / 3.0 );
		let fy = fract( ( y - 5.0 ) / 3.0 );
		let rm = floor( u / 3.8 );
		let fu = fract( u / 3.8 );
		let fw = fwidth( u ) / 3.8 + fwidth( y ) / 3.0;
		let win = step( 0.22, fy ) * step( fy, 0.72 ) * step( 0.12, fu ) * step( fu, 0.88 );
		let w = mix( win, 0.38, smoothstep( 0.3, 1.0, fw ) );
		s.albedo = mix( s.albedo, vec3f( 0.05, 0.06, 0.07 ), w * 0.85 );
		s.roughness = mix( s.roughness, 0.2, w );
		let h = hash21( vec2f( rm + in.N.x * 37.0 + in.N.z * 91.0, fl ) );
		let lit = step( 0.78, h );
		let tv = step( 0.93, h ) * ( 0.6 + 0.4 * sin( frame.time * 7.0 + h * 40.0 ) * sin( frame.time * 3.1 + h * 17.0 ) );
		let c = select( vec3f( 1.0, 0.72, 0.42 ), vec3f( 0.45, 0.6, 1.0 ) * tv, h > 0.93 );
		s.emissive = c * mix( lit * win, 0.22 * 0.5, smoothstep( 0.3, 1.0, fw ) ) * 1.0 * smoothstep( 0.1, 0.6, frame.night );
	}
`,
		} );
		mat.underwaterLighting = 'none';
		const m = new Mesh( q.geometry(), mat );
		m.name = 'holiday-inn';
		m.castShadow = true;
		m.receiveShadow = true;
		this.group.add( m );
		// the sign on the roof's south edge, turned to the ballpark
		const tex = canvasTexture( 512, 128, ( ctx, w, h ) => {

			ctx.clearRect( 0, 0, w, h );
			ctx.font = 'italic 700 86px Georgia, "Times New Roman", serif';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.shadowColor = '#34e065';
			ctx.shadowBlur = 10;
			ctx.fillStyle = '#2fd25a';
			ctx.fillText( 'Holiday Inn', w / 2, h / 2 + 4 );

		}, 'holidayInnSign' );
		const sign = standard( {
			name: 'holiday-inn-sign', roughness: 0.5, alphaTest: 0.3, side: 'double', textures: { bpInn: tex },
			surface: 'let t = textureSample( bpInn, smpAnisoClamp, in.uv ); s.alpha = t.a; s.albedo = t.rgb * 0.3; s.emissive = t.rgb * mix( 0.3, 3.0, smoothstep( 0.1, 0.6, frame.night ) );',
		} );
		sign.underwaterLighting = 'none';
		const sq = new Quads();
		const sw = 16, sh = 4, sz = z1 - 1.0, sy = y0 + H + 0.6;
		sq.tri( [ cx - sw / 2, sy, sz ], [ cx + sw / 2, sy, sz ], [ cx + sw / 2, sy + sh, sz ], [ 0, 0, 1 ], [ 0, 1 ], [ 1, 1 ], [ 1, 0 ] );
		sq.tri( [ cx - sw / 2, sy, sz ], [ cx + sw / 2, sy + sh, sz ], [ cx - sw / 2, sy + sh, sz ], [ 0, 0, 1 ], [ 0, 1 ], [ 1, 0 ], [ 0, 0 ] );
		const sm = new Mesh( sq.geometry(), sign );
		sm.name = 'holiday-inn-sign';
		this.group.add( sm );

	}
	// ---- end L

	// ---- L: a tower's lit crown (CROWNS), into one mesh with the beacons (one draw): each triangle carries
	// its kind, the crown's axis and a shape number for the shader
	_nightCrown( t ) {

		const C = CROWNS[ t.name ];
		const L = this._lit || ( this._lit = { pos: [], nrm: [], lit: [], shape: [], beacons: [] } );
		let shape = [ 0, 0, 0, 0 ];
		const cx = t.fp.reduce( ( a, p ) => a + p[ 0 ], 0 ) / t.fp.length, cz = t.fp.reduce( ( a, p ) => a + p[ 1 ], 0 ) / t.fp.length;
		const tri = ( A, B, D, n, kind, k ) => {

			L.pos.push( ...A, ...B, ...D );
			for ( let i = 0; i < 3; i ++ ) {

				L.nrm.push( ...n );
				L.lit.push( cx, cz, kind, k );
				L.shape.push( ...shape );

			}

		};
		const quad = ( A, B, D, E, n, kind, k ) => {

			tri( A, B, D, n, kind, k );
			tri( A, D, E, n, kind, k );

		};
		// a square pyramid, half-width w at y0, its apex H above
		const pyramid = ( w, y0, H, kind, k ) => {

			const apex = [ cx, y0 + H, cz ];
			const c = [ [ - w, - w ], [ w, - w ], [ w, w ], [ - w, w ] ];
			for ( let i = 0; i < 4; i ++ ) {

				const [ ax, az ] = c[ i ], [ bx, bz ] = c[ ( i + 1 ) % 4 ];
				const mx = ( ax + bx ) / 2, mz = ( az + bz ) / 2, l = Math.hypot( mx, mz );
				const n = [ mx / l * H, w, mz / l * H ], nl = Math.hypot( ...n );
				tri( [ cx + ax, y0, cz + az ], [ cx + bx, y0, cz + bz ], apex, n.map( ( v ) => v / nl ), kind, k );

			}

		};
		const box4 = ( r, y0, y1, kind, k ) => {

			for ( const [ ax, az, bx, bz, n ] of [ [ - r, - r, r, - r, [ 0, 0, - 1 ] ], [ r, - r, r, r, [ 1, 0, 0 ] ], [ r, r, - r, r, [ 0, 0, 1 ] ], [ - r, r, - r, - r, [ - 1, 0, 0 ] ] ] ) {

				quad( [ cx + ax, y0, cz + az ], [ cx + bx, y0, cz + bz ], [ cx + bx, y1, cz + bz ], [ cx + ax, y1, cz + az ], n, kind, k );

			}

		};
		const top = STREET + t.h;
		if ( C.gables ) {

			// its apex, height, how many lines, its colours
			shape = [ top + C.gables.H, C.gables.H, C.gables.lines, C.gables.scheme ];
			pyramid( C.gables.w, top, C.gables.H, 1, 0 );
			shape = [ 0, 0, 0, 0 ];

		}
		if ( C.pyramid ) {

			pyramid( C.pyramid.w, top, C.pyramid.H, 2, 0 );
			// the white band round its foot
			box4( C.pyramid.w, top - 3, top + 0.2, 2, 1 );

		}

		if ( C.spire ) {

			// a thin mast from inside the crown, lit
			const y0 = top + ( C.gables ? C.gables.H - 3 : 0 ), H = C.spire, r = 0.8;
			for ( const [ ax, az, bx, bz, n ] of [ [ - r, - r, r, - r, [ 0, 0, - 1 ] ], [ r, - r, r, r, [ 1, 0, 0 ] ], [ r, r, - r, r, [ 0, 0, 1 ] ], [ - r, r, - r, - r, [ - 1, 0, 0 ] ] ] ) {

				tri( [ cx + ax, y0, cz + az ], [ cx + bx, y0, cz + bz ], [ cx, y0 + H, cz ], n, 5, 0 );

			}

			L.beacons.push( [ cx, y0 + H + 0.8, cz ] );

		} else if ( C.beacon ) L.beacons.push( [ cx, top + ( C.pyramid ? C.pyramid.H : 0 ) + 1.2, cz ] );
		// a shell 0.4 m out from the tower's walls, from y0 to y1
		const shell = ( y0, y1, kind, k ) => {

			const fp = t.fp, n = fp.length;
			let area = 0;
			for ( let i = 0; i < n; i ++ ) area += fp[ i ][ 0 ] * fp[ ( i + 1 ) % n ][ 1 ] - fp[ ( i + 1 ) % n ][ 0 ] * fp[ i ][ 1 ];
			const sgn = area > 0 ? 1 : - 1;
			for ( let i = 0; i < n; i ++ ) {

				const [ ax, az ] = fp[ i ], [ bx, bz ] = fp[ ( i + 1 ) % n ];
				const len = Math.hypot( bx - ax, bz - az );
				if ( len < 0.05 ) continue;
				const nx = sgn * ( bz - az ) / len, nz = - sgn * ( bx - ax ) / len, o = 0.4;
				quad( [ ax + nx * o, y0, az + nz * o ], [ bx + nx * o, y0, bz + nz * o ], [ bx + nx * o, y1, bz + nz * o ], [ ax + nx * o, y1, az + nz * o ], [ nx, 0, nz ], kind, k );

			}

		};
		if ( C.lantern ) shell( top - C.lantern, top + 0.3, 3, top + 0.3 );
		if ( C.led ) shell( STREET + 6, top, 6, 0 );
		if ( C.sign ) {

			// the PSFS letters on the roof: neon on a frame, lettered both ways
			const [ w, h ] = C.sign, d = 3;
			quad( [ cx - w / 2, top, cz - d ], [ cx + w / 2, top, cz - d ], [ cx + w / 2, top + h, cz - d ], [ cx - w / 2, top + h, cz - d ], [ 0, 0, - 1 ], 4, 0 );
			quad( [ cx + w / 2, top, cz + d ], [ cx - w / 2, top, cz + d ], [ cx - w / 2, top + h, cz + d ], [ cx + w / 2, top + h, cz + d ], [ 0, 0, 1 ], 4, 0 );

		}

	}

	// the obstruction lights on the tall towers' tops, then the crowns' and the lights' one mesh
	_beacons() {

		const L = this._lit;
		if ( ! L ) return;
		// every other tower over 150 m: a red light on its roof
		for ( const t of TOWERS ) {

			if ( AFTER_2008.has( t.name ) || CROWNS[ t.name ] || t.cityHall || t.h < 150 ) continue;
			const cx = t.fp.reduce( ( a, p ) => a + p[ 0 ], 0 ) / t.fp.length, cz = t.fp.reduce( ( a, p ) => a + p[ 1 ], 0 ) / t.fp.length;
			L.beacons.push( [ cx, STREET + t.h + 1.2, cz ] );

		}

		// each a small box of red light (big enough to hold a pixel from the ballpark)
		const b = 1.4;
		for ( const [ x, y, z ] of L.beacons ) {

			for ( const [ n, u, v ] of [ [ [ 1, 0, 0 ], [ 0, 0, 1 ], [ 0, 1, 0 ] ], [ [ - 1, 0, 0 ], [ 0, 0, - 1 ], [ 0, 1, 0 ] ], [ [ 0, 0, 1 ], [ - 1, 0, 0 ], [ 0, 1, 0 ] ],
				[ [ 0, 0, - 1 ], [ 1, 0, 0 ], [ 0, 1, 0 ] ], [ [ 0, 1, 0 ], [ 1, 0, 0 ], [ 0, 0, - 1 ] ] ] ) {

				const c = [ x + n[ 0 ] * b, y + n[ 1 ] * b, z + n[ 2 ] * b ];
				const P = ( su, sv ) => [ c[ 0 ] + ( u[ 0 ] * su + v[ 0 ] * sv ) * b, c[ 1 ] + ( u[ 1 ] * su + v[ 1 ] * sv ) * b, c[ 2 ] + ( u[ 2 ] * su + v[ 2 ] * sv ) * b ];
				for ( const [ A, B, D ] of [ [ P( - 1, - 1 ), P( 1, - 1 ), P( 1, 1 ) ], [ P( - 1, - 1 ), P( 1, 1 ), P( - 1, 1 ) ] ] ) {

					L.pos.push( ...A, ...B, ...D );
					for ( let i = 0; i < 3; i ++ ) {

						L.nrm.push( ...n );
						L.lit.push( x, z, 7, 0 );
						L.shape.push( 0, 0, 0, 0 );

					}

				}

			}

		}

		const g = new BufferGeometry();
		g.setAttribute( 'position', new Float32BufferAttribute( L.pos, 3 ) );
		g.setAttribute( 'normal', new Float32BufferAttribute( L.nrm, 3 ) );
		g.setAttribute( 'uv', new Float32BufferAttribute( new Float32Array( L.pos.length / 3 * 2 ), 2 ) );
		g.setAttribute( 'aLit', new Float32BufferAttribute( L.lit, 4 ) );
		g.setAttribute( 'aShape', new Float32BufferAttribute( L.shape, 4 ) );
		g.computeBoundingBox();
		g.computeBoundingSphere();
		const mat = standard( {
			name: 'skyline-lights', color: new Color( 0.14, 0.16, 0.19 ), roughness: 0.3, metalness: 0.5, side: 'double', modules: [ commonModule ],
			attributes: { aLit: 'vec4f', aShape: 'vec4f' }, varyings: { vLit: 'vec4f', vLocal: 'vec3f', vShape: 'vec4f' },
			vertex: 'o.vLit = v.aLit; o.vLocal = v.position; o.vShape = v.aShape;',
			surface: /* wgsl */`
	let kind = i32( in.vs.vLit.z + 0.5 );
	let k = in.vs.vLit.w;
	let lp = in.vs.vLocal;
	let d = lp.xz - in.vs.vLit.xy;
	let nk = smoothstep( 0.1, 0.6, frame.night );
	let red = vec3f( 1.0, 0.06, 0.05 );
	let n2 = normalize( in.N.xz + vec2f( 1e-5, 0.0 ) );
	let fwy = fwidth( lp.y );
	var e = vec3f( 0.0 );
	if ( kind == 1 ) {
		// the gables outlined in lights: the face's slanted edges and chevrons nested under them (lines
		// parallel to the edges: y + a H / w is the apex's height all along them)
		let sh = in.vs.vShape;
		let slope = length( in.N.xz ) / max( in.N.y, 0.05 );
		let a = abs( dot( d, vec2f( - n2.y, n2.x ) ) );
		let c = sh.x - ( lp.y + a * slope );
		let sp = sh.y / ( sh.z + 0.6 );
		let j = floor( c / sp + 0.5 );
		let f = abs( c - j * sp );
		let lineK = ( 1.0 - smoothstep( 0.25, 0.45 + fwy * 2.0, f ) ) * step( j, sh.z - 0.5 );
		// One Liberty red; Two Liberty red, white and blue, a colour to each stretch of the line
		let seg = fract( floor( ( a + lp.y * 0.3 ) / 3.0 ) / 3.0 );
		let rwb = select( select( vec3f( 0.25, 0.35, 1.0 ), vec3f( 1.0, 0.95, 0.9 ), seg > 0.3 ), red * 1.3, seg > 0.6 );
		e = select( red * 1.5, rwb, sh.w > 0.5 ) * lineK * 9.0;
	} else if ( kind == 2 ) {
		// Mellon's pyramid washed red, its band white
		e = select( red * 2.2, vec3f( 1.0, 0.97, 0.92 ) * 3.0, k > 0.5 );
	} else if ( kind == 3 ) {
		// Comcast Center's glass top lit from inside, white, the mullions dark
		let u = dot( lp.xz, vec2f( - n2.y, n2.x ) );
		let mull = step( 0.85, fract( u / 1.5 ) ) * ( 1.0 - clamp( fwidth( u ) / 1.5, 0.0, 1.0 ) );
		e = vec3f( 0.92, 0.97, 1.0 ) * 3.2 * ( 1.0 - 0.6 * mull );
		// the ring at the very top, red for the Series
		if ( k > 0.0 && lp.y > k - 1.6 ) { e = red * 5.0; }
	} else if ( kind == 4 ) {
		// the PSFS neon: four letters' strokes on the frame
		let u = dot( d, vec2f( - n2.y, n2.x ) ) / 24.0 + 0.5;
		let cell = fract( u * 4.0 );
		let stroke = step( 0.15, cell ) * step( cell, 0.85 ) * ( step( abs( fract( u * 12.0 ) - 0.5 ), 0.18 ) + step( abs( fract( lp.y / 2.3 ) - 0.5 ), 0.12 ) );
		e = red * 6.0 * clamp( stroke, 0.0, 1.0 );
	} else if ( kind == 5 ) {
		e = vec3f( 1.0, 0.95, 0.95 ) * 3.0;
	} else if ( kind == 6 ) {
		// the Cira Centre's LEDs along its floor slabs, red, and the Phillies' P across the face in white
		// (through October 2008: pompomflipflop 2928677842, lentedorafa 2908912928); its glass dark behind
		let row = abs( fract( lp.y / 4.1 ) - 0.5 ) * 4.1;
		let lineK = 1.0 - smoothstep( 0.2, 0.35 + fwy * 2.0, row );
		let uu = dot( d, vec2f( - n2.y, n2.x ) ) / 30.0;
		let vv = ( lp.y - ${ STREET.toFixed( 1 ) } ) / 127.0;
		let bowl = length( ( vec2f( uu, vv ) - vec2f( -0.05, 0.62 ) ) * vec2f( 1.0, 1.6 ) );
		let pk = max( step( abs( uu + 0.2 ), 0.1 ) * step( 0.18, vv ) * step( vv, 0.82 ), step( uu, 0.35 ) * step( -0.2, uu ) * step( 0.2, bowl ) * step( bowl, 0.34 ) );
		e = mix( red * 3.0, vec3f( 0.95, 0.95, 1.0 ) * 3.2, pk ) * mix( lineK, 0.3, smoothstep( 0.3, 1.0, fwy / 4.1 ) );
	} else {
		// an obstruction light
		e = red * 14.0;
		s.albedo = vec3f( 0.3, 0.02, 0.02 );
	}
	s.emissive = e * nk;
`,
		} );
		mat.underwaterLighting = 'none';
		const mesh = new Mesh( g, mat );
		mesh.name = 'skyline-lights';
		this.group.add( mesh );

	}
	// ---- end L

	// City Hall: the stone building round its courtyard and the tower in the middle, 548 ft to the top
	// of William Penn's hat
	_cityHall( [ x, z ] ) {

		// ---- L: floodlit after dark, the tower brighter than the building and William Penn brightest, and
		// the four clock faces lit (FOX's skyline shot on Oct 27, 2008; ref/night)
		const base = this.field.y0 + STREET, cw = this.field.toWorld( x, z );
		const stone = standard( { name: 'city-hall', color: new Color( 0.45, 0.42, 0.36 ), roughness: 0.8, surface: /* wgsl */`
	let yl = in.P.y - ${ base.toFixed( 2 ) };
	let nk = smoothstep( 0.1, 0.6, frame.night );
	let flood = select( select( 0.22, 0.6, yl > 42.5 ), 1.4, yl > 150.0 );
	var e = s.albedo * vec3f( 1.0, 0.86, 0.6 ) * flood;
	let d = in.P.xz - vec2f( ${ cw.x.toFixed( 2 ) }, ${ cw.z.toFixed( 2 ) } );
	let n2 = normalize( in.N.xz + vec2f( 1e-5, 0.0 ) );
	if ( abs( in.N.y ) < 0.3 && abs( dot( d, n2 ) - 11.0 ) < 0.6 && yl > 105.0 && yl < 125.0 ) {
		let a = dot( d, vec2f( - n2.y, n2.x ) );
		let r = length( vec2f( a, yl - 115.5 ) );
		e = mix( e, vec3f( 1.0, 0.72, 0.32 ) * 4.0, 1.0 - smoothstep( 3.6, 4.0, r ) );
	}
	s.emissive = e * nk;
` } );
		// ---- end L
		stone.underwaterLighting = 'none';
		const g = new Group();
		g.position.set( x, STREET, z );
		g.rotation.y = 0; // the building is square to the street grid, as is the field frame (near enough)
		const add = ( geo, y ) => {

			const m = new Mesh( geo, stone );
			m.position.y = y;
			g.add( m );

		};

		for ( const [ ox, oz, w, d ] of [ [ 0, - 66, 148, 16 ], [ 0, 66, 148, 16 ], [ - 66, 0, 16, 148 ], [ 66, 0, 16, 148 ] ] ) {

			const m = new Mesh( new BoxGeometry( w, 42, d ), stone );
			m.position.set( ox, 21, oz );
			g.add( m );

		}

		add( new BoxGeometry( 28, 105, 28 ), 52 );
		add( new BoxGeometry( 22, 20, 22 ), 115 );
		add( new CylinderGeometry( 9, 11, 16, 8 ), 133 );
		add( new SphereGeometry( 9, 12, 8 ), 143 );
		add( new CylinderGeometry( 1.2, 1.6, 11, 8 ), 156 );
		this.group.add( g );

	}

}
