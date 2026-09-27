import { Group } from '../../engine/index.js';
import { tarpState } from '../game/TarpPlan.js';
import { Roll } from './rituals/Roll.js';

// The night's rituals and the celebration, on the replay's timeline. The people on the field (the
// grounds crew, the umpires, the players, the coaches) are the players' rig, posed by the Director from
// game/Suspension.js and game/Celebration.js; this place builds the things round them and ties the rest
// of the park in:
//
//   rituals/Roll.js     the tarp's roll off the wall: swung out, pushed across, thinning to the core;
//                       the canvas cover left heaped along the wall
//
// Everything is a function of director.t (director.night() for which night it is), so scrubbing agrees.
export default class Rituals {

	constructor( { app, field } ) {

		this.app = app;
		this.field = field;
		this.group = new Group();
		this.group.name = 'rituals';
		field.group.add( this.group );
		this.roll = new Roll( this.group );

	}

	update( dt, director ) {

		if ( ! director?.night ) return;
		const N = director.night( director.t );
		this.roll.update( tarpState( N ) );

	}

}
