import { Group, Mesh, BoxGeometry, CylinderGeometry, ConeGeometry, SphereGeometry, LatheGeometry, Vector2, Vector3, Color } from '../engine/index.js';
import { commonModule } from '../engine/render/wgsl/common.js';
import { standard } from '../materials/Materials.js';
import { Quads } from './Stands.js';
import { flatPolygon, offsetLoop, canvasTexture, segLen, lerp2 } from './geo.js';
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
	{ name: 'THIRD BASE GATE', at: [ - 80.95, 32.03 ], width: 12 },
	{ name: 'FIRST BASE GATE', at: [ 73.5, 25.48 ], width: 12 },
	{ name: 'LEFT FIELD GATE', at: [ - 103.86, - 135.3 ], width: 12 },
	{ name: 'HOME PLATE GATE', at: [ 0, 91.53 ], width: 8 },
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
	let mortar = clamp( step( 0.88, fract( v / 0.075 ) ) + step( 0.93, fract( bu ) ), 0.0, 1.0 );
	let tone = 0.82 + 0.3 * fract( sin( dot( vec2f( floor( bu ), row ), vec2f( 12.9898, 78.233 ) ) ) * 43758.5453 );
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
	let mortar = clamp( step( 0.88, fract( in.P.y / 0.075 ) ) + step( 0.93, fract( bu ) ), 0.0, 1.0 );
	let tone = 0.82 + 0.3 * fract( sin( dot( vec2f( floor( bu ), row ), vec2f( 12.9898, 78.233 ) ) ) * 43758.5453 );
	s.albedo = mix( mat.color * tone, vec3f( 0.42, 0.4, 0.36 ), mortar * 0.8 );
