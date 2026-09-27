import { Group, Mesh, PlaneGeometry, BoxGeometry, CylinderGeometry, SphereGeometry, LatheGeometry, Vector2 } from '../../../engine/index.js';
import { standard } from '../../../materials/Materials.js';
import { canvasTexture } from '../../geo.js';
import { Kit } from './Kit.js';

// The Phanatic's four-wheeler in 2008: a red Honda FourTrax Recon, the 250 cc utility quad (the 2008
// photos: flickr 2598893736, 2651835254, 2426733500, 2817490595; Getty 83088147, 83835784). Red plastics
// over a black frame; black tubular racks front and rear; a brush guard over the grille with the two
// headlights in it; a black seat; silver-grey steel wheels with four lugs on low, turf-tread tyres (they
// leave curved tracks in the grass); "Phillie Phanatic" in white script on the front fenders, a white
// baseball on each fender top, RECON and a HOME RUN! decal on the side panel, HONDA in white on the rear
// fender, and on the back a plate reading PHANATIC in red. The Recon's size: 1.83 m long, 1.08 m wide,
// the seat 0.79 m up, 1.18 m between the axles, 22 inch tyres.
//
// Its own frame: facing -z, the origin on the ground under the middle of the seat (where the rider's root
// goes). The body is one merged mesh on one palette material; the four wheels are their own meshes so
// they turn (rolling by the distance covered, the front pair steering).
//
//   const atv = new ATV( parent );
//   atv.set( { x, z, yaw, dist, steer, pitch, roll, visible } )   (field frame)

export const SEAT = 0.8;
const AXLE_F = - 0.66, AXLE_R = 0.52;
const TYRE_F = { r: 0.28, w: 0.18 }, TYRE_R = { r: 0.28, w: 0.25 };
const TRACK_F = 0.82, TRACK_R = 0.8;

// the palette (the surface picks by uv.x)
const PAL = [ 'red', 'black', 'frame', 'metal', 'chrome', 'seat', 'rubber', 'rim', 'lamp', 'tail', 'white', 'script', 'honda', 'plate', 'recon', 'ball', 'grip', 'exhaust', 'reflector' ];
export const PA = Object.fromEntries( PAL.map( ( k, i ) => [ k, i ] ) );
// the decals' rows in their atlas
const ROWS = { script: 0, honda: 1, plate: 2, recon: 3, ball: 4 };
const NROWS = 5;

function decals() {

	return canvasTexture( 512, 128 * NROWS, ( ctx, w ) => {

		const H = 128;
		ctx.clearRect( 0, 0, w, H * NROWS );
		ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
		// "Phillie Phanatic" in the club's script, white
		ctx.fillStyle = '#f4f2ec';
		ctx.font = 'italic 700 74px Georgia, "Times New Roman", serif';
		ctx.save(); ctx.translate( w / 2, H * ( ROWS.script + 0.55 ) ); ctx.rotate( - 0.08 ); ctx.fillText( 'Phillie Phanatic', 0, 0, w - 20 ); ctx.restore();
		// HONDA
		ctx.font = '900 92px "Helvetica Neue", Arial, sans-serif';
		ctx.fillText( 'HONDA', w / 2, H * ( ROWS.honda + 0.5 ), w - 60 );
		// the plate: black, a chrome frame, PHANATIC in red outlined white
		{

			const y = H * ROWS.plate;
			ctx.fillStyle = '#b8b8b8'; ctx.fillRect( 0, y, w, H );
			ctx.fillStyle = '#101010'; ctx.fillRect( 14, y + 12, w - 28, H - 24 );
			ctx.font = '900 84px "Arial Narrow", "Helvetica Neue", Arial, sans-serif';
			ctx.lineWidth = 8; ctx.strokeStyle = '#f0f0f0'; ctx.strokeText( 'PHANATIC', w / 2, y + H / 2 + 2, w - 60 );
			ctx.fillStyle = '#d0202a'; ctx.fillText( 'PHANATIC', w / 2, y + H / 2 + 2, w - 60 );

		}

		// RECON and the HOME RUN! decal
		{

			const y = H * ROWS.recon;
			ctx.fillStyle = '#f4f2ec';
			ctx.font = 'italic 900 62px "Arial Black", "Helvetica Neue", Arial, sans-serif';
			ctx.fillText( 'RECON', w * 0.3, y + H * 0.5, w * 0.55 );
			ctx.fillStyle = '#0b2a5b'; ctx.fillRect( w * 0.62, y + 30, w * 0.34, H - 60 );
			ctx.fillStyle = '#f4f2ec'; ctx.font = 'italic 900 34px "Arial Black", Arial, sans-serif';
			ctx.fillText( 'HOME RUN!', w * 0.79, y + H * 0.5, w * 0.32 );

		}

		// a baseball: a white disc with the red stitches
		{

			const y = H * ROWS.ball, cx = w / 2, cy = y + H / 2, r = 54;
			ctx.fillStyle = '#f6f4ee'; ctx.beginPath(); ctx.arc( cx, cy, r, 0, Math.PI * 2 ); ctx.fill();
			ctx.strokeStyle = '#c8202a'; ctx.lineWidth = 3;
			for ( const s of [ - 1, 1 ] ) {

				ctx.beginPath(); ctx.arc( cx + s * r * 1.35, cy, r * 0.95, Math.PI - 0.72, Math.PI + 0.72 ); if ( s < 0 ) ctx.stroke();
				ctx.beginPath(); ctx.arc( cx + s * r * 1.35, cy, r * 0.95, - 0.72, 0.72 ); if ( s > 0 ) ctx.stroke();

			}

		}

	}, 'phanatic-atv-decals' );

}

