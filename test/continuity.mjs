// The replay's continuity, headless (FX2, gauntlet step 9): walks the whole replay at 30 Hz through the
// Director (the players, the coaches, the umpires, the celebration's people, the rituals' crews on the
// rig, the bat boys) and the rituals' press, and flags anyone who moves further in one frame than a man
// can (a jump), or goes (a vanishing) somewhere a camera can see him. A man jumping a few metres in a
// frame breaks the illusion more than any texture.
//
//   node test/continuity.mjs                 the whole replay (about 10 s), a summary and the worst
//   node test/continuity.mjs 3480 3800       from t 3480 s to 3800 s
//   node test/continuity.mjs --all           every flag, not just the worst 40
//   node test/continuity.mjs --json out.json every flag as JSON
//
// What counts: a step over 0.6 m in 1/30 s (18 m/s: faster than anyone runs, slides or dives) for a man
// who was there the frame before; and anyone who's dropped from the frame standing on the field or the
// warning track (not off through a dugout, a bullpen gate or the tunnel: those are exits). Each flag says
// whether it falls on a segment's first frame ("at a cut": FOX's TV usually cuts there, but the fixed
// center, high and follow cameras don't) or inside a segment (always seen). Deliberate hides (the rain
// delay's field, the suspension's split between the two nights) are listed as such and don't fail.
//
// Not in npm test (it walks 113,000 frames, ~4 s). Exits 1 if anything jumps more than 0.7 m inside a
// segment or at a join (outside the deliberate ones), vanishes or appears on the field, or the clock moved.

