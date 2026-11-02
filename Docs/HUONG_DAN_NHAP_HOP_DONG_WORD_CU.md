# Hướng dẫn sử dụng — Nhập và rà soát hợp đồng Word cũ

Dành cho người dùng và tester. Cập nhật: 28/10/2026.

**Nâng cấp mới:** đã có Bản PDF thực tế trong workspace, thumbnail trang đầu thật, thư mục/đổi tên hiển thị/gắn sao trên backend. Các ghi chú chưa hỗ trợ những phần này ở mô tả cũ bên dưới đã được thay thế; xem [hướng dẫn nâng cấp và migration thư viện](NANG_CAP_PREVIEW_VA_THU_VIEN.md). Phần bảo vệ/khôi phục khi lỗi mạng tiếp tục để sau, không đổi cơ chế tự lưu đợt này.

## 1. Chọn đúng chức năng

| Bạn muốn làm gì? | Nơi sử dụng |
| --- | --- |
| Nhập Word cũ có dữ liệu thật, sửa từng giá trị và giữ file gốc | **Nhập hợp đồng Word cũ** — `/contract-import` |
| Soạn mới/chỉnh bố cục tài liệu, dùng các trường liên kết hoặc mẫu editor | **Soạn thảo hợp đồng** — `/contract-editor` |
| Tạo hồ sơ để đi qua đàm phán, duyệt, ký và các trạng thái nghiệp vụ | Form tạo hợp đồng hiện có — `/contracts/create` |

Tài liệu này hướng dẫn **Nhập hợp đồng Word cũ**. Thao tác ở đây không tự tạo hồ sơ trong danh sách hợp đồng nghiệp vụ, không đổi trạng thái ký/duyệt và không cập nhật danh mục khách hàng.

Hợp đồng cũ **không cần placeholder** như `{{CUSTOMER_NAME}}`; hệ thống liên kết giá trị thật với vị trí trong file.

## 2. Chuẩn bị

- Đăng nhập đúng công ty/tenant và tài khoản có quyền tạo hợp đồng.
- Chuẩn bị một file `.docx` không rỗng, tối đa **10 MB**. Chưa hỗ trợ nhập `.doc`, PDF, ảnh hoặc tài liệu cần OCR.
- Chỉ dùng tài liệu được phép xử lý; tester nên dùng bản đã ẩn danh.
- Backend/frontend phải đang chạy. Muốn xuất PDF, máy chạy backend cần LibreOffice hoạt động và cấu hình đúng.
- Không coi bản xuất sau chỉnh sửa là bản giữ nguyên chữ ký/phê duyệt pháp lý của hợp đồng gốc.

## 3. Luồng nhanh

1. Mở **Hợp đồng → Nhập hợp đồng Word cũ** hoặc `http://localhost:5005/contract-import`.
2. Bấm **Upload DOCX** hoặc kéo một file vào trang.
3. Văn bản mặc định là **bản đang chỉnh**. Bấm trực tiếp vào chữ và gõ nội dung thay thế ngay tại đoạn/ô, hoặc sửa giá trị trong panel bên phải.
4. Thay đổi do bạn nhập được áp dụng ngay; nếu chỉ dùng gợi ý tự nhận diện chưa chỉnh, vẫn có thể chọn **Xác nhận**. Muốn gán vùng nhỏ, chọn **Đối chiếu/gán vùng trên bản gốc**.
5. Chờ thanh trạng thái báo **Đã lưu** sau khoảng 1,2 giây ngừng nhập, hoặc bấm **Lưu ngay**.
6. Chọn **Word đã sửa**, **Xem PDF** hoặc **Tải PDF**.

**Quan trọng:** tự lưu chạy sau **1,2 giây ngừng nhập**, không phải lưu từng phím. Chờ trạng thái **Đã lưu** trước khi đóng/rời trang. Khi lỗi mạng/xung đột, tự lưu tạm dừng và thay đổi chỉ còn trên trang hiện tại; không đóng trang nếu chưa giữ lại dữ liệu.

## 4. Upload và mở lại hồ sơ

### Thư viện bên trái workspace

