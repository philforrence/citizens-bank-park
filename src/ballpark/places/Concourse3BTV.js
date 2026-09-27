import { canvasTexture, refreshCanvasTexture } from '../geo.js';
import { SEASON, PITCHING } from '../Phanavision.js';
// ---- R (rituals)
import { ANNOUNCE } from '../game/Suspension.js';
// ---- end R

// The concourse's TVs showing the game: FOX's World Series broadcast as the fans in line saw it, drawn
// from the replay (a few times a second, when what it shows changes). The center field camera over the
// pitcher's shoulder through each pitch, the wide shot from high behind home when the ball's in play,
// the batter's lower third as he walks up (his 2008 line), NOW PITCHING at a change, the break between
// innings with the line score, the rain on the lens on the 27th, the tarp and GAME SUSPENDED, and at the
// end the pile on the mound and WORLD CHAMPIONS; FOX's score bug in the corner (the two clubs and the
// score, the inning, the bases, the count and the outs). The same picture goes to the TVs hung along
// the concourse (Concourse.js) and to the ones over the stands here.
const W = 512, H = 288;
const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const UNI = {
	home: { body: '#ecebe7', pants: '#e4e2dd', cap: '#c8102e', num: '#c8102e', helmet: '#c8102e' },
	away: { body: '#9ea3aa', pants: '#a6aab0', cap: '#0b2a5b', num: '#0b2a5b', helmet: '#0b2a5b' },
};
const hash = ( s ) => {

	const x = Math.sin( s * 12.9898 + 78.233 ) * 43758.5453;
	return x - Math.floor( x );

};

export class LiveTV {

	constructor() {

		this.texture = canvasTexture( W, H, ( ctx ) => {

			ctx.fillStyle = '#05070c';
			ctx.fillRect( 0, 0, W, H );

		}, 'concourse3bTV' );
		this.canvas = this.texture.canvas;
		this.ctx = this.canvas.getContext( '2d' );
		this.t = 0;
		this.key = '';
		this.others = []; // other canvases fed the same picture: [ texture ]

	}

	// the park's own concourse TVs (Concourse.js): their texture gets this picture too
	feed( texture ) {

		if ( texture?.canvas ) this.others.push( texture );

	}

	update( dt, d, ns ) {

		if ( ! d ) return;
		this.t += dt;
		if ( this.t < 0.3 ) return;
		this.t = 0;
		const seg = d.segmentAt( d.t ), lt = d.t - seg.t0;
		const st = d.boardState();
		// what the picture is now; redrawn only when that changes
		let frame = 'x';
		if ( seg.kind === 'pitch' ) frame = lt < 2.4 ? 'set' : lt < 3.6 ? 'throw' : 'after';
		if ( seg.kind === 'inplay' ) frame = 'play' + Math.floor( lt / 1.2 );
		if ( seg.kind === 'celebrate' ) frame = 'cel' + Math.floor( lt / 2 );
		if ( seg.kind === 'switch' || seg.kind === 'intro' ) frame = 'brk' + Math.floor( lt / 6 );
		const key = [ seg.t0, frame, st.count, st.outs, st.score?.home, st.score?.away, ns.first, ns.suspended ].join( '|' );
		if ( key === this.key ) return;
		this.key = key;
		this._draw( seg, lt, st, ns, frame );
		refreshCanvasTexture( this.texture );
		for ( const t of this.others ) {

			const c = t.canvas.getContext( '2d' );
			c.drawImage( this.canvas, 0, 0, t.canvas.width, t.canvas.height );
			refreshCanvasTexture( t );

		}

	}

