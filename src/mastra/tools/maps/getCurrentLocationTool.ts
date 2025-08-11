import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const getCurrentLocationTool = createTool({
  id: "getCurrentLocation",
  description: "Get the user's current location using Google Geolocation API and return a formatted address via Google Geocoding.",
  inputSchema: z.object({
    // Kept for compatibility but ignored
    highAccuracy: z.boolean().optional(),
    ipAddress: z.string().optional(),
    fallbackLocation: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional()
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
  execute: async (_input: any, _options?: any) => {
    const mapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!mapsApiKey) {
      return { success: false, message: "❌ GOOGLE_MAPS_API_KEY is not set" };
    }

    try {
      // 1) Get approximate coordinates via Google Geolocation API (IP-based in server env)
      const geoLocateResp = await fetch(`https://www.googleapis.com/geolocation/v1/geolocate?key=${mapsApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ considerIp: true })
      });

      if (!geoLocateResp.ok) {
        const err = await geoLocateResp.text();
        return { success: false, message: `❌ Geolocation API error: ${geoLocateResp.status} ${err}` };
      }

      const geoLocateData = await geoLocateResp.json();
      const lat = geoLocateData?.location?.lat;
      const lng = geoLocateData?.location?.lng;
      const acc = typeof geoLocateData?.accuracy === 'number' ? geoLocateData.accuracy : undefined;
      if (typeof lat !== 'number' || typeof lng !== 'number') {
        return { success: false, message: "❌ Geolocation API did not return coordinates" };
      }

      // 2) Reverse geocode to get formatted address
      let address: string | undefined;
      const revUrl = new URL('https://maps.googleapis.com/maps/api/geocode/json');
      revUrl.searchParams.append('latlng', `${lat},${lng}`);
      revUrl.searchParams.append('key', mapsApiKey);
      const revResp = await fetch(revUrl.toString());
      if (revResp.ok) {
        const revData = await revResp.json();
        if (revData.status === 'OK' && Array.isArray(revData.results) && revData.results.length > 0) {
          address = revData.results[0].formatted_address;
        }
      }

      return {
        success: true,
        location: {
          latitude: lat,
          longitude: lng,
          accuracy: acc,
          address
        },
        message: address ? `✅ ${address}` : "✅ Coordinates obtained"
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, message: `❌ Failed to get current location: ${msg}` };
    }
  }
}); 