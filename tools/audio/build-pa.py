#!/usr/bin/env python3
"""Dan Baker's lines (public/audio/ballpark/pa/): every batter, pinch hitter and runner, pitching change and
announcement the soundscape's plan uses, from tools/audio/pa-lines.json (node tools/audio/pa-lines.mjs).

    python tools/audio/build-pa.py              # every line
    python tools/audio/build-pa.py bat-400284   # some
    python tools/audio/build-pa.py --asr        # and transcribe them (faster-whisper) to check the words

The voice: Piper TTS (MIT) with en_US-mike-medium (CC0 dataset), through tools/audio/build-home.py's WORLD
vocoder pass. Baker's delivery is drawn on it per phrase from its role:
  - "Now batting," / "Leading off for the Phillies,": a declaiming lift that hangs at the end;
  - "number twenty-six,", "second baseman,": each a small rise, hung;
  - the name: for a Phillies batter both names drawn out and sung up (his "Chaassseeee Utttleeeeeyyy"),
    the last name's stressed vowel lifted highest and the last syllable falling away long; the visitors
    read "straight" (his word), quick and level;
  - the announcements: declarative, the big lines lifted.
He doesn't shout ("You can't shout all the time"): a warm, projected baritone, no strain. Then the booth's
microphone and the PA's horns: a band from 110 Hz to 7.5 kHz, a presence lift, gentle compression.
The echo is the park's, added in the browser (places/sound/PA.js). Written as 22 kHz mono MP3s, 40 kbps,
with index.json ({ key: { f, d, text } }).
"""
import importlib.util, json, os, subprocess, sys
from pathlib import Path
import numpy as np
from scipy import signal
import soundfile as sf

ROOT = Path( __file__ ).resolve().parents[ 2 ]
spec = importlib.util.spec_from_file_location( 'home', ROOT / 'tools' / 'audio' / 'build-home.py' )
H = importlib.util.module_from_spec( spec )
spec.loader.exec_module( H )
OUT = ROOT / 'public' / 'audio' / 'ballpark' / 'pa'
WAVS = H.WORK / 'pa-wav'
SR = H.SRV
# how far the Phillies' names are drawn out and lifted (for trying takes: NS, NR in the environment)
NS = float( os.environ.get( 'PA_NS', 0.4 ) )
NR = float( os.environ.get( 'PA_NR', 1.0 ) )

# Baker: a baritone, a bigger tract than the voice's own, projected, not shouting
BAKER = dict( mode = 'sing', voice = 'mike', base = 108, formant = 0.955, f1 = 0.03, tilt = 3.0, hoarse = 0.06, jit = 0.004, shim = 0.02,
	wander = 0.006, micro = 0.55, tremor = 0.0, drive = 1.15, comp = ( -20, 2.2 ), hpf = 80, scoop = 0.8, glide = 0.5, ns = 0.5, nw = 0.7 )

def stressed( items, nuc ):
	"""which syllable nuclei carry the primary stress mark"""
	out = []
	for a, b, av in nuc:
		out.append( any( p == 'ˈ' and a <= s < b for p, s, e in items ) or av != a )
	return out

