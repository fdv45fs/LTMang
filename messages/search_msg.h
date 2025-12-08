/**
 * Search & Compare Message Payloads
 * UC04: Tìm kiếm chuyến bay | UC05: So sánh chuyến bay
 */

#ifndef SEARCH_MSG_H
#define SEARCH_MSG_H

#include <stdint.h>

// ============================================================================
// SORT OPTIONS
// ============================================================================

typedef enum {
    SORT_BY_PRICE_ASC = 0,      // Giá: Thấp đến Cao
    SORT_BY_DURATION = 1,       // Thời gian bay: Ngắn nhất
    SORT_BY_DEPARTURE = 2       // Giờ khởi hành: Sớm nhất
} SortOption;

// ============================================================================
// FLIGHT INFO (dùng chung cho response)
// ============================================================================

typedef struct {
    int flight_id;
    char flight_code[16];       // Mã chuyến bay
    int origin_airport_id;
    char origin_code[4];        // VD: "HAN"
    char origin_name[64];       // VD: "Nội Bài"
    int destination_airport_id;
    char destination_code[4];   // VD: "SGN"
    char destination_name[64];  // VD: "Tân Sơn Nhất"
    int64_t departure_time;     // Unix timestamp
    int64_t arrival_time;       // Unix timestamp
    int available_seats;        // Số ghế còn trống
    int32_t economy_price;      // Giá vé phổ thông (VND / 1000)
    int32_t business_price;     // Giá vé thương gia (VND / 1000)
    char aircraft_model[64];    // Model máy bay
    char status[16];            // "SCHEDULED", "DELAYED", "CANCELLED"
} FlightInfo;

// ============================================================================
// UC04: TÌM KIẾM CHUYẾN BAY (Search Flights)
// ============================================================================

// Request: Client -> Server
typedef struct {
    int origin_airport_id;      // ID sân bay đi (0 = tất cả)
    int destination_airport_id; // ID sân bay đến (0 = tất cả)
    int64_t departure_date;     // Ngày khởi hành (Unix timestamp, 0 = tất cả)
    int passenger_count;        // Số lượng hành khách
    uint8_t sort_by;            // SortOption enum
} SearchFlightsRequest;

// Response: Server -> Client
typedef struct {
    int total_count;            // Tổng số chuyến bay tìm được
    int returned_count;         // Số chuyến bay trả về trong response này
    // Followed by: FlightInfo flights[returned_count]
} SearchFlightsResponse;

// ============================================================================
// UC05: SO SÁNH CHUYẾN BAY (Compare Flights)
// ============================================================================

#define MAX_COMPARE_FLIGHTS 4

// Request: Client -> Server
typedef struct {
    int count;                  // Số lượng chuyến bay cần so sánh (2-4)
    int flight_ids[MAX_COMPARE_FLIGHTS]; // Danh sách flight_id
} CompareFlightsRequest;

// Response: Server -> Client
// Sử dụng lại SearchFlightsResponse với returned_count = số chuyến bay yêu cầu
// Followed by: FlightInfo flights[count]

// ============================================================================
// GET AIRPORTS (Utility)
// ============================================================================

typedef struct {
    int airport_id;
    char code[4];               // VD: "HAN", "SGN"
    char name[128];             // VD: "Sân bay Quốc tế Nội Bài"
    char city[64];              // VD: "Hà Nội"
} AirportInfo;

// Request: không cần payload

// Response: Server -> Client
typedef struct {
    int count;                  // Số lượng sân bay
    // Followed by: AirportInfo airports[count]
} GetAirportsResponse;

#endif // SEARCH_MSG_H

