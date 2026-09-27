import { Mesh, BufferGeometry, Float32BufferAttribute } from '../../../engine/index.js';
import { standard } from '../../../materials/Materials.js';
import { commonModule } from '../../../engine/render/wgsl/common.js';
import { canvasTexture } from '../../geo.js';
import { LEVELS } from '../../layout.js';

// The first base side's printed things and the small things they hang on, in one draw: the players'
// banners in the trusses, the Coca-Cola pole banners, the directional signs, the South Philadelphia
// Market's illustrated header, the program kiosk's signs, the carts' signs, the caricaturist's samples.
// A vertex's uv is a palette entry (uv.x < 100: its colour, gloss and glow) or a place in the atlas
// (offset by 100), so plain and printed share one material.
const STREET = LEVELS.mainConcourse;
const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';
const NARROW = '"Arial Narrow", "Helvetica Neue", Arial, sans-serif';
const SCRIPT = '"Brush Script MT", "Snell Roundhand", Georgia, serif';

// [ name, linear albedo, roughness, metalness, glow ]
const PALETTE = [
	[ 'navy', [ 0.012, 0.02, 0.06 ], 0.5, 0 ], [ 'red', [ 0.36, 0.02, 0.03 ], 0.4, 0.1 ], [ 'white', [ 0.72, 0.71, 0.68 ], 0.6, 0 ],
	[ 'grey', [ 0.2, 0.2, 0.21 ], 0.55, 0.3 ], [ 'steel', [ 0.55, 0.56, 0.57 ], 0.28, 0.9 ], [ 'black', [ 0.015, 0.015, 0.017 ], 0.35, 0 ],
	[ 'royal', [ 0.02, 0.07, 0.32 ], 0.35, 0 ], [ 'wood', [ 0.3, 0.18, 0.09 ], 0.7, 0 ], [ 'cream', [ 0.6, 0.54, 0.4 ], 0.6, 0 ],
	[ 'maroon', [ 0.13, 0.035, 0.03 ], 0.55, 0.4 ], [ 'green', [ 0.04, 0.24, 0.07 ], 0.45, 0 ], [ 'yellow', [ 0.78, 0.56, 0.02 ], 0.4, 0 ],
	[ 'lamp', [ 0.8, 0.78, 0.72 ], 0.5, 0, [ 1.0, 0.86, 0.66 ] ], [ 'tape', [ 0.55, 0.5, 0.36 ], 0.5, 0 ], [ 'rubber', [ 0.015, 0.015, 0.016 ], 0.8, 0 ],
	[ 'paper', [ 0.7, 0.68, 0.62 ], 0.95, 0 ], [ 'cardboard', [ 0.42, 0.29, 0.16 ], 0.85, 0 ], [ 'glass', [ 0.04, 0.05, 0.06 ], 0.05, 0.3 ],
	[ 'screen', [ 0.02, 0.03, 0.03 ], 0.2, 0, [ 0.12, 0.5, 0.3 ] ], [ 'chrome', [ 0.8, 0.8, 0.82 ], 0.15, 1 ], [ 'redLamp', [ 0.4, 0.05, 0.02 ], 0.4, 0, [ 1.0, 0.25, 0.08 ] ],
	[ 'foam', [ 0.2, 0.55, 0.2 ], 0.9, 0 ], [ 'orange', [ 0.8, 0.25, 0.02 ], 0.5, 0 ], [ 'skin', [ 0.55, 0.35, 0.25 ], 0.6, 0 ],
	[ 'concrete', [ 0.42, 0.41, 0.39 ], 0.85, 0 ], [ 'charcoal', [ 0.04, 0.042, 0.045 ], 0.6, 0 ], [ 'brick', [ 0.26, 0.075, 0.045 ], 0.85, 0 ],
	[ 'limestone', [ 0.6, 0.55, 0.45 ], 0.75, 0 ], [ 'phanatic', [ 0.08, 0.33, 0.07 ], 0.9, 0 ], [ 'mulch', [ 0.12, 0.07, 0.04 ], 0.95, 0 ],
];
export const PAL = Object.fromEntries( PALETTE.map( ( p, i ) => [ p[ 0 ], i ] ) );
const f3 = ( c ) => `vec3f( ${ c.map( ( v ) => v.toFixed( 3 ) ).join( ', ' ) } )`;

// the atlas: named rectangles (pixels); lit ones (signs with lights behind) listed in LIT
const ATLAS = [ 2048, 2048 ];
export const CELLS = {
	// the players' banners (a photo in a navy frame, a red nameplate)
	utley: [ 0, 0, 400, 500 ], howard: [ 400, 0, 400, 500 ], hamels: [ 800, 0, 400, 500 ], victorino: [ 1200, 0, 400, 500 ], werth: [ 1600, 0, 400, 500 ],
	myers: [ 0, 500, 400, 500 ],
	// the Coca-Cola pole banners
	pole6: [ 400, 500, 200, 520 ], pole8: [ 600, 500, 200, 520 ], pole28: [ 800, 500, 200, 520 ], pole54: [ 1000, 500, 200, 520 ], pole11: [ 1200, 500, 200, 520 ],
	// the directional signs
	wayRF: [ 1400, 500, 320, 480 ], wayGate: [ 1720, 500, 320, 480 ],
	// the South Philadelphia Market's header, the program kiosk's panel, the hot chocolate sign
	market: [ 0, 1030, 1024, 124 ], programs: [ 1024, 1030, 512, 124 ], cocoaSign: [ 1536, 1030, 256, 190 ],
	// the carts' signs
	hatfieldCart: [ 0, 1160, 512, 128 ], phood: [ 512, 1160, 512, 128 ], draft: [ 1024, 1160, 512, 128 ], bottles: [ 1536, 1230, 512, 128 ],
	// the caricaturist's samples, WILL CALL, the World Series merchandise kiosk
	caricatures: [ 0, 1300, 512, 384 ], willCall: [ 512, 1300, 512, 128 ], wsMerch: [ 512, 1430, 512, 128 ], sketch: [ 1024, 1300, 256, 320 ],
	phunZone: [ 1280, 1370, 768, 160 ], inquirer: [ 1280, 1540, 768, 120 ], cobblestone: [ 0, 1700, 420, 320 ],
};
const LIT = [ 'hatfieldCart', 'phood', 'draft', 'bottles', 'programs', 'wsMerch', 'willCall' ];

const hash = ( s ) => {

	const x = Math.sin( s * 12.9898 + 78.233 ) * 43758.5453;
	return x - Math.floor( x );

};

// ---------------------------------------------------------------- drawing

// a crowd out of focus behind the player (the long lens)
function blurCrowd( ctx, x, y, w, h, seed ) {

	ctx.save();
	ctx.beginPath(); ctx.rect( x, y, w, h ); ctx.clip();
	const g = ctx.createLinearGradient( 0, y, 0, y + h );
	g.addColorStop( 0, '#4a2429' ); g.addColorStop( 0.62, '#6f3336' ); g.addColorStop( 0.63, '#2b5733' ); g.addColorStop( 1, '#3a6a3b' );
	ctx.fillStyle = g;
	ctx.fillRect( x, y, w, h );
	ctx.filter = 'blur( 5px )';
	for ( let i = 0; i < 240; i ++ ) {

		const q = hash( seed + i * 1.37 );
		ctx.fillStyle = q < 0.52 ? '#c42a3a' : q < 0.7 ? '#efe6dc' : q < 0.84 ? '#2a2630' : '#d8a078';
		ctx.beginPath(); ctx.arc( x + hash( seed * 5 + i ) * w, y + hash( seed * 11 + i * 0.3 ) * h * 0.6, 6 + hash( i + seed ) * 8, 0, Math.PI * 2 ); ctx.fill();

	}

	ctx.filter = 'none';
	ctx.restore();

}

