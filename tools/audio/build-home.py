#!/usr/bin/env python3
"""The sounds of the seats behind home plate (public/audio/places/home/): vendors working the aisles, fans, an
usher, and the small sounds of the rows (seats snapping up, a peanut bag, change handed over, a poncho, a camera,
a flip phone). Game 5 of the 2008 World Series: the cold rain of Oct 27 and the cold, windy, dry night of Oct 29.

    python tools/audio/build-home.py            # build every clip
    python tools/audio/build-home.py beer-1 ... # build some
    python tools/audio/build-home.py --asr      # also transcribe the voice clips (faster-whisper) to check the words

Sources (all public domain / CC0; see public/audio/places/home/CREDITS.md):
  - Voices: Piper TTS (https://github.com/rhasspy/piper, MIT) with only the CC0 or public-domain voices from
    huggingface rhasspy/piper-voices: en_US-joe-medium (CC0), en_US-mike-medium (CC0), en_US-norman-medium,
    en_US-john-medium, en_US-bryce-medium, en_US-kristin-medium, en_US-ljspeech-medium (public domain).
    The words come from Piper (with phoneme alignments), then a WORLD vocoder pass (pyworld) makes them calls:
    the stressed vowels drawn out, a sung contour (notes per syllable, a scoop up into each and a drop at the end),
    the pitch raised into a shout with the formants kept (or shifted, for a kid), a flatter spectral tilt and a
    little raised F1 (a shouting mouth), breath and roughness (aperiodicity, jitter, shimmer) for the hoarse
    30-season voices, then gentle saturation and compression. Dry: the game adds the stadium's distance and reverb.
  - Recordings: CC0 Freesound previews (downloaded with tools/audio/dl.mjs into $CBP_HOME_AUDIO/fs/raw).
  - Synthesized: the seat clacks, the peanut rattles in the bag, the flash-charge whine (numpy/scipy).

Setup (Python 3.9+; no ffmpeg needed):
    python3 -m venv /tmp/cbp-home-audio/venv
    /tmp/cbp-home-audio/venv/bin/pip install piper-tts onnx numpy scipy pyworld soundfile lameenc pyloudnorm
    # optional check: faster-whisper miniaudio
    /tmp/cbp-home-audio/venv/bin/python tools/audio/build-home.py
Voices are downloaded to $CBP_HOME_AUDIO/voices (default /tmp/cbp-home-audio) if missing; the Freesound previews
are fetched with `node tools/audio/dl.mjs` (run in $CBP_HOME_AUDIO/fs) if missing. Piper's synthesis is random
(its noise), so each take is cached in $CBP_HOME_AUDIO/cache; delete the cache for new takes.
"""
import hashlib, json, os, subprocess, sys, urllib.request, zlib
from pathlib import Path
import numpy as np
from scipy import signal
from scipy.ndimage import minimum_filter1d, uniform_filter1d, gaussian_filter1d
import soundfile as sf

ROOT = Path( os.environ.get( 'CBP_ROOT' ) or Path( __file__ ).resolve().parents[ 2 ] )
OUT = ROOT / 'public' / 'audio' / 'places' / 'home'
WORK = Path( os.environ.get( 'CBP_HOME_AUDIO', '/tmp/cbp-home-audio' ) )
VOICES = WORK / 'voices'
RAW = WORK / 'fs' / 'raw'
CACHE = WORK / 'cache'
WAVS = WORK / 'wav'
SRV = 22050   # voices
SRF = 44100   # foley
FP = 5.0      # WORLD frame period, ms

# ------------------------------------------------------------------ small DSP helpers

def db( x ):
	return 20 * np.log10( max( float( x ), 1e-12 ) )

def rng_for( name ):
	return np.random.default_rng( zlib.crc32( name.encode() ) )

def lp_noise( rng, n, smooth ):
	"""unit-variance noise smoothed over `smooth` samples (gaussian)"""
	z = rng.standard_normal( n + 8 * int( smooth + 1 ) )
	if smooth > 0.5:
		z = gaussian_filter1d( z, smooth )
		z /= ( z.std() + 1e-12 )
	return z[ 4 * int( smooth + 1 ): 4 * int( smooth + 1 ) + n ]

def hp( x, sr, f, order = 2 ):
	return signal.sosfilt( signal.butter( order, f, 'highpass', fs = sr, output = 'sos' ), x )

def lp( x, sr, f, order = 2 ):
	return signal.sosfilt( signal.butter( order, f, 'lowpass', fs = sr, output = 'sos' ), x )

def bp( x, sr, lo, hi, order = 2 ):
	return signal.sosfilt( signal.butter( order, [ lo, hi ], 'bandpass', fs = sr, output = 'sos' ), x )

def fade( x, sr, fin = 0.005, fout = 0.03 ):
	x = x.copy()
	a, b = int( fin * sr ), int( fout * sr )
	if a > 1:
		x[ :a ] *= np.sin( np.linspace( 0, np.pi / 2, a ) ) ** 2
	if b > 1:
		x[ -b: ] *= np.cos( np.linspace( 0, np.pi / 2, b ) ) ** 2
	return x

def trim( x, sr, thr_db = -42, pre = 0.012, post = 0.06 ):
	e = np.sqrt( uniform_filter1d( x ** 2, max( 1, int( 0.005 * sr ) ) ) )
	on = np.where( e > np.max( e ) * 10 ** ( thr_db / 20 ) )[ 0 ]
	if not len( on ):
		return x
	return x[ max( 0, on[ 0 ] - int( pre * sr ) ): min( len( x ), on[ -1 ] + int( post * sr ) ) ]

def saturate( x, drive ):
	if drive <= 1.0:
		return x
	p = np.max( np.abs( x ) ) + 1e-12
	y = np.tanh( drive * x / p ) / np.tanh( drive )
	return y * p

def deess( x, sr, split = 4500, hf_max = -14.0 ):
	"""hold the band above `split` (sibilants) to at most `hf_max` dB under the loudest vowel of the clip"""
	sos = signal.butter( 3, split, 'highpass', fs = sr, output = 'sos' )
	hi = signal.sosfiltfilt( sos, x )   # zero-phase, so x - hi is the complementary low band
	lo = x - hi
	w = max( 1, int( 0.006 * sr ) )
	eh = np.sqrt( uniform_filter1d( hi ** 2, w ) + 1e-14 )
	el = np.sqrt( uniform_filter1d( lo ** 2, 4 * w ) + 1e-14 )
	g = np.minimum( 1.0, np.max( el ) * 10 ** ( hf_max / 20 ) / eh )
	g = uniform_filter1d( minimum_filter1d( g, w ), w )
	return lo + hi * g

