import { Float32BufferAttribute } from '../../../engine/index.js';
import { StorageBuffer } from '../../../engine/gpu/Texture.js';
import { Builder, paletteMaterial } from './Build.js';
import { hash } from './Fans.js';
import { CLUB, CLUB_ROWS } from './Seats.js';

// The Diamond Club's front: behind the backstop's padded wall the front row sits low, and between the
// pads' back and the row is a ledge at the height of the pads' top, where the front row puts down what
// it's holding: cups, a water bottle, a tray of nachos, the program, a flip phone, a camera, the gloves
// taken off to eat (heston's Game 3 photo, flickr 2986440011: red cups, bottles and food along it, the
// fans' forearms on the pads). What's on it is the night's: more hot chocolate on the 27th, the rain
// beaded on everything; the 29th's beer and a pair of gloves.
//
// Field frame; the three faces of the backstop (the front line of the sections behind home plate).

// the ledge: from the pads' back (0.37 m behind the wall's face) to over the front row's toes
export const LEDGE = { d0: 0.37, d1: 0.56, y: 1.46 };

export function buildClub( seats, b = new Builder() ) {

	// the ledge along each face: an apron down to the front row's tread, the slab on top
	for ( const L of CLUB ) {

		const S = seats.sec[ L ];
		const o = [ S.a[ 0 ], 0, S.a[ 1 ] ];
		const P = Builder.frame( o, [ S.ux, S.uz ], [ S.nx, S.nz ] );
		// the faces' ends meet on the corners' bisectors: extend each a little along the mitres
		const e0 = S.m0 * LEDGE.d1, e1 = S.len - S.m1 * LEDGE.d1;
		const len = e1 - e0, mid = ( e0 + e1 ) / 2;
		const y0 = seats.ys[ 0 ];
		b.use( 'ledge' ).box( P, mid, LEDGE.y - 0.02, ( LEDGE.d0 + LEDGE.d1 ) / 2, len, 0.04, LEDGE.d1 - LEDGE.d0 );
		b.use( 'ledge' ).box( P, mid, ( y0 + LEDGE.y - 0.04 ) / 2, LEDGE.d0 + 0.02, len, LEDGE.y - 0.04 - y0, 0.04 );
		// brackets under the slab every 1.5 m
		for ( let s = e0 + 0.4; s < e1 - 0.2; s += 1.5 ) b.use( 'ledge' ).box( P, s, LEDGE.y - 0.1, LEDGE.d0 + 0.1, 0.03, 0.12, 0.16 );

	}

	// the club's seats padded: a navy vinyl cushion on the pan and one on the back, piped ("1,258
	// extra-wide, padded seats", the 2008 guide), beaded with the rain on the 27th (the palette's wet)
	// (---- FK1 repair: the pan's cushion is buildPads()'s, below: it folds with the pan)
	for ( const seat of seats.list ) {

		if ( seat.row >= CLUB_ROWS ) continue;
		const P = Builder.frame( [ seat.x, seat.y, seat.z ], [ seat.rx, seat.rz ], [ seat.nx, seat.nz ] );
		b.use( 'pad' ).box( P, 0, 0.64, 0.155, 0.42, 0.3, 0.045 );
		b.use( 'padSeam' ).box( P, 0, 0.795, 0.16, 0.42, 0.012, 0.05 );

	}

	// what's on it, in front of each front-row seat the place has
	for ( const seat of seats.list ) {

		if ( seat.row !== 0 || ! seat.taken ) continue;
		const S = seats.sec[ seat.sec ];
		const d = LEDGE.d0 + 0.13;
		const o = [ seat.x - S.nx * ( 0.84 - d ), LEDGE.y, seat.z - S.nz * ( 0.84 - d ) ];
		const P = Builder.frame( o, [ S.ux, S.uz ], [ - S.nx, - S.nz ] );
		const h = hash( seat.x * 3.1 + seat.z * 1.7 );
		for ( const night of [ 27, 29 ] ) {

			b.night( night );
			const r = ( k ) => hash( h * 91 + k * 7.3 + night );
			const n = r( 1 ) < 0.25 ? 0 : r( 2 ) < 0.6 ? 1 : 2;
			for ( let j = 0; j < n; j ++ ) {

				const x = ( j === 0 ? - 0.1 : 0.12 ) + ( r( 3 + j ) - 0.5 ) * 0.08, z = ( r( 5 + j ) - 0.5 ) * 0.1;
				item( b, P, x, z, pickItem( r( 9 + j ), night ), r( 11 + j ) );

			}

		}

		b.night( 0 );

	}

	return b;

}

