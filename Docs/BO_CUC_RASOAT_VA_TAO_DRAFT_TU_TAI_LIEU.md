# Bố cục, rà soát và tạo Draft từ tài liệu

## Cập nhật database

Migration mới: `20261104012759_EditorContractSource`.

Chạy từ `Source/Backend`, dùng connection string của **tenant**, không phải Central:

```powershell
dotnet ef database update --project .\ContractManagement.Infrastructure --startup-project .\ContractManagement.API --context DbDtctechContext --connection "<chuỗi kết nối tenant>"
```

Không cần xóa dữ liệu. Sau đó build/restart backend và frontend. Agent chưa chạy migration trên database thật.

## 1. Bố cục trang trong Soạn thảo hợp đồng

Chọn **Bố cục trang** trên thanh công cụ:

- A4 hoặc A5; dọc hoặc ngang.
- Lề trên/dưới/trái/phải: 5–50 mm.
- Giãn dòng: 1–3; khoảng cách trước/sau đoạn: 0–72 pt.
- Áp dụng toàn tài liệu, bao gồm đoạn trong bảng chỉnh được. Cài đặt được lưu cùng phiên bản, không chỉ đổi CSS trên màn hình.
- Chọn đoạn và bấm **Ngắt trang** trên thanh soạn thảo để bật/tắt ngắt trang trước đoạn đó.

Với DOCX nhập vào, chưa áp dụng bố cục thì vẫn giữ khổ/lề gốc khi xuất. Bấm **Áp dụng bố cục** mới thay khổ/lề của toàn bộ section; bấm **Giữ bố cục Word gốc** để bỏ thiết lập ghi đè. Form dùng A4/20 mm làm cấu hình khởi đầu nếu chưa có thiết lập; không tự đọc mọi khổ tùy chỉnh vào form.

Ảnh, header/footer và bảng lồng vẫn giữ nội dung gốc. Giãn dòng/khoảng cách không ghi đè nội dung bên trong các khối chỉ xem. Khoảng cách header/footer và gutter gốc vẫn được giữ khi đổi lề trang.

Mặt giấy HTML hỗ trợ soạn thảo, không phải trình dàn trang Word đầy đủ. Ngắt trang và số trang cuối cùng phải kiểm tra bằng PDF thực tế. Bảng/ảnh quá rộng có thể cần sửa trong Word gốc hoặc đổi lề/hướng trang.

Module **Nhập hợp đồng Word cũ** vẫn giữ bố cục gốc khi chỉnh theo vị trí. Muốn thay bố cục trang, lưu thành mẫu rồi mở trong Soạn thảo hợp đồng; không tự đổi khổ/lề bản hợp đồng cũ.

## 2. Kiểm tra trước khi xuất/chia sẻ

Soạn thảo: Xem Word, tải Word, Xuất PDF, tạo Draft và lưu thành mẫu đều có bước kiểm tra.

- Trường liên kết còn trống: chặn xuất/tạo Draft, có nút **Đi đến** để điền.
- Email, số điện thoại hoặc dấu hiệu tài khoản/thuế gõ trực tiếp: cảnh báo kiểm tra dữ liệu khách hàng cũ; không tự xóa hay sửa dữ liệu.
- Khối Word chỉ xem: có nút đi đến vị trí, nhắc kiểm tra bản PDF.
- DOCX có nguồn gốc: nhắc kiểm tra ảnh, header/footer và nội dung ẩn.
- Lưu thành mẫu được phép giữ trường chưa điền, vì mẫu cần chỗ điền; vẫn phải rà soát dữ liệu riêng và chọn phạm vi cá nhân/dùng chung như trước.

Word cũ: xuất Word/PDF có bước kiểm tra trường chưa xác nhận, dữ liệu nhạy cảm có dấu hiệu nhận diện và vùng chỉ xem. Trường chưa xác nhận giữ nguyên giá trị gốc; người dùng có thể quay lại rà soát hoặc xác nhận tiếp tục.

Các cảnh báo dựa trên quy tắc, không phải AI/OCR hay công cụ tự ẩn danh. Không bảo đảm phát hiện hết tên, chữ ký, số tài khoản hoặc dữ liệu nằm trong ảnh. Kiểm tra thủ công vẫn cần thiết.

## 3. Tạo hợp đồng từ tài liệu này

