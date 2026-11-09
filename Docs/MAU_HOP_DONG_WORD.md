# Mẫu hợp đồng Word

Mở **Mẫu hợp đồng Word** từ dashboard hoặc sidebar, hoặc bấm **Tạo từ mẫu Word** ở danh sách hợp đồng.

Luồng tạo từ Word có ba bước: **Thông tin hợp đồng** (gồm thời hạn), **Rà soát dữ liệu từ Word** (sản phẩm và điều khoản), **Xem và lưu nháp**. Danh mục đầy đủ, phụ lục và chi tiết hồ sơ chỉ mở khi cần. Luồng tạo theo biểu mẫu nâng cao giữ bốn bước.

Hai luồng có đường dẫn riêng. Nút **Tạo hợp đồng từ tài liệu này** trong trình soạn mở `/contracts/create-from-word` với ID và phiên bản của bản Word đã lưu. **Tạo nháp theo biểu mẫu** vẫn mở `/contracts/create`. Link Word theo đường dẫn cũ được chuyển tiếp sang luồng mới.

- **Từ hợp đồng Word cũ:** Bấm **Nhập Word làm mẫu**, tải DOCX và rà soát. Nếu cần tạo ô điền, bôi đen giá trị trong tài liệu và gán trường. Khi **Lưu thành mẫu**, chọn các vùng cần chuyển thành ô điền. File gốc được giữ nguyên.
- **Từ bản soạn:** Bấm **Soạn mẫu mới**, soạn nội dung rồi **Lưu thành mẫu mới**. Các giá trị liên kết được bỏ để điền lại; chữ gõ trực tiếp vẫn được giữ.
- **Dùng lại:** Bấm **Dùng mẫu** để mở bản sao. Điền dữ liệu, xem trước rồi bấm **Tạo hợp đồng từ tài liệu này**. Chế độ mặc định **Dùng bản Word đã soạn** không cần mẫu placeholder đã phát hành. Chọn khách hàng và sản phẩm, sau đó nhập ít nhất một điều khoản. Để lập lịch, thêm điều khoản loại **Thanh toán** rồi nhập từng đợt theo Word (tỷ lệ, mốc và số ngày). Khi có điều khoản thanh toán, các đợt phải đủ 100% trước khi gửi duyệt.
- **Rà soát:** Dữ liệu nghiệp vụ không tự viết lại Word. Đối chiếu nội dung và lịch thanh toán trước khi xác nhận tạo. Draft gắn bản Word đã rà soát vào version đầu tiên; không ghi đè mẫu. Khi dữ liệu nghiệp vụ đổi sau khi ghim, hệ thống yêu cầu đối chiếu và ghim lại trước khi gửi duyệt.

Trước khi lưu mẫu dùng chung, kiểm tra dữ liệu khách hàng trong văn bản, ảnh, header/footer và thông tin ẩn của Word. Hệ thống không tự xóa hết thông tin riêng. Chỉ người có quyền quản lý mẫu mới có thể lưu mẫu dùng chung.

Ở bước **Sản phẩm**, bấm **Lấy từ bảng trong Word** để chọn bảng đơn giản có cột tên, số lượng và đơn giá. Kiểm tra sản phẩm/dịch vụ đã ghép với danh mục, sửa hoặc bỏ chọn dòng cần xử lý rồi xác nhận. Hệ thống lấy số lượng và đơn giá đã rà soát, dùng đơn vị danh mục, không suy ra VAT/chiết khấu. Nếu chưa có mục khớp, người có quyền có thể tạo nhanh ngay trong luồng đối chiếu. Bảng song ngữ được nhận diện; dòng tổng cộng ghép ô được bỏ qua. Bảng ghép ô trong các dòng sản phẩm hoặc trên 100 dòng cần nhập thủ công.

Luồng Word hiện hỗ trợ **hợp đồng cung cấp phần mềm**, theo phạm vi của bộ dựng tài liệu chính thức hiện tại. Ở bước thiết lập, mục **Nguồn tài liệu hợp đồng** hiển thị ảnh trang đầu, tên và phiên bản Word đã soạn. Mẫu nâng cao vẫn dùng được qua luồng tạo theo biểu mẫu cũ.

Ở bước **Điều khoản**, bấm **Lấy điều khoản từ Word**. Đặt tiêu đề điều khoản thành đoạn riêng, ví dụ **Điều 1. Phạm vi công việc**, để hệ thống nhận diện tiêu đề và phần nội dung bên dưới. Xem trước, chọn các mục cần lấy rồi chỉnh lại trong bộ soạn điều khoản nếu cần. Không ghi đè điều khoản đã có hoặc sửa file Word. Với hợp đồng song ngữ, rà soát và bổ sung trường tiếng Anh; các đợt thanh toán cần cấu hình riêng.

Ở bước **Xem trước**, mở **Xem PDF để đối chiếu** để xem đúng phiên bản Word dùng tạo Nháp. Bên dưới là dữ liệu sẽ lưu, gồm số lượng, đơn giá, tổng và nội dung điều khoản. Các dòng lấy từ Word có số liệu nguồn để đối chiếu; điều khoản đã sửa sau khi lấy cũng được đánh dấu. Xác nhận đối chiếu trước khi lưu. Nếu chưa khớp, cập nhật bản Word hoặc dữ liệu nghiệp vụ; hai bên không tự ghi đè lẫn nhau.

Trước khi dùng luồng mới, chạy migration `20261106024615_WordOnlyContractDrafts` trên **database tenant** và khởi động lại backend. Từ `Source/Backend`:

```powershell
dotnet ef database update --project .\ContractManagement.Infrastructure --startup-project .\ContractManagement.API --context DbDtctechContext --connection "<chuỗi kết nối database tenant>"
```

Không rollback migration này khi đã có hợp đồng tạo trực tiếp từ Word.
