import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { createBooking } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function BookingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const flight = location.state?.flight || location.state?.booking?.flight;
  
  const [classType, setClassType] = useState(location.state?.defaultClass || 'ECONOMY');
  const [passengerCount, setPassengerCount] = useState(1);
  const [passengers, setPassengers] = useState([{ name: user?.full_name || '', ic_number: '' }]);
  const [loading, setLoading] = useState(false);
  const [step] = useState(1);
  const [error, setError] = useState('');

  if (!flight) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="mb-4">Không có thông tin chuyến bay</p>
            <Button onClick={() => navigate('/')}>Quay lại tìm kiếm</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN').format(price) + ' đ';
  };

  const getPrice = () => {
    return classType === 'ECONOMY' ? flight.economy_price : flight.business_price;
  };

  const getTotalPrice = () => {
    return getPrice() * passengerCount;
  };

  const handlePassengerCountChange = (count) => {
    const newCount = parseInt(count);
    setPassengerCount(newCount);
    
    const newPassengers = [...passengers];
    while (newPassengers.length < newCount) {
      newPassengers.push({ name: '', ic_number: '' });
    }
    while (newPassengers.length > newCount) {
      newPassengers.pop();
    }
    setPassengers(newPassengers);
  };

  const updatePassenger = (index, field, value) => {
    const newPassengers = [...passengers];
    newPassengers[index] = { ...newPassengers[index], [field]: value };
    setPassengers(newPassengers);
  };

  const handleSubmitBooking = async (proceedToPayment = true) => {
    // Validate
    for (let i = 0; i < passengers.length; i++) {
      if (!passengers[i].name || !passengers[i].ic_number) {
        setError(`Vui lòng điền đầy đủ thông tin hành khách ${i + 1}`);
        return;
      }
    }

    setLoading(true);
    setError('');

    try {
      const result = await createBooking(user.id, flight.id, classType, passengers);
      
      if (result.success) {
        if (proceedToPayment) {
          // Điều hướng sang trang thanh toán riêng
          navigate('/payments', { state: { booking: result.booking, flight: { 
            flight_code: flight.flight_code,
            origin_code: flight.origin.code,
            dest_code: flight.destination.code,
          } } });
        } else {
          // Đặt vé nhưng chưa thanh toán: chuyển sang lịch sử
          navigate('/history');
        }
      } else {
        setError(result.message || 'Đặt vé thất bại');
      }
    } catch (err) {
      setError('Lỗi kết nối server');
    } finally {
      setLoading(false);
    }
  };

  // Đã tách sang trang Payments riêng

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <Button variant="ghost" onClick={() => navigate('/')} className="mb-4">
          ← Quay lại
        </Button>

        {/* Flight Summary */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-sky-700">{flight.flight_code}</span>
              <span className="text-gray-400">|</span>
              <span>{flight.origin.code} → {flight.destination.code}</span>
            </CardTitle>
            <CardDescription>
              {flight.origin.city} đến {flight.destination.city}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Step 1: Passenger Info */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Thông tin đặt vé</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Class & Count Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Hạng vé</Label>
                  <Select value={classType} onValueChange={setClassType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ECONOMY">
                        Phổ thông - {formatPrice(flight.economy_price)}
                      </SelectItem>
                      <SelectItem value="BUSINESS">
                        Thương gia - {formatPrice(flight.business_price)}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Số hành khách</Label>
                  <Select value={String(passengerCount)} onValueChange={handlePassengerCountChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map(n => (
                        <SelectItem key={n} value={String(n)}>{n} người</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Passenger Forms */}
              {passengers.map((p, i) => (
                <div key={i} className="p-4 border rounded-lg space-y-4">
                  <h3 className="font-medium">Hành khách {i + 1}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Họ và tên</Label>
                      <Input
                        value={p.name}
                        onChange={(e) => updatePassenger(i, 'name', e.target.value)}
                        placeholder="Nhập họ tên"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>CMND/CCCD</Label>
                      <Input
                        value={p.ic_number}
                        onChange={(e) => updatePassenger(i, 'ic_number', e.target.value)}
                        placeholder="Nhập số CMND/CCCD"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {/* Total */}
              <div className="flex justify-between items-center p-4 bg-sky-50 rounded-lg">
                <span className="font-medium">Tổng tiền:</span>
                <span className="text-2xl font-bold text-sky-600">
                  {formatPrice(getTotalPrice())}
                </span>
              </div>

              {error && (
                <div className="text-red-500 text-sm bg-red-50 p-3 rounded">{error}</div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Button onClick={() => handleSubmitBooking(false)} disabled={loading} variant="outline">
                  {loading ? '...' : 'Đặt vé'}
                </Button>
                <Button onClick={() => handleSubmitBooking(true)} disabled={loading} className="">
                  {loading ? 'Đang xử lý...' : 'Tiếp tục thanh toán'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
