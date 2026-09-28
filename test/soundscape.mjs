// The soundscape (places/Soundscape.js) on the CPU: a stand-in Web Audio API (nodes that only count and
// check their calls), GameSound, the real Director and the replay run through from the first pitch to the
// celebration at the replay's pace, the camera walked through the bowl, a concourse, a tunnel and the
// plaza. Checks: it starts, every part's timeline fires, nothing throws, the AudioParams only get finite
// values, and the per-frame cost stays small.
//
//   node test/soundscape.mjs
import { Director } from '../src/ballpark/game/Director.js';
import { GAME } from '../src/ballpark/data/game-2008-ws5.js';

import { counts, bad } from './webaudio-stub.mjs';

// ---------------------------------------------------------------- the app round it

const { GameSound } = await import( '../src/ballpark/game/GameSound.js' );
const { default: Soundscape } = await import( '../src/ballpark/places/Soundscape.js' );
const { Vector3 } = await import( '../src/engine/index.js' );

const director = new Director( { game: GAME, players: { add: () => ( {} ) }, ball: { set() {} } } );
const field = {
	y0: - 7,
	toWorld: ( x, z, out = new Vector3() ) => out.set( x, 0, z ),
	toField: ( x, z ) => [ x, z ],
};
// a cover map: a concourse roof 5 m over the main concourse ring (radius 70-80 m from home), a tunnel's
// low ceiling at one spot, open everywhere else
const nx = 400, heights = new Float32Array( nx * nx ).fill( - 1e4 );
for ( let iz = 0; iz < nx; iz ++ ) for ( let ix = 0; ix < nx; ix ++ ) {

	const x = - 150 + ( ix + 0.5 ) * 0.75, z = - 180 + ( iz + 0.5 ) * 0.75, r = Math.hypot( x, z );
	if ( r > 70 && r < 80 && z > - 20 ) heights[ ix + iz * nx ] = 13;
	if ( Math.abs( x - 40 ) < 2 && z > 55 && z < 65 ) heights[ ix + iz * nx ] = 9.5;

}

const app = {
	rainCover: { heights, x0: - 150, z0: - 180, cell: 0.75, nx },
	rain: { amount: 0 },
	places: [],
	walker: {},
	sound: new GameSound(),
};
const bowl = { roofBack: { line: [ [ - 100, - 40 ], [ - 70, 60 ], [ 0, 95 ], [ 70, 60 ], [ 100, - 40 ] ], y: 41 }, crowd: { _mood: { stand: 0, cheer: 0, clap: 0.2, jump: 0, towel: 0 } } };
app.director = director;
const sc = new Soundscape( { app, field, bowl } );
app.places.push( sc );
app.sound.resume();
const camera = { position: new Vector3( 0, 10, 60 ), matrixWorld: { elements: [ 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1 ] } };
// where to stand as the night goes on: the seats behind home, the concourse, a tunnel, the plaza, high up
const spots = [ [ 0, 6, 45 ], [ 0, 8.6, 75 ], [ 40, 8, 60 ], [ 0, 8.6, 130 ], [ - 60, 30, 60 ] ];

// ---------------------------------------------------------------- the night

const fired = {};
const ev = sc._event.bind( sc );
let dt = 1 / 30, frames = 0, worst = 0, total = 0;
const zones = {};
director.update = ( d ) => {

	director.t = Math.min( director.duration, director.t + d * director.speed );

};

await new Promise( ( r ) => r() );
// the first update builds it; hook the events to count them
sc.update( dt, director, camera );
sc._event = ( e ) => {

	fired[ e.kind ] = ( fired[ e.kind ] || 0 ) + 1;
	ev( e );

};

await new Promise( ( r ) => setImmediate( r ) );
app.sound.onLoaded?.();
while ( director.t < director.duration - 0.01 ) {

	director.update( dt );
	app.sound.ctx.currentTime += dt;
	app.rain.amount = director.t < sc.plan.night2 ? Math.min( 1, 0.3 + director.t / 2200 ) : 0;
	const k = Math.floor( director.t / 300 ) % spots.length;
	camera.position.set( ...spots[ k ] ).add( new Vector3( 0, - 7, 0 ) );
	const t0 = performance.now();
	sc.update( dt, director, camera );
	app.sound.listen( camera );
	const ms = performance.now() - t0;
	total += ms;
	worst = Math.max( worst, ms );
	zones[ sc.space.zone ] = ( zones[ sc.space.zone ] || 0 ) + 1;
	frames ++;
	// let the made sounds come back (Synth.js runs its recipes a tick later without a worker)
	if ( frames % 300 === 1 ) await new Promise( ( r ) => setImmediate( r ) );
	for ( let i = 0; i < 3; i ++ ) app.walker.audio?.footstep?.( 'concrete' );

}

// the HUD's sound switch: off for a while, the audio thread sleeps; on, it wakes
app.sound.setMuted( true );
for ( let i = 0; i < 90; i ++ ) sc.update( dt, director, camera );
const slept = app.sound.ctx.state;
app.sound.setMuted( false );
sc.update( dt, director, camera );
const woke = app.sound.ctx.state;
// a jump back, and a scrub, mustn't fire anything
const before = JSON.stringify( fired );
director.t = 100;
sc.update( dt, director, camera );
director.t = 2000;
sc.update( dt, director, camera );
const after = JSON.stringify( fired );

console.log( 'events fired:', fired );
console.log( 'zones (frames):', zones );
console.log( `frames ${ frames }, mean ${ ( total / frames ).toFixed( 4 ) } ms, worst ${ worst.toFixed( 2 ) } ms (the first builds the synthesized sounds)` );
console.log( 'audio nodes made', counts.nodes, 'sources started', counts.starts );
let fail = 0;
const check = ( ok, what ) => {

	if ( ! ok ) {

		fail ++;
		console.error( 'FAIL', what );

	}

};

check( bad.n === 0, `${ bad.n } non-finite or bad AudioParam values` );
for ( const k of [ 'pa', 'music', 'fans', 'chant', 'hush', 'crew', 'crewcall', 'night2', 'celebrate', 'walkup', 'sting', 'ump' ] ) check( fired[ k ] > 0, `no ${ k } events` );
check( before === after, 'a jump fired events' );
check( slept === 'suspended' && woke === 'running', `mute: the audio slept ${ slept }, woke ${ woke }` );
check( total / frames < 0.2, 'mean frame cost over 0.2 ms' );
for ( const z of [ 'bowl', 'roof', 'outside' ] ) check( zones[ z ] > 0, `never in zone ${ z }` );
if ( fail ) process.exit( 1 );
console.log( 'soundscape: ok' );
