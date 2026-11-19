// Every setup below was checked against the cube model (see cube.test.js).
const rep = (a, n) => Array(n).fill(a).join(' ')
const kind = h => h.filter(Boolean).length
const is = (x, y, z) => c => c.h[0] === x && c.h[1] === y && c.h[2] === z // piece by home: x red+/orange-, y white+/yellow-, z green+/blue-
export const TRIG = "R U R' U'"
export const T = "R' D' R D"
export const RIGHT = "U R U' R' U' F' U F"
export const LEFT = "U' L' U L U F U' F'"
export const A = "F R U R' U' F'"
export const S = "R U R' U R U2 R' U"
export const C = "U R U' L' U R' U' L"

// world colours cycle through the cube faces; order keeps neighbours (in sequence and on the 3x3 map face) contrasting
const W = '#F4F4F0', R = '#C41E3A', O = '#FF5800', G = '#009B48', B = '#0046AD', Y = '#FFD500'

export const ALGS = [
  { name: 'Trigger', alg: TRIG, use: 'Warm-up move' },
  { name: 'Edge flip', alg: "F U' R U", use: 'White edge in place but flipped' },
  { name: 'T', alg: T, use: 'White corner under its slot: repeat until in' },
  { name: 'Right insert', alg: RIGHT, use: 'Middle edge goes to front-right' },
  { name: 'Left insert', alg: LEFT, use: 'Middle edge goes to front-left' },
  { name: 'A', alg: A, use: 'Yellow cross (line left-right, L at back-left)' },
  { name: 'S', alg: S, use: 'Swap yellow edges (good pair at back + right)' },
  { name: 'C', alg: C, use: 'Cycle yellow corners (good one at front-right)' },
  { name: 'T again', alg: T, use: 'Twist yellow corners: repeat, then U only' },
]

const CROSS = { solved: 'cross' }, L1 = { solved: 'layer1' }, F2L = { solved: 'f2l' }
const YCROSS = { solved: 'f2l', up: 'yEdges' }, YEDGE = { solved: 'f2lE' }
const YPLACE = { solved: 'f2lE', placed: 'yCorners' }, ALL = { solved: 'all' }

