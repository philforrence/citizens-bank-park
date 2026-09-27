import { InstancedMesh, BufferGeometry, Float32BufferAttribute, Matrix4, Quaternion, Vector3 } from '../engine/index.js';
import { StorageBuffer } from '../engine/gpu/Texture.js';
import { standard } from '../materials/Materials.js';
import { tierSections, rowHeights } from './Stands.js';
import { offsetPolyline } from './Bowl.js';
import { LEVELS } from './layout.js';

// Everyone who isn't in a seat or on the field: the staff behind every concession stand and the lines
// in front of them (longer when the Rays are batting and between innings, when the Phillies fans go for
// food), people walking the concourse and up and down the aisles, ushers at the tops of the aisles,
// event security at the foot of them and at the gates, ticket takers at every turnstile, a trickle of
// late arrivals across the plaza, and at the last out a line of police along the warning track.
//
// One instanced mesh of low-poly standing figures (1.6 to 1.9 m tall, like the crowd's), three poses
// morphed per vertex: standing, a walking stride (swung both ways for the cycle) and reaching forward
// (over a counter, to scan a ticket). Who they are (the clothes) and what they're doing come from a
// per-person record the vertex shader reads; the town moves on the CPU (update()).
//
//   const people = new People( { field, bowl, concourse, exterior } );
//   people.update( dt, director )

const MAX = 1400;
const STREET = LEVELS.mainConcourse;
export const ROLE = { fan: 0, staff: 1, security: 2, usher: 3, police: 4 };

// the figure's joints, standing (origin on the ground between the feet, facing -z)
const STAND = {
	hip: [ 0.1, 0.9, 0.0 ], knee: [ 0.11, 0.5, - 0.02 ], ankle: [ 0.12, 0.07, 0.0 ],
	pelvis: [ 0, 0.88, 0.02 ], chest: [ 0, 1.38, 0.03 ], neck: [ 0, 1.45, 0.03 ], head: [ 0, 1.57, 0.02 ],
	shoulder: [ 0.2, 1.37, 0.03 ], elbow: [ 0.23, 1.1, 0.06 ], wrist: [ 0.22, 0.86, 0.02 ], hand: [ 0.21, 0.77, 0.01 ],
};
// mid-stride, left foot forward: the legs apart, the arms swung the other way (the cycle swings it both
// ways: position + walk * sin( phase ))
const WALK = {
	knee: [ [ - 1, [ 0.11, 0.52, - 0.2 ] ], [ 1, [ 0.11, 0.47, 0.12 ] ] ],
	ankle: [ [ - 1, [ 0.12, 0.1, - 0.28 ] ], [ 1, [ 0.12, 0.16, 0.26 ] ] ],
	elbow: [ [ - 1, [ 0.23, 1.11, 0.14 ] ], [ 1, [ 0.23, 1.11, - 0.05 ] ] ],
	wrist: [ [ - 1, [ 0.22, 0.89, 0.18 ] ], [ 1, [ 0.22, 0.9, - 0.14 ] ] ],
	hand: [ [ - 1, [ 0.21, 0.8, 0.21 ] ], [ 1, [ 0.21, 0.82, - 0.2 ] ] ],
};
// reaching forward with both hands at chest height
const REACH = { elbow: [ 0.2, 1.2, - 0.2 ], wrist: [ 0.15, 1.2, - 0.42 ], hand: [ 0.12, 1.2, - 0.5 ] };
const P = { shirt: 0, pants: 1, skin: 2, head: 3, brim: 4, vest: 5 };

