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

		const brick = standard( { name: 'entrance-brick', color: new Color( 0.25, 0.068, 0.04 ), roughness: 0.85, surface: brickWGSL( { base: y0 + 0.5 } ) } );
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
	// the pennants on wires across the void, the round banner
	let tp = 3.2 / rd.z;
	let pp = ro + rd * tp;
	if ( tp < t ) {
		let row = floor( ( pp.y - 2.0 ) / 3.2 );
		let fy = fract( ( pp.y - 2.0 ) / 3.2 );
		let px = fract( pp.x / 0.9 );
		if ( ( row == 4.0 || row == 6.0 ) && abs( pp.x ) < 4.2 && fy > 0.7 && fy < 0.7 + 0.2 * ( 1.0 - abs( px - 0.5 ) * 2.0 ) ) {
			room = select( vec3f( 0.45, 0.03, 0.04 ), vec3f( 0.04, 0.08, 0.35 ), fract( floor( pp.x / 0.9 ) * 0.5 + row * 0.5 ) > 0.4 );
			glow = vec3f( 0.0 );
		}
		let bc = length( vec2f( pp.x - 0.4, pp.y - 21.5 ) );
		if ( bc < 1.6 ) {
			room = mix( vec3f( 0.32, 0.02, 0.03 ), vec3f( 0.55, 0.53, 0.5 ), step( 1.0, bc ) * step( bc, 1.25 ) );
			glow = vec3f( 0.0 );
		}
	}
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

		this._script( P, half, y0 );
		// (drawn only from where it can be seen: outside the park, or high in the stands' back rows)
		this.reach = new Reach( 160 );
		for ( const m of this.parts ) this.reach.add( m, [ cx, y0 + 10, cz ], 10 );

	}

	// The Phillies script: red channel letters with white returns, the two blue stars over the i's, the
	// swash under it, on standoffs off the glass; lit red after dark. A face and its returns (the same
	// letters stepped back, darker) for its depth.
	_script( P, half, y0 ) {

		const tex = canvasTexture( 1024, 384, ( ctx, w, h ) => {

			ctx.clearRect( 0, 0, w, h );
			ctx.textAlign = 'center';
			ctx.textBaseline = 'alphabetic';
			const font = 'italic bold 250px "Brush Script MT", "Snell Roundhand", "Segoe Script", cursive';
			ctx.font = font;
			// the white edge round the letters, then the red faces (heavy: the channel letters are deep)
			ctx.lineJoin = 'round';
			ctx.strokeStyle = '#f4f1ea';
			ctx.lineWidth = 34;
			ctx.strokeText( 'Phillies', w / 2, 268 );
			ctx.fillStyle = '#d0102c';
			ctx.strokeStyle = '#d0102c';
			ctx.lineWidth = 10;
			ctx.strokeText( 'Phillies', w / 2, 268 );
			ctx.fillText( 'Phillies', w / 2, 268 );
			// the swash: a bar under the name, tapered at its ends
			ctx.beginPath();
			ctx.moveTo( 120, 312 ); ctx.quadraticCurveTo( 512, 300, 905, 296 ); ctx.lineTo( 925, 330 ); ctx.quadraticCurveTo( 512, 336, 105, 344 ); ctx.closePath();
			ctx.lineWidth = 14;
			ctx.stroke();
			ctx.fill();
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
				ctx.fillStyle = '#2a50b0';
				ctx.fill();

			};
			star( 600, 70, 40 );
			star( 712, 70, 40 );

		}, 'entranceScript' );
		const face = standard( { name: 'entrance-script', roughness: 0.4, side: 'double', textures: { enScript: tex },
			surface: /* wgsl */`
	let t = textureSample( enScript, smpAnisoClamp, in.uv );
	if ( t.a < 0.5 ) { discard; }
	let nk = smoothstep( 0.1, 0.7, frame.night );
	let red = t.r > t.g * 2.0 && t.r > 0.3;
	s.albedo = t.rgb;
	s.emissive = t.rgb * select( mix( 0.03, 0.45, nk ), mix( 0.08, 1.5, nk ), red );
` } );
		const back = standard( { name: 'entrance-script-returns', roughness: 0.5, side: 'double', textures: { enScript: tex },
			surface: /* wgsl */`
	let t = textureSample( enScript, smpAnisoClamp, in.uv );
	if ( t.a < 0.5 ) { discard; }
	s.albedo = vec3f( 0.6, 0.6, 0.58 ) * 0.6;
	s.emissive = vec3f( 0.25, 0.02, 0.02 ) * smoothstep( 0.1, 0.7, frame.night );
` } );
		for ( const m of [ face, back ] ) {

			m.underwaterLighting = 'none';
			m.setDefine( 'DRY', 1 );

		}

		// 10 m wide, its baseline a third of the way up the atrium
		const w = 11.6, h = w * 384 / 1024, yb = y0 + 8.2, o = 0.95;
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

		void half;

	}

	update( dt, director, camera ) {

		if ( ! this.reach || ! camera ) return;
		const [ cx, cz ] = this.field.toField( camera.position.x, camera.position.z );
		// (FOX's cameras are all inside the park, facing the field)
		const tv = this.app?.camMode && this.app.camMode !== 'walk';
		this.reach.update( tv ? [ 1e4, 0, 0 ] : [ cx, camera.position.y - this.field.y0, cz ] );

	}

}
