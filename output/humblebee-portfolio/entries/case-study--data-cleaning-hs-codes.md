# Data Cleaning & Ingestion for HS Code Systems

Data Cleaning & Ingestion for HS Code Systems: structuring fragmented customs data and reducing duplicate trade descriptions for searchable classification resources.

## Executive Summary

HumbleBeeAI’s case study describes work intended to support customs officers, businesses planning international expansion, and developers building automated trade applications. The challenge was to make scattered Harmonized System (HS) rules and a very large, repetitive collection of product descriptions usable for retrieval and trade classification. The reported solution organizes HS information into structured Excel datasets and MongoDB, and deduplicates product descriptions for semantic search through Pinecone. The source reports a reduction from 65.5 million descriptions to about 2 million unique records, retaining frequency information; the counts and percentage are rounded. This is a review draft: source-owner approval and portfolio feedback are pending. [PDF source: a8add353-db22-4345-b417-b6941090a7df] [PDF source: 430023b2-11e6-4771-8cdc-cf06aa95418b] [PDF source: c7a85860-5e73-4fdd-bc6e-9c9bd8622a29] [PDF source: a1350216-64f3-4741-abe7-482f2afb8d13]

## Context and Challenge

The source describes two related retrieval problems. HS-code definitions, rules, exceptions, and hierarchical details were distributed across PDFs, sometimes overlapping or contradicting one another. Users had to consult multiple files and manually cross-reference codes; inconsistent formats also hindered automation. Separately, about 65.5 million product descriptions mapped to 10-digit HS codes contained repeated entries with variations in spelling, punctuation, or formatting. This volume created redundant storage and made results repetitive, while processing was described as slow and resource-intensive. These are the case study’s reported conditions; independent test conditions are not provided. [PDF source: ed66c42f-b635-4991-8958-8cd917f8b7bc] [PDF source: a3142871-e6f2-4b4d-8e5c-fd8bee5b6b1e]

## Solution and Capabilities

### Structured HS-code reference data

The clarification work consolidated HS-code definitions, redirections, rules, and clarifications into a standardized Excel dataset, alongside a second dataset representing code relationships across the HS hierarchy. The case study says Pinecone supports semantic search from natural-language product descriptions, while MongoDB supports structured queries and hierarchical browsing. A row-by-row ingestion process and unified indexing were used to organize the information for both search and navigation. [PDF source: 430023b2-11e6-4771-8cdc-cf06aa95418b]

### Deduplicated product descriptions

For the optimization work, the described process normalized text formatting, applied text-analysis algorithms to identify substantially similar descriptions, and clustered duplicates. Rather than discard all repeated entries, it retained frequency counts to represent how often products appeared in the trade data. The resulting unique descriptions were ingested into Pinecone for semantic search and MongoDB for structured storage. [PDF source: c7a85860-5e73-4fdd-bc6e-9c9bd8622a29]

The source-reported project description is available at [Data Cleaning & Ingestion for HS Code Systems](https://humblebee.ai/case-studies/data-cleaning-hs-codes). [PDF source: 465b701b-80e1-4633-ad70-304bee5d69a6]

## Results and Business Impact

The case study reports reducing 65.5 million product descriptions to about 2 million unique records—a reported 97% reduction—while retaining frequency information. The source presents this as deduplication with product-frequency retention; counts and percentage are rounded, and the figure is not independently validated. It also reports more representative search results and improved query performance, but supplies no benchmark query latency, retrieval-quality measurement, baseline test design, or test conditions. No quantified business impact, such as customs-processing time or tariff-calculation accuracy, is provided, so those effects have not been measured in the supplied evidence. [PDF source: 51d537e4-7e98-4c47-a52f-fd30b9d518ba] [PDF source: a1350216-64f3-4741-abe7-482f2afb8d13]

## Limitations and Next Steps

The supplied case-study material describes the data structuring, deduplication, and dual-storage work as completed, but does not establish deployment status, production availability, or measured performance under defined test conditions. It gives no benchmark for retrieval latency or quality. The source discusses future AI-powered classification, compliance checking, and analytics as potential applications, not as delivered capabilities; no approved next-step plan has been provided. Publication approval remains pending. [PDF source: 18a52617-fb26-42bc-ba8d-edcf2e36022f]

## Conclusion

This work addresses fragmented HS-code references and repetitive trade descriptions by organizing reference data for structured browsing and semantic retrieval, while reducing duplicate records and preserving frequency information. The supported quantitative result is the rounded, source-reported 97% reduction from 65.5 million descriptions to about 2 million unique records. Further claims about operational or business impact require measurements not included in the reviewed material. [PDF source: 51d537e4-7e98-4c47-a52f-fd30b9d518ba] [PDF source: 465b701b-80e1-4633-ad70-304bee5d69a6]

## Sources and Review Notes

Data Cleaning & Ingestion for HS Code Systems — original source. PDF evidence pages: 1–3.[ Open source](https://humblebee.ai/case-studies/data-cleaning-hs-codes) [PDF source: a1350216-64f3-4741-abe7-482f2afb8d13] [PDF source: 55a4d4f8-515e-4bf4-8b24-1a04220ee40d]

Source-reviewed outcome: About 65.5 million descriptions reduced to about 2 million unique records, reported as 97% reduction, while retaining frequency information.

Evidence gaps: No benchmark query latency or retrieval-quality measurement; counts are rounded.

Measurement — Unique-record reduction: 65.5 million to about 2 million; 97%. PDF p. 1,3. Comparison / conditions: Deduplication with product-frequency retention. Qualification: Counts and percentage rounded

Review draft. Company approval of claims and figures is pending. Original URLs are transcribed from the supplied PDFs; current remote availability has not been verified.
