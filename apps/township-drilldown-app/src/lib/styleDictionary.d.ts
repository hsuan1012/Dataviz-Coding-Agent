// styleDictionary.js（方向 A 雙主題）為純 JS，補最小型別宣告讓 tsc 可解析。
// 各主題 token 以寬鬆 any 導出（useTokens 以 any context 消費）。
declare const styleDictionary: any;
export const themes: { light: any; dark: any };
export const typography: any;
export const components: any;
export default styleDictionary;