`,
		} );
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
		for ( const m of [ this.brick, this.brickPlain, this.stone, this.copper, this.granite, this.bronze, this.paving, this.pavers ] ) m.underwaterLighting = 'none';

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
		const q = new Quads(), cap = new Quads();
		const T = 0.8;
		let u = 0;
		this.gateEdges = [];
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
				const y0 = STREET, y1 = STREET + FACADE;
				// outer face, inner face (uv y = height above the street)
				q.add( [ A[ 0 ], y0, A[ 1 ] ], [ B[ 0 ], y0, B[ 1 ] ], [ B[ 0 ], y1, B[ 1 ] ], [ A[ 0 ], y1, A[ 1 ] ], [ nx, 0, nz ], u + s, u + e );
				q.add( [ Bi[ 0 ], y0, Bi[ 1 ] ], [ Ai[ 0 ], y0, Ai[ 1 ] ], [ Ai[ 0 ], y1, Ai[ 1 ] ], [ Bi[ 0 ], y1, Bi[ 1 ] ], [ - nx, 0, - nz ], u + e, u + s );
				// coping on top and the piece's ends
				cap.add( [ A[ 0 ] + nx * 0.15, y1, A[ 1 ] + nz * 0.15 ], [ B[ 0 ] + nx * 0.15, y1, B[ 1 ] + nz * 0.15 ], [ Bi[ 0 ] - nx * 0.15, y1, Bi[ 1 ] - nz * 0.15 ], [ Ai[ 0 ] - nx * 0.15, y1, Ai[ 1 ] - nz * 0.15 ], [ 0, 1, 0 ] );
				for ( const [ P0, P1, d ] of [ [ A, Ai, - 1 ], [ B, Bi, 1 ] ] ) cap.add( [ P0[ 0 ], y0, P0[ 1 ] ], [ P1[ 0 ], y0, P1[ 1 ] ], [ P1[ 0 ], y1, P1[ 1 ] ], [ P0[ 0 ], y1, P0[ 1 ] ], [ ux * d, 0, uz * d ] );
				// collider
				const c = lerp2( A, B, 0.5 );
				const w = this.field.toWorld( c[ 0 ] - nx * T / 2, c[ 1 ] - nz * T / 2 );
				this.colliders.addBox( new Vector3( w.x, this.field.y0 + STREET + FACADE / 2, w.z ), new Vector3( ( e - s ) / 2, FACADE / 2, T / 2 ), this.field.group.rotation.y - Math.atan2( uz, ux ), { tag: 'facade' } );

			}

			u += len;

		}

		for ( const [ geo, mat, name ] of [ [ q, this.brick, 'facade' ], [ cap, this.stone, 'facade-coping' ] ] ) {

			const m = new Mesh( geo.geometry(), mat );
			m.name = name;
			m.castShadow = true;
			m.receiveShadow = true;
			this.group.add( m );

		}

	}

	// A gate: brick towers either side of the opening with green copper roofs, a lintel with its name
	_buildGate( g ) {

		if ( ! g.edge ) return;
		const { a, ux, uz, nx, nz, t } = g.edge;
		const yaw = - Math.atan2( uz, ux );
		const H = 12.5, S = 3.6, W = g.width;
		for ( const side of [ - 1, 1 ] ) {

			const s = t + side * ( W / 2 + S / 2 );
			const x = a[ 0 ] + ux * s - nx * 0.4, z = a[ 1 ] + uz * s - nz * 0.4;
			const tower = new Mesh( new BoxGeometry( S, H, S ), this.brickPlain );
			tower.position.set( x, STREET + H / 2, z );
			tower.rotation.y = yaw;
			tower.castShadow = true;
			tower.receiveShadow = true;
			this.group.add( tower );
			const band = new Mesh( new BoxGeometry( S + 0.3, 0.5, S + 0.3 ), this.stone );
			band.position.set( x, STREET + H - 0.25, z );
			band.rotation.y = yaw;
			this.group.add( band );
			const roof = new Mesh( new ConeGeometry( S * 0.8, 3.2, 4 ), this.copper );
			roof.position.set( x, STREET + H + 1.6, z );
			roof.rotation.y = yaw + Math.PI / 4;
			roof.castShadow = true;
			this.group.add( roof );
			const w = this.field.toWorld( x, z );
			this.colliders.addBox( new Vector3( w.x, this.field.y0 + STREET + H / 2, w.z ), new Vector3( S / 2, H / 2, S / 2 ), this.field.group.rotation.y + yaw, { tag: 'gate' } );

		}

		// the lintel over the opening, with the gate's name facing out
		const tex = canvasTexture( 2048, 256, ( ctx, w, h ) => {

			ctx.fillStyle = '#0c3b2a';
			ctx.fillRect( 0, 0, w, h );
			ctx.strokeStyle = '#d8c9a3';
			ctx.lineWidth = 10;
			ctx.strokeRect( 14, 14, w - 28, h - 28 );
			ctx.fillStyle = '#f2ede1';
			ctx.font = '700 150px "Helvetica Neue", Helvetica, Arial, sans-serif';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText( g.name.split( '' ).join( String.fromCharCode( 8202 ) ), w / 2, h / 2 + 8, w - 120 );

		}, 'gateSign' );
		const signMat = standard( { name: 'gate-sign', roughness: 0.6, textures: { bpSign: tex }, surface: 'let t = textureSample( bpSign, smpAnisoClamp, in.uv ).rgb; s.albedo = t * 0.8; s.emissive = t * smoothstep( 0.1, 0.7, frame.night ) * 1.5;' } );
		signMat.underwaterLighting = 'none';
		const lintel = new Mesh( new BoxGeometry( W + 0.4, 1.6, 1.0 ), this.stone );
		const lx = a[ 0 ] + ux * t - nx * 0.4, lz = a[ 1 ] + uz * t - nz * 0.4;
		lintel.position.set( lx, STREET + 8.2, lz );
		lintel.rotation.y = yaw;
		lintel.castShadow = true;
		this.group.add( lintel );
		const q = new Quads();
		const hw = W / 2 - 0.2, cx = lx + nx * 0.52, cz = lz + nz * 0.52;
		const L = [ cx - ux * hw, cz - uz * hw ], R = [ cx + ux * hw, cz + uz * hw ];
		// seen from outside (facing -n), left is -u... the canvas reads left to right along +u when viewed
		// from outside if u points to the viewer's right: check with the normal
		const flip = ( ux * nz - uz * nx ) < 0;
		const [ P0, P1 ] = flip ? [ R, L ] : [ L, R ];
		q.add( [ P0[ 0 ], STREET + 7.55, P0[ 1 ] ], [ P1[ 0 ], STREET + 7.55, P1[ 1 ] ], [ P1[ 0 ], STREET + 8.85, P1[ 1 ] ], [ P0[ 0 ], STREET + 8.85, P0[ 1 ] ], [ nx, 0, nz ] );
		const geo = q.geometry();
		const uv = geo.getAttribute( 'uv' ).array;
		// quad uvs: ( 0,1 ) ( 1,1 ) ( 1,0 ) / ( 0,1 ) ( 1,0 ) ( 0,0 ) in the order add() emits them
		const pos = geo.getAttribute( 'position' ).array;
		for ( let i = 0; i < uv.length / 2; i ++ ) {

			const px = pos[ i * 3 ], py = pos[ i * 3 + 1 ], pz = pos[ i * 3 + 2 ];
			const along = ( ( px - P0[ 0 ] ) * ( P1[ 0 ] - P0[ 0 ] ) + ( pz - P0[ 1 ] ) * ( P1[ 1 ] - P0[ 1 ] ) ) / ( segLen( P0, P1 ) ** 2 );
			uv[ i * 2 ] = along;
			uv[ i * 2 + 1 ] = py > STREET + 8.2 ? 0 : 1;

		}

		const sign = new Mesh( geo, signMat );
		sign.name = 'gate-sign';
		this.group.add( sign );

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
