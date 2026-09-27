import { tierSections, rowHeights, SEAT_W } from '../../Stands.js';

// The seats behind home plate, exactly where the stands put them (Stands.buildTier's own walk along
// the field level's sections, rows and aisles, portals and all), so the place can empty the ones it
// sits its own people in (Crowd.vacate) and put each person square on his seat.
//
// Field frame. The Diamond Club (Bowl's field level tier, split as the 2008 seating chart has it): seven
// sections between the dugouts' home ends, in the tier's order from the first base side,
//   G  F     on the first base side's angled face (G by the Phillies' dugout)
//   E  D  C  on the backstop's face (D dead centre, x -2.3 .. 2.3)
//   B  A     on the third base side's (A by the visitors' dugout)
// their rows climbing back to the main concourse at z ~45 (behind the club's own rows, the chart's
// 122-125; the stands are one sweep of rows here).
// Each seat: { sec (the letter), row (0 = the front), i (along the row from its section's start), n,
// x, y (the tread), z, yaw (facing the field), ux, uz (along the row, toward i + 1), rx, rz (the
// figure's right side), nx, nz (back, away from the field), occupied (a crowd fan would sit here: the
// seat is down), taken }.
//
// The aisles: aisle( key, d ) is the point on the aisle's middle d metres back from the first row's
// front, with its tread's height. key: two letters, the sections either side in the tier's order ('ED'
// between E and D: first base side of D; 'DC' third base side), or 'xG' / 'Ax' at the dugouts' ends.
export const CLUB = [ 'G', 'F', 'E', 'D', 'C', 'B', 'A' ];
// the club's rows: its 1,258 "extra-wide, padded seats" (the 2008 guide) fill the seven sections' first
// eighteen rows here
export const CLUB_ROWS = 18;

export class SeatMap {

