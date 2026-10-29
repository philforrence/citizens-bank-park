// Walkability audit (step 10, WA1): a flood fill of the walker over the whole park, on the CPU.
//
//   node test/walk-audit.mjs job > job.json          the desk job that dumps the page's colliders
//   node tools/gpu/desk.mjs shoot job.json > dump.json
//   node test/walk-audit.mjs analyze dump.json outDir  the fill: maps (PNG) and a summary (JSON)
//
// The page's js (test/walk-audit-dump.js) returns what the walker's rules read: the colliders' boxes and
// cylinders (src/world/Colliders.js), the pit and the field's own heights (the walker's ground), the
// seated fans' grid (BallparkApp._pushFromFans), the elevators and every E interactable, and 800 random
// queries answered by the page (checked here first: the copy must agree). The fill runs here, on the same
// data with the same code (the Colliders class itself; the fans' push and the ground copied from
// BallparkApp and Bowl), so the GPU lock is held only for the dump (a second or two, full park).
//
// The walker (src/ballpark/Walker.js): a capsule 0.3 m round and 1.75 m tall on the higher of the ground
// and the walkable boxes under maxY = feet + STEP + 0.05; it steps up to STEP 0.62, steps down as far,
// and falls off anything deeper; solid boxes push it out unless their top is within STEP of its feet;
// the seated fans push it to 0.55 m. Here it moves cell to cell (a 0.5 m grid in the field frame, at
// every floor height) in 0.1 m steps, resolving the capsule and the fans at each, as it does per frame;
// the elevators ride from any cell within their E reach. A second fill lets it jump (Space) where walking
// is stopped. Every fall the fill finds is then walked across by the walker's own update (walkSim, 60 Hz):
// a fall the walker doesn't take is a sliver it steps over (it drops through only standing on it).
// The standing people (Walker._pushFromPeople) aren't in it: they move and make way.
//
// It writes: level-0..5.png (each floor band: reached green, lighter higher; walkable but never reached
// orange; seat rows among the fans blue; inside a wall dark; falls red; lifts by the ground magenta; only
// with jumps yellow; the elevators' stops cyan; the footprint white, the pit grey, the field green),
// zoom-*.png (close-ups with the colliders: floors grey, walls red), all-levels.png (the highest floor
// reached in each cell, by height), summary.json (per tag, the unreached clusters, the falls, the holes,
// the jumps, the elevators) and nodes.json (every reached cell with its parent: paths to anywhere).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join } from 'node:path';
import { Colliders } from '../src/world/Colliders.js';
import { FOOTPRINT, LEVELS, fieldBoundary } from '../src/ballpark/layout.js';
import { GATES } from '../src/ballpark/Exterior.js';

const STEP = 0.62, RADIUS = 0.3, HEIGHT = 1.75;
// the jump's peak as the walker integrates it at 60 Hz (velocity first, then position): 1.04 m, not the
// 1.08 of v^2 / 2g
const JUMP = ( () => {

	let v = 4.6, y = 0;
	while ( v > 0 ) {

		v -= 9.81 / 60; if ( v > 0 ) y += v / 60;

	}
	return y;

} )();
// (FA3, WA1-7) in the air the walker steps onto nothing: a box is a wall unless its top is within 2 cm of
// its feet (or under where they were, coming down)
const AIR_STEP = 0.02;
// WA_OLD=1: the walker's rules before FA3 (the walk's step in the air, the ground lifting it out of the
// pit, the fans only within 0.7 m below), for a before / after on the same fill
const OLD = !! process.env.WA_OLD;
const FAN_DY = OLD ? - 0.7 : - 1.2;
const STREET = LEVELS.mainConcourse;
const START = { at: [ - 112, 78 ], look: GATES[ 0 ].at };
const CELL = 0.5, X0 = - 178, X1 = 188, Z0 = - 208, Z1 = 142;
const NX = Math.round( ( X1 - X0 ) / CELL ), NZ = Math.round( ( Z1 - Z0 ) / CELL );

const DUMP = readFileSync( new URL( './walk-audit-dump.js', import.meta.url ), 'utf8' );
// (FA1, step 10: the E interactables come bank by bank, stop by stop: which bank and stop each is, for banks of
// any size; the outfield's banks have two stops)
let ELEV_AT = [];

const [ cmd, dumpPath, outDir ] = process.argv.slice( 2 );
if ( cmd === 'job' ) {

	console.log( JSON.stringify( { owner: 'walk audit (dump)', params: '', shots: [ { name: 'walk-dump', frames: 2, js: DUMP } ] } ) );
	process.exit( 0 );

}
if ( cmd !== 'analyze' || ! dumpPath ) {

	console.log( 'usage: node test/walk-audit.mjs job | analyze dump.json outDir' );
	process.exit( 1 );

}

const res = JSON.parse( readFileSync( dumpPath, 'utf8' ) );
const D = res.values ? Object.values( res.values ).find( ( v ) => v && v.boxes ) : res;
ELEV_AT = D.elev.flatMap( ( b, bank ) => b.map( ( _, i ) => [ bank, i ] ) );
const OUT = outDir || '.';
mkdirSync( OUT, { recursive: true } );
const t0 = Date.now();

// ---------------------------------------------------------------- the frames
const { cos, sin, y0: FY0 } = D.field;
const toWorld = ( x, z ) => [ x * cos + z * sin, - x * sin + z * cos ];
const toField = ( x, z ) => [ x * cos - z * sin, x * sin + z * cos ];

// ---------------------------------------------------------------- the colliders, in a 4 m hash
const C = new Colliders();
const V = ( x, y, z ) => ( { x, y, z, clone() { return V( this.x, this.y, this.z ); } } );
const tagOf = [];
for ( let i = 0; i < D.boxes.length; i += 9 ) {

	const [ cx, cy, cz, hx, hy, hz, rot, f, t ] = D.boxes.slice( i, i + 9 );
	const b = C.addBox( V( cx, cy, cz ), V( hx, hy, hz ), rot, { walkable: !! ( f & 1 ), solid: !! ( f & 2 ), tag: D.tags[ t ] } );
	b.id = tagOf.length;
	tagOf.push( D.tags[ t ] );

}
for ( let i = 0; i < D.cyl.length; i += 6 ) {

	const [ x, z, r, a, b, t ] = D.cyl.slice( i, i + 6 );
	C.addCylinder( x, z, r, a, b, { tag: D.tags[ t ] } );

}
const HS = 4, hash = new Map();
const hkey = ( i, j ) => i * 100003 + j;
const bucket = ( i, j ) => {

	const k = hkey( i, j );
	let c = hash.get( k );
	if ( ! c ) {

		c = Object.create( Colliders.prototype );
		c.boxes = []; c.cylinders = []; c._v = null;
		hash.set( k, c );

	}
	return c;

};
for ( const b of C.boxes ) {

	const r = b.radius + 0.5;
	for ( let i = Math.floor( ( b.center.x - r ) / HS ); i <= Math.floor( ( b.center.x + r ) / HS ); i ++ ) for ( let j = Math.floor( ( b.center.z - r ) / HS ); j <= Math.floor( ( b.center.z + r ) / HS ); j ++ ) bucket( i, j ).boxes.push( b );

}
for ( const c of C.cylinders ) {

	const r = c.radius + 0.5;
	for ( let i = Math.floor( ( c.x - r ) / HS ); i <= Math.floor( ( c.x + r ) / HS ); i ++ ) for ( let j = Math.floor( ( c.z - r ) / HS ); j <= Math.floor( ( c.z + r ) / HS ); j ++ ) bucket( i, j ).cylinders.push( c );

}
const EMPTY = Object.assign( Object.create( Colliders.prototype ), { boxes: [], cylinders: [] } );
const near = ( x, z ) => hash.get( hkey( Math.floor( x / HS ), Math.floor( z / HS ) ) ) || EMPTY;

