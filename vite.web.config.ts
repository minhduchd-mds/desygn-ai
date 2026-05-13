import { defineConfig, loadEnv, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";

const apiRoutes: Record<string, string> = {
  "/api/analyze-image": "../api/analyze-image.ts",
  "/api/bootstrap-context": "../api/bootstrap-context.ts",
  "/api/chat": "../api/chat.ts",
  "/api/generate-screens": "../api/generate-screens.ts",
};

function readJsonBody(request: { on: (event: string, callback: (chunk?: Buffer) => void) => void }): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => {
      if (chunk) chunks.push(Buffer.from(chunk));
    });
    request.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (!raw) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

async function runApiRoute(server: ViteDevServer, modulePath: string, request: Parameters<ViteDevServer["middlewares"]["use"]>[0], response: Parameters<ViteDevServer["middlewares"]["use"]>[1]) {
  const body = request.method === "OPTIONS" ? undefined : await readJsonBody(request);
  const module = await server.ssrLoadModule(modulePath) as { default: (request: unknown, response: unknown) => Promise<void> };
  let statusCode = 200;

  const responseShim = {
    setHeader: (name: string, value: string) => {
      response.setHeader(name, value);
    },
    status: (code: number) => {
      statusCode = code;
      response.statusCode = code;
      return responseShim;
    },
    json: (payload: unknown) => {
      response.statusCode = statusCode;
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.end(JSON.stringify(payload));
    },
    end: () => {
      response.statusCode = statusCode;
      response.end();
    },
  };

  await module.default({ method: request.method, body }, responseShim);
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  Object.entries(env).forEach(([key, value]) => {
    process.env[key] = process.env[key] ?? value;
  });

  return {
    plugins: [
      react(),
      {
        name: "local-api-routes",
        configureServer(server) {
          server.middlewares.use(async (request, response, next) => {
            const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
            const modulePath = apiRoutes[pathname];
            if (!modulePath) {
              next();
              return;
            }

            try {
              await runApiRoute(server, modulePath, request, response);
            } catch (error) {
              response.statusCode = 500;
              response.setHeader("Content-Type", "application/json; charset=utf-8");
              response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Local API route failed." }));
            }
          });
        },
      },
    ],
    root: "web",
    build: {
      outDir: "../dist-web",
      emptyOutDir: true,
      target: "es2020",
      chunkSizeWarningLimit: 700,
    },
    server: {
      host: "127.0.0.1",
      port: 5174,
    },
  };
});
