import { Mesh, Vector3, Quaternion } from '../../../engine/index.js';
import { standard } from '../../../materials/Materials.js';
import { canvasTexture, beam } from '../../geo.js';
import { Quads } from '../../Stands.js';
import { Builder, paletteMaterial } from './Build.js';
import { LEDGE } from './Club.js';
import { CLUB } from './Seats.js';
import { TOP, COLOR, HAT, restPose } from '../Cast.js';
import { armIK, Walkway } from '../Concourse3BKit.js';
import { hash } from './Fans.js';
import { offsetPolyline } from '../../Bowl.js';
import { LEVELS } from '../../layout.js';

// What the center field camera sees round the plate, from the evidence (Getty 83457399 and 83485455,
// Zelevansky's center field angle on Oct 27 and 29; FOX's feed of Game 5):
//   - the green panel: on the first base side of the backstop (the left of the TV picture), a padded
//     chroma-green panel over the brick, a dark green band along its top lettered phillies.com, the sign
//     company's little Van Wagner plate at its foot. FOX keyed its virtual ads onto it: in the saved
//     frames of the feed RAMADA and Nikon on the 27th, WISER'S and TIPTOP on the 29th (the feed as seen in
//     Canada). Through the center field camera it shows the ad, a half inning each; from anywhere else
//     it's green.
//   - the steel rail over the pads in front of the Diamond Club's front row, the fans' heads level with
//     its top rail, a water bottle and the cups on the ledge at its foot.
//   - a camera in the front row just to the first base side of the plate, under a black rain cover, its
//     operator in a red Phillies cap bent to the eyepiece (Getty 83485581).

// the panel along the backstop's face (x from the plate, the wall's line at z = 15.06)
export const PANEL = { x0: 1.8, x1: 6.8, y0: 0.02, y1: 1.63, band: 0.27, out: 0.1 };
const ADS = [ null, 'RAMADA', 'Nikon', "WISER'S", 'TIPTOP' ];

function drawPanel() {

	return canvasTexture( 1024, 512, ( ctx ) => {

		// row 0: the band (phillies.com); row 1: the plain green with the Van Wagner plate; rows 2..: the ads
		const cell = ( i ) => [ 0, i * 64 ];
		ctx.fillStyle = '#0d2a1e';
		ctx.fillRect( 0, 0, 1024, 64 );
		ctx.fillStyle = '#e8eae6';
		ctx.font = '700 40px "Helvetica Neue", Arial, sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText( 'phillies.com', 512, 34 );
		// the green, a faint weave of its vinyl, the plate at its foot
		ctx.fillStyle = '#1f7a36';
		ctx.fillRect( 0, 64, 1024, 64 );
		ctx.fillStyle = 'rgba( 0, 0, 0, 0.05 )';
		for ( let x = 0; x < 1024; x += 6 ) ctx.fillRect( x, 64, 2, 64 );
		ctx.fillStyle = '#0d2a1e';
		ctx.fillRect( 380, 110, 264, 16 );
		ctx.strokeStyle = '#c8cac6';
		ctx.lineWidth = 1.5;
		ctx.strokeRect( 382, 111, 260, 14 );
		ctx.fillStyle = '#c8cac6';
		ctx.font = '600 11px "Helvetica Neue", Arial, sans-serif';
		ctx.fillText( 'Van Wagner', 512, 119 );
		// the virtual ads (as keyed onto the green by the broadcast)
		ADS.forEach( ( ad, i ) => {

			if ( ! ad ) return;
			const [ x, y ] = cell( i + 1 );
			const nikon = ad === 'Nikon', wisers = ad === "WISER'S", tip = ad === 'TIPTOP';
			ctx.fillStyle = nikon ? '#101010' : wisers ? '#f1ece0' : tip ? '#c8102e' : '#1b3f8b';
			ctx.fillRect( x, y, 1024, 64 );
			ctx.fillStyle = nikon ? '#f5d000' : wisers ? '#1a1a1a' : '#ffffff';
			ctx.font = `${ nikon ? 'italic 800' : wisers ? '700' : '800' } 46px ${ wisers ? 'Georgia, "Times New Roman", serif' : '"Helvetica Neue", Arial, sans-serif' }`;
			ctx.fillText( ad, x + 512, y + 34 );

		} );

	}, 'homePanel' );

}

