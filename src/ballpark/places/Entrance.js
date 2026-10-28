import { Group, Mesh, Color } from '../../engine/index.js';
import { commonModule } from '../../engine/render/wgsl/common.js';
import { standard } from '../../materials/Materials.js';
import { canvasTexture } from '../geo.js';
import { Quads } from '../Stands.js';
import { brickWGSL } from '../ConcourseSteel.js';
import { GATES } from '../Exterior.js';
import { LEVELS } from '../layout.js';
import { Reach } from './inside/Kit.js';

// FI2 (gauntlet CI-17): the Suite & Club Entrance at home plate, on Pattison Avenue, as the park's front
// door it was in 2008 (thephillyfly, 20 Apr 2008, by day; pvsbond, Oct 2009, at night): over the
// lobby's doors and their lettered canopy (Exterior.js) the bay is a glazed atrium the full height of the
// front, between two brick towers standing proud of the wall, under a thin steel cap; inside it the
// upper floors, their lit ceilings, the pennants hung in the void (traced: interior mapping); across the
// glass the giant Phillies script in red channel letters with the two blue stars, on standoffs, lit red
// after dark. The brick and PHILADELPHIA lettering that were over the lobby are behind the glass now.
// Exterior.js untouched: this stands in front of it.
//
// Field frame; the street is LEVELS.mainConcourse.

const STREET = LEVELS.mainConcourse;
const TOP = 19.6; // the atrium's glass, over the street
const TOWER = 16.4; // the brick towers' tops (the facade's height here)

export default class Entrance {

