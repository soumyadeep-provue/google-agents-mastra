import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const getCurrentLocationTool = createTool({
  id: "getCurrentLocation",
  description: "Get the user's current location using GPS coordinates. This enables location-aware searches and recommendations.",
  inputSchema: z.object({
    highAccuracy: z.boolean().optional().describe("Request high accuracy GPS (default: true)")
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

    try {
      // Check if geolocation is available
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        return {
          success: false,
          message: "❌ Geolocation is not available in this environment. Please provide your location manually."
        };
      }

      // Get current position
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: highAccuracy,
            timeout: 10000,
            maximumAge: 300000 // 5 minutes cache
          }
        );
      });

      const { latitude, longitude, accuracy } = position.coords;

      // Optionally reverse geocode to get a readable address
      let address = undefined;
      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      
      if (apiKey) {
        try {
          const geoResponse = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`
          );
          const geoData = await geoResponse.json();
          
          if (geoData.status === 'OK' && geoData.results.length > 0) {
            address = geoData.results[0].formatted_address;
          }
        } catch (error) {
          console.warn("Could not reverse geocode location:", error);
        }
      }

      return {
        success: true,
        location: {
          latitude,
          longitude,
          accuracy,
          address
        },
        message: `✅ Current location: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}${address ? ` (${address})` : ''}`
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