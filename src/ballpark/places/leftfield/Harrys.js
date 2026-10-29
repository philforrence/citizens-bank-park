import { Mesh, Group, Color } from '../../../engine/index.js';
import { standard } from '../../../materials/Materials.js';
import { commonModule } from '../../../engine/render/wgsl/common.js';
import { Quads } from '../../Stands.js';
import { Kit, atlasUV } from './Kit.js';
import { SHELF_PX } from './Atlas.js'; // ---- FX3
import { STREET } from './Frame.js';
import { porchBackLine } from './Access.js'; // ---- FA2

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
	// (---- FX3: the board frame's x in the world, for the ceiling's ribs and the walkway's joints)
	const WD = ( () => {

		const fd = place.field;
		if ( ! fd?.toWorld ) return [ 1, 0 ];
		const a = fd.toWorld( ...F.field( 0, 0 ) ), b = fd.toWorld( ...F.field( 1, 0 ) ), l = Math.hypot( b.x - a.x, b.z - a.z ) || 1;
		return [ ( b.x - a.x ) / l, ( b.z - a.z ) / l ];

	} )();
	const room = new Quads();
	const RQ = ( kind, a, b, c, d, n ) => {

		// uv.x the kind, uv.y a length for the pattern
		room.tri( a, b, c, n, [ kind, 0 ], [ kind, 1 ], [ kind, 1 ] );
		room.tri( a, c, d, n, [ kind, 0 ], [ kind, 1 ], [ kind, 0 ] );

	};
	const box = ( kind, x0, x1, y0, y1, z0, z1, O ) => {

		// the inside of a box: its floor (kind 0), ceiling (2), walls (1)
		RQ( 0, P( x0, y0, z0 ), P( x1, y0, z0 ), P( x1, y0, z1 ), P( x0, y0, z1 ), [ 0, 1, 0 ] );
		RQ( 2, P( x0, y1, z1 ), P( x1, y1, z1 ), P( x1, y1, z0 ), P( x0, y1, z0 ), [ 0, - 1, 0 ] );
		RQ( kind, P( x1, y0, z1 ), P( x0, y0, z1 ), P( x0, y1, z1 ), P( x1, y1, z1 ), D( 0, - 1 ) );
		RQ( kind, P( x0, y0, z1 ), P( x0, y0, z0 ), P( x0, y1, z0 ), P( x0, y1, z1 ), D( 1, 0 ) );
		RQ( kind, P( x1, y0, z0 ), P( x1, y0, z1 ), P( x1, y1, z1 ), P( x1, y1, z0 ), D( - 1, 0 ) );
		// the inside of the front wall, above and beside the opening O. ---- FX3 (step 11, AD1-1): only round
		// it. This quad ran across the whole front, the opening too, so from inside both bars the glass and the
		// open front were a red-and-wood wall (from outside, one-sided, it didn't show)
		const front = ( xa, xb, ya, yb ) => {

			if ( xb - xa > 0.01 && yb - ya > 0.01 ) RQ( kind, P( xa, ya, z0 ), P( xb, ya, z0 ), P( xb, yb, z0 ), P( xa, yb, z0 ), D( 0, 1 ) );

		};
		const ox0 = Math.max( x0, O.x0 ), ox1 = Math.min( x1, O.x1 ), oy1 = Math.min( y1, O.y1 );
		front( x0, ox0, y0, y1 );
		front( ox1, x1, y0, y1 );
		front( ox0, ox1, oy1, y1 );
		front( ox0, ox1, y0, Math.max( y0, O.y0 ) );
		// ---- end FX3

	};
	// upstairs: 8.4 m deep, the ceiling at 3.5 m
	const UR = { x0: UP.x0, x1: UP.x1, y0: PY, y1: PY + 3.5, z0: FZ + T, z1: FZ + T + 8.1 };
	box( 1, UR.x0, UR.x1, UR.y0, UR.y1, UR.z0, UR.z1, UP );
	// downstairs: the bar and the kitchen's pass, 5 m deep
	const DR = { x0: DN.x0, x1: DN.x1, y0: STREET, y1: DN.y1 + 0.2, z0: FZ + T, z1: FZ + T + 5 };
	box( 3, DR.x0, DR.x1, DR.y0, DR.y1, DR.z0, DR.z1, DN );
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
		// the ceiling: cans of light every 1.8 m. ---- FX3 (step 11, AD1-9): in the deck over the room, painted
		// out a dark warm grey as bars paint them (the lower level's ceiling is the deck's own steel, maroon,
		// NLCS 2009), its ribs every 0.3 m across the room, a hanger's shadow line at each beam, and the soft
		// pool each can throws on the paint round it. It was albedo 0.025: a black void with the cans in it
		let g = fract( in.P.xz / 1.8 ) - 0.5;
		let rc = length( g ) * 1.8;
		let can = 1.0 - smoothstep( 0.09, 0.144, rc );
		let along = dot( in.P.xz, vec2f( ${ WD[ 0 ].toFixed( 4 ) }, ${ WD[ 1 ].toFixed( 4 ) } ) );
		let rib = smoothstep( 0.36, 0.46, abs( fract( along / 0.3 ) - 0.5 ) ) * ( 1.0 - clamp( fwidth( along ) / 0.3 * 2.0, 0.0, 1.0 ) );
		let beamLine = 1.0 - smoothstep( 0.08, 0.13, abs( fract( along / 3.0 ) - 0.5 ) * 3.0 );
		s.albedo = vec3f( 0.085, 0.074, 0.064 ) * ( 0.88 + 0.12 * mx_noise_float2( in.P.xz * 2.3 ) ) * ( 1.0 - 0.3 * rib ) * ( 1.0 - 0.35 * beamLine );
		s.roughness = 0.85;
		let pool = exp( - rc * rc / 0.3 ) * 0.7 + exp( - rc * rc / 1.4 ) * 0.25;
		s.emissive = vec3f( 1.0, 0.8, 0.55 ) * ( can * ( 2.0 + 2.0 * nk ) + s.albedo * pool * ( 1.5 + 2.5 * nk ) );
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
	out.bar = { x0: barX0, x1: barX1, z: barZ }; // ---- FA2 (its collider, Access.js)
	K.use( 'mahogany' ).box( Pk, ( barX0 + barX1 ) / 2, PY + 0.52, barZ, barX1 - barX0, 1.04, 0.62 );
	K.use( 'mahogany' ).box( Pk, ( barX0 + barX1 ) / 2, PY + 1.07, barZ - 0.06, barX1 - barX0 + 0.1, 0.06, 0.78 );
	K.use( 'brass' ).box( Pk, ( barX0 + barX1 ) / 2, PY + 0.2, barZ - 0.42, barX1 - barX0, 0.05, 0.05 );
	// the back bar: counter, the lit shelves of bottles, the taps along the bar top
	K.use( 'mahogany' ).box( Pk, ( barX0 + barX1 ) / 2, PY + 0.45, UR.z1 - 0.3, barX1 - barX0 + 1, 0.9, 0.5 );
	K.panel( Pk, ( barX0 + barX1 ) / 2, PY + 1.55, UR.z1 - 0.04, barX1 - barX0 + 1, 1.25, 'backbar' );
	backBar( K, Pk, barX0 - 0.5, barX1 + 0.5, UR.z1, PY, PY + 2.175, 1.25, 11 ); // ---- FX3 (AD1-9)
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
	for ( const [ x, cell, w ] of [ [ - 15.5, 'neonBud', 1.3 ], [ - 6.4, 'neonYuengling', 1.2 ], [ 3.8, 'neonMiller', 1.2 ], [ 12.4, 'neonBud', 1.3 ] ] ) {

		const h = w * ( cell === 'neonMiller' ? 0.25 : 0.375 ), y = GY - 0.55;
		K.panel( Pk, x, y, FZ + 0.2, w, h, cell );
		// ---- FX3 (AD1-1): and from inside, the same tubes read backwards (the room can see out now); the
		// chains they hang from
		K.quad( Pk( x + w / 2, y - h / 2, FZ + 0.21 ), Pk( x - w / 2, y - h / 2, FZ + 0.21 ), Pk( x - w / 2, y + h / 2, FZ + 0.21 ), Pk( x + w / 2, y + h / 2, FZ + 0.21 ), Pk.dir( 0, 0, 1 ),
			[ atlasUV( cell, 0, 1 ), atlasUV( cell, 1, 1 ), atlasUV( cell, 1, 0 ), atlasUV( cell, 0, 0 ) ] );
		for ( const s of [ - 0.4, 0.4 ] ) K.use( 'rodBlack' ).bar( Pk( x + s * w, y + h / 2, FZ + 0.205 ), Pk( x + s * w, GY - 0.03, FZ + 0.205 ), 0.008 );
		// ---- end FX3

	}

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

	// -- the patio: round high-tops in glossy royal blue on their pedestals right at the rail, white stools,
	// the menu in its acrylic stand and the Coke cups (Flickr, October 10, 2008, the NLCS: Harry's upstairs
	// over left field); the heaters; the walkway joining it to the porch
	out.spots.patio = [];
	const patioZ = FZ - 3.75;
	const railTables = [];
	for ( let x = XL + 1.6; x < XR - 1.2; x += 3.4 ) {

		hightop( K, Pk, x, patioZ, PY, { top: 'blueTop', stool: 'whiteStool', along: true } );
		K.panel( Pk, x + 0.12, PY + 1.16, patioZ - 0.05, 0.13, 0.19, 'menuUp' );
		K.use( 'cup' ).cyl( Pk, x - 0.14, patioZ + 0.08, PY + 1.06, PY + 1.22, 0.04, 0.05, 8 );
		out.spots.patio.push( { x, z: patioZ, y: PY } );
		railTables.push( x );

	}

	// the patio heaters (the tall propane mushrooms: it's 47 degrees on the 27th, 44 and blowing on the 29th)
	out.heaters = [];
	for ( const x of [ XL + 3.4, - 2, XR - 3.4 ] ) {

		heater( K, Pk, x, FZ - 1.2, PY );
		out.heaters.push( { x, z: FZ - 1.2, y: PY + 2.3 } );

	}

	// the rail at the patio's edge (Landmarks'), and people along it: where they stand
	out.spots.patioRail = [];
	for ( let x = XL + 0.8; x < XR - 0.6; x += 0.85 ) if ( railTables.every( ( t ) => Math.abs( t - x ) > 1.1 ) ) out.spots.patioRail.push( { x, z: FZ - 4.2, y: PY } );

	// -- the walkway behind the porch's top row, out to the patio (Landmarks' patio stopped 3 to 7 m short
	// of the porch, open to the concourse below): a concrete slab at the patio's level. ---- FA2 (step 10,
	// WA2-2): the deck's real back line (it was a straight line fitted by eye, 1.6 m into the top two rows at
	// the pole's end), and the walkway the whole length of the deck with its stairs, rails and the elevator
	// (Access.js, which builds the slab); this one only where Access can't (no bowl)
	const porchLine = porchBackLine( place.bowl, F );
	const porchBack = porchLine || ( ( x ) => - 16.9 - 0.1866 * ( x - 24.5 ) );
	out.porchBack = porchBack;
	out.porchLine = porchLine;
	// ---- FX3 (step 11, AD1-6): the walkway's concrete as the park's other decks have it (the Porch from the 3B
	// side, Commons 2008-03-29: a broom-finished slab with its joints, and four seasons of wear): saw-cut joints
	// every 2.4 m along the board and 1.5 m across it, the broom's grain across, darker where feet go along
	// the rail over the top row and in the joints' grime, gum and spills. It was one flat grey
	const slabMat = standard( { name: 'harrys-walkway', color: new Color( 0.3, 0.29, 0.27 ), roughness: 0.9, modules: [ commonModule ],
		surface: /* wgsl */`
	let U = vec2f( ${ WD[ 0 ].toFixed( 4 ) }, ${ WD[ 1 ].toFixed( 4 ) } );
	let p = vec2f( dot( in.P.xz, U ), dot( in.P.xz, vec2f( - U.y, U.x ) ) );
	let jv = abs( fract( p / vec2f( 2.4, 1.5 ) ) - 0.5 );
	let fw = fwidth( p ) / vec2f( 2.4, 1.5 );
	let cut = max( step( 0.4955, jv.x ) * ( 1.0 - clamp( fw.x * 60.0, 0.0, 1.0 ) ), step( 0.4925, jv.y ) * ( 1.0 - clamp( fw.y * 40.0, 0.0, 1.0 ) ) );
	let broom = 0.5 + 0.5 * sin( p.y * 95.0 + mx_noise_float2( p * vec2f( 0.6, 3.0 ) ) * 3.0 );
	let fb = clamp( fwidth( p.y ) * 30.0, 0.0, 1.0 );
	let grime = smoothstep( 0.1, 0.9, mx_noise_float2( p * 0.35 ) * 0.5 + 0.5 );
	let edge = 1.0 - smoothstep( 0.0, 0.05, min( jv.x * 2.4, jv.y * 1.5 ) );
	let gum = step( 0.72, mx_noise_float2( p * 7.0 ) ) * step( 0.5, mx_noise_float2( p * 0.9 + 7.0 ) ) * ( 1.0 - fb );
	var c = mat.color * ( 0.85 + 0.15 * mx_noise_float2( in.P.xz * 0.9 ) ) * ( 0.96 + 0.04 * mix( broom, 0.5, fb ) );
	c *= 1.0 - 0.16 * grime - 0.12 * edge;
	c = mix( c, vec3f( 0.06, 0.055, 0.05 ), cut * 0.85 );
	c = mix( c, vec3f( 0.08, 0.075, 0.07 ), gum * 0.8 );
	s.albedo = c;
	s.roughness = 0.9 - 0.1 * grime;
` } );
	// ---- end FX3
	slabMat.underwaterLighting = 'none';
	out.slabMat = slabMat;
	out.rainRoof = [];
	if ( ! porchLine ) {

		const wq = new Quads();
		const W0 = XL - 1.5, W1 = XR + 1.5;
		for ( let x = W0; x < W1 - 0.01; x += 1.5 ) {

			const xa = x, xb = Math.min( W1, x + 1.5 );
			const za = porchBack( xa ) + 0.05, zb = porchBack( xb ) + 0.05, zf = FZ - 4.6;
			if ( zf <= za && zf <= zb ) continue;
			wq.add( P( xa, PY, za ), P( xb, PY, zb ), P( xb, PY, zf ), P( xa, PY, zf ), [ 0, 1, 0 ] );
			wq.add( P( xa, PY - 0.35, zf ), P( xb, PY - 0.35, zf ), P( xb, PY - 0.35, zb ), P( xa, PY - 0.35, za ), [ 0, - 1, 0 ] );

		}

		for ( const x of [ W0, W1 ] ) wq.add( P( x, PY - 0.35, porchBack( x ) ), P( x, PY - 0.35, FZ - 4.6 ), P( x, PY, FZ - 4.6 ), P( x, PY, porchBack( x ) ), D( x < 0 ? - 1 : 1, 0 ) );
		const walk = new Mesh( wq.geometry(), slabMat );
		walk.name = 'harrys-walkway';
		walk.receiveShadow = true;
		walk.castShadow = true;
		place.group.add( walk );
		out.rainRoof.push( walk );
		for ( const x of [ W0, W1 ] ) for ( const y of [ PY + 0.55, PY + 1.07 ] ) K.bar( Pk( x, y, porchBack( x ) ), Pk( x, y, FZ - 4.6 ), 0.05 );

	}
	// ---- end FA2
	// the people along the porch's back wall
	out.spots.porchBack = [];
	for ( let x = XL - 1; x < XR + 1; x += 0.8 ) out.spots.porchBack.push( { x, z: porchBack( x ) + 0.45, y: PY } );

	// ---- downstairs: the lower level's bar in the ground storey, open to the concourse
	const bz = FZ + 0.75;
	K.use( 'mahogany' ).box( Pk, ( DN.x0 + DN.x1 ) / 2, STREET + 0.52, bz, DN.x1 - DN.x0 - 2, 1.04, 0.6 );
	K.use( 'mahogany' ).box( Pk, ( DN.x0 + DN.x1 ) / 2, STREET + 1.07, bz - 0.08, DN.x1 - DN.x0 - 1.9, 0.06, 0.8 );
	K.use( 'brass' ).box( Pk, ( DN.x0 + DN.x1 ) / 2, STREET + 0.2, bz - 0.4, DN.x1 - DN.x0 - 2, 0.05, 0.05 );
	K.use( 'mahogany' ).box( Pk, ( DN.x0 + DN.x1 ) / 2, STREET + 0.45, DR.z1 - 0.3, DN.x1 - DN.x0 - 1, 0.9, 0.5 );
	K.panel( Pk, ( DN.x0 + DN.x1 ) / 2 - 4, STREET + 1.5, DR.z1 - 0.04, 12, 1.2, 'backbar' );
	backBar( K, Pk, ( DN.x0 + DN.x1 ) / 2 - 10, ( DN.x0 + DN.x1 ) / 2 + 2, DR.z1, STREET, STREET + 2.1, 1.2, 23 ); // ---- FX3 (AD1-9)
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
	// (the lower level's are the old tube sets on wall brackets, as in the photos)
	for ( let k = 0; k < 4; k ++ ) out.tvs.push( { x: DN.x0 + 3.5 + k * ( DN.x1 - DN.x0 - 7 ) / 3, y: DN.y1 + 0.95, z: FZ - 0.45, w: 0.72, h: 0.54, face: - 1, crt: true } );
	for ( let k = 0; k < 3; k ++ ) out.tvs.push( { x: DN.x0 + 4 + k * ( DN.x1 - DN.x0 - 8 ) / 2, y: STREET + 2.55, z: DR.z1 - 0.1, w: 1.0, h: 0.56, face: - 1 } );

	// -- the dining room under the porch: tables out to a low rail along the back of the 140s, where a
	// counter with stools looks out over the seats to the field; the host stand at the rail's gap
	const back140 = ( x ) => - 21.3 - 0.186 * ( x - 22.8 );
	out.back140 = back140;
	// (March 2008's photo under the porch: a walkway along the top of the 140s under the section plates, then
	// the galvanized fence with the red cans against it, and Harry's tables behind it)
	const railZ = ( x ) => back140( x ) + 2.6;
	out.railZ = railZ;
	out.spots.tablesDn = [];
	out.spots.counterDn = [];
	const X0 = DN.x0 - 1, X1 = DN.x1 + 1.5;
	for ( const z of [ FZ - 2.4, FZ - 4.6, FZ - 6.8, FZ - 9.0, FZ - 11.2 ] ) for ( let x = X0 + 1.2; x < X1 - 1; x += 2.6 ) {

		if ( z < railZ( x ) + 2.2 ) continue;
		if ( Math.abs( x - ( - 2 ) ) < 1.4 && z < FZ - 6 ) continue;
		fourTop( K, Pk, x, z, STREET );
		out.spots.tablesDn.push( { x, z, y: STREET, n: 4, low: true } );
		// the table's number on a white tent card, the ketchup
		K.use( 'white' ).box( Pk, x + 0.22, STREET + 0.8, z - 0.2, 0.1, 0.09, 0.03 );
		K.use( 'ketchup' ).cyl( Pk, x - 0.2, z + 0.2, STREET + 0.76, STREET + 0.94, 0.03, 0.028, 6 );

	}

	// overhead (the NLCS 2009 photos of the lower level): the deck's maroon steel, beams and joists over the
	// tables, black netting under it against the birds, dome pendants hung low on long cords over the tables
	{

		const yB = PY - 0.6, zs = [ FZ - 1.0, FZ - 4.0, FZ - 7.0, FZ - 10.0, FZ - 13.0 ];
		for ( const z of zs ) {

			const xa = X0 - 0.5, xb = X1 + 0.5;
			if ( porchBack( xa ) > z && porchBack( xb ) > z ) continue;
			K.use( 'maroon' ).bar( Pk( xa, yB, z ), Pk( xb, yB, z ), 0.45 );

		}

		for ( let x = X0; x <= X1 + 0.01; x += 3 ) K.use( 'maroon' ).bar( Pk( x, yB - 0.3, FZ - 0.4 ), Pk( x, yB - 0.3, Math.max( porchBack( x ) + 0.5, FZ - 14 ) ), 0.25 );
		for ( const t of out.spots.tablesDn ) {

			if ( ( t.x * 7 + t.z * 3 ) % 2 > 1.2 ) continue;
			const top = yB - 0.45, hang = STREET + 2.9;
			K.use( 'black' ).bar( Pk( t.x, top, t.z ), Pk( t.x, hang + 0.2, t.z ), 0.012 );
			K.use( 'dome' ).cyl( Pk, t.x, t.z, hang, hang + 0.22, 0.28, 0.06, 8, { top: true } );
			K.use( 'lamp' ).cyl( Pk, t.x, t.z, hang - 0.01, hang + 0.01, 0.2, 0.2, 8, { top: false, bottom: true } );

		}

	}

	// the fence between the walkway and the tables: galvanized posts, rails and pickets, a steel counter along
	// its inside for the stools, the red Phillies cans against its outside
	for ( let x = X0; x < X1 - 0.3; x += 1.6 ) {

		const xa = x, xb = Math.min( X1, x + 1.6 );
		const a = Pk( xa, STREET + 1.07, railZ( xa ) ), b = Pk( xb, STREET + 1.07, railZ( xb ) );
		K.use( 'galv' ).bar( a, b, 0.05 );
		K.use( 'galv' ).bar( Pk( xa, STREET + 0.1, railZ( xa ) ), Pk( xb, STREET + 0.1, railZ( xb ) ), 0.035 );
		K.use( 'galv' ).bar( Pk( xa, STREET, railZ( xa ) ), Pk( xa, STREET + 1.07, railZ( xa ) ), 0.05 );
		for ( let u = 0.13; u < xb - xa - 0.05; u += 0.13 ) K.use( 'galv' ).bar( Pk( xa + u, STREET + 0.1, railZ( xa + u ) ), Pk( xa + u, STREET + 1.05, railZ( xa + u ) ), 0.014 );
		K.use( 'steel' ).box( Pk, ( xa + xb ) / 2, STREET + 1.08, ( railZ( xa ) + railZ( xb ) ) / 2 + 0.14, xb - xa, 0.03, 0.3 );

	}

	for ( let x = X0 + 2.5; x < X1; x += 7.2 ) {

		const z = railZ( x ) - 0.45;
		K.use( 'red' ).box( Pk, x, STREET + 0.39, z, 0.58, 0.78, 0.58 );
		K.use( 'red' ).cyl( Pk, x, z, STREET + 0.78, STREET + 0.9, 0.38, 0.2, 4 );

	}

	// the walkway along the top of the 140s: where people pass, both ways
	out.walkDn = [];
	for ( let x = X1 + 6; x > X0 - 6; x -= 3 ) out.walkDn.push( { x, z: back140( x ) + 1.35 } );

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
	// ---- FX3 (step 11, AD1-6): the sign stood on nothing, 2 m up over the walkway. Now it's a sign cabinet on
	// two black-painted pipe posts off the walkway's slab on their base plates (the park's own wayfinding
	// signs stand so), its face printed both ways (the walkway's side and the Porch's), a cap along its top
	{

		const sx = XR + 3.6, sz = porchBack( sx ) + 0.4;
		K.use( 'navy' ).box( Pk, sx, PY + 2.2, sz - 0.035, 2.16, 0.58, 0.06 );
		K.panel( Pk, sx, PY + 2.2, sz - 0.071, 2.1, 0.52, 'porchSign' );
		K.use( 'rodBlack' ).box( Pk, sx, PY + 2.5, sz - 0.035, 2.2, 0.03, 0.08 );
		for ( const s of [ - 0.75, 0.75 ] ) {

			K.use( 'rodBlack' ).cyl( Pk, sx + s, sz - 0.1, PY, PY + 2.48, 0.032, 0.032, 8 );
			K.use( 'rodBlack' ).box( Pk, sx + s, PY + 0.008, sz - 0.1, 0.2, 0.016, 0.2 );
			for ( const y of [ PY + 2.0, PY + 2.4 ] ) K.use( 'rodBlack' ).box( Pk, sx + s, y, sz - 0.08, 0.08, 0.04, 0.04 );

		}

	}
	// ---- end FX3

	// (the Kit's mesh is made by the place once everything's in it)
	out.hg = hg;
	return out;

}

