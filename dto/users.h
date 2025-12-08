#ifndef USERS_DTO_H
#define USERS_DTO_H

#include <stdbool.h>
#include <stdint.h>

// DTO for table: users
typedef struct {
    int id;
    char username[256];
    char password_hash[256];
    char full_name[256];
    char email[256];
    char phone[51];
    char role[51];
    char created_at[32]; // ISO8601 Format
} usersDTO;

#endif // USERS_DTO_H