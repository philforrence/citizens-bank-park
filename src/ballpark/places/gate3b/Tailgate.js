import { Mesh, Color } from '../../../engine/index.js';
import { commonModule } from '../../../engine/render/wgsl/common.js';
import { standard } from '../../../materials/Materials.js';
import { canvasTexture } from '../../geo.js';
import { LEVELS } from '../../layout.js';
import { Mesher } from './Mesher.js';

// The tailgaters in the lots across Pattison and 11th (the lots south of Pattison allowed it; YouTube
// "Game 5 pregame tailgate", CheeseSteakHead, Oct 2008): a pop-up canopy over a freed-up stall, a kettle
// grill sending up its smoke, a cooler, camp chairs, a little TV on a card table run off a generator for
// the ones without tickets who stay out and watch, a Phillies flag on a pole off a truck's hitch. In the
// rain on the 27th they huddle under the canopy; on the 29th they spread out; after the last out they're
// jumping.

const STREET = LEVELS.mainConcourse;
// the canopies' spots and which way they face (the TV's screen toward the chairs)
export const TAILGATES = [
	{ at: [ - 80, 158.5 ], yaw: 0.0, color: [ 0.03, 0.08, 0.3 ] },
	{ at: [ - 57, 162 ], yaw: 0.5, color: [ 0.35, 0.02, 0.03 ] },
	{ at: [ - 178, 66 ], yaw: 1.4, color: [ 0.06, 0.2, 0.08 ] },
];

