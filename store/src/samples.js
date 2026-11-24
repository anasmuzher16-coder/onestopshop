// The demo's made-up sample products: every row store/tools/seed.mjs writes from the mockup catalogue (site/catalog.js)
// and its cologne and misc lists. None is the shop's. All are switched off (owner, 2026-11-24: "Hide samples, show coming
// soon"), never deleted, because orders point at them. Real items are the supplier master files (store/catalog) and anything
// the back office adds: a back-office item gets the next free number after these, so it is never in this list.
// The live switch is store/catalog/live/samples-off-2026-11-24.sql; tools/test-seo.mjs checks the two lists match.
export const SAMPLE_SKUS = new Set([
  // hookahs (off since the Ace catalogue, 2026-11-24)
  "OSS-1001", "OSS-1002", "OSS-1003", "OSS-1004", "OSS-1005", "OSS-1007", "OSS-1008", "OSS-1010", "OSS-1012", "OSS-1013",
  "OSS-1014", "OSS-1015", "OSS-1016", "OSS-1017", "OSS-1018", "OSS-1019", "OSS-1020", "OSS-1021", "OSS-1022", "OSS-1023",
  "OSS-1024", "OSS-1025", "OSS-1026", "OSS-1027", "OSS-1028", "OSS-1029", "OSS-1030", "OSS-1031", "OSS-1032", "OSS-1033",
  "OSS-1034", "OSS-1035", "OSS-1036", "OSS-1037", "OSS-1038", "OSS-1039",
  // bases, bowls, heat pieces, hoses, parts and care, cologne, misc (off from 2026-11-24)
  "OSS-2001", "OSS-2002", "OSS-2003", "OSS-2004", "OSS-2005", "OSS-2006", "OSS-2007", "OSS-2008", "OSS-2009", "OSS-2010", "OSS-2011", "OSS-2012",
  "OSS-3001", "OSS-3003", "OSS-3004", "OSS-3006", "OSS-3007", "OSS-3008", "OSS-3009", "OSS-3010", "OSS-3011", "OSS-3012", "OSS-3013",
  "OSS-4001", "OSS-4002", "OSS-4003", "OSS-4004", "OSS-4005", "OSS-4006", "OSS-4007", "OSS-4008", "OSS-4009",
  "OSS-5001", "OSS-5002", "OSS-5003", "OSS-5005", "OSS-5006", "OSS-5007", "OSS-5008", "OSS-5009", "OSS-5011", "OSS-5012",
  "OSS-6002", "OSS-6003", "OSS-6004", "OSS-6005", "OSS-6006", "OSS-6008", "OSS-6009", "OSS-6010",
  "OSS-7001", "OSS-7002", "OSS-7003", "OSS-7004", "OSS-7006", "OSS-7008",
  "OSS-8001", "OSS-8002", "OSS-8003", "OSS-8004", "OSS-8005", "OSS-8006",
]);
export const isSample = sku => SAMPLE_SKUS.has(String(sku || ""));
