"use client"

import { useEffect, useRef, useState } from "react"

type LatLng = { lat: number; lng: number }

type Props = {
  origin: LatLng
  destination: LatLng
}

export default function RouteMap({ origin, destination }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<google.maps.TravelMode>("WALKING")
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer>()

  useEffect(() => {
    if (!mapRef.current) return

    // Google Maps 初期化
    const map = new google.maps.Map(mapRef.current, {
      center: origin,
      zoom: 14,
    })

    const directionsService = new google.maps.DirectionsService()
    directionsRendererRef.current = new google.maps.DirectionsRenderer()
    directionsRendererRef.current.setMap(map)

    const renderRoute = () => {
      directionsService.route(
        {
          origin,
          destination,
          travelMode: mode,
        },
        (result, status) => {
          if (status === "OK" && result) {
            directionsRendererRef.current?.setDirections(result)
          } else {
            console.error("Directions request failed:", status)
          }
        }
      )
    }

    renderRoute()
  }, [origin, destination, mode])

  return (
    <div className="w-full">
      <div className="mb-2">
        <label className="mr-2 font-semibold">移動手段:</label>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as google.maps.TravelMode)}
          className="border p-1 rounded"
        >
          <option value="WALKING">徒歩</option>
          <option value="DRIVING">車</option>
        </select>
      </div>
      <div ref={mapRef} className="w-full h-96 border rounded" />
    </div>
  )
}
