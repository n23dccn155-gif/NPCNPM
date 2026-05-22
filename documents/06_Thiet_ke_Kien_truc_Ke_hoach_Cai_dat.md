THIẾT KẾ KIẾN TRÚC VÀ KẾ HOẠCH CÀI ĐẶT

1. Mục tiêu thiết kế kiến trúc
Sau khi đã hoàn thành các bước khảo sát hiện trạng, xác định yêu cầu, phân tích Use Case, thiết kế cơ sở dữ liệu, thiết kế giao diện web và thiết kế xử lý, hệ thống cần được tổ chức thành một kiến trúc rõ ràng để phục vụ quá trình lập trình, kiểm thử và trình bày đồ án.
Phần mềm Phân công chuyến xe buýt ở Thành phố Hồ Chí Minh được xây dựng theo hướng ứng dụng web nội bộ. Người dùng truy cập hệ thống thông qua trình duyệt web và sử dụng các chức năng phù hợp với vai trò của mình, gồm:
- Quản trị viên hệ thống.
- Quản lý.
- Nhân viên điều phối.
- Tài xế.

Mục tiêu của thiết kế kiến trúc là:
| STT | Mục tiêu | Mô tả |
|---|---|---|
| 1 | Tách biệt các thành phần hệ thống | Phân chia rõ giao diện người dùng, xử lý nghiệp vụ và lưu trữ dữ liệu |
| 2 | Phù hợp với nghiệp vụ đã phân tích | Kiến trúc hỗ trợ đầy đủ quản lý danh mục, lập chuyến, phân công, xử lý phát sinh và báo cáo |
| 3 | Dễ cài đặt | Mỗi module có nhiệm vụ riêng, thuận tiện chia công việc cho nhóm |
| 4 | Dễ kiểm thử | Có thể kiểm thử chức năng thông qua giao diện web và API backend |
| 5 | Dễ mở rộng | Có thể bổ sung thông báo nội bộ, nhật ký hệ thống, xuất báo cáo hoặc GPS trong tương lai |
| 6 | Phù hợp phạm vi đồ án | Kiến trúc đủ rõ ràng và thực tế nhưng không quá phức tạp đối với môn Nhập môn Công nghệ phần mềm |


2. Kiến trúc tổng thể của hệ thống
2.1. Mô hình kiến trúc được lựa chọn
Hệ thống được thiết kế theo mô hình ứng dụng web gồm ba lớp chính:
Người dùng
   ↓
Frontend — Giao diện web
   ↓ HTTP/REST API
Backend — Xử lý nghiệp vụ và phân quyền
   ↓ SQL Query
Database — Cơ sở dữ liệu PostgreSQL

Ba lớp chính gồm:
| Lớp | Vai trò | Công nghệ dự kiến |
|---|---|---|
| Lớp giao diện người dùng | Hiển thị màn hình, nhận thao tác, gửi yêu cầu đến backend và hiển thị kết quả | ReactJS, Vite, Tailwind CSS |
| Lớp xử lý nghiệp vụ | Xác thực đăng nhập, phân quyền, xử lý phân công, kiểm tra ràng buộc, xử lý phát sinh và lập báo cáo | Node.js, ExpressJS |
| Lớp dữ liệu | Lưu trữ tài khoản, danh mục, chuyến xe, phân công, yêu cầu nghỉ, sự cố, nhật ký chuyến và cấu hình | PostgreSQL |


2.2. Diễn giải hoạt động của kiến trúc
Người dùng truy cập phần mềm bằng trình duyệt web. Giao diện frontend hiển thị các màn hình tùy theo vai trò đăng nhập.
Ví dụ:
- Quản trị viên hệ thống nhìn thấy màn hình quản lý tài khoản, phân quyền và cấu hình hệ thống.
- Quản lý nhìn thấy màn hình quản lý tuyến xe, xe buýt, tài xế, duyệt nghỉ và báo cáo.
- Nhân viên điều phối nhìn thấy màn hình lập chuyến, phân công chuyến, điều chỉnh phân công, xử lý sự cố và theo dõi chuyến.
- Tài xế nhìn thấy màn hình lịch làm việc cá nhân, yêu cầu nghỉ và báo sự cố.

Khi người dùng thực hiện thao tác, frontend gửi yêu cầu đến backend thông qua API. Backend thực hiện các công việc:
- Kiểm tra người dùng đã đăng nhập hay chưa.
- Kiểm tra người dùng có quyền thực hiện chức năng hay không.
- Kiểm tra dữ liệu nhập vào.
- Xử lý các quy tắc nghiệp vụ.
- Truy vấn hoặc cập nhật cơ sở dữ liệu PostgreSQL.
- Trả kết quả về frontend để hiển thị.

