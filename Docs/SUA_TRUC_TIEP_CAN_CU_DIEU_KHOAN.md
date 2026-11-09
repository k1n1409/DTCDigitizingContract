# Sửa trực tiếp căn cứ / điều khoản sau phát hành, duyệt hoặc ký

## Phạm vi đã triển khai

Theo yêu cầu nghiệp vụ, Hành chính (AdminOfficer) và Manager có thể sửa trực tiếp các mục hiện có, **giữ nguyên version ID/số version**, không cần sao chép sang version mới:

- Mẫu hợp đồng ở trạng thái Published: sửa căn cứ và nội dung/tiêu đề điều khoản.
- Hợp đồng thực tế ở trạng thái Đã duyệt, đang chờ ký / Đã ký / Completed: sửa căn cứ và nội dung/tiêu đề điều khoản của version hiện hành đã khóa.
- Không mở quyền sửa giá trị tiền, sản phẩm, thứ tự/mã/ID điều khoản, nguồn mẫu, trạng thái duyệt/ký, chữ ký, DOCX nguồn hay các artifact qua chức năng này.
- Chưa thêm/xóa mục qua cửa sửa trực tiếp; chỉ cập nhật chữ trong các mục có sẵn. Mẫu nháp/hợp đồng chưa duyệt vẫn dùng luồng chỉnh sửa thông thường.

## Cách sử dụng

1. Mở **Mẫu hợp đồng → version đang phát hành**, hoặc **Chi tiết hợp đồng đã duyệt/đã ký**.
2. Bấm **Sửa trực tiếp căn cứ / điều khoản** ở phía trên trang.
3. Chọn tab Căn cứ hoặc Điều khoản, chọn mục bên trái.
4. Sửa tiêu đề/nội dung; với tài liệu song ngữ vẫn phải đáp ứng quy tắc tách/gộp ngôn ngữ hiện có.
5. Nhập lý do (bắt buộc, tối đa 1.000 ký tự), bấm **Lưu trực tiếp nội dung này** rồi xác nhận lại.
6. Dữ liệu được lưu trên version hiện tại. Trang chi tiết tự làm mới; nhãn cảnh báo cho biết đã có chỉnh sửa sau phát hành/duyệt/ký.
7. Mở phần **20 lần sửa gần nhất** trong cửa sửa để xem người sửa, lý do và nội dung trước/sau. Toàn bộ lịch sử vẫn được lưu; phần này chỉ hiển thị 20 bản ghi mới nhất.

Nếu dữ liệu vừa bị người khác sửa, server từ chối token cũ. Đóng/mở lại cửa sửa để tải dữ liệu mới. Có xác nhận trước khi bỏ nội dung chưa lưu.

## Phân biệt dữ liệu đang quản lý và bản file đã duyệt/ký

**Sửa trực tiếp dữ liệu không ghi đè file gốc.** Đây là giới hạn quan trọng của bản triển khai:

- Với mẫu: căn cứ/điều khoản mới được dùng khi tạo hợp đồng tiếp theo. Hợp đồng đã tạo trước đây không tự thay đổi. PDF phát hành đã lưu vẫn là bản phát hành ban đầu, không phải bản tái xuất sau sửa.
- Với hợp đồng: dữ liệu căn cứ/điều khoản trên màn hình thay đổi trực tiếp; snapshot pháp lý, SHA/hash, Word/PDF đã gửi duyệt và bằng chứng ký vẫn được giữ nguyên. Luồng ký tiếp tục dùng đúng artifact đã được duyệt, không âm thầm lấy chữ vừa sửa để thay thế file.
- Giao diện hiển thị cảnh báo khác biệt này cho người xem, kể cả người không có quyền sửa.
- Không tự tạo lại bản đã ký, không thay chữ ký và không tuyên bố file cũ đã chứa nội dung vừa sửa.

## Quyền và bảo vệ dữ liệu

- Quyền mới `contract.text-correct` chỉ gán cho AdminOfficer và Manager. Backend kiểm tra lại nhân viên active và quyền, không chỉ ẩn nút frontend.
- Hợp đồng vẫn phải vượt kiểm tra quyền đọc theo tài nguyên/tenant; chỉ version hiện hành đã khóa mới được dùng cửa sửa này.
- Endpoint chuyên biệt, có xác nhận và lý do. API thông thường vẫn giữ các chốt readonly/immutable cũ.
- Transaction Serializable kiểm tra rowversion cha và rowversion mục; lưu sửa đổi và lịch sử cùng transaction.
- Ngoại lệ tại DbContext chỉ cho các cột chữ/tiêu đề và metadata cập nhật của term/legal basis đang sửa. Không cho thêm/xóa, đổi mã, sửa snapshot pháp lý, phiên bản hoặc tài liệu đã ghim.
- Lịch sử trước/sau trong `tbl_AdministrativeTextEdit` được bảo vệ append-only tại DbContext. Sửa hợp đồng còn ghi sự kiện `ContractTextCorrected` vào nhật ký hợp đồng.

## API

- `GET /api/administrative-text/contract/{contractId}`
- `POST /api/administrative-text/contract/{contractId}`
- `GET /api/administrative-text/template/{templateVersionId}`
- `POST /api/administrative-text/template/{templateVersionId}`

POST gồm versionId, rowId, kind (`term`/`basis`), parentRowVersion, rowVersion, title/titleEn, contentVi/contentEn, reason, confirmed. Các nội dung dùng định dạng rich-text có kiểm soát, không nhận HTML tùy ý.

## Migration

Migration mới: **`20261104080253_AdministrativeTextCorrections`**. Chỉ tạo bảng lịch sử, không xóa dữ liệu hợp đồng. Chưa áp dụng vào database của bạn.

Từ `Source/Backend`, chạy với connection đúng **database tenant**, không phải CentralDatabase:

```powershell
dotnet ef database update --project .\ContractManagement.Infrastructure --startup-project .\ContractManagement.API --context DbDtctechContext --connection "<chuỗi kết nối database tenant>"
```

Sau migration, restart backend và tải lại app/đăng nhập lại để nhận quyền mới.

## Kiểm tra mã nguồn

- Backend build đạt; 1.297 test đạt, 0 lỗi, 11 test tích hợp cần môi trường riêng được skip.
- Frontend TypeScript và ESLint của cửa sửa mới đạt.
- EF xác nhận model khớp migration. Chưa chạy migration hoặc kiểm thử end-to-end trên database tenant đang chạy của bạn.
- Test trực tiếp: sửa hợp đồng đã ký và mẫu Published không tạo version mới; nội dung trước/sau được lưu; snapshot/hash/file identity được giữ; chặn vai trò không có quyền, token cũ, thiếu xác nhận và thao tác vượt các cột chữ được cho phép.