function figureGeometry() {

	const pos = [], walk = [], reach = [], nrm = [], part = [], index = [];
	const sub = ( a, b ) => [ a[ 0 ] - b[ 0 ], a[ 1 ] - b[ 1 ], a[ 2 ] - b[ 2 ] ];
	const add = ( a, b ) => [ a[ 0 ] + b[ 0 ], a[ 1 ] + b[ 1 ], a[ 2 ] + b[ 2 ] ];
	const mul = ( a, k ) => [ a[ 0 ] * k, a[ 1 ] * k, a[ 2 ] * k ];
	const cross = ( a, b ) => [ a[ 1 ] * b[ 2 ] - a[ 2 ] * b[ 1 ], a[ 2 ] * b[ 0 ] - a[ 0 ] * b[ 2 ], a[ 0 ] * b[ 1 ] - a[ 1 ] * b[ 0 ] ];
	const norm = ( a ) => mul( a, 1 / ( Math.hypot( ...a ) || 1 ) );
	// a joint of side s (-1 left, +1 right) in a pose
	const at = ( name, s, pose ) => {

		const base = STAND[ name ];
		let j = base;
		if ( pose === 'walk' && WALK[ name ] ) j = WALK[ name ].find( ( [ side ] ) => side === s )[ 1 ];
		if ( pose === 'reach' && REACH[ name ] ) j = REACH[ name ];
		return [ j[ 0 ] * ( base[ 0 ] ? s : 1 ), j[ 1 ], j[ 2 ] ];

	};

	const ring = ( a, b, t, n, rx, rz ) => {

		const ax = norm( sub( b, a ) );
		let across = norm( cross( ax, [ 0, 0, 1 ] ) );
		if ( Math.hypot( ...cross( ax, [ 0, 0, 1 ] ) ) < 0.2 ) across = norm( cross( ax, [ 0, 1, 0 ] ) );
		const depth = norm( cross( across, ax ) );
		const c = add( a, mul( sub( b, a ), t ) );
		const out = [];
		for ( let k = 0; k < n; k ++ ) {

			const ang = ( k / n ) * Math.PI * 2 + Math.PI / n;
			out.push( [ add( c, add( mul( across, Math.cos( ang ) * rx ), mul( depth, Math.sin( ang ) * rz ) ) ), norm( add( mul( across, Math.cos( ang ) ), mul( depth, Math.sin( ang ) ) ) ) ] );

		}

		return out;

	};

	const tube = ( ja, jb, s, rA, rB, p, n = 4, cap = false ) => {

		const poses = [ 'stand', 'walk', 'reach' ].map( ( ps ) => [ at( ja, s, ps ), at( jb, s, ps ) ] );
		const base = pos.length / 3;
		for ( const t of [ 0, 1 ] ) {

			const r = t ? rB : rA;
			const rings = poses.map( ( [ a, b ] ) => ring( a, b, t, n, r[ 0 ], r[ 1 ] ) );
			for ( let k = 0; k < n; k ++ ) {

				pos.push( ...rings[ 0 ][ k ][ 0 ] );
				nrm.push( ...rings[ 0 ][ k ][ 1 ] );
				walk.push( ...sub( rings[ 1 ][ k ][ 0 ], rings[ 0 ][ k ][ 0 ] ) );
				reach.push( ...sub( rings[ 2 ][ k ][ 0 ], rings[ 0 ][ k ][ 0 ] ) );
				part.push( p );

			}

		}

		for ( let k = 0; k < n; k ++ ) {

			const a = base + k, b = base + ( k + 1 ) % n, c = base + n + k, d = base + n + ( k + 1 ) % n;
			index.push( a, b, c, b, d, c );

		}

		if ( cap ) for ( let k = 1; k < n - 1; k ++ ) index.push( base + n, base + n + k + 1, base + n + k );

	};

	const vert = ( p, n, pt ) => {

		pos.push( ...p ); walk.push( 0, 0, 0 ); reach.push( 0, 0, 0 ); nrm.push( ...n ); part.push( pt );
		return pos.length / 3 - 1;

	};

	// the trunk (the vest over it for the staff who wear one: the shader decides), the neck
	tube( 'pelvis', 'chest', 1, [ 0.17, 0.12 ], [ 0.2, 0.11 ], P.shirt, 8, true );
	tube( 'chest', 'neck', 1, [ 0.12, 0.09 ], [ 0.055, 0.05 ], P.shirt, 8 );
	for ( const s of [ - 1, 1 ] ) {

		tube( 'shoulder', 'elbow', s, [ 0.06, 0.06 ], [ 0.05, 0.05 ], P.shirt );
		tube( 'elbow', 'wrist', s, [ 0.05, 0.05 ], [ 0.042, 0.042 ], P.shirt );
		tube( 'wrist', 'hand', s, [ 0.035, 0.02 ], [ 0.03, 0.018 ], P.skin );
		tube( 'hip', 'knee', s, [ 0.085, 0.085 ], [ 0.06, 0.06 ], P.pants );
		tube( 'knee', 'ankle', s, [ 0.058, 0.058 ], [ 0.05, 0.05 ], P.pants );

	}

	// the head, a cap's brim
	{

		const W = 8, H = 5, r = [ 0.082, 0.105, 0.098 ], hc = STAND.head;
		const first = pos.length / 3;
		for ( let j = 0; j <= H; j ++ ) for ( let i = 0; i < W; i ++ ) {

			const th = j / H * Math.PI, ph = i / W * Math.PI * 2;
			const d = [ Math.sin( th ) * Math.cos( ph ), Math.cos( th ), Math.sin( th ) * Math.sin( ph ) ];
			vert( add( hc, [ d[ 0 ] * r[ 0 ], d[ 1 ] * r[ 1 ], d[ 2 ] * r[ 2 ] ] ), d, P.head );

		}

		for ( let j = 0; j < H; j ++ ) for ( let i = 0; i < W; i ++ ) {

			const a = first + j * W + i, b = first + j * W + ( i + 1 ) % W, c = a + W, d = b + W;
			if ( j > 0 ) index.push( a, b, c );
			if ( j < H - 1 ) index.push( b, d, c );

		}

		const brim = [ [ - 0.075, 0.055, - 0.06 ], [ 0.075, 0.055, - 0.06 ], [ 0.07, 0.045, - 0.16 ], [ - 0.07, 0.045, - 0.16 ] ].map( ( o ) => vert( add( hc, o ), [ 0, 1, 0 ], P.brim ) );
		index.push( brim[ 0 ], brim[ 2 ], brim[ 1 ], brim[ 0 ], brim[ 3 ], brim[ 2 ] );

	}

	const g = new BufferGeometry();
	g.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
	g.setAttribute( 'normal', new Float32BufferAttribute( nrm, 3 ) );
	g.setAttribute( 'aWalk', new Float32BufferAttribute( walk, 3 ) );
	g.setAttribute( 'aReach', new Float32BufferAttribute( reach, 3 ) );
	g.setAttribute( 'aPart', new Float32BufferAttribute( part, 1 ) );
	g.setIndex( index );
	g.computeBoundingSphere();
	return g;

}

