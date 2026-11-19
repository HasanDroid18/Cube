import { useCallback, useEffect, useRef, useState } from 'react'
import Cube3D, { calm } from './Cube3D.jsx'
import Level, { Icon, Pip, randomMoves, Rating } from './Level.jsx'
import { goalMet, ink, inverse } from './cube.js'
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

function WorldMap({ progress, sel, setSel, fresh, onPlay, onHome, onFree }) {
  const w = WORLDS[sel], nx = nextLevel(progress)
  // a world that just opened: its sticker peels on with a chord, on the same beat as the CSS
  useEffect(() => {
    if (fresh == null) return
    const id = setTimeout(() => [0, 1, 2].forEach(i => setTimeout(() => sfx.sticker(i), i * 90)), 380)
    return () => clearTimeout(id)
  }, [fresh])
  return (
    <div className="map">
      <header className="bar">
        <button className="btn alt small" onClick={onHome}>Home</button>
        <h1>Pick a world</h1>
        <span className="bar-note">{earned(progress, LEVELS)} of {LEVELS.length * 3} stickers</span>
        <button className="btn yellow small" onClick={onFree}>Free play</button>
      </header>
      <div className="map-body">
        <div className="face" role="group" aria-label="Worlds">
          {WORLDS.map((wd, wi) => {
            const open = unlocked(progress, LEVELS.indexOf(wd.levels[0]))
            return (
              <button key={wi} className={`world ${wi === sel ? 'sel' : ''} ${wi === fresh ? 'fresh' : ''}`} disabled={!open} onClick={() => setSel(wi)}
                style={open ? { '--c': wd.color, '--t': ink(wd.color) } : undefined} aria-pressed={wi === sel}
                aria-label={open ? `World ${wi + 1}: ${wd.name}, ${earned(progress, wd.levels)} of ${wd.levels.length * 3} stickers` : `World ${wi + 1}, locked`}>
                <span className="world-n">{wi + 1}</span>
                {open && <>
                  <span className="world-name">{wd.name}</span>
                  <span className="world-score">{earned(progress, wd.levels)}/{wd.levels.length * 3}</span>
                </>}
              </button>
            )
          })}
        </div>
        <section key={sel} className="slab levels" aria-label={`Levels in ${w.name}`}>
          <h2>{w.name}</h2>
          <p className="note">{earned(progress, w.levels)} of {w.levels.length * 3} stickers earned</p>
          <ol className="level-row">
            {w.levels.map(l => {
              const i = LEVELS.indexOf(l), ok = unlocked(progress, i), s = progress[l.id] || 0
              return (
                <li key={l.id}>
                  <button className={`lvl ${i === nx ? 'next' : ''}`} disabled={!ok} onClick={() => onPlay(i)} style={ok ? { '--c': w.color, '--t': ink(w.color) } : undefined}
                    aria-label={`Level ${l.id}: ${l.title}${ok ? `, ${s} of 3 stickers` : ', locked'}`}>
                    {l.id.split('-')[1]}
                  </button>
                  <span className={`lvl-title ${ok ? '' : 'off'}`}>{i === nx ? <b>Up next</b> : l.title}</span>
                  <Rating n={s} />
                </li>
              )
            })}
          </ol>
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

  const nxt = LEVELS[cur + 1], crossing = nxt && nxt.world !== LEVELS[cur].world
  const onWin = useCallback(stars => {
    const id = LEVELS[cur].id
    if (crossing && !(progress[id] > 0)) { setFresh(nxt.world); setSel(nxt.world) }
    const next = { ...progress, [id]: Math.max(progress[id] || 0, stars) }
    save(next); setProgress(next)
  }, [cur, crossing, nxt, progress])
  const go = s => { setFresh(null); setScreen(s) }
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
        {screen === 'map' && <WorldMap progress={progress} sel={sel} setSel={setSel} fresh={fresh} onPlay={play} onHome={() => go('home')} onFree={() => go('free')} />}
        {screen === 'free' && <Level level={FREE} onWin={() => {}} onMap={() => go('map')} />}
        {/* a new world opens on the map, so its sticker can arrive; inside a world, straight on */}
        {screen === 'level' && <Level level={LEVELS[cur]} hasNext={!!nxt} unlock={fresh != null ? WORLDS[fresh] : null}
          nextLabel={crossing ? 'Next world' : 'Next'}
          onWin={onWin} onMap={() => setScreen('map')} onNext={() => crossing ? (setSel(nxt.world), setScreen('map')) : play(cur + 1)} />}
      </main>
    </div>
  )
}