- Bấm **Thư viện** trên thanh đầu để ẩn/hiện panel. Panel có tìm kiếm, chọn nguồn và các tab **Tất cả / Tài liệu / Mẫu**.
- **Tài liệu đã nhập** dùng dữ liệu hồ sơ Word của tài khoản hiện tại. Bấm thẻ để mở; có phân trang trong tab Tài liệu và Xem tất cả ở tab tổng hợp.
- **Mẫu văn bản** lấy thư viện mẫu editor dùng chung của tenant. Bấm thẻ để chuyển sang Soạn thảo hợp đồng và dùng mẫu tạo bản riêng, không ghi đè mẫu gốc.
- Nếu còn thay đổi chưa lưu, chuyển hồ sơ/trang vẫn có hộp xác nhận. Chờ tự lưu hoàn tất nếu muốn giữ nội dung.
- Hình thẻ hiện là biểu tượng tài liệu, chưa phải ảnh thumbnail render từ Word/PDF. Chưa có thao tác tạo thư mục/gắn sao vì backend chưa cung cấp API tương ứng.
- Trên màn hình nhỏ, dùng nút đóng panel để trở về vùng tài liệu.

### Upload mới

1. Chọn **Upload DOCX** hoặc kéo thả một DOCX vào trang.
2. Chờ xử lý; không bấm liên tục khi trang đang bận.
3. Khi mở thành công, kiểm tra tên file, dung lượng, ngày nhập và SHA-256 ở phần thông tin đầu trang.

File nguồn được lưu ngay khi upload thành công, cùng phiên bản ban đầu **v1**. Những thay đổi sau đó được tự lưu khi ngừng nhập; có thể dùng **Lưu ngay** nếu muốn chủ động.

Hai file trùng tên có thể thành hai hồ sơ riêng. Tên giống nhau không có nghĩa là đang mở cùng một hồ sơ.

### Mở hồ sơ đã nhập

1. Bấm **Hồ sơ đã nhập**.
2. Tìm theo tên file; dùng **Trước/Sau** nếu danh sách có nhiều trang.
3. Chọn hồ sơ cần mở.

Danh sách chỉ chứa hồ sơ của **tài khoản và tenant hiện tại**. Nếu đổi tài khoản/công ty, có thể không thấy hồ sơ đã nhập trước đó; đây không nhất thiết là mất dữ liệu. Manager cũng không mặc nhiên xem được mọi hồ sơ riêng của nhân viên.

## 5. Hiểu màn hình rà soát

- **Bên trái:** bản đang chỉnh của văn bản phần thân DOCX/ô bảng, hiển thị ngay nội dung thay thế; từng vùng hỗ trợ là ô nhập không viền, có thể gõ trực tiếp. Chuyển sang đối chiếu bản gốc để xem vùng tô sáng và gán trường nhỏ.
- **Bên phải:** danh sách trường dữ liệu dạng thẻ thu gọn. Bấm một thẻ để mở phần chỉnh sửa.
- **Phía trên panel:** số trường chờ rà soát/đã xác nhận/bỏ qua, tìm kiếm và bộ lọc trạng thái.
- Trên màn hình nhỏ, panel dữ liệu nằm dưới vùng tài liệu.

Văn bản bên trái không phải bản trình bày Word đầy đủ. Để xem bố cục xuất, dùng **Xem PDF** hoặc mở Word đã tải.

Nhận diện dựa trên nhãn như “Tên công ty: …”, “MST: …”, “Email: …”. Không bảo đảm nhận ra mọi trường; thiếu gợi ý không có nghĩa là file gốc bị mất nội dung.

### Trạng thái của trường

| Trạng thái | Khi xuất file |
| --- | --- |
| Gợi ý — chưa áp dụng | Giữ giá trị gốc; dùng Xác nhận để áp dụng gợi ý. Nhập giá trị thay thế trong UI mới sẽ tự chuyển sang áp dụng |
| Đã xác nhận | Áp dụng giá trị thay thế vào đúng vùng |
| Bỏ qua — giữ gốc | Giữ giá trị gốc |

Trong chế độ đối chiếu bản gốc, tô sáng xanh dương chỉ trường đang chọn; xanh lá là trường đã xác nhận; vàng là gợi ý. Trường bỏ qua thường không tô sáng, nhưng có thể được làm nổi bật khi đang chọn.

