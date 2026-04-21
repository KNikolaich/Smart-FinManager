# Use a lightweight Node.js image
FROM node:20-slim AS builder

# Install system dependencies for Prisma and other tools
RUN apt-get update -y && apt-get install -y \
    openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package manifest files
COPY package*.json ./

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

# Set environment to production
ENV NODE_ENV=production

# Expose the application port
EXPOSE 3000

# Start command: run migrations and then start the server
# We use npx tsx to handle TypeScript files in the production container
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx server.ts"]
