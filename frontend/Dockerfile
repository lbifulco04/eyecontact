FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

EXPOSE 5173

# Dev server con hot-reload; per la build di produzione usa un secondo stage con "npm run build"
# servito da nginx, se/quando ti serve un deploy statico.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
