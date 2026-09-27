// The ballpark's sound in Web Audio: the crowd (a murmur loop, cheers and groans), the crack of the bat,
// the pop of the mitt, the organ's "Charge!", the rain and the wind, the beer man. Recorded CC0 samples
// (public/audio/ballpark, see CREDITS.md there) with synthesized stand-ins until they've loaded.
const SAMPLES = [ 'bat-hard', 'bat-bright', 'bat-soft', 'bat-far', 'mitt-1', 'mitt-2', 'mitt-soft', 'crowd-loop', 'cheer-big', 'cheer-burst',
	'cheer-small', 'groan', 'ooh', 'organ-charge', 'rain', 'rain-heavy', 'wind', 'vendor-beer' ];
export class GameSound {

	constructor() {

		this.muted = false;
		this.ctx = null;
		this.buffers = {};

	}

	// Audio can only start after a click: call from the start overlay / first click.
	resume() {

		if ( ! this.ctx ) this._init();
		if ( this.ctx.state === 'suspended' ) this.ctx.resume();

	}

	_init() {

		const ctx = this.ctx = new AudioContext();
		this.master = ctx.createGain();
		this.master.gain.value = this.muted ? 0 : 0.8;
		// a big space: a short synthetic reverb
		this.reverb = ctx.createConvolver();
		this.reverb.buffer = this._impulse( 2.6, 2.8 );
		const wet = ctx.createGain();
		wet.gain.value = 0.35;
		this.reverb.connect( wet ).connect( this.master );
		// ---- S (the soundscape): everything sends to the reverb through one input, so the soundscape
		// (places/Soundscape.js) can put its rooms behind it (the open bowl, a roofed concourse) and fade
		// between them as you walk; reverbOut is where the rooms come back in
		this.reverbOut = wet;
		this.reverbCore = this.reverb;
		this.reverb = ctx.createGain();
		this.reverb.connect( this.reverbCore );
		this.buses = {};
		// ---- end S
		this.master.connect( ctx.destination );
		this.noise = this._noiseBuffer( 4 );
		// the crowd: pink-ish noise through a band of formant-like filters, slowly swelling
		this.crowd = this._loopNoise( [ [ 'lowpass', 1400, 0.7 ], [ 'highpass', 180, 0.7 ] ], 0.0 );
		this.crowdBase = 0.11;
		this.crowd.gain.gain.value = this.crowdBase;
		this.rain = this._loopNoise( [ [ 'highpass', 900, 0.5 ], [ 'lowpass', 7000, 0.5 ] ], 0 );
		this._murmur();
		this._load();
		for ( const [ name, src ] of this._samples || [] ) this._loadSample( name, src );

	}

	async _load() {

		await Promise.all( SAMPLES.map( async ( name ) => {

			try {

				const r = await fetch( `audio/ballpark/${ name }.mp3` );
				this.buffers[ name ] = await this.ctx.decodeAudioData( await r.arrayBuffer() );

			} catch ( e ) {

				console.warn( 'sound', name, e );

			}

		} ) );
		// the recorded crowd and rain replace the synthesized ones
		for ( const [ key, name, level ] of [ [ 'crowd', 'crowd-loop', 1 ], [ 'rain', 'rain-heavy', 1 ] ] ) {

			const b = this.buffers[ name ];
			if ( ! b ) continue;
			const old = this[ key ];
			const src = this.ctx.createBufferSource();
			src.buffer = b;
			src.loop = true;
			const g = this.ctx.createGain();
			g.gain.value = old.gain.gain.value * ( key === 'crowd' ? 4.5 : 1 ) * level;
			src.connect( g ).connect( this.master );
			src.start( 0, Math.random() * b.duration );
			old.src.stop();
			this[ key ] = { src, gain: g, filters: old.filters, sampled: true };

		}

		if ( this[ 'crowd' ].sampled ) this.crowdBase = this.crowd.gain.gain.value;
		this._vendor();
		this.onLoaded?.(); // ---- S: the soundscape takes the crowd and the rain onto its buses

	}

