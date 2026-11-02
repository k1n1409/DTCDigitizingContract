# Nâng cấp preview và thư viện tài liệu

## Bổ sung xóa/khôi phục

Migration mới nhất: **`20261028092153_DocumentLibraryTrash`** (sau migration thư viện bên dưới). Thêm cờ `IsArchived` vào hồ sơ Word cũ, mặc định false; không xóa dữ liệu hiện có. Chưa áp vào database thật trong đợt phát triển. Dùng lệnh cập nhật tenant bên dưới; EF sẽ áp các migration còn thiếu theo thứ tự.

- Dưới thẻ tài liệu có nút thùng rác. Xác nhận để xóa mềm; không có nút xóa vĩnh viễn trong đợt này.
- Bấm **Thùng rác** để xem bản đã xóa và bấm **Khôi phục**. Chuyển về thư viện để mở lại.
- Tài liệu riêng: chỉ chủ tài khoản trong đúng tenant được xóa/khôi phục.
- Mẫu dùng chung: chỉ người có quyền quản lý mẫu được xóa/khôi phục. Xóa ảnh hưởng khả năng dùng mẫu của cả tenant; không xóa các tài liệu đã tạo từ mẫu. Mẫu trong phần này là mẫu editor, không phải mẫu hợp đồng nghiệp vụ đã phát hành.
- File gốc và lịch sử giữ nguyên. Xóa/khôi phục thêm snapshot mới, kiểm tra revision để chặn yêu cầu lỗi thời.
- Tài liệu trong thùng rác không mở/chỉnh/xuất/preview được bằng API thông thường; muốn dùng phải khôi phục trước.
- Nếu xóa tài liệu đang mở, workspace đóng bản đó. Thay đổi chưa lưu sẽ bị bỏ, nên kiểm tra trạng thái lưu trước khi xác nhận.
- Các mẫu đã ngừng sử dụng bằng chức năng cũ cũng có thể xuất hiện trong thùng rác của người quản lý mẫu.
- Đã kiểm tra bằng test tự động quyền truy cập, lịch sử và không làm mất file gốc; chưa UAT với SQL Server thật sau migration.

API bổ sung: `DELETE /api/document-library/{kind}/{id}?expectedRevision=N`, `POST /api/document-library/{kind}/{id}/restore` (body số revision), `GET /api/document-library?trash=true`.

## Phạm vi đợt này

1. Preview PDF thực tế trong workspace Word cũ và soạn thảo.
2. Thumbnail thật từ trang đầu PDF, có tên/ngày cập nhật/phiên bản.
3. Đổi tên hiển thị, tạo/đổi tên thư mục, chuyển tài liệu và gắn sao; lưu trên backend theo tài khoản/tenant.

Mục bảo vệ/khôi phục thay đổi khi lỗi mạng chưa làm trong đợt này theo yêu cầu “phần lưu để sau”. Giữ nguyên tự lưu, hoàn tác và lịch sử đang có; không đổi sang cơ chế nháp/mốc phiên bản mới.

## Triển khai

Migration mới: **`20261028084424_DocumentLibraryOrganization`**.

Chỉ thêm `tbl_DocumentLibraryFolder` và `tbl_DocumentLibraryEntry`; không xóa/sửa hợp đồng nghiệp vụ. Chưa chạy lên database thật trong đợt phát triển.

Chạy từ thư mục gốc repository, dùng **chuỗi kết nối database tenant đã áp migration trước đó**, không dùng CentralDatabase/master:

```powershell
dotnet ef database update --project Source/Backend/ContractManagement.Infrastructure --startup-project Source/Backend/ContractManagement.API --context DbDtctechContext --connection "<CHUOI_KET_NOI_DATABASE_TENANT>"
```

Không copy nguyên placeholder. Kiểm tra các migration còn chờ và sao lưu trước khi chạy trên dữ liệu cần giữ. Nếu ứng dụng phục vụ nhiều database tenant, áp theo quy trình nâng cấp tenant hiện có.

Frontend thêm dependency `pdfjs-dist` (đã khóa phiên bản). Trên máy mới chạy `npm install` tại `Source/Frontend`; script postinstall/predev/prebuild chuẩn bị worker, font và WASM vào `public/pdfjs/`. Không commit thư mục asset sinh tự động này. Worker chạy tại ứng dụng, không dùng CDN và không gửi tài liệu sang dịch vụ ngoài.

Restart backend và frontend sau khi cập nhật dependency/migration. LibreOffice vẫn cần hoạt động trên máy chạy backend.