def compress( x, sr, thr_db = -18.0, ratio = 3.0, att = 0.004, rel = 0.09, knee = 6.0 ):
	"""feed-forward RMS compressor, threshold relative to the peak"""
	p = np.max( np.abs( x ) ) + 1e-12
	x = x / p
	e = np.sqrt( uniform_filter1d( x ** 2, max( 1, int( 0.008 * sr ) ) ) + 1e-12 )
	ed = 20 * np.log10( e )
	over = ed - thr_db
	gr = np.where( over <= -knee / 2, 0.0, np.where( over >= knee / 2, over * ( 1 - 1 / ratio ), ( 1 - 1 / ratio ) * ( over + knee / 2 ) ** 2 / ( 2 * knee ) ) )
	# attack/release smoothing of the gain reduction (dB)
	aa, ar = np.exp( -1 / ( att * sr ) ), np.exp( -1 / ( rel * sr ) )
	g = np.empty_like( gr )
	s = 0.0
	for i in range( len( gr ) ):
		c = aa if gr[ i ] > s else ar
		s = c * s + ( 1 - c ) * gr[ i ]
		g[ i ] = s
	return x * 10 ** ( -g / 20 )

def limit( x, sr, ceil_db = -1.0, look = 0.0015, rel = 0.06 ):
	c = 10 ** ( ceil_db / 20 )
	need = np.minimum( 1.0, c / ( np.abs( x ) + 1e-12 ) )
	L = max( 1, int( look * sr ) )
	g = minimum_filter1d( need, 2 * L + 1 )
	g = uniform_filter1d( g, L )   # an average over the window of minima: never above the need
	# release: gain may only rise slowly
	a = np.exp( -1 / ( rel * sr ) )
	out = np.empty_like( g )
	s = 1.0
	for i in range( len( g ) ):
		s = g[ i ] if g[ i ] < s else a * s + ( 1 - a ) * g[ i ]
		out[ i ] = s
	y = x * out
	return np.clip( y, -c, c )

def loudness( x, sr ):
	import pyloudnorm as pyln
	if len( x ) < int( 0.45 * sr ):
		x = np.concatenate( [ x, np.zeros( int( 0.45 * sr ) - len( x ) ) ] )
	return pyln.Meter( sr ).integrated_loudness( x )

def to_peak( x, peak_db = -1.0 ):
	return x * ( 10 ** ( peak_db / 20 ) / ( np.max( np.abs( x ) ) + 1e-12 ) )

def to_loudness( x, sr, target, ceil_db = -1.0, max_gr = 6.0 ):
	"""gain to a loudness target, a limiter holding the peak at ceil_db (at most max_gr dB of limiting)"""
	base = to_peak( x, ceil_db )
	g, y = 0.0, base
	for _ in range( 4 ):
		need = target - loudness( y, sr )
		if abs( need ) < 0.2:
			break
		g = min( g + need, max_gr )
		y = limit( base * 10 ** ( g / 20 ), sr, ceil_db ) if g > 0 else base * 10 ** ( g / 20 )
		if g >= max_gr:
			break
	return y

def write_mp3( path, x, sr, kbps ):
	import lameenc
	pcm = ( np.clip( x, -1, 1 ) * 32767 ).astype( np.int16 )
	enc = lameenc.Encoder()
	enc.set_bit_rate( kbps )
	enc.set_in_sample_rate( sr )
	enc.set_channels( 1 )
	enc.set_quality( 2 )
	data = enc.encode( pcm.tobytes() ) + enc.flush()
	path.parent.mkdir( parents = True, exist_ok = True )
	path.write_bytes( data )
	return len( data )

# ------------------------------------------------------------------ Piper

VOICE_FILES = {
	'joe': ( 'en_US-joe-medium', 'joe/medium', 'CC0' ),
	'mike': ( 'en_US-mike-medium', 'mike/medium', 'CC0' ),
	'norman': ( 'en_US-norman-medium', 'norman/medium', 'public domain' ),
	'john': ( 'en_US-john-medium', 'john/medium', 'public domain' ),
	'bryce': ( 'en_US-bryce-medium', 'bryce/medium', 'public domain' ),
	'kristin': ( 'en_US-kristin-medium', 'kristin/medium', 'public domain' ),
	'ljspeech': ( 'en_US-ljspeech-medium', 'ljspeech/medium', 'public domain' ),
}
HF = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/'
_models = {}

def voice( name, seed ):
	"""a Piper voice whose two noise sources (RandomNormalLike) are seeded, so a take is reproducible: a fresh
	session per seed (the generator advances with each run), with the phoneme alignments exposed"""
	import onnx, onnxruntime
	from piper import PiperVoice
	from piper.config import PiperConfig
	from piper.voice import ESPEAK_DATA_DIR
	from piper.patch_voice_with_alignment import add_alignment_output
	if name not in _models:
		base, sub, lic = VOICE_FILES[ name ]
		VOICES.mkdir( parents = True, exist_ok = True )
		for suffix, remote in ( ( '.onnx', base + '.onnx' ), ( '.onnx.json', base + '.onnx.json' ), ( '.MODEL_CARD', 'MODEL_CARD' ) ):
			f = VOICES / ( base + suffix )
			if not f.exists():
				print( '  downloading', f.name )
				urllib.request.urlretrieve( HF + sub + '/' + remote, f )
		card = ( VOICES / ( base + '.MODEL_CARD' ) ).read_text()
		assert ( 'License: ' + lic ) in card, f'{base}: model card licence is not {lic}'
		m = onnx.load( str( VOICES / ( base + '.onnx' ) ) )
		add_alignment_output( m )
		cfg = json.loads( ( VOICES / ( base + '.onnx.json' ) ).read_text() )
		_models[ name ] = ( m, cfg )
	m, cfg = _models[ name ]
	k = 0
	for node in m.graph.node:
		if node.op_type.startswith( 'Random' ):
			for a in list( node.attribute ):
				if a.name == 'seed':
					node.attribute.remove( a )
			node.attribute.append( onnx.helper.make_attribute( 'seed', float( seed + 7919 * k ) ) )
			k += 1
	sess = onnxruntime.InferenceSession( m.SerializeToString(), sess_options = onnxruntime.SessionOptions(), providers = [ 'CPUExecutionProvider' ] )
	return PiperVoice( config = PiperConfig.from_dict( cfg ), session = sess, espeak_data_dir = Path( ESPEAK_DATA_DIR ), download_dir = Path.cwd() )

VOWELS = set( 'iɪeɛæaɑɒɔoʊuʌəɚɝɐᵻɜ' ) | { 'ː' }
STRESS = { 'ˈ', 'ˌ' }

