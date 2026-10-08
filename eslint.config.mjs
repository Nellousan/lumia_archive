import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

/**
 * Flat ESLint config.
 * `eslint-config-next/core-web-vitals` already bundles the base Next.js rules,
 * the TypeScript rules and the default global ignores.
 */
const eslintConfig = [
  ...nextCoreWebVitals,
  {
    ignores: [
      "_reference_figma/**",
      "public/**",
      ".npm-cache/**",
      "src/data/*.html",
    ],
  },
];

export default eslintConfig;
