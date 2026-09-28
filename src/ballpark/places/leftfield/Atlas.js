// The left field corner's printed and lit things, drawn once into one atlas (Kit.js): the top half lit
// from behind (Harry the K's hanging sign and its LOWER LEVEL / UPPER LEVEL arrows, the back bar's bottles,
// the two menus, the beer signs, the specials board, the Gulf disc, the BUBBA burger boxes), the bottom half
// printed (the photographs on Harry's walls, the Kalas plaque, the pennants, the section plates, the nine
// big baseball cards of the Phillies' batting order at the Left Field Gate).
//
// Evidence: Harry's sign (orange, green rim, the microphone, HARRY THE K'S over BROADCAST BAR & GRILLE,
// hung from the underside of the deck with LOWER LEVEL / UPPER LEVEL arrows under it: BaseballParks.com,
// 2004); the menus and their prices (Phillies.com, 'Harry the K's Broadcast Bar & Grille', Spring 2008
// menu, captured 2008-10-06); the Porch (sections 241-245) and the $1 dogs upstairs in the Alley Hour (the
// same pages); the nine cards of the day's batting order at the Left Field Gate (BaseballParks.com, 2004);
// Game 5's lineup (the box score). The photographs on the walls are invented and kept generic (no one's
// likeness): the booth's microphone, the Vet, the 1980 parade, Connie Mack Stadium, a scorecard.
export const ATLAS_W = 2048, ATLAS_H = 1024;

export const CELLS = {
	// lit (y < 512)
	hkSign: [ 0, 0, 512, 256 ], hkDir: [ 512, 0, 512, 96 ], neonBud: [ 512, 96, 256, 96 ], neonYuengling: [ 768, 96, 256, 96 ],
	neonMiller: [ 512, 192, 256, 64 ], hkFascia: [ 768, 192, 256, 64 ],
	backbar: [ 0, 256, 1024, 256 ], menuDown: [ 1024, 0, 512, 384 ], menuUp: [ 1536, 0, 512, 384 ],
	specials: [ 1024, 384, 256, 128 ], gulf: [ 1280, 384, 128, 128 ], bubba: [ 1408, 384, 256, 64 ], porchSign: [ 1408, 448, 256, 64 ],
	exit: [ 1664, 384, 128, 64 ], tvDark: [ 1792, 384, 128, 64 ],
	// printed (y >= 512)
	photos: [ 0, 512, 1024, 256 ], plaque: [ 1024, 512, 512, 128 ], pennants: [ 1536, 512, 512, 128 ],
	plates: [ 1024, 640, 1024, 96 ], lineup: [ 0, 768, 1152, 256 ], rules: [ 1152, 736, 512, 96 ], phanatic: [ 1664, 736, 384, 288 ],
	cartDraft: [ 1152, 832, 256, 96 ], cartFunnel: [ 1408, 832, 256, 96 ], cartNachos: [ 1152, 928, 256, 96 ], cartHatfield: [ 1408, 928, 256, 96 ],
};
// the photographs (six across 'photos') and the plates (sixteen across 'plates') as sub-cells
for ( let i = 0; i < 6; i ++ ) CELLS[ 'photo' + i ] = [ 12 + i * 168, 524, 160, 232 ];
export const PLATES = [ '140', '141', '142', '143', '144', '145', '146', '147', '148', '241', '242', '243', '244', '245', '246', '138' ];
PLATES.forEach( ( n, i ) => CELLS[ 'plate' + n ] = [ 1024 + i * 64, 640, 64, 96 ] );
// Game 5's batting order (the Phillies', October 27, 2008): the nine cards at the gate
export const LINEUP = [ [ 'ROLLINS', 'SS', 11 ], [ 'WERTH', 'RF', 28 ], [ 'UTLEY', '2B', 26 ], [ 'HOWARD', '1B', 6 ], [ 'BURRELL', 'LF', 5 ],
	[ 'VICTORINO', 'CF', 8 ], [ 'FELIZ', '3B', 7 ], [ 'RUIZ', 'C', 51 ], [ 'HAMELS', 'P', 35 ] ];
LINEUP.forEach( ( _, i ) => CELLS[ 'card' + i ] = [ i * 128, 768, 128, 256 ] );

const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const COND = '"Arial Narrow", "Helvetica Neue Condensed Bold", "Helvetica Neue", Arial, sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';
const SCRIPT = '"Brush Script MT", "Snell Roundhand", "Apple Chancery", Georgia, serif';

const rr = ( ctx, x, y, w, h, r ) => {

	ctx.beginPath();
	ctx.moveTo( x + r, y );
	ctx.arcTo( x + w, y, x + w, y + h, r );
	ctx.arcTo( x + w, y + h, x, y + h, r );
	ctx.arcTo( x, y + h, x, y, r );
	ctx.arcTo( x, y, x + w, y, r );
	ctx.closePath();

};

// a seeded random for the drawing (the same atlas every load)
function rng( seed ) {

	let s = seed >>> 0;
	return () => {

		s = ( s + 0x6D2B79F5 ) >>> 0;
		let t = s;
		t = Math.imul( t ^ ( t >>> 15 ), t | 1 );
		t ^= t + Math.imul( t ^ ( t >>> 7 ), t | 61 );
		return ( ( t ^ ( t >>> 14 ) ) >>> 0 ) / 4294967296;

	};

}

