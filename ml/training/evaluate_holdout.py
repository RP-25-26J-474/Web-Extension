import argparse
import os
import json
import copy
import numpy as np
import pandas as pd

from sklearn.preprocessing import RobustScaler, OneHotEncoder
from sklearn.decomposition import PCA
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split

from xgboost import XGBRegressor


ID_COLS = ["sessionId", "userId"]

EXCLUDE_FROM_MOTOR = {
    "r1_speedPxPerFrame", "r2_speedPxPerFrame", "r3_speedPxPerFrame",
    "r1_spawnIntervalMs", "r2_spawnIntervalMs", "r3_spawnIntervalMs",
}

# ----------------------------
# Helpers (same ideas as training)
# ----------------------------
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


def robust_z(x: np.ndarray):
    x = np.asarray(x, dtype=float)
    med = np.nanmedian(x)
    iqr = np.nanpercentile(x, 75) - np.nanpercentile(x, 25)
    if not np.isfinite(iqr) or iqr == 0:
        sd = np.nanstd(x)
        iqr = sd if (np.isfinite(sd) and sd > 0) else 1.0
    return (x - med) / iqr


def ensure_pc1_direction(pc1: np.ndarray, df_motor: pd.DataFrame):
    """
    Align PC1 so that higher PC1 = better performance using an anchor signal.
    """
    higher_better_keys = ["hitRate", "throughput_mean", "straightness_mean"]
    lower_better_keys = ["reactionTime_mean", "movementTime_mean", "errorDist_mean", "jerkRMS_mean"]

    higher_cols = [c for c in df_motor.columns if any(k in c for k in higher_better_keys)]
    lower_cols  = [c for c in df_motor.columns if any(k in c for k in lower_better_keys)]

    if len(higher_cols) + len(lower_cols) == 0:
        return pc1, False, None

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
    return pc1, flipped, float(r)


def percentile_from_sorted(sorted_vals: np.ndarray, x: np.ndarray) -> np.ndarray:
    """
    Percentile in [0,1] using train distribution.
    """
    idx = np.searchsorted(sorted_vals, x, side="left")
    if len(sorted_vals) <= 1:
        return np.full_like(x, 0.5, dtype=float)
    return idx / (len(sorted_vals) - 1)


def clamp01(arr: np.ndarray) -> np.ndarray:
    return np.clip(arr, 0.0, 1.0)


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


def spearman_rho(x: np.ndarray, y: np.ndarray) -> float:
    # simple Spearman: rank correlation
    rx = pd.Series(x).rank().values
    ry = pd.Series(y).rank().values
    r = np.corrcoef(rx, ry)[0, 1]
    return float(r)


def bootstrap_ci(y_true, y_pred, metric_fn, n=2000, seed=42):
    rng = np.random.default_rng(seed)
    N = len(y_true)
    stats = []
    for _ in range(n):
        idx = rng.integers(0, N, size=N)
        stats.append(metric_fn(y_true[idx], y_pred[idx]))
    stats = np.asarray(stats, dtype=float)
    return {
        "mean": float(np.mean(stats)),
        "ci95_low": float(np.percentile(stats, 2.5)),
        "ci95_high": float(np.percentile(stats, 97.5)),
    }