	// ---- S (the soundscape): where a sound goes: a bus of the soundscape's (the PA's speakers, the
	// music, the crowd, the field) if it's made them, else straight out. The organ's cues go out through
	// the park's speakers by themselves, and the crowd's reactions and the beer man are the crowd's.
	_out( name, bus ) {

		const b = bus || ( /organ/.test( name ) ? 'music' : /^(vendor|cheer|groan|ooh)/.test( name ) ? 'crowd' : null );
		return ( b && this.buses?.[ b ] ) || this.master;

	}
	// ---- end S

	// play a sample: vol, rate (pitch), and whether it goes through the stadium's reverb
	play( name, { vol = 1, rate = 1, wet = true, delay = 0, bus = null } = {} ) {

		const b = this.buffers[ name ];
		if ( ! b || ! this.ctx ) return false;
		const src = this.ctx.createBufferSource();
		src.buffer = b;
		src.playbackRate.value = rate;
		const g = this.ctx.createGain();
		g.gain.value = vol;
		src.connect( g ).connect( this._out( name, bus ) ); // ---- S: through a bus
		if ( wet ) g.connect( this.reverb );
		src.start( this.ctx.currentTime + delay );
		return src; // ---- S: the source (truthy as before), so a caller can stop it

	}

	// ---- sounds in a place (for the little worlds)
	//
	//   sound.sample( 'atv', 'audio/places/phanatic/atv.mp3' )    a recording (CC0, credited), or
	//   sound.sample( 'sizzle', ( ctx ) => buffer )               one synthesized once the audio starts
	//   const h = sound.spot( 'sizzle', position, { loop: true, vol: 0.5, ref: 4 } )
	//   h.move( position ); h.set( { vol, rate } ); h.stop()
	//
	// A spot is heard from where it is: panned, and quieter with distance (ref: the distance at full
	// level; max: silent beyond, so nothing far off plays). Positions are in the world (field.toWorld;
	// camera space's metres). A looping spot made before the first click starts with the audio; a one-shot
	// then is simply not heard. The listener follows the camera (listen(), every frame).
	sample( name, src ) {

		( this._samples ||= new Map() ).set( name, src );
		if ( this.ctx ) this._loadSample( name, src );

	}

	async _loadSample( name, src ) {

		try {

			if ( typeof src === 'function' ) this.buffers[ name ] = src( this.ctx );
			else this.buffers[ name ] = await this.ctx.decodeAudioData( await ( await fetch( src ) ).arrayBuffer() );

		} catch ( e ) {

			console.warn( 'sound', name, e.message );

		}

	}

	spot( name, position, { loop = false, vol = 1, rate = 1, ref = 6, max = 150, rolloff = 1.3, wet = true } = {} ) {

		const h = { name, position: position.clone ? position.clone() : { ...position }, loop, vol, rate, ref, max, rolloff, wet, node: null, gain: null, panner: null, live: true };
		h.move = ( p ) => {

			h.position.x = p.x;
			h.position.y = p.y;
			h.position.z = p.z;
			if ( h.panner ) h.panner.positionX.value = p.x, h.panner.positionY.value = p.y, h.panner.positionZ.value = p.z;
			return h;

		};
		h.set = ( { vol, rate } = {} ) => {

			if ( vol !== undefined ) h.vol = vol, h.gain && ( h.gain.gain.value = vol );
			if ( rate !== undefined ) h.rate = rate, h.node && ( h.node.playbackRate.value = rate );
			return h;

		};
		h.stop = () => {

			h.live = false;
			try {

				h.node?.stop();

			} catch {}

			( this._spots || [] ).splice( ( this._spots || [] ).indexOf( h ) >>> 0, 1 );

		};
		if ( loop ) ( this._spots ||= [] ).push( h );
		if ( this.ctx ) this._startSpot( h );
		return h;

	}

