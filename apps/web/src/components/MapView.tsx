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

    // Initialize map with REF GUARD to prevent React 18 Strict Mode double-mounting
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
            attributionControl: {
                compact: true,
            },
        });

        mapRef.current = map;

        // Listen for debug recenter events
        const handleRecenter = (e: Event) => {
            const customEvent = e as CustomEvent;
            const { lat, lng } = customEvent.detail;
            map.flyTo({
                center: [lng, lat],
                zoom: 15,
                essential: true
            });
        };
        window.addEventListener('map-recenter', handleRecenter);

        // Listen for debug landmark spawn events
        const handleSpawnLandmark = (e: Event) => {
            const customEvent = e as CustomEvent;
            const { lat, lng } = customEvent.detail;

            // Query for POIs in the current view
            // Try common POI layer names
            const features = map.queryRenderedFeatures({
                layers: ['poi', 'poi-label', 'poi_label', 'poi-level-1']
            });

            let targetLat = lat + (Math.random() - 0.5) * 0.01; // Default fallback: ~1km random
            let targetLng = lng + (Math.random() - 0.5) * 0.01;
            let title = 'Unknown Landmark';
            let description = 'A mysterious location nearby.';

            if (features && features.length > 0) {
                // Find nearest POI
                let minDist = Infinity;
                let nearestFeature = null;

                features.forEach(f => {
                    if (f.geometry.type === 'Point') {
                        const coords = f.geometry.coordinates;
                        // Simple Euclidean distance for comparison (fast)
                        const dist = Math.pow(coords[1] - lat, 2) + Math.pow(coords[0] - lng, 2);
                        if (dist < minDist) {
                            minDist = dist;
                            nearestFeature = f;
                        }
                    }
                });

                if (nearestFeature) {
                    const f = nearestFeature as maplibregl.MapGeoJSONFeature;
                    const geometry = f.geometry as GeoJSON.Point;
                    const coords = geometry.coordinates;
                    targetLat = coords[1];
                    targetLng = coords[0];
                    title = f.properties?.name || f.properties?.name_en || 'Local Landmark';
                    description = `Investigate the area around ${title}.`;
                    console.log('[Debug] Found landmark:', title, coords);
                }
            } else {
                console.log('[Debug] No POIs found, using random location');
            }

            window.dispatchEvent(new CustomEvent('landmark-found', {
                detail: { lat: targetLat, lng: targetLng, title, description }
            }));
        };
        window.addEventListener('debug-spawn-landmark', handleSpawnLandmark);

        // QUICK PLACE: Right-click or Double-click to teleport
        const handleQuickPlace = (e: maplibregl.MapMouseEvent) => {
            const { quickPlaceEnabled, updateLocation } = useQuestStore.getState();
            if (!quickPlaceEnabled) return;

            e.preventDefault(); // Prevent default context menu or zoom

            const { lng, lat } = e.lngLat;
            console.log('[QuickPlace] Teleporting to:', lat, lng);

            updateLocation({
                lat,
                lng,
                timestamp: Date.now(),
                speed: 0
            });
        };

        map.on('contextmenu', handleQuickPlace);
        map.on('dblclick', (e) => {
            const { quickPlaceEnabled } = useQuestStore.getState();
            if (quickPlaceEnabled) {
                // Prevent zoom only if quick place is enabled
                e.preventDefault();
                handleQuickPlace(e);
            }
        });

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

            // Add Circle Layer for MOVEMENT quests (purple)
            map.addLayer({
                id: 'quest-movement',
                type: 'circle',
                source: 'quests',
                filter: ['==', ['get', 'questType'], 'MOVEMENT'],
                paint: {
                    'circle-radius': 8,
                    'circle-color': '#9d00ff',
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#ffffff',
                },
            });

            // Add Symbol Layer for MOVEMENT labels
            map.addLayer({
                id: 'quest-movement-label',
                type: 'symbol',
                source: 'quests',
                filter: ['==', ['get', 'questType'], 'MOVEMENT'],
                layout: {
                    'text-field': ['get', 'title'],
                    'text-font': ['Noto Sans Regular'],
                    'text-offset': [0, 1.5],
                    'text-anchor': 'top',
                    'text-size': 12,
                },
                paint: {
                    'text-color': '#ffffff',
                    'text-halo-color': '#000000',
                    'text-halo-width': 1,
                },
            });

            // Add Circle Layer for CHECKIN quests (pink)
            map.addLayer({
                id: 'quest-checkin',
                type: 'circle',
                source: 'quests',
                filter: ['==', ['get', 'questType'], 'CHECKIN'],
                paint: {
                    'circle-radius': 8,
                    'circle-color': '#ff0080',
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#ffffff',
                },
            });

            // Add Symbol Layer for CHECKIN labels
            map.addLayer({
                id: 'quest-checkin-label',
                type: 'symbol',
                source: 'quests',
                filter: ['==', ['get', 'questType'], 'CHECKIN'],
                layout: {
                    'text-field': ['get', 'title'],
                    'text-font': ['Noto Sans Regular'],
                    'text-offset': [0, 1.5],
                    'text-anchor': 'top',
                    'text-size': 12,
                },
                paint: {
                    'text-color': '#ffffff',
                    'text-halo-color': '#000000',
                    'text-halo-width': 1,
                },
            });

            // Add Circle Layer for MYSTERY quests (yellow)
            map.addLayer({
                id: 'quest-mystery-point',
                type: 'circle',
                source: 'quests',
                filter: ['==', ['get', 'questType'], 'MYSTERY'],
                paint: {
                    'circle-radius': 10,
                    'circle-color': '#FFD700',
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#000000',
                },
            });

            // Add Symbol Layer for MYSTERY quests (yellow question mark)
            map.addLayer({
                id: 'quest-mystery',
                type: 'symbol',
                source: 'quests',
                filter: ['==', ['get', 'questType'], 'MYSTERY'],
                layout: {
                    'text-field': '?',
                    'text-font': ['Noto Sans Regular'],
                    'text-size': 20,
                    'text-offset': [0, 0],
                    'text-anchor': 'center',
                    'icon-allow-overlap': true,
                },
                paint: {
                    'text-color': '#000000', // Black text on yellow circle
                },
            });

            // Add circle layer for mystery radius
            map.addLayer({
                id: 'quest-mystery-radius',
                type: 'circle',
                source: 'quests',
                filter: ['==', ['get', 'questType'], 'MYSTERY'],
                paint: {
                    'circle-radius': 15, // Visual radius
                    'circle-color': '#FFD700',
                    'circle-opacity': 0.2,
                    'circle-stroke-width': 1,
                    'circle-stroke-color': '#FFD700',
                    'circle-stroke-opacity': 0.5,
                },
            });

            // Click handler for ALL quest layers
            const questLayers = ['quest-movement', 'quest-checkin', 'quest-mystery', 'quest-mystery-radius', 'quest-mystery-point'];

            questLayers.forEach(layerId => {
                map.on('click', layerId, (e) => {
                    if (!e.features || e.features.length === 0) return;

                    const feature = e.features[0];
                    const props = feature.properties;

                    if (props && props.questId) {
                        // Dispatch custom event for UI to handle
                        const event = new CustomEvent('quest-marker-click', {
                            detail: { questId: props.questId }
                        });
                        window.dispatchEvent(event);
                    }
                });

                // Change cursor on hover
                map.on('mouseenter', layerId, () => {
                    map.getCanvas().style.cursor = 'pointer';
                });
                map.on('mouseleave', layerId, () => {
                    map.getCanvas().style.cursor = '';
                });
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
