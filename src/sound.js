// Synthesized toy-cube sounds + haptics. Web Audio only, no files. Safe to import in Node.
const KEY = 'cubewise-muted'
let muted = false
try { muted = globalThis.localStorage?.getItem(KEY) === '1' } catch {}

let ctx = null, master = null, noiseBuf = null

// Run fn(ctx) now if audio is live; otherwise try to resume (needs a user gesture) and
// play only if the resume lands promptly, so pre-gesture calls never pile up into a burst.
function play(fn) {
  if (muted) return
  try {
    if (!ctx) {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext
      if (!AC) return
      ctx = new AC()
      master = ctx.createGain()
      master.gain.value = 0.5
      master.connect(ctx.destination)
      noiseBuf = ctx.createBuffer(1, (ctx.sampleRate * 0.15) | 0, ctx.sampleRate)
      const d = noiseBuf.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    }
    if (ctx.state === 'running') return fn(ctx, ctx.currentTime)
    const asked = Date.now()
    ctx.resume().then(() => {
      if (ctx.state === 'running' && Date.now() - asked < 150) fn(ctx, ctx.currentTime)
    }).catch(() => {})
  } catch {}
}

function buzz(pattern) {
  if (muted) return
  try { globalThis.navigator?.vibrate?.(pattern) } catch {}
}

// Percussive gain envelope: silence -> peak in `a` s -> silence over `d` s.
function env(c, t, peak, a, d) {
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(peak, t + a)
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d)
  return g
}

// Wire src -> ...nodes -> master, schedule it, and tear the whole chain down when it ends.
function wire(src, nodes, t, dur) {
  let n = src
  for (const x of nodes) { n.connect(x); n = x }
  n.connect(master)
  src.onended = () => { src.disconnect(); nodes.forEach((x) => x.disconnect()) }
  src.stop(t + dur + 0.02)
}

function tone(c, t, type, f0, f1, peak, a, d) {
  const o = c.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(f0, t)
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + a + d)
  o.start(t)
  wire(o, [env(c, t, peak, a, d)], t, a + d)
}

function noise(c, t, filter, freq, q, peak, a, d) {
  const s = c.createBufferSource()
  s.buffer = noiseBuf
  const f = c.createBiquadFilter()
  f.type = filter
  f.frequency.value = freq
  f.Q.value = q
  s.start(t, Math.random() * 0.05)
  wire(s, [f, env(c, t, peak, a, d)], t, a + d)
}

const C5 = 523.25, E5 = 659.25, G5 = 783.99

export const sfx = {
  turn() {
    buzz(8)
    play((c, t) => {
      const r = 1 + (Math.random() - 0.5) * 0.16 // +-8% pitch
      const lv = 0.8 + Math.random() * 0.35 // level jitter
      noise(c, t, 'bandpass', 2400 * r, 1.2, 0.35 * lv, 0.001, 0.045) // plastic clack body
      tone(c, t, 'sine', 180 * r, 90 * r, 0.4 * lv, 0.002, 0.06) // low thunk
      noise(c, t + 0.012 + Math.random() * 0.008, 'highpass', 4500, 0.7, 0.12 * lv, 0.001, 0.015) // detent tick
    })
  },
  wrong() {
    buzz([20, 40, 20])
    play((c, t) => {
      tone(c, t, 'triangle', 233, 220, 0.22, 0.01, 0.16)
      tone(c, t + 0.13, 'triangle', 185, 165, 0.22, 0.01, 0.22)
    })
  },
  tap() {
    play((c, t) => tone(c, t, 'sine', 1400, 1000, 0.14, 0.001, 0.025))
  },
  sticker(i = 0) {
    const f = [C5, E5, G5][Math.max(0, Math.min(2, i | 0))]
    play((c, t) => {
      tone(c, t, 'sine', f * 0.5, f, 0.3, 0.005, 0.12)
      noise(c, t, 'highpass', 3000, 0.7, 0.06, 0.001, 0.012)
    })
  },
  win() {
    buzz([15, 60, 15, 60, 40])
    play((c, t) => {
      ;[C5, E5, G5, C5 * 2, E5 * 2].forEach((f, k) => {
        const at = t + k * 0.09, d = k === 4 ? 0.6 : 0.22
        tone(c, at, 'triangle', f, f, 0.22, 0.005, d)
        tone(c, at, 'sine', f * 2, f * 2, 0.05, 0.005, d * 0.6) // toy-glock sparkle
      })
    })
  },
  get muted() { return muted },
  toggle() {
    muted = !muted
    try { globalThis.localStorage?.setItem(KEY, muted ? '1' : '0') } catch {}
    return muted
  },
}
