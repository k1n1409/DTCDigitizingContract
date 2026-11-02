# Phase 3 — Rà soát và chỉnh dữ liệu theo vị trí

## Đã triển khai

### Nhập hợp đồng Word cũ (`/contract-import`)

- Panel dữ liệu dùng thẻ thu gọn; chọn một trường để mở form. Không mở sẵn hàng trăm form.
- Tìm theo tên/giá trị/bên và lọc Chờ rà soát, Đã xác nhận, Bỏ qua; hiển thị số lượng từng trạng thái.
- Click trường đưa tài liệu tới đúng vị trí; click vùng tô sáng mở thẻ tương ứng. Nếu có bộ lọc, thao tác chọn trường sẽ bỏ lọc để không giấu trường vừa chọn.
- Tách giá trị gốc (chỉ đọc) và giá trị thay thế. Ô giá trị có ngắt dòng hiển thị, kéo mở rộng, giới hạn và bộ đếm rõ ràng; không còn ép nội dung dài vào một input ngang.
- Riêng bản rà soát bảo toàn DOCX: giá trị vẫn lưu một dòng, Enter không thêm ngắt dòng; ký tự xuống dòng/tab khi dán được đổi thành khoảng trắng. Đây là giới hạn an toàn hiện có của backend, không phải trình sửa bố cục Word.
- Chỉnh giá trị/tên/bên đưa trường về Chờ rà soát. Chỉ xác nhận mới được đưa vào bản xuất; chặn xác nhận vùng chồng lấn.
- Bôi đen trong một đoạn/ô để gán trường thủ công; có Hủy chọn. Chặn vùng trắng, vùng trên 10.000 ký tự, vùng chỉ xem và chọn xuyên đoạn. Gán trùng đúng vị trí sẽ mở trường cũ thay vì thêm bản trùng.
- Xóa giá trị và Bỏ gán đều có xác nhận; Bỏ gán không xóa văn bản. Xem trước chỉ áp dụng trường đã xác nhận.
- Bản lịch sử vẫn mở/xem các thẻ được, nhưng các ô chỉnh sửa bị khóa.
- Màn hình nhỏ xếp panel phía dưới văn bản; màn hình lớn chia đôi vùng tài liệu/panel, các chuỗi dài có thể xuống dòng.

### Soạn thảo hợp đồng (`/contract-editor`)

- Thẻ nhận diện và thẻ liên kết dữ liệu dùng chung giao diện với màn hình rà soát.
- Giá trị dài dùng textarea có giới hạn/bộ đếm, hiển thị riêng giá trị gốc khi nhận diện.
- Liên kết dữ liệu có tìm trường, lọc trường đang dùng còn thiếu và tổng số trường cần bổ sung.
- Nhóm chọn khách hàng/nhân viên/sản phẩm thu gọn riêng để dành chỗ cho trường đang chỉnh.
- Xóa giá trị nhận diện cần xác nhận, panel rộng hơn trên desktop.

Không thay đổi luồng tạo hợp đồng nghiệp vụ, không tự ghi đè danh mục khách hàng. Editor vẫn sử dụng placeholder cho tài liệu được soạn mới; module nhập Word cũ vẫn gắn vị trí thực tế và không yêu cầu placeholder.

## Checklist UAT

1. Upload DOCX mới hoặc mở hồ sơ Phase 2. Thử tìm trường, lọc trạng thái, mở/đóng từng thẻ.
2. Click thẻ và vùng tô sáng: đúng vị trí/đúng thẻ, kể cả khi có nhiều giá trị giống nhau.
3. Sửa giá trị dài: đọc đủ nội dung, không tràn ngang. Xác nhận, xem trước, lưu rồi mở lại.
4. Bôi đen trong một ô/đoạn, gán tên mới, Hủy chọn, thử gán trùng và thử vùng quá dài.
5. Xác nhận hai vùng chồng lấn: vùng thứ hai phải bị chặn.
6. Bỏ qua: bản xuất giữ giá trị gốc. Bỏ gán: mất thẻ nhưng không mất văn bản. Xóa giá trị: cần xác nhận, chỉ ảnh hưởng bản chỉnh sửa.
7. Xem bản lịch sử: mở được thẻ nhưng không sửa/xóa trường.
8. Tại `/contract-editor`, mở tab Dữ liệu; tìm trường, lọc còn thiếu, nhập giá trị dài và xem preview.
9. Thử ở desktop và điện thoại; kiểm tra bàn phím Tab/Enter mở thẻ, không tràn ngang.

## Kiểm tra kỹ thuật

- TypeScript nguồn và ESLint các file UI đã sửa: đạt.
- Chưa kiểm thử tương tác trực quan trong phiên đăng nhập của người dùng: trình duyệt kiểm thử riêng bị chuyển tới đăng nhập. Checklist UAT ở trên chưa được đánh dấu hoàn tất.
- Không thay schema/API, **không cần migration mới**.