Ví dụ về nghiệp vụ phân công chuyến:
Nhân viên điều phối chọn chuyến, xe và tài xế
        ↓
Frontend gửi yêu cầu kiểm tra phân công đến Backend
        ↓
Backend kiểm tra:
- Chuyến đã có phiếu phân công hiện hành chưa
- Xe có đang hoạt động không
- Tài xế có đang làm việc không
- Tài xế có nghỉ đã duyệt trong thời gian chuyến không
- Xe hoặc tài xế có trùng lịch không
- Tài xế có lái liên tục quá giới hạn không
        ↓
Backend truy vấn PostgreSQL và xử lý kết quả
        ↓
Frontend hiển thị:
- Phân công hợp lệ; hoặc
- Danh sách cảnh báo và không cho lưu


2.3. Sơ đồ kiến trúc tổng thể
+------------------------------------------------------------------+
|                         NGƯỜI DÙNG                              |
| Admin | Quản lý | Nhân viên điều phối | Tài xế                  |
+-------------------------------+----------------------------------+
                                |
                                | Trình duyệt web
                                v
+------------------------------------------------------------------+
|                         FRONTEND                                 |
|                 ReactJS + Vite + Tailwind CSS                   |
|                                                                  |
| - Giao diện đăng nhập                                            |
| - Dashboard theo vai trò                                         |
| - Danh mục tuyến, xe, tài xế                                    |
| - Lập chuyến, phân công, điều chỉnh phân công                   |
| - Xin nghỉ, báo sự cố, theo dõi chuyến                          |
| - Báo cáo và cấu hình                                            |
+-------------------------------+----------------------------------+
                                |
                                | REST API / JSON
                                v
+------------------------------------------------------------------+
|                          BACKEND                                 |
|                    Node.js + ExpressJS                          |
|                                                                  |
| - Xác thực và phân quyền                                         |
| - Kiểm tra dữ liệu nhập                                          |
| - Xử lý nghiệp vụ phân công                                      |
| - Kiểm tra xung đột và lái liên tục                              |
| - Xử lý nghỉ phép, xe hỏng                                       |
| - Theo dõi chuyến và lập báo cáo                                 |
+-------------------------------+----------------------------------+
                                |
                                | SQL Query
                                v
+------------------------------------------------------------------+
|                          DATABASE                                |
|                         PostgreSQL                              |
|                                                                  |
| roles, users, routes, buses, drivers, trips,                    |
| trip_assignments, trip_logs, leave_requests,                    |
| incident_reports, configurations                                |
+------------------------------------------------------------------+


3. Lựa chọn công nghệ triển khai
3.1. Danh sách công nghệ dự kiến
| Thành phần | Công nghệ lựa chọn | Vai trò trong hệ thống |
|---|---|---|
| Thiết kế giao diện mẫu | Figma | Thiết kế prototype, bố cục và luồng màn hình |
| Frontend | ReactJS + Vite | Xây dựng giao diện web và quản lý component |
| Thiết kế giao diện | Tailwind CSS | Xây dựng bố cục và định dạng giao diện nhanh, thống nhất |
| Backend | Node.js + ExpressJS | Xây dựng REST API và xử lý nghiệp vụ |
| Cơ sở dữ liệu | PostgreSQL | Lưu trữ dữ liệu quan hệ của hệ thống |
| Kết nối PostgreSQL | Thư viện pg | Kết nối backend Node.js với PostgreSQL |
| Xác thực mật khẩu | bcrypt | Băm mật khẩu trước khi lưu |
| Quản lý đăng nhập | JSON Web Token hoặc phiên đăng nhập | Xác thực người dùng khi gọi API |
| Quản lý biến môi trường | dotenv | Lưu thông tin kết nối database và khóa bí mật |
| Kiểm thử API | Postman | Gửi request và kiểm tra kết quả API |
| Quản lý cơ sở dữ liệu | pgAdmin hoặc DBeaver | Tạo bảng, xem dữ liệu và kiểm thử truy vấn |
| Môi trường lập trình | Visual Studio Code | Viết mã nguồn frontend, backend và SQL |
| Quản lý mã nguồn | Git và GitHub | Lưu phiên bản và hỗ trợ làm việc nhóm |


3.2. Lý do chọn ReactJS và Vite cho frontend
Frontend được xây dựng bằng ReactJS kết hợp Vite vì:
- Phù hợp với ứng dụng web có nhiều màn hình và vai trò người dùng.
- Dễ chia giao diện thành các component dùng lại như bảng dữ liệu, form nhập liệu, sidebar và hộp cảnh báo.
- Thuận tiện chuyển thiết kế từ Figma sang giao diện có thể lập trình và kết nối API.
- Vite hỗ trợ khởi tạo và chạy project nhanh, phù hợp với quá trình phát triển đồ án.

