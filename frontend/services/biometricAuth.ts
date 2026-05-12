import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const KEY_EMAIL    = 'om_bio_email';
const KEY_PASSWORD = 'om_bio_password';
const KEY_ENABLED  = 'om_bio_enabled';

export async function isBiometricAvailable(): Promise<boolean> {
  const [hasHardware, isEnrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hasHardware && isEnrolled;
}

export async function isBiometricEnabled(): Promise<boolean> {
  const flag = await SecureStore.getItemAsync(KEY_ENABLED);
  return flag === 'true';
}

export async function getBiometricLabel(): Promise<string> {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'Face ID';
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'Touch ID';
  return 'Biometrics';
}

export async function saveCredentials(email: string, password: string): Promise<void> {
  await SecureStore.setItemAsync(KEY_EMAIL, email);
  await SecureStore.setItemAsync(KEY_PASSWORD, password);
  await SecureStore.setItemAsync(KEY_ENABLED, 'true');
}

export async function getCredentials(): Promise<{ email: string; password: string } | null> {
  const [email, password] = await Promise.all([
    SecureStore.getItemAsync(KEY_EMAIL),
    SecureStore.getItemAsync(KEY_PASSWORD),
  ]);
  if (email && password) return { email, password };
  return null;
}

export async function clearCredentials(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEY_EMAIL),
    SecureStore.deleteItemAsync(KEY_PASSWORD),
    SecureStore.deleteItemAsync(KEY_ENABLED),
  ]);
}

export async function promptBiometric(label: string): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: `Sign in with ${label}`,
    cancelLabel: 'Use password instead',
    disableDeviceFallback: false,
  });
  return result.success;
}
