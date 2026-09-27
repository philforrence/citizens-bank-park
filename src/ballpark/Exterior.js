import { Group, Mesh, BoxGeometry, CylinderGeometry, ConeGeometry, SphereGeometry, LatheGeometry, Vector2, Vector3, Vector4, Color, Quaternion } from '../engine/index.js';
import { commonModule } from '../engine/render/wgsl/common.js';
import { StorageBuffer } from '../engine/gpu/Texture.js';
import { standard } from '../materials/Materials.js';
import { Quads } from './Stands.js';
import { flatPolygon, offsetLoop, canvasTexture, segLen, lerp2, beam, box } from './geo.js';
import { FOOTPRINT, LEVELS } from './layout.js';
import { STATUES } from './data/surroundings.js';
import { bakePose, neutralPose, PART } from './game/Rig.js';
import { frontagesModule, FRONT } from './Frontages.js';
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
	{ name: 'THIRD BASE GATE', at: [ - 80.95, 32.03 ], width: 30, open: 56, frame: true, leaves: 'open' }, // W1: its leaves open (gate3b)
	{ name: 'FIRST BASE GATE', at: [ 73.5, 25.48 ], width: 30, open: 56, frame: true, leaves: 'open' }, // ---- C: open for the game too (concourse1b)
	{ name: 'LEFT FIELD GATE', at: [ - 103.86, - 135.3 ], width: 28 },
	// behind home plate, the private entrance to the suites and the clubs (there was no Home Plate Gate)
	{ name: 'SUITE & CLUB ENTRANCE', at: [ 0, 91.53 ], width: 12, suite: true, lintel: 6.2 },
	{ name: 'RIGHT FIELD GATE', at: [ 112, - 153.03 ], width: 24 },
];

// The other two Suite & Club Entrances (the 2004 and 2007 guides: "Pattison Avenue (Home Plate),
// Citizens Bank Way (West) and Darien Street (East)"): doors in the facade, not gates
export const SUITE_ENTRANCES = [
	{ name: 'SUITE & CLUB ENTRANCE ★ WEST', at: [ - 126.05, - 12 ], width: 10, suite: true },
	{ name: 'SUITE & CLUB ENTRANCE ★ EAST', at: [ 126.94, 22 ], width: 10, suite: true },
];

// the paved plaza in the notch at the south-west corner, in front of the Third Base Gate
const PLAZA_3B = [
	[ - 71.64, 87.87 ], [ - 71.86, 62.51 ], [ - 61.04, 62.24 ], [ - 66.02, 57.38 ], [ - 59.89, 51.24 ], [ - 64.03, 46.95 ],
	[ - 70.79, 53.68 ], [ - 72.07, 52.43 ], [ - 75.17, 49.44 ], [ - 69.22, 43.57 ], [ - 92.68, 20.48 ], [ - 98.62, 26.33 ],
	[ - 103.51, 21.94 ], [ - 97.57, 16.08 ], [ - 102.9, 10.56 ], [ - 108.46, 15.88 ], [ - 113.12, 11.45 ], [ - 125.78, 11.78 ],
	[ - 133, 11.8 ], [ - 133, 98 ], [ - 71.6, 98 ],
];

