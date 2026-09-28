// Phanavision: what the left field board showed through a World Series night in 2008, drawn on the
// board's canvas (1600 x 1304 px over the 97 x 79 ft face).
//
//   - the ad column: the Coca-Cola panel with its contour bottle beside the matrix, Motrin's MEDICINE
//     WITH MUSCLE beside the video board (backlit posters),
//   - the amber matrix, a real lamp matrix (a lamp every 3 px, 424 x 199 of them) in the board's own
//     tall 5-dot font, laid out as in the photos of that season (Commons 2371235005, April 2008, and
//     the August 2008 one from right field): AT-BAT with the batter's season line, the other team DUE
//     UP, a zig-zag rule, the batter's box (his number, name and position over what he's done tonight),
//     the batting team's lineup with a star at the batter and its pitcher under it, and across the
//     bottom the line score with R H E and BALLS / STRIKES / OUTS. Between innings and at big moments
//     the top of it turns to amber graphics (the World Series logo as in hesb/2987305440.jpg, CHARGE!,
//     MAKE SOME NOISE, WORLD CHAMPIONS),
//   - the video board: the batter's card as he walks up (a head and shoulders portrait, the name over a
//     big chrome number, his season line), the live picture from the center field camera through the
//     at-bat with the pitch's speed after each pitch, replays of the Phillies' hits, the crowd prompts
//     (MAKE SOME NOISE with its meter, CHARGE, two strikes), between innings the line score, the
//     Phanatic and the fan cam, NOW PITCHING at a change, the rain delay and the suspension on the 27th
//     and WELCOME BACK on the 29th, and at the end 2008 WORLD CHAMPIONS with fireworks.
//
// What it shows follows the replay's clock (moment()), so scrubbing shows the same board.

// ---- R (rituals): when the suspension's announced (s into the break)
import { ANNOUNCE } from './game/Suspension.js';
// ---- end R

export const FACE_W = 1600, FACE_H = 1304;
// where things are on the face (canvas px): the matrix's lamps (3 px apart) and the video board
export const LAMPS = { x: 318, y: 12, pitch: 3, cols: 424, rows: 199 };
export const VIDEO = { x: 318, y: 630, w: 1272, h: 620 };
const AD = { x: 10, w: 290, y0: 12, y1: 609, y2: 630, y3: 1250 };

const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const HEAVY = '"Arial Black", "Helvetica Neue", Arial, sans-serif';
const NARROW = '"Arial Narrow", "Helvetica Neue", Arial, sans-serif';
const AMBER = [ 255, 168, 38 ];

// ---------------------------------------------------------------- the lamp font

// 5 x 7 glyphs, stretched to the matrix's tall 5 x 11 face (rows 1, 2, 4 and 5 doubled: the bars at
// the top, middle and bottom stay one lamp thick)
const GLYPHS = {
	0: '01110 10001 10011 10101 11001 10001 01110', 1: '00100 01100 00100 00100 00100 00100 01110',
	2: '01110 10001 00001 00010 00100 01000 11111', 3: '11111 00010 00100 00010 00001 10001 01110',
	4: '00010 00110 01010 10010 11111 00010 00010', 5: '11111 10000 11110 00001 00001 10001 01110',
	6: '00110 01000 10000 11110 10001 10001 01110', 7: '11111 00001 00010 00100 01000 01000 01000',
	8: '01110 10001 10001 01110 10001 10001 01110', 9: '01110 10001 10001 01111 00001 00010 01100',
	A: '01110 10001 10001 10001 11111 10001 10001', B: '11110 10001 10001 11110 10001 10001 11110',
	C: '01110 10001 10000 10000 10000 10001 01110', D: '11100 10010 10001 10001 10001 10010 11100',
	E: '11111 10000 10000 11110 10000 10000 11111', F: '11111 10000 10000 11110 10000 10000 10000',
	G: '01110 10001 10000 10111 10001 10001 01111', H: '10001 10001 10001 11111 10001 10001 10001',
	I: '01110 00100 00100 00100 00100 00100 01110', J: '00111 00010 00010 00010 00010 10010 01100',
	K: '10001 10010 10100 11000 10100 10010 10001', L: '10000 10000 10000 10000 10000 10000 11111',
	M: '10001 11011 10101 10101 10001 10001 10001', N: '10001 10001 11001 10101 10011 10001 10001',
	O: '01110 10001 10001 10001 10001 10001 01110', P: '11110 10001 10001 11110 10000 10000 10000',
	Q: '01110 10001 10001 10001 10101 10010 01101', R: '11110 10001 10001 11110 10100 10010 10001',
	S: '01111 10000 10000 01110 00001 00001 11110', T: '11111 00100 00100 00100 00100 00100 00100',
	U: '10001 10001 10001 10001 10001 10001 01110', V: '10001 10001 10001 10001 10001 01010 00100',
	W: '10001 10001 10001 10101 10101 10101 01010', X: '10001 10001 01010 00100 01010 10001 10001',
	Y: '10001 10001 10001 01010 00100 00100 00100', Z: '11111 00001 00010 00100 01000 10000 11111',
	'.': '00000 00000 00000 00000 00000 01100 01100', ',': '00000 00000 00000 00000 01100 00100 01000',
	':': '00000 01100 01100 00000 01100 01100 00000', '-': '00000 00000 00000 11111 00000 00000 00000',
	'#': '01010 01010 11111 01010 11111 01010 01010', '*': '00000 00100 10101 01110 10101 00100 00000',
	'\'': '01100 00100 01000 00000 00000 00000 00000', '/': '00000 00001 00010 00100 01000 10000 00000',
	'!': '00100 00100 00100 00100 00100 00000 00100', '?': '01110 10001 00001 00010 00100 00000 00100',
	'(': '00010 00100 01000 01000 01000 00100 00010', ')': '01000 00100 00010 00010 00010 00100 01000',
	'&': '01100 10010 10100 01000 10101 10010 01101', '+': '00000 00100 00100 11111 00100 00100 00000',
	'=': '00000 00000 11111 00000 11111 00000 00000', ' ': '00000 00000 00000 00000 00000 00000 00000',
};
const TALL = [ 0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6 ];
const FONT = {};
for ( const [ c, s ] of Object.entries( GLYPHS ) ) FONT[ c ] = TALL.map( ( r ) => s.split( ' ' )[ r ] );
const CH = 6, LINE = 14, GH = TALL.length; // a character cell, a line, the glyphs' height (lamps)

// The matrix as lamps: text in the lamp font sets lamps, graphics are drawn over them on the canvas
// (their soft edges light lamps part way, as the board's dimmer did)
class Lamps {

	constructor( cols, rows ) {

		this.cols = cols;
		this.rows = rows;
		this.v = new Float32Array( cols * rows );
		this.canvas = new OffscreenCanvas( cols, rows );
		this.ctx = this.canvas.getContext( '2d' );
		this.img = this.ctx.createImageData( cols, rows );

	}

	clear() {

		this.v.fill( 0 );

	}

	set( x, y, k ) {

		x = Math.round( x ); y = Math.round( y );
		if ( x < 0 || y < 0 || x >= this.cols || y >= this.rows ) return;
		this.v[ y * this.cols + x ] = k;

	}

	width( s, bold = false ) {

		return s.length * CH * ( bold ? 2 : 1 ) - ( bold ? 2 : 1 );

	}

	// s at lamp x, y (its top left); bold doubles every column; k 0 turns lamps off (on a lit bar)
	text( s, x, y, { bold = false, k = 1, align = 'left' } = {} ) {

		s = String( s ).toUpperCase();
		const w = this.width( s, bold );
		if ( align === 'right' ) x -= w;
		if ( align === 'center' ) x -= Math.floor( w / 2 );
		const sx = bold ? 2 : 1;
		for ( let i = 0; i < s.length; i ++ ) {

			const g = FONT[ s[ i ] ] || FONT[ ' ' ];
			const ox = x + i * CH * sx;
			for ( let r = 0; r < GH; r ++ ) for ( let c = 0; c < 5; c ++ ) if ( g[ r ][ c ] === '1' ) for ( let b = 0; b < sx; b ++ ) this.set( ox + c * sx + b, y + r, k );

		}

		return w;

	}

	fill( x, y, w, h, k = 1 ) {

		for ( let j = 0; j < h; j ++ ) for ( let i = 0; i < w; i ++ ) this.set( x + i, y + j, k );

	}

	// the lamps as amber pixels, ready for graphics on top
	flush() {

		const d = this.img.data, v = this.v;
		for ( let i = 0; i < v.length; i ++ ) {

			const k = v[ i ];
			d[ i * 4 ] = AMBER[ 0 ] * k; d[ i * 4 + 1 ] = AMBER[ 1 ] * k; d[ i * 4 + 2 ] = AMBER[ 2 ] * k; d[ i * 4 + 3 ] = 255;

		}

		this.ctx.putImageData( this.img, 0, 0 );

	}

}

// ---------------------------------------------------------------- the players

// 2008 regular seasons (AVG, HR, RBI; pitchers W-L, ERA) for the at-bat panel and the cards; for the
// players traded that summer (Gross, Eyre, Blanton, Bradford) the whole season, both teams (Baseball-
// Reference, checked against StatMuse)
// ---- W2 (concourse): exported (SEASON, PITCHING) for the concourse TVs' lower thirds
export const SEASON = {
	Rollins: [ '.277', 11, 59 ], Werth: [ '.273', 24, 67 ], Utley: [ '.292', 33, 104 ], Howard: [ '.251', 48, 146 ],
	Burrell: [ '.250', 33, 86 ], Victorino: [ '.293', 14, 58 ], Feliz: [ '.249', 14, 58 ], Ruiz: [ '.219', 4, 31 ],
	Jenkins: [ '.246', 9, 29 ], Dobbs: [ '.301', 9, 40 ], Stairs: [ '.250', 13, 49 ], Bruntlett: [ '.217', 2, 15 ], Coste: [ '.263', 9, 36 ],
	Iwamura: [ '.274', 6, 48 ], Upton: [ '.273', 9, 67 ], Pena: [ '.247', 31, 102 ], Longoria: [ '.272', 27, 85 ], Crawford: [ '.273', 8, 57 ],
	Navarro: [ '.295', 7, 54 ], Baldelli: [ '.263', 4, 13 ], Bartlett: [ '.286', 1, 37 ], Aybar: [ '.253', 10, 33 ], Hinske: [ '.247', 20, 60 ],
	Zobrist: [ '.253', 12, 30 ], Gross: [ '.238', 13, 40 ], Perez: [ '.250', 3, 8 ], Johnson: [ '.158', 0, 0 ],
};
export const PITCHING = {
	Hamels: [ '14-10', '3.09' ], Madson: [ '4-2', '3.05' ], Romero: [ '4-4', '2.75' ], Lidge: [ '2-0', '1.95', 41 ], Durbin: [ '5-4', '2.87' ],
	Myers: [ '10-13', '4.55' ], Moyer: [ '16-7', '3.71' ], Kazmir: [ '12-8', '3.49' ], Balfour: [ '6-2', '1.54' ], Howell: [ '6-1', '2.22' ],
	Wheeler: [ '5-6', '3.12', 13 ], Price: [ '1-0', '1.93' ], Garza: [ '11-9', '3.70' ], Shields: [ '14-8', '3.56' ], Sonnanstine: [ '13-9', '4.38' ],
	Eyre: [ '5-0', '4.21' ], Condrey: [ '3-4', '3.26', 1 ], Blanton: [ '9-12', '4.69' ], Bradford: [ '4-3', '2.12' ],
};
// what the portraits need: skin (0 fair .. 3 dark) and the face's hair
const LOOKS = {
	Rollins: [ 3, 'goatee' ], Werth: [ 0, 'beard' ], Utley: [ 0, 'stubble' ], Howard: [ 3, 'goatee' ], Burrell: [ 0, 'stubble' ],
	Victorino: [ 1, 'goatee' ], Feliz: [ 2, 'mustache' ], Ruiz: [ 2, 'goatee' ], Hamels: [ 0, '' ], Jenkins: [ 0, 'stubble' ], Dobbs: [ 0, '' ],
	Stairs: [ 0, 'goatee' ], Bruntlett: [ 0, '' ], Coste: [ 0, '' ], Madson: [ 0, '' ], Romero: [ 1, 'goatee' ], Lidge: [ 0, 'goatee' ],
	Durbin: [ 0, 'stubble' ], Eyre: [ 0, 'beard' ], Iwamura: [ 1, '' ], Upton: [ 3, 'mustache' ], Pena: [ 2, 'goatee' ], Longoria: [ 1, '' ],
	Crawford: [ 3, 'goatee' ], Navarro: [ 2, 'goatee' ], Baldelli: [ 0, '' ], Bartlett: [ 0, '' ], Aybar: [ 2, '' ], Hinske: [ 0, 'goatee' ],
	Zobrist: [ 0, '' ], Gross: [ 0, 'stubble' ], Perez: [ 2, '' ], Kazmir: [ 0, '' ], Balfour: [ 0, 'goatee' ], Howell: [ 0, '' ],
	Wheeler: [ 0, 'stubble' ], Bradford: [ 0, '' ], Price: [ 3, '' ], Garza: [ 1, 'goatee' ],
};
const POSITIONS = { P: 'PITCHER', C: 'CATCHER', '1B': 'FIRST BASEMAN', '2B': 'SECOND BASEMAN', '3B': 'THIRD BASEMAN', SS: 'SHORTSTOP', LF: 'LEFT FIELDER', CF: 'CENTER FIELDER', RF: 'RIGHT FIELDER', PH: 'PINCH HITTER', PR: 'PINCH RUNNER', DH: 'DESIGNATED HITTER' };
const cap = ( s ) => String( s || '' ).charAt( 0 ) + String( s || '' ).slice( 1 ).toLowerCase();
const hashS = ( s ) => {

	let h = 7;
	for ( const c of String( s ) ) h = ( h * 31 + c.charCodeAt( 0 ) ) % 100003;
	return h / 100003;

};

