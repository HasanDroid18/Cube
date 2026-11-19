import assert from 'node:assert/strict'
import { solved, apply, applyAll, parse, chunks, inverse, goalMet, course, helpMove, pushMove, LOOK, moveInfo, seen } from './cube.js'
import { LEVELS, TRICKS, WIGGLE } from './levels.js'

const ALL = { solved: 'all' }
const isSolved = s => goalMet(s, ALL)
const start = l => applyAll(applyAll(solved(), l.pre), inverse(parse(l.alg)))

assert.deepEqual(parse("R U2 R'"), ['R', 'U', 'U', "R'"])
assert.deepEqual(parse("R U / R' U'"), ['R', 'U', "R'", "U'"])
assert.deepEqual(chunks("F / R U R' U' / F'"), [['F'], ['R', 'U', "R'", "U'"], ["F'"]])
assert.deepEqual(inverse(parse("R U'")), ['U', "R'"])
assert(isSolved(applyAll(solved(), 'R R R R')), 'R x4')
assert(!isSolved(applyAll(solved(), 'R')), 'R alone')
assert(isSolved(applyAll(solved(), Array(6).fill(WIGGLE).join(' '))), 'Wiggle x6')
const alg = parse("R U F' L2 D B' x y' z")
assert(isSolved(applyAll(applyAll(solved(), alg), inverse(alg))), 'alg + inverse')
assert(isSolved(applyAll(solved(), 'x2 y')), 'rotation invariance')
assert(goalMet(applyAll(solved(), "x2 y F"), { solved: 'cross' }) === false)
assert.deepEqual(pushMove(['R', 'U'], "U'"), ['R'])
assert.deepEqual(pushMove(['U', 'R', 'R'], 'R'), ['U', "R'"])

// key icons: the way a front sticker (top sticker for F/B) of the turning layer goes on screen
for (const [m, look] of Object.entries(LOOK)) {
  const { axis, layer } = moveInfo(m), l = layer ?? 0
  const p = axis === 2 ? [0, 1, l] : axis === 0 ? [l, 0, 1] : [0, l, 1]
  const i = solved().findIndex(c => c.p.every((v, k) => v === p[k])), q = apply(solved(), m)[i].p
  const got = axis === 2 ? (q[0] > 0 ? 'cw' : 'ccw') : q[1] > p[1] ? 'up' : q[1] < p[1] ? 'down' : q[0] < p[0] ? 'left' : 'right'
  assert.equal(got, look, `icon for ${m}`)
}

// help ladder: from the start, and after 3 arbitrary wrong moves, following Help alone reaches the goal
const WRONG = ['L', "D'", 'B', 'y', 'R', 'U', "F'"]
const ladder = (l, s0, hist0) => {
  const co = course(start(l), parse(l.alg))
  let s = s0, hist = hist0
  for (let n = 0; n < 200; n++) {
    if (goalMet(s, l.goal)) return n
    const m = helpMove(co, s, hist)
    assert(m, `${l.id}: help gave no move before the goal`)
    s = apply(s, m); hist = pushMove(hist, m)
  }
  assert.fail(`${l.id} ${l.title}: help ladder did not finish`)
}

let n = 0, helped = 0
for (const l of LEVELS.filter(l => l.type === 'goal')) {
  const s = start(l)
  assert(!goalMet(s, l.goal), `${l.id} ${l.title}: start already meets goal`)
  assert(goalMet(applyAll(s, l.alg), l.goal), `${l.id} ${l.title}: alg does not solve`)
  ladder(l, s, [])
  for (let k = 0; k < WRONG.length; k++) {
    const w = [WRONG[k], WRONG[(k + 2) % 7], WRONG[(k + 5) % 7]]
    ladder(l, applyAll(s, w), w.reduce(pushMove, []))
    helped++
  }
  n++
}
// follow levels and tour "do" steps start one sequence away from solved (the world's goal), and are shown in chunks of <= 4
let does = 0
for (const l of LEVELS) for (const st of l.type === 'tour' ? l.steps.filter(s => s.alg) : l.type === 'follow' ? [{ alg: l.seq }] : []) {
  const s0 = applyAll(applyAll(solved(), l.pre), inverse(parse(st.alg)))
  assert(goalMet(applyAll(s0, st.alg), l.goal), `${l.id}: ${st.alg} does not finish`)
  assert(chunks(st.alg).every(c => c.length <= 4), `${l.id}: chunk longer than 4 in ${st.alg}`)
  does++
}
for (const t of TRICKS) assert(chunks(t.alg).every(c => c.length <= 4), `${t.name}: chunk longer than 4`)

// tap steps: the right piece exists in the step's setup and shows a sticker to the default camera (+x/+y/+z faces)
let taps = 0
for (const l of LEVELS.filter(l => l.type === 'tour')) for (const st of l.steps.filter(st => st.tap)) {
  const s = applyAll(applyAll(solved(), st.pre ?? l.pre), inverse(parse(st.setup ?? st.alg ?? '')))
  const hits = s.filter(st.tap)
  assert(hits.length && hits.some(c => c.p.some(v => v === 1)), `${l.id}: no visible piece for "${st.say}"`)
  assert(hits.length < s.length, `${l.id}: every piece matches "${st.say}"`)
  taps++
}

// map pictures: what the front-right-top view shows (W white, G green front, R red right, Y yellow, B blue, . grey)
const L = { '#F4F4F0': 'W', '#FFD500': 'Y', '#C41E3A': 'R', '#FF5800': 'O', '#009B48': 'G', '#0046AD': 'B' }
const pic = (s, goal) => Object.values(seen(s, goal)).map(f => f.map(c => L[c] ?? '.').join('')).join(' ')
assert.equal(pic(solved(), { solved: 'cross' }), '.W.WWW.W. .G..G.... .R..R....', 'white cross picture')
assert.equal(pic(applyAll(solved(), 'x2'), { solved: 'f2l', up: 'yEdges' }), '.Y.YYY.Y. ...BBBBBB ...RRRRRR', 'yellow cross picture')
assert.equal(pic(applyAll(solved(), 'R'), null), 'WWGWWGWWG GGYGGYGGY RRRRRRRRR', 'R turn picture')

// copy: short bubbles, short sentences, kid words, short tours
let bubbles = 0
const says = LEVELS.flatMap(l => [l.say ?? [], ...(l.steps ?? []).map(s => s.say)])
for (const say of says) for (const b of say) {
  const sentences = b.split(/(?<=[.!?])\s+/).filter(Boolean)
  assert(sentences.length <= 2, `too many sentences: "${b}"`)
  for (const s of sentences) assert(s.split(/\s+/).length <= 12, `sentence too long: "${s}"`)
  assert(!/clockwise|prime|algorithm|orientation|layer/i.test(b), `banned word: "${b}"`)
  bubbles++
}
for (const l of LEVELS.filter(l => l.type === 'tour')) assert(l.steps.length <= 6, `${l.id}: tour longer than 6 steps`)
assert.equal(new Set(LEVELS.map(l => l.id)).size, LEVELS.length)

console.log(`ok: core checks + ${n} goal levels (help ladder from ${n + helped} starts) + ${does} guided sequences + ${taps} tap steps + ${bubbles} bubbles`)
