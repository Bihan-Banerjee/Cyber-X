import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import Globe from "react-globe.gl";
import countriesGeoJson from "../data/countries.geo.json";
import broadbandData from "../data/broadband_processed.json";
import fiveGData from "../data/fiveg_coverage.json";
import { attackOrigins } from "../data/mapLayers";
import isoCountries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import "./WorldMap.css";
import fiveGPointsRaw from "../data/5g_points.json";

isoCountries.registerLocale(enLocale);

type Layer = "signal" | "5g" | "attacks";

// Pre-process everything outside component
const processedCountries = countriesGeoJson.features.map((feature: any) => ({
  ...feature,
  iso2: isoCountries.alpha3ToAlpha2(feature.id) || ''
}));

// Process 5G points once with proper typing
const fiveGPoints = fiveGPointsRaw
  .filter((p: any) => p.latitude && p.longitude)
  .map((p: any) => ({
    lat: parseFloat(p.latitude),
    lng: parseFloat(p.longitude),
    city: p.city_name || 'Unknown',
    operator: p.operator || 'Unknown',
    status: p.status || 'Unknown',
    deployment: p.deployment_type || '5G'
  }))
  .filter((p: any) => !isNaN(p.lat) && !isNaN(p.lng));

// Create lookup maps outside component
const signalLookup = broadbandData.reduce((acc: Record<string, number>, c: any) => {
  if (c.iso) acc[c.iso.toUpperCase()] = Number(c.download) || 0;
  return acc;
}, {});

const fiveGLookup = fiveGData.reduce((acc: Record<string, number>, c: any) => {
  const iso2 = isoCountries.getAlpha2Code(c.country, "en");
  if (iso2) acc[iso2] = Number(c.coverage) || 0;
  return acc;
}, {});

