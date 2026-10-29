import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "storybook-static",
      "coverage",
      "node_modules",
      "test-results",
      "playwright-report",
      ".github",
      "reference",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        {
          allowConstantExport: true,
          allowExportNames: [
            "ServiceContext",
            "useServices",
            "persistDatabaseBinary",
            "loadPersistedDatabaseBinary",
            "getStoredDatabaseBinary",
            "createDefaultMockHttpClient",
            "createDefaultNativeSqliteAdapter",
            "DB_STORAGE_KEY",
            "RouterContext",
            "useRouter",
            "matchRoute",
            "safeDecodeURIComponent",
            "resolveInitialPath",
            "getActiveTab",
          ],
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
