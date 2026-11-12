import { Mesh, Vector3, Color } from '../../../engine/index.js';
import { Quads } from '../../Stands.js';
import { Pal, hidDome, pipe, obox } from '../../ConcourseSteel.js';
import { offsetPolyline } from '../../Bowl.js';
import { courtSigns, SIGN_CELLS } from './Gate.js'; // (FK3 repair: the posters)

// FK3 (step 12, SC1-7): the Pavilion's walkway (behind 201-211, a storey and a half over the Alley) fitted
// out where the October 2008 guide puts things: Brewerytown "behind Sections 204, 209", Old City Creamery
// "205", the South Philadelphia Market "206", Fairmount Fries "208", Hatfield Grill "209", and the family
// restrooms "Pavilion, behind Sections 205 and 208" (phillies.com, the concessions guide and the A-Z
// convenience guide as archived in October 2008). FW3's walkway (Concourse.galleries) fits its units only
// on the straight runs: round the pole the wall's five 8.6-9.6 m panels took none, so 205-208 were 60 m of
// blank, unlit block and the guide's stands crowded onto the straight run by the Alley (the Creamery and
// the Market at 203). Here the walkway is laid out again, the curve's panels taking a unit each, with the
// main concourse's own units (Concourse's stand kit: its _foodUnit and _pairUnit, into the same materials)
// and the stands' staff and lines (the gallery spots terrace/People.js serves). Over it, the main
// concourse's HID domes hung from the Deck's underside every ~9 m (ConcourseSteel's), lit as local lights
// near the camera (the walkway was lit by spill only). Field frame, into the Terrace place's group (where
// FW3's were). (FK3 repair: each stand's bay closed in behind the wall, where it hung out of the
// Pavilion's back; posters in the plain bays' frames; past the Deck's end a dome on an arm off the wall.)
//
//   pavilionWalkway( app, bowl, group, gallery ) -> { lamps, lightUp( app ) } | null   (places/Terrace.js,
//   after galleries; lightUp from AshburnAlley2008's update)

// as Concourse's units: a unit's width, the gap between two, the block's height over the floor
const UNIT = 7.5, GAP = 1.2, H = 4.2;
// what the stand kit reads of a stand (Concourse's FOOD: its kitchen, its blade sign)
const FOOD = { brewerytown: { kitchen: 4, blade: true }, hatfield: { kitchen: 0, blade: true }, creamery: { kitchen: 3 }, market: { kitchen: 1 }, fries: { kitchen: 0 } };
// the 2008 guide's, in the order they claim the nearest free unit; then FW3's restrooms behind 202 and its
// second Market (the guide's men's and women's rooms aren't by section)
const PLAN = [
	[ 'brewerytown', 204 ], [ 'creamery', 205 ], [ 'market', 206 ], [ [ 'family', 'women' ], 205 ], [ 'fries', 208 ],
	[ [ 'men', 'family' ], 208 ], [ 'brewerytown', 209 ], [ 'hatfield', 209 ], [ [ 'women', 'men' ], 202 ], [ 'market', 210 ],
];
const FIRST = 201, COUNT = 11;

