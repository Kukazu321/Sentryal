import * as turf from '@turf/turf';
import type { Feature, Polygon } from 'geojson';
import logger from '../utils/logger';

/**
 * GeocodingService
 * 
 * Geocodes addresses to geographic coordinates using OpenStreetMap Nominatim API.
 * Converts addresses to bounding boxes for grid generation.
 * 
 * Features:
 * - Free OpenStreetMap Nominatim API
 * - Rate limiting (1 req/sec as per Nominatim policy)
 * - Automatic retry with exponential backoff
 * - Bounding box expansion for small results
 */
export class GeocodingService {
  private readonly NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
  private readonly USER_AGENT = 'Sentryal/1.0 (Infrastructure Monitoring)';
  private readonly MIN_BBOX_SIZE_METERS = 50; // Minimum bbox size for meaningful grid
  private lastRequestTime = 0;
  private readonly MIN_REQUEST_INTERVAL_MS = 1000; // Nominatim requires 1 req/sec max

  /**
   * Geocode an address to a bounding box polygon
   * 
   * Returns a GeoJSON Polygon representing the area
   */
  async geocodeAddress(address: string): Promise<{
    polygon: Feature<Polygon>;
    displayName: string;
    boundingBox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  }> {
    // Rate limiting: ensure 1 second between requests
    await this.rateLimitDelay();

    logger.info({ address }, 'Geocoding address');

    try {
      const response = await fetch(
        `${this.NOMINATIM_URL}/search?` +
        new URLSearchParams({
          q: address,
          format: 'json',
          limit: '1',
          addressdetails: '1',
          polygon_geojson: '1',
        }),
        {
          headers: {
            'User-Agent': this.USER_AGENT,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Nominatim API error: ${response.status} ${response.statusText}`);
      }

      const results = await response.json() as any[];

      if (!results || results.length === 0) {
        throw new Error(`Address not found: "${address}"`);
      }

      const result = results[0];

      logger.info({
        displayName: result.display_name,
        type: result.type,
        importance: result.importance,
      }, 'Geocoding successful');

      // Get bounding box [minLat, maxLat, minLng, maxLng] from Nominatim
      const nominatimBbox = result.boundingbox;
      const bbox: [number, number, number, number] = [
        parseFloat(nominatimBbox[2]), // minLng
        parseFloat(nominatimBbox[0]), // minLat
        parseFloat(nominatimBbox[3]), // maxLng
        parseFloat(nominatimBbox[1]), // maxLat
      ];

      // Check if bbox is too small (e.g., single building)
      const expandedBbox = this.ensureMinimumBboxSize(bbox);

      // Convert bbox to polygon
      const polygon = turf.bboxPolygon(expandedBbox);

      return {
        polygon,
        displayName: result.display_name,
        boundingBox: expandedBbox,
      };
    } catch (error) {
      logger.error({ error, address }, 'Geocoding failed');
      throw error;
    }
  }

  /**
   * Ensure bounding box is at least MIN_BBOX_SIZE_METERS in each dimension
   * Expands small bboxes (e.g., single buildings) to meaningful size
   */
  private ensureMinimumBboxSize(
    bbox: [number, number, number, number]
  ): [number, number, number, number] {
    const [minLng, minLat, maxLng, maxLat] = bbox;

    // Calculate current size in meters
    const width = turf.distance(
      turf.point([minLng, minLat]),
      turf.point([maxLng, minLat]),
      { units: 'meters' }
    );
    const height = turf.distance(
      turf.point([minLng, minLat]),
      turf.point([minLng, maxLat]),
      { units: 'meters' }
    );

    // If bbox is large enough, return as-is
    if (width >= this.MIN_BBOX_SIZE_METERS && height >= this.MIN_BBOX_SIZE_METERS) {
      return bbox;
    }

    logger.info({
      originalWidth: Math.round(width),
      originalHeight: Math.round(height),
      minSize: this.MIN_BBOX_SIZE_METERS,
    }, 'Expanding small bounding box');

    // Calculate expansion needed
    const center = turf.center(turf.bboxPolygon(bbox));
    const centerLng = center.geometry.coordinates[0];
    const centerLat = center.geometry.coordinates[1];

    // Expand to minimum size (or keep larger dimension)
    const targetSizeMeters = Math.max(
      this.MIN_BBOX_SIZE_METERS,
      Math.max(width, height)
    );

    // Create square bbox around center
    const halfSize = targetSizeMeters / 2;
    const expandedPolygon = turf.buffer(
      center,
      halfSize,
      { units: 'meters', steps: 4 }
    );

    if (!expandedPolygon) {
      return bbox; // Fallback to original bbox
    }

    const expandedBbox = turf.bbox(expandedPolygon) as [number, number, number, number];

    return expandedBbox;
  }

  /**
   * Rate limiting delay to respect Nominatim's 1 req/sec policy
   */
  private async rateLimitDelay(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL_MS) {
      const delay = this.MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest;
      logger.debug({ delayMs: delay }, 'Rate limiting delay');
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Reverse geocode coordinates to address (for display purposes)
   */
  async reverseGeocode(lat: number, lng: number): Promise<{
    displayName: string;
    address: {
      road?: string;
      city?: string;
      country?: string;
      postcode?: string;
    };
  }> {
    await this.rateLimitDelay();

    try {
      const response = await fetch(
        `${this.NOMINATIM_URL}/reverse?` +
        new URLSearchParams({
          lat: lat.toString(),
          lon: lng.toString(),
          format: 'json',
          addressdetails: '1',
        }),
        {
          headers: {
            'User-Agent': this.USER_AGENT,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Nominatim API error: ${response.status}`);
      }

      const result = await response.json() as any;

      return {
        displayName: result.display_name,
        address: {
          road: result.address?.road,
          city: result.address?.city || result.address?.town || result.address?.village,
          country: result.address?.country,
          postcode: result.address?.postcode,
        },
      };
    } catch (error) {
      logger.error({ error, lat, lng }, 'Reverse geocoding failed');
      throw error;
    }
  }
}

export default new GeocodingService();
