# How Johnson and Johnson Found Patterns Hidden in Ablation Data?

How Johnson & Johnson used CARTONET to organize AVNRT ablation data and explore patterns across procedures [PDF source: 36f7363c-1cc3-475f-ae56-f185e3103090]

## Executive Summary

HumbleBeeAI developed a custom analytical framework for Johnson & Johnson to address cardiac ablation analysis in AVNRT procedures. Procedure records were difficult to align and interpret across patients; CARTONET was built to normalize the data, support statistical analysis, and provide interactive 3D views. The source reports improved consistency and analysis efficiency, but gives no numerical performance measure. This portfolio entry is based on a reviewed website snapshot, with owner approval pending. [PDF source: 40e623d3-efd9-4134-b349-99c0a0c04499] [PDF source: a0750228-4515-45c0-8f95-716aa0f48f1b]

## Context and Challenge

The project addressed a data-structure problem, not a lack of clinical data. Files for AVNRT procedures included XLSX and CSV records, while patient-specific 3D mapping coordinates differed and the tabular data could contain inconsistent categories, free-text annotations, or missing codes. As a result, cross-patient comparison depended on manual cleanup and was difficult to perform consistently. The source describes these constraints but does not quantify the number of procedures, users, or time spent in the prior workflow. [PDF source: f554738e-d5d0-4688-ba6c-2f5c7203e34e] [PDF source: d69d4f25-eb5c-48ce-a211-e82e8d94be54]

## Solution and Capabilities

### Data normalization for comparison

CARTONET ingested XLSX and CSV files and aligned datasets to a common spatial reference using UUID identifiers and reference-based normalization anchored on His signal coordinates. This approach was intended to make comparisons across patients possible despite differing coordinate systems. [PDF source: a0750228-4515-45c0-8f95-716aa0f48f1b]

### Statistical summaries and 3D views

The framework computed summaries for measures including power, temperature, impedance drop, and spatial distances, and presented distributions and comparisons through box plots, percentiles, and charts. Interactive 3D models and LAO and RAO projections enabled users to inspect spatial relationships among His signals, ablation sites, and outcome categories, with rotation and category filtering described in the source. [PDF source: a0750228-4515-45c0-8f95-716aa0f48f1b]

### Predictive analysis

The source also describes correlations between pre-ablation features and outcomes as providing early insight into possible predictors of procedural success. It does not provide predictive validation results, test conditions, or evidence of clinical-outcome effects; this should be treated as exploratory analysis rather than validated clinical guidance. [PDF source: a0750228-4515-45c0-8f95-716aa0f48f1b]

## Results and Business Impact

The source reports improved consistency through standardized formats and structured calculations, and improved analysis efficiency through automated preprocessing and analysis. It supplies no numerical measure, baseline, comparison period, or test conditions for these observations. No measured time saving, predictive validation, or effect on clinical outcomes has been provided. These reported observations are not quantified business or clinical results. [PDF source: 08120407-511b-405c-98e9-a239eae7a512] [PDF source: a0750228-4515-45c0-8f95-716aa0f48f1b]

## Limitations and Next Steps

The case-study source describes data normalization, statistical analysis, interactive visualizations, and exploratory predictive correlations as part of the framework. It does not state deployment or production-availability status, and no demo link is supplied; availability beyond the described project work is therefore unknown. Predictive performance and clinical impact remain unvalidated in the supplied evidence. Owner approval of the reviewed website snapshot is pending. No further roadmap or next steps have been provided. [PDF source: a0750228-4515-45c0-8f95-716aa0f48f1b]

## Conclusion

CARTONET’s documented contribution was to bring scattered AVNRT ablation files into a more consistently structured basis for analysis, with statistical summaries and interactive spatial views to support cross-patient exploration. The source reports efficiency and consistency improvements, but provides no quantified results or evidence of clinical impact. [PDF source: a0750228-4515-45c0-8f95-716aa0f48f1b] Original case study: [How Johnson and Johnson Found Patterns Hidden in Ablation Data?](https://humblebee.ai/case-studies/avnrt-ablation-analytics)

## Sources and Review Notes

How Johnson and Johnson Found Patterns Hidden in Ablation Data? — original source. PDF evidence pages: 1–3.[ Open source](https://humblebee.ai/case-studies/avnrt-ablation-analytics) [PDF source: 40e623d3-efd9-4134-b349-99c0a0c04499]

Source-reviewed outcome: Source reports improved consistency and analysis efficiency without a numerical performance measure.

Evidence gaps: No measured time saving, predictive validation or clinical-outcome effect.

Review draft. Company approval of claims and figures is pending. Original URLs are transcribed from the supplied PDFs; current remote availability has not been verified.
