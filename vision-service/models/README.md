# ML Models Directory

This directory contains the ONNX models for pose estimation and ergonomic analysis.

## Required Models

### Pose Estimation Model

Place a pose estimation ONNX model here named `movenet_lightning.onnx` (or update the path in `src/config/models.yaml`).

#### Recommended Models:

1. **MoveNet (Recommended for speed)**
   - Model: MoveNet Single Pose Lightning
   - Source: https://tfhub.dev/google/movenet/singlepose/lightning/4
   - Input: 192x192x3
   - Output: 17 keypoints (COCO format)
   - Performance: ~15ms on CPU, ~5ms on GPU

2. **RTMPose (Recommended for accuracy)**
   - Model: RTMPose-s or RTMPose-m
   - Source: https://github.com/open-mmlab/mmpose/tree/main/projects/rtmpose
   - Higher accuracy but slightly slower

3. **MediaPipe Pose**
   - Model: BlazePose
   - Source: https://github.com/google/mediapipe
   - Good balance of speed and accuracy

## How to Get MoveNet Model

### Option 1: Download Pre-converted ONNX (if available)

Search for "movenet onnx" on model repositories or convert yourself.

### Option 2: Convert from TensorFlow Hub

```bash
# Install dependencies
pip install tensorflow tensorflow-hub tf2onnx

# Python script to convert
python tools/convert_movenet_to_onnx.py
```

### Option 3: Use Alternative Models

You can use any pose estimation model that outputs COCO-format keypoints (17 points). Update `src/config/models.yaml` accordingly:

```yaml
pose_estimation:
  model_name: "your_model_name"
  path: "models/your_model.onnx"
  input_size: [height, width]
  num_keypoints: 17
```

## COCO Keypoint Format (17 keypoints)

0. nose
1. left_eye
2. right_eye
3. left_ear
4. right_ear
5. left_shoulder
6. right_shoulder
7. left_elbow
8. right_elbow
9. left_wrist
10. right_wrist
11. left_hip
12. right_hip
13. left_knee
14. right_knee
15. left_ankle
16. right_ankle

## Model Performance Testing

After placing your model, test it:

```bash
curl http://localhost:8002/health
```

You should see model metrics including:
- latency_p50_ms
- latency_p95_ms
- latency_p99_ms
- throughput_fps

## GPU Support

To use GPU acceleration:

1. Install ONNX Runtime with GPU support:
   ```bash
   pip uninstall onnxruntime
   pip install onnxruntime-gpu
   ```

2. Ensure CUDA is installed and configured

3. Update `src/config/models.yaml`:
   ```yaml
   inference:
     device: "gpu"  # or "auto" for automatic detection
   ```

## Troubleshooting

**Model not loading:**
- Check that the file exists in this directory
- Verify the path in `src/config/models.yaml`
- Check logs for detailed error messages

**Slow inference:**
- Try GPU if available
- Use a lighter model (MoveNet Lightning instead of Thunder)
- Adjust `num_threads` in config

**Low accuracy:**
- Ensure input images are well-lit
- Check that `confidence_threshold` is appropriate (default: 0.3)
- Try a more accurate model (RTMPose-m instead of RTMPose-s)
