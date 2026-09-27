#!/usr/bin/env node
// Image generation with Google's Gemini image models ("Nano Banana"), for the textures, decals and
// sheets no free photo covers. It runs on Google's servers: no local GPU.
//
//   node tools/imagegen/gen.mjs [options] "prompt"
//     --out path.png        where to write it (default .claude/imagegen/<time>.png); with --n > 1,
//                           -1, -2 ... are added
//     --model id            gemini-3-pro-image (Nano Banana Pro, the default), gemini-3.1-flash-image
//                           (Nano Banana 2, faster, cheaper), gemini-2.5-flash-image (Nano Banana)
//     --ref photo.jpg       a reference image to work from (repeatable): a 2008 photo to match, a
//                           texture to extend, a sheet to stay consistent with
//     --aspect 1:1          1:1, 16:9, 9:16, 4:3, 3:4, 3:2, 2:3, 21:9 ...
//     --size 1K             1K, 2K or 4K (the Pro model)
//     --n 1                 how many
//   node tools/imagegen/gen.mjs --batch jobs.json
//     [ { "prompt": "...", "out": "...", "ref": [ ... ], "aspect": "1:1", "size": "1K", "model": "..." }, ... ]
//
// The key: GEMINI_API_KEY, or ~/.config/citizens-bank-park/gemini-api-key. It's never in the repo.
// Every image is logged (prompt, model, references, date, file) to imagegen.jsonl beside it: credit
// what ships in CREDITS.md as generated, and keep the prompt with it.
//
// Use it for generic materials (weathering, grime, rain stains), interiors behind glass, food and
// artwork, and invented people's faces. Never for real 2008 signage, logos, players or anyone real:
// it invents the details. Match real places with --ref photos, and check the result against them.
import { readFileSync, writeFileSync, mkdirSync, appendFileSync, existsSync } from 'node:fs';
import { dirname, resolve, extname, join } from 'node:path';
import { homedir } from 'node:os';

const API = 'https://generativelanguage.googleapis.com/v1beta/models';
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const EXT = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' };

function key() {

	if ( process.env.GEMINI_API_KEY ) return process.env.GEMINI_API_KEY.trim();
	const f = join( homedir(), '.config/citizens-bank-park/gemini-api-key' );
	if ( existsSync( f ) ) return readFileSync( f, 'utf8' ).trim();
	throw new Error( 'no key: set GEMINI_API_KEY or write it to ~/.config/citizens-bank-park/gemini-api-key' );

}

const sleep = ( ms ) => new Promise( ( r ) => setTimeout( r, ms ) );

