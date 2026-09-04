# Frontend dev server inside Docker — no local Node.js required.
# Dependencies are installed inside the image on build; node_modules lives in a
# named volume so the Linux binaries are never shadowed by the Windows host.
#
#   docker compose up --build frontend        # dev server on http://localhost:5173
#
# The backend (host machine or its own container) is reached via host.docker.internal
# by default; override with: VITE_API_TARGET=http://backend:8080

FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev"]
