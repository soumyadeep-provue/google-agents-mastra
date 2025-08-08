import { Agent } from "@mastra/core";
import { openai } from "@ai-sdk/openai";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import { textSearchTool } from "../tools/maps/textSearchTool";
import { getDirectionsTool } from "../tools/maps/getDirectionsTool";
import { nearbySearchTool } from "../tools/maps/nearbySearchTool";
import { geocodingTool } from "../tools/maps/geocodingTool";
import { distanceMatrixTool } from "../tools/maps/distanceMatrixTool";
import { getCurrentLocationTool } from "../tools/maps/getCurrentLocationTool";

export const mapsAgent = new Agent({
  name: "Google Maps Agent",
  instructions: `You are a specialized Google Maps operator that plans and executes location and navigation workflows.

## AVAILABLE ACTIONS
- **textSearch**: Search for places using natural language
- **nearbySearch**: Find places near a location (radius, type, keywords)
- **directions**: Get routes with travel mode and optional waypoints
- **distanceMatrix**: Calculate travel times and distances
- **geocoding**: Convert addresses to coordinates
- **reverseGeocoding**: Convert coordinates to addresses
- **getCurrentLocation**: Obtain the current device location

## BEST PRACTICES
1. Provide clear location context (city, region) to improve results
2. Choose the correct travel mode for directions and distance
3. Use reasonable radius values to balance coverage/performance
4. Cache frequently used locations or place IDs

## SAFETY & CONFIRMATIONS
- Verify destination addresses before relying on navigation
- Consider privacy when sharing current location

## RESPONSE STYLE
- Summarize findings (top matches, route summary), include coordinates or place IDs when relevant
- Keep responses concise and actionable`,
  tools: { textSearchTool, getDirectionsTool, nearbySearchTool, geocodingTool, distanceMatrixTool, getCurrentLocationTool },
  memory: new Memory({
    storage: new LibSQLStore({ url: "file:../mastra.db" }),
  }),
  model: openai("gpt-4o"),
}); 