import { google } from "googleapis";
import dotenv from "dotenv";
import path from "path";

// Load .env from the project root - try multiple possible locations
const possibleEnvPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), './.env'),
  path.resolve('/Users/soumyadeepdas/Desktop/Provue/gmail-agent/gmail/.env')
];

let envLoaded = false;
for (const envPath of possibleEnvPaths) {
  try {
    const result = dotenv.config({ path: envPath });
    if (result.parsed) {
      console.log(`✅ Loaded .env from: ${envPath}`);
      envLoaded = true;
      break;
    }
  } catch (error) {
    console.log(`❌ Failed to load .env from: ${envPath}`);
  }
}

if (!envLoaded) {
  console.warn("⚠️ Could not load .env file from any location");
}

export const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URI // e.g. http://localhost:3000/callback
);

// Token storage using localStorage (for browser) or in-memory (for Node.js)
class TokenStorage {
  private tokens: any = null;

  setTokens(tokens: any) {
    this.tokens = tokens;
    // If in browser environment, also store in localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('gmail_tokens', JSON.stringify(tokens));
    }
  }

  getTokens() {
    // First check in-memory
    if (this.tokens) {
      return this.tokens;
    }
    
    // Then check localStorage if in browser
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = localStorage.getItem('gmail_tokens');
      if (stored) {
        this.tokens = JSON.parse(stored);
        return this.tokens;
      }
    }
    
    return null;
  }

  clearTokens() {
    this.tokens = null;
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('gmail_tokens');
    }
  }
}

export const tokenStorage = new TokenStorage();

export function getAuthUrl() {
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/documents",
      "https://www.googleapis.com/auth/spreadsheets"
    ]
  });
}

export async function getTokens(code: string) {
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export async function setupGoogleClients() {
  const tokens = tokenStorage.getTokens();
  if (!tokens) {
    return null;
  }

  // Set the tokens on the OAuth2 client
  oauth2Client.setCredentials(tokens);

  // Check if access token is expired or will expire soon (5 minutes buffer)
  const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
  const now = Date.now();
  const expiryTime = tokens.expiry_date || 0;

  if (expiryTime && (now >= expiryTime - bufferTime)) {
    console.log("Access token expired or expiring soon, refreshing...");
    
    try {
      // Refresh the access token using the refresh token
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      // Update stored tokens with new access token and expiry
      const updatedTokens = {
        ...tokens,
        access_token: credentials.access_token,
        expiry_date: credentials.expiry_date
      };
      
      // Save the updated tokens
      tokenStorage.setTokens(updatedTokens);
      oauth2Client.setCredentials(updatedTokens);
      
      console.log("✅ Access token refreshed successfully");
    } catch (error) {
      console.error("❌ Failed to refresh access token:", error);
      // Clear invalid tokens
      tokenStorage.clearTokens();
      return null;
    }
  }

  return {
    gmail: google.gmail({ version: "v1", auth: oauth2Client }),
    drive: google.drive({ version: "v3", auth: oauth2Client }),
    docs: google.docs({ version: "v1", auth: oauth2Client }),
    sheets: google.sheets({ version: "v4", auth: oauth2Client })
  };
}



// Keep backward compatibility for Gmail tools
export async function setupGmailClient() {
  const clients = await setupGoogleClients();
  return clients?.gmail || null;
}
