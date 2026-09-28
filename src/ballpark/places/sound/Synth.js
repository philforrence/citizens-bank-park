import { JOBS } from './Recipes.js';

// The soundscape's made sounds, made off the main thread: synth.make( name, sampleRate ) asks the worker
// (synth.worker.js) for a recipe (Recipes.js JOBS) and resolves to its AudioBuffers. Without workers
// (Node's test), the recipe runs here, a tick later.
export class Synth {

	constructor( ctx ) {

		this.ctx = ctx;
		this.jobs = new Map();
		this.id = 0;
		this.worker = null;
		if ( typeof Worker !== 'undefined' ) {

			try {

				this.worker = new Worker( new URL( './synth.worker.js', import.meta.url ), { type: 'module' } );
				this.worker.onmessage = ( { data } ) => this._done( data );
				this.worker.onerror = ( e ) => {

					console.warn( 'soundscape synth worker', e.message );
					this.worker = null;

				};

			} catch ( e ) {

				this.worker = null;

			}

		}

	}

	make( name, sr, ...args ) {

		const id = ++ this.id;
		return new Promise( ( resolve, reject ) => {

			this.jobs.set( id, { resolve, reject, sr } );
			if ( this.worker ) this.worker.postMessage( { id, name, args: [ sr, ...args ] } );
			else Promise.resolve().then( () => {

				try {

					this._done( { id, bufs: JOBS[ name ]( sr, ...args ) } );

				} catch ( e ) {

					this._done( { id, error: e.message } );

				}

			} );

		} );

	}

	_done( { id, bufs, error } ) {

		const job = this.jobs.get( id );
		if ( ! job ) return;
		this.jobs.delete( id );
		if ( error ) {

			console.warn( 'soundscape synth', error );
			job.reject( new Error( error ) );
			return;

		}

		job.resolve( bufs.map( ( chans ) => {

			const b = this.ctx.createBuffer( chans.length, chans[ 0 ].length, job.sr );
			chans.forEach( ( c, i ) => b.getChannelData( i ).set( c ) );
			return b;

		} ) );

	}

}
