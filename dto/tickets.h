#ifndef TICKETS_DTO_H
#define TICKETS_DTO_H

#include <stdbool.h>
#include <stdint.h>

// DTO for table: tickets
typedef struct {
    int id;
    int booking_id;
    int flight_seat_id;
    char passenger_name[256];
    char passenger_ic_number[51];
    char ticket_number[51];
    char status[51];
} ticketsDTO;

#endif // TICKETS_DTO_H