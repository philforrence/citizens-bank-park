// A radio-style call of the replay, read by the browser's speech synthesis from the game data: the batter
// coming up, each pitch, each play, the score. Lines queue up; at high speeds only the plays are called.
export class Radio {

	constructor() {

		this.muted = false;
		this.ok = typeof speechSynthesis !== 'undefined';
		this.voice = null;
		this.speed = 1;
		if ( this.ok ) {

			const pick = () => {

				const vs = speechSynthesis.getVoices().filter( ( v ) => /^en/i.test( v.lang ) );
				this.voice = vs.find( ( v ) => /Daniel|Alex|Aaron|Fred|Tom|Guy|David/i.test( v.name ) ) || vs.find( ( v ) => /en-US/i.test( v.lang ) ) || vs[ 0 ] || null;

			};

			pick();
			speechSynthesis.onvoiceschanged = pick;

		}

	}

	say( text, { important = false } = {} ) {

		if ( ! this.ok || this.muted || ! text ) return;
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

	}

	set muted( v ) {

		this._muted = v;
		if ( v ) this.stop();

	}

	get muted() {

		return this._muted;

	}

}