	constructor( { app, field } ) {

		this.app = app;
		this.field = field;
		this.group = new Group();
		this.group.name = 'entrance';
		const g = GATES.find( ( q ) => q.suite && q.lintel );
		if ( ! g ) return;
		// the wall's line here: along +x, its outside +z (Pattison Avenue)
		const [ cx, cz ] = g.at, W = g.width, half = W / 2, y0 = STREET;
		const P = ( s, o, y ) => [ cx + s, y, cz + o ];
		const n = [ 0, 0, 1 ];

		// the towers: brick, proud of the wall either side of the bay, a stone cap
		const bq = new Quads(), cap = new Quads();
		const TW = 2.6, TO = 1.0;
		for ( const sd of [ - 1, 1 ] ) {

			const x0 = sd * half, x1 = sd * ( half + TW );
			const [ a, b ] = sd < 0 ? [ x1, x0 ] : [ x0, x1 ];
			const yT = y0 + TOWER;
			bq.add( P( a, TO, y0 ), P( b, TO, y0 ), P( b, TO, yT ), P( a, TO, yT ), n, a, b );
			// the sides: the one toward the glass, the one toward the wall
			bq.add( P( x0, 0, y0 ), P( x0, TO, y0 ), P( x0, TO, yT ), P( x0, 0, yT ), [ - sd, 0, 0 ], 0, TO );
			bq.add( P( x1, TO, y0 ), P( x1, 0, y0 ), P( x1, 0, yT ), P( x1, TO, yT ), [ sd, 0, 0 ], 0, TO );
			cap.add( P( a - 0.1 * sd, TO + 0.12, yT ), P( b + 0.1 * sd, TO + 0.12, yT ), P( b + 0.1 * sd, - 0.1, yT ), P( a - 0.1 * sd, - 0.1, yT ), [ 0, 1, 0 ] );
			cap.add( P( a - 0.1 * sd, TO + 0.12, yT - 0.35 ), P( b + 0.1 * sd, TO + 0.12, yT - 0.35 ), P( b + 0.1 * sd, TO + 0.12, yT ), P( a - 0.1 * sd, TO + 0.12, yT ), n );
			// a rose granite base, as the lobby's piers
			cap.add( P( a, TO + 0.03, y0 ), P( b, TO + 0.03, y0 ), P( b, TO + 0.03, y0 + 1.6 ), P( a, TO + 0.03, y0 + 1.6 ), n );

		}

		// ---- FI3 (C2I-5): the towers' brick a deeper red than the facade's (thephillyfly 2008: dark red, its
		// coursing plain, over the rose granite), and after dark washed warm from two uplights at each foot,
		// fading up the brick (pvsbond, Oct 2009: the towers read at night; they were near black)
		const brick = standard( { name: 'entrance-brick', color: new Color( 0.25, 0.068, 0.04 ), roughness: 0.85, surface: brickWGSL( { base: y0 + 0.5 } ) + /* wgsl */`
	s.albedo *= vec3f( 0.82, 0.72, 0.72 );
	{
		let hb = max( in.uv.y - ${ y0.toFixed( 3 ) }, 0.0 );
		let pool = 0.62 + 0.38 * cos( fract( in.uv.x / 1.3 ) * 6.2832 );
		let up = exp( - hb / 6.0 ) * pool * smoothstep( 0.0, 0.6, hb );
		s.emissive = s.emissive + s.albedo * vec3f( 1.0, 0.7, 0.42 ) * up * 1.8 * smoothstep( 0.1, 0.7, frame.night );
	}
` } );
		// ---- end FI3
		const stone = standard( { name: 'entrance-stone', color: new Color( 0.52, 0.42, 0.36 ), roughness: 0.7 } );
		// the atrium's glass: from over the lobby's canopy to the cap, a little out from the old wall
		const gq = new Quads(), yG0 = y0 + g.lintel, yG1 = y0 + TOP, GO = 0.3;
		gq.add( P( - half, GO, yG0 ), P( half, GO, yG0 ), P( half, GO, yG1 ), P( - half, GO, yG1 ), n, - half, half );
		// the returns between the glass and the towers, the cap over it all: thin steel, overhanging
		const steel = new Quads();
		steel.add( P( - half - TW - 0.4, TO + 1.6, yG1 + 0.25 ), P( half + TW + 0.4, TO + 1.6, yG1 + 0.25 ), P( half + TW + 0.4, - 1.0, yG1 + 0.25 ), P( - half - TW - 0.4, - 1.0, yG1 + 0.25 ), [ 0, 1, 0 ] );
		steel.add( P( - half - TW - 0.4, TO + 1.6, yG1 ), P( - half - TW - 0.4, - 1.0, yG1 ), P( half + TW + 0.4, - 1.0, yG1 ), P( half + TW + 0.4, TO + 1.6, yG1 ), [ 0, - 1, 0 ] );
		steel.add( P( - half - TW - 0.4, TO + 1.6, yG1 ), P( half + TW + 0.4, TO + 1.6, yG1 ), P( half + TW + 0.4, TO + 1.6, yG1 + 0.25 ), P( - half - TW - 0.4, TO + 1.6, yG1 + 0.25 ), n );
		// the cap's supports down to the towers' tops, the glass's sides above them
		for ( const sd of [ - 1, 1 ] ) {

			steel.add( P( sd * half, 0, y0 + TOWER ), P( sd * half, GO, y0 + TOWER ), P( sd * half, GO, yG1 ), P( sd * half, 0, yG1 ), [ - sd, 0, 0 ] );
			steel.add( P( sd * ( half + 0.05 ), GO + 0.02, y0 + TOWER ), P( sd * ( half + 0.05 ), GO + 0.02, yG1 ), P( sd * ( half + TW ), GO + 0.02, yG1 ), P( sd * ( half + TW ), GO + 0.02, y0 + TOWER ), n );

		}

		const glass = standard( { name: 'entrance-atrium', color: new Color( 0.03, 0.04, 0.05 ), roughness: 0.05, metalness: 0.3, modules: [ commonModule ],
			surface: /* wgsl */`
	// uv: x along the glass from its middle (m), y the field frame's height. Inside: the atrium, open up
	// through the floors (their slab edges at the suite, club and terrace levels, lit ceilings under
	// each), pennants and a round banner hung in the void, the back wall cream; traced into depth
	let u = in.uv.x; let v = in.uv.y;
	let N = normalize( in.N );
	let T = normalize( cross( vec3f( 0.0, 1.0, 0.0 ), N ) );
	let Vd = normalize( in.P - frame.cameraPos );
	let nk = smoothstep( 0.1, 0.7, frame.night );
	let rd = vec3f( dot( Vd, T ), Vd.y, max( dot( Vd, - N ), 0.05 ) );
	let ro = vec3f( u, v, 0.0 );
	let DEP = 7.0;
	let HW = ${ ( half - 0.1 ).toFixed( 2 ) };
	let tx = ( select( - HW, HW, rd.x > 0.0 ) - ro.x ) / rd.x;
	let tz = DEP / rd.z;
	var t = min( tx, tz );
	var room = vec3f( 0.62, 0.56, 0.46 );
	var glow = vec3f( 0.0 );
	// the floors: a gallery 2.5 m deep at each level, round the void
	for ( var k = 0; k < 3; k ++ ) {
		let fy = select( select( ${ ( LEVELS.suites ).toFixed( 2 ) }, ${ ( LEVELS.clubConcourse ).toFixed( 2 ) }, k == 1 ), ${ ( LEVELS.terraceConcourse ).toFixed( 2 ) }, k == 2 );
		let tf = ( fy - ro.y ) / rd.y;
		let pf = ro + rd * tf;
		if ( tf > 0.0 && tf < t && pf.z > DEP - 2.5 ) {
			t = tf;
			room = select( vec3f( 0.08, 0.06, 0.05 ), vec3f( 0.55, 0.53, 0.5 ), rd.y > 0.0 );
			if ( rd.y > 0.0 ) {
				let gc = abs( fract( pf.xz / 1.5 ) - 0.5 ) * 1.5;
				if ( length( gc ) < 0.08 ) { glow = vec3f( 5.0, 4.3, 3.3 ); }
			}
		}
	}
	let hit = ro + rd * t;
	if ( t == tz ) {
		// the back: cream in the light of the cans, darker away from them
		room = vec3f( 0.4, 0.35, 0.29 ) * ( 0.55 + 0.45 * smoothstep( 2.0, 0.0, abs( fract( hit.y / 3.8 ) * 3.8 - 1.0 ) ) );
		// the slab edges, dark bands, at each level
		for ( var k = 0; k < 3; k ++ ) {
			let fy = select( select( ${ ( LEVELS.suites ).toFixed( 2 ) }, ${ ( LEVELS.clubConcourse ).toFixed( 2 ) }, k == 1 ), ${ ( LEVELS.terraceConcourse ).toFixed( 2 ) }, k == 2 );
			if ( hit.y < fy && hit.y > fy - 0.6 ) { room = vec3f( 0.12, 0.1, 0.09 ); }
		}
	}
	// the pennants on a wire across the void, high up; the round banner hung inside, high and to one side
	// (pvsbond 2009), smaller, deeper in (---- FI3 (C2I-5): it hung dead centre over the script, a red disc
	// ringed in cream: an archery target; and two rows of pennants made a carnival of it)
	let tp = 3.2 / rd.z;
	let pp = ro + rd * tp;
	if ( tp < t ) {
		let fy = ( pp.y - 22.9 ) / 0.5;
		let px = fract( pp.x / 0.7 );
		if ( abs( pp.x ) < 4.2 && fy > 0.0 && fy < 1.0 - abs( px - 0.5 ) * 2.0 ) {
			room = select( vec3f( 0.45, 0.03, 0.04 ), vec3f( 0.04, 0.08, 0.35 ), fract( floor( pp.x / 0.7 ) * 0.5 ) > 0.4 );
			glow = vec3f( 0.0 );
		}
	}
	let tb2 = 5.2 / rd.z;
	let pb = ro + rd * tb2;
	if ( tb2 < t ) {
		let bc = length( vec2f( pb.x + 3.1, pb.y - 24.3 ) );
		if ( bc < 0.95 ) {
			// a Phillies roundel: navy ring, cream field, the red P
			room = select( vec3f( 0.6, 0.57, 0.5 ), vec3f( 0.03, 0.05, 0.18 ), bc > 0.78 );
			if ( bc < 0.5 && abs( pb.x + 3.1 ) < 0.18 + 0.12 * step( pb.y, 24.35 ) && pb.y > 24.0 && pb.y < 24.6 ) { room = vec3f( 0.4, 0.03, 0.04 ); }
			glow = vec3f( 0.0 );
		}
	}
	// ---- end FI3
	let inside = room * mix( 0.12, 0.2, nk ) + glow * mix( 0.4, 1.0, nk );
	// the curtain wall's grid: mullions every 1.5 m, transoms every 1.8 m, the floor lines heavier
	let mu = abs( fract( u / 1.5 + 0.5 ) - 0.5 ) * 1.5;
	let mv = abs( fract( ( v - 13.2 ) / 1.8 + 0.5 ) - 0.5 ) * 1.8;
	let fk = clamp( step( mu, 0.05 ) + step( mv, 0.045 ), 0.0, 1.0 );
	let fres = pow( 1.0 - max( dot( - Vd, N ), 0.0 ), 3.0 );
	s.albedo = mix( vec3f( 0.03, 0.04, 0.05 ), vec3f( 0.32, 0.34, 0.35 ), fk );
	s.roughness = mix( 0.05, 0.4, fk );
	s.metalness = mix( 0.3, 0.7, fk );
	s.emissive = inside * ( 1.0 - fk ) * ( 1.0 - fres );
` } );
		const steelM = standard( { name: 'entrance-steel', color: new Color( 0.3, 0.32, 0.33 ), roughness: 0.45, metalness: 0.6, side: 'double' } );
		for ( const m of [ brick, stone, glass, steelM ] ) {

			m.underwaterLighting = 'none';
			m.setDefine( 'DRY', 1 );

		}

		this.parts = [];
		for ( const [ q, m, name ] of [ [ bq, brick, 'entrance-towers' ], [ cap, stone, 'entrance-stone' ], [ gq, glass, 'entrance-atrium' ], [ steel, steelM, 'entrance-cap' ] ] ) {

			const mesh = new Mesh( q.geometry(), m );
			mesh.name = name;
			mesh.castShadow = name !== 'entrance-atrium';
			mesh.receiveShadow = true;
			mesh.userData.dynamic = true;
			this.group.add( mesh );
			this.parts.push( mesh );

		}

		this._script( P, y0 );
		this._lobby( g, half ); // ---- FI3 (C2I-5)
		// (drawn only from where it can be seen: outside the park, or high in the stands' back rows)
		this.reach = new Reach( 160 );
		for ( const m of this.parts ) this.reach.add( m, [ cx, y0 + 10, cz ], 10 );

	}

