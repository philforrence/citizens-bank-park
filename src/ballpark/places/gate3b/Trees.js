import { Mesh, Color } from '../../../engine/index.js';
import { commonModule } from '../../../engine/render/wgsl/common.js';
import { standard } from '../../../materials/Materials.js';
import { canvasTexture } from '../../geo.js';
import { LEVELS } from '../../layout.js';
import { Mesher, rng } from './Mesher.js';
import { LIFT } from './Street.js';

// The street trees round the Third Base plaza, grown branch by branch instead of the spheres and blobs
// they were: the honey locusts planted with the park in 2004, four seasons on (about 6-7 m, a 10-12 cm
// trunk limbed up to 2.3 m for the crowds, an open vase of scaffold limbs), in late October: the crown
// thinning and gone gold, the leaflets they've dropped stuck to the wet paving round their grates.
//
// Each tree: a bark mesh (tapered tubes, flared at the foot) and leaf cards (sprays of leaflets from one
// atlas, alpha-tested, each card tinted between late green, yellow and gold), all static (merged by
// material into two draws with every other tree). Fallen leaves are cards flat on the ground.

const STREET = LEVELS.mainConcourse;

// October: what's left of the green, then yellow-green, gold, and a few gone brown (linear albedo)
const AUTUMN = [ [ 0.1, 0.15, 0.035 ], [ 0.2, 0.22, 0.04 ], [ 0.36, 0.3, 0.05 ], [ 0.46, 0.33, 0.045 ], [ 0.42, 0.26, 0.04 ], [ 0.22, 0.12, 0.04 ] ];

let _mats = null;

