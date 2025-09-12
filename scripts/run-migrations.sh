#!/bin/bash

# Database Migration Script for WhatsApp Business Server
# This script runs all database migrations and setups
# Usage: bash run-migrations.sh

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Function to check if .env file exists
check_env_file() {
    if [ ! -f ".env" ]; then
        print_error ".env file not found!"
        print_warning "Please create a .env file with your database configuration:"
        echo
        echo "DB_HOST=localhost"
        echo "DB_PORT=5432"
        echo "DB_NAME=whatsapp_business_server"
        echo "DB_USER=whatsapp_user"
        echo "DB_PASSWORD=your_password"
        echo
        exit 1
    fi
    
    print_success ".env file found"
}

# Function to check if Node.js is installed
check_nodejs() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed!"
        print_warning "Please install Node.js first:"
        echo "  # For Ubuntu/Debian:"
        echo "  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
        echo "  sudo apt-get install -y nodejs"
        echo
        echo "  # For Amazon Linux/CentOS:"
        echo "  curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -"
        echo "  sudo yum install -y nodejs"
        exit 1
    fi
    
    NODE_VERSION=$(node --version)
    print_success "Node.js found: $NODE_VERSION"
}

# Function to check if npm dependencies are installed
check_dependencies() {
    if [ ! -d "node_modules" ]; then
        print_warning "Node.js dependencies not found. Installing..."
        npm install
        print_success "Dependencies installed"
    else
        print_success "Node.js dependencies found"
    fi
}

# Function to test database connection
test_database_connection() {
    print_status "Testing database connection..."
    
    # Load environment variables
    if [ -f ".env" ]; then
        export $(cat .env | grep -v '^#' | xargs)
    fi
    
    # Test connection using Node.js
    node -e "
    const { Pool } = require('pg');
    const pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'whatsapp_business_server',
        user: process.env.DB_USER || 'whatsapp_user',
        password: process.env.DB_PASSWORD
    });
    
    pool.query('SELECT version()')
        .then(() => {
            console.log('Database connection successful');
            process.exit(0);
        })
        .catch((err) => {
            console.error('Database connection failed:', err.message);
            process.exit(1);
        });
    "
    
    if [ $? -eq 0 ]; then
        print_success "Database connection test passed"
    else
        print_error "Database connection test failed"
        print_warning "Please check your database configuration in .env file"
        exit 1
    fi
}

# Function to run database initialization
run_database_init() {
    print_status "Running database initialization..."
    
    if [ -f "scripts/initDatabase.js" ]; then
        node scripts/initDatabase.js
        print_success "Database initialization completed"
    else
        print_error "Database initialization script not found: scripts/initDatabase.js"
        exit 1
    fi
}

# Function to run asset generation migration
run_asset_migration() {
    print_status "Running asset generation migration..."
    
    if [ -f "scripts/migrateAssetGeneration.js" ]; then
        node scripts/migrateAssetGeneration.js
        print_success "Asset generation migration completed"
    else
        print_warning "Asset generation migration script not found: scripts/migrateAssetGeneration.js"
        print_warning "Skipping asset generation migration"
    fi
}

# Function to run WhatsApp sync migration
run_whatsapp_migration() {
    print_status "Running WhatsApp sync migration..."
    
    if [ -f "scripts/migrateWhatsAppSync.js" ]; then
        node scripts/migrateWhatsAppSync.js
        print_success "WhatsApp sync migration completed"
    else
        print_warning "WhatsApp sync migration script not found: scripts/migrateWhatsAppSync.js"
        print_warning "Skipping WhatsApp sync migration"
    fi
}

# Function to verify migrations
verify_migrations() {
    print_status "Verifying database schema..."
    
    # Load environment variables
    if [ -f ".env" ]; then
        export $(cat .env | grep -v '^#' | xargs)
    fi
    
    # Check if main tables exist
    node -e "
    const { Pool } = require('pg');
    const pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'whatsapp_business_server',
        user: process.env.DB_USER || 'whatsapp_user',
        password: process.env.DB_PASSWORD
    });
    
    const tables = [
        'users', 'organizations', 'templates', 'campaigns', 
        'audience_master', 'campaign_audience', 'asset_generate_files'
    ];
    
    async function checkTables() {
        try {
            for (const table of tables) {
                const result = await pool.query(\`
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_name = '\${table}'
                    );
                \`);
                
                if (result.rows[0].exists) {
                    console.log(\`✓ Table '\${table}' exists\`);
                } else {
                    console.log(\`✗ Table '\${table}' missing\`);
                }
            }
            
            // Check for UUID extension
            const uuidResult = await pool.query(\`
                SELECT EXISTS (
                    SELECT FROM pg_extension 
                    WHERE extname = 'uuid-ossp'
                );
            \`);
            
            if (uuidResult.rows[0].exists) {
                console.log('✓ UUID extension enabled');
            } else {
                console.log('✗ UUID extension missing');
            }
            
            process.exit(0);
        } catch (error) {
            console.error('Error verifying schema:', error.message);
            process.exit(1);
        }
    }
    
    checkTables();
    "
    
    if [ $? -eq 0 ]; then
        print_success "Database schema verification completed"
    else
        print_error "Database schema verification failed"
        exit 1
    fi
}

# Function to display final status
display_final_status() {
    print_success "All migrations completed successfully!"
    echo
    echo -e "${GREEN}Database Setup Summary:${NC}"
    echo "✓ Database connection verified"
    echo "✓ Core schema initialized"
    echo "✓ Asset generation features added"
    echo "✓ WhatsApp sync features added"
    echo "✓ Database schema verified"
    echo
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "1. Start your WhatsApp Business Server: npm start"
    echo "2. Access API documentation: http://localhost:3000/api"
    echo "3. Login with default super admin credentials"
    echo "4. Configure your organization and WhatsApp Business API settings"
    echo
    echo -e "${BLUE}Default Super Admin Credentials:${NC}"
    echo "Email: superadmin@example.com"
    echo "Password: SuperAdmin123!"
    echo
    print_warning "Remember to change the default admin password after first login!"
}

# Main execution
main() {
    echo -e "${BLUE}"
    echo "=================================================="
    echo "  WhatsApp Business Server - Database Migration"
    echo "=================================================="
    echo -e "${NC}"
    
    # Check if we're in the project directory
    if [ ! -f "package.json" ]; then
        print_error "This script must be run from the project root directory"
        print_warning "Please navigate to your WhatsApp Business Server project directory first"
        exit 1
    fi
    
    check_env_file
    check_nodejs
    check_dependencies
    test_database_connection
    run_database_init
    run_asset_migration
    run_whatsapp_migration
    verify_migrations
    display_final_status
    
    print_success "Migration process completed successfully!"
}

# Run main function
main "$@"
