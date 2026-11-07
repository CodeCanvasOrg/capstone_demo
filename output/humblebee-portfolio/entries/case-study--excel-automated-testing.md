# Excel-based Automated Testing: Reducing Manual Validation Time

Excel-based automated testing streamlines HS code validation for customs classification QA teams. [PDF source: b70c24f0-a2aa-4acf-898a-4acee140e651]

## Executive Summary

Customs classification QA teams need to check whether HS code classification systems return expected codes across large sets of product descriptions. Manual review makes broad validation slow and difficult to repeat. This project delivered an Excel-based testing framework, accessed through a FastAPI endpoint, that compares predicted HS codes with expected codes. The reported first run processed 11,000 descriptions in approximately 4 hours; the manual comparison was estimated at more than a month. The case-study PDF has been text-reviewed, but owner approval is pending; the source does not establish the framework’s current production availability. [Read the original case study](https://humblebee.ai/case-studies/excel-automated-testing) [PDF source: da0c563c-ff28-4089-9001-cc5124060e0d]

## Context and Challenge

The previous workflow relied on subject matter experts reviewing product descriptions, determining appropriate HS codes and comparing them with system outputs. For large datasets, this required substantial time and could be inconsistent across reviewers or over extended work. The case study specifically describes 11,000-description validation as taking more than a month of dedicated expert time when performed manually, limiting the practicality of frequent, comprehensive test cycles. The source does not provide details about the organization or team size involved, or the exact manual-work schedule used for that estimate. [PDF source: 2769b453-d343-437d-b27b-1069f54876d9] [PDF source: 6bda6752-cca0-4295-a54f-e8b9edcf004c]

## Solution and Capabilities

### Excel input and automated comparison

The delivered framework accepts Excel files in a standardized two-column format: product descriptions and expected HS codes. A FastAPI endpoint processes the entries through the classification system, compares returned codes with the expected values and generates validation reports. This preserves a familiar spreadsheet-based input method while automating the row-by-row checking task. [PDF source: 3c5be7af-210f-4cfb-a189-db4aa312f20c]

### Repeatable validation

The source describes detailed results, error-pattern reporting and processing logs, intended to help QA teams inspect outcomes. It also describes re-running the same Excel file and comparing standardized reports across validation cycles or system versions. These capabilities support systematic review; the available material does not quantify any resulting change in classification accuracy. [PDF source: 3c5be7af-210f-4cfb-a189-db4aa312f20c]

## Results and Business Impact

In the first reported run, the framework processed 11,000 product descriptions in approximately 4 hours, versus an estimated manual effort of more than a month. This is an observed automated batch duration compared with an estimated manual duration, not a controlled like-for-like timing study. The working-hour assumptions behind the manual estimate are not provided, so the headline 180x speedup is not included. The source reports no measured change in classification accuracy, compliance outcomes or business costs, and the reported figures have not been independently validated. [PDF source: da0c563c-ff28-4089-9001-cc5124060e0d]

## Limitations and Next Steps

The source does not specify test-environment details, hardware, dataset composition, the classification system’s version, or conditions for the manual estimate. The case-study record is marked as pending owner approval, and production deployment or ongoing availability is not established by the reviewed material. No next steps or roadmap items are provided; therefore, none are presented here. [PDF source: b70c24f0-a2aa-4acf-898a-4acee140e651] [PDF source: da0c563c-ff28-4089-9001-cc5124060e0d]

## Conclusion

The delivered framework replaces individual manual comparisons with a repeatable Excel-to-FastAPI validation process. Its reported first run shows that a large validation batch could be processed in approximately 4 hours, while accuracy and broader business impact remain unmeasured in the supplied evidence. [PDF source: a87368f9-086f-48e2-b67d-6327af00b78f]

## Sources and Review Notes

Excel-based Automated Testing: Reducing Manual Validation Time — original source. PDF evidence pages: 1–4.[ Open source](https://humblebee.ai/case-studies/excel-automated-testing) [PDF source: b70c24f0-a2aa-4acf-898a-4acee140e651] [PDF source: ffd30b12-e39c-43bf-983c-50d4b9e018f7] [PDF source: 6ee6041a-4992-4ae5-818d-7f000e45b712] [PDF source: a87368f9-086f-48e2-b67d-6327af00b78f]

Source-reviewed outcome: First run processed 11,000 descriptions in approximately 4 hours against an estimated manual effort of more than a month.

Evidence gaps: Manual baseline is estimated; headline 180x depends on unspecified working-hour assumptions and is omitted from the draft.

Measurement — Automated HS validation throughput: 11,000 descriptions in about 4 hours. PDF p. 1,2,3,4. Comparison / conditions: First run; manual comparator estimated more than a month. Qualification: Observed batch versus estimated manual duration

Measurement — Headline speedup: 180x. PDF p. 1. Comparison / conditions: Month-to-four-hour comparison. Qualification: Working-hour assumption absent; omit speedup factor

Review draft. Company approval of claims and figures is pending. Original URLs are transcribed from the supplied PDFs; current remote availability has not been verified.
