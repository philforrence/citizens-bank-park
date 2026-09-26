// Builds every saved stage of the project into one static site:
//   stages/index.html       a page listing the stages (newest first), with screenshots
//   stages/step-1/, ...     each stage exactly as it was when it was tagged, playable
//
// A stage is an annotated git tag named step-N. Its message's first line is the title, the rest the
// description:  git tag -a step-2 -m "The field" -m "Grass, dirt, bases, ..."
// Screenshots are docs/stages/step-N.jpg in the current checkout (so they can be added later).
//
//   npm run stages            build into stages/
//   npm run stages:preview    serve it at http://127.0.0.1:5190
import { execSync } from 'node:child_process';
import { mkdirSync, rmSync, existsSync, symlinkSync, copyFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const root = resolve( import.meta.dirname, '..' );
const out = join( root, 'stages' );
const sh = ( cmd, opts = {} ) => execSync( cmd, { cwd: root, encoding: 'utf8', stdio: [ 'ignore', 'pipe', 'inherit' ], ...opts } );

const SEP = '\u001f';
const tags = sh( `git tag -l "step-*" --format="%(refname:short)${ SEP }%(taggerdate:short)${ SEP }%(contents:subject)${ SEP }%(contents:body)%00"` )
	.split( '\0' ).map( ( s ) => s.trim() ).filter( Boolean )
	.map( ( line ) => {

		const [ tag, date, title, body ] = line.split( SEP );
		return { tag, n: Number( tag.slice( 5 ) ), date, title: title || tag, body: ( body || '' ).trim() };

	} )
	.filter( ( t ) => Number.isFinite( t.n ) )
	.sort( ( a, b ) => a.n - b.n );

if ( ! tags.length ) {

	console.error( 'No stages yet: tag one with  git tag -a step-1 -m "Title" -m "Description"' );
	process.exit( 1 );

}

rmSync( out, { recursive: true, force: true } );
mkdirSync( join( out, 'shots' ), { recursive: true } );
const work = join( tmpdir(), 'cbp-stages-' + process.pid );

for ( const t of tags ) {

	console.log( `building ${ t.tag }: ${ t.title }` );
	const src = join( work, t.tag );
	mkdirSync( src, { recursive: true } );
	// the stage's files exactly as tagged, built with this checkout's node_modules
	sh( `git archive ${ t.tag } | tar -x -C "${ src }"` );
	symlinkSync( join( root, 'node_modules' ), join( src, 'node_modules' ), 'dir' );
	sh( `npx vite build --base ./ --outDir "${ join( out, t.tag ) }" --emptyOutDir --logLevel warn`, { cwd: src } );
	const shot = join( root, 'docs', 'stages', t.tag + '.jpg' );
	if ( existsSync( shot ) ) {

		copyFileSync( shot, join( out, 'shots', t.tag + '.jpg' ) );
		t.shot = `shots/${ t.tag }.jpg`;

	}

}

rmSync( work, { recursive: true, force: true } );
copyFileSync( join( root, 'public', 'favicon.svg' ), join( out, 'favicon.svg' ) );
writeFileSync( join( out, 'index.html' ), page( tags ) );
console.log( `\n${ tags.length } stage(s) in stages/` );

function esc( s ) {

	return s.replace( /&/g, '&amp;' ).replace( /</g, '&lt;' ).replace( />/g, '&gt;' ).replace( /"/g, '&quot;' );

}

function page( list ) {

	const latest = list[ list.length - 1 ];
	const cards = list.slice().reverse().map( ( t ) => `
		<article class="stage${ t === latest ? ' is-latest' : '' }">
			<a class="shot" href="${ t.tag }/" aria-label="Play ${ esc( t.title ) }">
				${ t.shot ? `<img src="${ t.shot }" alt="" loading="lazy" />` : '<div class="noshot">No screenshot yet</div>' }
			</a>
			<div class="meta">
				<p class="kicker">Step ${ t.n }${ t === latest ? ' · latest' : '' }${ t.date ? ` · ${ t.date }` : '' }</p>
				<h2>${ esc( t.title ) }</h2>
				${ t.body ? `<p class="body">${ esc( t.body ).replace( /\n+/g, '<br />' ) }</p>` : '' }
				<a class="play" href="${ t.tag }/">Play step ${ t.n }</a>
			</div>
		</article>` ).join( '' );

	return `<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>Citizens Bank Park · Stages</title>
	<link rel="icon" href="favicon.svg" type="image/svg+xml" />
	<style>
		:root { color-scheme: dark; --bg: #0b1016; --card: #141b24; --ink: #eef3f8; --dim: #93a3b5; --red: #e81828; --line: #243040; }
		* { box-sizing: border-box; }
		body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif; }
		main { max-width: 980px; margin: 0 auto; padding: 48px 20px 64px; }
		header h1 { margin: 0; font-size: clamp(28px, 5vw, 44px); letter-spacing: 0.12em; font-weight: 700; }
		header p { margin: 8px 0 0; color: var(--dim); max-width: 60ch; }
		.stages { display: grid; gap: 20px; margin-top: 36px; }
		.stage { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); background: var(--card); border: 1px solid var(--line); border-radius: 14px; overflow: hidden; }
		.stage.is-latest { border-color: color-mix(in srgb, var(--red) 55%, var(--line)); }
		.shot { display: block; aspect-ratio: 16 / 10; background: #0e141b; }
		.shot img { width: 100%; height: 100%; object-fit: cover; display: block; }
		.noshot { height: 100%; display: grid; place-items: center; color: var(--dim); }
		.meta { padding: 20px 22px; display: flex; flex-direction: column; gap: 6px; }
		.kicker { margin: 0; color: var(--dim); font-size: 13px; letter-spacing: 0.04em; }
		h2 { margin: 0; font-size: 22px; }
		.body { margin: 4px 0 8px; color: #c5d0dc; }
		.play { margin-top: auto; align-self: flex-start; background: var(--red); color: #fff; text-decoration: none; font-weight: 600; padding: 9px 16px; border-radius: 999px; }
		.play:hover { filter: brightness(1.1); }
		footer { margin-top: 40px; color: var(--dim); font-size: 13px; }
		footer a { color: var(--ink); }
		@media (max-width: 720px) { .stage { grid-template-columns: 1fr; } }
	</style>
</head>
<body>
	<main>
		<header>
			<h1>CITIZENS BANK PARK</h1>
			<p>A walkable Citizens Bank Park in the browser, built step by step. Every stage below is playable as it was when it was finished. Needs a browser with WebGPU (Chrome or Edge); the first load of each stage compiles its shaders.</p>
		</header>
		<section class="stages">${ cards }
		</section>
		<footer>
			<p>Built on <a href="https://github.com/dgreenheck/tidewater">Tidewater</a> by Dan Greenheck. An unofficial fan project, not affiliated with the Philadelphia Phillies, Major League Baseball or Citizens Bank.</p>
		</footer>
	</main>
</body>
</html>
`;

}