// a Phillie in the home pinstripes: 'lefty' (Howard's and Utley's stance from the left side), 'bat',
// 'swing', 'pitch' (the leg kick), 'pitchL' (a lefty's: Hamels), 'field' (a catch in the outfield)
function player( ctx, cx, base, s, pose, num, skin ) {

	ctx.save();
	ctx.translate( cx, base );
	ctx.scale( ( pose === 'lefty' || pose === 'pitchL' ) ? - s : s, s );
	ctx.lineCap = 'round'; ctx.lineJoin = 'round';
	const white = '#f1efe9', red = '#c8102e', pin = 'rgba( 170, 30, 50, 0.4 )';
	const limb = ( pts, w, c ) => {

		ctx.strokeStyle = c; ctx.lineWidth = w;
		ctx.beginPath(); ctx.moveTo( ...pts[ 0 ] ); for ( const p of pts.slice( 1 ) ) ctx.lineTo( ...p ); ctx.stroke();

	};

	const P = pose === 'lefty' ? 'bat' : pose === 'pitchL' ? 'pitch' : pose;
	const legs = {
		bat: [ [ [ - 8, - 100 ], [ - 32, - 50 ], [ - 38, 0 ] ], [ [ 8, - 100 ], [ 28, - 52 ], [ 34, 0 ] ] ],
		swing: [ [ [ - 8, - 100 ], [ - 34, - 52 ], [ - 44, 0 ] ], [ [ 8, - 100 ], [ 20, - 55 ], [ 36, - 4 ] ] ],
		pitch: [ [ [ - 8, - 100 ], [ - 16, - 50 ], [ - 18, 0 ] ], [ [ 8, - 100 ], [ 44, - 118 ], [ 40, - 78 ] ] ],
		field: [ [ [ - 8, - 100 ], [ - 36, - 60 ], [ - 58, - 20 ] ], [ [ 8, - 100 ], [ 26, - 48 ], [ 20, 0 ] ] ],
	}[ P ];
	for ( const L of legs ) limb( L, 26, white );
	for ( const L of legs ) limb( L, 1.5, pin );
	for ( const L of legs ) {

		const [ fx, fy ] = L[ 2 ];
		ctx.fillStyle = red; ctx.fillRect( fx - 10, fy - 22, 20, 18 );
		ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse( fx + 6, fy - 2, 16, 7, 0, 0, Math.PI * 2 ); ctx.fill();

	}

	const tilt = P === 'swing' ? 0.3 : P === 'pitch' ? - 0.15 : P === 'field' ? 0.35 : 0.1;
	ctx.save();
	ctx.translate( 0, - 100 );
	ctx.rotate( tilt );
	ctx.fillStyle = white;
	ctx.beginPath(); ctx.moveTo( - 26, 0 ); ctx.lineTo( 26, 0 ); ctx.lineTo( 32, - 78 ); ctx.lineTo( - 32, - 78 ); ctx.closePath(); ctx.fill();
	ctx.fillStyle = pin;
	for ( let x = - 30; x < 32; x += 7 ) ctx.fillRect( x, - 78, 1.5, 78 );
	ctx.fillStyle = '#6a1020'; ctx.fillRect( - 26, - 6, 52, 7 );
	// the script and the number (turned back the right way for a lefty)
	ctx.save();
	if ( pose === 'lefty' || pose === 'pitchL' ) ctx.scale( - 1, 1 );
	ctx.fillStyle = red; ctx.font = `italic 700 17px ${ SCRIPT }`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
	ctx.fillText( 'Phillies', 0, - 50 );
	ctx.font = `800 13px ${ SERIF }`; ctx.fillText( num, pose === 'lefty' || pose === 'pitchL' ? - 16 : 16, - 34 );
	ctx.restore();
	const sleeves = {
		bat: [ [ [ - 28, - 72 ], [ - 14, - 46 ], [ 6, - 70 ] ], [ [ 28, - 72 ], [ 20, - 50 ], [ 6, - 70 ] ] ],
		swing: [ [ [ - 28, - 72 ], [ - 52, - 70 ], [ - 70, - 84 ] ], [ [ 28, - 72 ], [ - 10, - 64 ], [ - 62, - 82 ] ] ],
		pitch: [ [ [ - 28, - 72 ], [ - 60, - 70 ], [ - 84, - 96 ] ], [ [ 28, - 72 ], [ 50, - 54 ], [ 40, - 32 ] ] ],
		field: [ [ [ - 28, - 72 ], [ - 40, - 110 ], [ - 30, - 150 ] ], [ [ 28, - 72 ], [ 52, - 50 ], [ 60, - 30 ] ] ],
	}[ P ];
	for ( const A of sleeves ) {

		limb( A.slice( 0, 2 ), 18, white );
		limb( A.slice( 1 ), 14, P === 'pitch' ? red : skin );

	}

	if ( P === 'bat' ) limb( [ [ 6, - 70 ], [ - 6, - 150 ] ], 7, '#b58a55' );
	if ( P === 'swing' ) limb( [ [ - 66, - 82 ], [ - 130, - 60 ] ], 7, '#b58a55' );
	if ( P === 'pitch' ) {

		ctx.fillStyle = '#5a3a20'; ctx.beginPath(); ctx.ellipse( 40, - 30, 14, 16, 0.4, 0, Math.PI * 2 ); ctx.fill();

	}

	if ( P === 'field' ) {

		ctx.fillStyle = '#5a3a20'; ctx.beginPath(); ctx.ellipse( - 30, - 158, 16, 18, 0.2, 0, Math.PI * 2 ); ctx.fill();

	}

	ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse( 0, - 96, 15, 18, 0, 0, Math.PI * 2 ); ctx.fill();
	ctx.fillStyle = red;
	ctx.beginPath(); ctx.ellipse( 2, - 104, 18, 14, 0, Math.PI, Math.PI * 2 ); ctx.fill();
	ctx.fillRect( P === 'pitch' || P === 'field' ? 4 : - 18, - 106, 26, 5 );
	if ( P === 'bat' || P === 'swing' ) {

		ctx.beginPath(); ctx.ellipse( - 12, - 98, 7, 11, 0, 0, Math.PI * 2 ); ctx.fill();

	}

	ctx.restore();
	ctx.restore();

}

