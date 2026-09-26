import { InstancedMesh, BufferGeometry, Float32BufferAttribute, Vector3 } from '../engine/index.js';
import { standard } from '../materials/Materials.js';

// The crowd: Game 5 was a sellout (45,940 on October 27, the same again for the resumption on the 29th),
// so a fan in nearly every seat. One low-poly seated figure, instanced on the seats' own matrices (the
// stands add a crowd chunk beside each chunk of seats), everything else worked out on the GPU from a hash
// of the seat's position: who sits there (jacket or jersey colour, jeans, skin, hair, a cap, a rally
// towel, a poncho in the rain) and what he's doing. Three poses are morphed per vertex: sitting,
// standing and arms up (with a towel waving); how many are up, cheering, clapping or jumping follows the
// game (mood(), set every frame from the replay: two strikes, two outs, a Phillies rally, the last out).
//
//   const crowd = new Crowd();
//   crowd.addChunk( group, seatMatrices, name )   (Stands.js)
//   crowd.update( director, dt, rain )            (every frame)

// the figure's joints: sitting (feet on the tread, origin under the seat's middle, facing -z), standing,
// and the arms raised from each
const SIT = {
	hip: [ 0.1, 0.5, 0.06 ], knee: [ 0.12, 0.52, - 0.36 ], ankle: [ 0.12, 0.07, - 0.42 ],
	pelvis: [ 0, 0.47, 0.1 ], chest: [ 0, 0.96, 0.15 ], neck: [ 0, 1.02, 0.14 ], head: [ 0, 1.14, 0.12 ],
	shoulder: [ 0.2, 0.94, 0.14 ], elbow: [ 0.23, 0.68, 0.06 ], wrist: [ 0.15, 0.6, - 0.16 ], hand: [ 0.12, 0.59, - 0.25 ],
};
const SIT_UP = { elbow: [ 0.3, 1.2, 0.08 ], wrist: [ 0.3, 1.46, 0.02 ], hand: [ 0.29, 1.56, 0.0 ] };
const STAND = {
	hip: [ 0.1, 0.9, 0.0 ], knee: [ 0.11, 0.5, - 0.04 ], ankle: [ 0.12, 0.07, - 0.06 ],
	pelvis: [ 0, 0.88, 0.02 ], chest: [ 0, 1.38, 0.03 ], neck: [ 0, 1.45, 0.03 ], head: [ 0, 1.57, 0.02 ],
	shoulder: [ 0.2, 1.37, 0.03 ], elbow: [ 0.24, 1.1, 0.05 ], wrist: [ 0.23, 0.86, 0.0 ], hand: [ 0.22, 0.77, - 0.01 ],
};
const STAND_UP = { elbow: [ 0.3, 1.64, 0.0 ], wrist: [ 0.31, 1.9, - 0.05 ], hand: [ 0.3, 2.0, - 0.06 ] };

// parts (the shader colours by them)
const P = { shirt: 0, pants: 1, skin: 2, head: 3, brim: 4, towel: 5, shoe: 6 };

