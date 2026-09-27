import { Mesh, Group, Color } from '../../../engine/index.js';
import { standard } from '../../../materials/Materials.js';
import { commonModule } from '../../../engine/render/wgsl/common.js';
import { Quads } from '../../Stands.js';
import { Kit } from './Kit.js';
import { STREET } from './Frame.js';

// Harry the K's Broadcast Bar & Grille, built out (LeftField.js). Landmarks put up its brick house under the
// scoreboard and a flat strip of lit glass on the patio; this opens the house and puts the two bars in it:
//
//   upstairs, on the Scoreboard Porch's level: the glass front of the bar room onto the patio (Harry's
//     Upstairs), the bar along the back wall under its TVs, the back bar's bottles lit, the taps, stools,
//     high-tops at the windows, the photographs, the Kalas plaque and the pennants, the menu board; out on
//     the patio high-tops, stools and patio heaters, the rail over the porch; and the walkway behind the
//     porch's top row that joins them (where Landmarks' patio stopped short of the porch)
//   downstairs, at the back of the field level's 140s: the lower level's bar in the house's ground storey,
//     open to the covered concourse, its fascia and its TVs; the dining tables in front of it under the
//     porch, fenced by a low rail with the host stand at its gap, looking out over the 140s to the field
//     (Phillies.com's 'view from Harry's lower level', 2007); the hanging sign with its LOWER LEVEL / UPPER
//     LEVEL arrows (BaseballParks.com, 2004)
//
// Everything is built in the board's frame (Frame.js). It returns where the people go (LeftField's cast).

