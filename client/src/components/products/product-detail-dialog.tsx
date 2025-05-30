import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface ProductDetailDialogProps {
  product: any;
  isOpen: boolean;
  onClose: () => void;
}

export function ProductDetailDialog({ product, isOpen, onClose }: ProductDetailDialogProps) {
  if (!product) return null;

  // No need to fetch vendor separately as we're getting vendorName directly in product data

  // Fetch product modules - use custom fetch for the product modules endpoint
  const { data: modules, isLoading: isLoadingModules } = useQuery({
    queryKey: [`/api/products/${product.id}/modules`],
    enabled: isOpen && !!product.id,
    queryFn: async () => {
      const response = await fetch(`/api/products/${product.id}/modules`);
      if (!response.ok) {
        throw new Error('Failed to fetch product modules');
      }
      return response.json();
    }
  });
  
  // Log the modules data when it changes
  React.useEffect(() => {
    if (modules) {
      console.log("Modules loaded for product", product.id, ":", modules);
    }
  }, [product.id, modules]);

  // Calculate total price including modules
  const calculateTotalPrice = () => {
    // Handle various formats of base price (number, string with currency symbol)
    const basePrice = typeof product.price === 'number' 
      ? product.price 
      : parseFloat(String(product.price).replace(/[^\d.-]/g, '')) || 0;
    
    if (!Array.isArray(modules) || modules.length === 0) return basePrice;
    
    const modulesPriceTotal = modules.reduce((total: number, module: any) => {
      // Handle module price in different formats
      const modulePrice = typeof module.price === 'number'
        ? module.price
        : parseFloat(String(module.price || '0').replace(/[^\d.-]/g, '')) || 0;
      
      return total + modulePrice;
    }, 0);
    
    return basePrice + modulesPriceTotal;
  };

  // Format the date
  const formatDate = (dateString?: string | Date) => {
    if (!dateString) return "N/A";
    try {
      return format(new Date(dateString), "dd/MM/yyyy");
    } catch {
      return "N/A";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center justify-between">
            <span>Product Details</span>
            {product.isActive ? (
              <Badge variant="won" className="ml-2">Active</Badge>
            ) : (
              <Badge variant="secondary" className="ml-2">Inactive</Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Complete information about this product
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Product Name</h3>
                <p className="mt-1">{product.name}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">SKU</h3>
                <p className="mt-1">{product.sku || "N/A"}</p>
              </div>
            </div>

            {/* Vendor Information */}
            <div>
              <h3 className="text-sm font-medium text-gray-500">Vendor</h3>
              {product.vendorName ? (
                <p className="mt-1">{product.vendorName}</p>
              ) : (
                <p className="mt-1 text-muted-foreground">No vendor information</p>
              )}
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-500">Description</h3>
              <p className="mt-1 whitespace-pre-wrap">{product.description || "No description available"}</p>
            </div>

            {/* Pricing Information */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Base Price</h3>
                <p className="mt-1">₹{formatCurrency(product.price)}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">Tax Rate</h3>
                <p className="mt-1">{product.tax || 0}%</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">Created On</h3>
                <p className="mt-1">{formatDate(product.createdAt)}</p>
              </div>
            </div>
          </div>

          {/* Modules Section */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">Included Modules</h3>
            {isLoadingModules ? (
              <div className="flex items-center justify-center py-4">
                <LoadingSpinner size="sm" />
                <span className="ml-2">Loading modules...</span>
              </div>
            ) : !Array.isArray(modules) || modules.length === 0 ? (
              <p className="text-muted-foreground py-2">No modules included with this product</p>
            ) : (
              <div className="space-y-4">
                <div className="border rounded-md overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {Array.isArray(modules) && modules.map((module: any) => (
                        <tr key={module.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{module.name}</td>
                          <td className="px-6 py-4 text-sm text-gray-500 max-w-[200px] truncate">{module.description || "N/A"}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₹{formatCurrency(module.price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Total Price */}
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-md">
                  <span className="font-medium">Total Price (Base + Modules)</span>
                  <span className="font-bold text-lg">₹{formatCurrency(calculateTotalPrice())}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}