// Build src/ballpark/data/complex.js from an OpenStreetMap Overpass export of the South Philadelphia
// Sports Complex and the blocks round it (buildings, parking lots, street lamps, trees, highways, rail,
// grass), converted to the field frame (layout.js) in metres.
//
//   node tools/build-complex.mjs complex.json src/ballpark/data/complex.js
//
// The Overpass query is in the header of the output. Things built after the 2008 World Series are left
// out (Xfinity Live! on the Spectrum's site, the Live! casino), and so are the venues modelled by hand
// (the ballpark itself, the Linc, the Wachovia Center).
import { readFileSync, writeFileSync } from 'node:fs';
import { HOME_LATLON, FIELD_BEARING, FOOTPRINT } from '../src/ballpark/layout.js';

const [ , , input, output ] = process.argv;
const osm = JSON.parse( readFileSync( input, 'utf8' ) );
const [ lat0, lon0 ] = HOME_LATLON;
const th = - FIELD_BEARING * Math.PI / 180, C = Math.cos( th ), S = Math.sin( th );
const MLAT = 111033, MLON = 111320 * Math.cos( lat0 * Math.PI / 180 );

// lat / lon to the field frame: east and south in the world, turned by the field's bearing
function toField( lat, lon ) {

	const wx = ( lon - lon0 ) * MLON, wz = - ( lat - lat0 ) * MLAT;
	return [ wx * C - wz * S, wx * S + wz * C ];

}

const r1 = ( v ) => Math.round( v * 2 ) / 2;
const pts = ( g ) => g.map( ( p ) => toField( p.lat, p.lon ) ).map( ( [ x, z ] ) => [ r1( x ), r1( z ) ] );
const centroid = ( P ) => [ P.reduce( ( a, p ) => a + p[ 0 ], 0 ) / P.length, P.reduce( ( a, p ) => a + p[ 1 ], 0 ) / P.length ];
const area = ( P ) => {

	let a = 0;
	for ( let i = 0; i < P.length; i ++ ) {

		const [ x0, z0 ] = P[ i ], [ x1, z1 ] = P[ ( i + 1 ) % P.length ];
		a += x0 * z1 - x1 * z0;

	}

	return Math.abs( a ) / 2;

};
function inside( x, z, P ) {

	let c = false;
	for ( let i = 0, j = P.length - 1; i < P.length; j = i ++ ) {

		const [ xi, zi ] = P[ i ], [ xj, zj ] = P[ j ];
		if ( ( zi > z ) !== ( zj > z ) && x < ( xj - xi ) * ( z - zi ) / ( zj - zi ) + xi ) c = ! c;

	}

	return c;

}

// distance from a point to the ballpark's footprint outline
function nearFootprint( x, z ) {

	let best = Infinity;
	for ( let i = 0; i < FOOTPRINT.length; i ++ ) {

		const [ ax, az ] = FOOTPRINT[ i ], [ bx, bz ] = FOOTPRINT[ ( i + 1 ) % FOOTPRINT.length ];
		const dx = bx - ax, dz = bz - az;
		const t = Math.max( 0, Math.min( 1, ( ( x - ax ) * dx + ( z - az ) * dz ) / ( dx * dx + dz * dz ) ) );
		best = Math.min( best, Math.hypot( ax + dx * t - x, az + dz * t - z ) );

	}

	return best;

}

// drop the closing point and points on a straight line
function clean( P ) {

	if ( P.length > 1 && P[ 0 ][ 0 ] === P[ P.length - 1 ][ 0 ] && P[ 0 ][ 1 ] === P[ P.length - 1 ][ 1 ] ) P = P.slice( 0, - 1 );
	const out = [];
	for ( let i = 0; i < P.length; i ++ ) {

		const a = P[ ( i + P.length - 1 ) % P.length ], b = P[ i ], c = P[ ( i + 1 ) % P.length ];
		const cross = ( b[ 0 ] - a[ 0 ] ) * ( c[ 1 ] - b[ 1 ] ) - ( b[ 1 ] - a[ 1 ] ) * ( c[ 0 ] - b[ 0 ] );
		if ( Math.abs( cross ) > 0.3 ) out.push( b );

	}

	return out;

}