function banner( ctx, [ x, y, w, h ], name, pose, num, skin, seed ) {

	ctx.fillStyle = '#1a2441'; ctx.fillRect( x, y, w, h );
	ctx.fillStyle = '#b5152b'; ctx.fillRect( x + 12, y + 12, w - 24, h - 90 );
	blurCrowd( ctx, x + 18, y + 18, w - 36, h - 102, seed );
	ctx.save();
	ctx.beginPath(); ctx.rect( x + 18, y + 18, w - 36, h - 102 ); ctx.clip();
	player( ctx, x + w / 2, y + h - 110, 2.0, pose, num, skin );
	ctx.restore();
	ctx.fillStyle = '#b5152b';
	ctx.beginPath();
	ctx.moveTo( x + 30, y + h - 82 ); ctx.lineTo( x + w - 30, y + h - 82 ); ctx.lineTo( x + w - 18, y + h - 70 ); ctx.lineTo( x + w - 18, y + h - 26 );
	ctx.lineTo( x + w - 30, y + h - 14 ); ctx.lineTo( x + 30, y + h - 14 ); ctx.lineTo( x + 18, y + h - 26 ); ctx.lineTo( x + 18, y + h - 70 ); ctx.closePath(); ctx.fill();
	ctx.strokeStyle = '#efe4c4'; ctx.lineWidth = 2; ctx.stroke();
	ctx.fillStyle = '#efe4c4'; ctx.font = `600 34px ${ SERIF }`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
	ctx.fillText( name, x + w / 2, y + h - 47, w - 60 );

}

function pole( ctx, [ x, y, w, h ], num, pose, skin, seed ) {

	ctx.fillStyle = '#1b2f63'; ctx.fillRect( x, y, w, h );
	blurCrowd( ctx, x + 6, y + 70, w - 12, h - 150, seed );
	ctx.save();
	ctx.beginPath(); ctx.rect( x + 6, y + 70, w - 12, h - 150 ); ctx.clip();
	player( ctx, x + w / 2, y + h - 90, 1.35, pose, num, skin );
	ctx.restore();
	ctx.fillStyle = '#e41b23'; ctx.fillRect( x, y, w, 66 );
	ctx.fillStyle = '#ffffff'; ctx.font = `italic 700 40px ${ SCRIPT }`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
	ctx.fillText( 'Coca-Cola', x + w / 2, y + 36, w - 16 );
	const dx = x + w / 2, dy = y + h - 44;
	ctx.fillStyle = '#b5152b'; ctx.fillRect( x, y + h - 80, w, 80 );
	ctx.fillStyle = '#1b2f63';
	ctx.beginPath(); ctx.moveTo( dx, dy - 34 ); ctx.lineTo( dx + 60, dy ); ctx.lineTo( dx, dy + 34 ); ctx.lineTo( dx - 60, dy ); ctx.closePath(); ctx.fill();
	ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
	ctx.fillStyle = '#ffffff'; ctx.font = `700 7px ${ SANS }`;
	ctx.fillText( 'HOME OF THE', dx, dy - 18 );
	ctx.fillStyle = '#e41b23'; ctx.font = `italic 700 17px ${ SCRIPT }`;
	ctx.fillText( 'Phillies', dx, dy - 4 );
	ctx.fillStyle = '#2f8a43'; ctx.fillRect( dx - 44, dy + 6, 88, 11 );
	ctx.fillStyle = '#ffffff'; ctx.font = `700 7px ${ SANS }`;
	ctx.fillText( 'Citizens Bank Park', dx, dy + 12 );
	ctx.fillText( 'EST. 2004', dx, dy + 24 );

}

// the white directional signs: pinstriped, navy caps, a red border and band
function wayfind( ctx, [ x, y, w, h ], lines ) {

	ctx.fillStyle = '#c8102e'; ctx.fillRect( x, y, w, h );
	ctx.fillStyle = '#f7f5ef'; ctx.fillRect( x + 8, y + 8, w - 16, h - 70 );
	ctx.fillStyle = 'rgba( 150, 150, 170, 0.18 )';
	for ( let px = x + 14; px < x + w - 8; px += 9 ) ctx.fillRect( px, y + 8, 1, h - 70 );
	ctx.fillStyle = '#1f2f6b'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
	const step = Math.min( 50, ( h - 110 ) / lines.length );
	lines.forEach( ( [ arrow, l ], i ) => {

		ctx.font = `700 30px ${ SANS }`; ctx.fillText( arrow, x + 16, y + 42 + i * step );
		ctx.font = `700 25px ${ NARROW }`; ctx.fillText( l, x + 52, y + 42 + i * step, w - 70 );

	} );
	ctx.fillStyle = '#ffffff';
	ctx.beginPath(); ctx.moveTo( x + w / 2, y + h - 56 ); ctx.lineTo( x + w / 2 + 34, y + h - 32 ); ctx.lineTo( x + w / 2, y + h - 8 ); ctx.lineTo( x + w / 2 - 34, y + h - 32 ); ctx.closePath(); ctx.fill();
	ctx.fillStyle = '#c8102e'; ctx.font = `italic 700 13px ${ SCRIPT }`; ctx.textAlign = 'center';
	ctx.fillText( 'Phillies', x + w / 2, y + h - 32 );

}

