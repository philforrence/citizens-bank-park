import { Group, Mesh, BoxGeometry, CylinderGeometry, ConeGeometry, SphereGeometry, LatheGeometry, Vector2, Vector3, Color } from '../engine/index.js';
import { commonModule } from '../engine/render/wgsl/common.js';
import { StorageBuffer } from '../engine/gpu/Texture.js';
import { standard } from '../materials/Materials.js';
import { Quads } from './Stands.js';
import { flatPolygon, offsetLoop, canvasTexture, segLen, lerp2, beam, box } from './geo.js';
import { FOOTPRINT, LEVELS } from './layout.js';
import { STATUES } from './data/surroundings.js';
import { bakePose, neutralPose, PART } from './game/Rig.js';
import * as M from './game/Motions.js';

// Outside the ballpark at street level: the brick facade round the footprint with the gates in it, the
// sidewalks, the plaza at the Third Base Gate (Pattison Avenue and Citizens Bank Way) with the Mike
// Schmidt statue and the Liberty Bell that stood on top of Veterans Stadium, and the other statues.
// Built in the field frame (layout.js) in the Field's group; street level is LEVELS.mainConcourse.

const STREET = LEVELS.mainConcourse;
const FACADE = 6.5; // brick base height above the street

// The gates: a point on the footprint's edge where each opens, its width, and its name
export const GATES = [
	// the Third and First Base Gates are the stadium's open maroon frame (`open`: no brick across that
	// width), their gate line between two stair towers that carry the light towers
	{ name: 'THIRD BASE GATE', at: [ - 80.95, 32.03 ], width: 30, open: 56, frame: true },
	{ name: 'FIRST BASE GATE', at: [ 73.5, 25.48 ], width: 30, open: 56, frame: true },
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

		this.reflect = []; // lights seen in the wet plaza: [ field x, y, z, r, g, b, strength ]
		this._materials();
		this._buildSidewalks();
		this._buildFacade();
		for ( const g of GATES ) this._buildGate( g );
		this._buildPlaza();
		this._buildStatues();
		this._writeReflections();

	}

	// the lights that streak in the wet plaza, into the pavers' buffer (world frame)
	_writeReflections() {

		const list = this.reflect.slice( 0, 32 );
		const d = new Float32Array( 64 * 4 );
		list.forEach( ( [ x, y, z, r, g, b, k ], i ) => {

			const w = this.field.toWorld( x, z );
			d.set( [ w.x, this.field.y0 + y, w.z, 1, r, g, b, k ], i * 8 );

		} );
		this.reflectBuffer.write( d );
		this.pavers.uniforms.reflectN.value = list.length;

	}

	_materials() {

		this.brick = standard( {
			name: 'facade-brick', color: new Color( 0.24, 0.065, 0.038 ), roughness: 0.85, modules: [ commonModule ],
			surface: /* wgsl */`
	// uv: x along the wall (m), y height above the street (m). The ground storey in rose granite with
	// store fronts and ticket windows in some of its 7.5 m bays; brick above a precast band.
	let u = in.uv.x; let v = in.uv.y - ${ STREET.toFixed( 4 ) };
	let bay = fract( u / 7.5 ) * 7.5;
	let bayId = floor( u / 7.5 );
	let row = floor( v / 0.075 );
	let bu = u / 0.2 + 0.5 * ( row % 2.0 );
	// the courses fade to their average where they get finer than a pixel (no moire)
	let fr = clamp( fwidth( v ) / 0.075 * 1.5 - 0.25, 0.0, 1.0 );
	let fb = clamp( fwidth( bu ) * 1.5 - 0.25, 0.0, 1.0 );
	let mortar = clamp( mix( step( 0.88, fract( v / 0.075 ) ), 0.12, fr ) + mix( step( 0.93, fract( bu ) ), 0.07, max( fb, fr ) ), 0.0, 1.0 );
	let tone = mix( 0.82 + 0.3 * fract( sin( dot( vec2f( floor( bu ), row ), vec2f( 12.9898, 78.233 ) ) ) * 43758.5453 ), 0.97, max( fr, fb ) );
	var c = mix( mat.color * tone, vec3f( 0.42, 0.4, 0.36 ), mortar * 0.8 );
	var rough = 0.85;
	var e = vec3f( 0.0 );
	let night = smoothstep( 0.1, 0.7, frame.night );
	// the ground storey (to 5 m) in rose granite: flamed ashlar in 1.2 x 0.6 m blocks with 2 cm reveals
	// over a black granite band, polished darker rose below it
	let granite = v < 5.0;
	if ( granite ) {
		let gr = floor( v / 0.6 );
		let gx = u / 1.2 + 0.5 * ( gr % 2.0 );
		let jv = min( fract( v / 0.6 ), 1.0 - fract( v / 0.6 ) ) * 0.6;
		let ju = min( fract( gx ), 1.0 - fract( gx ) ) * 1.2;
		let reveal = 1.0 - ( 1.0 - smoothstep( 0.008, 0.02, min( jv, ju ) ) ) * ( 1.0 - clamp( fwidth( v ) * 20.0, 0.0, 1.0 ) ) * 0.45;
		let tint = 0.92 + 0.1 * fract( sin( dot( vec2f( floor( gx ), gr ), vec2f( 12.9, 78.2 ) ) ) * 43758.5 );
		c = vec3f( 0.46, 0.3, 0.22 ) * tint * reveal * ( 0.94 + 0.08 * mx_noise_float2( vec2f( u, v ) * 6.0 ) );
		rough = 0.75;
		if ( v < 1.3 ) { c = vec3f( 0.025 ); rough = 0.3; }
		if ( v < 1.1 ) { c = vec3f( 0.21, 0.1, 0.085 ) * ( 0.9 + 0.15 * mx_noise_float2( vec2f( u, v ) * 9.0 ) ); rough = 0.25; }
	}
	// what fills each bay: mostly plain granite (now and then a steel service door), dark glass store
	// fronts on bronze mullions, or ticket windows
	let kind = fract( sin( bayId * 12.9898 ) * 43758.5453 );
	let opening = bay > 1.3 && bay < 7.2 && v > 0.9 && v < 4.7 && kind > 0.4;
	let pier = false;
	if ( kind < 0.14 && abs( bay - 4.25 ) < 0.9 && v < 2.5 ) {
		c = vec3f( 0.1, 0.03, 0.03 ) * ( 0.9 + 0.1 * step( 0.5, fract( v / 0.5 ) ) ); rough = 0.5;
		if ( abs( bay - 4.25 ) > 0.84 || v > 2.44 ) { c = vec3f( 0.05, 0.02, 0.02 ); }
	}
	if ( opening ) {
		let ou = bay - 1.3;
		if ( kind < 0.78 ) {
			// dark glass on bronze-maroon mullions, 1.5 m grid, lit inside after dark
			let mu = step( abs( fract( ou / 1.475 ) - 0.5 ), 0.035 ) + step( abs( fract( ( v - 0.9 ) / 1.27 ) - 0.5 ), 0.035 );
			c = mix( vec3f( 0.035, 0.045, 0.055 ), vec3f( 0.042, 0.016, 0.018 ), clamp( mu, 0.0, 1.0 ) );
			rough = mix( 0.05, 0.4, clamp( mu, 0.0, 1.0 ) );
			e = vec3f( 1.0, 0.86, 0.64 ) * ( 1.0 - clamp( mu, 0.0, 1.0 ) ) * night * 0.3;
		} else {
			// ticket windows: glazed bays 1.3 m wide over a counter, a white home-plate number over each,
			// TICKETS across the top
			let wb = fract( ou / 1.475 ) * 1.475;
			let glass = wb > 0.12 && wb < 1.35 && v > 1.15 && v < 2.7;
			c = vec3f( 0.34, 0.33, 0.31 );
			rough = 0.7;
			if ( glass ) { c = vec3f( 0.05, 0.07, 0.08 ); rough = 0.08; e = vec3f( 1.0, 0.9, 0.7 ) * night * 0.45; }
			let pc = vec2f( wb - 0.74, v - 3.05 );
			let plate = abs( pc.x ) < 0.2 && pc.y < 0.18 && pc.y > - 0.18 + abs( pc.x ) * 0.6;
			if ( plate ) { c = vec3f( 0.85 ); e = vec3f( 0.6 ) * night * 0.4; }
			if ( v > 3.6 && v < 4.4 ) { c = vec3f( 0.05, 0.1, 0.25 ); let t = step( 0.5, fract( ou / 0.32 ) ) * step( 3.8, v ) * step( v, 4.2 ); c = mix( c, vec3f( 0.9 ), t * 0.8 ); e = vec3f( 0.9 ) * t * night * 0.6; }
		}
	}
	// a precast band over the granite, and the cap
	if ( v > 5.0 && v < 5.35 ) { c = vec3f( 0.5, 0.46, 0.4 ); rough = 0.7; }
	if ( v > 6.25 ) { c = vec3f( 0.5, 0.46, 0.4 ); rough = 0.7; }
	s.emissive = e;
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
		// the storeys over the base: plain red brick in big planes, tall dark-glass slots every 7.5 m (the
		// offices behind them lit after dark), a soldier course at each floor
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
	// big blank planes of brick: windows only in tall dark-glass slots, one every 7.5 m, a soldier course
	// at each floor
	let bay = fract( u / 7.5 ) * 7.5 - 3.75;
	let win = abs( bay ) < 0.45 && v > 0.9;
	let sill = false;
	if ( fl < 0.12 && ! win ) { c = c * 0.82; }
	var e = vec3f( 0.0 );
	if ( win ) {
		let mull = max( step( abs( fl - 0.2 ), 0.2 ), step( 0.43, abs( bay ) ) );
		let cell = floor( vec2f( u / 3.75, v / 3.6 ) );
		let hh = fract( sin( vec3f( dot( cell, vec2f( 12.9898, 78.233 ) ), dot( cell, vec2f( 39.3, 11.1 ) ), dot( cell, vec2f( 73.1, 52.2 ) ) ) ) * 43758.5453 );
		let N = normalize( in.N );
		let T = normalize( cross( vec3f( 0.0, 1.0, 0.0 ), N ) );
		let Vd = normalize( in.P - frame.cameraPos );
		let rd = vec3f( dot( Vd, T ), Vd.y, max( dot( Vd, - N ), 0.05 ) );
		let ro = vec3f( bay, fl - 0.4, 0.0 );
		let tx = ( select( -2.2, 2.2, rd.x > 0.0 ) - ro.x ) / rd.x;
		let ty = ( select( -0.95, 2.05, rd.y > 0.0 ) - ro.y ) / rd.y;
		let tz = 4.0 / rd.z;
		let t = min( tx, min( ty, tz ) );
		let hit = ro + rd * t;
		var room = vec3f( 0.55, 0.5, 0.44 ) * ( 0.8 + 0.3 * hh.z ); // walls
		if ( t == tz ) { room = room * 0.85; if ( abs( hit.x ) < 0.9 && hit.y > 0.3 && hit.y < 1.5 ) { room = vec3f( 0.25, 0.2, 0.16 ); } }
		if ( t == ty && rd.y < 0.0 ) { room = vec3f( 0.16, 0.14, 0.13 ); }
		if ( t == ty && rd.y > 0.0 ) { room = vec3f( 0.9, 0.88, 0.82 ) * ( 0.7 + 0.3 * step( 0.5, fract( hit.z / 1.2 ) ) ); }
		// the ceiling lights near the window are brighter; deeper in, darker
		let depthK = 1.0 - 0.45 * clamp( hit.z / 4.0, 0.0, 1.0 );
		let lit = step( 0.35, hh.x );
		let warmth = mix( vec3f( 1.0, 0.78, 0.52 ), vec3f( 0.95, 0.97, 1.0 ), step( 0.6, hh.y ) );
		// blinds part way down in some
		let blind = step( 0.7, hh.z ) * step( 2.0 - 1.6 * fract( hh.z * 7.0 ), fl - 0.95 );
		var inside = room * warmth * depthK;
		if ( blind > 0.5 ) { inside = vec3f( 0.75, 0.7, 0.6 ) * warmth * ( 0.75 + 0.25 * step( 0.5, fract( fl / 0.05 ) ) ); }
		c = mix( vec3f( 0.025, 0.03, 0.035 ), vec3f( 0.12, 0.05, 0.04 ), mull );
		rough = 0.1;
		let night = smoothstep( 0.1, 0.7, frame.night );
		// by day the rooms show faintly through the glass; after dark the lit ones glow
		c = c + inside * ( 1.0 - mull ) * 0.08 * ( 1.0 - night );
		e = inside * ( 1.0 - mull ) * night * mix( 0.015, 0.45, lit );
	}
	s.albedo = c;
	s.roughness = rough;
	s.emissive = e;
`,
		} );
		this.coping = standard( { name: 'facade-cap', color: new Color( 0.36, 0.33, 0.28 ), roughness: 0.7 } );
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
		this.reflectBuffer = new StorageBuffer( { label: 'plazaLights', count: 64, type: 'vec4f' } );
		this.pavers = standard( {
			name: 'plaza-pavers', color: new Color( 0.3, 0.14, 0.09 ), roughness: 0.8, modules: [ commonModule ],
			uniforms: { reflectN: [ 'f32', 0 ] },
			storage: { plzLights: this.reflectBuffer },
			surface: /* wgsl */`
	// light concrete slabs (1.5 m, saw-cut joints, a broom finish across each, dirt in the joints, stains
	// and gum) crossed by bands of red brick pavers every 10 m, laid in herringbone
	let p = in.uv;
	let g = abs( fract( p / 10.0 ) - 0.5 ) * 10.0; // metres from the middle of a 10 m cell
	let band = max( g.x, g.y ) > 4.4;
	let fw = fwidth( p.x ) + 0.002;
	let far = clamp( fw * 12.0 - 0.3, 0.0, 1.0 );
	var c: vec3f;
	var rough = 0.8;
	if ( band ) {
		let q = vec2f( p.x + p.y, p.x - p.y ) * 0.7071;
		let cell = floor( q / vec2f( 0.2, 0.1 ) );
		let f = fract( q / vec2f( 0.2, 0.1 ) );
		let mortar = mix( clamp( step( 0.9, f.x ) + step( 0.85, f.y ), 0.0, 1.0 ), 0.2, far );
		let tone = mix( 0.8 + 0.35 * fract( sin( dot( cell, vec2f( 12.9898, 78.233 ) ) ) * 43758.5453 ), 0.97, far );
		c = mix( mat.color * tone, vec3f( 0.22, 0.2, 0.18 ), mortar * 0.75 );
		// the band's edge in granite
		if ( max( g.x, g.y ) < 4.55 ) { c = vec3f( 0.3, 0.3, 0.29 ); rough = 0.6; }
	} else {
		let slab = floor( p / 1.5 );
		let sj = abs( fract( p / 1.5 ) - 0.5 ) * 1.5;
		let jd = 0.75 - max( sj.x, sj.y ); // m from the nearest joint
		let joint = smoothstep( 0.008, 0.012 + fw, jd );
		let dirt = 1.0 - smoothstep( 0.0, 0.05, jd );
		let h1 = fract( sin( dot( slab, vec2f( 41.3, 17.7 ) ) ) * 7543.21 );
		let tint = 0.9 + 0.14 * h1;
		// the broom's striations, across the slab one way or the other
		let across = select( p.y, p.x, fract( h1 * 7.0 ) > 0.5 );
		let alongC = select( p.x, p.y, fract( h1 * 7.0 ) > 0.5 );
		let broom = mx_noise_float2( vec2f( across * 140.0, alongC * 2.0 ) ) * ( 1.0 - clamp( fw * 60.0, 0.0, 1.0 ) );
		c = vec3f( 0.46, 0.44, 0.4 ) * tint * mix( 0.55, 1.0, joint ) * mix( 1.0, 0.8, dirt ) * ( 1.0 + 0.06 * broom );
		// stains, and the odd piece of gum
		let blot = smoothstep( 0.35, 0.75, mx_noise_float2( p * 0.45 + slab * 3.1 ) );
		c = c * ( 1.0 - 0.16 * blot );
		let gc = floor( p / 0.6 );
		let gh = fract( sin( dot( gc, vec2f( 27.1, 91.7 ) ) ) * 9143.7 );
		let go = vec2f( fract( gh * 13.0 ), fract( gh * 29.0 ) ) * 0.5 + 0.05;
		let gd = length( p - gc * 0.6 - go );
		if ( gh > 0.8 ) { c = mix( c, vec3f( 0.18, 0.18, 0.17 ), ( 1.0 - smoothstep( 0.008, 0.014, gd ) ) * ( 1.0 - far ) ); }
		rough = 0.85 - 0.1 * blot;
	}
	c = c * ( 0.9 + 0.12 * mx_noise_float2( p * 0.35 ) + 0.05 * mx_noise_float2( p * 4.0 ) );

	// wet: the concrete darker and glossy, puddles in the low spots (mirrors); the lamps' and the gate's
	// lights streak across it toward you, as on any wet street at night
	let wet = frame.wet;
	let pn = mx_noise_float2( p * 0.16 ) * 0.65 + mx_noise_float2( p * 0.9 ) * 0.35;
	let puddle = smoothstep( 0.2, 0.32, pn - ( 1.0 - wet ) * 0.8 ) * wet;
	c = c * mix( 1.0, 0.6, wet * select( 1.0, 0.6, band ) ) * mix( 1.0, 0.55, puddle );
	rough = mix( mix( rough, 0.2, wet ), 0.03, puddle );
	var refl = vec3f( 0.0 );
	let V = normalize( in.P - frame.cameraPos );
	let R = vec3f( V.x, - V.y, V.z );
	let rh = normalize( R.xz + vec2f( 1e-5, 0.0 ) );
	let sa = mix( 0.02, 0.008, puddle );
	let sl = mix( 0.4, 0.14, puddle );
	let rEl = asin( clamp( R.y, -1.0, 1.0 ) );
	for ( var i = 0u; i < u32( mat.reflectN ); i ++ ) {
		let L = plzLights[ i * 2u ];
		let col = plzLights[ i * 2u + 1u ];
		let D = L.xyz - in.P;
		let dl = length( D );
		let Ld = D / dl;
		let lh = normalize( Ld.xz + vec2f( 1e-5, 0.0 ) );
		if ( dot( rh, lh ) < 0.0 ) { continue; }
		let acr = abs( rh.x * lh.y - rh.y * lh.x );
		let alg = rEl - asin( clamp( Ld.y, -1.0, 1.0 ) );
		refl += col.rgb * col.a * exp( - ( acr * acr ) / ( sa * sa ) - ( alg * alg ) / ( sl * sl ) ) / ( 1.0 + dl * dl * 0.0015 );
	}
	s.albedo = c;
	s.roughness = rough;
	s.emissive = refl * wet * mix( 0.3, 1.0, puddle ) * smoothstep( 0.1, 0.7, frame.night );
`,
		} );
		this.pavers.setDefine( 'DRY', 1 ); // its own wetness (above)
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
			this.reflect.push( [ x, STREET + 4.8, z, 1.0, 0.72, 0.42, 6.0 ] );
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
		this._plazaFurniture( trunk, leaves );

	}

	// Round raised brick planters with cast-stone caps, shrubs and fall flowers; trees in grates; benches
	// facing the gate; bollards along the curb. Kept off the walk from the corner to the gate.
	_plazaFurniture( trunk, leaves ) {

		const start = [ - 112, 78 ], gate = GATES[ 0 ].at;
		const clearOfWalk = ( x, z, r ) => {

			const dx = gate[ 0 ] - start[ 0 ], dz = gate[ 1 ] - start[ 1 ], l2 = dx * dx + dz * dz;
			const t = Math.max( 0, Math.min( 1, ( ( x - start[ 0 ] ) * dx + ( z - start[ 1 ] ) * dz ) / l2 ) );
			return Math.hypot( start[ 0 ] + dx * t - x, start[ 1 ] + dz * t - z ) > r + 3;

		};
		const brick = new Quads(), stone = new Quads(), steel = new Quads(), wood = new Quads();
		const planters = [ [ - 124, 70, 3.2 ], [ - 96, 84, 3.0 ], [ - 124, 50, 2.6 ], [ - 104, 36, 2.8 ], [ - 84, 66, 2.6 ], [ - 116, 22, 2.4 ] ].filter( ( [ x, z, r ] ) => clearOfWalk( x, z, r ) );
		const shrub = standard( { name: 'shrubs', color: new Color( 0.06, 0.14, 0.04 ), roughness: 0.9, modules: [ commonModule ],
			surface: /* wgsl */`
	let n = mx_noise_float3( in.P * 2.3 );
	var c = mat.color * ( 0.7 + 0.6 * n );
	// mums: rust, gold and purple clumps
	let f = mx_noise_float3( in.P * 5.0 + vec3f( 3.0 ) );
	if ( f > 0.35 ) { c = select( select( vec3f( 0.35, 0.08, 0.03 ), vec3f( 0.5, 0.35, 0.03 ), f > 0.45 ), vec3f( 0.22, 0.05, 0.2 ), f > 0.55 ); }
	s.albedo = c;
` } );
		shrub.underwaterLighting = 'none';
		for ( const [ x, z, r ] of planters ) {

			const N = 24, h = 0.6;
			for ( let i = 0; i < N; i ++ ) {

				const a0 = i / N * Math.PI * 2, a1 = ( i + 1 ) / N * Math.PI * 2;
				const P = ( a, rr, y ) => [ x + Math.cos( a ) * rr, y, z + Math.sin( a ) * rr ];
				const n = [ Math.cos( ( a0 + a1 ) / 2 ), 0, Math.sin( ( a0 + a1 ) / 2 ) ];
				brick.add( P( a0, r, STREET ), P( a1, r, STREET ), P( a1, r, STREET + h ), P( a0, r, STREET + h ), n );
				stone.add( P( a0, r + 0.08, STREET + h ), P( a1, r + 0.08, STREET + h ), P( a1, r - 0.35, STREET + h ), P( a0, r - 0.35, STREET + h ), [ 0, 1, 0 ] );
				stone.add( P( a0, r + 0.08, STREET + h - 0.12 ), P( a1, r + 0.08, STREET + h - 0.12 ), P( a1, r + 0.08, STREET + h ), P( a0, r + 0.08, STREET + h ), n );

			}

			// the shrubs: a low mound of clumps
			for ( let k = 0; k < 7; k ++ ) {

				const a = k / 7 * Math.PI * 2 + x, rr = k === 0 ? 0 : r * 0.55;
				const m = new Mesh( new SphereGeometry( k === 0 ? r * 0.55 : r * 0.35, 10, 7 ), shrub );
				m.position.set( x + Math.cos( a ) * rr, STREET + h + 0.1, z + Math.sin( a ) * rr );
				m.scale.y = 0.55;
				m.castShadow = true;
				this.group.add( m );

			}

			const w = this.field.toWorld( x, z );
			this.colliders.addCylinder( w.x, w.z, r, this.field.y0 + STREET, this.field.y0 + STREET + h );

		}

		// trees in grates across the plaza
		for ( const [ x, z ] of [ [ - 118, 88 ], [ - 88, 90 ], [ - 126, 36 ], [ - 96, 20 ], [ - 110, 58 ], [ - 72, 74 ] ].filter( ( [ x, z ] ) => clearOfWalk( x, z, 1.5 ) ) ) {

			this._tree( x, z, trunk, leaves );
			box( steel, [ x, STREET + 0.03, z ], [ 1.8, 0.04, 1.8 ] );

		}

		// benches facing the gate: slats on steel legs
		const face = Math.atan2( gate[ 0 ] - start[ 0 ], gate[ 1 ] - start[ 1 ] );
		for ( const [ x, z ] of [ [ - 124, 60 ], [ - 100, 88 ], [ - 90, 76 ], [ - 122, 30 ] ].filter( ( [ x, z ] ) => clearOfWalk( x, z, 1.2 ) ) ) {

			const c = Math.cos( face ), sn = Math.sin( face );
			const P = ( a, y, b ) => [ x + a * c + b * sn, y, z - a * sn + b * c ];
			for ( const a of [ - 0.8, 0.8 ] ) beam( steel, P( a, STREET, 0 ), P( a, STREET + 0.45, 0 ), 0.08 );
			for ( let k = 0; k < 4; k ++ ) beam( wood, P( - 0.95, STREET + 0.46, - 0.2 + k * 0.13 ), P( 0.95, STREET + 0.46, - 0.2 + k * 0.13 ), 0.07 );
			for ( let k = 0; k < 2; k ++ ) beam( wood, P( - 0.95, STREET + 0.7 + k * 0.16, - 0.28 ), P( 0.95, STREET + 0.7 + k * 0.16, - 0.28 ), 0.07 );
			const w = this.field.toWorld( x, z );
			this.colliders.addCylinder( w.x, w.z, 0.9, this.field.y0 + STREET, this.field.y0 + STREET + 0.8 );

		}

		// bollards along the plaza's street edges
		for ( let x = - 128; x <= - 74; x += 2.4 ) beam( steel, [ x, STREET, 97 ], [ x, STREET + 0.9, 97 ], 0.2 );
		for ( let z = 14; z <= 94; z += 2.4 ) beam( steel, [ - 132, STREET, z ], [ - 132, STREET + 0.9, z ], 0.2 );

		const mats = [
			[ brick, this.brickPlain, 'planters' ], [ stone, this.stone, 'planter-caps' ],
			[ steel, this.metal || ( this.metal = standard( { name: 'plaza-steel', color: new Color( 0.3, 0.31, 0.32 ), roughness: 0.45, metalness: 0.7 } ) ), 'plaza-steel' ],
			[ wood, this.wood || ( this.wood = standard( { name: 'bench-wood', color: new Color( 0.22, 0.13, 0.07 ), roughness: 0.7 } ) ), 'benches' ],
		];
		for ( const [ q, mat, name ] of mats ) {

			mat.underwaterLighting = 'none';
			const m = new Mesh( q.geometry(), mat );
			m.name = name;
			m.castShadow = true;
			m.receiveShadow = true;
			this.group.add( m );

		}

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
		// how tall the brick is: the plain brick masses flanking the Third and First Base Gates' frames,
		// four storeys by the Home Plate entrance, three round the rest of the infield, the one-storey base
		// in the outfield
		const heightOf = ( A, B ) => {

			const c = lerp2( A, B, 0.5 );
			if ( [ GATES[ 0 ], GATES[ 1 ] ].some( ( g ) => segLen( g.at, c ) < 70 ) ) return 20;
			if ( segLen( GATES[ 3 ].at, c ) < 46 ) return 16;
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

					const hw = ( g.open || g.width ) / 2;
					cuts.push( [ Math.max( 0, t - hw ), Math.min( len, t + hw ) ] );
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
					// a thin precast cap along the parapet
					const o = 0.06;
					trim.add( [ A[ 0 ] + nx * o, y1 - 0.2, A[ 1 ] + nz * o ], [ B[ 0 ] + nx * o, y1 - 0.2, B[ 1 ] + nz * o ], [ B[ 0 ] + nx * o, y1 + 0.12, B[ 1 ] + nz * o ], [ A[ 0 ] + nx * o, y1 + 0.12, A[ 1 ] + nz * o ], [ nx, 0, nz ] );
					trim.add( [ A[ 0 ] + nx * o, y1 + 0.12, A[ 1 ] + nz * o ], [ B[ 0 ] + nx * o, y1 + 0.12, B[ 1 ] + nz * o ], [ Bi[ 0 ] - nx * o, y1 + 0.12, Bi[ 1 ] - nz * o ], [ Ai[ 0 ] - nx * o, y1 + 0.12, Ai[ 1 ] - nz * o ], [ 0, 1, 0 ] );

				}
				// coping on top and the piece's ends
				cap.add( [ A[ 0 ] + nx * 0.15, y1, A[ 1 ] + nz * 0.15 ], [ B[ 0 ] + nx * 0.15, y1, B[ 1 ] + nz * 0.15 ], [ Bi[ 0 ] - nx * 0.15, y1, Bi[ 1 ] - nz * 0.15 ], [ Ai[ 0 ] - nx * 0.15, y1, Ai[ 1 ] - nz * 0.15 ], [ 0, 1, 0 ] );
				for ( const [ P0, P1, d ] of [ [ A, Ai, - 1 ], [ B, Bi, 1 ] ] ) up.add( [ P0[ 0 ], y0, P0[ 1 ] ], [ P1[ 0 ], y0, P1[ 1 ] ], [ P1[ 0 ], y1, P1[ 1 ] ], [ P0[ 0 ], y1, P0[ 1 ] ], [ ux * d, 0, uz * d ], 0, T );
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
		// the frame gates' canopy runs the width of the frame, over the stair towers
		const half = g.frame ? 25 : W / 2 + 1.2, out = g.frame ? 5 : 4.6, inn = - 2.6, under = y0 + ( g.frame ? 5.6 : 4.9 ), top = y0 + ( g.frame ? 6.8 : 6.0 );
		// the canopy: a deck, its fascia all round, and the steel under it
		q.add( P( - half, inn, top ), P( half, inn, top ), P( half, out, top ), P( - half, out, top ), [ 0, 1, 0 ] );
		const soffit = new Quads();
		soffit.add( P( - half, inn, under ), P( half, inn, under ), P( half, out, under ), P( - half, out, under ), [ 0, - 1, 0 ] );
		// its downlights, in the wet plaza too
		for ( let sk = - half + 1.5; sk < half; sk += 3 ) if ( this.reflect && /THIRD/.test( g.name ) && Math.abs( sk ) < half - 1 ) this.reflect.push( [ ...P( sk, out - 1.2, under - 0.05 ), 1.0, 0.78, 0.5, 0.9 ] );
		q.add( P( - half, inn, under ), P( half, inn, under ), P( half, inn, top ), P( - half, inn, top ), [ - nx, 0, - nz ] );
		for ( const e of [ - 1, 1 ] ) q.add( P( e * half, inn, under ), P( e * half, out, under ), P( e * half, out, top ), P( e * half, inn, top ), [ ux * e, 0, uz * e ] );
		const CW = g.frame ? 2 * half - 4 : W;
		const nCol = Math.max( 2, Math.round( CW / 7.5 ) );
		for ( let k = 0; k <= nCol; k ++ ) {

			const s = - CW / 2 + CW * k / nCol;
			// columns out front and at the facade line, knee braces up to the canopy
			beam( q, P( s, out - 0.8, y0 ), P( s, out - 0.8, under ), 0.4 );
			beam( q, P( s, out - 0.8, under - 1.4 ), P( s, out - 2.4, under ), 0.18 );
			beam( q, P( s, out - 0.8, under - 1.4 ), P( s, out + 0.4, under ), 0.18 );
			beam( q, P( s, inn + 0.3, under - 0.2 ), P( s, out, under - 0.2 ), 0.3 );
			const w = this.field.toWorld( ...[ P( s, out - 0.8, 0 )[ 0 ], P( s, out - 0.8, 0 )[ 2 ] ] );
			this.colliders.addCylinder( w.x, w.z, 0.3, this.field.y0 + y0, this.field.y0 + under );

		}

		beam( q, P( - half, out - 0.8, under - 0.2 ), P( half, out - 0.8, under - 0.2 ), 0.35 );
		const cs = this.canopySoffit || ( this.canopySoffit = standard( { name: 'canopy-soffit', color: new Color( 0.1, 0.03, 0.03 ), roughness: 0.6, side: 'double',
			surface: /* wgsl */`
	// maroon steel deck on joists every 0.6 m, a warm downlight every 3 m in two rows
	let p = in.P.xz;
	let j = step( 0.42, abs( fract( ( p.x + p.y ) / 0.6 ) - 0.5 ) );
	s.albedo = mat.color * mix( 1.0, 0.6, j );
	let c = abs( fract( ( p.x - p.y ) / 3.0 ) - 0.5 ) * 3.0;
	let r = abs( fract( ( p.x + p.y ) / 2.4 ) - 0.5 ) * 2.4;
	let lamp = ( 1.0 - smoothstep( 0.14, 0.18, length( vec2f( c - 1.5, r - 1.2 ) ) ) );
	s.emissive = vec3f( 1.0, 0.8, 0.52 ) * lamp * mix( 1.0, 5.0, smoothstep( 0.1, 0.7, frame.night ) ) + s.albedo * 0.2;
` } ) );
		cs.underwaterLighting = 'none';
		this.group.add( new Mesh( soffit.geometry(), cs ) );
		const m = new Mesh( q.geometry(), steel );
		m.name = 'gate-canopy';
		m.castShadow = true;
		m.receiveShadow = true;
		this.group.add( m );

		// the front fascia: maroon with the gate's name in the middle, lit after dark
		const tex = canvasTexture( 4096, 128, ( ctx, w, h ) => {

			ctx.fillStyle = '#5a2328';
			ctx.fillRect( 0, 0, w, h );
			ctx.fillStyle = 'rgba( 255, 255, 255, 0.07 )';
			ctx.fillRect( 0, 0, w, 8 ); ctx.fillRect( 0, h - 8, w, 8 );
			// white serif capitals, widely spaced
			ctx.font = '600 80px "Trajan Pro", Copperplate, "Copperplate Gothic Light", Georgia, serif';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			const t = g.name.split( '' ).join( String.fromCharCode( 8201 ) );
			ctx.fillStyle = '#fff8ee';
			ctx.fillText( t, w / 2, h / 2 + 4 );

		}, 'gateSign' );
		const signMat = standard( { name: 'gate-sign', roughness: 0.5, textures: { bpSign: tex }, surface: 'let t = textureSample( bpSign, smpAnisoClamp, in.uv ).rgb; s.albedo = t * 0.75; s.emissive = t * step( 0.5, t.g ) * smoothstep( 0.1, 0.7, frame.night ) * 1.6;' } );
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

		// the gate line: one continuous run of galvanized welded-wire mesh, 3 m, across the whole opening,
		// with turnstile lanes through it (a tripod turnstile and a round white scanner on a post in each)
		const fence = this.fenceMat || ( this.fenceMat = standard( {
			name: 'gate-grid', color: new Color( 0.78, 0.77, 0.73 ), roughness: 0.5, metalness: 0.0, alphaTest: 0.5, side: 'double',
			surface: /* wgsl */`
	// white-painted steel grid panels: bars every 10 cm across and 30 cm up, a frame round each 1.8 m panel
	let fx = fwidth( in.uv.x ) / 0.1;
	let fy = fwidth( in.uv.y ) / 0.3;
	let vw = smoothstep( 0.4 - fx, 0.44, abs( fract( in.uv.x / 0.1 ) - 0.5 ) );
	let hw = smoothstep( 0.42 - fy, 0.46, abs( fract( in.uv.y / 0.3 ) - 0.5 ) );
	let frame = step( in.uv.y, 0.1 ) + step( 3.38, in.uv.y ) + step( abs( in.uv.y - 2.3 ), 0.05 ) + step( 0.47, abs( fract( in.uv.x / 1.8 ) - 0.5 ) );
	s.alpha = max( max( max( vw, hw ), clamp( max( fx, fy ) * 0.5, 0.0, 0.55 ) ), clamp( frame, 0.0, 1.0 ) );
` } ) );
		fence.underwaterLighting = 'none';
		const bq = new Quads(), dq = new Quads(), post = new Quads(), bb = new Quads(), balls = [];
		const H = 3.5, LANE = 1.4, BAY = 3.6;
		const mesh = ( s1, s2, ya, yb ) => {

			const A = P( s1, 0, y0 + ya ), B = P( s2, 0, y0 + ya ), l = Math.abs( s2 - s1 );
			bq.tri( A, B, [ B[ 0 ], y0 + yb, B[ 2 ] ], [ nx, 0, nz ], [ 0, ya ], [ l, ya ], [ l, yb ] );
			bq.tri( A, [ B[ 0 ], y0 + yb, B[ 2 ] ], [ A[ 0 ], y0 + yb, A[ 2 ] ], [ nx, 0, nz ], [ 0, ya ], [ l, yb ], [ 0, yb ] );

		};

		const n = Math.max( 1, Math.floor( W / BAY ) );
		const s0 = - n * BAY / 2;
		// the ends out to the brick
		for ( const [ a, b ] of [ [ - W / 2, s0 ], [ s0 + n * BAY, W / 2 ] ] ) if ( b - a > 0.05 ) {

			mesh( a, b, 0, H );
			const c = P( ( a + b ) / 2, 0, 0 ), w = this.field.toWorld( c[ 0 ], c[ 2 ] );
			this.colliders.addBox( new Vector3( w.x, this.field.y0 + y0 + H / 2, w.z ), new Vector3( ( b - a ) / 2, H / 2, 0.1 ), this.field.group.rotation.y - Math.atan2( uz, ux ), { tag: 'gate' } );

		}

		for ( let k = 0; k < n; k ++ ) {

			const a = s0 + k * BAY, l0 = a + ( BAY - LANE ) / 2, l1 = l0 + LANE, b = a + BAY;
			// mesh either side of the lane, and over it above head height
			mesh( a, l0, 0, H );
			mesh( l1, b, 0, H );
			mesh( l0, l1, 2.3, H );
			// maroon posts between the bays, and a baseball on the fixed panel of every other one
			beam( post, P( a, 0, y0 ), P( a, 0, y0 + H + 0.1 ), 0.14 );
			if ( k % 2 === 0 ) for ( const side of [ 1, - 1 ] ) balls.push( [ ( a + l0 ) / 2, side ] );
			for ( const [ p0, p1 ] of [ [ a, l0 ], [ l1, b ] ] ) {

				const c = P( ( p0 + p1 ) / 2, 0, 0 ), w = this.field.toWorld( c[ 0 ], c[ 2 ] );
				this.colliders.addBox( new Vector3( w.x, this.field.y0 + y0 + H / 2, w.z ), new Vector3( ( p1 - p0 ) / 2, H / 2, 0.1 ), this.field.group.rotation.y - Math.atan2( uz, ux ), { tag: 'gate' } );

			}

			// the turnstile: a post by the lane's edge with three arms, and the scanner on its own post
			const tp = l0 + 0.18;
			beam( post, P( tp, 0, y0 ), P( tp, 0, y0 + 1.0 ), 0.22 );
			for ( let r = 0; r < 3; r ++ ) {

				const ang = r * Math.PI * 2 / 3;
				beam( post, P( tp, 0, y0 + 0.95 ), P( tp + 0.5 * Math.cos( ang ) * 0.8 + 0.1, - 0.5 * Math.sin( ang ), y0 + 0.95 - 0.3 * Math.abs( Math.cos( ang ) ) ), 0.04 );

			}

			const sp = l1 - 0.2;
			beam( post, P( sp, - 0.4, y0 ), P( sp, - 0.4, y0 + 1.05 ), 0.06 );
			for ( const side of [ 1, - 1 ] ) {

				const o = - 0.4 + side * 0.02, r = 0.15, yc = y0 + 1.2;
				for ( let q = 0; q < 16; q ++ ) {

					const a0 = q / 16 * Math.PI * 2, a1 = ( q + 1 ) / 16 * Math.PI * 2;
					dq.tri( P( sp, o, yc ), P( sp + Math.cos( a0 ) * r, o, yc + Math.sin( a0 ) * r ), P( sp + Math.cos( a1 ) * r, o, yc + Math.sin( a1 ) * r ), [ nx * side, 0, nz * side ] );

				}

			}

		}

		// globe lights hung under the canopy
		const globe = this.globeMat || ( this.globeMat = standard( { name: 'canopy-globes', color: new Color( 0.9, 0.88, 0.8 ), roughness: 0.3,
			surface: 's.emissive = vec3f( 1.0, 0.85, 0.6 ) * mix( 0.3, 3.0, smoothstep( 0.1, 0.7, frame.night ) );' } ) );
		globe.underwaterLighting = 'none';
		const ng = 8;
		for ( let k = 0; k < ng; k ++ ) {

			const sk = - W / 2 + W * ( k + 0.5 ) / ng;
			const gp = P( sk, out - 1.6, under - 0.45 );
			if ( /THIRD/.test( g.name ) ) this.reflect.push( [ ...gp, 1.0, 0.8, 0.55, 1.6 ] );
			const gm = new Mesh( new SphereGeometry( 0.2, 12, 8 ), globe );
			gm.position.set( gp[ 0 ], gp[ 1 ], gp[ 2 ] );
			this.group.add( gm );
			beam( post, P( sk, out - 1.6, under - 0.25 ), P( sk, out - 1.6, under ), 0.03 );

		}

		const pm = new Mesh( post.geometry(), this.metal || ( this.metal = standard( { name: 'plaza-steel', color: new Color( 0.3, 0.31, 0.32 ), roughness: 0.45, metalness: 0.7 } ) ) );
		this.metal.underwaterLighting = 'none';
		pm.name = 'turnstiles';
		pm.castShadow = true;
		this.group.add( pm );

		// the glass block over the Third Base Gate, between the stair towers: tinted curtain wall on the
		// concourse levels with a band of louvres on top, lit inside after dark
		if ( /THIRD/.test( g.name ) && ! g.frame ) {

			const gl = this.gateGlass || ( this.gateGlass = standard( { name: 'gate-glass', color: new Color( 0.11, 0.2, 0.26 ), roughness: 0.08, metalness: 0.5, modules: [ commonModule ],
				surface: /* wgsl */`
	let u = in.uv.x; let v = in.uv.y;
	let mull = step( abs( fract( u / 1.5 ) - 0.5 ), 0.03 ) + step( abs( fract( v / 2.3 ) - 0.5 ), 0.025 );
	let louvre = step( 7.0, v );
	var c = mix( mat.color, vec3f( 0.12, 0.04, 0.035 ), clamp( mull, 0.0, 1.0 ) );
	if ( louvre > 0.5 ) { c = vec3f( 0.6, 0.61, 0.62 ) * ( 0.75 + 0.25 * step( 0.5, fract( v / 0.2 ) ) ); }
	s.albedo = c;
	s.roughness = select( 0.08, 0.5, louvre > 0.5 || mull > 0.5 );
	s.emissive = vec3f( 1.0, 0.85, 0.62 ) * ( 1.0 - clamp( mull + louvre, 0.0, 1.0 ) ) * smoothstep( 0.1, 0.7, frame.night ) * ( 0.25 + 0.2 * step( 0.5, fract( v / 3.5 ) ) );
` } ) );
			gl.underwaterLighting = 'none';
			const gq = new Quads();
			const o = - 7.5 + 3.3, ga = STREET + 7.0, gb = STREET + 15.2, half2 = W / 2 + 1.2;
			gq.tri( P( sL === half ? half2 : - half2, o, ga ), P( sL === half ? - half2 : half2, o, ga ), P( sL === half ? - half2 : half2, o, gb ), [ nx, 0, nz ], [ 0, 0 ], [ 2 * half2, 0 ], [ 2 * half2, gb - ga ] );
			gq.tri( P( sL === half ? half2 : - half2, o, ga ), P( sL === half ? - half2 : half2, o, gb ), P( sL === half ? half2 : - half2, o, gb ), [ nx, 0, nz ], [ 0, 0 ], [ 2 * half2, gb - ga ], [ 0, gb - ga ] );
			const gm = new Mesh( gq.geometry(), gl );
			gm.name = 'gate-glass';
			this.group.add( gm );
			// its lit glass, and the green sign over the gate, in the wet plaza
			for ( const f of [ - 0.6, - 0.2, 0.2, 0.6 ] ) this.reflect.push( [ ...P( f * half2, o, ( ga + gb ) / 2 ), 1.0, 0.85, 0.62, 1.5 ] );
			this.reflect.push( [ ...P( 0, out, top + 1.5 ), 0.2, 1.0, 0.45, 2.0 ] );

		}

		if ( /THIRD/.test( g.name ) ) this.reflect.push( [ ...P( 0, out, top + 1.0 ), 0.2, 1.0, 0.45, 1.6 ] );
		// the open stair towers either side of the frame's gate line, carrying the light towers
		if ( g.frame ) for ( const side of [ - 1, 1 ] ) this._stairTower( P, side * 20, - 1.5, [ nx, nz ] );
		const bm = new Mesh( bq.geometry(), fence );
		bm.name = 'gate-mesh';
		bm.castShadow = true;
		this.group.add( bm );
		const disc = this.discMat || ( this.discMat = standard( { name: 'gate-disc', color: new Color( 0.85, 0.85, 0.82 ), roughness: 0.5 } ) );
		disc.underwaterLighting = 'none';
		this.group.add( new Mesh( dq.geometry(), disc ) );
		// the baseballs on the gate panels: 0.9 m, white with red double stitching
		const bmat = this.ballMat || ( this.ballMat = standard( { name: 'gate-baseball', color: new Color( 0.82, 0.81, 0.77 ), roughness: 0.55, side: 'double',
			surface: /* wgsl */`
	let p = ( in.uv - 0.5 ) * 2.0;
	// two stitched seams curving in from either side
	let d = min( abs( length( p - vec2f( -1.25, 0.0 ) ) - 0.95 ), abs( length( p - vec2f( 1.25, 0.0 ) ) - 0.95 ) );
	let st = step( d, 0.07 ) * step( 0.5, fract( atan2( p.y, abs( p.x ) - 1.25 ) * 9.0 ) );
	s.albedo = mix( mat.color, vec3f( 0.5, 0.02, 0.03 ), max( st, step( d, 0.02 ) ) );
	s.emissive = s.albedo * smoothstep( 0.1, 0.7, frame.night ) * 0.15;
` } ) );
		bmat.underwaterLighting = 'none';
		for ( const [ sc, side ] of balls ) {

			const o = side * 0.03, r = 0.45, yc = y0 + 1.3;
			for ( let k = 0; k < 20; k ++ ) {

				const a0 = k / 20 * Math.PI * 2, a1 = ( k + 1 ) / 20 * Math.PI * 2;
				bb.tri( P( sc, o, yc ), P( sc + Math.cos( a0 ) * r, o, yc + Math.sin( a0 ) * r ), P( sc + Math.cos( a1 ) * r, o, yc + Math.sin( a1 ) * r ), [ nx * side, 0, nz * side ],
					[ 0.5, 0.5 ], [ 0.5 + Math.cos( a0 ) * 0.5, 0.5 + Math.sin( a0 ) * 0.5 ], [ 0.5 + Math.cos( a1 ) * 0.5, 0.5 + Math.sin( a1 ) * 0.5 ] );

			}

		}

		if ( balls.length ) this.group.add( new Mesh( bb.geometry(), bmat ) );

	}

	// An open stair tower on the maroon frame inside the gate: landings at each level up to the terrace
	// with grey mesh fronts, flights between them, a roof. P( s, o, y ) is the gate's frame, n its outward.
	_stairTower( P, s, o, n ) {

		const W = 10, D = 7, top = LEVELS.terraceConcourse + 3.2;
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
				// the bank's emblem (2006 on): the daisy wheel, four arrows of three stacked bars pointing in
				// round a small square
				const ex = 110, ey = H / 2, R = 92;
				ctx.fillStyle = '#1e8c64';
				for ( let k = 0; k < 4; k ++ ) {

					ctx.save();
					ctx.translate( ex, ey );
					ctx.rotate( k * Math.PI / 2 );
					for ( let b = 0; b < 3; b ++ ) {

						const r0 = R * ( 0.28 + b * 0.25 ), len = R * ( 0.3 + b * 0.36 );
						ctx.fillRect( - len / 2, - r0 - R * 0.16, len, R * 0.16 );

					}

					ctx.restore();

				}

				ctx.font = '600 180px "Gill Sans", "Trebuchet MS", "Helvetica Neue", sans-serif';
				ctx.textBaseline = 'middle';
				ctx.lineWidth = 8;
				ctx.strokeStyle = '#0f6b47';
				ctx.strokeText( 'Citizens Bank Park', 230, H / 2 + 8, W - 250 );
				ctx.fillStyle = '#1e8c64';
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
		// on a truss between the towers, level with the roof
		const sy = LEVELS.roof - 1.0, sw = len - 17;
		this._wordmark( P, flip, sw, sy + 0.9, 0.4, [ nx, nz ] );
		const tq = new Quads();
		const hs = len / 2 - 4;
		for ( const yy of [ sy, sy + 0.9 ] ) for ( const oo of [ - 0.6, 0.6 ] ) beam( tq, P( - hs, oo, yy ), P( hs, oo, yy ), 0.18 );
		for ( let k = 0; k <= 12; k ++ ) {

			const ss = - hs + 2 * hs * k / 12;
			beam( tq, P( ss, - 0.6, sy ), P( ss, - 0.6, sy + 0.9 ), 0.1 );
			beam( tq, P( ss, 0.6, sy ), P( ss, 0.6, sy + 0.9 ), 0.1 );
			if ( k < 12 ) beam( tq, P( ss, 0.6, sy ), P( ss + 2 * hs / 12, 0.6, sy + 0.9 ), 0.08 );

		}

		const tm = new Mesh( tq.geometry(), this.gateSteel );
		tm.name = 'gate-sign-truss';
		tm.castShadow = true;
		this.group.add( tm );

		// more on the roof's back edge behind home plate and behind first base, facing out
		const rb = bowl.roofBack;
		if ( ! rb ) return;
		for ( const target of [ [ 0, 60 ], [ 70, 20 ] ] ) {

			// the roof's back edge segment nearest the target
			let best = null;
			for ( let i = 0; i < rb.line.length - 1; i ++ ) {

				const A = rb.line[ i ], B = rb.line[ i + 1 ], m = lerp2( A, B, 0.5 );
				const d = segLen( m, target );
				if ( ! best || d < best.d ) best = { d, A, B, m };

			}

			const { A, B, m } = best;
			const l = segLen( A, B ), vx = ( B[ 0 ] - A[ 0 ] ) / l, vz = ( B[ 1 ] - A[ 1 ] ) / l;
			let ox = - vz, oz = vx;
			if ( ox * m[ 0 ] + oz * ( m[ 1 ] + 40 ) < 0 ) {

				ox = - ox; oz = - oz;

			}

			const Q = ( s, o, y ) => [ m[ 0 ] + vx * s + ox * o, y, m[ 1 ] + vz * s + oz * o ];
			this._wordmark( Q, ( vx * oz - vz * ox ) < 0, Math.min( 26, l - 4 ), rb.y + 0.4, - 1.5, [ ox, oz ] );

		}

	}

	// ---------------------------------------------------------------- statues

	_buildStatues() {

		const at = ( name ) => ( STATUES[ name ] || [] )[ 0 ];
		// the Mike Schmidt statue at the Third Base Gate, Robin Roberts at First Base, Steve Carlton at Left Field
		// Frudakis's bronzes (2004): Schmidt in his home run follow-through, head up; Roberts mid-windup;
		// Carlton in his high leg kick; Connie Mack standing, his scorecard raised
		const schmidt = M.swing( 0.5 );
		schmidt.head = [ - 0.35, 0.5 ];
		const mack = neutralPose();
		mack.glove = false;
		mack.handR = [ 0.3, 1.75, - 0.15 ];
		const list = [
			[ 'Mike Schmidt', schmidt, 'MIKE SCHMIDT', '1972 - 1989', [] ],
			[ 'Robin Roberts', M.delivery( 0.22 ), 'ROBIN ROBERTS', '1948 - 1961', [ PART.bat ] ],
			[ 'Steve Carlton', M.delivery( 0.4 ), 'STEVE CARLTON', '1972 - 1986', [ PART.bat ] ],
			[ 'Connie Mack', mack, 'CONNIE MACK', '1901 - 1950', [ PART.bat, PART.glove ] ],
		];
		for ( const [ name, pose, label, years, drop ] of list ) {

			const p = at( name );
			if ( p ) this._statue( p[ 0 ], p[ 1 ], pose, label, years, drop, name === 'Steve Carlton' ? 'R' : 'L' );

		}

		// the 19 ft Liberty Bell that stood on top of Veterans Stadium, in the plaza by the gate
		this._bell( - 116, 40 );

	}

	// a bronze figure (the players' own body, posed and baked) on a polished granite pedestal with its
	// engraved plate, facing the stadium
	_statue( x, z, pose, label, years, drop, gloveHand ) {

		const g = new Group();
		g.position.set( x, STREET, z );
		if ( ! this.pedestal ) {

			this.pedestal = standard( { name: 'statue-granite', color: new Color( 0.11, 0.035, 0.03 ), roughness: 0.22, metalness: 0.1 } );
			this.statueBronze = standard( { name: 'statue-bronze', color: new Color( 0.2, 0.12, 0.05 ), roughness: 0.35, metalness: 0.9, modules: [ commonModule ],
				surface: '// patina: dark in the hollows, a touch of verdigris\n	let n = mx_noise_float3( in.P * 2.5 ) * 0.5 + 0.5;\n	s.albedo = mix( mat.color, vec3f( 0.06, 0.1, 0.07 ), smoothstep( 0.7, 0.95, n ) * 0.5 ) * ( 0.8 + 0.3 * mx_noise_float3( in.P * 9.0 ) );' } );
			for ( const m of [ this.pedestal, this.statueBronze ] ) m.underwaterLighting = 'none';

		}

		const ped = new Mesh( new BoxGeometry( 3.0, 1.2, 3.0 ), this.pedestal );
		ped.position.y = 0.6;
		ped.castShadow = true;
		ped.receiveShadow = true;
		g.add( ped );
		// the plate: the name and the years cut into the granite, gilded
		const plate = canvasTexture( 512, 192, ( ctx, w, h ) => {

			ctx.fillStyle = '#2a1512';
			ctx.fillRect( 0, 0, w, h );
			ctx.fillStyle = '#c9a44a';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.font = '700 56px Georgia, serif';
			ctx.fillText( label, w / 2, h * 0.4, w - 30 );
			ctx.font = '500 36px Georgia, serif';
			ctx.fillText( years, w / 2, h * 0.75 );

		}, 'statuePlate' );
		const pm = standard( { name: 'statue-plate', roughness: 0.3, metalness: 0.4, textures: { bpPlate: plate }, surface: 's.albedo = textureSample( bpPlate, smpAnisoClamp, in.uv ).rgb;' } );
		pm.underwaterLighting = 'none';
		const pq = new Quads();
		pq.tri( [ 1.0, 0.2, - 1.505 ], [ - 1.0, 0.2, - 1.505 ], [ - 1.0, 0.95, - 1.505 ], [ 0, 0, - 1 ], [ 0, 1 ], [ 1, 1 ], [ 1, 0 ] );
		pq.tri( [ 1.0, 0.2, - 1.505 ], [ - 1.0, 0.95, - 1.505 ], [ 1.0, 0.95, - 1.505 ], [ 0, 0, - 1 ], [ 0, 1 ], [ 1, 0 ], [ 0, 0 ] );
		g.add( new Mesh( pq.geometry(), pm ) );
		const fig = new Mesh( bakePose( pose, { gloveHand, drop } ), this.statueBronze );
		fig.position.y = 1.2;
		fig.scale.setScalar( 1.65 ); // 10 ft
		fig.castShadow = true;
		fig.receiveShadow = true;
		g.add( fig );
		// face the stadium's middle
		g.rotation.y = Math.atan2( - ( 4 - x ), - ( - 31 - z ) ) + Math.PI;
		this.group.add( g );
		const w = this.field.toWorld( x, z );
		this.colliders.addBox( new Vector3( w.x, this.field.y0 + STREET + 0.6, w.z ), new Vector3( 1.5, 0.6, 1.5 ), this.field.group.rotation.y + g.rotation.y, { tag: 'statue', walkable: true } );

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
