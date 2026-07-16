import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        felt: { light: "#2c6b3f", DEFAULT: "#1c4a2b", dark: "#123420" },
        gold: { light: "#eed780", DEFAULT: "#e8c96a", dark: "#caa32f" },
        wood: "#3d2417",
      },
      fontFamily: { display: ["Georgia", "serif"] },
    },
  },
  plugins: [],
};
export default config;
