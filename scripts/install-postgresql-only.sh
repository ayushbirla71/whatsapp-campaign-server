#!/bin/bash

# PostgreSQL Installation Only - EC2 Setup Script
# This script only installs PostgreSQL and creates database/user
# Usage: sudo bash install-postgresql-only.sh

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration variables (you can modify these)
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

# Function to install PostgreSQL
install_postgresql() {
    print_status "Installing PostgreSQL $POSTGRES_VERSION..."
    
    if [[ "$OS" == *"Ubuntu"* ]] || [[ "$OS" == *"Debian"* ]]; then
        # Ubuntu/Debian installation
        apt-get update -y
        apt-get install -y wget ca-certificates
        
        # Add PostgreSQL official APT repository
        wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
        echo "deb http://apt.postgresql.org/pub/repos/apt/ $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
        
        apt-get update -y
        apt-get install -y postgresql-$POSTGRES_VERSION postgresql-client-$POSTGRES_VERSION postgresql-contrib-$POSTGRES_VERSION
        
    elif [[ "$OS" == *"Amazon Linux"* ]]; then
        # Amazon Linux 2 installation
        yum update -y
        amazon-linux-extras install postgresql$POSTGRES_VERSION -y
        yum install -y postgresql-server postgresql-contrib
        
        # Initialize database
        /usr/bin/postgresql-setup --initdb
        
    elif [[ "$OS" == *"CentOS"* ]] || [[ "$OS" == *"Red Hat"* ]]; then
        # CentOS/RHEL installation
        yum update -y
        yum install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-7-x86_64/pgdg-redhat-repo-latest.noarch.rpm
        yum install -y postgresql$POSTGRES_VERSION-server postgresql$POSTGRES_VERSION-contrib
        
        # Initialize database
        /usr/pgsql-$POSTGRES_VERSION/bin/postgresql-$POSTGRES_VERSION-setup initdb
    else
        print_error "Unsupported operating system: $OS"
        exit 1
    fi
    
    print_success "PostgreSQL installed successfully"
}

# Function to configure PostgreSQL
configure_postgresql() {
    print_status "Configuring PostgreSQL..."
    
    # Find PostgreSQL configuration directory
    if [[ "$OS" == *"Ubuntu"* ]] || [[ "$OS" == *"Debian"* ]]; then
        PG_CONFIG_DIR="/etc/postgresql/$POSTGRES_VERSION/main"
        SERVICE_NAME="postgresql"
    else
        PG_CONFIG_DIR="/var/lib/pgsql/$POSTGRES_VERSION/data"
        SERVICE_NAME="postgresql-$POSTGRES_VERSION"
    fi
    
    # Start and enable PostgreSQL service
    systemctl start $SERVICE_NAME
    systemctl enable $SERVICE_NAME
    
    # Wait for PostgreSQL to start
    sleep 5
    
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
# IPv6 local connections:
host    all             all             ::1/128                 md5
EOF
    
    # Configure PostgreSQL to listen on localhost
    sed -i "s/#listen_addresses = 'localhost'/listen_addresses = 'localhost'/" $PG_CONFIG_DIR/postgresql.conf
    
    # Restart PostgreSQL to apply changes
    systemctl restart $SERVICE_NAME
    
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

# Function to display connection info
display_info() {
    print_success "PostgreSQL setup completed successfully!"
    echo
    echo -e "${GREEN}Database Information:${NC}"
    echo "  Host: localhost"
    echo "  Port: 5432"
    echo "  Database: $DB_NAME"
    echo "  Username: $DB_USER"
    echo "  Password: $DB_PASSWORD"
    echo
    echo -e "${BLUE}Connection String:${NC}"
    echo "postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME"
    echo
    echo -e "${YELLOW}Environment Variables for your .env file:${NC}"
    echo "DB_HOST=localhost"
    echo "DB_PORT=5432"
    echo "DB_NAME=$DB_NAME"
    echo "DB_USER=$DB_USER"
    echo "DB_PASSWORD=$DB_PASSWORD"
    echo
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "1. Update your .env file with the database credentials above"
    echo "2. Run your application migrations from your project directory"
    echo "3. Start your WhatsApp Business Server"
}

# Main execution
main() {
    echo -e "${BLUE}"
    echo "=============================================="
    echo "  PostgreSQL Installation Script for EC2"
    echo "=============================================="
    echo -e "${NC}"
    
    check_root
    detect_os
    install_postgresql
    configure_postgresql
    create_database
    test_connection
    display_info
    
    print_success "PostgreSQL installation completed!"
}

# Run main function
main "$@"
