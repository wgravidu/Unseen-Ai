import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { Move3d, RotateCcw } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext.jsx'

const DEFAULT_CAMERA = [0, 0.15, 4.6]

function normalizeRegion(region) {
  const focus = region?.focus_area || region
  const values = {
    x_min: Number(focus?.x_min),
    y_min: Number(focus?.y_min),
    x_max: Number(focus?.x_max),
    y_max: Number(focus?.y_max),
  }
  if (!Object.values(values).every(Number.isFinite)) return null
  const xMin = Math.min(1000, Math.max(0, values.x_min))
  const yMin = Math.min(1000, Math.max(0, values.y_min))
  const xMax = Math.min(1000, Math.max(0, values.x_max))
  const yMax = Math.min(1000, Math.max(0, values.y_max))
  if (xMax <= xMin || yMax <= yMin) return null
  return { ...values, x_min: xMin, y_min: yMin, x_max: xMax, y_max: yMax }
}

function regionDetails(region, index, t) {
  return {
    id: region?.id || `region-${index + 1}`,
    label: region?.label || region?.instruction || `Region ${index + 1}`,
    focus: normalizeRegion(region),
    source: region?.source || 'AI supplied focus area',
    details:
      region?.details ||
      region?.reason ||
      region?.expected_evidence ||
      t('visualization.noRegionText'),
    priority: region?.priority || null,
  }
}

function useObjectUrlTexture(imageUrl) {
  const [textureState, setTextureState] = useState({ url: null, texture: null })

  useEffect(() => {
    if (!imageUrl) return undefined
    let cancelled = false
    const loader = new THREE.TextureLoader()
    loader.load(
      imageUrl,
      (loadedTexture) => {
        if (cancelled) {
          loadedTexture.dispose()
          return
        }
        loadedTexture.colorSpace = THREE.SRGBColorSpace
        loadedTexture.anisotropy = 4
        setTextureState({ url: imageUrl, texture: loadedTexture })
      },
      undefined,
      () => {
        if (!cancelled) setTextureState({ url: imageUrl, texture: null })
      },
    )
    return () => {
      cancelled = true
    }
  }, [imageUrl])

  const texture = textureState.url === imageUrl ? textureState.texture : null
  useEffect(() => () => texture?.dispose(), [texture])
  return texture
}

function RegionFrame({ region, selected, onSelect, wallWidth, wallHeight }) {
  const { focus } = region
  const width = ((focus.x_max - focus.x_min) / 1000) * wallWidth
  const height = ((focus.y_max - focus.y_min) / 1000) * wallHeight
  const centerX = (((focus.x_min + focus.x_max) / 2 / 1000) - 0.5) * wallWidth
  const centerY = (0.5 - ((focus.y_min + focus.y_max) / 2 / 1000)) * wallHeight
  const points = useMemo(() => {
    const halfW = width / 2
    const halfH = height / 2
    return new Float32Array([
      -halfW, -halfH, 0,
      halfW, -halfH, 0,
      halfW, halfH, 0,
      -halfW, halfH, 0,
      -halfW, -halfH, 0,
    ])
  }, [width, height])

  return (
    <group position={[centerX, centerY, 0.035]}>
      <mesh onClick={(event) => { event.stopPropagation(); onSelect(region) }}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial color={selected ? '#ff8a5c' : '#22d3ee'} transparent opacity={selected ? 0.22 : 0.1} depthWrite={false} />
      </mesh>
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[points, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={selected ? '#ffb08a' : '#67e8f9'} linewidth={1} />
      </line>
      {selected && (
        <Html position={[0, height / 2 + 0.12, 0]} center distanceFactor={7}>
          <div className="region-3d-label">{region.label}</div>
        </Html>
      )}
    </group>
  )
}

function CameraReset({ resetSignal, controlsRef }) {
  const { camera } = useThree()
  useEffect(() => {
    if (!resetSignal) return
    camera.position.set(...DEFAULT_CAMERA)
    camera.lookAt(0, 0, 0)
    controlsRef.current?.target.set(0, 0, 0)
    controlsRef.current?.update()
  }, [camera, controlsRef, resetSignal])
  return null
}

function WallScene({ imageUrl, regions, selectedRegion, onSelectRegion }) {
  const texture = useObjectUrlTexture(imageUrl)
  const imageAspect = texture?.image?.width && texture?.image?.height
    ? texture.image.width / texture.image.height
    : 4 / 3
  const wallWidth = 3.4
  const wallHeight = wallWidth / imageAspect

  return (
    <>
      <color attach="background" args={['#030713']} />
      <fog attach="fog" args={['#030713', 6, 11]} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[2.5, 3, 4]} intensity={1.4} color="#dff8ff" />
      <pointLight position={[-3, 1.5, 2]} intensity={8} color="#22d3ee" />
      <pointLight position={[3, -1, 1.5]} intensity={4} color="#8b5cf6" />

      <mesh position={[0, -wallHeight / 2 - 0.55, -0.4]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[9, 6]} />
        <meshStandardMaterial color="#071326" roughness={0.85} metalness={0.15} />
      </mesh>
      <gridHelper args={[9, 18, '#164e63', '#0e2a3d']} position={[0, -wallHeight / 2 - 0.54, -0.4]} />

      <group>
        <mesh position={[0, 0, -0.045]}>
          <boxGeometry args={[wallWidth + 0.12, wallHeight + 0.12, 0.07]} />
          <meshStandardMaterial color="#10243d" roughness={0.55} metalness={0.25} />
        </mesh>
        <mesh>
          <planeGeometry args={[wallWidth, wallHeight]} />
          {texture ? (
            <meshStandardMaterial map={texture} roughness={0.72} metalness={0.03} />
          ) : (
            <meshStandardMaterial color="#203650" roughness={0.78} metalness={0.05} />
          )}
        </mesh>
        {regions.map((region) => (
          <RegionFrame
            key={region.id}
            region={region}
            selected={selectedRegion?.id === region.id}
            onSelect={onSelectRegion}
            wallWidth={wallWidth}
            wallHeight={wallHeight}
          />
        ))}
      </group>
    </>
  )
}

