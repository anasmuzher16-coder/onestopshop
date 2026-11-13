// Sample catalog for the mockup. NOT the client's real inventory: names are generic,
// Hookahs ship disassembled: longest packed part = stem, about 75% of assembled height.
// weights/dimensions are ESTIMATES for typical items of each kind (to be replaced by
// measured values, see docs/SHIPPING.md "Data we need"). box = packed carton in cm, kg = packed weight.
export const BOXES = {
  XS: { l: 23, w: 16, h: 8,  tare: 0.15, label: "Mailer" },
  S:  { l: 30, w: 23, h: 15, tare: 0.30, label: "Small box" },
  M:  { l: 46, w: 30, h: 30, tare: 0.70, label: "Medium box, double wall" },
  L:  { l: 66, w: 36, h: 36, tare: 1.10, label: "Tall box, double wall" },
  T:  { l: 76, w: 30, h: 30, tare: 1.20, label: "Tall slim box, double wall" },
  XL: { l: 91, w: 41, h: 41, tare: 1.60, label: "Extra tall, double wall" },
};
export const CATEGORIES = [
  { id: "hookahs", name: "Hookahs" },
  { id: "bowls", name: "Bowls & heat" },
  { id: "hoses", name: "Hoses & parts" },
  { id: "frames", name: "Frames" },
];
const p = (sku, name, cat, price, kg, box, glass, height, note) => ({ sku, name, cat, price, kg, box, glass, height, note });
export const PRODUCTS = [
  p("OSS-0101","Stainless single-hose hookah, 72 cm","hookahs",289,5.4,"T",true,72,"Hand-blown base"),
  p("OSS-0102","Brass traditional hookah, 84 cm","hookahs",449,6.8,"T",true,84,"Brass stem, engraved"),
  p("OSS-0103","Travel hookah, 38 cm","hookahs",69,1.6,"M",false,38,"Acrylic base"),
  p("OSS-0104","Crystal-cut base hookah, 66 cm","hookahs",329,5.9,"T",true,66,"Heavy cut glass"),
  p("OSS-0105","Carbon stem hookah, 58 cm","hookahs",219,3.9,"T",true,58,"Matte black"),
  p("OSS-0106","Four-hose lounge hookah, 90 cm","hookahs",599,9.2,"T",true,90,"Four ports"),
  p("OSS-0107","Mini table hookah, 30 cm","hookahs",45,1.1,"S",true,30,"Glass, gift boxed"),
  p("OSS-0108","Aluminium modern hookah, 62 cm","hookahs",179,3.4,"T",true,62,"Click-lock base"),
  p("OSS-0201","Phunnel clay bowl","bowls",22,0.45,"S",false,null,"Glazed clay"),
  p("OSS-0202","Silicone bowl","bowls",15,0.2,"XS",false,null,"Unbreakable"),
  p("OSS-0203","Heat management device","bowls",39,0.4,"S",false,null,"Zinc alloy"),
  p("OSS-0204","Glass bowl with wind cover","bowls",35,0.6,"S",true,null,"Borosilicate"),
  p("OSS-0205","Coal tongs, 30 cm","bowls",12,0.15,"XS",false,null,"Stainless"),
  p("OSS-0301","Washable silicone hose, 180 cm","hoses",29,0.5,"S",false,null,"With aluminium tip"),
  p("OSS-0302","Leather-wrap hose","hoses",49,0.7,"S",false,null,"Brass handle"),
  p("OSS-0303","Replacement glass base, large","hoses",79,3.1,"M",true,null,"Fits 18/8 stems"),
  p("OSS-0304","Grommet and gasket kit","hoses",9,0.08,"XS",false,null,"12 pieces"),
  p("OSS-0305","Mouth tips, pack of 50","hoses",8,0.12,"XS",false,null,"Individually wrapped"),
  p("OSS-0306","Purge valve stem adapter","hoses",18,0.2,"XS",false,null,"18/8 thread"),
  p("OSS-0401","Gold aviator frame","frames",69,0.18,"XS",false,null,"With hard case"),
  p("OSS-0402","Black acetate square frame","frames",59,0.16,"XS",false,null,"With hard case"),
  p("OSS-0403","Rimless titanium frame","frames",119,0.14,"XS",false,null,"With hard case"),
  p("OSS-0404","Tortoise round frame","frames",64,0.17,"XS",false,null,"With hard case"),
  p("OSS-0405","Sport wrap frame","frames",79,0.2,"XS",false,null,"With hard case"),
];
