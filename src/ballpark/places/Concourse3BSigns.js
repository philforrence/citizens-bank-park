import { canvasTexture } from '../geo.js';

// The third base concourse's hung things, printed (Concourse3BProps.js puts them up): the players'
// banners in the trusses (the 2008 photos: Jimmy Rollins and Pedro Feliz over the Third Base Gate's
// atrium on Game 5 night, Greg Dobbs by 129-130, Kyle Kendrick, Pat Burrell), a big photo in a navy frame
// with a red nameplate in cream serif caps; the Coca-Cola pole banners on the columns (a player, the
// "Home of the Phillies / Citizens Bank Park / Est. 2004" diamond); the atrium's directional sign
// ("SECTIONS 101-132 / ESCALATOR / FIRST AID / ADVANCE TICKETS / GUEST SERVICES / McFADDEN'S / FIRST BASE
// GATE / PHANATIC PHUN ZONE", white with pinstripes, navy caps, red border and band); ELEVATORS DOWN
// ONLY; and the bedsheet a fan hung over Brewerytown on Oct 27 2008 (auds' photo): "GOOD LUCK" CHARLIE &
// PHILLIES From Buena Vista, Virginia (Charlie Manuel's home town), a photo of Charlie on it.
export const ATLAS2 = [ 2048, 1024 ];
export const CELLS2 = {
	rollins: [ 0, 0, 400, 500 ], feliz: [ 400, 0, 400, 500 ], dobbs: [ 800, 0, 400, 500 ], kendrick: [ 1200, 0, 400, 500 ], burrell: [ 1600, 0, 400, 500 ],
	pole51: [ 0, 500, 200, 520 ], pole26: [ 200, 500, 200, 520 ], pole35: [ 400, 500, 200, 520 ],
	wayfind: [ 600, 500, 320, 480 ], elevators: [ 920, 500, 320, 140 ], goodLuck: [ 1240, 500, 640, 260 ], homeStand: [ 920, 660, 320, 110 ],
};

const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';
const hash = ( s ) => {

	const x = Math.sin( s * 12.9898 + 78.233 ) * 43758.5453;
	return x - Math.floor( x );

};

// a crowd out of focus behind the player (the photographer's long lens at the park)
function blurCrowd( ctx, x, y, w, h, seed ) {

	ctx.save();
	ctx.beginPath(); ctx.rect( x, y, w, h ); ctx.clip();
	const g = ctx.createLinearGradient( 0, y, 0, y + h );
	g.addColorStop( 0, '#5b2a2e' ); g.addColorStop( 0.65, '#7a3b3b' ); g.addColorStop( 0.66, '#2d5a36' ); g.addColorStop( 1, '#3b6d3c' );
	ctx.fillStyle = g;
	ctx.fillRect( x, y, w, h );
	ctx.filter = 'blur( 5px )';
	for ( let i = 0; i < 260; i ++ ) {

		const q = hash( seed + i * 1.7 );
		ctx.fillStyle = q < 0.5 ? '#c42a3a' : q < 0.7 ? '#efe6dc' : q < 0.85 ? '#2a2630' : '#d8a078';
		ctx.beginPath(); ctx.arc( x + hash( seed * 3 + i ) * w, y + hash( seed * 7 + i * 0.3 ) * h * 0.62, 6 + hash( i ) * 8, 0, Math.PI * 2 ); ctx.fill();

	}

	ctx.filter = 'none';
	ctx.restore();

}

