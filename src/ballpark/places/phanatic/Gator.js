import { Group, Mesh, PlaneGeometry, BoxGeometry, CylinderGeometry, SphereGeometry, LatheGeometry, TorusGeometry, Vector2 } from '../../../engine/index.js';
import { standard } from '../../../materials/Materials.js';
import { canvasTexture } from '../../geo.js';
import { Kit } from './Kit.js';
import { BARREL_BACK } from './Launcher.js';

// The hot dog launcher's ride in 2008 (flickr qparker71 2842323072, September 8; hazboy 2851422456;
// visitphilly 2401025331; egnarorm 2437238041; Getty 577674176): a green John Deere Gator utility vehicle
// with yellow wheels, driven along the foul-line grass by a staffer in a red cap with another beside him.
// In the cargo bed, the barrel on a post: a big tan-brown tube made up as a hot dog, the Hatfield oval on
// its side, swivelling and tipping on a steel yoke, a hose to the CO2 at its breech. Hung on the bed's
// side, a giant hot dog in a bun with a zigzag of yellow mustard and the Hatfield logo, and a white cut-out
// of steam rising off it. The Gator's own frame: facing -z, the origin on the ground midway between the
// axles.
//
//   const g = new Gator( parent );
//   g.set( { x, z, yaw, dist, steer, aimYaw, aimPitch, recoil, visible } )

export const GATOR = { bedY: 0.8, pivotZ: 0.42, pivotY: 1.72, seatY: 0.62 };
const AX_F = - 0.92, AX_R = 0.88, TR = 1.18, TYRE = { r: 0.29, w: 0.24 };
const PAL = [ 'green', 'greenDark', 'yellow', 'black', 'steel', 'seat', 'rubber', 'lamp', 'tail', 'dog', 'hatfield', 'bun', 'decal', 'glass' ];
const PA = Object.fromEntries( PAL.map( ( k, i ) => [ k, i ] ) );

// the bun sign and the Hatfield ovals, painted
function signs() {

	return canvasTexture( 1024, 512, ( ctx ) => {

		// rows: 0 the bun sign (1024 x 384), 1 the Hatfield oval (256 x 128) at the bottom left
		ctx.clearRect( 0, 0, 1024, 512 );
		// the steam: three soft white curls rising off it
		ctx.fillStyle = '#f2f1ec';
		for ( const x of [ 330, 520, 700 ] ) {

			ctx.beginPath();
			ctx.moveTo( x - 30, 170 );
			ctx.bezierCurveTo( x - 80, 120, x + 30, 90, x - 20, 40 );
			ctx.bezierCurveTo( x + 10, 20, x + 60, 60, x + 30, 90 );
			ctx.bezierCurveTo( x + 70, 120, x + 10, 150, x + 30, 170 );
			ctx.closePath(); ctx.fill();

		}

		// the bun: two golden halves, the lower one shown under the dog
		const bun = ctx.createLinearGradient( 0, 170, 0, 380 );
		bun.addColorStop( 0, '#e0a24e' ); bun.addColorStop( 0.5, '#c98535' ); bun.addColorStop( 1, '#a4631f' );
		ctx.fillStyle = bun;
		ctx.beginPath(); ctx.ellipse( 512, 290, 470, 88, 0, 0, Math.PI * 2 ); ctx.fill();
		// the dog: red-brown, the ends rounded, sticking out past the bun
		const dog = ctx.createLinearGradient( 0, 200, 0, 300 );
		dog.addColorStop( 0, '#b4402a' ); dog.addColorStop( 0.5, '#8e2c1c' ); dog.addColorStop( 1, '#6a1e12' );
		ctx.fillStyle = dog;
		ctx.beginPath(); ctx.ellipse( 512, 238, 500, 48, 0, 0, Math.PI * 2 ); ctx.fill();
		// the mustard: a zigzag down its length
		ctx.strokeStyle = '#f2cf1d'; ctx.lineWidth = 16; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
		ctx.beginPath();
		for ( let i = 0; i <= 22; i ++ ) ctx.lineTo( 90 + i * 38, 222 + ( i % 2 ? 18 : - 10 ) );
		ctx.stroke();
		// the Hatfield oval on the bun
		oval( ctx, 512, 322, 110, 40 );
		// row 1: the oval alone for the barrel
		oval( ctx, 128, 448, 118, 52 );

	}, 'phanatic-gator-signs' );

}