function bodyMaterial( decal ) {

	const N = PAL.length;
	const row = ( r ) => `textureSample( phDecal, smpAnisoClamp, vec2f( ( fract( in.uv.x * ${ N }.0 ) - 0.02 ) / 0.96, ( ${ r }.0 + 1.0 - in.uv.y ) / ${ NROWS }.0 ) )`;
	const RED = 'vec3f( 0.52, 0.035, 0.02 )';
	return standard( {
		name: 'phanatic-atv', roughness: 0.4, textures: { phDecal: decal },
		surface: /* wgsl */`
	let k = i32( in.uv.x * ${ N }.0 );
	let night = smoothstep( 0.2, 0.8, frame.night );
	var c = vec3f( 0.5 ); var r = 0.45; var mt = 0.0; var e = vec3f( 0.0 );
	switch k {
		case ${ PA.red }: { c = ${ RED }; r = 0.3; }
		case ${ PA.black }: { c = vec3f( 0.018 ); r = 0.45; }
		case ${ PA.frame }: { c = vec3f( 0.025 ); r = 0.4; mt = 0.5; }
		case ${ PA.metal }: { c = vec3f( 0.2, 0.2, 0.21 ); r = 0.5; mt = 0.7; }
		case ${ PA.chrome }: { c = vec3f( 0.7, 0.7, 0.72 ); r = 0.12; mt = 1.0; }
		case ${ PA.seat }: { c = vec3f( 0.025, 0.025, 0.028 ); r = 0.45; }
		case ${ PA.rubber }: {
			// the low turf tread: shallow grooves across it (uv.y is the way round)
			c = vec3f( 0.022, 0.021, 0.02 ); r = 0.85;
			if ( fract( in.uv.y * 64.0 ) < 0.18 ) { c = vec3f( 0.01 ); r = 0.95; }
		}
		case ${ PA.rim }: { c = vec3f( 0.46, 0.47, 0.48 ); r = 0.35; mt = 0.85; }
		case ${ PA.lamp }: { c = vec3f( 0.8, 0.8, 0.75 ); r = 0.05; e = vec3f( 1.0, 0.95, 0.82 ) * mix( 0.3, 5.0, night ); }
		case ${ PA.tail }: { c = vec3f( 0.45, 0.02, 0.02 ); r = 0.1; e = vec3f( 1.0, 0.05, 0.03 ) * mix( 0.15, 1.6, night ); }
		case ${ PA.white }: { c = vec3f( 0.78, 0.77, 0.74 ); r = 0.3; }
		case ${ PA.script }: { let d = ${ row( ROWS.script ) }; c = mix( ${ RED }, d.rgb, d.a ); r = 0.3; }
		case ${ PA.honda }: { let d = ${ row( ROWS.honda ) }; c = mix( ${ RED }, d.rgb, d.a ); r = 0.3; }
		case ${ PA.plate }: { let d = ${ row( ROWS.plate ) }; c = d.rgb; r = 0.3; mt = 0.3; }
		case ${ PA.recon }: { let d = ${ row( ROWS.recon ) }; c = mix( ${ RED }, d.rgb, d.a ); r = 0.3; }
		case ${ PA.ball }: { let d = ${ row( ROWS.ball ) }; c = mix( ${ RED }, d.rgb, d.a ); r = 0.3; }
		case ${ PA.grip }: { c = vec3f( 0.015 ); r = 0.8; }
		case ${ PA.exhaust }: { c = vec3f( 0.42, 0.4, 0.38 ); r = 0.25; mt = 0.9; }
		case ${ PA.reflector }: { c = vec3f( 0.6, 0.25, 0.02 ); r = 0.1; e = vec3f( 0.6, 0.2, 0.0 ) * night * 0.3; }
		default: { c = vec3f( 0.02 ); }
	}
	s.albedo = c; s.roughness = r; s.metalness = mt; s.emissive = e;
` } );

}

