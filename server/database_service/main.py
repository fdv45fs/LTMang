"""
Flight Booking Database Service
Port: 5000
Flask HTTP API with SQLAlchemy
"""

import os
import hashlib
import hmac
from urllib.parse import urlencode
from datetime import datetime
from functools import wraps

from flask import Flask, request, jsonify, redirect
from flask_cors import CORS
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import re

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL not found in .env file")

# VNPay configuration
VNP_TMN_CODE = os.getenv("VNP_TMN_CODE")
VNP_HASH_SECRET = os.getenv("VNP_HASH_SECRET")
VNP_PAY_URL = os.getenv("VNP_PAY_URL", "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html")
VNP_RETURN_URL = os.getenv("VNP_RETURN_URL")
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")

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

def write_system_log(conn, user_id, action_type, details, do_commit=False):
    """Insert a system log entry. Use do_commit=True for standalone inserts.

    Notes:
    - user_id may be None for anonymous actions; do NOT coerce to 0 to avoid FK violations.
    - This function must never poison the outer transaction on failure.
    """
    try:
        conn.execute(
            text("""
                INSERT INTO SystemLogs (user_id, action_type, details, timestamp)
                VALUES (:user_id, :action_type, :details, NOW())
            """),
            {
                'user_id': user_id,  # keep None as NULL
                'action_type': action_type,
                'details': details or ''
            }
        )
        if do_commit:
            conn.commit()
    except Exception as e:
        # Avoid breaking main flow due to logging errors
        try:
            print(f"[SystemLog] Failed to write log: {e}")
        except Exception:
            pass

def notify_users_about_flight_change(conn, flight_id, change_summary):
    """Send notification emails to users who have bookings/payments on the flight.

    Only attempts to send when SMTP envs are configured. Continues on failure per-recipient.
    Logs each attempt via SystemLogs with action_type 'ADMIN_NOTIFY_FLIGHT_CHANGE'.
    """
    # Fetch flight info for context
    flight = conn.execute(text(
        """
        SELECT f.flight_code, o.code AS origin_code, d.code AS dest_code,
               f.departure_time, f.arrival_time, f.status
        FROM Flights f
        JOIN Airports o ON f.origin_airport_id = o.id
        JOIN Airports d ON f.destination_airport_id = d.id
        WHERE f.id = :fid
        """
    ), {'fid': flight_id}).fetchone()
    if not flight:
        return

    # Distinct recipients: users with non-cancelled bookings related to this flight
    rows = conn.execute(text(
        """
        SELECT DISTINCT u.id AS user_id, u.full_name, u.email
        FROM Users u
        JOIN Bookings b ON b.user_id = u.id
        JOIN Tickets t ON t.booking_id = b.id
        JOIN FlightSeats fs ON t.flight_seat_id = fs.id
        JOIN FlightClasses fc ON fs.class_type_id = fc.id
        WHERE fc.flight_id = :fid AND COALESCE(u.email, '') <> '' AND b.status != 'CANCELLED'
        """
    ), {'fid': flight_id}).fetchall()

    if not rows:
        return

    # Compose common message
    def fmt_dt(dt):
        try:
            return dt.isoformat() if dt else ''
        except Exception:
            return str(dt or '')

    subject = f"Thông báo cập nhật chuyến bay {flight[0]} ({flight[1]}→{flight[2]})"
    header = [
        f"Chuyến bay {flight[0]} ({flight[1]}→{flight[2]}) đã được cập nhật bởi Admin.",
        f"Khởi hành: {fmt_dt(flight[3])}",
        f"Đến: {fmt_dt(flight[4])}",
        f"Trạng thái: {flight[5]}",
    ]
    change_lines = ["Chi tiết thay đổi:", change_summary or "(không có chi tiết)"]
    footer = [
        "Bạn đã đặt vé hoặc thanh toán cho chuyến bay này.",
        "Vui lòng kiểm tra lịch sử vé để đảm bảo thông tin chính xác.",
        "Nếu có thắc mắc, vui lòng liên hệ hỗ trợ.",
    ]
    body_text = "\n".join(header + [""] + change_lines + [""] + footer)

    # SMTP config
    SMTP_HOST = os.getenv('SMTP_HOST')
    SMTP_PORT = int(os.getenv('SMTP_PORT') or '587')
    SMTP_USER = os.getenv('SMTP_USER')
    SMTP_PASS = os.getenv('SMTP_PASS')
    FROM_EMAIL = os.getenv('FROM_EMAIL') or (SMTP_USER or 'no-reply@example.com')

    if not (SMTP_HOST and SMTP_USER and SMTP_PASS):
        # Log a single failure summary and return (skip sending)
        try:
            write_system_log(conn, None, 'ADMIN_NOTIFY_FLIGHT_CHANGE', f"flight_id={int(flight_id)}, recipients={len(rows)}, success=False, error=SMTP_NOT_CONFIGURED", do_commit=True)
        except Exception:
            pass
        return

    # Attempt sending per recipient
    try:
        import smtplib
        from email.message import EmailMessage
    except Exception:
        write_system_log(conn, None, 'ADMIN_NOTIFY_FLIGHT_CHANGE', f"flight_id={int(flight_id)}, recipients={len(rows)}, success=False, error=EMAIL_LIB_IMPORT_FAIL", do_commit=True)
        return

    for r in rows:
        uid, full_name, email = r[0], r[1], (r[2] or '').strip()
        if not email or '@' not in email:
            # Skip invalid emails but log
            write_system_log(conn, int(uid) if uid is not None else None, 'ADMIN_NOTIFY_FLIGHT_CHANGE', f"flight_id={int(flight_id)}, to={email or 'N/A'}, success=False, error=INVALID_EMAIL", do_commit=True)
            continue

        msg = EmailMessage()
        msg['Subject'] = subject
        msg['From'] = FROM_EMAIL
        msg['To'] = email
        msg.set_content(body_text)

        success = False
        try:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as s:
                s.starttls()
                s.login(SMTP_USER, SMTP_PASS)
                s.send_message(msg)
            success = True
        except Exception as e:
            write_system_log(conn, int(uid) if uid is not None else None, 'ADMIN_NOTIFY_FLIGHT_CHANGE', f"flight_id={int(flight_id)}, to={email}, success=False, error={str(e)}", do_commit=True)
        if success:
            write_system_log(conn, int(uid) if uid is not None else None, 'ADMIN_NOTIFY_FLIGHT_CHANGE', f"flight_id={int(flight_id)}, to={email}, success=True", do_commit=True)

