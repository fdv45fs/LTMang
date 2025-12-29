/**
 * Notification Message Payloads
 * UC10: Nhận thông báo chuyến bay
 */

#ifndef NOTIFICATION_MSG_H
#define NOTIFICATION_MSG_H

#include <stdint.h>

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

typedef enum {
    NOTIFY_FLIGHT_DELAYED = 1,      // Chuyến bay bị delay
    NOTIFY_FLIGHT_CANCELLED = 2,    // Chuyến bay bị hủy
    NOTIFY_FLIGHT_GATE_CHANGED = 3, // Đổi cổng
    NOTIFY_FLIGHT_TIME_CHANGED = 4, // Đổi giờ bay
    NOTIFY_BOOKING_CONFIRMED = 5,   // Đặt vé thành công
    NOTIFY_PAYMENT_SUCCESS = 6,     // Thanh toán thành công
    NOTIFY_SYSTEM = 99              // Thông báo hệ thống
} NotificationType;

// ============================================================================
// UC10: THÔNG BÁO CHUYẾN BAY (Push Notification)
// ============================================================================

// Server push to Client (không cần request)
typedef struct {
    int notification_id;
    uint8_t notification_type;      // NotificationType enum
    char title[128];                // Tiêu đề thông báo
    char message[512];              // Nội dung chi tiết
    int related_flight_id;          // ID chuyến bay liên quan (0 nếu không có)
    char flight_code[16];           // Mã chuyến bay (nếu có)
    int64_t created_at;             // Thời gian tạo (Unix timestamp)
    uint8_t is_read;                // Đã đọc chưa
} NotificationPush;

// ============================================================================
// GET NOTIFICATIONS (Lấy danh sách thông báo)
// ============================================================================

// Request: Client -> Server
typedef struct {
    int limit;                      // Số lượng tối đa (0 = mặc định 50)
    int offset;                     // Bắt đầu từ record thứ mấy
    uint8_t unread_only;            // Chỉ lấy chưa đọc (1) hay tất cả (0)
} GetNotificationsRequest;

// Response: Server -> Client
typedef struct {
    int total_count;                // Tổng số thông báo
    int unread_count;               // Số thông báo chưa đọc
    int returned_count;             // Số thông báo trả về
    // Followed by: NotificationPush notifications[returned_count]
} GetNotificationsResponse;

// ============================================================================
// MARK NOTIFICATION AS READ
// ============================================================================

// Request: Client -> Server
typedef struct {
    int notification_id;            // ID thông báo (0 = đánh dấu tất cả đã đọc)
} MarkNotificationReadRequest;

// Response: Server -> Client
typedef struct {
    int marked_count;               // Số thông báo đã đánh dấu
    char message[256];
} MarkNotificationReadResponse;

#endif // NOTIFICATION_MSG_H

