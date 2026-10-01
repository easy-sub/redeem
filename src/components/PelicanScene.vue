<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { Pause, Play } from '@lucide/vue'

const scene = ref(null)
const playing = ref(true)
const NS = 'http://www.w3.org/2000/svg'
const TAU = Math.PI * 2
const BB = { x: 170, y: 12 }
const HIP = { x: 118, y: -140 }
const CRANK = 32
const THIGH = 115
const SHIN = 125
const ROAD_V = 7 * 72

let frame = 0
let last = 0
let elapsed = 0
let mediaQuery
let userOverride = false
let clouds = []

const el = (id) => scene.value.querySelector(`#${id}`)

function makeSpokes(group) {
  for (let k = 0; k < 8; k++) {
    const angle = k * TAU / 8
    const line = document.createElementNS(NS, 'line')
    line.setAttribute('x1', '0')
    line.setAttribute('y1', '0')
    line.setAttribute('x2', (61 * Math.cos(angle)).toFixed(2))
    line.setAttribute('y2', (61 * Math.sin(angle)).toFixed(2))
    line.setAttribute('stroke', '#a9b2ba')
    line.setAttribute('stroke-width', '2.6')
    group.appendChild(line)
  }
}

function buildScenery() {
  makeSpokes(el('spokesBack'))
  makeSpokes(el('spokesFront'))

  for (let i = -1; i < 9; i++) {
    const mark = document.createElementNS(NS, 'rect')
    mark.setAttribute('x', i * 130)
    mark.setAttribute('y', '472')
    mark.setAttribute('width', '58')
    mark.setAttribute('height', '7')
    mark.setAttribute('rx', '3.5')
    el('lane').appendChild(mark)
  }

  const tufts = [
    'M0,0C-3,-13-7,-22-12,-30M0,0C0,-15 1,-25 4,-35M0,0C4,-12 9,-20 14,-27',
    'M0,0C-4,-11-9,-18-15,-24M0,0C-1,-14 1,-23 6,-33M0,0C5,-13 10,-19 15,-24',
    'M0,0C-2,-12-5,-21-9,-31M0,0C1,-16 3,-26 3,-37M0,0C4,-11 8,-18 12,-26',
  ]
  const grass = el('grassG')
  for (let i = 0; i < 8; i++) {
    const group = document.createElementNS(NS, 'g')
    group.setAttribute('transform', `translate(${i * 175},586)`)
    const path = document.createElementNS(NS, 'path')
    path.setAttribute('d', tufts[i % 3])
    path.setAttribute('fill', 'none')
    path.setAttribute('stroke', '#3f8f33')
    path.setAttribute('stroke-width', '3.6')
    path.setAttribute('stroke-linecap', 'round')
    group.appendChild(path)
    if (i % 3 === 1) {
      for (const [radius, color] of [[4.5, '#ff96ad'], [1.9, '#fff3b0']]) {
        const flower = document.createElementNS(NS, 'circle')
        flower.setAttribute('cx', '6')
        flower.setAttribute('cy', '-33')
        flower.setAttribute('r', radius)
        flower.setAttribute('fill', color)
        group.appendChild(flower)
      }
    }
    grass.appendChild(group)
  }

  clouds = Array.from(scene.value.querySelectorAll('.cloud'), (group) => ({
    group,
    x: Number(group.dataset.x),
    y: Number(group.dataset.y),
    speed: Number(group.dataset.v),
    scale: Number(group.dataset.s),
  }))
}

function legPoints(theta) {
  const px = BB.x + CRANK * Math.cos(theta)
  const py = BB.y + CRANK * Math.sin(theta)
  let dx = px - HIP.x
  let dy = py - HIP.y
  let distance = Math.hypot(dx, dy) || 1e-6
  const limited = Math.min(Math.max(distance, Math.abs(THIGH - SHIN) + 1), THIGH + SHIN - 1)
  dx *= limited / distance
  dy *= limited / distance
  distance = limited
  const a = (THIGH ** 2 - SHIN ** 2 + distance ** 2) / (2 * distance)
  const h = Math.sqrt(Math.max(0, THIGH ** 2 - a ** 2))
  const ux = dx / distance
  const uy = dy / distance
  const mx = HIP.x + a * ux
  const my = HIP.y + a * uy
  let kx = mx + h * uy
  let ky = my - h * ux
  const otherX = mx - h * uy
  const otherY = my + h * ux
  if (otherX > kx) { kx = otherX; ky = otherY }
  return `${HIP.x},${HIP.y} ${kx.toFixed(1)},${ky.toFixed(1)} ${px.toFixed(1)},${py.toFixed(1)}`
}