def contour( role, n, st, hype, home ):
	"""per syllable: (start semitones, end semitones, stretch[, glide]) for a phrase of n syllables,
	st: which are stressed"""
	notes = []
	last = n - 1
	# where the stresses are; the phrase's main one is its last stressed syllable
	main = max( [ i for i in range( n ) if st[ i ] ] or [ last ] )
	if role == 'name' and hype > 0:
		# both names sung up and drawn out; the first name's stress punched, the last name's lifted
		# highest, the final syllable falling away long
		first_st = [ i for i in range( n ) if st[ i ] ]
		f_st = first_st[ 0 ] if first_st else 0
		k = min( 1.0, hype / 3 )
		for i in range( n ):
			if i == f_st and i != main:
				notes.append( ( 2 + 2 * k, 4 + 2.5 * k, 1 + ( 0.3 + 0.8 * k ) * NS, 0.6 ) )
			elif i < main:
				notes.append( ( 2 + 1.5 * k, 2.5 + 1.5 * k, 1 + ( 0.1 + 0.3 * k ) * NS ) )
			elif i == main and i < last:
				notes.append( ( 4 + 1.5 * k, 5.5 + 2.5 * k * NR, 1 + ( 0.5 + 1.0 * k ) * NS, 0.55 ) )
			elif i == main:
				# the stress on the last syllable ("Lidge", "Bur-RELL", "Fe-LIZ"): up and then down within it
				notes.append( ( 4 + 3 * k * NR, - 2, 1 + ( 1.0 + 1.2 * k ) * NS, 0.7 ) )
			elif i == last:
				notes.append( ( 4.5 + 2 * k * NR, - 3, 1 + ( 0.6 + 1.2 * k ) * NS, 0.8 ) )
			else:
				notes.append( ( 4 + 2 * k, 3 + 2 * k, 1 + ( 0.2 + 0.4 * k ) * NS ) )
		return notes
	for i in range( n ):
		s = st[ i ]
		if role == 'name' or role == 'end':
			# declarative: the stresses up a little, the last falling
			if i == last:
				notes.append( ( 1.5 if s else 0.5, - 3, 1.15 if home else 1.0, 0.7 ) )
			else:
				notes.append( ( 2 if s else 0, 2 if s else 0.3, 1.1 if s else 1.0 ) )
		elif role == 'big':
			k = min( 1.0, hype / 3 )
			if i == main:
				notes.append( ( 4 + 2 * k, 6 + 2 * k, 1.5 + 0.8 * k, 0.55 ) )
			elif i == last:
				notes.append( ( 4, - 2, 1.6 + 0.6 * k, 0.75 ) )
			else:
				notes.append( ( 2.5 if s else 1, 3 if s else 1.2, 1.15 if s else 1.0 ) )
		else:
			# lead / num / mid: a small declaiming rise that hangs at the end (more for the Phillies)
			lift = 1.0 if home else 0.5
			if i == last:
				notes.append( ( 2 * lift + ( 1 if s else 0 ), 3.5 * lift, 1.45 if home else 1.1, 0.5 ) )
			elif s:
				notes.append( ( 2.5 * lift, 3 * lift, 1.25 if home else 1.05 ) )
			else:
				notes.append( ( 0.5, 0.8, 1.0 ) )
	return notes

def line( key, phrases, take = 0 ):
	out = []
	for ph in phrases:
		side = ph.get( 'side', 'home' )
		home = side != 'away'
		hype = ph.get( 'hype', 0 ) or 0
		# his pace: unhurried; a Phillie's name slower still, every sound of it given its time (Piper's
		# own pace, so the consonants slow with the vowels and it stays clear)
		ls = ( 1.06 + ( 0.1 + 0.08 * hype if ph[ 'role' ] in ( 'name', 'big' ) and hype > 0 else 0 ) ) if home else 0.98
		tk = take if ph[ 'role' ] == 'name' else 0
		x, items = H.tts( BAKER[ 'voice' ], ph[ 't' ], ls, BAKER[ 'ns' ], BAKER[ 'nw' ], tk )
		nuc = H.nuclei( items )
		st = stressed( items, nuc )
		n = len( nuc )
		notes = contour( ph[ 'role' ], n, st, hype, home )
		gap = { 'lead': 0.42, 'num': 0.36, 'mid': 0.4 }.get( ph[ 'role' ], 0.3 ) * ( 1.0 if home else 0.55 )
		out.append( dict( t = ph[ 't' ], n = notes, gap = gap, ls = ls, take = tk ) )
	y = H.call( 'pa-' + key, BAKER, out )
	return mic( y )

# ---------------------------------------------------------------- the take a listener understands

