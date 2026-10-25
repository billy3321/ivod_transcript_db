import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

export default [
  ...nextCoreWebVitals,
  {
    // 對齊舊版 next lint 的檢查範圍：測試與工具腳本不納入
    ignores: [
      '.next/**', 'coverage/**', 'node_modules/**', 'public/**',
      '__tests__/**', 'cypress/**', 'scripts/**', 'jest.setup.ts',
    ],
  },
  {
    // react-hooks v7 新增的規則，既有寫法待之後重構，先列為警告
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
];
