#!/usr/bin/env node
// The render desk: one long-lived headless Chrome that takes every shot for this project's agents, one
// job at a time, so nothing else here ever opens a browser on the shared GPU.
//
//   node tools/gpu/desk.mjs shoot job.json      submit a job (a file, `-` for stdin, or inline JSON),
//                                               start the desk if it isn't running, wait, print the
//                                               result; exit 1 if the page failed or logged errors
//                                               (warnings are listed, but don't fail)
//   node tools/gpu/desk.mjs status              the desk, its queue and its warm pages
//   node tools/gpu/desk.mjs stop                stop the desk (its browser and dev servers)
//   node tools/gpu/desk.mjs start               start it (shoot does, when it isn't running)
//   node tools/gpu/desk.mjs serve               run the desk in the foreground (shoot starts it)
//
// A job:
//   {
//     "owner": "T3 concourse",                  who's asking (the GPU lock log shows "cbp desk: T3 ...")
//     "root": "/path/to/worktree",              the tree to serve (default: the git root you run from);
//                                               the desk runs a Vite dev server for it on 5300-5399
//     "params": "only=concourse,people&hour=21",  the page's query (?still is always added)
//     "size": [ 800, 500 ],                     the viewport (default 800 x 500; 1280 x 800 for review)
//     "out": "/abs/dir",                        where the images go (default <root>/.claude/qa/desk)
//     "exclusive": false,                       profiling: hold the GPU exclusively (lock.mjs)
//     "shots": [ {
//       "name": "stand-3b",                     the file name (default shot-N)
//       "hour": 21, "seek": 1234, "play": 57,   the time of day; the replay at t s, or at play N
//       "camera": "center",                     a TV camera (center, high, follow) ...
//       "look": [ [ 12, 1.6, 30 ], [ 0, 1, 0 ], 50 ],  ... or eye, target (field frame) and fov
//       "js": "__app.bowl.group.visible = false",  anything else first (its value is in the result)
//       "frames": 32,                           frames rendered before the shot (QA.still)
//       "format": "jpg",                        jpg (default) or png
//       "cpuprofile": { "frames": 60 }          a CPU profile of that many more frames: the costliest
//                                               functions per frame in the result, the profile itself
//                                               beside the image (open it in DevTools)
//     } ]
//   }
//
// The desk: jobs arrive in /tmp/render-desk/jobs and are taken first come, first served. For each it
// takes the machine-wide GPU lock (lock.mjs), loads the page (or reuses a warm one whose code hasn't
// changed since it loaded: at most 2 pages stay open, with ?still they draw nothing), renders the
// shots, releases the lock and writes the result to /tmp/render-desk/done. The pages' Vite HMR socket
// is disabled, so an edit never reloads a page outside a job; a job reloads a page whose tree has
// changed since. The browser closes after 10 min without a job, or at once when someone else holds the
// GPU lock exclusively (their profiling); the desk exits after 30 min idle.
import { mkdirSync, readFileSync, writeFileSync, renameSync, readdirSync, rmSync, statSync, existsSync, openSync, symlinkSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { acquire, holder, alive } from './lock.mjs';

const HERE = dirname( fileURLToPath( import.meta.url ) );
const DESK = process.env.RENDER_DESK_DIR || '/tmp/render-desk';
const JOBS = join( DESK, 'jobs' ), RUNNING = join( DESK, 'running' ), DONE = join( DESK, 'done' );
const PIDFILE = join( DESK, 'desk.pid' ), STATE = join( DESK, 'state.json' ), LOGFILE = join( DESK, 'desk.log' );
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORTS = [ 5300, 5399 ];
const MAX_PAGES = 2;
const BROWSER_IDLE = 10 * 60e3, DESK_IDLE = 30 * 60e3;
const LOAD_TIMEOUT = 300e3;

const sleep = ( ms ) => new Promise( ( r ) => setTimeout( r, ms ) );
const now = () => new Date().toISOString().slice( 11, 19 );
const log = ( ...a ) => console.log( now(), ...a );

function readJSON( p ) {

	try {

		return JSON.parse( readFileSync( p, 'utf8' ) );

	} catch {

		return null;

	}

}

function writeAtomic( p, data ) {

	const tmp = p + '.tmp-' + randomBytes( 3 ).toString( 'hex' );
	writeFileSync( tmp, typeof data === 'string' ? data : JSON.stringify( data, null, '\t' ) );
	renameSync( tmp, p );

}

function deskPid() {

	const pid = Number( readJSON( PIDFILE )?.pid );
	return alive( pid ) ? pid : 0;

}

// ---------------------------------------------------------------- the desk

class Desk {

	constructor() {

		this.servers = new Map(); // root -> { port, proc }
		this.pages = []; // { key, root, page, loadedAt, logs, lastUsed }
		this.browser = null;
		this.lastJob = Date.now();
		this.busy = false;

	}

	async serve() {

		for ( const d of [ JOBS, RUNNING, DONE ] ) mkdirSync( d, { recursive: true } );
		// one desk per machine: the pid file is taken with an exclusive create
		for ( let k = 0; ; k ++ ) {

			try {

				writeFileSync( PIDFILE, JSON.stringify( { pid: process.pid, started: Date.now() } ), { flag: 'wx' } );
				break;

			} catch ( e ) {

				if ( e.code !== 'EEXIST' || k > 2 ) throw e;
				if ( deskPid() ) {

					log( `a desk is already running (pid ${ deskPid() })` );
					return;

				}

				rmSync( PIDFILE, { force: true } );

			}

		}

		const bye = async () => {

			await this.shutdown();
			process.exit( 0 );

		};
		process.on( 'SIGINT', bye );
		process.on( 'SIGTERM', bye );
		process.on( 'exit', () => {

			for ( const s of this.servers.values() ) s.proc.kill();
			if ( readJSON( PIDFILE )?.pid === process.pid ) rmSync( PIDFILE, { force: true } );

		} );
		// jobs a crashed desk was running go back in the queue
		for ( const n of readdirSync( RUNNING ) ) renameSync( join( RUNNING, n ), join( JOBS, n ) );
		log( `render desk up (pid ${ process.pid }), watching ${ JOBS }` );

		for ( ;; ) {

			const next = readdirSync( JOBS ).filter( ( n ) => n.endsWith( '.json' ) ).sort()[ 0 ];
			if ( next ) {

				this.lastJob = Date.now();
				const running = join( RUNNING, next );
				renameSync( join( JOBS, next ), running );
				const job = readJSON( running );
				const result = job ? await this.run( job ) : { ok: false, error: 'unreadable job' };
				writeAtomic( join( DONE, next ), result );
				rmSync( running, { force: true } );
				this.lastJob = Date.now();
				continue;

			}

			// someone else is profiling: get out of their way
			const h = holder();
			if ( this.browser && h && h.exclusive && h.pid !== process.pid ) {

				log( `${ h.owner } holds the GPU exclusively: closing the browser` );
				await this.closeBrowser();

			}

			if ( this.browser && Date.now() - this.lastJob > BROWSER_IDLE ) {

				log( 'idle: closing the browser' );
				await this.closeBrowser();

			}

			if ( Date.now() - this.lastJob > DESK_IDLE ) {

				log( 'idle: the desk is going home' );
				await this.shutdown();
				process.exit( 0 );

			}

			this.saveState();
			await sleep( 300 );

		}

	}

	saveState() {

		const s = { pid: process.pid, browser: !! this.browser, servers: [ ...this.servers ].map( ( [ root, s ] ) => ( { root, port: s.port } ) ), pages: this.pages.map( ( p ) => ( { key: p.key, loaded: new Date( p.loadedAt ).toISOString() } ) ) };
		const j = JSON.stringify( s );
		if ( j !== this._state ) {

			this._state = j;
			writeAtomic( STATE, s );

		}

	}

	async shutdown() {

		await this.closeBrowser();
		for ( const s of this.servers.values() ) s.proc.kill();
		this.servers.clear();

	}

	async closeBrowser() {

		const b = this.browser;
		this.browser = null;
		this.pages = [];
		if ( b ) await b.close().catch( () => {} );

	}

	// a Vite dev server for the tree (Vite itself is CPU only)
	async server( root ) {

		const s = this.servers.get( root );
		if ( s && s.proc.exitCode === null ) return s.port;
		// a new worktree: it shares this checkout's node_modules
		const shared = join( HERE, '../../node_modules' );
		if ( ! existsSync( join( root, 'node_modules' ) ) && existsSync( shared ) ) symlinkSync( shared, join( root, 'node_modules' ) );
		const used = new Set( [ ...this.servers.values() ].map( ( x ) => x.port ) );
		for ( let port = PORTS[ 0 ]; port <= PORTS[ 1 ]; port ++ ) {

			if ( used.has( port ) || await reachable( port ) ) continue;
			const vite = join( root, 'node_modules/vite/bin/vite.js' );
			const proc = spawn( process.execPath, [ vite, '--host', '127.0.0.1', '--port', String( port ), '--strictPort' ], { cwd: root, stdio: [ 'ignore', 'ignore', 'pipe' ] } );
			let err = '';
			proc.stderr.on( 'data', ( d ) => err += d );
			for ( let k = 0; k < 100 && proc.exitCode === null; k ++ ) {

				if ( await reachable( port ) ) {

					this.servers.set( root, { port, proc } );
					log( `vite for ${ root } on ${ port }` );
					return port;

				}

				await sleep( 200 );

			}

			proc.kill();
			if ( ! /in use/i.test( err ) ) throw new Error( `vite for ${ root } didn't start: ${ err.slice( 0, 300 ) }` );

		}

		throw new Error( 'no free port in 5300-5399' );

	}

	async launch() {

		if ( this.browser && this.browser.connected ) return this.browser;
		const puppeteer = ( await import( 'puppeteer-core' ) ).default;
		// a profile that outlives the browser: Chrome keeps its compiled shaders there, so a browser closed
		// for someone else's profiling (and relaunched) loads the park warm, not recompiling ~600 pipelines
		const profile = join( DESK, 'chrome-profile' );
		mkdirSync( profile, { recursive: true } );
		let ps = '';
		try {

			ps = execFileSync( 'ps', [ '-axo', 'command=' ], { encoding: 'utf8' } );

		} catch {}

		// a crashed desk's Chrome can leave the profile locked
		if ( ! ps.includes( profile ) ) for ( const f of [ 'SingletonLock', 'SingletonSocket', 'SingletonCookie' ] ) rmSync( join( profile, f ), { force: true } );
		this.browser = await puppeteer.launch( {
			executablePath: CHROME,
			headless: true,
			userDataDir: profile,
			// no --disable-frame-rate-limit / --disable-gpu-vsync, ever
			args: [ '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-angle=metal', '--no-first-run', '--no-default-browser-check' ],
			protocolTimeout: 600e3,
		} );
		this.browser.on( 'disconnected', () => {

			this.browser = null;
			this.pages = [];

		} );
		return this.browser;

	}

	// a page with the job's URL and size, fresh (its tree unchanged since it loaded)
	async page( job, url ) {

		const key = `${ url } ${ job.size.join( 'x' ) }`;
		let p = this.pages.find( ( x ) => x.key === key );
		if ( p && ( p.page.isClosed() || newestChange( job.root ) > p.loadedAt ) ) {

			await p.page.close().catch( () => {} );
			this.pages.splice( this.pages.indexOf( p ), 1 );
			p = null;

		}

		if ( p ) {

			p.logs.length = 0;
			p.reused = true;
			return p;

		}

		while ( this.pages.length >= MAX_PAGES ) {

			const old = this.pages.sort( ( a, b ) => a.lastUsed - b.lastUsed ).shift();
			await old.page.close().catch( () => {} );

		}

		const browser = await this.launch();
		const page = await browser.newPage();
		await page.setViewport( { width: job.size[ 0 ], height: job.size[ 1 ] } );
		// no hot reload: Vite's HMR socket never opens, so an edit can't reload the page outside a job
		await page.evaluateOnNewDocument( () => {

			const WS = window.WebSocket;
			window.WebSocket = function ( u, protocols ) {

				if ( [].concat( protocols || [] ).includes( 'vite-hmr' ) ) return { addEventListener() {}, removeEventListener() {}, send() {}, close() {}, readyState: 0 };
				return new WS( u, protocols );

			};
			window.WebSocket.prototype = WS.prototype;
			Object.assign( window.WebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 } );

		} );
		const logs = [];
		page.on( 'console', ( m ) => {

			const t = m.type();
			if ( t === 'error' || t === 'warn' || t === 'warning' ) logs.push( `[${ t }] ${ m.text() }` );

		} );
		page.on( 'pageerror', ( e ) => logs.push( `[pageerror] ${ e.message }` ) );
		page.on( 'response', ( r ) => {

			if ( r.status() >= 400 ) logs.push( `[http ${ r.status() }] ${ r.url() }` );

		} );
		const t0 = Date.now();
		await page.goto( url, { waitUntil: 'domcontentloaded', timeout: 60e3 } );
		await page.waitForFunction( () => window.__qa || window.__loadError, { timeout: LOAD_TIMEOUT, polling: 250 } );
		const err = await page.evaluate( () => window.__loadError );
		p = { key, root: job.root, page, loadedAt: t0, logs, lastUsed: Date.now(), loadMs: Date.now() - t0, reused: false };
		if ( err ) {

			await page.close().catch( () => {} );
			throw new Error( `the page failed to load: ${ err }\n${ logs.join( '\n' ) }` );

		}

		this.pages.push( p );
		return p;

	}

	async run( job ) {

		const t0 = Date.now();
		job.size = job.size || [ 800, 500 ];
		job.shots = job.shots?.length ? job.shots : [ { name: 'main' } ];
		const out = job.out || join( job.root, '.claude/qa/desk' );
		mkdirSync( out, { recursive: true } );
		const result = { ok: true, owner: job.owner, images: [], values: {}, errors: [] };
		let release = null;
		try {

			const port = await this.server( job.root );
			const q = new URLSearchParams( job.params || '' );
			q.set( 'still', '' );
			const url = `http://127.0.0.1:${ port }/?${ q.toString().replace( /=(&|$)/g, '$1' ) }`;
			// the lock for the load and the shots: a full-park load is ~30 s, each shot a few
			const max = 120 + 15 * job.shots.length;
			release = await acquire( { owner: `cbp desk: ${ job.owner || 'unnamed' }`, max: job.exclusive ? 1200 : max, exclusive: !! job.exclusive, command: url, quiet: true } );
			result.waitedMs = Date.now() - t0;
			const t1 = Date.now();
			const p = await this.page( job, url );
			const page = p.page;
			result.url = url;
			result.reused = !! p.reused;
			result.loadMs = p.reused ? 0 : p.loadMs;
			for ( let i = 0; i < job.shots.length; i ++ ) {

				const s = job.shots[ i ];
				const name = ( s.name || `shot-${ i + 1 }` ).replace( /[^\w.-]+/g, '_' );
				const value = await withTimeout( ( s.frames || 32 ) * 1000 + 60e3, `shot ${ name }`, page.evaluate( async ( s ) => {

					const qa = window.__qa;
					qa.clean( s.clean !== false );
					if ( s.hour !== undefined ) qa.hour( s.hour );
					if ( s.play !== undefined ) qa.play( s.play );
					if ( s.seek !== undefined ) qa.seek( s.seek );
					if ( s.camera ) qa.camera( s.camera );
					if ( s.look ) qa.look( ...s.look );
					let v;
					if ( s.js ) v = await ( 0, eval )( s.js );
					await qa.still( { frames: s.frames || 32 } );
					try {

						return JSON.parse( JSON.stringify( v ?? null ) );

					} catch {

						return String( v );

					}

				}, s ) );
				if ( value !== null ) result.values[ name ] = value;
				// where the CPU's time goes in a frame: a sampled profile of more frames (saved for DevTools)
				if ( s.cpuprofile ) {

					const cdp = await page.createCDPSession();
					await cdp.send( 'Profiler.enable' );
					await cdp.send( 'Profiler.setSamplingInterval', { interval: 200 } );
					await cdp.send( 'Profiler.start' );
					const n = s.cpuprofile.frames || 60;
					const ms = await page.evaluate( async ( n ) => {

						const t0 = performance.now();
						await window.__qa.still( { frames: n, cut: false } );
						return ( performance.now() - t0 ) / n;

					}, n );
					const { profile } = await cdp.send( 'Profiler.stop' );
					await cdp.detach();
					writeFileSync( join( out, `${ name }.cpuprofile` ), JSON.stringify( profile ) );
					result.values[ name + ':cpu' ] = { msPerFrame: Math.round( ms * 100 ) / 100, ...summarizeProfile( profile, n, s.cpuprofile.top || 25 ) };

				}

				const fmt = s.format === 'png' ? 'png' : 'jpeg';
				const path = join( out, `${ name }.${ fmt === 'png' ? 'png' : 'jpg' }` );
				await page.screenshot( fmt === 'png' ? { path } : { path, type: 'jpeg', quality: 85 } );
				result.images.push( path );

			}

			result.info = await page.evaluate( () => window.__qa.info() );
			result.shotMs = Date.now() - t1;
			result.errors = p.logs.slice( 0, 60 );
			p.lastUsed = Date.now();

		} catch ( e ) {

			result.ok = false;
			result.error = String( e.message || e ).slice( 0, 4000 );
			// a page that failed mid-job may be wedged (a lost device, a hung shader): start it over next time
			const p = this.pages.find( ( x ) => x.key.startsWith( result.url || '\0' ) );
			if ( p ) {

				this.pages.splice( this.pages.indexOf( p ), 1 );
				await p.page.close().catch( () => {} );

			}

		} finally {

			if ( release ) release();

		}

		result.ms = Date.now() - t0;
		log( `${ job.owner || 'job' }: ${ result.ok ? 'ok' : 'FAILED' } in ${ ( result.ms / 1000 ).toFixed( 1 ) } s (waited ${ ( ( result.waitedMs || 0 ) / 1000 ).toFixed( 1 ) } s, load ${ ( ( result.loadMs || 0 ) / 1000 ).toFixed( 1 ) } s, ${ result.images.length } shots)` );
		return result;

	}

}

