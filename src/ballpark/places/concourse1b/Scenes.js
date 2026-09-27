import { PROP, TOP, COLOR, HAT, CHEST, BACK } from '../Cast.js';
import { GESTURE } from '../Concourse3BKit.js';
import { PR } from './Arrivals.js';

// Little scenes outside the First Base Gate that play out on the replay's clock (Concourse1B.js), each of
// them ending in the line at a turnstile, the person then just another arrival (Arrivals1B), and in the
// end one of the concourse's fans:
//
//   Augie Ferrante, 79, from Marconi Plaza, with his grandson Nicky, 10, at the Robin
//     Roberts statue before they go in: Augie saw Roberts and the Whiz Kids at Shibe Park in 1950, and
//     he's pointing up at him telling it; Nicky, his glove on, tries the follow-through himself. On the
//     27th in the rain at the first pitch, and again when the gates open for the 29th
//   Tony Brandolini and Richie Feeney from Pennsport, a last cigarette under the canopy's edge (smoking
//     was allowed at the gates in 2008, and there was no re-entry), before they flick them and go in
//   Bernie Loughlin, 58, from Roxborough, a SEPTA bus driver, with a thermos of coffee in his bag for the
//     cold: at Terrell's table it's found (no thermoses, 2008's rules), there's an argument, and he walks
//     it out to the bin by the fin and comes back
//   Keisha Morton and Mary Beth Riordan, nurses at Methodist Hospital on South Broad, straight off the
//     day shift in scrubs under their hoodies, running for the gate in the rain in the 3rd
//
// All invented (in the register, .claude/wave2/CAST.md). Times are the replay's (director.t): the 27th
// runs from 0 to the suspension at ~2143, the 29th from ~2167.
const lerp = ( a, b, t ) => a + ( b - a ) * t;

const BASE = { skin: 0, hair: 2, hairStyle: 0, facial: 0, glasses: false, female: false, age: 0, build: 1, top: TOP.jacket, color: COLOR.red, sleeves: COLOR.red, back: 0, chest: 0, pants: 0, shoes: 0, hat: HAT.none, poncho: 0, scarf: 0, gloves: false };
const look = ( dry, wet = {} ) => {

	const d = { ...BASE, ...dry, seed: Math.floor( Math.random() * 65536 ) };
	return { dry: d, wet: { ...d, ...wet } };

};

export class Scenes1B {

