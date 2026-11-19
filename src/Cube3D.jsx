import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, OrbitControls, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { apply, inLayer, moveInfo, solved, stickerColor } from './cube.js'
import { faceDrag, pickFace, swipeToMove } from './gesture.js'
import { sfx } from './sound.js'

const AXES = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)]
const GREY = '#2e2e2e'
export const TURN_MS = 280
const NUDGE = Math.PI / 22 // ~8 degree preview of a layer
const SWIPE_PX = 10, TAP_PX = 9
const QUARTER = Math.PI / 2
// a dragged layer: finger travel (world units) / ARM = angle, so a middle-row sticker stays under the finger
const ARM = 1.5, COMMIT = 0.4, AUTO = 1.2, FLING_MS = 120 // rad, rad, rad, ms of momentum projected on release
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const unease = e => (e < 0.5 ? Math.cbrt(e / 4) : 1 - Math.cbrt(2 * (1 - e)) / 2)
const HOMES = solved() // index-stable cubie list; display mode depends only on home
export const calm = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

const STICKER = (() => {
  const w = 0.41, r = 0.12, s = new THREE.Shape()
  s.moveTo(-w + r, -w); s.lineTo(w - r, -w); s.quadraticCurveTo(w, -w, w, -w + r)
  s.lineTo(w, w - r); s.quadraticCurveTo(w, w, w - r, w); s.lineTo(-w + r, w)
  s.quadraticCurveTo(-w, w, -w, w - r); s.lineTo(-w, -w + r); s.quadraticCurveTo(-w, -w, -w + r, -w)
  return new THREE.ShapeGeometry(s, 6)
})()
const mats = {}
const mat = c => (mats[c] ??= new THREE.MeshStandardMaterial({ color: c, roughness: 0.38, metalness: 0 }))
const BODY = new THREE.MeshStandardMaterial({ color: '#0b0b0b', roughness: 0.32, metalness: 0 })
const BODY_HI = new THREE.MeshStandardMaterial({ color: '#9a9a9a', roughness: 0.32, metalness: 0 }) // reduced motion: lit layer instead of a tilt
const BODY_LIT = new THREE.MeshStandardMaterial({ color: '#5a5a5a', roughness: 0.32, metalness: 0 }) // the layer the arrow points at

