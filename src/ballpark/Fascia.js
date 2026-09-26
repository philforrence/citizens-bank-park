import { Group, Mesh } from '../engine/index.js';
import { standard } from '../materials/Materials.js';
import { Quads } from './Stands.js';
import { canvasTexture } from './geo.js';
import { generateMipmaps } from '../engine/gpu/Mipmaps.js';

// The fronts of the decks as they were for the 2008 World Series (from photos of Games 3-5):
//   - the LED ribbon board along the suite level round the infield: WORLD SERIES 2008 on FOX, the batter,
//     the score, the MLB notes scrolling by, and 2008 WORLD CHAMPIONS at the end,
//   - red, white and blue bunting fans hung on the Hall of Fame Club's fascia and the Pavilion's,
//   - lit ad panels (MasterCard, Nike, Sherwin-Williams, AIG, ...) and LED segments along the Terrace
//     (300s) fascia from pole to pole,
//   - Toyota's "Fast Ball Pitch Speed" board on the Pavilion, showing each pitch's speed.
// Field frame, in the Field's group. update() follows the replay.

const RIB_W = 2048, RIB_H = 96; // the ribbon's texture: one repeat
const RIB_M = 0.95; // the ribbon's height (m)
const RIB_TILE = RIB_M * RIB_W / RIB_H; // one repeat along the ribbon (m), square LEDs
const AD_H = 128; // the ad atlas: one ad per row, 128 px high, as wide as its panel needs
const PANEL_M = 0.95; // lit panels' height (m)

// the ads, drawn in their spirit (colors and words from the photos); width in metres
const ADS = {
	mastercard: { w: 7.0, draw: drawMasterCard },
	nike: { w: 7.0, draw: drawNike },
	sherwin: { w: 4.0, draw: drawSherwin },
	aig: { w: 4.0, draw: drawAIG },
	mcdonalds: { w: 6.0, draw: drawMcDonalds },
	canon: { w: 5.0, draw: ( c, w, h ) => wordmark( c, w, h, '#ffffff', '#cc0000', 'Canon', 'italic 800 96px Georgia, serif' ) },
	herrs: { w: 5.0, draw: drawHerrs },
	lg: { w: 5.0, draw: drawLG },
	autotrader: { w: 7.0, draw: drawAutoTrader },
	budweiser: { w: 6.0, draw: ( c, w, h ) => wordmark( c, w, h, '#b5121b', '#ffffff', 'Budweiser', 'italic 700 92px Georgia, serif', 'KING OF BEERS' ) },
	budlight: { w: 4.5, draw: ( c, w, h ) => wordmark( c, w, h, '#0a4aa8', '#ffffff', 'Bud Light', 'italic 800 84px Georgia, serif' ) },
	toyota: { w: 4.5, draw: drawToyota },
	citizens: { w: 6.0, draw: drawCitizens },
	comcast: { w: 5.0, draw: ( c, w, h ) => wordmark( c, w, h, '#ffffff', '#1a1a1a', 'comcast', '800 84px "Helvetica Neue", Arial, sans-serif' ) },
};

// the Terrace fascia from behind home plate outward (mirrored on the other side); LED = a ribbon segment
const TERRACE = [ 'LED:9', 'mastercard', 'nike', 'sherwin', 'LED:9', 'aig', 'aig', '-:3', 'mcdonalds', 'canon', 'LED:8', 'herrs', 'lg', 'autotrader', '-:3', 'budweiser', 'LED:8', 'citizens', 'comcast', '-:4', 'nike', 'mastercard', 'LED:8' ];

export class Fascia {

	constructor( { field, bowl } ) {

		this.field = field;
		this.bowl = bowl;
		this.group = new Group();
		this.group.name = 'fascia-2008';
		field.group.add( this.group );
		const tier = ( name ) => bowl.upper.find( ( t ) => t.name === name );
		this._atlas();
		this._ribbon( tier( 'suite-seats' ) );
		this._terrace( tier( 'terrace-300' ) );
		this._pavilion( tier( 'pavilion' ) );
		this._lfDeck( tier( 'lf-deck' ) );
		this._bunting( [ tier( 'club-level' ), tier( 'pavilion' ) ] );
		this._key = '';
		this._pitchKey = '';

	}

	// ---------------------------------------------------------------- the pieces

	// the ads, one row each
	_atlas() {

		const names = Object.keys( ADS );
		this.atlasRows = {};
		const W = 1024, H = AD_H * names.length;
		const tex = canvasTexture( W, H, ( ctx ) => {

			names.forEach( ( n, i ) => {

				const pw = Math.min( W, Math.round( AD_H * ADS[ n ].w / PANEL_M ) );
				this.atlasRows[ n ] = { v0: i / names.length, v1: ( i + 1 ) / names.length, u1: pw / W };
				ctx.save();
				ctx.translate( 0, i * AD_H );
				ctx.beginPath();
				ctx.rect( 0, 0, pw, AD_H );
				ctx.clip();
				ADS[ n ].draw( ctx, pw, AD_H );
				ctx.restore();

			} );

		}, 'fasciaAds' );
		// backlit boxes: lit from inside after dark
		this.adMaterial = standard( { name: 'fascia-ads', roughness: 0.45, textures: { bpAds: tex },
			surface: 'let t = textureSample( bpAds, smpAnisoClamp, in.uv ).rgb; s.albedo = t * 0.55; s.emissive = t * mix( 0.1, 0.42, frame.night );' } );
		this.adMaterial.underwaterLighting = 'none';

	}

