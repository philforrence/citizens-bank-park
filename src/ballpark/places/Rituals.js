import { Group } from '../../engine/index.js';
import { tarpState } from '../game/TarpPlan.js';
import { ANNOUNCE } from '../game/Suspension.js';
import { CEL, LAP_SPEED, lapAt, trophyHold, rubberHold, flagHold, RUBBER } from '../game/Celebration.js';
import { Roll } from './rituals/Roll.js';
import { Seats } from './rituals/Seats.js';
import { Press } from './rituals/Press.js';
import { Fireworks } from './rituals/Fireworks.js';
import { Motors, MOTORS, trackPoint } from './rituals/Motors.js';
import { FireworksSound } from './rituals/FireworksSound.js';
import { Stage } from './rituals/Stage.js';
import { Party } from './rituals/Party.js';
import { Flag } from './rituals/Flag.js';

// The night's rituals and the celebration, on the replay's timeline. The people on the field (the
// grounds crew, the umpires, the players, the coaches) are the players' rig, posed by the Director from
// game/Suspension.js and game/Celebration.js; this place builds the things round them and ties the rest
// of the park in:
//
//   rituals/Roll.js      the tarp's roll off the wall: swung out, pushed across, thinning to the core;
//                        the canvas cover left heaped along the wall
//   rituals/Seats.js     the stands emptying into the rain on the 27th and filling again on the 29th
//   rituals/Press.js     the photographers, the TV handhelds and the boom mic out of the wells at the
//                        last out, round the pile and then after their men
//   rituals/Fireworks.js the gerbs off the scoreboard and the Liberty Bell, the shells over the outfield
//   rituals/Motors.js    the police motor officers riding in round the warning track, their white
//                        Harleys; one leads the lap
//   rituals/Stage.js     the presentation's stage going up on the first base side of second, the barriers,
//                        the MVP's red Camaro, the Commissioner's Trophy
//   rituals/Party.js     Selig, Montgomery, Giles, Gillick, FOX's Zelasko and Myers on the stage; Harry
//                        Kalas singing "High Hopes" in front of the first base stands
//   rituals/Flag.js      the red flag on the lap, Moyer's pitching rubber and the hole it left
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
		this.fireworks = new Fireworks( this.group );
		this.motors = new Motors( this.group );
		this.stage = new Stage( this.group );
		this.party = new Party( { group: this.group } );
		this.flag = new Flag( this.group );
		this._lastT = null;
		// the lap's lead bike: the one parked nearest the lap's route, and how far along the route it is
		const i = MOTORS.length - 1, park = trackPoint( MOTORS[ i ].deg, 2.6 );
		let best = 0, bd = 1e9;
		for ( let s = 0; s < 260; s += 1 ) {

			const w = lapAt( s ), d = Math.hypot( w.p[ 0 ] - park[ 0 ], w.p[ 1 ] - park[ 1 ] );
			if ( d < bd ) { bd = d; best = s; }

		}

		this.lead = { i, s: best };

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
		// the presentation's party (and whether one of them has the trophy), then the stage and the trophy
		const held = this.party.update( cel );
		this.stage.update( cel, cel != null ? ( trophyHold( director, cel ) || held ) : null );
		this.flag.update( cel != null ? flagHold( director, cel ) : null, cel != null ? rubberHold( director, cel ) : null, RUBBER, t );
		// the cameras: after their men, and some after Harry once he sings
		this.press.update( cel, director.actors, jumped ? 0 : dt, this.party.kalasAt );
		this.fireworks.update( cel );
		// (the sound's made once the app has it: it's built after the places)
		if ( ! this.fwSound && this.app?.sound ) this.fwSound = new FireworksSound( { sound: this.app.sound, field: this.field, plan: this.fireworks.plan } );
		this.fwSound?.update( cel, director.playing && ! jumped, this.app?.camera?.position );
		this.motors.update( cel, this._lapBike( cel ) );

	}

	// the bike that leads the lap: parked until the flag's near, then just ahead of it round the track
	_lapBike( cel ) {

		if ( cel == null || cel < CEL.lap[ 0 ] ) return null;
		const front = Math.max( 0, ( cel - CEL.lap[ 0 ] - 9 ) * LAP_SPEED ) + 9;
		if ( front < this.lead.s ) return null;
		const w = lapAt( front ), w2 = lapAt( front + 0.5 );
		const lap = [];
		lap[ this.lead.i ] = { x: w.p[ 0 ], z: w.p[ 1 ], yaw: Math.atan2( - ( w2.p[ 0 ] - w.p[ 0 ] ), - ( w2.p[ 1 ] - w.p[ 1 ] ) ), moving: ! w.end };
		return lap;

	}

}
