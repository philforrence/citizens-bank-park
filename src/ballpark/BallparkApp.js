import { Vector3, Euler, Color, MathUtils, Box3, Sphere } from '../engine/index.js';
import { GPU } from '../engine/gpu/GPU.js';
import { ShaderModule } from '../engine/gpu/Shader.js';
import { SunShadows } from '../engine/render/Shadows.js';
import { FrameUniforms } from '../engine/render/Frame.js';
import { SceneLighting, surfaceModule } from '../engine/render/wgsl/lighting.js';

import { Engine } from '../core/Engine.js';
import { Profiler } from '../core/Profiler.js';
import { Input } from '../core/Input.js';
import { G } from '../core/Globals.js';
import { SceneRenderer, LAYERS } from '../core/SceneRenderer.js';

import { Atmosphere, SUN_ILLUMINANCE } from '../sky/Atmosphere.js';
import { Sky, sunDirectionFromTime } from '../sky/Sky.js';
import { SkyProClouds } from '../sky/SkyProClouds.js';
import { Environment } from '../sky/Environment.js';
import { LocalLights } from '../materials/LocalLights.js';

import { Underwater } from '../post/Underwater.js';
import { PostFX } from '../post/PostFX.js';
import { AirHaze } from '../post/AirHaze.js';
import { updateCameraVelocity } from '../post/CameraVelocity.js';
import { FlyCamera } from '../player/FlyCamera.js';
import { Colliders } from '../world/Colliders.js';

import { DryWater, DRY_LEVEL } from './DryWater.js';
import { Ground } from './Ground.js';
import { Field } from './Field.js';
import { Bowl, offsetPolyline } from './Bowl.js';
import { Exterior, GATES } from './Exterior.js';
import { Surroundings } from './Surroundings.js';
import { Landmarks } from './Landmarks.js';
import { Details2008 } from './Details2008.js';
import { Fascia } from './Fascia.js';
import { Concourse } from './Concourse.js';
import { People } from './People.js';
import { Complex } from './Complex.js';
import { SkyGlow } from './SkyGlow.js';
import { batchStatic, imageTexturesReady } from './geo.js';
import { Players } from './game/Players.js';
import * as Motions from './game/Motions.js';
import { Ball } from './game/Ball.js';
import { Director } from './game/Director.js';
import { CEL, STAGE, PILE, MVP, trophyHold } from './game/Celebration.js'; // (---- FB4: MVP)
import { replayPlan, replayAt } from './game/Replays.js';
import { BASES, DUGOUT, BULLPEN } from './game/Plays.js';
import { GameHUD } from './game/GameHUD.js';
import { Radio } from './game/Radio.js';
import { GameSound } from './game/GameSound.js';
import { Rain } from './game/Rain.js';
import { rainCover } from './RainCover.js';
import { GAME } from './data/game-2008-ws5.js';
import { FOOTPRINT, LEVELS } from './layout.js';
import { Walker } from './Walker.js';
import { Scope } from './Scope.js';
import { PLACES } from './places/index.js';
// ---- R (rituals)
import { tarpState, rollAxis, tarpFocus, T27, T29, TARP_ON_29 } from './game/TarpPlan.js'; // ---- FR2: tarpFocus, T27, T29 (FB4: TARP_ON_29)
import { G29 } from './game/Suspension.js'; // ---- FB4 (C4B-7): God Bless America's time
// ---- end R
import { Night, nightAirModule, BEAM } from './Night.js'; // ---- L: light and night
import { when as gameClock } from './places/alley/Night.js'; // the replay's wall clock (the Alley's)

const _up = new Vector3( 0, 1, 0 );

// South Philadelphia
const LATITUDE = 39.9;

// World axes (as Tidewater's sky): +x east, +y up, -z north. Metres. Home plate is at the origin
// (see layout.js). You start in the plaza at Pattison Avenue and Citizens Bank Way, looking at the Third
// Base Gate (field frame [ x, z ] and the point you face).
const START = { at: [ - 112, 78 ], look: GATES[ 0 ].at };

// Eastern Daylight Time (October 2008: the clocks went back on November 2) to local solar time in South
// Philadelphia: an hour back for daylight saving, the equation of time (+16 min at the end of
// October), and 75.17° W against the zone's 75° meridian (-0.7 min). 8:38 pm is 19.9 solar.
export const EDT_TO_SOLAR = - 1 + 16.2 / 60 - 0.7 / 60;

// what the mode label and the toast call each camera (C steps through them)
export const CAMERA_NAMES = { walk: 'Walking', tv: 'FOX broadcast', center: 'Center field camera', high: 'High home camera', follow: 'Following the ball' };

// a repeatable 0..1 from a number (which close-up a pitch gets)
const hashT = ( n ) => {

	const s = Math.sin( n * 12.9898 ) * 43758.5453;
	return s - Math.floor( s );

};

// the sun's declination on a date (degrees): where the sun really is in the sky today
function solarDeclination( date = new Date() ) {

	const start = Date.UTC( date.getUTCFullYear(), 0, 0 );
	const day = ( date.getTime() - start ) / 86400000;
	return - 23.44 * Math.cos( 2 * Math.PI / 365 * ( day + 10 ) );

}

// The ballpark app: Tidewater's engine, sky, lighting and post chain, with the ocean, island and
// fishing game taken out. Systems are built in init(), then frame() runs every animation frame.
export class BallparkApp {

	constructor() {

		this.settings = {
			// local solar time, hours. Both nights were night games (first pitch 8:38 pm on the 27th, the
			// last out at 9:58 on the 29th), so it follows the replay's clock (gameClock, _gameHour()); 20
			// until the replay is there. (It was 16, Tidewater's afternoon, from step 1.)
			timeOfDay: 20.0,
			sunAzimuth: 0, // degrees: turns the sun's daily path about the vertical
			timeSpeed: 0, // hours per real second
			exposure: 0.55,
			renderScale: 1, // internal resolution (the temporal upscaler reconstructs the output)
		};
		this.skyGlow = 0.006; // the urban sky glow at night (see _weather)
		this.qs = new URLSearchParams( location.search );
		// the light follows the game's clock until you set the hour yourself
		this.gameClock = true;
		// ?hour=21 sets the time of day (local solar time) and holds it there
		if ( this.qs.has( 'hour' ) ) {

			this.settings.timeOfDay = Number( this.qs.get( 'hour' ) ) || this.settings.timeOfDay;
			this.gameClock = false;

		}
		this.declination = solarDeclination();

	}

