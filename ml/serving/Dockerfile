# syntax=docker/dockerfile:1
FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY serving/requirements.txt ./
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

COPY serving/ ./
COPY model_registry/ ../model_registry/

# Ensure model registry artifacts are usable:
# 1. Ensure impute_medians.json is valid.
# 2. Generate or repair training_report.json so serving app has feature_sets.
RUN python3 - <<'EOF'
import os, json, joblib

MODEL_DIR = "../model_registry/motor/1.0.0"

medians_path = os.path.join(MODEL_DIR, "preprocess", "impute_medians.json")
if os.path.exists(medians_path):
    try:
        raw = open(medians_path).read().strip()
        if not raw:
            raise ValueError("empty")
        json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        with open(medians_path, "w") as fh:
            json.dump({"motor": {}, "context_numeric": {}}, fh)
        print("Fixed empty/invalid impute_medians.json")

report_path = os.path.join(MODEL_DIR, "reports", "training_report.json")
os.makedirs(os.path.join(MODEL_DIR, "reports"), exist_ok=True)
report = {}
if os.path.exists(report_path):
    try:
        with open(report_path, "r", encoding="utf-8") as fh:
            report = json.load(fh)
    except json.JSONDecodeError:
        report = {}

if "feature_sets" not in report:
    pca_scaler = joblib.load(os.path.join(MODEL_DIR, "preprocess", "pca_scaler_motor.joblib"))
    modelB2 = joblib.load(os.path.join(MODEL_DIR, "models", "modelB2_reg_motor_plus_context.joblib"))
    prep = modelB2.named_steps["prep"]
    n_motor = pca_scaler.n_features_in_
    numeric_b2 = list(prep.transformers_[0][2])
    pca_motor = list(report.get("pca", {}).get("motor_feature_columns") or numeric_b2[:n_motor])
    ctx_num = list(report.get("modelB2_motor_plus_context", {}).get("context_numeric_columns") or numeric_b2[n_motor:])
    ctx_cat = list(report.get("modelB2_motor_plus_context", {}).get("context_categorical_columns") or prep.transformers_[1][2])
    report.setdefault("pca", {})
    report["pca"].setdefault("motor_feature_columns", pca_motor)
    report["pca"].setdefault("pc1_flipped", False)
    report.setdefault("modelB2_motor_plus_context", {})
    report["modelB2_motor_plus_context"].setdefault("context_numeric_columns", ctx_num)
    report["modelB2_motor_plus_context"].setdefault("context_categorical_columns", ctx_cat)
    report["feature_sets"] = {
        "pca_motor_columns": pca_motor,
        "b2_motor_columns": pca_motor,
        "runtime_motor_columns": pca_motor,
        "context_numeric_columns": ctx_num,
        "context_categorical_columns": ctx_cat,
    }
    with open(report_path, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2)
    print("Generated/repaired training_report.json feature_sets from model artifacts.")
else:
    print("training_report.json already has feature_sets.")
EOF

EXPOSE 4030

CMD uvicorn app:app --host 0.0.0.0 --port ${PORT:-4030}