Các thành phần giao diện có thể được tái sử dụng gồm:
| Component | Mục đích |
|---|---|
| Layout | Bố cục tổng thể gồm header, sidebar và nội dung |
| Sidebar | Hiển thị menu theo vai trò |
| DataTable | Hiển thị bảng danh sách tuyến, xe, tài xế, chuyến |
| FormInput | Chuẩn hóa các ô nhập liệu |
| StatusBadge | Hiển thị trạng thái bằng nhãn màu |
| AlertBox | Hiển thị lỗi hoặc cảnh báo xung đột |
| ConfirmDialog | Xác nhận thao tác ngưng hoạt động/ngưng sử dụng |


3.3. Lý do chọn Node.js và ExpressJS cho backend
Backend được xây dựng bằng Node.js và ExpressJS vì:
- Phù hợp với frontend ReactJS do cùng sử dụng JavaScript.
- Dễ tổ chức API theo từng module chức năng.
- Thuận tiện xử lý các nghiệp vụ như phân quyền, phân công, kiểm tra xung đột và báo cáo.
- Phù hợp với phạm vi đồ án web nội bộ.

Backend chịu trách nhiệm xử lý các nghiệp vụ quan trọng, đặc biệt là:
- Không cho phép lập chuyến từ tuyến đã ngưng hoạt động.
- Không cho phép phân công xe hỏng hoặc xe ngưng sử dụng.
- Không cho phép phân công tài xế tạm nghỉ, ngưng làm việc hoặc có yêu cầu nghỉ đã duyệt.
- Không cho phép xe hoặc tài xế bị trùng lịch.
- Kiểm tra thời gian lái xe liên tục.
- Bảo toàn lịch sử phân công khi đổi xe hoặc đổi tài xế.
- Không xóa vật lý tuyến, xe hoặc tài xế đã phát sinh lịch sử vận hành.

3.4. Lý do chọn PostgreSQL cho cơ sở dữ liệu
Hệ thống sử dụng PostgreSQL vì dữ liệu có cấu trúc quan hệ rõ ràng và cần nhiều ràng buộc giữa các bảng, ví dụ:
- Tài khoản liên kết với vai trò.
- Tài xế liên kết với tài khoản.
- Chuyến xe liên kết với tuyến xe.
- Phiếu phân công liên kết với chuyến, xe, tài xế và người điều phối.
- Nhật ký thực hiện chuyến liên kết với chuyến và phiếu phân công.
- Yêu cầu nghỉ liên kết với tài xế và người xử lý.
- Sự cố liên kết với xe, tài xế và có thể liên kết với chuyến.

PostgreSQL phù hợp vì hỗ trợ:
| Khả năng | Ứng dụng trong hệ thống |
|---|---|
| Khóa chính và khóa ngoại | Bảo đảm liên kết giữa các bảng |
| UNIQUE | Không trùng tên đăng nhập, biển số xe hoặc tài khoản tài xế |
| CHECK | Kiểm tra trạng thái, số chỗ, thời gian và số phút trễ |
| IDENTITY | Tự sinh mã số cho các bảng cần khóa số |
| Partial Unique Index | Bảo đảm mỗi chuyến chỉ có một phiếu phân công active tại một thời điểm |
| Truy vấn tổng hợp | Tạo báo cáo tuyến, xe và tài xế |

Trong quá trình cài đặt, tên bảng và cột được đặt bằng chữ thường, ví dụ:
roles, users, routes, buses, drivers, trips, trip_assignments, trip_logs, leave_requests, incident_reports, configurations

Các kiểu dữ liệu chính sử dụng trong PostgreSQL gồm:
| Mục đích | Kiểu dữ liệu |
|---|---|
| Mã số tự tăng | INTEGER GENERATED ALWAYS AS IDENTITY |
| Chuỗi ký tự | VARCHAR(n) |
| Nội dung dài | TEXT |
| Ngày | DATE |
| Giờ | TIME |
| Ngày giờ | TIMESTAMP |


4. Mô hình triển khai hệ thống
4.1. Mô hình frontend, backend và database tách riêng
Hệ thống triển khai theo hướng frontend và backend tách riêng. Frontend không truy cập trực tiếp cơ sở dữ liệu mà luôn gửi yêu cầu thông qua backend.
+--------------------------+
|        Trình duyệt       |
|       Người dùng         |
+------------+-------------+
             |
             | HTTP Request / Response
             v
+--------------------------+
|        Frontend          |
| ReactJS + Vite + Tailwind|
+------------+-------------+
             |
             | REST API / JSON
             v
+--------------------------+
|         Backend          |
| Node.js + ExpressJS      |
| Xác thực + Nghiệp vụ     |
+------------+-------------+
             |
             | SQL Query
             v