export const WORLDS = [
  {
    name: 'Meet the cube', color: W, goal: ALL, levels: [
      { type: 'tour', title: 'Hello, cube', steps: [
        { text: "This is a Rubik's cube. Drag the background to look around. When it's solved, every face has one colour." },
        { tap: c => kind(c.h) === 1, text: 'The piece in the middle of each face is a center. Tap a center.' },
        { tap: c => kind(c.h) === 2, text: 'Centers never move: white is always opposite yellow. Edges sit between them and have 2 colours. Tap an edge.' },
        { tap: c => kind(c.h) === 3, text: 'Corners have 3 colours. Tap a corner.' },
        { tap: is(0, 1, 1), text: 'Every piece has its own colours. Tap the white-green edge.' },
        { tap: is(1, 1, 1), text: 'Now tap the corner that is white, green and red.' },
        { tap: c => c.p[0] === 1, text: 'Each face has a letter. R is the right face, the one with the red center. Tap any piece on R.' },
        { tap: c => c.p[1] === 1, text: 'U is the up face. Tap a piece on U. The others: F front, L left, D down, B back.' },
        { alg: 'R', text: 'R means: turn the right face clockwise, as if you were looking straight at it.' },
        { alg: "R'", text: "A ' (say \"prime\") means the other way. R' turns the right face counter-clockwise." },
        { alg: 'U2', text: 'A 2 means turn twice. U2 turns the top face two times.' },
      ] },
      { type: 'follow', title: 'First turns', seq: 'R U F', text: 'Swipe or press the highlighted move. R = right, U = up, F = front.' },
      { type: 'follow', title: 'Prime time', seq: "R' U' F'", text: "Now the other way round. ' means counter-clockwise." },
      { type: 'follow', title: 'The other faces', seq: "L D B L' D' B'", text: 'L = left, D = down, B = back. Then undo them!' },
      { type: 'goal', title: 'Undo it', alg: "U' R'", text: 'Someone did R, then U. To undo: reverse the order and the direction. Undo the last move first.' },
      { type: 'follow', title: 'The trigger', seq: TRIG, text: "R U R' U' is the most famous move in cubing. Learn it by heart!" },
      { type: 'goal', title: 'Trigger loop', alg: rep(TRIG, 2), text: "Someone did the trigger a few times. Keep doing R U R' U' until the cube is solved again." },
    ],
  },
  {
    name: 'White cross', color: B, goal: CROSS, levels: [
      { type: 'tour', title: 'Cross basics', steps: [
        { text: 'Goal: a white cross on top. Each white edge must also match the center next to it. Grey pieces don\'t matter yet.' },
        { setup: 'F', tap: is(0, 1, 1), text: 'Find the white-green edge: it belongs on top, above the green center. Tap it.' },
        { alg: 'F', text: 'Edge stuck in the middle layer? One turn of its face lifts it up. Here: F.' },
        { alg: 'F2', text: 'Edge on the bottom, right under its spot? Turn that face twice. Here: F2.' },
        { alg: "F U' R U", text: "Edge in its spot but flipped (white facing you)? Do F U' R U." },
      ] },
      { type: 'goal', title: 'Lift off', alg: 'F', text: 'The white-green edge is in the middle layer, front-left. One turn brings it home.' },
      { type: 'goal', title: 'From below', alg: 'F2', text: 'The white-green edge fell to the bottom, right under its spot.' },
      { type: 'goal', title: 'Flipped!', alg: "F U' R U", text: 'The white-green edge is home but flipped: white faces front. Use the fix from the tour.' },
      { type: 'goal', title: 'Lost edges', alg: "D R' F L2 B'", text: 'All four white edges are out: two on the bottom, two in the middle layer. Bring them home one by one.' },
    ],
  },
  {
    name: 'White corners', color: R, goal: L1, levels: [
      { type: 'tour', title: 'Corner trick', steps: [
        { text: 'Now finish the white layer. Keep white on top. Grey pieces don\'t matter.' },
        { setup: T, tap: is(1, 1, 1), text: 'The white-green-red corner belongs in the top front-right slot. Find it and tap it.' },
        { alg: T, text: "Find a white corner in the bottom layer, right under the spot where it belongs (front-right). Repeat T = R' D' R D until it pops in." },
        { alg: `D ${T}`, text: 'Not under its spot? Turn D first to line it up, then T.' },
        { alg: rep(T, 2), text: 'In its spot but twisted? T pulls it down. Keep repeating T until white faces up.' },
      ] },
      { type: 'goal', title: 'Pop it in', alg: T, text: 'The white-green-red corner is under its slot (bottom, front-right). Do T until it\'s home.' },
      { type: 'goal', title: 'Keep going', alg: rep(T, 3), text: 'Same corner, but white faces down. Repeat T. It takes a few more this time.' },
      { type: 'goal', title: 'Line it up', alg: `D ${T}`, text: 'The corner is at bottom-front-left. Turn D to bring it under its slot, then T.' },
      { type: 'goal', title: 'Twisted', alg: rep(T, 2), text: 'The corner is in its slot but twisted (white faces right). Repeat T until white is on top.' },
      { type: 'goal', title: 'Two to go', alg: `${T} y D2 ${T}`, text: 'Two corners left. One is under the front-right slot: T it in. Then turn the cube (y), line the other one up with D, and T again.' },
    ],
  },
  {
    name: 'Middle layer', color: G, pre: 'x2', goal: F2L, levels: [
      { type: 'tour', title: 'Flip and insert', steps: [
        { text: 'Flip time! Yellow is on top now and the white layer is at the bottom. Next: the 4 middle-layer edges.' },
        { text: 'Find a top edge with no yellow on it. Turn U until its front colour matches the front center.' },
        { setup: RIGHT, tap: is(1, 0, -1), text: 'This red-blue edge belongs in the front-right slot of the middle layer. Tap it.' },
        { alg: RIGHT, text: `Does its top colour match the right center? Do the right insert: ${RIGHT}.` },
        { alg: LEFT, text: `Matches the left center? Do the left insert: ${LEFT}.` },
      ] },
      { type: 'goal', title: 'Go right', alg: RIGHT, text: 'Top-front edge: blue faces front (matches the blue center), red on top matches the right center. Use the right insert.' },
      { type: 'goal', title: 'Go left', alg: LEFT, text: 'Top-front edge: blue in front, orange on top matches the left center. Use the left insert.' },
      { type: 'goal', title: 'Line up first', alg: `U2 ${RIGHT}`, text: 'The edge is at the back. Turn U2 to bring it to the front, then do the right insert.' },
      { type: 'goal', title: 'Stuck edge', alg: `${RIGHT} U2 ${RIGHT}`, text: 'The red-blue edge is in its slot but flipped. The right insert kicks it up to the back. U2 brings it to the front. Then the right insert again.' },
    ],
  },
  {
    name: 'Yellow cross', color: Y, pre: 'x2', goal: YCROSS, levels: [
      { type: 'tour', title: 'Dot, L, line', steps: [
        { text: 'Make a yellow cross on top. Only the yellow stickers on the edges count. Corners are grey: ignore them.' },
        { alg: A, text: `Line: hold it left to right and do A = ${A}.` },
        { alg: rep(A, 2), text: 'L shape: turn U so it points to the back-left (like 9 and 12 on a clock). Then A twice.' },
        { alg: `${A} U2 ${A} ${A}`, text: 'Dot: do A once to get an L. Turn U to point it back-left, then A twice.' },
      ] },
      { type: 'goal', title: 'Line', alg: A, text: 'A yellow line, left to right. One A makes the cross.' },
      { type: 'goal', title: 'L shape', alg: rep(A, 2), text: 'A yellow L at the back-left. Do A twice.' },
      { type: 'goal', title: 'Dot', alg: `${A} U2 ${A} ${A}`, text: 'Just a dot. A once gives an L (front-right here). U2 points it back-left, then A twice.' },
    ],
  },
  {
    name: 'Yellow edges', color: B, pre: 'x2', goal: YEDGE, levels: [
      { type: 'tour', title: 'Match the sides', steps: [
        { text: "Now each yellow edge's side colour must match its center. Turn U until two of them match." },
        { alg: S, text: `Two neighbours match? Hold them at back and right. Do S = ${S}.` },
        { alg: `U' ${S} U2 ${S}`, text: "Two opposite ones match? Do S once (here after U'). Then U until a neighbour pair matches at back + right, and S again." },
      ] },
      { type: 'goal', title: 'Swap', alg: S, text: 'Back and right match their centers. Front and left are swapped. Do S.' },
      { type: 'goal', title: 'Find the pair', alg: `U2 ${S}`, text: 'Nothing lines up yet. Turn U until two neighbours match at back and right, then S.' },
      { type: 'goal', title: 'Opposites', alg: `U' ${S} U2 ${S}`, text: "Front and back match, left and right are swapped. S only fixes neighbours: do U', then S. Now U2 lines up a pair at back + right. S again." },
    ],
  },
  {
    name: 'Place yellow corners', color: O, pre: 'x2', goal: YPLACE, levels: [
      { type: 'tour', title: 'Corner shuffle', steps: [
        { text: 'Put each yellow corner in its spot. A corner is in its spot when its 3 colours match the 3 centers around it, even if it is twisted.' },
        { alg: C, text: `Hold a corner that's already in its spot at front-right. Do C = ${C}. The other three swap around.` },
        { alg: `${C} y ${C}`, text: 'No corner in its spot? Do C once and one will be. Turn the cube (y) to put it front-right, then C again.' },
      ] },
      { type: 'goal', title: 'Three-Cycle', alg: C, text: 'The front-right corner is already in its spot. C cycles the other three home.' },
      { type: 'goal', title: 'Other way', alg: rep(C, 2), text: 'Front-right is in its spot again, but the others need to go the other way round. Do C twice.' },
      { type: 'goal', title: 'None home', alg: `${C} y ${C}`, text: 'No corner is in its spot. Do C once: one lands home at back-right. Turn the cube (y) to bring it front-right, then C again.' },
    ],
  },
  {
    name: 'Twist yellow corners', color: G, pre: 'x2', goal: ALL, levels: [
      { type: 'tour', title: 'Trust the twist', steps: [
        { text: 'Last step! Yellow on top. Put a twisted corner at front-right.' },
        { alg: `${rep(T, 2)} U ${rep(T, 4)} U'`, text: 'Repeat T until that corner shows yellow on top. Then turn only U to bring the next one to front-right, and repeat T. Finally turn U to line up the top.' },
        { text: 'Never rotate the whole cube in this step. The bottom will look scrambled half-way. Trust it: it fixes itself!' },
      ] },
      { type: 'goal', title: 'Two twists', alg: `${rep(T, 2)} U ${rep(T, 4)} U'`, text: 'Front-right and back-right corners are twisted. T until yellow is up, U, T until yellow is up, then U\'.' },
      { type: 'goal', title: 'Three twists', alg: `${rep(T, 2)} U ${rep(T, 2)} U ${rep(T, 2)} U2`, text: 'Three twisted corners: front-right, back-right, back-left. T, U, T, U, T, then U2 to line up.' },
    ],
  },
  {
    name: 'Full solve', color: W, goal: ALL, levels: [
      { type: 'boss', title: 'The real thing', text: 'A real scramble. Solve it with everything you learned.' },
    ],
  },
]

// flatten with ids + inherited pre/goal
export const LEVELS = WORLDS.flatMap((w, wi) => w.levels.map((l, li) => Object.assign(l, {
  id: `${wi + 1}-${li + 1}`, world: wi, pre: l.pre ?? w.pre ?? '', goal: l.goal ?? w.goal,
})))
