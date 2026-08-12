// Flat ESLint config. ESLint 9+ uses this file by default; ESLint 8 with
// `ESLINT_USE_FLAT_CONFIG=true` does too. We pin ESLint 8 for now; the lint
// script sets the flag so `eslint .` works without a config file path.
import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import prettier from "eslint-config-prettier";

export default [
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      parser: tsparser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
      globals: {
        // vitest globals
        describe: "readonly",
        it: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
      },
    },
    plugins: { "@typescript-eslint": tseslint },
    rules: {
      ...tseslint.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  {
    files: ["scripts/**/*.{ts,mjs}"],
    languageOptions: {
      parser: tsparser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
      },
    },
    plugins: { "@typescript-eslint": tseslint },
    rules: {
      ...tseslint.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["src/lib/net/**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
      globals: {
        fetch: "readonly",
      },
    },
    plugins: { "@typescript-eslint": tseslint },
    rules: {
      ...tseslint.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["**/*.web.{ts,tsx}"],
    languageOptions: {
      parser: tsparser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
      globals: {
        HTMLDivElement: "readonly",
        navigator: "readonly",
      },
    },
    plugins: { "@typescript-eslint": tseslint },
    rules: {
      ...tseslint.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["api/**/*.ts"],
    languageOptions: {
      sourceType: "module",
      globals: {
        Request: "readonly",
        Response: "readonly",
        fetch: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["metro.config.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        require: "readonly",
        module: "readonly",
        __dirname: "readonly",
        process: "readonly",
        console: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-var-requires": "off",
    },
  },
  {
    ignores: [
      "node_modules/",
      "dist/",
      ".expo/",
      "coverage/",
      // vendored copies of maplibre-gl's worker files (scripts/copy-maplibre-worker.mjs)
      "public/maplibre-gl-worker.mjs",
      "public/maplibre-gl-shared.mjs",
    ],
  },
  prettier,
];
