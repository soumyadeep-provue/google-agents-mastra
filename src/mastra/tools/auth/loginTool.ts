import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getAuthUrl, getTokens, tokenStorage } from "./auth";
import express from "express";

// Global OAuth server management
let oauthServer: any = null;
let oauthApp: any = null;
const authPromises = new Map<string, { resolve: Function; reject: Function }>();

function startOAuthServer() {
  if (oauthServer) {
    return; // Server already running
  }

  oauthApp = express();
  oauthServer = oauthApp.listen(3000, () => {
    console.log("🔐 OAuth callback server started on port 3000");
  });

  oauthApp.get("/callback", async (req: any, res: any) => {
    const code = req.query.code as string;
    const state = req.query.state as string; // Use state to identify which request
    
    if (!code) {
      res.send("❌ No authorization code provided. Please try again.");
      return;
    }

    try {
      const tokens = await getTokens(code);
      tokenStorage.setTokens(tokens);
      
      res.send("✅ Successfully connected to Google! You can close this tab and return to the chat.");
      console.log("✅ Google OAuth completed successfully");
      
      // Resolve the waiting promise if it exists
      const authPromise = authPromises.get(state || 'default');
      if (authPromise) {
        authPromise.resolve({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiryDate: tokens.expiry_date
        });
        authPromises.delete(state || 'default');
      }
      
    } catch (err) {
      console.error("❌ OAuth error:", err);
      res.send("❌ Failed to authenticate. Please try again.");
      
      // Reject the waiting promise if it exists
      const authPromise = authPromises.get(state || 'default');
      if (authPromise) {
        authPromise.reject(err);
        authPromises.delete(state || 'default');
      }
    }
  });
}

function waitForAuth(requestId: string, timeoutMs: number): Promise<any> {
  return new Promise((resolve, reject) => {
    authPromises.set(requestId, { resolve, reject });
    
    setTimeout(() => {
      authPromises.delete(requestId);
      reject(new Error("Authentication timed out"));
    }, timeoutMs);
  });
}

export const loginTool = createTool({
  id: "loginTool",
  description: "Shows Google OAuth login link and waits for user to authenticate.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    accessToken: z.string(),
    refreshToken: z.string(),
    expiryDate: z.number(),
    output: z.string().describe("The result message to show to the user"),
  }),
  execute: async (input: any) => {
    // Start OAuth server if not already running
    startOAuthServer();
    
    const requestId = `auth_${Date.now()}`;
    const authUrl = `${getAuthUrl()}&state=${requestId}`;
    
    console.log("🔐 GOOGLE AUTHENTICATION REQUIRED - Auth URL generated:");
    console.log(`🔗 CONNECT: ${authUrl}`);
    console.log("Waiting for user to complete OAuth flow...");
    
    try {
      // Wait for authentication completion
      const result = await waitForAuth(requestId, 5 * 60 * 1000); // 5 minutes timeout
      
      console.log("✅ Authentication completed successfully");
      
      return {
        accessToken: result.accessToken || "authenticated",
        refreshToken: result.refreshToken || "authenticated", 
        expiryDate: result.expiryDate || Date.now() + 3600000,
        output: "✅ Successfully connected to Google! You can now proceed with your request."
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      console.log("❌ Authentication failed:", errorMessage);
      
      return {
        accessToken: "failed",
        refreshToken: "failed",
        expiryDate: 0,
        output: `❌ Authentication failed: ${errorMessage}. Please try again.`
      };
    }
  }
});
