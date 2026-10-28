import { Mesh, BufferGeometry, Float32BufferAttribute, CylinderGeometry, TorusGeometry, SphereGeometry, BoxGeometry, Color, mergeGeometries } from '../../../engine/index.js';
import { standard } from '../../../materials/Materials.js';
import { commonModule } from '../../../engine/render/wgsl/common.js';
import { canvasTexture } from '../../geo.js';
import { mlbLogo } from '../../Details2008.js';
import { ON_DECK, boxFor } from '../../game/Plays.js';
import { RAIL, FLAG } from './RailFigures.js';
import { rnd, put } from './Props.js';
import * as Mo from '../../game/Motions.js';
import { ROLE } from '../../game/Players.js';

// The on-deck circles and the bat boys.
//
// Each circle is a real mat now: a rubber-backed disc 5 ft across with the Series' Fall Classic logo, a
// black edge, splattered with mud through the 27th (Getty 83458720), scuffed by spikes where the next
// hitter stands, clay tracked onto it, pine tar dripped on it and rosin dust. On it, the on-deck hitter's things: the bat doughnut, the pine tar rag, the rosin bag, a
// weighted bat.
//
// The bat boys stand at the dugouts' home ends. After any ball put in play, a walk or a hit batsman
// (not a strikeout: then he walks back with his bat) the batting team's bat boy trots out, picks up the
// bat where the hitter dropped it and trots it back.
//
//   Kevin, the Phillies' bat boy, 19, from Drexel Hill, his third season (he was 13 when the park opened);
//   Danny, a Philly kid in a Rays uniform: the visitors' bat boys are the home club's, and he's trying
//   hard not to smile when the Phillies score.
//
// ---- FR2 (gauntlet r3): the bat boys are on the players' rig now (Director.extras: posed with everyone
// else on the field, each frame, from the replay's time), in the club's uniform and a batting helmet, with
// their own looks (Looks.js batboy, batboyAway). On the rail's low-poly figures, standing at the dugout's
// end in every walk-up close-up from the low cameras, they were the crudest people on TV, and half see-
// through as they came and went. The rail's figures for them stay built, hidden.

const R = 0.76;

export class OnDeck {

	constructor( { group, figs, field, M }, director ) {

		this.group = group;
		this.figs = figs;
		this.M = M;
		this._mats( group, M );
		this.boys = {};
		for ( const d of field.dugouts ) {

			const team = d.side === 'first' ? 'home' : 'away';
			const { a, ux, uz, nx, nz } = d;
			const P = ( s, t ) => [ a[ 0 ] + ux * s + nx * t, a[ 1 ] + uz * s + nz * t ];
			const spot = P( 3.3, - 0.65 );
			const face = Math.atan2( - ( 0 - spot[ 0 ] ), - ( 0 - spot[ 1 ] ) );
			const outfit = team === 'home' ? RAIL.batBoyPhi : RAIL.batBoyRay;
			const seed = team === 'home' ? 0.31 : 0.12;
			const walk = figs.add( 'batBoyWalk', { x: spot[ 0 ], z: spot[ 1 ], yaw: face, outfit, seed, flags: FLAG.noGear, scale: 0.97 } );
			const bend = figs.add( 'batBoyBend', { x: spot[ 0 ], z: spot[ 1 ], yaw: face, outfit, seed, flags: FLAG.noGear, scale: 0.97, shown: false } );
			const hand = figs.add( 'batBoyHand', { x: spot[ 0 ], z: spot[ 1 ], yaw: face, outfit, seed, flags: 0, scale: 0.97, shown: false } );
			// the bat he goes for, on the ground by the plate
			const bat = new Mesh( batGeometry(), M.wood );
			bat.name = 'dropped-bat';
			bat.userData.dynamic = true;
			bat.visible = false;
			bat.castShadow = true;
			group.add( bat );
			this.boys[ team ] = { walk, bend, hand, spot, face, bat, phase: 0 };

		}

		this.fetches = null;
		this._hooked = null;

	}