	// arrivals: Arrivals1B; spots: the plaza's (statue: { front, at }), the gate's frame
	constructor( { arrivals, plaza, gate } ) {

		this.A = arrivals;
		this.G = gate;
		this.time = 0;
		const st = plaza?.statue;
		const lanes = [ ...arrivals.lanes ].sort( ( a, b ) => a.sc - b.sc );
		const west = lanes[ lanes.length - 1 ], east = lanes[ 0 ];
		const P = ( s, o ) => {

			const p = gate.P( s, o );
			return [ p[ 0 ], p[ 2 ] ];

		};

		this.scenes = [
			{
				name: 'statue', windows: [ [ 3, 230 ], [ 2168, 2380 ] ], lane: west,
				people: [
					{ name: 'Augie', looks: look( { age: 1, hair: 7, glasses: true, build: 1, skin: 0, top: TOP.work, color: COLOR.tan, sleeves: COLOR.tan, hat: HAT.cap1980, pants: 2, shoes: 3, scarf: 1, gloves: true } ), at: st ? P( 17.9, 10.4 ) : null },
					{ name: 'Nicky', looks: look( { age: 2, hair: 1, skin: 0, top: TOP.hoodie, color: COLOR.red, sleeves: COLOR.red, chest: CHEST.block, hat: HAT.capRed, pants: 0, shoes: 0 }, { poncho: 1 } ), at: st ? P( 19.1, 10.0 ) : null, scale: 0.78 },
				],
				pose: ( p, i, T, ns ) => this._statue( p, i, T, ns ),
			},
			{
				name: 'smokers', windows: [ [ 0, 160 ], [ 2167, 2290 ] ], lane: east,
				people: [
					{ name: 'Tony', looks: look( { age: 0, hair: 6, facial: 1, build: 3, skin: 0, top: TOP.leather, color: COLOR.black, sleeves: COLOR.black, hat: HAT.knitBlack, pants: 1, shoes: 1 } ), at: P( - 18.2, 5.2 ) },
					{ name: 'Richie', looks: look( { age: 0, hair: 1, facial: 4, build: 2, skin: 1, top: TOP.jacket, color: COLOR.red, sleeves: COLOR.red, hat: HAT.capRed, pants: 0, shoes: 0 } ), at: P( - 17.1, 5.9 ) },
				],
				pose: ( p, i, T, ns ) => this._smoke( p, i, T, ns ),
			},
			{
				name: 'bernie', windows: [ [ 35, 60 ] ], lane: arrivals.lanes[ 3 ], send: true,
				people: [ { name: 'Bernie', looks: look( { age: 0, hair: 6, facial: 3, glasses: true, build: 3, skin: 0, top: TOP.work, color: COLOR.navy, sleeves: COLOR.navy, hat: HAT.knitGrey, pants: 1, shoes: 1 } ), at: [ 52, 101 ], bag: true, thermos: true, speed: 1.15 } ],
			},
			{
				name: 'nurses', windows: [ [ 870, 900 ] ], send: true, speed: 2.4,
				people: [
					{ name: 'Keisha', looks: look( { female: true, age: 0, skin: 5, hair: 0, hairStyle: 2, top: TOP.hoodie, color: COLOR.red, sleeves: COLOR.red, chest: CHEST.block, pants: 5, shoes: 0 }, { hat: HAT.hood } ), at: [ 44, 102.5 ], speed: 2.5 },
					{ name: 'Mary Beth', looks: look( { female: true, age: 0, skin: 0, hair: 4, hairStyle: 2, top: TOP.hoodie, color: COLOR.grey, sleeves: COLOR.grey, chest: CHEST.block, pants: 5, shoes: 0 }, { poncho: 1, hat: HAT.hood } ), at: [ 42.8, 103.4 ], speed: 2.4 },
				],
			},
			// the last out on the 29th: the ones without tickets, from the tailgates in Lot K across Pattison
			// (tailgating was allowed in K), running over to the gate to be as near as they can, jumping,
			// hugging, towels round their heads
			{
				name: 'lastOut', windows: [ [ 3353, 3500 ] ], rush: true,
				people: Array.from( { length: 12 }, ( _, i ) => ( {
					name: 'celebrant' + i, speed: 3.2 + ( i % 3 ) * 0.3,
					looks: look( { age: i % 5 === 4 ? 3 : 0, female: i % 3 === 1, hairStyle: i % 3 === 1 ? 2 : 0, skin: [ 0, 1, 5, 2, 0, 6 ][ i % 6 ], hair: [ 1, 2, 0, 4, 3, 1 ][ i % 6 ], build: i % 4, top: [ TOP.hoodie, TOP.homeJersey, TOP.jacket, TOP.nameTee, TOP.fleece, TOP.champsTee ][ i % 6 ], color: [ COLOR.red, COLOR.white, COLOR.red, COLOR.red, COLOR.navy, COLOR.grey ][ i % 6 ], sleeves: COLOR.grey, back: [ 0, BACK.UTLEY, 0, BACK.HOWARD, 0, 0 ][ i % 6 ], chest: [ CHEST.block, CHEST.script, 0, 0, 0, CHEST.champs ][ i % 6 ], hat: [ HAT.knitRed, HAT.capRed, HAT.none, HAT.capBack, HAT.knitGrey, HAT.capRed ][ i % 6 ], pants: i % 3, shoes: i % 2 } ),
					from: [ 78 + ( i * 7.3 ) % 34, 128 + ( i * 3.7 ) % 18 ], to: P( - 11 + ( i * 5.1 ) % 22, 3.2 + ( i % 3 ) * 1.4 ), at: [ 78 + ( i * 7.3 ) % 34, 128 + ( i * 3.7 ) % 18 ], delay: i * 1.3,
				} ) ),
				pose: ( p, i, T, ns ) => this._lastOut( p, i, T, ns ),
			},
		];
		for ( const sc of this.scenes ) sc.state = 'idle';
		// the arrivals keep enough slots free for them
		arrivals.reserve = this.scenes.reduce( ( n, sc ) => n + sc.people.length, 0 );

	}

	// after a jump in the replay: everyone of the scenes let go, to start again where the clock is
	reset() {

		for ( const sc of this.scenes ) {

			for ( const a of sc.active || [] ) if ( a.mode === 'scene' ) this.A._free( a );
			sc.active = null;
			sc.state = 'idle';

		}

	}

