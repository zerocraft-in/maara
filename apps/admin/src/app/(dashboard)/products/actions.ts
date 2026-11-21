// Domain-specific action re-exports.
// Prefer importing from the individual domain files directly:
//
//   product-actions.ts   – createProduct, updateProduct, archiveProduct,
//                          setProductStatus, bulkArchiveProducts,
//                          bulkSetProductStatus
//   variant-actions.ts   – createVariant, updateVariant, setVariantStatus
//   image-actions.ts     – createProductImage, updateProductImage,
//                          deleteProductImage
//   collection-actions.ts – createCollection, createProductOption,
//                           deleteProductOption

export type { ProductResult } from "./product-actions";
export {
  createProduct,
  updateProduct,
  archiveProduct,
  setProductStatus,
  bulkArchiveProducts,
  bulkSetProductStatus,
} from "./product-actions";

export {
  createVariant,
  updateVariant,
  setVariantStatus,
} from "./variant-actions";

export {
  createProductImage,
  updateProductImage,
  deleteProductImage,
} from "./image-actions";

export {
  createCollection,
  createProductOption,
  deleteProductOption,
} from "./collection-actions";