	// an LED board's material: the texture as a grid of lamps (the dots melt together with distance)
	_led( tex, w, h, name ) {

		const m = standard( { name, roughness: 0.35, textures: { bpLed: tex }, uniforms: { scroll: [ 'f32', 0 ], flash: [ 'f32', 0 ] },
			surface: /* wgsl */`
	let u = in.uv.x + mat.scroll * frame.time;
	let t = textureSample( bpLed, smpAnisoRepeat, vec2f( u, in.uv.y ) ).rgb;
	let px = vec2f( u * ${ w }.0, in.uv.y * ${ h }.0 );
	let dotK = 1.0 - smoothstep( 0.28, 0.5, length( fract( px ) - 0.5 ) );
	let far = clamp( length( fwidth( px ) ) * 1.5 - 0.5, 0.0, 1.0 );
	let led = mix( 0.25 + dotK * 1.35, 1.0, far );
	let pulse = 1.0 + mat.flash * 0.35 * sin( frame.time * 7.0 );
	s.albedo = vec3f( 0.015 );
	s.emissive = t * led * pulse * mix( 0.75, 0.8, frame.night );
` } );
		m.underwaterLighting = 'none';
		return m;

	}

	// the suite level's ribbon, all the way round the infield
	_ribbon( t ) {

		this.ribbonCanvas = new OffscreenCanvas( RIB_W, RIB_H );
		this.ribbonTex = canvasTexture( RIB_W, RIB_H, ( ctx, w, h ) => drawRibbon( ctx, w, h, 'ws', null ), 'ribbon' );
		this.ribbonMat = this._led( this.ribbonTex, RIB_W, RIB_H, 'ribbon' );
		const segs = facing( t.front, t.outward );
		const q = new Quads();
		const y0 = t.base + 0.2;
		for ( const S of segs ) panel( q, S, 0, S.len, y0, y0 + RIB_M, 0.05, S.s0 / RIB_TILE, ( S.s0 + S.len ) / RIB_TILE, 0, 1 );
		this._mesh( q, this.ribbonMat, 'ribbon-board' );

	}

	// the Terrace fascia: ads and LED segments from the middle out to both ends
	_terrace( t ) {

		const segs = facing( t.front, t.outward );
		const total = segs.reduce( ( a, S ) => a + S.len, 0 );
		const ads = new Quads(), led = new Quads();
		const y0 = t.y0 - 0.95, y1 = y0 + PANEL_M, gap = 0.25;
		for ( const dir of [ 1, - 1 ] ) {

			let s = total / 2 + dir * 0.6;
			for ( const item of TERRACE ) {

				const [ name, arg ] = item.split( ':' );
				const w = arg ? Number( arg ) : ADS[ name ].w;
				const a = dir > 0 ? s : s - w, b = a + w;
				if ( a < 8 || b > total - 8 ) break;
				if ( name === 'LED' ) along( led, segs, a, b, y0, y1, 0.05, ( ss ) => ss / RIB_TILE, 0, 1 );
				else if ( name !== '-' ) {

					const r = this.atlasRows[ name ];
					along( ads, segs, a, b, y0, y1, 0.05, ( ss ) => ( ss - a ) / w * r.u1, r.v0, r.v1 );

				}

				s += dir * ( w + gap );

			}

		}

		this._mesh( ads, this.adMaterial, 'terrace-ads' );
		this._mesh( led, this.ribbonMat, 'terrace-led' );

	}

	// the Pavilion in right: Toyota and the pitch speed, the Budweiser boards
	_pavilion( t ) {

		const segs = facing( t.front, t.outward );
		const total = segs.reduce( ( a, S ) => a + S.len, 0 );
		const y0 = t.base - 0.55, y1 = y0 + PANEL_M;
		this.speedCanvas = new OffscreenCanvas( 512, 96 );
		this.speedTex = canvasTexture( 512, 96, ( ctx, w, h ) => drawSpeed( ctx, w, h, null ), 'pitchSpeed' );
		const speedMat = this._led( this.speedTex, 512, 96, 'pitch-speed' );
		const ads = new Quads(), sp = new Quads();
		const items = [ [ 'toyota', 4.5 ], [ 'SPEED', 5.1 ], [ '-', 3 ], [ 'budweiser', 6 ], [ '-', 3 ], [ 'budlight', 4.5 ] ];
		const width = items.reduce( ( a, [ , w ] ) => a + w + 0.25, 0 );
		let s = Math.max( 1, ( total - width ) / 2 );
		for ( const [ name, w ] of items ) {

			if ( name === 'SPEED' ) along( sp, segs, s, s + w, y0, y1, 0.05, ( ss ) => ( ss - s ) / w * 0.999, 0, 1 );
			else if ( name !== '-' ) {

				const r = this.atlasRows[ name ], a = s;
				along( ads, segs, s, s + w, y0, y1, 0.05, ( ss ) => ( ss - a ) / w * r.u1, r.v0, r.v1 );

			}

			s += w + 0.25;

		}

		this._mesh( ads, this.adMaterial, 'pavilion-ads' );
		this._mesh( sp, speedMat, 'pitch-speed' );

	}

