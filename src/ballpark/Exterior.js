import { Group, Mesh, BoxGeometry, CylinderGeometry, ConeGeometry, SphereGeometry, LatheGeometry, Vector2, Vector3, Color } from '../engine/index.js';
import { commonModule } from '../engine/render/wgsl/common.js';
import { standard } from '../materials/Materials.js';
import { Quads } from './Stands.js';
import { flatPolygon, offsetLoop, canvasTexture, segLen, lerp2, beam } from './geo.js';
import { FOOTPRINT, LEVELS } from './layout.js';
import { STATUES } from './data/surroundings.js';

// Outside the ballpark at street level: the brick facade round the footprint with the gates in it, the
// sidewalks, the plaza at the Third Base Gate (Pattison Avenue and Citizens Bank Way) with the Mike
// Schmidt statue and the Liberty Bell that stood on top of Veterans Stadium, and the other statues.
// Built in the field frame (layout.js) in the Field's group; street level is LEVELS.mainConcourse.

const STREET = LEVELS.mainConcourse;
const FACADE = 6.5; // brick base height above the street

// The gates: a point on the footprint's edge where each opens, its width, and its name
export const GATES = [
	{ name: 'THIRD BASE GATE', at: [ - 80.95, 32.03 ], width: 28 },
	{ name: 'FIRST BASE GATE', at: [ 73.5, 25.48 ], width: 26 },
	{ name: 'LEFT FIELD GATE', at: [ - 103.86, - 135.3 ], width: 28 },
	{ name: 'HOME PLATE GATE', at: [ 0, 91.53 ], width: 16 },
];

// the paved plaza in the notch at the south-west corner, in front of the Third Base Gate
const PLAZA_3B = [
	[ - 71.64, 87.87 ], [ - 71.86, 62.51 ], [ - 61.04, 62.24 ], [ - 66.02, 57.38 ], [ - 59.89, 51.24 ], [ - 64.03, 46.95 ],
	[ - 70.79, 53.68 ], [ - 72.07, 52.43 ], [ - 75.17, 49.44 ], [ - 69.22, 43.57 ], [ - 92.68, 20.48 ], [ - 98.62, 26.33 ],
	[ - 103.51, 21.94 ], [ - 97.57, 16.08 ], [ - 102.9, 10.56 ], [ - 108.46, 15.88 ], [ - 113.12, 11.45 ], [ - 125.78, 11.78 ],
	[ - 133, 11.8 ], [ - 133, 98 ], [ - 71.6, 98 ],
];

export class Exterior {

	constructor( { field, colliders } ) {

		this.field = field;
		this.colliders = colliders;
		this.group = new Group();
		this.group.name = 'exterior';
		field.group.add( this.group );

		this._materials();
		this._buildSidewalks();
		this._buildFacade();
		for ( const g of GATES ) this._buildGate( g );
		this._buildPlaza();
		this._buildStatues();

	}

