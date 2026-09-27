import { Mesh, BufferGeometry, Float32BufferAttribute, CylinderGeometry, TorusGeometry, SphereGeometry, BoxGeometry, Color, mergeGeometries } from '../../../engine/index.js';
import { standard } from '../../../materials/Materials.js';
import { commonModule } from '../../../engine/render/wgsl/common.js';
import { canvasTexture } from '../../geo.js';
import { mlbLogo } from '../../Details2008.js';
import { ON_DECK, boxFor } from '../../game/Plays.js';
import { RAIL, FLAG } from './RailFigures.js';
import { rnd, put } from './Props.js';

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

	}

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
			this.fetches.push( { team, drop, t0: seg.t0 + 0.6, at, yaw: rnd( i * 3.1 ) * 6.28 } );

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

	// the ball run: out to the plate umpire, the balls handed over, back
	_run( B, R, t, dt ) {

		const { walk, hand, spot } = B;
		const to = [ 1.25, 2.35 ];
		const dist = Math.hypot( to[ 0 ] - spot[ 0 ], to[ 1 ] - spot[ 1 ] );
		const T1 = dist / 3.8, T2 = 1.4, T3 = dist / 3.4;
		const tau = t - R.t0;
		const out = Math.atan2( - ( to[ 0 ] - spot[ 0 ] ), - ( to[ 1 ] - spot[ 1 ] ) );
		const walkTo = ( k, a, b, yaw, rate ) => {

			walk.x = a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * k;
			walk.z = a[ 1 ] + ( b[ 1 ] - a[ 1 ] ) * k;
			walk.yaw = yaw;
			B.phase += dt * rate;
			walk.morph = Math.sin( B.phase ) * 1.2;
			walk.y = Math.abs( Math.cos( B.phase ) ) * 0.045;

		};

		if ( tau < T1 ) walkTo( tau / T1, spot, to, out, 11 );
		else if ( tau < T1 + T2 ) {

			// the umpire's to his left: he holds them out, the ump takes them
			walk.shown = false;
			hand.shown = true;
			hand.x = to[ 0 ]; hand.z = to[ 1 ];
			hand.yaw = Math.atan2( - ( 0.35 - to[ 0 ] ), - ( 2.05 - to[ 1 ] ) );
			const k = ( tau - T1 ) / T2;
			hand.morph = Math.sin( Math.PI * Math.min( 1, k * 1.2 ) );
			hand.flags = k > 0.55 ? FLAG.noBall : 0;

		} else if ( tau < T1 + T2 + T3 ) walkTo( ( tau - T1 - T2 ) / T3, to, spot, out + Math.PI, 10 );

	}

	update( S, dt, director ) {

		if ( ! this.fetches ) this._plan( director );
		this.matMat.uniforms.mud.value = S.first ? 0.35 + 0.65 * S.progress : 0.08;
		const t = S.t;
		for ( const team of [ 'home', 'away' ] ) {

			const B = this.boys[ team ];
			// the trip under way (or the bat lying there waiting for him)
			let F = null;
			for ( const f of this.fetches ) if ( f.team === team && t >= f.drop && t < f.t0 + 14 ) F = f;
			const { walk, bend, hand, spot, face, bat } = B;
			walk.shown = true;
			bend.shown = false;
			hand.shown = false;
			walk.flags = FLAG.noGear;
			walk.x = spot[ 0 ]; walk.z = spot[ 1 ]; walk.y = 0; walk.yaw = face; walk.morph = 0;
			// idle, he watches the plate: his head follows the hitter
			walk.look[ 0 ] = 0;
			bat.visible = false;
			if ( F ) {

				const near = [ F.at[ 0 ] + ( spot[ 0 ] - F.at[ 0 ] ) * 0.55 / Math.hypot( spot[ 0 ] - F.at[ 0 ], spot[ 1 ] - F.at[ 1 ] ), F.at[ 1 ] + ( spot[ 1 ] - F.at[ 1 ] ) * 0.55 / Math.hypot( spot[ 0 ] - F.at[ 0 ], spot[ 1 ] - F.at[ 1 ] ) ];
				const dist = Math.hypot( near[ 0 ] - spot[ 0 ], near[ 1 ] - spot[ 1 ] );
				const T1 = dist / 3.8, T2 = 1.3, T3 = dist / 3.3;
				const tau = t - F.t0;
				const out = [ - ( near[ 0 ] - spot[ 0 ] ), - ( near[ 1 ] - spot[ 1 ] ) ];
				const yawOut = Math.atan2( out[ 0 ], out[ 1 ] ), yawBack = yawOut + Math.PI;
				// the bat on the ground until he has it
				bat.visible = tau < T1 + T2 * 0.5;
				bat.position.set( F.at[ 0 ], 0.032, F.at[ 1 ] );
				bat.rotation.set( 0, F.yaw, Math.PI / 2, 'YXZ' );
				if ( tau >= 0 && tau < T1 ) {

					const k = tau / T1;
					walk.x = spot[ 0 ] + ( near[ 0 ] - spot[ 0 ] ) * k;
					walk.z = spot[ 1 ] + ( near[ 1 ] - spot[ 1 ] ) * k;
					walk.yaw = yawOut;
					B.phase += dt * 11;
					walk.morph = Math.sin( B.phase ) * 1.25;
					walk.y = Math.abs( Math.cos( B.phase ) ) * 0.05;

				} else if ( tau >= T1 && tau < T1 + T2 ) {

					// down for it and up with it
					walk.shown = false;
					bend.shown = true;
					bend.x = near[ 0 ]; bend.z = near[ 1 ]; bend.yaw = yawOut;
					const k = ( tau - T1 ) / T2;
					bend.morph = Math.sin( Math.PI * Math.min( 1, k * 1.1 ) );
					bend.flags = k < 0.5 ? FLAG.noGear : 0;

				} else if ( tau >= T1 + T2 && tau < T1 + T2 + T3 ) {

					const k = ( tau - T1 - T2 ) / T3;
					walk.x = near[ 0 ] + ( spot[ 0 ] - near[ 0 ] ) * k;
					walk.z = near[ 1 ] + ( spot[ 1 ] - near[ 1 ] ) * k;
					walk.yaw = yawBack;
					walk.flags = 0;
					B.phase += dt * 10;
					walk.morph = Math.sin( B.phase ) * 1.1;
					walk.y = Math.abs( Math.cos( B.phase ) ) * 0.04;

				}

			}

			// the Phillies' boy's ball runs to the plate umpire
			if ( team === 'home' && ! F ) {

				const Rn = this.runs.find( ( r ) => t >= r.t0 && t < r.t0 + 10 );
				if ( Rn ) this._run( B, Rn, t, dt );

			}

			// wet on the 27th (he's out in it)
			walk.wet = bend.wet = hand.wet = S.first ? S.rain * 0.7 : 0;

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
