import * as THREE from 'three'

/**
 * CuraLine immersive WebGL scene — a hospital "vitals + triage" backdrop.
 *
 *  • Drifting ECG/vitals waveforms (ICU-monitor traces) that pulse like a heartbeat.
 *  • An AI triage network: patient nodes flow left → through a central AI hub →
 *    out to severity-colored specialist nodes (green/amber/red), with data
 *    pulses traveling along the edges.
 *
 * Returns { setScroll(0..1), dispose() }. Respects prefers-reduced-motion
 * (renders one static frame) and pauses when the tab is hidden.
 */
export function createImmersiveScene(canvas) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true, powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)

  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(0x05060f, 0.045)

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 120)
  camera.position.set(0, 0, 9)

  const world = new THREE.Group()
  world.rotation.x = -0.06
  scene.add(world)

  // Lighting — only the shaded bot (MeshStandard) reacts; flat nodes ignore it.
  scene.add(new THREE.AmbientLight(0x7080b0, 1.4))
  const keyLight = new THREE.DirectionalLight(0xffffff, 3.0)
  keyLight.position.set(2, 4, 5)
  scene.add(keyLight)
  const rimLight = new THREE.PointLight(0x7c3aed, 40, 30, 2)
  rimLight.position.set(-3, 1, 3)
  scene.add(rimLight)

  // Track disposables.
  const geometries = []
  const materials = []
  const track = (g, m) => { if (g) geometries.push(g); if (m) materials.push(m); }

  // ── ECG / vitals waveforms ──
  // One repeating heartbeat over phase 0..1 (P wave, QRS complex, T wave).
  function beat(p) {
    if (p < 0.10) return 0
    if (p < 0.15) return 0.16 * Math.sin(((p - 0.10) / 0.05) * Math.PI)        // P wave
    if (p < 0.30) return 0
    if (p < 0.33) return -0.12 * ((p - 0.30) / 0.03)                            // Q
    if (p < 0.36) return -0.12 + 1.12 * ((p - 0.33) / 0.03)                     // R rise
    if (p < 0.39) return 1.0 - 1.3 * ((p - 0.36) / 0.03)                        // S fall
    if (p < 0.42) return -0.3 + 0.3 * ((p - 0.39) / 0.03)                       // back to base
    if (p < 0.58) return 0
    if (p < 0.72) return 0.30 * Math.sin(((p - 0.58) / 0.14) * Math.PI)         // T wave
    return 0
  }

  function makeTrace({ y, z, period, amp, color, opacity, speed, beatRate }) {
    const pts = []
    const half = 38
    const dx = 0.06
    for (let x = -half; x <= half; x += dx) {
      const phase = ((x / period) % 1 + 1) % 1
      pts.push(new THREE.Vector3(x, beat(phase) * amp, 0))
    }
    const g = new THREE.BufferGeometry().setFromPoints(pts)
    const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending })
    track(g, m)
    const line = new THREE.Line(g, m)
    line.position.set(0, y, z)
    world.add(line)
    return { line, period, speed, beatRate, baseOpacity: opacity, mat: m }
  }

  const traces = [
    makeTrace({ y: -4.2, z: -1.0, period: 6, amp: 0.85, color: 0x818cf8, opacity: 0.65, speed: 1.4, beatRate: 2.0 }),
    makeTrace({ y: 3.7, z: -2.2, period: 8, amp: 0.6, color: 0x34d399, opacity: 0.40, speed: 1.0, beatRate: 1.5 }),
    makeTrace({ y: -1.4, z: -4.5, period: 5, amp: 0.45, color: 0x22d3ee, opacity: 0.22, speed: 1.9, beatRate: 2.6 }),
  ]

  // ── AI triage network ──
  const NEUTRAL = 0x818cf8
  const HUB = 0xa5b4fc
  const nodeDefs = [
    // patients (left)
    { p: [-6.2, 1.6, 0.5], c: NEUTRAL, r: 0.12 },
    { p: [-6.6, -0.6, -1.0], c: NEUTRAL, r: 0.12 },
    { p: [-5.6, -2.2, 1.0], c: NEUTRAL, r: 0.12 },
    { p: [-6.1, 2.9, -1.2], c: NEUTRAL, r: 0.12 },
    // AI hub (center)
    { p: [0, 0.4, 0], c: HUB, r: 0.26, hub: true },
    // specialists by severity (right)
    { p: [5.6, 2.3, 0.5], c: 0x34d399, r: 0.14 },  // low
    { p: [6.1, 0.6, -1.0], c: 0x34d399, r: 0.14 },  // low
    { p: [5.6, -1.1, 1.0], c: 0xf59e0b, r: 0.15 },  // medium
    { p: [6.3, -2.6, -0.8], c: 0xf59e0b, r: 0.15 },  // medium
    { p: [5.9, 3.1, -1.5], c: 0xef4444, r: 0.17 },  // high
  ]
  const HUB_INDEX = 4

  const nodeGeo = new THREE.SphereGeometry(1, 18, 18)
  const haloGeo = new THREE.SphereGeometry(1, 14, 14)
  geometries.push(nodeGeo, haloGeo)

  const nodes = nodeDefs.map((d) => {
    const pos = new THREE.Vector3(...d.p)
    // The hub is rendered as the AI bot (below); keep only its position here.
    if (d.hub) return { core: null, halo: null, base: d.r, hub: true, pos }
    const core = new THREE.Mesh(nodeGeo, new THREE.MeshBasicMaterial({ color: d.c }))
    core.position.copy(pos)
    core.scale.setScalar(d.r)
    const haloMat = new THREE.MeshBasicMaterial({ color: d.c, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false })
    const halo = new THREE.Mesh(haloGeo, haloMat)
    halo.position.copy(pos)
    halo.scale.setScalar(d.r * 2.6)
    materials.push(core.material, haloMat)
    world.add(core, halo)
    return { core, halo, base: d.r, hub: false, pos }
  })

  // Edges: every patient → hub, hub → every specialist.
  const edges = []
  for (let i = 0; i < HUB_INDEX; i++) edges.push([i, HUB_INDEX])
  for (let i = HUB_INDEX + 1; i < nodes.length; i++) edges.push([HUB_INDEX, i])

  const edgePts = []
  edges.forEach(([a, b]) => { edgePts.push(nodes[a].pos.clone(), nodes[b].pos.clone()) })
  const edgeGeo = new THREE.BufferGeometry().setFromPoints(edgePts)
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x4f46e5, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending })
  track(edgeGeo, edgeMat)
  world.add(new THREE.LineSegments(edgeGeo, edgeMat))

  // Data pulses traveling along each edge.
  const pulseGeo = new THREE.SphereGeometry(0.07, 10, 10)
  geometries.push(pulseGeo)
  const pulses = edges.map(([a, b], i) => {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
    materials.push(mat)
    const mesh = new THREE.Mesh(pulseGeo, mat)
    world.add(mesh)
    return { mesh, a: nodes[a].pos, b: nodes[b].pos, phase: i / edges.length, speed: 0.35 + (i % 3) * 0.08 }
  })

  // ── AI assistant bot (the hub) ──
  const bot = new THREE.Group()
  bot.position.copy(nodes[HUB_INDEX].pos)
  bot.scale.setScalar(0.5) // keep it modest so it never crowds the page copy
  const botBaseY = nodes[HUB_INDEX].pos.y
  world.add(bot)

  const headGeo = new THREE.SphereGeometry(0.62, 32, 32)
  const headMat = new THREE.MeshStandardMaterial({ color: 0xe9ecff, metalness: 0.35, roughness: 0.35 })
  const head = new THREE.Mesh(headGeo, headMat)
  head.scale.set(1, 0.92, 0.95)
  bot.add(head)
  track(headGeo, headMat)

  const bodyGeo = new THREE.SphereGeometry(0.42, 24, 24)
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x6366f1, metalness: 0.4, roughness: 0.4 })
  const body = new THREE.Mesh(bodyGeo, bodyMat)
  body.position.y = -0.6
  body.scale.set(1.15, 0.6, 1)
  bot.add(body)
  track(bodyGeo, bodyMat)

  // Dark visor "face screen".
  const visorGeo = new THREE.SphereGeometry(0.5, 32, 24)
  const visorMat = new THREE.MeshStandardMaterial({ color: 0x0a0e24, metalness: 0.6, roughness: 0.2, emissive: 0x141a3a, emissiveIntensity: 0.7 })
  const visor = new THREE.Mesh(visorGeo, visorMat)
  visor.position.set(0, 0.02, 0.3)
  visor.scale.set(0.92, 0.62, 0.5)
  bot.add(visor)
  track(visorGeo, visorMat)

  // Glowing eyes (+ additive halo behind them).
  const eyeGeo = new THREE.SphereGeometry(0.07, 16, 16)
  geometries.push(eyeGeo)
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x9cecff })
  materials.push(eyeMat)
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat)
  eyeL.position.set(-0.16, 0.06, 0.69)
  eyeL.scale.set(1, 1.3, 1)
  const eyeR = eyeL.clone()
  eyeR.position.x = 0.16
  bot.add(eyeL, eyeR)
  const eyeGlowMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false })
  materials.push(eyeGlowMat)
  const eyeGlowL = new THREE.Mesh(eyeGeo, eyeGlowMat)
  eyeGlowL.position.copy(eyeL.position)
  eyeGlowL.scale.setScalar(2.3)
  const eyeGlowR = new THREE.Mesh(eyeGeo, eyeGlowMat)
  eyeGlowR.position.copy(eyeR.position)
  eyeGlowR.scale.setScalar(2.3)
  bot.add(eyeGlowL, eyeGlowR)

  // Antenna with a pulsing tip.
  const antGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.32, 8)
  const antMat = new THREE.MeshStandardMaterial({ color: 0xa5b4fc, metalness: 0.5, roughness: 0.4 })
  const antenna = new THREE.Mesh(antGeo, antMat)
  antenna.position.set(0, 0.72, 0)
  bot.add(antenna)
  track(antGeo, antMat)
  const tipGeo = new THREE.SphereGeometry(0.055, 12, 12)
  const tipMat = new THREE.MeshBasicMaterial({ color: 0xf472b6 })
  const tip = new THREE.Mesh(tipGeo, tipMat)
  tip.position.set(0, 0.9, 0)
  bot.add(tip)
  track(tipGeo, tipMat)

  // Soft glow behind the bot.
  const glowGeo = new THREE.SphereGeometry(1, 24, 24)
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x6366f1, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false })
  const glow = new THREE.Mesh(glowGeo, glowMat)
  glow.scale.setScalar(1.35)
  bot.add(glow)
  track(glowGeo, glowMat)

  // ── Grid floor (monitor grid) ──
  const grid = new THREE.GridHelper(90, 60, 0x4f46e5, 0x1e1b4b)
  grid.position.y = -6
  grid.material.transparent = true
  grid.material.opacity = 0.14
  world.add(grid)
  materials.push(grid.material)
  geometries.push(grid.geometry)

  // ── Interaction ──
  let scrollP = 0, targetScroll = 0
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 }
  const onMove = (e) => {
    mouse.tx = e.clientX / window.innerWidth - 0.5
    mouse.ty = e.clientY / window.innerHeight - 0.5
  }
  window.addEventListener('pointermove', onMove)

  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  }
  window.addEventListener('resize', onResize)

  const clock = new THREE.Clock()
  let raf = null
  let running = true

  function render() {
    const t = clock.getElapsedTime()
    scrollP += (targetScroll - scrollP) * 0.06
    mouse.x += (mouse.tx - mouse.x) * 0.05
    mouse.y += (mouse.ty - mouse.y) * 0.05

    // ECG drift + heartbeat glow.
    traces.forEach((tr) => {
      tr.line.position.x = -((t * tr.speed) % tr.period)
      tr.mat.opacity = tr.baseOpacity * (0.6 + 0.4 * Math.abs(Math.sin(t * tr.beatRate)))
    })

    // Node breathing (skip the hub — it's the bot).
    nodes.forEach((n, i) => {
      if (!n.core) return
      const s = n.base * (1 + 0.18 * Math.sin(t * 2 + i))
      n.core.scale.setScalar(s)
      n.halo.scale.setScalar(s * 2.6)
      n.halo.material.opacity = 0.18 + 0.12 * (0.5 + 0.5 * Math.sin(t * 2 + i))
    })

    // AI bot: bob, follow cursor, blink, antenna pulse.
    bot.position.y = botBaseY + Math.sin(t * 1.4) * 0.07
    bot.rotation.y = mouse.x * 0.55 + Math.sin(t * 0.5) * 0.12
    bot.rotation.x = -mouse.y * 0.3 + Math.sin(t * 0.7) * 0.04
    tip.scale.setScalar(1 + Math.sin(t * 4) * 0.3)
    tipMat.opacity = 1
    glowMat.opacity = 0.10 + 0.05 * (0.5 + 0.5 * Math.sin(t * 1.4))
    eyeGlowMat.opacity = 0.35 + 0.2 * (0.5 + 0.5 * Math.sin(t * 3))
    // Quick blink every ~3.6s.
    const bp = t % 3.6
    const lid = bp > 3.4 ? Math.abs(Math.cos(((bp - 3.4) / 0.2) * Math.PI)) : 1
    eyeL.scale.y = 1.3 * lid
    eyeR.scale.y = 1.3 * lid

    // Data pulses gliding edge → edge.
    pulses.forEach((pu) => {
      const f = (t * pu.speed + pu.phase) % 1
      pu.mesh.position.lerpVectors(pu.a, pu.b, f)
      pu.mesh.material.opacity = 0.9 * Math.sin(f * Math.PI)  // fade in/out along the edge
    })

    // Subtle scene drift.
    world.rotation.y = Math.sin(t * 0.1) * 0.06

    // Camera: mouse parallax + scroll dolly.
    camera.position.x += (mouse.x * 1.4 - camera.position.x) * 0.05
    camera.position.y += (-mouse.y * 0.9 - camera.position.y) * 0.05
    const z = 9 + (7.2 - 9) * scrollP
    camera.position.z += (z - camera.position.z) * 0.05
    camera.lookAt(0, 0, 0)

    renderer.render(scene, camera)
  }

  function loop() {
    if (!running) return
    render()
    raf = requestAnimationFrame(loop)
  }

  if (reduced) render()
  else loop()

  const onVis = () => {
    if (document.hidden) { running = false; if (raf) cancelAnimationFrame(raf) }
    else if (!reduced && !running) { running = true; loop() }
  }
  document.addEventListener('visibilitychange', onVis)

  return {
    setScroll(p) { targetScroll = Math.max(0, Math.min(1, p)) },
    dispose() {
      running = false
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVis)
      geometries.forEach((g) => g.dispose())
      materials.forEach((m) => m.dispose())
      renderer.dispose()
    },
  }
}
