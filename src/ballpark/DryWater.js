import { ShaderModule } from '../engine/webgpu.js';

// No sea at the ballpark. The post chain (Underwater, AirHaze) still asks the water query where the
// surface is; this answers "far below everything", so every pixel and the camera are always in air.
//
// WGSL (same names as ocean/WaterQuery.js):
//   fn waterQueryCameraState() -> vec4f     ( height, nx, nz, sea floor ) at the camera
//   fn waterQueryHeightAtXZ( xz: vec2f ) -> f32
export const DRY_LEVEL = - 1000;

export class DryWater {

	constructor() {

		this.module = new ShaderModule( {
			name: 'waterQuery',
			code: /* wgsl */`
fn waterQueryCameraState() -> vec4f { return vec4f( ${ DRY_LEVEL }.0, 0.0, 0.0, ${ DRY_LEVEL }.0 ); }
fn waterQueryHeightAtXZ( xz: vec2f ) -> f32 { return ${ DRY_LEVEL }.0; }
`,
		} );

	}

}