// ---- a do-nothing 2D canvas and GPU device, so the places' people build in Node (FB4's stub.mjs)
const ctx = new Proxy( {}, { get: ( o, k ) => k in o ? o[ k ] : ( k === 'measureText' ? () => ( { width: 10 } ) : k === 'getImageData' || k === 'createImageData' ? ( x, y, w = 1, h = 1 ) => ( { data: new Uint8ClampedArray( w * h * 4 ), width: w, height: h } ) : k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern' ? () => ( { addColorStop() {} } ) : () => {} ), set: ( o, k, v ) => { o[ k ] = v; return true; } } );
globalThis.OffscreenCanvas ??= class { constructor( w, h ) { this.width = w; this.height = h; } getContext() { return ctx; } convertToBlob() { return Promise.resolve( null ); } };
globalThis.document ??= { createElement: () => new globalThis.OffscreenCanvas( 1, 1 ) };
const any = () => new Proxy( function () {}, { get: ( o, k ) => k === 'then' ? undefined : k === Symbol.toPrimitive ? () => 0 : any(), apply: () => any(), construct: () => any() } );
for ( const k of [ 'GPUTextureUsage', 'GPUBufferUsage', 'GPUShaderStage', 'GPUMapMode', 'GPUColorWrite' ] ) globalThis[ k ] ??= new Proxy( {}, { get: () => 1 } );

const root = new URL( '../src/', import.meta.url ).href;
const { GPU } = await import( root + 'engine/gpu/GPU.js' );
GPU.device = any();
for ( const k of Object.keys( GPU ) ) if ( GPU[ k ] == null ) GPU[ k ] = any();
const { Director } = await import( root + 'ballpark/game/Director.js' );
const { GAME } = await import( root + 'ballpark/data/game-2008-ws5.js' );
const { OnDeck } = await import( root + 'ballpark/places/rail/OnDeck.js' );

const args = process.argv.slice( 2 );
const nums = args.filter( ( a ) => /^-?[\d.]+$/.test( a ) ).map( Number );
const ALL = args.includes( '--all' );
const jsonOut = args.includes( '--json' ) ? args[ args.indexOf( '--json' ) + 1 ] : null;
const STEP = 0.6;

const d = new Director( { game: GAME, players: { add: () => ( { look: { height: 1 } } ), remove() {} }, ball: { set() {} } } );
// the bat boys, as OnDeck hooks them in (its rail figures aren't needed: the boys are on the rig)
const od = Object.create( OnDeck.prototype );
const face = ( s ) => Math.atan2( s[ 0 ], s[ 1 ] );
od.boys = { home: { spot: [ 16.09, 4.97 ], face: face( [ 16.09, 4.97 ] ) }, away: { spot: [ - 16.09, 4.97 ], face: face( [ - 16.09, 4.97 ] ) } };
od.fetches = null;
d.extras = [ ( dd, seg, lt, t ) => od._actBoys( dd, t ) ];

// the press round the celebration's stage (places/rituals/Press.js), if it builds here
let press = null;
try {

	const { Press } = await import( root + 'ballpark/places/rituals/Press.js' );
	const { Group } = await import( root + 'engine/index.js' );
	press = new Press( { group: new Group() } );

} catch ( e ) {

	console.log( 'the press: not checked (' + e.message.split( '\n' )[ 0 ] + ')' );

}

const dt = 1 / 30;
const t0 = Math.max( 0, nums[ 0 ] ?? 0 ), t1 = Math.min( d.duration, nums[ 1 ] ?? d.duration );
const i0 = Math.ceil( t0 / dt ), i1 = Math.floor( t1 / dt );
const S = d.suspension, split = d.night().split;
const cel = d.segments.find( ( s ) => s.kind === 'celebrate' );

// where a man may leave the picture: the dugouts (and their steps), the bullpens' gates in the outfield
// wall, the tunnel behind home, the clubhouse doors down the lines; anything past the warning track
const exitOK = ( x, z ) => {

	if ( Math.abs( x ) > 12 && z > - 6 && z < 14 ) return true; // the dugouts, their steps and rails
	if ( Math.abs( x ) > 26 && Math.abs( x ) < 34 && z > - 12 && z < - 4 ) return true; // the camera wells
	if ( z > 9 ) return true; // behind home: the tunnel, the backstop's gate
	if ( Math.hypot( x, z ) > 95 ) return true; // the warning track's far side, the pens
	if ( Math.hypot( Math.abs( x ) - 42.2, z + 20.4 ) < 2 ) return true; // the grounds crew's gates in the foul walls
	return false;

};
const who = ( id ) => typeof id === 'number' ? ( id < 0 ? 'umpire ' + id : ( GAME.players[ id ]?.last || id ) + ' (' + id + ')' ) : String( id );

const last = new Map(), flags = [];
const tic = performance.now();
for ( let i = i0; i <= i1; i ++ ) {

	const t = i * dt;
	d.pose( t );
	const seg = d.segmentAt( t );
	const first = t - seg.t0 < dt - 1e-6;
	// the deliberate cuts in the action: the suspension's split between the 27th and the 29th (the park
	// emptied, the tarp, another night), and the rain delay's start (the field cleared as the tarp goes on)
	const deliberate = Math.abs( t - split ) < dt || ( first && seg === S );
	const seen = new Map( d.actors );
	if ( press && cel && t >= cel.t0 ) {

		press.update( t - cel.t0, d.actors, dt, null );
		for ( const q of press.people ) if ( q.p.visible ) seen.set( 'press:' + q.i, { x: q.p.x, z: q.p.z } );

	}

	for ( const [ id, a ] of seen ) {

		const l = last.get( id );
		if ( l && l.i === i - 1 ) {

			const step = Math.hypot( a.x - l.x, a.z - l.z );
			if ( step > STEP ) flags.push( { kind: 'jump', t: + t.toFixed( 3 ), id, who: who( id ), step: + step.toFixed( 2 ), from: [ + l.x.toFixed( 1 ), + l.z.toFixed( 1 ) ], to: [ + a.x.toFixed( 1 ), + a.z.toFixed( 1 ) ], seg: seg.kind, lt: + ( t - seg.t0 ).toFixed( 3 ), atCut: first, deliberate } );

		}

		else if ( i > i0 && ! exitOK( a.x, a.z ) ) flags.push( { kind: 'appear', t: + t.toFixed( 3 ), id, who: who( id ), step: 0, from: [ + a.x.toFixed( 1 ), + a.z.toFixed( 1 ) ], seg: seg.kind, lt: + ( t - seg.t0 ).toFixed( 3 ), atCut: first, deliberate } );
		last.set( id, { x: a.x, z: a.z, i } );

	}

	for ( const [ id, l ] of last ) {

		if ( l.i !== i - 1 || seen.has( id ) || exitOK( l.x, l.z ) ) continue;
		flags.push( { kind: 'vanish', t: + t.toFixed( 3 ), id, who: who( id ), step: 0, from: [ + l.x.toFixed( 1 ), + l.z.toFixed( 1 ) ], seg: seg.kind, lt: + ( t - seg.t0 ).toFixed( 3 ), atCut: first, deliberate } );

	}

}

const ms = performance.now() - tic;
const jumps = flags.filter( ( f ) => f.kind === 'jump' ), vanish = flags.filter( ( f ) => f.kind === 'vanish' );
const bad = flags.filter( ( f ) => ! f.deliberate && ( f.kind !== 'jump' || f.step > 0.7 ) );
console.log( `the replay ${ t0.toFixed( 1 ) }-${ t1.toFixed( 1 ) } s at 30 Hz: ${ i1 - i0 + 1 } frames in ${ ( ms / 1000 ).toFixed( 1 ) } s` );
console.log( `jumps over ${ STEP } m in a frame: ${ jumps.length } (inside a segment ${ jumps.filter( ( f ) => ! f.atCut && ! f.deliberate ).length }, at a segment's first frame ${ jumps.filter( ( f ) => f.atCut && ! f.deliberate ).length }, deliberate ${ jumps.filter( ( f ) => f.deliberate ).length })` );
console.log( `vanishings on the field: ${ vanish.length } (inside a segment ${ vanish.filter( ( f ) => ! f.atCut && ! f.deliberate ).length }, deliberate ${ vanish.filter( ( f ) => f.deliberate ).length })` );
const appear = flags.filter( ( f ) => f.kind === 'appear' );
console.log( `appearances on the field: ${ appear.length } (inside a segment ${ appear.filter( ( f ) => ! f.atCut && ! f.deliberate ).length }, deliberate ${ appear.filter( ( f ) => f.deliberate ).length })` );
// by who and where in the replay, worst first
const groups = new Map();
for ( const f of flags ) {

	if ( f.deliberate ) continue;
	const k = f.kind + ' ' + f.seg + ( f.atCut ? ' (first frame)' : '' ) + ' ' + ( typeof f.id === 'number' ? ( f.id < 0 ? 'umpire' : 'player' ) : String( f.id ).replace( /[-:]?\d+$/, '' ) );
	const g = groups.get( k ) || groups.set( k, [] ).get( k );
	g.push( f );

}

const rows = [ ...groups.entries() ].map( ( [ k, g ] ) => [ k, g, g.reduce( ( m, f ) => Math.max( m, f.step ), 0 ) ] ).sort( ( a, b ) => b[ 2 ] - a[ 2 ] || b[ 1 ].length - a[ 1 ].length );
for ( const [ k, g, mx ] of rows ) {

	const top = g.slice().sort( ( a, b ) => b.step - a.step ).slice( 0, ALL ? g.length : 3 );
	console.log( `  ${ k }: ${ g.length }${ mx ? ', worst ' + mx.toFixed( 2 ) + ' m' : '' }` );
	for ( const f of top ) console.log( `      t ${ f.t } (${ f.seg } +${ f.lt }) ${ f.who } ${ f.kind === 'jump' ? f.step + ' m ' + JSON.stringify( f.from ) + ' -> ' + JSON.stringify( f.to ) : ( f.kind === 'vanish' ? 'gone at ' : 'out of nowhere at ' ) + JSON.stringify( f.from ) }` );

}

if ( jsonOut ) ( await import( 'node:fs' ) ).writeFileSync( jsonOut, JSON.stringify( flags, null, 1 ) );
// the replay's clock, for whoever changed the Director (FR2's hash of the segments' starts)
let h = 0;
for ( const sg of d.segments ) h = ( h * 31 + Math.round( sg.t0 * 1000 ) ) % 1000000007;
console.log( `the clock: ${ d.segments.length } segments, start hash ${ h } (801248349), duration ${ d.duration.toFixed( 3 ) } (3785.503)` );
process.exit( bad.length || h !== 801248349 ? 1 : 0 );