	_draw( seg, lt, st, ns, frame ) {

		const ctx = this.ctx;
		ctx.save();
		ctx.clearRect( 0, 0, W, H );
		const kind = seg.kind, snap = seg.snap || {};
		const m = { batting: snap.batting || ( snap.half === 'bottom' ? 'home' : 'away' ), bats: snap.bats, pitcher: st.pitcher };
		if ( ns.suspended ) {

			tarpShot( ctx, lt );
			// ---- R (rituals): RAIN DELAY until the suspension's announced (game/Suspension.js ANNOUNCE)
			const ann = lt < ANNOUNCE;
			card( ctx, ann ? 'RAIN DELAY' : 'GAME SUSPENDED', ann ? 'TOP 6TH  ·  RAYS 2  PHILLIES 2' : 'TO BE RESUMED IN THE BOTTOM OF THE 6TH' );
			// ---- end R

		} else if ( kind === 'celebrate' ) {

			if ( lt < 5 ) {

				lidgeShot( ctx );
				bug( ctx, { ...st, inning: 9, half: 'top', outs: 3, celebrate: true }, {}, 84 );

			} else {

				pileShot( ctx, lt );
				card( ctx, 'PHILLIES WIN THE WORLD SERIES', 'FIRST TITLE SINCE 1980  ·  PHILLIES 4  RAYS 3', true );

			}

		} else if ( kind === 'switch' || kind === 'intro' ) {

			wideShot( ctx, m, 0 );
			breakCard( ctx, st, kind === 'intro' );

		} else if ( kind === 'inplay' ) {

			wideShot( ctx, m, lt );
			bug( ctx, st, snap );

		} else if ( kind === 'change' ) {

			pitchShot( ctx, m, 'set' );
			const last = ( st.pitcher?.last || '' );
			const cap = last.charAt( 0 ) + last.slice( 1 ).toLowerCase();
			const p = PITCHING[ cap ];
			lowerThird( ctx, `#${ st.pitcher?.num || '' }  ${ last }`, 'NOW PITCHING', p ? `2008:  ${ p[ 0 ] }   ${ p[ 1 ] } ERA${ p[ 2 ] ? `   ${ p[ 2 ] } SV` : '' }` : '', m.batting === 'home' ? 'away' : 'home' );
			bug( ctx, st, snap );

		} else {

			pitchShot( ctx, m, kind === 'pitch' ? frame : 'set', seg );
			if ( kind === 'walkup' ) {

				const b = st.batter;
				const cap = ( b?.last || '' ).charAt( 0 ) + ( b?.last || '' ).slice( 1 ).toLowerCase();
				const sea = SEASON[ cap ];
				lowerThird( ctx, `#${ b?.num || '' }  ${ b?.name || '' }`, b?.pos || '', sea ? `2008:  ${ sea[ 0 ] }   ${ sea[ 1 ] } HR   ${ sea[ 2 ] } RBI` : '', m.batting );

			}

			// the pitch's speed, once it's thrown, in the bug's yellow box
			bug( ctx, st, snap, kind === 'pitch' && frame === 'after' ? seg.ev?.speed || 0 : 0 );

		}

		// the 27th: the rain in the lights, beading on the lens
		if ( ns.first && ! ns.celebrate ) rainOver( ctx, seg.t0 + lt, ns.rain );
		// the picture's own edge: a hint of the set's glass and its scan
		ctx.fillStyle = 'rgba( 255, 255, 255, 0.025 )';
		for ( let y = 0; y < H; y += 3 ) ctx.fillRect( 0, y, W, 1 );
		ctx.restore();

	}

}

// ---------------------------------------------------------------- the pictures

function crowd( ctx, x, y, w, h, seed, dark = 1 ) {

	ctx.fillStyle = `rgb( ${ 38 * dark }, ${ 12 * dark }, ${ 16 * dark } )`;
	ctx.fillRect( x, y, w, h );
	for ( let i = 0; i < w * h / 26; i ++ ) {

		const q = hash( seed * 3 + i * 2.11 );
		ctx.fillStyle = q < 0.55 ? '#b3122a' : q < 0.7 ? '#e8e4de' : q < 0.85 ? '#1c1c24' : '#5a5f6a';
		ctx.globalAlpha = 0.35 + 0.35 * dark;
		ctx.fillRect( x + hash( seed + i * 1.37 ) * w, y + hash( seed * 7 + i * 0.73 ) * h, 2, 3 );

	}

	ctx.globalAlpha = 1;

}