// ---- FK1 repair (step 12, SC1-1 in the Diamond Club): the cushions on the club's 1,258 pans, in a mesh of
// their own that folds each with its pan. They were static boxes among the ledge's things: FX2's fold
// turned the plastic pan up behind a standing fan (Stands.js, the seats' vertex stage) and left the
// cushion flat at his knees with nothing under it, in every row behind home plate at every rally, and on
// every seat emptied in the rain delay. Each cushion turns about its pan's back edge by the same weight:
//   a seat with one of the crowd's fans: his stand weight and his vacated bit, read from the crowd's own
//     buffers as the pan reads them (the fan found once, by his seat, when the crowd has seated itself);
//   a seat the place has given one of its own people (the front rows, the regulars: the crowd's fan there
//     is vacated, so its plastic pan is up for good): how far up he is (Fans.js `up`), written when it changes;
//   a seat nobody has (built folded): up.
// One draw (the palette's material with the fold in its vertex stage), the triangles the cushions had.
// update(): after the place's fans have moved.
export function buildPads( seats, { crowd = null, field = null } = {} ) {

	const b = new Builder(), list = seats.list.filter( ( s ) => s.row < CLUB_ROWS );
	const aSeat = [], aPad = [], data = new Float32Array( Math.max( 1, list.length ) * 4 ), own = [];
	list.forEach( ( seat, k ) => {

		const P = Builder.frame( [ seat.x, seat.y, seat.z ], [ seat.rx, seat.rz ], [ seat.nx, seat.nz ] );
		const n0 = b.pos.length / 3;
		b.use( 'pad' ).box( P, 0, 0.465, - 0.08, 0.44, 0.05, 0.4 );
		for ( let i = n0; i < b.pos.length / 3; i ++ ) {

			aSeat.push( seat.x, seat.y, seat.z, seat.yaw );
			aPad.push( k );

		}

		// the seat's code (x): - 2 one of the place's own (y: how far up), - 1 up for good, 0 down (and a
		// crowd's fan's number + 1 once he is found)
		const f = seat.taken;
		if ( f && typeof f.up === 'number' ) own.push( [ k, f ] );
		data[ k * 4 ] = f ? ( typeof f.up === 'number' ? - 2 : - 1 ) : seat.occupied ? 0 : - 1;

	} );
	const live = !! ( crowd && ! crowd.off && crowd.poseBuf && crowd.idsBuf );
	const buf = new StorageBuffer( { label: 'home pads', count: Math.max( 1, list.length ), type: 'vec4f', data } );
	const material = paletteMaterial( 'home-pads', {
		storage: live ? { hmPad: buf, cwPoseBuf: crowd.poseBuf, cwIds: crowd.idsBuf } : { hmPad: buf },
		attributes: { aSeat: 'vec4f', aPad: 'f32' },
		// the pan's own turn (Stands.js, the seats' material): about its back edge, which drops and comes
		// forward as it goes, from flat to 15 degrees off upright; the cushion's thickness carried round on it
		vertex: /* wgsl */`
	{
		let pd = hmPad[ u32( v.aPad + 0.5 ) ];
		var up = 0.0;
		${ live ? `if ( pd.x > 0.5 ) {
			let fan = u32( pd.x + 0.5 ) - 1u;
			let st = cwPoseBuf[ fan * ( arrayLength( &cwPoseBuf ) / arrayLength( &cwIds ) ) ].x;
			up = select( smoothstep( 0.15, 0.6, st ), 1.0, ( cwIds[ fan ].z >> 31u ) == 1u );
		} else ` : '' }if ( pd.x < - 1.5 ) {
			up = pd.y;
		} else if ( pd.x < - 0.5 ) {
			up = 1.0;
		}
		let cy = cos( v.aSeat.w );
		let sy = sin( v.aSeat.w );
		let d = v.position - v.aSeat.xyz;
		let lx = d.x * cy - d.z * sy;
		let m = 0.14 - ( d.x * sy + d.z * cy );
		let t = d.y - 0.44;
		let nx = v.normal.x * cy - v.normal.z * sy;
		let nz = v.normal.x * sy + v.normal.z * cy;
		let a = up * 1.8553 - 0.0227;
		let ca = cos( a );
		let sa = sin( a );
		let ms = m * mix( 1.0, 0.8464, up );
		let y1 = mix( 0.44, 0.26, up ) + sa * ms + ca * t;
		let z1 = mix( 0.14, 0.02, up ) - ca * ms + sa * t;
		let nz1 = sa * v.normal.y + ca * nz;
		v.position = v.aSeat.xyz + vec3f( cy * lx + sy * z1, y1, - sy * lx + cy * z1 );
		v.normal = vec3f( cy * nx + sy * nz1, ca * v.normal.y - sa * nz, - sy * nx + cy * nz1 );
	}
`,
	} );
	const mesh = b.mesh( material, 'home-pads' );
	mesh.geometry.setAttribute( 'aSeat', new Float32BufferAttribute( aSeat, 4 ) );
	mesh.geometry.setAttribute( 'aPad', new Float32BufferAttribute( aPad, 1 ) );
	let found = ! live;
	// each of the crowd's fans in the club's seats, by where he sits (the crowd's own list, the world's frame)
	const find = () => {

		const S = crowd._seats, cells = new Map();
		for ( let f = 0; f < crowd.count; f ++ ) {

			const [ x, z ] = field.toField( S[ f * 4 ], S[ f * 4 + 2 ] );
			if ( z < 5 || z > 50 || Math.abs( x ) > 42 ) continue;
			const key = Math.floor( x * 4 ) + ',' + Math.floor( z * 4 );
			if ( ! cells.has( key ) ) cells.set( key, [] );
			cells.get( key ).push( [ x, S[ f * 4 + 1 ] - field.y0, z, f ] );

		}

		list.forEach( ( seat, k ) => {

			if ( data[ k * 4 ] !== 0 ) return;
			const cx = Math.floor( seat.x * 4 ), cz = Math.floor( seat.z * 4 );
			for ( let i = - 1; i <= 1; i ++ ) for ( let j = - 1; j <= 1; j ++ ) for ( const [ x, y, z, f ] of cells.get( ( cx + i ) + ',' + ( cz + j ) ) || [] ) {

				if ( Math.abs( x - seat.x ) < 0.08 && Math.abs( z - seat.z ) < 0.08 && Math.abs( y - seat.y ) < 0.3 ) data[ k * 4 ] = f + 1;

			}

		} );

	};
	const update = () => {

		let dirty = false;
		if ( ! found && crowd._seats && field ) {

			find();
			found = dirty = true;

		}

		for ( const [ k, f ] of own ) {

			// (as the pan takes a fan's stand weight: off it by 0.15, all the way by 0.6)
			const s = Math.min( 1, Math.max( 0, ( f.up * f.up * ( 3 - 2 * f.up ) - 0.15 ) / 0.45 ) ), u = s * s * ( 3 - 2 * s );
			if ( Math.abs( u - data[ k * 4 + 1 ] ) > 0.004 ) {

				data[ k * 4 + 1 ] = u;
				dirty = true;

			}

		}

		if ( dirty ) buf.write( data );

	};
	return { mesh, update, seats: list.length, own: own.length, data };

}
// ---- end FK1 repair

