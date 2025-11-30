'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

interface Google3DMapProps {
  lat: number;
  lng: number;
  zoom?: number;
  pitch?: number;
  bearing?: number;
  onMapReady?: () => void;
  markerTitle?: string;
  className?: string;
  points?: Array<{ lat: number; lng: number; color?: string; point?: any }>; // optional points cloud
  onPointClick?: (p: any) => void;
  onBoundsChanged?: (bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number }) => void;
}

interface GoogleMapsWindow extends Window {
  google?: {
    maps: {
      Map: any;
      LatLng: any;
      Marker: any;
      Animation: any;
      SymbolPath: any;
      visualization?: {
        HeatmapLayer: any;
      };
    };
  };
}

const Google3DMap: React.FC<Google3DMapProps> = ({
  lat,
  lng,
  zoom = 18,
  pitch = 60,
  bearing = 0,
  onMapReady,
  markerTitle = 'Infrastructure Point',
  className = '',
  points = [],
  onPointClick,
  onBoundsChanged,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const heatmapRef = useRef<any>(null);
  const clickableMarkersRef = useRef<any[]>([]); // Invisible markers for click detection
  const boundsTimerRef = useRef<any>(null);
  const updateTimerRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initAttemptRef = useRef(0);
  const [currentHeading, setCurrentHeading] = useState(bearing);
  const [currentPitch, setCurrentPitch] = useState(pitch);
  const [currentZoom, setCurrentZoom] = useState(zoom);
  const [visualizationMode, setVisualizationMode] = useState<'heatmap' | 'points'>('heatmap');
  const pointsDataRef = useRef<any[]>([]); // Store full point data for click detection

  // Load Google Maps API script
  useEffect(() => {
    console.log('[GOOGLE3D] 🟦 useEffect: Starting Google Maps initialization');
    console.log('[GOOGLE3D] 📍 Container ref:', mapContainerRef.current ? 'EXISTS' : 'NULL');

    const scriptId = 'google-maps-script';
    const googleWindow = window as GoogleMapsWindow;

    // Check if Google Maps is already loaded
    if (googleWindow.google?.maps) {
      console.log('[GOOGLE3D] ✅ Google Maps already loaded globally');
      if (mapContainerRef.current) {
        initializeMap();
      }
      return;
    }

    // Check if script already exists
    const existingScript = document.getElementById(scriptId);
    if (existingScript) {
      console.log('[GOOGLE3D] ⏳ Script already exists, waiting for Google Maps to load...');
      const maxWait = 50;
      let waitCount = 0;
      const waitInterval = setInterval(() => {
        waitCount++;
        if (googleWindow.google?.maps) {
          clearInterval(waitInterval);
          console.log('[GOOGLE3D] ✅ Google Maps loaded!');
          if (mapContainerRef.current) {
            initializeMap();
          }
        }
        if (waitCount >= maxWait) {
          clearInterval(waitInterval);
          console.error('[GOOGLE3D] ❌ Timeout waiting for Google Maps');
          setError('Google Maps API timeout');
          setIsLoading(false);
        }
      }, 100);
      return;
    }

    console.log('[GOOGLE3D] 🚀 Creating new Google Maps script');
    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=drawing,marker,visualization`;
    script.async = true;

    script.onload = () => {
      console.log('[GOOGLE3D] ✅ Script onload fired');
      setTimeout(() => {
        if (googleWindow.google?.maps && mapContainerRef.current) {
          console.log('[GOOGLE3D] ✅ Ready to initialize map');
          initializeMap();
        } else {
          console.error('[GOOGLE3D] ❌ Missing: google.maps or container');
          setError('Google Maps or container not ready');
          setIsLoading(false);
        }
      }, 300);
    };

    script.onerror = () => {
      const errorMsg = '[GOOGLE3D] ❌ Failed to load Google Maps API script';
      console.error(errorMsg);
      setError('Failed to load Google Maps API');
      setIsLoading(false);
    };

    console.log('[GOOGLE3D] 📝 Appending script to head');
    document.head.appendChild(script);

    return () => {
      console.log('[GOOGLE3D] 🧹 Cleanup: NOT removing script (global resource)');
      // Cleanup heatmap and markers
      if (heatmapRef.current) {
        heatmapRef.current.setMap(null);
        heatmapRef.current = null;
      }
      markersRef.current.forEach(m => m.setMap(null));
      markersRef.current = [];
    };
  }, []);

  const initializeMap = useCallback(async () => {
    initAttemptRef.current++;
    const attempt = initAttemptRef.current;

    console.log(`[GOOGLE3D] 🔄 initializeMap() attempt #${attempt}`);
    console.log(`[GOOGLE3D] 📍 Container exists:`, mapContainerRef.current ? 'YES' : 'NO');

    if (!mapContainerRef.current) {
      console.error(`[GOOGLE3D] ❌ Attempt #${attempt}: Container is NULL - ABORTING`);
      setError('Map container not found in DOM');
      setIsLoading(false);
      return;
    }

    try {
      const googleWindow = window as GoogleMapsWindow;
      console.log(`[GOOGLE3D] 🔍 Attempt #${attempt}: Checking google.maps...`);

      if (!googleWindow.google?.maps) {
        console.error(`[GOOGLE3D] ❌ Attempt #${attempt}: google.maps is undefined - ABORTING`);
        setError('Google Maps API not loaded');
        setIsLoading(false);
        return;
      }

      console.log(`[GOOGLE3D] ✅ Attempt #${attempt}: google.maps found`);
      const { Map, LatLng, Marker, Animation, SymbolPath } = googleWindow.google.maps;

      console.log(`[GOOGLE3D] 🗺️ Attempt #${attempt}: Creating map with options:`, {
        lat,
        lng,
        zoom,
        pitch,
        bearing,
      });

      // Create map with minimal UI
      const mapOptions = {
        center: new LatLng(lat, lng),
        zoom,
        pitch,
        heading: bearing,
        mapTypeId: 'satellite',
        disableDefaultUI: true,
        zoomControl: true,
        mapTypeControl: false,
        fullscreenControl: false,
        streetViewControl: false,
        rotateControl: false,
        scaleControl: true,
        tilt: pitch,
        gestureHandling: 'greedy',
      };

      mapRef.current = new Map(mapContainerRef.current, mapOptions);
      console.log(`[GOOGLE3D] ✅ Attempt #${attempt}: Map object created`);

      // No forced 3D activation (clean 2D by default)

      // Add default marker only if no points are provided
      if (!Array.isArray(points) || points.length === 0) {
        console.log(`[GOOGLE3D] 📌 Attempt #${attempt}: Creating single marker...`);
        markerRef.current = new Marker({
          position: new LatLng(lat, lng),
          map: mapRef.current,
          title: markerTitle,
          icon: {
            path: SymbolPath.CIRCLE,
            fillColor: '#111111',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            scale: 5,
          },
          animation: Animation.DROP,
        });
        console.log(`[GOOGLE3D] ✅ Attempt #${attempt}: Single marker created`);
      }

      console.log(`[GOOGLE3D] 🎉 Attempt #${attempt}: SUCCESS - Map fully initialized!`);
      setIsLoading(false);
      setError(null);
      onMapReady?.();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[GOOGLE3D] ❌ Attempt #${attempt}: Exception:`, errorMsg);
      setError(errorMsg);
      setIsLoading(false);
    }
  }, [lat, lng, zoom, pitch, bearing, onMapReady, markerTitle, points]);

  // ULTRA-PERFORMANT: Heatmap rendering (WebGL native, handles 100k+ points)
  const updateHeatmap = useCallback(() => {
    const googleWindow = window as GoogleMapsWindow;

    // Check if visualization library is available
    if (!mapRef.current) {
      console.warn('[GOOGLE3D] Map not ready for heatmap');
      return;
    }

    if (!googleWindow.google?.maps) {
      console.warn('[GOOGLE3D] Google Maps not loaded');
      return;
    }

    if (!googleWindow.google.maps.visualization) {
      console.error('[GOOGLE3D] Visualization library not loaded! Make sure libraries=visualization is in the script URL');
      return;
    }

    // Clear all visible markers when switching to heatmap
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    // Clear clickable markers (will be recreated)
    clickableMarkersRef.current.forEach(m => m.setMap(null));
    clickableMarkersRef.current = [];

    // Remove existing heatmap
    if (heatmapRef.current) {
      heatmapRef.current.setMap(null);
      heatmapRef.current = null;
    }

    if (!Array.isArray(points) || points.length === 0) {
      console.warn('[GOOGLE3D] No points to display in heatmap');
      return;
    }

    // Store points data for click detection
    pointsDataRef.current = points;

    const { LatLng, visualization, Marker, SymbolPath } = googleWindow.google.maps;

    // Convert points to heatmap data with weights based on displacement/risk
    const heatmapData = points.map((p: any) => {
      // Extract displacement from various possible locations
      let displacement = 0;

      // Try different property paths (handle both direct properties and nested point.properties)
      const props = p.point?.properties || p.properties || {};

      if (props.latestDisplacement !== undefined && props.latestDisplacement !== null) {
        displacement = Number(props.latestDisplacement);
      } else if (props.displacement_mm !== undefined && props.displacement_mm !== null) {
        displacement = Number(props.displacement_mm);
      } else if (props.displacement !== undefined && props.displacement !== null) {
        displacement = Number(props.displacement);
      } else {
        // If no displacement data, use a default weight based on color/risk
        // Higher risk colors = higher weight
        const color = p.color || props.color || '#6B7280';
        const colorStr = String(color).toUpperCase();
        if (colorStr.includes('DC2626') || colorStr.includes('FF3333') || colorStr.includes('RED')) {
          displacement = 50; // Critical
        } else if (colorStr.includes('EA580C') || colorStr.includes('FF9933') || colorStr.includes('ORANGE')) {
          displacement = 30; // High
        } else if (colorStr.includes('F59E0B') || colorStr.includes('FFCC00') || colorStr.includes('AMBER')) {
          displacement = 15; // Medium
        } else if (colorStr.includes('EAB308') || colorStr.includes('33CCFF') || colorStr.includes('YELLOW')) {
          displacement = 5; // Low
        } else {
          displacement = 1; // Stable/Unknown
        }
      }

      // Weight based on absolute displacement (higher = more intense)
      // Use actual displacement values for accurate heatmap visualization
      // Normalize to 0-1 range based on realistic displacement scale (0-100mm)
      // Minimum weight of 0.05 so all points are visible, but proportional to real values
      const maxDisplacement = 100; // Maximum expected displacement in mm
      const normalizedDisplacement = Math.abs(displacement);
      const weight = Math.max(0.05, Math.min(normalizedDisplacement / maxDisplacement, 1));

      return {
        location: new LatLng(p.lat, p.lng),
        weight: weight,
      };
    }).filter((d: any) => {
      // Filter out invalid data points
      return d.location && !isNaN(d.location.lat()) && !isNaN(d.location.lng()) && !isNaN(d.weight);
    });

    console.log(`[GOOGLE3D] Creating heatmap with ${heatmapData.length} points`);
    console.log(`[GOOGLE3D] Sample weights:`, heatmapData.slice(0, 5).map(d => d.weight));

    // Create heatmap layer with optimized settings
    try {
      // Validate heatmap data
      if (!heatmapData || heatmapData.length === 0) {
        console.warn('[GOOGLE3D] No heatmap data to display');
        return;
      }

      const heatmap = new visualization.HeatmapLayer({
        data: heatmapData,
        map: mapRef.current,
        radius: 30, // Radius of influence for each point (increased for better visibility)
        opacity: 0.8, // Overall opacity (increased for better visibility)
        maxIntensity: 1.0,
        gradient: [
          'rgba(34, 197, 94, 0)',      // Green (stable) - transparent
          'rgba(34, 197, 94, 0.4)',    // Green (stable) - light
          'rgba(234, 179, 8, 0.6)',    // Yellow (low risk)
          'rgba(245, 158, 11, 0.8)',   // Amber (medium risk)
          'rgba(234, 88, 12, 0.9)',    // Orange (high risk)
          'rgba(220, 38, 38, 1)',      // Red (critical) - full opacity
        ],
        dissipating: true, // Points fade as zoom out
      });

      heatmapRef.current = heatmap;
      console.log(`[GOOGLE3D] ✅ Heatmap created successfully with ${heatmapData.length} points`);

      // For large datasets, skip invisible markers and rely on map click detection
      // Only create markers for reasonable number of points (performance)
      if (points.length <= 2000 && typeof onPointClick === 'function') {
        try {
          clickableMarkersRef.current.forEach(m => m.setMap(null));
          clickableMarkersRef.current = [];

          // Get current viewport bounds to only create markers for visible points
          let bounds: any = null;
          try {
            bounds = mapRef.current.getBounds();
          } catch { }

          let pointsToMark = points;

          // Filter to viewport if bounds available
          if (bounds) {
            pointsToMark = points.filter((p: any) => {
              try {
                return bounds.contains(new LatLng(p.lat, p.lng));
              } catch {
                return true;
              }
            });
          }

          // Limit to max 20000 markers even in viewport
          if (pointsToMark.length > 20000) {
            const step = Math.ceil(pointsToMark.length / 20000);
            pointsToMark = pointsToMark.filter((_, index) => index % step === 0);
          }

          console.log(`[GOOGLE3D] Creating ${pointsToMark.length} invisible clickable markers (from ${points.length} total)`);

          pointsToMark.forEach((p: any) => {
            try {
              const marker = new Marker({
                position: new LatLng(p.lat, p.lng),
                map: mapRef.current,
                icon: {
                  path: SymbolPath.CIRCLE,
                  fillColor: '#000000',
                  fillOpacity: 0, // INVISIBLE but clickable
                  strokeColor: '#000000',
                  strokeOpacity: 0,
                  strokeWeight: 0,
                  scale: 10, // Larger clickable area
                },
                optimized: true,
                clickable: true,
                zIndex: 1000, // Above heatmap
              });

              // Add click listener
              marker.addListener('click', () => {
                // Find the full point data
                const fullPoint = p.point || {
                  type: 'Feature',
                  geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
                  properties: p.properties || { pointId: p.pid, color: p.color },
                };
                onPointClick(fullPoint);
              });

              clickableMarkersRef.current.push(marker);
            } catch (markerError) {
              console.warn('[GOOGLE3D] Failed to create marker for point:', markerError);
            }
          });

          console.log(`[GOOGLE3D] ✅ Created ${clickableMarkersRef.current.length} invisible clickable markers`);
        } catch (markerError) {
          console.warn('[GOOGLE3D] Failed to create clickable markers, will use map click detection:', markerError);
        }
      } else {
        console.log(`[GOOGLE3D] Skipping invisible markers (${points.length} points), using map click detection only`);
      }
    } catch (error) {
      console.error('[GOOGLE3D] ❌ Error creating heatmap:', error);
      // Fallback: switch to points mode if heatmap fails
      console.warn('[GOOGLE3D] Heatmap creation failed, will fallback to points mode on next update');
      // Don't throw - let the error propagate to trigger fallback
      throw error;
    }
  }, [points, onPointClick]);

  // Fallback: Limited markers for point mode (only if heatmap not available)
  const updateMarkers = useCallback(() => {
    if (visualizationMode === 'heatmap') {
      updateHeatmap();
      return;
    }

    // Clear heatmap and clickable markers when switching to points
    if (heatmapRef.current) {
      heatmapRef.current.setMap(null);
      heatmapRef.current = null;
    }
    clickableMarkersRef.current.forEach(m => m.setMap(null));
    clickableMarkersRef.current = [];

    const googleWindow = window as GoogleMapsWindow;
    if (!mapRef.current || !googleWindow.google?.maps) return;
    const { Marker, LatLng, SymbolPath } = googleWindow.google.maps;

    // Clear previous markers
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    if (!Array.isArray(points) || points.length === 0) return;

    // STRICT LIMIT: Never render more than 10000 markers
    const maxMarkers = 10000;
    const step = Math.max(1, Math.ceil(points.length / maxMarkers));
    const sampledPoints = points.filter((_, index) => index % step === 0);

    // Create markers for sampled points only
    sampledPoints.forEach((p) => {
      const color = p.color || '#111111';
      const m = new Marker({
        position: new LatLng(p.lat, p.lng),
        map: mapRef.current,
        icon: {
          path: SymbolPath.CIRCLE,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 1.5,
          scale: 4,
        },
        optimized: true,
      });
      if (typeof onPointClick === 'function') {
        m.addListener('click', () => onPointClick(p.point ?? p));
      }
      markersRef.current.push(m);
    });

    console.log(`[GOOGLE3D] Rendered ${markersRef.current.length} markers (sampled from ${points.length} total)`);
  }, [points, onPointClick, visualizationMode, updateHeatmap]);

  // Update visualization when points or mode changes
  useEffect(() => {
    if (!mapRef.current) return;

    // Wait a bit for Google Maps to be fully ready
    const timer = setTimeout(() => {
      // Use heatmap by default (best performance)
      const googleWindow = window as GoogleMapsWindow;
      const hasVisualization = googleWindow.google?.maps?.visualization;

      console.log('[GOOGLE3D] Visualization mode:', visualizationMode);
      console.log('[GOOGLE3D] Has visualization library:', hasVisualization);
      console.log('[GOOGLE3D] Points count:', points.length);

      if (visualizationMode === 'heatmap') {
        if (hasVisualization) {
          console.log('[GOOGLE3D] Updating heatmap...');
          try {
            updateHeatmap();
          } catch (error) {
            console.error('[GOOGLE3D] Heatmap update failed:', error);
            console.warn('[GOOGLE3D] Falling back to points mode');
            setVisualizationMode('points');
            updateMarkers();
          }
        } else {
          console.warn('[GOOGLE3D] Visualization library not available, falling back to points');
          setVisualizationMode('points');
          updateMarkers();
        }
      } else {
        // Fallback to limited markers
        console.log('[GOOGLE3D] Updating markers...');
        if (updateTimerRef.current) clearTimeout(updateTimerRef.current);
        updateTimerRef.current = setTimeout(() => {
          updateMarkers();
        }, 100);
      }
    }, 500); // Wait 500ms for Google Maps to be ready

    return () => clearTimeout(timer);
  }, [points, visualizationMode, updateHeatmap, updateMarkers]);

  // Click detection on map for heatmap mode (always active as fallback/primary method)
  useEffect(() => {
    if (!mapRef.current || visualizationMode !== 'heatmap' || !onPointClick) return;

    const googleWindow = window as GoogleMapsWindow;
    if (!googleWindow.google?.maps) return;

    const { LatLng } = googleWindow.google.maps;

    const handleMapClick = (event: any) => {
      if (!event.latLng || !pointsDataRef.current.length) return;

      const clickLat = event.latLng.lat();
      const clickLng = event.latLng.lng();

      // Find the closest point within a reasonable distance
      // Radius adapts to zoom level for better UX
      const searchRadius = currentZoom > 16 ? 0.00005 : currentZoom > 14 ? 0.0001 : currentZoom > 12 ? 0.0003 : 0.0005;

      let closestPoint: any = null;
      let minDistance = Infinity;

      // Optimize: only search points in viewport if bounds available
      let pointsToSearch = pointsDataRef.current;
      try {
        const bounds = mapRef.current.getBounds();
        if (bounds) {
          pointsToSearch = pointsDataRef.current.filter((p: any) => {
            try {
              return bounds.contains(new LatLng(p.lat, p.lng));
            } catch {
              return true;
            }
          });
        }
      } catch { }

      pointsToSearch.forEach((p: any) => {
        const lat = p.lat;
        const lng = p.lng;

        // Simple distance calculation (fast enough for viewport-filtered points)
        const latDiff = lat - clickLat;
        const lngDiff = lng - clickLng;
        const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);

        if (distance < searchRadius && distance < minDistance) {
          minDistance = distance;
          closestPoint = p;
        }
      });

      if (closestPoint) {
        console.log('[GOOGLE3D] Point clicked via map click detection (distance:', minDistance.toFixed(6), ')');
        const fullPoint = closestPoint.point || {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [closestPoint.lng, closestPoint.lat] },
          properties: closestPoint.properties || { pointId: closestPoint.pid, color: closestPoint.color },
        };
        onPointClick(fullPoint);
      } else {
        console.log('[GOOGLE3D] No point found near click location');
      }
    };

    const clickListener = mapRef.current.addListener('click', handleMapClick);

    return () => {
      if (clickListener && typeof clickListener.remove === 'function') {
        clickListener.remove();
      }
    };
  }, [visualizationMode, onPointClick, currentZoom]);

  // Listen to zoom changes (for heatmap radius adjustment if needed)
  useEffect(() => {
    const googleWindow = window as GoogleMapsWindow;
    if (!mapRef.current || !googleWindow.google?.maps) return;

    const zoomListener = mapRef.current.addListener('zoom_changed', () => {
      try {
        const newZoom = mapRef.current.getZoom();
        setCurrentZoom(newZoom);

        // Adjust heatmap radius based on zoom (optional optimization)
        if (heatmapRef.current && visualizationMode === 'heatmap') {
          const radius = Math.max(15, Math.min(50, newZoom * 2));
          heatmapRef.current.set('radius', radius);
        }
      } catch { }
    });

    return () => {
      if (zoomListener && typeof zoomListener.remove === 'function') zoomListener.remove();
    };
  }, [visualizationMode]);

  // Debounced bounds change emitter
  useEffect(() => {
    const googleWindow = window as GoogleMapsWindow;
    if (!mapRef.current || !googleWindow.google?.maps || !onBoundsChanged) return;
    const listener = mapRef.current.addListener('idle', () => {
      if (boundsTimerRef.current) clearTimeout(boundsTimerRef.current);
      boundsTimerRef.current = setTimeout(() => {
        try {
          const b = mapRef.current.getBounds?.();
          if (!b) return;
          const ne = b.getNorthEast();
          const sw = b.getSouthWest();
          onBoundsChanged({
            minLat: sw.lat(),
            maxLat: ne.lat(),
            minLon: sw.lng(),
            maxLon: ne.lng(),
          });
        } catch { }
      }, 180);
    });
    return () => {
      if (listener && typeof listener.remove === 'function') listener.remove();
      if (boundsTimerRef.current) clearTimeout(boundsTimerRef.current);
    };
  }, [onBoundsChanged]);

  // Update camera when props change
  useEffect(() => {
    if (!mapRef.current) return;

    const googleWindow = window as GoogleMapsWindow;
    if (!googleWindow.google?.maps) return;

    const { LatLng } = googleWindow.google.maps;

    try {
      mapRef.current.setCenter(new LatLng(lat, lng));
      mapRef.current.setZoom(zoom);
      mapRef.current.setTilt(pitch);
      mapRef.current.setHeading(bearing);
      setCurrentZoom(zoom);
    } catch (err) {
      console.warn('[GOOGLE3D] ⚠️ Error updating camera:', err);
    }
  }, [lat, lng, zoom, pitch, bearing]);

  // Remove custom 3D drag controls for a clean UX
  useEffect(() => {
    return () => { };
  }, [bearing, pitch, currentHeading, currentPitch]);

  // Rotation controls with ULTRA DETAILED LOGS
  const rotateLeft = () => {
    console.log('[GOOGLE3D-BUTTON] 🔴 ROTATE LEFT CLICKED');
    console.log('[GOOGLE3D-BUTTON] 📍 mapRef.current exists:', !!mapRef.current);
    console.log('[GOOGLE3D-BUTTON] 📊 currentHeading:', currentHeading);

    const newHeading = (currentHeading - 45 + 360) % 360;
    console.log('[GOOGLE3D-BUTTON] 🧮 newHeading calculated:', newHeading);

    setCurrentHeading(newHeading);
    console.log('[GOOGLE3D-BUTTON] ✅ setCurrentHeading called with:', newHeading);

    if (mapRef.current) {
      console.log('[GOOGLE3D-BUTTON] 🗺️ Map exists, calling setHeading...');

      try {
        mapRef.current.setHeading(newHeading);
        console.log(`[GOOGLE3D-BUTTON] ✅ setHeading SUCCESS: ${newHeading}°`);

        // Force render by getting current center and re-setting it
        const currentCenter = mapRef.current.getCenter();
        console.log('[GOOGLE3D-BUTTON] 🔄 Forcing render by re-centering...');
        mapRef.current.setCenter(currentCenter);
        console.log('[GOOGLE3D-BUTTON] ✅ Render forced!');
      } catch (err) {
        console.error(`[GOOGLE3D-BUTTON] ❌ setHeading ERROR:`, err);
      }
    } else {
      console.error('[GOOGLE3D-BUTTON] ❌ mapRef.current is NULL!');
    }
  };

  const rotateRight = () => {
    console.log('[GOOGLE3D-BUTTON] 🔵 ROTATE RIGHT CLICKED');
    console.log('[GOOGLE3D-BUTTON] 📍 mapRef.current exists:', !!mapRef.current);
    console.log('[GOOGLE3D-BUTTON] 📊 currentHeading:', currentHeading);

    const newHeading = (currentHeading + 45) % 360;
    console.log('[GOOGLE3D-BUTTON] 🧮 newHeading calculated:', newHeading);

    setCurrentHeading(newHeading);
    console.log('[GOOGLE3D-BUTTON] ✅ setCurrentHeading called with:', newHeading);

    if (mapRef.current) {
      console.log('[GOOGLE3D-BUTTON] 🗺️ Map exists, calling setHeading...');
      try {
        mapRef.current.setHeading(newHeading);
        console.log(`[GOOGLE3D-BUTTON] ✅ setHeading SUCCESS: ${newHeading}°`);

        // Force render by getting current center and re-setting it
        const currentCenter = mapRef.current.getCenter();
        console.log('[GOOGLE3D-BUTTON] 🔄 Forcing render by re-centering...');
        mapRef.current.setCenter(currentCenter);
        console.log('[GOOGLE3D-BUTTON] ✅ Render forced!');
      } catch (err) {
        console.error(`[GOOGLE3D-BUTTON] ❌ setHeading ERROR:`, err);
      }
    } else {
      console.error('[GOOGLE3D-BUTTON] ❌ mapRef.current is NULL!');
    }
  };

  const tiltUp = () => {
    console.log('[GOOGLE3D-BUTTON] 🟢 TILT UP CLICKED');
    console.log('[GOOGLE3D-BUTTON] 📍 mapRef.current exists:', !!mapRef.current);
    console.log('[GOOGLE3D-BUTTON] 📊 currentPitch:', currentPitch);

    const newPitch = Math.min(currentPitch + 15, 85);
    console.log('[GOOGLE3D-BUTTON] 🧮 newPitch calculated:', newPitch);

    setCurrentPitch(newPitch);
    console.log('[GOOGLE3D-BUTTON] ✅ setCurrentPitch called with:', newPitch);

    if (mapRef.current) {
      console.log('[GOOGLE3D-BUTTON] 🗺️ Map exists, calling setTilt...');

      try {
        mapRef.current.setTilt(newPitch);
        console.log(`[GOOGLE3D-BUTTON] ✅ setTilt SUCCESS: ${newPitch}°`);

        // Force render by getting current center and re-setting it
        const currentCenter = mapRef.current.getCenter();
        console.log('[GOOGLE3D-BUTTON] 🔄 Forcing render by re-centering...');
        mapRef.current.setCenter(currentCenter);
        console.log('[GOOGLE3D-BUTTON] ✅ Render forced!');
      } catch (err) {
        console.error(`[GOOGLE3D-BUTTON] ❌ setTilt ERROR:`, err);
      }
    } else {
      console.error('[GOOGLE3D-BUTTON] ❌ mapRef.current is NULL!');
    }
  };

  const tiltDown = () => {
    console.log('[GOOGLE3D-BUTTON] 🟡 TILT DOWN CLICKED');
    console.log('[GOOGLE3D-BUTTON] 📍 mapRef.current exists:', !!mapRef.current);
    console.log('[GOOGLE3D-BUTTON] 📊 currentPitch:', currentPitch);

    const newPitch = Math.max(currentPitch - 15, 0);
    console.log('[GOOGLE3D-BUTTON] 🧮 newPitch calculated:', newPitch);

    setCurrentPitch(newPitch);
    console.log('[GOOGLE3D-BUTTON] ✅ setCurrentPitch called with:', newPitch);

    if (mapRef.current) {
      console.log('[GOOGLE3D-BUTTON] 🗺️ Map exists, calling setTilt...');
      try {
        mapRef.current.setTilt(newPitch);
        console.log(`[GOOGLE3D-BUTTON] ✅ setTilt SUCCESS: ${newPitch}°`);

        // Force render by getting current center and re-setting it
        const currentCenter = mapRef.current.getCenter();
        console.log('[GOOGLE3D-BUTTON] 🔄 Forcing render by re-centering...');
        mapRef.current.setCenter(currentCenter);
        console.log('[GOOGLE3D-BUTTON] ✅ Render forced!');
      } catch (err) {
        console.error(`[GOOGLE3D-BUTTON] ❌ setTilt ERROR:`, err);
      }
    } else {
      console.error('[GOOGLE3D-BUTTON] ❌ mapRef.current is NULL!');
    }
  };

  const resetView = () => {
    console.log('[GOOGLE3D-BUTTON] 🟣 RESET VIEW CLICKED');
    console.log('[GOOGLE3D-BUTTON] 📍 mapRef.current exists:', !!mapRef.current);
    console.log('[GOOGLE3D-BUTTON] 📊 Resetting to bearing:', bearing, 'pitch:', pitch);

    setCurrentHeading(bearing);
    setCurrentPitch(pitch);
    console.log('[GOOGLE3D-BUTTON] ✅ State reset called');

    if (mapRef.current) {
      console.log('[GOOGLE3D-BUTTON] 🗺️ Map exists, calling setHeading and setTilt...');
      try {
        mapRef.current.setHeading(bearing);
        console.log(`[GOOGLE3D-BUTTON] ✅ setHeading SUCCESS: ${bearing}°`);

        mapRef.current.setTilt(pitch);
        console.log(`[GOOGLE3D-BUTTON] ✅ setTilt SUCCESS: ${pitch}°`);
      } catch (err) {
        console.error(`[GOOGLE3D-BUTTON] ❌ Reset ERROR:`, err);
      }
    } else {
      console.error('[GOOGLE3D-BUTTON] ❌ mapRef.current is NULL!');
    }
  };

  if (error) {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-white ${className}`}>
        <div className="text-center">
          <p className="text-lg font-semibold mb-2 text-neutral-900">❌ Map Error</p>
          <p className="text-sm text-neutral-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full ${className}`}>
      <div
        ref={mapContainerRef}
        className="w-full h-full"
        style={{ minHeight: '100vh' }}
      />

      {/* Visualization mode toggle (optional UI) */}
      {!isLoading && mapRef.current && points.length > 0 && (
        <div className="absolute top-4 right-4 z-10 bg-white rounded-lg shadow-lg p-2 flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              onClick={() => {
                setVisualizationMode('heatmap');
                updateHeatmap();
              }}
              className={`px-3 py-1.5 text-xs rounded ${visualizationMode === 'heatmap' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700'}`}
              title="Heatmap (recommandé pour grandes quantités de points)"
            >
              🔥 Heatmap
            </button>
            <button
              onClick={() => {
                setVisualizationMode('points');
                updateMarkers();
              }}
              className={`px-3 py-1.5 text-xs rounded ${visualizationMode === 'points' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700'}`}
              title="Points (limité à 10000 pour performance)"
            >
              ⚫ Points
            </button>
          </div>
          {visualizationMode === 'heatmap' && (
            <div className="text-xs text-gray-600 px-2 py-1 bg-blue-50 rounded border border-blue-200 max-w-[200px]">
              💡 Cliquez sur la heatmap pour voir les détails d'un point
            </div>
          )}
        </div>
      )}

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};

export default Google3DMap;
