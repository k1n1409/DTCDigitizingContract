# Tài liệu chính thức theo version hợp đồng

## 1. Ba chế độ chỉnh sửa

- **Sửa đầy đủ**: các đoạn/bảng thông thường trong trình soạn thảo mới; có thể sửa chữ, định dạng và bố cục.
- **Chỉ sửa chữ — giữ định dạng**: văn bản từ Word cũ hoặc đoạn có Tab/đường kẻ cần bảo toàn. Chỉ thay chữ; các nút định dạng không tác động vào đoạn được bảo vệ. Bản xuất giữ định dạng gốc.
- **Chỉ xem**: khối phức tạp như field Word, Track Changes, bảng lồng hoặc đối tượng chưa hỗ trợ sửa bên trong. Lý do hiển thị ngay tại vùng và trên thanh công cụ. Trong editor có thể di chuyển/xóa cả khối, không đồng nghĩa được sửa nội dung bên trong.

## 2. Cách dùng tài liệu soạn để duyệt/ký

1. Soạn tài liệu, điền thông tin và xem Word/PDF để kiểm tra.
2. Chọn **Tạo hợp đồng từ tài liệu này** nếu chưa có hồ sơ nghiệp vụ. Tạo Draft, rà soát khách hàng, nhân viên, sản phẩm, điều khoản, tiền tệ, giá trị và ngày hiệu lực.
3. Xác nhận nội dung Word/PDF khớp dữ liệu nghiệp vụ ở trang tạo. **Tạo Draft và ghim tài liệu vào version đầu tiên là cùng một giao dịch**. Không cần quay lại editor hoặc bấm ghim thêm lần nữa; nếu ghim lỗi, toàn bộ việc tạo bị rollback.
4. Trang chi tiết hiển thị tên bản soạn, revision và SHA-256 đã ghim. Nút xem/tải hợp đồng động dùng bản này thay renderer từ template.
5. Chuyển sang Đàm phán, hoàn tất điều kiện nghiệp vụ rồi gửi duyệt. Server kiểm tra fingerprint dữ liệu, lưu chính Word đã ghim và PDF chuyển từ Word đó thành artifact riêng, sau đó khóa version trong transaction gửi duyệt.
6. Duyệt và chuyển ký tiếp tục dùng artifact đã lưu và mã kiểm tra hiện có; không đọc lại bản nháp editor.

**Cập nhật bản soạn cho hợp đồng đã có:** mở editor, chọn **Cập nhật tài liệu cho hợp đồng đã có**, chọn hợp đồng/version chưa khóa rồi rà soát và xác nhận. Nút này không tạo hồ sơ mới; dành cho khi muốn ghim lại bản đã sửa, một version mới hoặc hợp đồng cũ chỉ có tài liệu tham chiếu.

### Khi nào cần ghim lại?

- Sửa dữ liệu nghiệp vụ làm fingerprint thay đổi: tên, khách hàng/hồ sơ pháp lý, ngày, sản phẩm, điều khoản, tài chính, phụ lục hoặc dữ liệu liên kết.
- Tạo vòng/version mới từ hợp đồng dùng editor: giữ chế độ tài liệu editor nhưng **không tự sao chép xác nhận**. Cần rà soát và ghim riêng version mới.
- Muốn đưa thay đổi vừa sửa trong editor vào hợp đồng: lưu rồi ghim lại khi version còn Nháp/Đàm phán và chưa khóa.

Sửa/xóa bản nháp trong thư viện không thay byte DOCX đã ghim. Không thể ghim lại version đã gửi duyệt/đã khóa. Không tự fallback về template nếu thiếu, lỗi hash hoặc tài liệu không khớp dữ liệu nghiệp vụ.

## 3. Phạm vi và giới hạn