// ---------------------------------------------------------------- the ground (BallparkApp.terrain)
function pointInPolygon( x, z, P ) {

	let inside = false;
	for ( let i = 0, j = P.length - 1; i < P.length; j = i ++ ) {

		const [ ax, az ] = P[ i ], [ bx, bz ] = P[ j ];
		if ( ( az > z ) !== ( bz > z ) && x < ( bx - ax ) * ( z - az ) / ( bz - az ) + ax ) inside = ! inside;

	}
	return inside;

}
const FH = new Map();
for ( let k = 0; k < D.fh.data.length; k += 3 ) FH.set( D.fh.data[ k ] * 100003 + D.fh.data[ k + 1 ], D.fh.data[ k + 2 ] );
const fieldH = ( x, z ) => FH.get( Math.round( ( x - D.fh.x0 ) / D.fh.S ) * 100003 + Math.round( ( z - D.fh.z0 ) / D.fh.S ) ) || 0;
const terrain = ( wx, wz ) => {

	const [ x, z ] = toField( wx, wz );
	return FY0 + ( pointInPolygon( x, z, D.pit ) ? fieldH( x, z ) : STREET );

};
const groundAt = ( x, z, maxY ) => Math.max( terrain( x, z ), near( x, z ).groundHeightAt( x, z, maxY ) );
// which collider gives the ground there (for the reports)
const groundBox = ( x, z, maxY ) => {

	let best = null, top = - Infinity;
	for ( const b of near( x, z ).boxes ) {

		if ( ! b.walkable || b.top > maxY ) continue;
		const [ lx, lz ] = C._toLocal( b, x, z );
		if ( Math.abs( lx ) <= b.half.x && Math.abs( lz ) <= b.half.z && b.top > top ) {

			top = b.top; best = b;

		}

	}
	return best && top >= terrain( x, z ) ? best : null;

};

// ---------------------------------------------------------------- the seated fans (BallparkApp._pushFromFans)
const fanGrid = new Map();
for ( let k = 0; k < D.fans.length; k += 3 ) {

	const x = D.fans[ k ], y = D.fans[ k + 1 ], z = D.fans[ k + 2 ];
	const key = Math.floor( x ) * 4096 + Math.floor( z );
	let c = fanGrid.get( key );
	if ( ! c ) fanGrid.set( key, c = [] );
	c.push( x, y, z );

}
function pushFromFans( p, radius ) {

	const R = radius + 0.25;
	const cx = Math.floor( p.x ), cz = Math.floor( p.z );
	for ( let i = - 1; i <= 1; i ++ ) for ( let j = - 1; j <= 1; j ++ ) {

		const cell = fanGrid.get( ( cx + i ) * 4096 + cz + j );
		if ( ! cell ) continue;
		for ( let k = 0; k < cell.length; k += 3 ) {

			const dy = cell[ k + 1 ] - p.y;
			if ( dy < FAN_DY || dy > 0.7 ) continue; // (FA3, WA1-7: as far down as a jump lifts you)
			const dx = p.x - cell[ k ], dz = p.z - cell[ k + 2 ], d = Math.hypot( dx, dz );
			if ( d >= R || d < 1e-4 ) continue;
			p.x += dx / d * ( R - d );
			p.z += dz / d * ( R - d );

		}

	}

}
const fanNear = ( x, y, z, r ) => {

	const cx = Math.floor( x ), cz = Math.floor( z );
	for ( let i = - 1; i <= 1; i ++ ) for ( let j = - 1; j <= 1; j ++ ) {

		const cell = fanGrid.get( ( cx + i ) * 4096 + cz + j );
		if ( cell ) for ( let k = 0; k < cell.length; k += 3 ) if ( Math.abs( cell[ k + 1 ] - y ) < 0.8 && Math.hypot( cell[ k ] - x, cell[ k + 2 ] - z ) < r ) return true;

	}
	return false;

};
const resolve = ( p, step = STEP ) => {

	near( p.x, p.z ).resolveCapsule( p, RADIUS, HEIGHT, step );
	near( p.x, p.z ).resolveCapsule( p, RADIUS, HEIGHT, step );

};

// ---------------------------------------------------------------- parity with the page
{

	let gBad = 0, rBad = 0, fBad = 0, worst = [];
	for ( const [ x, z, y, g, px, pz, qx, qz ] of D.par ) {

		const gg = groundAt( x, z, y + 0.67 );
		if ( Math.abs( gg - g ) > 0.02 ) {

			gBad ++;
			if ( worst.length < 5 ) worst.push( { x, z, y, page: g, node: gg } );

		}
		const p = { x, y, z };
		near( x, z ).resolveCapsule( p, 0.3, 1.75, 0.62 );
		if ( Math.hypot( p.x - px, p.z - pz ) > 0.02 ) rBad ++;
		const q = { x, y, z };
		pushFromFans( q, 0.3 );
		if ( Math.hypot( q.x - qx, q.z - qz ) > 0.02 ) fBad ++;

	}
	console.log( `parity (${ D.par.length } random queries): ground ${ gBad } off, capsule ${ rBad } off, fans ${ fBad } off`, worst );

}

// ---------------------------------------------------------------- the walker's move from a point toward a target
// in 0.1 m steps: the capsule resolved, the fans' push, the ground (up a step, down a step, or a fall).
// A jump: the feet `lift` up for the move (the jump's peak, 1.08 m), then the ground under maxY
function slide( ax, ay, az, tx, tz, lift = 0 ) {

	let x = ax, z = az, y = ay + lift, drop = 0, pop = 0, popAt = null, dropAt = null;
	const p = { x, y, z };
	for ( let it = 0; it < 12; it ++ ) {

		const dx = tx - x, dz = tz - z, d = Math.hypot( dx, dz );
		if ( d < 0.02 ) break;
		const st = Math.min( 0.1, d );
		p.x = x + dx / d * st; p.z = z + dz / d * st; p.y = y;
		resolve( p, lift && ! OLD ? AIR_STEP : STEP );
		pushFromFans( p, RADIUS );
		// (FA3, WA1-6: Walker.updateWalk) the ground rising more than a step is a wall: back along one axis or
		// both
		const lim = y + STEP + 0.05;
		if ( ! OLD && terrain( p.x, p.z ) > lim && terrain( x, z ) <= lim ) {

			if ( terrain( p.x, z ) <= lim ) p.z = z;
			else if ( terrain( x, p.z ) <= lim ) p.x = x;
			else {

				p.x = x; p.z = z;

			}

		}
		x = p.x; z = p.z;
		const g = groundAt( x, z, y + STEP + 0.05 );
		if ( g > y + STEP + 0.05 ) {

			// only the ground (BallparkApp.terrain) ignores maxY: the walker is put on top of it
			if ( g - y > pop ) {

				pop = g - y; popAt = [ x, y, z ];

			}
			y = g;

		} else if ( lift ) {

			// in the air at the jump's peak: it lands on anything that comes up to its feet
			if ( g >= y ) y = g;

		} else if ( g >= y - STEP ) y = g;
		else {

			if ( y - g > drop ) {

				drop = y - g; dropAt = [ x, y, z ];

			}
			y = g;

		}

	}
	if ( lift ) {

		// come down on the highest floor under the peak (maxY: the peak's feet and a step)
		const g = groundAt( x, z, y + STEP + 0.05 );
		if ( ay - g > STEP ) {

			drop = ay - g; dropAt = [ x, ay, z ];

		}
		y = g;

	}
	return { x, y, z, drop, pop, popAt, dropAt };

}

// ---------------------------------------------------------------- the fill
const cellOf = ( wx, wz ) => {

	const [ fx, fz ] = toField( wx, wz );
	const i = Math.floor( ( fx - X0 ) / CELL ), j = Math.floor( ( fz - Z0 ) / CELL );
	if ( i < 0 || j < 0 || i >= NX || j >= NZ ) return - 1;
	return j * NX + i;

};
const cellCenter = ( c ) => toWorld( X0 + ( c % NX + 0.5 ) * CELL, Z0 + ( Math.floor( c / NX ) + 0.5 ) * CELL );
const SAME = 0.35; // two floors in a cell closer than this are one