// The South Philadelphia Market's illustrated header, from the photos of the stands in 2008 and 2009
// (visitphilly Apr 2008; pvsbond Oct 2009, on this side): a gold-and-yellow checker border round a
// slate-blue panel; at the left a cream board under a Phillies pennant, "South Philly Italian Market" and a
// paragraph about Ninth Street; SOUTH PHILADELPHIA in tall condensed gold capitals edged dark; under it a
// sunburst behind the market's produce and a vendor in his red apron weighing something on a hanging
// scale; 9TH ST. MARKET in cream capitals; at the right a Coca-Cola cup, a hot dog with mustard, peanuts
// and a pretzel breaking out of the frame, peanuts and tomatoes at the bottom left
function marketHeader( ctx, [ x, y, w, h ] ) {

	// the checker border
	for ( let i = 0; i < w; i += 10 ) for ( const yy of [ y, y + h - 6 ] ) {

		ctx.fillStyle = ( i / 10 ) % 2 ? '#f2c94c' : '#c98a1c';
		ctx.fillRect( x + i, yy, 10, 6 );

	}

	for ( let j = 0; j < h; j += 10 ) for ( const xx of [ x, x + w - 6 ] ) {

		ctx.fillStyle = ( j / 10 ) % 2 ? '#f2c94c' : '#c98a1c';
		ctx.fillRect( xx, y + j, 6, 10 );

	}

	ctx.fillStyle = '#51647f'; ctx.fillRect( x + 6, y + 6, w - 12, h - 12 );
	// the cream board and its pennant
	ctx.fillStyle = '#efe7cf'; ctx.fillRect( x + 16, y + 20, 128, h - 34 );
	ctx.strokeStyle = '#2c2a26'; ctx.lineWidth = 2; ctx.strokeRect( x + 18, y + 22, 124, h - 38 );
	ctx.fillStyle = '#f7f3ea';
	ctx.beginPath(); ctx.moveTo( x + 30, y + 8 ); ctx.lineTo( x + 110, y + 12 ); ctx.lineTo( x + 30, y + 26 ); ctx.closePath(); ctx.fill();
	ctx.fillStyle = '#c8102e'; ctx.font = `italic 700 9px ${ SCRIPT }`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
	ctx.fillText( 'Phillies', x + 40, y + 16 );
	ctx.fillStyle = '#2c2a26'; ctx.textAlign = 'center';
	ctx.font = `700 10px ${ SERIF }`; ctx.fillText( 'South Philly Italian Market', x + 80, y + 36, 118 );
	ctx.fillStyle = 'rgba( 44, 42, 38, 0.6 )';
	for ( let i = 0; i < 8; i ++ ) ctx.fillRect( x + 26, y + 46 + i * 7, i === 7 ? 60 : 108, 2 );
	// the sunburst behind the produce and the vendor
	const cx = x + 440, cy = y + h - 22;
	ctx.save();
	ctx.beginPath(); ctx.rect( x + 250, y + 58, 400, h - 70 ); ctx.clip();
	for ( let i = 0; i < 22; i ++ ) {

		const a0 = Math.PI + i * Math.PI / 22, a1 = a0 + Math.PI / 44;
		ctx.fillStyle = i % 2 ? '#e8892c' : '#3a5a8c';
		ctx.beginPath(); ctx.moveTo( cx, cy ); ctx.lineTo( cx + Math.cos( a0 ) * 400, cy + Math.sin( a0 ) * 400 ); ctx.lineTo( cx + Math.cos( a1 ) * 400, cy + Math.sin( a1 ) * 400 ); ctx.closePath(); ctx.fill();

	}

	// the produce: crates of peppers, tomatoes, greens, carrots, squash in rows
	const veg = [ '#c7271e', '#e8a21c', '#3f8a2a', '#f06a1e', '#d9c255', '#8e1f1a', '#6aa52e' ];
	for ( let i = 0; i < 70; i ++ ) {

		ctx.fillStyle = veg[ i % veg.length ];
		ctx.beginPath(); ctx.ellipse( x + 262 + ( i * 37 ) % 250, y + h - 40 + ( i % 3 ) * 7, 7, 5, i, 0, Math.PI * 2 ); ctx.fill();

	}

	// the vendor: a checked shirt, the red apron, grey hair, the hanging scale
	const vx = x + 590;
	ctx.fillStyle = '#9fb4cf'; ctx.fillRect( vx - 22, y + 76, 44, 44 );
	ctx.fillStyle = '#b81e24'; ctx.fillRect( vx - 14, y + 86, 28, 34 );
	ctx.fillStyle = '#e0b08e'; ctx.beginPath(); ctx.ellipse( vx, y + 66, 11, 13, 0, 0, Math.PI * 2 ); ctx.fill();
	ctx.fillStyle = '#c9c6c0'; ctx.beginPath(); ctx.ellipse( vx, y + 57, 11, 6, 0, Math.PI, Math.PI * 2 ); ctx.fill();
	ctx.fillStyle = '#e9e5da'; ctx.beginPath(); ctx.arc( vx - 42, y + 64, 10, 0, Math.PI * 2 ); ctx.fill();
	ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo( vx - 42, y + 74 ); ctx.lineTo( vx - 42, y + 96 ); ctx.stroke();
	ctx.restore();
	// SOUTH PHILADELPHIA
	ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
	ctx.font = `700 46px "Rockwell", "Clarendon", ${ SERIF }`;
	ctx.save(); ctx.translate( x + 450, y + 34 ); ctx.scale( 0.72, 1 );
	ctx.lineWidth = 6; ctx.strokeStyle = '#3b2415'; ctx.strokeText( 'SOUTH PHILADELPHIA', 0, 0 );
	ctx.fillStyle = '#f2cf6a'; ctx.fillText( 'SOUTH PHILADELPHIA', 0, 0 );
	ctx.restore();
	// 9TH ST. MARKET
	ctx.font = `700 20px "Rockwell", ${ SERIF }`;
	ctx.lineWidth = 4; ctx.strokeStyle = '#2c2a26'; ctx.strokeText( '9TH ST. MARKET', x + 400, y + h - 16, 220 );
	ctx.fillStyle = '#efe7cf'; ctx.fillText( '9TH ST. MARKET', x + 400, y + h - 16, 220 );
	// the right: the Coca-Cola cup, a hot dog, peanuts, the pretzel over the frame
	const rx = x + w - 150;
	ctx.fillStyle = '#c21d24'; ctx.beginPath(); ctx.moveTo( rx + 40, y + 16 ); ctx.lineTo( rx + 76, y + 16 ); ctx.lineTo( rx + 71, y + 64 ); ctx.lineTo( rx + 45, y + 64 ); ctx.closePath(); ctx.fill();
	ctx.fillStyle = '#ffffff'; ctx.font = `italic 700 10px ${ SCRIPT }`; ctx.fillText( 'Coca-Cola', rx + 58, y + 40, 30 );
	ctx.fillStyle = '#e7c27a'; ctx.beginPath(); ctx.ellipse( rx + 45, y + 76, 34, 9, - 0.05, 0, Math.PI * 2 ); ctx.fill();
	ctx.fillStyle = '#a04a2a'; ctx.beginPath(); ctx.ellipse( rx + 45, y + 72, 32, 5, - 0.05, 0, Math.PI * 2 ); ctx.fill();
	ctx.strokeStyle = '#f2c230'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo( rx + 18, y + 70 ); for ( let i = 0; i < 10; i ++ ) ctx.lineTo( rx + 22 + i * 5.5, y + 69 + ( i % 2 ) * 3 ); ctx.stroke();
	for ( let i = 0; i < 14; i ++ ) {

		ctx.fillStyle = '#c99a5a'; ctx.beginPath(); ctx.ellipse( rx + 20 + ( i * 13 ) % 50, y + 92 + Math.floor( i / 4 ) * 6, 5, 3, i, 0, Math.PI * 2 ); ctx.fill();

	}

	ctx.strokeStyle = '#a8662b'; ctx.lineWidth = 6;
	ctx.beginPath(); ctx.ellipse( rx + 100, y + 92, 22, 16, 0, 0, Math.PI * 2 ); ctx.stroke();
	ctx.beginPath(); ctx.moveTo( rx + 86, y + 104 ); ctx.lineTo( rx + 110, y + 80 ); ctx.moveTo( rx + 114, y + 104 ); ctx.lineTo( rx + 90, y + 80 ); ctx.stroke();
	// peanuts and tomatoes over the frame at the bottom left
	for ( let i = 0; i < 6; i ++ ) {

		ctx.fillStyle = i % 3 === 2 ? '#c2241c' : '#c99a5a';
		ctx.beginPath(); ctx.ellipse( x + 20 + i * 20, y + h - 12, 11, 7, 0.3 * i, 0, Math.PI * 2 ); ctx.fill();

	}

}

