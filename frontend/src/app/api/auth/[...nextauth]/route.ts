import NextAuth from "next-auth";
import OktaProvider from "next-auth/providers/okta";

const handler = NextAuth({
  providers: [
    OktaProvider({
      clientId: process.env.OKTA_CLIENT_ID!,
      clientSecret: process.env.OKTA_CLIENT_SECRET!,
      // CRITICAL: Use ORG authorization server issuer for XAA compatibility
      // This ensures ID tokens have issuer = https://{domain} (not /oauth2/{custom})
      issuer: `https://${process.env.OKTA_DOMAIN}`,
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
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
});

export { handler as GET, handler as POST };
