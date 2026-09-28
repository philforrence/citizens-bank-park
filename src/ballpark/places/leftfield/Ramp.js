import { Mesh, Color } from '../../../engine/index.js';
import { standard } from '../../../materials/Materials.js';
import { commonModule } from '../../../engine/render/wgsl/common.js';
import { Quads } from '../../Stands.js';
import { LEVELS } from '../../layout.js';
import { beam } from '../../geo.js';

// The Left Field ramp (LeftField.js): the open steel switchback behind the left field corner, from the
// street up past the suite level and the club to the terrace (the Phillies' ballpark guide: 'Left Field
// Ramp - adjacent to the Left Field Gate providing access to the Suite Level, Hall of Fame Club, Arcade
// seating and Terrace Level'). From home plate it filled the gap left of the scoreboard (April 2008: img
// lf1, lfline, lfjumbo; the World Series nights: its lamps and the Gulf disc lit): maroon wide-flange
// columns and girders, the runs about 3 m wide climbing at 1 in 12 round 180-degree landings, silver pipe
// rails, lamps under each run, light poles on top. Round 1 left a blank brick wedge and sky there.
//
// Built in the field frame on the corner's plaza, its runs along z; returns the walkers' path (up and
// down) and where the signs are.
const STREET = LEVELS.mainConcourse, TOP = LEVELS.terraceConcourse;