// The Cobblestone Grill's blade sign (pvsbond Oct 2009, on this side): an oval medallion in a green-grey
// frame with a checker rim, a picture of Elfreth's Alley's houses in its top, COBBLESTONE GRILL in tall
// cream capitals on a maroon banner across it, "of Elfreth's Alley" in script, a cheesesteak, fries, a
// pepper, mushrooms and an onion at the bottom
function cobblestone( ctx, [ x, y, w, h ] ) {

	ctx.fillStyle = '#101010'; ctx.fillRect( x, y, w, h );
	const cx = x + w / 2, cy = y + h / 2;
	ctx.fillStyle = '#5d6a4f'; ctx.beginPath(); ctx.ellipse( cx, cy, w * 0.36, h * 0.47, 0, 0, Math.PI * 2 ); ctx.fill();
	for ( let i = 0; i < 24; i ++ ) {

		const a = i / 24 * Math.PI * 2;
		ctx.fillStyle = i % 2 ? '#cfc6a8' : '#5d6a4f';
		ctx.beginPath(); ctx.ellipse( cx + Math.cos( a ) * w * 0.33, cy + Math.sin( a ) * h * 0.43, 9, 9, 0, 0, Math.PI * 2 ); ctx.fill();

	}

	ctx.save();
	ctx.beginPath(); ctx.ellipse( cx, cy, w * 0.3, h * 0.39, 0, 0, Math.PI * 2 ); ctx.clip();
	// Elfreth's Alley: brick houses, shutters, a tree, the cobbles
	ctx.fillStyle = '#8a4a36'; ctx.fillRect( x, y, w, h * 0.5 );
	for ( let i = 0; i < 9; i ++ ) {

		ctx.fillStyle = i % 2 ? '#e9e3d0' : '#2d3f6e';
		ctx.fillRect( x + 60 + i * 32, y + 40 + ( i % 3 ) * 8, 14, 22 );

	}

	ctx.fillStyle = '#3d6b2a'; ctx.beginPath(); ctx.ellipse( cx - 70, y + 70, 30, 18, 0, 0, Math.PI * 2 ); ctx.fill();
	ctx.fillStyle = '#b8ad96'; ctx.fillRect( x, y + h * 0.42, w, h * 0.12 );
	// the food at the bottom
	ctx.fillStyle = '#6a3a1e'; ctx.beginPath(); ctx.ellipse( cx, y + h * 0.76, 70, 26, - 0.1, 0, Math.PI * 2 ); ctx.fill();
	ctx.fillStyle = '#e6c27c'; ctx.beginPath(); ctx.ellipse( cx, y + h * 0.8, 78, 18, - 0.1, 0, Math.PI ); ctx.fill();
	ctx.fillStyle = '#f0c24a'; for ( let i = 0; i < 12; i ++ ) ctx.fillRect( cx + 40 + ( i % 4 ) * 6, y + h * 0.62 + i * 3, 3, 18 );
	ctx.fillStyle = '#4c8a2a'; ctx.beginPath(); ctx.ellipse( cx - 95, y + h * 0.74, 22, 26, 0, 0, Math.PI * 2 ); ctx.fill();
	ctx.fillStyle = '#e8dcc2'; ctx.beginPath(); ctx.ellipse( cx - 60, y + h * 0.86, 12, 9, 0, 0, Math.PI * 2 ); ctx.fill();
	ctx.fillStyle = '#d9a25e'; ctx.beginPath(); ctx.ellipse( cx + 95, y + h * 0.72, 20, 20, 0, 0, Math.PI * 2 ); ctx.fill();
	ctx.fillStyle = '#b8201c'; ctx.beginPath(); ctx.ellipse( cx + 20, y + h * 0.9, 26, 8, 0.4, 0, Math.PI * 2 ); ctx.fill();
	ctx.restore();
	// the banner across
	ctx.fillStyle = '#6e1d22';
	ctx.beginPath(); ctx.moveTo( x + 8, y + h * 0.36 ); ctx.lineTo( x + w - 8, y + h * 0.3 ); ctx.lineTo( x + w - 8, y + h * 0.58 ); ctx.lineTo( x + 8, y + h * 0.64 ); ctx.closePath(); ctx.fill();
	ctx.strokeStyle = '#cfc6a8'; ctx.lineWidth = 3; ctx.stroke();
	ctx.fillStyle = '#f1e6c8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
	ctx.save(); ctx.translate( cx, y + h * 0.44 ); ctx.rotate( - 0.035 ); ctx.scale( 0.7, 1 );
	ctx.font = `700 50px "Rockwell", ${ SERIF }`; ctx.lineWidth = 4; ctx.strokeStyle = '#2a0e10';
	ctx.strokeText( 'COBBLESTONE GRILL', 0, 0 ); ctx.fillText( 'COBBLESTONE GRILL', 0, 0 );
	ctx.restore();
	ctx.fillStyle = '#efe4cc'; ctx.font = `italic 700 22px ${ SCRIPT }`;
	ctx.fillText( 'of Elfreth\'s Alley', cx + 10, y + h * 0.57 );

}

// a cart's sign: a panel lit from behind, the name and a line under it
function cartSign( ctx, [ x, y, w, h ], bg, fg, name, line, font = `800 58px ${ SANS }` ) {

	ctx.fillStyle = bg; ctx.fillRect( x, y, w, h );
	ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
	ctx.font = font; ctx.fillText( name, x + w / 2, y + h * 0.42, w - 30 );
	ctx.font = `700 20px ${ SANS }`; ctx.fillText( line, x + w / 2, y + h * 0.82, w - 30 );

}

