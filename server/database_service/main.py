"""
Flight Booking Database Service
Port: 5000
Flask HTTP API with SQLAlchemy
"""

import os
import hashlib
from datetime import datetime
from functools import wraps

from flask import Flask, request, jsonify
from flask_cors import CORS
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL not found in .env file")

# Setup Flask app
app = Flask(__name__)
CORS(app)

# Setup database connection
engine = create_engine(DATABASE_URL)

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def hash_password(password):
    """Hash password using SHA256"""
    return hashlib.sha256(password.encode()).hexdigest()

def get_db():
    """Get database connection"""
    return engine.connect()

# ============================================================================
# AUTH ENDPOINTS
# ============================================================================

@app.route('/api/login', methods=['POST'])
def login():
    """UC02: Đăng nhập"""
    data = request.get_json()
    username = data.get('username', '')
    password = data.get('password', '')
    
    if not username or not password:
        return jsonify({'success': False, 'message': 'Username và password là bắt buộc'}), 400
    
    password_hash = hash_password(password)
    
    with get_db() as conn:
        result = conn.execute(
            text("""SELECT id, username, full_name, email, phone, role 
                    FROM Users WHERE username = :username AND password_hash = :password_hash"""),
            {'username': username, 'password_hash': password_hash}
        ).fetchone()
        
        if result:
            return jsonify({
                'success': True,
                'user': {
                    'id': result[0],
                    'username': result[1],
                    'full_name': result[2],
                    'email': result[3],
                    'phone': result[4],
                    'role': result[5]
                }
            })
        else:
            return jsonify({'success': False, 'message': 'Sai tên đăng nhập hoặc mật khẩu'}), 401

# ============================================================================
# FLIGHT ENDPOINTS
# ============================================================================

@app.route('/api/flights', methods=['GET'])
def search_flights():
    """UC04: Tìm kiếm chuyến bay"""
    origin = request.args.get('origin', type=int)
    destination = request.args.get('destination', type=int)
    date = request.args.get('date')  # Format: YYYY-MM-DD
    
    with get_db() as conn:
        query = """
            SELECT 
                f.id, f.flight_code, f.departure_time, f.arrival_time, f.status,
                a.model as aircraft_model,
                o.id as origin_id, o.code as origin_code, o.name as origin_name, o.city as origin_city,
                d.id as dest_id, d.code as dest_code, d.name as dest_name, d.city as dest_city,
                (SELECT price FROM FlightClasses WHERE flight_id = f.id AND class_type = 'ECONOMY') as economy_price,
                (SELECT price FROM FlightClasses WHERE flight_id = f.id AND class_type = 'BUSINESS') as business_price,
                (SELECT total_seats - booked_seats FROM FlightClasses WHERE flight_id = f.id AND class_type = 'ECONOMY') as economy_available,
                (SELECT total_seats - booked_seats FROM FlightClasses WHERE flight_id = f.id AND class_type = 'BUSINESS') as business_available
            FROM Flights f
            JOIN Aircrafts a ON f.aircraft_id = a.id
            JOIN Airports o ON f.origin_airport_id = o.id
            JOIN Airports d ON f.destination_airport_id = d.id
            WHERE f.status != 'CANCELLED'
        """
        params = {}
        
        if origin:
            query += " AND f.origin_airport_id = :origin"
            params['origin'] = origin
        if destination:
            query += " AND f.destination_airport_id = :destination"
            params['destination'] = destination
        if date:
            query += " AND DATE(f.departure_time) = :date"
            params['date'] = date
            
        query += " ORDER BY f.departure_time"
        
        results = conn.execute(text(query), params).fetchall()
        
        flights = []
        for row in results:
            flights.append({
                'id': row[0],
                'flight_code': row[1],
                'departure_time': row[2].isoformat() if row[2] else None,
                'arrival_time': row[3].isoformat() if row[3] else None,
                'status': row[4],
                'aircraft_model': row[5],
                'origin': {
                    'id': row[6],
                    'code': row[7],
                    'name': row[8],
                    'city': row[9]
                },
                'destination': {
                    'id': row[10],
                    'code': row[11],
                    'name': row[12],
                    'city': row[13]
                },
                'economy_price': float(row[14]) if row[14] else 0,
                'business_price': float(row[15]) if row[15] else 0,
                'economy_available': row[16] or 0,
                'business_available': row[17] or 0
            })
        
        return jsonify({'success': True, 'flights': flights, 'count': len(flights)})