+--------------------------+
|        PostgreSQL        |
|    Cơ sở dữ liệu hệ thống|
+--------------------------+


4.2. Trách nhiệm của frontend
Frontend chịu trách nhiệm hiển thị giao diện và nhận thao tác người dùng.
| Nhóm chức năng | Nội dung frontend thực hiện |
|---|---|
| Đăng nhập | Hiển thị form đăng nhập, gửi thông tin đăng nhập |
| Điều hướng | Hiển thị menu theo vai trò |
| Quản lý danh mục | Hiển thị danh sách, form thêm/sửa tuyến, xe và tài xế |
| Chuyến xe | Hiển thị danh sách chuyến và form lập chuyến |
| Phân công | Cho phép chọn xe, tài xế và hiển thị cảnh báo kiểm tra |
| Điều chỉnh phân công | Hiển thị phân công hiện tại và phương án thay thế |
| Nghỉ phép | Hiển thị form gửi nghỉ và màn hình duyệt nghỉ |
| Sự cố | Hiển thị form báo sự cố và danh sách xử lý sự cố |
| Theo dõi chuyến | Nhập giờ thực tế, trạng thái và hiển thị số phút trễ |
| Báo cáo | Hiển thị bộ lọc và bảng số liệu thống kê |
| Cấu hình | Hiển thị và cập nhật tham số cấu hình |

Frontend được xây dựng dựa trên prototype Figma đã thiết kế. Tuy nhiên, mã nguồn giao diện sẽ được triển khai lại bằng ReactJS để chủ động chỉnh sửa, kết nối API và quản lý dữ liệu thật.

4.3. Trách nhiệm của backend
Backend là thành phần xử lý nghiệp vụ chính của hệ thống.
| Nhóm xử lý | Trách nhiệm của backend |
|---|---|
| Xác thực | Kiểm tra tên đăng nhập, mật khẩu, trạng thái tài khoản |
| Phân quyền | Kiểm tra vai trò trước khi cho phép thực hiện API |
| Danh mục | Thêm, sửa, tra cứu và chuyển trạng thái tuyến, xe, tài xế |
| Lập chuyến | Kiểm tra tuyến đang hoạt động và thời gian chuyến hợp lệ |
| Phân công | Kiểm tra xe, tài xế, nghỉ đã duyệt, trùng lịch và thời gian lái liên tục |
| Điều chỉnh phân công | Chuyển phiếu cũ sang replaced, tạo phiếu mới active |
| Nghỉ phép | Lưu yêu cầu nghỉ, duyệt/từ chối và xác định chuyến bị ảnh hưởng |
| Sự cố | Lưu sự cố, cập nhật xe hỏng và xử lý chuyến liên quan |
| Theo dõi chuyến | Ghi nhận giờ thực tế, số phút trễ và trạng thái thực hiện |
| Báo cáo | Tổng hợp số liệu theo tuyến, xe và tài xế |
| Cấu hình | Đọc và cập nhật tham số kiểm tra nghiệp vụ |


4.4. Trách nhiệm của cơ sở dữ liệu
PostgreSQL lưu trữ dữ liệu lâu dài của hệ thống.
| Nhóm dữ liệu | Các bảng liên quan |
|---|---|
| Vai trò và tài khoản | roles, users |
| Danh mục vận hành | routes, buses, drivers |
| Chuyến và phân công | trips, trip_assignments, trip_logs |
| Xử lý phát sinh | leave_requests, incident_reports |
| Cấu hình | configurations |
| Mở rộng | notifications, system_logs nếu được triển khai |


5. Kiến trúc xử lý theo module
Hệ thống được chia thành các module độc lập theo chức năng. Việc chia module giúp quá trình lập trình, kiểm thử và phân công công việc rõ ràng hơn.
| STT | Module | Chức năng chính | Vai trò sử dụng |
|---|---|---|---|
| 1 | Module xác thực | Đăng nhập, đăng xuất, xác định người dùng hiện tại | Tất cả |
| 2 | Module tài khoản và phân quyền | Quản lý tài khoản, khóa/mở khóa, gán vai trò | Quản trị viên hệ thống |
| 3 | Module cấu hình hệ thống | Cập nhật thời gian nghỉ tối thiểu, thời gian lái liên tục tối đa | Quản trị viên hệ thống |
| 4 | Module tuyến xe | Thêm, sửa, tra cứu, ngưng hoạt động tuyến | Quản lý |
| 5 | Module xe buýt | Thêm, sửa, tra cứu, cập nhật trạng thái, ngưng sử dụng xe | Quản lý |
| 6 | Module tài xế | Thêm, sửa, tra cứu, cập nhật trạng thái, ngưng làm việc | Quản lý |
| 7 | Module chuyến xe | Lập chuyến, xem danh sách chuyến | Nhân viên điều phối |
| 8 | Module phân công chuyến | Lập phiếu phân công, kiểm tra điều kiện, điều chỉnh phân công | Nhân viên điều phối |
| 9 | Module yêu cầu nghỉ | Gửi nghỉ, duyệt/từ chối nghỉ, tìm chuyến bị ảnh hưởng | Tài xế, Quản lý, Điều phối |
| 10 | Module sự cố | Báo sự cố, xác nhận xe hỏng, xử lý chuyến bị ảnh hưởng | Tài xế, Điều phối |
| 11 | Module theo dõi chuyến | Ghi nhận thực hiện chuyến, tính số phút trễ | Nhân viên điều phối |
| 12 | Module báo cáo | Báo cáo hiệu suất tuyến, sử dụng xe, năng suất tài xế | Quản lý |
| 13 | Module hồ sơ cá nhân | Xem thông tin và đổi mật khẩu | Tất cả |
| 14 | Module mở rộng | Thông báo nội bộ, nhật ký hệ thống, xuất báo cáo | Theo quyền nếu triển khai |