- Triển khai cho loại **Cung cấp phần mềm**, phù hợp renderer/luồng gửi duyệt hiện tại. Template vẫn dùng để tạo cấu trúc nghiệp vụ, không bị bỏ qua các kiểm tra sẵn có.
- Ghim là hành động rà soát có chủ ý, **không phải đồng bộ hai chiều tự động**. Chưa tự phân tích ngữ nghĩa để chứng minh mọi câu trong Word giống các trường nghiệp vụ; người dùng phải đối chiếu trước khi xác nhận.
- Bản nguồn lúc tạo Draft vẫn giữ riêng để đối chiếu; không tự biến các tài liệu nguồn cũ thành bản chính thức.
- Bảo đảm bộ tài liệu được chuyển duyệt/ký không bị thay bởi bản editor mới. Không tự xác minh rằng một file scan người dùng tải lên có chữ ký hợp lệ hoặc nội dung giống từng trang của artifact; đó là phạm vi kiểm tra bằng chứng ký hiện có.
- Không cấp thêm quyền đọc Word gốc/editor cho người được chuyển giao hợp đồng. Các endpoint vẫn kiểm tra quyền tài nguyên và tenant.

## 4. API / dữ liệu

- `GET /api/contracts/{contractId}/versions/{versionId}/editor-document`: metadata, chế độ, trạng thái khóa và kết quả kiểm tra khớp dữ liệu (nếu actor có write scope).
- `POST` cùng URL: documentId, revision, contractRowVersion, versionRowVersion, reviewed. Chỉ version hiện hành Nháp/Đàm phán, chưa khóa. Kiểm tra hai concurrency token; transaction Serializable bảo vệ snapshot nghiệp vụ khi ghim.
- `POST /api/contract-editor-drafts/{id}/create-contract`: tạo Draft và tự ghim bản DOCX đã rà soát vào version đầu tiên trong cùng transaction. Nếu không xuất được tài liệu hoặc không tính được fingerprint, không commit hồ sơ tạo mới. Không có API gọi tiếp sau tạo để ghim rời rạc.
- `tbl_ContractVersion.DocumentMode`: 0 = mẫu published như cũ; 1 = bản soạn đã rà soát.
- `tbl_ContractVersionEditorDocument`: DOCX riêng theo version, revision nguồn, SHA-256, fingerprint nghiệp vụ và actor/thời gian ghim. Không có FK tới tài liệu editor để không phụ thuộc vòng đời bản nháp. API metadata không trả binary.

## 5. Migration và kiểm thử thủ công

Migration mới: `20261104024536_VersionEditorDocument`. **Chưa chạy vào database của bạn.** Chạy từ `Source/Backend`, với connection đúng database tenant:

```powershell
dotnet ef database update --project .\ContractManagement.Infrastructure --startup-project .\ContractManagement.API --context DbDtctechContext --connection "<chuỗi kết nối database tenant>"
```

Sau đó restart backend. Không chạy migration này vào CentralDatabase; không cần xóa dữ liệu cũ (mode mặc định là 0).

Checklist:

- Tạo Draft → ghim bản A → xem/tải hợp đồng có nội dung A.
- Sửa editor thành B nhưng chưa ghim lại → hợp đồng vẫn là A.
- Sửa dữ liệu nghiệp vụ sau khi ghim → xuất/gửi duyệt bị chặn, yêu cầu rà soát và ghim lại.
- Ghim B rồi gửi duyệt → artifact Word/PDF là B; sửa editor sau đó không đổi artifact.
- Thử ghim bằng token cũ / version đã khóa / version không hiện hành / tài liệu ngoài quyền → bị chặn.
- Tạo version mới → chưa có pin, yêu cầu ghim lại, không dùng lại bản cũ ngầm.

## 6. Kết quả kiểm tra mã nguồn

- Backend build thành công; 1.278 test pass, 11 test tích hợp cần cấu hình môi trường được skip, 0 fail.
- Frontend TypeScript và ESLint các thành phần vừa thay đổi đạt; 13 test soạn thảo/nhập Word đạt.
- EF xác nhận model khớp migration. Chưa áp dụng migration hay kiểm thử end-to-end trên database tenant đang chạy của bạn.
- API ghim được kiểm thử trực tiếp về lưu binary độc lập, audit, revision/token cũ, sai tenant và version từng gửi duyệt; policy kiểm thử version khóa/không hiện hành, dữ liệu thay đổi và SHA sai.
- Luồng tạo từ editor kiểm thử tự gắn tài liệu, SHA/fingerprint, version mode và audit; thiếu bộ capture bị từ chối trước khi ghi dữ liệu. Việc gộp luồng không tạo thêm migration ngoài `VersionEditorDocument` đã có.
