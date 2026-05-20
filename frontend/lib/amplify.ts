import { Amplify } from 'aws-amplify';
import { cognitoUserPoolsTokenProvider } from 'aws-amplify/auth/cognito';
import AsyncStorage from '@react-native-async-storage/async-storage';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: process.env.EXPO_PUBLIC_COGNITO_USER_POOL_ID!,
      userPoolClientId: process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID!,
      loginWith: {
        email: true,
        oauth: {
          domain: process.env.EXPO_PUBLIC_COGNITO_DOMAIN!,
          scopes: ['email', 'openid', 'profile'],
          redirectSignIn: ['onsitemonday://'],
          redirectSignOut: ['onsitemonday://'],
          responseType: 'code',
        },
      },
    },
  },
});

// Use AsyncStorage for token persistence across app restarts.
// Without this, Amplify v6 on React Native cannot reliably store tokens
// and the USER_SRP_AUTH flow fails with a generic "unknown error".
cognitoUserPoolsTokenProvider.setKeyValueStorage(AsyncStorage);