export function pavilionWalkway( app, bowl, group, gallery ) {

	const C = app?.concourse, t = bowl?.upper?.find( ( u ) => u.name === 'pavilion' );
	const deck = bowl?.upper?.find( ( u ) => u.name === 'pavilion-deck' );
	if ( ! C?._foodUnit || ! C._pairUnit || ! C.signLayout || ! C.standMats || ! C.props || ! t ) return null;
	// FW3's walkway out (its meshes are named for the tier), its materials kept
	const old = group.children.filter( ( o ) => o.isMesh && o.name.startsWith( 'pavilion-' ) );
	const mat = ( n ) => old.find( ( o ) => o.name === 'pavilion-' + n )?.material;
	const TM = { precast: mat( 'concession-stands' ), bayMat: mat( 'concession-bays' ) };
	if ( ! TM.precast || ! TM.bayMat ) return null;
	for ( const o of old ) group.remove( o );
	for ( let i = gallery.length - 1; i >= 0; i -- ) if ( gallery[ i ].tier === 'pavilion' ) gallery.splice( i, 1 );

	const y = t.y0 + ( t.rows - 1 ) * t.rise + 0.25, hW = 4.35;
	const G = offsetPolyline( t.front, t.rows * t.depth + 4 - 0.03, [ 0, - 40 ] );
	let total = 0;
	for ( let i = 0; i < G.length - 1; i ++ ) total += Math.hypot( G[ i + 1 ][ 0 ] - G[ i ][ 0 ], G[ i + 1 ][ 1 ] - G[ i ][ 1 ] );
	// the units along each panel of the wall: FW3's spacing on the long runs, and one on a panel that has
	// room for it and half a metre of block each side (the curve's)
	const slots = [], walls = [];
	let s0 = 0;
	for ( let i = 0; i < G.length - 1; i ++ ) {

		const [ ax, az ] = G[ i ], [ bx, bz ] = G[ i + 1 ];
		const len = Math.hypot( bx - ax, bz - az );
		if ( len < 0.05 ) continue;
		const ux = ( bx - ax ) / len, uz = ( bz - az ) / len;
		let nx = - uz, nz = ux;
		if ( nx * ( - ax ) + nz * ( - 40 - az ) < 0 ) {

			nx = - nx; nz = - nz;

		}

		const a = ( ux * nz - uz * nx ) > 0 ? [ ux, uz ] : [ - ux, - uz ];
		const n = Math.max( Math.floor( ( len - GAP ) / ( UNIT + GAP ) ), len >= UNIT + 1.0 ? 1 : 0 );
		const pad = ( len - n * ( UNIT + GAP ) + GAP ) / 2;
		let w0 = 0;
		for ( let j = 0; j < n; j ++ ) {

			const s = pad + j * ( UNIT + GAP ) + UNIT / 2;
			slots.push( { mid: [ ax + ux * s, az + uz * s ], n: [ nx, nz ], a, sec: Math.min( FIRST + COUNT - 1, FIRST + Math.floor( ( s0 + s ) / total * COUNT ) ) } );
			walls.push( { ax, az, ux, uz, nx, nz, t0: w0, t1: s - UNIT / 2 } );
			w0 = s + UNIT / 2;

		}

		walls.push( { ax, az, ux, uz, nx, nz, t0: w0, t1: len } );
		s0 += len;

	}

	for ( const [ what, sec ] of PLAN ) {

		let best = null;
		for ( const U of slots ) if ( ! U.what && ( ! best || Math.abs( U.sec - sec ) < Math.abs( best.sec - sec ) ) ) best = U;
		if ( best ) best.what = what;

	}

	const M = C.standMats, L = C.signLayout;
	const Q = { body: new Quads(), face: new Quads(), glow: new Quads(), kick: new Quads(), lights: new Quads(), props: new C.props.constructor(), bay: new Quads() };
	const posters = new Quads();
	let nPlain = 0;
	// (the kit leaves its stands' spots and doors on the concourse: as galleries(), kept aside)
	const keep = [ C.standSpots, C.doors ];
	let spots = [];
	C.standSpots = [];
	C.doors = [];
	try {

		for ( const U of slots ) {

			const P = frame( U.mid, U.a, U.n, y );
			if ( typeof U.what === 'string' ) C._foodUnit( U, P, FOOD[ U.what ], L, Q );
			else if ( U.what ) C._pairUnit( U, P, L, Q );
			else {

				// a plain bay: the block, a steel service door, a poster frame (as galleries())
				fwd( Q.body, P, U.n, - UNIT / 2, - 0.6, 0, H, 0 );
				fwd( Q.body, P, U.n, 0.6, UNIT / 2, 0, H, 0 );
				fwd( Q.body, P, U.n, - 0.6, 0.6, 2.2, H, 0 );
				lbox( Q.props.use( 'grey' ), P, U.a, U.n, 0, 1.1, - 0.02, 1.2, 2.2, 0.04 );
				lbox( Q.props.use( 'steel' ), P, U.a, U.n, 0.42, 1.05, 0.01, 0.12, 0.03, 0.04 );
				lbox( Q.props.use( 'black' ), P, U.a, U.n, - 2.2, 1.7, 0.02, 1.0, 1.4, 0.03 );
				// ---- FK3 repair: a poster in the frame, a 5 cm black border round it (it was an empty black
				// void), the club's that October in turn (the court's atlas: alley/Gate.js)
				const r = SIGN_CELLS.posters[ nPlain ++ % SIGN_CELLS.posters.length ];
				fwd( posters, P, U.n, - 2.65, - 1.75, 1.05, 2.35, 0.04, r );
				// ---- end FK3 repair

			}

			// ---- FK3 repair: a stand's bay and a restroom's vestibule go 1.3 and 1.6 m in behind the wall, and
			// on the Pavilion there's no building behind it: they hung out of its back over the Right Field
			// Gate's court and the passage, lit white boxes, open below (the tubes and the staff seen from the
			// court). Each closed in block: its back, its ends, its underside and a roof, and a floor in it at the
			// walkway's level (the staff stand on it)
			if ( U.what ) {

				const xs = UNIT / 2 - 0.1, zb = - 1.75, yb = - 0.3, N = [ U.n[ 0 ], 0, U.n[ 1 ] ], A = [ U.a[ 0 ], 0, U.a[ 1 ] ];
				Q.body.add( P( xs, yb, zb ), P( - xs, yb, zb ), P( - xs, hW, zb ), P( xs, hW, zb ), N.map( ( v ) => - v ) );
				for ( const s of [ - 1, 1 ] ) Q.body.add( P( s * xs, yb, 0 ), P( s * xs, yb, zb ), P( s * xs, hW, zb ), P( s * xs, hW, 0 ), A.map( ( v ) => v * s ) );
				Q.body.add( P( - xs, yb, 0 ), P( xs, yb, 0 ), P( xs, yb, zb ), P( - xs, yb, zb ), [ 0, - 1, 0 ] );
				Q.body.add( P( - xs, hW, zb ), P( xs, hW, zb ), P( xs, hW, 0 ), P( - xs, hW, 0 ), [ 0, 1, 0 ] );
				Q.body.add( P( - xs, 0.005, zb ), P( xs, 0.005, zb ), P( xs, 0.005, 0 ), P( - xs, 0.005, 0 ), [ 0, 1, 0 ] );
				Q.body.add( P( - xs, yb, 0 ), P( xs, yb, 0 ), P( xs, 0, 0 ), P( - xs, 0, 0 ), N );

			}
			// ---- end FK3 repair

			// the wall over it up to the deck's precast, a dark coping
			fwd( Q.body, P, U.n, - UNIT / 2, UNIT / 2, H, hW, 0 );
			lbox( Q.props.use( 'grey' ), P, U.a, U.n, 0, H + 0.04, 0.02, UNIT + 0.1, 0.08, 0.16 );

		}

	} finally {

		spots = C.standSpots.map( ( st ) => ( { ...st, y, tier: 'pavilion' } ) );
		[ C.standSpots, C.doors ] = keep;

	}

	// the block between them, floor to the precast
	for ( const w of walls ) {

		if ( w.t1 - w.t0 < 0.02 ) continue;
		const A0 = [ w.ax + w.ux * w.t0, y, w.az + w.uz * w.t0 ], A1 = [ w.ax + w.ux * w.t1, y, w.az + w.uz * w.t1 ];
		Q.body.add( A0, A1, [ A1[ 0 ], y + hW, A1[ 2 ] ], [ A0[ 0 ], y + hW, A0[ 2 ] ], [ w.nx, 0, w.nz ] );

	}

	for ( const [ q, m, nm ] of [ [ Q.body, TM.precast, 'concession-stands' ], [ Q.bay, TM.bayMat, 'concession-bays' ], [ Q.face, M.signMat, 'concession-signs' ], [ Q.kick, M.kickMat, 'concession-kicks' ],
		[ Q.lights, M.lightMat, 'concession-lights' ], [ Q.glow, M.kitchen, 'concession-rooms' ], [ Q.props, M.propMat, 'concourse-props' ] ] ) {

		if ( ! q.count ) continue;
		const mesh = new Mesh( q.geometry(), m );
		mesh.name = 'pavilion-' + nm;
		mesh.receiveShadow = true;
		group.add( mesh );

	}

	gallery.push( ...spots );
	// ---- FK3 repair: the plain bays' posters, in the court's signs' material (no pipeline of their own)
	if ( posters.count ) {

		const pm = new Mesh( posters.geometry(), courtSigns() );
		pm.name = 'pavilion-posters';
		pm.receiveShadow = true;
		group.add( pm );

	}
	// ---- end FK3 repair

	// the domes, down the walkway's middle every ~9 m, hung from the Deck's underside
	const lamps = [];
	const steel = C.steel?.material;
	if ( deck && steel ) {

		const D = offsetPolyline( t.front, t.rows * t.depth + 2.0, [ 0, - 40 ] );
		const q = new Pal();
		let acc = 4.5;
		for ( let i = 0; i < D.length - 1; i ++ ) {

			const [ ax, az ] = D[ i ], [ bx, bz ] = D[ i + 1 ], len = Math.hypot( bx - ax, bz - az );
			for ( ; acc < len; acc += 9.0 ) {

				const x = ax + ( bx - ax ) * acc / len, z = az + ( bz - az ) * acc / len;
				const top = soffit( deck, x, z );
				if ( top === null ) {

					// ---- FK3 repair: past the Deck's end (it stops short of The Break) nothing is overhead: the dome
					// on an arm off the back wall over the stands (its conduit went up 4.5 m to a Deck that isn't
					// there), a strut under the arm
					let nx = - ( bz - az ) / len, nz = ( bx - ax ) / len;
					if ( nx * ( - ax ) + nz * ( - 40 - az ) > 0 ) {

						nx = - nx; nz = - nz;

					}
					const yl = y + 5.2, ya = yl + 0.95, out = 1.97 - 0.06, wx = x + nx * out, wz = z + nz * out;
					hidDome( q, x, yl, z, ya );
					q.use( 'conduit' );
					pipe( q, [ x, ya, z ], [ wx, ya, wz ], 0.035, 6 );
					pipe( q, [ wx, ya - 0.75, wz ], [ x + nx * out * 0.45, ya - 0.02, z + nz * out * 0.45 ], 0.025, 6 );
					q.use( 'trim' );
					obox( q, [ wx + nx * 0.02, ya - 0.3, wz + nz * 0.02 ], [ nx, 0, nz ], 0.02, [ 0, 1, 0 ], 0.5, [ - nz, 0, nx ], 0.1 );
					lamps.push( [ x, yl - 0.05, z ] );
					continue;
					// ---- end FK3 repair

				}
				if ( top < y + 4.6 ) continue;
				const yl = Math.min( y + 5.2, top - 0.9 );
				hidDome( q, x, yl, z, top );
				lamps.push( [ x, yl - 0.05, z ] );

			}

			acc -= len;

		}

		if ( q.count ) {

			const mesh = new Mesh( q.geometry(), steel );
			mesh.name = 'pavilion-walkway-domes';
			mesh.receiveShadow = true;
			group.add( mesh );

		}

	}

	// the domes as local lights, once the app has made them (AshburnAlley2008's update calls it). (FK3 repair:
	// as the Terrace's own domes, FW3's, a third of the main concourse's: they hang 5 m over this floor, not
	// 7, and at full strength the Terrace's floor "came out white", Terrace.update)
	let lit = false;
	const lightUp = ( a ) => {

		if ( lit || ! a?.localLights ) return;
		lit = true;
		const F = a.field;
		for ( const [ x, yy, z ] of lamps ) {

			const w = F.toWorld( x, z );
			a.localLights.add( { position: new Vector3( w.x, F.y0 + yy, w.z ), dir: new Vector3( 0, - 1, 0 ), color: new Color( 1.0, 0.92, 0.8 ), intensity: 16, range: 12,
				cosInner: Math.cos( 0.9 ), cosOuter: Math.cos( 1.75 ), kind: 'dome' } );

		}

	};
	return { lamps, lightUp };

}

