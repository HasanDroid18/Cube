import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Cube3D, { TURN_MS } from './Cube3D.jsx'
import { applyAll, COLORS, display, goalMet, ink, inverse, isRotation, parse, solved, stickerColor } from './cube.js'
import { ALGS } from './levels.js'
import { sfx } from './sound.js'

const FACES = [['R', 'right', [1, 0, 0]], ['L', 'left', [-1, 0, 0]], ['U', 'up', [0, 1, 0]], ['D', 'down', [0, -1, 0]], ['F', 'front', [0, 0, 1]], ['B', 'back', [0, 0, -1]]]
const ALL = { solved: 'all' }
// colour of the center currently sitting on each face, so pad keys match what the player sees
const faceColors = state => Object.fromEntries(FACES.map(([f, , p]) => {
  const c = state.find(c => c.p.every((v, i) => v === p[i]))
  const a = c.h.findIndex(Boolean)
  return [f, stickerColor(a, c.h[a])]
}))
const faceTurns = moves => moves.filter(m => !isRotation(m)).length
const setup = (pre, alg = '') => applyAll(applyAll(solved(), pre), inverse(parse(alg)))
const fmt = ms => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${Math.floor(ms / 100) % 10}`
const SWIPED = 'cubewise-swiped'
const swipedBefore = () => { try { return localStorage.getItem(SWIPED) === '1' } catch { return false } }

export function randomMoves(n, half = true) {
  const out = []
  while (out.length < n) {
    const f = 'RLUDFB'[Math.floor(Math.random() * 6)]
    if (out.length && out.at(-1)[0] === f) continue
    out.push(f + ['', "'", '2'][Math.floor(Math.random() * (half ? 3 : 2))])
  }
  return parse(out.join(' '))
}

export const Chips = ({ moves, at = -1 }) => (
  <div className="chips">
    {moves.map((m, i) => <span key={i} className={`chip ${i < at ? 'done' : i === at ? 'now' : ''}`}>{m.replace("'", '’')}</span>)}
  </div>
)

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

const Icon = ({ d }) => <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden><path d={d} fill="currentColor" /></svg>
const PREV = 'M2 2h2.4v12H2zM14 2v12L5.5 8z', NEXT = 'M11.6 2H14v12h-2.4zM2 2v12l8.5-6z'
const SPEAKER = 'M1 5.5h3L8 2v12L4 10.5H1z'

// Step through an algorithm one token at a time on the cube; back applies the inverse.
function Stepper({ alg, cube, rewind }) {
  const toks = useMemo(() => alg.split(' '), [alg])
  const [at, setAt] = useState(0)
  const [play, setPlay] = useState(false)
  const [slow, setSlow] = useState(false)
  const atRef = useRef(0)
  const speed = slow ? 0.3 : 0.85
  const go = useCallback(d => {
    const a = atRef.current, n = a + d
    if (n < 0 || n > toks.length) return
    cube.current.enqueue(d > 0 ? parse(toks[a]) : inverse(parse(toks[n])), 'demo', speed)
    atRef.current = n; setAt(n)
  }, [toks, cube, speed])
  useEffect(() => {
    if (!play) return
    if (at >= toks.length) { setPlay(false); return }
    const id = setTimeout(() => go(1), at ? (parse(toks[at - 1]).length * TURN_MS) / speed + 180 : 120)
    return () => clearTimeout(id)
  }, [play, at, go, toks, speed])
  const toggle = () => {
    if (play) return setPlay(false)
    if (atRef.current >= toks.length) { rewind(); atRef.current = 0; setAt(0) }
    setPlay(true)
  }
  const step = d => { setPlay(false); go(d) }
  return <div className="stepper">
    <Chips moves={toks} at={at - 1} />
    <div className="step-ctl">
      <button className="btn alt small" onClick={() => step(-1)} disabled={at === 0} aria-label="Step back one move"><Icon d={PREV} /></button>
      <button className="btn yellow small play" onClick={toggle}>{play ? 'Pause' : at >= toks.length ? 'Replay' : at ? 'Play' : 'Play moves'}</button>
      <button className="btn alt small" onClick={() => step(1)} disabled={at >= toks.length} aria-label="Step forward one move"><Icon d={NEXT} /></button>
      <button className={`btn small ${slow ? 'yellow' : 'bare'}`} onClick={() => setSlow(s => !s)} aria-pressed={slow}>Slow</button>
    </div>
  </div>
}

export default function Level({ level, hasNext, nextLabel = 'Next level', unlock, onWin, onNext, onMap }) {
  const cube = useRef()
  const { type, goal, pre } = level
  const [step, setStep] = useState(0)
  const [phase, setPhase] = useState(null) // tour step: 'tap' | 'watch' | 'do' | 'done'
  const [idx, setIdx] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [moves, setMoves] = useState(0)
  const [hist, setHist] = useState([]) // player moves since the start (free play: since solved)
  const [hint, setHint] = useState(false)
  const [demo, setDemo] = useState(false) // goal level: watching the hint on the start position
  const [kept, setKept] = useState(null) // the player's own cube while the hint plays, restored after
  const [won, setWon] = useState(null)
  const [shake, setShake] = useState(0)
  const [labels, setLabels] = useState(true)
  const [muted, setMuted] = useState(sfx.muted)
  const [swiped, setSwiped] = useState(swipedBefore)
  const [scrambling, setScrambling] = useState(type === 'boss')
  const [t0, setT0] = useState(null)
  const [now, setNow] = useState(0)
  const [cheat, setCheat] = useState(false)
  const [more, setMore] = useState(false)
  const idxRef = useRef(0)
  const timer = useRef()
  const textRef = useRef()
  const [cols, setCols] = useState(() => faceColors(solved()))
  const reset = useCallback(s => { cube.current.reset(s); setCols(faceColors(s)) }, [])

  const seq = useMemo(() => parse(level.seq || ''), [level])
  const tourStep = type === 'tour' ? level.steps[step] : null
  const stepSeq = useMemo(() => parse(tourStep?.alg || ''), [tourStep])
  const follow = type === 'follow' ? seq : phase === 'do' ? stepSeq : null
  const viewGoal = tourStep ? tourStep.goal ?? goal : type === 'free' ? null : goal
  const show = useCallback(c => display(c, viewGoal), [viewGoal])
  const stepSetup = useCallback(() => reset(setup(tourStep.pre ?? pre, tourStep.setup ?? tourStep.alg)), [tourStep, pre, reset])
  const playing = won == null && !scrambling && !demo && (type !== 'tour' || phase === 'do')
  const undoable = (type === 'goal' || type === 'boss' || type === 'free') && hist.length > 0 && playing

  const restart = useCallback(() => {
    setIdx(0); idxRef.current = 0; setMistakes(0); setMoves(0); setHist([]); setWon(null); setT0(null); setDemo(false); setKept(null)
    if (type === 'boss') { reset(solved()); setScrambling(true); cube.current.enqueue(randomMoves(20), 'scramble', 5) }
    else reset(setup(pre, type === 'goal' ? level.alg : ''))
  }, [level, pre, type, reset])
  useEffect(() => { if (type !== 'tour') restart() }, [restart, type])

  // tour: every step starts from solved + pre + inverse(setup or alg)
  useEffect(() => {
    if (!tourStep) return
    stepSetup(); setIdx(0); idxRef.current = 0
    setPhase(tourStep.tap ? 'tap' : tourStep.alg ? 'watch' : null)
    return () => clearTimeout(timer.current)
  }, [tourStep, stepSetup])

  useEffect(() => {
    if (t0 == null || won) return
    const id = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(id)
  }, [t0, won])

  // long text in a short sheet: fade the bottom edge while there is more to scroll
  const sheetOpen = won == null // the lesson sheet is a new element after a win + Replay
  useLayoutEffect(() => {
    const el = textRef.current
    if (!el) return
    const check = () => setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 4)
    check()
    const ro = new ResizeObserver(check); ro.observe(el); if (el.firstChild) ro.observe(el.firstChild)
    el.addEventListener('scroll', check, { passive: true })
    return () => { ro.disconnect(); el.removeEventListener('scroll', check) }
  }, [step, phase, type, hint, demo, cheat, sheetOpen])

  const win = useCallback(stars => {
    setWon(stars); onWin(stars); sfx.win()
    for (let i = 0; i < stars; i++) setTimeout(() => sfx.sticker(i), 600 + i * 220) // matches .rating.big delays
  }, [onWin])
  const advance = () => { if (step < level.steps.length - 1) setStep(step + 1); else win(3) }
  const stepDone = () => { setPhase('done'); timer.current = setTimeout(advance, 750) }

  const onMoveDone = (move, state, tag) => {
    if (tag === 'scramble' && !cube.current.busy) setScrambling(false)
    if (isRotation(move)) setCols(faceColors(state))
    if (won != null || cube.current.busy || (tag !== 'player' && tag !== 'back')) return
    if (follow && idxRef.current === follow.length) {
      if (type === 'follow') win(Math.max(1, 3 - mistakes))
      else { sfx.sticker(2); stepDone() }
    }
    if (type === 'goal' && goalMet(state, goal)) {
      const par = faceTurns(parse(level.alg))
      win(Math.min(hint ? 2 : 3, moves <= par ? 3 : moves <= 2 * par ? 2 : 1))
    }
    if (type === 'boss' && goalMet(state, goal)) { setNow(Date.now()); win(3) }
    if (type === 'free' && hist.length && goalMet(state, ALL)) { setHist([]); sfx.win() }
  }

  const press = useCallback(m => {
    if (!playing) return
    if (follow) {
      if (idxRef.current >= follow.length || isRotation(m)) return
      if (m === follow[idxRef.current]) { idxRef.current++; setIdx(idxRef.current); cube.current.enqueue([m], 'player') }
      else {
        if (type === 'follow') setMistakes(x => x + 1)
        setShake(x => x + 1); sfx.wrong()
        cube.current.enqueue([m], 'wrong', 1.5); cube.current.enqueue(inverse([m]), 'undo', 3)
      }
      return
    }
    if (type === 'boss' && t0 == null) { setT0(Date.now()); setNow(Date.now()) }
    if (!isRotation(m)) setMoves(x => x + 1)
    setHist(h => [...h, m])
    cube.current.enqueue([m], 'player')
  }, [playing, follow, type, t0])

  const undo = () => {
    if (!undoable) return
    const m = hist.at(-1)
    setHist(hist.slice(0, -1))
    if (!isRotation(m)) setMoves(x => x - 1)
    cube.current.enqueue(inverse([m]), 'back')
  }

  const onSwipe = m => {
    press(m)
    if (!swiped) { setSwiped(true); try { localStorage.setItem(SWIPED, '1') } catch { /* storage unavailable */ } }
  }
  const onTap = (c, i) => {
    if (phase !== 'tap') return
    if (tourStep.tap(c)) { cube.current.pop(i); sfx.sticker(2); stepDone() }
    else { cube.current.pop(i, true); sfx.wrong(); setShake(x => x + 1) }
  }

  const rotations = type === 'goal' ? ['y', "y'"] : type === 'boss' || type === 'free' ? ['x', "x'", 'y', "y'", 'z', "z'"] : []
  const padRots = rotations.length === 6
  useEffect(() => {
    const onKey = e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Backspace' && undoable) { e.preventDefault(); return undo() }
      const k = e.key.toLowerCase()
      const m = 'rludfb'.includes(k) ? k.toUpperCase() : rotations.some(r => r[0] === k) ? k : null
      if (!m) return
      e.preventDefault()
      press(m + (e.shiftKey ? "'" : ''))
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  })

  const showHint = () => {
    setKept(hist.length ? { state: cube.current.settled, hist, moves } : null)
    setHint(true); setDemo(true); setMoves(0); setHist([]); reset(setup(pre, level.alg))
  }
  const resume = () => { setDemo(false); reset(kept.state); setHist(kept.hist); setMoves(kept.moves); setKept(null) }
  const freeScramble = () => { const m = randomMoves(20); setMoves(0); setHist(h => [...h, ...m]); cube.current.enqueue(m, 'scramble', 4); setScrambling(true) }
  const solveBack = () => { cube.current.enqueue(inverse(hist), 'scramble', 2.2); setHist([]); setScrambling(true) }
  const par = type === 'goal' ? faceTurns(parse(level.alg)) : 0
  const showPad = type !== 'tour' || (!!tourStep.alg && phase !== 'watch')
  // preview the layer a key will turn: hover/focus on desktop, press-and-hold on touch
  const keyPeek = m => ({
    onPointerEnter: e => { if (playing && e.pointerType === 'mouse') cube.current.peek(m, true) },
    onPointerDown: e => { if (playing && e.pointerType !== 'mouse') cube.current.peek(m, true) },
    onPointerLeave: () => cube.current.release(),
    onPointerUp: () => cube.current.release(),
    onFocus: e => { if (playing && e.target.matches(':focus-visible')) cube.current.peek(m) },
  })
  const moveKey = (m, label, extra, sub) => (
    <button key={m} className={`btn move ${extra}`} style={{ '--c': cols[m[0]] ?? 'var(--bare)', '--t': ink(cols[m[0]]) }} disabled={!playing}
      onClick={() => press(m)} aria-label={label} {...keyPeek(m)}>{m.replace("'", '’')}{sub && <small>{sub}</small>}</button>
  )
  const tip = phase === 'tap' ? 'Tap a piece on the cube' : playing && !swiped ? 'Swipe a layer to turn it. Drag the background to look around.' : null

  return (
    <div className="level">
      <header className="bar">
        <button className="btn alt small" onClick={onMap} aria-label="Back to map">Map</button>
        <h1>{level.id && <span className="badge">{level.id}</span>}<span className="t">{level.title}</span></h1>
        <button className={`btn small ${labels ? 'alt' : 'bare'}`} onClick={() => setLabels(l => !l)} aria-pressed={labels} aria-label="Show face letters">Letters</button>
        <button className={`btn small icon ${muted ? 'bare' : 'alt'}`} onClick={() => setMuted(sfx.toggle())} aria-pressed={!muted} aria-label="Sound">
          <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden><path d={SPEAKER} fill="currentColor" />
            <path d={muted ? 'M10.5 5.5l4 5m0-5l-4 5' : 'M10.5 5a4 4 0 010 6M12.5 3a7 7 0 010 10'} stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" /></svg>
        </button>
      </header>

      <div className="stage">
        <Cube3D ref={cube} className="canvas" show={show} celebrate={won != null} labels={labels} onMoveDone={onMoveDone} sound={!muted}
          onSwipe={playing ? onSwipe : null} onTap={phase === 'tap' ? onTap : null} nudge={playing && follow ? follow[idx] ?? null : null} />
        {tip && <p className="tip" key={tip}>{tip}</p>}
      </div>

      {won == null ? <section className={`panel ${shake % 2 ? 'shake-a' : shake ? 'shake-b' : ''} ${cheat ? 'reading' : ''}`}>
        <div className={`panel-text ${more ? 'more' : ''}`} ref={textRef} aria-live="polite">
          <div className="panel-inner">
            <p className="lesson">{phase === 'do' ? 'Your turn: swipe the cube or use the keys.' : phase === 'done' ? 'Nice!' : tourStep ? tourStep.text
              : demo ? `Hint: watch it from the start${kept ? '. Your own cube waits for you.' : ', then try it yourself.'}` : level.text}</p>
            {phase === 'watch' && <Stepper key={step} alg={tourStep.alg} cube={cube} rewind={stepSetup} />}
            {tourStep?.alg && (phase === 'do' || phase === 'done') && <Chips moves={stepSeq} at={idx} />}
            {tourStep && <div className="dots" role="img" aria-label={`Step ${step + 1} of ${level.steps.length}`}>
              {level.steps.map((_, i) => <i key={i} className={i <= step ? 'on' : ''} />)}
            </div>}
            {type === 'follow' && <><Chips moves={seq} at={idx} /><p className="stat"><span><b>{mistakes}</b> {mistakes === 1 ? 'mistake' : 'mistakes'}</span></p></>}
            {(type === 'goal' || type === 'free') && !demo &&
              <p className="stat"><span><b>{moves}</b> {moves === 1 ? 'move' : 'moves'}</span>{type === 'goal' && <span>Target <b>{par}</b></span>}</p>}
            {type === 'goal' && hint && (demo
              ? <><p className="note">Hint used: this level now gives at most 2 stickers.</p><Stepper alg={level.alg} cube={cube} rewind={() => reset(setup(pre, level.alg))} /></>
              : <><p className="note">Hint used: this level now gives at most 2 stickers.</p><Chips moves={level.alg.split(' ')} /></>)}
            {type === 'boss' && <>
              <p className="stat timer">
                <span>{scrambling ? 'Scrambling the cube' : t0 == null ? 'The timer starts on your first move' : <>Time <b>{fmt(now - t0)}</b></>}</span>
                <span><b>{moves}</b> {moves === 1 ? 'move' : 'moves'}</span>
              </p>
              {cheat && <ul className="cheat">{ALGS.map(a => <li key={a.name}><b>{a.name}</b><code>{a.alg}</code><span>{a.use}</span></li>)}</ul>}
            </>}
          </div>
        </div>

        {type !== 'tour' && type !== 'follow' && <div className="tools">
          {type === 'goal' && (demo
            ? <button className="btn go small" onClick={kept ? resume : restart}>{kept ? 'Resume' : 'Try it'}</button>
            : <button className="btn alt small" onClick={showHint}>{hint ? 'Watch hint' : 'Hint'}</button>)}
          {type === 'goal' && <button className="btn alt small" onClick={restart}>Restart</button>}
          {type === 'boss' && <>
            <button className="btn alt small" onClick={() => setCheat(c => !c)} aria-expanded={cheat}>{cheat ? 'Hide cheats' : 'Cheat sheet'}</button>
            <button className="btn alt small" onClick={restart}>New scramble</button>
          </>}
          {type === 'free' && <>
            <button className="btn yellow small" onClick={freeScramble} disabled={scrambling}>Scramble</button>
            <button className="btn go small" onClick={solveBack} disabled={scrambling || !hist.length}>Solve it back</button>
          </>}
          <button className="btn alt small" onClick={undo} disabled={!undoable} aria-label="Undo last move">Undo</button>
          {!padRots && rotations.length > 0 && <span className="rots" role="group" aria-label="Turn the whole cube">
            {rotations.map(r => <button key={r} className="btn alt small rot" disabled={!playing} onClick={() => press(r)} aria-label={`Turn the whole cube: ${r}`}>{r.replace("'", '’')}</button>)}
          </span>}
        </div>}

        {showPad && <div className={`pad ${playing ? '' : 'off'}`} role="group" aria-label="Move pad">
          {FACES.map(([f, name]) => moveKey(f, `${f}: turn the ${name} face clockwise`, '', name))}
          {FACES.map(([f, name]) => moveKey(f + "'", `${f} prime: turn the ${name} face counter-clockwise`, 'prime'))}
          {padRots && rotations.map(r => moveKey(r, `Turn the whole cube: ${r}`, 'whole'))}
        </div>}

        {tourStep && <div className="nav">
          <button className="btn alt" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button>
          {phase === 'watch' && <button className="btn go" onClick={() => { stepSetup(); setPhase('do') }}>Your turn</button>}
          {phase === 'do' && <button className="btn alt" onClick={() => { stepSetup(); setIdx(0); idxRef.current = 0; setPhase('watch') }}>Watch again</button>}
          {phase == null && (step < level.steps.length - 1
            ? <button className="btn go" onClick={() => setStep(step + 1)}>Next step</button>
            : <button className="btn go" onClick={() => win(3)}>Finish lesson</button>)}
        </div>}
        {showPad && <p className="note keys">Keyboard: R L U D F B turn faces, hold Shift for prime{rotations.length ? `, ${padRots ? 'X Y Z turn' : 'Y turns'} the whole cube` : ''}{type === 'goal' || type === 'boss' || type === 'free' ? ', Backspace undoes' : ''}.</p>}
      </section>

      // the win takes the lesson sheet's place: one sheet, rising from the same edge
      : <section className="panel win" role="dialog" aria-labelledby="win-h">
        <Confetti />
        <div className="win-head">
          <h2 id="win-h">{type === 'boss' ? 'You solved the cube' : type === 'tour' ? 'Lesson done' : won === 3 ? 'Perfect!' : 'Level complete'}</h2>
          <p className="note">
            {type === 'goal' && `${moves} ${moves === 1 ? 'move' : 'moves'}, target ${par}${hint ? ', hint used' : ''}.`}
            {type === 'follow' && (mistakes ? `${mistakes} ${mistakes === 1 ? 'mistake' : 'mistakes'}.` : 'No mistakes.')}
            {type === 'boss' && t0 != null && `Solved in ${fmt(now - t0)} with ${moves} moves.`}
            {type === 'tour' && `${level.id} ${level.title}: all three stickers.`}
          </p>
        </div>
        <Rating n={won} big />
        {unlock && <p className="unlock" style={{ '--c': unlock.color }}><i aria-hidden />New world: <b>{unlock.name}</b></p>}
        <div className="nav">
          {type !== 'tour' && <button className="btn alt" onClick={restart}>Replay</button>}
          <button className="btn alt" onClick={onMap} aria-label="Back to map">Map</button>
          {hasNext && <button className="btn go" autoFocus onClick={onNext}>{nextLabel}</button>}
        </div>
      </section>}
    </div>
  )
}
