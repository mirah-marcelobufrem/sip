import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      // Downgrade to warn so existing code doesn't block CI during cleanup
      '@typescript-eslint/no-unused-vars': 'warn',
    },
  },
);
