import { sizzle, register, murmur } from './concourse1b/Sounds.js';
import { LEVELS } from '../layout.js';

// FW3 (C2W-15, gauntlet r2): the stands' own sounds, for the third base concourse (Concourse3B.js) and
// Ashburn Alley (AshburnAlley2008.js): they drew grills, registers, lines and hawkers and played nothing
// (FW2 gave the Third Base Gate's plaza its sounds; the First Base Gate had them all). Through the park's
// sound (GameSound.sample / spot), the First Base Gate's clips (concourse1b/Sounds.js and its Piper voices,
// public/audio/places/concourse1b/CREDITS.md):
//   loops: the flat-tops hissing at the grills, the crowd's murmur where you are (louder with the inning's
//     rush, under the roof in the delay)
//   one-shots, near you only: a register's drawer as a stand rings someone up, "What can I get you?" and
//     "There you go. Next!" now and then at a counter, the beer man's call, "Hot chocolate!" from a cocoa
//     cart, "Programs!" from the program carts; the TVs' knot cheering a Phillies run, groaning at the Rays'
//
//   const S = new StandSounds( place, 'c3b' )
//   S.update( dt, ns, camF, { grills, staff, hawkers, cocoa, programs, busy } )
//     grills: [ [ x, z ] ] (set up once), staff: [ { p, state } ] (a state of 'register' / 'listen' / 'give'
//     rings), hawkers / cocoa / programs: [ p ] (where the calls come from)
const DIR = 'audio/places/concourse1b/';
const CALLS = [ 'beer-1', 'beer-2', 'loretta-1', 'loretta-2', 'cocoa-1', 'gus-1', 'gus-2' ];

export class StandSounds {

	constructor( place, key, { y = 0, near = 40 } = {} ) {

		this.place = place;
		this.key = key;
		this.y = y;
		this.near = near;
		this.ready = false;
		this.timers = {};
		this.time = 0;
		this.loops = [];

	}

	_init( sound, grills ) {

		this.sound = sound;
		const k = this.key;
		for ( const c of CALLS ) sound.sample( `${ k }-${ c }`, DIR + c + '.mp3' );
		sound.sample( `${ k }-sizzle`, sizzle );
		sound.sample( `${ k }-register`, register );
		sound.sample( `${ k }-murmur`, murmur );
		sound.sample( `${ k }-cheer`, 'audio/ballpark/cheer-small.mp3' );
		sound.sample( `${ k }-groan`, 'audio/ballpark/groan.mp3' );
		for ( const [ x, z ] of grills || [] ) this.loops.push( sound.spot( `${ k }-sizzle`, this._world( x, 1.2, z ), { loop: true, vol: 0.32, ref: 3, max: 28 } ) );
		this.murmur = sound.spot( `${ k }-murmur`, this._world( 0, 1.6, 0 ), { loop: true, vol: 0, ref: 8, max: 50 } );
		this.ready = true;

	}

	_world( x, y, z ) {

		const F = this.place.field, w = F.toWorld( x, z );
		return { x: w.x, y: F.y0 + LEVELS.mainConcourse + this.y + y, z: w.z };

	}

	_near( x, z ) {

		const c = this.cam;
		return c && Math.hypot( x - c[ 0 ], z - c[ 1 ] ) < this.near;

	}

	play( name, x, y, z, vol = 0.6, ref = 4 ) {

		if ( ! this._near( x, z ) ) return;
		this.sound.spot( `${ this.key }-${ name }`, this._world( x, y, z ), { vol, ref, max: this.near + 10 } );

	}

	_every( key, secs ) {

		const t = this.timers[ key ] ?? ( this.timers[ key ] = this.time + secs * Math.random() );
		if ( this.time < t ) return false;
		this.timers[ key ] = this.time + secs * ( 0.7 + 0.6 * Math.random() );
		return true;

	}

	// the nearest of a list of people (with .p or bare), within reach
	_nearest( list ) {

		let best = null, bd = this.near;
		for ( const o of list || [] ) {

			const p = o.p || o;
			if ( ! p || p.visible === false ) continue;
			const d = Math.hypot( p.x - this.cam[ 0 ], p.z - this.cam[ 1 ] );
			if ( d < bd ) { bd = d; best = p; }

		}

		return best;

	}

	update( dt, ns, camF, { grills = [], staff = [], hawkers = [], cocoa = [], programs = [], counters = [], busy = 0.8, inside = true } = {} ) {

		const sound = this.place.app?.sound;
		if ( ! sound ) return;
		if ( ! this.ready ) this._init( sound, grills );
		this.time += dt;
		this.cam = camF;
		if ( ! camF ) return;
		// the murmur where you are, with the rush (none when you're away from here)
		this.murmur.move( this._world( camF[ 0 ], 1.6, camF[ 1 ] ) ).set( { vol: inside ? Math.min( 0.42, 0.1 + 0.18 * busy ) : 0 } );
		if ( ! inside ) return;
		// the counters: the drawer as they ring up, a word now and then
		for ( const a of staff ) {

			if ( a.state === a._fw3 ) continue;
			const p = a.p;
			if ( p && this._near( p.x, p.z ) ) {

				if ( a.state === 'register' ) this.play( 'register', p.x, 1.1, p.z, 0.3, 3 );
				else if ( a.state === 'listen' && Math.random() < 0.08 && this._every( 'ask', 9 ) ) this.play( 'loretta-1', p.x, 1.6, p.z, 0.45, 3 );
				else if ( a.state === 'give' && Math.random() < 0.06 && this._every( 'next', 9 ) ) this.play( 'loretta-2', p.x, 1.6, p.z, 0.45, 3 );

			}

			a._fw3 = a.state;

		}

		// counters whose staff aren't tracked (the Alley's): a register somewhere near every few seconds
		if ( counters.length && this._every( 'counter', 5 ) ) {

			const near = counters.filter( ( [ x, z ] ) => this._near( x, z ) );
			const at = near[ Math.floor( Math.random() * near.length ) ];
			if ( at ) this.play( Math.random() < 0.12 ? 'loretta-2' : 'register', at[ 0 ], 1.1, at[ 1 ], 0.3, 3 );

		}

		const h = this._nearest( hawkers );
		if ( h && this._every( 'beer', 24 ) ) this.play( Math.random() < 0.5 ? 'beer-1' : 'beer-2', h.x, 1.7, h.z, 0.7 );
		const c = this._nearest( cocoa );
		if ( c && this._every( 'cocoa', 36 ) ) this.play( 'cocoa-1', c.x, 1.6, c.z, 0.6 );
		const g = this._nearest( programs );
		if ( g && this._every( 'gus', 30 ) ) this.play( Math.random() < 0.6 ? 'gus-1' : 'gus-2', g.x, 1.6, g.z, 0.65 );
		// the TVs' knots at a run scored
		const R = ns?.result;
		if ( R && R.key !== this._rk && R.t > 0.4 ) {

			this._rk = R.key;
			const at = this.cam;
			if ( R.home > 0 ) this.play( 'cheer', at[ 0 ] + 4, 1.7, at[ 1 ] + 3, 0.5, 6 );
			else if ( R.away > 0 ) this.play( 'groan', at[ 0 ] - 3, 1.7, at[ 1 ] + 4, 0.4, 6 );

		}

	}

}
