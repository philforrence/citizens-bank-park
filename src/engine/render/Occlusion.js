import { GPU } from '../gpu/GPU.js';
import { Box3, Vector3 } from '../math/index.js';

// Occlusion culling for the main opaque pass (SP1, the gauntlet's speed track).
//
// On this GPU (an Apple M2, tile-based with hidden surface removal) a hidden pixel costs almost
// nothing, but a hidden triangle costs as much as a visible one: every vertex is shaded and binned
// before the tiles are rasterized. The opaque pass is mostly geometry (half the resolution saves only
// a quarter of it), and much of that geometry can't be seen: from the concourse the whole crowd and
// the players stand behind the walls, and from a seat most of the bowl is behind the deck above.
//
// So the big objects (the crowd's and the seats' chunks, the players, the cars, anything over
// `minTriangles`) get a hardware occlusion query: at the end of the opaque pass their bounding boxes
// are drawn against the finished depth (no colour, no depth written), each in its own query. The
// result comes back a frame or two later; an object whose box showed no pixel is skipped in the
// following frames, and its box is still tested every frame, so it comes back as soon as any of it
// could be seen. Conservative throughout:
//  - the box encloses the object (inflated by a margin: the fans stand up and raise their arms beyond
//    their seated bounds), so an object with any visible pixel has a visible box pixel in front of it;
//  - no result yet, an old one, or a camera jump (a cut, a teleport): drawn;
//  - the camera inside or next to a box: drawn (its faces would be clipped by the near plane);
//  - an object whose bounds aren't trusted (frustumCulled = false) isn't culled, unless it gives an
//    `occlusionBox` (local frame) of its own.
// What it can cost: an object coming out from behind a wall appears a frame or two late; at walking
// speed that's the sliver that has just come into view.
//
// Per object: `occlusion = false` opts out, `occlusionBox` (Box3, local) overrides the bounds,
// `occlusionMargin` (m) the inflation.

const _box = new Box3();
const _cam = new Vector3();
const _fwd = new Vector3();

// a cube's 12 triangles over its corners ( bit 0: x, bit 1: y, bit 2: z ), outward faces counter-clockwise
const CUBE = '0u,4u,6u, 0u,6u,2u, 1u,3u,7u, 1u,7u,5u, 0u,1u,5u, 0u,5u,4u, 2u,6u,7u, 2u,7u,3u, 0u,2u,3u, 0u,3u,1u, 4u,5u,7u, 4u,7u,6u';

const SHADER = /* wgsl */`
struct Box { lo: vec4f, hi: vec4f };
@group( 0 ) @binding( 0 ) var<uniform> viewProj: mat4x4f;
@group( 0 ) @binding( 1 ) var<storage, read> boxes: array<Box>;
var<private> CUBE: array<u32, 36> = array<u32, 36>( ${ CUBE } );
@vertex fn vs( @builtin( vertex_index ) v: u32, @builtin( instance_index ) i: u32 ) -> @builtin( position ) vec4f {
	let b = boxes[ i ];
	let c = CUBE[ v ];
	let t = vec3f( f32( c & 1u ), f32( ( c >> 1u ) & 1u ), f32( ( c >> 2u ) & 1u ) );
	return viewProj * vec4f( mix( b.lo.xyz, b.hi.xyz, t ), 1.0 );
}
@fragment fn fs() {}
`;

export class Occlusion {

