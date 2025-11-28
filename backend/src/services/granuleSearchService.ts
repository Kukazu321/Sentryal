import logger from '../utils/logger';

/**
 * GranuleSearchService - Search Sentinel-1 granules via ASF Search API
 * 
 * Based on ASF Search API documentation:
 * https://search.asf.alaska.edu/api/
 * 
 * Finds Sentinel-1 SLC granules that cover a given bbox and date range,
 * then selects optimal InSAR pairs based on:
 * - Same relative orbit (track)
 * - Temporal baseline (ideally 12 days for Sentinel-1)
 * - Perpendicular baseline < 150m
 * - Spatial overlap
 */

interface BBox {
  type: 'Polygon';
  coordinates: number[][][];
}

interface DateRange {
  start: string; // ISO date: YYYY-MM-DD
  end: string;
}

interface Granule {
  granuleName: string;
  sceneName: string;
  platform: string; // Sentinel-1A or Sentinel-1B
  beamMode: string; // IW
  polarization: string; // VV+VH, HH+HV
  flightDirection: string; // ASCENDING or DESCENDING
  pathNumber: number; // Relative orbit / track
  frameNumber: number;
  startTime: string; // ISO datetime
  stopTime: string;
  centerLat: number;
  centerLon: number;
  bytes: number;
  url: string;
}

interface InSARPair {
  reference: Granule;
  secondary: Granule;
  temporalBaselineDays: number;
  perpendicularBaselineMeters?: number; // Estimated
  quality: number; // 0-1 score
}

export class GranuleSearchService {
  private baseUrl: string;
  private useMockData: boolean;

  constructor() {
    this.baseUrl = process.env.ASF_SEARCH_API_URL || 'https://api.daac.asf.alaska.edu/services/search/param';
    // Only use mock data if explicitly enabled
    this.useMockData = process.env.USE_MOCK_GRANULES === 'true';

    if (this.useMockData) {
      logger.info('GranuleSearchService running in MOCK mode');
    } else {
      logger.info('GranuleSearchService running with ASF Search API');
    }
  }

  /**
   * Find InSAR pairs for a given bbox and date range
   * 
   * @param bbox Bounding box as GeoJSON Polygon
   * @param dateRange Date range for granule search
   * @param options Search options
   * @returns Array of InSAR pairs sorted by quality
   */
  async findInSARPairs(
    bbox: BBox,
    dateRange: DateRange,
    options?: {
      maxPairs?: number;
      maxTemporalBaseline?: number; // days
      platform?: 'Sentinel-1A' | 'Sentinel-1B' | 'both';
      flightDirection?: 'ASCENDING' | 'DESCENDING' | 'both';
    }
  ): Promise<InSARPair[]> {
    if (this.useMockData) {
      return this.findMockInSARPairs(bbox, dateRange, options);
    }

    try {
      logger.info({ bbox, dateRange, options }, 'Searching for Sentinel-1 granules');

      // 1. Search for all Sentinel-1 SLC granules in bbox and date range
      const granules = await this.searchGranules(bbox, dateRange, options);

      if (granules.length === 0) {
        logger.warn('No Sentinel-1 granules found for given bbox and date range');
        return [];
      }

      logger.info({ count: granules.length }, 'Found Sentinel-1 granules');

      // 2. Group granules by track (relative orbit)
      const granulesPerTrack = this.groupByTrack(granules);

      // 3. Find pairs within each track
      const allPairs: InSARPair[] = [];
      const maxTemporalBaseline = options?.maxTemporalBaseline || 48; // 48 days max

      for (const [track, trackGranules] of granulesPerTrack.entries()) {
        if (trackGranules.length < 2) continue;

        // Sort by date
        trackGranules.sort((a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        );

        // Find pairs
        for (let i = 0; i < trackGranules.length; i++) {
          for (let j = i + 1; j < trackGranules.length; j++) {
            const ref = trackGranules[i];
            const sec = trackGranules[j];

            const temporalBaseline = this.calculateTemporalBaseline(ref, sec);

            if (temporalBaseline > maxTemporalBaseline) break; // No need to check further

            // Estimate perpendicular baseline (simplified)
            const perpBaseline = this.estimatePerpendicularBaseline(ref, sec);

            // Calculate quality score
            const quality = this.calculatePairQuality(temporalBaseline, perpBaseline);

            allPairs.push({
              reference: ref,
              secondary: sec,
              temporalBaselineDays: temporalBaseline,
              perpendicularBaselineMeters: perpBaseline,
              quality
            });
          }
        }
      }

      // 4. Sort by quality and return top pairs
      allPairs.sort((a, b) => b.quality - a.quality);

      const maxPairs = options?.maxPairs || 5;
      const topPairs = allPairs.slice(0, maxPairs);

      logger.info({
        totalPairs: allPairs.length,
        returnedPairs: topPairs.length
      }, 'InSAR pairs found');

      return topPairs;
    } catch (error) {
      logger.error({ error }, 'Failed to find InSAR pairs');
      throw error;
    }
  }

  /**
   * Search granules via ASF Search API
   */
  private async searchGranules(
    bbox: BBox,
    dateRange: DateRange,
    options?: any
  ): Promise<Granule[]> {
    // Convert GeoJSON bbox to ASF format (lon_min,lat_min,lon_max,lat_max)
    const coords = bbox.coordinates[0];
    const lons = coords.map(c => c[0]);
    const lats = coords.map(c => c[1]);
    const bboxStr = `${Math.min(...lons)},${Math.min(...lats)},${Math.max(...lons)},${Math.max(...lats)}`;

    // Build query parameters
    const params = new URLSearchParams({
      platform: options?.platform === 'both' ? 'Sentinel-1A,Sentinel-1B' :
        options?.platform || 'Sentinel-1A,Sentinel-1B',
      processingLevel: 'SLC',
      beamMode: 'IW',
      bbox: bboxStr,
      start: `${dateRange.start}T00:00:00Z`,
      end: `${dateRange.end}T23:59:59Z`,
      output: 'json',
      maxResults: '250' // ASF limit
    });

    if (options?.flightDirection && options.flightDirection !== 'both') {
      params.append('flightDirection', options.flightDirection);
    }

    const url = `${this.baseUrl}?${params.toString()}`;

    logger.debug({ url }, 'Querying ASF Search API');

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`ASF Search API error: ${response.status}`);
    }