def _parse_dt(dt_str):
    """Parse various datetime string formats to 'YYYY-MM-DD HH:MM:SS'.
    Accepts 'YYYY-MM-DDTHH:MM', 'YYYY-MM-DD HH:MM', with or without seconds.
    """
    if not dt_str:
        return None
    s = str(dt_str).strip()
    s = s.replace('T', ' ')
    try:
        # Try with seconds
        dt = datetime.strptime(s, '%Y-%m-%d %H:%M:%S')
    except ValueError:
        try:
            # Without seconds
            dt = datetime.strptime(s, '%Y-%m-%d %H:%M')
        except ValueError:
            # Fallback to fromisoformat if available
            try:
                dt = datetime.fromisoformat(s)
            except Exception:
                return None
    return dt.strftime('%Y-%m-%d %H:%M:%S')
def build_vnpay_payment_url(booking_id, amount, client_ip="127.0.0.1", order_info="Thanh toan don hang"):
    """Construct VNPay sandbox payment URL for a booking.
    vnp_TxnRef will be the booking_id so we can correlate on return.
    """
    if not (VNP_TMN_CODE and VNP_HASH_SECRET and VNP_RETURN_URL):
        return None

    from datetime import datetime, timedelta
    now = datetime.utcnow() + timedelta(hours=7)
    expire = now + timedelta(minutes=15)

    params = {
        'vnp_Version': '2.1.0',
        'vnp_Command': 'pay',
        'vnp_TmnCode': VNP_TMN_CODE,
        # Amount is VND x 100 per VNPay spec
        'vnp_Amount': int(round(float(amount))) * 100,
        'vnp_CurrCode': 'VND',
        'vnp_TxnRef': str(booking_id),
        'vnp_OrderInfo': order_info,
        'vnp_OrderType': 'other',
        'vnp_Locale': 'vn',
        'vnp_ReturnUrl': VNP_RETURN_URL,
        'vnp_IpAddr': client_ip,
        'vnp_CreateDate': now.strftime('%Y%m%d%H%M%S'),
        'vnp_ExpireDate': expire.strftime('%Y%m%d%H%M%S'),
    }

    # Sort by key and build hash data
    sorted_items = sorted(params.items())
    hash_data = urlencode(sorted_items)
    secure_hash = hmac.new(VNP_HASH_SECRET.encode(), hash_data.encode(), hashlib.sha512).hexdigest()
    query = hash_data + '&vnp_SecureHash=' + secure_hash
    return f"{VNP_PAY_URL}?{query}"

# ============================================================================
# AUTH ENDPOINTS
# ============================================================================

@app.route('/api/register', methods=['POST'])
def register():
    """UC01: Đăng ký tài khoản"""
    data = request.get_json()
    username = data.get('username', '')
    password = data.get('password', '')
    email = data.get('email', '')
    full_name = data.get('full_name', '')
    phone = data.get('phone', '')
    
    if not username or not password or not email:
        return jsonify({'success': False, 'message': 'Username, password và email là bắt buộc'}), 400
    
    password_hash = hash_password(password)
    
    # Use explicit transaction so updates are committed
    from sqlalchemy import exc
    with engine.begin() as conn:
        # Check if username or email already exists
        existing = conn.execute(
            text("SELECT id FROM Users WHERE username = :username OR email = :email"),
            {'username': username, 'email': email}
        ).fetchone()
        
        if existing:
            return jsonify({'success': False, 'message': 'Username hoặc email đã tồn tại'}), 409
        
        # Insert new user
        conn.execute(
            text("""INSERT INTO Users (username, password_hash, email, full_name, phone, created_at, role)
                    VALUES (:username, :password_hash, :email, :full_name, :phone, NOW(), 'USER')"""),
            {'username': username, 'password_hash': password_hash, 'email': email, 'full_name': full_name, 'phone': phone}
        )
        # Get new user id
        new_user_id = conn.execute(text("SELECT id FROM Users WHERE username = :u"), {'u': username}).scalar()
        # Log action
        write_system_log(conn, new_user_id, 'CREATE_USER', f"username={username}, email={email}", do_commit=True)
        return jsonify({'success': True, 'message': 'Đăng ký thành công', 'user_id': int(new_user_id or 0)})

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
            # Log success
            write_system_log(conn, int(result[0]), 'LOGIN', f"username={username}", do_commit=True)
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
            # Log failed attempt (anonymous)
            write_system_log(conn, None, 'LOGIN_FAIL', f"username={username}", do_commit=True)
            return jsonify({'success': False, 'message': 'Sai tên đăng nhập hoặc mật khẩu'}), 401

# ============================================================================
# FLIGHT ENDPOINTS
# ============================================================================

