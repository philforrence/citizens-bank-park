// WA1 (step 10, test/walk-audit.mjs): run in the page by a desk shot's "js". Dumps everything the walker's rules read (the
// colliders' boxes and cylinders, the pit and the field's own heights, the seated fans' grid, the
// elevators and the E interactables) plus random parity queries, so the flood fill can run in Node on
// the same data with the same code (src/world/Colliders.js) and the GPU lock is held only for this.
( async () => {

	const a = __app, C = a.colliders, F = a.field, B = a.bowl, W = a.walker;
	const V = W.position.constructor;
	const tags = [], tagIx = new Map();
	const ti = ( t ) => {

		t = t || '';
		let i = tagIx.get( t );
		if ( i === undefined ) {

			i = tags.length;
			tags.push( t );
			tagIx.set( t, i );

		}
		return i;

	};
	const R = ( v, k = 1000 ) => Math.round( v * k ) / k;
	const boxes = [];
	for ( const b of C.boxes ) boxes.push( R( b.center.x, 1e4 ), R( b.center.y, 1e4 ), R( b.center.z, 1e4 ), R( b.half.x, 1e4 ), R( b.half.y, 1e4 ), R( b.half.z, 1e4 ), R( b.rotY, 1e8 ), ( b.walkable ? 1 : 0 ) | ( b.solid ? 2 : 0 ), ti( b.tag ) );
	const cyl = [];
	for ( const c of C.cylinders ) cyl.push( R( c.x, 1e4 ), R( c.z, 1e4 ), R( c.radius, 1e4 ), R( c.yMin, 1e4 ), R( c.yMax, 1e4 ), ti( c.tag ) );
	// the field's own heights inside the pit (only where not 0), every 0.25 m
	const pit = B.pit;
	let x0 = Infinity, x1 = - Infinity, z0 = Infinity, z1 = - Infinity;
	for ( const [ x, z ] of pit ) {

		x0 = Math.min( x0, x ); x1 = Math.max( x1, x ); z0 = Math.min( z0, z ); z1 = Math.max( z1, z );

	}
	x0 = Math.floor( x0 ) - 1; z0 = Math.floor( z0 ) - 1;
	const S = 0.25, fh = [];
	for ( let i = 0; x0 + i * S <= x1 + 1; i ++ ) for ( let j = 0; z0 + j * S <= z1 + 1; j ++ ) {

		const h = F.fieldHeightAt( x0 + i * S, z0 + j * S );
		if ( h !== 0 ) fh.push( i, j, R( h, 1e4 ) );

	}
	// the seated fans, as _pushFromFans has them (it builds its grid on first use)
	a._pushFromFans( new V( 1e6, - 1e3, 1e6 ), 0.3 );
	const fans = [];
	if ( a._fanGrid ) for ( const cell of a._fanGrid.values() ) for ( let k = 0; k < cell.length; k ++ ) fans.push( R( cell[ k ], 1e3 ) );
	const elev = ( B.elevators || [] ).map( ( b ) => b.stops.map( ( s ) => ( { name: s.name, x: s.x, z: s.z, y: s.y, face: s.face } ) ) );
	const inter = W.interactables.map( ( it ) => {

		let text = '?';
		try {

			text = it.text();

		} catch ( e ) { /* */ }
		return { x: it.x, y: it.y, z: it.z, r: it.radius, text };

	} );
	// parity: the page's answers at random points, to check the Node copy against
	let s = 12345;
	const rnd = () => ( s = ( s * 16807 ) % 2147483647 ) / 2147483647;
	const par = [];
	for ( let k = 0; k < 800; k ++ ) {

		const fx = - 150 + rnd() * 310, fz = - 180 + rnd() * 290, y = R( - 7 + rnd() * 50, 1e4 );
		const w = F.toWorld( fx, fz );
		const wx = R( w.x, 1e4 ), wz = R( w.z, 1e4 );
		const g = W.groundAt( wx, wz, y + 0.67 );
		const p = new V( wx, y, wz );
		C.resolveCapsule( p, 0.3, 1.75, 0.62 );
		const q = new V( wx, y, wz );
		a._pushFromFans( q, 0.3 );
		par.push( [ wx, wz, y, g, p.x, p.z, q.x, q.z ] );

	}
	// the places' own lists of where people walk, if any, for reference: skipped
	return {
		field: { y0: F.y0, cos: F._cos, sin: F._sin, rotY: F.group.rotation.y },
		pit, fh: { x0, z0, S, data: fh }, tags, boxes, cyl, fans, elev, inter, par,
		walker: { pos: [ W.position.x, W.position.y, W.position.z ], yaw: W.yaw, freeCam: a.freeCam },
		counts: { boxes: C.boxes.length, cyl: C.cylinders.length, fans: fans.length / 3, inter: inter.length },
	};

} )()
