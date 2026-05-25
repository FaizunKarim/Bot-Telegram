# Gunakan OS Linux ringan dengan Node.js versi 22 (sesuai laptopmu)
FROM node:22-slim

# Install OpenSSL (Ini syarat WAJIB dari Prisma agar databasenya bisa jalan)
RUN apt-get update -y && apt-get install -y openssl

# Tentukan folder kerja di dalam server
WORKDIR /app

# Copy daftar dependency (package.json)
COPY package*.json ./

# Install semua paket npm
RUN npm install

# Copy seluruh sisa kodemu (index.js, prisma, dll) ke server
COPY . .

# Bangun mesin Prisma
RUN npx prisma generate

# Beritahu server bahwa kita pakai port 3000 (untuk dummy web server)
EXPOSE 3000

# Perintah gaspol untuk menyalakan bot
CMD ["npm", "start"]