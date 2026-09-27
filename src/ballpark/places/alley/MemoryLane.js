import { Mesh, SphereGeometry, Color, Vector3 } from '../../../engine/index.js';
import { standard } from '../../../materials/Materials.js';
import { Quads } from '../../Stands.js';
import { canvasTexture, beam } from '../../geo.js';
import { LEVELS } from '../../layout.js';
import { TOP, HAT, PANTS } from './Folk.js';

// Memory Lane's viewing platform and the Phillies Wall of Fame, over the west end of the visitors' pen
// (the 2008 photos, the research in docs/notes/worlds/W3.md): a platform a storey below the Alley looking
// down on the visitors' mound, its front a dark green parapet over the pen with the teal "Pitching Secrets
// of the Phillies" plaques along it (a bronze ball in each, held in the grip); behind it the Wall of Fame
// facing the field, black plaques with bronze relief busts and gold capitals on red brick under a tan
// cast-stone cap - two rows, 30 Phillies and the wide Centennial Team plaque of 1983 - the cap the Alley's
// parapet above. Closed from half an hour before the first pitch to the last out (Wikipedia, "Ashburn
// Alley"; baseballparks.com): a chain across its stair, an usher at it, another down on the platform.

const STREET = LEVELS.mainConcourse;

// the Wall of Fame as it stood in October 2008 (the order after the June 2008 panorama: the top row from
// Vukovich to Ashburn, the bottom from the Centennial Team plaque and Magee to Roberts; Juan Samuel,
// inducted August 8, 2008, at its end). [ name, what he was, Phillies years ]. Some of the members and the
// order between the ends are my best reconstruction (the notes say which).
const TOP_ROW = [
	[ 'JOHN VUKOVICH', 'INFIELDER • COACH', '1970-71, 1976-81' ], [ 'BOB BOONE', 'CATCHER', '1972-1981' ], [ 'DICK ALLEN', 'INFIELDER', '1963-69, 1975-76' ],
	[ 'TONY TAYLOR', 'SECOND BASEMAN', '1960-71, 1974-76' ], [ 'GARRY MADDOX', 'OUTFIELDER', '1975-1986' ], [ 'TUG McGRAW', 'PITCHER', '1975-1984' ],
	[ 'DALLAS GREEN', 'MANAGER', '1979-1981' ], [ 'GREG LUZINSKI', 'OUTFIELDER', '1970-1980' ], [ 'LARRY BOWA', 'SHORTSTOP', '1970-1981' ],
	[ 'MIKE SCHMIDT', 'THIRD BASEMAN', '1972-1989' ], [ 'STEVE CARLTON', 'PITCHER', '1972-1986' ], [ 'GRANNY HAMNER', 'INFIELDER', '1944-1959' ],
	[ 'CY WILLIAMS', 'OUTFIELDER', '1918-1930' ], [ 'JIM BUNNING', 'PITCHER', '1964-67, 1970-71' ], [ 'CHUCK KLEIN', 'OUTFIELDER', '1928-33, 1936-44' ],
	[ 'RICHIE ASHBURN', 'CENTER FIELDER', '1948-1959' ],
];
const BOTTOM_ROW = [
	[ 'SHERRY MAGEE', 'OUTFIELDER', '1904-1914' ], [ 'BILLY HAMILTON', 'OUTFIELDER', '1890-1895' ], [ 'HARRY KALAS', 'BROADCASTER', '1971-' ],
	[ 'BY SAAM', 'BROADCASTER', '1939-1975' ], [ 'JOHNNY CALLISON', 'OUTFIELDER', '1960-1969' ], [ 'CURT SIMMONS', 'PITCHER', '1947-50, 1952-60' ],
	[ 'CHRIS SHORT', 'PITCHER', '1959-1972' ], [ 'PAUL OWENS', 'GM • MANAGER', '1955-2003' ], [ 'ED DELAHANTY', 'OUTFIELDER', '1888-89, 1891-1901' ],
	[ 'SAM THOMPSON', 'OUTFIELDER', '1889-1898' ], [ 'DEL ENNIS', 'OUTFIELDER', '1946-1956' ], [ 'GROVER C. ALEXANDER', 'PITCHER', '1911-17, 1930' ],
	[ 'ROBIN ROBERTS', 'PITCHER', '1948-1961' ], [ 'JUAN SAMUEL', 'SECOND BASEMAN', '1983-1989' ],
];
const SECRETS = [
	[ 'THE FASTBALL', 'Across the seams, fingertips on top: Robin Roberts' ],
	[ 'THE CURVEBALL', 'Middle finger along the seam, snap it down' ],
	[ 'THE SLIDER', 'Off-center grip, a little wrist: Steve Carlton' ],
	[ 'THE SCREWBALL', 'Turned over the other way: Tug McGraw' ],
	[ 'THE CHANGE-UP', 'Deep in the palm, three fingers, same arm speed' ],
];