	// ---- FR2: the bat boys on the rig, at the replay's time t (Director.extras: pose() calls this before it
	// syncs the rig, live and for a replay alike). In the dugout through the rain delay and from the last
	// out (the rail's own figures were out there through both)
	_actBoys( d, t ) {

		if ( ! this.fetches ) this._plan( d );
		const seg = d.segmentAt( t );
		if ( seg === d.suspension || seg.kind === 'celebrate' || seg.kind === 'intro' || d.champsAt?.( t ) ) return;
		for ( const team of [ 'home', 'away' ] ) {

			const B = this.boys[ team ];
			const id = 'r:batboy-' + team;
			const extra = { who: { side: team, num: '', last: '', look: team === 'home' ? 'batboy' : 'batboyAway' }, role: ROLE.helmet };
			const { spot, face } = B;
			const seed = team === 'home' ? 0.31 : 0.12;
			// (the trip under way: one that's begun, the last one's return finished first)
			let F = null;
			for ( const f of this.fetches ) {

				if ( f.team !== team || t < f.t0 || t >= f.t0 + 14 ) continue;
				const L = this._route( f, spot ).len;
				if ( ! F || t - f.t0 >= 0 && t - F.t0 >= L / 4.6 + 1.3 + L / 4.0 ) F = f;

			}

			let x = spot[ 0 ], z = spot[ 1 ], yaw = face, pose = null;
			if ( F ) {

				// (---- FB4, C4B-2: round behind the plate, out and back: _route)
				const route = this._route( F, spot ), dist = route.len;
				const T1 = dist / 4.6, T2 = 1.3, T3 = dist / 4.0; // (---- FB4: hustling, as they do)
				const tau = t - F.t0;
				if ( tau >= 0 && tau < T1 ) {

					const k = tau / T1;
					[ x, z, yaw ] = this._along( route, dist * k );
					pose = Mo.run( dist * k / 2.4 + seed, 0.55 );

				} else if ( tau >= T1 && tau < T1 + T2 ) {

					// down for it and up with it
					const k = ( tau - T1 ) / T2, b = Math.sin( Math.PI * Math.min( 1, k * 1.1 ) );
					[ x, z, yaw ] = this._along( route, dist );
					pose = Mo.blend( Mo.stand( t ), Mo.fieldGrounder( 0 ), b );
					if ( k > 0.5 ) pose.bat = { dir: [ 0.15, 0.2 - 0.9 * b, - 0.95 ] };

				} else if ( tau >= T1 + T2 && tau < T1 + T2 + T3 ) {

					const k = ( tau - T1 - T2 ) / T3;
					[ x, z, yaw ] = this._along( route, dist * ( 1 - k ) );
					yaw += Math.PI;
					pose = Mo.run( dist * k / 2.3 + seed + 0.5, 0.5 );
					pose.bat = { dir: [ 0.25, 0.9, 0.3 ] };

				}

			}

			// the Phillies' boy's ball runs to the plate umpire
			if ( team === 'home' && ! F ) {

				const Rn = this.runs.find( ( r ) => t >= r.t0 && t < r.t0 + 12 );
				if ( Rn ) {

					const to = [ 1.25, 2.35 ];
					const dist = Math.hypot( to[ 0 ] - spot[ 0 ], to[ 1 ] - spot[ 1 ] );
					const T1 = dist / 3.8, T2 = 1.4, T3 = dist / 3.4, tau = t - Rn.t0;
					const out = Math.atan2( - ( to[ 0 ] - spot[ 0 ] ), - ( to[ 1 ] - spot[ 1 ] ) );
					if ( tau < T1 ) {

						const k = tau / T1;
						x = spot[ 0 ] + ( to[ 0 ] - spot[ 0 ] ) * k; z = spot[ 1 ] + ( to[ 1 ] - spot[ 1 ] ) * k; yaw = out;
						pose = Mo.run( dist * k / 2.4 + seed, 0.5 );

					} else if ( tau < T1 + T2 ) {

						// the umpire's to his left: he holds them out, the ump takes them
						x = to[ 0 ]; z = to[ 1 ];
						yaw = Math.atan2( - ( 0.35 - to[ 0 ] ), - ( 2.05 - to[ 1 ] ) );
						pose = Mo.handOut( t, Math.sin( Math.PI * Math.min( 1, ( tau - T1 ) / T2 * 1.2 ) ) );

					} else if ( tau < T1 + T2 + T3 ) {

						const k = ( tau - T1 - T2 ) / T3;
						x = to[ 0 ] + ( spot[ 0 ] - to[ 0 ] ) * k; z = to[ 1 ] + ( spot[ 1 ] - to[ 1 ] ) * k; yaw = out + Math.PI;
						pose = Mo.run( dist * k / 2.3 + seed, 0.45 );

					}

				}

			}

			// idle at the dugout's end, watching the plate, now and then shifting his weight
			if ( ! pose ) pose = Mo.stand( t * 0.8 + seed * 20 );
			pose.glove = false;
			d.act( id, x, z, yaw, pose, extra );

		}

	}

