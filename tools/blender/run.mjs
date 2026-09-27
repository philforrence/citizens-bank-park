#!/usr/bin/env node
// Run a Blender Python script headless (no window, factory settings), for building and baking assets.
//
//   node tools/blender/run.mjs [--gpu] [--owner name] script.py [-- script args ...]
//
// Blender: $BLENDER, or ~/Applications/Blender.app (5.2 LTS, installed 2026-09-27), or
// /Applications/Blender.app. The script gets its own arguments after "--" in sys.argv.
//
// The GPU is shared (docs/GPU.md). A script that only builds geometry, bakes with Cycles on the CPU
// (scene.cycles.device = 'CPU', the default here) or exports runs as is. --gpu is for a script that
// renders or bakes on the GPU (EEVEE, Cycles on Metal): it waits for the machine-wide GPU lock and
// holds it while Blender runs.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname( fileURLToPath( import.meta.url ) );

export function blenderPath() {

	for ( const p of [ process.env.BLENDER, join( homedir(), 'Applications/Blender.app/Contents/MacOS/Blender' ), '/Applications/Blender.app/Contents/MacOS/Blender' ] ) if ( p && existsSync( p ) ) return p;
	throw new Error( 'Blender not found: set BLENDER, or install it in ~/Applications' );

}

const argv = process.argv.slice( 2 );
let gpu = false, owner = '';
while ( argv[ 0 ]?.startsWith( '--' ) && argv[ 0 ] !== '--' ) {

	const a = argv.shift();
	if ( a === '--gpu' ) gpu = true;
	else if ( a === '--owner' ) owner = argv.shift();

}

const script = argv.shift();
if ( ! script ) {

	console.log( 'usage: node tools/blender/run.mjs [--gpu] [--owner name] script.py [-- args ...]' );
	process.exit( 1 );

}

const extra = argv[ 0 ] === '--' ? argv.slice( 1 ) : argv;
const args = [ '-b', '--factory-startup', '--python-exit-code', '1', '--python', script, '--', ...extra ];
let release = null;
if ( gpu ) {

	const { acquire } = await import( join( HERE, '../gpu/lock.mjs' ) );
	release = await acquire( { owner: `cbp blender: ${ owner || script.split( '/' ).pop() }`, max: 900, command: script } );

}

const p = spawn( blenderPath(), args, { stdio: 'inherit' } );
p.on( 'exit', ( code ) => {

	if ( release ) release();
	process.exit( code ?? 1 );

} );
