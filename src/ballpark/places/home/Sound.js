import { Vector3 } from '../../../engine/index.js';
import { GEAR } from './Gear.js';

// What you hear behind home plate, each from where it is (GameSound.spot: panned, quieter with
// distance, through the park's reverb): the vendors' calls coming down the aisles, a fan hailing one,
// the change handed back, a bag of peanuts landing, the seats' clack as a row gets up to let someone by
// and "excuse me, sorry", "down in front!" at a sign held too high, the usher's "can I see your
// tickets?", a kid's "we're on TV!", a flip phone snapped shut, a point-and-shoot's flash whining up
// and firing, a poncho's crinkle. Heard close only: from the TV cameras out in center field it's all
// under the crowd, and nothing's made past 45 m.
//
// The recordings: public/audio/places/home/ (CREDITS.md there): the calls and voices are Piper TTS
// (public-domain and CC0 voices), the small sounds synthesized; tools/audio/build-home.py rebuilds them.

const DIR = 'audio/places/home/';
const FILES = {
	beer: [ 'beer-1', 'beer-2', 'beer-3' ],
	hotdogs: [ 'hotdogs-1', 'hotdogs-2' ],
	cocoa: [ 'hot-chocolate-1', 'hot-chocolate-2' ],
	peanuts: [ 'peanuts-1', 'peanuts-2' ],
	cotton: [ 'cotton-candy-1', 'cotton-candy-2' ],
	lemonade: [ 'lemonade-1' ],
	hailBeer: [ 'fan-beer-man' ],
	hailDogs: [ 'fan-two-dogs' ],
	down: [ 'down-in-front-1', 'down-in-front-2' ],
	excuse: [ 'excuse-me' ],
	thanks: [ 'thank-you' ],
	kidTV: [ 'kid-on-tv' ],
	usher: [ 'usher-tickets' ],
	clack: [ 'seat-clack-1', 'seat-clack-2', 'seat-clack-3-squeak' ],
	bag: [ 'peanut-bag' ],
	coins: [ 'coins-bill' ],
	poncho: [ 'poncho' ],
	flash: [ 'camera-flash' ],
	phone: [ 'flip-phone' ],
};
const CALLS = { [ GEAR.beer ]: 'beer', [ GEAR.hotdogs ]: 'hotdogs', [ GEAR.cocoa ]: 'cocoa', [ GEAR.peanuts ]: 'peanuts', [ GEAR.cotton ]: 'cotton' };
const HEARD = 45;

export class HomeSound {

	constructor( app, field ) {

		this.S = app?.sound || null;
		this.app = app;
		this.field = field;
		this._v = new Vector3();
		this.live = 0;
		if ( this.S?.sample ) for ( const list of Object.values( FILES ) ) for ( const n of list ) this.S.sample( 'home-' + n, DIR + n + '.mp3' );

	}

	// is a field point near enough the listener to make a sound?
	_near( x, z ) {

		const cam = this.app?.camera;
		if ( ! cam || ! this.S?.ctx ) return false;
		const w = this.field.toWorld( x, z );
		return Math.hypot( w.x - cam.position.x, w.z - cam.position.z ) < HEARD;

	}

	_play( kind, x, y, z, o = {} ) {

		if ( ! this.S?.spot || ! this._near( x, z ) ) return;
		const list = FILES[ kind ];
		const name = 'home-' + list[ Math.floor( Math.random() * list.length ) ];
		const w = this.field.toWorld( x, z );
		this.S.spot( name, this._v.set( w.x, this.field.y0 + y, w.z ), { vol: 0.8, rate: 0.96 + 0.08 * Math.random(), ref: 3.5, max: 60, ...o } );

	}

	// a vendor's call, from his mouth
	call( w, kind ) {

		const k = CALLS[ kind ];
		if ( k ) this._play( k, w.p.x, w.p.y + 1.6, w.p.z, { vol: 1.0, ref: 5 } );

	}

	// a fan calling a vendor over
	hail( fan, kind ) {

		if ( kind === GEAR.beer ) this._play( 'hailBeer', fan.p.x, fan.p.y + 1.2, fan.p.z, { vol: 0.6 } );
		else if ( kind === GEAR.hotdogs ) this._play( 'hailDogs', fan.p.x, fan.p.y + 1.2, fan.p.z, { vol: 0.6 } );

	}

	// someone at a point: say / do `kind` there
	at( kind, p, o = {} ) {

		this._play( kind, p.x, p.y + ( o.h ?? 1.2 ), p.z, o );

	}

}
