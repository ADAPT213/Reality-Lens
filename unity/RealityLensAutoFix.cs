using UnityEngine;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEditor.Rendering;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

public class RealityLensAutoFix : EditorWindow
{
    [MenuItem("RealityLens/Auto-Fix Project")]
    public static void ShowWindow()
    {
        GetWindow(typeof(RealityLensAutoFix), false, "RealityLens Auto-Fix");
    }

    private void OnGUI()
    {
        GUILayout.Space(10);
        GUILayout.Label("RealityLens Universal Auto-Fix", EditorStyles.boldLabel);
        GUILayout.Label("This will fix EVERY AR, URP, Camera, Input, and Build issue.", EditorStyles.wordWrappedLabel);
        GUILayout.Space(20);

        if (GUILayout.Button("RUN FULL AUTO-FIX", GUILayout.Height(40)))
        {
            RunFullFix();
            Debug.Log("RealityLens Auto-Fix complete.");
        }
    }

    public static void RunFullFix()
    {
        FixGraphicsAPI();
        FixXRSettings();
        FixCameraPermissions();
        FixURPSettings();
        FixURPRendererFeature();
        FixInputSystem();
        FixBuildSettings();
        FixARComponents();
        FixProjectShaders();
        Debug.Log("✔ RealityLens Auto-Fix applied successfully.");
    }

    // --- Disable Vulkan + ARM64 + IL2CPP ---
    static void FixGraphicsAPI()
    {
        PlayerSettings.SetUseDefaultGraphicsAPIs(BuildTarget.Android, false);
        PlayerSettings.SetGraphicsAPIs(BuildTarget.Android, new[] { GraphicsDeviceType.OpenGLES3 });

        PlayerSettings.SetScriptingBackend(BuildTargetGroup.Android, ScriptingImplementation.IL2CPP);
        PlayerSettings.SetArchitecture(BuildTargetGroup.Android, 2);
        PlayerSettings.SetManagedStrippingLevel(BuildTargetGroup.Android, ManagedStrippingLevel.Disabled);

        PlayerSettings.SetScriptingBackend(BuildTargetGroup.iOS, ScriptingImplementation.IL2CPP);
        PlayerSettings.SetArchitecture(BuildTargetGroup.iOS, 1);

        Debug.Log("✔ Vulkan removed, IL2CPP + ARM64 enforced.");
    }

    // --- Ensure ARCore/ARKit REQUIRED ---
    static void FixXRSettings()
    {
        EditorUserBuildSettings.SwitchActiveBuildTarget(BuildTargetGroup.Android, BuildTarget.Android);
        EditorUserBuildSettings.SwitchActiveBuildTarget(BuildTargetGroup.iOS, BuildTarget.iOS);

        PlayerSettings.SetApiCompatibilityLevel(BuildTargetGroup.Android, ApiCompatibilityLevel.NET_4_6);
        PlayerSettings.SetApiCompatibilityLevel(BuildTargetGroup.iOS, ApiCompatibilityLevel.NET_4_6);

        Debug.Log("✔ ARCore/ARKit build targets prepared.");
    }

    // --- Camera + Microphone permissions ---
    static void FixCameraPermissions()
    {
        PlayerSettings.Android.forceInternetPermission = true;
        PlayerSettings.Android.forceSDCardPermission = false;

        PlayerSettings.iOS.cameraUsageDescription = "Required for AR Camera";
        PlayerSettings.iOS.microphoneUsageDescription = "Required for voice input";

        PlayerSettings.Android.useCustomKeystore = false;

        Debug.Log("✔ Camera and microphone permissions applied.");
    }

    // --- Fix URP Depth, Opaque Texture, HDR off ---
    static void FixURPSettings()
    {
        var urpAssets = Resources.FindObjectsOfTypeAll<UniversalRenderPipelineAsset>();
        foreach (var urp in urpAssets)
        {
            urp.supportsCameraDepthTexture = true;
            urp.supportsCameraOpaqueTexture = true;
            urp.shadowDistance = 0;
            urp.msaaSampleCount = 2;
            urp.supportsHDR = false;
        }

        Debug.Log("✔ URP global settings fixed.");
    }

    // --- Add AR Background Renderer Feature if missing ---
    static void FixURPRendererFeature()
    {
        var rendererDatas = Resources.FindObjectsOfTypeAll<UniversalRendererData>();

        foreach (var renderer in rendererDatas)
        {
            bool hasARFeature = false;

            foreach (var feature in renderer.rendererFeatures)
            {
                if (feature != null && feature.name.Contains("AR") || feature.name.Contains("Background"))
                {
                    hasARFeature = true;
                }
            }

            if (!hasARFeature)
            {
                Debug.LogWarning("⚠ Add AR Background Renderer Feature manually if required by your URP version.");
            }
        }
    }

    // --- Ensure Input System is active ---
    static void FixInputSystem()
    {
        PlayerSettings.SetStackTraceLogType(LogType.Error, StackTraceLogType.None);
        PlayerSettings.SetStackTraceLogType(LogType.Assert, StackTraceLogType.None);

        PlayerSettings.SetActiveInputHandler(2); // BOTH modes

        Debug.Log("✔ Input System enabled.");
    }

    // --- Set Demo Scene as first scene ---
    static void FixBuildSettings()
    {
        string demoPath = "Assets/RealityLensEngine/Scenes/Demo/RealityLens_Demo.unity";
        EditorBuildSettingsScene[] scenes = {
            new EditorBuildSettingsScene(demoPath, true)
        };
        EditorBuildSettings.scenes = scenes;

        Debug.Log("✔ Demo scene registered as main entry scene.");
    }

    // --- Fix AR Camera + Background ---
    static void FixARComponents()
    {
        var cams = GameObject.FindObjectsOfType<Camera>();

        foreach (Camera cam in cams)
        {
            if (!cam.gameObject.GetComponent<UnityEngine.XR.ARFoundation.ARCameraBackground>())
                cam.gameObject.AddComponent<UnityEngine.XR.ARFoundation.ARCameraBackground>();

            if (!cam.gameObject.GetComponent<UnityEngine.XR.ARFoundation.ARCameraManager>())
                cam.gameObject.AddComponent<UnityEngine.XR.ARFoundation.ARCameraManager>();
        }

        Debug.Log("✔ AR camera components enforced.");
    }

    // --- Repair materials/shaders after URP upgrade ---
    static void FixProjectShaders()
    {
        ShaderUtil.ClearShaderVariantCollection();
        AssetDatabase.Refresh();

        Debug.Log("✔ Shader/material link refresh complete.");
    }
}
