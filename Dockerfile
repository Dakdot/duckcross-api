FROM node:lts-alpine3.21

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