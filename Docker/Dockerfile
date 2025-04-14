FROM node:20

WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of your application code
COPY . .

# Expose port 8080 (the port Cloud Run expects)
EXPOSE 8080

# Start your application
CMD ["npm", "start"]