// a tyre and its rim, in the wheel's own frame (the axle along x): a lathed tyre (its uv.y the angle
// round, for the tread), the pressed steel wheel dished out, its hub and four lugs
function wheelKit( k, { r, w } ) {

	const cyl = ( s ) => new CylinderGeometry( 1, 1, 1, s, 1, false );
	const prof = [ [ r * 0.5, - w / 2 ], [ r * 0.84, - w * 0.52 ], [ r * 0.96, - w * 0.46 ], [ r, - w * 0.34 ], [ r, w * 0.34 ], [ r * 0.96, w * 0.46 ], [ r * 0.84, w * 0.52 ], [ r * 0.5, w / 2 ] ];
	k.add( new LatheGeometry( prof.map( ( [ a, b ] ) => new Vector2( a, b ) ), 30 ), PA.rubber, [ 0, 0, 0 ], [ 0, 0, Math.PI / 2 ], [ 1, 1, 1 ], { useU: true } );
	k.add( cyl( 22 ), PA.rim, [ w * 0.06, 0, 0 ], [ 0, 0, Math.PI / 2 ], [ r * 0.52, w * 0.88, r * 0.52 ] );
	k.add( cyl( 20 ), PA.rim, [ w * 0.43, 0, 0 ], [ 0, 0, Math.PI / 2 ], [ r * 0.36, 0.03, r * 0.36 ] );
	k.add( cyl( 12 ), PA.metal, [ w * 0.47, 0, 0 ], [ 0, 0, Math.PI / 2 ], [ r * 0.14, 0.04, r * 0.14 ] );
	for ( let i = 0; i < 4; i ++ ) {

		const a = i / 4 * Math.PI * 2 + Math.PI / 4;
		k.add( cyl( 6 ), PA.chrome, [ w * 0.47, Math.cos( a ) * r * 0.22, Math.sin( a ) * r * 0.22 ], [ 0, 0, Math.PI / 2 ], [ 0.013, 0.03, 0.013 ] );

	}

	return k;

}

export class ATV {

