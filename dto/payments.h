#ifndef PAYMENTS_DTO_H
#define PAYMENTS_DTO_H

#include <stdbool.h>
#include <stdint.h>

// DTO for table: payments
typedef struct {
    int id;
    int booking_id;
    char transaction_date[32]; // ISO8601 Format
    char transaction_id[256];
    double amount;
    char status[51];
} paymentsDTO;

#endif // PAYMENTS_DTO_H