	_materials() {

		this.brick = standard( {
			name: 'facade-brick', color: new Color( 0.24, 0.065, 0.038 ), roughness: 0.85, modules: [ commonModule ],
			surface: /* wgsl */`
	// uv: x along the wall (m), y height above the street (m). Bays of 7.5 m: a brick pier, then an opening
	// with a green steel grille onto the concourse; granite at the foot, a precast band and coping above.
	let u = in.uv.x; let v = in.uv.y - ${ STREET.toFixed( 4 ) };
	let bay = fract( u / 7.5 ) * 7.5;
	let row = floor( v / 0.075 );
	let bu = u / 0.2 + 0.5 * ( row % 2.0 );
	// the courses fade to their average where they get finer than a pixel (no moire)
	let fr = clamp( fwidth( v ) / 0.075 * 1.5 - 0.25, 0.0, 1.0 );
	let fb = clamp( fwidth( bu ) * 1.5 - 0.25, 0.0, 1.0 );
	let mortar = clamp( mix( step( 0.88, fract( v / 0.075 ) ), 0.12, fr ) + mix( step( 0.93, fract( bu ) ), 0.07, max( fb, fr ) ), 0.0, 1.0 );
	let tone = mix( 0.82 + 0.3 * fract( sin( dot( vec2f( floor( bu ), row ), vec2f( 12.9898, 78.233 ) ) ) * 43758.5453 ), 0.97, max( fr, fb ) );
	var c = mix( mat.color * tone, vec3f( 0.42, 0.4, 0.36 ), mortar * 0.8 );
	var rough = 0.85;
	let opening = bay > 1.3 && bay < 7.2 && v > 0.9 && v < 4.7;
	if ( opening ) {
		// the concourse behind, in shade, through vertical bars
		// bars 14 cm apart, blurred to their average where they're finer than a pixel (no moire)
		let fb = fwidth( u ) / 0.14;
		let bars = mix( smoothstep( 0.8 - fb, 0.8 + fb, fract( ( bay - 1.3 ) / 0.14 ) ), 0.2, clamp( fb * 1.5, 0.0, 1.0 ) );
		let bar = bars + step( 4.5, v ) + step( v, 1.1 );
		c = mix( vec3f( 0.025, 0.025, 0.028 ), vec3f( 0.02, 0.09, 0.055 ), clamp( bar, 0.0, 1.0 ) );
		rough = mix( 0.9, 0.5, clamp( bar, 0.0, 1.0 ) );
		// the concourse's lights inside, after dark
		s.emissive = vec3f( 1.0, 0.68, 0.36 ) * ( 1.0 - clamp( bar, 0.0, 1.0 ) ) * smoothstep( 0.1, 0.7, frame.night ) * 0.22 * ( 0.5 + 0.5 * smoothstep( 1.0, 4.0, v ) );
	}
	if ( v < 0.6 ) { c = vec3f( 0.3, 0.29, 0.28 ) * ( 0.9 + 0.1 * mx_noise_float2( vec2f( u, v ) * 3.0 ) ); rough = 0.6; }
	if ( v > 5.0 && v < 5.45 ) { c = vec3f( 0.55, 0.5, 0.42 ); rough = 0.7; }
	if ( v > 6.2 ) { c = vec3f( 0.55, 0.5, 0.42 ); rough = 0.7; }
	s.albedo = c;
	s.roughness = rough;
`,
		} );
		this.brickPlain = standard( {
			name: 'brick', color: new Color( 0.24, 0.065, 0.038 ), roughness: 0.85,
			surface: /* wgsl */`
	// running bond in world space, on whichever vertical face this is
	let N = abs( in.N );
	let u = select( in.P.x, in.P.z, N.x > N.z );
	let row = floor( in.P.y / 0.075 );
	let bu = u / 0.2 + 0.5 * ( row % 2.0 );
	let fr = clamp( fwidth( in.P.y ) / 0.075 * 1.5 - 0.25, 0.0, 1.0 );
	let fb = clamp( fwidth( bu ) * 1.5 - 0.25, 0.0, 1.0 );
	let mortar = clamp( mix( step( 0.88, fract( in.P.y / 0.075 ) ), 0.12, fr ) + mix( step( 0.93, fract( bu ) ), 0.07, max( fb, fr ) ), 0.0, 1.0 );
	let tone = mix( 0.82 + 0.3 * fract( sin( dot( vec2f( floor( bu ), row ), vec2f( 12.9898, 78.233 ) ) ) * 43758.5453 ), 0.97, max( fr, fb ) );
	s.albedo = mix( mat.color * tone, vec3f( 0.42, 0.4, 0.36 ), mortar * 0.8 );
`,
		} );
		// the storeys over the base: brick with punched windows on a 3.75 m rhythm, cast-stone sills, a
		// string course at each floor; offices lit behind them after dark
		this.brickUpper = standard( {
			name: 'facade-upper', color: new Color( 0.24, 0.065, 0.038 ), roughness: 0.85, modules: [ commonModule ],
			surface: /* wgsl */`
	let u = in.uv.x; let v = in.uv.y - ${ ( STREET + FACADE ).toFixed( 4 ) };
	let row = floor( v / 0.075 );
	let bu = u / 0.2 + 0.5 * ( row % 2.0 );
	let fr = clamp( fwidth( v ) / 0.075 * 1.5 - 0.25, 0.0, 1.0 );
	let fb = clamp( fwidth( bu ) * 1.5 - 0.25, 0.0, 1.0 );
	let mortar = clamp( mix( step( 0.88, fract( v / 0.075 ) ), 0.12, fr ) + mix( step( 0.93, fract( bu ) ), 0.07, max( fb, fr ) ), 0.0, 1.0 );
	let tone = mix( 0.82 + 0.3 * fract( sin( dot( vec2f( floor( bu ), row ), vec2f( 12.9898, 78.233 ) ) ) * 43758.5453 ), 0.97, max( fr, fb ) );
	var c = mix( mat.color * tone, vec3f( 0.42, 0.4, 0.36 ), mortar * 0.8 );
	var rough = 0.85;
	let fl = fract( v / 3.6 ) * 3.6;
	let bay = fract( u / 3.75 ) * 3.75;
	let win = fl > 0.95 && fl < 2.95 && bay > 1.0 && bay < 2.75;
	let sill = fl > 0.8 && fl < 0.95 && bay > 0.9 && bay < 2.85;
	if ( fl < 0.25 ) { c = vec3f( 0.55, 0.5, 0.42 ); rough = 0.7; }
	if ( sill ) { c = vec3f( 0.6, 0.55, 0.47 ); rough = 0.7; }
	var e = vec3f( 0.0 );
	if ( win ) {
		// dark glass with mullions, some offices lit
		let mull = step( abs( bay - 1.875 ), 0.03 );
		c = mix( vec3f( 0.03, 0.04, 0.05 ), vec3f( 0.12, 0.05, 0.04 ), mull );
		rough = 0.12;
		let cell = floor( vec2f( u / 3.75, v / 3.6 ) );
		let lit = step( 0.45, fract( sin( dot( cell, vec2f( 12.9898, 78.233 ) ) ) * 43758.5453 ) );
		e = vec3f( 1.0, 0.8, 0.55 ) * lit * ( 1.0 - mull ) * smoothstep( 0.1, 0.7, frame.night ) * 0.5;
	}
	s.albedo = c;
	s.roughness = rough;
	s.emissive = e;
`,
		} );
		this.coping = standard( { name: 'facade-coping-green', color: new Color( 0.03, 0.09, 0.06 ), roughness: 0.45, metalness: 0.5 } );
		this.stone = standard( { name: 'precast', color: new Color( 0.55, 0.5, 0.42 ), roughness: 0.7 } );
		this.copper = standard( { name: 'copper-roof', color: new Color( 0.12, 0.3, 0.24 ), roughness: 0.55, metalness: 0.3 } );
		this.granite = standard( { name: 'granite', color: new Color( 0.22, 0.21, 0.21 ), roughness: 0.45 } );
		this.bronze = standard( { name: 'bronze', color: new Color( 0.18, 0.1, 0.04 ), roughness: 0.35, metalness: 0.9 } );
		this.paving = standard( {
			name: 'sidewalk', color: new Color( 0.4, 0.38, 0.35 ), roughness: 0.8, modules: [ commonModule ],
			surface: /* wgsl */`
	let p = in.uv;
	let g = abs( fract( p / 1.5 ) - 0.5 );
	let joint = 1.0 - ( 1.0 - smoothstep( 0.46, 0.49, max( g.x, g.y ) ) ) * 0.0 - smoothstep( 0.47, 0.495, max( g.x, g.y ) ) * 0.3;
	s.albedo = mat.color * joint * ( 0.88 + 0.14 * mx_noise_float2( p * 0.5 ) ) * ( 0.95 + 0.06 * mx_noise_float2( p * 11.0 ) );
`,
		} );
		this.pavers = standard( {
			name: 'plaza-pavers', color: new Color( 0.3, 0.14, 0.09 ), roughness: 0.8, modules: [ commonModule ],
			surface: /* wgsl */`
	// brick pavers in a herringbone of 0.2 x 0.1 m, bands of granite every 6 m
	let p = in.uv;
	let q = vec2f( p.x + p.y, p.x - p.y ) * 0.7071;
	let cell = floor( q / vec2f( 0.2, 0.1 ) );
	let f = fract( q / vec2f( 0.2, 0.1 ) );
	let mortar = clamp( step( 0.9, f.x ) + step( 0.85, f.y ), 0.0, 1.0 );
	let tone = 0.8 + 0.35 * fract( sin( dot( cell, vec2f( 12.9898, 78.233 ) ) ) * 43758.5453 );
	var c = mix( mat.color * tone, vec3f( 0.3, 0.28, 0.26 ), mortar * 0.7 );
	let band = abs( fract( p / 6.0 ) - 0.5 );
	if ( min( band.x, band.y ) > 0.47 ) { c = vec3f( 0.33, 0.32, 0.31 ); }
	s.albedo = c * ( 0.92 + 0.1 * mx_noise_float2( p * 0.4 ) );
`,
		} );
		for ( const m of [ this.brick, this.brickUpper, this.coping, this.brickPlain, this.stone, this.copper, this.granite, this.bronze, this.paving, this.pavers ] ) m.underwaterLighting = 'none';

	}