// ---------------------------------------------------------------- the board

export class Phanavision {

	constructor() {

		this.canvas = new OffscreenCanvas( FACE_W, FACE_H );
		this.lamps = new Lamps( LAMPS.cols, LAMPS.rows );
		this.ads = new OffscreenCanvas( FACE_W, FACE_H );
		drawAdColumn( this.ads.getContext( '2d' ) );

	}

	// what the replay is doing now, as far as the board cares
	moment( d ) {

		if ( ! d ) return null;
		const seg = d.segmentAt( d.t ), s = seg.snap || {}, g = d.game;
		const lt = d.t - seg.t0;
		const play = seg.pi != null ? g.plays[ seg.pi ] : null;
		const before = seg.before?.score, after = s.score;
		const m = {
			kind: seg.kind, lt, dur: seg.dur, t: d.t, inning: s.inning, half: s.half, batting: s.batting || 'away',
			bases: s.bases || [], balls: s.balls || 0, strikes: s.strikes || 0, outs: s.outs || 0,
			batter: g.players[ s.batter ], pitcher: g.players[ s.pitcher ], bats: s.bats, score: s.score,
			// the pitch: thrown (3 s of set, then the delivery to the release) and its speed
			thrown: seg.kind === 'pitch' && lt > 3.6, speed: seg.ev?.speed, pitchType: seg.ev?.typeName,
			result: seg.kind === 'result' ? play?.result?.type : null,
			scored: before && after ? ( after.away + after.home ) - ( before.away + before.home ) : 0,
			susp: seg.kind === 'switch' && s.inning === 6 && s.half === 'bottom',
			last: seg.pi === g.plays.length - 1,
		};
		// the other team's first three due up (the next half inning's batters)
		m.dueUp = [];
		if ( play ) {

			for ( let j = seg.pi + 1; j < g.plays.length && m.dueUp.length < 3; j ++ ) {

				const q = g.plays[ j ];
				if ( q.half === play.half && ! m.dueUp.length ) continue;
				if ( q.half === play.half ) break;
				const b = g.players[ q.batter ];
				const tag = b ? `${ b.num } ${ b.last.toUpperCase() }` : '';
				if ( tag && ! m.dueUp.includes( tag ) ) m.dueUp.push( tag );

			}

		}

		// ---- A (Phanatic): what he's doing out there (places/Phanatic.js: the caption for the board, or null)
		m.phan = d.phanatic?.board?.( d.t ) || null;
		// ---- end A
		m.show = this._pick( m );
		return m;

	}

	// which screens, and the animation's frame
	_pick( m ) {

		const k = m.kind, lt = m.lt;
		const tick = ( hz ) => Math.floor( lt * hz );
		const home = m.batting === 'home';
		if ( k === 'celebrate' ) return { video: [ 'champs', 'pile', 'champs', 'thanks' ][ Math.floor( lt / 9 ) % 4 ], matrix: 'champs', frame: tick( 3 ) };
		if ( k === 'intro' ) return { video: 'title', matrix: 'logo', frame: 0 };
		// ---- R (rituals): once it's called off, the suspension's message (the board's own words, Getty
		// 83458512, AP 4551252), until the 29th
		if ( m.susp && lt >= ANNOUNCE && lt < m.dur * 0.55 ) return { video: 'suspended', matrix: 'stats', frame: 0 };
		// ---- end R
		if ( m.susp ) return { video: lt < m.dur * 0.55 ? 'rain' : 'resume', matrix: lt < m.dur * 0.55 ? 'stats' : 'logo', frame: tick( 1 ) % 2 };
		// ---- A (Phanatic): while he's out on the field or a dugout roof in a break, the board's on him
		// (after the line score's first six seconds), with what he's up to
		if ( k === 'switch' && m.phan && lt > 6 && lt < m.dur - 2 ) return { video: 'phanatic', matrix: 'stats', frame: tick( 3 ), caption: m.phan };
		// ---- end A
		if ( k === 'switch' ) {

			const c = Math.floor( lt / 6 );
			const v = [ 'linescore', m.half === 'bottom' ? 'phanatic' : 'fancam', m.half === 'bottom' ? 'october' : 'phanatic', 'linescore' ][ c % 4 ];
			return { video: v, matrix: c === 0 ? 'logo' : 'stats', frame: v === 'phanatic' || v === 'fancam' ? tick( 3 ) : 0 };

		}

		if ( k === 'walkup' ) return { video: 'batter', matrix: 'stats', frame: 0 };
		if ( k === 'change' ) return { video: lt < 4 ? 'pitchchange' : 'pitcher', matrix: 'stats', frame: 0 };
		if ( k === 'pitch' || k === 'steal' ) {

			// rallies: the Phillies with a runner in scoring position; the crowd on its feet at two strikes
			if ( home && ( m.bases[ 1 ] || m.bases[ 2 ] ) && Math.floor( m.t / 8 ) % 2 === 0 ) return { video: 'noise', matrix: Math.floor( m.t / 4 ) % 2 ? 'charge' : 'stats', frame: tick( 4 ) };
			if ( ! home && m.strikes === 2 ) return { video: m.outs === 2 && m.inning >= 9 && m.last ? 'onemore' : 'twostrikes', matrix: 'noise', frame: tick( 4 ) };
			if ( m.balls + m.strikes === 0 && ! m.thrown ) return { video: 'batter', matrix: 'stats', frame: 0 };
			return { video: 'live', matrix: 'stats', frame: m.thrown ? 1 : 0 };

		}

		if ( k === 'inplay' ) return { video: 'wide', matrix: 'stats', frame: 0 };
		if ( k === 'result' ) {

			const hit = /single|double|triple|home_run/.test( m.result || '' );
			if ( home && m.scored > 0 ) return { video: 'score', matrix: 'charge', frame: tick( 3 ) };
			if ( home && hit ) return { video: 'replay', matrix: 'stats', frame: 0 };
			if ( ! home && /strikeout/.test( m.result || '' ) ) return { video: 'strikeout', matrix: 'stats', frame: tick( 3 ) };
			return { video: 'live', matrix: 'stats', frame: 2 };

		}

		return { video: 'live', matrix: 'stats', frame: 0 };

	}

	// changes whenever the board needs drawing again
	key( d ) {

		const m = this.moment( d );
		if ( ! m ) return '';
		const s = m.show;
		return [ s.video, s.matrix, s.frame, m.thrown ? Math.round( m.speed || 0 ) : 0, s.caption || '' ].join( '|' );

	}

	// the whole face into ctx (st: Director.boardState(), m: moment())
	draw( ctx, st, m ) {

		let S = st || {
			teams: { away: { abbr: 'TB', club: 'Rays' }, home: { abbr: 'PHI', club: 'Phillies' } },
			line: [], score: { away: 0, home: 0 }, hits: { away: 0, home: 0 }, errors: { away: 0, home: 0 },
			count: [ 0, 0 ], outs: 0, lineup: [], dueUp: [], today: [], batter: null, video: { kind: 'title' },
		};
		const show = m?.show || { video: 'title', matrix: 'logo', frame: 0 };
		if ( m ) S = { ...S, otherDueUp: m.dueUp, pitchNow: m.thrown };
		ctx.save();
		ctx.fillStyle = '#030406';
		ctx.fillRect( 0, 0, FACE_W, FACE_H );
		ctx.drawImage( this.ads, 0, 0 );
		// the matrix
		const L = this.lamps;
		L.clear();
		drawMatrix( L, S, m, show );
		L.flush();
		drawMatrixGraphics( L.ctx, S, m, show );
		ctx.imageSmoothingEnabled = false;
		ctx.drawImage( L.canvas, LAMPS.x, LAMPS.y, LAMPS.cols * LAMPS.pitch, LAMPS.rows * LAMPS.pitch );
		ctx.imageSmoothingEnabled = true;
		// the video board
		ctx.save();
		ctx.beginPath();
		ctx.rect( VIDEO.x, VIDEO.y, VIDEO.w, VIDEO.h );
		ctx.clip();
		ctx.translate( VIDEO.x, VIDEO.y );
		drawVideo( ctx, VIDEO.w, VIDEO.h, S, m, show );
		ctx.restore();
		// the maker's name under it
		ctx.fillStyle = '#b8c2cc';
		ctx.font = `700 22px ${ SANS }`;
		ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
		ctx.fillText( 'P H I L I P S', VIDEO.x + VIDEO.w / 2, VIDEO.y + VIDEO.h + 26 );
		ctx.restore();

	}

}

// ---------------------------------------------------------------- the ad column

function drawAdColumn( ctx ) {

	const { x, w, y0, y1, y2, y3 } = AD;
	// Coca-Cola: red, the white contour bottle standing in it, the script under it
	ctx.save();
	ctx.beginPath(); ctx.rect( x, y0, w, y1 - y0 ); ctx.clip();
	const red = ctx.createLinearGradient( x, y0, x + w, y1 );
	red.addColorStop( 0, '#e2141f' ); red.addColorStop( 1, '#b50d17' );
	ctx.fillStyle = red; ctx.fillRect( x, y0, w, y1 - y0 );
	// a soft ribbon of white behind the bottle (the "dynamic ribbon")
	ctx.strokeStyle = 'rgba( 255, 255, 255, 0.18 )'; ctx.lineWidth = 16;
	ctx.beginPath(); ctx.moveTo( x - 10, y0 + 420 ); ctx.bezierCurveTo( x + 80, y0 + 360, x + 190, y0 + 470, x + w + 10, y0 + 390 ); ctx.stroke();
	contourBottle( ctx, x + w / 2, y0 + 40, 330 );
	ctx.fillStyle = '#ffffff';
	ctx.font = `italic 700 66px "Snell Roundhand", "Brush Script MT", Georgia, serif`;
	ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
	ctx.fillText( 'Coca-Cola', x + w / 2, y0 + 460, w - 26 );
	ctx.font = `600 18px ${ SANS }`;
	ctx.fillText( 'THE OFFICIAL SOFT DRINK OF THE PHILLIES', x + w / 2, y0 + 540, w - 30 );
	ctx.restore();
	// Motrin: dark panel, orange stencil capitals, the yellow box of Motrin IB, the address
	ctx.save();
	ctx.beginPath(); ctx.rect( x, y2, w, y3 - y2 ); ctx.clip();
	const dk = ctx.createLinearGradient( x, y2, x, y3 );
	dk.addColorStop( 0, '#221a14' ); dk.addColorStop( 1, '#0d0a08' );
	ctx.fillStyle = dk; ctx.fillRect( x, y2, w, y3 - y2 );
	ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
	ctx.fillStyle = '#ef8a2a';
	[ [ 'MEDICINE', 64 ], [ 'WITH', 44 ], [ 'MUSCLE', 72 ] ].forEach( ( [ t, s ], i ) => {

		ctx.font = `800 ${ s }px ${ NARROW }`;
		ctx.fillText( t, x + w / 2, y2 + 70 + i * 74, w - 30 );

	} );
	// the box
	const bx = x + 40, by = y2 + 300, bw = w - 80, bh = 150;
	ctx.fillStyle = '#f2c21a'; ctx.fillRect( bx, by, bw, bh );
	ctx.fillStyle = '#f7d95a'; ctx.fillRect( bx, by, bw, 14 );
	ctx.fillStyle = '#c7361c'; ctx.fillRect( bx + 10, by + bh - 34, bw - 20, 22 );
	ctx.fillStyle = '#1b3f8e';
	ctx.font = `italic 800 52px ${ SANS }`;
	ctx.fillText( 'Motrin', bx + bw / 2, by + 58, bw - 20 );
	ctx.font = `700 20px ${ SANS }`;
	ctx.fillText( 'IB  IBUPROFEN TABLETS', bx + bw / 2, by + 96, bw - 20 );
	ctx.fillStyle = '#ffffff'; ctx.font = `700 14px ${ SANS }`;
	ctx.fillText( 'PAIN RELIEVER / FEVER REDUCER', bx + bw / 2, by + bh - 22, bw - 30 );
	ctx.fillStyle = '#d8cfc4';
	ctx.font = `600 24px ${ SANS }`;
	ctx.fillText( 'www.motrin.com', x + w / 2, y2 + 540 );
	ctx.fillStyle = 'rgba( 239, 138, 42, 0.5 )';
	ctx.fillRect( x + 30, y2 + 500, w - 60, 3 );
	ctx.restore();

}