@app.route('/api/flights', methods=['GET'])
def search_flights():
    """UC04: Tìm kiếm chuyến bay"""
    # Lấy tham số từ URL
    # Chấp nhận cả tên tham số origin/destination và origin_id/dest_id
    origin = request.args.get('origin', type=int)
    if origin is None:
        origin = request.args.get('origin_id', type=int)

    destination = request.args.get('destination', type=int)
    if destination is None:
        destination = request.args.get('dest_id', type=int)

    start_date = request.args.get('start_date') 
    end_date = request.args.get('end_date')     
    # Filter by class type: 'ECONOMY' or 'BUSINESS'
    class_type = request.args.get('class_type')

    # Lấy số lượng hành khách, mặc định là 1 nếu không truyền (hỗ trợ cả passengers/passenger_count)
    min_passengers = request.args.get('passengers', type=int)
    if min_passengers is None:
        min_passengers = request.args.get('passenger_count', default=1, type=int)
    if min_passengers is None:
        min_passengers = 1
    # ---------------------

    with get_db() as conn:
        # Giữ nguyên câu Query gốc
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
        
        # Logic lọc theo địa điểm
        if origin:
            query += " AND f.origin_airport_id = :origin"
            params['origin'] = origin
        if destination:
            query += " AND f.destination_airport_id = :destination"
            params['destination'] = destination
        
        # Logic lọc ngày
        if start_date:
            query += " AND DATE(f.departure_time) >= :start_date"
            params['start_date'] = start_date
            
        if end_date:
            query += " AND DATE(f.departure_time) <= :end_date"
            params['end_date'] = end_date
        
        # Logic lọc số lượng ghế: theo hạng ghế nếu có, ngược lại tổng ECONOMY+BUSINESS
        if class_type in ('ECONOMY', 'BUSINESS'):
            query += """
                AND COALESCE((SELECT total_seats - booked_seats 
                              FROM FlightClasses 
                              WHERE flight_id = f.id AND class_type = :class_type), 0) >= :min_passengers
            """
            params['class_type'] = class_type
            params['min_passengers'] = min_passengers
        else:
            query += """
                AND (
                    COALESCE((SELECT total_seats - booked_seats 
                              FROM FlightClasses 
                              WHERE flight_id = f.id AND class_type = 'ECONOMY'), 0)
                  + COALESCE((SELECT total_seats - booked_seats 
                              FROM FlightClasses 
                              WHERE flight_id = f.id AND class_type = 'BUSINESS'), 0)
                ) >= :min_passengers
            """
            params['min_passengers'] = min_passengers
        
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
                'business_available': row[17] or 0,
                'total_available': (row[16] or 0) + (row[17] or 0)
            })
        
        # Optional user_id for logging
        uid = request.args.get('user_id', type=int)
        # Log search action (do_commit=True since standalone)
        write_system_log(conn, uid if uid else None, 'SEARCH', f"origin={origin or 0}, dest={destination or 0}, start={start_date or ''}, end={end_date or ''}, class={class_type or 'ALL'}, pax={min_passengers}, results={len(flights)}", do_commit=True)
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
        # Log listing airports (no user context)
        write_system_log(conn, None, 'LIST_AIRPORTS', f"count={len(airports)}", do_commit=True)
        return jsonify({'success': True, 'airports': airports})