	// ---------------------------------------------------------------- ground

	// paving all round the stadium, 8 m out past the outline of the footprint (and over its notches)
	_buildSidewalks() {

		const out = offsetLoop( convexHull( FOOTPRINT ), 8 );
		const m = new Mesh( flatPolygon( out, [ FOOTPRINT ], STREET + 0.01 ), this.paving );
		m.name = 'sidewalks';
		m.receiveShadow = true;
		this.group.add( m );
		this.outline = out;

	}

	_buildPlaza() {

		const m = new Mesh( flatPolygon( PLAZA_3B, [], STREET + 0.02 ), this.pavers );
		m.name = 'third-base-plaza';
		m.receiveShadow = true;
		this.group.add( m );
		// lamp posts round the plaza (their light: lampSources())
		this.lamps = [];
		const post = standard( { name: 'lamp-post', color: new Color( 0.02, 0.06, 0.04 ), roughness: 0.5, metalness: 0.6 } );
		const glow = standard( { name: 'lamp-glass', color: new Color( 0.9, 0.85, 0.7 ), roughness: 0.3,
			surface: 's.emissive = vec3f( 1.0, 0.8, 0.55 ) * smoothstep( 0.1, 0.7, frame.night ) * 25.0;' } );
		for ( const mm of [ post, glow ] ) mm.underwaterLighting = 'none';
		for ( const [ x, z ] of [ [ - 122, 88 ], [ - 104, 88 ], [ - 86, 88 ], [ - 123, 64 ], [ - 123, 40 ], [ - 110, 30 ], [ - 92, 52 ], [ - 76, 76 ], [ - 60, 30 ], [ - 100, 4 ] ] ) {

			const pl = new Mesh( new CylinderGeometry( 0.08, 0.12, 4.6, 8 ), post );
			pl.position.set( x, STREET + 2.3, z );
			pl.castShadow = true;
			this.group.add( pl );
			const head = new Mesh( new CylinderGeometry( 0.22, 0.16, 0.6, 8 ), glow );
			head.position.set( x, STREET + 4.8, z );
			this.group.add( head );
			const cap = new Mesh( new ConeGeometry( 0.32, 0.3, 8 ), post );
			cap.position.set( x, STREET + 5.25, z );
			this.group.add( cap );
			this.lamps.push( [ x, STREET + 4.8, z ] );
			const w = this.field.toWorld( x, z );
			this.colliders.addCylinder( w.x, w.z, 0.15, this.field.y0 + STREET, this.field.y0 + STREET + 4.6 );

		}

		// trees along the plaza's street edges
		const trunk = standard( { name: 'trunk', color: new Color( 0.08, 0.06, 0.05 ), roughness: 0.9 } );
		const leaves = standard( { name: 'leaves', color: new Color( 0.05, 0.12, 0.03 ), roughness: 0.9, modules: [ commonModule ],
			surface: 's.albedo = mat.color * ( 0.7 + 0.5 * mx_noise_float3( in.P * 1.7 ) );' } );
		for ( const mm of [ trunk, leaves ] ) mm.underwaterLighting = 'none';
		const trees = [];
		for ( let x = - 126; x <= - 76; x += 10 ) trees.push( [ x, 95 ] );
		for ( let z = 20; z <= 85; z += 10 ) trees.push( [ - 130, z ] );
		for ( const [ x, z ] of trees ) this._tree( x, z, trunk, leaves );

	}

	_tree( x, z, trunk, leaves ) {

		const t = new Mesh( new CylinderGeometry( 0.15, 0.22, 3.2, 8 ), trunk );
		t.position.set( x, STREET + 1.6, z );
		t.castShadow = true;
		this.group.add( t );
		const k = 0.8 + 0.4 * Math.abs( Math.sin( x * 12.9 + z * 7.3 ) );
		for ( const [ dx, dy, dz, r ] of [ [ 0, 4.3, 0, 1.9 ], [ 0.9, 3.8, 0.4, 1.3 ], [ - 0.8, 4.0, - 0.5, 1.4 ], [ 0.2, 5.1, - 0.3, 1.2 ] ] ) {

			const c = new Mesh( new SphereGeometry( r * k, 10, 8 ), leaves );
			c.position.set( x + dx, STREET + dy * k, z + dz );
			c.castShadow = true;
			c.receiveShadow = true;
			this.group.add( c );

		}

		const w = this.field.toWorld( x, z );
		this.colliders.addCylinder( w.x, w.z, 0.3, this.field.y0 + STREET, this.field.y0 + STREET + 3 );

	}

	// the plaza's lamps as point lights (world frame), for LocalLights
	lampSources() {

		return ( this.lamps || [] ).map( ( [ x, y, z ] ) => {

			const w = this.field.toWorld( x, z );
			return new Vector3( w.x, this.field.y0 + y, w.z );

		} );

	}

	// ---------------------------------------------------------------- facade