	_startSpot( h ) {

		const b = this.buffers[ h.name ];
		if ( ! b || ! h.live || h.node ) return;
		const ctx = this.ctx;
		const src = ctx.createBufferSource();
		src.buffer = b;
		src.loop = h.loop;
		src.playbackRate.value = h.rate;
		const p = ctx.createPanner();
		p.panningModel = 'HRTF';
		p.distanceModel = 'inverse';
		p.refDistance = h.ref;
		p.maxDistance = h.max;
		p.rolloffFactor = h.rolloff;
		p.positionX.value = h.position.x;
		p.positionY.value = h.position.y;
		p.positionZ.value = h.position.z;
		const g = ctx.createGain();
		g.gain.value = h.vol;
		// ---- S (the soundscape): the air between: the highs fall away with distance, and more through a
		// wall or the facade (the soundscape's space sets h.air's cutoff as you walk, for the loops)
		const air = ctx.createBiquadFilter();
		air.type = 'lowpass';
		air.frequency.value = this.airCutoff ? this.airCutoff( h.position ) : 20000;
		src.connect( g ).connect( air ).connect( p ).connect( this.master );
		h.air = air;
		// ---- end S
		if ( h.wet ) p.connect( this.reverb );
		src.start( 0, h.loop ? Math.random() * b.duration : 0 );
		if ( ! h.loop ) src.onended = () => h.stop();
		Object.assign( h, { node: src, gain: g, panner: p } );

	}

	// the listener is the camera (BallparkApp calls this every frame); the loops start once their samples
	// are in
	listen( camera ) {

		if ( ! this.ctx ) return;
		const L = this.ctx.listener, p = camera.position, e = camera.matrixWorld.elements;
		if ( L.positionX ) {

			L.positionX.value = p.x;
			L.positionY.value = p.y;
			L.positionZ.value = p.z;
			L.forwardX.value = - e[ 8 ];
			L.forwardY.value = - e[ 9 ];
			L.forwardZ.value = - e[ 10 ];
			L.upX.value = e[ 4 ];
			L.upY.value = e[ 5 ];
			L.upZ.value = e[ 6 ];

		}

		for ( const h of this._spots || [] ) if ( ! h.node ) this._startSpot( h );

	}

	// now and then, the beer man
	_vendor() {

		const next = () => {

			if ( ! this.ctx ) return;
			this.play( 'vendor-beer', { vol: 0.25, rate: 0.95 + Math.random() * 0.1 } );
			setTimeout( next, 45000 + Math.random() * 60000 );

		};

		setTimeout( next, 20000 + Math.random() * 20000 );

	}

	setMuted( m ) {

		this.muted = m;
		if ( this.master ) this.master.gain.setTargetAtTime( m ? 0 : 0.8, this.ctx.currentTime, 0.1 );

	}

	setRain( amount ) {

		if ( this.rain ) this.rain.gain.gain.setTargetAtTime( amount * 0.16, this.ctx.currentTime, 1.5 );

	}

	// ---- events

	crack( hard = 'medium' ) {

		if ( ! this.ctx ) return;
		const name = hard === 'hard' ? 'bat-hard' : hard === 'soft' ? 'bat-soft' : ( Math.random() < 0.5 ? 'bat-bright' : 'bat-hard' );
		if ( this.play( name, { vol: hard === 'soft' ? 0.7 : 1, rate: 0.95 + Math.random() * 0.1, bus: 'field' } ) ) return; // ---- S: the field's bus
		const ctx = this.ctx, t = ctx.currentTime;
		const k = hard === 'hard' ? 1.2 : hard === 'soft' ? 0.6 : 0.9;
		// a sharp broadband click and the bat's ring
		const src = ctx.createBufferSource();
		src.buffer = this.noise;
		const bp = ctx.createBiquadFilter();
		bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 0.9;
		const g = ctx.createGain();
		g.gain.setValueAtTime( 0.0001, t );
		g.gain.exponentialRampToValueAtTime( 0.9 * k, t + 0.002 );
		g.gain.exponentialRampToValueAtTime( 0.0001, t + 0.09 );
		src.connect( bp ).connect( g );
		g.connect( this.master );
		g.connect( this.reverb );
		src.start( t, Math.random() * 3, 0.12 );
		const osc = ctx.createOscillator();
		osc.type = 'triangle';
		osc.frequency.value = 1150;
		const og = ctx.createGain();
		og.gain.setValueAtTime( 0.25 * k, t );
		og.gain.exponentialRampToValueAtTime( 0.0001, t + 0.12 );
		osc.connect( og ).connect( this.master );
		og.connect( this.reverb );
		osc.start( t );
		osc.stop( t + 0.14 );

	}

