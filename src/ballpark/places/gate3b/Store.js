import { Mesh, Color, Vector3 } from '../../../engine/index.js';
import { commonModule } from '../../../engine/render/wgsl/common.js';
import { standard } from '../../../materials/Materials.js';
import { canvasTexture } from '../../geo.js';
import { LEVELS } from '../../layout.js';
import { Mesher, rng } from './Mesher.js';
import { LIFT } from './Street.js';

// The Majestic Clubhouse Store as it stood in October 2008 (Getty, 27 Oct: "fans stand outside the team
// store prior to Game Five"): the glass corner pavilion just left of the Third Base Gate (its two storeys
// of glass are the facade's store frontage, Frontages.js), under a deep grey metal canopy that lifts at
// its edge on steel outriggers; banners hung all round its edge, red and navy by turns, each a big
// baseball over the Phillies' P; the curved navy band round the glass corner, "Majestic CLUBHOUSE STORE /
// OFFICIAL PHILLIES MERCHANDISE", lit from within after dark; a lit poster case by the doors; and in
// front a raised bed of fountain grass and shrub roses on a low red-stone wall that people sit on.
//
// The block: the footprint's corner just north-west of the gate (A at the gate's end, B the glass corner,
// C, D back to the brick).

const STREET = LEVELS.mainConcourse + LIFT; // the raised plaza (Street.js)
export const STORE = { A: [ - 92.68, 20.48 ], B: [ - 98.62, 26.33 ], C: [ - 103.51, 21.94 ], D: [ - 97.57, 16.08 ] };

const sub = ( a, b ) => [ a[ 0 ] - b[ 0 ], a[ 1 ] - b[ 1 ] ];
const add = ( a, b ) => [ a[ 0 ] + b[ 0 ], a[ 1 ] + b[ 1 ] ];
const mul = ( a, k ) => [ a[ 0 ] * k, a[ 1 ] * k ];
const unit = ( a ) => mul( a, 1 / Math.hypot( a[ 0 ], a[ 1 ] ) );

