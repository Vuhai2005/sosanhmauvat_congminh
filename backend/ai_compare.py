"""
So sánh hai ảnh bằng Computer Vision cục bộ.

- Không dùng OpenAI API.
- Không dùng Ollama.
- Không cần Internet.
- Phân tích trực tiếp nội dung pixel/đặc trưng của 2 ảnh.

Lưu ý:
Đây là công cụ hỗ trợ đối chiếu ảnh cho đồ án/demo,
không phải kết luận giám định pháp y.
"""

from __future__ import annotations

import math
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from PIL import Image


def _load_image(path: Path) -> np.ndarray:
    if not path.exists():
        raise ValueError(f"Không tìm thấy ảnh: {path}")

    try:
        pil = Image.open(path).convert("RGB")
        arr = np.asarray(pil)

        return cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)

    except Exception as exc:
        raise ValueError(
            f"Không đọc được ảnh {path.name}: {exc}"
        ) from exc


def _resize(
    img: np.ndarray,
    size: int = 640,
) -> np.ndarray:

    h, w = img.shape[:2]

    if max(h, w) <= size:
        return img.copy()

    scale = size / max(h, w)

    return cv2.resize(
        img,
        (
            max(1, int(w * scale)),
            max(1, int(h * scale)),
        ),
        interpolation=cv2.INTER_AREA,
    )


def _gray(img: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)


# ============================================================
# 1. SO SÁNH MÀU / SẮC ĐỘ
# ============================================================

def _normalize_hist_similarity(
    a: np.ndarray,
    b: np.ndarray,
) -> float:

    ahsv = cv2.cvtColor(a, cv2.COLOR_BGR2HSV)
    bhsv = cv2.cvtColor(b, cv2.COLOR_BGR2HSV)

    ha = cv2.calcHist(
        [ahsv],
        [0, 1],
        None,
        [32, 32],
        [0, 180, 0, 256],
    )

    hb = cv2.calcHist(
        [bhsv],
        [0, 1],
        None,
        [32, 32],
        [0, 180, 0, 256],
    )

    cv2.normalize(ha, ha)
    cv2.normalize(hb, hb)

    corr = float(
        cv2.compareHist(
            ha,
            hb,
            cv2.HISTCMP_CORREL,
        )
    )

    return float(
        np.clip(
            (corr + 1.0) * 50.0,
            0.0,
            100.0,
        )
    )


# ============================================================
# 2. SO SÁNH ĐƯỜNG BIÊN
# ============================================================

def _edge_similarity(
    a: np.ndarray,
    b: np.ndarray,
) -> float:

    ga = _gray(a)
    gb = _gray(b)

    ga = cv2.resize(
        ga,
        (256, 256),
        interpolation=cv2.INTER_AREA,
    )

    gb = cv2.resize(
        gb,
        (256, 256),
        interpolation=cv2.INTER_AREA,
    )

    ea = cv2.Canny(
        ga,
        70,
        150,
    )

    eb = cv2.Canny(
        gb,
        70,
        150,
    )

    aa = ea > 0
    bb = eb > 0

    inter = np.logical_and(
        aa,
        bb,
    ).sum()

    denom = aa.sum() + bb.sum()

    if denom == 0:
        return 100.0

    dice = (
        2.0
        * inter
        / denom
    )

    return float(
        np.clip(
            dice * 100.0,
            0.0,
            100.0,
        )
    )


# ============================================================
# 3. SO SÁNH CẤU TRÚC
# ============================================================

def _structure_similarity(
    a: np.ndarray,
    b: np.ndarray,
) -> float:

    ga = cv2.resize(
        _gray(a),
        (256, 256),
        interpolation=cv2.INTER_AREA,
    )

    gb = cv2.resize(
        _gray(b),
        (256, 256),
        interpolation=cv2.INTER_AREA,
    )

    ga = ga.astype(
        np.float32
    ) / 255.0

    gb = gb.astype(
        np.float32
    ) / 255.0

    mae = float(
        np.mean(
            np.abs(
                ga - gb
            )
        )
    )

    mae_score = max(
        0.0,
        100.0 * (1.0 - mae),
    )

    corr = float(
        np.corrcoef(
            ga.ravel(),
            gb.ravel(),
        )[0, 1]
    )

    if not np.isfinite(corr):
        corr = 0.0

    corr_score = float(
        np.clip(
            (corr + 1.0) * 50.0,
            0.0,
            100.0,
        )
    )

    return (
        0.55 * mae_score
        + 0.45 * corr_score
    )


