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

#define MAX_PAYLOAD_SIZE 65536  // 64KB max payload

// ============================================================================
// SEND/RECEIVE FUNCTIONS
// ============================================================================

/**
 * Send a complete message (header + payload) over socket
 * @param sockfd Socket file descriptor
 * @param header Pointer to message header
 * @param payload Pointer to payload data (can be NULL if payload_length is 0)
 * @return 0 on success, -1 on error
 */
static inline int send_message(int sockfd, const MessageHeader *header, const void *payload) {
    // Send header
    ssize_t sent = send(sockfd, header, MESSAGE_HEADER_SIZE, 0);
    if (sent != MESSAGE_HEADER_SIZE) {
        return -1;
    }

    // Send payload if exists
    if (header->payload_length > 0 && payload != NULL) {
        sent = send(sockfd, payload, header->payload_length, 0);
        if (sent != (ssize_t)header->payload_length) {
            return -1;
        }
    }

    return 0;
}

/**
 * Receive message header from socket
 * @param sockfd Socket file descriptor
 * @param header Pointer to store received header
 * @return 0 on success, -1 on error
 */
static inline int recv_header(int sockfd, MessageHeader *header) {
    ssize_t received = recv(sockfd, header, MESSAGE_HEADER_SIZE, MSG_WAITALL);
    if (received != MESSAGE_HEADER_SIZE) {
        return -1;
    }
    return 0;
}

/**
 * Receive payload from socket (call after recv_header)
 * @param sockfd Socket file descriptor
 * @param payload Buffer to store payload
 * @param length Expected payload length from header
 * @return 0 on success, -1 on error
 */
static inline int recv_payload(int sockfd, void *payload, uint32_t length) {
    if (length == 0) {
        return 0;
    }
    if (length > MAX_PAYLOAD_SIZE) {
        return -1;
    }
    ssize_t received = recv(sockfd, payload, length, MSG_WAITALL);
    if (received != (ssize_t)length) {
        return -1;
    }
    return 0;
}

/**
 * Receive complete message (header + payload)
 * @param sockfd Socket file descriptor
 * @param header Pointer to store received header
 * @param payload_out Pointer to pointer that will be allocated for payload (caller must free)
 * @return 0 on success, -1 on error
 */
static inline int recv_message(int sockfd, MessageHeader *header, void **payload_out) {
    *payload_out = NULL;

    // Receive header
    if (recv_header(sockfd, header) != 0) {
        return -1;
    }

    // Receive payload if exists
    if (header->payload_length > 0) {
        if (header->payload_length > MAX_PAYLOAD_SIZE) {
            return -1;
        }
        *payload_out = malloc(header->payload_length);
        if (*payload_out == NULL) {
            return -1;
        }
        if (recv_payload(sockfd, *payload_out, header->payload_length) != 0) {
            free(*payload_out);
            *payload_out = NULL;
            return -1;
        }
    }

    return 0;
}

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