	// the left field upper deck's fascia: GEICO three times, then Jefferson University Hospital
	_lfDeck( t ) {

		if ( ! t ) return;
		const segs = facing( t.front, t.outward );
		const total = segs.reduce( ( a, S ) => a + S.len, 0 );
		const tex = canvasTexture( 2048, 128, ( ctx, w, h ) => {

			ctx.fillStyle = '#f2f1ec'; ctx.fillRect( 0, 0, w, h );
			ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
			for ( let k = 0; k < 3; k ++ ) {

				ctx.fillStyle = '#1a3e8c';
				ctx.font = '900 88px "Helvetica Neue", Arial, sans-serif';
				ctx.fillText( 'GEICO', w * ( 0.1 + k * 0.17 ), h / 2 + 4 );

			}

			ctx.fillStyle = '#0d3b6e'; ctx.fillRect( w * 0.62, 10, w * 0.37, h - 20 );
			ctx.fillStyle = '#ffffff';
			ctx.font = '700 44px Georgia, serif';
			ctx.fillText( 'Jefferson University Hospitals', w * 0.805, h / 2 + 3, w * 0.35 );

		}, 'lfDeckAds' );
		const mat = standard( { name: 'lf-deck-ads', roughness: 0.5, textures: { bpLf: tex },
			surface: 'let t = textureSample( bpLf, smpAnisoClamp, in.uv ).rgb; s.albedo = t * 0.6; s.emissive = t * mix( 0.1, 0.4, frame.night );' } );
		mat.underwaterLighting = 'none';
		const q = new Quads();
		const y0 = t.base + 0.25;
		along( q, segs, 1, total - 1, y0, y0 + 1.0, 0.05, ( ss ) => ( ss - 1 ) / ( total - 2 ), 0, 1 );
		this._mesh( q, mat, 'lf-deck-ads' );

	}

	// red, white and blue half fans hung from the top of the fascias, one every ~13 m
	_bunting( tiers ) {

		const tex = canvasTexture( 512, 256, drawBunting, 'bunting' );
		const mat = standard( { name: 'bunting', roughness: 0.9, alphaTest: 0.5, side: 'double', textures: { bpFan: tex },
			surface: 'let t = textureSample( bpFan, smpAnisoClamp, in.uv ); s.albedo = t.rgb * 0.8; s.alpha = t.a;' } );
		mat.underwaterLighting = 'none';
		const q = new Quads();
		const W = 2.0, H = 1.0;
		for ( const t of tiers ) {

			const segs = facing( t.front, t.outward );
			const total = segs.reduce( ( a, S ) => a + S.len, 0 );
			const n = Math.max( 1, Math.round( total / 13 ) );
			const top = t.frontWall.top - 0.08;
			for ( let k = 0; k < n; k ++ ) {

				const c = ( k + 0.5 ) * total / n;
				along( q, segs, c - W / 2, c + W / 2, top - H, top, 0.09, ( ss ) => ( ss - ( c - W / 2 ) ) / W, 0, 1 );

			}

		}

		this._mesh( q, mat, 'bunting', true );

	}

	_mesh( q, mat, name, shadow = false ) {

		if ( ! q.count ) return null;
		const m = new Mesh( q.geometry(), mat );
		m.name = name;
		m.receiveShadow = true;
		m.castShadow = shadow;
		this.group.add( m );
		return m;

	}

	// ---------------------------------------------------------------- following the game

	// what the ribbon shows: the batter as he walks up, the score between innings, WORLD CHAMPIONS at the
	// end, otherwise a rotation (keyed to the replay's clock, so scrubbing shows the same thing)
	update( st, director ) {

		const d = director, seg = d.segmentAt( d.t ), s = seg.snap;
		let design;
		if ( seg.kind === 'celebrate' ) design = 'champs';
		else if ( seg.kind === 'intro' ) design = 'ws';
		else if ( seg.kind === 'switch' ) design = 'score';
		else if ( seg.kind === 'walkup' ) design = 'batter';
		else if ( seg.kind === 'change' ) design = 'october';
		else {

			const cycle = [ 'ws', 'batter', 'october', 'nlchamps', 'msg', 'score', 'citizens' ];
			design = cycle[ Math.floor( d.t / 14 ) % cycle.length ];
			if ( s.half === 'bottom' && ( s.bases[ 1 ] || s.bases[ 2 ] ) && Math.floor( d.t / 7 ) % 2 === 0 ) design = 'noise';

		}

		const key = JSON.stringify( [ design, design === 'batter' ? [ st.batter, st.today ] : 0, design === 'score' ? [ st.score, st.inning, st.half, st.outs ] : 0 ] );
		if ( key !== this._key ) {

			this._key = key;
			const ctx = this.ribbonCanvas.getContext( '2d' );
			drawRibbon( ctx, RIB_W, RIB_H, design, st );
			upload( this.ribbonTex, ctx, RIB_W, RIB_H );
			this.ribbonMat.uniforms.scroll.value = design === 'msg' ? 0.08 : 0;
			this.ribbonMat.uniforms.flash.value = design === 'champs' || design === 'noise' ? 1 : 0;

		}

		const pk = JSON.stringify( st.lastPitch || null );
		if ( pk !== this._pitchKey ) {

			this._pitchKey = pk;
			const ctx = this.speedCanvas.getContext( '2d' );
			drawSpeed( ctx, 512, 96, st.lastPitch );
			upload( this.speedTex, ctx, 512, 96 );

		}

	}

}

