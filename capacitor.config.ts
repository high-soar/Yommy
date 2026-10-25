import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.yommy.app",
  appName: "Yommy",
  webDir: "dist",
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    CapacitorSQLite: {
      androidIsEncryption: false,
      androidBiometric: {
        biometricAuth: false,
      },
    },
  },
};

export default config;
