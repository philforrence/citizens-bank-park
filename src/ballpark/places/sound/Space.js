import { FOOTPRINT, LEVELS } from '../../layout.js';

// Where you are, for the ear: the open bowl, under a roof (the concourses are open to the field, with a
// low concrete ceiling over them; a tunnel to the seats or a room isn't), or outside the building (the
// plaza, the lots: the bowl comes over and through the facade, dark and far). Four times a second, from
// the camera: inside the stadium's footprint or not (layout.js FOOTPRINT, OpenStreetMap's outline),
// what's overhead and how low (the rain cover's height map, RainCover.js), and how far to open sky toward
// the field. It sets:
//   the rooms: the park's reverb (everything sends to it) as the open bowl's long tail with the far
//     stands' slaps, or a roofed space's short dense one, faded between;
//   the buses' tone and level: the crowd, the field (the bat, the mitt), the weather;
//   the air: every place's positional sound (GameSound.spot) loses its highs with distance, and more
//     through the facade (sound.airCutoff, and the loops' filters as you walk).
// None of it is per frame.

const TICK = 0.25;
const SMOOTH = 0.35; // s, the time constant of every change

export class Space {

	constructor( { app, field, sound } ) {

		this.app = app;
		this.field = field;
		this.sound = sound;
		this.t = TICK;
		// the listener, in the field frame: x, y (above the field), z; and what's round him
		this.at = { x: 0, y: 10, z: 60 };
		this.w = { bowl: 1, roof: 0, enclosed: 0, outside: 0, high: 0, depth: 0 };
		this.zone = 'bowl';

	}

	init( synth ) {

		const S = this.sound, ctx = S.ctx, sr = ctx.sampleRate;
		// the rooms behind the park's one reverb input, once their impulses are made (off the main
		// thread: Synth.js); GameSound's own reverb until then
		const bowl = ctx.createConvolver(), room = ctx.createConvolver();
		Promise.all( [ synth.make( 'bowlIR', sr ), synth.make( 'roomIR', sr ) ] ).then( ( [ [ b ], [ r ] ] ) => {

			bowl.buffer = b;
			room.buffer = r;
			S.reverb.disconnect();
			S.reverb.connect( this.bowlSend ).connect( bowl ).connect( this.bowlTone ).connect( S.reverbOut );
			S.reverb.connect( this.roomSend ).connect( room ).connect( S.reverbOut );

		} ).catch( () => {} );
		this.bowlSend = ctx.createGain();
		this.roomSend = ctx.createGain();
		this.roomSend.gain.value = 0;
		// the bowl's tail dark and far when you're outside it or shut away from it
		this.bowlTone = ctx.createBiquadFilter();
		this.bowlTone.type = 'lowpass';
		this.bowlTone.frequency.value = 18000;
		// the buses: what the space colours (the PA's and the music's are PA.js's, through the speakers)
		this.buses = {};
		for ( const name of [ 'crowd', 'field', 'weather' ] ) {

			const input = ctx.createGain(), tone = ctx.createBiquadFilter(), out = ctx.createGain();
			tone.type = 'lowpass';
			tone.frequency.value = 18000;
			tone.Q.value = 0.5;
			input.connect( tone ).connect( out ).connect( S.master );
			S.buses[ name ] = input;
			this.buses[ name ] = { input, tone, out };

		}

		S.airCutoff = ( p ) => this.airCutoff( p );

	}

	// ---------------------------------------------------------------- where you are

	update( dt, camera ) {

		this.t -= dt;
		if ( this.t > 0 ) return false;
		this.t = TICK;
		const F = this.field, p = camera.position;
		const [ x, z ] = F.toField( p.x, p.z );
		const y = p.y - F.y0;
		this.at.x = x; this.at.y = y; this.at.z = z;
		const inside = pointIn( x, z, FOOTPRINT );
		const H = this.coverAt( x, z );
		// the cover map holds the TOP of what's overhead (under the main concourse's deck that's the upper
		// roof, 30 m up), so how low a roof is comes from the level you're standing on: the main concourse
		// under the suites (4 m), the club level under the terrace (6 m), the terrace under the roof (high)
		let ceiling = H - y;
		if ( ceiling > 0.4 ) {

			const floor = y - 1.65;
			for ( const [ lv, up ] of [ [ LEVELS.mainConcourse, LEVELS.suites ], [ LEVELS.clubConcourse, LEVELS.terraceConcourse ] ] ) {

				if ( floor > lv - 0.6 && floor < lv + 1.5 ) ceiling = Math.min( ceiling, up - floor );

			}

		}
		const roofed = ceiling > 0.4;
		// how far toward the middle of the field before open sky (the open concourse finds it in a few
		// metres, a tunnel or a room further or not at all)
		let open = 0;
		if ( roofed ) {

			const dx = 0 - x, dz = - 45 - z, L = Math.hypot( dx, dz ) || 1;
			open = 30;
			for ( let s = 2; s <= 30; s += 2 ) {

				const h = this.coverAt( x + dx / L * s, z + dz / L * s );
				if ( h < y + 0.4 || h - y > 18 ) {

					open = s;
					break;

				}

			}

		}

		const low = roofed ? smooth( 14, 3, ceiling ) : 0; // how low the ceiling is (0 high .. 1 low)
		const shut = roofed ? smooth( 8, 26, open ) : 0; // how shut away from the bowl (0 open .. 1 closed)
		const w = this.w;
		w.outside = inside ? 0 : 1;
		// outside: how far from the building (the facade muffles more, the distance takes the rest)
		w.depth = inside ? 0 : Math.min( 1, distTo( x, z, FOOTPRINT ) / 120 );
		w.roof = inside ? low * ( 1 - shut ) : low * 0.6;
		w.enclosed = inside ? low * shut : 0;
		w.bowl = Math.max( 0, 1 - w.outside - w.roof - w.enclosed );
		w.high = inside ? smooth( 18, 34, y ) : 0;
		this.zone = w.outside ? 'outside' : w.enclosed > 0.5 ? 'enclosed' : w.roof > 0.5 ? 'roof' : 'bowl';
		this.ceiling = roofed ? ceiling : Infinity;
		// the top of what's over you and how far up (the steel roof over the upper deck is what the rain drums on)
		this.top = roofed ? H : - Infinity;
		this.topDist = roofed ? H - y : Infinity;
		this.version = ( this.version || 0 ) + 1;
		this._apply();
		return true;

	}

