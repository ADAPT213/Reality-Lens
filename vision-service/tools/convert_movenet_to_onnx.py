#!/usr/bin/env python3
"""
Convert MoveNet from TensorFlow Hub to ONNX format.

Usage:
    pip install tensorflow tensorflow-hub tf2onnx
    python tools/convert_movenet_to_onnx.py
"""

import tensorflow as tf
import tensorflow_hub as hub
import tf2onnx
import numpy as np
from pathlib import Path


def convert_movenet_to_onnx(model_url: str, output_path: str):
    print(f"Loading MoveNet model from TensorFlow Hub...")
    print(f"URL: {model_url}")
    
    model = hub.load(model_url)
    movenet = model.signatures['serving_default']
    
    print(f"Model loaded successfully")
    print(f"Input shape: {movenet.inputs[0].shape}")
    print(f"Output shape: {movenet.outputs[0].shape}")
    
    input_shape = [1, 192, 192, 3]
    
    spec = (tf.TensorSpec(input_shape, tf.int32, name="input"),)
    
    print(f"Converting to ONNX format...")
    model_proto, _ = tf2onnx.convert.from_function(
        movenet,
        input_signature=spec,
        opset=13,
        output_path=output_path
    )
    
    print(f"✓ Model converted successfully!")
    print(f"✓ Saved to: {output_path}")
    
    output_size = Path(output_path).stat().st_size / (1024 * 1024)
    print(f"✓ Model size: {output_size:.2f} MB")
    
    print("\nTesting the ONNX model...")
    import onnxruntime as ort
    
    session = ort.InferenceSession(output_path)
    dummy_input = np.random.randint(0, 256, size=(1, 192, 192, 3), dtype=np.int32)
    
    output = session.run(None, {session.get_inputs()[0].name: dummy_input})
    print(f"✓ Test inference successful!")
    print(f"✓ Output shape: {output[0].shape}")
    
    print("\nModel ready to use!")
    print(f"Place it in: vision-service/models/movenet_lightning.onnx")


def main():
    movenet_url = "https://tfhub.dev/google/movenet/singlepose/lightning/4"
    
    output_dir = Path(__file__).parent.parent / "models"
    output_dir.mkdir(exist_ok=True)
    
    output_path = output_dir / "movenet_lightning.onnx"
    
    try:
        convert_movenet_to_onnx(movenet_url, str(output_path))
    except Exception as e:
        print(f"\n✗ Error during conversion: {e}")
        print("\nAlternative: Download a pre-converted model or use a different pose model")
        print("See models/README.md for more options")
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())