function oval( ctx, cx, cy, rx, ry ) {

	ctx.save();
	ctx.fillStyle = '#f4f2ec'; ctx.beginPath(); ctx.ellipse( cx, cy, rx + 5, ry + 5, 0, 0, Math.PI * 2 ); ctx.fill();
	ctx.fillStyle = '#c8202a'; ctx.beginPath(); ctx.ellipse( cx, cy, rx, ry, 0, 0, Math.PI * 2 ); ctx.fill();
	ctx.fillStyle = '#f4f2ec'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
	ctx.font = `italic 700 ${ Math.round( ry * 1.15 ) }px Georgia, "Times New Roman", serif`;
	ctx.fillText( 'Hatfield', cx, cy + 2, rx * 1.7 );
	ctx.restore();

}

function material( tex ) {

	const N = PAL.length;
	const uv = `vec2f( ( fract( in.uv.x * ${ N }.0 ) - 0.02 ) / 0.96, 1.0 - in.uv.y )`;
	return standard( {
		name: 'phanatic-gator', roughness: 0.45, textures: { phGator: tex }, side: 'double', alphaTest: 0.5,
		surface: /* wgsl */`
	let k = i32( in.uv.x * ${ N }.0 );
	let night = smoothstep( 0.2, 0.8, frame.night );
	var c = vec3f( 0.5 ); var r = 0.45; var mt = 0.0; var e = vec3f( 0.0 ); var a = 1.0;
	switch k {
		case ${ PA.green }: { c = vec3f( 0.02, 0.13, 0.03 ); r = 0.35; }
		case ${ PA.greenDark }: { c = vec3f( 0.012, 0.05, 0.015 ); r = 0.5; }
		case ${ PA.yellow }: { c = vec3f( 0.75, 0.52, 0.02 ); r = 0.35; }
		case ${ PA.black }: { c = vec3f( 0.018 ); r = 0.5; }
		case ${ PA.steel }: { c = vec3f( 0.42, 0.42, 0.44 ); r = 0.3; mt = 0.9; }
		case ${ PA.seat }: { c = vec3f( 0.025 ); r = 0.45; }
		case ${ PA.rubber }: { c = vec3f( 0.022 ); r = 0.85; if ( fract( in.uv.y * 48.0 ) < 0.3 ) { c = vec3f( 0.01 ); } }
		case ${ PA.lamp }: { c = vec3f( 0.8, 0.8, 0.75 ); r = 0.05; e = vec3f( 1.0, 0.95, 0.82 ) * mix( 0.2, 3.0, night ); }
		case ${ PA.tail }: { c = vec3f( 0.45, 0.02, 0.02 ); r = 0.1; e = vec3f( 1.0, 0.05, 0.03 ) * night; }
		case ${ PA.dog }: {
			// the barrel's skin: a hot dog's tan-brown, darker where it's "grilled"
			c = vec3f( 0.36, 0.14, 0.06 ) * ( 0.85 + 0.15 * sin( in.uv.y * 40.0 ) ); r = 0.35;
		}
		case ${ PA.hatfield }: {
			// the Hatfield oval (the signs' atlas, bottom left)
			let t = textureSample( phGator, smpAnisoClamp, vec2f( ( fract( in.uv.x * ${ N }.0 ) - 0.02 ) / 0.96 * 0.25, 0.75 + ( 1.0 - in.uv.y ) * 0.25 ) );
			c = mix( vec3f( 0.36, 0.14, 0.06 ), t.rgb, t.a ); r = 0.35;
		}
		case ${ PA.bun }: {
			// the bun sign: a cut-out (alpha-tested), the top three quarters of the atlas
			let q = ${ uv };
			let t = textureSample( phGator, smpAnisoClamp, vec2f( q.x, q.y * 0.75 ) );
			c = t.rgb; r = 0.5; a = t.a;

		}
		case ${ PA.glass }: { c = vec3f( 0.02 ); r = 0.05; }
		default: { c = vec3f( 0.02 ); }
	}
	s.albedo = c; s.roughness = r; s.metalness = mt; s.emissive = e; s.alpha = a;
` } );

}

