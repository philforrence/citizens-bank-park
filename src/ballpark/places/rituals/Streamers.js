import { Mesh, BufferGeometry, Float32BufferAttribute, Color } from '../../../engine/index.js';
import { standard } from '../../../materials/Materials.js';

// ---- FR1: the streamers on the outfield grass after the last out (wave 3's R.md, the celebration's small
// true things): Getty 83570999 has a long white paper streamer lying across the right field grass behind
// the stage, and scraps of red by the right field wall; Getty 83486531 the banners and shirts the fans
// passed down at the track. Long ribbons of white paper lying where they came down, wandering and
// twisted, a few short red ones crumpled by the wall, two out in left. They come down with the
// fireworks at the out and lie there the rest of the night. One draw, nothing per frame.
//
// [ from, to, width, wiggles, red ] in the field frame (x toward first, -z toward center)
const STREAMERS = [
	[ [ 24, - 50 ], [ 43, - 59 ], 0.13, 3, 0 ], [ [ 30, - 69 ], [ 37, - 74 ], 0.1, 1.5, 0 ], [ [ 44, - 50 ], [ 50, - 57 ], 0.11, 2, 0 ],
	[ [ 13, - 61 ], [ 21, - 64 ], 0.1, 2, 0 ], [ [ 55, - 70 ], [ 58, - 79 ], 0.12, 2, 0 ], [ [ 6, - 72 ], [ 11, - 75 ], 0.09, 1.5, 0 ],
	[ [ 36, - 85 ], [ 44, - 88 ], 0.12, 2, 0 ], [ [ 60.6, - 78 ], [ 62, - 79 ], 0.16, 1, 1 ], [ [ 51.4, - 87.2 ], [ 52.8, - 88 ], 0.18, 1, 1 ],
	[ [ 40.8, - 97.8 ], [ 42.2, - 98.6 ], 0.15, 1, 1 ], [ [ 54.9, - 83.7 ], [ 55.9, - 84.6 ], 0.14, 1, 1 ], [ [ - 30, - 60 ], [ - 23, - 66 ], 0.11, 2, 0 ],
	[ [ - 46, - 70 ], [ - 41, - 73 ], 0.1, 1.5, 0 ], [ [ 18, - 92 ], [ 28, - 95 ], 0.12, 2.5, 0 ],
];

const hash = ( n ) => {

	const s = Math.sin( n * 12.9898 ) * 43758.5453;
	return s - Math.floor( s );

};

function streamersGeometry() {

	const pos = [], nrm = [], uv = [], idx = [];
	STREAMERS.forEach( ( [ a, b, w, wig, red ], si ) => {

		const dx = b[ 0 ] - a[ 0 ], dz = b[ 1 ] - a[ 1 ], L = Math.hypot( dx, dz );
		const ux = dx / L, uz = dz / L, nx = - uz, nz = ux;
		const n = Math.max( 6, Math.ceil( L / 0.35 ) ), base = pos.length / 3;
		for ( let i = 0; i <= n; i ++ ) {

			const t = i / n;
			// wandering off its line, and twisting over now and then (a crease, the edge up a little)
			const off = Math.sin( t * Math.PI * wig + si * 1.7 ) * L * 0.07 + Math.sin( t * 23 + si ) * 0.05;
			const cx = a[ 0 ] + dx * t + nx * off, cz = a[ 1 ] + dz * t + nz * off;
			// (bunched: crepe paper lies in loose folds, its edges standing up, a hand's width and more;
			// flat it was a line you couldn't see from the field)
			const tw = ( Math.sin( t * L * 1.3 + si * 2.1 ) * 0.7 + Math.sin( t * L * 3.7 + si ) * 0.5 ) * ( red ? 1.6 : 1 );
			const hw = w * ( red ? 0.5 + 0.3 * hash( si * 7 + i ) : 0.9 + 0.5 * hash( si * 5 + i * 0.3 ) );
			const ex = nx * Math.cos( tw ) * hw, ez = nz * Math.cos( tw ) * hw, ey = Math.abs( Math.sin( tw ) ) * hw;
			const y = 0.012 + 0.03 * hash( si * 3.3 + i * 0.7 ) * ( red ? 2 : 1 );
			pos.push( cx - ex, y, cz - ez, cx + ex, y + ey, cz + ez );
			nrm.push( 0, 1, 0, 0, 1, 0 );
			uv.push( t * L, red, t * L, red );

		}

		for ( let i = 0; i < n; i ++ ) {

			// (wound to face up: the other way the double-sided material lit them from underneath, grey)
			const p = base + i * 2;
			idx.push( p, p + 1, p + 2, p + 1, p + 3, p + 2 );

		}

	} );
	const g = new BufferGeometry();
	g.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
	g.setAttribute( 'normal', new Float32BufferAttribute( nrm, 3 ) );
	g.setAttribute( 'uv', new Float32BufferAttribute( uv, 2 ) );
	g.setIndex( idx );
	g.computeBoundingSphere();
	return g;

}

export class Streamers {

	constructor( group ) {

		const mat = standard( {
			name: 'rituals-streamers', color: new Color( 0.78, 0.78, 0.75 ), roughness: 0.9, side: 'double',
			// white crepe paper (a little grey where it's creased, damp off the grass), or red; lit a touch at
			// night as the field's whites are
			surface: /* wgsl */`
	let crease = 0.88 + 0.12 * sin( in.uv.x * 41.0 ) * sin( in.uv.x * 7.0 );
	s.albedo = select( mat.color, vec3f( 0.45, 0.02, 0.03 ), in.uv.y > 0.5 ) * crease;
	s.emissive = s.albedo * smoothstep( 0.2, 0.8, frame.night ) * 0.12;
`,
		} );
		mat.underwaterLighting = 'none';
		this.mesh = new Mesh( streamersGeometry(), mat );
		this.mesh.name = 'rituals-streamers';
		this.mesh.receiveShadow = true;
		this.mesh.castShadow = false;
		this.mesh.visible = false;
		this.mesh.userData.dynamic = true;
		group.add( this.mesh );

	}

	// cel: seconds since the last out (null otherwise)
	update( cel ) {

		this.mesh.visible = cel != null && cel > 4;

	}

}