export function drawPrints() {

	return canvasTexture( ATLAS[ 0 ], ATLAS[ 1 ], ( ctx ) => {

		ctx.fillStyle = '#101010';
		ctx.fillRect( 0, 0, ATLAS[ 0 ], ATLAS[ 1 ] );
		// ---- the players' banners on this side (the 2008 roster's stars; Utley and Howard over the First
		// Base Gate's way in, as Rollins and Feliz hang over the Third Base Gate's)
		banner( ctx, CELLS.utley, 'CHASE UTLEY', 'lefty', '26', '#e0ab88', 5 );
		banner( ctx, CELLS.howard, 'RYAN HOWARD', 'lefty', '6', '#7a4a30', 23 );
		banner( ctx, CELLS.hamels, 'COLE HAMELS', 'pitchL', '35', '#e3b08e', 41 );
		banner( ctx, CELLS.victorino, 'SHANE VICTORINO', 'swing', '8', '#b98563', 59 );
		banner( ctx, CELLS.werth, 'JAYSON WERTH', 'field', '28', '#e0ab88', 77 );
		banner( ctx, CELLS.myers, 'BRETT MYERS', 'pitch', '39', '#e3b08e', 95 );
		pole( ctx, CELLS.pole6, '6', 'lefty', '#7a4a30', 13 );
		pole( ctx, CELLS.pole8, '8', 'bat', '#b98563', 31 );
		pole( ctx, CELLS.pole28, '28', 'swing', '#e0ab88', 49 );
		pole( ctx, CELLS.pole54, '54', 'pitch', '#6b412c', 67 );
		pole( ctx, CELLS.pole11, '11', 'bat', '#8a5a3c', 85 );
		// ---- the directional signs: behind 108-109 (as the 2010 photo there has it), and at the First Base
		// Gate's way in, facing the turnstiles
		wayfind( ctx, CELLS.wayRF, [ [ '↑', 'SECTIONS 101 - 108' ], [ '↗', 'RAMP TO ALL LEVELS' ], [ '↓', 'ADVANCE TICKETS' ], [ '↓', 'GUEST SERVICES' ], [ '↓', 'FIRST BASE GATE' ], [ '↓', 'FIRST AID' ] ] );
		wayfind( ctx, CELLS.wayGate, [ [ '←', 'SECTIONS 101 - 114' ], [ '→', 'SECTIONS 115 - 133' ], [ '↗', 'ESCALATOR' ], [ '→', 'GUEST SERVICES' ], [ '←', 'FIRST AID' ], [ '→', 'THIRD BASE GATE' ], [ '←', 'PHANATIC PHUN ZONE' ] ] );
		marketHeader( ctx, CELLS.market );
		cobblestone( ctx, CELLS.cobblestone );
		// ---- the program kiosk's panels: white, the script, PROGRAMS in red (Getty 83600062, 25 Oct 2008)
		{

			const [ x, y, w, h ] = CELLS.programs;
			ctx.fillStyle = '#f5f3ee'; ctx.fillRect( x, y, w, h );
			ctx.strokeStyle = '#b5152b'; ctx.lineWidth = 8; ctx.strokeRect( x + 4, y + 4, w - 8, h - 8 );
			ctx.fillStyle = '#b5152b'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
			ctx.font = `italic 700 44px ${ SCRIPT }`; ctx.fillText( 'Phillies', x + 120, y + h / 2 + 2 );
			ctx.font = `800 52px ${ SANS }`; ctx.fillText( 'PROGRAMS', x + 340, y + h / 2 + 2, 290 );

		}

		// ---- a hand-lettered sign taped over the water ice cart's: on a 47-degree night the water ice is
		// "scaled back" (the Inquirer, 29 Oct) and the cart sells hot chocolate
		{

			const [ x, y, w, h ] = CELLS.cocoaSign;
			ctx.fillStyle = '#f4f1e6'; ctx.fillRect( x, y, w, h );
			ctx.fillStyle = 'rgba( 200, 190, 150, 0.6 )'; ctx.fillRect( x + 90, y, 70, 18 ); ctx.fillRect( x + 96, y + h - 16, 64, 16 );
			ctx.fillStyle = '#1c2e7a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
			ctx.font = `700 34px "Marker Felt", "Comic Sans MS", ${ SANS }`;
			ctx.save(); ctx.translate( x + w / 2, y + 66 ); ctx.rotate( - 0.05 );
			ctx.fillText( 'HOT', 0, - 20 ); ctx.fillText( 'CHOCOLATE', 0, 18, w - 20 );
			ctx.restore();
			ctx.fillStyle = '#b01d24'; ctx.font = `700 40px "Marker Felt", "Comic Sans MS", ${ SANS }`; ctx.fillText( '$3.00', x + w / 2, y + 140 );

		}

		// ---- the carts' signs
		cartSign( ctx, CELLS.hatfieldCart, '#ad1119', '#ffffff', 'HATFIELD', 'HOT DOGS  ·  SAUSAGE  ·  BRATS', `italic 800 60px ${ SERIF }` );
		{

			const [ x, y, w, h ] = CELLS.phood;
			ctx.fillStyle = '#1f8a3c'; ctx.fillRect( x, y, w, h );
			ctx.fillStyle = '#f6d23e'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
			ctx.font = `800 44px "Cooper Black", ${ SERIF }`; ctx.fillText( 'PHANATIC PHOOD', x + w / 2, y + 50, w - 40 );
			ctx.fillStyle = '#ffffff'; ctx.font = `700 19px ${ SANS }`; ctx.fillText( 'KIDS\' MEALS  ·  HOT DOGS  ·  JUICE', x + w / 2, y + 100, w - 40 );

		}

		cartSign( ctx, CELLS.draft, '#0f2a5c', '#f2c14e', 'COLD BEER', 'DRAFT  ·  21 OZ  ·  MUST BE 21, ID REQUIRED' );
		cartSign( ctx, CELLS.bottles, '#3b2314', '#f2c14e', 'BOTTLED BEER', 'LOCAL  ·  DOMESTIC  ·  IMPORT' );
		// ---- the caricaturist's samples: Utley and Howard big-headed, a kid, a couple, in marker on board
		{

			const [ x, y, w, h ] = CELLS.caricatures;
			ctx.fillStyle = '#e9e5da'; ctx.fillRect( x, y, w, h );
			const face = ( fx, fy, s, skin, cap, grin ) => {

				ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse( fx, fy, 50 * s, 58 * s, 0, 0, Math.PI * 2 ); ctx.fill();
				ctx.strokeStyle = '#222'; ctx.lineWidth = 3 * s; ctx.stroke();
				if ( cap ) {

					ctx.fillStyle = '#c8102e'; ctx.beginPath(); ctx.ellipse( fx, fy - 30 * s, 54 * s, 34 * s, 0, Math.PI, Math.PI * 2 ); ctx.fill(); ctx.fillRect( fx - 10 * s, fy - 34 * s, 70 * s, 9 * s );
					ctx.fillStyle = '#fff'; ctx.font = `italic 700 ${ 26 * s }px ${ SCRIPT }`; ctx.textAlign = 'center'; ctx.fillText( 'P', fx, fy - 42 * s );

				}

				ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse( fx - 17 * s, fy - 5 * s, 11 * s, 13 * s, 0, 0, Math.PI * 2 ); ctx.ellipse( fx + 17 * s, fy - 5 * s, 11 * s, 13 * s, 0, 0, Math.PI * 2 ); ctx.fill();
				ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc( fx - 15 * s, fy - 3 * s, 5 * s, 0, Math.PI * 2 ); ctx.arc( fx + 19 * s, fy - 3 * s, 5 * s, 0, Math.PI * 2 ); ctx.fill();
				ctx.strokeStyle = '#222'; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.arc( fx, fy + 18 * s, grin * s, 0.15, Math.PI - 0.15 ); ctx.stroke();

			};

			face( x + 120, y + 130, 1.3, '#f0c3a0', true, 28 );
			face( x + 360, y + 130, 1.3, '#8a5a3c', true, 32 );
			face( x + 110, y + 300, 0.9, '#f3cfb0', false, 18 );
			face( x + 250, y + 300, 0.9, '#e6b894', false, 20 );
			face( x + 400, y + 300, 0.9, '#c28c68', true, 22 );
			ctx.fillStyle = '#1b2a57'; ctx.font = `700 22px ${ SANS }`; ctx.textAlign = 'center';
			ctx.fillText( 'CARICATURES  $15  ·  COLOR $20', x + w / 2, y + h - 18, w - 20 );

		}

		// ---- a blank sketch pad on the easel, a few lines on it
		{

			const [ x, y, w, h ] = CELLS.sketch;
			ctx.fillStyle = '#f2efe8'; ctx.fillRect( x, y, w, h );
			ctx.strokeStyle = '#222'; ctx.lineWidth = 3;
			ctx.beginPath(); ctx.ellipse( x + w / 2, y + 140, 72, 88, 0, 0, Math.PI * 2 ); ctx.stroke();
			ctx.beginPath(); ctx.arc( x + w / 2 - 26, y + 128, 12, 0, Math.PI * 2 ); ctx.arc( x + w / 2 + 26, y + 128, 12, 0, Math.PI * 2 ); ctx.stroke();
			ctx.beginPath(); ctx.arc( x + w / 2, y + 170, 30, 0.2, Math.PI - 0.2 ); ctx.stroke();
			ctx.beginPath(); ctx.moveTo( x + 60, y + 230 ); ctx.lineTo( x + 30, y + 310 ); ctx.moveTo( x + w - 60, y + 230 ); ctx.lineTo( x + w - 30, y + 310 ); ctx.stroke();

		}

		// ---- WILL CALL at the ticket windows by the gate, the World Series merchandise kiosk
		cartSign( ctx, CELLS.willCall, '#13294f', '#ffffff', 'WILL CALL', 'PICK UP  ·  PHOTO I.D. AND CREDIT CARD REQUIRED' );
		{

			const [ x, y, w, h ] = CELLS.wsMerch;
			ctx.fillStyle = '#0f1f45'; ctx.fillRect( x, y, w, h );
			ctx.fillStyle = '#c9a45a'; ctx.fillRect( x, y + h - 10, w, 10 );
			ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
			ctx.font = `800 40px ${ SANS }`; ctx.fillText( 'WORLD SERIES 2008', x + w / 2, y + 44, w - 30 );
			ctx.fillStyle = '#e8c872'; ctx.font = `700 20px ${ SANS }`; ctx.fillText( 'OFFICIAL COLLECTORS\' MERCHANDISE', x + w / 2, y + 90, w - 30 );

		}

		// ---- the Phanatic Phun Zone's arch (Flickr krachel 2008, 2009): a white band edged in blue and green,
		// PHANATIC and PHUN ZONE in red outlined in blue, his medallion in the middle (the Phanatic in a
		// green-rimmed oval); and the Inquirer's black board over it, white Old English letters
		{

			const [ x, y, w, h ] = CELLS.phunZone;
			ctx.fillStyle = '#101010'; ctx.fillRect( x, y, w, h );
			ctx.fillStyle = '#f4f2ea'; ctx.fillRect( x, y + 20, w, h - 40 );
			ctx.fillStyle = '#2a58a8'; ctx.fillRect( x, y + 20, w, 10 ); ctx.fillRect( x, y + h - 30, w, 10 );
			ctx.fillStyle = '#3a9a4a'; ctx.fillRect( x, y + h - 20, w, 6 ); ctx.fillRect( x, y + 14, w, 6 );
			ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
			ctx.font = `800 58px ${ SANS }`;
			ctx.lineWidth = 7; ctx.strokeStyle = '#2a58a8';
			for ( const [ t, cx ] of [ [ 'PHANATIC', x + 170 ], [ 'PHUN ZONE', x + w - 175 ] ] ) {

				ctx.strokeText( t, cx, y + h / 2, 300 );
				ctx.fillStyle = '#d7263d'; ctx.fillText( t, cx, y + h / 2, 300 );

			}

			const mx = x + w / 2, my = y + h / 2;
			ctx.fillStyle = '#2f8f3c'; ctx.beginPath(); ctx.ellipse( mx, my, 72, 76, 0, 0, Math.PI * 2 ); ctx.fill();
			ctx.fillStyle = '#f7f5ee'; ctx.beginPath(); ctx.ellipse( mx, my, 60, 64, 0, 0, Math.PI * 2 ); ctx.fill();
			ctx.fillStyle = '#3aa845'; ctx.beginPath(); ctx.ellipse( mx - 6, my + 12, 30, 40, 0, 0, Math.PI * 2 ); ctx.fill();
			ctx.beginPath(); ctx.ellipse( mx + 16, my - 16, 22, 18, 0, 0, Math.PI * 2 ); ctx.fill();
			ctx.fillStyle = '#d7263d'; ctx.beginPath(); ctx.ellipse( mx + 42, my - 12, 14, 7, 0.2, 0, Math.PI * 2 ); ctx.fill();
			ctx.fillStyle = '#c8102e'; ctx.fillRect( mx - 4, my - 42, 30, 10 );
			ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc( mx + 12, my - 24, 7, 0, Math.PI * 2 ); ctx.arc( mx + 24, my - 24, 7, 0, Math.PI * 2 ); ctx.fill();
			ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc( mx + 13, my - 23, 3, 0, Math.PI * 2 ); ctx.arc( mx + 25, my - 23, 3, 0, Math.PI * 2 ); ctx.fill();

		}

		{

			const [ x, y, w, h ] = CELLS.inquirer;
			ctx.fillStyle = '#141414'; ctx.fillRect( x, y, w, h );
			ctx.strokeStyle = '#d8d8d8'; ctx.lineWidth = 3; ctx.strokeRect( x + 6, y + 6, w - 12, h - 12 );
			ctx.fillStyle = '#f2f2f2'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
			ctx.font = `400 64px "Old English Text MT", "UnifrakturMaguntia", "Luminari", "Apple Chancery", ${ SERIF }`;
			ctx.fillText( 'The Philadelphia Inquirer', x + w / 2, y + h / 2 + 4, w - 40 );

		}

	}, 'concourse1bPrints' );

}

