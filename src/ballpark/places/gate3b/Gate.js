import { Mesh, InstancedMesh, Matrix4, Quaternion, Vector3, Color } from '../../../engine/index.js';
import { commonModule } from '../../../engine/render/wgsl/common.js';
import { standard } from '../../../materials/Materials.js';
import { canvasTexture } from '../../geo.js';
import { LEVELS } from '../../layout.js';
import { Mesher } from './Mesher.js';

// The Third Base Gate open for the game, as in Getty's photo of the NLDS on 2 Oct 2008 and the closed
// gate the day after Game 5's suspension (UPI, 28 Oct): the white grid leaves folded out from their
// maroon posts into fins, a 2-foot baseball on them; in front of each lane a red wheeled bin with the
// 2008 Postseason logo, and a red bag-check table; four metres in, the red turnstile cabinets where the
// ticket takers scan, the tripod arms turning as each fan pushes through; past them the staff handing
// out the rally towels (white, red print) from cardboard boxes. The "Welcome to World Series Game 5"
// placards hung on the leaves (Getty, 28 Oct), a board of the park's rules with a green header.
//
// Built in the gate's own frame: P( s, o ) is s along the gate line (Exterior's edge) and o out from it.

const STREET = LEVELS.mainConcourse;
export const TURNSTILE_O = - 4.8; // the turnstiles' row, inside the gate line
export const TABLE = { ds: - 0.95, o0: - 0.35, o1: - 2.15 }; // each lane's bag table: beside the lane, just inside
const H = 3.5; // the leaves' height (Exterior's)

