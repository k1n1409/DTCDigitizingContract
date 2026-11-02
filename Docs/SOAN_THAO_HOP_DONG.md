# Soạn thảo hợp đồng độc lập

Đường dẫn: `/contract-editor`, trong nhóm Hợp đồng trên thanh bên. Yêu cầu quyền tạo hợp đồng của tài khoản nhân viên.

## Sử dụng

1. Chọn Tài liệu trắng để soạn mới hoặc Nhập DOCX để mở tài liệu có sẵn (tối đa 10 MB).
2. Sửa tên tài liệu và nội dung ở khung giữa. Thanh công cụ hỗ trợ định dạng văn bản, bảng và các thao tác editor hiện có.
3. Chọn Nhận diện trường dữ liệu. Bản đầu tìm theo nhãn như `Mã số thuế: ...`, `Địa chỉ: ...`, `Ngày ký: ...` và `{{TEN_TRUONG}}`. Đây là nhận diện theo quy tắc, không phải AI/OCR hay ánh xạ đầy đủ mọi dạng hợp đồng.
4. Sửa giá trị gợi ý rồi chọn Áp dụng. Nút thùng rác xóa giá trị tương ứng trong nội dung, không chỉ ẩn gợi ý. Sau áp dụng/xóa, nhận diện lại để cập nhật danh sách trường.
5. Tài liệu tự lưu trên server sau khi ngừng nhập 2 giây. Có thể bấm Lưu server để lưu ngay. Theo dõi dòng trạng thái; khi lỗi, tự lưu tạm dừng để tránh mất dữ liệu. Sửa lỗi rồi bấm Lưu server để thử lại.
6. Mở Tài liệu của tôi để tìm kiếm, phân trang và tiếp tục trên máy khác bằng cùng tài khoản/tenant. Lịch sử hiển thị các phiên bản đã lưu; Khôi phục đưa nội dung cũ trở lại và tự lưu thành phiên bản mới, không xóa các phiên bản sau.
7. Trong Liên kết dữ liệu thật, chọn khách hàng, nhân viên hoặc sản phẩm. Các trường được lấy từ tenant hiện tại và lưu snapshot cùng nội dung. Nút Lấy lại khách hàng/nhân viên cập nhật snapshot từ nguồn; các chỉnh tay trước đó ở nhóm trường này sẽ bị thay bằng dữ liệu nguồn.
8. Chọn Chèn trường cuối tài liệu hoặc trong danh sách Nhận diện trường, chọn trường liên kết rồi Áp dụng để thay giá trị tĩnh bằng `{{CUSTOMER_NAME}}`, `{{EMPLOYEE_PHONE}}`... Có thể thêm mã trường nhập tay như `CONTRACT_NAME`.
9. Nhiều sản phẩm dùng nhóm trường `PRODUCT_<ID>_NAME`, `PRODUCT_<ID>_PRICE`... riêng. Chọn sản phẩm để lấy lại thông tin mới nhất; nhóm không có ID là sản phẩm được chọn gần nhất. Đây là điền trường, chưa tạo dòng sản phẩm nghiệp vụ trong hồ sơ hợp đồng.
10. Chọn Xem dữ liệu đã điền để đối chiếu mà vẫn giữ placeholder trong nội dung soạn. Các placeholder xuất hiện trong tài liệu đều phải có giá trị; giao diện và API xuất chặn khi thiếu trường.
11. Chọn Word hoặc Xuất PDF để tải tài liệu đã điền giá trị. PDF dùng LibreOffice đã được cấu hình ở backend.

## Phạm vi hiện tại

### Thư viện mẫu văn bản trong editor

1. Kéo một file DOCX vào trang hoặc bấm Nhập DOCX. Đối chiếu kết quả chuyển đổi với bản gốc.
2. Người có quyền `template.manage` chọn Lưu thành mẫu mới. Kiểm tra và loại bỏ thông tin riêng của khách hàng trong văn bản tĩnh trước khi xác nhận. Các giá trị liên kết sẽ được để trống trong bản mẫu mới.
3. Bấm Mẫu văn bản để tìm kiếm và phân trang thư viện mẫu dùng chung trong tenant.
4. Dùng mẫu tạo bản soạn thảo riêng, tự lưu với tài khoản hiện tại. Sửa bản này không đổi mẫu gốc. Các giá trị liên kết được đặt lại để điền cho đối tác mới.
5. Người quản lý có thêm Sửa mẫu và Ngừng dùng. Sửa mẫu giữ lịch sử phiên bản; ngừng dùng ẩn mẫu khỏi thư viện nhưng không xóa các tài liệu đã tạo trước đó.
6. Mẫu này phục vụ editor độc lập; không tự phát hành vào module Mẫu hợp đồng nghiệp vụ hiện có.

### Kéo thả và bố cục

