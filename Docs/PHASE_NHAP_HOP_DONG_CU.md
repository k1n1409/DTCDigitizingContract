# Tổng hợp 5 phase — Nhập và rà soát hợp đồng Word cũ

Cập nhật: 28/10/2026.

## Mục tiêu và phạm vi

Tiếp nhận DOCX có dữ liệu thật, nhận diện các giá trị có sẵn, gắn từng giá trị với đúng vị trí trong tài liệu, cho người dùng rà soát rồi xuất Word/PDF. Không yêu cầu hợp đồng cũ có placeholder.

Luồng chính: **Upload DOCX → Nhận diện → Rà soát/xác nhận → Lưu phiên bản → Xuất Word/PDF**.

**Cập nhật UI chỉnh trực tiếp:** bản đang chỉnh mặc định hiển thị giá trị thay thế ngay trên văn bản; có Sửa đoạn, Hoàn tác/Làm lại và tự lưu sau 1,2 giây ngừng nhập. Không cần tải Word để thấy thay đổi. Nhập giá trị thay thế chủ động sẽ áp dụng ngay; gợi ý nhận diện chưa sửa vẫn cần xác nhận. Nút Lưu phiên bản được đổi thành Lưu ngay. Hướng dẫn sử dụng đã cập nhật theo luồng này; mô tả thao tác thủ công ở tài liệu phase cũ là lịch sử triển khai.

**Cập nhật workspace trang giấy:** đã bỏ nút Sửa đoạn; mỗi vùng hỗ trợ cho gõ trực tiếp, có trang giấy trắng, header gradient, panel đóng/mở, thanh cuối với zoom 25–200%, đặt lại 100%, vừa chiều rộng và điều hướng Trang x/N. Phân trang là trang hiển thị editor, không khẳng định trùng trang Word/PDF. Đã thử gõ, fit width và chuyển trang bằng tài liệu giả lập trên trình duyệt; không thay thế UAT trên hồ sơ thật.

Đây là module tài liệu độc lập tại `/contract-import`, không tự tạo hồ sơ hợp đồng nghiệp vụ, không tự đưa hợp đồng vào trạng thái đã ký và không cập nhật danh mục khách hàng.

## Tổng hợp tiến độ

| Phase | Đã triển khai | Cách kiểm tra chính | Trạng thái |
| --- | --- | --- | --- |
| 1 — Tiếp nhận | Upload/kéo thả DOCX; lưu byte gốc, SHA-256, người nhập, tenant và thời điểm; danh sách tìm kiếm/phân trang | Mở lại hồ sơ; tải file gốc và đối chiếu hash; kiểm tra cách ly tài khoản/tenant | Code và test tự động đạt; UAT local cần xác nhận |
| 2 — Nhận diện | Đọc đoạn/ô bảng; vị trí bảng/dòng/ô; nhận diện nhãn, đa trường cùng dòng và ngữ cảnh Bên A/B; anchor theo đoạn và khoảng ký tự | Chuỗi giống nhau không bị gộp; trường chia nhiều run vẫn đúng vị trí; giữ số 0 đầu | Code và test tự động đạt; cần thử thêm file thật |
| 3 — Rà soát | Thẻ thu gọn; tìm/lọc trạng thái; tô sáng; chọn vùng gán thủ công; giá trị gốc/thay thế; xác nhận/bỏ qua/xóa/bỏ gán; xem trước | Thử chọn đúng vùng, chỉnh nội dung dài, chặn vùng chồng lấn, bản lịch sử chỉ đọc | Code, TypeScript và ESLint đạt; UAT trình duyệt còn chờ |
| 4 — Phiên bản | Lưu snapshot; lịch sử phân trang/thống kê; mở bản cũ; khôi phục trên server thành bản mới; chặn yêu cầu phiên bản lỗi thời | v1 → v2 → v3; khôi phục v1 thành v4, không mất bản cũ; thử hai tab lưu đồng thời | Code và test tự động đạt; cần UAT đồng thời trên SQL Server |
| 5 — Xuất | File gốc; Word từ bản sao nguồn; xem PDF tab mới/tải PDF; xuất đúng snapshot; chỉ áp dụng vùng xác nhận; thông báo lỗi converter | So sánh nội dung giữa các version; kiểm tra file gốc; kiểm tra bố cục nhiều trang | Code, test Word và PDF thật bằng LibreOffice đạt; chờ UAT bố cục file thật |

**Kết luận:** đã hoàn thiện phần code của cả 5 phase trong phạm vi phiên bản đầu. Chưa coi là nghiệm thu vận hành hoàn tất khi chưa chạy checklist UAT bằng tài liệu thực tế đã được phép sử dụng.

## Nguyên tắc dữ liệu

- File gốc bất biến. Chỉnh sửa nằm trong snapshot trường dữ liệu, không ghi đè byte nguồn.
- Một trường gắn với hash nguồn, ID đoạn, khoảng ký tự và văn bản gốc; không dùng số trang hay thay thế toàn bộ chuỗi giống nhau.
- Nhận diện chỉ là gợi ý theo nhãn, không phải AI/OCR. Người dùng chịu trách nhiệm xác nhận giá trị và bên liên quan.
- Chỉ trường **Đã xác nhận** được áp dụng khi xuất. Gợi ý nhận diện chưa được áp dụng tự động.
- Ở UI chỉnh trực tiếp mới, nhập giá trị thay thế sẽ tự đặt trường thành **Đã xác nhận** để bản đang chỉnh và bản xuất nhất quán. Sửa tên/bên vẫn đưa trường về chờ rà soát. Hoàn tác/làm lại được tự lưu thành snapshot mới, không xóa lịch sử.
- Khôi phục thêm phiên bản mới, không sửa lịch sử. Lưu/khôi phục dùng phiên bản hiện hành để chống ghi đè.
- Hồ sơ nhập riêng theo tenant và tài khoản. Có quyền quản lý không đồng nghĩa tự động xem được hồ sơ riêng của tài khoản khác.
- Nội dung sửa từ hợp đồng đã ký không mặc nhiên kế thừa giá trị pháp lý/chữ ký của bản gốc.

