/**
 * Protocol Helper Functions for Flight Booking App
 * Send/Receive messages over TCP socket
 */

#ifndef PROTOCOL_H
#define PROTOCOL_H

#include <stdint.h>
#include <string.h>
#include <stdlib.h>
#include <unistd.h>
#include <sys/socket.h>
#include "message.h"

// ============================================================================
// HELPER MACROS
// ============================================================================

// ============================================================================
// HELPER FUNCTIONS TO CREATE HEADERS
// ============================================================================

/**
 * Initialize a request header
 */
static inline void init_request_header(MessageHeader *header, MessageType type, 
                                        uint32_t payload_len, uint32_t session_id, 
                                        uint32_t request_id) {
    header->message_type = type;
    header->status_code = STATUS_REQUEST;
    header->payload_length = payload_len;
    header->session_id = session_id;
    header->request_id = request_id;
}

/**
 * Initialize a response header
 */
static inline void init_response_header(MessageHeader *header, MessageType type,
                                         StatusCode status, uint32_t payload_len,
                                         uint32_t session_id, uint32_t request_id) {
    header->message_type = type;
    header->status_code = status;
    header->payload_length = payload_len;
    header->session_id = session_id;
    header->request_id = request_id;
}

#endif // PROTOCOL_H

