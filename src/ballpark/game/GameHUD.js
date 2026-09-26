import { ordinal } from './Director.js';

// The replay's on-screen panel: a score bug (score, inning, outs, count, runners), the matchup and the
// last pitch, the play-by-play, and the transport: play / pause, speed, previous / next batter, a slider
// over the whole game with the innings marked, and switches for the radio call and the ballpark sound.
//
// Keys (when the mouse isn't captured, or any time): K play / pause, , and . previous / next batter,
// - and = slower / faster, B radio on / off, G hide the panel.

const CSS = `
.gm-hud { position: fixed; left: 50%; bottom: 14px; transform: translateX( -50% ); width: min( 760px, calc( 100vw - 32px ) );
	z-index: 40; font: 500 13px/1.35 Inter, system-ui, sans-serif; color: #eef3f8; user-select: none; }
.gm-hud[hidden] { display: none; }
.gm-card { background: rgba( 10, 16, 24, 0.72 ); backdrop-filter: blur( 10px ); -webkit-backdrop-filter: blur( 10px );
	border: 1px solid rgba( 255, 255, 255, 0.08 ); border-radius: 12px; padding: 10px 12px; }
.gm-top { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.gm-score { display: flex; align-items: stretch; border-radius: 8px; overflow: hidden; font-weight: 700; letter-spacing: 0.02em; }
.gm-team { display: flex; gap: 8px; align-items: center; padding: 4px 10px; }
.gm-team.away { background: #0b2a5b; } .gm-team.home { background: #b0101f; }
.gm-team b { font-size: 18px; min-width: 14px; text-align: right; }
.gm-inning { padding: 4px 10px; background: rgba( 255, 255, 255, 0.08 ); display: flex; align-items: center; gap: 6px; }
.gm-diamond { width: 30px; height: 30px; position: relative; }
.gm-diamond i { position: absolute; width: 9px; height: 9px; border: 1.5px solid #cbd6e2; transform: rotate( 45deg ); }
.gm-diamond i.on { background: #ffd24a; border-color: #ffd24a; }
.gm-outs span { display: inline-block; width: 7px; height: 7px; border-radius: 50%; border: 1.5px solid #cbd6e2; margin-left: 3px; }
.gm-outs span.on { background: #ffd24a; border-color: #ffd24a; }
.gm-count { font-variant-numeric: tabular-nums; font-weight: 700; }
.gm-match { opacity: 0.9; flex: 1; min-width: 180px; }
.gm-match small { opacity: 0.65; }
.gm-desc { margin-top: 6px; min-height: 18px; color: #d9e3ee; }
.gm-bar { display: flex; gap: 8px; align-items: center; margin-top: 8px; }
.gm-bar button { background: rgba( 255, 255, 255, 0.09 ); color: #eef3f8; border: 0; border-radius: 7px; padding: 5px 9px; font: inherit; cursor: pointer; }
.gm-bar button:hover { background: rgba( 255, 255, 255, 0.16 ); }
.gm-bar button.off { opacity: 0.5; }
.gm-track { position: relative; flex: 1; height: 26px; }
.gm-track input { width: 100%; margin: 0; position: absolute; top: 5px; accent-color: #e81828; }
.gm-ticks { position: absolute; left: 0; right: 0; top: 19px; height: 8px; pointer-events: none; font-size: 9px; opacity: 0.6; }
.gm-ticks span { position: absolute; transform: translateX( -50% ); }
.gm-time { font-variant-numeric: tabular-nums; opacity: 0.75; min-width: 86px; text-align: right; font-size: 12px; }
`;

export class GameHUD {

	constructor( { director, game, radio, sound } ) {

		this.d = director;
		this.g = game;
		this.radio = radio;
		this.sound = sound;
		const st = document.createElement( 'style' );
		st.textContent = CSS;
		document.head.appendChild( st );
		const el = this.el = document.createElement( 'div' );
		el.className = 'gm-hud';
		el.innerHTML = `
			<div class="gm-card">
				<div class="gm-top">
					<div class="gm-score">
						<div class="gm-team away">${ game.teams.away.abbr } <b data-k="away">0</b></div>
						<div class="gm-team home">${ game.teams.home.abbr } <b data-k="home">0</b></div>
						<div class="gm-inning"><span data-k="inning">▲ 1</span></div>
					</div>
					<div class="gm-diamond"><i style="left:19px;top:10px" data-b="0"></i><i style="left:10px;top:1px" data-b="1"></i><i style="left:1px;top:10px" data-b="2"></i></div>
					<div><div class="gm-count" data-k="count">0-0</div><div class="gm-outs" data-k="outs"><span></span><span></span></div></div>
					<div class="gm-match" data-k="match"></div>
				</div>
				<div class="gm-desc" data-k="desc"></div>
				<div class="gm-bar">
					<button data-a="prev" title="Previous batter ( , )">⏮</button>
					<button data-a="play" title="Play / pause ( K )">⏸</button>
					<button data-a="next" title="Next batter ( . )">⏭</button>
					<button data-a="speed" title="Speed ( - / = )">1×</button>
					<div class="gm-track"><input type="range" min="0" step="0.1" data-k="slider"><div class="gm-ticks" data-k="ticks"></div></div>
					<div class="gm-time" data-k="time"></div>
					<button data-a="radio" title="Radio call on / off ( B )">📻</button>
					<button data-a="sound" title="Ballpark sound on / off">🔊</button>
				</div>
			</div>`;
		document.body.appendChild( el );
		this.$ = ( k ) => el.querySelector( `[data-k="${ k }"]` );
		const slider = this.$( 'slider' );
		slider.max = director.duration;
		slider.addEventListener( 'input', () => {

			director.seek( Number( slider.value ) );
			this.radio?.stop();

		} );
		slider.addEventListener( 'change', () => slider.blur() );
		// innings on the slider
		const ticks = this.$( 'ticks' );
		for ( const s of director.segments ) {

			if ( ( s.kind === 'switch' || s.kind === 'intro' ) && s.snap.half === 'top' ) {

				const sp = document.createElement( 'span' );
				sp.style.left = ( s.t0 / director.duration * 100 ) + '%';
				sp.textContent = s.snap.inning;
				ticks.appendChild( sp );

			}

		}

		el.querySelectorAll( 'button' ).forEach( ( b ) => b.addEventListener( 'click', ( e ) => {

			this.action( b.dataset.a );
			b.blur();
			e.stopPropagation();

		} ) );
		// keep clicks on the panel from capturing the mouse for the walker
		el.addEventListener( 'pointerdown', ( e ) => e.stopPropagation() );
		el.addEventListener( 'click', ( e ) => e.stopPropagation() );
		window.addEventListener( 'keydown', ( e ) => {

			if ( e.target && e.target.tagName === 'INPUT' && e.target.type !== 'range' ) return;
			const map = { KeyK: 'play', Comma: 'prev', Period: 'next', Minus: 'slower', Equal: 'faster', KeyB: 'radio', KeyG: 'hide' };
			if ( map[ e.code ] ) this.action( map[ e.code ] );

		} );
		this._last = '';

	}