function render(t, dt) {
  const phase = t * 2.6
  const nx = BB.x + CRANK * Math.cos(phase)
  const ny = BB.y + CRANK * Math.sin(phase)
  const fx = BB.x - CRANK * Math.cos(phase)
  const fy = BB.y - CRANK * Math.sin(phase)

  el('crankFar').setAttribute('x2', fx.toFixed(1))
  el('crankFar').setAttribute('y2', fy.toFixed(1))
  el('pedalFar').setAttribute('x', (fx - 13).toFixed(1))
  el('pedalFar').setAttribute('y', (fy - 4).toFixed(1))
  el('crankNear').setAttribute('x2', nx.toFixed(1))
  el('crankNear').setAttribute('y2', ny.toFixed(1))
  el('pedalNear').setAttribute('x', (nx - 14).toFixed(1))
  el('pedalNear').setAttribute('y', (ny - 4.5).toFixed(1))
  el('legNear').setAttribute('points', legPoints(phase))
  el('legFar').setAttribute('points', legPoints(phase + Math.PI))
  el('footNear').setAttribute('cx', (nx + 11).toFixed(1))
  el('footNear').setAttribute('cy', (ny + 3).toFixed(1))
  el('footFar').setAttribute('cx', (fx + 11).toFixed(1))
  el('footFar').setAttribute('cy', (fy + 3).toFixed(1))

  const bob = 2.1 * Math.sin(2 * phase) + 0.8 * Math.sin(3.13 * phase + 1)
  el('ride').setAttribute('transform', `translate(300 ${(428 + bob).toFixed(2)})`)
  el('shadow').setAttribute('rx', (236 - 4 * bob).toFixed(1))
  el('shadow').setAttribute('opacity', (0.18 - 0.004 * bob).toFixed(3))
  const wheelDegrees = ((t * 7 * 180 / Math.PI) % 360).toFixed(1)
  el('spokesBack').setAttribute('transform', `rotate(${wheelDegrees})`)
  el('spokesFront').setAttribute('transform', `rotate(${wheelDegrees})`)
  el('chainTop').setAttribute('stroke-dashoffset', (-(t * 46) % 7).toFixed(2))
  el('chainBottom').setAttribute('stroke-dashoffset', ((t * 46) % 7).toFixed(2))
  el('head').setAttribute('transform', `rotate(${(2.4 * Math.sin(phase + 0.6)).toFixed(2)} 250 -288)`)
  el('tail').setAttribute('transform', `rotate(${(3.5 * Math.sin(phase * 0.9 + 2)).toFixed(2)} 100 -168)`)
  el('scarfTail').setAttribute('transform', `rotate(${(9 * Math.sin(t * 2.3 + 1)).toFixed(2)})`)
  el('fish').setAttribute('transform', `translate(349 ${(-138 + 2.6 * Math.sin(t * 3.1)).toFixed(1)})`)
  el('lane').setAttribute('transform', `translate(${-((t * ROAD_V) % 130).toFixed(1)} 0)`)
  el('grassG').setAttribute('transform', `translate(${-((t * ROAD_V * 1.12) % 175).toFixed(1)} 0)`)
  el('trees').setAttribute('transform', `translate(${-((t * ROAD_V * 0.16) % 1300).toFixed(1)} 0)`)
  for (const cloud of clouds) {
    cloud.x -= cloud.speed * dt
    if (cloud.x < -320) cloud.x += 1300
    cloud.group.setAttribute('transform', `translate(${cloud.x.toFixed(1)} ${cloud.y}) scale(${cloud.scale})`)
  }
}