// the atlas: 8 x 4 cells of 160 x 224 (the plaques; the Centennial Team two cells wide at the end), then
// a strip below for the five teal Pitching Secrets plaques and the AREA CLOSED sign
const CW = 160, CH = 224;
function drawPlaque( ctx, x, y, w, h, [ name, what, years ], seed ) {

	ctx.save();
	ctx.translate( x, y );
	ctx.fillStyle = '#121110'; ctx.fillRect( 2, 2, w - 4, h - 4 );
	// the beaded border and the corner bosses
	ctx.fillStyle = '#9a7a3e';
	for ( let i = 8; i < w - 6; i += 6 ) for ( const yy of [ 7, h - 7 ] ) {

		ctx.beginPath(); ctx.arc( i, yy, 1.6, 0, Math.PI * 2 ); ctx.fill();

	}

	for ( let j = 8; j < h - 6; j += 6 ) for ( const xx of [ 7, w - 7 ] ) {

		ctx.beginPath(); ctx.arc( xx, j, 1.6, 0, Math.PI * 2 ); ctx.fill();

	}

	for ( const [ bx, by ] of [ [ 14, 14 ], [ w - 14, 14 ], [ 14, h - 14 ], [ w - 14, h - 14 ] ] ) {

		const g = ctx.createRadialGradient( bx - 1, by - 1, 0, bx, by, 5 );
		g.addColorStop( 0, '#f0d890' ); g.addColorStop( 1, '#6a4f22' );
		ctx.fillStyle = g; ctx.beginPath(); ctx.arc( bx, by, 5, 0, Math.PI * 2 ); ctx.fill();

	}

	// the relief bust: a cap, a face turned a little, the shoulders, lit from the upper left
	const cx = w / 2, cy = h * 0.27;
	const bronze = ( a, b ) => {

		const g = ctx.createLinearGradient( cx - 26, cy - 30, cx + 26, cy + 30 );
		g.addColorStop( 0, a ); g.addColorStop( 1, b );
		return g;

	};

	ctx.fillStyle = bronze( '#c9a15a', '#5a3f1c' );
	ctx.beginPath(); ctx.ellipse( cx, cy + 34, 34, 14, 0, Math.PI, 0 ); ctx.fill();
	ctx.beginPath(); ctx.ellipse( cx + ( seed - 0.5 ) * 4, cy + 4, 16, 21, 0, 0, Math.PI * 2 ); ctx.fill();
	ctx.fillStyle = bronze( '#e0bd70', '#6b4c22' );
	ctx.beginPath(); ctx.ellipse( cx + ( seed - 0.5 ) * 4, cy - 12, 17, 9, 0, Math.PI, 0 ); ctx.fill();
	ctx.fillRect( cx - 2 + ( seed - 0.5 ) * 4, cy - 13, 20, 4 );
	ctx.fillStyle = 'rgba( 40, 25, 10, 0.55 )';
	ctx.fillRect( cx - 8, cy + 1, 5, 2 ); ctx.fillRect( cx + 4, cy + 1, 5, 2 );
	ctx.fillRect( cx - 5, cy + 13, 11, 2 );
	// the words in raised gold capitals
	ctx.fillStyle = '#d9b862';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.font = `700 ${ name.length > 14 ? 11 : 13 }px Georgia, "Times New Roman", serif`;
	ctx.fillText( name, cx, h * 0.54, w - 22 );
	ctx.font = 'italic 600 9px Georgia, serif';
	ctx.fillText( what, cx, h * 0.6, w - 22 );
	ctx.fillText( 'PHILLIES ' + years, cx, h * 0.65, w - 22 );
	// the career in small type: lines of gold
	ctx.fillStyle = 'rgba( 200, 165, 90, 0.75 )';
	for ( let l = 0; l < 9; l ++ ) ctx.fillRect( 18, h * 0.7 + l * 5.2, w - 36 - ( l === 8 ? 40 : ( ( l * 13 + name.length ) % 3 ) * 6 ), 1.8 );
	ctx.restore();

}