// ---------------------------------------------------------------- geometry

// A polyline (field frame) as seen from the field: its pieces from left to right, each with its normal
// toward the field (toward `outward`) and its distance along the line.
function facing( P, outward ) {

	const build = ( Q ) => {

		const out = [];
		let s = 0;
		for ( let i = 0; i < Q.length - 1; i ++ ) {

			const [ ax, az ] = Q[ i ], [ bx, bz ] = Q[ i + 1 ];
			const len = Math.hypot( bx - ax, bz - az );
			if ( len < 0.05 ) continue;
			const ux = ( bx - ax ) / len, uz = ( bz - az ) / len;
			let nx = - uz, nz = ux;
			if ( nx * ( outward[ 0 ] - ( ax + bx ) / 2 ) + nz * ( outward[ 1 ] - ( az + bz ) / 2 ) < 0 ) {

				nx = - nx; nz = - nz;

			}

			out.push( { a: [ ax, az ], len, ux, uz, nx, nz, s0: s } );
			s += len;

		}

		return out;

	};

	const segs = build( P );
	// facing the fascia from the field, right is ( nz, -nx ): run the line that way
	const S = segs[ Math.floor( segs.length / 2 ) ];
	return S.ux * S.nz - S.uz * S.nx >= 0 ? segs : build( P.slice().reverse() );

}

// a quad on piece S from s0 to s1 along it (local distances), y0 to y1, `off` in front of it
function panel( q, S, s0, s1, y0, y1, off, u0, u1, v0, v1 ) {

	const p = ( s, y ) => [ S.a[ 0 ] + S.ux * s + S.nx * off, y, S.a[ 1 ] + S.uz * s + S.nz * off ];
	const n = [ S.nx, 0, S.nz ];
	q.tri( p( s0, y0 ), p( s1, y0 ), p( s1, y1 ), n, [ u0, v1 ], [ u1, v1 ], [ u1, v0 ] );
	q.tri( p( s0, y0 ), p( s1, y1 ), p( s0, y1 ), n, [ u0, v1 ], [ u1, v0 ], [ u0, v0 ] );

}

// a panel from a to b along the whole line (across its corners); u( s ) maps distance along it to u
function along( q, segs, a, b, y0, y1, off, u, v0, v1 ) {

	for ( const S of segs ) {

		const s0 = Math.max( a, S.s0 ), s1 = Math.min( b, S.s0 + S.len );
		if ( s1 - s0 < 0.01 ) continue;
		panel( q, S, s0 - S.s0, s1 - S.s0, y0, y1, off, u( s0 ), u( s1 ), v0, v1 );

	}

}

function upload( tex, ctx, w, h ) {

	const img = ctx.getImageData( 0, 0, w, h );
	tex.upload( new Uint8Array( img.data.buffer ) );
	generateMipmaps( tex );

}

// ---------------------------------------------------------------- drawing

const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';

function star( ctx, cx, cy, r, color ) {

	ctx.beginPath();
	for ( let i = 0; i < 10; i ++ ) {

		const a = - Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.42 : r;
		ctx.lineTo( cx + Math.cos( a ) * rr, cy + Math.sin( a ) * rr );

	}

	ctx.closePath();
	ctx.fillStyle = color;
	ctx.fill();

}

function text( ctx, s, x, y, font, color, align = 'center', maxW ) {

	ctx.font = font;
	ctx.fillStyle = color;
	ctx.textAlign = align;
	ctx.textBaseline = 'middle';
	ctx.fillText( s, x, y, maxW );

}

