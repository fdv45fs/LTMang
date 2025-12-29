# Ứng Dụng Đặt Vé Máy Bay

Ứng dụng demo kiến trúc client-server với:
- **Server Backend**: C TCP server + HTTP client (Mongoose) (Port 8080)
- **Database Service**: Python Flask HTTP API (Port 5000)
- **Client Backend**: C HTTP server (Mongoose) + TCP client (Port 3001)
- **Client Frontend**: React + Vite + shadcn UI (Port 5173)

## Kiến trúc

```
React Frontend (Port 5173)
    ↓ HTTP (fetch)
Client Backend - Mongoose HTTP Server (Port 3001)
    ↓ TCP Socket (binary message)
Server Backend - TCP Server (Port 8080)
    ↓ HTTP + JSON (Mongoose client)
Database Service - Flask HTTP API (Port 5000)
    ↓ SQLAlchemy
PostgreSQL (Supabase)
```

## Cấu trúc thư mục

```
Setup/
├── libs/                      # Thư viện bên thứ 3
│   ├── cJSON/
│   └── mongoose/
├── common/                    # Headers chung
│   ├── common.h
│   ├── message.h
│   └── protocol.h
├── messages/                  # Message payloads
│   ├── auth_msg.h
│   ├── search_msg.h
│   ├── booking_msg.h
│   ├── admin_msg.h
│   └── notification_msg.h
├── dto/                       # Data Transfer Objects
├── server/
│   ├── backend/               # C TCP Server + HTTP Client
│   │   ├── CMakeLists.txt
│   │   └── main.c
│   └── database_service/      # Python Flask API
│       ├── main.py
│       └── requirements.txt
├── client/
│   ├── backend/               # C HTTP Server + TCP Client
│   │   ├── CMakeLists.txt
│   │   └── main.c
│   └── frontend/              # React + Vite + shadcn UI
├── CMakeLists.txt
├── run.sh
├── seed_database.py
└── README.md
```

## Cài đặt

### 1. Cấu hình Database

Tạo file `.env` từ `.envexample`:
```bash
cp .envexample .env
# Sửa DATABASE_URL với connection string của bạn
```

### 2. Seed Database

```bash
cd server/database_service
pip install -r requirements.txt
cd ../..
python seed_database.py
```

### 3. Build C Projects

```bash
./run.sh build
```

### 4. Cài đặt Frontend

```bash
cd client/frontend
npm install
```

## Chạy ứng dụng

### Cách 1: Chạy từng service riêng (khuyến nghị khi dev)

```bash
# Terminal 1: Database Service
cd server/database_service && python main.py

# Terminal 2: Server Backend
./build/server/backend/server

# Terminal 3: Client Backend  
./build/client/backend/client

# Terminal 4: Frontend
cd client/frontend && npm run dev
```

### Cách 2: Sử dụng script

```bash
./run.sh all        # Chạy database, server, client backend
cd client/frontend && npm run dev   # Chạy frontend riêng
```

## Tài khoản test

| Username | Password | Role | Mô tả |
|----------|----------|------|-------|
| admin | 123456 | ADMIN | Quản trị viên |
| nguyenvana | 123456 | USER | Có 2 booking OK, 1 cancelled |
| tranthib | 123456 | USER | Có 1 booking PENDING |
| lethic | 123456 | USER | User mới, chưa có booking |
| phamvand | 123456 | USER | Có 1 booking OK |

## API Endpoints

### Database Service (Port 5000)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | /api/login | Đăng nhập |
| GET | /api/flights | Tìm kiếm chuyến bay |
| GET | /api/flights/:id | Chi tiết chuyến bay |
| POST | /api/bookings | Tạo booking mới |
| GET | /api/users/:id/tickets | Xem vé đã đặt |
| POST | /api/payments | Xử lý thanh toán |

### Client Backend (Port 3001)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | /api/login | Đăng nhập |
| GET | /api/flights | Tìm kiếm chuyến bay |
| POST | /api/bookings | Đặt vé |
| GET | /api/tickets | Xem vé của user |
| POST | /api/payments | Thanh toán |