@app.route('/api/aircrafts', methods=['GET'])
def get_aircrafts():
    """Lấy danh sách máy bay"""
    with get_db() as conn:
        rows = conn.execute(text("SELECT id, model FROM Aircrafts ORDER BY id"))
        aircrafts = [{'id': r[0], 'model': r[1]} for r in rows]
        return jsonify({'success': True, 'aircrafts': aircrafts})

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
            booking_date = conn.execute(text("SELECT booking_date FROM Bookings WHERE id = :id"), {'id': booking_id}).scalar()
            
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
            
            # Log booking
            write_system_log(conn, int(user_id), 'BOOK', f"booking_id={booking_id}, ref={booking_ref}, class={class_type}, seats={len(passengers)}", do_commit=False)
            trans.commit()
            
            return jsonify({
                'success': True,
                'booking': {
                    'id': booking_id,
                    'booking_reference': booking_ref,
                    'total_amount': total_amount,
                    'status': 'PENDING',
                    'booking_date': booking_date.isoformat() if booking_date else None,
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
    """UC07: Thanh toán

    If VNPay env is configured, return a `payment_url` for user redirection.
    Otherwise, fall back to simulated success.
    """
    data = request.get_json(silent=True) or {}
    # Ensure numeric booking_id
    try:
        booking_id = int(data.get('booking_id') or 0)
    except Exception:
        booking_id = 0
    payment_method = data.get('payment_method', 'CARD')
    if not booking_id:
        return jsonify({'success': False, 'message': 'Thiếu booking_id'}), 400

    with get_db() as conn:
        # Look up booking
        booking = conn.execute(
            text("SELECT id, user_id, total_amount, status FROM Bookings WHERE id = :id"),
            {'id': booking_id}
        ).fetchone()
        if not booking:
            return jsonify({'success': False, 'message': 'Booking không tồn tại'}), 404
        if booking[3] != 'PENDING':
            return jsonify({'success': False, 'message': 'Booking đã được xử lý'}), 400

        # If VNPay env available, return payment_url
        payment_url = build_vnpay_payment_url(booking_id=booking_id, amount=booking[2], client_ip=request.remote_addr or '127.0.0.1', order_info=f"Thanh toan booking {booking_id}")
        if payment_url:
            # Log initiation
            write_system_log(conn, int(booking[1]) if booking and booking[1] is not None else None, 'PAYMENT_INIT', f"booking_id={booking_id}, amount={float(booking[2])}", do_commit=True)
            return jsonify({'success': True, 'payment_url': payment_url})

        # Fallback: simulated success as before
        trans = conn.begin()
        try:
            import random, string
            transaction_id = 'TXN-' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=10))
            conn.execute(
                text("""INSERT INTO Payments (booking_id, transaction_date, transaction_id, amount, status)
                        VALUES (:booking_id, NOW(), :txn_id, :amount, 'SUCCESS')"""),
                {'booking_id': booking_id, 'txn_id': transaction_id, 'amount': booking[2]}
            )
            payment_date = conn.execute(
                text("SELECT MAX(transaction_date) FROM Payments WHERE booking_id = :bid"),
                {'bid': booking_id}
            ).scalar()
            conn.execute(text("UPDATE Bookings SET status = 'CONFIRMED' WHERE id = :id"), {'id': booking_id})
            conn.execute(text("""UPDATE FlightSeats SET status = 'BOOKED' 
                               WHERE id IN (SELECT flight_seat_id FROM Tickets WHERE booking_id = :booking_id)"""), {'booking_id': booking_id})
            ticket_count = conn.execute(text("SELECT COUNT(*) FROM Tickets WHERE booking_id = :booking_id"), {'booking_id': booking_id}).scalar()
            class_id = conn.execute(text("""SELECT fc.id FROM FlightClasses fc
                        JOIN FlightSeats fs ON fs.class_type_id = fc.id
                        JOIN Tickets t ON t.flight_seat_id = fs.id
                        WHERE t.booking_id = :booking_id LIMIT 1"""), {'booking_id': booking_id}).scalar()
            if class_id:
                conn.execute(text("UPDATE FlightClasses SET booked_seats = booked_seats + :count WHERE id = :class_id"), {'count': ticket_count, 'class_id': class_id})
            write_system_log(conn, int(booking[1]) if booking and booking[1] is not None else None, 'PAYMENT', f"booking_id={booking_id}, txn={transaction_id}, amount={float(booking[2])}", do_commit=False)
            trans.commit()
            return jsonify({'success': True, 'payment': {'transaction_id': transaction_id, 'amount': float(booking[2]), 'status': 'SUCCESS'}, 'booking': {'id': int(booking_id), 'status': 'CONFIRMED', 'payment_date': payment_date.isoformat() if payment_date else None}})
        except Exception as e:
            trans.rollback()
            return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/bookings/<int:booking_id>/cancel', methods=['POST'])
def cancel_booking(booking_id):
    """UC09: Hủy vé/booking - giữ lịch sử với trạng thái CANCELLED"""
    with get_db() as conn:
        trans = conn.begin()
        try:
            # Check booking
            booking = conn.execute(
                text("SELECT id, status, user_id FROM Bookings WHERE id = :id"),
                {'id': booking_id}
            ).fetchone()
            if not booking:
                return jsonify({'success': False, 'message': 'Booking không tồn tại'}), 404

            # Count tickets and get class_type_id per ticket
            tickets = conn.execute(
                text("""
                    SELECT t.id, fs.id as seat_id, fs.class_type_id
                    FROM Tickets t
                    JOIN FlightSeats fs ON t.flight_seat_id = fs.id
                    WHERE t.booking_id = :bid
                """),
                {'bid': booking_id}
            ).fetchall()

            if not tickets:
                return jsonify({'success': False, 'message': 'Không có vé để hủy'}), 400

            ticket_ids = [t[0] for t in tickets]
            seat_ids = [t[1] for t in tickets]
            class_ids = [t[2] for t in tickets]

            # Update ticket status to CANCELLED
            conn.execute(
                text("UPDATE Tickets SET status = 'CANCELLED' WHERE booking_id = :bid"),
                {'bid': booking_id}
            )
            # Free seats back to AVAILABLE
            conn.execute(
                text("UPDATE FlightSeats SET status = 'AVAILABLE' WHERE id = ANY(:seat_ids)"),
                {'seat_ids': seat_ids}
            )

            # If booking was CONFIRMED, decrement booked_seats for corresponding classes
            if booking[1] == 'CONFIRMED':
                # Decrement booked_seats by count per class_id
                from collections import Counter
                counts = Counter(class_ids)
                for class_id, count in counts.items():
                    conn.execute(
                        text("UPDATE FlightClasses SET booked_seats = GREATEST(booked_seats - :cnt, 0) WHERE id = :cid"),
                        {'cnt': int(count), 'cid': class_id}
                    )

            # Update booking status to CANCELLED
            conn.execute(
                text("UPDATE Bookings SET status = 'CANCELLED' WHERE id = :id"),
                {'id': booking_id}
            )

            # Log cancel action with the real user id
            write_system_log(conn, int(booking[2]) if booking and booking[2] is not None else None, 'CANCEL', f"booking_id={booking_id}, tickets={len(tickets)}", do_commit=False)

            trans.commit()
            return jsonify({'success': True, 'message': 'Đã hủy booking', 'booking_id': booking_id})
        except Exception as e:
            trans.rollback()
            return jsonify({'success': False, 'message': str(e)}), 500

# ==========================================================================
# VNPay RETURN CALLBACK
# ==========================================================================

@app.route('/api/vnpay_return', methods=['GET'])
def vnpay_return():
    """VNPay returns here with vnp_* query params. Verify and update booking."""
    if not (VNP_TMN_CODE and VNP_HASH_SECRET):
        return jsonify({'success': False, 'message': 'VNPay not configured'}), 400

    # Extract params
    params = dict(request.args)
    vnp_secure_hash = params.pop('vnp_SecureHash', None)
    # Build hash data from remaining vnp_* params sorted
    sorted_items = sorted(params.items())
    hash_data = urlencode(sorted_items)
    expected_hash = hmac.new(VNP_HASH_SECRET.encode(), hash_data.encode(), hashlib.sha512).hexdigest()
    if not vnp_secure_hash or vnp_secure_hash.lower() != expected_hash.lower():
        return jsonify({'success': False, 'message': 'Invalid secure hash'}), 400

    booking_id = int(params.get('vnp_TxnRef', '0') or '0')
    response_code = params.get('vnp_ResponseCode')
    transaction_no = params.get('vnp_TransactionNo') or params.get('vnp_TxnRef')
    amount = int(params.get('vnp_Amount', '0') or '0') / 100.0

    if booking_id <= 0:
        return jsonify({'success': False, 'message': 'Invalid booking id'}), 400

    with get_db() as conn:
        trans = conn.begin()
        try:
            booking = conn.execute(text("SELECT id, user_id, total_amount, status FROM Bookings WHERE id = :id"), {'id': booking_id}).fetchone()
            if not booking:
                return jsonify({'success': False, 'message': 'Booking không tồn tại'}), 404

            if response_code == '00':  # success
                # Record payment
                conn.execute(text("""INSERT INTO Payments (booking_id, transaction_date, transaction_id, amount, status)
                                   VALUES (:bid, NOW(), :txn, :amount, 'SUCCESS')"""),
                            {'bid': booking_id, 'txn': str(transaction_no), 'amount': float(amount)})

                # Update booking and seats
                conn.execute(text("UPDATE Bookings SET status = 'CONFIRMED' WHERE id = :id"), {'id': booking_id})
                conn.execute(text("""UPDATE FlightSeats SET status = 'BOOKED'
                                   WHERE id IN (SELECT flight_seat_id FROM Tickets WHERE booking_id = :bid)"""), {'bid': booking_id})

                ticket_count = conn.execute(text("SELECT COUNT(*) FROM Tickets WHERE booking_id = :bid"), {'bid': booking_id}).scalar()
                class_id = conn.execute(text("""SELECT fc.id FROM FlightClasses fc
                                              JOIN FlightSeats fs ON fs.class_type_id = fc.id
                                              JOIN Tickets t ON t.flight_seat_id = fs.id
                                              WHERE t.booking_id = :bid LIMIT 1"""), {'bid': booking_id}).scalar()
                if class_id:
                    conn.execute(text("UPDATE FlightClasses SET booked_seats = booked_seats + :cnt WHERE id = :cid"), {'cnt': ticket_count, 'cid': class_id})

                write_system_log(conn, int(booking[1]) if booking and booking[1] is not None else None, 'PAYMENT', f"booking_id={booking_id}, txn={transaction_no}, amount={float(amount)}", do_commit=False)
                trans.commit()

                # Redirect user back to frontend history with booking context
                target = f"{FRONTEND_BASE_URL}/history?payment=success&booking_id={booking_id}"
                html = f"<html><head><meta http='refresh' content='0;url={target}' /></head><body>Thanh toán thành công. Redirect...</body></html>"
                return redirect(target)
            else:
                # Payment failed/cancelled
                write_system_log(conn, int(booking[1]) if booking and booking[1] is not None else None, 'PAYMENT_FAIL', f"booking_id={booking_id}, code={response_code}", do_commit=True)
                trans.commit()
                target = f"{FRONTEND_BASE_URL}/payments?status=failed"
                html = f"<html><head><meta http='refresh' content='0;url={target}' /></head><body>Thanh toán thất bại. Redirect...</body></html>"
                return html
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
                    b.id as booking_id, b.booking_reference, b.status as booking_status, b.total_amount,
                    b.booking_date,
                    (SELECT MAX(p.transaction_date) FROM Payments p WHERE p.booking_id = b.id) AS payment_date,
                    b.email_sent_to,
                    b.email_sent_at
                FROM Tickets t
                JOIN Bookings b ON t.booking_id = b.id
                JOIN FlightSeats fs ON t.flight_seat_id = fs.id
                JOIN FlightClasses fc ON fs.class_type_id = fc.id
                JOIN Flights f ON fc.flight_id = f.id
                JOIN Airports o ON f.origin_airport_id = o.id
                JOIN Airports d ON f.destination_airport_id = d.id
                WHERE b.user_id = :user_id
                ORDER BY b.booking_date DESC
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
                    'total_amount': float(row[20]) if row[20] else 0,
                    'booking_date': row[21].isoformat() if row[21] else None,
                    'payment_date': row[22].isoformat() if row[22] else None,
                    'email_sent_to': row[23],
                    'email_sent_at': row[24].isoformat() if row[24] else None
                }
            })
        
        # Log tickets listing
        write_system_log(conn, int(user_id), 'LIST_TICKETS', f"count={len(tickets)}", do_commit=True)
        return jsonify({'success': True, 'tickets': tickets, 'count': len(tickets)})