	// The Phillies script: red channel letters with white returns, the two blue stars over the i's, the
	// swash under it, on standoffs off the glass; lit red after dark. A face and its returns (the same
	// letters stepped back, darker) for its depth.
	_script( P, y0 ) {

		const tex = canvasTexture( 1024, 512, ( ctx, w, h ) => {

			ctx.clearRect( 0, 0, w, h );
			ctx.textAlign = 'left';
			ctx.textBaseline = 'alphabetic';
			// ---- FI3 (C2I-5): the wordmark heavy and nearly upright (pvsbond 2009, thephillyfly 2008: a fat
			// sign-painter's script, the big looped P, the swash a long bar with rounded ends under it all), at
			// the bay's width. It was the system's Brush Script, italic: thin strokes, 60 % of the bay. A house
			// script (SignPainter), its strokes fattened, sized to fill the canvas
			const fam = '"SignPainter", "SignPainter-HouseScript", "Brush Script MT", "Snell Roundhand", cursive';
			let size = 300;
			ctx.font = `600 ${ size }px ${ fam }`;
			const want = w * 0.9;
			size = Math.min( 470, size * want / ctx.measureText( 'Phillies' ).width );
			ctx.font = `600 ${ size }px ${ fam }`;
			const tw = ctx.measureText( 'Phillies' ).width, x0 = ( w - tw ) / 2, base = h * 0.74;
			ctx.lineJoin = 'round';
			ctx.lineCap = 'round';
			// the cream edge round the letters, then the red faces, fattened by a red stroke of their own
			ctx.strokeStyle = '#f4efe2';
			ctx.lineWidth = 30;
			ctx.strokeText( 'Phillies', x0, base );
			ctx.fillStyle = '#d0102c';
			ctx.strokeStyle = '#d0102c';
			ctx.lineWidth = 12;
			ctx.strokeText( 'Phillies', x0, base );
			ctx.fillText( 'Phillies', x0, base );
			// the swash: from under the P's foot to past the s, rounded at its ends, a slight lift at the tail
			const sw = ( lw, col ) => {

				ctx.beginPath();
				ctx.moveTo( x0 + tw * 0.06, h * 0.86 );
				ctx.bezierCurveTo( x0 + tw * 0.4, h * 0.875, x0 + tw * 0.75, h * 0.87, x0 + tw * 1.0, h * 0.835 );
				ctx.lineWidth = lw; ctx.strokeStyle = col; ctx.stroke();

			};
			sw( 52, '#f4efe2' );
			sw( 34, '#d0102c' );
			// (the stars over the i's: their places measured off the word)
			const iAt = ( pre ) => x0 + ctx.measureText( pre ).width + ctx.measureText( 'i' ).width * 0.55;
			const stars = [ iAt( 'Ph' ), iAt( 'Phill' ) ], starY = base - size * 0.6;
			// ---- end FI3
			// the stars
			const star = ( x, y, r ) => {

				ctx.beginPath();
				for ( let k = 0; k < 10; k ++ ) {

					const a = - Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r;
					ctx.lineTo( x + Math.cos( a ) * rr, y + Math.sin( a ) * rr );

				}

				ctx.closePath();
				ctx.lineWidth = 8;
				ctx.strokeStyle = '#f4f1ea';
				ctx.stroke();
				ctx.fillStyle = '#3a72e0';
				ctx.fill();

			};
			for ( const sx of stars ) star( sx, starY, 30 ); // ---- FI3

		}, 'entranceScript' );
		const face = standard( { name: 'entrance-script', roughness: 0.4, side: 'double', textures: { enScript: tex },
			surface: /* wgsl */`
	let t = textureSample( enScript, smpAnisoClamp, in.uv );
	if ( t.a < 0.5 ) { discard; }
	let nk = smoothstep( 0.1, 0.7, frame.night );
	let red = t.r > t.g * 2.0 && t.r > 0.3;
	s.albedo = t.rgb;
	// (---- FI3: the stars lit blue too, as in the 2009 photo; the cream edge only faintly)
	let blue = t.b > t.r * 1.5 && t.b > 0.3;
	s.emissive = t.rgb * select( select( mix( 0.03, 0.25, nk ), mix( 0.05, 1.2, nk ), blue ), mix( 0.08, 1.6, nk ), red );
` } );
		const back = standard( { name: 'entrance-script-returns', roughness: 0.5, side: 'double', textures: { enScript: tex },
			surface: /* wgsl */`
	let t = textureSample( enScript, smpAnisoClamp, in.uv );
	if ( t.a < 0.5 ) { discard; }
	s.albedo = vec3f( 0.035, 0.03, 0.032 ); // ---- FI3: the returns dark (both photos)
	s.emissive = vec3f( 0.06, 0.005, 0.008 ) * smoothstep( 0.1, 0.7, frame.night );
` } );
		for ( const m of [ face, back ] ) {

			m.underwaterLighting = 'none';
			m.setDefine( 'DRY', 1 );

		}

		// 10 m wide, its baseline a third of the way up the atrium
		const w = 11.6, h = w * 512 / 1024, yb = y0 + 7.6, o = 0.95; // (---- FI3: taller, for the heavier script)
		const fq = new Quads(), rq = new Quads();
		const quad = ( q, off ) => {

			q.tri( P( - w / 2, off, yb ), P( w / 2, off, yb ), P( w / 2, off, yb + h ), [ 0, 0, 1 ], [ 0, 1 ], [ 1, 1 ], [ 1, 0 ] );
			q.tri( P( - w / 2, off, yb ), P( w / 2, off, yb + h ), P( - w / 2, off, yb + h ), [ 0, 0, 1 ], [ 0, 1 ], [ 1, 0 ], [ 0, 0 ] );

		};
		quad( fq, o );
		for ( let k = 1; k <= 5; k ++ ) quad( rq, o - k * 0.04 );
		// the standoffs: steel arms from the glass to the letters
		const arms = new Quads();
		for ( const x of [ - 3.5, 0, 3.5 ] ) for ( const y of [ yb + 0.6, yb + h - 0.9 ] ) {

			arms.add( P( x - 0.04, 0.3, y ), P( x + 0.04, 0.3, y ), P( x + 0.04, o - 0.2, y ), P( x - 0.04, o - 0.2, y ), [ 0, 1, 0 ] );

		}

		for ( const [ q, m, name ] of [ [ fq, face, 'entrance-script' ], [ rq, back, 'entrance-script-returns' ], [ arms, this.parts[ 3 ].material, 'entrance-arms' ] ] ) {

			const mesh = new Mesh( q.geometry(), m );
			mesh.name = name;
			mesh.userData.dynamic = true;
			this.group.add( mesh );
			this.parts.push( mesh );

		}

	}

