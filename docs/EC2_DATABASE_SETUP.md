# EC2 Database Setup Guide

This guide provides automated scripts to set up PostgreSQL database on EC2 instances for the WhatsApp Business Server.

## 📋 Available Scripts

### 1. Complete Setup (Recommended)
**File**: `scripts/setup-database-ec2.sh`
- ✅ Installs PostgreSQL
- ✅ Creates database and user
- ✅ Configures authentication
- ✅ Runs all migrations
- ✅ Creates .env template

### 2. PostgreSQL Installation Only
**File**: `scripts/install-postgresql-only.sh`
- ✅ Installs PostgreSQL
- ✅ Creates database and user
- ✅ Basic configuration
- ❌ No migrations

### 3. Migrations Only
**File**: `scripts/run-migrations.sh`
- ❌ No PostgreSQL installation
- ✅ Runs all database migrations
- ✅ Verifies schema

## 🚀 Quick Start

### Option 1: Complete Setup (One Command)

```bash
# Download and run the complete setup script
sudo bash scripts/setup-database-ec2.sh
```

### Option 2: Step-by-Step Setup

```bash
# Step 1: Install PostgreSQL only
sudo bash scripts/install-postgresql-only.sh

# Step 2: Configure your .env file
cp .env.example .env
# Edit .env with your database credentials

# Step 3: Install Node.js dependencies
npm install

# Step 4: Run migrations
bash scripts/run-migrations.sh
```

## 📋 Prerequisites

### System Requirements
- EC2 instance with Ubuntu 20.04+, Amazon Linux 2, or CentOS 7+
- Root or sudo access
- At least 1GB RAM
- At least 10GB disk space

### Before Running Scripts
1. **Update your system**:
   ```bash
   sudo yum update -y  # Amazon Linux/CentOS
   # OR
   sudo apt update && sudo apt upgrade -y  # Ubuntu/Debian
   ```

2. **Install Git** (if not already installed):
   ```bash
   sudo yum install git -y  # Amazon Linux/CentOS
   # OR
   sudo apt install git -y  # Ubuntu/Debian
   ```

3. **Clone your project**:
   ```bash
   git clone <your-repo-url>
   cd whatsapp-server
   ```

## 🔧 Script Details

### Complete Setup Script (`setup-database-ec2.sh`)

**What it does:**
- Detects OS (Ubuntu, Debian, Amazon Linux, CentOS, RHEL)
- Updates system packages
- Installs PostgreSQL 15
- Configures PostgreSQL for local connections
- Creates database `whatsapp_business_server`
- Creates user `whatsapp_user` with password `WhatsApp@2025!`
- Enables UUID extension
- Configures firewall (if available)
- Runs database migrations
- Creates .env template

**Usage:**
```bash
sudo bash scripts/setup-database-ec2.sh
```

### PostgreSQL Only Script (`install-postgresql-only.sh`)

**What it does:**
- Installs PostgreSQL 15
- Creates database and user
- Basic configuration only
- No migrations or application setup

**Usage:**
```bash
sudo bash scripts/install-postgresql-only.sh
```

**Default Credentials:**
- Database: `whatsapp_business_server`
- Username: `whatsapp_user`
- Password: `WhatsApp@2025!`

### Migration Script (`run-migrations.sh`)

**What it does:**
- Checks for .env file
- Verifies Node.js installation
- Installs npm dependencies
- Tests database connection
- Runs database initialization
- Runs asset generation migration
- Runs WhatsApp sync migration
- Verifies schema

**Usage:**
```bash
bash scripts/run-migrations.sh
```

## 🔐 Security Configuration

### Default Database Credentials
```
Host: localhost
Port: 5432
Database: whatsapp_business_server
Username: whatsapp_user
Password: WhatsApp@2025!
```

### Changing Default Password
```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Change password
ALTER USER whatsapp_user WITH PASSWORD 'your_new_secure_password';
\q
```

### Production Security Checklist
- [ ] Change default database password
- [ ] Configure SSL/TLS for database connections
- [ ] Restrict PostgreSQL access to specific IPs
- [ ] Set up regular database backups
- [ ] Configure firewall rules
- [ ] Use environment variables for sensitive data

## 🌍 Environment Variables

After running the setup, update your `.env` file:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=whatsapp_business_server
DB_USER=whatsapp_user
DB_PASSWORD=WhatsApp@2025!

# Server Configuration
PORT=3000
NODE_ENV=production

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# Default Super Admin
DEFAULT_SUPER_ADMIN_EMAIL=superadmin@example.com
DEFAULT_SUPER_ADMIN_PASSWORD=SuperAdmin123!
```

## 🔍 Troubleshooting

### Common Issues

#### 1. Permission Denied
```bash
# Make scripts executable
chmod +x scripts/*.sh
```

#### 2. PostgreSQL Service Not Starting
```bash
# Check service status
sudo systemctl status postgresql

# Start service manually
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### 3. Database Connection Failed
```bash
# Check PostgreSQL is listening
sudo netstat -tlnp | grep 5432

# Check authentication configuration
sudo cat /etc/postgresql/15/main/pg_hba.conf
```

#### 4. Migration Errors
```bash
# Check database exists
sudo -u postgres psql -l

# Check user permissions
sudo -u postgres psql -c "\du"
```

### Log Files
- PostgreSQL logs: `/var/log/postgresql/`
- System logs: `journalctl -u postgresql`

## 📊 Verification

### Check Database Setup
```bash
# Test connection
PGPASSWORD=WhatsApp@2025! psql -h localhost -U whatsapp_user -d whatsapp_business_server -c "SELECT version();"

# List tables
PGPASSWORD=WhatsApp@2025! psql -h localhost -U whatsapp_user -d whatsapp_business_server -c "\dt"
```

### Check Application
```bash
# Start the server
npm start

# Check API documentation
curl http://localhost:3000/api
```

## 🔄 Backup and Restore

### Create Backup
```bash
# Full database backup
pg_dump -h localhost -U whatsapp_user -d whatsapp_business_server > backup.sql

# Compressed backup
pg_dump -h localhost -U whatsapp_user -d whatsapp_business_server | gzip > backup.sql.gz
```

### Restore Backup
```bash
# Restore from backup
psql -h localhost -U whatsapp_user -d whatsapp_business_server < backup.sql

# Restore from compressed backup
gunzip -c backup.sql.gz | psql -h localhost -U whatsapp_user -d whatsapp_business_server
```

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review log files for error messages
3. Ensure all prerequisites are met
4. Verify network connectivity and firewall settings

## 🎯 Next Steps

After successful database setup:

1. **Start the server**: `npm start`
2. **Access API docs**: `http://your-ec2-ip:3000/api`
3. **Login as super admin**: Use default credentials
4. **Configure organization**: Set up your WhatsApp Business API
5. **Create templates**: Add your message templates
6. **Set up campaigns**: Create and schedule campaigns
