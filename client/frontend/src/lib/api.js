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

export async function login(username, password) {
  return request('/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

// ============================================================================
// FLIGHTS API
// ============================================================================

export async function searchFlights(origin = 0, destination = 0) {
  const params = new URLSearchParams();
  if (origin) params.append('origin', origin);
  if (destination) params.append('destination', destination);
  
  return request(`/flights?${params.toString()}`);
}

export async function getAirports() {
  return request('/airports');
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

export default {
  login,
  searchFlights,
  getAirports,
  createBooking,
  getUserTickets,
  processPayment,
};