	// the height of the top of whatever's overhead at a field point (-1e4 if nothing), from the rain
	// cover's map (the app keeps it: app.rainCover)
	coverAt( x, z ) {

		const C = this.app.rainCover;
		if ( ! C ) return - 1e4;
		const ix = Math.floor( ( x - C.x0 ) / C.cell ), iz = Math.floor( ( z - C.z0 ) / C.cell );
		if ( ix < 0 || iz < 0 || ix >= C.nx || iz >= C.nx ) return - 1e4;
		return C.heights[ ix + iz * C.nx ];

	}

	_apply() {

		const S = this.sound, ctx = S.ctx, t = ctx.currentTime, w = this.w;
		const set = ( param, v ) => param.setTargetAtTime( v, t, SMOOTH );
		const mix = ( a ) => a.bowl * w.bowl + a.roof * w.roof + a.enclosed * w.enclosed + a.outside * w.outside;
		// the bowl heard from here: its level and brightness
		const outTone = 900 - 450 * w.depth, outGain = 0.42 - 0.26 * w.depth;
		const crowd = { gain: mix( { bowl: 1 - 0.15 * w.high, roof: 0.72, enclosed: 0.32, outside: outGain } ), tone: mix( { bowl: 18000, roof: 6000, enclosed: 1100, outside: outTone } ) };
		const fieldB = { gain: mix( { bowl: 1 - 0.3 * w.high, roof: 0.62, enclosed: 0.22, outside: outGain * 0.45 } ), tone: mix( { bowl: 18000, roof: 5000, enclosed: 900, outside: outTone * 0.8 } ) };
		// the weather's own layers are chosen by Weather.js from the zone; this just darkens them inside
		const weather = { gain: 1, tone: mix( { bowl: 18000, roof: 12000, enclosed: 2500, outside: 16000 } ) };
		for ( const [ name, v ] of [ [ 'crowd', crowd ], [ 'field', fieldB ], [ 'weather', weather ] ] ) {

			set( this.buses[ name ].out.gain, v.gain );
			set( this.buses[ name ].tone.frequency, v.tone );

		}

		// the rooms: the bowl's tail, a roof's reflections
		set( this.bowlSend.gain, mix( { bowl: 1, roof: 0.65, enclosed: 0.3, outside: 0.4 } ) );
		set( this.roomSend.gain, mix( { bowl: 0, roof: 0.8, enclosed: 1.1, outside: 0.3 } ) );
		set( this.bowlTone.frequency, mix( { bowl: 16000, roof: 7000, enclosed: 1500, outside: outTone * 1.2 } ) );
		// the places' loops: their air as you walk
		for ( const h of S._spots || [] ) if ( h.air ) set( h.air.frequency, this.airCutoff( h.position ) );

	}

	// a positional sound's high cut: the air (the highs fall away over distance) and, if it's in the
	// bowl and you're outside (or the other way round), the building between
	airCutoff( p ) {

		const F = this.field;
		const [ x, z ] = F.toField( p.x, p.z );
		const a = this.at, d = Math.hypot( x - a.x, z - a.z, ( p.y - F.y0 ) - a.y );
		let f = 20000 * Math.exp( - d / 120 );
		const inside = pointIn( x, z, FOOTPRINT );
		if ( inside !== ! this.w.outside ) f = Math.min( f, 1400 );
		return Math.max( 700, f );

	}

}

function smooth( a, b, v ) {

	const t = Math.min( 1, Math.max( 0, ( v - a ) / ( b - a ) ) );
	return t * t * ( 3 - 2 * t );

}

export function pointIn( x, z, poly ) {

	let inside = false;
	for ( let i = 0, j = poly.length - 1; i < poly.length; j = i ++ ) {

		const [ xi, zi ] = poly[ i ], [ xj, zj ] = poly[ j ];
		if ( ( zi > z ) !== ( zj > z ) && x < ( xj - xi ) * ( z - zi ) / ( zj - zi ) + xi ) inside = ! inside;

	}

	return inside;

}

// distance from a point to a polygon's edge
function distTo( x, z, poly ) {

	let d = Infinity;
	for ( let i = 0, j = poly.length - 1; i < poly.length; j = i ++ ) {

		const [ ax, az ] = poly[ j ], [ bx, bz ] = poly[ i ];
		const ex = bx - ax, ez = bz - az, L = ex * ex + ez * ez || 1;
		const u = Math.max( 0, Math.min( 1, ( ( x - ax ) * ex + ( z - az ) * ez ) / L ) );
		d = Math.min( d, Math.hypot( x - ax - ex * u, z - az - ez * u ) );

	}

	return d;

}