function peopleMaterial( info, moved ) {

	const mat = standard( {
		name: 'people', roughness: 0.8, side: 'double',
		storage: { pplInfo: info, pplMoved: moved },
		attributes: { aWalk: 'vec3f', aReach: 'vec3f', aPart: 'f32' },
		varyings: { vPart: 'f32', vInfo: 'vec4f', vLocal: 'vec3f' },
		vertex: /* wgsl */`
	// info: x the stride's phase (radians), y how much he's walking (0..1), z the role + a seed (its
	// fraction), w how much he's reaching
	let inf = pplInfo[ v.instance ];
	let walkK = inf.y;
	let reachK = inf.w;
	let seedV = fract( inf.z );
	let sw = sin( inf.x );
	var p = v.position + v.aWalk * sw * walkK + v.aReach * reachK;
	// a bob in the stride, a sway standing
	p.y += abs( cos( inf.x ) ) * 0.03 * walkK;
	p.x += sin( frame.time * 0.7 + seedV * 30.0 ) * 0.01 * ( 1.0 - walkK ) * ( p.y - 0.4 );
	let cap = fract( seedV * 7.0 ) < 0.45 || inf.z >= 1.0;
	let lp = select( vec4f( 0.0, 0.0, 0.0, 1.0 ), vec4f( p, 1.0 ), v.aPart < 3.5 || v.aPart > 4.5 || cap );
	v.useWorld = true;
	v.worldPos = ( v.model * lp ).xyz;
	v.worldNormal = normalize( ( v.model * vec4f( v.normal, 0.0 ) ).xyz );
	v.prevWorldPos = v.worldPos - pplMoved[ v.instance ].xyz;
	o.vPart = v.aPart;
	o.vInfo = inf;
	o.vLocal = p;
`,
		surface: /* wgsl */`
	let part = i32( in.vs.vPart + 0.01 );
	let inf = in.vs.vInfo;
	let role = i32( floor( inf.z ) );
	let seed = fract( inf.z );
	let h = fract( sin( vec4f( seed * 12.9898, seed * 78.233, seed * 39.346, seed * 11.135 ) ) * 43758.5453 );
	// a fan's jacket: mostly Phillies red, then black, grey, white, navy
	var shirt = mix( vec3f( 0.22, 0.012, 0.016 ), vec3f( 0.36, 0.022, 0.028 ), h.x );
	let u = h.y;
	if ( u > 0.46 ) { shirt = vec3f( 0.5, 0.49, 0.46 ) * mix( 0.8, 1.0, h.x ); }
	if ( u > 0.54 ) { shirt = vec3f( 0.014, 0.014, 0.016 ); }
	if ( u > 0.68 ) { shirt = vec3f( 0.12, 0.12, 0.125 ) * mix( 0.7, 1.4, h.x ); }
	if ( u > 0.77 ) { shirt = vec3f( 0.015, 0.022, 0.06 ); }
	if ( u > 0.84 ) { shirt = vec3f( 0.12, 0.018, 0.025 ); }
	if ( u > 0.9 ) { shirt = vec3f( 0.22, 0.33, 0.48 ); }
	var pants = select( select( vec3f( 0.03, 0.045, 0.1 ), vec3f( 0.28, 0.22, 0.15 ), h.z > 0.72 ), vec3f( 0.02 ), h.z > 0.86 );
	var capC = select( vec3f( 0.02, 0.03, 0.1 ), vec3f( 0.42, 0.015, 0.02 ), h.w < 0.7 );
	var vest = false;
	// the staff: concession workers in red polos and black caps; event security in a hi-vis vest over
	// a black jacket; ushers and ticket takers in Phillies red jackets, khakis, red caps; police in navy
	if ( role == 1 ) { shirt = vec3f( 0.4, 0.02, 0.03 ); pants = vec3f( 0.02 ); capC = vec3f( 0.015 ); }
	if ( role == 2 ) { shirt = vec3f( 0.015 ); pants = vec3f( 0.02 ); capC = vec3f( 0.015 ); vest = true; }
	if ( role == 3 ) { shirt = vec3f( 0.42, 0.02, 0.03 ); pants = vec3f( 0.3, 0.24, 0.15 ); capC = vec3f( 0.42, 0.02, 0.03 ); }
	if ( role == 4 ) { shirt = vec3f( 0.012, 0.016, 0.045 ); pants = vec3f( 0.012, 0.016, 0.045 ); capC = vec3f( 0.01, 0.012, 0.03 ); }
	let si = fract( h.w * 3.3 + seed );
	var skin = vec3f( 0.55, 0.34, 0.23 );
	if ( si > 0.55 ) { skin = vec3f( 0.42, 0.25, 0.16 ); }
	if ( si > 0.75 ) { skin = vec3f( 0.25, 0.13, 0.07 ); }
	if ( si > 0.88 ) { skin = vec3f( 0.13, 0.07, 0.04 ); }
	let hair = select( select( vec3f( 0.02, 0.015, 0.01 ), vec3f( 0.12, 0.07, 0.03 ), h.z > 0.55 ), vec3f( 0.3, 0.28, 0.26 ), h.z > 0.88 );
	let L = in.vs.vLocal;
	var c = shirt;
	var rough = 0.85;
	var e = vec3f( 0.0 );
	if ( part == 0 && vest && L.y > 0.95 && L.y < 1.4 ) {
		// the vest: fluorescent yellow-green, two silver bands
		c = vec3f( 0.55, 0.62, 0.02 );
		if ( abs( L.y - 1.08 ) < 0.025 || abs( L.y - 1.2 ) < 0.025 ) { c = vec3f( 0.6 ); rough = 0.3; }
		e = c * 0.05;
	}
	if ( part == 1 ) { c = pants; rough = 0.9; }
	if ( part == 2 ) { c = skin; rough = 0.6; }
	if ( part == 3 ) {
		let hd = L - vec3f( ${ STAND.head.join( ', ' ) } );
		c = skin; rough = 0.6;
		let capped = fract( seed * 7.0 ) < 0.45 || role > 0;
		if ( hd.y > 0.03 - 0.06 * smoothstep( -0.02, 0.06, hd.z ) ) { c = hair; rough = 0.7; }
		if ( capped && hd.y > 0.025 ) { c = capC; }
	}
	if ( part == 4 ) { c = capC; }
	s.albedo = c;
	s.roughness = rough;
	s.emissive = e + c * smoothstep( 0.15, 0.7, frame.night ) * 0.1;
`,
	} );
	mat.underwaterLighting = 'none';
	return mat;

}

