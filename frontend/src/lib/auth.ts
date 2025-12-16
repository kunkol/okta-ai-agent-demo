// lib/auth.ts

import { NextAuthOptions } from 'next-auth';
import OktaProvider from 'next-auth/providers/okta';

export const authOptions: NextAuthOptions = {
  providers: [
    OktaProvider({
      clientId: process.env.OKTA_CLIENT_ID!,
      clientSecret: process.env.OKTA_CLIENT_SECRET!,
      issuer: `https://${process.env.NEXT_PUBLIC_OKTA_DOMAIN}`,
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.idToken = account.id_token;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      session.idToken = token.idToken as string;
      return session;
    },
  },
  pages: {
    signIn: '/',
  },
};
