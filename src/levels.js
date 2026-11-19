// Every setup and every claim in the copy below was checked against the cube model (see cube.test.js).
// Copy rules (tested): a bubble has at most 2 sentences of at most 12 words. "/" in a trick marks a chunk.
const rep = (a, n) => Array(n).fill(a).join(' / ')
const kind = h => h.filter(Boolean).length
const is = (x, y, z) => c => c.h[0] === x && c.h[1] === y && c.h[2] === z // piece by home: x red+/orange-, y white+/yellow-, z green+/blue-
export const WIGGLE = "R U R' U'"
export const FLIP = "F U' R U"
export const POP = "R' D' R D"
export const SLIDE_R = "U R U' R' / U' F' U F"
export const SLIDE_L = "U' L' U L / U F U' F'"
export const CROSS = "F / R U R' U' / F'"
export const SWAP = "R U R' U / R U2 R' / U"
export const RIDE = "U R U' L' / U R' U' L"

// world colours cycle through the cube faces; order keeps neighbours (in sequence and on the 3x3 map face) contrasting
const W = '#F4F4F0', R = '#C41E3A', O = '#FF5800', G = '#009B48', B = '#0046AD', Y = '#FFD500'

export const TRICKS = [
  { name: 'The Wiggle', alg: WIGGLE, use: 'Up, left, down, right' },
  { name: 'Edge flipper', alg: FLIP, use: 'White edge home but upside down' },
  { name: 'Corner popper', alg: POP, use: 'White corner under its home: pop until in' },
  { name: 'Slide right', alg: SLIDE_R, use: 'Middle edge goes right' },
  { name: 'Slide left', alg: SLIDE_L, use: 'Middle edge goes left' },
  { name: 'Cross maker', alg: CROSS, use: 'Yellow line or L to a yellow cross' },
  { name: 'Edge swap', alg: SWAP, use: 'Good pair at back and right' },
  { name: 'Corner carousel', alg: RIDE, use: 'Good corner at front-right' },
  { name: 'Corner twister', alg: POP, use: 'Pop until yellow is up, then turn only the top' },
]

const CROSS_G = { solved: 'cross' }, L1 = { solved: 'layer1' }, F2L = { solved: 'f2l' }
const YCROSS = { solved: 'f2l', up: 'yEdges' }, YEDGE = { solved: 'f2lE' }
const YPLACE = { solved: 'f2lE', placed: 'yCorners' }, ALL = { solved: 'all' }
const STUCK = 'Stuck? Tap Help and I will show you.'