// the MLB silhouette logo: a batter on a blue and red field, simplified
function mlbLogo( ctx, x, y, w, h ) {

	ctx.fillStyle = '#ffffff';
	ctx.fillRect( x - 3, y - 3, w + 6, h + 6 );
	ctx.fillStyle = '#0d2b6e';
	ctx.fillRect( x, y, w * 0.55, h );
	ctx.fillStyle = '#c8102e';
	ctx.fillRect( x + w * 0.55, y, w * 0.45, h );
	ctx.fillStyle = '#ffffff';
	ctx.beginPath();
	ctx.ellipse( x + w * 0.62, y + h * 0.3, w * 0.09, h * 0.12, 0, 0, Math.PI * 2 );
	ctx.fill();
	ctx.beginPath();
	ctx.moveTo( x + w * 0.2, y + h * 0.98 );
	ctx.quadraticCurveTo( x + w * 0.45, y + h * 0.35, x + w * 0.68, y + h * 0.42 );
	ctx.lineTo( x + w * 0.8, y + h * 0.98 );
	ctx.fill();
	ctx.strokeStyle = '#ffffff';
	ctx.lineWidth = w * 0.035;
	ctx.beginPath();
	ctx.moveTo( x + w * 0.5, y + h * 0.5 );
	ctx.lineTo( x + w * 0.1, y + h * 0.12 );
	ctx.stroke();

}

// One repeat of the ribbon board (2048 x 96): each design fills it end to end.
function drawRibbon( ctx, w, h, design, st ) {

	ctx.clearRect( 0, 0, w, h );
	ctx.save();
	const H = h / 2;
	if ( design === 'ws' ) {

		// magenta with a diamond pattern, the logo block in the middle, the Phillies P at the sides
		const g = ctx.createLinearGradient( 0, 0, 0, h );
		g.addColorStop( 0, '#ff2d8a' ); g.addColorStop( 1, '#b0005a' );
		ctx.fillStyle = g;
		ctx.fillRect( 0, 0, w, h );
		ctx.fillStyle = 'rgba( 255, 255, 255, 0.12 )';
		for ( let x = - h; x < w; x += 48 ) {

			ctx.beginPath();
			ctx.moveTo( x, H ); ctx.lineTo( x + 24, 0 ); ctx.lineTo( x + 48, H ); ctx.lineTo( x + 24, h );
			ctx.fill();

		}

		// the logo, WORLD SERIES 2008, "on", FOX: measured and centred on a navy block
		const parts = [ [ 'WORLD SERIES 2008', '700 66px Georgia, "Times New Roman", serif', 0 ], [ 'on', 'italic 600 30px ' + SANS, 6 ], [ 'FOX', 'italic 900 62px ' + SANS, 0 ] ];
		const gap = 18, logoW = 110;
		const widths = parts.map( ( [ t, f ] ) => {

			ctx.font = f;
			return ctx.measureText( t ).width;

		} );
		const total = logoW + gap + widths.reduce( ( a, b ) => a + b + gap, 0 ) - gap;
		let x = ( w - total ) / 2;
		ctx.fillStyle = '#0d1f4f';
		ctx.fillRect( x - 30, 4, total + 60, h - 8 );
		mlbLogo( ctx, x, 14, logoW, 68 );
		x += logoW + gap;
		parts.forEach( ( [ t, f, dy ], i ) => {

			text( ctx, t, x, H + 2 + dy, f, '#ffffff', 'left' );
			x += widths[ i ] + gap;

		} );
		for ( const x of [ w * 0.1, w * 0.9 ] ) {

			ctx.fillStyle = '#ffffff';
			ctx.beginPath(); ctx.arc( x, H, 38, 0, Math.PI * 2 ); ctx.fill();
			text( ctx, 'P', x, H + 4, 'italic 700 64px Georgia, serif', '#c8102e' );

		}

	} else if ( design === 'october' ) {

		ctx.fillStyle = '#0a1a3c';
		ctx.fillRect( 0, 0, w, h );
		for ( let i = 0; i < 40; i ++ ) star( ctx, ( i * 211 ) % w, 12 + ( i * 37 ) % ( h - 24 ), 5, 'rgba( 255, 255, 255, 0.35 )' );
		text( ctx, "THERE'S ONLY ONE", w * 0.36, H + 3, '900 62px ' + SANS, '#ffffff' );
		text( ctx, 'OCTOBER', w * 0.66, H + 3, 'italic 900 76px ' + SANS, '#ffc425' );
		mlbLogo( ctx, w * 0.08, 14, 110, 68 );
		mlbLogo( ctx, w * 0.87, 14, 110, 68 );

	} else if ( design === 'nlchamps' ) {

		ctx.fillStyle = '#b0101f';
		ctx.fillRect( 0, 0, w, h );
		ctx.fillStyle = '#ffffff';
		ctx.fillRect( 0, 6, w, 4 ); ctx.fillRect( 0, h - 10, w, 4 );
		ctx.lineWidth = 8;
		ctx.strokeStyle = '#ffffff';
		ctx.font = 'italic 700 78px Georgia, serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillStyle = '#ffffff';
		ctx.fillText( 'Phillies', w * 0.2, H + 2 );
		star( ctx, w * 0.105, H - 20, 12, '#1d3f94' ); star( ctx, w * 0.3, H + 16, 12, '#1d3f94' );
		text( ctx, '2008 NATIONAL LEAGUE CHAMPIONS', w * 0.64, H + 3, '900 60px ' + SANS, '#ffffff' );

	} else if ( design === 'batter' ) {

		ctx.fillStyle = '#050608';
		ctx.fillRect( 0, 0, w, h );
		const b = st && st.batter;
		ctx.fillStyle = '#c8102e';
		ctx.fillRect( 20, 10, 330, h - 20 );
		text( ctx, 'NOW BATTING', 185, H + 2, '900 44px ' + SANS, '#ffffff' );
		if ( b ) {

			text( ctx, `#${ b.num }  ${ b.name }`, 390, H + 3, '900 64px ' + SANS, '#ffffff', 'left', 900 );
			text( ctx, b.pos || '', 1310, H + 3, '800 52px ' + SANS, '#ffc425', 'left' );
			const today = ( st.today || [] ).slice( - 3 ).join( '   ' ) || 'FIRST AT BAT TODAY';
			text( ctx, today, 1420, H + 3, '700 40px "Courier New", monospace', '#ffb000', 'left', w - 1440 );

		}

	} else if ( design === 'score' ) {

		ctx.fillStyle = '#050608';
		ctx.fillRect( 0, 0, w, h );
		const S = st || { score: { away: 0, home: 0 }, inning: 1, half: 'top', outs: 0 };
		const block = ( x, club, runs, bg ) => {

			ctx.fillStyle = bg;
			ctx.fillRect( x, 10, 560, h - 20 );
			text( ctx, club.toUpperCase(), x + 30, H + 3, '900 60px ' + SANS, '#ffffff', 'left' );
			text( ctx, String( runs ), x + 520, H + 3, '900 72px ' + SANS, '#ffffff', 'right' );

		};

		block( 120, 'Rays', S.score.away, '#0b2a5b' );
		block( 720, 'Phillies', S.score.home, '#b0101f' );
		text( ctx, `${ S.half === 'top' ? 'TOP' : 'BOT' } ${ S.inning }`, 1480, H + 3, '900 60px ' + SANS, '#ffc425' );
		text( ctx, `${ S.outs } OUT${ S.outs === 1 ? '' : 'S' }`, 1780, H + 3, '800 52px ' + SANS, '#ffffff' );

	} else if ( design === 'msg' ) {

		ctx.fillStyle = '#050608';
		ctx.fillRect( 0, 0, w, h );
		text( ctx, 'LOG ONTO MLB.COM FOR MORE INFORMATION ON THE 2008 WORLD SERIES', w / 2, H + 3, '800 50px "Courier New", monospace', '#ffffff', 'center', w - 40 );

	} else if ( design === 'citizens' ) {

		ctx.fillStyle = '#ffffff';
		ctx.fillRect( 0, 0, w, h );
		for ( const x of [ w * 0.25, w * 0.75 ] ) {

			ctx.fillStyle = '#00843d';
			ctx.beginPath(); ctx.arc( x - 290, H, 32, 0, Math.PI * 2 ); ctx.fill();
			text( ctx, 'Citizens Bank Park', x + 30, H + 3, '700 64px ' + SANS, '#00843d' );

		}

	} else if ( design === 'noise' ) {

		ctx.fillStyle = '#b0101f';
		ctx.fillRect( 0, 0, w, h );
		for ( let x = 0; x < w; x += 22 ) {

			const bh = ( 0.3 + 0.7 * Math.abs( Math.sin( x * 0.037 ) * Math.cos( x * 0.011 ) ) ) * ( h - 16 );
			ctx.fillStyle = 'rgba( 255, 200, 60, 0.45 )';
			ctx.fillRect( x, h - 8 - bh, 14, bh );

		}

		text( ctx, 'MAKE SOME NOISE!', w * 0.5, H + 3, 'italic 900 78px ' + SANS, '#ffffff' );

	} else if ( design === 'champs' ) {

		const g = ctx.createLinearGradient( 0, 0, 0, h );
		g.addColorStop( 0, '#d4142a' ); g.addColorStop( 1, '#8a0716' );
		ctx.fillStyle = g;
		ctx.fillRect( 0, 0, w, h );
		for ( let x = 40; x < w; x += 160 ) star( ctx, x, H, 20, '#ffd24a' );
		ctx.fillStyle = '#0d1f4f';
		ctx.fillRect( w * 0.2, 6, w * 0.6, h - 12 );
		text( ctx, '2008 WORLD CHAMPIONS', w * 0.5, H + 3, '900 72px ' + SANS, '#ffd24a' );

	}

	ctx.restore();

}