// The move arrow: a white tube with a black rim, lying just off the two faces of the turning layer that face
// the camera, bent round the edge between them and pointing the way the stickers travel.
const ARROW_W = new THREE.MeshBasicMaterial({ color: '#fff', transparent: true })
const ARROW_K = new THREE.MeshBasicMaterial({ color: '#000', side: THREE.BackSide, transparent: true })
const arrows = new Map()
const V3 = (axis, layer, kA, a, kB, b) => { const v = new THREE.Vector3(); v.setComponent(axis, layer); v.setComponent(kA, a); v.setComponent(kB, b); return v }
function arrow(key, { axis, layer, dir }, s1, s2, see1) { // see1: the k1 face faces the camera more than the k2 face
  if (arrows.has(key)) return arrows.get(key)
  const l = layer ?? 0, [k1, k2] = [0, 1, 2].filter(k => k !== axis)
  // travel at the shared edge (s1 on k1, s2 on k2) is dir * axis x edge; run k1 -> k2 if that matches, else k2 -> k1
  const c = [0, 0, 0]; c[k1] = s1; c[k2] = s2
  const w = [0, 0, 0]; w[axis] = dir
  const vel = [w[1] * c[2] - w[2] * c[1], w[2] * c[0] - w[0] * c[2], w[0] * c[1] - w[1] * c[0]]
  const fwd = -s1 * vel[k1] + s2 * vel[k2] > 0
  const [kA, sA, kB, sB] = fwd ? [k1, s1, k2, s2] : [k2, s2, k1, s1]
  // the long run goes on the face the camera sees better; the other face gets a short tail or just the head
  const longA = (kA === k1) === see1
  const H = 1.64, r = 0.42, P = (a, b) => V3(axis, l, kA, a, kB, b)
  const start = P(sA * H, sB * (longA ? -0.95 : 0.3)), end = P(sA * (longA ? 1.06 : -0.3), sB * H)
  const path = new THREE.CurvePath()
  path.add(new THREE.LineCurve3(start, P(sA * H, sB * (H - r))))
  path.add(new THREE.QuadraticBezierCurve3(P(sA * H, sB * (H - r)), P(sA * H, sB * H), P(sA * (H - r), sB * H)))
  path.add(new THREE.LineCurve3(P(sA * (H - r), sB * H), end))
  const g = new THREE.Group()
  const tip = new THREE.Vector3().setComponent(kA, -sA)
  for (const [rad, m] of [[0.1, ARROW_W], [0.155, ARROW_K]]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(rad, 12, 8), m)
    cap.position.copy(start)
    g.add(new THREE.Mesh(new THREE.TubeGeometry(path, 40, rad, 10), m), cap)
  }
  for (const [rad, h, m] of [[0.34, 0.7, ARROW_W], [0.44, 0.92, ARROW_K]]) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(rad, h, 20), m)
    cone.quaternion.setFromUnitVectors(AXES[1], tip)
    cone.position.copy(end).addScaledVector(tip, 0.35)
    g.add(cone)
  }
  g.traverse(o => { o.renderOrder = 2 }) // over the face letters
  arrows.set(key, g)
  return g
}
export const RESET = 'M12 5V1L7 6l5 5V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z'
const VIEWS = { front: [5.4, 4.5, 7.2], under: [5.4, -4.5, 7.2] }
const DIST = Math.hypot(...VIEWS.front)
// sticker rotation so the shape's +z normal points along each outward face
const FACE_ROT = { '0,1': [0, Math.PI / 2, 0], '0,-1': [0, -Math.PI / 2, 0], '1,1': [-Math.PI / 2, 0, 0], '1,-1': [Math.PI / 2, 0, 0], '2,1': [0, 0, 0], '2,-1': [0, Math.PI, 0] }

function Cubie({ h, mode, groupRef }) {
  return (
    <group ref={groupRef}>
      <RoundedBox args={[0.95, 0.95, 0.95]} radius={0.09} smoothness={3} material={BODY} />
      {h.map((v, a) => {
        if (!v) return null
        const color = mode === 'full' || (mode === 'yellow' && a === 1 && v < 0) ? stickerColor(a, v) : GREY
        const pos = [0, 0, 0]; pos[a] = v * 0.482
        return <mesh key={a} geometry={STICKER} material={mat(color)} position={pos} rotation={FACE_ROT[`${a},${v}`]} />
      })}
    </group>
  )
}

const LABELS = [['F', [0, 0, 2.25]], ['R', [2.25, 0, 0]], ['U', [0, 2.25, 0]], ['L', [-2.25, 0, 0]], ['D', [0, -2.25, 0]], ['B', [0, 0, -2.25]]]
function Labels() {
  const tex = useMemo(() => Object.fromEntries(LABELS.map(([l]) => {
    const c = document.createElement('canvas'); c.width = c.height = 128
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
    t.draw = () => {
      const g = c.getContext('2d')
      g.clearRect(0, 0, 128, 128)
      g.fillStyle = '#000'; g.beginPath(); g.roundRect(8, 8, 112, 112, 22); g.fill()
      g.fillStyle = '#fff'; g.font = '900 76px Rubik, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'
      g.fillText(l, 64, 70)
      t.needsUpdate = true
    }
    t.draw()
    return [l, t]
  })), [])
  // canvas text uses whatever font is ready now: redraw once Rubik has loaded
  useEffect(() => { document.fonts?.load('900 76px Rubik').then(() => Object.values(tex).forEach(t => t.draw()), () => {}) }, [tex])
  return LABELS.map(([l, p]) => (
    <sprite key={l} position={p} scale={0.55}>
      <spriteMaterial map={tex[l]} transparent depthWrite={false} />
    </sprite>
  ))
}

const step = (s, x) => (x.move ? apply(s, x.move) : s) // queue items without a move are pauses

