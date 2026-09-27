// tools/gpu/lock.mjs: one holder at a time, first come first served, stale locks broken, `run` passes
// the command's exit code through. Runs in a temporary GPU_LOCK_DIR (never touches the real lock).
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const LOCK_JS = join( dirname( fileURLToPath( import.meta.url ) ), '../tools/gpu/lock.mjs' );
const dir = mkdtempSync( join( tmpdir(), 'gpu-lock-test-' ) );
const env = { ...process.env, GPU_LOCK_DIR: dir };
let failed = 0;
const ok = ( cond, msg ) => {

	console.log( ( cond ? 'ok   ' : 'FAIL ' ) + msg );
	if ( ! cond ) failed ++;

};

const run = ( args, opts = {} ) => new Promise( ( resolve ) => {

	const p = spawn( process.execPath, [ LOCK_JS, ...args ], { env, stdio: [ 'ignore', 'pipe', 'pipe' ], ...opts } );
	let out = '';
	p.stdout.on( 'data', ( d ) => out += d );
	p.stderr.on( 'data', ( d ) => out += d );
	p.on( 'exit', ( code ) => resolve( { code, out } ) );

} );

// 1. six contenders queued 40 ms apart, each holding 150 ms: no overlap, served in the order they queued
const trace = join( dir, 'trace.txt' );
const holdJS = `const fs=require('fs');fs.appendFileSync(${ JSON.stringify( trace ) },'in '+process.argv[1]+' '+Date.now()+'\\n');setTimeout(()=>{fs.appendFileSync(${ JSON.stringify( trace ) },'out '+process.argv[1]+' '+Date.now()+'\\n')},150)`;
const jobs = [];
for ( let i = 0; i < 6; i ++ ) {

	jobs.push( run( [ 'run', '--owner', 'w' + i, '--quiet', '--', process.execPath, '-e', holdJS, String( i ) ] ) );
	await new Promise( ( r ) => setTimeout( r, 40 ) );

}

await Promise.all( jobs );
const events = readFileSync( trace, 'utf8' ).trim().split( '\n' ).map( ( l ) => l.split( ' ' ) );
let inside = 0, maxInside = 0;
for ( const [ kind ] of events ) {

	inside += kind === 'in' ? 1 : - 1;
	maxInside = Math.max( maxInside, inside );

}

ok( maxInside === 1, `never more than one holder (max ${ maxInside })` );
const order = events.filter( ( e ) => e[ 0 ] === 'in' ).map( ( e ) => e[ 1 ] ).join( '' );
ok( order === '012345', `first come, first served (order ${ order })` );
ok( ! existsSync( join( dir, 'gpu-render.lock' ) ), 'released after the last one' );

// 2. a lock left by a dead process is broken
mkdirSync( join( dir, 'gpu-render.lock' ) );
writeFileSync( join( dir, 'gpu-render.lock', 'owner.json' ), JSON.stringify( { owner: 'crashed', pid: 999999, started: Date.now(), max: 180 } ) );
let r = await run( [ 'status' ] );
ok( /STALE/.test( r.out ), 'status reports the dead holder as stale' );
let t0 = Date.now();
r = await run( [ 'run', '--owner', 'after-crash', '--', process.execPath, '-e', '0' ] );
ok( r.code === 0 && Date.now() - t0 < 3000, `a dead holder's lock is broken (${ Date.now() - t0 } ms)` );

// 3. a live holder past its --max is broken too
const sleeper = spawn( process.execPath, [ '-e', 'setTimeout(()=>{},20000)' ] );
mkdirSync( join( dir, 'gpu-render.lock' ) );
writeFileSync( join( dir, 'gpu-render.lock', 'owner.json' ), JSON.stringify( { owner: 'hung', pid: sleeper.pid, started: Date.now() - 5000, max: 2 } ) );
t0 = Date.now();
r = await run( [ 'run', '--owner', 'after-hang', '--', process.execPath, '-e', '0' ] );
ok( r.code === 0 && Date.now() - t0 < 3000 && /broke a stale lock/.test( r.out ), 'a holder past its --max is broken' );

// 4. a live holder within its time is waited for
writeFileSync( join( dir, 'hold.txt' ), '' );
const holder = run( [ 'run', '--owner', 'holder', '--quiet', '--', process.execPath, '-e', 'setTimeout(()=>{},1200)' ] );
await new Promise( ( res ) => setTimeout( res, 300 ) );
t0 = Date.now();
r = await run( [ 'run', '--owner', 'waiter', '--quiet', '--', process.execPath, '-e', '0' ] );
await holder;
ok( Date.now() - t0 > 700, `a live holder is waited for (${ Date.now() - t0 } ms)` );
sleeper.kill();

// 5. the command's exit code comes back through run
r = await run( [ 'run', '--quiet', '--', process.execPath, '-e', 'process.exit(3)' ] );
ok( r.code === 3, `run passes the exit code through (${ r.code })` );

// 6. acquire --pid holds the lock for another process; release by that pid frees it
const shell = spawn( process.execPath, [ '-e', 'setTimeout(()=>{},20000)' ] );
r = await run( [ 'acquire', '--pid', String( shell.pid ), '--owner', 'shell' ] );
ok( r.code === 0 && existsSync( join( dir, 'gpu-render.lock' ) ), 'acquire --pid leaves the lock held after it exits' );
r = await run( [ 'status' ] );
ok( /held by shell/.test( r.out ) && ! /STALE/.test( r.out ), 'status shows the shell holding it' );
r = await run( [ 'release', '--pid', String( shell.pid ) ] );
ok( r.code === 0 && ! existsSync( join( dir, 'gpu-render.lock' ) ), 'release --pid frees it' );
shell.kill();

rmSync( dir, { recursive: true, force: true } );
if ( failed ) {

	console.log( `${ failed } failed` );
	process.exit( 1 );

}

console.log( 'gpu lock: all ok' );