// Toyota's pitch speed board: FAST BALL / PITCH SPEED and the last pitch's speed
function drawSpeed( ctx, w, h, p ) {

	ctx.fillStyle = '#04050a';
	ctx.fillRect( 0, 0, w, h );
	text( ctx, 'FAST BALL', w * 0.4, h * 0.3, '800 34px ' + SANS, '#d8f6ff' );
	text( ctx, 'PITCH SPEED', w * 0.36, h * 0.72, '800 34px ' + SANS, '#d8f6ff' );
	text( ctx, p && p.speed ? String( Math.round( p.speed ) ) : '--', w * 0.86, h * 0.56, '900 64px ' + SANS, '#e05cff' );

}

// a red, white and blue half fan: the flat edge at the top, pleated, with stars in the blue
function drawBunting( ctx, w, h ) {

	ctx.clearRect( 0, 0, w, h );
	const cx = w / 2, R = w / 2 - 6;
	const bands = [ [ 1.0, '#b3122c' ], [ 0.8, '#f4f1ea' ], [ 0.6, '#b3122c' ], [ 0.42, '#f4f1ea' ], [ 0.3, '#1b2f6b' ] ];
	for ( const [ f, c ] of bands ) {

		ctx.fillStyle = c;
		ctx.beginPath();
		ctx.moveTo( cx, 0 );
		// the outer band's edge scalloped between the pleats
		if ( f === 1 ) {

			const n = 14;
			for ( let k = 0; k <= n; k ++ ) {

				const a0 = k / n * Math.PI, a1 = ( k + 1 ) / n * Math.PI;
				ctx.lineTo( cx + Math.cos( a0 ) * R, Math.sin( a0 ) * R );
				if ( k < n ) ctx.quadraticCurveTo( cx + Math.cos( ( a0 + a1 ) / 2 ) * R * 0.94, Math.sin( ( a0 + a1 ) / 2 ) * R * 0.94, cx + Math.cos( a1 ) * R, Math.sin( a1 ) * R );

			}

		} else ctx.arc( cx, 0, R * f, 0, Math.PI );
		ctx.closePath();
		ctx.fill();

	}

	// the pleats: alternate wedges shaded
	for ( let k = 0; k < 14; k ++ ) {

		if ( k % 2 ) continue;
		const a0 = k / 14 * Math.PI, a1 = ( k + 1 ) / 14 * Math.PI;
		ctx.fillStyle = 'rgba( 0, 0, 0, 0.14 )';
		ctx.beginPath();
		ctx.moveTo( cx, 0 );
		ctx.arc( cx, 0, R, a0, a1 );
		ctx.closePath();
		ctx.fill();

	}

	for ( let k = 0; k < 5; k ++ ) {

		const a = ( k + 0.5 ) / 5 * Math.PI;
		star( ctx, cx + Math.cos( a ) * R * 0.19, Math.sin( a ) * R * 0.19, 9, '#ffffff' );

	}

	// the top band it hangs from
	ctx.fillStyle = '#1b2f6b';
	ctx.fillRect( 0, 0, w, 8 );

}