6. Phân quyền chức năng theo vai trò
6.1. Bảng phân quyền tổng quát
| Chức năng | Quản trị viên hệ thống | Quản lý | Nhân viên điều phối | Tài xế |
|---|---|---|---|---|
| Đăng nhập, đăng xuất | ✓ | ✓ | ✓ | ✓ |
| Xem thông tin cá nhân, đổi mật khẩu | ✓ | ✓ | ✓ | ✓ |
| Quản lý tài khoản | ✓ | | | |
| Phân quyền người dùng | ✓ | | | |
| Cấu hình tham số hệ thống | ✓ | | | |
| Quản lý tuyến xe | | ✓ | Chỉ xem khi lập chuyến | |
| Quản lý xe buýt | | ✓ | Chỉ xem/chọn khi phân công | |
| Quản lý tài xế | | ✓ | Chỉ xem/chọn khi phân công | |
| Lập chuyến xe | | | ✓ | |
| Lập phiếu phân công | | | ✓ | |
| Kiểm tra điều kiện phân công | | | ✓ | |
| Điều chỉnh phân công | | | ✓ | |
| Gửi yêu cầu nghỉ | | | | ✓ |
| Duyệt hoặc từ chối nghỉ | | ✓ | | |
| Xử lý chuyến do tài xế nghỉ | | | ✓ | |
| Báo sự cố | | | | ✓ |
| Xử lý sự cố xe hỏng | | | ✓ | |
| Ghi nhận thực hiện chuyến | | | ✓ | |
| Xem báo cáo | | ✓ | | |
| Xem nhật ký hệ thống | Mở rộng | | | |


6.2. Nguyên tắc phân quyền
Việc phân quyền trong hệ thống tuân theo các nguyên tắc sau:
| Nguyên tắc | Nội dung |
|---|---|
| Đúng vai trò | Người dùng chỉ truy cập các chức năng thuộc nhiệm vụ của mình |
| Dữ liệu danh mục do Quản lý phụ trách | Quản lý chịu trách nhiệm thêm, sửa và chuyển trạng thái tuyến, xe, tài xế |
| Điều phối không sửa danh mục gốc | Nhân viên điều phối sử dụng dữ liệu để lập chuyến và phân công, không tự ý thêm hoặc xóa xe/tài xế khỏi danh mục |
| Xử lý khẩn cấp xe hỏng | Khi tiếp nhận sự cố xe hỏng, điều phối có thể làm xe không còn khả dụng để ngăn phân công mới; trạng thái danh mục vẫn được Quản lý theo dõi |
| Dữ liệu lịch sử được bảo toàn | Tuyến, xe và tài xế đã phát sinh dữ liệu vận hành không bị xóa vật lý |
| Kiểm tra quyền ở backend | Không chỉ ẩn nút trên giao diện; backend phải kiểm tra vai trò trước khi thực hiện thao tác |


7. Thiết kế API backend dự kiến
7.1. Nguyên tắc thiết kế API
Backend cung cấp các REST API để frontend trao đổi dữ liệu. API được chia theo module chức năng.
Các nguyên tắc sử dụng:
| Nguyên tắc | Nội dung |
|---|---|
| Đường dẫn rõ nghĩa | API được đặt theo tài nguyên như `/api/routes`, `/api/trips` |
| Phương thức phù hợp | GET để đọc, POST để tạo, PUT/PATCH để cập nhật |
| Không xóa vật lý dữ liệu lịch sử | Dùng PATCH cập nhật trạng thái thay vì DELETE đối với tuyến, xe, tài xế |
| Kiểm tra quyền | Mỗi API cần kiểm tra người dùng đăng nhập và vai trò |
| Kiểm tra nghiệp vụ ở backend | Các quy tắc phân công không chỉ xử lý ở frontend |


