import { tierSections, rowHeights, SEAT_W } from '../../Stands.js';
import { sectionAt } from '../../Concourse.js';

// The seats behind home plate, exactly where the stands put them (Stands.buildTier's own walk along
// the field level's sections, rows and aisles, portals and all), so the place can empty the ones it
// sits its own people in (Crowd.vacate) and put each person square on his seat.
//
// Field frame. The field level's sections round home plate (tierSections of the bowl's first tier):
//   8   the first base side's angled section, from the dugout's home end to the backstop's corner
//   9   straight behind the backstop (the TV's backdrop), its rows opening out along both corners
//   10  the third base side's angled section (a portal, the tunnel to the concourse, in its middle)
// Each seat: { sec, row (0 = the front), i (along the row from its section's start), n (seats in the
// row), x, y (the tread), z, yaw (facing the field), ux, uz (along the row, toward i + 1), rx, rz (the
// figure's right side), num (the section's number, as the park's signs have it), occupied (a crowd fan
// would sit here: the seat is down) }.
//
// The aisles: aisle( key, d ) is the point on the aisle's middle d metres back from the front line, with
// the tread's height: key 'A' between 8 and 9 (first base side of the backstop), 'B' between 9 and 10,
// 'C' at the first base dugout's home end (7 | 8), 'D' at the third base dugout's (10 | 11).
export const SECS = [ 8, 9, 10 ];

export class SeatMap {

	constructor( bowl ) {

		const tier = this.tier = bowl.tiers[ 0 ];
		const secs = this.secs = tierSections( tier );
		const ys0 = rowHeights( tier );
		// the rows' heights here (the Diamond Club's front rows sit low: Bowl's tier.rowY)
		const ys = this.ys = ys0.map( ( y, r ) => tier.rowY ? tier.rowY( secs[ 9 ], r, y ) : y );
		const D = this.D = tier.depth, A = tier.aisle ?? 1.2, W = tier.seat ?? SEAT_W, S0 = this.S0 = tier.start || 0;
		this.rows = tier.rows;
		// the portals (as buildTier finds them)
		const PO = tier.portals, portals = [];
		secs.forEach( ( S, k ) => {

			if ( ! PO || ! S.seats || S.len < PO.width + 3 || k % PO.every !== Math.floor( PO.every / 2 ) ) return;
			portals.push( { S, s: S.len / 2, r0: PO.row, r1: PO.row + PO.rows } );

		} );
		const inPortal = ( S, s, r ) => portals.some( ( p ) => p.S === S && r >= p.r0 - 1 && r < p.r1 && Math.abs( s - p.s ) < PO.width / 2 + 0.35 );
		this.portals = portals.filter( ( p ) => SECS.includes( secs.indexOf( p.S ) ) );
		const occupied = bowl.crowd?.occupied ? ( e ) => bowl.crowd.occupied( { elements: e } ) : () => true;
		this.list = [];
		this.bySec = {};
		for ( const k of SECS ) {

			const S = secs[ k ];
			const rows = this.bySec[ k ] = [];
			const at = ( s, d ) => [ S.a[ 0 ] + S.ux * s + S.nx * d, S.a[ 1 ] + S.uz * s + S.nz * d ];
			const yaw = Math.atan2( S.nx, S.nz );
			for ( let r = S.skipRows || 0; r < tier.rows; r ++ ) {

				const d0 = S0 + r * D;
				const dSeat = d0 + D * 0.55;
				const s0 = Math.min( S.len, S.m0 * dSeat ), s1 = Math.max( s0, S.len - S.m1 * dSeat );
				const lo = s0 + A / 2, hi = s1 - A / 2;
				const n = Math.floor( ( hi - lo ) / W );
				const row = [];
				rows[ r ] = row;
				if ( n < 1 ) continue;
				const start = lo + ( hi - lo - n * W ) / 2 + W / 2;
				for ( let i = 0; i < n; i ++ ) {

					const s = start + i * W;
					if ( portals.length && inPortal( S, s, r ) ) continue;
					const [ x, z ] = at( s, dSeat );
					const y = tier.rowY ? tier.rowY( S, r, ys0[ r ] ) : ys0[ r ];
					// the seat's matrix elements the crowd hashes (its translation)
					const e = [];
					e[ 12 ] = x; e[ 13 ] = y; e[ 14 ] = z;
					const seat = {
						sec: k, row: r, i, n, s, x, y, z, yaw, ux: S.ux, uz: S.uz,
						rx: Math.cos( yaw ), rz: - Math.sin( yaw ), nx: S.nx, nz: S.nz,
						num: sectionAt( x, z ), occupied: occupied( e ), taken: null,
					};
					row.push( seat );
					this.list.push( seat );

				}

			}

		}

		// the aisles: the corners' bisectors (the rows of the sections either side end on them)
		const aisleAt = ( S, atStart ) => ( d ) => {

			const dd = S0 + d;
			const s = atStart ? S.m0 * dd : S.len - S.m1 * dd;
			return [ S.a[ 0 ] + S.ux * s + S.nx * dd, S.a[ 1 ] + S.uz * s + S.nz * dd ];

		};
		this._aisle = { A: aisleAt( secs[ 9 ], true ), B: aisleAt( secs[ 10 ], true ), C: aisleAt( secs[ 8 ], true ), D: aisleAt( secs[ 11 ], true ) };
		// a grid of the seats taken by the place, for the crowd's test (cells of a quarter metre)
		this._cells = new Map();

	}

