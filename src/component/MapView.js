import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { normalizePercent, pct } from '../utils/data';

const MapView = ({ geo, setFilter }) => {
  const mapRef = useRef(null);

  useEffect(() => {
    // Check if a map instance already exists
    if (mapRef.current) {
      mapRef.current.off();
      mapRef.current.remove();
    }

    const newMap = L.map('map', { preferCanvas: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
      minZoom: 4,
    }).addTo(newMap);

    const latlngs = [];
    geo.forEach((g) => {
      const ok = g.Latitude != null && g.Longitude != null;
      if (!ok) return;
      const ll = L.latLng(Number(g.Latitude), Number(g.Longitude));
      latlngs.push(ll);
      L.marker(ll)
        .addTo(newMap)
        .bindPopup(`<b>${g["الموقع"]}</b><br>مخطط: ${pct(normalizePercent(g["متوسط النسبة المخططة"]))}<br>فعلي: ${pct(normalizePercent(g["متوسط النسبة الفعلية"]))}`)
        .on('click', () => setFilter('site', g['الموقع']));
    });

    if (latlngs.length > 0) {
      newMap.fitBounds(L.latLngBounds(latlngs).pad(0.12), { padding: [48, 48], maxZoom: 6, animate: true });
    } else {
      newMap.setView([24.7136, 46.6753], 6);
    }

    mapRef.current = newMap;

    return () => {
      // Cleanup function to remove map instance on component unmount
      if (mapRef.current) {
        mapRef.current.off();
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [geo, setFilter]);

  return (
    <section className="panel-card dashboard-map-panel summary-grid__map">
      <div className="panel-header dashboard-panel-header">
        <h3>المواقع</h3>
      </div>
      <div id="map" className="dashboard-map"></div>
    </section>
  );
};

export default MapView;