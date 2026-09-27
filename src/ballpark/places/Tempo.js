import { GPU } from '../../engine/gpu/GPU.js';

// ---- H (wave 3): the people-CPU tune-up. How often a place's people need moving.
//
// The pool (Cast.js) knows, each frame it's drawn, who it drew and how big: p.lod (0 near, 1 far, 2 a few
// pixels tall, -1 not at all) and each troupe's t.drawn. Nobody can tell whether someone they can't see was
// moved this frame or three frames ago, so a place's people are simulated at the full rate only while some
// of them are seen; while none are (the view's elsewhere, or the place isn't drawn: ?only=), every 4th
// frame, with the time since (the clockwork keeps up; the walkers walk as far). The sleeping places take
// turns, so they don't all wake on the same frame.
//
//   const tempo = new Tempo( [ cast, ... ], { every: 4 } )
//   const sdt = tempo.step( dt, camera )    this frame's step: dt (plus the time skipped) when due, else 0
//   tempo.awake                             whether any of its people were seen (or the view just cut)
//   tempo.cut                               the view has just jumped: everyone moved this frame (the pool's
//                                           p.lod is last view's), none left behind
//
// And one person at a time (the places that move each one themselves), by what the pool drew last frame:
//
//   cadence( p, d2 ) 1 seen, 3 a few pixels tall (or over 35 m off and small), 6 a dozen pixels, 4 unseen
//                    (6 over 40 m off)
//   due( p, n, frame )   whether p moves on this frame, one frame in n (spread over the slots)
//
// A person who comes into view is drawn once with the pose they last had (at most a few frames old: a
// step of a few centimetres at the edge of the screen), and moved every frame from the next. A cut or a
// swing of the camera wakes every place for that frame.
let SEQ = 0;
const view = { frame: - 1, cut: true, x: 0, y: 0, z: 0, fx: 0, fy: 0, fz: - 1, fov: 0 };

// has the view jumped since last frame (a cut to another camera, a seek, a quick turn)?
export function viewCut( camera ) {

	if ( view.frame === GPU.frame ) return view.cut;
	view.frame = GPU.frame;
	if ( ! camera ) return ( view.cut = true );
	const P = camera.position, Q = camera.quaternion;
	const x = Q.x, y = Q.y, z = Q.z, w = Q.w;
	// where it looks: -z turned by the camera's rotation
	const fx = - 2 * ( x * z + w * y ), fy = - 2 * ( y * z - w * x ), fz = - ( 1 - 2 * ( x * x + y * y ) );
	const dx = P.x - view.x, dy = P.y - view.y, dz = P.z - view.z;
	const fov = camera.fov || 0;
	view.cut = dx * dx + dy * dy + dz * dz > 4 || fx * view.fx + fy * view.fy + fz * view.fz < 0.99 || Math.abs( fov - view.fov ) > 2;
	view.x = P.x; view.y = P.y; view.z = P.z;
	view.fx = fx; view.fy = fy; view.fz = fz;
	view.fov = fov;
	return view.cut;

}

export class Tempo {

	constructor( troupes, { every = 4 } = {} ) {

		this.troupes = troupes.filter( Boolean );
		this.every = every;
		this.n = SEQ ++;
		this.acc = 0;
		this.frame = 0;
		this.awake = true;

	}

	// any of its people drawn last frame (or the view has just jumped)?
	seen( camera ) {

		if ( viewCut( camera ) ) return true;
		for ( const t of this.troupes ) if ( t.drawn > 0 || ! t.pool?.group ) return true;
		return false;

	}

	step( dt, camera ) {

		this.frame ++;
		this.acc += dt;
		// (a cut: everyone caught up now, whatever the pool drew last frame; see cadence())
		this.cut = viewCut( camera );
		this.awake = this.seen( camera );
		if ( ! this.awake && ( this.frame + this.n ) % this.every ) return 0;
		const s = this.acc;
		this.acc = 0;
		return s;

	}

}

// how often (in frames) someone needs moving, by how the pool drew them last frame: the unseen every 4th
// (every 6th over 40 m off); under a fiftieth of the screen's height (a dozen pixels: a step of theirs is a
// fraction of a pixel a frame) every 6th; the few pixels tall every 3rd, and (P0's rule in the concourse)
// those over 35 m off every 3rd, unless the lens makes them big (the TV's long lens sees the rows behind home
// plate from 150 m at a tenth of the screen: every frame). d2: their distance from the camera squared
// (along the ground)
export function cadence( p, d2 = 0 ) {

	const lod = p.lod ?? 0;
	if ( lod < 0 ) return d2 > 40 * 40 ? 6 : 4;
	const frac = p.frac ?? 1;
	if ( frac < 0.02 ) return 6;
	if ( lod === 2 ) return 3;
	return d2 > 35 * 35 && frac < 0.08 ? 3 : 1;

}

export function due( p, n, frame ) {

	return n <= 1 || ( frame + p.slot ) % n === 0;

}
