# Lunaris Backup, Disaster Recovery & High Availability

## 1. Relational Database Backup Strategy
- **Continuous Archiving**: PostgreSQL Write-Ahead Logging (WAL) archiving to off-site object storage enables Point-in-Time Recovery (PITR) up to the second of failure.
- **Daily Full Logical Dumps**: Automated `pg_dump` snapshot executed every 24 hours at 02:00 UTC, encrypted with AES-256 and stored across two separate geographical cloud regions.

### Automated Backup Script Example
```bash
#!/bin/bash
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/var/backups/lunaris"
FILENAME="lunaris_db_${TIMESTAMP}.sql.gz"

pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME | gzip > "${BACKUP_DIR}/${FILENAME}"

# Transfer to encrypted S3 cold storage
aws s3 cp "${BACKUP_DIR}/${FILENAME}" s3://lunaris-backups-vault/postgres/
```

---

## 2. Evidence Storage Backups
- Proctor incident snapshots stored in private object storage utilize automated S3 Lifecycle policies:
  - Transition to Infrequent Access (IA) after 30 days.
  - Automatic cryptographic deletion after institutional retention period (e.g., 90 days).

---

## 3. Disaster Recovery Drills (RPO & RTO Targets)
- **Recovery Point Objective (RPO)**: < 5 minutes (via streaming WAL replication).
- **Recovery Time Objective (RTO)**: < 15 minutes for complete failover to standby replica.