export default function WallVisualization3D({ imageUrl, regions = [] }) {
  const { t } = useLanguage()
  const controlsRef = useRef(null)
  const normalizedRegions = useMemo(
    () => regions.map((region, index) => regionDetails(region, index, t)).filter((region) => region.focus),
    [regions, t],
  )
  const [selectedRegionId, setSelectedRegionId] = useState(null)
  const selectedRegion =
    normalizedRegions.find((region) => region.id === selectedRegionId) || normalizedRegions[0] || null
  const [resetSignal, setResetSignal] = useState(0)
  const selectRegion = (region) => setSelectedRegionId(region?.id || null)

  return (
    <section className="visualization-layout">
      <div className="visualization-canvas-card">
        <div className="visualization-toolbar">
          <span><Move3d size={16} aria-hidden="true" /> {t('visualization.drag')}</span>
          <button type="button" className="secondary-button compact-button" onClick={() => setResetSignal((value) => value + 1)}>
            <RotateCcw size={15} aria-hidden="true" /> {t('visualization.reset')}
          </button>
        </div>
        <div className="visualization-canvas">
          <Canvas camera={{ position: DEFAULT_CAMERA, fov: 43 }} dpr={[1, 1.75]}>
            <Suspense fallback={null}>
              <WallScene
                imageUrl={imageUrl}
                regions={normalizedRegions}
                selectedRegion={selectedRegion}
                onSelectRegion={selectRegion}
              />
            </Suspense>
            <OrbitControls
              ref={controlsRef}
              enableDamping
              dampingFactor={0.08}
              minDistance={2.2}
              maxDistance={7}
              maxPolarAngle={Math.PI * 0.72}
            />
            <CameraReset resetSignal={resetSignal} controlsRef={controlsRef} />
          </Canvas>
        </div>
        <p className="illustrative-note">{t('visualization.illustrative')}</p>
      </div>

      <aside className="region-info-panel" aria-live="polite">
        <p className="eyebrow">{t('visualization.inspector')}</p>
        <h3>{selectedRegion ? selectedRegion.label : t('visualization.noRegion')}</h3>
        {selectedRegion ? (
          <>
            <dl className="region-details">
              <div><dt>{t('visualization.source')}</dt><dd>{selectedRegion.source}</dd></div>
              {selectedRegion.priority && <div><dt>{t('visualization.priority')}</dt><dd>{selectedRegion.priority}</dd></div>}
              <div>
                <dt>{t('visualization.focusCoordinates')}</dt>
                <dd>
                  x {Math.round(selectedRegion.focus.x_min)}–{Math.round(selectedRegion.focus.x_max)},
                  y {Math.round(selectedRegion.focus.y_min)}–{Math.round(selectedRegion.focus.y_max)} / 1000
                </dd>
              </div>
            </dl>
            <p>{selectedRegion.details}</p>
          </>
        ) : (
          <p>{t('visualization.noRegionText')}</p>
        )}

        {normalizedRegions.length > 0 && (
          <div className="region-list">
            {normalizedRegions.map((region) => (
              <button
                key={region.id}
                type="button"
                className={selectedRegion?.id === region.id ? 'region-chip is-active' : 'region-chip'}
                onClick={() => selectRegion(region)}
              >
                {region.label}
              </button>
            ))}
          </div>
        )}
      </aside>
    </section>
  )
}