const rnd = ( s ) => {

	const x = Math.sin( s * 12.9898 + 78.233 ) * 43758.5453;
	return x - Math.floor( x );

};

export class People {

	constructor( { field, bowl, concourse, exterior, landmarks } ) {

		this.info = new Float32Array( MAX * 4 );
		this.infoBuffer = new StorageBuffer( { label: 'peopleInfo', count: MAX, type: 'vec4f' } );
		// how far each moved since the last frame (world frame), for the motion vectors
		this.moved = new Float32Array( MAX * 4 );
		this.movedBuffer = new StorageBuffer( { label: 'peopleMoved', count: MAX, type: 'vec4f' } );
		this.field = field;
		this.mesh = new InstancedMesh( figureGeometry(), peopleMaterial( this.infoBuffer, this.movedBuffer ), MAX );
		this.mesh.name = 'people';
		this.mesh.frustumCulled = false;
		this.mesh.castShadow = false;
		this.mesh.receiveShadow = true;
		field.group.add( this.mesh );
		this.list = [];
		this.time = 0;
		this._m = new Matrix4();
		this._q = new Quaternion();
		this._v = new Vector3();
		this._s = new Vector3();
		this._up = new Vector3( 0, 1, 0 );
		this._seed = 1;
		// ---- W2 (concourse): a place can take a stretch of the concourse over with its own people
		// (places/Concourse3B.js): hiders are ( x, z ) => true where People's own figures at street level
		// aren't drawn
		this.hiders = [];
		// ---- end W2
		this._stands( [ ...( concourse?.standSpots || [] ), ...( landmarks?.alleyStands || [] ) ] );
		this._walkway( bowl );
		this._aisles( bowl );
		this._gates( exterior );
		this._police( bowl );

	}

