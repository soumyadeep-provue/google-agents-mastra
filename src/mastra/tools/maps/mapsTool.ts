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
    action: z.enum(["textSearch", "directions", "nearbySearch", "geocoding", "reverseGeocoding", "distanceMatrix", "getCurrentLocation"]).describe("The action to perform"),
    
    // Text search / Nearby search
    query: z.string().optional().describe("Search query for places (required for textSearch action, e.g., 'restaurants in New York')"),
    location: z.string().optional().describe("Location bias or center location (optional for textSearch, required for nearbySearch)"),
    radius: z.number().optional().describe("Search radius in meters (optional for textSearch/nearbySearch)"),
    
    // Directions
    origin: z.string().optional().describe("Starting location (required for directions action, address or coordinates)"),
    destination: z.string().optional().describe("Destination location (required for directions action, address or coordinates)"),
    mode: z.enum(["driving", "walking", "transit", "bicycling"]).optional().describe("Travel mode (optional for directions/distanceMatrix, default: driving)"),
    waypoints: z.array(z.string()).optional().describe("Intermediate waypoints (optional for directions action)"),
    
    // Nearby search
    type: z.string().optional().describe("Place type (optional for nearbySearch action, e.g., 'restaurant', 'gas_station')"),
    keyword: z.string().optional().describe("Keyword to search for (optional for nearbySearch action)"),
    
    // Geocoding
    address: z.string().optional().describe("Address to geocode into coordinates (required for geocoding action)"),
    
    // Reverse geocoding
    latitude: z.number().optional().describe("Latitude coordinate (required for reverseGeocoding action)"),
    longitude: z.number().optional().describe("Longitude coordinate (required for reverseGeocoding action)"),
    
    // Get current location
    highAccuracy: z.boolean().optional().describe("Enable high accuracy GPS (optional for getCurrentLocation action)"),
    ipAddress: z.string().optional().describe("IP address for location detection (optional for getCurrentLocation action)"),
    fallbackLocation: z.string().optional().describe("Fallback location if GPS not available (optional for getCurrentLocation action)"),
    
    // Distance matrix
    origins: z.array(z.string()).optional().describe("Array of origin locations (required for distanceMatrix action)"),
    destinations: z.array(z.string()).optional().describe("Array of destination locations (required for distanceMatrix action)")
  }),
  execute: async ({ context }) => {
    switch (context.action) {
      case "textSearch":
        return await textSearchTool.execute({
          context: {
            query: context.query,
            location: context.location,
            radius: context.radius
          }
        });
        
      case "directions":
        return await getDirectionsTool.execute({
          context: {
            origin: context.origin,
            destination: context.destination,
            mode: context.mode,
            waypoints: context.waypoints
          }
        });
        
      case "nearbySearch":
        return await nearbySearchTool.execute({
          context: {
            location: context.location,
            radius: context.radius,
            type: context.type,
            keyword: context.keyword
          }
        });
        
      case "geocoding":
        return await geocodingTool.execute({
          context: {
            address: context.address
          }
        });
        
      case "reverseGeocoding":
        return await geocodingTool.execute({
          context: {
            latitude: context.latitude,
            longitude: context.longitude
          }
        });
        
      case "distanceMatrix":
        return await distanceMatrixTool.execute({
          context: {
            origins: context.origins,
            destinations: context.destinations,
            mode: context.mode
          }
        });
        
      case "getCurrentLocation":
        return await getCurrentLocationTool.execute({
          context: {
            highAccuracy: context.highAccuracy,
            ipAddress: context.ipAddress,
            fallbackLocation: context.fallbackLocation
          }
        });
        
      default:
        throw new Error(`Unknown action: ${(context as any).action}`);
    }
  }
}); 