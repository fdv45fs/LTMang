#ifndef NOTIFICATIONS_DTO_H
#define NOTIFICATIONS_DTO_H

#include <stdbool.h>
#include <stdint.h>

// DTO for table: notifications
typedef struct {
    int id;
    int user_id;
    char title[256];
    char message[1024];
    bool is_read;
    char created_at[32]; // ISO8601 Format
    int related_flight_id;
} notificationsDTO;

#endif // NOTIFICATIONS_DTO_H