    const data = await response.json();

    // Parse ASF response format
    const granules: Granule[] = data[0]?.map((item: any) => ({
      granuleName: item.granuleName || item.sceneName,
      sceneName: item.sceneName,
      platform: item.platform,
      beamMode: item.beamMode,
      polarization: item.polarization,
      flightDirection: item.flightDirection,
      pathNumber: item.pathNumber || item.relativeOrbit,
      frameNumber: item.frameNumber,
      startTime: item.startTime,
      stopTime: item.stopTime,
      centerLat: item.centerLat,
      centerLon: item.centerLon,
      bytes: item.bytes,
      url: item.url
    })) || [];

    return granules;
  }

  /**
   * Group granules by track (relative orbit)
   */
  private groupByTrack(granules: Granule[]): Map<number, Granule[]> {
    const grouped = new Map<number, Granule[]>();

    for (const granule of granules) {
      const track = granule.pathNumber;
      if (!grouped.has(track)) {
        grouped.set(track, []);
      }
      grouped.get(track)!.push(granule);
    }

    return grouped;
  }

  /**
   * Calculate temporal baseline in days
   */
  private calculateTemporalBaseline(ref: Granule, sec: Granule): number {
    const refDate = new Date(ref.startTime);
    const secDate = new Date(sec.startTime);
    const diffMs = Math.abs(secDate.getTime() - refDate.getTime());
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Estimate perpendicular baseline (simplified)
   * 
   * NOTE: Real perpendicular baseline calculation requires precise orbit data.
   * This is a rough estimate based on temporal baseline.
   * For accurate baseline, use ISCE2 or GAMMA software.
   */
  private estimatePerpendicularBaseline(ref: Granule, sec: Granule): number {
    // Simplified estimation:
    // Sentinel-1 has ~100m tube diameter
    // Perpendicular baseline varies with temporal baseline
    // Rough approximation: 0-200m range

    const temporalBaseline = this.calculateTemporalBaseline(ref, sec);

    // Random component (since we don't have real orbit data)
    // In production, this should be calculated from precise orbit files
    const estimatedBaseline = Math.min(200, temporalBaseline * 2 + Math.random() * 50);

    return Math.round(estimatedBaseline);
  }

  /**
   * Calculate pair quality score (0-1)
   * 
   * Based on:
   * - Temporal baseline (12 days = optimal for Sentinel-1)
   * - Perpendicular baseline (< 150m = good)
   */
  private calculatePairQuality(temporalDays: number, perpBaselineM: number): number {
    // Temporal score: 12 days = 1.0, decreases with distance from 12
    const optimalTemporal = 12;
    const temporalScore = Math.exp(-Math.pow((temporalDays - optimalTemporal) / 20, 2));

    // Perpendicular baseline score: < 150m = good
    const perpScore = perpBaselineM < 150 ? 1.0 : Math.exp(-Math.pow((perpBaselineM - 150) / 100, 2));

    // Combined score (weighted average)
    const quality = 0.6 * temporalScore + 0.4 * perpScore;

    return Math.round(quality * 1000) / 1000; // 3 decimals
  }

  /**
   * Mock InSAR pairs for development
   */
  private async findMockInSARPairs(
    bbox: BBox,
    dateRange: DateRange,
    options?: any
  ): Promise<InSARPair[]> {
    logger.info('Generating MOCK InSAR pairs');

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));

    // Generate mock granule names
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff < 12) {
      logger.warn('Date range too short for InSAR pairs (need at least 12 days)');
      return [];
    }

    // Generate 3 mock pairs
    const pairs: InSARPair[] = [];
    const maxPairs = Math.min(options?.maxPairs || 5, 3);

    for (let i = 0; i < maxPairs; i++) {
      const refDate = new Date(startDate);
      refDate.setDate(refDate.getDate() + (i * 24)); // Every 24 days

      const secDate = new Date(refDate);
      secDate.setDate(secDate.getDate() + 12); // 12 days later

      if (secDate > endDate) break;

      const refGranule: Granule = {
        granuleName: `S1A_IW_SLC__1SDV_${this.formatDateForGranule(refDate)}_MOCK`,
        sceneName: `S1A_IW_SLC__1SDV_${this.formatDateForGranule(refDate)}_MOCK`,
        platform: 'Sentinel-1A',
        beamMode: 'IW',
        polarization: 'VV+VH',
        flightDirection: 'ASCENDING',
        pathNumber: 73,
        frameNumber: 123,
        startTime: refDate.toISOString(),
        stopTime: new Date(refDate.getTime() + 30000).toISOString(),
        centerLat: bbox.coordinates[0][0][1],
        centerLon: bbox.coordinates[0][0][0],
        bytes: 5000000000,
        url: `mock://granule-${i}-ref`
      };

      const secGranule: Granule = {
        ...refGranule,
        granuleName: `S1A_IW_SLC__1SDV_${this.formatDateForGranule(secDate)}_MOCK`,
        sceneName: `S1A_IW_SLC__1SDV_${this.formatDateForGranule(secDate)}_MOCK`,
        startTime: secDate.toISOString(),
        stopTime: new Date(secDate.getTime() + 30000).toISOString(),
        url: `mock://granule-${i}-sec`
      };

      const temporalBaseline = 12;
      const perpBaseline = 50 + Math.random() * 50; // 50-100m
      const quality = this.calculatePairQuality(temporalBaseline, perpBaseline);

      pairs.push({
        reference: refGranule,
        secondary: secGranule,
        temporalBaselineDays: temporalBaseline,
        perpendicularBaselineMeters: perpBaseline,
        quality
      });
    }

    logger.info({ pairsCount: pairs.length }, 'MOCK InSAR pairs generated');

    return pairs;
  }

  /**
   * Format date for granule name (YYYYMMDDTHHMMSS)
   */
  private formatDateForGranule(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');

    return `${year}${month}${day}T${hours}${minutes}${seconds}`;
  }

  /**
   * Find N granules closest to a target date
   * 
   * @param bbox Bounding box as GeoJSON Polygon
   * @param targetDate Target date (YYYY-MM-DD)
   * @param count Number of granules to return
   * @param options Search options
   * @returns Array of granules sorted by proximity to target date
   */
  async findClosestGranules(
    bbox: BBox,
    targetDate: string,
    count: number = 3,
    options?: {
      platform?: 'Sentinel-1A' | 'Sentinel-1B' | 'both';
      flightDirection?: 'ASCENDING' | 'DESCENDING' | 'both';
      searchWindowDays?: number; // Days before/after target date to search
    }
  ): Promise<Granule[]> {
    if (this.useMockData) {
      return this.findMockClosestGranules(bbox, targetDate, count, options);
    }

    try {
      const target = new Date(targetDate);
      const searchWindowDays = options?.searchWindowDays || 90; // Default 90 days window
      const searchStart = new Date(target);
      searchStart.setDate(target.getDate() - searchWindowDays);
      const searchEnd = new Date(target);
      searchEnd.setDate(target.getDate() + searchWindowDays);

      logger.info({
        bbox,
        targetDate,
        count,
        searchWindow: { start: searchStart.toISOString().split('T')[0], end: searchEnd.toISOString().split('T')[0] }
      }, 'Finding closest granules to target date');

      // Search for granules in the window
      const granules = await this.searchGranules(
        bbox,
        {
          start: searchStart.toISOString().split('T')[0],
          end: searchEnd.toISOString().split('T')[0]
        },
        options
      );

      if (granules.length === 0) {
        logger.warn('No Sentinel-1 granules found near target date');
        return [];
      }

      // Sort by distance from target date
      granules.sort((a, b) => {
        const dateA = new Date(a.startTime);
        const dateB = new Date(b.startTime);
        const diffA = Math.abs(dateA.getTime() - target.getTime());
        const diffB = Math.abs(dateB.getTime() - target.getTime());
        return diffA - diffB;
      });

      // --- INTELLIGENT TRACK SELECTION ---
      // Instead of just taking top N, we must ensure they are on the SAME TRACK.
      // 1. Pick the absolute closest granule to define the "Best Track"
      const bestGranule = granules[0];
      const bestTrack = bestGranule.pathNumber;
      const bestDirection = bestGranule.flightDirection;

      logger.info({
        targetDate,
        bestTrack,
        bestDirection,
        closestGranule: bestGranule.startTime
      }, 'Locked onto best track for InSAR consistency');

      // 2. Filter all granules to keep ONLY those on this track
      const consistentGranules = granules.filter(g =>
        g.pathNumber === bestTrack &&
        g.flightDirection === bestDirection
      );

      // 3. Return top N from the consistent list
      const closest = consistentGranules.slice(0, count);

      logger.info({
        requested: count,
        foundConsistent: closest.length,
        track: bestTrack
      }, 'Returning consistent InSAR stack');

      return closest;
    } catch (error) {
      logger.error({ error }, 'Failed to find closest granules');
      throw error;
    }
  }

  /**
   * Find granules closest to multiple target dates
   * 
   * @param bbox Bounding box as GeoJSON Polygon
   * @param targetDates Array of target dates (YYYY-MM-DD)
   * @param options Search options
   * @returns Map of date -> closest granule for each target date
   */
  async findGranulesForDates(
    bbox: BBox,
    targetDates: string[],
    options?: {
      platform?: 'Sentinel-1A' | 'Sentinel-1B' | 'both';
      flightDirection?: 'ASCENDING' | 'DESCENDING' | 'both';
      searchWindowDays?: number;
    }
  ): Promise<Map<string, Granule>> {
    if (this.useMockData) {
      return this.findMockGranulesForDates(bbox, targetDates, options);
    }

    try {
      const result = new Map<string, Granule>();
      const searchWindowDays = options?.searchWindowDays || 30; // Default 30 days window

      // Find min/max dates to create search window
      const dates = targetDates.map(d => new Date(d)).sort((a, b) => a.getTime() - b.getTime());
      const searchStart = new Date(dates[0]);
      searchStart.setDate(searchStart.getDate() - searchWindowDays);
      const searchEnd = new Date(dates[dates.length - 1]);
      searchEnd.setDate(searchEnd.getDate() + searchWindowDays);

      logger.info({
        bbox,
        targetDates,
        searchWindow: { start: searchStart.toISOString().split('T')[0], end: searchEnd.toISOString().split('T')[0] }
      }, 'Finding granules for multiple target dates');

      // Search for all granules in the window
      const allGranules = await this.searchGranules(
        bbox,
        {
          start: searchStart.toISOString().split('T')[0],
          end: searchEnd.toISOString().split('T')[0]
        },
        options
      );

      if (allGranules.length === 0) {
        logger.warn('No Sentinel-1 granules found for target dates');
        return result;
      }

      // Group granules by track to ensure we get granules on the same track
      const byTrack = new Map<number, Granule[]>();
      for (const granule of allGranules) {
        const trackGranules = byTrack.get(granule.pathNumber) || [];
        trackGranules.push(granule);
        byTrack.set(granule.pathNumber, trackGranules);
      }

      logger.info({
        totalGranules: allGranules.length,
        tracks: Array.from(byTrack.keys()),
        granulesPerTrack: Array.from(byTrack.entries()).map(([track, g]) => ({ track, count: g.length }))
      }, 'Granules grouped by track');

      // Find the track that has the most coverage for all target dates
      let bestTrack: number | null = null;
      let bestScore = -1;

      for (const [track, trackGranules] of byTrack.entries()) {
        // Count how many target dates can be covered by this track
        let score = 0;
        for (const targetDate of targetDates) {
          const target = new Date(targetDate);
          const closest = trackGranules.reduce((best, current) => {
            const currentDate = new Date(current.startTime);
            const bestDate = new Date(best.startTime);
            const diffCurrent = Math.abs(currentDate.getTime() - target.getTime());
            const diffBest = Math.abs(bestDate.getTime() - target.getTime());
            return diffCurrent < diffBest ? current : best;
          });

          // Check if closest is within acceptable window (30 days)
          const diff = Math.abs(new Date(closest.startTime).getTime() - target.getTime());
          const diffDays = diff / (1000 * 60 * 60 * 24);
          if (diffDays <= searchWindowDays) {
            score++;
          }
        }

        if (score > bestScore) {
          bestScore = score;
          bestTrack = track;
        }
      }

      if (bestTrack === null || bestScore < 2) {
        logger.warn({
          bestTrack,
          bestScore,
          needed: targetDates.length
        }, 'Could not find a single track covering at least 2 target dates');

        // Fallback: return the closest granule for each date (even if different tracks)
        for (const targetDate of targetDates) {
          const target = new Date(targetDate);
          const closest = allGranules.reduce((best, current) => {
            const currentDate = new Date(current.startTime);
            const bestDate = new Date(best.startTime);
            const diffCurrent = Math.abs(currentDate.getTime() - target.getTime());
            const diffBest = Math.abs(bestDate.getTime() - target.getTime());
            return diffCurrent < diffBest ? current : best;
          });
          result.set(targetDate, closest);
        }

        logger.info({ count: result.size }, 'Found granules for target dates (WARNING: may be on different tracks)');
        return result;
      }

      // Use the best track to find closest granules for each date
      const bestTrackGranules = byTrack.get(bestTrack)!;

      for (const targetDate of targetDates) {
        const target = new Date(targetDate);
        const closest = bestTrackGranules.reduce((best, current) => {
          const currentDate = new Date(current.startTime);
          const bestDate = new Date(best.startTime);
          const diffCurrent = Math.abs(currentDate.getTime() - target.getTime());
          const diffBest = Math.abs(bestDate.getTime() - target.getTime());
          return diffCurrent < diffBest ? current : best;
        });

        result.set(targetDate, closest);
        logger.debug({
          targetDate,
          closestDate: closest.startTime,
          granule: closest.granuleName,
          track: bestTrack,
          diffDays: Math.abs(new Date(closest.startTime).getTime() - target.getTime()) / (1000 * 60 * 60 * 24)
        }, 'Found closest granule on best track');
      }

      logger.info({
        count: result.size,
        track: bestTrack,
        coverage: `${bestScore}/${targetDates.length} dates`
      }, 'Found granules on same track for target dates');
      return result;
    } catch (error) {
      logger.error({ error }, 'Failed to find granules for dates');
      throw error;
    }
  }

  /**
   * Create InSAR pairs from a list of granules
   * Uses the first granule as reference and creates pairs with subsequent granules
   * 
   * @param granules Array of granules (should be sorted chronologically)
   * @returns Array of InSAR pairs
   */
  async createPairsFromGranules(granules: Granule[]): Promise<InSARPair[]> {
    if (granules.length < 2) {
      return [];
    }

    // Group granules by pathNumber (track)
    const byTrack = new Map<number, Granule[]>();
    for (const granule of granules) {
      const trackGranules = byTrack.get(granule.pathNumber) || [];
      trackGranules.push(granule);
      byTrack.set(granule.pathNumber, trackGranules);
    }

    logger.info({
      totalGranules: granules.length,
      tracks: Array.from(byTrack.keys()),
      granulesPerTrack: Array.from(byTrack.entries()).map(([track, g]) => ({ track, count: g.length }))
    }, 'Grouping granules by track for pairing');

    const pairs: InSARPair[] = [];

    // Create pairs within each track
    for (const [track, trackGranules] of byTrack.entries()) {
      if (trackGranules.length < 2) {
        logger.warn({ track, count: trackGranules.length }, 'Not enough granules on this track for pairing');
        continue;
      }

      // Sort granules by date
      const sortedGranules = [...trackGranules].sort((a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );

      // Use first granule as reference, pair with others
      const reference = sortedGranules[0];

      for (let i = 1; i < sortedGranules.length; i++) {
        const secondary = sortedGranules[i];

        const temporalBaseline = this.calculateTemporalBaseline(reference, secondary);
        const perpBaseline = this.estimatePerpendicularBaseline(reference, secondary);
        const quality = this.calculatePairQuality(temporalBaseline, perpBaseline);

        pairs.push({
          reference,
          secondary,
          temporalBaselineDays: temporalBaseline,
          perpendicularBaselineMeters: perpBaseline,
          quality
        });
      }

      logger.info({ track, pairsCreated: sortedGranules.length - 1 }, 'Created pairs for track');
    }

    // Sort by quality
    pairs.sort((a, b) => b.quality - a.quality);

    logger.info({ pairsCount: pairs.length }, 'Created InSAR pairs from granules');
    return pairs;
  }

  /**
   * Mock methods for development
   */
  private async findMockClosestGranules(
    bbox: BBox,
    targetDate: string,
    count: number,
    options?: any
  ): Promise<Granule[]> {
    logger.info('Generating MOCK closest granules');
    await new Promise(resolve => setTimeout(resolve, 300));

    const target = new Date(targetDate);
    const granules: Granule[] = [];

    for (let i = 0; i < count; i++) {
      const date = new Date(target);
      date.setDate(target.getDate() + (i - Math.floor(count / 2)) * 12); // Spread around target

      granules.push({
        granuleName: `S1A_IW_SLC__1SDV_${this.formatDateForGranule(date)}_MOCK`,
        sceneName: `S1A_IW_SLC__1SDV_${this.formatDateForGranule(date)}_MOCK`,
        platform: 'Sentinel-1A',
        beamMode: 'IW',
        polarization: 'VV+VH',
        flightDirection: 'ASCENDING',
        pathNumber: 73,
        frameNumber: 123,
        startTime: date.toISOString(),
        stopTime: new Date(date.getTime() + 30000).toISOString(),
        centerLat: bbox.coordinates[0][0][1],
        centerLon: bbox.coordinates[0][0][0],
        bytes: 5000000000,
        url: `mock://granule-${i}`
      });
    }

    return granules.sort((a, b) => {
      const diffA = Math.abs(new Date(a.startTime).getTime() - target.getTime());
      const diffB = Math.abs(new Date(b.startTime).getTime() - target.getTime());
      return diffA - diffB;
    });
  }

  private async findMockGranulesForDates(
    bbox: BBox,
    targetDates: string[],
    options?: any
  ): Promise<Map<string, Granule>> {
    logger.info('Generating MOCK granules for dates');
    await new Promise(resolve => setTimeout(resolve, 300));

    const result = new Map<string, Granule>();

    for (const targetDate of targetDates) {
      const target = new Date(targetDate);
      const granule: Granule = {
        granuleName: `S1A_IW_SLC__1SDV_${this.formatDateForGranule(target)}_MOCK`,
        sceneName: `S1A_IW_SLC__1SDV_${this.formatDateForGranule(target)}_MOCK`,
        platform: 'Sentinel-1A',
        beamMode: 'IW',
        polarization: 'VV+VH',
        flightDirection: 'ASCENDING',
        pathNumber: 73,
        frameNumber: 123,
        startTime: target.toISOString(),
        stopTime: new Date(target.getTime() + 30000).toISOString(),
        centerLat: bbox.coordinates[0][0][1],
        centerLon: bbox.coordinates[0][0][0],
        bytes: 5000000000,
        url: `mock://granule-${targetDate}`
      };
      result.set(targetDate, granule);
    }

    return result;
  }
}

export const granuleSearchService = new GranuleSearchService();
