/**
 * Photo Analyzer - OpenAI Vision Integration
 * Analyzes warehouse photos to extract SKUs, locations, compliance issues
 */

const OpenAI = require('openai').default;

class PhotoAnalyzer {
  constructor(apiKey) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Analyze warehouse photo using OpenAI Vision
   * @param {string} imageBase64 - Base64 encoded image
   * @param {string} analysisType - Type of analysis: 'sku', 'layout', 'compliance', 'safety'
   * @returns {Promise<Object>} - Analysis results
   */
  async analyzePhoto(imageBase64, analysisType = 'general') {
    const prompts = {
      sku: `Analyze this warehouse image and identify:
1. All visible SKU labels and product identifiers
2. Bin/shelf location codes
3. Product placement quality (straight, organized, etc.)
4. Any mislabeled or missing labels
Format response as JSON with: skus[], locations[], issues[], confidence_score`,

      layout: `Analyze this warehouse layout image and identify:
1. Aisle configuration and numbering
2. Rack/shelf types and heights
3. Available space and congestion
4. Traffic flow patterns
Format response as JSON with: aisles[], racks[], dimensions, congestion_score`,

      compliance: `Analyze this warehouse image for compliance issues:
1. Safety violations (blocked aisles, obstructions)
2. Label compliance (missing, damaged, incorrect)
3. Stacking violations (height, weight, stability)
4. Emergency exit accessibility
Format response as JSON with: violations[], severity_levels[], recommendations[]`,

      safety: `Analyze this warehouse image for safety hazards:
1. Ergonomic risks (high reach, ground-level heavy items)
2. Trip/fall hazards
3. Equipment positioning issues
4. Worker safety concerns
Format response as JSON with: hazards[], risk_scores[], immediate_actions[]`,

      general: `Analyze this warehouse image comprehensively:
1. What products/SKUs are visible
2. Where they are located (aisle, bin, shelf)
3. Any issues with placement or organization
4. Safety or compliance concerns
5. Recommendations for improvement
Provide detailed, actionable insights.`,
    };

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompts[analysisType] || prompts.general },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
        temperature: 0.2,
      });

      const analysis = response.choices[0]?.message?.content || '';

      // Try to parse as JSON if structured response
      let parsedResult;
      try {
        parsedResult = JSON.parse(analysis);
      } catch {
        parsedResult = { raw_analysis: analysis };
      }

      return {
        success: true,
        analysis_type: analysisType,
        result: parsedResult,
        raw_text: analysis,
        timestamp: new Date().toISOString(),
        model: 'gpt-4o-mini',
      };
    } catch (error) {
      console.error('[PhotoAnalyzer] Vision API error:', error.message);

      // Fallback analysis
      return {
        success: false,
        analysis_type: analysisType,
        result: this._generateFallbackAnalysis(analysisType),
        error: error.message,
        timestamp: new Date().toISOString(),
        model: 'fallback',
      };
    }
  }

  /**
   * Batch analyze multiple photos
   */
  async analyzeMultiplePhotos(images, analysisType = 'general') {
    const results = [];

    for (let i = 0; i < images.length; i++) {
      console.log(`[PhotoAnalyzer] Processing image ${i + 1}/${images.length}`);
      const result = await this.analyzePhoto(images[i].base64, analysisType);
      results.push({
        image_id: images[i].id || `image_${i}`,
        ...result,
      });

      // Rate limiting - wait 1 second between requests
      if (i < images.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return {
      total_images: images.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }

  /**
   * Compare before/after photos to detect changes
   */
  async comparePhotos(beforeBase64, afterBase64) {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Compare these two warehouse photos (before and after) and identify:
1. What changed (moved items, new products, removed items)
2. Improvements or degradations in organization
3. New safety issues or resolved issues
4. Overall impact assessment
Format as JSON with: changes[], improvements[], concerns[], overall_score`,
              },
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${beforeBase64}` },
              },
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${afterBase64}` },
              },
            ],
          },
        ],
        max_tokens: 800,
        temperature: 0.2,
      });

      const comparison = response.choices[0]?.message?.content || '';

      let parsedResult;
      try {
        parsedResult = JSON.parse(comparison);
      } catch {
        parsedResult = { raw_comparison: comparison };
      }

      return {
        success: true,
        result: parsedResult,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        result: {
          changes: ['Unable to analyze - using fallback'],
          improvements: [],
          concerns: ['Vision API unavailable'],
          overall_score: 0,
        },
      };
    }
  }

  /**
   * Generate fallback analysis when API unavailable
   */
  _generateFallbackAnalysis(analysisType) {
    const fallbacks = {
      sku: {
        skus: ['SKU-UNKNOWN-001', 'SKU-UNKNOWN-002'],
        locations: ['Location analysis unavailable'],
        issues: ['Vision API unavailable - manual verification recommended'],
        confidence_score: 0,
      },
      layout: {
        aisles: ['Aisle detection unavailable'],
        racks: ['Rack analysis unavailable'],
        dimensions: { width: 0, height: 0, depth: 0 },
        congestion_score: 0,
      },
      compliance: {
        violations: ['Unable to detect - manual inspection required'],
        severity_levels: ['unknown'],
        recommendations: ['Perform manual compliance audit'],
      },
      safety: {
        hazards: ['Vision analysis unavailable'],
        risk_scores: [0],
        immediate_actions: ['Conduct manual safety inspection'],
      },
      general: {
        summary:
          'Vision API unavailable. Upload successful but automated analysis could not be performed. Please review image manually or try again later.',
        recommendations: ['Manual review required', 'Check Vision API connection'],
      },
    };

    return fallbacks[analysisType] || fallbacks.general;
  }

  /**
   * Extract structured data from vision analysis
   */
  extractStructuredData(visionResult) {
    if (!visionResult.success) {
      return { skus: [], locations: [], issues: [] };
    }

    const result = visionResult.result;

    return {
      skus: result.skus || [],
      locations: result.locations || result.aisles || [],
      issues: result.issues || result.violations || result.hazards || [],
      confidence: result.confidence_score || result.overall_score || 0,
      recommendations: result.recommendations || result.immediate_actions || [],
    };
  }
}

module.exports = PhotoAnalyzer;