export function buildTailgates( { group, cast } ) {

	const y = ( h ) => STREET + 0.03 + h;
	const steel = new Mesher(), cloth = new Mesher(), black = new Mesher(), cooler = new Mesher(), chairs = new Mesher(), screen = new Mesher(), smoke = new Mesher(), flag = new Mesher();
	const out = [];
	for ( const [ gi, T ] of TAILGATES.entries() ) {

		const [ cx, cz ] = T.at, c = Math.cos( T.yaw ), s = Math.sin( T.yaw );
		const P = ( a, b, h ) => [ cx + a * c + b * s, y( h ), cz - a * s + b * c ];
		// the canopy: 3 x 3, four legs, a peaked roof in the group's colour
		for ( const [ a, b ] of [ [ - 1.5, - 1.5 ], [ 1.5, - 1.5 ], [ 1.5, 1.5 ], [ - 1.5, 1.5 ] ] ) steel.tube( [ P( a, b, 0 ), P( a, b, 2.2 ) ], [ 0.022, 0.022 ], 4 );
		const apex = P( 0, 0, 2.85 ), K = [ [ - 1.55, - 1.55 ], [ 1.55, - 1.55 ], [ 1.55, 1.55 ], [ - 1.55, 1.55 ] ];
		for ( let i = 0; i < 4; i ++ ) {

			const A = P( ...K[ i ], 2.25 ), B = P( ...K[ ( i + 1 ) % 4 ], 2.25 );
			const ia = cloth.v( A, [ 0, 1, 0 ], [ gi, 0 ] ), ib = cloth.v( B, [ 0, 1, 0 ], [ gi, 0 ] ), ic = cloth.v( apex, [ 0, 1, 0 ], [ gi, 0 ] );
			cloth.tri( ia, ib, ic );
			cloth.face( [ A[ 0 ], y( 2.0 ), A[ 2 ] ], [ B[ 0 ], y( 2.0 ), B[ 2 ] ], B, A, [ 0, 0, 1 ], [ [ gi, 0 ], [ gi, 0 ], [ gi, 0 ], [ gi, 0 ] ] );

		}

		// the grill: a black kettle on three legs, its lid half off
		const g = P( 1.9, 0.6, 0 );
		for ( let k = 0; k < 3; k ++ ) {

			const q = k / 3 * Math.PI * 2;
			steel.tube( [ [ g[ 0 ] + Math.cos( q ) * 0.25, y( 0 ), g[ 2 ] + Math.sin( q ) * 0.25 ], [ g[ 0 ], y( 0.6 ), g[ 2 ] ] ], [ 0.012, 0.012 ], 4 );

		}

		black.tube( [ [ g[ 0 ], y( 0.55 ), g[ 2 ] ], [ g[ 0 ], y( 0.7 ), g[ 2 ] ], [ g[ 0 ], y( 0.82 ), g[ 2 ] ] ], [ 0.15, 0.27, 0.28 ], 12, { capA: true } );
		black.tube( [ [ g[ 0 ] + 0.2, y( 0.9 ), g[ 2 ] + 0.2 ], [ g[ 0 ] + 0.28, y( 1.05 ), g[ 2 ] + 0.28 ] ], [ 0.28, 0.1 ], 12, { capB: true } );
		// its smoke: a leaning column, drawn as three crossed sheets the shader fills with drifting puffs
		for ( let k = 0; k < 3; k ++ ) {

			const q = k / 3 * Math.PI, dx = Math.cos( q ) * 0.5, dz = Math.sin( q ) * 0.5;
			const b0 = [ g[ 0 ], y( 0.85 ), g[ 2 ] ], b1 = [ g[ 0 ] + 0.8, y( 3.6 ), g[ 2 ] + 0.5 ];
			smoke.face( [ b0[ 0 ] - dx * 0.3, b0[ 1 ], b0[ 2 ] - dz * 0.3 ], [ b0[ 0 ] + dx * 0.3, b0[ 1 ], b0[ 2 ] + dz * 0.3 ], [ b1[ 0 ] + dx * 1.6, b1[ 1 ], b1[ 2 ] + dz * 1.6 ], [ b1[ 0 ] - dx * 1.6, b1[ 1 ], b1[ 2 ] - dz * 1.6 ], [ dz, 0, - dx ], [ [ 0, 0 ], [ 1, 0 ], [ 1, 1 ], [ 0, 1 ] ] );

		}

		// the cooler, the card table and its TV, the generator
		cooler.box( P( - 1.1, 1.0, 0.22 ), [ 0.7, 0.44, 0.45 ] );
		black.box( P( - 1.1, 1.0, 0.46 ), [ 0.72, 0.04, 0.47 ] );
		const tt = P( 0, - 1.1, 0 );
		black.box( [ tt[ 0 ], y( 0.72 ), tt[ 2 ] ], [ 0.8, 0.03, 0.8 ] );
		for ( const [ a, b ] of [ [ - 0.35, - 0.35 ], [ 0.35, - 0.35 ], [ - 0.35, 0.35 ], [ 0.35, 0.35 ] ] ) steel.tube( [ P( a, - 1.1 + b, 0 ), P( a, - 1.1 + b, 0.72 ) ], [ 0.012, 0.012 ], 4 );
		black.box( P( 0, - 1.2, 0.95 ), [ 0.5, 0.42, 0.36 ] );
		// the screen, facing the chairs (along +b)
		const S0 = P( - 0.21, - 1.015, 0.78 ), S1 = P( 0.21, - 1.015, 0.78 ), S2 = P( 0.21, - 1.015, 1.12 ), S3 = P( - 0.21, - 1.015, 1.12 );
		screen.face( S0, S1, S2, S3, [ s, 0, c ], [ [ 0, 1 ], [ 1, 1 ], [ 1, 0 ], [ 0, 0 ] ] );
		black.box( P( 1.2, - 2.2, 0.25 ), [ 0.6, 0.5, 0.45 ] );
		// the camp chairs round the TV
		const seats = [];
		for ( const [ a, b ] of [ [ - 0.8, 0.6 ], [ 0, 0.9 ], [ 0.8, 0.6 ] ] ) {

			const p = P( a, b, 0 );
			for ( const [ da, db ] of [ [ - 0.25, - 0.22 ], [ 0.25, - 0.22 ], [ - 0.25, 0.22 ], [ 0.25, 0.22 ] ] ) steel.tube( [ P( a + da, b + db, 0 ), P( a + da * 0.9, b + db * 0.9, 0.45 ) ], [ 0.01, 0.01 ], 3 );
			chairs.face( P( a - 0.26, b - 0.24, 0.45 ), P( a + 0.26, b - 0.24, 0.45 ), P( a + 0.26, b + 0.2, 0.42 ), P( a - 0.26, b + 0.2, 0.42 ), [ 0, 1, 0 ], [ [ gi, 0 ], [ gi, 0 ], [ gi, 0 ], [ gi, 0 ] ] );
			chairs.face( P( a - 0.26, b + 0.22, 0.44 ), P( a + 0.26, b + 0.22, 0.44 ), P( a + 0.27, b + 0.3, 0.95 ), P( a - 0.27, b + 0.3, 0.95 ), [ 0, 0.3, 1 ], [ [ gi, 0 ], [ gi, 0 ], [ gi, 0 ], [ gi, 0 ] ] );
			seats.push( [ p[ 0 ], p[ 2 ] ] );

		}

		// a Phillies flag on a pole off the back of the rig
		const fp = P( - 2.2, - 1.8, 0 );
		steel.tube( [ [ fp[ 0 ], y( 0 ), fp[ 2 ] ], [ fp[ 0 ], y( 4.2 ), fp[ 2 ] ] ], [ 0.025, 0.02 ], 5 );
		flag.face( [ fp[ 0 ], y( 3.2 ), fp[ 2 ] ], [ fp[ 0 ] + c * 1.5, y( 3.2 ), fp[ 2 ] - s * 1.5 ], [ fp[ 0 ] + c * 1.5, y( 4.15 ), fp[ 2 ] - s * 1.5 ], [ fp[ 0 ], y( 4.15 ), fp[ 2 ] ], [ s, 0, c ], [ [ 0, 1 ], [ 1, 1 ], [ 1, 0 ], [ 0, 0 ] ] );
		out.push( { T, P, seats, grill: [ g[ 0 ], g[ 2 ] ], tv: [ tt[ 0 ], tt[ 2 ] ] } );

	}

	// ---- materials
	const flagTex = canvasTexture( 256, 160, ( ctx, w, h ) => {

		ctx.fillStyle = '#a8141e'; ctx.fillRect( 0, 0, w, h );
		ctx.fillStyle = '#f2efe6'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
		ctx.font = 'italic 700 64px "Brush Script MT", "Snell Roundhand", Georgia, serif';
		ctx.fillText( 'Phillies', w / 2, h / 2 + 4, w - 20 );

	}, 'tailgateFlag' );
	const cols = TAILGATES.map( ( T ) => T.color );
	const v3 = ( c ) => `vec3f( ${ c.map( ( x ) => x.toFixed( 3 ) ).join( ', ' ) } )`;
	const clothMat = standard( { name: 'w1-canopies', roughness: 0.6, side: 'double',
		surface: `let k = floor( in.uv.x + 0.5 ); s.albedo = select( select( ${ v3( cols[ 0 ] ) }, ${ v3( cols[ 1 ] ) }, k > 0.5 ), ${ v3( cols[ 2 ] ) }, k > 1.5 );` } );
	const chairMat = standard( { name: 'w1-camp-chairs', roughness: 0.8, side: 'double',
		surface: 'let k = floor( in.uv.x + 0.5 ); s.albedo = select( select( vec3f( 0.3, 0.01, 0.02 ), vec3f( 0.02, 0.04, 0.12 ), k > 0.5 ), vec3f( 0.08, 0.09, 0.05 ), k > 1.5 );' } );
	const screenMat = standard( { name: 'w1-tailgate-tv', color: new Color( 0.02, 0.02, 0.02 ), roughness: 0.1, modules: [ commonModule ],
		surface: /* wgsl */`
	// the game on the little TV: the green field, the score bug, a flicker as the shots cut
	let p = in.uv;
	var c = mix( vec3f( 0.05, 0.25, 0.05 ), vec3f( 0.35, 0.3, 0.2 ), step( 0.55, p.y + 0.1 * sin( p.x * 3.0 ) ) );
	c = mix( c, vec3f( 0.1, 0.12, 0.2 ), step( p.y, 0.25 ) );
	if ( p.y > 0.86 && p.x < 0.45 ) { c = vec3f( 0.8, 0.8, 0.8 ); }
	let cut = step( 0.5, fract( floor( frame.time / 4.0 ) * 0.37 ) );
	c = c * ( 0.7 + 0.3 * cut ) * ( 0.9 + 0.1 * sin( frame.time * 30.0 ) );
	s.albedo = vec3f( 0.02 );
	s.emissive = c * 3.0;
` } );
	const smokeMat = standard( { name: 'w1-grill-smoke', color: new Color( 0.5, 0.5, 0.5 ), roughness: 1.0, transparent: true, depthWrite: false, side: 'double', modules: [ commonModule ],
		surface: /* wgsl */`
	// puffs drifting up the sheet, thinning as they rise, gone at its edges
	let p = in.uv;
	let n = mx_noise_float2( vec2f( p.x * 3.0, p.y * 2.5 - frame.time * 0.6 ) ) * 0.5 + 0.5;
	let n2 = mx_noise_float2( vec2f( p.x * 7.0 + 3.0, p.y * 6.0 - frame.time * 1.1 ) ) * 0.5 + 0.5;
	let edge = smoothstep( 0.0, 0.3, p.x ) * smoothstep( 1.0, 0.7, p.x );
	let fade = smoothstep( 0.0, 0.08, p.y ) * ( 1.0 - smoothstep( 0.35, 1.0, p.y ) );
	s.alpha = clamp( ( n * 0.7 + n2 * 0.4 - 0.45 ) * 1.6, 0.0, 1.0 ) * edge * fade * 0.55;
	s.albedo = vec3f( 0.55, 0.55, 0.56 );
` } );
	const flagMat = standard( { name: 'w1-tailgate-flag', roughness: 0.7, side: 'double', textures: { tfTex: flagTex }, surface: 's.albedo = textureSample( tfTex, smpAnisoClamp, in.uv ).rgb;' } );
	for ( const [ m, mat, name, cast ] of [
		[ steel, standard( { name: 'w1-tailgate-steel', color: new Color( 0.45, 0.46, 0.47 ), roughness: 0.35, metalness: 0.8 } ), 'w1-tailgate-steel', true ],
		[ cloth, clothMat, 'w1-canopies', true ], [ black, standard( { name: 'w1-tailgate-black', color: new Color( 0.015 ), roughness: 0.4 } ), 'w1-tailgate-black', true ],
		[ cooler, standard( { name: 'w1-coolers', color: new Color( 0.5, 0.03, 0.03 ), roughness: 0.4 } ), 'w1-coolers', true ], [ chairs, chairMat, 'w1-camp-chairs', false ],
		[ screen, screenMat, 'w1-tailgate-tv', false ], [ smoke, smokeMat, 'w1-grill-smoke', false ], [ flag, flagMat, 'w1-tailgate-flags', false ],
	] ) {

		mat.underwaterLighting = 'none';
		const mesh = new Mesh( m.geometry(), mat );
		mesh.name = name;
		mesh.castShadow = cast;
		mesh.receiveShadow = true;
		if ( name === 'w1-grill-smoke' ) mesh.layers.set( 2 );
		group.add( mesh );

	}

	// ---- the people: three in the chairs watching, one at the grill, a couple standing with beers
	for ( const G of out ) {

		const { P } = G;
		for ( const [ i, s ] of G.seats.entries() ) {

			cast.add( { at: s, face: G.tv, act: 'sit', onRoad: true, noRainGear: true, reacts: true, props: i === 1 ? [ 'cup' ] : [], extra: { custom: ( c, dt, w, p ) => {

				if ( w.celebrate ) {

					// the last out on the little TV: up out of the chair
					c.f.sit = 0;
					p.flexL = 2.8; p.abductL = - 0.3; p.elbowL = 0.2; p.flexR = 2.8; p.abductR = - 0.3; p.elbowR = 0.2; p.pitch = 0.35;
					c.f.y += Math.max( 0, Math.sin( c.t * 6 ) ) * 0.25;

				}

			} } } );

		}

		const g = G.grill;
		cast.add( { at: [ g[ 0 ] - 0.75, g[ 1 ] - 0.1 ], face: g, act: 'stand', onRoad: true, noRainGear: true, extra: { custom: ( c, dt, w, p ) => {

			// the tongs: turning something over, a look at the TV, again
			const k = Math.max( 0, Math.sin( c.t * 0.8 ) );
			p.flexR = 0.6 + 0.35 * k; p.elbowR = 1.0 - 0.3 * k; p.abductR = 0.1; p.lean = 0.1 + 0.1 * k; p.pitch = - 0.4 * k;
			p.flexL = 0.4; p.elbowL = 1.4; c.f.props |= 1 << 7;

		} } } );
		cast.add( { at: P( - 0.6, - 2.3, 0 ).filter( ( _, i ) => i !== 1 ), face: G.tv, act: 'drink', onRoad: true, reacts: true, when: ( w ) => ! w.celebrate } );
		cast.add( { at: P( 0.5, - 2.4, 0 ).filter( ( _, i ) => i !== 1 ), face: G.tv, act: 'talk', onRoad: true, who: { woman: true }, when: ( w ) => ! w.celebrate } );
		cast.add( { at: P( 0.0, - 2.35, 0 ).filter( ( _, i ) => i !== 1 ), face: G.tv, act: 'jump', onRoad: true, when: ( w ) => w.celebrate } );

	}

	return { spots: TAILGATES.map( ( T ) => [ ...T.at, 5.5 ] ) };

}