// ---------------------------------------------------------------- building

function atlasUV( k, u, v ) {

	const [ x, y, w, h ] = CELLS[ k ];
	return [ 100 + ( x + u * w ) / ATLAS[ 0 ], 100 + ( y + v * h ) / ATLAS[ 1 ] ];

}

// the atlas's lit cells, for the shader: a list of [ u0, v0, u1, v1 ]
const litRects = LIT.map( ( k ) => {

	const [ x, y, w, h ] = CELLS[ k ];
	return [ x / ATLAS[ 0 ], y / ATLAS[ 1 ], ( x + w ) / ATLAS[ 0 ], ( y + h ) / ATLAS[ 1 ] ];

} );

function printsMaterial( atlas ) {

	const mat = standard( {
		name: 'concourse1b-prints', roughness: 0.5, modules: [ commonModule ], textures: { c1bAtlas: atlas },
		surface: /* wgsl */`
	var alb = array<vec3f, ${ PALETTE.length }>( ${ PALETTE.map( ( p ) => f3( p[ 1 ] ) ).join( ', ' ) } );
	var rm = array<vec2f, ${ PALETTE.length }>( ${ PALETTE.map( ( p ) => `vec2f( ${ p[ 2 ].toFixed( 2 ) }, ${ p[ 3 ].toFixed( 2 ) } )` ).join( ', ' ) } );
	var glo = array<vec3f, ${ PALETTE.length }>( ${ PALETTE.map( ( p ) => f3( p[ 4 ] || [ 0, 0, 0 ] ) ).join( ', ' ) } );
	let nk = smoothstep( 0.1, 0.7, frame.night );
	if ( in.uv.x >= 99.0 ) {
		let uv = in.uv - vec2f( 100.0 );
		let t = textureSample( c1bAtlas, smpAnisoClamp, uv ).rgb;
		s.albedo = t * 0.8;
		s.roughness = 0.55;
		// the carts' and kiosks' signs are lit from behind; the rest by the spots in the trusses
		var lit = 0.0;
		${ litRects.map( ( [ a, b, c, d ] ) => `lit = max( lit, step( ${ a.toFixed( 4 ) }, uv.x ) * step( uv.x, ${ c.toFixed( 4 ) } ) * step( ${ b.toFixed( 4 ) }, uv.y ) * step( uv.y, ${ d.toFixed( 4 ) } ) );` ).join( '\n\t\t' ) }
		s.emissive = t * mix( mix( 0.05, 0.3, nk ), mix( 0.3, 0.8, nk ), lit );
	} else {
		let k = min( u32( max( in.uv.x, 0.0 ) ), ${ PALETTE.length - 1 }u );
		s.albedo = alb[ k ];
		s.roughness = rm[ k ].x;
		s.metalness = rm[ k ].y;
		s.emissive = glo[ k ] * mix( 0.6, 1.6, nk );
		s.albedo *= 1.0 - 0.1 * mx_noise_float3( in.P * 9.0 ) * 0.5;
	}
`,
	} );
	mat.underwaterLighting = 'none';
	mat.setDefine( 'DRY', 1 );
	return mat;

}

// The builder: things placed in a frame on the floor (Kit.frame's: P( x, y, z ) is right x, up y, forward
// z; P.dir the same for directions)
export class Prints {

	constructor() {

		this.pos = []; this.nrm = []; this.uv = [];
		this.k = 0;
		this.atlas = drawPrints();
		this.material = printsMaterial( this.atlas );

	}

	use( name ) {

		this.k = PAL[ name ];
		return this;

	}

