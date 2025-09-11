export type LatLng = { lat: number; lng: number };

export interface Locator {
  current(): Promise<LatLng>;
}