function fill( seeds, { jumps = false, known = null } = {} ) {

	const N = { x: [], y: [], z: [], c: [], parent: [], how: [] };
	const seen = new Map(); // cell -> [ node ids ]
	const drops = [], pops = [], elev = [], jumpsUsed = [];
	const add = ( x, y, z, parent, how ) => {

		const c = cellOf( x, z );
		if ( c < 0 ) return - 1;
		const L = seen.get( c );
		if ( L ) for ( const id of L ) if ( Math.abs( N.y[ id ] - y ) < SAME ) return - 1;
		const id = N.x.length;
		N.x.push( x ); N.y.push( y ); N.z.push( z ); N.c.push( c ); N.parent.push( parent ); N.how.push( how );
		if ( L ) L.push( id ); else seen.set( c, [ id ] );
		return id;

	};
	for ( const s of seeds ) add( s.x, s.y, s.z, - 1, s.how || 'start' );
	// (FA3: and the diagonals: a 1.3 m gap at 35 degrees to the grid, the drink rail's at the baseline's
	// aisle heads, let no move along an axis through)
	const DIRS = [ [ 1, 0 ], [ - 1, 0 ], [ 0, 1 ], [ 0, - 1 ], [ 1, 1 ], [ - 1, - 1 ], [ 1, - 1 ], [ - 1, 1 ] ];
	for ( let q = 0; q < N.x.length; q ++ ) {

		const x = N.x[ q ], y = N.y[ q ], z = N.z[ q ], c = N.c[ q ];
		const ci = c % NX, cj = Math.floor( c / NX );
		for ( const [ di, dj ] of DIRS ) {

			const ni = ci + di, nj = cj + dj;
			if ( ni < 0 || nj < 0 || ni >= NX || nj >= NZ ) continue;
			const [ tx, tz ] = cellCenter( nj * NX + ni );
			const r = slide( x, y, z, tx, tz );
			if ( cellOf( r.x, r.z ) !== c ) {

				const id = add( r.x, r.y, r.z, q, r.drop > 0 ? 'drop' : r.pop > 0 ? 'pop' : 'walk' );
				if ( r.drop > 0.05 ) drops.push( { from: q, to: id, h: r.drop, at: r.dropAt, land: [ r.x, r.y, r.z ] } );
				if ( r.pop > 0 ) pops.push( { from: q, to: id, h: r.pop, at: r.popAt } );

			} else if ( jumps ) {

				// blocked walking: a jump (Space: 1.08 m up, and the step on top of that)
				const j = slide( x, y, z, tx, tz, JUMP );
				if ( cellOf( j.x, j.z ) !== c ) {

					const id = add( j.x, j.y, j.z, q, 'jump' );
					jumpsUsed.push( { from: q, to: id, rise: j.y - y, drop: j.drop, land: [ j.x, j.y, j.z ] } );

				}

			}

		}
		// the elevators: E within 2.2 m of a stop (and 1.5 m of its height) rides to the next stop
		for ( let k = 0; k < D.inter.length; k ++ ) {

			const it = D.inter[ k ];
			if ( Math.hypot( it.x - x, it.z - z ) >= it.r || Math.abs( it.y - y ) >= 1.5 ) continue;
			// (FA1: the bowl's banks, of any size; ---- FA2: a stop of a place's own elevator carries where it goes, `to`;
			// ---- FA4, step 10, WA1-11: E rides up a floor and Shift+E down one (BallparkApp._addElevators), so
			// a bank's stop leads to the floors either side of it by height; it was the next stop round the ring)
			let stops = it.to ? [ it.to ] : [];
			if ( ELEV_AT[ k ] ) {

				const [ bank, i ] = ELEV_AT[ k ], B = D.elev[ bank ], here = B[ i ];
				stops = [ B.filter( ( s ) => s.y > here.y ).sort( ( a, b ) => a.y - b.y )[ 0 ], B.filter( ( s ) => s.y < here.y ).sort( ( a, b ) => b.y - a.y )[ 0 ] ];

			}
			for ( const stop of stops ) {

			if ( ! stop ) continue;
			const [ wx, wz ] = toWorld( stop.x, stop.z );
			let wy = FY0 + stop.y;
			wy = Math.max( wy, groundAt( wx, wz, wy + STEP + 0.05 ) );
			// (it stands in the air if the floor is lower: it falls)
			const g = groundAt( wx, wz, wy + STEP + 0.05 );
			const p = { x: wx, y: wy, z: wz };
			resolve( p );
			const id = add( p.x, g, p.z, q, 'elevator' );
			if ( id >= 0 ) elev.push( { from: q, to: id, inter: k, text: it.text, arriveFall: wy - g, pushed: Math.hypot( p.x - wx, p.z - wz ) } );

			}

		}

	}
	return { N, seen, drops, pops, elev, jumpsUsed };

}

const [ sx, sz ] = toWorld( ...START.at );
const sy = groundAt( sx, sz, 0 + STEP + 0.05 );
// (FA3) WA_PATH="x,z x,z ...": walk those field-frame points with the fill's own move (from the first, on
// the floor nearest WA_H over the field) and print each step, then stop: why doesn't the fill get there?
if ( process.env.WA_PATH ) {

	const pts = process.env.WA_PATH.trim().split( /\s+/ ).map( ( s ) => s.split( ',' ).map( Number ) );
	let [ x, z ] = toWorld( ...pts[ 0 ] ), y = groundAt( x, z, FY0 + Number( process.env.WA_H || 50 ) );
	for ( const [ fx, fz ] of pts.slice( 1 ) ) {

		const [ tx, tz ] = toWorld( fx, fz );
		for ( let k = 0; k < 400 && Math.hypot( tx - x, tz - z ) > 0.05; k ++ ) {

			const r = slide( x, y, z, tx, tz );
			const moved = Math.hypot( r.x - x, r.z - z );
			const [ ax, az ] = toField( r.x, r.z );
			console.log( `(${ ax.toFixed( 2 ) }, ${ ( r.y - FY0 ).toFixed( 2 ) }, ${ az.toFixed( 2 ) })${ r.drop ? ' drop ' + r.drop.toFixed( 2 ) : '' }${ moved < 0.01 ? ' STUCK' : '' }` );
			if ( moved < 0.01 ) {

				// what holds it: the capsule's walls, the fans, the ground's rise
				const d = Math.hypot( tx - x, tz - z ), p = { x: x + ( tx - x ) / d * 0.1, y, z: z + ( tz - z ) / d * 0.1 };
				const q = { ...p };
				resolve( q );
				const f = { ...q };
				pushFromFans( f, RADIUS );
				console.log( '  wall push', Math.hypot( q.x - p.x, q.z - p.z ).toFixed( 3 ), 'fans push', Math.hypot( f.x - q.x, f.z - q.z ).toFixed( 3 ), 'terrain', ( terrain( f.x, f.z ) - FY0 ).toFixed( 2 ) );
				for ( const b of near( p.x, p.z ).boxes ) {

					if ( ! b.solid || p.y + HEIGHT < b.bottom || p.y + STEP > b.top ) continue;
					const [ lx, lz ] = C._toLocal( b, p.x, p.z );
					if ( Math.abs( lx ) < b.half.x + 0.35 && Math.abs( lz ) < b.half.z + 0.35 ) console.log( '  box', b.tag, ( b.bottom - FY0 ).toFixed( 2 ), ( b.top - FY0 ).toFixed( 2 ), lx.toFixed( 2 ), lz.toFixed( 2 ), b.half.x.toFixed( 2 ), b.half.z.toFixed( 2 ) );

				}
				for ( let k = 0; k < D.fans.length; k += 3 ) if ( Math.hypot( D.fans[ k ] - p.x, D.fans[ k + 2 ] - p.z ) < 0.9 ) console.log( '  fan', ( D.fans[ k + 1 ] - FY0 ).toFixed( 2 ), Math.hypot( D.fans[ k ] - p.x, D.fans[ k + 2 ] - p.z ).toFixed( 2 ) );
				break;

			}
			x = r.x; y = r.y; z = r.z;

		}

	}
	process.exit( 0 );

}
const W = fill( [ { x: sx, y: Math.max( 0, sy ), z: sz } ] );
console.log( `walk fill: ${ W.N.x.length } nodes, ${ W.drops.length } drops, ${ W.pops.length } pops, ${ W.elev.length } elevator links (${ ( ( Date.now() - t0 ) / 1000 ).toFixed( 1 ) } s)` );