# ============================================================
# 4. SO SÁNH ĐIỂM ĐẶC TRƯNG ORB
# ============================================================

def _orb_similarity(
    a: np.ndarray,
    b: np.ndarray,
) -> tuple[float, int, int]:

    ga = _gray(a)
    gb = _gray(b)

    orb = cv2.ORB_create(
        nfeatures=1200,
        scaleFactor=1.2,
        nlevels=8,
        fastThreshold=10,
    )

    kp1, des1 = orb.detectAndCompute(
        ga,
        None,
    )

    kp2, des2 = orb.detectAndCompute(
        gb,
        None,
    )

    n1 = len(kp1) if kp1 else 0
    n2 = len(kp2) if kp2 else 0

    if (
        des1 is None
        or des2 is None
        or n1 == 0
        or n2 == 0
    ):
        return 0.0, 0, 0

    matcher = cv2.BFMatcher(
        cv2.NORM_HAMMING,
        crossCheck=False,
    )

    matches = matcher.knnMatch(
        des1,
        des2,
        k=2,
    )

    good = []

    for pair in matches:

        if len(pair) != 2:
            continue

        m, n = pair

        if m.distance < 0.75 * n.distance:
            good.append(m)

    base = min(
        n1,
        n2,
    )

    ratio = (
        len(good)
        / max(1, base)
    )

    if good:

        mean_distance = float(
            np.mean(
                [
                    m.distance
                    for m in good
                ]
            )
        )

        quality = max(
            0.0,
            1.0
            - mean_distance / 80.0,
        )

    else:
        quality = 0.0

    score = 100.0 * (
        0.65
        * min(
            1.0,
            ratio * 2.2,
        )
        + 0.35 * quality
    )

    return (
        float(
            np.clip(
                score,
                0.0,
                100.0,
            )
        ),
        len(good),
        base,
    )


# ============================================================
# 5. SO SÁNH TỶ LỆ ẢNH
# ============================================================

def _size_similarity(
    a: np.ndarray,
    b: np.ndarray,
) -> float:

    ha, wa = a.shape[:2]
    hb, wb = b.shape[:2]

    ra = wa / max(
        1,
        ha,
    )

    rb = wb / max(
        1,
        hb,
    )

    ratio_diff = abs(
        math.log(
            max(ra, 1e-6)
            / max(rb, 1e-6)
        )
    )

    return float(
        np.clip(
            100.0
            * math.exp(-ratio_diff),
            0.0,
            100.0,
        )
    )


# ============================================================
# 6. PHÂN LOẠI
# ============================================================

def _classify(
    score: float,
) -> str:

    if score >= 85:
        return "TƯƠNG ĐỒNG CAO"

    if score >= 65:
        return "TƯƠNG ĐỒNG TRUNG BÌNH"

    if score >= 45:
        return "TƯƠNG ĐỒNG THẤP"

    return "KHÁC BIỆT ĐÁNG KỂ"


# ============================================================
# 7. TÊN LOẠI MẪU
# ============================================================

def _type_label(
    forensic_type: str,
) -> str:

    value = (
        forensic_type
        or ""
    ).strip().lower()

    if (
        "face" in value
        or "khuôn mặt" in value
        or "người" in value
    ):
        return "khuôn mặt"

    if (
        "seal" in value
        or "dấu" in value
        or "con dấu" in value
    ):
        return "dấu / con dấu"

    if (
        "hand" in value
        or "chữ" in value
        or "ký" in value
    ):
        return "chữ viết / chữ ký"

    if (
        "document" in value
        or "tài liệu" in value
        or "giấy" in value
    ):
        return "tài liệu"

    return "mẫu vật"


# ============================================================
# 8. TẠO ĐẶC ĐIỂM TƯƠNG ĐỒNG / KHÁC BIỆT
# ============================================================