export function buildOpenGate( { group, exterior, gate, colliders, field } ) {

	const E = gate.edge;
	if ( ! E ) return null;
	const { a, ux, uz, nx, nz, t } = E;
	const P = ( s, o, y = 0 ) => [ a[ 0 ] + ux * ( t + s ) + nx * o, STREET + y, a[ 1 ] + uz * ( t + s ) + nz * o ];
	const lanes = ( exterior.lanes || [] ).filter( ( l ) => l.gate === gate.name && l.bay );
	if ( ! lanes.length ) return null;
	const rot = field.group.rotation.y;
	const box = ( s, o, w, d, h, tag ) => {

		const c = P( s, o ), wp = field.toWorld( c[ 0 ], c[ 2 ] );
		colliders.addBox( new Vector3( wp.x, field.y0 + STREET + h / 2, wp.z ), new Vector3( w / 2, h / 2, d / 2 ), rot - Math.atan2( uz, ux ), { tag } );

	};

	// ---- the leaves folded out into fins at the posts (two back to back between bays, one at each end)
	const posts = [ ...new Set( lanes.flatMap( ( l ) => l.bay.map( ( v ) => Math.round( v * 100 ) / 100 ) ) ) ].sort( ( p, q ) => p - q );
	const fins = new Mesher(), balls = new Mesher();
	const leaf = ( s, side ) => {

		// a 1.8 m leaf out along o at s (offset to its side of the post), both faces; uv in metres
		const S = s + side * 0.05;
		fins.face( P( S, 0.08 ), P( S, 1.88 ), P( S, 1.88, H ), P( S, 0.08, H ), [ ux * side, 0, uz * side ], [ [ 0, 0 ], [ 1.8, 0 ], [ 1.8, H ], [ 0, H ] ] );
		fins.face( P( S, 1.88 ), P( S, 0.08 ), P( S, 0.08, H ), P( S, 1.88, H ), [ - ux * side, 0, - uz * side ], [ [ 1.8, 0 ], [ 0, 0 ], [ 0, H ], [ 1.8, H ] ] );

	};

	posts.forEach( ( s, i ) => {

		const end = i === 0 || i === posts.length - 1;
		if ( end ) leaf( s, i === 0 ? 1 : - 1 );
		else {

			leaf( s, - 1 );
			leaf( s, 1 );

		}

		// the baseball on the fin's outer faces, every one
		for ( const side of end ? [ i === 0 ? 1 : - 1 ] : [ - 1, 1 ] ) {

			const S = s + side * 0.075, yc = 1.3, oc = 0.98, r = 0.3;
			const c = balls.v( P( S, oc, yc ), [ ux * side, 0, uz * side ], [ 0.5, 0.5 ] );
			const ring = [];
			for ( let k = 0; k <= 20; k ++ ) {

				const q = k / 20 * Math.PI * 2;
				ring.push( balls.v( P( S, oc + Math.cos( q ) * r, yc + Math.sin( q ) * r ), [ ux * side, 0, uz * side ], [ 0.5 + Math.cos( q ) * 0.5, 0.5 + Math.sin( q ) * 0.5 ] ) );

			}

			for ( let k = 0; k < 20; k ++ ) balls.tri( c, ring[ k ], ring[ k + 1 ] );

		}

		box( s, 0.98, 0.16, 1.8, H, 'gate' );

	} );
	const finMesh = new Mesh( fins.geometry(), exterior.fenceMat );
	finMesh.name = 'w1-gate-fins';
	finMesh.castShadow = true;
	group.add( finMesh );
	if ( exterior.ballMat ) {

		const bm = new Mesh( balls.geometry(), exterior.ballMat );
		bm.name = 'w1-gate-balls';
		group.add( bm );

	}

	// ---- red: the bins, the bag tables, the turnstile cabinets
	const red = standard( { name: 'w1-gate-red', color: new Color( 0.42, 0.02, 0.03 ), roughness: 0.45, modules: [ commonModule ],
		surface: 's.albedo = mat.color * ( 0.9 + 0.12 * mx_noise_float3( in.P * 3.0 ) );' } );
	const redM = new Mesher(), steelM = new Mesher(), darkM = new Mesher();
	// the postseason logo on the bins: a white roundel, "2008 POSTSEASON", the MLB silhouette
	const logo = canvasTexture( 256, 256, ( ctx, w, h ) => {

		ctx.clearRect( 0, 0, w, h );
		ctx.fillStyle = '#f3f1ea';
		ctx.beginPath(); ctx.arc( w / 2, h / 2, 120, 0, Math.PI * 2 ); ctx.fill();
		ctx.strokeStyle = '#1b2a57'; ctx.lineWidth = 10;
		ctx.beginPath(); ctx.arc( w / 2, h / 2, 104, 0, Math.PI * 2 ); ctx.stroke();
		ctx.fillStyle = '#1b2a57';
		ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
		ctx.font = '800 44px Helvetica, Arial, sans-serif';
		ctx.fillText( '2008', w / 2, 92 );
		ctx.fillStyle = '#b3151f';
		ctx.font = '800 30px "Arial Narrow", Helvetica, Arial, sans-serif';
		ctx.fillText( 'POSTSEASON', w / 2, 140, 190 );
		// the MLB batter: red and navy halves, the white silhouette
		ctx.fillStyle = '#1b2a57'; ctx.fillRect( 88, 164, 40, 30 );
		ctx.fillStyle = '#b3151f'; ctx.fillRect( 128, 164, 40, 30 );
		ctx.fillStyle = '#f3f1ea'; ctx.beginPath(); ctx.arc( 124, 172, 5, 0, Math.PI * 2 ); ctx.fill();

	}, 'postseasonLogo' );
	const logoMat = standard( { name: 'w1-postseason-logo', roughness: 0.5, alphaTest: 0.5, textures: { psLogo: logo },
		surface: 'let t = textureSample( psLogo, smpAnisoClamp, in.uv ); s.alpha = t.a; s.albedo = t.rgb;' } );
	const logoM = new Mesher();
	const bins = [];
	posts.forEach( ( s, i ) => {

		if ( i === 0 || i === posts.length - 1 ) return;
		// a 44-gallon wheeled bin: tapered, a lip, the lid, two wheels at the back; the logo facing out
		const o = 2.35, c = P( s, o );
		const ring = ( y, r ) => Array.from( { length: 11 }, ( _, k ) => {

			const q = k / 10 * Math.PI * 2;
			return [ c[ 0 ] + Math.cos( q ) * r, STREET + y, c[ 2 ] + Math.sin( q ) * r ];

		} );
		const rings = [ ring( 0.04, 0.24 ), ring( 0.82, 0.29 ), ring( 0.86, 0.305 ), ring( 0.9, 0.305 ) ];
		const ids = rings.map( ( R ) => R.map( ( p ) => redM.v( p, [ p[ 0 ] - c[ 0 ], 0, p[ 2 ] - c[ 2 ] ] ) ) );
		for ( let j = 0; j < ids.length - 1; j ++ ) for ( let k = 0; k < 10; k ++ ) redM.quad( ids[ j ][ k ], ids[ j + 1 ][ k ], ids[ j + 1 ][ k + 1 ], ids[ j ][ k + 1 ] );
		const top = redM.v( [ c[ 0 ], STREET + 0.92, c[ 2 ] ], [ 0, 1, 0 ] );
		for ( let k = 0; k < 10; k ++ ) redM.tri( top, ids[ 3 ][ k + 1 ], ids[ 3 ][ k ] );
		for ( const side of [ - 1, 1 ] ) darkM.box( P( s + side * 0.2, o - 0.26, 0.08 ), [ 0.07, 0.16, 0.16 ] );
		// the logo on the face toward the plaza
		const f = 0.2, lo = o + 0.285, ly = 0.5;
		logoM.face( P( s - f, lo, ly - f ), P( s + f, lo, ly - f ), P( s + f, lo, ly + f ), P( s - f, lo, ly + f ), [ nx, 0, nz ], ux * nz - uz * nx > 0 ? [ [ 1, 1 ], [ 0, 1 ], [ 0, 0 ], [ 1, 0 ] ] : [ [ 0, 1 ], [ 1, 1 ], [ 1, 0 ], [ 0, 0 ] ] );
		bins.push( c );
		const wp = field.toWorld( c[ 0 ], c[ 2 ] );
		colliders.addCylinder( wp.x, wp.z, 0.32, field.y0 + STREET, field.y0 + STREET + 0.9 );

	} );

	// each lane: its bag table (red, skirted) against the lane's side, just inside the gate line; the
	// turnstile cabinets either side of its passage four metres in, a stainless top, the tripod's head
	const out = [];
	const tripods = [];
	for ( const l of lanes ) {

		const sc = ( l.bay[ 0 ] + l.bay[ 1 ] ) / 2;
		const ts = sc + TABLE.ds, o0 = TABLE.o0, o1 = TABLE.o1;
		const Q = ( ds, o, y ) => P( ts + ds, o, y );
		redM.face( Q( - 0.38, o0, 0.74 ), Q( 0.38, o0, 0.74 ), Q( 0.38, o1, 0.74 ), Q( - 0.38, o1, 0.74 ), [ 0, 1, 0 ] );
		for ( const [ A, B, n ] of [ [ Q( - 0.38, o0, 0.02 ), Q( 0.38, o0, 0.02 ), [ nx, 0, nz ] ], [ Q( 0.38, o1, 0.02 ), Q( - 0.38, o1, 0.02 ), [ - nx, 0, - nz ] ], [ Q( 0.38, o0, 0.02 ), Q( 0.38, o1, 0.02 ), [ ux, 0, uz ] ], [ Q( - 0.38, o1, 0.02 ), Q( - 0.38, o0, 0.02 ), [ - ux, 0, - uz ] ] ] ) {

			redM.face( A, B, [ B[ 0 ], STREET + 0.74, B[ 2 ] ], [ A[ 0 ], STREET + 0.74, A[ 2 ] ], n );

		}

		box( ts, ( o0 + o1 ) / 2, 0.76, o1 - o0, 0.74, 'table' );
		// the turnstiles: a cabinet each side of the passage
		for ( const side of [ - 1, 1 ] ) {

			const cs = sc + side * 0.45;
			const C = ( ds, o, y ) => P( cs + ds, o, y );
			const o0c = TURNSTILE_O + 0.55, o1c = TURNSTILE_O - 0.55;
			for ( const [ A, B, n ] of [ [ C( - 0.15, o0c, 0 ), C( 0.15, o0c, 0 ), [ nx, 0, nz ] ], [ C( 0.15, o1c, 0 ), C( - 0.15, o1c, 0 ), [ - nx, 0, - nz ] ], [ C( 0.15, o0c, 0 ), C( 0.15, o1c, 0 ), [ ux, 0, uz ] ], [ C( - 0.15, o1c, 0 ), C( - 0.15, o0c, 0 ), [ - ux, 0, - uz ] ] ] ) {

				redM.face( A, B, [ B[ 0 ], STREET + 0.98, B[ 2 ] ], [ A[ 0 ], STREET + 0.98, A[ 2 ] ], n );

			}

			steelM.face( C( - 0.17, o0c + 0.02, 1.0 ), C( 0.17, o0c + 0.02, 1.0 ), C( 0.17, o1c - 0.02, 1.0 ), C( - 0.17, o1c - 0.02, 1.0 ), [ 0, 1, 0 ] );
			// the reader: a dark glass panel on the cabinet's top toward the queue
			darkM.face( C( - 0.12, o0c - 0.05, 1.02 ), C( 0.12, o0c - 0.05, 1.02 ), C( 0.12, o0c - 0.3, 1.02 ), C( - 0.12, o0c - 0.3, 1.02 ), [ 0, 1, 0.2 ] );
			box( cs, TURNSTILE_O, 0.3, 1.1, 1.0, 'turnstile' );

		}

		// the tripod's hub on the left cabinet, its arms reaching across the passage
		tripods.push( { at: P( sc - 0.3, TURNSTILE_O, 0.93 ), phase: 0, turn: 0 } );
		out.push( { sc, mouth: P( sc, 0 ), bay: l.bay } );

	}

	// the rally towel boxes: two staffers, a stack of cardboard cartons each, a few metres past the
	// turnstiles
	const card = new Mesher();
	const towelSpots = [ - 7.2, 7.2 ].map( ( s ) => {

		for ( let k = 0; k < 3; k ++ ) card.box( P( s + ( k - 1 ) * 0.5, - 8.4 + ( k === 1 ? - 0.3 : 0 ), 0.2 + ( k === 1 ? 0.4 : 0 ) ), [ 0.45, 0.4, 0.35 ] );
		box( s, - 8.4, 1.5, 0.5, 0.8, 'boxes' );
		return { at: P( s, - 7.6 ), s };

	} );
	const cardMat = standard( { name: 'w1-cartons', color: new Color( 0.36, 0.24, 0.13 ), roughness: 0.9, modules: [ commonModule ],
		surface: 's.albedo = mat.color * ( 0.85 + 0.2 * mx_noise_float3( in.P * 4.0 ) ) * ( 1.0 - 0.5 * step( abs( fract( in.P.y * 5.0 ) - 0.5 ), 0.03 ) );' } );
	cardMat.setDefine( 'DRY', 1 );

	// the placards on the leaves: "Welcome to World Series Game 5"; the rules on a green-headed board
	const signTex = canvasTexture( 512, 768, ( ctx, w, h ) => {

		// left half: the welcome placard; right: the rules
		ctx.fillStyle = '#f4f2ec'; ctx.fillRect( 0, 0, 256, 384 );
		ctx.fillStyle = '#1b2a57'; ctx.fillRect( 0, 0, 256, 70 );
		ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
		ctx.fillStyle = '#f4f2ec'; ctx.font = '800 30px Helvetica, Arial, sans-serif';
		ctx.fillText( 'WORLD SERIES', 128, 26 ); ctx.font = '800 28px Helvetica, Arial, sans-serif'; ctx.fillText( '2008', 128, 54 );
		ctx.fillStyle = '#b3151f'; ctx.font = 'italic 700 46px Georgia, serif';
		ctx.fillText( 'Welcome', 128, 130 );
		ctx.fillStyle = '#1b2a57'; ctx.font = '700 30px Helvetica, Arial, sans-serif';
		ctx.fillText( 'to World Series', 128, 190 );
		ctx.font = '800 58px Helvetica, Arial, sans-serif'; ctx.fillText( 'GAME 5', 128, 262 );
		ctx.fillStyle = '#b3151f'; ctx.fillRect( 20, 318, 216, 6 );
		ctx.fillStyle = '#1b2a57'; ctx.font = '600 20px Helvetica, Arial, sans-serif';
		ctx.fillText( 'Tampa Bay at Philadelphia', 128, 350 );
		// the rules
		ctx.fillStyle = '#f2f2ee'; ctx.fillRect( 256, 0, 256, 384 );
		ctx.fillStyle = '#1e7a55'; ctx.fillRect( 256, 0, 256, 64 );
		ctx.fillStyle = '#fff'; ctx.font = '700 24px Helvetica, Arial, sans-serif';
		ctx.fillText( 'BALLPARK', 384, 20 ); ctx.fillText( 'POLICIES', 384, 46 );
		ctx.fillStyle = '#222'; ctx.textAlign = 'left'; ctx.font = '500 15px Helvetica, Arial, sans-serif';
		const rules = [ 'All bags subject to search', 'No bottles, cans or coolers', 'No umbrellas in seating', 'areas when others object', 'No re-entry', 'Smoking in designated', 'areas only', 'No noisemakers', 'Tickets must be scanned', 'for entry' ];
		rules.forEach( ( r, i ) => ctx.fillText( ( /^[a-z]/.test( r ) ? '   ' : '• ' ) + r, 268, 96 + i * 27, 232 ) );
		ctx.fillStyle = '#b3151f'; ctx.fillRect( 256, 372, 256, 12 );
		ctx.fillStyle = '#000'; ctx.fillRect( 0, 384, w, h - 384 );

	}, 'gateSigns' );
	const signMat = standard( { name: 'w1-gate-signs', roughness: 0.5, textures: { gsTex: signTex },
		surface: 'let t = textureSample( gsTex, smpAnisoClamp, in.uv ).rgb; s.albedo = t; s.emissive = t * smoothstep( 0.1, 0.7, frame.night ) * 0.08;' } );
	const signs = new Mesher();
	posts.forEach( ( s, i ) => {

		if ( i % 2 === 1 || i === 0 || i === posts.length - 1 ) return;
		// on the fin's plaza-side edge, facing out: welcome placards on most, the rules on two
		const rules = i === 2 || i === posts.length - 3;
		const u0 = rules ? 0.5 : 0, w = rules ? 0.42 : 0.4, hgt = rules ? 0.63 : 0.6;
		for ( const side of [ - 1, 1 ] ) {

			const S = s + side * 0.085, oc = 1.4, yb = 1.55;
			// the text reads right from this side
			const rightOut = side * ( uz * nx - ux * nz ) > 0;
			const [ ua, ub ] = rightOut ? [ u0, u0 + 0.5 ] : [ u0 + 0.5, u0 ];
			signs.face( P( S, oc - w / 2, yb ), P( S, oc + w / 2, yb ), P( S, oc + w / 2, yb + hgt ), P( S, oc - w / 2, yb + hgt ), [ ux * side, 0, uz * side ], [ [ ua, 0.5 ], [ ub, 0.5 ], [ ub, 0 ], [ ua, 0 ] ] );

		}

	} );

	const steel = standard( { name: 'w1-stainless', color: new Color( 0.55, 0.56, 0.57 ), roughness: 0.3, metalness: 0.85 } );
	const dark = standard( { name: 'w1-gate-dark', color: new Color( 0.012, 0.014, 0.016 ), roughness: 0.25 } );
	for ( const [ m, mat, name, cast ] of [ [ redM, red, 'w1-gate-red', true ], [ steelM, steel, 'w1-gate-steel', false ], [ darkM, dark, 'w1-gate-dark', false ], [ logoM, logoMat, 'w1-bin-logos', false ], [ card, cardMat, 'w1-towel-cartons', true ], [ signs, signMat, 'w1-gate-placards', false ] ] ) {

		if ( ! m.count ) continue;
		mat.underwaterLighting = 'none';
		const mesh = new Mesh( m.geometry(), mat );
		mesh.name = name;
		mesh.castShadow = cast;
		mesh.receiveShadow = true;
		group.add( mesh );

	}

	// the tripods' arms: three stainless tubes from a hub, turning a third of a turn as each fan goes
	// through (instanced, posed every frame)
	// the hub turns about its own z: the arms in its x-y plane, one of them (+x) straight across
	const arm = new Mesher();
	arm.tube( [ [ 0, 0, - 0.05 ], [ 0, 0, 0.03 ] ], [ 0.075, 0.075 ], 10, { capA: true, capB: true } );
	for ( let k = 0; k < 3; k ++ ) {

		const q = k / 3 * Math.PI * 2;
		arm.tube( [ [ Math.cos( q ) * 0.06, Math.sin( q ) * 0.06, 0 ], [ Math.cos( q ) * 0.5, Math.sin( q ) * 0.5, 0 ] ], [ 0.019, 0.017 ], 6, { capB: true } );

	}

	const tri = new InstancedMesh( arm.geometry(), steel, tripods.length );
	tri.name = 'w1-tripods';
	tri.frustumCulled = false;
	tri.userData.dynamic = true;
	group.add( tri );
	// the hub's axis leans up and in along the passage (so the arm across it is level and the other two
	// hang below): x across the passage, z the axis
	const X = new Vector3( ux, 0, uz ), Z = new Vector3( - nx, 1, - nz ).normalize(), Y = new Vector3().crossVectors( Z, X );
	const basis = new Matrix4().makeBasis( X, Y, Z ), spin = new Matrix4(), m = new Matrix4();
	const poseTripods = () => {

		tripods.forEach( ( tp, i ) => {

			m.multiplyMatrices( basis, spin.makeRotationZ( tp.phase ) );
			m.setPosition( tp.at[ 0 ], tp.at[ 1 ], tp.at[ 2 ] );
			tri.setMatrixAt( i, m );

		} );
		tri.instanceMatrix.needsUpdate = true;

	};

	poseTripods();
	return { lanes: out, P, n: [ nx, nz ], u: [ ux, uz ], tripods, poseTripods, towelSpots, bins };

}