## 6. Chỉnh một trường đã nhận diện

1. Tìm theo tên/giá trị hoặc lọc trạng thái nếu danh sách dài.
2. Bấm thẻ trường. Vùng tài liệu sẽ cuộn đến đoạn tương ứng; bản đang chỉnh hiện nội dung thay thế, chế độ đối chiếu hiện vị trí gốc.
3. Đọc **Giá trị gốc** và vị trí để chắc chắn chọn đúng chỗ.
4. Sửa **Tên trường**, **Thuộc bên** nếu cần, rồi nhập **Giá trị thay thế**.
5. Giá trị thay thế do bạn nhập được áp dụng ngay và tự lưu. **Xác nhận** dùng khi muốn áp dụng gợi ý mà không gõ thay đổi.

Ô giá trị có thể kéo rộng theo chiều cao và tự ngắt dòng để đọc. Tuy nhiên dữ liệu của module bảo toàn Word hiện lưu một dòng: Enter không thêm dòng mới; xuống dòng/tab khi dán được đổi thành khoảng trắng.

Sửa **giá trị thay thế** sẽ áp dụng ngay. Sửa **tên trường/thuộc bên** đưa trường về gợi ý; hãy xác nhận lại nếu muốn dùng trường đó. Kết quả vẫn phải qua kiểm tra anchor/chồng lấn trước khi lưu.

“Bên A/B” chỉ là ngữ cảnh gợi ý từ tiêu đề trong tài liệu. Không được mặc định Bên A luôn là khách hàng hoặc Bên B luôn là nhà cung cấp; hãy đọc nội dung thực tế.

Nếu một giá trị xuất hiện nhiều nơi, sửa một trường **không tự sửa tất cả các nơi còn lại**. Cần rà soát từng vị trí liên quan.

## 7. Gán trường thủ công khi hệ thống chưa nhận ra

1. Bấm **Đối chiếu/gán vùng trên bản gốc**; bôi đen chính xác giá trị muốn chỉnh trong vùng tài liệu bên trái.
2. Chỉ chọn trong **một đoạn hoặc một đoạn bên trong ô bảng**, không quét qua nhiều đoạn/ô.
3. Panel xuất hiện **Gán trường thủ công**. Đối chiếu nội dung đang chọn.
4. Nhập tên trường, ví dụ “Tên người đại diện”.
5. Bấm **Gán thành trường**.
6. Mở thẻ vừa tạo, nhập giá trị thay thế; thay đổi được áp dụng ngay. Chọn **Quay lại bản đang chỉnh** để xem kết quả.

**Hủy chọn** chỉ bỏ vùng đang chuẩn bị gán, không thay tài liệu. Nếu gán lại đúng vùng đã có, hệ thống mở trường đó thay vì thêm bản trùng.

Giới hạn: tối đa **500 trường**, mỗi vùng/giá trị tối đa **10.000 ký tự**. Vùng trắng hoặc vùng có cấu trúc đặc biệt chỉ xem không được gán. Nếu hai vùng chồng nhau, không thể xác nhận cả hai; bỏ qua hoặc bỏ gán một vùng rồi thử lại.

## 8. Phân biệt Bỏ qua, Bỏ gán và Xóa giá trị

| Nút | Tác dụng |
| --- | --- |
| **Bỏ qua** | Giữ thẻ nhưng không áp dụng thay thế khi xuất; văn bản giữ giá trị gốc |
| **Bỏ gán** | Sau xác nhận, xóa liên kết trường khỏi danh sách; không xóa văn bản |
| **Xóa giá trị** | Sau xác nhận, đặt giá trị thay thế thành rỗng và xác nhận trường; vùng đó sẽ bị xóa trong bản chỉnh sửa khi xuất |

Cả ba thao tác đều không ghi đè file gốc. Sau thao tác, chờ thanh trạng thái báo đã tự lưu.

Muốn hủy tác dụng xóa trước khi lưu, có thể chọn **Bỏ qua**; khi đó bản xuất giữ giá trị gốc. Muốn tiếp tục sửa trường, nhập lại giá trị thay thế và xác nhận.

## 9. Chỉnh tại chỗ, hoàn tác và tự lưu

