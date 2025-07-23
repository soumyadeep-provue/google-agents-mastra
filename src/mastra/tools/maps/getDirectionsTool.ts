import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const getDirectionsTool = createTool({
  id: "getDirections",
  description: "Get turn-by-turn driving directions between two or more locations. Supports multiple travel modes and route options.",
  inputSchema: z.object({
    origin: z.string().describe("Starting location - address, place name, or coordinates (lat,lng)"),
    destination: z.string().describe("Destination location - address, place name, or coordinates (lat,lng)"),
    intermediates: z.array(z.string()).optional().describe("Optional intermediate waypoints as array of locations"),
    travelMode: z.enum(["DRIVE", "BICYCLE", "WALK", "TRANSIT"]).optional().describe("Mode of transportation (default: DRIVE)"),
    routingPreference: z.enum(["TRAFFIC_UNAWARE", "TRAFFIC_AWARE", "TRAFFIC_AWARE_OPTIMAL"]).optional().describe("Routing preference for traffic (default: TRAFFIC_UNAWARE)"),
    avoidTolls: z.boolean().optional().describe("Avoid toll roads (default: false)"),
    avoidHighways: z.boolean().optional().describe("Avoid highways (default: false)"),
    avoidFerries: z.boolean().optional().describe("Avoid ferries (default: false)"),
    avoidIndoor: z.boolean().optional().describe("Avoid indoor routes (default: false)"),
    departureTime: z.string().optional().describe("Departure time for transit (ISO 8601 format)"),
    languageCode: z.string().optional().describe("Language code for instructions (e.g., 'en', 'es', 'fr')")
  }),
  outputSchema: z.object({
    success: z.boolean(),
    routes: z.array(z.object({
      summary: z.string(),
      distance: z.string(),
      duration: z.string(),
      staticDuration: z.string().optional(),
      steps: z.array(z.object({
        instruction: z.string(),
        distance: z.string(),
        duration: z.string(),
        maneuver: z.string().optional()
      })),
      warnings: z.array(z.string()).optional(),
      tolls: z.array(z.object({
        currency: z.string(),
        amount: z.string()
      })).optional()
    })),
    origin: z.string(),
    destination: z.string(),
    travelMode: z.string(),
    message: z.string()
  }),
  execute: async (input: any) => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new Error("Google Maps API not configured. Please set GOOGLE_MAPS_API_KEY environment variable.");
    }

    const origin = input.context?.origin;
    const destination = input.context?.destination;
    const intermediates = input.context?.intermediates;
    const travelMode = input.context?.travelMode || "DRIVE";
    const routingPreference = input.context?.routingPreference || "TRAFFIC_UNAWARE";
    const avoidTolls = input.context?.avoidTolls || false;
    const avoidHighways = input.context?.avoidHighways || false;
    const avoidFerries = input.context?.avoidFerries || false;
    const avoidIndoor = input.context?.avoidIndoor || false;
    const departureTime = input.context?.departureTime;
    const languageCode = input.context?.languageCode || 'en';

    if (!origin || !destination) {
      throw new Error("Both origin and destination are required");
    }

    try {
      console.log(`🗺️ Getting directions from "${origin}" to "${destination}" (${travelMode})`);

      // Helper function to create location object
      const createLocation = (location: string) => {
        // Check if location is already coordinates (lat,lng format)
        const coordMatch = location.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
        if (coordMatch) {
          return {
            location: {
              latLng: {
                latitude: parseFloat(coordMatch[1]),
                longitude: parseFloat(coordMatch[2])
              }
            }
          };
        } else {
          // Use address
          return {
            address: location
          };
        }
      };

      // Prepare request body for new Routes API
      const requestBody: any = {
        origin: createLocation(origin),
        destination: createLocation(destination),
        travelMode: travelMode,
        routingPreference: routingPreference,
        languageCode: languageCode,
        units: "METRIC"
      };

      // Add intermediate waypoints
      if (intermediates && intermediates.length > 0) {
        requestBody.intermediates = intermediates.map((waypoint: string) => createLocation(waypoint));
      }

      // Add route modifiers (avoidance options)
      const routeModifiers: any = {};
      if (avoidTolls) routeModifiers.avoidTolls = true;
      if (avoidHighways) routeModifiers.avoidHighways = true;
      if (avoidFerries) routeModifiers.avoidFerries = true;
      if (avoidIndoor) routeModifiers.avoidIndoor = true;

      if (Object.keys(routeModifiers).length > 0) {
        requestBody.routeModifiers = routeModifiers;
      }

      // Add departure time for transit or traffic-aware routing
      if (departureTime && (travelMode === 'TRANSIT' || routingPreference !== 'TRAFFIC_UNAWARE')) {
        requestBody.departureTime = departureTime;
      }

      // Define field mask for response data
      const fieldMask = [
        'routes.duration',
        'routes.staticDuration',
        'routes.distanceMeters',
        'routes.polyline',
        'routes.legs',
        'routes.warnings',
        'routes.travelAdvisory'
      ].join(',');

      // Make request to new Routes API
      const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
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

      if (!data.routes || data.routes.length === 0) {
        return {
          success: false,
          routes: [],
          origin: origin,
          destination: destination,
          travelMode: travelMode,
          message: `❌ No routes found from "${origin}" to "${destination}" using ${travelMode}`
        };
      }

      // Process routes using new API response format
      const processedRoutes = data.routes.map((route: any) => {
        const leg = route.legs?.[0]; // Use first leg for main route info
        
        // Process steps for turn-by-turn directions
        const steps = leg?.steps?.map((step: any) => ({
          instruction: step.navigationInstruction?.instructions || 'Continue',
          distance: formatDistance(step.distanceMeters),
          duration: formatDuration(step.staticDuration),
          maneuver: step.navigationInstruction?.maneuver || undefined
        })) || [];

        // Extract toll information
        const tolls = route.travelAdvisory?.tollInfo?.estimatedPrice ? [{
          currency: route.travelAdvisory.tollInfo.estimatedPrice.currencyCode || 'USD',
          amount: (route.travelAdvisory.tollInfo.estimatedPrice.units || '0') + '.' + 
                 (route.travelAdvisory.tollInfo.estimatedPrice.nanos ? 
                  String(route.travelAdvisory.tollInfo.estimatedPrice.nanos).padStart(9, '0').substring(0, 2) : '00')
        }] : undefined;

        return {
          summary: `Route from ${origin} to ${destination}`,
          distance: formatDistance(route.distanceMeters),
          duration: formatDuration(route.duration),
          staticDuration: route.staticDuration ? formatDuration(route.staticDuration) : undefined,
          steps: steps,
          warnings: route.warnings || [],
          tolls: tolls
        };
      });

      const routeInfo = processedRoutes[0]; // Main route
      const modeText = travelMode.charAt(0).toUpperCase() + travelMode.slice(1).toLowerCase();
      
      // Build avoidance text
      const avoidanceOptions = [];
      if (avoidTolls) avoidanceOptions.push('tolls');
      if (avoidHighways) avoidanceOptions.push('highways');
      if (avoidFerries) avoidanceOptions.push('ferries');
      if (avoidIndoor) avoidanceOptions.push('indoor');
      const avoidanceText = avoidanceOptions.length > 0 ? ` (avoiding ${avoidanceOptions.join(', ')})` : '';
      
      return {
        success: true,
        routes: processedRoutes,
        origin: origin,
        destination: destination,
        travelMode: travelMode,
        message: `✅ ${modeText} directions found: ${routeInfo.distance}, ${routeInfo.duration}${avoidanceText}`
      };

    } catch (error) {
      console.error("Directions error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      return {
        success: false,
        routes: [],
        origin: origin,
        destination: destination,
        travelMode: travelMode,
        message: `❌ Failed to get directions: ${errorMessage}`
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