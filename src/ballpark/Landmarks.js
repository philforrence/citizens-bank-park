import { Group, Mesh, BoxGeometry, CylinderGeometry, ConeGeometry, SphereGeometry, TubeGeometry, CatmullRomCurve3, BufferGeometry, Float32BufferAttribute, Vector3, Color } from '../engine/index.js';
import { bakePose } from './game/Rig.js';
import * as Motions from './game/Motions.js';
import { commonModule } from '../engine/render/wgsl/common.js';
import { standard } from '../materials/Materials.js';
import { Quads } from './Stands.js';
import { canvasTexture, refreshCanvasTexture, beam, box, box as boxQuads } from './geo.js';
import { generateMipmaps } from '../engine/gpu/Mipmaps.js';
import { FT, LEVELS, fencePoint } from './layout.js';
import { offsetPolyline } from './Bowl.js';

// The ballpark's landmarks round the outfield: the main scoreboard in left field (152 x 86 ft since 2023,
// its steel topping out 143 ft above the field), the Liberty Bell sign in right-center (35 x 50 ft, 100 ft
// above the street), Ashburn Alley's brick buildings behind center field with the retired numbers, and
// the ivy-covered batter's eye. Field frame, in the Field's group.

const STREET = LEVELS.mainConcourse;

export class Landmarks {

	constructor( { field, bowl, colliders } ) {

		this.field = field;
		this.bowl = bowl;
		this.colliders = colliders;
		this.group = new Group();
		this.group.name = 'landmarks';
		field.group.add( this.group );
		// structural steel at the park is painted maroon
		this.steel = standard( { name: 'landmark-steel', color: new Color( 0.12, 0.03, 0.03 ), roughness: 0.6, metalness: 0.4 } );
		this.steel.underwaterLighting = 'none';
		this._scoreboard();
		// the light tower over the Pavilion in right (the one in left stands beside the scoreboard)
		for ( const [ a, d ] of [ [ 36, 440 ] ] ) {

			const [ x, z ] = fencePoint( a, d );
			bowl._lightTower( x, z, STREET, LEVELS.lightTowers, [ 6, 6 ] );

		}

		this._libertyBell();
		this._ashburnAlley();
		this._battersEye();

	}

	// a group at a field-frame point, turned to face home plate
	_facingHome( x, z, y = 0 ) {

		const g = new Group();
		g.position.set( x, y, z );
		g.rotation.y = Math.atan2( - x, - z ) + Math.PI; // local -z toward home
		this.group.add( g );
		return g;

	}

	// ---------------------------------------------------------------- the scoreboard

	// The 2004-2011 scoreboard, as it was for the 2008 World Series: a blue cabinet (about 97 x 79 ft) with
	// the Coca-Cola and Motrin panels down its left, the amber matrix (the at-bat, due up, the lineup, the
	// line score and the count) over the 69'7" x 39'5" video board, the "Phillies" script with its two
	// stars on the steel above, green neon "Citizens Bank Park" and Harry the K's beneath, and the light
	// tower beside it with its sponsors' panels.
	_scoreboard() {

		const W = 97 * FT, H = 79 * FT;
		const [ x, z ] = fencePoint( - 36, 452 );
		const g = this._facingHome( x, z );
		// raised on its legs over Harry the K's (the porch's 8 rows, the bar on its patio, the awnings, the
		// green neon letters on brick, then the board)
		const y0 = STREET + 15.7;
		this.board = { W, H, y0 };
		this.boardCanvas = new OffscreenCanvas( 1600, 1304 );
		this.scoreboardTexture = canvasTexture( 1600, 1304, ( ctx, w, h ) => drawBoard2008( ctx, w, h, null ), 'scoreboard' );
		const screen = standard( {
			name: 'scoreboard', roughness: 0.4, textures: { bpBoard: this.scoreboardTexture },
			surface: /* wgsl */`
	let t = textureSample( bpBoard, smpAnisoClamp, in.uv ).rgb;
	// LEDs and lit panels: their own light, a little brighter after dark; up close the screen's pixel
	// grid shows (fading out when the grid gets finer than the screen's pixels)
	let px = in.uv * vec2f( 800.0, 652.0 );
	let fw = length( fwidth( px ) );
	let dots = 1.0 - smoothstep( 0.32, 0.5, length( fract( px ) - 0.5 ) );
	let led = mix( 0.35 + dots * 1.1, 1.0, clamp( fw * 1.5 - 0.3, 0.0, 1.0 ) );
	s.albedo = t * 0.06;
	s.emissive = t * led * mix( 1.6, 0.55, frame.night );
`,
		} );
		screen.underwaterLighting = 'none';
		const face = new Mesh( quadUV( W, H, y0, - 0.72 ), screen );
		face.name = 'scoreboard-face';
		g.add( face );
		const cabinet = standard( { name: 'scoreboard-cabinet', color: new Color( 0.03, 0.06, 0.16 ), roughness: 0.6, metalness: 0.3 } );
		cabinet.underwaterLighting = 'none';
		const box = new Mesh( new BoxGeometry( W + 1.2, H + 1.2, 1.2 ), cabinet );
		box.position.set( 0, y0 + H / 2, 0 );
		box.castShadow = true;
		g.add( box );
		// the steel it stands on and the frame the script sits on
		for ( const lx of [ - W * 0.38, - W * 0.1, W * 0.18, W * 0.42 ] ) {

			const leg = new Mesh( new BoxGeometry( 0.9, y0 - STREET + 0.5, 0.9 ), this.steel );
			leg.position.set( lx, STREET + ( y0 - STREET ) / 2, 1.2 );
			leg.castShadow = true;
			g.add( leg );

		}

		// the script's frame: black steel, a lattice tower at each end and a Warren truss across
		const blackSteel = this._blackSteel || ( this._blackSteel = standard( { name: 'script-steel', color: new Color( 0.012, 0.011, 0.013 ), roughness: 0.6, metalness: 0.4 } ) );
		blackSteel.underwaterLighting = 'none';
		const SW = W * 0.8, SH = W * 0.36;
		const tq = new Quads();
		for ( const ex of [ - SW * 0.44, SW * 0.44 ] ) {

			for ( const [ ox, oz ] of [ [ - 0.45, 0.2 ], [ 0.45, 0.2 ], [ - 0.45, 1.1 ], [ 0.45, 1.1 ] ] ) beam( tq, [ ex + ox, y0 + H, oz ], [ ex + ox, y0 + H + SH * 0.85, oz ], 0.14 );
			for ( let yy = y0 + H + 1.2, k = 0; yy < y0 + H + SH * 0.85; yy += 1.2, k ++ ) beam( tq, [ ex - 0.45, yy - 1.2, 0.2 ], [ ex + 0.45, yy, 0.2 ], 0.06 );

		}

		const ty = y0 + H + SH * 0.3;
		for ( const yy of [ ty, ty + 1.1 ] ) beam( tq, [ - SW * 0.44, yy, 0.6 ], [ SW * 0.44, yy, 0.6 ], 0.16 );
		for ( let k = 0; k < 16; k ++ ) {

			const xa = - SW * 0.44 + SW * 0.88 * k / 16, xb = - SW * 0.44 + SW * 0.88 * ( k + 1 ) / 16;
			beam( tq, [ xa, k % 2 ? ty + 1.1 : ty, 0.6 ], [ xb, k % 2 ? ty : ty + 1.1, 0.6 ], 0.08 );

		}

		// and the legs' X-braced band under the board
		for ( let k = 0; k < 8; k ++ ) {

			const xa = - W / 2 + W * k / 8, xb = - W / 2 + W * ( k + 1 ) / 8;
			beam( tq, [ xa, y0 - 0.9, 0.9 ], [ xb, y0, 0.9 ], 0.12 );
			beam( tq, [ xa, y0, 0.9 ], [ xb, y0 - 0.9, 0.9 ], 0.12 );

		}

		beam( tq, [ - W / 2, y0 - 0.9, 0.9 ], [ W / 2, y0 - 0.9, 0.9 ], 0.25 );
		const tm = new Mesh( tq.geometry(), blackSteel );
		tm.castShadow = true;
		g.add( tm );

		// the script and its two stars
		const sign = canvasTexture( 1024, 460, ( ctx, w, h ) => {

			ctx.clearRect( 0, 0, w, h );
			ctx.font = 'italic 700 300px Georgia, "Times New Roman", serif';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.lineWidth = 18;
			ctx.lineJoin = 'round';
			ctx.strokeStyle = '#f2ead0';
			ctx.strokeText( 'Phillies', w / 2, h / 2 + 22, w - 20 );
			ctx.fillStyle = '#c8102e';
			ctx.fillText( 'Phillies', w / 2, h / 2 + 22, w - 20 );
			// the swash sweeping back under the word
			ctx.beginPath();
			ctx.moveTo( w * 0.9, h * 0.8 );
			ctx.bezierCurveTo( w * 0.7, h * 0.95, w * 0.3, h * 0.9, w * 0.12, h * 0.84 );
			ctx.lineWidth = 22; ctx.strokeStyle = '#f2ead0'; ctx.stroke();
			ctx.lineWidth = 12; ctx.strokeStyle = '#c8102e'; ctx.stroke();
			// the stars dot the i's
			const full = Math.min( w - 20, ctx.measureText( 'Phillies' ).width ), k = full / ctx.measureText( 'Phillies' ).width, x0 = w / 2 - full / 2;
			for ( const pre of [ 'Ph', 'Phill' ] ) star( ctx, x0 + ( ctx.measureText( pre ).width + ctx.measureText( 'i' ).width * 0.6 ) * k + 8, h * 0.2, 30, '#1d3f8f' );

		}, 'scriptSign' );
		// channel letters: the lit faces toward the field; behind them, the letters' maroon backs (the same
		// outline, 0.9 m back, seen reversed from outside as they should be) and their returns between
		const signMat = standard( {
			name: 'script-sign', roughness: 0.5, alphaTest: 0.5, textures: { bpScript: sign },
			surface: 'let t = textureSample( bpScript, smpAnisoClamp, in.uv ); s.alpha = t.a; s.albedo = t.rgb * 0.6; s.emissive = t.rgb * mix( 0.2, 2.2, frame.night );',
		} );
		const backMat = standard( {
			name: 'script-backs', color: new Color( 0.1, 0.022, 0.022 ), roughness: 0.6, metalness: 0.3, alphaTest: 0.5, side: 'double', textures: { bpScript: sign },
			surface: 'let t = textureSample( bpScript, smpAnisoClamp, in.uv ); s.alpha = t.a;',
		} );
		for ( const m of [ signMat, backMat ] ) m.underwaterLighting = 'none';
		g.add( new Mesh( quadUV( SW, SH, y0 + H + 0.6, - 0.2 ), signMat ) );
		for ( let k = 1; k <= 6; k ++ ) g.add( new Mesh( quadUV( SW, SH, y0 + H + 0.6, - 0.2 + k * 0.12 ), backMat ) );

		// the cabinet's back and sides: light royal-blue ribbed siding, a column of louvres up one side,
		// and on the back a huge Phillies cap and ball on navy with Citizens Bank Park along the top
		const siding = standard( { name: 'board-siding', color: new Color( 0.03, 0.11, 0.39 ), roughness: 0.45, metalness: 0.6,
			surface: /* wgsl */`
	let N = abs( in.N );
	let u = select( in.P.x, in.P.z, N.x > N.z );
	let fw = fwidth( u ) / 0.1;
	let rib = 0.85 + 0.15 * step( 0.5, fract( u / 0.1 ) ) * ( 1.0 - clamp( fw * 2.0, 0.0, 1.0 ) );
	s.albedo = mat.color * rib;
` } );
		siding.underwaterLighting = 'none';
		const shell = new Mesh( new BoxGeometry( W + 1.3, H + 1.3, 1.1 ), siding );
		shell.position.set( 0, y0 + H / 2, 0.06 );
		g.add( shell );
		const rear = canvasTexture( 1024, 832, ( ctx, w, h ) => {

			ctx.fillStyle = '#14254f';
			ctx.fillRect( 0, 0, w, h );
			// the cap: red crown, bill, white P
			ctx.fillStyle = '#c8102e';
			ctx.beginPath(); ctx.ellipse( w * 0.38, h * 0.55, w * 0.22, h * 0.26, 0, Math.PI, 0 ); ctx.fill();
			ctx.fillRect( w * 0.16, h * 0.54, w * 0.44, h * 0.06 );
			ctx.beginPath(); ctx.ellipse( w * 0.52, h * 0.62, w * 0.2, h * 0.05, - 0.1, 0, Math.PI * 2 ); ctx.fill();
			ctx.fillStyle = '#ffffff';
			ctx.font = 'italic 700 250px Georgia, serif';
			ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
			ctx.fillText( 'P', w * 0.37, h * 0.42 );
			// the ball
			ctx.beginPath(); ctx.arc( w * 0.76, h * 0.58, h * 0.14, 0, Math.PI * 2 ); ctx.fill();
			ctx.strokeStyle = '#c8102e'; ctx.lineWidth = 8;
			ctx.beginPath(); ctx.arc( w * 0.66, h * 0.58, h * 0.11, - 0.9, 0.9 ); ctx.stroke();
			ctx.beginPath(); ctx.arc( w * 0.86, h * 0.58, h * 0.11, Math.PI - 0.9, Math.PI + 0.9 ); ctx.stroke();
			ctx.fillStyle = '#1a9a50';
			ctx.font = '800 64px "Helvetica Neue", Arial, sans-serif';
			ctx.fillText( 'Citizens Bank Park', w / 2, h * 0.1 );

		}, 'boardRear' );
		const rearMat = standard( { name: 'board-rear', roughness: 0.55, textures: { bpRear: rear }, surface: 'let t = textureSample( bpRear, smpAnisoClamp, in.uv ).rgb; s.albedo = t * 0.8; s.emissive = t * step( 0.5, t.g - t.r ) * smoothstep( 0.1, 0.7, frame.night ) * 1.5;' } );
		rearMat.underwaterLighting = 'none';
		const rq = new Quads();
		// seen from behind (looking along -z in the group), +x is on the viewer's right
		const zr = 0.62;
		rq.tri( [ - W / 2, y0, zr ], [ W / 2, y0, zr ], [ W / 2, y0 + H, zr ], [ 0, 0, 1 ], [ 0, 1 ], [ 1, 1 ], [ 1, 0 ] );
		rq.tri( [ - W / 2, y0, zr ], [ W / 2, y0 + H, zr ], [ - W / 2, y0 + H, zr ], [ 0, 0, 1 ], [ 0, 1 ], [ 1, 0 ], [ 0, 0 ] );
		g.add( new Mesh( rq.geometry(), rearMat ) );
		// louvres up the side
		const louvre = standard( { name: 'board-louvres', color: new Color( 0.015, 0.06, 0.22 ), roughness: 0.5, metalness: 0.5,
			surface: 's.albedo = mat.color * ( 0.6 + 0.4 * step( 0.5, fract( in.P.y / 0.12 ) ) );' } );
		louvre.underwaterLighting = 'none';
		for ( let k = 0; k < 9; k ++ ) {

			const lv = new Mesh( new BoxGeometry( 0.08, 0.8, 1.6 ), louvre );
			lv.position.set( - W / 2 - 0.68, y0 + 1.5 + k * ( H - 3 ) / 8, 0.06 );
			g.add( lv );

		}

		// beneath: green neon "Citizens Bank Park", and the awnings of Harry the K's
		const neon = canvasTexture( 1024, 128, ( ctx, w, h ) => {

			ctx.clearRect( 0, 0, w, h );
			ctx.font = '600 92px "Helvetica Neue", Helvetica, Arial, sans-serif';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.shadowColor = '#3cff7a';
			ctx.shadowBlur = 14;
			ctx.fillStyle = '#39d86b';
			ctx.fillText( '✳ Citizens Bank Park', w / 2, h / 2 + 4 );

		}, 'neonName' );
		const neonMat = standard( {
			name: 'neon', roughness: 0.4, alphaTest: 0.3, textures: { bpNeon: neon },
			surface: 'let t = textureSample( bpNeon, smpAnisoClamp, in.uv ); s.alpha = t.a; s.albedo = t.rgb * 0.2; s.emissive = t.rgb * mix( 1.2, 3.0, frame.night );',
		} );
		neonMat.underwaterLighting = 'none';
		// Harry the K's Broadcast Bar under the board: two brick storeys at the top of the left field upper
		// deck, the bar's glass under navy awnings facing the field, the green Citizens Bank Park letters
		// across the brick above
		const hb = this._hkBrick || ( this._hkBrick = standard( { name: 'harrys-brick', color: new Color( 0.26, 0.075, 0.045 ), roughness: 0.85, modules: [ commonModule ],
			surface: /* wgsl */`
	let row = floor( in.P.y / 0.075 );
	let N = abs( in.N );
	let u = select( in.P.x, in.P.z, N.x > N.z );
	let bu = u / 0.2 + 0.5 * ( row % 2.0 );
	let fr = clamp( fwidth( in.P.y ) / 0.075 * 1.5 - 0.25, 0.0, 1.0 );
	let mortar = mix( step( 0.88, fract( in.P.y / 0.075 ) ) + step( 0.93, fract( bu ) ), 0.15, fr );
	s.albedo = mix( mat.color * ( 0.9 + 0.2 * mx_noise_float2( floor( vec2f( bu, row ) ) * 0.37 ) ), vec3f( 0.42, 0.4, 0.36 ), clamp( mortar, 0.0, 1.0 ) * 0.75 );
` } ) );
		hb.underwaterLighting = 'none';
		// Harry the K's: its facade 3 m in front of the board, the bar's glass storey on a patio over the
		// porch, three awnings over it, the brick above carrying the neon letters up to the board's legs
		const HW = W + 4, FZ = - 3.0, patio = y0 - 7.3, HY1 = y0 - 0.9;
		const house = new Mesh( new BoxGeometry( HW, HY1 - STREET, 9 ), hb );
		house.position.set( - 2, STREET + ( HY1 - STREET ) / 2, FZ + 4.5 );
		house.castShadow = true;
		house.receiveShadow = true;
		g.add( house );
		// the patio slab out to the porch, with its rail
		const slab = new Mesh( new BoxGeometry( HW, 0.4, 4.6 ), this.steel );
		slab.position.set( - 2, patio - 0.2, FZ - 2.3 );
		slab.receiveShadow = true;
		g.add( slab );
		const rq2 = new Quads();
		for ( const yy of [ patio + 0.55, patio + 1.07 ] ) beam( rq2, [ - HW / 2 - 2, yy, FZ - 4.55 ], [ HW / 2 - 2, yy, FZ - 4.55 ], 0.05 );
		for ( let xx = - HW / 2 - 2; xx <= HW / 2 - 2; xx += 1.8 ) beam( rq2, [ xx, patio, FZ - 4.55 ], [ xx, patio + 1.07, FZ - 4.55 ], 0.045 );
		g.add( new Mesh( rq2.geometry(), this.rail || this.steel ) );
		const bar = canvasTexture( 1024, 128, ( ctx, w, h ) => {

			// the bar's glass: warm light, people-height shapes, mullions
			ctx.fillStyle = '#1a1510'; ctx.fillRect( 0, 0, w, h );
			for ( let x = 0; x < w; x += 64 ) {

				ctx.fillStyle = '#b88a50'; ctx.fillRect( x + 4, 8, 56, h - 16 );
				ctx.fillStyle = 'rgba( 30, 20, 12, 0.6 )'; ctx.fillRect( x + 18, 60, 14, h - 68 );

			}

		}, 'harrysGlass' );
		const barMat = standard( { name: 'harrys-glass', roughness: 0.1, textures: { bpBar: bar },
			surface: 'let t = textureSample( bpBar, smpAnisoRepeat, in.uv ).rgb; s.albedo = t * 0.12; s.emissive = t * mix( 0.05, 0.35, frame.night );' } );
		barMat.underwaterLighting = 'none';
		const gq = new Quads();
		const gz = FZ - 0.02, gy0 = patio, gy1 = patio + 2.9;
		gq.tri( [ HW / 2 - 2, gy0, gz ], [ - HW / 2 - 2, gy0, gz ], [ - HW / 2 - 2, gy1, gz ], [ 0, 0, - 1 ], [ 0, 1 ], [ 8, 1 ], [ 8, 0 ] );
		gq.tri( [ HW / 2 - 2, gy0, gz ], [ - HW / 2 - 2, gy1, gz ], [ HW / 2 - 2, gy1, gz ], [ 0, 0, - 1 ], [ 0, 1 ], [ 8, 0 ], [ 0, 0 ] );
		g.add( new Mesh( gq.geometry(), barMat ) );
		// three slate-navy awnings, HARRY THE K'S on their valances
		const awning = standard( { name: 'harrys-awnings', color: new Color( 0.024, 0.045, 0.09 ), roughness: 0.75, side: 'double' } );
		awning.underwaterLighting = 'none';
		const awq = new Quads();
		const ay = gy1 + 0.2;
		for ( let k = 0; k < 3; k ++ ) {

			const xa = HW / 2 - 2 - k * HW / 3 - 0.3, xb = xa - HW / 3 + 0.6;
			awq.add( [ xa, ay + 0.9, gz ], [ xb, ay + 0.9, gz ], [ xb, ay, gz - 1.8 ], [ xa, ay, gz - 1.8 ], [ 0, 0.8, - 0.5 ] );

		}

		g.add( new Mesh( awq.geometry(), awning ) );
		const hk = canvasTexture( 1024, 64, ( ctx, w, h ) => {

			ctx.fillStyle = '#2b3f57'; ctx.fillRect( 0, 0, w, h );
			ctx.fillStyle = '#f2ede1'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
			ctx.font = "700 34px 'Helvetica Neue', Arial, sans-serif";
			ctx.fillText( "HARRY THE K'S  \u2022  BROADCAST BAR & GRILLE", w / 2, h / 2 + 2, w - 20 );

		}, 'harrysSign' );
		const hkMat = standard( { name: 'harrys-sign', roughness: 0.5, textures: { bpHK: hk }, surface: 'let t = textureSample( bpHK, smpAnisoClamp, in.uv ).rgb; s.albedo = t * 0.7; s.emissive = t * step( 0.5, t.r ) * mix( 0.2, 1.0, frame.night );' } );
		hkMat.underwaterLighting = 'none';
		for ( let k = 0; k < 3; k ++ ) {

			const xc = HW / 2 - 2 - ( k + 0.5 ) * HW / 3;
			const vq = new Mesh( quadUV( HW / 3 - 0.8, 0.45, ay - 0.45, gz - 1.82 ), hkMat );
			vq.position.x = xc;
			g.add( vq );

		}

		// the green neon letters and the bank's emblem across the brick, flood lamps under the board
		g.add( new Mesh( quadUV( W * 0.83, W * 0.83 / 8, ay + 1.3, FZ - 0.05 ), neonMat ) );
		const fl = new Quads();
		for ( let k = 0; k < 8; k ++ ) boxQuads( fl, [ - W * 0.42 + W * 0.84 * k / 7, y0 - 0.3, FZ - 0.5 ], [ 0.5, 0.35, 0.4 ] );
		g.add( new Mesh( fl.geometry(), this.floodMat || ( this.floodMat = standard( { name: 'board-floods', color: new Color( 0.1, 0.1, 0.1 ), roughness: 0.4, surface: 's.emissive = vec3f( 1.0, 0.95, 0.85 ) * smoothstep( 0.2, 0.8, frame.night ) * 3.0 * step( in.N.y, -0.5 );' } ) ) ) );

		// beside the board's center field edge, the light tower: a broad lattice from the street to its
		// lamp bank high over the script, the four sponsors' panels hung on its field face with gaps
		// between them (TOYOTA, Choose Blue., W.B. MASON, Budweiser, top to bottom)
		const TW = 13, tcx = - ( W / 2 + 0.8 + TW / 2 );
		g.updateMatrix();
		const tw = new Vector3( tcx, 0, 4.0 ).applyMatrix4( g.matrix );
		this.bowl._lightTower( tw.x, tw.z, STREET, y0 + H + SH + 6, [ TW, 6 ] );
		const ads = [ [ 'TOYOTA', '#e00d1d', '#ffffff' ], [ 'Choose Blue.', '#1b5eb8', '#ffffff' ], [ 'W.B. MASON', '#d71920', '#f4de3a' ], [ 'Budweiser', '#c8102e', '#ffffff' ] ];
		const adTex = canvasTexture( 512, 214 * 4, ( ctx, w ) => {

			ads.forEach( ( [ text, fg, bg ], i ) => {

				const y = i * 214;
				ctx.fillStyle = bg;
				ctx.fillRect( 0, y, w, 214 );
				ctx.strokeStyle = '#1b2233';
				ctx.lineWidth = 10;
				ctx.strokeRect( 5, y + 5, w - 10, 204 );
				ctx.font = ( i === 3 ? 'italic 700 110px Georgia, serif' : '800 100px "Helvetica Neue", Helvetica, Arial, sans-serif' );
				ctx.fillStyle = fg;
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.fillText( text, w / 2, y + 112, w - 40 );

			} );

		}, 'boardAds' );
		const adMat = standard( { name: 'board-ads', roughness: 0.5, textures: { bpAd: adTex }, surface: 'let t = textureSample( bpAd, smpAnisoClamp, in.uv ).rgb; s.albedo = t * 0.6; s.emissive = t * mix( 0.25, 0.9, frame.night );' } );
		adMat.underwaterLighting = 'none';
		const aq = new Quads();
		const PW = 11, PH = 4.6, gap = 1.8, zf = 0.6;
		for ( let k = 0; k < 4; k ++ ) {

			const top = y0 + H + 2 - k * ( PH + gap ), bot = top - PH;
			// seen from home plate +x is on the left: u runs toward -x
			const xl = tcx + PW / 2, xr = tcx - PW / 2, v0 = k / 4, v1 = ( k + 1 ) / 4;
			aq.tri( [ xl, bot, zf ], [ xr, bot, zf ], [ xr, top, zf ], [ 0, 0, - 1 ], [ 0, v1 ], [ 1, v1 ], [ 1, v0 ] );
			aq.tri( [ xl, bot, zf ], [ xr, top, zf ], [ xl, top, zf ], [ 0, 0, - 1 ], [ 0, v1 ], [ 1, v0 ], [ 0, v0 ] );

		}

		g.add( new Mesh( aq.geometry(), adMat ) );

		this.scoreboard = g;

	}

