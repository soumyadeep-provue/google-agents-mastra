import { google } from "googleapis";
import dotenv from "dotenv";
dotenv.config();

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
    scope: ["https://www.googleapis.com/auth/gmail.modify"]
  });
}

export async function getTokens(code: string) {
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export function setupGmailClient() {
  const tokens = tokenStorage.getTokens();
  if (tokens) {
    oauth2Client.setCredentials(tokens);
    return google.gmail({ version: "v1", auth: oauth2Client });
  }
  return null;
}
