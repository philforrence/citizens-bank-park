import { Vector3 } from '../../../engine/index.js';

// What Harry the K's sounds like (LeftField.js), through the park's sound (GameSound.sample / spot: heard
// from where it is, panned, quieter with distance; S's soundscape gives every spot the air and the room):
//
//   the rooms' hubbub: a bar full of people talking over each other, glasses set down, under the upstairs
//     bar's ceiling and out of the lower level's front (tools/audio/leftfield-calls.py: voiced lines, far off
//     in a hard room, looping)
//   the patio heaters' propane roar (made here), heard as you pass them
//   the voices (Piper TTS): Vinnie and Kitty behind the bars, Gloria seating a table, the servers, the Delco
//     boys on Crawford in the bottom halves and 'EVA!' at Longoria, Marcy's one 'Let's go Rays!', Lou
//     shushing the table for Harry on the radio
//
// One-shots only near the camera (further off they'd be lost in the crowd, and each is a few audio nodes).
const DIR = 'audio/places/leftfield/';
const CALLS = [ 'vinnie-1', 'vinnie-2', 'kitty-1', 'kitty-2', 'gloria-1', 'server-1', 'server-2', 'delco-crawford-1', 'delco-crawford-2', 'delco-eva', 'marcy-1', 'lou-1' ];
const NEAR = 30;
const LONGORIA = '446334';

function rand( seed ) {

	let a = seed >>> 0;
	return () => {

		a = ( a + 0x6D2B79F5 ) >>> 0;
		let t = a;
		t = Math.imul( t ^ ( t >>> 15 ), t | 1 );
		t ^= t + Math.imul( t ^ ( t >>> 7 ), t | 61 );
		return ( ( t ^ ( t >>> 14 ) ) >>> 0 ) / 4294967296 * 2 - 1;

	};

}

// a patio heater: the propane's roar (low, breathy), a flutter in it, looping
export const heaterRoar = ( ctx ) => {

	const sr = ctx.sampleRate, n = Math.floor( 3 * sr );
	const b = ctx.createBuffer( 1, n, sr ), d = b.getChannelData( 0 );
	const r = rand( 17 );
	let lo = 0, hi = 0;
	for ( let i = 0; i < n; i ++ ) {

		const w = r();
		lo += ( w - lo ) * 0.02;
		hi += ( w - hi ) * 0.35;
		const flutter = 0.85 + 0.15 * Math.sin( i / sr * 2 * Math.PI * 7.3 ) * Math.sin( i / sr * 2 * Math.PI * 0.9 );
		d[ i ] = ( lo * 2.2 + ( w - hi ) * 0.25 ) * flutter;

	}

	const f = 512;
	for ( let i = 0; i < f; i ++ ) {

		d[ i ] *= i / f;
		d[ n - 1 - i ] *= i / f;

	}

	let p = 0;
	for ( let i = 0; i < n; i ++ ) p = Math.max( p, Math.abs( d[ i ] ) );
	for ( let i = 0; i < n; i ++ ) d[ i ] *= 0.8 / ( p || 1 );
	return b;

};

export class HarrysSounds {

	constructor( place ) {

		this.place = place;
		this.r = rand( 1971 );
		this.t = 0;
		this.next = 4;
		this.nextDelco = 6;
		this._ready = false;
		this._v = new Vector3();

	}

	_start() {

		const S = this.place.app?.sound;
		if ( ! S || ! this.place.harrys ) return;
		this._ready = true;
		S.sample( 'lf-room-up', DIR + 'room-up.mp3' );
		S.sample( 'lf-room-down', DIR + 'room-down.mp3' );
		S.sample( 'lf-heater', heaterRoar );
		for ( const c of CALLS ) S.sample( 'lf-' + c, DIR + c + '.mp3' );
		const H = this.place.harrys, F = this.place.F;
		// the rooms: upstairs under the ceiling, downstairs out of the bar's front over the tables
		this.up = S.spot( 'lf-room-up', this._at( F, ( H.UR.x0 + H.UR.x1 ) / 2, ( H.UR.z0 + H.UR.z1 ) / 2, H.PY + 1.8 ), { loop: true, vol: 0.55, ref: 5, max: 70 } );
		this.down = S.spot( 'lf-room-down', this._at( F, - 2, H.FZ - 5, H.DN.y0 + 1.7 ), { loop: true, vol: 0.7, ref: 6, max: 80 } );
		this.heaters = H.heaters.map( ( h ) => S.spot( 'lf-heater', this._at( F, h.x, h.z, h.y ), { loop: true, vol: 0.16, ref: 1.2, max: 14, rate: 0.9 + 0.2 * Math.random() } ) );

	}