export function buildBackstop( place ) {

	const S = place.seats, group = place.group;
	// ---- the panel on the backstop's face, 10 cm proud of the brick
	const tex = drawPanel();
	const mat = standard( { name: 'home-panel', roughness: 0.8, textures: { hpTex: tex }, uniforms: { tv: [ 'f32', 0 ], ad: [ 'f32', 0 ] },
		varyings: { vUV: 'vec2f' }, vertex: 'o.vUV = v.uv;',
		surface: /* wgsl */`
	let uv = in.vs.vUV;
	let band = ${ ( PANEL.band / ( PANEL.y1 - PANEL.y0 ) ).toFixed( 4 ) };
	var row = 1.0;
	var v = 0.5;
	if ( uv.y > 1.0 - band ) {
		row = 0.0;
		v = ( 1.0 - uv.y ) / band;
	} else {
		v = 1.0 - uv.y / ( 1.0 - band );
		// through the center field camera: the half inning's virtual ad over the green
		if ( mat.tv > 0.5 && mat.ad > 0.5 ) { row = mat.ad + 1.0; v = 0.1 + 0.8 * v; }
	}
	var c = textureSample( hpTex, smpAnisoClamp, vec2f( uv.x, ( row + v ) / 8.0 ) ).rgb;
	// the plate's corner of the green (its own cell is the plain green with the plate across its foot)
	s.albedo = c;
	s.roughness = select( 0.7, 0.85, row == 1.0 );
	s.emissive = c * smoothstep( 0.15, 0.7, frame.night ) * 0.14;
	// the rain on the vinyl
	s.roughness = mix( s.roughness, 0.3, frame.wet );
` } );
	mat.underwaterLighting = 'none';
	mat.setDefine( 'DRY', 1 );
	const q = new Quads();
	const z = 15.06 - PANEL.out, { x0, x1, y0, y1 } = PANEL;
	// the face (u along it from the first base end, as the TV sees it left to right), its top and ends
	q.add( [ x1, y0, z ], [ x0, y0, z ], [ x0, y1, z ], [ x1, y1, z ], [ 0, 0, - 1 ] );
	q.add( [ x1, y1, z ], [ x0, y1, z ], [ x0, y1, 15.06 ], [ x1, y1, 15.06 ], [ 0, 1, 0 ] );
	q.add( [ x0, y0, z ], [ x0, y0, 15.06 ], [ x0, y1, 15.06 ], [ x0, y1, z ], [ - 1, 0, 0 ] );
	q.add( [ x1, y0, 15.06 ], [ x1, y0, z ], [ x1, y1, z ], [ x1, y1, 15.06 ], [ 1, 0, 0 ] );
	const g = q.geometry();
	// uv: along (0 at the first base end) and up (0..1)
	const pos = g.getAttribute( 'position' ), uv = g.getAttribute( 'uv' );
	for ( let i = 0; i < pos.count; i ++ ) uv.setXY( i, ( x1 - pos.getX( i ) ) / ( x1 - x0 ), ( pos.getY( i ) - y0 ) / ( y1 - y0 ) );
	const panel = new Mesh( g, mat );
	panel.name = 'home-panel';
	panel.receiveShadow = true;
	panel.userData.dynamic = true;
	group.add( panel );

	// ---- the steel rail over the pads along the club's front, standing on the ledge
	const rq = new Quads();
	const RAIL = { d: LEDGE.d0 + 0.03, top: 2.12, mid: 1.8 };
	for ( const L of CLUB ) {

		const T = S.sec[ L ];
		const s0 = T.m0 * RAIL.d, s1 = T.len - T.m1 * RAIL.d;
		const at = ( s, y ) => [ T.a[ 0 ] + T.ux * s + T.nx * RAIL.d, y, T.a[ 1 ] + T.uz * s + T.nz * RAIL.d ];
		beam( rq, at( s0, RAIL.top ), at( s1, RAIL.top ), 0.045 );
		beam( rq, at( s0, RAIL.mid ), at( s1, RAIL.mid ), 0.03 );
		beam( rq, at( s0, LEDGE.y + 0.02 ), at( s1, LEDGE.y + 0.02 ), 0.03 );
		const n = Math.max( 1, Math.round( ( s1 - s0 ) / 0.125 ) );
		for ( let i = 0; i <= n; i ++ ) {

			const s = s0 + ( s1 - s0 ) * i / n;
			beam( rq, at( s, LEDGE.y ), at( s, RAIL.top ), i % 12 === 0 ? 0.045 : 0.016 );

		}

	}

	const rail = new Mesh( rq.geometry(), place.bowl.materials?.rail || paletteMaterial( 'home-rail' ) );
	rail.name = 'home-club-rail';
	rail.receiveShadow = true;
	group.add( rail );

	// ---- the camera in the front row, first base side of the plate: its seats given over to it
	const D = S.sec.D;
	const camAt = [ 1.15, 0, 0 ];
	for ( const r of [ 0, 1 ] ) for ( const seat of S.bySec.D[ r ] || [] ) if ( seat.x > 0.45 && seat.x < 1.9 ) S.take( seat, 'camera' );
	const tread = S.ys[ 0 ];
	const dCam = 0.62;
	const base = [ D.a[ 0 ] + D.ux * ( 2.31 - camAt[ 0 ] ) + D.nx * dCam, tread, D.a[ 1 ] + D.uz * ( 2.31 - camAt[ 0 ] ) + D.nz * dCam ];
	const tb = new Builder();
	const P = Builder.frame( base, [ 1, 0 ], [ 0, 1 ] );
	// the tripod: three legs from the tread to the head, a spreader, the head's bowl
	for ( const a of [ 0.5, 2.6, 4.7 ] ) {

		const fx = Math.cos( a ) * 0.3, fz = Math.sin( a ) * 0.3;
		tb.use( 'black' ).quad( P( fx - 0.015, 0, fz ), P( fx + 0.015, 0, fz ), P( 0.01, 1.62, 0 ), P( - 0.01, 1.62, 0 ), [ Math.cos( a ), 0.2, Math.sin( a ) ] );
		tb.use( 'black' ).quad( P( fx + 0.015, 0, fz ), P( fx - 0.015, 0, fz ), P( - 0.01, 1.62, 0 ), P( 0.01, 1.62, 0 ), [ - Math.cos( a ), 0.2, - Math.sin( a ) ] );

	}

	tb.use( 'steel' ).cyl( P, 0, 0, 1.6, 1.72, 0.07, 0.06, 10 );
	const tripod = tb.mesh( place.material, 'home-camera-tripod' );
	group.add( tripod );
	// the head, turned to follow the play: the body, the big lens under its cover, the viewfinder, the
	// pan bar; on the 27th the black rain cover over it all
	const hb = new Builder();
	const H = Builder.frame( [ 0, 0, 0 ], [ 1, 0 ], [ 0, 1 ] );
	hb.use( 'black' ).box( H, 0, 0.12, 0.05, 0.2, 0.24, 0.42 );
	hb.use( 'black' ).box( H, 0, 0.14, - 0.36, 0.17, 0.17, 0.42 );
	hb.use( 'steel' ).box( H, 0.14, 0.3, 0.12, 0.1, 0.08, 0.12 );
	hb.use( 'black' ).box( H, - 0.22, 0.02, 0.35, 0.03, 0.03, 0.5 );
	hb.night( 27 ).use( 'black' ).box( H, 0, 0.17, - 0.1, 0.3, 0.34, 0.95 );
	hb.night( 29 ).use( 'white' ).box( H, 0, 0.14, - 0.58, 0.12, 0.12, 0.02 );
	const head = hb.mesh( place.material, 'home-camera-head' );
	head.userData.dynamic = true;
	head.position.set( base[ 0 ], base[ 1 ] + 1.72, base[ 2 ] );
	group.add( head );
	// its operator, standing behind it bent to the eyepiece
	const op = place.cast.add( {
		skin: 1, hair: 1, hairStyle: 0, facial: 4, glasses: false, female: false, age: 0, build: 2, top: TOP.work, color: COLOR.black, sleeves: COLOR.black,
		back: 0, chest: 0, pants: 3, shoes: 1, hat: HAT.capRed, poncho: 0, scarf: 0, gloves: true, seed: 3001,
	} );
	if ( op ) op.pose = restPose();
	buildPlacards( place );
	// his hands on the pan bar and the zoom (solved once)
	const arms = [ armIK( - 1, [ - 0.2, 1.52, - 0.5 ], { lean: 0.28 } ), armIK( 1, [ 0.12, 1.66, - 0.45 ], { lean: 0.28 } ) ];
	return { panel, mat, head, base, op, arms };

}