	// The brick base all round the footprint, broken by the gates. Its uv: x along the wall, y up.
	_buildFacade() {

		const P = FOOTPRINT;
		const n = P.length;
		// orientation, for the outward side
		let area = 0;
		for ( let i = 0; i < n; i ++ ) area += P[ i ][ 0 ] * P[ ( i + 1 ) % n ][ 1 ] - P[ ( i + 1 ) % n ][ 0 ] * P[ i ][ 1 ];
		const sgn = area > 0 ? 1 : - 1;
		const q = new Quads(), cap = new Quads(), up = new Quads(), trim = new Quads();
		const T = 0.8;
		let u = 0;
		this.gateEdges = [];
		// how tall the brick is: four storeys of offices and shops either side of the Third Base, First
		// Base and Home Plate Gates, three round the rest of the infield, the one-storey base in the outfield
		const heightOf = ( A, B ) => {

			const c = lerp2( A, B, 0.5 );
			if ( [ GATES[ 0 ], GATES[ 1 ], GATES[ 3 ] ].some( ( g ) => segLen( g.at, c ) < 46 ) ) return 16;
			return c[ 1 ] > - 60 ? 11.4 : FACADE;

		};
		for ( let i = 0; i < n; i ++ ) {

			const a = P[ i ], b = P[ ( i + 1 ) % n ];
			const len = segLen( a, b );
			if ( len < 0.05 ) continue;
			const ux = ( b[ 0 ] - a[ 0 ] ) / len, uz = ( b[ 1 ] - a[ 1 ] ) / len;
			const nx = sgn * uz, nz = - sgn * ux; // outward
			// the gates on this edge cut it into pieces
			const cuts = [];
			for ( const g of GATES ) {

				const t = ( ( g.at[ 0 ] - a[ 0 ] ) * ux + ( g.at[ 1 ] - a[ 1 ] ) * uz );
				const off = Math.abs( ( g.at[ 0 ] - a[ 0 ] ) * nx + ( g.at[ 1 ] - a[ 1 ] ) * nz );
				if ( t > 0 && t < len && off < 1.0 ) {

					cuts.push( [ Math.max( 0, t - g.width / 2 ), Math.min( len, t + g.width / 2 ) ] );
					g.edge = { a, ux, uz, nx, nz, t };

				}

			}

			cuts.sort( ( x, y ) => x[ 0 ] - y[ 0 ] );
			const pieces = [];
			let s0 = 0;
			for ( const [ c0, c1 ] of cuts ) {

				if ( c0 > s0 ) pieces.push( [ s0, c0 ] );
				s0 = c1;

			}

			if ( s0 < len ) pieces.push( [ s0, len ] );
			for ( const [ s, e ] of pieces ) {

				const A = [ a[ 0 ] + ux * s, a[ 1 ] + uz * s ], B = [ a[ 0 ] + ux * e, a[ 1 ] + uz * e ];
				const Ai = [ A[ 0 ] - nx * T, A[ 1 ] - nz * T ], Bi = [ B[ 0 ] - nx * T, B[ 1 ] - nz * T ];
				const H = heightOf( A, B );
				const y0 = STREET, yb = STREET + FACADE, y1 = STREET + H;
				// outer face, inner face (uv y = height above the street): the base, then the storeys over it
				q.add( [ A[ 0 ], y0, A[ 1 ] ], [ B[ 0 ], y0, B[ 1 ] ], [ B[ 0 ], yb, B[ 1 ] ], [ A[ 0 ], yb, A[ 1 ] ], [ nx, 0, nz ], u + s, u + e );
				q.add( [ Bi[ 0 ], y0, Bi[ 1 ] ], [ Ai[ 0 ], y0, Ai[ 1 ] ], [ Ai[ 0 ], yb, Ai[ 1 ] ], [ Bi[ 0 ], yb, Bi[ 1 ] ], [ - nx, 0, - nz ], u + e, u + s );
				if ( H > FACADE ) {

					up.add( [ A[ 0 ], yb, A[ 1 ] ], [ B[ 0 ], yb, B[ 1 ] ], [ B[ 0 ], y1, B[ 1 ] ], [ A[ 0 ], y1, A[ 1 ] ], [ nx, 0, nz ], u + s, u + e );
					up.add( [ Bi[ 0 ], yb, Bi[ 1 ] ], [ Ai[ 0 ], yb, Ai[ 1 ] ], [ Ai[ 0 ], y1, Ai[ 1 ] ], [ Bi[ 0 ], y1, Bi[ 1 ] ], [ - nx, 0, - nz ], u + e, u + s );
					// green metal coping along the top
					const o = 0.14;
					trim.add( [ A[ 0 ] + nx * o, y1 - 0.55, A[ 1 ] + nz * o ], [ B[ 0 ] + nx * o, y1 - 0.55, B[ 1 ] + nz * o ], [ B[ 0 ] + nx * o, y1 + 0.35, B[ 1 ] + nz * o ], [ A[ 0 ] + nx * o, y1 + 0.35, A[ 1 ] + nz * o ], [ nx, 0, nz ] );
					trim.add( [ A[ 0 ] + nx * o, y1 + 0.35, A[ 1 ] + nz * o ], [ B[ 0 ] + nx * o, y1 + 0.35, B[ 1 ] + nz * o ], [ Bi[ 0 ] - nx * o, y1 + 0.35, Bi[ 1 ] - nz * o ], [ Ai[ 0 ] - nx * o, y1 + 0.35, Ai[ 1 ] - nz * o ], [ 0, 1, 0 ] );

				}
				// coping on top and the piece's ends
				cap.add( [ A[ 0 ] + nx * 0.15, y1, A[ 1 ] + nz * 0.15 ], [ B[ 0 ] + nx * 0.15, y1, B[ 1 ] + nz * 0.15 ], [ Bi[ 0 ] - nx * 0.15, y1, Bi[ 1 ] - nz * 0.15 ], [ Ai[ 0 ] - nx * 0.15, y1, Ai[ 1 ] - nz * 0.15 ], [ 0, 1, 0 ] );
				for ( const [ P0, P1, d ] of [ [ A, Ai, - 1 ], [ B, Bi, 1 ] ] ) cap.add( [ P0[ 0 ], y0, P0[ 1 ] ], [ P1[ 0 ], y0, P1[ 1 ] ], [ P1[ 0 ], y1, P1[ 1 ] ], [ P0[ 0 ], y1, P0[ 1 ] ], [ ux * d, 0, uz * d ] );
				// collider
				const c = lerp2( A, B, 0.5 );
				const w = this.field.toWorld( c[ 0 ] - nx * T / 2, c[ 1 ] - nz * T / 2 );
				this.colliders.addBox( new Vector3( w.x, this.field.y0 + STREET + H / 2, w.z ), new Vector3( ( e - s ) / 2, H / 2, T / 2 ), this.field.group.rotation.y - Math.atan2( uz, ux ), { tag: 'facade' } );

			}

			u += len;

		}

		for ( const [ geo, mat, name ] of [ [ q, this.brick, 'facade' ], [ up, this.brickUpper, 'facade-upper' ], [ cap, this.stone, 'facade-coping' ], [ trim, this.coping, 'facade-trim' ] ] ) {

			const m = new Mesh( geo.geometry(), mat );
			m.name = name;
			m.castShadow = true;
			m.receiveShadow = true;
			this.group.add( m );

		}

	}

