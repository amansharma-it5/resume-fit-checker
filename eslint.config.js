import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "coverage", "playwright-report", "test-results", "node_modules"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: { globals: { document: "readonly", window: "readonly", navigator: "readonly", crypto: "readonly", indexedDB: "readonly", localStorage: "readonly" } },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/purity": "off",
      "react-refresh/only-export-components": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["*.js", "*.mjs", "netlify/**/*.mjs", "scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        process: "readonly", Buffer: "readonly", fetch: "readonly", AbortController: "readonly", Response: "readonly",
        setTimeout: "readonly", clearTimeout: "readonly", TextEncoder: "readonly", crypto: "readonly", console: "readonly",
      },
    },
    rules: { "no-control-regex": "off" },
  },
);
