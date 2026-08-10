import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  // `output: "standalone"` é necessário para o Docker (ver Dockerfile, que
  // copia `.next/standalone` e roda `server.js`). No Vercel, porém, o standalone
  // quebra o deploy: o build espera `.next/next-server.js.nft.json` na raiz de
  // `.next/`, que não existe quando standalone está ativo. O Vercel define
  // `VERCEL=1`; nesse caso desativamos o standalone e o Vercel faz o deploy
  // otimizado padrão.
  output: process.env.VERCEL === "1" ? undefined : "standalone",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;