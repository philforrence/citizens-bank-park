// The homemade signs in the Alley, hand-lettered in marker on poster board (the sign prop's atlas cells,
// Folk's `signs`). Invented, in the spirit of the two nights: the 27th's rain, the 29th's three and a half
// innings for a title, 28 years since 1980, Lidge's perfect season, the Rays' cowbells.

const MARKER = '"Marker Felt", "Chalkboard SE", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif';

function board( ctx, w, h, tint = '#f4f1e8' ) {

	ctx.fillStyle = tint;
	ctx.fillRect( 0, 0, w, h );
	// the board's edge, a bent corner, the tape
	ctx.strokeStyle = 'rgba( 0, 0, 0, 0.12 )'; ctx.lineWidth = 4; ctx.strokeRect( 3, 3, w - 6, h - 6 );
	ctx.fillStyle = 'rgba( 230, 225, 200, 0.7 )'; ctx.fillRect( w * 0.45, 0, w * 0.1, 14 );

}

function lines( ctx, w, h, rows, { colors = [ '#c8102e', '#1c3f94' ], font = MARKER, weight = 800 } = {} ) {

	const n = rows.length;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	rows.forEach( ( r, i ) => {

		const size = Math.min( h / ( n + 0.6 ) * 0.9, w * 1.7 / Math.max( 4, r.length ) );
		ctx.font = `${ weight } ${ size }px ${ font }`;
		ctx.fillStyle = colors[ i % colors.length ];
		// a hand's wobble: each line a little off level
		ctx.save();
		ctx.translate( w / 2, h * ( i + 0.8 ) / ( n + 0.6 ) );
		ctx.rotate( ( ( i * 7 + r.length ) % 5 - 2 ) * 0.012 );
		ctx.fillText( r, 0, 0, w - 24 );
		ctx.restore();

	} );

}

export const SIGNS = [
	// 0 (the 27th) Tommy's
	( c, w, h ) => { board( c, w, h ); lines( c, w, h, [ 'RAIN?', "WE'RE NOT", 'LEAVING' ] ); },
	// 1 (the 29th) Tommy's
	( c, w, h ) => { board( c, w, h ); lines( c, w, h, [ 'RAIN CHECK', 'CASHED IN', '3½ INNINGS!' ], { colors: [ '#1c3f94', '#c8102e', '#c8102e' ] } ); },
	( c, w, h ) => { board( c, w, h, '#c8102e' ); lines( c, w, h, [ 'FINISH', 'IT!' ], { colors: [ '#ffffff' ] } ); },
	( c, w, h ) => { board( c, w, h ); lines( c, w, h, [ '28 YEARS', 'IS LONG', 'ENOUGH' ] ); },
	( c, w, h ) => { board( c, w, h ); lines( c, w, h, [ 'LIDGE', '48 FOR 48' ], { colors: [ '#c8102e', '#1c3f94' ] } ); },
	( c, w, h ) => { board( c, w, h, '#fff7c0' ); lines( c, w, h, [ 'COWBELLS', 'ARE FOR', 'COWS' ], { colors: [ '#1c3f94' ] } ); },
	( c, w, h ) => { board( c, w, h ); lines( c, w, h, [ 'WELCOME TO', 'PHILLY WEATHER', 'RAYS' ], { colors: [ '#1c3f94', '#c8102e' ] } ); },
	( c, w, h ) => { board( c, w, h ); lines( c, w, h, [ 'UTLEY', 'FOR MAYOR' ] ); },
	( c, w, h ) => { board( c, w, h ); lines( c, w, h, [ 'I LEFT WORK', 'FOR 3½', 'INNINGS' ], { colors: [ '#222', '#c8102e', '#222' ] } ); },
	( c, w, h ) => { board( c, w, h ); lines( c, w, h, [ 'IN CHARLIE', 'WE TRUST' ], { colors: [ '#c8102e', '#1c3f94' ] } ); },
	( c, w, h ) => { board( c, w, h ); lines( c, w, h, [ 'SEEN BETTER RAYS', 'AT THE CAMDEN', 'AQUARIUM' ], { colors: [ '#1c3f94', '#1c3f94', '#c8102e' ] } ); },
	( c, w, h ) => { board( c, w, h, '#1c3f94' ); lines( c, w, h, [ 'FIGHTIN', 'PHILS' ], { colors: [ '#ffffff', '#ff4050' ] } ); },
	( c, w, h ) => { board( c, w, h ); lines( c, w, h, [ 'FROZEN', 'BUT', 'FAITHFUL' ], { colors: [ '#3a7bd5', '#222', '#c8102e' ] } ); },
	( c, w, h ) => { board( c, w, h ); lines( c, w, h, [ 'MY FIRST', 'WORLD SERIES' ], { colors: [ '#c8102e', '#1c3f94' ] } ); },
	( c, w, h ) => { board( c, w, h ); lines( c, w, h, [ 'SINCE 1980', 'WE WAITED' ], { colors: [ '#1c3f94', '#c8102e' ] } ); },
];
export const SIGN = { notLeaving: 0, rainCheck: 1, finishIt: 2, years: 3, lidge: 4, cowbells: 5, weather: 6, utley: 7, leftWork: 8, charlie: 9, aquarium: 10, fightin: 11, frozen: 12, firstWS: 13, since1980: 14 };
