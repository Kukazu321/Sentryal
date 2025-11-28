'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Google3DMap from '@/components/Map/Google3DMap';
import { ChevronLeft, MapPin, AlertCircle } from 'lucide-react';

interface InfrastructureData {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  status: 'active' | 'inactive' | 'warning';
  lastUpdate: string;
}

export default function Infrastructure3DPage() {
  const params = useParams();
  const router = useRouter();
  const infrastructureId = (params?.id as string) || '';

  const [infrastructure, setInfrastructure] = useState<InfrastructureData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch infrastructure data with EXTREME QUALITY
  useEffect(() => {
    const fetchInfrastructure = async () => {
      try {
        console.log('[3D-PAGE] 🟦 Starting fetch for infrastructure:', infrastructureId);
        setIsLoading(true);
        setError(null);

        if (!infrastructureId) {
          throw new Error('No infrastructure ID provided');
        }

        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('No authentication token found');
        }

        const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/infrastructures/${infrastructureId}`;
        console.log('[3D-PAGE] 📡 Fetching from:', apiUrl);

        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        console.log('[3D-PAGE] 📊 Response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[3D-PAGE] ❌ Response error:', errorText);
          throw new Error(`API Error ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log('[3D-PAGE] ✅ Data received:', data);

        // Extract coordinates from bbox or direct fields
        let latitude: number | undefined;
        let longitude: number | undefined;

        console.log('[3D-PAGE] 🔍 Analyzing data structure...');
        console.log('[3D-PAGE] 📊 bbox type:', data.bbox?.type);
        console.log('[3D-PAGE] 📊 bbox coordinates:', data.bbox?.coordinates);

        // Try direct fields first
        if (data.latitude !== undefined && data.longitude !== undefined) {
          latitude = Number(data.latitude);
          longitude = Number(data.longitude);
          console.log('[3D-PAGE] ✅ Using direct coordinates:', { latitude, longitude });
        }
        // Try bbox as GeoJSON Polygon
        else if (data.bbox?.type === 'Polygon' && data.bbox?.coordinates) {
          console.log('[3D-PAGE] 🔍 Processing GeoJSON Polygon...');
          const coords = data.bbox.coordinates;

          // Polygon coordinates: [[[lon, lat], [lon, lat], ...]]
          if (Array.isArray(coords) && coords.length > 0) {
            const ring = coords[0]; // First ring (outer boundary)
            console.log('[3D-PAGE] 📍 Ring coordinates:', ring);

            if (Array.isArray(ring) && ring.length > 0) {
              // Calculate center by averaging all points
              let sumLat = 0;
              let sumLon = 0;
              let count = 0;

              for (const point of ring) {
                if (Array.isArray(point) && point.length >= 2) {
                  sumLon += point[0];
                  sumLat += point[1];
                  count++;
                }
              }

              if (count > 0) {
                longitude = sumLon / count;
                latitude = sumLat / count;
                console.log('[3D-PAGE] ✅ Calculated center from Polygon:', { latitude, longitude, pointsUsed: count });
              }
            }
          }
        }
        // Try bbox as simple array [minLon, minLat, maxLon, maxLat]
        else if (Array.isArray(data.bbox) && data.bbox.length >= 4) {
          const minLon = data.bbox[0];
          const minLat = data.bbox[1];
          const maxLon = data.bbox[2];
          const maxLat = data.bbox[3];

          latitude = (minLat + maxLat) / 2;
          longitude = (minLon + maxLon) / 2;
          console.log('[3D-PAGE] ✅ Extracted from bbox array:', { bbox: data.bbox, latitude, longitude });
        }
        // Try geom (GeoJSON geometry)
        else if (data.geom?.coordinates) {
          const coords = data.geom.coordinates;
          if (Array.isArray(coords) && coords.length >= 2) {
            longitude = Number(coords[0]);
            latitude = Number(coords[1]);
            console.log('[3D-PAGE] ✅ Extracted from geom:', { latitude, longitude });
          }
        }

        // Validate we have coordinates
        if (latitude === undefined || longitude === undefined) {
          console.error('[3D-PAGE] ❌ Could not extract coordinates from:', data);
          throw new Error('Invalid infrastructure data: could not extract latitude/longitude');
        }

        // Validate coordinates are valid numbers
        if (isNaN(latitude) || isNaN(longitude)) {
          console.error('[3D-PAGE] ❌ Coordinates are NaN:', { latitude, longitude });
          throw new Error('Invalid coordinates: latitude or longitude is NaN');
        }

        // Ensure coordinates are in valid range
        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
          console.error('[3D-PAGE] ❌ Coordinates out of range:', { latitude, longitude });
          throw new Error('Invalid coordinates: out of geographic range');
        }

        // Build infrastructure object
        const infrastructure: InfrastructureData = {
          id: data.id || infrastructureId,
          name: data.name || 'Unknown Infrastructure',
          latitude,
          longitude,
          status: data.status || 'active',
          lastUpdate: data.updated_at || new Date().toISOString(),
        };

        console.log('[3D-PAGE] 🎯 Processed infrastructure:', infrastructure);

        setInfrastructure(infrastructure);
        setError(null);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error('[3D-PAGE] ❌ Fetch error:', errorMsg);
        setError(errorMsg);
        setInfrastructure(null);
      } finally {
        setIsLoading(false);
      }
    };

    if (infrastructureId) {
      fetchInfrastructure();
    }
  }, [infrastructureId]);

  const handleBack = () => {
    router.back();
  };

  if (isLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white font-medium">Loading 3D Infrastructure View...</p>
        </div>
      </div>
    );
  }

  if (error || !infrastructure) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-black">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-white text-xl font-semibold mb-2">Error Loading Map</h2>
          <p className="text-gray-400 mb-6">{error || 'Infrastructure not found'}</p>
          <button
            onClick={handleBack}
            className="px-6 py-2 bg-white text-black rounded-lg font-medium hover:bg-gray-100 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      {/* 3D Map */}
      {infrastructure ? (
        <Google3DMap
          lat={infrastructure.latitude || 47.6062}
          lng={infrastructure.longitude || -122.3321}
          zoom={18}
          pitch={60}
          bearing={45}
          markerTitle={infrastructure.name}
          className="w-full h-full"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white font-medium">Loading 3D Map...</p>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Go back"
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
            <div>
              <h1 className="text-white text-2xl font-bold">
                {infrastructure?.name || 'Loading...'}
              </h1>
              <p className="text-gray-400 text-sm mt-1">3D Photorealistic View</p>
            </div>
          </div>
        </div>
      </div>

      {/* Info Card - Bottom Left */}
      {infrastructure ? (
        <div className="absolute bottom-6 left-6 z-20 bg-black/80 backdrop-blur-md border border-white/10 rounded-xl p-6 max-w-sm text-white">
          <div className="flex items-start gap-3 mb-4">
            <MapPin className="w-5 h-5 text-blue-400 flex-shrink-0 mt-1" />
            <div>
              <p className="text-sm text-gray-400 mb-1">Coordinates</p>
              <p className="font-mono text-sm">
                {infrastructure?.latitude?.toFixed(6) || 'N/A'}, {infrastructure?.longitude?.toFixed(6) || 'N/A'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <div
              className={`w-3 h-3 rounded-full ${infrastructure?.status === 'active'
                ? 'bg-green-500'
                : infrastructure?.status === 'warning'
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
                }`}
            />
            <span className="text-sm capitalize">{infrastructure?.status || 'unknown'}</span>
          </div>

          <p className="text-xs text-gray-500">
            Last update: {infrastructure?.lastUpdate ? new Date(infrastructure.lastUpdate).toLocaleString() : 'N/A'}
          </p>
        </div>
      ) : null}

      {/* Controls - Bottom Right */}
      <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-3">
        <button
          onClick={handleBack}
          className="px-6 py-3 bg-white text-black rounded-lg font-semibold hover:bg-gray-100 transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          Back to 2D View
        </button>
      </div>

      {/* Street View Toggle - Top Right */}
      <div className="absolute top-6 right-6 z-20">
        <button
          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium backdrop-blur-md border border-white/20 transition-all duration-200"
          title="Street View coming soon"
        >
          📍 Street View
        </button>
      </div>
    </div>
  );
}