function materials() {

	if ( _mats ) return _mats;
	// the leaf atlas, 2 x 2: three sprays of pinnate leaves (R the leaf's shade, G a per-leaf random for
	// its colour, B the twig) and the scatter on the ground
	const atlas = canvasTexture( 1024, 1024, ( ctx, W ) => {

		ctx.clearRect( 0, 0, W, W );
		const cell = W / 2;
		const r = rng( 7 );
		const leaflet = ( x, y, a, len, wid, shade, hue ) => {

			ctx.save();
			ctx.translate( x, y );
			ctx.rotate( a );
			ctx.fillStyle = `rgb(${ Math.round( 150 + 105 * shade ) },${ Math.round( 255 * hue ) },0)`;
			ctx.beginPath();
			ctx.ellipse( len / 2, 0, len / 2, wid / 2, 0, 0, Math.PI * 2 );
			ctx.fill();
			// the midrib, a little darker
			ctx.strokeStyle = `rgba(${ Math.round( 110 + 80 * shade ) },${ Math.round( 255 * hue ) },0,0.8)`;
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo( 1, 0 );
			ctx.lineTo( len - 1, 0 );
			ctx.stroke();
			ctx.restore();

		};

		// a pinnate leaf: a rachis with pairs of small leaflets (the honey locust's)
		const leaf = ( x, y, a, L, k ) => {

			const hue = r();
			ctx.strokeStyle = 'rgb(90,40,255)';
			ctx.lineWidth = 1.2;
			ctx.beginPath();
			ctx.moveTo( x, y );
			ctx.lineTo( x + Math.cos( a ) * L, y + Math.sin( a ) * L );
			ctx.stroke();
			const n = 5 + Math.floor( r() * 4 );
			for ( let i = 0; i < n; i ++ ) {

				const t = ( i + 0.6 ) / ( n + 0.4 ) * L, px = x + Math.cos( a ) * t, py = y + Math.sin( a ) * t;
				// October: gaps where leaflets have fallen
				for ( const sd of [ - 1, 1 ] ) if ( r() > 0.18 * k ) leaflet( px, py, a + sd * ( 1.0 + r() * 0.3 ), 13 + r() * 6, 6 + r() * 2, 0.4 + r() * 0.6, Math.min( 1, hue + ( r() - 0.5 ) * 0.25 ) );

			}

		};

		for ( let c = 0; c < 3; c ++ ) {

			const ox = ( c % 2 ) * cell, oy = Math.floor( c / 2 ) * cell;
			ctx.save();
			ctx.beginPath();
			ctx.rect( ox + 2, oy + 2, cell - 4, cell - 4 );
			ctx.clip();
			// the spray: a twig up the middle, side twigs, leaves along them
			const twigs = [ [ ox + cell * 0.5, oy + cell * 0.98, - Math.PI / 2 + ( r() - 0.5 ) * 0.3, cell * 0.8 ] ];
			for ( let k = 0; k < 4; k ++ ) {

				const t = 0.25 + k * 0.17, [ x0, y0, a0, L0 ] = twigs[ 0 ];
				twigs.push( [ x0 + Math.cos( a0 ) * L0 * t, y0 + Math.sin( a0 ) * L0 * t, a0 + ( k % 2 ? 0.7 : - 0.7 ) + ( r() - 0.5 ) * 0.3, L0 * ( 0.45 - k * 0.06 ) ] );

			}

			ctx.strokeStyle = 'rgb(70,30,255)';
			for ( const [ x, y, a, L ] of twigs ) {

				ctx.lineWidth = L > cell * 0.5 ? 4 : 2.5;
				ctx.beginPath();
				ctx.moveTo( x, y );
				ctx.lineTo( x + Math.cos( a ) * L, y + Math.sin( a ) * L );
				ctx.stroke();

			}

			for ( const [ x, y, a, L ] of twigs ) {

				const n = Math.round( L / 22 );
				for ( let i = 0; i < n; i ++ ) {

					const t = ( i + 0.5 ) / n * L, px = x + Math.cos( a ) * t, py = y + Math.sin( a ) * t;
					for ( const sd of [ - 1, 1 ] ) if ( r() > 0.25 ) leaf( px, py, a + sd * ( 0.6 + r() * 0.6 ), 70 + r() * 60, c * 0.8 + 1 );

				}

			}

			ctx.restore();

		}

		// the ground: loose leaflets and a few whole leaves, stuck flat in the wet
		const ox = cell, oy = cell;
		for ( let i = 0; i < 260; i ++ ) {

			const x = ox + 20 + r() * ( cell - 40 ), y = oy + 20 + r() * ( cell - 40 );
			const d = Math.hypot( x - ox - cell / 2, y - oy - cell / 2 ) / ( cell / 2 );
			if ( r() < d * 0.9 ) continue;
			if ( r() < 0.08 ) leaf( x, y, r() * 6.28, 60 + r() * 40, 0.5 );
			else leaflet( x, y, r() * 6.28, 13 + r() * 6, 6 + r() * 2, 0.3 + r() * 0.7, r() );

		}

	}, 'locust-leaves' );

	const leaves = standard( {
		name: 'w1-tree-leaves', roughness: 0.62, alphaTest: 0.5, side: 'double', modules: [ commonModule ],
		textures: { w1Leaf: atlas },
		surface: /* wgsl */`
	// uv.y carries the card's colour: its whole part picks the autumn tint, the rest is the atlas
	let k = floor( in.uv.y * 0.25 );
	let uv = vec2f( in.uv.x, in.uv.y - k * 4.0 );
	let t = textureSample( w1Leaf, smpLinearClamp, uv );
	s.alpha = t.a;
	let h = fract( sin( vec3f( k * 12.9898, k * 78.233, k * 3.7 ) ) * 43758.5453 );
	// the card's tint, and each leaf's own shift between green and gold (G)
	let gold = vec3f( 0.44, 0.31, 0.045 );
	let green = vec3f( 0.12, 0.16, 0.035 );
	let brown = vec3f( 0.2, 0.11, 0.04 );
	var base = mix( green, gold, clamp( h.x * 1.3 - 0.1 + ( t.g - 0.5 ) * 0.6, 0.0, 1.0 ) );
	base = mix( base, brown, step( 0.86, h.y ) * 0.7 );
	var c = base * ( 0.55 + 0.6 * t.r );
	// the twigs
	c = mix( c, vec3f( 0.05, 0.035, 0.025 ), smoothstep( 0.6, 0.9, t.b ) );
	// the rain beads on them: a little darker, glossier (their own wetness: the scene's would make them
	// mirrors)
	s.albedo = c * mix( 1.0, 0.8, frame.wet );
	s.translucency = base * 0.2 * ( 1.0 - smoothstep( 0.6, 0.9, t.b ) );
	s.roughness = mix( 0.65, 0.45, frame.wet );
	// a leaf's sheen is faint (the night sky's glow shouldn't frost the crown)
	s.specularIntensity = 0.35;
`,
	} );
	leaves.setDefine( 'DRY', 1 );
	const bark = standard( {
		name: 'w1-tree-bark', color: new Color( 0.075, 0.062, 0.052 ), roughness: 0.9, modules: [ commonModule ],
		surface: /* wgsl */`
	// honey locust bark: grey-brown, in long plates split by darker furrows (uv: round, along in m)
	let f = mx_noise_float2( vec2f( in.uv.x * 9.0, in.uv.y * 1.6 ) );
	let furrow = smoothstep( 0.15, 0.45, abs( f ) );
	let lich = smoothstep( 0.55, 0.8, mx_noise_float2( in.uv * vec2f( 5.0, 3.0 ) + vec2f( 7.0 ) ) );
	var c = mat.color * mix( 0.45, 1.15, furrow ) * ( 0.85 + 0.3 * mx_noise_float2( in.uv * vec2f( 3.0, 20.0 ) ) );
	c = mix( c, vec3f( 0.14, 0.15, 0.12 ), lich * 0.35 );
	// the rain runs down the trunk: the whole of it dark and wet, not only what faces the sky
	let wet = frame.wet;
	s.albedo = c * mix( 1.0, 0.55, wet );
	s.roughness = mix( 0.9, 0.35, wet * furrow );
`,
	} );
	bark.setDefine( 'DRY', 1 ); // its own wetness (above)
	// the grates: cast iron, 1.5 m square, radial slots round the trunk's ring, soil and leaves under them
	const grate = standard( {
		name: 'w1-tree-grate', color: new Color( 0.045, 0.043, 0.04 ), roughness: 0.55, metalness: 0.6, modules: [ commonModule ],
		surface: /* wgsl */`
	let p = in.uv; // metres from the grate's middle
	let r = length( p );
	let a = atan2( p.y, p.x );
	let edge = max( abs( p.x ), abs( p.y ) );
	// concentric bands of slots, the spokes between them
	let band = fract( r / 0.14 );
	let spokes = abs( fract( a / 6.2832 * floor( 10.0 + r * 30.0 ) ) - 0.5 );
	let slot = step( 0.25, band ) * step( band, 0.75 ) * step( 0.12, spokes ) * step( 0.22, r ) * step( edge, 0.68 );
	let soil = vec3f( 0.035, 0.025, 0.018 ) * ( 0.7 + 0.5 * mx_noise_float2( p * 30.0 ) );
	var c = mix( mat.color * ( 0.8 + 0.4 * mx_noise_float2( p * 12.0 ) ), soil, slot );
	// rust in the recesses, bright worn iron on the high edges
	c = mix( c, vec3f( 0.12, 0.05, 0.02 ), smoothstep( 0.6, 0.9, mx_noise_float2( p * 8.0 + vec2f( 3.0 ) ) ) * 0.4 * ( 1.0 - slot ) );
	// the frame
	if ( edge > 0.7 ) { c = mat.color * 1.3; }
	s.albedo = c;
	s.metalness = select( 0.6, 0.0, slot > 0.5 );
	s.roughness = select( 0.5, 0.95, slot > 0.5 );
`,
	} );
	for ( const m of [ leaves, bark, grate ] ) m.underwaterLighting = 'none';
	_mats = { leaves, bark, grate, atlas };
	return _mats;

}