1. Hoàn thiện tài liệu và điền thông tin liên kết.
2. Bấm **Tạo hợp đồng từ tài liệu này**, xử lý cảnh báo rồi tiếp tục.
3. Hệ thống lưu tài liệu, mở wizard tạo hợp đồng với ID và phiên bản nguồn; không đưa nội dung hợp đồng vào URL/localStorage.
4. Tên hợp đồng, khách hàng và nhân viên được gợi ý từ dữ liệu đã liên kết. Chọn thêm các thông tin bắt buộc của nghiệp vụ hiện có: chiều mua/bán, ngôn ngữ, mẫu đã Published, sản phẩm/dịch vụ, điều khoản, ngày hiệu lực và tài chính.
5. Rà soát và đánh dấu xác nhận đối chiếu tài liệu nguồn, sau đó tạo Draft.
6. Backend xuất đúng phiên bản Word đang tham chiếu và lưu bản cố định cùng transaction tạo Contract/Version/Items/Terms. Nếu transaction thất bại thì không lưu hồ sơ nguồn riêng lẻ.
7. Trang chi tiết có **Tài liệu soạn thảo nguồn**: xem PDF ở tab mới hoặc tải Word nguồn. Sửa/xóa tài liệu trong thư viện sau này không thay bản đã lưu cùng Draft.

Backend từ chối tài liệu không có quyền đọc, tenant khác, phiên bản đã thay đổi hoặc khách hàng/nhân viên không khớp nguồn liên kết. Nếu muốn đổi khách hàng/nhân viên đã liên kết, quay lại editor để cập nhật nguồn trước.

### Phân biệt bản nguồn và bản nghiệp vụ

Đây là bước nối editor vào wizard tạo Draft và lưu **bản nguồn đối chiếu**. Không tự suy ra toàn bộ sản phẩm, giá tiền, điều khoản từ văn bản tự do. Người dùng phải xác nhận các trường nghiệp vụ trong wizard.

Bản nguồn không thay thế bản hợp đồng chính thức dựng từ mẫu Published, không tự trở thành tài liệu duyệt/ký và không ghi đè tài liệu đã ký. Việc dùng một DOCX tự do làm bản chính thức cho toàn bộ vòng đời duyệt/ký chưa được triển khai trong đợt này; cần cơ chế đồng bộ nội dung với phiên bản nghiệp vụ trước khi mở luồng đó.

## API mới

- `POST /api/contract-editor-drafts/{id}/create-contract`: `revision`, `reviewed`, `contract` (request tạo Draft chuẩn).
- `GET /api/contracts/{contractId}/editor-source/pdf`: xem PDF của bản nguồn cố định.
- `GET /api/contracts/{contractId}/editor-source/docx`: lấy Word nguồn cố định.

Thông tin nguồn được trả thêm trong contract detail: `editorSourceDocumentId`, `editorSourceRevision`, `editorSourceTitle`. DOCX binary được lưu ở bảng riêng `tbl_ContractEditorSourceSnapshot`, không tải vào truy vấn danh sách/chi tiết thông thường.

## Checklist nghiệm thu trên tenant thật

1. Soạn mới, chọn A5 ngang, lề 15/20/25/15 mm, giãn dòng 1.5, sau đoạn 12 pt; lưu/mở lại và xuất Word/PDF để đối chiếu.
2. Bật ngắt trang cho một đoạn, xuất và kiểm tra đoạn bắt đầu ở trang mới.
3. Nhập DOCX có ảnh/header/footer/bảng lồng; xuất khi chưa đổi bố cục và sau khi đổi; nội dung khối gốc còn nguyên.
4. Để trống một trường liên kết: xuất/tạo Draft bị chặn; Đi đến mở đúng trường. Lưu thành mẫu vẫn cho giữ chỗ điền trống.
5. Gõ email khách hàng cũ trực tiếp: bảng cảnh báo xuất hiện; Đi đến cuộn tới đoạn; phải xác nhận đã rà soát để tiếp tục.
6. Tạo Draft từ editor: kiểm tra tên/khách hàng/nhân viên được gợi ý, điều khoản/sản phẩm/tài chính trong wizard và card nguồn trên trang chi tiết.
7. Sửa editor trong tab khác sau khi mở wizard: tạo Draft bị chặn vì phiên bản nguồn thay đổi.
8. Đổi khách hàng khác nguồn liên kết: backend từ chối. Tài khoản/tenant khác không dùng được tài liệu riêng.
9. Sau khi tạo thành công, sửa/xóa tài liệu trong thư viện: PDF/Word nguồn trong hồ sơ Draft vẫn là bản lúc tạo.

## Kiểm tra tự động

Backend build và bộ test đã chạy; test .NET cần quyền dùng IPC/socket nội bộ ngoài sandbox. Frontend TypeScript, lint các thành phần mới và test liên quan đã chạy. Các test tích hợp SQL Server/LibreOffice yêu cầu cấu hình riêng không được coi là đã nghiệm thu trên tenant thật.

Kiểm tra trực quan qua browser preview trong phiên làm việc bị chặn kết nối localhost, nên cần chạy checklist trên sau khi migrate và khởi động app.
