FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM denoland/deno:alpine
WORKDIR /app

# Copy Deno files
COPY deno.json deno.lock main.ts ./
COPY src ./src

# Copy built frontend assets
COPY --from=frontend-builder /app/frontend/dist ./dist

# Cache Deno dependencies
RUN deno cache main.ts

EXPOSE 8000

CMD ["run", "--allow-net", "--allow-read", "--allow-env", "main.ts"]
