// Pure 3x3 cube model. Cubie: {h: home [x,y,z], p: position, o: images of local x/y/z axes}.

const ROT = {
  1: [v => [v[0], -v[2], v[1]], v => [v[2], v[1], -v[0]], v => [-v[1], v[0], v[2]]],
  [-1]: [v => [v[0], v[2], -v[1]], v => [-v[2], v[1], v[0]], v => [v[1], -v[0], v[2]]],
}
export const rot = (v, axis, dir) => ROT[dir][axis](v)

// [axis, layer (null = whole cube), dir]
const MOVES = { R: [0, 1, -1], L: [0, -1, 1], U: [1, 1, -1], D: [1, -1, 1], F: [2, 1, -1], B: [2, -1, 1], x: [0, null, -1], y: [1, null, -1], z: [2, null, -1] }

export function moveInfo(m) {
  const [axis, layer, dir] = MOVES[m[0]]
  return { axis, layer, dir: m.endsWith("'") ? -dir : dir }
}
export const isRotation = m => 'xyz'.includes(m[0])
export const inLayer = (c, { axis, layer }) => layer == null || c.p[axis] === layer

export function solved() {
  const s = []
  for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1])
    if (x || y || z) s.push({ h: [x, y, z], p: [x, y, z], o: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] })
  return s
}

export function apply(state, move) {
  const mi = moveInfo(move)
  return state.map(c => inLayer(c, mi) ? { h: c.h, p: rot(c.p, mi.axis, mi.dir), o: c.o.map(v => rot(v, mi.axis, mi.dir)) } : c)
}

// "R U2 R'" -> ['R','U','U',"R'"]; "/" only marks chunk breaks for display
export const parse = str => str.trim().split(/\s+/).filter(t => t && t !== '/').flatMap(t => {
  const m = t[0] + (t.includes("'") ? "'" : '')
  return t.includes('2') ? [m, m] : [m]
})
export const chunks = str => str.split('/').map(parse).filter(c => c.length)
export const inv = m => m.endsWith("'") ? m[0] : m + "'"
export const inverse = moves => [...moves].reverse().map(inv)
export const applyAll = (state, moves) => (typeof moves === 'string' ? parse(moves) : moves).reduce(apply, state)

const kind = h => h.filter(Boolean).length // 1 center, 2 edge, 3 corner
export const SETS = {
  all: () => true,
  centers: h => kind(h) === 1,
  edges: h => kind(h) === 2,
  corners: h => kind(h) === 3,
  cross: h => kind(h) === 1 || (kind(h) === 2 && h[1] === 1),
  layer1: h => kind(h) === 1 || h[1] === 1,
  f2l: h => kind(h) === 1 || h[1] >= 0,
  yEdges: h => kind(h) === 2 && h[1] === -1,
  yCorners: h => kind(h) === 3 && h[1] === -1,
  f2lE: h => SETS.f2l(h) || SETS.yEdges(h),
}

const eq = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
const mul = (M, h) => [0, 1, 2].map(i => M[0][i] * h[0] + M[1][i] * h[1] + M[2][i] * h[2])

// Rotation-invariant: M = orientation of the first non-center cubie of the solved set.
export function frame(state, setName = 'all') {
  const inS = state.filter(c => SETS[setName](c.h))
  return (inS.find(c => kind(c.h) > 1) || inS[0]).o
}
export const placedOk = (c, M) => eq(c.p, mul(M, c.h))

export function goalMet(state, goal) {
  const M = frame(state, goal.solved)
  const of = name => state.filter(c => SETS[name](c.h))
  return of(goal.solved).every(c => placedOk(c, M) && (kind(c.h) === 1 || c.o.every((v, i) => eq(v, M[i]))))
    && (!goal.up || of(goal.up).every(c => eq(c.o[1], M[1])))
    && (!goal.placed || of(goal.placed).every(c => placedOk(c, M)))
}

export const same = (a, b) => a.every((c, i) => eq(c.p, b[i].p) && c.o.every((v, k) => eq(v, b[i].o[k])))

// player history with X X' cancelled and X X X folded to X', so walking back always shortens it
export function pushMove(h, m) {
  if (h.at(-1) === inv(m)) return h.slice(0, -1)
  if (h.at(-1) === m && h.at(-2) === m) return [...h.slice(0, -2), inv(m)]
  return [...h, m]
}
// the help ladder. course: {moves, path: state after each prefix of moves}. On the path: its next move;
// off it: undo the last move. Ends on the path because pushMove shortens hist on every walk-back.
export const course = (start, moves) => ({ moves, path: moves.reduce((a, m) => [...a, apply(a.at(-1), m)], [start]) })
export function helpMove({ moves, path }, state, hist) {
  for (let k = path.length - 1; k >= 0; k--) if (same(path[k], state)) return moves[k] ?? null
  return hist.length ? inv(hist.at(-1)) : null
}

// how each move looks from the default camera (front-right-top): the way the front (or, for F/B, top) stickers go
export const LOOK = { R: 'up', "R'": 'down', L: 'down', "L'": 'up', U: 'left', "U'": 'right', D: 'right', "D'": 'left', F: 'cw', "F'": 'ccw', B: 'ccw', "B'": 'cw', y: 'left', "y'": 'right' }

export function display(c, goal) {
  if (!goal) return 'full'
  if (SETS[goal.solved](c.h) || (goal.placed && SETS[goal.placed](c.h))) return 'full'
  return goal.up && SETS[goal.up](c.h) ? 'yellow' : 'grey'
}

// what a camera at front-right-top sees, for flat pictures: U, F and R as 9 colours each (null = grey plastic),
// cell u + 3v. U: u = +x, v = +z (back to front); F: u = +x, v = -y; R: u = -z, v = -y (both top to bottom)
const SEEN = { U: [[0, 1, 0], (u, v) => [u, 1, v]], F: [[0, 0, 1], (u, v) => [u, -v, 1]], R: [[1, 0, 0], (u, v) => [1, -v, -u]] }
export const seen = (state, goal) => Object.fromEntries(Object.entries(SEEN).map(([f, [n, at]]) => [f,
  [-1, 0, 1].flatMap(v => [-1, 0, 1].map(u => {
    const c = state.find(c => eq(c.p, at(u, v))), m = display(c, goal)
    const a = [0, 1, 2].find(a => c.h[a] && eq(c.o[a].map(x => x * c.h[a]), n)) // its sticker facing out along n
    return m === 'full' || (m === 'yellow' && a === 1 && c.h[a] < 0) ? stickerColor(a, c.h[a]) : null
  }))]))

// colour of the sticker on home face (axis, sign)
export const COLORS = [['#FF5800', '#C41E3A'], ['#FFD500', '#F4F4F0'], ['#0046AD', '#009B48']] // [axis][sign>0]
export const stickerColor = (axis, sign) => COLORS[axis][sign > 0 ? 1 : 0]
// readable text colour on a sticker / backdrop of colour c (white only on red and blue)
export const ink = c => (c === COLORS[0][1] || c === COLORS[2][0] ? '#fff' : '#000')