function fanGeometry() {

	const pos = [], stand = [], sitUp = [], standUp = [], nrm = [], nrmS = [], part = [], index = [];
	const side = ( j, s ) => [ j[ 0 ] * s, j[ 1 ], j[ 2 ] ];
	const get = ( pose, name, s ) => side( pose[ name ], s );
	const upOf = ( base, up, name, s ) => ( up[ name ] ? side( up[ name ], s ) : get( base, name, s ) );
	const sub = ( a, b ) => [ a[ 0 ] - b[ 0 ], a[ 1 ] - b[ 1 ], a[ 2 ] - b[ 2 ] ];
	const add = ( a, b ) => [ a[ 0 ] + b[ 0 ], a[ 1 ] + b[ 1 ], a[ 2 ] + b[ 2 ] ];
	const mul = ( a, k ) => [ a[ 0 ] * k, a[ 1 ] * k, a[ 2 ] * k ];
	const cross = ( a, b ) => [ a[ 1 ] * b[ 2 ] - a[ 2 ] * b[ 1 ], a[ 2 ] * b[ 0 ] - a[ 0 ] * b[ 2 ], a[ 0 ] * b[ 1 ] - a[ 1 ] * b[ 0 ] ];
	const norm = ( a ) => {

		const l = Math.hypot( ...a ) || 1;
		return mul( a, 1 / l );

	};

	// a ring of `n` points round the segment a -> b at its end t (0 or 1), radii rx (across) and rz (depth)
	const ring = ( a, b, t, n, rx, rz ) => {

		const ax = norm( sub( b, a ) );
		let across = norm( cross( ax, [ 0, 0, 1 ] ) );
		if ( Math.hypot( ...cross( ax, [ 0, 0, 1 ] ) ) < 0.2 ) across = norm( cross( ax, [ 0, 1, 0 ] ) );
		const depth = norm( cross( across, ax ) );
		const c = add( a, mul( sub( b, a ), t ) );
		const out = [];
		for ( let k = 0; k < n; k ++ ) {

			const ang = ( k / n ) * Math.PI * 2 + Math.PI / n;
			const d = add( mul( across, Math.cos( ang ) ), mul( depth, Math.sin( ang ) ) );
			out.push( [ add( c, add( mul( across, Math.cos( ang ) * rx ), mul( depth, Math.sin( ang ) * rz ) ) ), norm( d ) ] );

		}

		return out;

	};

	// a tube between two joints in all four poses; rA / rB radii at the ends ( [ across, depth ] )
	const tube = ( ja, jb, s, rA, rB, p, n = 4, capTop = false ) => {

		const poses = [ [ SIT, SIT ], [ STAND, STAND ], [ SIT, SIT_UP ], [ STAND, STAND_UP ] ].map( ( [ base, up ] ) => [ upOf( base, up, ja, s ), upOf( base, up, jb, s ) ] );
		const base = pos.length / 3;
		for ( const t of [ 0, 1 ] ) {

			const r = t ? rB : rA;
			const rings = poses.map( ( [ a, b ] ) => ring( a, b, t, n, r[ 0 ], r[ 1 ] ) );
			for ( let k = 0; k < n; k ++ ) {

				pos.push( ...rings[ 0 ][ k ][ 0 ] );
				nrm.push( ...rings[ 0 ][ k ][ 1 ] );
				stand.push( ...rings[ 1 ][ k ][ 0 ] );
				nrmS.push( ...rings[ 1 ][ k ][ 1 ] );
				sitUp.push( ...sub( rings[ 2 ][ k ][ 0 ], rings[ 0 ][ k ][ 0 ] ) );
				standUp.push( ...sub( rings[ 3 ][ k ][ 0 ], rings[ 1 ][ k ][ 0 ] ) );
				part.push( p );

			}

		}

		for ( let k = 0; k < n; k ++ ) {

			const a = base + k, b = base + ( k + 1 ) % n, c = base + n + k, d = base + n + ( k + 1 ) % n;
			index.push( a, b, c, b, d, c );

		}

		if ( capTop ) for ( let k = 1; k < n - 1; k ++ ) index.push( base + n, base + n + k + 1, base + n + k );

	};

	// a single vertex (for the head's poles, the brim, the towel): its place in each pose
	const vert = ( sit, st, su, stu, n, ns, p ) => {

		pos.push( ...sit ); stand.push( ...st ); sitUp.push( ...sub( su, sit ) ); standUp.push( ...sub( stu, st ) );
		nrm.push( ...n ); nrmS.push( ...ns ); part.push( p );
		return pos.length / 3 - 1;

	};

	// the trunk (a jacket over the shoulders), the neck
	tube( 'pelvis', 'chest', 1, [ 0.17, 0.12 ], [ 0.2, 0.11 ], P.shirt, 8, true );
	tube( 'chest', 'neck', 1, [ 0.12, 0.09 ], [ 0.055, 0.05 ], P.shirt, 8 );
	// arms: sleeve to the wrist, the hand
	for ( const s of [ - 1, 1 ] ) {

		tube( 'shoulder', 'elbow', s, [ 0.06, 0.06 ], [ 0.05, 0.05 ], P.shirt );
		tube( 'elbow', 'wrist', s, [ 0.05, 0.05 ], [ 0.042, 0.042 ], P.shirt );
		tube( 'wrist', 'hand', s, [ 0.035, 0.02 ], [ 0.03, 0.018 ], P.skin );
		tube( 'hip', 'knee', s, [ 0.085, 0.085 ], [ 0.06, 0.06 ], P.pants );
		tube( 'knee', 'ankle', s, [ 0.058, 0.058 ], [ 0.05, 0.05 ], P.pants );

	}

	// the head: a low sphere round its centre in each pose (hair or a cap on top, the face in front)
	{

		const W = 8, H = 5, r = [ 0.082, 0.105, 0.098 ];
		const hc = [ SIT.head, STAND.head ];
		const first = pos.length / 3;
		for ( let j = 0; j <= H; j ++ ) for ( let i = 0; i < W; i ++ ) {

			const th = j / H * Math.PI, ph = i / W * Math.PI * 2;
			const d = [ Math.sin( th ) * Math.cos( ph ), Math.cos( th ), Math.sin( th ) * Math.sin( ph ) ];
			const o = [ d[ 0 ] * r[ 0 ], d[ 1 ] * r[ 1 ], d[ 2 ] * r[ 2 ] ];
			vert( add( hc[ 0 ], o ), add( hc[ 1 ], o ), add( hc[ 0 ], o ), add( hc[ 1 ], o ), d, d, P.head );

		}

		for ( let j = 0; j < H; j ++ ) for ( let i = 0; i < W; i ++ ) {

			const a = first + j * W + i, b = first + j * W + ( i + 1 ) % W, c = a + W, d = b + W;
			if ( j > 0 ) index.push( a, b, c );
			if ( j < H - 1 ) index.push( b, d, c );

		}

		// a cap's brim (collapsed for the bareheaded)
		const brim = [ [ - 0.075, 0.055, - 0.06 ], [ 0.075, 0.055, - 0.06 ], [ 0.07, 0.045, - 0.16 ], [ - 0.07, 0.045, - 0.16 ] ].map( ( o ) => vert( add( hc[ 0 ], o ), add( hc[ 1 ], o ), add( hc[ 0 ], o ), add( hc[ 1 ], o ), [ 0, 1, 0 ], [ 0, 1, 0 ], P.brim ) );
		index.push( brim[ 0 ], brim[ 2 ], brim[ 1 ], brim[ 0 ], brim[ 3 ], brim[ 2 ] );

	}

	// the rally towel in the right hand: on the lap sitting, hanging from the hand held up
	{

		const h = ( pose, up ) => side( ( up && up.hand ) || pose.hand, 1 );
		const hs = h( SIT ), hst = h( STAND ), hsu = h( SIT, SIT_UP ), hstu = h( STAND, STAND_UP );
		const q = [];
		for ( const [ dx, dy, tip ] of [ [ - 0.14, 0, 0 ], [ 0.14, 0, 0 ], [ 0.14, - 0.32, 1 ], [ - 0.14, - 0.32, 1 ] ] ) {

			// sitting: the towel lies across the lap toward the knees
			const lap = add( hs, [ dx, 0.03, dy * 0.6 ] );
			const lapS = add( hst, [ dx * 0.5, dy * 0.8, 0.02 ] );
			const upS = add( hsu, [ dx, dy + 0.02, 0 ] );
			const upSt = add( hstu, [ dx, dy + 0.02, 0 ] );
			q.push( vert( lap, lapS, upS, upSt, [ 0, 0, - 1 ], [ 0, 0, - 1 ], P.towel + tip * 0.25 ) );

		}

		index.push( q[ 0 ], q[ 2 ], q[ 1 ], q[ 0 ], q[ 3 ], q[ 2 ] );

	}

	const g = new BufferGeometry();
	g.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
	g.setAttribute( 'normal', new Float32BufferAttribute( nrm, 3 ) );
	g.setAttribute( 'aStand', new Float32BufferAttribute( stand, 3 ) );
	g.setAttribute( 'aStandN', new Float32BufferAttribute( nrmS, 3 ) );
	g.setAttribute( 'aSitUp', new Float32BufferAttribute( sitUp, 3 ) );
	g.setAttribute( 'aStandUp', new Float32BufferAttribute( standUp, 3 ) );
	g.setAttribute( 'aPart', new Float32BufferAttribute( part, 1 ) );
	g.setIndex( index );
	g.computeBoundingSphere();
	return g;

}

