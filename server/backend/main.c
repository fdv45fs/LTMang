/**
 * Flight Booking Server - TCP Server + HTTP Client
 * Port: 8082
 * 
 * - Nhận binary message từ Client Backend qua TCP
 * - Gọi Database Service qua HTTP (Mongoose)
 * - Trả response về Client Backend
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <arpa/inet.h>
#include <sys/socket.h>
#include <pthread.h>
#include <signal.h>
#include <sys/time.h>

#include "cJSON.h"
#include "common.h"

#define SERVER_PORT 8082
#define DB_SERVICE_URL "http://127.0.0.1:5000"
#define BUFFER_SIZE 65536
#define MAX_CLIENTS 100

// Global variables
static int server_running = 1;

// Signal handler
void signal_handler(int sig) {
    printf("\nShutting down server...\n");
    server_running = 0;
}

// ============================================================================
// HTTP CLIENT (Simple Socket)
// ============================================================================

char *call_database_api(const char *method, const char *endpoint, const char *body) {
    int sock_fd;
    struct sockaddr_in db_addr;
    char request[4096];
    char response[BUFFER_SIZE];
    
    // Create socket
    sock_fd = socket(AF_INET, SOCK_STREAM, 0);
    if (sock_fd < 0) {
        printf("[Server] Failed to create socket for DB\n");
        return strdup("{\"success\":false,\"message\":\"Socket error\"}");
    }
    
    // Set timeout
    struct timeval tv;
    tv.tv_sec = 15;
    tv.tv_usec = 0;
    setsockopt(sock_fd, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof(tv));
    setsockopt(sock_fd, SOL_SOCKET, SO_SNDTIMEO, &tv, sizeof(tv));
    
    // Connect to database service
    memset(&db_addr, 0, sizeof(db_addr));
    db_addr.sin_family = AF_INET;
    db_addr.sin_port = htons(5000);
    inet_pton(AF_INET, "127.0.0.1", &db_addr.sin_addr);
    
    if (connect(sock_fd, (struct sockaddr *)&db_addr, sizeof(db_addr)) < 0) {
        printf("[Server] Failed to connect to DB service\n");
        close(sock_fd);
        return strdup("{\"success\":false,\"message\":\"DB connection failed\"}");
    }
    
    // Build HTTP request
    if (body && strlen(body) > 0) {
        snprintf(request, sizeof(request),
            "%s %s HTTP/1.1\r\n"
            "Host: 127.0.0.1:5000\r\n"
            "Content-Type: application/json\r\n"
            "Content-Length: %zu\r\n"
            "Connection: close\r\n"
            "\r\n%s",
            method, endpoint, strlen(body), body);
    } else {
        snprintf(request, sizeof(request),
            "%s %s HTTP/1.1\r\n"
            "Host: 127.0.0.1:5000\r\n"
            "Connection: close\r\n"
            "\r\n",
            method, endpoint);
    }
    
    // Send request
    if (send(sock_fd, request, strlen(request), 0) < 0) {
        printf("[Server] Failed to send to DB\n");
        close(sock_fd);
        return strdup("{\"success\":false,\"message\":\"Send failed\"}");
    }
    
    // Receive response
    int total = 0;
    int n;
    while ((n = recv(sock_fd, response + total, sizeof(response) - total - 1, 0)) > 0) {
        total += n;
    }
    response[total] = '\0';
    close(sock_fd);
    
    if (total == 0) {
        return strdup("{\"success\":false,\"message\":\"No response from DB\"}");
    }
    
    // Find body (after \r\n\r\n)
    char *body_start = strstr(response, "\r\n\r\n");
    if (body_start) {
        body_start += 4;
        return strdup(body_start);
    }
    
    return strdup("{\"success\":false,\"message\":\"Invalid response\"}");
}

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

void send_error_response(int client_fd, uint16_t msg_type, uint16_t status, const char *message) {
    MessageHeader header;
    char payload[256];
    snprintf(payload, sizeof(payload), "{\"success\":false,\"message\":\"%s\"}", message);
    
    init_response_header(&header, msg_type, status, strlen(payload), 0, 0);
    send(client_fd, &header, MESSAGE_HEADER_SIZE, 0);
    send(client_fd, payload, strlen(payload), 0);
}

void handle_login(int client_fd, MessageHeader *header, void *payload) {
    LoginRequest *req = (LoginRequest *)payload;
    
    // Build JSON request
    cJSON *json = cJSON_CreateObject();
    cJSON_AddStringToObject(json, "username", req->username);
    cJSON_AddStringToObject(json, "password", req->password);
    char *json_str = cJSON_PrintUnformatted(json);
    cJSON_Delete(json);
    
    // Call database API
    char *response = call_database_api("POST", "/api/login", json_str);
    free(json_str);
    
    if (!response) {
        send_error_response(client_fd, MSG_LOGIN_RES, STATUS_INTERNAL_ERROR, "Database service unavailable");
        return;
    }
    
    // Send response back
    MessageHeader res_header;
    init_response_header(&res_header, MSG_LOGIN_RES, STATUS_SUCCESS, strlen(response), 0, header->request_id);
    send(client_fd, &res_header, MESSAGE_HEADER_SIZE, 0);
    send(client_fd, response, strlen(response), 0);
    free(response);
}

void handle_register(int client_fd, MessageHeader *header, void *payload) {
    RegisterRequest *req = (RegisterRequest *)payload;
    
    // Build JSON request
    cJSON *json = cJSON_CreateObject();
    cJSON_AddStringToObject(json, "username", req->username);
    cJSON_AddStringToObject(json, "password", req->password);
    cJSON_AddStringToObject(json, "full_name", req->full_name);
    cJSON_AddStringToObject(json, "email", req->email);
    cJSON_AddStringToObject(json, "phone", req->phone);
    char *json_str = cJSON_PrintUnformatted(json);
    printf("[Server] Register request: %s\n", json_str);
    cJSON_Delete(json);
    
    // Call database API
    char *response = call_database_api("POST", "/api/register", json_str);
    free(json_str);
    
    if (!response) {
        send_error_response(client_fd, MSG_REGISTER_RES, STATUS_INTERNAL_ERROR, "Database service unavailable");
        return;
    }
    
    // Send response back
    MessageHeader res_header;
    init_response_header(&res_header, MSG_REGISTER_RES, STATUS_SUCCESS, strlen(response), 0, header->request_id);
    send(client_fd, &res_header, MESSAGE_HEADER_SIZE, 0);
    send(client_fd, response, strlen(response), 0);
    free(response);
}

void handle_search_flights(int client_fd, MessageHeader *header, void *payload) {
    SearchFlightsRequest *req = (SearchFlightsRequest *)payload;
    
    // Build query string
    char path[1024];
    snprintf(path, sizeof(path), 
             "/api/flights?origin_id=%d&dest_id=%d&start_date=%s&end_date=%s&passengers=%d", 
             req->origin_airport_id, 
             req->destination_airport_id, 
             req->start_date, 
             req->end_date,
             req->passenger_count);
    char *response = call_database_api("GET", path, NULL);
    
    if (!response) {
        send_error_response(client_fd, MSG_SEARCH_FLIGHTS_RES, STATUS_INTERNAL_ERROR, "Database service unavailable");
        return;
    }
    
    // Send response back
    MessageHeader res_header;
    init_response_header(&res_header, MSG_SEARCH_FLIGHTS_RES, STATUS_SUCCESS, strlen(response), header->session_id, header->request_id);
    send(client_fd, &res_header, MESSAGE_HEADER_SIZE, 0);
    send(client_fd, response, strlen(response), 0);
    free(response);
}

void handle_book_flight(int client_fd, MessageHeader *header, void *payload) {
    // Payload is JSON string from client
    char *json_payload = (char *)payload;
    
    // Call database API
    char *response = call_database_api("POST", "/api/bookings", json_payload);
    
    if (!response) {
        send_error_response(client_fd, MSG_BOOK_FLIGHT_RES, STATUS_INTERNAL_ERROR, "Database service unavailable");
        return;
    }
    
    MessageHeader res_header;
    init_response_header(&res_header, MSG_BOOK_FLIGHT_RES, STATUS_SUCCESS, strlen(response), header->session_id, header->request_id);
    send(client_fd, &res_header, MESSAGE_HEADER_SIZE, 0);
    send(client_fd, response, strlen(response), 0);
    free(response);
}

void handle_list_tickets(int client_fd, MessageHeader *header, void *payload) {
    // Payload contains user_id as JSON
    cJSON *json = cJSON_Parse((char *)payload);
    int user_id = 0;
    if (json) {
        cJSON *uid = cJSON_GetObjectItem(json, "user_id");
        if (uid) user_id = uid->valueint;
        cJSON_Delete(json);
    }
    
    char endpoint[128];
    snprintf(endpoint, sizeof(endpoint), "/api/users/%d/tickets", user_id);
    
    char *response = call_database_api("GET", endpoint, NULL);
    
    if (!response) {
        send_error_response(client_fd, MSG_LIST_TICKETS_RES, STATUS_INTERNAL_ERROR, "Database service unavailable");
        return;
    }
    
    MessageHeader res_header;
    init_response_header(&res_header, MSG_LIST_TICKETS_RES, STATUS_SUCCESS, strlen(response), header->session_id, header->request_id);
    send(client_fd, &res_header, MESSAGE_HEADER_SIZE, 0);
    send(client_fd, response, strlen(response), 0);
    free(response);
}

void handle_payment(int client_fd, MessageHeader *header, void *payload) {
    char *json_payload = (char *)payload;
    
    char *response = call_database_api("POST", "/api/payments", json_payload);
    
    if (!response) {
        send_error_response(client_fd, MSG_PAYMENT_RES, STATUS_INTERNAL_ERROR, "Database service unavailable");
        return;
    }
    
    MessageHeader res_header;
    init_response_header(&res_header, MSG_PAYMENT_RES, STATUS_SUCCESS, strlen(response), header->session_id, header->request_id);
    send(client_fd, &res_header, MESSAGE_HEADER_SIZE, 0);
    send(client_fd, response, strlen(response), 0);
    free(response);
}

void handle_send_ticket_email(int client_fd, MessageHeader *header, void *payload) {
    // Payload is JSON: { booking_id, email }
    char *json_payload = (char *)payload;
    char *response = call_database_api("POST", "/api/tickets/send_email", json_payload);
    if (!response) {
        send_error_response(client_fd, MSG_SEND_TICKET_EMAIL_RES, STATUS_INTERNAL_ERROR, "Database service unavailable");
        return;
    }
    MessageHeader res_header; init_response_header(&res_header, MSG_SEND_TICKET_EMAIL_RES, STATUS_SUCCESS, strlen(response), header->session_id, header->request_id);
    send(client_fd, &res_header, MESSAGE_HEADER_SIZE, 0);
    send(client_fd, response, strlen(response), 0);
    free(response);
}

void handle_cancel_ticket(int client_fd, MessageHeader *header, void *payload) {
    // Payload contains booking_id as JSON
    cJSON *json = cJSON_Parse((char *)payload);
    int booking_id = 0;
    if (json) {
        cJSON *bid = cJSON_GetObjectItem(json, "booking_id");
        if (bid) booking_id = bid->valueint;
        cJSON_Delete(json);
    }

    char endpoint[128];
    snprintf(endpoint, sizeof(endpoint), "/api/bookings/%d/cancel", booking_id);
    char *response = call_database_api("POST", endpoint, "{}");
    if (!response) {
        send_error_response(client_fd, MSG_CANCEL_TICKET_RES, STATUS_INTERNAL_ERROR, "Database service unavailable");
        return;
    }
    MessageHeader res_header;
    init_response_header(&res_header, MSG_CANCEL_TICKET_RES, STATUS_SUCCESS, strlen(response), header->session_id, header->request_id);
    send(client_fd, &res_header, MESSAGE_HEADER_SIZE, 0);
    send(client_fd, response, strlen(response), 0);
    free(response);
}

void handle_get_airports(int client_fd, MessageHeader *header) {
    char *response = call_database_api("GET", "/api/airports", NULL);
    
    if (!response) {
        send_error_response(client_fd, MSG_GET_AIRPORTS_RES, STATUS_INTERNAL_ERROR, "Database service unavailable");
        return;
    }
    
    MessageHeader res_header;
    init_response_header(&res_header, MSG_GET_AIRPORTS_RES, STATUS_SUCCESS, strlen(response), header->session_id, header->request_id);
    send(client_fd, &res_header, MESSAGE_HEADER_SIZE, 0);
    send(client_fd, response, strlen(response), 0);
    free(response);
}

void handle_get_aircrafts(int client_fd, MessageHeader *header) {
    char *response = call_database_api("GET", "/api/aircrafts", NULL);
    if (!response) {
        send_error_response(client_fd, MSG_GET_AIRCRAFTS_RES, STATUS_INTERNAL_ERROR, "Database service unavailable");
        return;
    }
    MessageHeader res_header;
    init_response_header(&res_header, MSG_GET_AIRCRAFTS_RES, STATUS_SUCCESS, strlen(response), header->session_id, header->request_id);
    send(client_fd, &res_header, MESSAGE_HEADER_SIZE, 0);
    send(client_fd, response, strlen(response), 0);
    free(response);
}

void handle_admin_list_flights(int client_fd, MessageHeader *header) {
    char *response = call_database_api("GET", "/api/admin/flights", NULL);
    if (!response) { send_error_response(client_fd, MSG_ADMIN_LIST_FLIGHTS_RES, STATUS_INTERNAL_ERROR, "Database service unavailable"); return; }
    MessageHeader res_header; init_response_header(&res_header, MSG_ADMIN_LIST_FLIGHTS_RES, STATUS_SUCCESS, strlen(response), header->session_id, header->request_id);
    send(client_fd, &res_header, MESSAGE_HEADER_SIZE, 0); send(client_fd, response, strlen(response), 0); free(response);
}

void handle_admin_get_logs(int client_fd, MessageHeader *header, void *payload) {
    cJSON *json = cJSON_Parse((char *)payload);
    const char *query = NULL; if (json) { cJSON *q = cJSON_GetObjectItem(json, "query"); if (q && cJSON_IsString(q)) query = q->valuestring; }
    char endpoint[256];
    if (query && strlen(query) > 0) snprintf(endpoint, sizeof(endpoint), "/api/systemlogs?%s", query);
    else snprintf(endpoint, sizeof(endpoint), "/api/systemlogs");
    char *response = call_database_api("GET", endpoint, NULL);
    if (json) cJSON_Delete(json);
    if (!response) { send_error_response(client_fd, MSG_ADMIN_GET_LOGS_RES, STATUS_INTERNAL_ERROR, "Database service unavailable"); return; }
    MessageHeader res_header; init_response_header(&res_header, MSG_ADMIN_GET_LOGS_RES, STATUS_SUCCESS, strlen(response), header->session_id, header->request_id);
    send(client_fd, &res_header, MESSAGE_HEADER_SIZE, 0); send(client_fd, response, strlen(response), 0); free(response);
}
void handle_admin_flight_details(int client_fd, MessageHeader *header, void *payload) {
    cJSON *json = cJSON_Parse((char *)payload);
    int flight_id = 0; if (json) { cJSON *fid = cJSON_GetObjectItem(json, "flight_id"); if (fid) flight_id = fid->valueint; }
    char endpoint[128]; snprintf(endpoint, sizeof(endpoint), "/api/admin/flights/%d/details", flight_id);
    char *response = call_database_api("GET", endpoint, NULL);
    if (json) cJSON_Delete(json);
    if (!response) { send_error_response(client_fd, MSG_ADMIN_FLIGHT_DETAILS_RES, STATUS_INTERNAL_ERROR, "Database service unavailable"); return; }
    MessageHeader res_header; init_response_header(&res_header, MSG_ADMIN_FLIGHT_DETAILS_RES, STATUS_SUCCESS, strlen(response), header->session_id, header->request_id);
    send(client_fd, &res_header, MESSAGE_HEADER_SIZE, 0); send(client_fd, response, strlen(response), 0); free(response);
}

void handle_admin_add_flight(int client_fd, MessageHeader *header, void *payload) {
    char *json_payload = (char *)payload;
    char *response = call_database_api("POST", "/api/admin/flights", json_payload);
    if (!response) { send_error_response(client_fd, MSG_ADMIN_ADD_FLIGHT_RES, STATUS_INTERNAL_ERROR, "Database service unavailable"); return; }
    MessageHeader res_header; init_response_header(&res_header, MSG_ADMIN_ADD_FLIGHT_RES, STATUS_SUCCESS, strlen(response), header->session_id, header->request_id);
    send(client_fd, &res_header, MESSAGE_HEADER_SIZE, 0); send(client_fd, response, strlen(response), 0); free(response);
}

void handle_admin_update_flight(int client_fd, MessageHeader *header, void *payload) {
    cJSON *json = cJSON_Parse((char *)payload);
    int flight_id = 0; if (json) { cJSON *fid = cJSON_GetObjectItem(json, "flight_id"); if (fid) flight_id = fid->valueint; }
    char endpoint[128]; snprintf(endpoint, sizeof(endpoint), "/api/admin/flights/%d", flight_id);
    char *response = call_database_api("PUT", endpoint, (char *)payload);
    if (json) cJSON_Delete(json);
    if (!response) { send_error_response(client_fd, MSG_ADMIN_UPDATE_FLIGHT_RES, STATUS_INTERNAL_ERROR, "Database service unavailable"); return; }
    MessageHeader res_header; init_response_header(&res_header, MSG_ADMIN_UPDATE_FLIGHT_RES, STATUS_SUCCESS, strlen(response), header->session_id, header->request_id);
    send(client_fd, &res_header, MESSAGE_HEADER_SIZE, 0); send(client_fd, response, strlen(response), 0); free(response);
}

void handle_admin_delete_flight(int client_fd, MessageHeader *header, void *payload) {
    cJSON *json = cJSON_Parse((char *)payload);
    int flight_id = 0; if (json) { cJSON *fid = cJSON_GetObjectItem(json, "flight_id"); if (fid) flight_id = fid->valueint; }
    int user_id = 0; if (json) { cJSON *uid = cJSON_GetObjectItem(json, "user_id"); if (uid) user_id = uid->valueint; }
    char endpoint[160];
    if (user_id > 0) {
        snprintf(endpoint, sizeof(endpoint), "/api/admin/flights/%d?user_id=%d", flight_id, user_id);
    } else {
        snprintf(endpoint, sizeof(endpoint), "/api/admin/flights/%d", flight_id);
    }
    char *response = call_database_api("DELETE", endpoint, NULL);
    if (json) cJSON_Delete(json);
    if (!response) { send_error_response(client_fd, MSG_ADMIN_DELETE_FLIGHT_RES, STATUS_INTERNAL_ERROR, "Database service unavailable"); return; }
    MessageHeader res_header; init_response_header(&res_header, MSG_ADMIN_DELETE_FLIGHT_RES, STATUS_SUCCESS, strlen(response), header->session_id, header->request_id);
    send(client_fd, &res_header, MESSAGE_HEADER_SIZE, 0); send(client_fd, response, strlen(response), 0); free(response);
}

// ============================================================================
// CLIENT HANDLER
// ============================================================================

void *handle_client(void *arg) {
    int client_fd = *((int *)arg);
    free(arg);
    
    MessageHeader header;
    char buffer[BUFFER_SIZE];
    
    printf("[Server] Client connected (fd=%d)\n", client_fd);
    
    while (server_running) {
        // Receive header
        ssize_t received = recv(client_fd, &header, MESSAGE_HEADER_SIZE, MSG_WAITALL);
        if (received <= 0) {
            break;
        }
        
        // Receive payload if exists
        void *payload = NULL;
        if (header.payload_length > 0 && header.payload_length < BUFFER_SIZE) {
            payload = malloc(header.payload_length + 1);
            received = recv(client_fd, payload, header.payload_length, MSG_WAITALL);
            if (received <= 0) {
                free(payload);
                break;
            }
            ((char *)payload)[header.payload_length] = '\0';
        }
        
        printf("[Server] Received message type: 0x%04X, payload_len: %u\n", 
               header.message_type, header.payload_length);
        
        // Handle message by type
        switch (header.message_type) {
            case MSG_LOGIN_REQ:
                handle_login(client_fd, &header, payload);
                break;
            case MSG_REGISTER_REQ:
                handle_register(client_fd, &header, payload);
                break;
            case MSG_SEARCH_FLIGHTS_REQ:
                handle_search_flights(client_fd, &header, payload);
                break;
            case MSG_BOOK_FLIGHT_REQ:
                handle_book_flight(client_fd, &header, payload);
                break;
            case MSG_LIST_TICKETS_REQ:
                handle_list_tickets(client_fd, &header, payload);
                break;
            case MSG_PAYMENT_REQ:
                handle_payment(client_fd, &header, payload);
                break;
            case MSG_CANCEL_TICKET_REQ:
                handle_cancel_ticket(client_fd, &header, payload);
                break;
            case MSG_SEND_TICKET_EMAIL_REQ:
                handle_send_ticket_email(client_fd, &header, payload);
                break;
            case MSG_GET_AIRPORTS_REQ:
                handle_get_airports(client_fd, &header);
                break;
            case MSG_GET_AIRCRAFTS_REQ:
                handle_get_aircrafts(client_fd, &header);
                break;
            case MSG_ADMIN_LIST_FLIGHTS_REQ:
                handle_admin_list_flights(client_fd, &header);
                break;
            case MSG_ADMIN_ADD_FLIGHT_REQ:
                handle_admin_add_flight(client_fd, &header, payload);
                break;
            case MSG_ADMIN_UPDATE_FLIGHT_REQ:
                handle_admin_update_flight(client_fd, &header, payload);
                break;
            case MSG_ADMIN_DELETE_FLIGHT_REQ:
                handle_admin_delete_flight(client_fd, &header, payload);
                break;
            case MSG_ADMIN_FLIGHT_DETAILS_REQ:
                handle_admin_flight_details(client_fd, &header, payload);
                break;
            case MSG_ADMIN_GET_LOGS_REQ:
                handle_admin_get_logs(client_fd, &header, payload);
                break;
            default:
                printf("[Server] Unknown message type: 0x%04X\n", header.message_type);
                send_error_response(client_fd, MSG_ERROR, STATUS_BAD_REQUEST, "Unknown message type");
        }
        
        if (payload) free(payload);
    }
    
    printf("[Server] Client disconnected (fd=%d)\n", client_fd);
    close(client_fd);
    return NULL;
}

// ============================================================================
// MAIN
// ============================================================================

int main() {
    int server_fd, client_fd;
    struct sockaddr_in server_addr, client_addr;
    socklen_t client_len = sizeof(client_addr);
    pthread_t thread_id;
    
    // Setup signal handler
    signal(SIGINT, signal_handler);
    signal(SIGTERM, signal_handler);
    
    // Create socket
    server_fd = socket(AF_INET, SOCK_STREAM, 0);
    if (server_fd < 0) {
        perror("Socket creation failed");
        exit(EXIT_FAILURE);
    }
    
    // Set socket options
    int opt = 1;
    setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));
    
    // Configure server address
    memset(&server_addr, 0, sizeof(server_addr));
    server_addr.sin_family = AF_INET;
    server_addr.sin_addr.s_addr = INADDR_ANY;
    server_addr.sin_port = htons(SERVER_PORT);
    
    // Bind socket
    if (bind(server_fd, (struct sockaddr *)&server_addr, sizeof(server_addr)) < 0) {
        perror("Bind failed");
        close(server_fd);
        exit(EXIT_FAILURE);
    }
    
    // Listen
    if (listen(server_fd, MAX_CLIENTS) < 0) {
        perror("Listen failed");
        close(server_fd);
        exit(EXIT_FAILURE);
    }
    
    printf("==================================================\n");
    printf("Flight Booking Server - TCP Server\n");
    printf("==================================================\n");
    printf("Listening on port %d\n", SERVER_PORT);
    printf("Database Service: %s\n", DB_SERVICE_URL);
    printf("==================================================\n");
    printf("Press Ctrl+C to stop\n\n");
    
    // Accept connections
    while (server_running) {
        client_fd = accept(server_fd, (struct sockaddr *)&client_addr, &client_len);
        if (client_fd < 0) {
            if (server_running) perror("Accept failed");
            continue;
        }
        
        printf("[Server] New connection from %s:%d\n",
               inet_ntoa(client_addr.sin_addr), ntohs(client_addr.sin_port));
        
        int *client_socket = malloc(sizeof(int));
        *client_socket = client_fd;
        
        if (pthread_create(&thread_id, NULL, handle_client, client_socket) != 0) {
            perror("Thread creation failed");
            free(client_socket);
            close(client_fd);
        }
        pthread_detach(thread_id);
    }
    
    close(server_fd);
    printf("Server stopped.\n");
    return 0;
}