// a bar stool: a round seat on a chrome post, a foot ring
export function stool( K, P, x, z, y, h = 0.76 ) {

	// (sides kept few: there are a hundred of them)
	K.use( 'chrome' ).cyl( P, x, z, y, y + h - 0.06, 0.025, 0.025, 5, { top: false } );
	K.use( 'chrome' ).cyl( P, x, z, y, y + 0.02, 0.2, 0.2, 8 );
	K.use( 'chrome' ).cyl( P, x, z, y + 0.3, y + 0.32, 0.17, 0.17, 7, { top: false } );
	K.use( 'redVinyl' ).cyl( P, x, z, y + h - 0.06, y + h, 0.19, 0.18, 10 );

}

// a high-top: a round top on an iron column, two stools (either side, or behind it facing the rail: along)
export function hightop( K, P, x, z, y, { top = 'laminate', stool: st = null, along = false } = {} ) {

	K.use( 'iron' ).cyl( P, x, z, y, y + 1.02, 0.04, 0.04, 6, { top: false } );
	K.use( 'iron' ).cyl( P, x, z, y, y + 0.03, 0.28, 0.28, 10 );
	K.use( top ).cyl( P, x, z, y + 1.02, y + 1.06, 0.38, 0.38, 14, { bottom: true } );
	const at = along ? [ [ x - 0.35, z + 0.55 ], [ x + 0.35, z + 0.55 ] ] : [ [ x - 0.55, z ], [ x + 0.55, z ] ];
	for ( const [ sx, sz ] of at ) {

		if ( st === 'whiteStool' ) whiteStool( K, P, sx, sz, y );
		else stool( K, P, sx, sz, y );

	}

}

