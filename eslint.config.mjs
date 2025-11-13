import { defineConfig } from "eslint/config";
import _import from "eslint-plugin-import";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import { fixupPluginRules } from "@eslint/compat";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default defineConfig([
  {
    extends: compat.extends("eslint:recommended"),

    plugins: {
      import: fixupPluginRules(_import),
      "@typescript-eslint": typescriptEslint,
    },

    languageOptions: {
      globals: {
        ...globals.jest,
      },

      parser: tsParser,
      ecmaVersion: 5,
      sourceType: "script",

      parserOptions: {
        project: ["./tsconfig.json"],
      },
    },

    settings: {
      "import/parsers": {
        "@typescript-eslint/parser": [".ts", ".tsx"],
      },

      "import/resolver": {
        typescript: {},
      },
    },

    rules: {
      "comma-dangle": 0,
      "no-underscore-dangle": 0,
      "no-param-reassign": 0,
      "no-return-assign": 0,
      camelcase: 0,
      "import/extensions": 0,
      "@typescript-eslint/no-redeclare": 0,
      "@typescript-eslint/quotes": "off",
    },
  },
]);
