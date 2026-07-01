import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import perfectionist from "eslint-plugin-perfectionist";

const customObjectPropsGroups = [
  {
    groupName: "react-special",
    selector: "property",
    elementNamePattern: "^(?:key|ref)$"
  },
  {
    groupName: "base-prop",
    selector: "property",
    elementNamePattern: "^(?:id|className|source|user|activeTrackID|pageActionType)$"
  },
  {
    groupName: "manager",
    selector: "property",
    elementNamePattern: ".+Manager$"
  },
  {
    groupName: "can-callback",
    selector: "property",
    elementNamePattern: "^can[A-Z]"
  },
  {
    groupName: "add-callback",
    selector: "property",
    elementNamePattern: "^add[A-Z]"
  },
  {
    groupName: "open-callback",
    selector: "property",
    elementNamePattern: "^open[A-Z]"
  },
  {
    groupName: "set-callback",
    selector: "property",
    elementNamePattern: "^set[A-Z]"
  },
  {
    groupName: "on-callback",
    selector: "property",
    elementNamePattern: "^on[A-Z]"
  }
];
const customJSXPropsGroups = [
  {
    groupName: "key",
    elementNamePattern: "^key$"
  },
  {
    groupName: "ref",
    elementNamePattern: "^ref$"
  },
  {
    groupName: "id",
    elementNamePattern: "^id$"
  },
  {
    groupName: "className",
    elementNamePattern: "^className$"
  },
  {
    groupName: "style",
    elementNamePattern: "^style$"
  },
  {
    groupName: "callback",
    elementNamePattern: "^on[A-Z].+"
  }
];

export default defineConfig([
  globalIgnores(["**/dist/**", "**/dist-types/**", "**/node_modules/**", "./types/env.d.ts"]),
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { perfectionist },
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs["recommended-latest"],
      reactRefresh.configs.vite
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-unsafe-declaration-merging": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-unsafe-function-type": "off",
      // 导入导出
      "perfectionist/sort-imports": [
        "warn",
        {
          type: "line-length",
          order: "asc",
          fallbackSort: {
            type: "natural",
            order: "asc"
          },
          internalPattern: ["^@/.+", "^@mahiru/.+"],
          specialCharacters: "keep",
          newlinesBetween: 0,
          newlinesInside: 0,
          sortSideEffects: false,
          partitionByComment: true,
          groups: [
            "side-effect",
            "side-effect-style",
            "style",
            { newlinesBetween: 1 },
            // named import：内置 + 外部包
            ["named-builtin", "named-external"],
            // named import：内部包 alias
            "named-internal",
            // wildcard import：内置 + 外部包
            ["wildcard-builtin", "wildcard-external"],
            // wildcard import：内部包 alias
            "wildcard-internal",
            // default import：内置 + 外部包
            ["default-builtin", "default-external"],
            // default import：内部包 alias，比如 @/xxx、@mahiru/xxx
            "default-internal",
            // type-only import：内置 + 外部包
            ["type-builtin", "type-external"],
            // type-only import：内部包 alias
            "type-internal",
            { newlinesBetween: 1 },
            // 相对路径
            ["parent", "sibling", "index"],
            "unknown"
          ]
        }
      ],
      "perfectionist/sort-named-imports": [
        "warn",
        {
          type: "line-length",
          order: "asc",
          fallbackSort: {
            type: "natural",
            order: "asc"
          },
          specialCharacters: "keep"
        }
      ],
      "perfectionist/sort-named-exports": [
        "warn",
        {
          type: "line-length",
          order: "asc",
          fallbackSort: {
            type: "natural",
            order: "asc"
          },
          specialCharacters: "keep"
        }
      ],
      "perfectionist/sort-exports": [
        "warn",
        {
          type: "line-length",
          order: "asc",
          fallbackSort: {
            type: "natural",
            order: "asc"
          },
          specialCharacters: "keep"
        }
      ],
      // 类型
      "perfectionist/sort-interfaces": [
        "warn",
        {
          type: "line-length",
          order: "asc",
          fallbackSort: {
            type: "natural",
            order: "asc"
          },
          sortBy: "name",
          specialCharacters: "keep",
          partitionByComment: true,
          partitionByNewLine: false,
          newlinesBetween: 0,
          newlinesInside: 0,
          groups: [
            "react-special",
            "unknown",
            "manager",
            "can-callback",
            "add-callback",
            "open-callback",
            "set-callback",
            "on-callback"
          ],
          customGroups: customObjectPropsGroups
        }
      ],
      "perfectionist/sort-objects": [
        "warn",
        // 只排序对象解构：const { ... } = props
        {
          type: "line-length",
          order: "asc",
          fallbackSort: {
            type: "natural",
            order: "asc"
          },
          sortBy: "name",
          specialCharacters: "keep",
          partitionByComment: true,
          partitionByNewLine: false,
          newlinesBetween: 0,
          newlinesInside: 0,
          groups: [
            "react-special",
            "base-prop",
            "manager",
            "can-callback",
            "add-callback",
            "open-callback",
            "set-callback",
            "on-callback",
            "unknown"
          ],
          customGroups: customObjectPropsGroups,
          useConfigurationIf: {
            objectType: "destructured"
          }
        },
        // 普通对象字面量不排序，避免覆盖顺序、配置语义顺序被打乱
        {
          type: "unsorted",
          useConfigurationIf: {
            objectType: "non-destructured"
          }
        }
      ],
      "perfectionist/sort-object-types": [
        "warn",
        {
          type: "line-length",
          order: "asc",
          fallbackSort: {
            type: "natural",
            order: "asc"
          },
          specialCharacters: "keep",
          partitionByComment: true,
          partitionByNewLine: true
        }
      ],
      "perfectionist/sort-union-types": [
        "warn",
        {
          type: "line-length",
          order: "asc",
          fallbackSort: {
            type: "natural",
            order: "asc"
          },
          specialCharacters: "keep"
        }
      ],
      "perfectionist/sort-intersection-types": [
        "warn",
        {
          type: "line-length",
          order: "asc",
          fallbackSort: {
            type: "natural",
            order: "asc"
          },
          specialCharacters: "keep"
        }
      ],
      "perfectionist/sort-jsx-props": [
        "warn",
        {
          type: "line-length",
          order: "asc",
          fallbackSort: {
            type: "natural",
            order: "asc"
          },
          specialCharacters: "keep",
          groups: [
            "key",
            "ref",
            "id",
            "className",
            "style",
            "unknown",
            "callback",
            "multiline-prop",
            "shorthand-prop"
          ],
          customGroups: customJSXPropsGroups
        }
      ]
    }
  }
]);