@app.route('/api/flights/<int:flight_id>', methods=['GET'])
def get_flight_detail(flight_id):
    """Chi tiết chuyến bay"""
    with get_db() as conn:
        # Get flight info
        flight = conn.execute(
            text("""
                SELECT 
                    f.id, f.flight_code, f.departure_time, f.arrival_time, f.status,
                    a.model as aircraft_model,
                    o.id as origin_id, o.code as origin_code, o.name as origin_name,
                    d.id as dest_id, d.code as dest_code, d.name as dest_name
                FROM Flights f
                JOIN Aircrafts a ON f.aircraft_id = a.id
                JOIN Airports o ON f.origin_airport_id = o.id
                JOIN Airports d ON f.destination_airport_id = d.id
                WHERE f.id = :flight_id
            """),
            {'flight_id': flight_id}
        ).fetchone()
        
        if not flight:
            return jsonify({'success': False, 'message': 'Chuyến bay không tồn tại'}), 404
        
        # Get classes info
        classes = conn.execute(
            text("""
                SELECT id, class_type, price, total_seats, booked_seats, info
                FROM FlightClasses WHERE flight_id = :flight_id
            """),
            {'flight_id': flight_id}
        ).fetchall()
        
        class_list = []
        for c in classes:
            class_list.append({
                'id': c[0],
                'class_type': c[1],
                'price': float(c[2]) if c[2] else 0,
                'total_seats': c[3],
                'booked_seats': c[4],
                'available_seats': c[3] - c[4],
                'info': c[5]
            })
        
        return jsonify({
            'success': True,
            'flight': {
                'id': flight[0],
                'flight_code': flight[1],
                'departure_time': flight[2].isoformat() if flight[2] else None,
                'arrival_time': flight[3].isoformat() if flight[3] else None,
                'status': flight[4],
                'aircraft_model': flight[5],
                'origin': {'id': flight[6], 'code': flight[7], 'name': flight[8]},
                'destination': {'id': flight[9], 'code': flight[10], 'name': flight[11]},
                'classes': class_list
            }
        })

@app.route('/api/airports', methods=['GET'])
def get_airports():
    """Lấy danh sách sân bay"""
    with get_db() as conn:
        results = conn.execute(text("SELECT id, code, name, city FROM Airports ORDER BY code")).fetchall()
        airports = [{'id': r[0], 'code': r[1], 'name': r[2], 'city': r[3]} for r in results]
        return jsonify({'success': True, 'airports': airports})

# ============================================================================
# BOOKING ENDPOINTS
# ============================================================================

