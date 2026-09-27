import { PROP, restPose } from '../Cast.js';
import { Walkway } from '../Concourse3BKit.js';
import { SEATED, SIT, easeArms, sitPose, seatSpot } from './Poses.js';

// The people in the seats behind home plate: Cast figures sat in the seats the place takes from the
// crowd. They do what the crowd round them does (Crowd.mood(): up on two strikes with two outs, arms up
// for a run, clapping, the rally towels, the last out), in their own time, and in between they live:
// a beer on the knee and a sip now and then, a hot chocolate held in both hands on the 27th, texting,
// the scorebook, a hot dog, a word with the neighbour, arms folded against the cold, elbows on the knees
// in the 9th. Their heads follow the ball. Anyone can be given something to do for a while (act()): pass
// a beer along the row, stand to let someone by, hold a sign up, flinch from a foul into the net.
//
//   const fans = new Fans( cast )
//   const f = fans.add( seat, { looks: { 27: look, 29: look }, scale, kit, traits } )
//   f.act( gesture, seconds, { propL, propR, up, head, mouth } )      a gesture for a while
//   fans.update( dt, N )                                               N: the night (BehindHome._night)

const hash = ( n ) => {

	const s = Math.sin( n * 12.9898 + 78.233 ) * 43758.5453;
	return s - Math.floor( s );

};

// the idle things to do, and what each holds (the fan's own drink is put in 'drink')
const IDLE = {
	watch: { g: 'lap' },
	knees: { g: 'knees' },
	fold: { g: 'fold' },
	cup: { g: 'cup', R: 'drink' },
	warm: { g: 'warm', R: PROP.cocoa },
	text: { g: 'text', R: PROP.phone },
	call: { g: 'phone', R: PROP.phone },
	score: { g: 'score', L: PROP.scorebook, R: PROP.pencil },
	eat: { g: 'eat', R: PROP.hotdog },
	peanuts: { g: 'shell', L: PROP.peanuts },
	read: { g: 'read', R: PROP.program },
	pockets: { g: 'pockets', R: PROP.pocket, L: PROP.pocket },
	blow: { g: 'blow' },
	talk: { g: 'lap', talk: true },
};

export class Fans {

	constructor( cast ) {

		this.cast = cast;
		this.list = [];
		this.bySeat = new Map();

	}

	// someone in a seat: looks { 27, 29 } (packLook fields), the kit (idle weights, the drink, a towel, a
	// camera), traits (how readily they stand, cheer, clap)
	add( seat, o = {} ) {

		const p = this.cast.add( o.looks[ 27 ] );
		if ( ! p ) return null;
		const seed = o.seed ?? hash( seat.x * 7.1 + seat.z * 3.3 );
		const f = new Fan( this, seat, p, o, seed );
		this.list.push( f );
		this.bySeat.set( seat, f );
		return f;

	}

	// the fan in the seat beside ( di = -1 / +1 along the row ), if the place has him
	neighbour( f, di ) {

		const s = f.seat;
		const row = this.rows?.( s.sec, s.row );
		const n = row?.find( ( q ) => q.i === s.i + di );
		return n ? this.bySeat.get( n ) || null : null;

	}

	update( dt, N ) {

		for ( const f of this.list ) f.update( dt, N );

	}

}

export class Fan {

	constructor( fans, seat, p, o, seed ) {

		this.fans = fans;
		this.seat = seat;
		this.p = p;
		this.looks = o.looks;
		this.name = o.name || null;
		this.seed = seed;
		this.scale = o.scale ?? 1;
		p.scale = this.scale;
		p.yaw = seat.yaw;
		// what they do between pitches: weights by name (IDLE)
		this.kit = { idle: { watch: 4, fold: 2, talk: 2, cup: 0 }, drink: PROP.beer, towel: hash( seed * 3 ) < 0.7, camera: hash( seed * 5 ) < 0.18, glove: false, ...o.kit };
		// how readily: stand (0 first up .. 1 last), arms up, clap, towel, the camera out
		this.tr = { stand: 0.1 + 0.8 * hash( seed * 11 ), cheer: 0.1 + 0.85 * hash( seed * 13 ), clap: 0.85 * hash( seed * 17 ), towel: 0.15 + 0.8 * hash( seed * 19 ), ...o.traits };
		this.arms = [ [ 0.05, 0.06, 0, 0.12 ], [ 0.05, 0.06, 0, 0.12 ] ];
		this.up = 0;
		this.head = [ 0, 0.1 ];
		this.acts = [];
		this.away = false;
		this.hold = { L: 0, R: 0 };
		this.night = 0;
		this.script = o.script || null;
		p.pose = restPose();
		sitPose( p.pose, 0, this.scale );
		const [ x, z ] = seatSpot( seat, 0 );
		p.x = x; p.z = z; p.y = seat.y;

	}

