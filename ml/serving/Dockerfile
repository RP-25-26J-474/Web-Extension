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

# Copy the serving app and model registry into the container
COPY serving/ ./
COPY model_registry/ ../model_registry/

# ── Ensure model registry artifacts are usable ────────────────────────────────
# 1. Ensure impute_medians.json is valid (guards against empty file)
# 2. Generate training_report.json from model artifacts if it is missing
#    (training_report.json is produced by train_motor_model_v2.py but is not
#    committed to the repo; this step derives the same data at build time)
RUN python3 - <<'EOF'
import os, json, joblib

MODEL_DIR = "../model_registry/motor/1.0.0"

# --- Fix impute_medians.json if empty or invalid ---
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

# --- Generate training_report.json if missing ---
report_path = os.path.join(MODEL_DIR, "reports", "training_report.json")
if not os.path.exists(report_path):
    os.makedirs(os.path.join(MODEL_DIR, "reports"), exist_ok=True)
    pca_scaler = joblib.load(os.path.join(MODEL_DIR, "preprocess", "pca_scaler_motor.joblib"))
    modelB2    = joblib.load(os.path.join(MODEL_DIR, "models",   "modelB2_reg_motor_plus_context.joblib"))
    prep       = modelB2.named_steps["prep"]
    n_motor    = pca_scaler.n_features_in_
    numeric_b2 = list(prep.transformers_[0][2])  # motor_cols + ctx_num_cols (training order)
    report = {
        "pca": {
            "motor_feature_columns": numeric_b2[:n_motor],
            "pc1_flipped": False,
        },
        "modelB2_motor_plus_context": {
            "context_numeric_columns":     numeric_b2[n_motor:],
            "context_categorical_columns": list(prep.transformers_[1][2]),
        },
    }
    with open(report_path, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2)
    print("Generated training_report.json from model artifacts.")
else:
    print("training_report.json already present – skipping generation.")
EOF

EXPOSE 4030

CMD ["python", "app.py"]