def tts( vname, text, ls = 1.0, ns = 0.667, nw = 0.8, take = 0 ):
	"""one sentence -> (audio float64 at 22.05 kHz, [(phoneme, start, end) in samples])"""
	CACHE.mkdir( parents = True, exist_ok = True )
	key = hashlib.sha1( f'seeded|{vname}|{text}|{ls}|{ns}|{nw}|{take}'.encode() ).hexdigest()[ :16 ]
	f = CACHE / ( key + '.npz' )
	if f.exists():
		d = np.load( f, allow_pickle = False )
		return d[ 'x' ], [ ( p, int( a ), int( b ) ) for p, a, b in zip( d[ 'ph' ], d[ 'a' ], d[ 'b' ] ) ]
	from piper import SynthesisConfig
	v = voice( vname, zlib.crc32( f'{vname}|{text}|{take}'.encode() ) % 100000 )
	cfg = SynthesisConfig( length_scale = ls, noise_scale = ns, noise_w_scale = nw, normalize_audio = False )
	xs, items, off = [], [], 0
	for c in v.synthesize( text, syn_config = cfg, include_alignments = True ):
		a = c.audio_float_array.astype( np.float64 )
		pos = 0
		assert c.phoneme_alignments, 'no alignments for ' + text
		for al in c.phoneme_alignments:
			items.append( ( al.phoneme, off + pos, off + pos + al.num_samples ) )
			pos += al.num_samples
		xs.append( a )
		off += len( a )
	x = np.concatenate( xs )
	np.savez( f, x = x, ph = np.array( [ i[ 0 ] for i in items ] ), a = np.array( [ i[ 1 ] for i in items ] ), b = np.array( [ i[ 2 ] for i in items ] ) )
	return x, items

def nuclei( items ):
	"""syllable nuclei: runs of vowels (with the stress mark before and a post-vocalic r), in samples:
	(start, end, start of the vowel itself)"""
	out, cur = [], None
	vow = lambda p: len( p ) > 0 and all( c in VOWELS for c in p )   # a phoneme may be a diphthong ('oʊ')
	for i, ( p, a, b ) in enumerate( items ):
		isv = vow( p ) or ( p in STRESS and i + 1 < len( items ) and vow( items[ i + 1 ][ 0 ] ) )
		isr = p == 'ɹ' and cur is not None and ( i + 1 >= len( items ) or not vow( items[ i + 1 ][ 0 ] ) )
		if isv or isr:
			if cur is None:
				cur = [ a, b, a ]
			else:
				cur[ 1 ] = b
			if p in STRESS:
				cur[ 2 ] = b
		elif cur is not None:
			out.append( tuple( cur ) )
			cur = None
	if cur is not None:
		out.append( tuple( cur ) )
	return out

# ------------------------------------------------------------------ the voice pass (WORLD)

def smoothstep( u ):
	u = np.clip( u, 0, 1 )
	return u * u * ( 3 - 2 * u )

