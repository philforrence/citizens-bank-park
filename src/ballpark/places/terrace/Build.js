import { Mesh, Color } from '../../../engine/index.js';
import { commonModule } from '../../../engine/render/wgsl/common.js';
import { standard } from '../../../materials/Materials.js';
import { Quads, tierSections } from '../../Stands.js';
import { offsetPolyline } from '../../Bowl.js';
import { canvasTexture } from '../../geo.js';
import { LEVELS } from '../../layout.js';
import { Pal, STEEL_WGSL, wide, pipe, hidDome, stations, obox } from '../../ConcourseSteel.js';
import { terraceSection } from '../../Concourse.js';

// FW3 (C2W-7, gauntlet r2): the Terrace concourse's fabric, between the 300s and the 400s. As the 2008
// photos and guides have it (Anfony79, <= May 2008, behind 332; newballpark.org, June 2008; Commons
// 2008-03-29, the 3B decks from the left field corner; the October 2008 Convenience Guide: "The Terrace
// Level concourse provides a similar openness"):
//   the floor, sealed concrete from the rail at the 300s' back to the 400s' back, saw-cut every 3 m, worn
//     in the walking lanes, wet at its open front on the 27th;
//   the rail along the 300s' back: a precast curb, glass panels, a galvanized top rail, open at every
//     aisle head, the section's plate (white, "332 / SECTION") hung over each;
//   the 400s overhead on maroon raker girders, a wide-flange column under their front every bay, a
//     beam along the fascia's back, HID domes in the bays, a white sprinkler main;
//   the stairs up to the 400s, steel, running along the concourse and up into the deck at each of the
//     400s' boxes (Stands.js portals), a dark well where they go through;
//   along the back, between the stands (Concourse.terrace()), a pipe guard over the outer ring's roof.
// One palette mesh for the steel (ConcourseSteel's), the floor's own, the glass's, the plates'.
// Field frame. Returns the lamps (the domes, for the local lights), the walk line and the rail line.

const Y = LEVELS.terraceConcourse;

