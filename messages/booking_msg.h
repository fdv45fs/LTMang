/**
 * Booking & Ticket Message Payloads
 * UC06: Đặt vé | UC07: Thanh toán | UC08: Nhận mã vé | UC09: Quản lý vé
 */

#ifndef BOOKING_MSG_H
#define BOOKING_MSG_H

#include <stdint.h>

// ============================================================================
// PASSENGER INFO
// ============================================================================

typedef struct {
    char full_name[128];        // Họ tên hành khách
    char ic_number[20];         // CMND/CCCD
    char phone[20];             // Số điện thoại
} PassengerInfo;

// ============================================================================
// SEAT INFO
// ============================================================================

typedef struct {
    int seat_id;
    char seat_number[8];        // VD: "12A", "12B"
    char class_type[16];        // "ECONOMY" hoặc "BUSINESS"
    int32_t price;              // Giá vé (VND / 1000)
    char status[16];            // "AVAILABLE", "LOCKED", "BOOKED"
} SeatInfo;

// ============================================================================
// TICKET INFO (dùng cho response)
// ============================================================================

typedef struct {
    int ticket_id;
    char ticket_number[32];     // Mã vé
    int booking_id;
    char booking_reference[16]; // Mã đặt chỗ (PNR)
    int flight_id;
    char flight_code[16];
    char seat_number[8];
    char class_type[16];
    char passenger_name[128];
    char passenger_ic[20];
    int64_t departure_time;
    char origin_code[4];
    char destination_code[4];
    int32_t price;
    char status[16];            // "ACTIVE", "CANCELLED"
} TicketInfo;

// ============================================================================
// UC06: ĐẶT VÉ MÁY BAY (Book Flight)
// ============================================================================

#define MAX_PASSENGERS 9

// Request: Client -> Server
typedef struct {
    int flight_id;              // ID chuyến bay
    int class_type_id;          // ID loại ghế (Economy/Business)
    int passenger_count;        // Số lượng hành khách
    PassengerInfo passengers[MAX_PASSENGERS]; // Thông tin hành khách
} BookFlightRequest;

// Response: Server -> Client
typedef struct {
    int booking_id;             // ID đơn đặt vé (0 nếu thất bại)
    char booking_reference[16]; // Mã đặt chỗ (PNR)
    int32_t total_amount;       // Tổng tiền (VND / 1000)
    char status[16];            // "PENDING", "CONFIRMED", "FAILED"
    char message[256];          // Thông báo
} BookFlightResponse;

// ============================================================================
// UC07: THANH TOÁN (Payment)
// ============================================================================

typedef enum {
    PAYMENT_CREDIT_CARD = 1,
    PAYMENT_E_WALLET = 2
} PaymentMethod;

// Request: Client -> Server
typedef struct {
    int booking_id;             // ID đơn đặt vé
    uint8_t payment_method;     // PaymentMethod enum
    char card_number[20];       // Số thẻ (nếu credit card)
    char card_cvv[4];           // CVV
    char card_expiry[8];        // MM/YY
} PaymentRequest;

// Response: Server -> Client
typedef struct {
    int payment_id;             // ID giao dịch (0 nếu thất bại)
    char transaction_id[64];    // Mã giao dịch
    int32_t amount;             // Số tiền đã thanh toán
    char status[16];            // "SUCCESS", "FAILED"
    char message[256];          // Thông báo kết quả
} PaymentResponse;

// ============================================================================
// UC08: NHẬN MÃ VÉ ĐIỆN TỬ (Get Ticket)
// ============================================================================

// Request: Client -> Server
typedef struct {
    int booking_id;             // ID đơn đặt vé
} GetTicketRequest;

// Response: Server -> Client
typedef struct {
    char booking_reference[16]; // Mã đặt chỗ (PNR)
    int ticket_count;           // Số lượng vé
    // Followed by: TicketInfo tickets[ticket_count]
} GetTicketResponse;

// ============================================================================
// UC09: QUẢN LÝ VÉ ĐÃ ĐẶT (Manage Tickets)
// ============================================================================

// --- List Tickets ---
// Request: không cần payload (dùng session_id để lấy user)

// Response: Server -> Client
typedef struct {
    int total_count;            // Tổng số vé
    int returned_count;         // Số vé trả về
    // Followed by: TicketInfo tickets[returned_count]
} ListTicketsResponse;

// --- Cancel Ticket ---
// Request: Client -> Server
typedef struct {
    int ticket_id;              // ID vé cần hủy
} CancelTicketRequest;

// Response: Server -> Client
typedef struct {
    int ticket_id;
    char status[16];            // "CANCELLED" hoặc "FAILED"
    char message[256];          // Thông báo (lý do từ chối nếu thất bại)
} CancelTicketResponse;

#endif // BOOKING_MSG_H