	// where he picks the bat up: just short of it, on his way
	_near( F, spot ) {

		// (---- FB4: from behind it, the way he comes now)
		const from = this._via( spot );
		const l = Math.hypot( from[ 0 ] - F.at[ 0 ], from[ 1 ] - F.at[ 1 ] );
		return [ F.at[ 0 ] + ( from[ 0 ] - F.at[ 0 ] ) * 0.55 / l, F.at[ 1 ] + ( from[ 1 ] - F.at[ 1 ] ) * 0.55 / l ];

	}

	// ---- FB4 (C4B-2): his way out and back: round behind the plate umpire (z 3.4, on his own side), not
	// straight across the front of the plate. Straight, he ran down the low camera's line to the next hitter
	// walking up from the on-deck circle (the third base camera on a Phillie, the first base one on a Ray),
	// and the lens guard gave up the walk-up's close-up (C4B: 14 of 16 walk-ups on the high cameras)
	_via( spot ) {

		return [ Math.sign( spot[ 0 ] ) * 2.4, 3.4 ];

	}

	_route( F, spot ) {

		const via = this._via( spot ), near = this._near( F, spot );
		const a = Math.hypot( via[ 0 ] - spot[ 0 ], via[ 1 ] - spot[ 1 ] ), b = Math.hypot( near[ 0 ] - via[ 0 ], near[ 1 ] - via[ 1 ] );
		return { pts: [ spot, via, near ], legs: [ a, b ], len: a + b };

	}

	// where he is d along it, and which way he faces going out
	_along( route, d ) {

		const [ p0, p1, p2 ] = route.pts, [ a, b ] = route.legs;
		const [ u, v, k ] = d <= a ? [ p0, p1, d / Math.max( 1e-6, a ) ] : [ p1, p2, Math.min( 1, ( d - a ) / Math.max( 1e-6, b ) ) ];
		return [ u[ 0 ] + ( v[ 0 ] - u[ 0 ] ) * k, u[ 1 ] + ( v[ 1 ] - u[ 1 ] ) * k, Math.atan2( - ( v[ 0 ] - u[ 0 ] ), - ( v[ 1 ] - u[ 1 ] ) ) ];

	}
	// ---- end FB4
	// ---- end FR2

