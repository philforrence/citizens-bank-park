// The plaza folk's skeleton: eleven rigid bones posed by a handful of angles, the same forward kinematics
// here (for building props into a bone's rest frame) and in the vertex shader (FOLK_FK below).
//
// The rest pose: standing, facing -z, arms hanging, origin on the ground between the feet, ~1.75 m.
// Angles (radians): arm flex raises the arm forward, abduct out to the side, elbow bends the forearm
// forward and up; hip flex swings the thigh forward, knee bends the shin back; torso lean forward,
// twist left; head yaw left, pitch up; spread takes the thighs apart (astride a horse).

export const BONE = { pelvis: 0, torso: 1, head: 2, upperL: 3, foreL: 4, upperR: 5, foreR: 6, thighL: 7, shinL: 8, thighR: 9, shinR: 10 };

export const J = {
	waist: [ 0, 0.95, 0 ],
	neck: [ 0, 1.5, 0 ],
	head: [ 0, 1.64, 0 ],
	shoulder: [ 0.19, 1.42, 0 ],
	elbow: [ 0.21, 1.15, 0 ],
	wrist: [ 0.22, 0.89, 0 ],
	hand: [ 0.22, 0.8, 0 ],
	hip: [ 0.1, 0.93, 0 ],
	knee: [ 0.1, 0.51, 0 ],
	ankle: [ 0.1, 0.08, 0 ],
};

// a pose: every angle, and a bob of the whole body (m)
export function pose( o = {} ) {

	return {
		flexL: 0, abductL: 0.06, elbowL: 0.12, flexR: 0, abductR: 0.06, elbowR: 0.12,
		lean: 0, twist: 0, yaw: 0, pitch: 0,
		hipL: 0, kneeL: 0, hipR: 0, kneeR: 0, bob: 0, spread: 0, ...o,
	};

}

// 3 x 3 row-major rotations, and rigid transforms { m, t }: p' = m p + t
const rx = ( a ) => {

	const c = Math.cos( a ), s = Math.sin( a );
	return [ 1, 0, 0, 0, c, - s, 0, s, c ];

};
const ry = ( a ) => {

	const c = Math.cos( a ), s = Math.sin( a );
	return [ c, 0, s, 0, 1, 0, - s, 0, c ];

};
const rz = ( a ) => {

	const c = Math.cos( a ), s = Math.sin( a );
	return [ c, - s, 0, s, c, 0, 0, 0, 1 ];

};
const mm = ( a, b ) => {

	const o = new Array( 9 );
	for ( let i = 0; i < 3; i ++ ) for ( let j = 0; j < 3; j ++ ) o[ i * 3 + j ] = a[ i * 3 ] * b[ j ] + a[ i * 3 + 1 ] * b[ 3 + j ] + a[ i * 3 + 2 ] * b[ 6 + j ];
	return o;

};
export const mv = ( m, v ) => [ m[ 0 ] * v[ 0 ] + m[ 1 ] * v[ 1 ] + m[ 2 ] * v[ 2 ], m[ 3 ] * v[ 0 ] + m[ 4 ] * v[ 1 ] + m[ 5 ] * v[ 2 ], m[ 6 ] * v[ 0 ] + m[ 7 ] * v[ 1 ] + m[ 8 ] * v[ 2 ] ];
const about = ( R, c ) => {

	const Rc = mv( R, c );
	return { m: R, t: [ c[ 0 ] - Rc[ 0 ], c[ 1 ] - Rc[ 1 ], c[ 2 ] - Rc[ 2 ] ] };

};
const compose = ( a, b ) => {

	const t = mv( a.m, b.t );
	return { m: mm( a.m, b.m ), t: [ t[ 0 ] + a.t[ 0 ], t[ 1 ] + a.t[ 1 ], t[ 2 ] + a.t[ 2 ] ] };

};
const side = ( s, p ) => [ p[ 0 ] * s, p[ 1 ], p[ 2 ] ];

// the transform of bone b in pose q
export function boneXf( b, q ) {

	const pelvis = { m: [ 1, 0, 0, 0, 1, 0, 0, 0, 1 ], t: [ 0, q.bob || 0, 0 ] };
	if ( b === BONE.pelvis ) return pelvis;
	if ( b >= BONE.thighL ) {

		const s = b <= BONE.shinL ? - 1 : 1;
		const hip = s < 0 ? q.hipL : q.hipR, knee = s < 0 ? q.kneeL : q.kneeR;
		const thigh = compose( pelvis, about( mm( rz( s * ( q.spread || 0 ) ), rx( hip ) ), side( s, J.hip ) ) );
		if ( b === BONE.thighL || b === BONE.thighR ) return thigh;
		return compose( thigh, about( rx( - knee ), side( s, J.knee ) ) );

	}

	const torso = compose( pelvis, about( mm( ry( q.twist ), rx( - q.lean ) ), J.waist ) );
	if ( b === BONE.torso ) return torso;
	if ( b === BONE.head ) return compose( torso, about( mm( ry( q.yaw ), rx( q.pitch ) ), J.neck ) );
	const s = b <= BONE.foreL ? - 1 : 1;
	const flex = s < 0 ? q.flexL : q.flexR, abd = s < 0 ? q.abductL : q.abductR, elb = s < 0 ? q.elbowL : q.elbowR;
	const upper = compose( torso, about( mm( rz( s * abd ), rx( flex ) ), side( s, J.shoulder ) ) );
	if ( b === BONE.upperL || b === BONE.upperR ) return upper;
	return compose( upper, about( rx( elb ), side( s, J.elbow ) ) );

}

