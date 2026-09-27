// The soundscape's synthesis off the main thread: a recipe by name (Recipes.js JOBS), its channels sent
// back without copying.
import { JOBS } from './Recipes.js';

self.onmessage = ( { data: { id, name, args } } ) => {

	try {

		const bufs = JOBS[ name ]( ...args );
		self.postMessage( { id, bufs }, bufs.flat().map( ( c ) => c.buffer ) );

	} catch ( e ) {

		self.postMessage( { id, error: String( e?.message || e ) } );

	}

};
