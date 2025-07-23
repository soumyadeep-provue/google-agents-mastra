import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const nearbySearchTool = createTool({
  id: "nearbySearch",
  description: "Find places near a specific location. Great for discovering restaurants, gas stations, ATMs, and other businesses around you.",
  inputSchema: z.object({
    location: z.string().describe("Location to search near - address, place name, or coordinates (lat,lng)"),
    includedTypes: z.array(z.string()).optional().describe("Types of places to include - e.g., ['restaurant', 'gas_station', 'atm', 'hospital', 'school']"),
    excludedTypes: z.array(z.string()).optional().describe("Types of places to exclude"),
    radius: z.number().optional().describe("Search radius in meters (default: 1500, max: 50000)"),
    minRating: z.number().optional().describe("Minimum rating filter (1.0-5.0, default: no filter)"),
    priceLevels: z.array(z.enum(["PRICE_LEVEL_FREE", "PRICE_LEVEL_INEXPENSIVE", "PRICE_LEVEL_MODERATE", "PRICE_LEVEL_EXPENSIVE", "PRICE_LEVEL_VERY_EXPENSIVE"])).optional().describe("Price level filters"),
    openNow: z.boolean().optional().describe("Only return places that are open now (default: false)"),
    maxResults: z.number().optional().describe("Maximum number of results (default: 15, max: 20)"),
    languageCode: z.string().optional().describe("Language code for results (e.g., 'en', 'es', 'fr')")
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
      distance: z.string().optional(),
      rating: z.number().optional(),
      types: z.array(z.string()),
      placeId: z.string(),
      isOpen: z.boolean().optional(),
      priceLevel: z.string().optional(),
      photos: z.array(z.string()).optional(),
      businessStatus: z.string().optional(),
      userRatingCount: z.number().optional()
    })),
    searchLocation: z.string(),
    totalResults: z.number(),
    message: z.string()
  }),
  execute: async (input: any) => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new Error("Google Maps API not configured. Please set GOOGLE_MAPS_API_KEY environment variable.");
    }

    const location = input.context?.location;
    const includedTypes = input.context?.includedTypes;
    const excludedTypes = input.context?.excludedTypes;
    const radius = Math.min(input.context?.radius || 1500, 50000);
    const minRating = input.context?.minRating;
    const priceLevels = input.context?.priceLevels;
    const openNow = input.context?.openNow;
    const maxResults = Math.min(input.context?.maxResults || 15, 20);
    const languageCode = input.context?.languageCode || 'en';

    if (!location) {
      throw new Error("Location is required for nearby search");
    }

    try {
      console.log(`📍 Searching for places near "${location}"`);

      // First, geocode the location to get coordinates
      let searchCoords: {lat: number, lng: number} | null = null;
      
      // Check if location is already coordinates (lat,lng format)
      const coordMatch = location.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
      if (coordMatch) {
        searchCoords = {
          lat: parseFloat(coordMatch[1]),
          lng: parseFloat(coordMatch[2])
        };
      } else {
        // Geocode the location using legacy geocoding API (still supported)
        const geoResponse = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${apiKey}`
        );
        const geoData = await geoResponse.json();
        
        if (geoData.status !== 'OK' || !geoData.results || geoData.results.length === 0) {
          throw new Error(`Could not find location: "${location}". Please check the address.`);
        }
        
        searchCoords = geoData.results[0].geometry.location;
      }

      if (!searchCoords) {
        throw new Error("Could not determine location coordinates");
      }

      // Prepare request body for new Nearby Search API
      const requestBody: any = {
        maxResultCount: maxResults,
        languageCode: languageCode,
        locationRestriction: {
          circle: {
            center: {
              latitude: searchCoords.lat,
              longitude: searchCoords.lng
            },
            radius: radius
          }
        }
      };

      // Add type filters
      if (includedTypes && includedTypes.length > 0) {
        requestBody.includedTypes = includedTypes;
      }

      if (excludedTypes && excludedTypes.length > 0) {
        requestBody.excludedTypes = excludedTypes;
      }

      // Add rating filter
      if (minRating !== undefined) {
        requestBody.minRating = minRating;
      }

      // Add price level filters
      if (priceLevels && priceLevels.length > 0) {
        requestBody.priceLevels = priceLevels;
      }

      // Add open now filter
      if (openNow) {
        requestBody.openNow = true;
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

      // Make request to new Nearby Search API
      const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
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
        const searchTypes = includedTypes?.join(', ') || 'places';
        return {
          success: false,
          places: [],
          searchLocation: location,
          totalResults: 0,
          message: `❌ No ${searchTypes} found near "${location}" within ${radius/1000}km${openNow ? ' that are open now' : ''}`
        };
      }

      // Process and format results using new API response format
      const places = data.places.map((place: any) => {
        // Calculate distance from search location
        const distance = calculateDistance(
          searchCoords!.lat, searchCoords!.lng,
          place.location?.latitude || 0, place.location?.longitude || 0
        );

        return {
          name: place.displayName?.text || 'Unknown',
          address: place.formattedAddress || 'Address not available',
          location: {
            lat: place.location?.latitude || 0,
            lng: place.location?.longitude || 0
          },
          distance: distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`,
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
        };
      });

      // Sort by distance
      places.sort((a: any, b: any) => {
        const aDistance = parseFloat(a.distance!.replace(/[km]/g, ''));
        const bDistance = parseFloat(b.distance!.replace(/[km]/g, ''));
        return aDistance - bDistance;
      });

      const searchTypes = includedTypes?.join(', ') || 'places';
      const filtersText = [];
      if (minRating) filtersText.push(`rating ≥${minRating}`);
      if (priceLevels?.length) filtersText.push(`price filters`);
      if (openNow) filtersText.push('open now');
      const filterSuffix = filtersText.length > 0 ? ` (${filtersText.join(', ')})` : '';

      return {
        success: true,
        places: places,
        searchLocation: location,
        totalResults: places.length,
        message: `✅ Found ${places.length} ${searchTypes} near "${location}" within ${radius/1000}km${filterSuffix}`
      };

    } catch (error) {
      console.error("Nearby search error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      return {
        success: false,
        places: [],
        searchLocation: location,
        totalResults: 0,
        message: `❌ Failed to search nearby places: ${errorMessage}`
      };
    }
  }
});

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  // Calculate distance using Haversine formula (returns km)
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

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