function Scene({ stateRef, queueRef, doneRef, live, peek, pop, show, celebrate, labels, swing, onOrbit }) {
  const groups = useRef([])
  const arrowRoot = useRef(), shown = useRef({ key: -1, fade: 0 })
  const orbitFrom = useMemo(() => new THREE.Vector3(), []) // a tap on the background is not an orbit
  const spin = useRef(null)
  const root = useRef()
  const idle = useRef(0)
  const drag = useRef(null)
  const get = useThree(s => s.get)
  const m4 = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const v = useMemo(() => [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], [])
  const q2 = useMemo(() => new THREE.Quaternion(), [])
  const lit = useRef({})

  useLayoutEffect(() => { spin.current = celebrate && !calm ? 0 : null }, [celebrate])
  // fov is vertical: zoom out on a narrow stage so the cube and its letters fit the width,
  // and on a tall desktop stage so the cube doesn't fill the whole window
  const { camera, size } = useThree()
  useLayoutEffect(() => { camera.zoom = Math.min(size.height > 600 && size.width > 600 ? 0.78 : 1, size.width / size.height / 0.92); camera.updateProjectionMatrix() }, [camera, size])

  // state once every queued turn has landed: swipes started mid-animation act on that
  const settled = () => queueRef.current.reduce(step, stateRef.current)

  const onDown = e => {
    const { onSwipe, onTap } = live.current
    if ((!onSwipe && !onTap) || drag.current) return
    const g = e.object.parent, i = groups.current.indexOf(g)
    if (i < 0) return
    // which face of the cubie was touched, in the cubie's own frame (valid even mid-turn);
    // near a border between two stickers, the one facing the camera more
    const lp = g.worldToLocal(v[0].copy(e.point)).toArray()
    const toCam = v[1].copy(get().camera.position).sub(e.point).normalize()
    const facing = [0, 1, 2].map(k => v[2].set(k === 0 ? 1 : 0, k === 1 ? 1 : 0, k === 2 ? 1 : 0).multiplyScalar(Math.sign(lp[k]) || 1).applyQuaternion(g.getWorldQuaternion(q2)).dot(toCam))
    const a = pickFace(lp, HOMES[i].h, facing)
    if (onSwipe) { e.stopPropagation(); const c = get().controls; if (c) c.enabled = false } // a cube drag never orbits
    drag.current = { i, a, s: Math.sign(lp[a]), x: e.clientX, y: e.clientY, id: e.pointerId, moved: 0, m: null, th: 0, vel: 0, at: 0 }
  }

  // screen image (px per world unit) of cube-frame axis k at cube-frame point P
  const axisOnScreen = (P, k) => {
    const { camera, size } = get(), M = root.current.matrixWorld
    const a = v[0].set(P[0], P[1], P[2]).applyMatrix4(M).project(camera)
    const b = v[1].set(P[0], P[1], P[2]); b.setComponent(k, b.getComponent(k) + 0.5); b.applyMatrix4(M).project(camera)
    return [(b.x - a.x) * size.width, (a.y - b.y) * size.height] // 2 * half-size * delta / 0.5
  }

  useEffect(() => {
    const move = e => {
      const d = drag.current, onSwipe = live.current.onSwipe
      if (!d || e.pointerId !== d.id || d.done) return
      const dx = e.clientX - d.x, dy = e.clientY - d.y
      d.moved = Math.max(d.moved, Math.hypot(dx, dy))
      if (!onSwipe || d.moved < SWIPE_PX) return
      const c = settled()[d.i]
      const n = c.o[d.a].map(x => x * d.s) // touched sticker's outward normal in cube frame
      const na = n.findIndex(Boolean), [k1, k2] = [0, 1, 2].filter(k => k !== na)
      const P = c.p.map((x, k) => x + 0.5 * n[k])
      const ab = faceDrag(axisOnScreen(P, k1), axisOnScreen(P, k2), dx, dy)
      if (!ab) return
      const w = [0, 0, 0]; w[k1] = ab[0]; w[k2] = ab[1]
      const m = swipeToMove(n, c.p, w) ?? d.m // ambiguous: keep the layer already following the finger
      if (!m) return
      const th = Math.max(Math.abs(ab[0]), Math.abs(ab[1])) / ARM, now = e.timeStamp
      if (m === d.m && now > d.at) d.vel = 0.5 * d.vel + 0.5 * (th - d.th) / (now - d.at)
      else if (m !== d.m) d.vel = 0
      d.m = m; d.th = th; d.at = now
      peek.current = { mi: moveInfo(m), a: Math.min(th, AUTO), drag: true }
      if (th >= AUTO) commit(d) // dragged most of the way: let it finish on its own
    }
    const up = e => {
      const d = drag.current
      if (!d || e.pointerId !== d.id) return
      drag.current = null
      const c = get().controls; if (c) c.enabled = true
      if (d.done) return
      // release: project the finger's momentum forward; far enough (or flung) turns, otherwise it springs back
      const vel = e.timeStamp - d.at < 80 ? d.vel : 0
      if (d.m && e.type === 'pointerup' && d.th + Math.max(0, vel) * FLING_MS > COMMIT) commit(d)
      else if (d.m) springBack()
      else if (d.moved < TAP_PX && e.type === 'pointerup') live.current.onTap?.(settled()[d.i], d.i)
    }
    addEventListener('pointermove', move)
    addEventListener('pointerup', up)
    addEventListener('pointercancel', up)
    return () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up) }
  })
  // one swipe = one quarter turn; the queued turn picks up from the dragged angle
  const commit = d => { d.done = true; springBack(); live.current.onSwipe?.(d.m) }
  const springBack = () => { const p = peek.current; if (p?.drag) { p.drag = false; p.ret = true } }

  const drawn = useRef(null) // state last written to the meshes; skip work while idle
  useFrame((_, dt) => {
    let cur = queueRef.current[0]
    let mi = null, angle = 0
    if (cur && !cur.move) { // a pause between chunks of a demo
      cur.ms -= dt * 1000
      if (cur.ms <= 0) { queueRef.current.shift(); doneRef.current?.(null, stateRef.current, cur.tag) }
      cur = null
    } else if (cur) {
      mi = cur.mi ??= moveInfo(cur.move)
      if (cur.t == null) {
        cur.t = 0
        const p = peek.current // carry on from a matching drag or preview instead of snapping back
        if (p?.a && p.mi.axis === mi.axis && p.mi.layer === mi.layer && p.mi.dir === mi.dir) { cur.t = unease(Math.min(0.95, p.a / QUARTER)); peek.current = null }
        else if (!p?.drag) peek.current = null
        if (live.current.sound) sfx.turn()
      }
      idle.current = 0
      cur.t += (dt * 1000 * cur.speed) / TURN_MS
      if (cur.t >= 1) {
        stateRef.current = apply(stateRef.current, cur.move)
        queueRef.current.shift()
        mi = null
        doneRef.current?.(cur.move, stateRef.current, cur.tag)
      } else angle = (mi.dir * Math.PI) / 2 * ease(cur.t)
    } else if (peek.current) {
      const p = peek.current
      if (p.ret) { p.a *= Math.exp(-dt / 0.06); if (p.a < 0.002) peek.current = null } // critically damped settle
      else if (!p.drag) {
        p.t = p.hold ? Math.min(0.5, p.t + dt / 0.18 / 2) : p.t + dt / 0.5
        if (p.t >= 1) peek.current = null
        else p.a = calm ? 0 : NUDGE * Math.sin(Math.PI * p.t) // reduced motion: the layer lights up instead
      }
      if (peek.current && p.a) { mi = p.mi; angle = mi.dir * p.a }
    } else if (live.current.nudge && !calm && !drag.current) {
      idle.current += dt
      if (idle.current > 2.4) { idle.current = 0; peek.current = { mi: live.current.nudge, t: 0 } }
    }
    const pp = pop.current
    if (pp) { pp.t += dt / 0.36; if (pp.t >= pp.n) pop.current = null }
    const st = stateRef.current
    // the arrow: the next demo move (through its pause and its turn), else a held key's preview, else the hint
    const qu = queueRef.current
    let am = null
    for (let k = 0; k < qu.length; k++) if (qu[k].move) { if (qu[k].tag === 'demo') am = qu[k].mi ??= moveInfo(qu[k].move); break }
    if (!qu.length) { const p = peek.current; am = p && !p.drag && !p.ret ? p.mi : live.current.nudge }
    if (spin.current != null) am = null
    const sh = shown.current
    let key = -1
    if (am) { // draw it on the two faces of the layer that face the camera; a little hysteresis near the edge-on view
      const cp = get().camera.position, c1 = cp.getComponent(am.axis === 0 ? 1 : 0), c2 = cp.getComponent(am.axis === 2 ? 1 : 2)
      const keep = sh.mi === am
      sh.s1 = keep && Math.abs(c1) < 1 ? sh.s1 : c1 >= 0 ? 1 : -1
      sh.s2 = keep && Math.abs(c2) < 1 ? sh.s2 : c2 >= 0 ? 1 : -1
      sh.see1 = keep && Math.abs(Math.abs(c1) - Math.abs(c2)) < 1 ? sh.see1 : Math.abs(c1) > Math.abs(c2)
      key = ((((am.axis * 3 + (am.layer ?? 0) + 1) * 2 + (am.dir > 0 ? 1 : 0)) * 2 + (sh.s1 > 0 ? 1 : 0)) * 2 + (sh.s2 > 0 ? 1 : 0)) * 2 + (sh.see1 ? 1 : 0)
    }
    sh.mi = am
    if (key !== sh.key && arrowRoot.current) {
      sh.key = key; sh.fade = 0
      arrowRoot.current.clear()
      if (am) arrowRoot.current.add(arrow(key, am, sh.s1, sh.s2, sh.see1))
    }
    if (am && sh.fade < 1) { sh.fade = Math.min(1, sh.fade + dt / 0.2); ARROW_W.opacity = ARROW_K.opacity = sh.fade }
    // the arrow's layer is lit (reduced motion: brighter, since it doesn't wiggle)
    if (am !== lit.current.h || st !== lit.current.st) {
      lit.current = { h: am, st }
      for (let i = 0; i < st.length; i++) if (groups.current[i]) groups.current[i].children[0].material = am && inLayer(st[i], am) ? (calm ? BODY_HI : BODY_LIT) : BODY
    }
    if (swing.t < 1) { // camera glides to a preset view
      swing.t = calm ? 1 : Math.min(1, swing.t + dt / 0.8)
      const cam = get().camera
      cam.position.lerpVectors(swing.from, swing.to, ease(swing.t)).setLength(DIST)
      get().controls?.update()
    }
    if (mi || pp || drawn.current !== st) {
      if (mi) q.setFromAxisAngle(AXES[mi.axis], angle)
      for (let i = 0; i < st.length; i++) {
        const c = st[i], g = groups.current[i], o = c.o
        if (!g) continue
        g.position.set(c.p[0], c.p[1], c.p[2])
        m4.makeBasis(v[0].set(o[0][0], o[0][1], o[0][2]), v[1].set(o[1][0], o[1][1], o[1][2]), v[2].set(o[2][0], o[2][1], o[2][2]))
        g.quaternion.setFromRotationMatrix(m4)
        if (mi && inLayer(c, mi)) { g.position.applyQuaternion(q); g.quaternion.premultiply(q) }
        g.scale.setScalar(pp && pp.i === i ? 1 + Math.abs(Math.sin(Math.PI * pp.t)) * (pp.bad ? -0.14 : 0.24) : 1)
      }
      drawn.current = mi || pp ? null : st
    }
    if (spin.current != null && root.current) {
      spin.current = Math.min(1, spin.current + dt / 1.6)
      const e = ease(spin.current)
      root.current.rotation.y = e * Math.PI * 2
      root.current.scale.setScalar(1 + Math.sin(e * Math.PI) * 0.15)
      if (spin.current >= 1) { spin.current = null; root.current.rotation.y = 0 }
    }
  })

  return (
    <>
      <hemisphereLight args={['#ffffff', '#777777', 1.6]} />
      <directionalLight position={[4, 9, 6]} intensity={2.4} />
      <directionalLight position={[-6, 2, -3]} intensity={0.6} />
      <directionalLight position={[3, -8, 5]} intensity={1.1} /> {/* so the bottom still reads in its own colours when peeked at */}
      {/* static blob: render a few frames once the cubies are placed, then stop */}
      <ContactShadows position={[0, -2.35, 0]} scale={9} blur={2.6} opacity={0.45} far={4} resolution={256} frames={4} />
      <group>
        <group ref={root} onPointerDown={onDown}>
          {HOMES.map((c, i) => (
            <Cubie key={i} h={c.h} mode={show ? show(c) : 'full'} groupRef={el => { groups.current[i] = el }} />
          ))}
        </group>
        <group ref={arrowRoot} />
        {labels && <Labels />}
      </group>
      {/* polar limits: the cube can be peeked under but never ends up upside-down */}
      <OrbitControls makeDefault enablePan={false} enableZoom={false} enableDamping rotateSpeed={0.8} minPolarAngle={0.45} maxPolarAngle={2.3} 
        onStart={() => orbitFrom.copy(get().camera.position)} onEnd={() => { if (get().camera.position.distanceTo(orbitFrom) > 0.3) onOrbit?.() }} />
    </>
  )
}
function Swing({ swing, view, tick }) {
  const camera = useThree(s => s.camera)
  useEffect(() => { swing.from.copy(camera.position); swing.to.set(...VIEWS[view] ?? VIEWS.front); swing.t = 0 }, [swing, camera, view, tick])
  return null
}