function wheel( k, { r, w } ) {

	const cyl = ( s ) => new CylinderGeometry( 1, 1, 1, s, 1, false );
	const prof = [ [ r * 0.55, - w / 2 ], [ r * 0.9, - w * 0.5 ], [ r, - w * 0.36 ], [ r, w * 0.36 ], [ r * 0.9, w * 0.5 ], [ r * 0.55, w / 2 ] ];
	k.add( new LatheGeometry( prof.map( ( [ a, b ] ) => new Vector2( a, b ) ), 28 ), PA.rubber, [ 0, 0, 0 ], [ 0, 0, Math.PI / 2 ], [ 1, 1, 1 ], { useU: true } );
	k.add( cyl( 20 ), PA.yellow, [ w * 0.05, 0, 0 ], [ 0, 0, Math.PI / 2 ], [ r * 0.56, w * 0.86, r * 0.56 ] );
	k.add( cyl( 12 ), PA.steel, [ w * 0.46, 0, 0 ], [ 0, 0, Math.PI / 2 ], [ r * 0.15, 0.03, r * 0.15 ] );
	return k;

}

export class Gator {

	constructor( parent ) {

		this.group = new Group();
		this.group.name = 'phanatic-gator';
		this.group.userData.dynamic = true;
		parent.add( this.group );
		this.material = material( signs() );
		const k = new Kit( PAL.length );
		const box = new BoxGeometry( 1, 1, 1 );
		const cyl = ( s = 10 ) => new CylinderGeometry( 1, 1, 1, s, 1, false );
		const tube = ( a, b, r, pal = PA.black ) => k.tube( cyl, pal, a, b, r, 8 );
		// ---- the chassis and the hood: the green hood sloping down to the front, the headlights, the
		// black grille and bumper, the front fenders over the wheels
		k.add( box, PA.black, [ 0, 0.36, 0 ], [ 0, 0, 0 ], [ 0.9, 0.12, 2.4 ] );
		k.add( box, PA.green, [ 0, 0.66, AX_F - 0.12 ], [ - 0.14, 0, 0 ], [ 1.12, 0.3, 0.9 ] );
		k.add( box, PA.greenDark, [ 0, 0.55, AX_F - 0.6 ], [ 0.2, 0, 0 ], [ 1.0, 0.3, 0.1 ] );
		for ( const sx of [ - 0.36, 0.36 ] ) k.add( box, PA.lamp, [ sx, 0.64, AX_F - 0.58 ], [ 0.2, 0, 0 ], [ 0.14, 0.08, 0.02 ] );
		k.add( box, PA.black, [ 0, 0.36, AX_F - 0.66 ], [ 0, 0, 0 ], [ 1.18, 0.1, 0.08 ] );
		for ( const sx of [ - 1, 1 ] ) {

			const arch = new CylinderGeometry( 1, 1, 1, 12, 1, true, - Math.PI * 0.6, Math.PI * 1.05 );
			k.add( arch, PA.green, [ sx * TR / 2, TYRE.r, AX_F ], [ 0, 0, Math.PI / 2 ], [ TYRE.r + 0.07, TYRE.w + 0.1, TYRE.r + 0.07 ] );

		}

		// ---- the cab: the floorboard, the dash, the wheel on its column, the bench seat (black and
		// yellow), its back, the side grab bars, the yellow hip rails
		k.add( box, PA.black, [ 0, 0.34, - 0.35 ], [ 0, 0, 0 ], [ 1.2, 0.04, 0.8 ] );
		k.add( box, PA.greenDark, [ 0, 0.82, - 0.66 ], [ - 0.5, 0, 0 ], [ 1.1, 0.26, 0.12 ] );
		tube( [ - 0.3, 0.75, - 0.62 ], [ - 0.3, 1.0, - 0.45 ], 0.02 );
		k.add( new TorusGeometry( 0.17, 0.015, 6, 20 ), PA.black, [ - 0.3, 1.02, - 0.44 ], [ - 1.0, 0, 0 ] );
		k.add( box, PA.yellow, [ 0, GATOR.seatY - 0.12, 0.02 ], [ 0, 0, 0 ], [ 1.12, 0.24, 0.5 ] );
		k.add( box, PA.seat, [ 0, GATOR.seatY + 0.02, 0.02 ], [ 0, 0, 0 ], [ 1.08, 0.08, 0.46 ] );
		k.add( box, PA.seat, [ 0, GATOR.seatY + 0.3, 0.26 ], [ - 0.12, 0, 0 ], [ 1.08, 0.42, 0.08 ] );
		for ( const sx of [ - 0.6, 0.6 ] ) {

			tube( [ sx, 0.5, - 0.2 ], [ sx, 0.95, 0.1 ], 0.018, PA.yellow );
			tube( [ sx, 0.95, 0.1 ], [ sx, 0.95, 0.28 ], 0.018, PA.yellow );

		}

		// ---- the cargo box: green steel sides, the tailgate, the black floor; the rear fenders
		const bz0 = 0.3, bz1 = 1.42, bw = 1.2, by = GATOR.bedY;
		k.add( box, PA.black, [ 0, by - 0.03, ( bz0 + bz1 ) / 2 ], [ 0, 0, 0 ], [ bw, 0.05, bz1 - bz0 ] );
		for ( const sx of [ - 1, 1 ] ) k.add( box, PA.green, [ sx * bw / 2, by + 0.14, ( bz0 + bz1 ) / 2 ], [ 0, 0, 0 ], [ 0.04, 0.3, bz1 - bz0 ] );
		k.add( box, PA.green, [ 0, by + 0.14, bz0 ], [ 0, 0, 0 ], [ bw, 0.3, 0.04 ] );
		k.add( box, PA.green, [ 0, by + 0.14, bz1 ], [ 0, 0, 0 ], [ bw, 0.3, 0.04 ] );
		k.add( box, PA.green, [ 0, by - 0.18, ( bz0 + bz1 ) / 2 ], [ 0, 0, 0 ], [ bw, 0.3, bz1 - bz0 - 0.1 ] );
		for ( const sx of [ - 1, 1 ] ) {

			const arch = new CylinderGeometry( 1, 1, 1, 12, 1, true, - Math.PI * 0.5, Math.PI * 1.0 );
			k.add( arch, PA.green, [ sx * TR / 2, TYRE.r, AX_R ], [ 0, 0, Math.PI / 2 ], [ TYRE.r + 0.06, TYRE.w + 0.08, TYRE.r + 0.06 ] );

		}

		for ( const sx of [ - 0.45, 0.45 ] ) k.add( box, PA.tail, [ sx, by - 0.05, bz1 + 0.025 ], [ 0, 0, 0 ], [ 0.1, 0.06, 0.01 ] );
		// ---- the launcher's post at the front of the bed, braced back to the box, its yoke
		const pz = GATOR.pivotZ, py = GATOR.pivotY;
		tube( [ 0, by, pz ], [ 0, py - 0.12, pz ], 0.045, PA.steel );
		tube( [ 0, by + 0.3, pz + 0.55 ], [ 0, py - 0.35, pz ], 0.022, PA.steel );
		k.add( box, PA.steel, [ 0, py - 0.1, pz ], [ 0, 0, 0 ], [ 0.12, 0.06, 0.12 ] );
		// the CO2 bottle strapped to the post, the hose
		k.add( cyl( 12 ), PA.steel, [ 0.2, by + 0.45, pz + 0.12 ], [ 0, 0, 0 ], [ 0.08, 0.7, 0.08 ] );
		k.add( cyl( 12 ), PA.black, [ 0.2, by + 0.83, pz + 0.12 ], [ 0, 0, 0 ], [ 0.03, 0.08, 0.03 ] );
		// ---- the bun sign on the left side of the box (it faces the stands as they go down the line), a
		// cut-out both sides
		const sign = new PlaneGeometry( 1.7, 0.64 );
		k.add( sign, PA.bun, [ - bw / 2 - 0.03, by + 0.28, ( bz0 + bz1 ) / 2 - 0.05 ], [ 0, - Math.PI / 2, 0 ], [ 1, 1, 1 ], { uv2: true } );
		this.body = new Mesh( k.geometry(), this.material );
		this.body.name = 'phanatic-gator-body';
		this.body.castShadow = true;
		this.body.receiveShadow = true;
		this.group.add( this.body );
		this.triangles = k.triangles;
		// ---- the barrel: a hot dog 1.6 m long on the yoke (its own mesh: it turns and tips), the Hatfield
		// oval each side, the breech's steel cap and the grip
		const b = new Kit( PAL.length );
		const L = 1.6, R = 0.13, back = BARREL_BACK;
		const dog = new LatheGeometry( [ [ 0.0, 0 ], [ R * 0.7, 0.02 ], [ R * 0.95, 0.08 ], [ R, 0.18 ], [ R, L - 0.18 ], [ R * 0.95, L - 0.08 ], [ R * 0.7, L - 0.02 ], [ 0.0, L ] ].map( ( [ a, c ] ) => new Vector2( a, c ) ), 18 );
		b.add( dog, PA.dog, [ 0, 0, back ], [ - Math.PI / 2, 0, 0 ], [ 1, 1, 1 ] );
		for ( const sx of [ - 1, 1 ] ) b.add( new PlaneGeometry( 0.34, 0.14 ), PA.hatfield, [ sx * ( R + 0.004 ), 0.0, back - L * 0.55 ], [ 0, sx * Math.PI / 2, 0 ], [ 1, 1, 1 ], { uv2: true } );
		b.add( cyl( 14 ), PA.steel, [ 0, 0, back + 0.02 ], [ Math.PI / 2, 0, 0 ], [ R * 0.8, 0.06, R * 0.8 ] );
		b.add( box, PA.black, [ 0, - 0.14, back - 0.05 ], [ 0.3, 0, 0 ], [ 0.04, 0.16, 0.05 ] );
		b.add( box, PA.steel, [ 0, - 0.08, 0 ], [ 0, 0, 0 ], [ 0.04, 0.1, 0.1 ] );
		this.barrel = new Mesh( b.geometry(), this.material );
		this.barrel.name = 'phanatic-gator-barrel';
		this.barrel.castShadow = true;
		this.pivot = new Group();
		this.pivot.position.set( 0, py, pz );
		this.pivot.add( this.barrel );
		this.group.add( this.pivot );
		this.triangles += b.triangles;
		// ---- the wheels
		this.wheels = [];
		const wg = wheel( new Kit( PAL.length ), TYRE ).geometry();
		for ( const [ x, z, front ] of [ [ - TR / 2, AX_F, true ], [ TR / 2, AX_F, true ], [ - TR / 2, AX_R, false ], [ TR / 2, AX_R, false ] ] ) {

			const hub = new Group();
			hub.position.set( x, TYRE.r, z );
			const m = new Mesh( wg, this.material );
			m.name = 'phanatic-gator-wheel';
			m.castShadow = true;
			if ( x < 0 ) m.rotation.y = Math.PI;
			hub.add( m );
			this.group.add( hub );
			this.wheels.push( { hub, mesh: m, front } );

		}

		this.group.visible = false;

	}

	set( { x = 0, z = 0, yaw = 0, dist = 0, steer = 0, aimYaw = 0, aimPitch = 0.1, recoil = 0, visible = true } ) {

		this.group.visible = visible;
		if ( ! visible ) return;
		this.group.position.set( x, 0, z );
		this.group.rotation.set( 0, yaw, 0 );
		this.pivot.rotation.set( 0, aimYaw, 0, 'YXZ' );
		this.barrel.rotation.set( aimPitch + recoil, 0, 0 );
		for ( const w of this.wheels ) {

			w.hub.rotation.set( 0, w.front ? steer : 0, 0, 'YXZ' );
			w.mesh.rotation.x = - dist / TYRE.r;

		}

	}

	// where the driver and the passenger sit (the Gator's frame: [ x, y, z ])
	static seats() {

		return { driver: [ - 0.3, GATOR.seatY, 0.02 ], passenger: [ 0.3, GATOR.seatY, 0.02 ] };

	}

}

void SphereGeometry;
