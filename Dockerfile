FROM node:20-slim AS builder

WORKDIR /app

# Install OpenSSL and CA certificates required by Prisma
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Install client dependencies and build
COPY client/package*.json ./client/
RUN cd client && npm install

COPY client/ ./client/
RUN cd client && npm run build

# Install server dependencies
COPY server/package*.json ./server/
COPY server/prisma ./server/prisma/
RUN cd server && npm install
RUN cd server && npx prisma generate

COPY server/ ./server/

FROM node:20-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000

# Install OpenSSL and CA certificates required by Prisma and HTTPS requests on Debian
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/server ./server
COPY --from=builder /app/client/dist ./client/dist

EXPOSE 5000

# Start server (app.js handles fast-boot schema verification and serving)
CMD ["sh", "-c", "cd server && node src/app.js"]
