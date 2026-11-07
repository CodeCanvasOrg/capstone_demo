# Johnson & Johnson Achieves 96.8% Accuracy in Customer Targeting

Johnson & Johnson’s marketing team used an explainable predictive-modeling framework to estimate customer purchase probability across varied markets and datasets. [PDF source: a68143ba-8a4e-4fd6-8815-bf63b1a9cf63]

## Executive Summary

This review-draft case study describes a HumbleBeeAI solution for Johnson & Johnson marketing: an XGBoost-based model intended to help teams identify likely buyers and understand the factors behind predictions. The case study reports 96.8% accuracy for purchase-probability prediction. The PDF text has been reviewed, but owner approval is pending; the result has not been independently validated. [PDF source: a68143ba-8a4e-4fd6-8815-bf63b1a9cf63] [Original case study: Johnson & Johnson Achieves 96.8% Accuracy in Customer Targeting](https://humblebee.ai/case-studies/ai-based-predictive) [PDF source: 7d32b0a8-b612-4e46-a155-b7747b4f2a1b]

## Context and Challenge

The marketing team needed to estimate which customers might purchase particular products across diverse markets and datasets. The source describes prediction as difficult, time-consuming and often inaccurate; regional and product-line data variation complicated preprocessing, while limited interpretability left teams without clear reasons for model outputs. It also identifies a need to generate predictions quickly enough to inform campaign decisions. [PDF source: ec357a6e-3da7-4b6f-8438-dc6e76a2ba95] [PDF source: 36dfa1c1-7496-4d43-a0b2-5dfd5d3b377b]

## Solution and Capabilities

### Prediction and data preparation

The described framework used XGBoost, tuned through grid search. Missing values were addressed with imputation, MinMax scaling was used to standardize data, and engineered features represented demographics, location, transaction history and usage patterns. These steps were intended to support predictions across varied datasets. [PDF source: 1e97f539-9e99-4189-b8bd-a980cfbbf382]

### Explanations and serving predictions

SHAP analysis provided feature-level explanations of purchase probabilities, with the stated purpose of helping marketing teams understand why customers were scored as more likely to purchase. A Flask API was described as serving predictions and interpretability metrics for rapid campaign decisions.

## Results and Business Impact

The case study reports 96.8% accuracy for purchase-probability prediction using XGBoost. The source does not provide the test sample size, class balance, evaluation split or comparison baseline, so the measurement’s test conditions and comparative meaning cannot be assessed from the available evidence. [PDF source: a68143ba-8a4e-4fd6-8815-bf63b1a9cf63]

The case study also describes sharper targeting, higher conversions, stronger revenue growth and faster campaign planning. However, no quantified conversion or revenue lift, measurement period or supporting business-impact measurement is provided; these claims should be treated as source-reported outcomes, not established measured results. [PDF source: 69c0a1ab-1e07-42f9-83df-2d0f468421de]

## Limitations and Next Steps

The available case-study material describes the model, SHAP explanations and Flask prediction API as part of the solution, but does not specify deployment scope, production availability or operating conditions. Evaluation details—including sample size, class balance, split and baseline—and quantified conversion or revenue impact have not been provided. No future work or roadmap is specified in the supplied source. [PDF source: a68143ba-8a4e-4fd6-8815-bf63b1a9cf63]

## Conclusion

The documented solution combines purchase-probability modeling with explanations intended to make predictions more useful to Johnson & Johnson’s marketing team. Its reported 96.8% accuracy is a source-reported technical result; incomplete test conditions and unquantified business outcomes limit conclusions about comparative performance or commercial impact. [PDF source: a68143ba-8a4e-4fd6-8815-bf63b1a9cf63] [PDF source: 69c0a1ab-1e07-42f9-83df-2d0f468421de]

## Sources and Review Notes

Johnson & Johnson Achieves 96.8% Accuracy in Customer Targeting — original source. PDF evidence pages: 1–3.[ Open source](https://humblebee.ai/case-studies/ai-based-predictive) [PDF source: a68143ba-8a4e-4fd6-8815-bf63b1a9cf63] [PDF source: 1e97f539-9e99-4189-b8bd-a980cfbbf382]

Source-reviewed outcome: Reported 96.8% accuracy for purchase-probability prediction.

Evidence gaps: No test sample, class balance, split, comparison baseline or quantified conversion/revenue lift.

Measurement — Purchase prediction accuracy: 96.8%. PDF p. 1,2. Comparison / conditions: XGBoost; evaluation split and class balance absent. Qualification: No quantified conversion or revenue lift

Review draft. Company approval of claims and figures is pending. Original URLs are transcribed from the supplied PDFs; current remote availability has not been verified.
