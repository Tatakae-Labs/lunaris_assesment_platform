# Lunaris Production Deployment Guide

## 1. Production Architecture Topology
- **Reverse Proxy**: Nginx or Caddy with TLS 1.3 automated certificate provisioning (Let's Encrypt).
- **Backend API**: Python 3.12+ FastAPI running under Uvicorn with Gunicorn process manager (4 worker processes per CPU core).
- **Frontend SPA**: Static assets built with `npm run build` and served via Nginx/Caddy or Cloudflare Pages with immutable asset caching.
- **Relational Database**: Managed PostgreSQL 16+ with connection pooling (PgBouncer).
- **Storage**: Private S3 bucket or MinIO for encrypted proctoring evidence snapshots.

---

## 2. Docker Compose Deployment

A production-ready `docker-compose.yml` is provided in `infra/docker-compose.yml`:

```bash
# 1. Clone repository
git clone https://github.com/lunaris/lunaris.git
cd lunaris

# 2. Configure environment variables
cp .env.example .env
nano .env

# 3. Build and launch services
docker compose -f infra/docker-compose.yml up -d --build

# 4. Check service health
curl -f http://localhost:8000/health
```

---

## 3. Production Release Checklist
- [x] Secret key (`SECRET_KEY`) set to 64+ random cryptographic bytes.
- [x] Debug modes disabled (`DEBUG=False`).
- [x] HTTPS enforced via reverse proxy headers (`X-Forwarded-Proto: https`).
- [x] Database migrations executed (`alembic upgrade head`).
- [x] Automated backup cron schedule configured.
- [x] Platform superadmin account bootstrapped via secure CLI command.