@app.route('/api/tickets/send_email', methods=['POST'])
def send_ticket_email():
    """Send e-ticket codes to a specified email for a booking.

    Body: { booking_id: int, email: str }
    Requires SMTP settings via environment:
      SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_EMAIL
    """
    data = request.get_json(silent=True) or {}
    booking_id = data.get('booking_id')
    email = (data.get('email') or '').strip()

    if not booking_id or not email:
        return jsonify({'success': False, 'message': 'Thiếu booking_id hoặc email'}), 400

    # Basic email format check
    if '@' not in email or '.' not in email:
        return jsonify({'success': False, 'message': 'Email không hợp lệ'}), 400

    with get_db() as conn:
        # Ensure Bookings has email tracking columns (Postgres only)
        try:
            conn.execute(text("""
                ALTER TABLE Bookings
                ADD COLUMN IF NOT EXISTS email_sent_to VARCHAR(255),
                ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP
            """))
        except Exception:
            pass

        # Block re-sending if already sent (via columns or logs fallback)
        try:
            existing = conn.execute(text(
                "SELECT email_sent_at, email_sent_to FROM Bookings WHERE id = :bid"
            ), {'bid': booking_id}).fetchone()
        except Exception:
            existing = None
        if existing and existing[0] is not None:
            return jsonify({'success': False, 'message': f"Mã vé đã được gửi đến {existing[1]}"}), 409
        # Fallback: check logs for a prior success send
        log_row = conn.execute(text(
            """
            SELECT details, timestamp FROM SystemLogs
            WHERE action_type = 'SEND_TICKET_EMAIL'
              AND details LIKE :pat
              AND details LIKE '%success=True%'
            ORDER BY id DESC LIMIT 1
            """
        ), {'pat': f"booking_id={booking_id}%"}).fetchone()
        if log_row:
            det = log_row[0] or ''
            m = re.search(r'to=([^,]+)', det)
            sent_to = m.group(1).strip() if m else ''
            return jsonify({'success': False, 'message': f"Mã vé đã được gửi đến {sent_to}"}), 409
        # Fetch booking and tickets data
        rows = conn.execute(text(
            """
            SELECT 
                b.id AS booking_id, b.booking_reference, b.total_amount,
                u.full_name, u.email AS user_email,
                f.flight_code, o.code AS origin_code, d.code AS dest_code,
                t.ticket_number, t.passenger_name, fs.seat_number, fc.class_type,
                COALESCE((SELECT MAX(p.transaction_date) FROM Payments p WHERE p.booking_id = b.id), NOW()) AS payment_date
            FROM Bookings b
            JOIN Users u ON b.user_id = u.id
            JOIN Tickets t ON t.booking_id = b.id
            JOIN FlightSeats fs ON t.flight_seat_id = fs.id
            JOIN FlightClasses fc ON fs.class_type_id = fc.id
            JOIN Flights f ON fc.flight_id = f.id
            JOIN Airports o ON f.origin_airport_id = o.id
            JOIN Airports d ON f.destination_airport_id = d.id
            WHERE b.id = :bid
            ORDER BY t.id
            """
        ), {'bid': booking_id}).fetchall()

        if not rows:
            return jsonify({'success': False, 'message': 'Không tìm thấy vé cho booking này'}), 404

        # Build email content
        first = rows[0]
        subject = f"E-ticket cho Booking {first[1]} - Chuyến {first[5]} ({first[6]}→{first[7]})"
        lines = []
        lines.append(f"Xin chào {first[3]},")
        lines.append("")
        lines.append(f"Cảm ơn bạn đã thanh toán. Dưới đây là mã vé điện tử cho booking {first[1]}:")
        lines.append("")
        for r in rows:
            ticket_number = r[8]
            passenger_name = r[9]
            seat_number = r[10]
            class_type = r[11]
            lines.append(f"- {passenger_name} | Vé: {ticket_number} | Ghế: {seat_number} | Hạng: {class_type}")
        lines.append("")
        lines.append(f"Chuyến bay: {first[5]} ({first[6]}→{first[7]})")
        lines.append(f"Tổng tiền: {float(first[2]):.0f} VND")
        lines.append(f"Ngày thanh toán: {first[12].isoformat() if first[12] else ''}")
        lines.append("")
        lines.append("Chúc bạn có chuyến bay tốt đẹp!")
        body_text = "\n".join(lines)

        # Attempt SMTP send
        SMTP_HOST = os.getenv('SMTP_HOST')
        SMTP_PORT = int(os.getenv('SMTP_PORT') or '587')
        SMTP_USER = os.getenv('SMTP_USER')
        SMTP_PASS = os.getenv('SMTP_PASS')
        FROM_EMAIL = os.getenv('FROM_EMAIL') or (SMTP_USER or 'no-reply@example.com')

        sent = False
        error_msg = None
        try:
            if SMTP_HOST and SMTP_USER and SMTP_PASS:
                import smtplib
                from email.message import EmailMessage
                msg = EmailMessage()
                msg['Subject'] = subject
                msg['From'] = FROM_EMAIL
                msg['To'] = email
                msg.set_content(body_text)

                with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as s:
                    s.starttls()
                    s.login(SMTP_USER, SMTP_PASS)
                    s.send_message(msg)
                sent = True
            else:
                error_msg = 'Chưa cấu hình SMTP. Vui lòng thiết lập SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_EMAIL trong .env'
        except Exception as e:
            error_msg = str(e)

        if sent:
            # Persist email sent info and then log
            try:
                conn.execute(text("""
                    UPDATE Bookings SET email_sent_to = :email, email_sent_at = NOW()
                    WHERE id = :bid
                """), {'email': email, 'bid': booking_id})
            except Exception as e:
                print(f"[EmailUpdate] Failed to update booking {booking_id}: {e}")
            try:
                uid = conn.execute(text("SELECT user_id FROM Bookings WHERE id = :bid"), {'bid': booking_id}).scalar()
                write_system_log(conn, int(uid) if uid is not None else None, 'SEND_TICKET_EMAIL', f"booking_id={booking_id}, to={email}, success=True", do_commit=True)
            except Exception:
                pass
            return jsonify({'success': True, 'message': 'Đã gửi email mã vé'}), 200
        else:
            # Log failure
            try:
                uid = conn.execute(text("SELECT user_id FROM Bookings WHERE id = :bid"), {'bid': booking_id}).scalar()
                write_system_log(conn, int(uid) if uid is not None else None, 'SEND_TICKET_EMAIL', f"booking_id={booking_id}, to={email}, success=False, error={error_msg or ''}", do_commit=True)
            except Exception:
                pass
            return jsonify({'success': False, 'message': error_msg or 'Gửi email thất bại'}), 500