	tri( a, b, c, na, nb, nc, ua, ub, uc ) {

		const e1 = [ b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ], b[ 2 ] - a[ 2 ] ], e2 = [ c[ 0 ] - a[ 0 ], c[ 1 ] - a[ 1 ], c[ 2 ] - a[ 2 ] ];
		const cx = e1[ 1 ] * e2[ 2 ] - e1[ 2 ] * e2[ 1 ], cy = e1[ 2 ] * e2[ 0 ] - e1[ 0 ] * e2[ 2 ], cz = e1[ 0 ] * e2[ 1 ] - e1[ 1 ] * e2[ 0 ];
		const n = [ na[ 0 ] + nb[ 0 ] + nc[ 0 ], na[ 1 ] + nb[ 1 ] + nc[ 1 ], na[ 2 ] + nb[ 2 ] + nc[ 2 ] ];
		if ( cx * n[ 0 ] + cy * n[ 1 ] + cz * n[ 2 ] < 0 ) {

			[ b, c ] = [ c, b ]; [ nb, nc ] = [ nc, nb ]; [ ub, uc ] = [ uc, ub ];

		}

		const pal = [ this.k + 0.5, 0.5 ];
		this.pos.push( ...a, ...b, ...c );
		for ( const nn of [ na, nb, nc ] ) {

			const l = Math.hypot( ...nn ) || 1;
			this.nrm.push( nn[ 0 ] / l, nn[ 1 ] / l, nn[ 2 ] / l );

		}

		this.uv.push( ...( ua || pal ), ...( ub || pal ), ...( uc || pal ) );

	}

	quad( a, b, c, d, n, uv = null ) {

		this.tri( a, b, c, n, n, n, uv?.[ 0 ], uv?.[ 1 ], uv?.[ 2 ] );
		this.tri( a, c, d, n, n, n, uv?.[ 0 ], uv?.[ 2 ], uv?.[ 3 ] );

	}

	// a box: centre ( x, y, z ), sizes along right, up, forward; `print` on its forward face (and `back` on
	// the other)
	box( P, x, y, z, sx, sy, sz, print = null, back = null ) {

		const c = ( i, j, k ) => P( x + i * sx / 2, y + j * sy / 2, z + k * sz / 2 );
		const F = P.dir( 0, 0, 1 ), R = P.dir( 1, 0, 0 );
		const cell = ( k ) => k ? [ atlasUV( k, 0, 1 ), atlasUV( k, 1, 1 ), atlasUV( k, 1, 0 ), atlasUV( k, 0, 0 ) ] : null;
		this.quad( c( - 1, - 1, 1 ), c( 1, - 1, 1 ), c( 1, 1, 1 ), c( - 1, 1, 1 ), F, cell( print ) );
		this.quad( c( 1, - 1, - 1 ), c( - 1, - 1, - 1 ), c( - 1, 1, - 1 ), c( 1, 1, - 1 ), F.map( ( v ) => - v ), cell( back ) );
		this.quad( c( 1, - 1, 1 ), c( 1, - 1, - 1 ), c( 1, 1, - 1 ), c( 1, 1, 1 ), R );
		this.quad( c( - 1, - 1, - 1 ), c( - 1, - 1, 1 ), c( - 1, 1, 1 ), c( - 1, 1, - 1 ), R.map( ( v ) => - v ) );
		this.quad( c( - 1, 1, 1 ), c( 1, 1, 1 ), c( 1, 1, - 1 ), c( - 1, 1, - 1 ), [ 0, 1, 0 ] );
		this.quad( c( - 1, - 1, - 1 ), c( 1, - 1, - 1 ), c( 1, - 1, 1 ), c( - 1, - 1, 1 ), [ 0, - 1, 0 ] );

	}

	// an upright cylinder (a frustum): axis at ( x, z ), y0 to y1, radii r0 and r1, n sides; `arc` limits it
	// to [ a0, a1 ] radians (a curved counter's front)
	cyl( P, x, z, y0, y1, r0, r1, n = 12, { top = true, arc = null } = {} ) {

		const [ a0, a1 ] = arc || [ 0, Math.PI * 2 ];
		const ring = ( y, r, k ) => {

			const t = a0 + ( a1 - a0 ) * k / n;
			return [ P( x + Math.cos( t ) * r, y, z + Math.sin( t ) * r ), P.dir( Math.cos( t ), ( r0 - r1 ) / ( y1 - y0 ), Math.sin( t ) ) ];

		};

		for ( let k = 0; k < n; k ++ ) {

			const [ a, na ] = ring( y0, r0, k ), [ b, nb ] = ring( y0, r0, k + 1 ), [ c, nc ] = ring( y1, r1, k + 1 ), [ d, nd ] = ring( y1, r1, k );
			this.tri( a, b, c, na, nb, nc );
			this.tri( a, c, d, na, nc, nd );
			if ( top ) this.tri( P( x, y1, z ), d, c, [ 0, 1, 0 ], [ 0, 1, 0 ], [ 0, 1, 0 ] );

		}

	}

	// a printed sheet, both faces reading the right way round, facing +z (and -z); `sag` droops its middle
	sheet( P, x, y, z, w, h, print, sag = 0 ) {

		const n = sag ? 6 : 1;
		for ( let i = 0; i < n; i ++ ) {

			const u0 = i / n, u1 = ( i + 1 ) / n;
			const x0 = x - w / 2 + w * u0, x1 = x - w / 2 + w * u1;
			const d0 = sag * Math.sin( u0 * Math.PI ), d1 = sag * Math.sin( u1 * Math.PI );
			this.quad( P( x0, y - h / 2 - d0, z ), P( x1, y - h / 2 - d1, z ), P( x1, y + h / 2 - d1, z ), P( x0, y + h / 2 - d0, z ), P.dir( 0, 0, 1 ),
				[ atlasUV( print, u0, 1 ), atlasUV( print, u1, 1 ), atlasUV( print, u1, 0 ), atlasUV( print, u0, 0 ) ] );
			this.quad( P( x1, y - h / 2 - d1, z - 0.005 ), P( x0, y - h / 2 - d0, z - 0.005 ), P( x0, y + h / 2 - d0, z - 0.005 ), P( x1, y + h / 2 - d1, z - 0.005 ), P.dir( 0, 0, - 1 ),
				[ atlasUV( print, 1 - u1, 1 ), atlasUV( print, 1 - u0, 1 ), atlasUV( print, 1 - u0, 0 ), atlasUV( print, 1 - u1, 0 ) ] );

		}

	}

	// one face only, facing +z
	panel( P, x, y, z, w, h, print ) {

		this.quad( P( x - w / 2, y - h / 2, z ), P( x + w / 2, y - h / 2, z ), P( x + w / 2, y + h / 2, z ), P( x - w / 2, y + h / 2, z ), P.dir( 0, 0, 1 ),
			[ atlasUV( print, 0, 1 ), atlasUV( print, 1, 1 ), atlasUV( print, 1, 0 ), atlasUV( print, 0, 0 ) ] );

	}

	mesh( name = 'concourse1b-prints' ) {

		const g = new BufferGeometry();
		g.setAttribute( 'position', new Float32BufferAttribute( this.pos, 3 ) );
		g.setAttribute( 'normal', new Float32BufferAttribute( this.nrm, 3 ) );
		g.setAttribute( 'uv', new Float32BufferAttribute( this.uv, 2 ) );
		g.computeBoundingBox();
		g.computeBoundingSphere();
		const m = new Mesh( g, this.material );
		m.name = name;
		m.castShadow = false;
		m.receiveShadow = true;
		return m;

	}

}

export { STREET };