_asr = None
def heard( y ):
	"""what faster-whisper hears in a clip (22 kHz)"""
	global _asr
	if _asr is None:
		from faster_whisper import WhisperModel
		_asr = WhisperModel( os.environ.get( 'ASR_MODEL', 'small.en' ), device = 'cpu', compute_type = 'int8' )
	x = signal.resample_poly( y, 16000, SR ).astype( np.float32 )
	x = np.concatenate( [ np.zeros( 4000, np.float32 ), x, np.zeros( 8000, np.float32 ) ] )
	segs, _ = _asr.transcribe( x, language = 'en', beam_size = 5, vad_filter = False )
	return ' '.join( s.text.strip() for s in segs )

def norm( s ):
	import unicodedata
	s = unicodedata.normalize( 'NFKD', s ).encode( 'ascii', 'ignore' ).decode().lower()
	return ''.join( c for c in s if c.isalpha() or c == ' ' )

def best( key, phrases, takes = 5 ):
	"""Piper's takes differ (its noise): up to `takes` of the name, the first whose name is heard right"""
	want = [ norm( p[ 'check' ] ) for p in phrases if p.get( 'check' ) ]
	if not want:
		return line( key, phrases )
	best_y, best_s = None, -1
	for take in range( takes ):
		y = line( key, phrases, take )
		got = norm( heard( y ) )
		s = sum( w in got for w in want ) / len( want )
		if s > best_s:
			best_y, best_s = y, s
		if s >= 1:
			break
	print( f'  {key}: take {take}, heard right: {best_s >= 1}' )
	return best_y

def mic( y ):
	"""the booth's microphone and the PA's horns"""
	y = H.hp( y, SR, 110, 2 )
	y = H.lp( y, SR, 7500, 4 )
	# presence: a lift round 2.8 kHz (the horns), a little chest
	b, a = peaking( 2800, 1.0, 3.5 )
	y = signal.lfilter( b, a, y )
	b, a = peaking( 220, 0.8, 1.5 )
	y = signal.lfilter( b, a, y )
	y = H.compress( y, SR, -18, 2.5 )
	return H.to_loudness( y, SR, -16.0 )

def peaking( f, q, gain_db ):
	A = 10 ** ( gain_db / 40 )
	w = 2 * np.pi * f / SR
	al = np.sin( w ) / ( 2 * q )
	b = np.array( [ 1 + al * A, -2 * np.cos( w ), 1 - al * A ] )
	a = np.array( [ 1 + al / A, -2 * np.cos( w ), 1 - al / A ] )
	return b / a[ 0 ], a / a[ 0 ]

def main():
	lines = json.loads( ( ROOT / 'tools' / 'audio' / 'pa-lines.json' ).read_text() )
	args = [ a for a in sys.argv[ 1: ] if not a.startswith( '--' ) ]
	keys = args or list( lines )
	OUT.mkdir( parents = True, exist_ok = True )
	WAVS.mkdir( parents = True, exist_ok = True )
	idx_path = OUT / 'index.json'
	index = json.loads( idx_path.read_text() ) if idx_path.exists() else {}
	total = 0
	for k in keys:
		y = best( k, lines[ k ] ) if '--pick' in sys.argv else line( k, lines[ k ] )
		sf.write( str( WAVS / ( k + '.wav' ) ), y, SR, subtype = 'FLOAT' )
		size = H.write_mp3( OUT / ( k + '.mp3' ), y, SR, 40 )
		total += size
		index[ k ] = dict( f = k + '.mp3', d = round( len( y ) / SR, 2 ), text = ' '.join( p[ 't' ] for p in lines[ k ] ) )
		print( f'{k:24s} {len( y ) / SR:5.2f}s {size / 1024:5.1f} KB  {index[ k ][ "text" ]}' )
	# only the lines there are
	index = { k: v for k, v in index.items() if k in lines }
	idx_path.write_text( json.dumps( index, indent = '\t' ) )
	print( 'total', round( total / 1024 ), 'KB' )
	if '--asr' in sys.argv:
		subprocess.run( [ sys.executable, str( H.WORK / 'asr.py' ) ] + [ str( WAVS / ( k + '.wav' ) ) for k in keys ] )

if __name__ == '__main__':
	main()