- Vào tab Bố cục trong bảng bên trái, kéo tay nắm của đoạn/bảng sang vị trí mong muốn. Có nút lên/xuống cho bàn phím và màn hình cảm ứng, cùng thao tác nhân đôi/xóa.
- Chỉnh trực tiếp văn bản, ô bảng và dùng thanh công cụ trên trang giấy như trước. Lưu server/tự lưu ghi lại thứ tự mới.
- Đây là bố cục tài liệu theo dòng, không phải canvas tự do theo tọa độ. Không có kéo tự do ảnh/textbox hoặc đảm bảo giữ nguyên mọi cấu trúc của DOCX nguồn như Canva.

- Không thay đổi form tạo hợp đồng cũ; không cập nhật dữ liệu khách hàng/sản phẩm hoặc hồ sơ hợp đồng khi sửa tài liệu này.
- Không mở khóa hay ghi đè phiên bản hợp đồng đã duyệt/ký.
- Tài liệu và phiên bản được lưu trong tenant database, chỉ tài khoản sở hữu được đọc/sửa. Chưa có tính năng chia sẻ cộng tác. Nháp cũ trên trình duyệt có thể nhập và tự lưu thành tài liệu mới bằng nút Nhập nháp cũ từ trình duyệt; không tự xóa bản local.
- Nếu hai cửa sổ cùng sửa, phiên bản cũ bị chặn ghi đè. Giữ nội dung cần bảo toàn, mở bản mới nhất từ danh sách trước khi chỉnh tiếp. Không bấm lặp để ép ghi đè.
- Chỉ nhập DOCX. PDF là đầu ra; không có nhập PDF/scan/ảnh và OCR.
- Nhập giữ văn bản, một số định dạng trực tiếp và bảng cơ bản. Ảnh, header/footer, chữ ký, trường Word tự động, bố cục trang, bảng lồng và ghép dọc chưa được bảo toàn. Luôn đối chiếu bản gốc.
- Xuất tài liệu A4; không cam kết giữ nguyên bố cục từng trang của DOCX nguồn. Bảng ghép dọc trong editor phải tách ô trước khi xuất; API báo lỗi thay vì âm thầm xuất sai.
- Trường không được nhận diện vẫn có thể chỉnh sửa trực tiếp trong editor. Nguồn dữ liệu không tự thay đổi snapshot tài liệu đã lưu. Bước tạo hồ sơ hợp đồng chính thức từ editor chưa triển khai.

## API

- `POST /api/contract-document-editor/import`: multipart `file`, trả rich text và cảnh báo chuyển đổi.
- `POST /api/contract-document-editor/export/docx`: JSON `title`, `content`, `bindings`, trả DOCX đã điền giá trị; thiếu trường trả 400.
- `POST /api/contract-document-editor/export/pdf`: cùng nội dung, trả PDF. Thiếu converter trả 503.

- `GET/POST /api/contract-editor-drafts`: danh sách riêng có phân trang/tìm tên và tạo tài liệu.
- `GET/PUT /api/contract-editor-drafts/{id}`: mở/lưu, PUT cần `expectedRevision`; xung đột trả 409.
- `GET /api/contract-editor-drafts/{id}?revision=N`: đọc bản cũ.
- `GET /api/contract-editor-drafts/{id}/history?page=N`: lịch sử phân trang.
- `GET /api/contract-editor-drafts/binding-values?source=customer|employee|product&id=N`: dữ liệu nguồn đã giới hạn trường trả về, không có thông tin mật khẩu.
- `GET /api/contract-editor-drafts?templates=true`: thư viện mẫu dùng chung trong tenant.
- `POST /api/contract-editor-drafts` với `isTemplate=true`: tạo mẫu, yêu cầu quyền quản lý mẫu; cập nhật mẫu cũng cần quyền này và đúng revision.
- `POST /api/contract-editor-drafts/{id}/archive`: body là số revision hiện hành; ngừng dùng mẫu và giữ lịch sử.

## Triển khai

Cần áp migration `20261028022038_ContractEditorServerDrafts` và `20261028025915_ContractEditorTemplateLibrary` trên **tenant database** rồi khởi động lại backend. Migration đầu tạo hai bảng editor và index/FK; migration thư viện thêm hai cột IsTemplate/IsArchived, không sửa dữ liệu hợp đồng cũ. Chưa tự chạy trên database local.

Từ `Source/Backend`:

```powershell
dotnet ef database update --project .\ContractManagement.Infrastructure --startup-project .\ContractManagement.API --context DbDtctechContext --configuration Release --connection "<CONNECTION_STRING_TENANT>"
```

Không trỏ application context vào master/central. Lệnh database update chạy cả các migration còn thiếu trong chuỗi; nếu chưa áp các migration main trước đó, phải xem phạm vi của chúng và sao lưu trước, đặc biệt các migration gỡ bàn giao.