	// the mats and the on-deck hitters' things
	_mats( group, M ) {

		const tex = typeof OffscreenCanvas === 'undefined' ? null : canvasTexture( 512, 512, drawMat, 'onDeckMat' );
		// the mud: on the 27th the hitters' spikes and the rain splatter it with clay, heavier through the
		// night (Getty 83458720, Oct 27); on the 29th a clean mat
		const mat = standard( { name: 'on-deck-mat', roughness: 0.75, color: new Color( 0.8, 0.8, 0.78 ), textures: tex ? { odMat: tex } : {}, modules: [ commonModule ],
			uniforms: { mud: [ 'f32', 0 ] },
			surface: ( tex ? 's.albedo = textureSample( odMat, smpAnisoClamp, in.uv ).rgb * 0.82;' : '' ) + `
	let q = in.uv * 2.0 - 1.0;
	let n1 = mx_noise_float2( in.uv * 11.0 ) * 0.5 + 0.5;
	let n2 = mx_noise_float2( in.uv * 47.0 + 3.0 ) * 0.5 + 0.5;
	// heavier toward the edge the dirt comes in over, and in blots and flecks
	let edge = smoothstep( 0.35, 1.0, length( q ) );
	let m = smoothstep( 0.62, 0.72, n1 * 0.7 + n2 * 0.45 + edge * 0.25 - ( 1.0 - mat.mud ) * 0.8 );
	s.albedo = mix( s.albedo, vec3f( 0.14, 0.07, 0.035 ) * ( 0.8 + 0.4 * n2 ), m );
	s.roughness = mix( 0.75, 0.3, m * frame.wet ) * ( 1.0 - 0.4 * frame.wet );
	s.emissive = s.albedo * smoothstep( 0.2, 0.8, frame.night ) * 0.35;
` } );
		mat.underwaterLighting = 'none';
		this.matMat = mat;
		for ( const side of [ 'home', 'away' ] ) {

			const [ cx, cz ] = ON_DECK[ side ];
			// the disc: its top (the printed face) and its black edge, 1.2 cm proud of the track
			const pos = [], nrm = [], uv = [], index = [];
			const SEG = 40, H = 0.012;
			pos.push( cx, H, cz ); nrm.push( 0, 1, 0 ); uv.push( 0.5, 0.5 );
			for ( let k = 0; k <= SEG; k ++ ) {

				const a = k / SEG * Math.PI * 2, x = Math.cos( a ) * R, z = Math.sin( a ) * R;
				// the edge curls down a touch
				pos.push( cx + x, H, cz + z ); nrm.push( 0, 1, 0 ); uv.push( 0.5 + x / ( 2 * R ) * 0.98, 0.5 + z / ( 2 * R ) * 0.98 );

			}

			for ( let k = 1; k <= SEG; k ++ ) index.push( 0, k + 1, k );
			const g = new BufferGeometry();
			g.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
			g.setAttribute( 'normal', new Float32BufferAttribute( nrm, 3 ) );
			g.setAttribute( 'uv', new Float32BufferAttribute( uv, 2 ) );
			g.setIndex( index );
			g.computeBoundingSphere();
			const top = new Mesh( g, mat );
			top.name = 'on-deck-mat';
			top.receiveShadow = true;
			group.add( top );
			put( group, new CylinderGeometry( R, R + 0.01, H, SEG, 1, true ), M.black, [ cx, H / 2, cz ] );

			// the doughnut, off at the dugout side; the pine tar rag, black-brown and stiff; the rosin bag;
			// a weighted bat lying across the edge
			const toDug = side === 'home' ? 1 : - 1;
			const k = side === 'home' ? 1 : 2;
			const dough = new TorusGeometry( 0.042, 0.022, 8, 18 );
			put( group, dough, M.black, [ cx + toDug * 0.52, H + 0.022, cz + 0.28 ], 0, { rx: Math.PI / 2 } );
			put( group, ragGeometry( k ), M.pineTar, [ cx + toDug * 0.38, H + 0.02, cz + 0.5 ], rnd( k ) * 6 );
			put( group, new BoxGeometry( 0.12, 0.045, 0.085 ), M.white, [ cx + toDug * 0.2, H + 0.022, cz + 0.6 ], rnd( k * 3 ) * 6 );
			// (a bat laid down: its +y, knob to barrel, turned onto ( -cos yaw, 0, sin yaw ))
			const by = toDug * 1.1 + 0.3;
			const wb = put( group, batGeometry(), M.wood, [ cx + toDug * 0.25, H + 0.03, cz + 0.2 ], 0 );
			wb.rotation.set( 0, by, Math.PI / 2, 'YXZ' );
			// its weighted sleeve on the barrel
			const sl = put( group, new CylinderGeometry( 0.036, 0.036, 0.16, 12 ), M.black, [ cx + toDug * 0.25 - Math.cos( by ) * 0.62, H + 0.034, cz + 0.2 + Math.sin( by ) * 0.62 ], 0 );
			sl.rotation.set( 0, by, Math.PI / 2, 'YXZ' );
			// and the bats laid across it, a towel for the grip (heston 2986440499, Game 3)
			for ( const [ ox, oz, turn ] of [ [ - 0.2, - 0.1, 0.35 ], [ 0.05, 0.3, - 0.5 ] ] ) {

				const b = put( group, batGeometry(), rnd( k * 5 + ox ) < 0.5 ? M.wood : M.black, [ cx + toDug * ox, H + 0.032, cz + oz ], 0 );
				b.rotation.set( 0, toDug * ( 1.4 + turn ), Math.PI / 2, 'YXZ' );

			}

			put( group, new BoxGeometry( 0.3, 0.02, 0.22 ), M.white, [ cx - toDug * 0.35, H + 0.012, cz - 0.35 ], 0.4 * toDug );

		}

	}

