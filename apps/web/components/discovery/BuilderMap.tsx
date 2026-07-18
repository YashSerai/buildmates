"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker, Popup } from "maplibre-gl";
import type { MapStatistics } from "../../src/discovery/map-statistics";
import styles from "./BuilderMap.module.css";

export type CityAggregate = {
  cityId: string;
  label: string;
  latitude: number;
  longitude: number;
  builderCount: number;
  projectCount: number;
  connectionCount: number;
};

type MapStatus = "loading" | "ready" | "error";
const OPEN_FREE_MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

export function BuilderMap({ places, statistics, mapHidden = false }: { places: CityAggregate[]; statistics: MapStatistics; mapHidden?: boolean }) {
  const mapRoot = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<MapStatus>("loading");

  useEffect(() => {
    if (mapHidden || !mapRoot.current) return;
    let disposed = false;
    let map: MapLibreMap | undefined;
    let popup: Popup | undefined;
    const markers: Marker[] = [];
    const validPlaces = places.filter(isMappableCity);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    async function mountMap() {
      try {
        const maplibregl = await import("maplibre-gl");
        if (disposed || !mapRoot.current) return;
        map = new maplibregl.Map({ container: mapRoot.current, style: OPEN_FREE_MAP_STYLE, center: [0, 24], zoom: 1.25, minZoom: 1, maxZoom: 12, attributionControl: false, cooperativeGestures: true, fadeDuration: reduceMotion ? 0 : 300 });
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
        map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
        map.getCanvas().setAttribute("aria-label", "World map of aggregate Buildmates activity by city");
        map.getCanvas().setAttribute("role", "img");
        map.once("load", () => {
          if (disposed || !map) return;
          setStatus("ready");
          frameCities(map, validPlaces, maplibregl.LngLatBounds, reduceMotion);
        });
        map.on("error", () => { if (!disposed) setStatus("error"); });

        for (const place of validPlaces) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = styles.marker;
          button.style.setProperty("--marker-size", `${markerSize(place.builderCount)}px`);
          button.textContent = String(place.builderCount);
          button.setAttribute("aria-label", aggregateSummary(place));
          button.addEventListener("click", (event) => {
            event.stopPropagation();
            if (!map) return;
            popup?.remove();
            popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true, offset: 22 }).setLngLat([place.longitude, place.latitude]).setDOMContent(popupContent(place)).addTo(map);
            if (reduceMotion) map.jumpTo({ center: [place.longitude, place.latitude], zoom: Math.max(map.getZoom(), 3) });
            else map.easeTo({ center: [place.longitude, place.latitude], zoom: Math.max(map.getZoom(), 3), duration: 550 });
          });
          markers.push(new maplibregl.Marker({ element: button, anchor: "center" }).setLngLat([place.longitude, place.latitude]).addTo(map));
        }
      } catch {
        if (!disposed) setStatus("error");
      }
    }

    void mountMap();
    return () => {
      disposed = true;
      popup?.remove();
      markers.forEach((marker) => marker.remove());
      map?.remove();
    };
  }, [mapHidden, places]);

  return (
    <section className={styles.shell} aria-label="Builder activity map">
      <Statistics statistics={statistics} />
      {!mapHidden ? (
        <div className={styles.mapFrame} aria-busy={status === "loading"}>
          <div ref={mapRoot} className={styles.map} />
          {status === "loading" ? <p className={styles.mapState}>Loading city activity…</p> : null}
          {status === "error" ? <p className={styles.mapState} role="status">The map could not load. City totals are still available below.</p> : null}
          <p className={styles.srOnly} aria-live="polite">{status === "ready" ? "City activity map loaded." : ""}</p>
        </div>
      ) : null}
      {places.length ? (
        <div className={styles.transcript}>
          <header className={styles.transcriptHead}><h2>Builders by city</h2><p>See the communities taking shape across Buildmates.</p></header>
          <ol className={styles.cityList}>{places.map((place) => <li className={styles.city} key={place.cityId}><h3>{place.label}</h3><AggregateStat value={place.builderCount} noun="builder" /><AggregateStat value={place.projectCount} noun="project" /><AggregateStat value={place.connectionCount} noun="connection" /></li>)}</ol>
        </div>
      ) : null}
    </section>
  );
}

function Statistics({ statistics }: { statistics: MapStatistics }) {
  const items = [["Builders", statistics.publishedBuilderCount], ["Builders on the map", statistics.mappedBuilderCount], ["Cities shown", statistics.qualifyingCityCount], ["Active projects", statistics.publicProjectCount], ["Topics in the graph", statistics.publicTopicCount], ["Connections formed", statistics.connectionCount]] as const;
  return <dl className={styles.statistics}>{items.map(([label, value]) => <div className={styles.statistic} key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}

function AggregateStat({ value, noun }: { value: number; noun: string }) { return <span className={styles.stat}><strong>{value}</strong><span>{pluralize(value, noun)}</span></span>; }
function isMappableCity(place: CityAggregate) { return Number.isFinite(place.latitude) && Number.isFinite(place.longitude) && place.latitude >= -90 && place.latitude <= 90 && place.longitude >= -180 && place.longitude <= 180; }
function markerSize(builderCount: number) { return Math.max(42, Math.min(76, 34 + Math.sqrt(Math.max(0, builderCount)) * 5)); }
function aggregateSummary(place: CityAggregate) { return `${place.label}: ${place.builderCount} ${pluralize(place.builderCount, "builder")}, ${place.projectCount} active ${pluralize(place.projectCount, "project")}, ${place.connectionCount} ${pluralize(place.connectionCount, "connection")} made`; }
function popupContent(place: CityAggregate) {
  const root = document.createElement("div");
  const heading = document.createElement("h3");
  const stats = document.createElement("p");
  heading.className = styles.popupTitle;
  heading.textContent = place.label;
  stats.className = styles.popupStats;
  stats.textContent = `${place.builderCount} ${pluralize(place.builderCount, "builder")} | ${place.projectCount} active ${pluralize(place.projectCount, "project")} | ${place.connectionCount} ${pluralize(place.connectionCount, "connection")}`;
  root.appendChild(heading);
  root.appendChild(stats);
  return root;
}
function pluralize(value: number, noun: string) { return value === 1 ? noun : `${noun}s`; }
function frameCities(map: MapLibreMap, places: CityAggregate[], Bounds: typeof import("maplibre-gl").LngLatBounds, reduceMotion: boolean) { if (!places.length) return; if (places.length === 1) { map.jumpTo({ center: [places[0].longitude, places[0].latitude], zoom: 3 }); return; } const bounds = new Bounds(); places.forEach((place) => bounds.extend([place.longitude, place.latitude])); map.fitBounds(bounds, { padding: 72, maxZoom: 5, duration: reduceMotion ? 0 : 650 }); }
