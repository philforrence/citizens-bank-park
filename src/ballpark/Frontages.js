import { ShaderModule } from '../engine/gpu/Shader.js';
import { commonModule } from '../engine/render/wgsl/common.js';

// The named frontages in the facade's ground storey, drawn by the facade's own shaders (Exterior.js):
// the ticket windows (a booth behind each window with a clerk or a blind, a numbered home plate over
// it), the Majestic Clubhouse Store's two storeys of glass (jerseys, caps, racks, mannequins in the
// window; the Phanatic Attic upstairs) and McFadden's Restaurant & Saloon (a green timber front, the bar
// inside packed on a World Series night, the game on the TVs, the neon in the windows). Each is a run of
// the facade's u (metres along the footprint): [ u0, u1, kind, first window number ].
//
// Everything behind the glass is traced into depth per pixel (a box room, and planes for the people and
// the fittings in it), so the rooms shift as you walk past.

export const FRONT = { store: 1, saloon: 2, tickets: 3 };

export const frontagesModule = new ShaderModule( {
	name: 'facade-frontages',
	deps: [ commonModule ],
	code: /* wgsl */`
struct FzOut { c: vec3f, e: vec3f, r: f32, on: f32 }

fn fzHash( x: f32 ) -> f32 { return fract( sin( x * 12.9898 + 4.1 ) * 43758.5453 ); }

// the view ray at this point of a wall with (world) normal N, in the wall's frame: x to the viewer's
// right along the wall, y up, z into the building
fn fzRay( P: vec3f, N: vec3f ) -> vec3f {
	let T = normalize( cross( vec3f( 0.0, 1.0, 0.0 ), N ) );
	let Vd = normalize( P - frame.cameraPos );
	return vec3f( dot( Vd, T ), Vd.y, max( dot( Vd, - N ), 0.04 ) );
}

// the ray from ro (on the glass, z = 0) through a box room x0..x1, y0..y1, 0..d: the point it hits and
// the face (0 back wall, 1 floor, 2 ceiling, 3 a side wall)
fn fzRoom( ro: vec3f, rd: vec3f, x0: f32, x1: f32, y0: f32, y1: f32, d: f32 ) -> vec4f {
	let tx = ( select( x0, x1, rd.x > 0.0 ) - ro.x ) / rd.x;
	let ty = ( select( y0, y1, rd.y > 0.0 ) - ro.y ) / rd.y;
	let tz = d / rd.z;
	let t = min( tx, min( ty, tz ) );
	var face = 3.0;
	if ( t == tz ) { face = 0.0; } else if ( t == ty ) { face = select( 1.0, 2.0, rd.y > 0.0 ); }
	return vec4f( ro + rd * t, face );
}

// where the ray crosses the plane z = z
fn fzAt( ro: vec3f, rd: vec3f, z: f32 ) -> vec3f { return ro + rd * ( z / rd.z ); }

// a standing person seen from the front, p = ( across from his middle, up from the floor ) in metres:
// 0 nothing, 1 his body, 2 his head, 3 his legs
fn fzFigure( p: vec2f, h: f32 ) -> f32 {
	let q = p / h;
	if ( length( ( q - vec2f( 0.0, 0.93 ) ) * vec2f( 1.0, 0.85 ) ) < 0.068 ) { return 2.0; }
	let sh = vec2f( max( abs( q.x ) - 0.08, 0.0 ), max( q.y - 0.8, 0.0 ) );
	if ( q.y > 0.5 && q.y < 0.87 && abs( q.x ) < 0.15 && length( sh ) < 0.07 ) { return 1.0; }
	if ( q.y > 0.0 && q.y <= 0.5 && abs( abs( q.x ) - 0.055 ) < 0.045 ) { return 3.0; }
	return 0.0;
}

// ---- W1 (Third Base Gate): the window numbers in a 5 x 7 face instead of seven segments (a "6" read
// as an "E"): a digit in the cell p (0..1 each way, y up), each row five bits, the leftmost the high one
fn fzDigit( p: vec2f, n: i32 ) -> f32 {
	var rows = array<u32, 70>(
		0x0Eu, 0x11u, 0x13u, 0x15u, 0x19u, 0x11u, 0x0Eu, // 0
		0x04u, 0x0Cu, 0x04u, 0x04u, 0x04u, 0x04u, 0x0Eu, // 1
		0x0Eu, 0x11u, 0x01u, 0x02u, 0x04u, 0x08u, 0x1Fu, // 2
		0x1Fu, 0x02u, 0x04u, 0x02u, 0x01u, 0x11u, 0x0Eu, // 3
		0x02u, 0x06u, 0x0Au, 0x12u, 0x1Fu, 0x02u, 0x02u, // 4
		0x1Fu, 0x10u, 0x1Eu, 0x01u, 0x01u, 0x11u, 0x0Eu, // 5
		0x06u, 0x08u, 0x10u, 0x1Eu, 0x11u, 0x11u, 0x0Eu, // 6
		0x1Fu, 0x01u, 0x02u, 0x04u, 0x08u, 0x08u, 0x08u, // 7
		0x0Eu, 0x11u, 0x11u, 0x0Eu, 0x11u, 0x11u, 0x0Eu, // 8
		0x0Eu, 0x11u, 0x11u, 0x0Fu, 0x01u, 0x02u, 0x0Cu  // 9
	);
	if ( p.x < 0.0 || p.x >= 1.0 || p.y < 0.0 || p.y >= 1.0 ) { return 0.0; }
	let col = u32( floor( p.x * 5.0 ) );
	let row = u32( floor( ( 1.0 - p.y ) * 7.0 ) );
	let bits = rows[ u32( clamp( n, 0, 9 ) ) * 7u + row ];
	return f32( ( bits >> ( 4u - col ) ) & 1u );
}
// ---- end W1

// the ticket windows: x from the frontage's left end (as you face it), v up from the street
fn fzTickets( x: f32, v: f32, len: f32, first: f32, rd: vec3f, night: f32, base: FzOut ) -> FzOut {
	var o = base;
	let n = max( 1.0, floor( ( len - 0.6 ) / 1.6 ) );
	let off = ( len - n * 1.6 ) * 0.5;
	let wi = floor( ( x - off ) / 1.6 );
	if ( wi < 0.0 || wi >= n ) { return o; }
	let wx = x - off - ( wi + 0.5 ) * 1.6;
	let h1 = fzHash( wi + first * 7.1 );
	let h2 = fzHash( wi * 3.7 + first );
	// the polished sill and the frame round the glass
	if ( abs( wx ) < 0.74 && v > 1.02 && v < 1.15 ) { o.c = vec3f( 0.05, 0.025, 0.025 ); o.r = 0.2; o.on = 1.0; return o; }
	if ( abs( wx ) < 0.68 && v > 1.15 && v < 2.71 && ( abs( wx ) > 0.62 || v > 2.65 ) ) { o.c = vec3f( 0.42, 0.43, 0.44 ); o.r = 0.35; o.on = 1.0; return o; }
	// the home plate over the window, its number in black
	let pc = vec2f( wx, v - 3.05 );
	if ( abs( pc.x ) < 0.22 && pc.y < 0.2 && pc.y > - 0.2 + abs( pc.x ) * 0.7 ) {
		o.c = vec3f( 0.8, 0.79, 0.75 ); o.r = 0.5; o.on = 1.0;
		let num = i32( first + wi );
		let tens = num / 10;
		let dw = 0.09;
		let dp = vec2f( ( pc.x + select( dw * 0.5, dw, tens > 0 ) ) / dw, ( pc.y + 0.08 ) / 0.2 );
		var dig = 0.0;
		if ( tens > 0 ) { dig = fzDigit( dp, tens ) * step( 0.0, dp.x ) * step( dp.x, 1.0 ); }
		let dp2 = dp - vec2f( select( 0.0, 1.15, tens > 0 ), 0.0 );
		dig = max( dig, fzDigit( dp2, num % 10 ) * step( 0.0, dp2.x ) * step( dp2.x, 1.0 ) );
		dig = dig * step( 0.0, dp.y ) * step( dp.y, 1.0 );
		o.c = mix( o.c, vec3f( 0.02 ), dig );
		o.e = o.c * night * 0.25;
		return o;
	}
	if ( abs( wx ) > 0.62 || v < 1.15 || v > 2.65 ) { return o; }
	// the glass: behind it a booth, 2 m deep, lit by a fluorescent strip
	o.on = 1.0;
	o.r = 0.05;
	let ro = vec3f( wx, v, 0.0 );
	let hit = fzRoom( ro, rd, - 0.8, 0.8, 0.0, 2.9, 2.0 );
	let th = hit.z / rd.z;
	var inside = vec3f( 0.62, 0.58, 0.5 );
	if ( hit.w == 0.0 ) {
		// a schedule poster on the back wall
		if ( abs( hit.x + 0.35 ) < 0.22 && abs( hit.y - 1.75 ) < 0.3 ) { inside = select( vec3f( 0.8, 0.78, 0.72 ), vec3f( 0.45, 0.02, 0.03 ), hit.y > 1.95 ); }
	}
	if ( hit.w == 1.0 ) { inside = vec3f( 0.12, 0.12, 0.13 ); }
	if ( hit.w == 2.0 ) { inside = vec3f( 0.8 ) + vec3f( 4.0, 4.0, 3.6 ) * step( abs( hit.x ), 0.08 ) * step( abs( hit.z - 1.0 ), 0.6 ); }
	// the counter under the window
	let cz = fzAt( ro, rd, 0.35 );
	if ( v > 1.15 && cz.y < 1.08 ) { inside = vec3f( 0.3, 0.3, 0.32 ); }
	// the clerk, in a red Phillies jacket, at most windows; a blind down at the rest
	let isOpen = h1 > 0.25;
	let cp = fzAt( ro, rd, 0.95 );
	let fig = fzFigure( vec2f( cp.x - ( h2 - 0.5 ) * 0.3, cp.y ), 1.72 + 0.12 * h2 );
	if ( isOpen && fig > 0.5 && fig < 2.5 && 0.95 / rd.z < th ) {
		inside = select( vec3f( 0.3, 0.02, 0.03 ), mix( vec3f( 0.5, 0.32, 0.22 ), vec3f( 0.16, 0.09, 0.05 ), step( 0.6, h2 ) ), fig > 1.5 );
		if ( fig > 1.5 && cp.y > ( 1.72 + 0.12 * h2 ) * 0.955 ) { inside = vec3f( 0.03, 0.02, 0.015 ); }
	}
	let lit = inside * vec3f( 1.0, 0.97, 0.9 ) * ( 1.0 - 0.3 * hit.z / 2.0 );
	var glassC = vec3f( 0.04, 0.05, 0.06 ) + lit * 0.12 * ( 1.0 - night );
	var glassE = lit * mix( 0.05, 0.35, night );
	if ( ! isOpen ) {
		let shade = vec3f( 0.62, 0.58, 0.48 ) * ( 0.9 + 0.1 * step( 0.5, fract( v / 0.05 ) ) );
		glassC = shade * 0.5; glassE = shade * mix( 0.02, 0.2, night );
		if ( abs( v - 1.9 ) < 0.08 && abs( wx ) < 0.3 ) { glassC = vec3f( 0.3, 0.02, 0.02 ); glassE = glassC * night * 0.4; }
	}
	// the voice port, and a notice taped to some: WORLD SERIES - SOLD OUT
	if ( length( vec2f( wx - 0.36, v - 1.6 ) ) < 0.045 ) { glassC = vec3f( 0.3 ); glassE = vec3f( 0.0 ); }
	if ( h2 > 0.45 && wx > - 0.52 && wx < - 0.18 && v > 1.22 && v < 1.66 ) {
		glassC = vec3f( 0.85, 0.84, 0.8 );
		if ( v > 1.56 ) { glassC = vec3f( 0.4, 0.02, 0.03 ); }
		if ( v < 1.52 && v > 1.3 && fract( ( v - 1.3 ) / 0.055 ) < 0.45 && abs( wx + 0.35 ) < 0.13 - 0.04 * step( 0.5, fract( v / 0.11 ) ) ) { glassC = vec3f( 0.05 ); }
		glassE = glassC * night * 0.3;
	}
	o.c = glassC;
	o.e = glassE;
	return o;
}

// the Majestic Clubhouse Store: storey 0 in the base (glass 0.3 - 4.9 m), storey 1 upstairs (the
// Phanatic Attic, glass 0.3 - 3.9 m over the precast band)
fn fzStore( x: f32, v: f32, len: f32, rd: vec3f, night: f32, upper: bool, base: FzOut ) -> FzOut {
	var o = base;
	let top = select( 4.9, 3.9, upper );
	if ( v < 0.3 || v > top || x < 0.4 || x > len - 0.4 ) { return o; }
	o.on = 1.0;
	// bronze mullions every 1.5 m, a transom; the doors in the middle with stainless push bars
	let mu = abs( fract( ( x - 0.4 ) / 1.5 + 0.5 ) - 0.5 ) * 1.5;
	let door = ! upper && abs( x - len * 0.5 ) < 1.6 && v < 2.6;
	var fr = step( mu, 0.05 ) + step( abs( v - select( 3.1, 2.9, upper ) ), 0.05 ) + step( v, 0.36 ) + step( top - 0.06, v );
	if ( door ) { let dx = abs( fract( ( x - len * 0.5 ) / 0.8 ) - 0.5 ) * 0.8; fr += step( 0.35, dx ) + step( abs( v - 1.05 ), 0.03 ) * step( 0.08, dx ); }
	if ( fr > 0.5 ) { o.c = select( vec3f( 0.045, 0.018, 0.02 ), vec3f( 0.5, 0.51, 0.52 ), door ); o.r = 0.35; o.e = vec3f( 0.0 ); return o; }
	let ro = vec3f( x, v, 0.0 );
	let H = select( 4.6, 3.8, upper );
	let hit = fzRoom( ro, rd, 0.0, len, 0.0, H, 9.0 );
	let th = hit.z / rd.z;
	var inside = vec3f( 0.7, 0.68, 0.64 );
	var glow = vec3f( 0.0 );
	if ( hit.w == 0.0 || hit.w == 3.0 ) {
		// the walls: jerseys hung in a grid (white pinstripes, red, road grey, the powder blue of 1980),
		// caps above them upstairs; shelves of folded shirts below, a World Series banner along the top
		let a = select( hit.x, hit.z + hit.x * 0.01, hit.w == 3.0 );
		let cell = floor( vec2f( a / 0.75, ( hit.y - 1.0 ) / 0.95 ) );
		let cf = vec2f( fract( a / 0.75 ), fract( ( hit.y - 1.0 ) / 0.95 ) );
		let hc = fzHash( cell.x * 7.3 + cell.y * 13.1 + select( 0.0, 50.0, upper ) );
		inside = vec3f( 0.55, 0.52, 0.47 );
		if ( hit.y > 1.0 && hit.y < 3.85 ) {
			let body = abs( cf.x - 0.5 ) < 0.28 && cf.y > 0.1 && cf.y < 0.8;
			let arms = abs( cf.x - 0.5 ) < 0.42 && cf.y > 0.6 && cf.y < 0.8;
			if ( body || arms ) {
				var jc = vec3f( 0.8, 0.79, 0.76 ) * ( 0.85 + 0.15 * step( 0.5, fract( a / 0.05 ) ) );
				if ( hc > 0.45 ) { jc = vec3f( 0.4, 0.02, 0.03 ); }
				if ( hc > 0.7 ) { jc = vec3f( 0.42, 0.42, 0.43 ); }
				if ( hc > 0.86 ) { jc = vec3f( 0.3, 0.45, 0.65 ); }
				if ( upper && hc > 0.3 ) { jc = vec3f( 0.08, 0.35, 0.07 ); }
				inside = jc;
				if ( abs( cf.x - 0.5 ) < 0.12 && abs( cf.y - 0.45 ) < 0.12 ) { inside = select( vec3f( 0.45, 0.02, 0.03 ), vec3f( 0.85 ), hc > 0.45 && hc < 0.86 ); }
			}
		}
		if ( hit.y < 1.0 ) { inside = select( vec3f( 0.2, 0.11, 0.06 ), vec3f( 0.5, 0.03, 0.04 ) * ( 0.7 + 0.5 * hc ), fract( hit.y / 0.25 ) < 0.6 && fract( a / 0.4 ) < 0.85 ); }
		if ( hit.y > 3.9 && hit.y < 4.4 && hit.w == 0.0 ) {
			inside = vec3f( 0.42, 0.02, 0.03 );
			if ( abs( hit.y - 4.15 ) < 0.12 && fract( hit.x / 0.3 ) < 0.6 ) { inside = vec3f( 0.85, 0.83, 0.78 ); }
		}
	}
	if ( hit.w == 1.0 ) { inside = vec3f( 0.36, 0.24, 0.14 ) * ( 0.85 + 0.15 * step( 0.5, fract( hit.z / 0.15 ) ) ); }
	if ( hit.w == 2.0 ) {
		inside = vec3f( 0.18 );
		let sp = abs( fract( hit.xz / vec2f( 1.2, 1.5 ) ) - 0.5 ) * vec2f( 1.2, 1.5 );
		glow = vec3f( 6.0, 5.4, 4.4 ) * ( 1.0 - smoothstep( 0.05, 0.08, length( sp ) ) );
	}
	// racks of hanging shirts down the middle, a table of caps nearer the glass
	for ( var k = 0; k < 2; k ++ ) {
		let z = select( 4.0, 6.5, k == 1 );
		let p = fzAt( ro, rd, z );
		let rk = fract( ( p.x + f32( k ) * 1.7 ) / 3.6 );
		if ( z / rd.z < th && rk < 0.55 && p.y > 0.55 && p.y < 1.55 ) {
			let g = fzHash( floor( p.x / 0.09 ) );
			inside = select( select( vec3f( 0.7 ), vec3f( 0.42, 0.02, 0.03 ), g > 0.4 ), vec3f( 0.03, 0.03, 0.05 ), g > 0.85 ) * ( 0.8 + 0.2 * fract( p.x / 0.09 ) );
			if ( p.y > 1.5 ) { inside = vec3f( 0.6 ); }
			break;
		}
	}
	// mannequins in the window in this year's jerseys, and a few shoppers
	let mp = fzAt( ro, rd, 0.9 );
	let mk = floor( ( mp.x - 1.5 ) / 4.5 );
	let mf = fzFigure( vec2f( mp.x - 1.5 - ( mk + 0.5 ) * 4.5, mp.y - 0.3 ), 1.85 );
	if ( mf > 0.5 && ! upper ) {
		inside = select( select( vec3f( 0.8, 0.79, 0.76 ), vec3f( 0.42, 0.02, 0.03 ), fract( mk * 0.5 ) > 0.2 ), vec3f( 0.75, 0.72, 0.66 ), mf > 1.5 );
		if ( mf > 2.5 ) { inside = vec3f( 0.05, 0.05, 0.08 ); }
	}
	let sp = fzAt( ro, rd, 5.2 );
	let sk = floor( sp.x / 5.3 );
	let sf = fzFigure( vec2f( sp.x - ( sk + 0.5 ) * 5.3 - ( fzHash( sk ) - 0.5 ) * 2.0, sp.y ), 1.75 );
	if ( sf > 0.5 && fzHash( sk * 3.1 + select( 0.0, 9.0, upper ) ) > 0.45 && 5.2 / rd.z < th && mf < 0.5 ) {
		inside = select( select( vec3f( 0.35, 0.02, 0.03 ), vec3f( 0.45, 0.3, 0.2 ), sf > 1.5 ), vec3f( 0.05, 0.06, 0.1 ), sf > 2.5 );
	}
	let lit = inside * vec3f( 1.0, 0.95, 0.86 ) * ( 1.0 - 0.35 * clamp( hit.z / 9.0, 0.0, 1.0 ) ) + glow;
	o.c = vec3f( 0.035, 0.045, 0.055 ) + lit * 0.14 * ( 1.0 - night );
	o.e = lit * mix( 0.06, 0.32, night );
	o.r = 0.04;
	return o;
}

// McFadden's: a green timber shop front over a panelled base, and the bar inside
fn fzSaloon( x: f32, v: f32, len: f32, rd: vec3f, night: f32, base: FzOut ) -> FzOut {
	var o = base;
	if ( v > 4.35 || x < 0.3 || x > len - 0.3 ) { return o; }
	o.on = 1.0;
	let green = vec3f( 0.012, 0.06, 0.03 );
	let bay = abs( fract( ( x - 0.3 ) / 1.25 + 0.5 ) - 0.5 ) * 1.25;
	let door = x > len - 2.2;
	// the base panels, the posts, the transom and its little panes
	if ( v < 0.9 && ! door ) { let inPanel = bay > 0.13 && abs( v - 0.47 ) < 0.3; o.c = green * select( 1.25, 0.75, inPanel ); o.r = 0.35; o.e = vec3f( 0.0 ); return o; }
	var fr = step( bay, 0.07 ) + step( abs( v - 3.35 ), 0.07 ) + step( 4.22, v );
	if ( v > 3.42 ) { fr += step( abs( fract( ( x - 0.3 ) / 0.42 ) - 0.5 ) * 0.42, 0.025 ); }
	if ( door ) { fr += step( abs( x - ( len - 1.25 ) ), 0.05 ) + step( abs( x - ( len - 2.2 ) ), 0.07 ); }
	if ( fr > 0.5 ) { o.c = green; o.r = 0.3; o.e = vec3f( 0.0 ); return o; }
	let ro = vec3f( x, v, 0.0 );
	let hit = fzRoom( ro, rd, 0.0, len, 0.0, 4.2, 10.0 );
	let th = hit.z / rd.z;
	var inside = vec3f( 0.16, 0.09, 0.05 );
	var glow = vec3f( 0.0 );
	if ( hit.w == 0.0 ) {
		// the back bar: bottles on glass shelves in front of a mirror, the TVs with the game on
		inside = vec3f( 0.12, 0.06, 0.03 );
		if ( hit.y > 1.1 && hit.y < 2.5 ) {
			inside = vec3f( 0.25, 0.22, 0.2 );
			if ( fract( hit.y / 0.45 ) > 0.45 && fract( hit.x / 0.11 ) < 0.6 ) {
				let b = fzHash( floor( hit.x / 0.11 ) + floor( hit.y / 0.45 ) * 31.0 );
				glow = select( select( vec3f( 0.6, 0.35, 0.08 ), vec3f( 0.1, 0.4, 0.12 ), b > 0.5 ), vec3f( 0.7, 0.7, 0.6 ), b > 0.8 ) * 0.8;
			}
		}
		let tv = abs( fract( hit.x / 3.2 ) - 0.5 ) * 3.2;
		if ( tv < 0.55 && abs( hit.y - 3.1 ) < 0.33 ) {
			// the broadcast: grass, the infield dirt, the score bug
			let ty = ( hit.y - 2.77 ) / 0.66;
			var scr = mix( vec3f( 0.08, 0.35, 0.08 ), vec3f( 0.2, 0.2, 0.25 ), step( 0.7, ty ) );
			if ( ty < 0.35 && abs( fract( hit.x / 3.2 ) - 0.5 ) < 0.06 ) { scr = vec3f( 0.45, 0.28, 0.15 ); }
			if ( ty > 0.85 && fract( hit.x / 3.2 ) < 0.43 ) { scr = vec3f( 0.1, 0.1, 0.3 ); }
			glow = scr * 2.5;
			if ( tv > 0.52 || abs( hit.y - 3.1 ) > 0.3 ) { glow = vec3f( 0.0 ); inside = vec3f( 0.01 ); }
		}
	}
	if ( hit.w == 1.0 ) { inside = vec3f( 0.1, 0.05, 0.025 ); }
	if ( hit.w == 2.0 ) {
		inside = vec3f( 0.07, 0.04, 0.02 );
		let sp = abs( fract( hit.xz / vec2f( 2.2, 2.5 ) ) - 0.5 ) * vec2f( 2.2, 2.5 );
		glow = vec3f( 3.5, 2.2, 1.0 ) * ( 1.0 - smoothstep( 0.1, 0.16, length( sp ) ) );
	}
	// neon beer signs on the side walls
	if ( hit.w == 3.0 && abs( hit.y - 2.4 ) < 0.3 && fract( hit.z / 3.0 ) < 0.3 ) {
		let k = fzHash( floor( hit.z / 3.0 ) + hit.x * 0.01 );
		glow = select( select( vec3f( 3.0, 0.2, 0.2 ), vec3f( 0.3, 0.6, 3.0 ), k > 0.4 ), vec3f( 2.8, 1.6, 0.3 ), k > 0.75 );
	}
	// the bar: people along it and at the tables in front, heads turned to the TVs
	let barP = fzAt( ro, rd, 7.0 );
	if ( 7.0 / rd.z < th && barP.y < 1.1 ) { inside = vec3f( 0.14, 0.06, 0.025 ); glow = vec3f( 0.0 ); if ( barP.y > 1.02 ) { inside = vec3f( 0.5, 0.36, 0.12 ); } }
	for ( var k = 0; k < 3; k ++ ) {
		let z = 6.2 - f32( k ) * 1.9;
		let p = fzAt( ro, rd, z );
		let cell = floor( p.x / 0.75 );
		let hh = fzHash( cell * 5.1 + f32( k ) * 17.0 );
		let f = fzFigure( vec2f( p.x - ( cell + 0.5 ) * 0.75 - ( hh - 0.5 ) * 0.25, p.y ), 1.62 + 0.25 * hh );
		if ( z / rd.z < th && hh > 0.25 && f > 0.5 ) {
			inside = select( select( select( vec3f( 0.3, 0.02, 0.03 ), vec3f( 0.04 ), hh > 0.62 ), vec3f( 0.45, 0.45, 0.45 ), hh > 0.85 ), vec3f( 0.4, 0.26, 0.18 ) * ( 0.6 + 0.6 * hh ), f > 1.5 && f < 2.5 );
			if ( f > 2.5 ) { inside = vec3f( 0.03, 0.04, 0.08 ); }
			glow = vec3f( 0.0 );
			break;
		}
	}
	let lit = inside * vec3f( 1.0, 0.75, 0.45 ) * 0.9 + glow;
	o.c = vec3f( 0.03, 0.035, 0.035 ) + lit * 0.1 * ( 1.0 - night );
	o.e = lit * mix( 0.05, 0.3, night );
	o.r = 0.04;
	return o;
}
`,
} );
