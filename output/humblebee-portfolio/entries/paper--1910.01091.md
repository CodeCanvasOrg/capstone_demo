# W-Net: A CNN-based Architecture for White Blood Cells Image Classification

W-Net is a compact convolutional neural network proposed to classify five white-blood-cell types from microscopy images.

## Executive Summary

This research study asks whether a compact CNN can distinguish neutrophils, eosinophils, basophils, lymphocytes and monocytes. The paper reports an average accuracy of 97% on a private 6,562-image dataset and evaluates transfer learning on public LISC data. It is an arXiv preprint, not a documented HumbleBeeAI client delivery or product. The PDF text has been reviewed; owner approval and HumbleBeeAI review remain pending. [Read the paper on arXiv](https://arxiv.org/abs/1910.01091) or [download the PDF](https://arxiv.org/pdf/1910.01091) [PDF source: 8caa1489-16a1-4678-b652-dc928ffd761e]

## Context and Challenge

Manual blood-smear review relies on visible cell characteristics and can be time-consuming and labor-intensive; classification remains challenging even after cells are observed. The study focuses on assigning an image of an already observed WBC to one of five classes, rather than detecting cells or diagnosing leukemia. Its private dataset, provided by The Catholic University of Korea, contains 6,562 images and has an imbalanced class distribution, including 6% basophils. The authors also examine whether the trained model can transfer to a public dataset.  [PDF source: 56469adb-4e9f-4aa2-ac35-137833b24a1c] [PDF source: 985bcc98-a886-4927-b0cc-dbc02640821c] [PDF source: f2765b26-100c-49d3-bc38-0cf9d621da33]

## Technical Approach

W-Net applies cropping, resizing and normalization before feeding images through three convolutional layers with pooling for feature extraction, followed by two fully connected layers and a softmax classifier for the five cell classes. The paper describes the design as having a small number of layers and reports 16,806,949 trainable parameters. This is a research architecture; the sources do not establish a deployed system or a link to a HumbleBeeAI product. [PDF source: 505dca26-9178-4647-bb76-52645ec6ea1c] [PDF source: f2765b26-100c-49d3-bc38-0cf9d621da33] [PDF source: 64e51613-0c6e-4902-89e4-e698a2f0c26c]

## Implementation

For the private dataset experiments, the paper reports a softmax loss, Adam with a learning rate of 0.0001, batch size five, 500 training epochs and 10-fold cross-validation. For LISC, 254 images were resized to 128×128×3. The authors compared a W-Net trained from scratch on LISC for 4,000 epochs with a model first trained on the private dataset for 500 epochs and then further trained on LISC for 4,000 epochs; the other hyperparameters were identical. No deployed integration, service workflow or commercial availability is documented. [PDF source: 64e51613-0c6e-4902-89e4-e698a2f0c26c] [PDF source: 0fd1d194-6ce7-45ac-9f56-5199fa414bcf]

## Evaluation

On the private 6,562-image dataset, W-Net reports average classification accuracy of 97% across five WBC types. The paper states it used 10-fold cross-validation, but the supplied evidence does not give a full split protocol, per-fold aggregation method, confidence intervals or an independent external test set for this result. On LISC’s 254 images, the from-scratch model reports 91% average accuracy; the model pretrained on the private data and further trained on LISC reports 96%. These LISC results use 10-fold cross-validation and the same hardware environment, normalization and image dimensions, but hardware specifications are not provided. The 5 percentage-point difference is a research comparison between these two training conditions, not a business outcome.  [PDF source: 8caa1489-16a1-4678-b652-dc928ffd761e] [PDF source: 0fd1d194-6ce7-45ac-9f56-5199fa414bcf] [PDF source: 0dfc3600-25ea-497f-885c-1eadb1f7da7c]

## Results and Business Impact

The reported accuracies are technical research measurements, not results for a HumbleBeeAI client, clinical deployment or breast-cancer biomarker. The study addresses image classification of five WBC types and does not establish diagnostic impact, workflow savings, user adoption or commercial value. No business-impact results have been provided.

## Limitations and Next Steps

The evidence is a 2019 arXiv preprint (arXiv:1910.01091v1, 2 October 2019); formal venue metadata is not established by the supplied material. Evaluation details such as a fully specified split protocol, hardware configuration and uncertainty estimates are missing from the reviewed excerpts. The reported work includes transfer evaluation on LISC, but no follow-on roadmap or planned product work is documented. Owner and portfolio review are still pending.

## Conclusion

W-Net presents a compact CNN research approach to five-class WBC image classification, reporting 97% average accuracy on a private dataset and higher LISC accuracy after transfer training than from-scratch LISC training. These findings describe the paper’s experiments only; no product or client relationship is established. [PDF source: 8caa1489-16a1-4678-b652-dc928ffd761e] [PDF source: 0fd1d194-6ce7-45ac-9f56-5199fa414bcf]

## Sources and Review Notes

W-Net: A CNN-based Architecture for White Blood Cells Image Classification — original source. PDF evidence pages: 1.[ Open source](https://arxiv.org/abs/1910.01091) [PDF source: f2765b26-100c-49d3-bc38-0cf9d621da33] [PDF source: 0fd1d194-6ce7-45ac-9f56-5199fa414bcf] [PDF source: afcf9ac7-c5b1-429b-8261-9e070e2af831]

Authors: Changhun Jung, Mohammed Abuhamad, Jumabek Alikhanov, Aziz Mohaisen, Kyungja Han, DaeHun Nyang

Published status: Downloaded evidence: arXiv:1910.01091v1, 2 October 2019

Source-reviewed outcome: Reports average 97% classification accuracy on a private 6,562-image dataset; also evaluates LISC transfer learning.

Evidence gaps: AAAI copyright notice alone does not establish formal venue metadata; retain preprint status. No product/case link established.

Measurement — White-blood-cell classification accuracy: Average 97%. PDF p. 1. Comparison / conditions: 6,562 private images; five WBC types. Qualification: Not breast-cancer biomarker accuracy

Measurement — LISC accuracy without private-data pretraining: 91% average. PDF p. 4,5. Comparison / conditions: 254 LISC images; W-Net trained from scratch for 4,000 epochs; 10-fold cross-validation. Qualification: Small dataset; research comparison, not clinical or business impact.

Measurement — LISC accuracy with private-data pretraining: 96% average. PDF p. 4,5. Comparison / conditions: Pretrained on private data for 500 epochs then trained on LISC for 4,000 epochs; 10-fold cross-validation; 254 LISC images. Qualification: Five percentage points above from-scratch result; no independent clinical validation.

Review draft. Company approval of claims and figures is pending. Original URLs are transcribed from the supplied PDFs; current remote availability has not been verified.