	reset1( sc ) {

		for ( const a of sc.active || [] ) if ( a.mode === 'scene' ) this.A._free( a );
		sc.active = null;
		sc.state = 'idle';

	}

	update( dt, ns, t ) {

		this.time += dt;
		for ( const sc of this.scenes ) {

			const w = sc.windows.find( ( [ a, b ] ) => t >= a && t < b );
			if ( sc.state === 'idle' && w && t < w[ 1 ] - ( sc.send ? 0 : 15 ) ) this._start( sc, ns, w );
			else if ( sc.state === 'active' && sc.rush && ! w ) this.reset1( sc );
			else if ( sc.state === 'active' && ! sc.rush && ( ! w || t >= w[ 1 ] || sc.send ) ) this._go( sc );
			else if ( sc.state === 'gone' && ! w ) sc.state = 'idle';
			if ( sc.state === 'active' ) sc.active.forEach( ( a, i ) => {

				if ( a.mode === 'scene' ) sc.pose?.( a.p, i, t - sc.t0, ns );

			} );

		}

	}

	_start( sc, ns, w ) {

		sc.active = [];
		sc.t0 = w[ 0 ];
		for ( const q of sc.people ) {

			if ( ! q.at ) continue;
			const a = this.A.take( q.looks, ns, q.at[ 0 ], q.at[ 1 ], { scale: q.scale, bag: q.bag, thermos: q.thermos, speed: q.speed ?? sc.speed, name: q.name, habit: 2 } );
			if ( ! a ) break;
			sc.active.push( a );

		}

		sc.state = 'active';

	}

	// off to the line (the same lane for a pair: they go in together)
	_go( sc ) {

		const L = sc.lane || this.A._pickLane();
		sc.active.forEach( ( a, i ) => {

			if ( a.mode !== 'scene' ) return;
			this.A.sendFrom( a, L );
			a.s = - i * 0.9; // the second a step behind

		} );
		sc.state = 'gone';

	}

	// ---- at the statue: Augie pointing up at Roberts and telling it; Nicky trying the follow-through
	_statue( p, i, T, ns ) {

		const P = p.pose, st = this.G;
		const face = Math.atan2( st.n[ 0 ], st.n[ 1 ] ) + ( i ? 0.2 : - 0.15 ); // toward the statue (it's toward the gate from here)
		p.yaw = face;
		P.walk = 0; P.lean = 0; P.twist = 0; P.drop = 0; P.hipL = P.hipR = 0; P.kneeL = 0.08; P.kneeR = 0;
		const t = this.time;
		if ( i === 0 ) {

			// pointing up at him, the other hand on the boy's shoulder now and then; talking the whole time
			const phase = ( T % 14 ) / 14;
			P.armR = phase < 0.55 ? [ 2.2, 0.35, - 0.2, 0.15 ] : [ 0.05, 0.08, 0, 0.2 ];
			P.propR = 0;
			P.armL = phase > 0.5 ? [ 0.9, 0.9, 0.2, 0.5 ] : GESTURE.pockets[ 0 ].slice();
			P.propL = phase > 0.5 ? 0 : PROP.pocket;
			P.headPitch = phase < 0.55 ? - 0.35 : 0.15;
			P.headYaw = phase < 0.55 ? 0 : 0.7;
			P.mouth = Math.max( 0, 0.35 * Math.sin( t * 7 ) * Math.sin( t * 1.1 + 1 ) );

		} else {

			// looking up at him; every so often the windup and the follow-through, glove on
			const k = ( T % 11 ) / 11;
			P.propL = PROP.glove; P.propR = 0;
			P.headPitch = - 0.3;
			P.armL = [ 0.9, 0.2, 0.3, 1.1 ];
			P.armR = [ 0.05, 0.08, 0, 0.2 ];
			if ( k > 0.6 && k < 0.85 ) {

				const u = ( k - 0.6 ) / 0.25;
				P.armR = u < 0.4 ? [ lerp( 0.1, - 1.2, u / 0.4 ), 0.4, 0, 0.6 ] : [ lerp( 2.6, 0.6, ( u - 0.4 ) / 0.6 ), 0.2, 0.4, 0.3 ];
				P.lean = u > 0.4 ? 0.35 : 0;
				P.hipL = u > 0.4 ? 0.5 : 0; P.kneeL = u > 0.4 ? 0.6 : 0;
				P.headPitch = 0.1;

			}

		}

		P.blink = ( t * 0.3 + i ) % 1 < 0.04 ? 1 : 0;

	}