// a point posed, and a posed point back into the bone's rest frame
export function apply( xf, p ) {

	const v = mv( xf.m, p );
	return [ v[ 0 ] + xf.t[ 0 ], v[ 1 ] + xf.t[ 1 ], v[ 2 ] + xf.t[ 2 ] ];

}

export function unapply( xf, p ) {

	// the inverse of a rotation is its transpose
	const m = xf.m, d = [ p[ 0 ] - xf.t[ 0 ], p[ 1 ] - xf.t[ 1 ], p[ 2 ] - xf.t[ 2 ] ];
	return [ m[ 0 ] * d[ 0 ] + m[ 3 ] * d[ 1 ] + m[ 6 ] * d[ 2 ], m[ 1 ] * d[ 0 ] + m[ 4 ] * d[ 1 ] + m[ 7 ] * d[ 2 ], m[ 2 ] * d[ 0 ] + m[ 5 ] * d[ 1 ] + m[ 8 ] * d[ 2 ] ];

}

export function unrotate( xf, n ) {

	const m = xf.m;
	return [ m[ 0 ] * n[ 0 ] + m[ 3 ] * n[ 1 ] + m[ 6 ] * n[ 2 ], m[ 1 ] * n[ 0 ] + m[ 4 ] * n[ 1 ] + m[ 7 ] * n[ 2 ], m[ 2 ] * n[ 0 ] + m[ 5 ] * n[ 1 ] + m[ 8 ] * n[ 2 ] ];

}

const f = ( v ) => v.map( ( x ) => x.toFixed( 4 ) ).join( ', ' );

// The same in WGSL: FolkPose's angles in, a bone's transform out (mat3x3f takes columns: a row-major
// rotation above is the transpose of these constructors' argument order)
export const FOLK_FK = /* wgsl */`
struct FolkXf { m: mat3x3f, t: vec3f };
struct FolkPose {
	flexL: f32, abductL: f32, elbowL: f32, flexR: f32, abductR: f32, elbowR: f32,
	lean: f32, twist: f32, yaw: f32, pitch: f32, hipL: f32, kneeL: f32, hipR: f32, kneeR: f32, bob: f32, sh: f32, spread: f32,
};
fn folkRx( a: f32 ) -> mat3x3f { let c = cos( a ); let s = sin( a ); return mat3x3f( 1.0, 0.0, 0.0, 0.0, c, s, 0.0, - s, c ); }
fn folkRy( a: f32 ) -> mat3x3f { let c = cos( a ); let s = sin( a ); return mat3x3f( c, 0.0, - s, 0.0, 1.0, 0.0, s, 0.0, c ); }
fn folkRz( a: f32 ) -> mat3x3f { let c = cos( a ); let s = sin( a ); return mat3x3f( c, s, 0.0, - s, c, 0.0, 0.0, 0.0, 1.0 ); }
fn folkAbout( R: mat3x3f, c: vec3f ) -> FolkXf { return FolkXf( R, c - R * c ); }
fn folkMul( a: FolkXf, b: FolkXf ) -> FolkXf { return FolkXf( a.m * b.m, a.m * b.t + a.t ); }
// q.sh: how much wider the shoulders are (a big man in a big coat), which moves the arms out
fn folkBone( b: u32, q: FolkPose ) -> FolkXf {
	let pelvis = FolkXf( mat3x3f( 1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0 ), vec3f( 0.0, q.bob, 0.0 ) );
	if ( b == 0u ) { return pelvis; }
	if ( b >= 7u ) {
		let s = select( 1.0, -1.0, b <= 8u );
		let hip = select( q.hipR, q.hipL, b <= 8u );
		let knee = select( q.kneeR, q.kneeL, b <= 8u );
		let thigh = folkMul( pelvis, folkAbout( folkRz( s * q.spread ) * folkRx( hip ), vec3f( s * ${ J.hip[ 0 ] }, ${ J.hip[ 1 ] }, 0.0 ) ) );
		if ( b == 7u || b == 9u ) { return thigh; }
		return folkMul( thigh, folkAbout( folkRx( - knee ), vec3f( s * ${ J.knee[ 0 ] }, ${ J.knee[ 1 ] }, 0.0 ) ) );
	}
	let torso = folkMul( pelvis, folkAbout( folkRy( q.twist ) * folkRx( - q.lean ), vec3f( ${ f( J.waist ) } ) ) );
	if ( b == 1u ) { return torso; }
	if ( b == 2u ) { return folkMul( torso, folkAbout( folkRy( q.yaw ) * folkRx( q.pitch ), vec3f( ${ f( J.neck ) } ) ) ); }
	let s = select( 1.0, -1.0, b <= 4u );
	let flex = select( q.flexR, q.flexL, b <= 4u );
	let abd = select( q.abductR, q.abductL, b <= 4u );
	let elb = select( q.elbowR, q.elbowL, b <= 4u );
	let upper = folkMul( torso, folkAbout( folkRz( s * abd ) * folkRx( flex ), vec3f( s * ( ${ J.shoulder[ 0 ] } + q.sh ), ${ J.shoulder[ 1 ] }, 0.0 ) ) );
	if ( b == 3u || b == 5u ) { return upper; }
	return folkMul( upper, folkAbout( folkRx( elb ), vec3f( s * ( ${ J.elbow[ 0 ] } + q.sh ), ${ J.elbow[ 1 ] }, 0.0 ) ) );
}
`;
