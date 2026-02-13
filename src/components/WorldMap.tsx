import { useState, useRef, useEffect, useMemo } from "react";
import Globe from "react-globe.gl";
import countriesGeoJson from "../data/countries.geo.json";
import broadbandData from "../data/broadband_processed.json";
import fiveGData from "../data/fiveg_coverage.json";
import { attackOrigins } from "../data/mapLayers";

import isoCountries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import "./WorldMap.css";

isoCountries.registerLocale(enLocale);

type Layer = "signal" | "5g" | "attacks";

export default function WorldMap() {

  const globeEl = useRef<any>();

  const [activeLayer, setActiveLayer] = useState<Layer>("signal");

  /* -------------------- INIT -------------------- */

  useEffect(() => {
    if (!globeEl.current) return;

    const controls = globeEl.current.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.4;
    controls.enablePan = false;
  }, []);

  /* -------------------- BUILD LOOKUP MAPS -------------------- */

  const signalMap = useMemo(() => {
    const map: Record<string, number> = {};
    broadbandData.forEach((c: any) => {
      if (c.iso) {
        map[c.iso.toUpperCase()] = Number(c.download);
      }
    });
    return map;
  }, []);


  const fiveGMap = useMemo(() => {
    const map: Record<string, number> = {};
    fiveGData.forEach((c: any) => {
      const iso2 = isoCountries.getAlpha2Code(c.country, "en");
      if (iso2) map[iso2] = Number(c.coverage);
    });
    return map;
  }, []);

  /* -------------------- COLOR HELPERS -------------------- */

  const speedColor = (v?: number) => {
    if (!v) return "rgba(70,70,70,0.15)";
    if (v > 200) return "rgba(0,255,140,0.7)";
    if (v > 120) return "rgba(0,200,255,0.7)";
    if (v > 60) return "rgba(255,200,0,0.65)";
    return "rgba(255,70,70,0.6)";
  };

  const coverageColor = (v?: number) => {
    if (!v) return "rgba(70,70,70,0.15)";
    if (v > 0.8) return "rgba(0,200,255,0.7)";
    if (v > 0.6) return "rgba(0,140,255,0.65)";
    if (v > 0.4) return "rgba(0,90,200,0.6)";
    return "rgba(0,60,140,0.55)";
  };

  
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPulse(p => (p + 0.03) % 1);
    }, 40);
    return () => clearInterval(interval);
  }, []);

/* -------------------- UI -------------------- */


  return (
    <div className="world-map-container">

      {/* -------- LAYER PANEL -------- */}
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
        </button>

        <button
          className={activeLayer === "attacks" ? "active" : ""}
          onClick={() => setActiveLayer("attacks")}
        >
          🎯 Attack Origins
        </button>
      </div>

      {/* -------- GLOBE -------- */}
      <div className="globe-wrapper">

        <Globe
          ref={globeEl}

          globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"

          width={window.innerWidth}
          height={window.innerHeight}

          /* ---------- COUNTRY POLYGONS ---------- */

          polygonsData={
            activeLayer === "signal" || activeLayer === "5g"
              ? countriesGeoJson.features
              : []
          }

          polygonAltitude={(d: any) => {
            if (activeLayer !== "signal") return 0.01;
            const iso2 = isoCountries.alpha3ToAlpha2(d.id);
            const speed = signalMap[iso2];
            return speed ? Math.min(speed / 800, 0.08) : 0.005;
          }}


          polygonCapColor={(d: any) => {
            const iso2 = isoCountries.alpha3ToAlpha2(d.id);
                    
            if (activeLayer === "signal") {
              const v = signalMap[iso2];
              if (!v) return "rgba(70,70,70,0.12)";
            
              const intensity = (Math.sin(pulse * Math.PI * 2) + 1) / 2;
            
              if (v > 200)
                return `rgba(0,255,140,${0.5 + intensity * 0.4})`;
            
              if (v > 120)
                return `rgba(0,200,255,${0.5 + intensity * 0.4})`;
            
              if (v > 60)
                return `rgba(255,200,0,${0.45 + intensity * 0.3})`;
            
              return `rgba(255,70,70,${0.4 + intensity * 0.3})`;
            }
          
            if (activeLayer === "5g") {
              const v = fiveGMap[iso2];
              return coverageColor(v);
            }
          
            return "rgba(0,0,0,0)";
          }}
          

          polygonSideColor={() => "rgba(255,255,255,0.08)"}
          polygonStrokeColor={() => "#111"}

          polygonLabel={(d: any) => {
            const iso2 = isoCountries.alpha3ToAlpha2(d.id);

            if (activeLayer === "signal") {
              const v = signalMap[iso2];
              return `<b>${d.properties.name}</b><br/>Speed: ${v ?? "N/A"} Mbps`;
            }

            if (activeLayer === "5g") {
              const v = fiveGMap[iso2];
              return `<b>${d.properties.name}</b><br/>5G Index: ${v ?? "N/A"}`;
            }

            return d.properties.name;
          }}

          /* ---------- ATTACK ARCS ---------- */

          arcsData={
            activeLayer === "attacks"
              ? attackOrigins.map(a => ({
                  startLat: a.lat,
                  startLng: a.lng,
                  endLat: 13.0827,
                  endLng: 80.2707,
                  attacks: a.attacks,
                  country: a.country
                }))
              : []
          }

          arcColor={(d: any) => [
            `rgba(255,0,0,${d.attacks / 120})`,
            "rgba(255,150,0,0.4)"
          ]}

          arcDashLength={0.4}
          arcDashGap={0.2}
          arcDashAnimateTime={2500}
          arcStroke={0.6}
        />
      </div>

    </div>
  );
}