	// A gate as it is at Citizens Bank Park: a long flat maroon steel canopy on columns and knee braces over
	// a row of white bar gates (swung open for the game, with the round signs on the fixed panels), the
	// gate's name in white under the canopy's edge and "Citizens Bank Park" in green letters on top.
	_buildGate( g ) {

		if ( ! g.edge ) return;
		const { a, ux, uz, nx, nz, t } = g.edge;
		const W = g.width, y0 = STREET;
		// field-frame point at distance s along the edge and o out from it
		const P = ( s, o, y ) => [ a[ 0 ] + ux * ( t + s ) + nx * o, y, a[ 1 ] + uz * ( t + s ) + nz * o ];
		const steel = this.gateSteel || ( this.gateSteel = standard( { name: 'gate-steel', color: new Color( 0.13, 0.035, 0.03 ), roughness: 0.55, metalness: 0.4 } ) );
		steel.underwaterLighting = 'none';
		const q = new Quads();
		const half = W / 2 + 1.2, out = 4.6, inn = - 2.6, under = y0 + 4.9, top = y0 + 6.0;
		// the canopy: a deck, its fascia all round, and the steel under it
		q.add( P( - half, inn, top ), P( half, inn, top ), P( half, out, top ), P( - half, out, top ), [ 0, 1, 0 ] );
		q.add( P( - half, inn, under ), P( half, inn, under ), P( half, out, under ), P( - half, out, under ), [ 0, - 1, 0 ] );
		q.add( P( - half, inn, under ), P( half, inn, under ), P( half, inn, top ), P( - half, inn, top ), [ - nx, 0, - nz ] );
		for ( const e of [ - 1, 1 ] ) q.add( P( e * half, inn, under ), P( e * half, out, under ), P( e * half, out, top ), P( e * half, inn, top ), [ ux * e, 0, uz * e ] );
		const nCol = Math.max( 2, Math.round( W / 7.5 ) );
		for ( let k = 0; k <= nCol; k ++ ) {

			const s = - W / 2 + W * k / nCol;
			// columns out front and at the facade line, knee braces up to the canopy
			beam( q, P( s, out - 0.8, y0 ), P( s, out - 0.8, under ), 0.4 );
			beam( q, P( s, out - 0.8, under - 1.4 ), P( s, out - 2.4, under ), 0.18 );
			beam( q, P( s, out - 0.8, under - 1.4 ), P( s, out + 0.4, under ), 0.18 );
			beam( q, P( s, inn + 0.3, under - 0.2 ), P( s, out, under - 0.2 ), 0.3 );
			const w = this.field.toWorld( ...[ P( s, out - 0.8, 0 )[ 0 ], P( s, out - 0.8, 0 )[ 2 ] ] );
			this.colliders.addCylinder( w.x, w.z, 0.3, this.field.y0 + y0, this.field.y0 + under );

		}

		beam( q, P( - half, out - 0.8, under - 0.2 ), P( half, out - 0.8, under - 0.2 ), 0.35 );
		const m = new Mesh( q.geometry(), steel );
		m.name = 'gate-canopy';
		m.castShadow = true;
		m.receiveShadow = true;
		this.group.add( m );

		// the front fascia: maroon with the gate's name in the middle, lit after dark
		const tex = canvasTexture( 4096, 128, ( ctx, w, h ) => {

			ctx.fillStyle = '#3a0f0c';
			ctx.fillRect( 0, 0, w, h );
			ctx.fillStyle = 'rgba( 255, 255, 255, 0.06 )';
			ctx.fillRect( 0, 0, w, 10 ); ctx.fillRect( 0, h - 10, w, 10 );
			ctx.fillStyle = '#f4f1ea';
			ctx.font = '800 76px "Helvetica Neue", Helvetica, Arial, sans-serif';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText( g.name.split( '' ).join( String.fromCharCode( 8202 ) ), w / 2, h / 2 + 4 );

		}, 'gateSign' );
		const signMat = standard( { name: 'gate-sign', roughness: 0.5, textures: { bpSign: tex }, surface: 'let t = textureSample( bpSign, smpAnisoClamp, in.uv ).rgb; s.albedo = t * 0.75; s.emissive = t * step( 0.6, t.r ) * smoothstep( 0.1, 0.7, frame.night ) * 1.2;' } );
		signMat.underwaterLighting = 'none';
		// seen from outside (facing -n), left to right runs along -u if u x n points down
		const flip = ( ux * nz - uz * nx ) < 0;
		const [ sL, sR ] = flip ? [ half, - half ] : [ - half, half ];
		const fq = new Quads();
		fq.tri( P( sL, out + 0.02, under ), P( sR, out + 0.02, under ), P( sR, out + 0.02, top ), [ nx, 0, nz ], [ 0, 1 ], [ 1, 1 ], [ 1, 0 ] );
		fq.tri( P( sL, out + 0.02, under ), P( sR, out + 0.02, top ), P( sL, out + 0.02, top ), [ nx, 0, nz ], [ 0, 1 ], [ 1, 0 ], [ 0, 0 ] );
		const sign = new Mesh( fq.geometry(), signMat );
		sign.name = 'gate-sign';
		this.group.add( sign );

		// "Citizens Bank Park" standing on the canopy
		const lw = Math.min( 16, W * 0.55 ), lh = lw / 10;
		this._wordmark( ( s, o, y ) => P( s, o, y ), flip, lw, top + 0.15, out - 1.0, [ nx, nz ] );

		// the gates: bar panels across the opening, alternately fixed (with the round sign) and open
		const fence = this.fenceMat || ( this.fenceMat = standard( {
			name: 'gate-bars', color: new Color( 0.78, 0.8, 0.8 ), roughness: 0.4, metalness: 0.6, alphaTest: 0.5, side: 'double',
			surface: /* wgsl */`
	// uv: x along the fence (m), y height (m): bars every 12 cm, rails at the foot, the middle and the top
	let fb = fwidth( in.uv.x ) / 0.12;
	let bar = smoothstep( 0.4 - fb, 0.42, abs( fract( in.uv.x / 0.12 ) - 0.5 ) );
	let rail = step( abs( in.uv.y - 0.12 ), 0.06 ) + step( abs( in.uv.y - 1.6 ), 0.05 ) + step( in.uv.y, 3.3 ) * step( 3.18, in.uv.y );
	s.alpha = max( max( bar, clamp( fb * 0.6, 0.0, 0.6 ) ), clamp( rail, 0.0, 1.0 ) );
` } ) );
		fence.underwaterLighting = 'none';
		const bq = new Quads(), dq = new Quads();
		const H = 3.3, panel = 2.2, door = 2.8;
		const n = Math.max( 1, Math.floor( ( W - panel ) / ( panel + door ) ) );
		const used = n * ( panel + door ) + panel, s0 = - used / 2;
		const bars = ( A, B ) => {

			const l = Math.hypot( B[ 0 ] - A[ 0 ], B[ 2 ] - A[ 2 ] );
			bq.tri( A, B, [ B[ 0 ], y0 + H, B[ 2 ] ], [ nx, 0, nz ], [ 0, 0 ], [ l, 0 ], [ l, H ] );
			bq.tri( A, [ B[ 0 ], y0 + H, B[ 2 ] ], [ A[ 0 ], y0 + H, A[ 2 ] ], [ nx, 0, nz ], [ 0, 0 ], [ l, H ], [ 0, H ] );

		};

		const fixed = ( s1, s2 ) => {

			bars( P( s1, 0, y0 ), P( s2, 0, y0 ) );
			const c = P( ( s1 + s2 ) / 2, 0, 0 ), w = this.field.toWorld( c[ 0 ], c[ 2 ] );
			this.colliders.addBox( new Vector3( w.x, this.field.y0 + y0 + H / 2, w.z ), new Vector3( ( s2 - s1 ) / 2, H / 2, 0.1 ), this.field.group.rotation.y - Math.atan2( uz, ux ), { tag: 'gate' } );
			// the round sign on the panel, both faces
			for ( const side of [ 1, - 1 ] ) {

				const cx = ( s1 + s2 ) / 2, o = side * 0.04, r = 0.32, yc = y0 + 2.2;
				for ( let k = 0; k < 16; k ++ ) {

					const a0 = k / 16 * Math.PI * 2, a1 = ( k + 1 ) / 16 * Math.PI * 2;
					dq.tri( P( cx, o, yc ), P( cx + Math.cos( a0 ) * r, o, yc + Math.sin( a0 ) * r ), P( cx + Math.cos( a1 ) * r, o, yc + Math.sin( a1 ) * r ), [ nx * side, 0, nz * side ] );

				}

			}

		};

		// the wall's ends out to the fence, then panel, open door (its leaf swung in), panel ...
		fixed( - W / 2, s0 );
		fixed( s0 + used, W / 2 );
		for ( let k = 0; k <= n; k ++ ) {

			const p0 = s0 + k * ( panel + door );
			fixed( p0, p0 + panel );
			if ( k < n ) bars( P( p0 + panel, 0, y0 ), P( p0 + panel, - door * 0.95, y0 ) );

		}

		if ( /THIRD|FIRST/.test( g.name ) ) for ( const side of [ - 1, 1 ] ) this._stairTower( P, side * ( W / 2 + 5.5 ), - 7.5, [ nx, nz ] );
		const bm = new Mesh( bq.geometry(), fence );
		bm.name = 'gate-bars';
		bm.castShadow = true;
		this.group.add( bm );
		const disc = this.discMat || ( this.discMat = standard( { name: 'gate-disc', color: new Color( 0.85, 0.85, 0.82 ), roughness: 0.5 } ) );
		disc.underwaterLighting = 'none';
		this.group.add( new Mesh( dq.geometry(), disc ) );

	}