## Cách sử dụng

### Preview chính xác bản xuất

- Trong Word cũ, chờ tự lưu xong rồi bấm **Bản PDF thực tế**. Chế độ này hiển thị PDF do LibreOffice dựng từ đúng phiên bản đã lưu, gồm bố cục bảng, font và ngắt trang của bản xuất.
- Dùng +/−, đặt lại 100% và Trang trước/sau. Bộ đếm là số trang PDF thực tế, khác bộ đếm trang mô phỏng ở chế độ chỉnh.
- Bấm **Quay lại chỉnh sửa** để nhập tiếp. Không chỉnh trực tiếp trên PDF.
- Trang Soạn thảo cũng có **Bản PDF thực tế** sau khi tài liệu đã lưu trên server.
- Preview mẫu/chưa điền hết trường cho phép giữ placeholder để xem bố cục; xuất hợp đồng thông thường vẫn chặn thiếu trường bắt buộc như trước.
- Preview là bản xuất hiện tại, không sửa ngược các giới hạn nhập DOCX của editor. Ví dụ editor nhập không bảo toàn ảnh/header thì preview editor không tự khôi phục các phần đó; module nhập Word cũ vẫn dùng nguồn gốc riêng.

### Thư viện

- Tab Tất cả hiển thị hồ sơ Word cũ, tài liệu soạn thảo của tài khoản và mẫu dùng chung trong tenant.
- Thumbnail được render từ trang đầu PDF của phiên bản ghi trên thẻ; không còn hình giấy giả. Chỉ tải khi thẻ gần vùng nhìn, giới hạn số yêu cầu chạy đồng thời và bộ nhớ cache trình duyệt.
- Bấm biểu tượng **sao** dưới thẻ để gắn/bỏ sao. Nút sao cạnh bộ lọc thư mục chỉ hiện các tài liệu đã gắn sao.
- Bấm **bút chì** dưới thẻ để đổi tên hiển thị hoặc chọn thư mục. Chọn Không có thư mục để chuyển ra ngoài.
- Trong Thư mục của tôi, bấm + để tạo; bấm bút chì cạnh thư mục để đổi tên; bấm tên thư mục để lọc.
- Tên hiển thị, sao và thư mục là cá nhân theo tài khoản/tenant. Đổi tên mẫu không đổi tên chung của công ty; đổi tên trong thư viện không ghi đè tên file Word gốc hoặc tạo snapshot nội dung.
- Metadata có revision riêng để chặn ghi đè âm thầm nếu một phiên khác vừa cập nhật. Khi báo xung đột, làm mới thư viện rồi sửa lại.
- Chưa có thư mục lồng nhau/xóa thư mục hoặc chia sẻ thư mục giữa nhân viên trong đợt này.

## API mới

- `GET /api/document-library`: tìm kiếm, lọc loại, thư mục, gắn sao; phân trang 12 tài liệu.
- `GET/POST /api/document-library/folders`: danh sách/tạo thư mục cá nhân.
- `PUT /api/document-library/folders/{id}`: đổi tên thư mục cá nhân.
- `PUT /api/document-library/{kind}/{id}/metadata`: tên hiển thị, thư mục, sao; có expectedRevision.
- `GET /api/document-library/{kind}/{id}/preview?revision=N`: PDF theo snapshot; kind là imported/template/editor, kiểm tra lại quyền trước khi đọc.

## Kiểm tra và giới hạn nghiệm thu

- 4 test mới thư viện đạt: quyền tenant/tài khoản, folder/alias/star, phân trang và preview mẫu thật bằng LibreOffice.
- Hồi quy backend: **1.239 đạt, 9 bỏ qua, 0 lỗi**. TypeScript/ESLint nguồn mới đạt ở đợt kiểm tra.
- Đã render thành công PDF/thumbnail trong trình duyệt với fixture giả lập; fixture và route tạm đã gỡ.
- Chưa UAT trên database SQL Server thật sau migration hoặc bộ hồ sơ khách hàng thực tế.
- PDF.js tự render nội dung của PDF nên không có lớp chỉnh trực tiếp trong preview; không cam kết Word và LibreOffice cho bố cục giống tuyệt đối trên mọi font/tài liệu.
- `npm audit` vẫn báo các dependency cũ (ví dụ Axios/Next/Zod); PDF.js không nằm trong danh sách cảnh báo được trả về trong lần kiểm tra này. Không chạy audit fix/force hoặc nâng cấp thư viện ngoài phạm vi.