### Sửa trực tiếp trên văn bản

1. Trong **bản đang chỉnh**, bấm trực tiếp vào chữ tại đoạn/ô cần đổi rồi gõ; không còn nút Sửa đoạn.
2. Nội dung nằm trên khung giấy trắng, ô nhập không viền tự giãn theo chiều cao. Chữ thay đổi xuất hiện ngay, không cần tải Word mới thấy.
3. Tiếp tục sang vùng khác khi cần. Tự lưu chạy sau khi ngừng nhập, không cần bấm Xong.
4. Muốn sửa một vùng nhỏ thay vì cả nội dung đoạn, chuyển sang đối chiếu bản gốc và gán trường.

Khi sửa đoạn, hệ thống gộp các trường trước đó của đoạn thành một vùng thay thế chứa phần khác biệt với bản gốc. Những vùng khác không đổi. Định dạng riêng bên trong vùng bị thay có thể lấy theo run đầu; hãy kiểm tra PDF với tài liệu nhiều định dạng.

### Hoàn tác/Làm lại

- **Hoàn tác** trả lại một nhóm chỉnh sửa trước đó; **Làm lại** áp dụng lại nhóm vừa hoàn tác.
- Có thể dùng Ctrl/Cmd+Z và Ctrl/Cmd+Shift+Z hoặc Ctrl+Y trong vùng chỉnh nội dung. Các ô tìm kiếm vẫn dùng hành vi phím tắt riêng của chúng.
- Giữ tối đa 50 nhóm thao tác trong phiên mở tài liệu. Gõ liên tục được nhóm lại để không cần hoàn tác từng phím.
- Hoàn tác được cả sau tự lưu: kết quả hoàn tác sẽ tiếp tục tự lưu thành phiên bản mới, không xóa lịch sử server.
- Mở lại/đổi hồ sơ sẽ xóa bộ hoàn tác cục bộ; muốn quay về bản từ phiên làm việc trước, dùng Lịch sử.

### Trạng thái lưu

- **Chưa lưu:** đang chờ 1,2 giây ngừng nhập.
- **Đang lưu:** yêu cầu đang gửi lên server; vẫn có thể gõ tiếp.
- **Đã lưu lúc …:** các thay đổi đã được ghi nhận. Nếu tiếp tục gõ trong lúc lưu, hệ thống lưu tiếp lượt mới, không đánh dấu nhầm là đã lưu hết.
- **Lỗi tự lưu:** dừng tự lưu để tránh lặp lỗi; giữ trang mở, kiểm tra mạng rồi bấm **Lưu lại**.
- **Lưu ngay:** gửi các thay đổi hiện tại mà không chờ bộ đếm.

Mỗi lượt tự lưu/lưu ngay thành công tạo snapshot mới. Bản lịch sử không tự lưu và không được sửa trực tiếp. Đang nhập bằng bộ gõ IME thì tự lưu chờ kết thúc nhập.

Nếu trang báo phiên bản đã thay đổi, không bấm lưu liên tục. Ghi lại nội dung cần giữ trước khi chọn **Mở bản mới nhất**; mở lại sẽ bỏ thay đổi chưa lưu sau bước xác nhận. Sau đó chỉnh tiếp trên bản mới.

### Thu phóng và thanh cuối trang

- Mặc định **100%**; dùng nút +/− hoặc thanh trượt để chọn 25–200%. Bấm số phần trăm để trở về 100%.
- **Vừa chiều rộng** điều chỉnh trang cho vừa vùng nhìn hiện tại.
- **Trang 1/N** hiển thị trang editor hiện tại và tổng trang được chia theo nội dung hiển thị. Dùng mũi tên hoặc danh sách để chuyển trang.
- Số trang editor có thể khác Word/PDF do nguồn hiện trích theo đoạn và ô bảng. Bản này không phải trình render bố cục Word đầy đủ; dùng Xem PDF để đối chiếu bản xuất.
- **Dữ liệu rà soát** ở thanh dưới ẩn/hiện panel bên phải. Trên màn hình nhỏ, đóng panel để có chỗ nhập văn bản.
- Thanh trên dùng kiểu workspace với thông tin tài liệu thu gọn. Mở **Thông tin tài liệu** nếu cần xem hash, cảnh báo hoặc chi tiết nguồn.
- Times New Roman/12 pt trên canvas là định dạng hiển thị; không tự đổi định dạng nguồn khi xuất.

