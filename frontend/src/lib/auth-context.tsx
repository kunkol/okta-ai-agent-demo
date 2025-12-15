'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { OktaAuth, AuthState, TokenParams } from '@okta/okta-auth-js';
import { oktaConfig } from './okta-config';

// Types
interface User {
  sub: string;
  email?: string;
  name?: string;
  preferred_username?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  accessToken: string | null;
  idToken: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Initialize OktaAuth instance
let oktaAuth: OktaAuth | null = null;

const getOktaAuth = (): OktaAuth => {
  if (typeof window === 'undefined') {
    throw new Error('OktaAuth can only be used in browser');
  }
  
  if (!oktaAuth) {
    oktaAuth = new OktaAuth({
      clientId: oktaConfig.clientId,
      issuer: oktaConfig.issuer,
      redirectUri: oktaConfig.redirectUri,
      postLogoutRedirectUri: oktaConfig.postLogoutRedirectUri,
      scopes: oktaConfig.scopes,
      pkce: oktaConfig.pkce,
      tokenManager: {
        storage: 'localStorage',
      },
    });
  }
  
  return oktaAuth;
};

// Provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);

  // Check authentication status
  const checkAuth = useCallback(async () => {
    if (typeof window === 'undefined') return;
    
    try {
      const auth = getOktaAuth();
      const isAuth = await auth.isAuthenticated();
      setIsAuthenticated(isAuth);

      if (isAuth) {
        const tokens = await auth.tokenManager.getTokens();
        
        if (tokens.accessToken) {
          setAccessToken(tokens.accessToken.accessToken);
        }
        
        if (tokens.idToken) {
          setIdToken(tokens.idToken.idToken);
          // Extract user info from ID token claims
          const claims = tokens.idToken.claims;
          setUser({
            sub: claims.sub,
            email: claims.email as string | undefined,
            name: claims.name as string | undefined,
            preferred_username: claims.preferred_username as string | undefined,
          });
        }
      } else {
        setUser(null);
        setAccessToken(null);
        setIdToken(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Login function
  const login = async () => {
    try {
      const auth = getOktaAuth();
      await auth.signInWithRedirect();
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  // Logout function
  const logout = async () => {
    try {
      const auth = getOktaAuth();
      await auth.signOut();
      setIsAuthenticated(false);
      setUser(null);
      setAccessToken(null);
      setIdToken(null);
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  };

  // Get fresh access token
  const getAccessToken = async (): Promise<string | null> => {
    try {
      const auth = getOktaAuth();
      const tokens = await auth.tokenManager.getTokens();
      return tokens.accessToken?.accessToken || null;
    } catch (error) {
      console.error('Failed to get access token:', error);
      return null;
    }
  };

  const value: AuthContextType = {
    isAuthenticated,
    isLoading,
    user,
    accessToken,
    idToken,
    login,
    logout,
    getAccessToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use auth context
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Export OktaAuth getter for callback handling
export { getOktaAuth };