// a ballplayer, small: legs, body, arms, head and cap; o.pose 'stand', 'crouch', 'swing', 'bat', 'throw'
function figure( ctx, x, y, s, o ) {

	ctx.save();
	ctx.translate( x, y );
	ctx.scale( s, s );
	ctx.lineCap = 'round';
	const body = o.body, pants = o.pants || o.body;
	if ( o.pose === 'crouch' ) {

		ctx.fillStyle = pants; ctx.fillRect( - 14, - 22, 28, 22 );
		ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse( 0, - 34, 16, 18, 0, 0, Math.PI * 2 ); ctx.fill();
		ctx.fillStyle = o.cap; ctx.beginPath(); ctx.arc( 0, - 58, 9, 0, Math.PI * 2 ); ctx.fill();

	} else {

		ctx.strokeStyle = pants; ctx.lineWidth = 9;
		const st = o.pose === 'throw' ? 16 : 7;
		ctx.beginPath(); ctx.moveTo( - 5, - 44 ); ctx.lineTo( - st, 0 ); ctx.moveTo( 5, - 44 ); ctx.lineTo( st * ( o.pose === 'throw' ? 0.4 : 1 ), 0 ); ctx.stroke();
		ctx.fillStyle = body;
		ctx.beginPath(); ctx.moveTo( - 13, - 46 ); ctx.lineTo( 13, - 46 ); ctx.lineTo( 15, - 82 ); ctx.lineTo( - 15, - 82 ); ctx.closePath(); ctx.fill();
		ctx.strokeStyle = body; ctx.lineWidth = 7;
		if ( o.pose === 'swing' ) {

			ctx.beginPath(); ctx.moveTo( - 12, - 78 ); ctx.lineTo( 8, - 66 ); ctx.lineTo( 26, - 68 ); ctx.stroke();
			ctx.strokeStyle = '#d8b27a'; ctx.lineWidth = 4;
			ctx.beginPath(); ctx.moveTo( 22, - 68 ); ctx.lineTo( 70 * ( o.dir || 1 ), - 74 ); ctx.stroke();

		} else if ( o.pose === 'bat' ) {

			ctx.beginPath(); ctx.moveTo( 12, - 78 ); ctx.lineTo( 18, - 70 ); ctx.lineTo( 12, - 90 ); ctx.stroke();
			ctx.strokeStyle = '#d8b27a'; ctx.lineWidth = 4;
			ctx.beginPath(); ctx.moveTo( 12, - 88 ); ctx.lineTo( 4 * ( o.dir || 1 ), - 130 ); ctx.stroke();

		} else if ( o.pose === 'throw' ) {

			ctx.beginPath(); ctx.moveTo( 12, - 78 ); ctx.lineTo( 30, - 96 ); ctx.lineTo( 40, - 110 ); ctx.moveTo( - 12, - 78 ); ctx.lineTo( - 28, - 64 ); ctx.stroke();

		} else {

			ctx.beginPath(); ctx.moveTo( 12, - 78 ); ctx.lineTo( 8, - 62 ); ctx.lineTo( 0, - 60 ); ctx.moveTo( - 12, - 78 ); ctx.lineTo( - 8, - 62 ); ctx.lineTo( 0, - 60 ); ctx.stroke();

		}

		ctx.fillStyle = o.back ? '#2a1c14' : '#b98a6a'; ctx.beginPath(); ctx.arc( 0, - 92, 9, 0, Math.PI * 2 ); ctx.fill();
		ctx.fillStyle = o.cap; ctx.beginPath(); ctx.arc( 0, - 95, 9.5, Math.PI * 1.05, Math.PI * 1.95 ); ctx.fill();
		if ( o.number ) {

			ctx.fillStyle = o.numColor || '#c8102e';
			ctx.font = `900 22px ${ SANS }`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
			ctx.fillText( o.number, 0, - 62 );

		}

	}

	ctx.restore();

}

