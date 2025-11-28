/**
 * useGoogle3DCamera Hook
 * Manages camera positioning and animations for Google 3D Maps
 */

import { useCallback, useRef } from 'react';

interface CameraPosition {
  lat: number;
  lng: number;
  zoom: number;
  pitch: number;
  bearing: number;
}

interface GoogleMapsWindow extends Window {
  google?: {
    maps: {
      Map: any;
      LatLng: any;
    };
  };
}

export function useGoogle3DCamera(mapRef: React.MutableRefObject<any>) {
  const animationRef = useRef<number | null>(null);

  /**
   * Animate camera to a specific position
   */
  const animateToPosition = useCallback(
    (position: CameraPosition, duration: number = 1000) => {
      if (!mapRef.current) return;

      const googleWindow = window as GoogleMapsWindow;
      if (!googleWindow.google?.maps) return;

      // Cancel any ongoing animation
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      const startTime = Date.now();
      const startCamera = {
        center: mapRef.current.getCenter(),
        zoom: mapRef.current.getZoom(),
        pitch: mapRef.current.getPitch(),
        heading: mapRef.current.getHeading(),
      };

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function (ease-in-out)
        const easeProgress = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;

        const { LatLng } = googleWindow.google!.maps;

        // Interpolate camera values
        const newLat =
          startCamera.center.lat() + (position.lat - startCamera.center.lat()) * easeProgress;
        const newLng =
          startCamera.center.lng() + (position.lng - startCamera.center.lng()) * easeProgress;
        const newZoom = startCamera.zoom + (position.zoom - startCamera.zoom) * easeProgress;
        const newPitch = startCamera.pitch + (position.pitch - startCamera.pitch) * easeProgress;
        const newHeading = startCamera.heading + (position.bearing - startCamera.heading) * easeProgress;

        // Update camera
        mapRef.current.setCenter(new LatLng(newLat, newLng));
        mapRef.current.setZoom(newZoom);
        mapRef.current.setPitch(newPitch);
        mapRef.current.setHeading(newHeading);

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          animationRef.current = null;
        }
      };

      animationRef.current = requestAnimationFrame(animate);
    },
    [mapRef]
  );

  /**
   * Set camera position instantly
   */
  const setPosition = useCallback(
    (position: CameraPosition) => {
      if (!mapRef.current) return;

      const googleWindow = window as GoogleMapsWindow;
      if (!googleWindow.google?.maps) return;

      const { LatLng } = googleWindow.google.maps;

      mapRef.current.setCenter(new LatLng(position.lat, position.lng));
      mapRef.current.setZoom(position.zoom);
      mapRef.current.setPitch(position.pitch);
      mapRef.current.setHeading(position.bearing);
    },
    [mapRef]
  );

  /**
   * Get current camera position
   */
  const getPosition = useCallback((): CameraPosition | null => {
    if (!mapRef.current) return null;

    const center = mapRef.current.getCenter();

    return {
      lat: center.lat(),
      lng: center.lng(),
      zoom: mapRef.current.getZoom(),
      pitch: mapRef.current.getPitch(),
      bearing: mapRef.current.getHeading(),
    };
  }, [mapRef]);

  return {
    animateToPosition,
    setPosition,
    getPosition,
  };
}
