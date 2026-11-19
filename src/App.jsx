import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import Cube3D, { calm } from './Cube3D.jsx'
import Level, { Icon, Pip, randomMoves, Rating } from './Level.jsx'
import { applyAll, goalMet, ink, inverse, seen, solved } from './cube.js'
import { LEVELS, WORLDS } from './levels.js'
import { sfx } from './sound.js'
import './App.css'

const KEY = 'cubewise-progress-v2' // level ids changed in v2: older progress is simply not read
const HOME_BG = '#FFD500', FREE_BG = '#B4B4AE' // free play shows all six colours: bare plastic grey hides none of them
const FREE = { type: 'free', id: '', title: 'Free play', pre: '', letters: true, say: ['Your own cube to play with!', 'Mix it up, then try to fix it.'] }
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {} } catch { return {} } }
const save = p => { try { localStorage.setItem(KEY, JSON.stringify(p)) } catch { /* storage unavailable */ } }
const unlocked = (p, i) => i === 0 || p[LEVELS[i - 1].id] > 0
const nextLevel = p => LEVELS.findIndex((l, i) => unlocked(p, i) && !p[l.id])
const earned = (p, levels) => levels.reduce((a, l) => a + (p[l.id] || 0), 0)

// 3x3 of the worlds: the map in miniature, as an at-a-glance progress mark
const MiniFace = ({ progress }) => (
  <span className="mini" role="img" aria-label={`${WORLDS.filter((w, wi) => unlocked(progress, LEVELS.indexOf(w.levels[0]))).length} of 9 worlds open`}>
    {WORLDS.map((w, wi) => <i key={wi} style={unlocked(progress, LEVELS.indexOf(w.levels[0])) ? { background: w.color } : undefined} />)}
  </span>
)

const SOLVED = { solved: 'all' }
function Home({ progress, onStart, onContinue, onFree }) {
  const cube = useRef(), timer = useRef(), back = useRef()
  const touched = useRef(false), done = useRef([]) // moves landed since solved
  // scramble a few moves, then undo them exactly, on a slow loop
  const cycle = useCallback(() => {
    const m = randomMoves(5, false)
    cube.current.enqueue(m, 'auto', 0.55)
    cube.current.enqueue(inverse(m), 'auto', 0.55)
  }, [])
  useEffect(() => {
    if (!calm) timer.current = setTimeout(cycle, 700)
    return () => { clearTimeout(timer.current); clearTimeout(back.current) }
  }, [cycle])
  const onMoveDone = (move, state) => {
    done.current = goalMet(state, SOLVED) ? [] : [...done.current, move]
    if (!cube.current.busy && !touched.current && !calm) timer.current = setTimeout(cycle, 1600)
  }
  // the hero is a real cube: a swipe turns it at once, and it solves itself back once left alone
  const onSwipe = m => {
    clearTimeout(timer.current); clearTimeout(back.current)
    touched.current = true
    cube.current.cancel()
    cube.current.enqueue([m], 'player')
    back.current = setTimeout(() => { touched.current = false; cube.current.enqueue(inverse(done.current), 'auto', 1.6) }, 2600)
  }
  const started = Object.keys(progress).length > 0
  const nx = nextLevel(progress), next = LEVELS[nx]
  return (
    <div className="home">
      <header className="home-top">
        <p className="wordmark">Cubewise</p>
        {started && <p className="home-score"><MiniFace progress={progress} /><span><b>{earned(progress, LEVELS)}</b>/{LEVELS.length * 3}</span></p>}
      </header>
      <Cube3D ref={cube} className="hero-cube" onMoveDone={onMoveDone} onSwipe={onSwipe} />
      <div className="home-copy">
        <h1><span>Solve the cube.</span> <span>One step at a time.</span></h1>
        <p className="sub"><Pip size={44} />Hi, I'm Pip! I'll show you every turn.</p>
      </div>
      <div className="slab home-actions">
        <button className="btn go big wide play" onClick={onContinue}><Icon d="M7 4.5v15l12.5-7.5z" size={26} /><span>Play{started && next && <small>{next.id} {next.title}</small>}</span></button>
        <button className="btn alt big" onClick={onStart}>Map</button>
        <button className="btn yellow big" onClick={onFree}>Free play</button>
      </div>
    </div>
  )
}

