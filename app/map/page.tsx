import type { Metadata } from "next"
import MapView from "@/components/MapView"

export const metadata: Metadata = {
  title: "地形マップ | Shintoku Atlas",
  description: "新得町の地形を地理院タイル（淡色地図・色別標高図・陰影起伏図）で表示",
}

export default function MapPage() {
  return <MapView />
}
