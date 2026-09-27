import { Mesh, Color, Vector3 } from '../../../engine/index.js';
import { commonModule } from '../../../engine/render/wgsl/common.js';
import { standard } from '../../../materials/Materials.js';
import { canvasTexture } from '../../geo.js';
import { LEVELS } from '../../layout.js';
import { Mesher } from './Mesher.js';
import { LIFT, pattisonZ, eleventhX } from './Street.js';

// The street's own economy on a World Series night, off the ballpark's property on the far corners
// where the crowd comes over from the lots (AP and TicketNews, Oct 2008: MLB bans resale on stadium
// property, the scalpers worked outside it; Game 5 seats went for $599 to $3,500): the peanut men with
// their shopping carts of brown bags ("Peanuts! Cheaper out here!"), a man selling bootleg shirts from a
// cart with a rack on it (PHILTHY, PHINALLY!: the signs in the stands said it on the 27th; after the
// last out, WORLD CHAMPIONS, already), the scalpers walking the curb with their tickets fanned ("Who
// needs tickets? Who's selling?"), a man with a cardboard NEED 2 TIX sign, a man with a box of ponchos
// in the rain, and on the plaza a licensed program seller in his apron. Each sale plays out: the bag
// across the cart, the money, the change.

const STREET = LEVELS.mainConcourse;

