"use client"

import { useEffect, useRef, useState } from "react"
import { X } from "lucide-react"

// ── 型定義 ─────────────────────────────────────────────────────────────────
type LayerStatus = "idle" | "loading" | "ready" | "error"

type DecisionLink = {
  id:    string
  title: string
  tags:  string[]
  type:  "assembly_video" | "minutes" | "news" | "source"
  date:  string
  url:   string
  note:  string
}

type SelectedFeature = {
  name:        string
  description: string
  linkTags:    string[]
}

type BasinClue = {
  id:      string
  label:   string
  note:    string
  targets: { layer: string; nameIncludes: string }[]
}

type BasinQuestion = {
  id:     string
  title:  string
  view:   { center: [number, number]; zoom: number }
  layers: { rivers?: boolean; passes?: boolean; centershift?: boolean; relief?: boolean; hillshade?: boolean }
  clues:  BasinClue[]
}

// ── 調整用定数 ─────────────────────────────────────────────────────────────
const CENTER: [number, number] = [43.08, 142.84]
const ZOOM = 11
const RELIEF_OPACITY_DEFAULT    = 75
const HILLSHADE_OPACITY_DEFAULT = 45

const LS_RELIEF    = "map-relief-opacity"
const LS_HILLSHADE = "map-hillshade-opacity"

const TILE_PALE      = "https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png"
const TILE_RELIEF    = "https://cyberjapandata.gsi.go.jp/xyz/relief/{z}/{x}/{y}.png"
const TILE_HILLSHADE = "https://cyberjapandata.gsi.go.jp/xyz/hillshademap/{z}/{x}/{y}.png"

// ── Pane z-index（面 < 線 < 点）────────────────────────────────────────────
const Z_PALE        = 200
const Z_RELIEF      = 210
const Z_HILLSHADE   = 220
const Z_RIVERS      = 500
const Z_PASSES      = 600
const Z_CENTERSHIFT = 610

// ── GeoJSON / データ URL ────────────────────────────────────────────────────
const RIVERS_URL          = "/data/rivers.geojson"
const PASSES_URL          = "/data/passes.geojson"
const CENTERSHIFT_URL     = "/data/centershift.geojson"
const LINKS_URL           = "/data/decision_links.json"
const BASIN_QUESTIONS_URL = "/data/basin_questions.json"

// ── レイヤー見た目 ─────────────────────────────────────────────────────────
const RIVER_COLOR   = "#4da6ff"
const RIVER_OPACITY = 0.8

const PASS_COLOR        = "#f97316"
const PASS_RADIUS       = 6
const PASS_FILL_OPACITY = 0.85

const CS_POINT_COLOR        = "#a78bfa"
const CS_POINT_RADIUS       = 7
const CS_POINT_FILL_OPACITY = 0.90
const CS_LINE_COLOR         = "#a78bfa"
const CS_LINE_OPACITY       = 0.85
const CS_LINE_DASH          = "8 5"

function riverWeight(zoom: number): number {
  if (zoom <= 10) return 1
  if (zoom <= 12) return 2
  return 3
}

// ── localStorage ユーティリティ ────────────────────────────────────────────
function lsGet(key: string, fallback: number): number {
  try {
    const v = localStorage.getItem(key)
    return v !== null ? Number(v) : fallback
  } catch { return fallback }
}
function lsSet(key: string, value: number) {
  try { localStorage.setItem(key, String(value)) } catch { /* noop */ }
}

// ── feature → サイドパネル用メタデータ ──────────────────────────────────────
function extractFeatureMeta(feature: GeoJSON.Feature): SelectedFeature {
  const props    = (feature.properties ?? {}) as Record<string, unknown>
  const linkTags = Array.isArray(props.linkTags) ? (props.linkTags as string[]) : []
  const gtype    = feature.geometry.type

  if (gtype === "Point") {
    return {
      name:        (props.name      as string) ?? "",
      description: (props.shortNote as string) ?? "",
      linkTags,
    }
  }
  // LineString / MultiLineString
  return {
    name:        (props.name as string) ?? (props.period as string) ?? "",
    description: (props.reason as string) ?? "",
    linkTags,
  }
}

