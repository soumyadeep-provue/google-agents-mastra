import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const textSearchTool = createTool({
  id: "textSearch",
  description: "Search for places, businesses, or locations using text queries. Find restaurants, shops, landmarks, addresses, and more.",
  inputSchema: z.object({
    query: z.string().describe("Search query - e.g., 'coffee shops in Manhattan', 'Central Park NYC', '123 Main St'"),
    location: z.string().optional().describe("Optional location bias - e.g., 'New York, NY' to search around that area"),
    radius: z.number().optional().describe("Search radius in meters (default: 5000, max: 50000)"),
    maxResults: z.number().optional().describe("Maximum number of results to return (default: 10, max: 20)"),
    priceLevel: z.enum(["FREE", "INEXPENSIVE", "MODERATE", "EXPENSIVE", "VERY_EXPENSIVE"]).optional().describe("Filter by price level"),
    minRating: z.number().optional().describe("Minimum rating filter (0.0-5.0)"),
    openNow: z.boolean().optional().describe("Only return places that are open now")
  }),
  outputSchema: z.object({
    success: z.boolean(),
    places: z.array(z.object({
      name: z.string(),
      address: z.string(),
      location: z.object({
        lat: z.number(),
        lng: z.number()
      }),
      rating: z.number().optional(),
      types: z.array(z.string()).optional(),
      placeId: z.string(),
      isOpen: z.boolean().optional(),
      priceLevel: z.string().optional(),
      photos: z.array(z.string()).optional(),
      businessStatus: z.string().optional(),
      userRatingCount: z.number().optional()
    })),
    totalResults: z.number(),
    searchQuery: z.string(),
    message: z.string(),
    nextPageToken: z.string().optional()
  }),
  execute: async (input: any) => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new Error("Google Maps API not configured. Please set GOOGLE_MAPS_API_KEY environment variable.");
    }

    const query = input.context?.query;
    const location = input.context?.location;
    const radius = Math.min(input.context?.radius || 5000, 50000);
    const maxResults = Math.min(input.context?.maxResults || 10, 20);
    const priceLevel = input.context?.priceLevel;
    const minRating = input.context?.minRating;
    const openNow = input.context?.openNow;

    if (!query) {
      throw new Error("Search query is required");
    }

    try {
      console.log(`🔍 Searching for: "${query}"${location ? ` near ${location}` : ''}`);

      // Prepare request body for new Places API
      const requestBody: any = {
        textQuery: query,
        maxResultCount: maxResults
      };

      // Add location bias if provided
      if (location) {
        try {
          // First geocode the location to get coordinates
          const geoResponse = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${apiKey}`
          );
          const geoData = await geoResponse.json();
          
          if (geoData.status === 'OK' && geoData.results.length > 0) {
            const coords = geoData.results[0].geometry.location;
            requestBody.locationBias = {
              circle: {
                center: {
                  latitude: coords.lat,
                  longitude: coords.lng
                },
                radius: radius
              }
            };
          }
        } catch (geoError) {
          console.warn("Could not geocode location, searching without location bias");
        }
      }

      // Add filters
      if (priceLevel || minRating !== undefined || openNow !== undefined) {
        requestBody.searchAlongRouteParameters = {};
        
        if (priceLevel) {
          requestBody.priceLevels = [priceLevel];
        }
        
        if (minRating !== undefined) {
          requestBody.minRating = minRating;
        }
        
        if (openNow) {
          requestBody.openNow = true;
        }
      }

      // Define field mask for response data
      const fieldMask = [
        'places.displayName',
        'places.formattedAddress', 
        'places.location',
        'places.rating',
        'places.types',
        'places.id',
        'places.regularOpeningHours',
        'places.priceLevel',
        'places.photos',
        'places.businessStatus',
        'places.userRatingCount'
      ].join(',');

      // Make request to new Places API
      const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
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
        throw new Error(`Google Places API error: ${response.status} - ${data.error?.message || 'Unknown error'}`);
      }

      if (!data.places || data.places.length === 0) {
        return {
          success: false,
          places: [],
          totalResults: 0,
          searchQuery: query,
          message: `❌ No places found for "${query}"${location ? ` near ${location}` : ''}. Try a different search term.`
        };
      }

      // Process and format results using new API response format
      const places = data.places.map((place: any) => ({
        name: place.displayName?.text || 'Unknown',
        address: place.formattedAddress || 'Address not available',
        location: {
          lat: place.location?.latitude || 0,
          lng: place.location?.longitude || 0
        },
        rating: place.rating || undefined,
        types: place.types || [],
        placeId: place.id || '',
        isOpen: place.regularOpeningHours?.openNow || undefined,
        priceLevel: getPriceLevelText(place.priceLevel),
        photos: place.photos?.slice(0, 3).map((photo: any) => 
          `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=400&key=${apiKey}`
        ) || [],
        businessStatus: place.businessStatus || undefined,
        userRatingCount: place.userRatingCount || undefined
      }));

      const locationText = location ? ` near ${location}` : '';
      const radiusText = location ? ` (within ${radius/1000}km)` : '';
      
      return {
        success: true,
        places: places,
        totalResults: places.length,
        searchQuery: query,
        message: `✅ Found ${places.length} place${places.length > 1 ? 's' : ''} for "${query}"${locationText}${radiusText}`,
        nextPageToken: data.nextPageToken
      };

    } catch (error) {
      console.error("Maps search error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      return {
        success: false,
        places: [],
        totalResults: 0,
        searchQuery: query,
        message: `❌ Failed to search places: ${errorMessage}`
      };
    }
  }
});

function getPriceLevelText(level: string | undefined): string | undefined {
  if (!level) return undefined;
  
  const levels: { [key: string]: string } = {
    'PRICE_LEVEL_FREE': 'Free',
    'PRICE_LEVEL_INEXPENSIVE': '$',
    'PRICE_LEVEL_MODERATE': '$$', 
    'PRICE_LEVEL_EXPENSIVE': '$$$',
    'PRICE_LEVEL_VERY_EXPENSIVE': '$$$$'
  };
  
  return levels[level] || undefined;
} 