'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { useQuestStore } from '@/store/questStore';

interface MapViewProps {
    className?: string;
}

export default function MapView({ className }: MapViewProps) {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const playerMarker = useRef<maplibregl.Marker | null>(null);
    const mapInitialized = useRef<boolean>(false);

    const currentLocation = useQuestStore((state) => state.currentLocation);
    const activeQuests = useQuestStore((state) => state.activeQuests);

    // Initialize map with REFGUARD to prevent React 18 Strict Mode double-mounting
    useEffect(() => {
        if (!mapContainer.current) return;

        // REF GUARD: Critical for React 18 Strict Mode + WebGL contexts
        if (mapInitialized.current || mapRef.current) {
            console.log('[MapView] Map already initialized, skipping...');
            return;
        }

        console.log('[MapView] Initializing map...');
        mapInitialized.current = true;

        // Create map centered on Athens, Greece
        const map = new maplibregl.Map({
            container: mapContainer.current,
            style: 'https://tiles.openfreemap.org/styles/liberty',
            center: [23.7275, 37.9838], // Athens [lng, lat]
            zoom: 13,
            attributionControl: true,
        });

        mapRef.current = map;

        // Wait for map to load before adding layers
        map.on('load', () => {
            console.log('[MapView] Map loaded, adding quest markers layer...');

            // Add empty GeoJSON source for quest markers
            map.addSource('quests', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: [],
                },
            });

            // Add Symbol Layer for MOVEMENT quests (purple)
            map.addLayer({
                id: 'quest-movement',
                type: 'symbol',
                source: 'quests',
                filter: ['==', ['get', 'questType'], 'MOVEMENT'],
                layout: {
                    'icon-image': 'marker-15',
                    'icon-size': 1.5,
                    'icon-allow-overlap': true,
                    'text-field': ['get', 'title'],
                    'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
                    'text-offset': [0, 1.5],
                    'text-anchor': 'top',
                    'text-size': 12,
                },
                paint: {
                    'icon-color': '#9d00ff',
                    'text-color': '#ffffff',
                    'text-halo-color': '#000000',
                    'text-halo-width': 1,
                },
            });

            // Add Symbol Layer for CHECKIN quests (pink)
            map.addLayer({
                id: 'quest-checkin',
                type: 'symbol',
                source: 'quests',
                filter: ['==', ['get', 'questType'], 'CHECKIN'],
                layout: {
                    'icon-image': 'star-15',
                    'icon-size': 1.5,
                    'icon-allow-overlap': true,
                    'text-field': ['get', 'title'],
                    'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
                    'text-offset': [0, 1.5],
                    'text-anchor': 'top',
                    'text-size': 12,
                },
                paint: {
                    'icon-color': '#ff0080',
                    'text-color': '#ffffff',
                    'text-halo-color': '#000000',
                    'text-halo-width': 1,
                },
            });

            // Add circle layer for check-in radius visualization
            map.addLayer({
                id: 'quest-checkin-radius',
                type: 'circle',
                source: 'quests',
                filter: ['==', ['get', 'questType'], 'CHECKIN'],
                paint: {
                    'circle-radius': 10,
                    'circle-color': '#ff0080',
                    'circle-opacity': 0.1,
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#ff0080',
                    'circle-stroke-opacity': 0.3,
                },
            });
        });

        // Add navigation controls
        map.addControl(new maplibregl.NavigationControl(), 'top-right');

        // Add scale control
        map.addControl(
            new maplibregl.ScaleControl({
                maxWidth: 80,
                unit: 'metric',
            }),
            'bottom-left'
        );

        // Add geolocate control (for real GPS)
        map.addControl(
            new maplibregl.GeolocateControl({
                positionOptions: {
                    enableHighAccuracy: true,
                },
                trackUserLocation: true,
            }),
            'top-right'
        );

        // Cleanup function
        return () => {
            console.log('[MapView] Cleaning up map...');
            map.remove();
            mapRef.current = null;
            mapInitialized.current = false;
        };
    }, []);

    // Update quest markers using WebGL Symbol Layers (NOT HTML Markers)
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !map.isStyleLoaded()) return;

        // Convert quests to GeoJSON features
        const features = activeQuests
            .filter((quest) => quest.targetCoordinates)
            .map((quest) => ({
                type: 'Feature' as const,
                properties: {
                    questId: quest.id,
                    questType: quest.type,
                    title: quest.title,
                    radiusMeters: quest.radiusMeters || 50,
                },
                geometry: {
                    type: 'Point' as const,
                    coordinates: [
                        quest.targetCoordinates!.lng,
                        quest.targetCoordinates!.lat,
                    ],
                },
            }));

        // Update GeoJSON source
        const source = map.getSource('quests') as maplibregl.GeoJSONSource;
        if (source) {
            source.setData({
                type: 'FeatureCollection',
                features,
            });
            console.log(`[MapView] Updated quest markers: ${features.length} quests`);
        }
    }, [activeQuests]);

    // Update player marker when location changes (HTML marker OK for single element)
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !currentLocation) return;

        if (!playerMarker.current) {
            const el = document.createElement('div');
            el.className = 'player-marker';
            el.style.width = '24px';
            el.style.height = '24px';

            playerMarker.current = new maplibregl.Marker({ element: el })
                .setLngLat([currentLocation.lng, currentLocation.lat])
                .addTo(map);

            map.flyTo({
                center: [currentLocation.lng, currentLocation.lat],
                zoom: 15,
                duration: 1000,
            });
        } else {
            playerMarker.current.setLngLat([currentLocation.lng, currentLocation.lat]);
            map.panTo([currentLocation.lng, currentLocation.lat], {
                duration: 300,
            });
        }
    }, [currentLocation]);

    return (
        <div
            ref={mapContainer}
            className={`w-full h-full ${className || ''}`}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        />
    );
}
