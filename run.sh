#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}   Flight Booking App${NC}"
    echo -e "${BLUE}========================================${NC}"
}

build() {
    echo -e "${YELLOW}[BUILD] Building C projects...${NC}"
    cd "$PROJECT_DIR"
    mkdir -p build
    cd build
    cmake .. && make
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}[BUILD] Build successful!${NC}"
    else
        echo -e "${RED}[BUILD] Build failed!${NC}"
        exit 1
    fi
}

run_database() {
    echo -e "${GREEN}[DATABASE] Starting Database Service on port 5000...${NC}"
    cd "$PROJECT_DIR/server/database_service"
    python3 main.py
}

run_server() {
    echo -e "${GREEN}[SERVER] Starting Server Backend on port 8080...${NC}"
    cd "$PROJECT_DIR"
    ./build/server/backend/server
}

run_client_backend() {
    echo -e "${GREEN}[CLIENT] Starting Client Backend on port 3001...${NC}"
    cd "$PROJECT_DIR"
    ./build/client/backend/client
}

run_frontend() {
    echo -e "${GREEN}[FRONTEND] Starting Frontend on port 3000...${NC}"
    cd "$PROJECT_DIR/client/frontend"
    npm run dev
}

install_frontend() {
    echo -e "${YELLOW}[INSTALL] Installing frontend dependencies...${NC}"
    cd "$PROJECT_DIR/client/frontend"
    npm install
}

show_help() {
    print_header
    echo ""
    echo "Usage: ./run.sh [command]"
    echo ""
    echo "Commands:"
    echo "  build       Build C projects (server & client backend)"
    echo "  database    Run Database Service (Python - port 5000)"
    echo "  server      Run Server Backend (C - port 8080)"
    echo "  client      Run Client Backend (C - port 3001)"
    echo "  frontend    Run Frontend (React - port 3000)"
    echo "  install     Install frontend dependencies"
    echo "  all         Build and run all C services (in background)"
    echo "  help        Show this help message"
    echo ""
    echo "Example:"
    echo "  ./run.sh build      # Build first"
    echo "  ./run.sh all        # Run database, server, client backend"
    echo "  ./run.sh frontend   # Run frontend in separate terminal"
}

run_all() {
    build
    echo ""
    echo -e "${YELLOW}Starting all C services in background...${NC}"
    echo ""
    
    # Run database service
    cd "$PROJECT_DIR/server/database_service"
    python3 main.py &
    DB_PID=$!
    echo -e "${GREEN}[DATABASE] PID: $DB_PID${NC}"
    sleep 1
    
    # Run server backend
    cd "$PROJECT_DIR"
    ./build/server/backend/server &
    SERVER_PID=$!
    echo -e "${GREEN}[SERVER] PID: $SERVER_PID${NC}"
    sleep 1
    
    # Run client backend
    ./build/client/backend/client &
    CLIENT_PID=$!
    echo -e "${GREEN}[CLIENT] PID: $CLIENT_PID${NC}"
    
    echo ""
    echo -e "${BLUE}All C services started!${NC}"
    echo -e "${YELLOW}Run frontend separately: cd client/frontend && npm run dev${NC}"
    echo -e "Press Ctrl+C to stop all services"
    echo ""
    
    # Trap Ctrl+C to kill all processes
    cleanup() {
        echo ""
        echo -e "${YELLOW}Stopping all services...${NC}"
        kill $DB_PID $SERVER_PID $CLIENT_PID 2>/dev/null
        echo -e "${GREEN}All services stopped.${NC}"
        exit 0
    }
    trap cleanup SIGINT SIGTERM
    
    # Wait indefinitely until Ctrl+C
    while true; do
        sleep 1
    done
}

# Main
case "$1" in
    build)
        build
        ;;
    database)
        run_database
        ;;
    server)
        run_server
        ;;
    client)
        run_client_backend
        ;;
    frontend)
        run_frontend
        ;;
    install)
        install_frontend
        ;;
    all)
        run_all
        ;;
    help|--help|-h|"")
        show_help
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        show_help
        exit 1
        ;;
esac