// the house (Landmarks.harrys): x from XL to XR, its face at FZ, 9 m deep
export function buildHarrys( place, F, H ) {

	const out = { spots: {} };
	const XL = - 2 - H.HW / 2, XR = - 2 + H.HW / 2, FZ = H.FZ, ZB = FZ + 9, TOP = H.y0 - 0.9;
	const PY = H.patio, GY = H.gy1;
	// the openings: upstairs the full glass front (as Landmarks had it), downstairs the bar's front
	const UP = { x0: XL + 0.5, x1: XR - 0.5, y0: PY, y1: GY };
	const DN = { x0: - 15.0, x1: 11.0, y0: STREET, y1: STREET + 3.3 };
	out.UP = UP; out.DN = DN;
	Object.assign( out, { XL, XR, FZ, ZB, PY, GY, TOP } );
	const hg = new Group();
	hg.name = 'harrys';
	place.group.add( hg );

	// ---- the house, opened: its brick faces with the two openings in the front, a reveal round each
	const q = new Quads();
	const P = ( x, y, z ) => {

		const [ fx, fz ] = F.field( x, z );
		return [ fx, y, fz ];

	};
	const D = ( x, z ) => {

		const [ dx, dz ] = F.dir( x, z );
		return [ dx, 0, dz ];

	};
	const face = ( x0, x1, y0, y1, z ) => {

		if ( x1 - x0 < 0.01 || y1 - y0 < 0.01 ) return;
		q.add( P( x0, y0, z ), P( x1, y0, z ), P( x1, y1, z ), P( x0, y1, z ), D( 0, - 1 ) );

	};
	face( XL, DN.x0, STREET, DN.y1, FZ );
	face( DN.x1, XR, STREET, DN.y1, FZ );
	face( XL, XR, DN.y1, UP.y0, FZ );
	face( XL, UP.x0, UP.y0, UP.y1, FZ );
	face( UP.x1, XR, UP.y0, UP.y1, FZ );
	face( XL, XR, UP.y1, TOP, FZ );
	// the back, the ends and the top
	q.add( P( XR, STREET, ZB ), P( XL, STREET, ZB ), P( XL, TOP, ZB ), P( XR, TOP, ZB ), D( 0, 1 ) );
	q.add( P( XL, STREET, FZ ), P( XL, STREET, ZB ), P( XL, TOP, ZB ), P( XL, TOP, FZ ), D( - 1, 0 ) );
	q.add( P( XR, STREET, ZB ), P( XR, STREET, FZ ), P( XR, TOP, FZ ), P( XR, TOP, ZB ), D( 1, 0 ) );
	q.add( P( XL, TOP, FZ ), P( XR, TOP, FZ ), P( XR, TOP, ZB ), P( XL, TOP, ZB ), [ 0, 1, 0 ] );
	// the reveals: the wall's thickness round each opening
	const T = 0.35;
	for ( const O of [ UP, DN ] ) {

		q.add( P( O.x0, O.y1, FZ ), P( O.x1, O.y1, FZ ), P( O.x1, O.y1, FZ + T ), P( O.x0, O.y1, FZ + T ), [ 0, - 1, 0 ] );
		q.add( P( O.x0, O.y0, FZ + T ), P( O.x0, O.y0, FZ ), P( O.x0, O.y1, FZ ), P( O.x0, O.y1, FZ + T ), D( 1, 0 ) );
		q.add( P( O.x1, O.y0, FZ ), P( O.x1, O.y0, FZ + T ), P( O.x1, O.y1, FZ + T ), P( O.x1, O.y1, FZ ), D( - 1, 0 ) );

	}

	const house = new Mesh( q.geometry(), H.brick );
	house.name = 'harrys-house';
	house.castShadow = true;
	house.receiveShadow = true;
	hg.add( house );

	// ---- the rooms: walls, floors and ceilings (one material: panelled wood, tile, carpet, the dark
	// ceiling with its cans of light, told apart by uv.x as in the Kit)
	const room = new Quads();
	const RQ = ( kind, a, b, c, d, n ) => {

		// uv.x the kind, uv.y a length for the pattern
		room.tri( a, b, c, n, [ kind, 0 ], [ kind, 1 ], [ kind, 1 ] );
		room.tri( a, c, d, n, [ kind, 0 ], [ kind, 1 ], [ kind, 0 ] );

	};
	const box = ( kind, x0, x1, y0, y1, z0, z1 ) => {

		// the inside of a box: its floor (kind 0), ceiling (2), walls (1)
		RQ( 0, P( x0, y0, z0 ), P( x1, y0, z0 ), P( x1, y0, z1 ), P( x0, y0, z1 ), [ 0, 1, 0 ] );
		RQ( 2, P( x0, y1, z1 ), P( x1, y1, z1 ), P( x1, y1, z0 ), P( x0, y1, z0 ), [ 0, - 1, 0 ] );
		RQ( kind, P( x1, y0, z1 ), P( x0, y0, z1 ), P( x0, y1, z1 ), P( x1, y1, z1 ), D( 0, - 1 ) );
		RQ( kind, P( x0, y0, z1 ), P( x0, y0, z0 ), P( x0, y1, z0 ), P( x0, y1, z1 ), D( 1, 0 ) );
		RQ( kind, P( x1, y0, z0 ), P( x1, y0, z1 ), P( x1, y1, z1 ), P( x1, y1, z0 ), D( - 1, 0 ) );
		// the inside of the front wall, above and beside the opening
		RQ( kind, P( x0, y0, z0 ), P( x1, y0, z0 ), P( x1, y1, z0 ), P( x0, y1, z0 ), D( 0, 1 ) );

	};
	// upstairs: 8.4 m deep, the ceiling at 3.5 m
	const UR = { x0: UP.x0, x1: UP.x1, y0: PY, y1: PY + 3.5, z0: FZ + T, z1: FZ + T + 8.1 };
	box( 1, UR.x0, UR.x1, UR.y0, UR.y1, UR.z0, UR.z1 );
	// downstairs: the bar and the kitchen's pass, 5 m deep
	const DR = { x0: DN.x0, x1: DN.x1, y0: STREET, y1: DN.y1 + 0.2, z0: FZ + T, z1: FZ + T + 5 };
	box( 3, DR.x0, DR.x1, DR.y0, DR.y1, DR.z0, DR.z1 );
	out.UR = UR; out.DR = DR;
	const roomMat = standard( {
		name: 'harrys-room', roughness: 0.6, modules: [ commonModule ],
		surface: /* wgsl */`
	let kind = floor( in.uv.x + 0.5 );
	let nk = smoothstep( 0.1, 0.7, frame.night );
	if ( kind < 0.5 ) {
		// the floor: dark tile, grouted, a runner of light off the bar
		let g = abs( fract( in.P.xz / 0.6 ) - 0.5 );
		s.albedo = mix( vec3f( 0.05, 0.038, 0.03 ), vec3f( 0.1, 0.09, 0.08 ), step( 0.47, max( g.x, g.y ) ) );
		s.roughness = 0.28;
	} else if ( kind < 1.5 || kind > 2.5 ) {
		// the walls: stained wood panels below a chair rail, a deep red above (upstairs; the world's y is the
		// field's less the street's height)
		let fy = in.P.y + ${ STREET.toFixed( 3 ) };
		let v = fract( ( in.P.x + in.P.z ) / 0.6 );
		var wood = vec3f( 0.085, 0.036, 0.018 ) * ( 0.85 + 0.3 * mx_noise_float2( vec2f( ( in.P.x + in.P.z ) * 1.7, fy * 9.0 ) ) );
		wood *= 1.0 - 0.5 * step( 0.96, v );
		let h = fy - select( ${ STREET.toFixed( 2 ) }, ${ PY.toFixed( 2 ) }, fy > ${ ( PY - 1 ).toFixed( 2 ) } );
		s.albedo = select( select( vec3f( 0.16, 0.03, 0.028 ), wood, h < 1.1 ), wood, kind > 2.5 );
		s.albedo = select( s.albedo, vec3f( 0.02, 0.01, 0.005 ), abs( h - 1.1 ) < 0.04 );
		s.roughness = 0.5;
		// the warm wash of the lamps along the top of the walls
		s.emissive = s.albedo * ( 0.6 + 0.8 * nk ) * smoothstep( 1.6, 3.2, h ) * 0.8;
	} else {
		// the ceiling: dark, with cans of light every 1.8 m
		let g = fract( in.P.xz / 1.8 ) - 0.5;
		let can = 1.0 - smoothstep( 0.05, 0.08, length( g ) );
		s.albedo = vec3f( 0.025 );
		s.emissive = vec3f( 1.0, 0.8, 0.55 ) * can * ( 2.0 + 2.0 * nk );
	}
`,
	} );
	roomMat.underwaterLighting = 'none';
	roomMat.setDefine( 'DRY', 1 );
	const rooms = new Mesh( room.geometry(), roomMat );
	rooms.name = 'harrys-rooms';
	rooms.receiveShadow = true;
	hg.add( rooms );

	// ---- the things in and round it (one draw: the Kit)
	const K = new Kit();
	const Pk = K.frame( F );
	out.kit = K;

	// -- upstairs: the bar along the back wall, the back bar lit, the taps, the TVs over it
	const barZ = UR.z1 - 2.0, barX0 = - 11, barX1 = 7;
	K.use( 'mahogany' ).box( Pk, ( barX0 + barX1 ) / 2, PY + 0.52, barZ, barX1 - barX0, 1.04, 0.62 );
	K.use( 'mahogany' ).box( Pk, ( barX0 + barX1 ) / 2, PY + 1.07, barZ - 0.06, barX1 - barX0 + 0.1, 0.06, 0.78 );
	K.use( 'brass' ).box( Pk, ( barX0 + barX1 ) / 2, PY + 0.2, barZ - 0.42, barX1 - barX0, 0.05, 0.05 );
	// the back bar: counter, the lit shelves of bottles, the taps along the bar top
	K.use( 'mahogany' ).box( Pk, ( barX0 + barX1 ) / 2, PY + 0.45, UR.z1 - 0.3, barX1 - barX0 + 1, 0.9, 0.5 );
	K.panel( Pk, ( barX0 + barX1 ) / 2, PY + 1.55, UR.z1 - 0.04, barX1 - barX0 + 1, 1.25, 'backbar' );
	for ( let k = 0; k < 8; k ++ ) {

		const tx = barX0 + 1.5 + k * ( barX1 - barX0 - 3 ) / 7;
		K.use( 'chrome' ).cyl( Pk, tx, barZ + 0.12, PY + 1.1, PY + 1.42, 0.035, 0.035, 8 );
		K.use( [ 'red', 'navy', 'cream', 'green', 'black' ][ k % 5 ] ).box( Pk, tx, PY + 1.52, barZ + 0.12, 0.05, 0.2, 0.05 );

	}

	// stools along the bar (the people sit on some)
	out.spots.barUp = [];
	for ( let x = barX0 + 0.6; x <= barX1 - 0.6; x += 0.72 ) {

		stool( K, Pk, x, barZ - 0.85, PY, 0.76 );
		out.spots.barUp.push( { x, z: barZ - 0.85, y: PY, seat: 0.76 } );

	}

	// the bartenders' side
	out.spots.bartendUp = [ { x: barX0 + 3, z: barZ + 0.75, y: PY }, { x: barX1 - 4, z: barZ + 0.75, y: PY } ];
	// the TVs over the back bar, and one at each end of the room (the broadcast, as the concourse's)
	out.tvs = [];
	for ( let k = 0; k < 4; k ++ ) out.tvs.push( { x: barX0 + 1.8 + k * ( barX1 - barX0 - 3.6 ) / 3, y: PY + 2.75, z: UR.z1 - 0.1, w: 1.2, h: 0.68, face: - 1 } );
	out.tvs.push( { x: UR.x0 + 0.08, y: PY + 2.6, z: ( UR.z0 + UR.z1 ) / 2, w: 1.2, h: 0.68, face: 'x+' } );
	out.tvs.push( { x: UR.x1 - 0.08, y: PY + 2.6, z: ( UR.z0 + UR.z1 ) / 2, w: 1.2, h: 0.68, face: 'x-' } );
	// the walls: photographs, the plaque, the pennants, the menu, the specials
	const sideWall = ( xw, dir, z, y, w, h, cell ) => {

		// a panel on a side wall facing into the room (dir +1: facing +x)
		const a = Pk( xw, y - h / 2, z + dir * w / 2 ), right = Pk.dir( 0, 0, - dir ), up = [ 0, 1, 0 ];
		K.panelAt( a, right, up, w, h, Pk.dir( dir, 0, 0 ), cell );

	};
	for ( let i = 0; i < 3; i ++ ) sideWall( UR.x0 + 0.03, 1, UR.z0 + 1.2 + i * 1.1, PY + 1.75, 0.62, 0.9, 'photo' + i );
	for ( let i = 0; i < 3; i ++ ) sideWall( UR.x1 - 0.03, - 1, UR.z0 + 1.2 + i * 1.1, PY + 1.75, 0.62, 0.9, 'photo' + ( i + 3 ) );
	sideWall( UR.x1 - 0.03, - 1, UR.z1 - 1.1, PY + 1.7, 1.4, 1.05, 'menuUp' );
	sideWall( UR.x0 + 0.03, 1, UR.z1 - 1.0, PY + 1.6, 1.1, 0.55, 'specials' );
	K.panel( Pk, ( barX0 + barX1 ) / 2, PY + 3.3, UR.z1 - 0.04, 8, 0.3, 'pennants' );
	K.panel( Pk, barX1 + 2.2, PY + 1.7, UR.z1 - 0.04, 1.6, 0.4, 'plaque' );
	// pendant lamps over the bar
	for ( let x = barX0 + 0.5; x <= barX1; x += 2 ) {

		K.use( 'black' ).box( Pk, x, PY + 3.1, barZ, 0.02, 0.8, 0.02 );
		K.use( 'lamp' ).cyl( Pk, x, barZ, PY + 2.52, PY + 2.7, 0.18, 0.06, 10, { top: true, bottom: true } );

	}

	// high-tops at the windows, a few four-tops in the middle
	out.spots.tablesUp = [];
	for ( let x = UR.x0 + 1.6; x < UR.x1 - 1; x += 3.1 ) {

		hightop( K, Pk, x, UR.z0 + 0.9, PY );
		out.spots.tablesUp.push( { x, z: UR.z0 + 0.9, y: PY, n: 2 } );

	}

	for ( const x of [ - 13.5, - 9.5, 4, 8.5 ] ) {

		fourTop( K, Pk, x, UR.z0 + 3.3, PY );
		out.spots.tablesUp.push( { x, z: UR.z0 + 3.3, y: PY, n: 4, low: true } );

	}

	// the beer signs hung in the windows, facing out
	for ( const [ x, cell, w ] of [ [ - 15.5, 'neonBud', 1.3 ], [ - 6.4, 'neonYuengling', 1.2 ], [ 3.8, 'neonMiller', 1.2 ], [ 12.4, 'neonBud', 1.3 ] ] ) K.panel( Pk, x, GY - 0.55, FZ + 0.2, w, w * ( cell === 'neonMiller' ? 0.25 : 0.375 ), cell );

	// -- the glass: mullions (bronze) every 2.7 m and a transom bar
	const nM = Math.round( ( UP.x1 - UP.x0 ) / 2.7 );
	for ( let k = 0; k <= nM; k ++ ) {

		const x = UP.x0 + ( UP.x1 - UP.x0 ) * k / nM;
		K.use( 'iron' ).box( Pk, x, ( UP.y0 + UP.y1 ) / 2, FZ + 0.12, 0.08, UP.y1 - UP.y0, 0.1 );

	}

	K.use( 'iron' ).box( Pk, ( UP.x0 + UP.x1 ) / 2, UP.y0 + 2.2, FZ + 0.12, UP.x1 - UP.x0, 0.06, 0.1 );
	K.use( 'iron' ).box( Pk, ( UP.x0 + UP.x1 ) / 2, UP.y0 + 0.04, FZ + 0.12, UP.x1 - UP.x0, 0.08, 0.14 );
	// a door in the glass at each end (where the servers go in and out)
	out.doorsUp = [ UP.x0 + 1.35, UP.x1 - 1.35 ];

	// -- the patio: high-tops with stools, the heaters, the menu stand; the walkway joining it to the porch
	out.spots.patio = [];
	const patioZ = FZ - 2.3;
	for ( let x = XL + 2.0; x < XR - 1.5; x += 2.9 ) {

		if ( Math.abs( x - out.doorsUp[ 0 ] ) < 1.2 || Math.abs( x - out.doorsUp[ 1 ] ) < 1.2 ) continue;
		hightop( K, Pk, x, patioZ, PY );
		out.spots.patio.push( { x, z: patioZ, y: PY } );

	}

	// the patio heaters (the tall propane mushrooms: it's 47 degrees on the 27th, 44 and blowing on the 29th)
	out.heaters = [];
	for ( const x of [ XL + 3.4, - 2, XR - 3.4 ] ) {

		heater( K, Pk, x, FZ - 1.2, PY );
		out.heaters.push( { x, z: FZ - 1.2, y: PY + 2.3 } );

	}

	// the rail at the patio's edge (Landmarks'), and people along it: where they stand
	out.spots.patioRail = [];
	for ( let x = XL + 0.8; x < XR - 0.6; x += 0.85 ) out.spots.patioRail.push( { x, z: FZ - 4.2, y: PY } );

	// -- the walkway behind the porch's top row, out to the patio (Landmarks' patio stopped 3 to 7 m short
	// of the porch, open to the concourse below): a concrete slab at the patio's level, its rail at the ends
	const porchBack = ( x ) => - 16.9 - 0.1866 * ( x - 24.5 );
	out.porchBack = porchBack;
	const wq = new Quads();
	const W0 = XL - 1.5, W1 = XR + 1.5;
	for ( let x = W0; x < W1 - 0.01; x += 1.5 ) {

		const xa = x, xb = Math.min( W1, x + 1.5 );
		const za = porchBack( xa ) + 0.05, zb = porchBack( xb ) + 0.05, zf = FZ - 4.6;
		if ( zf <= za && zf <= zb ) continue;
		wq.add( P( xa, PY, za ), P( xb, PY, zb ), P( xb, PY, zf ), P( xa, PY, zf ), [ 0, 1, 0 ] );
		wq.add( P( xa, PY - 0.35, zf ), P( xb, PY - 0.35, zf ), P( xb, PY - 0.35, zb ), P( xa, PY - 0.35, za ), [ 0, - 1, 0 ] );

	}

	// its ends
	for ( const x of [ W0, W1 ] ) wq.add( P( x, PY - 0.35, porchBack( x ) ), P( x, PY - 0.35, FZ - 4.6 ), P( x, PY, FZ - 4.6 ), P( x, PY, porchBack( x ) ), D( x < 0 ? - 1 : 1, 0 ) );
	const slabMat = standard( { name: 'harrys-walkway', color: new Color( 0.3, 0.29, 0.27 ), roughness: 0.9, modules: [ commonModule ],
		surface: 's.albedo = mat.color * ( 0.85 + 0.15 * mx_noise_float2( in.P.xz * 0.9 ) );' } );
	slabMat.underwaterLighting = 'none';
	const walk = new Mesh( wq.geometry(), slabMat );
	walk.name = 'harrys-walkway';
	walk.receiveShadow = true;
	walk.castShadow = true;
	place.group.add( walk );
	out.rainRoof = [ walk ];
	// the rail across each end of the walkway, and the people along the porch's back wall
	for ( const x of [ W0, W1 ] ) for ( const y of [ PY + 0.55, PY + 1.07 ] ) K.bar( Pk( x, y, porchBack( x ) ), Pk( x, y, FZ - 4.6 ), 0.05 );
	out.spots.porchBack = [];
	for ( let x = XL - 1; x < XR + 1; x += 0.8 ) out.spots.porchBack.push( { x, z: porchBack( x ) + 0.45, y: PY } );

	// ---- downstairs: the lower level's bar in the ground storey, open to the concourse
	const bz = FZ + 0.75;
	K.use( 'mahogany' ).box( Pk, ( DN.x0 + DN.x1 ) / 2, STREET + 0.52, bz, DN.x1 - DN.x0 - 2, 1.04, 0.6 );
	K.use( 'mahogany' ).box( Pk, ( DN.x0 + DN.x1 ) / 2, STREET + 1.07, bz - 0.08, DN.x1 - DN.x0 - 1.9, 0.06, 0.8 );
	K.use( 'brass' ).box( Pk, ( DN.x0 + DN.x1 ) / 2, STREET + 0.2, bz - 0.4, DN.x1 - DN.x0 - 2, 0.05, 0.05 );
	K.use( 'mahogany' ).box( Pk, ( DN.x0 + DN.x1 ) / 2, STREET + 0.45, DR.z1 - 0.3, DN.x1 - DN.x0 - 1, 0.9, 0.5 );
	K.panel( Pk, ( DN.x0 + DN.x1 ) / 2 - 4, STREET + 1.5, DR.z1 - 0.04, 12, 1.2, 'backbar' );
	K.panel( Pk, ( DN.x0 + DN.x1 ) / 2 + 6.5, STREET + 1.6, DR.z1 - 0.04, 1.6, 1.2, 'menuDown' );
	// the kitchen's pass at the right-hand end: a steel shelf under heat lamps, a swing door
	K.use( 'steel' ).box( Pk, DN.x1 - 2.2, STREET + 1.25, DR.z1 - 0.35, 2.4, 0.05, 0.4 );
	for ( let k = 0; k < 3; k ++ ) K.use( 'redLamp' ).box( Pk, DN.x1 - 3.0 + k * 0.8, STREET + 1.95, DR.z1 - 0.35, 0.3, 0.08, 0.2 );
	K.use( 'steel' ).box( Pk, DN.x1 - 0.8, STREET + 1.05, DR.z1 - 0.02, 0.9, 2.1, 0.04 );
	for ( let k = 0; k < 10; k ++ ) {

		const tx = DN.x0 + 2.5 + k * ( DN.x1 - DN.x0 - 5 ) / 9;
		K.use( 'chrome' ).cyl( Pk, tx, bz + 0.1, STREET + 1.1, STREET + 1.42, 0.035, 0.035, 8 );
		K.use( [ 'red', 'navy', 'cream', 'green', 'black' ][ k % 5 ] ).box( Pk, tx, STREET + 1.52, bz + 0.1, 0.05, 0.2, 0.05 );

	}

	out.spots.bartendDn = [ { x: DN.x0 + 4, z: bz + 0.8, y: STREET }, { x: - 2, z: bz + 0.8, y: STREET }, { x: DN.x1 - 4.5, z: bz + 0.8, y: STREET } ];
	out.spots.barDn = [];
	for ( let x = DN.x0 + 1.6; x <= DN.x1 - 1.6; x += 0.9 ) out.spots.barDn.push( { x, z: bz - 0.75, y: STREET } );
	// its fascia, lit; the menu beside the opening; TVs over the bar front, tipped down to the tables
	K.panel( Pk, ( DN.x0 + DN.x1 ) / 2, DN.y1 + 0.5, FZ - 0.04, 5.2, 1.3, 'hkFascia' );
	K.panel( Pk, DN.x1 + 1.6, STREET + 1.9, FZ - 0.04, 1.8, 1.35, 'menuDown' );
	K.panel( Pk, DN.x0 - 1.4, STREET + 1.8, FZ - 0.04, 1.6, 0.3, 'rules' );
	for ( let k = 0; k < 4; k ++ ) out.tvs.push( { x: DN.x0 + 3.5 + k * ( DN.x1 - DN.x0 - 7 ) / 3, y: DN.y1 + 1.6, z: FZ - 0.25, w: 1.2, h: 0.68, face: - 1, tilt: 0.2 } );
	for ( let k = 0; k < 3; k ++ ) out.tvs.push( { x: DN.x0 + 4 + k * ( DN.x1 - DN.x0 - 8 ) / 2, y: STREET + 2.55, z: DR.z1 - 0.1, w: 1.0, h: 0.56, face: - 1 } );

	// -- the dining room under the porch: tables out to a low rail along the back of the 140s, where a
	// counter with stools looks out over the seats to the field; the host stand at the rail's gap
	const back140 = ( x ) => - 21.3 - 0.186 * ( x - 22.8 );
	out.back140 = back140;
	const railZ = ( x ) => back140( x ) + 0.9;
	out.spots.tablesDn = [];
	out.spots.counterDn = [];
	const X0 = DN.x0 - 1, X1 = DN.x1 + 1.5;
	for ( const z of [ FZ - 2.4, FZ - 4.6, FZ - 6.8, FZ - 9.0, FZ - 11.2 ] ) for ( let x = X0 + 1.2; x < X1 - 1; x += 2.6 ) {

		if ( z < railZ( x ) + 2.2 ) continue;
		if ( Math.abs( x - ( - 2 ) ) < 1.4 && z < FZ - 6 ) continue;
		fourTop( K, Pk, x, z, STREET );
		out.spots.tablesDn.push( { x, z, y: STREET, n: 4, low: true } );

	}

	// the counter at the back of the 140s (the park's metal drink counters, here with stools)
	for ( let x = X0; x < X1 - 0.3; x += 1.6 ) {

		const xa = x, xb = Math.min( X1, x + 1.6 );
		const a = Pk( xa, STREET + 1.07, railZ( xa ) ), b = Pk( xb, STREET + 1.07, railZ( xb ) );
		K.use( 'galv' ).bar( a, b, 0.05 );
		K.use( 'galv' ).bar( Pk( xa, STREET, railZ( xa ) ), Pk( xa, STREET + 1.07, railZ( xa ) ), 0.05 );
		K.use( 'steel' ).box( Pk, ( xa + xb ) / 2, STREET + 1.08, ( railZ( xa ) + railZ( xb ) ) / 2 + 0.12, xb - xa, 0.03, 0.3 );

	}

	for ( let x = X0 + 0.5; x < X1 - 0.4; x += 0.8 ) {

		stool( K, Pk, x, railZ( x ) + 0.7, STREET );
		out.spots.counterDn.push( { x, z: railZ( x ) + 0.62, y: STREET, seat: 0.76 } );

	}

	// the low rail round the tables at the ends, the host stand at the concourse end
	for ( const x of [ X0, X1 ] ) {

		K.use( 'galv' ).bar( Pk( x, STREET + 0.95, railZ( x ) ), Pk( x, STREET + 0.95, FZ - 1.4 ), 0.045 );
		K.use( 'galv' ).bar( Pk( x, STREET, FZ - 1.4 ), Pk( x, STREET + 0.95, FZ - 1.4 ), 0.05 );

	}

	K.use( 'mahogany' ).box( Pk, X1 + 0.6, STREET + 0.55, FZ - 3.2, 0.6, 1.1, 0.5 );
	K.use( 'lamp' ).box( Pk, X1 + 0.6, STREET + 1.12, FZ - 3.2, 0.2, 0.04, 0.2 );
	out.spots.host = { x: X1 + 1.2, z: FZ - 3.2, y: STREET };
	// the hanging sign under the walkway and its arrows, both faces, on rods from the slab above
	for ( const back of [ false, true ] ) {

		const zz = - 9.3 + ( back ? 0.02 : - 0.02 );
		K.panel( Pk, - 2, STREET + 5.2, zz, 2.6, 1.3, 'hkSign', back );
		K.panel( Pk, - 2, STREET + 4.3, zz, 2.6, 0.49, 'hkDir', back );

	}

	for ( const x of [ - 3.1, - 0.9 ] ) K.use( 'black' ).bar( Pk( x, STREET + 5.85, - 9.3 ), Pk( x, PY - 0.35, - 9.3 ), 0.03 );
	// the section plates over the aisles into the 140s, the porch's own over its top row
	for ( const [ n, x ] of [ [ '143', 16 ], [ '144', 4 ], [ '145', - 8 ], [ '146', - 20 ] ] ) K.panel( Pk, x, STREET + 2.9, back140( x ) - 0.3, 0.55, 0.8, 'plate' + n );
	for ( const [ n, x ] of [ [ '242', 12 ], [ '243', 1 ], [ '244', - 10 ] ] ) K.panel( Pk, x, PY + 1.9, porchBack( x ) + 0.1, 0.5, 0.72, 'plate' + n, true );
	K.panel( Pk, XR + 3.6, PY + 2.2, porchBack( XR + 3.6 ) + 0.4, 2.1, 0.52, 'porchSign', true );

	// (the Kit's mesh is made by the place once everything's in it)
	out.hg = hg;
	return out;

}