	async init( onProgress = () => {} ) {

		const qs = this.qs;
		// report a stage, then let the page paint it before the (synchronous) stage work starts
		const progress = async ( p, text, until ) => {

			onProgress( p, text, until );
			if ( typeof requestAnimationFrame === 'function' ) await new Promise( ( r ) => requestAnimationFrame( () => setTimeout( r, 0 ) ) );

		};

		await progress( 0.02, 'Starting WebGPU…' );
		const engine = this.engine = new Engine( document.getElementById( 'app' ) );
		await engine.init();
		const renderer = engine;
		const { scene, camera } = engine;
		camera.near = 0.1;
		camera.updateProjectionMatrix();
		this.renderer = renderer;
		this.scene = scene;
		this.camera = camera;

		// no sea: the camera and every pixel are always in air
		G.cameraWaterHeight.value = DRY_LEVEL;
		G.cameraUnderwater.value = 0;

		this.input = new Input( engine.domElement );
		this.fly = new FlyCamera( camera, engine.domElement, this.input );
		this.fly.setPose( new Vector3( 0, 25, 60 ), 0.18, - 0.25 );

		// ---------------------------------------------------------------- sky
		await progress( 0.05, 'Building the sky…' );
		this.atmosphere = new Atmosphere( renderer );
		this.sky = new Sky( this.atmosphere );
		if ( ! qs.has( 'noClouds' ) ) {

			this.clouds = new SkyProClouds( renderer, this.atmosphere );
			if ( this.clouds.ready ) await this.clouds.ready;
			this.sky.clouds = this.clouds;
			// cloud shadows drifting over the ground (the only direct-light modulation without the sea)
			SceneLighting.set( 'directModulation', new ShaderModule( {
				name: 'hook-directModulation-clouds',
				deps: [ surfaceModule, this.clouds.shadowModule ],
				code: 'fn hookDirectModulation( P: vec3f, N: vec3f ) -> vec3f { return vec3f( cloudsShadow( P.xz ) ); }',
			} ) );

		}

		// 3 cascades: 0-10 m (fine contact detail), 10-60 m, 60-400 m (the whole ballpark)
		this.shadows = new SunShadows( { size: 2048, splits: [ 10, 60, 400 ], lightMargin: 200, normalBias: [ 0.015, 0.06, 0.3 ], bias: 0.00002 } );
		this.shadows.layerMask = ( 1 << LAYERS.OPAQUE ) | ( 1 << LAYERS.TRANSPARENT );
		this.environment = new Environment( renderer, scene, this.sky );

		// ---------------------------------------------------------------- world
		// ?only= / ?focus=: part of the park (Scope.js); the parts not built are undefined below
		const scope = this.scope = new Scope( qs, PLACES.map( ( [ name ] ) => name ) );
		// how long each part takes to build (CPU), in ms
		const buildMs = this.buildMs = {};
		const time = ( name, make ) => {

			const t0 = performance.now();
			const r = make();
			buildMs[ name ] = Math.round( performance.now() - t0 );
			return r;

		};

		await progress( 0.1, 'Laying the ground…' );
		this.colliders = new Colliders();
		this.field = time( 'field', () => new Field( { scene, colliders: this.colliders } ) );
		const fieldOwn = [ ...this.field.group.children ];
		await progress( 0.14, 'Building the stands…' );
		this.bowl = time( 'bowl', () => new Bowl( { field: this.field, colliders: this.colliders, crowd: scope.has( 'crowd' ) } ) );
		await progress( 0.17, 'Bricking the facade…' );
		const F = this.field, B = this.bowl, colliders = this.colliders;
		if ( scope.builds( 'exterior' ) ) this.exterior = time( 'exterior', () => {

			const e = new Exterior( { field: F, colliders } );
			e.buildGateSign( B );
			return e;

		} );
		await progress( 0.19, 'Raising the skyline…' );
		if ( scope.builds( 'surroundings' ) ) this.surroundings = time( 'surroundings', () => new Surroundings( { field: F } ) );
		if ( scope.builds( 'complex' ) ) this.complex = time( 'complex', () => new Complex( { field: F } ) );
		if ( scope.builds( 'landmarks' ) ) this.landmarks = time( 'landmarks', () => new Landmarks( { field: F, bowl: B, colliders } ) );
		if ( scope.builds( 'details' ) ) this.details = time( 'details', () => new Details2008( { field: F } ) );
		if ( scope.builds( 'fascia' ) ) this.fascia = time( 'fascia', () => new Fascia( { field: F, bowl: B } ) );
		if ( scope.builds( 'concourse' ) ) this.concourse = time( 'concourse', () => new Concourse( { field: F, bowl: B, colliders } ) );
		if ( scope.builds( 'people' ) ) this.people = time( 'people', () => new People( { field: F, bowl: B, concourse: this.concourse, exterior: this.exterior, landmarks: this.landmarks } ) );
		// the little worlds (places/index.js)
		this.places = [];
		for ( const [ name, Place ] of PLACES ) {

			if ( ! scope.builds( name ) ) continue;
			const place = time( name, () => new Place( { app: this, field: F, bowl: B, people: this.people, colliders, scope } ) );
			place.name = name;
			if ( place.group && ! place.group.parent ) F.group.add( place.group );
			this.places.push( place );

		}

		if ( ! scope.full ) {

			// the fans without their stands: keep them where they sit
			if ( scope.has( 'crowd' ) && ! scope.has( 'bowl' ) ) for ( const m of B.crowd.meshes ) F.group.attach( m );
			const removed = scope.apply( F.group, {
				field: fieldOwn, bowl: [ B.group ], crowd: B.crowd.meshes, exterior: [ this.exterior?.group ], surroundings: [ this.surroundings?.group ],
				complex: [ this.complex?.group ], landmarks: [ this.landmarks?.group ], details: [ this.details?.group ], fascia: [ this.fascia?.group ],
				concourse: [ this.concourse?.group ], people: [ this.people?.mesh ],
				...Object.fromEntries( this.places.map( ( p ) => [ p.name, [ p.group ] ] ) ),
			}, ( x, z ) => F.toField( x, z ) );
			console.info( `scope: ${ scope.only ? 'only ' + [ ...scope.only ].join( ', ' ) : 'all parts' }${ scope.focus ? `, focus ${ Object.values( scope.focus ).join( ', ' ) } (${ removed.focus } meshes outside dropped)` : '' }` );

		}

		// the rain kept out from under the decks and the stands, from whatever's in scope (RainCover.js), before
		// the batching takes the bowl's meshes apart
		// (---- H: and the roofs a place puts up over its people, its `rainRoof`: Harry the K's walkway)
		const cover = time( 'rainCover', () => rainCover( F, [ B.group, this.exterior?.group, this.concourse?.group, ...this.places.flatMap( ( p ) => p.rainRoof || [] ) ] ) );
		// the hundreds of little static meshes merged by material into a few draws
		const batched = time( 'batching', () => batchStatic( this.field.group ) );
		console.info( `static batching: ${ batched.before } meshes into ${ batched.after }` );
		this.players = time( 'players', () => new Players( { parent: this.field.group } ) );
		if ( qs.has( 'poses' ) ) this._poseLineup();
		else {

			// the 2008 World Series, Game 5, replayed on the field
			this.ball = new Ball( this.field.group );
			this.director = new Director( { game: GAME, players: this.players, ball: this.ball } );
			this.radio = new Radio();
			this.sound = this.audio = new GameSound();
			this.director.onCue = ( cue ) => this._cue( cue );
			this.rain = new Rain( scene );
			this.rain.setLights( this.bowl.lightSources().map( ( l ) => l.position ) );
			this.rain.setCover( cover.heights, cover );
			this.rainCover = cover; // ---- S: the soundscape hears what's overhead (places/sound/Space.js)
			if ( qs.has( 't' ) ) this.director.seek( Number( qs.get( 't' ) ) );
			if ( qs.has( 'play' ) ) this.director.seek( this.director.timeOfPlay( Number( qs.get( 'play' ) ) ) );
			if ( qs.has( 'paused' ) ) this.director.playing = false;

		}
		// ?only= without 'players': the timeline still runs (the weather, the boards), undrawn
		if ( ! scope.has( 'players' ) ) for ( const m of [ this.players.mesh, this.ball?.mesh ] ) m?.removeFromParent();
		// the city's glow in the night air and the halos round the light banks; Center City is north
		// (world -z)
		this.skyGlowLayer = new SkyGlow( scene, this.bowl.lightSources().map( ( l ) => l.position ) );
		this._north = new Vector3( 0, 0, - 1 );
		// the haze thickens toward "sea level": put that under the field, which is below the street
		G.seaLevel.value = this.field.y0 - 1;
		// what you walk on: street level round the pit, the field (and the seats' colliders) inside it
		this.terrain = { heightAt: ( x, z ) => F.y0 + B.heightAt( ...F.toField( x, z ) ) };
		// ---- L: the grid of the city's streets for its lamps at night (Ground.js): the field frame's x axis
		// in the world, and the park's centre
		const gc = this.field.toWorld( 0, - 40 ), gx = this.field.toWorld( 1, - 40 );
		const grid = { centre: [ gc.x, gc.z ], axis: [ gx.x - gc.x, gx.z - gc.z ] };
		// ---- end L
		this.ground = new Ground( { scene, grid, hole: FOOTPRINT.map( ( [ x, z ] ) => {

			const w = this.field.toWorld( x, z );
			return [ w.x, w.z ];

		} ) } );

		this.sceneRenderer = new SceneRenderer( engine.meshRenderer, scene, camera );
		this.sceneRenderer.copyColor = false; // ---- SP2 (speed): nothing here samples the opaque colour's copy (no water)
		if ( this.sky.background ) this.sceneRenderer.background = this.sky.background;
		// point and spot lights: the flashlight (L) and, after dusk, the light towers aimed at the field
		this.localLights = new LocalLights();
		for ( const { position, dir } of this.bowl.lightSources() ) {

			this.localLights.add( {
				position, dir, color: new Color( 1.0, 0.97, 0.9 ), intensity: 2200, range: 380,
				// ---- L: aimed at the field (Night.js BEAM): the stands under a bank get its edge, not its core
				cosInner: Math.cos( MathUtils.degToRad( BEAM.inner ) ), cosOuter: Math.cos( MathUtils.degToRad( BEAM.outer ) ), kind: 'stadium', priority: 0,
			} );

		}

		// the plaza's lamp posts
		for ( const { position, tall } of this.exterior?.lampSources() || [] ) {

			// full cut-off: a pool of light under each
			this.localLights.add( { position, dir: new Vector3( 0, - 1, 0 ), color: new Color( 1.0, 0.78, 0.5 ), intensity: tall ? 140 : 70, range: tall ? 20 : 12,
				cosInner: Math.cos( MathUtils.degToRad( 45 ) ), cosOuter: Math.cos( MathUtils.degToRad( 72 ) ), kind: 'lamp' } );

		}

		const at = this.field.toWorld( ...START.at ), look = this.field.toWorld( ...START.look );
		const start = { position: at, yaw: Math.atan2( - ( look.x - at.x ), - ( look.z - at.z ) ) };
		this.walker = new Walker( { camera, input: this.input, ground: this.terrain, colliders: this.colliders, start } );
		this._addElevators();
		// the seated crowd is in the walker's way (CY-15: you used to walk up the rows through them)
		this.walker.blocked = ( p, r ) => this._pushFromFans( p, r );
		this.freeCam = qs.has( 'fly' );

		// ---------------------------------------------------------------- post
		// the photographs the parts asked for (imageTexture())
		await imageTexturesReady();
		await progress( 0.2, 'Preparing the shaders…' );
		this.water = new DryWater();
		// the lens / medium composite of the post chain (always "in air" here)
		this.underwater = new Underwater( {
			depthTexture: this.sceneRenderer.sceneRT.depthTexture, maskTexture: this.sceneRenderer.waterMaskTexture,
			query: this.water, caustics: null, fft: null,
		} );
		// aerial perspective and volumetric sun shafts
		this.haze = qs.has( 'noHaze' ) ? null : new AirHaze( {
			depthTexture: this.sceneRenderer.sceneRT.depthTexture, underwater: this.underwater, atmosphere: this.atmosphere,
			sky: this.sky, clouds: this.clouds, terrain: null, csm: this.shadows,
		} );
		// a summer afternoon in the city, not a humid tropical island
		if ( this.haze ) this.haze.density.value = 1.0;
		// ---- L: the night (Night.js): the light banks' glow in the air (in the haze composite), cloth
		// that soaks in the rain
		if ( this.haze ) this.haze.nightModule = nightAirModule;
		this.night = new Night( this );
		// ---- end L
		this.post = new PostFX( renderer, { sceneRenderer: this.sceneRenderer, camera, underwater: this.underwater, clouds: this.clouds, sunDir: this.atmosphere.sunDir, haze: this.haze } );
		// ?profile: GPU timestamps for every pass (post passes, shadow cascades, the scene's passes), in
		// this.profiler.result
		if ( qs.has( 'profile' ) ) {

			this.profiler = new Profiler( renderer, { enabled: true } );
			this.post.profiler = this.profiler;
			const mr = this.engine.meshRenderer, render = mr.render.bind( mr ), nodes = new Map();
			mr.render = ( scene, pass ) => {

				const key = pass.label || pass.kind;
				let node = nodes.get( key );
				if ( ! node ) {

					node = {};
					nodes.set( key, node );
					this.profiler.track( 'mesh ' + key, node );

				}

				pass.timestampWrites = node.timestampWrites;
				return render( scene, pass );

			};

		}
		G.exposure.value = this.settings.exposure;
		if ( qs.has( 'scale' ) ) this.settings.renderScale = Number( qs.get( 'scale' ) ) || 1;
		this.setRenderScale( this.settings.renderScale );

		engine.domElement.addEventListener( 'click', () => {

			if ( window.__ui && window.__ui.isPointerOverUI ) return;
			this.input.requestLock();
			if ( this.audio ) this.audio.resume();
			if ( this.radio ) this.radio.unlock();

		} );

		this.updateSun();
		window.__app = this;
		this.gpu = GPU; // console / test access

		// compile pipelines asynchronously (keeps the page responsive), then prime a few frames behind
		// the loading screen so any remaining first-use stalls happen there
		await progress( 0.25, 'Compiling shaders…', 0.95 );
		await this.precompile();
		await progress( 0.96, 'Warming up…' );
		for ( let i = 0; i < 2; i ++ ) {

			this.frame( 1 / 60 );
			await GPU.queue.onSubmittedWorkDone();

		}

	}

	// E at an elevator door rides to the next level (main concourse, suites, club, terrace, and round)
	_addElevators() {

		const F = this.field;
		for ( const bank of this.bowl.elevators || [] ) {

			bank.stops.forEach( ( stop, i ) => {

				const next = bank.stops[ ( i + 1 ) % bank.stops.length ];
				const w = F.toWorld( stop.x, stop.z );
				this.walker.interactables.push( {
					x: w.x, y: F.y0 + stop.y, z: w.z, radius: 2.2,
					text: () => `Elevator to ${ next.name.toLowerCase() }`,
					action: () => {

						const to = F.toWorld( next.x, next.z );
						// arrive facing the field
						const look = F.toWorld( next.x + next.face[ 0 ] * 10, next.z + next.face[ 1 ] * 10 );
						this.walker.setPose( new Vector3( to.x, F.y0 + next.y, to.z ), Math.atan2( - ( look.x - to.x ), - ( look.z - to.z ) ), - 0.05 );
						if ( this.ui ) this.ui.ui.toast( next.name );

					},
				} );

			} );

		}

	}

	// The seated fans as obstacles for the walker: a grid (1 m cells, world x / z) of their seats from the
	// crowd's instances, built the first time you walk near the stands; a fan pushes you out to 0.55 m
	// from his seat (your radius and his knees), at his height. The aisles have no seats, so they're the
	// way up and down; a row's front is too tight to walk along, as it is in a full house.
	_pushFromFans( p, radius ) {

		if ( this._fanGrid === undefined ) {

			this._fanGrid = null;
			const crowd = this.bowl?.crowd;
			if ( crowd?.chunks?.length ) {

				const grid = new Map(), v = new Vector3();
				for ( const ch of crowd.chunks ) {

					const m = ch.near, a = m.instanceMatrix.array;
					m.updateMatrixWorld?.();
					for ( let i = 0; i < m.count; i ++ ) {

						v.set( a[ i * 16 + 12 ], a[ i * 16 + 13 ], a[ i * 16 + 14 ] ).applyMatrix4( m.matrixWorld );
						const key = Math.floor( v.x ) * 4096 + Math.floor( v.z );
						let cell = grid.get( key );
						if ( ! cell ) grid.set( key, cell = [] );
						cell.push( v.x, v.y, v.z );

					}

				}

				this._fanGrid = grid;

			}

		}

		const grid = this._fanGrid;
		if ( ! grid ) return;
		const R = radius + 0.25;
		const cx = Math.floor( p.x ), cz = Math.floor( p.z );
		for ( let i = - 1; i <= 1; i ++ ) for ( let j = - 1; j <= 1; j ++ ) {

			const cell = grid.get( ( cx + i ) * 4096 + cz + j );
			if ( ! cell ) continue;
			for ( let k = 0; k < cell.length; k += 3 ) {

				// his seat at about your feet's height (the row you're on, or the next up or down)
				// (---- FA3, WA1-7: and as far as a jump lifts you over him: a jump carried you over the fans into
				// any row)
				const dy = cell[ k + 1 ] - p.y;
				if ( dy < - 1.2 || dy > 0.7 ) continue;
				const dx = p.x - cell[ k ], dz = p.z - cell[ k + 2 ], d = Math.hypot( dx, dz );
				if ( d >= R || d < 1e-4 ) continue;
				p.x += dx / d * ( R - d );
				p.z += dz / d * ( R - d );

			}

		}

	}

