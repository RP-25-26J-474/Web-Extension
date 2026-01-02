# Deployment Guide

## Production Deployment

### Prerequisites
- Node.js 18+ runtime environment
- MongoDB database (local or cloud)
- Domain name (optional)
- SSL certificate (recommended)

---

## Option 1: Traditional VPS Deployment

### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install MongoDB (or use MongoDB Atlas)
# See: https://docs.mongodb.com/manual/installation/

# Install PM2 for process management
sudo npm install -g pm2

# Install Nginx as reverse proxy
sudo apt install nginx
```

### 2. Application Setup

```bash
# Clone repository
git clone <your-repo-url>
cd sensecheck

# Install dependencies
npm run install-all

# Build frontend
cd client
npm run build

# Configure environment
cd ../server
cp .env.example .env
nano .env  # Edit with production values
```

### 3. Environment Configuration

**server/.env**
```env
PORT=5000
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/sensecheck
NODE_ENV=production
```

### 4. Start with PM2

```bash
cd server
pm2 start server.js --name sensecheck-api
pm2 startup  # Enable auto-restart on reboot
pm2 save
```

### 5. Nginx Configuration

```nginx
# /etc/nginx/sites-available/sensecheck
server {
    listen 80;
    server_name yourdomain.com;

    # Frontend (built files)
    location / {
        root /path/to/sensecheck/client/dist;
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/sensecheck /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 6. SSL with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## Option 2: Docker Deployment

### 1. Create Dockerfiles

**server/Dockerfile**
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 5000

CMD ["node", "server.js"]
```

**client/Dockerfile**
```dockerfile
FROM node:18-alpine as build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
```

**client/nginx.conf**
```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://server:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 2. Docker Compose

**docker-compose.yml** (root directory)
```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:6
    container_name: sensecheck-db
    restart: always
    volumes:
      - mongodb_data:/data/db
    environment:
      MONGO_INITDB_DATABASE: sensecheck
    ports:
      - "27017:27017"

  server:
    build: ./server
    container_name: sensecheck-api
    restart: always
    ports:
      - "5000:5000"
    environment:
      PORT: 5000
      MONGODB_URI: mongodb://mongodb:27017/sensecheck
      NODE_ENV: production
    depends_on:
      - mongodb
    volumes:
      - ./server/logs:/app/logs

  client:
    build: ./client
    container_name: sensecheck-frontend
    restart: always
    ports:
      - "80:80"
    depends_on:
      - server

volumes:
  mongodb_data:
```

### 3. Deploy with Docker

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

---

## Option 3: Cloud Platform Deployment

### Heroku

**server/Procfile**
```
web: node server.js
```

```bash
# Install Heroku CLI
# Create Heroku app
heroku create sensecheck-app

# Add MongoDB addon
heroku addons:create mongolab:sandbox

# Deploy
git push heroku main

# Set environment variables
heroku config:set NODE_ENV=production
```

### Vercel (Frontend)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy frontend
cd client
vercel --prod
```

**vercel.json**
```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "https://your-backend-url/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### Railway.app

1. Connect GitHub repository
2. Add MongoDB service
3. Deploy server and client as separate services
4. Configure environment variables in dashboard

### Render.com

1. Create Web Service from GitHub
2. Add MongoDB database
3. Configure build and start commands
4. Set environment variables

---

## MongoDB Atlas Setup

1. Create account at https://www.mongodb.com/cloud/atlas
2. Create a free cluster
3. Add database user
4. Whitelist IP addresses (or allow from anywhere for testing)
5. Get connection string
6. Update `MONGODB_URI` in server/.env

**Connection String Format:**
```
mongodb+srv://<username>:<password>@cluster.mongodb.net/sensecheck?retryWrites=true&w=majority
```

---

## Environment Variables

### Server (.env)

| Variable | Description | Example |
|----------|-------------|---------|
| PORT | Server port | 5000 |
| MONGODB_URI | MongoDB connection string | mongodb://localhost:27017/sensecheck |
| NODE_ENV | Environment | production |

### Client (.env)

| Variable | Description | Example |
|----------|-------------|---------|
| VITE_API_URL | Backend API URL | https://api.yourdomain.com/api |

---

## Post-Deployment Checklist

- [ ] Application accessible via URL
- [ ] API endpoints responding correctly
- [ ] Database connection working
- [ ] All modules functioning properly
- [ ] Logs being written correctly
- [ ] SSL certificate installed
- [ ] Error monitoring set up
- [ ] Backups configured
- [ ] Performance monitoring enabled

---

## Monitoring

### Application Logs

```bash
# PM2 logs
pm2 logs sensecheck-api

# Docker logs
docker-compose logs -f server

# Winston logs
tail -f server/logs/application-*.log
tail -f server/logs/error-*.log
```

### Database Monitoring

- MongoDB Atlas: Built-in monitoring dashboard
- Self-hosted: Use MongoDB Compass or mongostat

### Uptime Monitoring

Recommended services:
- UptimeRobot
- Pingdom
- StatusCake

---

## Backup Strategy

### Database Backups

```bash
# MongoDB dump
mongodump --uri="mongodb://localhost:27017/sensecheck" --out=/backups/$(date +%Y%m%d)

# Restore
mongorestore --uri="mongodb://localhost:27017/sensecheck" /backups/20240101
```

### Automated Backups

```bash
# Add to crontab
0 2 * * * /path/to/backup-script.sh
```

**backup-script.sh**
```bash
#!/bin/bash
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mongodump --uri="$MONGODB_URI" --out="$BACKUP_DIR/$DATE"
# Upload to S3 or other storage
find $BACKUP_DIR -type d -mtime +30 -exec rm -rf {} \;
```

---

## Scaling

### Horizontal Scaling

1. **Load Balancer:** Use Nginx or cloud load balancer
2. **Multiple Server Instances:** Run multiple PM2 instances or Docker containers
3. **Database:** MongoDB replica set or sharding

### Vertical Scaling

- Increase server resources (CPU, RAM)
- Optimize MongoDB queries and indexes
- Enable caching (Redis)

---

## Security Hardening

1. **Firewall Configuration**
```bash
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable
```

2. **MongoDB Security**
- Enable authentication
- Use strong passwords
- Restrict network access
- Regular updates

3. **Application Security**
- Keep dependencies updated
- Use environment variables for secrets
- Enable HTTPS only
- Implement rate limiting

---

## Troubleshooting

### Application Won't Start

```bash
# Check logs
pm2 logs sensecheck-api

# Check port availability
lsof -i :5000

# Check environment variables
pm2 env 0
```

### Database Connection Issues

```bash
# Test MongoDB connection
mongosh "mongodb://localhost:27017/sensecheck"

# Check server can reach MongoDB
telnet localhost 27017
```

### High Memory Usage

```bash
# Check PM2 stats
pm2 monit

# Restart application
pm2 restart sensecheck-api

# Clear logs
pm2 flush
```

---

## Rollback Strategy

```bash
# Rollback to previous version
git checkout <previous-commit>
npm run install-all
cd client && npm run build
pm2 restart sensecheck-api
```

---

## Support and Maintenance

- Regular dependency updates: `npm audit fix`
- Monitor error logs daily
- Database maintenance: regular backups and optimization
- Performance monitoring: response times and resource usage
- Security updates: keep OS and dependencies updated

