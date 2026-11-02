# Phase 4–5 — Lịch sử, khôi phục và xuất Word/PDF

## Phase 4: Phiên bản

- Mỗi lần lưu thêm một snapshot trường dữ liệu; file nguồn lưu một lần và không bị ghi đè.
- Lịch sử mới nhất trước, phân trang 10 bản, có thời điểm UTC (giao diện đổi sang giờ máy người dùng), tổng số trường, số trường xác nhận, số giá trị đổi so với gốc.
- Chọn một bản lịch sử để xem ở chế độ chỉ đọc hoặc xuất Word/PDF của bản đó.
- Khôi phục dùng `POST /api/imported-contracts/{id}/history/{revision}/restore`, body chỉ chứa `expectedRevision` và `sourceSha256`. Server tự đọc snapshot, không nhận trường lịch sử do client truyền lại.
- Khôi phục tạo snapshot mới ở đầu lịch sử, giữ nguyên cả bản được khôi phục lẫn các bản phát sinh sau nó.
- Save/restore kiểm tra phiên bản hiện hành, hash và quyền tenant/tài khoản; xung đột trả 409, không tự ghi đè. Giao diện có nút Mở lại bản mới nhất với xác nhận bỏ thay đổi chưa lưu.
- Không cho khôi phục bản mới nhất thành chính nó hoặc lấy snapshot từ hồ sơ khác.

## Phase 5: Xuất file

- **File gốc**: tải đúng byte ban đầu, có kiểm tra SHA-256 trước khi tải.
- **Word đã sửa**: tạo bản sao từ nguồn DOCX, chỉ thay vùng đã xác nhận, giữ cấu trúc Word còn lại; không tìm-thay tất cả các chuỗi giống nhau.
- **Xem PDF**: mở tab mới rồi tải PDF qua API có xác thực. Nếu trình duyệt chặn popup hoặc converter lỗi, có thông báo; tab lỗi được đóng.
- **Tải PDF**: tải bản tương tự bằng LibreOffice headless, không dùng ảnh chụp HTML làm PDF.
- Word/PDF lấy snapshot đang chọn; tên file có hậu tố `-vN`. API trả `X-Document-Revision`, `X-Source-Sha256` và `Cache-Control: no-store`.
- Khi có thay đổi chưa lưu, không cho xuất bản chỉnh sửa. Khi còn gợi ý chưa xác nhận, cần xác nhận xuất; các gợi ý đó giữ nguyên văn bản gốc.
- Lỗi thiếu converter/quá thời gian/chuyển đổi không hợp lệ trả 503 và thông báo, không trả DOCX giả làm PDF.

## Checklist nghiệm thu trên local

1. Nhập DOCX thử; sửa một trường, xác nhận và lưu: tạo v2.
2. Đổi giá trị khác, lưu: tạo v3. Lịch sử phải có v3, v2, v1; thời điểm và số trường/thay đổi hợp lý.
3. Mở v2: chỉ đọc. Xuất Word và PDF: phải có giá trị v2, không phải v3.
4. Khôi phục v1: tạo v4. Cả v1–v3 vẫn tồn tại và v4 có dữ liệu v1.
5. Hai tab cùng mở phiên bản mới nhất; tab A lưu trước, tab B lưu sau: tab B nhận xung đột và không làm mất bản A.
6. Nhấn Xem PDF: mở tab mới có PDF; Tải PDF/Word có tên đúng version.
7. Sửa chưa lưu: nút xuất bản chỉnh sửa bị khóa. Còn trường gợi ý: xuất yêu cầu xác nhận và không áp dụng giá trị chưa xác nhận.
8. Tải lại File gốc: hash vẫn khớp file trước upload sau tất cả thao tác trên.
9. Kiểm tra Word/PDF bằng tài liệu thật đã ẩn danh, đặc biệt bảng, font, ảnh, header/footer và nội dung nhiều trang. Không coi kiểm tra tự động là đảm bảo mọi DOCX giữ bố cục giống tuyệt đối.

## Kết quả kiểm tra

- Bộ `ImportedContractReviewTests`: **13 đạt, không bỏ qua**, gồm test mới khôi phục, xuất đúng snapshot và chuyển đổi PDF thật bằng LibreOffice trên tài liệu giả lập.
- TypeScript nguồn và ESLint trang nhập Word: đạt.
- Hồi quy toàn backend: **1.234 đạt, 9 test tích hợp bỏ qua, 0 lỗi**. Test PDF riêng của module đã bật và chạy thật; 9 test bỏ qua thuộc các bộ tích hợp khác.
- Chưa UAT trực quan trong phiên đăng nhập của người dùng và chưa chạy thử xung đột đồng thời trên SQL Server thật. Các test lưu dữ liệu dùng EF InMemory.
- Không đổi schema: **không cần migration mới** cho Phase 4–5.

Chạy lại bộ test có converter trên Windows:

```powershell
$env:IMPORTED_CONTRACT_LIBREOFFICE_PATH = 'C:/Program Files/LibreOffice/program/soffice.com'
dotnet test Source/Backend/ContractManagement.Tests/ContractManagement.Tests.csproj -c Release --filter FullyQualifiedName~ImportedContractReviewTests
```

Đường dẫn converter của ứng dụng vẫn dùng cấu hình `TemplatePdfRendering:ExecutablePath`/cơ chế dò đường dẫn hiện có. Biến môi trường phía trên chỉ để bật test, không tự đổi cấu hình app đang chạy.

## Ranh giới của phiên bản đầu

Hoàn thiện luồng nhập → nhận diện → rà soát → lưu lịch sử → xuất. Không tự đưa hợp đồng cũ vào trạng thái đã ký, không giữ giá trị pháp lý của chữ ký số khi sửa DOCX, không thay quy trình phê duyệt/ký và không tự cập nhật danh mục khách hàng.