export function buildTerrace( group, bowl ) {

	const D = bowl.D, main = bowl.path.slice( 2 );
	const t300 = bowl.upper.find( ( t ) => t.name === 'terrace-300' ), t400 = bowl.upper.find( ( t ) => t.name === 'terrace-400' );
	const line = ( d ) => offsetPolyline( main, d, [ 0, - 40 ] );
	const rake = ( t400.rows - 1 ) * t400.rise / ( t400.rows * t400.depth );
	// the 400s' underside d back from the path (in front of their front: its foot)
	const under = ( d ) => t400.y0 - t400.soffit + Math.max( 0, d - D.t400 ) * rake;
	const dRail = D.t300Back, dBack = D.t400Back - 0.4;
	const q = new Pal(), up = [ 0, 1, 0 ];
	const lamps = [];
	const out = { lamps, meshes: [] };

	// ---------------------------------------------------------------- the floor
	{

		const A = line( dRail ), B = line( dBack ), f = new Quads();
		let u = 0;
		for ( let i = 0; i < A.length - 1; i ++ ) {

			const l = Math.hypot( A[ i + 1 ][ 0 ] - A[ i ][ 0 ], A[ i + 1 ][ 1 ] - A[ i ][ 1 ] );
			const w = dBack - dRail;
			const a = [ A[ i ][ 0 ], Y, A[ i ][ 1 ] ], b = [ A[ i + 1 ][ 0 ], Y, A[ i + 1 ][ 1 ] ], c = [ B[ i + 1 ][ 0 ], Y, B[ i + 1 ][ 1 ] ], d = [ B[ i ][ 0 ], Y, B[ i ][ 1 ] ];
			f.tri( a, b, c, up, [ u, 0 ], [ u + l, 0 ], [ u + l, w ] );
			f.tri( a, c, d, up, [ u, 0 ], [ u + l, w ], [ u, w ] );
			u += l;

		}

		const m = standard( { name: 'terrace-floor', color: new Color( 0.36, 0.35, 0.33 ), roughness: 0.65, modules: [ commonModule ],
			surface: /* wgsl */`
	// uv: x along the concourse (m), y back from the rail (m)
	let fw = fwidth( in.uv.x ) + 0.001;
	let j = abs( fract( in.uv.x / 3.0 ) - 0.5 ) * 3.0;
	let joint = ( 1.0 - smoothstep( 0.0, 0.012 + fw, j ) ) * ( 1.0 - clamp( fw * 8.0, 0.0, 1.0 ) );
	// the 400s' drip edge 2.4 m back: a line of stain where the deck's run-off lands
	let drip = exp( - pow( ( in.uv.y - 2.45 ) / 0.25, 2.0 ) );
	// the lanes worn darker and smoother, gum, a season's spills by the stands
	let lane = smoothstep( 2.8, 4.5, in.uv.y ) * ( 1.0 - smoothstep( 9.0, 11.5, in.uv.y ) );
	let n1 = mx_noise_float2( in.P.xz * 0.35 );
	let n2 = mx_noise_float2( in.P.xz * 2.3 );
	let gum = step( 0.86, mx_noise_float2( in.P.xz * 9.0 ) ) * lane;
	var c = vec3f( 0.27, 0.265, 0.25 ) * ( 0.88 + 0.12 * n1 + 0.05 * n2 );
	c = c * ( 1.0 - 0.12 * lane - 0.25 * joint - 0.15 * drip ) * ( 1.0 - 0.5 * gum );
	c = c * ( 1.0 - 0.1 * smoothstep( 9.5, 12.0, in.uv.y ) * smoothstep( 0.4, 0.8, n1 ) );
	// open to the sky in front of the 400s: wet on the 27th
	let wet = frame.wet * ( 1.0 - smoothstep( 2.0, 2.9, in.uv.y ) );
	s.albedo = c * ( 1.0 - 0.35 * wet );
	s.roughness = mix( 0.7 - 0.12 * lane, 0.15, wet );
` } );
		m.underwaterLighting = 'none';
		const mesh = new Mesh( f.geometry(), m );
		mesh.name = 'terrace-floor';
		mesh.receiveShadow = true;
		mesh.userData.dynamic = true;
		group.add( mesh );
		out.meshes.push( mesh );
		// the bowl's own grey slab there (its walkable colliders stay)
		bowl.group.traverse( ( o ) => {

			if ( o.isMesh && o.name === 'terrace-walkway' ) o.visible = false;

		} );

	}

	// ---------------------------------------------------------------- the steel overhead
	const cols = stations( line( dBack ), 9.5 );
	const dCol = D.t400 + 1.1, GD = 0.75;
	for ( let i = 0; i < cols.length; i ++ ) {

		const st = cols[ i ];
		// along the station's normal (toward the field) from the back line
		const at = ( d, y ) => [ st.x + st.nx * ( dBack - d ), y, st.z + st.nz * ( dBack - d ) ];
		// the column under the 400s' front, on its base plate
		const top = under( dCol ) - GD;
		q.use( 'maroon' );
		wide( q, at( dCol, Y + 0.02 ), at( dCol, top ), [ st.nx, 0, st.nz ], 0.36, 0.3 );
		q.use( 'galv' );
		obox( q, at( dCol, Y + 0.02 ), [ st.ux, 0, st.uz ], 0.55, up, 0.04, [ st.nx, 0, st.nz ], 0.55 );
		// the raker girder under the deck from the fascia to the back
		q.use( 'maroon' );
		wide( q, at( D.t400 + 0.25, under( D.t400 + 0.25 ) - GD / 2 ), at( dBack - 0.2, under( dBack - 0.2 ) - GD / 2 ), up, GD, 0.3, 0.035, 0.022, 2.4 );
		// knee braces off the column to the girder, both ways
		for ( const s of [ - 1, 1 ] ) {

			const d2 = dCol + s * 1.8;
			if ( d2 < D.t400 + 0.3 ) continue;
			pipe( q, at( dCol, top - 1.6 ), at( d2, under( d2 ) - GD + 0.05 ), 0.07, 4 );

		}

		// the bay to the next station: a beam along the fascia's back, joists, two domes, the sprinkler main
		const nx = cols[ i + 1 ];
		if ( ! nx || Math.hypot( nx.x - st.x, nx.z - st.z ) > 13 ) continue;
		const at2 = ( d, y ) => [ nx.x + nx.nx * ( dBack - d ), y, nx.z + nx.nz * ( dBack - d ) ];
		q.use( 'maroon' );
		wide( q, at( D.t400 + 0.35, under( D.t400 + 0.35 ) - 0.32 ), at2( D.t400 + 0.35, under( D.t400 + 0.35 ) - 0.32 ), up, 0.6, 0.24, 0.03, 0.018, 2.4 );
		for ( let d = D.t400 + 2.6; d < dBack - 0.5; d += 2.4 ) {

			q.use( 'maroon' );
			wide( q, at( d, under( d ) - 0.16 ), at2( d, under( d ) - 0.16 ), up, 0.3, 0.12, 0.02, 0.012 );

		}

		for ( const d of [ D.t400 + 4.2, D.t400 + 9.4 ] ) {

			const a = at( d, 0 ), b = at2( d, 0 );
			const x = ( a[ 0 ] + b[ 0 ] ) / 2, z = ( a[ 2 ] + b[ 2 ] ) / 2;
			const yb = Math.max( Y + 4.1, under( d ) - 2.2 );
			hidDome( q, x, yb, z, under( d ) - 0.05 );
			lamps.push( [ x, yb - 0.05, z ] );

		}

		q.use( 'pipe' );
		pipe( q, at( D.t400 + 6.8, under( D.t400 + 6.8 ) - 0.45 ), at2( D.t400 + 6.8, under( D.t400 + 6.8 ) - 0.45 ), 0.07, 6 );

	}

	// the deck itself under the 400s, 4 cm under their soffit: galvanized ribbed deck gone dull, the joists'
	// lines, not taking the shadow map (the bowl's soffit there, lit by the sky and shadowed at a grazing
	// angle, showed the map's acne: a pale blotched strip along the fascia, as C2W-17's over the SRO rail)
	{

		const dq = new Quads(), secs = tierSections( t400 ), dB = t400.rows * t400.depth;
		for ( const S of secs ) {

			const e = ( d ) => [ Math.min( S.len, S.m0 * d ), Math.max( Math.min( S.len, S.m0 * d ), S.len - S.m1 * d ) ];
			const at = ( s, d ) => [ S.a[ 0 ] + S.ux * s + S.nx * d, t400.y0 - t400.soffit - 0.04 + d * rake, S.a[ 1 ] + S.uz * s + S.nz * d ];
			const [ f0, f1 ] = e( 0.02 ), [ b0, b1 ] = e( dB - 0.02 );
			dq.add( at( f0, 0.02 ), at( f1, 0.02 ), at( b1, dB - 0.02 ), at( b0, dB - 0.02 ), [ S.nx * rake, - 1, S.nz * rake ] );

		}

		const m = standard( { name: 'terrace-deck', color: new Color( 0.2, 0.2, 0.2 ), roughness: 0.55, metalness: 0.3,
			surface: /* wgsl */`
	let fw = fwidth( in.P.x ) + fwidth( in.P.z ) + 0.001;
	let rib = 0.72 + 0.28 * smoothstep( 0.16, 0.3, abs( fract( ( in.P.x + in.P.z ) / 0.42 ) - 0.5 ) );
	let sheet = fract( sin( dot( floor( in.P.xz / vec2f( 6.0, 0.9 ) ), vec2f( 12.9898, 78.233 ) ) ) * 43758.5453 );
	s.albedo = vec3f( 0.2, 0.202, 0.2 ) * ( 0.85 + 0.15 * sheet ) * mix( rib, 0.86, clamp( fw * 5.0, 0.0, 1.0 ) );
	s.emissive = s.albedo * mix( 0.1, 0.04, smoothstep( 0.1, 0.7, frame.night ) );
` } );
		m.underwaterLighting = 'none';
		m.setDefine( 'DRY', 1 );
		const mesh = new Mesh( dq.geometry(), m );
		mesh.name = 'terrace-deck';
		mesh.receiveShadow = false;
		mesh.userData.dynamic = true;
		group.add( mesh );
		out.meshes.push( mesh );

	}

	// ---------------------------------------------------------------- the rail at the 300s' back
	// the 300s' aisle heads (where the rail opens) and their sections' plates
	const glass = new Quads(), heads = [];
	{

		const secs = tierSections( t300 ), dTop = t300.rows * t300.depth;
		for ( let k = 0; k < secs.length - 1; k ++ ) {

			const S = secs[ k ], T = secs[ k + 1 ];
			if ( ! S.seats && ! T.seats ) continue;
			const s = S.len - S.m1 * dTop;
			const x = S.a[ 0 ] + S.ux * s + S.nx * dTop, z = S.a[ 1 ] + S.uz * s + S.nz * dTop;
			heads.push( { x, z, ux: S.ux, uz: S.uz, nx: S.nx, nz: S.nz, sec: [ Math.round( terraceSection( S.a[ 0 ] + S.ux * S.len * 0.5 + S.nx * dTop, S.a[ 1 ] + S.uz * S.len * 0.5 + S.nz * dTop ) ), Math.round( terraceSection( T.a[ 0 ] + T.ux * T.len * 0.5 + T.nx * dTop, T.a[ 1 ] + T.uz * T.len * 0.5 + T.nz * dTop ) ) ], seats: [ S.seats, T.seats ] } );

		}

		// along the rail line, segment by segment, open 1.3 m at each head (behind home plate unbroken: there
		// the press box's roof is in front of it, level with the floor, FOX's high cameras on it)
		const R = line( dRail + 0.12 );
		for ( let i = 0; i < R.length - 1; i ++ ) {

			const [ ax, az ] = R[ i ], [ bx, bz ] = R[ i + 1 ];
			const len = Math.hypot( bx - ax, bz - az );
			if ( len < 0.5 ) continue;
			const ux = ( bx - ax ) / len, uz = ( bz - az ) / len;
			// the openings along this segment (heads within 1 m of it)
			const opens = heads.filter( ( h ) => {

				const t = ( h.x - ax ) * ux + ( h.z - az ) * uz;
				const off = Math.abs( ( h.x - ax ) * uz - ( h.z - az ) * ux );
				return t > - 0.5 && t < len + 0.5 && off < 1.0;

			} ).map( ( h ) => ( h.x - ax ) * ux + ( h.z - az ) * uz ).sort( ( p, r ) => p - r );
			const runs = [];
			let t0 = 0;
			for ( const t of opens ) {

				if ( t - 0.65 > t0 ) runs.push( [ t0, t - 0.65 ] );
				t0 = t + 0.65;

			}

			if ( len > t0 ) runs.push( [ t0, len ] );
			const P = ( t, y ) => [ ax + ux * t, y, az + uz * t ];
			for ( const [ r0, r1 ] of runs ) {

				if ( r1 - r0 < 0.3 ) continue;
				// the curb, the glass on it, the posts, the top rail and the shoe rail
				q.use( 'concrete' );
				obox( q, [ ( P( r0, 0 )[ 0 ] + P( r1, 0 )[ 0 ] ) / 2, Y + 0.15, ( P( r0, 0 )[ 2 ] + P( r1, 0 )[ 2 ] ) / 2 ], [ ux, 0, uz ], r1 - r0, up, 0.3, [ - uz, 0, ux ], 0.22 );
				glass.add( P( r0, Y + 0.32 ), P( r1, Y + 0.32 ), P( r1, Y + 1.02 ), P( r0, Y + 1.02 ), [ - uz, 0, ux ], r0, r1 );
				q.use( 'galv' );
				pipe( q, P( r0, Y + 1.07 ), P( r1, Y + 1.07 ), 0.025, 6 );
				pipe( q, P( r0, Y + 0.34 ), P( r1, Y + 0.34 ), 0.015, 4 );
				const n = Math.max( 1, Math.round( ( r1 - r0 ) / 1.5 ) );
				for ( let k = 0; k <= n; k ++ ) pipe( q, P( r0 + ( r1 - r0 ) * k / n, Y + 0.3 ), P( r0 + ( r1 - r0 ) * k / n, Y + 1.07 ), 0.022, 4 );

			}

		}

	}

	// the plates over the aisle heads, hung from the fascia's back beam, facing in: "3xx / SECTION"
	{

		const nums = [];
		for ( let k = 310; k <= 335; k ++ ) nums.push( k );
		const tex = canvasTexture( 512, 1024, ( ctx ) => {

			nums.forEach( ( k, i ) => {

				const x = ( i % 4 ) * 128, y = Math.floor( i / 4 ) * 128;
				ctx.fillStyle = '#1c1d1f';
				ctx.fillRect( x, y, 128, 64 );
				ctx.fillStyle = '#f1f0ea';
				ctx.fillRect( x + 3, y + 3, 122, 58 );
				ctx.fillStyle = '#16171a';
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.font = 'bold 34px "Helvetica Neue", Helvetica, Arial, sans-serif';
				ctx.fillText( String( k ), x + 64, y + 24 );
				ctx.font = 'bold 11px "Helvetica Neue", Helvetica, Arial, sans-serif';
				ctx.fillText( 'S E C T I O N', x + 64, y + 50 );

			} );

		}, 'terracePlates' );
		const pq = new Quads();
		const cell = ( k ) => {

			const i = Math.max( 0, Math.min( nums.length - 1, k - 310 ) );
			const x = ( i % 4 ) * 128, y = Math.floor( i / 4 ) * 128;
			return [ x / 512, y / 1024, ( x + 128 ) / 512, ( y + 64 ) / 1024 ];

		};
		const dP = D.t400 + 0.45;
		for ( const h of heads ) {

			// the head's place on the plate line, and the plate square to the rail (its face toward the back)
			const x = h.x + h.nx * ( dP - dRail ), z = h.z + h.nz * ( dP - dRail );
			const y0 = under( dP ) - 0.62 - 0.55, y1 = y0 + 0.55;
			const w = 1.1;
			const [ ux, uz ] = [ h.ux, h.uz ];
			// one plate each side of the head, for its two sections (the side it's on), back to back with a gap
			for ( const [ side, sec, seats ] of [ [ - 1, h.sec[ 0 ], h.seats[ 0 ] ], [ 1, h.sec[ 1 ], h.seats[ 1 ] ] ] ) {

				if ( ! seats ) continue;
				const cx = x + ux * side * 0.62, cz = z + uz * side * 0.62;
				const [ u0, v0, u1, v1 ] = cell( sec );
				// facing back (into the concourse: +n), read by someone looking toward the field: their right
				const rx = h.nz, rz = - h.nx;
				const a = [ cx - rx * w / 2, y0, cz - rz * w / 2 ], b = [ cx + rx * w / 2, y0, cz + rz * w / 2 ];
				const c = [ cx + rx * w / 2, y1, cz + rz * w / 2 ], d = [ cx - rx * w / 2, y1, cz - rz * w / 2 ];
				pq.tri( a, b, c, [ h.nx, 0, h.nz ], [ u0, v1 ], [ u1, v1 ], [ u1, v0 ] );
				pq.tri( a, c, d, [ h.nx, 0, h.nz ], [ u0, v1 ], [ u1, v0 ], [ u0, v0 ] );
				q.use( 'black' );
				for ( const e of [ - 0.4, 0.4 ] ) pipe( q, [ cx + ux * e, y1, cz + uz * e ], [ cx + ux * e, under( dP ) - 0.62, cz + uz * e ], 0.008, 3 );

			}

		}

		const m = standard( { name: 'terrace-plates', roughness: 0.5, textures: { tpPlate: tex },
			surface: 'let t = textureSample( tpPlate, smpAnisoClamp, in.uv ).rgb; s.albedo = t * 0.85; s.emissive = t * 0.06 * smoothstep( 0.1, 0.7, frame.night );' } );
		m.underwaterLighting = 'none';
		const mesh = new Mesh( pq.geometry(), m );
		mesh.name = 'terrace-plates';
		mesh.userData.dynamic = true;
		group.add( mesh );
		out.meshes.push( mesh );

	}

	// ---------------------------------------------------------------- the stairs up to the 400s
	// At each of the 400s' boxes (Stands.js portals: rows 2-5 of every other section) a steel stair runs
	// along the concourse under the deck and up through it into the box: 7 m long, risers of 18 cm, treads
	// of 28, two maroon stringers, galvanized treads, a handrail each side; where it goes through, the well
	// dark. Their feet (for the ushers) in out.stairs.
	const well = new Quads();
	out.stairs = [];
	{

		const PO = t400.portals, secs = tierSections( t400 ), Dd = t400.depth;
		secs.forEach( ( S, k ) => {

			if ( ! PO || ! S.seats || S.len < PO.width + 3 || ( S.pk ?? k ) % PO.every !== Math.floor( PO.every / 2 ) ) return;
			const s0 = S.len / 2;
			const dF = PO.row * Dd, dB = ( PO.row + PO.rows ) * Dd, dm = ( dF + dB ) / 2;
			const yF = t400.y0 + ( PO.row - 1 ) * t400.rise;
			const at = ( s, d, y ) => [ S.a[ 0 ] + S.ux * s + S.nx * d, y, S.a[ 1 ] + S.uz * s + S.nz * d ];
			// alternate which way they climb
			const dir = k % 4 < 2 ? 1 : - 1;
			const rise = yF - Y, nSteps = Math.round( rise / 0.18 ), r = rise / nSteps, run = 0.28;
			const sTop = s0 + dir * 0.9, sFoot = sTop - dir * nSteps * run;
			const W = 1.5;
			const ux = S.ux * dir, uz = S.uz * dir;
			for ( let j = 0; j < nSteps; j ++ ) {

				const sj = sFoot + dir * ( j + 0.5 ) * run, yj = Y + ( j + 1 ) * r;
				q.use( 'galv' );
				obox( q, at( sj, dm, yj - 0.02 ), [ ux, 0, uz ], run + 0.02, up, 0.04, [ S.nx, 0, S.nz ], W );

			}

			// the stringers, the handrails on their posts
			for ( const e of [ - 1, 1 ] ) {

				const dd = dm + e * ( W / 2 + 0.04 );
				q.use( 'maroon' );
				wide( q, at( sFoot, dd, Y + 0.12 ), at( sTop, dd, yF - 0.12 ), [ - ux * 0.5, 1, - uz * 0.5 ], 0.3, 0.08, 0.012, 0.01 );
				q.use( 'galv' );
				pipe( q, at( sFoot - dir * 0.3, dd, Y + 0.95 ), at( sTop, dd, yF + 0.95 ), 0.022, 5 );
				for ( let t = 0; t <= 1.001; t += 0.25 ) {

					const ss = sFoot + ( sTop - sFoot ) * t, yy = Y + rise * t;
					pipe( q, at( ss, dd, yy ), at( ss, dd, yy + 0.95 ), 0.02, 4 );

				}

			}

			// a post under its middle, down to the floor
			q.use( 'maroon' );
			const mid = ( sFoot + sTop ) / 2;
			wide( q, at( mid, dm, Y + 0.02 ), at( mid, dm, Y + rise / 2 - 0.2 ), [ S.nx, 0, S.nz ], 0.2, 0.2 );
			// the well through the deck: dark under the hole, its lining showing a little below the soffit
			const yU = ( d ) => t400.y0 - t400.soffit + d * rake - 0.07; // (under the deck: terrace-deck)
			const w2 = PO.width / 2 + 0.3;
			well.add( at( s0 - w2, dF, yU( dF ) ), at( s0 + w2, dF, yU( dF ) ), at( s0 + w2, dB, yU( dB ) ), at( s0 - w2, dB, yU( dB ) ), [ 0, - 1, 0 ] );
			for ( const e of [ - 1, 1 ] ) well.add( at( s0 + e * w2, dF, yU( dF ) - 0.3 ), at( s0 + e * w2, dB, yU( dB ) - 0.3 ), at( s0 + e * w2, dB, yU( dB ) ), at( s0 + e * w2, dF, yU( dF ) ), [ - S.ux * e, 0, - S.uz * e ] );
			well.add( at( s0 - w2, dB, yU( dB ) - 0.3 ), at( s0 + w2, dB, yU( dB ) - 0.3 ), at( s0 + w2, dB, yU( dB ) ), at( s0 - w2, dB, yU( dB ) ), [ - S.nx, 0, - S.nz ] );
			const foot = at( sFoot - dir * 0.9, dm, Y );
			out.stairs.push( { foot: [ foot[ 0 ], foot[ 2 ] ], u: [ ux, uz ], n: [ S.nx, S.nz ], sec: Math.round( terraceSection( foot[ 0 ], foot[ 2 ] ) ) + 100 } );

		} );
		const wm = standard( { name: 'terrace-well', color: new Color( 0.02, 0.02, 0.022 ), roughness: 0.9 } );
		wm.underwaterLighting = 'none';
		const mesh = new Mesh( well.geometry(), wm );
		mesh.name = 'terrace-wells';
		mesh.userData.dynamic = true;
		group.add( mesh );
		out.meshes.push( mesh );

	}

	// ---------------------------------------------------------------- the back: a pipe guard in the open bays
	out.backRail = ( open ) => {

		for ( const U of open ) {

			const W = 4.35, d = 4.5 + 0.25; // from the units' front line out to just inside the back line (its collider)
			const P = ( x, y ) => [ U.mid[ 0 ] + U.a[ 0 ] * x - U.n[ 0 ] * d, y, U.mid[ 1 ] + U.a[ 1 ] * x - U.n[ 1 ] * d ];
			q.use( 'galv' );
			pipe( q, P( - W, Y + 1.07 ), P( W, Y + 1.07 ), 0.025, 6 );
			pipe( q, P( - W, Y + 0.55 ), P( W, Y + 0.55 ), 0.018, 5 );
			for ( let k = 0; k <= 4; k ++ ) pipe( q, P( - W + 2 * W * k / 4, Y ), P( - W + 2 * W * k / 4, Y + 1.07 ), 0.022, 4 );
			q.use( 'concrete' );
			obox( q, P( 0, Y + 0.08 ), [ U.a[ 0 ], 0, U.a[ 1 ] ], 2 * W, up, 0.16, [ U.n[ 0 ], 0, U.n[ 1 ] ], 0.25 );

		}

	};

	// ---------------------------------------------------------------- into meshes
	out.finish = () => {

		const mat = standard( { name: 'terrace-steel', roughness: 0.5, surface: STEEL_WGSL } );
		mat.underwaterLighting = 'none';
		mat.setDefine( 'DRY', 1 );
		const mesh = new Mesh( q.geometry(), mat );
		mesh.name = 'terrace-steel';
		mesh.receiveShadow = true;
		mesh.userData.dynamic = true;
		group.add( mesh );
		out.meshes.push( mesh );
		// the glass on the rail: a faint tint, the lights in it at a glance
		const gm = standard( { name: 'terrace-glass', color: new Color( 0.05, 0.06, 0.065 ), roughness: 0.05, metalness: 0.1, transparent: true, depthWrite: false, side: 'double', modules: [ commonModule ],
			surface: /* wgsl */`
	let N = normalize( in.N );
	let V = normalize( frame.cameraPos - in.P );
	let fres = pow( 1.0 - clamp( abs( dot( N, V ) ), 0.0, 1.0 ), 4.0 );
	s.albedo = mat.color;
	s.alpha = 0.1 + 0.5 * fres;
` } );
		gm.underwaterLighting = 'none';
		gm.setDefine( 'DRY', 1 );
		const g = new Mesh( glass.geometry(), gm );
		g.name = 'terrace-glass';
		g.layers.set( 2 );
		g.userData.dynamic = true;
		group.add( g );
		out.meshes.push( g );

	};

	out.line = line;
	out.under = under;
	out.dRail = dRail;
	out.dBack = dBack;
	out.heads = heads;
	return out;

}
