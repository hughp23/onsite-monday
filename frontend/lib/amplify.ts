import { Amplify } from 'aws-amplify';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: process.env.EXPO_PUBLIC_COGNITO_USER_POOL_ID!,
      userPoolClientId: process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID!,
      loginWith: {
        oauth: {
          domain: process.env.EXPO_PUBLIC_COGNITO_DOMAIN!,
          scopes: ['email', 'openid', 'profile'],
          redirectSignIn: ['onsite-monday://auth/callback'],
          redirectSignOut: ['onsite-monday://'],
          responseType: 'code',
        },
      },
    },
  },
});