// the center field camera: the stands behind home, the fascia under the club, the backstop wall, the
// dirt round the plate, the grass, the batter in his box, the catcher and the umpire, the pitcher's back
function pitchShot( ctx, m, frame, seg ) {

	crowd( ctx, 0, 0, W, H * 0.36, 3 );
	ctx.fillStyle = '#0d1c34'; ctx.fillRect( 0, H * 0.36, W, H * 0.045 );
	ctx.fillStyle = '#e8e4d8'; ctx.font = `800 9px ${ SANS }`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
	ctx.fillText( 'WORLD SERIES 2008', W * 0.28, H * 0.383 ); ctx.fillText( 'Citizens Bank Park', W * 0.74, H * 0.383 );
	ctx.fillStyle = '#123a2e'; ctx.fillRect( 0, H * 0.405, W, H * 0.075 );
	ctx.fillStyle = '#7a4a30'; ctx.fillRect( 0, H * 0.48, W, H * 0.52 );
	const grass = ctx.createLinearGradient( 0, H * 0.7, 0, H );
	grass.addColorStop( 0, '#2f5f2e' ); grass.addColorStop( 1, '#3d7636' );
	ctx.fillStyle = grass; ctx.fillRect( 0, H * 0.74, W, H * 0.26 );
	ctx.fillStyle = '#8a5638';
	ctx.beginPath(); ctx.ellipse( W / 2, H * 0.67, W * 0.3, H * 0.1, 0, 0, Math.PI * 2 ); ctx.fill();
	ctx.strokeStyle = 'rgba( 240, 238, 230, 0.75 )'; ctx.lineWidth = 1.5;
	for ( const s of [ - 1, 1 ] ) ctx.strokeRect( W / 2 + s * 25 - 14, H * 0.64, 28, H * 0.06 );
	const bat = UNI[ m.batting ], fld = UNI[ m.batting === 'home' ? 'away' : 'home' ];
	const lefty = m.bats === 'L';
	figure( ctx, W / 2 + 3, H * 0.655, 0.6, { pose: 'crouch', body: '#141418', cap: '#0a0a0e' } );
	figure( ctx, W / 2, H * 0.69, 0.58, { pose: 'crouch', body: '#23324f', pants: fld.pants, cap: fld.cap } );
	const swung = frame === 'after' && seg?.swing;
	figure( ctx, W / 2 + ( lefty ? 26 : - 26 ), H * 0.71, 0.76, { pose: swung ? 'swing' : 'bat', body: bat.body, pants: bat.pants, cap: bat.helmet, dir: lefty ? - 1 : 1 } );
	ctx.fillStyle = '#8f5a3a';
	ctx.beginPath(); ctx.ellipse( W * 0.4, H * 1.06, W * 0.34, H * 0.12, 0, 0, Math.PI * 2 ); ctx.fill();
	figure( ctx, W * 0.38, H * 1.16, 1.36, { pose: frame === 'throw' ? 'throw' : 'stand', body: fld.body, pants: fld.pants, cap: fld.cap, number: m.pitcher?.num || '', numColor: fld.num, back: true } );

}

// high behind home: the diamond, the outfield, the fielders; the ball in play somewhere out there
function wideShot( ctx, m, lt ) {

	crowd( ctx, 0, 0, W, H * 0.22, 9, 0.8 );
	ctx.fillStyle = '#123a2e'; ctx.fillRect( 0, H * 0.22, W, H * 0.04 );
	ctx.fillStyle = '#346a31'; ctx.fillRect( 0, H * 0.26, W, H * 0.74 );
	ctx.fillStyle = 'rgba( 255, 255, 255, 0.05 )';
	for ( let i = 0; i < 10; i ++ ) ctx.fillRect( i * W / 10, H * 0.26, W / 20, H * 0.74 );
	ctx.fillStyle = '#8a5638';
	ctx.beginPath(); ctx.moveTo( W / 2, H * 1.05 ); ctx.lineTo( W * 0.1, H * 0.72 ); ctx.quadraticCurveTo( W / 2, H * 0.36, W * 0.9, H * 0.72 ); ctx.closePath(); ctx.fill();
	ctx.fillStyle = '#346a31';
	ctx.beginPath(); ctx.moveTo( W / 2, H * 0.94 ); ctx.lineTo( W * 0.3, H * 0.72 ); ctx.lineTo( W / 2, H * 0.55 ); ctx.lineTo( W * 0.7, H * 0.72 ); ctx.closePath(); ctx.fill();
	ctx.fillStyle = '#f2f0ea';
	for ( const [ bx, by ] of [ [ 0.3, 0.72 ], [ 0.5, 0.55 ], [ 0.7, 0.72 ] ] ) ctx.fillRect( W * bx - 3, H * by - 2, 6, 4 );
	ctx.strokeStyle = 'rgba( 242, 240, 234, 0.9 )'; ctx.lineWidth = 1.5;
	ctx.beginPath(); ctx.moveTo( W / 2, H * 0.98 ); ctx.lineTo( - W * 0.2, H * 0.4 ); ctx.moveTo( W / 2, H * 0.98 ); ctx.lineTo( W * 1.2, H * 0.4 ); ctx.stroke();
	const fld = UNI[ m.batting === 'home' ? 'away' : 'home' ];
	for ( const [ px, py ] of [ [ 0.5, 0.7 ], [ 0.38, 0.6 ], [ 0.62, 0.6 ], [ 0.25, 0.7 ], [ 0.75, 0.7 ], [ 0.2, 0.42 ], [ 0.5, 0.34 ], [ 0.8, 0.42 ] ] ) figure( ctx, W * px + Math.sin( lt * 2 + px * 9 ) * 4 * Math.min( 1, lt ), H * py, 0.2, { pose: 'stand', body: fld.body, pants: fld.pants, cap: fld.cap } );
	if ( lt > 0 ) {

		// the ball
		ctx.fillStyle = '#ffffff';
		ctx.beginPath(); ctx.arc( W * ( 0.5 + 0.18 * Math.sin( lt * 0.7 ) ), H * ( 0.8 - 0.25 * Math.min( 1, lt / 2 ) ), 2.2, 0, Math.PI * 2 ); ctx.fill();

	}

}