	// ---- FI3 (C2I-5): the lobby behind the doors (Exterior's glass there, its traced room): after dark it
	// blazed white (pvsbond, Oct 2009: a white ceiling of linear lights running back from the glass, the
	// cream walls and terrazzo bright, the desk), where it was a dim brown room. Its glass is given this
	// material at build time (Exterior.js untouched); the same uv (x along the glass from its middle, y up
	// from the street) and the same suite corridors over the lobby's two storeys
	_lobby( g, half ) {

		let mesh = null, best = 4;
		this.app?.exterior?.group?.traverse( ( o ) => {

			if ( ! o.isMesh || o.name !== 'suite-glass' ) return;
			const bb = o.geometry.boundingBox;
			if ( ! bb ) return;
			const d = Math.hypot( ( bb.min.x + bb.max.x ) / 2 - g.at[ 0 ], ( bb.min.z + bb.max.z ) / 2 - g.at[ 1 ] );
			if ( d < best ) {

				best = d; mesh = o;

			}

		} );
		if ( ! mesh ) return;
		const m = standard( {
			name: 'entrance-lobby', color: new Color( 0.03, 0.04, 0.05 ), roughness: 0.05, modules: [ commonModule ],
			uniforms: { half: [ 'f32', half ] },
			surface: /* wgsl */`
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
	let D = select( 4.0, 9.0, lobby );
	let tx = ( select( - hw, hw, rd.x > 0.0 ) - ro.x ) / rd.x;
	let ty = ( select( f0, f1, rd.y > 0.0 ) - ro.y ) / rd.y;
	let tz = D / rd.z;
	let tt = min( tx, min( ty, tz ) );
	let hit = ro + rd * tt;
	var room = vec3f( 0.62, 0.58, 0.5 );
	var lamp = 0.0;
	if ( tt == tz ) {
		if ( lobby ) {
			// the back: cream, the stainless elevator doors, a band of cherry, the club's lettering over them
			room = vec3f( 0.66, 0.62, 0.54 );
			let ex = abs( fract( hit.x / 3.4 ) - 0.5 ) * 3.4;
			if ( ex < 0.55 && hit.y < 2.3 ) { room = vec3f( 0.55, 0.56, 0.58 ) * ( 0.75 + 0.25 * step( 0.015, ex ) ); }
			if ( hit.y > 2.6 && hit.y < 2.9 ) { room = vec3f( 0.3, 0.12, 0.06 ); }
			if ( hit.y > 3.3 && hit.y < 3.8 && abs( hit.x ) < 1.8 ) { room = vec3f( 0.75, 0.6, 0.28 ); lamp = 0.25; }
		} else { room = room * 0.8; }
	} else if ( tt == tx ) {
		// the side walls: cream over a granite base, a framed photograph
		room = select( vec3f( 0.64, 0.6, 0.52 ), vec3f( 0.42, 0.3, 0.25 ), hit.y < 0.9 );
		if ( lobby && abs( hit.z - 4.5 ) < 1.0 && abs( hit.y - 2.0 ) < 0.6 ) { room = vec3f( 0.2, 0.15, 0.12 ); }
	}
	if ( tt == ty && rd.y < 0.0 ) {
		// the floor: the lobby's cream terrazzo, its brass strips; carpet upstairs
		room = select( vec3f( 0.22, 0.07, 0.06 ) * ( 0.9 + 0.1 * mx_noise_float2( hit.xz * 3.0 ) ), vec3f( 0.6, 0.56, 0.48 ) * ( 0.92 + 0.12 * mx_noise_float2( hit.xz * 30.0 ) ), lobby );
		if ( lobby && abs( fract( hit.x / 1.8 ) - 0.5 ) < 0.008 ) { room = vec3f( 0.55, 0.4, 0.15 ); }
	}
	if ( tt == ty && rd.y > 0.0 ) {
		room = vec3f( 0.82, 0.8, 0.76 );
		if ( lobby ) {
			// the linear lights: long strips running back from the glass, 1.2 m apart
			let lx = abs( fract( hit.x / 1.2 ) - 0.5 ) * 1.2;
			lamp = ( 1.0 - smoothstep( 0.035, 0.06, lx ) ) * step( 0.6, hit.z ) * step( hit.z, D - 0.6 );
		} else {
			let gc = abs( fract( hit.xz / 1.8 ) - 0.5 ) * 1.8;
			lamp = 1.0 - smoothstep( 0.07, 0.1, length( gc ) );
		}
	}
	// the desk, and the man at it in his blazer
	let deskT = ( 4.5 - ro.z ) / rd.z;
	let deskP = ro + rd * deskT;
	if ( lobby && deskT < tt && abs( deskP.x ) < 2.2 && deskP.y < 1.1 && deskP.y > 0.0 ) { room = select( vec3f( 0.3, 0.12, 0.06 ), vec3f( 0.5, 0.48, 0.45 ), deskP.y > 1.04 ); lamp = 0.0; }
	let manT = ( 5.1 - ro.z ) / rd.z;
	let mp = ro + rd * manT;
	if ( lobby && manT < tt && deskT < manT && ( length( ( mp.xy - vec2f( 0.6, 1.62 ) ) * vec2f( 1.0, 0.8 ) ) < 0.11 || ( abs( mp.x - 0.6 ) < 0.23 && mp.y > 1.0 && mp.y < 1.5 ) ) ) { room = select( vec3f( 0.03, 0.04, 0.09 ), vec3f( 0.45, 0.3, 0.22 ), mp.y > 1.5 ); lamp = 0.0; }
	let inside = ( room + vec3f( 6.0, 5.8, 5.2 ) * lamp ) * vec3f( 1.0, 0.96, 0.9 ) * ( 1.0 - 0.3 * clamp( hit.z / D, 0.0, 1.0 ) );
	// the frame: bronze mullions every 1.5 m, the transom over the doors, spandrels at each slab
	let mu = abs( fract( u / 1.5 + 0.5 ) - 0.5 ) * 1.5;
	var frameK = step( mu, 0.045 ) + step( abs( v - 2.75 ), 0.06 ) + step( abs( v - 5.8 ), 0.4 );
	if ( ! lobby ) { frameK += step( 3.0, v - 6.2 - k * 3.6 ); }
	let door = v < 2.7 && abs( u ) < 3.0;
	if ( door ) { let du = abs( fract( u / 1.5 ) - 0.5 ) * 1.5; frameK += step( 0.68, du ) + step( abs( v - 1.05 ), 0.03 ) * step( du, 0.62 ) * step( 0.1, du ); }
	let fk = clamp( frameK, 0.0, 1.0 );
	s.albedo = mix( vec3f( 0.03, 0.04, 0.05 ) + inside * 0.05 * ( 1.0 - night ), select( vec3f( 0.045, 0.018, 0.02 ), vec3f( 0.45, 0.46, 0.47 ), door ), fk );
	s.roughness = mix( 0.04, 0.4, fk );
	s.metalness = select( 0.0, 0.8, door && fk > 0.5 );
	// (the lobby blazes after dark; the corridors over it glow as before)
	s.emissive = inside * ( 1.0 - fk ) * select( mix( 0.05, 0.22, night ), mix( 0.07, 0.62, night ), lobby );
`,
		} );
		m.underwaterLighting = 'none';
		m.setDefine( 'DRY', 1 );
		mesh.material = m;

	}

	update( dt, director, camera ) {

		if ( ! this.reach || ! camera ) return;
		const [ cx, cz ] = this.field.toField( camera.position.x, camera.position.z );
		// (FOX's cameras are all inside the park, facing the field)
		const tv = this.app?.camMode && this.app.camMode !== 'walk';
		this.reach.update( tv ? [ 1e4, 0, 0 ] : [ cx, camera.position.y - this.field.y0, cz ] );

	}

}
