import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { ink: "#14201B", pitch: "#1F6B4A", gold: "#B98B2D", paper: "#F5F6F2", line: "#DADFD8", mute: "#5E6B64" },
      fontFamily: { display: ["var(--font-display)", "sans-serif"], body: ["var(--font-body)", "sans-serif"] },
    },
  },
  plugins: [],
};
export default config;
