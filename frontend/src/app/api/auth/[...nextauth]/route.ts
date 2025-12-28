import NextAuth from "next-auth";
import type { NextAuthOptions } from "next-auth";

export const authOptions: NextAuthOptions = {
  providers: [
    {
      id: "okta",
      name: "Okta",
      type: "oauth",
      wellKnown: `https://${process.env.OKTA_DOMAIN}/oauth2/default/.well-known/openid-configuration`,
      clientId: process.env.OKTA_CLIENT_ID,
      clientSecret: process.env.OKTA_CLIENT_SECRET,
      authorization: { 
        params: { 
          scope: "openid profile email",
          response_type: "code"
        } 
      },
      idToken: true,
      checks: ["pkce", "state"],
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
        };
      },
    },
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      // Persist the ID token and access token in the JWT
      if (account) {
        token.idToken = account.id_token;
        token.accessToken = account.access_token;
        token.sub = profile?.sub;
      }
      return token;
    },
    async session({ session, token }) {
      // Send ID token to the client
      session.idToken = token.idToken as string;
      session.accessToken = token.accessToken as string;
      if (session.user) {
        session.user.id = token.sub as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
  debug: process.env.NODE_ENV === "development",
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