	// An open stair tower on the maroon frame inside the gate: landings at each level up to the terrace
	// with grey mesh fronts, flights between them, a roof. P( s, o, y ) is the gate's frame, n its outward.
	_stairTower( P, s, o, n ) {

		const W = 8.5, D = 6.5, top = LEVELS.terraceConcourse + 3.2;
		const q = new Quads(), slab = new Quads(), mesh = new Quads();
		const hw = W / 2, hd = D / 2;
		for ( const [ a, b ] of [ [ - hw, - hd ], [ hw, - hd ], [ - hw, hd ], [ hw, hd ] ] ) beam( q, P( s + a, o + b, STREET ), P( s + a, o + b, top ), 0.45 );
		const L = LEVELS, lv = [ L.suites, ( L.suites + L.clubConcourse ) / 2, L.clubConcourse, ( L.clubConcourse + L.terraceConcourse ) / 2, L.terraceConcourse ];
		let prev = STREET;
		lv.forEach( ( y, i ) => {

			// the landing (alternating ends), its steel edge and its mesh front facing out
			const e = i % 2 ? - 1 : 1;
			const a0 = e > 0 ? 0 : - hw, a1 = e > 0 ? hw : 0;
			slab.add( P( s + a0, o - hd, y ), P( s + a1, o - hd, y ), P( s + a1, o + hd, y ), P( s + a0, o + hd, y ), [ 0, 1, 0 ] );
			slab.add( P( s + a0, o - hd, y - 0.35 ), P( s + a1, o - hd, y - 0.35 ), P( s + a1, o + hd, y - 0.35 ), P( s + a0, o + hd, y - 0.35 ), [ 0, - 1, 0 ] );
			beam( q, P( s - hw, o + hd, y - 0.2 ), P( s + hw, o + hd, y - 0.2 ), 0.3 );
			beam( q, P( s - hw, o - hd, y - 0.2 ), P( s + hw, o - hd, y - 0.2 ), 0.3 );
			mesh.add( P( s + a0, o + hd + 0.2, y ), P( s + a1, o + hd + 0.2, y ), P( s + a1, o + hd + 0.2, y + 1.15 ), P( s + a0, o + hd + 0.2, y + 1.15 ), [ n[ 0 ], 0, n[ 1 ] ] );
			// the flight up to it from the last landing, across the tower
			const fy0 = prev, f0 = e > 0 ? - hw + 0.5 : hw - 0.5, f1 = e > 0 ? hw - 0.5 : - hw + 0.5;
			slab.add( P( s + f0, o - 0.2, fy0 ), P( s + f1, o - 0.2, y ), P( s + f1, o + 1.4, y ), P( s + f0, o + 1.4, fy0 ), [ 0, 1, 0 ] );
			prev = y;

		} );
		// the roof
		slab.add( P( s - hw - 0.6, o - hd - 0.6, top ), P( s + hw + 0.6, o - hd - 0.6, top ), P( s + hw + 0.6, o + hd + 0.6, top ), P( s - hw - 0.6, o + hd + 0.6, top ), [ 0, 1, 0 ] );
		slab.add( P( s - hw - 0.6, o - hd - 0.6, top - 0.4 ), P( s + hw + 0.6, o - hd - 0.6, top - 0.4 ), P( s + hw + 0.6, o + hd + 0.6, top - 0.4 ), P( s - hw - 0.6, o + hd + 0.6, top - 0.4 ), [ 0, - 1, 0 ] );
		const meshMat = this.meshMat || ( this.meshMat = standard( { name: 'stair-mesh', color: new Color( 0.42, 0.43, 0.44 ), roughness: 0.5, metalness: 0.6, side: 'double', modules: [ commonModule ],
			surface: 's.albedo = mat.color * ( 0.75 + 0.25 * step( 0.5, fract( ( in.P.x + in.P.z ) * 12.0 ) ) );' } ) );
		meshMat.underwaterLighting = 'none';
		for ( const [ geo, mat, name ] of [ [ q, this.gateSteel, 'stair-tower' ], [ slab, this.stone, 'stair-landings' ], [ mesh, meshMat, 'stair-mesh' ] ] ) {

			const m = new Mesh( geo.geometry(), mat );
			m.name = name;
			m.castShadow = true;
			m.receiveShadow = true;
			this.group.add( m );

		}

		// its foot is solid
		const c = P( s, o, 0 ), w = this.field.toWorld( c[ 0 ], c[ 2 ] ), u = P( s + 1, o, 0 );
		this.colliders.addBox( new Vector3( w.x, this.field.y0 + STREET + 2, w.z ), new Vector3( W / 2, 2, D / 2 ), this.field.group.rotation.y - Math.atan2( u[ 2 ] - c[ 2 ], u[ 0 ] - c[ 0 ] ), { tag: 'stairs' } );

	}

