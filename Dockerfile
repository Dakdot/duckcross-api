# Build stage
FROM node:lts-alpine3.21 AS build

WORKDIR /

COPY package*.json ./

RUN npm ci

# Copy the rest of the application code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:lts-alpine3.21 AS prod

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy local dist folder
COPY dist ./dist

# Copy Prisma files
COPY prisma ./prisma

# Expose the port your Express app runs on
EXPOSE 3000

# Generate Prisma
RUN npx prisma generate

# Start the application
CMD ["node", "dist/server.js"]