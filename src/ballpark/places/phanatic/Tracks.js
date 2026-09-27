import { Mesh, BufferGeometry, Float32BufferAttribute, Color } from '../../../engine/index.js';
import { standard } from '../../../materials/Materials.js';
import { pointInPolygon } from '../../Bowl.js';

// The tracks his wheels leave: the four-wheeler's turf tyres in the wet clay of the warning track on the
// 27th and across the left field grass on the 29th ("all of those tire tracks he leaves in the grass", a
// 2009 caption; the curved tracks in flickr 2980316108, October 26), the Gator's down the right field
// line. Each wheel's path is laid down as a strip when the plan is compiled (sampled from it), and every
// bit of it carries when it was made and when it's gone: the shader shows it only between the two, so
// the tracks grow behind the wheels as they pass and scrubbing shows the same thing. The 27th's soften in
// the rain and are raked out with the suspension; the 29th's stay to the end.
//
//   const tr = new Tracks( parent, field );
//   tr.build( [ { samples: [ { t, x, z, yaw } ], track, wheelbase, width, end } ] );  tr.update( t )

export class Tracks {

	constructor( parent, field ) {

		this.parent = parent;
		this.boundary = field?.boundary || null;
		this.material = standard( {
			name: 'phanatic-tyre-tracks', color: new Color( 0, 0, 0 ), roughness: 0.9, transparent: true, depthWrite: false,
			uniforms: { now: [ 'f32', 0 ] },
			attributes: { aTrack: 'vec2f' },
			varyings: { vTrack: 'vec2f' },
			vertex: 'o.vTrack = v.aTrack;',
			surface: /* wgsl */`
	// made at vTrack.x, gone at vTrack.y; fresh and dark, then softening (the rain on the 27th)
	let made = in.vs.vTrack.x;
	let gone = in.vs.vTrack.y;
	let age = mat.now - made;
	let shown = select( 0.0, 1.0, age >= 0.0 && mat.now <= gone );
	// the turf tread: shallow bars across the width, the edges feathered
	let across = abs( in.uv.y - 0.5 ) * 2.0;
	let bars = 0.7 + 0.3 * step( 0.5, fract( in.uv.x * 16.0 ) );
	let edge = 1.0 - smoothstep( 0.6, 1.0, across );
	let fade = mix( 1.0, 0.45, smoothstep( 0.0, 900.0, age ) ) * ( 1.0 - 0.5 * frame.wet * smoothstep( 0.0, 600.0, age ) );
	s.albedo = vec3f( 0.0 );
	s.alpha = 0.26 * bars * edge * fade * shown;
` } );
		this.material.underwaterLighting = 'none';
		this.mesh = null;

	}

	// runs: each { samples: [ { t, x, z, yaw } ], track (m between the left and right wheels), wheelbase
	// (m, the front axle ahead of the back one), axleBack (m behind the origin), width (the tyre's), end }
	build( runs ) {

		const pos = [], nrm = [], uv = [], tr = [], index = [];
		const inside = ( x, z ) => ! this.boundary || pointInPolygon( x, z, this.boundary );
		for ( const run of runs ) {

			const { samples, track, wheelbase, axleBack, width, end } = run;
			// the four wheels (left and right, front and back)
			for ( const [ side, ax ] of [ [ - 1, axleBack ], [ 1, axleBack ], [ - 1, axleBack - wheelbase ], [ 1, axleBack - wheelbase ] ] ) {

				let prev = null, along = 0;
				for ( const s of samples ) {

					const c = Math.cos( s.yaw ), sn = Math.sin( s.yaw );
					// the wheel's contact in the field frame (the vehicle's +x its right, +z behind)
					const lx = side * track / 2, lz = ax;
					const x = s.x + lx * c + lz * sn, z = s.z - lx * sn + lz * c;
					const ok = inside( x, z );
					if ( prev && ok && prev.ok && Math.hypot( x - prev.x, z - prev.z ) > 0.02 ) {

						const d = Math.hypot( x - prev.x, z - prev.z );
						const r = [ c * width / 2, - sn * width / 2 ];
						const base = pos.length / 3;
						for ( const [ q, a ] of [ [ prev, along ], [ { x, z, t: s.t, r }, along + d ] ] ) {

							const rr = q.r || r;
							pos.push( q.x - rr[ 0 ], 0.012, q.z - rr[ 1 ], q.x + rr[ 0 ], 0.012, q.z + rr[ 1 ] );
							nrm.push( 0, 1, 0, 0, 1, 0 );
							uv.push( a, 0, a, 1 );
							tr.push( q.t, end, q.t, end );

						}

						index.push( base, base + 1, base + 2, base + 1, base + 3, base + 2 );
						along += d;

					}

					prev = { x, z, t: s.t, ok, r: [ c * width / 2, - sn * width / 2 ] };

				}

			}

		}

		if ( ! pos.length ) return;
		const g = new BufferGeometry();
		g.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
		g.setAttribute( 'normal', new Float32BufferAttribute( nrm, 3 ) );
		g.setAttribute( 'uv', new Float32BufferAttribute( uv, 2 ) );
		g.setAttribute( 'aTrack', new Float32BufferAttribute( tr, 2 ) );
		g.setIndex( index );
		g.computeBoundingSphere();
		this.mesh = new Mesh( g, this.material );
		this.mesh.name = 'phanatic-tyre-tracks';
		this.mesh.receiveShadow = true;
		this.mesh.userData.dynamic = true;
		this.mesh.layers.set( 2 );
		this.parent.add( this.mesh );
		this.triangles = index.length / 3;

	}

	update( t ) {

		this.material.uniforms.now.value = t;

	}

}