def call( name, person, phrases ):
	"""phrases: [{t: text, n: [(note0, note1, stretch), ...] | None, gap: s, ls: ..}] -> audio at SRV"""
	import pyworld as pw
	P = dict( mode = 'sing', formant = 1.0, f1 = 0.0, tilt = 0.0, hoarse = 0.0, jit = 0.008, shim = 0.03,
		wander = 0.01, micro = 0.45, tremor = 0.0, drive = 1.0, ls = 1.0, ns = 0.667, nw = 0.8, scoop = 1.5,
		glide = 0.45, range = 1.0, comp = ( -20, 2.5 ), hpf = 90, take = 0 )
	P.update( person )
	rng = rng_for( name )
	out = []
	for ph in phrases:
		x, items = tts( P[ 'voice' ], ph[ 't' ], ph.get( 'ls', P[ 'ls' ] ), P[ 'ns' ], P[ 'nw' ], ph.get( 'take', P[ 'take' ] ) )
		nuc = nuclei( items )
		want = len( ph.get( 'n' ) or ph.get( 'S' ) or [] )
		if want and want != len( nuc ):
			print( f'  ! {name}: {len( nuc )} syllables in "{ph[ "t" ]}" ({"".join( i[ 0 ] for i in items )}), the score has {want}' )
		fs = SRV
		f0, t = pw.harvest( x, fs, f0_floor = 60, f0_ceil = 650, frame_period = FP )
		sp = pw.cheaptrick( x, f0, t, fs )
		ap = pw.d4c( x, f0, t, fs )
		nF = len( f0 )
		hop = fs * FP / 1000
		# --- time warp: draw out the syllable nuclei, most in the middle of each and little at its edges
		notes = ph.get( 'n' ) or []
		st = np.ones( nF )
		spans = []
		for k, ( a, b, av ) in enumerate( nuc ):
			fa, fb = int( a / hop ), min( nF - 1, int( b / hop ) )
			if k < len( notes ):
				S = notes[ k ][ 2 ]
			elif ph.get( 'S' ) and k < len( ph[ 'S' ] ):
				S = ph[ 'S' ][ k ]
			else:
				S = 1.0
			if fb > fa and S != 1.0:
				za, zb = fa, fb   # (tried: sparing the stress mark's span, or only the vowel's steady middle; both less clear)
				u = ( np.arange( za, zb + 1 ) - za + 0.5 ) / ( zb - za + 1 )
				w = np.sin( np.pi * u ) ** 0.6   # most in the middle, little at the edges
				w = w / w.mean() * ( fb - fa + 1 ) / ( zb - za + 1 )
				st[ za:zb + 1 ] = np.maximum( 0.4, 1 + ( S - 1 ) * w )
			spans.append( ( fa, fb ) )
		st *= 1.0 / ph.get( 'rate', 1.0 )
		cum = np.concatenate( [ [ 0 ], np.cumsum( st ) ] )
		nO = int( cum[ -1 ] )
		q = np.clip( np.interp( np.arange( nO ) + 0.5, cum, np.arange( nF + 1 ) ) - 0.5, 0, nF - 1 )
		k0 = np.floor( q ).astype( int )
		k1 = np.minimum( k0 + 1, nF - 1 )
		fr = ( q - k0 )[ :, None ]
		lsp = np.log( sp + 1e-16 )
		lsp_o = lsp[ k0 ] * ( 1 - fr ) + lsp[ k1 ] * fr
		ap_o = ap[ k0 ] * ( 1 - fr ) + ap[ k1 ] * fr
		voiced_in = f0 > 0
		v_o = voiced_in[ np.round( q ).astype( int ) ]
		# --- pitch (the source contour first cleaned of octave slips and creak: frames > 5 st off the local median)
		lf = np.log( np.where( voiced_in, f0, 1.0 ) )
		idx = np.where( voiced_in )[ 0 ]
		if len( idx ) > 4:
			from scipy.ndimage import median_filter
			lmed = median_filter( np.interp( np.arange( nF ), idx, lf[ idx ] ), 15, mode = 'nearest' )
			good = voiced_in & ( np.abs( lf - lmed ) * 12 / np.log( 2 ) < 5 )
			if good.sum() > 4:
				idx = np.where( good )[ 0 ]
		lfc = np.interp( np.arange( nF ), idx, lf[ idx ] ) if len( idx ) else np.full( nF, np.log( 120 ) )
		trend = gaussian_filter1d( lfc, 0.12 / ( FP / 1000 ) )
		micro = lfc - trend
		med = np.median( lf[ idx ] ) if len( idx ) else np.log( 120 )
		T = np.arange( nO ) * FP / 1000
		if P[ 'mode' ] == 'sing' and notes:
			# note contour over output frames
			N = np.full( nO, np.nan )
			ospans = [ ( min( int( cum[ a ] ), nO - 1 ), min( nO, max( int( cum[ a ] ) + 1, int( cum[ b + 1 ] ) ) ) ) for a, b in spans ]
			for k, ( oa, ob ) in enumerate( ospans ):
				n0, n1 = ( notes[ k ][ 0 ], notes[ k ][ 1 ] ) if k < len( notes ) else ( notes[ -1 ][ 1 ], notes[ -1 ][ 1 ] )
				g = notes[ k ][ 3 ] if k < len( notes ) and len( notes[ k ] ) > 3 else P[ 'glide' ]
				u = ( np.arange( oa, ob ) - oa ) / max( 1, ob - oa )
				c = n0 + ( n1 - n0 ) * smoothstep( ( u - ( 1 - g ) ) / max( g, 1e-3 ) )
				# scoop up into the note
				c -= P[ 'scoop' ] * np.exp( -( np.arange( ob - oa ) * FP / 1000 ) / 0.045 )
				N[ oa:ob ] = c
			ok = ~np.isnan( N )
			N = np.interp( np.arange( nO ), np.where( ok )[ 0 ], N[ ok ] )
			held = np.zeros( nO )
			for oa, ob in ospans:
				held[ oa:ob ] = 1.0
			held = gaussian_filter1d( held, 6 )
			trem = P[ 'tremor' ] * np.sin( 2 * np.pi * 5.3 * T + rng.uniform( 0, 6 ) ) * held * smoothstep( T / 0.4 )
			lf_o = np.log( P[ 'base' ] ) + np.log( 2 ) * ( N + trem ) / 12 + P[ 'micro' ] * np.interp( q, np.arange( nF ), micro )
		else:
			# speech: its own contour, moved to the person's pitch and range
			lf_o = np.log( P[ 'base' ] ) + P[ 'range' ] * ( np.interp( q, np.arange( nF ), lfc ) - med )
		lf_o = np.clip( lf_o, np.log( P[ 'base' ] ) - np.log( 2 ) * 9 / 12, np.log( P[ 'base' ] ) + np.log( 2 ) * 14 / 12 )
		lf_o = lf_o + P[ 'wander' ] * lp_noise( rng, nO, 12 ) + P[ 'jit' ] * rng.standard_normal( nO )
		f0_o = np.where( v_o, np.exp( lf_o ), 0.0 )
		# --- the voice: formants (vocal tract), a shout's tilt and raised F1, shimmer, breath
		nb = sp.shape[ 1 ]
		fftlen = ( nb - 1 ) * 2
		f = np.arange( nb ) * fs / fftlen
		m = P[ 'formant' ] * ( 1 + P[ 'f1' ] * np.clip( 1 - f / 2500, 0, 1 ) )
		src = np.clip( f / m / ( fs / fftlen ), 0, nb - 1 )
		s0 = np.floor( src ).astype( int )
		s1 = np.minimum( s0 + 1, nb - 1 )
		sfr = src - s0
		lsp_o = lsp_o[ :, s0 ] * ( 1 - sfr ) + lsp_o[ :, s1 ] * sfr
		# a shout is the voice working harder: the tilt flattens on the voiced frames only, and the voiceless
		# consonants (s, t, h) don't grow with it, so they drop back relative to the vowels
		gdb = P[ 'tilt' ] * np.clip( np.log2( np.maximum( f, 1 ) / 400 ) / 3, 0, 1 ) - 0.5 * P[ 'tilt' ] * np.clip( np.log2( np.maximum( f, 1 ) / 5000 ), 0, 1 )
		vw = gaussian_filter1d( v_o.astype( float ), 1.5 )[ :, None ]
		fric = P.get( 'fric', 2 + 0.35 * P[ 'tilt' ] )
		lsp_o = lsp_o + ( vw * gdb[ None, : ] - ( 1 - vw ) * fric ) * np.log( 10 ) / 10
		lsp_o = lsp_o + 2 * ( P[ 'shim' ] * rng.standard_normal( nO ) + 0.5 * P[ 'shim' ] * lp_noise( rng, nO, 8 ) )[ :, None ]
		H = P[ 'hoarse' ] * np.clip( ( f - 600 ) / 2400, 0, 1 ) ** 0.7
		hv = np.clip( 0.8 + 0.35 * lp_noise( rng, nO, 10 ), 0.4, 1.3 )[ :, None ]
		ap_o = np.clip( 1 - ( 1 - ap_o ) * ( 1 - np.clip( H[ None, : ] * hv, 0, 0.95 ) ), 0.001, 0.999 )
		y = pw.synthesize( np.ascontiguousarray( f0_o ), np.ascontiguousarray( np.exp( lsp_o ) ), np.ascontiguousarray( ap_o ), fs, FP )
		y = hp( y, fs, P[ 'hpf' ] )
		y = trim( y, fs, -40, 0.01, 0.07 )
		y = fade( y, fs, 0.006, 0.035 )
		out.append( ( y, ph.get( 'gap', 0.25 ) ) )
	# phrases in a row
	parts = []
	for i, ( y, gap ) in enumerate( out ):
		parts.append( y )
		if i < len( out ) - 1:
			parts.append( np.zeros( int( gap * SRV ) ) )
	y = np.concatenate( parts )
	y = deess( y, SRV )
	y = saturate( y, P[ 'drive' ] )
	y = compress( y, SRV, P[ 'comp' ][ 0 ], P[ 'comp' ][ 1 ] )
	return y

# ------------------------------------------------------------------ the people (voice, pitch, how hard they shout)

