/**
 * Reasoning Engine - AI-powered explanations and decision support
 * Provides human-readable explanations for all warehouse recommendations
 */

const OpenAI = require('openai');

class ReasoningEngine {
  constructor(apiKey) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Generate comprehensive explanation for optimization plan
   */
  async explainOptimization(optimizationPlan, warehouseModel) {
    const state = warehouseModel.getState();
    const summary = warehouseModel.getSummary();

    const prompt = `You are a warehouse optimization expert. Analyze this optimization plan and provide clear explanations.

WAREHOUSE STATE:
- Total Locations: ${state.locations.length}
- Occupied: ${state.locations.filter((l) => l.occupied).length}
- Utilization: ${summary.utilization_rate}%
- High Risk Products: ${summary.metrics.high_risk_products}
- Overall Health: ${summary.overall_health_score}/100

OPTIMIZATION PLAN:
- Total Moves: ${optimizationPlan.total_moves}
- Ergonomic Moves: ${optimizationPlan.moves.filter((m) => m.category === 'ergonomic').length}
- Slotting Moves: ${optimizationPlan.moves.filter((m) => m.category === 'slotting').length}
- Congestion Moves: ${optimizationPlan.moves.filter((m) => m.category === 'congestion').length}

TOP MOVES:
${optimizationPlan.moves
  .slice(0, 5)
  .map((m) => `- ${m.sku}: ${m.reason} (${m.priority} priority)`)
  .join('\n')}

Provide:
1. Executive Summary (2-3 sentences)
2. Why These Changes Matter (business impact)
3. Implementation Approach (practical steps)
4. Expected Outcomes (specific metrics)

Keep language clear and business-focused.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are a warehouse operations consultant providing clear, actionable explanations.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 800,
      });

      return {
        explanation: response.choices[0].message.content,
        generated_at: new Date().toISOString(),
        confidence: 'high',
      };
    } catch (error) {
      console.error('OpenAI reasoning error:', error.message);
      return this._generateFallbackExplanation(optimizationPlan, summary);
    }
  }

  /**
   * Explain individual move recommendation
   */
  async explainMove(move, warehouseModel) {
    const product = warehouseModel.getProduct(move.sku);
    const currentLoc = warehouseModel.getLocation(move.current_location);
    const recommendedLoc = warehouseModel.getLocation(move.recommended_location);

    const prompt = `Explain why we recommend moving this product:

PRODUCT: ${product.description} (SKU: ${product.sku})
- Weight: ${product.weight_lbs} lbs
- Pick Frequency: ${product.pick_frequency}/day
- Current: ${move.current_location} (${currentLoc?.height_inches}" height, ${currentLoc?.zone})
- Recommended: ${move.recommended_location} (${recommendedLoc?.height_inches}" height, ${recommendedLoc?.zone})

REASON: ${move.reason}
CATEGORY: ${move.category}
PRIORITY: ${move.priority}

Provide a 2-3 sentence explanation that:
1. Explains the problem with current location
2. Explains why new location is better
3. Quantifies the benefit

Use simple language a warehouse worker would understand.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are a helpful warehouse assistant explaining why products should be moved.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.6,
        max_tokens: 200,
      });

      return {
        move_id: `${move.sku}_${Date.now()}`,
        sku: move.sku,
        explanation: response.choices[0].message.content,
        technical_reason: move.reason,
        category: move.category,
        priority: move.priority,
        generated_at: new Date().toISOString(),
      };
    } catch (error) {
      console.error('OpenAI move explanation error:', error.message);
      return {
        move_id: `${move.sku}_${Date.now()}`,
        sku: move.sku,
        explanation: move.expected_benefit || move.reason,
        technical_reason: move.reason,
        category: move.category,
        priority: move.priority,
        generated_at: new Date().toISOString(),
      };
    }
  }

  /**
   * Generate "what-if" scenario analysis
   */
  async analyzeWhatIf(scenario, warehouseModel) {
    const summary = warehouseModel.getSummary();

    const prompt = `Analyze this warehouse "what-if" scenario:

CURRENT STATE:
- Utilization: ${summary.utilization_rate}%
- Health Score: ${summary.overall_health_score}/100
- High Risk Products: ${summary.metrics.high_risk_products}

SCENARIO: ${scenario.description}
${scenario.changes ? `PROPOSED CHANGES:\n${scenario.changes.map((c) => `- ${c}`).join('\n')}` : ''}

Provide:
1. Likely Impact (positive/negative effects)
2. Risks & Considerations (what could go wrong)
3. Recommendation (proceed/modify/reject with reasoning)

Keep response concise (4-5 sentences).`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a warehouse analyst evaluating operational scenarios.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 400,
      });

      return {
        scenario: scenario.description,
        analysis: response.choices[0].message.content,
        confidence: 'medium',
        generated_at: new Date().toISOString(),
      };
    } catch (error) {
      console.error('OpenAI what-if error:', error.message);
      return {
        scenario: scenario.description,
        analysis:
          'Scenario analysis temporarily unavailable. Please review proposed changes manually.',
        confidence: 'low',
        generated_at: new Date().toISOString(),
      };
    }
  }

  /**
   * Generate comparison between current and optimized state
   */
  async compareStates(currentMetrics, optimizedMetrics) {
    const prompt = `Compare these warehouse states:

CURRENT STATE:
- Utilization: ${currentMetrics.utilization_rate}%
- Health Score: ${currentMetrics.overall_health_score}/100
- High Risk Products: ${currentMetrics.high_risk_products}
- Avg Pick Frequency: ${currentMetrics.avg_pick_frequency}/day

OPTIMIZED STATE (PROJECTED):
- Utilization: ${optimizedMetrics.utilization_rate}%
- Health Score: ${optimizedMetrics.overall_health_score}/100
- High Risk Products: ${optimizedMetrics.high_risk_products}
- Avg Pick Frequency: ${optimizedMetrics.avg_pick_frequency}/day

Provide a 3-4 sentence summary:
1. Key improvements
2. Most significant change
3. Business impact

Focus on tangible benefits.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a warehouse analyst comparing operational states.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.6,
        max_tokens: 300,
      });

      return {
        comparison: response.choices[0].message.content,
        improvement_score: this._calculateImprovementScore(currentMetrics, optimizedMetrics),
        generated_at: new Date().toISOString(),
      };
    } catch (error) {
      console.error('OpenAI comparison error:', error.message);
      return {
        comparison: this._generateFallbackComparison(currentMetrics, optimizedMetrics),
        improvement_score: this._calculateImprovementScore(currentMetrics, optimizedMetrics),
        generated_at: new Date().toISOString(),
      };
    }
  }

  /**
   * Explain warehouse health score
   */
  async explainHealthScore(summary) {
    const prompt = `Explain this warehouse health score:

OVERALL HEALTH: ${summary.overall_health_score}/100

FACTORS:
- Utilization: ${summary.utilization_rate}%
- High Risk Products: ${summary.metrics.high_risk_products}
- Congestion Score: ${summary.metrics.congestion_score}/100
- Ergonomic Risk: ${summary.metrics.ergonomic_risk_score}/100

In 2-3 sentences:
1. What this score means
2. Primary factor affecting the score
3. One actionable improvement

Use simple language.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a warehouse health consultant explaining performance metrics.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.6,
        max_tokens: 200,
      });

      return {
        score: summary.overall_health_score,
        explanation: response.choices[0].message.content,
        generated_at: new Date().toISOString(),
      };
    } catch (error) {
      console.error('OpenAI health score error:', error.message);
      return {
        score: summary.overall_health_score,
        explanation: this._generateFallbackHealthExplanation(summary),
        generated_at: new Date().toISOString(),
      };
    }
  }

  /**
   * Fallback explanation when AI unavailable
   */
  _generateFallbackExplanation(plan, summary) {
    const ergonomicCount = plan.moves.filter((m) => m.category === 'ergonomic').length;
    const slottingCount = plan.moves.filter((m) => m.category === 'slotting').length;

    let explanation = `**Executive Summary:** This optimization plan includes ${plan.total_moves} product moves designed to improve warehouse safety, efficiency, and flow. `;

    if (ergonomicCount > 0) {
      explanation += `${ergonomicCount} moves address ergonomic risks, reducing injury potential. `;
    }

    if (slottingCount > 0) {
      explanation += `${slottingCount} moves optimize product placement based on pick frequency. `;
    }

    explanation += `\n\n**Business Impact:** Expected ${plan.impact.efficiency_gain || 'significant efficiency gains'} through better slotting and ${plan.impact.ergonomic_improvement || 'reduced injury risk'}.`;

    explanation += `\n\n**Implementation:** Execute moves during low-activity hours. ${plan.estimated_time} required. Priority moves should be completed first.`;

    explanation += `\n\n**Expected Outcomes:** ${plan.impact.estimated_roi}. ${plan.impact.payback_period} payback period.`;

    return {
      explanation,
      generated_at: new Date().toISOString(),
      confidence: 'medium',
      fallback: true,
    };
  }

  /**
   * Fallback comparison
   */
  _generateFallbackComparison(current, optimized) {
    const healthImprovement = optimized.overall_health_score - current.overall_health_score;
    const riskReduction = current.high_risk_products - optimized.high_risk_products;

    let comparison = `The optimization improves overall health by ${healthImprovement} points (${current.overall_health_score} → ${optimized.overall_health_score}). `;

    if (riskReduction > 0) {
      comparison += `High-risk product count decreases by ${riskReduction} items (${Math.round((riskReduction / current.high_risk_products) * 100)}% reduction). `;
    }

    comparison += `Utilization ${optimized.utilization_rate > current.utilization_rate ? 'increases' : 'remains stable'} at ${optimized.utilization_rate}%.`;

    return comparison;
  }

  /**
   * Fallback health explanation
   */
  _generateFallbackHealthExplanation(summary) {
    const score = summary.overall_health_score;
    let explanation = '';

    if (score >= 80) {
      explanation = `Your warehouse health is excellent (${score}/100). Operations are running efficiently with minimal risk factors. `;
    } else if (score >= 60) {
      explanation = `Your warehouse health is good (${score}/100) but has room for improvement. `;
    } else if (score >= 40) {
      explanation = `Your warehouse health is fair (${score}/100). Several optimization opportunities identified. `;
    } else {
      explanation = `Your warehouse health needs attention (${score}/100). Multiple risk factors present. `;
    }

    if (summary.metrics.high_risk_products > 5) {
      explanation += `Primary concern: ${summary.metrics.high_risk_products} high-risk ergonomic items. `;
    }

    if (summary.utilization_rate < 60) {
      explanation += `Utilization at ${summary.utilization_rate}% indicates underused capacity. `;
    } else if (summary.utilization_rate > 90) {
      explanation += `Utilization at ${summary.utilization_rate}% indicates near-capacity operation. `;
    }

    explanation += `Review recommendations for actionable improvements.`;

    return explanation;
  }

  /**
   * Calculate improvement score
   */
  _calculateImprovementScore(current, optimized) {
    const healthDelta = optimized.overall_health_score - current.overall_health_score;
    const riskDelta = current.high_risk_products - optimized.high_risk_products;

    const score = healthDelta * 2 + riskDelta * 5;

    return {
      score: Math.max(0, Math.min(100, score)),
      rating: score > 50 ? 'significant' : score > 20 ? 'moderate' : 'minor',
      health_improvement: healthDelta,
      risk_reduction: riskDelta,
    };
  }
}

module.exports = ReasoningEngine;
