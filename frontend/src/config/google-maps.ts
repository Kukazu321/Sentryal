/**
 * Google Maps Configuration
 * Centralized configuration for Google Maps 3D integration
 */

export const GOOGLE_MAPS_CONFIG = {
  // API Key
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',

  // Default camera settings for 3D view
  defaultCamera: {
    zoom: 18,
    pitch: 60,
    bearing: 45,
  },

  // Map options
  mapOptions: {
    disableDefaultUI: false,
    zoomControl: true,
    mapTypeControl: false,
    fullscreenControl: true,
    streetViewControl: true,
  },

  // Marker styling
  marker: {
    size: 40,
    borderWidth: 3,
    borderColor: '#ffffff',
    backgroundColor: '#000000',
    shadowColor: 'rgba(0,0,0,0.4)',
    shadowBlur: 12,
  },

  // Animation settings
  animation: {
    duration: 300,
    easing: 'ease-in-out',
  },

  // Error messages
  errors: {
    apiNotLoaded: 'Google Maps API failed to load',
    mapContainerNotFound: 'Map container element not found',
    invalidCoordinates: 'Invalid latitude/longitude coordinates',
  },
} as const;

export type GoogleMapsConfig = typeof GOOGLE_MAPS_CONFIG;
