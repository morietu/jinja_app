import type { Locator, LatLng } from "../../../../packages/shared/location";

export const webLocator: Locator = {
  current() {
    return new Promise<LatLng>((resolve, reject) => {
      if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
        return reject(new Error("geolocation unavailable"));
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  },
};