	// C: walk around, or watch the game on TV: FOX's broadcast (it cuts between the cameras as FOX did),
	// or one camera held: center field (behind the pitcher), high behind home plate, following the ball
	cycleCamera( mode = null ) {

		const modes = [ 'walk', 'tv', 'center', 'high', 'follow' ];
		this.camMode = mode || modes[ ( modes.indexOf( this.camMode || 'walk' ) + 1 ) % modes.length ];
		this.post?.cut();
		if ( this.post ) this.post.params.dof.value = 0;
		this._lastEye = null;
		this._tvShot = null;
		const cables = this.places?.find( ( p ) => p.wells )?.walls?.cables;
		if ( cables ) cables.visible = true;
		if ( this.camMode === 'walk' ) {

			this.camera.fov = this._walkFov || 62;
			this.camera.updateProjectionMatrix();

		} else if ( ! this._walkFov ) this._walkFov = this.camera.fov;
		if ( this.ui ) this.ui.ui.toast( CAMERA_NAMES[ this.camMode ] );

	}

	// FOX's cameras (Bowl._tvCameras: [ x, y, z ] in the field frame, the lens's height): 0 and 1 center
	// field, 2 high home, 3 high third, 4 high first; and the low ones in the camera wells at the
	// dugouts' far ends (the rail's Wells.js), for the close-ups
	_foxCamera( name ) {

		const B = this.bowl.cameraSpots;
		// (in left-center: Bowl's platform for it is there)
		if ( name === 'center' ) return [ - 9, 9.5, - 128 ];
		if ( name === 'high' ) return B ? B[ 2 ] : [ 0, 26, 44 ];
		if ( name === 'high3' || name === 'high1' ) {

			// the club level's platform hangs 1.2 m out from its front, with a rail round it: the lens
			// pokes out over the rail (0.4 m past it) and a little higher, so the rail and its posts are
			// behind it, not across the bottom of the picture
			const c = this._clubCams ||= {};
			if ( ! c[ name ] ) {

				const s = B ? B[ name === 'high3' ? 3 : 4 ] : this._clubCameraSpot( name === 'high3' ? - 30 : 30, - 2 );
				const dx = 0 - s[ 0 ], dz = - 12 - s[ 2 ], l = Math.hypot( dx, dz );
				c[ name ] = [ s[ 0 ] + dx / l * 1.6, s[ 1 ] + 0.25, s[ 2 ] + dz / l * 1.6 ];

			}

			return c[ name ];

		}

		// ---- FB3 (C3B-5): a handheld on the grass, where _handheld put it, swaying a little on the shoulder
		if ( name === 'hand' ) {

			const e = this._hand?.e || [ 0, 1.45, - 13 ], t = this.director?.t || 0;
			return [ e[ 0 ] + 0.03 * Math.sin( t * 1.3 ), e[ 1 ] + 0.02 * Math.sin( t * 1.9 + 1 ), e[ 2 ] + 0.03 * Math.cos( t * 1.1 ) ];

		}
		// ---- end FB3

		// the low first / third base cameras in the wells, a little in front of their lenses
		const want = name === 'low1' ? 'low 1B' : 'low 3B';
		const w = this.places.find( ( p ) => p.wells )?.wells?.cams?.find( ( q ) => q.name === want );
		return w ? [ w.x - Math.sin( w.face ) * 0.8, w.y + 1.55, w.z - Math.cos( w.face ) * 0.8 ] : name === 'low1' ? [ 30, 0.85, - 9 ] : [ - 30, 0.85, - 9 ];

	}

	// ---- FB2 (C2B-1) / FB3 (C3B-5, C3B-6): is someone standing in front of the lens? Everyone near the
	// field is asked: the rail's figures (the police, the photographers, the on-deck man), the players, the
	// coaches and the umpires (the Director's actors, but the subject, `skip`), the celebration's press, party
	// and families and the Phanatic. Blocked if he's on the line to the subject anywhere short of the last
	// 1.2 m (a man as a post 0.33 m round and his height tall: the first base coach 10.8 m out from low
	// first, 0.27 m off the line to the runner, was in 12 of the 21 shots of him), or if he's in the picture
	// at all while nearer than 60% of the way (a body a metre or two in front of a long lens is a blurred
	// third of the frame: half, the picture's half-height at the subject, sets how wide it is there). With
	// `clear`, anyone within that many metres of the lens blocks it too (a handheld's operator can't stand
	// in someone); `near`: how far round the subject people are the picture, not in front of it (a man:
	// 1.2 m; the pile, the stage's crowd, the party: more). (FB2's guard tested only the rail's figures in
	// the first 10 m.)
	_lensBlocked( e, at, skip = null, half = 0, clear = 0, near = 1.2 ) {

		const dx = at[ 0 ] - e[ 0 ], dy = at[ 1 ] - e[ 1 ], dz = at[ 2 ] - e[ 2 ];
		const h = Math.hypot( dx, dz );
		if ( h < 1e-3 ) return false;
		const test = ( x, y0, z, r, tall ) => {

			const px = x - e[ 0 ], pz = z - e[ 2 ];
			if ( clear && Math.hypot( px, pz ) < clear ) return true;
			const along = ( px * dx + pz * dz ) / h;
			if ( along < 0.3 || along > h - near ) return false;
			const off = Math.abs( px * dz - pz * dx ) / h;
			// the line's height there
			const y = e[ 1 ] + dy * along / h;
			if ( off < r && y > y0 - 0.1 && y < y0 + tall ) return true;
			if ( half > 0 && along < 0.6 * h ) {

				// in the picture there (16:10, the frame's half-height there)
				const w = half * along / h;
				return off < r + w * 1.5 && y0 + tall > y - w && y0 < y + w;

			}

			return false;

		};
		const list = this.places.find( ( p ) => p.wells )?.figs?.list;
		if ( list ) for ( const f of list ) if ( f.shown && test( f.x, f.y || 0, f.z, 0.3 + 0.15 * f.scale, 1.85 * f.scale ) ) return true;
		const d = this.director;
		// (a man as tall as he is now: the catcher down in his crouch is 1.4 m, not 1.9)
		if ( d?.actors ) for ( const [ id, a ] of d.actors ) if ( id !== skip && test( a.x, a.y || 0, a.z, 0.4, Math.min( 1.9, ( a.pose?.pelvisY ?? 0.98 ) + 0.92 ) ) ) return true;
		const rit = this.places.find( ( p ) => p.press && p.party );
		if ( rit ) for ( const c of [ rit.press.cast, rit.party.cast, rit.families?.cast, rit.throng?.cast ] ) for ( const f of c?.list || [] ) if ( f.visible && test( f.x, f.y || 0, f.z, 0.33, 1.85 * ( f.scale || 1 ) ) ) return true;
		const ph = this.phanatic?.now;
		if ( ph?.visible && ph.onField && test( ph.x, ph.y || 0, ph.z, 0.5, 2.0 ) ) return true;
		return false;

	}

	// (a shot blocked once stays given up for the rest of its time on air, or the cut would flicker back and
	// forth as someone walks across the line)
	_blockedOnce( key, blocked ) {

		const B = this._blocked ||= new Map();
		if ( B.size > 400 ) B.clear();
		if ( B.get( key ) ) return true;
		if ( blocked ) B.set( key, true );
		return blocked;

	}
	// ---- end FB2 / FB3

	// a camera position hung 1.2 m out from the club level's front rail, nearest the field point (x, z)
	_clubCameraSpot( x, z ) {

		const b = this.bowl;
		const line = offsetPolyline( b.path, b.D.club - 1.2, [ 0, - 40 ] );
		let best = null, bd = Infinity;
		for ( let i = 0; i < line.length - 1; i ++ ) {

			const [ ax, az ] = line[ i ], [ bx, bz ] = line[ i + 1 ];
			const dx = bx - ax, dz = bz - az;
			const t = Math.max( 0, Math.min( 1, ( ( x - ax ) * dx + ( z - az ) * dz ) / ( dx * dx + dz * dz || 1 ) ) );
			const px = ax + dx * t, pz = az + dz * t, d = Math.hypot( px - x, pz - z );
			if ( d < bd ) {

				bd = d;
				best = [ px, pz ];

			}

		}

		const clubY = LEVELS.clubConcourse - ( 8 - 1 ) * 0.46 - 0.2;
		return [ best[ 0 ], clubY + 2.2, best[ 1 ] ];

	}

	// What FOX would have on air now, in the TV mode: the director's cut. The center field camera for
	// every pitch; the close-ups between pitches (the batter from the low camera on his open side, the
	// pitcher from his); the high home camera the moment a ground ball is put in play, the high third
	// camera following anything in the air; the batter after a hit or a walk, the pitcher after an out;
	// the high home for the breaks. Returns { cam, aim, fov } (aim: [ x, y, z ] or 'ball' / 'follow').
	_directorCut( seg, lt ) {

		const d = this.director, s = seg.snap || {};
		const P = GAME.players;
		const actor = ( id, y = 1.35 ) => {

			const a = id != null && d.actors.get( id );
			return a ? [ a.x, ( a.y || 0 ) + y, a.z ] : null;

		};
		// ---- FB3 (C3B-4): where his body is, not his root: a pitcher's root stays on the rubber while his
		// follow-through carries his hips a metre and more toward the plate and bends him over (the
		// close-up aimed at the rubber had him half out of the picture, three quarters of it grass). His
		// pelvis, turned by his yaw and scaled by his height; y above the ground as for a man standing,
		// lowered as far as his hips are
		const body = ( id, y ) => {

			const a = id != null && d.actors.get( id );
			if ( ! a ) return null;
			const p = a.pose, h = d._height ? d._height( id ) : 1;
			const lx = ( p?.pelvisX || 0 ) * h, lz = ( p?.pelvisZ || 0 ) * h, c = Math.cos( a.yaw ), sn = Math.sin( a.yaw );
			const drop = p?.pelvisY != null ? Math.max( 0, 0.98 - p.pelvisY ) * h : 0;
			return [ a.x + lx * c + lz * sn, ( a.y || 0 ) + y - drop, a.z - lx * sn + lz * c ];

		};
		// ---- end FB3
		// a close-up: head to knees, from the low camera on his open side (half: half the picture's height,
		// in metres at him); none if someone on the rail stands in front of the lens
		const close = ( id, cam, y = 1.35, half = 1.25 ) => {

			const at = body( id, y );
			if ( ! at ) return null;
			const e = this._foxCamera( cam );
			// (FB3, C3B-6: everyone on the field asked, the whole line, and once given up, given up)
			if ( this._blockedOnce( seg.t0 + cam + id, this._lensBlocked( e, at, id, half ) ) ) return null;
			const dd = Math.hypot( at[ 0 ] - e[ 0 ], at[ 1 ] - e[ 1 ], at[ 2 ] - e[ 2 ] );
			return { cam, aim: at, fov: MathUtils.radToDeg( 2 * Math.atan( half / dd ) ), close: true };

		};
		const batterClose = () => close( s.batter, s.bats === 'L' ? 'low3' : 'low1' ) || close( s.batter, s.bats === 'L' ? 'low1' : 'low3' );
		// ---- FB2 (C2B-1): the pitcher from above, as FOX took him: off the high camera on his open side
		// (the third base side for a righty in the set), head to the thighs, the grass behind him
		// (t11530s, Balfour). Not from the wells: a man down there is on the line to the mound.
		const pitcherClose = () => {

			const id = s.pitcher ?? s.defense?.P;
			const lefty = P[ id ]?.throws === 'L';
			// (FB3, C3B-4: half 0.85, a little room round him: head to the thighs, as t11530s)
			return close( id, lefty ? 'high1' : 'high3', 1.15, 0.85 ) || close( id, lefty ? 'high3' : 'high1', 1.15, 0.85 );

		};
		// ---- end FB2
		const center = { cam: 'center' };
		const high = { cam: 'high' };
		const follow = { cam: 'high3', aim: 'follow' };
		// ---- FB2 (C2B-10): a replay of the big play just made, if one's on
		const rp = this._replayNow();
		if ( rp ) return this._replayCut( rp );
		// ---- end FB2
		// ---- FB3 (C3B-1): the last pitch, strike three and Lidge on his knees: one shot from center field
		const L = d.lastOut;
		if ( L && ( ( seg === L.pitch && lt >= 1.7 ) || seg === L.result ) ) return this._lastOutCut( d.t - L.tStrike );
		// ---- end FB3
		switch ( seg.kind ) {

			// (FB3, C3B-13: the walk-up is his face, from the low camera he's walking toward: a Phillie comes
			// from the first base side's on-deck circle toward low third, a Ray the other way; it was the camera
			// on his stance's open side, his back for 40% of them)
			case 'walkup': {

				if ( lt < 1 ) return high;
				const home = s.batting === 'home';
				// ---- FB4 (C4B-2): the low camera waited for. Someone crossing its line as he sets off (the bat
				// boy back from the last hitter's bat, a coach) gave it up for the whole walk-up, which then went
				// out from 50 m up (C4B: 14 of 16 on the high cameras). Until the line's first clear moment the
				// wide holds, up to 3.4 s in (the walk from the circle is six); from then it's his
				const low = home ? 'low3' : 'low1';
				const W = this._wuWait?.t0 === seg.t0 ? this._wuWait : ( this._wuWait = { t0: seg.t0, clear: false } );
				if ( ! W.clear ) {

					const at = body( s.batter, 1.35 );
					if ( at && ! this._lensBlocked( this._foxCamera( low ), at, s.batter, 1.25 ) ) W.clear = true;
					else if ( lt < 3.4 ) return high;

				}
				// ---- end FB4
				return close( s.batter, low ) || close( s.batter, home ? 'high3' : 'high1', 1.2, 1.4 ) || batterClose() || high;

			}
			case 'pitch': {

				const e = seg.ev, tb = lt - 3.0 - Motions.REL;
				// before the set, a close-up (the batter, or every so often the pitcher); after a pitch that
				// doesn't end it, the batter stepping out
				if ( lt < 1.7 ) return ( hashT( seg.t0 ) < 0.6 ? batterClose() : pitcherClose() ) || center;
				const ends = e.count[ 0 ] >= 4 || e.count[ 1 ] >= 3;
				if ( ! e.inPlay && tb > seg.path.toCatcher + 1.4 ) return ( ends ? pitcherClose() : batterClose() ) || center;
				return center;

			}

			case 'inplay': {

				const plan = seg.plan;
				if ( lt < 0.35 ) return center;
				// ---- FB2 (C2B-9): a play at the plate, live, tight from high home on the plate, as FOX had
				// Utley's throw and Ruiz's dive (t13220s): from a second and a half before the runner gets
				// there to the call
				const atPlate = plan.runners.find( ( r ) => r.to === 4 && r.from > 0 && r.slide );
				if ( atPlate && lt > atPlate.tArrive - 1.6 && lt < ( atPlate.tCall ?? atPlate.tArrive ) + 1.6 ) return { cam: 'high', aim: [ - 0.9, 0.6, - 1.1 ], fov: 6.5, tag: 'plate' };
				// an extra-base hit: once it's down, the wide shot, the batter rounding first and the relay
				const batter = plan.runners.find( ( r ) => r.id === s.batter );
				if ( ! plan.hr && ! plan.bb.ground && batter && batter.to >= 2 && lt > plan.bb.time + 0.8 ) return high;
				// ---- end FB2
				if ( plan.hr ) return lt < plan.bb.time + 1.5 ? follow : high;
				return plan.bb.ground ? high : follow;

			}

			case 'result': {

				// (FB3, C3B-6: the runner on base from high first when someone's in front of low first: FOX's
				// usual angle on him)
				const onBase = ( s.bases || [] ).includes( s.batter );
				return ( onBase ? close( s.batter, 'low1' ) || close( s.batter, 'high1', 1.2, 1.3 ) : pitcherClose() ) || high;

			}

			// a pitching change: the old pitcher walking off, the new one coming in from the pen, then a close
			// look at him on the mound
			case 'change': return lt < 8 && actor( s.oldPitcher ) ? { cam: 'high3', aim: actor( s.oldPitcher ) } : lt < seg.dur - 4 ? { cam: 'high3', aim: actor( s.pitcher ) || [ 0, 1, - 18 ] } : pitcherClose() || high;
			case 'celebrate': return this._celebrateCut( lt, actor ) || high;
			// ---- FB2 (C2B-17): between innings the wide shot, and when the Phanatic is out on the field or
			// dancing on a dugout's roof, every other eight seconds on him (FOX aired him when he was on the
			// field: the pregame, the banner at the end)
			// (---- FB3, C3B-8: the suspension's break has a plan of its own: it was one static wide for 150 s)
			default: return ( seg === d.suspension && this._suspensionCut( lt ) ) || this._phanaticCut( lt ) || high;
			// ---- end FB2

		}

	}

