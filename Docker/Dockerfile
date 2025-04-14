FROM node:20

WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy application source code
COPY . .

# Expose port 8080 (Cloud Run expects this port)
EXPOSE 8080

# Start the application
CMD ["npm", "start"]