# ============================================================================
# SYSTEM LOGS ENDPOINTS (Admin)
# ============================================================================

@app.route('/api/systemlogs', methods=['GET'])
def list_system_logs():
    """UC13: Xem logs hệ thống"""
    user_id = request.args.get('user_id', type=int)
    action_type = request.args.get('action_type')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    limit = request.args.get('limit', default=200, type=int)

    with get_db() as conn:
        query = """
            SELECT id, user_id, action_type, details, timestamp
            FROM SystemLogs
            WHERE 1=1
        """
        params = {}
        if user_id:
            query += " AND user_id = :uid"
            params['uid'] = user_id
        if action_type:
            query += " AND action_type = :act"
            params['act'] = action_type
        if start_date:
            query += " AND DATE(timestamp) >= :start"
            params['start'] = start_date
        if end_date:
            query += " AND DATE(timestamp) <= :end"
            params['end'] = end_date
        query += " ORDER BY timestamp DESC LIMIT :limit"
        params['limit'] = limit

        rows = conn.execute(text(query), params).fetchall()
        logs = []
        for r in rows:
            logs.append({
                'id': r[0],
                'user_id': r[1],
                'action_type': r[2],
                'details': r[3],
                'timestamp': r[4].isoformat() if r[4] else None
            })
        return jsonify({'success': True, 'logs': logs, 'count': len(logs)})

# ============================================================================
# ADMIN FLIGHT MANAGEMENT ENDPOINTS
# ============================================================================

@app.route('/api/admin/flights', methods=['GET'])
def admin_list_flights():
    """List all flights with class info for admin."""
    with get_db() as conn:
        rows = conn.execute(text(
            """
            SELECT f.id, f.flight_code, f.departure_time, f.arrival_time, f.status,
                   a.model as aircraft_model,
                   o.code as origin_code, d.code as dest_code
            FROM Flights f
            JOIN Aircrafts a ON f.aircraft_id = a.id
            JOIN Airports o ON f.origin_airport_id = o.id
            JOIN Airports d ON f.destination_airport_id = d.id
            ORDER BY f.departure_time DESC
            """
        )).fetchall()

        flights = []
        for r in rows:
            classes = conn.execute(text(
                """SELECT class_type, price, total_seats, booked_seats
                    FROM FlightClasses WHERE flight_id = :fid"""
            ), {'fid': r[0]}).fetchall()
            flights.append({
                'id': r[0],
                'flight_code': r[1],
                'departure_time': r[2].isoformat() if r[2] else None,
                'arrival_time': r[3].isoformat() if r[3] else None,
                'status': r[4],
                'aircraft_model': r[5],
                'origin_code': r[6],
                'dest_code': r[7],
                'classes': [
                    {
                        'class_type': c[0], 'price': float(c[1]) if c[1] else 0,
                        'total_seats': c[2], 'booked_seats': c[3]
                    } for c in classes
                ]
            })
        return jsonify({'success': True, 'flights': flights, 'count': len(flights)})