	// ---- FB3 (C3B-1): the last out as FOX had it (FOX US 1yP3u4ik2gs, sheet 125): the center field camera
	// holds the pitch, and as Hinske misses it pushes in on Lidge, down on his knees with his arms up, his
	// back to us ("54"), Ruiz coming in at the side; then out a little as Howard and the rest pile on;
	// the pile from high first after (the celebration's cut). One shot from the pitch to the pile: s is
	// the seconds since strike three (in the mitt). (It was a cut 1.4 s after the strike to a 1.5 degree
	// close-up of the rubber, mostly grass, then Lidge standing still; his kneel came 4 s late.)
	_lastOutCut( s ) {

		const d = this.director, L = d.lastOut;
		const e = this._foxCamera( 'center' );
		const span = ( p, half ) => MathUtils.radToDeg( 2 * Math.atan( half / Math.hypot( p[ 0 ] - e[ 0 ], p[ 1 ] - e[ 1 ], p[ 2 ] - e[ 2 ] ) ) );
		const ease = ( x ) => {

			const k = Math.min( 1, Math.max( 0, x ) );
			return k * k * ( 3 - 2 * k );

		};
		const lerp3 = ( a, b, k ) => [ a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * k, a[ 1 ] + ( b[ 1 ] - a[ 1 ] ) * k, a[ 2 ] + ( b[ 2 ] - a[ 2 ] ) * k ];
		// Lidge kneeling: his middle (a metre up), a picture 2.6 m tall (his knees at the bottom, the glove
		// up near the top, Ruiz's head out of it), a little to his left so Ruiz has the right of it
		const a = d.actors.get( L.cel.snap.defense.P );
		const him = a ? [ a.x - 0.25, ( a.y || 0 ) + 1.0, a.z ] : [ PILE[ 0 ] - 0.25, 1.2, PILE[ 1 ] ];
		const pile = [ PILE[ 0 ], 1.1, PILE[ 1 ] ];
		const k1 = ease( ( s - 0.45 ) / 1.3 ), k2 = ease( ( s - 4.6 ) / 1.8 );
		const aim = lerp3( lerp3( [ 0.4, 0.75, 0 ], him, k1 ), pile, k2 );
		const fov = 2.7 + ( span( him, 1.3 ) - 2.7 ) * k1 + ( span( pile, 3.4 ) - span( him, 1.3 ) ) * k2;
		return { cam: 'center', aim, fov, tag: 'lastout' };

	}
	// ---- end FB3

	// ---- FB2 (C2B-10): FOX's replays (game/Replays.js): which one is on air now (TV mode only), and its
	// picture: the play from the high first base camera, framed as the follow camera frames it (the other
	// side from the live high third), then tight on the bag from the low camera across from it for the
	// slide and the tag
	_replayNow() {

		const d = this.director;
		if ( this.camMode !== 'tv' || ! d ) return null;
		this._replays ||= replayPlan( d );
		return replayAt( this._replays, d.t );

	}

	_replayCut( { r, tau } ) {

		const tag = 'replay' + r.w0.toFixed( 1 );
		const out = r.plate || r.tagOut;
		if ( out && tau > ( out.tCall ?? out.tArrive ) - 1.2 ) {

			const b = BASES[ out.to % 4 ];
			const cam = out.to % 4 === 0 || b[ 0 ] < 0 ? 'low1' : 'low3';
			const aim = out.to % 4 === 0 ? [ - 0.8, 0.7, - 0.9 ] : [ b[ 0 ], 0.7, b[ 1 ] ];
			const e = this._foxCamera( cam );
			const dd = Math.hypot( aim[ 0 ] - e[ 0 ], aim[ 1 ] - e[ 1 ], aim[ 2 ] - e[ 2 ] );
			return { cam, aim, fov: MathUtils.radToDeg( 2 * Math.atan( 1.7 / dd ) ), tag: tag + 'b' };

		}

		return { cam: 'high1', aim: 'follow', replay: { seg: r.seg, lt: tau }, tag };

	}

	// ---- FB3 (C3B-8): the suspension as FOX covered it, a new shot every eight or nine seconds where it was
	// one high home wide for two and a half minutes. The 27th (the world feed 2:52-3:03, FOX US 1:58-2:03):
	// the wide as the crew run out; the crew at the roll swinging it off the wall, tight from high third; the
	// line of them walking the sheet's edge across the infield, from high home and high first; the fans in
	// their ponchos; PhanaVision; the covered field wide for the GAME SUSPENDED card. The 29th (FOX US
	// 2:03-2:08, the world feed 3:03-3:14): the bowl filling from high first and third; the tarp coming
	// off; the Phillies' dugout in their red jackets from low third; the pens; the Phanatic when he's out
	// (_phanaticCut); the wide to the walk-up.
	_suspensionCut( lt ) {

		const d = this.director, N = d.night( d.t );
		const fit = ( cam, aim, half, tag ) => {

			const e = this._foxCamera( cam );
			if ( this._blockedOnce( 'susp' + tag + cam, this._lensBlocked( e, aim, null, half, 0, Math.max( 4, half * 1.6 ) ) ) ) return null;
			const dd = Math.hypot( aim[ 0 ] - e[ 0 ], aim[ 1 ] - e[ 1 ], aim[ 2 ] - e[ 2 ] );
			return { cam, aim, fov: MathUtils.radToDeg( 2 * Math.atan( half / dd ) ), tag: 'susp' + tag };

		};
		const high = { cam: 'high' };
		const st = tarpState( N );
		const roll = st.stowed ? null : rollAxis( st, 4 )[ 2 ];
		if ( N.delay ) {

			const u = lt;
			if ( u < 7 ) return high;
			// ---- FR2: the roll off the wall and along the clay's edge, tight on it from high third; then
			// along behind second from high home (Getty 83477151's view); the crew strung out along the strip
			// and pulling the edge in from high first (83458151's): on the plan's times (TarpPlan.T27)
			const foc = tarpFocus( st );
			// ---- FB4 (C4B-12): off the wall from across the field (the world feed's 2:52:30: high home or
			// first): the high third camera sits over the roll's own stands, and its first 1.5-2 s were the
			// fans in the field boxes with the roll a sliver along the wall under them
			if ( u < 9.5 ) return roll ? ( fit( 'high', [ roll[ 0 ], 1.0, roll[ 2 ] ], 5, 'roll0' ) || fit( 'high1', [ roll[ 0 ], 1.0, roll[ 2 ] ], 5, 'roll0' ) || high ) : high;
			// ---- end FB4
			if ( u < T27.lay[ 0 ] + 6 ) return roll ? fit( 'high3', [ roll[ 0 ], 1.0, roll[ 2 ] ], 4.5, 'roll' ) : high;
			if ( u < T27.spread[ 0 ] ) return roll ? fit( 'high', [ roll[ 0 ], 0.8, roll[ 2 ] ], 7, 'lay' ) : high;
			if ( u < T27.pull[ 0 ] + 7 ) return foc ? fit( 'high', foc, 13, 'pull' ) : high;
			if ( u < T27.pull[ 1 ] ) return foc ? fit( 'high1', foc, 11, 'pull2' ) : high;
			// ---- end FR2
			// the fans in the rain, PhanaVision, the fans again, then the covered field to the end
			if ( u < 53 ) return fit( 'high1', [ - 38, 9, 4 ], 9, 'fans1' );
			if ( u < 61 ) return fit( 'high', [ - 79, 31, - 109 ], 10, 'board' );
			if ( u < 69 ) return fit( 'high3', [ 36, 8, 8 ], 9, 'fans2' );
			return high;

		}

		// the 29th's part, from the split
		const u = d.t - N.split;
		if ( TARP_ON_29 ) {

			// ---- FR2: the edge walked back and the roll wound back up to the line (TarpPlan.T29)
			if ( u < 5 ) return fit( 'high1', [ - 40, 12, - 10 ], 22, 'bowl1' );
			const foc29 = tarpFocus( st );
			if ( u < T29.wind[ 0 ] ) return foc29 ? fit( 'high', foc29, 13, 'unpull' ) : high;
			if ( u < T29.stow[ 1 ] ) return roll ? fit( 'high3', [ roll[ 0 ], 1.0, roll[ 2 ] ], 6, 'off' ) : high;
			// ---- end FR2

		} else {

			// ---- FB4 (C4B-6): no tarp on the 29th (it was off before the gates opened): the bowl filling, the
			// crew on the skin with the hoses (Getty 83824977, 83824985) from across the field, the infield
			// being groomed from high home
			if ( u < 6 ) return fit( 'high1', [ - 40, 12, - 10 ], 22, 'bowl1' );
			if ( u < 14 ) return fit( 'high3', [ 11, 0.9, - 31 ], 5, 'hose' ) || fit( 'high', [ 11, 0.9, - 31 ], 6, 'hose' ) || high;
			if ( u < 21 ) return fit( 'high', [ 0, 0.8, - 22 ], 15, 'skin' ) || high;
			// ---- end FB4

		}

		// ---- FB4 (C4B-7): God Bless America: the park standing, then the singer behind the plate from center
		// field, the flag behind the camera; the dugout after it (it was the Phillies' dugout through the song:
		// two men leaning on the rail in their caps). FOX didn't air the song (it was before they came on);
		// this is what their cameras had
		const [ g0, g1 ] = G29.gba;
		if ( u < g0 ) return high;
		if ( u < g1 ) return u < g0 + 4.5 ? high : ( fit( 'center', [ 0.6, 1.45, 9.6 ], 1.6, 'singer' ) || high );
		if ( u < g1 + 7 ) return fit( 'low3', [ DUGOUT.home[ 0 ], 1.1, DUGOUT.home[ 1 ] ], 2.6, 'dugout' ) || fit( 'high3', [ DUGOUT.home[ 0 ], 0.9, DUGOUT.home[ 1 ] ], 3.4, 'dugout' ) || high;
		if ( u < g1 + 13 ) return fit( 'high', [ BULLPEN.home[ 0 ], 2.2, BULLPEN.home[ 1 ] - 1.5 ], 8, 'pens' );
		if ( u < 54 ) return fit( 'high3', [ 40, 12, - 6 ], 22, 'bowl2' );
		// ---- end FB4
		return null;

	}
	// ---- end FB3