// ──────────────────────────────────────────────────────────────────────────────

export default function MapView() {
  const containerRef     = useRef<HTMLDivElement>(null)
  const mapRef           = useRef<import("leaflet").Map | null>(null)
  const reliefRef        = useRef<import("leaflet").TileLayer | null>(null)
  const hillshadeRef     = useRef<import("leaflet").TileLayer | null>(null)
  const riversGroupRef   = useRef<import("leaflet").LayerGroup | null>(null)
  const riversGeoJsonRef = useRef<import("leaflet").GeoJSON | null>(null)
  const passesGroupRef   = useRef<import("leaflet").LayerGroup | null>(null)
  const passesGeoJsonRef = useRef<import("leaflet").GeoJSON | null>(null)
  const centerShiftGroupRef   = useRef<import("leaflet").LayerGroup | null>(null)
  const centerShiftGeoJsonRef = useRef<import("leaflet").GeoJSON | null>(null)

  const reliefOpRef    = useRef(RELIEF_OPACITY_DEFAULT)
  const hillshadeOpRef = useRef(HILLSHADE_OPACITY_DEFAULT)
  const decisionLinksRef = useRef<DecisionLink[]>([])

  // 問いの地図用 ref
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const restoreRef        = useRef<(() => void) | null>(null)

  const [reliefOp,          setReliefOp]          = useState(RELIEF_OPACITY_DEFAULT)
  const [hillshadeOp,       setHillshadeOp]        = useState(HILLSHADE_OPACITY_DEFAULT)
  const [riversStatus,      setRiversStatus]       = useState<LayerStatus>("idle")
  const [passesStatus,      setPassesStatus]       = useState<LayerStatus>("idle")
  const [centerShiftStatus, setCenterShiftStatus]  = useState<LayerStatus>("idle")
  const [selectedFeature,   setSelectedFeature]    = useState<SelectedFeature | null>(null)
  const [questions,         setQuestions]          = useState<BasinQuestion[]>([])
  const [activeQuestion,    setActiveQuestion]     = useState<BasinQuestion | null>(null)
  const [activeClueId,      setActiveClueId]       = useState<string | null>(null)

  // ── (1) localStorage 初期値ロード ─────────────────────────────────────────
  useEffect(() => {
    const r = lsGet(LS_RELIEF,    RELIEF_OPACITY_DEFAULT)
    const h = lsGet(LS_HILLSHADE, HILLSHADE_OPACITY_DEFAULT)
    reliefOpRef.current    = r
    hillshadeOpRef.current = h
    setReliefOp(r)
    setHillshadeOp(h)
  }, [])

  // ── (1b) basin_questions.json 読み込み ────────────────────────────────────
  useEffect(() => {
    fetch(BASIN_QUESTIONS_URL)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: BasinQuestion[]) => setQuestions(data))
      .catch(err => console.error("[MapView] basin_questions.json読み込み失敗:", err))
  }, [])

  // ── ハイライト解除（タイマーキャンセル + スタイル復元）────────────────────
  function clearHighlight() {
    if (highlightTimerRef.current !== null) {
      clearTimeout(highlightTimerRef.current)
      highlightTimerRef.current = null
    }
    restoreRef.current?.()
    restoreRef.current = null
  }

  // ── GeoJSON layer ref をレイヤー名から取得 ──────────────────────────────
  function getGeoJsonLayer(layerName: string): import("leaflet").GeoJSON | null {
    switch (layerName) {
      case "rivers":      return riversGeoJsonRef.current
      case "passes":      return passesGeoJsonRef.current
      case "centershift": return centerShiftGeoJsonRef.current
      default:            return null
    }
  }

  // ── 問いを選択（flyTo + レイヤーON/OFF + パネル表示）──────────────────────
  function handleQuestionClick(q: BasinQuestion) {
    clearHighlight()
    setActiveClueId(null)
    setSelectedFeature(null)
    setActiveQuestion(q)

    const map = mapRef.current
    if (!map) return

    map.flyTo(q.view.center, q.view.zoom, { duration: 1 })

    const toggle = (layer: import("leaflet").Layer | null, on: boolean) => {
      if (!layer) return
      if (on && !map.hasLayer(layer)) map.addLayer(layer)
      else if (!on && map.hasLayer(layer)) map.removeLayer(layer)
    }
    toggle(riversGroupRef.current,      q.layers.rivers      ?? false)
    toggle(passesGroupRef.current,      q.layers.passes      ?? false)
    toggle(centerShiftGroupRef.current, q.layers.centershift ?? false)
    toggle(reliefRef.current,           q.layers.relief      ?? false)
    toggle(hillshadeRef.current,        q.layers.hillshade   ?? false)
  }

  // ── clue クリック（ハイライト適用 + 10秒後に自動解除）───────────────────
  function handleClueClick(clue: BasinClue) {
    clearHighlight()
    setActiveClueId(clue.id)

    const restores: Array<() => void> = []

    for (const target of clue.targets) {
      const geoLayer = getGeoJsonLayer(target.layer)
      if (!geoLayer) continue

      geoLayer.eachLayer((lyr) => {
        type LyrWithFeature = { feature?: GeoJSON.Feature }
        const feat = (lyr as LyrWithFeature).feature
        const name = feat?.properties?.name as string | undefined

        // nameIncludes が空文字の場合は全件ハイライト
        if (target.nameIncludes !== "" && !name?.includes(target.nameIncludes)) return

        const path = lyr as import("leaflet").Path
        const isCircle = typeof (lyr as { getRadius?: unknown }).getRadius === "function"

        if (isCircle) {
          const orig = {
            fillColor:   path.options.fillColor,
            fillOpacity: path.options.fillOpacity,
          }
          path.setStyle({ fillColor: "#fbbf24", fillOpacity: 1 })
          restores.push(() => path.setStyle(orig))
        } else {
          const orig = {
            color:   path.options.color,
            weight:  path.options.weight,
            opacity: path.options.opacity,
          }
          path.setStyle({ color: "#fbbf24", weight: 5, opacity: 1 })
          restores.push(() => path.setStyle(orig))
        }
      })
    }

    restoreRef.current = () => restores.forEach(r => r())

    highlightTimerRef.current = setTimeout(() => {
      clearHighlight()
      setActiveClueId(null)
    }, 10_000)
  }

  // ── (2) Leaflet map 初期化 ─────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    let cancelled = false

    import("leaflet").then(async (L) => {
      if (cancelled || !containerRef.current) return

      const map = L.map(containerRef.current, {
        center: CENTER,
        zoom: ZOOM,
        attributionControl: false,
      })

      // Pane
      map.createPane("pane-pale").style.zIndex      = String(Z_PALE)
      map.createPane("pane-relief").style.zIndex    = String(Z_RELIEF)
      map.createPane("pane-hillshade").style.zIndex = String(Z_HILLSHADE)
      map.createPane("rivers").style.zIndex         = String(Z_RIVERS)
      map.createPane("passes").style.zIndex         = String(Z_PASSES)
      map.createPane("centershift").style.zIndex    = String(Z_CENTERSHIFT)

      // 地形タイル
      const pale = L.tileLayer(TILE_PALE, { pane: "pane-pale", maxZoom: 18 })
      const relief = L.tileLayer(TILE_RELIEF, {
        pane: "pane-relief", maxZoom: 15, opacity: reliefOpRef.current / 100,
      })
      const hillshade = L.tileLayer(TILE_HILLSHADE, {
        pane: "pane-hillshade", maxZoom: 16, opacity: hillshadeOpRef.current / 100,
      })
      pale.addTo(map)
      relief.addTo(map)
      hillshade.addTo(map)

      // 空 LayerGroup を先に作り control に登録（fetch 前からチェックボックスを表示）
      const riversGroup = L.layerGroup(
        [], { pane: "rivers" } as import("leaflet").LayerOptions
      ).addTo(map)
      riversGroupRef.current = riversGroup

      const passesGroup = L.layerGroup(
        [], { pane: "passes" } as import("leaflet").LayerOptions
      ).addTo(map)
      passesGroupRef.current = passesGroup

      const centerShiftGroup = L.layerGroup(
        [], { pane: "centershift" } as import("leaflet").LayerOptions
      ).addTo(map)
      centerShiftGroupRef.current = centerShiftGroup

      L.control.layers(
        { "淡色地図": pale },
        {
          "色別標高図":      relief,
          "陰影起伏図":      hillshade,
          "河川（GeoJSON）": riversGroup,
          "峠（GeoJSON）":   passesGroup,
          "中心移動（仮）":   centerShiftGroup,
        },
        { collapsed: false, position: "topright" }
      ).addTo(map)

      map.on("zoomend", () => {
        riversGeoJsonRef.current?.setStyle({ weight: riverWeight(map.getZoom()) })
      })

      reliefRef.current    = relief
      hillshadeRef.current = hillshade
      mapRef.current       = map

      // ── GeoJSON + decision_links を並列 fetch ─────────────────────────────
      if (!cancelled) {
        setRiversStatus("loading")
        setPassesStatus("loading")
        setCenterShiftStatus("loading")
      }

      await Promise.allSettled([

        // decision_links（ステータス表示なし）
        (async () => {
          try {
            const res = await fetch(LINKS_URL)
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            if (cancelled) return
            const links: DecisionLink[] = await res.json()
            if (!cancelled) decisionLinksRef.current = links
          } catch (err) {
            console.error("[MapView] decision_links.json読み込み失敗:", err)
          }
        })(),

        // 河川
        (async () => {
          try {
            const res = await fetch(RIVERS_URL)
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            if (cancelled) return
            const geojson: GeoJSON.FeatureCollection = await res.json()
            if (cancelled) return

            const geo = L.geoJSON(geojson, {
              style: () => ({
                pane: "rivers", color: RIVER_COLOR,
                weight: riverWeight(map.getZoom()),
                opacity: RIVER_OPACITY, lineCap: "round", lineJoin: "round",
              }),
              onEachFeature(feature, layer) {
                const name = feature.properties?.name as string | undefined
                if (name) layer.bindPopup(`<strong style="font-size:13px">${name}</strong>`)
                const meta = extractFeatureMeta(feature)
                layer.on("click", () => {
                  clearHighlight()
                  setActiveClueId(null)
                  setActiveQuestion(null)
                  setSelectedFeature(meta)
                })
              },
            })
            riversGroup.clearLayers()
            riversGroup.addLayer(geo)
            riversGeoJsonRef.current = geo
            if (!cancelled) setRiversStatus("ready")
          } catch (err) {
            console.error("[MapView] 河川GeoJSON読み込み失敗:", err)
            if (!cancelled) setRiversStatus("error")
          }
        })(),

        // 峠
        (async () => {
          try {
            const res = await fetch(PASSES_URL)
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            if (cancelled) return
            const geojson: GeoJSON.FeatureCollection = await res.json()
            if (cancelled) return

            const geo = L.geoJSON(geojson, {
              pointToLayer(_feature, latlng) {
                return L.circleMarker(latlng, {
                  pane: "passes", radius: PASS_RADIUS,
                  color: "#fff", weight: 1.5,
                  fillColor: PASS_COLOR, fillOpacity: PASS_FILL_OPACITY,
                })
              },
              onEachFeature(feature, layer) {
                const name = feature.properties?.name as string | undefined
                const elev = feature.properties?.elevation as number | undefined
                if (name) {
                  const body = elev
                    ? `<strong style="font-size:13px">${name}</strong><br>` +
                      `<span style="font-size:11px;color:#888">${elev} m</span>`
                    : `<strong style="font-size:13px">${name}</strong>`
                  layer.bindPopup(body)
                }
                const meta = extractFeatureMeta(feature)
                layer.on("click", () => {
                  clearHighlight()
                  setActiveClueId(null)
                  setActiveQuestion(null)
                  setSelectedFeature(meta)
                })
              },
            })
            passesGroup.clearLayers()
            passesGroup.addLayer(geo)
            passesGeoJsonRef.current = geo
            if (!cancelled) setPassesStatus("ready")
          } catch (err) {
            console.error("[MapView] 峠GeoJSON読み込み失敗:", err)
            if (!cancelled) setPassesStatus("error")
          }
        })(),

        // 中心移動
        (async () => {
          try {
            const res = await fetch(CENTERSHIFT_URL)
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            if (cancelled) return
            const geojson: GeoJSON.FeatureCollection = await res.json()
            if (cancelled) return

            const geo = L.geoJSON(geojson, {
              style() {
                return {
                  pane: "centershift", color: CS_LINE_COLOR,
                  weight: 2.5, opacity: CS_LINE_OPACITY,
                  dashArray: CS_LINE_DASH, lineCap: "round",
                }
              },
              pointToLayer(_feature, latlng) {
                return L.circleMarker(latlng, {
                  pane: "centershift", radius: CS_POINT_RADIUS,
                  color: "#fff", weight: 1.5,
                  fillColor: CS_POINT_COLOR, fillOpacity: CS_POINT_FILL_OPACITY,
                })
              },
              onEachFeature(feature, layer) {
                const props = feature.properties as Record<string, string | undefined>
                const gtype = feature.geometry.type
                if (gtype === "Point") {
                  const name = props.name ?? ""
                  const note = props.shortNote ?? ""
                  layer.bindPopup(
                    `<strong style="font-size:13px">${name}</strong>` +
                    (note ? `<br><span style="font-size:11px;color:#888">${note}</span>` : "")
                  )
                } else if (gtype === "LineString") {
                  const period = props.period ?? ""
                  const reason = props.reason ?? ""
                  layer.bindPopup(
                    (period ? `<span style="font-size:11px;color:#aaa">${period}</span><br>` : "") +
                    (reason ? `<span style="font-size:12px">${reason}</span>` : "")
                  )
                }
                const meta = extractFeatureMeta(feature)
                layer.on("click", () => {
                  clearHighlight()
                  setActiveClueId(null)
                  setActiveQuestion(null)
                  setSelectedFeature(meta)
                })
              },
            })
            centerShiftGroup.clearLayers()
            centerShiftGroup.addLayer(geo)
            centerShiftGeoJsonRef.current = geo
            if (!cancelled) setCenterShiftStatus("ready")
          } catch (err) {
            console.error("[MapView] 中心移動GeoJSON読み込み失敗:", err)
            if (!cancelled) setCenterShiftStatus("error")
          }
        })(),
      ])
    })

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current                = null
      reliefRef.current             = null
      hillshadeRef.current          = null
      riversGroupRef.current        = null
      riversGeoJsonRef.current      = null
      passesGroupRef.current        = null
      passesGeoJsonRef.current      = null
      centerShiftGroupRef.current   = null
      centerShiftGeoJsonRef.current = null
    }
  }, [])

  // ── (3) opacity 変化 → Leaflet + localStorage ──────────────────────────────
  useEffect(() => {
    reliefOpRef.current = reliefOp
    reliefRef.current?.setOpacity(reliefOp / 100)
    lsSet(LS_RELIEF, reliefOp)
  }, [reliefOp])

  useEffect(() => {
    hillshadeOpRef.current = hillshadeOp
    hillshadeRef.current?.setOpacity(hillshadeOp / 100)
    lsSet(LS_HILLSHADE, hillshadeOp)
  }, [hillshadeOp])

  // ── ステータスメッセージ ───────────────────────────────────────────────────
  const statusMsgs: string[] = []
  if (riversStatus      === "loading") statusMsgs.push("河川データ読み込み中…")
  if (passesStatus      === "loading") statusMsgs.push("峠データ読み込み中…")
  if (centerShiftStatus === "loading") statusMsgs.push("中心移動データ読み込み中…")
  const errorMsgs: string[] = []
  if (riversStatus      === "error") errorMsgs.push("河川データの読み込みに失敗しました")
  if (passesStatus      === "error") errorMsgs.push("峠データの読み込みに失敗しました")
  if (centerShiftStatus === "error") errorMsgs.push("中心移動データの読み込みに失敗しました")

  // ── 関連リンク（selectedFeature の linkTags で decision_links をフィルタ）──
  const filteredLinks = selectedFeature
    ? decisionLinksRef.current
        .filter(l => selectedFeature.linkTags.some(t => l.tags.includes(t)))
        .slice(0, 5)
    : []

  return (
    <div className="relative -mt-16 h-[calc(100svh-4rem)] overflow-hidden">
      {/* Leaflet コンテナ */}
      <div ref={containerRef} className="h-full w-full" />

      {/* 左上コントロール列 */}
      <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-3">

        {/* Opacity コントロール */}
        <div className="bg-ink/90 border border-line rounded-xl p-4 w-52 shadow-lg backdrop-blur-sm">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-textSub/50 mb-3">
            透過度
          </p>
          <div className="space-y-4">
            <OpacitySlider label="色別標高図" value={reliefOp}    onChange={setReliefOp}    />
            <OpacitySlider label="陰影起伏図" value={hillshadeOp} onChange={setHillshadeOp} />
          </div>
        </div>

        {/* 問いカード */}
        {questions.length > 0 && (
          <div className="bg-ink/90 border border-line rounded-xl p-4 w-52 shadow-lg backdrop-blur-sm">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-textSub/50 mb-3">
              問いの地図
            </p>
            <ul className="space-y-1.5">
              {questions.map(q => (
                <li key={q.id}>
                  <button
                    onClick={() => handleQuestionClick(q)}
                    className={[
                      "w-full text-left text-xs px-2 py-1.5 rounded-lg transition-colors leading-snug",
                      activeQuestion?.id === q.id
                        ? "bg-accent/20 text-accent border border-accent/30"
                        : "text-textMain/80 hover:bg-white/5 border border-transparent",
                    ].join(" ")}
                  >
                    {q.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ステータス表示（右下・出典より上）*/}
      {(statusMsgs.length > 0 || errorMsgs.length > 0) && (
        <div className="absolute bottom-10 right-2 z-[1000] flex flex-col items-end gap-1">
          {statusMsgs.map(msg => (
            <div key={msg}
              className="text-[11px] leading-none rounded px-2 py-1
                         text-textSub/80 bg-ink/80 pointer-events-none select-none animate-pulse">
              {msg}
            </div>
          ))}
          {errorMsgs.map(msg => (
            <div key={msg}
              className="text-[11px] leading-none rounded px-2 py-1
                         text-red-400/90 bg-ink/80 pointer-events-none select-none">
              {msg}
            </div>
          ))}
        </div>
      )}

      {/* 出典表記（右下）*/}
      <div className="absolute bottom-2 right-2 z-[1000]
                      text-[11px] leading-snug text-textSub/70 bg-ink/80
                      rounded px-2 py-1 pointer-events-none select-none">
        出典：地理院タイル（国土地理院）
        <br />
        <span className="text-textSub/50 text-[10px]">淡色地図 / 色別標高図 / 陰影起伏図</span>
      </div>

      {/* サイドパネル（右から slide-in）*/}
      <SidePanel
        feature={selectedFeature}
        links={filteredLinks}
        question={activeQuestion}
        activeClueId={activeClueId}
        onClueClick={handleClueClick}
        onClose={() => {
          if (activeQuestion) {
            clearHighlight()
            setActiveClueId(null)
            setActiveQuestion(null)
          } else {
            setSelectedFeature(null)
          }
        }}
      />
    </div>
  )
}

// ── Opacity スライダー ──────────────────────────────────────────────────────
function OpacitySlider({
  label, value, onChange,
}: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex justify-between items-baseline text-xs mb-1.5">
        <span className="text-textMain/80">{label}</span>
        <span className="text-textSub/60 tabular-nums w-8 text-right">{value}%</span>
      </div>
      <input type="range" min={0} max={100} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-accent" />
    </div>
  )
}

// ── リンク種別バッジ ────────────────────────────────────────────────────────
const LINK_TYPE_LABEL: Record<string, string> = {
  assembly_video: "議会動画",
  minutes:        "議事録",
  news:           "お知らせ",
  source:         "資料",
}
const LINK_TYPE_COLOR: Record<string, string> = {
  assembly_video: "text-blue-400",
  minutes:        "text-green-400",
  news:           "text-yellow-400",
  source:         "text-purple-400",
}

function LinkTypeBadge({ type }: { type: string }) {
  return (
    <span className={`text-[10px] font-semibold shrink-0 ${LINK_TYPE_COLOR[type] ?? "text-textSub/60"}`}>
      {LINK_TYPE_LABEL[type] ?? type}
    </span>
  )
}

// ── サイドパネル ────────────────────────────────────────────────────────────
function SidePanel({
  feature, links, question, activeClueId, onClueClick, onClose,
}: {
  feature:      SelectedFeature | null
  links:        DecisionLink[]
  question:     BasinQuestion | null
  activeClueId: string | null
  onClueClick:  (clue: BasinClue) => void
  onClose:      () => void
}) {
  const isOpen = feature !== null || question !== null
  const mode   = question !== null ? "question" : "feature"

  return (
    // translate-x-full でコンテナ右端外へ → overflow-hidden でクリップ → 見えない
    // translate-x-0 でパネルが右端に表示
    <div
      className={[
        "absolute right-0 top-0 h-full w-72",
        "z-[2000]",                                  // Leaflet controls(1000)より上
        "bg-ink/95 border-l border-line shadow-xl backdrop-blur-sm",
        "flex flex-col",
        "transition-transform duration-200 ease-out",
        isOpen ? "translate-x-0" : "translate-x-full",
      ].join(" ")}
      aria-hidden={!isOpen}
    >
      {mode === "question" && question ? (
        <>
          {/* ヘッダー：問いモード */}
          <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-line/40 shrink-0">
            <div className="flex-1 mr-2 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-textSub/50 mb-1">
                問い
              </p>
              <h3 className="text-sm font-semibold text-textMain leading-snug">
                {question.title}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="text-textSub/60 hover:text-textMain transition shrink-0 p-0.5 -mr-0.5"
              aria-label="パネルを閉じる"
            >
              <X size={15} />
            </button>
          </div>

          {/* 手がかりリスト */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-textSub/50 mb-3">
              手がかり
            </p>
            <ul className="space-y-2">
              {question.clues.map(clue => {
                const isActive = activeClueId === clue.id
                return (
                  <li key={clue.id}>
                    <button
                      onClick={() => onClueClick(clue)}
                      className={[
                        "w-full text-left rounded-lg p-3 border transition-colors",
                        isActive
                          ? "bg-amber-500/10 border-amber-500/40 text-amber-300"
                          : "border-line/40 text-textMain/80 hover:border-accent/40 hover:bg-white/5",
                      ].join(" ")}
                    >
                      <p className="text-xs font-medium leading-snug">{clue.label}</p>
                      {isActive && (
                        <p className="text-[11px] text-textSub/70 leading-relaxed mt-1.5">
                          {clue.note}
                        </p>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </>
      ) : (
        <>
          {/* ヘッダー：地物モード */}
          <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-line/40 shrink-0">
            <div className="flex-1 mr-2 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-textSub/50 mb-1">
                地物情報
              </p>
              <h3 className="text-sm font-semibold text-textMain leading-snug truncate">
                {feature?.name || "—"}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="text-textSub/60 hover:text-textMain transition shrink-0 p-0.5 -mr-0.5"
              aria-label="パネルを閉じる"
            >
              <X size={15} />
            </button>
          </div>

          {/* 説明 */}
          {feature?.description && (
            <div className="px-4 py-3 border-b border-line/40 shrink-0">
              <p className="text-xs text-textSub/80 leading-relaxed">
                {feature.description}
              </p>
            </div>
          )}

          {/* 関連ログ */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-textSub/50 mb-3">
              関連ログ
            </p>
            {links.length === 0 ? (
              <p className="text-xs text-textSub/40 italic">関連リンクはありません</p>
            ) : (
              <ul className="space-y-2">
                {links.map(link => (
                  <li key={link.id}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-lg p-3 border border-line/40
                                 hover:border-accent transition-colors group"
                    >
                      <div className="flex items-start gap-2">
                        <LinkTypeBadge type={link.type} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-textMain leading-snug
                                        group-hover:text-accent transition-colors mb-1 truncate">
                            {link.title}
                          </p>
                          <p className="text-[11px] text-textSub/60 leading-snug line-clamp-2">
                            {link.note}
                          </p>
                          <p className="text-[10px] text-textSub/40 mt-1">{link.date}</p>
                        </div>
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