// ---------------------------------------------------------------- the ads

function wordmark( ctx, w, h, bg, fg, word, font, sub ) {

	ctx.fillStyle = bg;
	ctx.fillRect( 0, 0, w, h );
	text( ctx, word, w / 2, sub ? h * 0.42 : h * 0.54, font, fg, 'center', w - 30 );
	if ( sub ) text( ctx, sub, w / 2, h * 0.84, '700 22px ' + SANS, fg );

}

function drawMasterCard( ctx, w, h ) {

	ctx.fillStyle = '#10141c';
	ctx.fillRect( 0, 0, w, h );
	for ( let i = 0; i < 3; i ++ ) {

		const x = w * ( i + 0.5 ) / 3, r = h * 0.36;
		ctx.fillStyle = '#eb001b';
		ctx.beginPath(); ctx.arc( x - r * 0.45, h / 2, r, 0, Math.PI * 2 ); ctx.fill();
		ctx.fillStyle = '#f79e1b';
		ctx.beginPath(); ctx.arc( x + r * 0.45, h / 2, r, 0, Math.PI * 2 ); ctx.fill();
		text( ctx, 'MasterCard', x, h / 2 + 3, 'italic 800 34px ' + SANS, '#ffffff' );

	}

}

function drawNike( ctx, w, h ) {

	const g = ctx.createLinearGradient( 0, 0, 0, h );
	g.addColorStop( 0, '#6fb0e6' ); g.addColorStop( 1, '#3a7cc0' );
	ctx.fillStyle = g;
	ctx.fillRect( 0, 0, w, h );
	for ( let i = 0; i < 3; i ++ ) {

		const x = w * ( i + 0.5 ) / 3 - 90, y = h * 0.72;
		ctx.fillStyle = '#ffffff';
		ctx.beginPath();
		ctx.moveTo( x, y - 22 );
		ctx.quadraticCurveTo( x - 20, y + 20, x + 30, y + 12 );
		ctx.lineTo( x + 190, y - 50 );
		ctx.lineTo( x + 35, y - 2 );
		ctx.quadraticCurveTo( x + 5, y + 4, x, y - 22 );
		ctx.fill();

	}

}

function drawSherwin( ctx, w, h ) {

	ctx.fillStyle = '#1d3f7a';
	ctx.fillRect( 0, 0, w, h );
	// the globe with the paint pouring over it
	const x = 70, y = h * 0.55, r = 38;
	ctx.fillStyle = '#3f86d1';
	ctx.beginPath(); ctx.arc( x, y, r, 0, Math.PI * 2 ); ctx.fill();
	ctx.fillStyle = '#e21b23';
	ctx.beginPath(); ctx.arc( x, y, r, Math.PI * 1.05, Math.PI * 1.95 ); ctx.fill();
	for ( const dx of [ - 22, - 6, 12, 26 ] ) ctx.fillRect( x + dx - 5, y - 20, 10, 22 + ( ( dx * 7 ) % 13 + 13 ) );
	ctx.fillStyle = '#e21b23';
	ctx.fillRect( x - 26, 6, 52, 14 );
	text( ctx, 'SHERWIN-WILLIAMS', 130, h * 0.55, '800 34px ' + SANS, '#ffffff', 'left', w - 140 );

}

