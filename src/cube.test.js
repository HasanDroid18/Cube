import assert from 'node:assert/strict'
import { solved, applyAll, parse, inverse, goalMet } from './cube.js'
import { LEVELS, TRIG } from './levels.js'

const ALL = { solved: 'all' }
const isSolved = s => goalMet(s, ALL)
const start = l => applyAll(applyAll(solved(), l.pre), inverse(parse(l.alg)))

assert.deepEqual(parse("R U2 R'"), ['R', 'U', 'U', "R'"])
assert.deepEqual(inverse(parse("R U'")), ['U', "R'"])
assert(isSolved(applyAll(solved(), 'R R R R')), 'R x4')
assert(!isSolved(applyAll(solved(), 'R')), 'R alone')
assert(isSolved(applyAll(solved(), Array(6).fill(TRIG).join(' '))), 'TRIG x6')
const alg = parse("R U F' L2 D B' x y' z")
assert(isSolved(applyAll(applyAll(solved(), alg), inverse(alg))), 'alg + inverse')
assert(isSolved(applyAll(solved(), 'x2 y')), 'rotation invariance')
assert(goalMet(applyAll(solved(), "x2 y F"), { solved: 'cross' }) === false)

let n = 0
for (const l of LEVELS.filter(l => l.type === 'goal')) {
  const s = start(l)
  assert(!goalMet(s, l.goal), `${l.id} ${l.title}: start already meets goal`)
  assert(goalMet(applyAll(s, l.alg), l.goal), `${l.id} ${l.title}: alg does not solve`)
  n++
}
// tap steps: the right piece exists in the step's setup and shows a sticker to the default camera (+x/+y/+z faces)
let taps = 0
for (const l of LEVELS.filter(l => l.type === 'tour')) for (const st of l.steps.filter(st => st.tap)) {
  const s = applyAll(applyAll(solved(), st.pre ?? l.pre), inverse(parse(st.setup ?? st.alg ?? '')))
  const hits = s.filter(st.tap)
  assert(hits.length && hits.some(c => c.p.some(v => v === 1)), `${l.id}: no visible piece for "${st.text}"`)
  assert(hits.length < s.length, `${l.id}: every piece matches "${st.text}"`)
  taps++
}
console.log(`ok: core checks + ${n} goal levels + ${taps} tap steps`)