export function buildVendors( { group, cast, colliders, field } ) {

	const chrome = new Mesher(), wire = new Mesher(), paper = new Mesher(), card = new Mesher(), shirts = new Mesher(), signs = new Mesher(), folded = new Mesher();
	const zS = ( x ) => pattisonZ( x ) + 9, xW = ( z ) => eleventhX( z ) - 5;
	const y = ( h ) => STREET + LIFT + h;
	const collide = ( x, z, r ) => {

		const w = field.toWorld( x, z );
		colliders.addCylinder( w.x, w.z, r, field.y0 + STREET, field.y0 + STREET + 1.1 );

	};

	// a shopping cart at [ x, z ] with its handle toward h ([ dx, dz ])
	const cart = ( x, z, h ) => {

		const s = [ - h[ 1 ], h[ 0 ] ];
		const P = ( a, b, yy ) => [ x + h[ 0 ] * a + s[ 0 ] * b, y( yy ), z + h[ 1 ] * a + s[ 1 ] * b ];
		// the basket: 0.9 long, 0.55 wide at the handle end, narrower at the nose; 0.45 to 0.95 up
		const corners = [ [ 0.45, - 0.27 ], [ 0.45, 0.27 ], [ - 0.45, 0.22 ], [ - 0.45, - 0.22 ] ];
		for ( const yy of [ 0.45, 0.95 ] ) for ( let i = 0; i < 4; i ++ ) {

			const [ a0, b0 ] = corners[ i ], [ a1, b1 ] = corners[ ( i + 1 ) % 4 ];
			chrome.tube( [ P( a0, b0, yy ), P( a1, b1, yy ) ], [ 0.008, 0.008 ], 4 );

		}

		for ( const [ a, b ] of corners ) chrome.tube( [ P( a, b, 0.45 ), P( a, b, 0.95 ) ], [ 0.008, 0.008 ], 4 );
		// the wire sides and floor
		for ( let i = 0; i < 4; i ++ ) {

			const [ a0, b0 ] = corners[ i ], [ a1, b1 ] = corners[ ( i + 1 ) % 4 ];
			const l = Math.hypot( a1 - a0, b1 - b0 );
			wire.face( P( a0, b0, 0.45 ), P( a1, b1, 0.45 ), P( a1, b1, 0.95 ), P( a0, b0, 0.95 ), [ 0, 0, 1 ], [ [ 0, 0 ], [ l, 0 ], [ l, 0.5 ], [ 0, 0.5 ] ] );

		}

		wire.face( P( 0.45, - 0.27, 0.45 ), P( 0.45, 0.27, 0.45 ), P( - 0.45, 0.22, 0.45 ), P( - 0.45, - 0.22, 0.45 ), [ 0, 1, 0 ], [ [ 0, 0 ], [ 0.54, 0 ], [ 0.54, 0.9 ], [ 0, 0.9 ] ] );
		// the frame down to the castors, the handle
		for ( const [ a, b ] of [ [ 0.45, - 0.25 ], [ 0.45, 0.25 ], [ - 0.4, - 0.2 ], [ - 0.4, 0.2 ] ] ) {

			chrome.tube( [ P( a, b, 0.45 ), P( a * 0.95, b * 0.95, 0.1 ) ], [ 0.012, 0.012 ], 4 );
			chrome.box( P( a * 0.95, b * 0.95, 0.05 ), [ 0.06, 0.1, 0.06 ] );

		}

		chrome.tube( [ P( 0.55, - 0.27, 1.0 ), P( 0.55, 0.27, 1.0 ) ], [ 0.018, 0.018 ], 6, { capA: true, capB: true } );
		chrome.tube( [ P( 0.45, - 0.27, 0.95 ), P( 0.55, - 0.27, 1.0 ) ], [ 0.01, 0.01 ], 4 );
		chrome.tube( [ P( 0.45, 0.27, 0.95 ), P( 0.55, 0.27, 1.0 ) ], [ 0.01, 0.01 ], 4 );
		collide( x, z, 0.55 );
		return P;

	};

	// ---- the peanut carts: brown bags heaped in the basket, a sign on cardboard
	const peanutCart = ( x, z, h ) => {

		const P = cart( x, z, h );
		for ( let i = 0; i < 26; i ++ ) {

			const a = - 0.36 + ( i % 6 ) * 0.13 + ( ( i * 7 ) % 3 ) * 0.01, b = - 0.18 + ( Math.floor( i / 6 ) % 4 ) * 0.12, lay = Math.floor( i / 24 );
			const c = P( a, b, 0.62 + lay * 0.1 + ( ( i * 13 ) % 5 ) * 0.015 );
			paper.box( c, [ 0.11, 0.17, 0.07 ] );

		}

		// the sign, taped to the cart's side toward the street
		const s = P( - 0.05, 0.3, 0.72 ), s1 = P( - 0.35, 0.3, 0.72 ), s2 = P( 0.25, 0.3, 0.72 );
		signs.face( [ s1[ 0 ], y( 0.5 ), s1[ 2 ] ], [ s2[ 0 ], y( 0.5 ), s2[ 2 ] ], [ s2[ 0 ], y( 0.9 ), s2[ 2 ] ], [ s1[ 0 ], y( 0.9 ), s1[ 2 ] ], [ - h[ 1 ], 0, h[ 0 ] ], [ [ 0, 1 ], [ 0.5, 1 ], [ 0.5, 0.5 ], [ 0, 0.5 ] ] );
		return s;

	};

	// ---- the shirt cart: a rack on the cart, shirts on hangers, a pile of folded ones
	const shirtCart = ( x, z, h ) => {

		const P = cart( x, z, h );
		chrome.tube( [ P( 0.2, - 0.6, 0.95 ), P( 0.2, - 0.6, 2.0 ) ], [ 0.015, 0.015 ], 5 );
		chrome.tube( [ P( 0.2, 0.6, 0.95 ), P( 0.2, 0.6, 2.0 ) ], [ 0.015, 0.015 ], 5 );
		chrome.tube( [ P( 0.2, - 0.62, 2.0 ), P( 0.2, 0.62, 2.0 ) ], [ 0.015, 0.015 ], 5 );
		const out = [];
		for ( let i = 0; i < 4; i ++ ) {

			// a shirt: 0.5 wide, 0.7 long, hung by its shoulders off the rail, both sides
			const b = - 0.42 + i * 0.28, a = 0.2 + ( i % 2 ) * 0.03;
			const u0 = ( i % 4 ) * 0.25;
			for ( const side of [ 1, - 1 ] ) {

				// (seen from its side, the print reads from B to A)
				const A = P( a + side * 0.02, b - 0.25 * side, 1.25 ), B = P( a + side * 0.02, b + 0.25 * side, 1.25 ), C = P( a + side * 0.02, b + 0.25 * side, 1.95 ), D = P( a + side * 0.02, b - 0.25 * side, 1.95 );
				shirts.face( A, B, C, D, [ h[ 0 ] * side, 0, h[ 1 ] * side ], [ [ u0 + 0.25, 0.5 ], [ u0, 0.5 ], [ u0, 0 ], [ u0 + 0.25, 0 ] ] );

			}

			out.push( i );

		}

		for ( let i = 0; i < 8; i ++ ) folded.box( P( - 0.3 + ( i % 4 ) * 0.17, - 0.1 + Math.floor( i / 4 ) * 0.2, 0.52 + ( i % 3 ) * 0.04 ), [ 0.15, 0.05, 0.19 ] );
		return P;

	};

	// ---- the corners (the lots cross to them): SE across Pattison, NW across 11th
	const SE = [ - 141, zS( - 141 ) ], NW = [ xW( 111 ), 111 ];
	const pc1 = [ - 131.5, SE[ 1 ] + 2.6 ], pc2 = [ NW[ 0 ] - 3.2, 101.5 ], sc = [ - 118, zS( - 118 ) + 2.8 ];
	peanutCart( pc1[ 0 ], pc1[ 1 ], [ 0, 1 ] );
	peanutCart( pc2[ 0 ], pc2[ 1 ], [ - 1, 0 ] );
	shirtCart( sc[ 0 ], sc[ 1 ], [ 0, 1 ] );
	// the poncho man's carton on the plaza's corner
	const pb = [ - 130.8, 104.5 ];
	card.box( [ pb[ 0 ], y( 0.2 ), pb[ 1 ] ], [ 0.55, 0.4, 0.4 ] );
	for ( let i = 0; i < 6; i ++ ) wire.box( [ pb[ 0 ] - 0.18 + ( i % 3 ) * 0.18, y( 0.42 + Math.floor( i / 3 ) * 0.03 ), pb[ 1 ] - 0.08 + Math.floor( i / 3 ) * 0.16 ], [ 0.16, 0.025, 0.12 ] );

	// ---- the textures: the peanut sign, the shirts
	const tex = canvasTexture( 1024, 512, ( ctx ) => {

		// the shirts (top half: four designs on white, red, grey, navy)
		const designs = [
			[ '#f2f0ea', '#b3151f', 'PHILTHY', 'PHILLIES 2008' ], [ '#a8141e', '#f2f0ea', 'PHINALLY!', 'WORLD SERIES' ],
			[ '#6d6d70', '#b3151f', '2008', 'WORLD SERIES' ], [ '#1b2a57', '#f2f0ea', 'BEAT', 'THE RAYS' ],
		];
		designs.forEach( ( [ bg, ink, a, b ], i ) => {

			const ox = i * 256;
			ctx.fillStyle = bg;
			// a T-shirt's outline: body and sleeves
			ctx.beginPath();
			ctx.moveTo( ox + 70, 10 ); ctx.lineTo( ox + 186, 10 ); ctx.lineTo( ox + 250, 60 ); ctx.lineTo( ox + 218, 100 ); ctx.lineTo( ox + 196, 84 );
			ctx.lineTo( ox + 196, 250 ); ctx.lineTo( ox + 60, 250 ); ctx.lineTo( ox + 60, 84 ); ctx.lineTo( ox + 38, 100 ); ctx.lineTo( ox + 6, 60 ); ctx.closePath(); ctx.fill();
			ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
			ctx.font = '900 34px Impact, "Arial Black", Helvetica, sans-serif';
			ctx.fillText( a, ox + 128, 110, 130 );
			ctx.font = '700 18px Helvetica, Arial, sans-serif';
			ctx.fillText( b, ox + 128, 150, 130 );

		} );
		// the peanut sign (bottom left), cardboard and marker
		ctx.fillStyle = '#8a6a44'; ctx.fillRect( 0, 256, 512, 256 );
		ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
		ctx.font = '700 88px "Marker Felt", "Comic Sans MS", "Chalkboard", sans-serif';
		ctx.fillText( 'PEANUTS', 256, 340, 470 );
		ctx.font = '700 70px "Marker Felt", "Comic Sans MS", "Chalkboard", sans-serif';
		ctx.fillText( '$2  3/$5', 256, 440, 460 );
		// NEED 2 TIX (bottom right), for anyone else's sign
		ctx.fillStyle = '#9a7b52'; ctx.fillRect( 512, 256, 512, 256 );
		ctx.fillStyle = '#111';
		ctx.font = '700 110px "Marker Felt", "Comic Sans MS", "Chalkboard", sans-serif';
		ctx.fillText( 'NEED 2', 768, 330, 470 );
		ctx.fillText( 'TIX', 768, 440, 470 );

	}, 'vendorGoods' );
	const shirtMat = standard( { name: 'w1-shirts', roughness: 0.9, alphaTest: 0.5, side: 'double', textures: { vgTex: tex },
		surface: 'let t = textureSample( vgTex, smpAnisoClamp, in.uv ); s.alpha = t.a; s.albedo = t.rgb;' } );
	const foldedMat = standard( { name: 'w1-folded-shirts', color: new Color( 0.4, 0.02, 0.03 ), roughness: 0.9, modules: [ commonModule ],
		surface: 's.albedo = select( mat.color, vec3f( 0.75 ), fract( floor( in.P.x * 6.0 ) * 0.37 + floor( in.P.z * 6.0 ) * 0.61 ) > 0.6 ) * ( 0.85 + 0.2 * mx_noise_float3( in.P * 20.0 ) );' } );
	const signMat = standard( { name: 'w1-vendor-signs', roughness: 0.9, textures: { vsTex: tex },
		surface: 'let t = textureSample( vsTex, smpAnisoClamp, in.uv ).rgb; s.albedo = t;' } );
	const chromeMat = standard( { name: 'w1-cart-chrome', color: new Color( 0.6, 0.61, 0.62 ), roughness: 0.25, metalness: 0.9 } );
	const wireMat = standard( { name: 'w1-cart-wire', color: new Color( 0.55, 0.56, 0.57 ), roughness: 0.3, metalness: 0.8, alphaTest: 0.5, side: 'double',
		surface: /* wgsl */`
	// wire mesh, 5 cm squares, fading to a grey veil where the wires get finer than a pixel
	let g = abs( fract( in.uv / 0.05 ) - 0.5 );
	let fw = fwidth( in.uv.x ) / 0.05;
	s.alpha = max( step( 0.42 - fw, max( g.x, g.y ) ), clamp( fw * 0.8, 0.0, 0.6 ) );
` } );
	const paperMat = standard( { name: 'w1-peanut-bags', color: new Color( 0.38, 0.26, 0.14 ), roughness: 0.95, modules: [ commonModule ],
		surface: 's.albedo = mat.color * ( 0.8 + 0.35 * mx_noise_float3( in.P * 30.0 ) );' } );
	const cardMat = standard( { name: 'w1-carton', color: new Color( 0.36, 0.25, 0.14 ), roughness: 0.9 } );
	for ( const [ m, mat, name ] of [ [ chrome, chromeMat, 'w1-carts' ], [ wire, wireMat, 'w1-cart-wire' ], [ paper, paperMat, 'w1-peanuts' ], [ card, cardMat, 'w1-poncho-carton' ], [ shirts, shirtMat, 'w1-bootleg-shirts' ], [ folded, foldedMat, 'w1-folded-shirts' ], [ signs, signMat, 'w1-vendor-signs' ] ] ) {

		if ( ! m.count ) continue;
		mat.underwaterLighting = 'none';
		const mesh = new Mesh( m.geometry(), mat );
		mesh.name = name;
		mesh.castShadow = name !== 'w1-cart-wire';
		mesh.receiveShadow = true;
		group.add( mesh );

	}

	// ---- the people
	const C = cast;
	const busy = ( k ) => ( w ) => ! w.celebrate && w.rate > k;
	// the peanut men: behind their carts, a sale going on, a regular or two
	const sale = ( cartAt, h, who ) => {

		const v = C.add( { at: [ cartAt[ 0 ] + h[ 0 ] * 0.95, cartAt[ 1 ] + h[ 1 ] * 0.95 ], face: [ cartAt[ 0 ] - h[ 0 ] * 3, cartAt[ 1 ] - h[ 1 ] * 3 ], act: 'sell', who: 'vendor', when: busy( 0.03 ), extra: { rate: 1, t: 0 } } );
		const b = C.add( { at: [ cartAt[ 0 ] - h[ 0 ] * 0.95 + h[ 1 ] * 0.2, cartAt[ 1 ] - h[ 1 ] * 0.95 - h[ 0 ] * 0.2 ], face: cartAt, act: 'buy', who: who || {}, when: busy( 0.12 ), extra: { rate: 1, t: 0 } } );
		return [ v, b ];

	};

	sale( pc1, [ 0, 1 ] );
	sale( pc2, [ - 1, 0 ], { woman: true } );
	// the shirt man, a couple looking the shirts over
	C.add( { at: [ sc[ 0 ] + 0.3, sc[ 1 ] + 1.2 ], face: [ sc[ 0 ], sc[ 1 ] - 3 ], act: 'hawk', item: 'towel', who: { top: 7 }, dry: true, when: ( w ) => w.rate > 0.03 || w.celebrate } );
	C.add( { at: [ sc[ 0 ] - 0.6, sc[ 1 ] - 1.2 ], face: sc, act: 'window', when: busy( 0.2 ) } );
	C.add( { at: [ sc[ 0 ] + 0.2, sc[ 1 ] - 1.35 ], face: sc, act: 'talk', who: { woman: true }, when: busy( 0.2 ) } );
	// the scalpers, walking their bit of curb by the crosswalks, and the man with the sign
	C.add( { at: [ - 138, SE[ 1 ] + 1.2 ], act: 'scalp', who: { top: 5, woman: false }, noRainGear: true, when: busy( 0.02 ), extra: { pace: [ [ - 139.5, SE[ 1 ] + 1.2 ], [ - 126, SE[ 1 ] + 1.4 ] ] } } );
	C.add( { at: [ NW[ 0 ] - 1.4, 105 ], act: 'scalp', who: { top: 19, woman: false }, noRainGear: true, when: busy( 0.05 ), extra: { pace: [ [ NW[ 0 ] - 1.4, 96 ], [ NW[ 0 ] - 1.2, 108.5 ] ] } } );
	C.add( { at: [ - 112, SE[ 1 ] + 1.0 ], act: 'scalp', who: { top: 9, woman: false }, noRainGear: true, when: busy( 0.3 ), extra: { pace: [ [ - 116, SE[ 1 ] + 1.0 ], [ - 100, SE[ 1 ] + 1.1 ] ] } } );
	C.add( { at: [ NW[ 0 ] - 3.6, 97.5 ], face: [ NW[ 0 ] + 4, 97.5 ], act: 'sign', noRainGear: true, when: busy( 0.05 ) } );
	// the poncho man, the 27th only: a packet held up to the people coming over the crosswalk
	C.add( { at: [ pb[ 0 ] + 0.5, pb[ 1 ] + 0.6 ], face: [ - 133, 114 ], act: 'hawk', item: 'program', who: 'vendor', when: ( w ) => w.first && w.rate > 0.05 } );
	// the licensed program seller in his apron, on the plaza on the way to the gate
	C.add( { at: [ - 97.5, 57.5 ], face: [ - 106, 70 ], act: 'hawk', item: 'program', who: 'vendor', when: busy( 0.08 ) } );
	return { shirts: shirtMat, carts: [ pc1, pc2, sc ] };

}