// one request: the images it returned (and any text), retrying the transient failures
async function generate( { prompt, model = 'gemini-3-pro-image', ref = [], aspect, size } ) {

	const parts = [ { text: prompt } ];
	for ( const r of [].concat( ref ) ) parts.push( { inlineData: { mimeType: MIME[ extname( r ).toLowerCase() ] || 'image/jpeg', data: readFileSync( r ).toString( 'base64' ) } } );
	const imageConfig = {};
	if ( aspect ) imageConfig.aspectRatio = aspect;
	if ( size ) imageConfig.imageSize = size;
	const body = { contents: [ { role: 'user', parts } ], generationConfig: { responseModalities: [ 'TEXT', 'IMAGE' ], ...( Object.keys( imageConfig ).length ? { imageConfig } : {} ) } };
	for ( let attempt = 0; ; attempt ++ ) {

		const res = await fetch( `${ API }/${ model }:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-goog-api-key': key() }, body: JSON.stringify( body ) } );
		const json = await res.json().catch( () => ( {} ) );
		if ( res.ok ) {

			const out = { images: [], text: '' };
			for ( const p of json.candidates?.[ 0 ]?.content?.parts || [] ) {

				if ( p.inlineData ) out.images.push( { mime: p.inlineData.mimeType, data: Buffer.from( p.inlineData.data, 'base64' ) } );
				else if ( p.text ) out.text += p.text;

			}

			if ( ! out.images.length ) throw new Error( `no image returned (${ json.candidates?.[ 0 ]?.finishReason || 'no candidate' }): ${ out.text.slice( 0, 300 ) || JSON.stringify( json.promptFeedback || {} ) }` );
			return out;

		}

		const status = res.status;
		// a quota of 0 (the model isn't in the key's tier) won't come back by waiting
		if ( ( status === 429 || status >= 500 ) && attempt < 4 && ! /limit: 0\b/.test( json.error?.message || '' ) ) {

			await sleep( 2000 * 2 ** attempt );
			continue;

		}

		throw new Error( `${ status }: ${ json.error?.message || res.statusText }` );

	}

}

async function run( job ) {

	const n = job.n || 1;
	const stamp = new Date().toISOString().replace( /[:.]/g, '-' );
	const base = resolve( job.out || `.claude/imagegen/${ stamp }.png` );
	mkdirSync( dirname( base ), { recursive: true } );
	const files = [];
	for ( let i = 0; i < n; i ++ ) {

		const t0 = Date.now();
		const r = await generate( job );
		r.images.forEach( ( img, k ) => {

			let path = base;
			if ( n > 1 || k > 0 ) path = base.replace( /(\.\w+)?$/, `-${ i + 1 }${ k ? '-' + k : '' }$1` );
			const ext = EXT[ img.mime ] || '.png';
			if ( extname( path ).toLowerCase() !== ext ) path = path.replace( /(\.\w+)?$/, ext );
			writeFileSync( path, img.data );
			files.push( path );
			appendFileSync( join( dirname( path ), 'imagegen.jsonl' ), JSON.stringify( { file: path.split( '/' ).pop(), prompt: job.prompt, model: job.model || 'gemini-3-pro-image', ref: [].concat( job.ref || [] ).map( ( x ) => x.split( '/' ).pop() ), aspect: job.aspect, size: job.size, date: new Date().toISOString(), note: r.text.slice( 0, 500 ) } ) + '\n' );
			console.log( `${ path } (${ ( img.data.length / 1024 ).toFixed( 0 ) } KB, ${ ( ( Date.now() - t0 ) / 1000 ).toFixed( 1 ) } s)` );

		} );

	}

	return files;

}

function parse( argv ) {

	const job = { ref: [] };
	const rest = [];
	for ( let i = 0; i < argv.length; i ++ ) {

		const a = argv[ i ];
		if ( a === '--out' ) job.out = argv[ ++ i ];
		else if ( a === '--model' ) job.model = argv[ ++ i ];
		else if ( a === '--ref' ) job.ref.push( argv[ ++ i ] );
		else if ( a === '--aspect' ) job.aspect = argv[ ++ i ];
		else if ( a === '--size' ) job.size = argv[ ++ i ];
		else if ( a === '--n' ) job.n = Number( argv[ ++ i ] );
		else if ( a === '--batch' ) job.batch = argv[ ++ i ];
		else rest.push( a );

	}

	job.prompt = rest.join( ' ' );
	return job;

}

const job = parse( process.argv.slice( 2 ) );
try {

	if ( job.batch ) {

		const jobs = JSON.parse( readFileSync( job.batch, 'utf8' ) );
		let failed = 0;
		for ( const j of jobs ) await run( j ).catch( ( e ) => {

			failed ++;
			console.error( `failed: ${ j.out || j.prompt.slice( 0, 60 ) }: ${ e.message }` );

		} );
		process.exit( failed ? 1 : 0 );

	} else if ( job.prompt ) {

		await run( job );

	} else {

		console.log( readFileSync( new URL( import.meta.url ), 'utf8' ).split( '\n' ).slice( 1, 28 ).map( ( l ) => l.replace( /^\/\/ ?/, '' ) ).join( '\n' ) );

	}

} catch ( e ) {

	console.error( e.message );
	process.exit( 1 );

}
