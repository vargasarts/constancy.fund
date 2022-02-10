const STAGES = [
  "INVITED",
  "CONTRACT_GENERATED",
  "CONFIRM_CONTRACT",
  "CONTRACT_SIGNED",
  "REJECTED",
  "ARCHIVED",
];

export const dbIdByStatusName = Object.fromEntries(
  STAGES.map((s, i) => [s, i])
);

export default STAGES;
