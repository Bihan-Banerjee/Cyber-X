import { useState, useRef, useEffect } from 'react';
import Globe from 'react-globe.gl';
import {
  signalStrengthData,
  downtimeData,
  fiveGData,
  attackOrigins,
} from '../data/mapLayers';
import './WorldMap.css';

const WorldMap = () => {
  const globeEl = useRef<any>();

  // Layer toggles
  const [showSignal, setShowSignal] = useState(true);
  const [showDowntime, setShowDowntime] = useState(false);
  const [show5G, setShow5G] = useState(false);
  const [showAttacks, setShowAttacks] = useState(false);

  // Auto-rotate
  useEffect(() => {
    if (globeEl.current) {
      globeEl.current.controls().autoRotate = true;
      globeEl.current.controls().autoRotateSpeed = 0.5;
      globeEl.current.controls().enablePan = false;

    }
  }, []);

  useEffect(() => {
    window.addEventListener('resize', () => globeEl.current?.refresh());
    return () => window.removeEventListener('resize', () => {});
  }, []);

  return (
    <div className="world-map-container">
      {/* Layer Controls */}
      <div className="layer-controls">
        <h3>Map Layers</h3>
        <button
          className={showSignal ? 'active' : ''}
          onClick={() => setShowSignal(!showSignal)}
        >
          📶 Signal Strength
        </button>
        <button
          className={showDowntime ? 'active' : ''}
          onClick={() => setShowDowntime(!showDowntime)}
        >
          ⚠️ Downtime
        </button>
        <button
          className={show5G ? 'active' : ''}
          onClick={() => setShow5G(!show5G)}
        >
          📡 5G Coverage
        </button>
        <button
          className={showAttacks ? 'active' : ''}
          onClick={() => setShowAttacks(!showAttacks)}
        >
          🎯 Attack Origins
        </button>
      </div>
      
      <div className="globe-wrapper">
        {/* Globe */}
        <Globe
          ref={globeEl}
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"

          // Signal Strength Layer (green pulses)
          pointsData={showSignal ? signalStrengthData : []}
          pointAltitude={0.01}
          pointRadius={(d: any) => d.strength * 0.5}
          pointColor={(d: any) => {
            const strength = d.strength;
            if (strength > 0.8) return '#ff9f43';
            if (strength > 0.6) return '#ff6b6b';
            return '#ff3b3b';
          }}
          pointLabel={(d: any) => `
            <div style="background: rgba(0,0,0,0.8); padding: 8px; border-radius: 4px; border: 1px solid #00ff88;">
              <strong>${d.city}</strong><br/>
              Signal: ${(d.strength * 100).toFixed(0)}%
            </div>
          `}
          
          // Downtime Layer (red polygons)
          polygonsData={
          showDowntime
            ? downtimeData.filter(
                d =>
                  d &&
                  d.geometry &&
                  d.geometry.type &&
                  Array.isArray(d.geometry.coordinates)
              )
            : []
        }

        /* ---- VISUAL TUNING (Option C) ---- */

        polygonAltitude={0.006}

        polygonCapColor={(d: any) => {
          const severity = d.properties?.severity ?? 0.5;
          const alpha = Math.min(severity * 0.22, 0.22); // HARD CLAMP
          return `rgba(0,0,0,${alpha})`;
        }}

        polygonSideColor={(d: any) => {
          const severity = d.properties?.severity ?? 0.5;
          return `rgba(255, 40, 40, ${severity * 0.35})`;
        }}

        polygonStrokeColor={() => '#ff4b4b'}

        polygonsTransitionDuration={300}



          // 5G Coverage Layer (blue hexagons)
          hexBinPointsData={show5G ? fiveGData : []}
          hexBinPointLat="lat"
          hexBinPointLng="lng"
          hexBinPointWeight="coverage"
          hexAltitude={(d: any) => d.sumWeight * 0.05}
          hexTopColor={() => 'rgba(75, 125, 255, 0.8)'}
          hexSideColor={() => 'rgba(50, 90, 200, 0.5)'}
          hexBinResolution={4}
          hexLabel={(d: any) => `
            <div style="background: rgba(0,0,0,0.8); padding: 8px; border-radius: 4px; border: 1px solid #0096ff;">
              <strong>📡 5G Zone</strong><br/>
              Points: ${d.points.length}
            </div>
          `}
          
          // Attack Origins Layer (red arcs)
          arcsData={showAttacks ? attackOrigins.map(d => ({
            startLat: d.lat,
            startLng: d.lng,
            endLat: 13.0827,  
            endLng: 80.2707,
            attacks: d.attacks,
            country: d.country,
          })) : []}
          arcColor={(d: any) => {
            const intensity = d.attacks / 150;
            return [`rgba(255, 0, 0, ${intensity})`, 'rgba(255, 100, 0, 0.3)'];
          }}
          arcDashLength={0.4}
          arcDashGap={0.2}
          arcDashAnimateTime={2000}
          arcStroke={0.5}
          arcLabel={(d: any) => `
            <div style="background: rgba(0,0,0,0.8); padding: 8px; border-radius: 4px; border: 1px solid #ff0000;">
              <strong>🎯 ${d.country}</strong><br/>
              Attacks: ${d.attacks}
            </div>
          `}
          
          // Appearance
          atmosphereColor="#ff3333"
          atmosphereAltitude={0.18}
          width={undefined}
          height={undefined}

        />
      </div>
      {/* Legend */}
      <div className="legend">
        <h4>CyberX Global Threat Map</h4>
        <div className="legend-item">
          <span className="dot green"></span> Strong Signal
        </div>
        <div className="legend-item">
          <span className="dot red"></span> Downtime Zone
        </div>
        <div className="legend-item">
          <span className="dot blue"></span> 5G Coverage
        </div>
        <div className="legend-item">
          <span className="arc"></span> Attack Vector
        </div>
      </div>
    </div>
  );
};

export default WorldMap;
