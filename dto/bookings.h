#ifndef BOOKINGS_DTO_H
#define BOOKINGS_DTO_H

#include <stdbool.h>
#include <stdint.h>

// DTO for table: bookings
typedef struct {
    int id;
    int user_id;
    char booking_date[32]; // ISO8601 Format
    double total_amount;
    char status[51];
    char booking_reference[51];
} bookingsDTO;

#endif // BOOKINGS_DTO_H