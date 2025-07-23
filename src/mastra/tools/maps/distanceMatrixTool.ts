import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const distanceMatrixTool = createTool({
  id: "distanceMatrix",
  description: "Calculate travel distances and times between multiple origins and destinations. Great for route optimization and travel planning.",
  inputSchema: z.object({
    origins: z.array(z.string()).describe("Starting locations as array (e.g., ['New York, NY', 'Boston, MA'] or ['40.7128,-74.0060', '42.3601,-71.0589'])"),
    destinations: z.array(z.string()).describe("Destination locations as array (e.g., ['Los Angeles, CA', 'Chicago, IL'])"),
    travelMode: z.enum(["DRIVE", "BICYCLE", "WALK", "TRANSIT"]).optional().describe("Mode of transportation (default: DRIVE)"),
    routingPreference: z.enum(["TRAFFIC_UNAWARE", "TRAFFIC_AWARE", "TRAFFIC_AWARE_OPTIMAL"]).optional().describe("Routing preference for traffic (default: TRAFFIC_UNAWARE)"),
    avoidTolls: z.boolean().optional().describe("Avoid toll roads (default: false)"),
    avoidHighways: z.boolean().optional().describe("Avoid highways (default: false)"),
    avoidFerries: z.boolean().optional().describe("Avoid ferries (default: false)"),
    avoidIndoor: z.boolean().optional().describe("Avoid indoor routes (default: false)"),
    units: z.enum(["METRIC", "IMPERIAL"]).optional().describe("Distance units (default: METRIC)"),
    departureTime: z.string().optional().describe("Departure time for transit (ISO 8601 format)"),
    languageCode: z.string().optional().describe("Language code for results (e.g., 'en', 'es', 'fr')")
  }),
  outputSchema: z.object({
    success: z.boolean(),
    matrix: z.array(z.object({
      originIndex: z.number(),
      destinationIndex: z.number(),
      origin: z.string(),
      destination: z.string(),
      distance: z.string(),
      duration: z.string(),
      staticDuration: z.string().optional(),
      status: z.string(),
      condition: z.string(),
      tolls: z.array(z.object({
        currency: z.string(),
        amount: z.string()
      })).optional()
    })),
    origins: z.array(z.string()),
    destinations: z.array(z.string()),
    travelMode: z.string(),
    totalRoutes: z.number(),
    message: z.string()
  }),
  execute: async (input: any) => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new Error("Google Maps API not configured. Please set GOOGLE_MAPS_API_KEY environment variable.");
    }

    const origins = input.context?.origins;
    const destinations = input.context?.destinations;
    const travelMode = input.context?.travelMode || "DRIVE";
    const routingPreference = input.context?.routingPreference || "TRAFFIC_UNAWARE";
    const avoidTolls = input.context?.avoidTolls || false;
    const avoidHighways = input.context?.avoidHighways || false;
    const avoidFerries = input.context?.avoidFerries || false;
    const avoidIndoor = input.context?.avoidIndoor || false;
    const units = input.context?.units || "METRIC";
    const departureTime = input.context?.departureTime;
    const languageCode = input.context?.languageCode || 'en';

    if (!origins || !destinations || !Array.isArray(origins) || !Array.isArray(destinations)) {
      throw new Error("Both origins and destinations are required as arrays");
    }

    try {
      console.log(`🗺️ Calculating distance matrix: ${origins.length} origins × ${destinations.length} destinations (${travelMode})`);

      // Validate input limits (Google's API limits)
      if (origins.length > 50) {
        throw new Error("Maximum 50 origins allowed");
      }
      if (destinations.length > 50) {
        throw new Error("Maximum 50 destinations allowed");
      }

      const totalElements = origins.length * destinations.length;
      
      // Check element limits based on routing preference and travel mode
      if (travelMode === 'TRANSIT' && totalElements > 100) {
        throw new Error("Maximum 100 elements allowed for transit routes");
      }
      if (routingPreference === 'TRAFFIC_AWARE_OPTIMAL' && totalElements > 100) {
        throw new Error("Maximum 100 elements allowed for TRAFFIC_AWARE_OPTIMAL routing");
      }
      if (totalElements > 625) {
        throw new Error("Maximum 625 elements allowed");
      }

      // Helper function to create location object
      const createLocation = (location: string) => {
        // Check if location is already coordinates (lat,lng format)
        const coordMatch = location.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
        if (coordMatch) {
          return {
            waypoint: {
              location: {
                latLng: {
                  latitude: parseFloat(coordMatch[1]),
                  longitude: parseFloat(coordMatch[2])
                }
              }
            }
          };
        } else {
          // Use address
          return {
            waypoint: {
              address: location
            }
          };
        }
      };

      // Prepare request body for new Routes API
      const requestBody: any = {
        origins: origins.map((origin: string) => createLocation(origin)),
        destinations: destinations.map((destination: string) => createLocation(destination)),
        travelMode: travelMode,
        routingPreference: routingPreference,
        languageCode: languageCode,
        units: units
      };

      // Add route modifiers (avoidance options)
      const routeModifiers: any = {};
      if (avoidTolls) routeModifiers.avoidTolls = true;
      if (avoidHighways) routeModifiers.avoidHighways = true;
      if (avoidFerries) routeModifiers.avoidFerries = true;
      if (avoidIndoor) routeModifiers.avoidIndoor = true;

      if (Object.keys(routeModifiers).length > 0) {
        requestBody.origins = requestBody.origins.map((origin: any) => ({
          ...origin,
          routeModifiers: routeModifiers
        }));
      }

      // Add departure time for transit or traffic-aware routing
      if (departureTime && (travelMode === 'TRANSIT' || routingPreference !== 'TRAFFIC_UNAWARE')) {
        requestBody.departureTime = departureTime;
      }

      // Define field mask for response data
      const fieldMask = [
        'originIndex',
        'destinationIndex',
        'duration',
        'staticDuration',
        'distanceMeters',
        'status',
        'condition',
        'travelAdvisory'
      ].join(',');

      // Make request to new Routes API
      const response = await fetch('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': fieldMask
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(`Google Routes API error: ${response.status} - ${data.error?.message || 'Unknown error'}`);
      }

      // Note: The response is an array of elements, not wrapped in an object
      const elements = Array.isArray(data) ? data : [];

      if (elements.length === 0) {
        return {
          success: false,
          matrix: [],
          origins: origins,
          destinations: destinations,
          travelMode: travelMode,
          totalRoutes: 0,
          message: `❌ No distance data available for the specified locations`
        };
      }

      // Process the distance matrix results using new API response format
      const matrix: any[] = [];
      let successfulRoutes = 0;

      for (const element of elements) {
        const originIndex = element.originIndex || 0;
        const destinationIndex = element.destinationIndex || 0;
        
        // Extract toll information
        const tolls = element.travelAdvisory?.tollInfo?.estimatedPrice ? [{
          currency: element.travelAdvisory.tollInfo.estimatedPrice.currencyCode || 'USD',
          amount: (element.travelAdvisory.tollInfo.estimatedPrice.units || '0') + '.' + 
                 (element.travelAdvisory.tollInfo.estimatedPrice.nanos ? 
                  String(element.travelAdvisory.tollInfo.estimatedPrice.nanos).padStart(9, '0').substring(0, 2) : '00')
        }] : undefined;

        const route = {
          originIndex: originIndex,
          destinationIndex: destinationIndex,
          origin: origins[originIndex] || 'Unknown',
          destination: destinations[destinationIndex] || 'Unknown',
          distance: element.distanceMeters ? formatDistance(element.distanceMeters) : 'N/A',
          duration: element.duration ? formatDuration(element.duration) : 'N/A',
          staticDuration: element.staticDuration ? formatDuration(element.staticDuration) : undefined,
          status: element.status ? 'OK' : 'ERROR',
          condition: element.condition || 'UNKNOWN',
          tolls: tolls
        };
        
        matrix.push(route);
        
        if (element.condition === 'ROUTE_EXISTS') {
          successfulRoutes++;
        }
      }

      if (successfulRoutes === 0) {
        return {
          success: false,
          matrix: matrix,
          origins: origins,
          destinations: destinations,
          travelMode: travelMode,
          totalRoutes: matrix.length,
          message: `❌ No valid routes found between any of the specified locations using ${travelMode}`
        };
      }

      const modeText = travelMode.charAt(0).toUpperCase() + travelMode.slice(1).toLowerCase();
      
      // Build avoidance text
      const avoidanceOptions = [];
      if (avoidTolls) avoidanceOptions.push('tolls');
      if (avoidHighways) avoidanceOptions.push('highways');
      if (avoidFerries) avoidanceOptions.push('ferries');
      if (avoidIndoor) avoidanceOptions.push('indoor');
      const avoidanceText = avoidanceOptions.length > 0 ? ` (avoiding ${avoidanceOptions.join(', ')})` : '';
      
      const resultsText = successfulRoutes === matrix.length 
        ? `all ${matrix.length} routes`
        : `${successfulRoutes}/${matrix.length} routes`;

      return {
        success: true,
        matrix: matrix,
        origins: origins,
        destinations: destinations,
        travelMode: travelMode,
        totalRoutes: matrix.length,
        message: `✅ ${modeText} distance matrix calculated for ${resultsText}${avoidanceText}`
      };

    } catch (error) {
      console.error("Distance matrix error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      return {
        success: false,
        matrix: [],
        origins: origins || [],
        destinations: destinations || [],
        travelMode: travelMode,
        totalRoutes: 0,
        message: `❌ Failed to calculate distance matrix: ${errorMessage}`
      };
    }
  }
});

// Helper function to format distance from meters
function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  } else {
    return `${(meters / 1000).toFixed(1)} km`;
  }
}

// Helper function to format duration from duration string (e.g., "120s")
function formatDuration(duration: string): string {
  if (!duration) return '0 min';
  
  const seconds = parseInt(duration.replace('s', ''));
  if (seconds < 60) {
    return `${seconds} sec`;
  } else if (seconds < 3600) {
    const minutes = Math.round(seconds / 60);
    return `${minutes} min`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
} 