function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  elapsed += dt
  render(elapsed, dt)
  frame = requestAnimationFrame(tick)
}

function syncPlayback() {
  cancelAnimationFrame(frame)
  frame = 0
  if (playing.value) {
    last = performance.now()
    frame = requestAnimationFrame(tick)
  }
}

function togglePlayback() {
  userOverride = true
  playing.value = !playing.value
  syncPlayback()
}

function handleMotionChange() {
  if (userOverride) return
  playing.value = !mediaQuery.matches
  syncPlayback()
}

onMounted(() => {
  buildScenery()
  render(0, 0)
  mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  mediaQuery.addEventListener('change', handleMotionChange)
  playing.value = !mediaQuery.matches
  syncPlayback()
})

onUnmounted(() => {
  cancelAnimationFrame(frame)
  mediaQuery?.removeEventListener('change', handleMotionChange)
})
</script>

<template>
  <div class="scene-wrap" :class="{ 'is-playing': playing }">
    <svg ref="scene" viewBox="0 0 960 600" xmlns="http://www.w3.org/2000/svg" role="img"
      aria-label="白色鹈鹕系着红围巾骑自行车，车轮旋转、双腿踩踏板，树和草向后掠过">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#79c6ee"/><stop offset=".75" stop-color="#cfeefb"/><stop offset="1" stop-color="#eef9ff"/></linearGradient>
        <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e7e3d4"/></linearGradient>
        <linearGradient id="beakGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffc233"/><stop offset="1" stop-color="#fb8b24"/></linearGradient>
        <linearGradient id="pouchGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f9a03f"/><stop offset="1" stop-color="#e56b2c"/></linearGradient>
        <g id="treeA"><rect x="-5" y="-42" width="10" height="42" rx="3" fill="#8a6238"/><circle cx="0" cy="-64" r="27" fill="#5aa84e"/><circle cx="21" cy="-47" r="18" fill="#4e9a45"/><circle cx="-21" cy="-49" r="16" fill="#4e9a45"/></g>
        <g id="treeB"><rect x="-4" y="-34" width="8" height="34" rx="3" fill="#936c40"/><circle cx="0" cy="-52" r="21" fill="#63b356"/><circle cx="16" cy="-38" r="14" fill="#56a54a"/><circle cx="-17" cy="-40" r="13" fill="#56a54a"/></g>
      </defs>

      <rect width="960" height="600" fill="url(#sky)"/>
      <circle class="sun-glow" cx="852" cy="96" r="58" fill="#ffd75e" opacity=".4"/>
      <circle cx="852" cy="96" r="40" fill="#ffd257"/>
      <g fill="#ffffff" opacity=".92">
        <g class="cloud" data-x="140" data-y="92" data-v="13" data-s="1.25" transform="translate(140 92) scale(1.25)"><ellipse cx="0" cy="0" rx="38" ry="15"/><circle cx="-18" cy="-9" r="14"/><circle cx="14" cy="-11" r="17"/></g>
        <g class="cloud" data-x="500" data-y="60" data-v="19" data-s="1" transform="translate(500 60)"><ellipse cx="0" cy="0" rx="34" ry="13"/><circle cx="-15" cy="-8" r="12"/><circle cx="12" cy="-9" r="14"/></g>
        <g class="cloud" data-x="800" data-y="150" data-v="9" data-s=".8" transform="translate(800 150) scale(.8)"><ellipse cx="0" cy="0" rx="30" ry="12"/><circle cx="-13" cy="-7" r="11"/><circle cx="11" cy="-8" r="12"/></g>
      </g>
      <path d="M-40,380 Q130,262 300,380 Z" fill="#d4ecc6"/>
      <path d="M190,380 Q370,292 560,380 Z" fill="#c3e4b2"/>
      <path d="M470,380 Q640,278 820,380 Z" fill="#d4ecc6"/>
      <path d="M700,380 Q840,300 1000,380 Z" fill="#c3e4b2"/>
      <rect y="378" width="960" height="56" fill="#9fd66e"/>
      <g id="trees">
        <use href="#treeA" transform="translate(180 380)"/><use href="#treeB" transform="translate(540 380) scale(.9)"/>
        <use href="#treeA" transform="translate(860 380) scale(.82)"/><use href="#treeB" transform="translate(1480 380) scale(1.05)"/>
        <use href="#treeA" transform="translate(1840 380)"/><use href="#treeB" transform="translate(2160 380) scale(.88)"/>
      </g>
      <rect y="434" width="960" height="84" fill="#9aa5b1"/>
      <rect y="434" width="960" height="4" fill="#b6c0ca"/>
      <rect y="514" width="960" height="3" fill="#7f8a96"/>
      <rect y="517" width="960" height="83" fill="#7cc553"/>
      <g id="lane" fill="#f4f7f9" opacity=".9"/>
      <ellipse id="shadow" cx="470" cy="507" rx="236" ry="13" fill="#3c4653" opacity=".18"/>

      <g id="ride" transform="translate(300 428)">
        <g><circle cx="0" cy="0" r="72" fill="none" stroke="#2f3237" stroke-width="11"/><circle cx="0" cy="0" r="63" fill="none" stroke="#d7dde3" stroke-width="4"/><g id="spokesBack"/><circle cx="0" cy="0" r="9" fill="#5b6470"/><circle cx="0" cy="0" r="3.5" fill="#333a44"/></g>
        <path d="M-51,-51 A72,72 0 0 1 51,-51" fill="none" stroke="#f4a259" stroke-width="7" stroke-linecap="round"/>
        <circle cx="-52" cy="-49" r="4.5" fill="#e63946"/>
        <g><circle cx="340" cy="0" r="72" fill="none" stroke="#2f3237" stroke-width="11"/><circle cx="340" cy="0" r="63" fill="none" stroke="#d7dde3" stroke-width="4"/><g transform="translate(340 0)"><g id="spokesFront"/></g><circle cx="340" cy="0" r="9" fill="#5b6470"/><circle cx="340" cy="0" r="3.5" fill="#333a44"/></g>

        <polyline id="legFar" fill="none" stroke="#b5651d" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
        <ellipse id="footFar" rx="12" ry="4.5" fill="#b5651d"/>
        <line id="crankFar" x1="170" y1="12" stroke="#41474f" stroke-width="6" stroke-linecap="round"/>
        <rect id="pedalFar" width="26" height="8" rx="2" fill="#3a3f46"/>
        <path d="M162,-226 C212,-214 258,-188 302,-150" fill="none" stroke="#ddd8c8" stroke-width="15" stroke-linecap="round" opacity=".9"/>

        <g fill="none" stroke="#e34b54" stroke-width="9" stroke-linecap="round">
          <path d="M170,12 L300,-8"/><path d="M170,12 L112,-122"/><path d="M108,-118 L298,-100"/>
          <path d="M112,-118 L2,-2"/><path d="M170,12 L2,2"/><path d="M300,-8 L340,0"/><path d="M298,-100 L306,-138"/>
        </g>
        <path d="M68,-142 C86,-154 118,-154 132,-143 C114,-136 84,-137 68,-142 Z" fill="#2f3237"/>
        <path d="M306,-138 L318,-161" fill="none" stroke="#444b55" stroke-width="8" stroke-linecap="round"/>
        <path d="M301,-164 L337,-160" fill="none" stroke="#2f3237" stroke-width="8" stroke-linecap="round"/>
        <circle cx="301" cy="-164" r="5" fill="#e34b54"/><circle cx="337" cy="-160" r="5" fill="#e34b54"/>
        <circle cx="170" cy="12" r="24" fill="none" stroke="#4b5563" stroke-width="5"/>
        <circle cx="0" cy="0" r="10" fill="none" stroke="#4b5563" stroke-width="4"/>
        <path id="chainTop" d="M2,-10 L171,-12" fill="none" stroke="#3a3f46" stroke-width="3.5" stroke-dasharray="4 3"/>
        <path id="chainBottom" d="M171,36 L2,11" fill="none" stroke="#3a3f46" stroke-width="3.5" stroke-dasharray="4 3"/>
        <g>
          <path d="M322,-146 L380,-140 L372,-96 L316,-100 Z" fill="#c99a5b" stroke="#8a6238" stroke-width="3" stroke-linejoin="round"/>
          <path d="M319,-130 L379,-124 M320,-113 L377,-107 M338,-144 L334,-99 M358,-142 L355,-97" fill="none" stroke="#8a6238" stroke-width="2"/>
          <g id="fish" transform="translate(349 -138)"><ellipse cx="3" cy="0" rx="16" ry="7" fill="#79b8e8"/><path d="M-11,0 L-24,-8 L-20,0 L-24,8 Z" fill="#5aa0d8"/><circle cx="12" cy="-2" r="1.8" fill="#12324a"/></g>
        </g>

        <g id="tail"><path d="M104,-172 C82,-178 60,-188 44,-202" fill="none" stroke="#e6e2d3" stroke-width="8" stroke-linecap="round"/><path d="M106,-178 C88,-190 74,-203 64,-217" fill="none" stroke="#dcd8c7" stroke-width="7" stroke-linecap="round"/><path d="M104,-164 C82,-165 60,-169 44,-173" fill="none" stroke="#dcd8c7" stroke-width="7" stroke-linecap="round"/></g>
        <ellipse cx="175" cy="-180" rx="88" ry="58" transform="rotate(-12 175 -180)" fill="url(#bodyGrad)" stroke="#d8d4c6" stroke-width="2.5"/>
        <path d="M225,-213 C258,-230 262,-262 251,-290" fill="none" stroke="#fbfaf3" stroke-width="34" stroke-linecap="round"/>
        <g transform="translate(252 -248)"><path id="scarfTail" d="M0,2 C-20,8 -38,16 -53,30 C-37,32 -16,26 2,14 Z" fill="#e63946"/><circle r="6.5" fill="#cf2f3f"/></g>
        <g id="head"><path d="M280,-344 C276,-356 270,-363 261,-368 M287,-345 C287,-358 284,-366 277,-373" fill="none" stroke="#e0dcca" stroke-width="4" stroke-linecap="round"/><circle cx="285" cy="-315" r="31" fill="#fbfaf3" stroke="#d8d4c6" stroke-width="2.5"/><path d="M297,-307 C299,-279 317,-255 351,-249 C384,-244 407,-262 420,-296 C383,-288 340,-295 297,-307 Z" fill="url(#pouchGrad)" stroke="#d97b2e" stroke-width="1.5"/><path d="M299,-331 C345,-330 392,-320 424,-307 C427,-303 425,-298 418,-298 C380,-300 338,-304 298,-309 Z" fill="url(#beakGrad)" stroke="#e08c1f" stroke-width="1.5"/><circle cx="292" cy="-323" r="4.6" fill="#23282e"/><circle cx="293.8" cy="-324.8" r="1.5" fill="#fff"/></g>
        <path d="M166,-236 C228,-242 288,-208 330,-167 C325,-152 307,-147 292,-155 C252,-178 208,-197 162,-201 Z" fill="#f2efe3" stroke="#d8d4c6" stroke-width="2.5"/>
        <line id="crankNear" x1="170" y1="12" stroke="#5b6470" stroke-width="7" stroke-linecap="round"/>
        <rect id="pedalNear" width="28" height="9" rx="2.5" fill="#23282e"/>
        <polyline id="legNear" fill="none" stroke="#f28c28" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
        <ellipse id="footNear" rx="13" ry="5" fill="#f28c28"/>
      </g>
      <g id="grassG"/>
    </svg>
    <button class="scene-control" type="button" :aria-label="playing ? '暂停动画' : '播放动画'"
      :title="playing ? '暂停动画' : '播放动画'" @click="togglePlayback">
      <Pause v-if="playing" :size="20" aria-hidden="true" />
      <Play v-else :size="20" aria-hidden="true" />
    </button>
  </div>
</template>