// the contour bottle, standing (top at y, h tall), white with the light in its flutes
function contourBottle( ctx, cx, y, h ) {

	const k = h / 330;
	const P = ( dx, dy ) => [ cx + dx * k, y + dy * k ];
	ctx.save();
	ctx.beginPath();
	ctx.moveTo( ...P( - 13, 0 ) ); ctx.lineTo( ...P( 13, 0 ) );
	ctx.lineTo( ...P( 15, 70 ) );
	ctx.bezierCurveTo( ...P( 18, 100 ), ...P( 44, 120 ), ...P( 44, 170 ) );
	ctx.bezierCurveTo( ...P( 44, 200 ), ...P( 30, 215 ), ...P( 32, 245 ) );
	ctx.bezierCurveTo( ...P( 34, 270 ), ...P( 44, 290 ), ...P( 42, 330 ) );
	ctx.lineTo( ...P( - 42, 330 ) );
	ctx.bezierCurveTo( ...P( - 44, 290 ), ...P( - 34, 270 ), ...P( - 32, 245 ) );
	ctx.bezierCurveTo( ...P( - 30, 215 ), ...P( - 44, 200 ), ...P( - 44, 170 ) );
	ctx.bezierCurveTo( ...P( - 44, 120 ), ...P( - 18, 100 ), ...P( - 15, 70 ) );
	ctx.closePath();
	const g = ctx.createLinearGradient( cx - 44 * k, 0, cx + 44 * k, 0 );
	g.addColorStop( 0, '#d9d6d2' ); g.addColorStop( 0.35, '#ffffff' ); g.addColorStop( 0.6, '#f1efec' ); g.addColorStop( 1, '#bdb8b3' );
	ctx.fillStyle = g;
	ctx.fill();
	ctx.clip();
	// the flutes and the label band
	ctx.strokeStyle = 'rgba( 150, 140, 135, 0.55 )'; ctx.lineWidth = 3 * k;
	for ( const dx of [ - 26, - 13, 0, 13, 26 ] ) {

		ctx.beginPath(); ctx.moveTo( ...P( dx * 0.8, 120 ) ); ctx.bezierCurveTo( ...P( dx, 160 ), ...P( dx * 0.7, 200 ), ...P( dx * 0.75, 235 ) ); ctx.stroke();
		ctx.beginPath(); ctx.moveTo( ...P( dx * 0.8, 262 ) ); ctx.lineTo( ...P( dx * 0.95, 325 ) ); ctx.stroke();

	}

	ctx.fillStyle = 'rgba( 200, 20, 30, 0.85 )';
	ctx.fillRect( ...P( - 45, 238 ), 90 * k, 22 * k );
	ctx.fillStyle = '#ffffff';
	ctx.font = `italic 700 ${ 15 * k }px Georgia, serif`;
	ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
	ctx.fillText( 'Coca-Cola', cx, y + 250 * k );
	ctx.restore();
	// the cap
	ctx.fillStyle = '#c8c3bd';
	ctx.fillRect( ...P( - 15, - 12 ), 30 * k, 14 * k );

}

// ---------------------------------------------------------------- the matrix

// the columns of the stats screen (lamps)
const COL1 = 3, RULE = 98, BOX = 106, BOXW = 162, COL3 = 274, RIGHT = 421;
const lineY = ( i ) => 2 + i * LINE;

function drawMatrix( L, S, m, show ) {

	const top = show.matrix === 'stats' || ! show.matrix;
	if ( top ) statsScreen( L, S );
	lineScore( L, S );

}

function statsScreen( L, S ) {

	const batting = S.batting || 'away', fielding = batting === 'home' ? 'away' : 'home';
	// AT-BAT: the batter and his season, then the other team's first three due up
	L.text( 'AT-BAT:', COL1, lineY( 0 ) );
	const b = S.batter;
	if ( b ) {

		L.text( b.last, COL1 + 12, lineY( 1 ) );
		const sea = SEASON[ cap( b.last ) ];
		const pit = PITCHING[ cap( b.last ) ];
		if ( sea ) {

			[ [ 'AVG.', sea[ 0 ] ], [ 'HR', sea[ 1 ] ], [ 'RBI', sea[ 2 ] ] ].forEach( ( [ k, v ], i ) => {

				L.text( k, COL1 + 6, lineY( 2 + i ) );
				L.text( v, RULE - 6, lineY( 2 + i ), { align: 'right' } );

			} );

		} else if ( pit ) {

			L.text( 'W-L', COL1 + 6, lineY( 2 ) ); L.text( pit[ 0 ], RULE - 6, lineY( 2 ), { align: 'right' } );
			L.text( 'ERA', COL1 + 6, lineY( 3 ) ); L.text( pit[ 1 ], RULE - 6, lineY( 3 ), { align: 'right' } );

		}

	}

	L.text( ( S.teams?.[ fielding ]?.club || '' ), COL1, lineY( 5 ) );
	L.text( 'DUE UP:', COL1, lineY( 6 ) );
	( S.otherDueUp || S.dueUp || [] ).slice( 0, 3 ).forEach( ( d, i ) => L.text( String( d ).slice( 0, 14 ), COL1, lineY( 7 + i ) ) );
	// the zig-zag rule
	for ( let y = 0; y < lineY( 10 ) + 10; y ++ ) L.set( RULE + ( Math.floor( y / 3 ) % 2 ? 2 : 0 ) + ( y % 3 === 1 ? 1 : 0 ), y, 1 );
	// the batter's box: his number, name, position on a lit bar, then his night
	for ( let x = BOX; x < BOX + BOXW; x ++ ) {

		L.set( x, 0, 1 );
		L.set( x, lineY( 10 ) + 11, 1 );

	}

	for ( let y = 0; y <= lineY( 10 ) + 11; y ++ ) {

		L.set( BOX, y, 1 );
		L.set( BOX + BOXW - 1, y, 1 );

	}

	if ( b ) {

		L.fill( BOX + 2, 2, BOXW - 4, LINE - 1 );
		L.text( b.num, BOX + 6, lineY( 0 ) + 1, { k: 0 } );
		L.text( b.last, BOX + BOXW / 2, lineY( 0 ) + 1, { k: 0, align: 'center' } );
		L.text( b.pos, BOX + BOXW - 6, lineY( 0 ) + 1, { k: 0, align: 'right' } );
		const today = S.today || [];
		const ab = today.filter( ( t ) => ! /WALKED|HIT BY|SACRIFICED/.test( t ) ).length;
		const h = today.filter( ( t ) => /SINGLED|DOUBLED|TRIPLED|HOMERED/.test( t ) ).length;
		L.text( today.length ? `${ h } FOR ${ ab }` : 'FIRST AT-BAT', BOX + 8, lineY( 1 ) + 4 );
		today.slice( - 5 ).forEach( ( t, i ) => L.text( t.slice( 0, 26 ), BOX + 8, lineY( 3 + i ) ) );
		if ( S.lastPitch?.speed && S.pitchNow ) {

			L.text( 'PITCH SPEED', BOX + 8, lineY( 9 ) );
			L.text( `${ Math.round( S.lastPitch.speed ) } MPH`, BOX + BOXW - 8, lineY( 9 ), { align: 'right' } );

		}

	}

	// the batting team's lineup, a star at the batter, its pitcher under it
	L.text( ( S.teams?.[ batting ]?.club || '' ), RIGHT, lineY( 0 ), { bold: true, align: 'right' } );
	( S.lineup || [] ).slice( 0, 9 ).forEach( ( l, i ) => {

		if ( l.up ) L.text( '*', COL3, lineY( 1 + i ) );
		L.text( String( l.num ), COL3 + 20, lineY( 1 + i ), { align: 'right' } );
		L.text( String( l.last ).slice( 0, 12 ), COL3 + 26, lineY( 1 + i ) );
		L.text( l.pos, RIGHT, lineY( 1 + i ), { align: 'right' } );

	} );
	const p = ( S.lineup || [] ).find( ( l ) => l.pos === 'P' );
	if ( p ) L.text( `# ${ p.num } ${ p.last }`.slice( 0, 22 ), COL3, lineY( 10 ) );

}

function lineScore( L, S ) {

	const y0 = lineY( 11 ) + 1;
	for ( let x = 0; x < L.cols; x ++ ) L.set( x, y0 - 3, 0.35 );
	const ix = ( i ) => 70 + i * 16; // inning i's column
	const innings = Math.max( 9, ( S.line || [] ).length );
	for ( let i = 1; i <= innings; i ++ ) L.text( String( i ), ix( i ) - ( i > 9 ? 3 : 0 ), y0, { align: i > 9 ? 'left' : 'left' } );
	const rx = ix( innings ) + 24;
	[ 'R', 'H', 'E' ].forEach( ( t, i ) => L.text( t, rx + i * 16, y0 ) );
	[ [ 'away', 0 ], [ 'home', 1 ] ].forEach( ( [ side, r ] ) => {

		const y = y0 + ( r + 1 ) * LINE;
		L.text( ( S.teams?.[ side ]?.club || '' ).slice( 0, 9 ), COL1, y );
		for ( let i = 1; i <= innings; i ++ ) {

			const v = S.line?.[ i - 1 ]?.[ r ];
			if ( v != null ) L.text( String( v ), ix( i ), y );

		}

		[ S.score?.[ side ] ?? 0, S.hits?.[ side ] ?? 0, S.errors?.[ side ] ?? 0 ].forEach( ( v, i ) => L.text( String( v ), rx + i * 16 + 2, y, { align: 'center' } ) );

	} );
	// BALLS / STRIKES / OUTS behind a rule
	const cx = rx + 58;
	for ( let y = y0 - 2; y < L.rows; y ++ ) L.set( cx - 5, y, 1 );
	[ [ 'BALLS', S.count?.[ 0 ] ?? 0 ], [ 'STRIKES', S.count?.[ 1 ] ?? 0 ], [ 'OUTS', S.outs ?? 0 ] ].forEach( ( [ k, v ], i ) => {

		L.text( k, cx, y0 + i * LINE );
		L.text( String( v ), RIGHT, y0 + i * LINE, { align: 'right' } );

	} );

}

// the amber graphics over the top of the matrix (the line score stays under them)
function drawMatrixGraphics( ctx, S, m, show ) {

	const kind = show.matrix;
	if ( kind === 'stats' || ! kind ) return;
	const W = LAMPS.cols, H = lineY( 11 ) - 5;
	ctx.save();
	ctx.fillStyle = '#000000';
	ctx.fillRect( 0, 0, W, H );
	const amber = ( k = 1 ) => `rgba( ${ AMBER[ 0 ] }, ${ AMBER[ 1 ] }, ${ AMBER[ 2 ] }, ${ k } )`;
	ctx.fillStyle = amber();
	ctx.strokeStyle = amber();
	ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
	const f = show.frame || 0;
	if ( kind === 'logo' ) {

		// the 2008 World Series logo in lamps: the shield, WORLD SERIES arched over 2008, the trophy's flags
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.moveTo( W / 2 - 150, 22 ); ctx.lineTo( W / 2 + 150, 22 ); ctx.lineTo( W / 2 + 138, 118 ); ctx.quadraticCurveTo( W / 2, 160, W / 2 - 138, 118 ); ctx.closePath();
		ctx.stroke();
		ctx.fillStyle = amber( 0.35 );
		ctx.fillRect( W / 2 - 34, 26, 68, 26 );
		ctx.fillStyle = amber();
		ctx.font = `900 44px ${ HEAVY }`;
		ctx.fillText( 'WORLD', W / 2, 72, 260 );
		ctx.fillText( 'SERIES', W / 2, 110, 280 );
		ctx.font = `800 24px ${ SANS }`;
		ctx.fillText( '2008', W / 2, 142 );
		for ( const s of [ - 1, 1 ] ) {

			ctx.font = `800 20px ${ SANS }`;
			ctx.fillText( s < 0 ? 'RAYS' : 'PHILLIES', W / 2 + s * 178, 80 );
			ctx.fillText( s < 0 ? `${ S.score?.away ?? 0 }` : `${ S.score?.home ?? 0 }`, W / 2 + s * 178, 112 );

		}

	} else if ( kind === 'charge' ) {

		ctx.font = `italic 900 96px ${ HEAVY }`;
		ctx.fillText( 'CHARGE!', W / 2, H / 2 + 4, W - 30 );
		// the bugle's notes
		for ( let i = 0; i < 4; i ++ ) ctx.fillRect( 14 + i * 12, 20 + ( ( i + f ) % 4 ) * 6, 6, 5 );

	} else if ( kind === 'noise' ) {

		ctx.font = `900 50px ${ HEAVY }`;
		ctx.fillText( 'MAKE SOME', W / 2, 42, W - 40 );
		ctx.fillText( 'NOISE!', W / 2, 100, W - 40 );
		const n = 4 + ( f % 8 );
		for ( let i = 0; i < 12; i ++ ) {

			ctx.fillStyle = amber( i < n ? 1 : 0.15 );
			ctx.fillRect( 20 + i * 33, 132, 26, 12 );

		}

	} else if ( kind === 'champs' ) {

		ctx.globalAlpha = f % 2 ? 1 : 0.85;
		ctx.font = `900 40px ${ HEAVY }`;
		ctx.fillText( 'PHILLIES WIN!', W / 2, 34, W - 40 );
		ctx.font = `900 58px ${ HEAVY }`;
		ctx.fillText( 'WORLD', W / 2, 88, W - 40 );
		ctx.fillText( 'CHAMPIONS', W / 2, 138, W - 30 );
		ctx.globalAlpha = 1;
		for ( let i = 0; i < 18; i ++ ) {

			const a = i / 18 * Math.PI * 2, r = 10 + ( f % 3 ) * 5;
			ctx.fillRect( 32 + Math.cos( a ) * r, 60 + Math.sin( a ) * r, 2, 2 );
			ctx.fillRect( W - 32 + Math.cos( a ) * r, 60 + Math.sin( a ) * r, 2, 2 );

		}

	}

	ctx.restore();

}