7.2. API xác thực và hồ sơ cá nhân
| Phương thức | Đường dẫn API | Người sử dụng | Chức năng |
|---|---|---|---|
| POST | /api/auth/login | Tất cả | Đăng nhập hệ thống |
| POST | /api/auth/logout | Tất cả | Đăng xuất |
| GET | /api/auth/me | Tất cả | Lấy thông tin người dùng đang đăng nhập |
| PUT | /api/profile | Tất cả | Cập nhật thông tin cá nhân |
| PUT | /api/profile/password | Tất cả | Đổi mật khẩu |


7.3. API quản trị hệ thống
| Phương thức | Đường dẫn API | Chức năng |
|---|---|---|
| GET | /api/users | Lấy danh sách tài khoản |
| POST | /api/users | Tạo tài khoản mới |
| PUT | /api/users/:userId | Cập nhật thông tin tài khoản |
| PATCH | /api/users/:userId/status | Khóa, mở khóa hoặc ngưng sử dụng tài khoản |
| PATCH | /api/users/:userId/role | Gán vai trò cho tài khoản |
| GET | /api/configurations | Lấy danh sách cấu hình |
| PUT | /api/configurations/:configKey | Cập nhật giá trị cấu hình |


7.4. API quản lý danh mục của Quản lý
**API tuyến xe**
| Phương thức | Đường dẫn API | Chức năng |
|---|---|---|
| GET | /api/routes | Lấy danh sách tuyến xe |
| GET | /api/routes/:routeCode | Xem chi tiết tuyến xe |
| POST | /api/routes | Thêm tuyến xe |
| PUT | /api/routes/:routeCode | Cập nhật thông tin tuyến |
| PATCH | /api/routes/:routeCode/status | Ngưng hoạt động hoặc kích hoạt lại tuyến |

**API xe buýt**
| Phương thức | Đường dẫn API | Chức năng |
|---|---|---|
| GET | /api/buses | Lấy danh sách xe buýt |
| GET | /api/buses/:busId | Xem chi tiết xe |
| POST | /api/buses | Thêm xe buýt |
| PUT | /api/buses/:busId | Cập nhật thông tin xe |
| PATCH | /api/buses/:busId/status | Cập nhật trạng thái hoạt động, hỏng hoặc ngưng sử dụng |

**API tài xế**
| Phương thức | Đường dẫn API | Chức năng |
|---|---|---|
| GET | /api/drivers | Lấy danh sách tài xế |
| GET | /api/drivers/:driverCode | Xem chi tiết tài xế |
| POST | /api/drivers | Thêm hồ sơ tài xế |
| PUT | /api/drivers/:driverCode | Cập nhật hồ sơ tài xế |
| PATCH | /api/drivers/:driverCode/status | Cập nhật trạng thái làm việc của tài xế |

*Ghi chú*: Đối với tuyến xe, xe buýt và tài xế đã phát sinh dữ liệu lịch sử, hệ thống không cung cấp thao tác xóa vật lý bắt buộc. Thao tác ngừng sử dụng được thực hiện bằng cách cập nhật trạng thái.

7.5. API chuyến xe và phân công
| Phương thức | Đường dẫn API | Chức năng |
|---|---|---|
| GET | /api/trips | Lấy danh sách chuyến xe |
| GET | /api/trips/:tripCode | Xem chi tiết chuyến |
| POST | /api/trips | Lập chuyến xe mới |
| PUT | /api/trips/:tripCode | Cập nhật chuyến chưa thực hiện nếu được phép |
| GET | /api/assignments/schedule | Xem lịch phân công tổng quan |
| POST | /api/assignments/check | Kiểm tra điều kiện phân công |
| POST | /api/assignments | Lập phiếu phân công chuyến |
| POST | /api/assignments/:tripCode/replace | Điều chỉnh phân công chuyến |
| GET | /api/assignments/history/:tripCode | Xem lịch sử phân công của chuyến |

*Xử lý đặc biệt của API phân công:*
API `/api/assignments/check` và `/api/assignments/:tripCode/replace` phải kiểm tra:
- Trạng thái xe.
- Trạng thái tài xế.
- Nghỉ đã duyệt của tài xế.
- Trùng lịch xe.
- Trùng lịch tài xế.
- Thời gian lái liên tục.
- Phiếu phân công hiện hành của chuyến.

