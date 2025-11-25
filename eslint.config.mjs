import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import unusedImports from 'eslint-plugin-unused-imports'

const tsconfigRootDir = new URL('.', import.meta.url).pathname

export default [
  {
    ignores: ['temp/**']
  },
  {
    files: ['backend/**/*.ts', 'frontend/**/*.ts', 'cli/**/*.ts', 'cli/**/*.tsx'],
    ignores: ['node_modules/**', 'dist/**', 'dist-frontend/**', 'dist-frontend-ts/**'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: ['./backend/tsconfig.json', './frontend/tsconfig.json', './cli/tsconfig.json'],
        tsconfigRootDir
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'unused-imports': unusedImports
    },
    rules: {
      semi: ['error', 'never'],
      quotes: ['error', 'single'],
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      'unused-imports/no-unused-imports': 'error'
    }
  }
]