	// the tread's height d metres back from the front line (a step at each row's front edge, the riser
	// eased over its last few centimetres so a foot doesn't jump)
	treadAt( d ) {

		const r = Math.max( 0, Math.min( this.rows - 1, Math.floor( ( d - this.S0 ) / this.D ) ) );
		const f = ( d - this.S0 ) / this.D - r;
		const y = this.ys[ r ], yn = this.ys[ Math.min( this.rows - 1, r + 1 ) ];
		return y + ( yn - y ) * smooth( ( f - 0.9 ) / 0.1 );

	}

	// the middle of an aisle d metres back: [ x, y, z ]
	aisle( key, d ) {

		const [ x, z ] = this._aisle[ key ]( d );
		return [ x, this.treadAt( d ), z ];

	}

	// the depth of row r's seats (its tread's middle), for the aisles
	rowD( r ) {

		return this.S0 + r * this.D + this.D * 0.55 - this.S0;

	}

	seat( sec, row, i ) {

		const R = this.bySec[ sec ]?.[ row ];
		return R && R[ Math.max( 0, Math.min( R.length - 1, i ) ) ] || null;

	}

	// the seat is the place's (its crowd fan will be vacated)
	take( seat, who ) {

		if ( ! seat || seat.taken ) return false;
		seat.taken = who;
		const k = Math.floor( seat.x * 4 ) + ',' + Math.floor( seat.z * 4 );
		if ( ! this._cells.has( k ) ) this._cells.set( k, [] );
		this._cells.get( k ).push( seat );
		return true;

	}

	// the test for Crowd.vacate: the world position of a crowd fan's seat -> is it one of ours?
	vacateTest( field ) {

		const F = field;
		return ( p ) => {

			const [ x, z ] = F.toField( p.x, p.z );
			if ( z < 10 || z > 50 || Math.abs( x ) > 40 ) return false;
			const cx = Math.floor( x * 4 ), cz = Math.floor( z * 4 );
			for ( let i = - 1; i <= 1; i ++ ) for ( let j = - 1; j <= 1; j ++ ) {

				const L = this._cells.get( ( cx + i ) + ',' + ( cz + j ) );
				if ( L ) for ( const s of L ) if ( Math.abs( s.x - x ) < 0.08 && Math.abs( s.z - z ) < 0.08 ) return true;

			}

			return false;

		};

	}

}

function smooth( x ) {

	const t = Math.max( 0, Math.min( 1, x ) );
	return t * t * ( 3 - 2 * t );

}
