/**
 * Flight Booking Client - HTTP Server + TCP Client
 * Port: 3001
 * 
 * - HTTP Server (Mongoose) nhận request từ React Frontend
 * - TCP Client gửi binary message đến Server Backend
 * - Trả JSON response về Frontend
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <arpa/inet.h>
#include <sys/socket.h>
#include <signal.h>

#include "mongoose.h"
#include "cJSON.h"
#include "common.h"

#define HTTP_PORT "3001"
#define SERVER_HOST "127.0.0.1"
#define SERVER_PORT 8082
#define BUFFER_SIZE 65536

static int running = 1;
static uint32_t request_counter = 0;

// Signal handler
void signal_handler(int sig) {
    printf("\nShutting down client...\n");
    running = 0;
}

// ============================================================================
// TCP CLIENT
// ============================================================================

int connect_to_server() {
    int sock_fd = socket(AF_INET, SOCK_STREAM, 0);
    if (sock_fd < 0) {
        perror("Socket creation failed");
        return -1;
    }
    
    // Set timeout
    struct timeval tv;
    tv.tv_sec = 10;
    tv.tv_usec = 0;
    setsockopt(sock_fd, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof(tv));
    setsockopt(sock_fd, SOL_SOCKET, SO_SNDTIMEO, &tv, sizeof(tv));
    
    struct sockaddr_in server_addr;
    memset(&server_addr, 0, sizeof(server_addr));
    server_addr.sin_family = AF_INET;
    server_addr.sin_port = htons(SERVER_PORT);
    inet_pton(AF_INET, SERVER_HOST, &server_addr.sin_addr);
    
    if (connect(sock_fd, (struct sockaddr *)&server_addr, sizeof(server_addr)) < 0) {
        perror("Connect to server failed");
        close(sock_fd);
        return -1;
    }
    
    printf("[Client] Connected to server %s:%d\n", SERVER_HOST, SERVER_PORT);
    return sock_fd;
}

char *send_to_server(uint16_t msg_type, const void *payload, uint32_t payload_len, uint32_t session_id) {
    int sock_fd = connect_to_server();
    if (sock_fd < 0) {
        return strdup("{\"success\":false,\"message\":\"Cannot connect to server\"}");
    }
    
    // Send request
    MessageHeader header;
    init_request_header(&header, msg_type, payload_len, session_id, ++request_counter);
    
    printf("[Client] Sending message type=0x%04X, payload_len=%u\n", msg_type, payload_len);
    
    ssize_t sent = send(sock_fd, &header, MESSAGE_HEADER_SIZE, 0);
    if (sent != MESSAGE_HEADER_SIZE) {
        printf("[Client] Failed to send header\n");
        close(sock_fd);
        return strdup("{\"success\":false,\"message\":\"Failed to send header\"}");
    }
    
    if (payload_len > 0 && payload) {
        sent = send(sock_fd, payload, payload_len, 0);
        if (sent != (ssize_t)payload_len) {
            printf("[Client] Failed to send payload\n");
            close(sock_fd);
            return strdup("{\"success\":false,\"message\":\"Failed to send payload\"}");
        }
    }
    
    printf("[Client] Waiting for response...\n");
    
    // Receive response
    MessageHeader res_header;
    ssize_t received = recv(sock_fd, &res_header, MESSAGE_HEADER_SIZE, MSG_WAITALL);
    if (received <= 0) {
        printf("[Client] No response received (recv=%zd)\n", received);
        close(sock_fd);
        return strdup("{\"success\":false,\"message\":\"No response from server\"}");
    }
    
    printf("[Client] Received response type=0x%04X, status=%d, payload_len=%u\n",
           res_header.message_type, res_header.status_code, res_header.payload_length);
    
    char *response = NULL;
    if (res_header.payload_length > 0 && res_header.payload_length < BUFFER_SIZE) {
        response = malloc(res_header.payload_length + 1);
        received = recv(sock_fd, response, res_header.payload_length, MSG_WAITALL);
        if (received > 0) {
            response[received] = '\0';
            printf("[Client] Response body: %.100s...\n", response);
        } else {
            free(response);
            response = strdup("{\"success\":false,\"message\":\"Failed to receive response body\"}");
        }
    } else {
        response = strdup("{\"success\":true}");
    }
    
    close(sock_fd);
    return response;
}

// ============================================================================
// HTTP HANDLERS
// ============================================================================

void send_cors_headers(struct mg_connection *c) {
    mg_printf(c, "Access-Control-Allow-Origin: *\r\n");
    mg_printf(c, "Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS\r\n");
    mg_printf(c, "Access-Control-Allow-Headers: Content-Type\r\n");
}

void send_json_response(struct mg_connection *c, int status, const char *json) {
    if (json == NULL) {
        json = "{\"success\":false,\"message\":\"NULL response\"}";
    }
    size_t len = strlen(json);
    printf("[Client] Sending response (len=%zu): %.100s\n", len, json);
    fflush(stdout);
    
    mg_printf(c, "HTTP/1.1 %d OK\r\n", status);
    send_cors_headers(c);
    mg_printf(c, "Content-Type: application/json\r\n");
    mg_printf(c, "Content-Length: %d\r\n\r\n", (int)len);
    mg_send(c, json, len);
}

// POST /api/login
void handle_login(struct mg_connection *c, struct mg_http_message *hm) {
    printf("[Client] handle_login called, body_len=%zu\n", hm->body.len);
    fflush(stdout);
    
    // Parse JSON body
    cJSON *json = cJSON_ParseWithLength(hm->body.buf, hm->body.len);
    if (!json) {
        printf("[Client] Invalid JSON body\n");
        send_json_response(c, 400, "{\"success\":false,\"message\":\"Invalid JSON\"}");
        return;
    }
    
    cJSON *username = cJSON_GetObjectItem(json, "username");
    cJSON *password = cJSON_GetObjectItem(json, "password");
    
    if (!username || !password) {
        printf("[Client] Missing username or password\n");
        cJSON_Delete(json);
        send_json_response(c, 400, "{\"success\":false,\"message\":\"Missing username or password\"}");
        return;
    }
    
    printf("[Client] Login attempt: %s\n", username->valuestring);
    
    // Create LoginRequest
    LoginRequest req;
    memset(&req, 0, sizeof(req));
    strncpy(req.username, username->valuestring, sizeof(req.username) - 1);
    strncpy(req.password, password->valuestring, sizeof(req.password) - 1);
    cJSON_Delete(json);
    
    // Send to server
    char *response = send_to_server(MSG_LOGIN_REQ, &req, sizeof(req), 0);
    printf("[Client] Got response from server, sending to frontend\n");
    send_json_response(c, 200, response);
    free(response);
}

// POST api/register
void handle_register(struct mg_connection *c, struct mg_http_message *hm) {
    printf("[Client] handle_register called, body_len=%zu\n", hm->body.len);
    printf("[Client] Body content: %.*s\n", (int)hm->body.len, hm->body.buf);
    fflush(stdout);
    
    // Forward JSON body directly to server
    cJSON *json = cJSON_ParseWithLength(hm->body.buf, hm->body.len);
    if (!json) {
        printf("[Client] Invalid JSON body\n");
        send_json_response(c, 400, "{\"success\":false,\"message\":\"Invalid JSON\"}");
        return;
    }
    
    cJSON *username = cJSON_GetObjectItem(json, "username");
    cJSON *password = cJSON_GetObjectItem(json, "password");
    cJSON *email = cJSON_GetObjectItem(json, "email");
    cJSON *full_name = cJSON_GetObjectItem(json, "full_name");
    cJSON *phone = cJSON_GetObjectItem(json, "phone");
    if (!username || !password || !email) {
        printf("[Client] Missing required fields\n");
        cJSON_Delete(json);
        send_json_response(c, 400, "{\"success\":false,\"message\":\"Missing required fields\"}");
        return;
    }

    // Create register request
    RegisterRequest req;
    memset(&req, 0, sizeof(req));
    strncpy(req.username, username->valuestring, sizeof(req.username) - 1);
    strncpy(req.password, password->valuestring, sizeof(req.password) - 1);
    if (full_name) {
        strncpy(req.full_name, full_name->valuestring, sizeof(req.full_name) - 1);
    }
    if (email) {
        strncpy(req.email, email->valuestring, sizeof(req.email) - 1);
    }
    if (phone) {
        strncpy(req.phone, phone->valuestring, sizeof(req.phone) - 1);
    }
    cJSON_Delete(json);
    
    // Send to server
    char *response = send_to_server(MSG_REGISTER_REQ, &req, sizeof(req), 0);
    printf("[Client] Got response from server, sending to frontend\n");
    send_json_response(c, 200, response);
    free(response);
}

// GET /api/flights
void handle_search_flights(struct mg_connection *c, struct mg_http_message *hm) {
    // Parse query params
    char origin_id_str[10] = "0";
    char dest_id_str[10] = "0";
    char start_date[12] = "";
    char end_date[12] = "";
    char passenger_str[10] = "1";

    // 2. Lấy tham số từ Query String URL
    // Ví dụ: /api/flights?origin_id=1&dest_id=2&start_date=2024-10-20&end_date=2024-10-25
    mg_http_get_var(&hm->query, "origin_id", origin_id_str, sizeof(origin_id_str));
    mg_http_get_var(&hm->query, "dest_id", dest_id_str, sizeof(dest_id_str));
    mg_http_get_var(&hm->query, "start_date", start_date, sizeof(start_date));
    mg_http_get_var(&hm->query, "end_date", end_date, sizeof(end_date));
    mg_http_get_var(&hm->query, "passengers", passenger_str, sizeof(passenger_str));
    mg_http_get_var(&hm->query, "passenger_count", passenger_str, sizeof(passenger_str)); // Hỗ trợ cả hai tên tham số

    // 3. Đổ dữ liệu vào Struct
    SearchFlightsRequest req;
    memset(&req, 0, sizeof(req));
    
    req.origin_airport_id = atoi(origin_id_str);      // Chuyển chuỗi sang số int
    req.destination_airport_id = atoi(dest_id_str);   // Chuyển chuỗi sang số int
    req.passenger_count = atoi(passenger_str);
    
    // Copy ngày tháng
    strncpy(req.start_date, start_date, sizeof(req.start_date) - 1);
    strncpy(req.end_date, end_date, sizeof(req.end_date) - 1);

    // 4. Gửi sang Server Backend
    char *response = send_to_server(MSG_SEARCH_FLIGHTS_REQ, &req, sizeof(req), 0);
    send_json_response(c, 200, response);
    free(response);
}

// POST /api/bookings
void handle_create_booking(struct mg_connection *c, struct mg_http_message *hm) {
    // Forward JSON body directly to server
    char *body = malloc(hm->body.len + 1);
    memcpy(body, hm->body.buf, hm->body.len);
    body[hm->body.len] = '\0';
    
    char *response = send_to_server(MSG_BOOK_FLIGHT_REQ, body, strlen(body), 0);
    send_json_response(c, 200, response);
    free(body);
    free(response);
}

// GET /api/tickets?user_id=X
void handle_get_tickets(struct mg_connection *c, struct mg_http_message *hm) {
    char user_id_str[16] = "0";
    mg_http_get_var(&hm->query, "user_id", user_id_str, sizeof(user_id_str));
    
    // Create JSON payload with user_id
    cJSON *json = cJSON_CreateObject();
    cJSON_AddNumberToObject(json, "user_id", atoi(user_id_str));
    char *payload = cJSON_PrintUnformatted(json);
    cJSON_Delete(json);
    
    char *response = send_to_server(MSG_LIST_TICKETS_REQ, payload, strlen(payload), 0);
    send_json_response(c, 200, response);
    free(payload);
    free(response);
}

// POST /api/payments
void handle_payment(struct mg_connection *c, struct mg_http_message *hm) {
    char *body = malloc(hm->body.len + 1);
    memcpy(body, hm->body.buf, hm->body.len);
    body[hm->body.len] = '\0';
    
    char *response = send_to_server(MSG_PAYMENT_REQ, body, strlen(body), 0);
    send_json_response(c, 200, response);
    free(body);
    free(response);
}

// POST /api/bookings/cancel
void handle_cancel_booking(struct mg_connection *c, struct mg_http_message *hm) {
    char *body = malloc(hm->body.len + 1);
    memcpy(body, hm->body.buf, hm->body.len);
    body[hm->body.len] = '\0';
    char *response = send_to_server(MSG_CANCEL_TICKET_REQ, body, strlen(body), 0);
    send_json_response(c, 200, response);
    free(body);
    free(response);
}

// GET /api/airports
void handle_get_airports(struct mg_connection *c, struct mg_http_message *hm) {
    char *response = send_to_server(MSG_GET_AIRPORTS_REQ, NULL, 0, 0);
    send_json_response(c, 200, response);
    free(response);
}

// GET /api/aircrafts
void handle_get_aircrafts(struct mg_connection *c, struct mg_http_message *hm) {
    char *response = send_to_server(MSG_GET_AIRCRAFTS_REQ, NULL, 0, 0);
    send_json_response(c, 200, response);
    free(response);
}

// Admin: GET /api/systemlogs
void handle_admin_get_logs(struct mg_connection *c, struct mg_http_message *hm) {
    // Forward query string as-is via payload
    char *payload = NULL;
    if (hm->query.len > 0) {
        cJSON *json = cJSON_CreateObject();
        char *q = (char *)malloc(hm->query.len + 1);
        memcpy(q, hm->query.buf, hm->query.len); q[hm->query.len] = '\0';
        cJSON_AddStringToObject(json, "query", q);
        payload = cJSON_PrintUnformatted(json);
        free(q);
        cJSON_Delete(json);
    }
    char *response = send_to_server(MSG_ADMIN_GET_LOGS_REQ, payload ? payload : NULL, payload ? strlen(payload) : 0, 0);
    send_json_response(c, 200, response);
    if (payload) free(payload);
    free(response);
}

// Admin: GET /api/admin/flights
void handle_admin_list_flights(struct mg_connection *c, struct mg_http_message *hm) {
    char *response = send_to_server(MSG_ADMIN_LIST_FLIGHTS_REQ, NULL, 0, 0);
    send_json_response(c, 200, response);
    free(response);
}

// Admin: POST /api/admin/flights
void handle_admin_create_flight(struct mg_connection *c, struct mg_http_message *hm) {
    char *body = malloc(hm->body.len + 1);
    memcpy(body, hm->body.buf, hm->body.len);
    body[hm->body.len] = '\0';
    char *response = send_to_server(MSG_ADMIN_ADD_FLIGHT_REQ, body, strlen(body), 0);
    send_json_response(c, 200, response);
    free(body);
    free(response);
}

static int parse_flight_id_from_uri(struct mg_http_message *hm) {
    char path[256];
    int len = (int)(hm->uri.len < sizeof(path) - 1 ? hm->uri.len : sizeof(path) - 1);
    memcpy(path, hm->uri.buf, len);
    path[len] = '\0';
    int id = 0;
    if (sscanf(path, "/api/admin/flights/%d", &id) == 1) return id;
    return 0;
}

// Admin: GET /api/admin/flights/{id}/details
void handle_admin_flight_details(struct mg_connection *c, struct mg_http_message *hm) {
    int id = parse_flight_id_from_uri(hm);
    if (id <= 0) { send_json_response(c, 400, "{\"success\":false,\"message\":\"Invalid path\"}"); return; }
    cJSON *json = cJSON_CreateObject();
    cJSON_AddNumberToObject(json, "flight_id", id);
    char *payload = cJSON_PrintUnformatted(json);
    cJSON_Delete(json);
    char *response = send_to_server(MSG_ADMIN_FLIGHT_DETAILS_REQ, payload, strlen(payload), 0);
    send_json_response(c, 200, response);
    free(payload);
    free(response);
}

// Admin: PUT /api/admin/flights/{id}
void handle_admin_update_flight(struct mg_connection *c, struct mg_http_message *hm) {
    int id = parse_flight_id_from_uri(hm);
    if (id <= 0) { send_json_response(c, 400, "{\"success\":false,\"message\":\"Invalid path\"}"); return; }

    cJSON *json = cJSON_ParseWithLength(hm->body.buf, hm->body.len);
    if (!json) { send_json_response(c, 400, "{\"success\":false,\"message\":\"Invalid JSON\"}"); return; }
    cJSON_AddNumberToObject(json, "flight_id", id);
    char *payload = cJSON_PrintUnformatted(json);
    cJSON_Delete(json);
    char *response = send_to_server(MSG_ADMIN_UPDATE_FLIGHT_REQ, payload, strlen(payload), 0);
    send_json_response(c, 200, response);
    free(payload);
    free(response);
}

// Admin: DELETE /api/admin/flights/{id}
void handle_admin_delete_flight(struct mg_connection *c, struct mg_http_message *hm) {
    int id = parse_flight_id_from_uri(hm);
    if (id <= 0) { send_json_response(c, 400, "{\"success\":false,\"message\":\"Invalid path\"}"); return; }
    cJSON *json = cJSON_CreateObject();
    cJSON_AddNumberToObject(json, "flight_id", id);
    // Include user_id from query if provided for auditing
    char user_buf[32];
    int ulen = mg_http_get_var(&hm->query, "user_id", user_buf, sizeof(user_buf));
    if (ulen > 0) {
        int uid = atoi(user_buf);
        if (uid > 0) cJSON_AddNumberToObject(json, "user_id", uid);
    }
    char *payload = cJSON_PrintUnformatted(json);
    cJSON_Delete(json);
    char *response = send_to_server(MSG_ADMIN_DELETE_FLIGHT_REQ, payload, strlen(payload), 0);
    send_json_response(c, 200, response);
    free(payload);
    free(response);
}

// ============================================================================
// HTTP EVENT HANDLER
// ============================================================================

static void http_handler(struct mg_connection *c, int ev, void *ev_data) {
    if (ev == MG_EV_HTTP_MSG) {
        struct mg_http_message *hm = (struct mg_http_message *)ev_data;
        
        printf("[Client] HTTP event: %.*s %.*s (body_len=%zu)\n", 
               (int)hm->method.len, hm->method.buf,
               (int)hm->uri.len, hm->uri.buf,
               hm->body.len);
        fflush(stdout);
        
        // Handle CORS preflight
        if (mg_strcmp(hm->method, mg_str("OPTIONS")) == 0) {
            printf("[Client] Handling OPTIONS preflight\n");
            fflush(stdout);
            mg_printf(c, "HTTP/1.1 204 No Content\r\n");
            send_cors_headers(c);
            mg_printf(c, "\r\n");
            return;
        }
        
        printf("[Client] Processing: %.*s %.*s\n", (int)hm->method.len, hm->method.buf,
               (int)hm->uri.len, hm->uri.buf);
        fflush(stdout);
        
        // Route requests
        if (mg_match(hm->uri, mg_str("/api/login"), NULL) && 
            mg_strcmp(hm->method, mg_str("POST")) == 0) {
            handle_login(c, hm);
        }
        else if (mg_match(hm->uri, mg_str("/api/register"), NULL) && 
                 mg_strcmp(hm->method, mg_str("POST")) == 0) {
            handle_register(c, hm);
        }
        else if (mg_match(hm->uri, mg_str("/api/flights"), NULL) && 
                 mg_strcmp(hm->method, mg_str("GET")) == 0) {
            handle_search_flights(c, hm);
        }
        else if (mg_match(hm->uri, mg_str("/api/bookings"), NULL) && 
                 mg_strcmp(hm->method, mg_str("POST")) == 0) {
            handle_create_booking(c, hm);
        }
        else if (mg_match(hm->uri, mg_str("/api/tickets"), NULL) && 
                 mg_strcmp(hm->method, mg_str("GET")) == 0) {
            handle_get_tickets(c, hm);
        }
        else if (mg_match(hm->uri, mg_str("/api/payments"), NULL) && 
                 mg_strcmp(hm->method, mg_str("POST")) == 0) {
            handle_payment(c, hm);
        }
        else if (mg_match(hm->uri, mg_str("/api/bookings/cancel"), NULL) &&
                 mg_strcmp(hm->method, mg_str("POST")) == 0) {
            handle_cancel_booking(c, hm);
        }
        else if (mg_match(hm->uri, mg_str("/api/airports"), NULL) && 
                 mg_strcmp(hm->method, mg_str("GET")) == 0) {
            handle_get_airports(c, hm);
        }
        else if (mg_match(hm->uri, mg_str("/api/aircrafts"), NULL) &&
                 mg_strcmp(hm->method, mg_str("GET")) == 0) {
            handle_get_aircrafts(c, hm);
        }
        else if (mg_match(hm->uri, mg_str("/api/systemlogs"), NULL) &&
                 mg_strcmp(hm->method, mg_str("GET")) == 0) {
            handle_admin_get_logs(c, hm);
        }
        else if (mg_match(hm->uri, mg_str("/api/admin/flights"), NULL) &&
                 mg_strcmp(hm->method, mg_str("GET")) == 0) {
            handle_admin_list_flights(c, hm);
        }
        else if (mg_match(hm->uri, mg_str("/api/admin/flights"), NULL) &&
                 mg_strcmp(hm->method, mg_str("POST")) == 0) {
            handle_admin_create_flight(c, hm);
        }
        else if (mg_match(hm->uri, mg_str("/api/admin/flights/*"), NULL) &&
                 mg_strcmp(hm->method, mg_str("PUT")) == 0) {
            handle_admin_update_flight(c, hm);
        }
        else if (mg_match(hm->uri, mg_str("/api/admin/flights/*/details"), NULL) &&
                 mg_strcmp(hm->method, mg_str("GET")) == 0) {
            handle_admin_flight_details(c, hm);
        }
        else if (mg_match(hm->uri, mg_str("/api/admin/flights/*"), NULL) &&
                 mg_strcmp(hm->method, mg_str("DELETE")) == 0) {
            handle_admin_delete_flight(c, hm);
        }
        else if (mg_match(hm->uri, mg_str("/health"), NULL)) {
            send_json_response(c, 200, "{\"status\":\"ok\"}");
        }
        else {
            send_json_response(c, 404, "{\"success\":false,\"message\":\"Not found\"}");
        }
    }
}