// the tarp over the infield in the rain, the grounds crew's ropes, the puddles
function tarpShot( ctx, lt ) {

	crowd( ctx, 0, 0, W, H * 0.25, 13, 0.55 );
	ctx.fillStyle = '#0f2a22'; ctx.fillRect( 0, H * 0.25, W, H * 0.05 );
	ctx.fillStyle = '#2c4f2a'; ctx.fillRect( 0, H * 0.3, W, H * 0.7 );
	const k = Math.min( 1, lt / 6 );
	ctx.fillStyle = '#8a8f96';
	ctx.beginPath(); ctx.moveTo( W / 2, H * ( 1.1 - 0.05 * k ) ); ctx.lineTo( W * 0.08, H * 0.7 ); ctx.quadraticCurveTo( W / 2, H * ( 0.62 - 0.25 * k ), W * 0.92, H * 0.7 ); ctx.closePath(); ctx.fill();
	ctx.fillStyle = 'rgba( 255, 255, 255, 0.18 )';
	for ( let i = 0; i < 16; i ++ ) ctx.fillRect( W * ( 0.15 + i * 0.045 ), H * 0.55 + ( i % 3 ) * 20, 18, 3 );
	ctx.fillStyle = '#c8102e'; ctx.font = `900 16px ${ SANS }`; ctx.textAlign = 'center';
	ctx.fillText( 'PHILLIES', W / 2, H * 0.72 );

}

// the last out: Brad Lidge down on his knees on the grass, arms up, glove in the left hand, his back to
// the camera (LIDGE 54 in red on the pinstripes)
function lidgeShot( ctx ) {

	ctx.fillStyle = '#6e4a32'; ctx.fillRect( 0, 0, W, H * 0.25 );
	ctx.fillStyle = '#3e6e33'; ctx.fillRect( 0, H * 0.25, W, H * 0.12 );
	ctx.fillStyle = '#a0633f'; ctx.fillRect( 0, H * 0.37, W, H * 0.25 );
	ctx.fillStyle = '#3f7436'; ctx.fillRect( 0, H * 0.62, W, H * 0.38 );
	ctx.strokeStyle = 'rgba( 245, 243, 236, 0.8 )'; ctx.lineWidth = 2;
	ctx.beginPath(); ctx.moveTo( 0, H * 0.6 ); ctx.lineTo( W, H * 0.52 ); ctx.stroke();
	const cx = W * 0.43, cy = H * 0.72;
	// the arms up in the red undershirt, the glove
	ctx.strokeStyle = '#8e1426'; ctx.lineWidth = 12; ctx.lineCap = 'round';
	ctx.beginPath(); ctx.moveTo( cx - 40, cy - 70 ); ctx.lineTo( cx - 80, cy - 125 ); ctx.moveTo( cx + 40, cy - 70 ); ctx.lineTo( cx + 90, cy - 128 ); ctx.stroke();
	ctx.fillStyle = '#1b1712'; ctx.beginPath(); ctx.ellipse( cx - 86, cy - 140, 15, 19, - 0.3, 0, Math.PI * 2 ); ctx.fill();
	ctx.fillStyle = '#d9b089'; ctx.beginPath(); ctx.arc( cx + 94, cy - 134, 7, 0, Math.PI * 2 ); ctx.fill();
	// the back: pinstripes, the name and 54; the legs folded under him
	ctx.fillStyle = '#efeee9';
	ctx.beginPath(); ctx.moveTo( cx - 50, cy - 80 ); ctx.lineTo( cx + 50, cy - 80 ); ctx.lineTo( cx + 40, cy + 5 ); ctx.lineTo( cx - 40, cy + 5 ); ctx.fill();
	ctx.fillRect( cx - 60, cy + 5, 120, 42 );
	ctx.fillStyle = 'rgba( 150, 30, 50, 0.35 )';
	for ( let x = cx - 58; x < cx + 60; x += 6 ) ctx.fillRect( x, cy - 78, 1, 124 );
	ctx.fillStyle = '#6e1026'; ctx.fillRect( cx - 40, cy + 2, 80, 5 );
	ctx.fillStyle = '#9b1b2e'; ctx.font = `800 13px ${ SANS }`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
	ctx.fillText( 'LIDGE', cx, cy - 58 );
	ctx.font = `900 40px "Times New Roman", Georgia, serif`;
	ctx.fillText( '54', cx, cy - 30 );
	ctx.fillStyle = '#b3122a'; ctx.beginPath(); ctx.arc( cx, cy - 98, 17, Math.PI, Math.PI * 2 ); ctx.fill();
	ctx.fillStyle = '#5a3a2a'; ctx.beginPath(); ctx.arc( cx, cy - 92, 14, 0, Math.PI ); ctx.fill();

}

