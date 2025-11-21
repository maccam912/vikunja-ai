FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM denoland/deno:alpine
WORKDIR /app/backend

# Install Node.js and npm (for npx)
RUN apk add --no-cache nodejs npm

# Copy Deno files
COPY deno.json deno.lock ./
COPY backend/ ./

# Copy built frontend assets
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Cache Deno dependencies
RUN deno cache main.ts

EXPOSE 8000

CMD ["run", "--allow-net", "--allow-read", "--allow-env", "--allow-run", "main.ts"]