// ---------------------------------------------------------------- the floors there are: every walkable box's top, and the ground
// (in the footprint and the pit) - where the walker could stand, and whether it got there
const level = ( y ) => {

	const h = y - FY0;
	return h < 5.6 ? 0 : h < 9.4 ? 1 : h < 15.0 ? 2 : h < 21.6 ? 3 : h < 28.6 ? 4 : 5;

};
const LEVEL_NAMES = [ 'pit (field, 100s, pens) below 5.6 m', 'street and main concourse 5.6-9.4 m', 'suites, Pavilion, LF deck 9.4-15 m', 'club 15-21.6 m', 'Terrace 21.6-28.6 m', '400s and above 28.6 m+' ];
const reachedAt = ( F, c, y ) => {

	const L = F.seen.get( c );
	if ( L ) for ( const id of L ) if ( Math.abs( F.N.y[ id ] - y ) < SAME + 0.1 ) return id;
	return - 1;

};
const cand = []; // { c, y, tag, state: 'reached' | 'unreached' | 'fans' | 'blocked' | 'covered' }
const standable = ( x, y, z ) => {

	const p = { x, y, z };
	resolve( p );
	const wall = Math.hypot( p.x - x, p.z - z );
	const q = { x: p.x, y, z: p.z };
	pushFromFans( q, RADIUS );
	const fan = Math.hypot( q.x - p.x, q.z - p.z );
	return { wall, fan, x: q.x, z: q.z };

};
const candAt = ( c, y, tag ) => {

	const [ x, z ] = cellCenter( c );
	if ( groundAt( x, z, y + STEP + 0.05 ) > y + 0.05 ) return; // a higher floor within a step: that one's the floor
	if ( groundAt( x, z, y + 0.01 ) < y - 0.05 ) return; // not this floor here after all
	let state = reachedAt( W, c, y ) >= 0 ? 'reached' : null;
	if ( ! state ) {

		const s = standable( x, y, z );
		// among the seats (a fan within a metre, at about this height): a row's legroom, not a floor of its own
		state = s.wall > 0.3 ? 'blocked' : s.fan > 0.3 || fanNear( x, y, z, 1.0 ) ? 'fans' : 'unreached';

	}
	cand.push( { c, y, tag, state } );

};
// walkable boxes
const footprintHas = ( fx, fz ) => pointInPolygon( fx, fz, FOOTPRINT );
for ( const b of C.boxes ) {

	if ( ! b.walkable ) continue;
	// the box's corners in the field frame
	const cs = [ [ - 1, - 1 ], [ 1, - 1 ], [ 1, 1 ], [ - 1, 1 ] ].map( ( [ a, d ] ) => {

		const lx = a * b.half.x, lz = d * b.half.z;
		// local -> world: the inverse of _toLocal
		const wx = b.center.x + lx * b.cos + lz * b.sin, wz = b.center.z - lx * b.sin + lz * b.cos;
		return toField( wx, wz );

	} );
	const fx0 = Math.min( ...cs.map( ( p ) => p[ 0 ] ) ), fx1 = Math.max( ...cs.map( ( p ) => p[ 0 ] ) );
	const fz0 = Math.min( ...cs.map( ( p ) => p[ 1 ] ) ), fz1 = Math.max( ...cs.map( ( p ) => p[ 1 ] ) );
	for ( let i = Math.max( 0, Math.floor( ( fx0 - X0 ) / CELL ) ); i <= Math.min( NX - 1, Math.floor( ( fx1 - X0 ) / CELL ) ); i ++ ) {

		for ( let j = Math.max( 0, Math.floor( ( fz0 - Z0 ) / CELL ) ); j <= Math.min( NZ - 1, Math.floor( ( fz1 - Z0 ) / CELL ) ); j ++ ) {

			const c = j * NX + i, [ x, z ] = cellCenter( c );
			const [ lx, lz ] = C._toLocal( b, x, z );
			if ( Math.abs( lx ) > b.half.x || Math.abs( lz ) > b.half.z ) continue;
			candAt( c, b.top, b.tag );

		}

	}

}
// the ground, in the footprint (the concourses, the pit) and round it
for ( let j = 0; j < NZ; j ++ ) for ( let i = 0; i < NX; i ++ ) {

	const c = j * NX + i, fx = X0 + ( i + 0.5 ) * CELL, fz = Z0 + ( j + 0.5 ) * CELL;
	const [ x, z ] = toWorld( fx, fz );
	const t = terrain( x, z );
	candAt( c, t, pointInPolygon( fx, fz, D.pit ) ? 'ground:pit' : footprintHas( fx, fz ) ? 'ground:concourse' : 'ground:outside' );

}
console.log( `floors: ${ cand.length } cells (${ ( ( Date.now() - t0 ) / 1000 ).toFixed( 1 ) } s)` );

// ---------------------------------------------------------------- with jumps: what a jump gets you that walking doesn't
const J = fill( [ { x: sx, y: Math.max( 0, sy ), z: sz } ], { jumps: true } );
const jumpOnly = [];
for ( let id = 0; id < J.N.x.length; id ++ ) if ( reachedAt( W, J.N.c[ id ], J.N.y[ id ] ) < 0 ) jumpOnly.push( id );
console.log( `jump fill: ${ J.N.x.length } nodes, ${ jumpOnly.length } only with jumps (${ ( ( Date.now() - t0 ) / 1000 ).toFixed( 1 ) } s)` );

// ---------------------------------------------------------------- clusters (connected cells, by level) for the reports
function clusters( items, keyC, keyY, minCells = 1 ) {

	// items: indices; cells joined when 4-neighbours at the same level within 0.7 m in height
	const byCell = new Map();
	items.forEach( ( it, k ) => {

		const c = keyC( it );
		let L = byCell.get( c );
		if ( ! L ) byCell.set( c, L = [] );
		L.push( k );

	} );
	const done = new Uint8Array( items.length ), out = [];
	for ( let k = 0; k < items.length; k ++ ) {

		if ( done[ k ] ) continue;
		const stack = [ k ], mem = [];
		done[ k ] = 1;
		while ( stack.length ) {

			const a = stack.pop();
			mem.push( a );
			const c = keyC( items[ a ] ), y = keyY( items[ a ] ), i = c % NX, j = Math.floor( c / NX );
			for ( const [ di, dj ] of [ [ 1, 0 ], [ - 1, 0 ], [ 0, 1 ], [ 0, - 1 ], [ 1, 1 ], [ - 1, - 1 ], [ 1, - 1 ], [ - 1, 1 ] ] ) {

				const L = byCell.get( ( j + dj ) * NX + i + di );
				if ( L ) for ( const b of L ) if ( ! done[ b ] && Math.abs( keyY( items[ b ] ) - y ) < 0.7 ) {

					done[ b ] = 1;
					stack.push( b );

				}

			}

		}
		if ( mem.length >= minCells ) out.push( mem.map( ( m ) => items[ m ] ) );

	}
	return out.sort( ( a, b ) => b.length - a.length );

}
const fieldOfCell = ( c ) => [ X0 + ( c % NX + 0.5 ) * CELL, Z0 + ( Math.floor( c / NX ) + 0.5 ) * CELL ];
const r1 = ( v ) => Math.round( v * 10 ) / 10;
const describe = ( mem, keyC, keyY, tagOfIt ) => {

	let sx = 0, sz = 0, ymin = Infinity, ymax = - Infinity, x0 = Infinity, x1 = - Infinity, z0 = Infinity, z1 = - Infinity;
	const tags = new Map();
	for ( const it of mem ) {

		const [ fx, fz ] = fieldOfCell( keyC( it ) );
		sx += fx; sz += fz;
		x0 = Math.min( x0, fx ); x1 = Math.max( x1, fx ); z0 = Math.min( z0, fz ); z1 = Math.max( z1, fz );
		const h = keyY( it ) - FY0;
		ymin = Math.min( ymin, h ); ymax = Math.max( ymax, h );
		const t = tagOfIt ? tagOfIt( it ) : '';
		tags.set( t, ( tags.get( t ) || 0 ) + 1 );

	}
	return {
		cells: mem.length, m2: mem.length * CELL * CELL, centre: [ r1( sx / mem.length ), r1( sz / mem.length ) ],
		x: [ r1( x0 ), r1( x1 ) ], z: [ r1( z0 ), r1( z1 ) ], h: [ r1( ymin ), r1( ymax ) ],
		tags: Object.fromEntries( [ ...tags ].sort( ( a, b ) => b[ 1 ] - a[ 1 ] ).slice( 0, 6 ) ),
	};

};

