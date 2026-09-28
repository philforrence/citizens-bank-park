import { LEVELS } from '../../layout.js';

// The left field corner's frame of reference (LeftField.js): the scoreboard's own, as Landmarks builds it
// (Landmarks.harrys.g): its origin at the foot of the board 452 ft out on a bearing 36 degrees left of
// center, local -z toward home plate, +x toward the left field pole, y up from the field. Harry the K's
// is built in it: its brick house 33.6 m wide from x -18.8 to 14.8, its face at z = -3 (9 m deep behind
// it), from the street (the main concourse, 7 m) up under the board; the patio's floor at 15.4 m.
//
//   const F = new Frame( landmarks.harrys.g )
//   F.field( lx, lz )        [ x, z ] in the field frame
//   F.yaw( localYaw )        a cast person's yaw in the field frame (0 faces local -z: home plate)
//   F.local( x, z )          back from the field frame
export const STREET = LEVELS.mainConcourse;

export class Frame {

	constructor( g ) {

		this.x = g.position.x;
		this.z = g.position.z;
		this.th = g.rotation.y;
		this.c = Math.cos( this.th );
		this.s = Math.sin( this.th );

	}

	field( lx, lz ) {

		return [ this.x + lx * this.c + lz * this.s, this.z - lx * this.s + lz * this.c ];

	}

	local( x, z ) {

		const dx = x - this.x, dz = z - this.z;
		return [ dx * this.c - dz * this.s, dx * this.s + dz * this.c ];

	}

	yaw( a = 0 ) {

		return a + this.th;

	}

	// a direction ( lx, lz ) in the field frame
	dir( lx, lz ) {

		return [ lx * this.c + lz * this.s, - lx * this.s + lz * this.c ];

	}

}