	constructor( bowl ) {

		const tier = this.tier = bowl.tiers[ 0 ];
		const secs = this.secs = tierSections( tier );
		const ys0 = rowHeights( tier );
		const D = this.D = tier.depth, A = tier.aisle ?? 1.2, W = tier.seat ?? SEAT_W, S0 = this.S0 = tier.start || 0;
		this.rows = tier.rows;
		// the club's sections: those between the two dugouts (the only sections short of their first rows)
		const dug = secs.map( ( S, i ) => S.skipRows ? i : - 1 ).filter( ( i ) => i >= 0 );
		const kFirst = Math.min( ...dug.map( ( i ) => secs[ i ].k ) );
		const iG = Math.max( ...dug.filter( ( i ) => secs[ i ].k === kFirst ) ) + 1;
		this.sec = {};
		CLUB.forEach( ( L, j ) => {

			const S = secs[ iG + j ];
			S.letter = L;
			S.index = iG + j;
			this.sec[ L ] = S;

		} );
		// the rows' heights here (the club's front rows sit low: Bowl's tier.rowY)
		const ys = this.ys = ys0.map( ( y, r ) => tier.rowY ? tier.rowY( this.sec.D, r, y ) : y );
		// the portals (as buildTier finds them)
		const PO = tier.portals, portals = [];
		secs.forEach( ( S, k ) => {

			if ( ! PO || ! S.seats || S.len < PO.width + 3 || ( S.pk ?? k ) % PO.every !== Math.floor( PO.every / 2 ) ) return;
			portals.push( { S, s: S.len / 2, r0: PO.row, r1: PO.row + PO.rows } );

		} );
		const inPortal = ( S, s, r ) => portals.some( ( p ) => p.S === S && r >= p.r0 - 1 && r < p.r1 && Math.abs( s - p.s ) < PO.width / 2 + 0.35 );
		const occupied = bowl.crowd?.occupied ? ( e ) => bowl.crowd.occupied( { elements: e } ) : () => true;
		this.list = [];
		this.bySec = {};
		for ( const L of CLUB ) {

			const S = this.sec[ L ];
			const rows = this.bySec[ L ] = [];
			const at = ( s, d ) => [ S.a[ 0 ] + S.ux * s + S.nx * d, S.a[ 1 ] + S.uz * s + S.nz * d ];
			const yaw = Math.atan2( S.nx, S.nz );
			for ( let r = 0; r < tier.rows; r ++ ) {

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
						sec: L, row: r, i, n, s, x, y, z, yaw, ux: S.ux, uz: S.uz,
						rx: Math.cos( yaw ), rz: - Math.sin( yaw ), nx: S.nx, nz: S.nz,
						num: L, occupied: occupied( e ), taken: null,
					};
					row.push( seat );
					this.list.push( seat );

				}

			}

		}

		// the aisles: at the start of the section after each (the corners' bisectors; the backstop's
		// splits run straight back)
		const aisleAt = ( T ) => ( d ) => {

			const dd = S0 + d, s = T.m0 * dd;
			return [ T.a[ 0 ] + T.ux * s + T.nx * dd, T.a[ 1 ] + T.uz * s + T.nz * dd ];

		};
		this._aisle = {};
		this.aisleSides = {};
		for ( let j = 0; j < CLUB.length - 1; j ++ ) {

			const key = CLUB[ j ] + CLUB[ j + 1 ];
			this._aisle[ key ] = aisleAt( this.sec[ CLUB[ j + 1 ] ] );
			this.aisleSides[ key ] = [ CLUB[ j ], CLUB[ j + 1 ] ];

		}

		this._aisle.xG = aisleAt( this.sec.G );
		this.aisleSides.xG = [ null, 'G' ];
		this._aisle.Ax = aisleAt( secs[ this.sec.A.index + 1 ] );
		this.aisleSides.Ax = [ 'A', null ];
		// a grid of the seats taken by the place, for the crowd's test (cells of a quarter metre)
		this._cells = new Map();

	}

	// the tread's height d metres back from the first row's front (a step at each row's front edge,
	// the riser eased over its last few centimetres so a foot doesn't jump)
	treadAt( d ) {

		const r = Math.max( 0, Math.min( this.rows - 1, Math.floor( d / this.D ) ) );
		const f = d / this.D - r;
		const y = this.ys[ r ], yn = this.ys[ Math.min( this.rows - 1, r + 1 ) ];
		return y + ( yn - y ) * smooth( ( f - 0.9 ) / 0.1 );

	}

	// the middle of an aisle d metres back: [ x, y, z ]
	aisle( key, d ) {

		const [ x, z ] = this._aisle[ key ]( d );
		return [ x, this.treadAt( d ), z ];

	}

	// the depth of row r's seats along an aisle (its tread's middle)
	rowD( r ) {

		return r * this.D + this.D * 0.55;

	}

	// the seats of row r on one side of an aisle, from the aisle in: side +1 the section after it
	// (from its first seat), -1 the one before (from its last)
	fromAisle( key, r, side ) {

		const L = this.aisleSides[ key ][ side > 0 ? 1 : 0 ];
		const row = L ? this.bySec[ L ][ r ] || [] : [];
		return side > 0 ? row : row.slice().reverse();

	}

	// the direction along a row from the aisle into it ([ x, z ])
	intoRow( key, side ) {

		const L = this.aisleSides[ key ][ side > 0 ? 1 : 0 ];
		const S = this.sec[ L ];
		return [ S.ux * side, S.uz * side ];

	}

	seat( sec, row, i ) {

		const R = this.bySec[ sec ]?.[ row ];
		return R && R[ Math.max( 0, Math.min( R.length - 1, i ) ) ] || null;

	}

	// the seat of `row` nearest x, in whichever of the club's sections, that the place hasn't got yet
	nearest( row, x, ok = ( s ) => s.occupied ) {

		let best = null, bd = Infinity;
		for ( const L of CLUB ) for ( const s of this.bySec[ L ][ row ] || [] ) {

			const d = Math.abs( s.x - x );
			if ( d < bd && ! s.taken && ok( s ) ) {

				bd = d;
				best = s;

			}

		}

		return best;

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
			if ( z < 7 || z > 50 || Math.abs( x ) > 40 ) return false;
			// (the suites' seats hang over the back rows: the height too)
			const y = p.y - F.y0;
			const cx = Math.floor( x * 4 ), cz = Math.floor( z * 4 );
			for ( let i = - 1; i <= 1; i ++ ) for ( let j = - 1; j <= 1; j ++ ) {

				const L = this._cells.get( ( cx + i ) + ',' + ( cz + j ) );
				if ( L ) for ( const s of L ) if ( Math.abs( s.x - x ) < 0.08 && Math.abs( s.z - z ) < 0.08 && Math.abs( s.y - y ) < 0.3 ) return true;

			}

			return false;

		};

	}

}

function smooth( x ) {

	const t = Math.max( 0, Math.min( 1, x ) );
	return t * t * ( 3 - 2 * t );

}
