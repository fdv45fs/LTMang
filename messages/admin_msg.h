/**
 * Admin Message Payloads
 * UC11: Quản lý chuyến bay | UC12: Quản lý giá vé | UC13: Xem logs
 */

#ifndef ADMIN_MSG_H
#define ADMIN_MSG_H

#include <stdint.h>

// ============================================================================
// UC11: QUẢN LÝ CHUYẾN BAY (Add/Update/Delete Flight)
// ============================================================================

// --- Add Flight ---
// Request: Client -> Server
typedef struct {
    char flight_code[16];       // Mã chuyến bay
    int aircraft_id;            // ID máy bay
    int origin_airport_id;      // ID sân bay đi
    int destination_airport_id; // ID sân bay đến
    int64_t departure_time;     // Giờ khởi hành (Unix timestamp)
    int64_t arrival_time;       // Giờ đến (Unix timestamp)
    int economy_seats;          // Số ghế phổ thông
    int32_t economy_price;      // Giá phổ thông (VND / 1000)
    int business_seats;         // Số ghế thương gia
    int32_t business_price;     // Giá thương gia (VND / 1000)
} AddFlightRequest;

// Response: Server -> Client
typedef struct {
    int flight_id;              // ID chuyến bay mới (0 nếu thất bại)
    char message[256];          // Thông báo kết quả
} AddFlightResponse;

// --- Update Flight ---
// Request: Client -> Server
typedef struct {
    int flight_id;              // ID chuyến bay cần sửa
    char flight_code[16];       // Mã chuyến bay mới
    int aircraft_id;
    int origin_airport_id;
    int destination_airport_id;
    int64_t departure_time;
    int64_t arrival_time;
    char status[16];            // "SCHEDULED", "DELAYED", "CANCELLED"
} UpdateFlightRequest;

// Response: Server -> Client
typedef struct {
    int flight_id;
    char status[16];            // "SUCCESS", "FAILED"
    char message[256];
} UpdateFlightResponse;

// --- Delete Flight ---
// Request: Client -> Server
typedef struct {
    int flight_id;              // ID chuyến bay cần xóa
} DeleteFlightRequest;

// Response: Server -> Client
typedef struct {
    int flight_id;
    char status[16];            // "DELETED", "FAILED"
    char message[256];          // Lý do nếu thất bại
} DeleteFlightResponse;

// --- List Flights (Admin view) ---
// Request: không cần payload hoặc có filter

typedef struct {
    int64_t from_date;          // Lọc từ ngày (0 = không lọc)
    int64_t to_date;            // Lọc đến ngày (0 = không lọc)
    char status_filter[16];     // Lọc theo trạng thái ("" = tất cả)
} AdminListFlightsRequest;

// Response: sử dụng SearchFlightsResponse từ search_msg.h

// ============================================================================
// UC12: QUẢN LÝ GIÁ VÉ (Update Price)
// ============================================================================

// Request: Client -> Server
typedef struct {
    int flight_id;              // ID chuyến bay
    int class_type_id;          // ID loại ghế (Economy/Business)
    int32_t new_price;          // Giá mới (VND / 1000)
} UpdatePriceRequest;

// Response: Server -> Client
typedef struct {
    int flight_id;
    int class_type_id;
    int32_t old_price;          // Giá cũ
    int32_t new_price;          // Giá mới
    char status[16];            // "SUCCESS", "FAILED"
    char message[256];
} UpdatePriceResponse;

// ============================================================================
// UC13: XEM LOG HỆ THỐNG (System Logs)
// ============================================================================

typedef struct {
    int log_id;
    int user_id;
    char username[64];
    char action_type[32];       // "LOGIN", "LOGOUT", "BOOK", "CANCEL", etc.
    char details[512];          // Chi tiết hành động
    int64_t timestamp;          // Thời gian (Unix timestamp)
} LogEntry;

// Request: Client -> Server
typedef struct {
    int64_t from_date;          // Lọc từ ngày (0 = không lọc)
    int64_t to_date;            // Lọc đến ngày (0 = không lọc)
    char action_filter[32];     // Lọc theo loại hành động ("" = tất cả)
    int user_id_filter;         // Lọc theo user (0 = tất cả)
    int limit;                  // Số lượng tối đa (0 = mặc định 100)
    int offset;                 // Bắt đầu từ record thứ mấy (phân trang)
} GetLogsRequest;

// Response: Server -> Client
typedef struct {
    int total_count;            // Tổng số log thỏa điều kiện
    int returned_count;         // Số log trả về
    // Followed by: LogEntry logs[returned_count]
} GetLogsResponse;

#endif // ADMIN_MSG_H

