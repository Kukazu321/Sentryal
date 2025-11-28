FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json ./
COPY prisma ./prisma/

# Install ALL dependencies (need devDeps for build)
RUN npm install

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --production

# Expose port (Railway injects PORT env var)
EXPOSE 3001

# Start server with npm for better error handling
CMD ["npm", "run", "start:prod"]
