#!/usr/bin/env node
// Fetch a CC0 material scan from Poly Haven (polyhaven.com: real photographs, with true normal, rough
// and height maps) into public/textures/<asset>/, for imageTexture() (src/ballpark/geo.js).
//
//   node tools/textures/fetch.mjs <asset> [--res 1k] [--maps diff,nor_gl,rough,disp,ao,arm]
//   node tools/textures/fetch.mjs --search brick        the assets whose name or tags match
//
// e.g. node tools/textures/fetch.mjs red_brick_03 --res 1k. Each map lands as <map>.jpg (the colour
// is diff.jpg, OpenGL normals nor_gl.jpg), with the asset's name, authors and licence in
// info.json, and a line for CREDITS.md printed. Keep downloads modest: 1k unless it's seen up close.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join( dirname( fileURLToPath( import.meta.url ) ), '../..' );
const UA = { 'User-Agent': 'citizens-bank-park asset fetch' };
// Poly Haven's map names -> ours
const MAPS = { diff: 'Diffuse', nor_gl: 'nor_gl', rough: 'Rough', disp: 'Displacement', ao: 'AO', arm: 'arm', bump: 'Bump' };

const argv = process.argv.slice( 2 );
const opt = { res: '1k', maps: [ 'diff', 'nor_gl', 'rough', 'disp' ] };
const rest = [];
for ( let i = 0; i < argv.length; i ++ ) {

	if ( argv[ i ] === '--res' ) opt.res = argv[ ++ i ];
	else if ( argv[ i ] === '--maps' ) opt.maps = argv[ ++ i ].split( ',' );
	else if ( argv[ i ] === '--search' ) opt.search = argv[ ++ i ];
	else rest.push( argv[ i ] );

}

const json = async ( url ) => {

	const r = await fetch( url, { headers: UA } );
	if ( ! r.ok ) throw new Error( `${ r.status } ${ url }` );
	return r.json();

};

if ( opt.search ) {

	const all = await json( 'https://api.polyhaven.com/assets?type=textures' );
	const q = opt.search.toLowerCase();
	for ( const [ id, a ] of Object.entries( all ) ) {

		if ( id.includes( q ) || a.name.toLowerCase().includes( q ) || ( a.tags || [] ).some( ( t ) => t.includes( q ) ) || ( a.categories || [] ).some( ( t ) => t.includes( q ) ) ) console.log( `${ id.padEnd( 32 ) } ${ a.name } (${ ( a.categories || [] ).join( ', ' ) })` );

	}

	process.exit( 0 );

}

const asset = rest[ 0 ];
if ( ! asset ) {

	console.log( 'usage: node tools/textures/fetch.mjs <asset> [--res 1k] [--maps diff,nor_gl,rough,disp] | --search <word>' );
	process.exit( 1 );

}

const [ files, info ] = await Promise.all( [ json( `https://api.polyhaven.com/files/${ asset }` ), json( `https://api.polyhaven.com/info/${ asset }` ) ] );
const dir = join( ROOT, 'public/textures', asset );
mkdirSync( dir, { recursive: true } );
for ( const m of opt.maps ) {

	const f = files[ MAPS[ m ] || m ]?.[ opt.res ]?.jpg;
	if ( ! f ) {

		console.log( `no ${ m } at ${ opt.res }` );
		continue;

	}

	const out = join( dir, `${ m }.jpg` );
	if ( existsSync( out ) ) {

		console.log( `have ${ out.replace( ROOT + '/', '' ) }` );
		continue;

	}

	const r = await fetch( f.url, { headers: UA } );
	const buf = Buffer.from( await r.arrayBuffer() );
	if ( f.md5 && createHash( 'md5' ).update( buf ).digest( 'hex' ) !== f.md5 ) throw new Error( `${ m }: checksum mismatch` );
	writeFileSync( out, buf );
	console.log( `${ out.replace( ROOT + '/', '' ) } (${ ( buf.length / 1024 ).toFixed( 0 ) } KB)` );

}

const authors = Object.keys( info.authors || {} ).join( ', ' );
writeFileSync( join( dir, 'info.json' ), JSON.stringify( { asset, name: info.name, authors, license: 'CC0', source: `https://polyhaven.com/a/${ asset }`, res: opt.res, maps: opt.maps }, null, '\t' ) + '\n' );
console.log( `CREDITS.md: - ${ info.name } by ${ authors }, CC0, Poly Haven (https://polyhaven.com/a/${ asset }): public/textures/${ asset }/` );