	// do this for a while: g a gesture (SEATED) or [ l, r ] arms; o: { propL, propR, up (stand), head:
	// [ yaw, pitch ] or a field point to look at, mouth, from (start delay, s), key (replaces the same key) }
	act( g, dur, o = {} ) {

		if ( o.key ) this.acts = this.acts.filter( ( a ) => a.key !== o.key );
		this.acts.push( { g: typeof g === 'string' ? SEATED[ g ] : g, name: typeof g === 'string' ? g : 'arms', t: - ( o.from || 0 ), dur, ...o } );

	}

	busy() {

		return this.acts.some( ( a ) => a.t >= 0 );

	}

	update( dt, N ) {

		const p = this.p, a = p.pose, t = N.t, sd = this.seed;
		// the night's clothes
		const night = N.first ? 27 : 29;
		if ( night !== this.night ) {

			this.night = night;
			this.fans.cast.setLook( p, this.looks[ night ] );

		}

		if ( this.script ) this.script( this, N, dt );
		// out of his seat: someone else (the aisles) moves him
		if ( this.driven ) return;
		if ( this.away ) {

			p.visible = false;
			return;

		}

		p.visible = true;
		const k = 1 - Math.exp( - dt * 7 );
		// what's asked of him now (the latest act that has started)
		let act = null;
		for ( const q of this.acts ) {

			q.t += dt;
			if ( q.t >= 0 && q.t < q.dur ) act = q;

		}

		this.acts = this.acts.filter( ( q ) => q.t < q.dur );
		const M = N.mood;
		// ---- up or down: the crowd's mood, his own threshold; an act may stand him (or sit him)
		let upT = M.stand > this.tr.stand ? 1 : 0;
		if ( N.celebrate ) upT = 1;
		if ( act && act.up !== undefined ) upT = act.up;
		const rise = upT > this.up ? 1.6 : 1.1;
		this.up += Math.max( - dt * rise, Math.min( dt * rise, upT - this.up ) );
		const up = smooth( this.up );
		// ---- the arms and what's in the hands
		let g = null, L = 0, R = 0, mouth = 0, talk = false;
		const drink = this.kit.drink;
		// the idle choice: a new one every 9 to 25 s (a function of the time, so scrubbing agrees)
		const per = 9 + 16 * hash( sd * 23 );
		const slot = Math.floor( ( t + sd * 100 ) / per );
		const idle = pickIdle( this.kit.idle, hash( slot * 1.37 + sd * 57 ), N );
		const I = IDLE[ idle ] || IDLE.watch;
		g = SEATED[ I.g ];
		L = I.L === 'drink' ? drink : I.L || 0;
		R = I.R === 'drink' ? drink : I.R || 0;
		talk = !! I.talk;
		// what he's just bought from the vendor: held a while, a sip or a bite now and then
		if ( this.bought && t < this.bought.until && t > this.bought.from ) {

			const b = this.bought.prop;
			g = fract( t / 9 + sd ) < 0.14 ? SEATED.sip : SEATED.cup;
			if ( b === PROP.hotdog ) g = fract( t / 5 + sd ) < 0.4 ? SEATED.eat : SEATED.cup;
			if ( b === PROP.cottonCandy ) g = fract( t / 6 + sd ) < 0.3 ? SEATED.eat : SEATED.cup;
			R = b; L = 0;

		}

		// a kid's glove on all night (on his left hand, in case)
		if ( this.kit.glove && ! L ) L = PROP.glove;
		// a sip now and then
		if ( idle === 'cup' && fract( t / ( 11 + 7 * sd ) + sd ) < 0.12 ) g = SEATED.sip;
		// a bite
		if ( idle === 'eat' && fract( t / 6 + sd ) > 0.35 ) g = SEATED.cup;
		// ---- the crowd's moments over the idle: clapping, arms up, the towel, the camera
		const clap = M.clap > 0.25 + this.tr.clap * 0.7;
		if ( clap ) {

			g = fract( t * 3.4 + sd ) < 0.5 ? SEATED.clap : SEATED.clapOpen;
			L = 0; R = 0;

		}

		// the tense moments late: elbows on the knees, or hands together
		if ( N.tense > this.tr.stand && ! clap && up < 0.5 ) {

			g = hash( sd * 29 ) < 0.5 ? SEATED.lean : SEATED.pray;
			L = 0; R = 0;

		}

		let towel = false;
		if ( this.kit.towel && M.towel > this.tr.towel ) {

			towel = true;
			R = PROP.towel;
			L = 0;
			g = null;

		}

		if ( M.cheer > this.tr.cheer || ( N.celebrate && N.celT > 0.5 + 2 * this.tr.cheer ) ) {

			g = towel ? null : SEATED.cheer;
			if ( ! towel ) R = 0, L = 0;
			mouth = 0.8;

		}

		// the camera out for the big moments (and at the last out, over the heads)
		if ( this.kit.camera && N.flash > this.tr.cheer * 0.8 ) {

			g = N.celebrate && hash( sd * 31 ) < 0.5 ? SEATED.photoHigh : SEATED.photo;
			R = PROP.camera;
			L = 0;
			towel = false;

		}

		if ( act ) {

			if ( act.g !== undefined ) g = act.g;
			if ( act.propL !== undefined ) L = act.propL;
			if ( act.propR !== undefined ) R = act.propR;
			if ( act.mouth !== undefined ) mouth = act.mouth;
			if ( act.g ) towel = false;

		}

		if ( towel && ! ( act && act.g ) ) {

			// the towel twirled over the head: the arm up, circling
			const w = t * ( 8 + 5 * hash( sd * 37 ) ) + sd * 20;
			g = [ null, [ 2.55 + 0.2 * Math.sin( w ), 0.45 + 0.25 * Math.cos( w ), 0.1, 0.35 + 0.2 * Math.sin( w + 1 ) ] ];

		}

		// waving: the forearm swung
		if ( g === SEATED.wave || g === SEATED.waveBoth ) {

			const w = Math.sin( t * 9 + sd * 10 ) * 0.35;
			g = g === SEATED.wave ? [ g[ 0 ], [ g[ 1 ][ 0 ], g[ 1 ][ 1 ] + w, g[ 1 ][ 2 ], g[ 1 ][ 3 ] ] ] : g.map( ( A ) => [ A[ 0 ], A[ 1 ] + w, A[ 2 ], A[ 3 ] ] );

		}

		// arms up pump
		if ( g === SEATED.cheer ) {

			const w = Math.sin( t * 6 + sd * 30 ) * 0.12;
			g = g.map( ( A ) => [ A[ 0 ] + w, A[ 1 ], A[ 2 ], A[ 3 ] ] );

		}

		easeArms( this.arms, g || [ null, null ], act?.snap ? 1 : k );
		a.armL = this.arms[ 0 ];
		a.armR = this.arms[ 1 ];
		a.propL = L;
		a.propR = R;
		// ---- the head: the ball in play, else the plate; now and then the neighbour
		let hy = 0, hp = 0.12;
		const target = act?.look || N.look;
		if ( target ) {

			const dx = target[ 0 ] - p.x, dz = target[ 2 ] - p.z, dy = target[ 1 ] - ( p.y + 1.1 + 0.45 * up );
			hy = wrap( Walkway.yaw( dx, dz ) - p.yaw );
			hp = - Math.atan2( dy, Math.hypot( dx, dz ) );

		}

		if ( talk && fract( t / 7 + sd * 3 ) < 0.6 ) {

			hy = hash( sd * 41 ) < 0.5 ? - 0.75 : 0.75;
			hp = 0.1;
			mouth = Math.max( mouth, Math.max( 0, 0.35 * Math.sin( t * 7 + sd * 9 ) ) * ( fract( t / 2.3 + sd ) < 0.6 ? 1 : 0 ) );

		}

		if ( act?.head ) [ hy, hp ] = act.head;
		// past what the neck turns, the shoulders turn too
		const tw = Math.max( - 0.4, Math.min( 0.4, hy * 0.35 ) );
		hy = Math.max( - 1.2, Math.min( 1.2, hy - tw ) );
		this.head[ 0 ] += ( hy - this.head[ 0 ] ) * k * 0.7;
		this.head[ 1 ] += ( Math.max( - 0.5, Math.min( 0.6, hp ) ) - this.head[ 1 ] ) * k * 0.7;
		a.headYaw = this.head[ 0 ];
		a.headPitch = this.head[ 1 ];
		a.twist = tw * ( 1 - up * 0.5 );
		a.mouth = mouth > 0.5 ? mouth * ( 0.75 + 0.25 * Math.sin( t * 5 + sd * 7 ) ) : mouth;
		a.blink = fract( t * 0.31 + sd * 7 ) < 0.035 ? 1 : 0;
		// ---- the legs and where he is: seated, up, or up and jumping at the last out
		sitPose( a, up, this.scale, act?.lean || 0 );
		const [ x, z ] = seatSpot( this.seat, up );
		p.x = x; p.z = z;
		let y = this.seat.y;
		if ( N.celebrate && up > 0.9 && hash( sd * 43 ) < 0.6 ) y += Math.max( 0, Math.sin( t * 7.5 + sd * 20 ) ) * 0.12;
		if ( act?.y ) y += act.y;
		p.y = y;

	}

}

function pickIdle( weights, r, N ) {

	let sum = 0;
	for ( const k in weights ) sum += w( k );
	let x = r * sum;
	for ( const k in weights ) {

		x -= w( k );
		if ( x <= 0 ) return k;

	}

	return 'watch';

	// the cold on the 29th brings the hands in; the pitch itself holds everyone's eyes
	function w( k ) {

		let v = weights[ k ];
		if ( ! N.first && ( k === 'pockets' || k === 'blow' || k === 'fold' ) ) v *= 1.6;
		if ( N.pitching && ( k === 'text' || k === 'read' || k === 'call' ) ) v *= 0.4;
		return v;

	}

}

const fract = ( x ) => x - Math.floor( x );
const smooth = ( x ) => {

	const t = Math.max( 0, Math.min( 1, x ) );
	return t * t * ( 3 - 2 * t );

};
const wrap = ( a ) => Math.atan2( Math.sin( a ), Math.cos( a ) );

export { hash, fract, smooth, wrap, SIT };