// each frame: the ad through the TV's camera, the camera turned to the play, its operator with it
export function updateBackstop( B, place, N ) {

	const app = place.app;
	B.mat.uniforms.tv.value = app?.camMode === 'center' ? 1 : 0;
	// a half inning each: the 27th's two, then the 29th's; now and then plain green between
	const half = ( N.inning - 1 ) * 2 + ( N.half === 'top' ? 0 : 1 );
	B.mat.uniforms.ad.value = hash( half * 3.7 ) < 0.18 ? 0 : N.first ? 1 + ( half % 2 ) : 3 + ( half % 2 );
	// the camera: on the batter, following the ball in play
	const b = B.base;
	const look = N.ball && ( N.kind === 'inplay' || N.kind === 'result' ) ? N.ball : [ 0.3, 1.0, 0 ];
	const yaw = Walkway.yaw( look[ 0 ] - b[ 0 ], look[ 2 ] - b[ 2 ] );
	B.yaw = B.yaw === undefined ? yaw : B.yaw + Math.atan2( Math.sin( yaw - B.yaw ), Math.cos( yaw - B.yaw ) ) * 0.12;
	B.head.quaternion.setFromAxisAngle( new Vector3( 0, 1, 0 ), B.yaw );
	B.head.updateMatrix?.();
	const op = B.op;
	if ( op ) {

		const c = Math.cos( B.yaw ), s = Math.sin( B.yaw );
		// behind the camera, half a metre back along its axis
		op.x = b[ 0 ] + s * 0.5;
		op.z = b[ 2 ] + c * 0.5;
		op.y = b[ 1 ];
		op.yaw = B.yaw;
		op.scale = 1.0;
		const a = op.pose;
		a.lean = 0.28;
		a.headPitch = 0.15;
		a.armL = B.arms[ 0 ];
		a.armR = B.arms[ 1 ];
		a.blink = ( N.t * 0.3 ) % 1 < 0.04 ? 1 : 0;
		op.visible = true;

	}

}