@app.route('/api/admin/flights/<int:flight_id>/details', methods=['GET'])
def admin_flight_details(flight_id):
    """Detailed per-flight bookings and payments breakdown for admin."""
    with get_db() as conn:
        # Flight basic info
        f = conn.execute(text(
            """
            SELECT f.flight_code, f.departure_time, f.arrival_time, f.status,
                   a.model AS aircraft_model,
                   o.code AS origin_code, d.code AS dest_code
            FROM Flights f
            JOIN Aircrafts a ON f.aircraft_id = a.id
            JOIN Airports o ON f.origin_airport_id = o.id
            JOIN Airports d ON f.destination_airport_id = d.id
            WHERE f.id = :fid
            """
        ), {'fid': flight_id}).fetchone()
        if not f:
            return jsonify({'success': False, 'message': 'Flight not found'}), 404

        # Summary of booked tickets by class
        rows = conn.execute(text(
            """
            SELECT fc.class_type, COUNT(*) AS booked
            FROM Tickets t
            JOIN FlightSeats fs ON t.flight_seat_id = fs.id
            JOIN FlightClasses fc ON fs.class_type_id = fc.id
            WHERE fc.flight_id = :fid
            GROUP BY fc.class_type
            """
        ), {'fid': flight_id}).fetchall()
        summary = {'ECONOMY': 0, 'BUSINESS': 0}
        for r in rows:
            summary[r[0]] = int(r[1])

        # Per-user breakdown
        users = conn.execute(text(
            """
            SELECT u.id AS user_id, u.full_name, b.id AS booking_id, b.status AS booking_status,
                   SUM(CASE WHEN fc.class_type = 'ECONOMY' THEN 1 ELSE 0 END) AS economy_tickets,
                   SUM(CASE WHEN fc.class_type = 'BUSINESS' THEN 1 ELSE 0 END) AS business_tickets,
                   COALESCE(SUM(CASE WHEN p.status = 'SUCCESS' THEN p.amount ELSE 0 END), 0) AS paid_amount
            FROM Tickets t
            JOIN FlightSeats fs ON t.flight_seat_id = fs.id
            JOIN FlightClasses fc ON fs.class_type_id = fc.id
            JOIN Bookings b ON t.booking_id = b.id
            LEFT JOIN Payments p ON p.booking_id = b.id
            JOIN Users u ON b.user_id = u.id
            WHERE fc.flight_id = :fid
            GROUP BY u.id, u.full_name, b.id, b.status
            ORDER BY paid_amount DESC
            """
        ), {'fid': flight_id}).fetchall()
        users_list = []
        for r in users:
            users_list.append({
                'user_id': r[0], 'full_name': r[1], 'booking_id': r[2], 'booking_status': r[3],
                'economy_tickets': int(r[4] or 0), 'business_tickets': int(r[5] or 0),
                'paid_amount': float(r[6] or 0)
            })

        return jsonify({
            'success': True,
            'flight': {
                'flight_code': f[0],
                'departure_time': f[1].isoformat() if f[1] else None,
                'arrival_time': f[2].isoformat() if f[2] else None,
                'status': f[3],
                'aircraft_model': f[4],
                'origin_code': f[5],
                'dest_code': f[6],
            },
            'summary': {
                'economy_booked': summary.get('ECONOMY', 0),
                'business_booked': summary.get('BUSINESS', 0)
            },
            'users': users_list
        })

def generate_seats(conn, class_id, class_type, total_seats):
    """Generate seats for a class if none exist."""
    existing = conn.execute(text("SELECT COUNT(*) FROM FlightSeats WHERE class_type_id = :cid"), {'cid': class_id}).scalar()
    if existing and existing >= total_seats:
        return
    # Create simple seat numbering
    prefix = 'E' if class_type == 'ECONOMY' else 'B'
    current = existing or 0
    for i in range(current + 1, total_seats + 1):
        seat_num = f"{prefix}{i}"
        conn.execute(text("""
            INSERT INTO FlightSeats (class_type_id, seat_number, status)
            VALUES (:cid, :seat, 'AVAILABLE')
        """), {'cid': class_id, 'seat': seat_num})

@app.route('/api/admin/flights', methods=['POST'])
def admin_create_flight():
    data = request.get_json(silent=True) or {}
    user_id = data.get('user_id')  # admin id for logging
    aircraft_id = data.get('aircraft_id')
    origin_airport_id = data.get('origin_airport_id')
    destination_airport_id = data.get('destination_airport_id')
    departure_time = data.get('departure_time')
    arrival_time = data.get('arrival_time')
    status = data.get('status', 'SCHEDULED')
    classes = data.get('classes', [])

    if not all([aircraft_id, origin_airport_id, destination_airport_id, departure_time, arrival_time]):
        return jsonify({'success': False, 'message': 'Thiếu thông tin bắt buộc'}), 400

    with get_db() as conn:
        trans = conn.begin()
        try:
            dep_fmt = _parse_dt(departure_time)
            arr_fmt = _parse_dt(arrival_time)
            if not dep_fmt or not arr_fmt:
                return jsonify({'success': False, 'message': 'Định dạng thời gian không hợp lệ'}), 400
            
            # Generate flight code: ORGDEST + timestamp suffix
            import random, string
            code_prefix = (conn.execute(text("SELECT code FROM Airports WHERE id = :id"), {'id': origin_airport_id}).scalar() or 'OR') + \
                          (conn.execute(text("SELECT code FROM Airports WHERE id = :id"), {'id': destination_airport_id}).scalar() or 'DT')
            flight_code = code_prefix + '-' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))

            conn.execute(text("""
                INSERT INTO Flights (flight_code, aircraft_id, origin_airport_id, destination_airport_id, departure_time, arrival_time, status)
                VALUES (:code, :aid, :orig, :dest, :dep, :arr, :status)
            """), {
                'code': flight_code,
                'aid': aircraft_id,
                'orig': origin_airport_id,
                'dest': destination_airport_id,
                'dep': dep_fmt,
                'arr': arr_fmt,
                'status': status
            })
            flight_id = conn.execute(text("SELECT lastval()")).scalar()

            # Create classes and seats
            for cls in classes:
                class_type = cls.get('class_type')
                price = cls.get('price', 0)
                total_seats = int(cls.get('total_seats', 0))
                if class_type not in ['ECONOMY', 'BUSINESS']:
                    continue
                conn.execute(text("""
                    INSERT INTO FlightClasses (flight_id, class_type, price, total_seats, booked_seats, info)
                    VALUES (:fid, :ctype, :price, :total, 0, '')
                """), {'fid': flight_id, 'ctype': class_type, 'price': price, 'total': total_seats})
                class_id = conn.execute(text("""
                    SELECT id FROM FlightClasses WHERE flight_id = :fid AND class_type = :ctype
                """), {'fid': flight_id, 'ctype': class_type}).scalar()
                if class_id and total_seats > 0:
                    generate_seats(conn, class_id, class_type, total_seats)

            write_system_log(conn, int(user_id) if user_id else None, 'ADMIN_CREATE_FLIGHT', f"flight_id={int(flight_id)}, code={flight_code}", do_commit=False)
            trans.commit()
            return jsonify({'success': True, 'flight_id': int(flight_id), 'flight_code': flight_code})
        except Exception as e:
            trans.rollback()
            return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/flights/<int:flight_id>', methods=['PUT'])