// Grow one tree at ( x, z ) (field frame, standing on y0) into the bark and leaf meshers.
//   o.h: height (m), o.trunk: the clear trunk's height, o.r: its radius at chest height, o.thin: how
//   much of the crown has dropped (0..1)
function grow( x, y0, z, seed, bark, leaves, o = {} ) {

	const r = rng( seed );
	const H = o.h ?? ( 5.6 + r() * 1.4 ), hT = o.trunk ?? ( 2.2 + r() * 0.5 ), R0 = o.r ?? ( 0.055 + r() * 0.02 );
	const thin = o.thin ?? 0.3;
	const lean = [ ( r() - 0.5 ) * 0.12, ( r() - 0.5 ) * 0.12 ];
	const add = ( a, b ) => [ a[ 0 ] + b[ 0 ], a[ 1 ] + b[ 1 ], a[ 2 ] + b[ 2 ] ];
	const mul = ( a, k ) => [ a[ 0 ] * k, a[ 1 ] * k, a[ 2 ] * k ];
	const norm = ( a ) => mul( a, 1 / ( Math.hypot( ...a ) || 1 ) );
	// the trunk, flared at the foot, a little crooked, up into the leader
	const trunk = [], tr = [];
	const nT = 7;
	for ( let i = 0; i <= nT; i ++ ) {

		const t = i / nT, yy = t * ( hT + 0.6 );
		const wob = Math.sin( t * 5 + seed ) * 0.025;
		trunk.push( [ x + lean[ 0 ] * yy + wob, y0 + yy - 0.05, z + lean[ 1 ] * yy - wob ] );
		tr.push( R0 * ( 1 + 0.55 * Math.exp( - yy * 9 ) ) * ( 1 - 0.3 * t ) );

	}

	bark.tube( trunk, tr, 7 );
	const top = trunk[ nT ];
	const cards = [];
	// a branch from p along dir, length L, base radius rb, level lv: a gently curving tube, its children
	// along it, leaf cards where it's thin
	const branch = ( p, dir, L, rb, lv ) => {

		const n = lv < 2 ? 4 : 2;
		const pts = [ p ], radii = [ rb ];
		let d = norm( dir ), q = p;
		// up toward the light as it goes, the thin ones drooping a little at the tips
		const bend = lv >= 3 ? - 0.12 : 0.18;
		for ( let i = 1; i <= n; i ++ ) {

			d = norm( add( d, [ ( r() - 0.5 ) * 0.25, bend, ( r() - 0.5 ) * 0.25 ] ) );
			q = add( q, mul( d, L / n ) );
			pts.push( q );
			radii.push( rb * ( 1 - i / n * 0.75 ) );

		}

		bark.tube( pts, radii, lv < 2 ? 5 : lv < 3 ? 4 : 3, { capB: lv < 3 } );
		if ( lv >= 3 || L < 0.45 ) {

			cards.push( [ q, d, lv ] );
			return;

		}

		// children from the outer part of the branch
		const kids = lv === 1 ? 3 + Math.floor( r() * 2 ) : 2 + Math.floor( r() * 2 );
		for ( let k = 0; k < kids; k ++ ) {

			const t = 0.35 + 0.6 * ( k + r() * 0.8 ) / kids;
			const i = Math.min( n - 1, Math.floor( t * n ) ), f = t * n - i;
			const at = add( pts[ i ], mul( add( pts[ i + 1 ], mul( pts[ i ], - 1 ) ), f ) );
			// off the parent at 30-55 degrees, round it by a golden turn
			const ang = 0.55 + r() * 0.4, rot = k * 2.4 + r();
			const side = norm( [ - d[ 2 ], 0, d[ 0 ] ] );
			const up = norm( [ d[ 1 ] * side[ 2 ] - d[ 2 ] * side[ 1 ], d[ 2 ] * side[ 0 ] - d[ 0 ] * side[ 2 ], d[ 0 ] * side[ 1 ] - d[ 1 ] * side[ 0 ] ] );
			const off = add( mul( side, Math.cos( rot ) ), mul( up, Math.sin( rot ) ) );
			const cd = norm( add( mul( d, Math.cos( ang ) ), mul( off, Math.sin( ang ) ) ) );
			branch( at, cd, L * ( 0.5 + r() * 0.2 ) * ( 1 - t * 0.3 ), radii[ i ] * 0.6, lv + 1 );

		}

		// leaves along the outer half of the limbs too
		if ( lv >= 2 ) for ( let i = 1; i < n; i ++ ) cards.push( [ pts[ i ], d, lv ] );
		else cards.push( [ pts[ n - 1 ], d, lv ] );

	};

	// the scaffold limbs: a vase of 4-6 from the top of the clear trunk
	const nS = 4 + Math.floor( r() * 3 );
	for ( let k = 0; k < nS; k ++ ) {

		const t = k / nS;
		const yy = hT - 0.1 + t * 1.3 + r() * 0.3;
		const base = [ x + lean[ 0 ] * yy, y0 + yy, z + lean[ 1 ] * yy ];
		const az = k * 2.39996 + r() * 0.5 + seed;
		const el = 0.65 + r() * 0.45; // radians above the horizontal
		const dir = [ Math.cos( az ) * Math.cos( el ), Math.sin( el ), Math.sin( az ) * Math.cos( el ) ];
		branch( base, dir, ( H - hT ) * ( 0.55 + r() * 0.25 ), R0 * ( 0.6 - t * 0.15 ), 1 );

	}

	// the leader
	branch( top, [ lean[ 0 ] * 2, 1, lean[ 1 ] * 2 ], H - hT - 0.4, R0 * 0.6, 1 );

	// the leaf cards: a cluster of crossed sprays at each tip, fewer where the crown has thinned
	for ( const [ p0, d ] of cards ) {

		const nc = r() < thin ? 3 : 4;
		for ( let c = 0; c < nc; c ++ ) {

			const s = 0.85 + r() * 0.55;
			const p = add( p0, [ ( r() - 0.5 ) * 0.4, ( r() - 0.5 ) * 0.3, ( r() - 0.5 ) * 0.4 ] );
			const tint = Math.floor( r() * 64 ) * 4;
			const cell = Math.floor( r() * 3 );
			const u0 = ( cell % 2 ) * 0.5, v0 = Math.floor( cell / 2 ) * 0.5;
			// the card: its spine along the branch's end (tilted out and down), turned about it
			const along = norm( add( d, [ 0, - 0.35, 0 ] ) );
			const rot = r() * Math.PI + c * Math.PI / 2;
			const side0 = norm( [ - along[ 2 ], 0, along[ 0 ] ] );
			const up0 = norm( [ along[ 1 ] * side0[ 2 ] - along[ 2 ] * side0[ 1 ], along[ 2 ] * side0[ 0 ] - along[ 0 ] * side0[ 2 ], along[ 0 ] * side0[ 1 ] - along[ 1 ] * side0[ 0 ] ] );
			const w = add( mul( side0, Math.cos( rot ) ), mul( up0, Math.sin( rot ) ) );
			const nrm = norm( [ along[ 1 ] * w[ 2 ] - along[ 2 ] * w[ 1 ], along[ 2 ] * w[ 0 ] - along[ 0 ] * w[ 2 ], along[ 0 ] * w[ 1 ] - along[ 1 ] * w[ 0 ] ] );
			// the normal bent up, so the crown lights like a crown and not like cards
			const nb = norm( add( nrm, [ 0, 0.8, 0 ] ) );
			const b0 = add( p, mul( along, - s * 0.15 ) ), b1 = add( p, mul( along, s * 0.85 ) );
			const A = add( b0, mul( w, - s / 2 ) ), B = add( b0, mul( w, s / 2 ) ), C = add( b1, mul( w, s / 2 ) ), D = add( b1, mul( w, - s / 2 ) );
			const vv = ( y ) => v0 + y * 0.5 + tint;
			const ia = leaves.v( A, nb, [ u0, vv( 1 ) ] ), ib = leaves.v( B, nb, [ u0 + 0.5, vv( 1 ) ] ), ic = leaves.v( C, nb, [ u0 + 0.5, vv( 0 ) ] ), id = leaves.v( D, nb, [ u0, vv( 0 ) ] );
			leaves.quad( ia, ib, ic, id );

		}

	}

}

