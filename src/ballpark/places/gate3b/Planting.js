import { Mesh } from '../../../engine/index.js';
import { commonModule } from '../../../engine/render/wgsl/common.js';
import { standard } from '../../../materials/Materials.js';
import { Mesher, rng } from './Mesher.js';

// The plaza's planters in October 2008 (Getty 94930675, 20 Oct 2008; Flickr u2rob April 2008 and
// beauwhite 2007: curved raised beds on low red walls, "fountain grass and seasonal flowers"): each round
// bed filled with clumps of fountain grass gone buff and plum, mounds of fall mums (rust, gold, purple,
// white) and low evergreen shrubs; round 1 had a few smooth spheres there.
//
// A plant is a handful of cards: grass blades, leaf clusters, flower heads; one mesh, one material, the
// kind in uv.x (0 grass, 0.5 leaves, 1 + the mum's colour).

export function plantBeds( group, beds, seed = 3 ) {

	const r = rng( seed ), m = new Mesher();
	for ( const [ x, z, R, y ] of beds ) {

		const n = Math.round( R * R * 11 );
		for ( let i = 0; i < n; i ++ ) {

			const a = r() * Math.PI * 2, d = Math.sqrt( r() ) * ( R - 0.45 );
			const px = x + Math.cos( a ) * d, pz = z + Math.sin( a ) * d, u = r();
			if ( u < 0.4 ) {

				// fountain grass: arching blades from a clump
				const s = 0.8 + r() * 0.5;
				for ( let k = 0; k < 14; k ++ ) {

					const q = r() * Math.PI * 2, lean = 0.3 + r() * 0.5, len = ( 0.55 + r() * 0.35 ) * s;
					const tip = [ px + Math.cos( q ) * lean * len, y + len * ( 1 - lean * 0.4 ), pz + Math.sin( q ) * lean * len ];
					const w = [ - Math.sin( q ) * 0.012, 0, Math.cos( q ) * 0.012 ];
					m.face( [ px - w[ 0 ], y, pz - w[ 2 ] ], [ px + w[ 0 ], y, pz + w[ 2 ] ], [ tip[ 0 ] + w[ 0 ] * 0.3, tip[ 1 ], tip[ 2 ] + w[ 2 ] * 0.3 ], [ tip[ 0 ] - w[ 0 ] * 0.3, tip[ 1 ], tip[ 2 ] - w[ 2 ] * 0.3 ], [ Math.cos( q ), 0.6, Math.sin( q ) ], [ [ 0.02, 0 ], [ 0.02, 0 ], [ 0.02, 1 ], [ 0.02, 1 ] ] );

				}

			} else {

				// a mound: a mum covered in flowers, or a low shrub; little faces over a dome
				const mum = u < 0.75, col = 1 + Math.floor( r() * 4 ) * 0.2 + 0.05;
				const R2 = mum ? 0.24 + r() * 0.1 : 0.32 + r() * 0.12;
				for ( let k = 0; k < ( mum ? 26 : 16 ); k ++ ) {

					const q = r() * Math.PI * 2, ph = r() * 1.2, sz = mum ? 0.13 : 0.2;
					const c = [ px + Math.cos( q ) * Math.sin( ph ) * R2, y + Math.cos( ph ) * R2 * 0.8, pz + Math.sin( q ) * Math.sin( ph ) * R2 ];
					const nrm = [ Math.cos( q ) * Math.sin( ph ), Math.cos( ph ), Math.sin( q ) * Math.sin( ph ) ];
					const t1 = [ - Math.sin( q ) * sz, 0, Math.cos( q ) * sz ], t2 = [ - Math.cos( q ) * Math.cos( ph ) * sz, Math.sin( ph ) * sz, - Math.sin( q ) * Math.cos( ph ) * sz ];
					const uvk = mum ? col : 0.5;
					m.face( [ c[ 0 ] - t1[ 0 ] - t2[ 0 ], c[ 1 ] - t2[ 1 ], c[ 2 ] - t1[ 2 ] - t2[ 2 ] ], [ c[ 0 ] + t1[ 0 ] - t2[ 0 ], c[ 1 ] - t2[ 1 ], c[ 2 ] + t1[ 2 ] - t2[ 2 ] ], [ c[ 0 ] + t1[ 0 ] + t2[ 0 ], c[ 1 ] + t2[ 1 ], c[ 2 ] + t1[ 2 ] + t2[ 2 ] ], [ c[ 0 ] - t1[ 0 ] + t2[ 0 ], c[ 1 ] + t2[ 1 ], c[ 2 ] - t1[ 2 ] + t2[ 2 ] ], nrm, [ [ uvk, 0 ], [ uvk, 0 ], [ uvk, 1 ], [ uvk, 1 ] ] );

				}

			}

		}

		// the soil between them, dark and wet, a scatter of mulch
		const ring = [];
		for ( let k = 0; k < 20; k ++ ) {

			const q = k / 20 * Math.PI * 2;
			ring.push( m.v( [ x + Math.cos( q ) * ( R - 0.34 ), y - 0.03, z + Math.sin( q ) * ( R - 0.34 ) ], [ 0, 1, 0 ], [ 3.5, 0.5 ] ) );

		}

		const c0 = m.v( [ x, y - 0.03, z ], [ 0, 1, 0 ], [ 3.5, 0.5 ] );
		for ( let k = 0; k < 20; k ++ ) m.tri( c0, ring[ ( k + 1 ) % 20 ], ring[ k ] );

	}

	const mat = standard( { name: 'w1-planting', roughness: 0.8, side: 'double', modules: [ commonModule ],
		surface: /* wgsl */`
	// uv.x: grass (buff to plum as it goes up), leaves (a dark evergreen), a mum (rust, gold, purple,
	// white), the soil (bark mulch)
	let k = in.uv.x;
	let n = mx_noise_float3( in.P * 9.0 );
	var c = mix( vec3f( 0.3, 0.24, 0.12 ), vec3f( 0.18, 0.08, 0.1 ), smoothstep( -0.3, 0.5, n ) ) * ( 0.6 + 0.5 * in.uv.y );
	if ( k > 0.3 ) { c = vec3f( 0.035, 0.07, 0.03 ) * ( 0.7 + 0.5 * n ); }
	if ( k > 0.9 ) {
		let f = fract( k );
		c = vec3f( 0.42, 0.12, 0.03 );
		if ( f > 0.2 ) { c = vec3f( 0.6, 0.42, 0.04 ); }
		if ( f > 0.4 ) { c = vec3f( 0.25, 0.05, 0.22 ); }
		if ( f > 0.6 ) { c = vec3f( 0.75, 0.73, 0.68 ); }
		c = c * ( 0.75 + 0.4 * n );
	}
	if ( k > 3.0 ) { c = vec3f( 0.07, 0.04, 0.025 ) * ( 0.7 + 0.5 * mx_noise_float3( in.P * 25.0 ) ); }
	s.albedo = c * mix( 1.0, 0.8, frame.wet );
	s.translucency = select( c * 0.2, vec3f( 0.0 ), k > 3.0 );
	s.roughness = mix( 0.8, 0.45, frame.wet );
` } );
	mat.setDefine( 'DRY', 1 );
	mat.underwaterLighting = 'none';
	const mesh = new Mesh( m.geometry(), mat );
	mesh.name = 'w1-planting';
	mesh.receiveShadow = true;
	group.add( mesh );
	return mesh;

}
