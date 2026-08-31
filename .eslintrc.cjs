{
  "env": {
    "es2022": true,
    "node": true,
    "browser": true
  },
  "extends": ["eslint:recommended"],
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "module",
    "ecmaFeatures": {
      "jsx": true
    }
  },
  "ignorePatterns": ["node_modules", "dist", "client/dist"]
}
