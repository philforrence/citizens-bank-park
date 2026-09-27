import { LEVELS } from '../../layout.js';
import { rng } from './Mesher.js';
import { PROP } from './Folk.js';
import { dress, uniform } from './Dress.js';
import { LIFT } from './Street.js';

// The plaza's characters who aren't going anywhere yet: people waiting for a friend by the statue, a
// crowd at the store's windows, fans sitting on a planter's wall, the smokers outside McFadden's, the
// vendors, the scalpers, the police. Each is a Folk figure placed by hand with an act that plays over
// time (talking with the hands, on the phone, a sip of beer, looking at the windows, calling out the
// programs), and a `when` for the part of the night they're there.
//
//   const cast = new Cast( folk, seed );
//   cast.add( { at: [ x, z ], face: [ x, z ] | yaw, act: 'talk', who: { ...dress opts } | 'usher', props: [ 'cup' ], when: ( w ) => w.first } )
//   cast.group( [ x, z ], n, r, { act, ... } )   n people in a ring round a point, facing in
//   cast.update( dt, w )

const STREET = LEVELS.mainConcourse;

export class Cast {

	constructor( folk, seed = 5 ) {

		this.folk = folk;
		this.r = rng( seed );
		this.list = [];

	}

	add( o ) {

		const r = this.r;
		const w0 = { first: o.night !== 2, rain: o.night === 2 ? 0 : 0.6, k: 0.5 };
		let d;
		if ( typeof o.who === 'string' ) d = uniform( o.who, r, o.props || [] );
		else {

			d = dress( r, o.dry ? { first: false, rain: 0, k: 0 } : w0, o.who || {} );
			// the extras asked for; umbrellas and ponchos only when they fit the act
			let bits = d.props;
			if ( o.noRainGear ) bits &= ~ ( ( 1 << PROP.umbrella ) | ( 1 << PROP.poncho ) );
			for ( const p of o.props || [] ) bits |= 1 << PROP[ p ];
			d.props = bits;

		}

		const [ x, z ] = o.at;
		const f = this.folk.add( { x, z, y: STREET + ( o.y || 0 ) + ( o.onRoad ? 0.012 : LIFT ), yaw: 0, look: d.look, props: d.props, scale: d.scale, seed: r() } );
		if ( ! f ) return null;
		const c = { f, act: o.act || 'stand', face: o.face, t: r() * 30, when: o.when, reacts: !! o.reacts, y0: ( o.y || 0 ) + ( o.onRoad ? 0.012 : LIFT ), base: d.props, umbrella: ( d.props & ( 1 << PROP.umbrella ) ) !== 0, rate: 0.7 + r() * 0.6, ...o.extra };
		this._aim( c );
		this.list.push( c );
		return c;

	}

	// n people in a ring round a point, facing in (a knot of friends)
	group( at, n, rad, o = {} ) {

		const out = [];
		const a0 = this.r() * Math.PI * 2;
		for ( let i = 0; i < n; i ++ ) {

			const q = a0 + i / n * Math.PI * 2 + ( this.r() - 0.5 ) * 0.5;
			const acts = o.acts || [ 'talk', 'listen', 'listen', 'drink', 'phone', 'listen' ];
			out.push( this.add( { ...o, at: [ at[ 0 ] + Math.cos( q ) * rad, at[ 1 ] + Math.sin( q ) * rad ], face: at, act: o.act || acts[ i % acts.length ] } ) );

		}

		return out;

	}

	_aim( c ) {

		const f = c.f;
		if ( Array.isArray( c.face ) ) f.yaw = Math.atan2( - ( c.face[ 0 ] - f.x ), - ( c.face[ 1 ] - f.z ) );
		else if ( typeof c.face === 'number' ) f.yaw = c.face;
		c.yaw0 = f.yaw;

	}