// the Deck's underside over ( x, z ): the tier's soffit at its front, rising with its rows; (FK3 repair) null
// past either of its ends, where nothing is overhead (it clamped to the end and gave a height regardless)
function soffit( t, x, z ) {

	let best = Infinity, off = false;
	const P = t.front, last = P.length - 2;
	for ( let i = 0; i <= last; i ++ ) {

		const [ ax, az ] = P[ i ], [ bx, bz ] = P[ i + 1 ], dx = bx - ax, dz = bz - az;
		const raw = ( ( x - ax ) * dx + ( z - az ) * dz ) / ( dx * dx + dz * dz || 1 ), u = Math.max( 0, Math.min( 1, raw ) );
		const d = Math.hypot( ax + dx * u - x, az + dz * u - z );
		if ( d < best ) {

			best = d;
			off = ( i === 0 && raw < 0 ) || ( i === last && raw > 1 );

		}

	}

	if ( off ) return null;
	return t.y0 - t.soffit + Math.min( best, t.rows * t.depth ) * ( ( t.rows - 1 ) * t.rise ) / ( t.rows * t.depth );

}

// Concourse's frame, box and facing quad (its stand kit draws with the same): a frame on the ground plane
// at o ([ x, z ]), a the right, n the forward; P( x, y, z ) right x, up y (over y0), forward z
function frame( o, a, n, y0 ) {

	return ( x, yy, z ) => [ o[ 0 ] + a[ 0 ] * x + n[ 0 ] * z, y0 + yy, o[ 1 ] + a[ 1 ] * x + n[ 1 ] * z ];

}