// the pile on the mound: white uniforms, the crowd's flashes
function pileShot( ctx, lt ) {

	crowd( ctx, 0, 0, W, H * 0.45, 17, 1.0 );
	for ( let i = 0; i < 60; i ++ ) {

		if ( hash( i * 7.3 + Math.floor( lt * 3 ) ) > 0.5 ) continue;
		ctx.fillStyle = 'rgba( 255, 255, 250, 0.9 )';
		ctx.beginPath(); ctx.arc( hash( i * 1.7 ) * W, hash( i * 3.1 ) * H * 0.42, 1.5, 0, Math.PI * 2 ); ctx.fill();

	}

	ctx.fillStyle = '#346a31'; ctx.fillRect( 0, H * 0.45, W, H * 0.55 );
	ctx.fillStyle = '#8f5a3a';
	ctx.beginPath(); ctx.ellipse( W / 2, H * 0.8, W * 0.36, H * 0.14, 0, 0, Math.PI * 2 ); ctx.fill();
	for ( let i = 0; i < 26; i ++ ) {

		const x = W / 2 + ( hash( i * 2.3 ) - 0.5 ) * W * 0.4, y = H * ( 0.82 - hash( i * 5.1 ) * 0.14 );
		figure( ctx, x, y, 0.5, { pose: hash( i ) > 0.6 ? 'throw' : 'stand', body: '#ecebe7', pants: '#e4e2dd', cap: '#c8102e' } );

	}

}

// ---------------------------------------------------------------- the graphics

