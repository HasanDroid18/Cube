// Swipe-on-cube -> move name. Pure maths, plain [x,y,z] arrays, cube.js conventions.
// Cube3D: pickFace (which sticker was touched) -> faceDrag (screen drag -> drag in that face's plane)
// -> swipeToMove (which layer, which way). It re-runs on every pointermove so the layer can follow the finger.

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const FACE = [['L', 'R'], ['D', 'U'], ['B', 'F']] // [axis][layer > 0]

// Screen drag (dx, dy) -> amounts (a, b) along a face's two in-plane axes, given each axis' on-screen
// image s1, s2 (px per world unit). Exact inverse of the projection, so oblique faces (the top face seen
// from above) map the finger correctly instead of through the camera's right/up. null if edge-on.
export function faceDrag(s1, s2, dx, dy) {
  const det = s1[0] * s2[1] - s2[0] * s1[1]
  if (Math.abs(det) < 1e-6 * (Math.hypot(...s1) * Math.hypot(...s2) || 1)) return null
  return [(dx * s2[1] - s2[0] * dy) / det, (s1[0] * dy - dx * s1[1]) / det]
}

// Which face of a cubie the finger meant. lp: touch point in the cubie's own frame (faces at ±0.48),
// h: its home (a sticker on local axis k iff h[k]), facing[k]: how much that sticker faces the camera.
// Inside `edge` of a border between two stickers, the one facing the camera more wins: it is the one
// the player is looking at, and the finger is too fat to tell the two apart.
export function pickFace(lp, h, facing, edge = 0.36) {
  const a = [0, 1, 2].reduce((m, k) => (Math.abs(lp[k]) > Math.abs(lp[m]) ? k : m), 0)
  const near = [0, 1, 2].filter(k => h[k] && Math.sign(lp[k]) === Math.sign(h[k]) && Math.abs(lp[k]) > edge)
  return near.length > 1 ? near.reduce((m, k) => (facing[k] > facing[m] ? k : m)) : a
}

export function swipeToMove(normal, pos, drag, ratio = 0.7) {
  const na = normal.findIndex(Boolean)
  const tan = [0, 1, 2].filter(i => i !== na) // component along the normal is ignored = projection
  const [a, b] = tan.map(i => Math.abs(drag[i]))
  const big = Math.max(a, b)
  if (big < 1e-6 || Math.min(a, b) >= ratio * big) return null // no drag, or too diagonal to call
  const ta = a > b ? tan[0] : tan[1]
  const t = [0, 0, 0]; t[ta] = Math.sign(drag[ta])
  // spin w = n x t carries the face point n to t: the sticker moves with the finger
  const w = cross(normal, t), axis = w.findIndex(Boolean), dir = w[axis] // dir: +1 = right-hand (ccw)
  const layer = pos[axis]
  // R/U/F (layer +1) and x/y/z turn with dir -1; L/D/B (layer -1) with dir +1 — see MOVES in cube.js
  const name = layer ? FACE[axis][layer > 0 ? 1 : 0] : 'xyz'[axis]
  return dir === (layer < 0 ? 1 : -1) ? name : name + "'"
}