// the microphone of the sign's crest: a 1950s broadcast mic on its stand
function mic( ctx, x, y, s, col ) {

	ctx.save();
	ctx.translate( x, y );
	ctx.scale( s, s );
	ctx.fillStyle = col;
	rr( ctx, - 9, - 30, 18, 30, 8 );
	ctx.fill();
	ctx.fillRect( - 2, 0, 4, 12 );
	ctx.fillRect( - 10, 12, 20, 3 );
	ctx.strokeStyle = 'rgba( 0, 0, 0, 0.35 )';
	ctx.lineWidth = 1.2;
	for ( let k = - 22; k < - 4; k += 4 ) {

		ctx.beginPath(); ctx.moveTo( - 8, k ); ctx.lineTo( 8, k ); ctx.stroke();

	}

	ctx.restore();

}

export function drawAtlas( ctx ) {

	const r = rng( 452 );
	ctx.fillStyle = '#101010';
	ctx.fillRect( 0, 0, ATLAS_W, ATLAS_H );
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	const cell = ( k ) => CELLS[ k ];

	// ---- Harry the K's sign (Flickr, 2009: the lit box hung under the deck): a long hexagon, its corners
	// cut, orange lit from behind inside a black and a white line and a lime-green neon rim; the microphone
	// with its radio waves; HARRY in big white capitals, THE small, K'S big; BROADCAST BAR & GRILLE under it
	{

		const [ x, y, w, h ] = cell( 'hkSign' );
		ctx.fillStyle = '#050505'; ctx.fillRect( x, y, w, h );
		const hex = ( i ) => {

			const c = 46 - i;
			ctx.beginPath();
			ctx.moveTo( x + i + c, y + i ); ctx.lineTo( x + w - i - c, y + i ); ctx.lineTo( x + w - i, y + h / 2 ); ctx.lineTo( x + w - i - c, y + h - i );
			ctx.lineTo( x + i + c, y + h - i ); ctx.lineTo( x + i, y + h / 2 ); ctx.closePath();

		};
		ctx.save();
		ctx.shadowColor = '#b6ff3a'; ctx.shadowBlur = 18;
		hex( 6 ); ctx.fillStyle = '#9be23a'; ctx.fill();
		ctx.restore();
		hex( 16 ); ctx.fillStyle = '#f7f2e4'; ctx.fill();
		hex( 20 ); ctx.fillStyle = '#111111'; ctx.fill();
		hex( 25 );
		const g = ctx.createRadialGradient( x + w / 2, y + h / 2, 20, x + w / 2, y + h / 2, w * 0.55 );
		g.addColorStop( 0, '#ffb42a' ); g.addColorStop( 1, '#f07c10' );
		ctx.fillStyle = g; ctx.fill();
		// the microphone and its waves
		mic( ctx, x + w / 2, y + 78, 1.05, '#fbf7ea' );
		ctx.strokeStyle = '#1f5a28'; ctx.lineWidth = 3;
		for ( const s of [ - 1, 1 ] ) for ( let k = 0; k < 3; k ++ ) {

			ctx.beginPath();
			ctx.arc( x + w / 2, y + 62, 24 + k * 9, s > 0 ? - 0.5 : Math.PI - 0.5, s > 0 ? 0.5 : Math.PI + 0.5 );
			ctx.stroke();

		}

		ctx.fillStyle = '#fbf7ea';
		ctx.strokeStyle = '#a3350c'; ctx.lineWidth = 3;
		ctx.textAlign = 'left';
		ctx.font = `900 64px ${ COND }`;
		const wH = ctx.measureText( 'HARRY' ).width;
		ctx.font = `900 30px ${ COND }`;
		const wT = ctx.measureText( 'THE' ).width;
		ctx.font = `900 64px ${ COND }`;
		const wK = ctx.measureText( 'K’S' ).width;
		let tx = x + w / 2 - ( wH + wT + wK + 24 ) / 2;
		ctx.strokeText( 'HARRY', tx, y + 146 ); ctx.fillText( 'HARRY', tx, y + 146 );
		tx += wH + 12;
		ctx.font = `900 30px ${ COND }`;
		ctx.strokeText( 'THE', tx, y + 156 ); ctx.fillText( 'THE', tx, y + 156 );
		tx += wT + 12;
		ctx.font = `900 64px ${ COND }`;
		ctx.strokeText( 'K’S', tx, y + 146 ); ctx.fillText( 'K’S', tx, y + 146 );
		ctx.textAlign = 'center';
		ctx.fillStyle = '#ffe89a';
		ctx.font = `800 20px ${ SANS }`;
		ctx.fillText( 'BROADCAST  BAR  &  GRILLE', x + w / 2, y + 196, w - 150 );

	}

	// ---- the arrows under it (the 2004 photo's words, the 2009 photo's board): dark green, a red disc with
	// a white arrow at each end
	{

		const [ x, y, w, h ] = cell( 'hkDir' );
		ctx.fillStyle = '#123524'; ctx.fillRect( x, y, w, h );
		ctx.strokeStyle = '#c9c9c0'; ctx.lineWidth = 3; ctx.strokeRect( x + 3, y + 3, w - 6, h - 6 );
		for ( const [ cx, dir ] of [ [ x + 44, - 1 ], [ x + w - 44, 1 ] ] ) {

			ctx.fillStyle = '#d0271d';
			ctx.beginPath(); ctx.arc( cx, y + h / 2, 30, 0, Math.PI * 2 ); ctx.fill();
			ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.stroke();
			ctx.fillStyle = '#ffffff';
			ctx.beginPath();
			ctx.moveTo( cx + dir * 16, y + h / 2 ); ctx.lineTo( cx - dir * 4, y + h / 2 - 14 ); ctx.lineTo( cx - dir * 4, y + h / 2 + 14 );
			ctx.fill();
			ctx.fillRect( cx - dir * 16 - ( dir > 0 ? 0 : 12 ), y + h / 2 - 4, 12, 8 );

		}

		ctx.fillStyle = '#f2ede1';
		ctx.font = `800 32px ${ SANS }`;
		ctx.fillText( 'LOWER  LEVEL', x + 180, y + h / 2 + 2 );
		ctx.fillText( 'UPPER  LEVEL', x + w - 180, y + h / 2 + 2 );
		ctx.fillStyle = '#c9c9c0'; ctx.fillRect( x + w / 2 - 2, y + 12, 4, h - 24 );

	}

	// ---- beer signs in the windows: Budweiser's red script, Yuengling Lager, Miller Lite
	{

		const neon = ( k, draw ) => {

			const [ x, y, w, h ] = cell( k );
			ctx.save();
			ctx.fillStyle = '#050505'; ctx.fillRect( x, y, w, h );
			ctx.beginPath(); ctx.rect( x, y, w, h ); ctx.clip();
			draw( x, y, w, h );
			ctx.restore();

		};

		neon( 'neonBud', ( x, y, w, h ) => {

			ctx.shadowColor = '#ff2a2a'; ctx.shadowBlur = 16;
			ctx.fillStyle = '#ff4b3a';
			ctx.font = `italic 700 58px ${ SCRIPT }`;
			ctx.fillText( 'Budweiser', x + w / 2, y + h / 2 + 4, w - 20 );
			ctx.shadowBlur = 0;

		} );
		neon( 'neonYuengling', ( x, y, w, h ) => {

			ctx.shadowColor = '#ffd36a'; ctx.shadowBlur = 12;
			ctx.fillStyle = '#ffe3a0';
			ctx.font = `700 34px ${ SERIF }`;
			ctx.fillText( 'YUENGLING', x + w / 2, y + 36, w - 24 );
			ctx.fillStyle = '#6ad0ff'; ctx.shadowColor = '#6ad0ff';
			ctx.font = `italic 700 26px ${ SERIF }`;
			ctx.fillText( 'Lager', x + w / 2, y + 70 );
			ctx.shadowBlur = 0;

		} );
		neon( 'neonMiller', ( x, y, w, h ) => {

			ctx.shadowColor = '#7ab8ff'; ctx.shadowBlur = 12;
			ctx.fillStyle = '#d9ecff';
			ctx.font = `800 36px ${ SANS }`;
			ctx.fillText( 'MILLER LITE', x + w / 2, y + h / 2 + 2, w - 20 );
			ctx.shadowBlur = 0;

		} );

	}

	// ---- the lower level's fascia over its bar: the name in cream on slate navy, the mic between
	{

		const [ x, y, w, h ] = cell( 'hkFascia' );
		ctx.fillStyle = '#20324a'; ctx.fillRect( x, y, w, h );
		ctx.fillStyle = '#f2ede1';
		ctx.font = `800 30px ${ SANS }`;
		ctx.fillText( 'HARRY THE K’S', x + w / 2 + 10, y + h / 2 + 2, w - 60 );
		mic( ctx, x + 22, y + h / 2 + 8, 0.7, '#e98a14' );

	}

	// ---- the back bar: two glass shelves of bottles lit from under them against a dark mirror, the taps'
	// handles below
	{

		const [ x, y, w, h ] = cell( 'backbar' );
		const g = ctx.createLinearGradient( x, y, x, y + h );
		g.addColorStop( 0, '#1b130d' ); g.addColorStop( 1, '#0b0806' );
		ctx.fillStyle = g; ctx.fillRect( x, y, w, h );
		// the mirror's glow and the shelves
		for ( const sy of [ 104, 204 ] ) {

			const gl = ctx.createLinearGradient( x, y + sy - 90, x, y + sy );
			gl.addColorStop( 0, 'rgba( 255, 190, 120, 0.02 )' ); gl.addColorStop( 1, 'rgba( 255, 190, 120, 0.3 )' );
			ctx.fillStyle = gl; ctx.fillRect( x + 6, y + sy - 90, w - 12, 90 );
			// bottles: a dozen shapes, glass and labels
			let bx = x + 12;
			while ( bx < x + w - 24 ) {

				const kind = r();
				const bw = kind < 0.3 ? 16 : kind < 0.7 ? 20 : 26, bh = 50 + r() * 34;
				const glass = [ '#1d4a24', '#6b3a10', '#a36a1f', '#cfd6d2', '#3a2410', '#7c1a1a', '#274a6a' ][ Math.floor( r() * 7 ) ];
				ctx.fillStyle = glass;
				ctx.fillRect( bx, y + sy - bh, bw, bh );
				// the neck and the cap
				ctx.fillRect( bx + bw / 2 - 3, y + sy - bh - 16, 6, 16 );
				ctx.fillStyle = '#c9b27a'; ctx.fillRect( bx + bw / 2 - 3, y + sy - bh - 20, 6, 5 );
				// the label
				ctx.fillStyle = [ '#efe6d0', '#1a1a1a', '#b31b1b', '#e8d27a', '#ffffff' ][ Math.floor( r() * 5 ) ];
				ctx.fillRect( bx + 2, y + sy - bh * 0.62, bw - 4, bh * 0.3 );
				// the light through the glass
				ctx.fillStyle = 'rgba( 255, 220, 160, 0.25 )'; ctx.fillRect( bx + 2, y + sy - bh + 4, 3, bh - 8 );
				bx += bw + 3 + r() * 5;

			}

			ctx.fillStyle = '#d8c7a0'; ctx.fillRect( x, y + sy, w, 4 );

		}

		// the taps' handles, a row across the bottom
		for ( let k = 0; k < 14; k ++ ) {

			const tx = x + 70 + k * 64;
			ctx.fillStyle = [ '#c8102e', '#1b4f9c', '#e8c16a', '#2b6b2b', '#1a1a1a', '#e8e1d0' ][ k % 6 ];
			rr( ctx, tx - 7, y + 214, 14, 36, 4 ); ctx.fill();
			ctx.fillStyle = '#c0c0c0'; ctx.fillRect( tx - 2, y + 248, 4, 8 );

		}

	}

	// ---- the menus: the lower level's sit-down menu and the upstairs one, cream on a dark board (Spring
	// 2008, as the Phillies posted it that October)
	const menu = ( k, title, sub, items ) => {

		const [ x, y, w, h ] = cell( k );
		ctx.fillStyle = '#12100e'; ctx.fillRect( x, y, w, h );
		ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 6; ctx.strokeRect( x + 6, y + 6, w - 12, h - 12 );
		ctx.fillStyle = '#e98a14';
		ctx.font = `900 34px ${ SANS }`;
		ctx.fillText( title, x + w / 2, y + 36, w - 40 );
		ctx.fillStyle = '#9fc59a';
		ctx.font = `italic 600 18px ${ SERIF }`;
		ctx.fillText( sub, x + w / 2, y + 64, w - 40 );
		ctx.textAlign = 'left';
		items.forEach( ( [ name, price ], i ) => {

			const yy = y + 96 + i * 26;
			ctx.fillStyle = '#f1e6cc';
			ctx.font = `700 19px ${ COND }`;
			ctx.fillText( name, x + 24, yy, w - 120 );
			ctx.textAlign = 'right';
			ctx.fillText( price, x + w - 24, yy );
			ctx.textAlign = 'left';

		} );
		ctx.textAlign = 'center';

	};

	menu( 'menuDown', 'HARRY THE K’S', 'Lower Level  •  Broadcast Bar & Grille', [
		[ 'Philadelphia Cheese Steak', '10.00' ], [ 'The Schmitter  (McNally’s)', '10.00' ], [ 'Grand Slam Burger', '10.50' ],
		[ 'Open Faced BBQ Brisket', '10.50' ], [ 'Harry’s Famous Buffalo Wings 2½ lb', '24.00' ], [ 'Boneless Buffalo Wings', '10.00' ],
		[ 'Philly Steak Spring Rolls', '9.00' ], [ 'Queso Fundido', '9.00' ], [ 'Maryland Crab Soup', '6.00' ], [ 'Ballpark Fries', '5.00' ],
	] );
	menu( 'menuUp', 'HARRY’S UPSTAIRS', 'Upper Level  •  on the Scoreboard Porch', [
		[ 'Philadelphia Cheese Steak', '10.00' ], [ 'TBLT Wrap', '10.00' ], [ 'Appetizer Sampler', '16.00' ], [ 'Buffalo Wings 2½ lb', '24.00' ],
		[ 'Boneless Buffalo Wings', '10.00' ], [ 'Batter Dipped Chicken Tenders', '8.50' ], [ 'Philly Steak Spring Rolls', '9.00' ], [ 'Queso Fundido', '9.00' ],
		[ 'Ballpark Fries  (cheese sauce 1.00)', '5.00' ],
	] );

	// ---- the specials board, in chalk
	{

		const [ x, y, w, h ] = cell( 'specials' );
		ctx.fillStyle = '#18221c'; ctx.fillRect( x, y, w, h );
		ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 8; ctx.strokeRect( x + 4, y + 4, w - 8, h - 8 );
		ctx.fillStyle = '#eef0e6';
		ctx.font = `700 24px ${ SANS }`;
		ctx.fillText( 'EVERY GAME', x + w / 2, y + 30 );
		ctx.fillStyle = '#f6d36b';
		ctx.font = `900 34px ${ SANS }`;
		ctx.fillText( '$1 DOGS', x + w / 2, y + 66 );
		ctx.fillStyle = '#eef0e6';
		ctx.font = `600 16px ${ SANS }`;
		ctx.fillText( 'upstairs in the Alley Hour', x + w / 2, y + 98, w - 20 );

	}

	// ---- the Gulf disc (orange, the white band, navy letters) and the BUBBA burger boxes at the corner
	{

		const [ x, y, w, h ] = cell( 'gulf' );
		ctx.fillStyle = '#000'; ctx.fillRect( x, y, w, h );
		ctx.fillStyle = '#f26522';
		ctx.beginPath(); ctx.arc( x + w / 2, y + h / 2, w / 2 - 2, 0, Math.PI * 2 ); ctx.fill();
		ctx.fillStyle = '#ffffff';
		ctx.beginPath(); ctx.arc( x + w / 2, y + h / 2, w / 2 - 14, 0, Math.PI * 2 ); ctx.fill();
		ctx.fillStyle = '#f26522';
		ctx.beginPath(); ctx.arc( x + w / 2, y + h / 2, w / 2 - 22, 0, Math.PI * 2 ); ctx.fill();
		ctx.fillStyle = '#12235e';
		ctx.font = `900 38px ${ SANS }`;
		ctx.fillText( 'Gulf', x + w / 2, y + h / 2 + 2 );

	}

	{

		const [ x, y, w, h ] = cell( 'bubba' );
		ctx.fillStyle = '#c4161c'; ctx.fillRect( x, y, w, h );
		ctx.fillStyle = '#ffffff';
		ctx.font = `900 38px ${ SANS }`;
		ctx.fillText( 'BUBBA', x + w * 0.36, y + h / 2 + 2 );
		ctx.font = `italic 700 26px ${ SANS }`;
		ctx.fillText( 'burger', x + w * 0.76, y + h / 2 + 4 );

	}

	{

		const [ x, y, w, h ] = cell( 'porchSign' );
		ctx.fillStyle = '#20324a'; ctx.fillRect( x, y, w, h );
		ctx.fillStyle = '#f2ede1';
		ctx.font = `800 22px ${ SANS }`;
		ctx.fillText( 'SCOREBOARD PORCH', x + w / 2, y + 22, w - 20 );
		ctx.font = `600 16px ${ SANS }`;
		ctx.fillText( 'SECTIONS 241 – 245', x + w / 2, y + 46 );

	}

	{

		const [ x, y, w, h ] = cell( 'exit' );
		ctx.fillStyle = '#0a0a0a'; ctx.fillRect( x, y, w, h );
		ctx.fillStyle = '#ff2a1a';
		ctx.font = `800 40px ${ SANS }`;
		ctx.fillText( 'EXIT', x + w / 2, y + h / 2 + 2 );

	}

	{

		// a dark screen with a faint reflection (a TV that's off)
		const [ x, y, w, h ] = cell( 'tvDark' );
		const g = ctx.createLinearGradient( x, y, x + w, y + h );
		g.addColorStop( 0, '#1a1c20' ); g.addColorStop( 1, '#050506' );
		ctx.fillStyle = g; ctx.fillRect( x, y, w, h );

	}

	// ---- printed: the photographs on Harry's walls, in their black frames and mats
	const photo = ( i, draw, caption ) => {

		const [ x, y, w, h ] = cell( 'photo' + i );
		ctx.fillStyle = '#0d0d0d'; ctx.fillRect( x, y, w, h );
		ctx.fillStyle = '#ece6d6'; ctx.fillRect( x + 10, y + 10, w - 20, h - 20 );
		const ix = x + 22, iy = y + 22, iw = w - 44, ih = h - 74;
		ctx.save();
		ctx.beginPath(); ctx.rect( ix, iy, iw, ih ); ctx.clip();
		draw( ix, iy, iw, ih );
		ctx.restore();
		ctx.fillStyle = '#2a2a2a';
		ctx.font = `italic 600 13px ${ SERIF }`;
		ctx.fillText( caption, x + w / 2, y + h - 30, w - 30 );

	};

	photo( 0, ( x, y, w, h ) => {

		// the booth's microphone, black and white
		ctx.fillStyle = '#4a4a4a'; ctx.fillRect( x, y, w, h );
		const g = ctx.createRadialGradient( x + w / 2, y + h * 0.4, 5, x + w / 2, y + h * 0.4, w );
		g.addColorStop( 0, '#9a9a9a' ); g.addColorStop( 1, '#222' );
		ctx.fillStyle = g; ctx.fillRect( x, y, w, h );
		mic( ctx, x + w / 2, y + h * 0.62, 2.4, '#d8d8d8' );

	}, 'The booth, WPHT 1210' );
	photo( 1, ( x, y, w, h ) => {

		// the Vet from above: the round bowl, the green
		ctx.fillStyle = '#6c6f6a'; ctx.fillRect( x, y, w, h );
		ctx.fillStyle = '#b9b2a2';
		ctx.beginPath(); ctx.ellipse( x + w / 2, y + h / 2, w * 0.42, h * 0.36, 0, 0, Math.PI * 2 ); ctx.fill();
		ctx.fillStyle = '#3d6b3a';
		ctx.beginPath(); ctx.ellipse( x + w / 2, y + h / 2, w * 0.26, h * 0.22, 0, 0, Math.PI * 2 ); ctx.fill();
		ctx.fillStyle = '#a07a50';
		ctx.beginPath(); ctx.moveTo( x + w / 2, y + h * 0.62 ); ctx.lineTo( x + w * 0.62, y + h * 0.5 ); ctx.lineTo( x + w / 2, y + h * 0.38 ); ctx.lineTo( x + w * 0.38, y + h * 0.5 ); ctx.fill();

	}, 'Veterans Stadium, 1971-2003' );
	photo( 2, ( x, y, w, h ) => {

		// the 1980 parade: a sea of heads, a float
		ctx.fillStyle = '#8a8a8a'; ctx.fillRect( x, y, w, h );
		for ( let k = 0; k < 260; k ++ ) {

			ctx.fillStyle = r() < 0.5 ? '#3a3a3a' : '#5c5c5c';
			ctx.beginPath(); ctx.arc( x + r() * w, y + h * 0.45 + r() * h * 0.55, 2 + r() * 3, 0, Math.PI * 2 ); ctx.fill();

		}

		ctx.fillStyle = '#d0d0d0'; ctx.fillRect( x + w * 0.2, y + h * 0.3, w * 0.6, h * 0.16 );
		ctx.fillStyle = '#222'; ctx.font = `800 14px ${ SANS }`; ctx.fillText( 'WORLD CHAMPS', x + w / 2, y + h * 0.38 );

	}, 'Broad Street, October 1980' );
	photo( 3, ( x, y, w, h ) => {

		// Connie Mack Stadium's corner tower
		ctx.fillStyle = '#9c9c9c'; ctx.fillRect( x, y, w, h );
		ctx.fillStyle = '#5a5a5a'; ctx.fillRect( x + w * 0.1, y + h * 0.35, w * 0.8, h * 0.65 );
		ctx.fillStyle = '#6c6c6c'; ctx.fillRect( x + w * 0.35, y + h * 0.1, w * 0.3, h * 0.4 );
		ctx.fillStyle = '#3a3a3a';
		for ( let k = 0; k < 5; k ++ ) ctx.fillRect( x + w * 0.16 + k * w * 0.14, y + h * 0.5, w * 0.06, h * 0.12 );

	}, 'Connie Mack Stadium, 21st & Lehigh' );
	photo( 4, ( x, y, w, h ) => {

		// a scorecard in pencil
		ctx.fillStyle = '#e8e0c8'; ctx.fillRect( x, y, w, h );
		ctx.strokeStyle = '#8a8a8a'; ctx.lineWidth = 1;
		for ( let k = 0; k <= 10; k ++ ) {

			ctx.beginPath(); ctx.moveTo( x, y + k * h / 10 ); ctx.lineTo( x + w, y + k * h / 10 ); ctx.stroke();
			ctx.beginPath(); ctx.moveTo( x + k * w / 10, y ); ctx.lineTo( x + k * w / 10, y + h ); ctx.stroke();

		}

		ctx.fillStyle = '#333';
		for ( let k = 0; k < 30; k ++ ) {

			ctx.font = `600 10px ${ SANS }`;
			ctx.fillText( [ 'K', '6-3', '1B', 'F8', 'BB', '4-3', 'HR' ][ Math.floor( r() * 7 ) ], x + ( 1 + Math.floor( r() * 9 ) + 0.5 ) * w / 10, y + ( Math.floor( r() * 10 ) + 0.5 ) * h / 10 );

		}

	}, 'Kept in the booth' );
	photo( 5, ( x, y, w, h ) => {

		// the 1980 World Series pennant
		ctx.fillStyle = '#3a3a3a'; ctx.fillRect( x, y, w, h );
		ctx.fillStyle = '#b3121b';
		ctx.beginPath(); ctx.moveTo( x + 10, y + h * 0.25 ); ctx.lineTo( x + w - 6, y + h * 0.5 ); ctx.lineTo( x + 10, y + h * 0.75 ); ctx.fill();
		ctx.fillStyle = '#fff'; ctx.font = `800 14px ${ SANS }`; ctx.textAlign = 'left';
		ctx.fillText( 'PHILLIES 1980', x + 18, y + h * 0.5 );
		ctx.textAlign = 'center';

	}, 'World Champions, 1980' );

	// ---- the plaque: the man the bar's named for (Phillies.com's Harry the K's page; the Hall of Fame)
	{

		const [ x, y, w, h ] = cell( 'plaque' );
		const g = ctx.createLinearGradient( x, y, x, y + h );
		g.addColorStop( 0, '#6b4a22' ); g.addColorStop( 1, '#3a2610' );
		ctx.fillStyle = g; ctx.fillRect( x, y, w, h );
		ctx.fillStyle = '#c9a44a'; ctx.fillRect( x + 12, y + 12, w - 24, h - 24 );
		ctx.fillStyle = '#2a1c0c';
		ctx.font = `700 34px ${ SERIF }`;
		ctx.fillText( 'HARRY KALAS', x + w / 2, y + 42 );
		ctx.font = `italic 600 19px ${ SERIF }`;
		ctx.fillText( 'The Voice of the Phillies since 1971', x + w / 2, y + 74, w - 40 );
		ctx.font = `600 15px ${ SERIF }`;
		ctx.fillText( 'Ford C. Frick Award, Baseball Hall of Fame, 2002', x + w / 2, y + 100, w - 40 );

	}

	// ---- pennants on a string: 1950, 1980, 1983, 1993, and the fresh one from the NLCS (October 15, 2008)
	{

		const [ x, y, w, h ] = cell( 'pennants' );
		ctx.fillStyle = '#1b130d'; ctx.fillRect( x, y, w, h );
		const P = [ [ '#1e3f8f', 'WHIZ KIDS 1950' ], [ '#b3121b', 'WORLD CHAMPS 1980' ], [ '#b3121b', 'N.L. CHAMPS 1983' ], [ '#1e3f8f', 'N.L. CHAMPS 1993' ], [ '#b3121b', 'N.L. CHAMPS 2008' ] ];
		P.forEach( ( [ col, text ], i ) => {

			const px = x + 6 + i * ( w - 12 ) / P.length, pw = ( w - 12 ) / P.length - 6;
			ctx.fillStyle = col;
			ctx.beginPath(); ctx.moveTo( px, y + 16 ); ctx.lineTo( px + pw, y + 16 ); ctx.lineTo( px + pw / 2, y + h - 6 ); ctx.fill();
			ctx.save();
			ctx.translate( px + pw / 2, y + 44 );
			ctx.fillStyle = '#ffffff';
			ctx.font = `800 11px ${ SANS }`;
			ctx.fillText( text.split( ' ' ).slice( 0, - 1 ).join( ' ' ), 0, 0, pw - 12 );
			ctx.font = `900 18px ${ SANS }`;
			ctx.fillText( text.split( ' ' ).slice( - 1 )[ 0 ], 0, 22 );
			ctx.restore();

		} );
		ctx.fillStyle = '#c9b27a'; ctx.fillRect( x, y + 12, w, 4 );

	}

	// ---- section plates: tan, maroon numerals (the 2008 photos behind the 140s)
	PLATES.forEach( ( n ) => {

		const [ x, y, w, h ] = cell( 'plate' + n );
		ctx.fillStyle = '#cdbe93'; ctx.fillRect( x + 2, y + 2, w - 4, h - 4 );
		ctx.strokeStyle = '#6a1a1c'; ctx.lineWidth = 3; ctx.strokeRect( x + 6, y + 6, w - 12, h - 12 );
		ctx.fillStyle = '#6a1a1c';
		ctx.font = `900 30px ${ COND }`;
		ctx.fillText( n, x + w / 2, y + h / 2 - 6 );
		ctx.font = `700 10px ${ SANS }`;
		ctx.fillText( 'SECTION', x + w / 2, y + h - 18 );

	} );

	// ---- the nine big baseball cards at the Left Field Gate: Game 5's batting order (a red frame, the
	// pinstripes, his number big, the name bar and his place in the order; no faces)
	LINEUP.forEach( ( [ name, pos, num ], i ) => {

		const [ x, y, w, h ] = cell( 'card' + i );
		ctx.fillStyle = '#f4f0e6'; ctx.fillRect( x + 2, y + 2, w - 4, h - 4 );
		ctx.fillStyle = '#c8102e'; ctx.fillRect( x + 8, y + 8, w - 16, h - 16 );
		ctx.fillStyle = '#f1ede4'; ctx.fillRect( x + 14, y + 14, w - 28, h - 70 );
		ctx.strokeStyle = 'rgba( 200, 16, 46, 0.35 )'; ctx.lineWidth = 1.5;
		for ( let px = x + 18; px < x + w - 14; px += 7 ) {

			ctx.beginPath(); ctx.moveTo( px, y + 14 ); ctx.lineTo( px, y + h - 56 ); ctx.stroke();

		}

		ctx.fillStyle = '#c8102e';
		ctx.font = `900 64px ${ SANS }`;
		ctx.fillText( String( num ), x + w / 2, y + 96 );
		ctx.fillStyle = '#0b2a5b';
		ctx.beginPath(); ctx.arc( x + 30, y + 34, 16, 0, Math.PI * 2 ); ctx.fill();
		ctx.fillStyle = '#ffffff';
		ctx.font = `900 20px ${ SANS }`;
		ctx.fillText( String( i + 1 ), x + 30, y + 35 );
		ctx.fillStyle = '#ffffff';
		ctx.font = `900 19px ${ COND }`;
		ctx.fillText( name, x + w / 2, y + h - 40, w - 22 );
		ctx.font = `700 13px ${ SANS }`;
		ctx.fillText( pos, x + w / 2, y + h - 20 );

	} );

	// ---- the rules board by Harry's host stand
	{

		const [ x, y, w, h ] = cell( 'rules' );
		ctx.fillStyle = '#20324a'; ctx.fillRect( x, y, w, h );
		ctx.fillStyle = '#f2ede1';
		ctx.font = `700 22px ${ SANS }`;
		ctx.fillText( 'PLEASE WAIT TO BE SEATED', x + w / 2, y + 30, w - 30 );
		ctx.font = `500 15px ${ SANS }`;
		ctx.fillText( 'Open to all ticket holders  •  Tables served until the 8th', x + w / 2, y + 62, w - 30 );

	}

	// ---- the Phanatic, big, on the wall behind the scoreboard by the Left Field Gate (BaseballParks.com,
	// 2004: 'an immense picture of the beloved Phillie Phanatic'; the Game 5 arrival photo, Oct 27): painted
	// here as a big friendly face over a summer sky (the mascot, no one's likeness)
	{

		const [ x, y, w, h ] = cell( 'phanatic' );
		const sky = ctx.createLinearGradient( x, y, x, y + h );
		sky.addColorStop( 0, '#6fa6d8' ); sky.addColorStop( 1, '#d6e8f2' );
		ctx.fillStyle = sky; ctx.fillRect( x, y, w, h );
		for ( let k = 0; k < 14; k ++ ) {

			ctx.fillStyle = 'rgba( 255, 255, 255, 0.5 )';
			ctx.beginPath(); ctx.ellipse( x + r() * w, y + r() * h * 0.5, 30 + r() * 40, 10 + r() * 10, 0, 0, Math.PI * 2 ); ctx.fill();

		}

		const cx = x + w / 2, cy = y + h * 0.62;
		// the fur: a shaggy green head, tufts round it
		for ( let k = 0; k < 900; k ++ ) {

			const a = r() * Math.PI * 2, rr2 = 70 + r() * 70;
			ctx.strokeStyle = [ '#3f9a2c', '#58b43a', '#2c7a20', '#6cc44a' ][ Math.floor( r() * 4 ) ];
			ctx.lineWidth = 3;
			ctx.beginPath();
			ctx.moveTo( cx + Math.cos( a ) * rr2 * 0.6, cy + Math.sin( a ) * rr2 * 0.55 );
			ctx.lineTo( cx + Math.cos( a ) * rr2, cy + Math.sin( a ) * rr2 * 0.85 );
			ctx.stroke();

		}

		ctx.fillStyle = '#4aa834';
		ctx.beginPath(); ctx.ellipse( cx, cy, 95, 80, 0, 0, Math.PI * 2 ); ctx.fill();
		// the snout, long, curling out toward us
		ctx.fillStyle = '#e3a51c';
		ctx.beginPath(); ctx.ellipse( cx + 6, cy + 42, 30, 46, 0.15, 0, Math.PI * 2 ); ctx.fill();
		ctx.fillStyle = '#1f1f1f';
		ctx.beginPath(); ctx.ellipse( cx + 12, cy + 80, 18, 8, 0.15, 0, Math.PI * 2 ); ctx.fill();
		// the eyes: big, bulging, pink lids, looking up
		for ( const s of [ - 1, 1 ] ) {

			ctx.fillStyle = '#ffffff';
			ctx.beginPath(); ctx.arc( cx + s * 36, cy - 22, 30, 0, Math.PI * 2 ); ctx.fill();
			ctx.fillStyle = '#222222';
			ctx.beginPath(); ctx.arc( cx + s * 32, cy - 30, 12, 0, Math.PI * 2 ); ctx.fill();
			ctx.fillStyle = '#e46aa0';
			ctx.beginPath(); ctx.arc( cx + s * 36, cy - 22, 31, Math.PI * 1.05, Math.PI * 1.95 ); ctx.lineTo( cx + s * 36, cy - 22 ); ctx.fill();

		}

		// the red cap on top
		ctx.fillStyle = '#c8102e';
		ctx.beginPath(); ctx.ellipse( cx, cy - 70, 50, 24, 0, Math.PI, 0 ); ctx.fill();
		ctx.fillRect( cx - 50, cy - 72, 100, 8 );

	}

	// ---- the portables' signs (the Phillies' concessions guide, October 2008: draft beer in the left field
	// scoreboard area, funnel cake and nachos behind 141, a Hatfield Grill cart behind 145)
	const cart = ( k, bg, fg, text, sub ) => {

		const [ x, y, w, h ] = cell( k );
		ctx.fillStyle = bg; ctx.fillRect( x, y, w, h );
		ctx.fillStyle = '#ffffff'; ctx.fillRect( x + 4, y + 4, w - 8, 6 ); ctx.fillRect( x + 4, y + h - 10, w - 8, 6 );
		ctx.fillStyle = fg;
		ctx.font = `900 34px ${ SANS }`;
		ctx.fillText( text, x + w / 2, y + h * 0.42, w - 20 );
		ctx.font = `700 16px ${ SANS }`;
		ctx.fillText( sub, x + w / 2, y + h * 0.76, w - 20 );

	};
	cart( 'cartDraft', '#7a1a14', '#f6d36b', 'DRAFT BEER', 'Domestic  •  Import  •  Local' );
	cart( 'cartFunnel', '#f4e3b0', '#b3121b', 'FUNNEL CAKE', 'Powdered sugar  •  hot' );
	cart( 'cartNachos', '#1f4a2a', '#ffd23a', 'NACHOS', 'Cheese  •  jalapeños' );
	cart( 'cartHatfield', '#b3121b', '#ffffff', 'HATFIELD', 'Hot dogs  •  sausages' );

}