// a CPU profile's costliest functions, in ms per frame: by self time and by total (inclusive) time
function summarizeProfile( profile, frames, top ) {

	const byId = new Map( profile.nodes.map( ( n ) => [ n.id, n ] ) );
	const parent = new Map();
	for ( const n of profile.nodes ) for ( const c of n.children || [] ) parent.set( c, n.id );
	const key = ( n ) => {

		const f = n.callFrame;
		return `${ f.functionName || '(anonymous)' } ${ ( f.url || '' ).split( '/' ).pop().split( '?' )[ 0 ] }:${ f.lineNumber + 1 }`;

	};
	const self = new Map(), total = new Map();
	const skip = /^\((root|program|idle|garbage collector)\)/;
	for ( let i = 0; i < profile.samples.length; i ++ ) {

		const dt = ( profile.timeDeltas[ i + 1 ] ?? 0 ) / 1000;
		let id = profile.samples[ i ];
		const k0 = key( byId.get( id ) );
		self.set( k0, ( self.get( k0 ) || 0 ) + dt );
		const seen = new Set();
		for ( ; id !== undefined; id = parent.get( id ) ) {

			const k = key( byId.get( id ) );
			if ( seen.has( k ) ) continue;
			seen.add( k );
			total.set( k, ( total.get( k ) || 0 ) + dt );

		}

	}

	const list = ( m ) => Object.fromEntries( [ ...m ].filter( ( [ k ] ) => ! skip.test( k ) ).sort( ( a, b ) => b[ 1 ] - a[ 1 ] ).slice( 0, top ).map( ( [ k, v ] ) => [ k, Math.round( v / frames * 100 ) / 100 ] ) );
	return { self: list( self ), total: list( total ), gc: Math.round( ( self.get( '(garbage collector) :0' ) || 0 ) / frames * 100 ) / 100 };

}