	// every trip the bat boys make: after each result but a strikeout, the batting side's boy
	_plan( d ) {

		const S = d.segments;
		this.fetches = [];
		S.forEach( ( seg, i ) => {

			if ( seg.kind !== 'result' ) return;
			const cue = ( seg.cues || [] ).find( ( c ) => c[ 1 ].result );
			const type = cue ? cue[ 1 ].result.type || '' : '';
			if ( /strikeout/.test( type ) || ! seg.snap ) return;
			const team = seg.snap.batting;
			const box = boxFor( seg.snap.bats );
			const side = Math.sign( box[ 0 ] ) || - 1;
			// dropped as he set off (in play), or tossed toward the dugout (a walk)
			const prev = S[ i - 1 ];
			const drop = prev && prev.kind === 'inplay' ? prev.t0 + 0.2 : seg.t0 + 0.3;
			const h = rnd( i * 1.7 );
			const at = [ box[ 0 ] + side * ( 0.5 + h * 0.8 ), box[ 1 ] + 0.5 + rnd( i * 2.3 ) * 0.9 ];
			// ---- FB4 (C4B-2): out for it once the ball's away from the plate, while the play's still on (it
			// was from the result, so he was at the bat 1.6-2.9 s into the next walk-up, on the low camera's
			// line to the hitter); not when a runner's coming home (there's a play at the plate)
			const live = prev && prev.kind === 'inplay' && ! prev.plan?.runners?.some( ( r ) => r.to === 4 );
			this.fetches.push( { team, drop, t0: live ? prev.t0 + 2.6 : seg.t0 + 0.6, at, yaw: rnd( i * 3.1 ) * 6.28 } );
			// ---- end FB4

		} );
		// the plate umpire's balls: the fouls go into the stands, and every five or so the Phillies' bat
		// boy runs him out a handful more, between batters (when he isn't out for a bat)
		this.runs = [];
		let fouls = 0;
		for ( const seg of S ) {

			if ( seg.kind === 'pitch' && seg.foul ) fouls ++;
			if ( seg.kind === 'intro' || ( seg.kind === 'switch' && seg.snap?.inning === 6 && seg.snap?.half === 'bottom' ) ) fouls = 0;
			if ( seg.kind !== 'walkup' || fouls < 5 ) continue;
			const busy = this.fetches.some( ( f ) => f.team === 'home' && f.t0 < seg.t0 + 10 && f.t0 + 10 > seg.t0 );
			if ( busy ) continue;
			this.runs.push( { t0: seg.t0 + 0.4 } );
			fouls = 0;

		}

	}

	update( S, dt, director ) {

		if ( ! this.fetches ) this._plan( director );
		// ---- FR2: the boys are the Director's (on the rig): hook in once; the rail's figures stay hidden
		if ( director && this._hooked !== director ) {

			( director.extras ||= [] ).push( ( d, seg, lt, t ) => this._actBoys( d, t ) );
			this._hooked = director;

		}

		// ---- end FR2
		this.matMat.uniforms.mud.value = S.first ? 0.35 + 0.65 * S.progress : 0.08;
		const t = S.t;
		for ( const team of [ 'home', 'away' ] ) {

			const B = this.boys[ team ];
			const { walk, bend, hand, spot, bat } = B;
			walk.shown = bend.shown = hand.shown = false;
			// the bat he goes for, on the ground by the plate until he has it
			let F = null;
			for ( const f of this.fetches ) if ( f.team === team && t >= f.drop && t < f.t0 + 14 ) F = f;
			bat.visible = false;
			if ( F ) {

				const T1 = this._route( F, spot ).len / 4.6, T2 = 1.3; // (---- FB4: round behind the plate)
				const tau = t - F.t0;
				bat.visible = tau < T1 + T2 * 0.5;
				bat.position.set( F.at[ 0 ], 0.032, F.at[ 1 ] );
				bat.rotation.set( 0, F.yaw, Math.PI / 2, 'YXZ' );

			}

		}

	}

}