@app.route('/api/bookings', methods=['POST'])
def create_booking():
    """UC06: Đặt vé máy bay"""
    data = request.get_json()
    user_id = data.get('user_id')
    flight_id = data.get('flight_id')
    class_type = data.get('class_type', 'ECONOMY')
    passengers = data.get('passengers', [])
    
    if not user_id or not flight_id or not passengers:
        return jsonify({'success': False, 'message': 'Thiếu thông tin bắt buộc'}), 400
    
    with get_db() as conn:
        trans = conn.begin()
        try:
            # Get class info and check availability
            class_info = conn.execute(
                text("""SELECT id, price, total_seats, booked_seats 
                        FROM FlightClasses 
                        WHERE flight_id = :flight_id AND class_type = :class_type"""),
                {'flight_id': flight_id, 'class_type': class_type}
            ).fetchone()
            
            if not class_info:
                return jsonify({'success': False, 'message': 'Hạng vé không tồn tại'}), 404
            
            class_id, price, total_seats, booked_seats = class_info
            available = total_seats - booked_seats
            
            if len(passengers) > available:
                return jsonify({'success': False, 'message': f'Chỉ còn {available} ghế trống'}), 400
            
            # Get available seats
            seats = conn.execute(
                text("""SELECT id, seat_number FROM FlightSeats 
                        WHERE class_type_id = :class_id AND status = 'AVAILABLE'
                        ORDER BY id LIMIT :count"""),
                {'class_id': class_id, 'count': len(passengers)}
            ).fetchall()
            
            if len(seats) < len(passengers):
                return jsonify({'success': False, 'message': 'Không đủ ghế trống'}), 400
            
            # Calculate total
            total_amount = float(price) * len(passengers)
            
            # Generate booking reference
            import random
            import string
            booking_ref = 'BK' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
            
            # Create booking
            conn.execute(
                text("""INSERT INTO Bookings (user_id, booking_date, total_amount, status, booking_reference)
                        VALUES (:user_id, NOW(), :total, 'PENDING', :ref)"""),
                {'user_id': user_id, 'total': total_amount, 'ref': booking_ref}
            )
            
            booking_id = conn.execute(text("SELECT lastval()")).scalar()
            
            # Create tickets and lock seats
            tickets = []
            for i, passenger in enumerate(passengers):
                seat_id, seat_number = seats[i]
                ticket_number = f'TKT-{booking_ref}-{i+1}'
                
                conn.execute(
                    text("""INSERT INTO Tickets (booking_id, flight_seat_id, passenger_name, 
                            passenger_ic_number, ticket_number, status)
                            VALUES (:booking_id, :seat_id, :name, :ic, :ticket_num, 'ACTIVE')"""),
                    {
                        'booking_id': booking_id,
                        'seat_id': seat_id,
                        'name': passenger.get('name', ''),
                        'ic': passenger.get('ic_number', ''),
                        'ticket_num': ticket_number
                    }
                )
                
                # Lock seat
                conn.execute(
                    text("UPDATE FlightSeats SET status = 'LOCKED' WHERE id = :seat_id"),
                    {'seat_id': seat_id}
                )
                
                tickets.append({
                    'ticket_number': ticket_number,
                    'seat_number': seat_number,
                    'passenger_name': passenger.get('name', '')
                })
            
            trans.commit()
            
            return jsonify({
                'success': True,
                'booking': {
                    'id': booking_id,
                    'booking_reference': booking_ref,
                    'total_amount': total_amount,
                    'status': 'PENDING',
                    'tickets': tickets
                }
            })
            
        except Exception as e:
            trans.rollback()
            return jsonify({'success': False, 'message': str(e)}), 500

# ============================================================================
# PAYMENT ENDPOINTS
# ============================================================================

@app.route('/api/payments', methods=['POST'])
def process_payment():
    """UC07: Thanh toán"""
    data = request.get_json()
    booking_id = data.get('booking_id')
    payment_method = data.get('payment_method', 'CARD')
    
    if not booking_id:
        return jsonify({'success': False, 'message': 'Thiếu booking_id'}), 400
    
    with get_db() as conn:
        trans = conn.begin()
        try:
            # Get booking info
            booking = conn.execute(
                text("SELECT id, total_amount, status FROM Bookings WHERE id = :id"),
                {'id': booking_id}
            ).fetchone()
            
            if not booking:
                return jsonify({'success': False, 'message': 'Booking không tồn tại'}), 404
            
            if booking[2] != 'PENDING':
                return jsonify({'success': False, 'message': 'Booking đã được xử lý'}), 400
            
            # Simulate payment (always success for demo)
            import random
            import string
            transaction_id = 'TXN-' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=10))
            
            # Create payment record
            conn.execute(
                text("""INSERT INTO Payments (booking_id, transaction_date, transaction_id, amount, status)
                        VALUES (:booking_id, NOW(), :txn_id, :amount, 'SUCCESS')"""),
                {'booking_id': booking_id, 'txn_id': transaction_id, 'amount': booking[1]}
            )
            
            # Update booking status
            conn.execute(
                text("UPDATE Bookings SET status = 'CONFIRMED' WHERE id = :id"),
                {'id': booking_id}
            )
            
            # Update seat status from LOCKED to BOOKED
            conn.execute(
                text("""UPDATE FlightSeats SET status = 'BOOKED' 
                        WHERE id IN (SELECT flight_seat_id FROM Tickets WHERE booking_id = :booking_id)"""),
                {'booking_id': booking_id}
            )
            
            # Update booked_seats count in FlightClasses
            ticket_count = conn.execute(
                text("SELECT COUNT(*) FROM Tickets WHERE booking_id = :booking_id"),
                {'booking_id': booking_id}
            ).scalar()
            
            # Get flight_id from ticket
            class_id = conn.execute(
                text("""SELECT fc.id FROM FlightClasses fc
                        JOIN FlightSeats fs ON fs.class_type_id = fc.id
                        JOIN Tickets t ON t.flight_seat_id = fs.id
                        WHERE t.booking_id = :booking_id LIMIT 1"""),
                {'booking_id': booking_id}
            ).scalar()
            
            if class_id:
                conn.execute(
                    text("UPDATE FlightClasses SET booked_seats = booked_seats + :count WHERE id = :class_id"),
                    {'count': ticket_count, 'class_id': class_id}
                )
            
            trans.commit()
            
            return jsonify({
                'success': True,
                'payment': {
                    'transaction_id': transaction_id,
                    'amount': float(booking[1]),
                    'status': 'SUCCESS'
                }
            })
            
        except Exception as e:
            trans.rollback()
            return jsonify({'success': False, 'message': str(e)}), 500