// The trees: [ [ x, z, seed?, opts? ], ... ] in the field frame, on the street. Returns the meshes
// (added to `group`) and the grates.
export function plantTrees( group, spots, { grates = true, fallen = true, shadows = true } = {} ) {

	const M = materials();
	const bark = new Mesher(), leaves = new Mesher(), grate = new Mesher(), ground = new Mesher();
	const y0 = STREET + LIFT; // on the raised plaza and sidewalks
	spots.forEach( ( [ x, z, seed, o ], i ) => {

		const s = seed ?? Math.round( Math.abs( x * 13.1 + z * 7.7 ) ) + i;
		grow( x, y0, z, s, bark, leaves, o );
		if ( grates ) {

			// the grate, square to the street, a little proud of the paving
			const g = 0.75;
			grate.face( [ x - g, y0 + 0.035, z - g ], [ x + g, y0 + 0.035, z - g ], [ x + g, y0 + 0.035, z + g ], [ x - g, y0 + 0.035, z + g ], [ 0, 1, 0 ], [ [ - g, - g ], [ g, - g ], [ g, g ], [ - g, g ] ] );

		}

		if ( fallen ) {

			// fallen leaflets stuck to the wet paving: patches thick near the trunk, a few blown further
			const r = rng( s * 3 + 1 );
			const n = 7 + Math.floor( r() * 5 );
			for ( let k = 0; k < n; k ++ ) {

				const a = r() * Math.PI * 2, d = 0.4 + Math.pow( r(), 1.6 ) * 3.2, sz = 0.5 + r() * 0.5;
				const px = x + Math.cos( a ) * d, pz = z + Math.sin( a ) * d, rot = r() * 6.28;
				const c = Math.cos( rot ) * sz / 2, sn = Math.sin( rot ) * sz / 2;
				const tint = Math.floor( r() * 64 ) * 4;
				const yy = y0 + 0.04 + k * 0.0004;
				const P = ( i, j ) => [ px + i * c - j * sn, yy, pz + i * sn + j * c ];
				ground.face( P( - 1, - 1 ), P( 1, - 1 ), P( 1, 1 ), P( - 1, 1 ), [ 0, 1, 0 ], [ [ 0.5, 0.5 + tint ], [ 1, 0.5 + tint ], [ 1, 1 + tint ], [ 0.5, 1 + tint ] ] );

			}

		}

	} );

	const out = [];
	for ( const [ m, mat, name, cast ] of [ [ bark, M.bark, 'w1-trees-bark', shadows ], [ leaves, M.leaves, 'w1-trees-leaves', shadows ], [ grate, M.grate, 'w1-tree-grates', false ], [ ground, M.leaves, 'w1-fallen-leaves', false ] ] ) {

		if ( ! m.count ) continue;
		const mesh = new Mesh( m.geometry(), mat );
		mesh.name = name;
		mesh.castShadow = cast;
		mesh.receiveShadow = true;
		group.add( mesh );
		out.push( mesh );

	}

	return out;

}

// the autumn colours, for anything else that wants them
export { AUTUMN, grow };