// flat pictures of the cube from front-right-top: each face is a 3x3 of rounded stickers, sheared into place
const K = Math.sqrt(3) / 2, GREY = '#2e2e2e'
const SHEAR = { U: [K, 0.5, -K, 0.5, 0, -3], F: [K, 0.5, 0, 1, -3 * K, -1.5], R: [K, -0.5, 0, 1, 0, 0] }
function MiniCube({ faces, label, className = '' }) {
  return (
    <svg className={`minicube ${className}`} viewBox="-2.85 -3.25 5.7 6.5" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <path d={`M0-3 ${K * 3}-1.5V1.5L0 3-${K * 3} 1.5V-1.5z`} fill="#000" stroke="#000" strokeWidth=".4" strokeLinejoin="round" />
      {Object.entries(SHEAR).map(([f, m]) => <g key={f} transform={`matrix(${m})`}>
        {(faces?.[f] ?? Array(9).fill(null)).map((c, k) => <rect key={k} x={k % 3 + 0.08} y={Math.floor(k / 3) + 0.08} width=".84" height=".84" rx=".17" fill={c ?? GREY} />)}
      </g>)}
    </svg>
  )
}
// what each world achieves, on the cube the way the player holds it; the hero shows the last one finished
const PICS = WORLDS.map(w => seen(applyAll(solved(), w.pre || ''), w.goal))
const HERO = [null, seen(solved(), { solved: 'centers' }), ...PICS.slice(1)]
const ABOUT = ['Turn the sides and meet the pieces.', 'Make a white cross on top.', 'Finish the whole white side.', 'Fill in the middle row.',
  'Make a yellow cross on top.', 'Match the yellow edges to their sides.', 'Move every yellow corner home.', 'Twist the corners and solve it!', 'Solve a real mixed-up cube.']
const SO_FAR = ['Every world you finish adds colour here!', 'You know every piece now!', 'You can make the white cross now!', 'You can finish the white side now!',
  'Two rows done. Only the top is left!', 'You can make the yellow cross now!', 'Your yellow edges match now!', 'Every corner can find its home!',
  'You know every step. Try a real one!', 'You solved the whole cube. Wow!']
const LOCK = 'M7 10V7a5 5 0 0110 0v3h.5A1.5 1.5 0 0119 11.5v8a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 015 19.5v-8A1.5 1.5 0 016.5 10zm2.5 0h5V7a2.5 2.5 0 00-5 0z'
const CHECK = 'M9.5 15.6L5.2 11.3 3 13.5l6.5 6.5L21 8.5l-2.2-2.2z', PLAY = 'M7 4.5v15l12.5-7.5z'
const KIND = {
  tour: ['Lesson', 'M4 3h16a2 2 0 012 2v10a2 2 0 01-2 2h-8l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2z'],
  follow: ['Follow along', 'M2.5 9H12V3.5l9.5 8.5-9.5 8.5V15H2.5z'],
  goal: ['Puzzle', 'M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z'],
  boss: ['Final boss', 'M2 6l5 4.5L12 3l5 7.5L22 6l-2 11H4zm2 13h16v2H4z'],
}
// the trail: rows of fixed height, stones swaying left and right, so the path is known without measuring
const SWAY = [0, 40, 80, 40], LANE = 76, ROW = 90, NEXT_ROW = 120
const WIDE = typeof matchMedia !== 'undefined' ? matchMedia('(min-width: 900px) and (min-height: 560px)') : null // the desktop layout in App.css
const useWide = () => useSyncExternalStore(f => { WIDE?.addEventListener('change', f); return () => WIDE?.removeEventListener('change', f) }, () => !!WIDE?.matches)

