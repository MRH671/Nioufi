// Stockage local : le token de session va dans le trousseau sécurisé,
// le reste (nom, table en cours, clé invité) dans AsyncStorage.
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "nioufi_token";

export const store = {
  get: (k: string) => AsyncStorage.getItem(k).catch(() => null),
  set: (k: string, v: string) => AsyncStorage.setItem(k, v).catch(() => {}),
  del: (k: string) => AsyncStorage.removeItem(k).catch(() => {}),
};

export const tokenStore = {
  get: () => SecureStore.getItemAsync(TOKEN_KEY).catch(() => null),
  set: (v: string) => SecureStore.setItemAsync(TOKEN_KEY, v).catch(() => {}),
  del: () => SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {}),
};
