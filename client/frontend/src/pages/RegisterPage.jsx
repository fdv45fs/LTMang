import { useState } from 'react';
import {useNavigate} from 'react-router-dom';
import {useAuth} from '@/context/AuthContext';
import {register as apiRegister} from '@/lib/api';
import {Button} from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card';

export default function RegisterPage(){
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        username: '',
        password: '',
        confirmPassword: '',
        full_name: '',
        email: '',
        phone: ''
    });
    const handleChange = (e) => {
        const {id, value} = e.target;
        setFormData((prevData) => ({
            ...prevData,
            [id]: value
        }));
    }
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
        if(formData.password !== formData.confirmPassword){
            setError('Mật khẩu không khớp');
            return;
        }
        
        setLoading(true);
        try{
            const { confirmPassword, ...payload } = formData;
            const result = await apiRegister(payload);
            if(result.success){
                navigate('/login');
            } else {
                setError(result.message || 'Đăng ký thất bại');
            }
        }
        catch(err){
            setError('Lỗi kết nối server');
        }
        finally{
            setLoading(false);
        }
    }

    return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-100 to-blue-200 p-4">
      <Card className="w-full max-w-md shadow-xl my-8">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-sky-700">Đăng Ký Tài Khoản</CardTitle>
          <CardDescription>Nhập thông tin để tạo tài khoản mới</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Tên đăng nhập */}
            <div className="space-y-2">
              <Label htmlFor="username">Tên đăng nhập</Label>
              <Input id="username" value={formData.username} onChange={handleChange} required placeholder="Ví dụ: nguyenvana" />
            </div>

            {/* Mật khẩu */}
            <div className="space-y-2">
              <Label htmlFor="password">Mật khẩu</Label>
              <Input id="password" type="password" value={formData.password} onChange={handleChange} required />
            </div>

            {/* Nhập lại mật khẩu */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Nhập lại mật khẩu</Label>
              <Input id="confirmPassword" type="password" value={formData.confirmPassword} onChange={handleChange} required />
            </div>

            {/* Tên đầy đủ */}
            <div className="space-y-2">
              <Label htmlFor="full_name">Tên đầy đủ</Label>
              <Input id="full_name" value={formData.full_name} onChange={handleChange} required placeholder="Nguyễn Văn A" />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={formData.email} onChange={handleChange} required placeholder="email@example.com" />
            </div>

            {/* Số điện thoại */}
            <div className="space-y-2">
              <Label htmlFor="phone">Số điện thoại</Label>
              <Input id="phone" value={formData.phone} onChange={handleChange} placeholder="0912345678" />
            </div>

            {/* Thông báo lỗi */}
            {error && (
              <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">
                {error}
              </div>
            )}

            {/* Nút đăng ký */}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Đang xử lý...' : 'Đăng ký'}
            </Button>

            {/* Link quay lại đăng nhập */}
            <div className="mt-4 text-center text-sm">
              Đã có tài khoản?{" "}
              <span 
                className="text-blue-600 hover:underline cursor-pointer font-medium"
                onClick={() => navigate('/login')}
              >
                Đăng nhập ngay
              </span>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}