	// a person: at x, y, z facing yaw; role; he may be given a path to walk
	_add( role, x, y, z, yaw, extra = {} ) {

		if ( this.list.length >= MAX ) return null;
		const seed = rnd( this._seed ++ );
		const p = { role, x, y, z, yaw, seed, scale: 0.92 + 0.12 * rnd( seed * 91 ), phase: rnd( seed * 17 ) * 6.28, walk: 0, reach: 0, visible: true, ...extra };
		this.list.push( p );
		return p;

	}

	// ---- the concession stands: two behind each counter, a line in front
	_stands( spots ) {

		this.stands = [];
		for ( const st of spots ) {

			const { mid, n, u } = st;
			const yaw = Math.atan2( - n[ 0 ], - n[ 1 ] ); // facing +n (out over the counter)
			// behind the counter (the Alley's kitchens are painted into their windows: there the staff stand
			// in the window itself, behind the counter's front)
			const inset = st.inset ?? 0.6;
			const staff = ( st.staff || [ - 1.6, 1.6 ] ).map( ( k ) => this._add( ROLE.staff, mid[ 0 ] + u[ 0 ] * k - n[ 0 ] * inset, STREET, mid[ 1 ] + u[ 1 ] * k - n[ 1 ] * inset, yaw ) );
			// the line: up to eight people out from the counter, facing it
			const line = [];
			for ( let q = 0; q < 8; q ++ ) {

				const off = 0.95 + q * 0.78, side = ( rnd( this._seed + q ) - 0.5 ) * 0.25;
				const p = this._add( ROLE.fan, mid[ 0 ] + n[ 0 ] * off + u[ 0 ] * side, STREET, mid[ 1 ] + n[ 1 ] * off + u[ 1 ] * side, yaw + Math.PI + ( rnd( this._seed * 3 + q ) - 0.5 ) * 0.4 );
				if ( p ) {

					p.visible = false;
					p.queue = { mid, n, u, q };
					line.push( p );

				}

			}

			this.stands.push( { staff, line, len: 0, target: 0, next: rnd( this._seed ) * 8, base: 1 + Math.floor( rnd( this._seed * 5 ) * 4 ) } );

		}

	}