// FOX's 2008 World Series score bug (a frame of the broadcast's last out): a silver bar across the top
// of the picture with a blue line along it, and on it the World Series and FOX box, then rounded black
// segments in white condensed caps: TB 3, PHI 4, the inning with its yellow arrow, the outs, the bases
// (yellow where there's a runner), the count or the pitch's speed in yellow, and the series (PHI LEADS
// 3-1)
function bug( ctx, st, snap, speed = 0 ) {

	const y = 4, h = 22;
	const g = ctx.createLinearGradient( 0, y, 0, y + h );
	g.addColorStop( 0, '#e3e6ec' ); g.addColorStop( 0.5, '#b8bcc6' ); g.addColorStop( 1, '#80848f' );
	ctx.fillStyle = g;
	ctx.fillRect( 0, y, W, h );
	ctx.fillStyle = '#2a4f9a'; ctx.fillRect( 0, y, W, 2 );
	const seg = ( x, w, text, bg = '#1e1a20', fg = '#ffffff', font = 12 ) => {

		ctx.fillStyle = bg;
		ctx.beginPath();
		ctx.moveTo( x + 4, y + 3 ); ctx.lineTo( x + w - 4, y + 3 ); ctx.quadraticCurveTo( x + w, y + 3, x + w, y + 7 ); ctx.lineTo( x + w, y + h - 7 );
		ctx.quadraticCurveTo( x + w, y + h - 3, x + w - 4, y + h - 3 ); ctx.lineTo( x + 4, y + h - 3 ); ctx.quadraticCurveTo( x, y + h - 3, x, y + h - 7 ); ctx.lineTo( x, y + 7 ); ctx.quadraticCurveTo( x, y + 3, x + 4, y + 3 ); ctx.fill();
		ctx.fillStyle = fg; ctx.font = `800 ${ font }px ${ SANS }`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
		ctx.fillText( text, x + w / 2, y + h / 2 + 1, w - 6 );

	};

	// the World Series / FOX box
	seg( 28, 64, '', '#1d3f8f' );
	ctx.fillStyle = '#ffffff'; ctx.font = `700 7px ${ SANS }`; ctx.textAlign = 'left';
	ctx.fillText( 'WORLD', 32, y + 9 ); ctx.fillText( 'SERIES', 32, y + 16 );
	ctx.font = `900 italic 12px ${ SANS }`; ctx.fillText( 'FOX', 62, y + 13 );
	seg( 96, 46, `TB  ${ st.score?.away ?? 0 }` );
	seg( 145, 50, `PHI  ${ st.score?.home ?? 0 }` );
	const n = st.inning || 1, ord = n === 1 ? 'ST' : n === 2 ? 'ND' : n === 3 ? 'RD' : 'TH';
	seg( 198, 40, `   ${ n }${ ord }` );
	ctx.fillStyle = '#f5c400';
	const ax = 206, ay = y + h / 2 + 1;
	ctx.beginPath();
	if ( st.half === 'top' ) {

		ctx.moveTo( ax - 4, ay + 3 ); ctx.lineTo( ax + 4, ay + 3 ); ctx.lineTo( ax, ay - 4 );

	} else {

		ctx.moveTo( ax - 4, ay - 3 ); ctx.lineTo( ax + 4, ay - 3 ); ctx.lineTo( ax, ay + 4 );

	}

	ctx.fill();
	seg( 241, 42, `${ st.outs || 0 } OUT` );
	// the bases
	const bases = snap.bases || [];
	const bx = 303, by = y + h / 2 + 1;
	for ( const [ i, dx, dy ] of [ [ 0, 8, 0 ], [ 1, 0, - 5 ], [ 2, - 8, 0 ] ] ) {

		ctx.save();
		ctx.translate( bx + dx, by + dy );
		ctx.rotate( Math.PI / 4 );
		ctx.fillStyle = '#1e1a20'; ctx.fillRect( - 4.5, - 4.5, 9, 9 );
		ctx.fillStyle = bases[ i ] ? '#f5c400' : '#d9dce3'; ctx.fillRect( - 3, - 3, 6, 6 );
		ctx.restore();

	}

	// the count while he's up, the pitch's speed once it's thrown
	const [ b, s ] = st.count || [ 0, 0 ];
	if ( speed ) seg( 322, 60, `${ Math.round( speed ) } MPH`, '#f5c400', '#141414' );
	else seg( 322, 60, `${ b }-${ s }`, '#1e1a20' );
	// the series: the Phillies up three games to one
	seg( 385, 100, st.celebrate ? 'PHI WINS 4-1' : 'PHI LEADS 3-1', '#1e1a20', '#ffffff', 11 );

}

// the lower third: the name bar in the club's colour, the line under it
function lowerThird( ctx, name, what, line, side ) {

	const y = H - 70;
	ctx.fillStyle = side === 'home' ? 'rgba( 200, 16, 46, 0.92 )' : 'rgba( 11, 42, 91, 0.92 )';
	ctx.fillRect( 40, y, W - 80, 30 );
	ctx.fillStyle = 'rgba( 6, 10, 20, 0.88 )';
	ctx.fillRect( 40, y + 30, W - 80, 24 );
	ctx.fillStyle = '#ffffff'; ctx.font = `800 16px ${ SANS }`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
	ctx.fillText( name, 52, y + 15, W - 200 );
	ctx.textAlign = 'right'; ctx.font = `700 11px ${ SANS }`;
	ctx.fillText( what, W - 52, y + 15 );
	ctx.textAlign = 'left'; ctx.fillStyle = '#e8d9b0'; ctx.font = `700 12px ${ SANS }`;
	ctx.fillText( line, 52, y + 42, W - 104 );

}