def _similarity_details(
    label: str,
    orb: float,
    structure: float,
    edges: float,
    histogram: float,
    aspect: float,
    good_matches: int,
    feature_count: int,
) -> tuple[list[str], list[str]]:

    similarities: list[str] = []
    differences: list[str] = []

    # --------------------------------------------------------
    # ĐẶC TRƯNG HÌNH HỌC
    # --------------------------------------------------------

    if orb >= 75:

        similarities.append(
            f"Đặc trưng hình học của {label} "
            f"có mức tương ứng cao "
            f"(điểm {orb:.1f}/100; "
            f"{good_matches} điểm ghép phù hợp)."
        )

    elif orb >= 50:

        similarities.append(
            f"Phát hiện mức tương ứng trung bình "
            f"ở các đặc trưng hình học của {label} "
            f"(điểm {orb:.1f}/100; "
            f"{good_matches} điểm ghép phù hợp)."
        )

    elif orb >= 30:

        similarities.append(
            f"Chỉ ghi nhận một số đặc trưng hình học "
            f"tương ứng của {label} "
            f"(điểm {orb:.1f}/100; "
            f"{good_matches} điểm ghép phù hợp)."
        )

        differences.append(
            f"Nhiều điểm đặc trưng của hai ảnh "
            f"không tìm được vị trí tương ứng "
            f"(chỉ {good_matches} điểm ghép phù hợp)."
        )

    else:

        differences.append(
            f"Đặc trưng hình học của hai ảnh "
            f"khác biệt rõ "
            f"(điểm tương ứng {orb:.1f}/100; "
            f"chỉ {good_matches} điểm ghép phù hợp)."
        )

    # --------------------------------------------------------
    # CẤU TRÚC SÁNG / TỐI
    # --------------------------------------------------------

    if structure >= 75:

        similarities.append(
            f"Cấu trúc và phân bố sáng/tối tổng thể "
            f"khá giống nhau "
            f"(mức tương đồng {structure:.1f}/100)."
        )

    elif structure >= 55:

        similarities.append(
            f"Cấu trúc sáng/tối có nhiều vùng "
            f"tương đồng "
            f"(mức {structure:.1f}/100)."
        )

    else:

        differences.append(
            f"Cấu trúc và phân bố sáng/tối "
            f"có sai khác đáng kể "
            f"(mức tương đồng chỉ "
            f"{structure:.1f}/100)."
        )

    # --------------------------------------------------------
    # ĐƯỜNG BIÊN / HÌNH THÁI
    # --------------------------------------------------------

    if edges >= 75:

        similarities.append(
            f"Đường biên và hình thái tổng thể "
            f"có mức tương ứng cao "
            f"(điểm {edges:.1f}/100)."
        )

    elif edges >= 55:

        similarities.append(
            f"Nhiều đường biên chính "
            f"có hình thái tương đối tương đồng "
            f"(điểm {edges:.1f}/100)."
        )

    else:

        differences.append(
            f"Đường biên và hình thái tổng thể "
            f"có mức tương đồng thấp "
            f"(điểm {edges:.1f}/100)."
        )

    # --------------------------------------------------------
    # MÀU / SẮC ĐỘ
    # --------------------------------------------------------

    if histogram >= 75:

        similarities.append(
            f"Phân bố màu và sắc độ giữa hai ảnh "
            f"khá gần nhau "
            f"(điểm {histogram:.1f}/100)."
        )

    elif histogram >= 55:

        similarities.append(
            f"Phân bố màu/sắc độ có mức "
            f"tương đồng trung bình "
            f"(điểm {histogram:.1f}/100)."
        )

    else:

        differences.append(
            f"Phân bố màu và sắc độ giữa hai ảnh "
            f"có chênh lệch rõ "
            f"(điểm {histogram:.1f}/100)."
        )

    # --------------------------------------------------------
    # TỶ LỆ
    # --------------------------------------------------------

    if aspect >= 90:

        similarities.append(
            f"Tỷ lệ khung hình của hai mẫu "
            f"gần như tương đồng "
            f"(điểm {aspect:.1f}/100)."
        )

    elif aspect >= 70:

        similarities.append(
            f"Tỷ lệ khung hình của hai mẫu "
            f"tương đối gần nhau "
            f"(điểm {aspect:.1f}/100)."
        )

    else:

        differences.append(
            f"Tỷ lệ khung hình giữa hai ảnh "
            f"có sai khác đáng kể "
            f"(điểm {aspect:.1f}/100)."
        )

    # --------------------------------------------------------
    # ĐẢM BẢO LUÔN CÓ NỘI DUNG
    # --------------------------------------------------------

    if not similarities:

        similarities.append(
            f"Chưa phát hiện đặc điểm hình ảnh "
            f"nổi bật có mức tương đồng cao "
            f"đối với {label}."
        )

    if not differences:

        differences.append(
            "Chưa phát hiện khác biệt nổi bật "
            "theo các chỉ số hình ảnh đã phân tích."
        )

    return (
        similarities,
        differences,
    )


# ============================================================
# 9. HÀM SO SÁNH CHÍNH
# ============================================================