	// ---- the last out: running over from Lot K, then jumping and hugging and waving the towels in front of
	// the gate
	_lastOut( p, i, T, ns ) {

		const q = this.scenes[ 4 ].people[ i ], P = p.pose, t = this.time;
		const run = Math.max( 0, T - q.delay );
		const dx = q.to[ 0 ] - q.from[ 0 ], dz = q.to[ 1 ] - q.from[ 1 ], L = Math.hypot( dx, dz );
		const k = Math.min( 1, run * q.speed / L );
		p.x = q.from[ 0 ] + dx * k; p.z = q.from[ 1 ] + dz * k; p.y = 7.01;
		P.lean = 0; P.twist = 0; P.hipL = P.hipR = P.kneeL = P.kneeR = 0; P.propL = 0;
		if ( k < 1 && run > 0 ) {

			// running, arms up now and then
			p.yaw = Math.atan2( - dx, - dz );
			P.walk = 1;
			P.phase = ( P.phase + 1 / 60 * q.speed / 1.3 * Math.PI * 2 ) % ( Math.PI * 2 );
			const up = i % 2 === 0;
			P.armL = up ? [ 2.6, 0.3, 0, 0.4 ] : [ Math.sin( P.phase ) * 0.6, 0.1, 0, 0.9 ];
			P.armR = up ? [ 2.6, 0.3, 0, 0.4 ] : [ - Math.sin( P.phase ) * 0.6, 0.1, 0, 0.9 ];
			P.propR = up ? PROP.towel : 0;
			P.mouth = 0.8;
			P.lean = 0.15;
			P.drop = 0;
			return;

		}

		// there: facing the gate, jumping, hugging the one beside, the towel round the head
		p.yaw = Math.atan2( this.G.n[ 0 ], this.G.n[ 1 ] ) + Math.sin( i * 2.1 ) * 0.4;
		P.walk = 0;
		const hug = ( ( T * 0.2 + i * 0.37 ) % 1 ) < 0.18;
		P.drop = hug ? 0 : - Math.max( 0, Math.sin( t * 8 + i ) ) * 0.12;
		P.armL = hug ? [ 1.6, 1.1, - 0.6, 0.5 ] : [ 2.7, 0.3, 0, 0.35 ];
		P.armR = hug ? [ 1.6, 1.1, - 0.6, 0.5 ] : [ 2.5 + 0.35 * Math.sin( t * 10 + i ), 0.5, 0.2 * Math.sin( t * 10 + i ), 0.4 ];
		P.propR = hug ? 0 : ( i % 3 ? PROP.towel : 0 );
		P.twist = hug ? ( i % 2 ? 0.5 : - 0.5 ) : 0;
		P.headPitch = - 0.3;
		P.mouth = 0.8;
		P.blink = 0;

	}

	// ---- the smokers: the cigarette to the lips every few seconds, a word between them, the rain off
	// the canopy's edge in front of them
	_smoke( p, i, T, ns ) {

		const P = p.pose, t = this.time;
		const other = this.scenes[ 1 ].active?.[ 1 - i ]?.p;
		p.yaw = other ? Math.atan2( - ( other.x - p.x ), - ( other.z - p.z ) ) + ( i ? - 0.5 : 0.5 ) : p.yaw;
		P.walk = 0; P.lean = 0.02; P.twist = 0; P.drop = 0; P.hipL = P.hipR = 0; P.kneeL = i ? 0 : 0.12; P.kneeR = i ? 0.12 : 0;
		const drag = ( ( T + i * 3.1 ) % 7 ) < 1.4;
		P.armR = drag ? [ 1.35, 0.5, 0.45, 2.1 ] : [ 0.35, 0.2, 0.2, 1.3 ];
		P.propR = PR.cigarette;
		P.armL = GESTURE.pockets[ 0 ].slice(); P.propL = PROP.pocket;
		P.headPitch = drag ? 0.1 : 0;
		P.headYaw = drag ? 0 : Math.sin( t * 0.3 + i * 2 ) * 0.4;
		P.mouth = ! drag && Math.sin( t * 0.5 + i * 3 ) > 0 ? Math.max( 0, 0.3 * Math.sin( t * 7 + i ) ) : 0;
		P.blink = ( t * 0.3 + i ) % 1 < 0.04 ? 1 : 0;

	}

}