const unreached = cand.filter( ( k ) => k.state === 'unreached' && k.tag !== 'ground:outside' );
const unreachedClusters = clusters( unreached, ( k ) => k.c, ( k ) => k.y ).map( ( m ) => describe( m, ( k ) => k.c, ( k ) => k.y, ( k ) => k.tag ) ).filter( ( d ) => d.cells >= 4 );
// per tag: how much of each walkable surface the walker reaches
const perTag = {};
for ( const k of cand ) {

	const t = perTag[ k.tag ] ||= { reached: 0, unreached: 0, fans: 0, blocked: 0 };
	t[ k.state ] ++;

}
// drops, clustered where they start
const bigDrops = W.drops.filter( ( d ) => d.h > 1.0 );
const dropItems = bigDrops.map( ( d ) => ( { c: cellOf( d.at[ 0 ], d.at[ 2 ] ), y: d.at[ 1 ], h: d.h, land: d.land[ 1 ] } ) ).filter( ( d ) => d.c >= 0 );
const dropClusters = clusters( dropItems, ( d ) => d.c, ( d ) => d.y ).map( ( m ) => {

	const r = describe( m, ( d ) => d.c, ( d ) => d.y );
	r.fall = [ r1( Math.min( ...m.map( ( d ) => d.h ) ) ), r1( Math.max( ...m.map( ( d ) => d.h ) ) ) ];
	r.landsAt = [ r1( Math.min( ...m.map( ( d ) => d.land ) ) - FY0 ), r1( Math.max( ...m.map( ( d ) => d.land ) ) - FY0 ) ];
	// what the floor it falls off is
	const t = new Map();
	for ( const d of m ) {

		const [ x, z ] = cellCenter( d.c );
		const b = groundBox( x, z, d.y + 0.05 );
		const k = b ? b.tag : 'ground';
		t.set( k, ( t.get( k ) || 0 ) + 1 );

	}
	r.from = Object.fromEntries( [ ...t ].sort( ( a, b ) => b[ 1 ] - a[ 1 ] ).slice( 0, 4 ) );
	return r;

} );
const popItems = W.pops.map( ( d ) => ( { c: cellOf( d.at[ 0 ], d.at[ 2 ] ), y: d.at[ 1 ], h: d.h } ) ).filter( ( d ) => d.c >= 0 );
const popClusters = clusters( popItems, ( d ) => d.c, ( d ) => d.y ).map( ( m ) => Object.assign( describe( m, ( d ) => d.c, ( d ) => d.y ), { up: r1( Math.max( ...m.map( ( d ) => d.h ) ) ) } ) );
const jumpClusters = clusters( jumpOnly, ( id ) => J.N.c[ id ], ( id ) => J.N.y[ id ] ).map( ( m ) => Object.assign( describe( m, ( id ) => J.N.c[ id ], ( id ) => J.N.y[ id ], ( id ) => {

	const [ x, z ] = [ J.N.x[ id ], J.N.z[ id ] ];
	const b = groundBox( x, z, J.N.y[ id ] + 0.05 );
	return b ? b.tag : 'ground';

} ), { first: Math.min( ...m ) } ) ).filter( ( d ) => d.cells >= 4 );
// where the jumps out of the walkable start
const jumpEdges = J.jumpsUsed.filter( ( e ) => e.to >= 0 && reachedAt( W, J.N.c[ e.to ], J.N.y[ e.to ] ) < 0 && reachedAt( W, J.N.c[ e.from ], J.N.y[ e.from ] ) >= 0 );
const jumpEdgeClusters = clusters( jumpEdges, ( e ) => J.N.c[ e.from ], ( e ) => J.N.y[ e.from ] ).map( ( m ) => {

	const r = describe( m, ( e ) => J.N.c[ e.from ], ( e ) => J.N.y[ e.from ], ( e ) => {

		const b = groundBox( J.N.x[ e.to ], J.N.z[ e.to ], J.N.y[ e.to ] + 0.05 );
		return 'onto ' + ( b ? b.tag : 'ground' );

	} );
	r.landH = [ r1( Math.min( ...m.map( ( e ) => e.land[ 1 ] ) ) - FY0 ), r1( Math.max( ...m.map( ( e ) => e.land[ 1 ] ) ) - FY0 ) ];
	return r;

} ).filter( ( d ) => d.cells >= 2 );

// reached, per level
const perLevel = [ 0, 0, 0, 0, 0, 0 ];
for ( let id = 0; id < W.N.x.length; id ++ ) perLevel[ level( W.N.y[ id ] ) ] ++;
// a path to any node, as field-frame waypoints (for walking it in the page)
const pathTo = ( F, id ) => {

	const out = [];
	for ( let k = id; k >= 0; k = F.N.parent[ k ] ) {

		const [ fx, fz ] = toField( F.N.x[ k ], F.N.z[ k ] );
		out.push( [ r1( fx ), r1( F.N.y[ k ] - FY0 ), r1( fz ), F.N.how[ k ] ] );

	}
	return out.reverse();

};

// the elevators: which stops the walker reaches and where each ride leaves it
const elevReport = D.inter.map( ( it, k ) => [ it, k ] ).filter( ( [ it, k ] ) => ELEV_AT[ k ] || it.to ).map( ( [ it, k ] ) => {

	const [ fx, fz ] = toField( it.x, it.z );
	const e = W.elev.find( ( e ) => e.inter === k );
	// is the stop's own spot reached at all?
	let reachedNear = false;
	for ( let id = 0; id < W.N.x.length && ! reachedNear; id ++ ) if ( Math.hypot( W.N.x[ id ] - it.x, W.N.z[ id ] - it.z ) < it.r && Math.abs( W.N.y[ id ] - it.y ) < 1.5 ) reachedNear = true;
	const at = ELEV_AT[ k ], bank = at ? at[ 0 ] : 'own', stop = at ? D.elev[ at[ 0 ] ][ at[ 1 ] ] : { name: it.text, x: fx, z: fz, y: it.y - FY0 }; // (FA1: banks of any size; ---- FA2: a place's own stop)
	const [ wx, wz ] = toWorld( stop.x, stop.z );
	const g = groundAt( wx, wz, FY0 + stop.y + STEP + 0.05 );
	const st = standable( wx, Math.max( g, FY0 + stop.y ), wz );
	return { bank, stop: stop.name, at: [ r1( fx ), r1( it.y - FY0 ), r1( fz ) ], text: it.text, reached: reachedNear, floorUnder: r1( g - FY0 ), floorGap: r1( stop.y - ( g - FY0 ) ), wallPush: r1( st.wall ), ride: e ? { arriveFall: r1( e.arriveFall ), pushed: r1( e.pushed ) } : null };

} );