	// ---- walking the main concourse round the infield, both ways
	_walkway( bowl ) {

		if ( ! bowl?.path ) return;
		const line = offsetPolyline( bowl.path, bowl.top + 4.2, [ 0, - 40 ] );
		const seg = [];
		let L = 0;
		for ( let i = 0; i < line.length - 1; i ++ ) {

			const l = Math.hypot( line[ i + 1 ][ 0 ] - line[ i ][ 0 ], line[ i + 1 ][ 1 ] - line[ i ][ 1 ] );
			seg.push( { a: line[ i ], b: line[ i + 1 ], l, s: L } );
			L += l;

		}

		this.walkLine = { seg, L };
		for ( let k = 0; k < 170; k ++ ) {

			const p = this._add( ROLE.fan, 0, STREET, 0, 0 );
			if ( ! p ) break;
			p.walker = { s: rnd( k * 7.1 ) * L, dir: rnd( k * 3.3 ) < 0.5 ? - 1 : 1, speed: 1.1 + 0.5 * rnd( k * 5.7 ), lane: ( rnd( k * 9.1 ) - 0.5 ) * 4.5, busy: rnd( k * 2.9 ) };
			p.walk = 1;

		}

	}

	_alongWalk( s ) {

		const { seg, L } = this.walkLine;
		s = Math.max( 0, Math.min( L - 1e-3, s ) );
		for ( const g of seg ) if ( s <= g.s + g.l ) {

			const t = ( s - g.s ) / g.l;
			const ux = ( g.b[ 0 ] - g.a[ 0 ] ) / g.l, uz = ( g.b[ 1 ] - g.a[ 1 ] ) / g.l;
			return { x: g.a[ 0 ] + ( g.b[ 0 ] - g.a[ 0 ] ) * t, z: g.a[ 1 ] + ( g.b[ 1 ] - g.a[ 1 ] ) * t, ux, uz };

		}

		return { x: 0, z: 0, ux: 1, uz: 0 };

	}

	// ---- up and down the aisles of the field level, ushers at the top, security at the foot
	_aisles( bowl ) {

		const tier = bowl?.tiers?.[ 0 ];
		if ( ! tier ) return;
		const secs = tierSections( tier ), ys = rowHeights( tier ), D = tier.depth, S0 = tier.start || 0;
		const deep = tier.rows * D;
		const aisle = ( S, d ) => {

			const s = S.m0 * ( S0 + d );
			return [ S.a[ 0 ] + S.ux * s + S.nx * ( S0 + d ), S.a[ 1 ] + S.uz * s + S.nz * ( S0 + d ) ];

		};

		const yAt = ( d ) => {

			const r = Math.max( 0, Math.min( ys.length - 1, d / D ) ), i = Math.floor( r ), f = r - i;
			return ( ys[ i ] ?? ys[ ys.length - 1 ] ) * ( 1 - f ) + ( ys[ Math.min( ys.length - 1, i + 1 ) ] ?? ys[ ys.length - 1 ] ) * f;

		};

		this.aisleWalkers = [];
		secs.forEach( ( S, i ) => {

			if ( ! S.seats ) return;
			const top = aisle( S, deep + 0.5 );
			const inward = Math.atan2( S.nx, S.nz ); // facing the field (-n)
			if ( i % 2 === 0 ) this._add( ROLE.usher, top[ 0 ], yAt( deep ) + 0.05, top[ 1 ], inward );
			// ---- W4 (rail): the guard stands on the aisle's first step, facing the crowd. He stood in the
			// air in front of the wall (on the backstop's cushions, on the dugout roofs); behind a dugout the
			// section's first rows are its roof, so his step is the first row behind it
			const first = S.skipRows || 0;
			const foot = aisle( S, first * D + 0.3 );
			if ( i % 3 === 1 ) this._add( ROLE.security, foot[ 0 ], ys[ first ] + 0.01, foot[ 1 ], inward + Math.PI );
			// ---- end W4
			// one or two people on the steps
			for ( let k = 0; k < 2; k ++ ) {

				if ( rnd( i * 13 + k ) < 0.35 ) continue;
				const p = this._add( ROLE.fan, 0, 0, 0, 0 );
				if ( ! p ) return;
				p.walk = 1;
				// ---- W4 (rail): d0, where the steps start (behind a dugout, past its roof)
				const d0 = ( S.skipRows || 0 ) * D;
				p.aisle = { S, d: d0 + rnd( i * 7 + k ) * ( deep - d0 ), d0, dir: rnd( i * 3 + k ) < 0.5 ? - 1 : 1, deep, at: aisle, yAt, pause: 0 };

			}

		} );

	}

