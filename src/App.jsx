import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

/* =========================================================
   CẤU HÌNH
========================================================= */

const STORAGE_CASES = "academy-forensic-cases-v2";
const STORAGE_HISTORY = "academy-forensic-history-v2";

const FORENSIC_TYPES = [
  {
    id: "face",
    name: "Khuôn mặt",
    description: "Đối chiếu đặc điểm khuôn mặt",
  },
  {
    id: "seal",
    name: "Con dấu",
    description: "Đối chiếu hình dạng và bố cục con dấu",
  },
  {
    id: "handwriting",
    name: "Chữ viết / Chữ ký",
    description: "Đối chiếu hình ảnh chữ viết",
  },
  {
    id: "document",
    name: "Tài liệu",
    description: "Đối chiếu hình ảnh tài liệu",
  },
];

const DEFAULT_CASES = [
  {
    id: "GD-2026-0001",
    date: "06/10/2026",
    type: "Khuôn mặt",
    status: "Chưa thực hiện",
    officer: "Cán bộ giám định",
  },
  {
    id: "GD-2026-0002",
    date: "05/10/2026",
    type: "Chữ viết / Chữ ký",
    status: "Đã hoàn thành",
    officer: "Cán bộ giám định",
    score: 87.4,
    conclusion: "TƯƠNG ĐỒNG CAO",
    detail:
      "Hai mẫu có mức độ tương đồng hình ảnh cao trong phạm vi phép đối chiếu prototype.",
  },
  {
    id: "GD-2026-0003",
    date: "04/10/2026",
    type: "Con dấu",
    status: "Đang xử lý",
    officer: "Cán bộ giám định",
  },
];

const DEFAULT_HISTORY = [
  {
    id: "GD-2026-0002",
    date: "05/10/2026 14:25",
    type: "Chữ viết / Chữ ký",
    result: "TƯƠNG ĐỒNG CAO",
    score: 87.4,
    officer: "Cán bộ giám định",
  },
  {
    id: "GD-2026-0003",
    date: "04/10/2026 10:40",
    type: "Con dấu",
    result: "Đang phân tích",
    score: null,
    officer: "Cán bộ giám định",
  },
];

/* =========================================================
   HÀM TIỆN ÍCH
========================================================= */

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);

    if (!value) {
      return fallback;
    }

    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function formatDate() {
  const now = new Date();

  return now.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime() {
  const now = new Date();

  return now.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getNextCaseId(items) {
  const currentYear = new Date().getFullYear();

  const numbers = items
    .map((item) => {
      const parts = String(item.id || "").split("-");
      return Number(parts[parts.length - 1]);
    })
    .filter((number) => Number.isFinite(number));

  const nextNumber =
    numbers.length > 0 ? Math.max(...numbers) + 1 : 1;

  return `GD-${currentYear}-${String(nextNumber).padStart(4, "0")}`;
}

function getStatusClass(status) {
  if (status === "Đã hoàn thành") {
    return "status-done";
  }

  if (status === "Đang xử lý") {
    return "status-processing";
  }

  return "status-pending";
}

function getResultClass(result) {
  if (result === "TƯƠNG ĐỒNG CAO") {
    return "result-high";
  }

  if (result === "TƯƠNG ĐỒNG TRUNG BÌNH") {
    return "result-medium";
  }

  if (result === "KHÁC BIỆT ĐÁNG KỂ") {
    return "result-low";
  }

  return "result-neutral";
}

/* =========================================================
   ĐỌC ẢNH
========================================================= */

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = reject;

    image.src = source;
  });
}

async function fileToDataUrl(source) {
  const response = await fetch(source);
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;

    reader.readAsDataURL(blob);
  });
}

/* =========================================================
   AI SO SÁNH MẪU VẬT
========================================================= */

const API_BASE_URL = import.meta.env.VITE_API_URL || "";

async function compareWithAI(type, fileA, fileB) {
  const formData = new FormData();
  formData.append("forensic_type", type);
  formData.append("object1_file", fileA);
  formData.append("object2_file", fileB);

  const response = await fetch(
    `${API_BASE_URL}/api/ai/compare`,
    {
      method: "POST",
      body: formData,
    }
  );

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(
      payload?.detail ||
        "Không thể kết nối mô-đun AI so sánh."
    );
  }

  return payload;
}

function classifyScore(score) {
  if (score >= 85) {
    return {
      label: "TƯƠNG ĐỒNG CAO",
      detail: "Hai mẫu có nhiều đặc điểm hình ảnh tương đồng theo phân tích AI.",
    };
  }

  if (score >= 65) {
    return {
      label: "TƯƠNG ĐỒNG TRUNG BÌNH",
      detail: "Hai mẫu có một số đặc điểm tương đồng nhưng vẫn ghi nhận khác biệt cần xem xét.",
    };
  }

  return {
    label: "KHÁC BIỆT ĐÁNG KỂ",
    detail: "Phân tích AI ghi nhận mức độ khác biệt đáng kể giữa hai mẫu.",
  };
}

/* =========================================================
   COMPONENT UPLOAD
========================================================= */