	constructor( parent ) {

		this.group = new Group();
		this.group.name = 'phanatic-atv';
		this.group.userData.dynamic = true;
		parent.add( this.group );
		this.decal = decals();
		this.material = bodyMaterial( this.decal );
		const k = new Kit( PAL.length );
		const box = new BoxGeometry( 1, 1, 1 );
		const cyl = ( s = 10 ) => new CylinderGeometry( 1, 1, 1, s, 1, false );
		const sph = new SphereGeometry( 1, 16, 10 );
		const plane = new PlaneGeometry( 1, 1 );
		const tube = ( a, b, r, pal = PA.frame ) => k.tube( cyl, pal, a, b, r, 8 );

		// ---- the frame, the engine (the Recon's air-cooled single, grey, the cylinder fins), the exhaust
		// round the right side to the muffler under the rear rack
		for ( const x of [ - 0.15, 0.15 ] ) {

			tube( [ x, 0.26, AXLE_F + 0.05 ], [ x, 0.26, AXLE_R ], 0.02 );
			tube( [ x, 0.26, AXLE_F + 0.05 ], [ x * 0.8, 0.6, AXLE_F + 0.2 ], 0.018 );
			tube( [ x, 0.26, - 0.1 ], [ x, 0.66, 0.05 ], 0.018 );
			tube( [ x, 0.66, 0.05 ], [ x, 0.7, AXLE_R + 0.3 ], 0.018 );

		}

		k.add( box, PA.metal, [ 0, 0.22, - 0.1 ], [ 0, 0, 0 ], [ 0.32, 0.03, 0.8 ] );
		k.add( box, PA.metal, [ 0, 0.4, - 0.08 ], [ 0, 0, 0 ], [ 0.3, 0.28, 0.4 ] );
		k.add( cyl( 12 ), PA.metal, [ 0, 0.6, - 0.18 ], [ 0.35, 0, 0 ], [ 0.08, 0.2, 0.08 ] );
		for ( let i = 0; i < 5; i ++ ) k.add( cyl( 12 ), PA.metal, [ 0, 0.54 + i * 0.03, - 0.18 - i * 0.011 ], [ 0.35, 0, 0 ], [ 0.105, 0.009, 0.105 ] );
		tube( [ 0.03, 0.62, - 0.28 ], [ 0.16, 0.54, - 0.3 ], 0.02, PA.exhaust );
		tube( [ 0.16, 0.54, - 0.3 ], [ 0.21, 0.5, 0.15 ], 0.02, PA.exhaust );
		tube( [ 0.21, 0.5, 0.15 ], [ 0.22, 0.52, 0.55 ], 0.022, PA.exhaust );
		k.add( cyl( 14 ), PA.chrome, [ 0.22, 0.53, 0.66 ], [ Math.PI / 2, 0, 0 ], [ 0.055, 0.28, 0.055 ] );
		k.add( cyl( 10 ), PA.black, [ 0.22, 0.53, 0.81 ], [ Math.PI / 2, 0, 0 ], [ 0.03, 0.03, 0.03 ] );

		// ---- the plastics: the front fender assembly (both fenders and the hood between, one piece), the
		// tank shroud, the side panels and the footwells, the rear fender assembly
		for ( const sx of [ - 1, 1 ] ) {

			// a front fender: a shell arched over the tyre, the flat top running back into the footwell
			const arch = new CylinderGeometry( 1, 1, 1, 14, 1, true, - Math.PI * 0.6, Math.PI * 1.05 );
			k.add( arch, PA.red, [ sx * TRACK_F / 2, TYRE_F.r, AXLE_F ], [ 0, 0, Math.PI / 2 ], [ TYRE_F.r + 0.06, TYRE_F.w + 0.12, TYRE_F.r + 0.06 ] );
			k.add( box, PA.red, [ sx * 0.33, 0.6, AXLE_F + 0.34 ], [ 0.2, 0, sx * 0.05 ], [ 0.3, 0.03, 0.34 ] );
			// the script on the fender's outside face, a baseball on its top
			k.add( plane, PA.script, [ sx * ( TRACK_F / 2 + TYRE_F.w / 2 + 0.065 ), TYRE_F.r + 0.2, AXLE_F + 0.04 ], [ 0, sx * Math.PI / 2, 0 ], [ 0.36, 0.09, 1 ], { uv2: true } );
			k.add( plane, PA.ball, [ sx * TRACK_F / 2, TYRE_F.r + TYRE_F.r + 0.065, AXLE_F - 0.02 ], [ - Math.PI / 2, 0, 0 ], [ 0.1, 0.1, 1 ], { uv2: true } );
			// the rear fender, the same over the back tyre, and its skirt down to the footwell
			const archR = new CylinderGeometry( 1, 1, 1, 14, 1, true, - Math.PI * 0.45, Math.PI * 1.1 );
			k.add( archR, PA.red, [ sx * TRACK_R / 2, TYRE_R.r, AXLE_R ], [ 0, 0, Math.PI / 2 ], [ TYRE_R.r + 0.06, TYRE_R.w + 0.12, TYRE_R.r + 0.06 ] );
			k.add( box, PA.red, [ sx * 0.3, 0.6, AXLE_R - 0.3 ], [ - 0.25, 0, - sx * 0.08 ], [ 0.28, 0.03, 0.26 ] );
			// the side panel under the seat, RECON and the HOME RUN! decal on it
			k.add( box, PA.red, [ sx * 0.17, 0.62, 0.18 ], [ 0, 0, sx * 0.1 ], [ 0.03, 0.18, 0.48 ] );
			k.add( plane, PA.recon, [ sx * 0.19, 0.62, 0.18 ], [ 0, sx * Math.PI / 2, - sx * 0.1 ], [ 0.44, 0.11, 1 ], { uv2: true } );
			// on the rear fender's back face: a baseball, HONDA under it, an amber reflector
			k.add( plane, PA.ball, [ sx * 0.36, 0.68, AXLE_R + TYRE_R.r + 0.075 ], [ 0, 0, 0 ], [ 0.1, 0.1, 1 ], { uv2: true } );
			k.add( plane, PA.honda, [ sx * 0.36, 0.6, AXLE_R + TYRE_R.r + 0.075 ], [ 0, 0, 0 ], [ 0.17, 0.04, 1 ], { uv2: true } );
			k.add( box, PA.reflector, [ sx * 0.36, 0.55, AXLE_R + TYRE_R.r + 0.078 ], [ 0, 0, 0 ], [ 0.1, 0.012, 0.01 ] );
			// the footwell: a black plate between the fenders, the peg
			k.add( box, PA.black, [ sx * 0.31, 0.29, - 0.02 ], [ 0, 0, 0 ], [ 0.24, 0.025, 0.44 ] );
			tube( [ sx * 0.43, 0.3, - 0.24 ], [ sx * 0.43, 0.3, 0.2 ], 0.014, PA.black );

		}

		// the front: the grille between the fenders with the two headlights in it, the brush guard over it
		k.add( box, PA.red, [ 0, 0.58, AXLE_F + 0.02 ], [ - 0.12, 0, 0 ], [ 0.56, 0.08, 0.55 ] );
		k.add( box, PA.black, [ 0, 0.47, AXLE_F - 0.3 ], [ 0.25, 0, 0 ], [ 0.46, 0.2, 0.06 ] );
		for ( const sx of [ - 0.13, 0.13 ] ) {

			k.add( box, PA.black, [ sx, 0.5, AXLE_F - 0.335 ], [ 0.25, 0, 0 ], [ 0.15, 0.09, 0.02 ] );
			k.add( box, PA.lamp, [ sx, 0.502, AXLE_F - 0.345 ], [ 0.25, 0, 0 ], [ 0.12, 0.065, 0.01 ] );

		}

		// the brush guard: a hoop of black tube in front of the grille, braced to the frame
		const gz = AXLE_F - 0.44;
		tube( [ - 0.22, 0.3, gz ], [ - 0.22, 0.6, gz + 0.04 ], 0.016, PA.black );
		tube( [ 0.22, 0.3, gz ], [ 0.22, 0.6, gz + 0.04 ], 0.016, PA.black );
		tube( [ - 0.22, 0.6, gz + 0.04 ], [ 0.22, 0.6, gz + 0.04 ], 0.016, PA.black );
		tube( [ - 0.22, 0.3, gz ], [ 0.22, 0.3, gz ], 0.016, PA.black );
		tube( [ - 0.08, 0.3, gz ], [ - 0.08, 0.6, gz + 0.04 ], 0.012, PA.black );
		tube( [ 0.08, 0.3, gz ], [ 0.08, 0.6, gz + 0.04 ], 0.012, PA.black );
		for ( const sx of [ - 0.2, 0.2 ] ) tube( [ sx, 0.33, gz ], [ sx, 0.3, AXLE_F - 0.15 ], 0.014, PA.black );
		// the front rack over the fenders
		const fy = 0.72, fz0 = AXLE_F - 0.22, fz1 = AXLE_F + 0.22;
		for ( const sx of [ - 0.36, 0.36 ] ) tube( [ sx, fy, fz0 ], [ sx, fy, fz1 ], 0.012, PA.black );
		for ( const z of [ fz0, fz0 + 0.15, fz0 + 0.3, fz1 ] ) tube( [ - 0.36, fy, z ], [ 0.36, fy, z ], 0.011, PA.black );
		for ( const sx of [ - 0.3, 0.3 ] ) tube( [ sx, fy, fz1 ], [ sx * 0.6, 0.62, fz1 + 0.05 ], 0.012, PA.black );
		// the tank shroud between the bars and the seat, the fuel cap
		k.add( box, PA.red, [ 0, 0.72, - 0.28 ], [ 0.14, 0, 0 ], [ 0.34, 0.12, 0.36 ] );
		k.add( cyl( 12 ), PA.chrome, [ 0, 0.8, - 0.3 ], [ 0.14, 0, 0 ], [ 0.04, 0.02, 0.04 ] );
		// the seat: long and padded, black
		k.add( box, PA.seat, [ 0, SEAT - 0.05, 0.16 ], [ 0, 0, 0 ], [ 0.32, 0.1, 0.62 ] );
		k.add( sph, PA.seat, [ 0, SEAT - 0.02, 0.16 ], [ 0, 0, 0 ], [ 0.16, 0.03, 0.31 ] );
		// the rear: the panel with the tail light in it, the plate on its bracket under it
		k.add( box, PA.red, [ 0, 0.64, AXLE_R + 0.24 ], [ 0.05, 0, 0 ], [ 0.7, 0.14, 0.24 ] );
		k.add( box, PA.tail, [ 0, 0.62, AXLE_R + 0.365 ], [ 0, 0, 0 ], [ 0.14, 0.05, 0.02 ] );
		k.add( box, PA.frame, [ 0, 0.49, AXLE_R + 0.35 ], [ 0, 0, 0 ], [ 0.05, 0.14, 0.02 ] );
		k.add( plane, PA.plate, [ 0, 0.42, AXLE_R + 0.365 ], [ 0, 0, 0 ], [ 0.2, 0.1, 1 ], { uv2: true } );
		// the rear rack: the big grid of black tube over the rear fenders
		const ry = 0.76, rz0 = AXLE_R - 0.12, rz1 = AXLE_R + 0.34;
		for ( const sx of [ - 0.38, 0.38 ] ) tube( [ sx, ry, rz0 ], [ sx, ry, rz1 ], 0.012, PA.black );
		for ( const z of [ rz0, rz0 + 0.15, rz0 + 0.3, rz1 ] ) tube( [ - 0.38, ry, z ], [ 0.38, ry, z ], 0.011, PA.black );
		for ( const sx of [ - 0.3, 0.3 ] ) tube( [ sx, ry, rz1 ], [ sx * 0.7, 0.62, rz1 - 0.04 ], 0.012, PA.black );
		// ---- the steering: the column, the bar with its pad, the grips, the levers, the thumb throttle
		tube( [ 0, 0.6, AXLE_F + 0.2 ], [ 0, 0.95, - 0.42 ], 0.022, PA.frame );
		k.add( box, PA.black, [ 0, 0.98, - 0.43 ], [ 0.2, 0, 0 ], [ 0.2, 0.07, 0.09 ] );
		const bar = [ [ - 0.37, 1.07, - 0.46 ], [ - 0.22, 1.04, - 0.44 ], [ 0, 1.0, - 0.43 ], [ 0.22, 1.04, - 0.44 ], [ 0.37, 1.07, - 0.46 ] ];
		for ( let i = 0; i < bar.length - 1; i ++ ) tube( bar[ i ], bar[ i + 1 ], 0.013, PA.frame );
		for ( const sx of [ - 1, 1 ] ) {

			tube( [ sx * 0.3, 1.06, - 0.455 ], [ sx * 0.42, 1.08, - 0.47 ], 0.019, PA.grip );
			tube( [ sx * 0.25, 1.07, - 0.46 ], [ sx * 0.38, 1.08, - 0.54 ], 0.006, PA.metal );
			k.add( box, PA.black, [ sx * 0.24, 1.06, - 0.45 ], [ 0, 0, 0 ], [ 0.05, 0.04, 0.05 ] );

		}

		this.body = new Mesh( k.geometry(), this.material );
		this.body.name = 'phanatic-atv-body';
		this.body.castShadow = true;
		this.body.receiveShadow = true;
		this.group.add( this.body );
		this.triangles = k.triangles;

		// ---- the wheels
		this.wheels = [];
		const wf = wheelKit( new Kit( PAL.length ), TYRE_F ).geometry(), wr = wheelKit( new Kit( PAL.length ), TYRE_R ).geometry();
		for ( const [ x, z, T, geo, front ] of [ [ - TRACK_F / 2, AXLE_F, TYRE_F, wf, true ], [ TRACK_F / 2, AXLE_F, TYRE_F, wf, true ], [ - TRACK_R / 2, AXLE_R, TYRE_R, wr, false ], [ TRACK_R / 2, AXLE_R, TYRE_R, wr, false ] ] ) {

			const hub = new Group();
			hub.position.set( x, T.r, z );
			const m = new Mesh( geo, this.material );
			m.name = 'phanatic-atv-wheel';
			m.castShadow = true;
			// the wheel's dish faces out on both sides
			if ( x < 0 ) m.rotation.y = Math.PI;
			hub.add( m );
			this.group.add( hub );
			this.wheels.push( { hub, mesh: m, r: T.r, front } );
			this.triangles += geo.index.count / 3;

		}

		this.group.visible = false;

	}

	// where it is and what it's doing: dist (m travelled, for the wheels' roll), steer (rad, + left)
	set( { x = 0, y = 0, z = 0, yaw = 0, dist = 0, steer = 0, pitch = 0, roll = 0, visible = true } ) {

		const g = this.group;
		g.visible = visible;
		if ( ! visible ) return;
		g.position.set( x, y, z );
		g.rotation.set( pitch, yaw, roll, 'YXZ' );
		for ( const w of this.wheels ) {

			w.hub.rotation.set( 0, w.front ? steer : 0, 0, 'YXZ' );
			w.mesh.rotation.x = - dist / w.r;

		}

	}

}
