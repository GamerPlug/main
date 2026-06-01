import type { Config } from "tailwindcss"

const config = {
    darkMode: ["class"],
    content: [
        './pages/**/*.{ts,tsx}',
        './components/**/*.{ts,tsx}',
        './app/**/*.{ts,tsx}',
        './src/**/*.{ts,tsx}',
    ],
    prefix: "",
    theme: {
        container: {
            center: true,
            padding: "2rem",
            screens: {
                "2xl": "1400px",
            },
        },
        extend: {
            colors: {
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
                // Network brand colors optimized for modern look
                mtn: {
                    DEFAULT: "#FACC15", // yellow-400
                    dark: "#EAB308", // yellow-500
                },
                telecel: {
                    DEFAULT: "#EF4444", // red-500
                    dark: "#DC2626", // red-600
                },
                airteltigo: {
                    DEFAULT: "#F97316", // orange-500
                    dark: "#EA580C", // orange-600
                },
                success: {
                    DEFAULT: "#10B981", // emerald-500
                    foreground: "#FFFFFF",
                },
                warning: {
                    DEFAULT: "#F59E0B", // amber-500
                    foreground: "#FFFFFF",
                },
            },
            backgroundImage: {
                'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
                'mesh-dark': 'radial-gradient(at 40% 20%, hsla(217,100%,60%,0.12) 0px, transparent 50%), radial-gradient(at 80% 0%, hsla(195,100%,55%,0.12) 0px, transparent 50%), radial-gradient(at 0% 50%, hsla(240,100%,60%,0.08) 0px, transparent 50%)',
                'mesh-light': 'radial-gradient(at 40% 20%, hsla(217,100%,60%,0.15) 0px, transparent 50%), radial-gradient(at 80% 0%, hsla(195,100%,55%,0.15) 0px, transparent 50%), radial-gradient(at 0% 50%, hsla(240,100%,60%,0.1) 0px, transparent 50%)',
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
                xl: "calc(var(--radius) + 4px)",
                "2xl": "calc(var(--radius) + 8px)",
                "3xl": "calc(var(--radius) + 12px)",
            },
            keyframes: {
                "accordion-down": {
                    from: { height: "0" },
                    to: { height: "var(--radix-accordion-content-height)" },
                },
                "accordion-up": {
                    from: { height: "var(--radix-accordion-content-height)" },
                    to: { height: "0" },
                },
                shimmer: {
                    "100%": { transform: "translateX(100%)" },
                },
                pulseGlow: {
                    "0%, 100%": { opacity: "1", transform: "scale(1)", filter: "brightness(1)" },
                    "50%": { opacity: ".85", transform: "scale(1.02)", filter: "brightness(1.1)" },
                },
                fadeIn: {
                    from: { opacity: "0", filter: "blur(10px)" },
                    to: { opacity: "1", filter: "blur(0)" },
                },
                slideInUp: {
                    from: { transform: "translateY(20px)", opacity: "0" },
                    to: { transform: "translateY(0)", opacity: "1" },
                },
                float: {
                    "0%, 100%": { transform: "translateY(0)" },
                    "50%": { transform: "translateY(-10px)" },
                },
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
                shimmer: "shimmer 2.5s infinite linear",
                pulseGlow: "pulseGlow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                fadeIn: "fadeIn 0.5s ease-out",
                slideInUp: "slideInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
                float: "float 6s ease-in-out infinite",
            },
        },
    },
    plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config
