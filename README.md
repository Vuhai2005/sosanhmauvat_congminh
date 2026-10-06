ĐẠI HỌC BÁCH KHOA HÀ NỘI - ONE LOVE ONE FUTURE
HẢI - ITE10/3
NGUYỄN CÔNG MINH
# Hệ thống giám định / so sánh mẫu vật

Ứng dụng web hỗ trợ **so sánh hai ảnh mẫu vật** cho Học viện Cảnh sát nhân dân. Người dùng tải lên hai ảnh, chọn loại mẫu, hệ thống trả về điểm tương đồng, mức độ kết luận và các đặc điểm giống/khác nhau.

> **Lưu ý:** Đây là công cụ hỗ trợ đối chiếu ảnh cho đồ án / demo, **không phải kết luận giám định pháp y**.

**Demo:** https://sosanhmauvatcongminh.vercel.app/

## Tính năng

- Tải lên 2 ảnh (JPG, PNG, WebP) để so sánh.
- Hỗ trợ các loại mẫu: khuôn mặt, dấu / con dấu, chữ viết / chữ ký, tài liệu, mẫu vật khác.
- Tính điểm tương đồng bằng thị giác máy tính **chạy cục bộ** (OpenCV, NumPy, Pillow): không dùng OpenAI, không dùng Ollama, không cần Internet.
- Phân loại kết quả theo điểm:
  - từ 85: **Tương đồng cao**
  - từ 65 đến dưới 85: **Tương đồng trung bình**
  - dưới 65: **Khác biệt đáng kể**
- Giao diện web responsive, mở được trên điện thoại.

## Công nghệ

| Phần | Công nghệ |
| --- | --- |
| Frontend | React, Vite |
| Backend | Python, FastAPI |
| Xử lý ảnh | OpenCV, NumPy, Pillow |
| Dữ liệu | SQLAlchemy, SQLite (dùng cho router hồ sơ / lịch sử) |
| Triển khai | Vercel (2 service: frontend và backend) |

## Cấu trúc thư mục

```
.
├── index.html
├── package.json            # Cấu hình frontend
├── vite.config.js
├── vercel.json             # Khai báo 2 service cho Vercel
├── public/                 # logo.png, background.jpg
├── src/
│   ├── main.jsx
│   ├── App.jsx             # Toàn bộ giao diện
│   └── App.css
└── backend/
    ├── main.py             # Ứng dụng FastAPI, các endpoint
    ├── ai_compare.py       # Thuật toán so sánh ảnh
    ├── models.py           # Mô hình dữ liệu
    ├── schemas.py          # Schema Pydantic
    ├── database.py         # Kết nối SQLite
    ├── requirements.txt
    └── routers/
        ├── cases.py        # Hồ sơ vụ việc
        └── history.py      # Lịch sử so sánh
```

## Chạy trên máy

Yêu cầu: Node.js 18+ và Python 3.10+.

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Kiểm tra: mở http://localhost:8000/api/health, kết quả mong đợi là `{"status":"ok", ...}`.

### 2. Frontend

Ở thư mục gốc của dự án:

```bash
npm install
npm run dev
```

Frontend gọi API qua đường dẫn `/api/...`. Khi chạy local, đặt biến môi trường để trỏ tới backend:

```bash
# file .env ở thư mục gốc
VITE_API_URL=http://localhost:8000
```

## API

| Method | Đường dẫn | Mô tả |
| --- | --- | --- |
| GET | `/api/health` | Kiểm tra trạng thái hệ thống |
| POST | `/api/ai/compare` | So sánh hai ảnh |

`POST /api/ai/compare` nhận `multipart/form-data`:

| Trường | Kiểu | Mô tả |
| --- | --- | --- |
| `forensic_type` | text | Loại mẫu (khuôn mặt, con dấu, chữ viết, tài liệu, ...) |
| `object1_file` | file | Ảnh thứ nhất (JPG, PNG hoặc WebP) |
| `object2_file` | file | Ảnh thứ hai (JPG, PNG hoặc WebP) |

Ví dụ:

```bash
curl -X POST http://localhost:8000/api/ai/compare \
  -F "forensic_type=con dấu" \
  -F "object1_file=@anh1.jpg" \
  -F "object2_file=@anh2.jpg"
```

Lỗi trả về: `400` (sai định dạng ảnh hoặc không đọc được ảnh), `503` (lỗi module xử lý ảnh), `500` (phân tích thất bại).

## Triển khai lên Vercel

1. Đưa mã nguồn lên GitHub.
2. Vào vercel.com, chọn **Add New → Project** và import repo.
3. Giữ nguyên cấu hình, vì `vercel.json` đã khai báo frontend (Vite) ở `/` và backend (FastAPI) ở `/api`.
4. Bấm **Deploy**. Mỗi lần push lên nhánh `main`, Vercel tự deploy lại.

Lưu ý khi chạy trên Vercel:

- Hệ thống file chỉ ghi được vào `/tmp`, nên dữ liệu SQLite không lưu lâu dài. Muốn lưu hồ sơ và lịch sử cần dùng database ngoài (ví dụ Postgres).
- Gói miễn phí giới hạn thời gian xử lý và dung lượng mỗi request, nên dùng ảnh vừa phải.

## Hạn chế hiện tại

- Kết quả dựa trên đặc trưng hình ảnh (điểm đặc trưng, cấu trúc, màu sắc), chưa phải mô hình nhận dạng chuyên biệt cho từng loại mẫu.
- CORS đang mở cho mọi nguồn (`allow_origins=["*"]`); nên giới hạn lại khi dùng thật.
- `package.json` dùng phiên bản `latest` cho các thư viện, nên nên ghim phiên bản để bản build ổn định.

## Giấy phép

Dự án phục vụ học tập và nghiên cứu.