export function buildStore( group, colliders, field ) {

	const { A, B, C, D } = STORE;
	const center = mul( add( add( A, B ), add( C, D ) ), 0.25 );
	// the outward normals of the side toward the gate (AB) and the front (BC)
	const out = ( P, Q ) => {

		const d = unit( sub( Q, P ) ), n = [ d[ 1 ], - d[ 0 ] ], m = mul( add( P, Q ), 0.5 );
		return ( n[ 0 ] * ( m[ 0 ] - center[ 0 ] ) + n[ 1 ] * ( m[ 1 ] - center[ 1 ] ) ) > 0 ? n : mul( n, - 1 );

	};

	const nAB = out( A, B ), nBC = out( B, C );
	const y3 = ( p, y ) => [ p[ 0 ], STREET + y, p[ 1 ] ];
	const R = 2.8; // how far the canopy reaches past the glass
	const yc = 9.3, lift = 0.6; // its underside at the wall, and how much it lifts at the edge
	// ---- the canopy: a deck over the block, reaching out past the side and the front, its edge lifted
	const Ae = add( A, mul( nAB, R ) ), Be = add( add( B, mul( nAB, R ) ), mul( nBC, R ) ), Ce = add( C, mul( nBC, R ) );
	const deck = new Mesher(), steel = new Mesher();
	const edgeY = yc + lift, wallY = yc;
	// the top (a shallow tray), the soffit under it, the fascia round the edge
	for ( const [ P0, P1, Q0, Q1 ] of [ [ A, B, Ae, Be ], [ B, C, Be, Ce ] ] ) {

		deck.face( y3( P0, wallY + 0.35 ), y3( P1, wallY + 0.35 ), y3( Q1, edgeY + 0.35 ), y3( Q0, edgeY + 0.35 ), [ 0, 1, 0 ] );
		deck.face( y3( P0, wallY ), y3( Q0, edgeY ), y3( Q1, edgeY ), y3( P1, wallY ), [ 0, - 1, 0 ], [ [ 0, 0 ], [ 0, R ], [ Math.hypot( ...sub( P1, P0 ) ), R ], [ Math.hypot( ...sub( P1, P0 ) ), 0 ] ] );

	}

	for ( const [ Q0, Q1, n ] of [ [ Ae, Be, nAB ], [ Be, Ce, nBC ] ] ) deck.face( y3( Q0, edgeY - 0.05 ), y3( Q1, edgeY - 0.05 ), y3( Q1, edgeY + 0.4 ), y3( Q0, edgeY + 0.4 ), [ n[ 0 ], 0, n[ 1 ] ] );
	for ( const [ P, Q, n ] of [ [ A, Ae, unit( sub( A, B ) ) ], [ C, Ce, unit( sub( C, B ) ) ] ] ) deck.face( y3( P, wallY - 0.05 ), y3( Q, edgeY - 0.05 ), y3( Q, edgeY + 0.4 ), y3( P, wallY + 0.4 ), [ n[ 0 ], 0, n[ 1 ] ] );
	// outriggers: tapered steel from the wall to the edge every ~2.2 m, the corner one on the diagonal
	const rib = ( P, Q ) => {

		const d = unit( sub( Q, P ) ), s = [ - d[ 1 ], d[ 0 ] ];
		const L = Math.hypot( ...sub( Q, P ) );
		for ( const e of [ - 1, 1 ] ) {

			const o = mul( s, e * 0.06 );
			steel.face( y3( add( P, o ), wallY - 0.55 ), y3( add( Q, o ), edgeY - 0.12 ), y3( add( Q, o ), edgeY ), y3( add( P, o ), wallY ), [ s[ 0 ] * e, 0, s[ 1 ] * e ] );

		}

		steel.face( y3( add( P, mul( s, - 0.06 ) ), wallY - 0.55 ), y3( add( P, mul( s, 0.06 ) ), wallY - 0.55 ), y3( add( Q, mul( s, 0.06 ) ), edgeY - 0.12 ), y3( add( Q, mul( s, - 0.06 ) ), edgeY - 0.12 ), [ 0, - 1, 0 ] );
		return L;

	};

	for ( const [ P0, P1, n ] of [ [ A, B, nAB ], [ B, C, nBC ] ] ) {

		const L = Math.hypot( ...sub( P1, P0 ) ), k = Math.max( 2, Math.round( L / 2.2 ) );
		for ( let i = 0; i <= k; i ++ ) {

			const P = add( P0, mul( sub( P1, P0 ), i / k ) );
			rib( P, add( P, mul( n, R ) ) );

		}

	}

	rib( B, Be );
	// the column at the glass corner, the store's own, up to the canopy
	steel.tube( [ y3( add( B, mul( add( nAB, nBC ), 0.06 ) ), 0 ), y3( add( B, mul( add( nAB, nBC ), 0.06 ) ), wallY ) ], [ 0.14, 0.14 ], 10 );
	const wb = field.toWorld( B[ 0 ], B[ 1 ] );
	colliders.addCylinder( wb.x, wb.z, 0.2, field.y0 + STREET, field.y0 + STREET + 4 );
	const grey = standard( { name: 'w1-store-canopy', color: new Color( 0.3, 0.31, 0.32 ), roughness: 0.5, metalness: 0.5, side: 'double', modules: [ commonModule ],
		surface: /* wgsl */`
	// standing-seam metal: seams every 0.45 m (uv in metres on the soffit), a little streaked
	let seam = step( 0.47, abs( fract( in.uv.x / 0.45 ) - 0.5 ) );
	s.albedo = mat.color * ( 0.85 + 0.1 * mx_noise_float2( in.uv * vec2f( 0.3, 3.0 ) ) ) * ( 1.0 - 0.35 * seam );
` } );
	const struct = standard( { name: 'w1-store-steel', color: new Color( 0.24, 0.25, 0.26 ), roughness: 0.45, metalness: 0.6 } );

	// ---- the banners round the canopy's edge: red and navy by turns, a baseball over the P
	const bannerTex = canvasTexture( 512, 768, ( ctx ) => {

		for ( let k = 0; k < 2; k ++ ) {

			const ox = k * 256, bg = k ? '#1b2a57' : '#a8141e';
			ctx.fillStyle = bg; ctx.fillRect( ox, 0, 256, 768 );
			ctx.strokeStyle = '#f2efe6'; ctx.lineWidth = 8; ctx.strokeRect( ox + 12, 12, 232, 744 );
			// the baseball: white, red stitches
			ctx.fillStyle = '#f2efe6'; ctx.beginPath(); ctx.arc( ox + 128, 220, 96, 0, Math.PI * 2 ); ctx.fill();
			ctx.strokeStyle = '#b3151f'; ctx.lineWidth = 5;
			for ( const sgn of [ - 1, 1 ] ) {

				ctx.beginPath(); ctx.arc( ox + 128 + sgn * 150, 220, 118, Math.PI - 0.62 + ( sgn > 0 ? 0 : Math.PI ), Math.PI + 0.62 + ( sgn > 0 ? 0 : Math.PI ) ); ctx.stroke();
				for ( let i = - 5; i <= 5; i ++ ) {

					const q = Math.PI + i * 0.11 + ( sgn > 0 ? 0 : Math.PI ), cx = ox + 128 + sgn * 150 + Math.cos( q ) * 118, cy = 220 + Math.sin( q ) * 118;
					ctx.beginPath(); ctx.moveTo( cx - 7, cy - 3 ); ctx.lineTo( cx + 7, cy + 3 ); ctx.stroke();

				}

			}

			// the P in a roundel
			ctx.fillStyle = '#f2efe6'; ctx.beginPath(); ctx.arc( ox + 128, 500, 70, 0, Math.PI * 2 ); ctx.fill();
			ctx.fillStyle = k ? '#b3151f' : '#1b2a57'; ctx.beginPath(); ctx.arc( ox + 128, 500, 60, 0, Math.PI * 2 ); ctx.fill();
			ctx.fillStyle = '#f2efe6'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
			ctx.font = 'italic 700 96px "Brush Script MT", "Snell Roundhand", Georgia, serif';
			ctx.fillText( 'P', ox + 124, 506 );
			ctx.font = '700 30px Helvetica, Arial, sans-serif';
			ctx.fillText( 'PHILLIES', ox + 128, 640 );

		}

	}, 'storeBanners' );
	const bannerMat = standard( { name: 'w1-store-banners', roughness: 0.75, textures: { sbTex: bannerTex },
		surface: 'let t = textureSample( sbTex, smpAnisoClamp, in.uv ).rgb; s.albedo = t; s.emissive = t * smoothstep( 0.1, 0.7, frame.night ) * 0.06;' } );
	const banners = new Mesher();
	let bi = 0;
	for ( const [ Q0, Q1, n ] of [ [ Ae, Be, nAB ], [ Be, Ce, nBC ] ] ) {

		const L = Math.hypot( ...sub( Q1, Q0 ) ), k = Math.max( 1, Math.floor( L / 2.1 ) );
		const d = unit( sub( Q1, Q0 ) );
		for ( let i = 0; i < k; i ++ ) {

			// hung a little inside the edge, 0.9 m wide, 2.7 m tall, both faces
			const m = add( add( Q0, mul( d, ( i + 0.5 ) * L / k ) ), mul( n, - 0.35 ) );
			const u0 = ( bi ++ % 2 ) * 0.5, w = 0.45, top = edgeY - 0.2 - ( lift * 0.35 ), bot = top - 2.7;
			const P0 = add( m, mul( d, - w ) ), P1 = add( m, mul( d, w ) );
			// seen from outside (along -n) the banner reads left to right along +d or -d: pick by handedness
			const flip = d[ 0 ] * n[ 1 ] - d[ 1 ] * n[ 0 ] < 0; // (the text reads along d when d points to the viewer's right)
			const [ ua, ub ] = flip ? [ u0 + 0.5, u0 ] : [ u0, u0 + 0.5 ];
			banners.face( y3( P0, bot ), y3( P1, bot ), y3( P1, top ), y3( P0, top ), [ n[ 0 ], 0, n[ 1 ] ], [ [ ua, 1 ], [ ub, 1 ], [ ub, 0 ], [ ua, 0 ] ] );
			banners.face( y3( P1, bot ), y3( P0, bot ), y3( P0, top ), y3( P1, top ), [ - n[ 0 ], 0, - n[ 1 ] ], [ [ ua, 1 ], [ ub, 1 ], [ ub, 0 ], [ ua, 0 ] ] );
			// its pole along the top
			steel.tube( [ y3( add( P0, mul( d, - 0.05 ) ), top + 0.03 ), y3( add( P1, mul( d, 0.05 ) ), top + 0.03 ) ], [ 0.02, 0.02 ], 5 );

		}

	}

	// ---- the curved band round the glass corner
	const signTex = canvasTexture( 2048, 256, ( ctx, w, h ) => {

		const g = ctx.createLinearGradient( 0, 0, 0, h );
		g.addColorStop( 0, '#24346a' ); g.addColorStop( 0.5, '#1b2a57' ); g.addColorStop( 1, '#121d40' );
		ctx.fillStyle = g; ctx.fillRect( 0, 0, w, h );
		ctx.fillStyle = '#c9ccd6'; ctx.fillRect( 0, 0, w, 10 ); ctx.fillRect( 0, h - 10, w, 10 );
		ctx.textBaseline = 'middle';
		ctx.fillStyle = '#ffffff';
		ctx.font = 'italic 700 92px "Brush Script MT", "Snell Roundhand", Georgia, serif';
		ctx.textAlign = 'right';
		ctx.fillText( 'Majestic', w / 2 - 20, 92 );
		ctx.textAlign = 'left';
		ctx.font = '700 92px "Trajan Pro", Copperplate, Georgia, serif';
		ctx.fillText( 'CLUBHOUSE STORE', w / 2, 96, 900 );
		ctx.textAlign = 'center';
		ctx.font = '700 44px Helvetica, Arial, sans-serif';
		ctx.fillText( 'OFFICIAL  PHILLIES  MERCHANDISE', w / 2, 196, 1300 );
		// the MLB-style swoosh under Majestic
		ctx.strokeStyle = '#b3151f'; ctx.lineWidth = 6;
		ctx.beginPath(); ctx.moveTo( w / 2 - 330, 140 ); ctx.quadraticCurveTo( w / 2 - 150, 122, w / 2 - 20, 140 ); ctx.stroke();

	}, 'storeSign' );
	const signMat = standard( { name: 'w1-store-sign', roughness: 0.35, textures: { ssTex: signTex },
		surface: 'let t = textureSample( ssTex, smpAnisoClamp, in.uv ).rgb; s.albedo = t; s.emissive = t * step( 0.55, t.r ) * smoothstep( 0.1, 0.7, frame.night ) * 1.4 + t * 0.02;' } );
	const band = new Mesher();
	{

		// an arc round a centre just inside the corner, bulging out past it; from the side's face round to
		// the front's, a little beyond each
		const rr = 2.2, cc = add( B, mul( unit( add( nAB, nBC ) ), - 1.35 ) );
		const a0 = Math.atan2( nAB[ 1 ], nAB[ 0 ] ), a1 = Math.atan2( nBC[ 1 ], nBC[ 0 ] );
		let da = a1 - a0;
		da = Math.atan2( Math.sin( da ), Math.cos( da ) );
		const span = Math.abs( da ) + 0.9, mid = a0 + da / 2, k = 18, yb = 4.75, yt = 6.05;
		for ( let i = 0; i < k; i ++ ) {

			const q0 = mid - Math.sign( da ) * span / 2 + Math.sign( da ) * span * i / k, q1 = mid - Math.sign( da ) * span / 2 + Math.sign( da ) * span * ( i + 1 ) / k;
			const p0 = add( cc, [ Math.cos( q0 ) * rr, Math.sin( q0 ) * rr ] ), p1 = add( cc, [ Math.cos( q1 ) * rr, Math.sin( q1 ) * rr ] );
			const nm = [ Math.cos( ( q0 + q1 ) / 2 ), 0, Math.sin( ( q0 + q1 ) / 2 ) ];
			// the text runs left to right as you face it: along the arc the way that is
			const flip = Math.sign( da ) > 0;
			const u0 = flip ? 1 - i / k : i / k, u1 = flip ? 1 - ( i + 1 ) / k : ( i + 1 ) / k;
			band.face( y3( p0, yb ), y3( p1, yb ), y3( p1, yt ), y3( p0, yt ), nm, [ [ u0, 1 ], [ u1, 1 ], [ u1, 0 ], [ u0, 0 ] ] );
			steel.face( y3( p0, yt ), y3( p1, yt ), y3( add( cc, mul( sub( p1, cc ), 0.8 ) ), yt ), y3( add( cc, mul( sub( p0, cc ), 0.8 ) ), yt ), [ 0, 1, 0 ] );
			steel.face( y3( p0, yb ), y3( add( cc, mul( sub( p0, cc ), 0.8 ) ), yb ), y3( add( cc, mul( sub( p1, cc ), 0.8 ) ), yb ), y3( p1, yb ), [ 0, - 1, 0 ] );

		}

	}

	// ---- the lit poster case by the doors, on the front near its far end
	const posterTex = canvasTexture( 256, 384, ( ctx, w, h ) => {

		ctx.fillStyle = '#10204a'; ctx.fillRect( 0, 0, w, h );
		ctx.fillStyle = '#e8b53a'; ctx.beginPath(); ctx.arc( w / 2, 150, 90, Math.PI, 0 ); ctx.fill();
		ctx.fillStyle = '#f5f2ea'; ctx.beginPath(); ctx.arc( w / 2, 150, 70, Math.PI, 0 ); ctx.fill();
		ctx.fillStyle = '#b3151f'; ctx.textAlign = 'center'; ctx.font = 'italic 700 40px Georgia, serif';
		ctx.fillText( 'Majestic', w / 2, 210 );
		ctx.fillStyle = '#f5f2ea'; ctx.font = '700 22px Helvetica, Arial, sans-serif';
		ctx.fillText( 'AUTHENTIC COLLECTION', w / 2, 250, 230 );
		ctx.fillText( 'WORLD SERIES GEAR', w / 2, 290, 230 );
		ctx.fillText( 'NOW IN STOCK', w / 2, 330, 230 );

	}, 'storePoster' );
	const posterMat = standard( { name: 'w1-store-poster', roughness: 0.2, textures: { spTex: posterTex },
		surface: 'let t = textureSample( spTex, smpAnisoClamp, in.uv ).rgb; s.albedo = t * 0.5; s.emissive = t * mix( 0.25, 1.2, smoothstep( 0.1, 0.7, frame.night ) );' } );
	const poster = new Mesher();
	{

		const d = unit( sub( C, B ) ), p = add( add( B, mul( d, 5.1 ) ), mul( nBC, 0.12 ) ), w = 0.55;
		const flip = d[ 0 ] * nBC[ 1 ] - d[ 1 ] * nBC[ 0 ] < 0;
		const [ ua, ub ] = flip ? [ 1, 0 ] : [ 0, 1 ];
		poster.face( y3( add( p, mul( d, - w ) ), 0.5 ), y3( add( p, mul( d, w ) ), 0.5 ), y3( add( p, mul( d, w ) ), 2.15 ), y3( add( p, mul( d, - w ) ), 2.15 ), [ nBC[ 0 ], 0, nBC[ 1 ] ], [ [ ua, 1 ], [ ub, 1 ], [ ub, 0 ], [ ua, 0 ] ] );
		steel.box( [ p[ 0 ], STREET + 1.32, p[ 1 ] ], [ 0.08, 1.75, 0.08 ] );

	}

	// ---- the raised bed in front: a low wall of red stone, fountain grass and shrub roses
	const bedA = add( add( B, mul( nBC, 4.2 ) ), mul( unit( sub( C, B ) ), 0.8 ) ), bedB = add( add( C, mul( nBC, 4.2 ) ), mul( unit( sub( B, C ) ), - 1.5 ) );
	const wall = new Mesher(), plants = [];
	let bed = null;
	{

		const d = unit( sub( bedB, bedA ) ), L = Math.hypot( ...sub( bedB, bedA ) ), dep = 1.5, h = 0.46;
		const back = mul( nBC, dep );
		// a rounded end each way, the long sides straight
		const ring = [];
		for ( let k = 0; k <= 8; k ++ ) {

			const q = Math.PI / 2 + k / 8 * Math.PI;
			ring.push( add( add( bedA, mul( back, 0.5 ) ), add( mul( d, Math.cos( q ) * dep / 2 ), mul( nBC, Math.sin( q ) * dep / 2 ) ) ) );

		}

		for ( let k = 0; k <= 8; k ++ ) {

			const q = - Math.PI / 2 + k / 8 * Math.PI;
			ring.push( add( add( add( bedA, mul( d, L ) ), mul( back, 0.5 ) ), add( mul( d, Math.cos( q ) * dep / 2 ), mul( nBC, Math.sin( q ) * dep / 2 ) ) ) );

		}

		const cen = add( add( bedA, mul( d, L / 2 ) ), mul( back, 0.5 ) );
		for ( let i = 0; i < ring.length; i ++ ) {

			const p = ring[ i ], q = ring[ ( i + 1 ) % ring.length ];
			const e = unit( sub( q, p ) ), nn = [ e[ 1 ], - e[ 0 ] ];
			const sgn = ( nn[ 0 ] * ( p[ 0 ] - cen[ 0 ] ) + nn[ 1 ] * ( p[ 1 ] - cen[ 1 ] ) ) > 0 ? 1 : - 1;
			wall.face( y3( p, 0 ), y3( q, 0 ), y3( q, h ), y3( p, h ), [ nn[ 0 ] * sgn, 0, nn[ 1 ] * sgn ] );
			// the cap, 25 cm wide
			const pi = add( p, mul( unit( sub( cen, p ) ), 0.25 ) ), qi = add( q, mul( unit( sub( cen, q ) ), 0.25 ) );
			wall.face( y3( p, h ), y3( q, h ), y3( qi, h ), y3( pi, h ), [ 0, 1, 0 ] );

		}

		// the soil, a little below the cap
		const soil = ring.map( ( p ) => add( p, mul( unit( sub( cen, p ) ), 0.25 ) ) );
		const c0 = wall.v( y3( cen, h - 0.08 ), [ 0, 1, 0 ] );
		const ids = soil.map( ( p ) => wall.v( y3( p, h - 0.08 ), [ 0, 1, 0 ] ) );
		for ( let i = 0; i < ids.length; i ++ ) wall.tri( c0, ids[ i ], ids[ ( i + 1 ) % ids.length ] );
		const r = rng( 88 );
		for ( let i = 0; i < 26; i ++ ) {

			const t = 0.08 + r() * 0.84, o = 0.3 + r() * ( dep - 0.6 );
			plants.push( { p: add( add( bedA, mul( d, t * L ) ), mul( nBC, o ) ), grass: r() < 0.55, s: 0.7 + r() * 0.5, r } );

		}

		const wc = field.toWorld( cen[ 0 ], cen[ 1 ] );
		colliders.addBox( new Vector3( wc.x, field.y0 + STREET + h / 2, wc.z ), new Vector3( L / 2 + dep / 2, h / 2, dep / 2 ), field.group.rotation.y - Math.atan2( d[ 1 ], d[ 0 ] ), { tag: 'planter' } );
		bed = { cen, d, L, dep, h, nBC, bedA };

	}

	const stone = standard( { name: 'w1-bed-wall', color: new Color( 0.36, 0.14, 0.1 ), roughness: 0.8, modules: [ commonModule ],
		surface: 's.albedo = mat.color * ( 0.8 + 0.25 * mx_noise_float3( in.P * 5.0 ) );' } );
	// the plants: fountain grass (arching blades, gone buff and plum in October), shrub roses (a mound of
	// leaves, the last pink blooms)
	const leafy = new Mesher();
	for ( const pl of plants ) {

		const { p, grass, s, r } = pl;
		const base = y3( p, 0.38 );
		if ( grass ) {

			for ( let k = 0; k < 14; k ++ ) {

				const q = r() * Math.PI * 2, lean = 0.3 + r() * 0.5, len = ( 0.6 + r() * 0.35 ) * s;
				const tip = [ base[ 0 ] + Math.cos( q ) * lean * len, base[ 1 ] + len * ( 1 - lean * 0.4 ), base[ 2 ] + Math.sin( q ) * lean * len ];
				const side = [ - Math.sin( q ) * 0.012, 0, Math.cos( q ) * 0.012 ];
				leafy.face( [ base[ 0 ] - side[ 0 ], base[ 1 ], base[ 2 ] - side[ 2 ] ], [ base[ 0 ] + side[ 0 ], base[ 1 ], base[ 2 ] + side[ 2 ] ], [ tip[ 0 ] + side[ 0 ] * 0.3, tip[ 1 ], tip[ 2 ] + side[ 2 ] * 0.3 ], [ tip[ 0 ] - side[ 0 ] * 0.3, tip[ 1 ], tip[ 2 ] - side[ 2 ] * 0.3 ], [ Math.cos( q ), 0.6, Math.sin( q ) ], [ [ 0.02, 0 ], [ 0.02, 0 ], [ 0.02, 1 ], [ 0.02, 1 ] ] );

			}

		} else {

			// a rose: a low mound of little faces, some of them flowers
			for ( let k = 0; k < 10; k ++ ) {

				const q = r() * Math.PI * 2, rr = r() * 0.3 * s, yy = 0.1 + r() * 0.35 * s, sz = 0.14 + r() * 0.08;
				const c = [ base[ 0 ] + Math.cos( q ) * rr, base[ 1 ] + yy, base[ 2 ] + Math.sin( q ) * rr ];
				const flower = r() < 0.3;
				const uvx = flower ? 0.95 : 0.5;
				const ax = [ Math.cos( q + 1.5 ) * sz, 0, Math.sin( q + 1.5 ) * sz ];
				leafy.face( [ c[ 0 ] - ax[ 0 ], c[ 1 ] - sz * 0.5, c[ 2 ] - ax[ 2 ] ], [ c[ 0 ] + ax[ 0 ], c[ 1 ] - sz * 0.5, c[ 2 ] + ax[ 2 ] ], [ c[ 0 ] + ax[ 0 ], c[ 1 ] + sz * 0.5, c[ 2 ] + ax[ 2 ] ], [ c[ 0 ] - ax[ 0 ], c[ 1 ] + sz * 0.5, c[ 2 ] - ax[ 2 ] ], [ Math.cos( q ), 0.8, Math.sin( q ) ], [ [ uvx, 0 ], [ uvx, 0 ], [ uvx, 1 ], [ uvx, 1 ] ] );

			}

		}

	}

	const leafMat = standard( { name: 'w1-bed-plants', roughness: 0.8, side: 'double', modules: [ commonModule ],
		surface: /* wgsl */`
	// uv.x: grass (buff to plum), rose leaves, rose flowers
	let n = mx_noise_float3( in.P * 9.0 );
	var c = mix( vec3f( 0.3, 0.24, 0.12 ), vec3f( 0.18, 0.08, 0.1 ), smoothstep( -0.3, 0.5, n ) ) * ( 0.6 + 0.5 * in.uv.y );
	if ( in.uv.x > 0.3 ) { c = vec3f( 0.05, 0.1, 0.03 ) * ( 0.7 + 0.5 * n ); }
	if ( in.uv.x > 0.8 ) { c = mix( vec3f( 0.6, 0.18, 0.28 ), vec3f( 0.7, 0.35, 0.4 ), n * 0.5 + 0.5 ); }
	s.albedo = c;
	s.translucency = c * 0.2;
` } );
	for ( const [ m, mat, name, cast ] of [ [ deck, grey, 'w1-store-canopy', true ], [ steel, struct, 'w1-store-steel', true ], [ banners, bannerMat, 'w1-store-banners', false ], [ band, signMat, 'w1-store-sign', false ], [ poster, posterMat, 'w1-store-poster', false ], [ wall, stone, 'w1-store-bed', true ], [ leafy, leafMat, 'w1-store-plants', false ] ] ) {

		if ( ! m.count ) continue;
		mat.underwaterLighting = 'none';
		const mesh = new Mesh( m.geometry(), mat );
		mesh.name = name;
		mesh.castShadow = cast;
		mesh.receiveShadow = true;
		group.add( mesh );

	}

	// where people stand and sit: the doors (the front's middle), the bed's wall
	const d = unit( sub( C, B ) );
	return {
		doors: add( add( B, mul( d, 3.0 ) ), mul( nBC, 0.8 ) ), nFront: nBC, along: d, bed,
		lights: [ [ ...y3( add( B, mul( add( nAB, nBC ), 1.2 ) ), 5.4 ) ] ],
	};

}

