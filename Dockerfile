# Use a lightweight Node.js image
FROM node:20-slim AS builder

# Install system dependencies for Prisma and other tools
RUN apt-get update -y && apt-get install -y \
    openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package manifest files
COPY package*.json ./

# Prisma's postinstall hook generates the client, so the schema must exist
# before dependencies are installed.
COPY prisma ./prisma

# Install ALL dependencies (including devDependencies for build)
RUN npm install

# Copy the rest of the application code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build the frontend assets
RUN npm run build

# --- Runtime Stage ---
FROM node:20-slim AS runner

# Install system dependencies for Prisma
RUN apt-get update -y && apt-get install -y \
    openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built assets and necessary files from the builder stage
# In full-stack mode, the server handles everything
COPY --from=builder /app /app

# Drop root privileges for the application and migration process.
RUN groupadd --system app && useradd --system --gid app --create-home app \
    && chown -R app:app /app
USER app

# Set environment to production
ENV NODE_ENV=production

# Expose the application port
EXPOSE 3000

# Start command: run migrations and then start the server
# We use npx tsx to handle TypeScript files in the production container
# Databases created before the migrations directory existed (schema applied
# via `prisma db push`) fail `migrate deploy` with P3005 (non-empty schema).
# In that case we baseline them by marking 0_init as applied (it matches the
# pre-migrations schema exactly) and re-run deploy so newer migrations apply.
# Any other migration failure, or a failed retry, stops the container.
CMD ["sh", "-ec", "if output=$(npx prisma migrate deploy 2>&1); then printf '%s\\n' \"$output\"; else status=$?; printf '%s\\n' \"$output\" >&2; if printf '%s' \"$output\" | grep -q 'P3005'; then npx prisma migrate resolve --applied 0_init; npx prisma migrate deploy; else exit \"$status\"; fi; fi; exec npx tsx server.ts"]
