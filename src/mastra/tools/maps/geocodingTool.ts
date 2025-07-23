import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const geocodingTool = createTool({
  id: "geocoding",
  description: "Convert addresses to coordinates (geocoding) or coordinates to addresses (reverse geocoding). Useful for location analysis and mapping.",
  inputSchema: z.object({
    address: z.string().optional().describe("Address to convert to coordinates (e.g., '1600 Amphitheatre Parkway, Mountain View, CA')"),
    coordinates: z.string().optional().describe("Coordinates to convert to address (format: 'lat,lng' e.g., '37.4224764,-122.0842499')"),
    components: z.string().optional().describe("Component filtering (e.g., 'country:US|administrative_area:CA')"),
    region: z.string().optional().describe("Region code for biasing results (e.g., 'us', 'uk')"),
    language: z.string().optional().describe("Language code for results (e.g., 'en', 'es', 'fr')")
  }),
  outputSchema: z.object({
    success: z.boolean(),
    results: z.array(z.object({
      formattedAddress: z.string(),
      location: z.object({
        lat: z.number(),
        lng: z.number()
      }),
      placeId: z.string(),
      types: z.array(z.string()),
      addressComponents: z.array(z.object({
        longName: z.string(),
        shortName: z.string(),
        types: z.array(z.string())
      })).optional(),
      geometry: z.object({
        locationType: z.string(),
        viewport: z.object({
          northeast: z.object({ lat: z.number(), lng: z.number() }),
          southwest: z.object({ lat: z.number(), lng: z.number() })
        }).optional()
      }).optional()
    })),
    searchType: z.string(),
    query: z.string(),
    totalResults: z.number(),
    message: z.string()
  }),
  execute: async (input: any) => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new Error("Google Maps API not configured. Please set GOOGLE_MAPS_API_KEY environment variable.");
    }

    const address = input.context?.address;
    const coordinates = input.context?.coordinates;
    const components = input.context?.components;
    const region = input.context?.region;
    const language = input.context?.language;

    if (!address && !coordinates) {
      throw new Error("Either address or coordinates must be provided");
    }

    if (address && coordinates) {
      throw new Error("Provide either address OR coordinates, not both");
    }

    try {
      let searchType: string;
      let query: string;
      let geocodeUrl: URL;

      if (address) {
        // Forward geocoding: address → coordinates
        searchType = "forward";
        query = address;
        console.log(`🌍 Geocoding address: "${address}"`);
        
        geocodeUrl = new URL(`https://maps.googleapis.com/maps/api/geocode/json`);
        geocodeUrl.searchParams.append('address', address);
        
      } else {
        // Reverse geocoding: coordinates → address
        searchType = "reverse";
        query = coordinates!;
        console.log(`🌍 Reverse geocoding coordinates: ${coordinates}`);
        
        // Validate coordinates format
        const coordMatch = coordinates!.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
        if (!coordMatch) {
          throw new Error("Invalid coordinates format. Use 'lat,lng' format (e.g., '37.4224764,-122.0842499')");
        }
        
        geocodeUrl = new URL(`https://maps.googleapis.com/maps/api/geocode/json`);
        geocodeUrl.searchParams.append('latlng', coordinates!);
      }

      // Add optional parameters
      geocodeUrl.searchParams.append('key', apiKey);
      
      if (components) {
        geocodeUrl.searchParams.append('components', components);
      }
      
      if (region) {
        geocodeUrl.searchParams.append('region', region);
      }
      
      if (language) {
        geocodeUrl.searchParams.append('language', language);
      }

      const response = await fetch(geocodeUrl.toString());
      const data = await response.json();

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        let errorMessage = `Google Geocoding API error: ${data.status}`;
        
        if (data.status === 'INVALID_REQUEST') {
          errorMessage = "Invalid request. Check your address or coordinates format.";
        } else if (data.status === 'OVER_QUERY_LIMIT') {
          errorMessage = "API quota exceeded. Please try again later.";
        } else if (data.error_message) {
          errorMessage += ` - ${data.error_message}`;
        }
        
        throw new Error(errorMessage);
      }

      if (data.status === 'ZERO_RESULTS' || !data.results || data.results.length === 0) {
        return {
          success: false,
          results: [],
          searchType: searchType,
          query: query,
          totalResults: 0,
          message: `❌ No results found for ${searchType === 'forward' ? 'address' : 'coordinates'}: "${query}"`
        };
      }

      // Process and format results
      const results = data.results.map((result: any) => ({
        formattedAddress: result.formatted_address,
        location: {
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng
        },
        placeId: result.place_id,
        types: result.types || [],
        addressComponents: result.address_components?.map((component: any) => ({
          longName: component.long_name,
          shortName: component.short_name,
          types: component.types
        })),
        geometry: {
          locationType: result.geometry.location_type,
          viewport: result.geometry.viewport ? {
            northeast: result.geometry.viewport.northeast,
            southwest: result.geometry.viewport.southwest
          } : undefined
        }
      }));

      const actionText = searchType === 'forward' ? 'geocoded' : 'reverse geocoded';
      const resultText = searchType === 'forward' 
        ? `coordinates: ${results[0].location.lat}, ${results[0].location.lng}`
        : `address: ${results[0].formattedAddress}`;

      return {
        success: true,
        results: results,
        searchType: searchType,
        query: query,
        totalResults: results.length,
        message: `✅ Successfully ${actionText} "${query}" → ${resultText}${results.length > 1 ? ` (${results.length} total results)` : ''}`
      };

    } catch (error) {
      console.error("Geocoding error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      return {
        success: false,
        results: [],
        searchType: address ? "forward" : "reverse",
        query: address || coordinates || "",
        totalResults: 0,
        message: `❌ Failed to geocode: ${errorMessage}`
      };
    }
  }
}); 