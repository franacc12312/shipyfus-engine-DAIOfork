FROM node:20-alpine

# Install pnpm
RUN npm install -g pnpm@10.26.0

WORKDIR /app

# Copy package files first for better caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/brand/package.json packages/brand/
COPY packages/research/package.json packages/research/
COPY packages/social/package.json packages/social/
COPY apps/backend/package.json apps/backend/
COPY apps/frontend/package.json apps/frontend/

RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/ packages/
COPY apps/backend/ apps/backend/
COPY apps/frontend/ apps/frontend/

# Build frontend static files
RUN pnpm --filter @daio/frontend build

EXPOSE 3001

# Use tsx to run TypeScript directly (packages use raw .ts exports)
CMD ["npx", "tsx", "apps/backend/src/index.ts"]