PEOPLE = {
	# the old beer man, 30 seasons: a big low voice gone gravelly, drawn out
	'beerman': dict( voice = 'mike', base = 148, formant = 0.95, f1 = 0.10, tilt = 9, hoarse = 0.5, jit = 0.022, shim = 0.08, wander = 0.02, tremor = 0.22, drive = 2.4, comp = ( -22, 3 ) ),
	# a younger beer man
	'beerman2': dict( voice = 'joe', base = 192, formant = 1.0, f1 = 0.08, tilt = 8, hoarse = 0.22, jit = 0.014, shim = 0.06, drive = 2.0, comp = ( -22, 3 ) ),
	'hotdogs': dict( voice = 'john', base = 172, formant = 0.98, f1 = 0.10, tilt = 9, hoarse = 0.42, jit = 0.018, shim = 0.07, tremor = 0.12, drive = 2.2, comp = ( -22, 3 ) ),
	'peanuts': dict( voice = 'joe', base = 160, formant = 0.93, f1 = 0.10, tilt = 9, hoarse = 0.42, jit = 0.018, shim = 0.08, tremor = 0.18, drive = 2.4, comp = ( -22, 3 ) ),
	'lemonade': dict( voice = 'ljspeech', base = 330, formant = 1.0, f1 = 0.08, tilt = 7, hoarse = 0.3, jit = 0.012, shim = 0.05, drive = 1.8, hpf = 130, comp = ( -22, 3 ) ),
	'cotton': dict( voice = 'bryce', base = 205, formant = 1.02, f1 = 0.08, tilt = 8, hoarse = 0.28, jit = 0.014, shim = 0.06, drive = 2.0, comp = ( -22, 3 ) ),
	'cocoa': dict( voice = 'mike', base = 184, formant = 1.05, f1 = 0.10, tilt = 9, hoarse = 0.45, jit = 0.02, shim = 0.08, tremor = 0.15, drive = 2.3, comp = ( -22, 3 ) ),
	# fans: ordinary voices, raised but not shouting
	'fan': dict( mode = 'speak', voice = 'bryce', base = 150, range = 1.35, formant = 0.95, f1 = 0.05, tilt = 5, hoarse = 0.12, jit = 0.008, drive = 1.4, ls = 0.95 ),
	'grump': dict( mode = 'speak', voice = 'john', base = 150, range = 1.5, formant = 1.04, f1 = 0.06, tilt = 6, hoarse = 0.2, jit = 0.012, drive = 1.6 ),
	'grump2': dict( mode = 'speak', voice = 'kristin', base = 245, range = 1.4, formant = 1.0, f1 = 0.05, tilt = 5, hoarse = 0.15, jit = 0.008, drive = 1.5, hpf = 120 ),
	'kid': dict( mode = 'speak', voice = 'ljspeech', base = 355, range = 1.6, formant = 1.17, f1 = 0.03, tilt = 4, hoarse = 0.1, jit = 0.006, drive = 1.3, hpf = 150, ls = 0.92 ),
	'squeeze': dict( mode = 'speak', voice = 'kristin', base = 185, range = 1.1, formant = 1.02, tilt = 1, hoarse = 0.08, jit = 0.004, shim = 0.02, drive = 1.0, hpf = 110, ls = 0.88 ),
	'usher': dict( mode = 'speak', voice = 'norman', base = 112, range = 1.15, formant = 1.0, f1 = 0.03, tilt = 4, hoarse = 0.12, jit = 0.008, drive = 1.3, ls = 0.95 ),
}
# Raw phonemes ([[ ... ]], the Philly vowels) only for the voices phonemized as en-us (joe, mike); the others
# (bryce, john, kristin, ljspeech, norman) were trained on espeak's British 'en' phonemes, so they get plain text.

# notes: (start semitones, end semitones, stretch[, glide fraction]) per syllable nucleus, relative to the base pitch
CALLS = {
	'beer-1': ( 'beerman', [
		dict( t = 'Beer here!', n = [ ( 0, 0.5, 2.3 ), ( 3, -2, 2.7 ) ], gap = 0.3 ),
		dict( t = 'Cold beer!', n = [ ( 1, 1, 1.4 ), ( 4, -1, 2.5 ) ] ),
	], 'Beer here! Cold beer!' ),
	'beer-2': ( 'beerman', [
		dict( t = '[[ bˈiːə! ]]', n = [ ( 3, -3, 2.4, 0.5 ) ], gap = 0.32 ),
		dict( t = '[[ ɡˈɛtʃə bˈɪɹ hˈiːə! ]]', n = [ ( 1, 1, 1.0 ), ( 0, 0, 1.0 ), ( 3, 3, 1.8 ), ( 2, -3, 2.4 ) ] ),
	], "Bee-ah! Getcha beer here!" ),
	'beer-3': ( 'beerman2', [
		dict( t = "Who's thirsty?", n = [ ( 0, 0, 1.2 ), ( 3, 3, 1.5 ), ( 5, 6.5, 1.4 ) ], gap = 0.3 ),
		dict( t = 'Beer here!', n = [ ( 4, 4, 2.0 ), ( 2, -2, 2.5 ) ], take = 2 ),
	], "Who's thirsty? Beer here!" ),
	'hotdogs-1': ( 'hotdogs', [
		dict( t = 'Hot dogs!', n = [ ( 3, 3, 1.3 ), ( 5, 1, 2.3 ) ], gap = 0.3 ),
		dict( t = 'Get your hot dogs here!', n = [ ( 0, 0, 1 ), ( 0, 0, 1 ), ( 3, 3, 1.2 ), ( 4, 4, 1.8 ), ( 2, -3, 2.0 ) ] ),
	], 'Hot dogs! Get your hot dogs here!' ),
	'hotdogs-2': ( 'hotdogs', [
		dict( t = 'Hot dogs, hot dogs!', n = [ ( 5, 5, 1.2 ), ( 7, 5, 2.0 ), ( 2, 2, 1.2 ), ( 4, -1, 2.5 ) ] ),
	], 'Hot dogs, hot dogs!' ),
	'peanuts-1': ( 'peanuts', [
		dict( t = 'Hey, peanuts!', n = [ ( 0, 0, 1.0 ), ( 4, 4, 1.4 ), ( 0, -1, 1.1 ) ], gap = 0.28 ),
		dict( t = 'Peanuts here!', n = [ ( 4, 4, 1.2 ), ( 1, 1, 1.0 ), ( 2, -3, 2.2 ) ] ),
	], 'Hey, peanuts! Peanuts here!' ),
	'peanuts-2': ( 'peanuts', [
		dict( t = '[[ ɡɛtʃɚ pˈiːnʌts! ]]', n = [ ( 0, 0, 1 ), ( 0, 0, 1 ), ( 5, 5, 2.4 ), ( 1, -2, 1.4 ) ] ),
	], 'Getcha peanuts!' ),
	'lemonade-1': ( 'lemonade', [
		dict( t = 'Lemonade!', n = [ ( 2, 2, 1.1 ), ( 0, 0, 1.0 ), ( 5, 1, 2.4 ) ], gap = 0.3 ),
		dict( t = 'Ice cold lemonade!', n = [ ( 4, 4, 1.6 ), ( 4, 3, 1.6 ), ( 0, 0, 1 ), ( -1, -1, 1 ), ( 3, -2, 2.2 ) ] ),
	], 'Lemonade! Ice cold lemonade!' ),
	'cotton-candy-1': ( 'cotton', [
		dict( t = 'Cotton candy!', n = [ ( 3, 3, 1.6 ), ( 2, 2, 1.0 ), ( 5, 5, 1.6 ), ( 2, -2, 2.2 ) ] ),
	], 'Cotton candy!' ),
	'cotton-candy-2': ( 'cotton', [
		dict( t = 'Cotton candy!', n = [ ( 4, 4, 1.3 ), ( 3, 3, 1.0 ), ( 6, 6, 1.4 ), ( 3, 3, 1.3 ) ], gap = 0.22, take = 1 ),
		dict( t = 'Cotton candy!', n = [ ( 2, 2, 1.3 ), ( 1, 1, 1.0 ), ( 4, 4, 1.4 ), ( 1, -3, 2.3 ) ], take = 2 ),
	], 'Cotton candy! Cotton candy!' ),
	'hot-chocolate-1': ( 'cocoa', [
		dict( t = 'Hot chocolate!', n = [ ( 2, 2, 1.2 ), ( 5, 5, 1.9 ), ( 1, -1, 1.4 ) ], gap = 0.3 ),
		dict( t = '[[ hˈɑːt tʃˈɑːklət hˈiːə! ]]', n = [ ( 2, 2, 1.1 ), ( 4, 4, 1.5 ), ( 1, 1, 1 ), ( 1, -3, 2.3 ) ] ),
	], 'Hot chocolate! Hot chocolate here!' ),
	'hot-chocolate-2': ( 'cocoa', [
		dict( t = 'Hot chocolate!', n = [ ( 4, 4, 1.3 ), ( 6, 6, 2.2 ), ( 2, -2, 1.6 ) ], take = 1 ),
	], 'Hot chocolate!' ),
	'fan-beer-man': ( 'fan', [
		dict( t = 'Hey, beer man!', S = [ 1.3, 1.0, 1.2 ], gap = 0.22 ),
		dict( t = 'Two here!', S = [ 1.2, 1.3 ] ),
	], 'Hey, beer man! Two here!' ),
	'fan-two-dogs': ( 'fan', [
		dict( t = 'Over here!', S = [ 1.0, 1.0, 1.3 ], gap = 0.2 ),
		dict( t = 'Two dogs!', S = [ 1.2, 1.3 ], take = 1 ),
	], 'Over here! Two dogs!' ),
	'down-in-front-1': ( 'grump', [
		dict( t = 'Down in front!', S = [ 1.2, 1.0, 1.5 ] ),
	], 'Down in front!' ),
	'down-in-front-2': ( 'grump2', [
		dict( t = 'Down in front!', S = [ 1.1, 1.0, 1.3 ] ),
	], 'Down in front!' ),
	'kid-on-tv': ( 'kid', [
		dict( t = "We're on TV!", S = [ 1.0, 1.0, 1.0, 1.4 ], gap = 0.2 ),
		dict( t = "Mom, we're on TV!", S = [ 1.3, 1.0, 1.0, 1.0, 1.5 ] ),
	], "We're on TV! Mom, we're on TV!" ),
	'excuse-me': ( 'squeeze', [
		dict( t = 'Excuse me, sorry,', gap = 0.12 ),
		dict( t = 'excuse me.' ),
	], 'Excuse me, sorry, excuse me.' ),
	'usher-tickets': ( 'usher', [
		dict( t = 'Can I see your tickets?', gap = 0.45 ),
		dict( t = 'Right down there, row eight.' ),
	], 'Can I see your tickets? Right down there, row 8.' ),
}
VOICE_LOUDNESS = -14.0   # LUFS for every voice clip (peaks held at -1 dBFS)

