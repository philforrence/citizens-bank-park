// Compiles the players' rig material (game/Players.js) headless and fails on any WGSL error: one 32 x 32
// frame with a Phillie, a Ray and the Phanatic in the main and shadow passes (no picture kept). Run it
// under the GPU lock: node tools/gpu/lock.mjs run --owner "cbp players-shader" -- node test/players-shader.mjs
import './headless.mjs';
import { GPU } from '../src/engine/gpu/GPU.js';
import { RenderTarget } from '../src/engine/gpu/Texture.js';
import { G, setFrameCamera } from '../src/engine/render/Frame.js';
import { MeshRenderer } from '../src/engine/render/MeshRenderer.js';
import { SunShadows } from '../src/engine/render/Shadows.js';
import * as E from '../src/engine/index.js';

// the atlas is drawn on an OffscreenCanvas, which Node hasn't: a context that draws nothing
globalThis.OffscreenCanvas ??= class {

	constructor( w, h ) {

		this.width = w;
		this.height = h;

	}

	getContext() {

		const ctx = new Proxy( {}, {
			get: ( t, k ) => {

				if ( k === 'getImageData' ) return ( x, y, w, h ) => ( { data: new Uint8ClampedArray( w * h * 4 ) } );
				if ( k === 'measureText' ) return () => ( { width: 10 } );
				if ( k === 'canvas' ) return this;
				return k in t ? t[ k ] : () => {};

			},
			set: ( t, k, v ) => {

				t[ k ] = v;
				return true;

			},
		} );
		return ctx;

	}

};

const errors = [];
const err = console.error;
console.error = ( ...a ) => {

	errors.push( a.join( ' ' ) );
	err( ...a );

};

await GPU.init( { headless: true } );
const { Players } = await import( '../src/ballpark/game/Players.js' );
const { look } = await import( '../src/ballpark/game/Looks.js' );
const scene = new E.Scene();
const players = new Players( { parent: scene } );
const a = players.add( { team: 'home', number: '26', look: look( 400284 ) } );
const b = players.add( { team: 'away', number: '32', name: 'Hinske', look: look( 400134 ) } );
const c = players.add( { team: 'phanatic', look: look( 'phanatic' ) } );
b.x = 2; c.x = - 2;
// (the atlas's upload needs a real canvas)
players._atlasDirty = false;
players.update();
const W = 32, H = 32;
const camera = new E.PerspectiveCamera( 40, 1, 0.1, 100 );
camera.position.set( 0, 1.5, 8 );
camera.lookAt( 0, 1, 0 );
G.sunDir.value.set( 0.5, 0.7, 0.3 ).normalize();
const rt = new RenderTarget( W, H, { colors: [ 'rgba16float', 'rgba16float', 'rgba8unorm' ], depth: 'depth32float', label: 'scene' } );
const mr = new MeshRenderer();
const shadows = new SunShadows();
GPU.beginFrame();
setFrameCamera( camera, W, H );
shadows.render( scene, mr, shadows.update( camera, G.sunDir.value ) );
mr.render( scene, { camera, kind: 'main', colorViews: rt.textures.map( ( t ) => t.view() ), colorFormats: rt.formats,
	clearColors: [ [ 0, 0, 0, 1 ], [ 0, 0, 0, 0 ], [ 0, 0, 0, 0 ] ], depthView: rt.depthTexture.view(), depthFormat: 'depth32float', clearDepth: 0 } );
GPU.submit();
await GPU.device.queue.onSubmittedWorkDone();
await new Promise( ( r ) => setTimeout( r, 500 ) );
console.log( 'players shader:', errors.length ? `${ errors.length } error(s)` : 'ok', JSON.stringify( mr.stats ) );
process.exit( errors.length ? 1 : 0 );
