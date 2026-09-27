import { Vector3 } from '../../../engine/index.js';
import { GEAR } from './Gear.js';

// What you hear behind home plate, each from where it is (GameSound.spot: panned, quieter with
// distance): the vendors' calls coming down the aisles, a fan hailing one, the seats' clack as a row gets
// up. Heard close only: from the TV cameras out in center field it's all under the crowd.
//
// The calls are small recordings in public/audio/places/home/ (see CREDITS.md there); the beer man's is
// the park's own (audio/ballpark/vendor-beer.mp3).

// kind -> the calls' sample names
const CALLS = {
	[ GEAR.beer ]: [ 'vendor-beer' ],
	[ GEAR.hotdogs ]: [],
	[ GEAR.cocoa ]: [],
	[ GEAR.peanuts ]: [],
	[ GEAR.cotton ]: [],
};

export class HomeSound {

	constructor( app, field ) {

		this.S = app?.sound || null;
		this.field = field;
		this._v = new Vector3();
		this.calls = CALLS;

	}

	// world position of a field point
	_at( x, y, z ) {

		const w = this.field.toWorld( x, z );
		return this._v.set( w.x, this.field.y0 + y, w.z );

	}

	// a vendor's call, from his mouth
	call( w, kind ) {

		const S = this.S, names = this.calls[ kind ];
		if ( ! S?.spot || ! names?.length ) return;
		const name = names[ Math.floor( Math.random() * names.length ) ];
		S.spot( name, this._at( w.p.x, w.p.y + 1.6, w.p.z ), { vol: 0.9, rate: 0.96 + 0.08 * Math.random(), ref: 4, max: 70 } );

	}

	// a fan calling a vendor over
	hail( fan ) {

		void fan;

	}

}
