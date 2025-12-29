/**
 * Common Header for Flight Booking App
 * Include this file to get all definitions
 * 
 * All structs are packed (no padding) for network transmission
 */

#ifndef COMMON_H
#define COMMON_H

#include <stdint.h>
#include <stdbool.h>

// ============================================================================
// PRAGMA PACK - Disable struct padding for all included headers
// ============================================================================
#pragma pack(push, 1)

// ============================================================================
// MESSAGE PROTOCOL
// ============================================================================
#include "message.h"

// ============================================================================
// MESSAGE PAYLOADS
// ============================================================================
#include "../messages/auth_msg.h"
#include "../messages/search_msg.h"
#include "../messages/booking_msg.h"
#include "../messages/admin_msg.h"
#include "../messages/notification_msg.h"

// ============================================================================
// DATABASE DTOs
// ============================================================================
#include "../dto/users.h"
#include "../dto/airports.h"
#include "../dto/aircrafts.h"
#include "../dto/flights.h"
#include "../dto/flightclasses.h"
#include "../dto/flightseats.h"
#include "../dto/bookings.h"
#include "../dto/tickets.h"
#include "../dto/payments.h"
#include "../dto/notifications.h"
#include "../dto/systemlogs.h"

#pragma pack(pop)
// ============================================================================
// END PRAGMA PACK
// ============================================================================

// ============================================================================
// PROTOCOL HELPERS (inline functions, không cần pack)
// ============================================================================
#include "protocol.h"

#endif // COMMON_H