	// ---- FB2 (C2B-17): the Phanatic, if he's on the field or a roof, every other eight seconds of a break:
	// from the high camera across the field from him, a picture about 4 m tall
	_phanaticCut( lt ) {

		const n = this.phanatic?.now;
		if ( ! n?.visible || ! n.onField || Math.floor( lt / 8 ) % 2 !== 1 ) return null;
		const cam = n.x > 0 ? 'high3' : 'high1';
		const e = this._foxCamera( cam );
		const aim = [ n.x, ( n.y || 0 ) + 1.1, n.z ];
		const dd = Math.hypot( aim[ 0 ] - e[ 0 ], aim[ 1 ] - e[ 1 ], aim[ 2 ] - e[ 2 ] );
		return { cam, aim, fov: MathUtils.radToDeg( 2 * Math.atan( ( n.zone === 'field' ? 3 : 2.1 ) / dd ) ), tag: 'phanatic' };

	}

	// ---- FB2 (C2B-8): the celebration as FOX cut it, a new shot every seven to ten seconds, from the
	// Celebration's own schedule (CEL): the pile from all round (center, high first and third, low and
	// tight from the wells); the hugs; the stage going up and the crowd; the presentation (the stage, Moyer
	// digging out the rubber, Manuel, Hamels the MVP, Howard and the trophy, tight); the lap behind
	// Myers's flag, followed from the camera across the field; the crowd and the wide shot to the end
	// (FOX US 1yP3u4ik2gs storyboards: nearly every frame a different shot)
	_celebrateCut( lt, actor ) {

		const C = CEL;
		const pile = [ 0, 1.1, - 17.8 ];
		// (the shot's name: one per slot of the schedule, so a handheld or a blocked camera holds for the
		// whole of its slot, not cut at every seventh second)
		let tag = 'cel' + Math.floor( lt / 7 );
		const fit = ( cam, aim, half ) => {

			if ( ! aim ) return null;
			let e = this._foxCamera( cam );
			// ---- FB3 (C3B-2): never the center field camera on something under its own platform (the lap
			// along the center field track: the lens looked down through the deck): high home instead
			if ( cam === 'center' && ( Math.hypot( aim[ 0 ] - e[ 0 ], aim[ 2 ] - e[ 2 ] ) < 45 || e[ 1 ] - aim[ 1 ] > 0.2 * Math.hypot( aim[ 0 ] - e[ 0 ], aim[ 2 ] - e[ 2 ] ) ) ) {

				cam = 'high';
				e = this._foxCamera( cam );

			}

			// ---- FB3 (C3B-5): nobody in front of the lens (the press leave the wells right past the low
			// cameras): a shot that's blocked is given up for its slot
			if ( this._blockedOnce( tag + cam, this._lensBlocked( e, aim, null, half, 0, Math.max( 4, half * 1.6 ) ) ) ) return null;
			// ---- end FB3
			const dd = Math.hypot( aim[ 0 ] - e[ 0 ], aim[ 1 ] - e[ 1 ], aim[ 2 ] - e[ 2 ] );
			return { cam, aim, fov: MathUtils.radToDeg( 2 * Math.atan( half / dd ) ), tag };

		};
		const hand = ( aim, half, r ) => this._handheld( tag, aim, half, r );
		const crowd = ( k ) => [ fit( 'low1', [ - 30, 5, 14 ], 7 ) || fit( 'high1', [ - 38, 9, 4 ], 9 ), fit( 'high3', [ 36, 7, 8 ], 8 ), fit( 'center', [ 0, 6, 26 ], 9 ), fit( 'high1', [ - 38, 9, 4 ], 9 ) ][ k % 4 ];
		const high = { cam: 'high' };
		// ---- FB3 (C3B-1): the last out's shot carries on from the strike (center field, Lidge, the pile)
		if ( lt < 5 ) return this._lastOutCut( this.director.t - this.director.lastOut.tStrike );
		// ---- FB3 (C3B-5): the pile from high first (t16330s), then FOX's handhelds in on the grass, low,
		// the lights over them (FOX US sheet 125, frames 3-6 and 9), high third, center field, a handheld
		// again as it comes apart; the low cameras in the wells only if nobody's in front of them
		if ( lt < 40 ) {

			const k = Math.floor( ( lt - 5 ) / 7 );
			tag = 'pile' + k;
			const lo = [ 0, 1.9, - 17.8 ];
			if ( k === 0 ) return fit( 'high1', pile, 4.5 );
			if ( k === 1 ) return hand( lo, 2.1, 4.8 ) || fit( 'low1', pile, 2.6 ) || fit( 'high3', pile, 4 );
			if ( k === 2 ) return fit( 'high3', pile, 4 );
			if ( k === 3 ) return fit( 'center', pile, 3.2 );
			return hand( lo, 2.3, 5.2 ) || fit( 'low3', pile, 3.2 ) || fit( 'high1', pile, 4.5 );

		}

		if ( lt < C.stageBuild[ 0 ] ) {

			const k = Math.floor( ( lt - 40 ) / 7 );
			tag = 'hug' + k;
			return [ high, fit( 'high1', [ 2, 1, - 22 ], 9 ), crowd( 0 ) ][ k % 3 ] || high;

		}
		if ( lt < C.present[ 0 ] ) {

			// ---- FB3 (C3B-9, C3B-3): while the stage goes up, not the lone box on the clay: the knots of
			// players hugging (a handheld in among them by the dugout), the wide, the crowd, the infield; then
			// the stage done and the car driven in, from high home; the party walking out to it
			if ( lt >= C.party + 26 ) {

				tag = 'party';
				const party = this._partyAt();
				if ( party ) return fit( 'high3', party, 3.4 ) || high;

			}

			const k = Math.floor( ( lt - C.stageBuild[ 0 ] ) / 9 );
			tag = 'build' + k;
			if ( k % 4 === 0 ) return k < 4 ? hand( [ 12, 1.7, - 6.5 ], 2.0, 5.0 ) || fit( 'high1', [ 12, 1.2, - 6.5 ], 4 ) || high : fit( 'high', [ STAGE.car[ 0 ] - 2, 1.2, STAGE.car[ 1 ] + 1 ], 8 ) || high;
			return [ null, high, crowd( k ), fit( 'center', [ 8, 1.2, - 24 ], 5 ) ][ k % 4 ] || high;
			// ---- end FB3

		}

		if ( lt < C.present[ 1 ] ) {

			const stage = STAGE.point( 0, 0 );
			const on = [ stage[ 0 ], 2.2, stage[ 1 ] ];
			// ---- FR1: the men on the stage face out of its front to the plate and the stands now (they
			// faced right-center): their faces from the high home camera, 16 degrees off their line (FOX's
			// interview frames and Getty 83570999 from in front); the stage from high third between
			// (FB3, C3B-10: mid-shots, waist up with the people beside, as FOX's were, not a 1.4 m macro on
			// one figure's face)
			const face = 'high';
			const man = ( id, half ) => fit( face, actor( id, 1.25 ), half );
			// ---- FB4 (C4B-10): the interviews and the trophy at eye level, as FOX shot them: from a riser at the
			// stage's foot over the heads of the crowd in front (Manuel, Howard), and the MVP from a handheld on
			// the clay in front of the four of them (FOX US sheets 128-131; Getty 83486314). From high home, 75 m
			// back and 26 m up, they were the tops of caps and the coats' shoulders. High home if blocked
			const riser = ( aim, half ) => aim && this._handheld( tag, aim, half, 6.2, { y: 2.75, a0: STAGE.yaw, spread: [ 0, 0.3, - 0.3, 0.6, - 0.6 ] } );
			// ---- end FB4
			// Howard up the steps with the others, then the trophy over his head, tight
			if ( lt >= C.up + 5 ) {

				tag = 'trophy'; // (---- FB4: one riser spot for the trophy's whole time)
				const tr = trophyHold( this.director, lt );
				return riser( tr ? [ tr.x, tr.y - 0.75, tr.z ] : actor( 429667, 1.25 ), 1.55 ) || ( tr && fit( face, [ tr.x, tr.y - 0.7, tr.z ], 1.9 ) ) || man( 429667, 1.9 ) || fit( face, on, 3.2 );

			}

			if ( lt >= C.up - 1 ) return fit( face, on, 3.2 );
			if ( lt >= C.mvp[ 0 ] && lt < C.mvp[ 1 ] ) {

				tag = 'mvp'; // (---- FB4)
				return this._handheld( tag, actor( 430935, 1.3 ), 1.15, 4.2, { y: 1.6, a0: MVP.yaw + Math.PI, spread: [ 0, 0.35, - 0.35, 0.7, - 0.7 ] } ) || man( 430935, 2.1 ) || fit( face, on, 3.2 );

			}

			if ( lt >= C.manuel[ 0 ] && lt < C.manuel[ 1 ] ) {

				tag = 'manuel'; // (---- FB4)
				return riser( actor( 'r:manuel', 1.25 ), 1.15 ) || man( 'r:manuel', 1.9 ) || fit( face, on, 3.2 );

			}
			if ( lt >= C.moyer[ 0 ] + 6 && lt < C.moyer[ 1 ] ) return fit( 'high1', actor( 'r:moyer', 0.7 ), 1.6 ) || fit( 'high1', on, 3.2 );
			return Math.floor( lt / 8 ) % 2 ? fit( 'high3', on, 3.6 ) : fit( face, on, 4.2 );
			// ---- end FR1

		}

		if ( lt < C.lap[ 1 ] ) {

			// the lap: the flag and the men behind it, from the camera across the field from them
			// (FB3, C3B-2: across center, high home: the center field camera can't see the track under it;
			// between, the crowd or Moyer's family at the mound)
			const flag = actor( 408206, 1.2 );
			const k = Math.floor( ( lt - C.lap[ 0 ] ) / 9 );
			tag = 'lap' + k;
			if ( ! flag || k % 3 === 2 ) return ( k % 2 ? crowd( k ) : fit( 'high1', actor( 'r:moyer', 0.9 ), 2.6 ) ) || high;
			const cam = Math.abs( flag[ 0 ] ) < 26 && flag[ 2 ] < - 90 ? 'high' : flag[ 0 ] > 0 ? 'high3' : 'high1';
			return fit( cam, flag, 4.5 ) || high;

		}

		tag = 'end' + Math.floor( lt / 9 );
		return Math.floor( lt / 9 ) % 2 ? crowd( Math.floor( lt / 18 ) ) || high : high;

	}

