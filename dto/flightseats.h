#ifndef FLIGHTSEATS_DTO_H
#define FLIGHTSEATS_DTO_H

#include <stdbool.h>
#include <stdint.h>

// DTO for table: flightseats
typedef struct {
    int id;
    char seat_number[11];
    int class_type_id;
    char status[51];
    char info[1024];
} flightseatsDTO;

#endif // FLIGHTSEATS_DTO_H