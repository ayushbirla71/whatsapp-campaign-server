#!/bin/bash

# WhatsApp Business Server - PostgreSQL Database Setup Script for EC2
# This script installs PostgreSQL, creates database, user, and runs migrations
#
# Usage:
#   chmod +x scripts/setup-database-ec2.sh
#   sudo bash scripts/setup-database-ec2.sh
#
# Supported OS: Ubuntu 20.04+, Amazon Linux 2, CentOS 7+, Debian 10+

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration variables
DB_NAME="whatsapp_business_server"
DB_USER="whatsapp_user"
DB_PASSWORD="WhatsApp@2025!"
POSTGRES_VERSION="15"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

# Function to detect OS
detect_os() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$NAME
        VERSION=$VERSION_ID
    else
        print_error "Cannot detect OS version"
        exit 1
    fi
    
    print_status "Detected OS: $OS $VERSION"
}

# Function to update system packages
update_system() {
    print_status "Updating system packages..."
    
    if [[ "$OS" == *"Ubuntu"* ]] || [[ "$OS" == *"Debian"* ]]; then
        apt-get update -y
        apt-get upgrade -y
    elif [[ "$OS" == *"Amazon Linux"* ]] || [[ "$OS" == *"CentOS"* ]] || [[ "$OS" == *"Red Hat"* ]]; then
        yum update -y
    else
        print_error "Unsupported operating system: $OS"
        exit 1
    fi
    
    print_success "System packages updated"
}

# Function to install PostgreSQL
install_postgresql() {
    print_status "Installing PostgreSQL $POSTGRES_VERSION..."
    
    if [[ "$OS" == *"Ubuntu"* ]] || [[ "$OS" == *"Debian"* ]]; then
        # Install PostgreSQL on Ubuntu/Debian
        apt-get install -y wget ca-certificates
        
        # Add PostgreSQL official APT repository
        wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
        echo "deb http://apt.postgresql.org/pub/repos/apt/ $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
        
        apt-get update -y
        apt-get install -y postgresql-$POSTGRES_VERSION postgresql-client-$POSTGRES_VERSION postgresql-contrib-$POSTGRES_VERSION
        
    elif [[ "$OS" == *"Amazon Linux"* ]]; then
        # Install PostgreSQL on Amazon Linux 2
        amazon-linux-extras install postgresql$POSTGRES_VERSION -y
        yum install -y postgresql-server postgresql-contrib
        
        # Initialize database
        /usr/bin/postgresql-setup --initdb
        
    elif [[ "$OS" == *"CentOS"* ]] || [[ "$OS" == *"Red Hat"* ]]; then
        # Install PostgreSQL on CentOS/RHEL
        yum install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-7-x86_64/pgdg-redhat-repo-latest.noarch.rpm
        yum install -y postgresql$POSTGRES_VERSION-server postgresql$POSTGRES_VERSION-contrib
        
        # Initialize database
        /usr/pgsql-$POSTGRES_VERSION/bin/postgresql-$POSTGRES_VERSION-setup initdb
    fi
    
    print_success "PostgreSQL installed successfully"
}

# Function to configure PostgreSQL
configure_postgresql() {
    print_status "Configuring PostgreSQL..."
    
    # Find PostgreSQL configuration directory
    if [[ "$OS" == *"Ubuntu"* ]] || [[ "$OS" == *"Debian"* ]]; then
        PG_CONFIG_DIR="/etc/postgresql/$POSTGRES_VERSION/main"
        PG_DATA_DIR="/var/lib/postgresql/$POSTGRES_VERSION/main"
    else
        PG_CONFIG_DIR="/var/lib/pgsql/$POSTGRES_VERSION/data"
        PG_DATA_DIR="/var/lib/pgsql/$POSTGRES_VERSION/data"
    fi
    
    # Start and enable PostgreSQL service
    if [[ "$OS" == *"Ubuntu"* ]] || [[ "$OS" == *"Debian"* ]]; then
        systemctl start postgresql
        systemctl enable postgresql
    else
        systemctl start postgresql-$POSTGRES_VERSION
        systemctl enable postgresql-$POSTGRES_VERSION
    fi
    
    # Configure PostgreSQL for local connections
    print_status "Configuring PostgreSQL authentication..."
    
    # Backup original pg_hba.conf
    cp $PG_CONFIG_DIR/pg_hba.conf $PG_CONFIG_DIR/pg_hba.conf.backup
    
    # Configure authentication
    cat > $PG_CONFIG_DIR/pg_hba.conf << EOF
# PostgreSQL Client Authentication Configuration File
# TYPE  DATABASE        USER            ADDRESS                 METHOD

# "local" is for Unix domain socket connections only
local   all             all                                     peer
# IPv4 local connections:
host    all             all             127.0.0.1/32            md5
host    all             all             0.0.0.0/0               md5
# IPv6 local connections:
host    all             all             ::1/128                 md5
EOF
    
    # Configure PostgreSQL to listen on all addresses
    sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" $PG_CONFIG_DIR/postgresql.conf
    
    # Restart PostgreSQL to apply changes
    systemctl restart postgresql || systemctl restart postgresql-$POSTGRES_VERSION
    
    print_success "PostgreSQL configured successfully"
}

