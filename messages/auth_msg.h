/**
 * Authentication Message Payloads
 * UC01: Đăng ký | UC02: Đăng nhập | UC03: Đăng xuất
 */

#ifndef AUTH_MSG_H
#define AUTH_MSG_H

#include <stdint.h>

// ============================================================================
// UC01: ĐĂNG KÝ TÀI KHOẢN (Register)
// ============================================================================

// Request: Client -> Server
typedef struct {
    char username[64];          // Tên đăng nhập
    char password[64];          // Mật khẩu
    char full_name[128];        // Họ tên
    char email[128];            // Email
    char phone[20];             // Số điện thoại
} RegisterRequest;

// Response: Server -> Client
typedef struct {
    uint32_t user_id;           // ID người dùng mới (0 nếu thất bại)
    char message[256];          // Thông báo kết quả
} RegisterResponse;

// ============================================================================
// UC02: ĐĂNG NHẬP (Login)
// ============================================================================

// Request: Client -> Server
typedef struct {
    char username[64];          // Tên đăng nhập
    char password[64];          // Mật khẩu
} LoginRequest;

// Response: Server -> Client
typedef struct {
    uint32_t user_id;           // ID người dùng (0 nếu thất bại)
    uint32_t session_id;        // Session ID để dùng cho các request tiếp theo
    char full_name[128];        // Họ tên
    char role[16];              // "USER" hoặc "ADMIN"
    char message[256];          // Thông báo kết quả
} LoginResponse;

// ============================================================================
// UC03: ĐĂNG XUẤT (Logout)
// ============================================================================

// Request: Client -> Server
// Không cần payload, chỉ cần header với session_id

// Response: Server -> Client
typedef struct {
    char message[256];          // Thông báo kết quả
} LogoutResponse;

#endif // AUTH_MSG_H