function Trail({ w, progress, nx, won, onPlay }) {
  const sway = useWide() ? 3 : 1 // a wide column gets a wider walk
  const rows = w.levels.reduce((a, l, li) => {
    const i = LEVELS.indexOf(l), h = i === nx ? NEXT_ROW : ROW, top = a.length ? a.at(-1).cy + a.at(-1).h / 2 : 0
    return [...a, { l, i, h, x: SWAY[li % 4] * sway, cy: top + h / 2 }]
  }, [])
  const y = rows.at(-1).cy + rows.at(-1).h / 2
  const path = rs => rs.map((r, k) => k ? `C${rs[k - 1].x + LANE / 2} ${(rs[k - 1].cy + r.cy) / 2} ${r.x + LANE / 2} ${(rs[k - 1].cy + r.cy) / 2} ${r.x + LANE / 2} ${r.cy}` : `M${r.x + LANE / 2} ${r.cy}`).join('')
  const reached = rows.findIndex(r => !progress[r.l.id]) // the travelled part runs to the first stone not yet done
  return (
    <ol className="trail" style={{ height: y }}>
      <svg className="trail-path" width={SWAY[2] * sway + LANE} height={y} aria-hidden>
        <path d={path(rows)} />
        <path d={path(rows.slice(0, reached < 0 ? rows.length : reached + 1))} style={{ stroke: w.color }} />
      </svg>
      {rows.map(({ l, i, h, x }) => {
        const ok = unlocked(progress, i), s = progress[l.id] || 0, next = i === nx, [kind, icon] = KIND[l.type]
        return (
          <li key={l.id} style={{ height: h }}>
            <button className={`stop ${next ? 'next' : s ? 'done' : ''} ${i === won ? 'won' : ''}`} disabled={!ok} onClick={() => onPlay(i)} style={{ marginLeft: x, '--c': ok ? w.color : undefined, '--t': ok ? ink(w.color) : undefined }}
              aria-label={`Level ${l.id}: ${l.title}, ${kind}${next ? ', up next' : ok ? `, ${s} of 3 stickers` : ', locked'}`}>
              <span className="lane"><span className="stone">{l.id.split('-')[1]}</span></span>
              <span className="stop-text">
                <b>{l.title}</b>
                <span className="kind"><Icon d={icon} size={15} />{kind}{s > 0 && <Rating n={s} />}</span>
                {next && <span className="play"><Icon d={PLAY} size={18} />Play</span>}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

function WorldMap({ progress, sel, setSel, fresh, won, onPlay, onHome, onFree }) {
  const w = WORLDS[sel], nx = nextLevel(progress), cur = nx < 0 ? -1 : LEVELS[nx].world
  const isOpen = wd => unlocked(progress, LEVELS.indexOf(wd.levels[0]))
  const isDone = wd => wd.levels.every(l => progress[l.id] > 0)
  const solvedTo = WORLDS.filter(isDone).length // worlds open in order, so finished ones are the first few
  const [tip, setTip] = useState(null) // Pip's answer to a tap on a locked world
  const trail = useRef(), first = useRef(true)
  // a world that just opened: its sticker peels on with a chord, on the same beat as the CSS
  useEffect(() => {
    if (fresh == null) return
    const id = setTimeout(() => [0, 1, 2].forEach(i => setTimeout(() => sfx.sticker(i), i * 90)), 380)
    return () => clearTimeout(id)
  }, [fresh])
  // a level just finished for the first time: its stone gets its sticker
  useEffect(() => {
    if (won == null || LEVELS[won].world !== sel) return
    const id = setTimeout(() => sfx.sticker(2), 1050)
    return () => clearTimeout(id)
  }, [won]) // eslint-disable-line react-hooks/exhaustive-deps
  // bring the up-next stone into view (on opening, after the screen settles; on picking a world, its trail)
  useEffect(() => {
    const el = trail.current?.querySelector('.stop.next') ?? (first.current ? null : trail.current?.querySelector('.stop'))
    const id = setTimeout(() => el?.scrollIntoView({ block: 'nearest', behavior: calm ? 'auto' : 'smooth' }), first.current ? (fresh != null ? 1100 : 260) : 60)
    first.current = false
    return () => clearTimeout(id)
  }, [sel]) // eslint-disable-line react-hooks/exhaustive-deps
  const pick = wi => {
    if (isOpen(WORLDS[wi])) { setTip(null); setSel(wi); return }
    const name = WORLDS[cur].name
    setTip(t => ({ text: wi === cur + 1 ? `Finish ${name} to open it!` : `Not yet! Finish ${name} first.`, n: (t?.n ?? 0) + 1 }))
  }
  const got = earned(progress, LEVELS)
  return (
    <div className="map">
      <header className="bar">
        <button className="btn alt small" onClick={onHome}>Home</button>
        <h1>Pick a world</h1>
        <button className="btn yellow small" onClick={onFree}>Free play</button>
      </header>
      <div className="map-body">
        <div className="map-side">
          <section className="hero" aria-label="Your cube">
            {/* a world just finished: the colour it adds fades onto the picture from before */}
            <span className="hero-pic">
              {fresh != null && <MiniCube faces={HERO[solvedTo - 1]} />}
              <MiniCube faces={HERO[solvedTo]} className={fresh != null ? 'grew' : ''} label={solvedTo ? `Your cube so far: ${WORLDS[solvedTo - 1].name} done` : 'Your cube: all grey so far'} />
            </span>
            <div className="talk">
              <Pip size={48} mood={tip ? 'thinking' : solvedTo === WORLDS.length ? 'happy' : 'idle'} hop={tip?.n ?? 0} />
              <div className="bubble"><p aria-live="polite">{tip?.text ?? SO_FAR[solvedTo]}</p></div>
            </div>
            <p className="hero-score"><i aria-hidden /><span><b>{got}</b> of {LEVELS.length * 3} stickers</span></p>
          </section>
          <div className="face" role="group" aria-label="Worlds">
            {WORLDS.map((wd, wi) => {
              const open = isOpen(wd), done = isDone(wd), n = wd.levels.filter(l => progress[l.id] > 0).length
              return (
                <button key={wi} className={`world ${open ? '' : 'locked'} ${done ? 'done' : ''} ${wi === sel ? 'sel' : ''} ${wi === fresh ? 'fresh' : ''}`}
                  aria-disabled={!open || undefined} onClick={() => pick(wi)} style={open ? { '--c': wd.color, '--t': ink(wd.color) } : undefined} aria-pressed={wi === sel}
                  aria-label={open ? `World ${wi + 1}: ${wd.name}, ${done ? 'finished' : `${n} of ${wd.levels.length} level${wd.levels.length > 1 ? 's' : ''} done`}, ${earned(progress, wd.levels)} of ${wd.levels.length * 3} stickers` : `World ${wi + 1}, locked: ${wd.name}`}>
                  <span className="world-top">
                    <span className="world-n">{wi + 1}</span>
                    {!open ? <Icon d={LOCK} size={18} /> : done ? <span className="world-done"><Icon d={CHECK} size={16} /></span> : wi === cur ? <Pip size={30} /> : null}
                  </span>
                  <MiniCube faces={PICS[wi]} />
                  <span className="world-name">{wd.name}</span>
                  <span className="world-bar">{wd.levels.map(l => <i key={l.id} className={progress[l.id] > 0 ? 'on' : ''} />)}</span>
                </button>
              )
            })}
          </div>
        </div>
        <section key={sel} ref={trail} className="slab levels" aria-label={`Levels in ${w.name}`}>
          <h2><span>{sel + 1}</span>{w.name}</h2>
          <p className="about">{ABOUT[sel]}</p>
          <p className="note">{isDone(w) ? 'World finished!' : `${w.levels.filter(l => progress[l.id] > 0).length} of ${w.levels.length} level${w.levels.length > 1 ? 's' : ''} done`}</p>
          <Trail w={w} progress={progress} nx={nx} won={won} onPlay={onPlay} />
        </section>
      </div>
    </div>
  )
}

export default function App() {
  const [progress, setProgress] = useState(load)
  const [screen, setScreen] = useState('home')
  const [cur, setCur] = useState(0)
  const [sel, setSel] = useState(() => LEVELS[Math.max(0, nextLevel(load()))].world)
  const [fresh, setFresh] = useState(null) // world unlocked by the last win, celebrated once on the map
  const [won, setWon] = useState(null) // level finished for the first time by the last win, marked once on the map

  const nxt = LEVELS[cur + 1], crossing = nxt && nxt.world !== LEVELS[cur].world
  const onWin = useCallback(stars => {
    const id = LEVELS[cur].id
    if (!(progress[id] > 0)) setWon(cur)
    if (crossing && !(progress[id] > 0)) { setFresh(nxt.world); setSel(nxt.world) }
    const next = { ...progress, [id]: Math.max(progress[id] || 0, stars) }
    save(next); setProgress(next)
  }, [cur, crossing, nxt, progress])
  const go = s => { setFresh(null); setWon(null); setScreen(s) }
  const play = i => { setCur(i); setSel(LEVELS[i].world); go('level') }
  // one tap sound for every sticker button; move keys get the turn sound instead
  useEffect(() => {
    const tap = e => { if (e.target.closest?.('button:not(:disabled):not(.move)')) sfx.tap() }
    addEventListener('pointerdown', tap)
    return () => removeEventListener('pointerdown', tap)
  }, [])
  const bg = screen === 'home' ? HOME_BG : screen === 'free' ? FREE_BG : WORLDS[screen === 'map' ? sel : LEVELS[cur].world].color
  // phone browser chrome takes the backdrop colour too
  useEffect(() => {
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', bg)
    document.body.style.background = bg // so overscroll and any gap below the app match the backdrop
  }, [bg])

  return (
    <div className="app" style={{ '--bg': bg, '--on': ink(bg) }}>
      <main key={screen === 'level' ? `level-${cur}` : screen} className="screen">
        {screen === 'home' && <Home progress={progress} onStart={() => go('map')} onFree={() => go('free')}
          onContinue={() => { const i = nextLevel(progress); if (i < 0) go('map'); else play(i) }} />}
        {screen === 'map' && <WorldMap progress={progress} sel={sel} setSel={setSel} fresh={fresh} won={won} onPlay={play} onHome={() => go('home')} onFree={() => go('free')} />}
        {screen === 'free' && <Level level={FREE} onWin={() => {}} onMap={() => go('map')} />}
        {/* a new world opens on the map, so its sticker can arrive; inside a world, straight on */}
        {screen === 'level' && <Level level={LEVELS[cur]} hasNext={!!nxt} unlock={fresh != null ? WORLDS[fresh] : null}
          nextLabel={crossing ? 'Next world' : 'Next'}
          onWin={onWin} onMap={() => setScreen('map')} onNext={() => crossing ? (setSel(nxt.world), setScreen('map')) : play(cur + 1)} />}
      </main>
    </div>
  )
}