	mitt( soft = false ) {

		if ( ! this.ctx ) return;
		if ( this.play( soft ? 'mitt-soft' : ( Math.random() < 0.5 ? 'mitt-1' : 'mitt-2' ), { vol: soft ? 0.6 : 0.9, rate: 0.95 + Math.random() * 0.1, bus: 'field' } ) ) return; // ---- S: the field's bus
		const ctx = this.ctx, t = ctx.currentTime;
		const src = ctx.createBufferSource();
		src.buffer = this.noise;
		const lp = ctx.createBiquadFilter();
		lp.type = 'lowpass'; lp.frequency.value = 900;
		const g = ctx.createGain();
		g.gain.setValueAtTime( 0.0001, t );
		g.gain.exponentialRampToValueAtTime( 0.7, t + 0.003 );
		g.gain.exponentialRampToValueAtTime( 0.0001, t + 0.07 );
		src.connect( lp ).connect( g );
		g.connect( this.master );
		g.connect( this.reverb );
		src.start( t, Math.random() * 3, 0.1 );

	}

	// the crowd reacts: level > 0 cheers (2 = big), < 0 a groan
	cheer( level ) {

		if ( ! this.ctx ) return;
		if ( this.hooks?.cheer?.( level ) ) return; // ---- S: the soundscape's crowd answers, when it's there
		const g = this.crowd.gain.gain, t = this.ctx.currentTime;
		// recorded reactions over the murmur
		if ( level >= 3 ) this.play( 'cheer-big', { vol: 0.9 } ), this.play( 'cheer-burst', { vol: 0.7, delay: 0.2 } );
		else if ( level >= 2 ) this.play( 'cheer-burst', { vol: 0.8 } );
		else if ( level >= 1 ) this.play( 'cheer-small', { vol: 0.6 } );
		else if ( level < 0 ) this.play( Math.random() < 0.5 ? 'groan' : 'ooh', { vol: 0.45 } );
		if ( level > 0 ) {

			const peak = this.crowdBase + 0.12 * level + ( level >= 3 ? 0.25 : 0 );
			g.cancelScheduledValues( t );
			g.setTargetAtTime( peak, t, 0.15 );
			g.setTargetAtTime( this.crowdBase, t + 1.5 + level * 1.2, 1.2 );
			if ( level >= 2 ) this.organ( 'charge', 1.8 );

		} else {

			g.cancelScheduledValues( t );
			g.setTargetAtTime( this.crowdBase * 0.6, t, 0.3 );
			g.setTargetAtTime( this.crowdBase, t + 2, 1.0 );

		}

	}

