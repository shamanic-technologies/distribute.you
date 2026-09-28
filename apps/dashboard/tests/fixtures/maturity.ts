/**
 * A served maturity pair the producer could not judge (features-service#1196): every half
 * null. The dashboard REQUIRES the pair on every money block it parses, so a fixture captured
 * before the producer served it carries this filler, which states no figure and no Learning.
 */
export const NULL_PAIR = { flash: null, mature: null, isMature: null } as const;