// ---------------------------------------------------------------- the video board

function drawVideo( ctx, w, h, S, m, show ) {

	const v = show.video;
	const P = m?.batter, pit = m?.pitcher;
	const f = show.frame || 0;
	ctx.fillStyle = '#05070c';
	ctx.fillRect( 0, 0, w, h );
	if ( v === 'batter' && S.batter ) playerCard( ctx, w, h, { last: S.batter.last, name: S.batter.name, num: S.batter.num, pos: S.batter.pos, side: S.batting || 'away', today: S.today } );
	else if ( v === 'pitcher' && pit ) playerCard( ctx, w, h, { last: pit.last.toUpperCase(), name: pit.name.toUpperCase(), num: pit.num, pos: 'P', side: pit.side, pitching: true } );
	else if ( v === 'pitchchange' ) bigWords( ctx, w, h, [ 'PITCHING', 'CHANGE' ], m?.half === 'top' ? 'home' : 'away' );
	else if ( v === 'live' ) liveShot( ctx, w, h, m, f );
	else if ( v === 'wide' ) wideShot( ctx, w, h, m );
	else if ( v === 'replay' ) replayShot( ctx, w, h, m );
	else if ( v === 'noise' ) noiseMeter( ctx, w, h, f, [ 'MAKE SOME', 'NOISE!' ] );
	else if ( v === 'twostrikes' ) noiseMeter( ctx, w, h, f, [ 'TWO STRIKES!', 'GET LOUD!' ] );
	else if ( v === 'onemore' ) noiseMeter( ctx, w, h, f, [ 'ONE STRIKE', 'AWAY!' ] );
	else if ( v === 'score' ) phillieScore( ctx, w, h, f, m );
	else if ( v === 'strikeout' ) strikeout( ctx, w, h, f, pit );
	else if ( v === 'linescore' ) bigLineScore( ctx, w, h, S, m );
	else if ( v === 'phanatic' ) phanatic( ctx, w, h, f, show.caption );
	else if ( v === 'fancam' ) fanCam( ctx, w, h, f );
	else if ( v === 'october' ) redOctober( ctx, w, h );
	else if ( v === 'rain' ) rainDelay( ctx, w, h, f, S );
	// ---- R (rituals)
	else if ( v === 'suspended' ) suspended( ctx, w, h );
	// ---- end R
	else if ( v === 'resume' ) resumed( ctx, w, h, S );
	else if ( v === 'champs' ) champions( ctx, w, h, f );
	else if ( v === 'pile' ) pileShot( ctx, w, h, f );
	else if ( v === 'thanks' ) thanks( ctx, w, h );
	else titleCard( ctx, w, h, S );
	// the screen's own sheen: a little lift at the top, darker toward the bottom
	const g = ctx.createLinearGradient( 0, 0, 0, h );
	g.addColorStop( 0, 'rgba( 255, 255, 255, 0.03 )' ); g.addColorStop( 1, 'rgba( 0, 0, 0, 0.12 )' );
	ctx.fillStyle = g;
	ctx.fillRect( 0, 0, w, h );

}

// --- the pieces of the Phillies' 2008 graphics package

const TEAM = {
	home: { a: '#a50d20', b: '#3a0610', c: '#e81828', line: '#ffffff', trim: '#1b3f8e' },
	away: { a: '#0b2a5b', b: '#040c1f', c: '#8fbce6', line: '#ffffff', trim: '#8fbce6' },
};

function streaks( ctx, w, h, side, seed = 1 ) {

	const T = TEAM[ side ];
	const g = ctx.createLinearGradient( 0, 0, w, h );
	g.addColorStop( 0, T.a ); g.addColorStop( 1, T.b );
	ctx.fillStyle = g;
	ctx.fillRect( 0, 0, w, h );
	// light streaks and a faint flag's stars and stripes
	ctx.save();
	ctx.globalCompositeOperation = 'lighter';
	for ( let i = 0; i < 9; i ++ ) {

		const r = hashS( seed * 17 + i );
		ctx.fillStyle = `rgba( 255, 255, 255, ${ 0.03 + 0.05 * r } )`;
		ctx.beginPath();
		const x0 = w * ( r * 1.3 - 0.2 );
		ctx.moveTo( x0, 0 ); ctx.lineTo( x0 + 40 + r * 80, 0 ); ctx.lineTo( x0 - w * 0.25 + 40, h ); ctx.lineTo( x0 - w * 0.25, h );
		ctx.fill();

	}

	ctx.restore();
	ctx.save();
	ctx.globalAlpha = 0.08;
	ctx.fillStyle = '#ffffff';
	for ( let i = 0; i < 7; i ++ ) ctx.fillRect( w * 0.55, h * 0.1 + i * h * 0.12, w * 0.45, h * 0.05 );
	ctx.restore();

}

function outlined( ctx, t, x, y, font, fill = '#ffffff', stroke = '#0a0a12', lw = 8, maxW ) {

	ctx.font = font;
	ctx.lineJoin = 'round';
	ctx.lineWidth = lw;
	ctx.strokeStyle = stroke;
	if ( maxW ) ctx.strokeText( t, x, y, maxW ); else ctx.strokeText( t, x, y );
	ctx.fillStyle = fill;
	if ( maxW ) ctx.fillText( t, x, y, maxW ); else ctx.fillText( t, x, y );

}

function chromeNumber( ctx, n, x, y, size ) {

	ctx.save();
	ctx.font = `italic 900 ${ size }px ${ HEAVY }`;
	ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
	const g = ctx.createLinearGradient( 0, y - size * 0.8, 0, y );
	g.addColorStop( 0, '#ffffff' ); g.addColorStop( 0.45, '#9aa4b0' ); g.addColorStop( 0.55, '#5b6470' ); g.addColorStop( 1, '#e8edf2' );
	ctx.lineWidth = 14; ctx.strokeStyle = 'rgba( 0, 0, 0, 0.6 )'; ctx.lineJoin = 'round';
	ctx.strokeText( n, x, y );
	ctx.fillStyle = g;
	ctx.fillText( n, x, y );
	ctx.restore();

}

function wsBug( ctx, x, y, s ) {

	// the World Series 2008 mark, small: a navy shield, WORLD SERIES over 2008
	ctx.save();
	ctx.translate( x, y ); ctx.scale( s, s );
	ctx.fillStyle = '#10204a';
	ctx.strokeStyle = '#c9b27a'; ctx.lineWidth = 4;
	ctx.beginPath(); ctx.moveTo( - 80, - 50 ); ctx.lineTo( 80, - 50 ); ctx.lineTo( 72, 30 ); ctx.quadraticCurveTo( 0, 62, - 72, 30 ); ctx.closePath();
	ctx.fill(); ctx.stroke();
	ctx.fillStyle = '#ffffff';
	ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
	ctx.font = `900 30px ${ HEAVY }`;
	ctx.fillText( 'WORLD', 0, - 22, 140 );
	ctx.fillText( 'SERIES', 0, 8, 146 );
	ctx.fillStyle = '#c9b27a';
	ctx.font = `800 18px ${ SANS }`;
	ctx.fillText( '2008', 0, 34 );
	ctx.fillStyle = '#c8102e';
	ctx.fillRect( - 20, - 47, 40, 14 );
	ctx.restore();

}

// a batter's (or the new pitcher's) card: portrait at the left, name and number, his line
function playerCard( ctx, w, h, p ) {

	const side = p.side || 'home';
	streaks( ctx, w, h, side, hashS( p.last ) * 50 );
	const last = cap( p.last );
	chromeNumber( ctx, String( p.num ), w * 0.8, h * 0.9, 440 );
	// the portrait, lit from the left, a soft glow behind
	const glow = ctx.createRadialGradient( w * 0.22, h * 0.45, 20, w * 0.22, h * 0.45, w * 0.28 );
	glow.addColorStop( 0, 'rgba( 255, 255, 255, 0.22 )' ); glow.addColorStop( 1, 'rgba( 255, 255, 255, 0 )' );
	ctx.fillStyle = glow;
	ctx.fillRect( 0, 0, w * 0.5, h );
	const look = LOOKS[ last ] || [ Math.floor( hashS( p.last ) * 3 ), '' ];
	portrait( ctx, w * 0.02, h * 0.02, w * 0.42, h * 0.98, { skin: look[ 0 ], hair: look[ 1 ], side, seed: hashS( p.last ) } );
	ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
	ctx.shadowColor = 'rgba( 0, 0, 0, 0.7 )'; ctx.shadowBlur = 12;
	outlined( ctx, p.pitching ? 'NOW PITCHING' : 'NOW BATTING', w * 0.47, h * 0.17, `italic 800 40px ${ SANS }`, '#ffd24a', '#1a0a04', 6 );
	outlined( ctx, p.name || p.last, w * 0.47, h * 0.42, `italic 900 100px ${ HEAVY }`, '#ffffff', '#101018', 10, w * 0.5 );
	outlined( ctx, `#${ p.num }  ${ POSITIONS[ p.pos ] || p.pos || '' }`, w * 0.47, h * 0.56, `italic 800 44px ${ SANS }`, '#ffffff', '#101018', 6 );
	ctx.shadowBlur = 0;
	// his season, in a bar
	const sea = SEASON[ last ], pit = PITCHING[ last ];
	const items = sea ? [ [ 'AVG', sea[ 0 ] ], [ 'HR', sea[ 1 ] ], [ 'RBI', sea[ 2 ] ] ] : pit ? [ [ 'W-L', pit[ 0 ] ], [ 'ERA', pit[ 1 ] ], ...( pit[ 2 ] ? [ [ 'SV', pit[ 2 ] ] ] : [] ) ] : [];
	if ( items.length ) {

		const bx = w * 0.47, by = h * 0.64, bw = w * 0.5, bh = h * 0.12;
		ctx.fillStyle = 'rgba( 0, 0, 0, 0.55 )'; ctx.fillRect( bx, by, bw, bh );
		ctx.fillStyle = TEAM[ side ].c; ctx.fillRect( bx, by, 10, bh );
		ctx.font = `700 22px ${ SANS }`; ctx.fillStyle = '#c9d2dc';
		ctx.fillText( '2008 SEASON', bx + 24, by + 28 );
		items.forEach( ( [ k, v ], i ) => {

			const x = bx + 24 + i * bw * 0.31;
			ctx.font = `700 26px ${ SANS }`; ctx.fillStyle = '#c9d2dc'; ctx.fillText( k, x, by + bh - 14 );
			ctx.font = `900 44px ${ SANS }`; ctx.fillStyle = '#ffffff'; ctx.fillText( String( v ), x + ctx.measureText( k ).width * 0.1 + 64, by + bh - 12 );

		} );

	}

	if ( ! p.pitching && p.today ) {

		ctx.font = `700 30px ${ NARROW }`; ctx.fillStyle = '#ffd24a';
		ctx.fillText( p.today.length ? 'TONIGHT: ' + p.today.slice( - 2 ).join( ',  ' ) : 'FIRST AT-BAT TONIGHT', w * 0.47, h * 0.86, w * 0.5 );

	}

	wsBug( ctx, w - 90, 70, 0.8 );

}