function drawAIG( ctx, w, h ) {

	ctx.fillStyle = '#23262b';
	ctx.fillRect( 0, 0, w, h );
	ctx.strokeStyle = '#d9c9a0';
	ctx.lineWidth = 5;
	ctx.strokeRect( w * 0.2, 16, w * 0.6, h - 32 );
	text( ctx, 'AIG', w / 2, h / 2 + 4, '700 78px Georgia, "Times New Roman", serif', '#e8dcb8' );

}

function drawMcDonalds( ctx, w, h ) {

	ctx.fillStyle = '#d52b1e';
	ctx.fillRect( 0, 0, w, h );
	// the arches
	ctx.strokeStyle = '#ffc72c';
	ctx.lineWidth = 16;
	const x = 110, y = h - 18;
	ctx.beginPath();
	ctx.moveTo( x - 60, y );
	ctx.bezierCurveTo( x - 58, 10, x - 8, 10, x, y - 30 );
	ctx.bezierCurveTo( x + 8, 10, x + 58, 10, x + 60, y );
	ctx.stroke();
	text( ctx, "i'm lovin' it", 200, h * 0.55, 'italic 700 58px ' + SANS, '#ffffff', 'left', w - 220 );

}

function drawHerrs( ctx, w, h ) {

	ctx.fillStyle = '#fff4d0';
	ctx.fillRect( 0, 0, w, h );
	ctx.fillStyle = '#d6001c';
	ctx.beginPath(); ctx.ellipse( w / 2, h / 2, w * 0.42, h * 0.4, 0, 0, Math.PI * 2 ); ctx.fill();
	text( ctx, "Herr's", w / 2, h / 2 + 4, 'italic 800 76px Georgia, serif', '#ffe14a' );

}

function drawLG( ctx, w, h ) {

	ctx.fillStyle = '#ffffff';
	ctx.fillRect( 0, 0, w, h );
	ctx.fillStyle = '#a50034';
	ctx.beginPath(); ctx.arc( 90, h / 2, 42, 0, Math.PI * 2 ); ctx.fill();
	text( ctx, 'LG', 90, h / 2 + 3, '800 40px ' + SANS, '#ffffff' );
	text( ctx, "Life's Good", 160, h / 2 + 3, 'italic 700 54px ' + SANS, '#6b6b6b', 'left', w - 170 );

}

function drawAutoTrader( ctx, w, h ) {

	ctx.fillStyle = '#111111';
	ctx.fillRect( 0, 0, w, h );
	ctx.font = '800 66px ' + SANS;
	const a = 'AutoTrader', b = '.com';
	const wa = ctx.measureText( a ).width, wb = ctx.measureText( b ).width;
	const x = ( w - wa - wb ) / 2;
	text( ctx, a, x, h / 2 + 3, '800 66px ' + SANS, '#ffffff', 'left' );
	text( ctx, b, x + wa, h / 2 + 3, '800 66px ' + SANS, '#ff7a00', 'left' );

}

function drawToyota( ctx, w, h ) {

	const g = ctx.createLinearGradient( 0, 0, 0, h );
	g.addColorStop( 0, '#ff5a2a' ); g.addColorStop( 1, '#e0301a' );
	ctx.fillStyle = g;
	ctx.fillRect( 0, 0, w, h );
	ctx.strokeStyle = '#ffffff';
	ctx.lineWidth = 7;
	const x = 90, y = h / 2;
	ctx.beginPath(); ctx.ellipse( x, y, 58, 38, 0, 0, Math.PI * 2 ); ctx.stroke();
	ctx.beginPath(); ctx.ellipse( x, y - 14, 36, 14, 0, 0, Math.PI * 2 ); ctx.stroke();
	ctx.beginPath(); ctx.ellipse( x, y + 4, 12, 32, 0, 0, Math.PI * 2 ); ctx.stroke();
	text( ctx, 'TOYOTA', 170, y + 4, '800 72px ' + SANS, '#ffffff', 'left', w - 180 );

}

function drawCitizens( ctx, w, h ) {

	ctx.fillStyle = '#ffffff';
	ctx.fillRect( 0, 0, w, h );
	ctx.fillStyle = '#00843d';
	ctx.beginPath(); ctx.arc( 80, h / 2, 40, 0, Math.PI * 2 ); ctx.fill();
	ctx.fillStyle = '#ffffff';
	ctx.beginPath(); ctx.arc( 80, h / 2, 18, 0, Math.PI * 2 ); ctx.fill();
	text( ctx, 'Citizens Bank', 140, h / 2 + 3, '700 64px ' + SANS, '#00843d', 'left', w - 150 );

}