## 10. Lịch sử và khôi phục

1. Bấm **Lịch sử vN**.
2. Xem ngày giờ, số trường đã xác nhận và số giá trị đổi so với file gốc; dùng phân trang nếu cần.
3. Chọn một phiên bản để xem. Bản cũ là **chỉ đọc**, nhưng vẫn xuất Word/PDF được.
4. Muốn dùng lại dữ liệu bản cũ, bấm **Khôi phục thành bản mới** và xác nhận.
5. Muốn quay về bản hiện hành mà không khôi phục, bấm **Mở bản mới nhất**.

Ví dụ: đang có v1, v2, v3. Khôi phục v1 tạo **v4** có dữ liệu v1. v1, v2 và v3 vẫn còn trong lịch sử.

Nhãn “thay đổi so với gốc” so sánh giá trị đã xác nhận với file nhập ban đầu, **không phải** bản so sánh chi tiết với phiên bản ngay trước nó. Ngày nhập file và ngày lưu snapshot cũng là hai thời điểm khác nhau.

## 11. Tải và xem file

| Nút | Kết quả |
| --- | --- |
| **File gốc** | Tải bản DOCX nhập ban đầu, không áp dụng các chỉnh sửa |
| **Word đã sửa** | Tải DOCX áp dụng các trường đã xác nhận của phiên bản đang chọn |
| **Xem PDF** | Mở PDF tương ứng trong tab mới |
| **Tải PDF** | Tải PDF tương ứng về máy |

Trước khi xuất bản chỉnh sửa, chờ tự lưu hoàn tất hoặc bấm **Lưu ngay**. Nếu còn trường gợi ý, hộp xác nhận nhắc rằng những trường đó sẽ giữ nguyên dữ liệu gốc.

Tên file xuất có hậu tố phiên bản, ví dụ `hop-dong-v2.docx` hoặc `hop-dong-v2.pdf`. Nếu đang xem v2 trong lịch sử thì xuất **v2**, không tự lấy bản mới nhất.

Nếu Xem PDF bị chặn tab mới, cho phép popup với ứng dụng hoặc dùng **Tải PDF**. Nếu converter lỗi, bản Word vẫn có thể tải khi chức năng xuất Word không bị lỗi.

Sau khi xuất, mở và kiểm tra lại tên các bên, MST, số tài khoản, số tiền, ngày tháng, bảng, ảnh và ngắt trang. Không gửi hoặc ký bản xuất khi chưa kiểm tra.

## 12. Ví dụ thực hành cho tester

Chuẩn bị DOCX giả lập với nội dung:

```text
BÊN A: KHÁCH HÀNG
Tên công ty: CÔNG TY KIỂM THỬ A
MST: 0012345678
Điện thoại: 0901234567; Email: legal@example.test
```

1. Upload: kiểm tra hệ thống đề xuất tên công ty, MST, điện thoại và email. MST/điện thoại phải giữ số 0 đầu.
2. Đổi tên thành “CÔNG TY KIỂM THỬ B”, xác nhận; không xác nhận điện thoại/email nếu không muốn đổi.
3. Chờ tự lưu, xuất Word/PDF và đối chiếu tên mới. Mỗi lượt ngừng nhập rồi lưu có thể tạo thêm phiên bản, nên số version thực tế có thể lớn hơn v2.
4. Mở lịch sử v1, xuất: tên phải là tên ban đầu.
5. Khôi phục v1: tạo phiên bản mới, không mất các phiên bản chỉnh trước đó.
6. Tải File gốc: nội dung vẫn là “CÔNG TY KIỂM THỬ A”.

