# Ứng Dụng Đặt Vé Máy Bay

**Codebase C chạy trên Ubuntu, không tương thích với Windows**
**Database free tự tắt sau 1 tuần không hoạt động**

## 1. Hướng dẫn chạy từ file zip (Môi trường chưa cài đặt)

### Bước 1: Cài đặt các công cụ cần thiết (Prerequisites)
Cài đặt C compiler (GCC/Make), CMake, Python, và Node.js trên Ubuntu:

```bash
# Cập nhật danh sách gói
sudo apt update

# Cài đặt công cụ build cho C (gcc, make, ...) và cmake
sudo apt install -y build-essential cmake

# Cài đặt Python 3 và pip
sudo apt install -y python3 python3-pip

# Cài đặt Node.js và npm
sudo apt install -y nodejs npm
```

### Bước 2: Thiết lập dự án

1. **Giải nén file zip** và mở terminal tại thư mục gốc của dự án (thư mục chứa `run.sh`).

2. **Cài đặt thư viện Python (cho Database Service)**:
   ```bash
   cd server/database_service
   pip install -r requirements.txt
   cd ../..
   # Quay lại thư mục gốc
   ```

3. **Cài đặt thư viện Frontend**:
   ```bash
   cd client/frontend
   # npm ci để cài theo phiên bản của package-lock
   npm ci
   # hoặc npm install
   cd ../..
   # Quay lại thư mục gốc
   ```

### Bước 3: Build và Chạy ứng dụng

1. **Cấp quyền thực thi và Build code C**:
   ```bash
   chmod +x run.sh
   ./run.sh build
   ```

2. **Chạy ứng dụng**:

   **Terminal 1:** Chạy toàn bộ backend (Database service, Server C, Client Backend C)
   ```bash
   ./run.sh all
   ```

   **Terminal 2:** Chạy Frontend
   ```bash
   cd client/frontend
   npm run dev
   ```

3. **Truy cập**:
   Mở trình duyệt và truy cập: `http://localhost:5173/login`

## 2. Tài khoản Test

Vào tài khoản ADMIN, quản lí chuyến bay để xem các chuyến bay đang có trong database
Dưới đây là một số tài khoản có sẵn trong database để kiểm thử:

| Username | Password | Role | Mô tả |
|----------|----------|------|-------|
| admin | 123456 | ADMIN | Quản trị viên |
| nguyenvana | 123456 | USER | Có 2 booking OK, 1 cancelled |
| tranthib | 123456 | USER | Có 1 booking PENDING |
| lethic | 123456 | USER | User mới, chưa có booking |
| phamvand | 123456 | USER | Có 1 booking OK |

## 3. Thông tin dự án

Kiến trúc client-server với:
- **Server Backend**: C TCP server (với Client Backend, port 8082) + HTTP client (với Database service)
- **Database Service**: Python Flask HTTP API (Port 5000)
- **Client Backend**: TCP client (với Server Backend) + C HTTP server (Mongoose, với Client Frontend, port 3001)
- **Client Frontend**: React + Vite + shadcn UI (Port 5173 để truy cập trên browser)

Lí do, ưu điểm kiến trúc:
- Backend của Server và Client dùng C, giao tiếp bằng TCP
- Biến truy vấn database thành 1 service giúp dễ thay thế database và viết truy vấn
- Sử dụng được framework frontend hiện đại, để có thể kết nối React với Client Backend cần sử dụng HTTP server

### Kiến trúc hệ thống

```
React Frontend (Port 5173)
    ↓ HTTP
Client Backend - Mongoose HTTP Server (Port 3001)
    ↓ TCP Socket
Server Backend - TCP Server (Port 8082)
    ↓ HTTP + JSON
Database Service - Flask HTTP API (Port 5000)
    ↓ SQLAlchemy
PostgreSQL (Supabase)
```

### Cấu trúc thư mục

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
└── README.md
```

### API Endpoints

#### Database Service (Port 5000)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | /api/login | Đăng nhập |
| GET | /api/flights | Tìm kiếm chuyến bay |
| GET | /api/flights/:id | Chi tiết chuyến bay |
| POST | /api/bookings | Tạo booking mới |
| GET | /api/users/:id/tickets | Xem vé đã đặt |
| POST | /api/payments | Xử lý thanh toán |

#### Client Backend (Port 3001)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | /api/login | Đăng nhập |
| GET | /api/flights | Tìm kiếm chuyến bay |
| POST | /api/bookings | Đặt vé |
| GET | /api/tickets | Xem vé của user |
| POST | /api/payments | Thanh toán |

## 4. Hướng dẫn chạy khi Clone từ GitHub

Nếu bạn clone source code từ GitHub, các bước thực hiện cơ bản giống hệt như chạy từ file zip.

1. **Clone repository**:
   ```bash
   git clone <URL_REPO>
   cd <thư_mục_repo>/Setup
   ```
2. **Thực hiện Setup**: Làm theo **Bước 1** và **Bước 2** ở phần "Hướng dẫn chạy từ file zip".
3. **Build và Run**: Làm theo **Bước 3** ở phần "Hướng dẫn chạy từ file zip".