function crowdMaterial() {

	const pose = /* wgsl */`
	// the fan's place in time t: standing, arms up (or clapping), jumping, a little sway
	let st = smoothstep( h.x * 0.92, h.x * 0.92 + 0.08, mat.stand );
	let up = smoothstep( h.y * 0.9, h.y * 0.9 + 0.1, mat.cheer );
	let clap = mat.clap * step( h.z, 0.8 ) * ( 1.0 - up ) * ( 0.3 + 0.08 * sin( t * 15.0 + h.w * 40.0 ) );
	// the rally towels twirled over their heads: each at his own pace (1.4 to 2.3 turns a second), the
	// phase rippling across the stands so neighbours are close but never together
	let hasTowel = fract( h.z * 5.0 ) <= 0.75;
	let tw = select( 0.0, smoothstep( fract( h.z * 13.0 ) * 0.9, fract( h.z * 13.0 ) * 0.9 + 0.1, mat.towel ), hasTowel );
	let a = max( max( up * ( 0.88 + 0.12 * sin( t * 6.0 + h.w * 30.0 ) ), clap ), tw );
	var p = mix( v.position + v.aSitUp * a, v.aStand + v.aStandUp * a, st );
	if ( v.aPart > 4.9 && v.aPart < 5.4 ) {
		let hand = mix( vec3f( ${ SIT_UP.hand.join( ', ' ) } ), vec3f( ${ STAND_UP.hand.join( ', ' ) } ), st );
		let th = t * ( 9.0 + 5.5 * fract( h.w * 17.0 ) ) + dot( seat.xz, vec2f( 0.31, 0.23 ) ) + h.x * 1.2;
		let rad = vec3f( cos( th ), 0.0, sin( th ) );
		let tan = vec3f( - sin( th ), 0.0, cos( th ) );
		let upP = v.position + v.aSitUp;
		let sd = sign( upP.x - ${ SIT_UP.hand[ 0 ] } );
		let tip = v.aPart > 5.1;
		let spin = hand + select( tan * sd * 0.07 + vec3f( 0.0, 0.03, 0.0 ), rad * 0.36 + tan * sd * 0.1 + vec3f( 0.0, 0.1 + 0.05 * sin( th * 2.0 ), 0.0 ), tip );
		// held still (up or on the lap) it just flaps a little
		if ( tip ) { p.x += sin( t * 9.0 + h.w * 50.0 ) * 0.16 * a; p.z += cos( t * 7.0 + h.z * 20.0 ) * 0.06 * a; }
		p = mix( p, spin, tw );
	}
	p.y += max( 0.0, sin( t * 8.0 + h.w * 30.0 ) ) * 0.14 * mat.jump * st;
	p.x += sin( t * 0.6 + h.z * 20.0 ) * 0.012 * ( p.y - 0.45 );
`;
	const mat = standard( {
		name: 'crowd', roughness: 0.8, side: 'double',
		uniforms: { stand: [ 'f32', 0.03 ], cheer: [ 'f32', 0 ], clap: [ 'f32', 0 ], jump: [ 'f32', 0 ], towel: [ 'f32', 0 ], time: [ 'f32', 0 ], dt: [ 'f32', 0.016 ], rain: [ 'f32', 0 ] },
		attributes: { aStand: 'vec3f', aStandN: 'vec3f', aSitUp: 'vec3f', aStandUp: 'vec3f', aPart: 'f32' },
		varyings: { vPart: 'f32', vSeed: 'vec4f', vHead: 'vec3f' },
		vertex: /* wgsl */`
	// who sits here: hashes of the seat's position
	let seat = ( v.model * vec4f( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
	let q = seat.xz * vec2f( 0.731, 1.137 ) + vec2f( seat.y * 0.37, 0.0 );
	let h = fract( sin( vec4f( dot( q, vec2f( 12.9898, 78.233 ) ), dot( q, vec2f( 39.346, 11.135 ) ), dot( q, vec2f( 73.156, 52.235 ) ), dot( q, vec2f( 27.519, 94.673 ) ) ) ) * 43758.5453 );
	var keep = true;
	// the bareheaded have no brim; only some have towels
	if ( v.aPart > 3.5 && v.aPart < 4.5 && fract( h.w * 7.0 ) > 0.45 ) { keep = false; }
	if ( v.aPart > 4.9 && v.aPart < 5.4 && fract( h.z * 5.0 ) > 0.75 ) { keep = false; }
	var t = mat.time;
	${ pose }
	let cur = p;
	t = mat.time - mat.dt;
	{
	${ pose.replace( /\bp\b/g, 'pp' ) }
	v.prevWorldPos = select( ( v.prevModel * vec4f( pp, 1.0 ) ).xyz, ( v.prevModel * vec4f( 0.0, 0.0, 0.0, 1.0 ) ).xyz, ! keep );
	}
	let lp = select( vec4f( 0.0, 0.0, 0.0, 1.0 ), vec4f( cur, 1.0 ), keep );
	v.useWorld = true;
	v.worldPos = ( v.model * lp ).xyz;
	v.worldNormal = normalize( ( v.model * vec4f( mix( v.normal, v.aStandN, st ), 0.0 ) ).xyz );
	o.vPart = v.aPart;
	o.vSeed = h;
	// the head's own frame (for the hair, the cap and the face)
	o.vHead = cur - mix( vec3f( 0.0, ${ SIT.head[ 1 ] }, ${ SIT.head[ 2 ] } ), vec3f( 0.0, ${ STAND.head[ 1 ] }, ${ STAND.head[ 2 ] } ), st );
`,
		surface: /* wgsl */`
	let part = i32( in.vs.vPart + 0.01 );
	let h = in.vs.vSeed;
	let g = fract( h * vec4f( 3.1, 5.7, 7.3, 11.9 ) + h.yzwx );
	// the jacket or jersey: mostly Phillies red, then white, black, grey, navy, maroon, powder blue, a few Rays
	var shirt = mix( vec3f( 0.22, 0.012, 0.016 ), vec3f( 0.36, 0.022, 0.028 ), g.x );
	let k = h.x * 0.37 + h.y * 0.63;
	let u = fract( k * 13.7 );
	if ( u > 0.46 ) { shirt = vec3f( 0.5, 0.49, 0.46 ) * mix( 0.8, 1.0, g.x ); }
	if ( u > 0.54 ) { shirt = vec3f( 0.014, 0.014, 0.016 ); }
	if ( u > 0.68 ) { shirt = vec3f( 0.12, 0.12, 0.125 ) * mix( 0.7, 1.4, g.x ); }
	if ( u > 0.77 ) { shirt = vec3f( 0.015, 0.022, 0.06 ); }
	if ( u > 0.84 ) { shirt = vec3f( 0.12, 0.018, 0.025 ); }
	if ( u > 0.89 ) { shirt = mix( vec3f( 0.12, 0.09, 0.05 ), vec3f( 0.05, 0.08, 0.05 ), g.y ); }
	if ( u > 0.93 ) { shirt = vec3f( 0.22, 0.33, 0.48 ); }
	if ( u > 0.97 ) { shirt = select( vec3f( 0.015, 0.04, 0.12 ), vec3f( 0.28, 0.45, 0.62 ), g.y > 0.5 ); }
	var rough = 0.85;
	// in the rain a good few in ponchos: clear plastic (the jacket under it, glossy) or red and white ones
	let poncho = fract( h.z * 9.3 ) < mat.rain * 0.28;
	if ( poncho ) { shirt = select( mix( shirt, vec3f( 0.42 ), 0.3 ), select( vec3f( 0.6 ), vec3f( 0.36, 0.02, 0.03 ), g.z > 0.4 ), g.w > 0.7 ); rough = 0.22; }
	let pants = select( select( vec3f( 0.03, 0.045, 0.1 ), vec3f( 0.28, 0.22, 0.15 ), g.y > 0.72 ), vec3f( 0.02 ), g.y > 0.86 );
	let si = fract( h.w * 3.3 );
	var skin = vec3f( 0.55, 0.34, 0.23 );
	if ( si > 0.55 ) { skin = vec3f( 0.42, 0.25, 0.16 ); }
	if ( si > 0.75 ) { skin = vec3f( 0.25, 0.13, 0.07 ); }
	if ( si > 0.88 ) { skin = vec3f( 0.13, 0.07, 0.04 ); }
	let hair = select( select( vec3f( 0.02, 0.015, 0.01 ), vec3f( 0.12, 0.07, 0.03 ), g.z > 0.55 ), vec3f( 0.3, 0.28, 0.26 ), g.z > 0.88 );
	let capped = fract( h.w * 7.0 ) <= 0.45;
	let capC = select( select( vec3f( 0.02, 0.03, 0.1 ), vec3f( 0.72 ), g.w > 0.85 ), vec3f( 0.42, 0.015, 0.02 ), g.w < 0.7 );
	var c = shirt;
	if ( part == 1 ) { c = pants; rough = 0.9; }
	if ( part == 2 ) { c = skin; rough = 0.6; }
	if ( part == 3 ) {
		let hd = in.vs.vHead;
		c = skin; rough = 0.6;
		// hair on the back and the top, a cap over it, a poncho's hood
		if ( hd.y > 0.03 - 0.06 * smoothstep( -0.02, 0.06, hd.z ) ) { c = hair; rough = 0.7; }
		if ( capped && hd.y > 0.025 ) { c = capC; }
		if ( poncho && ( hd.y > 0.0 || hd.z > 0.02 ) ) { c = shirt; rough = 0.25; }
		// the eyes and brows: a darker band across the face
		if ( hd.z < -0.07 && abs( hd.y - 0.01 ) < 0.012 && ! capped ) { c = c * 0.55; }
	}
	if ( part == 4 ) { c = capC; }
	if ( part == 5 ) { c = vec3f( 0.8, 0.79, 0.76 ); rough = 0.9; }
	// lit by the stands' fill after dark, as the seats are
	s.albedo = c;
	s.roughness = rough;
	s.emissive = c * smoothstep( 0.15, 0.7, frame.night ) * 0.12;
`,
	} );
	mat.underwaterLighting = 'none';
	return mat;

}

