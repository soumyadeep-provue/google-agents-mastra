import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const getCurrentLocationTool = createTool({
  id: "getCurrentLocation",
  description: "Get the user's current location. Since this runs in a server environment, it provides guidance on how to get location information or uses IP-based location detection.",
  inputSchema: z.object({
    highAccuracy: z.boolean().optional().describe("Request high accuracy GPS (default: true)"),
    ipAddress: z.string().optional().describe("Optional IP address for location detection"),
    fallbackLocation: z.string().optional().describe("Fallback location if GPS not available (e.g., 'San Francisco, CA')")
  }),
  outputSchema: z.object({
    success: z.boolean(),
    location: z.object({
      latitude: z.number(),
      longitude: z.number(),
      accuracy: z.number().optional(),
      address: z.string().optional()
    }).optional(),
    message: z.string()
  }),
  execute: async (input: any) => {
    const highAccuracy = input.context?.highAccuracy ?? true;
    const ipAddress = input.context?.ipAddress;
    const fallbackLocation = input.context?.fallbackLocation;

    try {
      // Since we're in a server environment, we can't use navigator.geolocation
      // Instead, we'll provide helpful guidance and try IP-based location if available
      
      let location = null;
      let message = "";

      // Try IP-based location detection if IP address is provided
      if (ipAddress) {
        try {
          // Use a free IP geolocation service
          const ipResponse = await fetch(`http://ip-api.com/json/${ipAddress}`);
          const ipData = await ipResponse.json();
          
          if (ipData.status === 'success') {
            location = {
              latitude: ipData.lat,
              longitude: ipData.lon,
              accuracy: 10000, // IP-based location is less accurate
              address: `${ipData.city}, ${ipData.regionName}, ${ipData.country}`
            };
            message = `✅ Location detected from IP address: ${location.address}`;
          }
        } catch (error) {
          console.warn("IP geolocation failed:", error);
        }
      }

      // If we have a fallback location, geocode it
      if (!location && fallbackLocation) {
        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        if (apiKey) {
          try {
            const geoResponse = await fetch(
              `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fallbackLocation)}&key=${apiKey}`
            );
            const geoData = await geoResponse.json();
            
            if (geoData.status === 'OK' && geoData.results.length > 0) {
              const coords = geoData.results[0].geometry.location;
              location = {
                latitude: coords.lat,
                longitude: coords.lng,
                accuracy: 1000,
                address: geoData.results[0].formatted_address
              };
              message = `✅ Using provided location: ${location.address}`;
            }
          } catch (error) {
            console.warn("Geocoding fallback location failed:", error);
          }
        }
      }

      // If no location detected, provide guidance
      if (!location) {
        return {
          success: false,
          message: `❌ Current location unavailable in server environment. 
          
**To get your location for Maps services:**
1. Provide your address manually in search queries (e.g., "restaurants near 123 Main St, San Francisco")
2. Use specific location parameters in other Maps actions
3. Pass your IP address for approximate location detection
4. Provide a fallbackLocation parameter (e.g., "San Francisco, CA")

**Alternative approach:** Use other Maps actions with specific locations instead of getCurrentLocation.`
        };
      }

      return {
        success: true,
        location,
        message
      };

    } catch (error: any) {
      let errorMessage = "❌ Failed to get current location";
      
      if (error.code) {
        switch (error.code) {
          case 1: // PERMISSION_DENIED
            errorMessage = "❌ Location access denied. Please enable location permissions in your browser.";
            break;
          case 2: // POSITION_UNAVAILABLE
            errorMessage = "❌ Location unavailable. Please check your GPS settings.";
            break;
          case 3: // TIMEOUT
            errorMessage = "❌ Location request timed out. Please try again.";
            break;
        }
      }

      return {
        success: false,
        message: errorMessage
      };
    }
  }
}); 