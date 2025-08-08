import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { textSearchTool } from "./textSearchTool";
import { getDirectionsTool } from "./getDirectionsTool";
import { nearbySearchTool } from "./nearbySearchTool";
import { geocodingTool } from "./geocodingTool";
import { distanceMatrixTool } from "./distanceMatrixTool";
import { getCurrentLocationTool } from "./getCurrentLocationTool";

export const mapsTool = createTool({
  id: "maps",
  description: `A comprehensive tool for Google Maps operations: search places, get directions, find nearby locations, geocoding, and distance calculations.

## AVAILABLE ACTIONS

### Place Search & Discovery
- **"textSearch"**: Search for places using natural language
  - Use descriptive queries (e.g., "Italian restaurants in Manhattan")
  - Optionally bias results to specific location
  - Set radius to limit search area in meters
  - Example: { action: "textSearch", query: "coffee shops near Central Park", location: "New York, NY" }

- **"nearbySearch"**: Find places near a specific location
  - Specify center location and search radius
  - Filter by place type (restaurant, gas_station, etc.)
  - Use keywords for additional filtering
  - Example: { action: "nearbySearch", location: "Times Square, NYC", radius: 500, type: "restaurant" }

### Navigation & Directions
- **"directions"**: Get turn-by-turn directions between locations
  - Supports multiple travel modes: driving, walking, transit, bicycling
  - Add waypoints for multi-stop routes
  - Returns detailed route information and duration
  - Example: { action: "directions", origin: "NYC", destination: "Boston", mode: "driving" }

- **"distanceMatrix"**: Calculate distances and travel times
  - Multiple origins and destinations supported
  - Efficient for comparing multiple route options
  - Choose appropriate travel mode for accurate estimates
  - Example: { action: "distanceMatrix", origins: ["NYC", "Philadelphia"], destinations: ["Boston", "Washington DC"] }

### Location Services
- **"geocoding"**: Convert addresses to coordinates
  - Supports full addresses, landmarks, and place names
  - Returns latitude/longitude for mapping and calculations
  - Example: { action: "geocoding", address: "1600 Amphitheatre Parkway, Mountain View, CA" }

- **"reverseGeocoding"**: Convert coordinates to addresses
  - Input latitude and longitude coordinates
  - Returns formatted address and place information
  - Example: { action: "reverseGeocoding", latitude: 37.4224764, longitude: -122.0842499 }

- **"getCurrentLocation"**: Get device's current location
  - Returns current latitude and longitude
  - Useful for location-based searches and services
  - Example: { action: "getCurrentLocation" }

## BEST PRACTICES

### Search Optimization
- Use specific, descriptive search terms
- Include location context for better results
- Combine place types with keywords for precision
- Use appropriate search radius for area coverage

### Navigation
- Choose correct travel mode for accurate directions
- Consider traffic patterns for driving directions
- Use waypoints for complex multi-stop routes
- Verify locations before relying on navigation

### Location Data
- Validate coordinates are within expected ranges
- Handle location permission gracefully
- Cache frequently used location data
- Consider privacy implications of location requests

### Performance
- Use batch operations (distanceMatrix) for multiple calculations
- Avoid excessive API calls for similar searches
- Cache results for frequently accessed locations
- Use appropriate search radius to balance coverage and performance

### Data Usage
- Respect rate limits and usage quotas
- Store essential location data locally when appropriate
- Use place IDs for consistent location references
- Handle offline scenarios gracefully`,
  inputSchema: z.object({
    action: z.enum(["textSearch", "directions", "nearbySearch", "geocoding", "reverseGeocoding", "distanceMatrix", "getCurrentLocation"]).optional().describe("The specific Google Maps action to perform. If unclear or missing, will be handled by Maps specialist agent."),
    
    // Text search / Nearby search
    query: z.string().optional().describe("Search query for places (for textSearch action, e.g., 'restaurants in New York')"),
    location: z.string().optional().describe("Location bias or center location (for textSearch/nearbySearch actions)"),
    radius: z.number().optional().describe("Search radius in meters (for textSearch/nearbySearch actions)"),
    
    // Directions
    origin: z.string().optional().describe("Starting location (for directions/distanceMatrix actions, address or coordinates)"),
    destination: z.string().optional().describe("Destination location (for directions action, address or coordinates)"),
    mode: z.enum(["driving", "walking", "transit", "bicycling"]).optional().describe("Travel mode (for directions/distanceMatrix actions, default: driving)"),
    waypoints: z.array(z.string()).optional().describe("Intermediate waypoints (for directions action)"),
    
    // Nearby search
    type: z.string().optional().describe("Place type (for nearbySearch action, e.g., 'restaurant', 'gas_station')"),
    keyword: z.string().optional().describe("Keyword to search for (for nearbySearch action)"),
    
    // Geocoding
    address: z.string().optional().describe("Address to geocode into coordinates (for geocoding action)"),
    
    // Reverse geocoding
    latitude: z.number().optional().describe("Latitude coordinate (for reverseGeocoding action)"),
    longitude: z.number().optional().describe("Longitude coordinate (for reverseGeocoding action)"),
    
    // Distance matrix
    origins: z.array(z.string()).optional().describe("Array of origin locations (for distanceMatrix action)"),
    destinations: z.array(z.string()).optional().describe("Array of destination locations (for distanceMatrix action)"),
    
    // Fallback context for Maps specialist agent
    userIntent: z.string().optional().describe("Natural language description of what you want to do with Google Maps (used when action is unclear)")
  }),
  execute: async ({ context, threadId, resourceId, mastra }) => {
    // Handle cases where action is missing - provide helpful guidance
    if (!context.action) {
      return {
        success: false,
        message: "I can help you with Google Maps tasks! Please specify what you'd like to do. For example:\n- Search for places (restaurants, hotels, etc.)\n- Get directions between locations\n- Find nearby places by type\n- Convert addresses to coordinates (geocoding)\n- Convert coordinates to addresses (reverse geocoding)\n- Calculate travel distances and times\n- Get your current location",
        availableActions: ["textSearch", "directions", "nearbySearch", "geocoding", "reverseGeocoding", "distanceMatrix", "getCurrentLocation"]
      };
    }

    // Validate required fields for each action and provide helpful guidance
    switch (context.action) {
      case "textSearch":
        if (!context.query) {
          return {
            success: false,
            message: "To search for places, I need:\n- **Search Query**: What are you looking for? (e.g., 'restaurants in Mumbai', 'hotels near airport')",
            required: ["query"],
            optional: ["location", "radius"],
            providedFields: Object.keys(context).filter(key => context[key as keyof typeof context] !== undefined)
          };
        }
        return await textSearchTool.execute({
          context: {
            query: context.query,
            location: context.location,
            radius: context.radius
          }
        });
        
      case "directions":
        if (!context.origin || !context.destination) {
          return {
            success: false,
            message: "To get directions, I need:\n- **Origin**: Where are you starting from?\n- **Destination**: Where do you want to go?",
            required: ["origin", "destination"],
            optional: ["mode", "waypoints"],
            providedFields: Object.keys(context).filter(key => context[key as keyof typeof context] !== undefined)
          };
        }
        return await getDirectionsTool.execute({
          context: {
            origin: context.origin,
            destination: context.destination,
            mode: context.mode,
            waypoints: context.waypoints
          }
        });
        
      case "nearbySearch":
        if (!context.location) {
          return {
            success: false,
            message: "To find nearby places, I need:\n- **Location**: What location should I search around?",
            required: ["location"],
            optional: ["radius", "type", "keyword"],
            providedFields: Object.keys(context).filter(key => context[key as keyof typeof context] !== undefined)
          };
        }
        return await nearbySearchTool.execute({
          context: {
            location: context.location,
            radius: context.radius,
            type: context.type,
            keyword: context.keyword
          }
        });
        
      case "geocoding":
        if (!context.address) {
          return {
            success: false,
            message: "To convert an address to coordinates, I need:\n- **Address**: What address would you like to geocode? (e.g., '1600 Amphitheatre Parkway, Mountain View, CA')",
            required: ["address"],
            providedFields: Object.keys(context).filter(key => context[key as keyof typeof context] !== undefined)
          };
        }
        return await geocodingTool.execute({
          context: {
            address: context.address
          }
        });
        
      case "reverseGeocoding":
        if (context.latitude === undefined || context.longitude === undefined) {
          return {
            success: false,
            message: "To convert coordinates to an address, I need:\n- **Latitude**: The latitude coordinate\n- **Longitude**: The longitude coordinate",
            required: ["latitude", "longitude"],
            providedFields: Object.keys(context).filter(key => context[key as keyof typeof context] !== undefined)
          };
        }
        return await geocodingTool.execute({
          context: {
            latitude: context.latitude,
            longitude: context.longitude
          }
        });
        
      case "distanceMatrix":
        if (!context.origins || !context.destinations) {
          return {
            success: false,
            message: "To calculate distances and travel times, I need:\n- **Origins**: Array of starting locations\n- **Destinations**: Array of destination locations",
            required: ["origins", "destinations"],
            optional: ["mode"],
            providedFields: Object.keys(context).filter(key => context[key as keyof typeof context] !== undefined)
          };
        }
        return await distanceMatrixTool.execute({
          context: {
            origins: context.origins,
            destinations: context.destinations,
            mode: context.mode
          }
        });
        
      case "getCurrentLocation":
        // getCurrentLocation doesn't require any fields
        return await getCurrentLocationTool.execute({
          context: {}
        });
        
      default:
        // Fallback to Maps specialist agent for unknown actions
        console.log(`🔄 Maps action unclear or unknown: "${context.action}". Delegating to Maps specialist agent...`);
        
        if (!mastra) {
          return {
            success: false,
            message: `Unknown Google Maps action: "${context.action}". Available actions are:\n- textSearch: Search for places\n- directions: Get directions between locations\n- nearbySearch: Find nearby places\n- geocoding: Convert addresses to coordinates\n- reverseGeocoding: Convert coordinates to addresses\n- distanceMatrix: Calculate distances and travel times\n- getCurrentLocation: Get current device location`,
            availableActions: ["textSearch", "directions", "nearbySearch", "geocoding", "reverseGeocoding", "distanceMatrix", "getCurrentLocation"],
            unknownAction: context.action
          };
        }

        const mapsAgent = mastra.getAgent("mapsAgent");
        if (!mapsAgent) {
          return {
            success: false,
            message: `Unknown Google Maps action: "${context.action}". Available actions are:\n- textSearch: Search for places\n- directions: Get directions between locations\n- nearbySearch: Find nearby places\n- geocoding: Convert addresses to coordinates\n- reverseGeocoding: Convert coordinates to addresses\n- distanceMatrix: Calculate distances and travel times\n- getCurrentLocation: Get current device location`,
            availableActions: ["textSearch", "directions", "nearbySearch", "geocoding", "reverseGeocoding", "distanceMatrix", "getCurrentLocation"],
            unknownAction: context.action
          };
        }

        // Create a natural language prompt for the Maps specialist
        const contextDescription = Object.entries(context)
          .filter(([key, value]) => value !== undefined && value !== null)
          .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
          .join(", ");

        const prompt = `I need help with a Google Maps task. Here's the context I received: ${contextDescription}

Please analyze this and perform the appropriate Google Maps operation. If you need authentication, use the loginTool first.`;

        try {
          const result = await mapsAgent.generate(prompt, {
            memory: threadId && resourceId ? {
              thread: threadId,
              resource: resourceId,
            } : undefined,
            maxSteps: 8,
          });

          return {
            success: true,
            message: "✅ Google Maps task completed by specialist agent",
            specialistResponse: result.text,
            delegatedAction: true,
            originalContext: context,
          };
        } catch (error) {
          console.error("Maps specialist agent failed:", error);
          return {
            success: false,
            message: `Maps specialist agent failed to process the request. Available actions are:\n- textSearch: Search for places\n- directions: Get directions between locations\n- nearbySearch: Find nearby places\n- geocoding: Convert addresses to coordinates\n- reverseGeocoding: Convert coordinates to addresses\n- distanceMatrix: Calculate distances and travel times\n- getCurrentLocation: Get current device location`,
            error: error instanceof Error ? error.message : 'Unknown error',
            availableActions: ["textSearch", "directions", "nearbySearch", "geocoding", "reverseGeocoding", "distanceMatrix", "getCurrentLocation"]
          };
        }
    }
  }
}); 