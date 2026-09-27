import { ConcoursePeople } from '../Concourse3BPeople.js';
import { pick } from '../Concourse3BKit.js';

// The first base concourse's people (Concourse1B.js): W2's concourse crowd (Concourse3BPeople.js) on the
// other side of home plate. Everything there works in the walkway's ( s, d ), and this side's walkway
// (Walk.js) is W2's turned round, so the same fans come up the aisles, queue at the stands, lean on the
// drink rail and wait outside the women's rooms here. What's this side's own:
//
//   the First Base Gate: fans in through its turnstiles (handed over from the gate's own arrivals, the
//     same person walking on in), and out through it at the end
//   keeping right: toward first base the right hand is away from the field, so the ones walking out toward
//     right field keep to the stands' side, the ones walking back toward home plate to the rail's
//   the glance at the field is to the left going toward first
//   what the carts and kiosks on this side sell (the Phanatic Phood cart's small portions, the Hatfield
//     cart's dogs, the draft beer stands)
export const GATE_S = 71.2; // the gate's mouth onto the concourse (its middle, between the stands at 56 and 81)
export const S_END = 150; // behind 108, where the walkway turns into the right field corner

// what the portables on this side hand over (W2's MENU has the stands' and its own carts')
const MENU_1B = {
	phood: { hotdog: 3, soda: 2, cottonCandy: 1, peanuts: 1 },
	hatfieldCart: { hotdog: 5, sandwich: 1 },
	draft: { beer: 5, beers: 3 },
	bottles: { beer: 4, beers: 2 },
	kiosk: { program: 1 },
};

export class People1B extends ConcoursePeople {

	constructor( o ) {

		super( { ...o, sEnd: S_END } );

	}

	_portals( concourse, bowl ) {

		super._portals( concourse, bowl );
		// W2's gate is the Third Base Gate's; this side's is the First Base Gate, its turnstiles about 5 m in
		// from the facade (d 54.4), the way in between the stands at 56 and 81
		this.portals = this.portals.filter( ( p ) => p.kind !== 'gate' );
		this.gate = { kind: 'gate', s: GATE_S, d: 45.6, w: 5, out: [ GATE_S + 1.5, 48.6 ] };
		this.portals.push( this.gate );
		// the concourse on past the right field end, into the corner (and on toward the Pavilion)
		for ( const p of this.portals ) if ( p.kind === 'end' && p.s > 10 ) p.s = S_END + 6;

	}

	_fans() {

		super._fans( 300 );

	}

	// the standing room behind home plate: W2's grid runs from home plate toward third; this side's half of
	// it, behind 121 and 122, under the suite level's overhang
	_standing() {

		super._standing();
		this.stand = this.stand.filter( ( q ) => q.s < 15 );

	}

	// keep right: toward first (+s) the right is away from the field (the stands' side), back toward home
	// the rail's side; clear of the column line (d = 40.9)
	_lane( f, goalS ) {

		const dir = Math.sign( goalS - f.s ) || 1;
		const r = this.r();
		f.lane = dir < 0 ? 31.8 + ( 36.5 - 31.8 ) * r : r < 0.8 ? 37.2 + ( 39.3 - 37.2 ) * r / 0.8 : 42.4 + ( 43.1 - 42.4 ) * ( r - 0.8 ) / 0.2;

	}

	_walkPose( f, v, dt, ns ) {

		super._walkPose( f, v, dt, ns );
		// W2's glance is to the right (the field's side going toward third); here the field is on the left
		// going toward first
		const t = this.time, a = f.p.pose;
		const glance = Math.max( 0, Math.sin( t * 0.4 + f.order * 17 ) - 0.8 ) / 0.2;
		a.headYaw += 2 * 0.8 * glance * ( f.vs >= 0 ? 1 : - 1 ) * Math.min( 1, dt * 3 );

	}

	// this side's carts: the kinds W2's menu doesn't know
	_serve( S, dt, ns ) {

		super._serve( S, dt, ns );
		const M = MENU_1B[ S.brand ];
		if ( ! M ) return;
		for ( const f of S.counter ) if ( f && f.svc === 'walkup' && f.svcT === 0 && ! f._menu1b ) {

			f.buy = pick( this.r, M );
			f._menu1b = true;

		}

	}

	_leave( f, kinds ) {

		f._menu1b = false;
		super._leave( f, kinds );

	}

	// ---- in through the gate: someone who's come through the turnstiles (the gate's arrivals) walks on
	// into the concourse as one of its fans. The two swap cast slots: the arrival's figure (the same person,
	// dressed the same) becomes the fan's, the fan's spare slot goes back to the gate. Returns the spare
	// slot, or null when nobody's free.
	admit( p, x, z, ns ) {

		const f = this.fans.find( ( o ) => o.mode === 'off' && ! o.fixed && ! o.p.visible );
		if ( ! f ) return null;
		const spare = f.p;
		f.p = p;
		const age = p.looks?.dry?.age;
		f.speed = ( age === 1 ? 0.95 : age === 2 ? 1.35 : 1.25 ) + ( this.r() - 0.5 ) * 0.3;
		// the gate as where they're from, then where they're going (a stand's line, the rail, the seats)
		const phase = p.pose.phase, yaw = p.yaw;
		this._fromGate = true;
		this._start( f, ns );
		this._fromGate = false;
		const [ s, d ] = this.W.toSD( x, z );
		f.s = s; f.d = d;
		p.pose.phase = phase;
		p.yaw = yaw;
		p.fresh = false;
		return spare;

	}

	_pickPortal( not = null, kinds = null, near = null ) {

		if ( this._fromGate && ! not && ! kinds && near === null ) return this.gate;
		return super._pickPortal( not, kinds, near );

	}

}