	constructor( { max = 1024, minTriangles = 2500, margin = 0.3, instancedMargin = 1.2, maxAge = 6, jump = 2.5, turn = 12 } = {} ) {

		this.max = max;
		this.minTriangles = minTriangles;
		this.margin = margin;
		this.instancedMargin = instancedMargin;
		this.maxAge = maxAge; // frames a "hidden" result stays good for
		this.jump = jump; // metres the camera may move in a frame before the results are dropped
		this.cosTurn = Math.cos( turn * Math.PI / 180 ); // and degrees it may turn
		this.enabled = true;
		this.gen = 0; // results from an older generation (before a jump) are ignored
		this.count = 0;
		this.active = false;
		this.objects = [];
		this.boxes = new Float32Array( max * 8 );
		this.lastFrame = - 10;
		this.lastPos = new Vector3( 1e9, 0, 0 );
		this.lastFwd = new Vector3();
		this.stats = { tested: 0, hidden: 0, hiddenTriangles: 0 };
		const d = GPU.device;
		this.querySet = d.createQuerySet( { label: 'occlusion', type: 'occlusion', count: max } );
		this.resolveBuffer = d.createBuffer( { label: 'occlusion resolve', size: max * 8, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC } );
		this.ring = Array.from( { length: 4 }, () => ( { buffer: d.createBuffer( { label: 'occlusion readback', size: max * 8, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST } ), busy: false } ) );
		this.boxBuffer = d.createBuffer( { label: 'occlusion boxes', size: max * 32, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST } );
		this.vpBuffer = d.createBuffer( { label: 'occlusion viewProj', size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST } );
		this.vp = new Float32Array( 16 );
		const module = d.createShaderModule( { label: 'occlusion boxes', code: SHADER } );
		this.module = module;
		this.layout = d.createBindGroupLayout( { label: 'occlusion', entries: [
			{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
			{ binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
		] } );
		this.bindGroup = d.createBindGroup( { label: 'occlusion', layout: this.layout, entries: [
			{ binding: 0, resource: { buffer: this.vpBuffer } },
			{ binding: 1, resource: { buffer: this.boxBuffer } },
		] } );
		this.pipelineLayout = d.createPipelineLayout( { bindGroupLayouts: [ this.layout ] } );
		this.pipelines = new Map();

	}

	// drop every result (the view jumped)
	reset() {

		this.gen ++;

	}

	// start of the pass: is there a readback buffer free, did the camera jump?
	begin( camera ) {

		this.count = 0;
		this.stats.tested = this.stats.hidden = this.stats.hiddenTriangles = 0;
		this.active = this.enabled && this.ring.some( ( s ) => ! s.busy );
		if ( ! camera ) {

			this.active = false;
			return;

		}

		camera.updateMatrixWorld();
		_cam.setFromMatrixPosition( camera.matrixWorld );
		const e = camera.matrixWorld.elements;
		_fwd.set( - e[ 8 ], - e[ 9 ], - e[ 10 ] ).normalize();
		if ( GPU.frame - this.lastFrame > 2 || _cam.distanceTo( this.lastPos ) > this.jump || _fwd.dot( this.lastFwd ) < this.cosTurn ) this.reset();
		this.lastFrame = GPU.frame;
		this.lastPos.copy( _cam );
		this.lastFwd.copy( _fwd );

	}

	// a triangle count for the object, for eligibility
	_triangles( o ) {

		const g = o.geometry;
		if ( ! g || g.indirect ) return 0;
		const n = g.index ? g.index.count : g.attributes.position ? g.attributes.position.count : ( g.vertexCount || 0 );
		const inst = o.isInstancedMesh ? o.count : ( g.instanceCount ?? 1 );
		return n / 3 * ( Number.isFinite( inst ) ? inst : 1 );

	}

	// Called for each object in the view (frustum passed): registers it for this frame's query and
	// says whether to skip it (its last result showed no pixel).
	culled( o ) {

		if ( ! this.active || o.occlusion === false || o.__occFrame === GPU.frame ) return false;
		if ( o.frustumCulled === false && ! o.occlusionBox ) return false;
		const tris = this._triangles( o );
		if ( tris < this.minTriangles ) return false;
		// the box, world space, inflated
		let local = o.occlusionBox;
		if ( ! local ) {

			if ( o.isInstancedMesh ) {

				if ( ! o.boundingBox ) o.computeBoundingBox();
				local = o.boundingBox;

			} else {

				if ( ! o.geometry.boundingBox ) o.geometry.computeBoundingBox();
				local = o.geometry.boundingBox;

			}

		}

		if ( ! local || local.isEmpty() ) return false;
		_box.copy( local ).applyMatrix4( o.matrixWorld );
		const m = o.occlusionMargin ?? ( o.isInstancedMesh ? this.instancedMargin : this.margin );
		_box.expandByScalar( m );
		// the camera in it, or near enough that the near plane cuts it: drawn, untested
		if ( _cam.x > _box.min.x - 1 && _cam.x < _box.max.x + 1 && _cam.y > _box.min.y - 1 && _cam.y < _box.max.y + 1 && _cam.z > _box.min.z - 1 && _cam.z < _box.max.z + 1 ) {

			o.__occ = null;
			return false;

		}

		if ( this.count >= this.max ) return false;
		o.__occFrame = GPU.frame;
		const i = this.count ++;
		this.objects[ i ] = o;
		const b = this.boxes, k = i * 8;
		b[ k ] = _box.min.x; b[ k + 1 ] = _box.min.y; b[ k + 2 ] = _box.min.z; b[ k + 3 ] = 1;
		b[ k + 4 ] = _box.max.x; b[ k + 5 ] = _box.max.y; b[ k + 6 ] = _box.max.z; b[ k + 7 ] = 1;
		this.stats.tested ++;
		const s = o.__occ;
		const hidden = !! s && s.gen === this.gen && ! s.visible && GPU.frame - s.frame <= this.maxAge;
		if ( hidden ) {

			this.stats.hidden ++;
			this.stats.hiddenTriangles += tris;

		}

		return hidden;

	}

	_pipeline( pass ) {

		const key = pass.colorFormats.join( ',' ) + '|' + pass.depthFormat + '|' + pass.depthCompare;
		let p = this.pipelines.get( key );
		if ( p ) return p;
		p = GPU.device.createRenderPipeline( {
			label: 'occlusion boxes',
			layout: this.pipelineLayout,
			vertex: { module: this.module, entryPoint: 'vs' },
			fragment: { module: this.module, entryPoint: 'fs', targets: pass.colorFormats.map( ( format ) => ( { format, writeMask: 0 } ) ) },
			primitive: { topology: 'triangle-list', cullMode: 'back', frontFace: 'ccw' },
			depthStencil: { format: pass.depthFormat, depthWriteEnabled: false, depthCompare: pass.depthCompare || 'greater-equal' },
		} );
		this.pipelines.set( key, p );
		return p;

	}

	// inside the opaque pass, after everything opaque is drawn: the boxes, one query each
	draw( rp, pass, viewProj ) {

		if ( ! this.count ) return;
		this.vp.set( viewProj.elements );
		GPU.queue.writeBuffer( this.vpBuffer, 0, this.vp );
		GPU.queue.writeBuffer( this.boxBuffer, 0, this.boxes.buffer, 0, this.count * 32 );
		rp.setPipeline( this._pipeline( pass ) );
		rp.setBindGroup( 0, this.bindGroup );
		for ( let i = 0; i < this.count; i ++ ) {

			rp.beginOcclusionQuery( i );
			rp.draw( 36, 1, 0, i );
			rp.endOcclusionQuery();

		}

	}

	// after the pass: the results copied out and read back when the frame is done
	resolve( enc ) {

		const n = this.count;
		if ( ! n ) return;
		const slot = this.ring.find( ( s ) => ! s.busy );
		if ( ! slot ) return;
		slot.busy = true;
		enc.resolveQuerySet( this.querySet, 0, n, this.resolveBuffer, 0 );
		enc.copyBufferToBuffer( this.resolveBuffer, 0, slot.buffer, 0, n * 8 );
		const objs = this.objects.slice( 0, n ), frame = GPU.frame, gen = this.gen;
		GPU.onSubmit( null, () => {

			slot.buffer.mapAsync( GPUMapMode.READ, 0, n * 8 ).then( () => {

				const r = new Uint32Array( slot.buffer.getMappedRange( 0, n * 8 ) );
				for ( let i = 0; i < n; i ++ ) {

					const o = objs[ i ];
					const s = o.__occ || ( o.__occ = { frame: - 1, visible: true, gen } );
					if ( frame < s.frame ) continue;
					s.frame = frame;
					s.gen = gen;
					s.visible = r[ i * 2 ] !== 0 || r[ i * 2 + 1 ] !== 0;

				}

				slot.buffer.unmap();
				slot.busy = false;

			} ).catch( () => {

				slot.busy = false;

			} );

		} );

	}

}