7.6. API yêu cầu nghỉ
| Phương thức | Đường dẫn API | Người sử dụng | Chức năng |
|---|---|---|---|
| GET | /api/leave-requests/my | Tài xế | Xem yêu cầu nghỉ của bản thân |
| POST | /api/leave-requests | Tài xế | Gửi yêu cầu nghỉ |
| GET | /api/leave-requests | Quản lý | Xem danh sách yêu cầu nghỉ |
| PATCH | /api/leave-requests/:requestId/review | Quản lý | Duyệt hoặc từ chối yêu cầu nghỉ |
| GET | /api/leave-requests/:requestId/affected-trips | Nhân viên điều phối | Xem chuyến bị ảnh hưởng do yêu cầu nghỉ đã duyệt |

*Dữ liệu xử lý duyệt nghỉ:*
Khi Quản lý xử lý yêu cầu nghỉ, backend cập nhật: `status` = 'approved' hoặc 'rejected', `reviewed_by` = user_id của Quản lý, `reviewed_at` = thời điểm xử lý.
Hệ thống không cập nhật trạng thái nghỉ phép cố định trong bảng `drivers`; việc tài xế có nghỉ trong một chuyến cụ thể được kiểm tra thông qua bảng `leave_requests`.

7.7. API sự cố và xử lý xe hỏng
| Phương thức | Đường dẫn API | Người sử dụng | Chức năng |
|---|---|---|---|
| POST | /api/incidents | Tài xế | Gửi báo cáo sự cố |
| GET | /api/incidents/my | Tài xế | Xem sự cố bản thân đã gửi |
| GET | /api/incidents | Nhân viên điều phối | Xem danh sách sự cố |
| PATCH | /api/incidents/:incidentId/status | Nhân viên điều phối | Cập nhật trạng thái xử lý sự cố |
| GET | /api/incidents/:incidentId/affected-trips | Nhân viên điều phối | Xem chuyến bị ảnh hưởng do xe hỏng |
| POST | /api/incidents/:incidentId/replace-bus | Nhân viên điều phối | Chọn xe thay thế cho chuyến bị ảnh hưởng |

*Ghi chú:*
- Tài xế là người gửi báo cáo sự cố.
- `trip_code` có thể để trống nếu xe hỏng được phát hiện ngoài chuyến cụ thể.
- Khi xác nhận sự cố xe hỏng, xe liên quan được cập nhật trạng thái `broken` để không được phân công mới.
- Hệ thống không quản lý bảo trì chi tiết hoặc chi phí sửa chữa.

7.8. API theo dõi chuyến
| Phương thức | Đường dẫn API | Chức năng |
|---|---|---|
| GET | /api/trip-logs | Xem danh sách theo dõi thực hiện chuyến |
| GET | /api/trip-logs/:tripCode | Xem kết quả thực hiện của một chuyến |
| POST | /api/trip-logs | Tạo bản ghi thực hiện chuyến |
| PUT | /api/trip-logs/:tripCode | Cập nhật bản ghi thực hiện chuyến |

Backend tự động tính:
- Thời điểm xuất bến dự kiến = `trip_date` + `scheduled_departure`
- Số phút trễ = `actual_departure` - Thời điểm xuất bến dự kiến
Nếu số phút tính được nhỏ hơn hoặc bằng 0 thì lưu `delay_minutes = 0`.

7.9. API báo cáo
| Phương thức | Đường dẫn API | Chức năng |
|---|---|---|
| GET | /api/reports/routes | Xem báo cáo hiệu suất tuyến |
| GET | /api/reports/buses | Xem báo cáo tình hình sử dụng xe |
| GET | /api/reports/drivers | Xem báo cáo năng suất tài xế |
| GET | /api/reports/routes/export | Xuất báo cáo tuyến nếu được triển khai |
| GET | /api/reports/buses/export | Xuất báo cáo xe nếu được triển khai |
| GET | /api/reports/drivers/export | Xuất báo cáo tài xế nếu được triển khai |

Các API báo cáo nhận bộ lọc thông qua tham số truy vấn, ví dụ: `from_date`, `to_date`, `route_code`, `bus_id`, `driver_code`.


8. Tổ chức mã nguồn dự kiến
8.1. Cấu trúc thư mục tổng thể
```
bus-trip-assignment-system/
├── frontend/
├── backend/
├── database/
├── documents/
├── .gitignore
└── README.md
```

8.2. Cấu trúc thư mục frontend
```
frontend/
├── public/
├── src/
│   ├── assets/
│   ├── components/
│   ├── pages/
│   ├── services/
│   ├── routes/
│   ├── context/
│   ├── App.jsx
│   └── main.jsx
├── package.json
└── vite.config.js
```

8.3. Cấu trúc thư mục backend
```
backend/
├── src/
│   ├── config/
│   ├── routes/
│   ├── controllers/
│   ├── services/
│   ├── middlewares/
│   ├── utils/
│   ├── app.js
│   └── server.js
├── .env
├── package.json
└── package-lock.json
```