// a bar stool: a round seat on a chrome post, a foot ring
export function stool( K, P, x, z, y, h = 0.76 ) {

	K.use( 'chrome' ).cyl( P, x, z, y, y + h - 0.06, 0.025, 0.025, 6, { top: false } );
	K.use( 'chrome' ).cyl( P, x, z, y, y + 0.02, 0.2, 0.2, 10 );
	K.use( 'chrome' ).cyl( P, x, z, y + 0.3, y + 0.32, 0.17, 0.17, 10, { top: false } );
	K.use( 'redVinyl' ).cyl( P, x, z, y + h - 0.06, y + h, 0.19, 0.18, 12 );

}

// a high-top: a black laminate top on an iron column, two stools
export function hightop( K, P, x, z, y ) {

	K.use( 'iron' ).cyl( P, x, z, y, y + 1.02, 0.04, 0.04, 6, { top: false } );
	K.use( 'iron' ).cyl( P, x, z, y, y + 0.03, 0.28, 0.28, 10 );
	K.use( 'laminate' ).cyl( P, x, z, y + 1.02, y + 1.06, 0.38, 0.38, 14, { bottom: true } );
	stool( K, P, x - 0.55, z, y );
	stool( K, P, x + 0.55, z, y );

}

// a four-top: a square table and four chairs
export function fourTop( K, P, x, z, y ) {

	K.use( 'laminate' ).box( P, x, y + 0.74, z, 0.8, 0.04, 0.8 );
	K.use( 'iron' ).cyl( P, x, z, y, y + 0.72, 0.04, 0.04, 6, { top: false } );
	K.use( 'iron' ).box( P, x, y + 0.02, z, 0.5, 0.03, 0.5 );
	for ( const [ dx, dz ] of [ [ - 0.62, 0 ], [ 0.62, 0 ], [ 0, - 0.62 ], [ 0, 0.62 ] ] ) chair( K, P, x + dx, z + dz, y, Math.atan2( dx, dz ) );

}