	// organ: "Charge!" (the bugle call), or a short run
	organ( tune = 'charge', delay = 0 ) {

		if ( ! this.ctx ) return;
		if ( this.hooks?.organ?.( tune, delay ) ) return; // ---- S: the soundscape's organ plays it, when it's there
		if ( tune === 'charge' && this.play( 'organ-charge', { vol: 0.45, delay } ) ) return;
		const ctx = this.ctx;
		const t0 = ctx.currentTime + delay;
		const tunes = {
			charge: [ [ 67, 0.14 ], [ 72, 0.14 ], [ 76, 0.14 ], [ 79, 0.28 ], [ 76, 0.14 ], [ 79, 0.6 ] ],
			run: [ [ 60, 0.1 ], [ 64, 0.1 ], [ 67, 0.1 ], [ 72, 0.1 ], [ 76, 0.1 ], [ 79, 0.4 ] ],
		};
		let t = t0;
		for ( const [ note, len ] of tunes[ tune ] ) {

			const f = 440 * Math.pow( 2, ( note - 69 ) / 12 );
			const g = ctx.createGain();
			g.gain.setValueAtTime( 0.0001, t );
			g.gain.linearRampToValueAtTime( 0.07, t + 0.015 );
			g.gain.setValueAtTime( 0.07, t + len * 0.85 );
			g.gain.linearRampToValueAtTime( 0.0001, t + len );
			// drawbars: fundamental and a few harmonics, a little vibrato
			for ( const [ mul, amp ] of [ [ 1, 1 ], [ 2, 0.6 ], [ 3, 0.35 ], [ 4, 0.2 ], [ 0.5, 0.5 ] ] ) {

				const o = ctx.createOscillator();
				o.type = 'sine';
				o.frequency.value = f * mul;
				const a = ctx.createGain();
				a.gain.value = amp;
				o.connect( a ).connect( g );
				o.start( t );
				o.stop( t + len + 0.05 );

			}

			g.connect( this.master );
			g.connect( this.reverb );
			t += len;

		}

	}

	// the pile at the end: the whole place goes up
	celebrate() {

		if ( this.hooks?.celebrate?.() ) return; // ---- S: the soundscape has the last out
		this.cheer( 4 );
		this.organ( 'run', 0.5 );

	}

	// ---- building blocks

	_murmur() {

		// the crowd's level wanders a little on its own
		const tick = () => {

			if ( ! this.ctx ) return;
			const f = this.crowd.filters[ 0 ];
			f.frequency.setTargetAtTime( 1100 + Math.random() * 700, this.ctx.currentTime, 2 );
			setTimeout( tick, 2000 + Math.random() * 3000 );

		};

		tick();

	}

	_loopNoise( filters, gain ) {

		const ctx = this.ctx;
		const src = ctx.createBufferSource();
		src.buffer = this.noise;
		src.loop = true;
		let node = src;
		const fs = [];
		for ( const [ type, f, q ] of filters ) {

			const b = ctx.createBiquadFilter();
			b.type = type; b.frequency.value = f; b.Q.value = q;
			node.connect( b );
			node = b;
			fs.push( b );

		}

		const g = ctx.createGain();
		g.gain.value = gain;
		node.connect( g ).connect( this.master );
		g.connect( this.reverb );
		src.start();
		return { src, gain: g, filters: fs };

	}

	_noiseBuffer( seconds ) {

		const ctx = this.ctx, n = ctx.sampleRate * seconds;
		const b = ctx.createBuffer( 1, n, ctx.sampleRate );
		const d = b.getChannelData( 0 );
		// pink-ish (Paul Kellet's filter)
		let b0 = 0, b1 = 0, b2 = 0;
		for ( let i = 0; i < n; i ++ ) {

			const w = Math.random() * 2 - 1;
			b0 = 0.99765 * b0 + w * 0.099046;
			b1 = 0.963 * b1 + w * 0.2965164;
			b2 = 0.57 * b2 + w * 1.0526913;
			d[ i ] = ( b0 + b1 + b2 + w * 0.1848 ) * 0.2;

		}

		return b;

	}

	_impulse( seconds, decay ) {

		const ctx = this.ctx, n = Math.floor( ctx.sampleRate * seconds );
		const b = ctx.createBuffer( 2, n, ctx.sampleRate );
		for ( let c = 0; c < 2; c ++ ) {

			const d = b.getChannelData( c );
			for ( let i = 0; i < n; i ++ ) d[ i ] = ( Math.random() * 2 - 1 ) * Math.pow( 1 - i / n, decay );

		}

		return b;

	}

}