export default function WorldMap() {
  const globeEl = useRef<any>();
  const [activeLayer, setActiveLayer] = useState<Layer>("signal");
  const [dimensions, setDimensions] = useState({ 
    width: window.innerWidth, 
    height: window.innerHeight 
  });
  const [globeReady, setGlobeReady] = useState(false);
  const [hoveredD, setHoveredD] = useState<any>(null);

  // Debounced resize handler
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setDimensions({ width: window.innerWidth, height: window.innerHeight });
      }, 100);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  // Optimized globe controls
  useEffect(() => {
    if (!globeEl.current) return;

    const controls = globeEl.current.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.2;
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.enableRotate = true; 
    controls.maxDistance = 400;
    controls.minDistance = 150;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    
    globeEl.current.pointOfView({ altitude: 2.5 }, 0);
    setGlobeReady(true);

    
  }, []);

  // Helper function to calculate polygon centroid
  const getPolygonCentroid = useCallback((polygon: any) => {
    if (!polygon || !polygon.geometry || !polygon.geometry.coordinates) {
      return { lat: 0, lng: 0 };
    }
    
    try {
      const coordinates = polygon.geometry.coordinates[0];
      if (!coordinates || coordinates.length === 0) {
        return { lat: 0, lng: 0 };
      }
      
      let lat = 0, lng = 0;
      coordinates.forEach((coord: number[]) => {
        lng += coord[0];
        lat += coord[1];
      });
      
      lat /= coordinates.length;
      lng /= coordinates.length;
      
      return { lat, lng };
    } catch (error) {
      return { lat: 0, lng: 0 };
    }
  }, []);

  // Pre-compute polygon data
  const polygonData = useMemo(() => {
    if (activeLayer !== "signal") return [];
    
    return processedCountries.map(feature => {
      const speed = signalLookup[feature.iso2] || 0;
      
      return {
        ...feature,
        altitude: speed ? Math.min(speed / 800, 0.08) : 0.005,
        color: !speed ? "rgba(70,70,70,0.12)" :
               speed > 200 ? "rgba(0,255,140,0.7)" :
               speed > 120 ? "rgba(0,200,255,0.7)" :
               speed > 60 ? "rgba(255,200,0,0.65)" :
               "rgba(255,70,70,0.6)",
        speed
      };
    });
  }, [activeLayer]);

  // Memoized point data
  const pointsData = useMemo(() => {
    if (activeLayer !== "5g" || !globeReady) return [];
    
    const maxPoints = 10000;
    if (fiveGPoints.length > maxPoints) {
      const step = Math.ceil(fiveGPoints.length / maxPoints);
      return fiveGPoints.filter((_, i) => i % step === 0);
    }
    
    return fiveGPoints;
  }, [activeLayer, globeReady]);

  // Memoized arcs data
  const arcsData = useMemo(() => {
    if (activeLayer !== "attacks") return [];
    
    return attackOrigins.map(a => ({
      startLat: a.lat,
      startLng: a.lng,
      endLat: 13.0827,
      endLng: 80.2707,
      attacks: a.attacks,
      country: a.country
    }));
  }, [activeLayer]);

  // Optimized callbacks
  const getPolygonLabel = useCallback((d: any) => {
    if (!d) return '';
    
    const name = d.properties?.name || '';
    
    if (activeLayer === "signal") {
      const speed = d.speed || signalLookup[d.iso2];
      return `<b>${name}</b><br/>Speed: ${speed ? speed.toFixed(1) : 'N/A'} Mbps`;
    }
    
    if (activeLayer === "5g") {
      const v = fiveGLookup[d.iso2];
      return `<b>${name}</b><br/>5G Index: ${v ? v.toFixed(2) : 'N/A'}`;
    }
    
    return name;
  }, [activeLayer]);

  const getPointLabel = useCallback((d: any) => {
    if (!d) return '';
    return `
      <b>${d.city}</b><br/>
      📱 ${d.operator}<br/>
      📊 ${d.status}<br/>
      📶 ${d.deployment}
    `;
  }, []);

  const getPointColor = useCallback(() => "rgba(0, 255, 255, 0.9)", []);

  const getArcColor = useCallback((d: any) => {
    const intensity = Math.min(d.attacks / 120, 0.8);
    return [`rgba(255,0,0,${intensity})`, "rgba(255,150,0,0.4)"];
  }, []);

  return (
    <div className="world-map-container">
      <div className="layer-controls">
        <h3>MAP LAYERS</h3>
        <button
          className={activeLayer === "signal" ? "active" : ""}
          onClick={() => setActiveLayer("signal")}
        >
          📶 Signal Strength
        </button>
        <button
          className={activeLayer === "5g" ? "active" : ""}
          onClick={() => setActiveLayer("5g")}
        >
          📡 5G Coverage
          {pointsData.length > 0 && (
            <span className="point-count">{pointsData.length.toLocaleString()} pts</span>
          )}
        </button>
        <button
          className={activeLayer === "attacks" ? "active" : ""}
          onClick={() => setActiveLayer("attacks")}
        >
          🎯 Attack Origins
        </button>
      </div>

      <div className="globe-wrapper">
        <Globe
          ref={globeEl}
          width={dimensions.width}
          height={dimensions.height}
          
          // Textures
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
          
          // Performance optimizations
          waitForGlobeReady={true}
          animateIn={false}
          rendererConfig={{
            powerPreference: "high-performance",
            antialias: true,
            alpha: false,
            stencil: false,
            depth: true
          }}
          
          // Polygons - signal layer
          polygonsData={polygonData}
          polygonAltitude={(d: any) => d.altitude}
          polygonCapColor={(d: any) => d.color}
          polygonSideColor={() => "rgba(255,255,255,0.08)"}
          polygonStrokeColor={() => "#111"}
          polygonLabel={getPolygonLabel}
          
          // Points - 5G layer
          pointsData={pointsData}
          pointLat="lat"
          pointLng="lng"
          pointAltitude={0.02}
          pointRadius={0.25}
          pointColor={getPointColor}
          pointLabel={getPointLabel}
          pointsMerge={false}
          
          // Arcs - attack layer
          arcsData={arcsData}
          arcColor={getArcColor}
          arcDashLength={0.4}
          arcDashGap={0.2}
          arcDashAnimateTime={2500}
          arcStroke={0.6}
          arcAltitude={0.5}
          
          // HTML Elements for custom hover labels - FIXED to not block interactions
          htmlElementsData={hoveredD ? [hoveredD] : []}
          htmlLat={(d: any) => {
            if (d.lat !== undefined) return d.lat;
            if (d.geometry) {
              const centroid = getPolygonCentroid(d);
              return centroid.lat;
            }
            return 0;
          }}
          htmlLng={(d: any) => {
            if (d.lng !== undefined) return d.lng;
            if (d.geometry) {
              const centroid = getPolygonCentroid(d);
              return centroid.lng;
            }
            return 0;
          }}
          htmlAltitude={0.1}
          htmlElement={(d: any) => {
            const el = document.createElement('div');
            
            const isPoint = d.lat !== undefined;
            const isPolygon = d.geometry !== undefined;
            
            let content = '';
            if (isPoint) {
              content = `
                <b>${d.city || '5G Site'}</b><br/>
                ${d.operator ? `📱 ${d.operator}<br/>` : ''}
                ${d.status ? `📊 ${d.status}<br/>` : ''}
                ${d.deployment ? `📶 ${d.deployment}` : ''}
              `;
            } else if (isPolygon) {
              const name = d.properties?.name || 'Unknown';
              const speed = d.speed || signalLookup[d.iso2];
              const fiveGVal = fiveGLookup[d.iso2];
              
              if (activeLayer === "signal") {
                content = `
                  <b>${name}</b><br/>
                  📶 Speed: ${speed ? speed.toFixed(1) : 'N/A'} Mbps
                `;
              } else if (activeLayer === "5g") {
                content = `
                  <b>${name}</b><br/>
                  📡 5G Index: ${fiveGVal ? fiveGVal.toFixed(2) : 'N/A'}
                `;
              } else {
                content = `<b>${name}</b>`;
              }
            }
            
            el.innerHTML = `
              <div style="
                background: rgba(0,0,0,0.9);
                color: white;
                padding: 8px 12px;
                border-radius: 6px;
                border: 1px solid #ff4b4b;
                font-size: 12px;
                font-family: system-ui;
                line-height: 1.5;
                box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                backdrop-filter: blur(4px);
                white-space: nowrap;
                transform: translate(-50%, -100%);
                margin-top: -10px;
                pointer-events: none; /* CRITICAL: This prevents blocking mouse events */
                z-index: 1000;
              ">
                ${content}
              </div>
              <div style="
                width: 0;
                height: 0;
                border-left: 6px solid transparent;
                border-right: 6px solid transparent;
                border-top: 6px solid #ff4b4b;
                position: relative;
                left: 50%;
                transform: translateX(-50%);
                margin-top: -2px;
                filter: drop-shadow(0 2px 2px rgba(0,0,0,0.3));
                pointer-events: none; /* CRITICAL: This prevents blocking mouse events */
              "></div>
            `;
            return el;
          }}
          
          // Event handlers
          onPolygonHover={setHoveredD}
          onPointHover={setHoveredD}
        />
      </div>
    </div>
  );
}