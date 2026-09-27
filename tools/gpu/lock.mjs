#!/usr/bin/env node
// A machine-wide GPU lock, so the sessions and agents on this machine take turns rendering instead of
// all drawing at once. No dependencies: any project can call it by its full path.
//
//   node lock.mjs run [--owner name] [--max seconds] [--exclusive] -- <command ...>
//       wait your turn, run the command holding the lock, release it when the command exits
//   node lock.mjs acquire --pid <pid> [--owner name] [--max seconds]   (then: node lock.mjs release)
//       for shells: hold the lock on behalf of a long-lived process (e.g. `--pid $$`)
//   node lock.mjs status        who holds it, for how long, who's waiting
//   node lock.mjs release       release a lock taken with acquire (or, with --force, anyone's)
//
//   import { acquire } from './lock.mjs';
//   const release = await acquire( { owner: 'shots T3' } );  ...render...  release();
//
// How it works: the lock is a directory (mkdir is atomic), /tmp/gpu-render.lock, with owner.json inside
// (owner, pid, command, start time, the most it may be held). Waiters queue first in, first out: each
// writes a ticket in /tmp/gpu-render.queue and only the ticket at the head may take the lock. A lock is
// stale, and the head breaks it, when its pid has died or it has been held past its --max (default 180 s).
// A ticket is dropped when its pid has died or it hasn't been refreshed for 30 s (a waiter refreshes its
// ticket every poll). --exclusive (for profiling) holds up to 20 min and, before starting, waits (up to 2
// min) until no headless Chrome outside the lock is running, so the numbers are honest (a Chrome under
// the holder or under a process waiting in the queue takes part, and isn't waited for). Every take and release is
// logged to /tmp/gpu-render.log. GPU_LOCK_DIR moves all three (tests).
import { mkdirSync, rmSync, readFileSync, writeFileSync, readdirSync, utimesSync, statSync, appendFileSync, renameSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.GPU_LOCK_DIR || '/tmp';
export const LOCK = join( BASE, 'gpu-render.lock' );
export const QUEUE = join( BASE, 'gpu-render.queue' );
export const LOG = join( BASE, 'gpu-render.log' );
const TICKET_TTL = 30e3;
const POLL = 250;

const sleep = ( ms ) => new Promise( ( r ) => setTimeout( r, ms ) );

export function alive( pid ) {

	if ( ! pid ) return false;
	try {

		process.kill( pid, 0 );
		return true;

	} catch ( e ) {

		return e.code === 'EPERM';

	}

}

function readJSON( path ) {

	try {

		return JSON.parse( readFileSync( path, 'utf8' ) );

	} catch {

		return null;

	}

}

function log( line ) {

	try {

		appendFileSync( LOG, `${ new Date().toISOString() } ${ line }\n` );

	} catch {}

}

// the holder, or null; { ...owner, stale: reason } when it may be broken
export function holder() {

	let info = readJSON( join( LOCK, 'owner.json' ) );
	if ( ! info ) {

		// mkdir'd but owner.json not written yet (a moment), or left behind by a crash between the two
		let st;
		try {

			st = statSync( LOCK );

		} catch {

			return null;

		}

		info = { owner: '?', pid: 0, started: st.mtimeMs, max: 10 };

	}

	const held = Date.now() - info.started;
	if ( info.pid && ! alive( info.pid ) ) info.stale = `pid ${ info.pid } is gone`;
	else if ( held > info.max * 1000 ) info.stale = `held ${ Math.round( held / 1000 ) } s, past its ${ info.max } s`;
	info.held = held;
	return info;

}

function tickets() {

	let names = [];
	try {

		names = readdirSync( QUEUE ).filter( ( n ) => n.endsWith( '.json' ) ).sort();

	} catch {}

	const out = [];
	for ( const name of names ) {

		const path = join( QUEUE, name );
		const t = readJSON( path );
		let fresh = false;
		try {

			fresh = Date.now() - statSync( path ).mtimeMs < TICKET_TTL;

		} catch {}

		if ( ! t || ! alive( t.pid ) || ! fresh ) {

			rmSync( path, { force: true } );
			continue;

		}

		out.push( { name, path, ...t } );

	}

	return out;

}

// headless Chromes outside the lock (renderers that don't take part): --exclusive waits for them. A
// Chrome under the holder, or under anyone waiting in the queue, takes part: it isn't drawing (it's
// waiting its turn), so it's not waited for
function foreignChromes() {

	let ps = '';
	try {

		ps = execFileSync( 'ps', [ '-axo', 'pid=,command=' ], { encoding: 'utf8' } );

	} catch {

		return [];

	}

	const members = [ holder()?.pid, ...tickets().map( ( t ) => t.pid ) ].filter( Boolean );
	// the browser processes (not their helpers) of headless Chromes
	return ps.split( '\n' ).filter( ( l ) => /--headless/.test( l ) && /chrom/i.test( l ) && ! /--type=/.test( l ) )
		.map( ( l ) => Number( l.trim().split( /\s+/ )[ 0 ] ) ).filter( ( pid ) => ! members.some( ( m ) => descendantOf( pid, m ) ) );

}

function descendantOf( pid, ancestor ) {

	for ( let p = pid, k = 0; p > 1 && k < 30; k ++ ) {

		if ( p === ancestor ) return true;
		try {

			p = Number( execFileSync( 'ps', [ '-o', 'ppid=', '-p', String( p ) ], { encoding: 'utf8' } ).trim() );

		} catch {

			return false;

		}

	}

	return false;

}

// Wait for the lock and take it. Returns release(), which is also run on exit.
export async function acquire( { owner = 'unnamed', pid = process.pid, max, exclusive = false, command = '', quiet = false, onWait } = {} ) {

	max = max || ( exclusive ? 1200 : 180 );
	mkdirSync( QUEUE, { recursive: true } );
	const id = `${ String( Date.now() ).padStart( 15, '0' ) }-${ String( pid ).padStart( 7, '0' ) }-${ randomBytes( 3 ).toString( 'hex' ) }`;
	const ticket = join( QUEUE, id + '.json' );
	writeFileSync( ticket, JSON.stringify( { owner, pid, command, queued: Date.now() } ) );
	const t0 = Date.now();
	let said = 0;
	const say = ( msg ) => {

		if ( onWait ) onWait( msg );
		else if ( ! quiet ) process.stderr.write( `[gpu-lock] ${ msg }\n` );

	};

	try {

		for ( ;; ) {

			const now = new Date();
			utimesSync( ticket, now, now );
			const q = tickets();
			const pos = q.findIndex( ( t ) => t.name === id + '.json' );
			if ( pos < 0 ) writeFileSync( ticket, JSON.stringify( { owner, pid, command, queued: t0 } ) ); // dropped (a long stall): back in line
			if ( pos === 0 ) {

				const h = holder();
				if ( h && h.stale ) {

					// only the head breaks a stale lock: rename it away first (atomic), then remove it
					const dead = LOCK + '.stale-' + randomBytes( 3 ).toString( 'hex' );
					try {

						renameSync( LOCK, dead );
						rmSync( dead, { recursive: true, force: true } );
						log( `broke ${ h.owner } (pid ${ h.pid }): ${ h.stale }` );
						say( `broke a stale lock held by ${ h.owner }: ${ h.stale }` );

					} catch {}

				}

				let got = false;
				try {

					mkdirSync( LOCK );
					got = true;

				} catch ( e ) {

					if ( e.code !== 'EEXIST' ) throw e;

				}

				if ( got ) {

					const token = randomBytes( 8 ).toString( 'hex' );
					writeFileSync( join( LOCK, 'owner.json' ), JSON.stringify( { owner, pid, command, started: Date.now(), max, exclusive, token } ) );
					rmSync( ticket, { force: true } );
					if ( exclusive ) {

						// profiling: the other renderers on this machine must have finished too (at most 2 min: an idle
						// one, like the render desk's pages in still mode, draws nothing)
						const w0 = Date.now();
						for ( let k = 0; ; k ++ ) {

							const f = foreignChromes();
							if ( ! f.length ) break;
							// by the clock: a pass of foreignChromes() can take a while (a ps per ancestor)
							if ( Date.now() - w0 > 120e3 ) {

								say( `exclusive: going ahead with headless Chrome(s) still open outside the lock (pids ${ f.join( ' ' ) }): check they're idle` );
								break;

							}

							if ( k % 20 === 0 ) say( `exclusive: waiting for ${ f.length } headless Chrome(s) outside the lock to finish (pids ${ f.join( ' ' ) })` );
							await sleep( 500 );
							const o = readJSON( join( LOCK, 'owner.json' ) );
							if ( o ) writeFileSync( join( LOCK, 'owner.json' ), JSON.stringify( { ...o, started: Date.now() } ) );

						}

					}

					const waited = ( ( Date.now() - t0 ) / 1000 ).toFixed( 1 );
					log( `take ${ owner } (pid ${ pid }) after ${ waited } s${ exclusive ? ' exclusive' : '' }` );
					if ( Date.now() - t0 > 2000 ) say( `got the GPU after ${ waited } s` );
					return releaser( token, owner, pid );

				}

			}

			if ( Date.now() - said > 10e3 ) {

				said = Date.now();
				const h = holder();
				say( `waiting for the GPU: ${ h ? `${ h.owner } has held it ${ Math.round( h.held / 1000 ) } s` : 'free' }, ${ Math.max( 0, pos ) } ahead of you` );

			}

			await sleep( POLL );

		}

	} catch ( e ) {

		rmSync( ticket, { force: true } );
		throw e;

	}

}

function releaser( token, owner, pid ) {

	const t0 = Date.now();
	let done = false;
	const release = () => {

		if ( done ) return;
		done = true;
		process.off( 'exit', release );
		const o = readJSON( join( LOCK, 'owner.json' ) );
		// only our own lock: a stale one we held may have been broken and taken since
		if ( o && o.token === token ) {

			rmSync( LOCK, { recursive: true, force: true } );
			log( `release ${ owner } (pid ${ pid }) after ${ ( ( Date.now() - t0 ) / 1000 ).toFixed( 1 ) } s` );

		}

	};

	process.on( 'exit', release );
	return release;

}

export function status() {

	const h = holder();
	const q = tickets();
	const lines = [];
	lines.push( h ? `held by ${ h.owner } (pid ${ h.pid }) for ${ Math.round( h.held / 1000 ) } s of its ${ h.max } s${ h.exclusive ? ', exclusive' : '' }${ h.stale ? ` - STALE: ${ h.stale }` : '' }${ h.command ? `\n  ${ h.command }` : '' }` : 'free' );
	q.forEach( ( t, i ) => lines.push( `  ${ i + 1 }. ${ t.owner } (pid ${ t.pid }), waiting ${ Math.round( ( Date.now() - t.queued ) / 1000 ) } s` ) );
	return lines.join( '\n' );

}

// ---------------------------------------------------------------- command line

function parse( argv ) {

	const opts = { owner: process.env.GPU_LOCK_OWNER || '', exclusive: false };
	let i = 0;
	for ( ; i < argv.length; i ++ ) {

		const a = argv[ i ];
		if ( a === '--' ) {

			i ++;
			break;

		}

		if ( a === '--owner' ) opts.owner = argv[ ++ i ];
		else if ( a === '--max' ) opts.max = Number( argv[ ++ i ] );
		else if ( a === '--pid' ) opts.pid = Number( argv[ ++ i ] );
		else if ( a === '--exclusive' ) opts.exclusive = true;
		else if ( a === '--force' ) opts.force = true;
		else if ( a === '--quiet' ) opts.quiet = true;
		else break;

	}

	return { opts, rest: argv.slice( i ) };

}

async function main() {

	const [ cmd, ...argv ] = process.argv.slice( 2 );
	const { opts, rest } = parse( argv );
	if ( cmd === 'status' ) {

		console.log( status() );

	} else if ( cmd === 'run' ) {

		if ( ! rest.length ) throw new Error( 'usage: lock.mjs run [--owner name] [--max s] [--exclusive] -- <command ...>' );
		const command = rest.join( ' ' );
		const release = await acquire( { ...opts, owner: opts.owner || `${ rest[ 0 ].split( '/' ).pop() } in ${ process.cwd().split( '/' ).pop() }`, command } );
		const child = spawn( rest[ 0 ], rest.slice( 1 ), { stdio: 'inherit' } );
		const pass = ( sig ) => child.kill( sig );
		process.on( 'SIGINT', pass );
		process.on( 'SIGTERM', pass );
		child.on( 'error', ( e ) => {

			console.error( e.message );
			release();
			process.exit( 127 );

		} );
		child.on( 'exit', ( code, sig ) => {

			release();
			process.exit( code ?? ( sig ? 1 : 0 ) );

		} );

	} else if ( cmd === 'acquire' ) {

		if ( ! opts.pid ) throw new Error( 'acquire needs --pid <the process that holds it> (e.g. --pid $$ in a shell)' );
		const release = await acquire( { ...opts, owner: opts.owner || `pid ${ opts.pid }` } );
		// the lock outlives this process: don't release on exit
		process.removeAllListeners( 'exit' );
		void release;

	} else if ( cmd === 'release' ) {

		const h = holder();
		if ( ! h ) console.log( 'not held' );
		else if ( opts.force || ( opts.pid && h.pid === opts.pid ) || ( ! opts.pid && ! alive( h.pid ) ) || h.pid === process.ppid ) {

			rmSync( LOCK, { recursive: true, force: true } );
			log( `release ${ h.owner } (pid ${ h.pid }) by hand` );
			console.log( `released ${ h.owner }` );

		} else {

			console.log( `held by ${ h.owner } (pid ${ h.pid }), not you: pass --pid <pid>, or --force` );
			process.exit( 1 );

		}

	} else {

		console.log( readFileSync( fileURLToPath( import.meta.url ), 'utf8' ).split( '\n' ).slice( 1, 13 ).map( ( l ) => l.replace( /^\/\/ ?/, '' ) ).join( '\n' ) );
		process.exit( cmd ? 1 : 0 );

	}

}

if ( process.argv[ 1 ] && fileURLToPath( import.meta.url ) === process.argv[ 1 ] ) main().catch( ( e ) => {

	console.error( '[gpu-lock]', e.message );
	process.exit( 1 );

} );
