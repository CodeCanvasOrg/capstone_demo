# Performance Evaluation of Deep Learning Based Network Intrusion Detection System across Multiple Balanced and Imbalanced Datasets

Performance Evaluation of Deep Learning Based Network Intrusion Detection System across Multiple Balanced and Imbalanced Datasets

## Executive Summary

This published research compares deep-learning approaches for network intrusion detection, serving researchers and security teams evaluating supervised detection models. Azizjon Meliboev, Jumabek Alikhanov and Wooseong Kim study CNN, LSTM, RNN, GRU and CNN–LSTM models across three benchmark datasets and balanced and imbalanced training scenarios. The paper was published in [Electronics 11(4), 515, on 9 February 2022](https://www.mdpi.com/2079-9292/11/4/515) (DOI 10.3390/electronics11040515). It reports stronger performance for single CNN and CNN/LSTM models in selected comparisons; this is a research evaluation, not a HumbleBeeAI client result or production product.  [PDF source: 4a5231b1-0138-46ca-923c-d262c6464239] [PDF source: 856170f9-0414-4dea-af59-ebbdfbbb9090]

## Context and Challenge

Network intrusion detectors must distinguish normal traffic from attacks, including less familiar behavior, while training data can be highly imbalanced. The research asks how convolutional, recurrent and hybrid detectors compare across balanced and imbalanced benchmark data. Its scope is offline evaluation using UNSW-NB15, KDD Cup ’99 and NSL-KDD, not a reported deployment in a live network.  [PDF source: 47c1e6af-f270-4d7d-918f-873040501e74] [PDF source: 9a9e3a71-c990-4b28-b4cf-a5b011b8d107]

## Technical Approach

The study frames detection as supervised binary classification: traffic records are labeled normal (0) or attack (1), with attack categories grouped together. It compares CNN, LSTM, GRU and RNN architectures, plus CNN–LSTM combinations. The authors describe using flow-level, header-based features; the method does not depend on IP addresses or payload data.  [PDF source: 55f8ff00-28bb-4928-ae8c-ca4b4a5efcd1] [PDF source: 32d73ed8-c828-4825-b14e-56b36e31f7a5]

## Implementation

The paper compares CNN, LSTM, GRU, RNN and CNN–LSTM models, including minority-class oversampling using SMOTE. It reports CNN training for up to 100 epochs with Adam and learning rate 0.0001; recurrent models use a different reported learning rate of 0.001. These are offline research experiments.

## Evaluation

Evaluation covers UNSW-NB15, KDD Cup 99 and NSL-KDD under balanced and imbalanced data conditions. Accuracy, precision, recall and F-score are compared across models. The reported relative performance varies with the dataset and metric; the source-reviewed summary identifies strong CNN and CNN–LSTM results. Training runs of up to 100 epochs are experimental conditions, not business outcomes. The paper does not establish deployment performance, independent replication or operational impact.

## Results and Business Impact

Technically, results vary by dataset and balance condition: CNN and CNN–LSTM produce the leading reported accuracy scores in several comparisons, while the paper notes that recurrent and hybrid models can require more training time. The study does not report measured operational savings, reduced incident rates, customer outcomes or other business impact. No client implementation relationship is established in the supplied records.  [PDF source: b352b1b2-b4b9-43bc-a585-2c9587651e68]

## Limitations and Next Steps

The evaluation uses benchmark datasets and does not establish effectiveness on a client production network. The authors propose cross-dataset evaluation and reducing the computational cost of recurrent models as future research; these are planned investigations, not delivered capabilities.

## Conclusion

The paper provides a comparative benchmark study of deep-learning IDS architectures across three datasets and both balanced and imbalanced training conditions. Its findings offer a dataset-specific basis for model comparison, while remaining research evidence rather than a demonstrated HumbleBeeAI deployment. The original publication and publisher PDF are available via the [article page](https://www.mdpi.com/2079-9292/11/4/515) and [publisher PDF](https://www.mdpi.com/2079-9292/11/4/515/pdf). [PDF source: 856170f9-0414-4dea-af59-ebbdfbbb9090] [PDF source: 4a5231b1-0138-46ca-923c-d262c6464239]

## Sources and Review Notes

Performance Evaluation of Deep Learning Based Network Intrusion Detection System across Multiple Balanced and Imbalanced Datasets — original source. PDF evidence pages: 1.[ Open source](https://www.mdpi.com/2079-9292/11/4/515) [PDF source: 856170f9-0414-4dea-af59-ebbdfbbb9090]

Authors: Azizjon Meliboev; Jumabek Alikhanov; Wooseong Kim

Published status: Published, Electronics 11(4), 515, 9 February 2022; DOI 10.3390/electronics11040515

Source-reviewed outcome: Single CNN and CNN/LSTM combinations outperform other evaluated architectures in the reported experiments.

Evidence gaps: Use PDF author order, not listing name order. No product/case implementation link established.

Measurement — Training duration and rate: Up to 100 epochs; learning rate 0.0001. PDF p. 1. Comparison / conditions: UNSW-NB15, KDDCup 99, NSL-KDD; balanced/imbalanced. Qualification: Experimental settings, not detection outcome

Review draft. Company approval of claims and figures is pending. Original URLs are transcribed from the supplied PDFs; current remote availability has not been verified.