export const WORLDS = [
  {
    name: 'Meet the cube', color: W, goal: ALL, levels: [
      { type: 'tour', title: 'Hello, cube', steps: [
        { alg: 'R', say: ["Hi! I'm Pip, a corner from this cube.", 'See the white arrow? Swipe the cube that way.'] },
        { alg: 'U', say: ['Now the top row is mixed up.', 'Follow the arrow to fix it!'] },
        { alg: "R'", say: ['Some turns go the other way.', 'Look closely at the arrow!'] },
        { alg: "U'", say: ["Last one. You've got this!"] },
      ] },
      { type: 'follow', title: 'Three turns', seq: 'R U F', say: ['Three turns in a row.', 'Follow the arrow each time.'] },
      { type: 'follow', title: 'Other way', seq: "F' U' R'", say: ['Now everything goes the other way.', 'Watch the arrows!'] },
      { type: 'tour', title: 'Meet the pieces', steps: [
        { tap: c => kind(c.h) === 1, say: ['A solved cube has one colour on each side.', 'Every side has a middle piece. Tap one!'] },
        { tap: c => kind(c.h) === 2, say: ['Middle pieces always stay in the middle.', 'Edges have two colours. Tap an edge!'] },
        { tap: c => kind(c.h) === 3, say: ['Corners have three colours, like me. Tap a corner!'] },
        { tap: is(0, 1, 1), say: ['Every piece has its own colours.', 'Find the white and green edge. Tap it!'] },
        { tap: is(1, 1, 1), say: ['Now find the white, green and red corner.'] },
      ] },
      { type: 'goal', title: 'Fix it', alg: "R'", say: ['Oh no, someone turned one side!', 'Make every side one colour again.', STUCK] },
      { type: 'tour', title: 'Secret code', code: true, steps: [
        { say: ['Psst! Cubers use a secret code.', 'Each side of the cube has a letter.'] },
        { tap: c => c.p[0] === 1, say: ['R is the right side. Tap a piece on R!'] },
        { tap: c => c.p[1] === 1, say: ['U is the up side, on top. Tap it!'] },
        { say: ['F is front and L is left.', 'D is down and B is back.'] },
        { alg: "R'", say: ['A little mark means the other way.', 'R’ means: turn the right side back. Try it!'] },
      ] },
      { type: 'goal', title: 'Undo it', alg: "U' R'", say: ['Someone did R, then U.', 'Undo the last one first!'] },
      { type: 'follow', title: 'All six sides', seq: "L D B / L' D' B'", say: ['Left, down and back turn too.', 'Follow the arrows!'] },
      { type: 'follow', title: 'The Wiggle', seq: WIGGLE, say: ['This is the Wiggle. Cubers love it!', 'Up, left, down, right. Say it as you go!'] },
      { type: 'goal', title: 'Wiggle loop', alg: rep(WIGGLE, 2), say: ['Someone did the Wiggle a few times.', 'Keep wiggling until it is fixed!'] },
    ],
  },
  {
    name: 'White cross', color: B, goal: CROSS_G, levels: [
      { type: 'tour', title: 'White cross', steps: [
        { say: ["Let's build a white cross on top!", "Grey pieces don't matter yet."] },
        { setup: 'F', tap: is(0, 1, 1), say: ['Find the white and green edge.', "It's in the middle row. Tap it!"] },
        { alg: 'F', say: ['One front turn lifts it home.', 'Follow the arrow!'] },
        { alg: 'F2', say: ["Now it's on the bottom, right under its home.", 'Two turns bring it up.'] },
        { alg: FLIP, say: ['Home, but the white faces the front?', 'Use the Edge flipper!'] },
      ] },
      { type: 'goal', title: 'Lift off', alg: 'F', say: ['The white and green edge is in the middle row.', 'Lift it home!'] },
      { type: 'goal', title: 'From below', alg: 'F2', say: ['The edge fell to the bottom.', "It's right under its home."] },
      { type: 'goal', title: 'Flipped!', alg: FLIP, say: ["It's home, but upside down.", 'Use the Edge flipper!'] },
      { type: 'goal', title: 'Lost edges', alg: "D R' F L2 B'", say: ['All four white edges are lost!', 'Bring them home one by one.', STUCK] },
    ],
  },
  {
    name: 'White corners', color: R, goal: L1, levels: [
      { type: 'tour', title: 'Corner popper', steps: [
        { say: ['Now finish the white side.', 'Keep white on top.'] },
        { setup: POP, tap: is(1, 1, 1), say: ['Find the white, green and red corner. Tap it!'] },
        { alg: POP, say: ["It's right under its home.", 'Use the Corner popper!'] },
        { alg: rep(POP, 3), say: ['White faces down? Keep popping.', 'It always comes home!'] },
        { alg: `D / ${POP}`, say: ['Not under its home? Turn the bottom first.', 'Then pop it in.'] },
      ] },
      { type: 'goal', title: 'Pop it in', alg: POP, say: ['The corner is right under its home.', 'Pop it in!'] },
      { type: 'goal', title: 'Keep popping', alg: rep(POP, 3), say: ['White faces down this time.', 'Keep popping until it is home!'] },
      { type: 'goal', title: 'Line it up', alg: `D / ${POP}`, say: ['The corner is on the bottom, front-left.', 'Turn the bottom first. Then pop!'] },
      { type: 'goal', title: 'Twisted', alg: rep(POP, 2), say: ['The corner is home, but twisted.', 'Keep popping until white is on top.'] },
      { type: 'goal', title: 'Two to go', alg: `${POP} / y / D2 / ${POP}`, say: ['Two corners left! Pop the first one in.', 'Then turn the cube to find the next.'] },
    ],
  },
  {
    name: 'Middle row', color: G, pre: 'x2', goal: F2L, levels: [
      { type: 'tour', title: 'Slide right', steps: [
        { view: 'under', say: ['Flip time! Yellow is on top now.', 'Peek underneath: the white side is done!'] },
        { setup: SLIDE_R, tap: is(1, 0, -1), say: ['This red and blue edge goes in the middle row.', 'Tap it!'] },
        { alg: "U R U' R'", say: ['The Slide right trick has two parts.', 'Here is part one.'] },
        { alg: "U' F' U F", say: ['Now part two!'] },
        { alg: SLIDE_R, say: ['Now both parts together. Slide right!'] },
      ] },
      { type: 'goal', title: 'Go right', alg: SLIDE_R, say: ['Blue is in front, red is on top.', 'Red lives on the right. Slide right!'] },
      { type: 'tour', title: 'Slide left', steps: [
        { alg: "U' L' U L", say: ['Slide left is the mirror trick.', 'Here is part one.'] },
        { alg: "U F U' F'", say: ['Now part two!'] },
        { alg: SLIDE_L, say: ['Both parts together. Slide left!'] },
      ] },
      { type: 'goal', title: 'Go left', alg: SLIDE_L, say: ['Blue is in front, orange is on top.', 'Orange lives on the left. Slide left!'] },
      { type: 'goal', title: 'Line up first', alg: `U2 / ${SLIDE_R}`, say: ['The red and blue edge is at the back.', 'Turn the top to bring it front. Then slide!'] },
      { type: 'goal', title: 'Stuck edge', alg: `${SLIDE_R} / U2 / ${SLIDE_R}`, say: ['The edge is in its spot, but flipped.', 'Slide right kicks it out. Then try again!'] },
    ],
  },
  {
    name: 'Yellow cross', color: Y, pre: 'x2', goal: YCROSS, levels: [
      { type: 'tour', title: 'Cross maker', steps: [
        { say: ['Make a yellow cross on top.', 'Only the edges count. Corners are grey.'] },
        { alg: CROSS, say: ['See the yellow line, left to right?', 'Front, the Wiggle, then front back. Cross maker!'] },
        { alg: rep(CROSS, 2), say: ['A yellow L? Point it to the back-left.', 'Then do the Cross maker twice.'] },
      ] },
      { type: 'goal', title: 'Line', alg: CROSS, say: ['A yellow line, left to right.', 'One Cross maker makes the cross!'] },
      { type: 'goal', title: 'L shape', alg: rep(CROSS, 2), say: ['A yellow L at the back-left.', 'Do the Cross maker twice.'] },
      { type: 'goal', title: 'Dot', alg: `${CROSS} / U2 / ${CROSS} / ${CROSS}`, say: ['Just a yellow dot. One Cross maker makes an L.', 'Point the L to the back-left. Then two more!'] },
    ],
  },
  {
    name: 'Yellow edges', color: B, pre: 'x2', goal: YEDGE, levels: [
      { type: 'tour', title: 'Edge swap', steps: [
        { say: ['Now each yellow edge must match its side.', 'Turn the top until two match.'] },
        { alg: "R U R' U", say: ['The Edge swap has three parts.', 'Here is part one.'] },
        { alg: "R U2 R'", say: ['Now part two!'] },
        { alg: SWAP, say: ['All together, then one more top turn.', 'Edge swap!'] },
      ] },
      { type: 'goal', title: 'Swap', alg: SWAP, say: ['Back and right already match.', 'Front and left are swapped. Edge swap!'] },
      { type: 'goal', title: 'Find the pair', alg: `U2 / ${SWAP}`, say: ['Nothing matches yet.', 'Turn the top until back and right match.'] },
      { type: 'goal', title: 'Opposites', alg: `U' / ${SWAP} / U2 / ${SWAP}`, say: ["Front and back match. Left and right don't.", 'Swap once, then find a pair.'] },
    ],
  },
  {
    name: 'Corners home', color: O, pre: 'x2', goal: YPLACE, levels: [
      { type: 'tour', title: 'Corner carousel', steps: [
        { say: ['Now move each yellow corner to its home.', 'Twisted is OK for now!'] },
        { say: ['A corner is home when it matches the sides around it.'] },
        { alg: "U R U' L'", say: ['The Corner carousel has two parts.', 'Here is part one.'] },
        { alg: "U R' U' L", say: ['Now part two!'] },
        { alg: RIDE, say: ['Together! The front-right corner stays home.', 'The other three take a ride.'] },
      ] },
      { type: 'goal', title: 'Carousel', alg: RIDE, say: ['The front-right corner is home.', 'Send the other three for a ride!'] },
      { type: 'goal', title: 'Other way', alg: rep(RIDE, 2), say: ['Front-right is home again.', 'The others go the other way. Ride twice!'] },
      { type: 'goal', title: 'None home', alg: `${RIDE} / y / ${RIDE}`, say: ['No corner is home yet. One ride puts one home.', 'Turn the cube to bring it front-right. Ride again!'] },
    ],
  },
  {
    name: 'Corner twist', color: G, pre: 'x2', goal: ALL, levels: [
      { type: 'tour', title: 'Corner twister', steps: [
        { say: ['Last step! Make the yellow corners face up.', 'Hold a twisted corner at front-right.'] },
        { alg: rep(POP, 2), say: ['Pop until yellow is on top.', "The bottom gets messy. Don't worry!"] },
        { view: 'under', say: ['See? The bottom fixed itself!', 'Next time, turn only the top between pops.'] },
      ] },
      { type: 'goal', title: 'Two pops', alg: rep(POP, 2), say: ['One corner is twisted.', 'Pop until yellow is on top!'] },
      { type: 'goal', title: 'Two twists', alg: `${rep(POP, 2)} / U / ${rep(POP, 4)} / U'`, say: ['Front-right and back-right are twisted.', 'Pop, turn the top, pop again.'] },
      { type: 'goal', title: 'Three twists', alg: `${rep(POP, 2)} / U / ${rep(POP, 2)} / U / ${rep(POP, 2)} / U2`, say: ['Three twisted corners! Pop, turn the top, repeat.', 'Then turn the top to line it all up.'] },
    ],
  },
  {
    name: 'Solve it all', color: W, goal: ALL, levels: [
      { type: 'boss', title: 'The real thing', say: ['A real mixed-up cube. You can do it!', 'Use every trick you know. Help is here.'] },
    ],
  },
]

// flatten with ids + inherited pre/goal; letters: the secret code has been taught by this level
let code = false
export const LEVELS = WORLDS.flatMap((w, wi) => w.levels.map((l, li) => Object.assign(l, {
  id: `${wi + 1}-${li + 1}`, world: wi, pre: l.pre ?? w.pre ?? '', goal: l.goal ?? w.goal, letters: (code ||= !!l.code),
})))
