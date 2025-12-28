import NextAuth from "next-auth";

// NextAuth configuration for Okta SSO with XAA support

const OKTA_DOMAIN = process.env.OKTA_DOMAIN!;
const OKTA_CLIENT_ID = process.env.OKTA_CLIENT_ID!;
const OKTA_CLIENT_SECRET = process.env.OKTA_CLIENT_SECRET!;

const authOptions = {
  providers: [
    {
      id: "okta",
      name: "Okta",
      type: "oidc" as const,
      clientId: OKTA_CLIENT_ID,
      clientSecret: OKTA_CLIENT_SECRET,
      // CRITICAL: Use ORG authorization server (not custom) for XAA compatibility
      // XAA token exchange requires ID tokens issued by the ORG auth server
      // Issuer will be: https://{domain} (NOT https://{domain}/oauth2/{customAuthServer})
      wellKnown: `https://${OKTA_DOMAIN}/.well-known/openid-configuration`,
      authorization: { params: { scope: "openid profile email" } },
      checks: ["pkce", "state"],
      profile(profile: any) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
        };
      },
    },
  ],
  callbacks: {
    async jwt({ token, account }: { token: any; account: any }) {
      // Persist the ID token from the initial sign in
      if (account) {
        token.idToken = account.id_token;
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      // Make ID token available to the client for XAA
      session.idToken = token.idToken;
      session.accessToken = token.accessToken;
      return session;
    },
  },
  debug: process.env.NODE_ENV === "development",
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
