"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap, Popup } from "maplibre-gl";
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
const CITY_SOURCE = "builder-city-activity";
const CLUSTER_LAYER = "builder-city-clusters";
const CLUSTER_COUNT_LAYER = "builder-city-cluster-count";
const CITY_LAYER = "builder-city-points";
const CITY_COUNT_LAYER = "builder-city-point-count";

export function BuilderMap({ places, statistics, mapHidden = false }: { places: CityAggregate[]; statistics: MapStatistics; mapHidden?: boolean }) {
  const mapRoot = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<MapStatus>("loading");

  useEffect(() => {
    if (mapHidden || !mapRoot.current) return;
    let disposed = false;
    let map: MapLibreMap | undefined;
    let popup: Popup | undefined;
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
          map.addSource(CITY_SOURCE, {
            type: "geojson",
            data: cityFeatureCollection(validPlaces),
            cluster: true,
            clusterMaxZoom: 9,
            clusterRadius: 64,
            clusterProperties: {
              builderTotal: ["+", ["get", "builderCount"]],
              projectTotal: ["+", ["get", "projectCount"]],
              connectionTotal: ["+", ["get", "connectionCount"]],
            },
          });
          addCityLayers(map);
          setStatus("ready");
          frameCities(map, validPlaces, maplibregl.LngLatBounds, reduceMotion);
        });
        map.on("error", () => { if (!disposed) setStatus("error"); });
        map.on("click", CLUSTER_LAYER, async (event) => {
          const feature = event.features?.[0];
          if (!map || !feature || feature.geometry.type !== "Point") return;
          const clusterId = Number(feature.properties?.cluster_id);
          const source = map.getSource(CITY_SOURCE) as GeoJSONSource | undefined;
          if (!source || !Number.isFinite(clusterId)) return;
          popup?.remove();
          const zoom = await source.getClusterExpansionZoom(clusterId);
          const center = feature.geometry.coordinates as [number, number];
          if (reduceMotion) map.jumpTo({ center, zoom });
          else map.easeTo({ center, zoom, duration: 420 });
        });
        map.on("click", CITY_LAYER, (event) => {
          const feature = event.features?.[0];
          if (!map || !feature || feature.geometry.type !== "Point") return;
          const properties = feature.properties ?? {};
          const place = cityFromProperties(properties, feature.geometry.coordinates as [number, number]);
          popup?.remove();
          popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true, offset: 20 })
            .setLngLat([place.longitude, place.latitude])
            .setDOMContent(popupContent(place))
            .addTo(map);
        });
        for (const layer of [CLUSTER_LAYER, CITY_LAYER]) {
          map.on("mouseenter", layer, () => { if (map) map.getCanvas().style.cursor = "pointer"; });
          map.on("mouseleave", layer, () => { if (map) map.getCanvas().style.cursor = ""; });
        }
      } catch {
        if (!disposed) setStatus("error");
      }
    }

    void mountMap();
    return () => {
      disposed = true;
      popup?.remove();
      map?.remove();
    };
  }, [mapHidden, places]);

  return (
    <section className={styles.shell} aria-label="Builder activity map">
      <Statistics statistics={statistics} />
      {!mapHidden ? (
        <div className={styles.mapFrame} aria-busy={status === "loading"}>
          <div ref={mapRoot} className={styles.map} />
          {status === "ready" ? <p className={styles.mapHint}>Select a cluster to zoom in. Nearby cities separate as you get closer.</p> : null}
          {status === "loading" ? <p className={styles.mapState}>Loading city activity…</p> : null}
          {status === "error" ? <p className={styles.mapState} role="status">The map could not load. City totals are still available below.</p> : null}
          <p className={styles.srOnly} aria-live="polite">{status === "ready" ? "City activity map loaded." : ""}</p>
        </div>
      ) : null}
      {places.length ? (
        <div className={styles.transcript}>
          <header className={styles.transcriptHead}><h2>Builders by city</h2><p>Nearby cities combine on the map at wider zoom levels. This list keeps every city total available.</p></header>
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
function cityFeatureCollection(places: CityAggregate[]) {
  return {
    type: "FeatureCollection" as const,
    features: places.map((place) => ({
      type: "Feature" as const,
      id: place.cityId,
      geometry: { type: "Point" as const, coordinates: [place.longitude, place.latitude] },
      properties: { ...place },
    })),
  };
}
function addCityLayers(map: MapLibreMap) {
  map.addLayer({ id: CLUSTER_LAYER, type: "circle", source: CITY_SOURCE, filter: ["has", "point_count"], paint: {
    "circle-color": ["step", ["get", "builderTotal"], "#53604c", 20, "#366348", 50, "#244f39", 100, "#183a2a"],
    "circle-radius": ["step", ["get", "builderTotal"], 24, 20, 29, 50, 35, 100, 42],
    "circle-stroke-width": 3, "circle-stroke-color": "#f3f0e7", "circle-opacity": 0.96,
  }});
  map.addLayer({ id: CLUSTER_COUNT_LAYER, type: "symbol", source: CITY_SOURCE, filter: ["has", "point_count"], layout: {
    "text-field": ["to-string", ["get", "builderTotal"]], "text-font": ["Noto Sans Bold"], "text-size": 13,
  }, paint: { "text-color": "#fffdf7" } });
  map.addLayer({ id: CITY_LAYER, type: "circle", source: CITY_SOURCE, filter: ["!", ["has", "point_count"]], paint: {
    "circle-color": "#244f39", "circle-radius": ["step", ["get", "builderCount"], 19, 5, 22, 10, 26],
    "circle-stroke-width": 3, "circle-stroke-color": "#f3f0e7", "circle-opacity": 0.97,
  }});
  map.addLayer({ id: CITY_COUNT_LAYER, type: "symbol", source: CITY_SOURCE, filter: ["!", ["has", "point_count"]], layout: {
    "text-field": ["to-string", ["get", "builderCount"]], "text-font": ["Noto Sans Bold"], "text-size": 12,
  }, paint: { "text-color": "#fffdf7" } });
}
function cityFromProperties(properties: Record<string, unknown>, coordinates: [number, number]): CityAggregate {
  return {
    cityId: String(properties.cityId ?? "city"), label: String(properties.label ?? "City"),
    longitude: coordinates[0], latitude: coordinates[1], builderCount: Number(properties.builderCount ?? 0),
    projectCount: Number(properties.projectCount ?? 0), connectionCount: Number(properties.connectionCount ?? 0),
  };
}
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
