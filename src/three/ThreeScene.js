import { useEffect, useRef } from 'react'

export default function ThreeScene({ data, width = 1380, height = 850 }) {
  const mountRef = useRef(null)

  useEffect(() => {
    let THREE
    let renderer, scene, camera, controls
    let animationId

    async function setup() {
      // dynamic import so it only runs in client
      THREE = await import('three')
      const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls')

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setSize(width, height)
      renderer.setPixelRatio(window.devicePixelRatio || 1)

      scene = new THREE.Scene()
      scene.background = new THREE.Color(0x081226)

      camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 5000)
      camera.position.set(0, 400, 800)

      controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.07
      controls.minDistance = 200
      controls.maxDistance = 2000

      // lights
      const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6)
      hemi.position.set(0, 200, 0)
      scene.add(hemi)
      const dir = new THREE.DirectionalLight(0xffffff, 0.8)
      dir.position.set(100, 200, 100)
      scene.add(dir)

      // ground plane
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(2000, 2000),
        new THREE.MeshStandardMaterial({ color: 0x071026 })
      )
      ground.rotation.x = -Math.PI / 2
      ground.position.y = -1
      scene.add(ground)


      // create bars from data (if available)
      const group = new THREE.Group()
      scene.add(group)

      // tooltip DOM
      const tooltip = document.createElement('div')
      tooltip.style.position = 'absolute'
      tooltip.style.pointerEvents = 'none'
      tooltip.style.padding = '8px 10px'
      tooltip.style.borderRadius = '6px'
      tooltip.style.background = 'rgba(0,0,0,0.6)'
      tooltip.style.color = '#fff'
      tooltip.style.fontSize = '13px'
      tooltip.style.display = 'none'
      tooltip.style.zIndex = 9999
      document.body.appendChild(tooltip)

      let hovered = null
      const raycaster = new THREE.Raycaster()
      const mouse = new THREE.Vector2()

      function buildFromData(d) {
        // clear group
        while (group.children.length) group.remove(group.children[0])

        if (!d || !d.length) return

        // expect columns: site, value (numeric). Normalize keys
        const rows = d.map(r => {
          const keys = Object.keys(r)
          const site = r['site'] || r['Site'] || r['الموقع'] || r[keys[0]]
          const rawVal = r['value'] || r['Value'] || r['النسبة'] || r['النسبة (%)'] || r[keys[1]] || r[keys.find(k=>/percent|%|value|نسبة|عدد/i.test(k))]
          const val = parseFloat(String(rawVal || '').replace('%','').replace(',','.')) || 0
          return { site, val }
        })

        // layout grid
        const cols = Math.max(1, Math.ceil(Math.sqrt(rows.length)))
        const spacing = 60
        rows.forEach((row, i) => {
          const col = i % cols
          const r = Math.floor(i / cols)
          const x = (col - cols / 2) * spacing
          const z = (r - cols / 2) * spacing
          const height = Math.max(2, row.val * 6)

          const geo = new THREE.BoxGeometry(40, height, 40)
          const mat = new THREE.MeshStandardMaterial({ color: row.val >= 50 ? 0x16a34a : 0x4f8cff, metalness: 0.2, roughness: 0.6 })
          const m = new THREE.Mesh(geo, mat)
          m.position.set(x, height / 2, z)
          m.userData = { site: row.site, val: row.val }
          group.add(m)
        })
      }

      function onPointerMove(e) {
        const rect = renderer.domElement.getBoundingClientRect()
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1
        mouse.set(x, y)
        raycaster.setFromCamera(mouse, camera)
        const intersects = raycaster.intersectObjects(group.children, false)
        if (intersects.length) {
          const hit = intersects[0].object
          if (hovered !== hit) {
            if (hovered) hovered.material.emissive && (hovered.material.emissive.setHex(0x000000))
            hovered = hit
            if (hovered.material.emissive) hovered.material.emissive.setHex(0x222222)
          }
          tooltip.style.display = 'block'
          tooltip.style.left = (e.clientX + 12) + 'px'
          tooltip.style.top = (e.clientY + 12) + 'px'
          tooltip.innerText = `${hit.userData.site || '—'}: ${hit.userData.val}`
        } else {
          if (hovered) hovered.material.emissive && (hovered.material.emissive.setHex(0x000000))
          hovered = null
          tooltip.style.display = 'none'
        }
      }

      renderer.domElement.addEventListener('pointermove', onPointerMove)


      // initial build
      buildFromData(data)

      // animate
      function animate() {
        controls.update()
        renderer.render(scene, camera)
        animationId = requestAnimationFrame(animate)
      }

      // attach
      mountRef.current.appendChild(renderer.domElement)
      animate()

      // handle resize
      function onResize() {
        const w = width
        const h = height
        renderer.setSize(w, h)
        camera.aspect = w / h
        camera.updateProjectionMatrix()
      }
      window.addEventListener('resize', onResize)

      // expose buildFromData for updates
      mountRef.current._updateData = buildFromData
    }

    setup()

    return () => {
      cancelAnimationFrame(animationId)
      try { if (mountRef.current && mountRef.current.firstChild) mountRef.current.removeChild(mountRef.current.firstChild) } catch(e){}
      window.removeEventListener('resize', () => {})
    }
  }, [])

  // update when data changes
  useEffect(() => {
    if (mountRef.current && mountRef.current._updateData) {
      mountRef.current._updateData(data)
    }
  }, [data])

  return <div ref={mountRef} style={{ width, height }} />
}