	// ---- FB3 (C3B-5): one of FOX's handhelds on the grass (FOX US 1yP3u4ik2gs sheet 125: the pile and the
	// hugs low and wide from among them, the lights over them): r metres out from what it's on, on a man's
	// shoulder, from the first side round it that's clear (the plate side first, the outfield's stands and
	// lights behind; then the sides): nobody within a metre of the lens or between it and the first three
	// metres of the shot (the rest of the scrum is the picture). Picked when the shot comes up, again if
	// someone walks into it (twice at most), else null. The operator isn't drawn.
	// (---- FB4, C4B-10: o.y, the lens's height (a riser at the stage's foot: over the heads in front); o.a0,
	// the side to try first, as an angle round the aim (0: toward the plate, +z); o.spread, the tries round
	// it)
	_handheld( tag, aim, half, r, o = {} ) {

		let H = this._hand;
		const near = ( e ) => {

			const dx = aim[ 0 ] - e[ 0 ], dz = aim[ 2 ] - e[ 2 ], l = Math.hypot( dx, dz ) || 1;
			return [ e[ 0 ] + dx / l * 3.2, aim[ 1 ], e[ 2 ] + dz / l * 3.2 ];

		};
		const clear = ( e ) => ! this._lensBlocked( e, near( e ), null, 0, 1.0 );
		if ( H?.tag !== tag || ( H.e && ! clear( H.e ) ) ) {

			const tries = H?.tag === tag ? H.tries + 1 : 0;
			let e = null;
			if ( tries < 3 ) for ( const a of o.spread || [ 0, 0.8, - 0.8, 1.6, - 1.6, 2.4, - 2.4, Math.PI ] ) {

				const c = [ aim[ 0 ] + Math.sin( a + ( o.a0 || 0 ) ) * r, o.y ?? 1.45, aim[ 2 ] + Math.cos( a + ( o.a0 || 0 ) ) * r ];
				if ( clear( c ) ) {

					e = c;
					break;

				}

			}

			H = this._hand = { tag, e, tries };

		}

		if ( ! H.e ) return null;
		const dd = Math.hypot( aim[ 0 ] - H.e[ 0 ], aim[ 1 ] - H.e[ 1 ], aim[ 2 ] - H.e[ 2 ] );
		return { cam: 'hand', aim, fov: MathUtils.radToDeg( 2 * Math.atan( half / dd ) ), tag: tag + ':' + H.tries };

	}

	// where the presentation's party is while it walks out (the middle of the ones out), or null
	_partyAt() {

		const ps = this.places.find( ( p ) => p.press && p.party )?.party?.people;
		let x = 0, z = 0, n = 0;
		for ( const q of ps || [] ) if ( q.p?.visible && q.key !== 'chevy' ) { x += q.p.x; z += q.p.z; n ++; }
		return n ? [ x / n, 1.3, z / n ] : null;

	}
	// ---- end FB3

	// ---- FB2 (C2B-3): the follow camera frames the play, not the ball. While a fly is up, the operator
	// holds the fielder and the spot it's coming down (the grass and the wall in the picture; the ball
	// drops into the frame), never the ball against the night; once it's fielded, the ball's way in
	// (the throw low over the grass) with the lead runner, wide enough for both. Returns { aim, fov }
	// in the field frame, from the lens at e.
	_playFrame( seg, lt, e ) {

		const d = this.director, plan = seg.plan, bb = plan.bb;
		const pts = [];
		const pos = ( id ) => {

			const a = id != null && d.actors.get( id );
			return a ? [ a.x, 1.0, a.z ] : null;

		};
		// the fielder making the play, and when he has it
		let fielder = null, tField = bb.time;
		for ( const [ id, steps ] of Object.entries( plan.fielders ) ) {

			const st = steps.find( ( q ) => q.act === 'catch' || q.act === 'grounder' || q.act === 'pickup' || q.act === 'watch' );
			if ( st ) {

				fielder = Number( id );
				tField = st.act === 'watch' ? bb.time + 1.5 : st.t0 + 0.1;
				break;

			}

		}

		const land = bb.at( bb.time );
		const ball = d.ballFocus ?? d.ballAt;
		if ( lt < tField ) {

			// up: where it's coming down and the man going for it; the ball itself once it's low
			pts.push( [ land[ 0 ], 0.8, land[ 2 ] ] );
			const f = pos( fielder );
			if ( f ) pts.push( f );
			if ( ball && ball[ 1 ] < 6 ) pts.push( [ ball[ 0 ], Math.max( 0.5, ball[ 1 ] ), ball[ 2 ] ] );

		} else {

			// fielded: the ball's way in, and the lead runner still going
			if ( ball ) pts.push( [ ball[ 0 ], Math.min( 3, Math.max( 0.8, ball[ 1 ] ) ), ball[ 2 ] ] );
			let lead = null;
			for ( const r of plan.runners ) if ( ! r.out && lt < r.tArrive + 0.6 && ( ! lead || r.to > lead.to ) ) lead = r;
			const rp = lead && pos( lead.id );
			if ( rp && ( ! ball || Math.hypot( rp[ 0 ] - ball[ 0 ], rp[ 2 ] - ball[ 2 ] ) < 70 ) ) pts.push( rp );

		}

		if ( ! pts.length ) return null;
		const c = [ 0, 0, 0 ];
		for ( const p of pts ) for ( let i = 0; i < 3; i ++ ) c[ i ] += p[ i ] / pts.length;
		// wide enough for all of them, with room round them (and no tighter than a man and his ground)
		const dir = ( p ) => {

			const v = [ p[ 0 ] - e[ 0 ], p[ 1 ] - e[ 1 ], p[ 2 ] - e[ 2 ] ], l = Math.hypot( ...v ) || 1;
			return v.map( ( x ) => x / l );

		};
		const dc = dir( c );
		let ang = 0;
		for ( const p of pts ) {

			const dp = dir( p );
			ang = Math.max( ang, Math.acos( Math.min( 1, dp[ 0 ] * dc[ 0 ] + dp[ 1 ] * dc[ 1 ] + dp[ 2 ] * dc[ 2 ] ) ) );

		}

		const dist = Math.hypot( c[ 0 ] - e[ 0 ], c[ 1 ] - e[ 1 ], c[ 2 ] - e[ 2 ] );
		const fov = Math.max( MathUtils.radToDeg( 2 * Math.atan( 6 / dist ) ), Math.min( 34, MathUtils.radToDeg( ang ) * 2.2 + 3 ) );
		return { aim: c, fov: Math.min( 34, fov ) };

	}
	// ---- end FB2

	_broadcastCamera( dt ) {

		const F = this.field, d = this.director;
		const ball = d.ballFocus ?? d.ballAt;
		const at = ( x, y, z ) => {

			const w = F.toWorld( x, z );
			return new Vector3( w.x, F.y0 + y, w.z );

		};

		let eye, target, fov, close = false;
		const seg = d.segmentAt( d.t ), lt = d.t - seg.t0;
		let shot = this.camMode === 'tv' ? this._directorCut( seg, lt ) : { cam: { center: 'center', high: 'high', follow: 'high3' }[ this.camMode ], aim: this.camMode === 'follow' ? 'follow' : null };
		if ( shot.cam === 'center' ) {

			// FOX's center field camera, in left-center for every pitcher, so the pitcher stands about a
			// body's width left of the batter and catcher, righty or lefty (t13150s Romero, t16310s Lidge);
			// a very long lens: the pitcher full length in the lower left, his feet near the bottom; the
			// batter, catcher and umpire in the upper middle, then the backstop and a strip of the crowd.
			// Sharp from the mound back: a broadcast lens focused at 125 m is (no depth of field).
			eye = at( ...this._foxCamera( 'center' ) );
			target = at( 0.4, 0.75, 0 );
			fov = 2.7;
			if ( this.camMode === 'center' && ( seg.kind === 'inplay' || seg.kind === 'celebrate' || seg.kind === 'switch' || seg.kind === 'intro' ) ) {

				// held on the one camera: it follows the ball in play (not into the night sky: it stays on
				// the field below the upper deck's front)
				target = ball && ! seg.plan?.hr ? at( ball[ 0 ] * 0.6, Math.min( 12, Math.max( 1, ball[ 1 ] * 0.6 ) ), ball[ 2 ] * 0.6 ) : at( 0, 1, - 20 );
				fov = seg.kind === 'celebrate' ? 9 : 22;

			}

		} else if ( shot.cam === 'high' ) {

			// the high home camera on the press box's roof: FOX's framing, home plate near the bottom edge
			// and the diamond and the outfield filling the picture, little of the side stands (t13290s)
			// (FB2, C2B-22: a little wider and higher, the plate at 89% down and the wall at 28%, the stands
			// and the scoreboard's foot over it: it was fov 32 at ( 0, 0, -36 ), the wall at 22%)
			eye = at( ...this._foxCamera( 'high' ) );
			target = at( 0, 0.5, - 44 );
			fov = 37;

		} else {

			// a camera on a platform out from the Hall of Fame Club (the 200 level): high third behind the
			// third base dugout, following the ball, or high first; tight on the play, as FOX's were
			const e = this._foxCamera( shot.cam );
			eye = at( ...e );
			const play = shot.aim === 'follow' && ( shot.replay || seg.kind === 'inplay' ) ? this._playFrame( shot.replay?.seg ?? seg, shot.replay?.lt ?? lt, e ) : null;
			if ( shot.aim && shot.aim !== 'follow' ) target = at( ...shot.aim );
			else if ( play ) target = at( ...play.aim );
			else {

				const aim = ball ? [ ball[ 0 ], ball[ 1 ], ball[ 2 ] ] : [ 0, 1, - 12 ];
				if ( seg.kind === 'celebrate' ) aim.splice( 0, 3, 0, 1, - 18 );
				target = at( aim[ 0 ], aim[ 1 ], aim[ 2 ] );

			}

			fov = play ? play.fov : Math.max( 4, Math.min( 30, 650 / eye.distanceTo( target ) ) );

		}

		// ---- FB2 (C2B-22): the backstop net's cables, a few metres in front of the high home lens, aren't
		// in its picture (they crossed it as three black lines)
		const cables = this.places.find( ( p ) => p.wells )?.walls?.cables;
		if ( cables ) cables.visible = shot.cam !== 'high';
		if ( shot.fov ) fov = shot.fov;
		if ( shot.close ) close = true;
		if ( shot.aim && Array.isArray( shot.aim ) && shot.cam !== 'high3' && shot.cam !== 'high1' ) target = at( ...shot.aim );

		// no depth of field from the long lens in center field (sharp crowd behind home, as in every FOX
		// frame); a close-up from the low cameras does soften the crowd behind
		const P = this.post.params;
		P.dof.value += ( ( close ? 1 : 0 ) - P.dof.value ) * Math.min( 1, dt * 4 );
		P.dofFocus.value = eye.distanceTo( this._camAim || target );
		P.dofScale.value = 1.4;

		// a cut (another camera, or a jump in the replay): start clean, on the new camera's framing
		const key = shot.cam + ( close ? ':close' : '' ) + ( shot.tag ? ':' + shot.tag : '' );
		const cut = ! this._lastEye || this._lastEye.distanceTo( eye ) > 3 || ( this.camMode === 'tv' && key !== this._tvShot );
		this._tvShot = key;
		if ( cut ) {

			this._camAim = null;
			this.post?.cut();
			if ( close ) P.dof.value = 1;
			// (FB2: the first frames of a new shot are framed, not eased into: the players this frame were
			// posed the frame before, which after a jump in the replay is somewhere else)
			this._settle = 3;

		}

		this._lastEye = ( this._lastEye || new Vector3() ).copy( eye );
		// ease toward the target (a camera operator, not a snap)
		const settle = this._settle > 0;
		if ( settle ) this._settle --;
		const k = settle ? 1 : 1 - Math.exp( - dt * 6 );
		this._camAim = this._camAim ? this._camAim.lerp( target, k ) : target.clone();
		this.camera.position.copy( eye );
		this.camera.lookAt( this._camAim );
		const f = cut || settle ? fov : this.camera.fov + ( fov - this.camera.fov ) * k;
		if ( Math.abs( f - this.camera.fov ) > 0.01 ) {

			this.camera.fov = f;
			this.camera.updateProjectionMatrix();

		}

	}

