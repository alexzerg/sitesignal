FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
ARG VITE_API_URL=https://sitesignal-backend-bk2663eh3a-uc.a.run.app
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

FROM node:22-alpine
WORKDIR /app
RUN npm install --global serve@14.2.4
COPY --from=build /app/dist ./dist
ENV PORT=8080
EXPOSE 8080
CMD ["serve", "-s", "dist", "-l", "8080"]
