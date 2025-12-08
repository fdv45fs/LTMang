#ifndef AIRCRAFTS_DTO_H
#define AIRCRAFTS_DTO_H

#include <stdbool.h>
#include <stdint.h>

// DTO for table: aircrafts
typedef struct {
    int id;
    char model[256];
    int total_capacity;
} aircraftsDTO;

#endif // AIRCRAFTS_DTO_H