	// the scoreboard follows the game (redrawn when what it shows changes, at most four times a second)
	_scoreboard( dt ) {

		this._boardT = ( this._boardT || 0 ) + dt;
		if ( this._boardT < 0.25 ) return;
		this._boardT = 0;
		const st = this.director.boardState();
		this.fascia?.update( st, this.director );
		const key = JSON.stringify( [ st.score, st.count, st.outs, st.batter?.last, st.inning, st.half, st.video.kind, st.today.length, st.line, st.pitcher, this.landmarks?.boardKey?.( this.director ) ] );
		if ( key === this._boardKey ) return;
		this._boardKey = key;
		this.landmarks?.updateScoreboard( st, this.director );
		this.details?.updateOutOfTown( st );

	}

	// the replay's cues: the radio call, the ballpark's sounds, the crowd
	_cue( cue ) {

		const r = this.radio, s = this.sound;
		if ( cue.say ) r.say( cue.say, { important: !! ( cue.pa || cue.result || cue.champions ) } );
		if ( cue.contact ) s.crack( 'medium' );
		if ( cue.crack ) s.crack( cue.crack );
		if ( cue.mitt ) s.mitt();
		if ( cue.glove ) s.mitt( true );
		if ( cue.cheer ) s.cheer( cue.cheer );
		if ( cue.result && cue.scored > 0 ) s.cheer( cue.batting === 'home' ? 3 : - 1 );
		if ( cue.result && /strikeout/.test( cue.result.type ) ) s.cheer( cue.batting === 'home' ? - 1 : 1.5 );
		if ( cue.champions ) s.celebrate();

	}

	// Game 5's weather: October 27, first pitch in light rain at 47 F, harder and harder until they stopped
	// after the top of the 6th with home plate under a puddle; October 29, dry, 44 F, a gusty wind in from
	// right. ?weather=off turns it off.
	_weather() {

		const F = this.field;
		this.skyGlow = 0.006;
		// the flags: a breeze by default; the replay's nights were windy (the 27th a rainstorm out of the
		// north-west, the 29th cold, blowing 20-30 mph)
		const flagWind = ( wx, wz, k ) => {

			const a = F.toField( wx, wz ), o = F.toField( 0, 0 );
			this.landmarks?.flags?.setWind( ( a.x ?? a[ 0 ] ) - ( o.x ?? o[ 0 ] ), ( a.z ?? a[ 1 ] ) - ( o.z ?? o[ 1 ] ), k );

		};

		if ( this.qs.get( 'weather' ) === 'off' ) {

			flagWind( 1, 0.6, 0.35 );
			G.wet.value = 0;
			return;

		}

		const d = this.director;
		const seg = d.segmentAt( d.t );
		const { inning, half } = seg.snap;
		// the suspension: the break after the top of the 6th on October 27, the crew pulls the tarp over
		// the infield in the first seconds of it (it's off again when play resumes on the 29th)
		// ---- R (rituals): the tarp follows the rituals' plan (game/TarpPlan.js: swung out from the wall and
		// pushed across by the crew, the roll thinning; wound back up on the 29th), the stowed tube on the wall
		// only while it's there; and the 27th's rain goes on through its part of the suspension (the delay)
		const N = d.night ? d.night( d.t ) : null;
		const tarp = tarpState( N );
		this.details?.setTarp( tarp.pull, tarp ); // ---- FR2: the plan's state places the sheet fold by fold
		if ( this.details?.tarpRoll ) this.details.tarpRoll.visible = tarp.stowed;
		const rollY = this.details?.tarpMat?.uniforms?.rollY;
		// (the part still to come off lies along the pulled edge, held up in the crew's hands)
		if ( rollY ) rollY.value = tarp.edgeY / 0.6;
		// ---- end R
		// progress through the first night, 0 (first pitch) .. 1 (the suspension)
		const firstNight = inning < 6 || ( inning === 6 && half === 'top' ) || !! N?.delay;
		const k = firstNight ? Math.min( 1, ( ( inning - 1 ) * 2 + ( half === 'top' ? 0 : 1 ) ) / 10 ) : 0;
		const rain = firstNight ? 0.3 + 0.7 * k : 0;
		const wet = firstNight ? 0.35 + 0.65 * k : 0.25;
		this.rain.amount = rain;
		// ---- FC4 (C4R-1): a driving rain: the 27th's north-westerly at ~4 m/s in the bowl leans the drops ~25
		// degrees off the vertical (it was 1.4 m/s: they fell straight down). Steady: a drop is where its wind
		// times the clock puts it, so a changing wind would sweep them all sideways. The night air's far
		// sheets lean with it (Night.js copies it). And the drops' side light as the eye or FOX's cameras see it
		this.rain.material.uniforms.wind.value.set( firstNight ? 3.3 : 0, firstNight ? 2.2 : 0 );
		this.rain.broadcast = !! this.camMode && this.camMode !== 'walk';
		// (the night air's far sheets of drops only where the air's well lit: the beams, round a bank; three
		// times FW2's gate, so the dim spill over the black sky draws none: Night.js streakGate)
		this.night?.air.streakGate.value.set( 0.0024, 0.015 );
		// ---- end FC4
		flagWind( 1.2, 0.8, firstNight ? 0.5 + 0.2 * k : 0.9 );
		this.field.surfaceMaterial.uniforms.wet.value = wet;
		// everything else open to the sky: soaked on the 27th, drying out on the 29th
		G.wet.value = firstNight ? 0.45 + 0.55 * k : 0.12;
		// the low cloud on the 27th glows with the park's and the city's light
		// ---- L: dimmer than it was: from inside the lit bowl the sky over it read mid grey-brown, where every
		// frame of both nights has it near black (navy on FOX's cameras); the banks' own glow is the night
		// air's now (Night.js)
		this.skyGlow = firstNight ? 0.0075 + 0.003 * k : 0.0045;
		this.sound.setRain( rain );
		// ponchos in the stands while it rains
		this._crowdRain = firstNight ? Math.min( 1, rain * 3 ) : 0;
		if ( this.clouds ) this.clouds.coverage.value = firstNight ? 0.85 + 0.12 * k : 0.55;
		// ---- FC4 (C4R-12): the 27th was a grey day (rain, wind and cold forecast, light rain from the first
		// inning: SABR / Baseball-Reference): set the hour by day and it rained out of a blue sky under a
		// hard sun. Under the overcast the sun's direct light is mostly gone (soft shadows) and the sky's
		// light is grey and comes from all over (applyAtmosphereReadback)
		this._overcast = firstNight ? 0.88 + 0.1 * k : 0;
		if ( this.clouds && firstNight ) this.clouds.coverage.value = Math.max( this.clouds.coverage.value, 0.97 );
		if ( this.sky?.overcast ) this.sky.overcast.value = this._overcast;
		// ---- end FC4
		if ( this.haze ) this.haze.density.value = firstNight ? 1.3 + 1.2 * k : 1.0;
		// ---- L: the 29th at the airport: broken cloud at 7:54 pm clearing to a few by 8:54 and 9:54, 10 mi
		// visibility, a dew point of 28 F (ref/night INDEX, the KPHL METARs): a clear, dry, black sky. After
		// dark (the afternoon of the storm's clearing stays as it was)
		if ( ! firstNight ) {

			const nk = MathUtils.smoothstep( G.night.value, 0.2, 0.8 );
			if ( this.clouds ) this.clouds.coverage.value = 0.55 - 0.33 * nk;
			if ( this.haze ) this.haze.density.value = 1.0 - 0.25 * nk;

		}
		// ---- end L

	}

	// ?poses: one player in each pose in a row behind home plate (for checking the rig and the motions)
	_poseLineup() {

		const M = Motions;
		const list = [
			[ 'stand', ( t ) => M.stand( t ) ], [ 'ready', ( t ) => M.ready( t ) ], [ 'run', ( t ) => M.run( t * 1.4, 1 ) ],
			[ 'set', () => M.pitcherSet() ], [ 'lift', () => M.delivery( 0.38 ) ], [ 'stride', () => M.delivery( 0.72 ) ],
			[ 'release', () => M.delivery( M.REL ) ], [ 'follow', () => M.delivery( 1.15 ) ], [ 'stance', ( t ) => M.batterStance( t ) ],
			[ 'contact', () => M.swing( M.CONTACT ) ], [ 'finish', () => M.swing( 0.42 ) ], [ 'catcher', ( t ) => M.catcherCrouch( t ) ],
			[ 'grounder', () => M.fieldGrounder() ], [ 'high', () => M.catchHigh() ], [ 'throw', () => M.throwBall( 0.18 ) ],
			[ 'kneel', () => M.kneel( 1 ) ], [ 'embrace', () => M.embrace() ], [ 'jump', ( t ) => M.jump( t ) ],
		];
		const ps = list.map( ( [ name ], i ) => {

			const p = this.players.add( { team: i % 2 ? 'away' : 'home', skin: i % 4, name } );
			p.x = - 17 + i * 2; p.z = - 12; p.yaw = Math.PI;
			return p;

		} );
		this.poseTest = ( t ) => list.forEach( ( [ , f ], i ) => { ps[ i ].pose = f( t ); } );

	}

	async precompile() {

		const mr = this.engine.meshRenderer;
		if ( ! this.post._built ) {

			this.post._build();
			this.post._outW = 0; // as PostFX.beginFrame: size the new targets

		}

		await GPU.pipelinesReady();
		mr.precompiling = true;
		try {

			this.frame( 1 / 60 );

		} catch ( e ) {

			console.warn( 'precompile failed', e );

		}

		mr.precompiling = false;
		await GPU.pipelinesReady();
		await GPU.queue.onSubmittedWorkDone();

	}

	// ---------------------------------------------------------------- sun / sky

	updateSun() {

		const s = this.settings;
		const dir = sunDirectionFromTime( s.timeOfDay, LATITUDE, this.declination ).applyAxisAngle( _up, MathUtils.degToRad( s.sunAzimuth || 0 ) );
		// the sky is always scattered sunlight, even with the sun below the horizon (twilight)
		this.atmosphere.sunDir.value.copy( dir );
		// below the horizon the moon takes over as the key light
		const night = MathUtils.smoothstep( - dir.y, 0.02, 0.18 );
		G.night.value = night;
		// over South Philadelphia only a few of the brightest stars get through the city's glow
		this.sky.starIntensity.value = night * 0.08;
		this.sky.glow.value = night * this.skyGlow;
		if ( this.skyGlowLayer ) {

			// the glow over the city, and the halos round the light banks (bigger in the rain)
			const r = this.rain ? this.rain.amount : 0;
			// ---- L: no halo sprites: the banks' glow is the night air's now (Night.js)
			this.skyGlowLayer.set( { glow: night * this.skyGlow, halo: this.night ? 0 : night * ( 0.2 + 0.45 * r ), haloSize: 18 + 12 * r, toward: this._north } );

		}
		const moon = new Vector3( - dir.x, Math.abs( dir.y ) * 0.8 + 0.25, - dir.z ).normalize();
		this.sky.moonDir.value.copy( moon );
		// after dark the key light (and its shadows) is the stadium's: the banks on the roof behind home
		// plate, high over the field, so the players' shadows fall out toward center field
		if ( ! this._stadiumKey && this.field ) {

			this.field.group.updateMatrixWorld( true );
			this._stadiumKey = new Vector3( 0.12, 0.78, 0.62 ).normalize().transformDirection( this.field.group.matrixWorld );

		}

		const light = dir.y > - 0.07 ? dir : ( this._stadiumKey || moon );
		G.sunDir.value.copy( light );

	}