// ---------------------------------------------------------------- where the falls land: on the field, or in the hollow under the stands
const FB = fieldBoundary();
const landing = ( x, y, z ) => {

	const [ fx, fz ] = toField( x, z ), h = y - FY0;
	if ( pointInPolygon( fx, fz, FB ) ) return 'field';
	if ( pointInPolygon( fx, fz, D.pit ) && h < 1.0 ) return 'hollow (under the stands, at the field\'s level)';
	if ( h < 1.0 ) return 'pit';
	return h < 9.4 ? 'street level' : 'a lower deck';

};
const intoPit = {};
for ( const d of W.drops ) {

	if ( d.h < 1.0 ) continue;
	const k = landing( ...d.land );
	( intoPit[ k ] ||= { edges: 0, maxFall: 0 } ).edges ++;
	intoPit[ k ].maxFall = Math.max( intoPit[ k ].maxFall, r1( d.h ) );

}
// the falls by the floor they start from (the walkable box under the walker before it fell) and where they land
const dropsByTag = {};
for ( const d of W.drops ) {

	if ( d.h < 1.0 ) continue;
	const q = d.from, b = groundBox( W.N.x[ q ], W.N.z[ q ], W.N.y[ q ] + 0.05 );
	const t = b ? b.tag : W.N.y[ q ] - FY0 > 6.5 && W.N.y[ q ] - FY0 < 7.5 ? 'ground (street level)' : 'ground';
	const e = dropsByTag[ t ] ||= { edges: 0, maxFall: 0, lands: {}, at: null };
	e.edges ++;
	if ( d.h > e.maxFall ) {

		e.maxFall = r1( d.h );
		e.at = toField( d.at[ 0 ], d.at[ 2 ] ).map( r1 ).concat( r1( d.at[ 1 ] - FY0 ) );

	}
	const k = landing( ...d.land );
	e.lands[ k ] = ( e.lands[ k ] || 0 ) + 1;

}
// the holes in the floors the walker reaches: in each reached cell on a seating tier, 10 x 10 points at its
// height, and those with nothing under them within a step but floor either side (a crack, not an edge:
// the walker standing there falls through)
const holes = {}, holeSpots = [];
for ( let id = 0; id < W.N.x.length; id ++ ) {

	const y = W.N.y[ id ], b = groundBox( W.N.x[ id ], W.N.z[ id ], y + 0.05 );
	if ( ! b || ! /seats|level|corner|seam|arcade|pavilion|terrace-[34]|monty|lf-deck/.test( b.tag ) ) continue;
	const [ cx, cz ] = fieldOfCell( W.N.c[ id ] );
	let n = 0, sx = 0, sz = 0;
	for ( let i = 0; i < 10; i ++ ) for ( let j = 0; j < 10; j ++ ) {

		const fx = cx - CELL / 2 + ( i + 0.5 ) * CELL / 10, fz = cz - CELL / 2 + ( j + 0.5 ) * CELL / 10;
		const [ x, z ] = toWorld( fx, fz );
		// a hole, not the floor's edge: floor within a step on both sides of it (0.4 m either way across x or z)
		const floor = ( ox, oz ) => {

			const [ wx, wz ] = toWorld( fx + ox, fz + oz );
			return Math.abs( groundAt( wx, wz, y + STEP + 0.05 ) - y ) < STEP;

		};
		if ( groundAt( x, z, y + STEP + 0.05 ) < y - STEP && ( ( floor( 0.4, 0 ) && floor( - 0.4, 0 ) ) || ( floor( 0, 0.4 ) && floor( 0, - 0.4 ) ) ) ) {

			n ++; sx += fx; sz += fz;

		}

	}
	const e = holes[ b.tag ] ||= { cells: 0, holeM2: 0, worst: 0 };
	e.cells ++;
	e.holeM2 += n * ( CELL / 10 ) ** 2;
	e.worst = Math.max( e.worst, n );
	if ( n >= 12 ) holeSpots.push( { tag: b.tag, at: [ r1( sx / n * 10 ) / 10, Math.round( ( y - FY0 ) * 100 ) / 100, r1( sz / n * 10 ) / 10 ], pct: n } );

}
for ( const e of Object.values( holes ) ) e.holeM2 = Math.round( e.holeM2 * 100 ) / 100;
holeSpots.sort( ( a, b ) => b.pct - a.pct );
// The walker itself (Walker.updateWalk, without the standing people): 60 frames a second, its velocity
// eased toward the wish (14 a second grounded, 2.5 in the air), gravity, the capsule and the fans' push,
// then the ground (up to it, down a step with it, or falling). Each fall the fill found is walked across
// at walking pace from where it started, and the walker's own falls counted: a fall the fill finds but
// the walker doesn't is a sliver it steps over (it drops through only if it stops on it)
function walkSim( x, y, z, dx, dz, seconds = 1.4, stopAfter = 1.0 ) {

	const p = { x, y, z }, v = { x: 0, y: 0, z: 0 }, dt = 1 / 60;
	const dl = Math.hypot( dx, dz ) || 1;
	let grounded = true, fallFrom = null, maxFall = 0, landed = null;
	for ( let f = 0; f < seconds * 60; f ++ ) {

		const go = f < stopAfter * 60;
		const k = 1 - Math.exp( - ( grounded ? 14 : 2.5 ) * dt );
		v.x += ( ( go ? dx / dl * 1.9 : 0 ) - v.x ) * k;
		v.z += ( ( go ? dz / dl * 1.9 : 0 ) - v.z ) * k;
		v.y -= 9.81 * dt;
		const ox = p.x, oy = p.y, oz = p.z;
		p.x += v.x * dt; p.y += v.y * dt; p.z += v.z * dt;
		near( p.x, p.z ).resolveCapsule( p, RADIUS, HEIGHT, grounded || OLD ? STEP : Math.max( 0, oy - p.y ) + AIR_STEP );
		pushFromFans( p, RADIUS );
		const lim = p.y + STEP + 0.05;
		if ( ! OLD && terrain( p.x, p.z ) > lim && terrain( ox, oz ) <= oy + STEP + 0.05 ) {

			if ( terrain( p.x, oz ) <= lim ) p.z = oz;
			else if ( terrain( ox, p.z ) <= lim ) p.x = ox;
			else {

				p.x = ox; p.z = oz;

			}

		}
		const g = groundAt( p.x, p.z, p.y + STEP + 0.05 );
		if ( p.y <= g ) {

			p.y = g;
			if ( v.y < 0 ) v.y = 0;
			grounded = true;

		} else if ( grounded && v.y <= 0 && p.y - g < STEP ) {

			p.y = g; v.y = 0;

		} else grounded = p.y - g < 0.06;
		if ( ! grounded && fallFrom === null ) fallFrom = p.y;
		if ( grounded && fallFrom !== null ) {

			if ( fallFrom - p.y > maxFall ) {

				maxFall = fallFrom - p.y; landed = [ p.x, p.y, p.z ];

			}
			fallFrom = null;

		}

	}
	if ( fallFrom !== null && fallFrom - p.y > maxFall ) maxFall = fallFrom - p.y;
	return { maxFall, end: [ p.x, p.y, p.z ], landed };

}
const walkFalls = {};
for ( const d of W.drops ) {

	if ( d.h < 1.0 ) continue;
	const q = d.from, b = groundBox( W.N.x[ q ], W.N.z[ q ], W.N.y[ q ] + 0.05 );
	const t = b ? b.tag : W.N.y[ q ] - FY0 > 6.5 && W.N.y[ q ] - FY0 < 7.5 ? 'ground (street level)' : 'ground';
	const r = walkSim( W.N.x[ q ], W.N.y[ q ], W.N.z[ q ], d.at[ 0 ] - W.N.x[ q ], d.at[ 2 ] - W.N.z[ q ] );
	const e = walkFalls[ t ] ||= { edges: 0, walkerFalls: 0, maxFall: 0, at: null };
	e.edges ++;
	if ( r.maxFall > 1.0 ) {

		e.walkerFalls ++;
		// where (5 m squares of the field frame, with the heights)
		const [ fx, fz ] = toField( W.N.x[ q ], W.N.z[ q ] ), key = Math.round( fx / 5 ) * 5 + ',' + Math.round( fz / 5 ) * 5;
		const sq = ( e.squares ||= {} )[ key ] ||= { n: 0, fall: 0, h: r1( W.N.y[ q ] - FY0 ), lands: r.landed ? landing( ...r.landed ) : 'still falling' };
		sq.n ++;
		sq.fall = Math.max( sq.fall, r1( r.maxFall ) );
		if ( r.maxFall > e.maxFall ) {

			e.maxFall = r1( r.maxFall );
			e.at = toField( W.N.x[ q ], W.N.z[ q ] ).map( r1 ).concat( r1( W.N.y[ q ] - FY0 ) );
			e.lands = r.landed ? landing( ...r.landed ) : 'still falling';

		}

	}

}
// the first way into the hollow and onto the field (BFS order: the nearest the start)
const firstInto = {};
for ( let id = 0; id < W.N.x.length; id ++ ) {

	const k = landing( W.N.x[ id ], W.N.y[ id ], W.N.z[ id ] );
	if ( ( k === 'field' || k.startsWith( 'hollow' ) ) && ! firstInto[ k ] ) firstInto[ k ] = pathTo( W, id ).slice( - 6 );

}
// how the jump-only regions are entered: the jump on the path to each one's first node
for ( const cl of jumpClusters ) {

	const best = cl.first;
	delete cl.first;
	const P = pathTo( J, best );
	const j = P.map( ( p, i ) => [ p, i ] ).filter( ( [ p ] ) => p[ 3 ] === 'jump' ).pop();
	cl.entry = j ? { jumpFrom: P[ j[ 1 ] - 1 ], landsOn: j[ 0 ] } : null;
	// the way there: the jumps, the falls, the rides and every climb of more than a step
	cl.way = P.filter( ( p, i ) => i === 0 || i === P.length - 1 || p[ 3 ] !== 'walk' || Math.abs( p[ 1 ] - P[ i - 1 ][ 1 ] ) > 0.7 ).slice( - 14 );

}
// the ends of the walkable strips (the concourses and walkways behind the decks): where each runs out
const stripEnds = {};
for ( const tag of [ 'terrace-walkway', 'club-concourse', 'arcade-concourse', 'pavilion-concourse', 'pavilion-deck-walkway', 'suites', 'press-roof', 'club' ] ) {

	const bs = C.boxes.filter( ( b ) => b.tag === tag );
	if ( ! bs.length ) continue;
	const f = bs.map( ( b ) => toField( b.center.x, b.center.z ) );
	const i0 = f.reduce( ( a, p, i ) => ( p[ 0 ] < f[ a ][ 0 ] ? i : a ), 0 ), i1 = f.reduce( ( a, p, i ) => ( p[ 0 ] > f[ a ][ 0 ] ? i : a ), 0 );
	stripEnds[ tag ] = { boxes: bs.length, top: r1( bs[ 0 ].top - FY0 ), westEnd: f[ i0 ].map( r1 ), eastEnd: f[ i1 ].map( r1 ) };

}