// a bat lying on its side ( along +y before the tilt ): 34 in, the barrel 2.5 in, the handle 1 in, a knob
let _bat = null;
function batGeometry() {

	if ( _bat ) return _bat;
	const body = new CylinderGeometry( 0.012, 0.032, 0.86, 10 );
	body.translate( 0, 0.43, 0 );
	const knob = new CylinderGeometry( 0.02, 0.02, 0.014, 10 );
	knob.translate( 0, - 0.005, 0 );
	_bat = mergeGeometries( [ body, knob ] );
	return _bat;

}

// a pine tar rag: a stiff crumpled wad
function ragGeometry( k ) {

	const g = new SphereGeometry( 0.075, 7, 5 );
	const p = g.getAttribute( 'position' );
	for ( let i = 0; i < p.count; i ++ ) {

		const j = 0.75 + 0.5 * rnd( k * 31 + i * 1.3 );
		p.setXYZ( i, p.getX( i ) * j * 1.2, p.getY( i ) * 0.35 * j, p.getZ( i ) * j );

	}

	g.computeVertexNormals();
	return g;

}

// the 2008 World Series' 'Fall Classic' logo, as on the on-deck mats (Getty 83458720): a diamond in a
// yellow and blue border on green, MLB's logo at its top, WORLD SERIES across it in blue edged white,
// the red ribbon FALL CLASSIC in yellow, 2008 in blue below
function drawFallClassic( ctx, cx, cy, R ) {

	ctx.save();
	const dia = ( r ) => {

		ctx.beginPath();
		ctx.moveTo( cx, cy - r ); ctx.lineTo( cx + r, cy ); ctx.lineTo( cx, cy + r ); ctx.lineTo( cx - r, cy );
		ctx.closePath();

	};

	dia( R );
	ctx.fillStyle = '#f2ecd8';
	ctx.fill();
	ctx.lineWidth = R * 0.09;
	ctx.strokeStyle = '#e9bd2c';
	ctx.stroke();
	dia( R * 0.9 );
	ctx.fillStyle = '#86b04c';
	ctx.fill();
	ctx.lineWidth = R * 0.025;
	ctx.strokeStyle = '#1d3f9e';
	ctx.stroke();
	mlbLogo( ctx, cx - R * 0.17, cy - R * 0.98, R * 0.34, R * 0.2 );
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.lineJoin = 'round';
	const word = ( t, y, size, width ) => {

		ctx.font = `900 ${ Math.round( size ) }px Georgia, "Times New Roman", serif`;
		ctx.save();
		ctx.translate( cx, y );
		ctx.scale( width / ctx.measureText( t ).width, 1 );
		ctx.lineWidth = size * 0.2;
		ctx.strokeStyle = '#f7f4ea';
		ctx.strokeText( t, 0, 0 );
		ctx.fillStyle = '#1d3f9e';
		ctx.fillText( t, 0, 0 );
		ctx.lineWidth = size * 0.04;
		ctx.strokeStyle = '#c9a44a';
		ctx.strokeText( t, 0, 0 );
		ctx.restore();

	};

	word( 'WORLD', cy - R * 0.36, R * 0.4, R * 1.25 );
	word( 'SERIES', cy + R * 0.02, R * 0.46, R * 1.9 );
	// the ribbon
	ctx.fillStyle = '#c8202e';
	ctx.beginPath();
	ctx.moveTo( cx - R * 0.95, cy + R * 0.26 );
	ctx.quadraticCurveTo( cx, cy + R * 0.42, cx + R * 0.95, cy + R * 0.26 );
	ctx.lineTo( cx + R * 0.95, cy + R * 0.48 );
	ctx.quadraticCurveTo( cx, cy + R * 0.64, cx - R * 0.95, cy + R * 0.48 );
	ctx.closePath();
	ctx.fill();
	ctx.fillStyle = '#f2cf3a';
	ctx.font = `800 ${ Math.round( R * 0.15 ) }px "Helvetica Neue", Arial, sans-serif`;
	ctx.fillText( 'FALL CLASSIC', cx, cy + R * 0.46 );
	ctx.fillStyle = '#1d3f9e';
	ctx.font = `700 ${ Math.round( R * 0.24 ) }px Georgia, serif`;
	ctx.fillText( '2008', cx, cy + R * 0.72 );
	ctx.restore();

}