	// "Citizens Bank Park" in green letters with the bank's emblem, standing on a steel frame: centred at
	// s = 0 of the frame P( s, o, y ), `w` wide, its foot at y, set o out, facing n. Neon green after dark.
	_wordmark( P, flip, w, y, o, n ) {

		if ( ! this.wordTex ) {

			this.wordTex = canvasTexture( 2048, 224, ( ctx, W, H ) => {

				ctx.clearRect( 0, 0, W, H );
				// the emblem: a green disc with a white star of eight points
				const ex = 110, ey = H / 2, r = 86;
				ctx.fillStyle = '#1f8a4c';
				ctx.beginPath(); ctx.arc( ex, ey, r, 0, Math.PI * 2 ); ctx.fill();
				ctx.fillStyle = '#ffffff';
				ctx.beginPath();
				for ( let i = 0; i < 16; i ++ ) {

					const a = i * Math.PI / 8, rr = i % 2 ? r * 0.32 : r * 0.78;
					ctx.lineTo( ex + Math.cos( a ) * rr, ey + Math.sin( a ) * rr );

				}

				ctx.closePath(); ctx.fill();
				ctx.fillStyle = '#1f8a4c';
				ctx.beginPath(); ctx.arc( ex, ey, r * 0.2, 0, Math.PI * 2 ); ctx.fill();
				ctx.font = '800 180px "Helvetica Neue", Helvetica, Arial, sans-serif';
				ctx.textBaseline = 'middle';
				ctx.lineWidth = 12;
				ctx.strokeStyle = '#0f6b37';
				ctx.strokeText( 'Citizens Bank Park', 230, H / 2 + 8, W - 250 );
				ctx.fillStyle = '#1a9a50';
				ctx.fillText( 'Citizens Bank Park', 230, H / 2 + 8, W - 250 );

			}, 'wordmark' );
			this.wordMat = standard( { name: 'wordmark', roughness: 0.4, alphaTest: 0.5, side: 'double', textures: { bpWord: this.wordTex },
				surface: 'let t = textureSample( bpWord, smpAnisoClamp, in.uv ); s.albedo = t.rgb * 0.8; s.alpha = t.a; s.emissive = t.rgb * vec3f( 0.3, 1.0, 0.5 ) * smoothstep( 0.1, 0.7, frame.night ) * 2.2;' } );
			this.wordMat.underwaterLighting = 'none';

		}

		const h = w * 224 / 2048;
		const [ sL, sR ] = flip ? [ w / 2, - w / 2 ] : [ - w / 2, w / 2 ];
		const q = new Quads();
		q.tri( P( sL, o, y ), P( sR, o, y ), P( sR, o, y + h ), [ n[ 0 ], 0, n[ 1 ] ], [ 0, 1 ], [ 1, 1 ], [ 1, 0 ] );
		q.tri( P( sL, o, y ), P( sR, o, y + h ), P( sL, o, y + h ), [ n[ 0 ], 0, n[ 1 ] ], [ 0, 1 ], [ 1, 0 ], [ 0, 0 ] );
		const m = new Mesh( q.geometry(), this.wordMat );
		m.name = 'wordmark';
		this.group.add( m );
		// the frame behind the letters
		const f = new Quads();
		for ( let k = 0; k <= 6; k ++ ) beam( f, P( - w / 2 + w * k / 6, o - 0.25, y - 0.2 ), P( - w / 2 + w * k / 6, o - 0.25, y + h ), 0.12 );
		beam( f, P( - w / 2, o - 0.25, y + h * 0.3 ), P( w / 2, o - 0.25, y + h * 0.3 ), 0.12 );
		beam( f, P( - w / 2, o - 0.25, y + h * 0.75 ), P( w / 2, o - 0.25, y + h * 0.75 ), 0.12 );
		const fm = new Mesh( f.geometry(), this.gateSteel );
		fm.castShadow = true;
		this.group.add( fm );

	}

	// The big sign between the twin light towers over the Third Base Gate: "Citizens Bank Park" on the
	// roof's edge, facing the plaza.
	buildGateSign( bowl ) {

		const t = ( bowl.gateTowers || [] ).find( ( g ) => g.gate === 'THIRD BASE GATE' );
		if ( ! t ) return;
		const [ A, B ] = t.pair;
		const len = segLen( A, B ), ux = ( B[ 0 ] - A[ 0 ] ) / len, uz = ( B[ 1 ] - A[ 1 ] ) / len;
		const c = lerp2( A, B, 0.5 );
		// facing out, away from the field
		let nx = - uz, nz = ux;
		if ( nx * c[ 0 ] + nz * ( c[ 1 ] + 40 ) < 0 ) {

			nx = - nx; nz = - nz;

		}

		const P = ( s, o, y ) => [ c[ 0 ] + ux * s + nx * o, y, c[ 1 ] + uz * s + nz * o ];
		const flip = ( ux * nz - uz * nx ) < 0;
		this._wordmark( P, flip, len - 5, t.y + 1.0, 0.4, [ nx, nz ] );

	}

	// ---------------------------------------------------------------- statues

	_buildStatues() {

		const at = ( name ) => ( STATUES[ name ] || [] )[ 0 ];
		// the Mike Schmidt statue at the Third Base Gate, Robin Roberts at First Base, Steve Carlton at Left Field
		const list = [ [ 'Mike Schmidt', 'batter' ], [ 'Robin Roberts', 'pitcher' ], [ 'Steve Carlton', 'pitcher' ], [ 'Connie Mack', 'standing' ] ];
		for ( const [ name, pose ] of list ) {

			const p = at( name );
			if ( p ) this._statue( p[ 0 ], p[ 1 ], pose );

		}

		// the 19 ft Liberty Bell that stood on top of Veterans Stadium, in the plaza by the gate
		this._bell( - 116, 40 );

	}