// A head and shoulders "photograph" (lit from the left, a rim light on the right): the cap and its logo,
// the face in the brim's shade, the jersey (home pinstripes and the script, or the Rays' road grey)
function portrait( ctx, x, y, w, h, o ) {

	const home = o.side === 'home';
	const SK = [ [ 226, 178, 146 ], [ 196, 145, 105 ], [ 150, 100, 68 ], [ 92, 58, 38 ] ][ o.skin ];
	const skin = ( k, a = 1 ) => `rgba( ${ Math.round( SK[ 0 ] * k ) }, ${ Math.round( SK[ 1 ] * k ) }, ${ Math.round( SK[ 2 ] * k ) }, ${ a } )`;
	const cx = x + w * 0.5, hy = y + h * 0.4, rx = w * 0.19, ry = h * 0.2;
	ctx.save();
	ctx.beginPath(); ctx.rect( x, y, w, h ); ctx.clip();
	// the shoulders and the jersey
	ctx.beginPath();
	ctx.moveTo( x - 10, y + h );
	ctx.bezierCurveTo( x + w * 0.02, y + h * 0.8, x + w * 0.12, y + h * 0.74, cx - rx * 1.1, y + h * 0.7 );
	ctx.lineTo( cx + rx * 1.1, y + h * 0.7 );
	ctx.bezierCurveTo( x + w * 0.88, y + h * 0.74, x + w * 0.98, y + h * 0.8, x + w + 10, y + h );
	ctx.closePath();
	const jg = ctx.createLinearGradient( x, 0, x + w, 0 );
	if ( home ) {

		jg.addColorStop( 0, '#f4f2ee' ); jg.addColorStop( 0.6, '#e2dfda' ); jg.addColorStop( 1, '#a9a7a4' );

	} else {

		jg.addColorStop( 0, '#b8bcc2' ); jg.addColorStop( 0.6, '#9a9fa6' ); jg.addColorStop( 1, '#62666c' );

	}

	ctx.fillStyle = jg;
	ctx.fill();
	ctx.save();
	ctx.clip();
	if ( home ) {

		// pinstripes, the placket and the script across the chest
		ctx.strokeStyle = 'rgba( 200, 16, 46, 0.55 )'; ctx.lineWidth = 2;
		for ( let px = x; px < x + w; px += 13 ) {

			ctx.beginPath(); ctx.moveTo( px + ( px - cx ) * 0.05, y + h * 0.68 ); ctx.lineTo( px + ( px - cx ) * 0.15, y + h ); ctx.stroke();

		}

		ctx.fillStyle = '#c8102e';
		ctx.font = `italic 900 ${ w * 0.2 }px Georgia, serif`;
		ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
		ctx.fillText( 'Phillies', cx + w * 0.02, y + h * 0.93 );

	} else {

		ctx.fillStyle = '#0b2a5b';
		ctx.font = `italic 900 ${ w * 0.19 }px ${ HEAVY }`;
		ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
		ctx.fillText( 'RAYS', cx + w * 0.02, y + h * 0.94 );

	}

	// the button placket and the collar's piping
	ctx.strokeStyle = home ? '#c8102e' : '#0b2a5b'; ctx.lineWidth = 5;
	ctx.beginPath(); ctx.moveTo( cx + 4, y + h * 0.78 ); ctx.lineTo( cx + 10, y + h ); ctx.stroke();
	ctx.beginPath(); ctx.moveTo( cx - rx * 0.95, y + h * 0.7 ); ctx.quadraticCurveTo( cx, y + h * 0.8, cx + rx * 0.95, y + h * 0.7 ); ctx.stroke();
	// the shade under the arm, away from the light
	const sh = ctx.createLinearGradient( x + w * 0.55, 0, x + w, 0 );
	sh.addColorStop( 0, 'rgba( 0, 0, 0, 0 )' ); sh.addColorStop( 1, 'rgba( 0, 0, 0, 0.35 )' );
	ctx.fillStyle = sh; ctx.fillRect( x, y + h * 0.6, w, h * 0.4 );
	ctx.restore();
	// the neck, in the shade of the jaw
	ctx.fillStyle = skin( 0.78 );
	ctx.beginPath();
	ctx.moveTo( cx - rx * 0.6, hy + ry * 0.55 ); ctx.lineTo( cx + rx * 0.62, hy + ry * 0.55 );
	ctx.lineTo( cx + rx * 0.72, y + h * 0.72 ); ctx.quadraticCurveTo( cx, y + h * 0.78, cx - rx * 0.72, y + h * 0.72 );
	ctx.closePath(); ctx.fill();
	ctx.fillStyle = 'rgba( 0, 0, 0, 0.3 )';
	ctx.fillRect( cx - rx * 0.7, hy + ry * 0.6, rx * 1.4, ry * 0.2 );
	// the ears
	for ( const s of [ - 1, 1 ] ) {

		ctx.fillStyle = skin( s < 0 ? 0.95 : 0.72 );
		ctx.beginPath(); ctx.ellipse( cx + s * rx * 0.98, hy + ry * 0.05, rx * 0.15, ry * 0.2, 0, 0, Math.PI * 2 ); ctx.fill();

	}

	// the head: broad at the cheekbones, the jaw narrowing to the chin
	ctx.beginPath();
	ctx.moveTo( cx - rx * 0.95, hy - ry * 0.5 );
	ctx.bezierCurveTo( cx - rx * 1.02, hy + ry * 0.2, cx - rx * 0.8, hy + ry * 0.75, cx - rx * 0.3, hy + ry * 0.95 );
	ctx.quadraticCurveTo( cx, hy + ry * 1.05, cx + rx * 0.3, hy + ry * 0.95 );
	ctx.bezierCurveTo( cx + rx * 0.8, hy + ry * 0.75, cx + rx * 1.02, hy + ry * 0.2, cx + rx * 0.95, hy - ry * 0.5 );
	ctx.quadraticCurveTo( cx, hy - ry * 1.25, cx - rx * 0.95, hy - ry * 0.5 );
	ctx.closePath();
	const fg = ctx.createRadialGradient( cx - rx * 0.35, hy - ry * 0.1, rx * 0.1, cx, hy, rx * 1.2 );
	fg.addColorStop( 0, skin( 1.12 ) ); fg.addColorStop( 0.55, skin( 0.96 ) ); fg.addColorStop( 1, skin( 0.62 ) );
	ctx.fillStyle = fg;
	ctx.fill();
	ctx.save();
	ctx.clip();
	// the side away from the light
	const side = ctx.createLinearGradient( cx, 0, cx + rx, 0 );
	side.addColorStop( 0, 'rgba( 0, 0, 0, 0 )' ); side.addColorStop( 1, 'rgba( 20, 8, 4, 0.35 )' );
	ctx.fillStyle = side; ctx.fillRect( cx, hy - ry * 1.2, rx * 1.2, ry * 2.4 );
	// cheekbones and the eye sockets
	ctx.fillStyle = skin( 0.7, 0.35 );
	for ( const s of [ - 1, 1 ] ) {

		ctx.beginPath(); ctx.ellipse( cx + s * rx * 0.38, hy - ry * 0.12, rx * 0.26, ry * 0.12, 0, 0, Math.PI * 2 ); ctx.fill();

	}

	// the facial hair
	const hairC = o.skin >= 2 ? 'rgba( 12, 8, 6, ' : 'rgba( 40, 26, 16, ';
	if ( o.hair === 'goatee' || o.hair === 'beard' ) {

		ctx.fillStyle = hairC + '0.85 )';
		ctx.beginPath();
		ctx.ellipse( cx, hy + ry * 0.72, rx * ( o.hair === 'beard' ? 0.72 : 0.36 ), ry * 0.3, 0, 0, Math.PI * 2 );
		ctx.fill();
		ctx.beginPath(); ctx.ellipse( cx, hy + ry * 0.4, rx * 0.34, ry * 0.07, 0, 0, Math.PI * 2 ); ctx.fill();
		if ( o.hair === 'beard' ) {

			ctx.fillStyle = hairC + '0.55 )';
			ctx.beginPath(); ctx.ellipse( cx, hy + ry * 0.5, rx * 0.95, ry * 0.45, 0, 0, Math.PI ); ctx.fill();

		}

	} else if ( o.hair === 'mustache' ) {

		ctx.fillStyle = hairC + '0.8 )';
		ctx.beginPath(); ctx.ellipse( cx, hy + ry * 0.4, rx * 0.32, ry * 0.07, 0, 0, Math.PI * 2 ); ctx.fill();

	} else if ( o.hair === 'stubble' ) {

		ctx.fillStyle = hairC + '0.28 )';
		ctx.beginPath(); ctx.ellipse( cx, hy + ry * 0.55, rx * 0.85, ry * 0.45, 0, 0, Math.PI ); ctx.fill();

	}

	ctx.restore();
	// the eyes, brows, nose and mouth
	for ( const s of [ - 1, 1 ] ) {

		const ex = cx + s * rx * 0.38, ey = hy - ry * 0.1;
		ctx.fillStyle = 'rgba( 240, 236, 228, 0.9 )';
		ctx.beginPath(); ctx.ellipse( ex, ey, rx * 0.15, ry * 0.045, 0, 0, Math.PI * 2 ); ctx.fill();
		ctx.fillStyle = '#2a1a10';
		ctx.beginPath(); ctx.arc( ex + rx * 0.02, ey, ry * 0.045, 0, Math.PI * 2 ); ctx.fill();
		ctx.fillStyle = 'rgba( 255, 255, 255, 0.8 )';
		ctx.fillRect( ex - rx * 0.01, ey - ry * 0.02, 3, 3 );
		ctx.strokeStyle = o.skin >= 2 ? '#140c08' : '#3a2616'; ctx.lineWidth = ry * 0.035; ctx.lineCap = 'round';
		ctx.beginPath(); ctx.moveTo( ex - s * rx * 0.2, ey - ry * 0.1 ); ctx.quadraticCurveTo( ex, ey - ry * 0.15, ex + s * rx * 0.2, ey - ry * 0.11 ); ctx.stroke();

	}

	ctx.strokeStyle = skin( 0.6 ); ctx.lineWidth = rx * 0.07;
	ctx.beginPath(); ctx.moveTo( cx + rx * 0.05, hy - ry * 0.05 ); ctx.lineTo( cx + rx * 0.12, hy + ry * 0.26 ); ctx.lineTo( cx - rx * 0.08, hy + ry * 0.3 ); ctx.stroke();
	ctx.fillStyle = skin( 1.2, 0.6 );
	ctx.fillRect( cx - rx * 0.05, hy - ry * 0.02, rx * 0.06, ry * 0.24 );
	ctx.strokeStyle = skin( 0.45 ); ctx.lineWidth = ry * 0.035;
	ctx.beginPath(); ctx.moveTo( cx - rx * 0.24, hy + ry * 0.5 ); ctx.quadraticCurveTo( cx, hy + ry * 0.55, cx + rx * 0.24, hy + ry * 0.49 ); ctx.stroke();
	ctx.fillStyle = skin( 1.1, 0.5 );
	ctx.beginPath(); ctx.ellipse( cx, hy + ry * 0.58, rx * 0.16, ry * 0.04, 0, 0, Math.PI * 2 ); ctx.fill();
	// the cap: the crown, its seams and button, the logo, the bill and its shadow over the eyes
	const capA = home ? '#d0142f' : '#0d2c5e', capB = home ? '#7a0a18' : '#050f24';
	const shade = ctx.createLinearGradient( 0, hy - ry * 0.45, 0, hy + ry * 0.05 );
	shade.addColorStop( 0, 'rgba( 0, 0, 0, 0.55 )' ); shade.addColorStop( 1, 'rgba( 0, 0, 0, 0 )' );
	ctx.fillStyle = shade;
	ctx.fillRect( cx - rx * 1.05, hy - ry * 0.45, rx * 2.1, ry * 0.5 );
	ctx.beginPath();
	ctx.moveTo( cx - rx * 1.06, hy - ry * 0.38 );
	ctx.bezierCurveTo( cx - rx * 1.12, hy - ry * 1.35, cx + rx * 1.12, hy - ry * 1.35, cx + rx * 1.06, hy - ry * 0.38 );
	ctx.closePath();
	const cg = ctx.createRadialGradient( cx - rx * 0.4, hy - ry * 1.0, rx * 0.1, cx, hy - ry * 0.6, rx * 1.3 );
	cg.addColorStop( 0, capA ); cg.addColorStop( 1, capB );
	ctx.fillStyle = cg;
	ctx.fill();
	ctx.strokeStyle = 'rgba( 0, 0, 0, 0.3 )'; ctx.lineWidth = 2;
	for ( const s of [ - 0.45, 0.45 ] ) {

		ctx.beginPath(); ctx.moveTo( cx + s * rx * 0.3, hy - ry * 1.08 ); ctx.quadraticCurveTo( cx + s * rx * 1.1, hy - ry * 0.9, cx + s * rx * 1.4, hy - ry * 0.4 ); ctx.stroke();

	}

	ctx.fillStyle = capB; ctx.beginPath(); ctx.arc( cx, hy - ry * 1.08, rx * 0.06, 0, Math.PI * 2 ); ctx.fill();
	ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
	if ( home ) {

		ctx.font = `italic 900 ${ ry * 0.62 }px Georgia, serif`;
		ctx.lineWidth = 4; ctx.strokeStyle = '#1b3f8e';
		ctx.strokeText( 'P', cx, hy - ry * 0.72 );
		ctx.fillStyle = '#ffffff';
		ctx.fillText( 'P', cx, hy - ry * 0.72 );

	} else {

		ctx.font = `900 ${ ry * 0.4 }px ${ SANS }`;
		ctx.lineWidth = 4; ctx.strokeStyle = '#8fbce6';
		ctx.strokeText( 'TB', cx, hy - ry * 0.72 );
		ctx.fillStyle = '#ffffff';
		ctx.fillText( 'TB', cx, hy - ry * 0.72 );

	}

	ctx.beginPath();
	ctx.ellipse( cx + rx * 0.05, hy - ry * 0.36, rx * 1.18, ry * 0.16, 0.03, Math.PI, 0 );
	ctx.ellipse( cx + rx * 0.05, hy - ry * 0.36, rx * 1.18, ry * 0.07, 0.03, 0, Math.PI );
	ctx.fillStyle = capB;
	ctx.fill();
	ctx.fillStyle = 'rgba( 255, 255, 255, 0.12 )';
	ctx.beginPath(); ctx.ellipse( cx - rx * 0.3, hy - ry * 0.45, rx * 0.6, ry * 0.05, 0, 0, Math.PI * 2 ); ctx.fill();
	// the rim light
	ctx.strokeStyle = 'rgba( 255, 240, 220, 0.35 )'; ctx.lineWidth = 5;
	ctx.beginPath(); ctx.ellipse( cx, hy, rx * 1.0, ry * 0.98, 0, - 0.9, 0.9 ); ctx.stroke();
	ctx.restore();

}