	// redraw the board with the game's state (Director.boardState())
	updateScoreboard( state ) {

		const c = this.boardCanvas, ctx = c.getContext( '2d' );
		drawBoard2008( ctx, c.width, c.height, state );
		refreshCanvasTexture( this.scoreboardTexture, c );

	}

	// ---------------------------------------------------------------- the Liberty Bell

	_libertyBell() {

		const [ x, z ] = fencePoint( 21, 488 );
		const g = this._facingHome( x, z );
		const H = 50 * FT, W = 35 * FT, y0 = STREET + 100 * FT;
		// the mast: a maroon steel lattice up to the bell
		lattice( g, this.steel, 0, 1.6, STREET, y0 + 2, 3.4 );

		// under the bell: a broad maroon lattice frame carrying Citizens Bank / Park in big green channel
		// letters (white returns) with the bank's logo
		const FW = 20, FH = 10.5, fy = y0 - FH - 1.2, fz = 0.2;
		const fq = new Quads();
		for ( const fx of [ - FW / 2, - FW / 6, FW / 6, FW / 2 ] ) beam( fq, [ fx, fy, fz ], [ fx, fy + FH, fz ], 0.4 );
		for ( const yy of [ fy, fy + FH / 2, fy + FH ] ) beam( fq, [ - FW / 2, yy, fz ], [ FW / 2, yy, fz ], 0.4 );
		for ( let k = 0; k < 3; k ++ ) {

			const xa = - FW / 2 + k * FW / 3, xb = xa + FW / 3;
			for ( const [ ya, yb ] of [ [ fy, fy + FH / 2 ], [ fy + FH / 2, fy + FH ] ] ) {

				beam( fq, [ xa, ya, fz ], [ xb, yb, fz ], 0.18 );
				beam( fq, [ xb, ya, fz ], [ xa, yb, fz ], 0.18 );

			}

		}

		const frameMesh = new Mesh( fq.geometry(), this.steel );
		frameMesh.castShadow = true;
		g.add( frameMesh );
		const letters = canvasTexture( 1024, 540, ( ctx, w, h ) => {

			ctx.clearRect( 0, 0, w, h );
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.lineJoin = 'round';
			const line = ( t, y, size ) => {

				ctx.font = `700 ${ size }px "Helvetica Neue", Helvetica, Arial, sans-serif`;
				ctx.lineWidth = 14;
				ctx.strokeStyle = '#f2f4f0';
				ctx.strokeText( t, w / 2, y, w - 30 );
				ctx.fillStyle = '#17a05d';
				ctx.fillText( t, w / 2, y, w - 30 );

			};

			line( 'Citizens Bank', h * 0.5, 150 );
			line( 'Park', h * 0.83, 150 );
			// the logo over them: a green disc with the white eight-point star
			const ex = w / 2, ey = h * 0.17, r = 62;
			ctx.fillStyle = '#17a05d';
			ctx.beginPath(); ctx.arc( ex, ey, r, 0, Math.PI * 2 ); ctx.fill();
			ctx.fillStyle = '#ffffff';
			ctx.beginPath();
			for ( let i = 0; i < 16; i ++ ) {

				const a = i * Math.PI / 8, rr = i % 2 ? r * 0.32 : r * 0.78;
				ctx.lineTo( ex + Math.cos( a ) * rr, ey + Math.sin( a ) * rr );

			}

			ctx.closePath(); ctx.fill();

		}, 'bellLetters' );
		const letterMat = standard( { name: 'bell-letters', roughness: 0.4, alphaTest: 0.35, textures: { bpNeon: letters },
			surface: 'let t = textureSample( bpNeon, smpAnisoClamp, in.uv ); s.alpha = t.a; s.albedo = t.rgb * 0.6; s.emissive = t.rgb * vec3f( 0.6, 1.0, 0.75 ) * mix( 0.25, 2.2, frame.night );' } );
		const backMat = standard( { name: 'bell-letter-backs', color: new Color( 0.1, 0.022, 0.022 ), roughness: 0.6, alphaTest: 0.35, side: 'double', textures: { bpNeon: letters },
			surface: 'let t = textureSample( bpNeon, smpAnisoClamp, in.uv ); s.alpha = t.a;' } );
		for ( const m of [ letterMat, backMat ] ) m.underwaterLighting = 'none';
		const LW = FW - 1, LH = LW * 540 / 1024;
		g.add( new Mesh( quadUV( LW, LH, fy + ( FH - LH ) / 2, - 0.6 ), letterMat ) );
		for ( let k = 1; k <= 3; k ++ ) g.add( new Mesh( quadUV( LW, LH, fy + ( FH - LH ) / 2, - 0.6 + k * 0.13 ), backMat ) );

		// the bell: white steel, a lattice inside its silhouette; three rings of lights round the outline,
		// bands at the lip and the shoulder, the crack and the clapper in lights; the yoke on top
		const half = [ [ 0.0, 1.0 ], [ 0.13, 0.99 ], [ 0.2, 0.95 ], [ 0.22, 0.86 ], [ 0.25, 0.7 ], [ 0.29, 0.52 ], [ 0.35, 0.35 ], [ 0.43, 0.2 ], [ 0.5, 0.1 ], [ 0.5, 0.06 ] ];
		const BH = H * 0.86;
		const widthAt = ( v ) => {

			for ( let i = 0; i < half.length - 1; i ++ ) {

				const [ u0, v0 ] = half[ i ], [ u1, v1 ] = half[ i + 1 ];
				if ( v <= v0 && v >= v1 ) return ( u0 + ( u1 - u0 ) * ( v0 - v ) / ( v0 - v1 ) ) * W;

			}

			return 0;

		};

		const outlineAt = ( k, z ) => {

			const pts = [];
			for ( const [ u, v ] of half.slice().reverse() ) pts.push( new Vector3( - u * W * k, y0 + ( 0.06 + ( v - 0.06 ) * ( 1 - ( 1 - k ) * 0.5 ) ) * BH, z ) );
			for ( const [ u, v ] of half.slice( 1 ) ) pts.push( new Vector3( u * W * k, y0 + ( 0.06 + ( v - 0.06 ) * ( 1 - ( 1 - k ) * 0.5 ) ) * BH, z ) );
			return new CatmullRomCurve3( pts, true );

		};

		const lights = standard( { name: 'bell-lights', color: new Color( 0.9, 0.85, 0.7 ), roughness: 0.4,
			surface: 's.emissive = vec3f( 1.0, 0.86, 0.55 ) * mix( 0.35, 3.0, smoothstep( 0.1, 0.7, frame.night ) );' } );
		const white = standard( { name: 'bell-steel', color: new Color( 0.72, 0.72, 0.68 ), roughness: 0.45, metalness: 0.4 } );
		for ( const m of [ lights, white ] ) m.underwaterLighting = 'none';
		for ( const k of [ 1, 0.95, 0.9 ] ) g.add( new Mesh( new TubeGeometry( outlineAt( k, - 0.3 ), 200, 0.2, 8, true ), lights ) );
		const bq = new Quads();
		// the lattice: horizontal members every 1.3 m, vertical every 1.4 m, inside the silhouette
		for ( let v = 0.08; v < 0.97; v += 1.3 / BH ) {

			const wv = widthAt( v ) * 0.93;
			if ( wv > 0.3 ) beam( bq, [ - wv, y0 + v * BH, 0 ], [ wv, y0 + v * BH, 0 ], 0.12 );

		}

		for ( let x = - W * 0.49; x <= W * 0.49; x += 1.4 ) {

			let vTop = 0;
			for ( let v = 0.06; v <= 1.0; v += 0.01 ) if ( widthAt( v ) * 0.93 >= Math.abs( x ) ) vTop = v;
			if ( vTop > 0.1 ) beam( bq, [ x, y0 + 0.07 * BH, 0 ], [ x, y0 + vTop * BH, 0 ], 0.1 );

		}

		const bellSteel = new Mesh( bq.geometry(), white );
		bellSteel.castShadow = true;
		g.add( bellSteel );
		for ( const v of [ 0.12, 0.2, 0.84 ] ) {

			const wv = widthAt( v ) * 0.93;
			const band = new CatmullRomCurve3( [ new Vector3( - wv, y0 + v * BH, - 0.35 ), new Vector3( wv, y0 + v * BH, - 0.35 ) ] );
			g.add( new Mesh( new TubeGeometry( band, 20, 0.16, 6, false ), lights ) );

		}

		const crack = new CatmullRomCurve3( [ [ 0.05, 0.08 ], [ 0.02, 0.2 ], [ 0.07, 0.32 ], [ 0.03, 0.45 ], [ 0.06, 0.55 ] ].map( ( [ u, v ] ) => new Vector3( u * W, y0 + v * BH, - 0.4 ) ) );
		g.add( new Mesh( new TubeGeometry( crack, 40, 0.2, 6, false ), lights ) );
		const yq = new Quads();
		beam( yq, [ - W * 0.32, y0 + H * 0.93, 0 ], [ W * 0.32, y0 + H * 0.93, 0 ], 1.1 );
		beam( yq, [ - W * 0.32, y0 + H * 0.93, 0 ], [ - W * 0.36, y0 + H * 0.8, 0 ], 0.6 );
		beam( yq, [ W * 0.32, y0 + H * 0.93, 0 ], [ W * 0.36, y0 + H * 0.8, 0 ], 0.6 );
		beam( yq, [ 0, y0 + H * 0.86, 0 ], [ 0, y0 + H * 0.93, 0 ], 0.5 );
		const yoke = new Mesh( yq.geometry(), this.steel );
		yoke.castShadow = true;
		g.add( yoke );
		const clapper = new Mesh( new SphereGeometry( 0.9, 12, 10 ), lights );
		clapper.position.set( 0, y0 - 0.2, - 0.3 );
		g.add( clapper );
		this.bellSign = g;

	}