def compare_images(
    forensic_type: str,
    object1: Path,
    object2: Path,
) -> dict[str, Any]:

    if not object1 or not object2:

        raise ValueError(
            "Thiếu một trong hai ảnh cần so sánh."
        )

    img1 = _resize(
        _load_image(
            Path(object1)
        )
    )

    img2 = _resize(
        _load_image(
            Path(object2)
        )
    )

    if (
        img1.size == 0
        or img2.size == 0
    ):

        raise ValueError(
            "Ảnh rỗng hoặc không hợp lệ."
        )

    # --------------------------------------------------------
    # PHÂN TÍCH
    # --------------------------------------------------------

    histogram = (
        _normalize_hist_similarity(
            img1,
            img2,
        )
    )

    edges = (
        _edge_similarity(
            img1,
            img2,
        )
    )

    structure = (
        _structure_similarity(
            img1,
            img2,
        )
    )

    orb, good_matches, feature_count = (
        _orb_similarity(
            img1,
            img2,
        )
    )

    aspect = (
        _size_similarity(
            img1,
            img2,
        )
    )

    # --------------------------------------------------------
    # ĐIỂM TỔNG HỢP
    # --------------------------------------------------------

    score = (
        0.30 * orb
        + 0.25 * structure
        + 0.20 * edges
        + 0.15 * histogram
        + 0.10 * aspect
    )

    score = float(
        np.clip(
            score,
            0.0,
            100.0,
        )
    )

    score = round(
        score,
        1,
    )

    difference = round(
        100.0 - score,
        1,
    )

    classification = _classify(
        score
    )

    label = _type_label(
        forensic_type
    )

    # --------------------------------------------------------
    # CHI TIẾT TƯƠNG ĐỒNG / KHÁC BIỆT
    # --------------------------------------------------------

    similarities, differences = (
        _similarity_details(
            label=label,
            orb=orb,
            structure=structure,
            edges=edges,
            histogram=histogram,
            aspect=aspect,
            good_matches=good_matches,
            feature_count=feature_count,
        )
    )

    # --------------------------------------------------------
    # ĐẶC TRƯNG CAO NHẤT / THẤP NHẤT
    # --------------------------------------------------------

    metrics_for_text = [
        (
            "đặc trưng hình học",
            orb,
        ),
        (
            "cấu trúc sáng/tối",
            structure,
        ),
        (
            "đường biên/hình thái",
            edges,
        ),
        (
            "màu sắc/sắc độ",
            histogram,
        ),
        (
            "tỷ lệ khung hình",
            aspect,
        ),
    ]

    strongest = max(
        metrics_for_text,
        key=lambda item: item[1],
    )

    weakest = min(
        metrics_for_text,
        key=lambda item: item[1],
    )

    # --------------------------------------------------------
    # TÓM TẮT
    # --------------------------------------------------------

    summary = (
        f"Kết quả đối chiếu hình ảnh {label}: "
        f"{classification.lower()}, "
        f"điểm tương đồng tham khảo {score}/100 "
        f"và điểm khác biệt {difference}/100. "
        f"Đặc trưng có mức tương đồng cao nhất là "
        f"{strongest[0]} "
        f"({strongest[1]:.1f}/100); "
        f"mức thấp nhất là "
        f"{weakest[0]} "
        f"({weakest[1]:.1f}/100)."
    )

    # --------------------------------------------------------
    # KẾT QUẢ TRẢ VỀ FRONTEND
    # --------------------------------------------------------

    return {

        "success": True,

        "score": score,

        "differenceScore": difference,

        "classification": classification,

        "summary": summary,

        "similarities": similarities,

        "differences": differences,

        "model": (
            "Computer Vision local — "
            "ORB + cấu trúc + biên + histogram"
        ),

        "provider": "local-cv",

        "disclaimer": (
            "Kết quả chỉ có giá trị hỗ trợ "
            "đối chiếu hình ảnh trong phạm vi "
            "đồ án/demo. Không phải kết luận "
            "giám định pháp y hoặc kết luận pháp lý."
        ),

        "object1": Path(
            object1
        ).name,

        "object2": Path(
            object2
        ).name,

        "metrics": {

            "orb": round(
                orb,
                1,
            ),

            "structure": round(
                structure,
                1,
            ),

            "edges": round(
                edges,
                1,
            ),

            "histogram": round(
                histogram,
                1,
            ),

            "aspect": round(
                aspect,
                1,
            ),

            "good_matches": (
                good_matches
            ),

            "feature_count": (
                feature_count
            ),
        },
    }