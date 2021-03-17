export default {
  "extends": "airbnb-typescript",
  "parserOptions": {
    "project": "./tsconfig.json"
  },
  "rules": {
    "no-multiple-empty-lines": ["error", {
      "max": 2
    }],
    "curly": ["error", "multi-line"],
    "no-console": "off",
    "no-plusplus": "off",
    "arrow-parens": "off",
    "lines-between-class-members": "off",
    "@typescript-eslint/lines-between-class-members": "off"
  }
}