// big words on the team's colours
function bigWords( ctx, w, h, lines, side = 'home', sub ) {

	streaks( ctx, w, h, side, lines[ 0 ].length );
	ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
	ctx.shadowColor = 'rgba( 0, 0, 0, 0.7 )'; ctx.shadowBlur = 16;
	lines.forEach( ( t, i ) => outlined( ctx, t, w / 2, h * ( 0.5 + ( i - ( lines.length - 1 ) / 2 ) * 0.3 ), `italic 900 ${ lines.length > 2 ? 110 : 150 }px ${ HEAVY }`, '#ffffff', '#101018', 12, w - 80 ) );
	if ( sub ) outlined( ctx, sub, w / 2, h * 0.9, `italic 800 44px ${ SANS }`, '#ffd24a', '#101018', 6, w - 80 );
	ctx.shadowBlur = 0;

}

// --- the live picture: the center field camera over the pitcher's shoulder

function crowd( ctx, x, y, w, h, seed, dark = 1 ) {

	ctx.fillStyle = `rgb( ${ 40 * dark }, ${ 12 * dark }, ${ 16 * dark } )`;
	ctx.fillRect( x, y, w, h );
	for ( let i = 0; i < w * h / 70; i ++ ) {

		const r = hashS( seed + i * 1.37 ), q = hashS( seed * 3 + i * 2.11 );
		const c = q < 0.55 ? '#b3122a' : q < 0.7 ? '#e8e4de' : q < 0.85 ? '#1c1c24' : '#5a5f6a';
		ctx.fillStyle = c;
		ctx.globalAlpha = 0.35 + 0.3 * dark;
		ctx.fillRect( x + r * w, y + hashS( seed * 7 + i * 0.73 ) * h, 5, 6 );

	}

	ctx.globalAlpha = 1;

}

function figure( ctx, x, y, s, o ) {

	// a ballplayer, seen small: legs, body, arms, the head and cap (o.pose: 'stand', 'crouch', 'swing', 'throw')
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
		const st = o.pose === 'throw' ? 14 : 7;
		ctx.beginPath(); ctx.moveTo( - 5, - 44 ); ctx.lineTo( - st, 0 ); ctx.moveTo( 5, - 44 ); ctx.lineTo( st, 0 ); ctx.stroke();
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

		ctx.fillStyle = o.back ? '#2a1c14' : o.skin || '#b98a6a'; ctx.beginPath(); ctx.arc( 0, - 92, 9, 0, Math.PI * 2 ); ctx.fill();
		ctx.fillStyle = o.cap; ctx.beginPath(); ctx.arc( 0, - 95, 9.5, Math.PI * 1.05, Math.PI * 1.95 ); ctx.fill();
		if ( o.number ) {

			ctx.fillStyle = o.numColor || '#c8102e';
			ctx.font = `900 22px ${ SANS }`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
			ctx.fillText( o.number, 0, - 62 );

		}

	}

	ctx.restore();

}

const UNI = {
	home: { body: '#ecebe7', pants: '#e4e2dd', cap: '#c8102e', num: '#c8102e' },
	away: { body: '#9ea3aa', pants: '#a6aab0', cap: '#0b2a5b', num: '#0b2a5b' },
};

function fieldBackdrop( ctx, w, h, seed ) {

	// the stands behind home plate, the fascia under the club seats, the backstop's padded wall, the dirt
	// round the plate and the grass in front of it (the camera is out past second base, on a long lens)
	crowd( ctx, 0, 0, w, h * 0.36, seed );
	ctx.fillStyle = '#0d1c34'; ctx.fillRect( 0, h * 0.36, w, h * 0.045 );
	ctx.fillStyle = '#e8e4d8'; ctx.font = `800 24px ${ SANS }`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
	ctx.fillText( 'WORLD SERIES 2008', w * 0.28, h * 0.383 ); ctx.fillText( 'Citizens Bank', w * 0.74, h * 0.383 );
	ctx.fillStyle = '#123a2e'; ctx.fillRect( 0, h * 0.405, w, h * 0.075 );
	ctx.fillStyle = 'rgba( 0, 0, 0, 0.25 )';
	for ( let x = 0; x < w; x += 42 ) ctx.fillRect( x, h * 0.405, 2, h * 0.075 );
	ctx.fillStyle = '#7a4a30'; ctx.fillRect( 0, h * 0.48, w, h * 0.52 );
	const grass = ctx.createLinearGradient( 0, h * 0.7, 0, h );
	grass.addColorStop( 0, '#2f5f2e' ); grass.addColorStop( 1, '#3d7636' );
	ctx.fillStyle = grass; ctx.fillRect( 0, h * 0.74, w, h * 0.26 );
	ctx.fillStyle = 'rgba( 255, 255, 255, 0.05 )';
	for ( let i = 0; i < 8; i ++ ) ctx.fillRect( 0, h * ( 0.76 + i * 0.06 ), w, h * 0.03 );
	// the dirt circle round the plate, the chalk of the boxes, the plate
	ctx.fillStyle = '#8a5638';
	ctx.beginPath(); ctx.ellipse( w / 2, h * 0.67, w * 0.3, h * 0.1, 0, 0, Math.PI * 2 ); ctx.fill();
	ctx.strokeStyle = 'rgba( 240, 238, 230, 0.75 )'; ctx.lineWidth = 3;
	for ( const s of [ - 1, 1 ] ) ctx.strokeRect( w / 2 + s * 62 - 34, h * 0.64, 68, h * 0.06 );
	ctx.fillStyle = '#f2f0ea';
	ctx.beginPath(); ctx.moveTo( w / 2 - 14, h * 0.665 ); ctx.lineTo( w / 2 + 14, h * 0.665 ); ctx.lineTo( w / 2 + 14, h * 0.675 ); ctx.lineTo( w / 2, h * 0.685 ); ctx.lineTo( w / 2 - 14, h * 0.675 ); ctx.fill();

}

function liveShot( ctx, w, h, m, f ) {

	fieldBackdrop( ctx, w, h, 3 );
	const bat = UNI[ m?.batting || 'away' ], fld = UNI[ m?.batting === 'home' ? 'away' : 'home' ];
	const lefty = m?.bats === 'L';
	// the umpire and the catcher behind the plate, the batter in his box (a right-handed hitter on the
	// left as the camera sees it)
	figure( ctx, w / 2 + 8, h * 0.655, 1.5, { pose: 'crouch', body: '#141418', cap: '#0a0a0e' } );
	figure( ctx, w / 2, h * 0.69, 1.45, { pose: 'crouch', body: fld === UNI.home ? '#1b2c52' : '#2b2f38', pants: fld.pants, cap: fld === UNI.home ? '#c8102e' : '#0b2a5b' } );
	figure( ctx, w / 2 + ( lefty ? 64 : - 64 ), h * 0.71, 1.9, { pose: f === 2 ? 'swing' : 'bat', body: bat.body, pants: bat.pants, cap: bat.cap, dir: lefty ? - 1 : 1 } );
	// the mound and the pitcher, his back to us, cut off at the knees
	ctx.fillStyle = '#8f5a3a';
	ctx.beginPath(); ctx.ellipse( w * 0.4, h * 1.06, w * 0.34, h * 0.12, 0, 0, Math.PI * 2 ); ctx.fill();
	const pn = m?.pitcher?.num || '';
	figure( ctx, w * 0.38, h * 1.16, 3.4, { pose: f === 1 ? 'throw' : 'stand', body: fld.body, pants: fld.pants, cap: fld.cap, number: pn, numColor: fld.num, back: true } );
	// the pitch's speed, once it's thrown
	if ( f === 1 && m?.speed ) {

		const bx = w - 300, by = h - 128;
		ctx.fillStyle = 'rgba( 6, 10, 24, 0.85 )'; ctx.fillRect( bx, by, 270, 96 );
		ctx.fillStyle = '#c8102e'; ctx.fillRect( bx, by, 270, 26 );
		ctx.fillStyle = '#ffffff'; ctx.font = `800 20px ${ SANS }`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
		ctx.fillText( ( m.pitchType || 'PITCH' ).toUpperCase().slice( 0, 18 ), bx + 12, by + 14 );
		ctx.font = `900 58px ${ SANS }`; ctx.textAlign = 'right';
		ctx.fillText( String( Math.round( m.speed ) ), bx + 180, by + 64 );
		ctx.font = `800 28px ${ SANS }`; ctx.textAlign = 'left';
		ctx.fillText( 'MPH', bx + 190, by + 68 );

	}

}

function wideShot( ctx, w, h, m ) {

	// from high behind home: the diamond, the outfield, the fielders, the stands beyond
	crowd( ctx, 0, 0, w, h * 0.22, 9, 0.8 );
	ctx.fillStyle = '#123a2e'; ctx.fillRect( 0, h * 0.22, w, h * 0.04 );
	ctx.fillStyle = '#346a31'; ctx.fillRect( 0, h * 0.26, w, h * 0.74 );
	ctx.fillStyle = 'rgba( 255, 255, 255, 0.05 )';
	for ( let i = 0; i < 10; i ++ ) ctx.fillRect( i * w / 10, h * 0.26, w / 20, h * 0.74 );
	ctx.fillStyle = '#8a5638';
	ctx.beginPath(); ctx.moveTo( w / 2, h * 1.05 ); ctx.lineTo( w * 0.1, h * 0.72 ); ctx.quadraticCurveTo( w / 2, h * 0.36, w * 0.9, h * 0.72 ); ctx.closePath(); ctx.fill();
	ctx.fillStyle = '#346a31';
	ctx.beginPath(); ctx.moveTo( w / 2, h * 0.94 ); ctx.lineTo( w * 0.3, h * 0.72 ); ctx.lineTo( w / 2, h * 0.55 ); ctx.lineTo( w * 0.7, h * 0.72 ); ctx.closePath(); ctx.fill();
	ctx.fillStyle = '#f2f0ea';
	for ( const [ bx, by ] of [ [ 0.3, 0.72 ], [ 0.5, 0.55 ], [ 0.7, 0.72 ] ] ) ctx.fillRect( w * bx - 7, h * by - 5, 14, 10 );
	ctx.strokeStyle = 'rgba( 242, 240, 234, 0.9 )'; ctx.lineWidth = 3;
	ctx.beginPath(); ctx.moveTo( w / 2, h * 0.98 ); ctx.lineTo( - w * 0.2, h * 0.4 ); ctx.moveTo( w / 2, h * 0.98 ); ctx.lineTo( w * 1.2, h * 0.4 ); ctx.stroke();
	const fld = UNI[ m?.batting === 'home' ? 'away' : 'home' ];
	for ( const [ px, py ] of [ [ 0.5, 0.7 ], [ 0.38, 0.6 ], [ 0.62, 0.6 ], [ 0.25, 0.7 ], [ 0.75, 0.7 ], [ 0.2, 0.42 ], [ 0.5, 0.34 ], [ 0.8, 0.42 ] ] ) figure( ctx, w * px, h * py, 0.5, { pose: 'stand', body: fld.body, pants: fld.pants, cap: fld.cap } );

}

