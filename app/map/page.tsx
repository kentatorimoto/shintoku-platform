import type { Metadata } from "next"
import MapView from "@/components/MapView"

export const metadata: Metadata = {
  title: "地形マップ | Shintoku Atlas",
  description: "新得町の地形を地理院タイル（淡色地図・色別標高図・陰影起伏図）で表示",
}

export default function MapPage() {
  return (
    <div className="relative">
      <MapView />
      <p className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[1000]
                    text-[11px] text-textSub/40 pointer-events-none select-none
                    tracking-widest text-center">
        流域は変わらない。読み方が変わる。
      </p>
    </div>
  )
}