// ---------------------------------------------------------------- the maps
function png( w, h, rgb ) {

	const raw = Buffer.alloc( ( w * 3 + 1 ) * h );
	for ( let y = 0; y < h; y ++ ) {

		raw[ y * ( w * 3 + 1 ) ] = 0;
		rgb.copy( raw, y * ( w * 3 + 1 ) + 1, y * w * 3, ( y + 1 ) * w * 3 );

	}
	const crcT = new Int32Array( 256 ).map( ( _, n ) => {

		let c = n;
		for ( let k = 0; k < 8; k ++ ) c = c & 1 ? 0xedb88320 ^ ( c >>> 1 ) : c >>> 1;
		return c;

	} );
	const crc = ( b ) => {

		let c = - 1;
		for ( let i = 0; i < b.length; i ++ ) c = crcT[ ( c ^ b[ i ] ) & 255 ] ^ ( c >>> 8 );
		return ( c ^ - 1 ) >>> 0;

	};
	const chunk = ( type, data ) => {

		const len = Buffer.alloc( 4 );
		len.writeUInt32BE( data.length );
		const td = Buffer.concat( [ Buffer.from( type ), data ] );
		const c = Buffer.alloc( 4 );
		c.writeUInt32BE( crc( td ) );
		return Buffer.concat( [ len, td, c ] );

	};
	const ihdr = Buffer.alloc( 13 );
	ihdr.writeUInt32BE( w, 0 ); ihdr.writeUInt32BE( h, 4 );
	ihdr[ 8 ] = 8; ihdr[ 9 ] = 2; ihdr[ 10 ] = 0; ihdr[ 11 ] = 0; ihdr[ 12 ] = 0;
	return Buffer.concat( [ Buffer.from( [ 137, 80, 78, 71, 13, 10, 26, 10 ] ), chunk( 'IHDR', ihdr ), chunk( 'IDAT', deflateSync( raw ) ), chunk( 'IEND', Buffer.alloc( 0 ) ) ] );

}
// the image: field x across (third base side left), field z down (center field at the top). A view: a
// window of the field frame and the pixels a cell (the whole park at 2; the close-ups at 6)
const WHOLE = { x0: X0, z0: Z0, x1: X1, z1: Z1, px: 2 };
function drawMap( name, cellsFn, view = WHOLE, outlines = null ) {

	const PX = view.px, IW = Math.round( ( view.x1 - view.x0 ) / CELL * PX ), IH = Math.round( ( view.z1 - view.z0 ) / CELL * PX );
	const toPx = ( fx, fz ) => [ ( fx - view.x0 ) / CELL * PX, ( fz - view.z0 ) / CELL * PX ];
	const img = Buffer.alloc( IW * IH * 3 );
	const put = ( x, y, [ r, g, b ], a = 1 ) => {

		x = Math.round( x ); y = Math.round( y );
		if ( x < 0 || y < 0 || x >= IW || y >= IH ) return;
		const o = ( y * IW + x ) * 3;
		img[ o ] = img[ o ] * ( 1 - a ) + r * a; img[ o + 1 ] = img[ o + 1 ] * ( 1 - a ) + g * a; img[ o + 2 ] = img[ o + 2 ] * ( 1 - a ) + b * a;

	};
	for ( let i = 0; i < img.length; i += 3 ) {

		img[ i ] = 24; img[ i + 1 ] = 25; img[ i + 2 ] = 28;

	}
	// a grid every 10 m (every 5 in a close-up), brighter every 50
	const g = PX > 2 ? 5 : 10;
	for ( let fx = Math.ceil( view.x0 / g ) * g; fx <= view.x1; fx += g ) for ( let y = 0; y < IH; y ++ ) put( toPx( fx, 0 )[ 0 ], y, fx % 50 === 0 ? [ 75, 75, 88 ] : fx % 10 === 0 ? [ 46, 46, 54 ] : [ 34, 34, 40 ] );
	for ( let fz = Math.ceil( view.z0 / g ) * g; fz <= view.z1; fz += g ) for ( let x = 0; x < IW; x ++ ) put( x, toPx( 0, fz )[ 1 ], fz % 50 === 0 ? [ 75, 75, 88 ] : fz % 10 === 0 ? [ 46, 46, 54 ] : [ 34, 34, 40 ] );
	const cellRect = ( c, col, a = 1 ) => {

		const [ fx, fz ] = fieldOfCell( c );
		const [ px, py ] = toPx( fx - CELL / 2, fz - CELL / 2 );
		if ( px < - PX || py < - PX || px > IW || py > IH ) return;
		for ( let u = 0; u < PX; u ++ ) for ( let v = 0; v < PX; v ++ ) put( px + u, py + v, col, a );

	};
	cellsFn( cellRect, put );
	const line = ( P, col, closed = true, alpha = 0.85 ) => {

		for ( let k = 0; k < P.length - ( closed ? 0 : 1 ); k ++ ) {

			const [ ax, ay ] = toPx( ...P[ k ] ), [ bx, by ] = toPx( ...P[ ( k + 1 ) % P.length ] );
			const n = Math.ceil( Math.hypot( bx - ax, by - ay ) * 1.5 ) + 1;
			for ( let t = 0; t <= n; t ++ ) put( ax + ( bx - ax ) * t / n, ay + ( by - ay ) * t / n, col, alpha );

		}

	};
	// the colliders in the view's heights: walkable floors' edges grey, walls (solid boxes) red
	if ( outlines ) for ( const b of C.boxes ) {

		const [ ha, hb ] = outlines;
		if ( b.top - FY0 < ha || b.bottom - FY0 > hb ) continue;
		const cs = [ [ - 1, - 1 ], [ 1, - 1 ], [ 1, 1 ], [ - 1, 1 ] ].map( ( [ a, d ] ) => toField( b.center.x + a * b.half.x * b.cos + d * b.half.z * b.sin, b.center.z - a * b.half.x * b.sin + d * b.half.z * b.cos ) );
		if ( cs.every( ( [ x, z ] ) => x < view.x0 || x > view.x1 ) || cs.every( ( [ x, z ] ) => z < view.z0 || z > view.z1 ) ) continue;
		if ( b.walkable ) line( cs, [ 160, 160, 170 ], true, 0.35 );
		else if ( b.solid && b.top - FY0 > ha + 0.6 ) line( cs, [ 255, 90, 90 ], true, 0.75 );

	}
	line( FOOTPRINT, [ 235, 235, 235 ] );
	line( D.pit, [ 150, 150, 160 ] );
	line( FB, [ 90, 200, 90 ] );
	// home plate and the start
	for ( let a = 0; a < 6.3; a += 0.05 ) {

		put( toPx( 0, 0 )[ 0 ] + Math.cos( a ) * 5, toPx( 0, 0 )[ 1 ] + Math.sin( a ) * 5, [ 255, 255, 255 ] );
		put( toPx( ...START.at )[ 0 ] + Math.cos( a ) * 7, toPx( ...START.at )[ 1 ] + Math.sin( a ) * 7, [ 255, 255, 255 ] );

	}
	// the elevators' stops
	for ( const bank of D.elev ) for ( const s of bank ) {

		const [ px, py ] = toPx( s.x, s.z );
		for ( let u = - 4; u <= 4; u ++ ) for ( let v = - 4; v <= 4; v ++ ) if ( Math.abs( u ) === 4 || Math.abs( v ) === 4 ) put( px + u, py + v, [ 0, 230, 255 ] );

	}
	writeFileSync( join( OUT, name ), png( IW, IH, img ) );
	return name;

}
const COL = {
	reached: [ 60, 190, 90 ], unreached: [ 255, 150, 30 ], fans: [ 50, 70, 140 ], blocked: [ 70, 60, 60 ],
	drop: [ 255, 40, 40 ], pop: [ 255, 0, 255 ], jump: [ 255, 240, 60 ],
};
const shade = ( col, k ) => col.map( ( v ) => Math.min( 255, Math.round( v * ( 0.55 + 0.45 * k ) ) ) );
const LEVEL_RANGE = [ [ - 1, 5.6 ], [ 5.6, 9.4 ], [ 9.4, 15 ], [ 15, 21.6 ], [ 21.6, 28.6 ], [ 28.6, 45 ] ];
const maps = [];
const paint = ( ha, hb ) => ( rect ) => {

	const inB = ( y ) => y - FY0 >= ha && y - FY0 < hb;
	for ( const k of cand ) if ( inB( k.y ) && k.state !== 'reached' && k.tag !== 'ground:outside' ) rect( k.c, COL[ k.state ] );
	for ( let id = 0; id < W.N.x.length; id ++ ) if ( inB( W.N.y[ id ] ) ) rect( W.N.c[ id ], shade( COL.reached, ( W.N.y[ id ] - FY0 - ha ) / ( hb - ha ) ) );
	for ( const id of jumpOnly ) if ( inB( J.N.y[ id ] ) ) rect( J.N.c[ id ], COL.jump, 0.8 );
	for ( const d of dropItems ) if ( inB( d.y ) ) rect( d.c, COL.drop );
	for ( const d of popItems ) if ( inB( d.y ) ) rect( d.c, COL.pop );

};
for ( let L = 0; L < 6; L ++ ) maps.push( drawMap( `level-${ L }.png`, paint( ...LEVEL_RANGE[ L ] ) ) );
// close-ups: [ name, x0, z0, x1, z1, heights ]
const ZOOMS = [
	[ 'lf-corner', - 135, - 135, - 40, - 15 ], [ 'rf-pavilion', 25, - 140, 125, 15 ], [ 'center-alley', - 75, - 160, 75, - 95 ],
	[ 'behind-home', - 85, 0, 85, 70 ],
];
const BANDS = [ [ 'low', - 1.5, 5.6 ], [ 'street', 5.6, 9.4 ], [ 'mid', 9.4, 21.6 ], [ 'high', 21.6, 45 ] ];
for ( const [ n, x0, z0, x1, z1 ] of ZOOMS ) for ( const [ b, ha, hb ] of BANDS ) maps.push( drawMap( `zoom-${ n }-${ b }.png`, paint( ha, hb ), { x0, z0, x1, z1, px: 6 }, [ ha, hb ] ) );
// all levels at once: the highest reached floor in each cell, by height
maps.push( drawMap( 'all-levels.png', ( rect ) => {

	const top = new Map();
	for ( let id = 0; id < W.N.x.length; id ++ ) top.set( W.N.c[ id ], Math.max( top.get( W.N.c[ id ] ) ?? - 99, W.N.y[ id ] - FY0 ) );
	for ( const k of cand ) if ( k.state === 'unreached' && k.tag !== 'ground:outside' && ! top.has( k.c ) ) rect( k.c, COL.unreached );
	for ( const [ c, h ] of top ) {

		const t = Math.max( 0, Math.min( 1, h / 40 ) );
		rect( c, [ Math.round( 40 + 200 * t ), Math.round( 170 - 60 * t ), Math.round( 80 + 150 * t ) ] );

	}
	for ( const d of dropItems ) rect( d.c, COL.drop );

} ) );

