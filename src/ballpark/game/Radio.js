// The radio call of the replay: a play-by-play man and a colour man (tools/radio: the script is
// written from the game data and voiced offline, then mixed with an AM-radio sound into one track on the
// replay's clock, public/audio/radio/game5.mp3). The track plays in step with the replay: seeking the
// game seeks the call, the playback rate follows the replay's speed up to 2x (beyond that it's silent).
// If the track can't be loaded, the browser's speech synthesis reads the replay's cues instead.
export class Radio {

	constructor() {

		this.muted = false;
		this.speed = 1;
		this.ok = typeof speechSynthesis !== 'undefined';
		this.voice = null;
		this.track = null;
		this.trackOk = false;
		if ( typeof Audio !== 'undefined' ) {

			const a = new Audio( 'audio/radio/game5.mp3' );
			a.preload = 'auto';
			a.addEventListener( 'canplay', () => { this.trackOk = true; } );
			a.addEventListener( 'error', () => { this.trackOk = false; this.track = null; } );
			this.track = a;

		}

		// browsers let audio start once the page has had a click or a key press
		if ( typeof window !== 'undefined' ) for ( const ev of [ 'pointerdown', 'keydown' ] ) window.addEventListener( ev, () => this.unlock(), { once: true, capture: true } );

		if ( this.ok ) {

			const pick = () => {

				const vs = speechSynthesis.getVoices().filter( ( v ) => /^en/i.test( v.lang ) );
				this.voice = vs.find( ( v ) => /Daniel|Alex|Aaron|Fred|Tom|Guy|David/i.test( v.name ) ) || vs.find( ( v ) => /en-US/i.test( v.lang ) ) || vs[ 0 ] || null;

			};

			pick();
			speechSynthesis.onvoiceschanged = pick;

		}

	}

	// keep the track on the replay's clock (every frame)
	sync( t, playing ) {

		const a = this.track;
		if ( ! a || ! this.trackOk ) return;
		const on = playing && ! this.muted && this.speed <= 2 && this.unlocked;
		if ( ! on ) {

			if ( ! a.paused ) a.pause();
			return;

		}

		if ( Math.abs( a.playbackRate - this.speed ) > 0.01 ) a.playbackRate = this.speed;
		if ( Math.abs( a.currentTime - t ) > 0.35 ) a.currentTime = t;
		if ( a.paused ) a.play().catch( () => {} );

	}

	// audio can only start after a click / key press
	unlock() {

		this.unlocked = true;

	}

	// the speech fallback reads the replay's cues (only without the track)
	say( text, { important = false } = {} ) {

		if ( this.trackOk || ! this.ok || this.muted || ! text ) return;
		// don't let a backlog build: drop pitch-by-pitch lines when behind, and at high speed
		if ( ! important && ( this.speed > 2 || speechSynthesis.pending ) ) return;
		const u = new SpeechSynthesisUtterance( text );
		if ( this.voice ) u.voice = this.voice;
		u.rate = Math.min( 1.6, 1.05 * Math.max( 1, this.speed * 0.8 ) );
		u.pitch = 0.95;
		speechSynthesis.speak( u );

	}

	stop() {

		if ( this.ok ) speechSynthesis.cancel();
		if ( this.track && ! this.track.paused ) this.track.pause();

	}

	set muted( v ) {

		this._muted = v;
		if ( v ) this.stop();

	}

	get muted() {

		return this._muted;

	}

}
