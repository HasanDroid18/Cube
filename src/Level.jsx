import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Cube3D, { RESET } from './Cube3D.jsx'
import { applyAll, chunks, COLORS, course, display, goalMet, helpMove, ink, inv, inverse, isRotation, LOOK, parse, pushMove, same, solved, stickerColor } from './cube.js'
import { TRICKS } from './levels.js'
import { sfx } from './sound.js'

const FACES = [['R', [1, 0, 0]], ['L', [-1, 0, 0]], ['U', [0, 1, 0]], ['D', [0, -1, 0]], ['F', [0, 0, 1]], ['B', [0, 0, -1]]]
const ORDER = ['R', 'U', 'F', 'L', 'D', 'B'] // pad columns: the faces you see first come first
const NAMES = { R: 'right', L: 'left', U: 'top', D: 'bottom', F: 'front', B: 'back', y: 'whole cube' }
const WAYS = { up: 'up', down: 'down', left: 'left', right: 'right', cw: 'round to the right', ccw: 'round to the left' }
const ALL = { solved: 'all' }
// colour of the center currently sitting on each face, so keys match what the player sees
const faceColors = state => Object.fromEntries(FACES.map(([f, p]) => {
  const c = state.find(c => c.p.every((v, i) => v === p[i]))
  const a = c.h.findIndex(Boolean)
  return [f, stickerColor(a, c.h[a])]
}))
const setup = (pre, alg = '') => applyAll(applyAll(solved(), pre), inverse(parse(alg)))
const fmt = ms => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${Math.floor(ms / 100) % 10}`
const stored = k => { try { return localStorage.getItem(k) === '1' } catch { return false } }
const store = (k, v) => { try { localStorage.setItem(k, v ? '1' : '0') } catch { /* storage unavailable */ } }
const canSpeak = typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined'
const pick = a => a[Math.floor(Math.random() * a.length)]
const CHEERS = ['You did it!', 'Wow, great turning!', 'Cube champion!', 'High five!', 'That was awesome!', 'You are a natural!', 'Look at you go!']
const STARS = ['', '1 sticker! Every try makes you better.', '2 stickers! Play again to get all 3.', '3 stickers! You did it all by yourself.']
const STUCK = 'Stuck? Tap Help and I will show you.'

export function randomMoves(n, half = true) {
  const out = []
  while (out.length < n) {
    const f = 'RLUDFB'[Math.floor(Math.random() * 6)]
    if (out.length && out.at(-1)[0] === f) continue
    out.push(f + ['', "'", '2'][Math.floor(Math.random() * (half ? 3 : 2))])
  }
  return parse(out.join(' '))
}

export const Icon = ({ d, size = 20 }) => <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden><path d={d} fill="currentColor" /></svg>
const MAP = 'M2 2h5.5v5.5H2zm7.25 0h5.5v5.5h-5.5zM16.5 2H22v5.5h-5.5zM2 9.25h5.5v5.5H2zm7.25 0h5.5v5.5h-5.5zm7.25 0H22v5.5h-5.5zM2 16.5h5.5V22H2zm7.25 0h5.5V22h-5.5zm7.25 0H22V22h-5.5z'
const HELP = 'M12 2a10 10 0 100 20 10 10 0 000-20zm1 17h-2v-2h2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26A2 2 0 1010 9H8a4 4 0 118 0c0 .88-.36 1.68-.93 2.25z'
const UNDO = 'M12.5 8a10.4 10.4 0 00-6.9 2.6L2 7v9h9l-3.62-3.62A8 8 0 0120.1 16l2.37-.78A10.5 10.5 0 0012.5 8z'
const PLAY = 'M7 4.5v15l12.5-7.5z', NEXT = 'M8.6 5.4L10 4l8 8-8 8-1.4-1.4 6.6-6.6z'
const CUBE = 'M12 2L3 7v10l9 5 9-5V7zm0 2.3L18.7 8 12 11.7 5.3 8zM5 9.7l6 3.3v6.7l-6-3.3zm8 10V13l6-3.3v6.7z'
const MIX = 'M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h6v6h-6z'
const ARROW = 'M12 2.5l8.5 9.5H15v9.5H9V12H3.5z'
const CURL = 'M12 5V1l5 5-5 5V7a6 6 0 106 6h2a8 8 0 11-8-8z'
const TURN = { up: 0, right: 90, down: 180, left: 270 }
// the way a move goes, as seen from the starting camera: straight arrows, or a curl for front/back turns
export const Glyph = ({ look, size = 26 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
    <path d={TURN[look] == null ? CURL : ARROW} fill="currentColor" transform={look === 'ccw' ? 'matrix(-1 0 0 1 24 0)' : look === 'cw' ? undefined : `rotate(${TURN[look]} 12 12)`} />
  </svg>
)
const Speaker = ({ on }) => <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden><path d="M3 9h4l5-4v14l-5-4H3z" fill="currentColor" />
  <path d={on ? 'M15.5 8.5a5 5 0 010 7M18 6a8.5 8.5 0 010 12' : 'M16 9.5l5 5m0-5l-5 5'} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>

// Pip: one corner piece of the cube, black plastic with three stickers, and a face on the green one
export function Pip({ mood = 'idle', hop = 0, size = 64 }) {
  const happy = mood === 'happy', oops = mood === 'oops', think = mood === 'thinking'
  const er = oops ? 5.8 : 5, px = think ? 1.6 : 0, py = think ? -1.8 : 0.6
  return (
    <svg className={`pip ${mood} ${hop % 2 ? 'hop-a' : hop ? 'hop-b' : ''}`} viewBox="0 0 64 64" width={size} height={size} aria-hidden>
      <path d="M7 19L19 7h38v38L45 57H7z" fill="#000" stroke="#000" strokeWidth="6" strokeLinejoin="round" />
      <path d="M11.5 17L19.5 9.5H53L45 17z" fill={COLORS[1][1]} />
      <path d="M47 21.5L54.5 13.5V43L47 51z" fill={COLORS[0][1]} />
      <rect x="10" y="21" width="33" height="33" rx="5" fill={COLORS[2][1]} />
      {happy
        ? <g stroke="#000" strokeWidth="2.6" fill="none" strokeLinecap="round"><path d="M15.5 36q4-5 8 0M29.5 36q4-5 8 0" /></g>
        : <g className="eyes">{[19.5, 33.5].map(x => <g key={x}><circle cx={x} cy="34" r={er} fill="#fff" /><circle cx={x + px} cy={34 + py} r="2.6" fill="#000" /></g>)}</g>}
      {happy ? <path d="M19 42q7.5 9 15 0z" fill="#000" />
        : oops ? <ellipse cx="26.5" cy="46" rx="2.6" ry="3" fill="#000" />
          : think ? <path d="M22 46.5l9-1.2" stroke="#000" strokeWidth="2.4" strokeLinecap="round" />
            : <path d="M21.5 44q5 4 10 0" stroke="#000" strokeWidth="2.4" fill="none" strokeLinecap="round" />}
    </svg>
  )
}

// a speech bubble from Pip: short lines, tap Next for more, optional read-aloud
export function Talk({ mood, hop, text, onNext, nextLabel = 'Next', read, onRead, dots }) {
  return (
    <div className="talk">
      <Pip mood={mood} hop={hop} />
      <div className="bubble">
        <p aria-live="polite">{text}</p>
        {canSpeak && onRead && <button className={`say ${read ? 'on' : ''}`} onClick={onRead} aria-pressed={!!read} aria-label="Read to me"><Speaker on /></button>}
        {(onNext || dots) && <div className="bubble-foot">
          {dots}
          {onNext && <button className="btn go next" onClick={onNext}>{nextLabel}<Icon d={NEXT} size={18} /></button>}
        </div>}
      </div>
    </div>
  )
}

// a sequence as little keys, grouped in chunks of up to 4
function Chips({ str, at, cols, letters }) {
  let n = 0
  return <div className="chips">
    {chunks(str).map((c, ci) => <span className="chunk" key={ci}>{c.map(m => {
      const i = n++, col = cols[m[0]] ?? 'var(--bare)'
      return <span key={i} className={`chip ${m.endsWith("'") ? 'rev' : ''} ${i < at ? 'done' : i === at ? 'now' : ''}`} style={{ '--c': col, '--t': ink(col) }}>
        <Glyph look={LOOK[m]} size={16} />{letters && <b>{m.replace("'", '’')}</b>}</span>
    })}</span>)}
  </div>
}

export function Rating({ n, big }) {
  return <span className={`rating ${big ? 'big' : ''}`} role="img" aria-label={`${n} of 3 stickers`}>
    {[0, 1, 2].map(i => <i key={i} className={i < n ? 'on' : ''} style={{ '--i': i }} />)}
  </span>
}

const SIX = COLORS.flat()
function Confetti() {
  const bits = useMemo(() => Array.from({ length: 54 }, (_, i) => ({
    left: Math.random() * 100, delay: Math.random() * 0.7, dur: 1.8 + Math.random() * 1.5, rot: (Math.random() - 0.5) * 900, color: SIX[i % 6],
  })), [])
  return <div className="confetti" aria-hidden>
    {bits.map((b, i) => <i key={i} style={{ left: `${b.left}%`, background: b.color, animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s`, '--rot': `${b.rot}deg` }} />)}
  </div>
}