const SKIP_NAMES = /Xfinity|NBC Sports Arena|Live! Casino|Lincoln Financial|Citizens Bank Park/i;
const buildings = [], lots = [], lamps = [], trees = [], roads = [], rail = [], grass = [];
for ( const e of osm.elements ) {

	const t = e.tags || {};
	let g = e.geometry;
	if ( ! g && e.members ) g = e.members.filter( ( m ) => m.role === 'outer' ).flatMap( ( m ) => m.geometry || [] );
	if ( e.type === 'node' ) {

		const p = toField( e.lat, e.lon ).map( r1 );
		if ( t.highway === 'street_lamp' ) lamps.push( p );
		else if ( t.natural === 'tree' ) trees.push( p );
		continue;

	}

	if ( ! g || g.length < 2 ) continue;
	const P = pts( g );
	const [ cx, cz ] = centroid( P );
	const dist = Math.hypot( cx, cz );
	if ( t.building ) {

		// canopies and carports (mapped as roofs) aren't buildings, and anything hugging the ballpark is
		// part of it (built by hand)
		if ( t.building === 'roof' || t.power === 'generator' ) continue;
		if ( SKIP_NAMES.test( t.name || '' ) || inside( cx, cz, FOOTPRINT ) || nearFootprint( cx, cz ) < 35 || dist > 3200 ) continue;
		const fp = clean( P );
		const a = area( fp );
		if ( fp.length < 3 || a < 15 ) continue;
		let h = Number.parseFloat( t.height );
		if ( ! h && t[ 'building:levels' ] ) h = Number( t[ 'building:levels' ] ) * 3.3 + 1.2;
		// rowhouses two or three storeys; sheds and garages low; warehouses tall and flat
		if ( ! h ) h = a < 40 ? 4 : a < 160 ? 9.5 : a < 1500 ? 10 : 12;
		const kind = t.building === 'garage' || t.building === 'shed' ? 'shed' : a < 160 ? 'row' : a > 3000 ? 'big' : 'mid';
		buildings.push( { h: Math.round( h * 10 ) / 10, k: kind, fp } );

	} else if ( t.amenity === 'parking' ) {

		if ( t.parking === 'multi-storey' || dist > 1800 ) continue;
		const fp = clean( P );
		if ( fp.length >= 3 && area( fp ) > 200 ) lots.push( fp );

	} else if ( t.natural === 'tree_row' ) {

		// a tree every 9 m along the row
		for ( let i = 0; i < P.length - 1; i ++ ) {

			const [ ax, az ] = P[ i ], [ bx, bz ] = P[ i + 1 ];
			const n = Math.max( 1, Math.round( Math.hypot( bx - ax, bz - az ) / 9 ) );
			for ( let k = 0; k < n; k ++ ) trees.push( [ r1( ax + ( bx - ax ) * k / n ), r1( az + ( bz - az ) * k / n ) ] );

		}

	} else if ( /^(motorway|motorway_link|trunk|trunk_link)$/.test( t.highway || '' ) ) {

		const lanes = Number( t.lanes ) || ( /link/.test( t.highway ) ? 1 : 3 );
		roads.push( { k: t.highway, lanes, bridge: t.bridge && t.bridge !== 'no' ? 1 : 0, layer: Number( t.layer ) || 0, oneway: t.oneway === 'yes' ? 1 : 0, pts: P } );

	} else if ( t.railway === 'rail' ) {

		if ( dist < 3000 ) rail.push( { bridge: t.bridge && t.bridge !== 'no' ? 1 : 0, pts: P } );

	} else if ( t.landuse === 'grass' ) {

		const fp = clean( P );
		if ( fp.length >= 3 && area( fp ) > 100 && dist < 2500 ) grass.push( fp );

	}

}

const header = `// Generated by tools/build-complex.mjs from OpenStreetMap (© OpenStreetMap contributors, ODbL): the
// South Philadelphia Sports Complex and the blocks round it in the field frame (layout.js), metres.
// Buildings { h: height, k: 'row' | 'mid' | 'big' | 'shed', fp: footprint }, parking lots, street lamps,
// trees, highways { k, lanes, bridge, layer, oneway, pts }, railways, grass.
`;
const J = ( v ) => JSON.stringify( v );
writeFileSync( output, header +
	`export const BUILDINGS = ${ J( buildings ) };\n` +
	`export const LOTS = ${ J( lots ) };\n` +
	`export const LAMPS = ${ J( lamps ) };\n` +
	`export const TREES = ${ J( trees ) };\n` +
	`export const HIGHWAYS = ${ J( roads ) };\n` +
	`export const RAIL = ${ J( rail ) };\n` +
	`export const GRASS = ${ J( grass ) };\n` );
console.log( { buildings: buildings.length, lots: lots.length, lamps: lamps.length, trees: trees.length, highways: roads.length, rail: rail.length, grass: grass.length } );