// a Phillie in the home pinstripes, big: 'bat' (in the box), 'swing' (the follow-through), 'run' (out of
// the box, helmet on), 'pitch' (the leg kick); his number
function player( ctx, cx, base, s, pose, num, skin = '#d9a07a' ) {

	ctx.save();
	ctx.translate( cx, base );
	ctx.scale( s, s );
	ctx.lineCap = 'round'; ctx.lineJoin = 'round';
	const white = '#f1efe9', red = '#c8102e', pin = 'rgba( 170, 30, 50, 0.4 )';
	const limb = ( pts, w, c ) => {

		ctx.strokeStyle = c; ctx.lineWidth = w;
		ctx.beginPath(); ctx.moveTo( ...pts[ 0 ] ); for ( const p of pts.slice( 1 ) ) ctx.lineTo( ...p ); ctx.stroke();

	};

	const legs = {
		bat: [ [ [ - 8, - 100 ], [ - 30, - 50 ], [ - 36, 0 ] ], [ [ 8, - 100 ], [ 26, - 52 ], [ 32, 0 ] ] ],
		swing: [ [ [ - 8, - 100 ], [ - 34, - 52 ], [ - 44, 0 ] ], [ [ 8, - 100 ], [ 20, - 55 ], [ 36, - 4 ] ] ],
		run: [ [ [ - 8, - 100 ], [ - 40, - 62 ], [ - 62, - 24 ] ], [ [ 8, - 100 ], [ 30, - 50 ], [ 18, 0 ] ] ],
		pitch: [ [ [ - 8, - 100 ], [ - 16, - 50 ], [ - 18, 0 ] ], [ [ 8, - 100 ], [ 44, - 118 ], [ 40, - 78 ] ] ],
	}[ pose ];
	for ( const L of legs ) limb( L, 26, white );
	for ( const L of legs ) limb( L, 1.5, pin );
	// the socks and the spikes
	for ( const L of legs ) {

		const [ fx, fy ] = L[ 2 ];
		ctx.fillStyle = red; ctx.fillRect( fx - 10, fy - 22, 20, 18 );
		ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse( fx + 6, fy - 2, 16, 7, 0, 0, Math.PI * 2 ); ctx.fill();

	}

	// the trunk: the jersey, the script, the belt
	const tilt = pose === 'swing' ? 0.3 : pose === 'run' ? 0.35 : pose === 'pitch' ? - 0.15 : 0.1;
	ctx.save();
	ctx.translate( 0, - 100 );
	ctx.rotate( tilt );
	ctx.fillStyle = white;
	ctx.beginPath(); ctx.moveTo( - 26, 0 ); ctx.lineTo( 26, 0 ); ctx.lineTo( 32, - 78 ); ctx.lineTo( - 32, - 78 ); ctx.closePath(); ctx.fill();
	ctx.fillStyle = pin;
	for ( let x = - 30; x < 32; x += 7 ) ctx.fillRect( x, - 78, 1.5, 78 );
	ctx.fillStyle = '#6a1020'; ctx.fillRect( - 26, - 6, 52, 7 );
	ctx.fillStyle = red; ctx.font = `italic 700 17px "Brush Script MT", Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
	ctx.fillText( 'Phillies', 0, - 50 );
	ctx.font = `800 13px ${ SERIF }`; ctx.fillText( num, 16, - 34 );
	// the arms and the bat (or the glove)
	const sleeves = { bat: [ [ [ - 28, - 72 ], [ - 14, - 46 ], [ 6, - 70 ] ], [ [ 28, - 72 ], [ 20, - 50 ], [ 6, - 70 ] ] ],
		swing: [ [ [ - 28, - 72 ], [ - 52, - 70 ], [ - 70, - 84 ] ], [ [ 28, - 72 ], [ - 10, - 64 ], [ - 62, - 82 ] ] ],
		run: [ [ [ - 28, - 72 ], [ - 52, - 50 ], [ - 40, - 30 ] ], [ [ 28, - 72 ], [ 52, - 88 ], [ 70, - 70 ] ] ],
		pitch: [ [ [ - 28, - 72 ], [ - 60, - 70 ], [ - 84, - 96 ] ], [ [ 28, - 72 ], [ 50, - 54 ], [ 40, - 32 ] ] ] }[ pose ];
	for ( const A of sleeves ) {

		limb( A.slice( 0, 2 ), 18, white );
		limb( A.slice( 1 ), 14, pose === 'pitch' ? red : skin );

	}

	if ( pose === 'bat' ) limb( [ [ 6, - 70 ], [ - 6, - 150 ] ], 7, '#b58a55' );
	if ( pose === 'swing' ) limb( [ [ - 66, - 82 ], [ - 130, - 60 ] ], 7, '#b58a55' );
	if ( pose === 'pitch' ) {

		ctx.fillStyle = '#5a3a20'; ctx.beginPath(); ctx.ellipse( 40, - 30, 14, 16, 0.4, 0, Math.PI * 2 ); ctx.fill();

	}

	// the head: a red helmet (a cap on the pitcher)
	ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse( 0, - 96, 15, 18, 0, 0, Math.PI * 2 ); ctx.fill();
	ctx.fillStyle = red;
	ctx.beginPath(); ctx.ellipse( 2, - 104, 18, 14, 0, Math.PI, Math.PI * 2 ); ctx.fill();
	ctx.fillRect( pose === 'pitch' ? 4 : - 18, - 106, 26, 5 );
	if ( pose !== 'pitch' ) {

		ctx.beginPath(); ctx.ellipse( - 12, - 98, 7, 11, 0, 0, Math.PI * 2 ); ctx.fill();

	}

	ctx.restore();
	ctx.restore();

}

export function drawAtlas2() {

	return canvasTexture( ATLAS2[ 0 ], ATLAS2[ 1 ], ( ctx ) => {

		ctx.fillStyle = '#101010';
		ctx.fillRect( 0, 0, ATLAS2[ 0 ], ATLAS2[ 1 ] );
		// ---- the players' banners
		const banners = [ [ 'rollins', 'JIMMY ROLLINS', 'bat', '11' ], [ 'feliz', 'PEDRO FELIZ', 'swing', '7' ], [ 'dobbs', 'GREG DOBBS', 'run', '19' ],
			[ 'kendrick', 'KYLE KENDRICK', 'pitch', '38' ], [ 'burrell', 'PAT BURRELL', 'swing', '5' ] ];
		banners.forEach( ( [ k, name, pose, num ], i ) => {

			const [ x, y, w, h ] = CELLS2[ k ];
			ctx.fillStyle = '#1a2441'; ctx.fillRect( x, y, w, h );
			ctx.fillStyle = '#b5152b'; ctx.fillRect( x + 12, y + 12, w - 24, h - 90 );
			blurCrowd( ctx, x + 18, y + 18, w - 36, h - 102, 3 + i * 17 );
			ctx.save();
			ctx.beginPath(); ctx.rect( x + 18, y + 18, w - 36, h - 102 ); ctx.clip();
			player( ctx, x + w / 2, y + h - 110, 2.0, pose, num, i === 0 ? '#8a5a3c' : i === 1 ? '#b47d5a' : '#dca483' );
			ctx.restore();
			// the nameplate: a red panel with notched ends, cream serif caps
			ctx.fillStyle = '#b5152b';
			ctx.beginPath();
			ctx.moveTo( x + 30, y + h - 82 ); ctx.lineTo( x + w - 30, y + h - 82 ); ctx.lineTo( x + w - 18, y + h - 70 ); ctx.lineTo( x + w - 18, y + h - 26 );
			ctx.lineTo( x + w - 30, y + h - 14 ); ctx.lineTo( x + 30, y + h - 14 ); ctx.lineTo( x + 18, y + h - 26 ); ctx.lineTo( x + 18, y + h - 70 ); ctx.closePath(); ctx.fill();
			ctx.strokeStyle = '#efe4c4'; ctx.lineWidth = 2; ctx.stroke();
			ctx.fillStyle = '#efe4c4'; ctx.font = `600 34px ${ SERIF }`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
			ctx.fillText( name, x + w / 2, y + h - 47, w - 60 );

		} );
		// ---- the Coca-Cola pole banners: the red header, a player, the Home of the Phillies diamond
		[ [ 'pole51', '51', 'bat' ], [ 'pole26', '26', 'swing' ], [ 'pole35', '35', 'pitch' ] ].forEach( ( [ k, num, pose ], i ) => {

			const [ x, y, w, h ] = CELLS2[ k ];
			ctx.fillStyle = '#1b2f63'; ctx.fillRect( x, y, w, h );
			blurCrowd( ctx, x + 6, y + 70, w - 12, h - 150, 41 + i * 9 );
			ctx.save();
			ctx.beginPath(); ctx.rect( x + 6, y + 70, w - 12, h - 150 ); ctx.clip();
			player( ctx, x + w / 2, y + h - 90, 1.35, pose, num );
			ctx.restore();
			ctx.fillStyle = '#e41b23'; ctx.fillRect( x, y, w, 66 );
			ctx.fillStyle = '#ffffff'; ctx.font = `italic 700 40px "Brush Script MT", Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
			ctx.fillText( 'Coca-Cola', x + w / 2, y + 36, w - 16 );
			// the diamond: Home of the Phillies, Citizens Bank Park, Est. 2004
			const dx = x + w / 2, dy = y + h - 44;
			ctx.fillStyle = '#b5152b'; ctx.fillRect( x, y + h - 80, w, 80 );
			ctx.fillStyle = '#1b2f63';
			ctx.beginPath(); ctx.moveTo( dx, dy - 34 ); ctx.lineTo( dx + 60, dy ); ctx.lineTo( dx, dy + 34 ); ctx.lineTo( dx - 60, dy ); ctx.closePath(); ctx.fill();
			ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
			ctx.fillStyle = '#ffffff'; ctx.font = `700 7px ${ SANS }`;
			ctx.fillText( 'HOME OF THE', dx, dy - 18 );
			ctx.fillStyle = '#e41b23'; ctx.font = `italic 700 17px "Brush Script MT", Georgia, serif`;
			ctx.fillText( 'Phillies', dx, dy - 4 );
			ctx.fillStyle = '#2f8a43'; ctx.fillRect( dx - 44, dy + 6, 88, 11 );
			ctx.fillStyle = '#ffffff'; ctx.font = `700 7px ${ SANS }`;
			ctx.fillText( 'Citizens Bank Park', dx, dy + 12 );
			ctx.fillText( 'EST. 2004', dx, dy + 24 );

		} );
		// ---- the directional sign in the atrium
		{

			const [ x, y, w, h ] = CELLS2.wayfind;
			ctx.fillStyle = '#c8102e'; ctx.fillRect( x, y, w, h );
			ctx.fillStyle = '#f7f5ef'; ctx.fillRect( x + 8, y + 8, w - 16, h - 70 );
			ctx.fillStyle = 'rgba( 150, 150, 170, 0.18 )';
			for ( let px = x + 14; px < x + w - 8; px += 9 ) ctx.fillRect( px, y + 8, 1, h - 70 );
			ctx.fillStyle = '#1f2f6b'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
			const lines = [ 'SECTIONS 101 - 132', 'ESCALATOR', 'FIRST AID', 'ADVANCE TICKETS', 'GUEST SERVICES', "McFADDEN'S", 'FIRST BASE GATE', 'PHANATIC PHUN ZONE' ];
			ctx.font = `700 34px ${ SANS }`; ctx.fillText( '↑', x + 18, y + 40 );
			ctx.font = `700 25px "Arial Narrow", ${ SANS }`;
			lines.forEach( ( l, i ) => ctx.fillText( l, x + 52, y + 40 + i * 46, w - 70 ) );
			// the band with the park's mark
			ctx.fillStyle = '#ffffff';
			ctx.beginPath(); ctx.moveTo( x + w / 2, y + h - 56 ); ctx.lineTo( x + w / 2 + 34, y + h - 32 ); ctx.lineTo( x + w / 2, y + h - 8 ); ctx.lineTo( x + w / 2 - 34, y + h - 32 ); ctx.closePath(); ctx.fill();
			ctx.fillStyle = '#c8102e'; ctx.font = `italic 700 13px "Brush Script MT", Georgia, serif`; ctx.textAlign = 'center';
			ctx.fillText( 'Phillies', x + w / 2, y + h - 32 );

		}

		// ---- ELEVATORS DOWN ONLY: cream with a red band
		{

			const [ x, y, w, h ] = CELLS2.elevators;
			ctx.fillStyle = '#efe4c4'; ctx.fillRect( x, y, w, h );
			ctx.fillStyle = '#9e1b2a'; ctx.fillRect( x, y + h - 36, w, 36 );
			ctx.strokeStyle = '#232a4d'; ctx.lineWidth = 6; ctx.strokeRect( x + 3, y + 3, w - 6, h - 6 );
			ctx.fillStyle = '#1f1b33'; ctx.font = `800 40px ${ SANS }`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
			ctx.fillText( 'ELEVATORS', x + w / 2 + 16, y + 48, w - 80 );
			ctx.fillRect( x + 22, y + 22, 34, 48 );
			ctx.fillStyle = '#efe4c4'; ctx.fillRect( x + 30, y + 30, 18, 32 );
			ctx.fillStyle = '#efe4c4'; ctx.font = `600 20px ${ SERIF }`;
			ctx.fillText( '↓  DOWN ONLY', x + w / 2, y + h - 18 );

		}

		// ---- the good luck banner: a bedsheet, printed at a copy shop, hung off a rail with twine
		{

			const [ x, y, w, h ] = CELLS2.goodLuck;
			ctx.fillStyle = '#f2f1ee'; ctx.fillRect( x, y, w, h );
			ctx.fillStyle = 'rgba( 0, 0, 0, 0.06 )';
			for ( let i = 0; i < 9; i ++ ) ctx.fillRect( x + i * w / 9 + hash( i ) * 20, y, 3, h );
			// Charlie in his jacket and cap
			ctx.fillStyle = '#20242e'; ctx.fillRect( x + 16, y + 20, 150, 210 );
			ctx.fillStyle = '#b3122a'; ctx.fillRect( x + 36, y + 130, 110, 100 );
			ctx.fillStyle = '#e0b090'; ctx.beginPath(); ctx.ellipse( x + 90, y + 100, 32, 38, 0, 0, Math.PI * 2 ); ctx.fill();
			ctx.fillStyle = '#b3122a'; ctx.beginPath(); ctx.ellipse( x + 90, y + 76, 36, 20, 0, Math.PI, Math.PI * 2 ); ctx.fill(); ctx.fillRect( x + 50, y + 74, 62, 8 );
			ctx.fillStyle = '#b3122a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
			ctx.font = `700 44px ${ SANS }`; ctx.fillText( '"GOOD LUCK"', x + 400, y + 60, 440 );
			ctx.font = `700 40px ${ SANS }`; ctx.fillText( 'CHARLIE & PHILLIES', x + 400, y + 120, 440 );
			ctx.font = `600 36px ${ SANS }`; ctx.fillText( 'From Buena Vista, Virginia', x + 400, y + 180, 450 );

		}

		// ---- HOME STAND: the Phillies' merchandise shops' sign
		{

			const [ x, y, w, h ] = CELLS2.homeStand;
			ctx.fillStyle = '#1f2440'; ctx.fillRect( x, y, w, h );
			ctx.strokeStyle = '#c9a45a'; ctx.lineWidth = 3; ctx.strokeRect( x + 6, y + 6, w - 12, h - 12 );
			ctx.fillStyle = '#efe4c4'; ctx.font = `800 40px ${ SERIF }`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
			ctx.fillText( 'HOME STAND', x + w / 2, y + 44, w - 30 );
			ctx.font = `700 13px ${ SANS }`; ctx.fillText( '★ ★  OFFICIAL PHILLIES MERCHANDISE  ★ ★', x + w / 2, y + 82, w - 30 );

		}

	}, 'concourse3bBanners' );

}