	// ---- the gates: a ticket taker at every turnstile, security either side, late arrivals crossing the plaza
	_gates( exterior ) {

		this.arrivals = [];
		for ( const lane of exterior?.lanes || [] ) {

			const yaw = Math.atan2( - lane.face[ 0 ], - lane.face[ 1 ] );
			const p = this._add( ROLE.usher, lane.at[ 0 ], STREET, lane.at[ 2 ], yaw );
			if ( p ) p.reachAt = rnd( this._seed ) * 5;

		}

		for ( const g of exterior?.gateGuards || [] ) this._add( ROLE.security, g.at[ 0 ], STREET, g.at[ 2 ], Math.atan2( - g.face[ 0 ], - g.face[ 1 ] ) );
		for ( const lane of ( exterior?.lanes || [] ).filter( ( l ) => /THIRD/.test( l.gate ) ) ) {

			for ( let k = 0; k < 2; k ++ ) {

				const p = this._add( ROLE.fan, 0, STREET, 0, 0 );
				if ( ! p ) break;
				p.walk = 1;
				p.arrive = { to: lane.entry, face: lane.face, t: rnd( this._seed * 11 + k ) };
				this.arrivals.push( p );

			}

		}

	}

	// ---- at the last out, police line the warning track facing the crowd
	_police( bowl ) {

		this.policeLine = [];
		const fence = bowl?.pit;
		if ( ! fence ) return;
		// round the infield stands' front, 1.5 m out from the wall, every 6 m
		const line = offsetPolyline( bowl.path.slice( 1, 11 ), - 1.8, [ 0, - 40 ] );
		let carry = 0;
		for ( let i = 0; i < line.length - 1; i ++ ) {

			const [ ax, az ] = line[ i ], [ bx, bz ] = line[ i + 1 ];
			const l = Math.hypot( bx - ax, bz - az );
			for ( let s = carry; s < l; s += 6 ) {

				const x = ax + ( bx - ax ) * s / l, z = az + ( bz - az ) * s / l;
				const p = this._add( ROLE.police, x, 0, z, Math.atan2( x - 0, z + 20 ) + Math.PI );
				if ( p ) {

					p.visible = false;
					this.policeLine.push( p );

				}

			}

			carry = ( carry + 6 - ( l % 6 ) ) % 6;

		}

	}