## Giới hạn hiện tại

- Đầu vào DOCX, tối đa 10 MB; không nhập PDF/ảnh/OCR ở module này.
- Tối đa 3.000 đoạn, 500 trường, 10.000 ký tự mỗi giá trị trường; có thêm giới hạn giải nén/đối tượng nhúng để bảo vệ xử lý tài liệu.
- Rà soát phần thân và ô bảng; chưa chỉnh trực tiếp header/footer, ảnh, hyperlink, trường Word tự động, content control hoặc tracked changes.
- Màn hình rà soát là văn bản theo vùng, không phải bản render bố cục Word hoàn chỉnh.
- Giá trị thay thế của bản rà soát lưu một dòng; textarea chỉ giúp đọc dễ hơn. Không kéo tự do thành phần/chèn xóa cấu trúc DOCX như Canva.
- Word xuất giữ các phần không sửa theo cấu trúc nguồn; không cam kết mọi file giữ bố cục giống tuyệt đối. PDF còn phụ thuộc font và LibreOffice.
- Hồ sơ cũ không tự chạy lại quy tắc nhận diện mới để tránh ghi đè phần đã rà soát.
- Không tự đối chiếu/ghi đè khách hàng, tạo hợp đồng nghiệp vụ hoặc phát hành mẫu hợp đồng.

## Triển khai và kết quả kiểm tra gần nhất

- Migration nền: `20261028034427_ImportedContractReview`, tạo hai bảng hồ sơ và snapshot. Người dùng đã báo migration local **up to date**.
- Phase 2–5 không thêm schema; **không cần migration mới** cho các thay đổi này.
- Bộ `ImportedContractReviewTests`: **13 đạt, 0 lỗi**, có test chuyển PDF thật bằng LibreOffice trên DOCX giả lập.
- Cập nhật chỉnh trực tiếp: bộ module **14 đạt**, có test Unicode/giữ run không sửa; **5 test frontend** kiểm tra overlay, gộp vùng chỉnh, chèn/xóa, Unicode và giới hạn. Chưa có kiểm thử tương tác tự lưu/undo qua trình duyệt trong phiên đăng nhập của người dùng.
- Hồi quy toàn backend: **1.234 đạt, 9 test tích hợp bỏ qua, 0 lỗi**. Không tính các test bỏ qua là đã nghiệm thu.
- Hồi quy sau bổ sung chỉnh trực tiếp/Unicode: **1.235 đạt, 9 bỏ qua, 0 lỗi**. TypeScript và ESLint nguồn mới đạt; test helper frontend chạy bằng `node --test tests/imported-contract-editing.test.mjs` trong thư mục Frontend.
- TypeScript nguồn và ESLint các file UI sửa ở từng đợt: đạt.
- Test lưu trữ của module dùng EF InMemory. Chưa nghiệm thu tương tác trong phiên đăng nhập của người dùng, cạnh tranh ghi trên SQL Server thật hoặc bố cục trên bộ DOCX thực tế.
- Không chạy seed hoặc migration trên database thật trong quá trình kiểm thử code.

## Tài liệu theo phase

- [Phase 1 — Tiếp nhận và bảo toàn nguồn](PHASE_1_NHAP_HOP_DONG_CU.md).
- [Phase 2 — Đọc và nhận diện theo vị trí](PHASE_2_NHAP_HOP_DONG_CU.md).
- [Phase 3 — Rà soát và UI đồng bộ](PHASE_3_NHAP_HOP_DONG_CU.md).
- [Phase 4–5 — Lịch sử, khôi phục và xuất file](PHASE_4_5_NHAP_HOP_DONG_CU.md).
- [Hướng dẫn sử dụng cho người dùng/tester](HUONG_DAN_NHAP_HOP_DONG_WORD_CU.md).

Các số test trong tài liệu phase riêng là kết quả tại thời điểm triển khai từng đợt; kết quả gần nhất nằm ở mục phía trên.

## Nguồn code chính

- `Source/Backend/ContractManagement.API/Domains/Services/Contract/LegacyWordDocument.cs`: đọc/nhận diện, kiểm tra anchor, sửa bản sao DOCX.
- `Source/Backend/ContractManagement.API/Domains/Controllers/Contract/ImportedContractsController.cs`: upload, danh sách, lưu, lịch sử, khôi phục, xuất.
- `Source/Backend/ContractManagement.Tests/Domains/Services/Contract/ImportedContractReviewTests.cs`: test module.
- `Source/Frontend/app/(protected)/contract-import/page.tsx`: màn hình rà soát.
- `Source/Frontend/components/ui/custom/document-field-card.tsx`: thẻ trường và ô giá trị dùng chung với editor.

## Sau nghiệm thu có thể mở rộng

1. Nhận diện nhiều kiểu nhãn hơn; đối chiếu dữ liệu khách hàng với bước xác nhận rõ ràng.
2. Nhóm các vị trí cùng một trường để đề xuất sửa nhiều nơi có kiểm soát.
3. Preview bố cục Word/PDF sát tài liệu gốc hơn.
4. Mở rộng vùng đặc biệt khi đã có quy tắc bảo toàn và bộ test tương ứng.
5. Nếu cần liên kết thành hợp đồng nghiệp vụ: thiết kế bước ánh xạ dữ liệu, phân quyền và kiểm tra nghiệp vụ riêng; không tự biến tài liệu nhập thành hợp đồng đã ký.