# ----------------------------
# Main evaluation
# ----------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", required=True, help="Path to motor_sessions.csv")
    ap.add_argument("--outdir", required=True, help="Model output folder (e.g., ..\\model_registry\\motor\\1.0.0)")
    ap.add_argument("--test_frac", type=float, default=0.2, help="Fraction of users in holdout test set")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--bootstrap", type=int, default=2000, help="Bootstrap samples for CI")
    ap.add_argument("--external_label", default=None,
                    help="Optional: column name for external supervised label (e.g., bbt_score or self_report_severity)")
    args = ap.parse_args()

    os.makedirs(os.path.join(args.outdir, "reports"), exist_ok=True)

    df = pd.read_csv(args.csv)

    for c in ID_COLS:
        if c not in df.columns:
            raise ValueError(f"Missing required ID column: {c}")

    motor_cols, ctx_num_cols, ctx_cat_cols = infer_column_groups(df)
    if len(motor_cols) < 10:
        raise ValueError("Not enough motor features found (r1_/r2_/r3_/delta_).")

    # Quality gate: remove rows with too much missing motor data
    motor_df_all = df[motor_cols].copy()
    keep = (motor_df_all.isna().mean(axis=1) <= 0.25)
    df = df.loc[keep].reset_index(drop=True)

    # Split users into train/test (holdout)
    users = df["userId"].astype(str).unique()
    train_users, test_users = train_test_split(
        users, test_size=args.test_frac, random_state=args.seed, shuffle=True
    )

    df_train = df[df["userId"].astype(str).isin(train_users)].reset_index(drop=True)
    df_test  = df[df["userId"].astype(str).isin(test_users)].reset_index(drop=True)

    # ---------------------------
    # FIX 1: median imputation learned on TRAIN ONLY
    # ---------------------------
    # numeric
    motor_medians = {c: float(df_train[c].median()) for c in motor_cols}
    ctx_num_medians = {c: float(df_train[c].median()) for c in ctx_num_cols}

    for c in motor_cols:
        df_train[c] = df_train[c].fillna(motor_medians[c])
        df_test[c]  = df_test[c].fillna(motor_medians[c])

    for c in ctx_num_cols:
        df_train[c] = df_train[c].fillna(ctx_num_medians[c])
        df_test[c]  = df_test[c].fillna(ctx_num_medians[c])

    # categorical
    for c in ctx_cat_cols:
        df_train[c] = df_train[c].astype(str).fillna("unknown").replace({"nan":"unknown","None":"unknown"})
        df_test[c]  = df_test[c].astype(str).fillna("unknown").replace({"nan":"unknown","None":"unknown"})

    # ---------------------------
    # Target definition
    # ---------------------------
    if args.external_label is not None:
        if args.external_label not in df.columns:
            raise ValueError(f"--external_label column not found: {args.external_label}")

        # External label path (strongest for papers)
        y_train = df_train[args.external_label].astype(float).values
        y_test  = df_test[args.external_label].astype(float).values
        target_name = args.external_label

        # For external labels, we do NOT need PCA label.
        pc1_train = None
        pc1_test = None
        impairment_A_train = None
        impairment_A_test = None

    else:
        # Internal functional label path: PCA -> impairment_score_A
        pca_scaler = RobustScaler()
        X_motor_train_scaled = pca_scaler.fit_transform(df_train[motor_cols].values)

        pca = PCA(n_components=1, random_state=args.seed)
        pc1_train = pca.fit_transform(X_motor_train_scaled).reshape(-1)

        # Align direction using train-only anchor
        pc1_train, pc1_flipped, corr_anchor = ensure_pc1_direction(pc1_train, df_train[motor_cols])

        # Train distribution for percentile mapping
        pc1_sorted = np.sort(pc1_train)

        # Train impairment score
        pct_train = np.linspace(0.0, 1.0, num=len(pc1_train))
        # (Percentile rank stable)
        order = np.argsort(pc1_train)
        pct_train_stable = np.empty_like(order, dtype=float)
        pct_train_stable[order] = pct_train
        impairment_A_train = clamp01(1.0 - pct_train_stable)

        # Test: compute pc1 using train scaler+pca; flip if needed; map via train distribution
        X_motor_test_scaled = pca_scaler.transform(df_test[motor_cols].values)
        pc1_test = pca.transform(X_motor_test_scaled).reshape(-1)
        if pc1_flipped:
            pc1_test = -pc1_test

        pct_test = percentile_from_sorted(pc1_sorted, pc1_test)
        impairment_A_test = clamp01(1.0 - pct_test)

        y_train = impairment_A_train
        y_test  = impairment_A_test
        target_name = "impairment_score_A (PCA-derived)"

    # ---------------------------
    # Train supervised model B2 on TRAIN ONLY
    # ---------------------------
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

    X_train_B2 = df_train[motor_cols + ctx_num_cols + ctx_cat_cols]
    X_test_B2  = df_test[motor_cols + ctx_num_cols + ctx_cat_cols]

    modelB2.fit(X_train_B2, y_train)
    pred_test = modelB2.predict(X_test_B2)

    # If target is impairment score 0..1, clamp for interpretability
    if args.external_label is None:
        pred_test = clamp01(pred_test)

    # ---------------------------
    # Metrics on HOLDOUT TEST
    # ---------------------------
    mse = mean_squared_error(y_test, pred_test)
    rmse = float(np.sqrt(mse))
    mae = float(mean_absolute_error(y_test, pred_test))
    r2 = float(r2_score(y_test, pred_test))
    rho = spearman_rho(y_test, pred_test)

    # Bootstrap CIs (paper-ready)
    ci_mae = bootstrap_ci(y_test, pred_test, lambda a,b: float(mean_absolute_error(a,b)), n=args.bootstrap, seed=args.seed)
    ci_rmse = bootstrap_ci(y_test, pred_test, lambda a,b: float(np.sqrt(mean_squared_error(a,b))), n=args.bootstrap, seed=args.seed)
    ci_r2 = bootstrap_ci(y_test, pred_test, lambda a,b: float(r2_score(a,b)), n=args.bootstrap, seed=args.seed)
    ci_rho = bootstrap_ci(y_test, pred_test, lambda a,b: float(spearman_rho(a,b)), n=args.bootstrap, seed=args.seed)

    # Save split for reproducibility
    split = {
        "seed": args.seed,
        "test_frac": args.test_frac,
        "train_users_count": int(len(train_users)),
        "test_users_count": int(len(test_users)),
        "train_users": [str(u) for u in train_users],
        "test_users": [str(u) for u in test_users],
    }
    split_path = os.path.join(args.outdir, "reports", "holdout_split_users.json")
    with open(split_path, "w", encoding="utf-8") as f:
        json.dump(split, f, indent=2)

    # Save predictions CSV
    out_pred = df_test[["sessionId","userId"]].copy()
    out_pred["y_true"] = y_test
    out_pred["y_pred"] = pred_test
    out_pred.to_csv(os.path.join(args.outdir, "reports", "holdout_predictions.csv"), index=False)

    report = {
        "target": target_name,
        "holdout": {
            "n_test_rows": int(len(df_test)),
            "n_test_users": int(len(test_users)),
        },
        "metrics": {
            "mae": mae,
            "rmse": rmse,
            "r2": r2,
            "spearman_rho": rho,
            "bootstrap_ci": {
                "mae": ci_mae,
                "rmse": ci_rmse,
                "r2": ci_r2,
                "spearman_rho": ci_rho,
            }
        },
        "notes": [
            "Holdout split is user-level (no leakage across userId).",
            "If target is PCA-derived impairment_score_A, results reflect agreement with that functional index.",
            "For strongest scientific validity, use --external_label and report correlation with standardized assessments."
        ]
    }

    report_path = os.path.join(args.outdir, "reports", "holdout_report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print("✅ Holdout evaluation complete")
    print("Target:", target_name)
    print("Holdout users:", len(test_users), "Rows:", len(df_test))
    print("MAE:", mae, "RMSE:", rmse, "R2:", r2, "Spearman rho:", rho)
    print("Saved:")
    print("-", split_path)
    print("-", report_path)
    print("-", os.path.join(args.outdir, "reports", "holdout_predictions.csv"))


if __name__ == "__main__":
    main()
