import { Mesh, Color } from '../../../engine/index.js';
import { standard } from '../../../materials/Materials.js';
import { Quads } from '../../Stands.js';
import { canvasTexture } from '../../geo.js';

// Window boxes: dark green painted troughs of October flowers (petunias still going in purple, pink and
// white, rust and gold mums, and ivy trailing over the front), hung on the rails over the pens and along
// the upper pen's lip. The flowers are cards: little crossed quads of drawn clusters, alpha-tested, in
// one draw; the boxes in another.
//
//   flowerBoxes( parent, runs )   runs: [ { a: [ x, y, z ], b: [ x, y, z ], out: [ nx, nz ] } ]: the box's
//                                 top front edge from a to b, `out` the way its front faces

const rnd = ( n ) => {

	const s = Math.sin( n * 12.9898 + 78.233 ) * 43758.5453;
	return s - Math.floor( s );

};

// the atlas: 4 x 2 cells of 128 x 128; 0-5 flower clusters, 6-7 trailing ivy
function drawFlowers( ctx, W, H ) {

	ctx.clearRect( 0, 0, W, H );
	const C = 128;
	const palettes = [
		[ '#6a2c8e', '#8a45b0', '#4a1a6a' ], // purple petunias
		[ '#c23a86', '#e060a8', '#8e1f5c' ], // pink
		[ '#f2eee6', '#e2ddd2', '#c9c4b8' ], // white
		[ '#b8561c', '#d4782e', '#8a3a12' ], // rust mums
		[ '#e0a91e', '#f2c440', '#b07c10' ], // gold mums
		[ '#7a2a9a', '#f2eee6', '#c23a86' ], // mixed
	];
	for ( let i = 0; i < 8; i ++ ) {

		const x0 = ( i % 4 ) * C, y0 = Math.floor( i / 4 ) * C;
		ctx.save();
		ctx.translate( x0, y0 );
		ctx.beginPath(); ctx.rect( 0, 0, C, C ); ctx.clip();
		if ( i < 6 ) {

			// leaves at the bottom, then the blooms mounded over them
			for ( let k = 0; k < 60; k ++ ) {

				const x = 10 + rnd( i * 91 + k ) * ( C - 20 ), y = C * 0.45 + rnd( i * 37 + k * 3 ) * C * 0.55;
				ctx.fillStyle = [ '#1f4a18', '#2c5e20', '#173a12' ][ k % 3 ];
				ctx.beginPath(); ctx.ellipse( x, y, 7, 4, rnd( k ) * 3, 0, Math.PI * 2 ); ctx.fill();

			}

			const pal = palettes[ i ];
			const mum = i === 3 || i === 4;
			for ( let k = 0; k < ( mum ? 34 : 26 ); k ++ ) {

				const a = rnd( i * 13 + k * 7 ) * Math.PI, r = rnd( i * 5 + k * 11 ) * C * 0.42;
				const x = C / 2 + Math.cos( a ) * r, y = C * 0.9 - Math.sin( a ) * r * 1.1;
				const col = pal[ k % 3 ];
				if ( mum ) {

					// a tight ball of petals
					ctx.fillStyle = col; ctx.beginPath(); ctx.arc( x, y, 6, 0, Math.PI * 2 ); ctx.fill();
					ctx.fillStyle = 'rgba( 0, 0, 0, 0.18 )'; ctx.beginPath(); ctx.arc( x + 1.5, y + 1.5, 3, 0, Math.PI * 2 ); ctx.fill();

				} else {

					// a trumpet: five round petals and a dark throat
					ctx.fillStyle = col;
					for ( let p = 0; p < 5; p ++ ) {

						const pa = p / 5 * Math.PI * 2;
						ctx.beginPath(); ctx.arc( x + Math.cos( pa ) * 4, y + Math.sin( pa ) * 4, 4.2, 0, Math.PI * 2 ); ctx.fill();

					}

					ctx.fillStyle = i === 2 ? '#d8c85a' : '#2a0c2a';
					ctx.beginPath(); ctx.arc( x, y, 1.8, 0, Math.PI * 2 ); ctx.fill();

				}

			}

		} else {

			// ivy: runners hanging down, heart-shaped leaves along them
			for ( let r = 0; r < 5; r ++ ) {

				let x = 14 + r * 24 + rnd( i + r ) * 10, y = 0;
				ctx.strokeStyle = '#2a3a14'; ctx.lineWidth = 2;
				ctx.beginPath(); ctx.moveTo( x, y );
				const len = C * ( 0.5 + 0.5 * rnd( i * 3 + r ) );
				while ( y < len ) {

					const nx = x + ( rnd( x + y ) - 0.5 ) * 8, ny = y + 9;
					ctx.lineTo( nx, ny );
					ctx.fillStyle = [ '#244d16', '#326622', '#1a3a10' ][ Math.floor( y ) % 3 ];
					const side = ( Math.floor( y / 9 ) % 2 ) * 2 - 1;
					ctx.beginPath(); ctx.ellipse( nx + side * 6, ny, 6, 5, side * 0.6, 0, Math.PI * 2 ); ctx.fill();
					ctx.beginPath(); ctx.moveTo( nx, ny );
					x = nx; y = ny;

				}

				ctx.stroke();

			}

		}

		ctx.restore();

	}

}

