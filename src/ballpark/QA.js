import { GPU } from '../engine/gpu/GPU.js';

// Shots on demand, for the render desk (tools/gpu/desk.mjs) and by hand in the console: window.__qa.
//
// With ?still the render loop never starts, so a page that has loaded draws nothing until a shot asks
// for frames (the GPU is shared: a page waiting in a tab should cost nothing). Set up the view, then
// still() renders the frames a shot needs and stops:
//
//   __qa.look( [ 12, 1.6, 30 ], [ 0, 1, 0 ], 50 )   eye and target in the field frame (x, z metres
//                                                   from home plate, -z toward center field; y above
//                                                   the field), and the vertical fov in degrees
//   __qa.camera( 'center' )                         a TV camera: center, high, follow (or walk)
//   __qa.seek( 1234 ) / __qa.play( 57 )             the replay at t seconds / at its 57th play
//   __qa.hour( 21 )                                 the time of day
//   __qa.clean()                                    hide the HUD and overlays
//   await __qa.still()                              render until the image settles, then stop
export class QA {

	constructor( app ) {

		this.app = app;
		this.loadMs = Math.round( performance.now() );

	}

	look( eye, target, fov ) {

		const a = this.app, F = a.field;
		if ( a.camMode && a.camMode !== 'walk' ) a.cycleCamera( 'walk' );
		if ( ! a.freeCam ) a.setFreeCam( true );
		const p = F.toWorld( eye[ 0 ], eye[ 2 ] ), q = F.toWorld( target[ 0 ], target[ 2 ] );
		const P = [ p.x, F.y0 + eye[ 1 ], p.z ], Q = [ q.x, F.y0 + target[ 1 ], q.z ];
		const dx = Q[ 0 ] - P[ 0 ], dy = Q[ 1 ] - P[ 1 ], dz = Q[ 2 ] - P[ 2 ];
		a.fly.setPose( a.camera.position.clone().set( ...P ), Math.atan2( - dx, - dz ), Math.atan2( dy, Math.hypot( dx, dz ) ) );
		a.fly.velocity.set( 0, 0, 0 );
		if ( fov ) {

			a.camera.fov = fov;
			a.camera.updateProjectionMatrix();

		}

		a.post?.cut();
		return this;

	}

	camera( mode ) {

		this.app.cycleCamera( mode );
		return this;

	}

	seek( t, play = false ) {

		const d = this.app.director;
		if ( ! d ) return this;
		d.seek( t );
		d.playing = play;
		return this;

	}

	play( i, play = false ) {

		const d = this.app.director;
		return d ? this.seek( d.timeOfPlay( i ), play ) : this;

	}

	hour( h ) {

		this.app.settings.timeOfDay = h;
		return this;

	}

	clean( on = true ) {

		for ( const el of document.querySelectorAll( '.tw-root, .gm-hud, .tw-start, #fps' ) ) el.style.visibility = on ? 'hidden' : '';
		return this;

	}

	// Render `frames` frames (at most two in flight) and stop: enough for the temporal filters to settle
	// and the TV cameras to ease onto their target. hold: the replay is paused meanwhile (the image holds
	// still). From a clean start (cut), so the last shot doesn't bleed in.
	async still( { frames = 32, dt = 1 / 60, hold = true, cut = true } = {} ) {

		const a = this.app, d = a.director;
		const looping = !! a.running;
		if ( looping ) a.engine.stop();
		const was = d?.playing;
		if ( hold && d ) d.playing = false;
		if ( cut ) a.post?.cut();
		try {

			let pending = null;
			for ( let i = 0; i < frames; i ++ ) {

				a.frame( dt );
				const done = GPU.queue.onSubmittedWorkDone();
				if ( pending ) await pending;
				pending = done;

			}

			await pending;

		} finally {

			if ( hold && d ) d.playing = was;
			if ( looping ) a.start();

		}

		return this;

	}

	// GPU time per frame and the costliest passes (timestamp queries, captured as core/Bench.js does):
	// `warm` frames to settle, then `frames` measured back to back, the replay paused. For the
	// coordinator, under the GPU lock's exclusive mode (a desk job with "exclusive": true): with anything
	// else rendering the numbers are noise.
	async profile( { frames = 120, warm = 40, dt = 1 / 60, top = 14 } = {} ) {

		const { Bench } = await import( '../core/Bench.js' );
		const b = this._bench || ( this._bench = new Bench( this.app ) );
		if ( ! b.enabled ) return { error: 'no timestamp queries on this GPU' };
		const d = this.app.director, was = d?.playing;
		if ( d ) d.playing = false;
		try {

			await b._frames( warm, dt );
			b.frames = [];
			b._capture = true;
			const t0 = performance.now();
			await b._frames( frames, dt );
			const wall = ( performance.now() - t0 ) / frames;
			b._capture = false;
			for ( let k = 0; k < 50 && b.frames.length < frames; k ++ ) await new Promise( ( r ) => setTimeout( r, 20 ) );
			const fs = b.frames.slice();
			const gpus = fs.map( ( f ) => f.gpu ).sort( ( x, y ) => x - y );
			const passes = new Map();
			for ( const f of fs ) for ( const [ k, v ] of f.passes ) passes.set( k, ( passes.get( k ) || 0 ) + v / fs.length );
			const r2 = ( v ) => Math.round( v * 100 ) / 100;
			return {
				gpu: r2( gpus.reduce( ( x, y ) => x + y, 0 ) / gpus.length ), gpuMedian: r2( gpus[ gpus.length >> 1 ] ), wall: r2( wall ), cpu: r2( this.app.cpuMs ), frames: fs.length,
				passes: Object.fromEntries( [ ...passes ].sort( ( x, y ) => y[ 1 ] - x[ 1 ] ).slice( 0, top ).map( ( [ k, v ] ) => [ k, r2( v ) ] ) ),
			};

		} finally {

			b._capture = false;
			if ( d ) d.playing = was;

		}

	}

	// what was built and how long it took
	info() {

		const a = this.app;
		return {
			loadMs: this.loadMs, buildMs: a.buildMs, only: a.scope?.only ? [ ...a.scope.only ] : null, focus: a.scope?.focus || null,
			fans: a.bowl?.crowd?.count || 0, size: [ a.engine.canvas.width, a.engine.canvas.height ],
		};

	}

}