// between innings: the line score over the wide shot
function breakCard( ctx, st, intro ) {

	ctx.fillStyle = 'rgba( 4, 8, 18, 0.55 )';
	ctx.fillRect( 0, 0, W, H );
	ctx.fillStyle = 'rgba( 6, 10, 20, 0.92 )';
	ctx.fillRect( 40, 70, W - 80, 128 );
	ctx.fillStyle = '#c9a45a'; ctx.fillRect( 40, 70, W - 80, 3 );
	ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
	ctx.font = `800 13px ${ SANS }`;
	ctx.fillText( intro ? '2008 WORLD SERIES  ·  GAME 5' : `WORLD SERIES  ·  GAME 5  ·  ${ st.half === 'top' ? 'TOP' : 'BOTTOM' } ${ st.inning }`, W / 2, 90 );
	const line = st.line || [];
	const cols = 9;
	for ( let i = 0; i < cols; i ++ ) {

		const x = 128 + i * 26;
		ctx.fillStyle = '#9aa3b5'; ctx.font = `700 10px ${ SANS }`;
		ctx.fillText( String( i + 1 ), x, 114 );
		for ( const [ r, side ] of [ [ 0, 0 ], [ 1, 1 ] ] ) {

			const v = line[ i ]?.[ side ];
			ctx.fillStyle = '#ffffff'; ctx.font = `800 13px ${ SANS }`;
			ctx.fillText( v == null ? '' : String( v ), x, 138 + r * 26 );

		}

	}

	ctx.textAlign = 'left'; ctx.font = `800 13px ${ SANS }`;
	ctx.fillStyle = '#8fbce6'; ctx.fillText( 'RAYS', 60, 138 );
	ctx.fillStyle = '#ff5a6e'; ctx.fillText( 'PHILLIES', 60, 164 );
	ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff'; ctx.font = `900 15px ${ SANS }`;
	ctx.fillText( String( st.score?.away ?? 0 ), 128 + 9 * 26 + 10, 138 );
	ctx.fillText( String( st.score?.home ?? 0 ), 128 + 9 * 26 + 10, 164 );

}

// a full-width caption (the suspension, the champions)
function card( ctx, title, line, gold = false ) {

	ctx.fillStyle = gold ? 'rgba( 200, 16, 46, 0.92 )' : 'rgba( 6, 10, 20, 0.9 )';
	ctx.fillRect( 0, H - 76, W, 52 );
	ctx.fillStyle = gold ? '#ffd23f' : '#c9a45a'; ctx.fillRect( 0, H - 76, W, 3 );
	ctx.fillStyle = '#ffffff'; ctx.font = `900 20px ${ SANS }`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
	ctx.fillText( title, W / 2, H - 56, W - 30 );
	ctx.font = `700 11px ${ SANS }`; ctx.fillStyle = gold ? '#ffffff' : '#c7cbd4';
	ctx.fillText( line, W / 2, H - 36, W - 30 );

}

// the rain in the stadium's lights: streaks, and drops on the lens
function rainOver( ctx, t, amount ) {

	ctx.strokeStyle = 'rgba( 220, 225, 235, 0.22 )';
	ctx.lineWidth = 1;
	const n = Math.round( 90 * amount );
	for ( let i = 0; i < n; i ++ ) {

		const x = hash( i * 1.31 + Math.floor( t * 4 ) ) * W, y = hash( i * 2.7 + Math.floor( t * 4 ) * 0.3 ) * H;
		ctx.beginPath(); ctx.moveTo( x, y ); ctx.lineTo( x - 3, y + 14 ); ctx.stroke();

	}

	for ( let i = 0; i < 6 * amount; i ++ ) {

		ctx.fillStyle = 'rgba( 255, 255, 255, 0.08 )';
		ctx.beginPath(); ctx.arc( hash( i * 9.1 ) * W, hash( i * 4.3 ) * H, 3 + hash( i ) * 5, 0, Math.PI * 2 ); ctx.fill();

	}

}