export class Crowd {

	constructor() {

		this.geometry = fanGeometry();
		this.material = crowdMaterial();
		this.meshes = [];
		this.count = 0;
		this.time = 0;
		this._mood = { stand: 0.03, cheer: 0, clap: 0, jump: 0, towel: 0.03 };

	}

	// is there someone in this seat (by its matrix)? A few seats are empty
	occupied( m ) {

		const e = m.elements;
		const s = Math.sin( e[ 12 ] * 12.9898 + e[ 14 ] * 78.233 + e[ 13 ] * 3.7 ) * 43758.5453;
		return s - Math.floor( s ) > 0.04;

	}

	// a crowd chunk on these seats (their matrices)
	addChunk( group, mats, name ) {

		if ( ! mats.length ) return;
		const mesh = new InstancedMesh( this.geometry, this.material, mats.length );
		mats.forEach( ( m, i ) => mesh.setMatrixAt( i, m ) );
		mesh.computeBoundingBox();
		mesh.computeBoundingSphere();
		mesh.name = name + '-crowd';
		mesh.receiveShadow = true;
		mesh.castShadow = false;
		group.add( mesh );
		this.meshes.push( mesh );
		this.count += mats.length;

	}

	// how the crowd feels about the game at the replay's time (a function of the timeline, so scrubbing
	// shows the right thing): up on two strikes and two outs when the Phillies pitch, on their feet for a
	// rally, everyone up and jumping at the end
	mood( d ) {

		const seg = d.segmentAt( d.t );
		const m = { stand: 0.03, cheer: 0, clap: 0.05, jump: 0, towel: 0.03 };
		if ( ! seg ) return m;
		const s = seg.snap || {}, lt = d.t - seg.t0;
		const phPitch = s.half === 'top', late = s.inning >= 9;
		const two = ( s.strikes || 0 ) >= 2, outs2 = ( s.outs || 0 ) >= 2;
		if ( seg.kind === 'pitch' || seg.kind === 'walkup' ) {

			if ( phPitch ) {

				if ( two ) m.stand = 0.12 + ( outs2 ? 0.3 : 0 ) + ( late ? 0.4 : 0 ), m.clap = 0.6, m.towel = 0.3 + ( outs2 ? 0.25 : 0 ) + ( late ? 0.4 : 0 );
				else if ( late ) m.stand = 0.3, m.clap = 0.4, m.towel = 0.5;

			} else {

				// the Phillies batting: runners on, clapping
				const on = ( s.bases || [] ).filter( Boolean ).length;
				m.clap = 0.2 + 0.2 * on;
				if ( on >= 2 ) m.stand = 0.15;

			}

		}

		if ( seg.kind === 'inplay' || seg.kind === 'result' ) {

			const r = seg.ev?.result || seg.snap?.result;
			const type = r?.type || '';
			const hit = /single|double|triple|home_run/.test( type ), scored = ( r?.rbi || 0 ) > 0 || seg.scored > 0;
			const good = s.half === 'bottom' ? ( hit || scored ) : ! hit;
			if ( good ) {

				const big = scored || /home_run|double|triple/.test( type ) || ( s.half === 'top' && outs2 );
				const k = Math.min( 1, lt / 1.2 );
				m.stand = Math.max( m.stand, ( big ? 0.85 : 0.35 ) * k );
				m.cheer = ( big ? 0.6 : 0.2 ) * k;
				m.clap = 0.6;
				m.towel = ( big ? 0.85 : 0.45 ) * k;

			}

		}

		if ( seg.kind === 'celebrate' ) {

			m.stand = 1;
			m.cheer = 0.9;
			m.jump = 1;
			m.towel = 1;

		}

		return m;

	}

	update( d, dt, rain = 0 ) {

		this.time += dt;
		const target = d ? this.mood( d ) : this._mood;
		// the crowd takes a moment to rise and to settle
		const k = 1 - Math.exp( - dt * 2.5 );
		for ( const key of [ 'stand', 'cheer', 'clap', 'jump', 'towel' ] ) this._mood[ key ] += ( target[ key ] - this._mood[ key ] ) * k;
		const U = this.material.uniforms;
		U.stand.value = this._mood.stand;
		U.cheer.value = this._mood.cheer;
		U.clap.value = this._mood.clap;
		U.jump.value = this._mood.jump;
		U.towel.value = this._mood.towel;
		U.time.value = this.time;
		U.dt.value = dt;
		U.rain.value = rain;

	}

}

void Vector3;
