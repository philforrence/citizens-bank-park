import { Group } from '../../engine/index.js';
import { tarpState } from '../game/TarpPlan.js';
import { ANNOUNCE } from '../game/Suspension.js';
import { Roll } from './rituals/Roll.js';
import { Seats } from './rituals/Seats.js';
import { Press } from './rituals/Press.js';

// The night's rituals and the celebration, on the replay's timeline. The people on the field (the
// grounds crew, the umpires, the players, the coaches) are the players' rig, posed by the Director from
// game/Suspension.js and game/Celebration.js; this place builds the things round them and ties the rest
// of the park in:
//
//   rituals/Roll.js     the tarp's roll off the wall: swung out, pushed across, thinning to the core;
//                       the canvas cover left heaped along the wall
//   rituals/Seats.js    the stands emptying into the rain on the 27th and filling again on the 29th
//   rituals/Press.js    the photographers, the TV handhelds and the boom mic out of the wells at the
//                       last out, round the pile and then after their men
//
// Everything is a function of director.t (director.night() for which night it is), so scrubbing agrees.
export default class Rituals {

	constructor( { app, field, bowl } ) {

		this.app = app;
		this.field = field;
		this.group = new Group();
		this.group.name = 'rituals';
		field.group.add( this.group );
		this.roll = new Roll( this.group );
		this.seats = new Seats( { bowl, field } );
		this.press = new Press( { group: this.group } );
		this._lastT = null;

	}

	update( dt, director ) {

		if ( ! director?.night ) return;
		const t = director.t;
		const jumped = this._lastT === null || Math.abs( t - this._lastT ) > 1 + dt * ( director.speed || 1 );
		this._lastT = t;
		const N = director.night( t );
		this.roll.update( tarpState( N ) );
		this.seats.update( N, ANNOUNCE, dt, jumped );
		const seg = director.segmentAt( t );
		const cel = seg.kind === 'celebrate' ? t - seg.t0 : null;
		this.press.update( cel, director.actors, jumped ? 0 : dt );

	}

}
