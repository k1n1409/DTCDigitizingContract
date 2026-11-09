# Bước tiếp theo và bộ lọc công việc

## Sử dụng

- Trong **Chi tiết hợp đồng**, xem khung **Bước tiếp theo**. Nút bên cạnh mở đúng tab; với nghiệm thu, thanh toán và checklist hoàn tất, nút còn cuộn tới đúng phần. Khung chỉ hướng dẫn, không tự chuyển trạng thái hoặc cấp thêm quyền.
- Trong **Danh sách hợp đồng**, mở **Bộ lọc công việc**, chọn điều kiện rồi bấm **Áp dụng**. Bộ lọc kết hợp với từ khóa, loại, chiều giao dịch và trạng thái; server lọc trước khi phân trang. Phòng ban là phòng ban của nhân viên phụ trách.
- **Lưu bộ lọc** lưu tổ hợp hiện tại cho tài khoản trong tenant đang đăng nhập. Mở **Bộ lọc đã lưu** để áp dụng lại hoặc xóa. Xóa bộ lọc không xóa hợp đồng.
- Mẫu có sẵn **Của tôi sắp hết hạn (30 ngày)** chỉ lấy hợp đồng đã ký, đang thực hiện, do mình phụ trách. Khoảng hết hạn tính lại theo ngày Việt Nam, gồm hôm nay và ngày cuối.
- Khoảng giá trị lọc theo tổng hợp đồng, không quy đổi tiền tệ. Có thể chọn đơn vị tiền để so sánh cùng loại. Lọc thanh toán xét version hiện hành và không tính giao dịch đã hoàn tác.

## Quay lại danh sách sau khi xử lý

Mở hồ sơ từ danh sách rồi bấm **Quay lại danh sách** hoặc dùng nút Back của trình duyệt. Trong cùng tab, bộ lọc đã áp dụng, phân trang và vị trí cuộn được giữ lại. Nếu trang cũ không còn kết quả, danh sách chuyển về trang cuối còn dữ liệu. Dữ liệu được tải lại; chỉ báo hồ sơ không còn khớp khi backend xác nhận nó không còn trong kết quả lọc.

Ở tab **Đóng hợp đồng**, xem lý do cạnh thao tác hoàn tất, thanh toán và nghiệm thu. Lý do có thể là hồ sơ thiếu điều kiện hoặc tài khoản chỉ có quyền xem.

## Cập nhật cơ sở dữ liệu

Migration `20261104082656_SavedContractWorkFilters` tạo bảng lưu bộ lọc cá nhân. Chạy từ `Source/Backend` cho đúng database tenant (sao lưu trước nếu là môi trường đang sử dụng):

```powershell
dotnet ef database update --project .\ContractManagement.Infrastructure --startup-project .\ContractManagement.API --context DbDtctechContext --connection "<chuỗi kết nối database tenant>"
```

Khởi động lại backend sau khi cập nhật. Không dùng chuỗi kết nối database Central cho migration này.
