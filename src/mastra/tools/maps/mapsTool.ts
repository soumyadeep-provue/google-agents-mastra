import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const mapsTool = createTool({
  id: "maps",
  description: `A natural language Google Maps tool that delegates all operations to a specialized Maps agent. Simply describe what you want to do with Google Maps in plain English.

## HOW TO USE

Just describe your Google Maps task naturally! The tool accepts natural language requests and handles all the complexity for you.

### Examples of Requests:

**Finding Places:**
- "Find restaurants near Times Square"
- "Search for coffee shops in downtown Seattle"
- "Look for gas stations within 5 miles of my location"
- "Find the best Italian restaurants in Little Italy"

**Getting Directions:**
- "Get directions from JFK Airport to Manhattan"
- "How do I get from Mumbai to Pune by car?"
- "Give me walking directions to the nearest subway station"
- "Show me the route from my hotel to the conference center"

**Nearby Search:**
- "What's around me right now?"
- "Find ATMs near Marine Drive, Mumbai"
- "Show me all hospitals within 2 km of my location"
- "Find parking spots near the shopping mall"

**Location Information:**
- "What's the address of the Empire State Building?"
- "Convert these coordinates to an address: 40.7128, -74.0060"
- "Get my current location coordinates"
- "Where exactly is 1600 Amphitheatre Parkway?"

**Distance & Travel Time:**
- "How far is it from Los Angeles to San Francisco?"
- "Calculate travel time between these cities by train"
- "Compare driving vs walking time to the office"
- "How long does it take to get there by bicycle?"

**Complex Navigation:**
- "Plan a route from home to work with a stop at the grocery store"
- "Find the fastest route avoiding tolls"
- "Get public transit directions with the least walking"
- "Plan a multi-city road trip route"

## WHAT YOU CAN PROVIDE

While the tool works with natural language, you can also provide specific details when available:

- **Location names or addresses** for searches and directions
- **Travel modes** (driving, walking, transit, bicycling)
- **Search radius** for nearby searches
- **Place types** (restaurant, gas_station, hospital, etc.)
- **Coordinates** (latitude/longitude) for precise locations
- **Multiple locations** for route planning and distance calculations

## INTELLIGENCE FEATURES

The Google Maps specialist agent will:
- ✅ **Interpret your intent** from natural language
- ✅ **Find locations** when you describe them
- ✅ **Ask for missing information** when needed
- ✅ **Handle authentication** automatically
- ✅ **Use best practices** for location searches and navigation
- ✅ **Provide helpful responses** with addresses, coordinates, and travel details
- ✅ **Handle complex workflows** like multi-stop route planning
- ✅ **Optimize searches** for better results and performance

## BEST PRACTICES APPLIED

The agent automatically follows best practices:
- **Smart Location Discovery**: Finds places by description when exact addresses aren't provided
- **Optimal Route Planning**: Chooses appropriate travel modes and considers traffic
- **Efficient Searches**: Uses proper search radius and filters for relevant results
- **Privacy Protection**: Handles location data responsibly and securely
- **Performance Optimization**: Caches results and minimizes API calls

## LOCATION SERVICES

The agent can handle all Google Maps services:
- **Place Search**: Find businesses, landmarks, and points of interest
- **Navigation**: Turn-by-turn directions with multiple travel modes
- **Geocoding**: Convert between addresses and coordinates
- **Nearby Search**: Discover places around specific locations
- **Distance Matrix**: Calculate travel times and distances
- **Current Location**: Get device location when permitted

## SECURITY & PRIVACY

- All operations go through Google's secure APIs
- Authentication is handled safely
- Location data is processed securely and not stored unnecessarily
- Privacy best practices for location services are automatically applied
- User consent is respected for location-based requests`,
  inputSchema: z.object({
    // Natural language request - let the Maps agent interpret the intent
    request: z.string().describe("Natural language description of what you want to do with Google Maps (e.g., 'Find restaurants near Times Square', 'Get directions from airport to hotel', 'Show me what's around my location')"),
    
    // Optional specific parameters that users can provide
    query: z.string().optional().describe("Search query for places"),
    location: z.string().optional().describe("Location for searches or as reference point"),
    radius: z.number().optional().describe("Search radius in meters"),
    origin: z.string().optional().describe("Starting location for directions or distance calculations"),
    destination: z.string().optional().describe("Destination location"),
    mode: z.enum(["driving", "walking", "transit", "bicycling"]).optional().describe("Travel mode"),
    waypoints: z.array(z.string()).optional().describe("Intermediate stops for directions"),
    type: z.string().optional().describe("Place type (e.g., 'restaurant', 'gas_station', 'hospital')"),
    keyword: z.string().optional().describe("Keyword for place searches"),
    address: z.string().optional().describe("Address to geocode"),
    latitude: z.number().optional().describe("Latitude coordinate"),
    longitude: z.number().optional().describe("Longitude coordinate"),
    origins: z.array(z.string()).optional().describe("Array of origin locations for distance matrix"),
    destinations: z.array(z.string()).optional().describe("Array of destination locations for distance matrix")
  }),
  execute: async ({ context, threadId, resourceId, mastra }) => {
    console.log("🔄 Maps tool: Delegating all requests directly to Maps specialist agent...");
    
    // Ensure we have access to the Mastra instance
    if (!mastra) {
      return {
        success: false,
        message: "Google Maps specialist agent is not available. Unable to process Maps requests.",
        error: "Mastra instance not provided"
      };
    }

    // Get the Maps specialist agent
    const mapsAgent = mastra.getAgent("mapsAgent");
    if (!mapsAgent) {
      return {
        success: false,
        message: "Google Maps specialist agent is not available. Please check your configuration.",
        error: "Maps agent not found in Mastra instance"
      };
    }

    // Build a comprehensive prompt with the user's request and any provided parameters
    let prompt = `I need help with a Google Maps task: ${context.request}`;
    
    // Add any specific parameters that were provided
    const providedParams = Object.entries(context)
      .filter(([key, value]) => key !== 'request' && value !== undefined && value !== null)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join(", ");
    
    if (providedParams) {
      prompt += `\n\nAdditional context provided: ${providedParams}`;
    }
    
    prompt += `\n\nPlease analyze this request and perform the appropriate Google Maps operation. If you need authentication, use the loginTool first.`;

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
        agentResponse: result.text,
        delegatedToAgent: true,
        userRequest: context.request,
        providedContext: context,
      };
    } catch (error) {
      console.error("Maps specialist agent failed:", error);
      return {
        success: false,
        message: "Google Maps specialist agent failed to process the request. Please try again or provide more specific details about what you want to do with Google Maps.",
        error: error instanceof Error ? error.message : 'Unknown error',
        userRequest: context.request,
        providedContext: context,
      };
    }
  }
}); 