// The named frontages in the facade's ground storey (Frontages.js): a point on the footprint's edge and
// the length of the front there
const FRONTAGES = [
	// ---- W1 (Third Base Gate): the Majestic Clubhouse Store is the glass corner pavilion just left of the
	// gate as you face it from the plaza, the gate's fence running on from it; McFadden's is the building
	// on the right, its name lit yellow (Getty, 25 and 27 Oct 2008: "fans stand outside the team store";
	// "fans stand outside of Citizens Bank Park in the rain"). Round 1 had them the other way round. The
	// store's canopy, banners and its curved sign are the gate3b place's.
	{ at: [ - 95.65, 23.4 ], len: 7.6, kind: FRONT.store },
	{ at: [ - 101.07, 24.14 ], len: 6.0, kind: FRONT.store },
	{ at: [ - 71.75, 75 ], len: 23, kind: FRONT.saloon },
	// ---- end W1
	// ticket windows (the Commons photo of 29 Mar 2008): on Pattison Avenue between the plaza and home
	// plate, and by the First Base Gate
	{ at: [ - 36, 91.54 ], len: 14, kind: FRONT.tickets, first: 1 },
	{ at: [ 56.8, 42.62 ], len: 11, kind: FRONT.tickets, first: 20 },
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
		this._frontSigns();
		for ( const g of [ ...GATES, ...SUITE_ENTRANCES ] ) if ( g.suite ) this._suiteEntrance( g );
		else this._buildGate( g );
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

		this.frontBuffer = new StorageBuffer( { label: 'facadeFronts', count: 16, type: 'vec4f' } );
		this.brick = standard( {
			name: 'facade-brick', color: new Color( 0.24, 0.065, 0.038 ), roughness: 0.85, modules: [ commonModule, frontagesModule ],
			uniforms: { frontN: [ 'f32', 0 ] },
			storage: { facFronts: this.frontBuffer },
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
	// the named frontages (Frontages.js): the ticket windows, the Majestic Clubhouse Store, McFadden's
	var fk = 0.0; var fx = 0.0; var flen = 0.0; var ffirst = 0.0;
	for ( var i = 0u; i < u32( mat.frontN ); i ++ ) {
		let f = facFronts[ i ];
		if ( u >= f.x && u <= f.y ) { fk = f.z; fx = f.y - u; flen = f.y - f.x; ffirst = f.w; }
	}
	let rd = fzRay( in.P, normalize( in.N ) );
	// elsewhere, what fills each bay: mostly plain granite, now and then a steel service door or a dark
	// glass bay onto the back of house
	let kind = fract( sin( bayId * 12.9898 ) * 43758.5453 );
	if ( fk > 0.5 ) {
		var fz = FzOut( c, e, rough, 0.0 );
		if ( fk < 1.5 ) { fz = fzStore( fx, v, flen, rd, night, false, fz ); }
		else if ( fk < 2.5 ) { fz = fzSaloon( fx, v, flen, rd, night, fz ); }
		else { fz = fzTickets( fx, v, flen, ffirst, rd, night, fz ); }
		c = fz.c; e = fz.e; rough = fz.r;
	} else {
		if ( kind < 0.14 && abs( bay - 4.25 ) < 0.9 && v < 2.5 ) {
			c = vec3f( 0.1, 0.03, 0.03 ) * ( 0.9 + 0.1 * step( 0.5, fract( v / 0.5 ) ) ); rough = 0.5;
			if ( abs( bay - 4.25 ) > 0.84 || v > 2.44 ) { c = vec3f( 0.05, 0.02, 0.02 ); }
		}
		if ( bay > 1.3 && bay < 7.2 && v > 0.9 && v < 4.7 && kind > 0.62 ) {
			// dark glass on bronze-maroon mullions, 1.5 m grid; a few lights on inside after dark
			let ou = bay - 1.3;
			let mu = step( abs( fract( ou / 1.475 ) - 0.5 ), 0.035 ) + step( abs( fract( ( v - 0.9 ) / 1.27 ) - 0.5 ), 0.035 );
			c = mix( vec3f( 0.035, 0.045, 0.055 ), vec3f( 0.042, 0.016, 0.018 ), clamp( mu, 0.0, 1.0 ) );
			rough = mix( 0.05, 0.4, clamp( mu, 0.0, 1.0 ) );
			let back = fzRoom( vec3f( - ou, v, 0.0 ), rd, - 6.4, 0.5, 0.0, 4.2, 3.0 );
			let lamp = select( 0.0, 1.0, back.w == 2.0 && abs( fract( back.x / 2.4 ) - 0.5 ) < 0.2 && abs( back.z - 1.5 ) < 0.08 );
			let room = select( vec3f( 0.25, 0.24, 0.22 ), vec3f( 0.12 ), back.w == 1.0 ) * ( 1.0 - 0.5 * back.z / 3.0 );
			e = ( room + vec3f( 3.0 ) * lamp ) * vec3f( 1.0, 0.95, 0.85 ) * ( 1.0 - clamp( mu, 0.0, 1.0 ) ) * mix( 0.01, 0.12, night ) * step( 0.8, kind );
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
		// PHILADELPHIA in buff brick across the second storey behind home plate (baseballparks.com, 2004:
		// "the word PHILADELPHIA is spelled out in contrasting colored bricks across the second story"),
		// a mask the brick bond samples brick by brick
		const philaTex = canvasTexture( 2048, 256, ( ctx, w, h ) => {

			ctx.fillStyle = '#000';
			ctx.fillRect( 0, 0, w, h );
			ctx.fillStyle = '#fff';
			ctx.font = '700 230px "Arial Narrow", "Helvetica Neue", Helvetica, Arial, sans-serif';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText( 'PHILADELPHIA', w / 2, h / 2 + 10, w - 40 );

		}, 'philadelphia' );
		this.brickUpper = standard( {
			name: 'facade-upper', color: new Color( 0.24, 0.065, 0.038 ), roughness: 0.85, modules: [ commonModule, frontagesModule ],
			uniforms: { frontN: [ 'f32', 0 ], phila: [ 'vec4f', new Vector4( 0, 0, 0, 0 ) ] },
			storage: { facFronts: this.frontBuffer },
			textures: { philaTex },
			surface: /* wgsl */`
	let u = in.uv.x; let v = in.uv.y - ${ ( STREET + FACADE ).toFixed( 4 ) };
	let row = floor( v / 0.075 );
	let bu = u / 0.2 + 0.5 * ( row % 2.0 );
	let fr = clamp( fwidth( v ) / 0.075 * 1.5 - 0.25, 0.0, 1.0 );
	let fb = clamp( fwidth( bu ) * 1.5 - 0.25, 0.0, 1.0 );
	let mortar = clamp( mix( step( 0.88, fract( v / 0.075 ) ), 0.12, fr ) + mix( step( 0.93, fract( bu ) ), 0.07, max( fb, fr ) ), 0.0, 1.0 );
	let tone = mix( 0.82 + 0.3 * fract( sin( dot( vec2f( floor( bu ), row ), vec2f( 12.9898, 78.233 ) ) ) * 43758.5453 ), 0.97, max( fr, fb ) );
	// the lettering: each brick takes the mask at its own middle, so the letters' edges follow the bond
	let ph = mat.phila;
	let bc = vec2f( ( floor( bu ) + 0.5 - 0.5 * ( row % 2.0 ) ) * 0.2, ( row + 0.5 ) * 0.075 );
	let pt = vec2f( ( ph.x - bc.x ) / ( ph.x - ph.y + 1e-4 ), 1.0 - ( bc.y - ph.z ) / ( ph.w - ph.z + 1e-4 ) );
	let inPh = pt.x > 0.0 && pt.x < 1.0 && pt.y > 0.0 && pt.y < 1.0;
	let letter = textureSampleLevel( philaTex, smpLinearClamp, clamp( pt, vec2f( 0.0 ), vec2f( 1.0 ) ), 0.0 ).r * select( 0.0, 1.0, inPh );
	let brickC = mix( mat.color, vec3f( 0.46, 0.33, 0.19 ), step( 0.5, letter ) * ( 1.0 - max( fr, fb ) * 0.5 ) );
	var c = mix( brickC * tone, vec3f( 0.42, 0.4, 0.36 ), mortar * 0.8 );
	var rough = 0.85;
	let fl = fract( v / 3.6 ) * 3.6;
	// big blank planes of brick: windows only in tall dark-glass slots, one every 7.5 m, a soldier course
	// at each floor (none through the lettering)
	let bay = fract( u / 7.5 ) * 7.5 - 3.75;
	let phBand = u < max( ph.x, ph.y ) + 1.0 && u > min( ph.x, ph.y ) - 1.0 && v < ph.w + 0.6;
	let win = abs( bay ) < 0.45 && v > 0.9 && ! phBand;
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
	// the Majestic Clubhouse Store's upper storey, the Phanatic Attic
	var fk = 0.0; var fx = 0.0; var flen = 0.0;
	for ( var i = 0u; i < u32( mat.frontN ); i ++ ) {
		let f = facFronts[ i ];
		if ( u >= f.x && u <= f.y ) { fk = f.z; fx = f.y - u; flen = f.y - f.x; }
	}
	if ( fk > 0.5 && fk < 1.5 ) {
		let fz = fzStore( fx, v, flen, fzRay( in.P, normalize( in.N ) ), smoothstep( 0.1, 0.7, frame.night ), true, FzOut( c, e, rough, 0.0 ) );
		c = fz.c; e = fz.e; rough = fz.r;
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
	// ---- W1 (Third Base Gate): the rain on the water: rings spreading from each drop on the puddles, a
	// pinprick splash where one lands (while it's raining, the 27th; on the 29th it's only drying)
	let raining = smoothstep( 0.35, 0.6, wet ) * ( 1.0 - far );
	var rip = 0.0; var splash = 0.0;
	if ( raining > 0.0 ) {
		for ( var k = 0; k < 2; k ++ ) {
			let sc = select( 0.37, 0.23, k == 1 );
			let q = p / sc + vec2f( f32( k ) * 17.3 );
			let id = floor( q );
			let hh = fract( sin( vec3f( dot( id, vec2f( 12.9898, 78.233 ) ), dot( id, vec2f( 39.35, 11.13 ) ), dot( id, vec2f( 73.1, 52.7 ) ) ) ) * 43758.5453 );
			let ctr = hh.xy * 0.5 + 0.25;
			let ph = fract( frame.time * ( 0.8 + 0.7 * hh.z ) + hh.x * 7.0 );
			let d = length( fract( q ) - ctr ) * sc;
			let r = ph * 0.085;
			rip += sin( ( d - r ) * 170.0 ) * exp( - abs( d - r ) * 70.0 ) * ( 1.0 - ph );
			splash += ( 1.0 - smoothstep( 0.003, 0.01, d ) ) * step( ph, 0.07 );
		}
	}
	rip *= raining;
	splash *= raining;
	c = c + vec3f( 0.05 ) * max( rip, 0.0 ) * puddle + vec3f( 0.2 ) * splash;
	rough = rough + abs( rip ) * 0.1 * puddle;
	// ---- end W1
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
	s.emissive = refl * wet * mix( 0.3, 1.0, puddle ) * ( 1.0 + 0.9 * rip * puddle ) * smoothstep( 0.1, 0.7, frame.night ); // (W1: the rings break the streaks up)
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
		// the park's pole lights round the plaza (their light: lampSources()): silver-grey round poles,
		// the tall ones (9 m) with three maroon bell shades on arms, the pedestrian ones (4.5 m) with a flat
		// disc head; full cut-off, the light only from the lens underneath
		this.lamps = [];
		const pole = standard( { name: 'lamp-pole', color: new Color( 0.27, 0.28, 0.29 ), roughness: 0.4, metalness: 0.7 } );
		const shade = standard( { name: 'lamp-shade', color: new Color( 0.1, 0.03, 0.03 ), roughness: 0.45, metalness: 0.4 } );
		const lens = standard( { name: 'lamp-lens', color: new Color( 0.9, 0.87, 0.8 ), roughness: 0.3,
			surface: 's.emissive = vec3f( 1.0, 0.82, 0.58 ) * mix( 0.2, 30.0, smoothstep( 0.1, 0.7, frame.night ) ) * step( in.N.y, -0.5 );' } );
		for ( const mm of [ pole, shade, lens ] ) mm.underwaterLighting = 'none';
		const bellGeo = new LatheGeometry( [ new Vector2( 0.02, 0.32 ), new Vector2( 0.12, 0.3 ), new Vector2( 0.2, 0.18 ), new Vector2( 0.3, 0.04 ), new Vector2( 0.34, 0.0 ) ], 14 );
		const lensGeo = new CylinderGeometry( 0.3, 0.3, 0.02, 14 );
		const discGeo = new CylinderGeometry( 0.36, 0.36, 0.08, 18 );
		[ [ - 122, 88 ], [ - 104, 88 ], [ - 86, 88 ], [ - 123, 64 ], [ - 123, 40 ], [ - 110, 30 ], [ - 92, 52 ], [ - 76, 76 ], [ - 60, 30 ], [ - 100, 4 ] ].forEach( ( [ x, z ], i ) => {

			const tall = i % 3 !== 2, H = tall ? 9 : 4.5;
			const pl = new Mesh( new CylinderGeometry( tall ? 0.09 : 0.07, tall ? 0.14 : 0.1, H, 10 ), pole );
			pl.position.set( x, STREET + H / 2, z );
			pl.castShadow = true;
			this.group.add( pl );
			if ( tall ) {

				// ---- W1 (Third Base Gate): the tall poles' heads as in the photos of 2007-08 (Flickr u2rob April
				// 2008, pingnews 2007; Getty Oct 2008): four maroon drum floodlights on a crosshead, each aimed out
				// and down, and a flat round "saucer" light halfway up the pole
				const y = STREET + H - 0.35;
				const cross = new Mesh( new CylinderGeometry( 0.05, 0.05, 1.0, 6 ), pole );
				cross.position.set( x, y + 0.12, z );
				cross.rotation.set( 0, 0.4, Math.PI / 2 );
				this.group.add( cross );
				const cross2 = new Mesh( new CylinderGeometry( 0.05, 0.05, 1.0, 6 ), pole );
				cross2.position.set( x, y + 0.12, z );
				cross2.rotation.set( 0, 0.4 + Math.PI / 2, Math.PI / 2 );
				this.group.add( cross2 );
				const drumGeo = new CylinderGeometry( 0.17, 0.2, 0.46, 14 ), faceGeo = new CylinderGeometry( 0.165, 0.165, 0.02, 14 );
				for ( let k = 0; k < 4; k ++ ) {

					// aimed out along its arm and 40 degrees down: the drum's axis
					const a = k * Math.PI / 2 + 0.4, tilt = 0.7;
					const dir = new Vector3( Math.cos( a ) * Math.cos( tilt ), - Math.sin( tilt ), Math.sin( a ) * Math.cos( tilt ) );
					const c = new Vector3( x + Math.cos( a ) * 0.48, y, z + Math.sin( a ) * 0.48 );
					const q = new Quaternion().setFromUnitVectors( new Vector3( 0, - 1, 0 ), dir );
					const b = new Mesh( drumGeo, shade );
					b.position.copy( c );
					b.quaternion.copy( q );
					this.group.add( b );
					const l = new Mesh( faceGeo, lens );
					l.position.copy( c ).addScaledVector( dir, 0.235 );
					l.quaternion.copy( q );
					this.group.add( l );

				}

				// the saucer halfway up, on a short bracket
				const sd = new Mesh( discGeo, lens );
				sd.position.set( x + 0.35, STREET + 4.6, z );
				this.group.add( sd );
				const br = new Mesh( new CylinderGeometry( 0.025, 0.025, 0.35, 5 ), pole );
				br.position.set( x + 0.17, STREET + 4.68, z );
				br.rotation.set( 0, 0, Math.PI / 2 );
				this.group.add( br );
				// ---- end W1

				this.lamps.push( [ x, STREET + H - 0.65, z, 1 ] );

			} else {

				const d = new Mesh( discGeo, lens );
				d.position.set( x, STREET + H + 0.04, z );
				this.group.add( d );
				this.lamps.push( [ x, STREET + H - 0.02, z, 0 ] );

			}

			this.reflect.push( [ x, STREET + H - 0.6, z, 1.0, 0.72, 0.42, tall ? 7.0 : 4.0 ] );
			const w = this.field.toWorld( x, z );
			this.colliders.addCylinder( w.x, w.z, 0.15, this.field.y0 + STREET, this.field.y0 + STREET + H );

		} );

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

			this._tree( x, z, trunk, leaves ); // (W1: its grate is the gate3b place's)

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

	_tree( x, z ) {

		// ---- W1 (Third Base Gate): the trees themselves (and their grates) are grown by the gate3b place
		// (places/gate3b/Trees.js: branches and leaves, not spheres); here only the spot and the collider
		( this.treeSpots ||= [] ).push( [ x, z ] );
		// ---- end W1
		const w = this.field.toWorld( x, z );
		this.colliders.addCylinder( w.x, w.z, 0.3, this.field.y0 + STREET, this.field.y0 + STREET + 3 );

	}

	// the plaza's lamps as point lights (world frame), for LocalLights
	lampSources() {

		return ( this.lamps || [] ).map( ( [ x, y, z, tall ] ) => {

			const w = this.field.toWorld( x, z );
			return { position: new Vector3( w.x, this.field.y0 + y, w.z ), tall: !! tall };

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
		this.fronts = [];
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
			for ( const g of [ ...GATES, ...SUITE_ENTRANCES ] ) {

				const t = ( ( g.at[ 0 ] - a[ 0 ] ) * ux + ( g.at[ 1 ] - a[ 1 ] ) * uz );
				const off = Math.abs( ( g.at[ 0 ] - a[ 0 ] ) * nx + ( g.at[ 1 ] - a[ 1 ] ) * nz );
				if ( t > 0 && t < len && off < 1.0 ) {

					const hw = ( g.open || g.width ) / 2;
					cuts.push( [ Math.max( 0, t - hw ), Math.min( len, t + hw ) ] );
					g.edge = { a, ux, uz, nx, nz, t, H: heightOf( g.at, g.at ), u: u + t };

				}

			}

			// the named frontages along this edge
			for ( const f of FRONTAGES ) {

				const tf = ( f.at[ 0 ] - a[ 0 ] ) * ux + ( f.at[ 1 ] - a[ 1 ] ) * uz;
				const off = Math.abs( ( f.at[ 0 ] - a[ 0 ] ) * nx + ( f.at[ 1 ] - a[ 1 ] ) * nz );
				if ( tf > 0 && tf < len && off < 1.0 ) {

					const t0 = Math.max( 0, tf - f.len / 2 ), t1 = Math.min( len, tf + f.len / 2 );
					this.fronts.push( [ u + t0, u + t1, f.kind, f.first || 0 ] );
					f.edge = { a, ux, uz, nx, nz, t: tf, t0, t1 };

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

		// the frontages into the shaders; PHILADELPHIA 19 m wide over the Suite & Club Entrance (u runs to
		// the right as you face the wall: its left end is the larger u)
		const fb = new Float32Array( 16 * 4 );
		this.fronts.slice( 0, 16 ).forEach( ( r, i ) => fb.set( r, i * 4 ) );
		this.frontBuffer.write( fb );
		for ( const m of [ this.brick, this.brickUpper ] ) m.uniforms.frontN.value = Math.min( 16, this.fronts.length );
		const hp = GATES[ 3 ].edge;
		if ( hp ) this.brickUpper.uniforms.phila.value.set( hp.u + 9.5, hp.u - 9.5, 0.75, 2.95 );
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

		// ---- W1 (Third Base Gate): a gate open for the game (g.leaves: 'open') has its leaves folded out
		// into fins and its turnstiles a few metres inside (the NLDS photo of 2 Oct 2008); the gate3b place
		// builds those from the lanes (their bays); here only the posts
		const shut = g.leaves !== 'open';
		// ---- end W1
		for ( let k = 0; k < n; k ++ ) {

			const a = s0 + k * BAY, l0 = a + ( BAY - LANE ) / 2, l1 = l0 + LANE, b = a + BAY;
			// maroon posts between the bays
			beam( post, P( a, 0, y0 ), P( a, 0, y0 + H + 0.1 ), 0.14 );
			if ( ! shut ) {

				( this.lanes ||= [] ).push( { at: P( l1 + 0.35, - 0.8, y0 ), entry: P( ( l0 + l1 ) / 2, 1.5, y0 ), face: [ nx, nz ], gate: g.name, bay: [ a, b ], open: true } );
				if ( k === n - 1 ) beam( post, P( b, 0, y0 ), P( b, 0, y0 + H + 0.1 ), 0.14 );
				continue;

			}

			// mesh either side of the lane, and over it above head height
			mesh( a, l0, 0, H );
			mesh( l1, b, 0, H );
			mesh( l0, l1, 2.3, H );
			// a baseball on the fixed panel of every other bay
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
			// a ticket taker by each lane's scanner, inside, facing out; the way in through the lane
			( this.lanes ||= [] ).push( { at: P( l1 + 0.35, - 0.8, y0 ), entry: P( ( l0 + l1 ) / 2, 1.5, y0 ), face: [ nx, nz ], gate: g.name } );
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
		// security either side of the gate line, just inside
		for ( const e of [ - 1, 1 ] ) ( this.gateGuards ||= [] ).push( { at: P( e * ( W / 2 - 1.2 ), - 1.6, y0 ), face: [ nx, nz ] } );
		const bm = new Mesh( bq.geometry(), fence );
		bm.name = 'gate-mesh';
		bm.castShadow = true;
		this.group.add( bm );
		const disc = this.discMat || ( this.discMat = standard( { name: 'gate-disc', color: new Color( 0.85, 0.85, 0.82 ), roughness: 0.5 } ) );
		disc.underwaterLighting = 'none';
		if ( dq.count ) this.group.add( new Mesh( dq.geometry(), disc ) ); // (W1: none at an open gate)
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

	// The frontages' signs: MAJESTIC CLUBHOUSE STORE in red channel letters over the store, McFadden's green
	// crest over the saloon, TICKETS in red channel letters (navy returns, as in the Commons photo) over the
	// ticket windows with the cream "Phillies TICKET SALES" blade sign at their end
	_frontSigns() {

		for ( const f of FRONTAGES ) {

			if ( ! f.edge ) continue;
			const { a, ux, uz, nx, nz, t, t0, t1 } = f.edge;
			const P = ( s, o, y ) => [ a[ 0 ] + ux * ( t + s ) + nx * o, y, a[ 1 ] + uz * ( t + s ) + nz * o ];
			const tu = nz * ux - nx * uz;
			const mid = ( t0 + t1 ) / 2 - t;
			const Q = ( s, o, y ) => P( s + mid, o, y );
			if ( f.kind === FRONT.store ) {

				// (W1: the store's sign is the curved navy band round its corner, the gate3b place's)

			} else if ( f.kind === FRONT.tickets ) {

				this._channelLetters( Q, 'TICKETS', 0.1, STREET + 3.55, [ nx, nz ], tu, { faceC: [ 0.55, 0.02, 0.03 ], glowC: [ 1.0, 0.1, 0.08 ], h: 0.72 } );
				// the blade sign at the left end (as you face the windows)
				const sb = ( tu > 0 ? t0 : t1 ) - t + ( tu > 0 ? 0.35 : - 0.35 );
				this._bladeSign( P, sb, STREET + 4.3, [ nx, nz ] );

			} else if ( f.kind === FRONT.saloon ) {

				// ---- W1 (Third Base Gate): McFADDEN'S in channel letters lit yellow over the glass (Getty, 25
				// Oct 2008), in place of the green crest
				this._channelLetters( Q, 'McFADDEN’S', 0.1, STREET + 5.45, [ nx, nz ], tu, { faceC: [ 0.62, 0.45, 0.08 ], retC: [ 0.03, 0.025, 0.02 ], glowC: [ 1.0, 0.72, 0.16 ], h: 0.9 } );
				if ( this.reflect ) this.reflect.push( [ ...Q( 0, 0.3, STREET + 5.9 ), 1.0, 0.75, 0.2, 1.4 ] );
				// ---- end W1

			}

		}

	}

	// "Phillies TICKET SALES": cream, a red border, on a steel bracket out from the wall
	_bladeSign( P, s, y, n ) {

		const tex = canvasTexture( 256, 320, ( ctx, w, h ) => {

			ctx.fillStyle = '#efe6d0';
			ctx.fillRect( 0, 0, w, h );
			ctx.strokeStyle = '#b3151f';
			ctx.lineWidth = 12;
			ctx.strokeRect( 10, 10, w - 20, h - 20 );
			ctx.lineWidth = 3;
			ctx.strokeRect( 24, 24, w - 48, h - 48 );
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillStyle = '#b3151f';
			ctx.font = 'italic 700 68px Georgia, "Times New Roman", serif';
			ctx.fillText( 'Phillies', w / 2, 100, w - 50 );
			ctx.fillStyle = '#1c2a4f';
			ctx.font = '700 44px "Arial Narrow", Helvetica, Arial, sans-serif';
			ctx.fillText( 'TICKET', w / 2, 190 );
			ctx.fillText( 'SALES', w / 2, 240 );

		}, 'bladeSign' );
		const m = standard( { name: 'blade-sign', roughness: 0.5, textures: { bsTex: tex },
			surface: 'let t = textureSample( bsTex, smpAnisoClamp, in.uv ).rgb; s.albedo = t; s.emissive = t * smoothstep( 0.1, 0.7, frame.night ) * 0.35;' } );
		m.underwaterLighting = 'none';
		const q = new Quads(), W = 0.95, H = 1.2, o0 = 0.35;
		// ---- W1 (Third Base Gate): a face each side (one double-sided face read backwards from behind),
		// the text running the right way on both: out from the wall where the viewer's right hand points out
		const e0 = P( s, 0, y ), e1 = P( s + 1, 0, y ), ux = e1[ 0 ] - e0[ 0 ], uz = e1[ 2 ] - e0[ 2 ];
		for ( const side of [ 1, - 1 ] ) {

			const out = side * ( uz * n[ 0 ] - ux * n[ 1 ] ) > 0, [ uA, uB ] = out ? [ 0, 1 ] : [ 1, 0 ];
			const S = s + side * 0.012, N = [ ux * side, 0, uz * side ];
			q.tri( P( S, o0, y ), P( S, o0 + W, y ), P( S, o0 + W, y + H ), N, [ uA, 1 ], [ uB, 1 ], [ uB, 0 ] );
			q.tri( P( S, o0, y ), P( S, o0 + W, y + H ), P( S, o0, y + H ), N, [ uA, 1 ], [ uB, 0 ], [ uA, 0 ] );

		}

		// ---- end W1
		this.group.add( new Mesh( q.geometry(), m ) );
		const b = new Quads();
		beam( b, P( s, 0, y + H + 0.08 ), P( s, o0 + W + 0.05, y + H + 0.08 ), 0.06 );
		beam( b, P( s, 0, y + 0.1 ), P( s, o0, y + 0.1 ), 0.05 );
		const bm = new Mesh( b.geometry(), this.gateSteel || ( this.gateSteel = standard( { name: 'gate-steel', color: new Color( 0.13, 0.035, 0.03 ), roughness: 0.55, metalness: 0.4 } ) ) );
		bm.castShadow = true;
		this.group.add( bm );

	}

	// McFadden's: a dark green crest with a cream rule, the name in cream serif capitals over
	// "Restaurant & Saloon" in script, lit by two gooseneck lamps
	_saloonSign( P, y, n, tu ) {

		const tex = canvasTexture( 1024, 600, ( ctx, w, h ) => {

			ctx.clearRect( 0, 0, w, h );
			const shield = ( inset ) => {

				ctx.beginPath();
				ctx.moveTo( 40 + inset, 30 + inset );
				ctx.lineTo( w - 40 - inset, 30 + inset );
				ctx.lineTo( w - 40 - inset, h * 0.62 );
				ctx.quadraticCurveTo( w - 60 - inset, h * 0.86, w / 2, h - 20 - inset );
				ctx.quadraticCurveTo( 60 + inset, h * 0.86, 40 + inset, h * 0.62 );
				ctx.closePath();

			};

			shield( 0 );
			ctx.fillStyle = '#0d3b24';
			ctx.fill();
			ctx.lineWidth = 10;
			ctx.strokeStyle = '#e8dcb8';
			shield( 22 );
			ctx.stroke();
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillStyle = '#efe3bf';
			ctx.font = '700 150px Georgia, "Times New Roman", serif';
			ctx.fillText( 'McFADDEN\u2019S', w / 2, 200, w - 140 );
			ctx.font = 'italic 400 92px "Snell Roundhand", "Apple Chancery", Georgia, serif';
			ctx.fillText( 'Restaurant & Saloon', w / 2, 350, w - 180 );
			ctx.fillRect( w * 0.3, 272, w * 0.4, 5 );

		}, 'saloonSign' );
		const m = standard( { name: 'saloon-sign', roughness: 0.45, alphaTest: 0.5, textures: { ssTex: tex },
			surface: 'let t = textureSample( ssTex, smpAnisoClamp, in.uv ); s.alpha = t.a; s.albedo = t.rgb; s.emissive = t.rgb * step( 0.6, t.r ) * smoothstep( 0.1, 0.7, frame.night ) * 0.9;' } );
		m.underwaterLighting = 'none';
		const W = 3.4, H = W * 600 / 1024, o = 0.12;
		const [ sL, sR ] = tu > 0 ? [ - W / 2, W / 2 ] : [ W / 2, - W / 2 ];
		const q = new Quads();
		q.tri( P( sL, o, y ), P( sR, o, y ), P( sR, o, y + H ), [ n[ 0 ], 0, n[ 1 ] ], [ 0, 1 ], [ 1, 1 ], [ 1, 0 ] );
		q.tri( P( sL, o, y ), P( sR, o, y + H ), P( sL, o, y + H ), [ n[ 0 ], 0, n[ 1 ] ], [ 0, 1 ], [ 1, 0 ], [ 0, 0 ] );
		const sm = new Mesh( q.geometry(), m );
		sm.name = 'mcfaddens-sign';
		this.group.add( sm );
		// the goosenecks
		const b = new Quads();
		for ( const e of [ - 1, 1 ] ) {

			beam( b, P( e * 1.1, 0, y + H + 0.3 ), P( e * 1.1, 0.7, y + H + 0.45 ), 0.05 );
			beam( b, P( e * 1.1, 0.7, y + H + 0.45 ), P( e * 1.1, 0.85, y + H + 0.25 ), 0.05 );
			box( b, P( e * 1.1, 0.88, y + H + 0.2 ), [ 0.28, 0.14, 0.28 ] );
			if ( this.reflect ) this.reflect.push( [ ...P( e * 1.1, 0.88, y + H + 0.12 ), 1.0, 0.8, 0.5, 1.2 ] );

		}

		const bm = new Mesh( b.geometry(), standard( { name: 'gooseneck', color: new Color( 0.01, 0.04, 0.02 ), roughness: 0.4, metalness: 0.6 } ) );
		bm.material.underwaterLighting = 'none';
		this.group.add( bm );

	}

	// A Suite & Club Entrance as in the Commons photo of 29 Mar 2008 (the West one): a glass wall in the
	// brick, glass doors between rose granite piers, a lit lobby behind (terrazzo, wood panelling, the
	// elevators), and over the doors a glass canopy on cream steel outriggers carrying the name in channel
	// letters: cream-pink faces, navy returns, lit after dark.
	_suiteEntrance( g ) {

		if ( ! g.edge ) return;
		const { a, ux, uz, nx, nz, t, H: HB } = g.edge;
		const W = g.width, y0 = STREET, half = W / 2;
		// behind home plate the glass is the lobby's height only, the brick (and its lettering) over it
		const H = g.lintel || HB;
		// s along the wall, o out from it; u runs along the wall's own tangent (for the lobby's parallax)
		const P = ( s, o, y ) => [ a[ 0 ] + ux * ( t + s ) + nx * o, y, a[ 1 ] + uz * ( t + s ) + nz * o ];
		const tu = nz * ux - nx * uz; // +1 if s runs along the tangent cross( up, n ), -1 if against it
		const glass = standard( {
			name: 'suite-glass', color: new Color( 0.03, 0.04, 0.05 ), roughness: 0.05, modules: [ commonModule ],
			uniforms: { half: [ 'f32', half ] },
			surface: /* wgsl */`
	// uv: x along the glass from its middle (m), y up from the street (m). The lobby (two storeys, to
	// 5.4 m) behind the doors, the suite level's corridors above it, traced into depth
	let u = in.uv.x; let v = in.uv.y;
	let hw = mat.half;
	let N = normalize( in.N );
	let T = normalize( cross( vec3f( 0.0, 1.0, 0.0 ), N ) );
	let Vd = normalize( in.P - frame.cameraPos );
	let night = smoothstep( 0.1, 0.7, frame.night );
	let lobby = v < 5.4;
	let k = floor( max( v - 6.2, 0.0 ) / 3.6 );
	let f0 = select( 6.2 + k * 3.6, 0.0, lobby );
	let f1 = select( f0 + 3.0, 5.4, lobby );
	let rd = vec3f( dot( Vd, T ), Vd.y, max( dot( Vd, - N ), 0.05 ) );
	let ro = vec3f( u, clamp( v, f0 + 0.01, f1 - 0.01 ), 0.0 );
	let D = select( 4.0, 8.0, lobby );
	let tx = ( select( - hw, hw, rd.x > 0.0 ) - ro.x ) / rd.x;
	let ty = ( select( f0, f1, rd.y > 0.0 ) - ro.y ) / rd.y;
	let tz = D / rd.z;
	let tt = min( tx, min( ty, tz ) );
	let hit = ro + rd * tt;
	var room = vec3f( 0.6, 0.55, 0.47 );
	if ( tt == tz ) {
		if ( lobby ) {
			// cherry panelling, two pairs of stainless elevator doors, a reception desk in front
			room = vec3f( 0.3, 0.13, 0.07 ) * ( 0.85 + 0.15 * step( 0.5, fract( hit.x / 0.9 ) ) );
			let ex = abs( fract( hit.x / 3.4 ) - 0.5 ) * 3.4;
			if ( ex < 0.55 && hit.y < 2.3 ) { room = vec3f( 0.5, 0.51, 0.53 ) * ( 0.75 + 0.25 * step( 0.015, ex ) ); }
			if ( hit.y > 3.2 && hit.y < 3.9 && abs( hit.x ) < 1.6 ) { room = vec3f( 0.75, 0.62, 0.3 ); }
		} else { room = room * 0.8; }
	}
	if ( tt == ty && rd.y < 0.0 ) {
		room = select( vec3f( 0.22, 0.07, 0.06 ) * ( 0.9 + 0.1 * mx_noise_float2( hit.xz * 3.0 ) ), vec3f( 0.52, 0.48, 0.42 ) * ( 0.92 + 0.12 * mx_noise_float2( hit.xz * 30.0 ) ), lobby );
	}
	var lamp = 0.0;
	if ( tt == ty && rd.y > 0.0 ) {
		let gc = abs( fract( hit.xz / 1.8 ) - 0.5 ) * 1.8;
		lamp = 1.0 - smoothstep( 0.07, 0.1, length( gc ) );
		room = vec3f( 0.8, 0.78, 0.74 );
	}
	// the desk
	let deskT = ( 4.5 - ro.z ) / rd.z;
	let deskP = ro + rd * deskT;
	if ( lobby && deskT < tt && abs( deskP.x ) < 2.2 && deskP.y < 1.1 && deskP.y > 0.0 ) { room = vec3f( 0.25, 0.1, 0.05 ); }
	// the light falls off away from the glass
	let inside = ( room + vec3f( 5.0, 4.4, 3.4 ) * lamp ) * vec3f( 1.0, 0.88, 0.72 ) * ( 1.0 - 0.4 * clamp( hit.z / D, 0.0, 1.0 ) );
	// the frame: bronze mullions every 1.5 m, the transom over the doors, spandrels at each slab
	let mu = abs( fract( u / 1.5 + 0.5 ) - 0.5 ) * 1.5;
	var frameK = step( mu, 0.045 ) + step( abs( v - 2.75 ), 0.06 ) + step( abs( v - 5.8 ), 0.4 );
	if ( ! lobby ) { frameK += step( 3.0, v - 6.2 - k * 3.6 ); }
	// the doors: stainless stiles and push bars
	let door = v < 2.7 && abs( u ) < 3.0;
	if ( door ) { let du = abs( fract( u / 1.5 ) - 0.5 ) * 1.5; frameK += step( 0.68, du ) + step( abs( v - 1.05 ), 0.03 ) * step( du, 0.62 ) * step( 0.1, du ); }
	let fk = clamp( frameK, 0.0, 1.0 );
	s.albedo = mix( vec3f( 0.03, 0.04, 0.05 ) + inside * 0.05 * ( 1.0 - night ), select( vec3f( 0.045, 0.018, 0.02 ), vec3f( 0.45, 0.46, 0.47 ), door ), fk );
	s.roughness = mix( 0.04, 0.4, fk );
	s.metalness = select( 0.0, 0.8, door && fk > 0.5 );
	s.emissive = inside * ( 1.0 - fk ) * mix( 0.05, 0.22, night );
`,
		} );
		glass.underwaterLighting = 'none';
		glass.setDefine( 'DRY', 1 );
		const gq = new Quads();
		const o0 = - 0.35;
		gq.tri( P( - half, o0, y0 ), P( half, o0, y0 ), P( half, o0, y0 + H ), [ nx, 0, nz ], [ - half * tu, 0 ], [ half * tu, 0 ], [ half * tu, H ] );
		gq.tri( P( - half, o0, y0 ), P( half, o0, y0 + H ), P( - half, o0, y0 + H ), [ nx, 0, nz ], [ - half * tu, 0 ], [ half * tu, H ], [ - half * tu, H ] );
		if ( g.lintel ) {

			// the brick over the glass, both faces, continuing the wall's u; its cap
			const bq = new Quads(), uq = new Quads(), cq = new Quads();
			const e0 = g.edge.u - half, e1 = g.edge.u + half, T = 0.8;
			bq.add( P( - half, 0, y0 + H ), P( half, 0, y0 + H ), P( half, 0, y0 + FACADE ), P( - half, 0, y0 + FACADE ), [ nx, 0, nz ], e0, e1 );
			bq.add( P( half, - T, y0 + H ), P( - half, - T, y0 + H ), P( - half, - T, y0 + FACADE ), P( half, - T, y0 + FACADE ), [ - nx, 0, - nz ], e1, e0 );
			bq.add( P( - half, 0, y0 + H ), P( half, 0, y0 + H ), P( half, - T, y0 + H ), P( - half, - T, y0 + H ), [ 0, - 1, 0 ] );
			uq.add( P( - half, 0, y0 + FACADE ), P( half, 0, y0 + FACADE ), P( half, 0, y0 + HB ), P( - half, 0, y0 + HB ), [ nx, 0, nz ], e0, e1 );
			uq.add( P( half, - T, y0 + FACADE ), P( - half, - T, y0 + FACADE ), P( - half, - T, y0 + HB ), P( half, - T, y0 + HB ), [ - nx, 0, - nz ], e1, e0 );
			cq.add( P( - half, 0.15, y0 + HB ), P( half, 0.15, y0 + HB ), P( half, - T - 0.15, y0 + HB ), P( - half, - T - 0.15, y0 + HB ), [ 0, 1, 0 ] );
			for ( const [ qq, mat ] of [ [ bq, this.brick ], [ uq, this.brickUpper ], [ cq, this.stone ] ] ) {

				const m = new Mesh( qq.geometry(), mat );
				m.castShadow = true;
				m.receiveShadow = true;
				this.group.add( m );

			}

		}

		const gm = new Mesh( gq.geometry(), glass );
		gm.name = 'suite-glass';
		gm.receiveShadow = true;
		this.group.add( gm );
		const c = P( 0, o0 - 0.1, 0 ), w = this.field.toWorld( c[ 0 ], c[ 2 ] );
		this.colliders.addBox( new Vector3( w.x, this.field.y0 + y0 + H / 2, w.z ), new Vector3( half, H / 2, 0.15 ), this.field.group.rotation.y - Math.atan2( uz, ux ), { tag: 'facade' } );

		// rose granite piers either side of the glass, to the precast band
		const gran = this.suiteGranite || ( this.suiteGranite = standard( { name: 'rose-granite', color: new Color( 0.52, 0.33, 0.26 ), roughness: 0.7, modules: [ commonModule ],
			surface: /* wgsl */`
	// flamed ashlar, 1.2 x 0.6 m blocks with fine reveals, flecked
	let p = in.P;
	let hh = select( p.x, p.z, abs( in.N.x ) > abs( in.N.z ) );
	let r = floor( p.y / 0.6 );
	let rv = min( fract( p.y / 0.6 ), 1.0 - fract( p.y / 0.6 ) ) * 0.6;
	let cv = min( fract( hh / 1.2 + 0.5 * ( r % 2.0 ) ), 1.0 - fract( hh / 1.2 + 0.5 * ( r % 2.0 ) ) ) * 1.2;
	let joint = mix( 0.55, 1.0, smoothstep( 0.006, 0.016, min( rv, cv ) ) );
	s.albedo = mat.color * joint * ( 0.9 + 0.12 * mx_noise_float3( p * 7.0 ) ) * ( 0.93 + 0.1 * fract( sin( dot( vec2f( floor( hh / 1.2 ), r ), vec2f( 12.9, 78.2 ) ) ) * 43758.5 ) );
` } ) );
		gran.underwaterLighting = 'none';
		const pq = new Quads();
		for ( const e of [ - 1, 1 ] ) {

			const s0 = e * ( half + 0.05 ), s1 = e * ( half + 1.25 );
			for ( const [ A, B, n ] of [
				[ P( s0, 0.45, y0 ), P( s1, 0.45, y0 ), [ nx, 0, nz ] ],
				[ P( s0, - 0.4, y0 ), P( s0, 0.45, y0 ), [ - ux * e, 0, - uz * e ] ],
				[ P( s1, 0.45, y0 ), P( s1, - 0.2, y0 ), [ ux * e, 0, uz * e ] ],
			] ) pq.add( A, B, [ B[ 0 ], y0 + 5.35, B[ 2 ] ], [ A[ 0 ], y0 + 5.35, A[ 2 ] ], n );
			pq.add( P( s0, 0.45, y0 + 5.35 ), P( s1, 0.45, y0 + 5.35 ), P( s1, - 0.4, y0 + 5.35 ), P( s0, - 0.4, y0 + 5.35 ), [ 0, 1, 0 ] );

		}

		const pm = new Mesh( pq.geometry(), gran );
		pm.name = 'suite-piers';
		pm.castShadow = true;
		pm.receiveShadow = true;
		this.group.add( pm );

		// the canopy: a header on the wall, tapered outriggers every 1.5 m cantilevered 3.8 m, purlins
		// across them and laminated glass on top
		const cream = this.creamSteel || ( this.creamSteel = standard( { name: 'canopy-cream', color: new Color( 0.66, 0.6, 0.47 ), roughness: 0.55, metalness: 0.0 } ) );
		cream.underwaterLighting = 'none';
		const q = new Quads(), yc = y0 + 4.5, reach = 3.8, cw = half + 1.6;
		beam( q, P( - cw, 0.2, yc + 0.1 ), P( cw, 0.2, yc + 0.1 ), 0.5 );
		for ( let s = - cw + 0.3; s <= cw - 0.29; s += ( 2 * cw - 0.6 ) / Math.round( ( 2 * cw - 0.6 ) / 1.5 ) ) {

			// a tapered I-section: deep at the wall, shallow at the tip (two webs' faces and the flanges)
			const d0 = 0.6, d1 = 0.28, bw = 0.09;
			const pt = ( o, dy, e ) => P( s + e * bw, o, yc + 0.35 - dy );
			for ( const e of [ - 1, 1 ] ) q.add( pt( 0.3, d0, e ), pt( reach, d1, e ), pt( reach, 0, e ), pt( 0.3, 0, e ), [ ux * e, 0, uz * e ] );
			q.add( pt( 0.3, d0, - 1 ), pt( reach, d1, - 1 ), pt( reach, d1, 1 ), pt( 0.3, d0, 1 ), [ 0, - 1, 0 ] );
			q.add( pt( reach, d1, - 1 ), pt( reach, 0, - 1 ), pt( reach, 0, 1 ), pt( reach, d1, 1 ), [ nx, 0, nz ] );

		}

		for ( const o of [ 0.9, 1.6, 2.3, 3.0, 3.7 ] ) beam( q, P( - cw - 0.2, o, yc + 0.41 ), P( cw + 0.2, o, yc + 0.41 ), 0.12 );
		const cm = new Mesh( q.geometry(), cream );
		cm.name = 'suite-canopy';
		cm.castShadow = true;
		cm.receiveShadow = true;
		this.group.add( cm );
		const gl = this.canopyGlass || ( this.canopyGlass = standard( { name: 'canopy-glass', color: new Color( 0.55, 0.62, 0.6 ), roughness: 0.08, transparent: true, depthWrite: false, side: 'double', modules: [ commonModule ],
			surface: /* wgsl */`
	// laminated glass, a greenish edge, the rain beading on it
	let drops = smoothstep( 0.55, 0.8, mx_noise_float2( in.P.xz * 9.0 ) ) * frame.wet;
	s.alpha = 0.22 + 0.25 * drops;
	s.roughness = mix( 0.06, 0.3, drops );
` } ) );
		gl.underwaterLighting = 'none';
		const lq = new Quads();
		lq.add( P( - cw - 0.3, 0.3, yc + 0.48 ), P( cw + 0.3, 0.3, yc + 0.48 ), P( cw + 0.3, reach + 0.25, yc + 0.48 ), P( - cw - 0.3, reach + 0.25, yc + 0.48 ), [ 0, 1, 0 ] );
		const lm = new Mesh( lq.geometry(), gl );
		lm.name = 'suite-canopy-glass';
		lm.layers.set( 2 );
		this.group.add( lm );

		// downlights under the header
		const dl = new Quads();
		for ( let s = - half + 1; s <= half - 0.9; s += 2 ) {

			const cc = P( s, 0.2, yc - 0.16 );
			for ( let k = 0; k < 10; k ++ ) {

				const a0 = k / 10 * Math.PI * 2, a1 = ( k + 1 ) / 10 * Math.PI * 2;
				dl.tri( cc, [ cc[ 0 ] + Math.cos( a0 ) * 0.1, cc[ 1 ], cc[ 2 ] + Math.sin( a0 ) * 0.1 ], [ cc[ 0 ] + Math.cos( a1 ) * 0.1, cc[ 1 ], cc[ 2 ] + Math.sin( a1 ) * 0.1 ], [ 0, - 1, 0 ] );

			}

		}

		this.group.add( new Mesh( dl.geometry(), this.lampLens || ( this.lampLens = standard( { name: 'downlight', color: new Color( 0.9, 0.87, 0.8 ), roughness: 0.3,
			surface: 's.emissive = vec3f( 1.0, 0.85, 0.62 ) * mix( 0.3, 12.0, smoothstep( 0.1, 0.7, frame.night ) );' } ) ) ) );

		// the name in channel letters standing on the canopy's front edge
		this._channelLetters( P, g.name, reach - 0.2, yc + 0.5, [ nx, nz ], tu );
		// a doorman either side of the doors
		for ( const e of [ - 1, 1 ] ) ( this.gateGuards ||= [] ).push( { at: P( e * 3.6, 1.4, y0 ), face: [ nx, nz ] } );

	}

	// Channel letters: cream-pink faces (lit after dark) over navy returns, built as the face and a stack
	// of copies behind it, so seen at an angle the letters have depth. P( s, o, y ) the wall's frame,
	// centred at s = 0, standing at y, o out from the wall.
	_channelLetters( P, text, o, y, n, tu, { faceC = [ 0.86, 0.5, 0.47 ], retC = [ 0.02, 0.035, 0.1 ], glowC = [ 1.0, 0.72, 0.68 ], h = 0.62 } = {} ) {

		const H = 128;
		const font = '700 104px "Arial Narrow", "Helvetica Neue", Helvetica, Arial, sans-serif';
		const probe = new OffscreenCanvas( 8, 8 ).getContext( '2d' );
		probe.font = font;
		const tw = Math.ceil( probe.measureText( text ).width * 0.8 ) + 24;
		const tex = canvasTexture( Math.min( 4096, tw ), H, ( ctx, w, h ) => {

			ctx.clearRect( 0, 0, w, h );
			ctx.font = font;
			ctx.textBaseline = 'middle';
			ctx.fillStyle = '#ffffff';
			ctx.save();
			ctx.scale( 0.8, 1 );
			ctx.fillText( text, 12 / 0.8, h / 2 + 6 );
			ctx.restore();

		}, 'channelLetters' );
		const v3 = ( c ) => c.map( ( x ) => x.toFixed( 3 ) ).join( ', ' );
		const face = standard( { name: 'letters-face', roughness: 0.4, alphaTest: 0.5, side: 'double', textures: { chTex: tex },
			surface: `let t = textureSample( chTex, smpAnisoClamp, in.uv ); s.alpha = t.a; s.albedo = vec3f( ${ v3( faceC ) } ); s.emissive = vec3f( ${ v3( glowC ) } ) * smoothstep( 0.1, 0.7, frame.night ) * 1.2;` } );
		const back = standard( { name: 'letters-return', roughness: 0.5, alphaTest: 0.5, side: 'double', textures: { chTex: tex },
			surface: `let t = textureSample( chTex, smpAnisoClamp, in.uv ); s.alpha = t.a; s.albedo = vec3f( ${ v3( retC ) } );` } );
		for ( const m of [ face, back ] ) m.underwaterLighting = 'none';
		const lh = h, lw = lh * tex.width / H;
		const [ sL, sR ] = tu > 0 ? [ - lw / 2, lw / 2 ] : [ lw / 2, - lw / 2 ];
		const fq = new Quads(), rq = new Quads();
		const card = ( q, d ) => {

			q.tri( P( sL, o + d, y ), P( sR, o + d, y ), P( sR, o + d, y + lh ), [ n[ 0 ], 0, n[ 1 ] ], [ 0, 1 ], [ 1, 1 ], [ 1, 0 ] );
			q.tri( P( sL, o + d, y ), P( sR, o + d, y + lh ), P( sL, o + d, y + lh ), [ n[ 0 ], 0, n[ 1 ] ], [ 0, 1 ], [ 1, 0 ], [ 0, 0 ] );

		};

		card( fq, 0 );
		for ( let d = 0.02; d <= 0.13; d += 0.022 ) card( rq, - d );
		const fm = new Mesh( fq.geometry(), face ), rm = new Mesh( rq.geometry(), back );
		fm.name = 'channel-letters';
		rm.castShadow = true;
		this.group.add( fm, rm );

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

		const at = ( name ) => ( STATUES[ name ] || STATUES[ name + ' Statue' ] || [] )[ 0 ];
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
			if ( ! p ) continue;
			// ---- W1 (Third Base Gate): Schmidt's plinth as it is (Flickr beauwhite 2007, pingnews 2007, u2rob Apr
			// 2008): a low, wide slab of polished rose granite that people sit on, "MIKE SCHMIDT / PHILLIES HALL
			// OF FAME THIRD BASEMAN 1972-1989" cut into its front; he faces south-south-west, his back (SCHMIDT
			// 20) to the gate
			let w1 = name === 'Mike Schmidt' ? { plinth: { w: 3.9, h: 0.55, lines: [ 'MIKE SCHMIDT', 'PHILLIES HALL OF FAME THIRD BASEMAN 1972-1989' ] }, yaw: 2.75 } : {};
			// ---- end W1
			// ---- C (concourse1b): Robin Roberts as he stands (Flickr rdowens 3626891788 and 3626078323, Jul 2008;
			// puckfiend 571731532, 2005; 2979052232, 26 Oct 2008): in his follow-through, the right hand swept
			// down, the glove at his chest, the left foot striding off a little white rubber; the patina pale
			// grey-white ("B/W in a color world") with the cap, sleeves, stirrups, belt, glove and spikes
			// charcoal; on two tiers of reddish-mauve granite, "ROBIN ROBERTS / PHILLIES HALL OF FAME PITCHER
			// 1948-1961" cut in the lower one's front. He stands in front of the fence a few metres west of the
			// gate, facing south to Pattison, his back to the gate (Owens' GPS and the photos)
			let spot = p, ps = pose;
			if ( name === 'Robin Roberts' ) {

				const g = GATES.find( ( q ) => /FIRST/.test( q.name ) )?.edge;
				if ( g ) spot = [ g.a[ 0 ] + g.ux * ( g.t + 18.5 ) + g.nx * 6.5, g.a[ 1 ] + g.uz * ( g.t + 18.5 ) + g.nz * 6.5 ];
				ps = M.delivery( 1.08 );
				w1 = { plinth: { w: 3.2, h: 0.36, lines: [ 'ROBIN ROBERTS', 'PHILLIES HALL OF FAME PITCHER 1948-1961' ] }, tier: [ 1.6, 0.3, 2.3 ], yaw: Math.atan2( 0.22, 0.97 ) + Math.PI, figYaw: 0, paint: true };

			}

			// ---- end C
			this._statue( spot[ 0 ], spot[ 1 ], ps, label, years, drop, name === 'Steve Carlton' ? 'R' : 'L', w1 );
			// Carlton's stands on a paved forecourt outside the Left Field Gate
			if ( name === 'Steve Carlton' ) {

				const f = new Mesh( flatPolygon( [ [ p[ 0 ] - 10, p[ 1 ] - 7 ], [ p[ 0 ] + 10, p[ 1 ] - 7 ], [ p[ 0 ] + 10, p[ 1 ] + 7 ], [ p[ 0 ] - 10, p[ 1 ] + 7 ] ], [], STREET + 0.03 ), this.pavers );
				f.receiveShadow = true;
				this.group.add( f );

			}

		}

		// (the Vet's Liberty Bell only came to the plaza in 2019)

	}

	// a bronze figure (the players' own body, posed and baked) on a polished granite pedestal with its
	// engraved plate, facing the stadium
	_statue( x, z, pose, label, years, drop, gloveHand, w1 = {} ) {

		const g = new Group();
		g.position.set( x, STREET, z );
		if ( ! this.pedestal ) {

			this.pedestal = standard( { name: 'statue-granite', color: new Color( 0.11, 0.035, 0.03 ), roughness: 0.22, metalness: 0.1 } );
			this.statueBronze = standard( { name: 'statue-bronze', color: new Color( 0.2, 0.12, 0.05 ), roughness: 0.35, metalness: 0.9, modules: [ commonModule ],
				surface: '// patina: dark in the hollows, a touch of verdigris\n	let n = mx_noise_float3( in.P * 2.5 ) * 0.5 + 0.5;\n	s.albedo = mix( mat.color, vec3f( 0.06, 0.1, 0.07 ), smoothstep( 0.7, 0.95, n ) * 0.5 ) * ( 0.8 + 0.3 * mx_noise_float3( in.P * 9.0 ) );' } );
			for ( const m of [ this.pedestal, this.statueBronze ] ) m.underwaterLighting = 'none';

		}

		// ---- W1 (Third Base Gate): a plinth of its own (w1.plinth: its width, height and the lines cut into it)
		const PL = w1.plinth, pw = PL ? PL.w : 3.0, ph = PL ? PL.h : 1.2;
		if ( PL && ! this.roseGranite ) {

			this.roseGranite = standard( { name: 'statue-rose-granite', color: new Color( 0.3, 0.13, 0.1 ), roughness: 0.2, metalness: 0.05, modules: [ commonModule ],
				surface: '// polished rose granite: feldspar pink, quartz grey and black mica in a fine speckle, a sheen\n	let n = mx_noise_float3( in.P * 40.0 );\n	let m = mx_noise_float3( in.P * 90.0 + vec3f( 5.0 ) );\n	var c = mat.color * ( 0.85 + 0.3 * n );\n	c = mix( c, vec3f( 0.25, 0.23, 0.22 ), smoothstep( 0.35, 0.6, m ) * 0.5 );\n	c = mix( c, vec3f( 0.02 ), smoothstep( 0.55, 0.75, -m ) * 0.7 );\n	s.albedo = c * ( 0.95 + 0.1 * mx_noise_float3( in.P * 2.0 ) );' } );
			this.roseGranite.underwaterLighting = 'none';

		}

		const ped = new Mesh( new BoxGeometry( pw, ph, pw ), PL ? this.roseGranite : this.pedestal );
		ped.position.y = ph / 2;
		ped.castShadow = true;
		ped.receiveShadow = true;
		g.add( ped );
		if ( PL ) {

			// the lines cut into the front: the letters dark in their V-grooves, a lit lower lip
			const cut = canvasTexture( 1024, 128, ( ctx, w, h ) => {

				ctx.clearRect( 0, 0, w, h );
				ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
				for ( const [ dy, col ] of [ [ 2, 'rgba(255,220,210,0.55)' ], [ 0, 'rgba(20,6,4,1)' ] ] ) {

					ctx.fillStyle = col;
					ctx.font = '600 58px "Trajan Pro", Georgia, "Times New Roman", serif';
					ctx.fillText( PL.lines[ 0 ], w / 2, 42 + dy, w - 80 );
					ctx.font = '500 26px "Trajan Pro", Georgia, "Times New Roman", serif';
					ctx.fillText( PL.lines[ 1 ], w / 2, 98 + dy, w - 80 );

				}

			}, 'statueCut' );
			const cm = standard( { name: 'statue-cut', roughness: 0.6, alphaTest: 0.3, textures: { stCut: cut }, surface: 'let t = textureSample( stCut, smpAnisoClamp, in.uv ); s.alpha = t.a; s.albedo = t.rgb * 0.5;' } );
			cm.underwaterLighting = 'none';
			const cq = new Quads(), hw = pw * 0.42, y0 = ph * 0.18, y1 = ph * 0.82, zf = - pw / 2 - 0.004;
			cq.tri( [ hw, y0, zf ], [ - hw, y0, zf ], [ - hw, y1, zf ], [ 0, 0, - 1 ], [ 0, 1 ], [ 1, 1 ], [ 1, 0 ] );
			cq.tri( [ hw, y0, zf ], [ - hw, y1, zf ], [ hw, y1, zf ], [ 0, 0, - 1 ], [ 0, 1 ], [ 1, 0 ], [ 0, 0 ] );
			g.add( new Mesh( cq.geometry(), cm ) );

		}

		// ---- end W1
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
		if ( ! PL ) g.add( new Mesh( pq.geometry(), pm ) ); // (W1: a plinth of its own has its lines cut in)
		const fig = new Mesh( bakePose( pose, { gloveHand, drop } ), this.statueBronze );
		fig.position.y = ph;
		if ( PL ) fig.rotation.y = Math.PI / 2; // (W1: the baked swing faces its own side: turned, he faces the way his plinth does)
		// ---- C (concourse1b): a second, smaller tier of the granite under the feet; the figure turned its
		// own way; a painted patina (Roberts's: the uniform pale, the cap, sleeves, socks, belt, glove, shoes dark)
		if ( w1.tier && PL ) {

			const [ tw, th, td ] = w1.tier;
			const tier = new Mesh( new BoxGeometry( tw, th, td ), this.roseGranite );
			tier.position.y = ph + th / 2;
			tier.castShadow = true;
			tier.receiveShadow = true;
			g.add( tier );
			fig.position.y = ph + th;

		}

		if ( w1.figYaw !== undefined ) fig.rotation.y = w1.figYaw;
		if ( w1.paint ) {

			this.statuePainted ||= standard( { name: 'statue-painted', color: new Color( 0.62, 0.63, 0.64 ), roughness: 0.55, modules: [ commonModule ],
				attributes: { aPart: 'f32' }, varyings: { vPart: 'f32' }, vertex: 'o.vPart = v.aPart;',
				surface: /* wgsl */`
	// the parts (Rig.PART): 3 socks, 4 shoes, 5 cap, 6 glove, 8 belt, 9 sleeve dark; the rest pale
	let k = u32( in.vs.vPart + 0.5 );
	let dark = k == 3u || k == 4u || k == 5u || k == 6u || k == 8u || k == 9u;
	let n = mx_noise_float3( in.P * 6.0 );
	s.albedo = select( mat.color, vec3f( 0.06, 0.065, 0.07 ), dark ) * ( 0.9 + 0.12 * n );
	// the weather in the folds: a little darker low down and in the creases
	s.albedo *= 0.82 + 0.18 * smoothstep( -0.4, 0.6, in.N.y );
	s.roughness = select( 0.55, 0.4, dark );
` } );
			this.statuePainted.underwaterLighting = 'none';
			fig.material = this.statuePainted;

		}

		// ---- end C
		fig.scale.setScalar( 1.65 ); // 10 ft
		fig.castShadow = true;
		fig.receiveShadow = true;
		g.add( fig );
		// face the stadium's middle
		g.rotation.y = w1.yaw ?? Math.atan2( - ( 4 - x ), - ( - 31 - z ) ) + Math.PI;
		this.group.add( g );
		const w = this.field.toWorld( x, z );
		this.colliders.addBox( new Vector3( w.x, this.field.y0 + STREET + ph / 2, w.z ), new Vector3( pw / 2, ph / 2, pw / 2 ), this.field.group.rotation.y + g.rotation.y, { tag: 'statue', walkable: true } );

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