	update( dt, d ) {

		this.time += dt;
		const seg = d ? d.segmentAt( d.t ) : null;
		const snap = seg?.snap || {};
		// the lines: longer while the Rays bat (the home fans go for food) and between innings
		const between = seg && ( seg.kind === 'switch' || seg.kind === 'intro' );
		const busy = seg?.kind === 'celebrate' ? 0.1 : between ? 2.2 : snap.half === 'top' ? 1.7 : 0.6;
		for ( const st of this.stands ) {

			st.next -= dt;
			if ( st.next <= 0 ) {

				st.target = Math.min( st.line.length, Math.round( st.base * busy + ( rnd( this.time + st.base ) - 0.3 ) * 2 ) );
				if ( st.len < st.target ) st.len ++;
				else if ( st.len > st.target ) st.len --;
				st.next = 3 + rnd( this.time * 3 + st.base ) * 9;

			}

			st.line.forEach( ( p, q ) => {

				p.visible = q < st.len;
				p.reach = q === 0 ? 0.6 + 0.4 * Math.sin( this.time * 1.3 + p.seed * 9 ) : 0;

			} );
			st.staff.forEach( ( p, k ) => { if ( p ) p.reach = st.len > k ? 0.5 + 0.5 * Math.max( 0, Math.sin( this.time * 0.9 + p.seed * 20 ) ) : 0.1; } );

		}

		// the concourse: busier while the Rays bat
		const walkers = this.list.filter( ( p ) => p.walker );
		const share = seg?.kind === 'celebrate' ? 0.15 : between ? 1 : snap.half === 'top' ? 0.85 : 0.45;
		for ( const p of walkers ) {

			const w = p.walker;
			p.visible = w.busy < share;
			if ( ! p.visible ) continue;
			w.s += w.dir * w.speed * dt;
			if ( w.s < 0 || w.s > this.walkLine.L ) {

				w.dir *= - 1;
				w.s = Math.max( 0, Math.min( this.walkLine.L, w.s ) );

			}

			const a = this._alongWalk( w.s );
			p.x = a.x - a.uz * w.lane;
			p.z = a.z + a.ux * w.lane;
			p.y = STREET;
			p.yaw = Math.atan2( - a.ux * w.dir, - a.uz * w.dir );
			p.phase += dt * w.speed * 5.2;

		}

		// the aisles
		for ( const p of this.list ) if ( p.aisle ) {

			const A = p.aisle;
			if ( A.pause > 0 ) {

				A.pause -= dt;
				p.walk = 0;

			} else {

				p.walk = 1;
				A.d += A.dir * 0.75 * dt;
				if ( A.d > A.deep || A.d < ( A.d0 || 0 ) ) {

					A.dir *= - 1;
					A.pause = 2 + rnd( p.seed * 7 + this.time ) * 6;
					A.d = Math.max( A.d0 || 0, Math.min( A.deep, A.d ) );

				}

				p.phase += dt * 4.5;

			}

			const [ x, z ] = A.at( A.S, A.d );
			p.x = x; p.z = z; p.y = A.yAt( A.d ) + 0.02;
			p.yaw = Math.atan2( A.S.nx * A.dir, A.S.nz * A.dir ) + Math.PI;

		}

		// late arrivals: from the plaza to a turnstile, then gone through it
		for ( const p of this.arrivals ) {

			const A = p.arrive;
			A.t += dt / 22;
			if ( A.t > 1 ) A.t -= 1;
			const from = [ A.to[ 0 ] + A.face[ 0 ] * 30 + ( rnd( p.seed * 3 ) - 0.5 ) * 20, A.to[ 2 ] + A.face[ 1 ] * 30 ];
			p.x = from[ 0 ] + ( A.to[ 0 ] - from[ 0 ] ) * A.t;
			p.z = from[ 1 ] + ( A.to[ 2 ] - from[ 1 ] ) * A.t;
			p.y = STREET;
			p.yaw = Math.atan2( - ( A.to[ 0 ] - from[ 0 ] ), - ( A.to[ 2 ] - from[ 1 ] ) );
			p.phase += dt * 6;
			p.visible = A.t < 0.97;

		}

		// the ticket takers scan now and then
		for ( const p of this.list ) if ( p.reachAt != null ) p.reach = Math.max( 0, Math.sin( this.time * 0.8 + p.reachAt ) ) * 0.8;
		// the police come out for the last out
		const cel = seg?.kind === 'celebrate';
		for ( const p of this.policeLine ) p.visible = cel;

		// write the instances
		const M = this._m, q = this._q, v = this._v, s = this._s;
		const cy = Math.cos( this.field.group.rotation.y ), sy = Math.sin( this.field.group.rotation.y );
		let n = 0;
		for ( const p of this.list ) {

			// ---- W2 (concourse): not drawn where a place has its own people (see this.hiders)
			const hidden = this.hiders.length > 0 && Math.abs( p.y - STREET ) < 0.6 && this.hiders.some( ( h ) => h( p.x, p.z ) );
			// ---- end W2
			if ( ! p.visible || hidden ) {

				p.px = undefined;
				continue;

			}

			// the move since last frame, turned into the world frame (a fresh appearance has none)
			const dx = p.px === undefined ? 0 : p.x - p.px, dz = p.px === undefined ? 0 : p.z - p.pz, dy = p.px === undefined ? 0 : p.y - p.py;
			this.moved.set( [ dx * cy + dz * sy, dy, - dx * sy + dz * cy, 0 ], n * 4 );
			p.px = p.x; p.py = p.y; p.pz = p.z;
			q.setFromAxisAngle( this._up, p.yaw );
			M.compose( v.set( p.x, p.y, p.z ), q, s.setScalar( p.scale ) );
			this.mesh.setMatrixAt( n, M );
			this.info.set( [ p.phase, Math.min( 1, p.walk ), p.role + p.seed * 0.999, p.reach || 0 ], n * 4 );
			n ++;

		}

		this.mesh.count = Math.max( 1, n );
		this.mesh.instanceMatrix.needsUpdate = true;
		this.infoBuffer.write( this.info );
		this.movedBuffer.write( this.moved );

	}

}
