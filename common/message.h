/**
 * Message Header and Message Types for Flight Booking App
 * TCP Communication Protocol between Client Backend and Server Backend
 */

#ifndef MESSAGE_H
#define MESSAGE_H

#include <stdint.h>

// ============================================================================
// MESSAGE TYPES ENUM
// Format: 0xGGCC where GG=Group, CC=Command
// ============================================================================

typedef enum {
    // Group 01: Authentication (UC01-03)
    MSG_REGISTER_REQ        = 0x0101,   // UC01: Đăng ký
    MSG_REGISTER_RES        = 0x0181,
    MSG_LOGIN_REQ           = 0x0102,   // UC02: Đăng nhập
    MSG_LOGIN_RES           = 0x0182,
    MSG_LOGOUT_REQ          = 0x0103,   // UC03: Đăng xuất
    MSG_LOGOUT_RES          = 0x0183,

    // Group 02: User Operations (UC04-10)
    MSG_SEARCH_FLIGHTS_REQ  = 0x0201,   // UC04: Tìm kiếm chuyến bay
    MSG_SEARCH_FLIGHTS_RES  = 0x0281,
    MSG_COMPARE_FLIGHTS_REQ = 0x0202,   // UC05: So sánh chuyến bay
    MSG_COMPARE_FLIGHTS_RES = 0x0282,
    MSG_BOOK_FLIGHT_REQ     = 0x0203,   // UC06: Đặt vé
    MSG_BOOK_FLIGHT_RES     = 0x0283,
    MSG_PAYMENT_REQ         = 0x0204,   // UC07: Thanh toán
    MSG_PAYMENT_RES         = 0x0284,
    MSG_GET_TICKET_REQ      = 0x0205,   // UC08: Nhận mã vé
    MSG_GET_TICKET_RES      = 0x0285,
    MSG_LIST_TICKETS_REQ    = 0x0206,   // UC09: Xem danh sách vé
    MSG_LIST_TICKETS_RES    = 0x0286,
    MSG_CANCEL_TICKET_REQ   = 0x0207,   // UC09: Hủy vé
    MSG_CANCEL_TICKET_RES   = 0x0287,
    MSG_NOTIFICATION_PUSH   = 0x0208,   // UC10: Thông báo (server push)

    // Group 03: Admin Operations (UC11-13)
    MSG_ADMIN_ADD_FLIGHT_REQ    = 0x0301,   // UC11: Thêm chuyến bay
    MSG_ADMIN_ADD_FLIGHT_RES    = 0x0381,
    MSG_ADMIN_UPDATE_FLIGHT_REQ = 0x0302,   // UC11: Sửa chuyến bay
    MSG_ADMIN_UPDATE_FLIGHT_RES = 0x0382,
    MSG_ADMIN_DELETE_FLIGHT_REQ = 0x0303,   // UC11: Xóa chuyến bay
    MSG_ADMIN_DELETE_FLIGHT_RES = 0x0383,
    MSG_ADMIN_LIST_FLIGHTS_REQ  = 0x0304,   // UC11: Danh sách chuyến bay
    MSG_ADMIN_LIST_FLIGHTS_RES  = 0x0384,
    MSG_ADMIN_UPDATE_PRICE_REQ  = 0x0305,   // UC12: Cập nhật giá vé
    MSG_ADMIN_UPDATE_PRICE_RES  = 0x0385,
    MSG_ADMIN_GET_LOGS_REQ      = 0x0306,   // UC13: Xem logs
    MSG_ADMIN_GET_LOGS_RES      = 0x0386,

    // Group 04: Common/Utility
    MSG_GET_AIRPORTS_REQ    = 0x0401,   // Lấy danh sách sân bay
    MSG_GET_AIRPORTS_RES    = 0x0481,
    MSG_ERROR               = 0x04FF    // Generic error response
} MessageType;

// ============================================================================
// STATUS CODES
// ============================================================================

typedef enum {
    STATUS_REQUEST          = 0,        // This is a request
    STATUS_SUCCESS          = 200,      // Success
    STATUS_CREATED          = 201,      // Created successfully
    STATUS_BAD_REQUEST      = 400,      // Invalid request
    STATUS_UNAUTHORIZED     = 401,      // Not logged in
    STATUS_FORBIDDEN        = 403,      // No permission
    STATUS_NOT_FOUND        = 404,      // Resource not found
    STATUS_CONFLICT         = 409,      // Conflict (e.g., username exists)
    STATUS_INTERNAL_ERROR   = 500       // Server error
} StatusCode;

// ============================================================================
// MESSAGE HEADER (16 bytes)
// ============================================================================

typedef struct {
    uint16_t message_type;      // MessageType enum
    uint16_t status_code;       // StatusCode enum
    uint32_t payload_length;    // Length of payload in bytes
    uint32_t session_id;        // Session ID (0 if not logged in)
    uint32_t request_id;        // Request ID to match request/response
} MessageHeader;

#define MESSAGE_HEADER_SIZE sizeof(MessageHeader)

#endif // MESSAGE_H

