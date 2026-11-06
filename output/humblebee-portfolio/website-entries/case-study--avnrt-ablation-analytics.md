# AVNRT Ablation Analysis with CARTONET for Johnson & Johnson

How Johnson & Johnson used HumbleBeeAI’s AVNRT ablation analysis framework to organize procedural data and explore patterns across patients

## Executive Summary

Johnson & Johnson needed a clearer way to analyze cardiac ablation data from AVNRT procedures. Procedural information arrived in scattered files and inconsistent formats, while patient-specific 3D mapping coordinates made comparisons difficult. HumbleBeeAI describes delivering a custom framework that automated data normalization and statistical analysis and provided interactive 3D visualizations. The case study also describes predictive modeling, but does not report validation metrics or quantified clinical outcomes. [PDF p. 2](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/34971225-fadb-4af4-a7f5-6883a845760d/evidence/d69d4f25-eb5c-48ce-a211-e82e8d94be54/asset) [PDF p. 2](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/34971225-fadb-4af4-a7f5-6883a845760d/evidence/a0750228-4515-45c0-8f95-716aa0f48f1b/asset) [PDF p. 2](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/34971225-fadb-4af4-a7f5-6883a845760d/evidence/08120407-511b-405c-98e9-a239eae7a512/asset)

## Context and Challenge

The project focused on helping Johnson & Johnson make better use of information from AVNRT ablation procedures, including electrophysiological recordings and biophysical measures. The case study says that valuable procedural information was difficult to interpret across patients without a structured analysis approach. [PDF p. 2](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/34971225-fadb-4af4-a7f5-6883a845760d/evidence/d69d4f25-eb5c-48ce-a211-e82e8d94be54/asset)

The previous workflow was constrained by several related problems:

- Patient mapping data used different coordinate systems, obstructing cross-patient comparison. [PDF p. 2](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/34971225-fadb-4af4-a7f5-6883a845760d/evidence/f554738e-d5d0-4688-ba6c-2f5c7203e34e/asset)
- XLSX and CSV files contained categorical mismatches, free-text annotations, and missing codes that required manual cleanup. [PDF p. 2](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/34971225-fadb-4af4-a7f5-6883a845760d/evidence/f554738e-d5d0-4688-ba6c-2f5c7203e34e/asset)
- Growing multi-patient datasets made traditional processing slow and unreliable, while dense 3D data was difficult for clinical experts to interpret. [PDF p. 2](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/34971225-fadb-4af4-a7f5-6883a845760d/evidence/f554738e-d5d0-4688-ba6c-2f5c7203e34e/asset)

The central challenge was therefore not a lack of data, but a lack of consistent structure for preparing, comparing, and interpreting it. [PDF p. 2](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/34971225-fadb-4af4-a7f5-6883a845760d/evidence/f554738e-d5d0-4688-ba6c-2f5c7203e34e/asset)

## Solution and Capabilities

HumbleBeeAI developed AVNRT Ablation Analysis with CARTONET, a custom analytical framework intended to turn scattered procedural files into data that could be compared and explored. The case study describes these capabilities: [PDF p. 2](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/34971225-fadb-4af4-a7f5-6883a845760d/evidence/a0750228-4515-45c0-8f95-716aa0f48f1b/asset)

### Data processing and normalization

The framework ingested raw XLSX and CSV files and aligned datasets using UUID identifiers and reference-based normalization anchored on His signal coordinates. This established a common spatial reference for cross-patient analysis. [PDF p. 2](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/34971225-fadb-4af4-a7f5-6883a845760d/evidence/a0750228-4515-45c0-8f95-716aa0f48f1b/asset)

### Automated statistical analysis

Automated calculations covered measures including power, temperature, impedance drop, and spatial distances. Box plots, percentiles, and comparative charts were used to make distributions and trends easier to inspect. [PDF p. 2](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/34971225-fadb-4af4-a7f5-6883a845760d/evidence/a0750228-4515-45c0-8f95-716aa0f48f1b/asset)

