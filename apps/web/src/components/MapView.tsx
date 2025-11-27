'use client';

import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { useQuestStore } from '@/store/questStore';
import { mockLocationService } from '@/services/MockLocationService';

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

    const updateQuestMarkers = () => {
        const map = mapRef.current;
        if (!map || !map.getSource('quests')) return;

        const quests = useQuestStore.getState().activeQuests;

        const features = quests
            .filter(q => !!q.targetCoordinates)
            .map(q => ({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [q.targetCoordinates!.lng, q.targetCoordinates!.lat]
                },
                properties: {
                    questId: q.id,
                    questType: q.type,
                    title: q.title,
                    description: q.description
                }
            }));

        (map.getSource('quests') as maplibregl.GeoJSONSource).setData({
            type: 'FeatureCollection',
            features: features as any
        });
    };

    // Update markers when activeQuests changes
    useEffect(() => {
        updateQuestMarkers();
    }, [activeQuests]);

    // Custom map style function (cyber theme)
    const customizeMapStyle = useCallback(() => {
        const map = mapRef.current;
        if (!map) return;

        const { mapTheme } = useQuestStore.getState();

        // If default theme, we don't apply custom paints
        if (mapTheme === 'default') return;

        const style = map.getStyle();
        if (!style || !style.layers) return;

        const uiGold = '#D4AF37'; // Metallic Gold
        const lightPurple = '#d8bfd8'; // Thistle
        const darkPurpleBase = '#150a1a'; // Dark Purple Base
        const waterColor = '#2a1633'; // Deep Purple Water

        // 1. Force Background
        let hasBackground = false;
        style.layers.forEach((layer) => {
            if (layer.type === 'background') {
                map.setPaintProperty(layer.id, 'background-color', darkPurpleBase);
                hasBackground = true;
            }
        });

        if (!hasBackground) {
            // Check if we already added it
            if (!map.getLayer('custom-background')) {
                map.addLayer({
                    id: 'custom-background',
                    type: 'background',
                    paint: {
                        'background-color': darkPurpleBase
                    }
                }, style.layers[0].id);
            }
        }

        style.layers.forEach((layer) => {
            // 2. Water
            if (layer.id.includes('water') || layer.id.includes('ocean')) {
                if (layer.type === 'fill') {
                    map.setPaintProperty(layer.id, 'fill-color', waterColor);
                }
            }

            // 3. Land / Earth
            if (layer.id.includes('land') || layer.id.includes('earth') || layer.id.includes('ground')) {
                if (layer.type === 'fill') {
                    map.setPaintProperty(layer.id, 'fill-color', darkPurpleBase);
                    map.setPaintProperty(layer.id, 'fill-opacity', 1);
                }
            }

            // 4. Roads
            if (layer.id.includes('road') || layer.id.includes('transportation') || layer.id.includes('street') || layer.id.includes('highway') || layer.id.includes('path')) {
                if (layer.type === 'line') {
                    map.setPaintProperty(layer.id, 'line-color', uiGold);
                    map.setPaintProperty(layer.id, 'line-opacity', 0.5);
                }
            }

            // 5. Buildings & Landuse
            if (layer.id.includes('building') || layer.id.includes('landuse') || layer.id.includes('landcover') || layer.id.includes('park') || layer.id.includes('grass')) {
                if (layer.type === 'fill') {
                    map.setPaintProperty(layer.id, 'fill-color', lightPurple);
                    map.setPaintProperty(layer.id, 'fill-opacity', 0.12);
                }
                if (layer.type === 'fill-extrusion') {
                    map.setPaintProperty(layer.id, 'fill-extrusion-color', lightPurple);
                    map.setPaintProperty(layer.id, 'fill-extrusion-opacity', 0.12);
                }
            }

            // 6. Text labels
            if (layer.type === 'symbol') {
                if (layer.layout && layer.layout['text-field']) {
                    map.setPaintProperty(layer.id, 'text-color', '#e0e0e0');
                    map.setPaintProperty(layer.id, 'text-halo-color', '#000000');
                    map.setPaintProperty(layer.id, 'text-halo-width', 1);
                }
            }
        });
        console.log('[MapView] Custom map style applied');
    }, []);

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

        // Listen for debug teleport center events
        const handleTeleportCenter = () => {
            const { quickPlaceEnabled, updateLocation, useMockGPS } = useQuestStore.getState();
            if (!quickPlaceEnabled) {
                console.log('[QuickPlace] Teleport disabled');
                return;
            }

            const center = map.getCenter();
            const { lng, lat } = center;
            console.log('[QuickPlace] Teleporting to center:', lat, lng);

            // If using mock GPS, update the mock service's internal location to persist
            if (useMockGPS) {
                mockLocationService.teleportTo(lat, lng);
            }

            // Update store for immediate UI responsiveness
            updateLocation({
                lat,
                lng,
                timestamp: Date.now(),
                speed: 0
            });
        };
        window.addEventListener('debug-teleport-center', handleTeleportCenter);

        // QUICK PLACE: Right-click or Double-click to teleport
        const handleQuickPlace = (e: maplibregl.MapMouseEvent) => {
            const { quickPlaceEnabled, updateLocation, useMockGPS } = useQuestStore.getState();
            if (!quickPlaceEnabled) return;

            e.preventDefault(); // Prevent default context menu or zoom

            const { lng, lat } = e.lngLat;
            console.log('[QuickPlace] Teleporting to:', lat, lng);

            // If using mock GPS, update the mock service's internal location to persist
            if (useMockGPS) {
                mockLocationService.teleportTo(lat, lng);
            }

            // Update store for immediate UI responsiveness
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

            // Helper to add SVG image to map
            const addImage = (id: string, svg: string) => {
                const img = new Image(48, 48);
                img.onload = () => map.addImage(id, img);
                img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
            };

            // Add Milestone Icon (Premium Star/Trophy Style)
            addImage('milestone-icon', `
                <svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="gold-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" style="stop-color:#FFD700;stop-opacity:1" />
                            <stop offset="100%" style="stop-color:#FFA500;stop-opacity:1" />
                        </linearGradient>
                        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                            <feMerge>
                                <feMergeNode in="coloredBlur"/>
                                <feMergeNode in="SourceGraphic"/>
                            </feMerge>
                        </filter>
                    </defs>
                    <g filter="url(#glow)">
                        <!-- Outer Ring -->
                        <circle cx="32" cy="32" r="28" fill="none" stroke="url(#gold-gradient)" stroke-width="3" stroke-dasharray="4 2"/>
                        <!-- Inner Star Background -->
                        <circle cx="32" cy="32" r="24" fill="#2a2a2a" stroke="#B45309" stroke-width="1" opacity="0.9"/>
                        <!-- Star Shape -->
                        <path d="M32 8l7.5 15.5L56 26l-12 11.5L47 54l-15-8-15 8 3-16.5L8 26l16.5-2.5L32 8z" fill="url(#gold-gradient)" stroke="#FFFFFF" stroke-width="1.5"/>
                    </g>
                </svg>
            `);

            // Add Mystery Icon (Modern Question Mark)
            addImage('mystery-icon', `
                <svg width="56" height="56" viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="mystery-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" style="stop-color:#9d00ff;stop-opacity:1" />
                            <stop offset="100%" style="stop-color:#6a00ff;stop-opacity:1" />
                        </linearGradient>
                        <filter id="mystery-shadow">
                            <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.5"/>
                        </filter>
                    </defs>
                    <g filter="url(#mystery-shadow)">
                        <!-- Background Hexagon-ish shape -->
                        <path d="M28 4 L52 16 L52 40 L28 52 L4 40 L4 16 Z" fill="#1a1a1a" stroke="url(#mystery-gradient)" stroke-width="2.5"/>
                        <!-- Question Mark -->
                        <text x="50%" y="50%" text-anchor="middle" dy=".35em" font-family="Arial, sans-serif" font-weight="900" font-size="32" fill="url(#mystery-gradient)" stroke="#ffffff" stroke-width="1">?</text>
                    </g>
                </svg>
            `);

            // Add Local Icon (Cyan Map Pin)
            addImage('local-icon', `
                <svg width="56" height="56" viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="local-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" style="stop-color:#22d3ee;stop-opacity:1" />
                            <stop offset="100%" style="stop-color:#06b6d4;stop-opacity:1" />
                        </linearGradient>
                        <filter id="local-shadow">
                            <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.5"/>
                        </filter>
                    </defs>
                    <g filter="url(#local-shadow)">
                        <!-- Map Pin Shape -->
                        <path d="M28 4 C17 4 8 13 8 24 C8 39 28 52 28 52 C28 52 48 39 48 24 C48 13 39 4 28 4 Z" fill="#1a1a1a" stroke="url(#local-gradient)" stroke-width="2.5"/>
                        <!-- Inner Dot -->
                        <circle cx="28" cy="24" r="8" fill="url(#local-gradient)" stroke="#ffffff" stroke-width="1"/>
                    </g>
                </svg>
            `);

            // Add empty GeoJSON source for quest markers
            map.addSource('quests', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: [],
                },
            });

            // Apply initial custom style if in cyber mode
            customizeMapStyle();

            // Re-apply if style reloads (for theme switching)
            map.on('styledata', () => {
                customizeMapStyle();
            });

            // Add Range Circle Layer for MOVEMENT quests (faint purple)
            map.addLayer({
                id: 'quest-movement-range',
                type: 'circle',
                source: 'quests',
                filter: ['==', ['get', 'questType'], 'MOVEMENT'],
                paint: {
                    'circle-radius': [
                        'interpolate', ['exponential', 2], ['zoom'],
                        8, 0.16,
                        22, 2560
                    ], // Visual range scales with zoom (40m ~= 20px at z15)
                    'circle-color': '#9d00ff',
                    'circle-opacity': 0.15,
                    'circle-stroke-width': 1,
                    'circle-stroke-color': '#9d00ff',
                    'circle-stroke-opacity': 0.3,
                },
            });

            // Add Circle Layer for MOVEMENT quests (purple)
            map.addLayer({
                id: 'quest-movement',
                type: 'circle',
                source: 'quests',
                filter: ['==', ['get', 'questType'], 'MOVEMENT'],
                paint: {
                    'circle-radius': 12, // Larger touch target
                    'circle-color': '#9d00ff',
                    'circle-stroke-width': 3,
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
                    'text-offset': [0, 2],
                    'text-anchor': 'top',
                    'text-size': 14, // Larger text
                },
                paint: {
                    'text-color': '#ffffff',
                    'text-halo-color': '#000000',
                    'text-halo-width': 2,
                },
            });

            // Add Range Circle Layer for CHECKIN quests (faint pink)
            map.addLayer({
                id: 'quest-checkin-range',
                type: 'circle',
                source: 'quests',
                filter: ['==', ['get', 'questType'], 'CHECKIN'],
                paint: {
                    'circle-radius': [
                        'interpolate', ['exponential', 2], ['zoom'],
                        8, 0.20,
                        22, 3200
                    ], // 50m ~= 25px at z15
                    'circle-color': '#ff0080',
                    'circle-opacity': 0.15,
                    'circle-stroke-width': 1,
                    'circle-stroke-color': '#ff0080',
                    'circle-stroke-opacity': 0.3,
                },
            });

            // Add Circle Layer for CHECKIN quests (pink)
            map.addLayer({
                id: 'quest-checkin',
                type: 'circle',
                source: 'quests',
                filter: ['==', ['get', 'questType'], 'CHECKIN'],
                paint: {
                    'circle-radius': 12, // Larger touch target
                    'circle-color': '#ff0080',
                    'circle-stroke-width': 3,
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
                    'text-offset': [0, 2],
                    'text-anchor': 'top',
                    'text-size': 14,
                },
                paint: {
                    'text-color': '#ffffff',
                    'text-halo-color': '#000000',
                    'text-halo-width': 2,
                },
            });

            // Add Symbol Layer for MYSTERY quests (Using SVG Icon)
            map.addLayer({
                id: 'quest-mystery',
                type: 'symbol',
                source: 'quests',
                filter: ['==', ['get', 'questType'], 'MYSTERY'],
                layout: {
                    'icon-image': 'mystery-icon',
                    'icon-size': 1.0,
                    'icon-allow-overlap': true,
                },
            });

            // Add circle layer for mystery radius
            map.addLayer({
                id: 'quest-mystery-radius',
                type: 'circle',
                source: 'quests',
                filter: ['==', ['get', 'questType'], 'MYSTERY'],
                paint: {
                    'circle-radius': [
                        'interpolate', ['exponential', 2], ['zoom'],
                        8, 0.12,
                        22, 1920
                    ], // Larger Visual radius scales with zoom (30m ~= 15px at z15)
                    'circle-color': '#FFD700',
                    'circle-opacity': 0.15,
                    'circle-stroke-width': 1,
                    'circle-stroke-color': '#FFD700',
                    'circle-stroke-opacity': 0.5,
                },
            });

            // --- LOCAL QUEST LAYERS ---

            // Add Symbol Layer for LOCAL quests (Using SVG Icon)
            map.addLayer({
                id: 'quest-local-icon',
                type: 'symbol',
                source: 'quests',
                filter: ['==', ['get', 'questType'], 'LOCAL'],
                layout: {
                    'icon-image': 'local-icon',
                    'icon-size': 1.0,
                    'icon-allow-overlap': true,
                    'icon-anchor': 'bottom', // Pin points to location
                },
            });

            // Add circle layer for local radius (Same size as mystery)
            map.addLayer({
                id: 'quest-local-radius',
                type: 'circle',
                source: 'quests',
                filter: ['==', ['get', 'questType'], 'LOCAL'],
                paint: {
                    'circle-radius': [
                        'interpolate', ['exponential', 2], ['zoom'],
                        8, 0.12,
                        22, 1920
                    ], // Matches Mystery Quest Size
                    'circle-color': '#06b6d4', // Cyan
                    'circle-opacity': 0.15,
                    'circle-stroke-width': 1,
                    'circle-stroke-color': '#06b6d4',
                    'circle-stroke-opacity': 0.5,
                },
            });

            // --- MILESTONE QUEST LAYERS ---

            // Add Large Range Circle Layer for MILESTONE quests
            map.addLayer({
                id: 'quest-milestone-range',
                type: 'circle',
                source: 'quests',
                filter: ['==', ['get', 'questType'], 'MILESTONE'],
                paint: {
                    'circle-radius': [
                        'interpolate', ['exponential', 2], ['zoom'],
                        8, 0.78,
                        22, 12800
                    ], // Large visual range (~200m ~= 100px at z15)
                    'circle-color': '#FFD700',
                    'circle-opacity': 0.2,
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#FFD700',
                    'circle-stroke-opacity': 0.5,
                },
            });

            // Add Pulsing Circle Layer for MILESTONE quests (Gold)
            map.addLayer({
                id: 'quest-milestone-glow',
                type: 'circle',
                source: 'quests',
                filter: ['==', ['get', 'questType'], 'MILESTONE'],
                paint: {
                    'circle-radius': 25,
                    'circle-color': '#FFD700',
                    'circle-opacity': 0.3,
                    'circle-blur': 0.5,
                },
            });

            // Add Symbol Layer for MILESTONE quests (Using SVG Icon)
            map.addLayer({
                id: 'quest-milestone-icon',
                type: 'symbol',
                source: 'quests',
                filter: ['==', ['get', 'questType'], 'MILESTONE'],
                layout: {
                    'icon-image': 'milestone-icon',
                    'icon-size': 1.0,
                    'icon-allow-overlap': true,
                    'icon-anchor': 'center',
                },
            });

            // Click handler for ALL quest layers
            const questLayers = [
                'quest-movement', 'quest-movement-range',
                'quest-checkin', 'quest-checkin-range',
                'quest-mystery', 'quest-mystery-radius',
                'quest-local-icon', 'quest-local-radius',
                'quest-milestone-icon', 'quest-milestone-range'
            ];

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

            // Force update markers after load to ensure they render
            updateQuestMarkers();
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
            'bottom-right'
        );

    }, [activeQuests]);

    // Listen for quest focus events from QuestPanel
    useEffect(() => {
        const handleQuestFocus = (e: Event) => {
            const customEvent = e as CustomEvent;
            const { lat, lng } = customEvent.detail;
            const map = mapRef.current;

            if (map && lat && lng) {
                map.flyTo({
                    center: [lng, lat],
                    zoom: 16,
                    essential: true,
                    speed: 1.2
                });
            }
        };

        window.addEventListener('quest-focus', handleQuestFocus);
        return () => window.removeEventListener('quest-focus', handleQuestFocus);
    }, []);

    // Listen for Map Theme changes
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        const { mapTheme } = useQuestStore.getState();
        console.log('[MapView] Theme changed to:', mapTheme);

        if (mapTheme === 'default') {
            // Reload the base style to clear custom paints
            map.setStyle('https://tiles.openfreemap.org/styles/liberty');
        } else if (mapTheme === 'cyber') {
            // Apply custom paints directly (no need to reload)
            customizeMapStyle();
        }

    }, [useQuestStore((state) => state.mapTheme), customizeMapStyle]);

    // Update player marker when location changes (HTML marker OK for single element)
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !currentLocation) return;

        if (!playerMarker.current) {
            // Create circle with directional arrow on edge
            const el = document.createElement('div');
            el.className = 'player-marker';
            el.style.width = '56px';
            el.style.height = '56px';
            // Create inner rotating container
            el.innerHTML = `
                <div class="player-marker-inner" style="width: 100%; height: 100%; transform-origin: center;">
                    <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));">
                        <defs>
                            <linearGradient id="player-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
                                <stop offset="100%" style="stop-color:#1d4ed8;stop-opacity:1" />
                            </linearGradient>
                            <filter id="inner-glow">
                                <feGaussianBlur stdDeviation="1" result="blur"/>
                                <feComposite in="SourceGraphic" in2="blur" operator="arithmetic" k2="1" k3="1"/>
                            </filter>
                        </defs>
                        
                        <!-- Main Body (Larger) -->
                        <circle cx="24" cy="24" r="18" fill="url(#player-gradient)" stroke="#ffffff" stroke-width="3"/>
                        
                        <!-- Inner Detail -->
                        <circle cx="24" cy="24" r="8" fill="#60a5fa" fill-opacity="0.5"/>
                        
                        <!-- Directional Arrow (Adjusted for larger size) -->
                        <path d="M24 2 L32 14 L24 11 L16 14 Z" fill="#ef4444" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/>
                    </svg>
                </div>
            `;

            playerMarker.current = new maplibregl.Marker({ element: el, rotationAlignment: 'map' })
                .setLngLat([currentLocation.lng, currentLocation.lat])
                .addTo(map);

            map.flyTo({
                center: [currentLocation.lng, currentLocation.lat],
                zoom: 15,
                duration: 1000,
            });
        } else {
            playerMarker.current.setLngLat([currentLocation.lng, currentLocation.lat]);
            // REMOVED: map.panTo(...) to prevent fighting with user panning
            // The map should only center on 'Locate Me' or initial load
        }

        // Update rotation based on heading - rotate inner container only
        if (playerMarker.current && currentLocation.heading !== undefined) {
            const element = playerMarker.current.getElement();
            const inner = element.querySelector('.player-marker-inner') as HTMLElement;
            if (inner) {
                inner.style.transition = 'transform 0.3s ease-out';
                inner.style.transform = `rotate(${currentLocation.heading}deg)`;
            }
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