Nếu muốn kiểm chứng file gốc chính xác từng byte, dùng PowerShell trên file trước upload và file tải lại; hai giá trị Hash phải giống nhau:

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath 'C:\duong-dan\hop-dong.docx'
```

## 13. Lỗi thường gặp

| Hiện tượng | Kiểm tra/xử lý |
| --- | --- |
| Không thấy mục nhập Word hoặc không truy cập được | Kiểm tra quyền tạo hợp đồng và đúng tenant/tài khoản |
| File bị từ chối | Kiểm tra DOCX thật, không rỗng, dưới 10 MB; tệp hỏng/mã hóa, macro, tài nguyên ngoài/đối tượng nhúng hoặc quá giới hạn xử lý có thể bị từ chối |
| Không có trường gợi ý | File vẫn có thể đọc được; bôi đen và gán thủ công ở vùng cho phép |
| Đoạn chỉ xem, không gán được | Vùng có cấu trúc chưa hỗ trợ; không cố xóa trường Word/ảnh chỉ để vượt giới hạn. Nếu cần chỉnh bố cục, dùng bản sao và công cụ soạn thảo phù hợp |
| Nút Word/PDF bị khóa | Còn thay đổi chưa tự lưu hoặc trang đang xử lý; chờ hoàn tất hoặc bấm Lưu ngay |
| Xuất vẫn là giá trị cũ | Kiểm tra trạng thái áp dụng của trường, thanh tự lưu và version đang chọn |
| Không thấy hồ sơ đã nhập | Kiểm tra tài khoản/tenant, từ khóa tìm kiếm, trang danh sách và việc upload trước đó đã thành công chưa |
| Không xác nhận được do chồng lấn | Hai trường cùng phủ một phần văn bản; bỏ qua/bỏ gán một trường |
| Xung đột phiên bản | Một tab/yêu cầu khác đã lưu trước; ghi lại thay đổi cần giữ rồi mở bản mới nhất |
| PDF lỗi 503 | Nhờ người vận hành kiểm tra LibreOffice, cấu hình đường dẫn, timeout và font trên backend |
| Hash nguồn không hợp lệ | Dừng xử lý hồ sơ đó và báo quản trị; không tắt kiểm tra hash để tiếp tục |
| Word/PDF khác bố cục mong đợi | Đối chiếu font, bảng, ảnh và ngắt trang với bản gốc; báo lỗi kèm bản đã ẩn danh |

## 14. Điều chưa hỗ trợ và lưu ý an toàn

- Không nhập PDF scan, không OCR và không tự hiểu toàn bộ nội dung pháp lý.
- Không chỉnh trực tiếp header/footer, ảnh, hyperlink, content control, tracked changes hoặc trường Word tự động trong màn hình rà soát.
- Không kéo tự do từng thành phần như Canva, không sửa nhiều dòng/bố cục bằng một trường dữ liệu.
- Không tự chạy lại nhận diện trên hồ sơ cũ khi quy tắc được cập nhật; có thể nhập thành hồ sơ mới để thử, nhưng hồ sơ mới không mang lịch sử cũ.
- Không tự tạo/cập nhật khách hàng, mẫu nghiệp vụ, hợp đồng đã ký hoặc quy trình phê duyệt.
- File xuất sau chỉnh sửa không mặc nhiên còn hiệu lực của chữ ký số/chữ ký trên bản gốc. Người phụ trách phải kiểm tra quy trình phát hành/ký lại nếu có.
- Khi báo lỗi, ghi rõ tên chức năng, phiên bản đang chọn, bước thao tác và thông báo. Chỉ gửi tài liệu/ảnh đã che dữ liệu nhạy cảm qua kênh được phép.

## 15. Checklist bàn giao nhanh

- [ ] Đúng tài khoản/tenant, upload và mở lại hồ sơ thành công.
- [ ] Chọn đúng vị trí, chỉnh/xác nhận/gán thủ công hoạt động.
- [ ] Bỏ qua, bỏ gán và xóa giá trị có kết quả đúng.
- [ ] Tự lưu/Lưu ngay, hoàn tác/làm lại, lịch sử và khôi phục hoạt động; không mất bản cũ.
- [ ] Hai tab lưu đồng thời không ghi đè âm thầm.
- [ ] Word/PDF đúng phiên bản; file gốc không đổi.
- [ ] Bố cục trên tài liệu thật đã được kiểm tra trước khi sử dụng.

Xem thêm [Tổng hợp 5 phase và kết quả kiểm tra kỹ thuật](PHASE_NHAP_HOP_DONG_CU.md).
