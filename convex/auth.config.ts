export default {
  providers: [
    {
      // Clerk JWT template issuer URL
      // In development: https://working-deer-84.clerk.accounts.dev
      // Can also use process.env.CLERK_JWT_ISSUER_DOMAIN for different environments
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: 'convex',
    },
  ],
};
