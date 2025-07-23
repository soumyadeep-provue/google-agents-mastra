import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { tokenStorage } from "./auth";

export const logoutTool = createTool({
  id: "logout",
  description: "Log out of Gmail by clearing stored authentication tokens",
  inputSchema: z.object({}),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string()
  }),
  execute: async (input: any) => {
    try {
      // Clear stored tokens from memory and localStorage
      tokenStorage.clearTokens();
      
      return {
        success: true,
        message: "✅ Successfully logged out of Gmail. You'll need to log in again to access your emails."
      };
    } catch (error) {
      return {
        success: false,
        message: "❌ Error logging out. Please try again."
      };
    }
  }
}); 