function drawAtlas( ctx, w, h ) {

	ctx.fillStyle = '#121110'; ctx.fillRect( 0, 0, w, h );
	const all = [ ...TOP_ROW, ...BOTTOM_ROW ];
	all.forEach( ( p, i ) => drawPlaque( ctx, ( i % 8 ) * CW, Math.floor( i / 8 ) * CH, CW, CH, p, ( i * 0.618 ) % 1 ) );
	// the Centennial Team, 1983: the wide plaque, two cells at the end of the last row
	{

		const x = 6 * CW, y = 3 * CH, pw = 2 * CW, ph = CH;
		ctx.fillStyle = '#121110'; ctx.fillRect( x + 2, y + 2, pw - 4, ph - 4 );
		ctx.strokeStyle = '#9a7a3e'; ctx.lineWidth = 3; ctx.strokeRect( x + 7, y + 7, pw - 14, ph - 14 );
		ctx.fillStyle = '#d9b862'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
		ctx.font = '700 24px Georgia, serif'; ctx.fillText( 'Phillies Centennial Team', x + pw / 2, y + 30 );
		ctx.font = '9px Georgia, serif';
		ctx.fillText( 'In 1983 the Phillies conducted balloting for the Greatest Phillies Team ever.', x + pw / 2, y + 54, pw - 24 );
		ctx.fillText( 'Mike Schmidt collected 19,767 votes to be named Greatest Phillies Player.', x + pw / 2, y + 66, pw - 24 );
		ctx.textAlign = 'left'; ctx.font = '10px Georgia, serif';
		const L = [ 'Pete Rose (1b)', 'Manny Trillo (2b)', 'Mike Schmidt (3b)', 'Larry Bowa (ss)' ];
		const M = [ 'Robin Roberts (starting rhp)', 'Steve Carlton (starting lhp)', 'Jim Konstanty (rh reliever)', 'Tug McGraw (lh reliever)', 'Dallas Green (manager)' ];
		const R = [ 'Bob Boone (c)', 'Richie Ashburn (of)', 'Garry Maddox (of)', 'Del Ennis (of)' ];
		L.forEach( ( t, i ) => ctx.fillText( t, x + 16, y + 92 + i * 16 ) );
		M.forEach( ( t, i ) => ctx.fillText( t, x + 112, y + 92 + i * 16 ) );
		R.forEach( ( t, i ) => ctx.fillText( t, x + 232, y + 92 + i * 16, 80 ) );

	}

	// the Pitching Secrets plaques: teal, the title, the grip drawn on a ball
	SECRETS.forEach( ( [ title, line ], i ) => {

		const x = i * 256, y = 4 * CH, pw = 256, ph = 160;
		ctx.fillStyle = '#1b6e6c'; ctx.fillRect( x + 2, y + 2, pw - 4, ph - 4 );
		ctx.strokeStyle = '#d8c690'; ctx.lineWidth = 3; ctx.strokeRect( x + 8, y + 8, pw - 16, ph - 16 );
		ctx.fillStyle = '#f2ecd6'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
		ctx.font = '700 11px "Helvetica Neue", Arial, sans-serif'; ctx.fillText( 'PITCHING SECRETS OF THE PHILLIES', x + pw / 2, y + 22 );
		ctx.font = '800 22px Georgia, serif'; ctx.fillText( title, x + pw / 2, y + 48 );
		ctx.font = 'italic 11px Georgia, serif'; ctx.fillText( line, x + pw / 2, y + 138, pw - 24 );
		// the grip: a ball with its seams and the fingers
		const bx = x + pw / 2, by = y + 92;
		ctx.fillStyle = '#efe9da'; ctx.beginPath(); ctx.arc( bx, by, 26, 0, Math.PI * 2 ); ctx.fill();
		ctx.strokeStyle = '#b2222a'; ctx.lineWidth = 2;
		ctx.beginPath(); ctx.arc( bx - 30, by, 26, - 0.9, 0.9 ); ctx.stroke();
		ctx.beginPath(); ctx.arc( bx + 30, by, 26, Math.PI - 0.9, Math.PI + 0.9 ); ctx.stroke();
		ctx.fillStyle = '#c99a72';
		for ( const k of [ - 1, 1 ] ) {

			ctx.save(); ctx.translate( bx + k * 7 + ( i - 2 ) * 2, by - 6 ); ctx.rotate( ( i - 2 ) * 0.25 );
			ctx.beginPath(); ctx.ellipse( 0, - 14, 5, 18, 0, 0, Math.PI * 2 ); ctx.fill();
			ctx.restore();

		}

	} );
	// the sign on the chain
	{

		const x = 5 * 256, y = 4 * CH;
		ctx.fillStyle = '#f4f1ea'; ctx.fillRect( x + 4, y + 20, 248, 110 );
		ctx.fillStyle = '#c8102e'; ctx.fillRect( x + 4, y + 20, 248, 30 );
		ctx.fillStyle = '#ffffff'; ctx.font = '800 20px "Helvetica Neue", Arial, sans-serif'; ctx.textAlign = 'center';
		ctx.fillText( 'AREA CLOSED', x + 128, y + 36 );
		ctx.fillStyle = '#1a1a1a'; ctx.font = '700 15px "Helvetica Neue", Arial, sans-serif';
		ctx.fillText( 'DURING THE GAME', x + 128, y + 72 );
		ctx.font = '12px "Helvetica Neue", Arial, sans-serif';
		ctx.fillText( 'Reopens after the final out', x + 128, y + 100 );

	}

}

