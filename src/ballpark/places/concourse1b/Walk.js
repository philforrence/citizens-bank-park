import { Walkway } from '../Concourse3BKit.js';

// The first base concourse's own coordinates (Concourse1B.js): W2's walkway (Concourse3BKit.Walkway)
// turned round, so s runs from behind home plate (s = 0 at x = 0) toward first base and on round to the
// right field corner (s ~ 152, behind 108), and d is W2's: metres out from the field level's front line
// (the drink rail at 30.1, the columns at 40.9, the stands' counters at 44.8). at() gives the point and
// the walkway's directions there: u along it (toward first), n toward the field.
export class Walk1B {

	constructor( path ) {

		this.W = new Walkway( path );
		this.sMax = this.W.s0 - 0.5;

	}

	at( s, d ) {

		const a = this.W.at( - s, d );
		a.ux = - a.ux;
		a.uz = - a.uz;
		return a;

	}

	toSD( x, z ) {

		const [ s, d ] = this.W.toSD( x, z );
		return [ - s, d ];

	}

	// the yaw that faces along ( dx, dz ) (the cast faces -z at yaw 0)
	static yaw( dx, dz ) {

		return Walkway.yaw( dx, dz );

	}

}
