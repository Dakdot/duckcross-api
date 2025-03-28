# Build stage
FROM node:lts-alpine3.21 AS build

# Set working directory
WORKDIR /

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application code
COPY . .

# Build TypeScript code
RUN npm run build

# Production stage
FROM node:lts-alpine3.21 AS prod

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built app from build stage
COPY --from=build /dist ./dist

# Copy Prisma files
COPY prisma ./prisma

# Expose the port your Express app runs on
EXPOSE 3000

# Generate Prisma
RUN npx prisma generate

# Start the application
CMD ["node", "dist/server.js"]