8.4. Cấu trúc thư mục database
```
database/
├── schema.sql
├── constraints.sql
├── indexes.sql
├── seed.sql
├── test_queries.sql
└── reset_database.sql
```


9. Kế hoạch cài đặt hệ thống
Việc cài đặt được chia thành các giai đoạn để nhóm dễ kiểm soát tiến độ và ưu tiên đúng nghiệp vụ trọng tâm.
9.1. Giai đoạn 1 — Chuẩn bị môi trường và mã nguồn
9.2. Giai đoạn 2 — Cài đặt cơ sở dữ liệu PostgreSQL
9.3. Giai đoạn 3 — Cài đặt backend nền tảng
9.4. Giai đoạn 4 — Cài đặt module quản trị và danh mục
9.5. Giai đoạn 5 — Cài đặt nghiệp vụ lập chuyến và phân công
9.6. Giai đoạn 6 — Cài đặt xử lý nghỉ phép và sự cố
9.7. Giai đoạn 7 — Cài đặt theo dõi chuyến và báo cáo
9.8. Giai đoạn 8 — Hoàn thiện giao diện, kiểm thử và chuẩn bị demo


10. Thứ tự ưu tiên cài đặt chức năng
Do phạm vi đồ án tương đối rộng, nhóm cần ưu tiên các chức năng cốt lõi trước khi triển khai phần mở rộng.
| Ưu tiên | Chức năng | Lý do |
|---|---|---|
| 1 | Cơ sở dữ liệu PostgreSQL | Là nền tảng lưu trữ cho toàn bộ hệ thống |
| 2 | Đăng nhập và phân quyền | Bắt buộc trước khi sử dụng các màn hình theo vai trò |
| 3 | Quản lý tuyến, xe và tài xế | Cung cấp dữ liệu nền cho lập chuyến và phân công |
| 4 | Lập chuyến xe | Có chuyến mới thực hiện được nghiệp vụ phân công |
| 5 | Kiểm tra điều kiện phân công | Thể hiện quy tắc nghiệp vụ quan trọng nhất |
| 6 | Lập phiếu phân công chuyến | Là nghiệp vụ trung tâm của đề tài |
| 7 | Điều chỉnh phân công chuyến | Dùng khi đổi xe, đổi tài xế hoặc xử lý phát sinh |
| 8 | Gửi và duyệt yêu cầu nghỉ | Tình huống nghiệp vụ thực tế quan trọng |
| 9 | Báo sự cố và xử lý xe hỏng | Tình huống phát sinh ảnh hưởng trực tiếp đến phân công |
| 10 | Ghi nhận thực hiện chuyến | Cung cấp dữ liệu vận hành thực tế |
| 11 | Báo cáo thống kê | Tổng hợp kết quả từ dữ liệu vận hành |
| 12 | Cấu hình nâng cao, xuất file... | Triển khai nếu còn thời gian |


12. Dữ liệu mẫu phục vụ kiểm thử và demo
12.1. Dữ liệu vai trò và tài khoản
12.2. Dữ liệu danh mục
12.3. Dữ liệu chuyến và phân công
12.4. Dữ liệu tình huống phát sinh


13. Kịch bản demo hệ thống đề xuất
Để trình bày đồ án rõ ràng, nhóm có thể demo theo trình tự sau:
1. Quản trị viên: Đăng nhập, cấu hình giới hạn
2. Quản lý: Xem danh mục, cập nhật trạng thái xe
3. Điều phối: Lập chuyến
4. Điều phối: Phân công hợp lệ
5. Điều phối: Thử phân công lỗi
6. Tài xế: Xin nghỉ
7. Quản lý: Duyệt nghỉ
8. Điều phối: Đổi tài xế
9. Tài xế: Báo xe hỏng
10. Điều phối: Đổi xe
11. Điều phối: Ghi nhận thực hiện chuyến
12. Quản lý: Xem báo cáo


14. Các chức năng mở rộng
(Chỉ triển khai khi có thời gian dư: Thông báo nội bộ, Nhật ký hệ thống, Xuất báo cáo, Dashboard, GPS,...)


15. Kết luận phần thiết kế kiến trúc và kế hoạch cài đặt
Hệ thống Phân công chuyến xe buýt ở Thành phố Hồ Chí Minh được thiết kế theo kiến trúc ứng dụng web ba lớp gồm frontend, backend và cơ sở dữ liệu. 
Phần thiết kế kiến trúc và kế hoạch cài đặt là cơ sở trực tiếp để nhóm bắt đầu xây dựng phần mềm thực tế, đồng thời giúp việc phân chia công việc, kiểm thử, trình bày và bảo vệ đồ án được rõ ràng, nhất quán với toàn bộ nội dung đã phân tích trước đó.