export default function Level({ level, hasNext, nextLabel = 'Next', unlock, onWin, onNext, onMap }) {
  const cube = useRef()
  const { type, goal, pre } = level
  const [step, setStep] = useState(0)
  const [line, setLine] = useState(0) // bubble shown, of the current step's (or level's) lines
  const [phase, setPhase] = useState(null) // tour step: 'talk' | 'tap' | 'do' | 'demo' | 'done'
  const [idx, setIdx] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [moves, setMoves] = useState(0)
  const [hist, setHist] = useState([]) // player moves since the start, X X' cancelled (free play: since solved)
  const [co, setCo] = useState(null) // goal/boss: the course the help ladder walks
  const [helpOn, setHelpOn] = useState(false)
  const [helps, setHelps] = useState(0)
  const [won, setWon] = useState(null)
  const [cheer, setCheer] = useState('')
  const [flash, setFlash] = useState(null) // a short reaction from Pip: {text, mood}
  const [hop, setHop] = useState(0)
  const [shake, setShake] = useState(0)
  const letters = !!level.letters // the secret code: letters on keys once taught
  const [labels, setLabels] = useState(!!level.code) // and floating on the cube only while it is taught (they can cover pieces)
  const [muted, setMuted] = useState(sfx.muted)
  const [read, setRead] = useState(() => stored('cubewise-read'))
  const [swiped, setSwiped] = useState(() => stored('cubewise-swiped'))
  const [scrambling, setScrambling] = useState(type === 'boss')
  const [t0, setT0] = useState(null)
  const [now, setNow] = useState(0)
  const [cheat, setCheat] = useState(false)
  const idxRef = useRef(0)
  const timer = useRef(), flashT = useRef()
  const [cols, setCols] = useState(() => faceColors(solved()))
  const reset = useCallback(s => { cube.current.reset(s); setCols(faceColors(s)) }, [])

  const seq = useMemo(() => parse(level.seq || ''), [level])
  const tourStep = type === 'tour' ? level.steps[step] : null
  const stepSeq = useMemo(() => parse(tourStep?.alg || ''), [tourStep])
  const follow = type === 'follow' ? seq : phase === 'do' || phase === 'done' ? stepSeq : null
  const seqStr = type === 'follow' ? level.seq : tourStep?.alg
  const show = useCallback(c => display(c, type === 'free' ? null : goal), [type, goal])
  const stepStart = useCallback(() => setup(tourStep.pre ?? pre, tourStep.setup ?? tourStep.alg), [tourStep, pre])
  const playing = won == null && !scrambling && (type !== 'tour' || phase === 'do')
  const loose = type === 'goal' || type === 'boss' || type === 'free' // moves land as made, not checked against a sequence
  const undoable = loose && hist.length > 0 && playing

  // help ladder: where the player's cube is, and the move that brings it toward the goal from there
  const state = useMemo(() => co && applyAll(co.path[0], hist), [co, hist])
  const helpNext = co ? helpMove(co, state, hist) : null
  const onPath = !co || co.path.some(s => same(s, state))
  const par = type === 'goal' ? parse(level.alg).filter(m => !isRotation(m)).length : 0
  const stuck = type === 'goal' && !helpOn && !onPath && moves >= par + 3 && won == null

  const say = useCallback((text, mood, ms = 1800) => {
    clearTimeout(flashT.current); setFlash({ text, mood }); flashT.current = setTimeout(() => setFlash(null), ms)
  }, [])
  useEffect(() => () => { clearTimeout(flashT.current); clearTimeout(timer.current) }, [])

  const restart = useCallback(() => {
    clearTimeout(timer.current)
    setIdx(0); idxRef.current = 0; setMistakes(0); setMoves(0); setHist([]); setWon(null); setT0(null); setHelpOn(false); setHelps(0); setLine(0); setFlash(null)
    if (type === 'boss') {
      const m = randomMoves(20)
      reset(solved()); setScrambling(true); cube.current.enqueue(m, 'scramble', 5)
      setCo(course(applyAll(solved(), m), inverse(m)))
    } else {
      const s = setup(pre, type === 'goal' ? level.alg : type === 'follow' ? level.seq : '')
      reset(s); setCo(type === 'goal' ? course(s, parse(level.alg)) : null)
    }
  }, [level, pre, type, reset])
  useEffect(() => { if (type !== 'tour') restart() }, [restart, type])

  // tour: every step starts from solved + pre + inverse(setup or alg), so doing the step's moves fixes the cube
  useEffect(() => {
    if (!tourStep) return
    reset(stepStart()); setIdx(0); idxRef.current = 0; setLine(0); setFlash(null)
    setPhase(tourStep.tap ? 'tap' : tourStep.alg ? 'do' : 'talk')
    return () => clearTimeout(timer.current)
  }, [tourStep, stepStart, reset])

  useEffect(() => {
    if (t0 == null || won) return
    const id = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(id)
  }, [t0, won])

  const win = useCallback(stars => {
    clearTimeout(flashT.current); setFlash(null)
    setWon(stars); setCheer(pick(stars > 1 ? CHEERS : ['We did it together!', 'Great teamwork!', 'You did it!'])); onWin(stars); sfx.win()
    for (let i = 0; i < stars; i++) setTimeout(() => sfx.sticker(i), 600 + i * 220) // matches .rating.big delays
  }, [onWin])
  const advance = () => { if (step < level.steps.length - 1) setStep(step + 1); else win(3) }
  const stepDone = () => { setPhase('done'); say(pick(['Nice!', 'Yes!', 'Great job!', 'You got it!']), 'happy', 1000); timer.current = setTimeout(advance, 1000) }

  const onMoveDone = (move, st, tag) => {
    if (tag === 'scramble' && !cube.current.busy) setScrambling(false)
    if (tag === 'demo') {
      if (move) setIdx(i => i + 1) // the chips follow the demo
      if (!cube.current.busy) { reset(stepStart()); setIdx(0); idxRef.current = 0; setPhase('do'); say('Your turn! Follow the arrow.', 'happy', 2400) }
      return
    }
    if (move && isRotation(move)) setCols(faceColors(st))
    if (won != null || cube.current.busy || (tag !== 'player' && tag !== 'back')) return
    if (follow && idxRef.current === follow.length) {
      if (type === 'follow') win(mistakes <= 1 ? 3 : mistakes <= 3 ? 2 : 1)
      else { sfx.sticker(2); stepDone() }
      return
    }
    if ((type === 'goal' || type === 'boss') && goalMet(st, goal)) { setNow(Date.now()); win(helps === 0 ? 3 : helps <= 2 ? 2 : 1) }
    if (type === 'free' && hist.length && goalMet(st, ALL)) { setHist([]); sfx.win(); say('You fixed it!', 'happy') }
  }

  const press = useCallback(m => {
    if (!playing) return
    if (follow) {
      if (idxRef.current >= follow.length || isRotation(m)) return
      const want = follow[idxRef.current]
      if (m === want) { idxRef.current++; setIdx(idxRef.current); setHop(h => h + 1); cube.current.enqueue([m], 'player') }
      else {
        if (type === 'follow') setMistakes(x => x + 1)
        setShake(x => x + 1); sfx.wrong(); say(m === inv(want) ? 'Oops, other way!' : 'Oops! Follow the white arrow.', 'oops')
        cube.current.enqueue([m], 'wrong', 1.5); cube.current.enqueue(inverse([m]), 'undo', 3)
      }
      return
    }
    if (type === 'boss' && t0 == null) { setT0(Date.now()); setNow(Date.now()) }
    if (helpOn && helpNext) {
      if (m === helpNext) setHop(h => h + 1)
      else say(m === inv(helpNext) ? 'Oops, other way! Tap Help again.' : 'That was a different turn. Tap Help again!', 'oops', 2400)
    }
    setHelpOn(false)
    if (!isRotation(m)) setMoves(x => x + 1)
    setHist(h => pushMove(h, m))
    cube.current.enqueue([m], 'player')
  }, [playing, follow, type, t0, helpOn, helpNext, say])

  const undo = () => {
    if (!undoable) return
    const m = hist.at(-1)
    setHist(hist.slice(0, -1)); setHelpOn(false)
    if (!isRotation(m)) setMoves(x => Math.max(0, x - 1))
    cube.current.enqueue([inv(m)], 'back')
  }
  // Help: show the next move on the cube. Guided steps always show it, so there it just points again.
  const help = () => {
    if (phase === 'tap') { // bounce a right piece the camera can see
      const i = cube.current.state.findIndex(c => tourStep.tap(c) && c.p.some(v => v === 1))
      if (i >= 0) cube.current.pop(i, false, 3)
      return say('This one! Tap it.', 'thinking', 2400)
    }
    if (!playing) return
    const m = follow ? follow[idxRef.current] : helpNext
    if (!m) return
    cube.current.peek(m)
    if (follow) return say('Turn the way the white arrow points.', 'thinking', 2400)
    if (!helpOn) { setHelpOn(true); setHelps(n => n + 1) }
    say(onPath ? 'Do this turn. Follow the arrow!' : "Let's undo that turn first.", 'thinking', 2400)
  }
  // tour: play the step's moves on the cube, chunk by chunk with a breath between, then hand it back
  const showMe = () => {
    reset(stepStart()); idxRef.current = 0; setIdx(0); setPhase('demo'); setFlash(null)
    const c = cube.current
    c.wait(400, 'demo')
    chunks(tourStep.alg).forEach((ch, i, all) => {
      ch.forEach((m, j) => { c.enqueue([m], 'demo', 0.55); if (j < ch.length - 1) c.wait(220, 'demo') })
      c.wait(i < all.length - 1 ? 750 : 900, 'demo')
    })
  }

  const onSwipe = m => { press(m); if (!swiped) { setSwiped(true); store('cubewise-swiped', true) } }
  const onTap = (c, i) => {
    if (phase !== 'tap') return
    if (tourStep.tap(c)) { cube.current.pop(i); sfx.sticker(2); stepDone() }
    else { cube.current.pop(i, true); sfx.wrong(); setShake(x => x + 1); say('Not that one. Try again!', 'oops') }
  }

  const rotations = type === 'boss' || type === 'free' ? 'xyz' : type === 'goal' && parse(level.alg).some(isRotation) ? 'y' : ''
  useEffect(() => {
    const onKey = e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Backspace' && undoable) { e.preventDefault(); return undo() }
      const k = e.key.toLowerCase()
      const m = 'rludfb'.includes(k) ? k.toUpperCase() : rotations.includes(k) ? k : null
      if (!m) return
      e.preventDefault()
      press(m + (e.shiftKey ? "'" : ''))
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  })

  const freeScramble = () => { const m = randomMoves(20); setMoves(0); setHist(h => m.reduce(pushMove, h)); cube.current.enqueue(m, 'scramble', 4); setScrambling(true) }
  const solveBack = () => { cube.current.enqueue(inverse(hist), 'scramble', 2.2); setHist([]); setScrambling(true) }

  // the arrow on the cube: guided steps always, Help on request; never during a demo (the demo draws its own)
  const hintMove = phase === 'demo' ? null : follow ? follow[idx] ?? null : helpOn ? helpNext : null
  const showPad = type !== 'tour' || phase === 'do' || phase === 'done' || phase === 'demo'
  // only the keys this level uses (plus any face the player swiped); everything in the boss and free play
  const used = type === 'goal' ? [...parse(level.alg), ...hist] : loose ? null : follow ?? stepSeq
  const faces = used ? ORDER.filter(f => used.some(m => m[0] === f)) : ORDER
  const turnCube = rotations.includes('y')

  // Pip's bubble: a reaction, else the stuck nudge, else this step's lines one at a time
  const lines = phase === 'demo' ? ['Watch me first. Look at the arrows!'] : stuck ? [STUCK] : tourStep?.say ?? level.say ?? []
  const li = Math.min(line, lines.length - 1)
  const text = won != null ? `${cheer} ${type === 'goal' || type === 'boss' ? STARS[won] : won === 3 ? '3 stickers for you!' : `${won} sticker${won > 1 ? 's' : ''}! Fewer oopses get all 3.`}` : flash?.text ?? lines[li]
  const more = !flash && li < lines.length - 1
  const last = phase === 'talk' && !more
  const mood = won != null ? 'happy' : flash?.mood ?? (stuck || phase === 'demo' ? 'thinking' : 'idle')
  const onNextLine = more ? () => setLine(li + 1) : last && won == null ? advance : null

  // read aloud: every new bubble while on; stops on change, mute and unmount
  useEffect(() => {
    if (!canSpeak) return
    speechSynthesis.cancel()
    if (!read || muted || !text) return
    const u = new SpeechSynthesisUtterance(text.replace(/([RLUDFB])’/g, '$1 back'))
    u.rate = 0.95; u.pitch = 1.1
    speechSynthesis.speak(u)
  }, [text, read, muted])
  useEffect(() => () => { if (canSpeak) speechSynthesis.cancel() }, [])
  const toggleRead = () => { setRead(r => { store('cubewise-read', !r); return !r }); if (muted) setMuted(sfx.toggle()) }

  // preview the layer a key will turn: hover/focus on desktop, press-and-hold on touch
  const keyPeek = m => ({
    onPointerEnter: e => { if (playing && e.pointerType === 'mouse') cube.current.peek(m, true) },
    onPointerDown: e => { if (playing && e.pointerType !== 'mouse') cube.current.peek(m, true) },
    onPointerLeave: () => cube.current.release(),
    onPointerUp: () => cube.current.release(),
    onFocus: e => { if (playing && e.target.matches(':focus-visible')) cube.current.peek(m) },
  })
  const key = m => {
    const c = cols[m[0]]
    return <button key={m} className={`btn key ${m.endsWith("'") ? 'rev' : ''} ${m === hintMove ? 'hint' : ''}`} style={{ '--c': c, '--t': ink(c) }} disabled={!playing}
      onClick={() => press(m)} aria-label={`Turn the ${NAMES[m[0]]} side ${WAYS[LOOK[m]]}`} {...keyPeek(m)}>
      <Glyph look={LOOK[m]} />{letters && <small>{m.replace("'", '’')}</small>}
    </button>
  }
  const turnKey = m => <button className={`btn turn-key ${m === hintMove ? 'hint' : ''}`} disabled={!playing} onClick={() => press(m)}
    aria-label={`Turn the whole cube ${LOOK[m]}`} {...keyPeek(m)}><Glyph look={LOOK[m]} /></button>
  const tip = more ? null : phase === 'tap' ? 'Tap a piece on the cube' : playing && !swiped && showPad ? 'Swipe the cube, or press a button' : null
  const dots = tourStep && <span className="dots" role="img" aria-label={`Step ${step + 1} of ${level.steps.length}`}>
    {level.steps.map((_, i) => <i key={i} className={i <= step ? 'on' : ''} />)}</span>

  return (
    <div className="level">
      <header className="bar">
        <button className="btn alt small" onClick={onMap}><Icon d={MAP} size={16} />Map</button>
        <h1>{level.id && <span className="badge">{level.id}</span>}<span className="t">{level.title}</span></h1>
        {type === 'boss' && <button className={`btn small ${cheat ? 'yellow' : 'alt'}`} onClick={() => setCheat(c => !c)} aria-expanded={cheat}>Tricks</button>}
        {level.letters && type !== 'boss' && <button className={`btn small ${labels ? 'alt' : 'bare'}`} onClick={() => setLabels(l => !l)} aria-pressed={labels} aria-label="Show the secret code letters">ABC</button>}
        <button className={`btn small icon ${muted ? 'bare' : 'alt'}`} onClick={() => setMuted(sfx.toggle())} aria-pressed={!muted} aria-label="Sound"><Speaker on={!muted} /></button>
      </header>

      <div className="stage">
        <Cube3D ref={cube} className="canvas" show={show} celebrate={won != null} labels={labels} onMoveDone={onMoveDone} sound={!muted} reset
          view={tourStep?.view ?? 'front'} onSwipe={playing ? onSwipe : null} onTap={phase === 'tap' ? onTap : null} nudge={hintMove} />
        {tip && <p className="tip" key={tip}>{tip}</p>}
      </div>

      {won == null ? <section className={`panel ${shake % 2 ? 'shake-a' : shake ? 'shake-b' : ''} ${cheat ? 'reading' : ''}`}>
        <Talk mood={mood} hop={hop} text={text} onNext={onNextLine} nextLabel={last && step === level.steps.length - 1 ? 'Finish' : 'Next'}
          read={read && !muted} onRead={toggleRead} dots={onNextLine && dots} />
        {cheat && <ul className="cheat">{TRICKS.map(t => <li key={t.name}><b>{t.name}</b><span>{t.use}</span><Chips str={t.alg} at={-1} cols={cols} letters /></li>)}</ul>}
        {seqStr && showPad && parse(seqStr).length > 1 && <Chips str={seqStr} at={idx} cols={cols} letters={letters} />}
        {type === 'goal' && <p className="goal-line"><span>Can you do it in <b>{par}</b> {par === 1 ? 'turn' : 'turns'}?</span><span>Turns: <b>{moves}</b></span></p>}
        {type === 'boss' && <p className="goal-line timer"><span>{scrambling ? 'Mixing up the cube…' : t0 == null ? 'The clock starts on your first turn' : <>Time <b>{fmt(now - t0)}</b></>}</span><span>Turns: <b>{moves}</b></span></p>}
        {showPad && <div className={`pad ${playing ? '' : 'off'}`} role="group" aria-label="Turn buttons" style={{ '--n': faces.length }}>
          {faces.map(f => <span className="pair" key={f}>{key(f)}{key(f + "'")}</span>)}
        </div>}
        {turnCube && <div className="turn" role="group" aria-label="Turn the whole cube">{turnKey('y')}<span><Icon d={CUBE} size={22} />Turn cube</span>{turnKey("y'")}</div>}
        {(showPad || phase === 'tap') && <div className="tools">
          {type !== 'free' && <button className={`btn yellow tool ${helpOn ? 'on' : ''}`} onClick={help} disabled={!playing && phase !== 'tap'}><Icon d={HELP} />Help</button>}
          {type === 'tour' && stepSeq.length > 1 && <button className="btn alt tool" onClick={showMe} disabled={phase === 'demo' || phase === 'done'}><Icon d={PLAY} />Show me</button>}
          {type === 'free' && <>
            <button className="btn yellow tool" onClick={freeScramble} disabled={scrambling}><Icon d={MIX} />Mix up</button>
            <button className="btn go tool" onClick={solveBack} disabled={scrambling || !hist.length}><Icon d={RESET} />Fix it</button>
          </>}
          {loose && <button className="btn alt tool" onClick={undo} disabled={!undoable}><Icon d={UNDO} />Undo</button>}
          {(type === 'goal' || type === 'boss') && <button className="btn alt tool" onClick={restart}><Icon d={RESET} />{type === 'boss' ? 'New' : 'Restart'}</button>}
        </div>}
        {showPad && <p className="note keys">Keyboard: R L U D F B turn the sides, Shift turns them the other way{rotations ? `, ${rotations.toUpperCase().split('').join(' ')} turn the whole cube` : ''}{loose ? ', Backspace undoes' : ''}.</p>}
      </section>

      // the win takes the lesson sheet's place: one sheet, rising from the same edge
      : <section className="panel win" role="dialog" aria-labelledby="win-h">
        <Confetti />
        <Talk mood="happy" hop={1} text={text} read={read && !muted} onRead={toggleRead} />
        <h2 id="win-h">{type === 'boss' ? 'You solved the cube!' : type === 'tour' ? 'Lesson done!' : 'Level done!'}</h2>
        <Rating n={won} big />
        {type === 'boss' && t0 != null && <p className="note">Solved in {fmt(now - t0)} with {moves} turns.</p>}
        {unlock && <p className="unlock" style={{ '--c': unlock.color }}><i aria-hidden />New world: <b>{unlock.name}</b></p>}
        <div className="nav">
          <button className="btn alt" onClick={type === 'tour' ? () => { setWon(null); setStep(0) } : restart}><Icon d={RESET} />Again</button>
          <button className="btn alt" onClick={onMap}><Icon d={MAP} size={16} />Map</button>
          {hasNext && <button className="btn go" autoFocus onClick={onNext}>{nextLabel}<Icon d={NEXT} /></button>}
        </div>
      </section>}
    </div>
  )
}