export { Quaternion };

// The stations' placards over the booths' windows on the press box's navy band (a 2009 photo from
// below, flickr yeago81 5247698087: Comcast SportsNet, 1210 AM The Big Talker, my PHL17, Béisbol 1480
// AM, first base side to third), over the booths Bowl's press box draws in the same order (its B block)
function buildPlacards( place ) {

	const bowl = place.bowl;
	if ( ! bowl.path || ! bowl.D ) return;
	// the press box's front as Bowl lays it (Bowl._buildUpperDecks: the 300s' front, its middle four points)
	const P = offsetPolyline( bowl.path, bowl.D.t300, [ 0, - 40 ] ).slice( 4, 8 );
	const t300Y = LEVELS.terraceConcourse - 7 * 0.52 - 0.3;
	const yS = t300Y - 1.1 + 1.4, yG = yS + 2.7, y1 = LEVELS.terraceConcourse - 0.15, tilt = 0.45;
	const segs = [];
	let total = 0;
	for ( let i = 0; i < P.length - 1; i ++ ) {

		const l = Math.hypot( P[ i + 1 ][ 0 ] - P[ i ][ 0 ], P[ i + 1 ][ 1 ] - P[ i ][ 1 ] );
		segs.push( { a: P[ i ], b: P[ i + 1 ], l, u0: total } );
		total += l;

	}

	const nB = Math.round( total / 4.5 ), bw = total / nB, mid = Math.floor( nB / 2 );
	const at = ( u ) => {

		const g = segs.find( ( q ) => u <= q.u0 + q.l ) || segs[ segs.length - 1 ];
		const t = ( u - g.u0 ) / g.l;
		const ux = ( g.b[ 0 ] - g.a[ 0 ] ) / g.l, uz = ( g.b[ 1 ] - g.a[ 1 ] ) / g.l;
		let nx = - uz, nz = ux;
		if ( nx * ( 0 - g.a[ 0 ] ) + nz * ( - 40 - g.a[ 1 ] ) < 0 ) {

			nx = - nx; nz = - nz;

		}

		return { x: g.a[ 0 ] + ( g.b[ 0 ] - g.a[ 0 ] ) * t, z: g.a[ 1 ] + ( g.b[ 1 ] - g.a[ 1 ] ) * t, ux, uz, nx, nz };

	};

	const NAMES = [ [ 'Comcast', 'SPORTSNET' ], [ '1210 AM', 'The Big Talker' ], [ 'my', 'PHL 17' ], [ 'Béisbol', '1480 AM' ] ];
	const tex = canvasTexture( 1024, 256, ( ctx ) => {

		NAMES.forEach( ( [ a, b ], i ) => {

			const x = i * 256;
			const navy = i === 1;
			ctx.fillStyle = navy ? '#12225a' : '#f2f0ea';
			ctx.fillRect( x + 4, 4, 248, 248 );
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillStyle = navy ? '#ffffff' : i === 2 ? '#1c3c8c' : '#1a1a1a';
			ctx.font = `${ i === 1 ? 'italic 900' : '800' } ${ i === 2 ? 62 : 50 }px "Helvetica Neue", Arial, sans-serif`;
			ctx.fillText( a, x + 128, 90, 230 );
			ctx.fillStyle = navy ? '#ffffff' : i === 0 ? '#3a2a8c' : '#b3121c';
			ctx.font = `${ i === 1 ? 'italic 800' : '800' } ${ i === 1 ? 34 : 44 }px "Helvetica Neue", Arial, sans-serif`;
			ctx.fillText( b, x + 128, 170, 236 );

		} );

	}, 'homePlacards' );
	const mat = standard( { name: 'home-placards', roughness: 0.6, textures: { hpl: tex }, varyings: { vUV: 'vec2f' }, vertex: 'o.vUV = v.uv;',
		surface: `s.albedo = textureSample( hpl, smpAnisoClamp, in.vs.vUV ).rgb; s.emissive = s.albedo * smoothstep( 0.15, 0.7, frame.night ) * 0.35;` } );
	mat.underwaterLighting = 'none';
	mat.setDefine( 'DRY', 1 );
	const q = new Quads();
	const w = 1.5, h = 0.56, yc = ( yG + y1 ) / 2;
	const frames = NAMES.map( ( _, i ) => {

		const c = at( ( i + mid + 0.5 ) * bw );
		const o = tilt + 0.03;
		const P0 = ( s, y ) => [ c.x + c.ux * s + c.nx * o, y, c.z + c.uz * s + c.nz * o ];
		q.add( P0( w / 2, yc - h / 2 ), P0( - w / 2, yc - h / 2 ), P0( - w / 2, yc + h / 2 ), P0( w / 2, yc + h / 2 ), [ c.nx, 0, c.nz ] );
		return c;

	} );
	const geo = q.geometry();
	// each placard's uvs from where its corners are: seen from the field the words run from the first
	// base end toward third (+u)
	const pos = geo.getAttribute( 'position' ), uv = geo.getAttribute( 'uv' );
	for ( let k = 0; k < pos.count; k ++ ) {

		const i = Math.floor( k / 6 ), c = frames[ i ];
		const s = ( pos.getX( k ) - c.x ) * c.ux + ( pos.getZ( k ) - c.z ) * c.uz;
		uv.setXY( k, ( i + ( s + w / 2 ) / w ) / 4, ( yc + h / 2 - pos.getY( k ) ) / h );

	}

	const m = new Mesh( geo, mat );
	m.name = 'home-placards';
	m.receiveShadow = true;
	place.group.add( m );

}
