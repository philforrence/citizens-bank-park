// A stand-in Web Audio API for Node: nodes that only count and check their calls (every AudioParam value
// finite, no source started twice), buffers that hold their data, fetch answering with silence. For the
// soundscape's CPU check (test/soundscape.mjs).

export const counts = { nodes: 0, params: 0, starts: 0 };
export const bad = { n: 0 };
class Param {

	constructor( v = 0 ) {

		this.value = v;
		counts.params ++;

	}

	_chk( v ) {

		if ( ! Number.isFinite( v ) ) {

			bad.n ++;
			if ( bad.n < 5 ) console.error( 'non-finite AudioParam value', v, new Error().stack.split( '\n' ).slice( 2, 5 ).join( '\n' ) );

		}

		return this;

	}

	setValueAtTime( v, t ) { this._chk( v )._chk( t ); this.value = v; return this; }

	linearRampToValueAtTime( v, t ) { this._chk( v )._chk( t ); return this; }

	exponentialRampToValueAtTime( v, t ) { if ( v <= 0 ) bad.n ++; this._chk( v )._chk( t ); return this; }

	setTargetAtTime( v, t, c ) { this._chk( v )._chk( t )._chk( c ); return this; }

	cancelScheduledValues() { return this; }

}

class Node {

	constructor( ctx, params = {} ) {

		this.context = ctx;
		counts.nodes ++;
		for ( const [ k, v ] of Object.entries( params ) ) this[ k ] = new Param( v );

	}

	connect( n ) {

		if ( ! n ) throw new Error( 'connect to nothing' );
		return n;

	}

	disconnect() {}

}

class Source extends Node {

	start( t = 0 ) {

		if ( this._started ) throw new Error( 'started twice' );
		this._started = true;
		counts.starts ++;
		if ( ! Number.isFinite( t ) ) bad.n ++;

	}

	stop() {}

}

class Buffer {

	constructor( ch, n, sr ) {

		if ( ! ( n > 0 ) || ! ( sr > 0 ) ) throw new Error( `bad buffer ${ ch } ${ n } ${ sr }` );
		this.numberOfChannels = ch;
		this.length = n;
		this.sampleRate = sr;
		this.duration = n / sr;
		this._d = Array.from( { length: ch }, () => new Float32Array( n ) );

	}

	getChannelData( c ) {

		return this._d[ c ];

	}

}

class FakeContext {

	constructor() {

		this.sampleRate = 48000;
		this.currentTime = 0;
		this.state = 'running';
		this.destination = new Node( this );
		this.listener = { positionX: new Param(), positionY: new Param(), positionZ: new Param(), forwardX: new Param(), forwardY: new Param(), forwardZ: new Param(), upX: new Param(), upY: new Param(), upZ: new Param() };

	}

	resume() {}

	createGain() { return new Node( this, { gain: 1 } ); }

	createBiquadFilter() { return new Node( this, { frequency: 350, Q: 1, gain: 0 } ); }

	createConvolver() { return new Node( this ); }

	createDelay() { return new Node( this, { delayTime: 0 } ); }

	createStereoPanner() { return new Node( this, { pan: 0 } ); }

	createPanner() { return new Node( this, { positionX: 0, positionY: 0, positionZ: 0 } ); }

	createDynamicsCompressor() { return new Node( this, { threshold: 0, knee: 0, ratio: 1, attack: 0, release: 0 } ); }

	createWaveShaper() { const w = new Node( this ); w.curve = null; return w; }

	createBufferSource() { const s = new Source( this, { playbackRate: 1 } ); s.buffer = null; return s; }

	createOscillator() { const o = new Source( this, { frequency: 440, detune: 0 } ); o.setPeriodicWave = () => {}; return o; }

	createPeriodicWave() { return {}; }

	createBuffer( ch, n, sr ) { return new Buffer( ch, n, sr ); }

	decodeAudioData() { return Promise.resolve( new Buffer( 1, 48000 * 20, 48000 ) ); }

}

globalThis.AudioContext = FakeContext;
// the clips: every fetch answers with 20 s of silence, the PA's and the fans' index a couple of keys
globalThis.fetch = async ( url ) => ( {
	ok: true,
	json: async () => /pa\//.test( url ) ? { 'bat-276519': { f: 'x.mp3', d: 3 }, 'welcome-27': { f: 'y.mp3', d: 5 } } : { boo: { f: 'b.mp3' }, letsgo: { f: 'l.mp3', cycle: 2.4 }, 'shout-1': { f: 's.mp3', when: 'two' } },
	arrayBuffer: async () => new ArrayBuffer( 8 ),
} );
globalThis.setTimeout = ( f ) => 0; // (the horns and yells aren't needed here)
