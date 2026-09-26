import { Vector3, Euler, Color, MathUtils } from '../engine/index.js';
import { GPU } from '../engine/gpu/GPU.js';
import { ShaderModule } from '../engine/gpu/Shader.js';
import { SunShadows } from '../engine/render/Shadows.js';
import { FrameUniforms } from '../engine/render/Frame.js';
import { SceneLighting, surfaceModule } from '../engine/render/wgsl/lighting.js';

import { Engine } from '../core/Engine.js';
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
import { Complex } from './Complex.js';
import { SkyGlow } from './SkyGlow.js';
import { batchStatic } from './geo.js';
import { Players } from './game/Players.js';
import * as Motions from './game/Motions.js';
import { Ball } from './game/Ball.js';
import { Director } from './game/Director.js';
import { GameHUD } from './game/GameHUD.js';
import { Radio } from './game/Radio.js';
import { GameSound } from './game/GameSound.js';
import { Rain } from './game/Rain.js';
import { GAME } from './data/game-2008-ws5.js';
import { FOOTPRINT, LEVELS } from './layout.js';
import { Walker } from './Walker.js';

const _up = new Vector3( 0, 1, 0 );

// South Philadelphia
const LATITUDE = 39.9;

// World axes (as Tidewater's sky): +x east, +y up, -z north. Metres. Home plate is at the origin
// (see layout.js). You start in the plaza at Pattison Avenue and Citizens Bank Way, looking at the Third
// Base Gate (field frame [ x, z ] and the point you face).
const START = { at: [ - 112, 78 ], look: GATES[ 0 ].at };

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
			timeOfDay: 16.0, // local solar time, hours
			sunAzimuth: 0, // degrees: turns the sun's daily path about the vertical
			timeSpeed: 0, // hours per real second
			exposure: 0.55,
			renderScale: 1, // internal resolution (the temporal upscaler reconstructs the output)
		};
		this.skyGlow = 0.006; // the urban sky glow at night (see _weather)
		this.qs = new URLSearchParams( location.search );
		// ?hour=21 sets the time of day (the game started at 8:37 pm)
		if ( this.qs.has( 'hour' ) ) this.settings.timeOfDay = Number( this.qs.get( 'hour' ) ) || this.settings.timeOfDay;
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
		await progress( 0.1, 'Laying the ground…' );
		this.colliders = new Colliders();
		this.field = new Field( { scene, colliders: this.colliders } );
		await progress( 0.14, 'Building the stands…' );
		this.bowl = new Bowl( { field: this.field, colliders: this.colliders } );
		await progress( 0.17, 'Bricking the facade…' );
		this.exterior = new Exterior( { field: this.field, colliders: this.colliders } );
		this.exterior.buildGateSign( this.bowl );
		await progress( 0.19, 'Raising the skyline…' );
		this.surroundings = new Surroundings( { field: this.field } );
		this.complex = new Complex( { field: this.field } );
		this.landmarks = new Landmarks( { field: this.field, bowl: this.bowl, colliders: this.colliders } );
		this.details = new Details2008( { field: this.field } );
		this.fascia = new Fascia( { field: this.field, bowl: this.bowl } );
		this.concourse = new Concourse( { field: this.field, bowl: this.bowl, colliders: this.colliders } );
		// the hundreds of little static meshes merged by material into a few draws
		const batched = batchStatic( this.field.group );
		console.info( `static batching: ${ batched.before } meshes into ${ batched.after }` );
		this.players = new Players( { parent: this.field.group } );
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
			if ( qs.has( 't' ) ) this.director.seek( Number( qs.get( 't' ) ) );
			if ( qs.has( 'play' ) ) this.director.seek( this.director.timeOfPlay( Number( qs.get( 'play' ) ) ) );
			if ( qs.has( 'paused' ) ) this.director.playing = false;

		}
		// the city's glow in the night air and the halos round the light banks; Center City is north
		// (world -z)
		this.skyGlowLayer = new SkyGlow( scene, this.bowl.lightSources().map( ( l ) => l.position ) );
		this._north = new Vector3( 0, 0, - 1 );
		// the haze thickens toward "sea level": put that under the field, which is below the street
		G.seaLevel.value = this.field.y0 - 1;
		// what you walk on: street level round the pit, the field (and the seats' colliders) inside it
		const F = this.field, B = this.bowl;
		this.terrain = { heightAt: ( x, z ) => F.y0 + B.heightAt( ...F.toField( x, z ) ) };
		this.ground = new Ground( { scene, hole: FOOTPRINT.map( ( [ x, z ] ) => {

			const w = this.field.toWorld( x, z );
			return [ w.x, w.z ];

		} ) } );

		this.sceneRenderer = new SceneRenderer( engine.meshRenderer, scene, camera );
		if ( this.sky.background ) this.sceneRenderer.background = this.sky.background;
		// point and spot lights: the flashlight (L) and, after dusk, the light towers aimed at the field
		this.localLights = new LocalLights();
		for ( const { position, dir } of this.bowl.lightSources() ) {

			this.localLights.add( {
				position, dir, color: new Color( 1.0, 0.97, 0.9 ), intensity: 2200, range: 380,
				cosInner: Math.cos( MathUtils.degToRad( 34 ) ), cosOuter: Math.cos( MathUtils.degToRad( 78 ) ), kind: 'stadium', priority: 0,
			} );

		}

		// the plaza's lamp posts
		for ( const { position, tall } of this.exterior.lampSources() ) {

			// full cut-off: a pool of light under each
			this.localLights.add( { position, dir: new Vector3( 0, - 1, 0 ), color: new Color( 1.0, 0.78, 0.5 ), intensity: tall ? 140 : 70, range: tall ? 20 : 12,
				cosInner: Math.cos( MathUtils.degToRad( 45 ) ), cosOuter: Math.cos( MathUtils.degToRad( 72 ) ), kind: 'lamp' } );

		}

		const at = this.field.toWorld( ...START.at ), look = this.field.toWorld( ...START.look );
		const start = { position: at, yaw: Math.atan2( - ( look.x - at.x ), - ( look.z - at.z ) ) };
		this.walker = new Walker( { camera, input: this.input, ground: this.terrain, colliders: this.colliders, start } );
		this._addElevators();
		this.freeCam = qs.has( 'fly' );

		// ---------------------------------------------------------------- post
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
		this.post = new PostFX( renderer, { sceneRenderer: this.sceneRenderer, camera, underwater: this.underwater, clouds: this.clouds, sunDir: this.atmosphere.sunDir, haze: this.haze } );
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

	// C: walk around, or watch from the TV cameras: center field (behind the pitcher), high behind home
	// plate, or following the ball
	cycleCamera( mode = null ) {

		const modes = [ 'walk', 'center', 'high', 'follow' ];
		this.camMode = mode || modes[ ( modes.indexOf( this.camMode || 'walk' ) + 1 ) % modes.length ];
		this.post?.cut();
		if ( this.post ) this.post.params.dof.value = 0;
		this._lastEye = null;
		if ( this.camMode === 'walk' ) {

			this.camera.fov = this._walkFov || 62;
			this.camera.updateProjectionMatrix();

		} else if ( ! this._walkFov ) this._walkFov = this.camera.fov;
		if ( this.ui ) this.ui.ui.toast( { walk: 'Walking', center: 'Center field camera', high: 'High home camera', follow: 'Following the ball' }[ this.camMode ] );

	}

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

	_broadcastCamera( dt ) {

		const F = this.field, d = this.director;
		const ball = d.ballAt;
		const at = ( x, y, z ) => {

			const w = F.toWorld( x, z );
			return new Vector3( w.x, F.y0 + y, w.z );

		};

		let eye, target, fov;
		const seg = d.segmentAt( d.t );
		if ( this.camMode === 'center' ) {

			// the classic shot: from center field over the pitcher's shoulder, a long lens
			const lefty = GAME.players[ seg.snap.pitcher ]?.throws === 'L';
			eye = at( lefty ? 1.8 : - 1.8, 9.5, - 128 );
			target = at( 0, 1.0, 0.2 );
			fov = 5.2;
			if ( seg.kind === 'inplay' || seg.kind === 'celebrate' || seg.kind === 'switch' || seg.kind === 'intro' ) {

				target = ball ? at( ball[ 0 ] * 0.6, Math.max( 1, ball[ 1 ] * 0.6 ), ball[ 2 ] * 0.6 ) : at( 0, 1, - 20 );
				fov = seg.kind === 'celebrate' ? 9 : 22;

			}

		} else if ( this.camMode === 'high' ) {

			eye = at( 0, 30, 44 );
			target = at( 0, 0, - 38 );
			fov = 48;

		} else {

			// following: the high-third camera, on a platform just out from the front of the Hall of Fame
			// Club (the 200 level) behind the third base dugout, turning to the ball
			if ( ! this._followEye ) this._followEye = this._clubCameraSpot( - 30, - 2 );
			eye = at( ...this._followEye );
			const aim = ball ? [ ball[ 0 ], ball[ 1 ], ball[ 2 ] ] : [ 0, 1, - 12 ];
			if ( seg.kind === 'celebrate' ) aim.splice( 0, 3, 0, 1, - 18 );
			target = at( aim[ 0 ], aim[ 1 ], aim[ 2 ] );
			const dd = eye.distanceTo( target );
			fov = Math.max( 10, Math.min( 45, 2400 / dd ) );

		}

		// the long lens from center field: in focus on the plate, the stands behind soft (the other
		// cameras' wider lenses keep everything sharp)
		const P = this.post.params;
		const dofOn = this.camMode === 'center' && fov < 12;
		P.dof.value += ( ( dofOn ? 1 : 0 ) - P.dof.value ) * Math.min( 1, dt * 4 );
		P.dofFocus.value = eye.distanceTo( this._camAim || target );
		P.dofScale.value = 2.6;

		// a cut (another camera, or a jump in the replay): start clean
		if ( this._lastEye && this._lastEye.distanceTo( eye ) > 3 ) {

			this._camAim = null;
			this.post?.cut();

		}

		this._lastEye = ( this._lastEye || new Vector3() ).copy( eye );
		// ease toward the target (a camera operator, not a snap)
		const k = 1 - Math.exp( - dt * 6 );
		this._camAim = this._camAim ? this._camAim.lerp( target, k ) : target.clone();
		this.camera.position.copy( eye );
		this.camera.lookAt( this._camAim );
		const f = this.camera.fov + ( fov - this.camera.fov ) * k;
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
		this.fascia.update( st, this.director );
		const key = JSON.stringify( [ st.score, st.count, st.outs, st.batter?.last, st.inning, st.half, st.video.kind, st.today.length, st.line, st.pitcher ] );
		if ( key === this._boardKey ) return;
		this._boardKey = key;
		this.landmarks.updateScoreboard( st );
		this.details.updateOutOfTown( st );

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
			this.landmarks.flags?.setWind( ( a.x ?? a[ 0 ] ) - ( o.x ?? o[ 0 ] ), ( a.z ?? a[ 1 ] ) - ( o.z ?? o[ 1 ] ), k );

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
		const susp = seg.kind === 'switch' && inning === 6 && half === 'bottom';
		this.details.setTarp( susp ? MathUtils.smoothstep( d.t - seg.t0, 2, 11 ) * ( 1 - MathUtils.smoothstep( d.t - seg.t0, seg.dur - 6, seg.dur - 1 ) ) : 0 );
		// progress through the first night, 0 (first pitch) .. 1 (the suspension)
		const firstNight = inning < 6 || ( inning === 6 && half === 'top' );
		const k = firstNight ? Math.min( 1, ( ( inning - 1 ) * 2 + ( half === 'top' ? 0 : 1 ) ) / 10 ) : 0;
		const rain = firstNight ? 0.3 + 0.7 * k : 0;
		const wet = firstNight ? 0.35 + 0.65 * k : 0.25;
		this.rain.amount = rain;
		this.rain.material.uniforms.wind.value.set( firstNight ? 1.2 : 0, firstNight ? 0.8 : 0 );
		flagWind( 1.2, 0.8, firstNight ? 0.5 + 0.2 * k : 0.9 );
		this.field.surfaceMaterial.uniforms.wet.value = wet;
		// everything else open to the sky: soaked on the 27th, drying out on the 29th
		G.wet.value = firstNight ? 0.45 + 0.55 * k : 0.12;
		// the low cloud on the 27th glows with the park's and the city's light
		this.skyGlow = firstNight ? 0.011 + 0.004 * k : 0.006;
		this.sound.setRain( rain );
		// ponchos in the stands while it rains
		this._crowdRain = firstNight ? Math.min( 1, rain * 3 ) : 0;
		if ( this.clouds ) this.clouds.coverage.value = firstNight ? 0.85 + 0.12 * k : 0.55;
		if ( this.haze ) this.haze.density.value = firstNight ? 1.3 + 1.2 * k : 1.0;

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
			this.skyGlowLayer.set( { glow: night * this.skyGlow, halo: night * ( 0.2 + 0.45 * r ), haloSize: 18 + 12 * r, toward: this._north } );

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
		else c = new Color( 1.0, 0.95, 0.86 ).multiplyScalar( 0.75 * G.night.value );
		G.sunColor.value.copy( c );
		const irr = a.skyIrradiance;
		const nightAmb = 0.012 * G.night.value;
		G.skyIrradiance.value.setRGB( irr[ 0 ] + nightAmb * 0.6, irr[ 1 ] + nightAmb * 0.7, irr[ 2 ] + nightAmb );
		G.horizonColor.value.setRGB( a.horizon[ 0 ], a.horizon[ 1 ], a.horizon[ 2 ] );

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
		if ( this.input.hit( 'KeyL' ) ) {

			const on = this.localLights.toggleFlashlight();
			if ( this.ui ) this.ui.ui.toast( on ? 'Flashlight on' : 'Flashlight off' );

		}

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
			if ( Math.abs( dT ) > 1 + dt * this.director.speed ) this.post?.cut();
			this._lastDirT = this.director.t;
			this.radio.speed = this.director.speed;
			this.radio.sync( this.director.t, this.director.playing );
			this._weather();
			this._scoreboard( dt );

		}

		this.bowl.crowd.update( this.director, dt, this._crowdRain || 0 );

		this.players.update();
		if ( this.gameHUD ) this.gameHUD.refresh();
		this.localLights.update( this.camera, dt );

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
		GPU.submit();

		if ( this.ui ) this.ui.update( dt );
		this.input.endFrame();

	}

	// Internal render resolution relative to the output (0.5..1)
	setRenderScale( v ) {

		const scale = MathUtils.clamp( Math.round( v * 20 ) / 20, 0.5, 1 );
		this.settings.renderScale = scale;
		this.post.setScale( scale );
		if ( this.clouds ) this.clouds.resolutionScale = scale;

	}

}