def admin_update_flight(flight_id):
    data = request.get_json(silent=True) or {}
    user_id = data.get('user_id')
    fields = {}
    for key in ['departure_time', 'arrival_time', 'status']:
        if key in data:
            if key in ['departure_time', 'arrival_time']:
                parsed = _parse_dt(data[key])
                if not parsed:
                    return jsonify({'success': False, 'message': 'Định dạng thời gian không hợp lệ'}), 400
                fields[key] = parsed
            else:
                fields[key] = data[key]
    with get_db() as conn:
        trans = conn.begin()
        try:
            if fields:
                set_clause = ", ".join([f"{k} = :{k}" for k in fields.keys()])
                params = {**fields, 'id': flight_id}
                conn.execute(text(f"UPDATE Flights SET {set_clause} WHERE id = :id"), params)
            # Update class prices if provided
            class_updates = data.get('classes', [])
            for cu in class_updates:
                if 'class_type' in cu and 'price' in cu:
                    conn.execute(text("UPDATE FlightClasses SET price = :p WHERE flight_id = :fid AND class_type = :ct"),
                                 {'p': float(cu['price']), 'fid': flight_id, 'ct': cu['class_type']})
            write_system_log(conn, int(user_id) if user_id else None, 'ADMIN_UPDATE_FLIGHT', f"flight_id={int(flight_id)}", do_commit=False)
            trans.commit()
            # After commit: notify users about change
            changes = []
            for k in ['departure_time', 'arrival_time', 'status']:
                if k in data:
                    changes.append(f"{k}={data.get(k)}")
            for cu in class_updates:
                if 'class_type' in cu and 'price' in cu:
                    changes.append(f"price[{cu['class_type']}]={cu['price']}")
            change_summary = ", ".join(changes)
            try:
                notify_users_about_flight_change(conn, flight_id, change_summary)
            except Exception as e:
                # Log but do not fail the API
                write_system_log(conn, int(user_id) if user_id else None, 'ADMIN_NOTIFY_FLIGHT_CHANGE', f"flight_id={int(flight_id)}, error={str(e)}", do_commit=True)
            return jsonify({'success': True})
        except Exception as e:
            trans.rollback()
            return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/flights/<int:flight_id>', methods=['DELETE'])
def admin_delete_flight(flight_id):
    user_id = request.args.get('user_id', type=int)
    with get_db() as conn:
        trans = conn.begin()
        try:
            # Notify users before deletion (flight will be removed)
            try:
                notify_users_about_flight_change(conn, flight_id, "Chuyến bay này đã bị xóa bởi Admin")
            except Exception as e:
                write_system_log(conn, int(user_id) if user_id else None, 'ADMIN_NOTIFY_FLIGHT_CHANGE', f"flight_id={int(flight_id)}, error={str(e)}", do_commit=True)
            # Hard delete: remove dependent records then flight
            # Resolve booking ids via tickets -> seats -> classes -> flight
            booking_ids_sql = text("""
                SELECT DISTINCT t.booking_id
                FROM Tickets t
                JOIN FlightSeats fs ON t.flight_seat_id = fs.id
                JOIN FlightClasses fc ON fs.class_type_id = fc.id
                WHERE fc.flight_id = :id
            """)
            bookings = conn.execute(booking_ids_sql, {'id': flight_id}).fetchall()
            if bookings:
                # Delete payments for affected bookings
                conn.execute(text("DELETE FROM Payments WHERE booking_id = ANY(:bids)"), {
                    'bids': [r[0] for r in bookings]
                })
                # Delete tickets for affected bookings
                conn.execute(text("DELETE FROM Tickets WHERE booking_id = ANY(:bids)"), {
                    'bids': [r[0] for r in bookings]
                })
                # Delete bookings
                conn.execute(text("DELETE FROM Bookings WHERE id = ANY(:bids)"), {
                    'bids': [r[0] for r in bookings]
                })

            # Delete seats belonging to classes of this flight
            conn.execute(text("DELETE FROM FlightSeats WHERE class_type_id IN (SELECT id FROM FlightClasses WHERE flight_id = :id)"), {'id': flight_id})
            # Delete classes of this flight
            conn.execute(text("DELETE FROM FlightClasses WHERE flight_id = :id"), {'id': flight_id})
            # Finally delete the flight
            conn.execute(text("DELETE FROM Flights WHERE id = :id"), {'id': flight_id})
            write_system_log(conn, int(user_id) if user_id else None, 'ADMIN_DELETE_FLIGHT', f"flight_id={int(flight_id)}", do_commit=False)
            trans.commit()
            return jsonify({'success': True})
        except Exception as e:
            trans.rollback()
            return jsonify({'success': False, 'message': str(e)}), 500

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
