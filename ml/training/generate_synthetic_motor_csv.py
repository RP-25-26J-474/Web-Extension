import os
import argparse
import numpy as np
import pandas as pd

# --------------------------
# CSV Header (your exact schema)
# --------------------------

ROUND_METRICS = [
    "nTargets","nHits","nMisses","hitRate",
    "reactionTime_mean","reactionTime_std","reactionTime_median",
    "movementTime_mean","movementTime_std","movementTime_median",
    "interTap_mean","interTap_std","interTap_cv",
    "errorDist_mean","errorDist_std",
    "pathLength_mean","pathLength_std",
    "straightness_mean","straightness_std",
    "meanSpeed_mean","peakSpeed_mean","speedVar_mean",
    "meanAccel_mean","peakAccel_mean",
    "jerkRMS_mean","jerkRMS_std",
    "submovementCount_mean","submovementCount_std",
    "overshootCount_mean","overshootCount_std",
    "ID_mean","throughput_mean","throughput_std",
]

DELTA_COLS = [
    "delta_r2_minus_r1_hitRate","delta_r3_minus_r1_hitRate","delta_r3_minus_r2_hitRate",
    "delta_r2_minus_r1_reactionTime_mean","delta_r3_minus_r1_reactionTime_mean","delta_r3_minus_r2_reactionTime_mean",
    "delta_r2_minus_r1_movementTime_mean","delta_r3_minus_r1_movementTime_mean","delta_r3_minus_r2_movementTime_mean",
    "delta_r2_minus_r1_jerkRMS_mean","delta_r3_minus_r1_jerkRMS_mean","delta_r3_minus_r2_jerkRMS_mean",
    "delta_r2_minus_r1_throughput_mean","delta_r3_minus_r1_throughput_mean","delta_r3_minus_r2_throughput_mean",
]

def build_columns():
    cols = [
        "sessionId","participantId",
        "game_gameVersion",
        "r1_speedPxPerFrame","r2_speedPxPerFrame","r3_speedPxPerFrame",
        "r1_spawnIntervalMs","r2_spawnIntervalMs","r3_spawnIntervalMs",
        "device_pointerPrimary","device_os","device_browser",
        "screen_width","screen_height","screen_dpr",
        "viewportWidth","viewportHeight",
        "perf_samplingHzTarget","perf_samplingHzEstimated",
        "perf_avgFrameMs","perf_p95FrameMs","perf_droppedFrames","perf_inputLagMsEstimate",
        "highContrastMode","reducedMotionPreference",
        "userInfo_ageBucket","userInfo_gender",
    ]
    for r in [1,2,3]:
        for m in ROUND_METRICS:
            cols.append(f"r{r}_{m}")
    cols += DELTA_COLS
    return cols

