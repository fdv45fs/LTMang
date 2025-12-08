#ifndef FLIGHTS_DTO_H
#define FLIGHTS_DTO_H

#include <stdbool.h>
#include <stdint.h>

// DTO for table: flights
typedef struct {
    int id;
    char flight_code[51];
    int aircraft_id;
    int origin_airport_id;
    int destination_airport_id;
    char departure_time[32]; // ISO8601 Format
    char arrival_time[32]; // ISO8601 Format
    char status[51];
} flightsDTO;

#endif // FLIGHTS_DTO_H