	// a field-frame point ( local x, z of the board's frame; field y ) as a world position
	_at( F, lx, lz, y ) {

		const [ x, z ] = F.field( lx, lz );
		const w = this.place.field.toWorld( x, z );
		return new Vector3( w.x, this.place.field.y0 + y, w.z );

	}

	// a one-shot from a field point, if the camera's near enough to hear it
	_say( name, fx, fy, fz, cam, vol = 1 ) {

		if ( ! cam || ( fx - cam[ 0 ] ) ** 2 + ( fz - cam[ 1 ] ) ** 2 > NEAR * NEAR ) return;
		const w = this.place.field.toWorld( fx, fz );
		this._v.set( w.x, this.place.field.y0 + fy, w.z );
		this.place.app.sound.spot( 'lf-' + name, this._v, { vol, ref: 3, max: 45 } );

	}

	update( dt, N, cam ) {

		if ( ! this._ready ) this._start();
		if ( ! this._ready ) return;
		this.t += dt;
		// the rooms fill as the night goes on; the lower level's front quieter in the rain delay
		const busy = N.celebrate ? 1.2 : N.suspended ? 0.7 : 0.9 + 0.1 * Math.min( 1, ( N.inning || 1 ) / 9 );
		this.up?.set( { vol: 0.5 * busy } );
		this.down?.set( { vol: 0.65 * busy } );
		const P = this.place.people;
		if ( ! P || ! cam ) return;
		const who = ( name ) => P.list.find( ( m ) => m.name === name );
		const from = ( m, name, vol ) => m && this._say( name, m.p.x, m.p.y + 1.6, m.p.z, cam, vol );
		// the staff and the tables, one every 8 to 20 s
		this.next -= dt;
		if ( this.next <= 0 ) {

			this.next = 8 + 12 * Math.abs( this.r() );
			const k = Math.floor( Math.abs( this.r() ) * 7 );
			if ( k === 0 ) from( who( 'Vinnie DiNardo' ), Math.abs( this.r() ) < 0.5 ? 'vinnie-1' : 'vinnie-2', 0.9 );
			else if ( k === 1 ) from( who( 'Kitty Moran' ), Math.abs( this.r() ) < 0.5 ? 'kitty-1' : 'kitty-2', 0.9 );
			else if ( k === 2 ) from( who( 'Gloria Santangelo' ), 'gloria-1', 0.8 );
			else if ( k === 3 ) from( who( 'Angela Ricci' ), 'server-1', 0.8 );
			else if ( k === 4 ) from( who( 'Marcus Bell' ), 'server-2', 0.8 );
			else if ( k === 5 ) from( who( 'Lou Sabatini' ), 'lou-1', 0.6 );

		}

		// the Delco boys: Crawford in left in the bottom halves, Longoria at the plate
		const snap = N.snap || {};
		this.nextDelco -= dt;
		if ( this.nextDelco <= 0 && ! N.celebrate ) {

			const eva = snap.half === 'top' && String( snap.batter ) === LONGORIA;
			if ( eva || ( snap.half === 'bottom' && ! N.between ) ) {

				from( who( 'Brendan Quinn' ), eva ? 'delco-eva' : Math.abs( this.r() ) < 0.6 ? 'delco-crawford-1' : 'delco-crawford-2', 1.0 );
				this.nextDelco = eva ? 5 : 11 + 10 * Math.abs( this.r() );

			} else this.nextDelco = 2;

		}

		// the one Rays fan, at a Rays run
		const R0 = N.result;
		if ( R0 && R0.away > 0 && R0.key !== this._raysKey ) {

			this._raysKey = R0.key;
			from( who( 'Marcy Delgado' ), 'marcy-1', 1.0 );

		}

	}

}
