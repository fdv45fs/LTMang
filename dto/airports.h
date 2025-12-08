#ifndef AIRPORTS_DTO_H
#define AIRPORTS_DTO_H

#include <stdbool.h>
#include <stdint.h>

// DTO for table: airports
typedef struct {
    int id;
    char code[4];
    char name[256];
    char city[256];
} airportsDTO;

#endif // AIRPORTS_DTO_H