function withTimeout( ms, what, promise ) {

	let timer;
	return Promise.race( [ promise, new Promise( ( _, reject ) => {

		timer = setTimeout( () => reject( new Error( `${ what }: no answer in ${ Math.round( ms / 1000 ) } s` ) ), ms );

	} ) ] ).finally( () => clearTimeout( timer ) );

}

function reachable( port ) {

	return fetch( `http://127.0.0.1:${ port }/`, { signal: AbortSignal.timeout( 1500 ) } ).then( () => true, () => false );

}

// the newest change to the tree's source (what a warm page would be out of date with)
function newestChange( root ) {

	let newest = 0;
	const walk = ( dir ) => {

		let names = [];
		try {

			names = readdirSync( dir, { withFileTypes: true } );

		} catch {

			return;

		}

		for ( const d of names ) {

			if ( d.name.startsWith( '.' ) || d.name === 'node_modules' ) continue;
			const p = join( dir, d.name );
			if ( d.isDirectory() ) walk( p );
			else newest = Math.max( newest, statSync( p ).mtimeMs );

		}

	};

	for ( const sub of [ 'src', 'public' ] ) walk( join( root, sub ) );
	for ( const f of [ 'index.html', 'vite.config.js' ] ) if ( existsSync( join( root, f ) ) ) newest = Math.max( newest, statSync( join( root, f ) ).mtimeMs );
	return newest;

}

