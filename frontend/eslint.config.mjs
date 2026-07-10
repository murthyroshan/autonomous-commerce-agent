import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // The experimental React Compiler hook rules (eslint-plugin-react-hooks v6)
    // fire on intentional, correct patterns in this codebase and would require
    // risky rewrites of working animation/hydration code to satisfy:
    //   - set-state-in-effect: SSR mount guards (useEffect(() => setMounted(true), []))
    //   - refs:                the React-endorsed "adjust state during render via a
    //                          ref" pattern (Navbar ScrambleText)
    //   - purity:              a timestamp read during render (share page)
    //   - immutability:        mutating a Three.js geometry inside useFrame (required)
    // Keep them as warnings so they still surface without blocking `next build`.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
    },
  },
]);

export default eslintConfig;