	action( a ) {

		const d = this.d;
		const speeds = [ 0.5, 1, 2, 4, 8, 16 ];
		if ( a === 'play' ) {

			if ( d.t >= d.duration ) d.seek( 0 );
			d.playing = ! d.playing;
			if ( ! d.playing ) this.radio?.stop();

		}

		if ( a === 'prev' || a === 'next' ) {

			const cur = d.segmentAt( d.t ).pi ?? 0;
			const target = a === 'prev' ? ( d.t - d.timeOfPlay( cur ) > 3 ? cur : Math.max( 0, cur - 1 ) ) : Math.min( this.g.plays.length - 1, cur + 1 );
			d.seek( d.timeOfPlay( target ) );
			this.radio?.stop();

		}

		if ( a === 'speed' || a === 'faster' || a === 'slower' ) {

			let i = speeds.indexOf( d.speed );
			i = a === 'slower' ? Math.max( 0, i - 1 ) : a === 'faster' ? Math.min( speeds.length - 1, i + 1 ) : ( i + 1 ) % speeds.length;
			d.speed = speeds[ i ];

		}

		if ( a === 'radio' && this.radio ) this.radio.muted = ! this.radio.muted;
		if ( a === 'sound' && this.sound ) this.sound.setMuted( ! this.sound.muted );
		if ( a === 'hide' ) this.el.hidden = ! this.el.hidden;
		this.refresh( true );

	}

	refresh( force = false ) {

		const d = this.d, g = this.g, n = d.now;
		if ( ! n ) return;
		const s = n.snap, P = g.players;
		const key = [ d.t.toFixed( 1 ), d.playing, d.speed, this.radio?.muted, this.sound?.muted ].join();
		if ( ! force && key === this._last ) return;
		this._last = key;
		this.$( 'away' ).textContent = s.score.away;
		this.$( 'home' ).textContent = s.score.home;
		this.$( 'inning' ).textContent = `${ s.half === 'top' ? '▲' : '▼' } ${ s.inning }`;
		this.el.querySelectorAll( '[data-b]' ).forEach( ( i ) => i.classList.toggle( 'on', !! s.bases[ Number( i.dataset.b ) ] ) );
		this.$( 'count' ).textContent = `${ n.count[ 0 ] }-${ n.count[ 1 ] }`;
		this.$( 'outs' ).querySelectorAll( 'span' ).forEach( ( o, i ) => o.classList.toggle( 'on', i < n.outs ) );
		const pit = P[ s.pitcher ], bat = P[ s.batter ];
		const pitch = n.pitch && n.pitch.speed ? `<small> · ${ Math.round( n.pitch.speed ) } mph ${ n.pitch.typeName || '' }</small>` : '';
		this.$( 'match' ).innerHTML = bat && pit ? `${ pit.last } <small>pitching to</small> ${ bat.name } <small>#${ bat.num }</small>${ pitch }` : '';
		this.$( 'desc' ).textContent = n.seg.kind === 'celebrate' ? 'The Phillies are World Series champions!' : ( s.desc || `${ g.title } — ${ g.teams.away.club } at ${ g.teams.home.club }` );
		const slider = this.$( 'slider' );
		if ( document.activeElement !== slider ) slider.value = d.t;
		const bt = this.el.querySelector( '[data-a="play"]' );
		bt.textContent = d.playing ? '⏸' : '▶';
		this.el.querySelector( '[data-a="speed"]' ).textContent = `${ d.speed }×`;
		this.el.querySelector( '[data-a="radio"]' ).classList.toggle( 'off', !! this.radio?.muted );
		this.el.querySelector( '[data-a="sound"]' ).classList.toggle( 'off', !! this.sound?.muted );
		const inn = `${ s.half === 'top' ? 'Top' : 'Bot' } ${ ordinal( s.inning ) }`;
		this.$( 'time' ).textContent = `${ inn } · ${ fmt( d.t ) }`;

	}

}

function fmt( t ) {

	const m = Math.floor( t / 60 ), s = Math.floor( t % 60 );
	return `${ m }:${ String( s ).padStart( 2, '0' ) }`;

}