// the mat's face: the World Series logo on white, scuffed by spikes round where the next man stands,
// clay tracked on, pine tar dripped, rosin dust
function drawMat( ctx, w, h ) {

	const c = w / 2;
	ctx.fillStyle = '#efece4';
	ctx.fillRect( 0, 0, w, h );
	drawFallClassic( ctx, c, c * 1.02, c * 0.62 );
	let s = 7;
	const r = () => {

		s = ( s * 16807 ) % 2147483647;
		return s / 2147483647;

	};
	// clay tracked on, heaviest round the middle
	for ( let i = 0; i < 260; i ++ ) {

		const a = r() * Math.PI * 2, d = Math.pow( r(), 0.6 ) * c * 0.9;
		ctx.fillStyle = `rgba( ${ 120 + r() * 40 | 0 }, ${ 55 + r() * 20 | 0 }, ${ 30 + r() * 10 | 0 }, ${ 0.05 + r() * 0.12 } )`;
		ctx.beginPath();
		ctx.ellipse( c + Math.cos( a ) * d, c + Math.sin( a ) * d, 3 + r() * 14, 2 + r() * 8, r() * 3, 0, Math.PI * 2 );
		ctx.fill();

	}

	// spike marks: short grey scrapes round where he stands
	ctx.strokeStyle = 'rgba( 70, 60, 55, 0.35 )';
	ctx.lineWidth = 1.5;
	for ( let i = 0; i < 90; i ++ ) {

		const a = r() * Math.PI * 2, d = c * ( 0.15 + r() * 0.45 );
		const x = c + Math.cos( a ) * d, y = c + Math.sin( a ) * d, t = r() * Math.PI;
		ctx.beginPath();
		ctx.moveTo( x, y );
		ctx.lineTo( x + Math.cos( t ) * ( 4 + r() * 10 ), y + Math.sin( t ) * ( 4 + r() * 10 ) );
		ctx.stroke();

	}

	// pine tar drips, rosin dust
	for ( let i = 0; i < 14; i ++ ) {

		ctx.fillStyle = 'rgba( 40, 20, 8, 0.7 )';
		ctx.beginPath();
		ctx.arc( c + ( r() - 0.5 ) * w * 0.6, c + ( r() - 0.5 ) * h * 0.6, 1.5 + r() * 3, 0, Math.PI * 2 );
		ctx.fill();

	}

	for ( let i = 0; i < 30; i ++ ) {

		ctx.fillStyle = 'rgba( 255, 255, 250, 0.25 )';
		ctx.beginPath();
		ctx.arc( c + ( r() - 0.5 ) * w * 0.5, c + ( r() - 0.2 ) * h * 0.5, 2 + r() * 6, 0, Math.PI * 2 );
		ctx.fill();

	}

	// the edge worn grey, the black rim
	const g = ctx.createRadialGradient( c, c, c * 0.8, c, c, c );
	g.addColorStop( 0, 'rgba( 90, 80, 70, 0 )' );
	g.addColorStop( 0.9, 'rgba( 90, 80, 70, 0.3 )' );
	g.addColorStop( 1, 'rgba( 20, 20, 20, 1 )' );
	ctx.fillStyle = g;
	ctx.fillRect( 0, 0, w, h );

}
