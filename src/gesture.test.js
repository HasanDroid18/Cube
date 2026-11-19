import assert from 'node:assert/strict'
import { apply, solved, isRotation } from './cube.js'
import { faceDrag, pickFace, swipeToMove } from './gesture.js'

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const eq = (a, b) => a.every((v, i) => v === b[i])
const unit = (i, s) => { const v = [0, 0, 0]; v[i] = s; return v }
const C = [-1, 0, 1]

let n = 0
for (let na = 0; na < 3; na++) for (const ns of [-1, 1]) {
  const normal = unit(na, ns)
  for (const u of C) for (const v of C) {
    const pos = [0, 0, 0]; const [ia, ib] = [0, 1, 2].filter(i => i !== na)
    pos[na] = ns; pos[ia] = u; pos[ib] = v
    for (const ta of [ia, ib]) for (const s of [-1, 1]) {
      const t = unit(ta, s)
      // sloppy finger: some off-axis wobble and some motion along the normal
      const drag = [0, 1, 2].map(i => 10 * t[i] + (i === na ? 4 : i !== ta ? 2 : 0))
      const move = swipeToMove(normal, pos, drag)
      assert(move, `null for n=${normal} p=${pos} t=${t}`)
      // simulate: follow the touched sticker (point p + 0.5 n) through the move
      const before = solved(), after = apply(before, move)
      const i = before.findIndex(c => eq(c.p, pos)), c = after[i]
      const n2 = [0, 1, 2].map(k => normal[0] * c.o[0][k] + normal[1] * c.o[1][k] + normal[2] * c.o[2][k])
      const s0 = pos.map((x, k) => x + 0.5 * normal[k]), s1 = c.p.map((x, k) => x + 0.5 * n2[k])
      const disp = s1.map((x, k) => x - s0[k])
      assert(dot(disp, t) > 0, `${move}: sticker n=${normal} p=${pos} went ${disp}, drag ${t}`)
      // the sticker leaves its face toward the drag side and lands on the face t
      assert(eq(n2, t), `${move}: sticker n=${normal} p=${pos} ended on ${n2}, want ${t}`)
      // middle slice -> whole-cube rotation, outer layer -> face turn
      const axis = [0, 1, 2].find(k => k !== na && k !== ta)
      assert.equal(isRotation(move), pos[axis] === 0, `${move} for p=${pos}`)
      n++
    }
  }
}
assert.equal(n, 6 * 9 * 4)

// spot checks against cube notation
assert.equal(swipeToMove([0, 0, 1], [1, 1, 1], [0, 1, 0]), 'R')      // front-right column swiped up
assert.equal(swipeToMove([0, 0, 1], [1, 1, 1], [-1, 0, 0]), 'U')     // front-top row swiped left
assert.equal(swipeToMove([0, 0, 1], [0, 0, 1], [0, 1, 0]), 'x')      // front centre up = whole cube x
assert.equal(swipeToMove([0, 0, 1], [0, 0, 1], [1, 0, 0]), "y'")     // front centre right = y'
assert.equal(swipeToMove([0, 1, 0], [0, 1, 0], [1, 0, 0]), 'z')      // top centre right = z

// null cases
assert.equal(swipeToMove([0, 0, 1], [1, 1, 1], [0, 0, 5]), null)     // drag straight along the normal
assert.equal(swipeToMove([0, 0, 1], [1, 1, 1], [0, 0, 0]), null)     // no drag
assert.equal(swipeToMove([0, 0, 1], [1, 1, 1], [1, 1, 0]), null)     // perfect diagonal
assert.equal(swipeToMove([0, 0, 1], [1, 1, 1], [1, 0.75, 0]), null)  // within 30%: wait for a clearer line
assert.equal(swipeToMove([0, 0, 1], [1, 1, 1], [1, 0.65, 0]), "U'")  // just outside 30%: top row right

// faceDrag: front face seen head-on, x right, y up on screen (screen y grows downward)
assert.deepEqual(faceDrag([60, 0], [0, -60], 0, -30).map(v => v + 0), [0, 0.5])      // finger up half a cubie
assert.equal(swipeToMove([0, 0, 1], [1, 1, 1], [0, 0.5, 0]), 'R')
// top face seen from above at a slant: z (toward the camera) shows short and pointing down-left.
// A plain upward finger is mostly -z, i.e. along the right column away from the viewer: R.
{
  const [x, z] = faceDrag([52, 14], [-24, 22], 0, -30)
  const d = [x, 0, z]
  assert(Math.abs(z) > Math.abs(x) && z < 0, `top face drag ${d}`)
  assert.equal(swipeToMove([0, 1, 0], [1, 1, 1], d), 'R')
}
assert.equal(faceDrag([10, 10], [20, 20], 5, 5), null)                 // edge-on face: no call

// pickFace: touch on the front sticker of the top-front-right corner
const corner = [1, 1, 1], facing = [0.54, 0.45, 0.72] // default camera: front faces it most
assert.equal(pickFace([0.1, 0.05, 0.48], corner, facing), 2)          // middle of the sticker: front
assert.equal(pickFace([0.1, 0.47, 0.48], corner, facing), 2)          // on the top/front border: front wins
assert.equal(pickFace([0.1, 0.48, 0.39], corner, facing), 2)          // top sticker, at the border: front
assert.equal(pickFace([0.1, 0.48, 0.3], corner, facing), 1)           // top sticker, a finger-width in: top
assert.equal(pickFace([0.1, 0.48, 0.1], corner, facing), 1)           // top sticker, well inside: top
assert.equal(pickFace([0.1, 0.48, -0.4], corner, facing), 1)          // far edge of top (no sticker behind): top
assert.equal(pickFace([0.47, 0.1, 0.48], [1, 0, 1], facing), 2)       // edge piece, right/front border: front

console.log(`gesture: ${n} simulated swipes + spot checks ok`)
