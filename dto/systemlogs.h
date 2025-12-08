#ifndef SYSTEMLOGS_DTO_H
#define SYSTEMLOGS_DTO_H

#include <stdbool.h>
#include <stdint.h>

// DTO for table: systemlogs
typedef struct {
    int id;
    int user_id;
    char action_type[256];
    char details[1024];
    char timestamp[32]; // ISO8601 Format
} systemlogsDTO;

#endif // SYSTEMLOGS_DTO_H