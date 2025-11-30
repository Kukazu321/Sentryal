'use client';

import React, { useEffect, useRef, useState } from 'react';
import { GoogleMapsOverlay } from '@deck.gl/google-maps';
import { ScatterplotLayer } from '@deck.gl/layers';

interface DeckGLMapProps {
    lat: number;
    lng: number;
    zoom?: number;
    className?: string;
    points?: Array<{ lat: number; lng: number; color?: string; point?: any }>;
    onPointClick?: (p: any) => void;
}

interface GoogleMapsWindow extends Window {
    google?: {
        maps: {
            Map: any;
            LatLng: any;
        };
    };
}

const DeckGLMap: React.FC<DeckGLMapProps> = ({
    lat,
    lng,
    zoom = 12,
    className = '',
    points = [],
    onPointClick,
}) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const overlayRef = useRef<GoogleMapsOverlay | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Load Google Maps
    useEffect(() => {
        const scriptId = 'google-maps-script';
        const googleWindow = window as GoogleMapsWindow;

        if (googleWindow.google?.maps) {
            if (mapContainerRef.current && !mapRef.current) {
                initializeMap();
            }
            return;
        }

        if (document.getElementById(scriptId)) return;

        const script = document.createElement('script');
        script.id = scriptId;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&v=weekly`;
        script.async = true;
        script.defer = true;
        script.onload = () => {
            console.log('[DECKGL] Google Maps loaded');
            if (mapContainerRef.current) {
                initializeMap();
            }
        };
        script.onerror = () => {
            console.error('[DECKGL] Failed to load Google Maps');
            setIsLoading(false);
        };
        document.head.appendChild(script);
    }, []);

    const initializeMap = () => {
        const googleWindow = window as GoogleMapsWindow;
        if (!googleWindow.google?.maps || !mapContainerRef.current) return;

        const { Map } = googleWindow.google.maps;

        mapRef.current = new Map(mapContainerRef.current, {
            center: { lat, lng },
            zoom,
            mapTypeId: 'satellite',
            tilt: 0,
            heading: 0,
            disableDefaultUI: false,
            zoomControl: true,
            mapTypeControl: true,
            streetViewControl: false,
            fullscreenControl: true,
        });

        // Create deck.gl overlay
        overlayRef.current = new GoogleMapsOverlay({
            layers: [],
        });
        overlayRef.current.setMap(mapRef.current);

        setIsLoading(false);
        console.log('[DECKGL] Map initialized with deck.gl overlay');
    };

    // Update deck.gl layers when points change
    useEffect(() => {
        if (!overlayRef.current || !points.length) return;

        console.log(`[DECKGL] Rendering ${points.length} points with WebGL`);

        // Convert hex color to RGB array
        const hexToRgb = (hex: string): [number, number, number] => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result
                ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
                : [128, 128, 128];
        };

        const layer = new ScatterplotLayer({
            id: 'points-layer',
            data: points,
            pickable: true,
            opacity: 0.8,
            stroked: true,
            filled: true,
            radiusScale: 1,
            radiusMinPixels: 4,
            radiusMaxPixels: 8,
            lineWidthMinPixels: 1,
            getPosition: (d: any) => [d.lng, d.lat],
            getRadius: 6,
            getFillColor: (d: any) => {
                const color = d.color || '#808080';
                return [...hexToRgb(color), 255];
            },
            getLineColor: [255, 255, 255, 200],
            onClick: (info: any) => {
                if (info.object && onPointClick) {
                    onPointClick(info.object.point ?? info.object);
                }
            },
            updateTriggers: {
                getFillColor: points.map(p => p.color).join(','),
            },
        });

        overlayRef.current.setProps({ layers: [layer] });
    }, [points, onPointClick]);

    return (
        <div className={`relative ${className}`}>
            <div ref={mapContainerRef} className="w-full h-full" />
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50">
                    <div className="text-white text-sm">Chargement de la carte...</div>
                </div>
            )}
            <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-lg text-xs text-gray-700">
                <div className="font-semibold">🚀 WebGL Rendering</div>
                <div>{points.length.toLocaleString()} points</div>
            </div>
        </div>
    );
};

export default DeckGLMap;
