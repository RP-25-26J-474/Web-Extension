import argparse
import os
import json
import copy
import numpy as np
import pandas as pd

from sklearn.model_selection import GroupKFold
from sklearn.preprocessing import RobustScaler, OneHotEncoder
from sklearn.decomposition import PCA
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from xgboost import XGBRegressor
import joblib

# Dataset IDs
ID_COLS = ["sessionId", "userId"]

# These are "round conditions" (difficulty settings), NOT motor performance.
# Keep them in CSV for reproducibility, but exclude from motor PCA/labeling.
EXCLUDE_FROM_MOTOR = {
    "r1_speedPxPerFrame", "r2_speedPxPerFrame", "r3_speedPxPerFrame",
    "r1_spawnIntervalMs", "r2_spawnIntervalMs", "r3_spawnIntervalMs",
}

def infer_column_groups(df: pd.DataFrame):
    cols = [c for c in df.columns if c not in ID_COLS]

    motor_prefixes = ("r1_", "r2_", "r3_", "delta_")
    motor_cols_all = [c for c in cols if c.startswith(motor_prefixes)]

    motor_numeric = [
        c for c in motor_cols_all
        if pd.api.types.is_numeric_dtype(df[c]) and c not in EXCLUDE_FROM_MOTOR
    ]

    context_cols = [c for c in cols if c not in motor_numeric]
    context_numeric = [c for c in context_cols if pd.api.types.is_numeric_dtype(df[c])]
    context_categorical = [c for c in context_cols if not pd.api.types.is_numeric_dtype(df[c])]

    return motor_numeric, context_numeric, context_categorical

def percentile_rank(values: np.ndarray):
    """
    Percentile ranks in [0,1] using stable ranking.
    Lowest value -> 0, highest -> 1.
    """
    order = np.argsort(values)
    ranks = np.empty_like(order, dtype=float)
    ranks[order] = np.linspace(0.0, 1.0, num=len(values))
    return ranks

def ensure_pc1_direction(pc1: np.ndarray, df_motor: pd.DataFrame):
    """
    Align PC1 so that higher PC1 = better performance.

    We build a robust "better performance" anchor using multiple metrics:
      - Higher is better: hitRate, throughput_mean, straightness_mean
      - Lower is better: reactionTime_mean, movementTime_mean, errorDist_mean, jerkRMS_mean

    Then we flip PC1 if corr(PC1, anchor) < 0.

    Returns: (pc1_aligned, flipped, corr_with_anchor, anchor_debug)
    """
    higher_better_keys = ["hitRate", "throughput_mean", "straightness_mean"]
    lower_better_keys = ["reactionTime_mean", "movementTime_mean", "errorDist_mean", "jerkRMS_mean"]

    higher_cols = [c for c in df_motor.columns if any(k in c for k in higher_better_keys)]
    lower_cols  = [c for c in df_motor.columns if any(k in c for k in lower_better_keys)]

    if len(higher_cols) + len(lower_cols) == 0:
        return pc1, False, None, {"higher_cols": [], "lower_cols": []}

    def robust_z(x):
        x = np.asarray(x, dtype=float)
        med = np.nanmedian(x)
        iqr = np.nanpercentile(x, 75) - np.nanpercentile(x, 25)
        if not np.isfinite(iqr) or iqr == 0:
            sd = np.nanstd(x)
            iqr = sd if (np.isfinite(sd) and sd > 0) else 1.0
        return (x - med) / iqr

    anchor = np.zeros(len(df_motor), dtype=float)

    for c in higher_cols:
        anchor += robust_z(df_motor[c].values)

    for c in lower_cols:
        anchor -= robust_z(df_motor[c].values)

    r = np.corrcoef(pc1, anchor)[0, 1]
    flipped = False
    if np.isfinite(r) and r < 0:
        pc1 = -pc1
        flipped = True
        r = -r

    anchor_debug = {
        "higher_cols_used_count": int(len(higher_cols)),
        "lower_cols_used_count": int(len(lower_cols)),
        "higher_cols_example": higher_cols[:5],
        "lower_cols_example": lower_cols[:5],
    }

    return pc1, flipped, float(r), anchor_debug

def build_regressor(seed: int = 42):
    return XGBRegressor(
        n_estimators=500,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.9,
        colsample_bytree=0.9,
        reg_lambda=1.0,
        objective="reg:squarederror",
        random_state=seed,
        n_jobs=-1,
    )