// ============================================================================
// MAIN
// ============================================================================

int main() {
    struct mg_mgr mgr;
    struct mg_connection *c;
    
    signal(SIGINT, signal_handler);
    signal(SIGTERM, signal_handler);
    
    mg_mgr_init(&mgr);
    
    char listen_addr[32];
    snprintf(listen_addr, sizeof(listen_addr), "http://0.0.0.0:%s", HTTP_PORT);
    
    c = mg_http_listen(&mgr, listen_addr, http_handler, NULL);
    if (c == NULL) {
        fprintf(stderr, "Cannot start HTTP server on port %s\n", HTTP_PORT);
        return 1;
    }
    
    printf("==================================================\n");
    printf("Flight Booking Client - HTTP Server\n");
    printf("==================================================\n");
    printf("HTTP Server: http://localhost:%s\n", HTTP_PORT);
    printf("Server Backend: %s:%d\n", SERVER_HOST, SERVER_PORT);
    printf("==================================================\n");
    printf("Endpoints:\n");
    printf("  POST /api/login\n");
    printf("  GET  /api/flights\n");
    printf("  GET  /api/airports\n");
    printf("  POST /api/bookings\n");
    printf("  GET  /api/tickets?user_id=X\n");
    printf("  POST /api/payments\n");
    printf("  POST /api/bookings/cancel\n");
    printf("==================================================\n");
    printf("Press Ctrl+C to stop\n\n");
    
    while (running) {
        mg_mgr_poll(&mgr, 100);
    }
    
    mg_mgr_free(&mgr);
    printf("Client stopped.\n");
    return 0;
}