	update( dt, w ) {

		for ( const c of this.list ) {

			const f = c.f;
			f.visible = c.when ? !! c.when( w ) : true;
			if ( ! f.visible ) continue;
			c.t += dt * c.rate;
			const p = f.pose, t = c.t;
			// the neutral: arms hanging, a sway, the head wandering
			p.flexL = 0; p.abductL = 0.07; p.elbowL = 0.15; p.flexR = 0; p.abductR = 0.07; p.elbowR = 0.15;
			p.lean = 0; p.twist = 0; p.pitch = 0;
			p.yaw = 0.35 * Math.sin( t * 0.23 + f.seed * 9 ) * Math.sin( t * 0.11 );
			f.walk = 0; f.sit = 0; f.ride = false; f.y = STREET + c.y0;
			let props = c.base;
			// the rain gear: umbrellas up on the 27th out in the open, down on the 29th
			if ( c.umbrella && ! w.first ) props &= ~ ( 1 << PROP.umbrella );
			if ( c.umbrella && w.first ) {

				p.flexR = 0.5; p.abductR = 0.14; p.elbowR = 1.3;

			}

			const busyR = c.umbrella && w.first;
			switch ( c.act ) {

				case 'talk':
					// the hands going, the head nodding along
					if ( ! busyR ) {

						p.flexR = 0.35 + 0.3 * Math.max( 0, Math.sin( t * 2.1 ) ); p.elbowR = 1.2 + 0.3 * Math.sin( t * 3.3 ); p.abductR = 0.15;

					}

					p.flexL = 0.2 + 0.25 * Math.max( 0, Math.sin( t * 1.7 + 1 ) ); p.elbowL = 1.1;
					p.yaw = 0.25 * Math.sin( t * 0.5 ); p.pitch = 0.05 * Math.sin( t * 2.7 );
					break;
				case 'listen':
					p.pitch = - 0.05 + 0.06 * Math.max( 0, Math.sin( t * 1.3 ) );
					p.yaw = 0.15 * Math.sin( t * 0.3 );
					if ( ! w.first && ! busyR ) {

						p.flexL = - 0.35; p.abductL = 0.12; p.elbowL = 0.9; p.flexR = - 0.35; p.abductR = 0.12; p.elbowR = 0.9;

					}

					break;
				case 'phone':
					props |= 1 << PROP.phone;
					if ( ! busyR ) {

						p.flexR = 1.45; p.abductR = 0.55; p.elbowR = 2.55;

					}

					p.yaw = 0.5 * Math.sin( t * 0.2 ); p.pitch = - 0.1;
					p.flexL = 0.3; p.elbowL = 1.3;
					break;
				case 'drink': {

					props |= 1 << PROP.cup;
					// a sip now and then
					const sip = Math.max( 0, Math.sin( t * 0.6 ) ) ** 8;
					if ( ! busyR ) {

						p.flexR = 0.35 + 0.9 * sip; p.abductR = 0.05 + 0.2 * sip; p.elbowR = 1.45 + 0.9 * sip;

					}

					p.pitch = 0.2 * sip;
					break;

				}

				case 'sit':
					f.sit = 1;
					p.flexL = 0.55; p.elbowL = 0.5; p.flexR = 0.55; p.elbowR = 0.5; p.lean = 0.12;
					p.yaw = 0.5 * Math.sin( t * 0.17 + f.seed * 9 );
					break;
				case 'window':
					// looking in at the jerseys, pointing one out
					p.pitch = 0.08;
					if ( Math.sin( t * 0.4 ) > 0.6 && ! busyR ) {

						p.flexR = 1.3; p.abductR = 0.1; p.elbowR = 0.15;

					}

					break;
				case 'bag':
					props |= 1 << PROP.shopbag;
					p.flexL = 0.05; p.elbowL = 0.1;
					break;
				case 'smoke': {

					// the cigarette to the lips and away
					const drag = Math.max( 0, Math.sin( t * 0.5 ) ) ** 6;
					p.flexR = 0.4 + 0.9 * drag; p.abductR = 0.25 + 0.2 * drag; p.elbowR = 1.9 + 0.6 * drag;
					p.pitch = 0.1 * drag; p.flexL = - 0.3; p.elbowL = 0.9;
					p.lean = - 0.03;
					break;

				}

				case 'photo':
					// a camera up at the face, both hands
					p.flexR = 1.35; p.abductR = 0.35; p.elbowR = 2.3; p.flexL = 1.35; p.abductL = 0.35; p.elbowL = 2.3;
					p.yaw = 0; p.pitch = 0.1 + 0.05 * Math.sin( t * 0.4 );
					break;
				case 'pose':
					// posing for the photo: an arm round a friend, a thumbs-up, grinning
					p.flexR = 1.0 + 0.1 * Math.sin( t * 0.3 ); p.abductR = 0.3; p.elbowR = 1.9;
					p.flexL = 0.15; p.abductL = 0.9; p.elbowL = 1.2;
					p.yaw = 0; p.pitch = 0.05;
					break;
				case 'wait':
					// waiting for someone: looking up the street, at the phone, up the street again
					if ( Math.sin( t * 0.25 ) > 0.3 ) {

						props |= 1 << PROP.phone;
						if ( ! busyR ) {

							p.flexR = 0.55; p.abductR = 0.1; p.elbowR = 1.7;

						}

						p.pitch = - 0.45;

					} else {

						p.yaw = 0.9 * Math.sin( t * 0.15 ); p.pitch = 0.05;
						if ( ! w.first ) {

							p.flexL = - 0.35; p.abductL = 0.12; p.elbowL = 0.9;

						}

					}

					break;
				case 'wave':
					// the towel over the head, round and round
					props |= 1 << PROP.towel;
					p.flexL = 2.6 + 0.25 * Math.sin( t * 8 ); p.abductL = - 0.25 + 0.25 * Math.cos( t * 8 ); p.elbowL = 0.3;
					p.flexR = 2.0; p.abductR = - 0.3; p.elbowR = 0.6; p.pitch = 0.3;
					f.y = STREET + c.y0 + Math.max( 0, Math.sin( t * 5 ) ) * 0.12;
					break;
				case 'jump':
					// arms up, jumping
					p.flexL = 2.8; p.abductL = - 0.3; p.elbowL = 0.2; p.flexR = 2.8; p.abductR = - 0.3; p.elbowR = 0.2; p.pitch = 0.35;
					f.y = STREET + c.y0 + Math.max( 0, Math.sin( t * 6 ) ) * 0.28;
					break;
				case 'hug':
					// the arms round someone
					p.flexL = 1.2; p.abductL = - 0.5; p.elbowL = 1.3; p.flexR = 1.2; p.abductR = - 0.5; p.elbowR = 1.3; p.lean = 0.12;
					f.y = STREET + c.y0 + Math.max( 0, Math.sin( t * 4 ) ) * 0.06;
					break;
				case 'hawk': {

					// the goods held up high, calling out, the head going from face to face
					props |= 1 << PROP[ c.item || 'program' ];
					const up = Math.sin( t * 0.35 ) > - 0.4;
					p.flexR = up ? 2.1 + 0.15 * Math.sin( t * 2.2 ) : 0.4; p.abductR = 0.15; p.elbowR = up ? 0.9 : 1.3;
					p.yaw = 0.7 * Math.sin( t * 0.4 ); p.pitch = 0.08 + 0.05 * Math.sin( t * 3.1 );
					if ( c.umbrella && w.first ) props &= ~ ( 1 << PROP.umbrella );
					break;

				}

				case 'sell': case 'buy': {

					// a sale, on a shared clock (c.t starts together for the pair): the bag handed over, the
					// money out of the pocket, counted, the change back, a word; then a lull
					const k = t % 14;
					const sell = c.act === 'sell';
					if ( k < 2 ) {

						// the bag across the cart
						if ( sell ) { props |= 1 << PROP.sack; p.flexR = 0.75 * Math.min( 1, k * 2 ); p.elbowR = 0.7; p.lean = 0.1; }
						else { p.flexR = 0.7 * Math.min( 1, ( k - 0.8 ) * 3 ); p.elbowR = 0.6; }

					} else if ( k < 5 ) {

						// money: out of the pocket, a bill held out
						if ( sell ) { p.flexL = 0.5; p.elbowL = 1.5; p.pitch = - 0.3; }
						else { props |= 1 << PROP.sack; p.flexR = 0.3; p.elbowR = 1.4; p.flexL = k < 3.5 ? - 0.3 : 0.8; p.elbowL = k < 3.5 ? 1.2 : 0.4; p.pitch = - 0.2; }

					} else if ( k < 7.5 ) {

						// counting it, the change out of the apron, back across
						if ( sell ) { p.flexL = 0.5; p.elbowL = 1.6; p.flexR = k > 6.5 ? 0.8 : 0.5; p.elbowR = k > 6.5 ? 0.4 : 1.5; p.pitch = - 0.35; }
						else { props |= 1 << PROP.sack; p.flexR = 0.3; p.elbowR = 1.4; p.flexL = k > 6.5 ? 0.7 : 0; p.elbowL = 0.4; }

					} else {

						// a word, the head going; the buyer off with his peanuts
						p.yaw = 0.4 * Math.sin( t * 0.5 );
						if ( ! sell ) { props |= 1 << PROP.sack; p.flexR = 0.3; p.elbowR = 1.4; }
						else if ( k > 10 ) { props |= 1 << PROP.sack; p.flexR = 2.0; p.elbowR = 0.9; p.pitch = 0.1; }

					}

					break;

				}

				case 'scalp': {

					// "Who needs tickets? Who's selling?": the tickets fanned and held up, walking the curb,
					// a quick turn to anyone who looks
					props |= 1 << PROP.fan;
					const up = Math.sin( t * 0.5 ) > - 0.2;
					p.flexR = up ? 2.3 : 0.6; p.abductR = up ? 0.2 : 0.1; p.elbowR = up ? 0.5 : 1.2;
					p.yaw = 0.8 * Math.sin( t * 0.33 );
					if ( c.pace ) {

						const [ a, b ] = c.pace, s = ( Math.sin( t * 0.11 ) + 1 ) / 2;
						const x = a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * s, z = a[ 1 ] + ( b[ 1 ] - a[ 1 ] ) * s;
						const dx = x - f.x, dz = z - f.z, d = Math.hypot( dx, dz );
						if ( d > 1e-4 ) {

							const dd = Math.atan2( - dx, - dz ) - f.yaw;
							f.yaw += Math.atan2( Math.sin( dd ), Math.cos( dd ) ) * Math.min( 1, 5 * dt );
							f.walk = Math.min( 1, d / dt / 1.2 );
							f.phase += d * 3.6;

						}

						f.x = x; f.z = z;

					}

					break;

				}

				case 'ride':
					// up on a horse: the reins in both hands low in front, the head going over the crowd
					f.ride = true;
					p.flexL = 0.55; p.abductL = 0.05; p.elbowL = 1.25; p.flexR = 0.55; p.abductR = 0.05; p.elbowR = 1.25;
					p.yaw = 0.6 * Math.sin( t * 0.19 ); p.pitch = - 0.12;
					break;
				case 'pet': {

					// a kid reaching up to pat the horse's nose, drawing back, again
					const k = Math.max( 0, Math.sin( t * 0.7 ) );
					p.flexR = 1.1 + 0.5 * k; p.abductR = 0.1; p.elbowR = 0.3 + 0.2 * Math.sin( t * 4 ) * k; p.pitch = 0.45; p.lean = 0.1 * k;
					break;

				}

				case 'direct':
					// a cop waving them over the crosswalk: the arm sweeping across, then held up to stop them
					if ( Math.sin( t * 0.2 ) > 0 ) {

						p.flexR = 1.3; p.abductR = 0.3 + 0.8 * ( 0.5 + 0.5 * Math.sin( t * 2.2 ) ); p.elbowR = 0.4; p.yaw = - 0.5;

					} else {

						p.flexL = 1.45; p.abductL = 0.1; p.elbowL = 0.25; p.yaw = 0.4;

					}

					break;
				case 'sign':
					// a cardboard sign held at the chest, turned to the crowd
					props |= 1 << PROP.sign;
					p.flexL = 0.95; p.abductL = 0.05; p.elbowL = 0.85; p.flexR = 0.95; p.abductR = 0.05; p.elbowR = 0.85;
					p.twist = 0.3 * Math.sin( t * 0.25 ); p.yaw = 0.3 * Math.sin( t * 0.4 );
					break;
				default:
					if ( ! w.first && ! busyR ) {

						// hands in the pockets
						p.flexL = - 0.35; p.abductL = 0.12; p.elbowL = 0.9; p.flexR = - 0.35; p.abductR = 0.12; p.elbowR = 0.9;

					}

			}

			f.props = props;
			if ( c.custom ) c.custom( c, dt, w, p );
			// the ones following the game (at McFadden's windows, round a radio, round a little TV in the
			// lot): a run for the Phillies and they're up with their arms in the air, a hug, a high five;
			// one for the Rays and it's hands on heads (w.cheer, w.groan: seconds left of it)
			if ( c.reacts && ! f.ride ) {

				if ( w.cheer > 0 ) {

					const k = Math.min( 1, w.cheer / 1.5 );
					p.flexL = 2.7 * k; p.abductL = - 0.3 * k; p.elbowL = 0.25; p.flexR = 2.7 * k; p.abductR = - 0.3 * k; p.elbowR = 0.25; p.pitch = 0.3 * k;
					f.sit = 0;
					f.y = STREET + c.y0 + Math.max( 0, Math.sin( c.t * 6.5 + f.seed * 9 ) ) * 0.26 * k;

				} else if ( w.groan > 0 ) {

					const k = Math.min( 1, w.groan / 1.0 );
					p.flexL = 2.2 * k; p.abductL = 0.35 * k; p.elbowL = 2.3 * k; p.flexR = 2.2 * k; p.abductR = 0.35 * k; p.elbowR = 2.3 * k; p.pitch = - 0.4 * k; p.lean = 0.1 * k;

				}

			}

		}

	}

}