### Interactive 3D exploration

Interactive 3D models and LAO and RAO projections represented spatial relationships among His signals, ablation sites, and outcome categories. Users could rotate views and filter by category to examine the data from different perspectives. [PDF p. 2](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/34971225-fadb-4af4-a7f5-6883a845760d/evidence/a0750228-4515-45c0-8f95-716aa0f48f1b/asset)



![Illustration of an analyst examining clustered points in a three-dimensional chart; this is an illustrative image, not a screenshot of the delivered system.](assets/3379fe9f-cc01-40b7-b9b1-8bb1489b6cbb.png)

### Predictive modeling

The case study says the framework correlated pre-ablation features with outcomes to explore potential predictors of procedural success. It presents this as an early insight and a foundation for future refinement, not as a reported, validated prediction performance result. [PDF p. 2](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/34971225-fadb-4af4-a7f5-6883a845760d/evidence/a0750228-4515-45c0-8f95-716aa0f48f1b/asset) [PDF p. 2](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/34971225-fadb-4af4-a7f5-6883a845760d/evidence/08120407-511b-405c-98e9-a239eae7a512/asset)

## Results and Business Impact

The supplied case study reports qualitative improvements, but does not provide numeric measurements, baselines, or study details to quantify them. Its reported observations are: [PDF p. 2](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/34971225-fadb-4af4-a7f5-6883a845760d/evidence/08120407-511b-405c-98e9-a239eae7a512/asset)

- Automated pipelines replaced manual preprocessing, which the case study says reduced the time from data collection to insight generation; no time savings are specified. [PDF p. 2](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/34971225-fadb-4af4-a7f5-6883a845760d/evidence/08120407-511b-405c-98e9-a239eae7a512/asset)
- Standardized formats and structured calculations were reported to make cross-patient comparisons more reliable and consistent; no accuracy metric is provided.
- Statistical summaries and visualizations were reported to make previously hard-to-see patterns easier for clinical experts to examine.
- The predictive framework was described as creating a foundation for longer-term learning and strategy refinement; measured effects on procedure strategy or patient outcomes were not reported.

These are qualitative claims in the source case study. No percentages, sample sizes, time reductions, predictive performance measures, or patient outcome results were supplied.

## Limitations and Next Steps

The source describes a custom framework and its analytical capabilities, but does not specify deployment status, user adoption, validation methodology, dataset size, or ongoing operational support. It also provides no quantitative evaluation of the predictive modeling, so its predictive performance and clinical utility cannot be assessed from the supplied information. [PDF p. 2](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/34971225-fadb-4af4-a7f5-6883a845760d/evidence/a0750228-4515-45c0-8f95-716aa0f48f1b/asset)

The case study frames further refinement of procedural strategies as a future opportunity, rather than reporting it as completed work. No additional planned steps or timelines are provided.

The source PDF references an “Open original HumbleBeeAI page” link, but the actual URL was not included in the supplied material. [PDF p. 1](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/34971225-fadb-4af4-a7f5-6883a845760d/evidence/36f7363c-1cc3-475f-ae56-f185e3103090/asset)

## Conclusion

The AVNRT ablation analysis framework addressed a practical data problem: scattered, inconsistently formatted procedure files and spatial data that were difficult to compare. The reported approach brought normalization, statistical summaries, and interactive 3D exploration into one analytical workflow, giving Johnson & Johnson a more structured basis for examining patterns. The source reports qualitative benefits, while leaving quantified performance and patient impact unreported. [PDF p. 2](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/34971225-fadb-4af4-a7f5-6883a845760d/evidence/f554738e-d5d0-4688-ba6c-2f5c7203e34e/asset) [PDF p. 2](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/34971225-fadb-4af4-a7f5-6883a845760d/evidence/a0750228-4515-45c0-8f95-716aa0f48f1b/asset)