function lbox( q, P, a, n, x, y, z, sx, sy, sz ) {

	const X = [ a[ 0 ], 0, a[ 1 ] ], Z = [ n[ 0 ], 0, n[ 1 ] ];
	const c = ( i, j, k ) => P( x + i * sx / 2, y + j * sy / 2, z + k * sz / 2 );
	q.add( c( - 1, - 1, 1 ), c( 1, - 1, 1 ), c( 1, 1, 1 ), c( - 1, 1, 1 ), Z );
	q.add( c( 1, - 1, - 1 ), c( - 1, - 1, - 1 ), c( - 1, 1, - 1 ), c( 1, 1, - 1 ), Z.map( ( v ) => - v ) );
	q.add( c( 1, - 1, 1 ), c( 1, - 1, - 1 ), c( 1, 1, - 1 ), c( 1, 1, 1 ), X );
	q.add( c( - 1, - 1, - 1 ), c( - 1, - 1, 1 ), c( - 1, 1, 1 ), c( - 1, 1, - 1 ), X.map( ( v ) => - v ) );
	q.add( c( - 1, 1, 1 ), c( 1, 1, 1 ), c( 1, 1, - 1 ), c( - 1, 1, - 1 ), [ 0, 1, 0 ] );
	q.add( c( - 1, - 1, - 1 ), c( 1, - 1, - 1 ), c( 1, - 1, 1 ), c( - 1, - 1, 1 ), [ 0, - 1, 0 ] );

}

function fwd( q, P, n, x0, x1, y0, y1, z, uv = [ x0, y1, x1, y0 ] ) {

	const [ uL, vT, uR, vB ] = uv, N = [ n[ 0 ], 0, n[ 1 ] ];
	q.tri( P( x0, y0, z ), P( x1, y0, z ), P( x1, y1, z ), N, [ uL, vB ], [ uR, vB ], [ uR, vT ] );
	q.tri( P( x0, y0, z ), P( x1, y1, z ), P( x0, y1, z ), N, [ uL, vB ], [ uR, vT ], [ uL, vT ] );

}
