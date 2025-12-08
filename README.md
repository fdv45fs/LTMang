# Ứng Dụng Đặt Vé Máy Bay

Ứng dụng demo kiến trúc client-server với:
- **Server Backend**: C TCP server + HTTP client (Mongoose) (Port 8080)
- **Database Service**: Python HTTP server với JSON API (Port 5000)
- **Client Backend**: C HTTP server (Mongoose) + TCP client (Port 3001)
- **Client Frontend**: React + Vite + shadcn UI (Port 3000)

## Kiến trúc

```
React Frontend (Port 3000)
    ↓ HTTP
Client Backend - HTTP Server (Port 3001)
    ↓ TCP Socket
Server Backend - TCP Server (Port 8080)
    ↓ HTTP + JSON
Database Service - Python HTTP Server (Port 5000)
```

## Cấu trúc thư mục

```
Setup/
├── libs/                      # Thư viện bên thứ 3
│   ├── cJSON/
│   └── mongoose/
├── server/
│   ├── backend/               # C TCP Server + HTTP Client
│   │   ├── CMakeLists.txt
│   │   └── main.c
│   └── database_service/      # Python HTTP Server
│       └── main.py
├── client/
│   ├── backend/               # C HTTP Server + TCP Client
│   │   ├── CMakeLists.txt
│   │   └── main.c
│   └── frontend/              # React + Vite + shadcn UI
├── CMakeLists.txt
└── README.md
```

## Cách chạy

### 1. Build C projects
```bash
mkdir build && cd build
cmake ..
make
```

### 2. Chạy Database Service
```bash
cd server/database_service
python main.py
```

### 3. Chạy Server Backend
```bash
./build/server/backend/server
```

### 4. Chạy Client Backend
```bash
./build/client/backend/client
```

### 5. Chạy Frontend
```bash
cd client/frontend
npm install
npm run dev
```
