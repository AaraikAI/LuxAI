FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/backend/package*.json ./packages/backend/
COPY packages/shared/package*.json ./packages/shared/

# Install dependencies
RUN npm install

# Copy source code
COPY packages/backend ./packages/backend
COPY packages/shared ./packages/shared

# Build shared package
RUN npm run build --workspace=@luxai/shared

EXPOSE 3000

CMD ["npm", "run", "dev", "--workspace=@luxai/backend"]