// a white molded bar stool with a low back (the patio's)
export function whiteStool( K, P, x, z, y ) {

	for ( const [ i, j ] of [ [ - 1, - 1 ], [ 1, - 1 ], [ 1, 1 ], [ - 1, 1 ] ] ) K.use( 'whiteStool' ).box( P, x + i * 0.15, y + 0.36, z + j * 0.15, 0.03, 0.72, 0.03 );
	K.use( 'whiteStool' ).box( P, x, y + 0.74, z, 0.4, 0.05, 0.4 );
	K.use( 'whiteStool' ).box( P, x, y + 0.9, z + 0.19, 0.4, 0.28, 0.03 );

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

// ---- FX3 (step 11, AD1-9): the back bar in three dimensions. The lit panel behind it (Atlas.js) is the
// mirror now; in front of it, between mahogany pilasters, bays of two glass shelves with a strip of light
// under each front edge, and on them and on the counter the bottles themselves: shaped glass (a shoulder, a
// neck, a cap or foil), coloured as what's in them and lit through by the strips, labelled; the well's
// liter bottles on the counter with their chrome pour spouts; here and there a register, a pyramid of pint
// glasses. Only the half of each bottle that faces the room is built (the mirror's behind them): 39
// triangles a bottle. x0..x1 along the wall at zWall (the board frame's z), the floor at y, the mirror's top
// and height as its panel (the shelves at its painted lines, SHELF_PX)
const GLASS = [ [ 'glassAmber', 0.34 ], [ 'glassClear', 0.2 ], [ 'glassGreen', 0.15 ], [ 'glassBrown', 0.13 ], [ 'glassBlue', 0.07 ], [ 'glassRed', 0.06 ], [ 'glassAmber', 0.05 ] ];
const LABELS = [ 'label', 'label', 'labelBlack', 'white', 'red', 'cream', 'foil', 'navy' ];
const CAPS = [ 'foil', 'black', 'red', 'chrome', 'brass', 'foil', 'black' ];
// a bottle's shape: body radius, height, the body's height, the shoulder's, the neck's radius, the label's
// band (fifth, a tall liqueur, vodka, a squat rum or cognac, the well's liter)
const SHAPES = [
	{ r: 0.041, h: 0.3, hb: 0.19, hs: 0.035, rn: 0.014, l0: 0.06, l1: 0.15 },
	{ r: 0.036, h: 0.34, hb: 0.2, hs: 0.075, rn: 0.012, l0: 0.05, l1: 0.13 },
	{ r: 0.039, h: 0.32, hb: 0.23, hs: 0.025, rn: 0.015, l0: 0.08, l1: 0.17 },
	{ r: 0.05, h: 0.25, hb: 0.13, hs: 0.05, rn: 0.017, l0: 0.035, l1: 0.105 },
];
const LITER = { r: 0.044, h: 0.31, hb: 0.21, hs: 0.04, rn: 0.015, l0: 0.06, l1: 0.16, spout: true };

export function backBar( K, P, x0, x1, zWall, y, top, h, seed = 1 ) {

	let s = seed >>> 0;
	const rnd = () => ( s = ( s * 16807 + 11 ) % 2147483647 ) / 2147483647;
	const pick = ( list ) => {

		let u = rnd();
		for ( const [ k, w ] of list ) if ( ( u -= w ) <= 0 ) return k;
		return list[ 0 ][ 0 ];

	};
	const shelves = SHELF_PX.map( ( px ) => top - px / 256 * h );
	const yc = y + 0.9, PIL = 0.24, BAY = 2.3;
	const n = Math.max( 1, Math.round( ( x1 - x0 - PIL ) / ( BAY + PIL ) ) ), bw = ( x1 - x0 - PIL ) / n - PIL;
	// the pilasters, the cornice over them
	for ( let i = 0; i <= n; i ++ ) K.use( 'mahogany' ).box( P, x0 + PIL / 2 + i * ( bw + PIL ), ( yc + top + 0.06 ) / 2, zWall - 0.17, PIL, top + 0.06 - yc, 0.3 );
	K.use( 'mahogany' ).box( P, ( x0 + x1 ) / 2, top + 0.11, zWall - 0.19, x1 - x0 + 0.06, 0.1, 0.36 );
	K.use( 'brass' ).box( P, ( x0 + x1 ) / 2, top + 0.055, zWall - 0.36, x1 - x0, 0.012, 0.012 );
	// along the counter's back, the strip that lights the first row
	K.use( 'strip' ).box( P, ( x0 + x1 ) / 2, yc + 0.005, zWall - 0.07, x1 - x0 - 0.1, 0.01, 0.02 );
	for ( let i = 0; i < n; i ++ ) {

		const b0 = x0 + PIL + i * ( bw + PIL ), b1 = b0 + bw;
		// the shelves: glass, the strip under each front edge
		for ( const sy of shelves ) {

			K.use( 'shelfGlass' ).box( P, ( b0 + b1 ) / 2, sy - 0.006, zWall - 0.17, bw, 0.012, 0.25 );
			K.use( 'strip' ).box( P, ( b0 + b1 ) / 2, sy - 0.018, zWall - 0.285, bw - 0.04, 0.01, 0.015 );
			row( b0 + 0.05, b1 - 0.05, sy, zWall - 0.17, false );

		}
		// the counter: the well's bottles, or the register, or the pints
		const what = i % 3 === 1 ? 'register' : rnd() < 0.3 ? 'pints' : 'well';
		if ( what === 'register' ) {

			const cx = ( b0 + b1 ) / 2;
			K.use( 'black' ).box( P, cx, yc + 0.06, zWall - 0.32, 0.42, 0.12, 0.38 );
			K.use( 'black' ).box( P, cx, yc + 0.2, zWall - 0.26, 0.05, 0.16, 0.05 );
			K.use( 'screen' ).box( P, cx, yc + 0.32, zWall - 0.29, 0.32, 0.22, 0.03 );
			row( b0 + 0.05, cx - 0.35, yc, zWall - 0.38, true );
			row( cx + 0.35, b1 - 0.05, yc, zWall - 0.38, true );

		} else if ( what === 'pints' ) {

			// upturned pints, stacked in a pyramid on a bar mat
			const cx = b0 + bw * ( 0.3 + 0.4 * rnd() );
			K.use( 'rubber' ).box( P, cx, yc + 0.004, zWall - 0.33, 0.62, 0.008, 0.3 );
			for ( let r = 0; r < 3; r ++ ) for ( let k = 0; k < 4 - r; k ++ ) {

				const gx = cx + ( k - ( 3 - r ) / 2 ) * 0.088, gy = yc + 0.008 + r * 0.145;
				K.use( 'glassClear' ).cyl( P, gx, zWall - 0.33, gy, gy + 0.145, 0.03, 0.043, 7, { top: false } );

			}
			row( b0 + 0.05, cx - 0.4, yc, zWall - 0.38, true );
			row( cx + 0.4, b1 - 0.05, yc, zWall - 0.38, true );

		} else row( b0 + 0.05, b1 - 0.05, yc, zWall - 0.38, true );

	}

	// a row of bottles from xa to xb standing at height yy, their axis at z (the well's: liters, spouts)
	function row( xa, xb, yy, z, well ) {

		let x = xa;
		while ( true ) {

			const S = well && rnd() < 0.75 ? LITER : SHAPES[ Math.floor( rnd() * SHAPES.length ) ];
			const sc = 0.92 + rnd() * 0.16;
			if ( x + S.r * 2 * sc > xb ) break;
			x += S.r * sc;
			// now and then one's gone (poured out, or behind the bar being poured)
			if ( rnd() > 0.06 ) bottle( K, P, x, z + ( rnd() - 0.5 ) * 0.03, yy, S, sc, pick( GLASS ), LABELS[ Math.floor( rnd() * LABELS.length ) ], CAPS[ Math.floor( rnd() * CAPS.length ) ] );
			x += S.r * sc + 0.006 + rnd() * 0.022;

		}

	}

}

// one bottle (its front half, a 3-sided lathe of the shape S scaled sc), standing at ( x, y, z ) in frame P
export function bottle( K, P, x, z, y, S, sc, glass, label, cap ) {

	const r = S.r * sc, h = S.h * sc, hb = S.hb * sc, hs = S.hs * sc, rn = S.rn * sc;
	const hc = S.spout ? h - 0.012 : h - 0.024 * sc;
	const segs = [
		[ 0, S.l0 * sc, r, r, glass ], [ S.l0 * sc, S.l1 * sc, r * 1.004, r * 1.004, label ], [ S.l1 * sc, hb, r, r, glass ],
		[ hb, hb + hs, r, rn, glass ], [ hb + hs, hc, rn, rn, glass ],
		S.spout ? [ hc, h + 0.035, rn * 0.9, 0.004, 'chrome' ] : [ hc, h, rn * 1.25, rn * 1.2, cap ],
	];
	const N = 3, ring = ( t, rr, yy, slope ) => [ P( x + Math.cos( t ) * rr, y + yy, z + Math.sin( t ) * rr ), P.dir( Math.cos( t ), slope, Math.sin( t ) ) ];
	for ( const [ ya, yb, ra, rb, pal ] of segs ) {

		K.use( pal );
		const slope = ( ra - rb ) / ( yb - ya || 1 );
		for ( let k = 0; k < N; k ++ ) {

			const ta = Math.PI + k * Math.PI / N, tb = Math.PI + ( k + 1 ) * Math.PI / N;
			const [ a, na ] = ring( ta, ra, ya, slope ), [ b, nb ] = ring( tb, ra, ya, slope ), [ c, nc ] = ring( tb, rb, yb, slope ), [ d, nd ] = ring( ta, rb, yb, slope );
			K.tri( a, b, c, na, nb, nc );
			K.tri( a, c, d, na, nc, nd );

		}

	}
	// the cap's top
	const [ , , , rt, pt ] = segs[ segs.length - 1 ];
	K.use( pt );
	const yt = segs[ segs.length - 1 ][ 1 ];
	for ( let k = 0; k < N; k ++ ) {

		const ta = Math.PI + k * Math.PI / N, tb = Math.PI + ( k + 1 ) * Math.PI / N;
		K.tri( P( x, y + yt, z ), ring( tb, rt, yt, 0 )[ 0 ], ring( ta, rt, yt, 0 )[ 0 ], [ 0, 1, 0 ], [ 0, 1, 0 ], [ 0, 1, 0 ] );

	}

}
// ---- end FX3

// a patio heater: a steel post on a round base, the burner and its reflector hood up top (lit at night:
// the glow under the hood)
export function heater( K, P, x, z, y ) {

	K.use( 'steel' ).cyl( P, x, z, y, y + 0.08, 0.3, 0.3, 12 );
	K.use( 'steel' ).cyl( P, x, z, y + 0.08, y + 0.7, 0.2, 0.18, 12 );
	K.use( 'steel' ).cyl( P, x, z, y + 0.7, y + 2.05, 0.035, 0.035, 8, { top: false } );
	K.use( 'flame' ).cyl( P, x, z, y + 2.05, y + 2.3, 0.1, 0.1, 10, { top: false } );
	K.use( 'steel' ).cyl( P, x, z, y + 2.3, y + 2.42, 0.85, 0.2, 16, { top: true, bottom: true } );

}