# Function to create database and user
create_database() {
    print_status "Creating database and user..."
    
    # Create database user and database
    sudo -u postgres psql << EOF
-- Create user
CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';

-- Create database
CREATE DATABASE $DB_NAME OWNER $DB_USER;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;

-- Grant additional privileges for schema creation
ALTER USER $DB_USER CREATEDB;

-- Connect to the database and grant schema privileges
\c $DB_NAME

-- Grant privileges on public schema
GRANT ALL ON SCHEMA public TO $DB_USER;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\q
EOF
    
    print_success "Database '$DB_NAME' and user '$DB_USER' created successfully"
}

# Function to test database connection
test_connection() {
    print_status "Testing database connection..."
    
    # Test connection
    PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -d $DB_NAME -c "SELECT version();" > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        print_success "Database connection test successful"
    else
        print_error "Database connection test failed"
        exit 1
    fi
}

# Function to run database migrations
run_migrations() {
    print_status "Running database migrations..."
    
    # Check if we're in the project directory
    if [ ! -f "package.json" ]; then
        print_warning "Not in project directory. Skipping migrations."
        print_warning "Please run migrations manually from your project directory:"
        print_warning "  cd /path/to/your/project"
        print_warning "  node scripts/initDatabase.js"
        return
    fi
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        print_warning "Node.js not found. Skipping migrations."
        print_warning "Please install Node.js and run migrations manually:"
        print_warning "  node scripts/initDatabase.js"
        return
    fi
    
    # Set environment variables for migration
    export DB_HOST=localhost
    export DB_PORT=5432
    export DB_NAME=$DB_NAME
    export DB_USER=$DB_USER
    export DB_PASSWORD=$DB_PASSWORD
    
    # Run database initialization
    if [ -f "scripts/initDatabase.js" ]; then
        print_status "Running database initialization..."
        node scripts/initDatabase.js
        print_success "Database initialization completed"
    else
        print_warning "Database initialization script not found"
    fi
    
    # Run asset generation migration
    if [ -f "scripts/migrateAssetGeneration.js" ]; then
        print_status "Running asset generation migration..."
        node scripts/migrateAssetGeneration.js
        print_success "Asset generation migration completed"
    else
        print_warning "Asset generation migration script not found"
    fi
}

# Function to configure firewall
configure_firewall() {
    print_status "Configuring firewall for PostgreSQL..."
    
    # Check if ufw is available (Ubuntu/Debian)
    if command -v ufw &> /dev/null; then
        ufw allow 5432/tcp
        print_success "UFW firewall configured for PostgreSQL"
    # Check if firewall-cmd is available (CentOS/RHEL)
    elif command -v firewall-cmd &> /dev/null; then
        firewall-cmd --permanent --add-port=5432/tcp
        firewall-cmd --reload
        print_success "Firewalld configured for PostgreSQL"
    else
        print_warning "No firewall management tool found. Please configure manually if needed."
    fi
}

# Function to create .env file template
create_env_template() {
    print_status "Creating .env template..."
    
    cat > .env.example << EOF
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD

# Server Configuration
PORT=3000
NODE_ENV=production

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# Default Super Admin
DEFAULT_SUPER_ADMIN_EMAIL=superadmin@example.com
DEFAULT_SUPER_ADMIN_PASSWORD=SuperAdmin123!

# AWS SQS Configuration (for campaign scheduler)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789012/whatsapp-messages

# Scheduler Configuration
SCHEDULER_CHECK_INTERVAL_MS=60000
AUTO_START_SCHEDULER=false

# SQS Processing Configuration
BATCH_SIZE=10
PROCESSING_TIMEOUT_MS=30000
MAX_RETRY_ATTEMPTS=3
EOF
    
    print_success ".env.example template created"
    print_warning "Please copy .env.example to .env and update the values as needed"
}

# Function to display final instructions
display_instructions() {
    print_success "PostgreSQL setup completed successfully!"
    echo
    echo -e "${GREEN}Database Information:${NC}"
    echo "  Host: localhost"
    echo "  Port: 5432"
    echo "  Database: $DB_NAME"
    echo "  Username: $DB_USER"
    echo "  Password: $DB_PASSWORD"
    echo
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "1. Copy .env.example to .env and update configuration"
    echo "2. Install Node.js dependencies: npm install"
    echo "3. Start your WhatsApp Business Server: npm start"
    echo
    echo -e "${YELLOW}Security Recommendations:${NC}"
    echo "1. Change the default database password"
    echo "2. Configure PostgreSQL for your specific network requirements"
    echo "3. Set up SSL/TLS for database connections in production"
    echo "4. Regularly backup your database"
    echo
    echo -e "${BLUE}Database Connection String:${NC}"
    echo "postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME"
}

# Main execution
main() {
    echo -e "${BLUE}"
    echo "=================================================="
    echo "  WhatsApp Business Server - Database Setup"
    echo "=================================================="
    echo -e "${NC}"
    
    check_root
    detect_os
    update_system
    install_postgresql
    configure_postgresql
    create_database
    test_connection
    configure_firewall
    run_migrations
    create_env_template
    display_instructions
    
    print_success "Setup completed successfully!"
}

# Run main function
main "$@"