// ---------------------------------------------------------------- submitting

function gitRoot() {

	try {

		return execFileSync( 'git', [ 'rev-parse', '--show-toplevel' ], { encoding: 'utf8' } ).trim();

	} catch {

		return process.cwd();

	}

}

function ensureDesk() {

	if ( deskPid() ) return;
	mkdirSync( DESK, { recursive: true } );
	const fd = openSync( LOGFILE, 'a' );
	const p = spawn( process.execPath, [ join( HERE, 'desk.mjs' ), 'serve' ], { detached: true, stdio: [ 'ignore', fd, fd ] } );
	p.unref();

}

async function shoot( arg ) {

	const text = arg === '-' ? readFileSync( 0, 'utf8' ) : arg.trim().startsWith( '{' ) ? arg : readFileSync( arg, 'utf8' );
	const job = JSON.parse( text );
	job.root = resolve( job.root || gitRoot() );
	job.owner = job.owner || job.root.split( '/' ).pop();
	if ( job.out ) job.out = resolve( job.out );
	mkdirSync( JOBS, { recursive: true } );
	mkdirSync( DONE, { recursive: true } );
	const id = `${ String( Date.now() ).padStart( 15, '0' ) }-${ String( process.pid ).padStart( 7, '0' ) }-${ randomBytes( 3 ).toString( 'hex' ) }.json`;
	writeAtomic( join( JOBS, id ), job );
	ensureDesk();
	const t0 = Date.now();
	let said = 0;
	for ( ;; ) {

		const r = readJSON( join( DONE, id ) );
		if ( r ) {

			rmSync( join( DONE, id ), { force: true } );
			console.log( JSON.stringify( r, null, 2 ) );
			// warnings are reported, errors fail
			process.exit( r.ok && ! r.errors?.some( ( e ) => /^\[(error|pageerror|http)/.test( e ) ) ? 0 : 1 );

		}

		// the desk died: start another (it re-queues what was running)
		if ( Date.now() - t0 > 3000 && ! deskPid() ) ensureDesk();
		if ( Date.now() - said > 15e3 ) {

			said = Date.now();
			const ahead = readdirSync( JOBS ).filter( ( n ) => n.endsWith( '.json' ) && n < id ).length;
			const h = holder();
			process.stderr.write( `[desk] waiting ${ Math.round( ( Date.now() - t0 ) / 1000 ) } s: ${ ahead } job(s) ahead${ h ? `, GPU held by ${ h.owner }` : '' }\n` );

		}

		await sleep( 300 );

	}

}

function status() {

	const pid = deskPid();
	const s = readJSON( STATE );
	const queued = existsSync( JOBS ) ? readdirSync( JOBS ).filter( ( n ) => n.endsWith( '.json' ) ) : [];
	const running = existsSync( RUNNING ) ? readdirSync( RUNNING ) : [];
	console.log( pid ? `desk running (pid ${ pid }), browser ${ s?.browser ? 'open' : 'closed' }` : 'desk not running' );
	if ( pid && s ) {

		for ( const v of s.servers ) console.log( `  vite ${ v.port }: ${ v.root }` );
		for ( const p of s.pages ) console.log( `  page ${ p.key } (loaded ${ p.loaded })` );

	}

	for ( const n of running ) console.log( `  running: ${ readJSON( join( RUNNING, n ) )?.owner || n }` );
	for ( const n of queued ) console.log( `  queued: ${ readJSON( join( JOBS, n ) )?.owner || n }` );

}

const [ cmd, arg ] = process.argv.slice( 2 );
if ( cmd === 'serve' ) await new Desk().serve();
else if ( cmd === 'shoot' && arg ) await shoot( arg );
else if ( cmd === 'status' ) status();
else if ( cmd === 'start' ) {

	ensureDesk();
	console.log( deskPid() ? `desk running (pid ${ deskPid() })` : 'desk starting' );

}
else if ( cmd === 'stop' ) {

	const pid = deskPid();
	if ( pid ) process.kill( pid, 'SIGTERM' );
	console.log( pid ? `stopped the desk (pid ${ pid })` : 'desk not running' );

} else {

	console.log( readFileSync( fileURLToPath( import.meta.url ), 'utf8' ).split( '\n' ).slice( 1, 35 ).map( ( l ) => l.replace( /^\/\/ ?/, '' ) ).join( '\n' ) );
	process.exit( cmd ? 1 : 0 );

}