	// a bronze figure on a granite pedestal, facing the gate / the street corner
	_statue( x, z, pose ) {

		const g = new Group();
		g.position.set( x, STREET, z );
		const ped = new Mesh( new BoxGeometry( 2.2, 1.8, 2.2 ), this.granite );
		ped.position.y = 0.9;
		ped.castShadow = true;
		ped.receiveShadow = true;
		g.add( ped );
		const fig = figure( this.bronze, pose );
		fig.position.y = 1.8;
		fig.scale.setScalar( 1.6 ); // 10 ft
		g.add( fig );
		// face the stadium's middle
		g.rotation.y = Math.atan2( - ( 4 - x ), - ( - 31 - z ) ) + Math.PI;
		this.group.add( g );
		const w = this.field.toWorld( x, z );
		this.colliders.addBox( new Vector3( w.x, this.field.y0 + STREET + 0.9, w.z ), new Vector3( 1.1, 0.9, 1.1 ), this.field.group.rotation.y + g.rotation.y, { tag: 'statue', walkable: true } );

	}

	_bell( x, z ) {

		// the bell's profile (radius, height), 19 ft tall
		const prof = [ [ 0.0, 5.8 ], [ 0.9, 5.75 ], [ 1.25, 5.5 ], [ 1.35, 5.0 ], [ 1.45, 4.0 ], [ 1.6, 3.0 ], [ 1.85, 2.0 ], [ 2.2, 1.1 ], [ 2.6, 0.45 ], [ 2.75, 0.15 ], [ 2.65, 0.0 ], [ 2.45, 0.1 ] ];
		const geo = new LatheGeometry( prof.map( ( [ r, y ] ) => new Vector2( r, y ) ), 48 );
		const bell = new Mesh( geo, this.bronze );
		bell.position.set( x, STREET + 1.5, z );
		bell.castShadow = true;
		bell.receiveShadow = true;
		bell.material.side = 'double';
		this.group.add( bell );
		const yoke = new Mesh( new BoxGeometry( 3.6, 0.5, 0.6 ), this.bronze );
		yoke.position.set( x, STREET + 7.5, z );
		this.group.add( yoke );
		const base = new Mesh( new CylinderGeometry( 3.2, 3.5, 1.5, 32 ), this.granite );
		base.position.set( x, STREET + 0.75, z );
		base.receiveShadow = true;
		this.group.add( base );
		const w = this.field.toWorld( x, z );
		this.colliders.addCylinder( w.x, w.z, 3.4, this.field.y0 + STREET, this.field.y0 + STREET + 7.5 );

	}

}

// A stylised human figure (about 1.9 m) for the statues: 'batter' (bat on the shoulder), 'pitcher'
// (arm up in the windup), 'standing'.
export function figure( mat, pose = 'standing' ) {

	const g = new Group();
	const part = ( geo, x, y, z, rx = 0, ry = 0, rz = 0 ) => {

		const m = new Mesh( geo, mat );
		m.position.set( x, y, z );
		m.rotation.set( rx, ry, rz );
		m.castShadow = true;
		m.receiveShadow = true;
		g.add( m );
		return m;

	};

	const limb = ( r, l ) => new CylinderGeometry( r, r * 0.85, l + r, 10 );
	// legs, a little apart
	const stance = pose === 'batter' ? 0.2 : 0.12;
	part( limb( 0.09, 0.75 ), - stance, 0.5, 0, 0, 0, pose === 'batter' ? 0.08 : 0 );
	part( limb( 0.09, 0.75 ), stance, 0.5, pose === 'pitcher' ? - 0.25 : 0, pose === 'pitcher' ? 0.5 : 0, 0, pose === 'batter' ? - 0.08 : 0 );
	// torso, head, cap
	part( limb( 0.19, 0.45 ), 0, 1.22, 0 );
	part( new SphereGeometry( 0.12, 14, 10 ), 0, 1.68, 0 );
	part( new CylinderGeometry( 0.13, 0.13, 0.06, 14 ), 0, 1.76, 0 );
	part( new BoxGeometry( 0.2, 0.02, 0.12 ), 0, 1.74, - 0.12 );
	if ( pose === 'batter' ) {

		// both hands up by the right shoulder, the bat angled back over it
		part( limb( 0.06, 0.45 ), - 0.24, 1.35, - 0.08, 0.3, 0, 0.9 );
		part( limb( 0.06, 0.45 ), 0.22, 1.4, - 0.1, 0.3, 0, - 1.1 );
		part( new CylinderGeometry( 0.025, 0.045, 0.86, 10 ), 0.2, 1.75, 0.18, - 0.5, 0, - 0.25 );

	} else if ( pose === 'pitcher' ) {

		// glove arm forward, throwing arm raised behind
		part( limb( 0.06, 0.45 ), - 0.28, 1.35, - 0.2, - 0.9, 0, 0.2 );
		part( limb( 0.06, 0.45 ), 0.28, 1.7, 0.15, 0.6, 0, - 0.5 );
		part( new SphereGeometry( 0.1, 10, 8 ), - 0.36, 1.42, - 0.45 );

	} else {

		part( limb( 0.06, 0.5 ), - 0.27, 1.1, 0, 0, 0, 0.1 );
		part( limb( 0.06, 0.5 ), 0.27, 1.1, 0, 0, 0, - 0.1 );

	}

	return g;

}

// convex hull of [ x, z ] points (monotone chain), counter-clockwise
function convexHull( P ) {

	const pts = P.slice().sort( ( a, b ) => a[ 0 ] - b[ 0 ] || a[ 1 ] - b[ 1 ] );
	const cross = ( o, a, b ) => ( a[ 0 ] - o[ 0 ] ) * ( b[ 1 ] - o[ 1 ] ) - ( a[ 1 ] - o[ 1 ] ) * ( b[ 0 ] - o[ 0 ] );
	const lower = [], upper = [];
	for ( const p of pts ) {

		while ( lower.length >= 2 && cross( lower[ lower.length - 2 ], lower[ lower.length - 1 ], p ) <= 0 ) lower.pop();
		lower.push( p );

	}

	for ( const p of pts.slice().reverse() ) {

		while ( upper.length >= 2 && cross( upper[ upper.length - 2 ], upper[ upper.length - 1 ], p ) <= 0 ) upper.pop();
		upper.push( p );

	}

	return lower.slice( 0, - 1 ).concat( upper.slice( 0, - 1 ) );

}