// a bistro chair facing ( the table ): seat, legs, back
export function chair( K, P, x, z, y, a ) {

	const ux = Math.sin( a ), uz = Math.cos( a );
	K.use( 'iron' ).box( P, x, y + 0.45, z, 0.42, 0.04, 0.42 );
	for ( const [ i, j ] of [ [ - 1, - 1 ], [ 1, - 1 ], [ 1, 1 ], [ - 1, 1 ] ] ) K.use( 'iron' ).box( P, x + i * 0.18, y + 0.22, z + j * 0.18, 0.025, 0.45, 0.025 );
	K.use( 'iron' ).box( P, x + ux * 0.2, y + 0.72, z + uz * 0.2, Math.abs( uz ) > 0.5 ? 0.4 : 0.03, 0.5, Math.abs( uz ) > 0.5 ? 0.03 : 0.4 );

}

// a patio heater: a steel post on a round base, the burner and its reflector hood up top (lit at night:
// the glow under the hood)
export function heater( K, P, x, z, y ) {

	K.use( 'steel' ).cyl( P, x, z, y, y + 0.08, 0.3, 0.3, 12 );
	K.use( 'steel' ).cyl( P, x, z, y + 0.08, y + 0.7, 0.2, 0.18, 12 );
	K.use( 'steel' ).cyl( P, x, z, y + 0.7, y + 2.05, 0.035, 0.035, 8, { top: false } );
	K.use( 'flame' ).cyl( P, x, z, y + 2.05, y + 2.3, 0.1, 0.1, 10, { top: false } );
	K.use( 'steel' ).cyl( P, x, z, y + 2.3, y + 2.42, 0.85, 0.2, 16, { top: true, bottom: true } );

}
