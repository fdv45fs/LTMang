#ifndef FLIGHTCLASSES_DTO_H
#define FLIGHTCLASSES_DTO_H

#include <stdbool.h>
#include <stdint.h>

// DTO for table: flightclasses
typedef struct {
    int id;
    int flight_id;
    char class_type[51];
    double price;
    int total_seats;
    int booked_seats;
    char info[1024];
} flightclassesDTO;

#endif // FLIGHTCLASSES_DTO_H