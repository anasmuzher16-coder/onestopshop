// The store pages' view of the shipping maths: the shared core, fed the box sizes from the catalogue.
import { BOXES } from "/api/catalog-module";
import { useBoxes } from "./rates-core.js";
useBoxes(BOXES);
export * from "./rates-core.js";
