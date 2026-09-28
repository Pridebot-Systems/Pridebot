const globals = require("globals");

module.exports = [
  {
    ignores: ["node_modules/**", "Web/assets/bootstrap/**", "Web/assets/fonts/**"],
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "commonjs",
      globals: { ...globals.node, ...globals.es2023 },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-undef": "error",
      // The class of bug that took V1's boot down twice.
      "no-console": "off",
    },
  },
  {
    // Browser-side scripts served from Web/.
    files: ["Web/**/*.js"],
    languageOptions: {
      sourceType: "script",
      globals: { ...globals.browser },
    },
  },
];
