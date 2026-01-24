import { useState, useEffect } from "react";
import Layout from "@/components/layout/Layout";
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Wifi, Globe, AlertTriangle, Layers, Radio } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// --- Mock Data (unchanged) ---
const MOCK_DATA = {
  signal: [
    { lat: 40.7128, lng: -74.0060, strength: 98, city: "New York" },
    { lat: 51.5074, lng: -0.1278, strength: 95, city: "London" },
    { lat: 35.6762, lng: 139.6503, strength: 99, city: "Tokyo" },
    { lat: 22.5726, lng: 88.3639, strength: 88, city: "Kolkata" },
    { lat: -33.8688, lng: 151.2093, strength: 92, city: "Sydney" },
    { lat: 55.7558, lng: 37.6173, strength: 75, city: "Moscow" },
    { lat: -23.5505, lng: -46.6333, strength: 82, city: "São Paulo" },
  ],
  downtime: [
    { lat: 19.0760, lng: 72.8777, type: "Fiber Cut", severity: "Critical", city: "Mumbai" },
    { lat: 30.0444, lng: 31.2357, type: "ISP Outage", severity: "High", city: "Cairo" },
    { lat: 48.8566, lng: 2.3522, type: "Maintenance", severity: "Low", city: "Paris" },
  ],
  connectivity5g: [
    { lat: 37.7749, lng: -122.4194, status: "Active", city: "San Francisco" },
    { lat: 1.3521, lng: 103.8198, status: "Active", city: "Singapore" },
    { lat: 25.2048, lng: 55.2708, status: "Active", city: "Dubai" },
    { lat: 52.5200, lng: 13.4050, status: "Rolling out", city: "Berlin" },
    { lat: 37.5665, lng: 126.9780, status: "Ultra-Wideband", city: "Seoul" },
  ]
};

type LayerType = 'signal' | 'downtime' | '5g';

const ConnectivityMap = () => {
  const [activeLayer, setActiveLayer] = useState<LayerType>('signal');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate initialization
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Layout>
      {/* FIX: Added explicit h-[80vh] and min-h-[500px] to ensure the container 
         never collapses to 0 height.
      */}
      <div className="relative w-full h-[80vh] min-h-[500px] overflow-hidden rounded-lg border border-cyber-red/30 shadow-[0_0_30px_rgba(255,43,69,0.1)] bg-black">
        
        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-black/90 backdrop-blur-md">
            <div className="flex flex-col items-center gap-4">
              <Globe className="h-16 w-16 text-cyber-red animate-pulse" />
              <div className="text-cyber-cyan font-mono tracking-widest animate-flicker">
                INITIALIZING GLOBAL UPLINK...
              </div>
            </div>
          </div>
        )}

        {/* HUD Controls */}
        <div className="absolute top-6 left-6 z-[400] w-72 space-y-4 pointer-events-auto">
          <Card className="glass-panel p-4 border-l-4 border-l-cyber-red bg-black/80">
            <h2 className="text-xl font-bold text-cyber-red flex items-center gap-2 mb-4">
              <Layers className="h-5 w-5" />
              GLOBAL NET OPS
            </h2>
            
            <div className="space-y-2">
              <Button 
                variant="outline" 
                className={`w-full justify-start gap-3 border-cyber-red/50 hover:bg-cyber-red/20 transition-all ${activeLayer === 'signal' ? 'bg-cyber-red/20 text-white shadow-[0_0_10px_rgba(255,43,69,0.4)]' : 'text-gray-400'}`}
                onClick={() => setActiveLayer('signal')}
              >
                <Wifi className="h-4 w-4" /> Global Signal
              </Button>
              
              <Button 
                variant="outline" 
                className={`w-full justify-start gap-3 border-cyber-red/50 hover:bg-cyber-red/20 transition-all ${activeLayer === 'downtime' ? 'bg-cyber-red/20 text-white shadow-[0_0_10px_rgba(255,43,69,0.4)]' : 'text-gray-400'}`}
                onClick={() => setActiveLayer('downtime')}
              >
                <AlertTriangle className="h-4 w-4" /> Outage Map
              </Button>

              <Button 
                variant="outline" 
                className={`w-full justify-start gap-3 border-cyber-red/50 hover:bg-cyber-red/20 transition-all ${activeLayer === '5g' ? 'bg-cyber-red/20 text-white shadow-[0_0_10px_rgba(255,43,69,0.4)]' : 'text-gray-400'}`}
                onClick={() => setActiveLayer('5g')}
              >
                <Radio className="h-4 w-4" /> 5G Mesh Grid
              </Button>
            </div>
          </Card>
        </div>

        {/* FIX: MapContainer MUST have explicit style={{ height: '100%', width: '100%' }}
           to fill the parent div.
        */}
        <MapContainer 
          center={[20, 0]} 
          zoom={2} 
          scrollWheelZoom={true} 
          style={{ height: "100%", width: "100%", background: "#050505" }}
          attributionControl={false}
        >
          {/* Base Layer: Dark Matter */}
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />

          {/* Layer: Signal */}
          {activeLayer === 'signal' && MOCK_DATA.signal.map((node, i) => (
            <CircleMarker 
              key={i} 
              center={[node.lat, node.lng]} 
              radius={node.strength / 4}
              pathOptions={{ 
                color: node.strength > 90 ? '#4ade80' : '#facc15', 
                fillColor: node.strength > 90 ? '#4ade80' : '#facc15',
                fillOpacity: 0.2,
                weight: 1
              }}
            >
              <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                <div className="text-xs font-mono">
                  <strong className="text-cyber-cyan">{node.city}</strong>: {node.strength}%
                </div>
              </Tooltip>
            </CircleMarker>
          ))}

          {/* Layer: Downtime */}
          {activeLayer === 'downtime' && MOCK_DATA.downtime.map((node, i) => (
            <CircleMarker 
              key={i} 
              center={[node.lat, node.lng]} 
              radius={10}
              pathOptions={{ 
                color: '#ff2b45',
                fillColor: '#ff2b45',
                fillOpacity: 0.6,
                weight: 2
              }}
            >
              <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                <div className="text-xs font-mono border-l-2 border-cyber-red pl-2">
                  <strong className="text-cyber-red">CRITICAL ALERT</strong><br/>
                  {node.city}: {node.type}
                </div>
              </Tooltip>
            </CircleMarker>
          ))}

          {/* Layer: 5G */}
          {activeLayer === '5g' && MOCK_DATA.connectivity5g.map((node, i) => (
            <CircleMarker 
              key={i} 
              center={[node.lat, node.lng]} 
              radius={8}
              pathOptions={{ 
                color: '#22d3ee', 
                fillColor: '#22d3ee',
                fillOpacity: 0.4,
                weight: 1
              }}
            >
               <Popup>
                 <div className="text-sm font-mono">
                   <h3 className="font-bold text-cyber-cyan">{node.city}</h3>
                   <Badge variant="outline" className="mt-1 border-cyber-cyan text-cyber-cyan">{node.status}</Badge>
                 </div>
               </Popup>
            </CircleMarker>
          ))}
        </MapContainer>

        {/* CRT Scanline Overlay */}
        <div className="absolute inset-0 pointer-events-none z-[300] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(255,0,0,0.02),rgba(255,0,0,0.06))] bg-[length:100%_2px,3px_100%] bg-repeat opacity-20" />
      </div>
    </Layout>
  );
};

export default ConnectivityMap;