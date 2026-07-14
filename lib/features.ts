/**
 * The model's input contract, mirrored from ml/common.py. If these ever disagree,
 * the model receives scrambled features and every score silently becomes garbage,
 * so both sides assert the order in their tests.
 *
 * Time is deliberately absent: it counts seconds since the dataset's first
 * transaction, so under a chronological split the training and serving ranges are
 * disjoint and the feature cannot generalize. See ml/common.py.
 */
export const FEATURE_NAMES = [
  ...Array.from({ length: 28 }, (_, i) => `V${i + 1}`),
  "Amount",
] as const;

export const N_FEATURES = FEATURE_NAMES.length; // 29