def synthesize(n_participants=80, min_sessions=2, max_sessions=5, seed=42):
    rng = np.random.default_rng(seed)

    participant_ids = [f"P_{i:03d}" for i in range(1, n_participants+1)]
    # latent "ability": higher -> better interaction performance
    participant_ability = {pid: rng.normal(0, 1) for pid in participant_ids}

    # fixed round conditions for synthetic generation
    speed_px = {1: 2.5, 2: 3.5, 3: 4.8}            # px/frame
    spawn_ms = {1: 900, 2: 750, 3: 600}            # ms

    age_buckets = ["18-24","25-34","35-44","45-54","55-64","65+","unknown"]
    genders = ["Male","Female","Other","Prefer not to say"]
    pointer_primary = ["mouse","touch","pen","unknown"]
    oses = ["Windows","macOS","Linux","Android","iOS"]
    browsers = ["Chrome","Edge","Firefox","Safari"]

    rows = []
    session_counter = 1

    for pid in participant_ids:
        n_sess = int(rng.integers(min_sessions, max_sessions+1))
        base_z = participant_ability[pid]

        for _ in range(n_sess):
            z = base_z + rng.normal(0, 0.25)  # session-specific ability
            sid = f"S_{session_counter:05d}"
            session_counter += 1

            # device/perf context
            screen_w = int(rng.choice([1366, 1440, 1536, 1920, 2560]))
            screen_h = int(rng.choice([768, 900, 864, 1080, 1440]))
            dpr = float(rng.choice([1.0, 1.25, 1.5, 2.0]))
            viewport_w = int(screen_w * rng.uniform(0.6, 0.95))
            viewport_h = int(screen_h * rng.uniform(0.6, 0.95))

            sampling_target = 60
            sampling_est = float(max(20, min(60, rng.normal(55, 5))))
            dropped_frames = int(max(0, rng.normal(20, 15)))
            avg_frame = float(rng.normal(16.7 + dropped_frames*0.02, 2.0))
            p95_frame = float(avg_frame + abs(rng.normal(6, 3)))
            input_lag = float(max(5, rng.normal(18 + dropped_frames*0.1, 6)))

            high_contrast = int(rng.choice([0,1], p=[0.85,0.15]))
            reduced_motion = int(rng.choice([0,1], p=[0.75,0.25]))

            age_bucket = rng.choice(age_buckets, p=[0.18,0.22,0.18,0.15,0.12,0.10,0.05])
            gender = rng.choice(genders, p=[0.48,0.48,0.02,0.02])

            dev_pointer = rng.choice(pointer_primary, p=[0.7,0.2,0.05,0.05])
            dev_os = rng.choice(oses, p=[0.55,0.18,0.07,0.12,0.08])
            dev_browser = rng.choice(browsers, p=[0.55,0.18,0.15,0.12])

            # round stats
            rstats = {}
            for r in [1,2,3]:
                speed = speed_px[r]
                spwn = spawn_ms[r]

                # difficulty increases with speed and faster spawns
                difficulty = (speed / speed_px[1]) + (spawn_ms[1] / spwn - 1.0)

                nTargets = int(rng.integers(22, 32))

                base_hit = 0.86 + 0.08*np.tanh(z/1.2) - 0.07*(difficulty-1.0) - 0.01*(dropped_frames/50)
                hitRate = float(np.clip(base_hit + rng.normal(0, 0.03), 0.35, 0.98))
                nHits = int(round(hitRate * nTargets))
                nMisses = nTargets - nHits

                rt_mean = float(np.clip(420 - 60*z + 40*(difficulty-1.0) + rng.normal(0, 25), 180, 900))
                rt_std  = float(np.clip(90 - 10*z + 10*(difficulty-1.0) + rng.normal(0, 8), 30, 220))
                rt_med  = float(np.clip(rt_mean - rng.normal(0, 15), 160, 900))

                mt_mean = float(np.clip(360 - 45*z + 35*(difficulty-1.0) + rng.normal(0, 20), 160, 900))
                mt_std  = float(np.clip(85 - 8*z + 10*(difficulty-1.0) + rng.normal(0, 8), 25, 220))
                mt_med  = float(np.clip(mt_mean - rng.normal(0, 12), 150, 900))

                it_mean = float(np.clip(520 - 50*z + 40*(difficulty-1.0) + rng.normal(0, 35), 200, 1500))
                it_std  = float(np.clip(160 - 15*z + 20*(difficulty-1.0) + rng.normal(0, 15), 50, 450))
                it_cv   = float(np.clip(it_std / max(it_mean, 1e-6), 0.05, 0.9))

                err_mean = float(np.clip(0.18 - 0.03*z + 0.03*(difficulty-1.0) + rng.normal(0, 0.02), 0.03, 0.6))
                err_std  = float(np.clip(0.12 - 0.02*z + rng.normal(0, 0.02), 0.02, 0.4))

                path_mean = float(np.clip(0.42 - 0.04*z + 0.03*(difficulty-1.0) + rng.normal(0, 0.03), 0.15, 1.2))
                path_std  = float(np.clip(0.18 - 0.02*z + rng.normal(0, 0.02), 0.05, 0.6))
                straight_mean = float(np.clip(0.88 + 0.03*z - 0.04*(difficulty-1.0) + rng.normal(0, 0.02), 0.35, 0.99))
                straight_std  = float(np.clip(0.08 - 0.01*z + rng.normal(0, 0.01), 0.01, 0.25))

                meanSpeed = float(np.clip(0.70 + 0.08*z - 0.05*(difficulty-1.0) + rng.normal(0, 0.05), 0.2, 2.0))
                peakSpeed = float(np.clip(meanSpeed + abs(rng.normal(0.25, 0.12)), 0.3, 3.0))
                speedVar  = float(np.clip(0.12 - 0.02*z + 0.02*(difficulty-1.0) + rng.normal(0, 0.02), 0.02, 0.5))

                meanAccel = float(np.clip(0.95 + 0.10*z - 0.05*(difficulty-1.0) + rng.normal(0, 0.07), 0.2, 3.0))
                peakAccel = float(np.clip(meanAccel + abs(rng.normal(0.35, 0.15)), 0.3, 4.0))

                jerk_mean = float(np.clip(0.010 - 0.002*z + 0.002*(difficulty-1.0) + rng.normal(0, 0.0015), 0.002, 0.05))
                jerk_std  = float(np.clip(0.006 - 0.001*z + rng.normal(0, 0.001), 0.001, 0.03))

                sub_mean = float(np.clip(2.6 - 0.7*z + 0.4*(difficulty-1.0) + rng.normal(0, 0.4), 0.0, 12.0))
                sub_std  = float(np.clip(1.2 - 0.2*z + rng.normal(0, 0.2), 0.1, 6.0))
                over_mean = float(np.clip(1.8 - 0.5*z + 0.3*(difficulty-1.0) + rng.normal(0, 0.3), 0.0, 10.0))
                over_std  = float(np.clip(1.0 - 0.15*z + rng.normal(0, 0.2), 0.1, 5.0))

                ID_mean = float(np.clip(3.2 + 0.2*(difficulty-1.0) + rng.normal(0, 0.15), 1.5, 6.0))
                tp_mean = float(np.clip(4.2 + 0.8*np.tanh(z/1.0) - 0.6*(difficulty-1.0) + rng.normal(0, 0.35), 0.5, 10.0))
                tp_std  = float(np.clip(1.1 - 0.15*z + rng.normal(0, 0.15), 0.2, 3.0))

                rstats[r] = dict(
                    nTargets=nTargets, nHits=nHits, nMisses=nMisses, hitRate=hitRate,
                    reactionTime_mean=rt_mean, reactionTime_std=rt_std, reactionTime_median=rt_med,
                    movementTime_mean=mt_mean, movementTime_std=mt_std, movementTime_median=mt_med,
                    interTap_mean=it_mean, interTap_std=it_std, interTap_cv=it_cv,
                    errorDist_mean=err_mean, errorDist_std=err_std,
                    pathLength_mean=path_mean, pathLength_std=path_std,
                    straightness_mean=straight_mean, straightness_std=straight_std,
                    meanSpeed_mean=meanSpeed, peakSpeed_mean=peakSpeed, speedVar_mean=speedVar,
                    meanAccel_mean=meanAccel, peakAccel_mean=peakAccel,
                    jerkRMS_mean=jerk_mean, jerkRMS_std=jerk_std,
                    submovementCount_mean=sub_mean, submovementCount_std=sub_std,
                    overshootCount_mean=over_mean, overshootCount_std=over_std,
                    ID_mean=ID_mean, throughput_mean=tp_mean, throughput_std=tp_std
                )

            deltas = {
                "delta_r2_minus_r1_hitRate": rstats[2]["hitRate"] - rstats[1]["hitRate"],
                "delta_r3_minus_r1_hitRate": rstats[3]["hitRate"] - rstats[1]["hitRate"],
                "delta_r3_minus_r2_hitRate": rstats[3]["hitRate"] - rstats[2]["hitRate"],
                "delta_r2_minus_r1_reactionTime_mean": rstats[2]["reactionTime_mean"] - rstats[1]["reactionTime_mean"],
                "delta_r3_minus_r1_reactionTime_mean": rstats[3]["reactionTime_mean"] - rstats[1]["reactionTime_mean"],
                "delta_r3_minus_r2_reactionTime_mean": rstats[3]["reactionTime_mean"] - rstats[2]["reactionTime_mean"],
                "delta_r2_minus_r1_movementTime_mean": rstats[2]["movementTime_mean"] - rstats[1]["movementTime_mean"],
                "delta_r3_minus_r1_movementTime_mean": rstats[3]["movementTime_mean"] - rstats[1]["movementTime_mean"],
                "delta_r3_minus_r2_movementTime_mean": rstats[3]["movementTime_mean"] - rstats[2]["movementTime_mean"],
                "delta_r2_minus_r1_jerkRMS_mean": rstats[2]["jerkRMS_mean"] - rstats[1]["jerkRMS_mean"],
                "delta_r3_minus_r1_jerkRMS_mean": rstats[3]["jerkRMS_mean"] - rstats[1]["jerkRMS_mean"],
                "delta_r3_minus_r2_jerkRMS_mean": rstats[3]["jerkRMS_mean"] - rstats[2]["jerkRMS_mean"],
                "delta_r2_minus_r1_throughput_mean": rstats[2]["throughput_mean"] - rstats[1]["throughput_mean"],
                "delta_r3_minus_r1_throughput_mean": rstats[3]["throughput_mean"] - rstats[1]["throughput_mean"],
                "delta_r3_minus_r2_throughput_mean": rstats[3]["throughput_mean"] - rstats[2]["throughput_mean"],
            }

            row = {
                "sessionId": sid,
                "participantId": pid,
                "game_gameVersion": "1.0.0",

                "r1_speedPxPerFrame": speed_px[1],
                "r2_speedPxPerFrame": speed_px[2],
                "r3_speedPxPerFrame": speed_px[3],
                "r1_spawnIntervalMs": spawn_ms[1],
                "r2_spawnIntervalMs": spawn_ms[2],
                "r3_spawnIntervalMs": spawn_ms[3],

                "device_pointerPrimary": dev_pointer,
                "device_os": dev_os,
                "device_browser": dev_browser,
                "screen_width": screen_w,
                "screen_height": screen_h,
                "screen_dpr": dpr,
                "viewportWidth": viewport_w,
                "viewportHeight": viewport_h,
                "perf_samplingHzTarget": sampling_target,
                "perf_samplingHzEstimated": sampling_est,
                "perf_avgFrameMs": avg_frame,
                "perf_p95FrameMs": p95_frame,
                "perf_droppedFrames": dropped_frames,
                "perf_inputLagMsEstimate": input_lag,
                "highContrastMode": int(high_contrast),
                "reducedMotionPreference": int(reduced_motion),
                "userInfo_ageBucket": age_bucket,
                "userInfo_gender": gender,
            }

            for r in [1,2,3]:
                for m in ROUND_METRICS:
                    row[f"r{r}_{m}"] = rstats[r][m]

            row.update(deltas)
            rows.append(row)

    df = pd.DataFrame(rows, columns=build_columns())
    return df

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=r"..\datasets\final\motor_sessions.csv")
    ap.add_argument("--participants", type=int, default=80)
    ap.add_argument("--min_sessions", type=int, default=2)
    ap.add_argument("--max_sessions", type=int, default=5)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    df = synthesize(args.participants, args.min_sessions, args.max_sessions, args.seed)
    outpath = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(outpath), exist_ok=True)
    df.to_csv(outpath, index=False)
    print("Wrote synthetic dataset:", outpath)
    print("Shape:", df.shape)
    print(df.head(2).to_string(index=False))

if __name__ == "__main__":
    main()