def eval_regression_cv(model_pipeline, X, y, groups, folds=5):
    """
    GroupKFold CV evaluation for regression.
    Returns: (fold_stats, overall_stats, oof_predictions)
    """
    gkf = GroupKFold(n_splits=folds)
    preds = np.zeros(len(y), dtype=float)

    fold_stats = []
    for fold, (tr, te) in enumerate(gkf.split(X, y, groups=groups), start=1):
        Xtr, Xte = X.iloc[tr], X.iloc[te]
        ytr = y[tr]

        mdl = copy.deepcopy(model_pipeline)
        mdl.fit(Xtr, ytr)
        preds[te] = mdl.predict(Xte)

        mse = mean_squared_error(y[te], preds[te])
        rmse = float(np.sqrt(mse))
        mae = float(mean_absolute_error(y[te], preds[te]))
        r2 = float(r2_score(y[te], preds[te]))

        fold_stats.append({"fold": fold, "rmse": rmse, "mae": mae, "r2": r2})

    overall_mse = mean_squared_error(y, preds)
    overall = {
        "rmse": float(np.sqrt(overall_mse)),
        "mae": float(mean_absolute_error(y, preds)),
        "r2": float(r2_score(y, preds)),
        "preds_summary": {
            "min": float(np.min(preds)),
            "max": float(np.max(preds)),
            "mean": float(np.mean(preds)),
            "std": float(np.std(preds)),
        }
    }
    return fold_stats, overall, preds

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", required=True)
    ap.add_argument("--outdir", required=True)
    ap.add_argument("--folds", type=int, default=5)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    os.makedirs(args.outdir, exist_ok=True)
    os.makedirs(os.path.join(args.outdir, "models"), exist_ok=True)
    os.makedirs(os.path.join(args.outdir, "preprocess"), exist_ok=True)
    os.makedirs(os.path.join(args.outdir, "reports"), exist_ok=True)

    df = pd.read_csv(args.csv)

    # Basic schema checks
    for c in ID_COLS:
        if c not in df.columns:
            raise ValueError(f"Missing required ID column: {c}")

    motor_cols, ctx_num_cols, ctx_cat_cols = infer_column_groups(df)
    if len(motor_cols) < 10:
        raise ValueError("Not enough motor features found. Ensure r1_/r2_/r3_/delta_ motor metrics exist.")

    # Drop rows with too many missing motor features (quality gate)
    motor_df = df[motor_cols].copy()
    keep = (motor_df.isna().mean(axis=1) <= 0.25)
    df = df.loc[keep].reset_index(drop=True)

    # -------- FIX 1: median imputers learned from training data --------
    for c in motor_cols:
        if df[c].isna().any():
            df[c] = df[c].fillna(df[c].median())

    for c in ctx_num_cols:
        if df[c].isna().any():
            df[c] = df[c].fillna(df[c].median())

    for c in ctx_cat_cols:
        df[c] = df[c].astype(str).fillna("unknown").replace({"nan": "unknown", "None": "unknown"})

    # Save imputation medians (for inference-time preprocessing)
    motor_medians = {c: float(df[c].median()) for c in motor_cols}
    ctx_num_medians = {c: float(df[c].median()) for c in ctx_num_cols}
    with open(os.path.join(args.outdir, "preprocess", "impute_medians.json"), "w", encoding="utf-8") as f:
        json.dump({"motor": motor_medians, "context_numeric": ctx_num_medians}, f, indent=2)

    # GroupKFold groups
    groups = df["userId"].astype(str).values

    # ---------------------------
    # A) PCA latent axis -> impairment_score_A
    # ---------------------------
    pca_scaler = RobustScaler()
    X_motor_scaled = pca_scaler.fit_transform(df[motor_cols].values)

    pca = PCA(n_components=1, random_state=args.seed)
    pc1 = pca.fit_transform(X_motor_scaled).reshape(-1)

    # ✅ NEW: robust anchor-based alignment
    pc1, pc1_flipped, corr_anchor, anchor_debug = ensure_pc1_direction(pc1, df[motor_cols])

    # Impairment score definition:
    # PC1 aligned: higher = better performance
    # impairment_score_A = 1 - percentile_rank(PC1)
    pct = percentile_rank(pc1)
    impairment_score_A = np.clip(1.0 - pct, 0.0, 1.0)

    # Save distribution for percentile mapping at inference
    pc1_sorted = np.sort(pc1)

    # ---------------------------
    # B) Regression models: predict impairment_score_A
    # ---------------------------
    modelB1 = Pipeline(steps=[
        ("scaler", RobustScaler()),
        ("xgb", build_regressor(seed=args.seed)),
    ])

    numeric_B2 = motor_cols + ctx_num_cols
    categorical_B2 = ctx_cat_cols

    preprocessor_B2 = ColumnTransformer(
        transformers=[
            ("num", RobustScaler(), numeric_B2),
            ("cat", OneHotEncoder(handle_unknown="ignore"), categorical_B2),
        ],
        remainder="drop",
    )

    modelB2 = Pipeline(steps=[
        ("prep", preprocessor_B2),
        ("xgb", build_regressor(seed=args.seed)),
    ])

    foldB1, overallB1, predsB1 = eval_regression_cv(
        modelB1, df[motor_cols], impairment_score_A, groups, folds=args.folds
    )

    X_B2 = df[motor_cols + ctx_num_cols + ctx_cat_cols]
    foldB2, overallB2, predsB2 = eval_regression_cv(
        modelB2, X_B2, impairment_score_A, groups, folds=args.folds
    )

    # Fit final models on all data
    modelB1.fit(df[motor_cols], impairment_score_A)
    modelB2.fit(X_B2, impairment_score_A)

    # ---------------------------
    # Save artifacts
    # ---------------------------
    joblib.dump(pca_scaler, os.path.join(args.outdir, "preprocess", "pca_scaler_motor.joblib"))
    joblib.dump(pca, os.path.join(args.outdir, "preprocess", "pca_pc1_motor.joblib"))
    joblib.dump(pc1_sorted, os.path.join(args.outdir, "preprocess", "pc1_sorted.npy"))

    joblib.dump(modelB1, os.path.join(args.outdir, "models", "modelB1_reg_motor_only.joblib"))
    joblib.dump(modelB2, os.path.join(args.outdir, "models", "modelB2_reg_motor_plus_context.joblib"))

    # ---------------------------
    # ✅ NEW: research sanity checks on direction
    # ---------------------------
    sanity = {}

    # impairment should correlate positively with slower RT
    rt_cols = [c for c in motor_cols if "reactionTime_mean" in c]
    if rt_cols:
        sanity["corr_impairment_with_reactionTime_mean"] = float(
            np.corrcoef(impairment_score_A, df[rt_cols[0]].values)[0, 1]
        )

    # impairment should correlate negatively with hitRate
    hr_cols = [c for c in motor_cols if c.endswith("_hitRate")]
    if hr_cols:
        sanity["corr_impairment_with_hitRate"] = float(
            np.corrcoef(impairment_score_A, df[hr_cols[0]].values)[0, 1]
        )

    # ---------------------------
    # Training report (research documentation)
    # ---------------------------
    report = {
        "seed": args.seed,
        "pca": {
            "explained_variance_ratio_pc1": float(pca.explained_variance_ratio_[0]),
            "pc1_flipped": bool(pc1_flipped),
            "corr_pc1_with_anchor": corr_anchor,
            "anchor_debug": anchor_debug,
            "motor_feature_columns": motor_cols,
            "excluded_condition_columns": sorted(list(EXCLUDE_FROM_MOTOR)),
            "pc1_loadings": {c: float(w) for c, w in zip(motor_cols, pca.components_[0])},
        },
        "sanity_checks": sanity,
        "score_definition": {
            "name": "impairment_score",
            "range": [0.0, 1.0],
            "direction": "0=better performance, 1=more assistance needed",
            "A_method": "impairment_score_A = 1 - percentile_rank(PC1_aligned)",
            "B_method": "regression predicts impairment_score_A",
        },
        "preprocess": {
            "imputation": "median for numeric, 'unknown' for categorical",
            "impute_medians_file": "preprocess/impute_medians.json",
        },
        "modelB1_motor_only": {"cv_folds": foldB1, "overall": overallB1},
        "modelB2_motor_plus_context": {
            "context_numeric_columns": ctx_num_cols,
            "context_categorical_columns": ctx_cat_cols,
            "cv_folds": foldB2,
            "overall": overallB2
        }
    }

    with open(os.path.join(args.outdir, "reports", "training_report.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    # Save dataset with derived scores/preds (for analysis)
    df_out = df.copy()
    df_out["latent_pc1_motor"] = pc1
    df_out["impairment_score_A"] = impairment_score_A
    df_out["impairment_score_B1_pred"] = np.clip(predsB1, 0.0, 1.0)
    df_out["impairment_score_B2_pred"] = np.clip(predsB2, 0.0, 1.0)
    df_out.to_csv(os.path.join(args.outdir, "reports", "sessions_with_scores.csv"), index=False)

    print("Saved outputs to:", args.outdir)
    print("\nB1 (motor-only) overall:", overallB1)
    print("B2 (motor+context) overall:", overallB2)

    print("\nSanity checks:")
    for k, v in sanity.items():
        print(f"  {k}: {v:.4f}" if isinstance(v, float) else f"  {k}: {v}")

if __name__ == "__main__":
    main()