function replayShot( ctx, w, h, m ) {

	// the batter at contact from the side, then the REPLAY wipe
	ctx.fillStyle = '#0d1c34'; ctx.fillRect( 0, 0, w, h );
	crowd( ctx, 0, 0, w, h * 0.45, 21, 0.9 );
	ctx.fillStyle = '#7d4b31'; ctx.fillRect( 0, h * 0.72, w, h * 0.28 );
	ctx.fillStyle = '#123a2e'; ctx.fillRect( 0, h * 0.45, w, h * 0.27 );
	const bat = UNI[ m?.batting || 'home' ];
	figure( ctx, w * 0.45, h * 0.95, 4.4, { pose: 'swing', body: bat.body, pants: bat.pants, cap: bat.cap, dir: 1 } );
	figure( ctx, w * 0.75, h * 0.95, 3.2, { pose: 'crouch', body: '#2b2f38', cap: '#1b2c52' } );
	ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc( w * 0.66, h * 0.44, 9, 0, Math.PI * 2 ); ctx.fill();
	// the replay bug
	ctx.save();
	ctx.translate( 40, 40 ); ctx.transform( 1, 0, - 0.25, 1, 0, 0 );
	ctx.fillStyle = '#c8102e'; ctx.fillRect( 0, 0, 380, 90 );
	ctx.fillStyle = '#1b3f8e'; ctx.fillRect( 380, 0, 30, 90 );
	ctx.fillStyle = '#ffffff'; ctx.font = `italic 900 70px ${ HEAVY }`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
	ctx.fillText( 'REPLAY', 24, 48 );
	ctx.restore();

}

function noiseMeter( ctx, w, h, f, lines ) {

	// red, speakers' rings pulsing, the words, the meter climbing
	const g = ctx.createRadialGradient( w / 2, h / 2, 40, w / 2, h / 2, w * 0.7 );
	g.addColorStop( 0, '#e0102a' ); g.addColorStop( 1, '#3a0208' );
	ctx.fillStyle = g; ctx.fillRect( 0, 0, w, h );
	ctx.strokeStyle = 'rgba( 255, 255, 255, 0.18 )';
	for ( let i = 0; i < 6; i ++ ) {

		ctx.lineWidth = 10;
		ctx.beginPath(); ctx.arc( w / 2, h * 0.42, 80 + ( ( i * 90 + f * 30 ) % 540 ), 0, Math.PI * 2 ); ctx.stroke();

	}

	ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
	ctx.shadowColor = 'rgba( 0, 0, 0, 0.8 )'; ctx.shadowBlur = 20;
	outlined( ctx, lines[ 0 ], w / 2, h * 0.24, `italic 900 120px ${ HEAVY }`, '#ffffff', '#1a0206', 12, w - 60 );
	outlined( ctx, lines[ 1 ], w / 2, h * 0.5, `italic 900 150px ${ HEAVY }`, '#ffd24a', '#1a0206', 12, w - 60 );
	ctx.shadowBlur = 0;
	// the meter
	const n = 6 + ( ( f * 3 ) % 13 );
	for ( let i = 0; i < 18; i ++ ) {

		const x = 70 + i * ( w - 140 ) / 18;
		ctx.fillStyle = i < n ? ( i < 9 ? '#3bd24a' : i < 14 ? '#ffd21a' : '#ff3a1a' ) : 'rgba( 0, 0, 0, 0.35 )';
		ctx.fillRect( x, h * 0.74, ( w - 140 ) / 18 - 8, h * 0.14 );

	}

	ctx.fillStyle = '#ffffff'; ctx.font = `800 30px ${ SANS }`;
	ctx.fillText( 'NOISE METER', w / 2, h * 0.94 );

}

function phillieScore( ctx, w, h, f, m ) {

	bigWords( ctx, w, h, [ 'PHILLIES', 'SCORE!' ], 'home', m?.score ? `RAYS ${ m.score.away }   PHILLIES ${ m.score.home }` : '' );
	fireworks( ctx, w, h, f, 3 );

}

function strikeout( ctx, w, h, f, pit ) {

	streaks( ctx, w, h, 'home', 5 );
	ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
	// the K cards, hung like the fans hang them
	for ( let i = 0; i < 5; i ++ ) {

		const x = 120 + i * 110, y = h * 0.28 + ( i % 2 ) * 16;
		ctx.fillStyle = '#ffffff'; ctx.fillRect( x - 40, y - 55, 80, 110 );
		ctx.fillStyle = '#c8102e'; ctx.font = `900 90px ${ HEAVY }`;
		ctx.fillText( i === 4 && f % 2 ? '' : 'K', x, y + 4 );

	}

	outlined( ctx, 'STRIKEOUT!', w * 0.5, h * 0.72, `italic 900 150px ${ HEAVY }`, '#ffffff', '#101018', 12, w - 60 );
	if ( pit ) outlined( ctx, `#${ pit.num } ${ pit.name.toUpperCase() }`, w * 0.5, h * 0.9, `italic 800 44px ${ SANS }`, '#ffd24a', '#101018', 6 );

}

function bigLineScore( ctx, w, h, S, m ) {

	streaks( ctx, w, h, 'away', 3 );
	ctx.textBaseline = 'middle';
	ctx.textAlign = 'center';
	const done = m ? `${ m.half === 'bottom' ? 'MIDDLE' : 'END' } OF THE ${ ordinal( m.half === 'bottom' ? m.inning : Math.max( 1, m.inning - 1 ) ) }` : 'WORLD SERIES';
	outlined( ctx, done, w / 2, h * 0.12, `italic 900 60px ${ HEAVY }`, '#ffffff', '#101018', 8 );
	const x0 = 60, cw = ( w - 520 ) / 9, y0 = h * 0.32;
	ctx.fillStyle = 'rgba( 0, 0, 0, 0.5 )'; ctx.fillRect( 40, y0 - 50, w - 80, 360 );
	ctx.font = `800 40px ${ SANS }`; ctx.fillStyle = '#c9d2dc';
	for ( let i = 1; i <= 9; i ++ ) ctx.fillText( String( i ), x0 + 240 + ( i - 0.5 ) * cw, y0 );
	[ 'R', 'H', 'E' ].forEach( ( t, i ) => ctx.fillText( t, w - 230 + i * 75, y0 ) );
	[ [ 'away', 'RAYS', '#8fbce6' ], [ 'home', 'PHILLIES', '#e81828' ] ].forEach( ( [ side, name, c ], r ) => {

		const y = y0 + 110 + r * 120;
		ctx.fillStyle = c; ctx.fillRect( x0, y - 45, 12, 90 );
		ctx.textAlign = 'left'; ctx.fillStyle = '#ffffff'; ctx.font = `italic 900 56px ${ HEAVY }`;
		ctx.fillText( name, x0 + 26, y, 210 );
		ctx.textAlign = 'center'; ctx.font = `800 56px ${ SANS }`;
		for ( let i = 1; i <= 9; i ++ ) {

			const v = S.line?.[ i - 1 ]?.[ r ];
			if ( v != null ) ctx.fillText( String( v ), x0 + 240 + ( i - 0.5 ) * cw, y );

		}

		ctx.fillStyle = '#ffd24a';
		[ S.score?.[ side ] ?? 0, S.hits?.[ side ] ?? 0, S.errors?.[ side ] ?? 0 ].forEach( ( v, i ) => ctx.fillText( String( v ), w - 230 + i * 75, y ) );

	} );
	wsBug( ctx, w - 110, h - 80, 0.75 );

}