export function buildRamp( place, K ) {

	// two lanes side by side (x), runs along z between the landings
	const X0 = - 125.2, LANE = 3.0, GAP = 0.6, Z0 = - 64, Z1 = - 96, LAND = 3.6;
	const lanes = [ X0, X0 + LANE + GAP ];
	const zA = Z0 - LAND, zB = Z1 + LAND; // the runs between the landings
	const nRuns = 8, rise = ( TOP - STREET ) / nRuns;
	const q = new Quads(), steel = new Quads(), rail = new Quads();
	const runs = [];
	for ( let k = 0; k < nRuns; k ++ ) {

		const lane = lanes[ k % 2 ], y0 = STREET + k * rise, y1 = y0 + rise;
		// the odd runs go out (-z), the even back (+z)
		const [ za, zb ] = k % 2 ? [ zB, zA ] : [ zA, zB ];
		runs.push( { lane, y0, y1, za, zb } );
		const x0 = lane, x1 = lane + LANE;
		// the deck: its top, its underside, its edges
		q.add( [ x0, y0, za ], [ x1, y0, za ], [ x1, y1, zb ], [ x0, y1, zb ], [ 0, 1, 0 ] );
		q.add( [ x1, y0 - 0.25, za ], [ x0, y0 - 0.25, za ], [ x0, y1 - 0.25, zb ], [ x1, y1 - 0.25, zb ], [ 0, - 1, 0 ] );
		for ( const x of [ x0, x1 ] ) q.add( [ x, y0 - 0.25, za ], [ x, y1 - 0.25, zb ], [ x, y1, zb ], [ x, y0, za ], [ x === x0 ? - 1 : 1, 0, 0 ] );
		// the girders under its edges, deep
		for ( const x of [ x0 + 0.15, x1 - 0.15 ] ) beam( steel, [ x, y0 - 0.55, za ], [ x, y1 - 0.55, zb ], 0.5 );
		// the rails: posts every 1.8 m, the top rail, the mid rail, and pickets (the outer edge; the inner
		// edge only where the other lane isn't beside it)
		for ( const x of [ x0 + 0.05, x1 - 0.05 ] ) {

			const L = Math.abs( zb - za ), n = Math.round( L / 1.8 );
			for ( let i = 0; i <= n; i ++ ) {

				const z = za + ( zb - za ) * i / n, y = y0 + ( y1 - y0 ) * i / n;
				beam( rail, [ x, y, z ], [ x, y + 1.07, z ], 0.05 );

			}

			beam( rail, [ x, y0 + 1.07, za ], [ x, y1 + 1.07, zb ], 0.05 );
			beam( rail, [ x, y0 + 0.55, za ], [ x, y1 + 0.55, zb ], 0.03 );

		}

	}

	// the landings at both ends of each level, as wide as both lanes
	const W = 2 * LANE + GAP;
	for ( let k = 0; k <= nRuns; k ++ ) {

		const y = STREET + k * rise;
		if ( k === 0 ) continue;
		const z0 = k % 2 ? zB : zA;
		const zz = k % 2 ? [ z0 - LAND, z0 ] : [ z0, z0 + LAND ];
		q.add( [ X0, y, zz[ 0 ] ], [ X0 + W, y, zz[ 0 ] ], [ X0 + W, y, zz[ 1 ] ], [ X0, y, zz[ 1 ] ], [ 0, 1, 0 ] );
		q.add( [ X0 + W, y - 0.25, zz[ 0 ] ], [ X0, y - 0.25, zz[ 0 ] ], [ X0, y - 0.25, zz[ 1 ] ], [ X0 + W, y - 0.25, zz[ 1 ] ], [ 0, - 1, 0 ] );
		// the landing's rail round its open end
		const ze = k % 2 ? zz[ 0 ] : zz[ 1 ];
		beam( rail, [ X0, y + 1.07, ze ], [ X0 + W, y + 1.07, ze ], 0.05 );
		for ( let x = X0; x <= X0 + W + 1e-3; x += W / 4 ) beam( rail, [ x, y, ze ], [ x, y + 1.07, ze ], 0.05 );
		beam( steel, [ X0, y - 0.55, ze ], [ X0 + W, y - 0.55, ze ], 0.5 );

	}

	// the columns: wide-flange posts on a 9 m grid at the lanes' outer edges and between them, street to
	// the top landing
	for ( const x of [ X0 - 0.2, X0 + LANE + GAP / 2, X0 + W + 0.2 ] ) for ( let z = Z0; z >= Z1 - 0.01; z -= ( Z0 - Z1 ) / 4 ) beam( steel, [ x, STREET, z ], [ x, TOP + 1.2, z ], 0.45 );
	// cross-bracing on the outer face (the X in each bay, as the photos show against the sky)
	for ( let b = 0; b < 4; b ++ ) {

		const za = Z0 - b * ( Z0 - Z1 ) / 4, zb = Z0 - ( b + 1 ) * ( Z0 - Z1 ) / 4;
		for ( let lv = 0; lv < 3; lv ++ ) {

			const ya = STREET + lv * ( TOP - STREET ) / 3, yb = ya + ( TOP - STREET ) / 3;
			beam( steel, [ X0 - 0.2, ya, za ], [ X0 - 0.2, yb, zb ], 0.22 );
			beam( steel, [ X0 - 0.2, ya, zb ], [ X0 - 0.2, yb, za ], 0.22 );

		}

	}

	// the light poles on top, and a lamp under each run
	const lamps = [];
	for ( const z of [ Z0 - 2, ( Z0 + Z1 ) / 2, Z1 + 2 ] ) {

		beam( steel, [ X0 + W + 0.2, TOP, z ], [ X0 + W + 0.2, TOP + 9, z ], 0.25 );
		lamps.push( [ X0 + W - 0.4, TOP + 9, z ] );

	}

	for ( const r of runs ) for ( let i = 1; i < 4; i ++ ) {

		const f = i / 4;
		lamps.push( [ r.lane + LANE / 2, r.y0 + ( r.y1 - r.y0 ) * f - 0.45, r.za + ( r.zb - r.za ) * f ] );

	}

	const I = ( a, b, c ) => [ a, b, c ];
	I.dir = I;
	for ( const [ x, y, z ] of lamps ) K.use( 'lamp' ).box( I, x, y, z, 0.5, 0.18, 0.5 );
	// the Gulf disc on the top landing's rail, facing home, and the BUBBA burger boxes on the ramp's
	// field-side face (lit at night)
	const face = [ 0.71, 0, 0.71 ];
	const right = [ 0.71, 0, - 0.71 ];
	const gulfAt = [ X0 + W + 0.5, TOP + 2.2, Z0 - 6 ];
	K.panelAt( [ gulfAt[ 0 ] - right[ 0 ] * 1.75, gulfAt[ 1 ] - 1.75, gulfAt[ 2 ] - right[ 2 ] * 1.75 ], right, [ 0, 1, 0 ], 3.5, 3.5, face, 'gulf' );
	beam( steel, [ gulfAt[ 0 ] + 0.3, TOP, gulfAt[ 2 ] + 0.3 ], [ gulfAt[ 0 ] + 0.3, gulfAt[ 1 ], gulfAt[ 2 ] + 0.3 ], 0.2 );
	for ( const [ y, z ] of [ [ STREET + 3 * rise + 1.4, - 72 ], [ STREET + 5 * rise + 1.4, - 86 ] ] ) {

		K.panelAt( [ X0 + W + 0.35, y, z + 1.5 ], [ 0, 0, - 1 ], [ 0, 1, 0 ], 3.0, 0.75, [ 1, 0, 0 ], 'bubba' );

	}

	const mat = standard( { name: 'lf-ramp-deck', color: new Color( 0.3, 0.29, 0.27 ), roughness: 0.9, modules: [ commonModule ],
		surface: 's.albedo = mat.color * ( 0.85 + 0.15 * mx_noise_float2( in.P.xz * 0.8 ) ); if ( in.N.y < -0.5 ) { s.albedo = vec3f( 0.1, 0.03, 0.03 ); }' } );
	mat.underwaterLighting = 'none';
	const steelMat = place.app?.landmarks?.steel || standard( { name: 'landmark-steel', color: new Color( 0.12, 0.03, 0.03 ), roughness: 0.6, metalness: 0.4 } );
	const railMat = standard( { name: 'lf-ramp-rail', color: new Color( 0.62, 0.63, 0.64 ), roughness: 0.3, metalness: 0.8 } );
	railMat.underwaterLighting = 'none';
	for ( const [ quads, m, name, shadow ] of [ [ q, mat, 'lf-ramp', true ], [ steel, steelMat, 'lf-ramp-steel', false ], [ rail, railMat, 'lf-ramp-rails', false ] ] ) {

		const mesh = new Mesh( quads.geometry(), m );
		mesh.name = name;
		mesh.castShadow = shadow;
		mesh.receiveShadow = true;
		place.group.add( mesh );

	}

	return { runs, lanes, LANE, X0, Z0, Z1, W, rise, lamps };

}
