FROM node:20-alpine AS builder

WORKDIR /app

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

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000

COPY --from=builder /app/server ./server
COPY --from=builder /app/client/dist ./client/dist

EXPOSE 5000

# Push schema automatically on startup so PostgreSQL tables are always created
CMD ["sh", "-c", "cd server && npx prisma db push --accept-data-loss && node src/app.js"]