function pickItem( x, night ) {

	const T = night === 27
		? [ [ 'cocoa', 5 ], [ 'beer', 3 ], [ 'soda', 2 ], [ 'water', 1.5 ], [ 'nachos', 1 ], [ 'program', 1 ], [ 'phone', 0.7 ], [ 'peanuts', 0.8 ], [ 'towel', 1.2 ] ]
		: [ [ 'beer', 5 ], [ 'cocoa', 3 ], [ 'soda', 2 ], [ 'water', 1 ], [ 'nachos', 1 ], [ 'program', 1 ], [ 'phone', 0.8 ], [ 'gloves', 1.2 ], [ 'camera', 0.7 ], [ 'peanuts', 1 ], [ 'hotdog', 0.8 ] ];
	let sum = 0;
	for ( const [ , w ] of T ) sum += w;
	let v = x * sum;
	for ( const [ k, w ] of T ) {

		v -= w;
		if ( v <= 0 ) return k;

	}

	return 'beer';

}

// one thing on a surface at ( x, z ) in frame P (its top at y 0)
export function item( b, P, x, z, kind, r = 0.5 ) {

	switch ( kind ) {

		case 'beer':
			// a clear 20 oz cup of lager, its head gone flat
			b.use( 'beer' ).cyl( P, x, z, 0, 0.14, 0.034, 0.045, 10, false );
			b.use( 'foam' ).cyl( P, x, z, 0.14, 0.15, 0.045, 0.045, 10 );
			break;
		case 'soda':
			b.use( 'cupRed' ).cyl( P, x, z, 0, 0.16, 0.036, 0.047, 10 );
			b.use( 'white' ).cyl( P, x, z, 0.16, 0.168, 0.048, 0.046, 10 );
			b.use( 'white' ).cyl( P, x + 0.012, z, 0.168, 0.24, 0.0035, 0.0035, 4, false );
			break;
		case 'cocoa':
			b.use( 'cupWhite' ).cyl( P, x, z, 0, 0.11, 0.03, 0.04, 10, false );
			b.use( 'sleeve' ).cyl( P, x, z, 0.03, 0.075, 0.034, 0.037, 10, false );
			b.use( 'lid' ).cyl( P, x, z, 0.11, 0.125, 0.041, 0.036, 10 );
			break;
		case 'water':
			b.use( 'water' ).cyl( P, x, z, 0, 0.17, 0.033, 0.033, 8, false );
			b.use( 'water' ).cyl( P, x, z, 0.17, 0.2, 0.033, 0.013, 8, false );
			b.use( 'capBlue' ).cyl( P, x, z, 0.2, 0.215, 0.014, 0.014, 6 );
			break;
		case 'nachos':
			b.use( 'tray' ).box( P, x, 0.02, z, 0.16, 0.04, 0.12 );
			b.use( 'chips' ).box( P, x + 0.02, 0.045, z, 0.1, 0.02, 0.09 );
			b.use( 'cheese' ).cyl( P, x - 0.05, z, 0.02, 0.05, 0.028, 0.028, 8 );
			break;
		case 'program':
			b.use( 'navy' ).box( P, x, 0.006, z, 0.21, 0.012, 0.28 );
			break;
		case 'phone':
			b.use( 'black' ).box( P, x, 0.01, z, 0.05, 0.02, 0.095 );
			break;
		case 'camera':
			b.use( 'steel' ).box( P, x, 0.03, z, 0.1, 0.06, 0.025 );
			break;
		case 'gloves':
			b.use( r < 0.5 ? 'black' : 'red' ).box( P, x, 0.012, z, 0.09, 0.024, 0.18 );
			b.use( r < 0.5 ? 'black' : 'red' ).box( P, x + 0.04, 0.03, z + 0.02, 0.09, 0.02, 0.17 );
			break;
		case 'peanuts':
			b.use( 'kraft' ).box( P, x, 0.09, z, 0.12, 0.18, 0.05 );
			break;
		case 'hotdog':
			b.use( 'foil' ).box( P, x, 0.02, z, 0.08, 0.04, 0.18 );
			break;
		case 'towel':
			// a rally towel left folded, soaked
			b.use( 'towelWet' ).box( P, x, 0.01, z, 0.18, 0.02, 0.22 );
			break;

	}

}