# ============================================================================
# TICKET ENDPOINTS
# ============================================================================

@app.route('/api/users/<int:user_id>/tickets', methods=['GET'])
def get_user_tickets(user_id):
    """UC09: Xem vé đã đặt"""
    with get_db() as conn:
        results = conn.execute(
            text("""
                SELECT 
                    t.id, t.ticket_number, t.passenger_name, t.passenger_ic_number, t.status as ticket_status,
                    fs.seat_number,
                    fc.class_type, fc.price,
                    f.id as flight_id, f.flight_code, f.departure_time, f.arrival_time, f.status as flight_status,
                    o.code as origin_code, o.name as origin_name,
                    d.code as dest_code, d.name as dest_name,
                    b.id as booking_id, b.booking_reference, b.status as booking_status, b.total_amount
                FROM Tickets t
                JOIN Bookings b ON t.booking_id = b.id
                JOIN FlightSeats fs ON t.flight_seat_id = fs.id
                JOIN FlightClasses fc ON fs.class_type_id = fc.id
                JOIN Flights f ON fc.flight_id = f.id
                JOIN Airports o ON f.origin_airport_id = o.id
                JOIN Airports d ON f.destination_airport_id = d.id
                WHERE b.user_id = :user_id
                ORDER BY f.departure_time DESC
            """),
            {'user_id': user_id}
        ).fetchall()
        
        tickets = []
        for row in results:
            tickets.append({
                'id': row[0],
                'ticket_number': row[1],
                'passenger_name': row[2],
                'passenger_ic_number': row[3],
                'ticket_status': row[4],
                'seat_number': row[5],
                'class_type': row[6],
                'price': float(row[7]) if row[7] else 0,
                'flight': {
                    'id': row[8],
                    'flight_code': row[9],
                    'departure_time': row[10].isoformat() if row[10] else None,
                    'arrival_time': row[11].isoformat() if row[11] else None,
                    'status': row[12],
                    'origin_code': row[13],
                    'origin_name': row[14],
                    'dest_code': row[15],
                    'dest_name': row[16]
                },
                'booking': {
                    'id': row[17],
                    'booking_reference': row[18],
                    'status': row[19],
                    'total_amount': float(row[20]) if row[20] else 0
                }
            })
        
        return jsonify({'success': True, 'tickets': tickets, 'count': len(tickets)})

# ============================================================================
# MAIN
# ============================================================================

if __name__ == '__main__':
    print("=" * 50)
    print("Flight Booking Database Service")
    print("=" * 50)
    print(f"Starting on http://localhost:5000")
    print("=" * 50)
    app.run(host='0.0.0.0', port=5000, debug=True)