// the Phanatic dancing on the dugout roof: green fur, the long snout and its curled tongue, the jersey
function phanatic( ctx, w, h, f, caption = null ) {

	const g = ctx.createLinearGradient( 0, 0, 0, h );
	g.addColorStop( 0, '#1b3f8e' ); g.addColorStop( 1, '#081530' );
	ctx.fillStyle = g; ctx.fillRect( 0, 0, w, h );
	crowd( ctx, 0, h * 0.55, w, h * 0.45, 31, 0.9 );
	const cx = w * 0.36, cy = h * 0.6, k = f % 4, bob = [ 0, - 14, 0, - 8 ][ k ];
	ctx.save();
	ctx.translate( cx, cy + bob );
	const fur = ( a, b ) => {

		const gr = ctx.createRadialGradient( - 40, - 60, 20, 0, 0, 220 );
		gr.addColorStop( 0, a ); gr.addColorStop( 1, b );
		return gr;

	};

	// legs and the sneakers
	ctx.fillStyle = '#3b9a2e';
	ctx.fillRect( - 70, 120, 50, 90 ); ctx.fillRect( 20, 120, 50, 90 );
	ctx.fillStyle = '#c8102e';
	ctx.beginPath(); ctx.ellipse( - 50 - ( k % 2 ) * 10, 214, 50, 22, 0, 0, Math.PI * 2 ); ctx.fill();
	ctx.beginPath(); ctx.ellipse( 50 + ( k % 2 ) * 10, 214, 50, 22, 0, 0, Math.PI * 2 ); ctx.fill();
	// the body in its jersey
	ctx.fillStyle = fur( '#6cd24a', '#2f8a22' );
	ctx.beginPath(); ctx.ellipse( 0, 20, 130, 150, 0, 0, Math.PI * 2 ); ctx.fill();
	ctx.fillStyle = '#f2f0ea';
	ctx.beginPath(); ctx.ellipse( 0, 40, 112, 105, 0, 0, Math.PI * 2 ); ctx.fill();
	ctx.strokeStyle = 'rgba( 200, 16, 46, 0.5 )'; ctx.lineWidth = 3;
	for ( let x = - 100; x <= 100; x += 18 ) {

		ctx.beginPath(); ctx.moveTo( x, - 50 ); ctx.lineTo( x, 140 ); ctx.stroke();

	}

	ctx.fillStyle = '#c8102e'; ctx.font = `italic 900 52px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
	ctx.fillText( 'Phillies', 0, 40 );
	// the arms, up and down with the beat
	ctx.strokeStyle = '#4fb838'; ctx.lineWidth = 42; ctx.lineCap = 'round';
	const up = k % 2 === 0;
	ctx.beginPath(); ctx.moveTo( - 110, - 30 ); ctx.lineTo( - 190, up ? - 170 : 30 ); ctx.stroke();
	ctx.beginPath(); ctx.moveTo( 110, - 30 ); ctx.lineTo( 190, up ? 30 : - 170 ); ctx.stroke();
	// the head: fur, the big eyes, the long snout, the tongue out and curled
	ctx.fillStyle = fur( '#7ee25a', '#3a9a2a' );
	ctx.beginPath(); ctx.ellipse( 0, - 170, 110, 95, 0, 0, Math.PI * 2 ); ctx.fill();
	ctx.strokeStyle = '#5cc242'; ctx.lineWidth = 8;
	for ( let i = - 5; i <= 5; i ++ ) {

		ctx.beginPath(); ctx.moveTo( i * 14, - 255 ); ctx.lineTo( i * 18, - 290 - Math.abs( i ) * 2 ); ctx.stroke();

	}

	for ( const s of [ - 1, 1 ] ) {

		ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse( s * 42, - 190, 36, 40, 0, 0, Math.PI * 2 ); ctx.fill();
		ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc( s * 42 + 8, - 184, 15, 0, Math.PI * 2 ); ctx.fill();
		ctx.fillStyle = '#3a7ad8'; ctx.beginPath(); ctx.ellipse( s * 42, - 222, 40, 16, 0, Math.PI, 0 ); ctx.fill();

	}

	ctx.fillStyle = '#5cc242';
	ctx.beginPath(); ctx.moveTo( - 30, - 150 ); ctx.lineTo( 150, - 170 ); ctx.lineTo( 160, - 120 ); ctx.lineTo( - 30, - 110 ); ctx.closePath(); ctx.fill();
	ctx.fillStyle = '#2a7a1e'; ctx.beginPath(); ctx.ellipse( 158, - 145, 14, 26, 0, 0, Math.PI * 2 ); ctx.fill();
	ctx.strokeStyle = '#e0304a'; ctx.lineWidth = 14;
	ctx.beginPath(); ctx.moveTo( 158, - 132 ); ctx.bezierCurveTo( 200, - 110 + bob, 230, - 150, 200, - 170 ); ctx.stroke();
	ctx.restore();
	ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
	outlined( ctx, 'PHANATIC', w * 0.74, h * 0.25, `italic 900 110px ${ HEAVY }`, '#7ee25a', '#0a1a06', 12, w * 0.46 );
	// ---- A (Phanatic): what he's doing out there right now, when he's out (places/Phanatic.js)
	outlined( ctx, caption || ( k % 2 ? 'DANCE!' : 'GET UP!' ), w * 0.74, h * 0.46, `italic 900 90px ${ HEAVY }`, '#ffffff', '#101018', 10, w * 0.46 );

}

function fanCam( ctx, w, h, f ) {

	// the fan cam: faces in the 100s, red jackets, towels in the air
	ctx.fillStyle = '#1a0a0c'; ctx.fillRect( 0, 0, w, h );
	for ( let r = 0; r < 4; r ++ ) for ( let i = 0; i < 9; i ++ ) {

		const x = ( i + ( r % 2 ) * 0.5 ) * w / 8.5, y = h * ( 0.3 + r * 0.22 ), s = 0.9 + r * 0.25;
		const q = hashS( r * 13 + i * 7 );
		const SK = [ '#e2b292', '#c49169', '#96643f', '#5c3a26' ][ Math.floor( q * 4 ) ];
		ctx.fillStyle = q < 0.7 ? '#b3122a' : q < 0.85 ? '#1c1c24' : '#e8e4de';
		ctx.beginPath(); ctx.ellipse( x, y + 60 * s, 55 * s, 50 * s, 0, Math.PI, 0 ); ctx.fill();
		ctx.fillRect( x - 55 * s, y + 60 * s, 110 * s, 60 );
		ctx.fillStyle = SK; ctx.beginPath(); ctx.ellipse( x, y, 26 * s, 32 * s, 0, 0, Math.PI * 2 ); ctx.fill();
		ctx.fillStyle = q < 0.55 ? '#c8102e' : '#101a3a'; ctx.beginPath(); ctx.ellipse( x, y - 14 * s, 28 * s, 20 * s, 0, Math.PI, 0 ); ctx.fill();
		// the towel, twirled
		const a = ( f + i + r ) % 4;
		ctx.fillStyle = '#f8f6f0';
		ctx.save(); ctx.translate( x + 40 * s, y - 50 * s ); ctx.rotate( a * 0.6 - 0.9 );
		ctx.fillRect( - 10 * s, - 50 * s, 34 * s, 50 * s );
		ctx.restore();

	}

	ctx.save();
	ctx.translate( 30, 30 ); ctx.transform( 1, 0, - 0.2, 1, 0, 0 );
	ctx.fillStyle = '#c8102e'; ctx.fillRect( 0, 0, 330, 80 );
	ctx.fillStyle = '#ffffff'; ctx.font = `italic 900 60px ${ HEAVY }`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
	ctx.fillText( 'FAN CAM', 20, 43 );
	ctx.restore();

}

function redOctober( ctx, w, h ) {

	const g = ctx.createLinearGradient( 0, 0, 0, h );
	g.addColorStop( 0, '#6a0412' ); g.addColorStop( 1, '#1a0105' );
	ctx.fillStyle = g; ctx.fillRect( 0, 0, w, h );
	crowd( ctx, 0, h * 0.62, w, h * 0.38, 44, 1.1 );
	ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
	outlined( ctx, 'RED OCTOBER', w / 2, h * 0.26, `italic 900 140px ${ HEAVY }`, '#ffffff', '#1a0206', 12, w - 60 );
	outlined( ctx, 'THERE\'S ONLY ONE OCTOBER', w / 2, h * 0.47, `italic 800 54px ${ SANS }`, '#ffd24a', '#1a0206', 8, w - 100 );

}

function rainDelay( ctx, w, h, f, S ) {

	const g = ctx.createLinearGradient( 0, 0, 0, h );
	g.addColorStop( 0, '#243a5a' ); g.addColorStop( 1, '#0a1424' );
	ctx.fillStyle = g; ctx.fillRect( 0, 0, w, h );
	ctx.strokeStyle = 'rgba( 180, 210, 255, 0.25 )'; ctx.lineWidth = 3;
	for ( let i = 0; i < 90; i ++ ) {

		const x = hashS( i * 3.1 ) * w, y = ( hashS( i * 7.7 ) * h + f * 40 ) % h;
		ctx.beginPath(); ctx.moveTo( x, y ); ctx.lineTo( x - 10, y + 40 ); ctx.stroke();

	}

	ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
	outlined( ctx, 'RAIN DELAY', w / 2, h * 0.28, `italic 900 150px ${ HEAVY }`, '#ffffff', '#0a0f1a', 12, w - 60 );
	outlined( ctx, 'PLEASE STAND BY', w / 2, h * 0.52, `800 60px ${ SANS }`, '#ffd24a', '#0a0f1a', 8 );
	ctx.font = `700 36px ${ SANS }`; ctx.fillStyle = '#c9d2dc';
	ctx.fillText( `RAYS ${ S.score?.away ?? 0 }   PHILLIES ${ S.score?.home ?? 0 }   ·   MIDDLE 6TH`, w / 2, h * 0.72 );
	ctx.fillText( 'FOR YOUR SAFETY PLEASE STAY OFF THE FIELD', w / 2, h * 0.84, w - 100 );

}

// ---- R (rituals): the board's message when the game was called, word for word (Getty 83458512; AP
// 4551252: white capitals on the video board, "as a few fans remain", ~11:50 pm)
function suspended( ctx, w, h ) {

	const g = ctx.createLinearGradient( 0, 0, 0, h );
	g.addColorStop( 0, '#10244a' ); g.addColorStop( 1, '#061024' );
	ctx.fillStyle = g; ctx.fillRect( 0, 0, w, h );
	ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
	ctx.fillStyle = '#ffffff';
	const lines = [
		'TONIGHT\'S PHILLIES/RAYS GAME', 'HAS BEEN SUSPENDED.', 'RESUMPTION OF PLAY WILL BE DETERMINED', 'WHEN WEATHER CONDITIONS ALLOW,', 'EARLIEST TOMORROW AT 8 PM.',
		'ALL FANS SHOULD HOLD ON TO THEIR', 'TICKETS FOR TONIGHT. TICKETS WILL BE', 'VALID FOR RE-ENTRY WHEN THE GAME', 'IS RESUMED.',
	];
	ctx.font = `800 52px ${ SANS }`;
	lines.forEach( ( l, i ) => ctx.fillText( l, w / 2, h * ( 0.1 + i * 0.1 ), w - 60 ) );

}
// ---- end R

function resumed( ctx, w, h, S ) {

	streaks( ctx, w, h, 'home', 12 );
	ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
	outlined( ctx, 'WELCOME BACK!', w / 2, h * 0.22, `italic 900 120px ${ HEAVY }`, '#ffffff', '#101018', 12, w - 60 );
	outlined( ctx, 'GAME 5 RESUMES', w / 2, h * 0.44, `italic 900 80px ${ HEAVY }`, '#ffd24a', '#101018', 10, w - 60 );
	ctx.font = `800 40px ${ SANS }`; ctx.fillStyle = '#ffffff';
	ctx.fillText( 'WEDNESDAY, OCTOBER 29, 2008', w / 2, h * 0.62 );
	ctx.fillText( `BOTTOM OF THE 6TH   ·   RAYS ${ S.score?.away ?? 0 }  PHILLIES ${ S.score?.home ?? 0 }`, w / 2, h * 0.76, w - 80 );

}

function fireworks( ctx, w, h, f, n ) {

	ctx.save();
	ctx.globalCompositeOperation = 'lighter';
	for ( let i = 0; i < n; i ++ ) {

		const cx = w * ( 0.15 + 0.7 * hashS( i * 5 + Math.floor( f / 3 ) ) ), cy = h * ( 0.2 + 0.3 * hashS( i * 9 + 1 ) );
		const r = 40 + ( f % 3 ) * 45 + i * 10;
		const col = [ '#ff4a4a', '#ffd24a', '#ffffff', '#6aa8ff' ][ ( i + f ) % 4 ];
		ctx.strokeStyle = col; ctx.lineWidth = 4;
		for ( let k = 0; k < 16; k ++ ) {

			const a = k / 16 * Math.PI * 2;
			ctx.beginPath(); ctx.moveTo( cx + Math.cos( a ) * r * 0.5, cy + Math.sin( a ) * r * 0.5 ); ctx.lineTo( cx + Math.cos( a ) * r, cy + Math.sin( a ) * r ); ctx.stroke();

		}

	}

	ctx.restore();

}

function champions( ctx, w, h, f ) {

	const g = ctx.createRadialGradient( w / 2, h / 2, 50, w / 2, h / 2, w * 0.7 );
	g.addColorStop( 0, '#c8102e' ); g.addColorStop( 1, '#1a0206' );
	ctx.fillStyle = g; ctx.fillRect( 0, 0, w, h );
	fireworks( ctx, w, h, f, 5 );
	// confetti
	for ( let i = 0; i < 160; i ++ ) {

		ctx.fillStyle = [ '#ffffff', '#ffd24a', '#1b3f8e', '#e81828' ][ i % 4 ];
		ctx.fillRect( hashS( i * 1.7 ) * w, ( hashS( i * 3.3 ) * h + f * 25 * ( 0.5 + hashS( i ) ) ) % h, 10, 6 );

	}

	ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
	ctx.shadowColor = 'rgba( 0, 0, 0, 0.8 )'; ctx.shadowBlur = 20;
	outlined( ctx, '2008', w / 2, h * 0.2, `italic 900 110px ${ HEAVY }`, '#ffd24a', '#1a0206', 10 );
	outlined( ctx, 'WORLD', w / 2, h * 0.45, `italic 900 150px ${ HEAVY }`, '#ffffff', '#1a0206', 14, w - 60 );
	outlined( ctx, 'CHAMPIONS', w / 2, h * 0.72, `italic 900 150px ${ HEAVY }`, '#ffffff', '#1a0206', 14, w - 60 );
	ctx.shadowBlur = 0;

}

function pileShot( ctx, w, h, f ) {

	// the pile on the mound: white uniforms heaped, gloves and caps in the air
	crowd( ctx, 0, 0, w, h * 0.4, 55, 1.1 );
	ctx.fillStyle = '#346a31'; ctx.fillRect( 0, h * 0.4, w, h * 0.6 );
	ctx.fillStyle = '#8f5a3a'; ctx.beginPath(); ctx.ellipse( w / 2, h * 0.8, w * 0.36, h * 0.16, 0, 0, Math.PI * 2 ); ctx.fill();
	for ( let i = 0; i < 22; i ++ ) {

		const x = w * ( 0.28 + 0.44 * hashS( i * 2.3 ) ), y = h * ( 0.55 + 0.25 * hashS( i * 4.1 ) );
		ctx.fillStyle = hashS( i ) < 0.8 ? '#ecebe7' : '#9ea3aa';
		ctx.beginPath(); ctx.ellipse( x, y, 38, 30, hashS( i * 9 ) * 3, 0, Math.PI * 2 ); ctx.fill();
		ctx.fillStyle = '#c8102e'; ctx.beginPath(); ctx.arc( x + 10, y - 26, 12, 0, Math.PI * 2 ); ctx.fill();

	}

	for ( let i = 0; i < 6; i ++ ) {

		ctx.fillStyle = i % 2 ? '#6b3a1a' : '#c8102e';
		ctx.beginPath(); ctx.arc( w * ( 0.3 + 0.08 * i ), h * ( 0.3 - 0.04 * ( ( i + f ) % 3 ) ), 16, 0, Math.PI * 2 ); ctx.fill();

	}

	ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
	outlined( ctx, 'WORLD CHAMPIONS!', 40, h * 0.1, `italic 900 70px ${ HEAVY }`, '#ffd24a', '#101018', 8 );

}

function thanks( ctx, w, h ) {

	streaks( ctx, w, h, 'home', 77 );
	ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
	outlined( ctx, 'THANK YOU', w / 2, h * 0.24, `italic 900 120px ${ HEAVY }`, '#ffffff', '#101018', 12 );
	outlined( ctx, 'PHILLIES FANS!', w / 2, h * 0.47, `italic 900 120px ${ HEAVY }`, '#ffffff', '#101018', 12, w - 60 );
	outlined( ctx, 'WORLD CHAMPIONS  1980 · 2008', w / 2, h * 0.74, `italic 800 60px ${ SANS }`, '#ffd24a', '#101018', 8, w - 80 );

}

function titleCard( ctx, w, h, S ) {

	streaks( ctx, w, h, 'away', 1 );
	ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
	wsBug( ctx, w * 0.2, h * 0.45, 2.2 );
	outlined( ctx, 'GAME 5', w * 0.64, h * 0.26, `italic 900 130px ${ HEAVY }`, '#ffffff', '#101018', 12 );
	outlined( ctx, 'RAYS  at  PHILLIES', w * 0.64, h * 0.5, `italic 900 70px ${ HEAVY }`, '#ffd24a', '#101018', 8, w * 0.6 );
	ctx.font = `800 36px ${ SANS }`; ctx.fillStyle = '#ffffff';
	ctx.fillText( 'CITIZENS BANK PARK  ·  PHILADELPHIA', w * 0.64, h * 0.7, w * 0.6 );
	ctx.fillText( `SERIES: PHILLIES LEAD 3-1`, w * 0.64, h * 0.82, w * 0.6 );
	void S;

}

function ordinal( n ) {

	return n + ( [ 'th', 'st', 'nd', 'rd' ][ ( n % 100 - 20 ) % 10 ] || [ 'th', 'st', 'nd', 'rd' ][ n % 100 ] || 'th' ).toUpperCase();

}
