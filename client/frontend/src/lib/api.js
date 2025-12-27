/**
 * API Helper for Flight Booking App
 * Connects to Client Backend at port 3001
 */

const API_BASE = '/api';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('API Error:', error);
    return { success: false, message: 'Không thể kết nối đến server' };
  }
}

// ============================================================================
// AUTH API
// ============================================================================

export async function register(userData) {
  return request('/register', {
    method: 'POST',
    body: JSON.stringify(userData),
  });
}

export async function login(username, password) {
  return request('/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

// ============================================================================
// FLIGHTS API
// ============================================================================

export async function searchFlights(originId, destId, startDate, endDate, passengers, classType) { 
  const params = new URLSearchParams({
      origin_id: originId,
      dest_id: destId,
      start_date: startDate || '',
      end_date: endDate || '',
      passengers: passengers || 1,
      class_type: classType || ''
  });
  return request(`/flights?${params.toString()}`, { method: 'GET' });
}

export async function getAirports() {
  return request('/airports');
}

export async function getAircrafts() {
  return request('/aircrafts');
}

// ============================================================================
// BOOKING API
// ============================================================================

export async function createBooking(userId, flightId, classType, passengers) {
  return request('/bookings', {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId,
      flight_id: flightId,
      class_type: classType,
      passengers,
    }),
  });
}

// ============================================================================
// TICKETS API
// ============================================================================

export async function getUserTickets(userId) {
  return request(`/tickets?user_id=${userId}`);
}

export async function sendTicketEmail(bookingId, email) {
  return request('/tickets/send_email', {
    method: 'POST',
    body: JSON.stringify({ booking_id: bookingId, email }),
  });
}

// ============================================================================
// PAYMENT API
// ============================================================================

export async function processPayment(bookingId, paymentMethod = 'CARD') {
  return request('/payments', {
    method: 'POST',
    body: JSON.stringify({
      booking_id: bookingId,
      payment_method: paymentMethod,
    }),
  });
}

export async function cancelBooking(bookingId) {
  return request('/bookings/cancel', {
    method: 'POST',
    body: JSON.stringify({ booking_id: bookingId }),
  });
}

// ============================================================================
// ADMIN API
// ============================================================================

export async function adminListFlights() {
  return request('/admin/flights', { method: 'GET' });
}

export async function adminCreateFlight(payload) {
  return request('/admin/flights', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function adminUpdateFlight(flightId, payload) {
  return request(`/admin/flights/${flightId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function adminDeleteFlight(flightId, userId) {
  // pass userId via query if needed
  const qs = userId ? `?user_id=${userId}` : '';
  return request(`/admin/flights/${flightId}${qs}`, { method: 'DELETE' });
}

export async function adminFlightDetails(flightId) {
  return request(`/admin/flights/${flightId}/details`, { method: 'GET' });
}

export async function getSystemLogs(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return request(`/systemlogs${qs ? `?${qs}` : ''}`, { method: 'GET' });
}

export default {
  register,
  login,
  searchFlights,
  getAirports,
  createBooking,
  getUserTickets,
  sendTicketEmail,
  processPayment,
  cancelBooking,
  adminListFlights,
  adminCreateFlight,
  adminUpdateFlight,
  adminDeleteFlight,
  adminFlightDetails,
  getSystemLogs,
};