// onSwipe(move) / onTap(cubie, index): pass null to switch off. nudge: move shown with the arrow (its layer lit and
// pulsing). view: camera preset ('front' | 'under'); reset: show a Reset view button once the player has orbited.
const Cube3D = forwardRef(function Cube3D({ onMoveDone, onSwipe, onTap, nudge, sound, show, celebrate, labels, className, view = 'front', reset }, ref) {
  const swing = useMemo(() => ({ t: 1, from: new THREE.Vector3(), to: new THREE.Vector3() }), [])
  const [tick, setTick] = useState(0), [moved, setMoved] = useState(false)
  useEffect(() => setMoved(false), [view])
  const stateRef = useRef(solved())
  const queueRef = useRef([])
  const doneRef = useRef(onMoveDone)
  const live = useRef({})
  const peek = useRef(null), pop = useRef(null)
  const nudgeMi = useMemo(() => (nudge ? moveInfo(nudge) : null), [nudge])
  useLayoutEffect(() => { doneRef.current = onMoveDone; live.current = { onSwipe, onTap, sound, nudge: nudgeMi } })
  useImperativeHandle(ref, () => ({
    reset(state) { stateRef.current = state; queueRef.current = []; peek.current = null },
    enqueue(moves, tag, speed = 1) { for (const move of moves) queueRef.current.push({ move, tag, speed }) },
    wait(ms, tag) { queueRef.current.push({ move: null, ms, tag }) },
    cancel() { queueRef.current.length = queueRef.current[0]?.t != null ? 1 : 0 }, // drop turns not yet started
    get settled() { return queueRef.current.reduce(step, stateRef.current) },
    peek(move, hold) { if (!queueRef.current.length) peek.current = { mi: moveInfo(move), t: 0, hold } },
    release() { if (peek.current) peek.current.hold = false },
    pop(i, bad, n = 1) { pop.current = { i, t: 0, bad, n } }, // n bounces
    get state() { return stateRef.current },
    get busy() { return queueRef.current.length > 0 },
  }), [])
  return (
    <div className={className}>
      <Canvas camera={{ position: [5.4, 4.5, 7.2], fov: 38 }} dpr={[1, 2]} gl={{ alpha: true }}>
        <Scene stateRef={stateRef} queueRef={queueRef} doneRef={doneRef} live={live} peek={peek} pop={pop} show={show} celebrate={celebrate} labels={labels}
          swing={swing} onOrbit={reset ? () => setMoved(true) : undefined} />
        <Swing swing={swing} view={view} tick={tick} />
      </Canvas>
      {reset && moved && <button className="btn alt small reset-view" onClick={() => { setTick(t => t + 1); setMoved(false) }}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden><path d={RESET} fill="currentColor" /></svg>Reset view</button>}
    </div>
  )
})
export default Cube3D
