# Excel-Based HS Code Testing Framework: 11,000 Descriptions in Four Hours

An Excel-based automated testing framework processed 11,000 product descriptions for HS code validation in approximately four hours. [PDF p. 1](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/c092713a-8812-421b-996f-73a77e75725a/evidence/b70c24f0-a2aa-4acf-898a-4acee140e651/asset)

## Executive Summary

HumbleBeeAI’s Excel-based automated testing framework helps organizations validate HS code classification systems against large datasets of product descriptions. It addresses a practical bottleneck: manual checking of 11,000 descriptions was estimated to take more than a month, limiting how often teams could run thorough tests. The case study reports the framework’s first run processed that dataset in about four hours using an Excel input and a FastAPI endpoint. [PDF p. 2](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/c092713a-8812-421b-996f-73a77e75725a/evidence/da0c563c-ff28-4089-9001-cc5124060e0d/asset)

The source describes the framework as delivered and reports a completed first run. It does not identify a named client or provide independently measured business outcomes beyond the reported processing-time comparison. [PDF p. 2](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/c092713a-8812-421b-996f-73a77e75725a/evidence/da0c563c-ff28-4089-9001-cc5124060e0d/asset)

## Context and Challenge

HS code classification systems need validation across many product descriptions, categories and edge cases. In the previous workflow, subject matter experts reviewed each description, determined an appropriate code and compared it with system output. For a dataset of 11,000 descriptions, this manual work was estimated to require more than a month of dedicated expert time. [PDF p. 3](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/c092713a-8812-421b-996f-73a77e75725a/evidence/2769b453-d343-437d-b27b-1069f54876d9/asset)

The manual approach also made consistent, repeatable testing difficult: reviewer interpretation could vary, while fatigue and the lack of systematic documentation made it harder to trace error patterns or compare system versions. As a result, broad validation was costly and slow, and regular test cycles could be constrained by available time and resources. [PDF p. 3](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/c092713a-8812-421b-996f-73a77e75725a/evidence/2769b453-d343-437d-b27b-1069f54876d9/asset)

## Solution and Capabilities

The framework keeps test preparation in a familiar spreadsheet workflow and automates processing and comparison behind the scenes. Its described capabilities include: [PDF p. 3](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/c092713a-8812-421b-996f-73a77e75725a/evidence/3c5be7af-210f-4cfb-a189-db4aa312f20c/asset)

- Excel-based test input: users provide a standardized two-column file containing product descriptions and expected HS codes.
- Automated classification and comparison: the FastAPI endpoint processes each row through the HS code classification system and compares system outputs with the expected codes.
- Validation reporting and logs: the framework generates reports covering accuracy metrics, error patterns and performance statistics, and records processing activity for analysis.
- Repeatable test cycles: the same Excel dataset can be run again to compare results across testing periods or system versions.

These capabilities are intended to make large-scale validation more consistent and to help teams examine classification errors and system changes without manually reviewing every entry. [PDF p. 3](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/c092713a-8812-421b-996f-73a77e75725a/evidence/3c5be7af-210f-4cfb-a189-db4aa312f20c/asset)



![Illustration of people working with a laptop displaying a checked document](assets/1d15f789-b341-4cee-ad58-e0dfc708cdd7.png)

The supplied case-study image illustrates a document-checking workflow; it is illustrative rather than a screenshot or technical architecture diagram. [PDF p. 1](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/c092713a-8812-421b-996f-73a77e75725a/evidence/1d15f789-b341-4cee-ad58-e0dfc708cdd7/asset)

## Results and Business Impact

The reported first run processed 11,000 product descriptions in approximately four hours. The source compares this with an estimated month or more for manual validation and reports a productivity improvement of over 180 times the previous manual approach. [PDF p. 3](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/c092713a-8812-421b-996f-73a77e75725a/evidence/6ee6041a-4992-4ae5-818d-7f000e45b712/asset)

- Test scale and time: 11,000 product descriptions processed in approximately 4 hours.
- Comparison reported: more than a month of estimated manual validation versus approximately 4 hours of automated processing.
- Reported productivity comparison: over 180 times the previous manual approach.

The case study also describes more consistent evaluation criteria and reports that detailed reporting and logging make performance patterns easier to inspect. It does not provide a separate measured change in classification accuracy, compliance, cost or other business outcome; those impacts have not been quantified in the supplied material. [PDF p. 3](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/c092713a-8812-421b-996f-73a77e75725a/evidence/6ee6041a-4992-4ae5-818d-7f000e45b712/asset)

## Limitations and Next Steps

The supplied case study describes the Excel-to-FastAPI validation workflow and its first run, but does not specify technical constraints, supported file-size limits, deployment details or a roadmap. Additional functionality and next steps have not been provided, so none are represented here as planned or delivered. [PDF p. 3](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/c092713a-8812-421b-996f-73a77e75725a/evidence/3c5be7af-210f-4cfb-a189-db4aa312f20c/asset)

The source material refers to an “Open original HumbleBeeAI page” link but does not include its destination URL. A working original-page link therefore cannot be reproduced from the supplied source. [PDF p. 1](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/c092713a-8812-421b-996f-73a77e75725a/evidence/b70c24f0-a2aa-4acf-898a-4acee140e651/asset)

## Conclusion

By retaining Excel as the input format and automating the row-by-row HS code comparison, HumbleBeeAI’s framework made a large validation run practical on a much shorter timeline. The supported result is specific: 11,000 product descriptions were processed in approximately four hours, compared with an estimated month or more for manual validation; broader business impact has not been measured in the supplied material. [PDF p. 3](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/c092713a-8812-421b-996f-73a77e75725a/evidence/6ee6041a-4992-4ae5-818d-7f000e45b712/asset)

