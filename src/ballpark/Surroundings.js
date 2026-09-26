import { Group, Mesh, BoxGeometry, CylinderGeometry, ConeGeometry, SphereGeometry, Float32BufferAttribute, Color } from '../engine/index.js';
import { commonModule } from '../engine/render/wgsl/common.js';
import { standard } from '../materials/Materials.js';
import { Quads } from './Stands.js';
import { flatPolygon } from './geo.js';
import { LEVELS } from './layout.js';
import { TOWERS, NEIGHBOURS, ROADS } from './data/surroundings.js';

// South Philadelphia round the ballpark and Center City on the horizon: the streets (from OpenStreetMap),
// the other venues of the sports complex as plain masses, and Center City's towers on their real
// footprints, 5 km north, with City Hall's tower among them. Field frame, street level = LEVELS.mainConcourse.

const STREET = LEVELS.mainConcourse;

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
	let lit = step( 0.72, fract( sin( dot( vec2f( colI, floorI ), vec2f( 39.3468, 11.135 ) ) + seed * 91.7 ) * 43758.5453 ) );
	s.emissive = vec3f( 1.0, 0.78, 0.5 ) * lit * ( 1.0 - spandrel ) * ( 1.0 - mullion ) * frame.night * 2.5;
`,
		} );
		const roof = standard( { name: 'tower-roofs', color: new Color( 0.2, 0.2, 0.21 ), roughness: 0.7 } );
		for ( const m of [ glass, roof ] ) m.underwaterLighting = 'none';
		for ( const t of TOWERS ) {

			if ( t.cityHall ) {

				this._cityHall( t.at );
				continue;

			}

			this._prism( t.fp, STREET - 2, STREET + t.h, glass, roof, t.name || 'tower', false );
			if ( t.spire ) {

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

	}

	// City Hall: the stone building round its courtyard and the tower in the middle, 548 ft to the top
	// of William Penn's hat
	_cityHall( [ x, z ] ) {

		const stone = standard( { name: 'city-hall', color: new Color( 0.45, 0.42, 0.36 ), roughness: 0.8 } );
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