function UploadPanel({
  title,
  description,
  file,
  onSelect,
  onRemove,
}) {
  const inputRef = useRef(null);

  function handleSelect(event) {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    onSelect(selectedFile);

    event.target.value = "";
  }

  return (
    <div className="upload-panel">
      <div className="upload-panel-header">
        <div>
          <span className="upload-number">
            {title.includes("01") ? "01" : "02"}
          </span>

          <div>
            <h3>{title}</h3>
            <p>{description}</p>
          </div>
        </div>

        {file && (
          <span className="file-ready">
            ĐÃ NHẬP
          </span>
        )}
      </div>

      {!file ? (
        <button
          className="upload-dropzone"
          onClick={() => inputRef.current?.click()}
        >
          <div className="upload-icon">
            +
          </div>

          <strong>
            Chọn mẫu cần giám định
          </strong>

          <span>
            PNG, JPG, JPEG • Tối đa theo trình duyệt
          </span>
        </button>
      ) : (
        <div className="uploaded-file">
          <div className="preview-area">
            <img
              src={file.preview}
              alt={title}
              className="preview-image"
            />
          </div>

          <div className="file-information">
            <div className="file-name">
              {file.file.name}
            </div>

            <div className="file-details">
              {file.file.type || "Không xác định"}
            </div>

            <div className="file-details">
              {Math.max(
                1,
                Math.round(file.file.size / 1024)
              )}{" "}
              KB
            </div>

            <button
              className="remove-file"
              onClick={onRemove}
            >
              Xóa mẫu
            </button>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        hidden
        onChange={handleSelect}
      />
    </div>
  );
}

/* =========================================================
   APP
========================================================= */

function App() {
  const [activeMenu, setActiveMenu] =
    useState("Giám định");

  const [type, setType] =
    useState("Khuôn mặt");

  const [file1, setFile1] =
    useState(null);

  const [file2, setFile2] =
    useState(null);

  const [search, setSearch] =
    useState("");

  const [caseTypeFilter, setCaseTypeFilter] =
    useState("Tất cả");

  const [caseStatusFilter, setCaseStatusFilter] =
    useState("Tất cả");

  const [historySearch, setHistorySearch] =
    useState("");

  const [historyTypeFilter, setHistoryTypeFilter] =
    useState("Tất cả");

  const [selectedCase, setSelectedCase] =
    useState(null);

  const [cases, setCases] =
    useState(() =>
      readStorage(
        STORAGE_CASES,
        DEFAULT_CASES
      )
    );

  const [history, setHistory] =
    useState(() =>
      readStorage(
        STORAGE_HISTORY,
        DEFAULT_HISTORY
      )
    );

  const [analyzing, setAnalyzing] =
    useState(false);

  const [result, setResult] =
    useState(null);

  const resultRef = useRef(null);

  /* =======================================================
     LƯU LOCAL STORAGE
  ======================================================= */

  useEffect(() => {
    localStorage.setItem(
      STORAGE_CASES,
      JSON.stringify(cases)
    );
  }, [cases]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_HISTORY,
      JSON.stringify(history)
    );
  }, [history]);

  /* =======================================================
     DỌN OBJECT URL
  ======================================================= */

  useEffect(() => {
    return () => {
      if (file1?.preview) {
        URL.revokeObjectURL(file1.preview);
      }
    };
  }, [file1]);

  useEffect(() => {
    return () => {
      if (file2?.preview) {
        URL.revokeObjectURL(file2.preview);
      }
    };
  }, [file2]);

  /* =======================================================
     THỐNG KÊ
  ======================================================= */

  const statistics = useMemo(() => {
    return {
      total: cases.length,

      processing: cases.filter(
        (item) =>
          item.status === "Đang xử lý"
      ).length,

      completed: cases.filter(
        (item) =>
          item.status === "Đã hoàn thành"
      ).length,

      history: history.length,
    };
  }, [cases, history]);

  /* =======================================================
     TÌM KIẾM
  ======================================================= */

  const filteredCases = useMemo(() => {
    const keyword =
      search.trim().toLowerCase();

    return cases.filter((item) => {
      const matchesKeyword =
        !keyword ||
        String(item.id)
          .toLowerCase()
          .includes(keyword) ||
        String(item.type)
          .toLowerCase()
          .includes(keyword) ||
        String(item.status)
          .toLowerCase()
          .includes(keyword) ||
        String(item.officer)
          .toLowerCase()
          .includes(keyword);

      const matchesType =
        caseTypeFilter === "Tất cả" ||
        item.type === caseTypeFilter;

      const matchesStatus =
        caseStatusFilter === "Tất cả" ||
        item.status === caseStatusFilter;

      return (
        matchesKeyword &&
        matchesType &&
        matchesStatus
      );
    });
  }, [
    cases,
    search,
    caseTypeFilter,
    caseStatusFilter,
  ]);

  const filteredHistory = useMemo(() => {
    const keyword = historySearch.trim().toLowerCase();

    return history.filter((item) => {
      const matchesKeyword =
        !keyword ||
        String(item.id).toLowerCase().includes(keyword) ||
        String(item.type).toLowerCase().includes(keyword) ||
        String(item.result).toLowerCase().includes(keyword) ||
        String(item.officer).toLowerCase().includes(keyword);

      const matchesType =
        historyTypeFilter === "Tất cả" ||
        item.type === historyTypeFilter;

      return matchesKeyword && matchesType;
    });
  }, [history, historySearch, historyTypeFilter]);

  /* =======================================================
     CHỌN FILE
  ======================================================= */

  function selectFile(
    selectedFile,
    setter
  ) {
    const preview =
      URL.createObjectURL(
        selectedFile
      );

    setter({
      file: selectedFile,
      preview,
    });

    setResult(null);
  }

  /* =======================================================
     XÓA FILE
  ======================================================= */

  function removeFile(
    file,
    setter
  ) {
    if (file?.preview) {
      URL.revokeObjectURL(
        file.preview
      );
    }

    setter(null);
    setResult(null);
  }

  /* =======================================================
     BẮT ĐẦU ĐỐI CHIẾU
  ======================================================= */

  async function handleAnalyze() {
    if (!file1 || !file2) {
      return;
    }

    setAnalyzing(true);
    setResult(null);

    try {
      const ai = await compareWithAI(
        type,
        file1.file,
        file2.file
      );

      const [preview1, preview2] =
        await Promise.all([
          fileToDataUrl(file1.preview),
          fileToDataUrl(file2.preview),
        ]);

      const score = Number(ai.score ?? 0);
      const differenceScore = Number(
        ai.differenceScore ?? Math.max(0, 100 - score)
      );
      const classification = classifyScore(score);

      const caseId = getNextCaseId(cases);
      const currentDate = formatDate();
      const currentDateTime = formatDateTime();

      const similarities = Array.isArray(ai.similarities)
        ? ai.similarities
        : [];
      const differences = Array.isArray(ai.differences)
        ? ai.differences
        : [];

      const analysisResult = {
        id: caseId,
        date: currentDateTime,
        type,
        score,
        differenceScore,
        conclusion: ai.classification || classification.label,
        detail: ai.summary || classification.detail,
        similarities,
        differences,
        model: ai.model,
        note:
          ai.disclaimer ||
          "Kết quả do AI hỗ trợ so sánh, chỉ mang tính tham khảo và không thay thế kết luận giám định chính thức.",
        file1Name: file1.file.name,
        file2Name: file2.file.name,
        file1Type: file1.file.type,
        file2Type: file2.file.type,
        file1Size: file1.file.size,
        file2Size: file2.file.size,
        file1Preview: preview1,
        file2Preview: preview2,
      };

      setResult(analysisResult);

      const newCase = {
        id: caseId,
        date: currentDate,
        type,
        status: "Đã hoàn thành",
        officer: "Cán bộ giám định",
        score,
        differenceScore,
        conclusion: analysisResult.conclusion,
        detail: analysisResult.detail,
        similarities,
        differences,
        model: ai.model,
        analyzedAt: currentDateTime,
        file1Name: file1.file.name,
        file2Name: file2.file.name,
        file1Type: file1.file.type,
        file2Type: file2.file.type,
        file1Size: file1.file.size,
        file2Size: file2.file.size,
        file1Preview: preview1,
        file2Preview: preview2,
      };

      setCases((previous) => [newCase, ...previous]);

      setHistory((previous) => [
        {
          id: caseId,
          date: currentDateTime,
          type,
          result: analysisResult.conclusion,
          score,
          differenceScore,
          officer: "Cán bộ giám định",
        },
        ...previous,
      ]);

      setTimeout(() => {
        resultRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    } catch (error) {
      console.error(error);
      setResult({
        error: error?.message ||
          "Không thể phân tích hai mẫu bằng AI. Hãy kiểm tra backend và OPENAI_API_KEY.",
      });
    } finally {
      setAnalyzing(false);
    }
  }

  /* =======================================================
     RESET PHIÊN GIÁM ĐỊNH
  ======================================================= */

  function resetInvestigation() {
    removeFile(file1, setFile1);
    removeFile(file2, setFile2);

    setResult(null);

    setType("Khuôn mặt");
  }

  /* =======================================================
     XUẤT HỒ SƠ PDF
  ======================================================= */

  function escapePrintHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function printCasePdf(caseData) {
    if (!caseData) {
      return;
    }

    const printWindow = window.open(
      "",
      "_blank",
      "width=1100,height=850"
    );

    if (!printWindow) {
      window.alert("Trình duyệt đã chặn cửa sổ xuất PDF. Hãy cho phép pop-up cho hệ thống này.");
      return;
    }

    const score =
      typeof caseData.score === "number"
        ? `${caseData.score}%`
        : "Chưa có";

    const image1 = caseData.file1Preview
      ? `<img src="${caseData.file1Preview}" alt="Đối tượng 01" />`
      : `<div class="no-image">Không có ảnh lưu trữ</div>`;

    const image2 = caseData.file2Preview
      ? `<img src="${caseData.file2Preview}" alt="Đối tượng 02" />`
      : `<div class="no-image">Không có ảnh lưu trữ</div>`;

    const html = `<!doctype html>
<html lang="vi">
<head>
<meta charset="UTF-8" />
<title>Hồ sơ ${escapePrintHtml(caseData.id)}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #fff; color: #1f2f3f; font-family: Arial, "Segoe UI", sans-serif; }
  .page { width: 190mm; margin: 0 auto; padding: 14mm 0 16mm; }
  .head { display:flex; justify-content:space-between; gap:25px; padding-bottom:16px; border-bottom:2px solid #183d5b; }
  .agency { color:#183d5b; font-size:11px; font-weight:800; letter-spacing:.8px; text-transform:uppercase; }
  .system { margin-top:5px; color:#5f7180; font-size:9px; }
  .title { margin:18px 0 4px; color:#183d5b; font-size:21px; font-weight:800; text-transform:uppercase; }
  .subtitle { margin:0; color:#657482; font-size:10px; }
  .code { min-width:170px; padding-left:16px; border-left:1px solid #ccd4db; }
  .code span { display:block; color:#788895; font-size:8px; font-weight:800; letter-spacing:1px; }
  .code strong { display:block; margin-top:6px; color:#183d5b; font-size:14px; }
  .section { margin-top:22px; }
  .section-title { padding-bottom:7px; border-bottom:1px solid #d7dde2; color:#183d5b; font-size:10px; font-weight:800; letter-spacing:1px; text-transform:uppercase; }
  .meta { display:grid; grid-template-columns:1fr 1fr 1fr; border:1px solid #d9dfe4; border-top:0; }
  .meta-item { min-height:55px; padding:10px 12px; border-right:1px solid #d9dfe4; border-bottom:1px solid #d9dfe4; }
  .meta-item:nth-child(3n) { border-right:0; }
  .meta-item span { display:block; color:#7a8995; font-size:8px; font-weight:700; text-transform:uppercase; }
  .meta-item strong { display:block; margin-top:5px; color:#273d50; font-size:10px; }
  .result { display:grid; grid-template-columns:170px 1fr; border:1px solid #d9dfe4; }
  .score { padding:18px; background:#f3f6f8; text-align:center; border-right:1px solid #d9dfe4; }
  .score span { display:block; color:#71818e; font-size:8px; font-weight:800; letter-spacing:.8px; }
  .score strong { display:block; margin-top:9px; color:#183d5b; font-size:28px; }
  .conclusion { padding:18px; }
  .conclusion-label { color:#71818e; font-size:8px; font-weight:800; letter-spacing:.8px; }
  .conclusion h2 { margin:8px 0 8px; color:#234e70; font-size:17px; }
  .conclusion p { margin:0; color:#536574; font-size:10px; line-height:1.6; }
  .compare-columns { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .compare-box { padding:12px 14px; border:1px solid #d9dfe4; background:#fafbfc; }
  .compare-title { color:#183d5b; font-size:9px; font-weight:800; letter-spacing:.7px; margin-bottom:7px; }
  .compare-box ul { margin:0; padding-left:17px; color:#536574; font-size:9px; line-height:1.55; }
  .compare-box li { margin:3px 0; }
  .samples { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  .sample { padding:10px; border:1px solid #d9dfe4; }
  .sample-title { margin-bottom:8px; color:#183d5b; font-size:9px; font-weight:800; letter-spacing:.7px; }
  .sample img, .no-image { width:100%; height:225px; object-fit:contain; display:flex; align-items:center; justify-content:center; background:#f0f2f4; border:1px solid #e0e4e8; }
  .sample-name { margin-top:8px; color:#344a5c; font-size:9px; font-weight:700; word-break:break-word; }
  .sample-info { margin-top:4px; color:#788792; font-size:8px; }
  .note { margin-top:22px; padding:12px 14px; border-left:3px solid #c9a52b; background:#faf8ef; color:#5f5a43; font-size:9px; line-height:1.55; }
  .footer { margin-top:25px; padding-top:10px; border-top:1px solid #d7dde2; display:flex; justify-content:space-between; color:#8996a0; font-size:8px; }
  @media print { @page { size:A4; margin:0; } body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } .page { margin:0 auto; } }
</style>
</head>
<body>
<div class="page">
  <div class="head">
    <div>
      <div class="agency">HỌC VIỆN CẢNH SÁT NHÂN DÂN</div>
      <div class="system">HỆ THỐNG QUẢN LÝ SO SÁNH MẪU VẬT</div>
      <div class="title">HỒ SƠ SO SÁNH MẪU VẬT</div>
      <p class="subtitle">Phiếu tổng hợp thông tin và kết quả đối chiếu tham khảo</p>
    </div>
    <div class="code"><span>MÃ HỒ SƠ</span><strong>${escapePrintHtml(caseData.id)}</strong></div>
  </div>

  <div class="section">
    <div class="section-title">01 — Thông tin hồ sơ</div>
    <div class="meta">
      <div class="meta-item"><span>Mã hồ sơ</span><strong>${escapePrintHtml(caseData.id)}</strong></div>
      <div class="meta-item"><span>Ngày tạo</span><strong>${escapePrintHtml(caseData.date)}</strong></div>
      <div class="meta-item"><span>Loại so sánh</span><strong>${escapePrintHtml(caseData.type)}</strong></div>
      <div class="meta-item"><span>Trạng thái</span><strong>${escapePrintHtml(caseData.status)}</strong></div>
      <div class="meta-item"><span>Cán bộ</span><strong>${escapePrintHtml(caseData.officer)}</strong></div>
      <div class="meta-item"><span>Thời điểm so sánh</span><strong>${escapePrintHtml(caseData.analyzedAt || "Chưa so sánh")}</strong></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">02 — Kết quả đối chiếu</div>
    <div class="result">
      <div class="score"><span>ĐIỂM TƯƠNG ĐỒNG THAM KHẢO</span><strong>${escapePrintHtml(score)}</strong></div>
      <div class="conclusion"><div class="conclusion-label">KẾT LUẬN THAM KHẢO</div><h2>${escapePrintHtml(caseData.conclusion || "Chưa có kết luận")}</h2><p>${escapePrintHtml(caseData.detail || "Chưa có nội dung kết quả.")}</p></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">03 — Phân tích giống và khác</div>
    <div class="compare-columns">
      <div class="compare-box"><div class="compare-title">ĐẶC ĐIỂM TƯƠNG ĐỒNG</div><ul>${(caseData.similarities || []).map((item) => `<li>${escapePrintHtml(item)}</li>`).join("") || "<li>Không có dữ liệu chi tiết.</li>"}</ul></div>
      <div class="compare-box"><div class="compare-title">ĐẶC ĐIỂM KHÁC BIỆT</div><ul>${(caseData.differences || []).map((item) => `<li>${escapePrintHtml(item)}</li>`).join("") || "<li>Không có dữ liệu chi tiết.</li>"}</ul></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">04 — Mẫu vật đã sử dụng</div>
    <div class="samples">
      <div class="sample"><div class="sample-title">ĐỐI TƯỢNG 01 — MẪU THAM CHIẾU</div>${image1}<div class="sample-name">${escapePrintHtml(caseData.file1Name || "Không có tên file")}</div><div class="sample-info">${escapePrintHtml(caseData.file1Type || "Không xác định")} ${caseData.file1Size ? "• " + Math.max(1, Math.round(caseData.file1Size / 1024)) + " KB" : ""}</div></div>
      <div class="sample"><div class="sample-title">ĐỐI TƯỢNG 02 — MẪU ĐỐI CHIẾU</div>${image2}<div class="sample-name">${escapePrintHtml(caseData.file2Name || "Không có tên file")}</div><div class="sample-info">${escapePrintHtml(caseData.file2Type || "Không xác định")} ${caseData.file2Size ? "• " + Math.max(1, Math.round(caseData.file2Size / 1024)) + " KB" : ""}</div></div>
    </div>
  </div>

  <div class="note"><strong>LƯU Ý NGHIỆP VỤ:</strong> Kết quả và điểm tương đồng AI trong hồ sơ này chỉ mang tính tham khảo. Không thay thế kết luận giám định chính thức.</div>
  <div class="footer"><span>So sánh mẫu vật — Học viện Cảnh sát nhân dân</span><span>In từ hệ thống nội bộ</span></div>
</div>
<script>
  window.addEventListener('load', function () {
    setTimeout(function () { window.focus(); window.print(); }, 450);
  });
</script>
</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }

  /* =======================================================
     XÓA HỒ SƠ
  ======================================================= */

  function deleteCase(caseId) {
    const target = cases.find(
      (item) => item.id === caseId
    );

    if (!target) {
      return;
    }

    const confirmed = window.confirm(
      `Bạn có chắc muốn xóa hồ sơ ${caseId}?\\n\\nHành động này sẽ xóa hồ sơ khỏi danh sách quản lý.`
    );

    if (!confirmed) {
      return;
    }

    setCases((previous) =>
      previous.filter((item) => item.id !== caseId)
    );

    setHistory((previous) =>
      previous.filter((item) => item.id !== caseId)
    );

    setSelectedCase(null);
  }

  /* =======================================================
     MỞ HỒ SƠ TỪ LỊCH SỬ
  ======================================================= */

  function openCaseFromHistory(caseId) {
    const target = cases.find(
      (item) => item.id === caseId
    );

    if (!target) {
      window.alert(
        `Không tìm thấy hồ sơ ${caseId} trong dữ liệu hồ sơ.`
      );
      return;
    }

    setSelectedCase(target);
    setActiveMenu("Hồ sơ");

    setTimeout(() => {
      const detail = document.querySelector(".detail-card");
      detail?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  }

  /* =======================================================
     MENU
  ======================================================= */

  function changeMenu(menu) {
    setActiveMenu(menu);

    if (menu !== "Hồ sơ") {
      setSelectedCase(null);
    }
  }

  /* =======================================================
     RENDER HEADER
  ======================================================= */

  function renderPageHeader(
    kicker,
    title,
    description,
    rightContent
  ) {
    return (
      <div className="page-header">
        <div>
          <div className="page-kicker">
            {kicker}
          </div>

          <h1>{title}</h1>

          <p>
            {description}
          </p>
        </div>

        {rightContent}
      </div>
    );
  }

  /* =======================================================
     DASHBOARD
  ======================================================= */

  function renderDashboard() {
    return (
      <>
        {renderPageHeader(
          "HỆ THỐNG QUẢN LÝ",
          "TỔNG QUAN HỆ THỐNG",
          "Theo dõi tình trạng hồ sơ và hoạt động giám định.",
          <div className="case-info">
            <span>TRẠNG THÁI HỆ THỐNG</span>
            <strong>
              Đang hoạt động
            </strong>
            <small>
              Cập nhật trực tuyến
            </small>
          </div>
        )}

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">
              TỔNG HỒ SƠ
            </div>

            <div className="stat-value">
              {statistics.total}
            </div>

            <div className="stat-note">
              Hồ sơ trong hệ thống
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              ĐANG XỬ LÝ
            </div>

            <div className="stat-value">
              {statistics.processing}
            </div>

            <div className="stat-note">
              Hồ sơ cần tiếp tục
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              ĐÃ HOÀN THÀNH
            </div>

            <div className="stat-value">
              {statistics.completed}
            </div>

            <div className="stat-note">
              Đã có kết quả
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              PHÂN TÍCH
            </div>

            <div className="stat-value">
              {statistics.history}
            </div>

            <div className="stat-note">
              Lượt phân tích
            </div>
          </div>
        </div>

        <div className="section-card">
          <div className="section-title">
            <div>
              <span className="section-kicker">
                HOẠT ĐỘNG
              </span>

              <h2>
                Hoạt động gần đây
              </h2>
            </div>

            <button
              className="text-button"
              onClick={() =>
                changeMenu("Lịch sử")
              }
            >
              Xem toàn bộ
            </button>
          </div>

          <div className="activity-list">
            {history
              .slice(0, 5)
              .map((item) => (
                <div
                  className="activity-row"
                  key={`${item.id}-${item.date}`}
                >
                  <div className="activity-marker">
                    <span />
                  </div>

                  <div className="activity-main">
                    <strong>
                      {item.id}
                    </strong>

                    <span>
                      {item.type}
                    </span>
                  </div>

                  <div
                    className={`result-text ${getResultClass(
                      item.result
                    )}`}
                  >
                    {item.result}
                  </div>

                  <div className="activity-date">
                    {item.date}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </>
    );
  }

  /* =======================================================
     GIÁM ĐỊNH
  ======================================================= */

  function renderInvestigation() {
    const canAnalyze =
      Boolean(file1 && file2);

    return (
      <>
        {renderPageHeader(
          "NGHIỆP VỤ GIÁM ĐỊNH",
          "GIÁM ĐỊNH MẪU VẬT",
          "Thiết lập phiên đối chiếu và phân tích hai mẫu vật.",
          <div className="case-info">
            <span>PHIÊN HIỆN TẠI</span>
            <strong>
              {getNextCaseId(cases)}
            </strong>
            <small>
              {formatDate()}
            </small>
          </div>
        )}

        <div className="work-card">
          <div className="work-card-header">
            <div>
              <span className="section-kicker">
                BƯỚC 01
              </span>

              <h2>
                Thông tin giám định
              </h2>

              <p>
                Xác định loại mẫu vật trước khi
                thực hiện đối chiếu.
              </p>
            </div>

            <div className="workflow-status">
              <span className="workflow-dot" />
              Sẵn sàng
            </div>
          </div>

          <div className="forensic-types">
            {FORENSIC_TYPES.map(
              (item) => (
                <button
                  key={item.id}
                  className={`type-button ${
                    type === item.name
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    setType(item.name)
                  }
                >
                  <span className="type-number">
                    {String(
                      FORENSIC_TYPES.indexOf(
                        item
                      ) + 1
                    ).padStart(2, "0")}
                  </span>

                  <span className="type-content">
                    <strong>
                      {item.name}
                    </strong>

                    <small>
                      {item.description}
                    </small>
                  </span>

                  <span className="type-check">
                    {type === item.name
                      ? "✓"
                      : ""}
                  </span>
                </button>
              )
            )}
          </div>
        </div>

        <div className="work-card">
          <div className="work-card-header">
            <div>
              <span className="section-kicker">
                BƯỚC 02
              </span>

              <h2>
                Nhập mẫu vật
              </h2>

              <p>
                Cung cấp hai hình ảnh cần đối chiếu.
              </p>
            </div>

            <div className="sample-count">
              {file1 ? 1 : 0} / 2 mẫu
            </div>
          </div>

          <div className="upload-grid">
            <UploadPanel
              title="Đối tượng 01"
              description="Mẫu vật tham chiếu"
              file={file1}
              onSelect={(file) =>
                selectFile(
                  file,
                  setFile1
                )
              }
              onRemove={() =>
                removeFile(
                  file1,
                  setFile1
                )
              }
            />

            <div className="vs-column">
              <div className="vs-line" />
              <div className="vs-badge">
                VS
              </div>
              <div className="vs-line" />
            </div>

            <UploadPanel
              title="Đối tượng 02"
              description="Mẫu vật cần đối chiếu"
              file={file2}
              onSelect={(file) =>
                selectFile(
                  file,
                  setFile2
                )
              }
              onRemove={() =>
                removeFile(
                  file2,
                  setFile2
                )
              }
            />
          </div>

          <div className="action-area">
            <div className="action-information">
              <span
                className={
                  canAnalyze
                    ? "indicator-ready"
                    : "indicator-waiting"
                }
              />

              {canAnalyze
                ? "Đã đủ hai mẫu để thực hiện đối chiếu."
                : "Cần nhập đủ hai mẫu trước khi phân tích."}
            </div>

            <div className="action-buttons">
              <button
                className="secondary-button"
                onClick={
                  resetInvestigation
                }
                disabled={analyzing}
              >
                Làm mới
              </button>

              <button
                className="primary-button"
                disabled={
                  !canAnalyze ||
                  analyzing
                }
                onClick={
                  handleAnalyze
                }
              >
                {analyzing
                  ? "ĐANG PHÂN TÍCH..."
                  : "BẮT ĐẦU ĐỐI CHIẾU"}
              </button>
            </div>
          </div>
        </div>

        {result && (
          <div
            className="result-section"
            ref={resultRef}
          >
            {result.error ? (
              <div className="error-result">
                <span>!</span>
                <div>
                  <strong>
                    Phân tích không thành công
                  </strong>
                  <p>
                    {result.error}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="result-header">
                  <div>
                    <span className="section-kicker">
                      BƯỚC 03
                    </span>

                    <h2>
                      Kết quả đối chiếu
                    </h2>

                    <p>
                      Phiên {result.id} •{" "}
                      {result.date}
                    </p>
                  </div>

                  <span className="result-complete">
                    PHÂN TÍCH HOÀN TẤT
                  </span>
                </div>

                <div className="result-grid">
                  <div className="score-panel">
                    <div className="score-label">
                      ĐIỂM TƯƠNG ĐỒNG THAM KHẢO
                    </div>

                    <div className="score-number">
                      {result.score}
                      <span>%</span>
                    </div>

                    <div className="score-bar">
                      <div
                        className="score-fill"
                        style={{
                          width: `${result.score}%`,
                        }}
                      />
                    </div>

                    <div className="score-scale">
                      <span>0</span>
                      <span>50</span>
                      <span>100</span>
                    </div>
                  </div>

                  <div className="conclusion-panel">
                    <div className="conclusion-label">
                      KẾT LUẬN THAM KHẢO
                    </div>

                    <h3
                      className={getResultClass(
                        result.conclusion
                      )}
                    >
                      {result.conclusion}
                    </h3>

                    <p>
                      {result.detail}
                    </p>

                    <div className="conclusion-meta">
                      <div>
                        <span>
                          Loại so sánh
                        </span>

                        <strong>
                          {result.type}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Mã hồ sơ
                        </span>

                        <strong>
                          {result.id}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>

                {(result.similarities?.length || result.differences?.length) ? (
                  <div className="ai-comparison-details">
                    <div className="ai-detail-column">
                      <span className="ai-detail-title">ĐẶC ĐIỂM TƯƠNG ĐỒNG</span>
                      <ul>
                        {(result.similarities || []).map((item, index) => (
                          <li key={`similar-${index}`}>{item}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="ai-detail-column">
                      <span className="ai-detail-title">ĐẶC ĐIỂM KHÁC BIỆT</span>
                      <ul>
                        {(result.differences || []).map((item, index) => (
                          <li key={`different-${index}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : null}

                <div className="result-files">
                  <div>
                    <span>
                      ĐỐI TƯỢNG 01
                    </span>

                    <strong>
                      {result.file1Name}
                    </strong>
                  </div>

                  <div>
                    <span>
                      ĐỐI TƯỢNG 02
                    </span>

                    <strong>
                      {result.file2Name}
                    </strong>
                  </div>
                </div>

                <div className="result-disclaimer">
                  <strong>
                    LƯU Ý NGHIỆP VỤ
                  </strong>

                  <span>
                    {result.note}
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </>
    );
  }

  /* =======================================================
     HỒ SƠ
  ======================================================= */

  function renderCases() {
    return (
      <>
        {renderPageHeader(
          "QUẢN LÝ HỒ SƠ",
          "HỒ SƠ SO SÁNH MẪU VẬT",
          "Tra cứu, theo dõi và xem kết quả các phiên so sánh mẫu vật.",
          <div className="case-info">
            <span>TỔNG HỒ SƠ</span>
            <strong>
              {cases.length}
            </strong>
            <small>
              Hồ sơ đã ghi nhận
            </small>
          </div>
        )}

        <div className="table-card">
          <div className="table-toolbar">
            <div>
              <span className="section-kicker">
                DANH SÁCH
              </span>

              <h2>
                Hồ sơ giám định
              </h2>
            </div>

            <div className="case-filters">
              <div className="search-box">
                <span>⌕</span>

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  placeholder="Tìm mã hồ sơ, loại, cán bộ..."
                />
              </div>

              <select
                className="filter-select"
                value={caseTypeFilter}
                onChange={(event) =>
                  setCaseTypeFilter(event.target.value)
                }
              >
                <option value="Tất cả">
                  Tất cả loại
                </option>

                {FORENSIC_TYPES.map((item) => (
                  <option
                    key={item.id}
                    value={item.name}
                  >
                    {item.name}
                  </option>
                ))}
              </select>

              <select
                className="filter-select"
                value={caseStatusFilter}
                onChange={(event) =>
                  setCaseStatusFilter(event.target.value)
                }
              >
                <option value="Tất cả">
                  Tất cả trạng thái
                </option>
                <option value="Chưa thực hiện">
                  Chưa thực hiện
                </option>
                <option value="Đang xử lý">
                  Đang xử lý
                </option>
                <option value="Đã hoàn thành">
                  Đã hoàn thành
                </option>
              </select>
            </div>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Mã hồ sơ</th>
                  <th>Ngày tạo</th>
                  <th>Loại so sánh</th>
                  <th>Trạng thái</th>
                  <th>Kết luận</th>
                  <th>Cán bộ</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {filteredCases.length ===
                0 ? (
                  <tr>
                    <td
                      colSpan="7"
                      className="empty-table"
                    >
                      Không tìm thấy hồ sơ phù hợp.
                    </td>
                  </tr>
                ) : (
                  filteredCases.map(
                    (item) => (
                      <tr key={item.id}>
                        <td>
                          <strong className="case-id">
                            {item.id}
                          </strong>
                        </td>

                        <td>
                          {item.date}
                        </td>

                        <td>
                          {item.type}
                        </td>

                        <td>
                          <span
                            className={`status-badge ${getStatusClass(
                              item.status
                            )}`}
                          >
                            {item.status}
                          </span>
                        </td>

                        <td>
                          {item.conclusion ? (
                            <span
                              className={`result-text ${getResultClass(
                                item.conclusion
                              )}`}
                            >
                              {
                                item.conclusion
                              }
                            </span>
                          ) : (
                            <span className="muted">
                              Chưa có
                            </span>
                          )}
                        </td>

                        <td>
                          {item.officer}
                        </td>

                        <td>
                          <button
                            className="view-button"
                            onClick={() =>
                              setSelectedCase(
                                item
                              )
                            }
                          >
                            Xem
                          </button>
                        </td>
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>

        {selectedCase && (
          <div className="detail-card">
            <div className="detail-header">
              <div>
                <span className="section-kicker">
                  CHI TIẾT HỒ SƠ
                </span>

                <h2>
                  {selectedCase.id}
                </h2>
              </div>

              <button
                className="close-button"
                onClick={() =>
                  setSelectedCase(null)
                }
              >
                Đóng
              </button>
            </div>

            <div className="detail-grid">
              <div>
                <span>
                  Mã hồ sơ
                </span>

                <strong>
                  {selectedCase.id}
                </strong>
              </div>

              <div>
                <span>
                  Ngày tạo
                </span>

                <strong>
                  {selectedCase.date}
                </strong>
              </div>

              <div>
                <span>
                  Loại so sánh
                </span>

                <strong>
                  {selectedCase.type}
                </strong>
              </div>

              <div>
                <span>
                  Trạng thái
                </span>

                <strong>
                  {selectedCase.status}
                </strong>
              </div>

              <div>
                <span>
                  Cán bộ
                </span>

                <strong>
                  {selectedCase.officer}
                </strong>
              </div>

              <div>
                <span>
                  Thời điểm so sánh
                </span>

                <strong>
                  {selectedCase.analyzedAt || "Chưa so sánh"}
                </strong>
              </div>
            </div>

            {selectedCase.conclusion && (
              <div className="detail-conclusion">
                <span>
                  KẾT LUẬN THAM KHẢO
                </span>

                <strong
                  className={getResultClass(
                    selectedCase.conclusion
                  )}
                >
                  {selectedCase.conclusion}
                </strong>

                <p>
                  {selectedCase.detail}
                </p>

                {selectedCase.score !== null &&
                  selectedCase.score !== undefined && (
                    <div className="detail-score">
                      Điểm tương đồng AI:{" "}
                      <strong>
                        {selectedCase.score}%
                      </strong>
                      {typeof selectedCase.differenceScore === "number" && (
                        <>
                          {" • Khác biệt: "}
                          <strong>{selectedCase.differenceScore}%</strong>
                        </>
                      )}
                    </div>
                  )}
              </div>
            )}

            {(selectedCase.similarities?.length || selectedCase.differences?.length) ? (
              <div className="ai-comparison-details detail-ai-details">
                <div className="ai-detail-column">
                  <span className="ai-detail-title">ĐẶC ĐIỂM TƯƠNG ĐỒNG</span>
                  <ul>
                    {(selectedCase.similarities || []).map((item, index) => (
                      <li key={`detail-similar-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="ai-detail-column">
                  <span className="ai-detail-title">ĐẶC ĐIỂM KHÁC BIỆT</span>
                  <ul>
                    {(selectedCase.differences || []).map((item, index) => (
                      <li key={`detail-different-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}

            {(selectedCase.file1Name ||
              selectedCase.file2Name) && (
              <div className="detail-samples">
                <div className="detail-samples-title">
                  <div>
                    <span className="section-kicker">
                      MẪU VẬT
                    </span>
                    <h3>
                      Hai đối tượng đã sử dụng
                    </h3>
                  </div>
                </div>

                <div className="detail-samples-grid">
                  <div className="detail-sample">
                    <div className="detail-sample-label">
                      ĐỐI TƯỢNG 01
                    </div>

                    {selectedCase.file1Preview ? (
                      <img
                        src={selectedCase.file1Preview}
                        alt="Đối tượng 01"
                      />
                    ) : (
                      <div className="sample-no-preview">
                        Không có ảnh lưu trữ
                      </div>
                    )}

                    <strong>
                      {selectedCase.file1Name || "—"}
                    </strong>

                    <small>
                      {selectedCase.file1Type || "Không xác định"}
                      {selectedCase.file1Size
                        ? ` • ${Math.max(
                            1,
                            Math.round(
                              selectedCase.file1Size / 1024
                            )
                          )} KB`
                        : ""}
                    </small>
                  </div>

                  <div className="detail-sample-vs">
                    VS
                  </div>

                  <div className="detail-sample">
                    <div className="detail-sample-label">
                      ĐỐI TƯỢNG 02
                    </div>

                    {selectedCase.file2Preview ? (
                      <img
                        src={selectedCase.file2Preview}
                        alt="Đối tượng 02"
                      />
                    ) : (
                      <div className="sample-no-preview">
                        Không có ảnh lưu trữ
                      </div>
                    )}

                    <strong>
                      {selectedCase.file2Name || "—"}
                    </strong>

                    <small>
                      {selectedCase.file2Type || "Không xác định"}
                      {selectedCase.file2Size
                        ? ` • ${Math.max(
                            1,
                            Math.round(
                              selectedCase.file2Size / 1024
                            )
                          )} KB`
                        : ""}
                    </small>
                  </div>
                </div>
              </div>
            )}

            <div className="detail-actions">
              <button
                className="secondary-button"
                onClick={() =>
                  deleteCase(selectedCase.id)
                }
              >
                Xóa hồ sơ
              </button>

              <button
                className="secondary-button pdf-button"
                onClick={() =>
                  printCasePdf(selectedCase)
                }
              >
                Xuất hồ sơ PDF
              </button>

              <button
                className="primary-button"
                onClick={() =>
                  setSelectedCase(null)
                }
              >
                Đóng hồ sơ
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  /* =======================================================
     LỊCH SỬ
  ======================================================= */

  function renderHistory() {
    return (
      <>
        {renderPageHeader(
          "NHẬT KÝ HỆ THỐNG",
          "LỊCH SỬ SO SÁNH",
          "Theo dõi các lượt so sánh và kết quả đã thực hiện.",
          <div className="case-info">
            <span>TỔNG LƯỢT SO SÁNH</span>
            <strong>{history.length}</strong>
            <small>Nhật ký hệ thống</small>
          </div>
        )}

        <div className="table-card">
          <div className="table-toolbar history-toolbar">
            <div>
              <span className="section-kicker">NHẬT KÝ</span>
              <h2>Lịch sử so sánh</h2>
            </div>

            <div className="case-filters">
              <input
                className="case-search history-search"
                type="text"
                placeholder="Tìm mã hồ sơ..."
                value={historySearch}
                onChange={(event) => setHistorySearch(event.target.value)}
              />

              <select
                className="filter-select"
                value={historyTypeFilter}
                onChange={(event) => setHistoryTypeFilter(event.target.value)}
              >
                <option value="Tất cả">Tất cả loại</option>
                {FORENSIC_TYPES.map((item) => (
                  <option key={item.id} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Mã hồ sơ</th>
                  <th>Thời gian</th>
                  <th>Loại so sánh</th>
                  <th>Điểm</th>
                  <th>Kết quả</th>
                  <th>Cán bộ</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan="7">
                      <div className="empty-table">
                        Không tìm thấy dữ liệu phù hợp.
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((item) => (
                    <tr key={`${item.id}-${item.date}`}>
                      <td>
                        <strong className="case-id">{item.id}</strong>
                      </td>
                      <td>{item.date}</td>
                      <td>{item.type}</td>
                      <td>
                        {typeof item.score === "number" ? `${item.score}%` : "—"}
                      </td>
                      <td>
                        <span className={`result-text ${getResultClass(item.result)}`}>
                          {item.result}
                        </span>
                      </td>
                      <td>{item.officer}</td>
                      <td>
                        <button
                          className="view-button"
                          onClick={() => openCaseFromHistory(item.id)}
                        >
                          Xem hồ sơ
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="history-footer">
            Hiển thị {filteredHistory.length} / {history.length} lượt so sánh
          </div>
        </div>
      </>
    );
  }

  /* =======================================================
     NỘI DUNG CHÍNH
  ======================================================= */

  function renderContent() {
    if (
      activeMenu ===
      "Tổng quan"
    ) {
      return renderDashboard();
    }

    if (
      activeMenu ===
      "Hồ sơ"
    ) {
      return renderCases();
    }

    if (
      activeMenu ===
      "Lịch sử"
    ) {
      return renderHistory();
    }

    return renderInvestigation();
  }

  /* =======================================================
     RENDER APP
  ======================================================= */

  return (
    <div className="system">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img
            src="/logo.png"
            alt="Học viện Cảnh sát nhân dân"
          />

          <div className="brand-text">
            <strong>
              HỌC VIỆN
            </strong>

            <span>
              CẢNH SÁT NHÂN DÂN
            </span>
          </div>
        </div>

        <div className="sidebar-system">
          HỆ THỐNG GIÁM ĐỊNH
        </div>

        <nav className="sidebar-menu">
          <button
            className={
              activeMenu === "Tổng quan"
                ? "menu-item active"
                : "menu-item"
            }
            onClick={() =>
              changeMenu(
                "Tổng quan"
              )
            }
          >
            <span className="menu-icon">
              ▦
            </span>

            <span>
              Tổng quan
            </span>
          </button>

          <button
            className={
              activeMenu === "Giám định"
                ? "menu-item active"
                : "menu-item"
            }
            onClick={() =>
              changeMenu(
                "Giám định"
              )
            }
          >
            <span className="menu-icon">
              ◎
            </span>

            <span>
              Giám định
            </span>
          </button>

          <button
            className={
              activeMenu === "Hồ sơ"
                ? "menu-item active"
                : "menu-item"
            }
            onClick={() =>
              changeMenu("Hồ sơ")
            }
          >
            <span className="menu-icon">
              □
            </span>

            <span>
              Hồ sơ
            </span>
          </button>

          <button
            className={
              activeMenu === "Lịch sử"
                ? "menu-item active"
                : "menu-item"
            }
            onClick={() =>
              changeMenu(
                "Lịch sử"
              )
            }
          >
            <span className="menu-icon">
              ◷
            </span>

            <span>
              Lịch sử
            </span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="internal-badge">
            <span />
            HỆ THỐNG NỘI BỘ
          </div>

          <div className="version">
            Forensic Management
            <br />
            Version 1.0.0
          </div>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <span>
              HỌC VIỆN CẢNH SÁT NHÂN DÂN
            </span>

            <b>/</b>

            <strong>
              {activeMenu}
            </strong>
          </div>

          <div className="topbar-right">
            <div className="system-status">
              <span />
              Hệ thống hoạt động
            </div>

            <div className="topbar-divider" />

            <div className="user-profile">
              <div className="user-avatar">
                CB
              </div>

              <div>
                <strong>
                  Cán bộ giám định
                </strong>

                <span>
                  Tài khoản nội bộ
                </span>
              </div>
            </div>
          </div>
        </header>

        <section className="content">
          {renderContent()}
        </section>
      </main>
    </div>
  );
}

export default App;