# ------------------------------------------------------------------ recordings (Freesound CC0 previews)

FREESOUND = {
	'69586': 'JamesOC', '85675': 'tmkappelt', '235487': 'ekfink', '413748': 'My Name Here',
	'545532': 'rsellick', '658410': 'IENBA', '663672': 'Solar01', '770763': 'AquarianThunderProductions',
}

def fs_load( fid, sr = SRF ):
	f = RAW / ( fid + '.ogg' )
	if not f.exists():
		RAW.mkdir( parents = True, exist_ok = True )
		subprocess.run( [ 'node', str( ROOT / 'tools' / 'audio' / 'dl.mjs' ), f'{fid}:{FREESOUND[ fid ]}' ], cwd = RAW.parent, check = True )
	meta = json.loads( ( RAW / ( fid + '.json' ) ).read_text() )
	assert 'publicdomain/zero' in meta[ 'license' ], f'{fid} is not CC0: {meta[ "license" ]}'
	a, r = sf.read( str( f ), always_2d = True )
	x = a.mean( 1 )
	if r != sr:
		g = np.gcd( int( r ), int( sr ) )
		x = signal.resample_poly( x, sr // g, int( r ) // g )
	return x

def seg( x, t0, t1, sr = SRF ):
	return x[ int( t0 * sr ): int( t1 * sr ) ].copy()

def best_window( x, sr, dur, lo = 0.0, hi = None, avoid_clip = 0.98 ):
	"""the `dur` window whose quietest 50 ms is loudest (steady activity), skipping clipped samples"""
	hi = hi or len( x ) / sr
	h = int( 0.05 * sr )
	best, bt = -1e9, lo
	for t in np.arange( lo, hi - dur, 0.02 ):
		w = x[ int( t * sr ): int( ( t + dur ) * sr ) ]
		if np.max( np.abs( w ) ) > avoid_clip:
			continue
		r = np.sqrt( np.mean( w[ :len( w ) // h * h ].reshape( -1, h ) ** 2, axis = 1 ) )
		s = np.percentile( r, 20 )
		if s > best:
			best, bt = s, t
	return bt

def onset( x, sr, thr_db = -30 ):
	e = np.abs( x )
	i = np.where( e > np.max( e ) * 10 ** ( thr_db / 20 ) )[ 0 ]
	return i[ 0 ] if len( i ) else 0

# ------------------------------------------------------------------ synthesized foley

def modes( exc, sr, bank ):
	"""modal synthesis: a bank of decaying resonators (freq Hz, decay tau s, amplitude) excited by `exc`; each
	resonator's impulse response is amplitude * r^n sin(w n), so the amplitudes are the modes' own levels"""
	y = np.zeros_like( exc )
	for f, tau, g in bank:
		if f >= sr / 2 * 0.95:
			continue
		r = np.exp( -1 / ( tau * sr ) )
		w = 2 * np.pi * f / sr
		y += g * signal.lfilter( [ 0, np.sin( w ) ], [ 1, -2 * r * np.cos( w ), r * r ], exc )
	return y

SEATS = {
	# modal scale (pan size/stiffness), rebounds, extra: CBP's seats are molded plastic pans and backs on cast
	# iron standards; a counterweighted pan swings up when you stand and stops against the frame
	'seat-clack-1': dict( sc = 1.0, rebounds = 2, creak = False, rattle = False ),
	'seat-clack-2': dict( sc = 0.87, rebounds = 1, creak = False, rattle = True ),    # an older, heavier pan; a loose armrest
	'seat-clack-3-squeak': dict( sc = 1.1, rebounds = 2, creak = True, rattle = False ),
}

def seat_clack( name, rng ):
	"""a plastic stadium seat folding up against its standard: the hinge's swish (or creak), the clack of the
	pan on the stop (a flam of two contacts), a rebound or two, and the iron frame ringing faintly"""
	S = SEATS[ name ]
	sr = SRF
	n = int( 0.6 * sr )
	t_hit = 0.14 + rng.uniform( -0.015, 0.02 )
	sc = S[ 'sc' ] * rng.uniform( 0.97, 1.03 )
	# plastic pan: a hollow knock, heavily damped (polypropylene)
	plastic = [ ( 215 * sc, 0.022, 0.30 ), ( 470 * sc, 0.018, 0.70 ), ( 820 * sc, 0.015, 1.00 ), ( 1310 * sc, 0.011, 0.85 ), ( 1990 * sc, 0.008, 0.65 ),
		( 2870 * sc, 0.006, 0.45 ), ( 3960 * sc, 0.0045, 0.32 ), ( 5420 * sc, 0.0035, 0.22 ), ( 7300 * sc, 0.0025, 0.14 ) ]
	sm = rng.uniform( 0.95, 1.05 )
	# the cast-iron standard and steel pivot: a few long, quiet partials
	metal = [ ( 1130 * sm, 0.08, 0.075 ), ( 2870 * sm, 0.06, 0.06 ), ( 4430 * sm, 0.05, 0.045 ), ( 6210 * sm, 0.035, 0.03 ), ( 8120 * sm, 0.025, 0.02 ) ]
	hits = [ ( t_hit, 1.0 ), ( t_hit + rng.uniform( 0.0015, 0.0035 ), rng.uniform( 0.45, 0.75 ) ) ]   # the flam
	d = rng.uniform( 0.038, 0.058 )
	hits.append( ( t_hit + d, rng.uniform( 0.25, 0.4 ) ) )
	if S[ 'rebounds' ] > 1:
		hits.append( ( t_hit + d + d * rng.uniform( 0.55, 0.7 ), rng.uniform( 0.07, 0.13 ) ) )
	if S[ 'rattle' ]:
		t = t_hit + 0.012
		for k in range( rng.integers( 4, 7 ) ):
			t += rng.uniform( 0.009, 0.018 )
			hits.append( ( t, 0.06 * np.exp( -k * 0.35 ) * rng.uniform( 0.6, 1.2 ) ) )
	exc = np.zeros( n )
	for th, a in hits:
		i = int( th * sr )
		L = int( 0.002 * sr )
		exc[ i:i + L ] += a * rng.standard_normal( L ) * np.exp( -np.arange( L ) / ( 0.0004 * sr ) )
		exc[ i ] += a * 1.5
	body = modes( exc, sr, plastic ) + modes( exc, sr, metal ) * rng.uniform( 0.8, 1.2 )
	body /= np.max( np.abs( body ) ) + 1e-12
	click = hp( exc, sr, 3000 )
	body += click / ( np.max( np.abs( click ) ) + 1e-12 ) * 0.22
	y = body
	# before the hit: the pan swinging up
	sw0 = t_hit - rng.uniform( 0.10, 0.13 )
	i0, i1 = int( sw0 * sr ), int( t_hit * sr )
	u = np.linspace( 0, 1, i1 - i0 )
	swish = bp( rng.standard_normal( i1 - i0 ), sr, 900, 4500 )
	y[ i0:i1 ] += swish / ( np.std( swish ) + 1e-12 ) * ( u ** 1.5 ) * 10 ** ( -34 / 20 )
	if S[ 'creak' ]:
		# stick-slip in a dry pivot: a pulse train, its rate rising as the pan speeds up, through the pivot's resonances
		rate = np.linspace( rng.uniform( 60, 80 ), rng.uniform( 140, 180 ), i1 - i0 )
		ph = np.cumsum( rate / sr )
		pulses = np.zeros( i1 - i0 )
		pulses[ np.where( np.diff( np.floor( ph ) ) > 0 )[ 0 ] ] = 1.0
		pulses *= np.clip( 1 + 0.35 * rng.standard_normal( i1 - i0 ), 0.2, 2 )
		cr = modes( pulses, sr, [ ( 1580 * sm, 0.005, 1.0 ), ( 2710 * sm, 0.004, 0.6 ), ( 4150 * sm, 0.003, 0.35 ), ( 820 * sm, 0.006, 0.3 ) ] )
		y[ i0:i1 ] += cr / ( np.max( np.abs( cr ) ) + 1e-12 ) * np.sin( np.pi * u ) ** 0.7 * 10 ** ( -20 / 20 )
	y = hp( y, sr, 70 )
	y = trim( y, sr, -60, 0.005, 0.05 )
	return to_peak( fade( y, sr, 0.004, 0.06 ) )

def peanut_rattles( n, sr, rng, shakes ):
	"""peanuts in the shell shifting in a bag: dry little woody tocks, bunched into shakes"""
	y = np.zeros( n )
	for c, w, k in shakes:
		for _ in range( k ):
			t = rng.normal( c, w )
			i = int( t * sr )
			if i < 0 or i >= n - 400:
				continue
			L = int( 0.0006 * sr )
			e = np.zeros( n )
			e[ i:i + L ] = rng.standard_normal( L ) * np.exp( -np.arange( L ) / ( 0.00015 * sr ) )
			s = rng.uniform( 0.85, 1.2 )
			y += modes( e, sr, [ ( 2300 * s, 0.003, 1.0 ), ( 3700 * s, 0.0025, 0.8 ), ( 5600 * s, 0.002, 0.6 ), ( 1400 * s, 0.003, 0.4 ) ] ) * np.exp( rng.normal( 0, 0.5 ) )
	return y

def flash_whine( dur, sr, f0, f1, tau, rng, fin = 0.04, fout = 0.12 ):
	"""a photo flash's charging oscillator: a thin tone rising as the capacitor fills, a little unsteady"""
	n = int( dur * sr )
	t = np.arange( n ) / sr
	f = f0 + ( f1 - f0 ) * ( 1 - np.exp( -t / tau ) )
	f = f * ( 1 + 0.004 * lp_noise( rng, n, sr * 0.004 ) )
	ph = 2 * np.pi * np.cumsum( f ) / sr
	y = np.sin( ph ) + 0.12 * np.sin( 2 * ph + 0.3 ) + 0.05 * np.sin( 3 * ph + 1.1 ) + 0.03 * np.sin( 0.5 * ph )
	amp = ( 0.75 + 0.25 * np.clip( t / dur, 0, 1 ) ) * ( 1 + 0.06 * lp_noise( rng, n, sr * 0.01 ) )
	y = y * amp + 0.02 * bp( rng.standard_normal( n ), sr, 2000, 9000 )
	return fade( y, sr, fin, fout )

def foley( name ):
	rng = rng_for( name )
	if name.startswith( 'seat-clack' ):
		return seat_clack( name, rng ), SRF
	if name == 'peanut-bag':
		bag = fs_load( '545532' )
		t = best_window( bag, SRF, 1.3, 1.0, 19.0 )
		b = seg( bag, t, t + 1.3 )
		env = np.sqrt( uniform_filter1d( b ** 2, int( 0.04 * SRF ) ) )
		env = env / ( env.max() + 1e-12 )
		r = peanut_rattles( len( b ), SRF, rng, [ ( 0.25, 0.06, 14 ), ( 0.62, 0.07, 18 ), ( 1.0, 0.05, 10 ) ] )
		r = r / ( np.max( np.abs( r ) ) + 1e-12 ) * np.max( np.abs( b ) ) * 0.55
		y = b + r * ( 0.3 + 0.7 * env )
		return to_peak( fade( hp( y, SRF, 80 ), SRF, 0.02, 0.15 ) ), SRF
	if name == 'coins-bill':
		bill = fs_load( '413748' )
		t = best_window( bill, SRF, 0.55, 4.3, 7.3, avoid_clip = 0.7 )
		b = fade( seg( bill, t, t + 0.55 ), SRF, 0.02, 0.12 )
		coins = fs_load( '235487' )
		c = fade( seg( coins, 1.88, 2.34 ), SRF, 0.01, 0.12 )   # one jangle of change dropped into a palm
		b = b / ( np.max( np.abs( b ) ) + 1e-12 ) * 0.5
		c = c / ( np.max( np.abs( c ) ) + 1e-12 )
		at = 0.4
		n = int( at * SRF ) + len( c )
		y = np.zeros( n )
		y[ :len( b ) ] += b[ :n ]
		y[ int( at * SRF ): int( at * SRF ) + len( c ) ] += c
		return to_peak( hp( y, SRF, 90 ) ), SRF
	if name == 'poncho':
		nyl = fs_load( '658410' )
		t = 0.95
		sw = seg( nyl, t, t + 1.6 )
		bag = fs_load( '663672' )
		tb = best_window( bag, SRF, 1.6, 10.5, 14.5 )
		cr = seg( bag, tb, tb + 1.6 )
		n = min( len( sw ), len( cr ) )
		sw, cr = sw[ :n ], cr[ :n ]
		env = np.sqrt( uniform_filter1d( sw ** 2, int( 0.05 * SRF ) ) )
		env = env / ( env.max() + 1e-12 )
		cr = cr / ( np.sqrt( np.mean( cr ** 2 ) ) + 1e-12 )
		sw = sw / ( np.sqrt( np.mean( sw ** 2 ) ) + 1e-12 )
		y = 0.8 * cr * ( 0.15 + env ) + 0.5 * sw
		return to_peak( fade( hp( y, SRF, 120 ), SRF, 0.03, 0.2 ) ), SRF
	if name == 'camera-flash':
		sh = fs_load( '85675' )
		o = onset( sh, SRF, -20 ) / SRF
		click = fade( seg( sh, o - 0.004, o + 0.28 ), SRF, 0.002, 0.08 )
		click = click / ( np.max( np.abs( click ) ) + 1e-12 )
		w1 = flash_whine( 1.55, SRF, 3100, 6900, 0.55, rng, 0.05, 0.1 ) * 0.07
		w2 = flash_whine( 0.95, SRF, 2800, 5200, 0.7, rng, 0.03, 0.35 ) * 0.06
		t_click = 1.55 + 0.32
		n = int( ( t_click + 0.12 + 0.95 ) * SRF )
		y = np.zeros( n )
		y[ :len( w1 ) ] += w1
		i = int( t_click * SRF )
		y[ i:i + len( click ) ] += click
		j = int( ( t_click + 0.12 ) * SRF )
		y[ j:j + len( w2 ) ] += w2[ :n - j ]
		return to_peak( hp( y, SRF, 100 ) ), SRF
	if name == 'flip-phone':
		x = fs_load( '69586' )
		o = onset( x, SRF, -20 ) / SRF
		y = seg( x, max( 0, o - 0.003 ), o + 0.35 )
		return to_peak( fade( hp( y, SRF, 80 ), SRF, 0.001, 0.12 ) ), SRF
	if name == 'thank-you':
		x = fs_load( '770763', SRV )
		y = trim( x, SRV, -45, 0.02, 0.08 )
		y = compress( hp( y, SRV, 100 ), SRV, -20, 2.0 )
		return to_loudness( fade( y, SRV, 0.01, 0.05 ), SRV, VOICE_LOUDNESS ), SRV
	raise KeyError( name )

FOLEY = {
	'seat-clack-1': 'A plastic stadium seat springing up against its iron standard (clack, rebound, frame ring)',
	'seat-clack-2': 'An older, heavier seat: a lower clack, one rebound, a loose armrest rattling after',
	'seat-clack-3-squeak': 'A seat with a creaking hinge, then the clack',
	'peanut-bag': 'A paper bag of peanuts in the shell, rustled and shaken',
	'coins-bill': 'A crumpled bill and a handful of change handed over',
	'poncho': 'A clear plastic poncho crinkling as someone moves in their seat',
	'camera-flash': "A point-and-shoot's flash charging (whine), the shutter, and the flash recharging",
	'flip-phone': 'A flip phone snapped shut (a Sony Ericsson W300i, 2006)',
	'thank-you': 'A woman: "Thank you!"',
}
FOLEY_SOURCES = {
	'seat-clack-1': 'synthesized', 'seat-clack-2': 'synthesized', 'seat-clack-3-squeak': 'synthesized',
	'peanut-bag': 'Freesound 545532 rsellick (CC0) + synthesized peanut rattles',
	'coins-bill': 'Freesound 413748 My Name Here (bill) + 235487 ekfink (coins), both CC0',
	'poncho': 'Freesound 663672 Solar01 (thin plastic bag) shaped by 658410 IENBA (raincoat movement), both CC0',
	'camera-flash': 'Freesound 85675 tmkappelt (disposable camera shutter, CC0) + synthesized flash-charge whine',
	'flip-phone': 'Freesound 69586 JamesOC (CC0)',
	'thank-you': 'Freesound 770763 AquarianThunderProductions (CC0)',
}

# ------------------------------------------------------------------ build

def build( name ):
	if name in CALLS:
		who, phrases, text = CALLS[ name ]
		y = call( name, PEOPLE[ who ], phrases )
		y = to_loudness( y, SRV, VOICE_LOUDNESS )
		sr, kbps = SRV, 64
	else:
		y, sr = foley( name )
		kbps = 64 if sr == SRV else 80
	WAVS.mkdir( parents = True, exist_ok = True )
	sf.write( str( WAVS / ( name + '.wav' ) ), y, sr, subtype = 'FLOAT' )
	size = write_mp3( OUT / ( name + '.mp3' ), y, sr, kbps )
	L = loudness( y, sr )
	print( f'{name:22s} {len(y)/sr:5.2f}s  peak {db(np.max(np.abs(y))):5.1f} dBFS  {L:6.1f} LUFS  {size/1024:5.1f} KB  {sr} Hz {kbps} kbps' )
	return dict( name = name, dur = len( y ) / sr, lufs = L, size = size )

def main():
	args = [ a for a in sys.argv[ 1: ] if not a.startswith( '--' ) ]
	names = args or ( list( CALLS ) + list( FOLEY ) )
	for n in names:
		build( n )
	if '--asr' in sys.argv:
		subprocess.run( [ sys.executable, str( WORK / 'asr.py' ) ] + [ str( WAVS / ( n + '.wav' ) ) for n in names if n in CALLS or n == 'thank-you' ] )

if __name__ == '__main__':
	main()
