// Signal Strength Data
export const signalStrengthData = [
  { lat: 40.7128, lng: -74.0060, strength: 0.9, city: "New York" },
  { lat: 51.5074, lng: -0.1278, strength: 0.85, city: "London" },
  { lat: 35.6762, lng: 139.6503, strength: 0.95, city: "Tokyo" },
  { lat: 28.6139, lng: 77.2090, strength: 0.7, city: "Delhi" },
  { lat: -33.8688, lng: 151.2093, strength: 0.8, city: "Sydney" },
  { lat: 1.3521, lng: 103.8198, strength: 0.88, city: "Singapore" },
  { lat: 37.7749, lng: -122.4194, strength: 0.92, city: "San Francisco" },
  { lat: 48.8566, lng: 2.3522, strength: 0.78, city: "Paris" },
  { lat: 55.7558, lng: 37.6173, strength: 0.65, city: "Moscow" },
  { lat: -23.5505, lng: -46.6333, strength: 0.72, city: "São Paulo" },
  { lat: 19.4326, lng: -99.1332, strength: 0.68, city: "Mexico City" },
  { lat: 30.0444, lng: 31.2357, strength: 0.6, city: "Cairo" },
  { lat: -1.2921, lng: 36.8219, strength: 0.55, city: "Nairobi" },
  { lat: 13.0827, lng: 80.2707, strength: 0.75, city: "Chennai" },
  { lat: 39.9042, lng: 116.4074, strength: 0.93, city: "Beijing" },
];

// Helper: circle in [lat, lng] format
const createCirclePolygon = (lat: number, lng: number, radiusDeg = 5) => {
  const points = 32;
  const polygon: [number, number][] = [];

  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const dLat = radiusDeg * Math.cos(angle);
    const dLng = radiusDeg * Math.sin(angle);
    polygon.push([lat + dLat, lng + dLng]); // [lat, lng]
  }

  return polygon;
};

export const downtimeData = [
  {
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-10, 50],
          [30, 50],
          [30, 65],
          [-10, 65],
          [-10, 50]
        ]
      ]
    },
    properties: {
      region: "Europe",
      severity: 0.7
    }
  },
  {
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [68, 8],
          [97, 8],
          [97, 35],
          [68, 35],
          [68, 8]
        ]
      ]
    },
    properties: {
      region: "India",
      severity: 0.9
    }
  }
];


// 5G Coverage Data
export const fiveGData = [
  { lat: 37.5665, lng: 126.9780, coverage: 0.95, city: "Seoul" },
  { lat: 31.2304, lng: 121.4737, coverage: 0.9, city: "Shanghai" },
  { lat: 34.0522, lng: -118.2437, coverage: 0.85, city: "Los Angeles" },
  { lat: 25.2048, lng: 55.2708, coverage: 0.88, city: "Dubai" },
  { lat: 22.3193, lng: 114.1694, coverage: 0.92, city: "Hong Kong" },
  { lat: 52.5200, lng: 13.4050, coverage: 0.8, city: "Berlin" },
  { lat: 41.3851, lng: 2.1734, coverage: 0.75, city: "Barcelona" },
  { lat: 59.3293, lng: 18.0686, coverage: 0.87, city: "Stockholm" },
  { lat: -37.8136, lng: 144.9631, coverage: 0.78, city: "Melbourne" },
  { lat: 43.6532, lng: -79.3832, coverage: 0.82, city: "Toronto" },
];

// Honeypot Attack Origins
export const attackOrigins = [
  { lat: 39.9042, lng: 116.4074, attacks: 152, country: "China" },
  { lat: 55.7558, lng: 37.6173, attacks: 98, country: "Russia" },
  { lat: 37.5665, lng: 126.9780, attacks: 67, country: "South Korea" },
  { lat: 52.5200, lng: 13.4050, attacks: 43, country: "Germany" },
  { lat: 40.7128, lng: -74.0060, attacks: 89, country: "USA" },
];