export class MemoryLane {

	// frame: Field.penFrame; folk: the Alley's people (adds the ushers)
	constructor( { parent, frame, folk, colliders, field } ) {

		const F = frame;
		const yP = STREET - 1.9, s0 = F.S0 - 0.4, s1 = F.west, tWall = F.TB, tFront = F.TB - 2.4;
		this.F = F;
		this.yP = yP;
		const P3 = ( s, t, y ) => {

			const [ x, z ] = F.at( s, t );
			return [ x, y, z ];

		};

		// an oriented box in the pen's frame (a Quads, a uv of metres along s and up for the brick)
		const obox = ( q, sa, sb, ta, tb, ya, yb ) => {

			const C = ( s, t, y ) => P3( s, t, y );
			const faces = [
				[ C( sa, ta, ya ), C( sb, ta, ya ), C( sb, ta, yb ), C( sa, ta, yb ), [ - F.nx, 0, - F.nz ] ],
				[ C( sb, tb, ya ), C( sa, tb, ya ), C( sa, tb, yb ), C( sb, tb, yb ), [ F.nx, 0, F.nz ] ],
				[ C( sa, tb, ya ), C( sa, ta, ya ), C( sa, ta, yb ), C( sa, tb, yb ), [ - F.ux, 0, - F.uz ] ],
				[ C( sb, ta, ya ), C( sb, tb, ya ), C( sb, tb, yb ), C( sb, ta, yb ), [ F.ux, 0, F.uz ] ],
				[ C( sa, ta, yb ), C( sb, ta, yb ), C( sb, tb, yb ), C( sa, tb, yb ), [ 0, 1, 0 ] ],
			];
			for ( const [ a, b, c, d, n ] of faces ) q.add( a, b, c, d, n, sa, sb );

		};

		const green = standard( { name: 'ml-platform-green', color: new Color( 0.011, 0.05, 0.03 ), roughness: 0.75 } );
		const stone = standard( { name: 'ml-cast-stone', color: new Color( 0.55, 0.47, 0.36 ), roughness: 0.75 } );
		const concrete = standard( { name: 'ml-platform-floor', color: new Color( 0.3, 0.29, 0.27 ), roughness: 0.8 } );
		const brick = standard( {
			name: 'ml-wall-of-fame-brick', color: new Color( 0.36, 0.1, 0.065 ), roughness: 0.85,
			surface: /* wgsl */`
	// modular brick, running bond: u metres along the wall, v up (from the world's y)
	let u = in.uv.x; let v = in.P.y;
	let row = floor( v / 0.0667 );
	let bu = u / 0.203 + 0.5 * ( row % 2.0 );
	let fr = clamp( fwidth( v ) / 0.0667 * 1.5 - 0.25, 0.0, 1.0 );
	let fb = clamp( fwidth( bu ) * 1.5 - 0.25, 0.0, 1.0 );
	let mortar = clamp( mix( step( 0.86, fract( v / 0.0667 ) ), 0.14, fr ) + mix( step( 0.94, fract( bu ) ), 0.06, max( fb, fr ) ), 0.0, 1.0 );
	let tone = mix( 0.85 + 0.3 * fract( sin( dot( vec2f( floor( bu ), row ), vec2f( 12.9898, 78.233 ) ) ) * 43758.5453 ), 0.98, max( fr, fb ) );
	s.albedo = mix( mat.color * tone, vec3f( 0.52, 0.47, 0.4 ), mortar * 0.8 );
	s.emissive = s.albedo * smoothstep( 0.2, 0.8, frame.night ) * 0.12;
` } );
		for ( const m of [ green, stone, concrete, brick ] ) m.underwaterLighting = 'none';
		const gq = new Quads(), sq = new Quads(), cq = new Quads(), bq = new Quads();
		// the platform: its floor, its front parapet over the pen (and the green below it down to the pen's
		// floor), its west end
		obox( cq, s0 + 0.4, s1, tFront, tWall, yP - 0.3, yP );
		obox( gq, s0 + 0.4, s1, tFront - 0.25, tFront, F.R - 0.02, yP + 1.05 );
		obox( sq, s0 + 0.35, s1 + 0.05, tFront - 0.3, tFront + 0.05, yP + 1.05, yP + 1.12 );
		obox( gq, s0, s0 + 0.4, tFront - 0.25, tWall, F.R + 1.35, yP + 1.05 );
		// the Wall of Fame: the brick face from the platform up to the Alley's parapet, the parapet, its cap
		{

			const a = P3( s0, tWall - 0.01, yP ), b = P3( s1, tWall - 0.01, yP ), c = P3( s1, tWall - 0.01, STREET + 1.0 ), d = P3( s0, tWall - 0.01, STREET + 1.0 );
			bq.add( a, b, c, d, [ - F.nx, 0, - F.nz ], 0, s1 - s0 );
			obox( bq, s0, s1, tWall, tWall + 0.4, STREET - 0.02, STREET + 1.0 );
			obox( sq, s0 - 0.05, s1 + 0.05, tWall - 0.08, tWall + 0.48, STREET + 1.0, STREET + 1.1 );

		}

		// the stair down from the Alley's deck (at the platform's east end), 11 treads, a pipe rail
		const rq = new Quads();
		{

			const n = 11, run = 0.3, rise = ( STREET - yP ) / n, tA = tFront + 0.05, tB = tWall - 1.25;
			for ( let k = 1; k <= n; k ++ ) obox( cq, s1 - k * run, s1 - ( k - 1 ) * run, tA, tB, yP, STREET - ( k - 1 ) * rise );
			beam( rq, P3( s1, tB + 0.05, STREET + 0.95 ), P3( s1 - n * run, tB + 0.05, yP + 0.95 ), 0.045 );
			for ( const k of [ 0, 5, 11 ] ) beam( rq, P3( s1 - k * run, tB + 0.05, STREET - k * rise ), P3( s1 - k * run, tB + 0.05, STREET - k * rise + 0.95 ), 0.045 );

		}

		// the plaques: two rows on the brick, 22 in on centre, 15 x 21 in; the Centennial plaque wide
		const tex = canvasTexture( 8 * CW, 4 * CH + 160, drawAtlas, 'wallOfFame' );
		const H = 4 * CH + 160, Wt = 8 * CW;
		const pq = new Quads();
		const plaque = ( sa, sb, ya, yb, cell, cells = 1, uvRect = null ) => {

			const cx = cell % 8, cy = Math.floor( cell / 8 );
			const [ u0, v0, u1, v1 ] = uvRect || [ cx * CW / Wt, cy * CH / H, ( cx + cells ) * CW / Wt, ( cy + 1 ) * CH / H ];
			const t = tWall - 0.045;
			// seen from the field, +s runs to the viewer's right
			const A = P3( sa, t, ya ), B = P3( sb, t, ya ), C = P3( sb, t, yb ), D = P3( sa, t, yb );
			const n = [ - F.nx, 0, - F.nz ];
			pq.tri( A, B, C, n, [ u0, v1 ], [ u1, v1 ], [ u1, v0 ] );
			pq.tri( A, C, D, n, [ u0, v1 ], [ u1, v0 ], [ u0, v0 ] );
			// its edge off the brick
			obox( gq, sa - 0.01, sb + 0.01, t + 0.006, tWall - 0.012, ya - 0.01, yb + 0.01 );

		};

		const pw = 0.38, ph = 0.53, pitch = 0.56;
		const yTop = yP + 1.62, yBot = yP + 0.95;
		const start = s0 + 0.3;
		TOP_ROW.forEach( ( p, i ) => plaque( start + i * pitch, start + i * pitch + pw, yTop, yTop + ph, i ) );
		// the bottom row: the Centennial Team plaque first, then the rest
		plaque( start, start + 0.94, yBot, yBot + ph, 30, 2 );
		BOTTOM_ROW.forEach( ( p, i ) => {

			const s = start + 1.12 + i * pitch;
			plaque( s, s + pw, yBot, yBot + ph, 16 + i );

		} );
		// the teal Pitching Secrets plaques on the parapet, tilted up to read
		const secret = ( s, i ) => {

			const t = tFront - 0.12, u0 = i * 256 / Wt, u1 = ( i + 1 ) * 256 / Wt, v0 = 4 * CH / H, v1 = ( 4 * CH + 160 ) / H;
			const A = P3( s - 0.3, t - 0.1, yP + 1.22 ), B = P3( s + 0.3, t - 0.1, yP + 1.22 ), C = P3( s + 0.3, t + 0.25, yP + 1.42 ), D = P3( s - 0.3, t + 0.25, yP + 1.42 );
			const n = [ F.nx * 0.5, 0.86, F.nz * 0.5 ];
			pq.tri( A, B, C, n, [ u1, v1 ], [ u0, v1 ], [ u0, v0 ] );
			pq.tri( A, C, D, n, [ u1, v1 ], [ u0, v0 ], [ u1, v0 ] );
			// the lectern under it, and the bronze ball set in it
			obox( gq, s - 0.28, s + 0.28, t - 0.08, t + 0.22, yP + 1.05, yP + 1.2 );
			this.balls.push( P3( s, t + 0.07, yP + 1.36 ) );

		};

		this.balls = [];
		SECRETS.forEach( ( _, i ) => secret( s0 + 1.4 + i * 1.3, i ) );
		// the sign on the chain at the stair's head
		{

			const s = s1 + 0.02, tm = ( tFront + tWall - 1.25 ) / 2;
			const u0 = 5 * 256 / Wt, u1 = 6 * 256 / Wt, v0 = ( 4 * CH + 18 ) / H, v1 = ( 4 * CH + 132 ) / H;
			const A = P3( s + 0.02, tm - 0.3, STREET + 0.45 ), B = P3( s + 0.02, tm + 0.3, STREET + 0.45 ), C = P3( s + 0.02, tm + 0.3, STREET + 0.72 ), D = P3( s + 0.02, tm - 0.3, STREET + 0.72 );
			const n = [ F.ux, 0, F.uz ];
			pq.tri( A, B, C, n, [ u0, v1 ], [ u1, v1 ], [ u1, v0 ] );
			pq.tri( A, C, D, n, [ u0, v1 ], [ u1, v0 ], [ u0, v0 ] );

		}

		// lamps on the cap over the plaques: black goosenecks, lit after dark
		const lq = new Quads();
		for ( let s = s0 + 0.9; s < s1 - 0.5; s += 1.8 ) {

			beam( rq, P3( s, tWall - 0.05, STREET + 1.1 ), P3( s, tWall - 0.4, STREET + 1.25 ), 0.03 );
			const h = P3( s, tWall - 0.45, STREET + 1.2 );
			lq.add( [ h[ 0 ] - 0.12, h[ 1 ], h[ 2 ] - 0.08 ], [ h[ 0 ] + 0.12, h[ 1 ], h[ 2 ] - 0.08 ], [ h[ 0 ] + 0.12, h[ 1 ], h[ 2 ] + 0.08 ], [ h[ 0 ] - 0.12, h[ 1 ], h[ 2 ] + 0.08 ], [ 0, - 1, 0 ] );

		}

		const plaqueMat = standard( { name: 'wall-of-fame-plaques', roughness: 0.35, metalness: 0.75, textures: { bpWoF: tex },
			surface: /* wgsl */`
	let t = textureSample( bpWoF, smpAnisoClamp, in.uv ).rgb;
	// bronze where it's raised (bright), a black patina between
	let raised = smoothstep( 0.12, 0.35, max( t.r, max( t.g, t.b ) ) );
	s.albedo = t;
	s.metalness = mix( 0.2, 0.9, raised );
	s.roughness = mix( 0.6, 0.3, raised );
	s.emissive = t * smoothstep( 0.2, 0.8, frame.night ) * 0.35;
` } );
		const railMat = standard( { name: 'ml-rails', color: new Color( 0.03, 0.03, 0.03 ), roughness: 0.5, metalness: 0.5 } );
		const lampMat = standard( { name: 'ml-lamps', color: new Color( 0.03, 0.03, 0.03 ), roughness: 0.5,
			surface: 's.emissive = vec3f( 1.0, 0.85, 0.6 ) * mix( 0.2, 4.0, smoothstep( 0.1, 0.7, frame.night ) );' } );
		const bronzeMat = standard( { name: 'ml-grip-balls', color: new Color( 0.45, 0.3, 0.12 ), roughness: 0.3, metalness: 0.9 } );
		for ( const m of [ plaqueMat, railMat, lampMat, bronzeMat ] ) m.underwaterLighting = 'none';
		for ( const [ q, m, name ] of [ [ gq, green, 'ml-green' ], [ sq, stone, 'ml-cast-stone' ], [ cq, concrete, 'ml-concrete' ], [ bq, brick, 'wall-of-fame-brick' ], [ pq, plaqueMat, 'wall-of-fame-plaques' ], [ rq, railMat, 'ml-rails' ], [ lq, lampMat, 'ml-lamps' ] ] ) {

			const mesh = new Mesh( q.geometry(), m );
			mesh.name = name;
			mesh.castShadow = m !== plaqueMat && m !== lampMat;
			mesh.receiveShadow = true;
			parent.add( mesh );

		}

		const ball = new SphereGeometry( 0.037, 10, 8 );
		for ( const b of this.balls ) {

			const m = new Mesh( ball, bronzeMat );
			m.position.set( b[ 0 ], b[ 1 ], b[ 2 ] );
			parent.add( m );

		}

		// the platform's floor (walkable) and its parapet (solid)
		if ( colliders && field ) {

			const add = ( sa, sb, ta, tb, ya, yb, o ) => {

				const [ x, z ] = F.at( ( sa + sb ) / 2, ( ta + tb ) / 2 ), w = field.toWorld( x, z );
				colliders.addBox( new Vector3( w.x, field.y0 + ( ya + yb ) / 2, w.z ), new Vector3( ( sb - sa ) / 2, ( yb - ya ) / 2, ( tb - ta ) / 2 ), field.group.rotation.y + F.yaw, o );

			};

			add( s0 + 0.4, s1, tFront, tWall, yP - 0.3, yP, { tag: 'memory-lane-platform', walkable: true } );
			add( s0 + 0.4, s1, tFront - 0.25, tFront, yP, yP + 1.05, { tag: 'memory-lane-parapet', solid: true } );

		}

		// the ushers: one at the chain on the Alley side, one down on the platform watching the pen
		this.ushers = [];
		const [ cx, cz ] = F.at( s1 + 0.7, ( tFront + tWall - 1.25 ) / 2 );
		const faceAlley = Math.atan2( - F.ux, - F.uz );
		this.ushers.push( folk.add( 'pockets', { x: cx, y: STREET, z: cz, yaw: faceAlley, look: { top: TOP.usher, hat: HAT.cap, pants: PANTS.khaki, glasses: true, mustache: true }, nights: 3 } ) );
		const [ px, pz ] = F.at( s0 + 3.0, tFront + 0.55 );
		this.ushers.push( folk.add( 'lean', { x: px, y: yP, z: pz, yaw: Math.atan2( F.nx, F.nz ), look: { top: TOP.usher, hat: HAT.cap, pants: PANTS.khaki, woman: true }, nights: 3 } ) );

	}

	update( dt, w, now ) {

		// the one at the chain turns someone away now and then (the hand out: the lean pair's point)
		this.ushers[ 0 ].k = Math.sin( now * 0.4 ) > 0.8 ? 0.8 : 0;
		// the other leans on the parapet watching the man warming up below
		this.ushers[ 1 ].k = 0.05;

	}

}