// (FA3) the seated fans the walker can get to: a reached floor at his row's height (within 0.35 m) no
// more than 9 m off along the ground (an aisle at the row's end: the middle of a 16 m section is 8 m
// from either)
let fansReached = 0;
const fansByTag = {};
{

	const R = Math.ceil( 9 / CELL );
	for ( let k = 0; k < D.fans.length; k += 3 ) {

		const x = D.fans[ k ], y = D.fans[ k + 1 ], z = D.fans[ k + 2 ];
		const c = cellOf( x, z );
		if ( c < 0 ) continue;
		const ci = c % NX, cj = Math.floor( c / NX );
		let ok = false;
		for ( let dj = - R; dj <= R && ! ok; dj ++ ) for ( let di = - R; di <= R && ! ok; di ++ ) {

			if ( di * di + dj * dj > R * R ) continue;
			const L = W.seen.get( ( cj + dj ) * NX + ci + di );
			if ( L ) for ( const id of L ) if ( Math.abs( W.N.y[ id ] - y ) < 0.35 ) {

				ok = true; break;

			}

		}
		const b = groundBox( x, z, y + 0.05 ), t = b ? b.tag : '?';
		const e = fansByTag[ t ] ||= { fans: 0, reached: 0 };
		e.fans ++;
		if ( ok ) {

			fansReached ++; e.reached ++;

		}

	}

}
const fallEdges = ( F, min = 1.0 ) => F.drops.filter( ( d ) => d.h > min ).length;
const score = {
	fans: D.fans.length / 3, fansReached, nodes: W.N.x.length, falls: fallEdges( W ), walkerFalls: Object.values( walkFalls ).reduce( ( a, e ) => a + e.walkerFalls, 0 ),
	fallsTo: Object.fromEntries( Object.entries( intoPit ).map( ( [ k, v ] ) => [ k, v.edges ] ) ), pops: W.pops.length, popsOver1m: W.pops.filter( ( p ) => p.h > 1 ).length,
	holesM2: Math.round( Object.values( holes ).reduce( ( a, e ) => a + e.holeM2, 0 ) * 100 ) / 100, jumpOnlyCells: jumpOnly.length,
};
console.log( 'score', JSON.stringify( score ) );

const summary = {
	score, fansByTag,
	time: new Date().toISOString(), ms: Date.now() - t0, counts: D.counts, nodes: W.N.x.length, perLevel: Object.fromEntries( LEVEL_NAMES.map( ( n, k ) => [ n, perLevel[ k ] ] ) ),
	elevators: elevReport, perTag, unreached: unreachedClusters.slice( 0, 60 ), drops: dropClusters.slice( 0, 60 ), pops: popClusters.slice( 0, 30 ),
	jumpOnly: jumpClusters.slice( 0, 40 ), jumpEdges: jumpEdgeClusters.slice( 0, 40 ), intoPit, dropsByTag, walkFalls, holes, holeSpots: holeSpots.slice( 0, 60 ), firstInto, stripEnds, maps,
};
writeFileSync( join( OUT, 'summary.json' ), JSON.stringify( summary, null, 1 ) );
// the fill itself, compact, for paths and checks: field x, height, z per node and its parent
writeFileSync( join( OUT, 'nodes.json' ), JSON.stringify( { X0, Z0, CELL, NX, NZ, n: W.N.x.length, f: W.N.x.map( ( x, id ) => {

	const [ fx, fz ] = toField( x, W.N.z[ id ] );
	return [ r1( fx ), Math.round( ( W.N.y[ id ] - FY0 ) * 100 ) / 100, r1( fz ), W.N.parent[ id ] ];

} ) } ) );

console.log( `done in ${ ( ( Date.now() - t0 ) / 1000 ).toFixed( 1 ) } s: ${ OUT }` );
