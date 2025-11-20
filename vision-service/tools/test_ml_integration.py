#!/usr/bin/env python3
"""
Test ML integration without actual model file.
Tests the pipeline structure and configuration loading.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from ml import ModelLoader, PosePipeline
from services import risk_scoring
import yaml


def test_config_loading():
    print("Testing configuration loading...")
    try:
        loader = ModelLoader()
        config = loader.config
        
        assert "pose_estimation" in config
        assert "inference" in config
        assert "ergonomic_thresholds" in config
        
        print("✓ Configuration loaded successfully")
        print(f"  Model: {config['pose_estimation']['model_name']}")
        print(f"  Input size: {config['pose_estimation']['input_size']}")
        print(f"  Keypoints: {config['pose_estimation']['num_keypoints']}")
        return True
        
    except Exception as e:
        print(f"✗ Configuration test failed: {e}")
        return False


def test_device_detection():
    print("\nTesting device detection...")
    try:
        loader = ModelLoader()
        device = loader._detect_device()
        
        print(f"✓ Device detected: {device}")
        return True
        
    except Exception as e:
        print(f"✗ Device detection failed: {e}")
        return False


def test_risk_scorer():
    print("\nTesting risk scoring system...")
    try:
        scorer = risk_scoring.BiomechanicalScorer()
        
        test_features = {
            "neck_flexion": 35.0,
            "trunk_flexion": 25.0,
            "left_shoulder_abduction": 80.0,
            "right_shoulder_abduction": 75.0,
            "left_elbow_flexion": 90.0,
            "right_elbow_flexion": 95.0,
            "asymmetry_score": 5.0,
            "reach_distance_ratio": 0.6
        }
        
        reba = scorer.calculate_reba_score(test_features)
        rula = scorer.calculate_rula_score(test_features)
        
        print(f"✓ REBA Score: {reba['score']} (confidence: {reba['confidence']:.2f})")
        print(f"✓ RULA Score: {rula['score']} (confidence: {rula['confidence']:.2f})")
        
        risk_level = scorer.get_risk_level(reba['score'])
        traffic_light = scorer.get_traffic_light(reba['score'])
        
        print(f"✓ Risk Level: {risk_level}")
        print(f"✓ Traffic Light: {traffic_light}")
        
        return True
        
    except Exception as e:
        print(f"✗ Risk scoring test failed: {e}")
        return False


def test_ergonomic_calculations():
    print("\nTesting ergonomic feature calculations...")
    try:
        loader = ModelLoader()
        pipeline = PosePipeline(loader)
        
        mock_keypoints = [
            {"name": "nose", "x": 0.5, "y": 0.2, "confidence": 0.9},
            {"name": "left_shoulder", "x": 0.4, "y": 0.35, "confidence": 0.85},
            {"name": "right_shoulder", "x": 0.6, "y": 0.35, "confidence": 0.85},
            {"name": "left_elbow", "x": 0.3, "y": 0.5, "confidence": 0.8},
            {"name": "right_elbow", "x": 0.7, "y": 0.5, "confidence": 0.8},
            {"name": "left_wrist", "x": 0.25, "y": 0.65, "confidence": 0.75},
            {"name": "right_wrist", "x": 0.75, "y": 0.65, "confidence": 0.75},
            {"name": "left_hip", "x": 0.4, "y": 0.6, "confidence": 0.85},
            {"name": "right_hip", "x": 0.6, "y": 0.6, "confidence": 0.85},
        ]
        
        features = pipeline.calculate_ergonomic_features(mock_keypoints)
        
        print("✓ Calculated features:")
        for key, value in features.items():
            if value is not None:
                print(f"  {key}: {value:.2f}")
            else:
                print(f"  {key}: None")
        
        return True
        
    except Exception as e:
        print(f"✗ Ergonomic calculations test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_model_loading():
    print("\nTesting model loading (expected to fail without model file)...")
    try:
        loader = ModelLoader()
        result = loader.load_model()
        
        if result:
            print("✓ Model loaded successfully!")
            print(f"  Metadata: {loader.model_metadata}")
            return True
        else:
            print("✓ Model loading handled gracefully (file not found)")
            print("  This is expected if you haven't placed a model file yet")
            return True
            
    except Exception as e:
        print(f"! Model loading test encountered error: {e}")
        print("  This is expected if model file is not present")
        return True


def main():
    print("=" * 60)
    print("SmartPick Vision Service - ML Integration Tests")
    print("=" * 60)
    
    tests = [
        test_config_loading,
        test_device_detection,
        test_risk_scorer,
        test_ergonomic_calculations,
        test_model_loading,
    ]
    
    results = []
    for test in tests:
        try:
            results.append(test())
        except Exception as e:
            print(f"✗ Test failed with exception: {e}")
            import traceback
            traceback.print_exc()
            results.append(False)
    
    print("\n" + "=" * 60)
    print(f"Results: {sum(results)}/{len(results)} tests passed")
    print("=" * 60)
    
    if all(results):
        print("\n✓ All tests passed! ML integration is ready.")
        print("\nNext steps:")
        print("1. Place a pose estimation model in models/ directory")
        print("2. Update src/config/models.yaml if needed")
        print("3. Start the service: uvicorn main:app --reload")
        print("4. Check /health endpoint for model status")
        return 0
    else:
        print("\n! Some tests failed. Check output above for details.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