	applyAtmosphereReadback() {

		const a = this.atmosphere;
		if ( ! a.sunTransmittance ) return;
		const sunTrue = a.sunDir.value;
		const sunUp = sunTrue.y > - 0.07; // same switch as updateSun()
		const T = a.sunTransmittance;
		const horizonFade = MathUtils.smoothstep( sunTrue.y, - 0.03, 0.02 );
		let c;
		if ( sunUp ) c = new Color( T[ 0 ], T[ 1 ], T[ 2 ] ).multiplyScalar( SUN_ILLUMINANCE * horizonFade );
		// ---- FB2 (C2B-6): the banks' metal halide (about 4,500 K) as FOX's cameras saw it, white-balanced
		// to it: a neutral, faintly cool white (blue-white uniforms, a grey-green field), not a warm one
		else c = new Color( 0.94, 0.965, 1.0 ).multiplyScalar( 0.75 * G.night.value );
		// ---- end FB2
		// ---- FC4 (C4R-12): an overcast day (the 27th's): the sun behind the cloud, its light the sky's, grey
		const oc = sunUp ? ( this._overcast || 0 ) * horizonFade : 0;
		if ( oc > 0 ) c.multiplyScalar( 1 - 0.85 * oc );
		// ---- end FC4
		G.sunColor.value.copy( c );
		const irr = a.skyIrradiance;
		const nightAmb = 0.012 * G.night.value;
		G.skyIrradiance.value.setRGB( irr[ 0 ] + nightAmb * 0.6, irr[ 1 ] + nightAmb * 0.7, irr[ 2 ] + nightAmb );
		// ---- FC4 (C4R-12): the cloud's grey: the sky's light evened out and some of the sun's scattered into it
		if ( oc > 0 ) {

			const sky = G.skyIrradiance.value, grey = ( sky.r + sky.g + sky.b ) / 3 + 0.04 * SUN_ILLUMINANCE * horizonFade * oc;
			sky.setRGB( sky.r + ( grey * 0.97 - sky.r ) * oc * 0.8, sky.g + ( grey - sky.g ) * oc * 0.8, sky.b + ( grey * 1.04 - sky.b ) * oc * 0.8 );

		}
		// ---- end FC4
		G.horizonColor.value.setRGB( a.horizon[ 0 ], a.horizon[ 1 ], a.horizon[ 2 ] );

	}

	// The light on the replay's own clock (the Alley's when(): 8:38 pm at the first pitch on the 27th to
	// 10:40 at the suspension and on into the delay, then 8:37 to 9:58 on the 29th and the celebration
	// after), as local solar time. It lets go for good once the hour is set some other way (?hour=, the
	// Sky panel's slider, T, a QA shot's hour); the Sky panel's "Game clock" picks it up again.
	_gameHour() {

		const s = this.settings;
		if ( ! this.gameClock || ! this.director ) return;
		if ( s.timeSpeed !== 0 || ( this._autoHour != null && Math.abs( s.timeOfDay - this._autoHour ) > 1e-6 ) ) {

			this.gameClock = false;
			this._autoHour = null;
			if ( this.ui ) {

				this.ui.s.gameClock = false;
				this.ui.ui.refresh?.();

			}

			return;

		}

		s.timeOfDay = this._autoHour = ( ( gameClock( this.director ).clock + EDT_TO_SOLAR ) % 24 + 24 ) % 24;

	}

	// T: let the day run (about 8 minutes per day) or stop it
	toggleTime() {

		const s = this.settings;
		if ( s.timeSpeed !== 0 ) {

			this._timeSpeed = s.timeSpeed;
			s.timeSpeed = 0;

		} else {

			s.timeSpeed = this._timeSpeed || 0.05;

		}

		if ( this.ui ) {

			this.ui.s.advance = s.timeSpeed !== 0;
			this.ui.ui.refresh();
			this.ui.ui.toast( s.timeSpeed !== 0 ? 'Time running' : 'Time paused' );

		}

	}

	// Free camera on F; walking resumes from where the camera is, facing the same way.
	setFreeCam( on ) {

		if ( on === this.freeCam ) return;
		this.freeCam = on;
		const e = new Euler().setFromQuaternion( this.camera.quaternion, 'YXZ' );
		if ( on ) {

			this.fly.setPose( this.camera.position.clone(), e.y, e.x );
			this.fly.velocity.set( 0, 0, 0 );

		} else {

			const c = this.camera.position;
			this.walker.setPose( new Vector3( c.x, c.y - 1.62, c.z ), e.y, MathUtils.clamp( e.x, - 1.5, 1.5 ) );

		}

	}

	// ---------------------------------------------------------------- loop

	start() {

		this.running = true;
		this.engine.start( ( dt, t ) => this.frame( dt, t ) );

	}

	updateFPS( dt ) {

		const f = this._fps || ( this._fps = { el: document.getElementById( 'fps' ), acc: 0, n: 0, worst: 0 } );
		f.acc += dt;
		f.n ++;
		f.worst = Math.max( f.worst, dt );
		if ( f.acc >= 0.5 ) {

			const fps = f.n / f.acc;
			const text = `${ fps.toFixed( 0 ) } fps · ${ ( 1000 * f.acc / f.n ).toFixed( 1 ) } ms · max ${ ( f.worst * 1000 ).toFixed( 1 ) } ms`;
			if ( f.el ) f.el.textContent = text;
			this.fps = fps;
			f.acc = 0;
			f.n = 0;
			f.worst = 0;

		}

	}

	frame( dt ) {

		const t0 = performance.now();
		this._frame( dt );
		const ms = performance.now() - t0;
		this.cpuMs = this.cpuMs === undefined ? ms : this.cpuMs * 0.95 + ms * 0.05;

	}

	_frame( dt ) {

		GPU.beginFrame();
		FrameUniforms.fields.frameIndex.value = GPU.frame;
		const s = this.settings;
		this.updateFPS( dt );
		G.dt.value = dt;
		G.time.value += dt;
		if ( s.timeSpeed !== 0 ) s.timeOfDay = ( s.timeOfDay + dt * s.timeSpeed + 24 ) % 24;

		// ---- input + player
		if ( this.input.hit( 'KeyF' ) ) this.setFreeCam( ! this.freeCam );
		if ( this.input.hit( 'KeyT' ) ) this.toggleTime();
		// G: twice as fast, walking or flying (with Shift on top)
		if ( this.input.hit( 'KeyG' ) ) {

			this.fast = ! this.fast;
			this.walker.speedScale = this.fly.speedScale = this.fast ? 2 : 1;
			if ( this.ui ) this.ui.ui.toast( this.fast ? 'Double speed' : 'Normal speed' );

		}

		if ( this.input.hit( 'KeyL' ) ) {

			const on = this.localLights.toggleFlashlight();
			if ( this.ui ) this.ui.ui.toast( on ? 'Flashlight on' : 'Flashlight off' );

		}

		this._gameHour();
		if ( this.input.hit( 'KeyC' ) && this.director ) this.cycleCamera();
		if ( this.camMode && this.camMode !== 'walk' ) this._broadcastCamera( dt );
		else if ( this.freeCam ) this.fly.update( dt );
		else this.walker.update( dt );

		// ---- sky
		this.updateSun();
		this.atmosphere.update( dt, this.camera.position.y );
		this.applyAtmosphereReadback();
		if ( this.clouds ) this.clouds.update( dt, this.camera );
		this.environment.update( dt );

		// ---- world
		this.ground.update( dt );
		if ( this.poseTest ) this.poseTest( G.time.value );
		if ( this.director ) {

			this.director.update( dt );
			// a jump in the replay (scrubbing, skipping) is a cut too: the players are somewhere else
			const dT = this.director.t - ( this._lastDirT ?? this.director.t );
			if ( Math.abs( dT ) > 1 + dt * this.director.speed ) {

				this.post?.cut();
				this._settle = 3; // ---- FB2: and the TV cameras framed afresh

			}
			this._lastDirT = this.director.t;
			this.radio.speed = this.director.speed;
			// ---- R (rituals): the radio track is on the old clock (a 24 s suspension): silent through the rest
			// of the delay
			const rt = this.director.radioTime ? this.director.radioTime( this.director.t ) : this.director.t;
			this.radio.sync( rt ?? this.director.t, this.director.playing && rt !== null );
			// ---- end R
			this._weather();
			this._scoreboard( dt );

		}

		this.night?.update( dt ); // ---- L

		this.bowl.crowd.update( this.director, dt, this._crowdRain || 0 );
		this.bowl.crowd.lod( this.camera );
		this.people?.update( dt, this.director );
		this.landmarks?.update( dt, this.director, this.sound );
		// FOX's cameras pan with the play (the one you're looking through isn't drawn)
		const cf = this.field.toField( this.camera.position.x, this.camera.position.z );
		this.bowl.updateCameras( this.director ? ( this.director.ballFocus ?? this.director.ballAt ) : null, dt, [ cf[ 0 ], this.camera.position.y - this.field.y0, cf[ 1 ] ] );
		this.details?.update( dt, this.director );
		for ( const p of this.places ) p.update?.( dt, this.director, this.camera );

		// ---- FB2 (C2B-10): in a replay on TV the players and the ball are posed at the replayed moment,
		// after everything else has had the live one (the clock, the radio, the crowd, the board and the
		// bug stay live); the rig's slots are held meanwhile, so nobody's freed and re-added frame to frame
		const rp = this._replayNow();
		this._replaying = !! rp;
		if ( this.director ) {

			const d = this.director;
			d.holdSlots = !! rp;
			if ( rp ) {

				const now = d.now;
				d.pose( rp.r.seg.t0 + rp.tau );
				d.now = now;

			}

		}
		// ---- end FB2

		this.players.update();
		this._playerBounds(); // ---- SP1
		if ( this.gameHUD ) this.gameHUD.refresh();
		this.localLights.update( this.camera, dt );
		this.sound?.listen( this.camera );

		// ---- render
		G.exposure.value = s.exposure;
		updateCameraVelocity( this.camera );
		this.post.lens.update( dt, false );
		if ( this.post.flare ) {

			this.post.flare.setDepthHeight( this.sceneRenderer.sceneRT.height );
			this.post.flare.update( this.camera, dt, { aboveWater: true } );

		}

		// the post chain sets the TAAU jitter + internal size and writes the camera into the frame
		// uniforms; shadows then render with this frame's sun and camera
		this.post.beginFrame();
		this.underwater.updateCamera( this.camera );
		this.shadows.render( this.scene, this.engine.meshRenderer, this.shadows.update( this.camera, G.sunDir.value ) );
		this.sceneRenderer.render();
		if ( this.post.flare ) this.post.flare.kernel.dispatch( 1 );
		this.post.render();
		this.post.endFrame();
		if ( this.profiler ) this.profiler.update( dt );
		GPU.submit();

		if ( this.ui ) this.ui.update( dt );
		this.input.endFrame();

	}

	// ---- SP1 (speed): the players' bounds, every frame, from where they stand. Players.js draws all its
	// slots as one instanced mesh with no bounds (frustumCulled = false), so it was drawn into every
	// shadow cascade and behind every wall: a million triangles. With a box round the players on the
	// field, the cascades that don't reach them skip them, and the occlusion culling (engine
	// render/Occlusion.js) drops them when the field can't be seen (from the concourse)
	_playerBounds() {

		const P = this.players, m = P?.mesh;
		if ( ! m || ! m.parent ) return;
		// ---- SP2 (speed): the far players' figure for those small on screen (Players.lodSplit); its draw
		// shares the near one's bounds
		// (`_noPlayerLod`: everyone near, for an A/B)
		if ( P.lodSplit && ! this._noPlayerLod ) P.lodSplit( this.camera, this.engine.canvas.height || 800 );
		else if ( P.far ) P.far.count = P.mid.count = 0;
		const f = P.far;
		// ---- end SP2
		const b = m.occlusionBox || ( m.occlusionBox = new Box3() );
		b.makeEmpty();
		const v = this._pv || ( this._pv = new Vector3() );
		for ( const p of P.slots ) if ( p && p.visible ) b.expandByPoint( v.set( p.x, p.y || 0, p.z ) );
		if ( b.isEmpty() ) {

			m.frustumCulled = false;
			m.occlusionBox = null;
			for ( const o of f ? [ f, P.mid ] : [] ) { o.frustumCulled = false; o.occlusionBox = null; } // ---- SP2
			return;

		}

		// a player's reach from where he stands: lying in the dogpile, arms up, a leap at the wall
		b.min.x -= 2.5; b.min.z -= 2.5; b.min.y -= 0.5;
		b.max.x += 2.5; b.max.z += 2.5; b.max.y += 3.2;
		b.getBoundingSphere( m.boundingSphere || ( m.boundingSphere = new Sphere() ) );
		m.frustumCulled = true;
		for ( const o of f ? [ f, P.mid ] : [] ) { o.frustumCulled = true; o.occlusionBox = b; o.boundingSphere = m.boundingSphere; } // ---- SP2

	}
	// ---- end SP1

	// Internal render resolution relative to the output (0.5..1)
	setRenderScale( v ) {

		const scale = MathUtils.clamp( Math.round( v * 20 ) / 20, 0.5, 1 );
		this.settings.renderScale = scale;
		this.post.setScale( scale );
		if ( this.clouds ) this.clouds.resolutionScale = scale;

	}

}
