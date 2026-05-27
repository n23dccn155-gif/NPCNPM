# Hệ Thống Phân Công Chuyến Xe Buýt TP.HCM 🚌

Hệ thống quản lý và phân công chuyến xe buýt toàn diện, được thiết kế với kiến trúc Frontend - Backend tách biệt và hỗ trợ phân quyền nhiều vai trò (Role-based access control).

## Công nghệ sử dụng

- **Frontend:** ReactJS (Vite), Tailwind CSS v4, React Router, Axios.
- **Backend:** Node.js, Express.js, JWT (JSON Web Tokens) cho xác thực, bcrypt để băm mật khẩu.
- **Database:** PostgreSQL.

## Các vai trò trong hệ thống (Roles)

Hệ thống hỗ trợ 4 vai trò với các quyền hạn khác nhau:

1. **Admin (Quản trị viên):** Quản lý tài khoản người dùng, cấu hình tham số hệ thống.
2. **Manager (Quản lý):** Quản lý danh mục (tuyến xe, xe buýt, tài xế), duyệt yêu cầu nghỉ phép, xem báo cáo thống kê.
3. **Dispatcher (Điều phối viên):** Lập chuyến, phân công tài xế/xe buýt, xử lý sự cố, theo dõi quá trình thực hiện chuyến.
4. **Driver (Tài xế):** Xem lịch làm việc, xin nghỉ phép, báo cáo sự cố trên tuyến.

---

## Hướng dẫn cài đặt và chạy dự án (Local)

### 1. Cài đặt Cơ sở dữ liệu (PostgreSQL)

1. Cài đặt PostgreSQL và phần mềm quản lý (như DBeaver hoặc pgAdmin).
2. Tạo một database trống với tên là `bus_trip_db`.
3. Thông tin kết nối mặc định được cấu hình trong file `backend/.env`.

### 2. Khởi chạy Backend

Mở Terminal tại thư mục gốc của dự án và chạy các lệnh sau:

```bash
cd backend

# Cài đặt thư viện (Bắt buộc chạy để tải node_modules về)
npm install

# Tạo file biến môi trường (Chỉ làm lần đầu khi clone)
cp .env.example .env
# Mở file .env vừa tạo lên và sửa mật khẩu database của bạn vào mục DB_PASSWORD

# Khởi tạo CSDL (Tạo bảng và nạp dữ liệu mẫu - Chỉ chạy lần đầu)
npm run db:init

# Chạy server
npm start
```

*Server Backend sẽ chạy tại: `http://localhost:5000`*

### 3. Khởi chạy Frontend

Mở một cửa sổ Terminal mới tại thư mục gốc của dự án:

```bash
cd frontend

# Cài đặt thư viện (Bắt buộc chạy để tải node_modules về)
npm install

# Chạy web frontend
npm run dev
```

*Web Frontend sẽ chạy tại: `http://localhost:5173` (Hoặc cổng hiển thị trên terminal)*

---

## Tài khoản Demo

Sau khi chạy thành công `npm run db:init`, hệ thống đã có sẵn các tài khoản sau để bạn đăng nhập thử nghiệm (Tất cả đều có chung **Mật khẩu: 123456**):

| Tên đăng nhập | Vai trò                        | Mật khẩu |
| :---------------- | :------------------------------ | :--------- |
| `admin`         | Admin (Quản trị viên)        | 123456     |
| `manager1`      | Manager (Quản lý)             | 123456     |
| `dispatcher1`   | Dispatcher (Điều phối viên) | 123456     |
| `driver1`       | Driver (Tài xế)               | 123456     |
| `driver2`       | Driver (Tài xế)               | 123456     |

---

## Cấu trúc thư mục chính

```text
NPCNPM/
├── backend/                  # Mã nguồn Node.js/Express
│   ├── src/
│   │   ├── controllers/      # Xử lý logic nghiệp vụ
│   │   ├── middlewares/      # Xác thực JWT, phân quyền
│   │   ├── routes/           # Định nghĩa các API endpoints
│   │   ├── config/           # Cấu hình kết nối Database
│   │   └── server.js         # File khởi chạy server
│   └── .env                  # Biến môi trường Backend
├── frontend/                 # Mã nguồn ReactJS/Vite
│   ├── src/
│   │   ├── components/       # Các UI Component dùng chung (Layout, Modal,...)
│   │   ├── context/          # Quản lý state toàn cục (AuthContext)
│   │   ├── pages/            # Giao diện các màn hình theo từng vai trò
│   │   ├── services/         # Gọi API (Axios)
│   │   └── App.jsx           # Định tuyến (Routing)
└── database/                 # Các script SQL tự động tạo bảng và dữ liệu mẫu
```
