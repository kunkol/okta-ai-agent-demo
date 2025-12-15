// Okta Configuration for Apex Customer 360 Frontend
// Created in C4: Okta Security Config

export const oktaConfig = {
  // From C4 Step 1: Apex Customer 360 Frontend OAuth App
  clientId: process.env.NEXT_PUBLIC_OKTA_CLIENT_ID || '0oa8xatd11PBe622F0g7',
  
  // Your Okta tenant
  issuer: process.env.NEXT_PUBLIC_OKTA_ISSUER || 'https://qa-aiagentsproducttc1.trexcloud.com/oauth2/default',
  
  // Redirect URIs (must match what's configured in Okta)
  redirectUri: typeof window !== 'undefined' 
    ? `${window.location.origin}/callback`
    : 'http://localhost:3000/callback',
  
  postLogoutRedirectUri: typeof window !== 'undefined'
    ? window.location.origin
    : 'http://localhost:3000',
  
  // Scopes to request
  scopes: ['openid', 'profile', 'email'],
  
  // PKCE is required for SPA
  pkce: true,
};

// Helper to get Okta domain from issuer
export const getOktaDomain = () => {
  const issuer = oktaConfig.issuer;
  const url = new URL(issuer);
  return url.origin;
};