let _mats = null;
function materials() {

	if ( _mats ) return _mats;
	const tex = canvasTexture( 512, 256, drawFlowers, 'windowBoxFlowers' );
	const cards = standard( {
		name: 'window-box-flowers', roughness: 0.75, side: 'double', alphaTest: 0.5, textures: { bpFlowers: tex },
		surface: /* wgsl */`
	let t = textureSample( bpFlowers, smpAnisoClamp, in.uv );
	s.alpha = t.a;
	s.albedo = t.rgb * 0.85;
	s.emissive = t.rgb * smoothstep( 0.2, 0.8, frame.night ) * 0.12;
` } );
	const trough = standard( { name: 'window-boxes', color: new Color( 0.012, 0.05, 0.025 ), roughness: 0.55, metalness: 0.2,
		surface: 's.emissive = s.albedo * smoothstep( 0.2, 0.8, frame.night ) * 0.3;' } );
	for ( const m of [ cards, trough ] ) m.underwaterLighting = 'none';
	_mats = { cards, trough };
	return _mats;

}

export function flowerBoxes( parent, runs, { depth = 0.26, height = 0.24, name = 'window-boxes' } = {} ) {

	const M = materials();
	const cq = new Quads(), bq = new Quads();
	const cellUV = ( c ) => [ ( c % 4 ) / 4, Math.floor( c / 4 ) / 2 ];
	let seed = 1;
	for ( const { a, b, out } of runs ) {

		const dx = b[ 0 ] - a[ 0 ], dz = b[ 2 ] - a[ 2 ], L = Math.hypot( dx, dz );
		if ( L < 0.2 ) continue;
		const ux = dx / L, uz = dz / L;
		const [ nx, nz ] = out;
		// the trough: its front face, the ends, the bottom (its back is against the rail)
		const y1 = a[ 1 ], y0 = y1 - height;
		const P = ( s, o, y ) => [ a[ 0 ] + ux * s + nx * o, y, a[ 2 ] + uz * s + nz * o ];
		bq.add( P( 0, 0, y0 ), P( L, 0, y0 ), P( L, 0, y1 ), P( 0, 0, y1 ), [ nx, 0, nz ] );
		bq.add( P( 0, - depth, y0 ), P( L, - depth, y0 ), P( L, 0, y0 ), P( 0, 0, y0 ), [ 0, - 1, 0 ] );
		bq.add( P( 0, - depth, y1 ), P( L, - depth, y1 ), P( L, - depth, y0 ), P( 0, - depth, y0 ), [ - nx, 0, - nz ] );
		for ( const [ s, sg ] of [ [ 0, - 1 ], [ L, 1 ] ] ) bq.add( P( s, - depth, y0 ), P( s, 0, y0 ), P( s, 0, y1 ), P( s, - depth, y1 ), [ ux * sg, 0, uz * sg ] );
		// the soil, a little under the rim
		bq.add( P( 0, - depth, y1 - 0.03 ), P( L, - depth, y1 - 0.03 ), P( L, 0, y1 - 0.03 ), P( 0, 0, y1 - 0.03 ), [ 0, 1, 0 ] );
		// the flowers: a mound of clusters every 22 cm, two crossed cards each; ivy over the front
		const run = Math.floor( rnd( seed * 7 ) * 6 );
		for ( let s = 0.1; s < L - 0.05; s += 0.22 ) {

			seed ++;
			// mostly one kind along a box, a few of another mixed in
			const c = rnd( seed * 3.3 ) < 0.7 ? run : Math.floor( rnd( seed * 5.1 ) * 6 );
			const [ u0, v0 ] = cellUV( c );
			const w = 0.3 + 0.1 * rnd( seed ), h = 0.26 + 0.1 * rnd( seed * 2 );
			const o = - depth / 2 + ( rnd( seed * 9 ) - 0.5 ) * 0.1;
			const ang = rnd( seed * 4 ) * Math.PI;
			for ( const t of [ ang, ang + Math.PI / 2 ] ) {

				const ex = Math.cos( t ) * w / 2, ez = Math.sin( t ) * w / 2;
				const [ cx, , cz ] = P( s, o, 0 );
				cq.tri( [ cx - ex, y1 - 0.04, cz - ez ], [ cx + ex, y1 - 0.04, cz + ez ], [ cx + ex, y1 - 0.04 + h, cz + ez ], [ Math.sin( t ), 0, - Math.cos( t ) ], [ u0, v0 + 0.5 ], [ u0 + 0.25, v0 + 0.5 ], [ u0 + 0.25, v0 ] );
				cq.tri( [ cx - ex, y1 - 0.04, cz - ez ], [ cx + ex, y1 - 0.04 + h, cz + ez ], [ cx - ex, y1 - 0.04 + h, cz - ez ], [ Math.sin( t ), 0, - Math.cos( t ) ], [ u0, v0 + 0.5 ], [ u0 + 0.25, v0 ], [ u0, v0 ] );

			}

			if ( rnd( seed * 11 ) < 0.45 ) {

				// ivy spilling over the front and hanging down it
				const [ iu, iv ] = cellUV( 6 + ( seed % 2 ) );
				const hw = 0.14, hl = 0.3 + 0.25 * rnd( seed * 13 );
				const A = P( s - hw, 0.02, y1 + 0.02 ), B = P( s + hw, 0.02, y1 + 0.02 ), Cc = P( s + hw, 0.05, y1 + 0.02 - hl ), D = P( s - hw, 0.05, y1 + 0.02 - hl );
				cq.tri( A, B, Cc, [ nx, 0, nz ], [ iu, iv ], [ iu + 0.25, iv ], [ iu + 0.25, iv + 0.5 * hl / 0.55 ] );
				cq.tri( A, Cc, D, [ nx, 0, nz ], [ iu, iv ], [ iu + 0.25, iv + 0.5 * hl / 0.55 ], [ iu, iv + 0.5 * hl / 0.55 ] );

			}

		}

	}

	const boxes = new Mesh( bq.geometry(), M.trough );
	boxes.name = name;
	boxes.receiveShadow = true;
	boxes.castShadow = true;
	parent.add( boxes );
	const flowers = new Mesh( cq.geometry(), M.cards );
	flowers.name = name + '-flowers';
	flowers.receiveShadow = true;
	parent.add( flowers );
	return { boxes, flowers };

}