	// ---------------------------------------------------------------- Ashburn Alley

	// Two-storey brick buildings along the back of center field, their roofs a deck for fans (the rooftop
	// seats), flagpoles, and the retired numbers on the ones either side of center.
	_ashburnAlley() {

		const brick = standard( {
			name: 'alley-brick', color: new Color( 0.24, 0.065, 0.038 ), roughness: 0.85,
			surface: /* wgsl */`
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
		const trim = standard( { name: 'alley-trim', color: new Color( 0.55, 0.5, 0.42 ), roughness: 0.7 } );
		const rail = standard( { name: 'alley-rail', color: new Color( 0.42, 0.43, 0.44 ), roughness: 0.35, metalness: 0.8 } );
		const maroon = standard( { name: 'alley-deck-edge', color: new Color( 0.1, 0.014, 0.013 ), roughness: 0.55, metalness: 0.3 } );
		for ( const m of [ brick, trim, rail, maroon ] ) m.underwaterLighting = 'none';
		// the buildings sit along the back of the footprint behind center field, facing the field
		const blocks = [ [ - 62, - 40 ], [ - 34, - 8 ], [ 2, 30 ], [ 36, 60 ] ];
		// one storey of stands (4.5 m) under a public roof deck: a maroon steel beam along the deck's edge,
		// a galvanized picket rail on it, patio tables under red and white umbrellas up there
		const zBack = - 150.5, D = 7.5, Hb = 4.5;
		const railQ = new Quads(), umbrellas = [];
		for ( const [ x0, x1 ] of blocks ) {

			const w = x1 - x0, cx = ( x0 + x1 ) / 2, cz = zBack + D / 2;
			const b = new Mesh( new BoxGeometry( w, Hb, D ), brick );
			b.position.set( cx, STREET + Hb / 2, cz );
			b.castShadow = true;
			b.receiveShadow = true;
			this.group.add( b );
			const edge = new Mesh( new BoxGeometry( w + 0.3, 0.6, 0.4 ), maroon );
			edge.position.set( cx, STREET + Hb - 0.1, zBack + D + 0.05 );
			this.group.add( edge );
			const deck = new Mesh( new BoxGeometry( w + 0.2, 0.15, D + 0.2 ), trim );
			deck.position.set( cx, STREET + Hb + 0.07, cz );
			this.group.add( deck );
			const ry = STREET + Hb + 0.15, rz = zBack + D - 0.05;
			for ( const yy of [ ry + 1.07, ry + 0.12 ] ) beam( railQ, [ x0, yy, rz ], [ x1, yy, rz ], 0.05 );
			for ( let xx = x0; xx <= x1; xx += 0.12 ) beam( railQ, [ xx, ry + 0.12, rz ], [ xx, ry + 1.07, rz ], 0.018 );
			for ( let xx = x0 + 3; xx < x1 - 2; xx += 5.5 ) umbrellas.push( [ xx, ry, zBack + D - 2.6 ] );
			const wpos = this.field.toWorld( cx, cz );
			this.colliders.addBox( new Vector3( wpos.x, this.field.y0 + STREET + Hb / 2, wpos.z ), new Vector3( w / 2, Hb / 2, D / 2 ), this.field.group.rotation.y, { tag: 'ashburn-alley', walkable: true } );

		}

		this.group.add( new Mesh( railQ.geometry(), rail ) );
		// the patio tables and their umbrellas (red and white segments), up on the deck
		const umb = standard( { name: 'deck-umbrellas', color: new Color( 0.5, 0.03, 0.04 ), roughness: 0.7, side: 'double',
			surface: 'let a = atan2( in.P.z - floor( in.P.z ), in.P.x - floor( in.P.x ) ); s.albedo = select( vec3f( 0.8, 0.79, 0.76 ), vec3f( 0.45, 0.02, 0.03 ), fract( atan2( in.N.z, in.N.x ) / 6.2832 * 8.0 ) < 0.5 );' } );
		umb.underwaterLighting = 'none';
		const cone = new ConeGeometry( 1.3, 0.55, 16, 1, true ), table = new CylinderGeometry( 0.55, 0.55, 0.05, 16 ), post = new CylinderGeometry( 0.03, 0.03, 2.3, 6 );
		for ( const [ x, y, z ] of umbrellas ) {

			const c = new Mesh( cone, umb );
			c.position.set( x, y + 2.3, z );
			this.group.add( c );
			const p = new Mesh( post, rail );
			p.position.set( x, y + 1.15, z );
			this.group.add( p );
			const t = new Mesh( table, trim );
			t.position.set( x, y + 0.75, z );
			this.group.add( t );

		}

		this._alleyLife( blocks, zBack + D );

		// 2008: the retired numbers on two small brick buildings up on the roofs, either side of the clock:
		// 1 Ashburn, 14 Bunning, 20 Schmidt; 32 Carlton, 36 Roberts, 42 Robinson (in blue)
		const zRoof = zBack + D * 0.45;
		for ( const [ cx, nums ] of [ [ - 24, [ [ '1', 'ASHBURN' ], [ '14', 'BUNNING' ], [ '20', 'SCHMIDT' ] ] ], [ 10, [ [ '32', 'CARLTON' ], [ '36', 'ROBERTS' ], [ '42', 'ROBINSON' ] ] ] ] ) {

			const bw = 12, bh = 4.5, by = STREET + Hb + 0.15;
			const b = new Mesh( new BoxGeometry( bw, bh, 5 ), brick );
			b.position.set( cx, by + bh / 2, zRoof );
			b.castShadow = true;
			b.receiveShadow = true;
			this.group.add( b );
			const cap = new Mesh( new BoxGeometry( bw + 0.4, 0.4, 5.4 ), trim );
			cap.position.set( cx, by + bh, zRoof );
			this.group.add( cap );
			const tex = canvasTexture( 1536, 512, ( ctx, w, h ) => {

				ctx.clearRect( 0, 0, w, h );
				nums.forEach( ( [ n, name ], i ) => {

					const x = ( i + 0.5 ) * w / 3;
					ctx.textAlign = 'center';
					ctx.font = '800 230px "Helvetica Neue", Arial, sans-serif';
					ctx.lineWidth = 10; ctx.lineJoin = 'round'; ctx.strokeStyle = '#ffffff';
					ctx.strokeText( n, x, h * 0.62 );
					ctx.fillStyle = n === '42' ? '#1d3f8f' : '#c8102e';
					ctx.fillText( n, x, h * 0.62 );
					// the name on a red plate
					ctx.fillStyle = '#c8102e';
					ctx.fillRect( x - 170, h * 0.74, 340, 70 );
					ctx.fillStyle = '#ffffff';
					ctx.font = '700 52px "Helvetica Neue", Arial, sans-serif';
					ctx.fillText( name, x, h * 0.74 + 52, 320 );

				} );

			}, 'retired' );
			const m = standard( { name: 'retired-numbers', roughness: 0.7, alphaTest: 0.3, textures: { bpNums: tex }, surface: 'let t = textureSample( bpNums, smpAnisoClamp, in.uv ); s.alpha = t.a; s.albedo = t.rgb * 0.8;' } );
			m.underwaterLighting = 'none';
			const q = new Quads();
			const x0 = cx - bw / 2 + 0.4, x1 = cx + bw / 2 - 0.4, y0 = by + 0.3, y1 = by + bh - 0.5, z = zRoof + 2.52;
			q.add( [ x0, y0, z ], [ x1, y0, z ], [ x1, y1, z ], [ x0, y1, z ], [ 0, 0, 1 ] );
			const g = q.geometry();
			const uv = g.getAttribute( 'uv' ).array, pos = g.getAttribute( 'position' ).array;
			for ( let i = 0; i < uv.length / 2; i ++ ) {

				uv[ i * 2 ] = ( pos[ i * 3 ] - x0 ) / ( x1 - x0 );
				uv[ i * 2 + 1 ] = 1 - ( pos[ i * 3 + 1 ] - y0 ) / ( y1 - y0 );

			}

			this.group.add( new Mesh( g, m ) );
			// a black barn lamp over each number, lit at night
			for ( let i = 0; i < 3; i ++ ) {

				const lx = x0 + ( x1 - x0 ) * ( i + 0.5 ) / 3;
				const shade = new Mesh( new ConeGeometry( 0.28, 0.25, 12, 1, true ), this.barnMat || ( this.barnMat = standard( { name: 'barn-lamps', color: new Color( 0.02, 0.02, 0.02 ), roughness: 0.5, side: 'double',
					surface: 's.emissive = vec3f( 1.0, 0.85, 0.6 ) * step( in.N.y, -0.3 ) * smoothstep( 0.1, 0.7, frame.night ) * 6.0;' } ) ) );
				shade.position.set( lx, y1 + 0.45, z + 0.5 );
				this.group.add( shade );
				const arm = new Mesh( new BoxGeometry( 0.05, 0.05, 0.55 ), rail );
				arm.position.set( lx, y1 + 0.6, z + 0.27 );
				this.group.add( arm );

			}

		}

		// the clock between them: a square white face with bar markers in a navy frame, on maroon steel over
		// a brick pier, the Sherwin-Williams sign under it
		this._clock( - 7, zRoof, STREET + Hb, brick );

		// the Richie Ashburn statue on the Alley: the posed bronze (his swing, the follow-through) on a
		// polished dark granite plinth with its plate
		const bronze = standard( { name: 'ashburn-bronze', color: new Color( 0.2, 0.12, 0.05 ), roughness: 0.35, metalness: 0.9, modules: [ commonModule ],
			surface: 'let n = mx_noise_float3( in.P * 2.5 ) * 0.5 + 0.5; s.albedo = mix( mat.color, vec3f( 0.06, 0.1, 0.07 ), smoothstep( 0.7, 0.95, n ) * 0.5 ) * ( 0.8 + 0.3 * mx_noise_float3( in.P * 9.0 ) );' } );
		const granite = standard( { name: 'ashburn-granite', color: new Color( 0.03, 0.03, 0.032 ), roughness: 0.2, metalness: 0.1 } );
		for ( const m of [ bronze, granite ] ) m.underwaterLighting = 'none';
		const ash = new Group();
		ash.position.set( - 2, STREET, zBack + D + 3.5 );
		const ped = new Mesh( new BoxGeometry( 1.8, 1.5, 1.8 ), granite );
		ped.position.y = 0.75;
		ped.castShadow = true;
		ash.add( ped );
		const pose = Motions.swing( 0.45 );
		pose.head = [ - 0.2, 0.4 ];
		const fig = new Mesh( bakePose( pose ), bronze );
		fig.position.y = 1.5;
		fig.scale.setScalar( 1.15 );
		fig.castShadow = true;
		ash.add( fig );
		const plate = canvasTexture( 512, 160, ( ctx, w, h ) => {

			ctx.fillStyle = '#1a1714'; ctx.fillRect( 0, 0, w, h );
			ctx.fillStyle = '#c9a44a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
			ctx.font = '700 52px Georgia, serif'; ctx.fillText( 'RICHIE ASHBURN', w / 2, h * 0.4 );
			ctx.font = '500 32px Georgia, serif'; ctx.fillText( '1948 - 1959', w / 2, h * 0.76 );

		}, 'ashburnPlate' );
		const pm = standard( { name: 'ashburn-plate', roughness: 0.3, metalness: 0.4, textures: { bpPlate: plate }, surface: 's.albedo = textureSample( bpPlate, smpAnisoClamp, in.uv ).rgb;' } );
		pm.underwaterLighting = 'none';
		ash.add( new Mesh( quadUV( 1.4, 0.44, 0.7, - 0.905 ), pm ) );
		ash.rotation.y = Math.PI;
		this.group.add( ash );

		// the rooftop bleachers in right-center: seven rows of backless aluminium benches with blue plastic
		// planks on galvanized frames, 0.4 m risers of light concrete, two stair aisles with centre
		// handrails, a blue picket guardrail along the front and open sides
		const concrete = standard( { name: 'rooftop-steps', color: new Color( 0.45, 0.44, 0.41 ), roughness: 0.85 } );
		const plank = standard( { name: 'rooftop-planks', color: new Color( 0.03, 0.1, 0.45 ), roughness: 0.45 } );
		const alum = standard( { name: 'rooftop-frames', color: new Color( 0.42, 0.44, 0.46 ), roughness: 0.4, metalness: 0.8 } );
		const blueRail = standard( { name: 'rooftop-rail', color: new Color( 0.02, 0.05, 0.28 ), roughness: 0.45, metalness: 0.5 } );
		for ( const m of [ concrete, plank, alum, blueRail ] ) m.underwaterLighting = 'none';
		const cq = new Quads(), pq = new Quads(), aq = new Quads(), rq = new Quads();
		const RD = 0.85, RR = 0.4, rows = 7;
		for ( const [ x0, x1 ] of [ [ 2, 30 ], [ 36, 60 ] ] ) {

			const y0 = STREET + Hb, zf = zBack + D - 0.2;
			const aisles = [ x0 + ( x1 - x0 ) / 3, x0 + 2 * ( x1 - x0 ) / 3 ];
			for ( let r = 0; r < rows; r ++ ) {

				const yT = y0 + RR * ( r + 1 ), za = zf - r * RD, zb = za - RD;
				// the tread and its riser
				box( cq, [ ( x0 + x1 ) / 2, yT - RR / 2, ( za + zb ) / 2 ], [ x1 - x0 - 0.6, RR, RD ] );
				// the benches between the aisles: a plank on frames every 1.8 m
				const spans = [ [ x0 + 0.4, aisles[ 0 ] - 0.6 ], [ aisles[ 0 ] + 0.6, aisles[ 1 ] - 0.6 ], [ aisles[ 1 ] + 0.6, x1 - 0.4 ] ];
				for ( const [ a, b ] of spans ) {

					box( pq, [ ( a + b ) / 2, yT + 0.43, za - RD * 0.45 ], [ b - a, 0.05, 0.3 ] );
					for ( let x = a + 0.2; x < b; x += 1.8 ) {

						beam( aq, [ x, yT, za - RD * 0.35 ], [ x, yT + 0.41, za - RD * 0.45 ], 0.05 );
						beam( aq, [ x, yT, za - RD * 0.6 ], [ x, yT + 0.41, za - RD * 0.45 ], 0.05 );

					}

				}

			}

			// the stair aisles' centre handrails
			for ( const ax of aisles ) {

				beam( rq, [ ax, y0 + RR + 0.9, zf ], [ ax, y0 + RR * rows + 0.9, zf - RD * ( rows - 1 ) ], 0.05 );
				for ( let r = 0; r < rows; r += 3 ) beam( rq, [ ax, y0 + RR * ( r + 1 ), zf - RD * r ], [ ax, y0 + RR * ( r + 1 ) + 0.9, zf - RD * r ], 0.05 );

			}

			// the front and side guardrail: posts, top rail and pickets every 10 cm
			const guard = ( a, b ) => {

				const [ ax, ay, az ] = a, [ bx, by, bz ] = b;
				const l = Math.hypot( bx - ax, bz - az );
				beam( rq, [ ax, ay + 1.1, az ], [ bx, by + 1.1, bz ], 0.06 );
				beam( rq, [ ax, ay + 0.1, az ], [ bx, by + 0.1, bz ], 0.04 );
				for ( let t = 0; t <= 1; t += 0.1 / l ) beam( rq, [ ax + ( bx - ax ) * t, ay + ( by - ay ) * t, az + ( bz - az ) * t ], [ ax + ( bx - ax ) * t, ay + ( by - ay ) * t + 1.1, az + ( bz - az ) * t ], 0.022 );

			};

			guard( [ x0 + 0.3, y0, zf + 0.1 ], [ x1 - 0.3, y0, zf + 0.1 ] );
			for ( const x of [ x0 + 0.3, x1 - 0.3 ] ) guard( [ x, y0, zf + 0.1 ], [ x, y0 + RR * rows, zf - RD * rows ] );

		}

		for ( const [ q, m, name ] of [ [ cq, concrete, 'rooftop-steps' ], [ pq, plank, 'rooftop-planks' ], [ aq, alum, 'rooftop-frames' ], [ rq, blueRail, 'rooftop-rails' ] ] ) {

			const mesh = new Mesh( q.geometry(), m );
			mesh.name = name;
			mesh.castShadow = true;
			mesh.receiveShadow = true;
			this.group.add( mesh );

		}

		// flagpoles behind center field: the flags wave in the wind (see Flags)
		this.flags = new Flags( this.group, [ - 20, - 12, - 4, 4, 12, 20 ].map( ( x, i ) => ( { x, z: zBack + 1, y0: STREET + Hb, h: [ 19, 22, 26, 22, 19, 17 ][ i ] } ) ), trim );

	}

	// The Alley's life: the concession stands in the buildings' ground floors (signs over the counters,
	// menu boards, striped awnings, the kitchens glowing), lamp posts with Ashburn Alley banners, a floor
	// of concrete banded in brick, and picnic tables by Bull's BBQ.
	_alleyLife( blocks, zFront ) {

		// each stand its own sign (drawn in its own style), a menu board over an open counter onto a
		// lit kitchen, a flat dark canopy with downlights over it, and TVs on the piers between
		const vendors = [
			[ "BULL'S BBQ", ( c, W, H ) => {

				c.fillStyle = '#4a120a'; c.fillRect( 0, 0, W, H );
				c.strokeStyle = '#e8b04a'; c.lineWidth = 6; c.strokeRect( 10, 10, W - 20, H - 20 );
				c.fillStyle = '#f2c14e'; c.font = '900 84px Georgia, serif'; c.fillText( "BULL'S", W * 0.36, H * 0.5 );
				c.font = 'italic 800 60px Georgia, serif'; c.fillText( 'BBQ', W * 0.72, H * 0.55 );

			} ],
			[ "TONY LUKE'S", ( c, W, H ) => {

				c.fillStyle = '#1a1614'; c.fillRect( 0, 0, W, H );
				c.fillStyle = '#d4202f'; c.font = '900 92px "Helvetica Neue", Arial, sans-serif'; c.fillText( "TONY LUKE'S", W / 2, H * 0.52, W - 60 );

			} ],
			[ "CHICKIE'S & PETE'S", ( c, W, H ) => {

				c.fillStyle = '#0c3c7a'; c.fillRect( 0, 0, W, H );
				c.fillStyle = '#e24a1b'; c.beginPath(); c.ellipse( 90, H / 2, 48, 34, 0, 0, Math.PI * 2 ); c.fill();
				c.fillStyle = '#f7d117'; c.font = '900 64px "Helvetica Neue", Arial, sans-serif'; c.fillText( "CHICKIE'S & PETE'S", W * 0.57, H * 0.4, W - 200 );
				c.font = '700 34px "Helvetica Neue", Arial, sans-serif'; c.fillText( 'CRAB FRIES', W * 0.57, H * 0.76 );

			} ],
			[ 'PLANET HOAGIE', ( c, W, H ) => {

				c.fillStyle = '#1d6b34'; c.fillRect( 0, 0, W, H );
				c.fillStyle = '#f5c400'; c.beginPath(); c.arc( 80, H / 2, 38, 0, Math.PI * 2 ); c.fill();
				c.strokeStyle = '#f5c400'; c.lineWidth = 6; c.beginPath(); c.ellipse( 80, H / 2, 62, 16, - 0.3, 0, Math.PI * 2 ); c.stroke();
				c.fillStyle = '#ffffff'; c.font = '900 72px "Helvetica Neue", Arial, sans-serif'; c.fillText( 'PLANET HOAGIE', W * 0.57, H * 0.53, W - 190 );

			} ],
			[ 'SEASONS PIZZA', ( c, W, H ) => {

				c.fillStyle = '#f2e8cf'; c.fillRect( 0, 0, W, H );
				c.fillStyle = '#c8102e'; c.font = '900 80px Georgia, serif'; c.fillText( 'SEASONS PIZZA', W / 2, H * 0.54, W - 60 );

			} ],
			[ "RICK'S STEAKS", ( c, W, H ) => {

				// a white box, RICKS in red under a gold crown, STEAKS
				c.fillStyle = '#f4f1ea'; c.fillRect( 0, 0, W, H );
				c.strokeStyle = '#c8102e'; c.lineWidth = 8; c.strokeRect( 8, 8, W - 16, H - 16 );
				c.fillStyle = '#d4a017';
				c.beginPath(); c.moveTo( W * 0.24, H * 0.36 ); for ( let k = 0; k <= 4; k ++ ) { c.lineTo( W * 0.24 + k * 22, H * ( k % 2 ? 0.2 : 0.12 ) ); } c.lineTo( W * 0.24 + 88, H * 0.36 ); c.closePath(); c.fill();
				c.fillStyle = '#c8102e'; c.font = '900 86px "Helvetica Neue", Arial, sans-serif'; c.fillText( 'RICKS', W * 0.42, H * 0.64 );
				c.fillStyle = '#1a1a1a'; c.font = '800 54px "Helvetica Neue", Arial, sans-serif'; c.fillText( 'STEAKS', W * 0.75, H * 0.64 );

			} ],
			[ 'BREWERYTOWN', ( c, W, H ) => {

				// a painted panel: a brewery skyline at dusk, the name across it
				const g = c.createLinearGradient( 0, 0, 0, H );
				g.addColorStop( 0, '#2a3a5c' ); g.addColorStop( 1, '#c8742a' );
				c.fillStyle = g; c.fillRect( 0, 0, W, H );
				c.fillStyle = '#2a1a10';
				for ( let x = 0; x < W; x += 90 ) c.fillRect( x, H * ( 0.55 + 0.2 * Math.abs( Math.sin( x ) ) ), 70, H );
				c.fillRect( W * 0.8, H * 0.2, 26, H );
				c.fillStyle = '#f7e6c0'; c.font = '900 76px Georgia, serif'; c.fillText( 'BREWERYTOWN', W / 2, H * 0.42, W - 60 );

			} ],
		];
		const SH = 176;
		const signs = canvasTexture( 1024, SH * vendors.length, ( ctx, W ) => {

			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			vendors.forEach( ( [ , draw ], i ) => {

				ctx.save();
				ctx.translate( 0, i * SH );
				ctx.beginPath(); ctx.rect( 0, 0, W, SH ); ctx.clip();
				draw( ctx, W, SH );
				ctx.restore();

			} );

		}, 'alleySigns' );
		const signMat = standard( { name: 'alley-signs', roughness: 0.4, textures: { bpAlley: signs },
			surface: 'let t = textureSample( bpAlley, smpAnisoClamp, in.uv ).rgb; s.albedo = t * 0.55; s.emissive = t * mix( 0.2, 0.6, frame.night );' } );
		// the canopy: dark, flat, downlights in its underside
		const awning = standard( { name: 'alley-canopy', color: new Color( 0.045, 0.028, 0.024 ), roughness: 0.6, side: 'double', modules: [ commonModule ],
			surface: `
	if ( in.N.y < - 0.5 ) {
		let g = abs( fract( vec2f( in.P.x / 1.5, 0.5 ) ) - 0.5 );
		s.emissive = vec3f( 1.0, 0.86, 0.62 ) * ( 1.0 - smoothstep( 0.05, 0.08, g.x ) ) * mix( 0.8, 2.0, frame.night );
	}
` } );
		// the kitchen through the open service window: traced 1.5 m back (the view ray into the stand) to a
		// white-tiled back wall with a stainless counter, the dark shapes of the grills and fryers, a hood
		// with its lights, the floor; warm light; the menu board across the top
		const kitchen = standard( { name: 'alley-kitchens', color: new Color( 0.06, 0.055, 0.05 ), roughness: 0.3, modules: [ commonModule ],
			surface: /* wgsl */`
	let y = in.uv.y - ${ STREET.toFixed( 3 ) };
	let xw = in.uv.x * 7.8;
	var c = vec3f( 0.0 );
	var e = vec3f( 0.0 );
	if ( y > 2.25 ) {
		// the menu board: dark with rows of white items and yellow prices
		let row = fract( ( y - 2.25 ) / 0.11 );
		let item = step( 0.35, row ) * step( row, 0.75 ) * step( 0.2, fract( xw * 0.25 ) ) * step( fract( xw * 0.25 ), 0.72 );
		c = vec3f( 0.02 );
		e = mix( vec3f( 0.0 ), select( vec3f( 1.0, 0.8, 0.2 ), vec3f( 0.9 ), fract( xw * 0.25 ) < 0.55 ), item ) * 0.6;
	} else {
		let N = normalize( in.N );
		let T = normalize( cross( vec3f( 0.0, 1.0, 0.0 ), N ) );
		let Vd = normalize( in.P - frame.cameraPos );
		let rd = vec3f( dot( Vd, T ), Vd.y, max( dot( Vd, - N ), 0.05 ) );
		let tBack = 1.5 / rd.z;
		let tFloor = select( 1e5, - y / rd.y, rd.y < 0.0 );
		let hitB = vec3f( xw, y, 0.0 ) + rd * tBack;
		var col = vec3f( 0.0 );
		if ( tFloor < tBack ) {
			col = vec3f( 0.12, 0.1, 0.09 );
		} else {
			// the back wall: white tile, the stainless counter along it, equipment shapes, the hood
			col = vec3f( 0.55, 0.53, 0.5 ) * ( 0.85 + 0.15 * step( 0.06, fract( hitB.y / 0.15 ) ) * step( 0.06, fract( hitB.x / 0.15 ) ) );
			if ( hitB.y < 0.95 ) { col = vec3f( 0.35, 0.36, 0.37 ) * ( 0.8 + 0.2 * step( 0.5, fract( hitB.x * 1.1 ) ) ); }
			let unit = fract( hitB.x / 1.6 );
			if ( hitB.y > 0.95 && hitB.y < 1.25 + 0.3 * step( 0.5, fract( hitB.x / 3.2 ) ) && unit < 0.7 ) { col = vec3f( 0.08, 0.08, 0.085 ); }
			if ( hitB.y > 1.9 ) { col = vec3f( 0.3, 0.31, 0.32 ); }
		}
		// the light: warm, brightest under the hood and near the window
		let lightK = 0.35 + 0.4 * smoothstep( 0.8, 1.9, hitB.y ) * step( tBack, tFloor );
		c = col * 0.25;
		e = col * vec3f( 1.0, 0.82, 0.6 ) * lightK;
	}
	s.albedo = c;
	s.emissive = e * mix( 0.45, 1.1, frame.night );
` } );
		const tvMat = this._alleyTV || ( this._alleyTV = standard( { name: 'alley-tvs', color: new Color( 0.02, 0.02, 0.025 ), roughness: 0.2,
			surface: 'let u = in.uv; s.emissive = mix( vec3f( 0.12, 0.3, 0.1 ), vec3f( 0.1, 0.16, 0.35 ), step( 0.45, u.y ) ) * 0.9 + vec3f( 0.5, 0.35, 0.2 ) * step( abs( u.x - 0.5 ), 0.06 ) * step( abs( u.y - 0.35 ), 0.1 ) * 0.6;' } ) );
		const steel = standard( { name: 'alley-steel', color: new Color( 0.05, 0.12, 0.08 ), roughness: 0.5, metalness: 0.5 } );
		const q = new Quads(), aw = new Quads(), glow = new Quads(), metal = new Quads(), wood = new Quads(), tv = new Quads();
		const z = zFront + 0.02;
		let k = 0;
		for ( const [ x0, x1 ] of blocks ) {

			const n = Math.max( 1, Math.round( ( x1 - x0 ) / 9 ) );
			for ( let j = 0; j < n; j ++ ) {

				const a = x0 + ( x1 - x0 ) * j / n + 0.6, b = x0 + ( x1 - x0 ) * ( j + 1 ) / n - 0.6;
				// (for the people: staff behind the counter, a line in front)
				( this.alleyStands ||= [] ).push( { mid: [ ( a + b ) / 2, z + 0.1 ], n: [ 0, 1 ], u: [ 1, 0 ], inset: 0.0 } );
				const v0 = k / vendors.length, v1 = ( k + 1 ) / vendors.length;
				k = ( k + 1 ) % vendors.length;
				// the sign, 1.4 m tall, over the canopy
				q.tri( [ a, STREET + 3.25, z ], [ b, STREET + 3.25, z ], [ b, STREET + 4.65, z ], [ 0, 0, 1 ], [ 0, v1 ], [ 1, v1 ], [ 1, v0 ] );
				q.tri( [ a, STREET + 3.25, z ], [ b, STREET + 4.65, z ], [ a, STREET + 4.65, z ], [ 0, 0, 1 ], [ 0, v1 ], [ 1, v0 ], [ 0, v0 ] );
				// the opening onto the kitchen (menu board across its top), the counter, the canopy
				glow.add( [ a + 0.3, STREET + 0.95, z - 0.01 ], [ b - 0.3, STREET + 0.95, z - 0.01 ], [ b - 0.3, STREET + 3.1, z - 0.01 ], [ a + 0.3, STREET + 0.95 + 2.15, z - 0.01 ], [ 0, 0, 1 ] );
				box( metal, [ ( a + b ) / 2, STREET + 0.93, z + 0.28 ], [ b - a - 0.4, 0.06, 0.56 ] );
				box( metal, [ ( a + b ) / 2, STREET + 0.46, z + 0.04 ], [ b - a - 0.4, 0.92, 0.08 ] );
				aw.add( [ a - 0.2, STREET + 3.2, z ], [ b + 0.2, STREET + 3.2, z ], [ b + 0.2, STREET + 3.2, z + 1.2 ], [ a - 0.2, STREET + 3.2, z + 1.2 ], [ 0, - 1, 0 ] );
				aw.add( [ a - 0.2, STREET + 3.2, z + 1.2 ], [ b + 0.2, STREET + 3.2, z + 1.2 ], [ b + 0.2, STREET + 3.4, z + 1.2 ], [ a - 0.2, STREET + 3.4, z + 1.2 ], [ 0, 0, 1 ] );
				// a TV on the pier after it
				if ( j < n - 1 || true ) {

					const tx = b + 0.6;
					tv.tri( [ tx - 0.45, STREET + 2.3, z + 0.08 ], [ tx + 0.45, STREET + 2.3, z + 0.08 ], [ tx + 0.45, STREET + 2.82, z + 0.08 ], [ 0, 0, 1 ], [ 0, 1 ], [ 1, 1 ], [ 1, 0 ] );
					tv.tri( [ tx - 0.45, STREET + 2.3, z + 0.08 ], [ tx + 0.45, STREET + 2.82, z + 0.08 ], [ tx - 0.45, STREET + 2.82, z + 0.08 ], [ 0, 0, 1 ], [ 0, 1 ], [ 1, 0 ], [ 0, 0 ] );
					box( metal, [ tx, STREET + 2.56, z + 0.04 ], [ 1.0, 0.62, 0.06 ] );

				}

			}

		}

		const tvMesh = new Mesh( tv.geometry(), tvMat );
		tvMesh.name = 'alley-tvs';
		this.group.add( tvMesh );

		// lamp posts along the Alley with a pair of vertical banners
		const banner = canvasTexture( 256, 768, ( ctx, W, H ) => {

			// a sepia photograph: Richie Ashburn sliding in, in his pinstripes, the dust flying
			const bg = ctx.createLinearGradient( 0, 120, 0, H );
			bg.addColorStop( 0, '#e3d6bd' ); bg.addColorStop( 0.7, '#c9b594' ); bg.addColorStop( 1, '#a8906c' );
			ctx.fillStyle = bg;
			ctx.fillRect( 0, 0, W, H );
			ctx.save();
			ctx.translate( W * 0.5, 430 );
			ctx.rotate( - 0.55 );
			const ink = ( a ) => `rgba( 74, 56, 38, ${ a } )`;
			// the legs out in front, the body leaning back, an arm up for balance
			ctx.fillStyle = '#efe4cf';
			ctx.beginPath(); ctx.ellipse( 0, 0, 46, 110, 0, 0, Math.PI * 2 ); ctx.fill();
			ctx.beginPath(); ctx.ellipse( 30, 150, 28, 110, - 0.35, 0, Math.PI * 2 ); ctx.fill();
			ctx.beginPath(); ctx.ellipse( - 25, 160, 26, 100, 0.25, 0, Math.PI * 2 ); ctx.fill();
			ctx.strokeStyle = ink( 0.35 ); ctx.lineWidth = 2;
			for ( let x = - 44; x <= 44; x += 9 ) { ctx.beginPath(); ctx.moveTo( x, - 100 ); ctx.lineTo( x, 100 ); ctx.stroke(); }
			ctx.fillStyle = ink( 0.8 );
			ctx.beginPath(); ctx.ellipse( 44, 250, 24, 12, - 0.35, 0, Math.PI * 2 ); ctx.fill();
			ctx.beginPath(); ctx.ellipse( - 45, 250, 22, 12, 0.25, 0, Math.PI * 2 ); ctx.fill();
			ctx.fillStyle = '#b89c78';
			ctx.beginPath(); ctx.ellipse( 0, - 135, 30, 34, 0, 0, Math.PI * 2 ); ctx.fill();
			ctx.fillStyle = ink( 0.85 );
			ctx.beginPath(); ctx.ellipse( 0, - 156, 32, 16, 0, Math.PI, 0 ); ctx.fill();
			ctx.fillRect( - 32, - 158, 52, 8 );
			ctx.strokeStyle = '#efe4cf'; ctx.lineWidth = 22; ctx.lineCap = 'round';
			ctx.beginPath(); ctx.moveTo( - 30, - 70 ); ctx.lineTo( - 95, - 150 ); ctx.stroke();
			ctx.beginPath(); ctx.moveTo( 30, - 60 ); ctx.lineTo( 70, 20 ); ctx.stroke();
			ctx.fillStyle = ink( 0.8 );
			ctx.font = 'italic 700 34px Georgia, serif';
			ctx.textAlign = 'center';
			ctx.fillText( 'Phillies', 0, - 40 );
			ctx.restore();
			// the dust
			for ( let i = 0; i < 40; i ++ ) {

				ctx.fillStyle = `rgba( 150, 120, 85, ${ 0.1 + ( i % 5 ) * 0.04 } )`;
				ctx.beginPath(); ctx.arc( 40 + ( i * 37 ) % 180, 560 + ( i * 23 ) % 60, 6 + ( i % 4 ) * 3, 0, Math.PI * 2 ); ctx.fill();

			}

			// the green street-sign header
			ctx.fillStyle = '#2e9a5a';
			ctx.fillRect( 0, 0, W, 118 );
			ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.strokeRect( 6, 6, W - 12, 106 );
			ctx.fillStyle = '#ffffff';
			ctx.textAlign = 'center';
			ctx.font = '600 20px "Helvetica Neue", Arial, sans-serif';
			ctx.fillText( '1948 - 1962', W / 2, 32 );
			ctx.font = '800 46px "Helvetica Neue", Arial, sans-serif';
			ctx.fillText( 'ASHBURN', W / 2, 74 );
			ctx.font = '600 26px "Helvetica Neue", Arial, sans-serif';
			ctx.fillText( 'ALLEY', W / 2, 102 );
			// the Home of the Phillies diamond at the foot
			const dy = 700;
			ctx.fillStyle = '#1b2a5c';
			ctx.beginPath(); ctx.moveTo( W / 2, dy - 52 ); ctx.lineTo( W / 2 + 70, dy ); ctx.lineTo( W / 2, dy + 52 ); ctx.lineTo( W / 2 - 70, dy ); ctx.closePath(); ctx.fill();
			ctx.fillStyle = '#2e9a5a';
			ctx.fillRect( W / 2 - 84, dy + 6, 168, 22 );
			ctx.fillStyle = '#ffffff';
			ctx.font = 'italic 700 26px Georgia, serif';
			ctx.fillText( 'Phillies', W / 2, dy - 6 );
			ctx.font = '600 13px "Helvetica Neue", Arial, sans-serif';
			ctx.fillText( 'CITIZENS BANK PARK', W / 2, dy + 22 );

		}, 'alleyBanner' );
		const bannerMat = standard( { name: 'alley-banners', roughness: 0.8, side: 'double', textures: { bpBan: banner },
			surface: '// both faces read the right way round\n\tlet buv = select( vec2f( 1.0 - in.uv.x, in.uv.y ), in.uv, in.front ); s.albedo = textureSample( bpBan, smpAnisoClamp, buv ).rgb * 0.8;' } );
		const bq = new Quads(), greyPole = new Quads(), speakers = new Quads();
		this._discMat = this._discMat || standard( { name: 'alley-lamps', color: new Color( 0.5, 0.52, 0.54 ), roughness: 0.4, metalness: 0.6,
			surface: 'if ( in.N.y < - 0.5 ) { s.emissive = vec3f( 1.0, 0.85, 0.6 ) * mix( 0.2, 3.0, smoothstep( 0.1, 0.7, frame.night ) ); }' } );
		this._discMat.underwaterLighting = 'none';
		const zl = zFront + 6.5;
		for ( let x = - 58; x <= 58; x += 12 ) {

			if ( Math.abs( x + 2 ) < 5 ) continue;
			beam( greyPole, [ x, STREET, zl ], [ x, STREET + 7.5, zl ], 0.16 );
			beam( greyPole, [ x - 0.6, STREET + 7.4, zl ], [ x + 0.6, STREET + 7.4, zl ], 0.08 );
			// a PA horn and the three-tier disc lamp on top
			box( speakers, [ x, STREET + 6.9, zl + 0.3 ], [ 0.4, 0.45, 0.35 ] );
			for ( let t = 0; t < 3; t ++ ) {

				const lamp = new Mesh( new CylinderGeometry( 0.28 - t * 0.05, 0.34 - t * 0.05, 0.05, 16 ), this._discMat );
				lamp.position.set( x, STREET + 7.75 + t * 0.18, zl );
				this.group.add( lamp );

			}
			for ( const side of [ - 1, 1 ] ) {

				const bx0 = x + side * 0.12, bx1 = x + side * 1.0;
				const [ L, R ] = side > 0 ? [ bx0, bx1 ] : [ bx1, bx0 ];
				for ( const f of [ 1, - 1 ] ) {

					bq.tri( [ L, STREET + 3.6, zl + 0.02 * f ], [ R, STREET + 3.6, zl + 0.02 * f ], [ R, STREET + 6.3, zl + 0.02 * f ], [ 0, 0, f ], [ 0, 1 ], [ 1, 1 ], [ 1, 0 ] );
					bq.tri( [ L, STREET + 3.6, zl + 0.02 * f ], [ R, STREET + 6.3, zl + 0.02 * f ], [ L, STREET + 6.3, zl + 0.02 * f ], [ 0, 0, f ], [ 0, 1 ], [ 1, 0 ], [ 0, 0 ] );

				}

			}

			const w = this.field.toWorld( x, zl );
			this.colliders.addCylinder( w.x, w.z, 0.15, this.field.y0 + STREET, this.field.y0 + STREET + 7.5 );

		}

		// picnic tables by Bull's BBQ (the first block's west end)
		for ( const [ x, zz ] of [ [ - 56, zFront + 3.2 ], [ - 50, zFront + 3.2 ], [ - 44, zFront + 3.2 ] ] ) {

			box( wood, [ x, STREET + 0.75, zz ], [ 2.2, 0.06, 0.8 ] );
			for ( const o of [ - 0.65, 0.65 ] ) box( wood, [ x, STREET + 0.45, zz + o ], [ 2.2, 0.05, 0.3 ] );
			for ( const o of [ - 0.8, 0.8 ] ) box( metal, [ x + o, STREET + 0.37, zz ], [ 0.06, 0.74, 1.5 ] );
			const w = this.field.toWorld( x, zz );
			this.colliders.addCylinder( w.x, w.z, 1.1, this.field.y0 + STREET, this.field.y0 + STREET + 0.8 );

		}

		// the Alley's floor: concrete banded in brick pavers
		const floor = standard( { name: 'alley-floor', color: new Color( 0.3, 0.13, 0.08 ), roughness: 0.75, modules: [ commonModule ],
			surface: /* wgsl */`
	let p = in.P.xz;
	let band = abs( fract( p.x / 8.0 ) - 0.5 ) * 8.0 > 3.3;
	var c = vec3f( 0.44, 0.42, 0.38 ) * ( 0.92 + 0.1 * fract( sin( dot( floor( p / 1.5 ), vec2f( 41.3, 17.7 ) ) ) * 7543.21 ) );
	if ( band ) {
		let f = fract( vec2f( p.x / 0.2, p.y / 0.1 + 0.5 * floor( p.x / 0.2 ) ) );
		let fw = clamp( fwidth( p.x ) * 30.0 - 0.3, 0.0, 1.0 );
		c = mix( mat.color * ( 0.85 + 0.25 * mx_noise_float2( floor( p / 0.2 ) ) ), vec3f( 0.3, 0.28, 0.26 ), mix( clamp( step( 0.9, f.x ) + step( 0.85, f.y ), 0.0, 1.0 ), 0.2, fw ) * 0.6 );
	}
	s.albedo = c * ( 0.9 + 0.12 * mx_noise_float2( p * 0.3 ) );
` } );
		const fl = new Quads();
		const fx0 = blocks[ 0 ][ 0 ] - 2, fx1 = blocks[ blocks.length - 1 ][ 1 ] + 2;
		fl.add( [ fx0, STREET + 0.012, zFront ], [ fx1, STREET + 0.012, zFront ], [ fx1, STREET + 0.012, zFront + 8.5 ], [ fx0, STREET + 0.012, zFront + 8.5 ], [ 0, 1, 0 ] );

		const woodMat = this._alleyWood || ( this._alleyWood = standard( { name: 'picnic-wood', color: new Color( 0.3, 0.18, 0.09 ), roughness: 0.8 } ) );
		const greyMat = standard( { name: 'alley-poles', color: new Color( 0.26, 0.28, 0.3 ), roughness: 0.45, metalness: 0.7 } );
		const blackMat = standard( { name: 'alley-speakers', color: new Color( 0.02, 0.02, 0.022 ), roughness: 0.6 } );
		for ( const [ g, m, name ] of [ [ greyPole, greyMat, 'alley-poles' ], [ speakers, blackMat, 'alley-speakers' ], [ q, signMat, 'alley-signs' ], [ aw, awning, 'alley-awnings' ], [ glow, kitchen, 'alley-kitchens' ], [ metal, steel, 'alley-steel' ], [ bq, bannerMat, 'alley-banners' ], [ wood, woodMat, 'picnic-tables' ], [ fl, floor, 'alley-floor' ] ] ) {

			m.underwaterLighting = 'none';
			const mesh = new Mesh( g.geometry(), m );
			mesh.name = name;
			mesh.castShadow = m !== floor && m !== kitchen;
			mesh.receiveShadow = true;
			this.group.add( mesh );

		}

	}

	// The clock over center field as it was in 2008: a square white face with a thick navy ring carrying
	// white bar markers and navy hands, on an open maroon steel truss over a brick pier, and the MAB
	// Paints oval hung beneath it.
	_clock( x, z, y, brick ) {

		const face = canvasTexture( 512, 512, ( ctx, w, h ) => {

			ctx.fillStyle = '#f7f6f2';
			ctx.fillRect( 0, 0, w, h );
			ctx.fillStyle = '#1c2b5a';
			ctx.fillRect( 40, 40, w - 80, h - 80 );
			ctx.fillStyle = '#f7f6f2';
			ctx.fillRect( 110, 110, w - 220, h - 220 );
			// twelve white bars round the navy ring
			ctx.fillStyle = '#f7f6f2';
			for ( let i = 0; i < 12; i ++ ) {

				ctx.save();
				ctx.translate( w / 2, h / 2 );
				ctx.rotate( i * Math.PI / 6 );
				ctx.fillRect( - 10, - 206, 20, i % 3 ? 44 : 62 );
				ctx.restore();

			}

			// 7:08, about when the gates open
			const hand = ( ang, len, wd ) => {

				ctx.save();
				ctx.translate( w / 2, h / 2 );
				ctx.rotate( ang );
				ctx.fillStyle = '#1c2b5a';
				ctx.fillRect( - wd / 2, - len, wd, len + 22 );
				ctx.restore();

			};

			hand( ( 7 + 8 / 60 ) / 12 * Math.PI * 2, 100, 20 );
			hand( 8 / 60 * Math.PI * 2, 140, 13 );
			ctx.fillStyle = '#1c2b5a';
			ctx.beginPath(); ctx.arc( w / 2, h / 2, 14, 0, Math.PI * 2 ); ctx.fill();

		}, 'clock' );
		// October 2008: a blue backlit Sherwin-Williams box sign under the clock
		const mab = canvasTexture( 1024, 320, ( ctx, w, h ) => {

			ctx.clearRect( 0, 0, w, h );
			ctx.fillStyle = '#0b4ea2';
			ctx.fillRect( 0, h * 0.28, w, h * 0.44 );
			ctx.fillStyle = '#ffffff';
			ctx.font = '800 96px "Helvetica Neue", Arial, sans-serif';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText( 'SHERWIN-WILLIAMS', w / 2, h / 2 + 4, w - 60 );
		}, 'swSign' );
		const fm = standard( { name: 'clock-face', roughness: 0.5, textures: { bpClock: face }, surface: 'let t = textureSample( bpClock, smpAnisoClamp, in.uv ).rgb; s.albedo = t * 0.85; s.emissive = t * 0.5 * frame.night;' } );
		const sm = standard( { name: 'clock-sign', roughness: 0.4, alphaTest: 0.5, textures: { bpSign: mab }, surface: 'let t = textureSample( bpSign, smpAnisoClamp, in.uv ); s.albedo = t.rgb * 0.85; s.alpha = t.a; s.emissive = t.rgb * 0.45 * frame.night;' } );
		for ( const m of [ fm, sm ] ) m.underwaterLighting = 'none';
		const pier = new Mesh( new BoxGeometry( 4, 5, 3 ), brick );
		pier.position.set( x, y + 2.5, z );
		this.group.add( pier );
		// the truss: four posts, girts and X bracing from the pier up to the face
		const S = 4.6, fy = y + 10.2, fz = z + 0.4;
		const q = new Quads();
		const t0 = y + 5, t1 = fy - S / 2;
		for ( const [ lx, lz ] of [ [ - 1.8, - 1.1 ], [ 1.8, - 1.1 ], [ - 1.8, 1.1 ], [ 1.8, 1.1 ] ] ) beam( q, [ x + lx, t0, z + lz ], [ x + lx, fy + S / 2, z + lz ], 0.22 );
		for ( const yy of [ t0, ( t0 + t1 ) / 2, t1 ] ) for ( const lz of [ - 1.1, 1.1 ] ) beam( q, [ x - 1.8, yy, z + lz ], [ x + 1.8, yy, z + lz ], 0.16 );
		for ( const lz of [ - 1.1, 1.1 ] ) {

			beam( q, [ x - 1.8, t0, z + lz ], [ x + 1.8, ( t0 + t1 ) / 2, z + lz ], 0.1 );
			beam( q, [ x + 1.8, t0, z + lz ], [ x - 1.8, ( t0 + t1 ) / 2, z + lz ], 0.1 );
			beam( q, [ x - 1.8, ( t0 + t1 ) / 2, z + lz ], [ x + 1.8, t1, z + lz ], 0.1 );
			beam( q, [ x + 1.8, ( t0 + t1 ) / 2, z + lz ], [ x - 1.8, t1, z + lz ], 0.1 );

		}

		const truss = new Mesh( q.geometry(), this.steel );
		truss.castShadow = true;
		this.group.add( truss );
		const add = ( mat, w, h, cy ) => {

			const qq = new Quads();
			qq.add( [ x - w / 2, cy - h / 2, fz ], [ x + w / 2, cy - h / 2, fz ], [ x + w / 2, cy + h / 2, fz ], [ x - w / 2, cy + h / 2, fz ], [ 0, 0, 1 ] );
			const g = qq.geometry();
			const uv = g.getAttribute( 'uv' ).array, pos = g.getAttribute( 'position' ).array;
			for ( let i = 0; i < uv.length / 2; i ++ ) {

				uv[ i * 2 ] = ( pos[ i * 3 ] - ( x - w / 2 ) ) / w;
				uv[ i * 2 + 1 ] = 1 - ( pos[ i * 3 + 1 ] - ( cy - h / 2 ) ) / h;

			}

			this.group.add( new Mesh( g, mat ) );

		};

		const back = new Mesh( new BoxGeometry( S + 0.4, S + 0.4, 0.5 ), this.steel );
		back.position.set( x, fy, z + 0.1 );
		this.group.add( back );
		add( fm, S, S, fy );
		add( sm, 5.0, 1.56, ( t0 + t1 ) / 2 );

	}

	// ---------------------------------------------------------------- the batter's eye

	// Behind the center field fence from Monty's Angle to 401: ivy over the brick up to Ashburn Alley, and
	// a bed of evergreens at its foot.
	// The batter's eye in 2008: three overlapping terracotta brick walls stepping up toward center (the
	// left one low, the middle one tallest, the right one set back), three big ragged masses of ivy on
	// them, a bed of rounded boxwood and juniper at their foot, a cast-stone cap. From behind the 409 corner
	// to right-center; the pit's wall either side is plain brick.
	_battersEye() {

		const line = offsetPolyline( this.bowl._fenceLine( 3, 8 ), 7 - 0.12, [ 0, 0 ] );
		const deg = ( x, z ) => Math.atan2( x, - z ) * 180 / Math.PI;
		const topAt = ( d ) => d < - 5 || d > 8 ? STREET : d < - 1 ? STREET + 0.9 : d < 5 ? STREET + 2.8 : STREET + 2.2;
		const q = new Quads(), cap = new Quads(), bush = [];
		let u = 0;
		const ivyAt = [];
		for ( let i = 0; i < line.length - 1; i ++ ) {

			const [ ax, az ] = line[ i ], [ bx, bz ] = line[ i + 1 ];
			const len = Math.hypot( bx - ax, bz - az );
			if ( len < 0.1 ) continue;
			let nx = - ( bz - az ) / len, nz = ( bx - ax ) / len;
			if ( nx * - ax + nz * - az < 0 ) {

				nx = - nx; nz = - nz;

			}

			const n = Math.max( 1, Math.ceil( len ) );
			for ( let k = 0; k < n; k ++ ) {

				const t0 = k / n, t1 = ( k + 1 ) / n;
				const x0 = ax + ( bx - ax ) * t0, z0 = az + ( bz - az ) * t0, x1 = ax + ( bx - ax ) * t1, z1 = az + ( bz - az ) * t1;
				const d = deg( ( x0 + x1 ) / 2, ( z0 + z1 ) / 2 ), top = topAt( d );
				// the right wall stands a little back
				const back = d >= 5 && d <= 8 ? - 0.6 : 0;
				const X0 = x0 - nx * back, Z0 = z0 - nz * back, X1 = x1 - nx * back, Z1 = z1 - nz * back;
				q.add( [ X0, 0, Z0 ], [ X1, 0, Z1 ], [ X1, top, Z1 ], [ X0, top, Z0 ], [ nx, 0, nz ], u + len * t0, u + len * t1 );
				if ( top > STREET ) {

					cap.add( [ X0 + nx * 0.05, top, Z0 + nz * 0.05 ], [ X1 + nx * 0.05, top, Z1 + nz * 0.05 ], [ X1 - nx * 0.6, top, Z1 - nz * 0.6 ], [ X0 - nx * 0.6, top, Z0 - nz * 0.6 ], [ 0, 1, 0 ] );
					cap.add( [ X0 + nx * 0.05, top - 0.3, Z0 + nz * 0.05 ], [ X1 + nx * 0.05, top - 0.3, Z1 + nz * 0.05 ], [ X1 + nx * 0.05, top, Z1 + nz * 0.05 ], [ X0 + nx * 0.05, top, Z0 + nz * 0.05 ], [ nx, 0, nz ] );

				}

				// the shrub bed at its foot
				if ( d > - 6 && d < 9 && k % 2 === 0 ) {

					const r = Math.abs( Math.sin( ( x0 + k ) * 12.9898 + z0 * 3.3 ) * 43758.5453 ) % 1;
					bush.push( [ ( x0 + x1 ) / 2 + nx * ( 0.9 + 0.8 * r ), ( z0 + z1 ) / 2 + nz * ( 0.9 + 0.8 * r ), 0.6 + 0.6 * r, 1.2 + 1.3 * ( ( r * 7.3 ) % 1 ) ] );

				}

			}

			// where the three ivy masses hang (u along the wall): the sample nearest each one's bearing
			[ [ - 2.5, 7 ], [ 1.5, 9 ], [ 6.2, 7 ] ].forEach( ( [ dd, w ], j ) => {

				for ( let k = 0; k < n * 4; k ++ ) {

					const t = ( k + 0.5 ) / ( n * 4 ), x = ax + ( bx - ax ) * t, z = az + ( bz - az ) * t;
					const e = Math.abs( deg( x, z ) - dd );
					if ( ( ! ivyAt[ j ] || e < ivyAt[ j ][ 3 ] ) && topAt( deg( x, z ) ) > STREET ) ivyAt[ j ] = [ u + len * t, w, topAt( deg( x, z ) ) - 0.8, e ];

				}

			} );

			u += len;

		}

		const masses = [ 0, 1, 2 ].map( ( j ) => ivyAt[ j ] || [ - 1000, 1, 0 ] );
		const brick = standard( {
			name: 'batters-eye-brick', color: new Color( 0.33, 0.1, 0.065 ), roughness: 0.85, modules: [ commonModule ],
			surface: /* wgsl */`
	let u = in.uv.x; let v = in.uv.y;
	let row = floor( v / 0.075 );
	let bu = u / 0.2 + 0.5 * ( row % 2.0 );
	let fr = clamp( fwidth( v ) / 0.075 * 1.5 - 0.25, 0.0, 1.0 );
	let fb = clamp( fwidth( bu ) * 1.5 - 0.25, 0.0, 1.0 );
	let mortar = clamp( mix( step( 0.88, fract( v / 0.075 ) ), 0.12, fr ) + mix( step( 0.93, fract( bu ) ), 0.07, max( fb, fr ) ), 0.0, 1.0 );
	let tone = mix( 0.82 + 0.3 * fract( sin( dot( vec2f( floor( bu ), row ), vec2f( 12.9898, 78.233 ) ) ) * 43758.5453 ), 0.97, max( fr, fb ) );
	var c = mix( mat.color * tone, vec3f( 0.5, 0.44, 0.38 ), mortar * 0.8 );
	// a control joint every 4.5 m
	c = c * ( 1.0 - 0.25 * step( 0.99, fract( u / 4.5 ) ) );
	// the ivy: three masses, their edges ragged
	var ivy = 0.0;
	${ masses.map( ( [ mu, mw, mtop ] ) => `ivy = max( ivy, smoothstep( 1.0, 0.8, length( vec2f( ( u - ${ mu.toFixed( 2 ) } ) / ${ ( mw / 2 ).toFixed( 2 ) }, ( v - ${ ( ( mtop ) / 2 ).toFixed( 2 ) } ) / ${ ( mtop / 2 + 0.4 ).toFixed( 2 ) } ) ) + ( mx_noise_float2( vec2f( u, v ) * 0.8 ) - 0.1 ) * 0.5 ) );` ).join( '\n\t' ) }
	let leaf = 0.7 + 0.5 * mx_noise_float3( in.P * 6.0 ) + 0.25 * mx_noise_float3( in.P * 1.3 );
	c = mix( c, mix( vec3f( 0.035, 0.07, 0.022 ), vec3f( 0.1, 0.14, 0.05 ), smoothstep( 0.3, 1.0, leaf ) ) * leaf, ivy );
	s.albedo = c;
	s.roughness = mix( 0.85, 0.7, ivy );
	if ( ivy > 0.5 ) { s.normal = normalize( in.N + vec3f( mx_noise_float3( in.P * 9.0 ), mx_noise_float3( in.P * 9.0 + 3.1 ), mx_noise_float3( in.P * 9.0 + 7.7 ) ) * 0.4 ); }
	// under the lights: the spill from the banks
	s.emissive = s.albedo * smoothstep( 0.2, 0.8, frame.night ) * 0.3;
`,
		} );
		const stone = standard( { name: 'batters-eye-cap', color: new Color( 0.5, 0.44, 0.36 ), roughness: 0.7 } );
		const shrub = standard( { name: 'boxwood', color: new Color( 0.03, 0.06, 0.025 ), roughness: 0.9, modules: [ commonModule ],
			surface: 's.albedo = mat.color * ( 0.7 + 0.6 * mx_noise_float3( in.P * 3.0 ) ); s.emissive = s.albedo * smoothstep( 0.2, 0.8, frame.night ) * 0.25;' } );
		for ( const m of [ brick, stone, shrub ] ) m.underwaterLighting = 'none';
		const m = new Mesh( q.geometry(), brick );
		m.name = 'batters-eye';
		m.receiveShadow = true;
		m.castShadow = true;
		this.group.add( m );
		this.group.add( new Mesh( cap.geometry(), stone ) );
		// rounded clumps: boxwood low in front, juniper taller behind
		const clump = new SphereGeometry( 1, 12, 8 );
		for ( const [ x, z, r, h ] of bush ) {

			const c = new Mesh( clump, shrub );
			c.position.set( x, h * 0.45, z );
			c.scale.set( r * 1.3, h * 0.55, r * 1.3 );
			c.castShadow = true;
			c.receiveShadow = true;
			this.group.add( c );

		}

	}

}

// A square steel lattice mast in `g`: legs `w` apart round ( x, z ), from y0 to y1, braced every `step` m
function lattice( g, mat, x, z, y0, y1, w, step = 3 ) {

	const h = y1 - y0;
	const leg = new BoxGeometry( 0.28, h, 0.28 );
	for ( const [ lx, lz ] of [ [ - 1, - 1 ], [ 1, - 1 ], [ - 1, 1 ], [ 1, 1 ] ] ) {

		const m = new Mesh( leg, mat );
		m.position.set( x + lx * w / 2, y0 + h / 2, z + lz * w / 2 );
		m.castShadow = true;
		g.add( m );

	}

	for ( let y = y0 + step; y < y1 - 1; y += step ) {

		for ( const [ bw, bd, px, pz ] of [ [ w, 0.14, 0, - w / 2 ], [ w, 0.14, 0, w / 2 ], [ 0.14, w, - w / 2, 0 ], [ 0.14, w, w / 2, 0 ] ] ) {

			const m = new Mesh( new BoxGeometry( bw, 0.14, bd ), mat );
			m.position.set( x + px, y, z + pz );
			g.add( m );

		}

		// the diagonals on the two faces you see
		for ( const side of [ - 1, 1 ] ) {

			const d = new Mesh( new BoxGeometry( 0.1, Math.hypot( w, step ), 0.1 ), mat );
			d.position.set( x, y - step / 2, z + side * w / 2 );
			d.rotation.z = side * Math.atan2( w, step );
			g.add( d );

		}

	}

}

// A quad facing -z (home plate, in a _facingHome group) with uvs 0..1 across it as seen from home
function quadUV( W, H, y0, z ) {

	const q = new Quads();
	q.add( [ - W / 2, y0, z ], [ W / 2, y0, z ], [ W / 2, y0 + H, z ], [ - W / 2, y0 + H, z ], [ 0, 0, - 1 ] );
	const geo = q.geometry();
	const uv = geo.getAttribute( 'uv' ).array, pos = geo.getAttribute( 'position' ).array;
	for ( let i = 0; i < uv.length / 2; i ++ ) {

		// seen from home plate (looking along +z in the group), +x is on the left
		uv[ i * 2 ] = 1 - ( pos[ i * 3 ] + W / 2 ) / W;
		uv[ i * 2 + 1 ] = 1 - ( pos[ i * 3 + 1 ] - y0 ) / H;

	}

	return geo;

}

function star( ctx, cx, cy, r, color ) {

	ctx.beginPath();
	for ( let i = 0; i < 10; i ++ ) {

		const a = - Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.42 : r;
		ctx.lineTo( cx + Math.cos( a ) * rr, cy + Math.sin( a ) * rr );

	}

	ctx.closePath();
	ctx.fillStyle = color;
	ctx.fill();

}

// The 2008 board's face: the ad column on the left; the amber matrix (at-bat, due up, today, the lineup,
// the line score, the count) over the video board.
function drawBoard2008( ctx, w, h, st ) {

	const amber = '#ffab2e';
	ctx.fillStyle = '#05070b';
	ctx.fillRect( 0, 0, w, h );
	// ---- the ad column
	const colW = w * 0.19;
	ctx.fillStyle = '#c8102e';
	ctx.fillRect( 8, 8, colW - 16, h * 0.47 );
	// a bottle, roughly
	ctx.fillStyle = '#f4f1ea';
	const bx = colW / 2, by = h * 0.08;
	ctx.beginPath();
	ctx.moveTo( bx - 14, by ); ctx.lineTo( bx + 14, by ); ctx.lineTo( bx + 16, by + 60 ); ctx.quadraticCurveTo( bx + 50, by + 120, bx + 42, by + 200 );
	ctx.quadraticCurveTo( bx + 34, by + 260, bx + 44, by + 330 ); ctx.lineTo( bx - 44, by + 330 ); ctx.quadraticCurveTo( bx - 34, by + 260, bx - 42, by + 200 );
	ctx.quadraticCurveTo( bx - 50, by + 120, bx - 16, by + 60 ); ctx.closePath(); ctx.fill();
	ctx.fillStyle = '#ffffff';
	ctx.font = 'italic 700 58px Georgia, serif';
	ctx.textAlign = 'center';
	ctx.fillText( 'Coca-Cola', colW / 2, h * 0.44, colW - 30 );
	ctx.fillStyle = '#16120e';
	ctx.fillRect( 8, h * 0.5, colW - 16, h * 0.49 );
	ctx.fillStyle = '#e8781e';
	ctx.font = '800 56px "Helvetica Neue", Arial, sans-serif';
	[ 'MEDICINE', 'WITH', 'MUSCLE' ].forEach( ( t, i ) => ctx.fillText( t, colW / 2, h * 0.58 + i * 66, colW - 30 ) );
	ctx.fillStyle = '#e6c21c';
	ctx.fillRect( colW * 0.18, h * 0.8, colW * 0.64, h * 0.1 );
	ctx.fillStyle = '#1b3f8e';
	ctx.font = 'italic 800 54px "Helvetica Neue", Arial, sans-serif';
	ctx.fillText( 'Motrin', colW / 2, h * 0.87, colW * 0.6 );

	// ---- the amber matrix
	const mx = colW + 10, mw = w - mx - 8, mh = h * 0.47;
	ctx.fillStyle = '#0a0703';
	ctx.fillRect( mx, 8, mw, mh );
	ctx.textAlign = 'left';
	const txt = ( t, x, y, size = 40, color = amber, align = 'left' ) => {

		ctx.fillStyle = color;
		ctx.font = `700 ${ size }px "Courier New", Courier, monospace`;
		ctx.textAlign = align;
		ctx.shadowColor = color;
		ctx.shadowBlur = 6;
		ctx.fillText( t, x, y );
		ctx.shadowBlur = 0;

	};

	const S = st || { teams: { away: { abbr: 'TB', club: 'Rays' }, home: { abbr: 'PHI', club: 'Phillies' } }, line: [], score: { away: 0, home: 0 }, hits: { away: 0, home: 0 }, errors: { away: 0, home: 0 }, count: [ 0, 0 ], outs: 0, lineup: [], dueUp: [], today: [], batter: null, video: { kind: 'title' } };
	// the at-bat
	const c1 = mx + 16;
	txt( 'AT-BAT:', c1, 58, 30 );
	if ( S.batter ) txt( S.batter.last, c1 + 20, 102, 42 );
	txt( 'TODAY', c1, 156, 32 );
	const tdy = S.today.length ? `${ S.today.filter( ( t ) => /SINGLED|DOUBLED|TRIPLED|HOMERED/.test( t ) ).length } FOR ${ S.today.filter( ( t ) => ! /WALKED|HIT BY|SACRIFICED/.test( t ) ).length }` : '0 FOR 0';
	txt( tdy, c1 + 20, 196, 36 );
	txt( `${ ( S.batting === 'home' ? S.teams.away : S.teams.home ).club.toUpperCase() }`, c1, 262, 30 );
	txt( 'DUE UP:', c1, 298, 30 );
	S.dueUp.forEach( ( d, i ) => txt( d, c1 + 12, 336 + i * 36, 30 ) );
	// today's at-bats
	const c2 = mx + mw * 0.3;
	ctx.strokeStyle = amber;
	ctx.lineWidth = 2;
	ctx.strokeRect( c2, 22, mw * 0.36, mh - 150 );
	if ( S.batter ) {

		ctx.fillStyle = '#5a3a08';
		ctx.fillRect( c2 + 4, 26, mw * 0.36 - 8, 52 );
		txt( `${ S.batter.num }  ${ S.batter.last }  ${ S.batter.pos }`, c2 + 16, 66, 36 );

	}

	S.today.slice( - 4 ).forEach( ( t, i ) => txt( t, c2 + 16, 130 + i * 44, 28 ) );
	// the lineup
	const c3 = mx + mw * 0.7;
	txt( ( S.batting === 'home' ? S.teams.home.club : S.teams.away.club ).toUpperCase(), c3 + mw * 0.14, 50, 34, amber, 'center' );
	S.lineup.forEach( ( l, i ) => {

		txt( `${ l.up ? '*' : ' ' }${ String( l.num ).padStart( 2, ' ' ) } ${ l.last }`, c3, 92 + i * 33, 28 );
		txt( l.pos, mx + mw - 14, 92 + i * 33, 28, amber, 'right' );

	} );
	// the line score and the count
	const ly = mh - 110;
	const cols = mw * 0.64 / 13;
	const lx = mx + 16;
	for ( let i = 1; i <= 9; i ++ ) txt( String( i ), lx + ( i + 2.6 ) * cols, ly, 32, amber, 'center' );
	[ 'R', 'H', 'E' ].forEach( ( t, i ) => txt( t, lx + ( 12.2 + i * 0.9 ) * cols, ly, 32, amber, 'center' ) );
	[ [ 'away', 0 ], [ 'home', 1 ] ].forEach( ( [ side, r ] ) => {

		const y = ly + 42 + r * 42;
		txt( S.teams[ side ].club.toUpperCase().slice( 0, 8 ), lx, y, 32 );
		for ( let i = 1; i <= 9; i ++ ) {

			const v = S.line[ i - 1 ]?.[ r ];
			if ( v != null ) txt( String( v ), lx + ( i + 2.6 ) * cols, y, 32, amber, 'center' );

		}

		[ S.score[ side ], S.hits[ side ], S.errors[ side ] ].forEach( ( v, i ) => txt( String( v ), lx + ( 12.2 + i * 0.9 ) * cols, y, 32, amber, 'center' ) );

	} );
	const cx = mx + mw * 0.78;
	[ [ 'BALLS', S.count[ 0 ] ], [ 'STRIKES', S.count[ 1 ] ], [ 'OUTS', S.outs ] ].forEach( ( [ k, v ], i ) => {

		txt( k, cx, ly + i * 40, 30 );
		txt( String( v ), mx + mw - 18, ly + i * 40, 34, amber, 'right' );

	} );

	// ---- the video board
	const vx = mx, vy = mh + 22, vw = mw, vh = h - vy - 44;
	const grad = ctx.createLinearGradient( vx, vy, vx + vw, vy + vh );
	const v = S.video || { kind: 'title' };
	const phi = S.batting === 'home';
	grad.addColorStop( 0, v.kind === 'batter' ? ( phi ? '#8d0b1c' : '#0a2656' ) : '#0b2a6f' );
	grad.addColorStop( 1, v.kind === 'batter' ? ( phi ? '#3a0710' : '#08162f' ) : '#6b0a18' );
	ctx.fillStyle = grad;
	ctx.fillRect( vx, vy, vw, vh );
	ctx.textAlign = 'center';
	ctx.fillStyle = '#ffffff';
	ctx.shadowColor = 'rgba( 0, 0, 0, 0.6 )';
	ctx.shadowBlur = 16;
	if ( v.kind === 'batter' && S.batter ) {

		// the batter's card: a header bar, his portrait in its frame (cap and shoulders in the team's
		// colours), the big number behind, name, number and position, and what he's done tonight
		const cap = phi ? '#c8102e' : '#0b2a5b', trim = phi ? '#0b2a5b' : '#8fbce6';
		ctx.shadowBlur = 0;
		ctx.fillStyle = 'rgba( 0, 0, 0, 0.35 )';
		ctx.fillRect( vx, vy, vw, vh * 0.16 );
		ctx.fillStyle = '#ffffff';
		ctx.font = '800 44px "Helvetica Neue", Arial, sans-serif';
		ctx.textAlign = 'left';
		ctx.fillText( 'NOW BATTING', vx + 28, vy + vh * 0.11 );
		ctx.textAlign = 'right';
		ctx.fillText( 'WORLD SERIES 2008', vx + vw - 28, vy + vh * 0.11 );
		ctx.textAlign = 'center';
		const fx = vx + vw * 0.08, fy = vy + vh * 0.22, fw = vw * 0.26, fh = vh * 0.7;
		ctx.fillStyle = 'rgba( 255, 255, 255, 0.12 )';
		ctx.fillRect( fx, fy, fw, fh );
		ctx.strokeStyle = trim; ctx.lineWidth = 8; ctx.strokeRect( fx, fy, fw, fh );
		ctx.fillStyle = '#e8eaee';
		ctx.beginPath(); ctx.ellipse( fx + fw / 2, fy + fh * 1.02, fw * 0.46, fh * 0.34, 0, Math.PI, 0 ); ctx.fill();
		ctx.fillStyle = '#b98a6a';
		ctx.beginPath(); ctx.ellipse( fx + fw / 2, fy + fh * 0.44, fw * 0.2, fh * 0.2, 0, 0, Math.PI * 2 ); ctx.fill();
		ctx.fillStyle = cap;
		ctx.beginPath(); ctx.ellipse( fx + fw / 2, fy + fh * 0.33, fw * 0.22, fh * 0.12, 0, Math.PI, 0 ); ctx.fill();
		ctx.fillRect( fx + fw * 0.28, fy + fh * 0.32, fw * 0.5, fh * 0.035 );
		ctx.fillStyle = phi ? '#ffffff' : '#ffffff';
		ctx.font = `italic 700 ${ Math.round( fh * 0.1 ) }px Georgia, serif`;
		ctx.fillText( phi ? 'P' : 'TB', fx + fw / 2, fy + fh * 0.3 );
		ctx.font = '900 300px "Helvetica Neue", Arial, sans-serif';
		ctx.globalAlpha = 0.18;
		ctx.fillText( S.batter.num, vx + vw * 0.8, vy + vh * 0.86 );
		ctx.globalAlpha = 1;
		ctx.textAlign = 'left';
		ctx.shadowBlur = 16;
		ctx.font = '900 92px "Helvetica Neue", Arial, sans-serif';
		ctx.fillText( S.batter.name, vx + vw * 0.38, vy + vh * 0.46, vw * 0.6 );
		ctx.font = '700 46px "Helvetica Neue", Arial, sans-serif';
		ctx.fillText( `#${ S.batter.num }   ${ S.batter.pos }`, vx + vw * 0.38, vy + vh * 0.62 );
		ctx.font = '700 34px "Courier New", monospace';
		ctx.fillStyle = '#ffd24a';
		ctx.fillText( ( S.today && S.today.length ) ? 'TONIGHT: ' + S.today.slice( - 3 ).join( '  ' ) : 'FIRST AT BAT TONIGHT', vx + vw * 0.38, vy + vh * 0.8, vw * 0.6 );
		ctx.textAlign = 'center';
		ctx.fillStyle = '#ffffff';

	} else if ( v.kind === 'final' ) {

		ctx.font = '900 118px "Helvetica Neue", Arial, sans-serif';
		ctx.fillText( 'WORLD', vx + vw / 2, vy + vh * 0.42 );
		ctx.fillText( 'CHAMPIONS!', vx + vw / 2, vy + vh * 0.72, vw - 60 );

	} else if ( v.kind === 'pitcher' ) {

		ctx.font = '700 58px "Helvetica Neue", Arial, sans-serif';
		ctx.fillText( 'NOW PITCHING', vx + vw / 2, vy + vh * 0.4 );
		ctx.font = '900 100px "Helvetica Neue", Arial, sans-serif';
		ctx.fillText( `#${ v.num } ${ ( v.name || '' ).toUpperCase() }`, vx + vw / 2, vy + vh * 0.66, vw - 60 );

	} else {

		ctx.font = '900 92px "Helvetica Neue", Arial, sans-serif';
		ctx.fillText( 'WORLD SERIES 2008', vx + vw / 2, vy + vh * 0.42, vw - 60 );
		ctx.font = '700 64px "Helvetica Neue", Arial, sans-serif';
		ctx.fillText( S.inning ? `${ S.half === 'top' ? 'TOP' : 'BOTTOM' } ${ S.inning }  ·  ${ S.teams.away.abbr } ${ S.score.away }  ${ S.teams.home.abbr } ${ S.score.home }` : 'GAME 5', vx + vw / 2, vy + vh * 0.68, vw - 60 );

	}

	ctx.shadowBlur = 0;
	ctx.fillStyle = '#9aa3ad';
	ctx.font = '600 24px "Helvetica Neue", Arial, sans-serif';
	ctx.fillText( 'PHILIPS', vx + vw / 2, h - 14 );

}

// ---------------------------------------------------------------- flags

// The flags over Ashburn Alley on their poles: the Stars and Stripes on the tallest, Pennsylvania,
// Philadelphia, the Phillies, the ballpark's and the 2007 National League East champions' pennant. The
// cloth is moved in the vertex shader: it streams downwind and ripples, hanging slack as the wind drops.
// `wind` is [ x, z ] (field frame, the way it blows) and a strength 0..1.
const FLAG_ROWS = 6;

class Flags {

	constructor( parent, poles, poleMat ) {

		const L = 3.0, H = 1.9, NU = 18, NV = 8;
		const tex = canvasTexture( 512, 320 * FLAG_ROWS / 2, ( ctx, w, h ) => {

			const rh = h / FLAG_ROWS;
			const draws = [ drawPA, drawUS, drawBallpark, drawPhilly, drawPhillies, drawPennant ];
			draws.forEach( ( f, i ) => {

				ctx.save();
				ctx.translate( 0, i * rh );
				ctx.beginPath(); ctx.rect( 0, 0, w, rh ); ctx.clip();
				f( ctx, w, rh );
				ctx.restore();

			} );

		}, 'flags' );
		const pos = [], local = [], pole = [], index = [];
		// which flag on which pole, left to right: PA, Philadelphia, the US flag (the tallest), the Phillies,
		// the ballpark, the pennant
		const rows = [ 0, 3, 1, 4, 2, 5 ];
		poles.forEach( ( P, k ) => {

			const top = P.y0 + P.h - 0.3;
			const base = pos.length / 3;
			const big = k === 2 ? 1.3 : 1;
			for ( let j = 0; j <= NV; j ++ ) for ( let i = 0; i <= NU; i ++ ) {

				pos.push( P.x, top, P.z );
				local.push( i / NU * L * big, j / NV * H * big, rows[ k ], k );
				pole.push( P.x, top, P.z );

			}

			for ( let j = 0; j < NV; j ++ ) for ( let i = 0; i < NU; i ++ ) {

				const a = base + j * ( NU + 1 ) + i;
				index.push( a, a + 1, a + NU + 2, a, a + NU + 2, a + NU + 1 );

			}

			// the pole, and a gold ball on top
			const m = new Mesh( new CylinderGeometry( 0.07, 0.13, P.h, 8 ), poleMat );
			m.position.set( P.x, P.y0 + P.h / 2, P.z );
			m.castShadow = true;
			parent.add( m );
			const ball = new Mesh( new SphereGeometry( 0.14, 10, 8 ), this.gold || ( this.gold = standard( { name: 'flag-finial', color: new Color( 0.5, 0.36, 0.1 ), roughness: 0.3, metalness: 1 } ) ) );
			ball.position.set( P.x, P.y0 + P.h + 0.1, P.z );
			parent.add( ball );

		} );
		const g = new BufferGeometry();
		g.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
		g.setAttribute( 'normal', new Float32BufferAttribute( pos.map( () => 0 ), 3 ) );
		g.setAttribute( 'aLocal', new Float32BufferAttribute( local, 4 ) );
		g.setIndex( index );
		g.computeBoundingBox();
		g.boundingBox.expandByScalar( 6 );
		g.computeBoundingSphere();
		g.boundingSphere.radius += 6;
		this.material = standard( {
			name: 'flag-cloth', roughness: 0.85, side: 'double', textures: { bpFlags: tex },
			uniforms: { wind: [ 'vec3f', new Vector3( 0.7, 0.7, 0.3 ) ] },
			attributes: { aLocal: 'vec4f' },
			varyings: { vUV: 'vec2f' },
			vertex: /* wgsl */`
	let along = v.aLocal.x; let down = v.aLocal.y; let row = v.aLocal.z; let k = v.aLocal.w;
	let big = select( 1.0, 1.3, k > 1.5 && k < 2.5 );
	let Lf = ${ L.toFixed( 2 ) } * big; let Hf = ${ H.toFixed( 2 ) } * big;
	let W = normalize( vec3f( mat.wind.x, 0.0, mat.wind.y ) + vec3f( 1e-4, 0.0, 0.0 ) );
	let N = vec3f( - W.z, 0.0, W.x );
	let t = frame.time;
	// gusts, a little different on each pole
	let w = clamp( mat.wind.z * ( 0.85 + 0.15 * sin( t * 0.7 + k ) + 0.1 * sin( t * 1.9 + k * 2.1 ) ), 0.0, 1.0 );
	let f = along / Lf;
	// ripples running out to the fly end, bigger there; slack cloth hangs and folds
	let ph = t * ( 3.0 + 7.0 * w ) - along * ( 2.4 + 1.2 * w ) + k * 1.7;
	let amp = f * ( 0.12 + 0.3 * w ) + 0.05;
	let side = amp * sin( ph ) + 0.06 * f * sin( ph * 1.9 + down * 2.5 );
	let dSide = - amp * cos( ph ) * ( 2.4 + 1.2 * w ) + ( 0.12 + 0.3 * w ) / Lf * sin( ph );
	let reach = mix( 0.5, 0.97, w );
	let droop = mix( 0.55, 0.03, w ) * f * f * Lf;
	let lp = v.position + W * along * reach - vec3f( 0.0, down + droop, 0.0 ) + N * side;
	let n = normalize( N - W * dSide );
	v.useWorld = true;
	v.worldPos = ( v.model * vec4f( lp, 1.0 ) ).xyz;
	v.worldNormal = normalize( ( v.model * vec4f( n, 0.0 ) ).xyz );
	v.prevWorldPos = v.worldPos;
	o.vUV = vec2f( f, ( row + down / Hf ) / ${ FLAG_ROWS }.0 );
`,
			surface: /* wgsl */`
	let c = textureSample( bpFlags, smpAnisoClamp, in.vs.vUV ).rgb;
	s.albedo = c * 0.8;
	// floodlit after dark
	s.emissive = c * 0.12 * smoothstep( 0.2, 0.8, frame.night );
`,
		} );
		this.material.underwaterLighting = 'none';
		const mesh = new Mesh( g, this.material );
		mesh.name = 'flags';
		mesh.castShadow = true;
		mesh.frustumCulled = false;
		parent.add( mesh );

	}

	// the way it blows, field frame [ x, z ], and its strength 0..1
	setWind( x, z, strength ) {

		this.material.uniforms.wind.value.set( x, z, strength );

	}

}

function drawBallpark( ctx, w, h ) {

	ctx.fillStyle = '#f7f5ef';
	ctx.fillRect( 0, 0, w, h );
	ctx.fillStyle = '#1a9a50';
	ctx.beginPath(); ctx.arc( w * 0.5, h * 0.36, h * 0.2, 0, Math.PI * 2 ); ctx.fill();
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.font = '800 40px "Helvetica Neue", Arial, sans-serif';
	ctx.fillText( 'Citizens Bank Park', w / 2, h * 0.76, w - 30 );

}

function drawUS( ctx, w, h ) {

	for ( let i = 0; i < 13; i ++ ) {

		ctx.fillStyle = i % 2 ? '#f4f2ec' : '#b31942';
		ctx.fillRect( 0, i * h / 13, w, h / 13 + 1 );

	}

	ctx.fillStyle = '#0a3161';
	ctx.fillRect( 0, 0, w * 0.4, h * 7 / 13 );
	ctx.fillStyle = '#f4f2ec';
	for ( let r = 0; r < 9; r ++ ) for ( let c = 0; c < ( r % 2 ? 5 : 6 ); c ++ ) {

		ctx.beginPath();
		ctx.arc( w * 0.4 * ( ( c + ( r % 2 ? 1 : 0.5 ) ) / 6 ), h * 7 / 13 * ( ( r + 0.6 ) / 9.4 ), 2.6, 0, Math.PI * 2 );
		ctx.fill();

	}

}

function drawPA( ctx, w, h ) {

	ctx.fillStyle = '#12296b';
	ctx.fillRect( 0, 0, w, h );
	// the coat of arms: a shield between two horses, an eagle on top
	ctx.fillStyle = '#c9a857';
	ctx.beginPath(); ctx.ellipse( w / 2, h * 0.5, w * 0.1, h * 0.2, 0, 0, Math.PI * 2 ); ctx.fill();
	ctx.fillStyle = '#6b4a2a';
	for ( const s of [ - 1, 1 ] ) {

		ctx.beginPath(); ctx.ellipse( w / 2 + s * w * 0.15, h * 0.5, w * 0.05, h * 0.16, s * 0.3, 0, Math.PI * 2 ); ctx.fill();

	}

	ctx.fillStyle = '#3a2a1a';
	ctx.beginPath(); ctx.ellipse( w / 2, h * 0.24, w * 0.06, h * 0.05, 0, 0, Math.PI * 2 ); ctx.fill();
	ctx.fillStyle = '#b01f24';
	ctx.fillRect( w * 0.36, h * 0.74, w * 0.28, h * 0.05 );

}

function drawPhilly( ctx, w, h ) {

	// the city's flag: blue, yellow, blue, with the coat of arms in the middle
	ctx.fillStyle = '#5a9bd6';
	ctx.fillRect( 0, 0, w, h );
	ctx.fillStyle = '#f2cc2f';
	ctx.fillRect( w / 3, 0, w / 3, h );
	ctx.fillStyle = '#5a9bd6';
	ctx.beginPath(); ctx.ellipse( w / 2, h / 2, w * 0.08, h * 0.16, 0, 0, Math.PI * 2 ); ctx.fill();
	ctx.fillStyle = '#f7f3e3';
	ctx.fillRect( w * 0.47, h * 0.4, w * 0.06, h * 0.2 );

}

function drawPhillies( ctx, w, h ) {

	ctx.fillStyle = '#f7f5ef';
	ctx.fillRect( 0, 0, w, h );
	ctx.save();
	ctx.translate( w / 2, h / 2 );
	ctx.rotate( - 0.1 );
	ctx.font = 'italic 700 92px Georgia, serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillStyle = '#d01c2c';
	ctx.fillText( 'Phillies', 0, 6, w - 40 );
	ctx.restore();

}

function drawPennant( ctx, w, h ) {

	ctx.fillStyle = '#f7f5ef';
	ctx.fillRect( 0, 0, w, h );
	ctx.strokeStyle = '#c8102e';
	ctx.lineWidth = 12;
	ctx.strokeRect( 8, 8, w - 16, h - 16 );
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillStyle = '#0b2a5b';
	ctx.font = '900 64px "Helvetica Neue", Arial, sans-serif';
	ctx.fillText( '2007', w / 2, h * 0.38 );
	ctx.font = '800 26px "Helvetica Neue", Arial, sans-serif';
	ctx.fillText( 'NL EAST CHAMPIONS', w / 2, h * 0.7, w - 40 );

}
